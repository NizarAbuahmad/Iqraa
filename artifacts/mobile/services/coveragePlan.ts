/**
 * Which lesson each question of a wide-scope paper is about.
 *
 * A semester has 18 maths lessons and a paper has 5–30 questions, so something
 * must decide which lessons get one. That decision is made here, once, as a
 * plan of lesson indices, and read by BOTH paths: the offline generators draw
 * each question from its slot's lesson, and the live prompt is given the same
 * plan as per-lesson counts. Two places holding the rule independently is how a
 * teacher gets a different paper depending on whether live AI was on.
 *
 * Free of react-native so `node --test` can load it.
 */
import { lessonsInScope, type ScopeSelection } from './scopeSelection.ts';

export type Distribution = 'balanced' | 'random';
export const DISTRIBUTIONS: readonly Distribution[] = ['balanced', 'random'];

/** What a plan needs to know about a lesson. */
export type PoolLesson = { id: string; unitId: string };

/** A lesson as the request carries it: a short code the model can tag a question with. */
export type CoverageLesson = { code: string; id: string; unitId: string; title: string };

/** `slots` holds lesson codes, one per question, and is sent for `balanced` only. */
export type Coverage = { lessons: CoverageLesson[]; slots?: string[] };

function planBalanced(pool: readonly PoolLesson[], n: number, offset: number): number[] {
  const unitOrder: string[] = [];
  const byUnit = new Map<string, number[]>();
  pool.forEach((lesson, i) => {
    let list = byUnit.get(lesson.unitId);
    if (!list) {
      list = [];
      byUnit.set(lesson.unitId, list);
      unitOrder.push(lesson.unitId);
    }
    list.push(i);
  });
  const shift = ((offset % unitOrder.length) + unitOrder.length) % unitOrder.length;
  const units = [...unitOrder.slice(shift), ...unitOrder.slice(0, shift)];
  const taken = new Map<string, number>();
  const out: number[] = [];
  // One lesson from each unit per round, so no unit gets a second before every
  // unit has a first. A small unit's lesson can come round again before a big
  // unit has used all of its own: balanced is by unit, not by lesson.
  while (out.length < n) {
    for (const unit of units) {
      if (out.length >= n) break;
      const list = byUnit.get(unit)!;
      const k = taken.get(unit) ?? 0;
      out.push(list[(k + offset) % list.length]!);
      taken.set(unit, k + 1);
    }
  }
  return out;
}

function planRandom(size: number, n: number, random: () => number): number[] {
  const out: number[] = [];
  // Each pass is a fresh permutation, so no lesson repeats before all were used.
  while (out.length < n) {
    const pass = Array.from({ length: size }, (_, i) => i);
    for (let i = pass.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [pass[i], pass[j]] = [pass[j]!, pass[i]!];
    }
    out.push(...pass);
  }
  return out.slice(0, n);
}

/**
 * Indices into `pool`, one per question slot.
 *
 * `offset` rotates where `balanced` starts so an offline Regenerate does not
 * return the same plan; it is never sent to the server.
 */
export function planCoverage(
  pool: readonly PoolLesson[],
  count: number,
  mode: Distribution,
  opts: { offset?: number; random?: () => number } = {},
): number[] {
  const n = Math.max(0, Math.floor(count));
  if (pool.length === 0 || n === 0) return [];
  return mode === 'random'
    ? planRandom(pool.length, n, opts.random ?? Math.random)
    : planBalanced(pool, n, opts.offset ?? 0);
}

/** The lessons of a scope as the request carries them, in book order. */
export function coverageLessons(sel: ScopeSelection, lang: 'ar' | 'en'): CoverageLesson[] {
  return lessonsInScope(sel).map((l, i) => ({
    code: `L${i + 1}`,
    id: l.id,
    unitId: l.unitId,
    title: lang === 'ar' ? l.titleAr : l.titleEn,
  }));
}

/** The coverage block of a request. `random` carries no per-question assignment. */
export function buildCoverage(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  count: number,
  mode: Distribution,
  opts: { offset?: number } = {},
): Coverage {
  const lessons = coverageLessons(sel, lang);
  if (mode === 'random') return { lessons };
  const plan = planCoverage(lessons, count, 'balanced', opts);
  return { lessons, slots: plan.map(i => lessons[i]!.code) };
}

/**
 * Turn the model's `lesson` code on each question into a lesson id, in place,
 * and drop the raw tag. A code that is not in the table is ignored: model
 * tagging is unreliable, and a reply is never rejected over it.
 */
export function lessonIdsFromTags(
  questions: { lesson?: string; lessonId?: string }[],
  lessons: readonly CoverageLesson[],
): void {
  const byCode = new Map(lessons.map(l => [l.code, l.id]));
  for (const q of questions) {
    const raw = typeof q.lesson === 'string' ? q.lesson.trim().toUpperCase() : '';
    delete q.lesson;
    if (q.lessonId) continue;
    const id = byCode.get(raw);
    if (id) q.lessonId = id;
  }
}

/** Which of the scope's lessons the paper's questions actually belong to. */
export function coverageSummary(
  questions: readonly { lessonId?: string }[],
  lessons: readonly CoverageLesson[],
): { covered: CoverageLesson[]; uncovered: CoverageLesson[] } {
  const used = new Set(questions.map(q => q.lessonId).filter((id): id is string => !!id));
  return {
    covered: lessons.filter(l => used.has(l.id)),
    uncovered: lessons.filter(l => !used.has(l.id)),
  };
}
