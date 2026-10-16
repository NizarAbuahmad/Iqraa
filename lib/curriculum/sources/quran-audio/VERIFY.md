# Quran Corner recitation audio — owner checklist

Hand-written. (`../quran-ws/VERIFY.md` is the generated text sheet; this is separate.)

Nothing below has been done. The recordings have not been fetched, played or
measured by anyone building this: the build sandbox cannot reach the source.
`QURAN_AUDIO_UPLOADED` in `artifacts/mobile/services/quranAudioRelease.ts` stays
`false` until every box is ticked, in the order below: upload, listen,
device checks in a development build, and only then the flip.

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
- [ ] 2:143 (`002143.mp3`) — ayah 1 of a long surah is not what is shown here; 2:143 is the first ayah the books assign
- [ ] 2:186 (`002186.mp3`) — the last ayah of a long surah: not clipped
- [ ] 112:1 (`112001.mp3`) — first ayah of a short surah: no basmalah in front
- [ ] 112:4 (`112004.mp3`) — a last ayah: not clipped
- [ ] one from each grade band the books use (ask the teacher which surahs)

## Before the flip: on a real device, in a development build, after the upload

A merge to `main` deploys the web build and publishes an over-the-air update, so
anything checked after the flip is checked in front of students. Do all of these
first. A development build already shows the listen controls (`__DEV__`), so
`QURAN_AUDIO_UPLOADED` is **never changed for this**: do not commit a flipped
constant to run a check.

- [ ] The listen button plays, a second tap stops, starting a flashcard word stops
      it, the silent switch does not mute it (iOS), offline shows the quiet error.
- [ ] A multi-ayah «استمع للمقطع» advances from ayah to ayah on iOS and on Android (the native "just finished" status event has never run on a device), including a very short ayah.
- [ ] iOS Safari (web): a multi-ayah sequence continues past the first ayah. Each next ayah starts in a new `<audio>` element outside a user gesture and may be blocked (`NotAllowedError`), which would stop the sequence with the quiet error.
- [ ] A missing file (in a development build, before the files are uploaded, or by pointing at a missing key) shows the quiet error within about 10 seconds on Android and iOS. Android reports "loaded" for a failed load, so the player relies on a timer that only a started playback cancels.
- [ ] Switching ayahs while one plays does not leave the new one "playing" forever if its file is missing (a stale status from the previous recording could cancel the timer early).
- [ ] Cosmetic: on the highlighted playing row in the reader, an unmemorised ayah's number badge and the active stop button share the row's highlight colour.

## Flip it

- [ ] Set `QURAN_AUDIO_UPLOADED = true`, merge, and glance at a real phone once.
