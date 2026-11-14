/**
 * Three things a 2026-11-13 read of offline worksheets found, as a teacher
 * would see them on the page:
 *
 * 1. A «قانون الجيوب» worksheet opened with a law-of-cosines worked example —
 *    the next lesson. The worked example and the half-solved question are the
 *    lesson's own, or there are none.
 * 2. The «مسألة حياتية» section held «أوجد حل المعادلة: 8^x = 4^{x+1}», while
 *    the bacteria story sat in the challenge section as a multiple-choice
 *    question still saying «اكتب المعادلة وحلّها». The section holds a story;
 *    a lesson with none left says so instead of printing an equation under
 *    that heading.
 * 3. One equation came twice (9^x = 27, asked «هل x = 2 حل…» and «أوجد
 *    الحل»), and the half-solved question printed «81 = 3^4» above question 3,
 *    «اكتب العدد 81 على صورة قوة أساسها 3».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '../ai/AIService.ts';

const G10 = { subject: 'الرياضيات', grade: 'الصف العاشر', language: 'arabic', difficulty: 'medium' } as const;
const make = (topic: string, numQuestions: number, questionTypes: string[]) =>
  aiService.generateWorksheet({ ...G10, topic, numQuestions, questionTypes } as AIRequest);

const questions = (w: WorksheetOutput) => w.sections.flatMap(s => s.questions);
const RUNS = 6;

describe('the worked example belongs to the lesson', () => {
  it('a «قانون الجيوب» worksheet never studies or half-solves the law of cosines', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('قانون الجيوب', 8, ['multiple_choice', 'short_answer']);
      if (w.workedExample) assert.doesNotMatch(w.workedExample.problem, /جيب التمام|المساحة|مساحة/, w.workedExample.problem);
      const half = w.sections.find(s => s.title === 'مثال نكمله');
      if (half) assert.doesNotMatch(half.questions[0]!.text, /جيب التمام|مساحة/, half.questions[0]!.text);
    }
  });
});

describe('«قانون الجيوب» fills its own paper', () => {
  it('eight questions, all on the law of sines, with its own real-life problem', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('قانون الجيوب', 8, ['multiple_choice', 'short_answer', 'word_problem']);
      assert.equal(w.shortfall, undefined, JSON.stringify(w.shortfall));
      assert.equal(w.missingFormats, undefined);
      const all = [w.workedExample!.problem, ...questions(w).map(q => q.text)];
      for (const t of all) assert.doesNotMatch(t, /جيب التمام|المساحة/, t);
      assert.ok(w.sections.some(s => s.title === 'مثال نكمله'), 'no half-solved question');
      assert.match(w.sections.find(s => s.type === 'word_problem')!.questions[0]!.text, /نهر/);
    }
  });

  it('the instructions promise a half-solved question only when there is one', async () => {
    // «الاقتران العكسي» has one solved item of its own: a worked example and no «مثال نكمله».
    const w = await make('الاقتران العكسي', 6, ['short_answer']);
    assert.ok(w.workedExample, 'the lesson has a worked example');
    assert.ok(!w.sections.some(s => s.title === 'مثال نكمله'));
    assert.doesNotMatch(w.instructions, /أكمل الحل/);
  });
});

describe('«قانون جيب التمام» studies its own law', () => {
  it('the worked example, the half-solved question and the real-life problem are all the law of cosines', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('قانون جيب التمام', 8, ['multiple_choice', 'short_answer', 'word_problem']);
      assert.ok(w.workedExample, 'no worked example');
      assert.doesNotMatch(w.workedExample.problem, /قانون الجيوب|المساحة/, w.workedExample.problem);
      const half = w.sections.find(s => s.title === 'مثال نكمله');
      assert.ok(half, 'no half-solved question');
      assert.doesNotMatch(half.questions[0]!.text, /قانون الجيوب|المساحة/, half.questions[0]!.text);
      assert.match(w.sections.find(s => s.type === 'word_problem')!.questions[0]!.text, /سفينت/);
    }
  });
});

describe('«مسألة حياتية» is a story', () => {
  it('holds the lesson\'s story, never a bare equation', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('المعادلات الأسية', 10, ['multiple_choice', 'short_answer', 'word_problem']);
      const life = w.sections.find(s => s.type === 'word_problem');
      assert.ok(life, 'the ticked word problem is on the paper');
      assert.equal(life.title, 'مسألة حياتية');
      assert.doesNotMatch(life.questions[0]!.text, /^أوجد حل/, life.questions[0]!.text);
      assert.ok(!('story' in life.questions[0]!), 'the bank flag does not reach the saved paper');
    }
  });

  it('a story set as multiple choice does not ask the student to write and solve', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('المعادلات الأسية', 12, ['multiple_choice']);
      for (const q of questions(w)) {
        if (q.options) assert.doesNotMatch(q.text, /اكتب (?:ال)?معادلة/, q.text);
      }
    }
  });

  it('a lesson with no story says so instead of heading an equation «مسألة حياتية»', async () => {
    const w = await make('المتتاليات', 6, ['short_answer', 'word_problem']);
    assert.ok(!w.sections.some(s => s.title === 'مسألة حياتية'), 'an equation under the real-life heading');
    assert.ok(w.missingFormats?.includes('word_problem'), 'the teacher is not told the story is missing');
  });
});

describe('one equation, one question', () => {
  it('never asks the same equation twice, nor what the printed working already shows', async () => {
    for (let k = 0; k < RUNS; k++) {
      const w = await make('المعادلات الأسية', 12, ['multiple_choice', 'short_answer', 'fill_blank']);
      const texts = [...(w.workedExample ? [w.workedExample.problem] : []), ...questions(w).map(q => q.text)];
      const nine = texts.filter(t => /9\^x = 27(?![0-9])/.test(t) && !/^صِل/.test(t));
      assert.ok(nine.length <= 1, nine.join('\n---\n'));

      // What the worked example and the half-solved question print, against the
      // questions after them (either of the two may itself be the «81» item).
      const half = w.sections.find(s => s.title === 'مثال نكمله')?.questions[0];
      const printed = [...(w.workedExample?.steps ?? []), ...(half?.text.split('\n') ?? [])].join('\n');
      const after = questions(w).filter(q => q !== half).map(q => q.text);
      if (/81 = 3\^4/.test(printed)) {
        assert.ok(!after.some(t => t.startsWith('اكتب العدد 81 على صورة قوة أساسها 3')), 'Q asks what the half-solved working printed');
      }
    }
  });
});
