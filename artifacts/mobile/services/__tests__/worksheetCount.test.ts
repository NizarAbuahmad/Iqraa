/**
 * A worksheet or homework holds the number of questions the teacher picked, of
 * the types they ticked — or says it could not.
 *
 * The homework generator ignored both: it always built three short-answer
 * questions, a challenge and a reflection, so asking for 8, 15 or 20 gave 5,
 * and ticking true/false gave short answers. The worksheet already counted
 * (its worked example sits INSIDE the number), and these pin that too.
 *
 * Asserts properties, not bank sizes: the banks grow as items are added.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '../ai/AIService.ts';

const CHEM = { topic: 'الروابط الأيونية', subject: 'الكيمياء', grade: 'الصف العاشر' };
const MATH = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };

const req = (lesson: typeof CHEM, numQuestions: number | undefined, questionTypes?: string[]) =>
  ({ ...lesson, language: 'arabic', difficulty: 'medium', numQuestions, questionTypes }) as AIRequest;

const homework = (lesson: typeof CHEM, n: number | undefined, types?: string[]) => aiService.generateHomework(req(lesson, n, types));
const worksheet = (lesson: typeof CHEM, n: number, types?: string[]) => aiService.generateWorksheet(req(lesson, n, types));

const count = (w: WorksheetOutput) => w.sections.reduce((s, x) => s + x.questions.length, 0);
const isTrueFalse = (q: { options?: string[] }) => q.options?.length === 2;

describe('homework', () => {
  it('holds the number the teacher picked', async () => {
    for (const n of [5, 8, 12, 15]) {
      const w = await homework(MATH, n, ['short_answer']);
      assert.equal(count(w), n, `asked ${n}, got ${count(w)}`);
      assert.equal(w.shortfall, undefined);
    }
  });

  it('keeps the old five for the smallest pick, and for a caller that sends no count', async () => {
    for (const n of [5, undefined]) {
      const w = await homework(MATH, n);
      assert.equal(count(w), 5);
      // Three practice questions, the challenge and the reflection — all written answers.
      assert.deepEqual(w.sections.map(s => s.questions.length), [3, 1, 1]);
      assert.ok(w.sections[0]!.questions.every(q => !q.options && q.points === 8));
    }
  });

  it('uses the question types that were ticked', async () => {
    const tf = await homework(MATH, 8, ['true_false']);
    assert.ok(tf.sections[0]!.questions.every(isTrueFalse), 'a true/false homework has a question that is not');
    assert.equal(tf.sections[0]!.type, 'true_false');

    const mcq = await homework(MATH, 8, ['multiple_choice']);
    assert.ok(mcq.sections[0]!.questions.every(q => (q.options?.length ?? 0) >= 3));

    const mixed = await homework(MATH, 12, ['multiple_choice', 'true_false', 'short_answer']);
    assert.equal(mixed.sections[0]!.type, 'mixed');
    const kinds = new Set(mixed.sections[0]!.questions.map(q => (isTrueFalse(q) ? 'tf' : q.options ? 'mcq' : 'open')));
    assert.deepEqual([...kinds].sort(), ['mcq', 'open', 'tf']);
  });

  it('gives a written question room to write and a choice none', async () => {
    const w = await homework(MATH, 8, ['multiple_choice', 'short_answer']);
    for (const q of w.sections[0]!.questions) {
      const hasSpace = /_{10,}/.test(q.text);
      assert.equal(hasSpace, !q.options, `${q.options ? 'a choice' : 'a written question'} has the wrong writing room`);
    }
  });

  it('keeps the answer key one entry per question, numbered straight through', async () => {
    const w = await homework(MATH, 12, ['multiple_choice', 'short_answer']);
    assert.deepEqual(w.answerKey.map(k => k.num), Array.from({ length: count(w) }, (_, i) => i + 1));
  });

  it('says so when the lesson cannot supply what was asked, and not otherwise', async () => {
    const big = await homework(CHEM, 20, ['multiple_choice', 'short_answer']);
    assert.ok(count(big) < 20, 'a chemistry lesson was expected to run out');
    assert.deepEqual(big.shortfall, { requested: 20, produced: count(big) });
    assert.ok(count(big) >= 3, 'the challenge and the reflection are always there');
  });
});

describe('worksheet', () => {
  it('counts its worked example inside the number picked', async () => {
    for (const n of [8, 12]) {
      const w = await worksheet(MATH, n, ['short_answer', 'multiple_choice']);
      assert.ok(w.workedExample, 'a maths lesson with a worked example was expected');
      assert.equal(count(w) + 1, n, `asked ${n}: ${count(w)} questions + the example`);
    }
  });

  it('reports a shortfall when it ran dry, and the produced count is honest', async () => {
    // 30 is the most a paper can ask for and more than any chemistry family holds, so the bank has to run dry.
    const w = await worksheet(CHEM, 30, ['short_answer']);
    assert.ok(w.shortfall, 'a chemistry lesson was expected to run out');
    const produced = count(w) + (w.workedExample ? 1 : 0);
    assert.equal(w.shortfall!.requested, 30);
    assert.equal(w.shortfall!.produced, produced);
  });
});
