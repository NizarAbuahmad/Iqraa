/**
 * What «ما الجديد» remembers per account on this device: the entries seen, and
 * the new tools opened (which takes their «جديد» away). The keys are built in
 * `whatsNew.ts` (the file `node --test` can load); this is only the AsyncStorage
 * I/O, in the shape of `tourStorage.ts`.
 *
 * Reads fail CLOSED: a broken store reads as "all seen" / "all opened", so a
 * device that cannot remember never nags and wears no badges. The worst a failed
 * write does is show a note or a badge once more on a later launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { newToolOpenedKey, whatsNewSeenKey, type SeenIds } from './whatsNew.ts';
import { noteSeen, noteToolsOpened } from './whatsNewSession.ts';

async function readIds(key: string): Promise<SeenIds> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : 'all';
  } catch {
    return 'all';
  }
}

async function addIds(key: string, ids: readonly string[]): Promise<void> {
  try {
    const before = await readIds(key);
    const merged = new Set(before === 'all' ? [] : before);
    ids.forEach(id => merged.add(id));
    await AsyncStorage.setItem(key, JSON.stringify([...merged]));
  } catch {
    // best-effort; see above
  }
}

export function getSeenWhatsNew(userId: string): Promise<SeenIds> {
  return readIds(whatsNewSeenKey(userId));
}

export async function markWhatsNewSeen(userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  // At once, before the write: the dialog's hook must not offer them again this session.
  noteSeen(userId, ids);
  await addIds(whatsNewSeenKey(userId), ids);
}

export function getOpenedNewTools(userId: string): Promise<SeenIds> {
  return readIds(newToolOpenedKey(userId));
}

export async function markNewToolsOpened(userId: string, toolIds: readonly string[]): Promise<void> {
  if (toolIds.length === 0) return;
  // At once: the card the teacher comes back to must already have lost its «جديد».
  noteToolsOpened(userId, toolIds);
  await addIds(newToolOpenedKey(userId), toolIds);
}
