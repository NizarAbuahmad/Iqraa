/**
 * A textbook figure attached to one worksheet question, by the teacher.
 *
 * Until now figures reached a worksheet only as an appendix after the answer
 * key — the model that wrote the questions never saw the book's figures, so it
 * cannot say which one goes with which item. A teacher can: they pick it from
 * the lesson's own figures, and it prints under that question. These pin where
 * it shows (paper, slides, shared text) and that it survives the edits that
 * should keep it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildWorksheetHTML, buildWorksheetSlidesHTML } from '../exportHtml.ts';
import { formatWorksheetText } from '../exportText.ts';
import {
  applyWorksheetFigure,
  applyWorksheetQuestionEdit,
  applyWorksheetOptionEdit,
  removeWorksheetQuestionAt,
} from '../worksheetEdits.ts';
import { unattachedFigures } from '../worksheetPaper.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';

const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };
const plain = (s: string) => s.replace(/[⁦-⁩‎‏؜]/g, '');

const FIG_A = { uri: 'https://figs.example/g10-m-s1/p045-1.png', page: 45, caption: 'كتاب الطالب · الفصل الأول · صفحة ٤٥' };
const FIG_B = { uri: 'https://figs.example/g10-m-s1/p046-1.png', page: 46, caption: 'كتاب الطالب · الفصل الأول · صفحة ٤٦' };

const sheet = (): WorksheetOutput => ({
  title: 'ورقة',
  instructions: 'أجب.',
  sections: [{
    type: 'mixed',
    title: 'أ) تمارين',
    questions: [
      { text: 'انظر الشكل المجاور، ثم أوجد قياس الزاوية س.', points: 4 },
      { text: 'أوجد حل المعادلة 2^x = 8', options: ['x = 2', 'x = 3'], points: 2 },
    ],
  }],
  answerKey: [{ num: 1, answer: '40°' }, { num: 2, answer: 'x = 3' }],
}) as WorksheetOutput;

const cards = (html: string) => html.split('<div class="q-card">').slice(1);

describe('attaching a figure', () => {
  it('sets it on that question only', () => {
    const ws = applyWorksheetFigure(sheet(), 0, 0, FIG_A);
    assert.deepEqual(ws.sections[0]!.questions[0]!.figure, FIG_A);
    assert.equal(ws.sections[0]!.questions[1]!.figure, undefined);
  });

  it('replaces one already there, and removes it with null', () => {
    let ws = applyWorksheetFigure(sheet(), 0, 0, FIG_A);
    ws = applyWorksheetFigure(ws, 0, 0, FIG_B);
    assert.deepEqual(ws.sections[0]!.questions[0]!.figure, FIG_B);
    ws = applyWorksheetFigure(ws, 0, 0, null);
    assert.ok(!('figure' in ws.sections[0]!.questions[0]!), 'removed figure left a key behind');
  });

  it('leaves the answer key and its working alone', () => {
    const base = sheet();
    base.answerKey[0]!.solution = ['خطوة', 'إذن 40°'];
    const ws = applyWorksheetFigure(base, 0, 0, FIG_A);
    assert.deepEqual(ws.answerKey, base.answerKey);
  });
});

describe('edits keep the figure with its question', () => {
  it('rewording, re-pointing and options', () => {
    const ws = applyWorksheetFigure(sheet(), 0, 0, FIG_A);
    assert.deepEqual(applyWorksheetQuestionEdit(ws, 0, 0, { text: 'نص جديد' }).sections[0]!.questions[0]!.figure, FIG_A);
    assert.deepEqual(applyWorksheetQuestionEdit(ws, 0, 0, { points: 6 }).sections[0]!.questions[0]!.figure, FIG_A);
    const withB = applyWorksheetFigure(ws, 0, 1, FIG_B);
    assert.deepEqual(applyWorksheetOptionEdit(withB, 0, 1, 0, 'x = 1').sections[0]!.questions[1]!.figure, FIG_B);
  });

  it('goes with the question when it is deleted, and stays on the one that moves up', () => {
    let ws = applyWorksheetFigure(sheet(), 0, 1, FIG_B);
    ws = removeWorksheetQuestionAt(ws, 0, 0);
    assert.deepEqual(ws.sections[0]!.questions[0]!.figure, FIG_B);
    ws = removeWorksheetQuestionAt(ws, 0, 0);
    assert.equal(ws.sections.length, 0);
  });
});

describe('the printed paper', () => {
  it('prints the figure inside its own question card, with its book citation', () => {
    const html = plain(buildWorksheetHTML(applyWorksheetFigure(sheet(), 0, 0, FIG_A), 'ورقة', meta, true, [], false));
    const [first, second] = cards(html);
    assert.ok(first!.includes(`<img src="${FIG_A.uri}"`), 'figure not in its card');
    assert.ok(first!.includes(FIG_A.caption), 'no citation');
    assert.ok(!second!.includes('<img'), 'figure leaked into the next card');
  });

  it('prints it before the writing lines, so the student sees it before answering', () => {
    const [first] = cards(buildWorksheetHTML(applyWorksheetFigure(sheet(), 0, 0, FIG_A), 'ورقة', meta, true, [], false));
    assert.ok(first!.indexOf('<img') < first!.indexOf('q-lines'));
  });

  it('drops an attached figure from the appendix, so nothing prints twice', () => {
    const html = buildWorksheetHTML(applyWorksheetFigure(sheet(), 0, 0, FIG_A), 'ورقة', meta, true, [FIG_A, FIG_B], false);
    assert.equal(html.split(FIG_A.uri).length - 1, 1, 'attached figure printed twice');
    assert.equal(html.split(FIG_B.uri).length - 1, 1, 'unattached figure lost from the appendix');
  });

  it('turns ink-saver figures grey and large-print figures bigger', () => {
    const ws = applyWorksheetFigure(sheet(), 0, 0, FIG_A);
    assert.match(buildWorksheetHTML(ws, 'ورقة', meta, true, [], false, 'ink'), /\.q-fig img\s*\{[^}]*grayscale/);
    assert.match(buildWorksheetHTML(ws, 'ورقة', meta, true, [], false, 'large'), /\.q-fig img\s*\{[^}]*max-height/);
  });

  it('is unchanged for a worksheet with no figure attached', () => {
    const html = buildWorksheetHTML(sheet(), 'ورقة', meta, true, [], false);
    assert.ok(!html.includes('class="q-fig"'));
  });
});

describe('the projector slides', () => {
  it('show the figure on that question', () => {
    const html = buildWorksheetSlidesHTML(applyWorksheetFigure(sheet(), 0, 0, FIG_A), 'ورقة', meta, true, [FIG_A], false);
    const [first, second] = cards(html);
    assert.ok(first!.includes(`<img src="${FIG_A.uri}"`));
    assert.ok(!second!.includes('<img'));
    assert.equal(html.split(FIG_A.uri).length - 1, 1, 'attached figure shown twice');
  });
});

describe('the shared text and Word copy', () => {
  it('names the figure under its question, since text cannot carry it', () => {
    const text = formatWorksheetText(applyWorksheetFigure(sheet(), 0, 0, FIG_A), 'ورقة', meta, true, false);
    const lines = text.split('\n');
    const q = lines.findIndex(l => l.includes('انظر الشكل المجاور'));
    assert.ok(q > -1);
    assert.ok(lines[q + 1]!.includes(FIG_A.caption), lines.slice(q, q + 3).join(' | '));
  });
});

describe('unattachedFigures', () => {
  it('keeps the lesson figures no question holds, in order', () => {
    const ws = applyWorksheetFigure(sheet(), 0, 1, FIG_A);
    assert.deepEqual(unattachedFigures(ws, [FIG_A, FIG_B]), [FIG_B]);
    assert.deepEqual(unattachedFigures(sheet(), [FIG_A, FIG_B]), [FIG_A, FIG_B]);
  });
});
