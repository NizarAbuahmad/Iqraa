/**
 * What «ما الجديد» has learned since the app started, shared live between the
 * screens that read it: the entries marked seen (the dialog's hook and the
 * Profile screen) and the new tools opened (the «جديد» on their cards). Storage
 * is read once per account, so without this a note read on /whats-new would open
 * again in the dialog on the way back home, and a new tool's card would keep its
 * «جديد» after the teacher had just opened it.
 *
 * Module-level and read with `useSyncExternalStore`, like `tourStore.ts`. Pure,
 * so `node --test` can pin it. Per account: another account signed in on the same
 * device starts empty.
 */
import type { SeenIds } from './whatsNew.ts';

export type SessionSeen = { userId: string | null; ids: readonly string[] };

function sessionList() {
  let current: SessionSeen = { userId: null, ids: [] };
  const listeners = new Set<() => void>();
  return {
    note(userId: string, ids: readonly string[]): void {
      const base = current.userId === userId ? current.ids : [];
      const fresh = ids.filter(id => !base.includes(id));
      if (fresh.length === 0 && current.userId === userId) return;
      current = { userId, ids: [...base, ...fresh] };
      listeners.forEach(l => l());
    },
    subscribe(listener: () => void): () => void {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    /** The same object until something new is noted, as `useSyncExternalStore` requires. */
    get(): SessionSeen {
      return current;
    },
    reset(): void {
      current = { userId: null, ids: [] };
    },
  };
}

const seen = sessionList();
const toolsOpened = sessionList();

export const noteSeen = seen.note;
export const subscribeSeen = seen.subscribe;
export const getSessionSeen = seen.get;

export const noteToolsOpened = toolsOpened.note;
export const subscribeToolsOpened = toolsOpened.subscribe;
export const getSessionToolsOpened = toolsOpened.get;

/** What storage said for `userId`, plus what this session has noted since. `null` (unread) and `'all'` pass through. */
export function withSessionSeen(stored: SeenIds | null, session: SessionSeen, userId: string | undefined): SeenIds | null {
  if (stored === null || stored === 'all' || !userId || session.userId !== userId) return stored;
  const extra = session.ids.filter(id => !stored.includes(id));
  return extra.length === 0 ? stored : [...stored, ...extra];
}

/** Test seam. */
export function resetSessionSeen(): void {
  seen.reset();
  toolsOpened.reset();
}
