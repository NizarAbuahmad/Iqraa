/**
 * The last user `/auth/me` answered with, cached so a launch with no network
 * can still open the app.
 *
 * Boot used to be: `/auth/me` fails for any reason → clear both tokens → login
 * screen. A real expired token never reaches that path (apiFetch refreshes on
 * 401), so it fired almost only on the failures where clearing is wrong — a
 * 15s timeout on a cold API, a basement, a 502 page. The teacher re-entered
 * credentials that could not be checked either. With a snapshot, the app
 * opens on what it last knew and the next request refreshes as usual.
 *
 * Not a credential: it holds the profile fields, nothing that authenticates.
 * Written whenever the signed-in user changes, removed on sign-out, and read
 * only on a boot that could not reach the server.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@iqra_user_snapshot_v1';

export async function saveUserSnapshot(user: object | null): Promise<void> {
  try {
    if (user) await AsyncStorage.setItem(KEY, JSON.stringify(user));
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // Storage is a convenience here; failing to cache must not block boot.
  }
}

export async function readUserSnapshot<T>(): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as T & { id?: unknown };
    return parsed && typeof parsed.id === 'string' ? parsed : null;
  } catch {
    return null;
  }
}
