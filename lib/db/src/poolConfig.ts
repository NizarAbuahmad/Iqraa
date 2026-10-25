// lib/db/src/poolConfig.ts
//
// Kept apart from index.ts because that file throws at import without a
// DATABASE_URL, which would make this untestable.

export type PoolEnv = Record<string, string | undefined>;

/** pg's own default pool size. Unchanged on purpose: see DB_POOL_MAX below. */
const DEFAULT_MAX = 10;
/**
 * pg's `connectionTimeoutMillis` defaults to 0, meaning wait forever. With
 * Cloud Run admitting 80 concurrent requests onto a pool of 10, a slow or
 * suspended database turned into requests parked until Cloud Run's own 300 s
 * timeout. Ten seconds is long enough for a Neon compute to wake and short
 * enough that a caller gets an answer.
 */
const DEFAULT_CONNECT_TIMEOUT_MS = 10_000;

/** A whole number in [min, max], or `fallback`. Never lets pg see 0 / NaN / negative. */
function intInRange(raw: string | undefined, min: number, max: number, fallback: number): number {
  if (raw === undefined || !/^\d+$/.test(raw.trim())) return fallback;
  const n = Number(raw);
  return n >= min && n <= max ? n : fallback;
}

/**
 * Pool sizing, read from the environment so it can be changed on the Cloud Run
 * service without a code deploy.
 *
 * - `DB_POOL_MAX`: connections per instance (1–100, default 10). The ceiling on
 *   the database is this × the service's max instances (× 2 with RLS on, which
 *   holds a second pool) — check it against Neon's limit before raising it.
 * - `DB_SYSTEM_POOL_MAX`: size of the owner pool that exists only when
 *   `RLS_ENFORCE=on`. Defaults to `DB_POOL_MAX`.
 * - `DB_CONNECT_TIMEOUT_MS`: how long a query may wait for a free connection
 *   (1000–60000, default 10000).
 */
export function poolOptions(
  env: PoolEnv,
  which: "app" | "system" = "app",
): { max: number; connectionTimeoutMillis: number } {
  const appMax = intInRange(env["DB_POOL_MAX"], 1, 100, DEFAULT_MAX);
  const max = which === "system" ? intInRange(env["DB_SYSTEM_POOL_MAX"], 1, 100, appMax) : appMax;
  return {
    max,
    connectionTimeoutMillis: intInRange(env["DB_CONNECT_TIMEOUT_MS"], 1000, 60_000, DEFAULT_CONNECT_TIMEOUT_MS),
  };
}

/**
 * Does this connection string go through Neon's pooler (PgBouncer, transaction
 * mode)? A pooled host has `-pooler` after the endpoint id
 * (`ep-xxx-pooler.region.aws.neon.tech`); a direct one does not.
 *
 * It matters because a direct connection is capped by the compute's
 * `max_connections` (97 usable at 0.25 CU) while the pooler accepts 10,000
 * client connections, and this API can open DB_POOL_MAX per instance across
 * many instances. Only the host is examined, so a password or database name
 * containing "-pooler" does not count, and the string itself is never returned.
 */
export function isPooledConnectionString(connectionString: string | undefined): boolean {
  if (!connectionString) return false;
  try {
    return new URL(connectionString).hostname.includes("-pooler");
  } catch {
    return false;
  }
}
