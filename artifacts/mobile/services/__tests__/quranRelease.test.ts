/**
 * The Quran Corner's release gate. The text is not yet verified against a
 * printed mushaf, and merging to main deploys to every signed-in user, so the
 * corner is hidden in production builds until QURAN_CORNER_RELEASED is flipped
 * by someone who has signed off lib/curriculum/sources/quran-ws/VERIFY.md.
 * Development builds always show it, so it can be opened and checked.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_CORNER_RELEASED, quranCornerVisible } from '../quranRelease.ts';

describe('quranCornerVisible', () => {
  it('shows the corner in a development build whether or not it is released', () => {
    assert.equal(quranCornerVisible(false, true), true);
    assert.equal(quranCornerVisible(true, true), true);
  });

  it('shows it in a production build only once released', () => {
    assert.equal(quranCornerVisible(true, false), true);
    assert.equal(quranCornerVisible(false, false), false);
  });
});

describe('QURAN_CORNER_RELEASED', () => {
  it('is a boolean, so a typo in the flag cannot read as truthy', () => {
    assert.equal(typeof QURAN_CORNER_RELEASED, 'boolean');
  });
});
