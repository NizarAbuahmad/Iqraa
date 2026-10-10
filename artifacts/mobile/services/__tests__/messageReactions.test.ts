/**
 * What this guards: the optimistic reaction update. A tap must feel instant, so
 * the app predicts what the server will answer — and the prediction has to be
 * the same rule the server applies (one reaction per person: tapping your own
 * removes it, tapping another moves it).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { REACTION_EMOJI, myReaction, toggleReaction, type ChatReaction } from '../messageReactions.ts';

const chip = (emoji: string, count: number, mine = false, userIds?: string[]): ChatReaction =>
  userIds ? { emoji, count, mine, userIds } : { emoji, count, mine };

describe('toggleReaction', () => {
  it('adds a first reaction', () => {
    assert.deepEqual(toggleReaction([], '👍'), [chip('👍', 1, true)]);
  });

  it('joins an emoji others already used', () => {
    assert.deepEqual(toggleReaction([chip('👍', 2)], '👍'), [chip('👍', 3, true)]);
  });

  it('removes your own when you tap it again, dropping a chip that reaches zero', () => {
    assert.deepEqual(toggleReaction([chip('👍', 1, true)], '👍'), []);
    assert.deepEqual(toggleReaction([chip('👍', 3, true)], '👍'), [chip('👍', 2)]);
  });

  it('moves your mark when you tap a different emoji', () => {
    const out = toggleReaction([chip('👍', 1, true), chip('🙏', 2)], '🙏');
    assert.deepEqual(out, [chip('🙏', 3, true)]);
  });

  it('keeps chips in the fixed emoji order, not the order they were added', () => {
    const out = toggleReaction([chip('🙏', 1)], '👍');
    assert.deepEqual(out.map(c => c.emoji), ['👍', '🙏']);
    assert.deepEqual(REACTION_EMOJI.slice(0, 1), ['👍']);
  });

  it('keeps userIds in step for a teacher, when told who is tapping', () => {
    const out = toggleReaction([chip('👍', 2, true, ['me', 'x'])], '😂', 'me');
    assert.deepEqual(out, [chip('👍', 1, false, ['x']), chip('😂', 1, true, ['me'])]);
  });

  it('never mutates its input', () => {
    const input = [chip('👍', 1, true, ['me'])];
    const snapshot = JSON.parse(JSON.stringify(input));
    toggleReaction(input, '🙏', 'me');
    assert.deepEqual(input, snapshot);
  });
});

describe('myReaction', () => {
  it('finds the viewer\'s own emoji, or null', () => {
    assert.equal(myReaction([chip('👍', 1), chip('🙏', 1, true)]), '🙏');
    assert.equal(myReaction([chip('👍', 1)]), null);
    assert.equal(myReaction(undefined), null);
  });
});
