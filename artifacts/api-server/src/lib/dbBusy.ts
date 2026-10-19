/**
 * Did this fail because no database connection came free in time?
 *
 * pg raises a bare `Error("timeout exceeded when trying to connect")` when a
 * query waits longer than `connectionTimeoutMillis` for a pooled connection
 * (lib/db/src/poolConfig.ts). It has no `code`, so the message is all there is
 * to go on. Drizzle wraps query errors, so the cause chain is followed too.
 *
 * It is the one database failure that says "come back in a moment" rather than
 * "this request is wrong", which is why the error handler answers it 503 with a
 * Retry-After instead of a 500.
 */
export function isPoolExhausted(err: unknown): boolean {
  const seen = new Set<unknown>();
  let cur: unknown = err;
  while (cur instanceof Error && !seen.has(cur)) {
    if (cur.message.includes("timeout exceeded when trying to connect")) return true;
    seen.add(cur);
    cur = cur.cause;
  }
  return false;
}

/**
 * The answer for "no connection came free": 503, a Retry-After, a stable code.
 *
 * It must not be a 401. The auth middleware used to answer a failed user lookup
 * with 401, and the client reads a 401 as "my token is stale": it calls
 * /auth/refresh and retries, so an overloaded pool got two more database round
 * trips per request from every signed-in client, precisely when it had none to
 * spare. The client leaves a 503 alone.
 */
export function sendDbBusy(res: { setHeader(n: string, v: string): unknown; status(c: number): { json(b: unknown): unknown } }): void {
  res.setHeader("Retry-After", "2");
  res.status(503).json({ error: "The service is busy. Please try again in a moment.", code: "db_busy" });
}
