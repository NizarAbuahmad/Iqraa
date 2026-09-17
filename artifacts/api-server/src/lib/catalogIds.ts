/**
 * Keeps only catalog ids (GRADES/SUBJECTS from `@workspace/curriculum`) the
 * client could plausibly have sent, deduped — used by `PATCH
 * /auth/users/profile` when a teacher picks or edits what they teach.
 *
 * Returns `undefined` rather than `[]` for anything that isn't an array
 * (missing field, wrong type) so the caller can tell "not sent" from
 * "sent as an empty selection" and leave the column untouched in the former
 * case. A bogus id inside an array is silently dropped rather than rejecting
 * the whole request — the picker screen only ever sends catalog ids, so a
 * mismatch here means the catalog moved on since the client shipped, not a
 * malicious payload worth failing loudly over.
 */
export function sanitizeCatalogIds(raw: unknown, valid: ReadonlySet<string>): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && valid.has(id)))];
}
