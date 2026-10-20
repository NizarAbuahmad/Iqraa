/**
 * Homework a teacher sets for one class, and which children have ticked it off.
 *
 * Deliberately small: a title, instructions, a due day, an optional link to
 * an exam already attached to the class, and attached Library items. No uploads
 * and no grading — a student marks it done, a parent reads it, the teacher sees
 * a count.
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
import { jsonb, pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { users } from "./users";
import { classGroups, students } from "./students";
import { evaluations } from "./evaluations";

/** One attached Library item. `source`/`nativeId` say which; the rest is how it looked when attached. */
export interface HomeworkLibraryResource {
  kind: "library";
  source: string;
  nativeId: string;
  title: string;
  mediaKind: string;
  url: string | null;
  thumbnailUrl: string | null;
}

/**
 * One of the teacher's own saved materials (ملفاتي). Only the id is trusted:
 * title and type are copied from the `saved_materials` row when attached, and
 * the content is read live — through the family route, which re-checks that
 * the row is still the homework teacher's (routes/familyHomework.ts).
 */
export interface HomeworkMaterialResource {
  kind: "material";
  materialId: string;
  title: string;
  type: string;
}

export type HomeworkResource = HomeworkLibraryResource | HomeworkMaterialResource;

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
    /**
     * Library items the teacher attached, as snapshots (same idea as
     * class_resources): the family view renders them without reading the
     * Library. Validated and capped by routes/homework.ts.
     */
    resources: jsonb("resources").$type<HomeworkResource[]>().notNull().default([]),
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

/**
 * One row per homework per due day that a reminder went out for — the
 * at-most-once record behind `POST /internal/homework-reminders`. The run
 * CLAIMS a row (insert … on conflict do nothing) before sending, and skips a
 * homework it could not claim, so a second run the same day, a scheduler
 * retry or two overlapping runs send nothing twice. Keyed by the due day too:
 * a homework whose due date moves is reminded again for its new day. The price
 * of claiming first, accepted: a send that fails after the claim is not retried.
 */
export const homeworkReminders = pgTable(
  "homework_reminders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    homeworkId: uuid("homework_id")
      .notNull()
      .references(() => homework.id, { onDelete: "cascade" }),
    /** The Amman calendar day the homework was due on when reminded, `YYYY-MM-DD`. */
    dueDate: text("due_date").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [unique("homework_reminders_unique").on(t.homeworkId, t.dueDate)],
);

export type HomeworkReminder = typeof homeworkReminders.$inferSelect;
