/**
 * The worked example and the key's working have to reach every place a
 * worksheet is shown — the printed page, the shared text, the slide export and
 * the live class deck — in the right half.
 *
 * Student half: the worked example. It is for studying, so it is on the copy a
 * teacher hands out, the key excluded.
 * Teacher half: each question's working. It must not appear anywhere a teacher
 * has chosen to share without answers.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildLessonFlowHTML, buildWorksheetHTML, buildWorksheetSlidesHTML } from '../exportHtml.ts';
import { formatWorksheetText } from '../exportText.ts';
import { buildDeckFromWorksheet } from '../classDeck.ts';
import type { LessonFlowOutput, WorksheetOutput } from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

/** `esc` wraps every math run in invisible bidi isolates; strip them to compare words. */
const plainHtml = (html: string) => html.replace(/[\u2066-\u2069\u200e\u200f\u061c]/g, '');

const withExample = (): WorksheetOutput => ({
  title: 'ورقة عمل',
  instructions: 'ادرس المثال المحلول أولًا.',
  workedExample: {
    problem: 'حل المعادلة 2^(x+1) = 32',
    steps: ['نكتب 32 = 2^5', 'نساوي الأسس: x + 1 = 5', 'إذن x = 4'],
    answer: 'x = 4',
    selfExplain: 'اشرح بجملة: لماذا يجوز مساواة الأسس؟',
  },
  sections: [
    { type: 'short_answer', title: 'مثال نكمله', questions: [{ text: 'حل 3^x = 9\n\nأكمل الحل:\n1) نكتب 9 = 3^2\n2) __________', points: 6 }] },
    { type: 'mixed', title: 'أ) تمارين تمهيدية', questions: [{ text: 'أوجد x إذا كان 5^x = 25', points: 4 }] },
  ],
  answerKey: [
    { num: 1, answer: 'x = 2', solution: ['نكتب 9 = 3^2', 'نساوي الأسس', 'إذن x = 2'] },
    { num: 2, answer: 'x = 2', solution: ['خطوة أولى مميزة', 'إذن x = 2'] },
  ],
}) as unknown as WorksheetOutput;

const plain = (): WorksheetOutput => ({
  instructions: 'أجب.',
  sections: [{ title: 'القسم', questions: [{ text: 'س؟', points: 2 }] }],
  answerKey: [{ num: 1, answer: 'ج' }],
}) as unknown as WorksheetOutput;

describe('printed worksheet', () => {
  it('shows the worked example before the first section', () => {
    const html = plainHtml(buildWorksheetHTML(withExample(), 'ورقة', meta, true));
    assert.ok(html.includes('مثال محلول'));
    const at = (needle: string) => html.indexOf(needle);
    assert.ok(at('حل المعادلة') > -1 && at('حل المعادلة') < at('مثال نكمله'), 'example must precede the first section');
    for (const step of ['نكتب 32', 'نساوي الأسس: x + 1', 'اشرح بجملة']) assert.ok(html.includes(step), step);
  });

  it('keeps the worked example on the student copy, where the key is left out', () => {
    const html = plainHtml(buildWorksheetHTML(withExample(), 'ورقة', meta, true, [], false));
    assert.ok(html.includes('مثال محلول') && html.includes('نكتب 32'));
  });

  it('shows each question\'s working in the key, and only in the key', () => {
    const teacher = buildWorksheetHTML(withExample(), 'ورقة', meta, true, [], true);
    const student = buildWorksheetHTML(withExample(), 'ورقة', meta, true, [], false);
    assert.ok(teacher.includes('خطوة أولى مميزة'));
    assert.ok(!student.includes('خطوة أولى مميزة'), 'the working leaked into the student copy');
    assert.ok(!student.includes('class="answer-key"'));
  });

  it('puts the key on its own page so the paper can be printed without it', () => {
    const teacher = buildWorksheetHTML(withExample(), 'ورقة', meta, true, [], true);
    assert.match(teacher, /class="key-page"[\s\S]*class="answer-key"/);
    assert.match(teacher, /\.key-page\s*\{[^}]*break-before:\s*page/);
    const student = buildWorksheetHTML(withExample(), 'ورقة', meta, true, [], false);
    assert.ok(!student.includes('class="key-page"'));
  });

  it('is unchanged for a worksheet with no example and no working', () => {
    const html = buildWorksheetHTML(plain(), 'ورقة', meta, true);
    assert.ok(!html.includes('class="worked'));
    assert.ok(html.includes('class="answer-key"'));
  });

  it('is in English when asked', () => {
    const en = withExample();
    const html = buildWorksheetHTML(en, 'Sheet', { subject: 'Math', grade: 'Grade 10' }, false);
    assert.ok(html.includes('Worked example'));
  });
});

describe('shared text', () => {
  it('lists the worked example before the first section', () => {
    const text = formatWorksheetText(withExample(), 'ورقة', meta, true);
    assert.ok(text.indexOf('حل المعادلة') > -1 && text.indexOf('حل المعادلة') < text.indexOf('مثال نكمله'));
    assert.match(text, /1\.\s*نكتب 32/);
  });

  it('prints the working under each answer, and drops it with the key', () => {
    const withKey = formatWorksheetText(withExample(), 'ورقة', meta, true, true);
    const without = formatWorksheetText(withExample(), 'ورقة', meta, true, false);
    assert.ok(withKey.includes('خطوة أولى مميزة'));
    assert.ok(!without.includes('خطوة أولى مميزة'));
    assert.ok(without.includes('حل المعادلة'), 'the student copy keeps the example');
  });
});

describe('slide export', () => {
  it('gives the worked example its own slide ahead of the questions', () => {
    const html = buildWorksheetSlidesHTML(withExample(), 'ورقة', meta, true, [], false);
    assert.ok(html.includes('مثال محلول'));
    assert.ok(html.indexOf('حل المعادلة') < html.indexOf('مثال نكمله'));
  });

  it('counts that slide in the footer total', () => {
    for (const includeAnswers of [true, false]) {
      const html = buildWorksheetSlidesHTML(withExample(), 'ورقة', meta, true, [], includeAnswers);
      const slides = (html.match(/<div class="slide[ "]/g) ?? []).length;
      const totals = [...html.matchAll(/<span>\d+ \/ (\d+)<\/span>/g)].map(m => Number(m[1]));
      assert.ok(totals.length > 0);
      assert.ok(totals.every(t => t === slides), `footer totals ${[...new Set(totals)]} vs ${slides} slides (answers ${includeAnswers})`);
    }
  });
});

describe('class deck', () => {
  it('opens with a worked-example slide that is not a question', () => {
    const deck = buildDeckFromWorksheet(withExample(), 'الأسس', true);
    const example = deck.slides.find(s => s.title.includes('مثال محلول'));
    assert.ok(example, 'no worked-example slide');
    assert.equal(example!.type, 'intro');
    assert.ok(example!.content.includes('حل المعادلة') && example!.content.includes('نكتب 32'));
    const firstQuestion = deck.slides.findIndex(s => s.type === 'question' || s.type === 'challenge');
    assert.ok(deck.slides.indexOf(example!) < firstQuestion);
  });

  it('numbers the questions as before, so verification outcomes still line up', () => {
    const deck = buildDeckFromWorksheet(withExample(), 'الأسس', true);
    const qs = deck.slides.filter(s => s.type === 'question' || s.type === 'challenge');
    assert.deepEqual(qs.map(s => s.title), ['سؤال 1', 'سؤال 2']);
  });

  it('gives the teacher the working in the companion panel', () => {
    const deck = buildDeckFromWorksheet(withExample(), 'الأسس', true);
    const q2 = deck.slides.find(s => s.title === 'سؤال 2')!;
    assert.ok(q2.teacher?.teachingTips?.includes('خطوة أولى مميزة'));
  });

  it('is unchanged for a worksheet with no example', () => {
    const deck = buildDeckFromWorksheet(plain(), 'الأسس', true);
    assert.ok(!deck.slides.some(s => s.title.includes('مثال محلول')));
  });
});

describe('lesson-flow package', () => {
  it('prints the worksheet\'s worked example along with its questions', () => {
    const flow = { topic: 'الأسس', grade: 'الصف العاشر', subject: 'الرياضيات', duration: 45, objectives: ['هدف'],
      warmup: { title: 'w', steps: [], materials: [], teacherTips: [] }, activity: { title: 'a', steps: [], materials: [], teacherTips: [] },
      guidedPractice: 'تدريب', worksheet: withExample(), exitTicket: { title: 'e', questions: [] } } as unknown as LessonFlowOutput;
    const html = plainHtml(buildLessonFlowHTML(flow, true));
    assert.ok(html.includes('مثال محلول') && html.includes('نكتب 32'), 'the flow document dropped the worked example');
    assert.ok(html.indexOf('حل المعادلة') < html.indexOf('أوجد x إذا كان'), 'the example must come before the questions');
  });
});

describe('a half-solved question keeps its line breaks on paper', () => {
  // The first steps are written on separate lines and the blanks follow; run
  // together they read as one sentence with underscores in it.
  const halfSolved = (): WorksheetOutput => ({
    instructions: 'أجب.',
    sections: [{ title: 'مثال نكمله', questions: [{
      text: 'حل 3^x = 9\n\nأكمل الحل:\n1) نكتب 9 = 3^2\n2) __________\n3) __________\n\nالإجابة:\n_________________________________\n_________________________________',
      points: 6,
    }] }],
    answerKey: [{ num: 1, answer: 'x = 2' }],
  }) as unknown as WorksheetOutput;

  it('prints a question\'s own line breaks, in the worksheet only', () => {
    const html = buildWorksheetHTML(halfSolved(), 'ورقة', meta, true);
    assert.match(html, /\.q-break\s*\{[^}]*white-space:\s*pre-line/);
    assert.match(html, /class="q-text q-break"/);
  });

  it('does not print the generator\'s answer-space suffix where ruled lines are drawn anyway', () => {
    const html = plainHtml(buildWorksheetHTML(halfSolved(), 'ورقة', meta, true));
    assert.ok(!html.includes('الإجابة:'), 'the suffix would be printed on top of the ruled lines');
    assert.ok(html.includes('class="q-lines"'), 'the ruled lines are still drawn');
  });

  it('keeps the numbered blanks the student fills in', () => {
    const html = plainHtml(buildWorksheetHTML(halfSolved(), 'ورقة', meta, true));
    assert.ok(html.includes('2) __________') && html.includes('3) __________'));
    assert.ok(html.includes('أكمل الحل:'));
  });

  it('does the same on the slide export', () => {
    const html = buildWorksheetSlidesHTML(halfSolved(), 'ورقة', meta, true, [], false);
    assert.match(html, /\.q-break\s*\{[^}]*white-space:\s*pre-line/);
    assert.ok(!plainHtml(html).includes('الإجابة:'));
    assert.ok(plainHtml(html).includes('2) __________'));
  });

  it('leaves a quiz\'s questions as they were', () => {
    // The quiz builder shares the `.q-text` class; this change is the worksheet\'s alone.
    const css = buildWorksheetHTML(plain(), 'ورقة', meta, true);
    assert.ok(!/\.q-text\s*\{[^}]*pre-line/.test(css), '.q-text itself must not change');
  });
});
