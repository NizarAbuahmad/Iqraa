import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { PLURAL_PAIRS, buildPluralRound } from '../publicGames/plurals.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('plural data: no word repeats across singulars and plurals, and a plural differs from its singular', () => {
  const all = PLURAL_PAIRS.flatMap(p => [p.ar, p.pluralAr]);
  assert.equal(new Set(all).size, all.length);
  for (const p of PLURAL_PAIRS) assert.notEqual(p.ar, p.pluralAr);
  assert.ok(PLURAL_PAIRS.length >= 25);
});

test('plural round: 8 questions on 8 different words, Arabic options in both UI languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildPluralRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.promptKey, 'playPluralsPrompt');
        assert.match(q.subject!, /^[\p{Script=Arabic}\p{M}]+$/u);
        for (const o of q.options) assert.match(o.label, /^[\p{Script=Arabic}\p{M}]+$/u);
      }
    }
  }
});

test('plural round: the marked answer is the table plural of the subject', () => {
  const plural = new Map(PLURAL_PAIRS.map(p => [p.ar, p.pluralAr]));
  for (let seed = 1; seed <= 100; seed++) {
    for (const q of buildPluralRound('ar', 8, makeRng(seed))) {
      assert.equal(q.options.find(o => o.id === q.correctId)!.label, plural.get(q.subject!));
    }
  }
});
