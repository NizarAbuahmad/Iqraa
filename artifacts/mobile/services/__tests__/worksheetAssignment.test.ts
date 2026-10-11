/**
 * Sending a worksheet to a class: what the send sheet offers and what it sends.
 *
 * The objectives offered are the worksheet's own lesson's — the id a worksheet
 * carries IS the curriculum lesson id (checked 2026-10-09 on «النسب المثلثية»),
 * so no title is re-searched (CLAUDE.md: a lesson title does not identify a
 * lesson). Classes matching the sheet's grade and subject come first. The body
 * carries only what the server converts; the worked example, provenance and
 * pooling ids stay behind.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { classesForSend, lessonObjectivesForSend, worksheetSendPayload } from '../worksheetAssignment.ts';
import type { WorksheetOutput } from '../ai/AIService.ts';

describe('lessonObjectivesForSend', () => {
  it("lists the lesson's own objectives, all in its book", () => {
    const objs = lessonObjectivesForSend('kbl-math-s1-nccd-u3_l1');
    assert.ok(objs.length >= 1);
    for (const o of objs) {
      assert.match(o.id, /^o-nccd-s1-u3_l1-/);
      assert.equal(o.bookId, 'book-math-10');
    }
  });

  it('is empty for no lesson or an unknown one', () => {
    assert.deepEqual(lessonObjectivesForSend(undefined), []);
    assert.deepEqual(lessonObjectivesForSend('kbl-nope'), []);
  });
});

describe('classesForSend', () => {
  const c = (id: string, gradeId: string, subjectId: string, subjectIds?: string[]) => ({ id, gradeId, subjectId, subjectIds });

  it('puts classes of this grade and subject first and keeps the rest', () => {
    const out = classesForSend(
      [c('a', 'grade-9', 'mathematics'), c('b', 'grade-10', 'chemistry'), c('d', 'grade-10', 'physics', ['physics', 'mathematics']), c('e', 'grade-10', 'mathematics')],
      'grade-10',
      'mathematics',
    );
    assert.deepEqual(out.map(x => x.id), ['d', 'e', 'a', 'b']);
  });

  it('treats a class with no grade or subject set as matching', () => {
    assert.deepEqual(classesForSend([c('a', 'grade-9', 'x'), c('b', '', '')], 'grade-10', 'mathematics').map(x => x.id), ['b', 'a']);
  });
});

describe('worksheetSendPayload', () => {
  const ws = {
    title: 'ورقة',
    instructions: 'أجب.',
    workedExample: { problem: 'p', steps: ['s'], answer: 'a' },
    sections: [{
      type: 'mixed',
      title: 'أ',
      questions: [
        { text: 'س١', options: ['1', '2', '3'], points: 2, fromBank: true, figure: { uri: 'u', page: 4, caption: 'c' } },
        { text: 'س٢', points: 1 },
      ],
    }],
    answerKey: [{ num: 1, answer: '2' }, { num: 2, answer: '5', solution: ['خطوة'] }],
    variantId: 'v1',
  } as unknown as WorksheetOutput;

  it('sends the questions, their points, options, figures and the key — nothing else', () => {
    assert.deepEqual(worksheetSendPayload(ws), {
      title: 'ورقة',
      sections: [{ questions: [
        { text: 'س١', options: ['1', '2', '3'], points: 2, figure: { uri: 'u', caption: 'c' } },
        { text: 'س٢', points: 1 },
      ] }],
      answerKey: [{ num: 1, answer: '2' }, { num: 2, answer: '5', solution: ['خطوة'] }],
    });
  });
});
