/**
 * Whether the app is in front of the person (services/foreground.ts). The polling refresh and the
 * time-spent heartbeat both stop when it is not: a browser tab left open behind another one must
 * not keep calling the API every few seconds, which also keeps the database from going idle.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { isInFront } from '../foreground.ts';

describe('isInFront', () => {
  it('on the web follows the tab: visible is in front, hidden is not', () => {
    assert.equal(isInFront({ os: 'web', visibilityState: 'visible', appState: 'active' }), true);
    assert.equal(isInFront({ os: 'web', visibilityState: 'hidden', appState: 'active' }), false);
  });

  it('on the web with no document to read counts as in front', () => {
    assert.equal(isInFront({ os: 'web', visibilityState: undefined, appState: 'background' }), true);
  });

  it('on a phone follows the app state, whatever a document would say', () => {
    assert.equal(isInFront({ os: 'android', visibilityState: undefined, appState: 'active' }), true);
    assert.equal(isInFront({ os: 'android', visibilityState: 'visible', appState: 'background' }), false);
    assert.equal(isInFront({ os: 'ios', visibilityState: undefined, appState: 'inactive' }), false);
  });
});

describe('the hooks that call the API on a timer', () => {
  it('both ask isInFront before a timed call', () => {
    for (const file of ['usePollingRefresh.ts', 'useUsageHeartbeat.ts']) {
      const src = readFileSync(join(import.meta.dirname, '..', '..', 'hooks', file), 'utf8');
      assert.match(src, /isInFront\(/, `${file} must not call on a timer while the app is hidden`);
    }
  });
});
