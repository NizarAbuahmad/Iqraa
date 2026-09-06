import { pgTable, text, integer, timestamp, uuid, jsonb, index, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * The shared pool of generated artifacts — phase 1 of
 * `docs/ai-cost-savings-plan.md`.
 *
 * Iqraa serves a fixed national curriculum, so a few hundred teachers ask for
 * a worksheet on كثيرات الحدود in the same week. Before this table each of
 * those was its own model call. A row here is one artifact that any teacher
 * asking the same question can be served, for free.
 *
 * **Why a pool of variants and not one entry per key.** A single shared
 * worksheet means two classes in the same school sit the identical paper and
 * swap answers, and a teacher pressing "regenerate" gets the thing they just
 * rejected. So each key holds up to `VARIANT_POOL_MAX` (5) distinct variants,
 * and regeneration is what fills the pool: teacher A's regenerate pays for
 * variant 2, and every teacher after them is served it for nothing. The two
 * features are one mechanism.
 *
 * **`strictKey`, not `coarseKey`, is what is served.** The coarse key drops
 * difficulty, question count and duration on the plan's promise that a superset
 * artifact will be sliced down to them — that is phase 2 and it is not built.
 * Serving on the coarse key today would hand a teacher who asked for 5 easy
 * questions a 15-question hard paper. `coarseKey` is stored anyway so the gap
 * between the two hit rates stays measurable, which is the whole reason
 * `generationKeys` computes both.
 *
 * **Nothing teacher-private is ever stored here.** A row is only written for a
 * request whose context is curriculum-derived — see `contextSource` in
 * `artifacts/api-server/src/lib/generationKey.ts`. A request carrying material
 * the teacher supplied bypasses this table in both directions; serving teacher
 * A's pasted notes to teacher B is a content leak, not a cache hit.
 */
export const aiArtifacts = pgTable(
  "ai_artifacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The cache key. Includes kind, model, prompt version, lesson, language
     *  and every request parameter — see `generationKeys().strictKey`. */
    strictKey: text("strict_key").notNull(),
    /** Recorded, not served on. Phase 2's measurement — see the header. */
    coarseKey: text("coarse_key").notNull().default(""),
    kind: text("kind").notNull(), // 'lesson-plan' | 'worksheet' | 'quiz' | …
    model: text("model").notNull(),
    promptVersion: text("prompt_version").notNull().default(""),
    language: text("language").notNull().default("arabic"),
    /** The curriculum lesson id when the client sent one, else the normalized
     *  topic. Not part of the key — it is here so the catalog can be browsed
     *  and precomputed per lesson (phase 3) without re-deriving keys. */
    lessonRef: text("lesson_ref").notNull().default(""),
    /** 0-based position in this key's pool. Unique per key, so two concurrent
     *  writers cannot claim the same slot. */
    variantIndex: integer("variant_index").notNull(),
    /** The artifact exactly as the route would have returned it. */
    content: jsonb("content").notNull(),
    /** How many teachers have been served this row. Drives round-robin: the
     *  least-served unseen variant goes out next, so the pool spreads instead
     *  of everyone getting variant 0. */
    timesServed: integer("times_served").notNull().default(0),
    /**
     * Set when a teacher reports the artifact as wrong.
     *
     * This is the cost of sharing: an unusable worksheet now reaches every
     * teacher who asks for that lesson, not just the one who generated it. A
     * retired row is never served again and never counted toward the pool cap,
     * so the next request regenerates into its place.
     */
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    // The lookup on every generation: variants for one key, least-served first.
    index("ai_artifacts_strict_key_idx").on(t.strictKey),
    // Two teachers missing the same key at the same instant are collapsed by
    // the in-process single-flight map, but that map is per process and Render
    // can run more than one. This constraint is what makes the race safe
    // across processes: the loser's insert fails and it serves the winner's row.
    uniqueIndex("ai_artifacts_key_variant_idx").on(t.strictKey, t.variantIndex),
  ],
);

/** Distinct variants held per key. Beyond this a regenerate still produces
 *  fresh content, it just is not stored — the pool stops growing rather than
 *  the teacher stopping getting something new. */
export const VARIANT_POOL_MAX = 5;

export const insertAiArtifactSchema = createInsertSchema(aiArtifacts).omit({
  id: true,
  createdAt: true,
});

export type AiArtifact = typeof aiArtifacts.$inferSelect;
export type InsertAiArtifact = z.infer<typeof insertAiArtifactSchema>;
