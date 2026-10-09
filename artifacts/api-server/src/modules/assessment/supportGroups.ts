/**
 * Support groups (مجموعات الدعم): for each objective, the class members under
 * the 60% line, and how each did on the group's latest re-check.
 *
 * "Under the line" is the student record's rule exactly — `aggregateClass`
 * over one student's marked papers in this class, marks-weighted — so a name
 * on a card opens a record that agrees with it. A re-check outcome is read
 * off that check alone: a three-question check barely moves a cumulative
 * percentage, and "did they get it this time" is the teacher's question.
 *
 * Pure: the route fetches plain rows.
 */
import type { AttemptStatus } from "@workspace/db";
import { aggregateClass, STUDENT_GAP_PERCENT } from "./classInsights.ts";
import type { ObjectiveScore } from "./scoring.ts";
import type { ObjectiveInfo } from "./studentRecord.ts";

export type CheckOutcome = "passed" | "still_weak" | "not_yet";

export interface SupportGroupsInput {
  /** Live, non-archived members of the class. */
  members: { studentId: string; displayName: string }[];
  /** Every attempt result on a non-draft evaluation of this class (group checks included). */
  papers: { studentId: string; objectiveScores: unknown[] | null }[];
  /** Evaluations of this class with student-level assignments. */
  checks: {
    evaluationId: string; title: string; status: "draft" | "published" | "closed";
    archived: boolean; createdAt: Date; objectiveIds: string[]; assignedStudentIds: string[];
  }[];
  /** Attempts on those checks. */
  checkAttempts: {
    evaluationId: string; studentId: string; attemptStatus: AttemptStatus;
    percent: string | number | null; objectiveScores: unknown[] | null;
  }[];
}

export interface SupportGroup {
  objectiveId: string;
  titleAr: string;
  lessonId: string | null;
  lessonTitleAr: string;
  classPercent: number;
  members: { studentId: string; displayName: string; percent: number }[];
  latestCheck: null | {
    evaluationId: string;
    title: string;
    status: "published" | "closed";
    createdAt: string;
    outcomes: { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null }[];
  };
  draftCheck: null | { evaluationId: string };
}

const MARKED: ReadonlySet<AttemptStatus> = new Set<AttemptStatus>(["graded", "needs_review"]);
const round2 = (n: number) => Math.round(n * 100) / 100;
const scoresOf = (v: unknown[] | null): ObjectiveScore[] => (v as ObjectiveScore[] | null) ?? [];

export function supportGroups(
  input: SupportGroupsInput,
  describe: (objectiveId: string) => ObjectiveInfo | null,
): SupportGroup[] {
  const names = new Map(input.members.map(m => [m.studentId, m.displayName]));

  // Per student, the same rollup the record uses.
  const papersByStudent = new Map<string, { objectiveScores: ObjectiveScore[] }[]>();
  for (const p of input.papers) {
    if (!names.has(p.studentId)) continue;
    const scores = scoresOf(p.objectiveScores);
    if (scores.length === 0) continue;
    const list = papersByStudent.get(p.studentId) ?? [];
    list.push({ objectiveScores: scores });
    papersByStudent.set(p.studentId, list);
  }

  const weakByObjective = new Map<string, { studentId: string; displayName: string; percent: number }[]>();
  const allMarked: { objectiveScores: ObjectiveScore[] }[] = [];
  for (const [studentId, papers] of papersByStudent) {
    allMarked.push(...papers);
    for (const s of aggregateClass(papers).objectiveScores) {
      if (s.percent >= STUDENT_GAP_PERCENT) continue;
      const list = weakByObjective.get(s.objectiveId) ?? [];
      list.push({ studentId, displayName: names.get(studentId)!, percent: s.percent });
      weakByObjective.set(s.objectiveId, list);
    }
  }
  const classPercent = new Map(aggregateClass(allMarked).objectiveScores.map(s => [s.objectiveId, s.percent]));

  const groups: SupportGroup[] = [];
  for (const [objectiveId, weak] of weakByObjective) {
    const forObjective = input.checks
      .filter(c => !c.archived && c.objectiveIds.length === 1 && c.objectiveIds[0] === objectiveId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || a.evaluationId.localeCompare(b.evaluationId));
    const latest = forObjective.find(c => c.status !== "draft") ?? null;
    const draft = forObjective.find(c => c.status === "draft") ?? null;
    const info = describe(objectiveId);
    groups.push({
      objectiveId,
      titleAr: info?.titleAr ?? objectiveId,
      lessonId: info?.lessonId ?? null,
      lessonTitleAr: info?.lessonTitleAr ?? "",
      classPercent: classPercent.get(objectiveId) ?? 0,
      members: [...weak].sort((a, b) => a.percent - b.percent || a.studentId.localeCompare(b.studentId)),
      latestCheck: latest
        ? {
            evaluationId: latest.evaluationId,
            title: latest.title,
            status: latest.status as "published" | "closed",
            createdAt: latest.createdAt.toISOString(),
            outcomes: latest.assignedStudentIds
              .filter(id => names.has(id))
              .map(id => outcomeFor(latest.evaluationId, objectiveId, id, names.get(id)!, input.checkAttempts)),
          }
        : null,
      draftCheck: draft ? { evaluationId: draft.evaluationId } : null,
    });
  }

  return groups.sort(
    (a, b) => b.members.length - a.members.length
      || a.classPercent - b.classPercent
      || a.objectiveId.localeCompare(b.objectiveId),
  );
}

function outcomeFor(
  evaluationId: string,
  objectiveId: string,
  studentId: string,
  displayName: string,
  attempts: SupportGroupsInput["checkAttempts"],
): { studentId: string; displayName: string; outcome: CheckOutcome; percent: number | null } {
  const attempt = attempts.find(a => a.evaluationId === evaluationId && a.studentId === studentId);
  if (!attempt || !MARKED.has(attempt.attemptStatus)) {
    return { studentId, displayName, outcome: "not_yet", percent: null };
  }
  const own = scoresOf(attempt.objectiveScores).find(s => s.objectiveId === objectiveId);
  const percent = own && own.total > 0
    ? round2((own.earned / own.total) * 100)
    : attempt.percent === null ? 0 : Number(attempt.percent);
  return { studentId, displayName, outcome: percent >= STUDENT_GAP_PERCENT ? "passed" : "still_weak", percent };
}
