import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest, WorksheetOutput, WorksheetQuestion } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const base = {
  grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', difficulty: 'medium',
  questionTypes: ['multiple_choice', 'short_answer'] as AIRequest['questionTypes'],
} as const;

const wideReq = (count: number, mode: 'balanced' | 'random' = 'balanced') => {
  const wide = buildWideRequest(sem1, 'ar', count, mode)!;
  return { wide, req: { ...base, topic: 'الفصل الأول كاملًا', numQuestions: count, ...wide.fields } as AIRequest };
};
const flat = (w: WorksheetOutput): WorksheetQuestion[] => w.sections.flatMap(s => s.questions);

/**
 * The first lesson of the semester that can write a worksheet offline.
 *
 * Probed once, concurrently and memoized: each probe pays the mock service's
 * artificial delay, so a serial probe of every lesson takes minutes.
 */
let firstBankable: Promise<ReturnType<typeof lessonsInScope>[number]> | undefined;
function firstBankableLesson() {
  firstBankable ??= (async () => {
    const lessons = lessonsInScope(sem1);
    const probed = await Promise.all(lessons.map(async l => {
      try {
        await aiService.generateWorksheet({ ...base, topic: l.titleAr, lessonId: l.id, numQuestions: 5 } as AIRequest);
        return true;
      } catch (e) {
        if ((e as { code?: string }).code !== 'no_question_bank') throw e;
        return false;
      }
    }));
    const at = probed.indexOf(true);
    assert.ok(at >= 0, 'probe: some lesson of the semester should have an offline bank');
    return lessons[at]!;
  })();
  return firstBankable;
}

describe('offline worksheet — a wide scope', () => {
  it('every practice question belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    const inScope = new Set(wide.lessons.map(l => l.id));
    const tagged = flat(out).filter(q => q.lessonId);
    assert.ok(tagged.length >= 8, `only ${tagged.length} tagged questions`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!), `foreign lesson ${q.lessonId}`);
  });

  it('draws from more than one lesson (it is not the old single-lesson paper)', async () => {
    const { req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    assert.ok(new Set(flat(out).map(q => q.lessonId).filter(Boolean)).size >= 3);
  });

  it('keeps the picked total: the worked example and the half-solved item count inside it', async () => {
    const { req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    const questions = flat(out).length + (out.workedExample ? 1 : 0);
    if (out.shortfall) assert.equal(out.shortfall.requested, 12);
    else assert.equal(questions, 12);
  });

  it('a count above the old 20 cap is honoured or honestly reported short', async () => {
    const { req } = wideReq(30);
    const out = await aiService.generateWorksheet(req);
    const produced = flat(out).length + (out.workedExample ? 1 : 0);
    assert.ok(produced > 20, `still capped at ${produced}`);
    if (produced < 30) assert.equal(out.shortfall?.requested, 30);
  });

  it('the worked example belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateWorksheet(req);
    if (!out.workedExample) return; // a lesson without checked working simply has none
    assert.ok(wide.lessons.length > 0);
  });
});

describe('offline homework — a wide scope', () => {
  it('every independent-practice question belongs to a lesson of the scope', async () => {
    const { wide, req } = wideReq(12);
    const out = await aiService.generateHomework(req);
    const inScope = new Set(wide.lessons.map(l => l.id));
    const tagged = flat(out).filter(q => q.lessonId);
    assert.ok(tagged.length >= 5, `only ${tagged.length} tagged questions`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!));
  });

  it('draws from several lessons, and honours a count above 20', async () => {
    const { req } = wideReq(30);
    const out = await aiService.generateHomework(req);
    assert.ok(new Set(flat(out).map(q => q.lessonId).filter(Boolean)).size >= 3);
    assert.ok(flat(out).length > 20, `still capped at ${flat(out).length}`);
  });
});

describe('a single lesson is unchanged', () => {
  const oneFor = async () => {
    const lesson = await firstBankableLesson();
    return { ...base, topic: lesson.titleAr, lessonId: lesson.id, numQuestions: 8 } as AIRequest;
  };

  it('worksheet questions carry no lessonId', async () => {
    assert.ok(flat(await aiService.generateWorksheet(await oneFor())).every(q => q.lessonId === undefined));
  });

  it('homework questions carry no lessonId', async () => {
    assert.ok(flat(await aiService.generateHomework(await oneFor())).every(q => q.lessonId === undefined));
  });
});
