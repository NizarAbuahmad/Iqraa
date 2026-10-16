/**
 * Fetchers for the school-notification switches. Split from pushPrefs.ts
 * because apiClient pulls in react-native at module scope, which `node --test`
 * cannot load — the same split as homeworkApi.ts. No test file: the logic is
 * tested in pushPrefs.ts. Both throw on any failure; the screen chooses words.
 */
import { apiJson } from './apiClient.ts';
import { normalizePushPrefs, type PushPrefCategory, type PushPrefs } from './pushPrefs.ts';

const PATH = '/auth/me/push-preferences';

export async function fetchPushPrefs(): Promise<PushPrefs> {
  const prefs = normalizePushPrefs(await apiJson<unknown>(PATH));
  if (!prefs) throw new Error('bad_response');
  return prefs;
}

export async function savePushPref(category: PushPrefCategory, on: boolean): Promise<PushPrefs> {
  const prefs = normalizePushPrefs(await apiJson<unknown>(PATH, { method: 'PUT', body: JSON.stringify({ [category]: on }) }));
  if (!prefs) throw new Error('bad_response');
  return prefs;
}
