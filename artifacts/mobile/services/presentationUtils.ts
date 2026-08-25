/**
 * Pure utility functions for PresentationScreen.
 *
 * Extracted from presentation.tsx so they can be tested without importing
 * React Native (which cannot run in Node's test runner).
 */

// ─── Color constants (mirrored from presentation.tsx) ─────────────────────────
const TIMER_GREEN = '#16A34A';
const TIMER_AMBER = '#D97706';
const TIMER_RED   = '#DC2626';

/**
 * Returns the appropriate timer colour based on the fraction of time remaining.
 *
 * @param pct – ratio remaining in [0, 1]. >0.5 → green, >0.2 → amber, else red.
 */
export function timerColor(pct: number): string {
  if (pct > 0.5) return TIMER_GREEN;
  if (pct > 0.2) return TIMER_AMBER;
  return TIMER_RED;
}

/**
 * Compute the timer percentage for a slide.
 * Returns 0 when the slide has no timer (durationSeconds === 0).
 */
export function calcTimerPct(timerSec: number, timerTotal: number): number {
  if (timerTotal === 0) return 0;
  return timerSec / timerTotal;
}

/**
 * Simulate one tick of the countdown timer.
 * Returns the new second count (never below 0).
 */
export function tickTimer(currentSec: number): number {
  return Math.max(0, currentSec - 1);
}

/**
 * Whether a slide should show a timer at all.
 *
 * Type-aware: a duration on a read-out slide type is not a timer.
 * See `timerSecondsForSlide` below.
 */
export function slideHasTimer(slide: { type: string; durationSeconds: number }): boolean {
  return timerSecondsForSlide(slide) > 0;
}

/**
 * Slide types the class reads rather than works through.
 *
 * The generation prompts already ask for `durationSeconds: 0` on these
 * (see artifacts/api-server/src/routes/generate.ts) but nothing enforced it, so
 * a model that emitted a duration anyway put a live countdown on the mission
 * slide — a clock ticking against a paragraph that asks the class to do
 * nothing yet, and a red bar by the time the teacher finishes reading it out.
 */
export const UNTIMED_SLIDE_TYPES = [
  'intro', 'reveal', 'summary', 'divider', 'scoreboard', 'podium',
] as const;

/**
 * How many seconds this slide should actually count down.
 *
 * Refused at display time rather than rewritten into the deck: the value the
 * model produced stays intact for saves and exports, and every surface that
 * shows a timer asks this instead of reading `durationSeconds` raw.
 */
export function timerSecondsForSlide(slide: { type: string; durationSeconds: number }): number {
  if ((UNTIMED_SLIDE_TYPES as readonly string[]).includes(slide.type)) return 0;
  return Math.max(0, slide.durationSeconds || 0);
}
