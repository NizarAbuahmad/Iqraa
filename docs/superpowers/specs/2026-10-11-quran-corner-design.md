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
- **Licence.** Decided 2026-10-11: **Tanzil Uthmani text, CC BY 3.0, verbatim
  only**. Not the `quran-json` npm package: its `LICENSE.txt` and README say
  CC BY-SA 4.0 while its npm metadata says CC-BY-4.0, and its Uthmani source
  (quranenc.com) has terms nobody here has read.
- **The text source is not reachable from the build sandbox today.**
  `tanzil.net` and the jsDelivr CDN are refused by the egress proxy; the npm
  registry and `raw.githubusercontent.com` are reachable. See *Source
  snapshot* and *Open items*.

## Decisions

| Question | Decision |
| --- | --- |
| Tools | A built-in reader and memorisation tools, plus a link-out resources shelf. |
| Audience | Teachers and students. Both open the same corner. |
| Text scope | **Only the surahs the curriculum names**, and for a surah the book prints in part, **only the ayah ranges the book prints**. A surah whose lesson title has no range is shown whole. |
| Text source | Tanzil Uthmani, pinned snapshot, byte-for-byte. |
| Progress | On the device, keyed by user id. No table, no migration, no server sync. |
| Build approach | Pure TypeScript and React Native, nothing native. Data in `lib/curriculum`, so it ships over the air like the Lab. |

## Design

### Source snapshot

- A pinned copy of Tanzil's `quran-uthmani` text and its metadata is committed
  **outside `src/`** (e.g. `lib/curriculum/sources/tanzil/`) with a
  `SOURCE.md` (URL it came from, date, version) and a SHA-256 manifest. It is a
  build input, never imported by the app.
- Where it comes from is decided in the plan, in this order: a copy with a
  recorded checksum from a path this sandbox can reach (the `quran-json` repo
  keeps upstream snapshots under `data/`, and its tag `v3.1.2` is on
  `raw.githubusercontent.com`); otherwise the owner supplies the file. **If no
  verifiable copy of Tanzil's own text can be obtained, the build stops and
  says so. It does not fall back to another source.**
- The stored ayah text is the source's line, unmodified: no normalisation, no
  re-spelling, no `normalizeArabic`. Whether the source folds the basmala into
  ayah 1 is read from the real snapshot in the plan, and the corner shows
  exactly what the source has.

### Generated data

- `lib/curriculum/scripts/build-quran-corner.ts` reads the snapshot and the 20
  `iqra_curriculum_g{1..10}_islamic_sem{1,2}.json` files and writes
  `lib/curriculum/src/data/quran_corner.json`, committed. The app imports only
  that file.
- **Which surahs and ranges.** The script parses each lesson `title_ar` that
  names a surah: «سورة X» with an optional `(a-b)` or `(n)`. A title with no
  range means the whole surah. Names are matched on a diacritic- and
  hamza-folded form against the surah names in Tanzil's metadata, not a table
  typed by hand; if the metadata cannot supply names, a hand table is allowed
  only with a test that every range fits the source's ayah count, and the PR
  says so.
- **One entry per surah**: surah number, name, `segments` (the union of ranges,
  sorted and merged), and `lessons`: `{ lessonId, gradeId, semester, from, to }`.
  `lessonId` is the existing `kbl-*` id, built with the catalog's own
  `lessonKbId` from the JSON lesson id — **never re-derived from the title**
  (CLAUDE.md: a title does not identify a lesson). 40 surahs on a first scan of
  titles; the test pins the real number.
- **Every ayah in a kept segment** is stored as `{ n, text }`, with the source's
  surah and ayah numbers.
- Tanzil's licence notice is stored once in the file and shown in the corner.
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
  button would hide one of them); then the Tanzil attribution, its link, and the
  pinned snapshot version.
- **`/curriculum/quran/[surahId]/memorize`** — the tools below.
- **Font.** Readex Pro does not carry the Uthmani marks. An open-licence Quran
  font (Amiri Quran, SIL OFL, is the candidate) is loaded as a JS asset through
  `expo-font`, so no native module and no `app.json` `version` bump — **to be
  confirmed in the plan**; if it needs a config plugin the version bump rule
  applies. A test checks every code point in `quran_corner.json` against the
  chosen font's character map, because a missing glyph falls back to a system
  font silently (the Lab's `Nₐ` case).

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
3. **Tanzil's terms** were read from the upstream project's README, not from
   `tanzil.net`, which cannot be opened from here. Someone with access should
   read the live terms before release.
4. **Nothing in this feature can be seen in a browser from this sandbox.** Like
   the Lab, it sits behind sign-in, so the Uthmani rendering and the RTL layout
   are verified by tests and review only until someone opens it.
