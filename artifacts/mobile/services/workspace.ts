/**
 * Local workspace service — saves/loads teacher-generated materials via AsyncStorage.
 * All data lives under a single JSON array at STORAGE_KEY.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MaterialType = 'lesson' | 'worksheet' | 'quiz';

export interface SavedMaterial {
  id: string;
  type: MaterialType;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: 'ar' | 'en';
  savedAt: string; // ISO timestamp
  isFavorite: boolean;
  /** Full generator output, JSON-stringified */
  content: string;
  /** Form state so Edit can pre-fill the generator */
  formState: Record<string, any>;
}

const STORAGE_KEY = '@iqra_workspace_v1';

// ─── Internal helpers ─────────────────────────────────────────────────────────

async function readAll(): Promise<SavedMaterial[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedMaterial[];
  } catch {
    return [];
  }
}

async function writeAll(items: SavedMaterial[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function makeId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Save a new material. Returns the saved item. */
export async function saveItem(
  payload: Omit<SavedMaterial, 'id' | 'savedAt' | 'isFavorite'>,
): Promise<SavedMaterial> {
  const items = await readAll();
  const item: SavedMaterial = {
    ...payload,
    id: makeId(),
    savedAt: new Date().toISOString(),
    isFavorite: false,
  };
  items.unshift(item); // newest first
  await writeAll(items);
  return item;
}

/** Update an existing item (e.g. after editing and regenerating). */
export async function updateItem(
  id: string,
  updates: Partial<Omit<SavedMaterial, 'id'>>,
): Promise<void> {
  const items = await readAll();
  const idx = items.findIndex(i => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates, savedAt: new Date().toISOString() };
    // Move to front
    const [updated] = items.splice(idx, 1);
    items.unshift(updated);
    await writeAll(items);
  }
}

/** Delete an item by id. */
export async function deleteItem(id: string): Promise<void> {
  const items = await readAll();
  await writeAll(items.filter(i => i.id !== id));
}

/** Duplicate an item (creates a copy with a new id). */
export async function duplicateItem(id: string): Promise<SavedMaterial | null> {
  const items = await readAll();
  const original = items.find(i => i.id === id);
  if (!original) return null;
  const copy: SavedMaterial = {
    ...original,
    id: makeId(),
    savedAt: new Date().toISOString(),
    isFavorite: false,
  };
  items.unshift(copy);
  await writeAll(items);
  return copy;
}

/** Toggle the isFavorite flag. */
export async function toggleFavorite(id: string): Promise<void> {
  const items = await readAll();
  const item = items.find(i => i.id === id);
  if (item) {
    item.isFavorite = !item.isFavorite;
    await writeAll(items);
  }
}

/** Return all items, newest first. */
export async function getAllItems(): Promise<SavedMaterial[]> {
  return readAll();
}

/** Return the N most recently saved items across all types. */
export async function getRecentItems(n: number): Promise<SavedMaterial[]> {
  const all = await readAll();
  return all.slice(0, n);
}

/** Return items filtered by type, with optional keyword search.
 *  Favorites are sorted first when favoritesFirst=true. */
export async function getItems(opts: {
  type?: MaterialType;
  query?: string;
  favoritesFirst?: boolean;
}): Promise<SavedMaterial[]> {
  let items = await readAll();
  if (opts.type) items = items.filter(i => i.type === opts.type);
  if (opts.query?.trim()) {
    const q = opts.query.trim().toLowerCase();
    items = items.filter(
      i =>
        i.title.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.topic.toLowerCase().includes(q),
    );
  }
  if (opts.favoritesFirst) {
    items = [...items.filter(i => i.isFavorite), ...items.filter(i => !i.isFavorite)];
  }
  return items;
}

/** Load a single item by id. */
export async function getItem(id: string): Promise<SavedMaterial | null> {
  const items = await readAll();
  return items.find(i => i.id === id) ?? null;
}
