# Quran Corner («ركن القرآن») Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A «ركن القرآن» card in the Library opens a corner where teachers and students can read, and memorise with hide-the-words tools, exactly the surahs and ayah ranges the grade 1–10 Islamic Education books assign, plus a shelf of outside resources.

**Architecture:** A build script copies the assigned ayahs, unchanged, from one pinned Tanzil Uthmani snapshot into `lib/curriculum/src/data/quran_corner.json`; scope comes from parsing the lesson titles already in the 20 Islamic catalogs. The app reads that file through a small loader and three new screens under `/curriculum/quran` (inside the already-allowlisted `/curriculum` prefix). Memorisation helpers and progress logic are pure TypeScript with unit tests; progress is stored on the device, keyed by user id. Everything ships over the air like the Science Lab.

**Tech Stack:** TypeScript, Expo / React Native + expo-router (mobile), `@workspace/curriculum` (data + pure helpers), `node --test` with `--experimental-strip-types`, one new JS-only font package (`@expo-google-fonts/amiri-quran`).

**Spec:** `docs/superpowers/specs/2026-10-11-quran-corner-design.md` (read it first; this plan implements it and records two things the spec left to the plan: where the text snapshot comes from, and the exact file layout).

## Global Constraints

- **Quranic text is never typed, pasted from memory, or taken from PDF extraction** — not in code, tests, fixtures, strings or docs. Every ayah in the shipped data is copied by the build script from the pinned snapshot, and a test compares it byte-for-byte. Tests and fixtures use placeholder text (`x96.1`, `ألف باء`).
- **The stored and displayed ayah text is never run through `normalizeArabic`** or any other rewrite. `normalizeArabic` is used only on curriculum *titles*.
- **Scope is exactly what the lesson titles assign:** only surahs a lesson title names, and only the ayah ranges the title prints; a title with no range means the whole surah.
- **Text source: Tanzil Uthmani (`quran-uthmani`), CC BY 3.0, verbatim only** (decided 2026-10-11). If a verifiable copy cannot be obtained, stop and report; never substitute another source (`quran-json` is CC BY-SA 4.0 and its Uthmani text comes from quranenc.com — rejected).
- **No schema change, no API change, no native module, no `app.json` `version` bump.** The one new dependency, `@expo-google-fonts/amiri-quran@0.4.1`, was checked: no dependencies, no config plugin, no `exports` field, JS plus a `.ttf` asset. If Task 7 finds otherwise, stop and report (the OTA `version` rule in CLAUDE.md would apply).
- **Progress is the learner's own rating, stored on the device, keyed by user id.** Nothing in code or copy may call it verified, correct or checked; the app does not hear recitation.
- **Carry lessons by `kbl-*` id, never by title. Group by `gradeId` from the data, never by a picker index.**
- **Arabic digits only at display time** (`toArabicDigits` from `services/labFormat.ts`); data and logic are Latin.
- **The Quran text is always shown right-to-left in the Quran font, whatever the UI language.** Row layouts that hold it use a fixed `row-reverse`, not `isRTL ? … : …`.
- **UI strings:** every new key goes in both `ar` and `en` in `artifacts/mobile/services/i18n.ts`. `i18nTerminology.test.ts` bans «اقرأ» without its fatha, «طلاب» (write «طلبة»), «رمز الصف» and the brand spellings «IQRA»/«Iqraa».
- **Mobile tests** are bare `node --test` over `services/__tests__/**/*.test.ts` only: nothing under test may import `react-native` or `expo-*`, and relative imports need explicit `.ts` extensions. Single file: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>.test.ts`.
- **Curriculum tests:** `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/<file>.test.ts`; whole suite `pnpm test` in that folder.
- **Anything not seen in a browser is labelled so** in the PR and `STATUS.md`. Nothing here can be seen from the build sandbox (sign-in is required).
- **Work on branch `claude/happy-bell-hgl63h`** (PR NizarAbuahmad/Iqraa#1001). Commit after every task with the two trailer lines exactly as in the commit steps below.

## File structure

| File | Responsibility |
| --- | --- |
| `lib/curriculum/src/quranTitles.ts` | Title → surah name + ayah range (pure) |
| `lib/curriculum/src/quranMemorize.ts` | Split an ayah into words; which words a hide level hides (pure) |
| `lib/curriculum/src/quranResources.ts` + `data/quran_resources.json` | Outside-links shelf: type, loader, validator |
| `lib/curriculum/src/quranTypes.ts` | Types of `quran_corner.json` (types only) |
| `lib/curriculum/src/quranView.ts` | Pure view helpers: whole-surah test, range text, group by grade |
| `lib/curriculum/scripts/quranCornerBuild.ts` | Parse snapshot, build the corner, review sheet, input loader (pure + one loader) |
| `lib/curriculum/scripts/build-quran-corner.ts` | CLI: write or `--check` the generated file |
| `lib/curriculum/sources/tanzil/` | Pinned snapshot, `SOURCE.json`, `SHA256SUMS`, generated `REVIEW.md` (build input, never bundled) |
| `lib/curriculum/src/data/quran_corner.json` | **Generated.** The only Quranic text in the app |
| `lib/curriculum/src/quran.ts` | Loader: `QURAN_CORNER`, `QURAN_SURAHS`, `getQuranSurah`, re-exports |
| `artifacts/mobile/services/quranProgress.ts` | Progress reducer, parse, per-user key (pure) |
| `artifacts/mobile/hooks/useQuranProgress.ts` | AsyncStorage adapter + React state |
| `artifacts/mobile/services/quranLinks.ts` | Route builders and URL-param resolver |
| `artifacts/mobile/services/__tests__/support/ttfCmap.ts` | Test-only font character-map reader |
| `artifacts/mobile/app/curriculum/quran/index.tsx` | Corner home: surahs by grade + resources |
| `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx` | Reader |
| `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx` | Memorisation tools |

**One deliberate difference from the spec:** the spec says "a per-ayah action opens the lesson that assigns it". The reader instead lists the lessons that assign the surah, each opening its lesson with the ayah range it covers. An ayah can be assigned by two lessons (الجمعة 9–11 is in grades 4 and 6), which a single per-ayah button cannot show. The spec sentence was amended to match.

Tasks 1–5 need no Quranic text and can run first. **Task 6 stops at an owner gate** (the snapshot file). Tasks 7–10 need Task 6.

---

### Task 1: Read a surah out of a lesson title

**Files:**
- Create: `lib/curriculum/src/quranTitles.ts`
- Test: `lib/curriculum/src/__tests__/quranTitles.test.ts`
- Modify: `lib/curriculum/package.json` (exports)

**Interfaces:**
- Produces: `parseSurahTitle(title: string): SurahTitle | null`, `interface SurahTitle { nameAr: string; key: string; from: number | null; to: number | null }` — `key` is the `normalizeArabic`-folded name; `from`/`to` null means the whole surah. Throws on a title that says «سورة» and cannot be read.

- [ ] **Step 0: Baseline.** Confirm a clean start and that the existing suites pass before changing anything.

```bash
git status --short            # expect: nothing
git branch --show-current     # expect: claude/happy-bell-hgl63h
pnpm install
cd lib/curriculum && pnpm test 2>&1 | tail -8
```
Expected: the suite passes. If it does not, stop and report which tests fail; do not build on a red baseline.

- [ ] **Step 1: Write the failing test.** Create `lib/curriculum/src/__tests__/quranTitles.test.ts`:

```ts
/**
 * What this guards: the Quran Corner's scope is whatever the lesson titles say,
 * so reading a title wrongly shows a student the wrong ayahs, and skipping one
 * silently leaves a lesson's text out. Run against the real titles, not only
 * hand-picked ones.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

import { parseSurahTitle } from '../quranTitles.ts';
import { normalizeArabic } from '../arabic.ts';

describe('parseSurahTitle', () => {
  it('reads a ranged title', () => {
    assert.deepEqual(parseSurahTitle('سورة البقرة: الآيتان الكريمتان (143-144)'), {
      nameAr: 'البقرة',
      key: 'البقره',
      from: 143,
      to: 144,
    });
  });

  it('reads the book\'s own marks and drops only the trailing case mark', () => {
    const r = parseSurahTitle('سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (1-8)');
    assert.equal(r?.nameAr, 'الْعَلَق');
    assert.equal(r?.key, 'العلق');
    assert.deepEqual([r?.from, r?.to], [1, 8]);
  });

  it('reads a title with no range as the whole surah', () => {
    const r = parseSurahTitle('سورة الغاشية');
    assert.equal(r?.nameAr, 'الغاشية');
    assert.deepEqual([r?.from, r?.to], [null, null]);
  });

  it('reads a single ayah', () => {
    const r = parseSurahTitle('سورَةُ المُزَّمِّلِ: الآيَةُ الكَريمَةُ (20)');
    assert.deepEqual([r?.key, r?.from, r?.to], ['المزمل', 20, 20]);
  });

  it('reads a surah named inside a longer lesson title', () => {
    const r = parseSurahTitle('التِّلاوَةُ وَالتَّجْويدُ: سورَةُ الواقِعَةِ، الآياتُ الكَريمَةُ (1-26)');
    assert.deepEqual([r?.key, r?.from, r?.to], ['الواقعه', 1, 26]);
  });

  it('reads a title with no comma or colon before «الآيات»', () => {
    const r = parseSurahTitle('سورةُ الإسراءِ الآياتُ (1-8)');
    assert.deepEqual([r?.nameAr, r?.from, r?.to], ['الإسراء', 1, 8]);
  });

  it('keeps a two-word name together', () => {
    assert.equal(parseSurahTitle('سورة آل عمران: الآيات الكريمة (189-195)')?.key, 'ال عمران');
  });

  it('returns null for a lesson about surahs in general', () => {
    assert.equal(parseSurahTitle('السّورُ المكيّةُ والسّورُ المدنيّةُ'), null);
    assert.equal(parseSurahTitle('القُرْآنُ الكَريمُ'), null);
  });

  it('throws on a title that says «سورة» and cannot be read', () => {
    assert.throws(() => parseSurahTitle('سورة'), /cannot read/);
    assert.throws(() => parseSurahTitle('سورة النمل (9-3)'), /bad ayah range/);
  });
});

describe('every Islamic Education lesson title', () => {
  const dir = new URL('../data/', import.meta.url);
  const files = readdirSync(dir).filter(f => /^iqra_curriculum_g\d+_islamic_sem\d\.json$/.test(f)).sort();
  const titles: string[] = [];
  for (const f of files) {
    const cat = JSON.parse(readFileSync(new URL(f, dir), 'utf8')) as {
      units: Array<{ lessons: Array<{ title_ar: string }> }>;
    };
    for (const u of cat.units) for (const l of u.lessons) titles.push(l.title_ar);
  }

  it('covers all 20 books, grades 1–10 in two semesters', () => {
    assert.equal(files.length, 20);
  });

  it('reads every title that says «سورة», and only those', () => {
    for (const title of titles) {
      const says = /(^|[\s:،,])سوره(\s|$)/.test(normalizeArabic(title));
      assert.equal(parseSurahTitle(title) !== null, says, title);
    }
  });

  // Pinned on purpose: a new book or a retitled lesson changes these numbers, and
  // the corner's scope should be re-read by a person when it does.
  it('names 77 surah lessons across 40 surahs', () => {
    const parsed = titles.map(parseSurahTitle).filter((r): r is NonNullable<typeof r> => r !== null);
    assert.equal(parsed.length, 77);
    assert.equal(new Set(parsed.map(r => r.key)).size, 40);
  });

  it('never returns a name with a leading mark or stray space', () => {
    for (const title of titles) {
      const r = parseSurahTitle(title);
      if (r) assert.match(r.nameAr, /^[^ً-ْٰـ\s]/, title);
      if (r) assert.equal(r.nameAr, r.nameAr.trim(), title);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranTitles.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|not ok|# fail"
```
Expected: FAIL — `Cannot find module '…/quranTitles.ts'`.

- [ ] **Step 3: Write the implementation.** Create `lib/curriculum/src/quranTitles.ts`:

```ts
/**
 * Reading a surah out of a lesson title.
 *
 * The Islamic Education books name what students recite in the lesson title:
 * «سورة العلق: الآيات الكريمة (1-8)», «سورة الغاشية», «سورة المزمل: الآية
 * الكريمة (20)». This is the one place that turns such a title into a surah and
 * an ayah range, so the Quran Corner's scope is exactly what the books assign.
 *
 * Matching is on the folded form (`normalizeArabic`: no harakat, one alif,
 * ة→ه, ى→ي), because the books print the same name with different marks in
 * different grades. The Quran text itself is never folded; this file only reads
 * curriculum titles.
 */
import { normalizeArabic } from './arabic.ts';

export interface SurahTitle {
  /** The name as the book prints it, without «سورة» and without a trailing case mark. */
  nameAr: string;
  /** The name folded for matching — the key into the surah table. */
  key: string;
  /** First and last ayah the title names; both null when it names the whole surah. */
  from: number | null;
  to: number | null;
}

/** «سورة» (folded), at the start of a word. */
const SURAH_WORD = /(^|[\s:،,])سوره(?:\s+|$)/;

/**
 * What follows «سورة» once folded: the name, then an optional «الآيات الكريمة»
 * label (with or without a comma or colon before it), then an optional `(a-b)`
 * or `(n)`.
 */
const TAIL =
  /^(.+?)\s*[،,:]?\s*(?:(?:الايات|الايتان|الايه)(?:\s+(?:الكريمه|الكريمتان))?\s*)?(?:\(\s*(\d+)\s*(?:[-–—]\s*(\d+)\s*)?\))?\s*$/;

/**
 * The surah a lesson title names, or null when it names none («السّورُ
 * المكيّةُ والسّورُ المدنيّةُ» is about surahs in general, not one of them).
 *
 * Throws when a title says «سورة» but cannot be read. The callers are a build
 * script and its test: a silent skip would drop a lesson's text from the corner
 * without anyone being told.
 */
export function parseSurahTitle(title: string): SurahTitle | null {
  const folded = normalizeArabic(title);
  const word = SURAH_WORD.exec(folded);
  if (!word) return null;
  const tail = TAIL.exec(folded.slice(word.index + word[0].length));
  if (!tail) throw new Error(`cannot read the surah title: ${title}`);

  const key = tail[1]!.trim();
  const from = tail[2] ? Number(tail[2]) : null;
  const to = tail[3] ? Number(tail[3]) : from;
  if (from !== null && (from < 1 || (to !== null && to < from))) {
    throw new Error(`bad ayah range in: ${title}`);
  }
  return { nameAr: printedName(title, key), key, from, to };
}

/**
 * The name as the book prints it. The folded key is shorter than the original
 * (harakat are dropped), so find the original text just after «سورة» and take
 * the longest prefix whose fold equals the key. The book prints the name in the
 * genitive («نوحٍ», «لقمانَ»), which reads wrongly as a heading, so the trailing
 * case mark is dropped; every other mark is left as printed.
 */
function printedName(title: string, key: string): string {
  let after = 0;
  for (let i = 1; i <= title.length; i++) {
    if (/(^|[\s:،,])سوره$/.test(normalizeArabic(title.slice(0, i)))) {
      after = i;
      break;
    }
  }
  // «سورَةُ»: the case mark after the taa marbuta belongs to «سورة», not the name.
  while (after < title.length && /[ً-ْٰـ\s]/.test(title[after]!)) after++;
  const rest = title.slice(after);
  for (let end = rest.length; end > 0; end--) {
    const candidate = rest.slice(0, end).trim();
    if (normalizeArabic(candidate) === key) return candidate.replace(/[ً-ْ]+$/, '');
  }
  throw new Error(`cannot recover the printed name "${key}" from: ${title}`);
}
```

- [ ] **Step 4: Run the test to see it pass.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranTitles.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 13`, `# pass 13`, `# fail 0`. (The pinned "77 lessons across 40 surahs" test is the guard: if it fails, the catalogs differ from what this plan was written against — stop and report the new numbers.)

- [ ] **Step 5: Export the module.** In `lib/curriculum/package.json`, in `"exports"`, after the line `"./lab": "./src/lab.ts",` add:

```json
    "./quran-titles": "./src/quranTitles.ts",
```

- [ ] **Step 6: Typecheck and commit.**

```bash
pnpm --filter @workspace/curriculum run typecheck
git add lib/curriculum/src/quranTitles.ts lib/curriculum/src/__tests__/quranTitles.test.ts lib/curriculum/package.json
git commit -m "Quran Corner: read the surah and ayah range out of a lesson title" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```
Expected: typecheck clean.

---

### Task 2: Memorisation helpers

**Files:**
- Create: `lib/curriculum/src/quranMemorize.ts`
- Test: `lib/curriculum/src/__tests__/quranMemorize.test.ts`
- Modify: `lib/curriculum/package.json` (exports)

**Interfaces:**
- Produces: `type HideLevel = 'none' | 'every3' | 'every2' | 'secondHalf' | 'firstWordHint' | 'all'`; `HIDE_LEVELS: readonly HideLevel[]` (display order); `tokenizeAyah(text: string): string[]`; `hiddenFlags(wordCount: number, level: HideLevel): boolean[]`.

- [ ] **Step 1: Write the failing test.** Create `lib/curriculum/src/__tests__/quranMemorize.test.ts`:

```ts
/**
 * What this guards: a hidden word is a word the learner has to recall, so
 * hiding must never change, drop or reorder the text underneath, and a waqf or
 * ayah-end sign must never become a "word" of its own. The words below are
 * placeholders on purpose: this file contains no Quranic text.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { HIDE_LEVELS, hiddenFlags, tokenizeAyah } from '../quranMemorize.ts';

const SAMPLE = 'ألف باء ۖ جيم دال ۝ هاء';

describe('tokenizeAyah', () => {
  it('splits on spaces', () => {
    assert.deepEqual(tokenizeAyah('ألف باء جيم'), ['ألف', 'باء', 'جيم']);
  });

  it('glues a mark-only token to the word before it', () => {
    assert.deepEqual(tokenizeAyah(SAMPLE), ['ألف', 'باء ۖ', 'جيم', 'دال ۝', 'هاء']);
  });

  it('round-trips: joining the words gives the text back', () => {
    assert.equal(tokenizeAyah(SAMPLE).join(' '), SAMPLE);
  });

  it('glues a leading mark onto the first word, so it is never a word of its own', () => {
    assert.deepEqual(tokenizeAyah('ۖ ألف'), ['ۖ ألف']);
    assert.deepEqual(tokenizeAyah('۞ ألف باء'), ['۞ ألف', 'باء']);
  });

  it('round-trips a leading mark before the first word', () => {
    assert.equal(tokenizeAyah('۞ ألف باء').join(' '), '۞ ألف باء');
  });

  it('glues several leading marks onto the first word, in order', () => {
    assert.deepEqual(tokenizeAyah('۞ ۖ ألف باء'), ['۞ ۖ ألف', 'باء']);
    assert.equal(tokenizeAyah('۞ ۖ ألف باء').join(' '), '۞ ۖ ألف باء');
  });

  it('keeps marks-only text as one token and drops nothing', () => {
    assert.deepEqual(tokenizeAyah('۞ ۝'), ['۞ ۝']);
    assert.equal(tokenizeAyah('۞ ۝').join(' '), '۞ ۝');
  });

  it('shows a leading mark with the first word under the firstWordHint level', () => {
    const words = tokenizeAyah('۞ ألف باء جيم');
    assert.deepEqual(words, ['۞ ألف', 'باء', 'جيم']);
    assert.deepEqual(hiddenFlags(words.length, 'firstWordHint'), [false, true, true]);
  });

  it('returns no words for an empty string', () => {
    assert.deepEqual(tokenizeAyah(''), []);
  });
});

describe('hiddenFlags', () => {
  const bits = (n: number, level: Parameters<typeof hiddenFlags>[1]) =>
    hiddenFlags(n, level).map(Number).join('');

  it('hides nothing at "none" and everything at "all"', () => {
    assert.equal(bits(5, 'none'), '00000');
    assert.equal(bits(5, 'all'), '11111');
  });

  it('hides every third word, then every second word', () => {
    assert.equal(bits(7, 'every3'), '0010010');
    assert.equal(bits(5, 'every2'), '01010');
  });

  it('hides the second half, rounding the shown half down', () => {
    assert.equal(bits(4, 'secondHalf'), '0011');
    assert.equal(bits(5, 'secondHalf'), '00111');
    assert.equal(bits(1, 'secondHalf'), '1');
  });

  it('shows only the first word as a hint', () => {
    assert.equal(bits(4, 'firstWordHint'), '0111');
  });

  it('is deterministic and sized to the word count at every level', () => {
    for (const level of HIDE_LEVELS) {
      assert.deepEqual(hiddenFlags(6, level), hiddenFlags(6, level));
      assert.equal(hiddenFlags(6, level).length, 6);
      assert.deepEqual(hiddenFlags(0, level), []);
    }
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranMemorize.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|# fail"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation.** Create `lib/curriculum/src/quranMemorize.ts`:

```ts
/**
 * Memorisation helpers for one ayah, kept pure so they can be tested without
 * React. Nothing here edits the text: an ayah is split into words, and a word is
 * hidden or shown. Showing every word gives back the source string exactly.
 */

/** Arabic letters. A token with none of these is a mark (waqf sign, ayah-end sign …). */
const LETTER = /[ء-يٱ-ۓۺ-ۿ]/;

export type HideLevel = 'none' | 'every3' | 'every2' | 'secondHalf' | 'firstWordHint' | 'all';

export const HIDE_LEVELS: readonly HideLevel[] = ['none', 'every3', 'every2', 'secondHalf', 'firstWordHint', 'all'];

/**
 * Split an ayah into words. A mark-only token is never a word of its own:
 * one after a word is glued to the word before it, and marks before the first
 * word are glued onto the front of that first word. Text made only of marks
 * comes back as one token. Nothing is dropped, and `words.join(' ')` equals
 * the input whenever the input has single spaces. The Quran Corner's data
 * test checks that for every shipped ayah.
 */
export function tokenizeAyah(text: string): string[] {
  const words: string[] = [];
  let leading = ''; // marks seen before the first word
  for (const raw of text.split(' ')) {
    if (raw === '') continue;
    if (LETTER.test(raw)) {
      words.push(leading ? `${leading} ${raw}` : raw);
      leading = '';
    } else if (words.length > 0) {
      words[words.length - 1] += ' ' + raw;
    } else {
      leading = leading ? `${leading} ${raw}` : raw;
    }
  }
  if (leading) words.push(leading); // marks only: keep them, drop nothing
  return words;
}

/**
 * Which words are hidden at a level. Deterministic: the same ayah looks the
 * same every time, so a learner can compare their own attempts.
 */
export function hiddenFlags(wordCount: number, level: HideLevel): boolean[] {
  return Array.from({ length: wordCount }, (_, i) => {
    switch (level) {
      case 'none':
        return false;
      case 'every3':
        return (i + 1) % 3 === 0;
      case 'every2':
        return (i + 1) % 2 === 0;
      case 'secondHalf':
        return i >= Math.floor(wordCount / 2);
      case 'firstWordHint':
        return i > 0;
      case 'all':
        return true;
    }
  });
}
```

- [ ] **Step 4: Run the test to see it pass.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranMemorize.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 14`, `# pass 14`, `# fail 0`.

- [ ] **Step 5: Export, typecheck, commit.** In `lib/curriculum/package.json` exports, after the `"./quran-titles"` line add `    "./quran-memorize": "./src/quranMemorize.ts",`, then:

```bash
pnpm --filter @workspace/curriculum run typecheck
git add lib/curriculum/src/quranMemorize.ts lib/curriculum/src/__tests__/quranMemorize.test.ts lib/curriculum/package.json
git commit -m "Quran Corner: word splitting and hide levels for memorisation" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 3: The resources shelf data

**Files:**
- Create: `lib/curriculum/src/data/quran_resources.json`, `lib/curriculum/src/quranResources.ts`
- Test: `lib/curriculum/src/__tests__/quranResources.test.ts`
- Modify: `lib/curriculum/package.json` (exports)

**Interfaces:**
- Produces: `type QuranResourceKind = 'reader' | 'audio' | 'tajweed' | 'tafsir' | 'text'`; `interface QuranResource { id: string; provider: string; kind: QuranResourceKind; url: string; urlCheckedAt: string | null }`; `QURAN_RESOURCES: QuranResource[]`; `QURAN_RESOURCE_KINDS`; `validateQuranResources(items?): string[]`.

The five entries are *candidates the owner must confirm before merge* (spec, *Open items* 2). Their hosts are refused from the build sandbox, so none has been opened: every `urlCheckedAt` is `null`, and the screen says so.

- [ ] **Step 1: Write the failing test.** Create `lib/curriculum/src/__tests__/quranResources.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_RESOURCES, validateQuranResources, type QuranResource } from '../quranResources.ts';

describe('quran resources', () => {
  it('has no structural problems', () => {
    assert.deepEqual(validateQuranResources(), []);
  });

  it('lists at least one resource', () => {
    assert.ok(QURAN_RESOURCES.length > 0);
  });

  it('rejects a plain-http link, a bad URL, a duplicate id and a malformed check date', () => {
    const base: QuranResource = { id: 'a', provider: 'A', kind: 'reader', url: 'https://a.example', urlCheckedAt: null };
    assert.match(validateQuranResources([{ ...base, url: 'http://a.example' }])[0]!, /not https/);
    assert.match(validateQuranResources([{ ...base, url: 'nope' }])[0]!, /not a URL/);
    assert.match(validateQuranResources([base, base])[0]!, /duplicate id/);
    assert.match(validateQuranResources([{ ...base, urlCheckedAt: '11/10/2026' }])[0]!, /YYYY-MM-DD/);
    assert.match(validateQuranResources([{ ...base, kind: 'video' as never }])[0]!, /unknown kind/);
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranResources.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|# fail"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the data and the loader.** Create `lib/curriculum/src/data/quran_resources.json`:

```json
{
  "items": [
    { "id": "quran-com", "provider": "Quran.com", "kind": "reader", "url": "https://quran.com", "urlCheckedAt": null },
    { "id": "tanzil", "provider": "Tanzil", "kind": "text", "url": "https://tanzil.net", "urlCheckedAt": null },
    { "id": "everyayah", "provider": "EveryAyah", "kind": "audio", "url": "https://everyayah.com", "urlCheckedAt": null },
    { "id": "mp3quran", "provider": "MP3Quran", "kind": "audio", "url": "https://mp3quran.net", "urlCheckedAt": null },
    { "id": "king-fahd-complex", "provider": "King Fahd Complex", "kind": "reader", "url": "https://qurancomplex.gov.sa", "urlCheckedAt": null }
  ]
}
```

Create `lib/curriculum/src/quranResources.ts`:

```ts
/**
 * Outside resources for the Quran Corner: readers, recitation audio, the text
 * source. Link-out only — nothing here is embedded, ingested or copied, so no
 * licence is recorded. `urlCheckedAt` is the date someone last opened the link
 * and saw what it claims to be; null means nobody has, and the screen does not
 * pretend otherwise.
 */
import raw from './data/quran_resources.json' with { type: 'json' };

export type QuranResourceKind = 'reader' | 'audio' | 'tajweed' | 'tafsir' | 'text';

export interface QuranResource {
  id: string;
  /** A brand name, shown as written in both languages. */
  provider: string;
  kind: QuranResourceKind;
  url: string;
  /** `YYYY-MM-DD`, or null when the link has not been checked. */
  urlCheckedAt: string | null;
}

export const QURAN_RESOURCE_KINDS: readonly QuranResourceKind[] = ['reader', 'audio', 'tajweed', 'tafsir', 'text'];

export const QURAN_RESOURCES: QuranResource[] = raw.items as QuranResource[];

/** Structural problems, as messages. This reports; the test decides. */
export function validateQuranResources(items: readonly QuranResource[] = QURAN_RESOURCES): string[] {
  const errors: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    if (seen.has(item.id)) errors.push(`${item.id}: duplicate id`);
    seen.add(item.id);
    if (!item.provider.trim()) errors.push(`${item.id}: blank provider`);
    if (!QURAN_RESOURCE_KINDS.includes(item.kind)) errors.push(`${item.id}: unknown kind "${item.kind}"`);
    try {
      if (new URL(item.url).protocol !== 'https:') errors.push(`${item.id}: ${item.url} is not https`);
    } catch {
      errors.push(`${item.id}: "${item.url}" is not a URL`);
    }
    if (item.urlCheckedAt !== null && !/^\d{4}-\d{2}-\d{2}$/.test(item.urlCheckedAt)) {
      errors.push(`${item.id}: urlCheckedAt must be YYYY-MM-DD or null`);
    }
  }
  return errors;
}
```

- [ ] **Step 4: Run the test to see it pass.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranResources.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 3`, `# pass 3`, `# fail 0`.

- [ ] **Step 5: Export, typecheck, commit.** In `lib/curriculum/package.json` exports add `    "./quran-resources": "./src/quranResources.ts",` after `"./quran-memorize"`, then:

```bash
pnpm --filter @workspace/curriculum run typecheck
git add lib/curriculum/src/data/quran_resources.json lib/curriculum/src/quranResources.ts lib/curriculum/src/__tests__/quranResources.test.ts lib/curriculum/package.json
git commit -m "Quran Corner: the outside-resources shelf (links unchecked)" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```


---

### Task 4: Progress store (pure logic + device adapter)

**Files:**
- Create: `artifacts/mobile/services/quranProgress.ts`, `artifacts/mobile/hooks/useQuranProgress.ts`
- Test: `artifacts/mobile/services/__tests__/quranProgress.test.ts`

**Interfaces:**
- Produces (pure, `services/quranProgress.ts`): `type AyahStatus = 'learning' | 'memorised'`; `type AyahState = AyahStatus | 'new'`; `type QuranProgress = Record<string, Record<string, AyahMark>>`; `quranProgressKey(userId)`, `todayKey(d?)`, `parseProgress(raw)`, `rateAyah(progress, surah, ayah, status | null, today)`, `stateOf(progress, surah, ayah)`, `countMemorised(progress, surah, ayahs)`.
- Produces (hook): `useQuranProgress(): { progress: QuranProgress; loaded: boolean; rate: (surah: number, ayah: number, status: AyahStatus | null) => void }`.

- [ ] **Step 1: Write the failing test.** Create `artifacts/mobile/services/__tests__/quranProgress.test.ts`:

```ts
/**
 * What this guards: progress is stored per person on a shared device, so the key
 * must carry the user id; a corrupt or hand-edited blob must degrade to "no
 * progress" instead of crashing the screen; and rating an ayah must not mutate
 * state that React is holding.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  QURAN_PROGRESS_KEY,
  countMemorised,
  parseProgress,
  quranProgressKey,
  rateAyah,
  stateOf,
  todayKey,
  type QuranProgress,
} from '../quranProgress.ts';

describe('quranProgressKey', () => {
  it('scopes the key to the user, and falls back to the bare key when signed out', () => {
    assert.equal(quranProgressKey('u-1'), `${QURAN_PROGRESS_KEY}:u-1`);
    assert.equal(quranProgressKey(null), QURAN_PROGRESS_KEY);
    assert.equal(quranProgressKey(undefined), QURAN_PROGRESS_KEY);
    assert.notEqual(quranProgressKey('u-1'), quranProgressKey('u-2'));
  });
});

describe('todayKey', () => {
  it('is the local date, zero-padded', () => {
    assert.equal(todayKey(new Date(2026, 0, 5, 1, 30)), '2026-01-05');
    assert.equal(todayKey(new Date(2026, 9, 11, 23, 59)), '2026-10-11');
  });
});

describe('rateAyah', () => {
  it('records a rating with the date, and leaves the input alone', () => {
    const before: QuranProgress = {};
    const after = rateAyah(before, 112, 1, 'memorised', '2026-10-11');
    assert.deepEqual(after, { '112': { '1': { status: 'memorised', at: '2026-10-11' } } });
    assert.deepEqual(before, {});
  });

  it('changes a rating and keeps the other ayahs', () => {
    const p = rateAyah(rateAyah({}, 112, 1, 'learning', '2026-10-01'), 112, 2, 'memorised', '2026-10-02');
    const q = rateAyah(p, 112, 1, 'memorised', '2026-10-03');
    assert.equal(stateOf(q, 112, 1), 'memorised');
    assert.equal(stateOf(q, 112, 2), 'memorised');
    assert.equal(stateOf(p, 112, 1), 'learning', 'the earlier state is not mutated');
  });

  it('clears a rating, and removes a surah once it has none', () => {
    const p = rateAyah({}, 112, 1, 'learning', '2026-10-01');
    assert.deepEqual(rateAyah(p, 112, 1, null, '2026-10-02'), {});
    assert.deepEqual(rateAyah({}, 112, 1, null, '2026-10-02'), {});
  });
});

describe('stateOf and countMemorised', () => {
  const p = rateAyah(rateAyah(rateAyah({}, 96, 1, 'memorised', 'd'), 96, 2, 'learning', 'd'), 96, 3, 'memorised', 'd');

  it('reads "new" for an ayah with no mark', () => {
    assert.equal(stateOf(p, 96, 9), 'new');
    assert.equal(stateOf(p, 1, 1), 'new');
  });

  it('counts only «memorised» among the ayahs asked about', () => {
    assert.equal(countMemorised(p, 96, [1, 2, 3, 4]), 2);
    assert.equal(countMemorised(p, 96, [2, 4]), 0);
    assert.equal(countMemorised(p, 97, [1]), 0);
  });
});

describe('parseProgress', () => {
  it('round-trips what rateAyah wrote', () => {
    const p = rateAyah({}, 96, 1, 'memorised', '2026-10-11');
    assert.deepEqual(parseProgress(JSON.stringify(p)), p);
  });

  it('returns no progress for a missing, unparseable or non-object blob', () => {
    for (const raw of [null, undefined, '', '{not json', '[]', '"x"', '5', 'null']) {
      assert.deepEqual(parseProgress(raw), {}, String(raw));
    }
  });

  it('keeps the good marks and drops the malformed ones', () => {
    const raw = JSON.stringify({
      '96': {
        '1': { status: 'memorised', at: '2026-10-11' },
        '2': { status: 'perfect', at: '2026-10-11' },
        '3': { status: 'learning' },
        x: { status: 'learning', at: 'd' },
      },
      abc: { '1': { status: 'learning', at: 'd' } },
      '97': 'nope',
    });
    assert.deepEqual(parseProgress(raw), { '96': { '1': { status: 'memorised', at: '2026-10-11' } } });
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranProgress.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|# fail"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the pure module.** Create `artifacts/mobile/services/quranProgress.ts`:

```ts
/**
 * Memorisation progress for the Quran Corner. Pure: the storage adapter is
 * `hooks/useQuranProgress.ts`, so this file imports nothing from React Native
 * and can be tested with bare `node --test`.
 *
 * A mark is the LEARNER'S OWN rating. The app does not hear a recitation and
 * cannot tell whether an ayah is really memorised, so nothing here is named or
 * worded as "verified" or "correct". An ayah with no mark is new.
 */

export type AyahStatus = 'learning' | 'memorised';

export interface AyahMark {
  status: AyahStatus;
  /** Local date `YYYY-MM-DD` the learner last rated it. */
  at: string;
}

/** Surah number → ayah number → mark. Both keys are decimal strings, as JSON requires. */
export type QuranProgress = Record<string, Record<string, AyahMark>>;

export type AyahState = AyahStatus | 'new';

export const QURAN_PROGRESS_KEY = '@iqra_quran_progress_v1';

/** Per-user key, in the same `base:userId` form as the other on-device keys. */
export function quranProgressKey(userId: string | null | undefined): string {
  return userId ? `${QURAN_PROGRESS_KEY}:${userId}` : QURAN_PROGRESS_KEY;
}

/** Local calendar date, `YYYY-MM-DD`. Local, not UTC: a learner at 1 a.m. is still on today's date. */
export function todayKey(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Reads what was saved. Anything unreadable or malformed is dropped: a bad blob must never block the screen. */
export function parseProgress(raw: string | null | undefined): QuranProgress {
  if (!raw) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
  const out: QuranProgress = {};
  for (const [surah, ayahs] of Object.entries(parsed as Record<string, unknown>)) {
    if (!/^\d+$/.test(surah) || typeof ayahs !== 'object' || ayahs === null || Array.isArray(ayahs)) continue;
    for (const [ayah, mark] of Object.entries(ayahs as Record<string, unknown>)) {
      const m = mark as Partial<AyahMark> | null;
      if (!/^\d+$/.test(ayah) || !m) continue;
      if ((m.status === 'learning' || m.status === 'memorised') && typeof m.at === 'string') {
        (out[surah] ??= {})[ayah] = { status: m.status, at: m.at };
      }
    }
  }
  return out;
}

/** The progress after rating one ayah; `null` clears the rating. Never mutates its input. */
export function rateAyah(
  progress: QuranProgress,
  surah: number,
  ayah: number,
  status: AyahStatus | null,
  today: string,
): QuranProgress {
  const s = String(surah);
  const a = String(ayah);
  const surahMarks = { ...(progress[s] ?? {}) };
  if (status === null) delete surahMarks[a];
  else surahMarks[a] = { status, at: today };

  const next = { ...progress };
  if (Object.keys(surahMarks).length === 0) delete next[s];
  else next[s] = surahMarks;
  return next;
}

export function stateOf(progress: QuranProgress, surah: number, ayah: number): AyahState {
  return progress[String(surah)]?.[String(ayah)]?.status ?? 'new';
}

/** How many of the given ayahs are rated «memorised». */
export function countMemorised(progress: QuranProgress, surah: number, ayahs: readonly number[]): number {
  return ayahs.filter(n => stateOf(progress, surah, n) === 'memorised').length;
}
```

- [ ] **Step 4: Run the test to see it pass.**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranProgress.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 10`, `# pass 10`, `# fail 0`.

- [ ] **Step 5: Write the device adapter.** Create `artifacts/mobile/hooks/useQuranProgress.ts`. It is not unit-tested (it imports AsyncStorage and React); all of its logic lives in the pure module above. It re-reads when the user id changes, because on web a reload mounts screens before the session restores (the same reason the prep-board key is read on `user?.id`):

```ts
/**
 * Memorisation progress for the signed-in person, on this device. Thin on
 * purpose: every decision is in `services/quranProgress.ts`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@/context/AuthContext';
import {
  parseProgress,
  quranProgressKey,
  rateAyah,
  todayKey,
  type AyahStatus,
  type QuranProgress,
} from '@/services/quranProgress';

export function useQuranProgress(): {
  progress: QuranProgress;
  loaded: boolean;
  rate: (surah: number, ayah: number, status: AyahStatus | null) => void;
} {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [progress, setProgress] = useState<QuranProgress>({});
  const [loaded, setLoaded] = useState(false);
  // The latest value, so two quick taps compose instead of the second one
  // overwriting the first with a stale copy.
  const latest = useRef<QuranProgress>({});

  useEffect(() => {
    let live = true;
    setLoaded(false);
    AsyncStorage.getItem(quranProgressKey(userId))
      .then(raw => {
        if (!live) return;
        const read = parseProgress(raw);
        latest.current = read;
        setProgress(read);
        setLoaded(true);
      })
      .catch(() => {
        // Storage can be unavailable (private window, blocked site data). The
        // screens still work; the ratings just do not survive a reload.
        if (live) setLoaded(true);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  const rate = useCallback(
    (surah: number, ayah: number, status: AyahStatus | null) => {
      const next = rateAyah(latest.current, surah, ayah, status, todayKey());
      latest.current = next;
      setProgress(next);
      AsyncStorage.setItem(quranProgressKey(userId), JSON.stringify(next)).catch(() => {});
    },
    [userId],
  );

  return { progress, loaded, rate };
}
```

- [ ] **Step 6: Commit** (typecheck runs in Task 9 once the screens exist; the hook is exercised there).

```bash
git add artifacts/mobile/services/quranProgress.ts artifacts/mobile/services/__tests__/quranProgress.test.ts artifacts/mobile/hooks/useQuranProgress.ts
git commit -m "Quran Corner: on-device memorisation progress, a learner's own rating" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 5: Types, view helpers and the corner builder (on a synthetic source)

**Files:**
- Create: `lib/curriculum/src/quranTypes.ts`, `lib/curriculum/src/quranView.ts`, `lib/curriculum/scripts/quranCornerBuild.ts`
- Test: `lib/curriculum/src/__tests__/quranView.test.ts`, `lib/curriculum/src/__tests__/quranCornerBuild.test.ts`

**Interfaces:**
- Produces (`quranTypes.ts`): `QuranAyah { n; text }`, `QuranSegment { from; to }`, `QuranLessonRef { lessonId; gradeId; semester: 1 | 2; from; to }`, `QuranSurah { number; nameAr; ayahCount; segments; lessons; ayahs }`, `QuranSource`, `QuranCornerFile { source; notice; surahs }`.
- Produces (`quranView.ts`): `isWholeSurah(s)`, `segmentsText(segments, separator?)`, `surahGradeIds(s)`, `groupSurahsByGrade<T>(surahs): { gradeId; surahs: T[] }[]`.
- Produces (`quranCornerBuild.ts`): `SURAHS`, `parseTanzilTxt`, `assertFullHafs`, `mergeRanges`, `buildCorner(input: BuildInput): QuranCornerFile`, `reviewSheet(corner)`, `loadBuildInput(paths?)`, types `SourceAyah`, `CatalogInput`, `BuildInput`.

`SURAHS` holds surah numbers and ayah **counts** (not Quranic text), typed by hand for the 40 surahs found in the titles. Its two guards are in the builder (count must equal the snapshot's) and in Task 6 (`REVIEW.md`, a person reads each name beside its first ayah). **Do not "fix" a number to make the build pass; a mismatch means the table or the snapshot is wrong, and Task 6's review decides which.**

- [ ] **Step 1: Write the failing tests.** Create `lib/curriculum/src/__tests__/quranView.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { groupSurahsByGrade, isWholeSurah, segmentsText, surahGradeIds } from '../quranView.ts';

const lesson = (gradeId: string) => ({ lessonId: `kbl-${gradeId}`, gradeId, semester: 1 as const, from: 1, to: 1 });

describe('isWholeSurah', () => {
  it('is true only for one segment covering the whole surah', () => {
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 5 }] }), true);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 4 }] }), false);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 2, to: 5 }] }), false);
    assert.equal(isWholeSurah({ ayahCount: 5, segments: [{ from: 1, to: 2 }, { from: 4, to: 5 }] }), false);
  });
});

describe('segmentsText', () => {
  it('writes ranges and single ayahs', () => {
    assert.equal(segmentsText([{ from: 1, to: 8 }, { from: 20, to: 20 }, { from: 43, to: 44 }]), '1–8, 20, 43–44');
    assert.equal(segmentsText([{ from: 1, to: 2 }, { from: 4, to: 5 }], '، '), '1–2، 4–5');
    assert.equal(segmentsText([]), '');
  });
});

describe('groupSurahsByGrade', () => {
  const s = (number: number, ...grades: string[]) => ({ number, lessons: grades.map(lesson) });

  it('files a surah under the first grade that assigns it, in grade order', () => {
    const groups = groupSurahsByGrade([s(62, 'grade-6', 'grade-4'), s(1, 'grade-1'), s(2, 'grade-10'), s(96, 'grade-3')]);
    assert.deepEqual(groups.map(g => [g.gradeId, g.surahs.map(x => x.number)]), [
      ['grade-1', [1]],
      ['grade-3', [96]],
      ['grade-4', [62]],
      ['grade-10', [2]],
    ]);
  });

  it('sorts grade 10 after grade 9, not as a string', () => {
    assert.deepEqual(groupSurahsByGrade([s(2, 'grade-10'), s(17, 'grade-9')]).map(g => g.gradeId), ['grade-9', 'grade-10']);
  });

  it('orders surahs by number inside a group', () => {
    assert.deepEqual(groupSurahsByGrade([s(114, 'grade-1'), s(103, 'grade-1')])[0]!.surahs.map(x => x.number), [103, 114]);
  });
});

describe('surahGradeIds', () => {
  it('lists each grade once, ascending', () => {
    assert.deepEqual(surahGradeIds({ lessons: [lesson('grade-6'), lesson('grade-4'), lesson('grade-4')] }), ['grade-4', 'grade-6']);
  });
});
```

and `lib/curriculum/src/__tests__/quranCornerBuild.test.ts`:

```ts
/**
 * The corner builder, on a synthetic source. The "ayahs" here are placeholders
 * (`x<surah>.<ayah>`) built from the surah table's own counts, so this file
 * contains no Quranic text and can run before the real snapshot is in the repo.
 * What it guards: scope comes from the lesson titles, ranges merge when they
 * touch, every kept ayah is copied unchanged, and the build refuses (rather than
 * guesses) when a name, a count or a range does not fit the source.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  SURAHS,
  assertFullHafs,
  buildCorner,
  mergeRanges,
  parseTanzilTxt,
  reviewSheet,
  type BuildInput,
  type CatalogInput,
} from '../../scripts/quranCornerBuild.ts';

const NOTICE = '# Tanzil Quran Text (placeholder notice)\n# Licence: placeholder';

/** A Tanzil-shaped file for the 40 surahs in the table, with placeholder text. */
function fakeSource(overrides: Record<string, number> = {}): string {
  const lines: string[] = [];
  const surahs = Object.values(SURAHS).sort((a, b) => a.number - b.number);
  for (const s of surahs) {
    const count = overrides[String(s.number)] ?? s.ayahCount;
    for (let a = 1; a <= count; a++) lines.push(`${s.number}|${a}|x${s.number}.${a}`);
  }
  return `${lines.join('\n')}\n${NOTICE}\n`;
}

const lessons = (...titles: string[]): CatalogInput['units'] => [
  { lessons: titles.map((title_ar, i) => ({ id: `u1_l${i + 1}`, title_ar })) },
];

function input(catalogs: CatalogInput[], source = fakeSource()): BuildInput {
  return { source, sourceMeta: { retrievedOn: '2026-10-11', notes: 'test' }, catalogs };
}

describe('SURAHS', () => {
  it('has 40 surahs with distinct, ascending-valid numbers', () => {
    const numbers = Object.values(SURAHS).map(s => s.number);
    assert.equal(numbers.length, 40);
    assert.equal(new Set(numbers).size, 40);
    assert.ok(numbers.every(n => n >= 1 && n <= 114));
  });
});

describe('parseTanzilTxt', () => {
  it('reads sura|aya|text lines and collects # lines as the notice', () => {
    const r = parseTanzilTxt('1|1|a b\n1|2|c\n2|1|d\n# note one\n# note two\n');
    assert.deepEqual(r.ayahs, [
      { surah: 1, ayah: 1, text: 'a b' },
      { surah: 1, ayah: 2, text: 'c' },
      { surah: 2, ayah: 1, text: 'd' },
    ]);
    assert.equal(r.notice, 'note one\nnote two');
  });

  it('does not touch the text: spaces inside it are kept', () => {
    assert.equal(parseTanzilTxt('1|1|a  b \n').ayahs[0]!.text, 'a  b ');
  });

  it('refuses a line it cannot read and numbering that is out of order', () => {
    assert.throws(() => parseTanzilTxt('1|1|a\nnot a line\n'), /unreadable/);
    assert.throws(() => parseTanzilTxt('1|1|a\n1|3|b\n'), /out of order/);
    assert.throws(() => parseTanzilTxt('1|1|a\n3|1|b\n2|1|c\n'), /out of order/);
    assert.throws(() => parseTanzilTxt('2|2|a\n'), /out of order/);
  });
});

describe('assertFullHafs', () => {
  it('refuses a source that is not the full 6,236-ayah text', () => {
    assert.throws(() => assertFullHafs(parseTanzilTxt(fakeSource()).ayahs), /expected 6236/);
  });
});

describe('mergeRanges', () => {
  it('merges overlapping and touching ranges, and keeps gaps', () => {
    assert.deepEqual(mergeRanges([[5, 7], [1, 4]]), [{ from: 1, to: 7 }]);
    assert.deepEqual(mergeRanges([[1, 4], [6, 7]]), [{ from: 1, to: 4 }, { from: 6, to: 7 }]);
    assert.deepEqual(mergeRanges([[1, 10], [3, 4]]), [{ from: 1, to: 10 }]);
    assert.deepEqual(mergeRanges([[20, 20]]), [{ from: 20, to: 20 }]);
    assert.deepEqual(mergeRanges([]), []);
  });
});

describe('buildCorner', () => {
  const g3: CatalogInput = {
    gradeId: 'grade-3',
    semester: 1,
    units: lessons(
      'سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (1-8)',
      'سورَةُ الْعَلَقِ، الآياتُ الْكَريمَةُ (9-19)',
      'سورَةُ الْقَدْرِ',
      'القُرْآنُ الكَريمُ',
    ),
  };
  const g10: CatalogInput = {
    gradeId: 'grade-10',
    semester: 1,
    units: lessons('سورة البقرة: الآيتان الكريمتان (143-144)', 'سورة البقرة: الآيات الكريمة (183-186)'),
  };

  it('takes scope from titles: whole surahs, merged ranges, and nothing else', () => {
    const corner = buildCorner(input([g3, g10]));
    assert.deepEqual(corner.surahs.map(s => s.number), [96, 97, 2]);
    const alaq = corner.surahs[0]!;
    assert.deepEqual(alaq.segments, [{ from: 1, to: 19 }]);
    assert.equal(alaq.ayahs.length, 19);
    assert.equal(corner.surahs[1]!.ayahs.length, 5);
    const baqarah = corner.surahs[2]!;
    assert.deepEqual(baqarah.segments, [{ from: 143, to: 144 }, { from: 183, to: 186 }]);
    assert.deepEqual(baqarah.ayahs.map(a => a.n), [143, 144, 183, 184, 185, 186]);
  });

  it('copies every kept ayah unchanged', () => {
    const baqarah = buildCorner(input([g10])).surahs[0]!;
    assert.deepEqual(baqarah.ayahs[0], { n: 143, text: 'x2.143' });
  });

  it('records each lesson by kbl id, grade and semester', () => {
    const alaq = buildCorner(input([g3])).surahs[0]!;
    assert.deepEqual(alaq.lessons, [
      { lessonId: 'kbl-g3-islamic-s1-nccd-u1_l1', gradeId: 'grade-3', semester: 1, from: 1, to: 8 },
      { lessonId: 'kbl-g3-islamic-s1-nccd-u1_l2', gradeId: 'grade-3', semester: 1, from: 9, to: 19 },
    ]);
    const baqarah = buildCorner(input([g10])).surahs[0]!;
    assert.equal(baqarah.lessons[0]!.lessonId, 'kbl-islamic-s1-nccd-u1_l1', 'grade 10 keeps the historical id form');
  });

  it('carries the notice and a hash of the source', () => {
    const corner = buildCorner(input([g3]));
    assert.match(corner.notice, /Tanzil Quran Text/);
    assert.match(corner.source.sha256, /^[0-9a-f]{64}$/);
    assert.equal(corner.source.licenseName, 'CC BY 3.0');
  });

  it('refuses when the source carries no licence notice', () => {
    const bare = fakeSource().split('\n').filter(l => !l.startsWith('#')).join('\n');
    assert.throws(() => buildCorner(input([g3], bare)), /no licence notice/);
  });

  it('refuses a surah it has no number for, instead of guessing', () => {
    const odd: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة النمل') };
    assert.throws(() => buildCorner(input([odd])), /no surah number/);
  });

  it('refuses when the table\'s ayah count differs from the source', () => {
    assert.throws(() => buildCorner(input([g3], fakeSource({ '96': 20 }))), /table says 19 ayahs, the source has 20/);
  });

  it('refuses a range that runs past the end of the surah', () => {
    const bad: CatalogInput = { gradeId: 'grade-3', semester: 1, units: lessons('سورة العلق: الآيات (9-25)') };
    assert.throws(() => buildCorner(input([bad])), /names ayah 25/);
  });

  it('orders surahs by the first grade that assigns them, then surah number', () => {
    const g1: CatalogInput = { gradeId: 'grade-1', semester: 1, units: lessons('سورة الناس', 'سورة العصر') };
    assert.deepEqual(buildCorner(input([g10, g1, g3])).surahs.map(s => s.number), [103, 114, 96, 97, 2]);
  });
});

describe('reviewSheet', () => {
  it('prints each surah with its first assigned ayah', () => {
    const sheet = reviewSheet(
      buildCorner(input([{ gradeId: 'grade-1', semester: 1, units: lessons('سورة العصر') }])),
    );
    assert.match(sheet, /\| 103 \| العصر \| 3 \| 1–3 \| 1 \| 1: x103\.1 \|/);
  });
});
```

- [ ] **Step 2: Run them to see them fail.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranView.test.ts src/__tests__/quranCornerBuild.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|# fail"
```
Expected: FAIL — modules not found.

- [ ] **Step 3: Write the types and the view helpers.** Create `lib/curriculum/src/quranTypes.ts`:

```ts
/** The shape of `data/quran_corner.json`. Types only, so the build script and the loader can share them. */

export interface QuranAyah {
  /** The ayah number within its surah (Hafs numbering, from the source). */
  n: number;
  /** The source's text for this ayah, unmodified. */
  text: string;
}

/** An inclusive run of consecutive ayahs the books assign. */
export interface QuranSegment {
  from: number;
  to: number;
}

/** One lesson that assigns part of a surah. */
export interface QuranLessonRef {
  /** `kbl-*` lesson id — carried by id, never by title. */
  lessonId: string;
  gradeId: string;
  semester: 1 | 2;
  /** The ayahs this lesson assigns (a whole-surah lesson is 1..ayahCount). */
  from: number;
  to: number;
}

export interface QuranSurah {
  /** The surah number, 1–114. */
  number: number;
  /** The name as the first lesson that names it prints it. */
  nameAr: string;
  /** Ayahs in the whole surah, from the source. */
  ayahCount: number;
  /** The assigned ayahs, merged: sorted, and never touching. */
  segments: QuranSegment[];
  lessons: QuranLessonRef[];
  /** Exactly the ayahs in `segments`, in order. */
  ayahs: QuranAyah[];
}

export interface QuranSource {
  name: string;
  variant: string;
  url: string;
  licenseName: string;
  licenseUrl: string;
  /** `YYYY-MM-DD` the snapshot was downloaded. */
  retrievedOn: string;
  /** SHA-256 of the snapshot file the ayahs were copied from. */
  sha256: string;
  /** How the file was downloaded (the options chosen on the source's page). */
  notes: string;
}

export interface QuranCornerFile {
  source: QuranSource;
  /** The source's own licence notice, verbatim apart from the comment marker. */
  notice: string;
  surahs: QuranSurah[];
}
```

Create `lib/curriculum/src/quranView.ts`:

```ts
/**
 * Pure helpers the Quran Corner screens share. Kept apart from `quran.ts`, which
 * imports the whole generated data file, so these can be tested on small
 * fixtures.
 */
import type { QuranSegment, QuranSurah } from './quranTypes.ts';

/** True when the books assign every ayah of the surah. */
export function isWholeSurah(s: Pick<QuranSurah, 'segments' | 'ayahCount'>): boolean {
  return s.segments.length === 1 && s.segments[0]!.from === 1 && s.segments[0]!.to === s.ayahCount;
}

/** `1–8, 43–44`, Latin digits; the screen converts them at display time. */
export function segmentsText(segments: readonly QuranSegment[], separator = ', '): string {
  return segments.map(g => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join(separator);
}

const gradeNumber = (gradeId: string): number => Number(gradeId.replace('grade-', ''));

/** The grades whose books assign any part of the surah, ascending. */
export function surahGradeIds(s: Pick<QuranSurah, 'lessons'>): string[] {
  return [...new Set(s.lessons.map(l => l.gradeId))].sort((a, b) => gradeNumber(a) - gradeNumber(b));
}

/**
 * Surahs grouped under the first grade that assigns them, grades ascending,
 * surahs by number inside a group. The grade comes from the data, never from a
 * picker position.
 */
export function groupSurahsByGrade<T extends Pick<QuranSurah, 'number' | 'lessons'>>(
  surahs: readonly T[],
): Array<{ gradeId: string; surahs: T[] }> {
  const groups = new Map<string, T[]>();
  for (const s of surahs) {
    const first = surahGradeIds(s)[0];
    if (!first) continue;
    groups.set(first, [...(groups.get(first) ?? []), s]);
  }
  return [...groups.entries()]
    .sort((a, b) => gradeNumber(a[0]) - gradeNumber(b[0]))
    .map(([gradeId, list]) => ({ gradeId, surahs: [...list].sort((a, b) => a.number - b.number) }));
}
```

- [ ] **Step 4: Write the builder.** Create `lib/curriculum/scripts/quranCornerBuild.ts`:

```ts
/**
 * Builds `src/data/quran_corner.json` from a pinned Tanzil snapshot and the 20
 * Islamic Education catalogs. Pure functions plus one loader, shared by the CLI
 * (`build-quran-corner.ts`) and the test that proves the committed file is what
 * these inputs produce.
 *
 * No Quranic text is written here. Every ayah is copied from the snapshot
 * unchanged; the only hand-typed data is `SURAHS`, which holds surah numbers
 * and ayah COUNTS — metadata, checked against the snapshot below.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { lessonKbId } from '../src/curriculumIds.ts';
import { parseSurahTitle } from '../src/quranTitles.ts';
import type {
  QuranAyah,
  QuranCornerFile,
  QuranLessonRef,
  QuranSegment,
  QuranSurah,
} from '../src/quranTypes.ts';

/**
 * The 40 surahs the books name: folded name (as `parseSurahTitle` returns it)
 * → surah number and ayah count.
 *
 * Typed by hand. It is NOT Quranic text, but a wrong number would show a
 * student the wrong surah under a right name, so two checks guard it: the
 * build fails if a count differs from the snapshot's, and the generated
 * `REVIEW.md` prints each surah's first assigned ayah beside its name for a
 * person who reads Arabic to confirm. The count check cannot catch two surahs
 * of equal length swapped (several have 5 or 8 ayahs); the review sheet does.
 */
export const SURAHS: Record<string, { number: number; ayahCount: number }> = {
  'الفاتحه': { number: 1, ayahCount: 7 },
  'البقره': { number: 2, ayahCount: 286 },
  'ال عمران': { number: 3, ayahCount: 200 },
  'النساء': { number: 4, ayahCount: 176 },
  'الانفال': { number: 8, ayahCount: 75 },
  'الاسراء': { number: 17, ayahCount: 111 },
  'الكهف': { number: 18, ayahCount: 110 },
  'لقمان': { number: 31, ayahCount: 34 },
  'الحجرات': { number: 49, ayahCount: 18 },
  'الواقعه': { number: 56, ayahCount: 96 },
  'الجمعه': { number: 62, ayahCount: 11 },
  'الملك': { number: 67, ayahCount: 30 },
  'القلم': { number: 68, ayahCount: 52 },
  'المعارج': { number: 70, ayahCount: 44 },
  'نوح': { number: 71, ayahCount: 28 },
  'المزمل': { number: 73, ayahCount: 20 },
  'النبا': { number: 78, ayahCount: 40 },
  'الطارق': { number: 86, ayahCount: 17 },
  'الاعلي': { number: 87, ayahCount: 19 },
  'الغاشيه': { number: 88, ayahCount: 26 },
  'البلد': { number: 90, ayahCount: 20 },
  'الشمس': { number: 91, ayahCount: 15 },
  'الليل': { number: 92, ayahCount: 21 },
  'الضحي': { number: 93, ayahCount: 11 },
  'الشرح': { number: 94, ayahCount: 8 },
  'التين': { number: 95, ayahCount: 8 },
  'العلق': { number: 96, ayahCount: 19 },
  'القدر': { number: 97, ayahCount: 5 },
  'الزلزله': { number: 99, ayahCount: 8 },
  'العصر': { number: 103, ayahCount: 3 },
  'الهمزه': { number: 104, ayahCount: 9 },
  'الفيل': { number: 105, ayahCount: 5 },
  'قريش': { number: 106, ayahCount: 4 },
  'الماعون': { number: 107, ayahCount: 7 },
  'الكوثر': { number: 108, ayahCount: 3 },
  'النصر': { number: 110, ayahCount: 3 },
  'المسد': { number: 111, ayahCount: 5 },
  'الاخلاص': { number: 112, ayahCount: 4 },
  'الفلق': { number: 113, ayahCount: 5 },
  'الناس': { number: 114, ayahCount: 6 },
};

export interface SourceAyah {
  surah: number;
  ayah: number;
  text: string;
}

/**
 * Reads Tanzil's `sura|aya|text` file. Structure only: lines must be numbered
 * in order, and `#` lines are collected as the licence notice. Nothing is
 * trimmed or rewritten in the text.
 */
export function parseTanzilTxt(txt: string): { ayahs: SourceAyah[]; notice: string } {
  const ayahs: SourceAyah[] = [];
  const notice: string[] = [];
  let lastSurah = 0;
  let lastAyah = 0;
  for (const raw of txt.replace(/^﻿/, '').split(/\r?\n/)) {
    if (raw.startsWith('#')) {
      notice.push(raw.replace(/^#\s?/, ''));
      continue;
    }
    if (raw.trim() === '') continue;
    const m = /^(\d+)\|(\d+)\|(.+)$/.exec(raw);
    if (!m) throw new Error(`unreadable line in the source: ${raw.slice(0, 40)}`);
    const surah = Number(m[1]);
    const ayah = Number(m[2]);
    const inOrder = surah === lastSurah ? ayah === lastAyah + 1 : surah > lastSurah && ayah === 1;
    if (!inOrder) throw new Error(`source out of order at ${surah}:${ayah}`);
    ayahs.push({ surah, ayah, text: m[3]! });
    lastSurah = surah;
    lastAyah = ayah;
  }
  return { ayahs, notice: notice.join('\n').trim() };
}

/** Hafs numbering has 114 surahs and 6,236 ayahs. Any other total is a different text. */
export function assertFullHafs(ayahs: readonly SourceAyah[]): void {
  if (ayahs.length !== 6236) throw new Error(`the source has ${ayahs.length} ayahs, expected 6236 (Hafs)`);
  if (ayahs[ayahs.length - 1]!.surah !== 114) throw new Error('the source does not end at surah 114');
}

/** Merges overlapping and touching ranges: 1–4 and 5–7 are one run, 1–4 and 6–7 are two. */
export function mergeRanges(ranges: ReadonlyArray<readonly [number, number]>): QuranSegment[] {
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const out: QuranSegment[] = [];
  for (const [from, to] of sorted) {
    const last = out[out.length - 1];
    if (last && from <= last.to + 1) last.to = Math.max(last.to, to);
    else out.push({ from, to });
  }
  return out;
}

export interface CatalogInput {
  gradeId: string;
  semester: 1 | 2;
  units: Array<{ lessons: Array<{ id: string; title_ar: string }> }>;
}

export interface BuildInput {
  /** The snapshot file, as read (UTF-8). */
  source: string;
  sourceMeta: { retrievedOn: string; notes: string };
  catalogs: CatalogInput[];
}

const gradeNumber = (gradeId: string): number => Number(gradeId.replace('grade-', ''));

export function buildCorner(input: BuildInput): QuranCornerFile {
  const { ayahs, notice } = parseTanzilTxt(input.source);
  if (!notice) throw new Error('the source carries no licence notice; refusing to build without one');

  const textOf = new Map(ayahs.map(a => [`${a.surah}:${a.ayah}`, a.text]));
  const countOf = new Map<number, number>();
  for (const a of ayahs) countOf.set(a.surah, Math.max(countOf.get(a.surah) ?? 0, a.ayah));

  const found = new Map<
    string,
    { number: number; ayahCount: number; nameAr: string; ranges: Array<[number, number]>; lessons: QuranLessonRef[] }
  >();

  for (const cat of input.catalogs) {
    for (const unit of cat.units) {
      for (const lesson of unit.lessons) {
        const title = parseSurahTitle(lesson.title_ar);
        if (!title) continue;
        const meta = SURAHS[title.key];
        if (!meta) {
          throw new Error(`no surah number for "${title.nameAr}" (${title.key}), in ${cat.gradeId} s${cat.semester} ${lesson.id}`);
        }
        const count = countOf.get(meta.number);
        if (count !== meta.ayahCount) {
          throw new Error(`surah ${meta.number} ("${title.nameAr}"): the table says ${meta.ayahCount} ayahs, the source has ${count}`);
        }
        const from = title.from ?? 1;
        const to = title.to ?? count;
        if (to > count) {
          throw new Error(`"${lesson.title_ar}" names ayah ${to}, but surah ${meta.number} has ${count}`);
        }
        let entry = found.get(title.key);
        if (!entry) {
          entry = { number: meta.number, ayahCount: count, nameAr: title.nameAr, ranges: [], lessons: [] };
          found.set(title.key, entry);
        }
        entry.ranges.push([from, to]);
        entry.lessons.push({
          lessonId: lessonKbId({ gradeId: cat.gradeId, subject: 'islamic', semester: cat.semester }, lesson.id),
          gradeId: cat.gradeId,
          semester: cat.semester,
          from,
          to,
        });
      }
    }
  }

  const surahs: QuranSurah[] = [...found.values()].map(e => {
    const segments = mergeRanges(e.ranges);
    const list: QuranAyah[] = [];
    for (const seg of segments) {
      for (let n = seg.from; n <= seg.to; n++) {
        const text = textOf.get(`${e.number}:${n}`);
        if (text === undefined) throw new Error(`the source has no ${e.number}:${n}`);
        list.push({ n, text });
      }
    }
    const lessons = [...e.lessons].sort(
      (a, b) => gradeNumber(a.gradeId) - gradeNumber(b.gradeId) || a.semester - b.semester,
    );
    return { number: e.number, nameAr: e.nameAr, ayahCount: e.ayahCount, segments, lessons, ayahs: list };
  });
  surahs.sort(
    (a, b) =>
      gradeNumber(a.lessons[0]!.gradeId) - gradeNumber(b.lessons[0]!.gradeId) || a.number - b.number,
  );

  return {
    source: {
      name: 'Tanzil',
      variant: 'quran-uthmani',
      url: 'https://tanzil.net',
      licenseName: 'CC BY 3.0',
      licenseUrl: 'https://tanzil.net/docs/text_license',
      retrievedOn: input.sourceMeta.retrievedOn,
      sha256: createHash('sha256').update(input.source).digest('hex'),
      notes: input.sourceMeta.notes,
    },
    notice,
    surahs,
  };
}

/** A sheet for a person who reads Arabic to confirm each surah's name against its first assigned ayah. */
export function reviewSheet(corner: QuranCornerFile): string {
  const rows = corner.surahs.map(s => {
    const segs = s.segments.map(g => (g.from === g.to ? `${g.from}` : `${g.from}–${g.to}`)).join('، ');
    const grades = [...new Set(s.lessons.map(l => gradeNumber(l.gradeId)))].join(', ');
    return `| ${s.number} | ${s.nameAr} | ${s.ayahCount} | ${segs} | ${grades} | ${s.ayahs[0]!.n}: ${s.ayahs[0]!.text} |`;
  });
  return [
    '# Quran Corner — review sheet',
    '',
    'Generated by `pnpm --filter @workspace/curriculum run build-quran-corner`. Do not edit by hand.',
    '',
    'For each row: does the **name** (as the book prints it) match the **first assigned ayah**,',
    'and do the **ayahs** match what the lesson assigns? Surah numbers and counts were typed by',
    'hand in `scripts/quranCornerBuild.ts`; this sheet is the check that catches two surahs of',
    'equal length being swapped.',
    '',
    '| # | Name (book) | Ayahs in surah | Assigned | Grades | First assigned ayah (source) |',
    '| --- | --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
}

export interface LoadedPaths {
  snapshot: URL;
  meta: URL;
  catalogDir: URL;
}

const PATHS: LoadedPaths = {
  snapshot: new URL('../sources/tanzil/quran-uthmani.txt', import.meta.url),
  meta: new URL('../sources/tanzil/SOURCE.json', import.meta.url),
  catalogDir: new URL('../src/data/', import.meta.url),
};

/** Reads the snapshot, its `SOURCE.json` and the 20 Islamic catalogs, in grade order. */
export function loadBuildInput(paths: LoadedPaths = PATHS): BuildInput {
  const meta = JSON.parse(readFileSync(paths.meta, 'utf8')) as { retrievedOn: string; notes: string };
  const catalogs: CatalogInput[] = [];
  for (let grade = 1; grade <= 10; grade++) {
    for (const semester of [1, 2] as const) {
      const file = new URL(`iqra_curriculum_g${grade}_islamic_sem${semester}.json`, paths.catalogDir);
      const cat = JSON.parse(readFileSync(file, 'utf8')) as { units: CatalogInput['units'] };
      catalogs.push({ gradeId: `grade-${grade}`, semester, units: cat.units });
    }
  }
  return {
    source: readFileSync(paths.snapshot, 'utf8'),
    sourceMeta: { retrievedOn: meta.retrievedOn, notes: meta.notes },
    catalogs,
  };
}
```

- [ ] **Step 5: Run the tests to see them pass.**

```bash
cd lib/curriculum && node --experimental-strip-types --test src/__tests__/quranView.test.ts src/__tests__/quranCornerBuild.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 22`, `# pass 22`, `# fail 0` (6 view + 16 builder).

- [ ] **Step 6: Typecheck and commit.**

```bash
pnpm --filter @workspace/curriculum run typecheck
git add lib/curriculum/src/quranTypes.ts lib/curriculum/src/quranView.ts lib/curriculum/scripts/quranCornerBuild.ts lib/curriculum/src/__tests__/quranView.test.ts lib/curriculum/src/__tests__/quranCornerBuild.test.ts
git commit -m "Quran Corner: corner builder and view helpers, tested on a placeholder source" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 6: Pin the snapshot, generate the data, review it (OWNER GATE)

**Files:**
- Create: `lib/curriculum/sources/tanzil/quran-uthmani.txt`, `lib/curriculum/sources/tanzil/SOURCE.json`, `lib/curriculum/sources/tanzil/SHA256SUMS`, `lib/curriculum/scripts/build-quran-corner.ts`, `lib/curriculum/src/quran.ts`, generated `lib/curriculum/src/data/quran_corner.json`, generated `lib/curriculum/sources/tanzil/REVIEW.md`
- Test: `lib/curriculum/src/__tests__/quranCorner.test.ts`
- Modify: `lib/curriculum/package.json` (exports + script)

**Interfaces:**
- Consumes: Task 5's `buildCorner`, `loadBuildInput`, `parseTanzilTxt`, `assertFullHafs`, `reviewSheet`; Task 2's `tokenizeAyah`.
- Produces (`quran.ts`): `QURAN_CORNER: QuranCornerFile`, `QURAN_SURAHS: readonly QuranSurah[]`, `getQuranSurah(number): QuranSurah | undefined`, and re-exports of the types and of `groupSurahsByGrade`, `isWholeSurah`, `segmentsText`, `surahGradeIds`.

**Why this is a gate.** `tanzil.net` was refused by the build sandbox's egress proxy when this plan was written, and no npm package carrying Tanzil's own file with its licence notice was found (67 candidates scanned). So the file has to come from a person or an environment that can open `tanzil.net`. **If `quran-uthmani.txt` is not already in the repo, stop here, tell the owner exactly what is needed (Step 1), and do not continue to Tasks 7–10.**

- [ ] **Step 1: Obtain the snapshot (owner, or an environment that can reach tanzil.net).** On `https://tanzil.net/download/`: Quran Text Type **Uthmani**, Output **Text (with aya numbers)** — the `sura|aya|text` format. The page also offers toggles for pause marks, sajdah signs, rub-el-hizb marks and the like. Recommended, and the owner's call: pause marks **on** (a learner sees what the printed mushaf shows), sajdah signs **on**, rub-el-hizb marks **off** (a decorative sign that would lead some ayahs). Save the file as `lib/curriculum/sources/tanzil/quran-uthmani.txt` **without opening it in an editor that re-saves it** (no re-encoding, no line-ending changes).

Create `lib/curriculum/sources/tanzil/SOURCE.json`, writing the real date and the exact options chosen:

```json
{
  "retrievedOn": "YYYY-MM-DD",
  "notes": "tanzil.net/download: Uthmani, Text (with aya numbers); pause marks on, sajdah signs on, rub-el-hizb marks off"
}
```

Record the checksum:

```bash
cd lib/curriculum/sources/tanzil && sha256sum quran-uthmani.txt > SHA256SUMS && cat SHA256SUMS
```

- [ ] **Step 2: Inspect the file before trusting the parser.**

```bash
cd lib/curriculum/sources/tanzil
file quran-uthmani.txt                      # expect: UTF-8 text
head -n 3 quran-uthmani.txt                 # expect lines shaped  1|1|<text>
grep -c '^[0-9]' quran-uthmani.txt          # expect: 6236
grep '^#' quran-uthmani.txt | head -n 12    # expect: Tanzil's licence notice
grep -E '^(1|2|112)\|1\|' quran-uthmani.txt # note whether the basmala is inside ayah 1 of surahs 2 and 112
```
If the shape differs from `sura|aya|text`, or the count is not 6236, or there is no `#` notice: **stop and report**; do not edit the file or the parser to fit. Write what you saw about the basmala into `SOURCE.json`'s `notes` (the corner shows exactly what the source has, so a reader should know).

- [ ] **Step 3: Write the CLI.** Create `lib/curriculum/scripts/build-quran-corner.ts`:

```ts
/**
 * Writes `src/data/quran_corner.json` and `sources/tanzil/REVIEW.md`, or with
 * `--check` only verifies the committed file is what the snapshot and the
 * catalogs produce. Run after adding or retitling an Islamic Education lesson.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { assertFullHafs, buildCorner, loadBuildInput, parseTanzilTxt, reviewSheet } from './quranCornerBuild.ts';

const OUT = new URL('../src/data/quran_corner.json', import.meta.url);
const REVIEW = new URL('../sources/tanzil/REVIEW.md', import.meta.url);

const input = loadBuildInput();
assertFullHafs(parseTanzilTxt(input.source).ayahs);
const corner = buildCorner(input);
const json = JSON.stringify(corner, null, 1) + '\n';

if (process.argv.includes('--check')) {
  if (readFileSync(OUT, 'utf8') !== json) {
    console.error('quran_corner.json is out of date. Run: pnpm --filter @workspace/curriculum run build-quran-corner');
    process.exit(1);
  }
  console.log('quran_corner.json is up to date');
} else {
  writeFileSync(OUT, json);
  writeFileSync(REVIEW, reviewSheet(corner));
  const ayahs = corner.surahs.reduce((n, s) => n + s.ayahs.length, 0);
  console.log(`wrote ${corner.surahs.length} surahs, ${ayahs} ayahs`);
}
```

In `lib/curriculum/package.json` `"scripts"`, add after `"audit-r2"` (mind the comma on the line before):

```json
    "build-quran-corner": "node --experimental-strip-types scripts/build-quran-corner.ts"
```

- [ ] **Step 4: Generate.**

```bash
pnpm --filter @workspace/curriculum run build-quran-corner
```
Expected: `wrote 40 surahs, 585 ayahs`. (585 = the union of every assigned range; it was computed from the catalogs when this plan was written. 31 surahs are assigned whole, 9 in part.) A thrown error is a real finding — the likely ones and what they mean: *"table says N ayahs, the source has M"* → the `SURAHS` row, or the snapshot, is wrong; *"names ayah N, but surah S has M"* → the title's range or the surah number is wrong; *"no surah number for …"* → a new surah appeared in a title. **Stop and report, do not edit `SURAHS` to silence it.**

- [ ] **Step 5: Review gate (a person who reads Arabic).** Open `lib/curriculum/sources/tanzil/REVIEW.md`. For each of the 40 rows confirm the **name** matches the **first assigned ayah** and the **assigned ayahs** match the lesson. This is the only check that catches two surahs of equal length being swapped in `SURAHS`. If any row is wrong, fix the `SURAHS` entry, regenerate, and review again. Record who reviewed and when in the commit message (Step 9). **Do not continue until this is done.**

- [ ] **Step 6: Write the failing-then-passing corner test.** Create `lib/curriculum/src/__tests__/quranCorner.test.ts`. (Written after generation because it reads the generated file; it is the regression guard from here on.)

```ts
/**
 * The shipped Quran data. What this guards: every ayah in the app is the
 * snapshot's, unchanged; the snapshot is the pinned one; the file is what the
 * build produces from the current catalogs (so retitling a lesson cannot leave
 * the corner stale); and the scope is the one a person reviewed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import { QURAN_CORNER, QURAN_SURAHS } from '../quran.ts';
import { assertFullHafs, buildCorner, loadBuildInput, parseTanzilTxt } from '../../scripts/quranCornerBuild.ts';
import { tokenizeAyah } from '../quranMemorize.ts';
import { buildG4IslamicSem1Catalog } from '../catalogs/g4IslamicSem1.ts';
import { buildG7IslamicSem1Catalog } from '../catalogs/g7IslamicSem1.ts';

const SNAPSHOT = new URL('../../sources/tanzil/quran-uthmani.txt', import.meta.url);
const SUMS = new URL('../../sources/tanzil/SHA256SUMS', import.meta.url);
const DATA = new URL('../data/quran_corner.json', import.meta.url);

const input = loadBuildInput();
const source = parseTanzilTxt(input.source);
const textOf = new Map(source.ayahs.map(a => [`${a.surah}:${a.ayah}`, a.text]));

describe('the pinned snapshot', () => {
  it('is the complete Hafs text', () => {
    assertFullHafs(source.ayahs);
  });

  it('matches its recorded SHA-256, and the shipped data records the same one', () => {
    const actual = createHash('sha256').update(readFileSync(SNAPSHOT)).digest('hex');
    assert.equal(actual, readFileSync(SUMS, 'utf8').trim().split(/\s+/)[0]);
    assert.equal(QURAN_CORNER.source.sha256, actual);
  });

  it('carries Tanzil\'s licence notice, which the corner must show', () => {
    assert.match(source.notice, /tanzil/i);
    assert.equal(QURAN_CORNER.notice, source.notice);
    assert.equal(QURAN_CORNER.source.licenseName, 'CC BY 3.0');
  });
});

describe('quran_corner.json', () => {
  it('is exactly what the build produces from the snapshot and the catalogs', () => {
    assert.equal(readFileSync(DATA, 'utf8'), JSON.stringify(buildCorner(input), null, 1) + '\n');
  });

  it('holds every ayah byte-for-byte as the snapshot has it', () => {
    let checked = 0;
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) {
        assert.equal(a.text, textOf.get(`${s.number}:${a.n}`), `${s.number}:${a.n}`);
        checked++;
      }
    }
    assert.equal(checked, 585);
  });

  // Pinned on purpose: a new book or a retitled lesson changes these numbers, and
  // the corner's scope (and REVIEW.md) should be re-read by a person when it does.
  it('names 40 surahs from 77 lesson assignments', () => {
    assert.equal(QURAN_SURAHS.length, 40);
    assert.equal(QURAN_SURAHS.reduce((n, s) => n + s.lessons.length, 0), 77);
  });

  it('keeps segments sorted and never touching, and the ayahs exactly cover them', () => {
    for (const s of QURAN_SURAHS) {
      s.segments.forEach((g, i) => {
        assert.ok(g.from >= 1 && g.to >= g.from && g.to <= s.ayahCount, `${s.number} segment ${i}`);
        if (i > 0) assert.ok(g.from > s.segments[i - 1]!.to + 1, `${s.number}: segments ${i - 1} and ${i} touch`);
      });
      const expected = s.segments.flatMap(g => Array.from({ length: g.to - g.from + 1 }, (_, k) => g.from + k));
      assert.deepEqual(s.ayahs.map(a => a.n), expected, `surah ${s.number}`);
      for (const l of s.lessons) {
        assert.ok(s.segments.some(g => l.from >= g.from && l.to <= g.to), `${l.lessonId} is outside the segments`);
      }
    }
  });

  it('has a printed name for every surah, with no stray space or leading mark', () => {
    for (const s of QURAN_SURAHS) {
      assert.ok(s.nameAr.length > 0 && s.nameAr === s.nameAr.trim(), String(s.number));
      assert.match(s.nameAr, /^[^ً-ْٰـ]/, String(s.number));
    }
  });

  it('records lesson ids that the real catalog builders emit', () => {
    const real = {
      'grade-4': new Set(buildG4IslamicSem1Catalog().lessons.map(l => l.id)),
      'grade-7': new Set(buildG7IslamicSem1Catalog().lessons.map(l => l.id)),
    } as const;
    for (const [gradeId, ids] of Object.entries(real)) {
      const refs = QURAN_SURAHS.flatMap(s => s.lessons).filter(l => l.gradeId === gradeId && l.semester === 1);
      assert.ok(refs.length > 0, `${gradeId} semester 1 should assign at least one surah`);
      for (const r of refs) assert.ok(ids.has(r.lessonId), `${r.lessonId} is not a lesson id the ${gradeId} catalog builds`);
    }
  });

  it('splits every ayah into words that join back to it', () => {
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) assert.equal(tokenizeAyah(a.text).join(' '), a.text, `${s.number}:${a.n}`);
    }
  });
});
```

- [ ] **Step 7: Write the loader and export it.** Create `lib/curriculum/src/quran.ts`:

```ts
/**
 * The Quran Corner's data: the surahs and ayahs the grade 1–10 Islamic
 * Education books assign for recitation and memorisation, copied unchanged from
 * one pinned Tanzil snapshot. `data/quran_corner.json` is GENERATED by
 * `scripts/build-quran-corner.ts` — never edit it by hand; `quranCorner.test.ts`
 * regenerates it and compares.
 */
import raw from './data/quran_corner.json' with { type: 'json' };
import type { QuranCornerFile, QuranSurah } from './quranTypes.ts';

export type {
  QuranAyah,
  QuranCornerFile,
  QuranLessonRef,
  QuranSegment,
  QuranSource,
  QuranSurah,
} from './quranTypes.ts';
export { groupSurahsByGrade, isWholeSurah, segmentsText, surahGradeIds } from './quranView.ts';

export const QURAN_CORNER = raw as unknown as QuranCornerFile;
export const QURAN_SURAHS: readonly QuranSurah[] = QURAN_CORNER.surahs;

export function getQuranSurah(number: number): QuranSurah | undefined {
  return QURAN_SURAHS.find(s => s.number === number);
}
```

In `lib/curriculum/package.json` exports, after the `"./quran-resources"` line add `    "./quran": "./src/quran.ts",`. (Do **not** re-export it from `src/index.ts`: it holds the text, and only the corner's screens should pull it into a bundle — the same rule `passages.ts` and `premade.ts` follow.)

- [ ] **Step 8: Run everything for the curriculum package.**

```bash
cd lib/curriculum
node --experimental-strip-types --test src/__tests__/quranCorner.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok"
pnpm --filter @workspace/curriculum run build-quran-corner -- --check
pnpm --filter @workspace/curriculum run typecheck
pnpm test 2>&1 | tail -8
```
Expected: the corner test passes (`# tests 10`), `--check` prints `quran_corner.json is up to date`, typecheck is clean, and the whole suite passes. If the "names 40 surahs from 77" or "585" pins fail, the data differs from what was reviewed: stop and report.

- [ ] **Step 9: Commit.** Replace the reviewer line with the real name and date from Step 5.

```bash
git add lib/curriculum/sources lib/curriculum/scripts/build-quran-corner.ts lib/curriculum/src/quran.ts lib/curriculum/src/data/quran_corner.json lib/curriculum/src/__tests__/quranCorner.test.ts lib/curriculum/package.json
git commit -m "Quran Corner: the assigned ayahs, copied from the pinned Tanzil snapshot" -m $'Review sheet confirmed by <name> on <date> (sources/tanzil/REVIEW.md).\n\nCo-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```


---

### Task 7: Route helpers and the Quran font

**Files:**
- Create: `artifacts/mobile/services/quranLinks.ts`, `artifacts/mobile/services/__tests__/support/ttfCmap.ts`
- Test: `artifacts/mobile/services/__tests__/quranLinks.test.ts`, `artifacts/mobile/services/__tests__/quranFontCoverage.test.ts`
- Modify: `artifacts/mobile/package.json` and `pnpm-lock.yaml` (new dependency), `artifacts/mobile/app/_layout.tsx` (load the font)

**Interfaces:**
- Consumes: `getQuranSurah`, `QuranSurah` from `@workspace/curriculum/quran` (Task 6).
- Produces (`quranLinks.ts`): `QURAN_ROUTE = '/curriculum/quran'`, `surahPath(number: number): string`, `memorizePath(number: number): string`, `resolveSurahParam(param: string | string[] | undefined): QuranSurah | null`.
- Produces (font): the font family name `'AmiriQuran_400Regular'`, usable in any `fontFamily` once the root layout has loaded it.
- Produces (test support): `fontCodePoints(buf: Uint8Array): Set<number>` — code points a TrueType font has glyphs for.

- [ ] **Step 1: Write the failing route test.** Create `artifacts/mobile/services/__tests__/quranLinks.test.ts`:

```ts
/**
 * Route helpers. A surah URL is shareable, so what arrives in the param is
 * untrusted: it resolves to a surah the books assign, or to nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { QURAN_ROUTE, memorizePath, resolveSurahParam, surahPath } from '../quranLinks.ts';

describe('paths', () => {
  it('builds the reader and memorise paths under /curriculum', () => {
    assert.equal(QURAN_ROUTE, '/curriculum/quran');
    assert.equal(surahPath(112), '/curriculum/quran/112');
    assert.equal(memorizePath(112), '/curriculum/quran/112/memorize');
  });
});

describe('resolveSurahParam', () => {
  it('resolves a surah the books assign, including from an array param', () => {
    assert.equal(resolveSurahParam('112')?.number, 112);
    assert.equal(resolveSurahParam(['96', 'x'])?.number, 96);
  });

  it('returns null for a surah the books do not assign, and for anything that is not a number', () => {
    for (const bad of ['0', '5', '115', '999', 'abc', '1e2', '-1', '1.5', '', undefined]) {
      assert.equal(resolveSurahParam(bad), null, String(bad));
    }
    assert.equal(resolveSurahParam([]), null);
  });
});
```

- [ ] **Step 2: Run it to see it fail.**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranLinks.test.ts 2>&1 | grep -E "ERR_MODULE_NOT_FOUND|# fail"
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write the helpers.** Create `artifacts/mobile/services/quranLinks.ts`:

```ts
/**
 * Routes for the Quran Corner. A surah URL is shareable, so the param that
 * arrives is untrusted: it resolves to a surah the books assign or to null.
 */
import { getQuranSurah, type QuranSurah } from '@workspace/curriculum/quran';

export const QURAN_ROUTE = '/curriculum/quran';

export function surahPath(number: number): string {
  return `${QURAN_ROUTE}/${number}`;
}

export function memorizePath(number: number): string {
  return `${QURAN_ROUTE}/${number}/memorize`;
}

export function resolveSurahParam(param: string | string[] | undefined): QuranSurah | null {
  const raw = Array.isArray(param) ? param[0] : param;
  if (!raw || !/^\d{1,3}$/.test(raw)) return null;
  return getQuranSurah(Number(raw)) ?? null;
}
```

- [ ] **Step 4: Run it to see it pass.**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranLinks.test.ts 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# tests 3`, `# pass 3`, `# fail 0`.

- [ ] **Step 5: Add the font package and check it is JS-only.**

```bash
pnpm --filter @workspace/mobile add @expo-google-fonts/amiri-quran@0.4.1
cd artifacts/mobile
ls node_modules/@expo-google-fonts/amiri-quran node_modules/@expo-google-fonts/amiri-quran/400Regular
node -e "const p=require('./node_modules/@expo-google-fonts/amiri-quran/package.json');console.log(p.version,'|',p.license,'|deps:',p.dependencies,'|exports:',p.exports,'|expo:',p.expo)"
test ! -e node_modules/@expo-google-fonts/amiri-quran/app.plugin.js && echo "no config plugin"
```
Expected: `AmiriQuran_400Regular.ttf` listed; `0.4.1 | MIT AND OFL-1.1 |deps: undefined |exports: undefined |expo: undefined`; `no config plugin`. **If any differs (a dependency, a plugin, an `exports` map), stop and report: it may be a native change, and CLAUDE.md's OTA rule (`app.json` `version`) would then apply.** Then confirm `git diff --stat` shows only `artifacts/mobile/package.json` and `pnpm-lock.yaml`.

- [ ] **Step 6: Load the font at startup.** In `artifacts/mobile/app/_layout.tsx`, after the line `import { Almarai_400Regular } from '@expo-google-fonts/almarai';` add:

```ts
import { AmiriQuran_400Regular } from '@expo-google-fonts/amiri-quran';
```

and in `RootLayout`'s `useFonts({ … })` call, after `ReadexPro_700Bold,` add:

```ts
    // The Quran Corner's script. A JS package with a .ttf asset: ships over the
    // air, no native module, so no app.json version bump.
    AmiriQuran_400Regular,
```

- [ ] **Step 7: Write the character-map reader (test support).** Create `artifacts/mobile/services/__tests__/support/ttfCmap.ts` (it does not end in `.test.ts`, so the runner does not execute it as a test). It was checked against Python's fontTools on three real fonts, including Amiri Quran: the code-point sets were identical.

```ts
/**
 * The code points a TrueType/OpenType font has a glyph for, read from its `cmap`
 * table. Formats 4 and 12 cover every font this app loads; any other format is
 * skipped, and a font with neither throws rather than reporting "nothing".
 * Test-only: it exists so a missing glyph fails a test instead of silently
 * falling back to a system font on a student's phone.
 */
export function fontCodePoints(buf: Uint8Array): Set<number> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const u16 = (o: number) => view.getUint16(o);
  const i16 = (o: number) => view.getInt16(o);
  const u32 = (o: number) => view.getUint32(o);

  // An OpenType collection (.ttc) starts with 'ttcf'; none of our fonts is one.
  if (u32(0) === 0x74746366) throw new Error('font collections are not supported');

  let cmapOffset = -1;
  const tables = u16(4);
  for (let i = 0; i < tables; i++) {
    const rec = 12 + i * 16;
    const tag = String.fromCharCode(buf[rec]!, buf[rec + 1]!, buf[rec + 2]!, buf[rec + 3]!);
    if (tag === 'cmap') cmapOffset = u32(rec + 8);
  }
  if (cmapOffset < 0) throw new Error('the font has no cmap table');

  const out = new Set<number>();
  let read = 0;
  const subtables = u16(cmapOffset + 2);
  for (let i = 0; i < subtables; i++) {
    const base = cmapOffset + u32(cmapOffset + 4 + i * 8 + 4);
    const format = u16(base);
    if (format === 4) {
      const segCount = u16(base + 6) / 2;
      for (let s = 0; s < segCount; s++) {
        const end = u16(base + 14 + 2 * s);
        const start = u16(base + 16 + 2 * segCount + 2 * s);
        const delta = i16(base + 16 + 4 * segCount + 2 * s);
        const rangePos = base + 16 + 6 * segCount + 2 * s;
        const range = u16(rangePos);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          let glyph: number;
          if (range === 0) glyph = (c + delta) & 0xffff;
          else {
            glyph = u16(rangePos + range + 2 * (c - start));
            if (glyph !== 0) glyph = (glyph + delta) & 0xffff;
          }
          if (glyph !== 0) out.add(c);
        }
      }
      read++;
    } else if (format === 12) {
      const groups = u32(base + 12);
      for (let g = 0; g < groups; g++) {
        const at = base + 16 + g * 12;
        const start = u32(at);
        const end = u32(at + 4);
        const firstGlyph = u32(at + 8);
        for (let c = start; c <= end; c++) if (firstGlyph + (c - start) !== 0) out.add(c);
      }
      read++;
    }
  }
  if (read === 0) throw new Error('the font has no cmap subtable in format 4 or 12');
  return out;
}
```

- [ ] **Step 8: Write the font-coverage test.** Create `artifacts/mobile/services/__tests__/quranFontCoverage.test.ts`:

```ts
/**
 * What this guards: a code point the Quran font lacks does not fail anywhere —
 * the platform silently draws it in another font, and a Quranic mark can come
 * out as a box or in a different style on a student's phone. (The Lab's «Nₐ»
 * was this exact bug in Readex Pro.) This reads the font file's own character
 * map and checks every code point of the shipped text against it.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { QURAN_SURAHS } from '@workspace/curriculum/quran';
import { fontCodePoints } from './support/ttfCmap.ts';

const FONT = createRequire(import.meta.url).resolve(
  '@expo-google-fonts/amiri-quran/400Regular/AmiriQuran_400Regular.ttf',
);
const glyphs = fontCodePoints(readFileSync(FONT));

describe('the character-map reader', () => {
  it('sees Arabic letters and a space, and not a CJK ideograph', () => {
    assert.ok(glyphs.has(0x627), 'alef');
    assert.ok(glyphs.has(0x20), 'space');
    assert.ok(!glyphs.has(0x4e00), 'CJK ideograph');
  });
});

describe('the Quran font', () => {
  it('has a glyph for every code point in the shipped text', () => {
    const missing = new Map<number, string>();
    for (const s of QURAN_SURAHS) {
      for (const a of s.ayahs) {
        for (const ch of a.text) {
          const cp = ch.codePointAt(0)!;
          if (!glyphs.has(cp) && !missing.has(cp)) missing.set(cp, `${s.number}:${a.n}`);
        }
      }
    }
    const report = [...missing].map(([cp, at]) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')} (first at ${at})`);
    assert.deepEqual(report, []);
  });
});
```

- [ ] **Step 9: Run both mobile tests.**

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/quranFontCoverage.test.ts services/__tests__/quranLinks.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok|U\+"
```
Expected: all pass. **If the coverage test lists code points: do not drop, replace or normalise any character in the data.** Report the list; the fix is a font (or a second font in the stack) that has them, chosen with the owner. As an extra check of the reader on this font, if `fonttools` is available (`pip install fonttools`): `python3 -c "from fontTools.ttLib import TTFont; print(len(TTFont('node_modules/@expo-google-fonts/amiri-quran/400Regular/AmiriQuran_400Regular.ttf').getBestCmap()))"` should print `266`, the number of glyphs the reader found when this plan was written.

- [ ] **Step 10: Typecheck and commit.**

```bash
pnpm run typecheck
git add artifacts/mobile/services/quranLinks.ts artifacts/mobile/services/__tests__/quranLinks.test.ts artifacts/mobile/services/__tests__/quranFontCoverage.test.ts artifacts/mobile/services/__tests__/support/ttfCmap.ts artifacts/mobile/package.json pnpm-lock.yaml artifacts/mobile/app/_layout.tsx
git commit -m "Quran Corner: route helpers, and the Quran font with a glyph-coverage test" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 8: Interface strings

**Files:**
- Modify: `artifacts/mobile/services/i18n.ts` (both locale objects)
- Tests (existing, must stay green): `artifacts/mobile/services/__tests__/i18n.test.ts`, `i18nTerminology.test.ts`

**Interfaces:**
- Produces: the translation keys listed below, used by the screens in Task 9. A key that is missing from `en` is a type error (`TranslationKey = keyof typeof translations.en`); a key missing from `ar` fails `i18n.test.ts`.

These are our own interface text, not curriculum. They contain no Quranic text.

- [ ] **Step 1: Add the Arabic strings.** In `artifacts/mobile/services/i18n.ts`, in the `ar` block, directly after the line `    labNotFound: 'لم نجد هذه المادة. ربما حُذف الرابط أو تغيّر.',` add:

```ts
    // The Quran Corner («ركن القرآن»): the surahs the Islamic Education books assign.
    quranTitle: 'ركن القرآن',
    quranEntryHint: 'قراءة وحفظ سور المنهج',
    quranIntro: 'سور المنهج وآياتها كما وردت في كتب التربية الإسلامية، للقراءة والحفظ.',
    quranWholeSurah: 'السورة كاملة',
    quranAyahsLabel: 'الآيات',
    quranMemorisedLabel: 'محفوظة',
    quranNotFound: 'لم نجد هذه السورة.',
    quranMemorize: 'ابدأ الحفظ',
    quranLessonsTitle: 'الدروس التي تتناولها',
    quranOpenLesson: 'افتح الدرس',
    quranSourceTitle: 'عن النص',
    quranSourceBody: 'النص من مشروع تنزيل (الرسم العثماني) بترخيص CC BY 3.0، وهو معروض دون أي تعديل.',
    quranSourceLink: 'موقع تنزيل',
    quranResourcesTitle: 'مصادر مفيدة',
    quranResourcesNote: 'روابط إلى مواقع خارجية تُفتح خارج التطبيق.',
    quranLinkUnchecked: 'لم يُفتح هذا الرابط للتحقق منه بعد',
    quranKindReader: 'قراءة',
    quranKindAudio: 'تلاوة صوتية',
    quranKindTajweed: 'تجويد',
    quranKindTafsir: 'تفسير',
    quranKindText: 'مصدر النص',
    quranLevelTitle: 'مستوى الإخفاء',
    quranLevelNone: 'إظهار الكل',
    quranLevelEvery3: 'كلمة من كل ثلاث',
    quranLevelEvery2: 'كلمة من كل اثنتين',
    quranLevelSecondHalf: 'النصف الثاني',
    quranLevelFirstWordHint: 'الكلمة الأولى فقط',
    quranLevelAll: 'إخفاء الكل',
    quranTapToReveal: 'اضغط على الكلمة المخفية لتظهر',
    quranShowAll: 'أظهر الكل',
    quranHideAgain: 'أخفِ من جديد',
    quranRepeat: 'التكرار',
    quranRepeatBtn: 'كرّرتها',
    quranRateMemorised: 'حفظتها',
    quranRateLearning: 'أحتاج مراجعة',
    quranRateClear: 'إلغاء التقييم',
    quranSelfRated: 'هذا تقييمك أنت؛ التطبيق لا يستمع إلى تلاوتك ولا يصحّحها.',
    quranStatusNew: 'جديدة',
    quranStatusLearning: 'قيد المراجعة',
    quranStatusMemorised: 'محفوظة',
    quranPrevAyah: 'الآية السابقة',
    quranNextAyah: 'الآية التالية',
```

- [ ] **Step 2: Add the English strings.** In the `en` block, directly after the line `    labNotFound: 'We could not find this item. The link may have been removed or changed.',` add:

```ts
    // The Quran Corner: the surahs the Islamic Education books assign.
    quranTitle: 'Quran Corner',
    quranEntryHint: 'Read and memorise the curriculum surahs',
    quranIntro: 'The surahs and ayahs assigned in the Islamic Education books, to read and memorise.',
    quranWholeSurah: 'Whole surah',
    quranAyahsLabel: 'Ayahs',
    quranMemorisedLabel: 'memorised',
    quranNotFound: 'We could not find this surah.',
    quranMemorize: 'Start memorising',
    quranLessonsTitle: 'Lessons that cover it',
    quranOpenLesson: 'Open lesson',
    quranSourceTitle: 'About the text',
    quranSourceBody: 'The text is from the Tanzil project (Uthmani script), licensed CC BY 3.0, and is shown unmodified.',
    quranSourceLink: 'Tanzil website',
    quranResourcesTitle: 'Useful resources',
    quranResourcesNote: 'Links to outside sites. They open outside the app.',
    quranLinkUnchecked: 'This link has not been opened and checked yet',
    quranKindReader: 'Reader',
    quranKindAudio: 'Recitation audio',
    quranKindTajweed: 'Tajweed',
    quranKindTafsir: 'Tafsir',
    quranKindText: 'Text source',
    quranLevelTitle: 'Hiding level',
    quranLevelNone: 'Show all',
    quranLevelEvery3: 'One word in three',
    quranLevelEvery2: 'One word in two',
    quranLevelSecondHalf: 'Second half',
    quranLevelFirstWordHint: 'First word only',
    quranLevelAll: 'Hide all',
    quranTapToReveal: 'Tap a hidden word to reveal it',
    quranShowAll: 'Show all',
    quranHideAgain: 'Hide again',
    quranRepeat: 'Repetitions',
    quranRepeatBtn: 'I repeated it',
    quranRateMemorised: 'I memorised it',
    quranRateLearning: 'Needs review',
    quranRateClear: 'Clear rating',
    quranSelfRated: 'This is your own rating. The app does not listen to or check your recitation.',
    quranStatusNew: 'New',
    quranStatusLearning: 'In review',
    quranStatusMemorised: 'Memorised',
    quranPrevAyah: 'Previous ayah',
    quranNextAyah: 'Next ayah',
```

- [ ] **Step 3: Have the Arabic read by the repo's reviewer skill.** Invoke the `anthropic-skills:arabic-copy-reviewer` skill on the Arabic block above (register: Jordanian ministry, as the other strings). Apply only changes that keep the meaning; note any it declines in the PR description. Do not weaken `quranSelfRated`.

- [ ] **Step 4: Run the i18n suites.**

```bash
cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/i18n.test.ts services/__tests__/i18nTerminology.test.ts 2>&1 | grep -E "^# (tests|pass|fail)|not ok"
```
Expected: all pass (parity, no empty value, no banned term).

- [ ] **Step 5: Commit.**

```bash
git add artifacts/mobile/services/i18n.ts
git commit -m "Quran Corner: interface strings, Arabic and English" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 9: The screens, the Library card and the route pin

**Files:**
- Create: `artifacts/mobile/app/curriculum/quran/index.tsx`, `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx`, `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx`
- Modify: `artifacts/mobile/app/curriculum/resources.tsx` (entry card), `artifacts/mobile/services/__tests__/routeGating.test.ts` (pin)

**Interfaces:**
- Consumes: everything above — `QURAN_SURAHS`, `QURAN_CORNER`, `groupSurahsByGrade`, `isWholeSurah`, `segmentsText` (`@workspace/curriculum/quran`); `QURAN_RESOURCES` (`…/quran-resources`); `HIDE_LEVELS`, `hiddenFlags`, `tokenizeAyah`, `HideLevel` (`…/quran-memorize`); `useQuranProgress`, `countMemorised`, `stateOf`; `surahPath`, `memorizePath`, `resolveSurahParam`; the translation keys from Task 8; `LabFrame`, `openExternal`, `toArabicDigits`, `getLessonById`.

The screens are React Native and cannot be unit-tested under the bare runner (CLAUDE.md); their logic is in the tested modules. They follow the Lab shelf's patterns (`app/curriculum/lab/index.tsx`): module-scope row components, `LabFrame` for the page frame, explicit `isRTL ? 'row-reverse' : 'row'` for UI chrome. **The Quran text itself is the exception: fixed `row-reverse`, `textAlign: 'right'`, `writingDirection: 'rtl'`, font `AmiriQuran_400Regular`.**

- [ ] **Step 1: Pin the routes (test first).** In `artifacts/mobile/services/__tests__/routeGating.test.ts`, in the `isNonTeacherRoute` "lets a parent or student reach the screens built for them" list, directly after the line `      '/curriculum/lab/lab-periodic-table',` add:

```ts
      // The Quran Corner: home, a surah, and its memorise page. Same prefix rule.
      '/curriculum/quran',
      '/curriculum/quran/112',
      '/curriculum/quran/112/memorize',
```

Run it (it already passes: the prefix allowlist covers these; the pin exists so converting the allowlist to exact matching fails loudly):

```bash
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/routeGating.test.ts 2>&1 | grep -E "^# (pass|fail)"
```
Expected: `# fail 0`.

- [ ] **Step 2: The corner home.** Create `artifacts/mobile/app/curriculum/quran/index.tsx`:

```tsx
/**
 * The Quran Corner — the surahs the Islamic Education books assign, grouped by
 * the first grade that assigns them, and a shelf of outside resources.
 *
 * Reached from the library's «ركن القرآن» card. Student-reachable with no gating
 * change: `/curriculum` is on the non-teacher allowlist and matches by prefix
 * (pinned in routeGating.test.ts).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GRADES } from '@workspace/curriculum';
import {
  QURAN_SURAHS,
  groupSurahsByGrade,
  isWholeSurah,
  segmentsText,
  type QuranSurah,
} from '@workspace/curriculum/quran';
import { QURAN_RESOURCES, type QuranResource, type QuranResourceKind } from '@workspace/curriculum/quran-resources';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { countMemorised, type QuranProgress } from '@/services/quranProgress';
import { openExternal } from '@/services/externalLinks';
import { surahPath } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { LabFrame } from '@/components/lab/LabFrame';
import type { TranslationKey } from '@/services/i18n';

type Colors = ReturnType<typeof useColors>;
type TFn = (key: TranslationKey) => string;

const KIND_LABEL: Record<QuranResourceKind, TranslationKey> = {
  reader: 'quranKindReader',
  audio: 'quranKindAudio',
  tajweed: 'quranKindTajweed',
  tafsir: 'quranKindTafsir',
  text: 'quranKindText',
};

// The data is static, so the grouping is a module constant.
const GROUPS = groupSurahsByGrade(QURAN_SURAHS);

function SurahRow({
  surah,
  progress,
  colors,
  isRTL,
  lang,
  t,
}: {
  surah: QuranSurah;
  progress: QuranProgress;
  colors: Colors;
  isRTL: boolean;
  lang: string;
  t: TFn;
}) {
  const digits = (s: string) => (lang === 'ar' ? toArabicDigits(s) : s);
  const done = countMemorised(progress, surah.number, surah.ayahs.map(a => a.n));
  const where = isWholeSurah(surah)
    ? t('quranWholeSurah')
    : `${t('quranAyahsLabel')} ${digits(segmentsText(surah.segments, lang === 'ar' ? '، ' : ', '))}`;
  const align = isRTL ? 'right' : 'left';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        router.push(surahPath(surah.number) as never);
      }}
      accessibilityRole="button"
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="book-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        {/* The surah name is Arabic whatever the interface language. */}
        <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {surah.nameAr}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {where}
          {done > 0 ? ` · ${t('quranMemorisedLabel')} ${digits(`${done} / ${surah.ayahs.length}`)}` : ''}
        </Text>
      </View>
      <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
    </Pressable>
  );
}

function ResourceRow({
  item,
  colors,
  isRTL,
  t,
}: {
  item: QuranResource;
  colors: Colors;
  isRTL: boolean;
  t: TFn;
}) {
  const align = isRTL ? 'right' : 'left';
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        void openExternal(item.url);
      }}
      accessibilityRole="link"
      style={[
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
      ]}
    >
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="open-outline" size={22} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowTitle, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {item.provider}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
          {t(KIND_LABEL[item.kind])} · {new URL(item.url).host}
        </Text>
        {item.urlCheckedAt === null ? (
          <Text style={[styles.rowMeta, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
            {t('quranLinkUnchecked')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function QuranCornerScreen() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress } = useQuranProgress();
  const align = isRTL ? 'right' : 'left';

  const gradeName = (id: string) => {
    const g = GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };

  return (
    <LabFrame title={t('quranTitle')} subtitle={t('quranIntro')}>
      {GROUPS.map(group => (
        <View key={group.gradeId}>
          <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {gradeName(group.gradeId)}
          </Text>
          {group.surahs.map(s => (
            <SurahRow key={s.number} surah={s} progress={progress} colors={colors} isRTL={isRTL} lang={lang} t={t} />
          ))}
        </View>
      ))}

      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranResourcesTitle')}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranResourcesNote')}
      </Text>
      {QURAN_RESOURCES.map(r => (
        <ResourceRow key={r.id} item={r} colors={colors} isRTL={isRTL} t={t} />
      ))}
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 16, marginTop: 20, marginHorizontal: 16 },
  note: { fontSize: 12, marginTop: 4, marginHorizontal: 16 },
  row: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  icon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { fontSize: 15 },
  rowMeta: { fontSize: 12, marginTop: 2 },
});
```

- [ ] **Step 3: The reader.** Create `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx`:

```tsx
/**
 * The reader — one surah, only the ayahs the books assign. The text is shown
 * exactly as the source has it, always right-to-left in the Quran font. Where
 * the assigned ayahs do not touch (البقرة 143–144, then 183–186) a «…» stands
 * between them and every ayah keeps its number, so a gap is never read as
 * continuous. The URL param is untrusted: it resolves through
 * `resolveSurahParam` or the screen says it could not find the surah.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { GRADES } from '@workspace/curriculum';
import { QURAN_CORNER, isWholeSurah, segmentsText } from '@workspace/curriculum/quran';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { stateOf } from '@/services/quranProgress';
import { getLessonById } from '@/services/knowledgeBase';
import { openExternal } from '@/services/externalLinks';
import { memorizePath, resolveSurahParam } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { LabFrame } from '@/components/lab/LabFrame';

export default function QuranReaderScreen() {
  const { surahId } = useLocalSearchParams<{ surahId: string }>();
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress } = useQuranProgress();
  const align = isRTL ? 'right' : 'left';
  const digits = (s: string | number) => (lang === 'ar' ? toArabicDigits(String(s)) : String(s));

  const surah = resolveSurahParam(surahId);
  if (!surah) {
    return (
      <LabFrame title={t('quranTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('quranNotFound')}
        </Text>
      </LabFrame>
    );
  }

  const gradeName = (id: string) => {
    const g = GRADES.find(x => x.id === id);
    return g ? (lang === 'ar' ? g.nameAr : g.name) : id;
  };
  const sep = lang === 'ar' ? '، ' : ', ';
  const subtitle = isWholeSurah(surah)
    ? t('quranWholeSurah')
    : `${t('quranAyahsLabel')} ${digits(segmentsText(surah.segments, sep))}`;

  return (
    <LabFrame title={surah.nameAr} subtitle={subtitle}>
      <View style={[styles.actions, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync();
            router.push(memorizePath(surah.number) as never);
          }}
          accessibilityRole="button"
          style={[styles.primary, { backgroundColor: colors.primary, flexDirection: isRTL ? 'row-reverse' : 'row' }]}
        >
          <Ionicons name="school-outline" size={18} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14 }}>
            {t('quranMemorize')}
          </Text>
        </Pressable>
      </View>

      <View style={styles.text}>
        {surah.ayahs.map((a, i) => {
          const prev = surah.ayahs[i - 1];
          const gap = prev !== undefined && a.n !== prev.n + 1;
          const memorised = stateOf(progress, surah.number, a.n) === 'memorised';
          return (
            <React.Fragment key={a.n}>
              {gap ? (
                <Text style={[styles.gap, { color: colors.mutedForeground, fontFamily: 'ReadexPro_600SemiBold' }]}>…</Text>
              ) : null}
              {/* Fixed row-reverse: the Quran reads right to left in every interface language. */}
              <View style={[styles.ayah, { borderColor: colors.border, flexDirection: 'row-reverse' }]}>
                <View style={[styles.badge, { backgroundColor: memorised ? colors.primary : colors.muted }]}>
                  <Text
                    style={{
                      color: memorised ? colors.primaryForeground : colors.foreground,
                      fontFamily: 'ReadexPro_500Medium',
                      fontSize: 12,
                    }}
                  >
                    {digits(a.n)}
                  </Text>
                </View>
                <Text style={[styles.quran, { color: colors.foreground }]}>{a.text}</Text>
              </View>
            </React.Fragment>
          );
        })}
      </View>

      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranLessonsTitle')}
      </Text>
      {surah.lessons.map(l => {
        const lesson = getLessonById(l.lessonId);
        const title = lesson ? (lang === 'ar' ? lesson.titleAr : lesson.titleEn) : l.lessonId;
        return (
          <Pressable
            key={l.lessonId}
            onPress={() => {
              Haptics.selectionAsync();
              router.push({ pathname: '/curriculum/lesson-detail', params: { lessonId: l.lessonId } } as never);
            }}
            accessibilityRole="button"
            accessibilityLabel={`${t('quranOpenLesson')}: ${title}`}
            style={[
              styles.lesson,
              { backgroundColor: colors.card, borderColor: colors.border, flexDirection: isRTL ? 'row-reverse' : 'row' },
            ]}
          >
            <View style={{ flex: 1 }}>
              <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, textAlign: align }}>
                {title}
              </Text>
              <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, textAlign: align }}>
                {gradeName(l.gradeId)} · {t('quranAyahsLabel')} {digits(segmentsText([{ from: l.from, to: l.to }]))}
              </Text>
            </View>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.mutedForeground} />
          </Pressable>
        );
      })}

      <View style={[styles.source, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold', fontSize: 14, textAlign: align }}>
          {t('quranSourceTitle')}
        </Text>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: align, marginTop: 4 }}>
          {t('quranSourceBody')}
        </Text>
        <Pressable
          onPress={() => void openExternal(QURAN_CORNER.source.url)}
          accessibilityRole="link"
          style={{ marginTop: 8, alignSelf: isRTL ? 'flex-end' : 'flex-start' }}
        >
          <Text style={{ color: colors.primary, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
            {t('quranSourceLink')} · tanzil.net
          </Text>
        </Pressable>
        <Text selectable style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 8, textAlign: 'left', writingDirection: 'ltr' }}>
          {QURAN_CORNER.notice}
        </Text>
        <Text selectable style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6, textAlign: 'left', writingDirection: 'ltr' }}>
          {`Snapshot ${QURAN_CORNER.source.retrievedOn} · sha256 ${QURAN_CORNER.source.sha256.slice(0, 12)}`}
        </Text>
      </View>
    </LabFrame>
  );
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  actions: { paddingHorizontal: 16, paddingTop: 16 },
  primary: { alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  text: { marginTop: 8 },
  ayah: {
    alignItems: 'flex-start',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 8,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  badge: { minWidth: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  quran: {
    flex: 1,
    fontFamily: 'AmiriQuran_400Regular',
    fontSize: 28,
    lineHeight: 58,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  gap: { textAlign: 'center', fontSize: 22, marginTop: 8 },
  heading: { fontSize: 16, marginTop: 24, marginHorizontal: 16 },
  lesson: {
    alignItems: 'center',
    gap: 12,
    marginHorizontal: 16,
    marginTop: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  source: { margin: 16, marginTop: 24, padding: 14, borderRadius: 14, borderWidth: 1 },
});
```

- [ ] **Step 4: The memorise page.** Create `artifacts/mobile/app/curriculum/quran/[surahId]/memorize.tsx`. The screen splits into an outer component that resolves the param and an inner one that owns the hooks, so no hook runs conditionally:

```tsx
/**
 * Memorise — one ayah at a time. The learner picks how much to hide, taps a
 * hidden word to check themselves, then rates the ayah. The rating is THEIR
 * OWN: the app does not hear a recitation and says so on screen. Hiding never
 * changes the text underneath (`quranMemorize.ts` tests the round trip).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { QuranSurah } from '@workspace/curriculum/quran';
import { HIDE_LEVELS, hiddenFlags, tokenizeAyah, type HideLevel } from '@workspace/curriculum/quran-memorize';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { useQuranProgress } from '@/hooks/useQuranProgress';
import { countMemorised, stateOf, type AyahState } from '@/services/quranProgress';
import { resolveSurahParam } from '@/services/quranLinks';
import { toArabicDigits } from '@/services/labFormat';
import { LabFrame } from '@/components/lab/LabFrame';
import type { TranslationKey } from '@/services/i18n';

const LEVEL_LABEL: Record<HideLevel, TranslationKey> = {
  none: 'quranLevelNone',
  every3: 'quranLevelEvery3',
  every2: 'quranLevelEvery2',
  secondHalf: 'quranLevelSecondHalf',
  firstWordHint: 'quranLevelFirstWordHint',
  all: 'quranLevelAll',
};

const STATE_LABEL: Record<AyahState, TranslationKey> = {
  new: 'quranStatusNew',
  learning: 'quranStatusLearning',
  memorised: 'quranStatusMemorised',
};

type Colors = ReturnType<typeof useColors>;

function Chip({ label, on, onPress, colors }: { label: string; on: boolean; onPress: () => void; colors: Colors }) {
  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      aria-selected={on}
      style={[styles.chip, { backgroundColor: on ? colors.primary : colors.muted }]}
    >
      <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );
}

function Memorize({ surah }: { surah: QuranSurah }) {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const { progress, rate } = useQuranProgress();
  const [index, setIndex] = useState(0);
  const [level, setLevel] = useState<HideLevel>('every3');
  const [revealed, setRevealed] = useState<ReadonlySet<number>>(new Set());
  const [repeats, setRepeats] = useState(0);
  const align = isRTL ? 'right' : 'left';
  const digits = (v: string | number) => (lang === 'ar' ? toArabicDigits(String(v)) : String(v));

  const ayah = surah.ayahs[index]!;
  const words = useMemo(() => tokenizeAyah(ayah.text), [ayah.text]);
  const hidden = useMemo(() => hiddenFlags(words.length, level), [words.length, level]);
  const state = stateOf(progress, surah.number, ayah.n);
  const done = countMemorised(progress, surah.number, surah.ayahs.map(a => a.n));

  const goTo = (i: number) => {
    setIndex(i);
    setRevealed(new Set());
    setRepeats(0);
  };
  const pickLevel = (l: HideLevel) => {
    setLevel(l);
    setRevealed(new Set());
  };
  const toggle = (i: number) =>
    setRevealed(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i);
      else next.add(i);
      return next;
    });
  const showAll = () => setRevealed(new Set(hidden.flatMap((h, i) => (h ? [i] : []))));
  const anyHidden = hidden.some(Boolean);
  const allShown = hidden.every((h, i) => !h || revealed.has(i));

  const subtitle = `${digits(`${index + 1} / ${surah.ayahs.length}`)} · ${t('quranMemorisedLabel')} ${digits(`${done} / ${surah.ayahs.length}`)}`;
  const rateBtn = (label: string, status: 'learning' | 'memorised' | null, active: boolean) => (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync();
        rate(surah.number, ayah.n, status);
      }}
      accessibilityRole="button"
      aria-selected={active}
      style={[styles.rate, { backgroundColor: active ? colors.primary : colors.muted }]}
    >
      <Text style={{ color: active ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 13 }}>
        {label}
      </Text>
    </Pressable>
  );

  return (
    <LabFrame title={surah.nameAr} subtitle={subtitle}>
      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranLevelTitle')}
      </Text>
      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {HIDE_LEVELS.map(l => (
          <Chip key={l} colors={colors} label={t(LEVEL_LABEL[l])} on={level === l} onPress={() => pickLevel(l)} />
        ))}
      </View>

      <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={{ color: colors.mutedForeground, fontFamily: 'ReadexPro_500Medium', fontSize: 12, textAlign: align }}>
          {t('quranAyahsLabel')} {digits(ayah.n)} · {t(STATE_LABEL[state])}
        </Text>
        {/* Fixed row-reverse: the Quran reads right to left in every interface language. */}
        <View style={[styles.words, { flexDirection: 'row-reverse' }]}>
          {words.map((w, i) => {
            const covered = hidden[i]! && !revealed.has(i);
            return (
              <Pressable
                key={i}
                disabled={!hidden[i]}
                onPress={() => toggle(i)}
                accessibilityRole="button"
                accessibilityLabel={covered ? t('quranTapToReveal') : undefined}
                style={covered ? [styles.cover, { backgroundColor: colors.muted }] : undefined}
              >
                <Text style={[styles.quran, { color: colors.foreground, opacity: covered ? 0 : 1 }]}>{w}</Text>
              </Pressable>
            );
          })}
        </View>
        {anyHidden ? (
          <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
            <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 12, flex: 1, textAlign: align }}>
              {t('quranTapToReveal')}
            </Text>
            <Chip
              colors={colors}
              label={allShown ? t('quranHideAgain') : t('quranShowAll')}
              on={false}
              onPress={() => (allShown ? setRevealed(new Set()) : showAll())}
            />
          </View>
        ) : null}
      </View>

      <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16 }]}>
        <Text style={{ color: colors.foreground, fontFamily: 'ReadexPro_500Medium', fontSize: 14, flex: 1, textAlign: align }}>
          {t('quranRepeat')}: {digits(repeats)}
        </Text>
        <Chip colors={colors} label={t('quranRepeatBtn')} on={false} onPress={() => setRepeats(r => r + 1)} />
      </View>

      <View style={[styles.chips, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
        {rateBtn(t('quranRateMemorised'), 'memorised', state === 'memorised')}
        {rateBtn(t('quranRateLearning'), 'learning', state === 'learning')}
        {state !== 'new' ? rateBtn(t('quranRateClear'), null, false) : null}
      </View>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranSelfRated')}
      </Text>

      <View style={[styles.rowEnd, { flexDirection: isRTL ? 'row-reverse' : 'row', paddingHorizontal: 16, marginTop: 16 }]}>
        <Chip
          colors={colors}
          label={t('quranPrevAyah')}
          on={false}
          onPress={() => index > 0 && goTo(index - 1)}
        />
        <View style={{ flex: 1 }} />
        <Chip
          colors={colors}
          label={t('quranNextAyah')}
          on={false}
          onPress={() => index < surah.ayahs.length - 1 && goTo(index + 1)}
        />
      </View>
    </LabFrame>
  );
}

export default function QuranMemorizeScreen() {
  const { surahId } = useLocalSearchParams<{ surahId: string }>();
  const colors = useColors();
  const { t } = useLanguage();
  const surah = resolveSurahParam(surahId);
  if (!surah) {
    return (
      <LabFrame title={t('quranTitle')}>
        <Text style={[styles.missing, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular' }]}>
          {t('quranNotFound')}
        </Text>
      </LabFrame>
    );
  }
  return <Memorize surah={surah} />;
}

const styles = StyleSheet.create({
  missing: { textAlign: 'center', padding: 32 },
  heading: { fontSize: 14, marginTop: 16, marginHorizontal: 16 },
  chips: { flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  rate: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 999 },
  card: { margin: 16, padding: 16, borderRadius: 14, borderWidth: 1, gap: 12 },
  words: { flexWrap: 'wrap', columnGap: 8, rowGap: 4 },
  cover: { borderRadius: 8 },
  quran: { fontFamily: 'AmiriQuran_400Regular', fontSize: 30, lineHeight: 58, writingDirection: 'rtl' },
  rowEnd: { alignItems: 'center', gap: 12 },
  note: { fontSize: 12, marginTop: 10, marginHorizontal: 16 },
});
```

- [ ] **Step 5: The Library entry card.** In `artifacts/mobile/app/curriculum/resources.tsx`, directly after the closing `</Pressable>` of the Science Lab card (the one with `router.push('/curriculum/lab' as never)`; it ends just before `{isStudent || isParent ? (`), add a sibling card that copies its structure:

```tsx
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push('/curriculum/quran' as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t('quranTitle')}, ${t('quranEntryHint')}`}
              style={({ pressed }) => [
                styles.tile,
                { backgroundColor: colors.card, borderColor: colors.border, borderRadius: colors.radius, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <View style={[styles.tileIcon, { backgroundColor: ACCENT + '1F' }]}>
                <Ionicons name="book-outline" size={26} color={ACCENT} />
              </View>
              <Text numberOfLines={2} style={[styles.tileLabel, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
                {t('quranTitle')}
              </Text>
              <Text numberOfLines={2} style={[styles.tileCount, { color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', textAlign: 'center' }]}>
                {t('quranEntryHint')}
              </Text>
            </Pressable>
```

- [ ] **Step 6: Typecheck the whole monorepo and run both suites.**

```bash
pnpm run typecheck
cd lib/curriculum && pnpm test 2>&1 | tail -6
cd ../../artifacts/mobile && pnpm test 2>&1 | tail -6
```
Expected: typecheck clean; both suites pass. Type errors in the three new screens are expected possibilities (this React Native code was written against the Lab screens' patterns but could not be compiled when the plan was written): fix them in the new files only, keep the behaviour described in the comments, and do not loosen types with `any` to get past them.

- [ ] **Step 7: Look at it if you can.** The corner sits behind sign-in, so a browser check needs a signed-in session against an API. If you have one (`pnpm run dev:api`, `pnpm run dev:mobile:web`, see `LOCAL_SETUP.md`), open `/curriculum/quran` at a phone width in Arabic and check: the grade groups; a surah row's range text; the reader's Uthmani script (marks drawn, not boxes), the «…» between non-touching ayahs, the Tanzil notice; the memorise page's six levels, tap-to-reveal, the three ratings and that a rating survives a reload; the Library card. **If you cannot, say so in the PR and `STATUS.md`: do not describe the screens as working.**

- [ ] **Step 8: Commit.**

```bash
git add artifacts/mobile/app/curriculum/quran artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/services/__tests__/routeGating.test.ts
git commit -m "Quran Corner: home, reader, memorise page and the Library entry card" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
```

---

### Task 10: Docs, final verification and the PR

**Files:**
- Modify: `STATUS.md`, `docs/adding-a-book.md`

- [ ] **Step 1: Say how a new Islamic Education book reaches the corner.** In `docs/adding-a-book.md`, in the table under `## Where each track shows up in the app`, add a row after the `Catalog` row:

```markdown
| Catalog (Islamic Education) | the Quran Corner: a lesson whose `title_ar` names a surah («سورة X» with an optional `(a-b)`) puts those ayahs in the corner. After adding or retitling one, run `pnpm --filter @workspace/curriculum run build-quran-corner` and have a person re-read `lib/curriculum/sources/tanzil/REVIEW.md`; `quranCorner.test.ts` fails until the generated data matches. A lesson that quotes Quran but does not name a surah in its title is not covered. |
```

- [ ] **Step 2: Record what exists, and what does not, in `STATUS.md`** (CLAUDE.md: "edit it in the same PR that changed it"). Add a new section directly above `## Messages can be reacted to with an emoji, 2026-10-10` (sections run newest first), using the date you finish and the real reviewer from Task 6 Step 5. Every sentence below is true only if the tasks above ran as written; **change any sentence that did not hold, and keep the "not verified" list honest.**

```markdown
## The Quran Corner: a shelf in the library, <YYYY-MM-DD>

**What a teacher or student can use.** `/curriculum/resources` has a «ركن القرآن»
card opening `/curriculum/quran`: the 40 surahs the grade 1–10 Islamic Education
books name for recitation, grouped under the first grade that assigns them.
Each opens a reader (`/curriculum/quran/<n>`) showing only the ayah ranges the
lesson titles print — 585 ayahs, 31 surahs whole and 9 in part, with a «…» where
a surah's ranges do not touch — and a memorise page (`…/memorize`) with six hide
levels, tap-to-reveal, an ayah-by-ayah repeat counter and a self-rating (جديدة /
قيد المراجعة / محفوظة) kept on the device, per user. Below the surahs, a shelf
of five outside links. Student-reachable through the existing `/curriculum`
prefix allowlist, pinned in `routeGating.test.ts`. No table, no API route, no
native module, no `app.json` version bump: the data lives in `lib/curriculum`,
the font is a JS package, so it ships over the air.

**Where the text comes from.** One pinned Tanzil Uthmani snapshot
(`lib/curriculum/sources/tanzil/`; CC BY 3.0, verbatim only; the options chosen,
the date and the SHA-256 are recorded there). `scripts/build-quran-corner.ts`
copies the assigned ayahs out of it unchanged; `quranCorner.test.ts` compares
every shipped ayah to the snapshot byte for byte, regenerates the file from the
snapshot and the 20 catalogs and compares, and pins 40 surahs / 77 lesson
assignments / 585 ayahs. The scope is read from lesson titles by
`quranTitles.ts`. `quran-json` was rejected: its `LICENSE.txt` and README say
CC BY-SA 4.0 while its npm metadata says CC-BY-4.0, and its Uthmani text comes
from quranenc.com. `quranFontCoverage.test.ts` reads the Amiri Quran font's own
character map and checks every code point of the text against it.

**The surah table was typed by hand** (`SURAHS` in `scripts/quranCornerBuild.ts`:
numbers and ayah counts, not text). The build checks every count against the
snapshot; the equal-length swap it cannot catch was checked by <name> reading
`sources/tanzil/REVIEW.md` on <date>. Re-read that sheet whenever a book is
added.

### What does not work, and what was not verified

- **Nothing here has been seen by a person in a browser or on a device**
  <unless Task 9 Step 7 was done: then say exactly what was looked at>. The
  corner sits behind sign-in. Verification was typecheck, unit tests for the
  pure logic, and the font and data tests.
- **Whether Quran text in an app needs approval in Jordan** (the Ministry of
  Awqaf or a Quran committee) is unknown and is not a code question. Open with
  the owner.
- **The five resource links have never been opened** (`urlCheckedAt` is null on
  each, and the screen says so); their hosts are refused from the build
  sandbox. The list is the planner's candidates, not an approved list.
- **Tanzil's terms were read from the upstream `quran-json` README**, not from
  `tanzil.net` (refused from the sandbox). Someone with access should read the
  live terms.
- **Progress is a self-rating on one device.** The app cannot hear or check a
  recitation, and nothing syncs or shows a teacher.
- **The corner shows the source's text as it is.** Whether the basmala is part
  of ayah 1 of each surah is recorded in `sources/tanzil/SOURCE.json`.
- **A lesson that quotes Quran without naming a surah in its title is not
  covered**, and so is outside the corner.
- **Not built:** audio, speech checking, translations or tafsir text, bookmarks,
  spaced repetition, attaching a surah to a class, a link from an Islamic lesson
  into the corner, whole-surah text for surahs the books print in part.
```

- [ ] **Step 3: Full verification, with output.**

```bash
pnpm run typecheck
cd lib/curriculum && pnpm test 2>&1 | tail -8 && pnpm run build-quran-corner -- --check
cd ../../artifacts/mobile && pnpm test 2>&1 | tail -8
cd ../.. && git status --short
```
Expected: typecheck clean; both suites pass; `quran_corner.json is up to date`; `git status` shows only the docs edits. Read the actual output before saying any of that is true.

- [ ] **Step 4: Re-read the diff adversarially, then push.** Look for: any Arabic Quranic text typed by hand (there must be none outside `sources/tanzil/` and the generated JSON); any `normalizeArabic` applied to ayah text (there must be none); any use of the words «تم التحقق» / "verified" / «صحيح» near progress; a hand-written `AmiriQuran` import outside the layout and `fontFamily` strings; the `urlCheckedAt` values (all `null` unless someone really opened the links).

```bash
git add STATUS.md docs/adding-a-book.md
git commit -m "Quran Corner: STATUS and adding-a-book" -m $'Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>\nClaude-Session: https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY'
git push -u origin claude/happy-bell-hgl63h
```

- [ ] **Step 5: Update the PR.** The PR (NizarAbuahmad/Iqraa#1001) is a draft and was titled as a spec. Retitle it «Quran Corner («ركن القرآن») in the Library», keep it a draft, and rewrite the body: what it adds; the licence route and why `quran-json` was rejected; **the three open items for the owner** (Jordan approval, the unopened resource links, Tanzil's live terms); the reviewer of `REVIEW.md`; what was and was not seen in a browser; and "schema-push: n/a, no migration, no version bump". Say plainly that **`SURAHS` (surah numbers and ayah counts) was typed by hand** and name its two guards (the build's count check and the `REVIEW.md` read). List any change the Arabic reviewer skill declined. End the body with `🤖 Generated with [Claude Code](https://claude.com/claude-code)` and the session link `https://claude.ai/code/session_019NrGKPQMgbkMzSTzD6mEEY`. Then leave the PR subscribed; CI results and review comments arrive as events.

