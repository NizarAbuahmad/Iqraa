/**
 * What this guards: the classifier that decides which stored photos of a minor may be deleted
 * without a database row asking for it. It must err only toward keeping: a young object (an upload
 * in flight), a referenced one, and any key that is not exactly the shape this feature writes are
 * never in `toDelete`.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  GRACE_MS,
  MAX_DELETES,
  SUBMISSION_PREFIX,
  isSubmissionKey,
  planSweep,
  type SweepObject,
} from "../submissionSweep.ts";

const HW = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";
const ST = "0f9e8d7c-6b5a-4392-8a1b-c0d1e2f3a4b5";
const PH = "11111111-2222-4333-8444-555555555555";
const key = (ext = "jpg", id = PH) => `${SUBMISSION_PREFIX}${HW}/${ST}/${id}.${ext}`;
const NOW = new Date("2026-10-30T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const obj = (k: string, ms: number): SweepObject => ({ key: k, lastModified: ago(ms) });
const plan = (objects: SweepObject[], referenced: string[] = [], extra: { graceMs?: number; maxDeletes?: number } = {}) =>
  planSweep({ objects, referencedKeys: new Set(referenced), now: NOW, ...extra });

describe("constants", () => {
  it("are the documented ones", () => {
    assert.equal(SUBMISSION_PREFIX, "homework-submissions/");
    assert.equal(GRACE_MS, 24 * 60 * 60 * 1000);
    assert.equal(MAX_DELETES, 1000);
  });
});

describe("isSubmissionKey", () => {
  it("accepts the three image extensions and either case of the hex", () => {
    for (const ext of ["jpg", "png", "webp"]) assert.equal(isSubmissionKey(key(ext)), true, ext);
    assert.equal(isSubmissionKey(key("jpg", PH.toUpperCase())), true);
    assert.equal(isSubmissionKey(`${SUBMISSION_PREFIX}${HW.toUpperCase()}/${ST}/${PH}.png`), true);
  });
  it("refuses everything that is not exactly that shape", () => {
    const bad = [
      "",
      key("JPG"),
      key("jpeg"),
      key("gif"),
      key("jpg") + "x",
      key("jpg") + "/",
      `${key("jpg")}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/${ST}/extra/${PH}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/${PH}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/${ST}/s1.jpg`,
      `${SUBMISSION_PREFIX}../${ST}/${PH}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/../${PH}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/${ST}/../${PH}.jpg`,
      `homework-submission/${HW}/${ST}/${PH}.jpg`,
      `/${SUBMISSION_PREFIX}${HW}/${ST}/${PH}.jpg`,
      ` ${key("jpg")}`,
      `${key("jpg")}\n`,
      `lesson-media/${PH}.jpg`,
      `chat-media/${PH}.png`,
      `library/${PH}.webp`,
      SUBMISSION_PREFIX,
      `${SUBMISSION_PREFIX}${HW}/${ST}/${PH.slice(1)}.jpg`,
      `${SUBMISSION_PREFIX}${HW}/${ST}/${PH.replace("1", "g")}.jpg`,
    ];
    for (const k of bad) assert.equal(isSubmissionKey(k), false, JSON.stringify(k));
  });
});

describe("planSweep", () => {
  it("deletes an unreferenced, old, conforming object", () => {
    const p = plan([obj(key(), GRACE_MS + 1)]);
    assert.deepEqual(p.toDelete.map(o => o.key), [key()]);
    assert.deepEqual({ ...p, toDelete: [] }, { toDelete: [], capped: 0, skippedYoung: 0, skippedBadKey: 0, referenced: 0 });
  });

  it("treats an age of exactly the grace period as deletable and one millisecond less as young", () => {
    const exact = plan([obj(key(), GRACE_MS)]);
    assert.equal(exact.toDelete.length, 1);
    assert.equal(exact.skippedYoung, 0);
    const young = plan([obj(key(), GRACE_MS - 1)]);
    assert.deepEqual(young.toDelete, []);
    assert.equal(young.skippedYoung, 1);
  });

  it("counts a future date (clock skew) as young", () => {
    const p = plan([obj(key(), -GRACE_MS * 10), obj(key("png"), -1)]);
    assert.deepEqual(p.toDelete, []);
    assert.equal(p.skippedYoung, 2);
  });

  it("honours a grace period passed in", () => {
    assert.equal(plan([obj(key(), 1000)], [], { graceMs: 1000 }).toDelete.length, 1);
    assert.equal(plan([obj(key(), 999)], [], { graceMs: 1000 }).toDelete.length, 0);
  });

  it("keeps a referenced object however old, and counts it", () => {
    const p = plan([obj(key(), GRACE_MS * 365)], [key()]);
    assert.deepEqual(p.toDelete, []);
    assert.equal(p.referenced, 1);
    assert.equal(p.skippedYoung, 0);
  });

  it("counts a referenced young object as referenced, not as young", () => {
    const p = plan([obj(key(), 5)], [key()]);
    assert.equal(p.referenced, 1);
    assert.equal(p.skippedYoung, 0);
  });

  it("never plans a non-conforming key, however old and unreferenced, and counts it", () => {
    const bad = [key("JPG"), key("gif"), `${SUBMISSION_PREFIX}${HW}/${ST}/x/${PH}.jpg`, `${SUBMISSION_PREFIX}../${PH}.jpg`, `${SUBMISSION_PREFIX}note.txt`];
    const p = plan(bad.map(k => obj(k, GRACE_MS * 100)));
    assert.deepEqual(p.toDelete, []);
    assert.equal(p.skippedBadKey, bad.length);
    assert.equal(p.referenced, 0);
  });

  it("does not count a non-conforming key as referenced even if a row names it", () => {
    const bad = key("gif");
    const p = plan([obj(bad, GRACE_MS * 2)], [bad]);
    assert.deepEqual(p.toDelete, []);
    assert.equal(p.skippedBadKey, 1);
    assert.equal(p.referenced, 0);
  });

  it("orders oldest first, ties by key, and cuts at the cap, counting the rest", () => {
    const k = (n: number) => key("jpg", `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    const objects = [
      obj(k(3), GRACE_MS + 10),
      obj(k(1), GRACE_MS + 30),
      obj(k(2), GRACE_MS + 30),
      obj(k(4), GRACE_MS + 20),
      obj(k(5), GRACE_MS + 1),
    ];
    const all = plan(objects);
    assert.deepEqual(all.toDelete.map(o => o.key), [k(1), k(2), k(4), k(3), k(5)]);
    const capped = plan(objects, [], { maxDeletes: 2 });
    assert.deepEqual(capped.toDelete.map(o => o.key), [k(1), k(2)]);
    assert.equal(capped.capped, 3);
    assert.equal(plan(objects, [], { maxDeletes: 0 }).capped, 5);
    assert.equal(plan(objects, [], { maxDeletes: 5 }).capped, 0);
  });

  it("does not let young, referenced or bad objects eat into the cap", () => {
    const k = (n: number) => key("jpg", `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`);
    const p = plan(
      [obj(k(1), 10), obj(k(2), GRACE_MS * 9), obj(key("gif"), GRACE_MS * 9), obj(k(3), GRACE_MS * 2)],
      [k(2)],
      { maxDeletes: 1 },
    );
    assert.deepEqual(p.toDelete.map(o => o.key), [k(3)]);
    assert.equal(p.capped, 0);
    assert.equal(p.skippedYoung, 1);
    assert.equal(p.skippedBadKey, 1);
    assert.equal(p.referenced, 1);
  });

  it("answers an empty listing with an empty plan", () => {
    assert.deepEqual(plan([]), { toDelete: [], capped: 0, skippedYoung: 0, skippedBadKey: 0, referenced: 0 });
  });

  it("defaults the cap to MAX_DELETES", () => {
    const objects = Array.from({ length: MAX_DELETES + 3 }, (_, i) =>
      obj(key("jpg", `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`), GRACE_MS + i),
    );
    const p = plan(objects);
    assert.equal(p.toDelete.length, MAX_DELETES);
    assert.equal(p.capped, 3);
  });

  it("does not mutate its inputs", () => {
    const objects: SweepObject[] = [obj(key("png"), GRACE_MS * 3), obj(key("jpg"), GRACE_MS * 5)];
    const referenced = new Set<string>(["homework-submissions/x"]);
    const before = JSON.stringify(objects);
    const frozen = Object.freeze(objects.map(o => Object.freeze({ ...o })));
    planSweep({ objects: frozen, referencedKeys: referenced, now: NOW });
    assert.equal(JSON.stringify(objects), before);
    assert.deepEqual([...referenced], ["homework-submissions/x"]);
    const p = planSweep({ objects, referencedKeys: referenced, now: NOW });
    assert.notEqual(p.toDelete, objects);
    assert.equal(JSON.stringify(objects), before, "the listing order is unchanged");
  });
});
