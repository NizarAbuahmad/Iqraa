import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { activityTotals, barRatios, chartMax, type DailyActivityDay } from '../adminDailyActivity.ts';

const day = (d: string, active: number, n: number, returning: number, signups = 0): DailyActivityDay => ({
  day: d, active, new: n, returning, signups,
});

describe('chartMax', () => {
  it('is the busiest day, and never zero so an empty window still divides', () => {
    assert.equal(chartMax([day('2026-11-01', 5, 2, 3), day('2026-11-02', 9, 1, 8)]), 9);
    assert.equal(chartMax([day('2026-11-01', 0, 0, 0)]), 1);
    assert.equal(chartMax([]), 1);
  });
});

describe('barRatios', () => {
  it('sizes the two segments against the busiest day so they stack to the day\'s height', () => {
    assert.deepEqual(barRatios(day('d', 10, 4, 6), 10), { newRatio: 0.4, returningRatio: 0.6 });
    assert.deepEqual(barRatios(day('d', 5, 1, 4), 10), { newRatio: 0.1, returningRatio: 0.4 });
  });
  it('is flat on a quiet day', () => {
    assert.deepEqual(barRatios(day('d', 0, 0, 0), 10), { newRatio: 0, returningRatio: 0 });
  });
});

describe('activityTotals', () => {
  it('averages the daily active count over every day in the window, quiet days included', () => {
    const t = activityTotals([day('2026-11-01', 6, 2, 4), day('2026-11-02', 0, 0, 0), day('2026-11-03', 12, 3, 9)]);
    assert.equal(t.averageActive, 6);
    assert.deepEqual(t.peak, { day: '2026-11-03', active: 12 });
  });
  it('sums the new and returning person-days and the signups', () => {
    const t = activityTotals([day('2026-11-01', 6, 2, 4, 3), day('2026-11-02', 12, 3, 9, 1)]);
    assert.equal(t.newPersonDays, 5);
    assert.equal(t.returningPersonDays, 13);
    assert.equal(t.signups, 4);
  });
  it('picks the earliest day when two tie for the peak', () => {
    const t = activityTotals([day('2026-11-01', 7, 0, 7), day('2026-11-02', 7, 0, 7)]);
    assert.equal(t.peak?.day, '2026-11-01');
  });
  it('has no peak and a zero average for an empty window', () => {
    assert.deepEqual(activityTotals([]), {
      averageActive: 0, peak: null, newPersonDays: 0, returningPersonDays: 0, signups: 0,
    });
  });
  it('has no peak when nobody was active', () => {
    assert.equal(activityTotals([day('2026-11-01', 0, 0, 0, 2)]).peak, null);
  });
});
