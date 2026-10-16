# Quran Corner: recitation audio (design)

Date: 2026-10-16. Extends `2026-10-11-quran-corner-design.md`, whose "Not in this
slice" list named audio playback. This slice adds it, on purpose.

## Goal

A student who is memorising a surah from the Quran Corner can **listen to the
ayah** being learned, then hide the words and recite. The reciter is Sheikh
Mahmoud Khalil Al-Husary («محمود خليل الحصري»), *murattal*. The corner's
self-rating stays as it is: the app plays a recitation and never hears one, and
never marks anything as correct.

## Decisions already made

- **Reciter and recording:** Husary, murattal, Hafs, one MP3 per ayah. Not the
  *Muallim* (repeat-after-me) recording, not a second reciter. Either can follow
  as a second entry in the same table.
- **Hosting:** re-hosted in our own public R2 bucket, `iqraa-public`, beside
  `english-audio/` and `figures/`. The app never plays from a third-party host.
- **Scope of audio:** exactly the 585 ayahs in `quran_corner.json`, the ayahs the
  grade 1–10 lesson titles name. Not whole surahs.
- **Gated until uploaded:** a source constant keeps every listen control hidden
  until the files exist (see *Gate*).
- **No native change.** `expo-audio` is already a dependency and a config plugin
  (`artifacts/mobile/package.json`, `app.json`), and `services/englishAudio.ts`
  already plays MP3s from this bucket. So `app.json`'s `version` does not move
  (CLAUDE.md: it moves only when the native surface changes).

## What cannot be verified from where this is written

- This sandbox's proxy refuses every Quran audio host tried (EveryAyah, Quran
  Central, Islamic Network): CONNECT answers 403. **Nothing here has fetched,
  played or measured a recording.** The upload script is written, type-checked
  and unit-tested against a fake fetch; it is run by the owner, on a machine that
  can reach the source.
- **Whether each file is exactly its ayah.** The source's per-ayah files may or
  may not begin with the basmalah for ayah 1 of a surah (Al-Fatiha's ayah 1 *is*
  the basmalah). That is a property of the recordings and is not assumed. It is
  an owner check (see *Owner items*) and goes into
  `lib/curriculum/sources/quran-audio/VERIFY.md` — a separate, hand-written sheet,
  because `sources/quran-ws/VERIFY.md` is generated and says not to edit it.

## Components

### 1. URL builder: `lib/curriculum/src/quranAudio.ts` (pure)

- `QURAN_AUDIO_PREFIX = 'quran-audio/husary'` and
  `quranAudioKey(surah, ayah)` → `quran-audio/husary/SSSAAA.mp3`, three-digit
  zero-padded surah and ayah (`001001`, `114006`). One place defines the key; the
  script and the app both use it, so they cannot drift.
- `quranAudioAyahs()` → the list of `{ surah, ayah }` the corner holds, derived
  from `quran_corner.json`, never hand-listed.
- Exported as `@workspace/curriculum/quran-audio` (new subpath, named like the other
  `quran-*` ones). Also exports `QURAN_AUDIO_ORIGIN` and `quranAyahAudioUrl`.
- Validation: surah an integer 1–114, ayah an integer 1–286 (Al-Baqarah, the longest
  surah); anything else throws a `RangeError`, so a bad call fails
  in a test rather than as a 404 in a student's hand.

### 2. Upload script: `lib/curriculum/scripts/upload-quran-audio-r2.ts`

Modelled on `upload-figures-r2.ts` and `generate-english-audio.ts`:

- Lists the bucket prefix first and does only what is missing, so a run that dies
  half way costs nothing to repeat. `--dry-run` reports and touches nothing.
  `--only 2:255,112:1` redoes just those ayahs. `--force` redoes all.
- Source URL is a constant at the top of the script
  (`https://everyayah.com/data/Husary_128kbps/SSSAAA.mp3`) so a changed source is
  a one-line, reviewed edit.
- Checks each download before it is stored: HTTP 200, a `Content-Type` that is not
  `text/*`, HTML or JSON (a missing type is accepted; the MP3 check below covers
  the rest), size above a floor, and starts with an MP3 frame sync or an `ID3`
  tag. A failure is reported by ayah and never uploaded; the run exits non-zero.
- Stops at the first auth refusal from R2, as the English-audio script does.
- Writes `lib/curriculum/sources/quran-audio/MANIFEST.json`: ayah, bytes, SHA-256,
  source URL, fetched-at. It is committed after the run, so what is in the bucket
  is auditable and a later change is visible in a diff.
- Needs `R2_*` credentials with write access to `iqraa-public` (already in `.env`
  for the other scripts).
- Run: `pnpm --filter @workspace/curriculum run quran-audio [-- --dry-run | --force | --only a:b,...]`.

### 3. Playback: `artifacts/mobile/services/quranAudio.ts`

- **Native:** one `expo-audio` player, reused, `playsInSilentMode: true` (a
  student with the iOS silent switch on must still hear it; same reason as
  `englishAudio.ts`). **Web:** its own `<audio>` element, because `expo-audio`'s
  web player cannot report a failed load.
- API: `playAyah(surah, ayah)`, `playSequence(items, { repeat })`, `stop()`, and a
  subscription for `{ playing: { surah, ayah } | null, error: boolean }` so the
  screens can highlight the current ayah and show one quiet "couldn't play" line.
- **Never rejects**, like `playWord`; a failure becomes the `error` state, not an
  exception and not a banner over the text.
- **One audio at a time.** A tiny pure registry, `services/audioExclusive.ts`
  (no `react-native` import): each audio module registers a `stop` callback under
  a name, and `claim(name)` runs every *other* module's `stop`. `quranAudio.ts`
  claims before it plays; `englishAudio.ts` (`playWord`, `playUri`,
  `playLocalUri`) gets one added `claim('word')` line. That keeps the rule in
  `playLocalUri`'s comment (hearing two things at once is never useful) without
  a second import cycle between the two files, and the registry is unit-tested.
  Quran audio keeps its own player rather than sharing `englishAudio`'s, so a
  failed Quran load cannot disturb the word player.
- **Sequencing is a pure function** in `services/quranPlaylist.ts` (no
  `react-native` import, so it runs under `services/__tests__`): given the ayah
  list and `repeat`, it returns the ordered play queue and the "what plays next"
  step. It is a small reducer (`startPlaylist`, `advancePlaylist`, `currentOf`)
  whose idle state also makes a late "finished" event after Stop a no-op. The player
  calls it; it is the part with real logic and it is the part that is tested.
- Playing from the bucket needs the network. There is no download or cache in
  this slice (see *Not in this slice*). A student offline gets the same quiet
  "couldn't play" line; reading and hiding still work.

### 4. Screens

- **Reader** (`app/curriculum/quran/[surahId]/index.tsx`): a ▶ control on each
  ayah row, a «استمع» control for the lesson's whole range, and the ayah being
  played is highlighted. A control is a ≥44px target with an accessibility label.
- **Memorise** (`.../memorize.tsx`): in ayah-by-ayah mode a «استمع» control beside
  the current ayah. It plays that ayah once; the existing repeat counter is
  unchanged and still counts the learner's own recitations, not plays. Audio is
  never autoplayed. A student who opens the screen in a quiet room gets silence
  until they ask.
- **Credit line** under the controls on both screens, from the i18n table:
  «التلاوة بصوت الشيخ محمود خليل الحصري (ترتيل).» Not a link.
- The Library card, the gate screen and the three routes are untouched.
- The learner's rating buttons («حفظتها» / «أحتاج مراجعة») are untouched, and
  playing audio does not set progress.

### 5. Gate

`artifacts/mobile/services/quranAudioRelease.ts`:

```ts
export const QURAN_AUDIO_UPLOADED = false;
export function quranAudioVisible(uploaded: boolean, dev: boolean): boolean {
  return uploaded || dev;
}
```

The constant starts `false`; the checklist for flipping it is `sources/quran-audio/VERIFY.md`.

The same shape as `QURAN_CORNER_RELEASED`: a source constant, **not** an
`EXPO_PUBLIC_*` variable (those need declaring in three places, CLAUDE.md), and
`__DEV__` always shows it so the owner can test before flipping. With the gate
shut no listen control renders, so a student never sees a button that plays
nothing. The owner flips it after the upload and the spot-check.

### 6. i18n

New keys beside the `quran*` ones, Arabic and English: listen, listen to the
range, stop, credit line, "couldn't play" (with a plain reason: needs internet).
Our own interface text, reviewed with the `arabic-copy-reviewer` skill as the
first set was.

## Verification

- `quranAudio.test.ts` (lib/curriculum): every one of the 585 ayahs in
  `quran_corner.json` yields a key that matches `^quran-audio/husary/\d{6}\.mp3$`;
  keys are unique; the count equals the corner's ayah count; out-of-range input
  throws; padding is exact (`001001`, `002255`, `114006`).
- Upload-script tests (against an injected fake fetch and a fake bucket): skips
  what exists, rejects a non-MP3 body, rejects a too-small body, never uploads a
  rejected file, `--dry-run` fetches and writes nothing, `--only` touches exactly
  that set, the manifest is persisted after each upload. Exit codes live in the
  CLI wiring, which is not unit-tested: they are verified only by the manual runs
  with R2 unconfigured and with an unreadable manifest.
- `quranPlaylist.test.ts` (mobile services): order, repeat counts, a range that
  spans one ayah, the empty range, and "stop" mid-queue.
- `quranAudioRelease.test.ts`: the three combinations, and that the constant is a
  boolean (not its value: pinning `false` would turn the owner's one-line flip into
  a two-file change, and `quranRelease.test.ts` does not pin its value either).
- `audioExclusive.test.ts`: claiming stops the others and never the claimant;
  an unregistered name is ignored; a stop that throws does not block the rest.
- The app and the script both import `quranAudioKey` from `lib/curriculum`; neither
  builds a key itself. The script test asserts the key it uploads under is the one
  the builder returns.
- Mobile and `lib/curriculum` suites and the whole-monorepo `pnpm run typecheck`.
  The TS7006 errors in three `artifacts/api-server` DB test files
  (`familyHomework`, `paperTotals`, `resultsPush`) predate this slice and are not
  touched.
- **Not verifiable in this environment:** actual playback in a browser or on a
  device, and the recordings themselves. `STATUS.md` says so, in the same PR.
- `STATUS.md` gets a bullet under the Quran section; `docs/adding-a-book.md` is not
  touched (this is not a book).

## Not in this slice

*Muallim* or a second reciter; word-by-word highlighting or timing; offline
download or caching; speech checking of the learner's own recitation; a reciter
picker; autoplay; playback speed control; background or lock-screen playback;
audio for ayahs outside the 585.

## Owner items (not code)

1. **Licence for re-hosting.** Whether copying these recordings into our own
   bucket, inside a paid product, is permitted by the terms of the source and of
   the recording's rights holders. This is the same kind of question as the font's
   "cannot be Sold, Modified, Altered" clause and is not answered here. The design
   keeps it cheap to reverse: the audio is one prefix in one bucket and one gate
   constant.
2. **Run the upload script** on a machine that can reach the source, commit the
   manifest it writes.
3. **Spot-check boundaries.** Listen to a sample (suggest ayah 1 of Al-Fatiha,
   Al-Baqarah, Al-Ikhlas, and the last ayah of a long surah) against the printed
   text: right ayah, no basmalah spliced in or out, no clipped ending. A reciter
   or teacher should do this, not the build.
4. **Run the device checks in a development build first** (it shows the controls
   without changing the constant; a merge to `main` ships to students), then flip
   `QURAN_AUDIO_UPLOADED` to `true`, merge, and look at it once on a phone.
5. **Jordan approval** covers audio of the Quran as much as its text; the open
   item in the first spec applies to this slice too.
