# English corner: reading activities for Grade 2 — design

**Status:** design approved in conversation (2026-10-20), awaiting review of
this written spec. **Scope:** Grade 2 English reading only (the 9 hub lessons,
`kbl-g2-eng-s{1,2}-nccd-u*_l1`). Builds on the Grade 1 reading activities
(`2026-10-17-english-corner-reading-g1-design.md`, PR #1120) and the Grade 2
grammar sentences (`2026-10-19-english-corner-grammar-g2-design.md`,
PR #1158).

## Why

The corner has Grade 1 reading (three word-level activities) and, as of the
Grade 2 grammar work, 212 Grade 2 sentences with pictures. Nothing yet asks a
Grade 2 child to *read*. The Grade 2 book's own objectives are the same as
Grade 1's at the word level — «recognising the letters of the alphabet by their
sounds» in S1 U1–U4 and S2 U5–U8 — and add «understanding basic phrases in
short, simple texts» (S1 U3, U4, S2 U5). The Reading column of the book's scope
and sequence was never extracted (as for Grade 1), so this follows those
Listening/Speaking objectives and nothing else.

## Decisions taken (and why)

1. **Words plus sentences** (chosen in conversation, 2026-10-20). The three
   Grade 1 activities run unchanged on the Grade 2 words, and one new activity
   asks the child to read a printed sentence. Alternatives considered: the
   Grade 1 three only (a Grade 2 child would get the same single-word task as
   Grade 1), and sentences only (ignores the book's letters-by-sounds
   objective).
2. **The sentences are the grammar sentences, not new ones.** Nothing new to
   author, record, or put on a teacher's form for wording; the sentences were
   reviewed as grammar. Writing new sentences (approach B) was rejected: more
   content, more sign-off, and nothing in the book says which sentences a Grade
   2 child should read. Revisit only if the grammar sentences prove too long
   to read.
3. **The wrong pictures teach the small word.** Many grammar sentences come in
   pairs that differ by one word. Where a partner exists, one wrong picture is
   the partner's, so the child must read the small word:

   | Lesson | Right picture | Partner shown as a wrong picture | Sentences with a partner |
   | --- | --- | --- | --- |
   | S1 U2 «This is / These are» | 1 pencil | 2 pencils | 14 of 15 (`scissors` has no singular) |
   | S1 U4 «He's got / She's got» | blue + 👦 | blue + 👧 | 6 of 10 |
   | S2 U5 «What's this? / What are these?» | 1 mouse | 2 mice | 20 of 20 |
   | S2 U6 «I like / I don't like» | cheese ✅ | cheese ❌ | 28 of 28 |

   The other wrong picture is another word of the same pattern's slot. In S1
   U0, U1 and S2 U7 there are no pairs, so both wrong pictures are other words
   of the slot.
4. **Two gates, one switch per unit for each.** The word activities need the
   unit's reading sign-off. «Read the sentence» needs that **and** the unit's
   grammar sign-off, so a child never reads a sentence a teacher has not
   checked. `READING_UNITS` gets nine Grade 2 rows, all `reviewedBy: null`:
   nobody sees any Grade 2 reading until a teacher signs the printed form.
5. **«Read the sentence» is Grade 2 only.** Grade 1 lessons also have grammar
   units, so without a grade check the activity would appear on Grade 1
   lessons the day both of their switches are set. Grade 1 is not touched.
6. **A lesson offers it only with at least 6 distinct picture words.** This
   leaves out S1 U3 (body parts: no grammar unit, so no sentences) and S2 U8
   (rooms: 16 sentences, but the picture is only the room, and the sentences
   differ by the person; 4 distinct pictures). It is a rule on the data, not a
   hand-kept list. Seven lessons qualify.
7. **First sounds use the Grade 1 rule unchanged.** `firstSound` /
   `firstSoundSkip` and `SOFT_G` apply to the Grade 2 words. No Grade 2 word
   needs a new exception (checked: no soft c or soft g among them; `garage`
   is hard in both British readings). The rule leaves out 22 distinct
   words (23 entries: `orange` is in two lessons), e.g. `apple`, `chicken`,
   `shoes`, `short`; they still appear in Read and find
   when they have a picture, and the form lists them with the reason.
8. **Medial and final sounds, letter-sound recordings, and reading words
   inside a sentence are out of scope**, as before.

## The four activities

Each is a round of at most `ROUND_LENGTH` (8) questions, scored in stars like
the others, and listed in `SCORED_ACTIVITIES`.

**Read and find, First letter, Starts with** (`read-find`, `first-letter`,
`starts-with`): exactly as in the Grade 1 spec, on the Grade 2 word lists. All
9 lessons pass the existing availability floors (measured with
`readingActivityAvailable`).

### Read the sentence — `read-sentence`

The sentence is printed large with **no sound**, e.g. «What's this? It's a
mouse.», above three pictures; tap the one it names. After the answer, right or
wrong, the right picture is marked and the sentence's recording plays
(`playWord(sentence.text)`, the recording the grammar activities use).

- **Pool:** the unit's grammar sentences that have a picture and no `yesNo`
  (Yes or No sentences have their own activity). Measured: S1 U0 16, U1 12, U2
  15, U4 10, S2 U5 20, U6 28, U7 11.
- **Question picking:** no picture word is asked twice in a round, so the
  round is at most the number of distinct words: 8 for S1 U2 (15 sentences,
  8 words), 7 for S1 U4 (10 sentences, 7 words), 8 for the rest.
- **Options:** the right picture; the partner's picture when one exists
  (decision 3); other words of the same pattern's slot, never the answer's
  word, until there are three. The smallest same-pattern pool today is 3 words
  (S1 U4's eye colours), which still leaves two wrong pictures after the
  partner.
- **Shared with the form:** the partner rule is one function in
  `lib/curriculum`, used by the app's round builder and by the teacher's form,
  so the form shows exactly what the app will do.

## Where it lives

- **`lib/curriculum/src/englishReading.ts`:** nine Grade 2 rows appended to
  `READING_UNITS`; `readSentencePool(lessonId)` (the eligible sentences, or an
  empty list when the lesson is not Grade 2 or has fewer than 6 distinct
  picture words); `sentencePartner(sentence, pool)` (the partner, or null);
  `offeredReadingSentences(lessonId)` (the pool once both the reading unit and
  `offeredGrammar` are signed, else `null`). Imports `englishGrammar.ts`; the
  grammar engine does not import reading, so there is no cycle.
- **`lib/curriculum/src/englishReadingReview.ts`:**
  `renderReadingReviewHtml(grade = 1)` with per-grade copy, as the grammar form
  has. The Grade 1 output stays byte-identical. The Grade 2 form has, per unit:
  the words with picture and first letter, the left-out words with the reason,
  and a sentence table (sentence, picture, its partner picture or «أيّ كلمة
  أخرى من القائمة»); and, per lesson that has no sentence activity, a «غير
  مشمول، ولماذا» block (S1 U3, S2 U8), plus the Yes or No sentences, the two
  toys with no picture, and medial and final sounds.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** also writes
  `docs/english-reading-g2-review.html`. A test pins it to the generator.
- **`artifacts/mobile/services/englishHub/games.ts`:** `'read-sentence'` in
  `HubActivity` and `SCORED_ACTIVITIES`; `buildReadSentenceRound(pool, rng)`;
  `readSentenceAvailable(pool)` (≥ 6 distinct picture words). It is not in
  `READING_ACTIVITIES`, whose entries are filtered by the lesson's words; the
  lesson screen adds it from `offeredReadingSentences`.
- **`artifacts/mobile/components/englishHub/ReadingActivities.tsx`:** the
  `ReadSentence` screen, built like Read and find (no sound until the answer),
  reusing `HearButton`, `Progress`, `RIGHT`/`WRONG` and the feedback line.
- **`app/curriculum/english/[lessonId].tsx`:** one more card under «القراءة»
  and its route; `services/i18n.ts`: title, description and prompt, Arabic and
  English.
- **STATUS.md:** a «Grade 2 reading in the English corner» section with the
  switch-on steps.

No server, schema or migration change. Progress stays on the device, keyed by
lesson and activity like the rest.

## Tests

In `lib/curriculum/src/__tests__/englishReadingG2.test.ts`:

- Every Grade 2 hub lesson has a `READING_UNITS` row and every row names a
  real hub lesson; every Grade 2 row ships `reviewedBy: null`;
  `offeredReading` and `offeredReadingSentences` are `null` for each.
- `readSentencePool` is non-empty for exactly the 7 lessons (S1 U0, U1, U2,
  U4, S2 U5, U6, U7), empty for S1 U3 and S2 U8 and for every Grade 1 lesson.
- Gates: with a Grade 2 reading row signed in a copy of the data but grammar
  unsigned, `offeredReadingSentences` is `null`; with both signed it is the
  pool; a Grade 1 lesson with both signed is `null`. (Sign-offs are set in
  the test's own copies, never in the committed data.)
- `sentencePartner`: the partner counts match the table in decision 3 (14, 6,
  20, 28), a partner always has the same picture word and a different count or
  marker, and no sentence in S1 U0, U1, S2 U7 has one.
- The committed Grade 2 reading form equals `renderReadingReviewHtml(2)`, lists
  each pool sentence once, and has a not-covered block for S1 U3 and S2 U8;
  the Grade 1 reading form is unchanged.

In `artifacts/mobile/services/__tests__/englishReadingG2Games.test.ts` (seeded
rng, every eligible lesson): at most 8 questions, three distinct pictures, one
right; no picture word twice in a round; the partner is among the options
whenever one exists; no Yes or No sentence is drawn; the answer is always the
sentence's own picture; every sentence is in `allGrammarSpoken()` (so it has a
recording); the availability floor holds on every eligible lesson and fails
one word short; stars for it count toward the lesson.

The existing Grade 1 reading tests must pass unchanged. The screen is checked
in a browser at 390 px in Arabic and English, with two units signed off in the
working tree only and the file restored immediately: the sentence stays left
to right, the longest sentence («What's the weather like? It's stormy.», 37
characters) wraps cleanly, the three pictures fit, an unsigned unit shows
nothing, and a unit with reading but not grammar signed shows the three word
activities and no sentence card.

## Open points for the teacher (printed on the form)

1. Is a two-sentence exchange («What colour is it? It's blue.») too much for a
   Grade 2 child to read at this point of the year, or should only the answer
   sentence be shown? (A one-function change.)
2. Do ✅/❌ and one-versus-two pictures read clearly as «don't» and «these
   are»?
3. The same picture questions the grammar form already carries: the pink
   heart, the 🟠 for orange, the eye-colour circle.

## Switching a unit on

The grammar unit is signed and its audio recorded (the pending `english-audio`
run — «Read the sentence» plays the sentence recording after the answer and
adds none of its own); then a Grade 2 English teacher signs that unit's page of
`docs/english-reading-g2-review.html`, printed; then its `reviewedBy` is set in
`englishReading.ts`. The word activities need only the reading sign-off and
the existing word recordings.

## Not done here

- Grades 3–4 reading.
- Medial and final sounds; letter-sound recordings; reading words inside a
  sentence.
- Rooms (S2 U8) and body parts (S1 U3) sentences.
- Signing off any unit: that is the teacher's, from the printed form.
