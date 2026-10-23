# English corner: Grade 5 grammar — design

**Status:** proposed (awaiting review). **Scope:** grammar activities (Choose, Build, True or false) for the ten Grade 5
grammar lessons already in the English hub. Builds on the authored-items engine of the Grade 9 work
(`lib/curriculum/src/englishGrammar.ts`: `GrammarItem`, `unitSentences`, `buildCap`) and its review form
(`englishGrammarReview.ts`, `renderAuthoredUnit`). Not in this spec: Grade 10 grammar, Grade 9 reading comprehension,
audio, and signing off any unit.

## Why

Grades 1–4 and 9 have grammar activities; Grade 5 has none, though its ten grammar lessons are already in the hub
(`kbl-g5-eng-s1-nccd-u1_l1` … `kbl-g5-eng-s2-nccd-u10_l1`, 14–28 words each). Each lesson's `objectives[0]` in
`lib/curriculum/src/data/iqra_curriculum_g5_english_sem{1,2}.json` names the grammar and gives the book's own example
sentence. The second lesson of every unit is a listening-for-sequence lesson with no grammar statement; those get none.

## Decisions taken (and why)

1. **Hand-written items** (chosen in conversation), as for Grade 9: whole sentences written by us, a correct answer and a
   distractor, 40 a lesson, **400 in all**. Grade 5 has no machine-expandable patterns: the topics are tenses and clause
   types, not one-word swaps. Alternative offered: generated patterns, which cannot hold a tense, a clause and a
   question form in one sentence.
2. **All ten lessons, all `form` distractors.** The distractor is ungrammatical in standard English, never a form that
   could fit. Present perfect items must avoid a distractor that is acceptable in some English («I did» for «I have done»)
   and so do not turn on the choice between past simple and present perfect.
3. **Sentences are nine words or fewer** (`buildCap(5)` is 9), drawn from the unit's own vocabulary and function words,
   with **no real or book-character names** and nothing religious, political or sensitive. A pronoun or «my mum», not a name.
4. **True or false is silent** (twins never voiced), Choose and Build play the correct sentence, exactly as Grade 9
   authored lessons. Yes or No is not offered.
5. **No hub change.** The ten lessons exist and have words, so they are visible whether or not their grammar is signed.
   Grammar cards appear only when the unit is signed (`offeredGrammar`).
6. **Every unit ships `reviewedBy: null`.**

## The sentences

| Lesson (`kbl-g5-eng-…`) | Book statement | Sub-topics (40 items) | Example: correct / distractor |
| --- | --- | --- | --- |
| `s1-nccd-u1_l1` | Present simple with before/after/when | `third-person-s`, `before-after`, `when-clauses` | «She plays when she gets home.» gets / get |
| `s1-nccd-u2_l1` | Comparative and superlative adjectives | `taller-forms`, `more-forms`, `superlatives`, `irregular` | «My mum is shorter than me.» shorter / more short |
| `s1-nccd-u3_l1` | Past simple (was/were, did) | `was-were`, `did-questions`, `regular-irregular` | «Did you have a phone?» have / had |
| `s1-nccd-u4_l1` | will / won't | `will`, `wont`, `will-questions` | «I won't get him a book.» get / to get |
| `s1-nccd-u5_l1` | Relative clauses (who, where, which) | `who`, `where`, `which` | «It's the man who we saw.» who / where |
| `s2-nccd-u6_l1` | Past simple (irregular verbs, did) | `irregular`, `did-negatives`, `questions` | «I learnt how to cook.» learnt / learn |
| `s2-nccd-u7_l1` | Past continuous | `was-were-ing`, `when-while`, `questions` | «The shark was looking for fish.» was looking / was look |
| `s2-nccd-u8_l1` | should / shouldn't | `should`, `shouldnt`, `advice-questions` | «You should go to the doctor.» go / to go |
| `s2-nccd-u9_l1` | Present perfect | `have-has`, `havent-hasnt`, `questions` | «I haven't seen the film.» seen / see |
| `s2-nccd-u10_l1` | Present perfect with ever/never | `ever-questions`, `never`, `short-answers` | «Have you ever made chocolates?» made / make |

Examples are illustrative; the written items are the authority and are listed on the review form. Sub-topic sizes
sum to 40 per lesson and are pinned by a test. Distractors are the bare verb, a doubled marker or a wrong auxiliary,
never «saw» for «seen» or «did» for «have done», which some teachers accept.

## Where it lives

- **`lib/curriculum/src/englishGrammarG5Items.ts` (new):** `G5_ITEM_LESSONS` — ten `{lessonId, statement, items}` entries in
  hub order, `statement` equal to `objectives[0]` of that lesson (a test reads the JSON).
- **`lib/curriculum/src/englishGrammarG5.ts` (new):** `GRAMMAR_UNITS_G5` (ten units, `patterns: []`, `reviewedBy: null`) and
  `NOT_COVERED_G5` (per lesson: no pictures except where the hub has them, vocabulary is a printed list not a test, no audio).
- **`lib/curriculum/src/englishGrammar.ts`:** `GRAMMAR_UNITS` gains `GRAMMAR_UNITS_G5`. No engine change: items,
  `buildCap(5)` = 9 and silent True or false already exist.
- **`lib/curriculum/src/englishGrammarReview.ts`:** `renderAuthoredUnit` takes the statement and `NOT_COVERED` by the
  unit's grade instead of Grade 9 only (the book-page line is the same); `GRADE_COPY[5]` (title, lead, activity
  descriptions, checks). The Grade 5 book gives a topic line with an example, not an «I can» line, so the card says «topic».
  Grade 9 and Grades 1–4 output must stay byte-identical.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** the loop becomes `[1, 2, 3, 4, 5, 9]`; writes
  `docs/english-grammar-g5-review.html` and `-sheet.md`.
- **Docs:** write-up at the top of `docs/status-log.md`, an index line in `STATUS.md`.

No app, server, schema or migration change. Progress stays on the device, keyed by lesson id.

## Tests

- **Data (`englishGrammarG5Items.test.ts`, new):** ten lessons, 400 items; sub-topic sizes pinned; each statement equals
  `objectives[0]` of its lesson id; every sentence nine words or fewer, unique, with a differing twin; the answer occurs
  once in the sentence and the distractor differs from it; all `form`; no capitalised word except sentence starts, «I», and
  a short whitelist; no name from a banned list (book characters); present-perfect lessons contain no distractor from a
  list of acceptable forms.
- **Units (`englishGrammarG5.test.ts`, new):** ten units, all `reviewedBy: null`, all hub lessons exist and are not
  `grammarOnly`; every Grade 5 grammar unit is offered nowhere until signed (`offeredGrammar` empty for grade 5).
- **Docs:** the committed Grade 5 form and sheet equal the generator; Grades 1–4 and 9 documents and the reading forms
  are byte-identical to before.
- **App (`englishGrammarG5ItemGames.test.ts`, mobile):** Choose, Build and True or false are offered on all ten lessons
  and Yes or No on none; True or false is silent; Build stays within the cap.
- Existing tests pass unchanged except counts that enumerate `GRAMMAR_UNITS` by grade.

The screens are checked in a browser at 390 px in Arabic and English with temporary local sign-offs restored afterwards:
unsigned, a Grade 5 lesson shows no grammar cards; signed, the cards play; True or false is silent; no horizontal scroll.

## Open points for the teacher (printed on the form)

1. Does each lesson id match the printed book page and its grammar line?
2. Is any distractor ever acceptable in your classroom?
3. Is the vocabulary right for Grade 5?
4. Are the present perfect sentences clear without a past-simple contrast?

## Known limits

- The 400 sentences are ours; a teacher checks each correct answer and distractor on the printed form.
- Present perfect and past simple test form, not the choice between them; a wrong True or false answer does not show the
  correct form.
- The vocabulary check is a printed list, not a test.
- No audio is recorded (`english-audio` needs the OpenAI and R2 keys); True or false is silent by design.
- Only six Grade 5 words have pictures, so the activities use none.

## Switching a lesson on

A Grade 5 English teacher signs that lesson's page of `docs/english-grammar-g5-review.html`, printed, and checks the
book-page line; audio is recorded for the correct sentences; then the unit's `reviewedBy` is set in `englishGrammarG5.ts`.

## Not done here

- Grade 10 grammar, Grade 9 reading comprehension.
- Signing off any unit: that is the teacher's.
