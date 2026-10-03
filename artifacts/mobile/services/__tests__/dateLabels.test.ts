/**
 * The Today screen writes every number in Latin digits: the readiness count
 * («1 من 5»), the saved-ago date on a board row, and the clock times. The
 * header date used plain `ar-JO`, whose default numbering is Arabic-Indic, so
 * one line read «٣ تشرين الأول» above a board that read «26 آب» — two digit
 * systems on one screen. The header date now follows the board.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { todayLabel } from '../dateLabels.ts';

// A Saturday, built from local parts so the test does not depend on the runner's timezone.
const SATURDAY = new Date(2026, 9, 3, 13, 6);
const ARABIC_INDIC = /[٠-٩]/;

describe('todayLabel', () => {
  it('writes the Arabic date with Latin digits, matching the board beside it', () => {
    const label = todayLabel('ar', SATURDAY);
    assert.ok(!ARABIC_INDIC.test(label), `Arabic-Indic digit in «${label}»`);
    assert.match(label, /\b3\b/);
  });

  it('still names the weekday and month in Arabic', () => {
    const label = todayLabel('ar', SATURDAY);
    assert.match(label, /السبت/);
    assert.match(label, /تشرين الأول/);
  });

  it('is unchanged in English', () => {
    const label = todayLabel('en', SATURDAY);
    assert.match(label, /Saturday/);
    assert.match(label, /October/);
    assert.match(label, /\b3\b/);
  });
});
