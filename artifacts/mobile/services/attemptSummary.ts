/**
 * What the class dashboard may count, and what it must name separately.
 *
 * Split out of the results screen so the rule can be tested: there are no
 * screen tests, and this is arithmetic a teacher reads as fact.
 *
 * A result row is not the same thing as a finished paper. The deterministic
 * pass writes one as soon as a link submission arrives, scored over the
 * questions it could actually mark — so a student who answered two of eight
 * objective questions gets `3/3 = 100%`, `proficient`, `isProvisional: true`,
 * with six written answers still unmarked. Averaging that in overstates the
 * class, and it overstates it in the direction nobody double-checks. The
 * screen used to filter on "has a result with marks" alone and did exactly
 * that; `isProvisional` is the server's own word for the difference, and this
 * is the one place the client is allowed to read it.
 *
 * Provisional papers are counted rather than dropped: a teacher whose class
 * average covers 1 of 3 papers needs to see that the other two are waiting,
 * not wonder where they went.
 */
import type { AttemptListRow, LevelKey } from './evaluations.ts';

export interface AttemptSummary {
  /** Papers with every question marked — the only ones below the headline. */
  gradedCount: number;
  /** Auto-marked, still awaiting the teacher's hand-marking. */
  provisionalCount: number;
  /** Mean percent over finished papers only, or null when there are none. */
  meanPercent: number | null;
  levelCounts: Record<LevelKey, number>;
}

/** A result scored over no marks measures nothing, whatever its percent says. */
function hasMarks(row: AttemptListRow): boolean {
  return row.result != null && Number(row.result.totalMarks) > 0;
}

export function summariseAttempts(attempts: readonly AttemptListRow[]): AttemptSummary {
  const scored = attempts.filter(hasMarks);
  const graded = scored.filter(a => !a.result!.isProvisional);
  const provisionalCount = scored.length - graded.length;

  const levelCounts: Record<LevelKey, number> = {
    beginner: 0,
    developing: 0,
    proficient: 0,
    advanced: 0,
  };
  for (const a of graded) {
    const level = a.result!.levelKey;
    if (level) levelCounts[level] += 1;
  }

  const meanPercent =
    graded.length === 0
      ? null
      : Math.round((graded.reduce((s, a) => s + Number(a.result!.percent), 0) / graded.length) * 100) / 100;

  return { gradedCount: graded.length, provisionalCount, meanPercent, levelCounts };
}
