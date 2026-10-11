/**
 * A student's or parent's weekly timetable, from teachers' own slots.
 *
 * Teachers enter `schedule_slots` for their own classes (see
 * lib/db/src/schema/schedule.ts); a family sees the slots of every class their
 * linked roster rows sit in. Nothing is entered twice, and nothing here claims
 * the grid is complete — it is the union of the teachers who have filled theirs
 * in. An empty result means exactly that, and the client says so.
 *
 * Each period's time comes from its own teacher's `schedule_periods` row
 * (same school): two teachers' "period 1" are unrelated clock times, so times
 * are never merged across teachers.
 *
 * Pure and import-free: `node --test` cannot load the route files, and this is
 * the part worth testing.
 */
export interface SlotRow {
  teacherId: string;
  schoolName: string;
  /** 0 = Sunday .. 6 = Saturday. */
  dayOfWeek: number;
  periodNumber: number;
  classGroupId: string;
  /** '' = the teacher did not say which of the class's subjects this is. */
  subjectId: string;
  notes: string;
}

export interface PeriodRow {
  teacherId: string;
  schoolName: string;
  periodNumber: number;
  /** "HH:MM", 24-hour. */
  startTime: string;
  durationMinutes: number;
}

export interface ClassRow {
  id: string;
  subjectId: string;
  subjectIds: string[];
}

export interface TeacherRow {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ScheduleInput {
  slots: SlotRow[];
  periods: PeriodRow[];
  classes: ClassRow[];
  teachers: TeacherRow[];
}

export interface FamilyPeriod {
  periodNumber: number;
  startTime: string | null;
  durationMinutes: number | null;
  /** '' when it cannot be told without guessing. */
  subjectId: string;
  teacherName: string;
  notes: string;
}

export interface FamilyDay {
  dayOfWeek: number;
  periods: FamilyPeriod[];
}

export interface FamilySchedule {
  days: FamilyDay[];
}

const periodKey = (teacherId: string, schoolName: string, periodNumber: number): string =>
  `${teacherId}\u0000${schoolName}\u0000${periodNumber}`;

/** The slot's own subject, else the class's only subject, else nothing — never a guess. */
function subjectFor(slotSubject: string, cls: ClassRow): string {
  if (slotSubject) return slotSubject;
  const subjects = cls.subjectIds.length > 0 ? cls.subjectIds : cls.subjectId ? [cls.subjectId] : [];
  return subjects.length === 1 ? subjects[0] : "";
}

const clock = (p: FamilyPeriod): string => p.startTime ?? "99:99";

export function buildFamilySchedule(input: ScheduleInput): FamilySchedule {
  const classById = new Map(input.classes.map(c => [c.id, c]));
  const teacherById = new Map(input.teachers.map(t => [t.id, t]));
  const periodByKey = new Map(input.periods.map(p => [periodKey(p.teacherId, p.schoolName, p.periodNumber), p]));

  const byDay = new Map<number, FamilyPeriod[]>();
  for (const s of input.slots) {
    const cls = classById.get(s.classGroupId);
    if (!cls) continue;
    const time = periodByKey.get(periodKey(s.teacherId, s.schoolName, s.periodNumber));
    const teacher = teacherById.get(s.teacherId);
    const entry: FamilyPeriod = {
      periodNumber: s.periodNumber,
      startTime: time?.startTime ?? null,
      durationMinutes: time?.durationMinutes ?? null,
      subjectId: subjectFor(s.subjectId, cls),
      teacherName: teacher ? `${teacher.firstName} ${teacher.lastName}`.trim() : "",
      notes: s.notes,
    };
    const day = byDay.get(s.dayOfWeek);
    if (day) day.push(entry);
    else byDay.set(s.dayOfWeek, [entry]);
  }

  const days = [...byDay.entries()]
    .sort(([a], [b]) => a - b)
    .map(([dayOfWeek, periods]) => ({
      dayOfWeek,
      periods: periods.sort(
        (a, b) =>
          (clock(a) < clock(b) ? -1 : clock(a) > clock(b) ? 1 : 0) ||
          a.periodNumber - b.periodNumber ||
          a.teacherName.localeCompare(b.teacherName),
      ),
    }));
  return { days };
}
