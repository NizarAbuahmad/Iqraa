# English corner: reading activities for Grade 3 — design

**Status:** implemented (PR #1171). **Scope:** Grade 3 English reading only (the 8 hub lessons,
`kbl-g3-eng-s{1,2}-nccd-u*_l1`). Builds on the Grade 2 reading activities
(`2026-10-20-english-corner-reading-g2-design.md`, PR #1158) and the Grade 3 grammar sentences
(`2026-10-21-english-corner-grammar-g3-design.md`, PR #1171, still a draft when this was written).

## Why

Grade 2 children can read words and, in seven lessons, a printed sentence. Grade 3 has 324 grammar
sentences, 66 of them pictured, and nothing yet asks a Grade 3 child to *read*.
The Grade 3 book's objectives are the same kind as Grade 2's at the word level (recognising letters by
their sounds), and its grammar units already hold the sentences. Nothing new needs authoring: the
design is Grade 2's, applied wherever the Grade 3 data allows it.

## Decisions taken (and why)

1. **Grade 2's design, where it fits** (chosen in conversation, 2026-10-22). The three word
   activities run unchanged on the Grade 3 words, and «Read the sentence» runs on the lessons whose
   grammar sentences have pictures. Alternatives considered: word activities only (leaves the 3
   pictured grammar units with no sentence reading), and new reading-only sentences (more content, more
   sign-off, nothing in the book says which sentences a Grade 3 child should read).
2. **The sentences are the grammar sentences, not new ones.** Same reasoning as Grade 2: they were
   reviewed as grammar, so the form carries no new wording to check.
3. **«Read the sentence» is offered by the same rule as in Grade 2, widened to two grades.** The
   rule is on the data, not a list: the lesson's grammar sentences with a picture and no Yes or No
   form at least 6 distinct picture words (`MIN_SENTENCE_WORDS`). The grade check changes from
   `=== 2` to Grades 2 and 3; Grade 1 stays excluded (its lessons also have grammar units, and
   Grade 1 reading was designed without sentences). Measured on the Grade 3 data:

   | Lesson | Sentences | With picture, not Yes/No | Distinct picture words | Round | Partner pairs |
   | --- | --- | --- | --- | --- | --- |
   | S1 U2 «It's a happy day!» | 40 | 0 | 0 | none | – |
   | S1 U3 «Let's dress up!» | 34 | 26 | 12 | 8 | 0 |
   | S1 U4 «The activity centre» | 52 | 0 | 0 | none | – |
   | S1 U5 «I want to be a teacher!» | 22 | 22 | 16 | 8 | 12 (he / she, the six transport sentences each way) |
   | S2 U7 «Fun on the farm» | 24 | 0 | 0 | none | – |
   | S2 U8 «Out in the forest» | 54 | 0 | 0 | none | – |
   | S2 U9 «Look at the stars» | 60 | 18 (12 Yes/No left out) | 6 | 6 | 18 (three forms per word: There's ✅, There isn't ❌, There are 🚪🚪) |
   | S2 U10 «Animals are fun!» | 38 | 0 (34 Yes/No, 4 no picture) | 0 | none | – |

   So three lessons offer it: S1 U3, S1 U5, S2 U9.
4. **The wrong pictures teach the small word, as in Grade 2.** Where a partner exists, one wrong
   picture is the partner's (S1 U5: «He goes to work by bus» is shown against the girl's bus; S2 U9
   has three forms of each word, so «There's a door» is shown against «There isn't»'s ❌, «There isn't a
   door» against the ✅, and «There are doors» against the single ✅ door). The other wrong picture is another word of the same
   pattern's slot. The partner rule is `sentencePartner`, unchanged, used by the app and the form.
   S1 U3 has no pairs (its sentences differ by the item, not a marker), so both wrong pictures are other
   words. S1 U5's job sentences («I want to be a teacher») have none either.
5. **A round never asks one word twice**, so S2 U9 is a round of 6 (its six words), not 8. The
   Yes/No sentences of S2 U9 keep their own activity in the grammar tab and do not appear here.
6. **Same two gates per unit.** The word activities need the unit's reading sign-off.
   «Read the sentence» needs that **and** the unit's grammar sign-off. `READING_UNITS` gets eight
   Grade 3 rows, all `reviewedBy: null`: nobody sees any Grade 3 reading until a teacher signs the
   printed form.
7. **First sounds use the Grade 1 rule unchanged.** `firstSound` / `firstSoundSkip` / `SOFT_G`
   apply to the Grade 3 words. No new exception: `giraffe` is already in `SOFT_G`, and nothing else is
   soft c or soft g. The rule leaves out 20 words, listed on the form with the reason: `afternoon`,
   `evening` (S1 U2); `shirt`, `phone` (S1 U3); `Thursday` (S1 U4); `astronaut`, `chef`, `artist`,
   `underground` (S1 U5); `chicken`, `sheep` (S2 U7); `old`, `shampoo` (S2 U8); `armchair`,
   `in front of`, `opposite` (S2 U9); `giraffe`, `elephant`, `eagle`, `ice lolly` (S2 U10).
8. **Medial and final sounds, letter-sound recordings, and reading words inside a sentence are out
   of scope**, as before.

## The activities, lesson by lesson

Each is a round of at most `ROUND_LENGTH` (8) questions, scored in stars, with the availability
floors already in the app (measured with `readingActivityAvailable`):

| Lesson | First letter | Read and find | Starts with | Read the sentence |
| --- | --- | --- | --- | --- |
| S1 U2 | yes | – | – | – |
| S1 U3 | yes | yes | yes | yes |
| S1 U4 | yes | – | – | – |
| S1 U5 | yes | yes | yes | yes |
| S2 U7 | yes | yes | yes | – |
| S2 U8 | yes | – | – | – |
| S2 U9 | yes | yes | yes | yes |
| S2 U10 | yes | yes | yes | – |

The three lessons with only First letter (S1 U2, S1 U4, S2 U8) have no pictures for their words, which
is what Read and find and Starts with ask the child to choose between. That is the cost of the
honest-pictures rule the Grade 3 grammar work set; it is printed on the form as a «غير مشمول» block, not
silently dropped.

## Where it lives

- **`lib/curriculum/src/englishReading.ts`:** eight Grade 3 rows appended to `READING_UNITS`
  (the hub has no S1 U0/U1 or S2 U5/U6 for Grade 3); `readSentencePool`'s grade test widened from
  `=== 2` to `2 | 3`; `READING_NOT_COVERED_G3` (seven lessons: the picture-free ones, S1 U3's unpictured sentences,
  S2 U9's Yes/No sentences, S2 U10's reason). The header comment and `offeredReadingSentences`'s doc say "Grade 2 or 3".
- **`lib/curriculum/src/englishReadingReview.ts`:** `GRADE_COPY[3]` (lead, the four activities,
  the checks, meta); `sentenceSection` is called for Grades 2 and 3 and reads the not-covered text of
  its own grade; the Grade 1 and Grade 2 forms stay byte-identical.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** also writes `docs/english-reading-g3-review.html`.
- **`artifacts/mobile`:** expected **no change**. `buildReadSentenceRound`, `ReadSentence`, the
  lesson card and the i18n strings take a pool and do not care about the grade. This is verified, not
  assumed: the plan includes the round builder test on the three Grade 3 pools and a browser check.
- **STATUS.md** index line and the top of `docs/status-log.md`: a «Grade 3 reading in the English
  corner» section with the switch-on steps.

No server, schema or migration change. Progress stays on the device, keyed by lesson and activity.

## Tests

In `lib/curriculum/src/__tests__/englishReadingG3.test.ts`:

- Every Grade 3 hub lesson has a `READING_UNITS` row and every row names a real hub lesson; every
  Grade 3 row ships `reviewedBy: null`; `offeredReading` and `offeredReadingSentences` are `null`.
- `readSentencePool` is non-empty for exactly S1 U3, U5 and S2 U9 (26, 22 and 18 sentences) and empty for
  the other five and for every Grade 1 lesson; Grade 2's seven pools are unchanged.
- Gates: reading signed but grammar unsigned → no sentences; both signed → the pool; a Grade 1 lesson
  with both signed → `null` (sign-offs set in the test's own copies only).
- `sentencePartner`: 12 partners in S1 U5 (all and only the transport sentences, he ↔ she), 18 in
  S2 U9 (six words × There's, There isn't, There are; the first other form is the partner), none in S1 U3; a partner has the same picture word and a different picture.
- The 20 left-out words are exactly those in decision 7, and `firstSoundSkip` gives a reason for each.
- The committed Grade 3 reading form equals `renderReadingReviewHtml(3)`, lists each pool sentence
  once, and has a not-covered block for the seven lessons with a gap (the five without a sentence activity,
  plus S1 U3 and S2 U9, whose pools leave some sentences out); the Grade 1 and 2 reading forms are unchanged.

In `artifacts/mobile/services/__tests__/englishReadingG3Games.test.ts` (seeded rng): at most 8 questions;
S2 U9's round is exactly 6; three distinct pictures, one right; no picture word twice in a round; the
partner is among the options whenever one exists; no Yes/No sentence is drawn; every sentence is in
`allGrammarSpoken()`; the availability matrix above holds for all 8 lessons.

The existing Grade 1 and Grade 2 reading tests must pass unchanged. The screen is checked in a
browser at 390 px in Arabic and English with local sign-offs restored afterwards: the sentence stays
left to right, the three pictures fit (including S1 U5's partner cards and its two-word answer «police officer»),
the S2 U9 round ends after 6, and an unsigned unit shows nothing.

## Open points for the teacher (printed on the form)

1. Are the 20 left-out words right to leave out of «First letter» (and does anything left in sound
   wrong — e.g. `ice lolly` is out as a vowel, `shirt` and `phone` as digraphs)?
2. Do the ✅/❌ pictures of S2 U9 and the boy/girl pairs of S1 U5 read clearly as «There isn't» and
   «she», and does the doubled picture read as «There are»?
3. Is a six-question round on S2 U9 enough, or would the teacher rather have the activity hidden
   there?
4. The same picture questions the Grade 3 grammar form already carries.

## Switching a unit on

The grammar unit is signed and its audio recorded (the pending `english-audio` run — «Read the
sentence» plays the sentence's grammar recording after the answer and adds none of its own); then a
Grade 3 English teacher signs that unit's page of `docs/english-reading-g3-review.html`, printed; then
its `reviewedBy` is set in `englishReading.ts`. The word activities need only the reading sign-off and
the word recordings.

## Not done here

- Grade 4 reading, and any Grade 3 sentences for the five lessons without pictured grammar.
- Medial and final sounds; letter-sound recordings; reading words inside a sentence.
- Signing off any unit: that is the teacher's, from the printed form.
