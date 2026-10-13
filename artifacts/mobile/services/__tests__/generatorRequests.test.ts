/**
 * Request bodies are built in generatorRequests.ts and nowhere else, so the
 * pregenerate script and the screens hash to the same artifact. The activity
 * screen was the one generator still assembling its own body inline, with a
 * different context rule and the English grade name.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { buildActivityRequest, buildLessonPlanRequest } from '../generatorRequests.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';
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
