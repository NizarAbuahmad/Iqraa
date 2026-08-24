/**
 * What to do next, from what the marks say.
 *
 * The teacher has just finished marking. The one question worth answering at
 * that moment is "so what do I teach tomorrow" — and the marks already contain
 * the answer, per objective, ordered by how much it actually cost.
 *
 * Three decisions worth stating:
 *
 * 1. **Gaps come from `scoreAttempt`, not from a threshold restated here.**
 *    `scoring.ts` already decides what counts as a gap and orders them by marks
 *    lost rather than by percentage — a 55% objective worth 12 marks costs more
 *    than a 20% one worth 2. A second copy of that rule would drift from the
 *    first, and the two would disagree about the same attempt.
 *
 * 2. **The panel is never empty for a marked attempt.** A student who did well
 *    still gets a next step — extension on their strongest objective. "Nothing
 *    to do" is not a useful thing to tell a teacher, and an empty panel reads
 *    as broken rather than as praise.
 *
 * 3. **Nothing here is a judgement call**, so nothing carries a confidence.
 *    These are arithmetic over marks the teacher entered. When AI enrichment
 *    lands it writes rows with `generatedBy: 'ai'` beside these, and the two
 *    stay distinguishable — the same reason `grader` exists on a mark.
 */
import type { AttemptScore, ObjectiveScore } from "./scoring.ts";
import type { RecommendationKind } from "@workspace/db";

/** Below this an objective is not weak, it is untaught — reteach, don't drill. */
const RETEACH_PERCENT = 30;

/** More than this and a teacher is reading a list, not a plan. */
const MAX_GAP_RECOMMENDATIONS = 3;

export interface RecommendationDraft {
  kind: RecommendationKind;
  objectiveId: string | null;
  payload: {
    objectiveTitle: string;
    objectiveTitleAr: string;
    percent: number;
    marksLost: number;
    questionCount: number;
  };
}

export type ObjectiveTitleResolver = (
  objectiveId: string,
) => { title: string; titleAr: string } | undefined;

function draft(
  kind: RecommendationKind,
  objective: ObjectiveScore,
  resolve: ObjectiveTitleResolver,
): RecommendationDraft {
  const found = resolve(objective.objectiveId);
  return {
    kind,
    objectiveId: objective.objectiveId,
    payload: {
      // Snapshotted, not looked up at read time: a recommendation should still
      // say what it was about after the curriculum package moves on.
      objectiveTitle: found?.title ?? "",
      objectiveTitleAr: found?.titleAr ?? "",
      percent: objective.percent,
      marksLost: objective.marksLost,
      questionCount: objective.questionCount,
    },
  };
}

export function recommendationsFor(
  score: AttemptScore,
  resolve: ObjectiveTitleResolver,
): RecommendationDraft[] {
  // Nothing has been marked yet. Advice off zero evidence is not a floor, it
  // is noise sitting where a real answer will go.
  if (score.objectiveScores.length === 0) return [];

  const out: RecommendationDraft[] = [];

  for (const gap of score.gaps.slice(0, MAX_GAP_RECOMMENDATIONS)) {
    out.push(draft(gap.percent < RETEACH_PERCENT ? "review" : "practice", gap, resolve));
  }

  if (score.gaps.length > 0) {
    // Re-test the objective that cost the most, once it has been retaught.
    // Without this the loop never closes: the gap gets taught and nothing ever
    // checks whether the teaching worked.
    out.push(draft("reassess", score.gaps[0]!, resolve));
    return out;
  }

  // No gaps. Extend on the strongest thing they showed — falling back to the
  // best objective on the paper when nothing cleared the strength bar, so a
  // solid-but-unspectacular attempt still gets a next step.
  const best =
    score.strengths[0] ??
    [...score.objectiveScores].sort((a, b) => b.percent - a.percent)[0];
  if (best) out.push(draft("activity", best, resolve));

  return out;
}
