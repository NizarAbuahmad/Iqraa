/**
 * When a change to an exam's planned day is news to families, and what kind.
 *
 * Families see an exam's date only on an exam they can already see
 * (`studentExamRow` / `examRowsFor`): published or closed, attached to a class
 * — and here also not archived, since a teacher archives an exam to put it
 * away. So a dated draft or an exam with no class announces nothing, ever:
 * a push would leak what the School tab hides.
 *
 * The day is zone-less text (`exam_date` / `exam_time`); this compares strings.
 */
export interface ExamSchedule {
  classGroupId: string | null;
  examDate: string | null;
  examTime: string | null;
}

export interface ExamForNotice extends ExamSchedule {
  status: string;
  archivedAt: Date | null;
}

export type ExamDateNotice =
  | { kind: "set" | "changed"; examDate: string; examTime: string | null }
  | { kind: "cleared"; examDate: null; examTime: null };

export function examVisibleToFamilies(e: { status: string; classGroupId: string | null; archivedAt: Date | null }): boolean {
  return (e.status === "published" || e.status === "closed") && !!e.classGroupId && !e.archivedAt;
}

/**
 * A PATCH's news, if any. A class that newly sees a dated exam (attached, or
 * moved to it) hears the date as `set`; the class it left is not told.
 */
export function examDateNotice(before: ExamForNotice, after: ExamSchedule): ExamDateNotice | null {
  if (!examVisibleToFamilies({ ...before, classGroupId: after.classGroupId })) return null;
  const sameFamilies = examVisibleToFamilies(before) && before.classGroupId === after.classGroupId;
  if (!sameFamilies) return after.examDate ? { kind: "set", examDate: after.examDate, examTime: after.examTime } : null;
  if (before.examDate === after.examDate && before.examTime === after.examTime) return null;
  if (after.examDate === null) return { kind: "cleared", examDate: null, examTime: null };
  if (before.examDate === null) return { kind: "set", examDate: after.examDate, examTime: after.examTime };
  return { kind: "changed", examDate: after.examDate, examTime: after.examTime };
}

/** Publishing a dated draft is the moment its date becomes visible. A re-publish is not news. */
export function publishNotice(before: ExamForNotice): ExamDateNotice | null {
  if (before.status !== "draft" || !before.examDate) return null;
  if (!examVisibleToFamilies({ ...before, status: "published" })) return null;
  return { kind: "set", examDate: before.examDate, examTime: before.examTime };
}
