/**
 * Which working on a worksheet did a person review?
 *
 * The 165 solutions in the offline question bank were written and checked by
 * hand. When live AI is on, the model writes its own worked example and key
 * working, and nobody reviews those. The screen must say which is which, so a
 * teacher is not left assuming that a neat step-by-step solution was checked.
 * `fromBank` is the only mark that can say "reviewed"; its absence means AI.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '@/services/ai/generators.ts';
import { workingProvenance } from '@/services/worksheetWorking.ts';
import { buildWorksheetHTML } from '@/services/exportHtml.ts';
import type { AIRequest, WorksheetOutput } from '@/services/ai/AIService.ts';

const EXP = { topic: 'المعادلات الأسية', subject: 'الرياضيات', grade: 'الصف العاشر' };

function bankWorksheet(over: Partial<AIRequest> = {}) {
  return aiService.generateWorksheet({
    ...EXP, language: 'arabic', difficulty: 'medium', numQuestions: 10,
    questionTypes: ['multiple_choice', 'short_answer'], ...over,
  } as AIRequest);
}

/** A worksheet shaped the way the live path returns it: no `fromBank` anywhere. */
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

describe('workingProvenance', () => {
  it('an offline bank worksheet is entirely reviewed: no AI working to warn about', async () => {
    const w = await bankWorksheet();
    const p = workingProvenance(w);
    assert.equal(p.example, 'bank');
    assert.ok(p.keyWithWorking > 0, 'the bank key carries no working to judge');
    assert.equal(p.unreviewedKeyLines, 0);
    assert.equal(p.needsAiNote, false);
  });

  it('every key solution on a bank worksheet belongs to a bank question', async () => {
    // Guards the rule the note rests on: if a bank solution ever lands on a
    // question without the mark, the screen would call reviewed working AI.
    for (const over of [{}, { numQuestions: 5 }, { numQuestions: 20 }, { language: 'english' as const }]) {
      const w = await bankWorksheet(over);
      const flat = w.sections.flatMap(s => s.questions);
      for (const item of w.answerKey.filter(k => k.solution?.length)) {
        assert.equal(flat[item.num - 1]?.fromBank, true, `key ${item.num} has working but its question is not marked`);
      }
    }
  });

  it('a live-shaped worksheet is unreviewed: example and key working both count', () => {
    const p = workingProvenance(liveWorksheet());
    assert.equal(p.example, 'ai');
    assert.equal(p.keyWithWorking, 1);
    assert.equal(p.unreviewedKeyLines, 1);
    assert.equal(p.needsAiNote, true);
  });

  it('a bank example does not excuse AI working in the key, and the reverse', () => {
    const w = liveWorksheet();
    w.workedExample = { ...w.workedExample!, fromBank: true };
    assert.equal(workingProvenance(w).needsAiNote, true, 'AI key working was hidden by a bank example');

    const v = liveWorksheet();
    v.answerKey = v.answerKey.map(({ solution: _s, ...rest }) => rest);
    assert.equal(workingProvenance(v).example, 'ai');
    assert.equal(workingProvenance(v).needsAiNote, true, 'an AI example was hidden by a bare key');
  });

  it('a worksheet with no working at all needs no note', () => {
    const w = liveWorksheet();
    delete w.workedExample;
    w.answerKey = w.answerKey.map(({ solution: _s, ...rest }) => rest);
    const p = workingProvenance(w);
    assert.equal(p.example, null);
    assert.equal(p.keyWithWorking, 0);
    assert.equal(p.needsAiNote, false);
  });

  it('a key row whose question is missing counts as unreviewed, never as reviewed', () => {
    const w = liveWorksheet();
    w.answerKey.push({ num: 9, answer: 'x', solution: ['a', 'b'] });
    const p = workingProvenance(w);
    assert.equal(p.keyWithWorking, 2);
    assert.equal(p.unreviewedKeyLines, 2);
  });
});

describe('the printed key', () => {
  const meta = { subject: 'الرياضيات', grade: 'الصف العاشر' };

  it('says the working was written by AI and not reviewed, on the key page only', () => {
    const html = buildWorksheetHTML(liveWorksheet(), 'ورقة', meta, true);
    const keyAt = html.indexOf('key-page"');
    assert.ok(keyAt > 0, 'no key page');
    const note = html.indexOf('working-note"');
    assert.ok(note > keyAt, 'the note is missing from the key page, or sits above it');
    assert.equal(html.slice(0, keyAt).includes('working-note"'), false, 'the note leaked onto the student pages');
  });

  it('says it in English on an English paper', () => {
    const html = buildWorksheetHTML(liveWorksheet(), 'Worksheet', meta, false);
    assert.match(html, /working-note[^>]*>[^<]*written by AI/i);
  });

  it('is absent from a bank worksheet, and from a copy printed without answers', async () => {
    assert.equal(buildWorksheetHTML(await bankWorksheet(), 'ورقة', meta, true).includes('working-note"'), false);
    assert.equal(buildWorksheetHTML(liveWorksheet(), 'ورقة', meta, true, [], false).includes('working-note"'), false);
  });
});
