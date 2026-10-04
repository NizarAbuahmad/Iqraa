/**
 * A worksheet opens with a worked example, then a half-solved item, then
 * independent practice — and its key shows the working, not just the answer.
 *
 * The live twin of this structure is the worksheet prompt in
 * `artifacts/api-server/src/lib/prompts.ts` (`worksheetWorkedExample.test.ts`
 * there). The example and the half-solved item sit INSIDE the total the teacher
 * picked: asking for 10 gets one example, one half-solved item and eight
 * practice questions, so the page never outgrows a 45-minute period.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '@/services/ai/AIService.ts';

const EXP = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };
const MOLE = { topic: 'المول والكتلة المولية', subject: 'الكيمياء', grade: 'الصف العاشر' };
const SINES = { topic: 'قانون الجيوب', subject: 'الرياضيات', grade: 'الصف العاشر' };

const squash = (s: string) => s.replace(/[\s،,]+/g, '');
const questions = (w: WorksheetOutput) => w.sections.flatMap(s => s.questions);

function make(base: typeof EXP, over: Partial<AIRequest> = {}) {
  return aiService.generateWorksheet({
    ...base, language: 'arabic', difficulty: 'medium', numQuestions: 10,
    questionTypes: ['multiple_choice', 'short_answer'], ...over,
  } as AIRequest);
}

describe('the worked example', () => {
  it('opens a maths worksheet: a problem, its working, its answer and a self-explanation prompt', async () => {
    const w = await make(EXP);
    const ex = w.workedExample;
    assert.ok(ex, 'no workedExample');
    assert.ok(ex.problem.trim().length > 0);
    assert.ok(ex.steps.length >= 2 && ex.steps.every(l => l.trim().length > 0));
    assert.ok(ex.answer.trim().length > 0);
    assert.ok(ex.selfExplain && ex.selfExplain.trim().length > 0);
    assert.ok(squash(ex.steps.at(-1)!).includes(squash(ex.answer)), 'the last step does not state the answer');
  });

  it('works for a chemistry lesson too', async () => {
    const w = await make(MOLE);
    assert.ok(w.workedExample && w.workedExample.steps.length >= 2);
  });

  it('is in English when the worksheet is, with no Arabic letters in the working', async () => {
    const w = await make(EXP, { language: 'english' });
    assert.ok(w.workedExample);
    for (const line of [...w.workedExample.steps, w.workedExample.selfExplain ?? '']) {
      assert.ok(!/[ء-ي]/.test(line), `Arabic in English working: ${line}`);
    }
  });

  it('never reappears as a practice question', async () => {
    const w = await make(EXP);
    const texts = questions(w).map(q => q.text);
    assert.ok(!texts.some(t => t.includes(w.workedExample!.problem)), 'the studied problem came back as a question');
    assert.equal(new Set(texts).size, texts.length, 'a question appears twice');
  });
});

describe('the student instructions', () => {
  it('tell the class to study the example first, on a line of their own with no stray escape', async () => {
    for (const language of ['arabic', 'english'] as const) {
      const w = await make(EXP, { language });
      assert.ok(w.workedExample);
      assert.ok(!w.instructions.includes('\\n'), `${language}: a literal backslash-n leaked into the instructions`);
      const line = w.instructions.split('\n').find(l => (language === 'arabic' ? l.includes('المثال المحلول') : l.includes('worked example')));
      assert.ok(line && line.startsWith('•'), `${language}: no bullet about the worked example`);
    }
  });

  it('do not mention an example the sheet does not have', async () => {
    const hw = await aiService.generateHomework({ ...EXP, language: 'arabic', difficulty: 'medium' } as AIRequest);
    assert.ok(!hw.instructions.includes('المثال المحلول'));
  });
});

describe('the half-solved question', () => {
  it('is the first question of the first section, with its first steps written and blanks for the rest', async () => {
    const w = await make(EXP);
    const first = w.sections[0]!.questions[0]!;
    assert.match(first.text, /أكمل الحل/);
    const blanks = first.text.match(/__________/g) ?? [];
    const full = w.answerKey[0]!.solution!;
    assert.ok(blanks.length >= 1 && blanks.length < full.length, 'blanks must be fewer than the full working');
    // The lines it gives are the opening lines of the key's working, and the result is withheld.
    const given = full.length - blanks.length;
    for (const line of full.slice(0, given)) assert.ok(first.text.includes(line), `given step missing: ${line}`);
    assert.ok(!first.text.includes(full.at(-1)!), 'the result line must not be handed over');
  });

  it('keeps the A/B/C lettering of the practice sections', async () => {
    const w = await make(EXP);
    const titles = w.sections.map(s => s.title);
    assert.ok(titles.some(t => t.startsWith('أ)')) && titles.some(t => t.startsWith('ب)')));
    assert.ok(!w.sections[0]!.title.startsWith('أ)'), 'the completion section must not take the letter A');
  });
});

describe('the answer key shows the working', () => {
  it('carries a solution for every question drawn from a solved item', async () => {
    const w = await make(EXP);
    assert.equal(w.answerKey.length, questions(w).length);
    for (const row of w.answerKey) assert.ok(row.solution && row.solution.length >= 2, `row ${row.num} has no working`);
  });

  it('ends each solution on the key\'s own answer for a short-answer paper', async () => {
    const w = await make(EXP, { questionTypes: ['short_answer'] });
    for (const row of w.answerKey) {
      assert.ok(squash(row.solution!.at(-1)!).includes(squash(row.answer)), `row ${row.num}: «${row.solution!.at(-1)}» vs «${row.answer}»`);
    }
  });
});

describe('the total the teacher picked', () => {
  it('counts the example and the half-solved question inside it', async () => {
    for (const n of [5, 10]) {
      const w = await make(EXP, { numQuestions: n });
      assert.equal(questions(w).length + (w.workedExample ? 1 : 0), n, `asked ${n}`);
    }
  });

  it('degrades to a short paper on a thin bank without repeating anything', async () => {
    // «قانون الجيوب» has three items in total: one to study, one to finish, one to practise.
    const w = await make(SINES, { numQuestions: 12 });
    const total = questions(w).length + (w.workedExample ? 1 : 0);
    assert.ok(total <= 3, `${total} items from a 3-item bank`);
    const texts = questions(w).map(q => q.text);
    assert.equal(new Set(texts).size, texts.length);
  });
});

describe('homework is not a worksheet', () => {
  it('has no worked example', async () => {
    const hw = await aiService.generateHomework({ ...EXP, language: 'arabic', difficulty: 'medium' } as AIRequest);
    assert.equal(hw.workedExample, undefined);
  });
});
