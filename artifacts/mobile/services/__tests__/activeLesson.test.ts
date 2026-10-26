/**
 * One rule names "the lesson the teacher is on", for every surface.
 *
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/activeLesson.test.ts
 *
 * The reported bug (app.iqrra.com/iqra, desktop): the chat's lesson strip read
 * «الأنظمة النجمية والكوكبات» while the sidebar's «الدرس الحالي» card read
 * «المفردات والقواعد — اللغة الإنجليزية · الصف العاشر», for the same teacher at
 * the same moment. The chat and Today let the timetable's lesson replace a pick
 * that was not made today; the tab layout never asked the timetable, so it
 * showed the older pick or the default. Each surface carried its own copy of
 * the rule, so they could drift — `resolveActiveLesson` is the one copy.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { resolveActiveLesson, type ActiveLesson, type HomeLessonPick } from '../lessonContext.ts';
import { resolveLessonPrepContext } from '../lessonPrep.ts';

const TODAY = '2026-10-26';
const YESTERDAY = '2026-10-25';

// «الأنظمة النجمية والكوكبات» — grade 10 earth science, the period's lesson.
const STARS = 'kbl-earth-science-s1-nccd-u2_l2';
// «المفردات والقواعد» — grade 10 English. The same title repeats across units 1-3,
// so the id, not the title, is what has to travel.
const ENGLISH_U1 = 'kbl-eng-s1-nccd-u1_l1';
const ENGLISH_U2 = 'kbl-eng-s1-nccd-u2_l1';

const ctx = (lessonId: string): ActiveLesson => {
  const c = resolveLessonPrepContext(lessonId, 'ar');
  assert.ok(c, `${lessonId} must exist in the KB`);
  return { topic: c.topic, lessonId: c.lessonId, gradeId: c.gradeId, subjectId: c.subjectId };
};

const pickOf = (lessonId: string, pickedOn?: string): HomeLessonPick => {
  const c = ctx(lessonId);
  return { topic: c.topic, unitOrder: null, gradeId: c.gradeId, subjectId: c.subjectId, lessonId, pickedOn };
};

describe('resolveActiveLesson — the reported scenario', () => {
  const scheduled = ctx(STARS);
  const fallback = ctx(ENGLISH_U1);

  it('names the period\'s lesson when the saved pick is from an earlier day', () => {
    const { lesson, source } = resolveActiveLesson({
      pick: pickOf(ENGLISH_U2, YESTERDAY), scheduled, fallback, today: TODAY,
    });
    assert.equal(lesson?.lessonId, STARS);
    assert.equal(lesson?.topic, 'الأنظمة النجمية والكوكبات');
    assert.equal(source, 'schedule');
  });

  it('names the period\'s lesson over the default when nothing was ever picked', () => {
    const { lesson, source } = resolveActiveLesson({ pick: null, scheduled, fallback, today: TODAY });
    assert.equal(lesson?.lessonId, STARS);
    assert.equal(source, 'schedule');
  });

  it('treats a pick saved before `pickedOn` existed as old', () => {
    const { lesson } = resolveActiveLesson({ pick: pickOf(ENGLISH_U2), scheduled, fallback, today: TODAY });
    assert.equal(lesson?.lessonId, STARS);
  });
});

describe('resolveActiveLesson — a decision made today wins', () => {
  it('keeps a pick made today over the timetable', () => {
    const { lesson, source } = resolveActiveLesson({
      pick: pickOf(ENGLISH_U2, TODAY), scheduled: ctx(STARS), fallback: ctx(ENGLISH_U1), today: TODAY,
    });
    assert.equal(lesson?.lessonId, ENGLISH_U2, 'the id of the unit the teacher chose, not unit 1\'s identically-titled lesson');
    assert.equal(source, 'pick');
  });
});

describe('resolveActiveLesson — without a timetable lesson', () => {
  const fallback = ctx(ENGLISH_U1);

  it('keeps an older pick, because there is nothing better', () => {
    const { lesson, source } = resolveActiveLesson({
      pick: pickOf(ENGLISH_U2, YESTERDAY), scheduled: null, fallback, today: TODAY,
    });
    assert.equal(lesson?.lessonId, ENGLISH_U2);
    assert.equal(source, 'pick');
  });

  it('falls back to the default when there is no pick either', () => {
    const { lesson, source } = resolveActiveLesson({ pick: null, scheduled: null, fallback, today: TODAY });
    assert.equal(lesson?.lessonId, ENGLISH_U1);
    assert.equal(source, 'default');
  });

  it('is null — not an invented lesson — when there is nothing at all', () => {
    assert.deepEqual(resolveActiveLesson({ pick: null, scheduled: null, fallback: null, today: TODAY }), {
      lesson: null,
      source: null,
    });
  });

  it('reads a pick with a blank topic as no pick', () => {
    const blank: HomeLessonPick = { topic: '   ', unitOrder: null, pickedOn: TODAY };
    const { lesson, source } = resolveActiveLesson({ pick: blank, scheduled: null, fallback, today: TODAY });
    assert.equal(lesson?.lessonId, ENGLISH_U1);
    assert.equal(source, 'default');
  });
});

describe('resolveActiveLesson — the lesson it hands back', () => {
  it('carries the pick\'s lesson id, grade and subject along with the trimmed title', () => {
    const { lesson } = resolveActiveLesson({
      pick: { ...pickOf(ENGLISH_U2, TODAY), topic: '  المفردات والقواعد ' },
      scheduled: null, fallback: null, today: TODAY,
    });
    assert.deepEqual(lesson, {
      topic: 'المفردات والقواعد',
      lessonId: ENGLISH_U2,
      gradeId: 'grade-10',
      subjectId: 'english',
    });
  });

  it('gives a pick saved without a lesson id a null one, never undefined', () => {
    const { lesson } = resolveActiveLesson({
      pick: { topic: 'الاقترانات', unitOrder: null, pickedOn: TODAY },
      scheduled: null, fallback: null, today: TODAY,
    });
    assert.equal(lesson?.lessonId, null);
  });

  it('hands back only the lesson\'s own fields, so a caller\'s spread cannot leak the rest', () => {
    const full = { ...ctx(STARS), objectives: 'x', duration: 45 } as ActiveLesson;
    const { lesson } = resolveActiveLesson({ pick: null, scheduled: full, fallback: null, today: TODAY });
    assert.deepEqual(Object.keys(lesson ?? {}).sort(), ['gradeId', 'lessonId', 'subjectId', 'topic']);
  });
});
