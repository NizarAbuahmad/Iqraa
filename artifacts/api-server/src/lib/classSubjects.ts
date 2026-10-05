/**
 * A class's subjects: `subjectIds` is the list, `subjectId` its first entry.
 *
 * A Grade 1–3 class teacher teaches one section several subjects, so one
 * subject per class meant one roster per subject. The single column stays as
 * the primary subject because teaching plans and the parent letter read it.
 *
 * Rows written before `subject_ids` existed have `[]` there and a value in
 * `subject_id`. Rather than a backfill (nothing runs migrations for us — see
 * docs/deploying.md), every response passes through `withSubjectIds`, which
 * reads such a row as a one-subject list.
 */

/** No school timetable has a section taking more subjects than this; it bounds a jsonb column a client fills. */
const MAX_SUBJECTS = 20;

/** Trimmed, non-empty, unique strings, or undefined when `raw` is not an array at all. */
export function parseSubjectIds(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: string[] = [];
  for (const v of raw) {
    if (typeof v !== "string") continue;
    const id = v.trim();
    if (id && !out.includes(id)) out.push(id);
    if (out.length >= MAX_SUBJECTS) break;
  }
  return out;
}

/**
 * The two columns to write from a request body, or undefined when the body
 * says nothing about subjects (a PATCH renaming the class must not clear them).
 * `subjectIds` wins; a client that only knows `subjectId` still works and gets
 * a one-subject list.
 */
export function subjectColumns(body: unknown): { subjectId: string; subjectIds: string[] } | undefined {
  const b = (body ?? {}) as Record<string, unknown>;
  const list = parseSubjectIds(b["subjectIds"]);
  if (list) return { subjectId: list[0] ?? "", subjectIds: list };
  if (b["subjectId"] === undefined) return undefined;
  const single = typeof b["subjectId"] === "string" ? b["subjectId"].trim() : "";
  return { subjectId: single, subjectIds: single ? [single] : [] };
}

/** The class row as clients see it: `subjectIds` always present and never empty while `subjectId` is set. */
export function withSubjectIds<T extends { subjectId?: string | null; subjectIds?: unknown }>(
  row: T,
): Omit<T, "subjectIds"> & { subjectIds: string[] } {
  const list = parseSubjectIds(row.subjectIds) ?? [];
  return { ...row, subjectIds: list.length ? list : row.subjectId ? [row.subjectId] : [] };
}
