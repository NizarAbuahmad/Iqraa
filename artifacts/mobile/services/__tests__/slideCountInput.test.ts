/**
 * The slide-count field on Prompt Slides.
 *
 * It stripped everything but latin 0-9, so a teacher on an Arabic keyboard
 * typing «١٠» got an empty field and an "Auto" deck — the number simply
 * vanished. Arabic-Indic digits are what that keyboard produces.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_SLIDE_COUNT, normalizeSlideCountText, slideCountFromText } from '../slideCountInput.ts';

describe('normalizeSlideCountText', () => {
  it('keeps Arabic-Indic digits as their latin value', () => {
    assert.equal(normalizeSlideCountText('١٠'), '10');
    assert.equal(normalizeSlideCountText('٨'), '8');
  });

  it('keeps latin digits and drops everything else', () => {
    assert.equal(normalizeSlideCountText('12'), '12');
    assert.equal(normalizeSlideCountText('1a'), '1');
  });

  it('caps the field at two digits', () => {
    assert.equal(normalizeSlideCountText('123'), '12');
  });

  it('empties on nothing usable', () => {
    assert.equal(normalizeSlideCountText(''), '');
    assert.equal(normalizeSlideCountText('abc'), '');
    assert.equal(normalizeSlideCountText('0'), '');
  });
});

describe('slideCountFromText', () => {
  it('reads Arabic-Indic digits — «١٠» is ten slides, not Auto', () => {
    assert.equal(slideCountFromText('١٠'), 10);
  });

  it('is undefined (Auto) for an empty or zero field', () => {
    assert.equal(slideCountFromText(''), undefined);
    assert.equal(slideCountFromText('0'), undefined);
  });

  it('clamps to the maximum', () => {
    assert.equal(slideCountFromText('99'), MAX_SLIDE_COUNT);
  });
});
