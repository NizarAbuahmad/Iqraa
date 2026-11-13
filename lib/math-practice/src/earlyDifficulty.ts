/**
 * Difficulty for Grade 1 maths, offline.
 *
 * The Grade 1 generators take their numbers from the lesson's own range, and all
 * but a few ignored `diff`, so an easy and a hard paper drew the same questions:
 * measured 2026-11-13, 50 of the 64 Grade 1 lessons drew the same largest numbers
 * at easy and at hard, and the other 14 differed by chance. Both item
 * paths (`makeTopicItem`, `makeElementaryItem`) therefore draw several
 * questions of the kinds a paper has served least and keep one by difficulty. The
 * spread over kinds is untouched; difficulty only chooses within it. The lesson's
 * range is never left: hard is the top of it, never past it.
 */
import { int, type Rng } from './topicKit.ts';
import type { DiffTier } from './index.ts';

/** Fresh draws a Grade 1 item chooses among: enough for each kind to come up several times. */
export const FIRST_GRADE_DRAWS = 15;
/** Drafts of the least-served kinds a Grade 1 item wants to choose among by difficulty. */
export const FIRST_GRADE_CHOICE = 6;

/**
 * How hard a Grade 1 question is for a six-year-old: its largest number (a row
 * of ★ counts as its length), then how many words there are to read. Within one
 * lesson the range is the lesson's own, so this only orders its questions.
 */
export function firstGradeLoad(d: { ar: string; answer: string }): number {
  const nums = [...`${d.ar} ${d.answer}`.matchAll(/\d+/g)].map(m => Number(m[0]));
  const stars = (d.ar.match(/★/g) ?? []).length;
  const words = d.ar.split(/\s+/).filter(w => /\p{L}/u.test(w)).length;
  return Math.max(0, stars, ...nums) * 100 + words;
}

/**
 * One of the drafts, by difficulty: sorted by `firstGradeLoad`, easy takes from
 * the lightest third, hard from the heaviest, medium from the middle — at random
 * within it, so one level still varies from paper to paper.
 */
export function pickByDifficulty<T>(drafts: readonly T[], diff: DiffTier, rng: Rng, text: (t: T) => { ar: string; answer: string }): T {
  const sorted = drafts.slice().sort((a, b) => firstGradeLoad(text(a)) - firstGradeLoad(text(b)));
  const n = sorted.length;
  const third = Math.max(1, Math.round(n / 3));
  const slice = diff === 'easy' ? sorted.slice(0, third)
    : diff === 'hard' ? sorted.slice(n - third)
      : sorted.slice(third, n - third).length > 0 ? sorted.slice(third, n - third) : sorted;
  return slice[int(rng, 0, slice.length - 1)]!;
}
