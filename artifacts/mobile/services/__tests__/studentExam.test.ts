/**
 * `isAnswered` decides two things a student sees: the dot on the progress
 * strip, and the count in "you have N unanswered" before handing in. They read
 * the same function on purpose — a strip that disagrees with the warning is
 * worse than having neither, because the student trusts one and is caught by
 * the other.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isAnswered } from '../studentAnswers.ts';

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
