/**
 * Teacher-uploaded media (image/audio/document) attached to a specific
 * curriculum lesson — the server-side replacement for
 * `artifacts/mobile/services/lessonMedia.ts`'s AsyncStorage-only "pins",
 * which lived only on one device and vanished on reinstall.
 *
 * `lessonId` is a plain `text` KB id (`kbl-...`), not a foreign key —
 * curriculum content is file-based (`@workspace/curriculum`), not a Postgres
 * table, same convention as `evaluations.lessonId`/`unitId`. Carrying the KB
 * id rather than a free-text topic is deliberate: CLAUDE.md already records
 * that a lesson title does not identify a lesson (16 of 63 titles resolve to
 * the wrong lesson under semantic search), so anything meant to survive
 * re-lookup must carry the id.
 */
import { pgTable, text, timestamp, uuid, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export type LessonMediaKind = "image" | "audio" | "document";

export const lessonMedia = pgTable("lesson_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lessonId: text("lesson_id").notNull(),
  kind: text("kind").notNull(), // LessonMediaKind
  r2Key: text("r2_key").notNull(),
  caption: text("caption").notNull().default(""),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertLessonMediaSchema = createInsertSchema(lessonMedia).omit({
  id: true,
  createdAt: true,
});

export type LessonMediaRow = typeof lessonMedia.$inferSelect;
export type InsertLessonMedia = z.infer<typeof insertLessonMediaSchema>;
