/**
 * One student's record in one class — what the class screen shows for the
 * whole room, for the one child a teacher is about to plan for.
 *
 * Pure on purpose: the route only fetches rows. The rollup is `aggregateClass`
 * unchanged — summing one student across papers is the same operation as
 * summing a class across students (see masteryRollup.test.ts), and it keeps
 * this number comparable with the class view's.
 */
import { aggregateClass } from "./classInsights.ts";
import type { ObjectiveScore } from "./scoring.ts";

export type RecordExamStatus = "not_sat" | "in_progress" | "submitted" | "marked";

export interface RecordExamRow {
  evaluationId: string;
  title: string;
  titleAr: string;
  createdAt: Date;
  attemptId: string | null;
  attemptStatus: string | null;
  teacherComment: string | null;
  submittedAt: Date | null;
  /** Numeric columns arrive as strings («2.00»). */
  earned: string | number | null;
  total: string | number | null;
  percent: string | number | null;
  isProvisional: boolean | null;
  objectiveScores: unknown[] | null;
}

export interface ObjectiveInfo {
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
}

export interface RecordExam {
  evaluationId: string;
  title: string;
  createdAt: string;
  status: RecordExamStatus;
  attemptId: string | null;
  earned: number | null;
  total: number | null;
  percent: number | null;
  provisional: boolean;
  teacherComment: string | null;
  submittedAt: string | null;
}

export interface RecordObjective {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  earned: number;
  total: number;
  percent: number;
  marksLost: number;
  sittings: number;
  lastSeenAt: string;
}

export function examStatus(attemptStatus: string | null): RecordExamStatus {
  switch (attemptStatus) {
    case null:
    case "not_started":
      return "not_sat";
    case "in_progress":
      return "in_progress";
    case "graded":
      return "marked";
    default:
      // submitted, grading, needs_review: the paper is in, the marks are not.
      return "submitted";
  }
}

const num = (v: string | number | null): number | null => (v === null ? null : Number(v));

export function studentRecord(
  rows: readonly RecordExamRow[],
  describe: (objectiveId: string) => ObjectiveInfo | null,
): { exams: RecordExam[]; objectives: RecordObjective[]; provisionalCount: number } {
  const exams = [...rows]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((r): RecordExam => {
      const status = r.attemptId ? examStatus(r.attemptStatus) : "not_sat";
      const hasResult = r.total !== null;
      return {
        evaluationId: r.evaluationId,
        title: r.titleAr || r.title,
        createdAt: r.createdAt.toISOString(),
        status,
        // The paper screen creates an attempt on open; never hand it one to open.
        attemptId: status === "not_sat" ? null : r.attemptId,
        earned: hasResult ? num(r.earned) : null,
        total: hasResult ? num(r.total) : null,
        percent: hasResult ? num(r.percent) : null,
        provisional: Boolean(r.isProvisional),
        teacherComment: r.teacherComment ? r.teacherComment : null,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
      };
    });

  // Same rule as the class view: a paper nobody marked carries an empty
  // breakdown, and letting it in would drag the rollup toward zero.
  const marked = rows
    .map(r => ({ r, scores: ((r.objectiveScores as ObjectiveScore[] | null) ?? []) }))
    .filter(m => m.scores.length > 0);

  const rollup = aggregateClass(marked.map(m => ({ objectiveScores: m.scores })));

  const seen = new Map<string, { sittings: number; last: Date }>();
  for (const m of marked) {
    const when = m.r.submittedAt ?? m.r.createdAt;
    for (const s of m.scores) {
      const entry = seen.get(s.objectiveId) ?? { sittings: 0, last: when };
      entry.sittings += 1;
      if (when > entry.last) entry.last = when;
      seen.set(s.objectiveId, entry);
    }
  }

  const objectives = rollup.objectiveScores
    .map((s): RecordObjective => {
      const info = describe(s.objectiveId);
      const evidence = seen.get(s.objectiveId)!;
      return {
        objectiveId: s.objectiveId,
        titleAr: info?.titleAr ?? "",
        lessonId: info?.lessonId ?? null,
        lessonTitleAr: info?.lessonTitleAr ?? "",
        earned: s.earned,
        total: s.total,
        percent: s.percent,
        marksLost: s.marksLost,
        sittings: evidence.sittings,
        lastSeenAt: evidence.last.toISOString(),
      };
    })
    .sort((a, b) => a.percent - b.percent || b.marksLost - a.marksLost);

  return {
    exams,
    objectives,
    provisionalCount: marked.filter(m => m.r.isProvisional).length,
  };
}
