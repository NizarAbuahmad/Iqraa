/**
 * A Grade 1 lesson plan is written for six-year-olds learning to read.
 *
 * Swept 2026-11-13: the offline «حرف الباء» plan asked first-graders to «write
 * a short paragraph (4–5 sentences)» and fill in a «3-2-1» exit ticket, and a
 * science plan asked them to design a controlled experiment. Every Grade 1
 * lesson now gets `lessonPlanFirstGrade.ts`; every other grade keeps its plan.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { arabicLessonType, isFirstGradeLesson } from '../ai/lessonPlanFirstGrade.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G1 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-1');

const planFor = (lessonId: string, style: string, language: 'arabic' | 'english' = 'arabic', extra: Partial<AIRequest> = {}) => {
  const l = getLessonById(lessonId)!;
  const b = getBookForLesson(l)!;
  return aiService.generateLessonPlan({
    grade: b.gradeId, subject: b.subjectId, topic: language === 'arabic' ? l.titleAr : l.titleEn, lessonId,
    language, duration: 45, teachingStyle: style, ...extra,
  } as AIRequest);
};

const TEACHER_FIELDS = ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation'] as const;
const textOf = (p: LessonPlanOutput) => [
  ...p.objectives, ...p.materials, p.introduction, p.mainActivity, p.guidedPractice,
  p.independentPractice, p.closure, p.assessment, p.differentiation, p.homework,
].join('\n');

/** What a plan for older students asks, which a six-year-old cannot do. */
const TOO_OLD_AR = [/فقرة/, /3-2-1/, /بطاقة خروج/, /بطاقات عند الخروج/, /تجربة مضبوطة/, /متغيرًا?/, /علّل|علل /, /يكتب كل طالب/, /النص قراءة/, /ورقة ملاحظات/];
const TOO_OLD_EN = [/paragraph/i, /3-2-1/, /exit ticket/i, /controlled experiment/i, /variable/i, /justify/i, /each student writes/i, /observation sheet/i];

describe('which lessons are Grade 1', () => {
  it('there are Grade 1 lessons in every Grade 1 subject', () => {
    const subjects = new Set(G1.map(l => getBookForLesson(l)!.subjectId));
    assert.deepEqual([...subjects].sort(), ['arabic', 'creative-arts', 'english', 'islamic', 'mathematics', 'physical-education', 'science', 'social']);
    assert.ok(G1.length >= 250, String(G1.length));
  });

  it('a lesson is judged by its own book, a typed topic by the grade named', () => {
    assert.equal(isFirstGradeLesson(getLessonById('kbl-g1-arabic-s1-nccd-u1_l6')!), true);
    assert.equal(isFirstGradeLesson(getLessonById('kbl-arabic-s1-nccd-u1_l1')!, 'الصف الأول'), false, 'the book wins over the label');
    for (const g of ['الصف الأول', 'الصَّفُّ الأَوَّلُ', 'Grade 1', 'grade-1']) assert.equal(isFirstGradeLesson(null, g), true, g);
    for (const g of ['الصف العاشر', 'Grade 10', 'grade-11', 'الصف الأول الثانوي', '']) assert.equal(isFirstGradeLesson(null, g), false, g);
  });

  it('reads the Arabic primer’s lesson titles', () => {
    assert.deepEqual(arabicLessonType('حَرْفُ الْبَاءِ (ب)'), { type: 'letter', letter: 'ب' });
    assert.deepEqual(arabicLessonType('حَرْفُ الْمَدِّ الْأَلِفُ (ا، ى)'), { type: 'letter', letter: 'ا' });
    assert.equal(arabicLessonType('تَنْوِينُ الضَّمَّةِ').type, 'mark');
    assert.equal(arabicLessonType('الشَّدَّةُ').type, 'mark');
    assert.equal(arabicLessonType('أَسْتَمِعُ بِانْتِبَاهٍ وَتَرْكِيزٍ').type, 'listen');
    assert.equal(arabicLessonType('أَتَحَدَّثُ بِطَلَاقَةٍ').type, 'speak');
    assert.equal(arabicLessonType('أَقْرَأُ بِطَلَاقَةٍ وَفَهْمٍ').type, 'read');
    assert.equal(arabicLessonType('أَكْتُبُ').type, 'write');
    assert.equal(arabicLessonType('أَبْنِي لُغَتِي').type, 'build');
  });
});

describe('every Grade 1 plan, every style', () => {
  it('asks nothing of a six-year-old that an older class does, and is in the teacher’s own voice', async () => {
    const bad: string[] = [];
    for (const l of G1) {
      for (const style of LESSON_STYLE_IDS) {
        const p = await planFor(l.id, style);
        const label = `${l.id} · ${style}`;
        // The book's own objectives are its words; check the rest.
        const t = textOf({ ...p, objectives: [] });
        for (const re of TOO_OLD_AR) if (re.test(t)) bad.push(`${label}: ${re}`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${label}: a template leaked`);
        if (/\((?:[3-9]|10) دقيقة\)/.test(t)) bad.push(`${label}: «(N دقيقة)» after 3–10`);
        for (const f of TEACHER_FIELDS) {
          const hits = imperativesIn(p[f]);
          if (hits.length) bad.push(`${label} · ${f}: imperative ${hits.join(', ')}`);
        }
        for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) {
          if (!FIRST_PERSON.test(norm(p[f]))) bad.push(`${label} · ${f}: never «سأ…»`);
        }
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('in English too', async () => {
    const bad: string[] = [];
    for (const [i, l] of G1.entries()) {
      if (i % 3 !== 0) continue;
      for (const style of LESSON_STYLE_IDS) {
        const t = textOf({ ...(await planFor(l.id, style, 'english')), objectives: [] });
        for (const re of TOO_OLD_EN) if (re.test(t)) bad.push(`${l.id} · ${style}: ${re}`);
        if (/[؀-ۿ]{3,}/.test(t.replace(/«[^»]*»|“[^”]*”|\([^)]*\)/g, '').replace(/حرف|[؀-ۿ]+ \(/g, ''))
          && !/[؀-ۿ]/.test(l.titleEn)) {
          // English plan of a lesson whose English title has no Arabic: no stray Arabic sentence.
          if (/ سأ| يكتب| الطفل/.test(t)) bad.push(`${l.id} · ${style}: Arabic sentence in the English plan`);
        }
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('keeps the three styles apart', async () => {
    for (const id of ['kbl-g1-arabic-s1-nccd-u1_l6', 'kbl-g1-math-s1-nccd-u0_l2', 'kbl-g1-science-s1-nccd-u2_l1']) {
      const mains = new Set<string>();
      for (const style of LESSON_STYLE_IDS) mains.add((await planFor(id, style)).mainActivity);
      assert.equal(mains.size, 3, id);
    }
  });
});

describe('what a Grade 1 plan is made of', () => {
  it('an Arabic letter lesson teaches the letter: sound, forms, copying', async () => {
    const p = await planFor('kbl-g1-arabic-s1-nccd-u1_l6', 'direct');
    const t = textOf(p);
    assert.match(t, /حرف ب/);
    assert.match(t, /أول الكلمة ووسطها وآخرها/);
    assert.match(t, /الحركات الثلاث/);
    assert.match(p.independentPractice, /ينسخ/);
    assert.match(p.homework, /أسرته/);
  });

  it('a maths lesson keeps the book’s own objectives and works with objects', async () => {
    const l = getLessonById('kbl-g1-math-s1-nccd-u0_l2')!;
    const p = await planFor(l.id, 'direct');
    assert.deepEqual(p.objectives, l.objectives);
    assert.match(p.mainActivity, /المكعبات/);
  });

  it('teacher-typed objectives still win', async () => {
    const p = await planFor('kbl-g1-science-s1-nccd-u2_l1', 'direct', 'arabic', { objectives: 'هدف أول\nهدف ثانٍ' });
    assert.deepEqual(p.objectives, ['هدف أول', 'هدف ثانٍ']);
  });

  it('a surah lesson is recited, not read as a text', async () => {
    const l = G1.find(x => getBookForLesson(x)!.subjectId === 'islamic' && /سور/.test(x.titleAr))!;
    const p = await planFor(l.id, 'direct');
    assert.match(p.mainActivity, /سأتلو/);
  });
});

describe('other grades keep their plan', () => {
  it('a Grade 10 and a Grade 2 Arabic plan are not the Grade 1 plan', async () => {
    for (const grade of ['grade-10', 'grade-2']) {
      const l = KB_LESSONS.find(x => { const b = getBookForLesson(x); return b?.gradeId === grade && b.subjectId === 'arabic'; })!;
      const p = await planFor(l.id, 'direct');
      assert.doesNotMatch(p.assessment, /لن أطلب كتابة إلا نسخ/, `${grade} got the Grade 1 plan`);
    }
  });
});
