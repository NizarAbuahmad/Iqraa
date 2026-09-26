/**
 * The resources library — ready-made material Iqraa staff upload per grade,
 * subject and (optionally) lesson, shown to every teacher of that grade in
 * `/curriculum/resources`.
 *
 * Global, not per school: only `system_admin` may write (routes/library.ts).
 * Each row is either an uploaded file (`r2Key` in the public bucket, served by
 * a permanent URL) or a link (`sourceUrl`, for long videos and online games) —
 * never both, enforced by the check constraint.
 *
 * `lessonId` is a plain KB id (`kbl-...`), not a foreign key, for the same
 * reason as `lesson_media.lesson_id`: the curriculum lives in files.
 */
import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, smallint, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const libraryResources = pgTable(
  "library_resources",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gradeId: text("grade_id").notNull(),
    subjectId: text("subject_id").notNull(),
    lessonId: text("lesson_id"),
    category: text("category").notNull(), // LibraryCategory, see api-server lib/libraryResource.ts
    titleAr: text("title_ar").notNull(),
    description: text("description").notNull().default(""),
    r2Key: text("r2_key"),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    sourceUrl: text("source_url"),
    /** 1 or 2 when the resource covers one semester only; null = whole book / grade. */
    semester: smallint("semester"),
    /** Optional cover image shown in the library row (YouTube thumbnail, Wikimedia image, etc.). */
    thumbnailUrl: text("thumbnail_url"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    index("library_resources_grade_idx").on(t.gradeId),
    check("library_resources_file_or_link", sql`(${t.r2Key} IS NULL) <> (${t.sourceUrl} IS NULL)`),
  ],
);

export type LibraryResourceRow = typeof libraryResources.$inferSelect;
