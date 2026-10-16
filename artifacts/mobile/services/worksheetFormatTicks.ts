/**
 * Which of the four format ticks («صِل»، «رتّب الخطوات»، «أين الخطأ؟»، «ارسم»)
 * the worksheet screen shows, which it greys, and what a selection may keep.
 *
 * Kept out of the screen so it can be tested: screen files import
 * `react-native` and cannot be loaded by `node --test`.
 *
 * Homework shares the screen but its generator never builds formats, so the
 * ticks are not offered there AND a selection carried in (a saved material, a
 * route param) is stripped before a request is built — hiding the ticks alone
 * would leave a stale one riding along invisibly.
 *
 * A unit, semester or whole-book paper (a wide scope) has no single lesson to
 * build a format from, so the ticks are hidden there too, the way the screen
 * hides the prior-knowledge review, and stripped from the request. Unlike
 * homework the STORED selection keeps them: the scope selector reports no
 * scope for a moment mid-pick, and the teacher's ticks come back with a lesson.
 * The generators report any format that still reaches them on a wide scope in
 * `missingFormats` (`formatsHaveNoLesson`), so none is dropped silently.
 */
import type { FormatKind } from '@workspace/math-practice';
import { FORMAT_KINDS, isFormatKind } from './ai/worksheetFormats.ts';

export type FormatAvailabilityMap = Record<FormatKind, boolean>;

export interface TickContext {
  isHomework: boolean;
  /** A unit, semester or whole-book scope: no single lesson, so no format. */
  isWide?: boolean;
  /**
   * What the grounded lesson can supply, or null when no lesson is grounded
   * (empty or half-typed topic). Null judges nothing: a tick is only greyed
   * once there is a lesson to say it cannot be built from.
   */
  availability: FormatAvailabilityMap | null;
}

/** The selection a teacher gets back when every ticked type is taken away. */
export const DEFAULT_QUESTION_TYPES = ['multiple_choice', 'short_answer'] as const;

export function formatTicks(ctx: TickContext): { shown: FormatKind[]; greyed: FormatKind[] } {
  if (ctx.isHomework || ctx.isWide) return { shown: [], greyed: [] };
  const shown = [...FORMAT_KINDS];
  const availability = ctx.availability;
  return { shown, greyed: availability ? shown.filter(k => !availability[k]) : [] };
}

/**
 * Whether a tick draws as checked. A greyed tick draws unchecked but stays in
 * the stored selection: the teacher's choice survives a passing topic (typing
 * a title passes through ungrounded and other lessons' states) and comes back
 * if the lesson changes to one that supports it.
 */
export function isTickChecked<T extends string>(type: T, selected: Set<T>, ctx: TickContext): boolean {
  return selected.has(type) && !(isFormatKind(type) && formatTicks(ctx).greyed.includes(type));
}

/**
 * The selection with unavailable formats removed (all formats, for homework
 * and on a wide scope).
 * Used for the REQUEST, and — with `availability: null`, which leaves only the
 * homework rule — for the stored selection. Greyed formats are not stripped
 * from the stored selection (see `isTickChecked`). Returns the SAME set when
 * nothing changed so a state effect built on it does not loop. Never empty: a
 * selection that was only formats falls back to the default ordinary types.
 */
export function sanitizeQuestionTypes<T extends string>(selected: Set<T>, ctx: TickContext): Set<T> {
  const greyed = new Set<string>(formatTicks(ctx).greyed);
  const keep = [...selected].filter(t => !isFormatKind(t) || (!ctx.isHomework && !ctx.isWide && !greyed.has(t)));
  if (keep.length === selected.size) return selected;
  return new Set<T>(keep.length ? keep : (DEFAULT_QUESTION_TYPES as readonly string[] as T[]));
}
