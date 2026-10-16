/**
 * Builds the homework list a family sees, from rows the caller has already
 * fetched. Pure: every rule that decides what a parent is shown lives here, so
 * it is tested without a database, and does not depend on the caller's query
 * having filtered correctly.
 */
import { dueAtToDueDate, homeworkState, type HomeworkState } from "./rules.ts";

export interface HomeworkRow { id: string; classGroupId: string; title: string; instructions: string; dueAt: Date; evaluationId: string | null }
/** One roster row of the family sitting in one live class. */
export interface MembershipRow { classGroupId: string; studentId: string; className: string; teacherId: string }
export interface CompletionRow { homeworkId: string; studentId: string; doneAt: Date }
export interface TeacherRow { id: string; firstName: string; lastName: string }
export interface ExamRow {
  id: string; title: string; titleAr: string; status: string;
  /** Re-checked here: an exam archived or moved after it was linked must stop showing. */
  archivedAt: Date | null; classGroupId: string | null;
}

export interface FamilyHomeworkItem {
  id: string; title: string; instructions: string;
  /** YYYY-MM-DD, Asia/Amman. */
  dueDate: string; dueAt: string;
  className: string; teacherName: string;
  done: boolean; doneAt: string | null; state: HomeworkState;
  /** Only when the attached exam is published, not archived and in the homework's own class; null otherwise. */
  exam: { title: string } | null;
  /**
   * Whether anyone can tick THIS item off: some roster row of the child that is a
   * member of this item's class has a student account (a `self` link). Per item
   * because ticking is per class — a child with an account row in class 1 and a
   * bare row in class 2 can tick class-1 work and never class-2 work, so a client
   * must not show class-2 work as "late" for want of a tick nobody can make.
   */
  canTrack: boolean;
}

export function buildFamilyHomework(input: {
  homework: HomeworkRow[]; memberships: MembershipRow[]; completions: CompletionRow[];
  teachers: TeacherRow[]; exams: ExamRow[]; now: Date;
  /** Roster-row ids that have a student account (a `self` link to any user). */
  withAccount: ReadonlySet<string>;
}): FamilyHomeworkItem[] {
  const teachers = new Map(input.teachers.map((t) => [t.id, t]));
  const exams = new Map(input.exams.map((e) => [e.id, e]));

  // class -> the family's roster rows in it (a child may hold several rows per class).
  const byClass = new Map<string, MembershipRow[]>();
  for (const m of input.memberships) {
    const list = byClass.get(m.classGroupId);
    if (list) list.push(m);
    else byClass.set(m.classGroupId, [m]);
  }

  const items: FamilyHomeworkItem[] = [];
  for (const h of input.homework) {
    const rows = byClass.get(h.classGroupId);
    if (!rows || rows.length === 0) continue;
    const rosterIds = new Set(rows.map((r) => r.studentId));

    let earliest: Date | null = null;
    for (const c of input.completions) {
      if (c.homeworkId !== h.id || !rosterIds.has(c.studentId)) continue;
      if (!earliest || c.doneAt.getTime() < earliest.getTime()) earliest = c.doneAt;
    }
    const done = earliest !== null;

    const teacher = teachers.get(rows[0]!.teacherId);
    const exam = h.evaluationId ? exams.get(h.evaluationId) : undefined;

    items.push({
      id: h.id,
      title: h.title,
      instructions: h.instructions,
      dueDate: dueAtToDueDate(h.dueAt),
      dueAt: h.dueAt.toISOString(),
      className: rows[0]!.className,
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : "",
      done,
      doneAt: earliest ? earliest.toISOString() : null,
      state: homeworkState({ dueAt: h.dueAt, done, now: input.now }),
      canTrack: rows.some((r) => input.withAccount.has(r.studentId)),
      exam:
        exam && exam.status === "published" && exam.archivedAt == null && exam.classGroupId === h.classGroupId
          ? { title: exam.titleAr || exam.title }
          : null,
    });
  }

  // Not-done first, then soonest due, then title; done items sink, soonest first.
  const dueAtMs = new Map(input.homework.map((h) => [h.id, h.dueAt.getTime()]));
  return items.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1;
    const byDue = dueAtMs.get(a.id)! - dueAtMs.get(b.id)!;
    if (byDue !== 0) return byDue;
    return a.title.localeCompare(b.title, "ar");
  });
}
