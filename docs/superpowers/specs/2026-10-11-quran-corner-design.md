# Quran Corner («ركن القرآن») in the Library — design

Status: approved in discussion 2026-10-11, awaiting spec review. Nothing is built.

## Problem

The Library (`/curriculum/resources`) has nothing for Islamic Education beyond
the book QR links and frozen practice sheets. The grade 1–10 Islamic Education
books assign specific surahs and ayah ranges for recitation and memorisation
(«سورة العلق: الآيات (1-8)», «سورة القلم (17-33)», «سورة الإسراء (13-17)» …),
yet the app has no Quran text, no reader and no memorisation aid. The repo has
no Quran data at all (checked 2026-10-11).

Constraints that shape the design:

- **Quranic Arabic is never written from memory or taken from PDF extraction.**
  This repo already refuses to write curriculum Arabic from memory, and the
  extraction drops letters (the `pdf-parse` lam contamination in `STATUS.md`).
  For the Quran the rule is absolute: every ayah comes verbatim from one
  verified, pinned, licensed source, and a test proves it.
- **Text source (decided 2026-10-11, revised the same day).** The first choice,
  Tanzil's Uthmani text, could not be fetched from the build sandbox
  (`tanzil.net` is refused by the egress proxy), and the owner asked for a
  different source. The text is now the **King Fahd Glorious Qur'an Printing
  Complex's Mus'haf al-Madinah (Hafs from 'Asim)**, the official publisher,
  taken through the npm package **`@quran.ws/text` 0.1.0**, pinned. The Complex's
  published usage rights allow free use "in websites, software, and other
  similar intermediates" (printing or importing mushaf copies for sale is
  restricted, which this is not); the dataset around it is CC BY 4.0 with
  attribution waived inside a product and asked for when the data itself is
  republished. Not used: the `quran-json` package (CC BY-SA 4.0 files, a Uthmani
  text from quranenc.com with unread terms) and the MIT repackagings that state
  no provenance for their text.
- **What is and is not verified about that text.** Checked by machine: 6,236
  ayahs, every word accounted for; the source's own surah names and ayah counts
  agree with all 40 rows of the hand-typed surah table; the consonants of every
  ayah are identical to two older King Fahd Complex releases, and to a
  Tanzil-style Uthmani copy except the basmala convention and two ayahs of
  Yusuf, which the books do not assign. **Not verified: the diacritics** (the
  v3.0 release encodes some marks with newer code points, so a full-mark
  comparison with older releases is inconclusive). The dataset is Beta, and it
  records that the origin URL of the v3.0 text package is unknown (verifiable by
  SHA-256, not re-fetchable). Its licence puts the duty to check the text against
  an **authorised printed mushaf** on whoever shows it to end users. That check
  is a release requirement (see *Open items*).

## Decisions

| Question | Decision |
| --- | --- |
| Tools | A built-in reader and memorisation tools, plus a link-out resources shelf. |
| Audience | Teachers and students. Both open the same corner. |
| Text scope | **Only the surahs the curriculum names**, and for a surah the book prints in part, **only the ayah ranges the book prints**. A surah whose lesson title has no range is shown whole. |
| Text source | King Fahd Complex Mus'haf al-Madinah (Hafs) through `@quran.ws/text` 0.1.0, pinned; each ayah rendered by the package's own renderer. |
| Progress | On the device, keyed by user id. No table, no migration, no server sync. |
| Build approach | Pure TypeScript and React Native, nothing native. Data in `lib/curriculum`, so it ships over the air like the Lab. |

## Design

### Source

- `@quran.ws/text` is a **pinned dev dependency of `lib/curriculum`** (exact
  version; the lockfile carries its integrity). It is read by the build script
  and by tests, **never imported by the app**. No snapshot file is committed and
  nothing has to be downloaded by hand.
- Each ayah is rendered with the package's own renderer (`Ayah.render` with its
  signs), which re-attaches the waqf and other signs the dataset stores
  separately, so no assembly logic is reimplemented here. The stored ayah text
  is exactly that string: no normalisation, no re-spelling, no
  `normalizeArabic`.
- The data records the package version and the SHA-256 of `data/hafs.json`, so
  a dependency bump fails a test until the data is regenerated and re-checked.
- The package also ships the Complex's own font, which it says is the only one
  guaranteed to draw its code points. That file is committed as an app asset
  (see *Screens*).

### Generated data

- `lib/curriculum/scripts/build-quran-corner.ts` reads the pinned package and
  the 20 `iqra_curriculum_g{1..10}_islamic_sem{1,2}.json` files and writes
  `lib/curriculum/src/data/quran_corner.json`, committed. The app imports only
  that file.
- **Which surahs and ranges.** The script parses each lesson `title_ar` that
  names a surah: «سورة X» with an optional `(a-b)` or `(n)`. A title with no
  range means the whole surah. A title's surah name is matched on a
  diacritic- and hamza-folded form to a hand-typed table of surah numbers and
  ayah counts (not Quranic text). **The build refuses to run unless the
  source's own surah table agrees with that table, name and count, for every
  surah used**, which catches a swap of two surahs of equal length; the
  alternative of reading names from a separate metadata file was dropped because
  the package already carries them.
- **One entry per surah**: surah number, name, `segments` (the union of ranges,
  sorted and merged), and `lessons`: `{ lessonId, gradeId, semester, from, to }`.
  `lessonId` is the existing `kbl-*` id, built with the catalog's own
  `lessonKbId` from the JSON lesson id — **never re-derived from the title**
  (CLAUDE.md: a title does not identify a lesson). 40 surahs on a first scan of
  titles; the test pins the real number.
- **Every ayah in a kept segment** is stored as `{ n, text }`, with the source's
  surah and ayah numbers.
- A credit line is stored once in the file and shown in the corner. The build writes it from the source's own facts (publisher, dataset, version, licence, and that the text was subset and assembled), so it cannot drift from them.
- **Fail closed.** The script exits non-zero if any title containing «سورة»
  fails to parse, any range runs past the surah's ayah count, or a name does not
  resolve. Lessons that read Quran but whose title does not name a surah are not
  covered; `docs/adding-a-book.md` gets a line saying so.

### Screens

All under the already-allowlisted `/curriculum` prefix, so students reach them
with no gating change. `routeGating.test.ts` gets a pin for the new paths, as
it has for `/curriculum/lab`.

- **Entry.** A «ركن القرآن» card beside «المختبر» on `/curriculum/resources`.
- **`/curriculum/quran`** — surahs grouped by grade (from the data's `gradeId`,
  never a picker index — *picker order is persisted state*), each row showing
  the name, the ayah range(s) and the learner's progress count, plus the
  resources shelf.
- **`/curriculum/quran/[surahId]`** — the reader. Ayahs in order with their
  numbers (Latin in data, Arabic-Indic at display only). When segments are not
  contiguous (e.g. البقرة 143–144 and 183–186) a visible «…» marker separates
  them and the ayah numbers stay on, so nobody reads a gap as continuous. Below
  the text: the lessons that assign the surah, each opening its lesson with the
  ayah range it covers (an ayah can be assigned by two lessons, so one per-ayah
  button would hide one of them); then the credit line, a link to the dataset, and the
  pinned package version and file hash.
- **`/curriculum/quran/[surahId]/memorize`** — the tools below.
- **Font.** Readex Pro does not carry the Uthmani marks, and a general Arabic
  font shows gaps. The text is drawn in the Complex's own `UthmanicHafs-v-3.0`
  font, which ships with the dataset and is covered by the same usage rights. It
  is committed as an app asset and loaded through `expo-font` with a static
  `require`, so it is a JavaScript asset: no native module, no new dependency,
  no config plugin, no `app.json` `version` bump. A test reads the font file's
  own character map and checks every code point in `quran_corner.json` against
  it, because a missing glyph falls back to a system font silently (the Lab's
  `Nₐ` case); another checks the file's hash against the one the data records.

### Memorisation tools

Pure logic in `lib/curriculum/src/quranMemorize.ts`, unit-tested without React.

- **Tokens.** An ayah is split on whitespace. A token made only of Quranic
  annotation marks (waqf signs and similar) is glued to the previous word and is
  never hidden on its own.
- **Hide levels**, deterministic so the same ayah looks the same every time:
  every 3rd word, every 2nd word, the second half, all words, and a first-word
  hint. Tapping a hidden word reveals it. Revealing everything reproduces the
  source text exactly (tested as a round trip).
- **Ayah-by-ayah mode** with a repeat counter, then «حفظتها» / «أحتاج مراجعة».
- **Progress** per surah and ayah: `new | learning | memorised`, plus last
  reviewed date. No scheduling, no spaced repetition. **It is the learner's own
  rating and the screen says so.** The app does not hear a recitation and never
  marks anything as correct. A pure reducer and key builder live in
  `artifacts/mobile/services/quranProgress.ts` (inside `services/__tests__/`
  reach, no `react-native` import); the storage adapter is separate. The key
  includes the user id and is read on `user?.id`, as the prep-board key is,
  because a reload mounts the screen before the session restores.

### Resources shelf

- `lib/curriculum/src/data/quran_resources.json` plus a typed loader. Link-out
  only: no embedded audio, no ingested media, no licence questions beyond
  "we link".
- Each entry: provider, kind (reader, recitation audio, tajweed, tafsir, text
  source), URL, `urlCheckedAt` (null when not checked). Descriptions are the
  kind label from the i18n table, not prose about the Quran.
- Candidates, to be confirmed with the owner before merge: Quran.com, Tanzil,
  EveryAyah, MP3Quran, the King Fahd Complex. Most of these hosts are refused
  from this sandbox, so their URLs cannot be opened here and ship with
  `urlCheckedAt: null`.
- Opened with the existing `openExternal`.

### i18n

Arabic and English strings for the corner, entry card and shelf are added to
`services/i18n.ts` beside the `labEntry*` pair. They are our own interface
text, not curriculum.

## Verification

- `lib/curriculum/src/__tests__/quranCorner.test.ts`: every stored ayah equals
  the source line byte-for-byte; the snapshot matches its SHA-256; segments are
  sorted, merged and inside the ayah count; every «سورة» title in the 20
  catalogs is covered; every `lessonId` resolves in the built catalogs; the
  surah count is pinned; the notice is present; code points are in the font.
- `quranMemorize.test.ts`: tokenising, glued marks, each hide level, determinism,
  the full-reveal round trip.
- `quranProgress.test.ts`: reducer, user-scoped key.
- `routeGating.test.ts`: the new paths are reachable by a student.
- Whole-monorepo `pnpm run typecheck`; `lib/curriculum` and mobile suites.
- `STATUS.md` gets a section in the same PR: what exists, what was checked, and
  what was not.

## Not in this slice

Audio playback, speech checking, translations and tafsir text, bookmarks,
spaced repetition, attaching a surah to a class, class-wide progress for
teachers, server-side progress sync, whole-surah text for surahs the book
prints in part, and a link from an Islamic lesson into the corner.

## Open items for the owner

1. **Approval of the text in Jordan.** Whether a digital product holding Quran
   text needs a review by the Ministry of Awqaf or a Quran committee is not
   something the code can answer. Nothing here assumes it either way.
2. **The resources list** needs an owner's eye; its URLs are unchecked.
3. **Verification against a printed mushaf (release requirement).** The
   dataset's licence says whoever publishes Qur'anic text to end users must
   verify it against an authorised printed mushaf. The build writes
   `lib/curriculum/sources/quran-ws/VERIFY.md` listing every shipped ayah; a
   person who reads Arabic checks each letter, vowel and sign against a printed
   Mus'haf al-Madinah and records who and when. Until then the corner must not
   be released, and `STATUS.md` says so. The package is Beta and records no
   origin URL for its v3.0 text package; re-check when it is superseded.
5. **Nothing in this feature can be seen in a browser from this sandbox.** Like
   the Lab, it sits behind sign-in, so the Uthmani rendering and the RTL layout
   are verified by tests and review only until someone opens it.
