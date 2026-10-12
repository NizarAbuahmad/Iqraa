/**
 * What `GET /exam-calendar` serialises — and, more to the point, what it leaves
 * out. This is the one place a teacher's data reaches another teacher, so the
 * redaction lives here, in a function with a test, rather than inline in a
 * route where nothing could pin it.
 *
 * A colleague's exam is date, time, grade, subject, class name and the
 * colleague's name. Not its id, title or content, and nothing about students.
 *
 * Its own module, no imports beyond ./examClashes.ts, so `node --test` can load it.
 */
import { countsOnCalendar, findClashes, type CalendarExam } from "./examClashes.ts";

export interface CalendarRow extends CalendarExam {
  teacherId: string;
  teacherName: string;
  title: string;
  titleAr: string;
  examTime: string | null;
  subjectId: string;
  className: string;
  classNameAr: string;
}

interface EntryBase {
  examDate: string;
  examTime: string | null;
  gradeId: string;
  subjectId: string;
  className: string;
  classNameAr: string;
  /** Same school, same grade, same day as at least one other exam. */
  clash: boolean;
}

export interface OwnEntry extends EntryBase {
  own: true;
  id: string;
  title: string;
  titleAr: string;
}

export interface ColleagueEntry extends EntryBase {
  own: false;
  teacherName: string;
}

export type CalendarEntry = OwnEntry | ColleagueEntry;

function compare(a: CalendarEntry, b: CalendarEntry): number {
  if (a.examDate !== b.examDate) return a.examDate < b.examDate ? -1 : 1;
  // An exam with no start time sorts after the timed ones that day.
  if (a.examTime !== b.examTime) {
    if (a.examTime === null) return 1;
    if (b.examTime === null) return -1;
    return a.examTime < b.examTime ? -1 : 1;
  }
  if (a.own !== b.own) return a.own ? -1 : 1;
  return 0;
}

export function buildCalendarEntries(rows: CalendarRow[], viewerId: string): CalendarEntry[] {
  const onCalendar = rows.filter(countsOnCalendar);
  const clashing = new Set(findClashes(onCalendar).flatMap(c => c.examIds));

  return onCalendar
    .map((r): CalendarEntry => {
      const base: EntryBase = {
        examDate: r.examDate as string,
        examTime: r.examTime,
        gradeId: r.gradeId,
        subjectId: r.subjectId,
        className: r.className,
        classNameAr: r.classNameAr,
        clash: clashing.has(r.id),
      };
      return r.teacherId === viewerId
        ? { own: true, id: r.id, title: r.title, titleAr: r.titleAr, ...base }
        : { own: false, teacherName: r.teacherName, ...base };
    })
    .sort(compare);
}
