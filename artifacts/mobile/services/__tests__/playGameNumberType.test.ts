import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { NUMBER_MAX, NUMBER_MIN, buildNumberQuestion, buildNumberRound, isPrime, type NumberKind } from '../publicGames/numberType.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

// Independent of the implementation: count divisors the slow way.
const naivePrime = (n: number) => {
  let divisors = 0;
  for (let d = 1; d <= n; d++) if (n % d === 0) divisors++;
  return divisors === 2;
};
const PREDICATE: Record<NumberKind, (n: number) => boolean> = {
  even: n => n % 2 === 0,
  odd: n => n % 2 === 1,
  prime: naivePrime,
};
const PROMPT: Record<NumberKind, string> = {
  even: 'playNumberEvenPrompt', odd: 'playNumberOddPrompt', prime: 'playNumberPrimePrompt',
};

test('isPrime agrees with a divisor count over the whole range', () => {
  for (let n = 1; n <= NUMBER_MAX; n++) assert.equal(isPrime(n), naivePrime(n), String(n));
});

test('exactly one option has the asked property, and it is the marked one (all kinds, both languages, many seeds)', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (const kind of ['even', 'odd', 'prime'] as const) {
      for (let seed = 1; seed <= 200; seed++) {
        const q = buildNumberQuestion(kind, lang, makeRng(seed));
        assertWellFormed(q, 4);
        assert.equal(q.options.length, 4);
        assert.equal(q.promptKey, PROMPT[kind]);
        assert.equal(q.subject, undefined);
        const matching = q.options.filter(o => PREDICATE[kind](Number(o.id)));
        assert.deepEqual(matching.map(o => o.id), [q.correctId], `${kind} seed ${seed}`);
        for (const o of q.options) {
          const n = Number(o.id);
          assert.ok(n >= NUMBER_MIN && n <= NUMBER_MAX, `${n} out of range`);
        }
      }
    }
  }
});

test('labels use Arabic-Indic digits in Arabic and latin digits in English', () => {
  const ar = buildNumberQuestion('even', 'ar', makeRng(1));
  assert.ok(ar.options.every(o => /^[٠-٩]+$/.test(o.label)));
  const en = buildNumberQuestion('even', 'en', makeRng(1));
  assert.ok(en.options.every(o => /^[0-9]+$/.test(o.label)));
});

test('a round mixes the three kinds and never asks about the same answer twice', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const round = buildNumberRound('ar', 8, makeRng(seed));
    assert.equal(round.length, 8);
    assert.equal(new Set(round.map(q => q.promptKey)).size, 3);
    assert.equal(new Set(round.map(q => q.correctId)).size, 8);
  }
});
