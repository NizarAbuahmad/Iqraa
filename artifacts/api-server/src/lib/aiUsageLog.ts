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
  /** The `ai_artifacts` row served or written. Set on hits and misses alike —
   *  it is what makes these rows a per-teacher serve log, which is what
   *  regeneration reads to find a variant this teacher has not seen. */
  artifactId?: string | null;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  /** Wall time of the model call, when the caller timed it. */
  durationMs?: number | null;
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
export function recordGeneration(row: GenerationRecord): Promise<void> {
  // Tracked so `releaseUserSpend` can wait for it: callers fire this and move
  // on, and a reservation dropped before its real cost lands would open a
  // window where neither is counted.
  const write = insertGeneration(row);
  pendingWrites.add(write);
  void write.finally(() => pendingWrites.delete(write));
  return write;
}

/** Ledger inserts still in flight. Never rejects — `insertGeneration` doesn't. */
const pendingWrites = new Set<Promise<void>>();

async function insertGeneration(row: GenerationRecord): Promise<void> {
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
      artifactId: row.artifactId ?? null,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      costUsd: row.costUsd.toFixed(6),
      durationMs: row.durationMs ?? null,
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

/**
 * How long a reservation counts if nobody releases it — a crashed instance, a
 * killed request. Longer than any model call can run (120 s × 2 attempts inside
 * Cloud Run's 300 s request timeout), short enough that a lost row only holds
 * a teacher's allowance for minutes.
 */
const RESERVATION_TTL = "10 minutes";

export type UserSpendReservation =
  | { ok: true; id: string }
  | { ok: false; committedUsd: number };

/**
 * Check this user's allowance and hold `estimateUsd` against it, as one step.
 *
 * The check used to be a read of `ai_generations`, which only learns about a
 * call once it has finished — so fifteen parallel requests all read the same
 * total and all passed. Here the read and the hold happen under a per-user
 * advisory lock: the second request waits for the first to insert its
 * reservation, and then counts it.
 *
 * Refuses when spend plus live reservations has reached the limit, not when
 * the new estimate would cross it — the same "one call may finish over" rule
 * the old check had, so a teacher with a few cents left can still make the
 * one call they could make before. What changes is that parallel calls can
 * no longer all claim the same headroom.
 *
 * Returns null when the ledger cannot be reached. Callers treat that as
 * "unknown" and do not block, exactly like `readUserPeriodSpendUsd`.
 */
export async function reserveUserSpend(
  userId: string,
  limitUsd: number,
  estimateUsd: number,
): Promise<UserSpendReservation | null> {
  try {
    const { db, aiGenerations, aiSpendReservations } = await import("@workspace/db");
    const { and, eq, gte, lt, sql } = await import("drizzle-orm");
    return await db.transaction(async tx => {
      // Transaction-scoped: released at commit, so it is held for three short
      // statements, never across the model call.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`ai-user-spend:${userId}`}))`);
      // Sweep this user's abandoned holds rather than let them count forever.
      await tx
        .delete(aiSpendReservations)
        .where(and(
          eq(aiSpendReservations.userId, userId),
          lt(aiSpendReservations.createdAt, sql`now() - ${RESERVATION_TTL}::interval`),
        ));
      const [spent] = await tx
        .select({ total: sql<string>`coalesce(sum(${aiGenerations.costUsd}), 0)` })
        .from(aiGenerations)
        .where(and(gte(aiGenerations.createdAt, currentPeriodStart()), eq(aiGenerations.userId, userId)));
      const [held] = await tx
        .select({ total: sql<string>`coalesce(sum(${aiSpendReservations.costUsd}), 0)` })
        .from(aiSpendReservations)
        .where(eq(aiSpendReservations.userId, userId));
      const committedUsd = Number(spent?.total ?? 0) + Number(held?.total ?? 0);
      if (!Number.isFinite(committedUsd)) throw new Error("ai spend total is not a number");
      if (committedUsd >= limitUsd) return { ok: false as const, committedUsd };
      const [row] = await tx
        .insert(aiSpendReservations)
        .values({ userId, costUsd: Math.max(0, estimateUsd).toFixed(6) })
        .returning({ id: aiSpendReservations.id });
      return { ok: true as const, id: row!.id };
    });
  } catch (err) {
    note(err, "read");
    return null;
  }
}

/**
 * Drop a reservation once the call it covered has been settled.
 *
 * Waits for ledger inserts already in flight first: the real cost is written
 * fire-and-forget by `recordUsage`, and deleting the hold before that row
 * lands would leave a moment where the call counts as nothing. Never throws —
 * a hold that fails to delete expires after `RESERVATION_TTL`.
 */
export async function releaseUserSpend(id: string): Promise<void> {
  await Promise.all([...pendingWrites]);
  try {
    const { db, aiSpendReservations } = await import("@workspace/db");
    const { eq } = await import("drizzle-orm");
    await db.delete(aiSpendReservations).where(eq(aiSpendReservations.id, id));
  } catch (err) {
    logger.warn({ err }, "ai spend reservation could not be released — it expires on its own");
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
