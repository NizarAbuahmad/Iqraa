import test from 'node:test';
import assert from 'node:assert/strict';
import { DOCKED_BAR_HEIGHT, toastLift } from '../dockedBar.ts';

/*
  A toast sits 100 points above the bottom edge; the generators' docked
  generate bar is 108 points tall, so on a phone with the bar showing the toast
  was drawn over its summary line. It lifts by the bar's height, and only then.
*/

test('on a phone with the bar on screen the toast lifts by the bar\'s height', () => {
  assert.equal(toastLift({ isDesktop: false, barHidden: false, keyboardOpen: false }), DOCKED_BAR_HEIGHT);
  assert.equal(DOCKED_BAR_HEIGHT, 108);
});

test('it does not lift on desktop, where the action is inline under the preview', () => {
  assert.equal(toastLift({ isDesktop: true, barHidden: false, keyboardOpen: false }), 0);
});

test('it does not lift while the screen has given the bar\'s spot to its own save bar or unsaved deck', () => {
  assert.equal(toastLift({ isDesktop: false, barHidden: true, keyboardOpen: false }), 0);
});

test('it drops back while the keyboard is open, because the bar hides then', () => {
  assert.equal(toastLift({ isDesktop: false, barHidden: false, keyboardOpen: true }), 0);
});

test('every other combination is 0 too: only the one phone-and-bar-showing state lifts', () => {
  let lifted = 0;
  for (const isDesktop of [false, true]) for (const barHidden of [false, true]) for (const keyboardOpen of [false, true]) {
    if (toastLift({ isDesktop, barHidden, keyboardOpen }) !== 0) lifted += 1;
  }
  assert.equal(lifted, 1);
});
