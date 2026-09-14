/**
 * What a whole class missed.
 *
 * After marking thirty papers a teacher does not have thirty questions, they
 * have one: what do I go back over tomorrow. Per-student results answer the
 * wrong question thirty times.
 *
 * The aggregation is **marks-weighted, not a mean of percentages**. Twenty
 * students who each lost 1 of 2 marks and one who lost 9 of 10 are not the
 * same picture, and averaging their percentages would rank the class's real
 * problem below a rounding error. Summing marks earned over marks available
 * keeps the objective that actually cost the class the most at the top — the
 * same rule `scoring.ts` applies within a single attempt, applied one level up.
 *
 * `studentsBelowGap` is carried alongside because the two can disagree in a
 * way a teacher needs to see: an objective can sit at a respectable class
 * percentage while half the room is under water on it, and "62%, 14 of 26
 * students below" is a different lesson plan from "62%, 3 students below".
 */
import { splitGapsAndStrengths, type ObjectiveScore } from "./scoring.ts";

/** Below this share of an objective's marks, a student counts as struggling. */
const STUDENT_GAP_PERCENT = 60;

export interface ClassObjectiveScore extends ObjectiveScore {
  /** How many marked students were below the gap line on this objective. */
  studentsBelowGap: number;
  /** How many had this objective on their paper at all. */
  studentCount: number;
}

export interface ClassInsights {
  studentCount: number;
  earnedMarks: number;
  totalMarks: number;
  percent: number;
  objectiveScores: ClassObjectiveScore[];
  gaps: ObjectiveScore[];
  strengths: ObjectiveScore[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * The papers this view is allowed to describe as marked.
 *
 * A result row exists as soon as the deterministic pass runs, scored over only
 * the questions it could mark — so a link submission with six written answers
 * still untouched carries one. Aggregating it would put a partial denominator
 * into a class percentage and, worse, count that student under "N students
 * whose papers were marked" on the panel that says exactly that.
 *
 * A separate function rather than a filter inside `aggregateClass` because the
 * aggregation itself is indifferent to where its rows came from; what needs a
 * name — and a test — is the rule about which rows are honest to include.
 */
export function finishedAttempts<T extends { isProvisional: boolean }>(
  rows: readonly T[],
): T[] {
  return rows.filter(r => !r.isProvisional);
}

export function aggregateClass(
  attempts: readonly { objectiveScores: readonly ObjectiveScore[] }[],
): ClassInsights {
  const byObjective = new Map<string, ClassObjectiveScore>();

  for (const attempt of attempts) {
    for (const o of attempt.objectiveScores) {
      const existing = byObjective.get(o.objectiveId);
      if (!existing) {
        byObjective.set(o.objectiveId, {
          objectiveId: o.objectiveId,
          earned: o.earned,
          total: o.total,
          percent: 0,
          questionCount: o.questionCount,
          marksLost: 0,
          // Foundational-first tie-break, same as within an attempt. Keep the
          // lowest rank seen: if any student met this objective at a
          // foundational level, fixing it there is what moves the rest.
          bloomsRank: o.bloomsRank,
          studentsBelowGap: 0,
          studentCount: 0,
        });
      }
      const agg = byObjective.get(o.objectiveId)!;
      if (existing) {
        agg.earned += o.earned;
        agg.total += o.total;
        agg.questionCount = Math.max(agg.questionCount, o.questionCount);
        agg.bloomsRank = Math.min(agg.bloomsRank, o.bloomsRank);
      }
      agg.studentCount += 1;
      if (o.percent < STUDENT_GAP_PERCENT) agg.studentsBelowGap += 1;
    }
  }

  const objectiveScores = [...byObjective.values()].map(o => ({
    ...o,
    earned: round2(o.earned),
    total: round2(o.total),
    percent: o.total > 0 ? round2((o.earned / o.total) * 100) : 0,
    marksLost: round2(o.total - o.earned),
  }));

  const earnedMarks = round2(objectiveScores.reduce((s, o) => s + o.earned, 0));
  const totalMarks = round2(objectiveScores.reduce((s, o) => s + o.total, 0));
  const { gaps, strengths } = splitGapsAndStrengths(objectiveScores);

  return {
    studentCount: attempts.length,
    earnedMarks,
    totalMarks,
    percent: totalMarks > 0 ? round2((earnedMarks / totalMarks) * 100) : 0,
    objectiveScores: objectiveScores.sort((a, b) => b.marksLost - a.marksLost),
    gaps,
    strengths,
  };
}
