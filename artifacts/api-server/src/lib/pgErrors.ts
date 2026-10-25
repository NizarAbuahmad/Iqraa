/**
 * Postgres error checks that survive drizzle's wrapping.
 *
 * drizzle-orm 0.45 rethrows every driver error as a DrizzleQueryError whose
 * `cause` is the pg error, so the SQLSTATE is on `err.cause.code` and
 * `err.code` is undefined. A raw `pg` pool query throws the pg error itself.
 * Check both: a bare `err.code === "23505"` silently stopped matching and
 * turned every handled duplicate into a 500.
 */
export function isUniqueViolation(err: unknown): boolean {
  const e = err as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "23505" || e?.cause?.code === "23505";
}
