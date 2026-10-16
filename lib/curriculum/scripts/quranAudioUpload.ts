/**
 * The decisions behind `upload-quran-audio-r2.ts`, with every effect passed in
 * (`RunDeps`) so they run under `node --test` with a fake fetch and a fake
 * bucket. The CLI next door is only wiring. Same split as
 * `quranCornerBuild.ts` / `build-quran-corner.ts`.
 *
 * What a download must be before it is stored: HTTP 200, not an HTML/JSON
 * error page served with a 200, big enough to be a recording, and starting like
 * an MP3. A rejected file is reported by key and never uploaded — a student's
 * phone must not be handed an error page to play.
 */
import { createHash } from 'node:crypto';

import {
  QURAN_AUDIO_PREFIX,
  quranAudioAyahs,
  quranAudioFile,
  quranAudioKey,
  type QuranAudioAyah,
} from '../src/quranAudio.ts';

/** Where the recordings are copied FROM. One line to change, and a reviewed one. */
export const QURAN_AUDIO_SOURCE_BASE = 'https://everyayah.com/data/Husary_128kbps';

/** Below this a body is an error stub, not a recording (the shortest ayah is ~2 s of 128 kbps ≈ 32 KB). */
export const MIN_AUDIO_BYTES = 4096;

export function sourceUrl(a: QuranAudioAyah): string {
  return `${QURAN_AUDIO_SOURCE_BASE}/${quranAudioFile(a.surah, a.ayah)}`;
}

/** An `ID3` tag, or an MPEG audio frame sync (11 set bits). */
export function looksLikeMp3(b: Uint8Array): boolean {
  if (b.length < 3) return false;
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return true;
  return b[0] === 0xff && (b[1]! & 0xe0) === 0xe0;
}

/** `null` when the download may be stored, otherwise the reason it may not. */
export function checkDownload(r: {
  status: number;
  contentType: string | null;
  bytes: Uint8Array;
}): string | null {
  if (r.status !== 200) return `HTTP ${r.status}`;
  const type = (r.contentType ?? '').toLowerCase();
  if (type.startsWith('text/') || type.includes('html') || type.includes('json')) {
    return `not audio (${type})`;
  }
  if (r.bytes.length < MIN_AUDIO_BYTES) return `too small (${r.bytes.length} bytes)`;
  if (!looksLikeMp3(r.bytes)) return 'does not start like an MP3';
  return null;
}

/**
 * `--only 1:1,112:3` → the ayahs. Every one must be in the corner, so a typo
 * fails loudly instead of redoing nothing.
 */
export function parseOnly(arg: string | undefined): QuranAudioAyah[] | null {
  if (arg === undefined) return null;
  const held = new Set(quranAudioAyahs().map(a => `${a.surah}:${a.ayah}`));
  const out: QuranAudioAyah[] = [];
  for (const part of arg.split(',')) {
    const m = /^(\d+):(\d+)$/.exec(part.trim());
    if (!m || !held.has(`${Number(m[1])}:${Number(m[2])}`)) {
      throw new Error(`--only: "${part}" is not a surah:ayah the Quran Corner holds`);
    }
    out.push({ surah: Number(m[1]), ayah: Number(m[2]) });
  }
  return out;
}

/** What this run should do. `--only` means "redo these", so it ignores what exists. */
export function selectTodo(
  all: readonly QuranAudioAyah[],
  existingKeys: ReadonlySet<string>,
  opts: { force: boolean; only: QuranAudioAyah[] | null },
): QuranAudioAyah[] {
  if (opts.only) return opts.only;
  if (opts.force) return [...all];
  return all.filter(a => !existingKeys.has(quranAudioKey(a.surah, a.ayah)));
}

export interface ManifestEntry {
  surah: number;
  ayah: number;
  key: string;
  bytes: number;
  sha256: string;
  sourceUrl: string;
  fetchedAt: string;
}

export interface RunDeps {
  fetchAudio(url: string): Promise<{ status: number; contentType: string | null; bytes: Uint8Array }>;
  put(key: string, body: Uint8Array): Promise<void>;
  now(): Date;
  log(line: string): void;
  /**
   * Called right after each successful `put`, so the manifest can be written
   * per upload and an interrupted run still leaves every stored file recorded.
   * If it throws, the run stops: nothing more is stored that could not be recorded.
   */
  onUploaded?(entry: ManifestEntry): void;
}

export interface RunReport {
  planned: number;
  uploaded: ManifestEntry[];
  rejected: { key: string; reason: string }[];
  /** Set when storage refused us; the run stopped at once. */
  aborted: string | null;
}

/** Thrown by `RunDeps.put` when the bucket refuses the credentials: not worth trying 584 more times. */
export class StorageAuthError extends Error {}

const byKey = (a: { key: string }, b: { key: string }): number => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

export async function runUpload(
  todo: readonly QuranAudioAyah[],
  deps: RunDeps,
  opts: { concurrency?: number; dryRun?: boolean } = {},
): Promise<RunReport> {
  const report: RunReport = { planned: todo.length, uploaded: [], rejected: [], aborted: null };
  if (opts.dryRun) return report;

  let next = 0;
  async function worker(): Promise<void> {
    while (report.aborted === null) {
      const a = todo[next++];
      if (!a) return;
      const key = quranAudioKey(a.surah, a.ayah);
      const url = sourceUrl(a);

      let got;
      try {
        got = await deps.fetchAudio(url);
      } catch (err) {
        report.rejected.push({ key, reason: `fetch failed: ${(err as Error).message}` });
        continue;
      }
      const bad = checkDownload(got);
      if (bad) {
        report.rejected.push({ key, reason: bad });
        continue;
      }
      try {
        await deps.put(key, got.bytes);
      } catch (err) {
        if (err instanceof StorageAuthError) {
          report.aborted = err.message;
          return;
        }
        report.rejected.push({ key, reason: `upload failed: ${(err as Error).message}` });
        continue;
      }
      const entry: ManifestEntry = {
        surah: a.surah,
        ayah: a.ayah,
        key,
        bytes: got.bytes.length,
        sha256: createHash('sha256').update(got.bytes).digest('hex'),
        sourceUrl: url,
        fetchedAt: deps.now().toISOString(),
      };
      report.uploaded.push(entry);
      deps.log(`  ${key}`);
      try {
        deps.onUploaded?.(entry);
      } catch (err) {
        report.aborted = `manifest write failed: ${(err as Error).message}`;
        return;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, opts.concurrency ?? 4) }, worker));
  report.uploaded.sort(byKey);
  report.rejected.sort(byKey);
  return report;
}

/** A fresh entry replaces an old one for the same key; the file stays sorted so a diff is readable. */
export function mergeManifest(
  existing: readonly ManifestEntry[],
  fresh: readonly ManifestEntry[],
): ManifestEntry[] {
  const byKeyMap = new Map<string, ManifestEntry>();
  for (const e of existing) byKeyMap.set(e.key, e);
  for (const e of fresh) byKeyMap.set(e.key, e);
  return [...byKeyMap.values()].sort(byKey);
}

export { QURAN_AUDIO_PREFIX };
