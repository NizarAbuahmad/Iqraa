/**
 * «ما أُتقن وما يحتاج إلى مراجعة»: the per-objective picture of one released result,
 * as a student and their parent read it (since 2026-11-27, the owner's call).
 *
 * The marks already say it: `scoreAttempt` stores `objective_scores`, and the teacher's
 * gaps and strengths come from the same rows (`splitGapsAndStrengths`). Until now that
 * was "a diagnostic for the teacher" only, and a family saw a level, a mark and four
 * competencies, with nothing to say what to go over. This is the family's projection
 * of the same split, kept deliberately smaller than the teacher's:
 *
 * - **Names, never numbers.** A percentage per objective off two or three questions
 *   reads like a measurement it is not; the teacher keeps the numbers.
 * - **Two questions or more, both ways.** A strength already needs two; a gap here does
 *   too, so one unlucky answer never tells a parent their child "needs work" on a topic.
 * - **At most three of each**, the gaps ordered as the teacher's are (marks lost first),
 *   so it reads as a short list rather than a report.
 * - **Only objectives the curriculum knows**: an id it no longer has is dropped, never
 *   shown as a bare id.
 *
 * Pure: it is handed the stored rows and a resolver.
 */
import { resolveObjectiveIds } from "@workspace/curriculum";
import { splitGapsAndStrengths, type ObjectiveScore } from "./scoring.ts";

export interface ResultTopic {
  objectiveId: string;
  title: string;
  titleAr: string;
}

export interface TopicSummary {
  /** Went well: at least 80% over two questions or more. */
  strong: ResultTopic[];
  /** Needs more work: under 60% over two questions or more, most marks lost first. */
  weak: ResultTopic[];
}

export const TOPIC_LIMIT = 3;
const MIN_QUESTIONS = 2;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** The stored jsonb, read defensively: a malformed row is skipped, never thrown on. */
function parseScores(raw: unknown): ObjectiveScore[] {
  if (!Array.isArray(raw)) return [];
  const out: ObjectiveScore[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const percent = num(o["percent"]);
    const questionCount = num(o["questionCount"]);
    if (typeof o["objectiveId"] !== "string" || percent === null || questionCount === null) continue;
    out.push({
      objectiveId: o["objectiveId"],
      earned: num(o["earned"]) ?? 0,
      total: num(o["total"]) ?? 0,
      percent,
      questionCount,
      marksLost: num(o["marksLost"]) ?? 0,
      bloomsRank: num(o["bloomsRank"]) ?? 0,
    });
  }
  return out;
}

export function topicSummary(
  objectiveScores: unknown,
  resolve: (ids: readonly string[]) => { found: { id: string; description: string; descriptionAr: string }[] } = resolveObjectiveIds,
): TopicSummary {
  const scores = parseScores(objectiveScores).filter(o => o.questionCount >= MIN_QUESTIONS);
  const { gaps, strengths } = splitGapsAndStrengths(scores);
  const byId = new Map(resolve([...new Set(scores.map(o => o.objectiveId))]).found.map(o => [o.id, o]));
  const named = (list: readonly ObjectiveScore[]): ResultTopic[] =>
    list
      .flatMap(o => {
        const hit = byId.get(o.objectiveId);
        const title = hit?.description?.trim() || hit?.descriptionAr?.trim() || "";
        if (!hit || !title) return [];
        return [{ objectiveId: o.objectiveId, title, titleAr: hit.descriptionAr?.trim() || title }];
      })
      .slice(0, TOPIC_LIMIT);
  return { strong: named(strengths), weak: named(gaps) };
}
