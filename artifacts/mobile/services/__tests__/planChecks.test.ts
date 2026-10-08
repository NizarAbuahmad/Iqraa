/**
 * What this guards: a plan can be well formed entry by entry and still be a bad
 * plan — wrong lessons, wrong order, a class that never meets that day, a
 * three-period lesson given one slot. `checkPlan` finds those; the sweep at the
 * bottom runs the real auto-scheduler over every real class's lessons, so a
 * regression in the pacing arithmetic or a catalog change that breaks it shows
 * up here without anyone opening the screen.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MAX_PLAN_ENTRIES, autoScheduleEntries, toISODate } from '../planEntries.ts';
import { checkPlan } from '../planChecks.ts';
import { KB_BOOKS, getLessonsForUnit, getUnitsForSubjectGrade } from '../knowledgeBase.ts';

// 2026-10-04 is a Sunday. Meeting days: Sun, Tue, Thu.
const DAYS = [0, 2, 4];
const LESSONS = [
  { id: 'a', periods: 1 },
  { id: 'b', periods: 2 },
  { id: 'c', periods: 1 },
];
const codes = (issues: { code: string }[]) => issues.map(i => i.code);

describe('checkPlan', () => {
  it('passes what autoScheduleEntries produces', () => {
    const plan = autoScheduleEntries(LESSONS, '2026-10-04', DAYS);
    assert.deepEqual(checkPlan(plan, LESSONS, { meetingDays: DAYS, requireAll: true }), []);
  });

  it('flags a lesson the class does not have', () => {
    const issues = checkPlan([{ lessonId: 'zzz', date: '2026-10-04' }], LESSONS);
    assert.deepEqual(codes(issues), ['unknown_lesson']);
  });

  it('flags a duplicate', () => {
    const issues = checkPlan(
      [{ lessonId: 'a', date: '2026-10-04' }, { lessonId: 'a', date: '2026-10-06' }],
      LESSONS,
    );
    assert.ok(codes(issues).includes('duplicate_lesson'));
  });

  it('flags a lesson taught before the one the book puts first', () => {
    const issues = checkPlan(
      [{ lessonId: 'c', date: '2026-10-04' }, { lessonId: 'a', date: '2026-10-06' }],
      LESSONS,
    );
    assert.deepEqual(codes(issues), ['out_of_order']);
  });

  it('flags a date on a day the class does not meet', () => {
    // 2026-10-05 is a Monday.
    const issues = checkPlan([{ lessonId: 'a', date: '2026-10-05' }], LESSONS, { meetingDays: DAYS });
    assert.deepEqual(codes(issues), ['off_meeting_day']);
  });

  it('flags a two-period lesson given one session', () => {
    const issues = checkPlan(
      [{ lessonId: 'b', date: '2026-10-04' }, { lessonId: 'c', date: '2026-10-06' }],
      LESSONS,
      { meetingDays: DAYS },
    );
    assert.deepEqual(codes(issues), ['too_tight']);
  });

  it('only demands every lesson when asked', () => {
    const plan = [{ lessonId: 'a', date: '2026-10-04' }];
    assert.deepEqual(checkPlan(plan, LESSONS), []);
    assert.deepEqual(codes(checkPlan(plan, LESSONS, { requireAll: true })), ['missing_lesson', 'missing_lesson']);
  });
});

describe('auto-scheduled plans for every real class', () => {
  const pairs = [...new Set(KB_BOOKS.map(b => `${b.subjectId}|${b.gradeId}`))];
  // Within three years of today, whatever day this runs — `isValidPlanDate` is relative to now.
  const start = toISODate(new Date());

  it('has classes to check', () => assert.ok(pairs.length > 0));

  it('are always well formed, in book order, on meeting days, with periods honoured', () => {
    const problems: string[] = [];
    const truncated: string[] = [];
    for (const pair of pairs) {
      const [subjectId, gradeId] = pair.split('|') as [string, string];
      const lessons = getUnitsForSubjectGrade(subjectId, gradeId)
        .flatMap(u => getLessonsForUnit(u.id))
        .map(l => ({ id: l.id, periods: l.periods ?? null }));
      if (lessons.length === 0) continue;
      const plan = autoScheduleEntries(lessons, start, DAYS);
      if (lessons.length > MAX_PLAN_ENTRIES) truncated.push(`${pair} (${lessons.length})`);
      for (const issue of checkPlan(plan, lessons, { meetingDays: DAYS, requireAll: lessons.length <= MAX_PLAN_ENTRIES })) {
        problems.push(`${pair}: ${issue.code} ${issue.lessonId} ${issue.detail ?? ''}`);
      }
    }
    assert.deepEqual(problems.slice(0, 20), []);
    // A class bigger than the cap is silently cut — surface it, don't hide it.
    assert.deepEqual(truncated, []);
  });
});
