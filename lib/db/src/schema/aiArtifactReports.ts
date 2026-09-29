import { pgTable, text, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiArtifacts } from "./aiArtifacts";
import { users } from "./users";

export type ArtifactReportStatus = "open" | "approved" | "dismissed";

/**
 * A teacher's "بلّغ عن مشكلة" on a pooled artifact, queued for a
 * `system_admin` to act on — see `routes/moderation.ts`'s
 * `/moderation/artifact-reports*` endpoints.
 *
 * The artifact itself is NOT retired by inserting this row: `aiArtifacts`'s
 * pool keeps serving it to other teachers until an admin approves. That is
 * the point of this table existing separately from `retiredAt` — a report is
 * a claim, not yet a decision.
 */
export const aiArtifactReports = pgTable(
  "ai_artifact_reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    artifactId: uuid("artifact_id")
      .notNull()
      .references(() => aiArtifacts.id, { onDelete: "cascade" }),
    reporterUserId: uuid("reporter_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    reason: text("reason").notNull().default(""),
    status: text("status").$type<ArtifactReportStatus>().notNull().default("open"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("ai_artifact_reports_artifact_idx").on(t.artifactId),
    index("ai_artifact_reports_status_idx").on(t.status),
  ],
);

export const insertAiArtifactReportSchema = createInsertSchema(aiArtifactReports).omit({
  id: true,
  createdAt: true,
});

export type AiArtifactReport = typeof aiArtifactReports.$inferSelect;
export type InsertAiArtifactReport = z.infer<typeof insertAiArtifactReportSchema>;
