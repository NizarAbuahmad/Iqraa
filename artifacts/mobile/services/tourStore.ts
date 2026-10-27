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
let replayPending = false;
/** The step last reported as shown, so a re-render or a resize does not report it twice. */
let lastShown: string | null = null;
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(l => l());
}

function set(next: TourState | null): void {
  current = next;
  notify();
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

/**
 * Profile's «Replay the tour» asks for a replay and navigates home; the tour
 * starts once the home screen has actually arrived and held still (the hook in
 * `hooks/useTour.ts` watches this). A fixed delay after navigating could fire
 * before a slow device got there, and the overlay ends a tour that is not on the
 * home route.
 */
export function requestReplay(): void {
  if (replayPending) return;
  replayPending = true;
  notify();
}

export function clearReplayRequest(): void {
  if (!replayPending) return;
  replayPending = false;
  notify();
}

export function isReplayPending(): boolean {
  return replayPending;
}

/**
 * `auto` is the first-run start; `replay` is the Profile row. A tour already
 * running is left alone. `isAvailable` says whether a target is on screen: steps
 * whose target is not are left out up front, so the "of N" never shrinks mid-tour,
 * and a tour with nothing left to point at is not started.
 */
export function beginTour(opts: {
  role: TourRole;
  layout: TourLayout;
  source: 'auto' | 'replay';
  isAvailable?: (targetId: string) => boolean;
}): void {
  clearReplayRequest();
  if (current) return;
  const all = stepsFor(opts.role, opts.layout);
  const { isAvailable } = opts;
  const steps = isAvailable ? all.filter(s => s.targetId === null || isAvailable(s.targetId)) : all;
  if (isAvailable && !steps.some(s => s.targetId !== null)) return;
  const state = startTour(steps);
  if (!state) return;
  lastShown = null;
  track(opts.source === 'auto' ? 'tour_started' : 'tour_replayed', { role: opts.role, layout: opts.layout });
  set(state);
}

/**
 * Called by the overlay once a step has somewhere to be drawn — not when Next is
 * pressed, because a step whose target never appears is dropped before it is ever
 * seen, and must not count as seen.
 */
export function reportStepShown(): void {
  if (!current) return;
  const { id } = current.steps[current.index];
  if (lastShown === id) return;
  lastShown = id;
  track('tour_step', { step: id, index: current.index });
}

function finish(kind: 'completed' | 'skipped', from: TourState): void {
  if (kind === 'completed') track('tour_completed', { steps: from.steps.length });
  else track('tour_skipped', { atStep: from.steps[from.index].id, index: from.index });
  lastShown = null;
  set(null);
}

export function nextStep(): void {
  if (!current) return;
  const next = stepForward(current);
  if (!next) return finish('completed', current);
  set(next);
}

export function prevStep(): void {
  if (!current || current.index === 0) return;
  set(stepBack(current));
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
