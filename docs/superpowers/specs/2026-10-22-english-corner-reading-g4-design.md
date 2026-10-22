# English corner: reading activities for Grade 4 — design

**Status:** proposed (awaiting review). **Scope:** Grade 4 English reading only (the 9 hub lessons,
`kbl-g4-eng-s{1,2}-nccd-u*_l1`). Builds on the Grade 2 and Grade 3 reading activities
(`2026-10-20-english-corner-reading-g2-design.md`, `2026-10-22-english-corner-reading-g3-design.md`) and the
Grade 4 grammar sentences (`2026-10-22-english-corner-grammar-g4-design.md`, PR #1171, still a draft when
this was written).

## Why

Grades 2 and 3 have word activities and, on some lessons, «Read the sentence». Grade 4 has 454 grammar
sentences and nothing yet asks a Grade 4 child to *read*. The book's objectives for this grade are the same
kind at the word level (recognising letters by their sounds), and its grammar units already hold the
sentences. Nothing new needs authoring: the design is Grade 3's, applied wherever the Grade 4 data allows it.

## Decisions taken (and why)

1. **Grade 3's design, where it fits** (chosen in conversation, 2026-10-22). The three word activities run
   unchanged on the Grade 4 words, and «Read the sentence» runs on the lessons whose grammar sentences have
   pictures. Alternatives considered: word activities only (a Grade 4 child, who reads well, would get only
   single-word tasks), and a new activity for the picture-free comparison and past-tense lessons (a new
   build with its own screens, tests and teacher review: its own spec, not this one).
2. **The sentences are the grammar sentences, not new ones**, as in Grades 2 and 3: already reviewed as
   grammar, so the form carries no new wording to check.
3. **The wrong pictures teach the small word, as before.** Where a partner exists (the same picture word,
   another count or marker), one wrong picture is the partner's; the other is another word of the same
   pattern's slot. `sentencePartner` is unchanged and shared by the app and the form.
4. **Two gates, one switch per unit for each.** The word activities need the unit's reading sign-off.
   «Read the sentence» needs that **and** the unit's grammar sign-off. `READING_UNITS` gets nine Grade 4
   rows, all `reviewedBy: null`: nobody sees any Grade 4 reading until a teacher signs the printed form.
5. **«Read the sentence» is Grades 2, 3 and 4.** `readSentencePool`'s grade test widens from `2 | 3` to
   `2 | 3 | 4`; Grade 1 stays out.
6. **A lesson offers it only with at least 6 distinct picture words** (`MIN_SENTENCE_WORDS`), a rule on the
   data, not a list. Four Grade 4 lessons qualify (table below).
7. **First sounds use the Grade 1 rule, with one new exception found while measuring.** `firstSound` /
   `firstSoundSkip` give «q» for `Qatar` and `Qatari` (S1 U1), but both are said with /k/, so a child asked
   «which letter does it start with?» would be marked wrong for the sound they hear. They join the skipped
   words under a new `SoundSkip` reason `hard-q` («Q is read /k/ here»). «quickly», «quiet» and «quietly»
   are /kw/ and stay. No Grade 1–3 word starts with «qa», so no older form changes. The rule leaves out
   **45** of the 172 words (43 by the existing rule, 2 by this one), each listed on the form with its reason.
8. **Medial and final sounds, letter-sound recordings, and reading words inside a sentence are out of
   scope**, as before.

## What the hub holds

| Lesson | Words (pictured) | Sentences | Pool for «Read the sentence» | Round |
| --- | --- | --- | --- | --- |
| S1 U1 «New Neighbours» | 20 (6) | 60 | 30, 6 picture words (the flags) | 6 |
| S1 U2 «New School» | 21 (0) | 42 | none | – |
| S1 U3 «Picnic Time!» | 20 (8) | 56 | 24, 8 picture words | 8 |
| S1 U4 «Along the River» | 20 (5) | 29 | none: its comparisons are picture-free | – |
| S1 U5 «All About Jobs» | 19 (8) | 42 | 21, 13 picture words (8 jobs, 5 clothes) | 8 |
| S2 U7 «Hobbies» | 20 (0) | 59 | none | – |
| S2 U8 «Our Town» | 20 (9) | 104 | 32, 9 picture words (the places) | 8 |
| S2 U9 «Our History» | 20 (1) | 32 | none | – |
| S2 U10 «Let's Celebrate!» | 12 (7) | 30 | none: its sentences are picture-free | – |

The pool is the unit's grammar sentences that have a picture and no Yes or No form. A round never asks one
picture word twice, so it is `min(8, distinct picture words)` questions: 6 on S1 U1 (its six flags), 8 on
the other three.

- **S1 U1:** «I'm from Spain.», «He's from Spain.» (👦), «She's from Spain.» (👧), «Where are you from? I'm
  from Spain.» and «I'm Spanish.», each against the country's flag. Every sentence has a partner; the
  nationality sentence's partner is the boy's flag sentence.
- **S1 U3:** «There's a lot of salad.», «There's a little salad.», «There isn't any salad.», «There are a
  lot of noodles.», «There aren't any noodles.» and «There's a bowl of salad.»: every pictured food has
  partners (✅ against ❌, one against two).
- **S1 U5:** «He's a doctor.» (👦) and «She's a doctor.» (👧) for the eight pictured jobs (16 partners), and
  «I'm wearing a green coat.» for the five pictured clothes (no partner).
- **S2 U8:** «There was a market.» (✅), «There wasn't a market.» (❌), «There were two markets.» (two
  pictures) and «There was an expensive clothes shop.» for the pictured places; all have partners.

## The activities, lesson by lesson

Each is a round of at most `ROUND_LENGTH` (8) questions, scored in stars, with the availability floors
already in the app (measured with `readingActivityAvailable`):

| Lesson | First letter | Read and find | Starts with | Read the sentence |
| --- | --- | --- | --- | --- |
| S1 U1 | yes | yes | yes | yes |
| S1 U2 | yes | – | – | – |
| S1 U3 | yes | yes | yes | yes |
| S1 U4 | yes | yes | yes | – |
| S1 U5 | yes | yes | yes | yes |
| S2 U7 | yes | – | – | – |
| S2 U8 | yes | yes | yes | yes |
| S2 U9 | yes | – | – | – |
| S2 U10 | yes | yes | yes | – |

Five lessons have no sentence activity (S1 U2, S1 U4, S2 U7, S2 U9, S2 U10), and three have only First
letter (S1 U2, S2 U7, S2 U9: their words have no pictures for Read and find or Starts with to choose
between). Each is printed on the form as a «غير مشمول» note, not silently dropped.

## Where it lives

- **`lib/curriculum/src/englishReading.ts`:** nine Grade 4 rows appended to `READING_UNITS` (the hub has
  no S2 U6); `readSentencePool`'s grade test widened to `2 | 3 | 4`; `SoundSkip` gains `'hard-q'` and
  `firstSoundSkip` returns it for a word starting «qa»; `READING_NOT_COVERED_G4` (the five lessons with no
  sentence activity, plus the lesson notes below). The header comments say «Grades 2 to 4».
- **`lib/curriculum/src/englishReadingReview.ts`:** `SKIP_AR['hard-q']`; `GRADE_COPY[4]` (lead, activities,
  checks, meta); `sentenceSection` for Grades 2 to 4 reading its own grade's not-covered text;
  `renderUnit`'s `grade >= 2` test unchanged in effect. The Grade 1, 2 and 3 forms stay byte-identical.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** also writes `docs/english-reading-g4-review.html`.
- **`artifacts/mobile`:** expected **no change**: `buildReadSentenceRound`, `ReadSentence`, the lesson card
  and the strings take a pool and do not care about the grade. Verified, not assumed: a mobile test on the
  four pools and a browser check.
- **STATUS.md** index line and the top of `docs/status-log.md`: a «Grade 4 reading in the English corner»
  section with the switch-on steps.

No server, schema or migration change. Progress stays on the device, keyed by lesson and activity.

## Tests

In `lib/curriculum/src/__tests__/englishReadingG4.test.ts`:

- Every Grade 4 hub lesson has a `READING_UNITS` row and every row names a real hub lesson; every Grade 4
  row ships `reviewedBy: null`; `offeredReading` and `offeredReadingSentences` are `null` for each.
- `firstSoundSkip('Qatar')` and `('Qatari')` are `'hard-q'`; `quickly`, `quiet` and `quietly` still have
  the first sound `q`; the Grade 1, 2 and 3 left-out words are unchanged (the three older forms pin that).
- The rule leaves out exactly **45** Grade 4 words (listed in the test), each with a reason.
- `readSentencePool` is non-empty for exactly S1 U1, U3, U5 and S2 U8 (30, 24, 21 and 32 sentences, with 6,
  8, 13 and 9 distinct picture words), empty for the other five and for every Grade 1 lesson; the Grade 2
  and Grade 3 pools are unchanged.
- Gates: with a Grade 4 reading row signed in a copy of the data but grammar unsigned,
  `offeredReadingSentences` is `null`; with both signed it is the pool; a Grade 1 lesson with both signed
  is `null` (sign-offs set in the test's own copies, never in the committed data).
- `sentencePartner`: every S1 U1, U3 and S2 U8 pool sentence has a partner; S1 U5 has 16 (the jobs, he ↔
  she) and its five clothes sentences have none; a partner has the same picture word and a different count
  or marker.
- The committed Grade 4 reading form equals `renderReadingReviewHtml(4)`, lists each pool sentence once,
  lists the 45 left-out words with their reasons, and has a not-covered block for the five lessons with no
  sentence activity; the Grade 1, 2 and 3 reading forms are unchanged.

In `artifacts/mobile/services/__tests__/englishReadingG4Games.test.ts` (seeded rng): at most 8 questions;
S1 U1's round is exactly 6; three distinct pictures, one right; no picture word twice in a round; the
partner is among the options whenever one exists; no Yes or No sentence is drawn; every sentence is in
`allGrammarSpoken()`; and the availability matrix above holds for all nine lessons.

The existing Grade 1, 2 and 3 reading tests must pass unchanged. The screen is checked in a browser at
390 px in Arabic and English with local sign-offs restored afterwards: the sentence stays left to right, the
three pictures fit (including S1 U1's flags with the boy and girl markers and S2 U8's doubled pictures), S1
U1's round ends after 6, S1 U4 shows Read and find and Starts with but no sentence card, an unsigned unit
shows nothing, and a unit with reading but not grammar signed shows the word cards and no sentence card.

## Open points for the teacher (printed on the form)

1. Is the two-sentence «Where are you from? I'm from Qatar.» too long to read at this point of the year, or
   should only the answer be shown? (A one-function change.)
2. Do the flag, ✅ / ❌, 👦 / 👧 and doubled pictures read clearly as «I'm from», «There isn't», «he / she»
   and «There were two»?
3. Is a round of 6 enough on S1 U1, or would the teacher rather hide the activity there?
4. Is it right to leave `Qatar` and `Qatari` out of First letter (their Q is read /k/), and do the other
   left-out words (the vowel-initial phrases such as «at the weekend» and «a bag of») belong out?

## Switching a unit on

The grammar unit is signed and its audio recorded (the pending `english-audio` run — «Read the sentence»
plays the grammar recording after the answer and adds none of its own); then a Grade 4 English teacher
signs that unit's page of `docs/english-reading-g4-review.html`, printed; then its `reviewedBy` is set in
`englishReading.ts`. The word activities need only the reading sign-off and the word recordings.

## Not done here

- A new activity for the picture-free lessons, medial and final sounds, letter-sound recordings, and
  reading words inside a sentence.
- Signing off any unit: that is the teacher's, from the printed form.
