import { pgTable, text, boolean, timestamp, uuid, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

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
