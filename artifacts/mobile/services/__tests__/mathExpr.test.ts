import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { autoCloseBrackets, evaluate, normaliseInput } from '../mathExpr.ts';

function val(src: string, opts?: Parameters<typeof evaluate>[1]): number {
  const r = evaluate(src, opts);
  assert.ok(r.ok, `expected "${src}" to evaluate, got ${JSON.stringify(r)}`);
  return r.value;
}
function fail(src: string, opts?: Parameters<typeof evaluate>[1]): string {
  const r = evaluate(src, opts);
  assert.ok(!r.ok, `expected "${src}" to fail, got ${JSON.stringify(r)}`);
  return r.reason;
}
function close(actual: number, expected: number, tol = 1e-9) {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} != ${expected}`);
}

describe('evaluate: arithmetic and precedence', () => {
  it('follows school precedence', () => {
    assert.equal(val('2+3*4'), 14);
    assert.equal(val('(2+3)*4'), 20);
    assert.equal(val('10-4-3'), 3);
    assert.equal(val('100/10/2'), 5);
  });
  it('treats ^ as right-associative and binds it tighter than unary minus', () => {
    assert.equal(val('2^3^2'), 512);
    assert.equal(val('-2^2'), -4);
    assert.equal(val('2^-1'), 0.5);
  });
  it('multiplies implicitly at the same precedence as *', () => {
    assert.equal(val('2(3+4)'), 14);
    assert.equal(val('(1+1)(2+2)'), 8);
    close(val('2pi'), 2 * Math.PI, 1e-12);
    assert.equal(val('1/2x', { vars: { x: 6 } }), 3);
  });
  it('supports factorial, percent and constants', () => {
    assert.equal(val('5!'), 120);
    assert.equal(val('0!'), 1);
    assert.equal(val('50%'), 0.5);
    close(val('e'), Math.E);
    assert.equal(val('Ans+1', { vars: { Ans: 41 } }), 42);
  });
  it('does not show binary float noise for school decimals', () => {
    assert.equal(val('0.1+0.2'), 0.3);
  });
});

describe('evaluate: functions', () => {
  it('sqrt, cbrt, abs, exp', () => {
    assert.equal(val('sqrt(16)'), 4);
    assert.equal(val('cbrt(27)'), 3);
    assert.equal(val('abs(-3.5)'), 3.5);
    close(val('exp(1)'), Math.E);
  });
  it('log is base 10, ln is natural, log(x,b) takes a base', () => {
    assert.equal(val('log(1000)'), 3);
    close(val('ln(e)'), 1);
    assert.equal(val('log(8,2)'), 3);
  });
  it('nCr and nPr', () => {
    assert.equal(val('nCr(5,2)'), 10);
    assert.equal(val('nPr(5,2)'), 20);
  });
});

describe('evaluate: angle modes', () => {
  it('defaults to degrees and returns exact school values', () => {
    assert.equal(val('sin(30)'), 0.5);
    assert.equal(val('cos(60)'), 0.5);
    assert.equal(val('sin(180)'), 0);
    assert.equal(val('cos(90)'), 0);
    assert.equal(val('tan(45)'), 1);
    assert.equal(val('sin(90)'), 1);
    assert.equal(val('cos(0)'), 1);
    assert.equal(val('2sin(30)'), 1);
  });
  it('reduces by 360 before applying', () => {
    assert.equal(val('sin(390)'), 0.5);
    assert.equal(val('cos(-60)'), 0.5);
  });
  it('tan at 90° is a domain error, not 1.6e16', () => {
    assert.equal(fail('tan(90)'), 'domain');
    assert.equal(fail('tan(270)'), 'domain');
  });
  it('radian mode', () => {
    close(val('sin(pi)', { angle: 'rad' }), 0);
    close(val('cos(pi)', { angle: 'rad' }), -1);
    close(val('sin(pi/6)', { angle: 'rad' }), 0.5);
  });
  it('inverse trig answers in the current mode', () => {
    assert.equal(val('asin(0.5)'), 30);
    assert.equal(val('acos(0.5)'), 60);
    assert.equal(val('atan(1)'), 45);
    close(val('atan(1)', { angle: 'rad' }), Math.PI / 4);
    assert.equal(fail('asin(2)'), 'domain');
  });
});

describe('evaluate: fails closed with a named reason', () => {
  it('empty and over-long input', () => {
    assert.equal(fail(''), 'empty');
    assert.equal(fail('   '), 'empty');
    assert.equal(fail('1+'.repeat(150) + '1'), 'too-long');
  });
  it('syntax and brackets', () => {
    assert.equal(fail('2+*3'), 'syntax');
    assert.equal(fail('2(1+'), 'unbalanced');
    assert.equal(fail(')'), 'unbalanced');
    assert.equal(fail('1..2'), 'syntax');
  });
  it('a bare comma outside a function call is a syntax error, not a decimal', () => {
    assert.equal(fail('1,5'), 'syntax');
  });
  it('unknown names are refused, never read as a product of letters', () => {
    assert.equal(fail('foo(1)'), 'unknown-symbol');
    assert.equal(fail('abc'), 'unknown-symbol');
  });
  it('a function without brackets is refused', () => {
    assert.equal(fail('sinx'), 'function-needs-brackets');
    assert.equal(fail('sin 30'), 'function-needs-brackets');
  });
  it('wrong argument count', () => {
    assert.equal(fail('abs()'), 'wrong-arity');
    assert.equal(fail('sqrt(1,2)'), 'wrong-arity');
    assert.equal(fail('nCr(5)'), 'wrong-arity');
  });
  it('math domain errors', () => {
    assert.equal(fail('sqrt(-1)'), 'domain');
    assert.equal(fail('ln(0)'), 'domain');
    assert.equal(fail('ln(-2)'), 'domain');
    assert.equal(fail('log(0)'), 'domain');
    assert.equal(fail('nCr(2,5)'), 'domain');
  });
  it('division by zero', () => {
    assert.equal(fail('1/0'), 'divide-by-zero');
    assert.equal(fail('5/(3-3)'), 'divide-by-zero');
  });
  it('overflow', () => {
    assert.equal(fail('10^10^10'), 'overflow');
    assert.equal(fail('10^400'), 'overflow');
  });
  it('factorial only for whole numbers 0..170', () => {
    assert.equal(fail('171!'), 'factorial-domain');
    assert.equal(fail('2.5!'), 'factorial-domain');
    assert.equal(fail('(-1)!'), 'factorial-domain');
    assert.equal(val('170!') > 1e300, true);
  });
  it('refuses runaway nesting instead of overflowing the stack', () => {
    assert.equal(fail('('.repeat(100) + '1' + ')'.repeat(100)), 'too-long');
  });
  it('never uses eval or Function', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const src = readFileSync(join(import.meta.dirname, '..', 'mathExpr.ts'), 'utf8');
    assert.ok(!/\beval\s*\(/.test(src));
    assert.ok(!/new\s+Function/.test(src));
  });
});

describe('normaliseInput: what a teacher types on an Arabic keypad', () => {
  it('folds Arabic-Indic digits and the decimal mark', () => {
    assert.equal(val('٣+٤٫٥×٢'), 12);
  });
  it('maps display glyphs to ASCII operators', () => {
    assert.equal(normaliseInput('٦÷٣−١'), '6/3-1');
    assert.equal(val('٦÷٣−١'), 1);
  });
  it('maps π, √ and superscript squares', () => {
    assert.equal(val('√9'), 3);
    assert.equal(val('√(16)'), 4);
    assert.equal(val('3²'), 9);
    close(val('π'), Math.PI, 1e-12);
  });
  it('maps the book names جا جتا ظا and the variable س', () => {
    assert.equal(val('جا(30)'), 0.5);
    assert.equal(val('جتا(60)'), 0.5);
    assert.equal(val('ظا(45)'), 1);
    assert.equal(val('س^2', { vars: { x: 3 } }), 9);
  });
  it('maps the Arabic comma inside function arguments', () => {
    assert.equal(val('log(8،2)'), 3);
  });
});

describe('autoCloseBrackets', () => {
  it('closes what is still open', () => {
    assert.equal(autoCloseBrackets('sin(30'), 'sin(30)');
    assert.equal(autoCloseBrackets('((1+2'), '((1+2))');
  });
  it('leaves balanced and over-closed input alone', () => {
    assert.equal(autoCloseBrackets('(1+2)'), '(1+2)');
    assert.equal(autoCloseBrackets('1+2)'), '1+2)');
  });
  it('makes a half-typed expression evaluable', () => {
    assert.equal(val(autoCloseBrackets('2*(3+4')), 14);
  });
});
