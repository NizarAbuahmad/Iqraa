/**
 * What this guards: the wizard generates every period time a teacher will
 * teach by, and clock arithmetic is where off-by-ones hide — the hour
 * rollover, the break offset, and the day boundary. A partial result would
 * be worse than none (see generatePeriods), so that contract is pinned too.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PERIOD_COUNT,
  addMinutes,
  endTime,
  formatRange,
  fromMinutes,
  generatePeriods,
  isValidTime,
  toMinutes,
} from '../schedulePeriods.ts';

describe('time arithmetic', () => {
  it('round-trips minutes and HH:MM', () => {
    assert.equal(toMinutes('08:45'), 525);
    assert.equal(fromMinutes(525), '08:45');
    assert.equal(fromMinutes(0), '00:00');
    assert.equal(fromMinutes(23 * 60 + 59), '23:59');
  });

  it('adds across the hour boundary', () => {
    assert.equal(addMinutes('08:45', 45), '09:30');
    assert.equal(addMinutes('23:00', 59), '23:59');
  });

  it('refuses to cross midnight, and refuses bad input', () => {
    assert.equal(addMinutes('23:30', 45), null);
    assert.equal(addMinutes('24:00', 1), null);
    assert.equal(addMinutes('08:00', -1), null);
    assert.equal(addMinutes('08:00', 1.5), null);
  });

  it('validates HH:MM strictly', () => {
    for (const ok of ['00:00', '09:05', '23:59']) assert.equal(isValidTime(ok), true);
    for (const bad of ['9:05', '24:00', '09:60', '', 905, null]) assert.equal(isValidTime(bad), false);
  });

  it('endTime and formatRange degrade to the start when the end is unknown', () => {
    assert.equal(endTime({ startTime: '08:00', durationMinutes: 45 }), '08:45');
    assert.equal(formatRange({ startTime: '08:00', durationMinutes: 45 }), '08:00–08:45');
    assert.equal(endTime({ startTime: '23:30', durationMinutes: 45 }), '');
    assert.equal(formatRange({ startTime: '23:30', durationMinutes: 45 }), '23:30');
  });
});

describe('generatePeriods', () => {
  it('lays periods back to back from the first start', () => {
    assert.deepEqual(generatePeriods({ count: 3, firstStart: '08:00', durationMinutes: 45 }), [
      { periodNumber: 1, startTime: '08:00', durationMinutes: 45 },
      { periodNumber: 2, startTime: '08:45', durationMinutes: 45 },
      { periodNumber: 3, startTime: '09:30', durationMinutes: 45 },
    ]);
  });

  it('inserts the break after the named period only', () => {
    const out = generatePeriods({ count: 4, firstStart: '08:00', durationMinutes: 45, breakAfter: 2, breakMinutes: 20 });
    assert.deepEqual(out.map(p => p.startTime), ['08:00', '08:45', '09:50', '10:35']);
  });

  it('ignores a break placed after the last period', () => {
    const out = generatePeriods({ count: 2, firstStart: '08:00', durationMinutes: 45, breakAfter: 2, breakMinutes: 20 });
    assert.deepEqual(out.map(p => p.startTime), ['08:00', '08:45']);
  });

  it('returns nothing, not a partial day, when the periods run past midnight', () => {
    assert.deepEqual(generatePeriods({ count: 3, firstStart: '22:30', durationMinutes: 45 }), []);
  });

  it('rejects out-of-range counts, times and durations', () => {
    assert.deepEqual(generatePeriods({ count: 0, firstStart: '08:00', durationMinutes: 45 }), []);
    assert.deepEqual(generatePeriods({ count: MAX_PERIOD_COUNT + 1, firstStart: '08:00', durationMinutes: 45 }), []);
    assert.deepEqual(generatePeriods({ count: 2.5, firstStart: '08:00', durationMinutes: 45 }), []);
    assert.deepEqual(generatePeriods({ count: 3, firstStart: '8:00', durationMinutes: 45 }), []);
    assert.deepEqual(generatePeriods({ count: 3, firstStart: '08:00', durationMinutes: 0 }), []);
    assert.deepEqual(generatePeriods({ count: 3, firstStart: '08:00', durationMinutes: 45, breakAfter: 1, breakMinutes: -5 }), []);
  });

  it('accepts the maximum count when it fits', () => {
    const out = generatePeriods({ count: MAX_PERIOD_COUNT, firstStart: '07:00', durationMinutes: 45 });
    assert.equal(out.length, MAX_PERIOD_COUNT);
    assert.equal(out.at(-1)?.periodNumber, MAX_PERIOD_COUNT);
  });
});
