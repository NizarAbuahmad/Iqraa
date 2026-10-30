import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { FRACTIONS, buildFractionQuestion, buildFractionRound } from '../publicGames/fractions.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const value = (id: string) => { const [n, d] = id.split('/').map(Number); return n! / d!; };

test('fraction data: proper, reduced, denominators 2–12, so no two have the same value', () => {
  for (const { n, d } of FRACTIONS) {
    assert.ok(n >= 1 && n < d && d >= 2 && d <= 12, `${n}/${d}`);
    assert.equal(gcd(n, d), 1, `${n}/${d} is not reduced`);
  }
  const values = FRACTIONS.map(f => f.n / f.d);
  assert.equal(new Set(values).size, values.length);
});

test('exactly the larger (or smaller) of the two options is marked, over many seeds', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const kind of ['larger', 'smaller'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = buildFractionQuestion(kind, lang, makeRng(seed));
        assertWellFormed(q, 2);
        assert.equal(q.options.length, 2);
        assert.equal(q.promptKey, kind === 'larger' ? 'playFractionLargerPrompt' : 'playFractionSmallerPrompt');
        const [a, b] = q.options.map(o => value(o.id)) as [number, number];
        assert.notEqual(a, b);
        const wanted = kind === 'larger' ? Math.max(a, b) : Math.min(a, b);
        assert.equal(value(q.correctId), wanted, `${kind} seed ${seed}`);
      }
    }
  }
});

test('labels are wrapped in a left-to-right override, with Arabic-Indic digits in Arabic', () => {
  const ar = buildFractionQuestion('larger', 'ar', makeRng(1));
  for (const o of ar.options) assert.match(o.label, /^\u202D[٠-٩]+\/[٠-٩]+\u202C$/);
  const en = buildFractionQuestion('larger', 'en', makeRng(1));
  for (const o of en.options) assert.match(o.label, /^\u202D[0-9]+\/[0-9]+\u202C$/);
});

test('a round has no repeated pair', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const round = buildFractionRound('en', 8, makeRng(seed));
    assert.equal(round.length, 8);
    const pairs = round.map(q => q.options.map(o => o.id).sort().join('|'));
    assert.equal(new Set(pairs).size, 8);
  }
});

test('fraction round is deterministic for a seed', () => {
  assert.deepEqual(buildFractionRound('ar', 8, makeRng(9)), buildFractionRound('ar', 8, makeRng(9)));
});
