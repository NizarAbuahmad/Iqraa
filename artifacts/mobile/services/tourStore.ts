/**
 * The live tour: which step is showing, and the analytics for how it ended.
 *
 * Module-level, read with `useSyncExternalStore`, so there is no provider to
 * place and the overlay, the Escape key, the Android back button and the
 * Profile replay row all drive one thing. Every way a tour can end funnels
 * through `finish`, so each is exactly one event.
 *
 * Pure (`analytics.ts` loads lazily), so `node --test` can pin it.
 */
import { trackEvent } from './analytics.ts';
import {
  dropCurrent,
  startTour,
  stepBack,
  stepForward,
  stepsFor,
  type TourLayout,
  type TourRole,
  type TourState,
} from './tour.ts';

type Track = (event: string, props?: Record<string, string | number | boolean>) => void;

let track: Track = trackEvent;
/** Test seam: lets a test read the events instead of sending them. */
export function setTourTracker(fn: Track): void {
  track = fn;
}

let current: TourState | null = null;
const listeners = new Set<() => void>();

function set(next: TourState | null): void {
  current = next;
  listeners.forEach(l => l());
}

export function subscribeTour(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The same object until the tour changes, as `useSyncExternalStore` requires. */
export function getTourSnapshot(): TourState | null {
  return current;
}

export function isTourActive(): boolean {
  return current !== null;
}

/** `auto` is the first-run start; `replay` is the Profile row. A tour already running is left alone. */
export function beginTour(opts: { role: TourRole; layout: TourLayout; source: 'auto' | 'replay' }): void {
  if (current) return;
  const state = startTour(stepsFor(opts.role, opts.layout));
  if (!state) return;
  track(opts.source === 'auto' ? 'tour_started' : 'tour_replayed', { role: opts.role, layout: opts.layout });
  set(state);
}

function arrived(state: TourState): void {
  track('tour_step', { step: state.steps[state.index].id, index: state.index });
}

function finish(kind: 'completed' | 'skipped', from: TourState): void {
  if (kind === 'completed') track('tour_completed', { steps: from.steps.length });
  else track('tour_skipped', { atStep: from.steps[from.index].id, index: from.index });
  set(null);
}

export function nextStep(): void {
  if (!current) return;
  const next = stepForward(current);
  if (!next) return finish('completed', current);
  set(next);
  arrived(next);
}

export function prevStep(): void {
  if (!current || current.index === 0) return;
  const prev = stepBack(current);
  set(prev);
  arrived(prev);
}

export function skipTour(): void {
  if (current) finish('skipped', current);
}

/**
 * The current step's target never appeared: take it out and move on in the
 * direction the person was going. Not reported as a step — nobody saw it.
 */
export function dropStep(direction: 1 | -1): void {
  if (!current) return;
  const next = dropCurrent(current, direction);
  if (!next) return finish('completed', current);
  set(next);
}
