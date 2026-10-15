/**
 * Lesson-flow on a unit / semester / book scope.
 *
 * Steps 1–3 (plan, warm-up, activity) carry the scope as the request has it.
 * Steps 5–6 (a 5-question worksheet, a 3-question exit ticket) carry the scope
 * and the lesson table, but ask for the `random` distribution and never a slot
 * plan: a plan made for another count would make the live prompt contradict
 * the step's own numQuestions. A single-lesson flow's requests are unchanged.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  questionStepFields, runLessonFlowFrom, STEP_ORDER, type RunnerAIService, type StepKey,
} from '../ai/lessonFlowRunner.ts';
import type { AIRequest } from '../ai/AIService.ts';
import { aiService } from '../ai/generators.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { scopeLabel, semestersAvailable, type ScopeSelection } from '../scopeSelection.ts';
import { revisionUnits, splitShown, REVISION_SHOWN_PER_UNIT } from '../revisionScope.ts';
import { getLessonsForUnit, getUnitsForSubjectGrade, KB_BOOKS, KB_UNITS } from '../knowledgeBase.ts';
import { buildLessonFlowHTML } from '../exportHtml.ts';
import { englishUnits } from '../ai/lessonPlanRevision.ts';
import { failedStepHint, lessonFlowFailure } from '../lessonFlowError.ts';
import { NoQuestionBankError } from '../ai/generators.ts';
import { LessonFlowStepError } from '../ai/lessonFlowRunner.ts';
import { revisionActivityLesson } from '../ai/activityRevision.ts';
import type { KBLesson } from '../knowledgeBase.ts';
import type { LessonFlowOutput } from '../ai/AIService.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const MOCK_PLAN = {
  title: 'P', grade: 'Grade 10', subject: 'Math', duration: 45, objectives: ['o'], materials: [],
  introduction: 'i', mainActivity: 'm', guidedPractice: 'g', independentPractice: 'ip', closure: 'c',
  assessment: 'a', differentiation: '', homework: '',
};
const MOCK_ACTIVITY = {
  title: 'A', activityType: 'group', totalDuration: 10, objective: 'o', groupSize: 'pairs', materials: [],
  steps: [{ stepNumber: 1, title: 's', description: 'd', durationMin: 10 }], teacherTips: [], differentiation: '', assessment: '',
};
const MOCK_WORKSHEET = { title: 'W', instructions: '', sections: [], answerKey: [] };
const MOCK_QUIZ = { title: 'Q', duration: 10, totalPoints: 0, questions: [] };

const BASE_REQ: AIRequest = { grade: 'Grade 10', subject: 'Mathematics', topic: 'Quadratic Equations', language: 'english' };
const LESSONS = [
  { code: 'L1', id: 'kbl-a', unitId: 'kbu-1', title: 'أ' },
  { code: 'L2', id: 'kbl-b', unitId: 'kbu-2', title: 'ب' },
];
/** A wide request that DOES carry a slot plan, as a caller might: the question steps must drop it. */
const WIDE_REQ: AIRequest = {
  ...BASE_REQ,
  topic: 'الفصل الأول كاملًا',
  scope: { kind: 'semester', scopeKey: 'sem:grade-10:mathematics:1', unitIds: ['u1', 'u2'] },
  coverage: { lessons: LESSONS, slots: ['L1', 'L2', 'L1', 'L2', 'L1'] },
  lessonId: undefined,
  unitId: undefined,
  bookFigureCount: 0,
};

type Seen = { step: StepKey; req: AIRequest };
function recording(): { ai: RunnerAIService; seen: Seen[] } {
  const seen: Seen[] = [];
  const ai: RunnerAIService = {
    generateLessonPlan: async req => { seen.push({ step: 'objectives', req }); return { ...MOCK_PLAN }; },
    generateActivity: async req => {
      seen.push({ step: req.activityVariant === 'warmup' ? 'warmup' : 'activity', req });
      return { ...MOCK_ACTIVITY };
    },
    generateWorksheet: async req => { seen.push({ step: 'worksheet', req }); return { ...MOCK_WORKSHEET }; },
    generateQuiz: async req => { seen.push({ step: 'exitTicket', req }); return { ...MOCK_QUIZ }; },
  };
  return { ai, seen };
}
const noop = { onStepStart: () => {}, onStepDone: () => {} };
const reqFor = (seen: Seen[], step: StepKey) => seen.find(s => s.step === step)!.req;

describe('questionStepFields', () => {
  it('adds nothing to a single-lesson request', () => {
    assert.deepStrictEqual(questionStepFields(BASE_REQ), {});
  });

  it('asks a wide request for random over the lesson table, with no slot plan', () => {
    assert.deepStrictEqual(questionStepFields(WIDE_REQ), { distribution: 'random', coverage: { lessons: LESSONS } });
  });
});

describe('runLessonFlowFrom — what each step is sent', () => {
  it('a single-lesson flow sends exactly what it always did', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', BASE_REQ, ai, {}, noop);
    assert.deepStrictEqual(reqFor(seen, 'worksheet'), { ...BASE_REQ, numQuestions: 5 });
    assert.deepStrictEqual(reqFor(seen, 'exitTicket'), { ...BASE_REQ, numQuestions: 3 });
    assert.deepStrictEqual(reqFor(seen, 'objectives'), BASE_REQ);
  });

  it('steps 1–3 carry the scope and the lesson table as the request has them', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', WIDE_REQ, ai, {}, noop);
    for (const step of ['objectives', 'warmup', 'activity'] as const) {
      const req = reqFor(seen, step);
      assert.deepEqual(req.scope, WIDE_REQ.scope, step);
      assert.equal(req.coverage, WIDE_REQ.coverage, step);
      assert.equal(req.distribution, undefined, step);
      assert.equal(req.lessonId, undefined, step);
    }
  });

  it('steps 5–6 keep the scope but ask for random, with no slots, at their own counts', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('objectives', WIDE_REQ, ai, {}, noop);
    for (const [step, n] of [['worksheet', 5], ['exitTicket', 3]] as const) {
      const req = reqFor(seen, step);
      assert.deepEqual(req.scope, WIDE_REQ.scope, step);
      assert.equal(req.distribution, 'random', step);
      assert.deepStrictEqual(req.coverage, { lessons: LESSONS }, step);
      assert.equal(req.numQuestions, n, step);
    }
  });

  it('end to end, offline: a semester flow runs all six steps, and its questions come from the scope', async () => {
    const sem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
    const wide = buildScopeRequest(sem1, 'ar')!;
    const req: AIRequest = {
      grade: 'Grade 10', subject: 'Mathematics', topic: 'الفصل الأول كاملًا', language: 'arabic', duration: 45,
      ...wide.fields,
    };
    const sent: AIRequest[] = [];
    const live: RunnerAIService = {
      generateLessonPlan: r => { sent.push(r); return aiService.generateLessonPlan(r); },
      generateActivity: r => { sent.push(r); return aiService.generateActivity(r); },
      generateWorksheet: r => { sent.push(r); return aiService.generateWorksheet(r); },
      generateQuiz: r => { sent.push(r); return aiService.generateQuiz(r); },
    };
    const done: StepKey[] = [];
    const out = await runLessonFlowFrom('objectives', req, live, {}, {
      onStepStart: () => {}, onStepDone: key => { done.push(key); },
    });
    assert.deepEqual(done, [...STEP_ORDER]);
    const inScope = new Set(wide.fields.coverage!.lessons.map(l => l.id));
    const worksheetQs = out.worksheet!.sections.flatMap(s => s.questions);
    const tagged = worksheetQs.filter(q => q.lessonId);
    assert.ok(tagged.length >= 3, `only ${tagged.length} worksheet questions say their lesson`);
    for (const q of tagged) assert.ok(inScope.has(q.lessonId!), `worksheet: foreign lesson ${q.lessonId}`);
    assert.ok(out.exitTicket!.questions.length > 0);
    for (const q of out.exitTicket!.questions) assert.ok(q.lessonId && inScope.has(q.lessonId), `exit ticket: ${q.lessonId}`);
    const questionSteps = sent.filter(r => r.numQuestions === 5 || r.numQuestions === 3);
    assert.equal(questionSteps.length, 2);
    for (const r of questionSteps) assert.equal(r.distribution, 'random');
  });
});

// ─── Beyond the brief ────────────────────────────────────────────────────────

describe('questionStepFields — the edges', () => {
  it('a scope with no lesson table asks for nothing: there is nothing to draw from', () => {
    assert.deepStrictEqual(questionStepFields({ ...BASE_REQ, scope: WIDE_REQ.scope }), {});
    assert.deepStrictEqual(questionStepFields({ ...BASE_REQ, scope: WIDE_REQ.scope, coverage: { lessons: [] } }), {});
  });

  it('a lesson table with no scope is a lesson request and asks for nothing', () => {
    assert.deepStrictEqual(questionStepFields({ ...BASE_REQ, coverage: { lessons: LESSONS, slots: ['L1'] } }), {});
  });

  it('builds a fresh coverage and leaves the request alone', () => {
    const before = JSON.stringify(WIDE_REQ);
    const fields = questionStepFields(WIDE_REQ);
    assert.notEqual(fields.coverage, WIDE_REQ.coverage);
    assert.ok(!('slots' in fields.coverage!));
    assert.equal(JSON.stringify(WIDE_REQ), before);
  });
});

describe('runLessonFlowFrom — a retry', () => {
  it('re-sends only the steps after the failed one, with the question-step fields, and never touches the request', async () => {
    const { ai, seen } = recording();
    const before = JSON.stringify(WIDE_REQ);
    const prior = {
      plan: { ...MOCK_PLAN }, objectives: ['o'], warmup: { ...MOCK_ACTIVITY }, activity: { ...MOCK_ACTIVITY }, guidedPractice: 'g',
    };
    await runLessonFlowFrom('worksheet', WIDE_REQ, ai, prior, noop);
    assert.deepEqual(seen.map(s => s.step), ['worksheet', 'exitTicket']);
    for (const s of seen) {
      assert.equal(s.req.distribution, 'random', s.step);
      assert.deepStrictEqual(s.req.coverage, { lessons: LESSONS }, s.step);
    }
    assert.equal(JSON.stringify(WIDE_REQ), before);
  });

  it('a retry from the warm-up still hands steps 5–6 their fields', async () => {
    const { ai, seen } = recording();
    await runLessonFlowFrom('warmup', WIDE_REQ, ai, { plan: { ...MOCK_PLAN } }, noop);
    assert.deepEqual(seen.map(s => s.step), ['warmup', 'activity', 'worksheet', 'exitTicket']);
    assert.equal(reqFor(seen, 'warmup').distribution, undefined);
    assert.equal(reqFor(seen, 'worksheet').distribution, 'random');
  });
});

/** Arabic LETTERS: not the Quranic marks a few Latin titles carry, which are real content. */
const ARABIC_LETTER = /[ء-ي]/;
/**
 * The one Arabic shape an English output may keep: a bracketed one-to-three-letter gloss,
 * «The Letter Baa (ب)», «Alif (ا, ى)», where the letter IS the lesson. The scans below
 * remove exactly this and then look for any Arabic letter, so they stay strict about the rest.
 */
const LETTER_GLOSS_G = /\s*[(（]\s*[ء-ي][\u064B-\u065F]*(?:\s*[,،/\-–]\s*[ء-ي][\u064B-\u065F]*){0,2}\s*[)）]/g;
const hasArabic = (s: string) => ARABIC_LETTER.test(s.replace(LETTER_GLOSS_G, ''));
const LESSON_SHAPED = /درس «|أنهينا درس|ملخص الدرس|مفردات الدرس|غلق الدرس|هذا الدرس|درس اليوم|today's lesson|this lesson|Lesson Summary|Key Vocabulary/i;
/** Also what a revision's warm-up must not say: it is not «the new lesson». */
const ONE_LESSON = new RegExp(`${LESSON_SHAPED.source}|الدرس الجديد|the new lesson`, 'i');
/** The subject name the picker would send. Only maths and chemistry have an offline question bank. */
const SUBJECT_NAME: Record<string, string> = { mathematics: 'Mathematics', chemistry: 'Chemistry' };
const BANKED = new Set(Object.keys(SUBJECT_NAME));

function allScopes(unitsPerBook = Infinity): ScopeSelection[] {
  const out: ScopeSelection[] = [];
  for (const b of KB_BOOKS) {
    out.push({ kind: 'book', gradeId: b.gradeId, subjectId: b.subjectId });
    for (const semester of semestersAvailable(b.gradeId, b.subjectId)) {
      out.push({ kind: 'semester', gradeId: b.gradeId, subjectId: b.subjectId, semester });
    }
    for (const u of KB_UNITS.filter(x => x.bookId === b.id).slice(0, unitsPerBook)) {
      out.push({ kind: 'unit', gradeId: b.gradeId, subjectId: b.subjectId, unitId: u.id });
    }
  }
  return out;
}

function flowRequest(sel: ScopeSelection, lang: 'ar' | 'en'): { req: AIRequest; lessons: Set<string> } {
  const wide = buildScopeRequest(sel, lang)!;
  assert.ok(wide, `${sel.kind} ${sel.subjectId} should ground`);
  return {
    req: {
      grade: 'Grade 10', subject: SUBJECT_NAME[sel.subjectId] ?? 'History', topic: scopeLabel(sel, lang),
      language: lang === 'ar' ? 'arabic' : 'english', duration: 45, ...wide.fields,
    },
    lessons: new Set(wide.fields.coverage!.lessons.map(l => l.id)),
  };
}

describe('lesson-flow, offline, over the scopes a teacher can pick', () => {
  const picks: ScopeSelection[] = [];
  for (const subjectId of Object.keys(SUBJECT_NAME)) {
    picks.push({ kind: 'book', gradeId: 'grade-10', subjectId });
    picks.push({ kind: 'semester', gradeId: 'grade-10', subjectId, semester: 1 });
    for (const u of getUnitsForSubjectGrade(subjectId, 'grade-10').slice(0, 2)) {
      picks.push({ kind: 'unit', gradeId: 'grade-10', subjectId, unitId: u.id });
    }
  }
  const real = (): RunnerAIService => ({
    generateLessonPlan: r => aiService.generateLessonPlan(r),
    generateActivity: r => aiService.generateActivity(r),
    generateWorksheet: r => aiService.generateWorksheet(r),
    generateQuiz: r => aiService.generateQuiz(r),
  });

  it('every maths and chemistry book / semester / unit runs all six steps in both languages, from its own lessons, saying nothing about one lesson', async () => {
    for (const sel of picks) {
      for (const lang of ['ar', 'en'] as const) {
        const where = `${sel.subjectId} ${sel.kind} ${lang}`;
        const { req, lessons } = flowRequest(sel, lang);
        const done: StepKey[] = [];
        const out = await runLessonFlowFrom('objectives', req, real(), {}, { onStepStart: () => {}, onStepDone: k => { done.push(k); } });
        assert.deepEqual(done, [...STEP_ORDER], where);
        const qs = out.worksheet!.sections.flatMap(s => s.questions);
        const tagged = qs.filter(q => q.lessonId);
        assert.ok(tagged.length >= 2, `${where}: only ${tagged.length} worksheet questions say their lesson`);
        for (const q of tagged) assert.ok(lessons.has(q.lessonId!), `${where}: worksheet, foreign lesson ${q.lessonId}`);
        assert.equal(out.exitTicket!.questions.length, 3, where);
        for (const q of out.exitTicket!.questions) assert.ok(q.lessonId && lessons.has(q.lessonId), `${where}: exit ticket ${q.lessonId}`);
        // Mutation caught: leaving «اربط بدرس اليوم» / «ستبدأ الدرس الجديد» out of the reword table.
        assert.doesNotMatch(JSON.stringify({ plan: out.plan, warmup: out.warmup, activity: out.activity, worksheet: out.worksheet, exitTicket: out.exitTicket }), ONE_LESSON, where);
      }
    }
  });

  it('an English flow carries no Arabic letter in its plan, warm-up or activity (the banks print Arabic answers, as a lesson does)', async () => {
    for (const sel of picks) {
      const { req } = flowRequest(sel, 'en');
      const out = await runLessonFlowFrom('objectives', req, real(), {}, { onStepStart: () => {}, onStepDone: () => {} });
      assert.ok(!hasArabic(JSON.stringify(out.plan)), `${sel.subjectId} ${sel.kind}: plan`);
    }
  });
});

describe('lesson-flow steps 1–3 over every book, semester and unit in the data', () => {
  const scopes = allScopes();
  /** The question steps need a bank; these three do not, so the other subjects can be run to the end of step 4. */
  const stubbed: RunnerAIService = {
    generateLessonPlan: r => aiService.generateLessonPlan(r),
    generateActivity: r => aiService.generateActivity(r),
    generateWorksheet: async () => ({ ...MOCK_WORKSHEET }),
    generateQuiz: async () => ({ ...MOCK_QUIZ }),
  };

  it('the probe is not vacuous: the data does hold Arabic outcomes and concepts for English scopes', () => {
    const withArabic = scopes.filter(sel => revisionUnits(sel, 'en')
      .some(u => [...u.outcomes, ...u.concepts].some(x => ARABIC_LETTER.test(x))));
    assert.ok(withArabic.length > 100, `expected many, got ${withArabic.length}`);
  });

  it('no English plan has an Arabic letter in it, and no plan, warm-up or activity in either language says "this lesson"', async () => {
    const offenders: string[] = [];
    for (const sel of scopes) {
      for (const lang of ['ar', 'en'] as const) {
        const { req } = flowRequest(sel, lang);
        const out = await runLessonFlowFrom('objectives', req, stubbed, {}, { onStepStart: () => {}, onStepDone: () => {} });
        const where = `${sel.subjectId} ${sel.kind} ${lang}`;
        if (lang === 'en' && hasArabic(JSON.stringify(out.plan))) offenders.push(`${where}: plan Arabic`);
        // Maths and chemistry print their banks' Arabic answers in an English activity, as a lesson does.
        if (lang === 'en' && !BANKED.has(sel.subjectId)) {
          for (const k of ['warmup', 'activity'] as const) {
            if (hasArabic(JSON.stringify(out[k]))) offenders.push(`${where}: ${k} Arabic`);
          }
        }
        if (ONE_LESSON.test(JSON.stringify({ plan: out.plan, warmup: out.warmup, activity: out.activity }))) offenders.push(`${where}: lesson-shaped`);
      }
    }
    assert.deepEqual(offenders.slice(0, 10), [], `${offenders.length} offenders`);
  });
});

describe('the English plan, where the data holds Arabic', () => {
  const REVIEW_EN = /^Review the key ideas of the “([^”]+)” unit(?:: (“[^”]+”(?:, “[^”]+”){0,2}))?$/;
  const REVIEW_AR = /^مراجعة الأفكار الرئيسة في وحدة «([^»]+)»(?:: («[^»]+»(?:، «[^»]+»){0,2}))?$/;
  const norm = (x: string) => x.toLowerCase().replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
  const words = (x: string) => x.split(/\s+/).filter(Boolean).length;
  /** The properties an objective must have, whatever its exact wording. */
  function readable(o: string, lang: 'ar' | 'en'): string | null {
    const review = (lang === 'ar' ? REVIEW_AR : REVIEW_EN).exec(o);
    if (review) {
      const title = norm(review[1]!);
      const names = [...(review[2] ?? '').matchAll(/[“«]([^”»]+)[”»]/g)].map(m => norm(m[1]!));
      for (const n of names) if (title.includes(n)) return `lists «${n}», which only repeats the unit's name`;
      return null;
    }
    const at = o.indexOf(': ');
    if (at < 0) return 'neither a review line nor "Unit: outcome"';
    const head = o.slice(0, at), tail = o.slice(at + 2);
    if (norm(head) === norm(tail)) return 'repeats the unit title as its own outcome';
    // The Arabic outcomes are the Ministry's own wording and some are a single word; only an
    // English line is ours to judge, and it is built from English outcomes or concepts alone.
    if (lang === 'en' && (words(tail) < 2 || tail.length < 6)) return `a fragment after the unit name: «${tail}»`;
    return null;
  }

  it('objectives are sentences in both languages: no "Title: Title", no one-word tail, one shape for an outcome-less unit', async () => {
    const offenders: string[] = [];
    let reviewWithNames = 0, reviewPlain = 0, outcomeLines = 0;
    for (const sel of allScopes()) {
      for (const lang of ['ar', 'en'] as const) {
        const { req } = flowRequest(sel, lang);
        const plan = await aiService.generateLessonPlan(req);
        for (const o of plan.objectives) {
          const why = readable(o, lang);
          if (why) offenders.push(`${sel.subjectId} ${sel.kind} ${lang}: ${o} (${why})`);
          const m = (lang === 'ar' ? REVIEW_AR : REVIEW_EN).exec(o);
          if (m) { if (m[2]) reviewWithNames++; else reviewPlain++; } else outcomeLines++;
        }
      }
    }
    assert.deepEqual(offenders.slice(0, 8), [], `${offenders.length} unreadable objectives`);
    // Not vacuous: the scan met all three kinds of line.
    assert.ok(reviewWithNames > 500 && reviewPlain > 0 && outcomeLines > 500, `${reviewWithNames} / ${reviewPlain} / ${outcomeLines}`);
  });

  it('a unit with real English outcomes keeps them; one without names itself and lists concepts that add to its title', async () => {
    const english = await aiService.generateLessonPlan(flowRequest({ kind: 'semester', gradeId: 'grade-10', subjectId: 'english', semester: 1 }, 'en').req);
    assert.ok(english.objectives.some(o => /^Looking good: I can use Present Simple/.test(o)), english.objectives.slice(0, 3).join(' | '));
    const maths = await aiService.generateLessonPlan(flowRequest({ kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 }, 'en').req);
    // Mutation caught: falling back to `u.concepts` one by one («Circle: Chord: …») or to the bare generic line.
    assert.ok(maths.objectives.every(o => REVIEW_EN.test(o) && /: “/.test(o)), maths.objectives.join(' | '));
    // Arabic has the same structure for a unit with no outcomes (physical education has none).
    const pe = await aiService.generateLessonPlan(flowRequest({ kind: 'book', gradeId: 'grade-10', subjectId: 'physical-education' }, 'ar').req);
    const peEn = await aiService.generateLessonPlan(flowRequest({ kind: 'book', gradeId: 'grade-10', subjectId: 'physical-education' }, 'en').req);
    assert.ok(pe.objectives.length > 0 && pe.objectives.every(o => REVIEW_AR.test(o) && /: «/.test(o)), pe.objectives.join(' | '));
    assert.equal(pe.objectives.length, peEn.objectives.length);
  });

  it('a lesson whose title carries an Arabic gloss is still counted and named, with a long gloss cut', async () => {
    const glossed = allScopes().filter(sel => revisionUnits(sel, 'en')
      .some(u => u.lessons.some(l => ARABIC_LETTER.test(l.title))));
    assert.ok(glossed.length > 0, 'the data holds English lesson titles with Arabic letters');
    for (const sel of glossed.slice(0, 40)) {
      const { req } = flowRequest(sel, 'en');
      const plan = await aiService.generateLessonPlan(req);
      const left = revisionUnits(sel, 'en').flatMap(u => splitShown(u, REVISION_SHOWN_PER_UNIT).left).length;
      const said = /leaves out (\d+) lesson/.exec(plan.introduction);
      assert.equal(said ? Number(said[1]) : 0, left, `${sel.kind} ${sel.subjectId}: the count the plan states`);
      assert.ok(!hasArabic(plan.introduction), `${sel.kind} ${sel.subjectId}`);
    }
  });
});

describe('englishUnits', () => {
  it('names an Arabic-only title by its place, drops Arabic lines, cuts a long gloss and keeps every lesson', () => {
    const unit = {
      unitId: 'u', title: 'وحدة عربية فقط',
      lessons: [
        { id: 'a', title: 'Looking good (المظهر الحسن)', thin: false },
        { id: 'b', title: 'درس عربي فقط', thin: false },
        { id: 'c', title: 'Solving equations', thin: true },
      ],
      outcomes: ['أحل معادلة'], concepts: ['Slope', 'ميل'], terms: ['مصطلح'],
    };
    const [out] = englishUnits([unit]);
    assert.equal(out!.title, 'Unit 1');
    assert.deepEqual(out!.lessons.map(l => l.title), ['Looking good', 'Lesson 2', 'Solving equations']);
    assert.deepEqual(out!.lessons.map(l => l.id), ['a', 'b', 'c']);
    assert.deepEqual([out!.outcomes, out!.concepts, out!.terms], [[], ['Slope'], []]);
  });

  it('keeps a one-to-three-letter gloss, because there the letter is the lesson', () => {
    const titles = ['The Letter Baa (ب)', 'The Elongation Letter Alif (ا, ى)', 'The Letter Waw (و)'];
    const [out] = englishUnits([{
      unitId: 'u', title: 'Letters (حروف)', outcomes: [], concepts: [], terms: [],
      lessons: titles.map((title, i) => ({ id: String(i), title, thin: false })),
    }]);
    assert.deepEqual(out!.lessons.map(l => l.title), titles);
    assert.equal(out!.title, 'Letters');
    // A gloss of four letters is a word, not a letter: cut.
    const [word] = englishUnits([{ unitId: 'u', title: 'Letters (حروفا)', lessons: [], outcomes: [], concepts: [], terms: [] }]);
    assert.equal(word!.title, 'Letters');
  });

  it('the data\'s letter lessons come through with their letter', () => {
    const glossed = allScopes().flatMap(sel => revisionUnits(sel, 'en')).flatMap(u => u.lessons).filter(l => new RegExp(LETTER_GLOSS_G.source).test(l.title));
    assert.ok(glossed.length >= 30, `${glossed.length} letter lessons in the data`);
    const [unit] = englishUnits([{ unitId: 'u', title: 'x', outcomes: [], concepts: [], terms: [], lessons: glossed }]);
    assert.deepEqual(unit!.lessons.map(l => l.title), glossed.map(l => l.title));
  });

  it('keeps a Quranic mark inside a Latin title: it is content, not an Arabic word', () => {
    const [out] = englishUnits([{ unitId: 'u', title: 'Stops \u06D6 and pauses', lessons: [], outcomes: [], concepts: [], terms: [] }]);
    assert.equal(out!.title, 'Stops \u06D6 and pauses');
  });
});

describe('the English concepts of a revision activity', () => {
  it('drop an Arabic gloss from the key concepts AND the objectives, and keep a Quranic mark: one letters-only test for both', () => {
    const lesson = {
      id: 'x', unitId: 'u', keyConceptsEn: ['Stops \u06D6 and pauses', 'دراسة الجدوى', 'Recitation'],
      keyConceptsAr: [], keyTerms: [], objectives: [], rulesAr: [], rulesEn: [],
    } as unknown as KBLesson;
    const out = revisionActivityLesson([{ unitId: 'u', lessons: [lesson] }], 'k', { title: { ar: 'ع', en: 'e' }, lang: 'en' });
    // Mutation caught: the whole-script test on `objectives` drops the first concept there.
    for (const list of [out.keyConceptsEn, out.objectives]) {
      assert.ok(list.includes('Stops \u06D6 and pauses'), list.join(' | '));
      assert.ok(list.includes('Recitation'), list.join(' | '));
      assert.ok(!list.some(c => ARABIC_LETTER.test(c)), list.join(' | '));
    }
  });
});

describe('a failed step', () => {
  const t = (key: string) => `[${key}]`;

  it('keeps the cause\'s code and live error through the wrapper', async () => {
    const ai: RunnerAIService = {
      ...recording().ai,
      generateWorksheet: async () => { throw new NoQuestionBankError('الكتاب كاملًا'); },
    };
    await assert.rejects(
      () => runLessonFlowFrom('objectives', WIDE_REQ, ai, {}, noop),
      (e: unknown) => e instanceof LessonFlowStepError && e.stepKey === 'worksheet' && e.code === 'no_question_bank' && e.liveError === undefined,
    );
    const live = Object.assign(new NoQuestionBankError('x'), { liveError: 'HTTP 500' });
    assert.equal(new LessonFlowStepError('worksheet', live).liveError, 'HTTP 500');
    assert.equal(new LessonFlowStepError('worksheet', new Error('plain')).code, undefined);
    assert.equal(new LessonFlowStepError('worksheet', 'a string').message, 'a string');
  });

  it('a subject with no question bank shows the translated sentence and offers no Retry; a live failure keeps its Retry', () => {
    const bank = new LessonFlowStepError('worksheet', new NoQuestionBankError('الكتاب كاملًا'));
    // Mutation caught: showing `err.message` ("No offline question bank for …") raw.
    assert.deepEqual(lessonFlowFailure(bank, t), { message: '[noQuestionBank]', retryable: false });
    const live = new LessonFlowStepError('worksheet', Object.assign(new NoQuestionBankError('x'), { liveError: 'HTTP 500' }));
    const shown = lessonFlowFailure(live, t);
    assert.match(shown.message, /^\[noQuestionBankLiveFailed\]/);
    assert.equal(shown.retryable, true);
  });

  it('a failed step card tells the teacher to tap Retry only when the banner offers one', () => {
    const bank = new LessonFlowStepError('worksheet', new NoQuestionBankError('الكتاب كاملًا'));
    const live = new LessonFlowStepError('worksheet', Object.assign(new NoQuestionBankError('x'), { liveError: 'HTTP 500' }));
    for (const lang of ['ar', 'en']) {
      // Mutation caught: the card keeping its fixed «أعد المحاولة» / "tap Retry below".
      const noRetry = failedStepHint(lang, lessonFlowFailure(bank, t).retryable);
      assert.ok(noRetry.length > 0 && !/أعد المحاولة|Retry|retry/.test(noRetry), `${lang}: «${noRetry}»`);
      // Mutation caught: dropping the sentence for the case that does have a button.
      const withRetry = failedStepHint(lang, lessonFlowFailure(live, t).retryable);
      assert.ok(/أعد المحاولة|Retry/.test(withRetry), `${lang}: «${withRetry}»`);
    }
    // The card a retryable failure always showed, word for word.
    assert.equal(failedStepHint('ar', true), 'تعذّر إكمال الخطوة — أعد المحاولة');
    assert.equal(failedStepHint('en', true), 'Failed — tap Retry below');
  });

  it('the lesson-flow screen asks the hint for its card, with the same flag that hides the button', () => {
    const src = readFileSync(join(import.meta.dirname, '../../app/ai-tools/lesson-flow.tsx'), 'utf8');
    // Mutation caught: a card still hard-coding the Retry sentence, or not told `retryable`.
    assert.ok(src.includes('{failedStepHint(lang, retryable)}'));
    assert.ok(src.includes('retryable={retryable}'));
    assert.ok(!src.includes("'Failed — tap Retry below'"));
    assert.ok(src.includes('{retryable ? ('), 'the banner button is gated by the same flag');
  });

  it('an uncoded failure keeps its own message and its Retry, as it always did', () => {
    assert.deepEqual(lessonFlowFailure(new LessonFlowStepError('activity', new Error('HTTP 500')), t), { message: 'HTTP 500', retryable: true });
    assert.deepEqual(lessonFlowFailure('boom', t), { message: 'Generation failed', retryable: true });
  });

  it('a lesson flow and a wide flow on a bank-less subject fail the same way', async () => {
    const histUnit = getUnitsForSubjectGrade('history', 'grade-10')[0]!;
    const wide = flowRequest({ kind: 'unit', gradeId: 'grade-10', subjectId: 'history', unitId: histUnit.id }, 'ar').req;
    const lessonKb = getLessonsForUnit(histUnit.id)[0]!;
    const lesson: AIRequest = { grade: 'G', subject: 'History', topic: lessonKb.titleAr, language: 'arabic', lessonId: lessonKb.id };
    const ai: RunnerAIService = {
      generateLessonPlan: r => aiService.generateLessonPlan(r), generateActivity: r => aiService.generateActivity(r),
      generateWorksheet: r => aiService.generateWorksheet(r), generateQuiz: r => aiService.generateQuiz(r),
    };
    const seen: Array<{ step: StepKey; code?: string }> = [];
    for (const req of [wide, lesson]) {
      try { await runLessonFlowFrom('objectives', req, ai, {}, noop); } catch (e) { const err = e as LessonFlowStepError; seen.push({ step: err.stepKey, code: err.code }); }
    }
    assert.deepEqual(seen, [{ step: 'worksheet', code: 'no_question_bank' }, { step: 'worksheet', code: 'no_question_bank' }]);
  });
});

describe('the flow PDF', () => {
  const wide = flowRequest({ kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 }, 'ar');
  const flowOf = async (lang: 'ar' | 'en') => {
    const { req } = flowRequest({ kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 }, lang);
    const out = await runLessonFlowFrom('objectives', req, {
      generateLessonPlan: r => aiService.generateLessonPlan(r),
      generateActivity: r => aiService.generateActivity(r),
      generateWorksheet: r => aiService.generateWorksheet(r),
      generateQuiz: r => aiService.generateQuiz(r),
    }, {}, { onStepStart: () => {}, onStepDone: () => {} });
    return {
      topic: req.topic, grade: req.grade, subject: req.subject, duration: 45,
      objectives: out.objectives!, warmup: out.warmup!, activity: out.activity!, guidedPractice: out.guidedPractice!,
      worksheet: out.worksheet!, exitTicket: out.exitTicket!,
    } as LessonFlowOutput;
  };

  it('a lesson flow prints exactly what it always did, whether the option is left out, empty or false', async () => {
    assert.ok(wide.req.scope);
    const flow = await flowOf('ar');
    const plain = buildLessonFlowHTML(flow, true);
    assert.equal(buildLessonFlowHTML(flow, true, [], {}), plain);
    assert.equal(buildLessonFlowHTML(flow, true, [], { revision: false }), plain);
    assert.match(plain, /مسار الدرس الكامل/);
    assert.match(plain, /غلق الدرس/);
  });

  it('a revision flow calls itself one, in both languages', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const flow = await flowOf(lang);
      const html = buildLessonFlowHTML(flow, lang === 'ar', [], { revision: true });
      if (lang === 'ar') {
        assert.match(html, /مسار المراجعة الكامل/);
        assert.match(html, /غلق الحصة/);
        assert.doesNotMatch(html, /مسار الدرس الكامل|غلق الدرس/);
      } else {
        assert.match(html, /Complete Revision Flow/);
        assert.doesNotMatch(html, /Complete Lesson Flow/);
      }
    }
  });
});
