/**
 * The gate that decides whether a model-written key is even checkable.
 *
 * It exists because SymPy does not fail on Arabic — with implicit
 * multiplication on, «الإجابة سبعة» parses as a product of letter-symbols and
 * compares unequal to the real answer, which is indistinguishable from a wrong
 * key. Since the caller DELETES questions on "wrong key", Arabic has to be
 * refused here rather than guessed at.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isLatinMath, parseAnswerKeyCheck, VERIFIABLE_TOPICS } from '../answerKey.ts';

describe('isLatinMath', () => {
  it('accepts latin maths in the forms a model writes', () => {
    for (const value of ['3x^2 - 4', 'x = 4', '(4, -1)', 'x^4@2', '3*x**2 - 4']) {
      assert.equal(isLatinMath(value), true, value);
    }
  });

  it('refuses Arabic rather than transliterating it', () => {
    // Guessing that «ق(س)» means f(x) would invent the thing under test.
    for (const value of ['الإجابة سبعة', 'ق(س) = س٣', '٣س٢ − ٤', 'x = ٤']) {
      assert.equal(isLatinMath(value), false, value);
    }
  });

  it('refuses empty and absurdly long values', () => {
    assert.equal(isLatinMath('   '), false);
    assert.equal(isLatinMath('x'.repeat(201)), false);
  });
});

describe('parseAnswerKeyCheck', () => {
  it('reads a well-formed check', () => {
    const check = parseAnswerKeyCheck({
      topic: 'derivative_polynomial',
      question: ' x^3 - 4x ',
      answer: ' 3x^2 - 4 ',
    });
    assert.deepEqual(check, {
      topic: 'derivative_polynomial',
      question: 'x^3 - 4x',
      answer: '3x^2 - 4',
    });
  });

  it('accepts every topic the verifier can actually prove', () => {
    for (const topic of VERIFIABLE_TOPICS) {
      assert.ok(parseAnswerKeyCheck({ topic, question: 'x^2 = 4', answer: 'x = 2' }), topic);
    }
  });

  // Null is the ordinary case, not an error: most questions have no symbolic
  // key and are simply never checked.
  it('returns null for anything it cannot trust', () => {
    assert.equal(parseAnswerKeyCheck(undefined), null);
    assert.equal(parseAnswerKeyCheck(null), null);
    assert.equal(parseAnswerKeyCheck('x^2'), null);
    assert.equal(parseAnswerKeyCheck([]), null);
    assert.equal(parseAnswerKeyCheck({ question: 'x^2', answer: '2x' }), null, 'no topic');
    assert.equal(
      parseAnswerKeyCheck({ topic: 'integral_by_parts', question: 'x^2', answer: '2x' }),
      null,
      'a topic the verifier cannot prove',
    );
    assert.equal(
      parseAnswerKeyCheck({ topic: 'derivative_polynomial', question: 'x^2', answer: '' }),
      null,
      'empty answer',
    );
    assert.equal(
      parseAnswerKeyCheck({ topic: 'derivative_polynomial', question: 'س٢', answer: '٢س' }),
      null,
      'an Arabic check must be refused, not transliterated',
    );
  });
});
