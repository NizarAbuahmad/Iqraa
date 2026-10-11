/**
 * The exam calendar's data and the pure reads the calendar screen makes of it.
 * See artifacts/api-server/src/routes/examCalendar.ts for the endpoint and
 * api-server/src/lib/examCalendar.ts for what a colleague's exam is allowed to
 * carry.
 *
 * Exams are deliberately not folded into `DayAgenda` (scheduleCalendar.ts):
 * a period has a clock time and a lesson has a date, and an exam is a third
 * thing with its own source, its own owner and a colleague's name on it.
 *
 * Split from the network client (examCalendar.ts) so the bare `node --test`
 * runner can load it — CLAUDE.md on `services/__tests__`.
 */

interface EntryBase {
  /** "YYYY-MM-DD", the same local-date keys as the month grid. */
  examDate: string;
  /** "HH:MM", null when the exam has a day but no start time. */
  examTime: string | null;
  gradeId: string;
  subjectId: string;
  className: string;
  classNameAr: string;
  /** Another exam for this grade sits on this day in the school. Decided by the server. */
  clash: boolean;
}

export interface OwnExamEntry extends EntryBase {
  own: true;
  id: string;
  title: string;
  titleAr: string;
}

/** Only what the API lets a colleague's exam carry: no id, no title. */
export interface ColleagueExamEntry extends EntryBase {
  own: false;
  teacherName: string;
}

export type ExamCalendarEntry = OwnExamEntry | ColleagueExamEntry;

export interface ExamCalendarResponse {
  /** null: the teacher has not been placed in a school, so only their own exams are here. */
  school: { id: string; name: string } | null;
  exams: ExamCalendarEntry[];
}

/** What shows: the teacher's own exams always, colleagues' only when asked. */
function shown(entries: readonly ExamCalendarEntry[], showColleagues: boolean): ExamCalendarEntry[] {
  return showColleagues ? [...entries] : entries.filter(e => e.own);
}

export function examsOnDate(date: string, entries: readonly ExamCalendarEntry[], showColleagues: boolean): ExamCalendarEntry[] {
  return shown(entries, showColleagues).filter(e => e.examDate === date);
}

/** Days that get an exam dot. */
export function examDates(entries: readonly ExamCalendarEntry[], showColleagues: boolean): Set<string> {
  return new Set(shown(entries, showColleagues).map(e => e.examDate));
}

/**
 * Days that get the clash warning. A shown exam carries the flag, so with
 * colleagues hidden the teacher is still told their own exam collides with one —
 * but a clash made up entirely of hidden exams is not theirs to hear about.
 */
export function clashDates(entries: readonly ExamCalendarEntry[], showColleagues: boolean): Set<string> {
  return new Set(shown(entries, showColleagues).filter(e => e.clash).map(e => e.examDate));
}

/** The `from`/`to` of the month grid's 42 dates (see monthGridDates), both inclusive. */
export function monthFetchRange(gridDates: readonly string[]): { from: string; to: string } {
  return { from: gridDates[0]!, to: gridDates[gridDates.length - 1]! };
}

/**
 * Other exams for `gradeId` on `date`, ignoring the one being edited — the
 * inline warning shown before a teacher saves a date. A warning, not a block:
 * the server's `clash` flag is the authority once saved; this only answers
 * "would saving this put two exams on one day?".
 */
export function conflictingExams(
  date: string,
  gradeId: string,
  entries: readonly ExamCalendarEntry[],
  editingId: string,
): ExamCalendarEntry[] {
  return entries.filter(e => e.examDate === date && e.gradeId === gradeId && !(e.own && e.id === editingId));
}

const ARABIC_INDIC_ZERO = 0x0660;
const EASTERN_ARABIC_INDIC_ZERO = 0x06f0;

/** Arabic-Indic (٠-٩) and Persian (۰-۹) digits to latin — the keyboard decides which a teacher gets. */
function latinDigits(text: string): string {
  return text.replace(/[٠-٩۰-۹]/g, ch => {
    const code = ch.charCodeAt(0);
    return String(code >= EASTERN_ARABIC_INDIC_ZERO ? code - EASTERN_ARABIC_INDIC_ZERO : code - ARABIC_INDIC_ZERO);
  });
}

/**
 * What a teacher typed into the date box, as "YYYY-MM-DD" if it can be. Maths
 * and storage stay latin; only display converts to Arabic digits. Anything
 * unrecognisable passes through for `isValidPlanDate` to refuse.
 */
export function normalizeTypedDate(input: string): string {
  return latinDigits(input).trim().replace(/[/.]/g, '-');
}

/** The same for the time box: "9:30" and "٩:٣٠" both become "09:30". */
export function normalizeTypedTime(input: string): string {
  const text = latinDigits(input).trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  return m ? `${m[1]!.padStart(2, '0')}:${m[2]}` : text;
}
