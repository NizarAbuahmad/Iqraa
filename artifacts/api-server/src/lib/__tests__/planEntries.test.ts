/**
 * What this guards: `entries` is the one teaching-plan field a client sends
 * as structured data rather than a trimmed string, and it lands in a `jsonb`
 * column that will store whatever it is given. Everything downstream — the
 * week grouping, and later "what am I teaching now" — reads it back assuming
 * it parsed.
 *
 * The behaviour worth pinning is that this REJECTS where the client's
 * `normalizePlanEntries` drops. The two look similar and are not: silently
 * saving nine of the ten lessons a teacher picked is the failure this side
 * exists to prevent.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { MAX_PLAN_ENTRIES, MAX_PLAN_WEEK, parsePlanEntries } from "../planEntries.ts";

/** The thrown value is a plain string the route turns into a 400. */
function rejects(raw: unknown): string {
  try {
    parsePlanEntries(raw);
  } catch (msg) {
    return String(msg);
  }
  throw new Error(`expected ${JSON.stringify(raw)} to be rejected`);
}

describe("parsePlanEntries", () => {
  it("passes a well-formed schedule through unchanged", () => {
    const raw = [{ lessonId: "kb-l1", week: 1 }, { lessonId: "kb-l2", week: 4 }];
    assert.deepEqual(parsePlanEntries(raw), raw);
  });

  it("distinguishes an omitted field from an empty schedule", () => {
    // A PATCH that does not mention entries must not wipe them.
    assert.equal(parsePlanEntries(undefined), undefined);
    assert.deepEqual(parsePlanEntries([]), []);
  });

  it("rejects anything that is not an array", () => {
    for (const raw of [null, {}, "kb-l1", 7, true]) {
      assert.match(rejects(raw), /must be an array/);
    }
  });

  it("rejects a malformed entry instead of dropping it", () => {
    assert.match(rejects([null]), /must be an object/);
    assert.match(rejects(["kb-l1"]), /must be an object/);
    assert.match(rejects([{ week: 1 }]), /needs a lessonId/);
    assert.match(rejects([{ lessonId: "", week: 1 }]), /needs a lessonId/);
    assert.match(rejects([{ lessonId: 7, week: 1 }]), /needs a lessonId/);
  });

  it("rejects a week that is not a whole number in range", () => {
    for (const week of [0, -1, 1.5, MAX_PLAN_WEEK + 1, "2", null, NaN]) {
      assert.match(rejects([{ lessonId: "kb-l1", week }]), /whole week between/);
    }
  });

  it("accepts the boundary weeks", () => {
    assert.deepEqual(parsePlanEntries([{ lessonId: "a", week: 1 }]), [{ lessonId: "a", week: 1 }]);
    assert.deepEqual(
      parsePlanEntries([{ lessonId: "a", week: MAX_PLAN_WEEK }]),
      [{ lessonId: "a", week: MAX_PLAN_WEEK }],
    );
  });

  it("rejects the same lesson twice", () => {
    assert.match(
      rejects([{ lessonId: "a", week: 1 }, { lessonId: "a", week: 2 }]),
      /cannot appear twice/,
    );
  });

  it("rejects a plan big enough to be an attack", () => {
    const tooMany = Array.from({ length: MAX_PLAN_ENTRIES + 1 }, (_, i) => ({
      lessonId: `l${i}`,
      week: 1,
    }));
    assert.match(rejects(tooMany), /at most 200 lessons/);
    assert.equal(parsePlanEntries(tooMany.slice(0, MAX_PLAN_ENTRIES))?.length, MAX_PLAN_ENTRIES);
  });

  it("does not care whether a lesson id exists in the catalog", () => {
    // Deliberate: the catalog ships with the app, and a renumbered lesson
    // must not make an existing plan unsaveable.
    assert.deepEqual(
      parsePlanEntries([{ lessonId: "no-such-lesson", week: 2 }]),
      [{ lessonId: "no-such-lesson", week: 2 }],
    );
  });
});
