/**
 * A teacher who asks for 20 questions of the types they ticked must get as
 * many of each as the lesson can supply — and be told when it cannot supply 20.
 *
 * Reported: "I asked for 20 and never get more than 10". The offline generator
 * draws from a finite per-lesson bank (5 items for a chemistry lesson, 17 for a
 * maths family), and when the ministry-block ordering arrived, a type whose
 * bank ran dry ended the whole paper, so a 15-question chemistry quiz of all
 * three types came back as 5 multiple-choice questions and nothing else.
 *
 * Asserts properties, not bank sizes: the banks grow as items are added.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';

const CHEM = { topic: 'الروابط الأيونية', subject: 'الكيمياء', grade: 'الصف العاشر' };
const MATH = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };
const ALL3 = ['multiple_choice', 'true_false', 'short_answer'];

const quiz = (lesson: typeof CHEM, numQuestions: number, questionTypes: string[]): Promise<QuizOutput> =>
  aiService.generateQuiz({
    ...lesson, language: 'arabic', totalMarks: 20, duration: 20, difficulty: 'medium', numQuestions, questionTypes,
  } as AIRequest);

describe('a short bank', () => {
  it('never makes a requested type disappear', async () => {
    for (const lesson of [CHEM, MATH]) {
      const q = await quiz(lesson, 20, ALL3);
      const present = new Set(q.questions.map(x => x.type));
      assert.ok(q.questions.length >= ALL3.length, `${lesson.subject}: only ${q.questions.length} questions`);
      for (const t of ALL3) assert.ok(present.has(t as never), `${lesson.subject}: no ${t} among ${[...present]}`);
    }
  });

  it('shares what it has evenly between the types', async () => {
    const q = await quiz(CHEM, 15, ALL3);
    const counts = ALL3.map(t => q.questions.filter(x => x.type === t).length);
    assert.ok(Math.max(...counts) - Math.min(...counts) <= 1, `uneven split ${counts}`);
  });

  it('says so when it cannot supply what was asked, and not otherwise', async () => {
    const big = await quiz(CHEM, 20, ALL3);
    if (big.questions.length < 20) {
      assert.deepEqual(big.shortfall, { requested: 20, produced: big.questions.length });
    }
    const small = await quiz(MATH, 5, ['multiple_choice']);
    assert.equal(small.questions.length, 5);
    assert.equal(small.shortfall, undefined);
  });

  it('still prints in ministry blocks and numbers the questions straight through', async () => {
    const q = await quiz(MATH, 20, ALL3);
    const types = q.questions.map(x => x.type);
    const runs = types.filter((t, i) => t !== types[i - 1]);
    assert.deepEqual(runs, ['multiple_choice', 'true_false', 'short_answer'], `interleaved: ${types}`);
    assert.deepEqual(q.questions.map(x => x.id), q.questions.map((_, i) => `q${i + 1}`));
  });

  it('keeps the marks adding up to the total however many questions it found', async () => {
    for (const n of [5, 15, 20]) {
      const q = await quiz(CHEM, n, ALL3);
      assert.equal(q.questions.reduce((s, x) => s + x.points, 0), 20, `n=${n}`);
      assert.equal(q.totalPoints, 20);
    }
  });
});

describe('a single type', () => {
  it('gets every question the bank can give it', async () => {
    for (const t of ['multiple_choice', 'true_false', 'short_answer', 'fill_blank']) {
      const q = await quiz(MATH, 15, [t]);
      assert.equal(q.questions.length, 15, `${t}: ${q.questions.length}`);
      assert.ok(q.questions.every(x => x.type === t));
    }
  });
});
