/**
 * Teaching plans — a teacher's own record of what they intend to teach.
 *
 * Distinct from `classGroups` (students.ts): a class is a roster a teacher
 * assigns evaluations to, keyed to one grade/subject. A teaching plan is a
 * free-text note about the bigger picture — which school, which grades,
 * which topics, on what schedule — and a teacher may have several (one per
 * school, term, or class). Nothing else in the schema references it yet, so
 * every field is plain text with no curriculum-id wiring.
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
     * The class this plan is for, if the teacher linked one. Nullable and
     * `set null` on delete for the same reason as `savedMaterials.classGroupId`
     * (savedMaterials.ts) — a plan can exist before any class does, and
     * archiving a class must not take the plan down with it.
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
