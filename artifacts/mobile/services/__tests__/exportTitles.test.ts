/**
 * The title a saved / exported plan or activity carries: a wide scope is a
 * revision and says so; a lesson keeps the title it always had.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { activityExportTitle, lessonPlanExportTitle } from '../exportTitles.ts';

describe('activityExportTitle', () => {
  it('a lesson activity keeps «نشاط: …» / "Activity: …"', () => {
    assert.equal(activityExportTitle('ar', 'قانون الجيوب', false), 'نشاط: قانون الجيوب');
    assert.equal(activityExportTitle('en', 'Sine rule', false), 'Activity: Sine rule');
  });

  it('a wide activity is a revision activity, in both languages', () => {
    // Mutation caught: the wide branch returning the lesson title.
    assert.equal(activityExportTitle('ar', 'الفصل الأول كاملًا', true), 'نشاط مراجعة: الفصل الأول كاملًا');
    assert.equal(activityExportTitle('en', 'Entire semester 1', true), 'Revision Activity: Entire semester 1');
  });
});

describe('lessonPlanExportTitle', () => {
  it('is what the plan screen always saved, for a lesson and for a wide scope', () => {
    assert.equal(lessonPlanExportTitle('ar', 'x', false), 'خطة درس: x');
    assert.equal(lessonPlanExportTitle('en', 'x', false), 'Lesson Plan: x');
    assert.equal(lessonPlanExportTitle('ar', 'x', true), 'خطة حصة مراجعة: x');
    assert.equal(lessonPlanExportTitle('en', 'x', true), 'Revision Lesson Plan: x');
  });
});

describe('the screens use them, from the frozen scope', () => {
  const read = (p: string) => readFileSync(join(import.meta.dirname, p), 'utf8');
  it('activity.tsx and lesson-plan.tsx build their save / export title through the pure functions', () => {
    // Mutation caught: a screen going back to its own inline template, or keying on the live picker.
    assert.ok(read('../../app/ai-tools/activity.tsx').includes('activityExportTitle(outLang, scope.topic, wideFrozen !== null)'));
    assert.ok(read('../../app/ai-tools/lesson-plan.tsx').includes('lessonPlanExportTitle(outLang, scope.topic, !!wideFrozen)'));
  });
});

describe('lesson-plan screen: prior-topics text hidden by a wide scope', () => {
  const src = readFileSync(join(import.meta.dirname, '../../app/ai-tools/lesson-plan.tsx'), 'utf8');
  it('does not keep "more options" open around a field the teacher cannot see, nor save its text', () => {
    // Mutation caught: the old `priorTopicsNotes.trim()` unconditionally in `moreOpen`.
    assert.ok(src.includes('(!wideScope.isWide && priorTopicsNotes.trim())'));
    // Mutation caught: saving the hidden text with a wide plan.
    assert.ok(src.includes("priorTopicsNotes: wideFrozen ? '' : priorTopicsNotes,"));
  });
});
