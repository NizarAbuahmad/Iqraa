/**
 * What this guards: the Ministry lesson-plan export prints one form page per
 * lesson, fills the header/outcomes/date/section from the plan, keeps the four
 * fixed stages with their minutes, and escapes anything typed by a teacher.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildMinistryPlanHTML, ministryDayAndDate, stagesFromLessonPlan, type MinistryLessonPage } from '../ministryPlanHtml.ts';

const page: MinistryLessonPage = {
  subject: 'الرياضيات',
  grade: 'الصف الأول',
  unit: 'معالجة البيانات',
  lesson: 'التصنيف وفق خاصية واحدة',
  periods: 1,
  priorLearning: 'الدرس السابق',
  outcomes: ['يصنف الأشياء', 'يطبق مفهوم التصنيف'],
  section: '1',
  date: '2026-09-20',
  teacher: 'معلم <b>',
};

describe('buildMinistryPlanHTML', () => {
  it('prints one page per lesson', () => {
    const html = buildMinistryPlanHTML([page, { ...page, date: '2026-09-21' }], 'خطة');
    assert.equal((html.match(/<section class="page"/g) ?? []).length, 2);
  });

  it('fills the header, outcomes, section and day/date', () => {
    const html = buildMinistryPlanHTML([page], 'خطة');
    for (const s of ['المبحث: الرياضيات', 'الدرس: التصنيف وفق خاصية واحدة', 'عدد الحصص: 1', 'التعلم القبلي: الدرس السابق', 'يصنف الأشياء', 'الأحد', '2026-09-20']) {
      assert.ok(html.includes(s), s);
    }
  });

  it('keeps four numbered outcome slots and the four stages with their minutes', () => {
    const html = buildMinistryPlanHTML([page], 'خطة');
    assert.equal((html.match(/class="outcome"/g) ?? []).length, 4);
    for (const m of ['5د', '15د', '10د']) assert.ok(html.includes(m), m);
    assert.ok(html.includes('تأكيد التعلم'));
  });

  it('escapes teacher-typed text', () => {
    const html = buildMinistryPlanHTML([page], 'خطة');
    assert.ok(!html.includes('معلم <b>'));
    assert.ok(html.includes('&lt;b&gt;'));
  });

  it('falls back to the raw string for an unreal date', () => {
    assert.equal(ministryDayAndDate('nope'), 'nope');
  });

  it('prints generated stage text in both role columns', () => {
    const stages = [
      { teacher: 'يسأل', learner: 'يجيب' },
      { teacher: 'يشرح', learner: 'يدوّن' },
      { teacher: '', learner: '' },
      { teacher: 'يلخص', learner: 'يراجع' },
    ];
    const html = buildMinistryPlanHTML([{ ...page, stages }], 'خطة');
    for (const s of ['يسأل', 'يجيب', 'يشرح', 'يدوّن', 'يلخص', 'يراجع']) assert.ok(html.includes(s), s);
  });
});

describe('stagesFromLessonPlan', () => {
  const base = {
    introduction: 'a', mainActivity: 'b', guidedPractice: 'c',
    independentPractice: ' ', differentiation: 'd', closure: 'e', assessment: '',
  };

  it('folds the phases into the teacher column, skipping blanks', () => {
    const st = stagesFromLessonPlan(base);
    assert.deepEqual(st.map(s => s.teacher), ['a', 'b\nc', 'd', 'e']);
    assert.ok(st.every(s => s.learner === ''));
  });

  it("prefers the model's teacher/learner split when it is whole", () => {
    const roles = [1, 2, 3, 4].map(i => ({ teacher: `m${i}`, learner: `l${i}` }));
    assert.deepEqual(stagesFromLessonPlan({ ...base, ministryRoles: roles }), roles);
  });

  it('falls back to the folded phases when the split is short or empty', () => {
    assert.equal(stagesFromLessonPlan({ ...base, ministryRoles: [{ teacher: 'x', learner: 'y' }] })[0].teacher, 'a');
    const blank = [1, 2, 3, 4].map(() => ({ teacher: ' ', learner: '' }));
    assert.equal(stagesFromLessonPlan({ ...base, ministryRoles: blank })[1].teacher, 'b\nc');
  });
});
