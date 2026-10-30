/**
 * Which «ما الجديد» entries this account has seen on this device. The key is
 * built in `whatsNew.ts` (the file `node --test` can load); this is only the
 * AsyncStorage I/O, in the shape of `tourStorage.ts`.
 *
 * The read fails CLOSED: a broken store reads as "all seen", so a device that
 * cannot remember never nags. The worst a failed write does is show a note once
 * more on a later launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { whatsNewSeenKey, type SeenIds } from './whatsNew.ts';
import { noteSeen } from './whatsNewSession.ts';

export async function getSeenWhatsNew(userId: string): Promise<SeenIds> {
  try {
    const raw = await AsyncStorage.getItem(whatsNewSeenKey(userId));
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : 'all';
  } catch {
    return 'all';
  }
}

export async function markWhatsNewSeen(userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  // At once, before the write: the dialog's hook must not offer them again this session.
  noteSeen(userId, ids);
  try {
    const before = await getSeenWhatsNew(userId);
    const merged = new Set(before === 'all' ? [] : before);
    ids.forEach(id => merged.add(id));
    await AsyncStorage.setItem(whatsNewSeenKey(userId), JSON.stringify([...merged]));
  } catch {
    // best-effort; see above
  }
}
