/**
 * Workspace service — saves/loads teacher-generated materials.
 *
 * Strategy:
 *  - When authenticated (token in SecureStore): use the /workspace/items API.
 *    Falls back to AsyncStorage on network failure and syncs pending changes on reconnect.
 *  - When unauthenticated: use AsyncStorage only (legacy behavior preserved).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiFetch, getAccessToken } from './apiClient';
import { trackEvent } from './analytics';

// 'activity' is a first-class kind: it is stage 3 of the lesson flow, a CQV
// artifact type ('classroom-activity'), and already has a `materialActivity`
// label and a ContinueMaterialKind member. It was missing here, which made the
// `item.type === 'activity'` branch in continueTeaching.ts provably dead — so a
// saved activity arriving without formState was silently labelled a lesson.
export type MaterialType = 'lesson' | 'worksheet' | 'quiz' | 'flow' | 'activity' | 'slides';

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
  /**
   * The class this material is attached to, or null/undefined for none.
   * Set from the class screen, not at save time — see `app/classes/[id].tsx`.
   */
  classGroupId?: string | null;
}

const LOCAL_KEY = '@iqra_workspace_v1';
const PENDING_SYNC_KEY = '@iqra_workspace_pending_sync_v1';

// ─── Auth helpers ──────────────────────────────────────────────────────────────

async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

// ─── Local helpers ─────────────────────────────────────────────────────────────

async function readLocal(): Promise<SavedMaterial[]> {
  try {
    const raw = await AsyncStorage.getItem(LOCAL_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedMaterial[];
  } catch {
    return [];
  }
}

async function writeLocal(items: SavedMaterial[]): Promise<void> {
  await AsyncStorage.setItem(LOCAL_KEY, JSON.stringify(items));
}

function makeLocalId(): string {
  return `ws_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── API helpers ───────────────────────────────────────────────────────────────

type ApiItem = {
  id: string;
  type: string;
  title: string;
  subject: string;
  grade: string;
  topic: string;
  language: string;
  content: string;
  formState: Record<string, any>;
  isFavorite: boolean;
  classGroupId?: string | null;
  savedAt: string;
};

function apiToLocal(item: ApiItem): SavedMaterial {
  return {
    id: item.id,
    classGroupId: item.classGroupId ?? null,
    type: item.type as MaterialType,
    title: item.title,
    subject: item.subject,
    grade: item.grade,
    topic: item.topic,
    language: item.language as 'ar' | 'en',
    content: item.content,
    formState: item.formState ?? {},
    isFavorite: item.isFavorite,
    savedAt: item.savedAt,
  };
}

async function apiGet<T>(path: string): Promise<T | null> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
  }
}

// ─── Public API ────────────────────────────────────────────────────────────────

/** Save a new material. Returns the saved item. */
export async function saveItem(
  payload: Omit<SavedMaterial, 'id' | 'savedAt' | 'isFavorite'>,
): Promise<SavedMaterial> {
  // Fired on the attempt, not gated on which storage path succeeds — the
  // teacher choosing to keep this material is the signal, not where it landed.
  trackEvent('material_saved', { type: payload.type });

  if (await isAuthenticated()) {
    try {
      const res = await apiFetch('/workspace/items', {
        method: 'POST',
        body: JSON.stringify({
          type: payload.type,
          title: payload.title,
          subject: payload.subject,
          grade: payload.grade,
          topic: payload.topic,
          language: payload.language,
          content: payload.content,
          formState: payload.formState,
          classGroupId: payload.classGroupId ?? null,
        }),
      });
      if (res.ok) {
        const item = await res.json() as ApiItem;
        return apiToLocal(item);
      }
    } catch {
      // fall through to local
    }
  }

  // Local fallback
  const items = await readLocal();
  const item: SavedMaterial = {
    ...payload,
    id: makeLocalId(),
    savedAt: new Date().toISOString(),
    isFavorite: false,
  };
  items.unshift(item);
  await writeLocal(items);
  return item;
}

/**
 * Update an existing item. **Returns whether the change actually persisted.**
 *
 * It used to return `void` and swallow every failure, which was fine while the
 * only callers were favourite toggles that re-read the list afterwards. Then
 * "attach this material to a class" started reporting «حُفظت في العاشر أ» from
 * a toast that fired no matter what — so an offline teacher, or one on a server
 * that has not had the schema push, was told the material was filed when it was
 * not. Callers that tell the teacher something worked have to be able to ask.
 */
export async function updateItem(
  id: string,
  updates: Partial<Omit<SavedMaterial, 'id'>>,
): Promise<boolean> {
  if (await isAuthenticated()) {
    try {
      const res = await apiFetch(`/workspace/items/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: updates.title,
          subject: updates.subject,
          grade: updates.grade,
          topic: updates.topic,
          language: updates.language,
          content: updates.content,
          formState: updates.formState,
          isFavorite: updates.isFavorite,
          classGroupId: updates.classGroupId,
        }),
      });
      if (res.ok) return true;
    } catch {
      // fall through to local
    }
  }

  // Local fallback. For a signed-out teacher this *is* the store, so landing
  // here is a real save. For a signed-in one whose request just failed, the
  // item usually is not in local storage at all — and that is the case worth
  // reporting, because nothing was written anywhere.
  const items = await readLocal();
  const idx = items.findIndex((i) => i.id === id);
  if (idx !== -1) {
    items[idx] = { ...items[idx], ...updates, savedAt: new Date().toISOString() };
    const [updated] = items.splice(idx, 1);
    items.unshift(updated);
    await writeLocal(items);
    return true;
  }
  return false;
}

/** Delete an item by id. */
export async function deleteItem(id: string): Promise<void> {
  if (await isAuthenticated()) {
    try {
      const res = await apiFetch(`/workspace/items/${id}`, { method: 'DELETE' });
      if (res.ok) return;
    } catch {
      // fall through to local
    }
  }
  const items = await readLocal();
  await writeLocal(items.filter((i) => i.id !== id));
}

/** Duplicate an item (creates a copy with a new id). */
export async function duplicateItem(id: string): Promise<SavedMaterial | null> {
  if (await isAuthenticated()) {
    try {
      const res = await apiFetch(`/workspace/items/${id}/duplicate`, { method: 'POST' });
      if (res.ok) {
        const item = await res.json() as ApiItem;
        return apiToLocal(item);
      }
    } catch {
      // fall through to local
    }
  }

  const items = await readLocal();
  const original = items.find((i) => i.id === id);
  if (!original) return null;
  const copy: SavedMaterial = {
    ...original,
    id: makeLocalId(),
    savedAt: new Date().toISOString(),
    isFavorite: false,
  };
  items.unshift(copy);
  await writeLocal(items);
  return copy;
}

/** Toggle the isFavorite flag. */
export async function toggleFavorite(id: string): Promise<void> {
  if (await isAuthenticated()) {
    try {
      // First fetch current state
      const res = await apiFetch(`/workspace/items/${id}`);
      if (res.ok) {
        const item = await res.json() as ApiItem;
        const patchRes = await apiFetch(`/workspace/items/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ isFavorite: !item.isFavorite }),
        });
        if (patchRes.ok) return;
      }
    } catch {
      // fall through to local
    }
  }

  const items = await readLocal();
  const item = items.find((i) => i.id === id);
  if (item) {
    item.isFavorite = !item.isFavorite;
    await writeLocal(items);
  }
}

/** Return all items, newest first. */
export async function getAllItems(): Promise<SavedMaterial[]> {
  return getItems({});
}

/** Return the N most recently saved items across all types. */
export async function getRecentItems(n: number): Promise<SavedMaterial[]> {
  const all = await getAllItems();
  return all.slice(0, n);
}

/** Return items filtered by type, with optional keyword search.
 *  Favorites are sorted first when favoritesFirst=true. */
export async function getItems(opts: {
  type?: MaterialType;
  query?: string;
  favoritesFirst?: boolean;
  /** Only materials attached to this class. */
  classId?: string;
}): Promise<SavedMaterial[]> {
  if (await isAuthenticated()) {
    const params = new URLSearchParams();
    if (opts.type) params.set('type', opts.type);
    if (opts.query?.trim()) params.set('query', opts.query.trim());
    if (opts.favoritesFirst) params.set('favoritesFirst', 'true');
    if (opts.classId) params.set('classId', opts.classId);

    const data = await apiGet<ApiItem[]>(`/workspace/items?${params.toString()}`);
    if (data !== null) {
      return data.map(apiToLocal);
    }
    // Network failed — fall through to local
  }

  let items = await readLocal();
  if (opts.type) items = items.filter((i) => i.type === opts.type);
  if (opts.classId) items = items.filter((i) => i.classGroupId === opts.classId);
  if (opts.query?.trim()) {
    const q = opts.query.trim().toLowerCase();
    items = items.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        i.subject.toLowerCase().includes(q) ||
        i.topic.toLowerCase().includes(q),
    );
  }
  if (opts.favoritesFirst) {
    items = [
      ...items.filter((i) => i.isFavorite),
      ...items.filter((i) => !i.isFavorite),
    ];
  }
  return items;
}

/** Seed the workspace with demo content for onboarding / investor demos. */
export async function seedDemoData(): Promise<void> {
  const existing = await readLocal();
  if (existing.length > 0) return; // only seed if empty

  const now = new Date();
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3600000).toISOString();

  const demoItems: SavedMaterial[] = [
    {
      id: makeLocalId(),
      type: 'lesson',
      title: 'خطة درس – المعادلات التربيعية',
      subject: 'الرياضيات',
      grade: 'الصف العاشر',
      topic: 'المعادلات التربيعية',
      language: 'ar',
      savedAt: hoursAgo(20),
      isFavorite: true,
      content: JSON.stringify({
        title: 'المعادلات التربيعية',
        objectives: ['حل المعادلة التربيعية بالتحليل', 'استخدام القانون العام'],
      }),
      formState: {
        subject: 'الرياضيات',
        grade: 'الصف العاشر',
        topic: 'المعادلات التربيعية',
        language: 'arabic',
        unitNumber: 3,
        lessonNumber: 2,
        lessonTitle: 'حل المعادلات التربيعية',
        unitTitle: 'المعادلات التربيعية',
        materialKind: 'lesson',
      },
    },
    {
      id: makeLocalId(),
      type: 'worksheet',
      title: 'ورقة عمل – المعادلات التربيعية',
      subject: 'الرياضيات',
      grade: 'الصف العاشر',
      topic: 'المعادلات التربيعية',
      language: 'ar',
      savedAt: hoursAgo(30),
      isFavorite: false,
      content: JSON.stringify({ title: 'المعادلات التربيعية', sections: [] }),
      formState: {
        subject: 'الرياضيات',
        grade: 'الصف العاشر',
        topic: 'المعادلات التربيعية',
        language: 'arabic',
        unitNumber: 3,
        lessonNumber: 2,
        lessonTitle: 'حل المعادلات التربيعية',
        unitTitle: 'المعادلات التربيعية',
        materialKind: 'worksheet',
      },
    },
    {
      id: makeLocalId(),
      type: 'quiz',
      title: 'اختبار – المعادلات التربيعية',
      subject: 'الرياضيات',
      grade: 'الصف العاشر',
      topic: 'المعادلات التربيعية',
      language: 'ar',
      savedAt: hoursAgo(48),
      isFavorite: true,
      content: JSON.stringify({ title: 'المعادلات التربيعية', questions: [] }),
      formState: { subject: 'الرياضيات', grade: 'الصف العاشر', topic: 'المعادلات التربيعية', language: 'arabic', unitNumber: 3 },
    },
    {
      id: makeLocalId(),
      type: 'lesson',
      title: 'Lesson Plan – Quadratic Equations',
      subject: 'Mathematics',
      grade: 'Grade 10',
      topic: 'Quadratic Equations',
      language: 'en',
      savedAt: hoursAgo(72),
      isFavorite: false,
      content: JSON.stringify({
        title: 'Quadratic Equations',
        objectives: ['Solve by factoring', 'Apply the quadratic formula'],
      }),
      formState: {
        subject: 'Mathematics',
        grade: 'Grade 10',
        topic: 'Quadratic Equations',
        language: 'english',
        unitNumber: 3,
        lessonNumber: 2,
        lessonTitle: 'Solving Quadratic Equations',
        unitTitle: 'Quadratic Equations',
        materialKind: 'lesson',
      },
    },
  ];

  await writeLocal(demoItems);
}

/** Load a single item by id. */
export async function getItem(id: string): Promise<SavedMaterial | null> {
  if (await isAuthenticated()) {
    const data = await apiGet<ApiItem>(`/workspace/items/${id}`);
    if (data !== null) return apiToLocal(data);
  }

  const items = await readLocal();
  return items.find((i) => i.id === id) ?? null;
}
