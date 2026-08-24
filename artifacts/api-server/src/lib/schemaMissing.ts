/**
 * Detects "this database never got the schema push".
 *
 * Tables and columns are created by `pnpm --filter @workspace/db run push`,
 * which is a manual step — no deploy runs it. An environment missing that push
 * answers every query with Postgres 42P01 (undefined_table) or 42703
 * (undefined_column), and a generic 500 turns that into "Failed to save item":
 * true, useless, and indistinguishable from a bug in the handler.
 *
 * Lived in roster.ts alone, which is why the roster said so clearly and the
 * workspace didn't. It is one condition, so it gets one detector.
 */

/**
 * Drizzle wraps driver failures in _DrizzleQueryError and hangs the real pg
 * error off `cause`, so the code is never on the object it hands back. Walk the
 * chain; a check against the top level alone silently never matches.
 */
export function isSchemaMissing(err: unknown): boolean {
  for (let cur: unknown = err, depth = 0; cur && depth < 5; depth++) {
    const code = (cur as { code?: unknown }).code;
    if (code === "42P01" || code === "42703") return true;
    cur = (cur as { cause?: unknown }).cause;
  }
  return false;
}
