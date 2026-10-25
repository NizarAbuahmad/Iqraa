/**
 * The rules for the English clips a phone keeps (`audioCache.ts` applies them,
 * `audioCacheStore.ts` is the file system). Pure: no `react-native` / `expo-*`
 * import, so `node --test` can load it.
 *
 * Where: `<cache>/english-audio/v<AUDIO_CACHE_VERSION>/<slug>.mp3` — the same
 * object name the bucket uses, so a saved copy is checked against the bucket by
 * eye. The OS may clear a cache directory at any time; a missing file is a miss.
 */

/**
 * Bump after re-recording clips that phones may already hold: on next use every
 * folder of another version is deleted, so the new recordings are fetched again.
 * The slug does not change when a clip is re-voiced, so without a bump a phone
 * keeps playing the old one until the OS clears its cache.
 */
export const AUDIO_CACHE_VERSION = 1;

/** The folder under the app's cache directory. */
export const AUDIO_CACHE_ROOT = 'english-audio';

export function audioCacheFolder(version: number = AUDIO_CACHE_VERSION): string {
  return `v${version}`;
}

/**
 * Total size kept; over it, the least recently used clips go. Far above what the corner needs:
 * the bucket's manifest listed 652 clips totalling 3.8 MB (checked 2026-10-24).
 */
export const AUDIO_CACHE_CAP_BYTES = 40 * 1024 * 1024;

/**
 * Below this a download is not kept. The shortest clip in the bucket's manifest is
 * 2.7 KB («earth», checked 2026-10-24), so anything under 1 KB is a truncated
 * body or an error page — playing it would be a clipped word or silence.
 */
export const MIN_CLIP_BYTES = 1024;

/**
 * How many bytes `looksLikeMp3` reads from the start of a download.
 */
export const MP3_SNIFF_BYTES = 3;

/**
 * Whether a downloaded body starts like an MP3: an ID3 tag ("ID3"), or an MPEG
 * frame sync (0xFF, then a byte whose top three bits are set). A 200 that is a
 * block page or an error document passes the size floor but not this, and would
 * otherwise be kept and "played" as silence for good.
 */
export function looksLikeMp3(head: Uint8Array): boolean {
  if (head.length >= 3 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) return true;
  return head.length >= 2 && head[0] === 0xff && (head[1] & 0xe0) === 0xe0;
}

/** Background downloads in flight at once, across the whole cache (every prefetch and every save after a tap). */
export const PREFETCH_CONCURRENCY = 2;

/** After a 429 the background fetchers wait this long before trying the link again. */
export const RATE_LIMIT_COOLDOWN_MS = 60_000;

const CLIP_EXT = '.mp3';
const TEMP_EXT = '.part';

export function cacheFileName(slug: string): string {
  return `${slug}${CLIP_EXT}`;
}

/** The slug a saved clip holds, or null for anything that is not one (a temp file, a stray). */
export function slugFromCacheFile(name: string): string | null {
  return name.endsWith(CLIP_EXT) && name.length > CLIP_EXT.length ? name.slice(0, -CLIP_EXT.length) : null;
}

/** Where a download lands before it is checked and renamed into place. Never ends in `.mp3`. */
export function tempFileName(slug: string): string {
  return `${slug}${CLIP_EXT}${TEMP_EXT}`;
}

export function isTempFile(name: string): boolean {
  return name.endsWith(TEMP_EXT);
}

/** Everything directly under the root that is not this version's folder: old versions, and strays. */
export function staleVersionEntries(names: string[], version: number = AUDIO_CACHE_VERSION): string[] {
  const keep = audioCacheFolder(version);
  return names.filter(n => n !== keep);
}

export interface CachedClip {
  name: string;
  size: number;
  /** Milliseconds; the file's modification time, or the last tap this session. */
  lastUsed: number;
}

/** The clips to delete, least recently used first, until the rest fit under `capBytes`. */
export function lruVictims(files: readonly CachedClip[], capBytes: number): string[] {
  let total = files.reduce((n, f) => n + f.size, 0);
  if (total <= capBytes) return [];
  const order = [...files].sort((a, b) => a.lastUsed - b.lastUsed || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  const out: string[] = [];
  for (const f of order) {
    if (total <= capBytes) break;
    out.push(f.name);
    total -= f.size;
  }
  return out;
}

/**
 * The HTTP status in an `expo-file-system` download error, or null (offline,
 * timeout, anything else). The module puts it only in the message:
 * "response has status: 404" on Android, "response has status 404" on iOS.
 */
export function statusFromDownloadError(err: unknown): number | null {
  const msg = err instanceof Error ? err.message : typeof err === 'string' ? err : '';
  const m = /status:?\s*(\d{3})\b/.exec(msg);
  return m ? Number(m[1]) : null;
}

export interface FailureMemory {
  note(slug: string, status: number | null): void;
  /** Whether a background fetch of `slug` should be skipped now. A tap never asks. */
  shouldSkip(slug: string): boolean;
}

/**
 * What the background fetchers remember this session, in memory only. A 404 is a
 * clip the generator has not made: skipped until the app restarts. A 429 is the
 * `r2.dev` link's rate limit, which is the link's and not the clip's, so it
 * pauses every background fetch for the cool-down. Anything else (offline, a 500)
 * is not remembered: the next try may well work.
 */
export function createFailureMemory(now: () => number = Date.now, cooldownMs: number = RATE_LIMIT_COOLDOWN_MS): FailureMemory {
  const missing = new Set<string>();
  let coolUntil = 0;
  return {
    note(slug, status) {
      if (status === 404) missing.add(slug);
      else if (status === 429) coolUntil = Math.max(coolUntil, now() + cooldownMs);
    },
    shouldSkip(slug) {
      return missing.has(slug) || now() < coolUntil;
    },
  };
}

/** Runs `fn` over `items` with at most `limit` in flight. Never rejects; one failure does not stop the rest. */
export async function runLimited<T>(items: readonly T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await fn(item);
      } catch {
        // A background fetch that fails is a clip played from the network later.
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
}
