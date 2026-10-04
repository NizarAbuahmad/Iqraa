/**
 * What a direct chat row can say about the other person beyond their role:
 * which students connect the two of them.
 *
 * A direct thread stores only its two user ids, so «معلم · وليّ أمر» was all an
 * inbox could show. The connection already exists in the roster — a parent or
 * student is linked (`roster_links`) to a student a teacher owns
 * (`students.teacherId`), and `isConnected` in routes/messaging.ts is what lets
 * the thread exist at all. This turns those same rows into names.
 *
 * Pure and import-free so `node --test` can load it without a database.
 */

export interface LinkedStudentRow {
  teacherId: string;
  /** The parent or student account linked to the roster student. */
  userId: string;
  studentName: string;
}

/** Order matters: teacher first, so the key never depends on who is viewing. */
export function pairKey(teacherId: string, userId: string): string {
  return `${teacherId}:${userId}`;
}

/** Student names per (teacher, linked user) pair, in first-seen order and without repeats. */
export function studentNamesByPair(rows: LinkedStudentRow[]): Map<string, string[]> {
  const byPair = new Map<string, string[]>();
  for (const row of rows) {
    const name = row.studentName.trim();
    if (!name) continue;
    const key = pairKey(row.teacherId, row.userId);
    const names = byPair.get(key);
    if (!names) byPair.set(key, [name]);
    else if (!names.includes(name)) names.push(name);
  }
  return byPair;
}
