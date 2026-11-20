/**
 * When the time-spent heartbeat may beat (services/usageHeartbeat.ts). A minute is counted
 * only for a signed-in person, with the app in front, who touched it in the last two minutes —
 * an app left open on a desk, or in the background, must not count as time spent.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { BEAT_MS, IDLE_MS, shouldBeat } from '../usageHeartbeat.ts';

const now = 1_000_000_000;
const base = { signedIn: true, foreground: true, area: 'gen-quiz' as const, lastInteractionAt: now - 5_000, now };

describe('shouldBeat', () => {
  it('beats for an active, signed-in person in the foreground', () => {
    assert.equal(shouldBeat(base), true);
  });

  it('does not beat signed out, in the background, or with no area', () => {
    assert.equal(shouldBeat({ ...base, signedIn: false }), false);
    assert.equal(shouldBeat({ ...base, foreground: false }), false);
    assert.equal(shouldBeat({ ...base, area: null }), false);
  });

  it('stops after two idle minutes, and counts right up to them', () => {
    assert.equal(shouldBeat({ ...base, lastInteractionAt: now - IDLE_MS }), true);
    assert.equal(shouldBeat({ ...base, lastInteractionAt: now - IDLE_MS - 1 }), false);
  });

  it('beats once a minute and treats two minutes as idle', () => {
    assert.equal(BEAT_MS, 60_000);
    assert.equal(IDLE_MS, 120_000);
  });
});
