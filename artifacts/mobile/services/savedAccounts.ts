/**
 * Device storage for the other accounts signed in on this phone.
 *
 * Two places, on purpose. The index (who, which role, when last used) is not a
 * credential and sits in AsyncStorage so the login screen can list it. Each
 * account's refresh token sits under its own SecureStore key — one value per key
 * keeps every entry far below the keychain's size warnings however many
 * accounts there are.
 *
 * Only inactive accounts are stored here. See accountList.ts for the rule that
 * makes that matter.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as storage from './secureStorage';
import {
  parseSavedAccounts,
  upsertSavedAccount,
  withoutSavedAccount,
  type SavedAccountMeta,
} from './accountList';

const INDEX_KEY = '@iqra_saved_accounts_v1';
const LAST_GOOGLE_KEY = '@iqra_last_google_email_v1';

// SecureStore keys allow letters, digits, '.', '-' and '_' — a UUID fits.
const tokenKey = (userId: string) => `iqra_saved_rt_${userId}`;

export async function loadSavedAccounts(): Promise<SavedAccountMeta[]> {
  try {
    return parseSavedAccounts(await AsyncStorage.getItem(INDEX_KEY));
  } catch {
    return [];
  }
}

export async function getSavedRefreshToken(userId: string): Promise<string | null> {
  try {
    return await storage.getItem(tokenKey(userId));
  } catch {
    return null;
  }
}

/** Throws `too_many_accounts` rather than silently dropping one the person kept. */
export async function saveAccount(meta: SavedAccountMeta, refreshToken: string): Promise<void> {
  const next = upsertSavedAccount(await loadSavedAccounts(), meta);
  if (!next) throw new Error('too_many_accounts');
  // Token first: an index entry with no token is a row that can only fail,
  // while a token with no index entry is merely invisible.
  await storage.setItem(tokenKey(meta.userId), refreshToken);
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(next));
}

/** Returns whether there was anything to remove. */
export async function removeSavedAccount(userId: string): Promise<boolean> {
  const list = await loadSavedAccounts();
  const had = list.some(a => a.userId === userId);
  await storage.deleteItem(tokenKey(userId));
  if (had) await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(withoutSavedAccount(list, userId)));
  return had;
}

/** The address of the last account that signed in through Google, for the hint on the login screen. */
export async function getLastGoogleEmail(): Promise<string | null> {
  try {
    return (await AsyncStorage.getItem(LAST_GOOGLE_KEY)) || null;
  } catch {
    return null;
  }
}

export async function setLastGoogleEmail(email: string): Promise<void> {
  try {
    await AsyncStorage.setItem(LAST_GOOGLE_KEY, email);
  } catch {
    // A hint; losing it costs nothing.
  }
}
