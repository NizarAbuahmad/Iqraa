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
  isAwarded,
  podium,
  resetScores,
  setAwards,
  standings,
  streakBonus,
  toggleAward,
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
