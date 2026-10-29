import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { SUBSTANCES, buildMatterRound } from '../publicGames/matterStates.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('substance data: unique ids and names, a valid state each, at least 5 of every state', () => {
  assert.equal(new Set(SUBSTANCES.map(s => s.id)).size, SUBSTANCES.length);
  assert.equal(new Set(SUBSTANCES.map(s => s.ar)).size, SUBSTANCES.length);
  assert.equal(new Set(SUBSTANCES.map(s => s.en)).size, SUBSTANCES.length);
  for (const state of ['solid', 'liquid', 'gas'] as const) {
    assert.ok(SUBSTANCES.filter(s => s.state === state).length >= 5, state);
  }
  for (const s of SUBSTANCES) assert.ok(['solid', 'liquid', 'gas'].includes(s.state), s.id);
});

test('matter round: three state options, the marked one is the substance\'s state, no substance twice', () => {
  const byName = (lang: 'ar' | 'en') => new Map(SUBSTANCES.map(s => [lang === 'ar' ? s.ar : s.en, s.state]));
  for (const lang of ['ar', 'en'] as const) {
    const state = byName(lang);
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildMatterRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 3);
        assert.equal(q.options.length, 3);
        assert.equal(q.promptKey, 'playMatterPrompt');
        assert.equal(q.correctId, state.get(q.subject!));
        assert.deepEqual(q.options.map(o => o.id).sort(), ['gas', 'liquid', 'solid']);
      }
    }
  }
});

test('pinned answer key: six substances looked up by id, with literal expected states', () => {
  const state = (id: string) => SUBSTANCES.find(s => s.id === id)?.state;
  assert.equal(state('water'), 'liquid');
  assert.equal(state('water-vapour'), 'gas');
  assert.equal(state('salt'), 'solid');
  assert.equal(state('ice'), 'solid');
  assert.equal(state('oxygen'), 'gas');
  assert.equal(state('olive-oil'), 'liquid');
});

test('a round is not all one state', () => {
  for (let seed = 1; seed <= 50; seed++) {
    const states = new Set(buildMatterRound('ar', 8, makeRng(seed)).map(q => q.correctId));
    assert.ok(states.size >= 2);
  }
});
