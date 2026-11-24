import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { hubShowsBack } from '../publicGames/hubBack.ts';

test('opened from inside the app (Tools tab, What\'s New), the hub has a way back', () => {
  assert.equal(hubShowsBack({ canGoBack: true, signedIn: true }), true);
  assert.equal(hubShowsBack({ canGoBack: true, signedIn: false }), true);
});

test('a signed-in user with no history (a refreshed tab) still gets back: `/` is their home tab', () => {
  assert.equal(hubShowsBack({ canGoBack: false, signedIn: true }), true);
});

test('a visitor who opened a shared /play link cold has nowhere to go back to', () => {
  assert.equal(hubShowsBack({ canGoBack: false, signedIn: false }), false);
});

test('the hub decides its back arrow with hubShowsBack, never a bare hideBack', () => {
  const hub = readFileSync(join(import.meta.dirname, '..', '..', 'app', 'play', 'index.tsx'), 'utf8');
  assert.match(hub, /hubShowsBack\(/);
  assert.doesNotMatch(hub, /\shideBack[\s>]/);
});
