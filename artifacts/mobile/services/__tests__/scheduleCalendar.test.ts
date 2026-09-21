/**
 * What this guards: a day's agenda combines two independent sources — the
 * recurring weekly timetable (keyed by weekday) and each plan's own dated
 * entries (keyed by exact date) — and the month grid is date arithmetic
 * across weekday/month/year boundaries, exactly where off-by-ones hide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDayAgenda,
  dayHasAgenda,
  isInMonth,
  monthGridDates,
} from '../scheduleCalendar.ts';

// 2026-09-20 is a Sunday (day 0); 2026-09-22 is a Tuesday (day 2).
const PERIODS = [
  { periodNumber: 1, startTime: '08:00', durationMinutes: 45 },
  { periodNumber: 2, startTime: '08:45', durationMinutes: 45 },
];
const SLOTS = [
  { dayOfWeek: 0, periodNumber: 1, classGroupId: 'c1' },
  { dayOfWeek: 0, periodNumber: 2, classGroupId: null }, // empty slot
  { dayOfWeek: 2, periodNumber: 1, classGroupId: 'c2' },
];
const PLANS = [
  { id: 'p1', title: 'Plan A', entries: [{ lessonId: 'l1', date: '2026-09-20' }] },
  { id: 'p2', title: 'Plan B', entries: [{ lessonId: 'l2', date: '2026-09-20' }, { lessonId: 'l3', date: '2026-09-22' }] },
];

describe('buildDayAgenda', () => {
  it('combines this weekday\'s filled periods with every plan\'s lessons on this date', () => {
    const agenda = buildDayAgenda('2026-09-20', PERIODS, SLOTS, PLANS);
    assert.deepEqual(agenda.periods, [
      { periodNumber: 1, startTime: '08:00', durationMinutes: 45, classGroupId: 'c1' },
    ]);
    assert.deepEqual(agenda.lessons, [
      { planId: 'p1', planTitle: 'Plan A', lessonId: 'l1' },
      { planId: 'p2', planTitle: 'Plan B', lessonId: 'l2' },
    ]);
  });

  it('excludes an empty (unassigned) slot even though the day+period matches', () => {
    const agenda = buildDayAgenda('2026-09-20', PERIODS, SLOTS, []);
    assert.equal(agenda.periods.length, 1); // not 2 — period 2's slot has no class
  });

  it('picks up a different weekday\'s own periods', () => {
    const agenda = buildDayAgenda('2026-09-22', PERIODS, SLOTS, PLANS);
    assert.deepEqual(agenda.periods, [
      { periodNumber: 1, startTime: '08:00', durationMinutes: 45, classGroupId: 'c2' },
    ]);
    assert.deepEqual(agenda.lessons, [{ planId: 'p2', planTitle: 'Plan B', lessonId: 'l3' }]);
  });

  it('is empty for a date with neither a filled slot nor a lesson', () => {
    const agenda = buildDayAgenda('2026-09-21', PERIODS, SLOTS, PLANS);
    assert.deepEqual(agenda, { periods: [], lessons: [] });
  });

  it('sorts periods by number, not by slot insertion order', () => {
    const outOfOrderSlots = [
      { dayOfWeek: 0, periodNumber: 2, classGroupId: 'c2' },
      { dayOfWeek: 0, periodNumber: 1, classGroupId: 'c1' },
    ];
    const agenda = buildDayAgenda('2026-09-20', PERIODS, outOfOrderSlots, []);
    assert.deepEqual(agenda.periods.map(p => p.periodNumber), [1, 2]);
  });

  it('falls back to an empty startTime when the period itself was deleted', () => {
    const agenda = buildDayAgenda('2026-09-20', [], [{ dayOfWeek: 0, periodNumber: 1, classGroupId: 'c1' }], []);
    assert.deepEqual(agenda.periods, [{ periodNumber: 1, startTime: '', durationMinutes: 0, classGroupId: 'c1' }]);
  });

  it('drops a malformed entry from a plan rather than the whole plan (via normalizePlanEntries)', () => {
    const plans = [{ id: 'p1', title: 'Plan A', entries: [{ lessonId: 'l1', date: '2026-09-20' }, { bogus: true }] }];
    const agenda = buildDayAgenda('2026-09-20', [], [], plans);
    assert.deepEqual(agenda.lessons, [{ planId: 'p1', planTitle: 'Plan A', lessonId: 'l1' }]);
  });
});

describe('dayHasAgenda', () => {
  it('is true with either periods or lessons, false with neither', () => {
    assert.equal(dayHasAgenda({ periods: [{ periodNumber: 1, startTime: '', durationMinutes: 0, classGroupId: 'c' }], lessons: [] }), true);
    assert.equal(dayHasAgenda({ periods: [], lessons: [{ planId: 'p', planTitle: '', lessonId: 'l' }] }), true);
    assert.equal(dayHasAgenda({ periods: [], lessons: [] }), false);
  });
});

describe('monthGridDates', () => {
  it('returns exactly 42 dates', () => {
    assert.equal(monthGridDates(2026, 8).length, 42); // September 2026 (0-based month)
  });

  it('starts on a Sunday and ends on a Saturday', () => {
    const dates = monthGridDates(2026, 8);
    assert.equal(new Date(`${dates[0]}T00:00:00`).getDay(), 0);
    assert.equal(new Date(`${dates.at(-1)}T00:00:00`).getDay(), 6);
  });

  it('includes the 1st and last day of the requested month', () => {
    const dates = monthGridDates(2026, 8); // September has 30 days
    assert.ok(dates.includes('2026-09-01'));
    assert.ok(dates.includes('2026-09-30'));
  });

  it('leads in with the previous month\'s trailing days when the 1st is not a Sunday', () => {
    // 2026-09-01 is a Tuesday, so the grid must lead in with Aug 30 (Sun).
    const dates = monthGridDates(2026, 8);
    assert.equal(dates[0], '2026-08-30');
  });

  it('crosses a year boundary correctly (December -> January)', () => {
    const dates = monthGridDates(2026, 11); // December 2026
    assert.ok(dates.includes('2026-12-01'));
    assert.ok(dates.includes('2026-12-31'));
    // The grid's tail necessarily spills into January 2027.
    assert.ok(dates.some(d => d.startsWith('2027-01')));
  });
});

describe('isInMonth', () => {
  it('is true for a date inside the month, false for lead-in/lead-out days', () => {
    assert.equal(isInMonth('2026-09-15', 2026, 8), true);
    assert.equal(isInMonth('2026-08-30', 2026, 8), false);
    assert.equal(isInMonth('2026-10-01', 2026, 8), false);
  });
});
