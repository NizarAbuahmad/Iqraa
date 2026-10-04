/**
 * Which curriculum grades a student account belongs to, for the screens that
 * open on a grade: the library and the curriculum browser used to start on
 * the first grade in the catalog, so a Grade 9 student opened Grade 10.
 *
 * A grade can be set on the student's own roster row or only on the class
 * they sit in; the row's own wins, because a teacher who set it on the child
 * said something more specific than the class did. Empty ids are dropped,
 * duplicates collapse, and the order is the order of first appearance so the
 * screen can take the first as its default.
 */
export function studentGradeIds(rows: ReadonlyArray<{ studentGradeId: string; classGradeId: string | null }>): string[] {
  const out: string[] = [];
  for (const row of rows) {
    const id = row.studentGradeId.trim() || (row.classGradeId ?? "").trim();
    if (id && !out.includes(id)) out.push(id);
  }
  return out;
}
