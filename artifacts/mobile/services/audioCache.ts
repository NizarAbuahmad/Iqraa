/**
 * The English clips a phone keeps, so a tap plays from the device instead of the
 * network every time (`englishAudio.ts`), and a lesson's clips can be fetched
 * ahead when it opens. The rules are in `audioCachePolicy.ts`; the file system
 * comes in as an `FsLike` — `audioCacheStore.ts` gives the real one — so every
 * decision here is tested with a fake (`__tests__/audioCache.test.ts`).
 *
 * No `react-native` / `expo-*` import, so `node --test` can load it.
 *
 * Never throws or rejects: a clip that is not saved plays from the network, as
 * it always did.
 *
 * Last use: neither platform's file API sets a file's modification time, so a
 * clip's "last used" is its modification time (when it was saved) until it is
 * tapped this session; a tap is remembered in memory. After a restart the order
 * is "when saved" again — good enough for a cap the corner rarely reaches.
 */
import {
  AUDIO_CACHE_CAP_BYTES,
  AUDIO_CACHE_ROOT,
  AUDIO_CACHE_VERSION,
  MIN_CLIP_BYTES,
  MP3_SNIFF_BYTES,
  PREFETCH_CONCURRENCY,
  audioCacheFolder,
  cacheFileName,
  createFailureMemory,
  isTempFile,
  looksLikeMp3,
  lruVictims,
  runLimited,
  slugFromCacheFile,
  staleVersionEntries,
  statusFromDownloadError,
  tempFileName,
  type FailureMemory,
} from './audioCachePolicy.ts';

/** A path is its segments under the app's cache directory: `['english-audio', 'v1', 'cat.mp3']`. */
export type FsPath = string[];

export interface FsEntry {
  name: string;
  isDir: boolean;
  size: number;
  /** Milliseconds since epoch; 0 when unknown. */
  mtime: number;
}

/** The slice of a file system the cache needs. Any method may throw. */
export interface FsLike {
  /** The entries directly in a folder; `[]` when it does not exist. */
  listDir(path: FsPath): FsEntry[];
  /** Creates a folder and its parents; fine if it exists. */
  ensureDir(path: FsPath): void;
  exists(path: FsPath): boolean;
  /** Bytes; 0 when missing. */
  size(path: FsPath): number;
  /** The first `n` bytes of a file (fewer if it is shorter). */
  head(path: FsPath, n: number): Uint8Array;
  /** What a player is handed (`file:///…`). */
  uri(path: FsPath): string;
  /** Deletes a file or a folder with everything in it. */
  remove(path: FsPath): void;
  /** Renames within the folder; throws if `to` exists. */
  move(from: FsPath, to: FsPath): void;
  /** Rejects on a non-2xx (status in the message — see `statusFromDownloadError`) or a dropped connection. */
  download(url: string, to: FsPath): Promise<void>;
}

export interface AudioCache {
  /** The saved copy's URI, or null (never saved, or the OS cleared it). A hit counts as a use. */
  localUri(slug: string): string | null;
  /**
   * Saves a copy in the background (after a tap) unless one exists, one is on its way, or the
   * link said not to. Queued ahead of prefetch items still waiting for a slot.
   */
  save(slug: string): Promise<void>;
  /**
   * Saves each of `slugs` in the background. Replaces the previous prefetch: its items not yet
   * started are dropped. Every download, prefetch or save, shares `PREFETCH_CONCURRENCY` slots.
   */
  prefetch(slugs: readonly string[]): Prefetch;
}

export interface Prefetch {
  /** Resolves when this prefetch has nothing left to do (finished, replaced or cancelled). Never rejects. */
  done: Promise<void>;
  /** Stops it taking more items; a download already in flight finishes. No effect once replaced. */
  cancel(): void;
}

export interface AudioCacheOptions {
  fs: FsLike;
  urlFor(slug: string): string;
  now?: () => number;
  capBytes?: number;
  version?: number;
  failures?: FailureMemory;
}

export function createAudioCache(opts: AudioCacheOptions): AudioCache {
  const { fs, urlFor } = opts;
  const now = opts.now ?? Date.now;
  const capBytes = opts.capBytes ?? AUDIO_CACHE_CAP_BYTES;
  const version = opts.version ?? AUDIO_CACHE_VERSION;
  const failures = opts.failures ?? createFailureMemory(now);
  const dir: FsPath = [AUDIO_CACHE_ROOT, audioCacheFolder(version)];
  const at = (name: string): FsPath => [...dir, name];

  /** slug → what is on disk. Null until the folder has been read (once per session). */
  let index: Map<string, { size: number; lastUsed: number }> | null = null;

  const tryRemove = (path: FsPath) => {
    try {
      fs.remove(path);
    } catch {
      // Already gone, or cannot be removed: it is never in the index either way.
    }
  };

  function evict(): void {
    if (!index) return;
    const clips = [...index].map(([slug, f]) => ({ name: slug, size: f.size, lastUsed: f.lastUsed }));
    for (const slug of lruVictims(clips, capBytes)) {
      tryRemove(at(cacheFileName(slug)));
      index.delete(slug);
    }
  }

  /** Reads the folder once: drops other versions, half-downloads and too-small files, then trims to the cap. */
  function load(): Map<string, { size: number; lastUsed: number }> {
    if (index) return index;
    for (const name of staleVersionEntries(fs.listDir([AUDIO_CACHE_ROOT]).map(e => e.name), version)) {
      tryRemove([AUDIO_CACHE_ROOT, name]);
    }
    fs.ensureDir(dir);
    const found = new Map<string, { size: number; lastUsed: number }>();
    for (const e of fs.listDir(dir)) {
      const slug = e.isDir ? null : slugFromCacheFile(e.name);
      if (!slug || isTempFile(e.name) || e.size < MIN_CLIP_BYTES) {
        tryRemove(at(e.name));
        continue;
      }
      found.set(slug, { size: e.size, lastUsed: e.mtime });
    }
    index = found;
    evict();
    return index;
  }

  /** Whether a saved copy is there now. The index can be stale: the OS may clear the folder under us. */
  function present(slug: string): boolean {
    const idx = load();
    if (!idx.has(slug)) return false;
    if (fs.exists(at(cacheFileName(slug)))) return true;
    idx.delete(slug);
    return false;
  }

  function localUri(slug: string): string | null {
    try {
      if (!present(slug)) return null;
      load().get(slug)!.lastUsed = now();
      return fs.uri(at(cacheFileName(slug)));
    } catch {
      return null;
    }
  }

  // ─── One limit for every download ───────────────────────────────────────
  // `PREFETCH_CONCURRENCY` slots shared by every prefetch and every save after a
  // tap, so the rate-limited link never sees more than that from this phone. A
  // tap's save is queued ahead of prefetch items still waiting.
  let active = 0;
  const waiting: (() => void)[] = [];
  const acquire = (urgent: boolean): Promise<void> =>
    new Promise(resolve => {
      const go = () => {
        active++;
        resolve();
      };
      if (active < PREFETCH_CONCURRENCY) go();
      else if (urgent) waiting.unshift(go);
      else waiting.push(go);
    });
  const release = () => {
    active--;
    waiting.shift()?.();
  };

  /** Downloads one clip into place, in a slot the caller holds. */
  async function transfer(slug: string): Promise<void> {
    const tmp = at(tempFileName(slug));
    const dest = at(cacheFileName(slug));
    try {
      const idx = load();
      fs.ensureDir(dir); // the OS may have cleared the cache folder since `load()` made it
      tryRemove(tmp); // a leftover would make the download refuse to overwrite it
      try {
        await fs.download(urlFor(slug), tmp);
      } catch (err) {
        failures.note(slug, statusFromDownloadError(err));
        return;
      }
      const size = fs.size(tmp);
      if (size < MIN_CLIP_BYTES) return;
      if (!looksLikeMp3(fs.head(tmp, MP3_SNIFF_BYTES))) {
        // A 200 that is not a clip (a block page): as good as missing for this session.
        failures.note(slug, 404);
        return;
      }
      if (fs.exists(dest)) tryRemove(dest);
      fs.move(tmp, dest);
      idx.set(slug, { size, lastUsed: now() });
      evict();
    } catch {
      // Not saved: the clip plays from the network.
    } finally {
      tryRemove(tmp); // after a move there is nothing here; after a failure there must not be
    }
  }

  /** A clip on its way. `wanted` is the prefetch that asked for it; null once a tap wants it too. */
  interface Job {
    wanted: (() => boolean) | null;
    done: Promise<void>;
  }
  const jobs = new Map<string, Job>();

  function enqueue(slug: string, wanted: (() => boolean) | null): Promise<void> {
    try {
      if (!slug) return Promise.resolve();
      const existing = jobs.get(slug);
      if (existing) {
        if (!wanted) existing.wanted = null; // a tap keeps it wanted whatever the prefetch does
        return existing.done;
      }
      if (present(slug) || failures.shouldSkip(slug)) return Promise.resolve();
      const job: Job = { wanted, done: Promise.resolve() };
      job.done = (async () => {
        await acquire(!wanted);
        try {
          // Checked again in the slot: a newer prefetch, a cancel or a 429 may have come while it waited.
          if (job.wanted && !job.wanted()) return;
          if (failures.shouldSkip(slug) || present(slug)) return;
          await transfer(slug);
        } catch {
          // Not saved.
        } finally {
          release();
          jobs.delete(slug);
        }
      })();
      jobs.set(slug, job);
      return job.done;
    } catch {
      return Promise.resolve();
    }
  }

  function save(slug: string): Promise<void> {
    return enqueue(slug, null);
  }

  /** Bumped by every prefetch and by its cancel: a prefetch runs only while it is the newest. */
  let generation = 0;

  function prefetch(slugs: readonly string[]): Prefetch {
    const mine = ++generation;
    const wanted = () => generation === mine;
    const done = runLimited([...new Set(slugs)], PREFETCH_CONCURRENCY, async slug => {
      if (wanted()) await enqueue(slug, wanted);
    });
    return {
      done,
      cancel() {
        if (generation === mine) generation++;
      },
    };
  }

  return { localUri, save, prefetch };
}
