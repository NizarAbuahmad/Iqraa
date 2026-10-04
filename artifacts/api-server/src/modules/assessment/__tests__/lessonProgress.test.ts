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
  type SittingForProgress,
} from "../lessonProgress.ts";

// objective "oN" belongs to lesson "lN"; "oX" belongs to no lesson.
const lessonsOf = (ids: readonly string[] | null | undefined) =>
  [...new Set((ids ?? []).filter(i => i !== "oX").map(i => `l${i.slice(1)}`))];

function sitting(over: Partial<SittingForProgress> = {}): SittingForProgress {
  return { objectiveIds: ["o1"], percent: "85.00", isProvisional: false, ...over };
}

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
