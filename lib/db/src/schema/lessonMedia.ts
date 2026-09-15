/**
 * A teacher's media library — images, videos, audio and documents they can
 * drop into a lesson deck or send to a student.
 *
 * Two kinds of row, and exactly one of the two column groups is set:
 *
 *   - an UPLOAD: `r2Key` + `mimeType` + `sizeBytes`, the bytes in R2
 *   - a REFERENCE: `sourceUrl`, something already on the web (a YouTube link,
 *     an Unsplash photo). Nothing is stored and nothing is ours to serve.
 *
 * Same all-or-nothing column-group convention `chat_messages`'s attachment
 * columns already use. Storing a reference as a row rather than re-searching
 * for it is the whole point of a library: a video a teacher picked once is a
 * video they can pick again without the search returning something else.
 *
 * `lessonId` is nullable — an item pinned to a lesson shows up in that
 * lesson's attachments, an unpinned one only in the library. It is a plain
 * `text` KB id (`kbl-...`), not a foreign key: curriculum content is
 * file-based (`@workspace/curriculum`), not a Postgres table, same convention
 * as `evaluations.lessonId`/`unitId`. Carrying the KB id rather than a
 * free-text topic is deliberate: CLAUDE.md already records that a lesson title
 * does not identify a lesson (16 of 63 titles resolve to the wrong lesson
 * under semantic search), so anything meant to survive re-lookup carries the
 * id.
 *
 * The table keeps its original `lesson_media` name. It started as per-lesson
 * pins and grew into the library; renaming it would be a migration bought with
 * nothing.
 */
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

/**
 * `video` has no upload path on purpose — it only ever arrives as a reference
 * (a YouTube link). There is no multipart upload anywhere in this server and
 * video files would not fit the 8MB data-URL cap regardless.
 */
export type LessonMediaKind = "image" | "video" | "audio" | "document";

export const lessonMedia = pgTable("lesson_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id"),
  kind: text("kind").notNull(), // LessonMediaKind
  // Upload group — all three set together, or all three null for a reference.
  r2Key: text("r2_key"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  // Reference group — set only when `r2Key` is null.
  sourceUrl: text("source_url"),
  caption: text("caption").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLessonMediaSchema = createInsertSchema(lessonMedia).omit({
  id: true,
  createdAt: true,
});

export type LessonMediaRow = typeof lessonMedia.$inferSelect;
export type InsertLessonMedia = z.infer<typeof insertLessonMediaSchema>;
