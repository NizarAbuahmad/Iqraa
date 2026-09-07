/**
 * What the class dashboard is allowed to count.
 *
 * The distinction that matters is between a paper that is *finished* and one
 * the deterministic pass has merely touched. A link submission comes back with
 * only its objective questions marked, and its result row is scored over those
 * questions alone — so a student who answered two of eight can sit at 100% and
 * `proficient` while six questions are still unmarked. Folding that into the
 * headline average or the level histogram overstates the class, in the one
 * direction a teacher will not think to question.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { summariseAttempts } from '../attemptSummary.ts';
import type { AttemptListRow, LevelKey } from '../evaluations.ts';

function attempt(
  over: { percent?: number; level?: LevelKey; provisional?: boolean; total?: number } | null,
): AttemptListRow {
  if (over === null) return { id: Math.random().toString(36), result: null } as unknown as AttemptListRow;
  return {
    id: Math.random().toString(36),
    result: {
      percent: String(over.percent ?? 0),
      totalMarks: String(over.total ?? 10),
      levelKey: over.level ?? 'beginner',
      isProvisional: over.provisional ?? false,
    },
  } as unknown as AttemptListRow;
}

const finished = (percent: number, level: LevelKey) => attempt({ percent, level, provisional: false });
const partial = (percent: number, level: LevelKey) => attempt({ percent, level, provisional: true });
const notStarted = () => attempt(null);

describe('summariseAttempts', () => {
  it('keeps a provisional result out of the class average', () => {
    const s = summariseAttempts([finished(40, 'beginner'), partial(100, 'proficient')]);
    assert.equal(s.meanPercent, 40);
  });

  it('keeps a provisional result out of the level histogram', () => {
    const s = summariseAttempts([finished(40, 'beginner'), partial(100, 'proficient')]);
    assert.equal(s.levelCounts.proficient, 0);
    assert.equal(s.levelCounts.beginner, 1);
  });

  it('counts partly-marked papers on their own, rather than hiding them', () => {
    const s = summariseAttempts([finished(40, 'beginner'), partial(100, 'proficient'), partial(90, 'advanced')]);
    assert.equal(s.gradedCount, 1);
    assert.equal(s.provisionalCount, 2);
  });

  it('reports no average when every paper is still provisional', () => {
    const s = summariseAttempts([partial(100, 'proficient'), partial(80, 'proficient')]);
    assert.equal(s.meanPercent, null);
    assert.equal(s.gradedCount, 0);
  });

  it('ignores an attempt that was never started', () => {
    const s = summariseAttempts([finished(50, 'developing'), notStarted()]);
    assert.equal(s.gradedCount, 1);
    assert.equal(s.provisionalCount, 0);
    assert.equal(s.meanPercent, 50);
  });

  it('ignores a result scored over no marks at all', () => {
    const s = summariseAttempts([finished(60, 'developing'), attempt({ percent: 100, total: 0 })]);
    assert.equal(s.gradedCount, 1);
    assert.equal(s.meanPercent, 60);
  });

  it('averages the finished papers to two decimal places', () => {
    const s = summariseAttempts([finished(43.75, 'beginner'), finished(50, 'developing'), finished(60, 'developing')]);
    assert.equal(s.meanPercent, 51.25);
  });

  it('does not count a provisional paper as graded even when it has a level', () => {
    const s = summariseAttempts([partial(100, 'proficient')]);
    assert.deepEqual(s.levelCounts, { beginner: 0, developing: 0, proficient: 0, advanced: 0 });
  });
});
