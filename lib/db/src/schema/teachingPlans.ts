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

export const teachingPlans = pgTable(
  "teaching_plans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    schoolName: text("school_name").notNull().default(""),
    grades: text("grades").notNull().default(""),
    topics: text("topics").notNull().default(""),
    time: text("time").notNull().default(""),
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
