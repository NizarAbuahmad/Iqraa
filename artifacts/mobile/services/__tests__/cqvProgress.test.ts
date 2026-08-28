import { test } from 'node:test';
import assert from 'node:assert';
import {
  isArtifactComplete,
  isLessonValidated,
  computeDimensionAverages,
  computeLessonsBlockedByMetric,
  getLessonProgress,
} from '../cqv/progress.ts';
import { CQV_ARTIFACT_IDS, type CqvArtifactId, type CqvReport, type CqvScores } from '../cqv/types.ts';
import { CQV_THRESHOLDS } from '../cqv/thresholds.ts';

// Passing scores: strictly above every threshold, so tests aren't sensitive
// to the exact configured values in thresholds.ts.
const PASSING_SCORES: CqvScores = {
  educationalQuality: 10,
  arabicLanguage: 10,
  curriculumAlignment: 10,
  teacherUsability: 10,
  formatting: 10,
  teacherTrust: 10,
};

function makeReport(overrides: Partial<CqvReport> & { artifactId: CqvArtifactId }): CqvReport {
  return {
    id: `${overrides.artifactId}-report`,
    lessonId: 'lesson-1',
    lessonName: 'Test Lesson',
    lessonNameAr: 'درس تجريبي',
    semester: 1,
    unitId: 'unit-1',
    unitName: 'Test Unit',
    unitNameAr: 'وحدة تجريبية',
    artifactLabel: overrides.artifactId,
    verdict: 'pass',
    scores: PASSING_SCORES,
    notes: '',
    improvements: '',
    reviewedAt: '2026-08-27T00:00:00.000Z',
    updatedAt: '2026-08-27T00:00:00.000Z',
    generatedAt: '2026-08-27T00:00:00.000Z',
    generationError: null,
    savedMaterialId: null,
    ...overrides,
  };
}

function fullPassingReportSet(): CqvReport[] {
  return CQV_ARTIFACT_IDS.map(artifactId => makeReport({ artifactId }));
}

test('isArtifactComplete', async t => {
  await t.test('no report is not complete', () => {
    assert.equal(isArtifactComplete(undefined), false);
  });

  await t.test('pending verdict is not complete even with scores entered', () => {
    const r = makeReport({ artifactId: 'worksheet', verdict: 'pending' });
    assert.equal(isArtifactComplete(r), false);
  });

  await t.test('pass verdict with every score entered is complete', () => {
    const r = makeReport({ artifactId: 'worksheet', verdict: 'pass' });
    assert.equal(isArtifactComplete(r), true);
  });

  await t.test('pass verdict with a missing score is not complete', () => {
    const r = makeReport({
      artifactId: 'worksheet',
      verdict: 'pass',
      scores: { ...PASSING_SCORES, arabicLanguage: null },
    });
    assert.equal(isArtifactComplete(r), false);
  });
});

test('isLessonValidated', async t => {
  await t.test('fewer than all 8 artifacts is never validated', () => {
    const reports = fullPassingReportSet().slice(0, 7);
    assert.equal(isLessonValidated(reports), false);
  });

  await t.test('all 8 complete, passing, above threshold is validated', () => {
    assert.equal(isLessonValidated(fullPassingReportSet()), true);
  });

  await t.test('a single fail verdict blocks validation even if all 8 are complete', () => {
    const reports = fullPassingReportSet();
    reports[0] = { ...reports[0]!, verdict: 'fail' };
    assert.equal(isLessonValidated(reports), false);
  });

  await t.test('a single score below its threshold blocks validation', () => {
    const reports = fullPassingReportSet();
    reports[0] = {
      ...reports[0]!,
      scores: { ...PASSING_SCORES, teacherTrust: CQV_THRESHOLDS.teacherTrust - 0.1 },
    };
    assert.equal(isLessonValidated(reports), false);
  });
});

test('computeDimensionAverages only counts complete artifacts', () => {
  const complete = makeReport({
    artifactId: 'worksheet',
    scores: { ...PASSING_SCORES, educationalQuality: 8 },
  });
  const incomplete = makeReport({
    artifactId: 'quiz',
    verdict: 'pending',
    scores: { ...PASSING_SCORES, educationalQuality: 2 },
  });

  const averages = computeDimensionAverages([complete, incomplete]);
  assert.equal(averages.educationalQuality, 8);
});

test('getLessonProgress classifies each artifact status correctly', () => {
  const lesson = {
    lessonId: 'lesson-1',
    lessonName: 'Test Lesson',
    lessonNameAr: 'درس تجريبي',
    semester: 1 as const,
    semesterLabel: 'Semester 1',
    semesterLabelAr: 'الفصل الأول',
    unitId: 'unit-1',
    unitName: 'Test Unit',
    unitNameAr: 'وحدة تجريبية',
    unitOrder: 1,
    bookId: 'book-1',
  };

  const reports: CqvReport[] = [
    makeReport({ artifactId: 'lesson-plan' }), // complete
    makeReport({ artifactId: 'worksheet', verdict: 'fail' }), // fail
    makeReport({
      artifactId: 'quiz',
      scores: { ...PASSING_SCORES, curriculumAlignment: CQV_THRESHOLDS.curriculumAlignment - 0.1 },
    }), // below_threshold
    makeReport({ artifactId: 'homework', verdict: 'pending' }), // generated (has generatedAt, not complete)
    // classroom-activity, interactive-lesson, assessment, answer-key: no report at all -> empty
  ];

  const progress = getLessonProgress(lesson, reports);
  const byId = new Map(progress.artifacts.map(a => [a.artifactId, a.status]));

  assert.equal(byId.get('lesson-plan'), 'complete');
  assert.equal(byId.get('worksheet'), 'fail');
  assert.equal(byId.get('quiz'), 'below_threshold');
  assert.equal(byId.get('homework'), 'generated');
  assert.equal(byId.get('classroom-activity'), 'empty');
  // "Complete" means reviewed (verdict set + every score entered), not
  // passing — worksheet (fail) and quiz (below-threshold) both count here,
  // only homework (still pending) does not.
  assert.equal(progress.completedCount, 3);
  assert.equal(progress.validated, false);
});

test('computeLessonsBlockedByMetric counts a lesson once per metric it fails, not per artifact', () => {
  const lesson = {
    lessonId: 'lesson-1',
    lessonName: 'Test Lesson',
    lessonNameAr: 'درس تجريبي',
    semester: 1 as const,
    semesterLabel: 'Semester 1',
    semesterLabelAr: 'الفصل الأول',
    unitId: 'unit-1',
    unitName: 'Test Unit',
    unitNameAr: 'وحدة تجريبية',
    unitOrder: 1,
    bookId: 'book-1',
  };

  const belowOnTeacherTrust = {
    ...PASSING_SCORES,
    teacherTrust: CQV_THRESHOLDS.teacherTrust - 0.1,
  };
  const reports = [
    makeReport({ artifactId: 'worksheet', scores: belowOnTeacherTrust }),
    makeReport({ artifactId: 'quiz', scores: belowOnTeacherTrust }),
  ];

  const byLesson = new Map([[lesson.lessonId, reports]]);
  const blocked = computeLessonsBlockedByMetric([lesson], byLesson);

  assert.equal(blocked.teacherTrust, 1);
  assert.equal(blocked.educationalQuality, 0);
});
