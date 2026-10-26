// Pins the live tour state and the analytics it reports. The store is what the
// overlay, the Escape key, the Android back button and the Profile replay row all
// drive, so every way of ending a tour has to end up as exactly one event.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginTour,
  clearReplayRequest,
  dropStep,
  getTourSnapshot,
  isReplayPending,
  isTourActive,
  nextStep,
  prevStep,
  reportStepShown,
  requestReplay,
  setTourTracker,
  skipTour,
  subscribeTour,
} from '../tourStore.ts';
import { stepsFor } from '../tour.ts';

let events: Array<[string, Record<string, string | number | boolean> | undefined]> = [];

beforeEach(() => {
  skipTour(); // whatever a previous test left running
  events = [];
  setTourTracker((e, p) => { events.push([e, p]); });
});

const parentSteps = () => stepsFor('parent', 'phone');

test('nothing is running until a tour begins', () => {
  assert.equal(isTourActive(), false);
  assert.equal(getTourSnapshot(), null);
});

test('beginning a tour opens the role’s own steps on the first one and reports it', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  assert.equal(isTourActive(), true);
  assert.deepEqual(getTourSnapshot()?.steps, parentSteps());
  assert.equal(getTourSnapshot()?.index, 0);
  assert.deepEqual(events, [['tour_started', { role: 'parent', layout: 'phone' }]]);
});

test('a replay is reported as one, not as a first start', () => {
  beginTour({ role: 'student', layout: 'desktop', source: 'replay' });
  assert.deepEqual(events, [['tour_replayed', { role: 'student', layout: 'desktop' }]]);
});

test('a second begin while one is running changes nothing', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  beginTour({ role: 'teacher', layout: 'phone', source: 'replay' });
  assert.equal(getTourSnapshot()?.steps.length, parentSteps().length);
  assert.equal(getTourSnapshot()?.index, 1);
  assert.equal(events.length, 1, 'started only: no second start');
});

test('next and back move through the steps without reporting anything themselves', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  assert.equal(getTourSnapshot()?.index, 1);
  prevStep();
  assert.equal(getTourSnapshot()?.index, 0);
  assert.equal(events.filter(([e]) => e === 'tour_step').length, 0);
});

test('a step is reported when it is SHOWN — once, and again when the person comes back to it', () => {
  // The overlay calls this once a step has somewhere to be drawn. A step whose
  // target never appears is dropped before then, so nobody is counted as seeing it.
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  reportStepShown();
  reportStepShown(); // a re-render or a resize: same step, no second event
  nextStep();
  reportStepShown();
  prevStep();
  reportStepShown();
  assert.deepEqual(events.filter(([e]) => e === 'tour_step').map(([, p]) => p), [
    { step: parentSteps()[0].id, index: 0 },
    { step: parentSteps()[1].id, index: 1 },
    { step: parentSteps()[0].id, index: 0 },
  ]);
});

test('reporting with no tour running does nothing', () => {
  reportStepShown();
  assert.deepEqual(events, []);
});

test('steps whose target is not on screen are left out when the tour begins, so the count never shrinks mid-tour', () => {
  const missing = new Set(['tab-profile']);
  beginTour({ role: 'parent', layout: 'phone', source: 'auto', isAvailable: id => !missing.has(id) });
  const ids = getTourSnapshot()!.steps.map(s => s.targetId);
  assert.equal(ids.includes('tab-profile'), false);
  assert.equal(ids.length, parentSteps().length - 1);
  assert.equal(ids[0], null, 'the welcome stays');
});

test('a tour with nothing to point at is not started at all', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto', isAvailable: () => false });
  assert.equal(isTourActive(), false);
  assert.deepEqual(events, []);
});

test('a replay can be requested before the home screen is up, and beginning a tour answers it', () => {
  assert.equal(isReplayPending(), false);
  let calls = 0;
  const off = subscribeTour(() => { calls++; });
  requestReplay();
  assert.equal(isReplayPending(), true);
  assert.equal(calls, 1, 'subscribers are told, so the hook that waits for the home route wakes');
  beginTour({ role: 'parent', layout: 'phone', source: 'replay' });
  assert.equal(isReplayPending(), false);
  off();
});

test('a replay request can be withdrawn, and does nothing to a tour already running', () => {
  requestReplay();
  clearReplayRequest();
  assert.equal(isReplayPending(), false);
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  requestReplay();
  clearReplayRequest();
  assert.equal(isTourActive(), true);
});

test('moving past the last step completes the tour, once', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  for (let i = 0; i < parentSteps().length; i++) nextStep();
  assert.equal(isTourActive(), false);
  assert.equal(events.filter(([e]) => e === 'tour_completed').length, 1);
  nextStep(); // already over: harmless
  assert.equal(events.filter(([e]) => e === 'tour_completed').length, 1);
});

test('skipping ends it and says which step the person left on', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  skipTour();
  assert.equal(isTourActive(), false);
  assert.deepEqual(events.at(-1), ['tour_skipped', { atStep: parentSteps()[1].id, index: 1 }]);
  skipTour(); // nothing running: no second event
  assert.equal(events.filter(([e]) => e === 'tour_skipped').length, 1);
});

test('a step whose target never showed up is dropped and the tour moves on without reporting it', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  const dropped = getTourSnapshot()!.steps[1].id;
  dropStep(1);
  const after = getTourSnapshot()!;
  assert.equal(after.steps.some(s => s.id === dropped), false);
  assert.equal(after.steps[after.index].id, parentSteps()[2].id);
});

test('dropping the last remaining step going forward completes the tour', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  for (let i = 0; i < parentSteps().length - 1; i++) nextStep();
  dropStep(1);
  assert.equal(isTourActive(), false);
  assert.equal(events.filter(([e]) => e === 'tour_completed').length, 1);
});

test('subscribers hear every change, and stop hearing once they unsubscribe', () => {
  let calls = 0;
  const off = subscribeTour(() => { calls++; });
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  assert.equal(calls, 2);
  off();
  skipTour();
  assert.equal(calls, 2);
});

test('the snapshot only changes identity when the tour does, so useSyncExternalStore does not loop', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  assert.equal(getTourSnapshot(), getTourSnapshot());
  const before = getTourSnapshot();
  nextStep();
  assert.notEqual(getTourSnapshot(), before);
});
