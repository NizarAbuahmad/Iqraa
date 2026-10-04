/**
 * What a teacher has put in front of a class from the Library — the second
 * thing a class's الموارد tab shows, beside the teacher's own saved materials.
 *
 * A row is a pointer plus a snapshot, not a copy of anything. `library_source`
 * and `library_native_id` say which catalogue item it points at; `title`,
 * `media_kind`, `url` and `thumbnail_url` are what the item looked like when it
 * was added, so the tab renders without downloading the Library. A staff
 * upload's `url` is the exception: the list endpoint rebuilds it from the
 * Library row on every read (the R2 base it was composed from may move), and
 * the stored value is only the fallback. A staff upload can be deleted
 * afterwards — the list endpoint reports that as `unavailable` rather than the
 * row quietly dying.
 *
 * `kind` is `library` today. `link` (a teacher-pasted URL) and `file` (a device
 * upload) are reserved for later pieces and need no change to this shape except
 * that files add their own storage columns.
 *
 * Archiving is this product's "delete a class" (DELETE /classes/:id sets
 * archivedAt), so the cascade below mostly matters for deleting an account.
 *
 * Spec: docs/superpowers/specs/2026-10-04-class-resources-design.md
 */
import { sql } from "drizzle-orm";
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";
import { classGroups } from "./students";

export const classResources = pgTable(
  "class_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    classGroupId: uuid("class_group_id")
      .notNull()
      .references(() => classGroups.id, { onDelete: "cascade" }),
    teacherId: uuid("teacher_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    librarySource: text("library_source"),
    libraryNativeId: text("library_native_id"),
    title: text("title").notNull(),
    mediaKind: text("media_kind").notNull(),
    url: text("url"),
    thumbnailUrl: text("thumbnail_url"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("class_resources_class_idx").on(t.classGroupId),
    uniqueIndex("class_resources_library_unique")
      .on(t.classGroupId, t.librarySource, t.libraryNativeId)
      .where(sql`${t.kind} = 'library'`),
  ],
);

export type ClassResourceRow = typeof classResources.$inferSelect;
