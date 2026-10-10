import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { BoardSolution } from '@workspace/math-verify';

import { SOLUTION_BOX, layoutSolution, solutionItems, wrapText, type SolutionLabels } from '../solutionLayout.ts';

const labels: SolutionLabels = { ai: 'AI-written', verified: '✓ checked', unchecked: 'not checked', understoodAs: 'Understood as:' };
const sol = (over: Partial<BoardSolution> = {}): BoardSolution => ({
  problem: '2x+5=13', steps: ['2x + 5 = 13', '2x = 8', 'x = 4'], answer: 'x = 4', verified: false, source: 'unchecked', ...over,
});

describe('wrapText', () => {
  it('wraps on spaces and never exceeds the limit', () => {
    const lines = wrapText('aaa bbb ccc ddd', 7);
    assert.deepEqual(lines, ['aaa bbb', 'ccc ddd']);
  });
  it('cuts a token longer than a line instead of dropping it', () => {
    const lines = wrapText('x'.repeat(25), 10);
    assert.deepEqual(lines, ['x'.repeat(10), 'x'.repeat(10), 'x'.repeat(5)]);
    assert.equal(lines.join('').length, 25);
  });
  it('returns one empty line for empty text, and treats a bad limit as 1', () => {
    assert.deepEqual(wrapText('', 10), ['']);
    assert.deepEqual(wrapText('ab', 0), ['a', 'b']);
  });
});

describe('solutionItems', () => {
  it('always starts with the AI label and the problem', () => {
    const items = solutionItems(sol(), labels, 0);
    assert.deepEqual(items.map(i => i.kind), ['ai', 'problem']);
    assert.equal(items[0]!.text, 'AI-written');
    assert.equal(items[1]!.text, '2x+5=13');
  });
  it('reveals steps one at a time, and the answer with its verdict only after the last', () => {
    assert.deepEqual(solutionItems(sol(), labels, 1).map(i => i.kind), ['ai', 'problem', 'step']);
    assert.deepEqual(solutionItems(sol(), labels, 2).map(i => i.kind), ['ai', 'problem', 'step', 'step']);
    assert.deepEqual(solutionItems(sol(), labels, 3).map(i => i.kind), ['ai', 'problem', 'step', 'step', 'step', 'answer', 'verdict']);
  });
  it('clamps the revealed count', () => {
    assert.equal(solutionItems(sol(), labels, -4).filter(i => i.kind === 'step').length, 0);
    assert.equal(solutionItems(sol(), labels, 99).filter(i => i.kind === 'step').length, 3);
    assert.equal(solutionItems(sol(), labels, 1.9).filter(i => i.kind === 'step').length, 1);
  });
  it('the verdict says checked only for a verified solution, which also shows what was checked', () => {
    const u = solutionItems(sol(), labels, 3);
    assert.equal(u.find(i => i.kind === 'verdict')!.text, 'not checked');
    assert.ok(!u.some(i => i.kind === 'understood'));
    const v = solutionItems(sol({ verified: true, source: 'sympy', understoodAs: '2x+5=13' }), labels, 3);
    assert.equal(v.find(i => i.kind === 'verdict')!.text, '✓ checked');
    assert.equal(v.find(i => i.kind === 'understood')!.text, 'Understood as: 2x+5=13');
  });
});

describe('layoutSolution', () => {
  const box = { w: SOLUTION_BOX.w - 32, h: SOLUTION_BOX.h - 32 };
  it('a short solution fits at the largest size', () => {
    const l = layoutSolution(solutionItems(sol(), labels, 3), box);
    assert.equal(l.fits, true);
    assert.equal(l.fontSize, 28);
  });
  it('more text never gives a larger font, and every row stays inside the box when it fits', () => {
    const long = sol({ steps: Array.from({ length: 8 }, () => 'a long step with many many words in it that goes on and on '.repeat(2)) });
    const short = layoutSolution(solutionItems(sol(), labels, 3), box);
    const big = layoutSolution(solutionItems(long, labels, 8), box);
    assert.ok(big.fontSize <= short.fontSize);
    if (big.fits) assert.ok(big.rows.every(r => r.y <= box.h));
  });
  it('text that cannot fit even at the smallest size says so and uses that size', () => {
    const huge = sol({ steps: Array.from({ length: 8 }, () => 'word '.repeat(60).trim()) });
    const l = layoutSolution(solutionItems(huge, labels, 8), { w: 200, h: 100 });
    assert.equal(l.fits, false);
    assert.equal(l.fontSize, 14);
  });
  it('rows run top to bottom', () => {
    const l = layoutSolution(solutionItems(sol(), labels, 3), box);
    for (let i = 1; i < l.rows.length; i++) assert.ok(l.rows[i]!.y > l.rows[i - 1]!.y);
    assert.equal(l.rows[0]!.kind, 'ai');
  });
  it('a maximum below the minimum is raised to the minimum', () => {
    const l = layoutSolution(solutionItems(sol(), labels, 3), box, { maxFont: 8, minFont: 11 });
    assert.equal(l.fontSize, 11);
  });
});
