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
  dayRows,
  defaultDay,
  endTime,
  isHappeningNow,
  isInMonth,
  monthGridDates,
  schoolsOf,
  visibleWeekdays,
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
      { schoolName: '', periodNumber: 1, startTime: '08:00', durationMinutes: 45, classGroupId: 'c1' },
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
      { schoolName: '', periodNumber: 1, startTime: '08:00', durationMinutes: 45, classGroupId: 'c2' },
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
    assert.deepEqual(agenda.periods, [{ schoolName: '', periodNumber: 1, startTime: '', durationMinutes: 0, classGroupId: 'c1' }]);
  });

  it('drops a malformed entry from a plan rather than the whole plan (via normalizePlanEntries)', () => {
    const plans = [{ id: 'p1', title: 'Plan A', entries: [{ lessonId: 'l1', date: '2026-09-20' }, { bogus: true }] }];
    const agenda = buildDayAgenda('2026-09-20', [], [], plans);
    assert.deepEqual(agenda.lessons, [{ planId: 'p1', planTitle: 'Plan A', lessonId: 'l1' }]);
  });
});

// A teacher in a morning school and an evening-shift school: both have a
// period 1, at unrelated times.
const TWO_SCHOOL_PERIODS = [
  { schoolName: '', periodNumber: 1, startTime: '08:00', durationMinutes: 45 },
  { schoolName: '', periodNumber: 2, startTime: '08:45', durationMinutes: 45 },
  { schoolName: 'مسائية', periodNumber: 1, startTime: '13:00', durationMinutes: 40 },
];
const TWO_SCHOOL_SLOTS = [
  { schoolName: 'مسائية', dayOfWeek: 0, periodNumber: 1, classGroupId: 'evening', notes: 'قاعة 3' },
  { schoolName: '', dayOfWeek: 0, periodNumber: 1, classGroupId: 'morning' },
];

describe('buildDayAgenda across schools', () => {
  it('takes each slot\'s time from its own school\'s period, and interleaves by clock', () => {
    const agenda = buildDayAgenda('2026-09-20', TWO_SCHOOL_PERIODS, TWO_SCHOOL_SLOTS, []);
    assert.deepEqual(
      agenda.periods.map(p => [p.schoolName, p.periodNumber, p.startTime, p.classGroupId]),
      [['', 1, '08:00', 'morning'], ['مسائية', 1, '13:00', 'evening']],
    );
  });
});

describe('dayRows', () => {
  it('lists every period of every school, empty ones included, in clock order', () => {
    assert.deepEqual(dayRows(0, TWO_SCHOOL_PERIODS, TWO_SCHOOL_SLOTS), [
      { schoolName: '', periodNumber: 1, startTime: '08:00', durationMinutes: 45, classGroupId: 'morning', notes: '' },
      { schoolName: '', periodNumber: 2, startTime: '08:45', durationMinutes: 45, classGroupId: null, notes: '' },
      { schoolName: 'مسائية', periodNumber: 1, startTime: '13:00', durationMinutes: 40, classGroupId: 'evening', notes: 'قاعة 3' },
    ]);
  });

  it('does not borrow another weekday\'s class', () => {
    assert.ok(dayRows(1, TWO_SCHOOL_PERIODS, TWO_SCHOOL_SLOTS).every(r => r.classGroupId === null));
  });
});

describe('schoolsOf', () => {
  it('puts the unnamed default first and dedupes across periods and slots', () => {
    assert.deepEqual(schoolsOf(TWO_SCHOOL_PERIODS, TWO_SCHOOL_SLOTS), ['', 'مسائية']);
  });

  it('is empty with no periods and no slots', () => {
    assert.deepEqual(schoolsOf([], []), []);
  });
});

describe('visibleWeekdays / defaultDay', () => {
  it('shows Sunday–Thursday, adding a weekend day only once a class sits on it', () => {
    assert.deepEqual(visibleWeekdays([], false), [0, 1, 2, 3, 4]);
    assert.deepEqual(visibleWeekdays([{ dayOfWeek: 6, periodNumber: 1, classGroupId: 'c' }], false), [0, 1, 2, 3, 4, 6]);
    assert.deepEqual(visibleWeekdays([{ dayOfWeek: 6, periodNumber: 1, classGroupId: null }], false), [0, 1, 2, 3, 4]);
    assert.deepEqual(visibleWeekdays([], true), [0, 1, 2, 3, 4, 5, 6]);
  });

  it('opens on today, or the next school day on a weekend', () => {
    assert.equal(defaultDay(2, [0, 1, 2, 3, 4]), 2);
    assert.equal(defaultDay(5, [0, 1, 2, 3, 4]), 0);
    assert.equal(defaultDay(6, [0, 1, 2, 3, 4, 6]), 6);
  });
});

describe('endTime / isHappeningNow', () => {
  it('adds the duration, wrapping past midnight', () => {
    assert.equal(endTime('08:00', 45), '08:45');
    assert.equal(endTime('23:30', 45), '00:15');
    assert.equal(endTime('', 45), '');
  });

  it('is inclusive of the start minute and exclusive of the end minute', () => {
    const at = (h: number, m: number) => new Date(2026, 8, 20, h, m);
    assert.equal(isHappeningNow('08:00', 45, at(8, 0)), true);
    assert.equal(isHappeningNow('08:00', 45, at(8, 44)), true);
    assert.equal(isHappeningNow('08:00', 45, at(8, 45)), false);
    assert.equal(isHappeningNow('08:00', 45, at(7, 59)), false);
    assert.equal(isHappeningNow('', 45, at(8, 10)), false);
  });
});

describe('dayHasAgenda', () => {
  it('is true with either periods or lessons, false with neither', () => {
    assert.equal(dayHasAgenda({ periods: [{ schoolName: '', periodNumber: 1, startTime: '', durationMinutes: 0, classGroupId: 'c' }], lessons: [] }), true);
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
