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
  buildGapWarmupRequest,
  buildLessonPrepRequest,
  groundedSubjectConflict,
  lessonPickerParams,
  lessonPrepPickerIndices,
  resolveLessonPrepContext,
  scopePickerParams,
  topicPickerParams,
} from '../lessonPrep.ts';
import { getObjectivesForLesson, getPickerGrades, getPickerSubjects, getLessonById } from '../curriculumData.ts';

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

  it('leaves prior-review fields absent when nothing was asked for (regression)', () => {
    const built = buildLessonPrepRequest({ lessonId: MATH_LESSON_ID, lang: 'ar' })!;
    assert.equal(built.request.priorTopicsNotes, undefined);
    assert.equal(built.request.includePriorReview, undefined);
    assert.equal(built.request.priorKnowledge, undefined);
  });

  it('trims free-text prior-topics notes and omits them when blank', () => {
    const withNotes = buildLessonPrepRequest({
      lessonId: MATH_LESSON_ID,
      lang: 'ar',
      priorTopicsNotes: '  راجع حل المعادلات من الصف التاسع  ',
    })!;
    assert.equal(withNotes.request.priorTopicsNotes, 'راجع حل المعادلات من الصف التاسع');

    const blank = buildLessonPrepRequest({
      lessonId: MATH_LESSON_ID,
      lang: 'ar',
      priorTopicsNotes: '   ',
    })!;
    assert.equal(blank.request.priorTopicsNotes, undefined);
  });

  it('populates priorKnowledge from the unit only when the teacher asked and the unit actually has it', () => {
    // u1 (math s1) carries prior_knowledge — ticking the box surfaces it.
    const withReview = buildLessonPrepRequest({
      lessonId: MATH_LESSON_ID,
      lang: 'ar',
      includePriorReview: true,
    })!;
    assert.equal(withReview.request.includePriorReview, true);
    assert.ok(withReview.request.priorKnowledge?.length, 'expected grounded prior-knowledge concepts');

    // Same lesson, box unticked: never sent even though the unit has data.
    const unticked = buildLessonPrepRequest({
      lessonId: MATH_LESSON_ID,
      lang: 'ar',
      includePriorReview: false,
    })!;
    assert.equal(unticked.request.includePriorReview, undefined);
    assert.equal(unticked.request.priorKnowledge, undefined);

    // Chemistry lessons are outside the two catalogs getUnitPriorKnowledge
    // reads — ticking the box must not fabricate concepts for them.
    const noData = buildLessonPrepRequest({
      lessonId: CHEM_LESSON_ID,
      lang: 'ar',
      includePriorReview: true,
    })!;
    assert.equal(noData.request.includePriorReview, undefined);
    assert.equal(noData.request.priorKnowledge, undefined);
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

/**
 * The reported repro: `/ai-tools/quiz?topic=معمل برمجية جيوجبرا: حل أنظمة
 * المعادلات بيانياً` — a Grade 10 math lesson carried as a bare topic param.
 * With no picker params the screen fell back to index 0 for both pickers,
 * which (after Grade 9 and English joined the MVP lists) meant الصف التاسع +
 * اللغة الإنجليزية, and the model generated math questions titled «اختبار في
 * اللغة الإنجليزية».
 */
const GEOGEBRA_LAB_TOPIC_AR = 'معمل برمجية جيوجبرا: حل أنظمة المعادلات بيانياً';

describe('topicPickerParams', () => {
  it('grounds the reported bare-topic URL onto Grade 10 Mathematics', () => {
    const params = topicPickerParams(GEOGEBRA_LAB_TOPIC_AR, 'ar');
    assert.ok(params, 'the GeoGebra lab lesson must ground');
    assert.equal(getPickerGrades()[Number(params.gradeIdx)]!.id, 'grade-10');
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'mathematics');
  });

  it('resolves a chemistry lesson title onto chemistry', () => {
    const chemTitle = getLessonById(CHEM_LESSON_ID)!.titleAr;
    const params = topicPickerParams(chemTitle, 'ar');
    assert.ok(params);
    assert.equal(getPickerSubjects()[Number(params.subjectIdx)]!.id, 'chemistry');
    assert.equal(getPickerGrades()[Number(params.gradeIdx)]!.id, 'grade-10');
  });

  it('agrees with lessonPickerParams for the same lesson', () => {
    const chemTitle = getLessonById(CHEM_LESSON_ID)!.titleAr;
    assert.deepEqual(
      topicPickerParams(chemTitle, 'ar'),
      lessonPickerParams(CHEM_LESSON_ID, 'ar'),
    );
  });

  // Null, not a guess: a free-typed topic that grounds nowhere gives the
  // screen no reason to move its pickers.
  it('returns null for an ungrounded, empty or absent topic', () => {
    assert.equal(topicPickerParams('موضوع حر لا يطابق أي درس', 'ar'), null);
    assert.equal(topicPickerParams('', 'ar'), null);
    assert.equal(topicPickerParams('   ', 'ar'), null);
    assert.equal(topicPickerParams(null, 'ar'), null);
    assert.equal(topicPickerParams(undefined, 'ar'), null);
  });
});

describe('groundedSubjectConflict', () => {
  // The manual half of the same repro: subject picker on English, topic still
  // a math lesson. Generating anyway makes a paper whose header and content
  // disagree, so the screens refuse and name the lesson's real subject.
  it('flags a math lesson topic under the English subject', () => {
    const conflict = groundedSubjectConflict(GEOGEBRA_LAB_TOPIC_AR, 'ar', 'english');
    assert.ok(conflict, 'math lesson under English must conflict');
    assert.equal(conflict.id, 'mathematics');
    assert.equal(conflict.nameAr, 'الرياضيات');
  });

  it('is silent when the picked subject matches the lesson', () => {
    assert.equal(groundedSubjectConflict(GEOGEBRA_LAB_TOPIC_AR, 'ar', 'mathematics'), null);
    const chemTitle = getLessonById(CHEM_LESSON_ID)!.titleAr;
    assert.equal(groundedSubjectConflict(chemTitle, 'ar', 'chemistry'), null);
  });

  it('is silent for an ungrounded topic — nothing to contradict', () => {
    assert.equal(groundedSubjectConflict('موضوع حر لا يطابق أي درس', 'ar', 'english'), null);
    assert.equal(groundedSubjectConflict('', 'ar', 'english'), null);
  });
});

describe('buildGapWarmupRequest', () => {
  // The results dashboard's "teach the gap" button. It must land on the weak
  // objective's OWN lesson (carrying the KB id, not a title), as a warm-up,
  // with the objective text as the stated aim — and stay shareable, since
  // nothing in it was typed by the teacher.
  it('builds an 8-minute warm-up on the objective\'s own lesson', () => {
    const objective = getObjectivesForLesson(MATH_LESSON_ID)[0];
    assert.ok(objective, 'the demo math lesson should have objectives');
    const built = buildGapWarmupRequest(objective.id, 'ar');
    assert.ok(built, 'a known objective should resolve');
    assert.equal(built.context.lessonId, MATH_LESSON_ID);
    assert.equal(built.request.topic, getLessonById(MATH_LESSON_ID)!.titleAr);
    assert.equal(built.request.subject, 'Mathematics');
    assert.equal(built.request.activityVariant, 'warmup');
    assert.equal(built.request.duration, 8);
    assert.equal(built.request.contextSource, 'curriculum');
    assert.equal(built.request.objectives, objective.descriptionAr);
    assert.equal(built.objectiveText, objective.descriptionAr);
    assert.ok(built.request.lessonId, 'the request should carry the grounded lesson id');
  });

  it('returns null for an unknown objective, so the button stays hidden', () => {
    assert.equal(buildGapWarmupRequest('o-no-such-objective', 'ar'), null);
  });
});
