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

export interface TeachingAssignment {
  gradeId: string;
  subjectIds: string[];
}

/**
 * Keeps only well-formed `{gradeId, subjectIds}` pairs a teacher could
 * plausibly have sent from `/setup-subjects` — the per-grade version of
 * `sanitizeCatalogIds`, used by the same `PATCH /auth/users/profile` route.
 *
 * `gradeId` must be a real grade; `subjectIds` is narrowed the same way a
 * flat list is. A grade left with no valid subjects is dropped rather than
 * kept as an empty entry — it is not a real assignment, and keeping it would
 * let a teacher "add" a grade to `gradeIds` (via the derived union the caller
 * computes from this) with nothing behind it. Two entries for the same grade
 * are merged rather than kept as duplicates, so the client cannot send two
 * rows that quietly clobber each other once the caller derives the flat
 * `gradeIds`/`subjectIds` columns from this array.
 *
 * Same `undefined`-for-"not sent" contract as `sanitizeCatalogIds`, so the
 * caller can leave the column untouched when the field is absent.
 */
export function sanitizeTeachingAssignments(
  raw: unknown,
  validGrades: ReadonlySet<string>,
  validSubjects: ReadonlySet<string>,
): TeachingAssignment[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const byGrade = new Map<string, Set<string>>();
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const { gradeId, subjectIds } = entry as { gradeId?: unknown; subjectIds?: unknown };
    if (typeof gradeId !== "string" || !validGrades.has(gradeId)) continue;
    const subjects = sanitizeCatalogIds(subjectIds, validSubjects);
    if (!subjects?.length) continue;
    const existing = byGrade.get(gradeId) ?? new Set<string>();
    for (const id of subjects) existing.add(id);
    byGrade.set(gradeId, existing);
  }
  return [...byGrade.entries()].map(([gradeId, subjectIds]) => ({ gradeId, subjectIds: [...subjectIds] }));
}
