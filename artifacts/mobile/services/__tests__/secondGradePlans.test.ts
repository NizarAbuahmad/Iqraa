/**
 * Grade 2 plans, activities, quick checks and reviews are written for seven-year-olds.
 *
 * Swept 2026-11-15: every one of the 236 Grade 2 lessons got the all-grades plan and
 * activities — «اكتب من ذاكرتك — الدفاتر مغلقة», a claim to defend, teams betting
 * points, a «worked example», a written summary and a debate; «الصوت وخصائصه» was a
 * controlled experiment, Arabic and social studies wrote paragraphs, and 148 lessons drew
 * a concept map. Grade 2 now has the early-grade versions (`lessonPlanFirstGrade.ts`,
 * `activityFirstGrade.ts`) with its own Arabic strands and writing: a word or a short
 * sentence where Grade 1 copies one. Grade 3 has its own level since 2026-11-20
 * (`thirdGradePlans.test.ts`), Grade 4 since 2026-11-25 (`fourthGradePlans.test.ts`); Grade 5 keeps the all-grades ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService, buildOfflineActivity } from '../ai/generators.ts';
import { ACTIVITY_BLUEPRINT_IDS } from '../ai/activityBlueprints.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { arabicLessonType, earlyGradeOf, titleDetail } from '../ai/lessonPlanFirstGrade.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';
import type { ActivityOutput, AIRequest, ClassroomActivityRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';
import { lessonsInScope, scopeKey, type ScopeSelection } from '../scopeSelection.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G2 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-2');
const fold = (s: string) => s.replace(/[ً-ْٰ]/g, '');
const find = (re: RegExp, subject: string) => G2.find(l => getBookForLesson(l)!.subjectId === subject && re.test(fold(l.titleAr)))!;

const base = (lessonId: string) => {
  const l = getLessonById(lessonId)!;
  const b = getBookForLesson(l)!;
  return { grade: 'الصف الثاني', subject: b.subjectId, topic: l.titleAr, lessonId, language: 'arabic', duration: 45 } as AIRequest;
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

/** What the all-grades plans and activities asked of Grade 2 (2026-11-15). */
const TOO_OLD = [
  /اكتب من ذاكرتك/, /الدفاتر مغلقة/, /ادعاء/, /برّر|تبرير|علّل/, /فقرة/, /تجربة مضبوطة/, /المتغير/, /مثال محلول/,
  /يراهن|رهان/, /اشرح بكلماتك/, /ملخّص|لخّص|ملخص/, /مناظرة|جدال|حجج/, /ورقة عمل فردية/, /خريطة مفاهيم/, /بطاقة خروج/,
];
const G2_LIMIT = /ولا تزيد الكتابة على كلمات أو جملة قصيرة يكتبها الطفل بنفسه/;
const TEACHER_FIELDS = ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation'] as const;

describe('which lessons are Grade 2', () => {
  it('every Grade 2 subject has lessons, and a lesson is judged by its own book', () => {
    assert.ok(G2.length >= 230, String(G2.length));
    assert.equal(earlyGradeOf(G2[0]!), 2);
    assert.equal(earlyGradeOf(getLessonById('kbl-g1-arabic-s1-nccd-u1_l6')!), 1);
    for (const g of ['الصف الثاني', 'الصَّفُّ الثَّانِي', 'Grade 2', 'grade-2']) assert.equal(earlyGradeOf(null, g), 2, g);
    for (const g of ['الصف الخامس', 'الصف الثاني عشر', 'Grade 12', '']) assert.equal(earlyGradeOf(null, g), null, g);
  });
});

describe('every Grade 2 lesson plan, every style', () => {
  it('asks nothing the all-grades plan asked, keeps the teacher’s voice and states the Grade 2 writing limit', async () => {
    const bad: string[] = [];
    for (const l of G2) {
      for (const style of LESSON_STYLE_IDS) {
        const p = await planFor(l.id, style);
        const t = planText({ ...p, objectives: [] });
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${style}: ${re}`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${style}: a template leaked`);
        if (!G2_LIMIT.test(p.assessment)) bad.push(`${l.id} · ${style}: no Grade 2 writing limit`);
        for (const f of TEACHER_FIELDS) { const hits = imperativesIn(p[f]); if (hits.length) bad.push(`${l.id} · ${style} · ${f}: ${hits}`); }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) if (!FIRST_PERSON.test(norm(p[f]))) bad.push(`${l.id} · ${style} · ${f}: never «سأ…»`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });
});

describe('Grade 2 Arabic follows the book’s strands', () => {
  it('a reading lesson reads its own text by name', async () => {
    const l = find(/^أقرأ بطلاقة وفهم \(الغراب/, 'arabic');
    const p = await planFor(l.id, 'direct');
    const text = titleDetail(l.titleAr)!;
    assert.ok(p.objectives.some(o => o.includes(`نص «${text}»`)), p.objectives.join(' | '));
    assert.match(p.mainActivity, new RegExp(`سأقرأ نص «${text.replace(/[()]/g, '\\$&')}» قراءة جهرية`));
    assert.match(p.independentPractice, /يجيب كتابةً عن سؤال بكلمة أو جملة قصيرة/);
  });

  it('a writing lesson spells by its own rule — «أكتب (التنوين)» too, which is not Grade 1’s mark lesson', async () => {
    for (const re of [/^أكتب \(اللام الشمسية/, /^أكتب \(التنوين/, /^أكتب \(همزة الوصل/]) {
      const l = find(re, 'arabic');
      assert.equal(arabicLessonType(l.titleAr).type, 'write', l.titleAr);
      const p = await planFor(l.id, 'direct');
      const rule = titleDetail(l.titleAr)!;
      assert.match(p.mainActivity, new RegExp(`كلمات فيها «${rule}»`), l.titleAr);
      assert.match(p.independentPractice, /ثم جملة قصيرة فيها واحدة منها/, l.titleAr);
    }
    assert.equal(arabicLessonType('تَنْوِينُ الضَّمَّةِ').type, 'mark', 'Grade 1’s mark lesson is unchanged');
  });
});

describe('an arts lesson is a picture, a piece of music or a scene — in Grades 1 and 2', () => {
  it('the stage, the piano and a drawing are taught three ways', async () => {
    const theatre = await planFor(find(/^حركة الممثلين/, 'creative-arts').id, 'direct');
    const music = await planFor(find(/^آلة \(البيانو\)/, 'creative-arts').id, 'direct');
    const art = await planFor(find(/^الألوان الثانوية/, 'creative-arts').id, 'direct');
    assert.match(theatre.independentPractice, /يؤدّي كل طفل في دوره أمام زملائه حركة أو جملة قصيرة/);
    assert.match(music.independentPractice, /يؤدّي كل طفل الإيقاع أو المقطع/);
    assert.match(art.independentPractice, /يرسم كل طفل عمله الصغير/);
    const g1Theatre = KB_LESSONS.find(l => { const b = getBookForLesson(l); return b?.gradeId === 'grade-1' && b.subjectId === 'creative-arts' && /مسرح|تمثيل/.test(fold(l.titleAr)); });
    if (g1Theatre) {
      const b = getBookForLesson(g1Theatre)!;
      const p = await aiService.generateLessonPlan({ grade: 'الصف الأول', subject: b.subjectId, topic: g1Theatre.titleAr, lessonId: g1Theatre.id, language: 'arabic', duration: 45, teachingStyle: 'direct' } as AIRequest);
      assert.match(p.independentPractice, /يؤدّي كل طفل في دوره أمام زملائه/, g1Theatre.titleAr);
    }
  });
});

describe('every Grade 2 activity format', () => {
  it('asks nothing the all-grades activities asked, and its steps add up', () => {
    const bad: string[] = [];
    for (const l of G2) {
      for (const type of ACTIVITY_BLUEPRINT_IDS) {
        const a = buildOfflineActivity({ ...base(l.id), activityType: type === 'warmup' ? 'group' : type, ...(type === 'warmup' ? { activityVariant: 'warmup' } : {}) } as AIRequest);
        const t = actText(a);
        for (const re of TOO_OLD) if (re.test(t)) bad.push(`${l.id} · ${type}: ${re}`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${type}: a template leaked`);
        const sum = a.steps.reduce((s, x) => s + x.durationMin, 0);
        if (sum !== a.totalDuration) bad.push(`${l.id} · ${type}: steps ${sum} ≠ ${a.totalDuration}`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('a Grade 2 spelling game is about the lesson’s rule', () => {
    const l = find(/^أكتب \(اللام الشمسية/, 'arabic');
    const a = buildOfflineActivity({ ...base(l.id), activityType: 'game' } as AIRequest);
    assert.match(actText(a), new RegExp(`إذا كانت فيها «${titleDetail(l.titleAr)!}»`));
  });
});

describe('the Grade 2 quick check', () => {
  it('is spoken and answered all together for every lesson with no bank, and a reading lesson asks about its text', async () => {
    const bad: string[] = [];
    for (const l of G2) {
      if (getBookForLesson(l)!.subjectId === 'mathematics') continue;
      const a = await aiService.generateClassroomActivity({ ...base(l.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
      const t = a.slides.map(s => `${s.title}\n${s.content ?? ''}`).join('\n');
      if (/اشرح بكلماتك|اكتب إجابتك/.test(t)) bad.push(`${l.id}: asks for writing`);
      if (a.slides.filter(s => s.type === 'challenge').length < 3) bad.push(`${l.id}: fewer than 3 prompts`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
    const read = find(/^أقرأ بطلاقة وفهم \(الغراب/, 'arabic');
    const a = await aiService.generateClassroomActivity({ ...base(read.id), activityType: 'quick-check', duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5 } as unknown as ClassroomActivityRequest);
    assert.match(a.slides.map(s => s.content).join('\n'), new RegExp(`من الشخصيات في نص «${titleDetail(read.titleAr)!}»`));
  });
});

describe('a Grade 2 review (unit or semester)', () => {
  it('is the early-grade review with the Grade 2 writing limit', async () => {
    const bad: string[] = [];
    for (const subjectId of ['arabic', 'mathematics', 'science', 'islamic', 'social']) {
      const sel: ScopeSelection = { kind: 'semester', gradeId: 'grade-2', subjectId, semester: 1 };
      const ls = lessonsInScope(sel);
      const p = await aiService.generateLessonPlan({
        grade: 'الصف الثاني', subject: subjectId, topic: 'مراجعة', language: 'arabic', duration: 45, teachingStyle: 'direct',
        scope: { kind: 'semester', scopeKey: scopeKey(sel), unitIds: [...new Set(ls.map(l => l.unitId))] },
        coverage: { lessons: ls.map((l, i) => ({ code: `L${i + 1}`, id: l.id, unitId: l.unitId, title: l.titleAr })) },
      } as AIRequest);
      const t = planText({ ...p, objectives: [] });
      for (const re of [...TOO_OLD, /ورقة مراجعة/]) if (re.test(t)) bad.push(`${subjectId}: ${re}`);
      if (!G2_LIMIT.test(p.assessment)) bad.push(`${subjectId}: no Grade 2 writing limit`);
      if (!/يكتب كل طفل في دفتره جملة قصيرة/.test(p.independentPractice)) bad.push(`${subjectId}: no Grade 2 writing`);
    }
    assert.deepEqual(bad, []);
  });
});

describe('Grade 5 keeps the all-grades plan and activities', () => {
  it('a Grade 5 Arabic plan and activity are not the early-grade ones', async () => {
    const l = KB_LESSONS.find(x => { const b = getBookForLesson(x); return b?.gradeId === 'grade-5' && b.subjectId === 'arabic'; })!;
    const b = getBookForLesson(l)!;
    const p = await aiService.generateLessonPlan({ grade: 'الصف الخامس', subject: b.subjectId, topic: l.titleAr, lessonId: l.id, language: 'arabic', duration: 45, teachingStyle: 'direct' } as AIRequest);
    assert.doesNotMatch(p.assessment, G2_LIMIT);
    const a = buildOfflineActivity({ grade: 'الصف الخامس', subject: 'arabic', lessonId: l.id, topic: l.titleAr, language: 'arabic', activityType: 'individual' } as AIRequest);
    assert.doesNotMatch(a.groupSize, /كل طفل مع أشيائه/);
  });
});
