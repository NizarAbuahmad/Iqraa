# English corner: reading activities for Grade 1 — design

**Status:** implemented (PR #1120). **Scope:** Grade 1 English
only, both semesters (the 10 hub lessons, `kbl-g1-eng-s{1,2}-nccd-u*_l1`).

## Why

The Grade 1 English teacher who asked for grammar practice (2026-10-15) also
asked for reading. The corner now has seven vocabulary activities and three
grammar ones (`services/englishHub/games.ts`); none asks a child to *read*:
every word on screen is either spoken first or tapped to be heard.

The book's own target is phonics. The Listening objectives in
`lib/curriculum/src/data/iqra_curriculum_g1_english_sem{1,2}.json` say
"hearing the initial sound in simple words" for S1 U1, U2, U5–U7, and
"initial, medial and final sound" for S1 U4 and S2 U8. The book's Reading
column (scope and sequence, pp. 4–5) was never extracted, and the PDF cannot
be fetched from where this was written, so the design uses only what the
data already holds.

## Decisions taken (and why)

1. **"Reading" means the lesson's own words and their first sounds** (chosen
   in conversation, 2026-10-17). No new vocabulary, no sentences (grammar has
   those), no stories.
2. **No new content to author or record.** Every item is a word the lesson
   already drills, its existing emoji (`wordPicture`) and its existing
   recording (`playWord`). No new audio: an isolated letter sound from a TTS
   voice («buh») is worse than none, so a letter is only ever *shown*.
3. **A word's first sound comes from a rule plus a short exception list, and
   a teacher signs off the result.** The rule alone is wrong: «girl» and
   «giraffe» are both g + i, one hard and one soft. So:
   - first letter, lower-cased, is the word's first sound, except
   - a word starting with a vowel letter is left out (apples /æ/, arms /ɑː/,
     eraser /ɪ/, eight /eɪ/, one /w/, orange /ɒ/: a vowel letter has too
     many sounds for a Grade 1 "starts with" question),
   - a word starting with `ch`, `sh`, `th`, `ph`, `kn` or `wr` is left out
     (the first letter is not the first sound),
   - `c` before `e`/`i`/`y` is left out (soft c; no Grade 1 word today),
   - and `SOFT_G` lists the soft-g words by hand: `giraffe`. A `g` word not on
     it is hard.
   Measured over the 10 lessons, this leaves out one, three, eight, orange,
   eraser (×2), chair, arms, giraffe, apples; every other word keeps its first
   letter.
4. **Hidden until a teacher has reviewed it — one switch per unit, as with
   grammar.** `READING_UNITS` holds one record per lesson with
   `reviewedBy: null`; the «القراءة» section is offered to nobody until it is
   set. Read and find claims nothing new, but one switch per unit is one
   thing for the teacher to sign and one thing for the code to check.
5. **Medial and final sounds are out of scope.** Two units ask for them; the
   same rule does not extend (the final sound of «cakes» is /s/, of «juice»
   /s/ with a silent e). Later, if the teacher wants it.
6. **Approaches considered.** (A) rule + exception list + sign-off — chosen;
   (B) a hand-written first sound for each of the ~100 words — the same table
   with more ways to make a typo, and nothing tells the next word's author to
   add a row; (C) rule only, ungated — ships «girl starts with a soft g» or
   the reverse to six-year-olds, with no one having looked.

## The three activities

Each is a round of `ROUND_LENGTH` (8) questions drawn with `sample`, scored in
stars like the others, and listed in `SCORED_ACTIVITIES`.

### Read and find — `read-find`

The word is printed, large, with **no sound**. Three pictures; tap the one it
names. After the answer, the word's recording plays (right or wrong), so the
child hears what they read.

- Pool: the lesson's picturable words. Distractors: two other picturable words
  of the lesson, never the same picture.
- Offered when the lesson has at least 4 picturable words (the existing
  `lessonHasPictureMatch` floor). All 10 lessons do (S2 U5 has exactly 4).
- Different from Picture match: there, tapping a word card plays it, so the
  child can match by ear; here nothing is heard until the choice is made.

### First letter — `first-letter`

The word's picture (if it has one) and a «hear it» button; the word plays once
on arrival. Three lower-case letters; tap the one the word starts with. The
printed word is never shown — it would give the answer away.

- Pool: the lesson's words that have a first sound (decision 3), pictured or
  not.
- Distractor letters: other first letters in the lesson first, then padded
  from `b d f h l m n p r s t`. Never `b` beside `d`, or `p` beside `q`: that
  tests telling shapes apart, not hearing sounds.
- Offered when the lesson has at least 4 words with a first sound.

### Starts with — `starts-with`

A letter, large («m»), and three pictures with no words under them: which one
starts with this sound? The instruction says «أيّ صورة تبدأ بصوت هذا الحرف؟».
After the answer, the right picture's word plays.

- Pool: picturable words with a first sound. Exactly one option starts with the
  shown letter; the other two start with different letters from each other's
  and the answer's.
- Offered when those words cover at least 3 different first letters. Today all
  10 lessons do (S2 U5 just: feet, hands, legs).

## Where it lives

- **`lib/curriculum/src/englishReading.ts`** (new, free of react-native):
  `firstSound(word): string | null`, `SOFT_G`, `READING_UNITS`
  (`{ lessonId, reviewedBy }[]`, all `null`), `readingUnit(lessonId)`,
  `offeredReading(lessonId): HubWord[] | null` (the lesson's words, or `null`
  when unreviewed or not a Grade 1 hub lesson), and
  `renderReadingReviewHtml()`.
- **`artifacts/mobile/services/englishHub/games.ts`**: `'read-find' |
  'first-letter' | 'starts-with'` added to `HubActivity`; `READING_ACTIVITIES`;
  `buildReadFindRound`, `buildFirstLetterRound`, `buildStartsWithRound`;
  `readingActivityAvailable(activity, words)`; the three added to
  `SCORED_ACTIVITIES`.
- **`artifacts/mobile/components/englishHub/ReadingActivities.tsx`** (new):
  the three screens, reusing `HearButton`, `Progress`, `RIGHT`/`WRONG` and the
  grammar screens' feedback line.
- **`app/curriculum/english/[lessonId].tsx`**: a «القراءة» section, between
  the vocabulary cards and «القواعد», shown only when `offeredReading` returns
  words and at least one reading activity is available.
- **`services/i18n.ts`**: titles, descriptions and prompts in Arabic and
  English.
- **Teacher's form**: `lib/curriculum/scripts/grammar-sheet.ts` also writes
  `docs/english-reading-g1-review.html` — per unit, every word with its
  picture and the letter the app will call its first sound, the left-out words
  with the reason («يبدأ بحرف علّة», «ch», «g ليّنة»), and a signature line.
  A test pins the committed file to `renderReadingReviewHtml()`, so a
  signature refers to what ships.
- **STATUS.md**: a «Grade 1 reading in the English corner» section, and the
  sign-off step added to the existing checklist.

No server, schema, audio or migration change. Progress stays on the device
(`progressStore.ts`), keyed by lesson and activity like the rest.

## Tests

In `lib/curriculum/src/__tests__/englishReading.test.ts`:

- `firstSound` on the cases above: girl → g, giraffe → null, chair → null,
  three → null, apples → null, T-shirt → t, pencil case → p, yoyo → y.
- Every Grade 1 hub lesson has a `READING_UNITS` record, and every record
  names a real Grade 1 hub lesson.
- Every record ships `reviewedBy: null`; `offeredReading` is `null` for each.
- The committed review form equals `renderReadingReviewHtml()`.

In `artifacts/mobile/services/__tests__/englishReadingGames.test.ts` (seeded
rng, every Grade 1 lesson):

- Read and find: the answer is the printed word's picture; three distinct
  pictures; no word without a picture is ever asked.
- First letter: the answer is `firstSound(word)`; three distinct letters; no
  left-out word is ever asked; never b with d or p with q.
- Starts with: exactly one option has the shown first sound; no two options
  share a first letter; no unpictured word appears.
- Availability: all three are available on all 10 lessons today, and each is
  unavailable on a word list one short of its floor.

The screen itself is checked in a browser (RTL page, LTR letters and words),
the way the grammar screens were.

## Not done here

- Medial and final sounds (decision 5).
- Letter-sound recordings.
- Grades 2–4, whose reading is sentences and short texts.
- Signing off any unit: that is the teacher's, from the printed form.
