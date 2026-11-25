/**
 * Grade 4 plans, activities, quick checks and reviews are written for nine-year-olds.
 *
 * Swept 2026-11-25: every one of the 313 Grade 4 lessons got the all-grades plan and
 * activities — «اكتب من ذاكرتك — الدفاتر مغلقة», a claim to defend, a debate, teams betting
 * points, a written summary, a 3-2-1 exit card and an individual worksheet; a 10-sentence
 * «ملخصًا شخصيًا» for maths homework; all 19 science lessons a controlled experiment; and, in
 * Islamic education, the arts, PE, digital literacy and vocational education, a card template
 * that had nothing to do with the subject («تعريف قِصَّةُ نَبِيِّ اللهِ سَيِّدِنا آدَمَ بمثال»,
 * «خطأ شائع وكيف نتجنّبه», a written answer on the board in a PE lesson). Grade 4 now has the
 * early-grade versions at its own level (`fourthGradeContent` in `lessonPlanFirstGrade.ts`):
 * Grade 3's maths, science, social studies and English with a little more of the child's own,
 * a short paragraph of three sentences in Arabic, and digital literacy and vocational education
 * each a practical task of their own. Grade 5 keeps the all-grades ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService, buildOfflineActivity } from '../ai/generators.ts';
import { ACTIVITY_BLUEPRINT_IDS } from '../ai/activityBlueprints.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { arabicLessonType, earlyGradeOf, isPunctuation, titleDetail } from '../ai/lessonPlanFirstGrade.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';
import type { ActivityOutput, AIRequest, ClassroomActivityRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G4 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-4');
const fold = (s: string) => s.replace(/[ً-ْٰ]/g, '');
const find = (re: RegExp, subject: string) => G4.find(l => getBookForLesson(l)!.subjectId === subject && re.test(fold(l.titleAr)))!;
const subjectOf = (id: string) => getBookForLesson(getLessonById(id)!)!.subjectId;

const base = (lessonId: string) => {
  const l = getLessonById(lessonId)!;
  const b = getBookForLesson(l)!;
  return { grade: 'الصف الرابع', subject: b.subjectId, topic: l.titleAr, lessonId, language: 'arabic', duration: 45 } as AIRequest;
};
const planFor = (id: string, style: string) => aiService.generateLessonPlan({ ...base(id), teachingStyle: style as AIRequest['teachingStyle'] });

const planText = (p: LessonPlanOutput) => [
  ...p.objectives, ...p.materials, p.introduction, p.mainActivity, p.guidedPractice,
  p.independentPractice, p.closure, p.assessment, p.differentiation, p.homework,
].join('\n');
const actText = (a: ActivityOutput) => [
  a.title, a.objective, a.groupSize, ...a.materials, ...a.steps.flatMap(s => [s.title, s.description]),
  ...a.teacherTips, a.differentiation, a.assessment,
].join('\n');

/**
 * What the all-grades plans and activities asked of Grade 4 (2026-11-25). A short paragraph is
 * what Grade 4 writes, so «فقرة قصيرة من ثلاث جمل» is allowed; the old 10-sentence summary and
 * 4–5-sentence paragraph are not.
 */
const TOO_OLD = [
  /اكتب من ذاكرتك/, /الدفاتر مغلقة/, /ادعاء/, /برّر|تبرير|علّل/, /ملخصًا شخصيًا|من 10 جمل|فقرة من خمس|\(٤–٥ جمل\)/, /تجربة مضبوطة/,
  /المتغير/, /مثال محلول/, /يراهن|رهان/, /اشرح بكلماتك/, /ملخّص|لخّص|ملخص/, /مناظرة|جدال|حجج/, /ورقة عمل فردية/,
  /خريطة مفاهيم/, /بطاقة خروج/, /3-2-1/,
];
/** The card template that was written for every subject and fits none of the practical ones. */
const GENERIC_CARDS = /تعريف .* بمثال|خطأ شائع وكيف|ربط الموضوع بموقف حياتي/;
/** Grade 1's counting, colouring and pointing, where Grade 4 has its own content. */
const TOO_YOUNG = /المكعبات أو الحبات|بالأصابع|يجيب(?: الأطفال)? بكلمة أو بإشارة|يعدّها الأطفال معي/;
const G4_LIMIT = /ولا تزيد الكتابة على فقرة قصيرة من أربع أو خمس جمل يكتبها الطفل بنفسه/;
const TEACHER_FIELDS = ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation'] as const;

describe('which lessons are Grade 4', () => {
  it('every Grade 4 subject has lessons, and a lesson is judged by its own book', () => {
    assert.ok(G4.length >= 300, String(G4.length));
    assert.equal(new Set(G4.map(l => getBookForLesson(l)!.subjectId)).size, 10);
    assert.equal(earlyGradeOf(G4[0]!), 4);
    for (const g of ['الصف الرابع', 'الصَّفُّ الرَّابِعُ', 'Grade 4', 'grade-4']) assert.equal(earlyGradeOf(null, g), 4, g);
    for (const g of ['الصف الخامس', 'الصف الرابع عشر', 'Grade 14', '']) assert.equal(earlyGradeOf(null, g), null, g);
  });
});

describe('every Grade 4 lesson plan, every style', () => {
  it('asks nothing the all-grades plan asked, uses no subject-blind card, keeps the teacher’s voice and states the Grade 4 limit', async () => {
    const bad: string[] = [];
    for (const l of G4) {
      const sub = getBookForLesson(l)!.subjectId;
      for (const style of LESSON_STYLE_IDS) {
        const p = await planFor(l.id, style);
        const t = planText({ ...p, objectives: [] });
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${style}: ${re}`);
        if (GENERIC_CARDS.test(t)) bad.push(`${l.id} · ${style}: the generic card template`);
        if (['mathematics', 'science', 'social', 'english'].includes(sub) && TOO_YOUNG.test(t)) bad.push(`${l.id} · ${style}: Grade 1’s content`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${style}: a template leaked`);
        if (!G4_LIMIT.test(p.assessment)) bad.push(`${l.id} · ${style}: no Grade 4 writing limit`);
        for (const f of TEACHER_FIELDS) { const hits = imperativesIn(p[f]); if (hits.length) bad.push(`${l.id} · ${style} · ${f}: ${hits}`); }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) if (!FIRST_PERSON.test(norm(p[f]))) bad.push(`${l.id} · ${style} · ${f}: never «سأ…»`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('maths is a model, then four examples on a board; science records in a table and writes a paragraph of three sentences', async () => {
    const maths = await planFor(find(/^الضرب في 4$|^الضرب/, 'mathematics').id, 'direct');
    assert.match(maths.independentPractice, /يحلّ كل طفل على لوحه أربعة أمثلة/);
    assert.match(maths.homework, /أربعة أمثلة/);
    assert.doesNotMatch(planText(maths), /10 جمل/);
    const science = await planFor(find(/^الحواس الخمس$/, 'science').id, 'inquiry');
    assert.match(science.guidedPractice, /جدول من عمودين/);
    assert.match(science.independentPractice, /فقرة قصيرة من ثلاث جمل: ما الذي رآه، وهل صدق توقعه، ولماذا/);
    assert.match(science.assessment, /بجملة صحيحة/);
  });

  it('Islamic education, PE and the arts get their own content, not a definition card', async () => {
    const surah = await planFor(find(/^سورة/, 'islamic').id, 'direct');
    assert.match(surah.independentPractice, /يتلو كل طفل ما حفظه/);
    const story = await planFor(find(/^قصة نبي الله/, 'islamic').id, 'collaborative');
    assert.doesNotMatch(planText(story), /تعريف .* بمثال/);
    const pe = await planFor(find(/^الإحساس بالكرة$/, 'physical-education').id, 'collaborative');
    assert.doesNotMatch(planText(pe), /تكتب المجموعة إجابة واحدة كاملة على اللوح/);
  });
});

describe('digital literacy and vocational education are practical tasks of their own', () => {
  it('a digital-literacy lesson is a screen task, step by step, on a device or on paper', async () => {
    const l = find(/^برمجها بنفسك/, 'digital-literacy');
    const p = await planFor(l.id, 'direct');
    assert.match(p.mainActivity, /على الشاشة \(أو على لوحة ورقية إن لم تتوفر الأجهزة\)/);
    assert.match(p.independentPractice, /ما فعله، وما صادفه من صعوبة، وكيف حلّها/);
    assert.ok(p.materials.some(m => /حاسوب أو جهاز لوحي/.test(m)), p.materials.join(' | '));
    const hands = actText(buildOfflineActivity({ ...base(l.id), activityType: 'hands-on' } as AIRequest));
    assert.match(hands, /ينفّذ كل ثنائي جزءًا من المهمة على الجهاز/);
    assert.match(hands, /نستعمل الأجهزة بهدوء/);
    assert.doesNotMatch(hands, /المقص والصمغ|صلصال/);
  });

  it('a vocational lesson shows the skill with its safety rule, practises it and writes what was done', async () => {
    const l = find(/^التعامل مع مواد التنظيف$/, 'vocational-education');
    const p = await planFor(l.id, 'direct');
    assert.match(p.mainActivity, /أبدأ بقاعدة السلامة التي تخصّها/);
    assert.match(p.independentPractice, /ما قاعدة السلامة التي التزم بها/);
    const hands = actText(buildOfflineActivity({ ...base(l.id), activityType: 'hands-on' } as AIRequest));
    assert.match(hands, /نستعمل الأدوات كما أريناكم/);
    assert.doesNotMatch(hands, /المقص والصمغ|صلصال/);
    const game = actText(buildOfflineActivity({ ...base(l.id), activityType: 'game' } as AIRequest));
    assert.match(game, /«آمن» أو «غير آمن»/);
  });
});

describe('Grade 4 Arabic follows the book’s strands, with a short paragraph', () => {
  it('a reading lesson reads its own text and answers three questions in full sentences', async () => {
    const l = find(/^أقرأ بطلاقة وفهم/, 'arabic');
    const p = await planFor(l.id, 'direct');
    const text = titleDetail(l.titleAr)!;
    assert.ok(p.objectives.some(o => o.includes(`نص «${text}»`)), p.objectives.join(' | '));
    assert.match(p.independentPractice, /يجيب في دفتره عن ثلاثة أسئلة عن النص بجملة كاملة لكل منها/);
    assert.match(p.homework, /فقرة قصيرة من ثلاث جمل عمّا أعجبه فيه ولماذا/);
  });

  it('a spelling lesson writes five words by its rule and a paragraph using three of them; a punctuation lesson stays in sentences', async () => {
    const spelling = G4.find(l => getBookForLesson(l)?.subjectId === 'arabic' && arabicLessonType(l.titleAr).type === 'write' && !isPunctuation(titleDetail(l.titleAr)))!;
    assert.ok(spelling, 'no Grade 4 spelling lesson');
    const p = await planFor(spelling.id, 'direct');
    assert.match(p.independentPractice, /خمس كلمات فيها .*، ثم فقرة قصيرة من ثلاث جمل تستعمل ثلاثًا منها/);
    const punct = KB_LESSONS.find(l => getBookForLesson(l)?.gradeId === 'grade-4' && getBookForLesson(l)?.subjectId === 'arabic' && isPunctuation(titleDetail(l.titleAr)));
    if (punct) {
      const q = await planFor(punct.id, 'direct');
      assert.match(q.mainActivity, /سأكتب على السبورة جملًا من الكتاب فيها/);
    }
  });
});

describe('every Grade 4 activity format', () => {
  it('asks nothing the all-grades activities asked, uses no subject-blind card, and its steps add up', () => {
    const bad: string[] = [];
    for (const l of G4) {
      const sub = getBookForLesson(l)!.subjectId;
      for (const type of ACTIVITY_BLUEPRINT_IDS) {
        const a = buildOfflineActivity({ ...base(l.id), activityType: type === 'warmup' ? 'group' : type, ...(type === 'warmup' ? { activityVariant: 'warmup' } : {}) } as AIRequest);
        const t = actText(a);
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${type}: ${re}`);
        if (GENERIC_CARDS.test(t)) bad.push(`${l.id} · ${type}: the generic card template`);
        if (sub === 'mathematics' && TOO_YOUNG.test(t)) bad.push(`${l.id} · ${type}: Grade 1’s counting`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${type}: a template leaked`);
        const sum = a.steps.reduce((s, x) => s + x.durationMin, 0);
        if (sum !== a.totalDuration) bad.push(`${l.id} · ${type}: steps ${sum} ≠ ${a.totalDuration}`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });
});

describe('the Grade 4 quick check', () => {
  it('is spoken and answered all together for every lesson with no bank, and a reading lesson asks about its text', async () => {
    const bad: string[] = [];
    for (const l of G4) {
      if (getBookForLesson(l)!.subjectId === 'mathematics') continue;
      const a = await aiService.generateClassroomActivity({ ...base(l.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
      const t = a.slides.map(s => `${s.title}\n${s.content ?? ''}`).join('\n');
      if (/اشرح بكلماتك|اكتب إجابتك/.test(t)) bad.push(`${l.id}: asks for writing`);
      if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id}: a template leaked`);
      if (a.slides.filter(s => s.type === 'challenge').length < 3) bad.push(`${l.id}: fewer than 3 prompts`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
    const read = find(/^أقرأ بطلاقة وفهم/, 'arabic');
    const a = await aiService.generateClassroomActivity({ ...base(read.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
    assert.match(a.slides.map(s => s.content).join('\n'), new RegExp(`من الشخصيات في نص «${titleDetail(read.titleAr)!.replace(/[()]/g, '\\$&')}»`));
  });
});

describe('a Grade 4 review (unit or semester)', () => {
  it('is the early-grade review with the Grade 4 writing limit', async () => {
    const bad: string[] = [];
    for (const subjectId of ['arabic', 'mathematics', 'science', 'islamic', 'social']) {
      const sel: ScopeSelection = { kind: 'semester', gradeId: 'grade-4', subjectId, semester: 1 };
      const ls = lessonsInScope(sel);
      if (!ls.length) { bad.push(`${subjectId}: no lessons in scope`); continue; }
      const p = await aiService.generateLessonPlan({
        grade: 'الصف الرابع', subject: subjectId, topic: 'مراجعة', language: 'arabic', duration: 45, teachingStyle: 'direct',
        scope: { kind: 'semester', scopeKey: scopeKey(sel), unitIds: [...new Set(ls.map(l => l.unitId))] },
        coverage: { lessons: ls.map((l, i) => ({ code: `L${i + 1}`, id: l.id, unitId: l.unitId, title: l.titleAr })) },
      } as AIRequest);
      const t = planText({ ...p, objectives: [] });
      for (const re of [...TOO_OLD, /ورقة مراجعة/]) if (re.test(t)) bad.push(`${subjectId}: ${re}`);
      if (!G4_LIMIT.test(p.assessment)) bad.push(`${subjectId}: no Grade 4 writing limit`);
      if (!/يحلّ كل طفل في دفتره مثالًا من كل .* أو يكتب عنه فقرة قصيرة من ثلاث جمل/.test(p.independentPractice)) bad.push(`${subjectId}: no Grade 4 writing`);
      if (/لا يكتب فيها إلا حرفًا/.test(p.differentiation)) bad.push(`${subjectId}: Grade 1’s principle`);
    }
    assert.deepEqual(bad, []);
  });
});

describe('Grade 3 is unchanged by Grade 4', () => {
  it('a Grade 3 science plan still writes two sentences, and subjects keep their grade’s own writing limit', async () => {
    const l = KB_LESSONS.find(x => { const b = getBookForLesson(x); return b?.gradeId === 'grade-3' && b.subjectId === 'science'; })!;
    const g3 = await aiService.generateLessonPlan({ grade: 'الصف الثالث', subject: 'science', topic: l.titleAr, lessonId: l.id, language: 'arabic', duration: 45, teachingStyle: 'direct' } as AIRequest);
    assert.match(g3.independentPractice, /يكتب جملتين عمّا لاحظه/);
    assert.match(g3.assessment, /ولا تزيد الكتابة على جملتين أو ثلاث جمل قصيرة/);
    assert.ok(subjectOf(l.id) === 'science');
  });
});
