/**
 * A teacher's weekly period timetable — which class meets on which day at
 * which period, and what time each period actually is. See
 * artifacts/api-server/src/routes/schedule.ts.
 *
 * Distinct from teachingPlans.ts: a plan is *what curriculum lesson* is
 * covered on a date, for one class; this is *which class* a teacher is in
 * front of at a recurring day+period, every week. Same shape as roster.ts and
 * teachingPlans.ts otherwise — no local fallback, server state with no
 * offline meaning.
 */
import { apiFetch } from './apiClient.ts';
import { nextPeriodLesson, timetableSetupStep, type NextPeriodLesson, type TimetableSetupStep } from './scheduleCalendar.ts';
import { listTeachingPlans } from './teachingPlans.ts';
import { listClasses } from './roster.ts';

export interface SchedulePeriod {
  id: string;
  /** "" is the unnamed default school; each school has its own bell times. */
  schoolName: string;
  periodNumber: number;
  /** "HH:MM", 24-hour. */
  startTime: string;
  durationMinutes: number;
}

export interface ScheduleSlot {
  id: string;
  schoolName: string;
  /** 0 = Sunday .. 6 = Saturday — matches Date#getDay() and planEntries.ts. */
  dayOfWeek: number;
  periodNumber: number;
  /** Empty slot (free period, lunch, admin time) when null. */
  classGroupId: string | null;
  /** Which of the class's subjects this period is; '' (or absent, from an older server) = not said. */
  subjectId?: string;
  notes: string;
}

export class ScheduleError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'ScheduleError';
    this.status = status;
    this.code = code;
  }

  get isStorageUnavailable(): boolean {
    return this.code === 'schedule_storage_unavailable';
  }

  get isSchoolNameTaken(): boolean {
    return this.code === 'school_name_taken';
  }
}

async function readJson<T>(res: Response, action: string): Promise<T> {
  if (!res.ok) {
    let detail = '';
    let code = '';
    try {
      const body = (await res.json()) as { error?: string; code?: string };
      detail = body.error ?? '';
      code = body.code ?? '';
    } catch {
      /* body wasn't JSON — the status is all we have */
    }
    throw new ScheduleError(detail || `${action} failed (${res.status})`, res.status, code);
  }
  return (await res.json()) as T;
}

/** An API deployed before schools existed omits the field; that is the default school. */
function withSchool<T extends { schoolName?: string }>(row: T): T & { schoolName: string } {
  return { ...row, schoolName: row.schoolName ?? '' };
}

export async function getSchedule(): Promise<{ periods: SchedulePeriod[]; slots: ScheduleSlot[] }> {
  const res = await apiFetch('/schedule');
  const data = await readJson<{ periods: SchedulePeriod[]; slots: ScheduleSlot[] }>(res, 'Loading schedule');
  return { periods: data.periods.map(withSchool), slots: data.slots.map(withSchool) };
}

/**
 * The period now or next and its pacing-plan lesson (`nextPeriodLesson`), or
 * null. Never throws: a server without the schedule or plan tables, or a
 * teacher with neither, means "no timetable", and every caller then keeps the
 * lesson it would have shown anyway.
 */
export async function loadNextPeriod(now: Date = new Date()): Promise<NextPeriodLesson | null> {
  return (await loadTimetable(now))?.next ?? null;
}

/**
 * `loadNextPeriod` plus what is still missing for it to work
 * (`timetableSetupStep`) — the home card's setup nudge. Null on any failure:
 * a nudge to set up a timetable the server cannot store would be a lie.
 */
export async function loadTimetable(
  now: Date = new Date(),
): Promise<{ next: NextPeriodLesson | null; setup: TimetableSetupStep | null } | null> {
  try {
    // Classes resolve a plan with no subject of its own to its class's
    // primary one. Best-effort: without them such a plan still matches.
    const [schedule, plans, classes] = await Promise.all([
      getSchedule(),
      listTeachingPlans(),
      listClasses().catch(() => []),
    ]);
    const next = nextPeriodLesson(now, schedule.periods, schedule.slots, plans, classes);
    return { next, setup: timetableSetupStep(schedule.slots, next) };
  } catch {
    return null;
  }
}

export async function setSchedulePeriod(
  schoolName: string,
  periodNumber: number,
  input: { startTime: string; durationMinutes?: number },
): Promise<SchedulePeriod> {
  const res = await apiFetch(`/schedule/periods/${periodNumber}`, {
    method: 'PUT',
    body: JSON.stringify({ ...input, schoolName }),
  });
  const data = await readJson<{ period: SchedulePeriod }>(res, 'Saving period');
  return withSchool(data.period);
}

export async function deleteSchedulePeriod(schoolName: string, periodNumber: number): Promise<void> {
  const res = await apiFetch(
    `/schedule/periods/${periodNumber}?school=${encodeURIComponent(schoolName)}`,
    { method: 'DELETE' },
  );
  await readJson(res, 'Deleting period');
}

export async function setScheduleSlot(
  schoolName: string,
  dayOfWeek: number,
  periodNumber: number,
  input: { classGroupId?: string | null; subjectId?: string; notes?: string },
): Promise<ScheduleSlot> {
  const res = await apiFetch(`/schedule/slots/${dayOfWeek}/${periodNumber}`, {
    method: 'PUT',
    body: JSON.stringify({ ...input, schoolName }),
  });
  const data = await readJson<{ slot: ScheduleSlot }>(res, 'Saving schedule slot');
  return withSchool(data.slot);
}

export async function renameScheduleSchool(from: string, to: string): Promise<string> {
  const res = await apiFetch('/schedule/schools', {
    method: 'PUT',
    body: JSON.stringify({ from, to }),
  });
  const data = await readJson<{ schoolName: string }>(res, 'Renaming school');
  return data.schoolName;
}
