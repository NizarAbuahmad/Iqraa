import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

export const feedback = pgTable("feedback", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  materialType: text("material_type").notNull(), // 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides'
  toolId: text("tool_id").notNull().default(""), // toolCatalog id, e.g. 'lesson-plan', 'simplify'
  rating: text("rating").notNull(), // 'up' | 'down'
  comment: text("comment").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});

export type Feedback = typeof feedback.$inferSelect;
export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
