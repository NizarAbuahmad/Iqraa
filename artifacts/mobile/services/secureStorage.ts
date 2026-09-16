/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): delegates to expo-secure-store (encrypted keychain/keystore).
 * - Web: falls back to `localStorage`.
 *
 * **The web target is production.** This comment used to say it was "only used
 * for Replit preview / development simulation", and that stopped being true when
 * `deploy.yml` began publishing `artifacts/mobile/dist` to Cloudflare Pages as
 * app.iqrra.com. Corrected 2026-09-16; the security review of 2026-09-16 (M-1)
 * lists fixing this sentence as the cheapest of its four options precisely
 * because someone reading it would conclude the exposure below is hypothetical.
 *
 * It is not. `localStorage` is readable by any script on the origin, the refresh
 * token stored here lives 30 days, and `public/_headers` deliberately carries
 * `frame-ancestors` only — no `script-src` — so an XSS on app.iqrra.com is a
 * 30-day account takeover rather than a 15-minute one.
 *
 * Still open, and none of it belongs in this file: a shorter refresh lifetime
 * for web clients, refresh-token reuse detection, or the `script-src` CSP that
 * `_headers` defers. What belongs here is not misleading the next reader.
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

export async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try { return localStorage.getItem(key); } catch { return null; }
  }
  return SecureStore.getItemAsync(key);
}

export async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.setItem(key, value); } catch { /* ignore */ }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
