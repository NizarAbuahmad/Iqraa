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
 *
 * **`total` is the whole paper; `supplied` is what is already on it.** Pass the
 * questions that will be added from elsewhere (the textbook's own items) and
 * the return value is how many NEW ones to write per competency, summing to
 * `max(0, total − Σsupplied)`. Supplied questions count towards the two-per-
 * competency floor and towards the shares, so the paper as a whole — not just
 * the new part — is steered to the targets. Absent or all zero, the result is
 * exactly what it was before this argument existed (pinned in the tests).
 *
 * **Small papers.** When the budget cannot seed every competency, nothing is
 * seeded in general, but any competency the book supplies exactly one question
 * of is first brought up to two (cost one each), so the book's lone question is
 * paired rather than left as a single the validator warns about.
 */
export function allocateQuestions(
  total: number,
  difficulty: Difficulty,
  supplied: Partial<Record<CompetencyKey, number>> = {},
): Record<CompetencyKey, number> {
  const targets = COMPETENCY_TARGETS[difficulty];
  const counts = Object.fromEntries(COMPETENCY_KEYS.map(k => [k, 0])) as Record<
    CompetencyKey,
    number
  >;
  const have = Object.fromEntries(
    COMPETENCY_KEYS.map(k => [k, Math.max(0, supplied[k] ?? 0)]),
  ) as Record<CompetencyKey, number>;

  let remaining = Math.max(0, total - COMPETENCY_KEYS.reduce((s, k) => s + have[k], 0));
  if (remaining <= 0) return counts;

  // Seed each competency up to two, supplied questions counting towards the
  // two. All-or-nothing, as before: a partial seeding would starve some
  // competency while pretending to protect the others.
  const MIN_PER_COMPETENCY = 2;
  let pairFirst = false;
  const seedsNeeded = COMPETENCY_KEYS.reduce(
    (s, k) => s + Math.max(0, MIN_PER_COMPETENCY - have[k]),
    0,
  );
  if (remaining >= seedsNeeded) {
    for (const key of COMPETENCY_KEYS) {
      const seed = Math.max(0, MIN_PER_COMPETENCY - have[key]);
      counts[key] = seed;
      remaining -= seed;
    }
  } else if (COMPETENCY_KEYS.some(k => have[k] > 0)) {
    pairFirst = true;
    // The budget cannot cover every seed, so none is made — but a competency the
    // book already supplies exactly ONE question of is a single pair away from
    // being scored, and the greedy loop below would scatter singletons instead.
    // Pair those up first (one question each, in competency order, as far as the
    // budget goes). Only with something supplied: with nothing, this is the
    // pinned behaviour of the unaware allocation.
    for (const key of COMPETENCY_KEYS) {
      if (remaining > 0 && have[key] === 1) {
        counts[key] += 1;
        remaining -= 1;
      }
    }
  }

  // Shares are of the whole paper: what is already on it plus what is added.
  const marksOf = (c: Record<CompetencyKey, number>) =>
    COMPETENCY_KEYS.reduce((sum, k) => sum + (c[k] + have[k]) * MARKS_BY_COMPETENCY[k], 0);

  while (remaining > 0) {
    const totalMarks = marksOf(counts);
    let best: CompetencyKey = COMPETENCY_KEYS[0]!;
    let bestDeficit = -Infinity;

    for (const key of COMPETENCY_KEYS) {
      const share =
        totalMarks > 0 ? ((counts[key] + have[key]) * MARKS_BY_COMPETENCY[key]) / totalMarks : 0;
      const deficit = targets[key] - share;
      if (deficit > bestDeficit) {
        bestDeficit = deficit;
        best = key;
      }
    }

    if (pairFirst && counts[best] + have[best] === 0) {
      // Starting a competency from nothing. Two questions at once, or none: a
      // lone one is a single the validator warns about, which the unaware split
      // would not have made. With one question left, it goes to the competency
      // furthest below target among those the paper already has.
      if (remaining >= 2) {
        counts[best] += 2;
        remaining -= 2;
        continue;
      }
      let present: CompetencyKey | undefined;
      let presentDeficit = -Infinity;
      for (const key of COMPETENCY_KEYS) {
        if (counts[key] + have[key] === 0) continue;
        const share = totalMarks > 0 ? ((counts[key] + have[key]) * MARKS_BY_COMPETENCY[key]) / totalMarks : 0;
        const deficit = targets[key] - share;
        if (deficit > presentDeficit) {
          presentDeficit = deficit;
          present = key;
        }
      }
      best = present ?? best;
    }

    counts[best] += 1;
    remaining -= 1;
  }

  return counts;
}

/**
 * The per-competency quota for a top-up batch.
 *
 * A reply that is short is topped up with a second request for only the missing
 * questions, and that request carries its own per-competency quota (which must
 * sum to the number asked for). Start from the original quota, take off what
 * the model already wrote in each competency (never below zero), then make the
 * total exactly `missing`: over, reduce the largest entries one at a time; under,
 * add to the entry with the largest remaining quota. Ties go to the earlier
 * competency in `COMPETENCY_KEYS`, so the result is the same every time.
 *
 * With the original quota summing to what was first asked for, the remainder
 * can only be at or over `missing`; "under" is a backstop, not a normal path.
 */
export function remainingQuota(
  newByCompetency: Record<CompetencyKey, number>,
  written: ReadonlyArray<{ competencyKey: CompetencyKey }>,
  missing: number,
): Record<CompetencyKey, number> {
  const out = Object.fromEntries(
    COMPETENCY_KEYS.map(k => [k, Math.max(0, newByCompetency[k] ?? 0)]),
  ) as Record<CompetencyKey, number>;
  for (const q of written) {
    if (out[q.competencyKey] > 0) out[q.competencyKey] -= 1;
  }

  const want = Math.max(0, Math.floor(missing));
  let have = COMPETENCY_KEYS.reduce((s, k) => s + out[k], 0);
  const largest = (): CompetencyKey =>
    COMPETENCY_KEYS.reduce((best, k) => (out[k] > out[best] ? k : best), COMPETENCY_KEYS[0]!);

  while (have > want) {
    out[largest()] -= 1;
    have -= 1;
  }
  while (have < want) {
    out[largest()] += 1;
    have += 1;
  }
  return out;
}
