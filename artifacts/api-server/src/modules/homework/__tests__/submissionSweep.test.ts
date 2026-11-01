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
  REFUSE_MIN_ORPHANS,
  REFUSE_RATIO,
  SUBMISSION_PREFIX,
  homeworkIdOf,
  isSubmissionKey,
  parseSweepQuery,
  planSweep,
  shouldRefuse,
  type SweepObject,
} from "../submissionSweep.ts";

const HW = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";
/** A homework this database does not have (the "wrong database" case). */
const OTHER_HW = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
const ST = "0f9e8d7c-6b5a-4392-8a1b-c0d1e2f3a4b5";
const PH = "11111111-2222-4333-8444-555555555555";
const key = (ext = "jpg", id = PH, hw = HW) => `${SUBMISSION_PREFIX}${hw}/${ST}/${id}.${ext}`;
const NOW = new Date("2026-10-30T12:00:00.000Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const obj = (k: string, ms: number): SweepObject => ({ key: k, lastModified: ago(ms) });
const nth = (n: number, hw = HW) => key("jpg", `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`, hw);
const plan = (
  objects: SweepObject[],
  referenced: string[] = [],
  extra: { graceMs?: number; maxDeletes?: number; knownHomeworkIds?: string[] } = {},
) =>
  planSweep({
    objects,
    referencedKeys: new Set(referenced),
    now: NOW,
    graceMs: extra.graceMs,
    maxDeletes: extra.maxDeletes,
    knownHomeworkIds: new Set(extra.knownHomeworkIds ?? [HW]),
  });
/** `n` old objects a row refers to, under the known homework: they dilute the ratio guard without being deletable. */
const referencedBatch = (n: number, from = 100_000) => {
  const objects = Array.from({ length: n }, (_, i) => obj(nth(from + i), GRACE_MS * 3));
  return { objects, keys: objects.map(o => o.key) };
};

describe("constants", () => {
  it("are the documented ones", () => {
    assert.equal(SUBMISSION_PREFIX, "homework-submissions/");
    assert.equal(GRACE_MS, 24 * 60 * 60 * 1000);
    assert.equal(MAX_DELETES, 1000);
    assert.equal(REFUSE_MIN_ORPHANS, 20);
    assert.equal(REFUSE_RATIO, 0.5);
  });
});

describe("isSubmissionKey", () => {
  it("accepts the three image extensions with lower-case hex, as randomUUID() and Postgres write it", () => {
    for (const ext of ["jpg", "png", "webp"]) assert.equal(isSubmissionKey(key(ext)), true, ext);
  });
  it("refuses upper-case hex in any of the three ids", () => {
    assert.equal(isSubmissionKey(key("jpg", PH.toUpperCase().replace(/1/g, "A"))), false, "photo id");
    assert.equal(isSubmissionKey(`${SUBMISSION_PREFIX}${HW.toUpperCase()}/${ST}/${PH}.png`), false, "homework id");
    assert.equal(isSubmissionKey(`${SUBMISSION_PREFIX}${HW}/${ST.toUpperCase()}/${PH}.png`), false, "student id");
    assert.equal(isSubmissionKey(`${SUBMISSION_PREFIX}${HW.replace("c", "C")}/${ST}/${PH}.png`), false, "one upper-case digit");
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
      `HOMEWORK-SUBMISSIONS/${HW}/${ST}/${PH}.jpg`,
      `Homework-Submissions/${HW}/${ST}/${PH}.jpg`,
      `homework-submissions/${HW}/${ST}/${PH}.Jpg`,
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

describe("parseSweepQuery", () => {
  it("is a real run only with no dryRun key at all (what Cloud Scheduler sends) or an exact 0 / false", () => {
    assert.deepEqual(parseSweepQuery({}), { ok: true, dryRun: false });
    assert.deepEqual(parseSweepQuery({ dryRun: "0" }), { ok: true, dryRun: false });
    assert.deepEqual(parseSweepQuery({ dryRun: "false" }), { ok: true, dryRun: false });
  });
  it("is a dry run whenever the key is present in any other form", () => {
    const forms: unknown[] = ["", "1", "true", "TRUE", "True", "yes", "on", "FALSE", "False", "00", "0 ", "1 ", " 0", ["1", "1"], ["0", "0"], ["0"], [], undefined, null, {}, 0, false, true];
    for (const dryRun of forms) assert.deepEqual(parseSweepQuery({ dryRun }), { ok: true, dryRun: true }, JSON.stringify(dryRun) ?? String(dryRun));
  });
  it("refuses any other key, even next to a valid dryRun", () => {
    for (const q of [{ dryrun: "1" }, { "dry-run": "1" }, { DRYRUN: "1" }, { limit: "5" }, { foo: "1" }, { "dryRun[]": "1" }, { dryRun: "0", foo: "1" }, { dryRun: "1", limit: "5" }]) {
      assert.deepEqual(parseSweepQuery(q), { ok: false }, JSON.stringify(q));
    }
  });
});

describe("planSweep", () => {
  it("deletes an unreferenced, old, conforming object", () => {
    const p = plan([obj(key(), GRACE_MS + 1)]);
    assert.deepEqual(p.toDelete.map(o => o.key), [key()]);
    assert.deepEqual(p.wouldDelete, p.toDelete);
    assert.deepEqual(
      { ...p, toDelete: [], wouldDelete: [] },
      { toDelete: [], wouldDelete: [], capped: 0, skippedYoung: 0, skippedBadKey: 0, skippedUnknownHomework: 0, referenced: 0, known: 1, refused: false },
    );
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

  it("keeps an object whose lastModified is not a valid date: an age it cannot compute is young", () => {
    const p = plan([{ key: key(), lastModified: new Date("not a date") }]);
    // Lengths, not deepEqual: the TAP reporter crashes printing an Invalid Date in a failure diff.
    assert.equal(p.toDelete.length, 0);
    assert.equal(p.wouldDelete.length, 0);
    assert.equal(p.skippedYoung, 1);
  });

  it("keeps everything when the grace period is NaN, rather than deleting everything", () => {
    const p = plan([obj(key(), GRACE_MS * 100), obj(key("png"), 0)], [], { graceMs: Number.NaN });
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
    const k = (n: number) => nth(n);
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
    const k = (n: number) => nth(n);
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
    assert.deepEqual(plan([]), {
      toDelete: [],
      wouldDelete: [],
      capped: 0,
      skippedYoung: 0,
      skippedBadKey: 0,
      skippedUnknownHomework: 0,
      referenced: 0,
      known: 0,
      refused: false,
    });
  });

  it("defaults the cap to MAX_DELETES", () => {
    const objects = Array.from({ length: MAX_DELETES + 3 }, (_, i) => obj(nth(i), GRACE_MS + i));
    // Enough referenced photos that the orphans are under half of what is known, so the ratio guard lets it run.
    const live = referencedBatch(MAX_DELETES + 3);
    const p = plan([...objects, ...live.objects], live.keys);
    assert.equal(p.refused, false);
    assert.equal(p.toDelete.length, MAX_DELETES);
    assert.equal(p.capped, 3);
  });

  describe("the known-homework guard: an object is deletable only if THIS database has its homework", () => {
    it("keeps an old, unreferenced object whose homework is unknown, and counts it", () => {
      const p = plan([obj(key("jpg", PH, OTHER_HW), GRACE_MS * 50)]);
      assert.deepEqual(p.toDelete, []);
      assert.deepEqual(p.wouldDelete, []);
      assert.equal(p.skippedUnknownHomework, 1);
      assert.equal(p.known, 0);
      assert.equal(p.capped, 0);
    });

    it("keeps every one of them when no homework is known at all (the wrong-database case)", () => {
      const objects = Array.from({ length: 30 }, (_, i) => obj(nth(i, OTHER_HW), GRACE_MS * 2));
      const p = plan(objects, [], { knownHomeworkIds: [] });
      assert.deepEqual(p.toDelete, []);
      assert.equal(p.skippedUnknownHomework, 30);
      assert.equal(p.refused, false, "nothing is deletable, so there is nothing to refuse");
    });

    it("deletes the known-homework orphan and keeps the unknown one in the same listing", () => {
      const known = obj(nth(1), GRACE_MS * 2);
      const unknown = obj(nth(2, OTHER_HW), GRACE_MS * 2);
      const p = plan([known, unknown]);
      assert.deepEqual(p.toDelete.map(o => o.key), [known.key]);
      assert.equal(p.skippedUnknownHomework, 1);
      assert.equal(p.known, 1);
    });

    it("applies before the cap: unknown objects do not use up the deletes of a run", () => {
      const unknown = Array.from({ length: 5 }, (_, i) => obj(nth(i, OTHER_HW), GRACE_MS * 9));
      const known = [obj(nth(10), GRACE_MS * 2), obj(nth(11), GRACE_MS * 2)];
      const p = plan([...unknown, ...known], [], { maxDeletes: 2 });
      assert.deepEqual(p.toDelete.map(o => o.key), [nth(10), nth(11)], "the older unknown ones did not take the cap");
      assert.equal(p.capped, 0);
      assert.equal(p.skippedUnknownHomework, 5);
    });

    it("counts a young or referenced object as young or referenced, whatever its homework", () => {
      const p = plan([obj(nth(1, OTHER_HW), 5), obj(nth(2, OTHER_HW), GRACE_MS * 2)], [nth(2, OTHER_HW)]);
      assert.equal(p.skippedYoung, 1);
      assert.equal(p.referenced, 1);
      assert.equal(p.skippedUnknownHomework, 0);
      assert.equal(p.known, 0, "neither is under a known homework");
    });

    it("counts in `known` every conforming object under a known homework, young, old or referenced", () => {
      const p = plan([obj(nth(1), 5), obj(nth(2), GRACE_MS * 2), obj(nth(3), GRACE_MS * 2), obj(key("gif"), GRACE_MS * 2), obj(nth(4, OTHER_HW), GRACE_MS * 2)], [nth(3)]);
      assert.equal(p.known, 3);
    });
  });

  describe("the ratio guard: refuse a run that would delete most of what it can see", () => {
    it("refuses 25 orphans next to 5 referenced photos: nothing to delete, the would-be list kept for a dry run", () => {
      const orphans = Array.from({ length: 25 }, (_, i) => obj(nth(i), GRACE_MS * 2));
      const live = referencedBatch(5);
      const p = plan([...orphans, ...live.objects], live.keys);
      assert.equal(p.refused, true);
      assert.equal(typeof p.refusedReason, "string");
      assert.ok(p.refusedReason!.length > 0);
      assert.deepEqual(p.toDelete, [], "a refused plan deletes nothing");
      assert.equal(p.wouldDelete.length, 25, "but says what it would have deleted");
      assert.equal(p.known, 30);
    });

    it("proceeds with 25 orphans next to 60 referenced photos (more than 20, but under half)", () => {
      const orphans = Array.from({ length: 25 }, (_, i) => obj(nth(i), GRACE_MS * 2));
      const live = referencedBatch(60);
      const p = plan([...orphans, ...live.objects], live.keys);
      assert.equal(p.refused, false);
      assert.equal(p.refusedReason, undefined);
      assert.equal(p.toDelete.length, 25);
    });

    it("counts the orphans before the cap", () => {
      const orphans = Array.from({ length: 25 }, (_, i) => obj(nth(i), GRACE_MS * 2));
      const live = referencedBatch(5);
      const p = plan([...orphans, ...live.objects], live.keys, { maxDeletes: 3 });
      assert.equal(p.refused, true, "25 orphans, not the 3 the cap would let through");
      assert.deepEqual(p.toDelete, []);
    });

    it("ignores unknown-homework objects: they are neither orphans nor known", () => {
      const unknown = Array.from({ length: 100 }, (_, i) => obj(nth(i, OTHER_HW), GRACE_MS * 2));
      const p = plan([...unknown, obj(nth(1), GRACE_MS * 2)]);
      assert.equal(p.refused, false);
      assert.equal(p.toDelete.length, 1);
    });
  });

  describe("shouldRefuse", () => {
    it("never refuses 20 orphans or fewer, whatever the ratio", () => {
      assert.equal(shouldRefuse(20, 20), false);
      assert.equal(shouldRefuse(20, 0), false);
      assert.equal(shouldRefuse(0, 0), false);
      assert.equal(shouldRefuse(1, 1), false);
    });
    it("refuses 21 orphans that are more than half of what is known", () => {
      assert.equal(shouldRefuse(21, 21), true);
      assert.equal(shouldRefuse(21, 41), true);
      assert.equal(shouldRefuse(21, 0), true, "orphans with nothing known: a bucket that belongs to someone else");
    });
    it("does not refuse at exactly half, and refuses just above it", () => {
      assert.equal(shouldRefuse(21, 42), false, "exactly 50%");
      assert.equal(shouldRefuse(30, 60), false, "exactly 50%");
      assert.equal(shouldRefuse(30, 59), true, "just above 50%");
      assert.equal(shouldRefuse(1000, 2000), false);
      assert.equal(shouldRefuse(1001, 2000), true);
    });
  });

  describe("homeworkIdOf", () => {
    it("is the first segment after the prefix of a conforming key, and null for anything else", () => {
      assert.equal(homeworkIdOf(key()), HW);
      assert.equal(homeworkIdOf(key("gif")), null);
      assert.equal(homeworkIdOf(`lesson-media/${PH}.jpg`), null);
      assert.equal(homeworkIdOf(`${SUBMISSION_PREFIX}${HW.toUpperCase()}/${ST}/${PH}.jpg`), null);
    });
  });

  it("does not mutate its inputs", () => {
    const objects: SweepObject[] = [obj(key("png"), GRACE_MS * 3), obj(key("jpg"), GRACE_MS * 5)];
    const referenced = new Set<string>(["homework-submissions/x"]);
    const before = JSON.stringify(objects);
    const frozen = Object.freeze(objects.map(o => Object.freeze({ ...o })));
    const known = new Set([HW]);
    planSweep({ objects: frozen, referencedKeys: referenced, knownHomeworkIds: known, now: NOW });
    assert.equal(JSON.stringify(objects), before);
    assert.deepEqual([...referenced], ["homework-submissions/x"]);
    assert.deepEqual([...known], [HW]);
    const p = planSweep({ objects, referencedKeys: referenced, knownHomeworkIds: known, now: NOW });
    assert.notEqual(p.toDelete, objects);
    assert.equal(JSON.stringify(objects), before, "the listing order is unchanged");
  });
});
