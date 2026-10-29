import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng } from '../publicGames/rng.ts';
import { GOVERNORATES, PLACES, buildGovernorateRound } from '../publicGames/governorates.ts';
import { assertWellFormed } from './playQuizAsserts.ts';

test('there are 12 governorates with unique ids and names', () => {
  assert.equal(GOVERNORATES.length, 12);
  for (const key of ['id', 'ar', 'en'] as const) {
    assert.equal(new Set(GOVERNORATES.map(g => g[key])).size, 12, key);
  }
});

test('place data: unique names, every place points at a real governorate, every governorate has a place', () => {
  assert.equal(new Set(PLACES.map(p => p.ar)).size, PLACES.length);
  assert.equal(new Set(PLACES.map(p => p.en)).size, PLACES.length);
  const ids = new Set(GOVERNORATES.map(g => g.id));
  for (const p of PLACES) assert.ok(ids.has(p.gov), `${p.ar} -> ${p.gov}`);
  for (const g of GOVERNORATES) assert.ok(PLACES.some(p => p.gov === g.id), `${g.ar} has no place`);
  assert.ok(PLACES.length >= 20);
});

test('no place is named after its own governorate (that question answers itself)', () => {
  const byId = new Map(GOVERNORATES.map(g => [g.id, g]));
  for (const p of PLACES) {
    assert.notEqual(p.ar, byId.get(p.gov)!.ar);
    assert.notEqual(p.en, byId.get(p.gov)!.en);
  }
});

test('governorate round: 8 different places, four distinct governorates each, the marked one is the place\'s', () => {
  for (const lang of ['ar', 'en'] as const) {
    const home = new Map(PLACES.map(p => [lang === 'ar' ? p.ar : p.en, p.gov]));
    for (let seed = 1; seed <= 100; seed++) {
      const round = buildGovernorateRound(lang, 8, makeRng(seed));
      assert.equal(round.length, 8);
      assert.equal(new Set(round.map(q => q.subject)).size, 8);
      for (const q of round) {
        assertWellFormed(q, 4);
        assert.equal(q.options.length, 4);
        assert.equal(q.promptKey, 'playGovernoratesPrompt');
        assert.equal(q.correctId, home.get(q.subject!));
      }
    }
  }
});
