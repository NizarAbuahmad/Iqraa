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
