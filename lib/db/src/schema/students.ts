/**
 * Roster — classes and students.
 *
 * Students deliberately have **no account**: no email, no password hash, no row
 * in `users`. A student is a name a teacher wrote down. Authenticating minors
 * would buy consent handling, password recovery for fifteen-year-olds and a
 * parent-facing support surface, none of which helps anyone learn anything.
 * When evaluations are delivered by link (a later phase), the link itself is
 * the identity — see `attempts.accessTokenHash`.
 *
 * Everything here is owned by a teacher. There is no school or tenant layer
 * yet; add one below `users` when a school actually asks for it.
 */
import { pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const classGroups = pgTable(
  "class_groups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    nameAr: text("name_ar").notNull().default(""),
    /** Curriculum ids from `@workspace/curriculum` (e.g. 'grade-10'). */
    gradeId: text("grade_id").notNull().default(""),
    subjectId: text("subject_id").notNull().default(""),
    academicYear: text("academic_year").notNull().default(""),
    /**
     * Short human-typeable code for a future "one shared link, type your name"
     * mode. Unused today — per-student links are the shipping path, because a
     * level attached to the wrong name is worse than no level.
     */
    joinCode: text("join_code").unique(),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("class_groups_teacher_idx").on(t.teacherId)],
);

export const students = pgTable(
  "students",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** School register number or similar. Optional, teacher's own reference. */
    externalRef: text("external_ref"),
    gradeId: text("grade_id").notNull().default(""),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("students_teacher_idx").on(t.teacherId)],
);

/**
 * Many-to-many on purpose: one student sits in several subjects, and the same
 * teacher may take them for more than one. Modelling a student as belonging to
 * a single class would force duplicate student rows and split their history.
 */
export const classMemberships = pgTable(
  "class_memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("class_memberships_unique").on(t.classGroupId, t.studentId),
    index("class_memberships_student_idx").on(t.studentId),
  ],
);

export const insertClassGroupSchema = createInsertSchema(classGroups).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export const insertStudentSchema = createInsertSchema(students).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
});

export type ClassGroup = typeof classGroups.$inferSelect;
export type InsertClassGroup = z.infer<typeof insertClassGroupSchema>;
export type Student = typeof students.$inferSelect;
export type InsertStudent = z.infer<typeof insertStudentSchema>;
export type ClassMembership = typeof classMemberships.$inferSelect;
