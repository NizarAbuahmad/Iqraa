/**
 * Difficulty for grades 1–4 maths, offline.
 *
 * The early generators (`early.ts`, the grade 1–4 topics and drills) take their
 * numbers from the lesson's own range, and most ignored `diff`, so an easy and a
 * hard paper drew the same questions. Measured 2026-11-13: in Grade 1, 50 of 64
 * lessons drew the same largest numbers at easy and at hard; over whole papers,
 * only 15 of 57 Grade 2 lessons, 25 of 66 Grade 3 and 34 of 48 Grade 4 were clearly
 * harder at hard, and 8 were harder at easy. Both item paths (`makeTopicItem`,
 * `makeElementaryItem`) therefore draw several questions of the kinds a paper
 * has served least and keep one by difficulty. The spread over kinds is
 * untouched; difficulty only chooses within it. The lesson's range is never
 * left: hard is the top of it, never past it. Grade 5 and up are unchanged.
 */
import { int, type Rng } from './topicKit.ts';
import type { DiffTier } from './index.ts';

/** Whether this grade's items are chosen by difficulty (grades 1–4). */
export const choosesByDifficulty = (grade: number) => grade >= 1 && grade <= 4;

/** Fresh draws an early-grade item chooses among: enough for each kind to come up several times. */
export const EARLY_DRAWS = 15;
/** Drafts of the least-served kinds an early-grade item wants to choose among by difficulty. */
export const EARLY_CHOICE = 6;

/**
 * How hard an early-grade question is for a child: its largest number (a row
 * of ★ counts as its length), then how many words there are to read. Within one
 * lesson the range is the lesson's own, so this only orders its questions.
 */
export function difficultyLoad(d: { ar: string; answer: string }): number {
  const nums = [...`${d.ar} ${d.answer}`.matchAll(/\d+/g)].map(m => Number(m[0]));
  const stars = (d.ar.match(/★/g) ?? []).length;
  const words = d.ar.split(/\s+/).filter(w => /\p{L}/u.test(w)).length;
  return Math.max(0, stars, ...nums) * 100 + words;
}

/**
 * One of the drafts, by difficulty: sorted by `difficultyLoad`, easy takes from
 * the lightest third, hard from the heaviest, medium from the middle — at random
 * within it, so one level still varies from paper to paper.
 */
export function pickByDifficulty<T>(drafts: readonly T[], diff: DiffTier, rng: Rng, text: (t: T) => { ar: string; answer: string }): T {
  const sorted = drafts.slice().sort((a, b) => difficultyLoad(text(a)) - difficultyLoad(text(b)));
  const n = sorted.length;
  const third = Math.max(1, Math.round(n / 3));
  const slice = diff === 'easy' ? sorted.slice(0, third)
    : diff === 'hard' ? sorted.slice(n - third)
      : sorted.slice(third, n - third).length > 0 ? sorted.slice(third, n - third) : sorted;
  return slice[int(rng, 0, slice.length - 1)]!;
}
