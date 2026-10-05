/**
 * A lesson plan is made of what the subject is made of.
 *
 * Every plan used to be the one maths skeleton with the title swapped in:
 * «اشرح «X» مع مثال محلول واضح», a worked-example card for each student,
 * «ماذا نفعل أولًا؟», «بيّن خطوات الحل كاملة». On a Quran lesson there is
 * nothing to solve; on a PE lesson no skill, drill or safety rule was named; on
 * a science lesson there was no observation. These run over the real catalog.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService } from '../ai/generators.ts';
import { LESSON_STYLE_IDS } from '../ai/lessonPlanBlueprints.ts';
import { arPrefixed, lessonKindFor, type LessonKind } from '../ai/lessonPlanKinds.ts';
import { arMinutes } from '../ai/lessonPlanTypes.ts';
import { KB_LESSONS, getBookForLesson } from '../knowledgeBase.ts';
import type { AIRequest, LessonPlanOutput } from '../ai/AIService.ts';

// The mock generator sleeps 1–2 s per call to feel like a model; this suite makes hundreds.
(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const lessonOf = (subjectId: string) => {
  const l = KB_LESSONS.find(x => getBookForLesson(x)?.subjectId === subjectId);
  assert.ok(l, `no ${subjectId} lesson — the catalog changed`);
  return l;
};

const planFor = (subjectId: string, style: string, lang: 'arabic' | 'english', lesson = lessonOf(subjectId)) =>
  aiService.generateLessonPlan({
    grade: getBookForLesson(lesson)!.gradeId, subject: subjectId, topic: lang === 'english' ? lesson.titleEn : lesson.titleAr,
    lessonId: lesson.id, language: lang, duration: 45, teachingStyle: style,
  } as AIRequest);

/** Everything a teacher reads, in one string. */
const text = (p: LessonPlanOutput) => JSON.stringify(p);

/** The maths routine, which only a maths lesson may carry. */
const MATHS_ISMS_AR = [/مثال محلول/, /خطوات الحل/, /ماذا نفعل أولًا/, /حل مسائل/, /مسائل متنوعة/, /الخطوة صحيحة/];
const MATHS_ISMS_EN = [/worked example/i, /show all working/i, /solve problems/i, /varied problems/i, /legal\?/i];

const SUBJECTS: Array<[string, LessonKind, RegExp, RegExp]> = [
  // subject id, kind, a phrase its direct plan must contain (Arabic, English)
  ['science', 'science', /لاحظ/, /observ/i],
  ['biology', 'science', /لاحظ/, /observ/i],
  ['islamic', 'recitation', /مرتّلًا|يردّد/, /recitation|repeat after you/i],
  ['arabic', 'arabic', /قراءة/, /read/i],
  ['english', 'english', /Present/, /Present/],
  ['social', 'social', /مصدر/, /source/i],
  ['history', 'social', /مصدر/, /source/i],
  ['physical-education', 'movement', /السلامة/, /safety/i],
  ['creative-arts', 'making', /نموذج/, /model/i],
  ['digital-literacy', 'making', /نموذج/, /model/i],
];

describe('which kind of lesson a subject is', () => {
  it('maps every subject in the catalog, and only mathematics keeps the worked-example plan', () => {
    const ids = new Set(KB_LESSONS.map(l => getBookForLesson(l)?.subjectId).filter((x): x is string => !!x));
    assert.ok(ids.size > 10, 'the catalog changed');
    for (const id of ids) {
      const kind = lessonKindFor(id);
      if (id === 'mathematics') assert.equal(kind, 'calc');
      else assert.notEqual(kind, 'calc', `${id} would still get the maths plan`);
    }
  });

  it('an unknown or missing subject keeps the plan it always had', () => {
    assert.equal(lessonKindFor(undefined), 'calc');
    assert.equal(lessonKindFor('astrology'), 'calc');
  });
});

describe('a non-maths plan does not carry the maths routine', () => {
  for (const [subjectId, kind] of SUBJECTS) {
    for (const [lang, isms] of [['arabic', MATHS_ISMS_AR], ['english', MATHS_ISMS_EN]] as const) {
      it(`${subjectId} (${kind}, ${lang}): no worked examples, no solving, in any style`, async () => {
        for (const style of LESSON_STYLE_IDS) {
          const t = text(await planFor(subjectId, style, lang));
          for (const re of isms) assert.ok(!re.test(t), `${subjectId}/${style}/${lang} still says ${re}`);
        }
      });
    }
  }

  for (const [subjectId, , arPhrase, enPhrase] of SUBJECTS) {
    it(`${subjectId}: its direct plan is its own routine`, async () => {
      assert.match((await planFor(subjectId, 'direct', 'arabic')).mainActivity, arPhrase);
      assert.match((await planFor(subjectId, 'direct', 'english')).mainActivity, enPhrase);
    });
  }

  it('mathematics keeps its worked-example plan', async () => {
    const p = await planFor('mathematics', 'direct', 'arabic');
    assert.match(p.mainActivity, /أنا أفعل/);
    assert.match(p.guidedPractice, /نحن نفعل/);
  });
});

describe('the teaching style still shapes every kind', () => {
  const FIELDS = ['materials', 'mainActivity', 'guidedPractice', 'independentPractice', 'assessment', 'differentiation'] as const;
  for (const [subjectId] of SUBJECTS) {
    it(`${subjectId}: all three styles differ on every style-owned field`, async () => {
      const out: Record<string, LessonPlanOutput> = {};
      for (const style of LESSON_STYLE_IDS) out[style] = await planFor(subjectId, style, 'arabic');
      for (const field of FIELDS) {
        const values = LESSON_STYLE_IDS.map(s => JSON.stringify((out[s] as unknown as Record<string, unknown>)[field]));
        assert.equal(new Set(values).size, LESSON_STYLE_IDS.length, `${subjectId}: "${field}" is shared between styles`);
      }
    });
  }

  it('inquiry on a non-maths lesson looks for an idea, not «the rule»', async () => {
    const p = await planFor('science', 'inquiry', 'arabic');
    assert.doesNotMatch(text(p), /القاعدة/);
    assert.match(p.guidedPractice, /لا تشرح الفكرة/);
    // Language lessons do have rules.
    assert.match((await planFor('arabic', 'inquiry', 'arabic')).guidedPractice, /لا تشرح القاعدة/);
  });
});

describe('a science plan works a calculation only where the subject has them', () => {
  it('physics and chemistry do, biology does not', async () => {
    const calc = /حسابًا|calculation/;
    assert.match(text(await planFor('physics', 'direct', 'arabic')), calc);
    assert.match(text(await planFor('chemistry', 'direct', 'english')), calc);
    assert.doesNotMatch(text(await planFor('biology', 'direct', 'arabic')), calc);
  });
});

describe('the plan\'s wording', () => {
  it('says «10 دقائق», not «10 دقيقة»', () => {
    assert.equal(arMinutes(1), 'دقيقة واحدة');
    assert.equal(arMinutes(2), 'دقيقتان');
    assert.equal(arMinutes(8), '8 دقائق');
    assert.equal(arMinutes(14), '14 دقيقة');
  });

  it('writes «للتحويل» and «بالتصنيف», not «لـالتحويل»', () => {
    assert.equal(arPrefixed('ل', 'التَّحْويلُ'), 'للتَّحْويلُ');
    assert.equal(arPrefixed('ب', 'التَّصْنيفُ'), 'بالتَّصْنيفُ');
    assert.equal(arPrefixed('ب', 'سورَةُ الإِخْلاصِ'), 'بسورَةُ الإِخْلاصِ');
  });

  it('every Arabic plan in the catalog is clean of the three leaks', async () => {
    const bad: string[] = [];
    // One lesson in five keeps this quick; the catalog is ~2,500 lessons.
    for (const [i, lesson] of KB_LESSONS.entries()) {
      if (i % 5 !== 0) continue;
      // Objectives are the curriculum's own words (some carry the book's kashida stretching).
      const t = text({ ...(await planFor(getBookForLesson(lesson)!.subjectId, 'direct', 'arabic', lesson)), objectives: [] });
      // «بـ«…»» before a quoted title is the file's convention; «لـالتحويل» is the defect.
      if (/[لب]ـ(?=[ء-ي])/.test(t)) bad.push(`${lesson.id}: a prefix glued to a word with a tatweel`);
      if (/\((?:[3-9]|10) دقيقة\)/.test(t)) bad.push(`${lesson.id}: «(N دقيقة)» after a number from 3 to 10`);
      if (/undefined|NaN|\$\{/.test(t)) bad.push(`${lesson.id}: a template leaked`);
    }
    assert.deepEqual(bad.slice(0, 5), [], `${bad.length} plans leak`);
  });

  it('a typed topic with a subject name and no lesson still gets that subject\'s plan', async () => {
    const p = await aiService.generateLessonPlan({
      grade: 'الصف الثالث', subject: 'التربية الإسلامية', topic: 'موضوع حر', language: 'arabic', duration: 45,
    } as AIRequest);
    assert.match(p.mainActivity, /مرتّلًا/);
    assert.doesNotMatch(text(p), /مثال محلول/);
  });
});
