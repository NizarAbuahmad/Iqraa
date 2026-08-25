/**
 * Persistence for `ai_generations` — the spend total and the cache-key record.
 *
 * Every function here **fails soft, and says so in the log.** Two reasons, both
 * learned the hard way in this repo:
 *
 * - The production schema is not deployed by anything automatic
 *   (`pnpm --filter @workspace/db run push` is manual), so a release that ships
 *   this before the push runs against a table that does not exist. A
 *   measurement layer must not take generation down with it — a teacher losing
 *   their lesson plan because a metrics insert failed would be a far worse bug
 *   than the one this is here to fix.
 * - `@workspace/db` throws at module scope without `DATABASE_URL`, exactly like
 *   the OpenAI client (see CLAUDE.md). Importing it lazily is what keeps the
 *   pure helpers in this package testable under `node --test`.
 *
 * The cost of failing soft is that a broken table degrades the budget guard
 * back to its old per-process behaviour silently. Hence the failure flag and
 * its exposure through `/healthz/ai-budget`: degraded is acceptable,
 * undetectably degraded is not.
 *
 * What is exposed is the *operation* that failed, never the driver's message.
 * `/healthz/ai-budget` is deliberately public and unauthenticated, on the
 * stated grounds that it carries no secrets; a Drizzle error stringifies to
 * the full failing query, its parameters and the connection target, so
 * returning one there would quietly turn a health check into a schema leak.
 * The message goes to the log, where it is already gated.
 */
import { logger } from "./logger.ts";

export type GenerationRecord = {
  userId?: string | null;
  kind: string;
  model: string;
  promptVersion: string;
  coarseKey: string;
  strictKey: string;
  hasContext: boolean;
  cacheStatus: "hit" | "miss";
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
};

export type PersistenceOperation = "read" | "insert";

let lastFailure: PersistenceOperation | null = null;

/**
 * Which operation last failed, or null when persistence has worked (or has
 * not been tried yet). Deliberately not the error message — see the note above
 * about what `/healthz/ai-budget` is allowed to say.
 */
export function getPersistenceFailure(): PersistenceOperation | null {
  return lastFailure;
}

function note(err: unknown, what: PersistenceOperation): void {
  lastFailure = what;
  logger.warn(
    { err, what },
    "ai usage persistence failed — spend total falls back to this process's own counter",
  );
}

/** First instant of the current UTC month, matching how OpenAI's project
 *  spend limit resets. The app's number and the console's then measure the
 *  same window, which is the only way to compare them. */
export function currentPeriodStart(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/**
 * Insert one row. Never throws: a failed write costs a measurement, and
 * throwing would cost the teacher their artifact after the model was paid for.
 */
export async function recordGeneration(row: GenerationRecord): Promise<void> {
  try {
    const { db, aiGenerations } = await import("@workspace/db");
    await db.insert(aiGenerations).values({
      userId: row.userId ?? null,
      kind: row.kind,
      model: row.model,
      promptVersion: row.promptVersion,
      coarseKey: row.coarseKey,
      strictKey: row.strictKey,
      hasContext: row.hasContext,
      cacheStatus: row.cacheStatus,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      costUsd: row.costUsd.toFixed(6),
    });
    lastFailure = null;
  } catch (err) {
    note(err, "insert");
  }
}

/**
 * Month-to-date spend across every process that has ever run.
 *
 * Returns null — not 0 — when it cannot be read. The distinction matters: 0
 * means "nothing spent this month", null means "unknown", and treating the
 * second as the first is how a budget guard reports all-clear over a total it
 * never managed to load.
 */
/**
 * Month-to-date spend for one teacher.
 *
 * Separate from the global total because they answer different questions. The
 * global one protects the project's card; this one stops a single teacher
 * consuming a shared allowance that fifty people are sharing — with one cap,
 * whoever generates on the 20th is refused and has no way to tell that from a
 * bug.
 *
 * Returns null when the table cannot be read, and callers must treat that as
 * "unknown", never as "zero spent".
 */
export async function readUserPeriodSpendUsd(userId: string): Promise<number | null> {
  try {
    const { db, aiGenerations } = await import("@workspace/db");
    const { and, eq, gte, sql } = await import("drizzle-orm");
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${aiGenerations.costUsd}), 0)` })
      .from(aiGenerations)
      .where(
        and(
          gte(aiGenerations.createdAt, currentPeriodStart()),
          eq(aiGenerations.userId, userId),
        ),
      );
    const total = Number(rows[0]?.total ?? 0);
    if (!Number.isFinite(total)) return null;
    return total;
  } catch (err) {
    note(err, "read");
    return null;
  }
}

export async function readPeriodSpendUsd(): Promise<number | null> {
  try {
    const { db, aiGenerations } = await import("@workspace/db");
    const { gte, sql } = await import("drizzle-orm");
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${aiGenerations.costUsd}), 0)` })
      .from(aiGenerations)
      .where(gte(aiGenerations.createdAt, currentPeriodStart()));
    const total = Number(rows[0]?.total ?? 0);
    if (!Number.isFinite(total)) return null;
    lastFailure = null;
    return total;
  } catch (err) {
    note(err, "read");
    return null;
  }
}
