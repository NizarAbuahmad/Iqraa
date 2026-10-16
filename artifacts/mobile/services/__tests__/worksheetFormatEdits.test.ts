import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyWorksheetQuestionEdit, applyWorksheetAnswerEdit } from '../worksheetEdits.ts';

const ws = {
  title: 't', instructions: '',
  sections: [{ type: 'match', title: 'صِل', questions: [{ text: 'صِل…', points: 3, format: { kind: 'match', stem: 's', left: ['a'], right: ['b'], pairs: [0] } }] }],
  answerKey: [{ num: 1, answer: '١-أ' }],
} as any;

describe('editing a formatted question', () => {
  it('rewording drops the format — the structure no longer matches the words', () => {
    const out = applyWorksheetQuestionEdit(ws, 0, 0, { text: 'سؤال جديد' });
    assert.equal(out.sections[0]!.questions[0]!.format, undefined);
  });
  it('changing points keeps it', () => {
    const out = applyWorksheetQuestionEdit(ws, 0, 0, { points: 5 });
    assert.equal(out.sections[0]!.questions[0]!.format?.kind, 'match');
  });
  it('correcting the key drops it — the converter would mark against the old pairs', () => {
    // match/order/spot_error convert from `format`, not from `answer`, so a
    // kept format auto-marks students against the key the teacher corrected.
    const out = applyWorksheetAnswerEdit(ws, 0, 0, '١-ب');
    assert.equal(out.sections[0]!.questions[0]!.format, undefined);
    assert.equal(out.answerKey[0]!.answer, '١-ب');
    assert.equal(out.sections[0]!.questions[0]!.text, 'صِل…');
  });
  it('correcting a graph\'s key keeps the grid — its equations are the stem\'s, its key is the answer', () => {
    const g = { ...ws, sections: [{ type: 'graph', title: 'ارسم', questions: [{ text: 'ارسم', points: 3, format: { kind: 'graph', stem: 's', exprs: ['x'], window: { xMin: -5, xMax: 5, yMin: -5, yMax: 5 } } }] }] };
    const out = applyWorksheetAnswerEdit(g, 0, 0, '(1 , 1)');
    assert.equal(out.sections[0]!.questions[0]!.format?.kind, 'graph');
  });
});
