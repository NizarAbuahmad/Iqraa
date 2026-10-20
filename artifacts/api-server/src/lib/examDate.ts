/**
 * Validation for an exam's scheduled date and start time — see
 * lib/db/src/schema/evaluations.ts (`examDate`, `examTime`).
 *
 * Its own module, no imports, for the same reason schedule.ts is: route files
 * use extensionless specifiers only esbuild resolves, so
 * `routes/evaluations.ts` cannot be loaded by `node --test`. This can.
 *
 * Both are plain strings ("YYYY-MM-DD", "HH:MM"), like the schedule and plan
 * tables, so a day compares equal to the calendar's local-date keys. Never
 * round-trip through `toISOString()` — it shifts to UTC near midnight.
 */

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ExamSchedule {
  examDate: string | null;
  examTime: string | null;
}

/** A real calendar day, zero-padded. `2026-02-30` matches the shape but is not one. */
export function isValidExamDate(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  const m = DATE_RE.exec(raw);
  if (!m) return false;
  const [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  // UTC on purpose: only the calendar arithmetic matters here, not a timezone.
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
}

export function isValidExamTime(raw: unknown): raw is string {
  return typeof raw === "string" && TIME_RE.test(raw);
}

/**
 * Today's school day, `YYYY-MM-DD`, in Asia/Amman — a fixed UTC+3 since 2022,
 * the same frame homework due dates use. Judged on the day, not the instant:
 * an exam planned for today is not in the past.
 */
export function ammanToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Merge a PATCH body onto the stored schedule. A field that is absent keeps its
 * stored value; `null` clears it — checked with `!== undefined`, never
 * truthiness, so a clear is not mistaken for "not provided". Clearing the date
 * clears the time, and a time cannot exist without a date. Throws a message
 * string on bad input, like schedule.ts, for the route to turn into a 400.
 *
 * A date before today is refused when it CHANGES the stored one. Re-sending the
 * stored date untouched is fine, so an exam that already holds a past date can
 * still have its time corrected or its date cleared.
 */
export function resolveExamPatch(
  existing: ExamSchedule,
  body: { examDate?: unknown; examTime?: unknown },
  now: Date = new Date(),
): ExamSchedule {
  let examDate = existing.examDate;
  let examTime = existing.examTime;

  if (body.examDate !== undefined) {
    if (body.examDate !== null && !isValidExamDate(body.examDate)) {
      throw "examDate must be a real date in YYYY-MM-DD form, or null";
    }
    if (body.examDate !== null && body.examDate !== existing.examDate && body.examDate < ammanToday(now)) {
      throw "examDate must be today or later";
    }
    examDate = body.examDate;
  }
  if (body.examTime !== undefined) {
    if (body.examTime !== null && !isValidExamTime(body.examTime)) {
      throw "examTime must be HH:MM in 24-hour form, or null";
    }
    examTime = body.examTime;
  }

  if (examDate === null) {
    // Clearing the day takes its time with it; setting only a time is refused.
    if (examTime !== null && body.examTime !== undefined) {
      throw "examTime needs an examDate";
    }
    examTime = null;
  }
  return { examDate, examTime };
}

/** A year and a leap day — enough for any term view, small enough that one call cannot sweep a school's history. */
export const MAX_CALENDAR_DAYS = 366;

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / DAY_MS);
}

/** The `?from=&to=` window of `GET /exam-calendar`, both ends inclusive. Throws a message string, like the rest of this file. */
export function parseCalendarRange(query: { from?: unknown; to?: unknown }): { from: string; to: string } {
  const { from, to } = query;
  if (from === undefined || to === undefined) throw "from and to are required";
  if (!isValidExamDate(from)) throw "from must be a real date in YYYY-MM-DD form";
  if (!isValidExamDate(to)) throw "to must be a real date in YYYY-MM-DD form";
  const span = dayNumber(to) - dayNumber(from);
  if (span < 0) throw "to must not be before from";
  if (span + 1 > MAX_CALENDAR_DAYS) throw `the range may span at most ${MAX_CALENDAR_DAYS} days`;
  return { from, to };
}
