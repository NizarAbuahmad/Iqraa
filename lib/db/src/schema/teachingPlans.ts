/**
 * Teaching plans — a teacher's own record of what they intend to teach.
 *
 * Distinct from `classGroups` (students.ts): a class is a roster a teacher
 * assigns evaluations to, keyed to one grade/subject. A plan is what that
 * class is going to be taught, and a teacher may have several (one per
 * school, term, or class).
 *
 * A plan is anchored to a class and takes its grade and subject from it — the
 * app stopped asking for `grades` as free text, because a typed "العاشر الف"
 * is a string nothing can act on. `entries` finished the job: the schedule is
 * curriculum lesson ids against real calendar dates, so the plan can answer
 * «ماذا أُدرِّس اليوم؟» directly instead of a teacher re-deriving it from an
 * abstract week number every morning. `topics`, `date` and `grades` survive
 * as the legacy display path for plans written before any of this existed.
 */
import { pgTable, text, timestamp, uuid, jsonb, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { classGroups } from "./students";

export const teachingPlans = pgTable(
  "teaching_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    schoolName: text("school_name").notNull().default(""),
    /**
     * The class this plan is for. The app now requires one when a plan is
     * created or edited, but the column stays nullable on purpose: it is
     * `set null` on delete for the same reason as
     * `savedMaterials.classGroupId` (savedMaterials.ts) — archiving a class
     * must not take the plan down with it — and plans written before the
     * anchor existed still have none. Those keep showing their old `grades`
     * text until someone edits them; see services/planScope.ts.
     */
    classGroupId: uuid("class_group_id").references(() => classGroups.id, {
      onDelete: "set null",
    }),
    /**
     * The schedule: `[{ lessonId, date }]` — one calendar date (`YYYY-MM-DD`)
     * per curriculum lesson. A lesson is held by its **KB id**, never its
     * title; `searchKBSemantic(title)` resolves 16 of 63 picker lessons to a
     * *different* lesson, so a title-keyed plan silently swaps them
     * (CLAUDE.md, "A lesson title does not identify a lesson").
     *
     * Held `week: number` (an abstract week index) for a few hours on
     * 2026-09-20 before shipping to nobody; that shape is not migrated, it is
     * simply no longer valid — `normalizePlanEntries` drops a `week`-shaped
     * row like any other malformed element.
     *
     * One column rather than a `teaching_plan_entries` child table: entries
     * are always read and written whole and nothing queries across plans, so
     * a table would buy a join and a second migration and nothing else.
     * Nothing may trust its shape — see `normalizePlanEntries`
     * (artifacts/mobile/services/planEntries.ts) and the server's own
     * `parsePlanEntries`, which is the validating one. The "lay out my whole
     * term" auto-fill (`autoScheduleEntries`) takes a start date and which
     * weekdays the class meets, but neither of those is persisted — they are
     * a one-time recipe, not plan state; only the dates they produce are
     * saved.
     */
    entries: jsonb("entries")
      .$type<{ lessonId: string; date: string }[]>()
      .notNull()
      .default([]),
    grades: text("grades").notNull().default(""),
    /**
     * Superseded by `entries`, kept because dropping a column is the one
     * schema change that cannot be undone from a backup-free production. Both
     * still render for plans written before `entries` existed; new plans
     * leave them empty.
     */
    topics: text("topics").notNull().default(""),
    date: text("date").notNull().default(""),
    time: text("time").notNull().default(""),
    notes: text("notes").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("teaching_plans_teacher_idx").on(t.teacherId)],
);

export const insertTeachingPlanSchema = createInsertSchema(teachingPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export type TeachingPlan = typeof teachingPlans.$inferSelect;
export type InsertTeachingPlan = z.infer<typeof insertTeachingPlanSchema>;
