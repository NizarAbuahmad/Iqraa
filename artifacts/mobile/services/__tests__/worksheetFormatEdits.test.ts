import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyWorksheetQuestionEdit } from '../worksheetEdits.ts';

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
});
