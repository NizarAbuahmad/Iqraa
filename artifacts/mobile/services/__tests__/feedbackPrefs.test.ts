import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SOUND_OFF_KEY, loadSoundOn, saveSoundOn } from '../publicGames/feedbackPrefs.ts';
import type { KeyValueStore } from '../publicGames/kvStore.ts';

const memory = (): KeyValueStore & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: async k => data.get(k) ?? null, setItem: async (k, v) => { data.set(k, v); } };
};
const broken: KeyValueStore = {
  getItem: async () => { throw new Error('storage unavailable'); },
  setItem: async () => { throw new Error('storage unavailable'); },
};

test('sound is on until someone turns it off', async () => {
  const store = memory();
  assert.equal(await loadSoundOn(store), true);
  await saveSoundOn(store, false);
  assert.equal(store.data.get(SOUND_OFF_KEY), '1');
  assert.equal(await loadSoundOn(store), false);
  await saveSoundOn(store, true);
  assert.equal(await loadSoundOn(store), true);
});

test('a storage that fails leaves sound on and never throws', async () => {
  assert.equal(await loadSoundOn(broken), true);
  await assert.doesNotReject(() => saveSoundOn(broken, false));
});
