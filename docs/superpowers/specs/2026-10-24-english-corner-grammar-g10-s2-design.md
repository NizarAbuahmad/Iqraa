# English corner: Grade 10 Semester 2 grammar — design

**Status:** implemented (this PR). **Scope:** grammar activities (Choose, Build, True or false) for the ten Grade 10
Semester 2 lessons whose book statement is a grammar topic, each as a **grammar-only hub lesson**. Builds on the Semester 1
work (`2026-10-23-english-corner-grammar-g10-design.md`, PR #1235, merged), the authored-items engine
(`lib/curriculum/src/englishGrammar.ts`), the grammar-only hub mechanism (`GRAMMAR_ONLY_LESSONS`, `hubLessonVisible`) and the
generalised teacher form (`englishGrammarReview.ts`). Not in this spec: audio, signing off any unit, the sentence-level
vocabulary check, Grade 9 reading comprehension.

## Why

Grade 10 Semester 1 has grammar activities for its eleven grammar lessons; Semester 2 has none. The hub has no Semester 2
lesson at all, because Semester 2 has no vocabulary rows (`english_vocabulary.json` holds none for `kbl-eng-s2-…`) and a
lesson needs at least `MIN_HUB_WORDS` (4) words unless it is on `GRAMMAR_ONLY_LESSONS`. The browser catalog
(`lib/curriculum/src/catalogs/g10EnglishSem2.ts`) already has all ten lessons with real ids and unit titles (U6 «Do the right
thing», U7 «In the spotlight», U8 «The evolution of advertising», U9 «The power of nature», U10 «Food for thought»). Each
lesson's `objectives[0]` in `lib/curriculum/src/data/iqra_curriculum_g10_english_sem2.json` is an «I can» statement; ten are
grammar.

## Decisions taken (and why)

1. **All ten lessons, 400 hand-written items** (chosen in conversation). Alternatives offered: the first five only (about 200
   items now), and the user picking the lessons. One spec and one PR, as the shape is identical to Semester 1.
2. **All ten are grammar-only hub lessons**, listed in `GRAMMAR_ONLY_LESSONS`: invisible until a teacher signs the unit,
   grammar cards only, index row «grammar activities», as Articles and the five Grade 9 grammar-only lessons. Grade 10 goes
   from 21 to 31 hub lessons.
3. **Same item rules as Semester 1:** whole sentences of nine words or fewer, a correct answer and a distractor, no names, no
   pictures, no Yes or No, True or false silent, every unit `reviewedBy: null`. A distractor is `form` (ungrammatical in
   standard English) or `meaning` (grammatical but ruled out by a word in the sentence itself); where two forms could both
   fit, the topic tests `form` only. Lessons learned in Semester 1 apply: «while» alone, «before» or «already» alone do not
   decide a tense; a distractor real English accepts is not a distractor; an adverb must sit inside the answer so the false
   twin keeps standard word order; an item that reads as an arrangement can fit every future form.
4. **Reported speech tests no tense shift** (as in Grade 9): both «said she was tired» and «said she is tired» are acceptable,
   so reporting-verb and reported-question items turn on the verb pattern, the object, `if`/`whether` and word order.
5. **Overlap with Grade 9** (conditionals, passive, reported speech) is accepted; the Grade 10 items are written separately and
   are harder.
6. **Built on `main` after PR #1247** (the printed-forms and subtitle fixes, merged first), so the Semester 2 form pages
   get the print rule and the sign-off fix.
7. **Every unit ships `reviewedBy: null`.**

## The sentences

| Lesson (`kbl-eng-s2-nccd-…`) | Book statement (`objectives[0]`) | Sub-topics (count: kind) | Example: correct / distractor |
| --- | --- | --- | --- |
| `u6_l1` | use the first and second conditional to talk about possible and hypothetical situations | `first-conditional` 12 form · `second-conditional` 12 form · `imagine-vs-real` 16 meaning | «If it rains, we will stay home.» rains / will rain |
| `u6_l4` | use the zero conditional to talk about real situations that are always true | `if-present` 14 form · `when-general-truths` 14 form · `questions-negatives` 12 form | «If you heat ice, it melts.» melts / melt |
| `u7_l1` | use reporting verbs to report stories | `verb-patterns` 16 form · `admit-deny-suggest` 14 form · `tell-ask-warn` 10 form | «She suggested going by bus.» going / to go |
| `u7_l5` | use reported questions to talk about what someone else said | `ask-wonder` 14 form · `if-whether` 12 form · `word-order` 14 form | «He asked where I lived.» where I lived / where did I live |
| `u8_l1` | use the passive to talk about different actions | `present-past` 14 form · `with-modals` 12 form · `questions-negatives` 14 form | «The bridge was built long ago.» was built / was build |
| `u8_l6` | use have/get something done to talk about services | `have-something-done` 12 form · `get-something-done` 12 form · `service-vs-self` 16 meaning | «I had my car repaired yesterday.» repaired / repairing |
| `u9_l1` | use the third conditional to talk about unreal situations in the past | `third-conditional` 14 form · `past-unreal` 14 meaning · `would-have-forms` 12 form | «If I had known, I would have called.» had known / would have known |
| `u9_l4` | use I wish and if only to express regrets | `wish-present` 14 form · `wish-past-regrets` 14 meaning · `if-only` 12 form | «I wish I had studied last year.» had studied / studied |
| `u10_l1` | use modal verbs to speculate about the present | `must-cant` 14 meaning · `might-may` 12 form · `be-v-ing` 14 form | «He has the keys, so he must be inside.» must / can't |
| `u10_l3` | use modal verbs to speculate about the past | `must-have` 14 meaning · `might-could-have` 12 form · `cant-have` 14 meaning | «Their car is gone. They must have left.» must have / can't have |

Sizes sum to 40 a lesson (400 in all) and are pinned by a test; that makes 102 `meaning` items (16 + 16 + 14 + 14 + 14 + 14 + 14)
and 298 `form` items. The `statement` column is the book's `objectives[0]` shortened; the data file carries it verbatim and a
test reads it back. Examples are illustrative; the written items are the authority and are listed on the form. As in
Semester 1 a `meaning` sub-topic may switch to `form` during the build when a distractor turns out to fit; the pinned
sizes, the totals and the status log then say so. A `meaning` item is used only where a marker in the sentence rules the
distractor out: an unreal situation stated in its own sentence («Imagine …», «Suppose …» with a past verb) against a stand-alone
`will` sentence (the build dropped the «likely» side: «Tomorrow, if it rains, we would …» and «If I were …, I will …» are mixed
conditionals, so those twins were form errors or borderline-acceptable, not a meaning contrast), «yesterday»/«last year» against
a present form, a sentence saying the speaker could not do it, did not do it, was away or who did it (or «myself» plus a second
clue) for a service against a self-done action («by a mechanic» would make an active-verb twin a form error), «so» + a clue for
must/can't. Rules for every
item: nine words or fewer; one grammar point; what decides the answer is in the sentence; no real person's name (family
words and Jordanian place names fine); nothing religious, political or sensitive; vocabulary from common school words, few
words outside the function-word list (they print on the form for the teacher).

## Where it lives

- **`lib/curriculum/src/englishGrammarG10Items.ts`:** `G10_ITEM_LESSONS` grows from 11 to 21 entries (the ten new ones after the
  eleven, in hub order), `GrammarItem` unchanged.
- **`lib/curriculum/src/englishGrammarG10.ts`:** the Grade 10 units and `NOT_COVERED_G10` grow to 21; the units sort into hub
  order.
- **`lib/curriculum/src/englishHub.ts`:** `GRAMMAR_ONLY_LESSONS` gains the ten Semester 2 ids; the doc comment is updated.
  Grade 10 goes from 21 to 31 hub lessons.
- **`lib/curriculum/src/englishGrammarReview.ts`:** `GRADE_COPY[10].lead` says «الفصل الأول» and counts the lessons: reword
  it to cover both semesters with the right Arabic count noun for 21 (and the Articles clause kept); the form has one
  section per unit, so 21 pages, each labelled with its semester and unit title by the existing code. No other renderer
  change.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** unchanged (Grade 10 is already in the loop); the Grade 10 form and sheet are
  regenerated.
- **Docs:** write-up at the top of `docs/status-log.md`, an index line in `STATUS.md`.

No engine, app, server or schema change. Progress stays on the device, keyed by lesson id.

## Tests

- **Data (`englishGrammarG10Items.test.ts`):** 21 lessons, 840 items, every sub-topic size and kind pinned for all 21; each
  statement equals `objectives[0]` of its lesson id in the Semester 1 or Semester 2 Grade 10 JSON (the test reads the file
  for the lesson's semester); every sentence nine words or fewer, unique, the answer once, a differing twin that is never
  another true sentence; kinds only `form` or `meaning`, `meaning` only in the pinned sub-topics; no capitalised name outside
  a whitelist; the present-perfect and past-simple guards still hold; the glued-«و» check still passes over the Grade 10 form.
- **Units (`englishGrammarG10.test.ts`):** 21 units in hub order, all `reviewedBy: null`, none offered, a not-covered note
  each with no `"`, `&`, `<`, `>` and no glued «و».
- **Hub (`englishHub.test.ts`, `englishHubVisible.test.ts`):** `GRAMMAR_ONLY_LESSONS` has sixteen ids (five Grade 9, eleven
  Grade 10); each of the ten new lessons has no words and a grammar unit; Grade 10 has 31 lessons and the other grades'
  counts are unchanged.
- **Docs:** the committed Grade 10 form and sheet equal the generator; every other grade's document is unchanged.
- **App (`englishGrammarG10ItemGames.test.ts`):** Choose, Build and True or false are offered on all 21 lessons, Yes or No on
  none, True or false silent, rounds non-empty.

The screens are checked in a browser at 390 px in Arabic and English with temporary local sign-offs restored afterwards: a
Semester 2 lesson is absent from the Grade 10 index and its URL says «lesson not found» until signed; signed, it appears
with only Choose, Build and True or false; no horizontal scroll.

## Open points for the teacher (printed on the form)

1. Does each lesson id match the printed book page and its grammar line?
2. Is any distractor ever acceptable in your classroom, and is every `meaning` item really decided by its marker?
3. The conditionals, `wish`, and the modals of speculation: are these sentences clear without more context?
4. Is the vocabulary right for Grade 10?

## Known limits

- The 400 sentences are ours; a teacher checks each correct answer and distractor on the printed form and may change some
  `meaning` items (conditional and speculation choices are judgment calls). A signed unit would need those fixed first.
- Reporting verbs and reported questions test the verb pattern, object and word order, not the tense shift.
- The vocabulary check is a printed list, not a test; no audio is recorded (`english-audio` needs the OpenAI and R2 keys);
  True or false is silent by design.
- A grammar-only lesson that appears only after a signature is behaviour tested but not yet seen on a device.

## Switching a lesson on

A Grade 10 English teacher signs that lesson's page of `docs/english-grammar-g10-review.html`, printed, and checks the
book-page line; audio is recorded for the correct sentences; then the unit's `reviewedBy` is set in `englishGrammarG10.ts`.
The lesson appears in the hub from that moment.

## Not done here

- Signing off any unit: that is the teacher's.
- Grade 10 Semester 1 is already built (PR #1235).
