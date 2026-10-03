/**
 * Parent contact log — one row each time a teacher sends, shares or copies a
 * parent letter about a roster student (app/ai-tools/parent-message.tsx).
 *
 * Only what the history strip needs: when, and about what. The letter text is
 * deliberately not stored — it is about a named minor, and nothing reads it
 * back. `share`/`copy` rows record intent, not delivery: the text left the app
 * and we cannot see whether it reached anyone.
 */
import { index, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { students } from "./students";

export type ParentContactChannel = "in_app" | "share" | "copy";

export const parentContacts = pgTable(
  "parent_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** A MessageKind from services/parentMessage.ts, e.g. 'missing-homework'. */
    kind: text("kind").notNull(),
    channel: text("channel").$type<ParentContactChannel>().notNull(),
    /**
     * In-app only: the chat message ids this letter became, one per guardian
     * thread. `read` is decided from these (lib/parentContactRead.ts in the
     * API), not from the thread. Null on rows logged before 2026-10-02 and on
     * shared/copied rows, which have no message.
     */
    messageIds: jsonb("message_ids").$type<string[]>(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("parent_contacts_student_created_idx").on(t.studentId, t.createdAt)],
);

export type ParentContact = typeof parentContacts.$inferSelect;
