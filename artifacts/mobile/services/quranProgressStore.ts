/**
 * The one place memorisation progress lives while the app runs. Pure: storage
 * is injected, so this imports nothing from React or React Native and is tested
 * with bare `node --test`. `hooks/useQuranProgress.ts` creates the single
 * instance and subscribes screens to it.
 *
 * Why a shared store and not state in each hook call: the Quran Corner screens
 * are pushed onto one Stack, which keeps earlier screens mounted. Per-call state
 * went stale there (rate in the memorise screen, go back, and the reader's badges
 * still showed the old marks), and a second writing screen would have brought
 * back the lost update across instances. One snapshot per app means every
 * screen sees every rating and every write composes onto the latest marks.
 *
 * Two guards, both about not losing or mixing up a person's marks:
 *  - `rate` is ignored until the selected person's saved marks have been read,
 *    so a tap can never replace them with a one-mark blob.
 *  - Changing person bumps a generation. A read that settles after the change is
 *    dropped, and the snapshot is emptied at once, so one person's marks never
 *    show or save under another's key on a shared device.
 */
import { parseProgress, quranProgressKey, rateAyah, todayKey, type AyahStatus, type QuranProgress } from './quranProgress.ts';

export interface KeyValueStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
}

export interface ProgressSnapshot {
  /** The storage key this snapshot belongs to; null while the user is not yet known. */
  forKey: string | null;
  progress: QuranProgress;
  /** True once `forKey`'s saved marks have been read (or the read failed). */
  loaded: boolean;
}

export interface ProgressStore {
  /**
   * Point the store at a person. `undefined` = not known yet (session still
   * restoring): nothing is read, nothing can be saved. `null` = signed out (the
   * bare key). Selecting the key already selected does nothing.
   */
  select(userId: string | null | undefined): void;
  /** The SAME object until something changes (`useSyncExternalStore` needs a stable reference). */
  getSnapshot(): ProgressSnapshot;
  subscribe(listener: () => void): () => void;
  /** Bound closure with a stable identity: safe to pass around and to use in effect deps. */
  rate(surah: number, ayah: number, status: AyahStatus | null): void;
}

export function createProgressStore(storage: KeyValueStorage, today: () => string = todayKey): ProgressStore {
  let snapshot: ProgressSnapshot = { forKey: null, progress: {}, loaded: false };
  // Bumped on every real change of person; a read from an earlier one is stale.
  let generation = 0;
  const listeners = new Set<() => void>();

  const publish = (next: ProgressSnapshot) => {
    snapshot = next;
    // Iterate a copy, and skip anyone removed along the way.
    for (const listener of [...listeners]) {
      if (listeners.has(listener)) listener();
    }
  };

  const select = (userId: string | null | undefined): void => {
    const key = userId === undefined ? null : quranProgressKey(userId);
    if (key === snapshot.forKey) return;

    const mine = ++generation;
    publish({ forKey: key, progress: {}, loaded: false });
    if (key === null) return;

    storage
      .getItem(key)
      .then(
        raw => parseProgress(raw),
        // Storage can be unavailable (private window, blocked site data); the
        // screens still work with empty progress, and writes will fail the same way.
        () => ({}) as QuranProgress,
      )
      .then(progress => {
        if (mine !== generation) return;
        publish({ forKey: key, progress, loaded: true });
      });
  };

  const rate = (surah: number, ayah: number, status: AyahStatus | null): void => {
    const { forKey, progress, loaded } = snapshot;
    // Ignore a rating until this person's saved marks have been read: writing
    // now would replace them with a one-mark blob. Screens disable the buttons while !loaded.
    if (forKey === null || !loaded) return;
    const next = rateAyah(progress, surah, ayah, status, today());
    publish({ forKey, progress: next, loaded: true });
    storage.setItem(forKey, JSON.stringify(next)).catch(() => {});
  };

  return {
    select,
    getSnapshot: () => snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    rate,
  };
}
