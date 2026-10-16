/**
 * The AI-written-working note on the surfaces that carry worksheet working
 * besides the screen and the printed paper: the text export, the slide export
 * and the live class deck.
 *
 * Rule (same as the printed key, `worksheetWorking.test.ts`): the note belongs
 * to the teacher's side, never to what the class or the students read. It shows
 * only where unreviewed working is present, and a bank worksheet never gets it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import { keyWorkingNote } from '@/services/worksheetWorking.ts';
import { formatWorksheetText } from '@/services/exportText.ts';
import { buildWorksheetSlidesHTML } from '@/services/exportHtml.ts';
import { buildDeckFromWorksheet } from '@/services/classDeck.ts';
import type { AIRequest, WorksheetOutput } from '@/services/ai/AIService.ts';

const META = { subject: 'الرياضيات', grade: 'الصف العاشر' };

/** Shaped the way the live path returns it: no `fromBank` anywhere. */
function liveWorksheet(): WorksheetOutput {
  return {
    title: 't', instructions: 'i',
    workedExample: { problem: '2^x = 8', steps: ['8 = 2^3', 'x = 3'], answer: 'x = 3' },
    sections: [{ type: 'short_answer', title: 'a', questions: [
      { text: 'q1', answer: 'x = 1', points: 2 },
      { text: 'q2', answer: 'x = 2', points: 2 },
    ] }],
    answerKey: [
      { num: 1, answer: 'x = 1', solution: ['2^x = 2^1', 'x = 1'] },
      { num: 2, answer: 'x = 2' },
    ],
  } as WorksheetOutput;
}

function bankWorksheet() {
  return aiService.generateWorksheet({
    topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر',
    language: 'arabic', difficulty: 'medium', numQuestions: 10,
    questionTypes: ['multiple_choice', 'short_answer'],
  } as AIRequest);
}

const AR = keyWorkingNote(true);
const EN = keyWorkingNote(false);

describe('keyWorkingNote', () => {
  it('is one sentence per language and names AI and review', () => {
    assert.match(AR, /الذكاء الاصطناعي/);
    assert.match(AR, /يراجعها/);
    assert.match(EN, /AI/);
    assert.match(EN, /reviewed/);
  });
});

describe('text export', () => {
  it('puts the note at the head of the answer key when the key has AI working', () => {
    const txt = formatWorksheetText(liveWorksheet(), 't', META, true, true);
    const keyAt = txt.indexOf('مفتاح الإجابات');
    const noteAt = txt.indexOf(AR);
    assert.ok(keyAt > 0 && noteAt > keyAt, 'note must sit under the key heading');
    assert.ok(noteAt < txt.indexOf('1. x = 1'), 'note must come before the first key row');
    assert.equal(txt.split(AR).length - 1, 1, 'exactly once');
  });

  it('says it in English for an English sheet', () => {
    const txt = formatWorksheetText(liveWorksheet(), 't', META, false, true);
    assert.ok(txt.indexOf(EN) > txt.indexOf('ANSWER KEY'));
  });

  it('is absent when the key is left out, and the student copy never carries it', () => {
    const txt = formatWorksheetText(liveWorksheet(), 't', META, true, false);
    assert.ok(!txt.includes(AR) && !txt.includes('الذكاء الاصطناعي ولم'));
  });

  it('is absent on a bank worksheet', async () => {
    const txt = formatWorksheetText(await bankWorksheet(), 't', META, true, true);
    assert.ok(txt.includes('مفتاح الإجابات'), 'fixture lost its key');
    assert.ok(!txt.includes(AR));
  });

  it('is absent when the key has no working to warn about', () => {
    const w = liveWorksheet();
    w.answerKey = w.answerKey.map(({ solution: _s, ...rest }) => rest);
    assert.ok(!formatWorksheetText(w, 't', META, true, true).includes(AR));
  });
});

describe('slide export', () => {
  it('puts the note on the first key slide only', () => {
    const html = buildWorksheetSlidesHTML(liveWorksheet(), 't', META, true, [], true);
    assert.equal(html.split('class="working-note"').length - 1, 1, 'exactly one note');
    const keyAt = html.indexOf('مفتاح الإجابات');
    const noteAt = html.indexOf('class="working-note"');
    assert.ok(keyAt > 0 && noteAt > keyAt, 'note must be on the key slide, not before it');
    assert.ok(html.includes(AR));
  });

  it('is absent when the key is left out', () => {
    const html = buildWorksheetSlidesHTML(liveWorksheet(), 't', META, true, [], false);
    assert.ok(!html.includes('class="working-note"'));
  });

  it('is absent on a bank worksheet', async () => {
    const html = buildWorksheetSlidesHTML(await bankWorksheet(), 't', META, true, [], true);
    assert.ok(!html.includes('class="working-note"'));
  });

  it('defines the style it uses', () => {
    const html = buildWorksheetSlidesHTML(liveWorksheet(), 't', META, true, [], true);
    assert.match(html, /\.working-note\s*\{/);
  });
});

describe('class deck', () => {
  const build = (ws: WorksheetOutput, isAr = true) => buildDeckFromWorksheet(ws, 'درس', isAr);

  it('warns in the teacher panel of a question whose working is AI-written', () => {
    const deck = build(liveWorksheet());
    const q1 = deck.slides.find(s => s.title === 'سؤال 1')!;
    const tips = q1.teacher?.teachingTips ?? '';
    assert.ok(tips.includes(AR), 'AI working shown to the teacher without the warning');
    assert.ok(tips.indexOf(AR) < tips.indexOf('خطوات الحل:'), 'warn before the working, not after');
  });

  it('never puts the note on the wall', () => {
    const deck = build(liveWorksheet());
    for (const s of deck.slides) {
      assert.ok(!s.content.includes(AR), `slide "${s.title}" shows the note to the class`);
      assert.ok(!(s.answer ?? '').includes(AR));
    }
  });

  it('gives the AI-written worked example a teacher panel with the warning', () => {
    const deck = build(liveWorksheet());
    const ex = deck.slides.find(s => s.title.includes('مثال محلول'))!;
    assert.ok(ex.teacher?.teachingTips?.includes(AR));
    assert.equal(ex.teacher?.expectedAnswer, 'x = 3');
  });

  it('says it in English for an English deck', () => {
    const deck = build(liveWorksheet(), false);
    assert.ok(deck.slides.find(s => s.title === 'Question 1')!.teacher?.teachingTips?.includes(EN));
  });

  it('leaves a question with no working alone', () => {
    const deck = build(liveWorksheet());
    const q2 = deck.slides.find(s => s.title === 'سؤال 2')!;
    assert.ok(!(q2.teacher?.teachingTips ?? '').includes(AR), 'a question with no working got a warning about it');
  });

  it('adds nothing for a bank worksheet', async () => {
    const deck = build(await bankWorksheet());
    for (const s of deck.slides) {
      assert.ok(!(s.teacher?.teachingTips ?? '').includes(AR), `bank slide "${s.title}" got the AI note`);
    }
    const ex = deck.slides.find(s => s.title.includes('مثال محلول'));
    assert.ok(ex, 'fixture lost its worked example');
    assert.equal(ex!.teacher, undefined, 'a reviewed example gained a panel');
  });
});
