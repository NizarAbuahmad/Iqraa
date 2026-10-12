/**
 * Homework a teacher sets for one class, and which children have ticked it off.
 *
 * Deliberately small: a title, instructions, a due day, and an optional link to
 * an exam already attached to the class. No uploads and no grading — a student
 * marks it done, a parent reads it, the teacher sees a count.
 *
 * `class_group_id` is NOT NULL and cascades: homework belongs to a class, and a
 * class has exactly one teacher, so a "class" and "whose homework" can never
 * disagree. Archiving a class (the product's delete) hides its homework —
 * readers join on `class_groups.archived_at` — without touching these rows.
 *
 * Completion is per roster row (`students.id`), not per account. A child taught
 * by two teachers is two roster rows in two classes, and homework belongs to
 * exactly one class, so one row per (homework, child) is unambiguous.
 */
import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { classGroups, students } from "./students";
import { evaluations } from "./evaluations";

export const homework = pgTable(
  "homework",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    /** End of the due day, Asia/Amman (23:59:59.999 +03:00) — see modules/homework/rules.ts. */
    dueAt: timestamp("due_at", { withTimezone: true }).notNull(),
    /** An exam already attached to this class; `set null` so deleting the exam leaves the homework. */
    evaluationId: uuid("evaluation_id").references(() => evaluations.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  t => [
    index("homework_class_due_idx").on(t.classGroupId, t.dueAt),
    index("homework_teacher_idx").on(t.teacherId),
  ],
);

export const homeworkCompletions = pgTable(
  "homework_completions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    doneAt: timestamp("done_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("homework_completions_unique").on(t.homeworkId, t.studentId),
    index("homework_completions_student_idx").on(t.studentId),
  ],
);

export type Homework = typeof homework.$inferSelect;
export type HomeworkCompletion = typeof homeworkCompletions.$inferSelect;
