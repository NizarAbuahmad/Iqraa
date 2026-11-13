/**
 * Inside a subject, a lesson plan fits the lesson's TYPE — and its homework fits
 * the child's grade.
 *
 * The offline audit of 2026-11-13 (all 236 Grade 2 lessons, live AI off) found
 * the plan's body chosen by subject alone: every Islamic lesson was a Quran
 * recitation («أركان الإيمان» included), the drama lesson «خشبة المسرح» was told
 * to show «نموذجًا منجزًا», all 50 Grade 2 Arabic plans were identical and the
 * listening lesson read a text aloud; 28 of 61 Grade 2 maths plans asked a
 * seven-year-old for «ملخصًا شخصيًا من 10 جمل», and every plan closed on a
 * written "3-2-1" card.
 *
 * What is pinned: how a lesson's type is read (by id, from the catalog); that
 * the types of one subject get different main activities (`mainActivity` does
 * not vary at random, unlike the introduction, closure and homework); the
 * defects above, on the real Grade 2 lessons; the grade bands; and what a
 * regenerate does for a type that has one wording. Whether the activities are
 * GOOD teaching needs a teacher's read.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { foldArabic, gradeBandOf, gradeLevelOf, KIND_OF_TYPE, LESSON_TYPES, lessonTypeForId, lessonTypeForKb, type LessonType } from '../ai/lessonTypes.ts';
import { lessonKindFor } from '../ai/lessonPlanKinds.ts';
import { KB_LESSONS, getBookForLesson, type KBLesson } from '../knowledgeBase.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';
import { FIRST_PERSON, imperativesIn, norm } from './teacherVoiceCheck.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G = (id: string) => `kbl-g2-${id}`;
const byId = (id: string) => {
  const l = KB_LESSONS.find(x => x.id === id);
  assert.ok(l, `${id} is not in the catalog — it changed`);
  return l;
};
const lessonsOf = (gradeId: string, subjectId: string) =>
  KB_LESSONS.filter(l => {
    const b = getBookForLesson(l);
    return b?.gradeId === gradeId && b.subjectId === subjectId;
  });

const planFor = (l: KBLesson, lang: 'arabic' | 'english' = 'arabic', extra: Partial<AIRequest> = {}) => {
  const b = getBookForLesson(l)!;
  return aiService.generateLessonPlan({
    grade: b.gradeId, subject: b.subjectId, topic: lang === 'english' ? l.titleEn : l.titleAr, lessonId: l.id,
    language: lang, duration: 45, teachingStyle: 'direct', ...extra,
  } as AIRequest);
};

/** The main activity with the lesson's own words taken out, so only what the TYPE writes is compared. */
const routineOf = (p: LessonPlanOutput, l: KBLesson) =>
  p.mainActivity.split(l.titleAr).join('').split(l.titleEn).join('').replace(/«[^»]*»|“[^”]*”/g, '«»');

/** One Grade 2 lesson (Grade 1 for letters, which only Grade 1 has) of each type. */
const SAMPLES: Record<LessonType, string> = {
  quran: G('islamic-s1-nccd-u1_l3'),          // سورة الفيل
  hadith: G('islamic-s1-nccd-u2_l3'),         // الحديث الشريف: محبة الوالدين
  creed: G('islamic-s1-nccd-u1_l1'),          // أركان الإيمان
  worship: G('islamic-s1-nccd-u3_l3'),        // أعمال الوضوء
  sira: G('islamic-s1-nccd-u2_l2'),           // الصادق الأمين
  conduct: G('islamic-s1-nccd-u4_l3'),        // نظافة منزلي
  'visual-art': G('arts-s1-nccd-u1_l4'),      // الألوان الثانوية
  music: G('arts-s1-nccd-u2_l1'),             // إيقاع الفوكس وإيقاع الفالس
  drama: G('arts-s1-nccd-u3_l1'),             // خشبة المسرح
  listening: G('arabic-s1-nccd-u2_l1'),       // أستمع بانتباه وتركيز
  speaking: G('arabic-s1-nccd-u2_l2'),        // أتحدث بطلاقة
  reading: G('arabic-s1-nccd-u2_l3'),         // أقرأ بطلاقة وفهم (رحلة قطورة)
  writing: G('arabic-s1-nccd-u2_l4'),         // أكتب (هذا، هذه)
  language: G('arabic-s1-nccd-u2_l5'),        // أبني لغتي
  letters: '',
};
SAMPLES.letters = lessonsOf('grade-1', 'arabic').find(l => lessonTypeForKb(l) === 'letters')?.id ?? '';

describe('a lesson’s type is read from the lesson, not from a title search', () => {
  it('each sample lesson is the type it is filed under', () => {
    for (const type of LESSON_TYPES) {
      assert.ok(SAMPLES[type], `no ${type} lesson in the catalog`);
      assert.equal(lessonTypeForId(SAMPLES[type]), type, `${SAMPLES[type]} (${byId(SAMPLES[type]).titleAr})`);
    }
  });

  it('every Grade 2 Islamic lesson outside «سورة …» and «الحديث الشريف …» is something else than recitation', () => {
    for (const l of lessonsOf('grade-2', 'islamic')) {
      const t = foldArabic(l.titleAr);
      const type = lessonTypeForKb(l);
      if (t.startsWith('سورة')) assert.equal(type, 'quran', l.titleAr);
      else if (t.startsWith('الحديث الشريف')) assert.equal(type, 'hadith', l.titleAr);
      else assert.ok(type && !['quran', 'hadith'].includes(type), `${l.titleAr} → ${type}`);
    }
    assert.equal(lessonTypeForId(G('islamic-s1-nccd-u3_l2')), 'creed', 'الله الرزّاق is a Name of Allah');
    assert.equal(lessonTypeForId(G('islamic-s2-nccd-u1_l1')), 'creed', 'من أسماء الله الحسنى: القادر');
    assert.equal(lessonTypeForId(G('islamic-s2-nccd-u1_l3')), 'worship', 'الصلوات الخمس');
    assert.equal(lessonTypeForId(G('islamic-s2-nccd-u2_l2')), 'sira', 'مهنة سيدنا محمد قبل البعثة');
  });

  it('the arts book’s three units are art, music and drama', () => {
    const counts: Record<string, number> = {};
    for (const l of lessonsOf('grade-2', 'creative-arts')) {
      const type = lessonTypeForKb(l)!;
      counts[type] = (counts[type] ?? 0) + 1;
      const unit = l.id.match(/-u(\d+)_/)![1];
      assert.equal(type, ({ 1: 'visual-art', 2: 'music', 3: 'drama' } as Record<string, string>)[unit], l.titleAr);
    }
    assert.deepEqual(counts, { 'visual-art': 10, music: 10, drama: 10 });
  });

  it('the Grade 2 readers’ repeated titles each keep their own type, by id', () => {
    const counts: Record<string, number> = {};
    for (const l of lessonsOf('grade-2', 'arabic')) {
      const type = lessonTypeForKb(l);
      assert.ok(type, `${l.id} «${l.titleAr}» has no type`);
      counts[type] = (counts[type] ?? 0) + 1;
    }
    assert.deepEqual(counts, { listening: 10, speaking: 10, reading: 10, writing: 10, language: 10 });
  });

  it('places Grade 4–6 Islamic lessons the first patterns missed', () => {
    assert.equal(lessonTypeForId('kbl-g5-islamic-s1-nccd-u2_l1'), 'quran', 'آية الكرسي');
    assert.equal(lessonTypeForId('kbl-g5-islamic-s2-nccd-u7_l4'), 'worship', 'صدقة الفطر');
    assert.equal(lessonTypeForId('kbl-g6-islamic-s2-nccd-u2_l4'), 'worship', 'المسح على الخفين');
    assert.equal(lessonTypeForId('kbl-g5-islamic-s2-nccd-u6_l4'), 'sira', 'عام الحزن');
  });

  it('Islamic and Arabic lessons are typed in Grades 1–6 only; art, music and drama in every grade', () => {
    // The typed bodies are written for young children, and the upper-grade Islamic
    // books (rulings, sources, fiqh of transactions) do not fit the title patterns.
    assert.equal(lessonTypeForId('kbl-islamic-s1-nccd-u3_l2'), null, 'G10 «موقف الشريعة الإسلامية من الربا»');
    assert.equal(lessonTypeForId('kbl-g7-islamic-s2-nccd-u2_l5'), null, 'G7 «الجمع بين الصلاتين»');
    assert.equal(lessonTypeForId('kbl-arabic-s1-nccd-u1_l1'), null, 'G10 «أستمع بانتباه وتركيز»');
    assert.equal(lessonTypeForId('kbl-g6-arabic-s1-nccd-u1_l1'), 'listening', 'G6 «أستمع بانتباه وتركيز»');
    for (const l of KB_LESSONS) {
      const b = getBookForLesson(l);
      const level = gradeLevelOf(b?.gradeId);
      if (!b || level === null) continue;
      const type = lessonTypeForKb(l);
      if (level > 6 && (b.subjectId === 'islamic' || b.subjectId === 'arabic')) assert.equal(type, null, `${l.id} ${l.titleAr}`);
      if (b.subjectId === 'creative-arts') assert.ok(type, `${l.id} ${l.titleAr} has no arts type`);
    }
  });

  it('a type belongs to one kind, and other subjects have none', () => {
    for (const type of LESSON_TYPES) assert.ok(['recitation', 'making', 'arabic'].includes(KIND_OF_TYPE[type]));
    for (const id of ['mathematics', 'science', 'english', 'social', 'physical-education']) {
      const l = KB_LESSONS.find(x => getBookForLesson(x)?.subjectId === id);
      if (l) assert.equal(lessonTypeForKb(l), null, id);
    }
    assert.equal(lessonTypeForId(undefined), null);
    assert.equal(lessonTypeForId('kbl-no-such-lesson'), null);
  });
});

describe('the types of one subject get different main activities', () => {
  const GROUPS: Array<[string, LessonType[]]> = [
    ['islamic', ['quran', 'hadith', 'creed', 'worship', 'sira', 'conduct']],
    ['creative-arts', ['visual-art', 'music', 'drama']],
    ['arabic', ['listening', 'speaking', 'reading', 'writing', 'language', 'letters']],
  ];
  for (const [subject, types] of GROUPS) {
    for (const lang of ['arabic', 'english'] as const) {
      it(`${subject} (${lang}): ${types.length} types, ${types.length} different main activities`, async () => {
        const routines = new Map<string, LessonType>();
        for (const type of types) {
          const l = byId(SAMPLES[type]);
          const r = routineOf(await planFor(l, lang), l);
          const clash = routines.get(r);
          assert.equal(clash, undefined, `${type} and ${clash} share a main activity:\n${r}`);
          routines.set(r, type);
        }
      });
    }
  }

  it('a typed topic with no lesson id keeps its kind’s plan', async () => {
    const l = byId(SAMPLES.creed);
    const typed = await planFor(l);
    const untyped = await planFor(l, 'arabic', { lessonId: undefined, subject: 'islamic' });
    assert.notEqual(routineOf(typed, l), routineOf(untyped, l));
    assert.match(untyped.mainActivity, /سأتلو/);
  });
});

describe('the Grade 2 defects the audit found', () => {
  it('«أركان الإيمان» is not a recitation lesson', async () => {
    const p = await planFor(byId(SAMPLES.creed));
    const all = JSON.stringify(p);
    assert.doesNotMatch(all, /سأتلو|مرتّلًا|تسميع/);
    assert.match(p.mainActivity, /بندًا بندًا وبترتيبه/);
    assert.match(p.mainActivity, /يَقومُ الإيمانُ/, 'the book’s own main idea is in the plan');
  });

  it('a Name of Allah is one Name, not a list to put in order', async () => {
    const p = await planFor(byId(G('islamic-s1-nccd-u3_l2'))); // الله الرزّاق
    assert.match(p.mainActivity, /الاسم ومعناه على بطاقة/);
    assert.doesNotMatch(`${p.mainActivity}\n${p.guidedPractice}`, /يرتّبون أنفسهم|الأركان بترتيبها|أو الاسم ومعناه\)/);
    const pillars = await planFor(byId(SAMPLES.creed));
    assert.match(pillars.guidedPractice, /يرتّبون أنفسهم كما في الكتاب/);
  });

  it('a sira plan never asks a child to draw the Prophet or the companions', async () => {
    for (const lang of ['arabic', 'english'] as const) {
      const p = await planFor(byId(SAMPLES.sira), lang);
      assert.doesNotMatch(p.independentPractice, lang === 'arabic' ? /يرسم كل طالب المشهد/ : /draws the scene/);
      assert.match(p.independentPractice, lang === 'arabic' ? /دون رسم الأنبياء أو الصحابة/ : /never the prophets or the companions/);
      for (let i = 0; i < 6; i++) assert.doesNotMatch((await planFor(byId(SAMPLES.sira), lang)).homework, /ارسم المشهد|Draw the scene/);
    }
  });

  it('the oral closure names the lesson in quotes, not bare after «عن»', async () => {
    for (let i = 0; i < 8; i++) assert.doesNotMatch((await planFor(byId(SAMPLES.listening))).closure, /عن أَسْتَمِعُ|عن أستمع/);
  });

  it('«أعمال الوضوء» demonstrates the steps; «الصادق الأمين» tells a story', async () => {
    assert.match((await planFor(byId(SAMPLES.worship))).mainActivity, /سأؤدّي الخطوات/);
    assert.match((await planFor(byId(SAMPLES.sira))).mainActivity, /سأروي قصة/);
  });

  it('no drama or music lesson is told to show a finished piece or make a product', async () => {
    for (const l of lessonsOf('grade-2', 'creative-arts').filter(x => lessonTypeForKb(x) !== 'visual-art')) {
      for (let i = 0; i < 3; i++) {
        const all = JSON.stringify(await planFor(l));
        assert.doesNotMatch(all, /نموذجًا منجزًا|ما سيصنعه|يصنع/, `${l.titleAr}`);
      }
    }
    assert.match((await planFor(byId(SAMPLES.drama))).mainActivity, /خشبة/);
  });

  it('«الألوان الثانوية» names green, orange and violet', async () => {
    const p = norm((await planFor(byId(SAMPLES['visual-art']))).mainActivity);
    for (const colour of ['الأخضر', 'والبرتقالي', 'والبنفسجي']) assert.ok(p.includes(colour), `${colour} is missing:\n${p}`);
  });

  it('every Grade 2 arts and Islamic plan whose lesson has a real summary carries it', async () => {
    for (const subject of ['creative-arts', 'islamic']) {
      for (const l of lessonsOf('grade-2', subject)) {
        const idea = l.summaryAr.trim().split(/(?<=[.!؟?])/)[0]!.replace(/[«»]/g, '').trim();
        if (/^درس «/.test(l.summaryAr) || idea.length < 12) continue;
        assert.ok((await planFor(l)).mainActivity.includes(idea), `${l.titleAr}: the main idea is missing`);
      }
    }
  });

  it('a listening lesson is heard with books closed, not read aloud by students', async () => {
    for (const lang of ['arabic', 'english'] as const) {
      const p = await planFor(byId(SAMPLES.listening), lang);
      assert.match(p.mainActivity, lang === 'arabic' ? /والكتب مغلقة/ : /books closed/);
      assert.doesNotMatch(`${p.mainActivity}\n${p.guidedPractice}`, lang === 'arabic' ? /يقرأ الطلبة|قراءة ثنائية/ : /students read/i);
    }
  });

  it('the Grade 2 Arabic plans name their unit, and the reading plan its text', async () => {
    const reading = await planFor(byId(SAMPLES.reading));
    assert.match(reading.mainActivity, /«رِحْلَةُ قَطّورَة»|«رحلة قطورة»|رِحْلَة/);
    const listening = await planFor(byId(SAMPLES.listening));
    assert.match(norm(listening.mainActivity), /كوكبنا/);
  });

  it('every typed plan is in the teacher’s first-person voice', async () => {
    for (const type of LESSON_TYPES) {
      const p = await planFor(byId(SAMPLES[type]));
      for (const f of ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation'] as const) {
        assert.deepEqual(imperativesIn(p[f] ?? ''), [], `${type} · ${f}:\n${p[f]}`);
      }
      for (const f of ['mainActivity', 'guidedPractice', 'closure', 'assessment'] as const) {
        assert.match(norm(p[f] ?? ''), FIRST_PERSON, `${type} · ${f} never says «سأ…»:\n${p[f]}`);
      }
    }
  });
});

describe('homework and closure fit the grade', () => {
  it('reads a grade however the request spells it', () => {
    assert.equal(gradeLevelOf('grade-2'), 2);
    assert.equal(gradeLevelOf('Grade 2'), 2);
    assert.equal(gradeLevelOf('الصف الثاني'), 2);
    assert.equal(gradeLevelOf('الصف الثاني عشر'), 12);
    assert.equal(gradeLevelOf('الصف الحادي عشر'), 11);
    assert.equal(gradeLevelOf('الصف العاشر'), 10);
    assert.equal(gradeLevelOf('nonsense'), null);
    assert.equal(gradeBandOf(2), 'early');
    assert.equal(gradeBandOf(5), 'middle');
    assert.equal(gradeBandOf(10), 'upper');
    assert.equal(gradeBandOf(null), 'upper', 'a grade we cannot read keeps the plan as it was');
  });

  it('no Grade 2 plan asks for a long written summary or closes on a written card', async () => {
    const lessons = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-2');
    assert.ok(lessons.length >= 200, `only ${lessons.length} Grade 2 lessons — the catalog changed`);
    for (const l of lessons) {
      for (let i = 0; i < 3; i++) {
        const p = await planFor(l);
        assert.doesNotMatch(p.homework, /10 جمل|خمس جمل|فقرة|ملخص/, `${l.id}: ${p.homework}`);
        assert.doesNotMatch(p.closure, /3-2-1|يكتب|بطاقة/, `${l.id}: ${p.closure}`);
      }
    }
  });

  it('a Grade 2 maths plan in English gets a short task too', async () => {
    const l = lessonsOf('grade-2', 'mathematics')[0]!;
    for (let i = 0; i < 6; i++) {
      const p = await planFor(l, 'english');
      assert.doesNotMatch(p.homework, /10-sentence|5-sentence|summary/, p.homework);
      assert.doesNotMatch(p.closure, /3-2-1|write/i, p.closure);
    }
  });

  it('Grades 4–6 write at most five sentences; Grade 7 and up keep their homework', async () => {
    const g5 = lessonsOf('grade-5', 'mathematics')[0];
    assert.ok(g5, 'no Grade 5 maths lesson');
    for (let i = 0; i < 12; i++) assert.doesNotMatch((await planFor(g5)).homework, /10 جمل/);
    const g10 = KB_LESSONS.find(l => getBookForLesson(l)?.gradeId === 'grade-10' && lessonKindFor(getBookForLesson(l)!.subjectId) === 'calc')!;
    const seen = new Set<string>();
    for (let i = 0; i < 30; i++) seen.add((await planFor(g10)).homework.includes('10 جمل') ? 'ten' : 'other');
    assert.ok(seen.has('ten'), 'Grade 10 still draws the ten-sentence summary');
  });
});

describe('regenerating a typed plan', () => {
  const SECTIONS = ['introduction', 'mainActivity', 'guidedPractice', 'independentPractice', 'closure', 'assessment', 'differentiation', 'homework'] as const;
  const same = (a: LessonPlanOutput, b: LessonPlanOutput) => SECTIONS.filter(f => a[f] === b[f]);

  // These types have one wording of the five style-owned sections. A regenerate
  // changes the introduction, the closure and the homework, and says how many
  // sections stayed the same — never a silent identical plan.
  for (const type of ['hadith', 'creed', 'worship', 'sira', 'conduct', 'music', 'drama', 'listening', 'speaking', 'writing', 'language'] as const) {
    it(`${type}: the varying sections change, and the notice counts the rest`, async () => {
      const l = byId(SAMPLES[type]);
      let prev = await planFor(l);
      for (let i = 0; i < 6; i++) {
        const next = await planFor(l, 'arabic', { regenerate: true });
        const kept = same(prev, next);
        for (const f of ['introduction', 'closure', 'homework'] as const) assert.ok(!kept.includes(f), `${type}: ${f} did not change`);
        assert.deepEqual(next.repeated, { count: kept.length, of: SECTIONS.length });
        prev = next;
      }
    });
  }
});
