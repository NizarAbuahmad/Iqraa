/**
 * The month arithmetic under the admin date picker that phones get in place of
 * the browser's own calendar.
 *
 * Run:
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/calendarGrid.test.ts
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { addMonths, daysInMonth, formatYmd, isOutOfRange, monthWeeks, parseYmd } from '../calendarGrid.ts';

describe('parseYmd / formatYmd', () => {
  it('round-trips a real day, months counted from 0', () => {
    assert.deepEqual(parseYmd('2026-10-29'), { y: 2026, m: 9, d: 29 });
    assert.equal(formatYmd({ y: 2026, m: 9, d: 29 }), '2026-10-29');
    assert.equal(formatYmd({ y: 2026, m: 0, d: 5 }), '2026-01-05');
  });
  it('rejects what is not a calendar day', () => {
    for (const bad of ['', 'soon', '2026-02-30', '2026-13-01', '2026-00-10', '2026-1-5', '26-01-01', '2026-10-32'])
      assert.equal(parseYmd(bad), null, bad);
  });
  it('knows a leap day', () => {
    assert.notEqual(parseYmd('2028-02-29'), null);
    assert.equal(parseYmd('2026-02-29'), null);
  });
});

describe('addMonths', () => {
  it('steps within a year and across both year ends', () => {
    assert.deepEqual(addMonths(2026, 9, 1), { y: 2026, m: 10 });
    assert.deepEqual(addMonths(2026, 11, 1), { y: 2027, m: 0 });
    assert.deepEqual(addMonths(2026, 0, -1), { y: 2025, m: 11 });
    assert.deepEqual(addMonths(2026, 5, -17), { y: 2025, m: 0 });
  });
});

describe('daysInMonth', () => {
  it('handles 30, 31 and February in a leap year and not', () => {
    assert.equal(daysInMonth(2026, 3), 30);
    assert.equal(daysInMonth(2026, 9), 31);
    assert.equal(daysInMonth(2026, 1), 28);
    assert.equal(daysInMonth(2028, 1), 29);
  });
});

describe('monthWeeks', () => {
  it('starts on Sunday: October 2026 begins on a Thursday, so four empty cells lead', () => {
    const weeks = monthWeeks(2026, 9);
    assert.deepEqual(weeks[0], [null, null, null, null, 1, 2, 3]);
  });
  it('every row has seven cells and every day of the month appears once, in order', () => {
    for (const [y, m] of [[2026, 9], [2026, 1], [2028, 1], [2026, 5], [2027, 1]] as const) {
      const weeks = monthWeeks(y, m);
      assert.ok(weeks.every(w => w.length === 7), `${y}-${m} rows`);
      const days = weeks.flat().filter((d): d is number => d !== null);
      assert.deepEqual(days, Array.from({ length: daysInMonth(y, m) }, (_, i) => i + 1), `${y}-${m} days`);
    }
  });
  it('February 2026 fits four rows exactly (it starts on a Sunday)', () => {
    assert.equal(monthWeeks(2026, 1).length, 4);
  });
});

describe('isOutOfRange', () => {
  it('compares inclusively against either bound, and either may be absent', () => {
    assert.equal(isOutOfRange('2026-10-10', '2026-10-10', '2026-10-20'), false);
    assert.equal(isOutOfRange('2026-10-20', '2026-10-10', '2026-10-20'), false);
    assert.equal(isOutOfRange('2026-10-09', '2026-10-10', undefined), true);
    assert.equal(isOutOfRange('2026-10-21', undefined, '2026-10-20'), true);
    assert.equal(isOutOfRange('2026-10-15'), false);
  });
});
