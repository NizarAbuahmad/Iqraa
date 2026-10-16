# Quran Corner Recitation Audio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a student listen to Sheikh Mahmoud Khalil Al-Husary's recitation of each ayah in the Quran Corner, then hide the words and recite, with the audio gated off until the files are uploaded.

**Architecture:** A pure key/URL builder in `lib/curriculum` is the one place that names a recording. An owner-run script copies the 585 per-ayah MP3s into the public R2 bucket under that key. The mobile app gets a small player (`expo-audio` native, `<audio>` on web) driven by a pure playlist reducer, a pure "one audio at a time" registry shared with the English word player, and a source-constant gate (`QURAN_AUDIO_UPLOADED`, false) that hides every listen control until the owner flips it.

**Tech Stack:** TypeScript, Node `--experimental-strip-types --test`, `expo-audio` ~1.1.1 (already installed, no native change), `@aws-sdk/client-s3` (already a dev dependency of `lib/curriculum`), React Native / expo-router.

**Spec:** `docs/superpowers/specs/2026-10-16-quran-audio-design.md` (Task 6 corrects six lines of it where this plan found the spec wrong).

## Global Constraints

- **No native change, no `app.json` version bump.** `expo-audio` is already a dependency and a config plugin. Do not add a package, an `expo-*` module or touch `android/`.
- **Pure modules import no `react-native` / `expo-*`** and use explicit `.ts` extensions in anything loaded by `node --test` (CLAUDE.md). Mobile tests live in `artifacts/mobile/services/__tests__/`; `lib/curriculum` tests live in `lib/curriculum/src/__tests__/`. A test outside those globs never runs.
- **Gate:** `QURAN_AUDIO_UPLOADED = false` ships. It is a source constant, **not** an `EXPO_PUBLIC_*` variable. `__DEV__` always shows the controls.
- **Honesty:** the app plays a recitation and never hears one. Playing audio never sets progress. Nothing in this slice claims the recordings are verified.
- **Design scale:** new `.tsx` uses `TYPE`, `SPACE`, `RADIUS` steps from `artifacts/mobile/constants/theme.ts` (`designScale.test.ts` fails a new off-scale font size, radius or spacing).
- **No placeholders for owner work:** the script is written and unit-tested here; it is **not run** here (the sandbox proxy refuses every audio host). Nothing may claim a recording was fetched, played or measured.
- **i18n:** every new key goes in both `ar` and `en` blocks of `artifacts/mobile/services/i18n.ts` (`i18n.test.ts` fails on a missing key).
- **Commits:** one per task (or per module inside Task 3), message ends with the session's attribution trailer.
- **Branch:** `claude/happy-bell-hgl63h` (PR NizarAbuahmad/Iqraa#1089, draft).

## File Structure

| File | Create/Modify | Responsibility |
| --- | --- | --- |
| `lib/curriculum/src/quranAudio.ts` | Create | Key, URL and ayah list for the recordings. Pure. |
| `lib/curriculum/src/__tests__/quranAudio.test.ts` | Create | Pins the 585 keys. |
| `lib/curriculum/package.json` | Modify | Export `./quran-audio`; script `quran-audio`. |
| `lib/curriculum/scripts/quranAudioUpload.ts` | Create | Pure/injectable upload logic (checks, plan, run, manifest merge). |
| `lib/curriculum/scripts/upload-quran-audio-r2.ts` | Create | Thin CLI: S3 + fetch wiring, argv, manifest file. |
| `lib/curriculum/src/__tests__/quranAudioUpload.test.ts` | Create | Tests the upload logic with fakes. |
| `artifacts/mobile/services/audioExclusive.ts` | Create | "One audio at a time" registry. Pure. |
| `artifacts/mobile/services/quranPlaylist.ts` | Create | Queue + start/advance/stop reducer. Pure. |
| `artifacts/mobile/services/quranAudioRelease.ts` | Create | The gate. Pure. |
| `artifacts/mobile/services/__tests__/audioExclusive.test.ts`, `quranPlaylist.test.ts`, `quranAudioRelease.test.ts` | Create | Tests for the three. |
| `artifacts/mobile/services/quranAudio.ts` | Create | The player and its tiny store (RN; typechecked, not unit-tested). |
| `artifacts/mobile/hooks/useQuranAudio.ts` | Create | React binding + gate + stop-on-leave. |
| `artifacts/mobile/services/englishAudio.ts` | Modify | Register a stop and claim before playing. |
| `artifacts/mobile/services/i18n.ts` | Modify | Five keys, Arabic and English. |
| `artifacts/mobile/components/quran/QuranAudioControls.tsx` | Create | `QuranListenButton`, `QuranAudioNote`. |
| `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx` | Modify | Reader controls. |
| `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx` | Modify | Memorise control. |
| `lib/curriculum/sources/quran-audio/VERIFY.md` | Create | Hand-written owner checklist (the existing `quran-ws/VERIFY.md` is generated; do not touch it). |
| `docs/superpowers/specs/2026-10-16-quran-audio-design.md`, `STATUS.md` | Modify | Corrections and the honest status bullet. |

---

### Task 1: The key, URL and ayah list

**Files:**
- Create: `lib/curriculum/src/quranAudio.ts`
- Create: `lib/curriculum/src/__tests__/quranAudio.test.ts`
- Modify: `lib/curriculum/package.json`

**Interfaces:**
- Consumes: `QURAN_SURAHS` from `lib/curriculum/src/quran.ts` (`readonly QuranSurah[]`, each with `number: number` and `ayahs: { n: number; text: string }[]`).
- Produces (later tasks rely on these exact names):
  - `QURAN_AUDIO_ORIGIN: string`
  - `QURAN_AUDIO_PREFIX = 'quran-audio/husary'`
  - `QURAN_AUDIO_RECITER: { nameAr: string; nameEn: string; style: 'murattal' }`
  - `interface QuranAudioAyah { surah: number; ayah: number }`
  - `quranAudioFile(surah: number, ayah: number): string` → `'SSSAAA.mp3'`
  - `quranAudioKey(surah: number, ayah: number): string` → `'quran-audio/husary/SSSAAA.mp3'`
  - `quranAyahAudioUrl(surah: number, ayah: number): string` → `${ORIGIN}/${key}`
  - `quranAudioAyahs(): QuranAudioAyah[]`
  - package subpath `@workspace/curriculum/quran-audio`

- [ ] **Step 1: Write the failing test**

Create `lib/curriculum/src/__tests__/quranAudio.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_SURAHS } from '../quran.ts';
import {
  QURAN_AUDIO_ORIGIN,
  QURAN_AUDIO_PREFIX,
  quranAudioAyahs,
  quranAudioFile,
  quranAudioKey,
  quranAyahAudioUrl,
} from '../quranAudio.ts';

describe('quranAudioKey', () => {
  it('pads surah and ayah to three digits', () => {
    assert.equal(quranAudioFile(1, 1), '001001.mp3');
    assert.equal(quranAudioFile(2, 255), '002255.mp3');
    assert.equal(quranAudioFile(114, 6), '114006.mp3');
    assert.equal(quranAudioKey(1, 1), 'quran-audio/husary/001001.mp3');
    assert.equal(quranAudioKey(2, 255), 'quran-audio/husary/002255.mp3');
    assert.equal(quranAudioKey(114, 6), 'quran-audio/husary/114006.mp3');
  });

  it('builds the public URL from the origin and the key', () => {
    assert.equal(quranAyahAudioUrl(112, 1), `${QURAN_AUDIO_ORIGIN}/${QURAN_AUDIO_PREFIX}/112001.mp3`);
    assert.ok(QURAN_AUDIO_ORIGIN.startsWith('https://'));
    assert.ok(!QURAN_AUDIO_ORIGIN.endsWith('/'));
  });

  it('throws on a reference that cannot exist, so a bad call is a test failure and not a 404', () => {
    for (const [s, a] of [
      [0, 1], [115, 1], [-1, 1], [1.5, 1], [1, 0], [1, -1], [1, 287], [1, 2.5], [NaN, 1], [1, NaN],
    ] as const) {
      assert.throws(() => quranAudioKey(s, a), RangeError, `${s}:${a}`);
    }
  });
});

describe('quranAudioAyahs', () => {
  const list = quranAudioAyahs();

  it('is exactly the 585 ayahs the corner holds, in the corner’s order', () => {
    assert.equal(list.length, 585);
    const expected = QURAN_SURAHS.flatMap(s => s.ayahs.map(a => ({ surah: s.number, ayah: a.n })));
    assert.deepEqual(list, expected);
  });

  it('gives every ayah a well-formed, unique key', () => {
    const keys = list.map(a => quranAudioKey(a.surah, a.ayah));
    for (const k of keys) assert.match(k, /^quran-audio\/husary\/\d{6}\.mp3$/);
    assert.equal(new Set(keys).size, keys.length);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd /home/user/Iqraa/lib/curriculum && node --experimental-strip-types --test src/__tests__/quranAudio.test.ts`
Expected: FAIL — `Cannot find module '../quranAudio.ts'`.

- [ ] **Step 3: Write the module**

Create `lib/curriculum/src/quranAudio.ts`:

```ts
/**
 * Where the Quran Corner's recitation audio lives, and the one place that
 * names a recording. The upload script (`scripts/upload-quran-audio-r2.ts`)
 * and the app (`artifacts/mobile/services/quranAudio.ts`) both build keys
 * here, so the file a script stores and the file a phone asks for cannot
 * drift apart.
 *
 * One MP3 per ayah, for exactly the ayahs in `quran_corner.json` — the ones
 * the grade 1–10 lesson titles name — never for whole surahs. The reciter is
 * Sheikh Mahmoud Khalil Al-Husary, murattal. NOTHING here says the recordings
 * exist yet: `QURAN_AUDIO_UPLOADED` in the app hides every control until
 * someone has run the upload and listened (see
 * `sources/quran-audio/VERIFY.md`).
 */
import { QURAN_SURAHS } from './quran.ts';

/** `iqraa-public`'s anonymous-read origin on R2 (same host as `BOOK_FIGURE_BASE_URL`). */
export const QURAN_AUDIO_ORIGIN = 'https://pub-d9ddd8f74e734a21824518b812652124.r2.dev';

/** The key prefix inside the bucket. A second reciter would be a sibling prefix. */
export const QURAN_AUDIO_PREFIX = 'quran-audio/husary';

export const QURAN_AUDIO_RECITER = {
  nameAr: 'محمود خليل الحصري',
  nameEn: 'Mahmoud Khalil Al-Husary',
  style: 'murattal',
} as const;

export interface QuranAudioAyah {
  surah: number;
  ayah: number;
}

/** Al-Baqarah, the longest surah — the highest ayah number that can exist. */
const MAX_AYAH = 286;

function assertRef(surah: number, ayah: number): void {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) {
    throw new RangeError(`surah must be an integer 1–114, got ${surah}`);
  }
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > MAX_AYAH) {
    throw new RangeError(`ayah must be an integer 1–${MAX_AYAH}, got ${ayah}`);
  }
}

const pad3 = (n: number): string => String(n).padStart(3, '0');

/** `SSSAAA.mp3` — also the file name the source publishes it under. */
export function quranAudioFile(surah: number, ayah: number): string {
  assertRef(surah, ayah);
  return `${pad3(surah)}${pad3(ayah)}.mp3`;
}

export function quranAudioKey(surah: number, ayah: number): string {
  return `${QURAN_AUDIO_PREFIX}/${quranAudioFile(surah, ayah)}`;
}

export function quranAyahAudioUrl(surah: number, ayah: number): string {
  return `${QURAN_AUDIO_ORIGIN}/${quranAudioKey(surah, ayah)}`;
}

/** Every ayah the corner holds — derived from the data, never hand-listed. */
export function quranAudioAyahs(): QuranAudioAyah[] {
  return QURAN_SURAHS.flatMap(s => s.ayahs.map(a => ({ surah: s.number, ayah: a.n })));
}
```

- [ ] **Step 4: Add the package subpath and the script entry**

In `lib/curriculum/package.json`, change
`    "./quran": "./src/quran.ts",` to
```
    "./quran": "./src/quran.ts",
    "./quran-audio": "./src/quranAudio.ts",
```
and change
`    "english-audio": "node --experimental-strip-types scripts/generate-english-audio.ts",` to
```
    "english-audio": "node --experimental-strip-types scripts/generate-english-audio.ts",
    "quran-audio": "node --experimental-strip-types scripts/upload-quran-audio-r2.ts",
```

- [ ] **Step 5: Run the test and the package typecheck**

Run: `cd /home/user/Iqraa/lib/curriculum && node --experimental-strip-types --test src/__tests__/quranAudio.test.ts && pnpm run typecheck`
Expected: the test passes (all tests green) and `tsc` prints nothing. (The `quran-audio` script's target file does not exist yet — that is fine until Task 2.)

- [ ] **Step 6: Commit**

```bash
cd /home/user/Iqraa
git add lib/curriculum/src/quranAudio.ts lib/curriculum/src/__tests__/quranAudio.test.ts lib/curriculum/package.json
git commit -m "Quran audio: one place that names a recording (key, URL, the 585 ayahs)"
```

---

### Task 2: The upload script

**Files:**
- Create: `lib/curriculum/scripts/quranAudioUpload.ts`
- Create: `lib/curriculum/scripts/upload-quran-audio-r2.ts`
- Create: `lib/curriculum/src/__tests__/quranAudioUpload.test.ts`

**Interfaces:**
- Consumes: from Task 1 — `QURAN_AUDIO_PREFIX`, `quranAudioAyahs()`, `quranAudioFile()`, `quranAudioKey()`, `type QuranAudioAyah` (all from `../src/quranAudio.ts`).
- Produces (the CLI and the tests rely on these exact names, exported from `scripts/quranAudioUpload.ts`):
  - `QURAN_AUDIO_SOURCE_BASE = 'https://everyayah.com/data/Husary_128kbps'`
  - `MIN_AUDIO_BYTES = 4096`
  - `sourceUrl(a: QuranAudioAyah): string`
  - `looksLikeMp3(b: Uint8Array): boolean`
  - `checkDownload(r: { status: number; contentType: string | null; bytes: Uint8Array }): string | null`
  - `parseOnly(arg: string | undefined): QuranAudioAyah[] | null`
  - `selectTodo(all: readonly QuranAudioAyah[], existingKeys: ReadonlySet<string>, opts: { force: boolean; only: QuranAudioAyah[] | null }): QuranAudioAyah[]`
  - `interface ManifestEntry { surah: number; ayah: number; key: string; bytes: number; sha256: string; sourceUrl: string; fetchedAt: string }`
  - `interface RunDeps { fetchAudio(url: string): Promise<{ status: number; contentType: string | null; bytes: Uint8Array }>; put(key: string, body: Uint8Array): Promise<void>; now(): Date; log(line: string): void }`
  - `interface RunReport { planned: number; uploaded: ManifestEntry[]; rejected: { key: string; reason: string }[]; aborted: string | null }`
  - `class StorageAuthError extends Error`
  - `runUpload(todo: readonly QuranAudioAyah[], deps: RunDeps, opts?: { concurrency?: number; dryRun?: boolean }): Promise<RunReport>`
  - `mergeManifest(existing: readonly ManifestEntry[], fresh: readonly ManifestEntry[]): ManifestEntry[]`

- [ ] **Step 1: Write the failing tests**

Create `lib/curriculum/src/__tests__/quranAudioUpload.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { quranAudioAyahs, quranAudioKey } from '../quranAudio.ts';
import {
  MIN_AUDIO_BYTES,
  QURAN_AUDIO_SOURCE_BASE,
  StorageAuthError,
  checkDownload,
  looksLikeMp3,
  mergeManifest,
  parseOnly,
  runUpload,
  selectTodo,
  sourceUrl,
  type ManifestEntry,
  type RunDeps,
} from '../../scripts/quranAudioUpload.ts';

const A = (surah: number, ayah: number) => ({ surah, ayah });
const mp3 = (n = MIN_AUDIO_BYTES + 100): Uint8Array => {
  const b = new Uint8Array(n);
  b[0] = 0xff;
  b[1] = 0xfb;
  return b;
};
const good = (bytes = mp3()) => ({ status: 200, contentType: 'audio/mpeg', bytes });

function fakeDeps(over: Partial<RunDeps> = {}) {
  const fetched: string[] = [];
  const put: string[] = [];
  const logs: string[] = [];
  const deps: RunDeps = {
    fetchAudio: async url => {
      fetched.push(url);
      return good();
    },
    put: async key => {
      put.push(key);
    },
    now: () => new Date('2026-10-16T00:00:00Z'),
    log: l => logs.push(l),
    ...over,
  };
  return { deps, fetched, put, logs };
}

describe('sourceUrl', () => {
  it('uses the source’s own SSSAAA.mp3 names', () => {
    assert.equal(sourceUrl(A(1, 1)), `${QURAN_AUDIO_SOURCE_BASE}/001001.mp3`);
    assert.equal(sourceUrl(A(2, 255)), `${QURAN_AUDIO_SOURCE_BASE}/002255.mp3`);
  });
});

describe('looksLikeMp3', () => {
  it('accepts an ID3 tag and an MPEG frame sync', () => {
    assert.equal(looksLikeMp3(Uint8Array.from([0x49, 0x44, 0x33, 4])), true);
    assert.equal(looksLikeMp3(Uint8Array.from([0xff, 0xfb, 0x90])), true);
  });
  it('rejects HTML, empty and too-short bodies', () => {
    assert.equal(looksLikeMp3(new TextEncoder().encode('<!doctype html>')), false);
    assert.equal(looksLikeMp3(new Uint8Array(0)), false);
    assert.equal(looksLikeMp3(Uint8Array.from([0xff, 0xfb])), false);
  });
});

describe('checkDownload', () => {
  it('passes a real-looking MP3', () => {
    assert.equal(checkDownload(good()), null);
    assert.equal(checkDownload({ ...good(), contentType: 'application/octet-stream' }), null);
    assert.equal(checkDownload({ ...good(), contentType: null }), null);
  });
  it('names the reason for each failure', () => {
    assert.equal(checkDownload({ ...good(), status: 404 }), 'HTTP 404');
    assert.match(checkDownload({ ...good(), contentType: 'text/html' }) ?? '', /^not audio/);
    assert.match(checkDownload({ ...good(mp3(10)) }) ?? '', /^too small/);
    const notMp3 = new Uint8Array(MIN_AUDIO_BYTES + 1);
    assert.equal(checkDownload({ ...good(notMp3) }), 'does not start like an MP3');
  });
});

describe('parseOnly', () => {
  const list = quranAudioAyahs();
  const first = list[0]!;
  const last = list[list.length - 1]!;

  it('is null when --only is absent', () => {
    assert.equal(parseOnly(undefined), null);
  });
  it('reads surah:ayah pairs the corner holds', () => {
    assert.deepEqual(parseOnly(`${first.surah}:${first.ayah},${last.surah}:${last.ayah}`), [first, last]);
  });
  it('throws on a malformed or unknown reference, so a typo never silently redoes nothing', () => {
    assert.throws(() => parseOnly('abc'));
    assert.throws(() => parseOnly('1'));
    assert.throws(() => parseOnly('1:99'));
    assert.throws(() => parseOnly(''));
  });
});

describe('selectTodo', () => {
  const all = quranAudioAyahs();
  const first = all[0]!;
  const existing = new Set([quranAudioKey(first.surah, first.ayah)]);

  it('does only what is missing', () => {
    const todo = selectTodo(all, existing, { force: false, only: null });
    assert.equal(todo.length, all.length - 1);
    assert.ok(!todo.some(a => a.surah === first.surah && a.ayah === first.ayah));
  });
  it('--force redoes everything', () => {
    assert.equal(selectTodo(all, existing, { force: true, only: null }).length, all.length);
  });
  it('--only redoes exactly those, even if they already exist', () => {
    assert.deepEqual(selectTodo(all, existing, { force: false, only: [first] }), [first]);
  });
});

describe('runUpload', () => {
  const todo = [A(1, 1), A(1, 2), A(1, 3)];

  it('fetches from the source, stores under the shared key and records a manifest entry', async () => {
    const { deps, fetched, put } = fakeDeps();
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.deepEqual(put, todo.map(a => quranAudioKey(a.surah, a.ayah)));
    assert.deepEqual(fetched, todo.map(sourceUrl));
    assert.equal(r.uploaded.length, 3);
    assert.equal(r.rejected.length, 0);
    assert.equal(r.aborted, null);
    const e = r.uploaded[0]!;
    assert.equal(e.key, quranAudioKey(1, 1));
    assert.equal(e.bytes, MIN_AUDIO_BYTES + 100);
    assert.match(e.sha256, /^[0-9a-f]{64}$/);
    assert.equal(e.sourceUrl, sourceUrl(A(1, 1)));
    assert.equal(e.fetchedAt, '2026-10-16T00:00:00.000Z');
  });

  it('never stores a rejected download and exits the report with the reason', async () => {
    const html = { status: 200, contentType: 'text/html', bytes: new TextEncoder().encode('<html>') };
    let n = 0;
    const { deps, put } = fakeDeps({ fetchAudio: async () => (++n === 2 ? html : good()) });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(put.length, 2);
    assert.ok(!put.includes(quranAudioKey(1, 2)));
    assert.deepEqual(r.rejected.map(x => x.key), [quranAudioKey(1, 2)]);
    assert.match(r.rejected[0]!.reason, /^not audio/);
  });

  it('rejects a body that is too small', async () => {
    const { deps, put } = fakeDeps({ fetchAudio: async () => good(mp3(10)) });
    const r = await runUpload([A(1, 1)], deps, { concurrency: 1 });
    assert.equal(put.length, 0);
    assert.match(r.rejected[0]!.reason, /^too small/);
  });

  it('turns a thrown fetch into a rejection and carries on', async () => {
    let n = 0;
    const { deps } = fakeDeps({
      fetchAudio: async () => {
        if (++n === 1) throw new Error('socket hang up');
        return good();
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(r.uploaded.length, 2);
    assert.match(r.rejected[0]!.reason, /socket hang up/);
  });

  it('stops at the first storage auth refusal and fetches nothing more', async () => {
    const { deps, fetched } = fakeDeps({
      put: async () => {
        throw new StorageAuthError('403 from iqraa-public');
      },
    });
    const r = await runUpload(todo, deps, { concurrency: 1 });
    assert.equal(r.aborted, '403 from iqraa-public');
    assert.equal(fetched.length, 1);
    assert.equal(r.uploaded.length, 0);
  });

  it('--dry-run neither fetches nor stores', async () => {
    const { deps, fetched, put } = fakeDeps();
    const r = await runUpload(todo, deps, { dryRun: true });
    assert.equal(fetched.length, 0);
    assert.equal(put.length, 0);
    assert.equal(r.planned, 3);
    assert.equal(r.uploaded.length, 0);
  });
});

describe('mergeManifest', () => {
  const entry = (key: string, bytes: number): ManifestEntry => ({
    surah: 1, ayah: 1, key, bytes, sha256: 'x', sourceUrl: 'u', fetchedAt: 't',
  });
  it('lets a fresh entry replace an old one, and sorts by key', () => {
    const merged = mergeManifest([entry('b', 1), entry('a', 1)], [entry('b', 2)]);
    assert.deepEqual(merged.map(e => [e.key, e.bytes]), [['a', 1], ['b', 2]]);
  });
});
```

- [ ] **Step 2: Run it and see it fail**

Run: `cd /home/user/Iqraa/lib/curriculum && node --experimental-strip-types --test src/__tests__/quranAudioUpload.test.ts`
Expected: FAIL — `Cannot find module '../../scripts/quranAudioUpload.ts'`.

- [ ] **Step 3: Write the pure upload logic**

Create `lib/curriculum/scripts/quranAudioUpload.ts`:

```ts
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
      report.uploaded.push({
        surah: a.surah,
        ayah: a.ayah,
        key,
        bytes: got.bytes.length,
        sha256: createHash('sha256').update(got.bytes).digest('hex'),
        sourceUrl: url,
        fetchedAt: deps.now().toISOString(),
      });
      deps.log(`  ${key}`);
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
```

- [ ] **Step 4: Run the tests and see them pass**

Run: `cd /home/user/Iqraa/lib/curriculum && node --experimental-strip-types --test src/__tests__/quranAudioUpload.test.ts`
Expected: PASS, every test green.

- [ ] **Step 5: Write the CLI wiring**

Create `lib/curriculum/scripts/upload-quran-audio-r2.ts`:

```ts
/**
 * Copies the Quran Corner's recitation audio (Sheikh Mahmoud Khalil Al-Husary,
 * murattal, one MP3 per ayah, for the 585 ayahs in `quran_corner.json`) from
 * its public source into `iqraa-public`, where the app plays it from
 * (`artifacts/mobile/services/quranAudio.ts`). The key shape lives in
 * `src/quranAudio.ts`; the checks and the run loop live in
 * `quranAudioUpload.ts` and are unit-tested. This file is wiring only.
 *
 * Sibling of `upload-figures-r2.ts`: lists the bucket first and does only what
 * is missing, so a run that dies half way costs nothing to repeat.
 *
 *   pnpm --filter @workspace/curriculum run quran-audio [-- --dry-run | --force | --only 1:1,112:3 | --concurrency 4]
 *
 *   --dry-run   say what would be copied; fetch and write nothing.
 *   --force     redo every ayah (after changing the source).
 *   --only      redo just these surah:ayah pairs (a recording that came out wrong).
 *
 * Writes `sources/quran-audio/MANIFEST.json` (ayah, bytes, SHA-256, source URL,
 * fetched-at). COMMIT IT after a run: it is what makes the bucket auditable.
 *
 * Exit codes: 0 all done · 1 some downloads were rejected (listed) · 2 not
 * configured, or the bucket refused the credentials.
 *
 * Needs R2 credentials with write access to `iqraa-public` (see
 * `upload-figures-r2.ts`). THIS HAS NOT BEEN RUN: the build sandbox cannot
 * reach the source host. Run it where you can, then follow
 * `sources/quran-audio/VERIFY.md` before flipping `QURAN_AUDIO_UPLOADED`.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { loadEnvFile } from '../../../scripts/load-env.mjs';
import { QURAN_AUDIO_PREFIX, QURAN_AUDIO_RECITER, quranAudioAyahs } from '../src/quranAudio.ts';
import {
  QURAN_AUDIO_SOURCE_BASE,
  StorageAuthError,
  mergeManifest,
  parseOnly,
  runUpload,
  selectTodo,
  type ManifestEntry,
} from './quranAudioUpload.ts';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..', '..');
loadEnvFile(path.join(ROOT, '.env'));

const BUCKET = process.env.R2_PUBLIC_BUCKET || 'iqraa-public';
const MANIFEST_PATH = path.join(HERE, '..', 'sources', 'quran-audio', 'MANIFEST.json');

const argv = process.argv;
const force = argv.includes('--force');
const dryRun = argv.includes('--dry-run');
const flagValue = (name: string): string | undefined => {
  const i = argv.indexOf(name);
  return i === -1 ? undefined : argv[i + 1];
};
const concurrency = Number(flagValue('--concurrency')) || 4;

let only;
try {
  only = parseOnly(flagValue('--only'));
} catch (err) {
  console.error((err as Error).message);
  process.exit(2);
}

const { R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
if (!R2_ENDPOINT || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('R2 is not configured — set R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY in .env.');
  process.exit(2);
}

const client = new S3Client({
  region: 'auto',
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
});

/** Every full key already in the bucket under the prefix, following pagination. */
async function existingKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  let token: string | undefined;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${QURAN_AUDIO_PREFIX}/`, ContinuationToken: token }),
    );
    for (const o of page.Contents ?? []) if (o.Key) keys.add(o.Key);
    token = page.NextContinuationToken;
  } while (token);
  return keys;
}

let already: Set<string>;
try {
  already = force || only ? new Set<string>() : await existingKeys();
} catch (err) {
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  console.error(`cannot list ${BUCKET}: ${e.name}`);
  if (e.$metadata?.httpStatusCode === 403) {
    console.error('these credentials cannot reach that bucket — mint an R2 token with');
    console.error('Object Read & Write on iqraa-public (an iqraa-media token is scoped out)');
  }
  process.exit(2);
}

const todo = selectTodo(quranAudioAyahs(), already, { force, only });
console.log(
  `${quranAudioAyahs().length} ayahs, ${already.size} already in ${BUCKET}/${QURAN_AUDIO_PREFIX}, ${todo.length} to copy` +
    (dryRun ? ' (dry run — nothing will be fetched or written)' : ''),
);

const report = await runUpload(
  todo,
  {
    async fetchAudio(url) {
      const res = await fetch(url, {
        signal: AbortSignal.timeout(30_000),
        headers: { 'user-agent': 'Iqraa-quran-audio-upload/1.0' },
      });
      return {
        status: res.status,
        contentType: res.headers.get('content-type'),
        bytes: new Uint8Array(await res.arrayBuffer()),
      };
    },
    async put(key, body) {
      try {
        await client.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: 'audio/mpeg',
            // A day, not "immutable": `--only` re-uploads a recording that came
            // out wrong under the same key, and a year-long cache would keep
            // serving the bad one.
            CacheControl: 'public, max-age=86400',
          }),
        );
      } catch (err) {
        const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
        const status = e.$metadata?.httpStatusCode;
        if (status === 401 || status === 403) {
          throw new StorageAuthError(
            `${BUCKET} refused the write (${e.name ?? status}) — mint an R2 token with Object Read & Write on ${BUCKET}`,
          );
        }
        throw err;
      }
    },
    now: () => new Date(),
    log: line => console.log(line),
  },
  { concurrency, dryRun },
);

if (dryRun) {
  console.log(`dry run: ${report.planned} ayah(s) would be copied.`);
  process.exit(0);
}

if (report.uploaded.length > 0) {
  const existing: ManifestEntry[] = existsSync(MANIFEST_PATH)
    ? (JSON.parse(readFileSync(MANIFEST_PATH, 'utf8')) as { files: ManifestEntry[] }).files
    : [];
  mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  writeFileSync(
    MANIFEST_PATH,
    JSON.stringify(
      {
        reciter: QURAN_AUDIO_RECITER,
        sourceBase: QURAN_AUDIO_SOURCE_BASE,
        files: mergeManifest(existing, report.uploaded),
      },
      null,
      2,
    ) + '\n',
  );
  console.log(`uploaded ${report.uploaded.length} → ${BUCKET}/${QURAN_AUDIO_PREFIX}/ ; wrote ${MANIFEST_PATH} — commit it.`);
}

if (report.aborted) {
  console.error(`stopped: ${report.aborted}`);
  process.exit(2);
}
if (report.rejected.length > 0) {
  console.error(`${report.rejected.length} download(s) rejected and NOT uploaded:`);
  for (const r of report.rejected) console.error(`  ${r.key}: ${r.reason}`);
  process.exit(1);
}
```

- [ ] **Step 6: Typecheck the package and run its whole suite**

Run: `cd /home/user/Iqraa/lib/curriculum && pnpm run typecheck && pnpm test 2>&1 | tail -15`
Expected: `tsc` silent; the suite ends with `fail 0`.

- [ ] **Step 7: Prove the CLI refuses to run unconfigured (no network needed)**

Run: `cd /home/user/Iqraa/lib/curriculum && env -u R2_ENDPOINT -u R2_ACCESS_KEY_ID -u R2_SECRET_ACCESS_KEY node --experimental-strip-types scripts/upload-quran-audio-r2.ts --dry-run; echo "exit=$?"`
Expected: prints `R2 is not configured …` and `exit=2`. (If a repo-root `.env` supplies real R2 credentials the script would reach the bucket listing instead — in that case stop; do not run it against the real bucket from here.)

- [ ] **Step 8: Commit**

```bash
cd /home/user/Iqraa
git add lib/curriculum/scripts/quranAudioUpload.ts lib/curriculum/scripts/upload-quran-audio-r2.ts lib/curriculum/src/__tests__/quranAudioUpload.test.ts
git commit -m "Quran audio: owner-run script that copies the 585 recordings into R2 (checked, resumable, manifest)"
```

---

### Task 3: Three pure helpers (registry, playlist, gate)

**Files:**
- Create: `artifacts/mobile/services/audioExclusive.ts`, `artifacts/mobile/services/quranPlaylist.ts`, `artifacts/mobile/services/quranAudioRelease.ts`
- Test: `artifacts/mobile/services/__tests__/audioExclusive.test.ts`, `quranPlaylist.test.ts`, `quranAudioRelease.test.ts`

**Interfaces:**
- Consumes: nothing (all pure).
- Produces (Task 4 relies on these exact names):
  - `audioExclusive.ts`: `interface AudioExclusive { register(owner: string, stop: () => void): void; claim(owner: string): void }`, `createAudioExclusive(): AudioExclusive`, `registerAudioStop(owner: string, stop: () => void): void`, `claimAudio(owner: string): void`
  - `quranPlaylist.ts`: `interface PlaylistAyah { surah: number; ayah: number }`, `interface PlaylistState { queue: readonly PlaylistAyah[]; index: number; active: boolean }`, `IDLE_PLAYLIST: PlaylistState`, `MAX_REPEAT = 10`, `clampRepeat(n: unknown): number`, `buildQueue(items: readonly PlaylistAyah[], repeat?: number): PlaylistAyah[]`, `startPlaylist(queue: readonly PlaylistAyah[]): PlaylistState`, `advancePlaylist(s: PlaylistState): PlaylistState`, `currentOf(s: PlaylistState): PlaylistAyah | null`
  - `quranAudioRelease.ts`: `QURAN_AUDIO_UPLOADED: boolean` (= `false`), `quranAudioVisible(uploaded: boolean, dev: boolean): boolean`

Run all mobile tests below as `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>` (the same flags `pnpm test` uses).

**3a — The registry**

- [ ] **Step 1: Write the failing test** — create `artifacts/mobile/services/__tests__/audioExclusive.test.ts`:

```ts
/**
 * "Hearing two things at once is never useful": whichever audio starts stops
 * the others. The registry is pure so the rule is tested here; the players that
 * register with it import `expo-audio` and cannot be loaded under bare node.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { createAudioExclusive } from '../audioExclusive.ts';

describe('createAudioExclusive', () => {
  it('stops every other owner and never the one that claimed', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('word'));
    ex.register('quran', () => stopped.push('quran'));
    ex.claim('quran');
    assert.deepEqual(stopped, ['word']);
    ex.claim('word');
    assert.deepEqual(stopped, ['word', 'quran']);
  });

  it('is fine to claim a name nobody registered', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('word'));
    assert.doesNotThrow(() => ex.claim('other'));
    assert.deepEqual(stopped, ['word']);
  });

  it('a stop that throws does not block the rest', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('a', () => {
      throw new Error('player already released');
    });
    ex.register('b', () => stopped.push('b'));
    ex.register('c', () => stopped.push('c'));
    assert.doesNotThrow(() => ex.claim('c'));
    assert.deepEqual(stopped, ['b']);
  });

  it('registering a name again replaces its stop', () => {
    const ex = createAudioExclusive();
    const stopped: string[] = [];
    ex.register('word', () => stopped.push('old'));
    ex.register('word', () => stopped.push('new'));
    ex.claim('quran');
    assert.deepEqual(stopped, ['new']);
  });
});
```

- [ ] **Step 2: Run it and see it fail** — `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/audioExclusive.test.ts` → FAIL, `Cannot find module '../audioExclusive.ts'`.

- [ ] **Step 3: Write it** — create `artifacts/mobile/services/audioExclusive.ts`:

```ts
/**
 * "One audio at a time". Each module that plays sound registers a `stop` under
 * a name; starting any of them calls `claim(name)`, which runs every OTHER
 * module's stop. `englishAudio.ts` (a word, or a student's own recording)
 * registers as 'word', `quranAudio.ts` as 'quran' — so a listen button cannot
 * talk over a flashcard, without the two files importing each other.
 *
 * No `react-native` / `expo-*` import, so `node --test` can load it.
 */
export interface AudioExclusive {
  register(owner: string, stop: () => void): void;
  claim(owner: string): void;
}

export function createAudioExclusive(): AudioExclusive {
  const stops = new Map<string, () => void>();
  return {
    register(owner, stop) {
      stops.set(owner, stop);
    },
    claim(owner) {
      for (const [name, stop] of stops) {
        if (name === owner) continue;
        try {
          stop();
        } catch {
          // A player that is already gone is already silent.
        }
      }
    },
  };
}

const shared = createAudioExclusive();
export const registerAudioStop = shared.register;
export const claimAudio = shared.claim;
```

- [ ] **Step 4: Run it and see it pass** — same command → PASS.

- [ ] **Step 5: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/audioExclusive.ts artifacts/mobile/services/__tests__/audioExclusive.test.ts
git commit -m "Quran audio: a registry so only one audio plays at a time"
```

**3b — The playlist**

- [ ] **Step 6: Write the failing test** — create `artifacts/mobile/services/__tests__/quranPlaylist.test.ts`:

```ts
/**
 * The only real logic in Quran audio playback: what plays, in what order, how
 * many times, and what a late "finished" event does after Stop. The player
 * (`quranAudio.ts`, which imports `expo-audio`) is glue around this.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  IDLE_PLAYLIST,
  MAX_REPEAT,
  advancePlaylist,
  buildQueue,
  clampRepeat,
  currentOf,
  startPlaylist,
} from '../quranPlaylist.ts';

const a = { surah: 112, ayah: 1 };
const b = { surah: 112, ayah: 2 };
const c = { surah: 112, ayah: 3 };

describe('clampRepeat', () => {
  it('floors to an integer between 1 and the cap, and treats anything else as 1', () => {
    assert.equal(clampRepeat(1), 1);
    assert.equal(clampRepeat(0), 1);
    assert.equal(clampRepeat(-3), 1);
    assert.equal(clampRepeat(2.9), 2);
    assert.equal(clampRepeat(99), MAX_REPEAT);
    assert.equal(clampRepeat(NaN), 1);
    assert.equal(clampRepeat(Infinity), 1);
    assert.equal(clampRepeat('3'), 1);
    assert.equal(clampRepeat(undefined), 1);
  });
});

describe('buildQueue', () => {
  it('plays each ayah once by default, in the order given', () => {
    assert.deepEqual(buildQueue([a, b, c]), [a, b, c]);
  });
  it('repeats each ayah in place (a a b b), the way it is learned', () => {
    assert.deepEqual(buildQueue([a, b], 2), [a, a, b, b]);
  });
  it('handles a one-ayah range and an empty one', () => {
    assert.deepEqual(buildQueue([a], 3), [a, a, a]);
    assert.deepEqual(buildQueue([], 3), []);
  });
});

describe('the playlist reducer', () => {
  it('an empty queue never starts', () => {
    assert.equal(startPlaylist([]), IDLE_PLAYLIST);
    assert.equal(currentOf(startPlaylist([])), null);
  });

  it('walks the queue and goes idle after the last item', () => {
    let s = startPlaylist([a, b, c]);
    assert.deepEqual(currentOf(s), a);
    s = advancePlaylist(s);
    assert.deepEqual(currentOf(s), b);
    s = advancePlaylist(s);
    assert.deepEqual(currentOf(s), c);
    s = advancePlaylist(s);
    assert.equal(s.active, false);
    assert.equal(currentOf(s), null);
  });

  it('a one-item queue ends after one advance', () => {
    const s = advancePlaylist(startPlaylist([a]));
    assert.equal(currentOf(s), null);
  });

  it('a late "finished" after Stop cannot restart anything', () => {
    let s = advancePlaylist(startPlaylist([a, b, c]));
    assert.deepEqual(currentOf(s), b);
    s = IDLE_PLAYLIST; // what Stop does
    assert.equal(currentOf(advancePlaylist(s)), null);
    assert.equal(advancePlaylist(s).active, false);
  });
});
```

- [ ] **Step 7: Run it and see it fail** — `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranPlaylist.test.ts` → FAIL, module not found.

- [ ] **Step 8: Write it** — create `artifacts/mobile/services/quranPlaylist.ts`:

```ts
/**
 * What the Quran audio player plays, in what order, how many times — as a
 * small reducer with no I/O, so it is tested. `quranAudio.ts` owns the sound;
 * this owns the decisions. `IDLE_PLAYLIST` is both "never started" and "stopped":
 * a "finished" event arriving after Stop advances an idle playlist to idle
 * again, so a late event cannot restart playback.
 *
 * No `react-native` / `expo-*` import, so `node --test` can load it.
 */
export interface PlaylistAyah {
  surah: number;
  ayah: number;
}

export interface PlaylistState {
  queue: readonly PlaylistAyah[];
  index: number;
  active: boolean;
}

export const IDLE_PLAYLIST: PlaylistState = { queue: [], index: 0, active: false };

/** A learner repeating an ayah a few times; ten is already more than anyone sits through. */
export const MAX_REPEAT = 10;

export function clampRepeat(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 1;
  return Math.min(MAX_REPEAT, Math.max(1, Math.floor(n)));
}

/** Each ayah repeated in place: [a, b] × 2 → a a b b. */
export function buildQueue(items: readonly PlaylistAyah[], repeat = 1): PlaylistAyah[] {
  const r = clampRepeat(repeat);
  return items.flatMap(item => Array.from({ length: r }, () => item));
}

export function startPlaylist(queue: readonly PlaylistAyah[]): PlaylistState {
  return queue.length === 0 ? IDLE_PLAYLIST : { queue, index: 0, active: true };
}

export function advancePlaylist(s: PlaylistState): PlaylistState {
  if (!s.active) return IDLE_PLAYLIST;
  const index = s.index + 1;
  return index >= s.queue.length ? IDLE_PLAYLIST : { queue: s.queue, index, active: true };
}

export function currentOf(s: PlaylistState): PlaylistAyah | null {
  return s.active ? (s.queue[s.index] ?? null) : null;
}
```

- [ ] **Step 9: Run it and see it pass** — same command → PASS.

- [ ] **Step 10: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/quranPlaylist.ts artifacts/mobile/services/__tests__/quranPlaylist.test.ts
git commit -m "Quran audio: the play queue and its start/advance/stop reducer"
```

**3c — The gate**

- [ ] **Step 11: Write the failing test** — create `artifacts/mobile/services/__tests__/quranAudioRelease.test.ts`:

```ts
/**
 * The Quran audio gate. The recordings are copied into the bucket by a script
 * the owner runs, and nobody has yet checked that each file is exactly its
 * ayah, so every listen control stays hidden in a production build until
 * QURAN_AUDIO_UPLOADED is flipped. Development builds always show them, so the
 * owner can try the controls before then.
 *
 * Like `quranRelease.test.ts`, this asserts the TYPE of the constant, not its
 * value: a test pinning `false` would make the owner's one-line flip a
 * two-file change for no safety gain.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_AUDIO_UPLOADED, quranAudioVisible } from '../quranAudioRelease.ts';

describe('quranAudioVisible', () => {
  it('shows the controls in a development build whether or not the audio is uploaded', () => {
    assert.equal(quranAudioVisible(false, true), true);
    assert.equal(quranAudioVisible(true, true), true);
  });

  it('shows them in a production build only once uploaded', () => {
    assert.equal(quranAudioVisible(true, false), true);
    assert.equal(quranAudioVisible(false, false), false);
  });
});

describe('QURAN_AUDIO_UPLOADED', () => {
  it('is a boolean, so a typo in the flag cannot read as truthy', () => {
    assert.equal(typeof QURAN_AUDIO_UPLOADED, 'boolean');
  });
});
```

- [ ] **Step 12: Run it and see it fail** — `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranAudioRelease.test.ts` → FAIL, module not found.

- [ ] **Step 13: Write it** — create `artifacts/mobile/services/quranAudioRelease.ts`:

```ts
/**
 * The Quran Corner's audio gate.
 *
 * `false` until the owner has (1) run `pnpm --filter @workspace/curriculum run
 * quran-audio` somewhere that can reach the source, (2) committed the
 * MANIFEST it writes, and (3) listened to the sample in
 * `lib/curriculum/sources/quran-audio/VERIFY.md` — right ayah, no basmalah
 * spliced in or out, no clipped ending. With it `false`, no listen control
 * renders in a production build, so a student never sees a button that plays
 * nothing. Development builds always show them, so the controls can be tried
 * before the flip. Flipping is a reviewed one-line change that ships over the
 * air; setting it back hides the controls again.
 *
 * Deliberately a source constant, not an EXPO_PUBLIC_* variable: those must be
 * declared in three places (deploy.yml, eas.json, mobile-update.yml) and a miss
 * silently changes nothing.
 */
export const QURAN_AUDIO_UPLOADED = false;

/** `dev` is React Native's `__DEV__`, passed in so this stays testable under bare node. */
export function quranAudioVisible(uploaded: boolean, dev: boolean): boolean {
  return uploaded || dev;
}
```

- [ ] **Step 14: Run it and see it pass** — same command → PASS.

- [ ] **Step 15: Run the whole mobile suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -12`
Expected: ends with `fail 0`.

- [ ] **Step 16: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/quranAudioRelease.ts artifacts/mobile/services/__tests__/quranAudioRelease.test.ts
git commit -m "Quran audio: gate hidden until the recordings are uploaded and checked"
```

---

### Task 4: The player, its hook, and the English-audio claim

**Files:**
- Create: `artifacts/mobile/services/quranAudio.ts`
- Create: `artifacts/mobile/hooks/useQuranAudio.ts`
- Modify: `artifacts/mobile/services/englishAudio.ts` (imports; a registered stop; a `claimAudio('word')` in `playWord` and `playUri`)

**Interfaces:**
- Consumes: `quranAyahAudioUrl(surah, ayah)` from `@workspace/curriculum/quran-audio` (Task 1); `claimAudio`, `registerAudioStop` from `./audioExclusive` and the playlist API from `./quranPlaylist` (Task 3); `QURAN_AUDIO_UPLOADED`, `quranAudioVisible` from `./quranAudioRelease` (Task 3).
- Produces (Task 5 relies on these exact names):
  - `services/quranAudio.ts`: `interface QuranAudioState { playing: PlaylistAyah | null; error: boolean }`, `getQuranAudioState(): QuranAudioState`, `subscribeQuranAudio(listener: () => void): () => void`, `playSequence(items: readonly PlaylistAyah[], opts?: { repeat?: number }): void`, `playAyah(surah: number, ayah: number): void`, `stopQuranAudio(): void`
  - `hooks/useQuranAudio.ts`: `useQuranAudio(): { visible: boolean; playing: PlaylistAyah | null; error: boolean; playAyah: typeof playAyah; playSequence: typeof playSequence; stop: () => void }` — **call it once per screen** (its unmount cleanup stops audio).

This task has no unit test: both files import `expo-audio` / `react-native` and cannot be loaded under bare `node --test` (CLAUDE.md). The logic worth testing is in Task 3; verification here is the typecheck plus the reading steps below. Say so in the commit message; do not claim playback was tested.

- [ ] **Step 1: Write the player** — create `artifacts/mobile/services/quranAudio.ts`:

```ts
/**
 * Playing the Quran Corner's recitation (Sheikh Mahmoud Khalil Al-Husary,
 * murattal), one MP3 per ayah from the public bucket.
 *
 * What plays, in what order and how often is `quranPlaylist.ts` (a tested
 * reducer); this file is the sound and a tiny store the screens subscribe to.
 *
 * - Native: one `expo-audio` player, reused. `expo-audio` is already installed,
 *   so this adds no native module and `app.json`'s `version` does not move.
 * - Web: its own <audio> element, because `expo-audio`'s web player cannot
 *   report a failed load (the same reason `wordSpeech.ts` does this).
 * - Never throws. A recording that will not play becomes `error: true` for the
 *   screen to say so quietly, never an exception or a banner over the text.
 * - Needs the network: there is no download or cache in this slice.
 * - Starting claims the shared "one audio at a time" slot (`audioExclusive.ts`),
 *   so it cuts off a flashcard word and is cut off by one.
 *
 * NOT VERIFIED on a device or in a browser: nothing here has played a real
 * recording (the files are not uploaded yet and the build sandbox cannot reach
 * them). In particular the native "did it just finish" status event is the
 * piece to watch on the first real device run.
 */
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { Platform } from 'react-native';
import { quranAyahAudioUrl } from '@workspace/curriculum/quran-audio';
import { claimAudio, registerAudioStop } from './audioExclusive';
import {
  IDLE_PLAYLIST,
  advancePlaylist,
  buildQueue,
  currentOf,
  startPlaylist,
  type PlaylistAyah,
  type PlaylistState,
} from './quranPlaylist';

export interface QuranAudioState {
  playing: PlaylistAyah | null;
  error: boolean;
}

/** How long a recording may take to start before we say it cannot play (a stalled connection never errors). */
const LOAD_TIMEOUT_MS = 10_000;

// ─── the store ───────────────────────────────────────────────────────────────

let snapshot: QuranAudioState = { playing: null, error: false };
const listeners = new Set<() => void>();

/** Stable reference unless something changed, as `useSyncExternalStore` requires. */
function publish(next: QuranAudioState): void {
  if (next.playing === snapshot.playing && next.error === snapshot.error) return;
  snapshot = next;
  listeners.forEach(l => l());
}

export function getQuranAudioState(): QuranAudioState {
  return snapshot;
}

export function subscribeQuranAudio(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// ─── the two sound backends ──────────────────────────────────────────────────

interface Playback {
  stop(): void;
}
type StartPlayback = (url: string, onEnded: () => void, onError: () => void) => Playback;

interface WebAudio {
  onended: null | (() => void);
  onerror: null | (() => void);
  play(): Promise<void> | void;
  pause(): void;
}

const startWeb: StartPlayback = (url, onEnded, onError) => {
  const Ctor = (globalThis as unknown as { Audio?: new (src: string) => WebAudio }).Audio;
  if (!Ctor) {
    setTimeout(onError, 0);
    return { stop() {} };
  }
  let dead = false;
  const el = new Ctor(url);
  el.onended = () => {
    if (!dead) onEnded();
  };
  el.onerror = () => {
    if (!dead) onError();
  };
  try {
    const p = el.play();
    if (p && typeof (p as Promise<void>).catch === 'function') {
      (p as Promise<void>).catch(() => {
        if (!dead) onError();
      });
    }
  } catch {
    setTimeout(() => {
      if (!dead) onError();
    }, 0);
  }
  return {
    stop() {
      dead = true;
      try {
        el.pause();
      } catch {
        // Already gone.
      }
    },
  };
};

let player: AudioPlayer | null = null;
let modeSet = false;
/** The status handler of the playback in flight; one at a time, replaced on every start. */
let onStatus: ((s: AudioStatus) => void) | null = null;

const startNative: StartPlayback = (url, onEnded, onError) => {
  let dead = false;
  let loaded = false;
  let started = false;
  const timer = setTimeout(() => {
    if (!dead && !loaded) onError();
  }, LOAD_TIMEOUT_MS);

  void (async () => {
    try {
      if (!modeSet) {
        modeSet = true;
        // iOS mutes playback on the silent switch by default; a student who
        // taps "listen" with it on would hear nothing and learn nothing.
        await setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      }
      if (dead) return;
      onStatus = status => {
        if (dead) return;
        if (status.isLoaded && !loaded) {
          loaded = true;
          clearTimeout(timer);
        }
        if (status.playing) started = true;
        // Only a finish AFTER this playback began counts: the previous
        // recording's own "finished" must not skip this one.
        if (status.didJustFinish && started) onEnded();
      };
      const source = { uri: url };
      if (player) {
        player.replace(source);
      } else {
        player = createAudioPlayer(source);
        player.addListener('playbackStatusUpdate', status => onStatus?.(status));
      }
      await player.seekTo(0);
      if (dead) return;
      player.play();
    } catch {
      if (!dead) onError();
    }
  })();

  return {
    stop() {
      dead = true;
      clearTimeout(timer);
      onStatus = null;
      try {
        player?.pause();
      } catch {
        // Already gone.
      }
    },
  };
};

// ─── the driver ──────────────────────────────────────────────────────────────

let state: PlaylistState = IDLE_PLAYLIST;
let playback: Playback | null = null;
/** Bumped on every start and stop; a callback from a superseded playback checks it and does nothing. */
let generation = 0;

function halt(error: boolean): void {
  generation++;
  playback?.stop();
  playback = null;
  state = IDLE_PLAYLIST;
  publish({ playing: null, error });
}

function playCurrent(): void {
  const current = currentOf(state);
  if (!current) {
    halt(false);
    return;
  }
  playback?.stop();
  const gen = ++generation;
  publish({ playing: current, error: false });
  const start = Platform.OS === 'web' ? startWeb : startNative;
  playback = start(
    quranAyahAudioUrl(current.surah, current.ayah),
    () => {
      if (gen !== generation) return;
      state = advancePlaylist(state);
      playCurrent();
    },
    () => {
      if (gen !== generation) return;
      halt(true);
    },
  );
}

/** Plays `items` in order, each `repeat` times in place. Replaces whatever was playing. */
export function playSequence(items: readonly PlaylistAyah[], opts: { repeat?: number } = {}): void {
  claimAudio('quran');
  state = startPlaylist(buildQueue(items, opts.repeat ?? 1));
  playCurrent();
}

export function playAyah(surah: number, ayah: number): void {
  playSequence([{ surah, ayah }]);
}

/** Stops, and clears a shown "couldn't play". Safe to call when nothing is playing. */
export function stopQuranAudio(): void {
  if (state.active || snapshot.error) halt(false);
}

registerAudioStop('quran', () => {
  if (state.active) halt(false);
});
```

- [ ] **Step 2: Write the hook** — create `artifacts/mobile/hooks/useQuranAudio.ts`:

```ts
/**
 * The Quran audio player as a hook, with the release gate and a stop-on-leave.
 *
 * Call it ONCE per screen and pass what you need down to children: the
 * cleanup below stops the audio when the component that called it unmounts, so
 * calling it in a row component would cut the recitation off whenever a row
 * re-mounts. `visible` is false in a production build until
 * `QURAN_AUDIO_UPLOADED` is flipped — render no listen control when it is.
 */
import { useEffect, useSyncExternalStore } from 'react';
import {
  getQuranAudioState,
  playAyah,
  playSequence,
  stopQuranAudio,
  subscribeQuranAudio,
} from '@/services/quranAudio';
import { QURAN_AUDIO_UPLOADED, quranAudioVisible } from '@/services/quranAudioRelease';

export function useQuranAudio() {
  const s = useSyncExternalStore(subscribeQuranAudio, getQuranAudioState, getQuranAudioState);
  useEffect(() => () => stopQuranAudio(), []);
  return {
    visible: quranAudioVisible(QURAN_AUDIO_UPLOADED, __DEV__),
    playing: s.playing,
    error: s.error,
    playAyah,
    playSequence,
    stop: stopQuranAudio,
  };
}
```

- [ ] **Step 3: Make `englishAudio.ts` claim and register**

In `artifacts/mobile/services/englishAudio.ts`:

(a) Change
```ts
import { playRecordingOrSpeak } from './wordSpeech';
```
to
```ts
import { playRecordingOrSpeak } from './wordSpeech';
import { claimAudio, registerAudioStop } from './audioExclusive';
```

(b) Change
```ts
function stopWeb(): void {
  stopWebWord?.();
  stopWebWord = null;
}
```
to
```ts
function stopWeb(): void {
  stopWebWord?.();
  stopWebWord = null;
}

// Another audio (the Quran Corner's recitation) starting cuts a word off, and
// the reverse is `claimAudio('word')` below — one at a time, as the header of
// `playLocalUri` says.
registerAudioStop('word', () => {
  try {
    player?.pause();
  } catch {
    // Nothing playing.
  }
  stopWeb();
});
```

(c) In `playWord`, change
```ts
export async function playWord(word: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
```
to
```ts
export async function playWord(word: string): Promise<void> {
  try {
    claimAudio('word');
    if (Platform.OS === 'web') {
```

(d) In `playUri`, change
```ts
  try {
    stopWeb(); // a web word still playing would talk over the recording
```
to
```ts
  try {
    claimAudio('word');
    stopWeb(); // a web word still playing would talk over the recording
```

- [ ] **Step 4: Typecheck the app**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -15`
Expected: no output (clean). If `AudioStatus` or `addListener` fails to resolve, the installed `expo-audio` types differ from `node_modules/expo-audio/build/Audio.types.d.ts` line 137 / `AudioModule.types.d.ts` line 209 — read those and adjust the two lines, do not cast to `any`.

- [ ] **Step 5: Read-through checks (nothing here is executed, so say so)**

Confirm by reading, and write the outcome in the commit body:
1. `stopQuranAudio()` while idle with no error does nothing (no publish) — `state.active || snapshot.error` guard.
2. A "finished" callback from a stopped playback is ignored — `gen !== generation` in both callbacks and `dead` in both backends.
3. `claimAudio('quran')` is the first statement of `playSequence`, and `registerAudioStop('quran', …)` runs at module load; `englishAudio.ts` registers 'word' at its module load. (If the Quran module has not loaded, nothing is registered and `claimAudio('word')` is a no-op — correct.)

- [ ] **Step 6: Run the mobile suite**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -8`
Expected: `fail 0`.

- [ ] **Step 7: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/quranAudio.ts artifacts/mobile/hooks/useQuranAudio.ts artifacts/mobile/services/englishAudio.ts
git commit -m "Quran audio: player (expo-audio / web <audio>), hook, one-at-a-time with word audio

Typechecked only: the player and hook import expo-audio and react-native and
cannot load under node --test. The logic they drive is tested in quranPlaylist
and audioExclusive. Nothing here has played a real recording."
```

---

### Task 5: The controls, the strings, the two screens

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (five keys in `ar`, five in `en`)
- Create: `artifacts/mobile/components/quran/QuranAudioControls.tsx`
- Modify: `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx`

**Interfaces:**
- Consumes: `useQuranAudio()` from `@/hooks/useQuranAudio` (Task 4); `QuranSurah` shape (`surah.number`, `surah.ayahs[].n`).
- Produces: `QuranListenButton({ active, onPress, label?, a11yLabel? })` and `QuranAudioNote({ error })` from `@/components/quran/QuranAudioControls`; i18n keys `quranListen`, `quranListenAll`, `quranStopAudio`, `quranAudioCredit`, `quranAudioError`.

- [ ] **Step 1: Add the strings (Arabic, then English)**

In `artifacts/mobile/services/i18n.ts`, in the `ar` block change the line
```ts
    quranSelfRated: 'هذا تقييمك أنت؛ التطبيق لا يستمع إلى تلاوتك ولا يصحّحها.',
```
to
```ts
    quranSelfRated: 'هذا تقييمك أنت؛ التطبيق لا يستمع إلى تلاوتك ولا يصحّحها.',
    quranListen: 'استمع',
    quranListenAll: 'استمع للمقطع',
    quranStopAudio: 'إيقاف',
    quranAudioCredit: 'التلاوة بصوت الشيخ محمود خليل الحصري (ترتيل).',
    quranAudioError: 'تعذّر تشغيل التلاوة. تأكد من اتصالك بالإنترنت ثم حاول مرة أخرى.',
```
and in the `en` block change
```ts
    quranSelfRated: 'This is your own rating. The app does not listen to or check your recitation.',
```
to
```ts
    quranSelfRated: 'This is your own rating. The app does not listen to or check your recitation.',
    quranListen: 'Listen',
    quranListenAll: 'Listen to the passage',
    quranStopAudio: 'Stop',
    quranAudioCredit: 'Recitation by Sheikh Mahmoud Khalil Al-Husary (murattal).',
    quranAudioError: 'The recitation could not play. Check your internet connection and try again.',
```

- [ ] **Step 2: Have the Arabic reviewed**

Invoke the `anthropic-skills:arabic-copy-reviewer` skill on the five Arabic strings only (as was done for the first Quran strings). Apply only wording fixes it finds; do not change a key name. Note in the commit body whether it changed anything.

- [ ] **Step 3: Run the i18n tests**

Run: `cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts 2>&1 | tail -10`
Expected: `fail 0`.

- [ ] **Step 4: Write the controls** — create `artifacts/mobile/components/quran/QuranAudioControls.tsx`:

```tsx
/**
 * The two small pieces every Quran audio screen draws: the listen/stop button
 * and the credit-and-error note. Rendered only when `useQuranAudio().visible`
 * (the release gate, `services/quranAudioRelease.ts`) — callers do the check,
 * so with the gate shut nothing here is on screen.
 *
 * Playing audio never touches the learner's progress, and the app never hears a
 * recitation; the credit line says whose voice it is and nothing more.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';

interface ListenButtonProps {
  /** True while THIS control's recitation is playing — the button then stops it. */
  active: boolean;
  onPress: () => void;
  /** With a label: a text pill. Without: an icon-only 44 px target. */
  label?: string;
  /** Spoken label for the icon-only form, e.g. «استمع ٣». Defaults to listen/stop. */
  a11yLabel?: string;
}

export function QuranListenButton({ active, onPress, label, a11yLabel }: ListenButtonProps) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const icon = active ? 'stop-circle-outline' : 'play-circle-outline';
  const spoken = a11yLabel ?? label ?? t(active ? 'quranStopAudio' : 'quranListen');
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={spoken}
      aria-pressed={active}
      style={[
        label ? styles.pill : styles.iconOnly,
        { backgroundColor: label || active ? colors.muted : 'transparent', flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <Ionicons name={icon} size={24} color={colors.primary} />
      {label ? (
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption }}>{label}</Text>
      ) : null}
    </Pressable>
  );
}

export function QuranAudioNote({ error }: { error: boolean }) {
  const colors = useColors();
  const { t, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={styles.note}>
      <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align }}>
        {t('quranAudioCredit')}
      </Text>
      {error ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ color: colors.destructive, fontFamily: 'Almarai_400Regular', fontSize: TYPE.caption, textAlign: align, marginTop: SPACE.xs }}
        >
          {t('quranAudioError')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  iconOnly: { minWidth: 44, minHeight: 44, borderRadius: RADIUS.pill, alignItems: 'center', justifyContent: 'center' },
  pill: {
    minHeight: 44,
    alignItems: 'center',
    gap: SPACE.sm,
    paddingHorizontal: SPACE.lg,
    borderRadius: RADIUS.pill,
  },
  note: { paddingHorizontal: SPACE.lg, paddingTop: SPACE.sm },
});
```

- [ ] **Step 5: Wire the reader**

In `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx`:

(a) After the line `import { QuranGate } from '@/components/quran/QuranGate';` add:
```tsx
import { QuranAudioNote, QuranListenButton } from '@/components/quran/QuranAudioControls';
import { useQuranAudio } from '@/hooks/useQuranAudio';
```

(b) After `  const fontReady = useQuranFont();` add (it must stay above the early returns):
```tsx
  const audio = useQuranAudio();
```

(c) In the actions row, after the closing `</Pressable>` of the memorise button and before `</View>` of `styles.actions`, add:
```tsx
        {audio.visible ? (
          <QuranListenButton
            label={audio.playing ? t('quranStopAudio') : t('quranListenAll')}
            active={audio.playing !== null}
            onPress={() =>
              audio.playing
                ? audio.stop()
                : audio.playSequence(surah.ayahs.map(a => ({ surah: surah.number, ayah: a.n })))
            }
          />
        ) : null}
```
and right after that `</View>` (the end of `styles.actions`) add:
```tsx
      {audio.visible ? <QuranAudioNote error={audio.error} /> : null}
```

(d) Change the style `actions: { paddingHorizontal: 16, paddingTop: 16 },` to
```tsx
  actions: { paddingHorizontal: 16, paddingTop: 16, flexWrap: 'wrap', alignItems: 'center', gap: SPACE.sm },
```

(e) In the ayah `.map`, after `const memorised = stateOf(progress, surah.number, a.n) === 'memorised';` add:
```tsx
          const isPlaying = audio.playing?.surah === surah.number && audio.playing.ayah === a.n;
```
Change the row style
```tsx
              <View style={[styles.ayah, { borderColor: colors.border, flexDirection: 'row-reverse' }]}>
```
to
```tsx
              <View
                style={[
                  styles.ayah,
                  { borderColor: colors.border, flexDirection: 'row-reverse' },
                  isPlaying ? { backgroundColor: colors.muted } : null,
                ]}
              >
```
and after `<Text style={[styles.quran, { color: colors.foreground }]}>{a.text}</Text>` add:
```tsx
                {audio.visible ? (
                  <QuranListenButton
                    active={isPlaying}
                    a11yLabel={`${t(isPlaying ? 'quranStopAudio' : 'quranListen')} ${digits(a.n)}`}
                    onPress={() => (isPlaying ? audio.stop() : audio.playAyah(surah.number, a.n))}
                  />
                ) : null}
```

- [ ] **Step 6: Wire the memorise screen**

In `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx`:

(a) After `import { QuranGate } from '@/components/quran/QuranGate';` add:
```tsx
import { QuranAudioNote, QuranListenButton } from '@/components/quran/QuranAudioControls';
import { useQuranAudio } from '@/hooks/useQuranAudio';
```

(b) In `Memorize`, after `const { progress, loaded, rate } = useQuranProgress();` add:
```tsx
  const audio = useQuranAudio();
```

(c) Stop the recitation when the learner moves to another ayah. Change
```tsx
  const goTo = (i: number) => {
    setIndex(i);
```
to
```tsx
  const goTo = (i: number) => {
    audio.stop();
    setIndex(i);
```

(d) Replace the card's caption `Text` (the one reading `{t('quranAyahsLabel')} {digits(ayah.n)} · {t(STATE_LABEL[state])}`) with a row holding it and the listen button:
```tsx
        <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
          <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.caption, flex: 1, textAlign: align }}>
            {t('quranAyahsLabel')} {digits(ayah.n)} · {t(STATE_LABEL[state])}
          </Text>
          {audio.visible ? (
            <QuranListenButton
              label={audio.playing ? t('quranStopAudio') : t('quranListen')}
              active={audio.playing !== null}
              onPress={() => (audio.playing ? audio.stop() : audio.playAyah(surah.number, ayah.n))}
            />
          ) : null}
        </View>
```

(e) After the card's closing `</View>` (the `styles.card` view, before the repeat-counter row) add:
```tsx
      {audio.visible ? <QuranAudioNote error={audio.error} /> : null}
```

- [ ] **Step 7: Typecheck and run both suites**

Run: `cd /home/user/Iqraa/artifacts/mobile && pnpm run typecheck 2>&1 | tail -10 && pnpm test 2>&1 | tail -8`
Expected: typecheck silent; tests `fail 0` (this includes `designScale.test.ts`, which fails a new off-scale font size, radius or spacing — if it fails, move the offending value onto the `TYPE`/`SPACE`/`RADIUS` steps rather than raising its ceiling).

- [ ] **Step 8: Read-through checks (the screens are not rendered here, so say so)**

Confirm by reading and record in the commit body:
1. With `audio.visible` false, neither screen renders a `QuranListenButton` or `QuranAudioNote` — every use is behind `audio.visible ? … : null`.
2. `useQuranAudio()` is called once per screen, above every early return in the reader (hooks order).
3. The memorise repeat counter, rating buttons and `quranSelfRated` note are untouched; no code path from audio calls `rate(...)`.

- [ ] **Step 9: Commit**

```bash
cd /home/user/Iqraa
git add artifacts/mobile/services/i18n.ts artifacts/mobile/components/quran/QuranAudioControls.tsx "artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx" "artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx"
git commit -m "Quran audio: listen controls in the reader and memorise screens (hidden until released)

Not rendered or played here: typecheck, i18n and design-scale tests only."
```

---

### Task 6: Owner checklist, spec corrections, STATUS, final verification

**Files:**
- Create: `lib/curriculum/sources/quran-audio/VERIFY.md`
- Modify: `docs/superpowers/specs/2026-10-16-quran-audio-design.md`
- Modify: `STATUS.md`

**Interfaces:** none (documentation). Do NOT edit `lib/curriculum/sources/quran-ws/VERIFY.md`: it is generated by `build-quran-corner.ts` and says "Do not edit by hand".

- [ ] **Step 1: Write the owner checklist** — create `lib/curriculum/sources/quran-audio/VERIFY.md`:

```markdown
# Quran Corner recitation audio — owner checklist

Hand-written. (`../quran-ws/VERIFY.md` is the generated text sheet; this is separate.)

Nothing below has been done. The recordings have not been fetched, played or
measured by anyone building this: the build sandbox cannot reach the source.
`QURAN_AUDIO_UPLOADED` in `artifacts/mobile/services/quranAudioRelease.ts` stays
`false` until every box is ticked.

## Before anything is uploaded

- [ ] **Licence.** Copying these recordings (Sheikh Mahmoud Khalil Al-Husary,
      murattal, from the host named in `QURAN_AUDIO_SOURCE_BASE` in
      `scripts/quranAudioUpload.ts`) into our own bucket, inside a paid product,
      is permitted by the source's terms and by the recording's rights holders.
      Not answered by this repo. Same kind of question as the font's
      "cannot be Sold, Modified, Altered" clause.
- [ ] **Approval in Jordan** for Quran audio, as for the Quran text (open item in
      `docs/superpowers/specs/2026-10-11-quran-corner-design.md`).

## Run it

- [ ] `pnpm --filter @workspace/curriculum run quran-audio -- --dry-run` — expect
      `585 ayahs … 585 to copy`.
- [ ] `pnpm --filter @workspace/curriculum run quran-audio` — expect exit 0 and no
      rejected downloads. A rejected one is listed by key; fix and re-run with
      `--only S:A`.
- [ ] Commit `sources/quran-audio/MANIFEST.json`.

## Listen (a reciter or teacher, not the build)

For each, play the file at
`<QURAN_AUDIO_ORIGIN>/quran-audio/husary/<SSSAAA>.mp3` against the printed
Mus'haf. Check: it is **that ayah**, no basmalah spliced in or out (the corner
shows no basmalah in ayah 1 of any surah except Al-Fatiha's own ayah 1), no
clipped start or end.

- [ ] 1:1 (`001001.mp3`) — should BE the basmalah
- [ ] 1:7 (`001007.mp3`)
- [ ] 2:183 (`002183.mp3`) — ayah 1 of a long surah is not what is shown here; this is the first ayah the books assign
- [ ] 112:1 (`112001.mp3`) — first ayah of a short surah: no basmalah in front
- [ ] 112:4 (`112004.mp3`) — a last ayah: not clipped
- [ ] one from each grade band the books use (ask the teacher which surahs)

## Flip it

- [ ] Set `QURAN_AUDIO_UPLOADED = true`, merge, and on a real phone confirm: the
      listen button plays, a second tap stops, starting a flashcard word stops it,
      the silent switch does not mute it (iOS), offline shows the quiet error.
```

- [ ] **Step 2: Correct the spec where this plan found it wrong**

In `docs/superpowers/specs/2026-10-16-quran-audio-design.md` make these exact replacements (each `old` occurs once):

1. Replace `an owner check (see *Owner items*) and goes into `sources/quran-ws/VERIFY.md`
  as an unticked section, so it is not lost.` with `an owner check (see *Owner items*) and goes into
  `lib/curriculum/sources/quran-audio/VERIFY.md` — a separate, hand-written sheet,
  because `sources/quran-ws/VERIFY.md` is generated and says not to edit it.`
2. Replace `- Exported as `@workspace/curriculum/quranAudio` (new subpath, like `/quran`).` with `- Exported as `@workspace/curriculum/quran-audio` (new subpath, named like the other
  `quran-*` ones). Also exports `QURAN_AUDIO_ORIGIN` and `quranAyahAudioUrl`.`
3. Replace `- Validation: surah in 1–114, ayah ≥ 1; anything else throws,` with `- Validation: surah an integer 1–114, ayah an integer 1–286 (Al-Baqarah, the longest
  surah); anything else throws a `RangeError`,`
4. Replace `step. The player calls it; it is the part with real logic and it is the part
  that is tested.` with `step. It is a small reducer (`startPlaylist`, `advancePlaylist`, `currentOf`)
  whose idle state also makes a late "finished" event after Stop a no-op. The player
  calls it; it is the part with real logic and it is the part that is tested.`
5. Replace `- `quranAudioRelease.test.ts`: the three combinations, and that the constant is
  `false` until the owner flips it.` with `- `quranAudioRelease.test.ts`: the three combinations, and that the constant is a
  boolean (not its value: pinning `false` would turn the owner's one-line flip into
  a two-file change, and `quranRelease.test.ts` does not pin its value either).`
6. In *Components → 5. Gate*, after the code block's closing fence add the sentence:
  `The constant starts `false`; the checklist for flipping it is `sources/quran-audio/VERIFY.md`.`

- [ ] **Step 3: Add the honest STATUS bullet**

In `STATUS.md`, find the end of the Quran Corner section (it starts at `## The Quran Corner: a shelf in the library, 2026-10-11`, around line 2418; the section ends at the next line beginning `## `). Immediately before that next `## ` line add:

```markdown
### Recitation audio (2026-10-16): built, gated off, never played

Sheikh Mahmoud Khalil Al-Husary's murattal, one MP3 per ayah for the 585 ayahs the
corner holds, copied into `iqraa-public/quran-audio/husary/` by an owner-run script
(`pnpm --filter @workspace/curriculum run quran-audio`) and played by
`artifacts/mobile/services/quranAudio.ts` (`expo-audio` native, `<audio>` on web — no
native module, no `app.json` version bump). The key shape is
`lib/curriculum/src/quranAudio.ts`; the play queue is the tested reducer
`services/quranPlaylist.ts`; a flashcard word and a recitation never play together
(`services/audioExclusive.ts`).

- **The listen controls are hidden in production.** `QURAN_AUDIO_UPLOADED`
  (`artifacts/mobile/services/quranAudioRelease.ts`) is `false`; `__DEV__` shows them.
  Flip it only after the checklist in
  `lib/curriculum/sources/quran-audio/VERIFY.md` is done.
- **No recording has been fetched, played or measured.** The build sandbox's proxy
  refuses the source host, so the script was unit-tested against a fake fetch and a
  fake bucket and has never touched the real source or the real bucket. Whether each
  file is exactly its ayah (a basmalah spliced into or out of ayah 1, a clipped end)
  is unknown.
- **The screens were typechecked, not seen or heard**, and the native
  "just finished" status event that advances a multi-ayah queue has not run on a
  device. Verification was unit tests for the key builder, the upload decisions, the
  registry, the playlist and the gate, plus typecheck, i18n and design-scale tests.
- **The licence for re-hosting the recordings in a paid product is not answered
  here**, nor is approval in Jordan. Both are the owner's.
- Needs the network; no download or cache. A student offline sees one quiet line and
  can still read and hide.
```

- [ ] **Step 4: Final verification — every suite and the monorepo typecheck**

Run each and read the tail:
```bash
cd /home/user/Iqraa/lib/curriculum && pnpm test 2>&1 | tail -8
cd /home/user/Iqraa/artifacts/mobile && pnpm test 2>&1 | tail -8
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -20
```
Expected: both suites `fail 0`. The root typecheck shows no error in any file this plan touched. It may still show the TS7006 errors in three `artifacts/api-server` DB test files (`familyHomework.db.test.ts`, `paperTotals.db.test.ts`, `resultsPush.db.test.ts`) that predate this work — confirm none of the listed errors is in a file under `lib/curriculum`, `artifacts/mobile`, or `docs`. If any is, fix it before continuing.

- [ ] **Step 5: Prove the gate is shut in what ships**

Run: `cd /home/user/Iqraa && grep -n "QURAN_AUDIO_UPLOADED = " artifacts/mobile/services/quranAudioRelease.ts`
Expected: exactly `export const QURAN_AUDIO_UPLOADED = false;`.

- [ ] **Step 6: Commit and push**

```bash
cd /home/user/Iqraa
git add lib/curriculum/sources/quran-audio/VERIFY.md docs/superpowers/specs/2026-10-16-quran-audio-design.md STATUS.md
git commit -m "Quran audio: owner checklist, spec corrections, STATUS says nothing was played"
git push -u origin claude/happy-bell-hgl63h
```
If the push is rejected as behind, `git fetch origin main && git merge origin/main` (a merge, never a rebase), resolve `STATUS.md` by keeping both sections, re-run Step 4, then push.

- [ ] **Step 7: Update the pull request**

PR NizarAbuahmad/Iqraa#1089 was opened as "Quran Corner audio: design spec". Retitle it to `Quran Corner: recitation audio (Husary), gated off until uploaded` and replace its body with a summary of what is built, the three things that were **not** verified (no recording fetched/played; screens typechecked not seen; native finish event not run), the gate state (`QURAN_AUDIO_UPLOADED = false`), and the four owner items (licence, run the script and commit the manifest, a reciter's spot-check, flip the gate and check on a phone). Keep it a draft. End the body with the session's attribution line.

---

## Self-Review (done against the spec)

**Spec coverage**

| Spec requirement | Task |
| --- | --- |
| URL builder, `quranAudioKey`, `quranAudioAyahs`, validation, new subpath | 1 |
| Upload script: bucket listing/resume, `--dry-run`/`--only`/`--force`, source constant, download checks, stop on auth refusal, manifest, run command | 2 |
| Player: native `expo-audio` + silent-mode, web `<audio>`, `playAyah`/`playSequence`/`stop`, subscription, never rejects, network-only | 4 |
| One audio at a time via registry; `englishAudio.ts` claims | 3a, 4 |
| Pure playlist | 3b |
| Gate constant, `__DEV__` shows | 3c, 4 (hook) |
| Reader: per-ayah ▶, range «استمع», highlight, ≥44 px, a11y label | 5 |
| Memorise: «استمع» beside current ayah, repeat counter and rating untouched, no autoplay | 5 |
| Credit line + quiet error line | 5 |
| i18n keys, Arabic reviewed | 5 |
| Tests listed in *Verification* | 1, 2, 3 |
| `STATUS.md` bullet; honest about unverified | 6 |
| Owner items (licence, run, spot-check, flip, Jordan) | 6 (VERIFY.md, STATUS) |
| No native change / no `app.json` bump | Global Constraints; no task touches them |

**Spec lines this plan deliberately corrects** (all applied in Task 6, Step 2): subpath is `quran-audio`; ayah ceiling 286; audio checklist lives in a new hand-written `sources/quran-audio/VERIFY.md` because `quran-ws/VERIFY.md` is generated; the gate test asserts the constant's type, not its value; `quranPlaylist` is a reducer, not only a queue builder; the key module also exports the origin and URL builder.

**Placeholder scan:** none — every code step carries the code; the one place a step says "adjust" (Task 4 Step 4) names the exact two type definitions to read and forbids a cast.

**Type consistency:** `QuranAudioAyah` (lib) and `PlaylistAyah` (mobile) are both `{ surah: number; ayah: number }` and are used in their own packages only; the hook passes `PlaylistAyah[]` built from `surah.ayahs`. `playSequence(items, opts?)`, `playAyah(surah, ayah)`, `stopQuranAudio()` are named identically in Tasks 4 and 5. `claimAudio`/`registerAudioStop` are named identically in Tasks 3 and 4. The playlist state field is `active` everywhere (the spec's draft said `playing`; the snapshot's `playing` is the current ayah, a different thing — the plan keeps them apart on purpose).

**Checked while writing it:** the code and tests for Tasks 1–3 (key builder, upload logic, registry, playlist, gate) were extracted from this file into a scratch copy outside the repo and run — 38 tests pass — and typechecked under the repo's strict flags (`strict`, `noUncheckedIndexedAccess`, `noImplicitReturns`, `isolatedModules`) with no errors. The CLI wiring (`upload-quran-audio-r2.ts`) and everything importing `expo-audio` / `react-native` (Tasks 4–5) were **not** run or typechecked at plan time.

**Honest limits of this plan:** Tasks 4 and 5 produce code that is typechecked but not executed or rendered, and the upload script is tested only against fakes. The first real proof of any of it is the owner's run in `sources/quran-audio/VERIFY.md`.
