/**
 * `isAnswered` decides two things a student sees: the dot on the progress
 * strip, and the count in "you have N unanswered" before handing in. They read
 * the same function on purpose — a strip that disagrees with the warning is
 * worse than having neither, because the student trusts one and is caught by
 * the other.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAnswered, setBlankAt, setMatchPair } from '../studentAnswers.ts';

describe('isAnswered', () => {
  it('treats an untouched question as unanswered', () => {
    assert.equal(isAnswered(undefined), false);
    assert.equal(isAnswered({}), false);
  });

  it('counts a chosen option, and not an emptied one', () => {
    assert.equal(isAnswered({ optionIds: ['b'] }), true);
    assert.equal(isAnswered({ optionIds: [] }), false);
  });

  it('counts false as an answer on true/false', () => {
    // The trap: `false` is a real answer. A truthiness check would silently
    // mark every student who answered "خطأ" as having skipped the question.
    assert.equal(isAnswered({ value: false }), true);
    assert.equal(isAnswered({ value: true }), true);
  });

  it('does not count whitespace as writing', () => {
    assert.equal(isAnswered({ text: 'شرح' }), true);
    assert.equal(isAnswered({ text: '   ' }), false);
    assert.equal(isAnswered({ text: '' }), false);
  });

  it('counts a matching pair and a filled blank', () => {
    assert.equal(isAnswered({ pairs: [{ left: 'a', right: 'b' }] }), true);
    assert.equal(isAnswered({ pairs: [] }), false);
    assert.equal(isAnswered({ blanks: ['٢'] }), true);
    assert.equal(isAnswered({ blanks: ['', '  '] }), false);
  });

  it('is unanswered for a shape it does not recognise', () => {
    // Fail closed: warning a student about a question they did answer is a
    // smaller harm than letting them hand in one they missed.
    assert.equal(isAnswered({ somethingNew: 'x' }), false);
  });
});

/**
 * These two build the response the exam screen saves, and the shapes are the
 * whole point: `matching.grade` reads `pairs[].left`/`.right` as ids, and
 * `fill_blank.grade` reads `blanks[i]` against the i-th `{{n}}`. Get either
 * wrong and a student who answered correctly is marked zero, silently — the
 * screen shows the answer as saved, because it was saved, just unreadably.
 */
describe('setMatchPair', () => {
  it('records a link as a left/right id pair', () => {
    assert.deepEqual(setMatchPair([], 'l1', 'r2'), [{ left: 'l1', right: 'r2' }]);
  });

  it('replaces an earlier link from the same left item', () => {
    // The trap: appending leaves the abandoned link in the answer, and
    // `matching.grade` marks every entry it is given.
    const first = setMatchPair([], 'l1', 'r1');
    const changed = setMatchPair(first, 'l1', 'r3');
    assert.deepEqual(changed, [{ left: 'l1', right: 'r3' }]);
  });

  it('leaves the other left items alone', () => {
    const pairs = setMatchPair(setMatchPair([], 'l1', 'r1'), 'l2', 'r2');
    assert.deepEqual(setMatchPair(pairs, 'l2', 'r3').sort((a, b) => a.left.localeCompare(b.left)), [
      { left: 'l1', right: 'r1' },
      { left: 'l2', right: 'r3' },
    ]);
  });
});

describe('setBlankAt', () => {
  it('pads to the blank count so answers land on the right blank', () => {
    // Filling in only the second blank must send ['', '…']: a one-element
    // array would be graded against the first {{n}}.
    assert.deepEqual(setBlankAt([], 1, 'ثمانية', 2), ['', 'ثمانية']);
  });

  it('keeps the blanks already filled in', () => {
    assert.deepEqual(setBlankAt(['٢', ''], 1, '٣', 2), ['٢', '٣']);
  });

  it('does not drop answers when the count is smaller than what is stored', () => {
    // Defensive: an edited template that lost a placeholder must not silently
    // truncate a student's saved work.
    assert.deepEqual(setBlankAt(['أ', 'ب', 'ج'], 0, 'د', 2), ['د', 'ب', 'ج']);
  });
});
