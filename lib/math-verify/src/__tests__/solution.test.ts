import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SOLUTION_LIMITS,
  boardSolutionOf,
  cleanSolutionText,
  parseBoardSolution,
  parseSolution,
} from '../solution.ts';

const good = () => ({ problem: 'حل المعادلة 2x+5=13', steps: ['2x + 5 = 13', '2x = 8', 'x = 4'], answer: 'x = 4' });

describe('cleanSolutionText', () => {
  it('collapses whitespace, including newlines and tabs, and trims', () => {
    assert.equal(cleanSolutionText('  a \n\t b  ', 20), 'a b');
  });
  it('strips invisible bidi and zero-width characters', () => {
    assert.equal(cleanSolutionText('x‏ = ‮4​', 20), 'x = 4');
  });
  it('refuses control characters, non-strings, blanks and over-length text (never truncates)', () => {
    assert.equal(cleanSolutionText('a\u0000b', 20), null);
    assert.equal(cleanSolutionText('a\u001Bb', 20), null);
    assert.equal(cleanSolutionText(4, 20), null);
    assert.equal(cleanSolutionText('   ', 20), null);
    assert.equal(cleanSolutionText('x'.repeat(21), 20), null);
    assert.equal(cleanSolutionText('x'.repeat(20), 20), 'x'.repeat(20));
  });
  it('keeps < and > (every sink escapes them)', () => {
    assert.equal(cleanSolutionText('x < 3 and y > 2', 40), 'x < 3 and y > 2');
  });
});

describe('parseSolution', () => {
  it('accepts a well-formed solution and returns a fresh object', () => {
    const input = good();
    const out = parseSolution(input)!;
    assert.deepEqual(out, input);
    assert.notEqual(out, input);
    assert.notEqual(out.steps, input.steps);
  });
  it('drops every key it does not own — a model claim cannot ride along', () => {
    const out = parseSolution({ ...good(), verified: true, verifiedBy: 'sympy', verification: { verified: true } })!;
    assert.deepEqual(Object.keys(out), ['problem', 'steps', 'answer']);
  });
  it('refuses a non-object, an array, null', () => {
    for (const bad of [null, undefined, 'x', 4, [], [good()]]) assert.equal(parseSolution(bad), null);
  });
  it('enforces the step count 1..8', () => {
    assert.equal(parseSolution({ ...good(), steps: [] }), null);
    assert.equal(parseSolution({ ...good(), steps: Array(SOLUTION_LIMITS.maxSteps + 1).fill('s') }), null);
    assert.ok(parseSolution({ ...good(), steps: Array(SOLUTION_LIMITS.maxSteps).fill('s') }));
    assert.equal(parseSolution({ ...good(), steps: 'x = 4' }), null);
  });
  it('refuses one bad step rather than dropping it', () => {
    assert.equal(parseSolution({ ...good(), steps: ['ok', 4] }), null);
    assert.equal(parseSolution({ ...good(), steps: ['ok', ''] }), null);
    assert.equal(parseSolution({ ...good(), steps: ['ok', 'x'.repeat(SOLUTION_LIMITS.step + 1)] }), null);
  });
  it('enforces problem and answer lengths and presence', () => {
    assert.equal(parseSolution({ ...good(), problem: 'x'.repeat(SOLUTION_LIMITS.problem + 1) }), null);
    assert.equal(parseSolution({ ...good(), answer: 'x'.repeat(SOLUTION_LIMITS.answer + 1) }), null);
    assert.equal(parseSolution({ ...good(), answer: '' }), null);
    assert.equal(parseSolution({ ...good(), problem: undefined }), null);
  });
});

const boardGood = () => ({ ...good(), verified: true, source: 'sympy', understoodAs: '2x+5=13' });

describe('parseBoardSolution', () => {
  it('round-trips a verified and an unchecked solution with a fixed key order', () => {
    const v = parseBoardSolution(boardGood())!;
    assert.deepEqual(Object.keys(v), ['problem', 'steps', 'answer', 'verified', 'source', 'understoodAs']);
    const u = parseBoardSolution({ ...good(), verified: false, source: 'unchecked' })!;
    assert.deepEqual(Object.keys(u), ['problem', 'steps', 'answer', 'verified', 'source']);
  });
  it('refuses a verified claim without understoodAs, or without the sympy source', () => {
    assert.equal(parseBoardSolution({ ...boardGood(), understoodAs: undefined }), null);
    assert.equal(parseBoardSolution({ ...boardGood(), source: 'unchecked' }), null);
    assert.equal(parseBoardSolution({ ...good(), verified: false, source: 'sympy' }), null);
  });
  it('refuses an unchecked solution that carries understoodAs', () => {
    assert.equal(parseBoardSolution({ ...good(), verified: false, source: 'unchecked', understoodAs: '2x+5=13' }), null);
  });
  it('refuses non-boolean verified, unknown source, and a bad nested solution', () => {
    assert.equal(parseBoardSolution({ ...boardGood(), verified: 'true' }), null);
    assert.equal(parseBoardSolution({ ...boardGood(), source: 'llm' }), null);
    assert.equal(parseBoardSolution({ ...boardGood(), steps: [] }), null);
    assert.equal(parseBoardSolution(null), null);
  });
  it('drops unknown keys', () => {
    const out = parseBoardSolution({ ...boardGood(), computedAnswer: 'x = 4', extra: 1 })!;
    assert.equal('computedAnswer' in out, false);
    assert.equal('extra' in out, false);
  });
});

describe('boardSolutionOf', () => {
  const sol = good();
  it('is verified only for a sympy verdict that carries understoodAs', () => {
    const out = boardSolutionOf(sol, { verified: true, source: 'sympy', code: 'verified', understoodAs: '2x+5=13' });
    assert.equal(out.verified, true);
    assert.equal(out.source, 'sympy');
    assert.equal(out.understoodAs, '2x+5=13');
  });
  it('fails closed: a "verified" verdict without understoodAs, or with the wrong source, is unchecked', () => {
    for (const v of [
      { verified: true, source: 'sympy', code: 'verified' },
      { verified: true, source: 'unchecked', code: 'verified', understoodAs: 'a=b' },
      { verified: false, source: 'sympy', code: 'verified', understoodAs: 'a=b' },
      { verified: true, source: 'sympy', code: 'verified', understoodAs: 'bad\u0000' },
    ] as const) {
      const out = boardSolutionOf(sol, v);
      assert.equal(out.verified, false);
      assert.equal(out.source, 'unchecked');
      assert.equal('understoodAs' in out, false);
    }
  });
  it('an unchecked verdict drops understoodAs and copies the steps', () => {
    const out = boardSolutionOf(sol, { verified: false, source: 'unchecked', code: 'restated', understoodAs: '2x+5=14' });
    assert.equal('understoodAs' in out, false);
    assert.notEqual(out.steps, sol.steps);
    assert.deepEqual(out.steps, sol.steps);
  });
});
