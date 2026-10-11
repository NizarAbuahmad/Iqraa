import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAIService } from '../ai/generators.ts';
import { requestWithoutFormats, appendFormats, splitFormatTypes } from '../ai/worksheetFormats.ts';

const base = { topic: 'المعادلات الأسية', language: 'arabic', subject: 'الرياضيات', numQuestions: 8 } as any;

describe('worksheet formats in the generator', () => {
  it('offline: each ticked format is one question, inside the total', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, questionTypes: ['short_answer', 'match', 'order'] });
    const all = ws.sections.flatMap(s => s.questions);
    const total = all.length + (ws.workedExample ? 1 : 0);
    assert.equal(total, 8);
    assert.equal(all.filter(q => q.format?.kind === 'match').length, 1);
    assert.equal(all.filter(q => q.format?.kind === 'order').length, 1);
    assert.equal(ws.answerKey.length, all.length);
  });

  it('offline: an unsupported format is reported, not invented', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, questionTypes: ['short_answer', 'graph'] });
    assert.ok(!ws.sections.some(s => s.type === 'graph'));
    assert.deepEqual(ws.missingFormats, ['graph']);
  });

  it('splitFormatTypes separates format kinds from the rest', () => {
    assert.deepEqual(splitFormatTypes(['short_answer', 'match', 'graph']), { formats: ['match', 'graph'], rest: ['short_answer'] });
  });

  it('live: the model is asked for neither the format types nor their count', () => {
    const r = requestWithoutFormats({ ...base, questionTypes: ['multiple_choice', 'match', 'spot_error'] });
    assert.deepEqual(r.questionTypes, ['multiple_choice']);
    assert.equal(r.numQuestions, 6);
  });

  it('live: numQuestions never drops below the picker minimum, and an empty type list falls back', () => {
    const r = requestWithoutFormats({ ...base, numQuestions: 5, questionTypes: ['match', 'order'] });
    assert.deepEqual(r.questionTypes, ['short_answer']);
    assert.equal(r.numQuestions, 5);
  });

  it('live: a request with no format kinds is untouched', () => {
    const req = { ...base, questionTypes: ['multiple_choice'] };
    assert.deepEqual(requestWithoutFormats(req), req);
  });

  it('live: formats are appended after the model\'s questions, numbered on', () => {
    const live = { title: 't', instructions: '', sections: [{ type: 'short_answer', title: 'x', questions: [{ text: 'q', points: 1 }] }], answerKey: [{ num: 1, answer: 'a' }] } as any;
    const out = appendFormats(live, { ...base }, ['match']);
    assert.equal(out.sections.length, 2);
    assert.deepEqual(out.answerKey.map((k: any) => k.num), [1, 2]);
  });

  it('live: a format the bank cannot build is reported', () => {
    const live = { title: 't', instructions: '', sections: [{ type: 'short_answer', title: 'x', questions: [{ text: 'q', points: 1 }] }], answerKey: [{ num: 1, answer: 'a' }] } as any;
    const out = appendFormats(live, { ...base }, ['graph']);
    assert.equal(out.sections.length, 1);
    assert.deepEqual(out.missingFormats, ['graph']);
  });
});
