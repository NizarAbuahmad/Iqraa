/**
 * Request bodies are built in generatorRequests.ts and nowhere else, so the
 * pregenerate script and the screens hash to the same artifact. The activity
 * screen was the one generator still assembling its own body inline, with a
 * different context rule and the English grade name.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildActivityRequest,
  buildLessonPlanRequest,
  buildLessonTeachingRequest,
  buildQuizRequest,
  buildWorksheetRequest,
  scopeRequestFields,
} from '../generatorRequests.ts';
import { groundingRequestFields, noLessonField, resolveGeneratorGrounding } from '../kbContext.ts';
import { getLessonById } from '../knowledgeBase.ts';

const LESSON = getLessonById('kbl-math-s1-nccd-u1_l1')!;

const form = {
  gradeName: 'الصف العاشر',
  subjectName: 'Mathematics',
  topic: LESSON.titleAr,
  lang: 'ar' as const,
  activityType: 'group' as const,
  durationMinutes: 20,
  objective: '',
};

describe('buildActivityRequest', () => {
  it('carries the localised grade name and the English subject, like the other builders', () => {
    const req = buildActivityRequest(form, resolveGeneratorGrounding(form.topic, 'ar'));
    assert.equal(req.grade, 'الصف العاشر');
    assert.equal(req.subject, 'Mathematics');
    assert.equal(req.topic, LESSON.titleAr);
    assert.equal(req.activityType, 'group');
    assert.equal(req.duration, 20);
    assert.equal(req.language, 'arabic');
  });

  it('pins the grounded lesson by id, with the book context', () => {
    const req = buildActivityRequest(form, resolveGeneratorGrounding(form.topic, 'ar'));
    assert.equal(req.lessonId, LESSON.id);
    assert.ok(req.additionalContext && req.additionalContext.length > 0);
    assert.equal(req.contextSource, 'curriculum');
  });

  it('is the teacher\'s own request once an objective is typed', () => {
    const req = buildActivityRequest({ ...form, objective: ' يطبّق القانون ' }, resolveGeneratorGrounding(form.topic, 'ar'));
    assert.equal(req.objectives, 'يطبّق القانون');
    assert.equal(req.contextSource, 'teacher');
  });

  it('asks for a replacement, not a copy, on regenerate', () => {
    const previous = { title: 'old' };
    const req = buildActivityRequest({ ...form, regenerate: true, previous }, resolveGeneratorGrounding(form.topic, 'ar'));
    assert.equal(req.regenerate, true);
  });
});

describe('buildLessonPlanRequest', () => {
  const planForm = {
    gradeName: 'الصف العاشر',
    subjectName: 'Mathematics',
    topic: LESSON.titleAr,
    lang: 'ar' as const,
    durationMinutes: 45,
    teachingStyle: 'direct' as const,
    objectives: '',
    adaptations: '',
    priorTopicsNotes: '',
    includePriorReview: false,
  };

  // The Ministry form needs a learner role per stage, and a second generation
  // at export time would no longer match the plan the teacher read and edited.
  // pregenerate.ts builds through this too, so the pooled plan and the one the
  // screen asks for hash to the same artifact.
  it('asks for the Ministry teacher/learner roles in the same call as the plan', () => {
    const req = buildLessonPlanRequest(planForm, resolveGeneratorGrounding(planForm.topic, 'ar'));
    assert.equal(req.ministryRoles, true);
  });

  it('asks for them whatever the teaching style, language or prior-review choice', () => {
    for (const teachingStyle of ['direct', 'inquiry', 'collaborative'] as const) {
      for (const lang of ['ar', 'en'] as const) {
        const req = buildLessonPlanRequest(
          { ...planForm, teachingStyle, lang, includePriorReview: true },
          resolveGeneratorGrounding(planForm.topic, lang),
        );
        assert.equal(req.ministryRoles, true, `${teachingStyle}/${lang}`);
      }
    }
  });
});

describe('a request no lesson grounds tells the API so', () => {
  // The API matches a topic's title across the whole catalog when a request
  // carries no unit, and attached another grade's book to a prompt this app
  // had labelled «الموضوع غير موجود في المنهاج». `grounding: 'none'` stops it;
  // a grounded body must stay exactly as it was, or its pooled key moves.
  const free = resolveGeneratorGrounding('لو كنت وزير التربية ليوم واحد', 'ar', { scope: { gradeId: 'grade-6' } });
  const grounded = resolveGeneratorGrounding(form.topic, 'ar');

  it('the free topic is ungrounded and the lesson is grounded (precondition)', () => {
    assert.equal(free.grounded, false);
    assert.equal(grounded.grounded, true);
  });

  it('every builder adds it when ungrounded, and only then', () => {
    const planForm = {
      gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: form.topic, lang: 'ar' as const,
      durationMinutes: 45, teachingStyle: 'direct' as const, objectives: '', adaptations: '',
      priorTopicsNotes: '', includePriorReview: false,
    };
    const worksheetForm = {
      gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: form.topic, lang: 'ar' as const,
      difficulty: 'medium' as const, numQuestions: 8, questionTypes: ['multiple_choice' as const], includePriorReview: false,
    };
    const builders: [string, (g: typeof free) => { grounding?: string }][] = [
      ['activity', g => buildActivityRequest(form, g)],
      ['lesson plan', g => buildLessonPlanRequest(planForm, g)],
      ['worksheet', g => buildWorksheetRequest(worksheetForm, g)],
      ['lesson teaching', g => buildLessonTeachingRequest({ gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: form.topic, lang: 'ar' }, g)],
      ['quiz', g => buildQuizRequest({
        gradeName: 'الصف العاشر', subjectName: 'Mathematics', topic: form.topic, lang: 'ar' as const, duration: 20, totalMarks: 20,
        questionTypes: ['multiple_choice'], numQuestions: 10, difficulty: 'easy',
      }, g)],
      ['groundingRequestFields', g => groundingRequestFields(g)],
    ];
    for (const [name, build] of builders) {
      assert.equal(build(free).grounding, 'none', `${name}: ungrounded`);
      assert.ok(!('grounding' in build(grounded)), `${name}: a grounded body gained the field`);
    }
  });

  it('a wide scope with no lessons says so; one with lessons does not', () => {
    const none = scopeRequestFields({
      kind: 'semester', scopeKey: 'k', grounded: false, lessons: [], context: '', unitIds: [],
      truncated: false, ungroundedNote: 'تنبيه',
    } as unknown as Parameters<typeof scopeRequestFields>[0]);
    assert.equal(none.grounding, 'none');
    const some = scopeRequestFields({
      kind: 'semester', scopeKey: 'k', grounded: true, lessons: [], context: 'سياق', unitIds: ['u'],
      truncated: false, ungroundedNote: '',
    } as unknown as Parameters<typeof scopeRequestFields>[0]);
    assert.ok(!('grounding' in some));
  });

  it('noLessonField is the one switch', () => {
    assert.deepEqual(noLessonField(false), { grounding: 'none' });
    assert.deepEqual(noLessonField(true), {});
  });
});

describe('buildQuizRequest', () => {
  const quizForm = {
    gradeName: 'الصف العاشر',
    subjectName: 'Mathematics',
    topic: ` ${LESSON.titleAr} `,
    lang: 'ar' as const,
    duration: 20,
    totalMarks: 20,
    questionTypes: ['multiple_choice', 'true_false', 'short_answer'] as ('multiple_choice' | 'true_false' | 'short_answer')[],
    numQuestions: 10,
    difficulty: 'easy' as const,
  };
  const grounding = () => resolveGeneratorGrounding(LESSON.titleAr, 'ar');

  it('is the quiz screen\'s request: its form, the grounded lesson by id, the curriculum as the context\'s source', () => {
    const req = buildQuizRequest(quizForm, grounding());
    assert.equal(req.grade, 'الصف العاشر');
    assert.equal(req.subject, 'Mathematics');
    assert.equal(req.topic, LESSON.titleAr, 'the topic is trimmed');
    assert.equal(req.language, 'arabic');
    assert.equal(req.duration, 20);
    assert.equal(req.totalMarks, 20);
    assert.deepEqual(req.questionTypes, ['multiple_choice', 'true_false', 'short_answer']);
    assert.equal(req.numQuestions, 10);
    assert.equal(req.difficulty, 'easy');
    assert.equal(req.lessonId, LESSON.id);
    assert.ok(req.additionalContext && req.additionalContext.length > 0);
    assert.equal(req.contextSource, 'curriculum');
    assert.equal(req.regenerate, undefined);
  });

  it('takes every lesson field from the one grounding, never from the title again', () => {
    const g = grounding();
    const req = buildQuizRequest(quizForm, g);
    const fields = groundingRequestFields(g);
    assert.equal(req.additionalContext, fields.additionalContext);
    assert.equal(req.unitId, fields.unitId);
    assert.equal(req.lessonId, fields.lessonId);
    assert.equal(req.bookFigureCount, fields.bookFigureCount);
  });

  it('sends no lesson fields at all for a wide scope (null grounding): the scope\'s own fields replace them', () => {
    const req = buildQuizRequest(quizForm, null);
    // `scopeRequestFields` decides `grounding` for a wide scope; the lesson path must not guess it here.
    assert.ok(!('grounding' in req) || req.grounding === undefined);
    assert.equal(req.lessonId, undefined);
    assert.equal(req.unitId, undefined);
    assert.equal(req.additionalContext, undefined);
    assert.equal(req.bookFigureCount, undefined);
    assert.equal(req.contextSource, 'curriculum');
  });

  it('asks for a replacement, not a copy, on regenerate', () => {
    const req = buildQuizRequest({ ...quizForm, regenerate: true, previous: { title: 'old' } }, grounding());
    assert.equal(req.regenerate, true);
  });
});
