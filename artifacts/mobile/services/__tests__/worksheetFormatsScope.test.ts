/**
 * Worksheet formats against main's two worksheet changes (merged 2026-10-15):
 *
 * - the picker's count is 5–30 (25 and 30 on a wide scope), so the one clamp
 *   the offline paper, the live request and `formatRoom` share follows it;
 * - a unit, semester or whole-book paper (and a teacher's own document) has no
 *   single lesson, so no format is built on either path — and every ticked one
 *   is reported in `missingFormats`, never dropped silently.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAIService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput } from '../ai/AIService.ts';
import {
  appendFormats, formatRoom, formatsHaveNoLesson, requestWithoutFormats, worksheetTotal,
} from '../ai/worksheetFormats.ts';
import { buildWideRequest, tagWorksheetLessons, ALL_QUESTION_COUNTS } from '../wideScopeRequest.ts';
import type { ScopeSelection } from '../scopeSelection.ts';
import { formatTicks, sanitizeQuestionTypes } from '../worksheetFormatTicks.ts';

const base = { topic: 'المعادلات الأسية', language: 'arabic', subject: 'الرياضيات', numQuestions: 8 } as AIRequest;
const FORMATS = ['match', 'order', 'spot_error', 'graph'] as const;
const flat = (w: WorksheetOutput) => w.sections.flatMap(s => s.questions);
const formatKinds = (w: WorksheetOutput) => flat(w).flatMap(q => (q.format ? [q.format.kind] : []));

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const wideReq = (count: number, questionTypes: string[]): AIRequest => {
  const wide = buildWideRequest(sem1, 'ar', count, 'balanced')!;
  return {
    grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', difficulty: 'medium',
    topic: 'الفصل الأول كاملًا', numQuestions: count,
    questionTypes: questionTypes as AIRequest['questionTypes'],
    ...wide.fields,
  } as AIRequest;
};

/** The real block shape, per `buildDocumentPromptBlock` — its title routes to a family with formats. */
const DOC_BLOCK = [
  '=== مواد المعلم المرفوعة (سياق أساسي) ===',
  'ملف 1: exp.pdf (pdf)',
  'جودة الاستخراج: نص حقيقي',
  'عنوان: المعادلات الأسية',
  'ملخص: حل المعادلات الأسية',
].join('\n');

describe('worksheetTotal follows the picker: 5–30', () => {
  it('clamps to the picker\'s whole range', () => {
    assert.equal(worksheetTotal({}), 8);
    assert.equal(worksheetTotal({ numQuestions: 3 }), 5);
    assert.equal(worksheetTotal({ numQuestions: 25 }), 25);
    assert.equal(worksheetTotal({ numQuestions: 30 }), 30);
    assert.equal(worksheetTotal({ numQuestions: 40 }), 30);
    // Every count the picker offers is honoured as asked.
    for (const n of ALL_QUESTION_COUNTS) assert.equal(worksheetTotal({ numQuestions: n }), n);
  });

  it('formatRoom covers the whole range', () => {
    assert.equal(formatRoom(30, false), 27);
    assert.equal(formatRoom(30, true), 26);
    for (let t = 5; t <= 30; t++) assert.ok(formatRoom(t, true) >= 0);
  });

  it('live: a 25-question paper asks the model for 25 minus the formats, not 20 minus them', () => {
    const r = requestWithoutFormats({ ...base, numQuestions: 25, questionTypes: ['short_answer', 'match', 'order'] as AIRequest['questionTypes'] });
    assert.equal(r.numQuestions, 23);
  });

  it('offline: a 25-question paper with formats is a 25-question paper (or says it is short of 25)', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, numQuestions: 25, questionTypes: ['short_answer', 'match'] as AIRequest['questionTypes'] });
    const total = flat(ws).length + (ws.workedExample ? 1 : 0);
    assert.equal(ws.shortfall ? ws.shortfall.requested : total, 25);
    assert.ok(formatKinds(ws).includes('match') || (ws.missingFormats ?? []).includes('match'));
  });
});

describe('no single lesson: a wide scope or a teacher\'s document builds no format', () => {
  it('formatsHaveNoLesson reads the scope and the document block', () => {
    assert.equal(formatsHaveNoLesson(base), false);
    assert.equal(formatsHaveNoLesson(wideReq(10, ['short_answer'])), true);
    assert.equal(formatsHaveNoLesson({ ...base, additionalContext: DOC_BLOCK }), true);
  });

  it('offline, wide scope: no format section, every ticked one reported, the count unchanged', async () => {
    const plain = await new MockAIService().generateWorksheet(wideReq(10, ['short_answer']));
    const ws = await new MockAIService().generateWorksheet(wideReq(10, ['short_answer', ...FORMATS]));
    assert.deepEqual(formatKinds(ws), []);
    assert.ok(!ws.sections.some(s => (FORMATS as readonly string[]).includes(s.type)));
    assert.deepEqual(ws.missingFormats, [...FORMATS]);
    // The formats take no room: the paper holds what a paper without them holds.
    const count = (w: WorksheetOutput) => flat(w).length + (w.workedExample ? 1 : 0);
    assert.equal(count(ws), count(plain));
    assert.equal(ws.answerKey.length, flat(ws).length);
  });

  it('offline, teacher\'s document: no format even when its title routes to a family', async () => {
    const ws = await new MockAIService().generateWorksheet({
      ...base, additionalContext: DOC_BLOCK, questionTypes: ['short_answer', 'match', 'order'] as AIRequest['questionTypes'],
    });
    assert.deepEqual(formatKinds(ws), []);
    assert.deepEqual(ws.missingFormats, ['match', 'order']);
  });

  it('live, wide scope: the model is asked for the whole total, and nothing is appended', () => {
    const req = wideReq(12, ['short_answer', 'match', 'spot_error']);
    const asked = requestWithoutFormats(req);
    assert.deepEqual(asked.questionTypes, ['short_answer']);
    assert.equal(asked.numQuestions, 12);
    assert.equal(asked.coverage, req.coverage, 'the coverage table rides along untouched');

    // The live path: tag the model's lesson codes, then append (RemoteAIService.generateWorksheet).
    const code = req.coverage!.lessons[0]!.code;
    const model = {
      title: 't', instructions: '',
      sections: [{ type: 'short_answer', title: 'x', questions: [{ text: 'q', points: 1, lesson: code }] }],
      answerKey: [{ num: 1, answer: 'a' }],
    } as unknown as WorksheetOutput;
    const out = appendFormats(tagWorksheetLessons(model, req), req, ['match', 'spot_error']);
    assert.equal(out.sections.length, 1);
    assert.equal(out.sections[0]!.questions[0]!.lessonId, req.coverage!.lessons[0]!.id);
    assert.deepEqual(out.missingFormats, ['match', 'spot_error']);
  });

  it('live, teacher\'s document: nothing appended, every ticked one reported', () => {
    const req = { ...base, additionalContext: DOC_BLOCK, numQuestions: 10, questionTypes: ['short_answer', 'match'] } as AIRequest;
    assert.equal(requestWithoutFormats(req).numQuestions, 10);
    const live = { title: 't', instructions: '', sections: [], answerKey: [], missingFormats: undefined } as unknown as WorksheetOutput;
    const out = appendFormats(live, req, ['match']);
    assert.equal(out.sections.length, 0);
    assert.deepEqual(out.missingFormats, ['match']);
  });

  it('screen: the ticks are hidden on a wide scope and stripped from the request, but stay stored', () => {
    const all = { match: true, order: true, spot_error: true, graph: true };
    assert.deepEqual(formatTicks({ isHomework: false, isWide: true, availability: all }), { shown: [], greyed: [] });
    const selected = new Set(['short_answer', 'match', 'graph']);
    assert.deepEqual([...sanitizeQuestionTypes(selected, { isHomework: false, isWide: true, availability: null })], ['short_answer']);
    // The stored selection is sanitized without `isWide`, so the teacher's ticks come back with a lesson.
    assert.equal(sanitizeQuestionTypes(selected, { isHomework: false, availability: null }), selected);
    assert.deepEqual(formatTicks({ isHomework: false, isWide: false, availability: all }).shown, [...FORMATS]);
  });
});
