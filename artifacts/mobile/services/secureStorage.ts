/**
 * Platform-aware secure storage.
 *
 * - Native (iOS/Android): delegates to expo-secure-store (encrypted keychain/keystore).
 * - Web / Expo web simulation: falls back to localStorage.
 *   localStorage is NOT secure for production web, but Iqra is a native-first app;
 *   the web target is only used for Replit preview / development simulation.
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
