/**
 * The «اقترح ميزة» text, kept so it survives the screen being torn down — a
 * session that ends mid-typing sends the teacher to login, and the idea they
 * wrote must still be there when they come back.
 *
 * Global, not per-user, for the same reason: the user it belongs to is the one
 * who just signed out. Cleared on a successful send.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@iqra_suggestion_draft_v1';

export async function loadSuggestionDraft(): Promise<string> {
  try {
    return (await AsyncStorage.getItem(KEY)) ?? '';
  } catch {
    return '';
  }
}

/** Empty text removes the entry. Best-effort: a failed write loses a draft, never the screen. */
export async function saveSuggestionDraft(text: string): Promise<void> {
  try {
    if (text) await AsyncStorage.setItem(KEY, text);
    else await AsyncStorage.removeItem(KEY);
  } catch {
    // nothing to do
  }
}
