/**
 * What a teacher does inside the in-class tools (the whiteboard, the classroom hub, the pen
 * over slides and book pages), as analytics events.
 *
 * Until 2026-11-20 the only record of these screens was minutes spent (`usage_minutes`,
 * area `classroom`), which could not tell a teacher drawing on the board from one running a
 * team game. Each event below is one action, with counts and choices only: never a title, a
 * lesson, a problem's text or anything drawn.
 *
 * The names are history: renaming one splits its chart in two, so `classUsage.test.ts` pins
 * the list. Add a new event; do not rename a shipped one.
 *
 * Pure (analytics.ts loads its client lazily), so bare `node --test` can load it.
 */
import { trackEvent } from './analytics.ts';

export const CLASS_USAGE_EVENTS = [
  'whiteboard_opened',
  'whiteboard_drawn',
  'whiteboard_solved',
  'whiteboard_saved',
  'whiteboard_exported',
  'classroom_activity_started',
  'class_pen_used',
] as const;

export type ClassUsageEvent = (typeof CLASS_USAGE_EVENTS)[number];

/** How the board was reached: a saved board reopened, from a running presentation, or on its own. */
export type WhiteboardSource = 'saved' | 'presentation' | 'menu';

/**
 * `savedId` wins: a board reopened from «ملفاتي» is `saved` whatever else the URL says.
 * `from` is only ever set by the presentation; anything else (the Tools tab, Today, a typed
 * URL) is `menu`, and the `tool_opened` event beside it says which menu.
 */
export function whiteboardSource(params: { savedId?: string; from?: string }): WhiteboardSource {
  if (params.savedId) return 'saved';
  return params.from === 'presentation' ? 'presentation' : 'menu';
}

export function trackWhiteboardOpened(source: WhiteboardSource): void {
  trackEvent('whiteboard_opened', { source });
}

/** Once per visit, on the first stroke: "opened it and wrote", as against "opened it and left". */
export function trackWhiteboardDrawn(source: WhiteboardSource): void {
  trackEvent('whiteboard_drawn', { source });
}

/** A «حلّ مسألة» request that ended, either way. A cancelled one is not reported. */
export function trackWhiteboardSolved(ok: boolean): void {
  trackEvent('whiteboard_solved', { ok });
}

export function trackWhiteboardSaved(p: { pages: number; first: boolean; withSolution: boolean }): void {
  trackEvent('whiteboard_saved', p);
}

export function trackWhiteboardExported(pages: number): void {
  trackEvent('whiteboard_exported', { pages });
}

/** «ابدأ العرض» in the classroom builder: which format, and how the teacher set it up. */
export function trackClassroomActivityStarted(p: {
  format: string;
  duration: number;
  group: string;
  setup: string;
}): void {
  trackEvent('classroom_activity_started', p);
}

/** Once per visit, on the first stroke of the pen drawn over a slide or a book page. */
export function trackClassPenUsed(surface: 'slides' | 'book_page'): void {
  trackEvent('class_pen_used', { surface });
}

/**
 * True exactly once: when ink first appears on a surface that had none. The screens keep the
 * returned flag in a ref, so clearing the board and drawing again is not a second report.
 */
export function firstInk(alreadyReported: boolean, hasInkNow: boolean): boolean {
  return !alreadyReported && hasInkNow;
}
