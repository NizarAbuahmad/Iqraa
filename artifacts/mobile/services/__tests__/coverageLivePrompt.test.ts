/**
 * One plan, two consumers.
 *
 * The screen makes the plan once and sends it. The live prompt renders it as
 * per-lesson counts; the offline generator draws from the same plan. For a scope
 * whose lessons all have an offline bank these must be the same per-lesson
 * counts — otherwise a teacher gets a different paper depending on whether live
 * AI was on (CLAUDE.md: "two places move together").
 *
 * Why a UNIT for the offline half: a semester-wide offline request re-plans over
 * only the lessons that have a bank, so it legitimately differs from the live
 * table, which lists every lesson. A unit whose lessons all have a bank is the
 * case where the two must agree exactly.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { AIRequest } from '../ai/AIService.ts';
import { buildWideRequest } from '../wideScopeRequest.ts';
import { planCoverage } from '../coveragePlan.ts';
import { lessonsInScope, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { parseCoverage } from '../../../api-server/src/lib/coverage.ts';
import { quizPromptEn } from '../../../api-server/src/lib/prompts.ts';

const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const sem2: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 2 };
const base = {
  grade: 'الصف العاشر', subject: 'Mathematics', language: 'arabic', totalMarks: 20, duration: 20,
  difficulty: 'medium',
} as const;

describe('the live prompt renders the plan the screen made', () => {
  it('lists every lesson of the table, and per-lesson counts that add up to the picked number', () => {
    const w = buildWideRequest(sem1, 'en', 12, 'balanced')!;
    const body = { subject: 'Mathematics', grade: 'Grade 10', topic: 'Entire semester 1', numQuestions: 12, ...w.fields };
    const table = parseCoverage(body)!;
    assert.equal(table.lessons.length, w.lessons.length);
    assert.equal([...table.counts!.values()].reduce((a, b) => a + b, 0), 12);
    const prompt = quizPromptEn(body);
    for (const [code, n] of table.counts!) assert.ok(prompt.includes(`${code}: `) && n > 0);
  });

  it("the counts are the plan's, lesson for lesson", () => {
    const w = buildWideRequest(sem1, 'en', 12, 'balanced')!;
    const plan = planCoverage(w.lessons, 12, 'balanced');
    const expected = new Map<string, number>();
    for (const i of plan) expected.set(w.lessons[i]!.code, (expected.get(w.lessons[i]!.code) ?? 0) + 1);
    const got = parseCoverage({ scope: w.fields.scope, coverage: w.fields.coverage })!.counts!;
    assert.deepEqual([...got.entries()].sort(), [...expected.entries()].sort());
  });
});

/**
 * A unit of grade-10 mathematics whose lessons ALL have an offline multiple-choice
 * bank, found by asking rather than by a list that would drift. Probed once and
 * concurrently: each probe pays the mock service's artificial delay, so a serial
 * probe made a test file take minutes.
 */
let allBankableUnit: Promise<ScopeSelection | undefined> | undefined;
function findAllBankableUnit(): Promise<ScopeSelection | undefined> {
  allBankableUnit ??= (async () => {
    const candidates = [...unitsInScope(sem1), ...unitsInScope(sem2)].map(u => ({
      kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: u.id,
    }) as ScopeSelection);
    const verdicts = await Promise.all(candidates.map(async sel => {
      const lessons = lessonsInScope(sel);
      const ok = await Promise.all(lessons.map(async l => {
        try {
          await aiService.generateQuiz({
            ...base, topic: l.titleAr, lessonId: l.id, numQuestions: 3, questionTypes: ['multiple_choice'],
          } as AIRequest);
          return true;
        } catch (e) {
          if ((e as { code?: string }).code !== 'no_question_bank') throw e;
          return false;
        }
      }));
      return lessons.length >= 2 && ok.every(Boolean);
    }));
    return candidates.find((_, i) => verdicts[i]);
  })();
  return allBankableUnit;
}

describe('the offline paper follows the same plan', () => {
  it('per-lesson question counts equal the live prompt\'s, for a unit whose lessons all have a bank', async () => {
    const sel = await findAllBankableUnit();
    assert.ok(sel, 'probe: grade-10 mathematics should have a unit whose lessons all have an offline bank');
    const count = 6; // small enough that no lesson's multiple-choice bank runs dry
    const w = buildWideRequest(sel, 'ar', count, 'balanced')!;
    assert.ok(w.lessons.length >= 2);

    const out = await aiService.generateQuiz({
      ...base, topic: 'الوحدة كاملةً', numQuestions: count, questionTypes: ['multiple_choice'], ...w.fields,
    } as AIRequest);

    // The live side: what the prompt is told to write, per lesson id.
    const live = parseCoverage({ scope: w.fields.scope, coverage: w.fields.coverage, distribution: w.fields.distribution })!;
    assert.ok(live.counts, 'a balanced request must carry per-lesson counts');
    const idOfCode = new Map(w.lessons.map(l => [l.code, l.id]));
    const liveById = new Map<string, number>();
    for (const [code, n] of live.counts!) liveById.set(idOfCode.get(code)!, n);

    // The offline side: what the paper actually drew, per lesson id.
    const offlineById = new Map<string, number>();
    for (const q of out.questions) {
      assert.ok(q.lessonId, `q ${q.id} does not say which lesson it is from`);
      offlineById.set(q.lessonId!, (offlineById.get(q.lessonId!) ?? 0) + 1);
    }

    assert.equal(out.questions.length, count, 'offline paper should be the full count');
    assert.deepEqual([...offlineById.entries()].sort(), [...liveById.entries()].sort());
  });
});
