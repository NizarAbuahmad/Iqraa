/**
 * The shared counter behind createRateLimiter.
 *
 * Postgres rather than Redis because Postgres is already here. A limiter needs
 * a counter every instance can see; Neon is that, and adding Redis would mean
 * a new managed service and a new failure mode for a table with three columns.
 *
 * `@workspace/db` is imported lazily inside the calls, not at module scope. It
 * throws on import when DATABASE_URL is unset, so a top-level import would make
 * every module reaching this one unloadable under `node --test` — the reason
 * `routes/auth.ts` has no unit tests. Keeping it inside the function is what
 * lets rateLimit.ts stay testable, and the import is cached after the first
 * call.
 */
import { logger } from "./logger.ts";

export type RateLimitHit = { count: number; resetAt: Date };

export interface RateLimitStore {
  /** Count this request against `key` and return the running total for the window. */
  hit(key: string, windowMs: number): Promise<RateLimitHit>;
}

async function loadDb() {
  const [{ db, rateLimitBuckets }, { sql }] = await Promise.all([
    import("@workspace/db"),
    import("drizzle-orm"),
  ]);
  return { db, rateLimitBuckets, sql };
}

/**
 * One statement, not read-then-write.
 *
 * `SELECT` then `UPDATE` from several instances at once is a lost-update race:
 * two containers read count=9, both write 10, and the eleventh request through
 * a ten-request limit is allowed. That failure would be *worse* than the
 * per-instance bucket it replaces, because it still looks correct in every
 * single-process test. `INSERT ... ON CONFLICT DO UPDATE` takes a row lock, so
 * concurrent callers serialise on it and no increment is lost.
 *
 * Windows are measured against the database clock (`now()`), never the
 * container's: instances share no wall clock, and a skewed one would hand out
 * a fresh allowance early.
 */
export const pgRateLimitStore: RateLimitStore = {
  async hit(key: string, windowMs: number): Promise<RateLimitHit> {
    const { db, rateLimitBuckets, sql } = await loadDb();
    const windowSecs = windowMs / 1000;
    const windowEnd = sql`now() + make_interval(secs => ${windowSecs})`;
    const isExpired = sql`${rateLimitBuckets.resetAt} <= now()`;

    const [row] = await db
      .insert(rateLimitBuckets)
      .values({ key, count: 1, resetAt: windowEnd })
      .onConflictDoUpdate({
        target: rateLimitBuckets.key,
        set: {
          count: sql`CASE WHEN ${isExpired} THEN 1 ELSE ${rateLimitBuckets.count} + 1 END`,
          resetAt: sql`CASE WHEN ${isExpired} THEN ${windowEnd} ELSE ${rateLimitBuckets.resetAt} END`,
        },
      })
      .returning({ count: rateLimitBuckets.count, resetAt: rateLimitBuckets.resetAt });

    if (!row) throw new Error("rate limit upsert returned no row");

    maybePrune();
    return { count: row.count, resetAt: row.resetAt };
  },
};

/**
 * Expired rows are reused rather than read, so a stale one is harmless — but
 * the table still grows by a row per distinct caller ever seen. Sweeping on a
 * small fraction of requests keeps it bounded without a scheduler.
 *
 * ponytail: probabilistic, fire-and-forget, and generous about what counts as
 * old. If the table ever grows enough to matter, move this to a scheduled job
 * rather than raising the probability — sweeping more often on the request
 * path is the wrong direction.
 */
const PRUNE_PROBABILITY = 0.01;
const PRUNE_AGE_HOURS = 24;

function maybePrune(): void {
  if (Math.random() >= PRUNE_PROBABILITY) return;
  void (async () => {
    try {
      const { db, rateLimitBuckets, sql } = await loadDb();
      await db.delete(rateLimitBuckets).where(
        sql`${rateLimitBuckets.resetAt} < now() - make_interval(hours => ${PRUNE_AGE_HOURS})`,
      );
    } catch (err) {
      // Never surfaced to the caller: a failed sweep costs disk, not correctness.
      logger.warn({ err }, "rate limit bucket prune failed");
    }
  })();
}
