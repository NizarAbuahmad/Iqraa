import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAIService } from '../ai/generators.ts';
import { requestWithoutFormats, appendFormats, splitFormatTypes, formatPoints, formatRoom } from '../ai/worksheetFormats.ts';

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

  it('live: an empty type list falls back to short_answer', () => {
    const r = requestWithoutFormats({ ...base, numQuestions: 8, questionTypes: ['match', 'order'] });
    assert.deepEqual(r.questionTypes, ['short_answer']);
    assert.equal(r.numQuestions, 6);
  });

  it('formatRoom: what is left after the example, the half-solved item, one ordinary question and the word problem', () => {
    assert.equal(formatRoom(5, false), 2);
    assert.equal(formatRoom(5, true), 1);
    assert.equal(formatRoom(20, false), 17);
    for (let t = 5; t <= 20; t++) assert.ok(formatRoom(t, true) >= 0);
  });

  it('a small total trims the formats, offline and live, and says so', async () => {
    const types = ['short_answer', 'match', 'order', 'spot_error'];
    const ws = await new MockAIService().generateWorksheet({ ...base, numQuestions: 5, questionTypes: types });
    const all = ws.sections.flatMap(s => s.questions);
    assert.equal(all.length + (ws.workedExample ? 1 : 0), 5);
    assert.deepEqual(ws.missingFormats, ['spot_error']);
    const live = requestWithoutFormats({ ...base, numQuestions: 5, questionTypes: types });
    assert.equal(live.numQuestions, 3); // 5 - 2 taken
    const out = appendFormats(
      { title: 't', instructions: '', sections: [{ type: 'short_answer', title: 'x', questions: [{ text: 'q', points: 1 }] }], answerKey: [{ num: 1, answer: 'a' }] } as any,
      { ...base, numQuestions: 5, questionTypes: types },
      ['match', 'order', 'spot_error'],
    );
    assert.deepEqual(out.missingFormats, ['spot_error']);
    assert.equal(out.sections.length, 3);
  });

  it('offline: four ticked formats fit a total of 8, graph reported missing for this lesson', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, numQuestions: 8, questionTypes: ['short_answer', 'match', 'order', 'spot_error'] });
    const all = ws.sections.flatMap(s => s.questions);
    assert.equal(all.length + (ws.workedExample ? 1 : 0), 8);
    for (const k of ['match', 'order', 'spot_error']) assert.equal(all.filter(q => q.format?.kind === k).length, 1);
    const g = await new MockAIService().generateWorksheet({ ...base, numQuestions: 8, questionTypes: ['short_answer', 'match', 'order', 'spot_error', 'graph'] });
    assert.deepEqual(g.missingFormats, ['graph']);
    assert.equal(g.sections.flatMap(s => s.questions).length + (g.workedExample ? 1 : 0), 7);
  });

  it('points: the live format question is worth what the offline one is, per difficulty', async () => {
    assert.deepEqual([formatPoints('easy'), formatPoints(undefined), formatPoints('hard')], [4, 6, 10]);
    for (const difficulty of ['easy', 'hard'] as const) {
      const req = { ...base, difficulty, questionTypes: ['short_answer', 'match'] };
      const off = await new MockAIService().generateWorksheet(req);
      const offPts = off.sections.flatMap(s => s.questions).find(q => q.format?.kind === 'match')!.points;
      const live = { title: 't', instructions: '', sections: [], answerKey: [] } as any;
      const livePts = appendFormats(live, req, ['match']).sections[0]!.questions[0]!.points;
      assert.equal(livePts, offPts);
    }
  });

  it('live: two formats share one session, so order and spot_error never use the same problem', () => {
    for (let i = 0; i < 30; i++) {
      const live = { title: 't', instructions: '', sections: [], answerKey: [] } as any;
      const out = appendFormats(live, { ...base, numQuestions: 10, questionTypes: ['order', 'spot_error'] }, ['order', 'spot_error']);
      if (out.sections.length < 2) continue;
      const [o, e] = out.sections.map((s: any) => s.questions[0].format);
      const problemOf = (f: any) => String(f.stem).split('\n').slice(1).join('\n');
      assert.notEqual(problemOf(o), problemOf(e));
    }
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
