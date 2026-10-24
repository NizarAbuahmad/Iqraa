import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { parseConsentFragment } from '../guardianConsentLink.ts';

const TOKEN = 'AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcde'; // 43 chars

describe('parseConsentFragment', () => {
  it('reads the token from a location.hash, with or without the #', () => {
    assert.equal(TOKEN.length, 43);
    assert.equal(parseConsentFragment(`#${TOKEN}`), TOKEN);
    assert.equal(parseConsentFragment(TOKEN), TOKEN);
  });
  it('refuses anything that is not exactly a 43-character token', () => {
    for (const bad of ['', '#', '#short', `#${TOKEN}x`, `#${TOKEN.slice(1)}`, `#token=${TOKEN}`, `#${TOKEN.slice(0, 42)}!`, null, undefined]) {
      assert.equal(parseConsentFragment(bad as any), null, String(bad));
    }
  });
});
