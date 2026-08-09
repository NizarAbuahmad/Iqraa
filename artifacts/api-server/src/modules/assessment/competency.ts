/**
 * Competencies, and the target spread an evaluation aims for.
 *
 * Bloom's maps onto the four competencies the brief names. What it does not do
 * is decide a question's competency, and the catalog is why: no objective in
 * the corpus is Remember, and only 9 of 118 are Analyze or above. A question
 * inheriting its competency from its objective would produce an evaluation
 * that is ~half Understanding, ~half Application, and nothing else — the same
 * flat picture the defaulted Bloom's levels gave, arrived at honestly.
 *
 * So the objective sets the *subject matter* and the question sets the
 * *cognitive demand*. Asking a Remember-level question about an Apply-level
 * objective ("ما تعريف النظام الخطي؟" against "حل نظام…") is ordinary teaching
 * practice, and it is what lets a 15-question evaluation cover four
 * competencies from a corpus that only spans two.
 */
import type { BloomsLevel } from "@workspace/curriculum";

export type CompetencyKey =
  | "knowledge"
  | "understanding"
  | "application"
  | "critical_thinking";

export const COMPETENCY_KEYS: readonly CompetencyKey[] = [
  "knowledge",
  "understanding",
  "application",
  "critical_thinking",
];

export const COMPETENCY_LABELS_AR: Record<CompetencyKey, string> = {
  knowledge: "المعرفة",
  understanding: "الفهم",
  application: "التطبيق",
  critical_thinking: "التفكير الناقد",
};

const BLOOMS_TO_COMPETENCY: Record<BloomsLevel, CompetencyKey> = {
  Remember: "knowledge",
  Understand: "understanding",
  Apply: "application",
  Analyze: "critical_thinking",
  Evaluate: "critical_thinking",
  Create: "critical_thinking",
};

export function competencyForBlooms(level: BloomsLevel): CompetencyKey {
  return BLOOMS_TO_COMPETENCY[level] ?? "understanding";
}

/**
 * Share of total marks each competency should carry, by evaluation difficulty.
 *
 * Basic leans on recall and comprehension; advanced shifts weight upward. None
 * of them drops a competency to zero — a level computed from three competencies
 * silently means something different from one computed from four.
 */
export type Difficulty = "basic" | "standard" | "advanced";

export const COMPETENCY_TARGETS: Record<Difficulty, Record<CompetencyKey, number>> = {
  basic: { knowledge: 0.35, understanding: 0.35, application: 0.2, critical_thinking: 0.1 },
  standard: { knowledge: 0.2, understanding: 0.3, application: 0.3, critical_thinking: 0.2 },
  advanced: { knowledge: 0.1, understanding: 0.2, application: 0.35, critical_thinking: 0.35 },
};

/**
 * Marks a question carries, by cognitive demand. Analysis is worth more than
 * recall, which is ordinary practice — and the reason allocation has to be done
 * in marks rather than counts.
 */
export const MARKS_BY_COMPETENCY: Record<CompetencyKey, number> = {
  knowledge: 1,
  understanding: 2,
  application: 3,
  critical_thinking: 4,
};

/**
 * Choose how many questions each competency gets.
 *
 * Allocation is greedy on **marks**, not on question counts, because the two
 * are not the same thing once questions carry different weights: four recall
 * questions at 1 mark and one analysis question at 4 marks are equal halves of
 * the paper by mark and 4:1 by count. The level is computed marks-weighted, so
 * an allocation done by count produces a paper whose competency shares do not
 * match what was asked for — a 20% knowledge target landing at 9% of marks and
 * getting dropped from the result as insufficient evidence.
 *
 * Each step adds a question to whichever competency is furthest below its
 * target share of the marks awarded so far. Every competency is seeded with two
 * questions first where the budget allows: scoring treats anything under two as
 * insufficient evidence, so a competency starved here becomes a blank bar on
 * the teacher's dashboard rather than a low score.
 *
 * **The floor beats the target when they conflict.** A basic evaluation targets
 * critical thinking at 10% of marks, but two seeded questions at 4 marks each
 * are already 23% of a 20-question paper — the target is unreachable until the
 * paper is about twice that size (at 40 questions basic lands at 12%). The
 * alternative would be seeding fewer than two, which does not produce a lower
 * score for that competency; it produces no score at all, and the teacher gets
 * a blank where they expected a bar. Being somewhat over-weighted in critical
 * thinking on a short basic paper is the better failure.
 */
export function allocateQuestions(
  total: number,
  difficulty: Difficulty,
): Record<CompetencyKey, number> {
  const targets = COMPETENCY_TARGETS[difficulty];
  const counts = Object.fromEntries(COMPETENCY_KEYS.map(k => [k, 0])) as Record<
    CompetencyKey,
    number
  >;
  if (total <= 0) return counts;

  let remaining = total;

  const MIN_PER_COMPETENCY = 2;
  if (remaining >= MIN_PER_COMPETENCY * COMPETENCY_KEYS.length) {
    for (const key of COMPETENCY_KEYS) {
      counts[key] = MIN_PER_COMPETENCY;
      remaining -= MIN_PER_COMPETENCY;
    }
  }

  const marksOf = (c: Record<CompetencyKey, number>) =>
    COMPETENCY_KEYS.reduce((sum, k) => sum + c[k] * MARKS_BY_COMPETENCY[k], 0);

  while (remaining > 0) {
    const totalMarks = marksOf(counts);
    let best: CompetencyKey = COMPETENCY_KEYS[0]!;
    let bestDeficit = -Infinity;

    for (const key of COMPETENCY_KEYS) {
      const share = totalMarks > 0 ? (counts[key] * MARKS_BY_COMPETENCY[key]) / totalMarks : 0;
      const deficit = targets[key] - share;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = key;
      }
    }

    counts[best] += 1;
    remaining -= 1;
  }

  return counts;
}
