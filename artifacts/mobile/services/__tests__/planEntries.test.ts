/**
 * What this guards: a teaching plan's schedule is stored in a `jsonb` column,
 * so its shape is whatever was written there — by this client, by an older
 * one, or by hand. Nothing downstream may assume it parsed. The rule that
 * matters most is that ONE bad element never costs a teacher the rest of the
 * plan, because these rows already exist and cannot be re-typed.
 *
 * `autoScheduleEntries` gets the heaviest coverage here: it is date
 * arithmetic across arbitrary weekday sets, and date arithmetic is exactly
 * where off-by-ones hide (month/year rollovers, a start date that isn't
 * itself a meeting day, a lesson with an unknown period count).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PLAN_ENTRIES,
  autoScheduleEntries,
  dateOf,
  entriesByDate,
  entriesOnDate,
  isValidPlanDate,
  nextEntry,
  normalizePlanEntries,
  setEntryDate,
  toISODate,
  todayISO,
} from '../planEntries.ts';

describe('isValidPlanDate', () => {
  it('accepts a real, in-range calendar date', () => {
    assert.equal(isValidPlanDate(todayISO()), true);
  });

  it('rejects a day that does not exist, rather than letting it roll forward', () => {
    // Date would silently turn this into March 2nd; the re-format check catches it.
    assert.equal(isValidPlanDate('2026-02-30'), false);
  });

  it('rejects malformed strings', () => {
    for (const bad of ['2026-9-1', '20260901', 'not-a-date', '', '2026-13-01']) {
      assert.equal(isValidPlanDate(bad), false);
    }
  });

  it('rejects a date far outside a plausible school schedule', () => {
    assert.equal(isValidPlanDate('1990-01-01'), false);
    assert.equal(isValidPlanDate('2099-01-01'), false);
  });
});

describe('toISODate / todayISO', () => {
  it('formats local date parts, not a UTC-shifted one', () => {
    // 11:30pm local — a UTC-based formatter could report the next day.
    const late = new Date(2026, 8, 20, 23, 30);
    assert.equal(toISODate(late), '2026-09-20');
  });

  it('pads single-digit month and day', () => {
    assert.equal(toISODate(new Date(2026, 0, 5)), '2026-01-05');
  });

  it('todayISO matches a fresh Date', () => {
    assert.equal(todayISO(), toISODate(new Date()));
  });
});

describe('normalizePlanEntries', () => {
  it('keeps well-formed entries', () => {
    const raw = [{ lessonId: 'a', date: '2026-09-21' }, { lessonId: 'b', date: '2026-09-23' }];
    assert.deepEqual(normalizePlanEntries(raw), raw);
  });

  it('returns empty for anything that is not an array', () => {
    for (const raw of [null, undefined, {}, 'a', 7, true]) {
      assert.deepEqual(normalizePlanEntries(raw), []);
    }
  });

  it('drops a leftover week-shaped row instead of crashing on it', () => {
    // The exact shape this column held for a few hours before this rewrite.
    assert.deepEqual(normalizePlanEntries([{ lessonId: 'a', week: 3 }]), []);
  });

  it('drops only the bad elements, never the whole plan', () => {
    const raw = [
      { lessonId: 'a', date: '2026-09-21' },
      null,
      { lessonId: '', date: '2026-09-22' },
      { lessonId: 'c', date: 'nonsense' },
      { lessonId: 'd', date: '2026-02-30' },
      { week: 2 },
      'nonsense',
      { lessonId: 'g', date: '2026-09-24' },
    ];
    assert.deepEqual(normalizePlanEntries(raw), [
      { lessonId: 'a', date: '2026-09-21' },
      { lessonId: 'g', date: '2026-09-24' },
    ]);
  });

  it('keeps a lesson once, last date wins', () => {
    const raw = [{ lessonId: 'a', date: '2026-09-21' }, { lessonId: 'a', date: '2026-09-28' }];
    assert.deepEqual(normalizePlanEntries(raw), [{ lessonId: 'a', date: '2026-09-28' }]);
  });

  it('stops at the entry cap', () => {
    const raw = Array.from({ length: MAX_PLAN_ENTRIES + 50 }, (_, i) => ({
      lessonId: `l${i}`,
      date: '2026-09-21',
    }));
    assert.equal(normalizePlanEntries(raw).length, MAX_PLAN_ENTRIES);
  });
});

describe('setEntryDate', () => {
  const ENTRIES = [{ lessonId: 'a', date: '2026-09-21' }, { lessonId: 'b', date: '2026-09-22' }];

  it('adds a lesson', () => {
    assert.deepEqual(setEntryDate(ENTRIES, 'c', '2026-09-23'), [...ENTRIES, { lessonId: 'c', date: '2026-09-23' }]);
  });

  it('moves a lesson without duplicating it', () => {
    assert.deepEqual(setEntryDate(ENTRIES, 'a', '2026-10-01'), [
      { lessonId: 'b', date: '2026-09-22' },
      { lessonId: 'a', date: '2026-10-01' },
    ]);
  });

  it('removes a lesson on null', () => {
    assert.deepEqual(setEntryDate(ENTRIES, 'a', null), [{ lessonId: 'b', date: '2026-09-22' }]);
  });

  it('refuses an invalid date rather than storing it', () => {
    assert.deepEqual(setEntryDate(ENTRIES, 'c', '2026-02-30'), ENTRIES);
    assert.deepEqual(setEntryDate(ENTRIES, 'c', 'nonsense'), ENTRIES);
  });

  it('does not mutate its input', () => {
    const original = [{ lessonId: 'a', date: '2026-09-21' }];
    setEntryDate(original, 'b', '2026-09-22');
    assert.deepEqual(original, [{ lessonId: 'a', date: '2026-09-21' }]);
  });
});

describe('entriesByDate', () => {
  it('groups by date, ascending, keeping pick order inside a day', () => {
    const entries = [
      { lessonId: 'c', date: '2026-09-23' },
      { lessonId: 'a', date: '2026-09-21' },
      { lessonId: 'b', date: '2026-09-23' },
    ];
    assert.deepEqual(entriesByDate(entries), [
      { date: '2026-09-21', lessonIds: ['a'] },
      { date: '2026-09-23', lessonIds: ['c', 'b'] },
    ]);
  });

  it('sorts across a month/year boundary correctly as plain strings', () => {
    const entries = [
      { lessonId: 'jan', date: '2027-01-05' },
      { lessonId: 'dec', date: '2026-12-30' },
    ];
    assert.deepEqual(entriesByDate(entries).map(d => d.date), ['2026-12-30', '2027-01-05']);
  });

  it('is empty for no entries', () => {
    assert.deepEqual(entriesByDate([]), []);
  });
});

describe('dateOf / entriesOnDate / nextEntry', () => {
  const entries = [
    { lessonId: 'a', date: '2026-09-21' },
    { lessonId: 'b', date: '2026-09-23' },
    { lessonId: 'c', date: '2026-09-23' },
  ];

  it('dateOf finds a lesson, and null for one not in the plan', () => {
    assert.equal(dateOf(entries, 'a'), '2026-09-21');
    assert.equal(dateOf(entries, 'z'), null);
  });

  it('entriesOnDate returns every lesson on that day', () => {
    assert.deepEqual(entriesOnDate(entries, '2026-09-23').map(e => e.lessonId), ['b', 'c']);
    assert.deepEqual(entriesOnDate(entries, '2026-09-22'), []);
  });

  it('nextEntry finds the soonest entry on or after a date', () => {
    assert.equal(nextEntry(entries, '2026-09-22')?.lessonId, 'b');
    assert.equal(nextEntry(entries, '2026-09-21')?.lessonId, 'a');
  });

  it('nextEntry is null once the plan is entirely in the past', () => {
    assert.equal(nextEntry(entries, '2026-10-01'), null);
  });
});

describe('autoScheduleEntries', () => {
  // 2026-09-20 is a Sunday.
  const SUN = 0, MON = 1, TUE = 2, WED = 3, THU = 4;

  it('lays out one-period lessons across the given meeting days', () => {
    const lessons = [{ id: 'a', periods: 1 }, { id: 'b', periods: 1 }, { id: 'c', periods: 1 }];
    const entries = autoScheduleEntries(lessons, '2026-09-20', [SUN, TUE, THU]);
    assert.deepEqual(entries, [
      { lessonId: 'a', date: '2026-09-20' }, // Sun
      { lessonId: 'b', date: '2026-09-22' }, // Tue
      { lessonId: 'c', date: '2026-09-24' }, // Thu
    ]);
  });

  it('gives a multi-period lesson consecutive meeting-day slots before the next one starts', () => {
    const lessons = [{ id: 'a', periods: 2 }, { id: 'b', periods: 1 }];
    const entries = autoScheduleEntries(lessons, '2026-09-20', [SUN, TUE, THU]);
    assert.deepEqual(entries, [
      { lessonId: 'a', date: '2026-09-20' }, // Sun (period 1 of 2)
      { lessonId: 'b', date: '2026-09-24' }, // Thu — Tue was 'a's 2nd period
    ]);
  });

  it('treats an unknown period count as 1', () => {
    const lessons = [{ id: 'a', periods: null }, { id: 'b', periods: null }];
    const entries = autoScheduleEntries(lessons, '2026-09-20', [SUN, TUE]);
    assert.deepEqual(entries.map(e => e.date), ['2026-09-20', '2026-09-22']);
  });

  it('rolls forward to the first real meeting day when the start date is not one', () => {
    // 2026-09-21 is a Monday; the class only meets Sun/Tue/Thu.
    const entries = autoScheduleEntries([{ id: 'a', periods: 1 }], '2026-09-21', [SUN, TUE, THU]);
    assert.deepEqual(entries, [{ lessonId: 'a', date: '2026-09-22' }]);
  });

  it('crosses a month boundary correctly', () => {
    // 2026-09-29 Tue, 2026-10-01 Thu, meeting Tue/Thu.
    const lessons = [{ id: 'a', periods: 1 }, { id: 'b', periods: 1 }];
    const entries = autoScheduleEntries(lessons, '2026-09-29', [TUE, THU]);
    assert.deepEqual(entries.map(e => e.date), ['2026-09-29', '2026-10-01']);
  });

  it('is empty with no meeting days, no lessons, or an invalid start date', () => {
    assert.deepEqual(autoScheduleEntries([{ id: 'a', periods: 1 }], '2026-09-20', []), []);
    assert.deepEqual(autoScheduleEntries([], '2026-09-20', [MON]), []);
    assert.deepEqual(autoScheduleEntries([{ id: 'a', periods: 1 }], 'nonsense', [MON]), []);
  });

  it('deduplicates repeated meeting-day values', () => {
    const entries = autoScheduleEntries([{ id: 'a', periods: 1 }, { id: 'b', periods: 1 }], '2026-09-20', [SUN, SUN, TUE]);
    assert.deepEqual(entries.map(e => e.date), ['2026-09-20', '2026-09-22']);
  });

  it('caps at MAX_PLAN_ENTRIES lessons', () => {
    const lessons = Array.from({ length: MAX_PLAN_ENTRIES + 10 }, (_, i) => ({ id: `l${i}`, periods: 1 }));
    assert.equal(autoScheduleEntries(lessons, '2026-09-20', [SUN, MON, TUE, WED, THU]).length, MAX_PLAN_ENTRIES);
  });

  it('replaces the whole schedule rather than merging — every returned entry starts fresh', () => {
    // Documents the contract: this is "lay out my term", not incremental —
    // the caller is responsible for confirming with the teacher first.
    const first = autoScheduleEntries([{ id: 'a', periods: 1 }], '2026-09-20', [SUN]);
    const second = autoScheduleEntries([{ id: 'b', periods: 1 }], '2026-09-20', [SUN]);
    assert.deepEqual(second, [{ lessonId: 'b', date: '2026-09-20' }]);
    assert.notDeepEqual(second, first);
  });
});
