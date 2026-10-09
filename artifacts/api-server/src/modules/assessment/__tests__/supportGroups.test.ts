/**
 * Support groups: who is under 60% on each objective (the student record's
 * marks-weighted rule), and how each member did on the group's latest check.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { supportGroups, type SupportGroupsInput } from "../supportGroups.ts";
import type { ObjectiveInfo } from "../studentRecord.ts";
import type { ObjectiveScore } from "../scoring.ts";

function o(objectiveId: string, earned: number, total: number): ObjectiveScore {
  return { objectiveId, earned, total, percent: total > 0 ? (earned / total) * 100 : 0,
    questionCount: 1, marksLost: total - earned, bloomsRank: 2 };
}
const describeAll = (id: string): ObjectiveInfo | null =>
  ({ titleAr: `هدف ${id}`, lessonId: id === "oX" ? null : `kbl-${id}`, lessonTitleAr: `درس ${id}` });

const members = [
  { studentId: "s1", displayName: "أحمد" },
  { studentId: "s2", displayName: "ليلى" },
  { studentId: "s3", displayName: "عمر" },
];

function input(over: Partial<SupportGroupsInput>): SupportGroupsInput {
  return { members, papers: [], checks: [], checkAttempts: [], ...over };
}

describe("supportGroups — members", () => {
  it("lists students under 60% marks-weighted across papers, weakest first", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [o("oA", 1, 5)] },
        { studentId: "s1", objectiveScores: [o("oA", 4, 5)] },   // s1: 5/10 = 50%
        { studentId: "s2", objectiveScores: [o("oA", 1, 10)] },  // s2: 10%
        { studentId: "s3", objectiveScores: [o("oA", 9, 10)] },  // s3: 90%
      ],
    }), describeAll);
    assert.equal(groups.length, 1);
    assert.deepEqual(groups[0]!.members.map(m => [m.studentId, m.percent]), [["s2", 10], ["s1", 50]]);
    assert.equal(groups[0]!.classPercent, 50); // 15/30
    assert.equal(groups[0]!.lessonId, "kbl-oA");
  });
  it("ignores papers with no breakdown and students no longer in the class", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [] },
        { studentId: "gone", objectiveScores: [o("oA", 0, 5)] },
      ],
    }), describeAll);
    assert.deepEqual(groups, []);
  });
  it("orders groups by member count, then lowest class percent", () => {
    const groups = supportGroups(input({
      papers: [
        { studentId: "s1", objectiveScores: [o("oA", 2, 5), o("oB", 1, 5)] },
        { studentId: "s2", objectiveScores: [o("oA", 2, 5), o("oB", 5, 5)] },
        { studentId: "s3", objectiveScores: [o("oC", 0, 5)] },
      ],
    }), describeAll);
    assert.deepEqual(groups.map(g => g.objectiveId), ["oA", "oC", "oB"]);
  });
});

describe("supportGroups — the group's check", () => {
  const papers = [
    { studentId: "s1", objectiveScores: [o("oA", 1, 5)] },
    { studentId: "s2", objectiveScores: [o("oA", 1, 5)] },
    { studentId: "s3", objectiveScores: [o("oA", 1, 5)] },
  ];
  const check = (over: Partial<SupportGroupsInput["checks"][number]>) => ({
    evaluationId: "c1", title: "تحقق", status: "published" as const, archived: false,
    createdAt: new Date("2026-10-05T08:00:00Z"), objectiveIds: ["oA"], assignedStudentIds: ["s1", "s2", "s3"],
    ...over,
  });
  it("reports passed / still_weak / not_yet at the 60 line", () => {
    const [g] = supportGroups(input({
      papers,
      checks: [check({})],
      checkAttempts: [
        { evaluationId: "c1", studentId: "s1", attemptStatus: "graded", percent: "100.00", objectiveScores: [o("oA", 3, 3)] },
        { evaluationId: "c1", studentId: "s2", attemptStatus: "needs_review", percent: "33.33", objectiveScores: [o("oA", 1, 3)] },
        { evaluationId: "c1", studentId: "s3", attemptStatus: "in_progress", percent: null, objectiveScores: null },
      ],
    }), describeAll);
    assert.deepEqual(g!.latestCheck!.outcomes.map(x => [x.studentId, x.outcome]), [["s1", "passed"], ["s2", "still_weak"], ["s3", "not_yet"]]);
    assert.equal(g!.latestCheck!.outcomes[0]!.percent, 100);
    assert.equal(g!.latestCheck!.outcomes[2]!.percent, null);
  });
  it("uses the attempt's percent when the breakdown is empty, and 60 passes", () => {
    const [g] = supportGroups(input({
      papers, checks: [check({ assignedStudentIds: ["s1"] })],
      checkAttempts: [{ evaluationId: "c1", studentId: "s1", attemptStatus: "graded", percent: "60.00", objectiveScores: [] }],
    }), describeAll);
    assert.equal(g!.latestCheck!.outcomes[0]!.outcome, "passed");
  });
  it("takes the newest published check, never an archived one, and reports a draft separately", () => {
    const [g] = supportGroups(input({
      papers,
      checks: [
        check({ evaluationId: "old", createdAt: new Date("2026-10-01T08:00:00Z") }),
        check({ evaluationId: "new", createdAt: new Date("2026-10-03T08:00:00Z") }),
        check({ evaluationId: "arch", archived: true, createdAt: new Date("2026-10-04T08:00:00Z") }),
        check({ evaluationId: "draft", status: "draft", createdAt: new Date("2026-10-06T08:00:00Z") }),
        check({ evaluationId: "other", objectiveIds: ["oB"], createdAt: new Date("2026-10-07T08:00:00Z") }),
        check({ evaluationId: "multi", objectiveIds: ["oA", "oB"], createdAt: new Date("2026-10-08T08:00:00Z") }),
      ],
    }), describeAll);
    assert.equal(g!.latestCheck!.evaluationId, "new");
    assert.deepEqual(g!.draftCheck, { evaluationId: "draft" });
  });
  it("lists only assignees still in the class", () => {
    const [g] = supportGroups(input({
      papers, checks: [check({ assignedStudentIds: ["s1", "gone"] })],
    }), describeAll);
    assert.deepEqual(g!.latestCheck!.outcomes.map(x => x.studentId), ["s1"]);
  });
});
