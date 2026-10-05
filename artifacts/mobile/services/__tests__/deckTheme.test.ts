/**
 * deckTheme.ts — the colours the deck is read in.
 *
 * Contrast is the contract here: the concept accent colours the slide title,
 * and the divider is the ground under white type. Both were short of 4.5:1
 * when they were slate and DECK_ACCENT respectively.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { DECK_ACCENT, DECK_BG, DECK_TEAL, slideTypeAccent } from '../deckTheme.ts';

function luminance(hex: string): number {
  const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('slideTypeAccent', () => {
  it('colours a concept slide in the brand teal', () => {
    assert.equal(slideTypeAccent('intro'), DECK_TEAL);
  });

  it('reads at 4.5:1 or better as a heading on the slide background', () => {
    assert.ok(contrast(slideTypeAccent('intro'), DECK_BG) >= 4.5);
  });

  it('keeps white type on the divider at 4.5:1 or better', () => {
    assert.equal(slideTypeAccent('divider'), DECK_TEAL);
    assert.ok(contrast('#FFFFFF', slideTypeAccent('divider')) >= 4.5);
  });

  it('is why DECK_TEAL exists — the lighter brand teal is not enough for either job', () => {
    assert.ok(contrast(DECK_ACCENT, DECK_BG) < 4.5);
    assert.ok(contrast('#FFFFFF', DECK_ACCENT) < 4.5);
  });

  it('leaves the typed accents as they were', () => {
    assert.equal(slideTypeAccent('challenge'), '#C2410C');
    assert.equal(slideTypeAccent('question'), '#1D4ED8');
    assert.equal(slideTypeAccent('summary'), '#D6206B');
  });
});
