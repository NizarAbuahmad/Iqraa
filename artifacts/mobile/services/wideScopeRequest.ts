/**
 * What a screen adds to a request when the teacher picked a unit, a semester
 * or the whole book — and the small pieces of state around it.
 *
 * Free of react-native so `node --test` can load it; the screens and
 * `useWideScope` are thin wrappers around it.
 */
import type { AIRequest, QuizOutput, WorksheetOutput } from './ai/AIService.ts';
import { buildCoverage, DISTRIBUTIONS, lessonIdsFromTags, type CoverageLesson, type Distribution } from './coveragePlan.ts';
import { scopeRequestFields } from './generatorRequests.ts';
import { resolveScopeGrounding, type ScopeGrounding } from './scopeGrounding.ts';
import { parseScope, type ScopeSelection } from './scopeSelection.ts';

export type WideRequestFields = Pick<
  AIRequest,
  'scope' | 'additionalContext' | 'contextSource' | 'distribution' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'
>;

export type WideRequest = {
  fields: WideRequestFields;
  grounding: ScopeGrounding;
  lessons: CoverageLesson[];
};

/**
 * The fields to MERGE OVER a screen's own, last.
 *
 * `unitId` and `lessonId` are present and `undefined` on purpose: a screen's
 * own request carries the lesson its topic grounded to (nothing, for a label
 * like «الفصل الأول كاملًا», but never rely on that), and a spread only
 * overrides a key that is there. `bookFigureCount: 0` selects the stricter
 * prompt that forbids «انظر الشكل» — a whole-semester paper has no single
 * figure appendix.
 *
 * Null for a lesson scope and for a wide scope that does not ground: the
 * caller refuses rather than generate a mislabeled paper.
 */
export function buildWideRequest(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  count: number,
  mode: Distribution,
  opts: { offset?: number } = {},
): WideRequest | null {
  if (sel.kind === 'lesson') return null;
  const grounding = resolveScopeGrounding(sel, lang);
  if (!grounding.grounded) return null;
  const coverage = buildCoverage(sel, lang, count, mode, opts);
  return {
    grounding,
    lessons: coverage.lessons,
    fields: {
      ...scopeRequestFields(grounding),
      unitId: undefined,
      lessonId: undefined,
      bookFigureCount: 0,
      distribution: mode,
      coverage,
    },
  };
}

/** The picker's counts. 25 and 30 are APPENDED: saved indices must keep their meaning. */
export const BASE_QUESTION_COUNTS: readonly number[] = [5, 8, 10, 12, 15, 20];
export const ALL_QUESTION_COUNTS: readonly number[] = [...BASE_QUESTION_COUNTS, 25, 30];

/** How many of `ALL_QUESTION_COUNTS` a screen offers. */
export function visibleCountOptions(isWide: boolean): number {
  return isWide ? ALL_QUESTION_COUNTS.length : BASE_QUESTION_COUNTS.length;
}

/** A saved index that points at 25 or 30 falls back to 20 when the scope is a single lesson. */
export function clampCountIndex(idx: number, isWide: boolean): number {
  return Math.min(idx, visibleCountOptions(isWide) - 1);
}

export function scopeFromParam(raw?: string): ScopeSelection | null {
  if (!raw) return null;
  try {
    return parseScope(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function distributionFromParam(raw?: string): Distribution {
  return (DISTRIBUTIONS as readonly string[]).includes(raw ?? '') ? (raw as Distribution) : 'balanced';
}

/** What a saved material records. A lesson scope records nothing: it is today's behaviour. */
export function scopeFormState(sel: ScopeSelection | null, mode: Distribution): { scope?: string; distribution?: string } {
  if (!sel || sel.kind === 'lesson') return {};
  return { scope: JSON.stringify(sel), distribution: mode };
}

/**
 * Map the model's lesson codes on a live quiz to lesson ids. A no-op without a
 * coverage table, and for a reply whose shape is not the one asked for (the
 * paper then fails its own checks downstream; tagging must not throw first).
 */
export function tagQuizLessons(out: QuizOutput, req: AIRequest): QuizOutput {
  if (req.coverage?.lessons.length && Array.isArray(out?.questions)) lessonIdsFromTags(out.questions, req.coverage.lessons);
  return out;
}

/** The same for a live worksheet or homework. */
export function tagWorksheetLessons(out: WorksheetOutput, req: AIRequest): WorksheetOutput {
  if (req.coverage?.lessons.length && Array.isArray(out?.sections)) {
    for (const section of out.sections) {
      if (Array.isArray(section?.questions)) lessonIdsFromTags(section.questions, req.coverage.lessons);
    }
  }
  return out;
}
