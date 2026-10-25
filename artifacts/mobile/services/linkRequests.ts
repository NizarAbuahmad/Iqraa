/**
 * Join requests as a teacher reads them. Pure helpers for
 * `components/classes/LinkRequestsBanner.tsx`, kept free of React Native so
 * `node --test` can load them.
 */

/** How many waiting requests ask for this roster name (`students.id`). */
export function competingCount(requests: readonly { studentId: string }[], studentId: string): number {
  let n = 0;
  for (const r of requests) if (r.studentId === studentId) n += 1;
  return n;
}

/** The count to warn with, or 0 when this name has a single request and nothing competes. */
export function competingWarning(requests: readonly { studentId: string }[], studentId: string): number {
  const n = competingCount(requests, studentId);
  return n >= 2 ? n : 0;
}
