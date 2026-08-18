/**
 * Symbolic-verification gate tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/verifyMath.test.ts
 *
 * These pin the guards that decide whether we CLAIM machine verification.
 * A false positive here means projecting "تم التحقق رياضيًا" on a classroom
 * wall for something no verifier proved — so the gates fail closed.
 *
 * (verifyMathItem itself performs network I/O and is exercised end-to-end
 * against the running service, not here.)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  classifyVerifiableTopic,
  isDerivativeQuestion,
  latinEquationFrom,
  latinExpressionFrom,
} from '../ai/verifyMathGuards.ts';

describe('isDerivativeQuestion', () => {
  it('matches Arabic and English derivative phrasing', () => {
    assert.equal(isDerivativeQuestion('أوجد مشتقة الاقتران f(x)=3x^2'), true);
    assert.equal(isDerivativeQuestion('قواعد الاشتقاق'), true);
    assert.equal(isDerivativeQuestion('Find the derivative of f(x)=x^3'), true);
    assert.equal(isDerivativeQuestion('d/dx (2x)'), true);
  });

  it('does not claim derivative for other math families', () => {
    assert.equal(isDerivativeQuestion('ما ناتج / حل: 2^{x+1} = 32؟'), false);
    assert.equal(isDerivativeQuestion('أوجد وسيط البيانات: 1، 3، 5'), false);
    assert.equal(isDerivativeQuestion('نصف قطر الدائرة'), false);
  });
});

describe('latinExpressionFrom', () => {
  it('extracts the function body', () => {
    assert.equal(latinExpressionFrom('أوجد مشتقة f(x)=3x^2+5x'), '3x^2+5x');
    assert.equal(latinExpressionFrom('y = 2x - 3'), '2x-3');
  });

  it('normalises superscripts and the typographic minus', () => {
    assert.equal(latinExpressionFrom('f(x)=3x²−5x'), '3x^2-5x');
  });

  it('refuses anything without x (nothing to differentiate)', () => {
    assert.equal(latinExpressionFrom('f(x)=7'), null);
  });

  it('refuses unsafe or unparseable text — fail closed', () => {
    assert.equal(latinExpressionFrom('f(x)=<script>'), null);
    assert.equal(latinExpressionFrom('مشتقة الاقتران المركب'), null);
    assert.equal(latinExpressionFrom(''), null);
  });

  it('never returns Arabic notation (the verifier rejects it)', () => {
    const out = latinExpressionFrom('أوجد مشتقة f(x)=٣x') ?? '';
    assert.ok(!/[٠-٩۰-۹]/.test(out), 'Arabic-Indic digits must not reach the verifier');
  });
});

describe('latinEquationFrom', () => {
  it('extracts an equation from real bank question text', () => {
    assert.equal(latinEquationFrom('ما ناتج / حل: 2x + 5 = 17؟'), '2x+5=17');
    assert.equal(latinEquationFrom('ما ناتج / حل: x^2 - 5x + 6 = 0؟'), 'x^2-5x+6=0');
  });

  it('normalises superscripts and the typographic minus', () => {
    assert.equal(latinEquationFrom('حل: x² − 9 = 0'), 'x^2-9=0');
  });

  it('refuses systems — the bank joins two equations with a comma', () => {
    assert.equal(latinEquationFrom('ما ناتج / حل: 2x + y = 7 ، y = 3؟'), null);
  });

  it('refuses text with no equation', () => {
    assert.equal(latinEquationFrom('أوجد وسيط البيانات: 1، 3، 5'), null);
    assert.equal(latinEquationFrom('تعرُّف مفهوم الاقتران'), null);
  });
});

describe('classifyVerifiableTopic', () => {
  it('routes derivatives by expression, equations by solution set', () => {
    assert.equal(
      classifyVerifiableTopic('أوجد مشتقة f(x)=3x^2')?.topic,
      'derivative_polynomial',
    );
    assert.equal(classifyVerifiableTopic('ما ناتج / حل: 2x + 5 = 17؟')?.topic, 'equation_linear');
    assert.equal(
      classifyVerifiableTopic('ما ناتج / حل: x^2 - 5x + 6 = 0؟')?.topic,
      'equation_quadratic',
    );
    assert.equal(classifyVerifiableTopic('ما ناتج / حل: 2^n = 16؟')?.topic, 'equation_exponential');
  });

  it('carries the payload the verifier expects', () => {
    assert.equal(classifyVerifiableTopic('ما ناتج / حل: 2x + 5 = 17؟')?.payload, '2x+5=17');
    assert.equal(classifyVerifiableTopic('أوجد مشتقة f(x)=3x^2')?.payload, '3x^2');
  });

  it('returns null when nothing can honestly be claimed', () => {
    assert.equal(classifyVerifiableTopic('أوجد وسيط البيانات: 1، 3، 5'), null);
    assert.equal(classifyVerifiableTopic('نصف قطر الدائرة يساوي؟'), null);
    assert.equal(classifyVerifiableTopic(''), null);
  });
});

/**
 * Extraction defects found by replaying every question the concrete math bank
 * can render (430 of them) through the real SymPy verifier. Each one lost a
 * provable item to the 'bank' label — the badge understated what the product
 * had actually checked.
 */
describe('extraction defects that silently cost real verifications', () => {
  it('keeps brace exponents instead of truncating the equation', () => {
    // Was: '4^x=2^' — the run stopped at the '{', and the fragment that
    // reached SymPy was a syntax error, so the item degraded to 'bank'.
    assert.equal(latinEquationFrom('ما ناتج / حل: 4^x = 2^{x+3}؟'), '4^x=2^(x+3)');
    assert.equal(latinEquationFrom('ما ناتج / حل: 2^{x+1} = 32؟'), '2^(x+1)=32');
    assert.equal(latinEquationFrom('ما ناتج / حل: 5^{x-1} = 25؟'), '5^(x-1)=25');
  });

  it('drops the sentence full stop from an extracted expression', () => {
    // '.' is math-safe because decimals need it, so 'x^2.' reached SymPy.
    assert.equal(latinExpressionFrom('أوجد مشتقة f(x) = x².'), 'x^2');
    assert.equal(latinExpressionFrom('أوجد مشتقة f(x) = 5x.'), '5x');
  });

  it('still accepts a genuine decimal point', () => {
    assert.equal(latinEquationFrom('حل: 2x = 1.5'), '2x=1.5');
  });

  it('refuses an equation that merely restates its own answer', () => {
    // 'P = 1/6' is the answer, not a question. SymPy solved it to 1/6 and
    // matched by construction, putting a green symbolic badge on a
    // probability item nothing had reasoned about.
    assert.equal(latinEquationFrom('ما ناتج / حل: P = 1/6؟'), null);
    assert.equal(latinEquationFrom('دائرة نصف قطرها r = 5. أوجد محيطها.'), null);
    assert.equal(classifyVerifiableTopic('ما ناتج / حل: P = 1/6؟'), null);
  });

  it('still accepts an equation with the unknown on both sides', () => {
    // Bare-symbol LHS is only a tautology when the other side has no unknown.
    assert.equal(latinEquationFrom('حل: n = 3n - 1'), 'n=3n-1');
  });
});
