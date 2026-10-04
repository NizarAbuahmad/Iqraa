/**
 * The offline generator has question banks for maths and chemistry only. For
 * any other subject the question-based generators refuse with a typed error
 * instead of returning topic-templated filler («الوصف الصحيح لـX»).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { MockAIService, NoQuestionBankError } from '../ai/generators.ts';
import { aiErrorMessageKey } from '../ai/aiProvenance.ts';
import translations from '../i18n.ts';
import type { AIRequest } from '../ai/AIService.ts';

const service = new MockAIService();
(service as unknown as { delay: () => Promise<void> }).delay = async () => {};

const BASE = { language: 'arabic', difficulty: 'mixed', numQuestions: 6 } as const;
const ISLAMIC = { ...BASE, grade: 'الصف الأول', subject: 'التربية الإسلامية', topic: 'سورة الإخلاص' } as AIRequest;
const MATHS = { ...BASE, grade: 'الصف العاشر', subject: 'الرياضيات', topic: 'المعادلات الأسية' } as AIRequest;
const CHEM = { ...BASE, grade: 'الصف العاشر', subject: 'Chemistry', topic: 'المول والكتلة المولية' } as AIRequest;

const refuses = (e: unknown) => e instanceof NoQuestionBankError && e.code === 'no_question_bank';

describe('subjects with no question bank', () => {
  it('refuses a worksheet, a quiz and homework', async () => {
    await assert.rejects(service.generateWorksheet(ISLAMIC), refuses);
    await assert.rejects(service.generateQuiz(ISLAMIC), refuses);
    await assert.rejects(service.generateHomework(ISLAMIC), refuses);
  });

  it('still serves maths and chemistry', async () => {
    for (const req of [MATHS, CHEM]) {
      assert.ok((await service.generateQuiz(req)).questions.length > 0);
      assert.ok((await service.generateWorksheet(req)).sections.length > 0);
      assert.ok((await service.generateHomework(req)).sections.length > 0);
    }
  });

  it('still writes a lesson plan for any subject', async () => {
    assert.ok((await service.generateLessonPlan(ISLAMIC)).objectives.length > 0);
  });

  it('maps to its own message in both languages, not «try again»', () => {
    const key = aiErrorMessageKey(new NoQuestionBankError('x'));
    assert.equal(key, 'noQuestionBank');
    assert.ok((translations as any).ar[key] && (translations as any).en[key]);
  });
});

// ── Maths: a lesson is covered only when the bank has items ABOUT it ─────────
//
// Routing used to read a lesson's whole text and fall back to a default, so a
// Grade 1 sorting lesson served addition and Grade 7 proportion served
// quadratics. These run over the real catalog.

import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import { hasMathBank } from '../ai/mathPractice.ts';

const mathLessons = KB_LESSONS.filter(l => getBookForLesson(l)?.subjectId === 'mathematics');
const gradeOf = (l: (typeof KB_LESSONS)[number]) => Number(getBookForLesson(l)!.gradeId.replace('grade-', ''));
const mathReq = (l: (typeof KB_LESSONS)[number]) => ({
  grade: getBookForLesson(l)!.gradeId, subject: 'Mathematics', topic: l.titleAr, lessonId: l.id,
  language: 'arabic', numQuestions: 4, difficulty: 'mixed', totalMarks: 20,
}) as AIRequest;

describe('maths lessons: covered or refused, never off-topic filler', () => {
  it('finds both kinds in the catalog', () => {
    assert.ok(mathLessons.some(l => hasMathBank(l.titleAr, l)));
    assert.ok(mathLessons.some(l => !hasMathBank(l.titleAr, l)));
  });

  it('Grades 7–9 maths have no bank — none of those lessons is served the Grade 10 one', () => {
    for (const l of mathLessons.filter(l => gradeOf(l) >= 7 && gradeOf(l) <= 9)) {
      assert.equal(hasMathBank(l.titleAr, l), false, l.titleAr);
    }
  });

  it('a covered lesson generates a real quiz; a refused one refuses', async () => {
    for (const l of mathLessons) {
      if (hasMathBank(l.titleAr, l)) {
        const quiz = await service.generateQuiz(mathReq(l));
        assert.ok(quiz.questions.length > 0, l.titleAr);
        // The template fillers that used to fill a quiz when no item fitted.
        assert.ok(
          !quiz.questions.some(q => /الوصف الصحيح لـ|يختلفان في الآلية/.test(JSON.stringify(q))),
          `${l.titleAr}: a template filler reached a covered maths lesson`,
        );
      } else {
        await assert.rejects(service.generateQuiz(mathReq(l)), refuses, l.titleAr);
      }
    }
  });

  it('serves the fraction addition lesson fraction addition (it served same-denominator or nothing before)', async () => {
    const l = mathLessons.find(x => gradeOf(x) === 5 && x.titleAr.includes('جَمْعُ الكُسورِ'))!;
    assert.ok(l, 'the catalog changed');
    const quiz = await service.generateQuiz({ ...mathReq(l), numQuestions: 6 });
    assert.ok(quiz.questions.every(q => /\d\/\d/.test(q.text)), quiz.questions.map(q => q.text).join('\n'));
  });
});
