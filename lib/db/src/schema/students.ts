/**
 * Roster — classes and students.
 *
 * A student row is still, first, **a name a teacher wrote down**: it needs no
 * account to exist and most never have one. That was once the whole story —
 * authenticating minors buys consent handling, password recovery for
 * fifteen-year-olds and a parent-facing support surface, none of which helps
 * anyone learn anything — and it is why an evaluation is delivered by link,
 * with the link itself as the identity (see `attempts.accessTokenHash`).
 *
 * Since 2026-09-04 a student or parent *may additionally* claim a row and get
 * a real `users` account: `claimCode` below is minted by the teacher, and
 * `rosterLinks` (schema/messaging.ts) records who claimed what. That exists so
 * in-app messaging has someone to address, and nothing else here depends on
 * it — a roster whose rows are all unclaimed behaves exactly as it did before.
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
    /**
     * The teacher's running note on this child — one field, overwritten, not a
     * history. What a teacher wants at a parent evening is the current picture
     * ("improving on word problems, still rushes"), and a timeline of every
     * edit is a bigger thing to build, read, and delete from.
     *
     * Distinct from `attempts.teacherComment`, which is about one sitting.
     * This one outlives any single test.
     *
     * ponytail: no history. Add a notes table if a teacher asks to see how a
     * child changed across the term.
     */
    teacherNote: text("teacher_note").notNull().default(""),
    /**
     * A short code the teacher hands to a parent or the student themself, so
     * their self-serve signup can link to this exact roster row instead of
     * creating a dangling account. Mirrors `classGroups.joinCode`. Plain text,
     * not hashed like `attempts.accessTokenHash` — this grants a chat-linking
     * claim, not exam-answering access, so it's shared the same low-stakes
     * way a teacher already shares a join code.
     */
    claimCode: text("claim_code").unique(),
    claimCodeExpiresAt: timestamp("claim_code_expires_at", { withTimezone: true }),
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
