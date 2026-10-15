import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { geogebraCommands, type GraphCurve } from '../mathGeogebra.ts';

const ex = (expr: string): GraphCurve => ({ kind: 'explicit', expr });
const cmds = (curves: GraphCurve[], angle: 'deg' | 'rad' = 'rad') => geogebraCommands(curves, angle);

describe('geogebraCommands: plain functions', () => {
  it('names the functions f, g, h, k in order', () => {
    assert.deepEqual(cmds([ex('x^2'), ex('x+1'), ex('2x'), ex('sqrt(x)')]), {
      commands: ['f(x)=x^2', 'g(x)=x+1', 'h(x)=2x', 'k(x)=sqrt(x)'],
      complete: true,
    });
  });
  it('an empty list is complete and empty', () => {
    assert.deepEqual(cmds([]), { commands: [], complete: true });
  });
  it('keeps constants, brackets, exponents and factorials as they are', () => {
    assert.deepEqual(cmds([ex('pi*x^2+(x+1)^3')]).commands, ['f(x)=pi*x^2+(x+1)^3']);
    assert.deepEqual(cmds([ex('x!')]).commands, ['f(x)=x!']);
    assert.deepEqual(cmds([ex('abs(x)+exp(x)+cbrt(x)+ln(x)')]).commands, ['f(x)=abs(x)+exp(x)+cbrt(x)+ln(x)']);
  });
  it('splits a run of constants into a product', () => {
    assert.deepEqual(cmds([ex('pix')]).commands, ['f(x)=pi*x']);
    assert.deepEqual(cmds([ex('x(x+1)')]).commands, ['f(x)=x*(x+1)']);
  });
  it('reads Arabic input the way the calculator does', () => {
    assert.deepEqual(cmds([ex('س^2')], 'rad').commands, ['f(x)=x^2']);
    assert.deepEqual(cmds([ex('جا(س)')], 'deg').commands, ['f(x)=sin((x)°)']);
  });
});

describe('geogebraCommands: degrees', () => {
  it('GeoGebra trig takes radians, so a degree argument gets a ° sign', () => {
    assert.deepEqual(cmds([ex('sin(x)')], 'deg').commands, ['f(x)=sin((x)°)']);
    assert.deepEqual(cmds([ex('sin(x)')], 'rad').commands, ['f(x)=sin(x)']);
  });
  it('wraps every call, nested ones included, and keeps the whole argument', () => {
    assert.deepEqual(cmds([ex('sin(2x)+cos(x+30)')], 'deg').commands, ['f(x)=sin((2x)°)+cos((x+30)°)']);
    assert.deepEqual(cmds([ex('tan(sin(x))')], 'deg').commands, ['f(x)=tan((sin((x)°))°)']);
  });
  it('inverse trig answers in radians there, so divide by ° to get degrees back', () => {
    assert.deepEqual(cmds([ex('asin(x)')], 'deg').commands, ['f(x)=(asin(x)/°)']);
    assert.deepEqual(cmds([ex('atan(x)')], 'rad').commands, ['f(x)=atan(x)']);
  });
});

describe('geogebraCommands: logarithms', () => {
  it('log is base 10 here and the natural log there, so it becomes lg', () => {
    assert.deepEqual(cmds([ex('log(x)')]).commands, ['f(x)=lg(x)']);
  });
  it('log with a base swaps to GeoGebra\'s order: base first', () => {
    assert.deepEqual(cmds([ex('log(x,2)')]).commands, ['f(x)=log(2, x)']);
    assert.deepEqual(cmds([ex('log(sin(x),2)')], 'rad').commands, ['f(x)=log(2, sin(x))']);
  });
});

describe('geogebraCommands: vertical lines', () => {
  it('x = number', () => {
    assert.deepEqual(cmds([{ kind: 'vertical', x: 3 }]).commands, ['x=3']);
    assert.deepEqual(cmds([{ kind: 'vertical', x: -2.5 }]).commands, ['x=-2.5']);
  });
  it('does not use up a function name', () => {
    assert.deepEqual(cmds([{ kind: 'vertical', x: 1 }, ex('x^2')]).commands, ['x=1', 'f(x)=x^2']);
  });
});

describe('geogebraCommands: what it cannot say faithfully is left out and flagged', () => {
  it('a function it cannot translate is omitted, the rest are kept, and the result is marked incomplete', () => {
    const r = cmds([ex('x^2'), ex('nPr(x,2)'), ex('x+1')]);
    assert.deepEqual(r.commands, ['f(x)=x^2', 'g(x)=x+1']);
    assert.equal(r.complete, false);
  });
  it('percent has no safe translation', () => {
    const r = cmds([ex('50%x')]);
    assert.deepEqual(r.commands, []);
    assert.equal(r.complete, false);
  });
  it('an unknown word is refused, never forwarded', () => {
    const r = cmds([ex('foo(x)')]);
    assert.deepEqual(r.commands, []);
    assert.equal(r.complete, false);
  });
  it('unbalanced brackets are refused', () => {
    assert.equal(cmds([ex('sin(x')]).complete, false);
  });
});
