/**
 * A print style for the papers students hold — worksheet and quiz.
 *
 * Ink-saver exists because the printed page was designed on screen: grey
 * question cards, tinted section bands, solid number badges and colour emoji,
 * all of which a school's black-and-white copier turns into grey blocks.
 * Large print is the same paper at a size a weak-sighted or young student can
 * read. Colour is today's page and must stay exactly that.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildQuizHTML, buildWorksheetHTML } from '../exportHtml.ts';
import { worksheetExports } from '../worksheetExport.ts';
import { quizExports } from '../quizExport.ts';
import { parsePrintStyle, PRINT_STYLES } from '../printStyle.ts';
import type { QuizOutput, WorksheetOutput } from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

const ws = {
  title: 'ورقة عمل',
  instructions: 'أجب.',
  sections: [{ type: 'mixed', title: 'أ) تمارين', questions: [
    { text: 'أوجد حل المعادلة: 3^(2x) = 81', points: 4 },
    { text: 'العبارة 2^0 = 1 صحيحة.', options: ['صح', 'خطأ'], points: 2 },
  ] }],
  answerKey: [{ num: 1, answer: 'x = 2' }, { num: 2, answer: 'صح' }],
} as WorksheetOutput;

const quiz = {
  title: 'اختبار',
  duration: 20,
  totalPoints: 4,
  questions: [
    { id: 'q1', type: 'multiple_choice', text: 'ما قيمة 2^3؟', options: ['6', '8'], correctAnswer: '8', points: 2, explanation: '' },
    { id: 'q2', type: 'short_answer', text: 'حل 5^x = 25', correctAnswer: 'x = 2', points: 2, explanation: '' },
  ],
} as QuizOutput;

/** The declarations a style adds for one selector, after the base sheet. */
function overrideOf(html: string, selector: string): string {
  const at = html.indexOf('/* print-style:');
  assert.ok(at > -1, 'no print-style block');
  const block = html.slice(at, html.indexOf('</style>', at));
  const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const m = new RegExp(`(?:^|[\\s,}])${esc}\\s*(?:,[^{]*)?\\{([^}]*)\\}`, 'm').exec(block);
  return m?.[1] ?? '';
}
const px = (decls: string, prop: string) => Number(new RegExp(`${prop}:\\s*([\\d.]+)px`).exec(decls)?.[1] ?? NaN);

describe('colour is today\'s page', () => {
  it('adds nothing when no style is asked for, or colour is', () => {
    const plain = buildWorksheetHTML(ws, 'ورقة', meta, true, [], false);
    assert.equal(buildWorksheetHTML(ws, 'ورقة', meta, true, [], false, 'colour'), plain);
    assert.ok(!plain.includes('/* print-style:'));
    assert.equal(buildQuizHTML(quiz, 'اختبار', meta, true, [], false, 'colour'), buildQuizHTML(quiz, 'اختبار', meta, true, [], false));
  });
});

describe('ink-saver', () => {
  for (const [name, html] of [
    ['worksheet', () => buildWorksheetHTML(ws, 'ورقة', meta, true, [], true, 'ink')],
    ['quiz', () => buildQuizHTML(quiz, 'اختبار', meta, true, [], true, 'ink')],
  ] as const) {
    it(`leaves no tinted block on the ${name}`, () => {
      const page = html();
      for (const sel of ['.q-card', '.sec-band', '.school-header', '.callout', '.worked', '.answer-key', '.marks-table th', '.q-type']) {
        assert.match(overrideOf(page, sel), /background:\s*(?:#fff\b|#ffffff\b|none|transparent)/, sel);
      }
    });

    it(`draws the ${name}'s number badges as outlines, not solid fills`, () => {
      const badge = overrideOf(html(), '.q-num');
      assert.match(badge, /background:\s*(?:#fff\b|none|transparent)/);
      assert.match(badge, /border:\s*[\d.]+px solid/);
    });

    it(`drops the ${name}'s emoji, which print as grey smudges`, () => {
      assert.match(overrideOf(html(), '.sec-icon'), /display:\s*none/);
    });

    it(`darkens the ${name}'s writing lines so a copier keeps them`, () => {
      assert.match(overrideOf(html(), '.q-rule'), /border-bottom:\s*1px solid #(?:[0-6]{3}|(?:[0-6][0-9a-f]){3})\b/i);
    });
  }

  it('makes the section bands and accent text black', () => {
    const page = buildWorksheetHTML(ws, 'ورقة', meta, true, [], false, 'ink');
    assert.match(overrideOf(page, '.sec-label'), /color:\s*#111/);
  });
});

describe('large print', () => {
  for (const [name, html] of [
    ['worksheet', () => buildWorksheetHTML(ws, 'ورقة', meta, true, [], false, 'large')],
    ['quiz', () => buildQuizHTML(quiz, 'اختبار', meta, true, [], false, 'large')],
  ] as const) {
    it(`sets the ${name}'s questions at 16px or more`, () => {
      assert.ok(px(overrideOf(html(), '.q-text'), 'font-size') >= 16);
      assert.ok(px(overrideOf(html(), '.q-option'), 'font-size') >= 15);
    });

    it(`leaves no small print on the ${name}'s labels`, () => {
      assert.ok(px(overrideOf(html(), '.q-pts'), 'font-size') >= 13);
      assert.ok(px(overrideOf(html(), '.doc-meta'), 'font-size') >= 14);
    });

    it(`gives the ${name} taller writing lines and bigger badges`, () => {
      assert.ok(px(overrideOf(html(), '.q-rule'), 'height') >= 28);
      assert.ok(px(overrideOf(html(), '.q-num'), 'height') >= 28);
    });
  }
});

describe('the export bundles carry the style', () => {
  it('worksheet', () => {
    assert.ok(worksheetExports(ws, 'ورقة', meta, true, 'student', [], 'ink').html.includes('/* print-style: ink */'));
    assert.ok(!worksheetExports(ws, 'ورقة', meta, true, 'student').html.includes('/* print-style:'));
  });

  it('quiz', () => {
    assert.ok(quizExports(quiz, 'اختبار', meta, true, 'student', [], 'large').html.includes('/* print-style: large */'));
  });
});

describe('a remembered style', () => {
  it('reads back every style it can store', () => {
    for (const style of PRINT_STYLES) assert.equal(parsePrintStyle(style), style);
  });

  it('falls back to colour for anything else', () => {
    for (const raw of [null, undefined, '', 'bright', '{"x":1}']) assert.equal(parsePrintStyle(raw), 'colour');
  });
});
