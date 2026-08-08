/**
 * Teacher-attached media per lesson (Class Mode).
 *
 * Stored per user + per lesson topic so a science teacher can pin a diagram
 * or a YouTube clip to "بنية الذرة" once and have it appear on the class
 * screen every time they teach it.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = '@iqra_lesson_media_v1';

export type LessonMediaItem = {
  kind: 'image' | 'video';
  url: string;
  caption: string;
};

type MediaMap = Record<string, LessonMediaItem[]>;

/** Scoped by the signed-in user, mirroring lessonContext. */
let activeUserId: string | null = null;

export function setActiveMediaUser(userId: string | null): void {
  activeUserId = userId;
}

function storageKey(): string {
  return activeUserId ? `${KEY}:${activeUserId}` : KEY;
}

function lessonKey(topic: string): string {
  return topic.trim().toLowerCase();
}

async function readAll(): Promise<MediaMap> {
  try {
    const raw = await AsyncStorage.getItem(storageKey());
    return raw ? (JSON.parse(raw) as MediaMap) : {};
  } catch {
    return {};
  }
}

export async function getLessonMedia(topic: string): Promise<LessonMediaItem[]> {
  if (!topic.trim()) return [];
  const all = await readAll();
  return all[lessonKey(topic)] ?? [];
}

export async function addLessonMedia(topic: string, item: LessonMediaItem): Promise<void> {
  if (!topic.trim()) return;
  const all = await readAll();
  const k = lessonKey(topic);
  const list = all[k] ?? [];
  // Same URL twice adds nothing to a class screen.
  if (list.some(m => m.url === item.url)) return;
  all[k] = [...list, item];
  try {
    await AsyncStorage.setItem(storageKey(), JSON.stringify(all));
  } catch {
    // non-fatal
  }
}

export async function removeLessonMedia(topic: string, url: string): Promise<void> {
  const all = await readAll();
  const k = lessonKey(topic);
  if (!all[k]) return;
  all[k] = all[k]!.filter(m => m.url !== url);
  try {
    await AsyncStorage.setItem(storageKey(), JSON.stringify(all));
  } catch {
    // non-fatal
  }
}
