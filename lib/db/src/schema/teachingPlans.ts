/**
 * Teaching plans — a teacher's own record of what they intend to teach.
 *
 * Distinct from `classGroups` (students.ts): a class is a roster a teacher
 * assigns evaluations to, keyed to one grade/subject. A plan is what that
 * class is going to be taught, and a teacher may have several (one per
 * school, term, or class).
 *
 * A plan is anchored to a class, and takes its grade and subject from it —
 * the app stopped asking for `grades` as free text, because a typed
 * "العاشر الف" is a string nothing can act on. `topics` and `date` are still
 * free text and are the next thing to go: with a known grade and subject,
 * they can become curriculum lesson ids against week numbers, which is what
 * would let a plan answer «اختر الدرس الحالي» instead of a teacher picking
 * it each session.
 */
import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
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
    grades: text("grades").notNull().default(""),
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
