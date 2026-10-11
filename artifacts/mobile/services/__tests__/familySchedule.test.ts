/**
 * What this guards: the family timetable arrives from a server that may be
 * older or newer than the app, and the screen must render "nothing yet"
 * rather than crash on a shape it did not expect.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  WEEKDAY_KEYS,
  activeChild,
  normalizeSchedule,
  periodTimeLabel,
  type ChildSchedule,
  type FamilyPeriod,
} from '../familySchedule.ts';

const period = (over: Partial<FamilyPeriod> = {}): FamilyPeriod => ({
  periodNumber: 1,
  startTime: '08:00',
  durationMinutes: 45,
  subjectId: 'mathematics',
  teacherName: 'Omar Haddad',
  notes: '',
  ...over,
});

describe('normalizeSchedule', () => {
  it('reads anything that is not a schedule as an empty one', () => {
    for (const raw of [undefined, null, 'x', 42, {}, { days: 'nope' }]) {
      assert.deepEqual(normalizeSchedule(raw), { days: [] }, String(raw));
    }
  });

  it('keeps well-formed days and drops malformed ones', () => {
    const good = { dayOfWeek: 0, periods: [period()] };
    const s = normalizeSchedule({ days: [good, null, { dayOfWeek: 'x', periods: [] }, { dayOfWeek: 2 }] });
    assert.deepEqual(s, { days: [good] });
  });
});

describe('periodTimeLabel', () => {
  it('shows start and end', () => {
    assert.equal(periodTimeLabel(period()), '08:00–08:45');
  });

  it('is null when the teacher never set the time', () => {
    assert.equal(periodTimeLabel(period({ startTime: null, durationMinutes: null })), null);
  });
});

describe('WEEKDAY_KEYS', () => {
  it('has one key per weekday, Sunday first — matching Date#getDay()', () => {
    assert.equal(WEEKDAY_KEYS.length, 7);
    assert.equal(WEEKDAY_KEYS[0], 'schoolDaySun');
    assert.equal(WEEKDAY_KEYS[6], 'schoolDaySat');
  });
});

describe('activeChild', () => {
  const kids: ChildSchedule[] = [
    { key: 'a', displayName: 'سارة', schedule: { days: [] } },
    { key: 'b', displayName: 'أحمد', schedule: { days: [] } },
  ];

  it('returns the selected child', () => {
    assert.equal(activeChild(kids, 'b')?.key, 'b');
  });

  it('falls back to the first when the selection is gone or unset', () => {
    assert.equal(activeChild(kids, 'zzz')?.key, 'a');
    assert.equal(activeChild(kids, null)?.key, 'a');
  });

  it('is null when there are no children', () => {
    assert.equal(activeChild([], 'a'), null);
  });
});
