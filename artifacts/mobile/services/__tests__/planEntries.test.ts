/**
 * What this guards: a teaching plan's schedule is stored in a `jsonb` column,
 * so its shape is whatever was written there — by this client, by an older
 * one, or by hand. Nothing downstream may assume it parsed. The rule that
 * matters most is that ONE bad element never costs a teacher the rest of the
 * plan, because these rows already exist and cannot be re-typed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_PLAN_ENTRIES,
  MAX_PLAN_WEEK,
  entriesByWeek,
  normalizePlanEntries,
  setEntryWeek,
  weekOf,
} from '../planEntries.ts';

describe('normalizePlanEntries', () => {
  it('keeps well-formed entries', () => {
    assert.deepEqual(
      normalizePlanEntries([{ lessonId: 'a', week: 1 }, { lessonId: 'b', week: 3 }]),
      [{ lessonId: 'a', week: 1 }, { lessonId: 'b', week: 3 }],
    );
  });

  it('returns empty for anything that is not an array', () => {
    for (const raw of [null, undefined, {}, 'a', 7, true]) {
      assert.deepEqual(normalizePlanEntries(raw), []);
    }
  });

  it('drops only the bad elements, never the whole plan', () => {
    const raw = [
      { lessonId: 'a', week: 1 },
      null,
      { lessonId: '', week: 2 },
      { lessonId: 'c', week: 'three' },
      { lessonId: 'd', week: 1.5 },
      { lessonId: 'e', week: 0 },
      { lessonId: 'f', week: MAX_PLAN_WEEK + 1 },
      { week: 2 },
      'nonsense',
      { lessonId: 'g', week: 2 },
    ];
    assert.deepEqual(normalizePlanEntries(raw), [
      { lessonId: 'a', week: 1 },
      { lessonId: 'g', week: 2 },
    ]);
  });

  it('keeps a lesson once, last week wins', () => {
    assert.deepEqual(
      normalizePlanEntries([{ lessonId: 'a', week: 1 }, { lessonId: 'a', week: 5 }]),
      [{ lessonId: 'a', week: 5 }],
    );
  });

  it('stops at the entry cap', () => {
    const raw = Array.from({ length: MAX_PLAN_ENTRIES + 50 }, (_, i) => ({
      lessonId: `l${i}`,
      week: 1,
    }));
    assert.equal(normalizePlanEntries(raw).length, MAX_PLAN_ENTRIES);
  });

  it('accepts the boundary weeks', () => {
    assert.deepEqual(
      normalizePlanEntries([{ lessonId: 'a', week: 1 }, { lessonId: 'b', week: MAX_PLAN_WEEK }]),
      [{ lessonId: 'a', week: 1 }, { lessonId: 'b', week: MAX_PLAN_WEEK }],
    );
  });
});

describe('setEntryWeek', () => {
  const ENTRIES = [{ lessonId: 'a', week: 1 }, { lessonId: 'b', week: 2 }];

  it('adds a lesson', () => {
    assert.deepEqual(setEntryWeek(ENTRIES, 'c', 3), [...ENTRIES, { lessonId: 'c', week: 3 }]);
  });

  it('moves a lesson without duplicating it', () => {
    assert.deepEqual(setEntryWeek(ENTRIES, 'a', 4), [
      { lessonId: 'b', week: 2 },
      { lessonId: 'a', week: 4 },
    ]);
  });

  it('removes a lesson on null', () => {
    assert.deepEqual(setEntryWeek(ENTRIES, 'a', null), [{ lessonId: 'b', week: 2 }]);
  });

  it('refuses an out-of-range week rather than storing it', () => {
    assert.deepEqual(setEntryWeek(ENTRIES, 'c', 0), ENTRIES);
    assert.deepEqual(setEntryWeek(ENTRIES, 'c', MAX_PLAN_WEEK + 1), ENTRIES);
    assert.deepEqual(setEntryWeek(ENTRIES, 'c', 2.5), ENTRIES);
  });

  it('does not mutate its input', () => {
    const original = [{ lessonId: 'a', week: 1 }];
    setEntryWeek(original, 'b', 2);
    assert.deepEqual(original, [{ lessonId: 'a', week: 1 }]);
  });

  it('refuses to grow past the cap, but still lets a lesson move', () => {
    const full = Array.from({ length: MAX_PLAN_ENTRIES }, (_, i) => ({
      lessonId: `l${i}`,
      week: 1,
    }));
    assert.equal(setEntryWeek(full, 'extra', 2).length, MAX_PLAN_ENTRIES);
    assert.equal(weekOf(setEntryWeek(full, 'l0', 9), 'l0'), 9);
  });
});

describe('entriesByWeek', () => {
  it('groups by week, ascending, keeping pick order inside a week', () => {
    const entries = [
      { lessonId: 'c', week: 2 },
      { lessonId: 'a', week: 1 },
      { lessonId: 'b', week: 2 },
    ];
    assert.deepEqual(entriesByWeek(entries), [
      { week: 1, lessonIds: ['a'] },
      { week: 2, lessonIds: ['c', 'b'] },
    ]);
  });

  it('is empty for no entries', () => {
    assert.deepEqual(entriesByWeek([]), []);
  });
});

describe('weekOf', () => {
  it('finds a lesson, and reports null for one not in the plan', () => {
    const entries = [{ lessonId: 'a', week: 3 }];
    assert.equal(weekOf(entries, 'a'), 3);
    assert.equal(weekOf(entries, 'b'), null);
  });
});
