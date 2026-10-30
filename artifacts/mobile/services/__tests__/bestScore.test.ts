import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bestKey, isBetter, loadBest, recordBest } from '../publicGames/bestScore.ts';
import type { KeyValueStore } from '../publicGames/kvStore.ts';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
};
const broken: KeyValueStore = {
  getItem: async () => { throw new Error('x'); },
  setItem: async () => { throw new Error('x'); },
};

test('better compares the share right, so rounds of different length are fair', () => {
  assert.equal(isBetter({ score: 6, total: 8 }, { score: 5, total: 8 }), true);
  assert.equal(isBetter({ score: 3, total: 4 }, { score: 5, total: 8 }), true); // 75% vs 62.5%
  assert.equal(isBetter({ score: 4, total: 8 }, { score: 2, total: 4 }), false); // equal
  assert.equal(isBetter({ score: 1, total: 8 }, { score: 5, total: 8 }), false);
});

test('the first play sets the best but is not a "new best"', async () => {
  const store = memory();
  const r = await recordBest(store, 'playFlagsTitle', { score: 5, total: 8 });
  assert.deepEqual(r, { best: { score: 5, total: 8 }, previous: null, isNewBest: false });
  assert.deepEqual(await loadBest(store, 'playFlagsTitle'), { score: 5, total: 8 });
});

test('a better round replaces the best; an equal or worse one keeps it', async () => {
  const store = memory();
  await recordBest(store, 'g', { score: 5, total: 8 });
  const up = await recordBest(store, 'g', { score: 7, total: 8 });
  assert.equal(up.isNewBest, true);
  assert.deepEqual(up.best, { score: 7, total: 8 });
  const same = await recordBest(store, 'g', { score: 7, total: 8 });
  assert.equal(same.isNewBest, false);
  const down = await recordBest(store, 'g', { score: 2, total: 8 });
  assert.equal(down.isNewBest, false);
  assert.deepEqual(down.best, { score: 7, total: 8 });
  assert.deepEqual(await loadBest(store, 'g'), { score: 7, total: 8 });
});

test('games keep separate bests', async () => {
  const store = memory();
  await recordBest(store, 'a', { score: 8, total: 8 });
  assert.equal(await loadBest(store, 'b'), null);
  assert.equal(bestKey('a'), '@iqra_play_best_v1:a');
});

test('a corrupt entry is ignored, and a failing store never throws', async () => {
  const store = memory();
  store.data.set(bestKey('g'), '{"score":9,"total":8}');
  assert.equal(await loadBest(store, 'g'), null);
  store.data.set(bestKey('g'), 'not json');
  assert.equal(await loadBest(store, 'g'), null);
  const r = await recordBest(broken, 'g', { score: 3, total: 8 });
  assert.deepEqual(r, { best: { score: 3, total: 8 }, previous: null, isNewBest: false });
});

test('an empty round (total 0) is never recorded', async () => {
  const store = memory();
  const r = await recordBest(store, 'g', { score: 0, total: 0 });
  assert.equal(store.data.size, 0);
  assert.equal(r.isNewBest, false);
});
