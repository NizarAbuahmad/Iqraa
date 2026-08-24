/**
 * Next steps from marks.
 *
 * The cases that matter are the ones a teacher would notice: an empty panel on
 * a marked attempt, advice on an attempt nobody has marked, and a gap list
 * ordered by percentage instead of by what it actually cost.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { recommendationsFor } from "../recommend.ts";
import { scoreAttempt, type GradedQuestion, type LevelBandInput } from "../scoring.ts";

const BANDS: LevelBandInput[] = [
  { key: "beginner", minPercent: 0, maxPercent: 49 },
  { key: "developing", minPercent: 50, maxPercent: 69 },
  { key: "proficient", minPercent: 70, maxPercent: 84 },
  { key: "advanced", minPercent: 85, maxPercent: 100 },
];

const resolve = (id: string) => ({ title: `Objective ${id}`, titleAr: `نتاج ${id}` });

let seq = 0;
function q(objectiveId: string, awarded: number, max: number): GradedQuestion {
  return {
    questionId: `q${seq++}`,
    competency: "understanding",
    objectiveId,
    awardedMarks: awarded,
    maxMarks: max,
    verdict: awarded >= max ? "correct" : awarded > 0 ? "partial" : "incorrect",
    bloomsRank: 2,
  };
}

describe("recommendationsFor", () => {
  it("says nothing about an attempt nobody has marked", () => {
    const score = scoreAttempt([], BANDS);
    assert.deepEqual(recommendationsFor(score, resolve), []);
  });

  it("reteaches an objective that is near zero, drills one that is merely weak", () => {
    const score = scoreAttempt([q("untaught", 0, 6), q("shaky", 5, 10)], BANDS);
    const recs = recommendationsFor(score, resolve);
    const byObjective = new Map(recs.map(r => [r.objectiveId + ":" + r.kind, r]));
    assert.ok(byObjective.has("untaught:review"), "0% objective should be reteach");
    assert.ok(byObjective.has("shaky:practice"), "50% objective should be practice");
  });

  it("leads with the objective that cost the most marks, not the lowest percent", () => {
    // 20% of 5 marks loses 4; 55% of 20 marks loses 9. The bigger loss leads.
    const score = scoreAttempt([q("small", 1, 5), q("expensive", 11, 20)], BANDS);
    const recs = recommendationsFor(score, resolve);
    assert.equal(recs[0]!.objectiveId, "expensive");
  });

  it("closes the loop with a reassessment of the costliest gap", () => {
    const score = scoreAttempt([q("weak", 1, 10)], BANDS);
    const recs = recommendationsFor(score, resolve);
    const reassess = recs.filter(r => r.kind === "reassess");
    assert.equal(reassess.length, 1);
    assert.equal(reassess[0]!.objectiveId, "weak");
  });

  it("never returns an empty panel for an attempt that went well", () => {
    const score = scoreAttempt([q("solid", 10, 10), q("solid", 9, 10)], BANDS);
    const recs = recommendationsFor(score, resolve);
    assert.equal(recs.length > 0, true);
    assert.equal(recs[0]!.kind, "activity");
  });

  it("still advises when everything is mediocre — no gaps, no strengths", () => {
    // 70%: above the gap line, below the strength line. Neither list catches it.
    const score = scoreAttempt([q("middling", 7, 10)], BANDS);
    const recs = recommendationsFor(score, resolve);
    assert.equal(recs.length, 1);
    assert.equal(recs[0]!.kind, "activity");
    assert.equal(recs[0]!.objectiveId, "middling");
  });

  it("caps the gap list so a teacher reads a plan, not an inventory", () => {
    const score = scoreAttempt(
      ["a", "b", "c", "d", "e"].map(id => q(id, 1, 10)),
      BANDS,
    );
    const recs = recommendationsFor(score, resolve);
    assert.equal(recs.filter(r => r.kind !== "reassess").length, 3);
  });

  it("snapshots the objective's title so it survives a curriculum change", () => {
    const score = scoreAttempt([q("obj-9", 0, 4)], BANDS);
    const [rec] = recommendationsFor(score, resolve);
    assert.equal(rec!.payload.objectiveTitleAr, "نتاج obj-9");
    assert.equal(rec!.payload.marksLost, 4);
  });
});
