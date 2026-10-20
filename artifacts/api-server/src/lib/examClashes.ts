/**
 * Which exams collide on the school calendar.
 *
 * A clash is: same school, same `gradeId`, same day. That is deliberately not
 * "shared students" — a student row belongs to one teacher, so the system
 * cannot see a child who sits in two teachers' classes. Same grade and same day
 * is the closest honest signal, and the UI says exactly that.
 *
 * Its own module, no imports, so `node --test` can load it (route files cannot).
 */

export interface CalendarExam {
  id: string;
  examDate: string | null;
  gradeId: string;
  status: "draft" | "published" | "closed";
  archivedAt: Date | null;
}

export interface ExamClash {
  examDate: string;
  gradeId: string;
  examIds: string[];
}

/**
 * Whether an exam belongs on the calendar at all. A closed exam has been sat,
 * so it can no longer collide with anything; an archived one has been removed
 * by its teacher. Drafts count once they carry a date — that is the teacher
 * saying "this is when", and a colleague planning around it should see it.
 */
export function countsOnCalendar(exam: CalendarExam): boolean {
  return exam.examDate !== null && exam.status !== "closed" && exam.archivedAt === null;
}

/** Groups of two or more calendar exams for one grade on one day, oldest day first. */
export function findClashes(exams: CalendarExam[]): ExamClash[] {
  const groups = new Map<string, ExamClash>();
  for (const exam of exams) {
    if (!countsOnCalendar(exam)) continue;
    const examDate = exam.examDate as string;
    const key = `${examDate}|${exam.gradeId}`;
    const group = groups.get(key);
    if (group) group.examIds.push(exam.id);
    else groups.set(key, { examDate, gradeId: exam.gradeId, examIds: [exam.id] });
  }
  return [...groups.values()]
    .filter(g => g.examIds.length > 1)
    .sort((a, b) => (a.examDate === b.examDate ? a.gradeId.localeCompare(b.gradeId) : a.examDate.localeCompare(b.examDate)));
}
