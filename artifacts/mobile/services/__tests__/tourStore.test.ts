// Pins the live tour state and the analytics it reports. The store is what the
// overlay, the Escape key, the Android back button and the Profile replay row all
// drive, so every way of ending a tour has to end up as exactly one event.
import { beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  beginTour,
  dropStep,
  getTourSnapshot,
  isTourActive,
  nextStep,
  prevStep,
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
  assert.equal(events.length, 2, 'started + one step, no second start');
});

test('next and back move through the steps, and each arrival reports its step', () => {
  beginTour({ role: 'parent', layout: 'phone', source: 'auto' });
  nextStep();
  assert.equal(getTourSnapshot()?.index, 1);
  prevStep();
  assert.equal(getTourSnapshot()?.index, 0);
  const stepEvents = events.filter(([e]) => e === 'tour_step');
  assert.deepEqual(stepEvents.map(([, p]) => p), [
    { step: parentSteps()[1].id, index: 1 },
    { step: parentSteps()[0].id, index: 0 },
  ]);
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
