/**
 * The classroom builder on a unit, a semester or the whole book.
 *
 * Its seven types were written for one lesson and splice the topic into
 * sentences («بينجو الفصل الأول كاملًا», «عرّف المفهوم الرئيسي لـ…»). On a wide
 * scope the topic is the scope's revision phrase, never its label; the banked
 * types (quick check, bingo, relay on maths) draw their items from the scope's
 * lessons one unit after another; and the fixed-template sentences that claim
 * one lesson are reworded. A lesson's activity is untouched.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aiService } from '../ai/generators.ts';
import type { ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';
import { classroomRevisionRewords } from '../ai/revisionWording.ts';
import { buildScopeRequest } from '../wideScopeRequest.ts';
import { revisionPhrase } from '../revisionScope.ts';
import { lessonsInScope, scopeLabel, type ScopeSelection } from '../scopeSelection.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { ACTIVITY_CARDS } from '../classroomRouting.ts';

// The mock service's simulated latency is 1–2 s per call; nothing here needs it.
(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const TYPES = ACTIVITY_CARDS.map(c => c.id);
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', history: 'History' };
const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };

function classReq(sel: ScopeSelection, activityType: string, lang: 'ar' | 'en' = 'ar'): ClassroomActivityRequest {
  const wide = buildScopeRequest(sel, lang);
  assert.ok(wide, `probe: ${sel.subjectId} semester 1 should ground`);
  return {
    grade: 'Grade 10', subject: SUBJECT[sel.subjectId]!, topic: scopeLabel(sel, lang), activityType,
    duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'revision',
    language: lang === 'ar' ? 'arabic' : 'english',
    ...wide.fields,
  };
}

const strings = (v: unknown, out: string[] = []): string[] => {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach(x => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach(x => strings(x, out));
  return out;
};
const textOf = (a: ClassroomActivity) => strings(a).join('\n');

describe('offline classroom activity — a wide scope', () => {
  it('there are seven types', () => {
    assert.deepEqual([...TYPES].sort(), ['bingo', 'error-detective', 'escape-challenge', 'exit-ticket', 'gallery-walk', 'quick-check', 'relay']);
  });

  const cases: Array<[ScopeSelection, 'ar' | 'en']> = [[mathSem1, 'ar'], [histSem1, 'ar'], [histSem1, 'en']];
  for (const [sel, lang] of cases) {
    it(`${sel.subjectId} (${lang}): every type names the phrase, never the label, and no one-lesson sentence`, async () => {
      const phrase = revisionPhrase(sel, lang);
      const label = scopeLabel(sel, lang);
      const table = classroomRevisionRewords(phrase, lang);
      for (const type of TYPES) {
        const a = await aiService.generateClassroomActivity(classReq(sel, type, lang));
        const text = textOf(a);
        assert.equal(a.activityType, type);
        // Mutation caught: leaving `topic = req.topic` on the wide path.
        assert.equal(a.lesson, phrase, type);
        assert.ok(a.activityName.endsWith(phrase), `${type}: ${a.activityName}`);
        assert.ok(!text.includes(label), `${type} spliced the label «${label}»`);
        // Mutation caught: dropping the `reviseWording` call in `classroomActivityOnce`.
        for (const [from] of table) assert.ok(!text.includes(from), `${type}: «${from}»`);
        assert.ok(a.slides.length >= 3, type);
      }
    });
  }

  it('every reworded sentence is a real template sentence (a dead entry fails here)', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      let text = '';
      for (const type of TYPES) {
        // A lesson request whose topic happens to BE the phrase: no scope, so no rewording.
        const req: ClassroomActivityRequest = { ...classReq(histSem1, type, lang), scope: undefined, coverage: undefined, topic: phrase };
        text += textOf(await aiService.generateClassroomActivity(req)) + '\n';
      }
      for (const [from] of classroomRevisionRewords(phrase, lang)) assert.ok(text.includes(from), `${lang}: dead entry «${from}»`);
    }
  });

  it('a maths scope takes the banked forms of quick check, bingo and relay', async () => {
    const qc = await aiService.generateClassroomActivity(classReq(mathSem1, 'quick-check'));
    const questions = qc.slides.filter(s => s.type === 'question');
    // Mutation caught: the quick check's per-lesson loop left in place on a
    // revision, which draws from the composite lesson and finds no family.
    assert.ok(questions.length >= 2, `quick check: ${questions.length} bank questions`);
    for (const s of questions) assert.ok((s.options?.length ?? 0) >= 2);
    const bingo = await aiService.generateClassroomActivity(classReq(mathSem1, 'bingo'));
    assert.ok(bingo.activityName.startsWith('بينجو مسائل'), bingo.activityName);
    assert.ok(bingo.slides.filter(s => s.type === 'bingo-call').length >= 4);
    const relay = await aiService.generateClassroomActivity(classReq(mathSem1, 'relay'));
    assert.ok(relay.learningObjective.startsWith('حل أربع مسائل محددة'), relay.learningObjective);
  });

  it('a scope with no bank asks open questions drawn from two units or more', async () => {
    const qc = await aiService.generateClassroomActivity(classReq(histSem1, 'quick-check'));
    const owner = new Map<string, string>();
    for (const l of lessonsInScope(histSem1)) {
      const kb = getLessonById(l.id);
      for (const c of kb?.keyConceptsAr ?? []) owner.set(c, kb!.unitId);
    }
    const units = new Set(qc.slides
      .filter(s => s.type === 'challenge')
      .flatMap(s => [...owner].filter(([c]) => (s.content ?? '').includes(c)).map(([, u]) => u)));
    assert.ok(units.size >= 2, `${[...units].join(', ')}`);
  });
});

describe('offline classroom activity — a lesson is unchanged', () => {
  it('a lesson request with a lesson table but no scope is built exactly as without one', async () => {
    const coverage = buildScopeRequest(histSem1, 'ar')!.fields.coverage;
    const lesson = getLessonById('kbl-hist-s1-nccd-u1_l1')!;
    for (const type of TYPES) {
      const req: ClassroomActivityRequest = {
        grade: 'Grade 10', subject: 'History', topic: lesson.titleAr, lessonId: lesson.id, activityType: type,
        duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'practice', language: 'arabic',
      };
      // Mutation caught: keying the revision branch on `coverage` instead of `scope`.
      assert.deepEqual(await aiService.generateClassroomActivity({ ...req, coverage }), await aiService.generateClassroomActivity(req), type);
    }
  });
});
