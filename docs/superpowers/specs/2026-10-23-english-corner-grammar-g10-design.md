# English corner: Grade 10 grammar, Semester 1 — design

**Status:** proposed (awaiting review). **Scope:** grammar activities (Choose, Build, True or false) for the eleven Grade 10
Semester 1 lessons whose book statement is a grammar topic: ten already in the English hub, and Articles, which becomes a
grammar-only hub lesson. Builds on the authored-items engine (`lib/curriculum/src/englishGrammar.ts`), the grammar-only
hub mechanism (`GRAMMAR_ONLY_LESSONS`, `hubLessonVisible`) and the generalised teacher form
(`englishGrammarReview.ts`) of the Grade 9 and Grade 5 work (PR #1212). Not in this spec: Semester 2's ten grammar
lessons (a separate spec and PR; they need grammar-only hub entries too), Grade 9 reading comprehension, audio, and
signing off any unit.

## Why

Grades 1–5 and 9 have grammar activities; Grade 10 has none. Its hub has 20 lessons, all Semester 1 (Semester 2 has no
vocabulary extracted, so the hub carries no Semester 2 lesson). Each lesson's `objectives[0]` in
`lib/curriculum/src/data/iqra_curriculum_g10_english_sem1.json` is an «I can» statement; eleven are grammar:
present simple and continuous (u1_l1), articles (u1_l5), present perfect simple vs continuous (u2_l1), verbs taking the
infinitive or the -ing form (u2_l4), past simple, continuous and perfect (u3_l1), used to and would (u3_l4), indirect
questions (u3_l5), modal and related verbs (u4_l1), defining and non-defining relative clauses (u4_l4), forms for the
future (u5_l1), future continuous and perfect (u5_l3). Ten are hub lessons; **Articles has no vocabulary rows**, so it
needs `GRAMMAR_ONLY_LESSONS`.

## Decisions taken (and why)

1. **Semester 1 only, 11 lessons** (chosen in conversation). Alternatives offered: only the ten lessons already in the hub
   (no hub change, but skips Articles), and all 21 Grade 10 grammar lessons (about 840 items in one piece; review would be
   slow). Semester 2 follows as its own spec.
2. **Hand-written items, 40 a lesson, 440 in all**, as Grades 5 and 9: whole sentences of nine words or fewer, a correct
   answer and a distractor, no names, no pictures, no Yes or No, True or false silent, every unit `reviewedBy: null`.
3. **Distractors are `form` plus marker-decided `meaning`** (chosen in conversation). `form`: ungrammatical in standard
   English. `meaning`: grammatical, but excluded by something in the sentence itself («for three hours», «by the time»,
   «at this time tomorrow»). Where two forms could both fit, that topic tests `form` only. Grade 10's book is about these
   choices, so it uses more `meaning` items than Grade 9; each prints its kind on the form for the teacher to rule on.
   Alternatives offered: form only (cannot test the choices the book teaches) and a ruling per lesson.
4. **Articles is a grammar-only hub lesson** (listed in `GRAMMAR_ONLY_LESSONS`), invisible until its unit is signed, grammar
   cards only, index row «grammar activities» — exactly as the five Grade 9 grammar-only lessons.
5. **Grade 10 ids have no `g10`** (`kbl-eng-s1-nccd-u1_l1`), so the form's id display regex becomes `/^kbl-(g\d+-)?eng-/`.
6. **Stacked on PR #1212's branch** because Grade 10 needs its generalised form. If #1212 is merged first, the work moves to
   a fresh branch from `main` with its own PR.

## The sentences

| Lesson (`kbl-eng-s1-nccd-…`) | Book statement | Sub-topics (count: kind) | Example: correct / distractor |
| --- | --- | --- | --- |
| `u1_l1` | use Present Simple and Present Continuous to talk about habits and temporary situations | `habit-markers` 12 meaning · `temporary-markers` 12 meaning · `stative` 8 form · `questions` 8 form | «She usually walks to school.» walks / is walking |
| `u1_l5` (grammar-only) | use articles to talk about general and specific things | `a-an` 8 form · `already-mentioned` 12 meaning · `unique-things` 10 form · `no-article` 10 form | «She has an umbrella.» an / a |
| `u2_l1` | distinguish between the Present Perfect Simple and the Present Perfect Continuous | `result-count` 14 meaning · `duration` 14 meaning · `forms` 12 form | «I have written five emails today.» have written / have been writing |
| `u2_l4` | use a range of verbs taking the infinitive or the -ing form | `ing` 14 form · `to` 14 form · `change-of-meaning` 12 meaning | «She enjoys reading detective stories.» reading / to read |
| `u3_l1` | use the Past Simple, Past Continuous and Past Perfect to talk about past actions | `interrupted` 14 meaning · `earlier-event` 14 meaning · `forms` 12 form | «By the time we arrived, the film had started.» had started / started |
| `u3_l4` | use used to and would to talk about past habits and routines | `used-to-states` 14 meaning · `would-habits` 12 meaning · `forms` 14 form | «I used to have a dog.» used to have / would have |
| `u3_l5` | use indirect questions to make polite requests or to ask for opinions and information | `could-you-tell` 14 form · `do-you-know` 14 form · `if-whether` 12 form | «Could you tell me where it is?» where it is / where is it |
| `u4_l1` | use a variety of modal and related verbs | `obligation` 14 meaning · `ability-permission` 14 meaning · `forms` 12 form | «You mustn't touch the wires. They're live.» mustn't / don't have to |
| `u4_l4` | use defining and non-defining relative clauses | `defining` 12 form · `non-defining` 14 form · `whose-where` 14 form | «My brother, who lives in Aqaba, is a pilot.» who / that |
| `u5_l1` | use a variety of forms to talk about future events and situations | `will-decisions` 10 meaning · `going-to-evidence` 10 meaning · `arrangements-timetables` 12 meaning · `forms` 8 form | «Look at those clouds! It's going to rain.» going to rain / will rain |
| `u5_l3` | use the Future Continuous and the Future Perfect | `continuous` 14 meaning · `perfect` 14 meaning · `forms` 12 form | «At this time tomorrow, I will be flying.» will be flying / will have flown |

Sizes sum to 40 a lesson and are pinned by a test. The `statement` column is the book's `objectives[0]` abbreviated; the data
file carries it verbatim and a test reads it back. Examples are illustrative; the written items are the authority and are listed
on the form. Rules for every item:

1. Nine words or fewer; one grammar point; what decides the answer is in the sentence.
2. A `meaning` item is used only where something in the sentence itself excludes the other form; the sub-topics marked
   `meaning` above are the only places `meaning` appears (a test pins this per lesson).
3. A `form` distractor is ungrammatical in standard English; no form that could fit. Near-synonym pairs that both fit (will and
   going to for a plan, the present perfect simple and continuous for a short event) are never set against each other.
4. No real or book-character name; a family word (Mum, Dad) or a Jordanian place name is fine. Nothing religious, political or
   sensitive.
5. Vocabulary from the unit's hub lesson or common function words; few words outside both (they are printed on the form).

## Where it lives

- **`lib/curriculum/src/englishGrammarG10Items.ts` (new):** `G10_ITEM_LESSONS` — eleven `{lessonId, statement, items}` entries
  in hub order, `GrammarItem` unchanged (`kind: 'form' | 'meaning'`).
- **`lib/curriculum/src/englishGrammarG10.ts` (new):** `GRAMMAR_UNITS_G10` (`patterns: []`, `reviewedBy: null`) and
  `NOT_COVERED_G10`.
- **`lib/curriculum/src/englishGrammar.ts`:** `GRAMMAR_UNITS` gains Grade 10. No engine change.
- **`lib/curriculum/src/englishHub.ts`:** `GRAMMAR_ONLY_LESSONS` gains `kbl-eng-s1-nccd-u1_l5`. Grade 10 goes from 20 to 21 hub
  lessons.
- **`lib/curriculum/src/englishGrammarReview.ts`:** statement lookup reads the Grade 5, 9 and 10 lists; the id display regex
  becomes `/^kbl-(g\d+-)?eng-/`; `NOT_COVERED` gains `10`; `GRADE_COPY[10]` (its lead says many items test a choice, and its
  checks flag Articles and the present perfect simple vs continuous for the teacher). Grade 1–5 and 9 output stays
  byte-identical.
- **`lib/curriculum/scripts/grammar-sheet.ts`:** grades `[1, 2, 3, 4, 5, 9, 10]`; writes `docs/english-grammar-g10-review.html`
  and `-sheet.md`.
- **Docs:** write-up at the top of `docs/status-log.md`, an index line in `STATUS.md`.

No app, server or schema change. Progress stays on the device, keyed by lesson id.

## Tests

- **Data (`englishGrammarG10Items.test.ts`, new):** eleven lessons, 440 items, sub-topic sizes pinned; each statement equals
  `objectives[0]` of its lesson id in the Grade 10 Semester 1 JSON; every sentence nine words or fewer, unique, the answer once,
  a differing twin that is never another true sentence; kinds only `form` or `meaning`, and `meaning` only in the pinned
  sub-topics; no capitalised name outside a whitelist; present-perfect distractors contain no bare past form.
- **Units (`englishGrammarG10.test.ts`, new):** eleven units in hub order, all `reviewedBy: null`, none offered
  (`offeredGrammar`), a not-covered note each with no `"`, `&`, `<`, `>`.
- **Hub (`englishHub.test.ts`, `englishHubVisible.test.ts`):** `GRAMMAR_ONLY_LESSONS` gains the Articles id; Articles has fewer
  than four words and no hub lesson until signed; Grade 10 has 21 lessons and the other grades' counts are unchanged.
- **Docs:** the committed Grade 10 form and sheet equal the generator; every other grade's document is unchanged.
- **App (`englishGrammarG10ItemGames.test.ts`, mobile):** Choose, Build and True or false are offered on all eleven lessons and
  Yes or No on none; True or false is silent.

Existing tests pass unchanged apart from the hub counts and the lesson-count assertions that enumerate grammar units by grade.
The screens are checked in a browser at 390 px in Arabic and English with temporary local sign-offs restored afterwards:
unsigned, no grammar cards on a Grade 10 lesson and Articles missing from the index; signed, Articles appears with only grammar
cards and a lesson with words is unchanged; True or false is silent; no horizontal scroll.

## Open points for the teacher (printed on the form)

1. Does each lesson id match the printed book page and its grammar line?
2. Is any distractor ever acceptable in your classroom, and is every `meaning` item really decided by its marker?
3. Articles and the present perfect simple vs continuous: are these sentences clear without more context?
4. Is the vocabulary right for Grade 10?

## Known limits

- The 440 sentences are ours; a teacher checks each correct answer and distractor on the printed form, and may change some
  `meaning` items (article and tense choices are judgment calls). A signed unit would need those fixed first.
- Semester 2's ten grammar lessons are not covered here and need grammar-only hub entries.
- The vocabulary check is a printed list, not a test. Some Grade 10 grammar lessons carry vocabulary from a neighbouring topic
  (for example «used to and would» carries food words); that is the existing hub mapping and is not changed here.
- No audio is recorded (`english-audio` needs the OpenAI and R2 keys); True or false is silent by design.

## Switching a lesson on

A Grade 10 English teacher signs that lesson's page of `docs/english-grammar-g10-review.html`, printed, and checks the book-page
line; audio is recorded for the correct sentences; then the unit's `reviewedBy` is set in `englishGrammarG10.ts`. Articles appears
in the hub from that moment.

## Not done here

- Grade 10 Semester 2 grammar, Grade 9 reading comprehension.
- Signing off any unit: that is the teacher's.
