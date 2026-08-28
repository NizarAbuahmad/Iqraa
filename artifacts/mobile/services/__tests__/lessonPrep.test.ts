/**
 * Lesson-prep request building — the curriculum browser's "prepare this lesson"
 * path.
 *
 * Runs with Node's built-in test runner:
 *   node --experimental-strip-types --test artifacts/mobile/services/__tests__/lessonPrep.test.ts
 *
 * Covers:
 *  1. Grade, subject and duration come from the lesson's own book, not defaults.
 *  2. The topic is the localised title — an Arabic UI searches the KB in Arabic,
 *     which is what makes a curriculum lesson resolve as grounded at all.
 *  3. Objectives from the lesson are passed through.
 *  4. Ungrounded lessons carry the explicit "do not claim textbook grounding" note.
 *  5. Picker indices point at the lesson's own grade/subject for the handoff to
 *     the full tool.
 *  6. `lessonPickerParams` turns those indices into route params, and returns
 *     null rather than a wrong-subject default when the lesson is unknown.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildLessonPrepRequest,
  lessonPickerParams,
  lessonPrepPickerIndices,
  resolveLessonPrepContext,
  scopePickerParams,
} from '../lessonPrep.ts';
import { getPickerGrades, getPickerSubjects, getLessonById } from '../curriculumData.ts';

/**
 * Chemistry G10 S1 — has distinct Arabic and English titles, and is in the KB.
 * Same lesson («نظرية بور لذرة الهيدروجين») the hand-written `lesson-chem-1`
 * used to carry; it moved to its NCCD id when the browser catalog started
 * reading the student-book JSON.
 */
const CHEM_LESSON_ID = 'kbl-chem-s1-nccd-u1_l1';
/** Math G10 S1 NCCD — the main demo path. */
const MATH_LESSON_ID = 'kbl-math-s1-nccd-u1_l1';

describe('resolveLessonPrepContext', () => {
  it('takes grade, subject and duration from the lesson book', () => {
    const ctx = resolveLessonPrepContext(CHEM_LESSON_ID, 'ar');
    assert.ok(ctx, 'chemistry lesson should resolve');
    assert.equal(ctx.gradeId, 'grade-10');
    assert.equal(ctx.subjectId, 'chemistry');
    // English for the prompt (feeds isMathContext), Arabic for display.
    assert.equal(ctx.subjectName, 'Chemistry');
    assert.equal(ctx.subjectLabel, 'الكيمياء');
    assert.equal(ctx.gradeName, 'الصف العاشر');
    assert.equal(ctx.duration, getLessonById(CHEM_LESSON_ID)!.estimatedDuration);
  });

  it('uses the localised title as the topic', () => {
    const lesson = getLessonById(CHEM_LESSON_ID)!;
    assert.equal(resolveLessonPrepContext(CHEM_LESSON_ID, 'ar')!.topic, lesson.titleAr);
    assert.equal(resolveLessonPrepContext(CHEM_LESSON_ID, 'en')!.topic, lesson.title);
  });

  it('returns null for an unknown lesson', () => {
    assert.equal(resolveLessonPrepContext('no-such-lesson', 'ar'), null);
  });
});

describe('buildLessonPrepRequest', () => {
  it('grounds an Arabic request that the English title would have missed', () => {
    const built = buildLessonPrepRequest({ lessonId: CHEM_LESSON_ID, lang: 'ar' });
    assert.ok(built);
    assert.equal(built.grounded, true, 'Arabic title must resolve against the Arabic KB');
    assert.ok(built.groundedLessonTitle);
    assert.ok(
      built.request.additionalContext?.includes(built.context.topic),
      'grounded context should carry the lesson',
    );
  });

  it('carries the lesson objectives and its own period length', () => {
    const lesson = getLessonById(MATH_LESSON_ID)!;
    const built = buildLessonPrepRequest({ lessonId: MATH_LESSON_ID, lang: 'ar' })!;
    assert.equal(built.request.duration, lesson.estimatedDuration);
    assert.equal(built.request.language, 'arabic');
    assert.equal(built.request.teachingStyle, 'direct');
    for (const obj of (lesson.objectivesAr ?? lesson.objectives)) {
      assert.ok(built.request.objectives?.includes(obj), `objective missing: ${obj}`);
    }
  });

  it('honours duration, style and adaptation overrides', () => {
    const built = buildLessonPrepRequest({
      lessonId: MATH_LESSON_ID,
      lang: 'ar',
      duration: 90,
      teachingStyle: 'inquiry',
      adaptations: 'طالب لديه صعوبات في القراءة',
    })!;
    assert.equal(built.request.duration, 90);
    assert.equal(built.request.teachingStyle, 'inquiry');
    assert.ok(built.request.additionalContext?.includes('طالب لديه صعوبات في القراءة'));
    // Delivery instructions must not be presented to the model as objectives.
    assert.ok(!built.request.objectives?.includes('صعوبات في القراءة'));
  });

  it('labels an ungrounded lesson honestly instead of claiming the textbook', () => {
    // Find a browsable lesson whose title does not resolve in the KB.
    const ungrounded = ['lesson-chem-3', 'lesson-sci-1']
      .map(id => buildLessonPrepRequest({ lessonId: id, lang: 'ar' }))
      .find(b => b && !b.grounded);
    assert.ok(ungrounded, 'expected at least one non-KB lesson fixture');
    assert.equal(ungrounded.groundedLessonTitle, null);
    assert.match(ungrounded.request.additionalContext ?? '', /غير موجود في المنهج/);
  });

  it('returns null for an unknown lesson', () => {
    assert.equal(buildLessonPrepRequest({ lessonId: 'no-such-lesson', lang: 'ar' }), null);
  });
});

describe('lessonPrepPickerIndices', () => {
  it('points the full tool at the lesson own grade and subject', () => {
    const ctx = resolveLessonPrepContext(CHEM_LESSON_ID, 'ar')!;
    const { gradeIdx, subjectIdx } = lessonPrepPickerIndices(ctx);
    assert.equal(getPickerGrades()[gradeIdx]!.id, 'grade-10');
    assert.equal(getPickerSubjects()[subjectIdx]!.id, 'chemistry');
  });
});

describe('lessonPickerParams', () => {
  // Every generator screen defaults these to index 0 — Grade 10 Mathematics —
  // and generates with `subjects[subjectIdx].name`, which `isMathContext`
  // branches on. A chemistry lesson opened without them gets maths questions.
  it('carries the lesson own subject as route params', () => {
    const params = lessonPickerParams(CHEM_LESSON_ID, 'ar');
    assert.ok(params);
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'chemistry');
    assert.equal(getPickerGrades()[Number(params.gradeIdx)]!.id, 'grade-10');
  });

  it('emits strings, because route params are strings', () => {
    const params = lessonPickerParams(CHEM_LESSON_ID, 'ar')!;
    assert.equal(typeof params.gradeIdx, 'string');
    assert.equal(typeof params.subjectIdx, 'string');
  });

  it('agrees with lessonPrepPickerIndices for the same lesson', () => {
    const ctx = resolveLessonPrepContext(CHEM_LESSON_ID, 'ar')!;
    const indices = lessonPrepPickerIndices(ctx);
    const params = lessonPickerParams(CHEM_LESSON_ID, 'ar')!;
    assert.equal(params.gradeIdx, String(indices.gradeIdx));
    assert.equal(params.subjectIdx, String(indices.subjectIdx));
  });

  it('still resolves the subject in an English UI', () => {
    const params = lessonPickerParams(CHEM_LESSON_ID, 'en');
    assert.ok(params);
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'chemistry');
  });

  // Null, not `{subjectIdx: '0'}`: with no lesson to speak for, the screen's
  // own default is honest, while a fabricated index would send the teacher to
  // a subject nobody chose.
  it('returns null for an unknown or absent lesson', () => {
    assert.equal(lessonPickerParams('no-such-lesson', 'ar'), null);
    assert.equal(lessonPickerParams(null, 'ar'), null);
    assert.equal(lessonPickerParams(undefined, 'ar'), null);
  });
});

describe('scopePickerParams', () => {
  // The evaluation results and marking screens hand off to the worksheet
  // generator with indices they used to compute against a grade-filtered
  // subject list, while the receiving screens rebuild the *bare* list. The two
  // only agreed because INVESTOR_MVP_CURRICULUM flattens the argument today —
  // this helper pins the receiver's own lists.
  it('indices point into the exact lists the generator screens rebuild', () => {
    const params = scopePickerParams('grade-10', 'chemistry');
    assert.ok(params);
    assert.equal(getPickerGrades()[Number(params.gradeIdx)]!.id, 'grade-10');
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'chemistry');
  });

  it('agrees with lessonPickerParams for a lesson of the same scope', () => {
    const ctx = resolveLessonPrepContext(CHEM_LESSON_ID, 'ar')!;
    const fromLesson = lessonPickerParams(CHEM_LESSON_ID, 'ar')!;
    const fromScope = scopePickerParams(ctx.gradeId, ctx.subjectId)!;
    assert.deepEqual(fromScope, fromLesson);
  });

  it('returns null rather than a fabricated index for an unknown scope', () => {
    assert.equal(scopePickerParams('grade-3', 'mathematics'), null);
    assert.equal(scopePickerParams('grade-10', 'no-such-subject'), null);
    assert.equal(scopePickerParams(null, 'mathematics'), null);
    assert.equal(scopePickerParams('grade-10', undefined), null);
  });
});
