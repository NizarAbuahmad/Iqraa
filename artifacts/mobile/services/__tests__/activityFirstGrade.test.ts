/**
 * Grade 1 activities and quick checks are written for six-year-olds.
 *
 * Swept 2026-11-13: a Grade 1 «حرف الباء» activity opened with «اكتب من ذاكرتك
 * — الدفاتر مغلقة», its discussion defended a claim in writing, its game asked
 * teams to «عرّف» the letter and bet points; the deck's quick check said «اشرح
 * بكلماتك… اكتب إجابتك على لوحك». `activityFirstGrade.ts` replaces all of it for
 * Grade 1 lessons; every other grade keeps its activities.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { aiService, buildOfflineActivity } from '../ai/generators.ts';
import { ACTIVITY_BLUEPRINT_IDS } from '../ai/activityBlueprints.ts';
import { KB_LESSONS, getBookForLesson, getLessonById } from '../knowledgeBase.ts';
import type { ActivityOutput, AIRequest, ClassroomActivity, ClassroomActivityRequest } from '../ai/AIService.ts';

(aiService as unknown as { delay: () => Promise<void> }).delay = async () => {};

const G1 = KB_LESSONS.filter(l => getBookForLesson(l)?.gradeId === 'grade-1');

const reqFor = (lessonId: string, type: string, language: 'arabic' | 'english' = 'arabic'): AIRequest => {
  const l = getLessonById(lessonId)!;
  const b = getBookForLesson(l)!;
  return {
    grade: language === 'arabic' ? 'الصف الأول' : 'Grade 1', subject: b.subjectId, lessonId,
    topic: language === 'arabic' ? l.titleAr : l.titleEn, language,
    activityType: type === 'warmup' ? 'group' : type,
    ...(type === 'warmup' ? { activityVariant: 'warmup' } : {}),
  } as AIRequest;
};

const textOf = (a: ActivityOutput) => [
  a.title, a.objective, a.groupSize, ...a.materials, ...a.steps.flatMap(s => [s.title, s.description]),
  ...a.teacherTips, a.differentiation, a.assessment,
].join('\n');

/** What the all-grades activities ask, which a six-year-old cannot do. */
const TOO_OLD_AR = [/اكتب من ذاكرتك/, /الدفاتر مغلقة/, /ادعاء/, /عرّف/, /يراهن|رهان/, /مثال محلول/, /فقرة/, /ورقة عمل فردية/, /برّر|تبرير/, /اشرح بكلماتك/, /تجربة مضبوطة/];
const TOO_OLD_EN = [/from memory/i, /\bclaim/i, /\bbet(s|ting)?\b/i, /worked example/i, /paragraph/i, /justif/i, /explain in your own words/i];

describe('every Grade 1 lesson, every activity format', () => {
  it('asks nothing of a six-year-old that an older class does, and its steps add up', () => {
    const bad: string[] = [];
    for (const l of G1) {
      for (const type of ACTIVITY_BLUEPRINT_IDS) {
        const a = buildOfflineActivity(reqFor(l.id, type));
        const t = textOf(a);
        for (const re of TOO_OLD_AR) if (re.test(t)) bad.push(`${l.id} · ${type}: ${re}`);
        if (/undefined|NaN|\$\{/.test(t)) bad.push(`${l.id} · ${type}: a template leaked`);
        const sum = a.steps.reduce((s, x) => s + x.durationMin, 0);
        if (sum !== a.totalDuration) bad.push(`${l.id} · ${type}: steps ${sum} ≠ ${a.totalDuration}`);
        if (a.activityType !== (type === 'warmup' ? 'warmup' : type)) bad.push(`${l.id} · ${type}: reported ${a.activityType}`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('in English too', () => {
    const bad: string[] = [];
    for (const [i, l] of G1.entries()) {
      if (i % 4 !== 0) continue;
      for (const type of ACTIVITY_BLUEPRINT_IDS) {
        const t = textOf(buildOfflineActivity(reqFor(l.id, type, 'english')));
        for (const re of TOO_OLD_EN) if (re.test(t)) bad.push(`${l.id} · ${type}: ${re}`);
      }
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('keeps the six formats apart on every field', () => {
    for (const id of ['kbl-g1-arabic-s1-nccd-u1_l6', 'kbl-g1-math-s2-nccd-u6_l1', 'kbl-g1-science-s1-nccd-u2_l1']) {
      const all = ACTIVITY_BLUEPRINT_IDS.map(type => buildOfflineActivity(reqFor(id, type)));
      for (const field of ['title', 'groupSize', 'assessment'] as const) {
        assert.equal(new Set(all.map(a => a[field])).size, all.length, `${id}: ${field} repeats`);
      }
      assert.equal(new Set(all.map(a => a.steps.map(s => s.title).join('|'))).size, all.length, `${id}: steps repeat`);
    }
  });
});

describe('what a Grade 1 activity is made of', () => {
  it('a letter lesson’s game and hands-on are about the letter', () => {
    const game = buildOfflineActivity(reqFor('kbl-g1-arabic-s1-nccd-u1_l6', 'game'));
    assert.match(textOf(game), /صوت حرف ب/);
    const hands = buildOfflineActivity(reqFor('kbl-g1-arabic-s1-nccd-u1_l6', 'hands-on'));
    assert.match(textOf(hands), /يشكّل كل طفل حرف ب/);
  });

  it('a maths game reads one of the lesson’s own questions aloud', () => {
    const a = buildOfflineActivity(reqFor('kbl-g1-math-s2-nccd-u6_l1', 'game'));
    // The item is drawn at random (a sum, a missing number or a story); all of them hold a ten.
    assert.match(a.steps[1]!.description, /مثل: «[^»]*\d0[^»]*»/);
  });

  it('a group activity gives each child one job, a discussion is the whole class', () => {
    assert.match(buildOfflineActivity(reqFor('kbl-g1-science-s1-nccd-u2_l1', 'group')).groupSize, /لكل طفل دور واحد/);
    assert.match(buildOfflineActivity(reqFor('kbl-g1-science-s1-nccd-u2_l1', 'discussion')).groupSize, /الصف كله/);
  });
});

describe('other grades keep their activities', () => {
  it('a Grade 2 and a Grade 10 activity are the all-grades one', () => {
    for (const grade of ['grade-2', 'grade-10']) {
      const l = KB_LESSONS.find(x => { const b = getBookForLesson(x); return b?.gradeId === grade && b.subjectId === 'arabic'; })!;
      const b = getBookForLesson(l)!;
      const a = buildOfflineActivity({ grade: b.gradeId, subject: 'arabic', lessonId: l.id, topic: l.titleAr, language: 'arabic', activityType: 'individual' } as AIRequest);
      assert.doesNotMatch(a.groupSize, /كل طفل مع أشيائه/, grade);
    }
  });
});

describe('the deck’s quick check for Grade 1', () => {
  const check = (lessonId: string, language: 'arabic' | 'english' = 'arabic'): Promise<ClassroomActivity> => {
    const l = getLessonById(lessonId)!;
    const b = getBookForLesson(l)!;
    return aiService.generateClassroomActivity({
      grade: language === 'arabic' ? 'الصف الأول' : 'Grade 1', subject: b.subjectId, lessonId,
      topic: language === 'arabic' ? l.titleAr : l.titleEn, language, activityType: 'quick-check',
      duration: 10, difficulty: 'standard', groupType: 'whole-class', teachingGoal: 'assessment', numQuestions: 5,
    } as ClassroomActivityRequest);
  };

  it('is spoken and answered all together for every Grade 1 lesson with no bank', async () => {
    const bad: string[] = [];
    for (const l of G1) {
      if (getBookForLesson(l)!.subjectId === 'mathematics') continue;
      const a = await check(l.id);
      const t = a.slides.map(s => `${s.title}\n${s.content ?? ''}`).join('\n');
      if (/اشرح بكلماتك|اكتب إجابتك|يكتب إجابته/.test(t)) bad.push(`${l.id}: asks for writing`);
      if (a.slides.filter(s => s.type === 'challenge').length < 3) bad.push(`${l.id}: fewer than 3 prompts`);
      if (/undefined|NaN/.test(t)) bad.push(`${l.id}: a template leaked`);
    }
    assert.deepEqual(bad.slice(0, 8), [], `${bad.length} problems`);
  });

  it('a letter lesson asks about the letter', async () => {
    const a = await check('kbl-g1-arabic-s1-nccd-u1_l6');
    assert.match(a.slides.map(s => s.content).join('\n'), /قولوا كلمة تبدأ بصوت حرف ب/);
  });

  it('a Grade 1 maths check keeps its own questions', async () => {
    const a = await check('kbl-g1-math-s2-nccd-u6_l1');
    assert.ok(a.slides.some(s => s.type === 'question'), 'no maths questions');
  });
});
