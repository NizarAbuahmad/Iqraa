/**
 * Reading a saved material's real shape.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/materialShape.test.ts
 *
 * The point of this predicate is the activities already sitting in teachers'
 * workspaces under `type: 'lesson'` — filed that way because the viewer had no
 * activity branch. It has one now, and these assert the rescue is safe in both
 * directions: every real activity is recognised, and no lesson plan, quiz or
 * worksheet is mistaken for one and sent to the wrong renderer.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { looksLikeActivityContent } from '../materialShape.ts';
import type {
  ActivityOutput,
  LessonPlanOutput,
  QuizOutput,
  WorksheetOutput,
} from '../ai/AIService.ts';

const ACTIVITY: ActivityOutput = {
  title: 'نشاط تركيب الاقترانات',
  activityType: 'group',
  totalDuration: 15,
  objective: 'تطبيق التركيب في مواقف حياتية',
  groupSize: 'ثلاثيات',
  materials: ['بطاقات'],
  steps: [
    { stepNumber: 1, title: 'التمهيد', description: 'وزّع البطاقات', durationMin: 3 },
  ],
  teacherTips: ['راقب المجموعة الأولى'],
  differentiation: 'بطاقات أبسط للمتعثرين',
  assessment: 'ملاحظة أثناء العمل',
};

const PLAN: LessonPlanOutput = {
  title: 'تركيب الاقترانات',
  grade: 'الصف العاشر',
  subject: 'Mathematics',
  duration: 45,
  objectives: ['أن يجد الطالب تركيب اقترانين'],
  materials: ['كتاب الطالب'],
  introduction: 'مراجعة',
  mainActivity: 'شرح',
  guidedPractice: 'مثالان',
  independentPractice: 'ورقة عمل',
  closure: 'تلخيص',
  assessment: 'سؤال ختامي',
  differentiation: 'أمثلة عددية',
  homework: 'تمارين',
};

const QUIZ: QuizOutput = {
  title: 'اختبار قصير',
  duration: 10,
  totalPoints: 1,
  questions: [
    { id: 'q1', text: 'س؟', type: 'short_answer', points: 1, correctAnswer: 'ج', explanation: '' },
  ],
};

const WORKSHEET: WorksheetOutput = {
  title: 'ورقة عمل',
  instructions: 'أجب',
  sections: [{ type: 'short_answer', title: 'الأول', questions: [{ text: 'س؟', points: 1 }] }],
  answerKey: [{ num: 1, answer: 'ج' }],
};

describe('looksLikeActivityContent', () => {
  it('recognises an activity, so one saved as type lesson still renders as one', () => {
    assert.equal(looksLikeActivityContent(ACTIVITY), true);
    // What actually comes off the wire: JSON, not the object.
    assert.equal(looksLikeActivityContent(JSON.parse(JSON.stringify(ACTIVITY))), true);
  });

  it('does not mistake any other material for an activity', () => {
    assert.equal(looksLikeActivityContent(PLAN), false);
    assert.equal(looksLikeActivityContent(QUIZ), false);
    assert.equal(looksLikeActivityContent(WORKSHEET), false);
  });

  it('holds the line on a plan that happens to carry steps', () => {
    // `objectives` (a list) is the plan's own marker, and it wins over any
    // field an activity also has — otherwise a renderer swap could be one
    // stray key away.
    assert.equal(looksLikeActivityContent({ ...PLAN, steps: [], objective: 'x' }), false);
  });

  it('says no to anything that is not a material at all', () => {
    for (const junk of [null, undefined, '', 0, [], {}, 'activity']) {
      assert.equal(looksLikeActivityContent(junk), false, `${JSON.stringify(junk)} passed`);
    }
  });
});
