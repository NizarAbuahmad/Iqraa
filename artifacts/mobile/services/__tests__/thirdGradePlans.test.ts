/**
 * Grade 3 plans, activities, quick checks and reviews are written for eight-year-olds.
 *
 * Swept 2026-11-20: every one of the 254 Grade 3 lessons got the all-grades plan and
 * activities — «اكتب من ذاكرتك — الدفاتر مغلقة», a claim to defend, a debate, teams betting
 * points, a written summary, a 3-2-1 exit card and an individual worksheet; all 13 science
 * lessons a controlled experiment, 143 lessons a concept map, and Arabic «فقرة قصيرة (٤–٥
 * جمل)» with a five-sentence paragraph for homework. Grade 3 now has the early-grade
 * versions at its own level (`thirdGradeContent` in `lessonPlanFirstGrade.ts`): maths with
 * models then numbers on a small board, science that predicts, observes and records in a
 * table, two or three sentences of the child's own, and answers in a sentence. Grade 4 keeps
 * the all-grades ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService, buildOfflineActivity } from '../ai/generators.ts';
import { ACTIVITY_BLUEPRINT_IDS } from '../ai/activityBlueprints.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { earlyGradeOf, titleDetail } from '../ai/lessonPlanFirstGrade.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';
import type { ActivityOutput, AIRequest, ClassroomActivityRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G3 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-3');
const fold = (s: string) => s.replace(/[ً-ْٰ]/g, '');
const find = (re: RegExp, subject: string) => G3.find(l => getBookForLesson(l)!.subjectId === subject && re.test(fold(l.titleAr)))!;

const base = (lessonId: string) => {
  const l = getLessonById(lessonId)!;
  const b = getBookForLesson(l)!;
  return { grade: 'الصف الثالث', subject: b.subjectId, topic: l.titleAr, lessonId, language: 'arabic', duration: 45 } as AIRequest;
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
 * What the all-grades plans and activities asked of Grade 3 (2026-11-20). «فقرة» is only
 * banned as writing: a Grade 3 child reads «فقرة قصيرة من النص» aloud.
 */
const TOO_OLD = [
  /اكتب من ذاكرتك/, /الدفاتر مغلقة/, /ادعاء/, /برّر|تبرير|علّل/, /يكتب[^.\n]*فقرة|فقرة من خمس|\(٤–٥ جمل\)/, /تجربة مضبوطة/,
  /المتغير/, /مثال محلول/, /يراهن|رهان/, /اشرح بكلماتك/, /ملخّص|لخّص|ملخص/, /مناظرة|جدال|حجج/, /ورقة عمل فردية/,
  /خريطة مفاهيم/, /بطاقة خروج/, /3-2-1/,
];
/** Grade 1's counting, colouring and pointing, where Grade 3 has its own content. */
const TOO_YOUNG = /المكعبات أو الحبات|بالأصابع|يجيب(?: الأطفال)? بكلمة أو بإشارة|يعدّها الأطفال معي/;
const G3_LIMIT = /ولا تزيد الكتابة على جملتين أو ثلاث جمل قصيرة يكتبها الطفل بنفسه/;
const TEACHER_FIELDS = ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation'] as const;

describe('which lessons are Grade 3', () => {
  it('every Grade 3 subject has lessons, and a lesson is judged by its own book', () => {
    assert.ok(G3.length >= 250, String(G3.length));
    assert.equal(new Set(G3.map(l => getBookForLesson(l)!.subjectId)).size, 8);
    assert.equal(earlyGradeOf(G3[0]!), 3);
    for (const g of ['الصف الثالث', 'الصَّفُّ الثَّالِثُ', 'Grade 3', 'grade-3']) assert.equal(earlyGradeOf(null, g), 3, g);
    for (const g of ['الصف الرابع', 'الصف الثالث عشر', 'Grade 13', '']) assert.equal(earlyGradeOf(null, g), null, g);
  });
});

describe('every Grade 3 lesson plan, every style', () => {
  it('asks nothing the all-grades plan asked, is not Grade 1’s, keeps the teacher’s voice and states the Grade 3 writing limit', async () => {
    const bad: string[] = [];
    for (const l of G3) {
      const sub = getBookForLesson(l)!.subjectId;
      for (const style of LESSON_STYLE_IDS) {
        const p = await planFor(l.id, style);
        const t = planText({ ...p, objectives: [] });
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${style}: ${re}`);
        if (['mathematics', 'science', 'social', 'english'].includes(sub) && TOO_YOUNG.test(t)) bad.push(`${l.id} · ${style}: Grade 1’s content`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${style}: a template leaked`);
        if (!G3_LIMIT.test(p.assessment)) bad.push(`${l.id} · ${style}: no Grade 3 writing limit`);
        for (const f of TEACHER_FIELDS) { const hits = imperativesIn(p[f]); if (hits.length) bad.push(`${l.id} · ${style} · ${f}: ${hits}`); }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) if (!FIRST_PERSON.test(norm(p[f]))) bad.push(`${l.id} · ${style} · ${f}: never «سأ…»`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('maths is a model, then numbers on a board; science predicts, observes and records in a table', async () => {
    const maths = await planFor(find(/^الضرب في 4$/, 'mathematics').id, 'direct');
    assert.match(maths.mainActivity, /بالأدوات أو بالرسم \(مصفوفة أو خط أعداد أو شكل\)/);
    assert.match(maths.independentPractice, /يحلّ كل طفل على لوحه ثلاثة أمثلة/);
    assert.match(maths.mainActivity, /ويجيب الأطفال بجملة قصيرة/);
    const science = await planFor(find(/^الآلات البسيطة$/, 'science').id, 'inquiry');
    assert.match(science.guidedPractice, /نتوقع معًا ماذا سيحدث/);
    assert.match(science.guidedPractice, /جدول من عمودين/);
    assert.match(science.independentPractice, /يكتب جملتين عمّا لاحظه، إحداهما تبدأ بـ«لأنّ…»/);
  });

  it('Islamic education recites a surah and writes a verse’s meaning, and answers another lesson’s questions in sentences', async () => {
    const surah = await planFor(find(/^سورة القدر$/, 'islamic').id, 'direct');
    assert.match(surah.independentPractice, /يكتب في دفتره معنى آية واحدة بجملة من عنده/);
    const other = await planFor(find(/^آداب الحديث$/, 'islamic').id, 'direct');
    assert.match(other.independentPractice, /يجيب كل طفل في دفتره عن سؤالين من الدرس بجملة لكل منهما/);
    assert.doesNotMatch(other.independentPractice, /يلوّن/);
  });
});

describe('Grade 3 Arabic follows the book’s strands, at Grade 3’s length', () => {
  it('a reading lesson reads its own text by name and answers two questions in sentences', async () => {
    const l = find(/^أقرأ بطلاقة وفهم \(حوت يونس\)/, 'arabic');
    const p = await planFor(l.id, 'direct');
    const text = titleDetail(l.titleAr)!;
    assert.ok(p.objectives.some(o => o.includes(`نص «${text}»`)), p.objectives.join(' | '));
    assert.match(p.independentPractice, /يجيب في دفتره عن سؤالين عن النص بجملة لكل منهما/);
    assert.match(p.homework, /ويكتب جملتين عمّا أعجبه فيه/);
  });

  it('a spelling lesson writes words and two sentences by its rule', async () => {
    const l = find(/^أكتب \(اللام الشمسية/, 'arabic');
    const p = await planFor(l.id, 'direct');
    assert.match(p.mainActivity, new RegExp(`كلمات فيها «${titleDetail(l.titleAr)!}»`));
    assert.match(p.independentPractice, /أربع كلمات فيها .*، ثم جملتين تستعمل كل منهما واحدة منها/);
  });

  it('a punctuation lesson keeps both marks in its rule and works in sentences, not words', async () => {
    const l = find(/^أكتب \(علامتا الترقيم/, 'arabic');
    assert.equal(titleDetail(l.titleAr), fold(l.titleAr).includes('(:)') ? titleDetail(l.titleAr) : null);
    assert.match(titleDetail(l.titleAr)!, /\(:\) وَ?\(؛\)$/);
    const p = await planFor(l.id, 'direct');
    assert.match(p.mainActivity, /سأكتب على السبورة جملًا من الكتاب فيها/);
    assert.doesNotMatch(planText(p), /كلمات فيها «علامتا/);
    const game = actText(buildOfflineActivity({ ...base(l.id), activityType: 'game' } as AIRequest));
    assert.match(game, /سأقرأ جملة بلا علامات ترقيم/);
  });
});

describe('every Grade 3 activity format', () => {
  it('asks nothing the all-grades activities asked, and its steps add up', () => {
    const bad: string[] = [];
    for (const l of G3) {
      const sub = getBookForLesson(l)!.subjectId;
      for (const type of ACTIVITY_BLUEPRINT_IDS) {
        const a = buildOfflineActivity({ ...base(l.id), activityType: type === 'warmup' ? 'group' : type, ...(type === 'warmup' ? { activityVariant: 'warmup' } : {}) } as AIRequest);
        const t = actText(a);
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${type}: ${re}`);
        if (sub === 'mathematics' && TOO_YOUNG.test(t)) bad.push(`${l.id} · ${type}: Grade 1’s counting`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${type}: a template leaked`);
        const sum = a.steps.reduce((s, x) => s + x.durationMin, 0);
        if (sum !== a.totalDuration) bad.push(`${l.id} · ${type}: steps ${sum} ≠ ${a.totalDuration}`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('a Grade 3 maths game is answered on a team board, and its hands-on task is a model written in numbers', () => {
    const l = find(/^الضرب في 4$/, 'mathematics');
    assert.match(actText(buildOfflineActivity({ ...base(l.id), activityType: 'game' } as AIRequest)), /ويكتب أحدهم الناتج على لوح الفريق/);
    assert.match(actText(buildOfflineActivity({ ...base(l.id), activityType: 'hands-on' } as AIRequest)), /ثم يكتبه بالأرقام على لوحه/);
  });
});

describe('the Grade 3 quick check', () => {
  it('is spoken and answered all together for every lesson with no bank, and a reading lesson asks about its text', async () => {
    const bad: string[] = [];
    for (const l of G3) {
      if (getBookForLesson(l)!.subjectId === 'mathematics') continue;
      const a = await aiService.generateClassroomActivity({ ...base(l.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
      const t = a.slides.map(s => `${s.title}\n${s.content ?? ''}`).join('\n');
      if (/اشرح بكلماتك|اكتب إجابتك/.test(t)) bad.push(`${l.id}: asks for writing`);
      if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id}: a template leaked`);
      if (a.slides.filter(s => s.type === 'challenge').length < 3) bad.push(`${l.id}: fewer than 3 prompts`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
    const read = find(/^أقرأ بطلاقة وفهم \(حوت يونس\)/, 'arabic');
    const a = await aiService.generateClassroomActivity({ ...base(read.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
    assert.match(a.slides.map(s => s.content).join('\n'), new RegExp(`من الشخصيات في نص «${titleDetail(read.titleAr)!}»`));
  });
});

describe('a Grade 3 review (unit or semester)', () => {
  it('is the early-grade review with the Grade 3 writing limit', async () => {
    const bad: string[] = [];
    for (const subjectId of ['arabic', 'mathematics', 'science', 'islamic', 'social']) {
      const sel: ScopeSelection = { kind: 'semester', gradeId: 'grade-3', subjectId, semester: 1 };
      const ls = lessonsInScope(sel);
      const p = await aiService.generateLessonPlan({
        grade: 'الصف الثالث', subject: subjectId, topic: 'مراجعة', language: 'arabic', duration: 45, teachingStyle: 'direct',
        scope: { kind: 'semester', scopeKey: scopeKey(sel), unitIds: [...new Set(ls.map(l => l.unitId))] },
        coverage: { lessons: ls.map((l, i) => ({ code: `L${i + 1}`, id: l.id, unitId: l.unitId, title: l.titleAr })) },
      } as AIRequest);
      const t = planText({ ...p, objectives: [] });
      for (const re of [...TOO_OLD, /ورقة مراجعة/]) if (re.test(t)) bad.push(`${subjectId}: ${re}`);
      if (!G3_LIMIT.test(p.assessment)) bad.push(`${subjectId}: no Grade 3 writing limit`);
      if (!/يحلّ كل طفل في دفتره مثالًا من كل .* أو يكتب عنه جملتين/.test(p.independentPractice)) bad.push(`${subjectId}: no Grade 3 writing`);
      if (/لا يكتب فيها إلا حرفًا/.test(p.differentiation)) bad.push(`${subjectId}: Grade 1’s principle`);
    }
    assert.deepEqual(bad, []);
  });
});
