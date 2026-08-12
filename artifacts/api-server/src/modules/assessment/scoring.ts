/**
 * Turning marks into a level.
 *
 * Everything here is a pure function over already-marked questions, so the
 * arithmetic that decides what a teacher tells a parent is testable without a
 * database, a model, or a running server.
 *
 * The two rules worth reading before changing anything:
 *
 * 1. **Sufficiency.** A competency measured by one question is noise. Reporting
 *    "33% in تفكير ناقد" off a single lucky or unlucky answer is worse than
 *    reporting nothing, because a percentage looks like a measurement. Below the
 *    threshold the competency is returned `sufficient: false` and must be
 *    rendered as "بيانات غير كافية" — never as a number, and never counted
 *    toward the level.
 *
 * 2. **Demotion.** An average hides holes. A student can reach 72% overall while
 *    missing half the basic facts, and calling that متمكّن is a claim the marks
 *    do not support. The caps below are what stop the headline number from
 *    overriding what it is made of.
 */
import {
  COMPETENCY_KEYS,
  type CompetencyKey,
} from "./competency.ts";
import type { LevelKey, Verdict } from "@workspace/db";

/** One marked question, reduced to what aggregation needs. */
export interface GradedQuestion {
  questionId: string;
  competency: CompetencyKey;
  objectiveId: string | null;
  awardedMarks: number;
  maxMarks: number;
  verdict: Verdict;
  /** AI marks below the confidence floor are excluded from both sides. */
  excluded?: boolean;
  /** Ordering hint for gaps: foundational first. */
  bloomsRank?: number;
}

export interface CompetencyScore {
  earned: number;
  total: number;
  /** Null when insufficient — there is no honest percentage to show. */
  percent: number | null;
  questionCount: number;
  sufficient: boolean;
}

export interface ObjectiveScore {
  objectiveId: string;
  earned: number;
  total: number;
  percent: number;
  questionCount: number;
  marksLost: number;
  bloomsRank: number;
}

export interface LevelBandInput {
  key: LevelKey;
  minPercent: number;
  maxPercent: number;
}

export interface AttemptScore {
  earnedMarks: number;
  totalMarks: number;
  percent: number;
  unansweredCount: number;
  competencyScores: Record<CompetencyKey, CompetencyScore>;
  objectiveScores: ObjectiveScore[];
  levelKey: LevelKey | null;
  /** Set when a demotion rule capped the level below the raw band. */
  demotionReason: string | null;
  strengths: ObjectiveScore[];
  gaps: ObjectiveScore[];
}

/** A competency needs at least this much evidence before it may show a number. */
export const MIN_QUESTIONS_PER_COMPETENCY = 2;
export const MIN_SHARE_OF_TOTAL_MARKS = 0.1;

/** Below this, a competency counts as not held rather than partially held. */
const KNOWLEDGE_FLOOR = 50;
const DEVELOPING_FLOOR = 50;
const STRENGTH_PERCENT = 80;
const GAP_PERCENT = 60;

const pct = (earned: number, total: number): number =>
  total <= 0 ? 0 : Math.round((earned / total) * 10000) / 100;

/** Ranks levels weakest to strongest so a cap can be applied by comparison. */
const LEVEL_ORDER: LevelKey[] = ["beginner", "developing", "proficient", "advanced"];

function capLevel(level: LevelKey, cap: LevelKey): LevelKey {
  return LEVEL_ORDER.indexOf(level) > LEVEL_ORDER.indexOf(cap) ? cap : level;
}

export function resolveLevel(percent: number, bands: readonly LevelBandInput[]): LevelKey | null {
  const hit = bands.find(b => percent >= b.minPercent && percent <= b.maxPercent);
  return hit?.key ?? null;
}

export function scoreAttempt(
  questions: readonly GradedQuestion[],
  bands: readonly LevelBandInput[],
): AttemptScore {
  const counted = questions.filter(q => !q.excluded);

  const earnedMarks = counted.reduce((sum, q) => sum + q.awardedMarks, 0);
  const totalMarks = counted.reduce((sum, q) => sum + q.maxMarks, 0);
  const percent = pct(earnedMarks, totalMarks);

  // Unanswered scores zero and stays in the denominator, but is tracked apart:
  // 40% from wrong answers and 40% from running out of time are different
  // diagnoses and must not produce the same recommendation.
  const unansweredCount = counted.filter(q => q.verdict === "unanswered").length;

  const competencyScores = {} as Record<CompetencyKey, CompetencyScore>;
  for (const key of COMPETENCY_KEYS) {
    const mine = counted.filter(q => q.competency === key);
    const earned = mine.reduce((s, q) => s + q.awardedMarks, 0);
    const total = mine.reduce((s, q) => s + q.maxMarks, 0);
    const sufficient =
      mine.length >= MIN_QUESTIONS_PER_COMPETENCY
      && totalMarks > 0
      && total / totalMarks >= MIN_SHARE_OF_TOTAL_MARKS;
    competencyScores[key] = {
      earned,
      total,
      percent: sufficient ? pct(earned, total) : null,
      questionCount: mine.length,
      sufficient,
    };
  }

  const byObjective = new Map<string, GradedQuestion[]>();
  for (const q of counted) {
    if (!q.objectiveId) continue;
    const list = byObjective.get(q.objectiveId) ?? [];
    list.push(q);
    byObjective.set(q.objectiveId, list);
  }

  const objectiveScores: ObjectiveScore[] = [...byObjective.entries()].map(([objectiveId, list]) => {
    const earned = list.reduce((s, q) => s + q.awardedMarks, 0);
    const total = list.reduce((s, q) => s + q.maxMarks, 0);
    return {
      objectiveId,
      earned,
      total,
      percent: pct(earned, total),
      questionCount: list.length,
      marksLost: total - earned,
      bloomsRank: Math.min(...list.map(q => q.bloomsRank ?? 0)),
    };
  });

  let levelKey = resolveLevel(percent, bands);
  let demotionReason: string | null = null;

  if (levelKey) {
    const knowledge = competencyScores["knowledge"];
    // 1. You cannot be proficient in a topic whose facts you do not have.
    if (knowledge?.sufficient && (knowledge.percent ?? 0) < KNOWLEDGE_FLOOR) {
      const capped = capLevel(levelKey, "developing");
      if (capped !== levelKey) demotionReason = "knowledge_below_floor";
      levelKey = capped;
    }

    // 2. Two weak competencies is a pattern, not a bad question.
    const weak = COMPETENCY_KEYS.filter(k => {
      const c = competencyScores[k];
      return c.sufficient && (c.percent ?? 0) < DEVELOPING_FLOOR;
    });
    if (weak.length >= 2) {
      const capped = capLevel(levelKey, "developing");
      if (capped !== levelKey) demotionReason ??= "two_competencies_below_floor";
      levelKey = capped;
    }

    // 3. Advanced is a claim about independent reasoning. Without evidence of
    //    reasoning, do not make it — silence here is not the same as a pass.
    if (!competencyScores["critical_thinking"]?.sufficient) {
      const capped = capLevel(levelKey, "proficient");
      if (capped !== levelKey) demotionReason ??= "critical_thinking_insufficient";
      levelKey = capped;
    }
  }

  // Gaps lead with the most marks actually lost, not the lowest percentage: a
  // 55% objective worth 12 marks costs more than a 20% one worth 2. Ties break
  // toward foundational Bloom's levels, because fixing those moves the rest.
  const gaps = objectiveScores
    .filter(o => o.percent < GAP_PERCENT)
    .sort((a, b) => b.marksLost - a.marksLost || a.bloomsRank - b.bloomsRank);

  const strengths = objectiveScores
    .filter(o => o.percent >= STRENGTH_PERCENT && o.questionCount >= 2)
    .sort((a, b) => b.percent - a.percent);

  return {
    earnedMarks,
    totalMarks,
    percent,
    unansweredCount,
    competencyScores,
    objectiveScores,
    levelKey,
    demotionReason,
    strengths,
    gaps,
  };
}
