/**
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/deckNotes.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { slideTeacherNotes, slideTeacherNotesText } from '../deckNotes.ts';
import type { ActivitySlide } from '../ai/AIService.ts';

const slide = (over: Partial<ActivitySlide> = {}): ActivitySlide => ({
  slideNumber: 3, type: 'challenge', title: 'مثال', content: 'مسألة', durationSeconds: 60, ...over,
});

describe('slideTeacherNotes — what the exports print for the teacher', () => {
  it('lists the hint and every teacher field, in reading order, skipping empties', () => {
    const sections = slideTeacherNotes(slide({
      hint: 'استخدم قانون الميل',
      teacher: { expectedAnswer: 'm = 2', commonMisconceptions: '', teachingTips: 'اطلب الخطوة الأولى', suggestedQuestions: ['لماذا؟', ' '] },
    }), true);
    assert.deepEqual(sections.map(s => s.label), ['تلميح', 'الإجابة المتوقعة', 'نصائح للتدريس', 'أسئلة مقترحة']);
    assert.equal(sections[3]!.text, '• لماذا؟');
  });

  it('is empty for a slide with nothing for the teacher', () => {
    assert.deepEqual(slideTeacherNotes(slide(), true), []);
    assert.equal(slideTeacherNotesText(slide({ teacher: { expectedAnswer: ' ' } }), false), '');
  });

  it('labels in english for an english deck', () => {
    const [first] = slideTeacherNotes(slide({ teacher: { expectedAnswer: 'x = 4' } }), false);
    assert.equal(first!.label, 'Expected answer');
    assert.match(slideTeacherNotesText(slide({ teacher: { expectedAnswer: 'x = 4' } }), false), /^Expected answer:\nx = 4$/);
  });
});
