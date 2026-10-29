import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { withDistractors } from '../publicGames/textQuiz.ts';
import { ANTONYM_PAIRS, buildAntonymRound } from '../publicGames/antonyms.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('withDistractors: the correct option once, distinct distractors, never a duplicate label', () => {
  const pool = [
    { id: 'a', label: 'A' }, { id: 'b', label: 'B' }, { id: 'c', label: 'C' },
    { id: 'd', label: 'D' }, { id: 'a2', label: 'A' }, // same label as the correct one
  ];
  const out = withDistractors({ id: 'a', label: 'A' }, pool, 3, makeRng(3));
  assert.equal(out.length, 4);
  assert.equal(new Set(out.map(o => o.label)).size, 4);
  assert.equal(out.filter(o => o.id === 'a').length, 1);
});

test('withDistractors returns fewer options than asked rather than repeating one', () => {
  const out = withDistractors({ id: 'a', label: 'A' }, [{ id: 'b', label: 'B' }], 3, makeRng(1));
  assert.equal(out.length, 2);
});

test('antonym data: every Arabic and English word appears once in the whole table', () => {
  const ar = ANTONYM_PAIRS.flatMap(p => [p.ar, p.oppAr]);
  const en = ANTONYM_PAIRS.flatMap(p => [p.en, p.oppEn]);
  assert.equal(new Set(ar).size, ar.length, 'a word repeats in Arabic');
  assert.equal(new Set(en).size, en.length, 'a word repeats in English');
  assert.ok(ANTONYM_PAIRS.length >= 20);
});

test('antonym round: 8 questions on 8 different pairs, each well formed, in both languages', () => {
  for (const lang of ['ar', 'en'] as const) {
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildAntonymRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8, 'a pair repeats within a round');
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.promptKey, 'playAntonymsPrompt');
      }
    }
  }
});

test('antonym round: the marked answer really is the opposite of the subject', () => {
  const byAr = new Map<string, string>();
  const byEn = new Map<string, string>();
  for (const p of ANTONYM_PAIRS) {
    byAr.set(p.ar, p.oppAr); byAr.set(p.oppAr, p.ar);
    byEn.set(p.en, p.oppEn); byEn.set(p.oppEn, p.en);
  }
  for (const lang of ['ar', 'en'] as const) {
    const map = lang === 'ar' ? byAr : byEn;
    for (let seed = 1; seed <= 100; seed++) {
      for (const q of buildAntonymRound(lang, 8, makeRng(seed))) {
        const answer = q.options.find(o => o.id === q.correctId)!;
        assert.equal(map.get(q.subject!), answer.label, `${q.subject} -> ${answer.label}`);
      }
    }
  }
});

test('antonym round is deterministic for a seed', () => {
  assert.deepEqual(buildAntonymRound('ar', 8, makeRng(9)), buildAntonymRound('ar', 8, makeRng(9)));
});
