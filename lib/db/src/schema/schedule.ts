/**
 * A teacher's own weekly period timetable — "الجدول الأسبوعي": which class
 * meets when, and what time each period actually is.
 *
 * Distinct from `teachingPlans`: a plan is *what curriculum lesson* is
 * covered on a given date, for one class. This is *which class* a teacher is
 * in front of at a given day-of-week and period, every week, regardless of
 * which lesson that class happens to be on. A teacher sets this up once (or
 * edits it when the school's bell schedule changes) and it repeats; a plan's
 * own per-lesson dates are set per term.
 *
 * Two tables, not one, because a period's time is asked once and answered by
 * every day it recurs on — `schedulePeriods` is "الحصة 3 تبدأ الساعة 9:30"
 * (one row per period number), `scheduleSlots` is "الأحد، الحصة 3 → شعبة
 * العاشر ب" (one row per day×period). Folding them into one table would mean
 * a school moving period 3 to 9:40 requires updating up to seven rows instead
 * of one.
 */
import { pgTable, text, timestamp, uuid, integer, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { classGroups } from "./students";

export const schedulePeriods = pgTable(
  "schedule_periods",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 1-based, and the only thing `scheduleSlots` uses to find this row's time. */
    periodNumber: integer("period_number").notNull(),
    /** "HH:MM", 24-hour. Free text like every other time/date field in this
     *  schema (`teachingPlans.time`) — validated at the API boundary, not here. */
    startTime: text("start_time").notNull(),
    durationMinutes: integer("duration_minutes").notNull().default(45),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    // One time for period N per teacher — this is what makes "the time" a
    // single fact instead of one copy per weekday.
    uniqueIndex("schedule_periods_teacher_period_idx").on(t.teacherId, t.periodNumber),
  ],
);

export const scheduleSlots = pgTable(
  "schedule_slots",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** 0 = Sunday .. 6 = Saturday, matching `Date#getDay()` and the app's own
     *  weekday convention (see artifacts/mobile/services/planEntries.ts). */
    dayOfWeek: integer("day_of_week").notNull(),
    periodNumber: integer("period_number").notNull(),
    /**
     * The class in this slot, or empty (`null`) — a school's grid legitimately
     * has unfilled periods (a free period, lunch, admin time). `set null` on
     * delete for the same reason as `teachingPlans.classGroupId`: archiving a
     * class must not take the rest of the teacher's timetable down with it,
     * it should just empty that one slot.
     */
    classGroupId: uuid("class_group_id").references(() => classGroups.id, {
      onDelete: "set null",
    }),
    /** Per-slot note — "أحضر الآلة الحاسبة", a recurring reminder for this
     *  specific day+period, not the class or any one lesson. */
    notes: text("notes").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    // One class per day+period per teacher — this IS the grid's shape.
    uniqueIndex("schedule_slots_teacher_day_period_idx").on(t.teacherId, t.dayOfWeek, t.periodNumber),
    index("schedule_slots_class_idx").on(t.classGroupId),
  ],
);

export const insertSchedulePeriodSchema = createInsertSchema(schedulePeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertScheduleSlotSchema = createInsertSchema(scheduleSlots).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SchedulePeriod = typeof schedulePeriods.$inferSelect;
export type InsertSchedulePeriod = z.infer<typeof insertSchedulePeriodSchema>;
export type ScheduleSlot = typeof scheduleSlots.$inferSelect;
export type InsertScheduleSlot = z.infer<typeof insertScheduleSlotSchema>;
