import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldTrackScreen } from '../screenTracking.ts';

describe('shouldTrackScreen', () => {
  it('never reports the parent consent page', () => {
    for (const p of ['/guardian', '/guardian/', '/guardian/x']) assert.equal(shouldTrackScreen(p), false, p);
  });
  it('reports every other screen, including a lookalike', () => {
    for (const p of ['/', '/(tabs)', '/guardian-waiting', '/guardians', '/take/ABC234', '/live']) {
      assert.equal(shouldTrackScreen(p), true, p);
    }
  });
});
