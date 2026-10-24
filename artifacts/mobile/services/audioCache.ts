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
  PREFETCH_CONCURRENCY,
  audioCacheFolder,
  cacheFileName,
  createFailureMemory,
  isTempFile,
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
  /** Saves a copy in the background unless one exists, one is on its way, or the link said not to. */
  save(slug: string): Promise<void>;
  /** Saves each of `slugs`, `PREFETCH_CONCURRENCY` at a time. */
  prefetch(slugs: readonly string[]): Promise<void>;
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
  const inFlight = new Map<string, Promise<void>>();

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

  async function download(slug: string): Promise<void> {
    const tmp = at(tempFileName(slug));
    const dest = at(cacheFileName(slug));
    try {
      const idx = load();
      tryRemove(tmp); // a leftover would make the download refuse to overwrite it
      try {
        await fs.download(urlFor(slug), tmp);
      } catch (err) {
        failures.note(slug, statusFromDownloadError(err));
        return;
      }
      const size = fs.size(tmp);
      if (size < MIN_CLIP_BYTES) return;
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

  function save(slug: string): Promise<void> {
    try {
      if (!slug) return Promise.resolve();
      if (present(slug)) return Promise.resolve();
      const pending = inFlight.get(slug);
      if (pending) return pending;
      if (failures.shouldSkip(slug)) return Promise.resolve();
      const p = download(slug).finally(() => inFlight.delete(slug));
      inFlight.set(slug, p);
      return p;
    } catch {
      return Promise.resolve();
    }
  }

  async function prefetch(slugs: readonly string[]): Promise<void> {
    await runLimited([...new Set(slugs)], PREFETCH_CONCURRENCY, save);
  }

  return { localUri, save, prefetch };
}
