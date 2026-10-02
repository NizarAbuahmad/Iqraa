/**
 * Enter in the chat composer.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/composerKeys.test.ts
 *
 * Found 2026-10-02: the composer is `multiline` without `blurOnSubmit`, and
 * react-native-web only fires `onSubmitEditing` when `blurOnSubmit || !multiline`,
 * so on desktop web Enter inserted a newline and nothing was sent. The rule
 * lives here so it can be pinned: Enter sends, Shift+Enter breaks the line, and
 * Enter during IME composition (Arabic and CJK input methods) is left alone.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { shouldSendOnEnter } from '../composerKeys.ts';

describe('shouldSendOnEnter', () => {
  it('a bare Enter sends', () => {
    assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false, isComposing: false }), true);
  });

  it('Shift+Enter inserts a newline', () => {
    assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: true, isComposing: false }), false);
  });

  it('Enter mid-composition commits the IME candidate, not the message', () => {
    assert.equal(shouldSendOnEnter({ key: 'Enter', shiftKey: false, isComposing: true }), false);
  });

  it('any other key is not a send', () => {
    assert.equal(shouldSendOnEnter({ key: 'a', shiftKey: false, isComposing: false }), false);
    assert.equal(shouldSendOnEnter({ key: undefined, shiftKey: false, isComposing: false }), false);
  });
});
