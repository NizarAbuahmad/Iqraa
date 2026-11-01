/**
 * The «ما الجديد» ids marked seen since the app started, shared live between the
 * dialog's hook and the Profile screen. Storage is read once per account, so
 * without this a note read on /whats-new would open again in the dialog on the
 * way back home, in the same session.
 *
 * Module-level and read with `useSyncExternalStore`, like `tourStore.ts`. Pure,
 * so `node --test` can pin it. Per account: another account signed in on the same
 * device starts empty.
 */
import type { SeenIds } from './whatsNew.ts';

export type SessionSeen = { userId: string | null; ids: readonly string[] };

let current: SessionSeen = { userId: null, ids: [] };
const listeners = new Set<() => void>();

export function noteSeen(userId: string, ids: readonly string[]): void {
  const base = current.userId === userId ? current.ids : [];
  const fresh = ids.filter(id => !base.includes(id));
  if (fresh.length === 0 && current.userId === userId) return;
  current = { userId, ids: [...base, ...fresh] };
  listeners.forEach(l => l());
}

export function subscribeSeen(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The same object until something new is seen, as `useSyncExternalStore` requires. */
export function getSessionSeen(): SessionSeen {
  return current;
}

/** What storage said for `userId`, plus what this session has seen since. `null` (unread) and `'all'` pass through. */
export function withSessionSeen(stored: SeenIds | null, session: SessionSeen, userId: string | undefined): SeenIds | null {
  if (stored === null || stored === 'all' || !userId || session.userId !== userId) return stored;
  const extra = session.ids.filter(id => !stored.includes(id));
  return extra.length === 0 ? stored : [...stored, ...extra];
}

/** Test seam. */
export function resetSessionSeen(): void {
  current = { userId: null, ids: [] };
}
