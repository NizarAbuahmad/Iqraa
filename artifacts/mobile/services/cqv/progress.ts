import { CQV_ARTIFACTS, getArtifactDef } from './artifacts';
import { getCqvLesson, getCqvLessons, groupCqvLessonsBySemester } from './catalog';
import {
  CQV_THRESHOLDS,
  SCORE_DIMENSION_KEYS,
  SCORE_DIMENSION_LABELS,
  dimensionsBelowThreshold,
  getAllThresholds,
  getThreshold,
  type ScoreDimensionKey,
} from './thresholds';
import { CQV_ARTIFACT_IDS, type CqvArtifactId, type CqvLessonRef, type CqvReport, type CqvScores } from './types';

export type ArtifactProgressStatus = 'empty' | 'generated' | 'complete' | 'below_threshold' | 'fail';

export type ArtifactProgress = {
  artifactId: CqvArtifactId;
  label: string;
  labelAr: string;
  status: ArtifactProgressStatus;
  complete: boolean;
  generated: boolean;
  averageScore: number | null;
  belowThresholdKeys: ScoreDimensionKey[];
};

export type LessonProgress = {
  lesson: CqvLessonRef;
  artifacts: ArtifactProgress[];
  completedCount: number;
  generatedCount: number;
  totalArtifacts: number;
  validated: boolean;
  attentionReasons: string[];
  averages: DimensionAverages;
};

export type DimensionAverages = Record<ScoreDimensionKey, number | null> & {
  overall: number | null;
};

export type SemesterProgress = {
  semester: 1 | 2;
  label: string;
  lessonsTotal: number;
  lessonsValidated: number;
  artifactsCompleted: number;
  artifactsTotal: number;
  overallCompletionPct: number;
  averages: DimensionAverages;
};

export type CurriculumProgress = {
  semester1: SemesterProgress;
  semester2: SemesterProgress;
  lessonsTotal: number;
  lessonsValidated: number;
  artifactsCompleted: number;
  artifactsTotal: number;
  overallCompletionPct: number;
  averages: DimensionAverages;
  /** Count of score cells below their configured threshold. */
  belowThresholdCount: number;
  /** Lessons blocked by each metric (any reviewed artifact below that metric's target). */
  lessonsBlockedByMetric: Record<ScoreDimensionKey, number>;
  thresholds: Record<ScoreDimensionKey, number>;
};

export type ImprovementItem = {
  priority: number;
  lessonId: string;
  lessonNameAr: string;
  lessonName: string;
  semester: 1 | 2;
  reason: string;
  category: 'attention' | 'trust' | 'alignment' | 'quality';
  score: number | null;
  validated: boolean;
  completedCount: number;
  threshold?: number;
};

function reportsByLesson(reports: CqvReport[]): Map<string, CqvReport[]> {
  const map = new Map<string, CqvReport[]>();
  for (const r of reports) {
    const list = map.get(r.lessonId) ?? [];
    list.push(r);
    map.set(r.lessonId, list);
  }
  return map;
}

export function allScoresEntered(scores: CqvScores): boolean {
  return SCORE_DIMENSION_KEYS.every(k => typeof scores[k] === 'number');
}

/** @deprecated Prefer dimensionsBelowThreshold from thresholds.ts — kept for call-site clarity. */
export function belowThresholdKeys(scores: CqvScores): ScoreDimensionKey[] {
  return dimensionsBelowThreshold(scores);
}

/** Artifact is "complete / reviewed" when verdict set and all scores entered. */
export function isArtifactComplete(report: CqvReport | undefined): boolean {
  if (!report) return false;
  if (report.verdict === 'pending') return false;
  return allScoresEntered(report.scores);
}

export function isArtifactGenerated(report: CqvReport | undefined): boolean {
  return Boolean(report?.generatedAt);
}

/**
 * Lesson is Validated only when:
 * - all 8 artifacts reviewed
 * - every required score entered
 * - every score meets or exceeds its configured threshold
 * - no fail verdicts
 */
export function isLessonValidated(reports: CqvReport[]): boolean {
  if (reports.length < CQV_ARTIFACT_IDS.length) return false;
  for (const id of CQV_ARTIFACT_IDS) {
    const r = reports.find(x => x.artifactId === id);
    if (!isArtifactComplete(r)) return false;
    if (r!.verdict === 'fail') return false;
    if (dimensionsBelowThreshold(r!.scores).length > 0) return false;
  }
  return true;
}

export function averageOfScores(scores: CqvScores): number | null {
  const vals = SCORE_DIMENSION_KEYS
    .map(k => scores[k])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

export function emptyDimensionAverages(): DimensionAverages {
  return {
    educationalQuality: null,
    arabicLanguage: null,
    curriculumAlignment: null,
    teacherUsability: null,
    formatting: null,
    teacherTrust: null,
    overall: null,
  };
}

export function computeDimensionAverages(reports: CqvReport[]): DimensionAverages {
  const buckets: Record<ScoreDimensionKey, number[]> = {
    educationalQuality: [],
    arabicLanguage: [],
    curriculumAlignment: [],
    teacherUsability: [],
    formatting: [],
    teacherTrust: [],
  };

  for (const r of reports) {
    if (!isArtifactComplete(r)) continue;
    for (const k of SCORE_DIMENSION_KEYS) {
      const v = r.scores[k];
      if (typeof v === 'number') buckets[k].push(v);
    }
  }

  const avg = (arr: number[]) =>
    arr.length === 0 ? null : arr.reduce((a, b) => a + b, 0) / arr.length;

  const result = emptyDimensionAverages();
  const all: number[] = [];
  for (const k of SCORE_DIMENSION_KEYS) {
    result[k] = avg(buckets[k]);
    all.push(...buckets[k]);
  }
  result.overall = avg(all);
  return result;
}

function emptyBlockedByMetric(): Record<ScoreDimensionKey, number> {
  return {
    educationalQuality: 0,
    arabicLanguage: 0,
    curriculumAlignment: 0,
    teacherUsability: 0,
    formatting: 0,
    teacherTrust: 0,
  };
}

/** Lessons with any reviewed artifact score below that metric's configured threshold. */
export function computeLessonsBlockedByMetric(
  lessons: CqvLessonRef[],
  byLesson: Map<string, CqvReport[]>,
): Record<ScoreDimensionKey, number> {
  const blocked = emptyBlockedByMetric();

  for (const lesson of lessons) {
    const reps = (byLesson.get(lesson.lessonId) ?? []).filter(isArtifactComplete);
    if (reps.length === 0) continue;

    for (const key of SCORE_DIMENSION_KEYS) {
      const hits = reps.some(r => {
        const v = r.scores[key];
        return typeof v === 'number' && v < CQV_THRESHOLDS[key];
      });
      if (hits) blocked[key] += 1;
    }
  }

  return blocked;
}

function artifactStatus(report: CqvReport | undefined): ArtifactProgressStatus {
  if (!report || (report.verdict === 'pending' && !report.generatedAt)) return 'empty';
  if (!isArtifactComplete(report)) {
    return report.generatedAt ? 'generated' : 'empty';
  }
  if (report.verdict === 'fail') return 'fail';
  if (dimensionsBelowThreshold(report.scores).length > 0) return 'below_threshold';
  return 'complete';
}

export function getLessonProgress(
  lesson: CqvLessonRef,
  lessonReports: CqvReport[],
): LessonProgress {
  const byId = new Map(lessonReports.map(r => [r.artifactId, r]));
  const artifacts: ArtifactProgress[] = CQV_ARTIFACTS.map(a => {
    const r = byId.get(a.id);
    const below = r ? dimensionsBelowThreshold(r.scores) : [];
    return {
      artifactId: a.id,
      label: a.label,
      labelAr: a.labelAr,
      status: artifactStatus(r),
      complete: isArtifactComplete(r),
      generated: isArtifactGenerated(r),
      averageScore: r ? averageOfScores(r.scores) : null,
      belowThresholdKeys: below,
    };
  });

  const completedCount = artifacts.filter(a => a.complete).length;
  const generatedCount = artifacts.filter(a => a.generated).length;
  const validated = isLessonValidated(lessonReports);
  const attentionReasons: string[] = [];

  if (completedCount < CQV_ARTIFACT_IDS.length) {
    attentionReasons.push(`${CQV_ARTIFACT_IDS.length - completedCount} artifacts incomplete`);
  }
  for (const a of artifacts) {
    if (a.status === 'fail') attentionReasons.push(`${a.label}: fail`);
    if (a.status === 'below_threshold') {
      attentionReasons.push(
        `${a.label}: below threshold (${a.belowThresholdKeys
          .map(k => `${SCORE_DIMENSION_LABELS[k]} < ${CQV_THRESHOLDS[k]}`)
          .join(', ')})`,
      );
    }
  }

  return {
    lesson,
    artifacts,
    completedCount,
    generatedCount,
    totalArtifacts: CQV_ARTIFACT_IDS.length,
    validated,
    attentionReasons,
    averages: computeDimensionAverages(lessonReports),
  };
}

function buildSemesterProgress(
  semester: 1 | 2,
  lessons: CqvLessonRef[],
  byLesson: Map<string, CqvReport[]>,
): SemesterProgress {
  let lessonsValidated = 0;
  let artifactsCompleted = 0;
  const scoredReports: CqvReport[] = [];

  for (const lesson of lessons) {
    const reps = byLesson.get(lesson.lessonId) ?? [];
    const lp = getLessonProgress(lesson, reps);
    if (lp.validated) lessonsValidated += 1;
    artifactsCompleted += lp.completedCount;
    scoredReports.push(...reps.filter(isArtifactComplete));
  }

  const artifactsTotal = lessons.length * CQV_ARTIFACT_IDS.length;
  const overallCompletionPct =
    artifactsTotal === 0 ? 0 : Math.round((artifactsCompleted / artifactsTotal) * 100);

  return {
    semester,
    label: semester === 1 ? 'Semester 1' : 'Semester 2',
    lessonsTotal: lessons.length,
    lessonsValidated,
    artifactsCompleted,
    artifactsTotal,
    overallCompletionPct,
    averages: computeDimensionAverages(scoredReports),
  };
}

export function getCurriculumProgress(reports: CqvReport[]): CurriculumProgress {
  const lessons = getCqvLessons();
  const groups = groupCqvLessonsBySemester(lessons);
  const byLesson = reportsByLesson(reports);

  const semester1 = buildSemesterProgress(1, groups.semester1, byLesson);
  const semester2 = buildSemesterProgress(2, groups.semester2, byLesson);

  const lessonsTotal = lessons.length;
  const lessonsValidated = semester1.lessonsValidated + semester2.lessonsValidated;
  const artifactsCompleted = semester1.artifactsCompleted + semester2.artifactsCompleted;
  const artifactsTotal = semester1.artifactsTotal + semester2.artifactsTotal;
  const overallCompletionPct =
    artifactsTotal === 0 ? 0 : Math.round((artifactsCompleted / artifactsTotal) * 100);

  const completeReports = reports.filter(isArtifactComplete);
  let belowThresholdCount = 0;
  for (const r of completeReports) {
    belowThresholdCount += dimensionsBelowThreshold(r.scores).length;
  }

  return {
    semester1,
    semester2,
    lessonsTotal,
    lessonsValidated,
    artifactsCompleted,
    artifactsTotal,
    overallCompletionPct,
    averages: computeDimensionAverages(completeReports),
    belowThresholdCount,
    lessonsBlockedByMetric: computeLessonsBlockedByMetric(lessons, byLesson),
    thresholds: getAllThresholds(),
  };
}

function lessonDimAverage(
  reports: CqvReport[],
  key: ScoreDimensionKey,
): number | null {
  const vals = reports
    .filter(isArtifactComplete)
    .map(r => r.scores[key])
    .filter((v): v is number => typeof v === 'number');
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Priority-sorted improvement queue for TAT focus. */
export function getImprovementQueue(reports: CqvReport[], limit = 25): ImprovementItem[] {
  const lessons = getCqvLessons();
  const byLesson = reportsByLesson(reports);
  const items: ImprovementItem[] = [];

  for (const lesson of lessons) {
    const reps = byLesson.get(lesson.lessonId) ?? [];
    const lp = getLessonProgress(lesson, reps);
    if (lp.validated) continue;

    const trust = lessonDimAverage(reps, 'teacherTrust');
    const alignment = lessonDimAverage(reps, 'curriculumAlignment');
    const quality = lessonDimAverage(reps, 'educationalQuality');

    if (lp.attentionReasons.length > 0 && lp.completedCount > 0) {
      const worst = Math.min(
        trust ?? 10,
        alignment ?? 10,
        quality ?? 10,
      );
      items.push({
        priority: 100 - worst + (lp.attentionReasons.some(r => r.includes('fail')) ? 20 : 0),
        lessonId: lesson.lessonId,
        lessonNameAr: lesson.lessonNameAr,
        lessonName: lesson.lessonName,
        semester: lesson.semester,
        reason: lp.attentionReasons[0]!,
        category: 'attention',
        score: Number.isFinite(worst) ? worst : null,
        validated: false,
        completedCount: lp.completedCount,
      });
    }

    const pushLow = (
      score: number | null,
      category: ImprovementItem['category'],
      label: string,
      key: ScoreDimensionKey,
    ) => {
      if (score == null) return;
      const threshold = CQV_THRESHOLDS[key];
      if (score >= threshold) return;
      items.push({
        priority: 80 - score,
        lessonId: lesson.lessonId,
        lessonNameAr: lesson.lessonNameAr,
        lessonName: lesson.lessonName,
        semester: lesson.semester,
        reason: `${label}: ${score.toFixed(1)}/10 (need ≥ ${threshold})`,
        category,
        score,
        threshold,
        validated: false,
        completedCount: lp.completedCount,
      });
    };

    pushLow(trust, 'trust', 'Lowest Teacher Trust', 'teacherTrust');
    pushLow(alignment, 'alignment', 'Lowest Curriculum Alignment', 'curriculumAlignment');
    pushLow(quality, 'quality', 'Lowest Educational Quality', 'educationalQuality');

    if (lp.completedCount === 0) {
      items.push({
        priority: 10,
        lessonId: lesson.lessonId,
        lessonNameAr: lesson.lessonNameAr,
        lessonName: lesson.lessonName,
        semester: lesson.semester,
        reason: 'Not started',
        category: 'attention',
        score: null,
        validated: false,
        completedCount: 0,
      });
    }
  }

  // Dedupe by lessonId+category, keep highest priority
  const best = new Map<string, ImprovementItem>();
  for (const item of items) {
    const key = `${item.lessonId}::${item.category}`;
    const prev = best.get(key);
    if (!prev || item.priority > prev.priority) best.set(key, item);
  }

  return [...best.values()]
    .sort((a, b) => b.priority - a.priority || (a.score ?? 99) - (b.score ?? 99))
    .slice(0, limit);
}

export function curriculumProgressMarkdown(
  progress: CurriculumProgress,
  queue: ImprovementItem[],
): string {
  const fmt = (n: number | null) => (n == null ? '—' : n.toFixed(1));
  const dimLine = (label: string, key: ScoreDimensionKey) => {
    const v = progress.averages[key];
    const t = progress.thresholds[key];
    const blocked = progress.lessonsBlockedByMetric[key];
    const flag = v != null && v < t ? ' ⚠ BELOW THRESHOLD' : '';
    return `- **${label}:** ${fmt(v)}/10 (need ≥ ${t}) · ${blocked} lesson(s) blocked${flag}`;
  };

  const thresholdList = SCORE_DIMENSION_KEYS
    .map(k => `- **${SCORE_DIMENSION_LABELS[k]}:** ≥ ${progress.thresholds[k]}`)
    .join('\n');

  const semBlock = (s: SemesterProgress) => `### ${s.label}

- Lessons validated: **${s.lessonsValidated} / ${s.lessonsTotal}**
- Artifacts completed: **${s.artifactsCompleted} / ${s.artifactsTotal}**
- Overall completion: **${s.overallCompletionPct}%**
`;

  const queueLines = queue.length === 0
    ? '_No lessons requiring attention._'
    : queue
      .map(
        (q, i) =>
          `${i + 1}. **S${q.semester}** · ${q.lessonNameAr} (\`${q.lessonId}\`) — ${q.reason}`,
      )
      .join('\n');

  return `# CQV Progress Report — Grade 10 Mathematics

_Generated: ${new Date().toISOString()}_
_Configurable thresholds · Internal TAT only_

## Configured thresholds

${thresholdList}

## Curriculum progress

${semBlock(progress.semester1)}
${semBlock(progress.semester2)}

### Overall
- Lessons validated: **${progress.lessonsValidated} / ${progress.lessonsTotal}**
- Artifacts completed: **${progress.artifactsCompleted} / ${progress.artifactsTotal}**
- Overall completion: **${progress.overallCompletionPct}%**
- Score cells below threshold: **${progress.belowThresholdCount}**

## Quality dashboard (averages of completed artifacts)

${dimLine('Educational Quality', 'educationalQuality')}
${dimLine('Arabic Language', 'arabicLanguage')}
${dimLine('Curriculum Alignment', 'curriculumAlignment')}
${dimLine('Teacher Usability', 'teacherUsability')}
${dimLine('Formatting', 'formatting')}
${dimLine('Teacher Trust', 'teacherTrust')}
- **Overall average:** ${fmt(progress.averages.overall)}/10

## Improvement queue (priority)

${queueLines}

---
_IQRA CQV · not part of Investor MVP UI_
`;
}

export function lessonProgressChecklistMarkdown(lp: LessonProgress): string {
  const lines = lp.artifacts.map(a => {
    const mark = a.complete ? '✓' : '○';
    const extra = a.generated && !a.complete ? ' _(generated)_' : '';
    return `${mark} ${a.label}${extra}`;
  });
  return `# Progress — ${lp.lesson.lessonNameAr}

${lines.join('\n')}

Overall: **${lp.completedCount} / ${lp.totalArtifacts} Complete**
Validated: **${lp.validated ? 'YES' : 'NO'}**
`;
}

export { getThreshold, getAllThresholds, SCORE_DIMENSION_LABELS, getArtifactDef, getCqvLesson };
