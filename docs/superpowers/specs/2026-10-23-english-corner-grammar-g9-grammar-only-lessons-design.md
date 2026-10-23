# English corner: grammar-only hub lessons, and the last five Grade 9 grammar lessons — design

**Status:** implemented (PR #1212; where the build differs from what was first written, the text says how). **Scope:** (1) a change to how the English hub decides which lessons exist, so a
lesson with fewer than four words can carry grammar activities; (2) Grade 9 grammar for the five lessons that change
unlocks. Builds on the Unit 4 pilot and the fourteen authored lessons
(`2026-10-23-english-corner-grammar-g9-pilot-design.md`, `…-g9-lessons-design.md`, PRs #1171, #1204 and #1212) and the
engine in `lib/curriculum/src/englishGrammar.ts`. Not in this spec: Grade 10 grammar, Grade 5 grammar, and reading
comprehension.

## Why

The hub (`lib/curriculum/src/englishHub.ts`) creates a lesson only when the book gives it at least `MIN_HUB_WORDS` (4)
usable words, because its word activities (flashcards, speaking, spelling, matching) need something to choose between.
Five Grade 9 lessons whose book statement is a grammar topic fall under that floor, so they have nowhere to hang an
activity:

| Hub lesson id (`kbl-g9-eng-…`) | Book statement | Words |
| --- | --- | --- |
| `s1-nccd-u2_l3` | use used to to talk about habits or states in the past | 3 |
| `s2-nccd-u7_l1` | use the Present Perfect with already, ever, just, never and yet | 1 |
| `s2-nccd-u7_l2` | use the Present Perfect with for and since to talk about a duration of time | 2 |
| `s2-nccd-u8_l5` | use the first conditional to talk about possible future situations | 0 |
| `s2-nccd-u9_l3` | use say, tell and ask to report conversations | 2 |

(Each statement is checked against `data/iqra_curriculum_g9_eng_sem{1,2}.json` by a test, as for the other lessons.) Unit
7 has no other grammar lesson in the hub. With these five, every Grade 9 lesson the book gives a grammar statement is
covered: 21 lessons (the pilot's two, the thirteen, the passive, and these five).

## Decisions taken (and why)

1. **Grammar-only lessons** (chosen in conversation, 2026-10-23). A lesson enters the hub when it has four or more words
   **or** is on a short list of grammar-only ids. Alternatives offered: lower the word floor (the word activities would
   run on 0–3 words and break or look empty) and attach each grammar to a neighbouring lesson of the same unit
   (grammar would then sit under the wrong lesson id, and the form's book-page check would no longer match).
2. **The list lives in the hub file, not in the grammar data.** `englishGrammar.ts` imports `englishHub.ts`, so the hub
   cannot read the grammar units without a cycle. A test pins that every listed id has fewer than four words and a
   grammar unit, so the list cannot go stale.
3. **A grammar-only lesson is invisible until a teacher signs its unit.** The hub's index is public; an unsigned
   grammar-only lesson would be an empty page. One helper, `hubLessonVisible(id)`, is used by the lesson index, the lesson
   screen and the curriculum lesson page's «open in the hub» link. An unsigned lesson is absent from the index and its
   direct URL shows «lesson not found». A lesson with words is visible whether or not its grammar is signed, as now.
4. **A grammar-only lesson shows only its grammar cards.** The word activities and the reading section are hidden
   (too few words). Its few words stay in the hub and are still voiced by `english-audio`. The index row says
   «grammar activities» instead of «N words».
5. **The same sentence rules as the fourteen authored lessons:** hand-written whole sentences of nine words or fewer,
   a correct answer and a distractor, 40 a lesson (200 in all), no pictures, no Yes or No, True or false silent. The
   distractor is `form` (ungrammatical in standard English) or `meaning` (grammatical but excluded by something in the
   sentence itself), never a form that could fit. These five lessons use `form` only, because their near-synonyms
   (will and going to, say and tell) are where a teacher would object.
6. **Reported speech tests no backshift.** «She said she was tired» and «She said she is tired» are both acceptable
   today, so no item turns on the tense shift; the distractor is a missing object («He told that he was busy»), a
   wrong word order in a reported question, or «said me».
7. **«didn't use to» against «didn't used to» is one flagged topic** of 12 items: some teachers accept both. The form
   flags it for the teacher.
8. **Every unit ships `reviewedBy: null`.**

## The sentences

| Lesson | Sub-topics (count) | Example: correct / distractor |
| --- | --- | --- |
| `u2_l3` used to | `used-to-affirmative` 14, `didnt-use-to` 12, `did-use-to-questions` 14 | «I used to play football daily.» used to play / use to play |
| `u7_l1` present perfect I | `already-just` 14, `ever-never` 14, `yet-negatives` 12 | «Have you ever visited Petra?» Have you ever visited / Have you ever visit |
| `u7_l2` for and since | `for` 14, `since` 14, `have-has` 12 | «I have lived here for five years.» for / since |
| `u8_l5` first conditional | `will-clause` 14, `if-clause` 14, `negatives-questions` 12 | «If it rains, we will stay home.» will stay / would stay |
| `u9_l3` reported speech | `say-tell` 16, `ask` 12, `reported-questions` 12 | «She told me she was tired.» told me / said me |

For `for` and `since` the duration or date in the sentence decides the word («five years» cannot take «since»), so the
kind is `form`. The first-conditional distractors are the second-conditional form («would stay») or a «will» inside the
if-clause, never a meaning choice. No sentence contains a real person's name or anything religious, political or
sensitive.

## Where it lives

- **`lib/curriculum/src/englishHub.ts`:** `GRAMMAR_ONLY_LESSONS` (the five ids); `HubLesson.grammarOnly`; a lesson is built
  when it has `MIN_HUB_WORDS` or more words or its id is listed; `buildFromVocabulary` carries the flag. Grade 9 goes from
  36 to 41 hub lessons; no other grade changes.
- **`lib/curriculum/src/englishGrammar.ts`:** `hubLessonVisible(lessonId)`: the lesson exists and, if grammar-only, its unit
  is signed (`offeredGrammar`).
- **`lib/curriculum/src/englishGrammarG9Items.ts`:** the five lessons' 200 items, in hub order with the rest (the
  statements read from the data file by a test).
- **`lib/curriculum/src/englishGrammarG9.ts`:** the five units (`reviewedBy: null`, `patterns: []`); `G9_HUB_GAPS` is removed;
  `NOT_COVERED_G9` gains an entry per new lesson saying it has no word or reading activities and only appears once signed.
- **`lib/curriculum/src/englishGrammarReview.ts`:** the five pages come from `renderAuthoredUnit` unchanged; the «lessons
  the hub does not carry» card is removed; `docs/english-grammar-g9-review.html` and `-sheet.md` are regenerated.
- **`artifacts/mobile/app/curriculum/english/index.tsx`, `[lessonId].tsx`, `app/curriculum/lesson-detail.tsx` and
  `services/i18n.ts`:** the visibility rule, the grammar-only screen (word and reading sections hidden), and one string
  for the index row in Arabic and English.
- **STATUS.md** index line and the top of `docs/status-log.md`; the earlier spec's note that five topics have no hub lesson is
  updated to say they are built.

No server, schema or migration change. Progress stays on the device, keyed by lesson id as before.

## Tests

- **Hub (`englishHub.test.ts`):** «every lesson has at least `MIN_HUB_WORDS`» becomes «unless `grammarOnly`»; the five ids
  exist and are `grammarOnly`, each has fewer than four words and a grammar unit; no other lesson is `grammarOnly`; Grade 9
  has 41 lessons and Grades 1–5 and 10 are unchanged.
- **Visibility (`englishGrammar.test.ts` or a new file):** an unsigned grammar-only lesson is not visible; with the unit
  signed in a copy (never in the committed data) it is; a lesson with words is visible signed or not; an unknown id is not.
- **Data (`englishGrammarG9Items.test.ts`):** the five lessons are added to the lesson list (19 authored lessons, 760
  items); sub-topic sizes pinned; each book statement equals `objectives[0]` of that id; every sentence nine words or
  fewer, unique, with a differing twin; no item uses `meaning`; the `used-to` topic is the only place «didn't used to»
  appears.
- **Docs:** the committed Grade 9 form and sheet equal the generator; Grades 1–4 documents and the reading forms are
  byte-identical; the form lists the five pages with the book-statement check and has no «lessons the hub does not carry»
  card.
- **App (`englishGrammarG9ItemGames.test.ts`):** the lesson list gains the five; Choose, Build and True or false are offered
  on all nineteen authored lessons and Yes or No on none.

The existing tests must pass unchanged apart from the one hub assertion above. The screens are checked in a browser at
390 px in Arabic and English with temporary local sign-offs restored afterwards: an unsigned grammar-only lesson is absent
from the index and its URL says «lesson not found»; a signed one appears with only grammar cards; a lesson with words is
unchanged; True or false is silent; no horizontal scroll.

## Open points for the teacher (printed on the form)

1. Do the book's pages match these five lesson ids?
2. Is any distractor ever acceptable in your classroom (in particular «didn't used to»)?
3. Is the vocabulary right for the level?
4. Are the reported-speech sentences clear without the tense shift?

## Known limits

- The 200 sentences are written by us; a teacher checks each correct answer and distractor on the printed form.
- Reported speech tests form, not the tense shift; the present perfect and first conditional test form, not the choice
  between near-synonyms.
- A grammar-only lesson that appears only after a signature is new behaviour: tested, but not yet seen on a device.
- The vocabulary check is a printed list, not a test.
- No audio is recorded (`english-audio` needs the OpenAI and R2 keys); True or false on these lessons is silent by design.
- The mapping to the printed pages is unchecked until a teacher does it.

## Switching a lesson on

A Grade 9 English teacher signs that lesson's page of `docs/english-grammar-g9-review.html`, printed, and checks the
book-page line at its top; the audio is recorded for the correct sentences; then the unit's `reviewedBy` is set in
`englishGrammarG9.ts`. The lesson appears in the hub from that moment.

## Not done here

- Grade 10 grammar, Grade 5 grammar, Grade 9 reading comprehension.
- Signing off any unit: that is the teacher's, from the printed form.
