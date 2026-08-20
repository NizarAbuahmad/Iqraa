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
 */
export function slideHasTimer(slide: { durationSeconds: number }): boolean {
  return slide.durationSeconds > 0;
}
