/**
 * A quiz for a whole semester draws each question from a lesson in it.
 *
 * Properties, not bank sizes: the banks grow as items are added. Which lessons
 * have an offline bank is discovered by asking for a one-lesson quiz, so the
 * assertions track the data rather than a list that would drift.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest, QuizOutput } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { lessonsInScope, type ScopeSelection } from '../scopeSelection.ts';
import type { Distribution } from '../coveragePlan.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const base = {
  grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', totalMarks: 20, duration: 20,
  difficulty: 'medium', questionTypes: ['multiple_choice', 'true_false', 'short_answer'] as AIRequest['questionTypes'],
} as const;

async function wideQuiz(count: number, mode: Distribution = 'balanced', regenerate = false) {
  const wide = buildWideRequest(sem1, 'ar', count, mode)!;
  const out = await aiService.generateQuiz({
    ...base, topic: 'الفصل الأول كاملًا', numQuestions: count, regenerate, ...wide.fields,
  } as AIRequest);
  return { wide, out };
}

/**
 * Lessons of the semester that can write a quiz offline at all.
 *
 * Probed once, concurrently: each probe pays the mock service's artificial
 * delay, `quizOnce` has no await of its own, and its per-key state is not
 * shared across distinct lessonIds, so the probes can overlap safely.
 */
let bankable: Promise<Set<string>> | undefined;
function bankableIds(): Promise<Set<string>> {
  bankable ??= (async () => {
    const probed = await Promise.all(lessonsInScope(sem1).map(async l => {
      try {
        await aiService.generateQuiz({ ...base, topic: l.titleAr, lessonId: l.id, numQuestions: 3, questionTypes: ['multiple_choice'] } as AIRequest);
        return l.id;
      } catch (e) {
        if ((e as { code?: string }).code !== 'no_question_bank') throw e;
        return null;
      }
    }));
    return new Set(probed.filter((id): id is string => id !== null));
  })();
  return bankable;
}

describe('offline quiz — a wide scope', () => {
  it('every question belongs to a lesson of the scope, and says which', async () => {
    const { wide, out } = await wideQuiz(12);
    const inScope = new Set(wide.lessons.map(l => l.id));
    assert.ok(out.questions.length > 0);
    for (const q of out.questions) assert.ok(q.lessonId && inScope.has(q.lessonId), `q ${q.id}: ${q.lessonId}`);
  });

  // Relies on balanced + no regenerate being deterministic, and on each unit's
  // first-slot lesson not being spent for its question type at this count.
  it('balanced covers every unit that has a bank once count >= units', async () => {
    const ok = await bankableIds();
    const { wide, out } = await wideQuiz(12);
    const expected = new Set(wide.lessons.filter(l => ok.has(l.id)).map(l => l.unitId));
    const unitOf = new Map(wide.lessons.map(l => [l.id, l.unitId]));
    const got = new Set(out.questions.map(q => unitOf.get(q.lessonId!)));
    assert.ok(expected.size >= 2, 'probe: the semester should have several units with a bank');
    assert.deepEqual([...got].sort(), [...expected].sort());
  });

  it('never draws a question from a lesson that has no offline bank', async () => {
    const ok = await bankableIds();
    const { out } = await wideQuiz(20);
    for (const q of out.questions) assert.ok(ok.has(q.lessonId!), `q ${q.id} is from a lesson with no bank`);
  });

  it('a count above the old 20 cap is honoured, or honestly reported short', async () => {
    const { out } = await wideQuiz(30);
    if (out.questions.length < 30) assert.deepEqual(out.shortfall, { requested: 30, produced: out.questions.length });
    else assert.equal(out.shortfall, undefined);
    assert.ok(out.questions.length >= 25, `only ${out.questions.length}`);
  });

  it('still prints in ministry blocks and numbers straight through', async () => {
    const { out } = await wideQuiz(20);
    const types = out.questions.map(q => q.type);
    const runs = types.filter((t, i) => t !== types[i - 1]);
    assert.deepEqual(runs, ['multiple_choice', 'true_false', 'short_answer'], `interleaved: ${types}`);
    assert.deepEqual(out.questions.map(q => q.id), out.questions.map((_, i) => `q${i + 1}`));
  });

  it('random mode also stays inside the scope', async () => {
    const { wide, out } = await wideQuiz(15, 'random');
    const inScope = new Set(wide.lessons.map(l => l.id));
    for (const q of out.questions) assert.ok(inScope.has(q.lessonId!));
  });

  it('a regenerate is still inside the scope', async () => {
    const { wide, out } = await wideQuiz(12, 'balanced', true);
    const inScope = new Set(wide.lessons.map(l => l.id));
    for (const q of out.questions) assert.ok(inScope.has(q.lessonId!));
  });
});

describe('offline quiz — a single lesson is unchanged', () => {
  it('carries no lessonId and needs no coverage', async () => {
    const id = [...(await bankableIds())][0];
    assert.ok(id, 'probe: the semester should have a lesson with a bank');
    const lesson = lessonsInScope(sem1).find(l => l.id === id)!;
    const out: QuizOutput = await aiService.generateQuiz({
      ...base, topic: lesson.titleAr, lessonId: lesson.id, numQuestions: 5, questionTypes: ['multiple_choice'],
    } as AIRequest);
    assert.equal(out.questions.length, 5);
    assert.ok(out.questions.every(q => q.lessonId === undefined));
  });
});
