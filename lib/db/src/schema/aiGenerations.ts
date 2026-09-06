import { pgTable, text, integer, numeric, timestamp, uuid, index, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { users } from "./users";

/**
 * One row per completed model call — the measurement layer under
 * `docs/ai-cost-savings-plan.md`.
 *
 * Two jobs, which is why it is one table and not two:
 *
 * 1. **A spend total that survives a restart.** `aiBudget.ts` kept the running
 *    total in a module-scope variable, and the free-tier API sleeps after ~15
 *    minutes idle, so every wake reset it. Summing `costUsd` over the current
 *    month gives a figure that does not.
 * 2. **Answering "would a cache have helped?" without building one.** Every
 *    row carries the cache key the request *would* have had. Nothing reads
 *    those keys yet; recording them now means the hit rate can be measured
 *    from history rather than guessed at, before a line of caching is written.
 *
 * `coarseKey` and `strictKey` exist to measure one specific decision. The
 * strict key includes every request parameter; the coarse key drops the ones
 * the plan proposes to serve by slicing a superset (difficulty, question
 * count, duration). Comparing the two repeat rates is what says whether the
 * superset design earns its complexity — a question otherwise settled by
 * argument.
 */
export const aiGenerations = pgTable(
  "ai_generations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable, and set null rather than cascade: a deleted teacher must not
    // erase spend history, or the month's total silently drops.
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    kind: text("kind").notNull(), // 'lesson-plan' | 'worksheet' | … | 'chat'
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull().default(""),
    coarseKey: text("coarse_key").notNull().default(""),
    strictKey: text("strict_key").notNull().default(""),
    /** Whether the request carried context the *teacher* supplied — pasted
     * notes, an attached document. Such a request can never enter the shared
     * pool, so hit-rate maths has to be able to exclude it. Curriculum-derived
     * context does not count: it is a function of the lesson, identical for
     * every teacher who asks, and treating it as private is what would have
     * made the cache never hit at all. See `generationKeys`. */
    hasContext: boolean("has_context").notNull().default(false),
    /** 'hit' when the request was served from `ai_artifacts` without calling
     *  the model, 'miss' when it was generated. */
    cacheStatus: text("cache_status").notNull().default("miss"),
    /**
     * The `ai_artifacts` row this request was served from or wrote.
     *
     * Set on hits and on misses alike, which is what makes it a per-teacher
     * serve log: "which variants has this teacher already seen for this key"
     * is a query over these rows, and that is what regeneration excludes from.
     * Deliberately a plain text id rather than a foreign key — a retired
     * artifact can be deleted without erasing the history of it being served,
     * and this table's whole purpose is history that survives.
     */
    artifactId: text("artifact_id"),
    promptTokens: integer("prompt_tokens").notNull().default(0),
    completionTokens: integer("completion_tokens").notNull().default(0),
    /** Estimated, from aiBudget's pricing table — not billing-accurate. */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull().default("0"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The month-to-date spend sum runs on every process start.
    index("ai_generations_created_at_idx").on(t.createdAt),
    // Repeat-rate analysis groups by key.
    index("ai_generations_coarse_key_idx").on(t.coarseKey),
    // "What has this teacher already been served for this key" — the lookup
    // behind regeneration serving a variant the teacher has not seen.
    index("ai_generations_user_strict_key_idx").on(t.userId, t.strictKey),
  ],
);

export const insertAiGenerationSchema = createInsertSchema(aiGenerations).omit({
  id: true,
  createdAt: true,
});

export type AiGeneration = typeof aiGenerations.$inferSelect;
export type InsertAiGeneration = z.infer<typeof insertAiGenerationSchema>;
