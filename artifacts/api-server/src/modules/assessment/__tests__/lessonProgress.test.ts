/**
 * What counts as «passed» for the mastery gate. The rules that matter most are
 * the ones that stop a lesson unlocking on a mark that proves nothing.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  MASTERY_PASS_PERCENT,
  passedLessonIds,
  quizLessonIds,
  studentLessonProgress,
  unlockState,
  withUnlocks,
  type SittingForProgress,
} from "../lessonProgress.ts";

// objective "oN" belongs to lesson "lN"; "oX" belongs to no lesson.
const lessonsOf = (ids: readonly string[] | null | undefined) =>
  [...new Set((ids ?? []).filter(i => i !== "oX").map(i => `l${i.slice(1)}`))];

function sitting(over: Partial<SittingForProgress> = {}): SittingForProgress {
  return { objectiveIds: ["o1"], percent: "85.00", isProvisional: false, ...over };
}

describe("unlockState", () => {
  const base = { gateOn: true, lessonId: "l1" as string | null, passed: false, granted: false };

  it("offers an unlock for a quiz the student has not passed", () => {
    assert.equal(unlockState(base), "available");
  });

  it("shows a granted unlock, so the teacher can undo it", () => {
    assert.equal(unlockState({ ...base, granted: true }), "granted");
    assert.equal(unlockState({ ...base, granted: true, passed: true }), "granted");
  });

  it("offers nothing for a passed quiz, with the gate off, or when the exam is not a one-lesson quiz", () => {
    assert.equal(unlockState({ ...base, passed: true }), "none");
    assert.equal(unlockState({ ...base, gateOn: false }), "none");
    assert.equal(unlockState({ ...base, lessonId: null }), "none");
  });
});

describe("withUnlocks", () => {
  it("adds teacher-unlocked lessons to the passed ones, once each", () => {
    assert.deepEqual(withUnlocks(["l1"], ["l1", "l2"]).sort(), ["l1", "l2"]);
    assert.deepEqual(withUnlocks([], []), []);
  });
});

describe("quizLessonIds", () => {
  it("lists only lessons an exam covers on its own, once each", () => {
    const exams = [
      { objectiveIds: ["o1"] },
      { objectiveIds: ["o1", "o1"] },
      { objectiveIds: ["o2", "o3"] },
      { objectiveIds: ["oX"] },
      { objectiveIds: null },
      { objectiveIds: ["o4"] },
    ];
    assert.deepEqual(quizLessonIds(exams, lessonsOf), ["l1", "l4"]);
  });
});

describe("passedLessonIds", () => {
  it("passes a lesson at or above the mark, and not below it", () => {
    assert.deepEqual(passedLessonIds([sitting({ percent: MASTERY_PASS_PERCENT })], lessonsOf), ["l1"]);
    assert.deepEqual(passedLessonIds([sitting({ percent: MASTERY_PASS_PERCENT - 0.01 })], lessonsOf), []);
  });

  it("never counts a provisional paper", () => {
    assert.deepEqual(passedLessonIds([sitting({ percent: 100, isProvisional: true })], lessonsOf), []);
  });

  it("credits an exam only when it covers exactly one lesson", () => {
    assert.deepEqual(passedLessonIds([sitting({ objectiveIds: ["o1", "o2"] })], lessonsOf), []);
    assert.deepEqual(passedLessonIds([sitting({ objectiveIds: ["o1", "o1"] })], lessonsOf), ["l1"]);
    assert.deepEqual(passedLessonIds([sitting({ objectiveIds: ["oX"] })], lessonsOf), []);
    assert.deepEqual(passedLessonIds([sitting({ objectiveIds: null })], lessonsOf), []);
  });

  it("lets a later pass stand after an earlier fail, and lists a lesson once", () => {
    const rows = [sitting({ percent: 40 }), sitting({ percent: 90 }), sitting({ percent: 95 })];
    assert.deepEqual(passedLessonIds(rows, lessonsOf), ["l1"]);
  });

  it("treats an unreadable percent as not passed", () => {
    assert.deepEqual(passedLessonIds([sitting({ percent: null })], lessonsOf), []);
    assert.deepEqual(passedLessonIds([sitting({ percent: "abc" })], lessonsOf), []);
  });

  it("honours a different threshold", () => {
    assert.deepEqual(passedLessonIds([sitting({ percent: 85 })], lessonsOf, 90), []);
  });
});

describe("studentLessonProgress", () => {
  const released = (over: Partial<SittingForProgress> = {}) => ({ ...sitting(over), released: true });
  const held = (over: Partial<SittingForProgress> = {}) => ({ ...sitting(over), released: false });

  it("counts a pass only once the teacher has released it", () => {
    assert.deepEqual(studentLessonProgress([released({ percent: 95 })], lessonsOf), { passed: ["l1"], awaiting: [] });
    assert.deepEqual(studentLessonProgress([held({ percent: 95 })], lessonsOf), { passed: [], awaiting: ["l1"] });
  });

  it("reports a pass and a fail the same way before release", () => {
    assert.deepEqual(
      studentLessonProgress([held({ percent: 95 })], lessonsOf),
      studentLessonProgress([held({ percent: 10 })], lessonsOf),
    );
  });

  it("keeps a released but unmarked paper waiting, and a released fail neither passed nor waiting", () => {
    assert.deepEqual(studentLessonProgress([released({ isProvisional: true })], lessonsOf), { passed: [], awaiting: ["l1"] });
    assert.deepEqual(studentLessonProgress([released({ percent: 40 })], lessonsOf), { passed: [], awaiting: [] });
  });

  it("does not call a lesson waiting once a released sitting has passed it", () => {
    const out = studentLessonProgress([released({ percent: 90 }), held({ percent: 20 })], lessonsOf);
    assert.deepEqual(out, { passed: ["l1"], awaiting: [] });
  });

  it("ignores an unreleased exam that spans several lessons", () => {
    assert.deepEqual(studentLessonProgress([held({ objectiveIds: ["o1", "o2"] })], lessonsOf), { passed: [], awaiting: [] });
  });
});
