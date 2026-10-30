/**
 * Whether the /play games make sound. On until someone turns it off; kept on
 * the device, for every game at once. Best-effort: a store that fails leaves
 * sound on and never throws into a game.
 */
import type { KeyValueStore } from './kvStore.ts';

export const SOUND_OFF_KEY = '@iqra_play_sound_off_v1';

export async function loadSoundOn(store: KeyValueStore): Promise<boolean> {
  try {
    return (await store.getItem(SOUND_OFF_KEY)) !== '1';
  } catch {
    return true;
  }
}

export async function saveSoundOn(store: KeyValueStore, on: boolean): Promise<void> {
  try {
    await store.setItem(SOUND_OFF_KEY, on ? '0' : '1');
  } catch {
    // nothing to do
  }
}
