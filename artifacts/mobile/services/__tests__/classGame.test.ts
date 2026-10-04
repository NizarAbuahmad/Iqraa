/**
 * Class Challenge scoring tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/classGame.test.ts
 *
 * The engine's whole design claim is that scores are *derived* from an award
 * ledger rather than accumulated, so these tests exist mainly to hold that
 * claim: a mis-tap must be exactly reversible, including its streak bonus.
 *
 * Covers:
 *  1. Awarding credits base points; un-awarding returns the score to zero.
 *  2. Streak bonuses apply on consecutive correct answers and reset on a miss.
 *  3. Un-awarding a mid-streak question re-folds the bonuses of later questions
 *     rather than leaving them stranded — the case an incremental score gets
 *     wrong.
 *  4. Skipped questions (nobody awarded) do not break a streak.
 *  5. Ties share a rank and the next rank skips.
 *  6. A game with no awards has an empty podium, not an arbitrary winner.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BASE_POINTS,
  createGame,
  hasGameScores,
  isAwarded,
  isNobody,
  medalFor,
  podium,
  resetScores,
  setAwards,
  standings,
  streakBonus,
  toggleAward,
  toggleNobody,
} from '../classGame.ts';

const scoreOf = (state: ReturnType<typeof createGame>, teamId: string) =>
  standings(state).find(t => t.id === teamId)!.score;

describe('createGame', () => {
  it('clamps the team count into the supported range', () => {
    assert.equal(createGame(1, 5, true).teams.length, 2);
    assert.equal(createGame(99, 5, true).teams.length, 6);
    assert.equal(createGame(4, 5, true).teams.length, 4);
  });

  it('names teams in the active language', () => {
    assert.equal(createGame(2, 5, true).teams[0].name, 'النسور');
    assert.equal(createGame(2, 5, false).teams[0].name, 'Eagles');
  });

  it('starts every team on zero', () => {
    const state = createGame(4, 5, true);
    assert.ok(standings(state).every(t => t.score === 0 && t.correctCount === 0));
  });
});

describe('awarding', () => {
  it('credits base points for a single correct answer', () => {
    const state = toggleAward(createGame(3, 5, true), 0, 'team-1');
    assert.equal(scoreOf(state, 'team-1'), BASE_POINTS);
    assert.equal(scoreOf(state, 'team-2'), 0);
  });

  it('is exactly reversible — the mis-tap case', () => {
    const start = createGame(3, 5, true);
    const awarded = toggleAward(start, 0, 'team-1');
    const undone = toggleAward(awarded, 0, 'team-1');
    assert.equal(scoreOf(undone, 'team-1'), 0);
    assert.deepEqual(undone.awards, {});
  });

  it('credits several teams on the same question', () => {
    let state = createGame(3, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 0, 'team-3');
    assert.equal(scoreOf(state, 'team-1'), BASE_POINTS);
    assert.equal(scoreOf(state, 'team-3'), BASE_POINTS);
    assert.equal(scoreOf(state, 'team-2'), 0);
  });

  it('setAwards replaces rather than merges, and clears on empty', () => {
    let state = setAwards(createGame(3, 5, true), 0, ['team-1', 'team-2']);
    assert.ok(isAwarded(state, 0, 'team-2'));
    state = setAwards(state, 0, ['team-3']);
    assert.equal(isAwarded(state, 0, 'team-2'), false);
    state = setAwards(state, 0, []);
    assert.deepEqual(state.awards, {});
  });
});

describe('streaks', () => {
  it('pays a bonus on the second and third consecutive answer', () => {
    assert.equal(streakBonus(1), 0);
    assert.equal(streakBonus(2), 50);
    assert.equal(streakBonus(3), 100);
    // Capped — an uncapped streak makes the leader unreachable.
    assert.equal(streakBonus(9), 100);
  });

  it('accumulates across consecutive questions', () => {
    let state = createGame(2, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    state = toggleAward(state, 2, 'team-1');
    // 100 + (100+50) + (100+100)
    assert.equal(scoreOf(state, 'team-1'), 450);
  });

  it('resets when an adjudicated question goes to someone else', () => {
    let state = createGame(2, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    state = toggleAward(state, 2, 'team-2'); // team-1 misses
    state = toggleAward(state, 3, 'team-1'); // run starts over
    // 100 + 150 + 0 + 100
    assert.equal(scoreOf(state, 'team-1'), 350);
    assert.equal(standings(state).find(t => t.id === 'team-1')!.streak, 1);
  });

  it('does not break a streak on a question nobody was awarded', () => {
    let state = createGame(2, 5, true);
    state = toggleAward(state, 0, 'team-1');
    // Question 1 is discussed but never scored — no award recorded at all.
    state = toggleAward(state, 2, 'team-1');
    // The run survives the skip: 100 + (100+50)
    assert.equal(scoreOf(state, 'team-1'), 250);
  });

  it('re-folds later bonuses when a mid-streak award moves to another team', () => {
    let state = createGame(2, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    state = toggleAward(state, 2, 'team-1');
    assert.equal(scoreOf(state, 'team-1'), 450);

    // Teacher corrects question 1: it was team-2's, not team-1's. An
    // incrementally-maintained score would subtract team-1's 150 and leave
    // 300, stranding the bonus that question 2 only earned because of the run.
    // Re-folding gives the right answer: two isolated correct answers, 200.
    state = setAwards(state, 1, ['team-2']);
    assert.equal(scoreOf(state, 'team-1'), 200);
    assert.equal(scoreOf(state, 'team-2'), BASE_POINTS);
  });

  it('treats a fully-undone question as never adjudicated, so the run survives', () => {
    let state = createGame(2, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    state = toggleAward(state, 2, 'team-1');
    // Undoing the only award on question 1 leaves nobody credited there, which
    // is indistinguishable from — and treated as — a question the teacher
    // discussed without scoring. The run therefore continues: 100 + 150.
    state = toggleAward(state, 1, 'team-1');
    assert.equal(scoreOf(state, 'team-1'), 250);
  });
});

describe('standings', () => {
  it('ranks by score, then accuracy, then setup order', () => {
    let state = createGame(3, 5, true);
    state = toggleAward(state, 0, 'team-2');
    state = toggleAward(state, 1, 'team-2');
    state = toggleAward(state, 0, 'team-3');
    const rows = standings(state);
    assert.equal(rows[0].id, 'team-2');
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].id, 'team-3');
  });

  it('gives tied teams the same rank and skips the next', () => {
    let state = createGame(3, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 0, 'team-2');
    const rows = standings(state);
    assert.equal(rows.find(r => r.id === 'team-1')!.rank, 1);
    assert.equal(rows.find(r => r.id === 'team-2')!.rank, 1);
    // Third place, not second — two teams already occupy first.
    assert.equal(rows.find(r => r.id === 'team-3')!.rank, 3);
  });

  it('breaks ties by setup order, never by name', () => {
    let state = createGame(3, 5, true);
    state = toggleAward(state, 0, 'team-3');
    state = toggleAward(state, 0, 'team-2');
    const rows = standings(state);
    // team-2 is created before team-3, so it leads an equal-score tie.
    assert.equal(rows[0].id, 'team-2');
    assert.equal(rows[1].id, 'team-3');
  });
});

describe('podium', () => {
  it('groups the top three ranks', () => {
    let state = createGame(4, 5, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    state = toggleAward(state, 2, 'team-2');
    state = setAwards(state, 3, ['team-3']);
    const groups = podium(state);
    assert.equal(groups[0][0].id, 'team-1');
    assert.ok(groups.length >= 2);
  });

  it('is empty when nobody scored — never crowns an arbitrary team', () => {
    assert.deepEqual(podium(createGame(4, 5, true)), []);
  });
});

describe('medalFor', () => {
  it('is the medal of a RANK, not of a position in the list', () => {
    assert.equal(medalFor(1, true), '🥇');
    assert.equal(medalFor(2, true), '🥈');
    assert.equal(medalFor(3, true), '🥉');
    assert.equal(medalFor(4, true), null);
  });

  it('hands out none before anyone has scored — everybody is "first" at 0', () => {
    assert.equal(medalFor(1, false), null);
  });

  it('a team that follows a tie for first gets third place, not second', () => {
    // Two teams tie on top, a third trails: ranks are 1, 1, 3 — there is no
    // rank 2. The podium used to medal groups by position, so the trailing
    // team stood on the silver step.
    let state = createGame(4, 5, true);
    state = setAwards(state, 0, ['team-1', 'team-2']);
    state = setAwards(state, 1, ['team-1', 'team-2']);
    state = setAwards(state, 3, ['team-3']);
    const groups = podium(state);
    assert.deepEqual(groups.map(g => g[0]!.rank), [1, 3]);
    assert.deepEqual(groups.map(g => medalFor(g[0]!.rank, true)), ['🥇', '🥉']);
  });
});

describe('a question nobody got right', () => {
  // The review's case: team 1 is right on Q0, Q1 and Q3. Q2 is the question
  // that breaks its run — whether or not any OTHER team got it.
  const teamOneRight = (extra: (s: ReturnType<typeof createGame>) => ReturnType<typeof createGame>) => {
    let state = createGame(3, 4, true);
    for (const q of [0, 1, 3]) state = toggleAward(state, q, 'team-1');
    return scoreOf(extra(state), 'team-1');
  };

  it('breaks a streak exactly as when another team got it — the score cannot depend on the other teams', () => {
    const otherTeamGotIt = teamOneRight(s => toggleAward(s, 2, 'team-2'));
    const nobodyGotIt = teamOneRight(s => toggleNobody(s, 2));
    assert.equal(nobodyGotIt, otherTeamGotIt);
    // 100 + 150 (run of 2) + 100 (run restarted) — not 450.
    assert.equal(nobodyGotIt, 350);
  });

  it('is unchanged for a question the teacher never adjudicated: skipping does not break a run', () => {
    assert.equal(teamOneRight(s => s), 450);
  });

  it('is exactly reversible — a second press takes it back', () => {
    const marked = toggleNobody(createGame(3, 4, true), 2);
    assert.equal(isNobody(marked, 2), true);
    const undone = toggleNobody(marked, 2);
    assert.equal(isNobody(undone, 2), false);
    assert.deepEqual(undone.settled, []);
  });

  it('replaces any awards on that question', () => {
    let state = toggleAward(createGame(3, 4, true), 2, 'team-1');
    state = toggleNobody(state, 2);
    assert.equal(isAwarded(state, 2, 'team-1'), false);
    assert.equal(isNobody(state, 2), true);
    assert.equal(scoreOf(state, 'team-1'), 0);
  });

  it('is cleared the moment a team is credited, and a later un-credit does not restore it', () => {
    let state = toggleNobody(createGame(3, 4, true), 2);
    state = toggleAward(state, 2, 'team-1');
    assert.equal(isNobody(state, 2), false);
    state = toggleAward(state, 2, 'team-1');
    // Back to "not adjudicated", not silently back to "nobody got it".
    assert.equal(isNobody(state, 2), false);
    assert.deepEqual(state.settled, []);
  });

  it('is cleared by setAwards too ("everyone got it")', () => {
    const state = setAwards(toggleNobody(createGame(3, 4, true), 1), 1, ['team-1', 'team-2', 'team-3']);
    assert.equal(isNobody(state, 1), false);
  });

  it('awards no points and does not count as a score on its own', () => {
    const state = toggleNobody(createGame(3, 4, true), 0);
    assert.equal(standings(state).every(t => t.score === 0 && t.correctCount === 0), true);
    assert.equal(hasGameScores(state), false);
    assert.deepEqual(podium(state), []);
  });

  it('resets with the rest of the ledger', () => {
    const state = resetScores(toggleNobody(createGame(3, 4, true), 0));
    assert.deepEqual(state.settled, []);
  });

  it('a live streak is broken at once, so the 🔥 on the strip goes out', () => {
    let state = createGame(2, 4, true);
    state = toggleAward(state, 0, 'team-1');
    state = toggleAward(state, 1, 'team-1');
    assert.equal(standings(state).find(t => t.id === 'team-1')!.streak, 2);
    state = toggleNobody(state, 2);
    assert.equal(standings(state).find(t => t.id === 'team-1')!.streak, 0);
  });
});

describe('hasGameScores', () => {
  it('is false for a fresh game and after a reset, true once anything is awarded', () => {
    let state = createGame(3, 5, true);
    assert.equal(hasGameScores(state), false);
    state = toggleAward(state, 0, 'team-1');
    assert.equal(hasGameScores(state), true);
    assert.equal(hasGameScores(resetScores(state)), false);
  });

  it('ignores a question whose awards were all taken back', () => {
    let state = toggleAward(createGame(3, 5, true), 0, 'team-1');
    state = toggleAward(state, 0, 'team-1');
    assert.equal(hasGameScores(state), false);
  });
});

describe('resetScores', () => {
  it('clears the ledger but keeps the teams', () => {
    let state = createGame(3, 5, true);
    state = toggleAward(state, 0, 'team-1');
    const reset = resetScores(state);
    assert.deepEqual(reset.awards, {});
    assert.equal(reset.teams.length, 3);
    assert.equal(scoreOf(reset, 'team-1'), 0);
  });
});
