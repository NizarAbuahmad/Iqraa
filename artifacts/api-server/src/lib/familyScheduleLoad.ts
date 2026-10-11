/**
 * The database half of a family's timetable: given the roster rows an account
 * is linked to, fetch the classes they sit in, those classes' slots, and the
 * teachers' period times and names, then hand them to the pure builder.
 *
 * Archived classes are skipped (a class that has ended is not "this week").
 * Slots with no class are never selected — `inArray` on `class_group_id` only
 * matches the ids asked for.
 */
import { db, classGroups, classMemberships, schedulePeriods, scheduleSlots, users } from "@workspace/db";
import { and, inArray, isNull, eq } from "drizzle-orm";
import { buildFamilySchedule, type FamilySchedule } from "../modules/schedule/familySchedule.ts";

const EMPTY: FamilySchedule = { days: [] };

export async function loadFamilySchedule(studentIds: string[]): Promise<FamilySchedule> {
  if (studentIds.length === 0) return EMPTY;

  const memberships = await db
    .select({
      id: classGroups.id,
      subjectId: classGroups.subjectId,
      subjectIds: classGroups.subjectIds,
    })
    .from(classMemberships)
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(inArray(classMemberships.studentId, studentIds), isNull(classGroups.archivedAt)));
  const classes = [...new Map(memberships.map(c => [c.id, c])).values()];
  if (classes.length === 0) return EMPTY;

  const slotRows = await db
    .select({
      teacherId: scheduleSlots.teacherId,
      schoolName: scheduleSlots.schoolName,
      dayOfWeek: scheduleSlots.dayOfWeek,
      periodNumber: scheduleSlots.periodNumber,
      classGroupId: scheduleSlots.classGroupId,
      subjectId: scheduleSlots.subjectId,
      notes: scheduleSlots.notes,
    })
    .from(scheduleSlots)
    .where(
      inArray(
        scheduleSlots.classGroupId,
        classes.map(c => c.id),
      ),
    );
  const slots = slotRows.flatMap(s => (s.classGroupId ? [{ ...s, classGroupId: s.classGroupId }] : []));
  if (slots.length === 0) return EMPTY;

  const teacherIds = [...new Set(slots.map(s => s.teacherId))];
  const [periods, teachers] = await Promise.all([
    db
      .select({
        teacherId: schedulePeriods.teacherId,
        schoolName: schedulePeriods.schoolName,
        periodNumber: schedulePeriods.periodNumber,
        startTime: schedulePeriods.startTime,
        durationMinutes: schedulePeriods.durationMinutes,
      })
      .from(schedulePeriods)
      .where(inArray(schedulePeriods.teacherId, teacherIds)),
    db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(inArray(users.id, teacherIds)),
  ]);

  return buildFamilySchedule({ slots, periods, classes, teachers });
}
