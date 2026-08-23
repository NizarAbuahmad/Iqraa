import { pgTable, text, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";
import { classGroups } from "./students";

export const savedMaterials = pgTable("saved_materials", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'lesson' | 'worksheet' | 'quiz'
  title: text("title").notNull(),
  subject: text("subject").notNull().default(""),
  grade: text("grade").notNull().default(""),
  topic: text("topic").notNull().default(""),
  language: text("language").notNull().default("en"),
  content: jsonb("content").notNull().default({}),
  formState: jsonb("form_state").notNull().default({}),
  isFavorite: boolean("is_favorite").notNull().default(false),
  /**
   * The class this material was made for, if the teacher attached it to one.
   *
   * Nullable because most materials are written before there is a class to
   * hang them on, and `set null` because archiving a class must not take the
   * teacher's worksheets with it — the material outlives the section.
   *
   * ponytail: one class per material. A worksheet used with two sections has
   * to be duplicated (`POST /workspace/items/:id/duplicate` already does it).
   * Promote to a join table if teachers actually ask for shared materials.
   */
  classGroupId: uuid("class_group_id").references(() => classGroups.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertSavedMaterialSchema = createInsertSchema(savedMaterials).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type SavedMaterial = typeof savedMaterials.$inferSelect;
export type InsertSavedMaterial = z.infer<typeof insertSavedMaterialSchema>;
