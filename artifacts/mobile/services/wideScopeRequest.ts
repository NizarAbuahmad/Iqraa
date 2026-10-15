/**
 * What a screen adds to a request when the teacher picked a unit, a semester
 * or the whole book — and the small pieces of state around it.
 *
 * Free of react-native so `node --test` can load it; the screens and
 * `useWideScope` are thin wrappers around it.
 */
import type { AIRequest, QuizOutput, WorksheetOutput } from './ai/AIService.ts';
import { buildCoverage, coverageLessons, DISTRIBUTIONS, lessonIdsFromTags, type CoverageLesson, type Distribution } from './coveragePlan.ts';
import { revisionUnits, type RevisionUnit } from './revisionScope.ts';
import { buildLessonPlanRequest, scopeRequestFields, type LessonPlanForm } from './generatorRequests.ts';
import type { GeneratorGrounding } from './kbContext.ts';
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

export type ScopeRequestFields = Pick<
  AIRequest,
  'scope' | 'additionalContext' | 'contextSource' | 'coverage' | 'unitId' | 'lessonId' | 'bookFigureCount'
>;

export type ScopeRequest = { fields: ScopeRequestFields; grounding: ScopeGrounding; units: RevisionUnit[] };

/**
 * The teaching tools' counterpart of `buildWideRequest`: lesson plan, activity,
 * classroom builder, slides and lesson-flow, when the teacher picked a unit, a
 * semester or the whole book. Returns the fields to MERGE LAST over the
 * screen's own request.
 *
 * Not `buildWideRequest`: that one wants a question count, plans `slots`, and
 * REPLACES `additionalContext` with `contextSource: 'curriculum'` — on a
 * teaching tool that would silently drop the teacher's typed objectives,
 * adaptations and notes, and pool a plan written from them. Here `own` is what
 * the screen already put in its request (the teacher's text folded into
 * `additionalContext`, and the `contextSource` it decided), and it is kept:
 *
 * - `additionalContext` = the scope digest, then a blank line, then the
 *   screen's own text (either may be absent);
 * - `contextSource` = `'teacher'` when the screen said so, or when it sent text
 *   without saying who wrote it (absent is read as the teacher's, fail closed —
 *   the server's own rule); otherwise `'curriculum'`;
 * - `coverage` = `{ lessons }` only — no `slots`: a teaching tool has no
 *   question slots, and the offline path rebuilds its units from these ids;
 * - `unitId` / `lessonId` present and `undefined`, `bookFigureCount: 0`, for
 *   the reason given on `buildWideRequest`.
 *
 * Null for a lesson scope and for a wide scope that does not ground: the
 * screen refuses (`wideScopeUngrounded`) rather than generate a mislabeled
 * session.
 */
export function buildScopeRequest(
  sel: ScopeSelection,
  lang: 'ar' | 'en',
  own: { additionalContext?: string; contextSource?: 'teacher' | 'curriculum' } = {},
): ScopeRequest | null {
  if (sel.kind === 'lesson') return null;
  const grounding = resolveScopeGrounding(sel, lang);
  if (!grounding.grounded) return null;
  const digest = scopeRequestFields(grounding);
  const ownText = own.additionalContext?.trim() ?? '';
  const teacher = own.contextSource === 'teacher' || (ownText !== '' && own.contextSource === undefined);
  return {
    grounding,
    units: revisionUnits(sel, lang),
    fields: {
      scope: digest.scope,
      additionalContext: [digest.additionalContext ?? '', ownText].filter(Boolean).join('\n\n') || undefined,
      contextSource: teacher ? 'teacher' : 'curriculum',
      coverage: { lessons: coverageLessons(sel, lang) },
      unitId: undefined,
      lessonId: undefined,
      bookFigureCount: 0,
    },
  };
}

/**
 * Inert grounding for a wide request: no lesson, no lesson context, so
 * `buildLessonPlanRequest` contributes only the form's own fields and the
 * teacher's text — never ids, figures or a prior review re-derived from the
 * scope's label.
 */
const SCOPE_GROUNDING: GeneratorGrounding = { lesson: null, grounded: true, score: 0, context: '', ungroundedNote: '' };

/**
 * The lesson-plan screen's request for a unit / semester / book: the form's
 * own request (style, duration, objectives, adaptations, Ministry roles,
 * regeneration) with the scope's fields merged LAST.
 *
 * `own.additionalContext` is the teacher's text ALONE (the adaptations
 * directive): `SCOPE_GROUNDING.context` is empty, so no single lesson's
 * context rides after the scope's digest.
 *
 * A wide plan has no prior-knowledge review (it belongs to one lesson's unit),
 * so `priorTopicsNotes` is dropped here, before the teacher-text rule runs:
 * notes that are not sent must not make the plan private. `includePriorReview`
 * is sent as an explicit `false`, never `undefined`, and `priorKnowledge` is
 * empty, so neither the live prompt nor the offline plan can add a review.
 * Null when `buildScopeRequest` is (a lesson scope, or one that does not
 * ground) — the screen then refuses with `wideScopeUngrounded`.
 */
export function buildWideLessonPlanRequest(form: LessonPlanForm, sel: ScopeSelection): AIRequest | null {
  const own = buildLessonPlanRequest({ ...form, priorTopicsNotes: '', includePriorReview: false }, SCOPE_GROUNDING);
  const wide = buildScopeRequest(sel, form.lang, { additionalContext: own.additionalContext, contextSource: own.contextSource });
  return wide ? { ...own, includePriorReview: false, ...wide.fields } : null;
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
