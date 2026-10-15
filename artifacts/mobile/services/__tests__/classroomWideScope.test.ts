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
import { lessonsInScope, scopeLabel, unitsInScope, type ScopeSelection } from '../scopeSelection.ts';
import { getLessonById } from '../knowledgeBase.ts';
import { ACTIVITY_CARDS } from '../classroomRouting.ts';

// The mock service's simulated latency is 1–2 s per call; nothing here needs it.
(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const TYPES = ACTIVITY_CARDS.map(c => c.id);
const SUBJECT: Record<string, string> = { mathematics: 'Mathematics', history: 'History', chemistry: 'Chemistry' };
const chemSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'chemistry', semester: 1 };
const mathSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'mathematics', semester: 1 };
const histSem1: ScopeSelection = { kind: 'semester', gradeId: 'grade-10', subjectId: 'history', semester: 1 };
const mathBook: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'mathematics' };
const histBook: ScopeSelection = { kind: 'book', gradeId: 'grade-10', subjectId: 'history' };
const mathUnit: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'mathematics', unitId: 'kbu-math-s1-nccd-u2' };
const histUnit: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'history', unitId: 'kbu-hist-s1-nccd-u1' };
const chemUnit: ScopeSelection = { kind: 'unit', gradeId: 'grade-10', subjectId: 'chemistry', unitId: 'kbu-chem-s1-nccd-u1' };
const unitCount = (sel: ScopeSelection) => unitsInScope(sel).length;

/**
 * The one-lesson sentences the templates hold, written out here on purpose, NOT
 * read from `classroomRevisionRewords`: if the table loses an entry, its
 * sentence survives into the wide output and this list catches it. `{p}` is the
 * scope's phrase. A test below pins the list to the table so it cannot go stale.
 */
const LESSON_SHAPED: Record<'ar' | 'en', string[]> = {
  ar: [
  'المصطلح 1: تعريف {p}',
  'المصطلح 2: خاصية {p}',
  'المصطلح 3: تطبيق {p}',
  'فكّر في تعريف {p}',
  'من وحدة {p}',
  'خاصية: {p} يُستخدم عندما…',
  'ما الفرق بين المفهومين الرئيسيين في {p}؟',
  'الفرق بين مفهومَي {p}',
  'أي خاصية من خصائص {p} تنطبق',
  'طبّق {p} على المعطيات التالية',
  'القيمة الأولى (أ) من تطبيق {p}',
  'الآن طبّق {p} مرة أخرى مع (أ)',
  'طبّق خاصية {p} الثانية مع (ب)',
  'طبّق {p} بالكامل لإيجاد الإجابة النهائية',
  'اليوم طبّقتم {p} في سلسلة متكاملة',
  'هل تتذكر هذا المصطلح من الدرس؟',
  'أين طبّقنا هذا في الدرس؟',
  'تذكّر صيغ وحدتنا',
  'اربط السؤال بخطوة الحل التي درسناها',
  'استخدم الخطوات التي درسناها اليوم',
  'تذكّر الخاصية الثانية التي درسناها',
  'طبّق التعريف الأساسي لـ{p}',
  'تطبيق مباشر للتعريف الأساسي لـ{p}',
  'كيف يُستخدم {p} لحل هذا الموقف الحياتي؟',
  'بين مفهومين رئيسيين في {p}؟',
  'عرّف المفهوم الرئيسي لـ{p}.',
  'تعريف دقيق بكلمات الطالب لـ{p}',
  'طبّق {p} على مثال من الكتاب المدرسي',
  'متى لا ينجح أسلوب {p} الذي درسناه اليوم؟',
  'اذكر موقفًا حياتيًا يستخدم {p}.',
    // Whatever the phrase, these claim one lesson.
    'درس اليوم',
    'هذا الدرس',
  ],
  en: [
  'Term 1: definition of {p}',
  'Term 2: property of {p}',
  'Term 3: application of {p}',
  'Think about the definition of {p}',
  'from the {p} unit',
  'Property: {p} is used when…',
  'The distinction between the two concepts in {p}',
  'Which property of {p} applies',
  'Apply {p} to the given data',
  'First value (a) from applying {p}',
  'Now apply {p} again with (a)',
  'Apply the second property of {p} with (b)',
  'Apply the full {p} process to find the final answer',
  'Today you applied {p} across a full connected chain',
  'Do you remember this term from the lesson?',
  'Recall the formulas from our unit',
  'Connect the clue to the solution steps we studied',
  'Use the steps we practised today',
  'Recall the second property we studied',
  'Think about what we covered at the start of the lesson',
  'Apply the core definition of {p}',
  'Direct application of the core {p} definition',
  'How does {p} apply to this real-world scenario?',
  'between the two key concepts in {p}?',
  'Define the main concept of {p}.',
  'An accurate student-worded definition of {p}',
  'Apply {p} to an example from the textbook',
  'When does the {p} method we learned today NOT work?',
  'Name a real-world situation that uses {p}.',
    "today's lesson",
    'this lesson',
  ],
};
const lessonShaped = (phrase: string, lang: 'ar' | 'en') => LESSON_SHAPED[lang].map(t => t.split('{p}').join(phrase));
/** Said of two units, or of one that is "another". False in a scope that has one unit. */
const SEVERAL_UNITS: Record<'ar' | 'en', string[]> = {
  ar: ['وحدتين مختلفتين', 'وحدة أخرى'],
  en: ['different units', 'another unit', 'other unit'],
};

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

  const cases: Array<[ScopeSelection, 'ar' | 'en']> = [];
  for (const sel of [mathSem1, histSem1, chemSem1, mathBook, histBook, mathUnit, histUnit, chemUnit]) {
    for (const lang of ['ar', 'en'] as const) cases.push([sel, lang]);
  }
  for (const [sel, lang] of cases) {
    it(`${sel.kind} ${sel.subjectId} (${lang}): every type names the phrase, never the label, and no one-lesson sentence`, async () => {
      const phrase = revisionPhrase(sel, lang);
      const label = scopeLabel(sel, lang);
      const table = classroomRevisionRewords(phrase, lang, unitCount(sel));
      for (const type of TYPES) {
        const a = await aiService.generateClassroomActivity(classReq(sel, type, lang));
        const text = textOf(a);
        assert.equal(a.activityType, type);
        // Mutation caught: leaving `topic = req.topic` on the wide path.
        assert.equal(a.lesson, phrase, type);
        assert.ok(a.activityName.endsWith(phrase), `${type}: ${a.activityName}`);
        // A unit's own title is also its content («الدائرة» is a concept of that
        // unit), so the label check is for the scopes whose label is not content.
        // `a.lesson` and the name above cover a unit.
        if (sel.kind !== 'unit') assert.ok(!text.includes(label), `${type} spliced the label «${label}»`);
        // Mutation caught: dropping the `reviseWording` call in `classroomActivityOnce`.
        for (const [from] of table) assert.ok(!text.includes(from), `${type}: «${from}»`);
        // Mutation caught: removing ANY entry of the table. The list is the test's
        // own, so a missing entry cannot hide by leaving the list too.
        for (const bad of lessonShaped(phrase, lang)) assert.ok(!text.includes(bad), `${type} still says «${bad}»`);
        if (unitCount(sel) === 1) {
          for (const bad of SEVERAL_UNITS[lang]) assert.ok(!text.includes(bad), `${type}: one unit, yet «${bad}»`);
        }
        assert.ok(a.slides.length >= 3, type);
      }
    });
  }

  it('the forbidden list and the table cover each other, so neither goes stale', () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      const listed = new Set(lessonShaped(phrase, lang));
      for (const [from] of classroomRevisionRewords(phrase, lang, 2)) assert.ok(listed.has(from), `${lang}: «${from}» is in the table, not the list`);
      // The single-unit table rewrites the same sentences, to something true of one unit.
      assert.deepEqual(
        classroomRevisionRewords(phrase, lang, 1).map(([f]) => f),
        classroomRevisionRewords(phrase, lang, 2).map(([f]) => f),
      );
    }
  });

  it('a one-unit scope never speaks of other units; a several-unit scope still may', () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      const tos = (n: number) => classroomRevisionRewords(phrase, lang, n).map(([, to]) => to).join('\n');
      for (const bad of SEVERAL_UNITS[lang]) {
        assert.ok(!tos(1).includes(bad), `${lang}: «${bad}»`);
      }
      // Mutation caught: giving a unit scope the semester's wording.
      assert.ok(SEVERAL_UNITS[lang].some(bad => tos(2).includes(bad)), `${lang}: a semester names its other units`);
    }
  });

  it('every reworded sentence is a real template sentence (a dead entry fails here)', async () => {
    for (const lang of ['ar', 'en'] as const) {
      const phrase = revisionPhrase(histSem1, lang);
      let text = '';
      for (const type of TYPES) {
        // A lesson request whose topic happens to BE the phrase: no scope, so no rewording.
        const req: ClassroomActivityRequest = { ...classReq(histSem1, type, lang), scope: undefined, coverage: undefined, topic: phrase };
        text += textOf(await aiService.generateClassroomActivity(req)) + '\n';
      }
      for (const [from] of classroomRevisionRewords(phrase, lang, 2)) assert.ok(text.includes(from), `${lang}: dead entry «${from}»`);
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

describe('offline classroom activity — an English paper holds no Arabic outcome or concept', () => {
  const ARABIC = /[\u0600-\u06FF]/;
  it('a history scope, which has no bank, is Arabic-free for all seven types (as the lesson path is)', async () => {
    // Probe: the lesson path in English, every history lesson of the semester.
    for (const l of lessonsInScope(histSem1)) for (const type of TYPES) {
      const a = await aiService.generateClassroomActivity({
        grade: 'Grade 10', subject: 'History', topic: l.titleEn, lessonId: l.id, activityType: type,
        duration: 20, difficulty: 'standard', groupType: 'groups', teachingGoal: 'revision', language: 'english',
      });
      assert.ok(!ARABIC.test(textOf(a)), `probe: the lesson path prints Arabic in English (${type}, ${l.id})`);
    }
    for (const sel of [histSem1, histBook, histUnit]) for (const type of TYPES) {
      const text = textOf(await aiService.generateClassroomActivity(classReq(sel, type, 'en')));
      // Mutation caught: `objectives` read from the Arabic concepts in an English paper.
      assert.ok(!ARABIC.test(text), `${sel.kind} ${type}: ${text.match(/[^\n]*[\u0600-\u06FF][^\n]*/)?.[0]}`);
    }
  });

  it('no scope puts one of its Arabic outcomes or concepts into an English paper', async () => {
    // Maths and chemistry banks answer in Arabic in an English paper, in the lesson
    // path too (the probe below), so those scopes are held to the outcomes and
    // concepts only, which are what the wide path alone used to leak.
    for (const sel of [histSem1, mathSem1, chemSem1, mathUnit]) {
      const source = lessonsInScope(sel).flatMap(l => [...l.objectives, ...l.keyConceptsAr]).map(t => t.trim()).filter(t => t.length > 4);
      assert.ok(source.length > 0, `probe: ${sel.subjectId} has Arabic outcomes`);
      for (const type of TYPES) {
        const text = textOf(await aiService.generateClassroomActivity(classReq(sel, type, 'en')));
        for (const t of source) assert.ok(!text.includes(t), `${sel.kind} ${sel.subjectId} ${type}: «${t}»`);
      }
    }
  });

  it('an English history quick check asks about the English concepts of two units or more', async () => {
    const qc = await aiService.generateClassroomActivity(classReq(histSem1, 'quick-check', 'en'));
    const owner = new Map<string, string>();
    for (const l of lessonsInScope(histSem1)) for (const c of l.keyConceptsEn) owner.set(c, l.unitId);
    const units = new Set(qc.slides.filter(s => s.type === 'challenge')
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
