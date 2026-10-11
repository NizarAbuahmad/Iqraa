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
    // A payload that is a real question for ITS topic: a check must itself be a
    // question (see the suite below), so one dummy string no longer fits all.
    // Keyed by topic so a new topic cannot be added without a payload here.
    const payload: Record<(typeof VERIFIABLE_TOPICS)[number], string> = {
      derivative_polynomial: 'x^3 - 4x',
      derivative_at_point: 'x^4@2',
      circle_center: '(x-4)^2 + (y+1)^2 = 9',
      circle_radius: '(x-4)^2 + (y+1)^2 = 9',
      equation_linear: '2x + 5 = 13',
      equation_quadratic: 'x^2 = 4',
      equation_exponential: '2^x = 8',
    };
    for (const topic of VERIFIABLE_TOPICS) {
      assert.ok(parseAnswerKeyCheck({ topic, question: payload[topic], answer: 'x = 2' }), topic);
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

describe('parseAnswerKeyCheck — a check must itself be a real question', () => {
  // `P = 1/6` is not a question the verifier answers, it is the answer: SymPy
  // "solves" it to 1/6 and matches the key by construction. The probability
  // item behind it carried a green «تم التحقق رياضيًا» badge for reasoning
  // nothing did (STATUS.md). The shared gate used to run only on text pulled
  // out of a typed problem, so a model-written check skipped it.
  const eq = (question: string, answer = question) => ({ topic: 'equation_linear', question, answer });

  it('refuses a check whose "question" is just its own answer', () => {
    for (const question of ['P = 1/6', 'x = 4', 'x = 2 + 2', 'y=0.5']) {
      assert.equal(parseAnswerKeyCheck(eq(question)), null, question);
    }
  });

  it('refuses it for every equation topic and for a circle that is not one', () => {
    for (const topic of ['equation_linear', 'equation_quadratic', 'equation_exponential']) {
      assert.equal(parseAnswerKeyCheck({ topic, question: 'P = 1/6', answer: 'P = 1/6' }), null, topic);
    }
    for (const topic of ['circle_center', 'circle_radius']) {
      assert.equal(parseAnswerKeyCheck({ topic, question: 'x = 4', answer: '4' }), null, topic);
      assert.equal(parseAnswerKeyCheck({ topic, question: '2x + 5 = 13', answer: '4' }), null, `${topic}: not a circle`);
    }
  });

  it('refuses a derivative with nothing to differentiate', () => {
    for (const topic of ['derivative_polynomial', 'derivative_at_point']) {
      assert.equal(parseAnswerKeyCheck({ topic, question: '3@2', answer: '0' }), null, topic);
    }
  });

  it('still accepts the real questions of every topic', () => {
    const real: Array<[string, string, string]> = [
      ['equation_linear', '2x + 5 = 13', 'x = 4'],
      ['equation_linear', '-3x + 7 = 1', 'x = 2'],
      ['equation_linear', 'x/2 + 1 = 4', 'x = 6'],
      ['equation_quadratic', 'x^2-5x+6=0', 'x = 2 or x = 3'],
      ['equation_exponential', '2^x = 8', 'x = 3'],
      ['circle_center', '(x-4)^2 + (y+1)^2 = 9', '(4, -1)'],
      ['circle_radius', '(x-4)^2 + (y+1)^2 = 9', '3'],
      ['derivative_polynomial', 'x^3 - 4x', '3x^2 - 4'],
      ['derivative_at_point', 'x^4@2', '32'],
    ];
    for (const [topic, question, answer] of real) {
      assert.ok(parseAnswerKeyCheck({ topic, question, answer }), `${topic}: ${question}`);
    }
  });
});

