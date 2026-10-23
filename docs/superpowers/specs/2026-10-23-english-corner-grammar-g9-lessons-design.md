# English corner: Grade 9 grammar, the thirteen hub lessons — design

> **Correction (2026-10-23, later the same day).** The passive (`kbl-g9-eng-s2-nccd-u10_l1`, 7 hub words) **is** in
> the hub; this spec wrongly listed it as having no hub lesson, and it was left out. It is built now (40 items, topics
> `present-passive` 14, `past-passive` 14, `questions-negatives` 12, all `form`), so the work covers **fourteen**
> lessons and **560** items. Wherever the text below says thirteen, 520 or six topics, read fourteen, 560 and **five**
> (used to, the two present perfects, the first conditional, reported speech). See the status-log entry «Grade 9
> grammar: the passive added». **Update:** the five topics the hub lacked are built too, as grammar-only hub lessons
> (`2026-10-23-english-corner-grammar-g9-grammar-only-lessons-design.md`); no Grade 9 grammar topic of the book is left
> without a lesson.

**Status:** implemented (PR #1204; where the build differs from what was first written, the text says how). **Scope:** Grade 9 English **grammar** on the thirteen hub lessons, outside
Unit 4, that carry a grammar topic of the book (table below). Builds on the Unit 4 pilot
(`2026-10-23-english-corner-grammar-g9-pilot-design.md`, PR #1171, merged) and the engine in
`lib/curriculum/src/englishGrammar.ts`. Not in this spec: the six book topics the hub has no lesson for, Grade 10,
and reading comprehension.

## Why

The pilot gave Grade 9 grammar activities on one unit (Unit 4: comparatives and quantifiers, 122 sentences, hidden
until a teacher signs). The rest of the book's grammar is tenses, modals, pronouns, relative pronouns, verb
patterns and conditionals. Those cannot be built from picture or slot rows: the form is decided by a marker or a
clause in the sentence («Listen!», «While…», «If I had a car,»), and filling slots would break agreement. So the
sentences here are **authored whole**, each with its correct answer and its distractor, and every one is a claim
a teacher checks on the printed form.

## What the hub holds

The hub offers a lesson only with at least `MIN_HUB_WORDS` (4) hub words. Outside Unit 4 (done in the pilot) the book has nineteen
grammar topics across the other nine units; the hub carries thirteen of them. Each id below was
checked against the book's data file (`iqra_curriculum_g9_eng_sem{1,2}.json`): the lesson id carries the book's own
«I can» statement. Matching the ids to the printed pages is still a teacher's first check, printed on the form.

| Hub lesson | The book's statement (verbatim) | Topics authored |
| --- | --- | --- |
| `kbl-g9-eng-s1-nccd-u1_l1` | use present tenses to talk about routines and temporary situations | present simple or continuous |
| `…s1-nccd-u1_l3` | describe my family using personality adjectives and reflexive pronouns | reflexive pronouns only |
| `…s1-nccd-u1_l4` | use indefinite pronouns with some-, any-, every- and no- | indefinite pronouns |
| `…s1-nccd-u2_l1` | use the Past Simple to talk about finished actions or states | past simple |
| `…s1-nccd-u3_l1` | use the Past Simple and Continuous to talk about past experiences | past simple and continuous |
| `…s1-nccd-u3_l4` | use relative pronouns to talk about people, things and places | who, which, where, whose |
| `…s1-nccd-u5_l1` | use modal verbs to talk about suggestions and obligations | should, must, mustn't, don't have to |
| `…s1-nccd-u5_l3` | use modal verbs to talk about the past | should/could/must/can't have + participle |
| `…s2-nccd-u6_l1` | use Present Continuous and going to … future arrangements and intentions | form only |
| `…s2-nccd-u6_l3` | use going to and will to talk about future predictions | form only |
| `…s2-nccd-u8_l1` | use verb patterns with the infinitive and the -ing form | infinitive or -ing |
| `…s2-nccd-u9_l1` | use the Past Perfect to tell stories from my life | past perfect, form |
| `…s2-nccd-u10_l1` | use the passive | present and past passive, questions and negatives (added; see the correction) |
| `…s2-nccd-u10_l4` | use the second conditional to talk about hypothetical situations | second conditional |

**Five book topics have no hub lesson and are out:** used to (U2 l3), the two present perfects (U7 l1, l2), the first
conditional (U8 l5) and reported speech (U9 l3). Unit 7 has no grammar lesson in the hub at
all. Fixing that means changing how the hub builds lessons, which is its own spec; the form says so.

## Decisions taken (and why)

1. **All thirteen lessons in one spec and PR** (chosen in conversation, 2026-10-23), about 40 sentences each, about
   520 in all. Alternatives offered: Semester 1 first (about 500 sentences) and two units at a time. The cost is a
   long form for one teacher; each lesson has its own sign-off strip, so a teacher can sign page by page.
2. **Authored whole sentences** (chosen in conversation). Alternatives: slot patterns with new wrong-form kinds
   (-ing, third person, participle), and a mix. Authored sentences read as natural English and the teacher sees
   exactly what a child sees.
3. **The wrong option is a distractor, in one of two kinds** (chosen in conversation, after a teacher-minded review
   of the first draft): `form` — ungrammatical in standard English; or `meaning` — grammatical but excluded by
   something in the sentence itself. Never a form that could fit. First-draft items that failed this were dropped:
   «is playing» for a habit (a temporary routine can use it), «walked» for «was walking» after «While», and
   «by the time … already» as proof the past simple is wrong. The kind is printed on the form and never shown to a
   child.
4. **Activities: Choose the word, Build the sentence, True or false. No Yes or No** — a grammar claim is not a fact
   a child answers from knowledge. No pictures.
5. **True or false is silent on authored items, both ways.** The app speaks the sentence it shows, and a false twin
   here is ungrammatical, so it would read broken English aloud; silencing only the twins would give the answer
   away. So the screen plays no sound and shows no speaker button for an authored item, true or false, and the
   twins stay out of the audio list so `english-audio` never records them. Choose and Build play the correct
   sentence after the child answers, as now.
6. **u6 tests sentence form only.** Choosing between going to, will and the present continuous has more than one
   acceptable answer, so its distractors are broken forms («are meet», «going rain»), which test structure, not
   understanding of arrangements or predictions. The form says so in a «not covered» note.
7. **Every sentence is 9 words or fewer** (`buildCap(9)`), so Build always takes the whole sentence.
8. **Vocabulary is a printed list, not a test.** Grade 9 sentences use words beyond the hub lists; the form prints,
   per lesson, the words found in no hub vocabulary list, for the teacher to approve or strike.
9. **Every unit ships `reviewedBy: null`**, so nothing is offered to anyone until a teacher signs the printed form.

## The sentences

About 40 per lesson, 6 to 10 for each sub-topic. Everyday school, family, food, travel and technology; no names of
real people; nothing religious, political or sensitive. One point per sentence, and what decides it is in the
sentence. Examples (answer / distractor, kind):

| Lesson | Example | Correct answer / distractor | Kind |
| --- | --- | --- | --- |
| u1 l1 | Listen! The baby is crying. | is crying / cries | meaning |
| u1 l1 | She knows the answer. | knows / is knowing | form |
| u1 l3 | The girls enjoyed themselves at the party. | themselves / herself | form |
| u1 l4 | There isn't anything in the fridge. | anything / nothing | form |
| u2 l1 | Did you see the match yesterday? | see / saw | form |
| u3 l1 | While I was walking, it started to rain. | was walking / was walk | form |
| u3 l4 | This is the town where I was born. | where / who | form |
| u5 l1 | You mustn't run near the pool. It's dangerous. | mustn't / don't have to | meaning |
| u5 l3 | He should have studied harder. | should have studied / should studied | form |
| u6 l1 | We are meeting my cousins tomorrow. | are meeting / are meet | form |
| u6 l3 | Look at those clouds! It's going to rain. | going to rain / going rain | form |
| u8 l1 | She enjoys reading detective stories. | reading / to read | form |
| u9 l1 | She had finished her homework before her parents arrived. | had finished / had finish | form |
| u10 l4 | If I had a car, I would drive to work. | would drive / will drive | form |

What each lesson covers: **u1 l1** markers that force the continuous («right now», «at the moment», «Listen!»),
stative verbs, the third-person «-s»; **u1 l3** reflexive pronouns only (a personality cannot be right or wrong);
**u1 l4** some-/any-/every-/no- compounds, including the double negative; **u2 l1** the past after «did», regular
and irregular; **u3 l1** past simple and continuous with «while», «when» and «was/were» agreement; **u3 l4** who,
which, where, whose; **u5 l1** should, must, mustn't, don't have to, the meaning decided by the sentence; **u5 l3**
should/could/must/can't have; **u6** the two future lessons, broken-form distractors; **u8 l1** verbs followed by the
infinitive or the -ing form; **u9 l1** the past perfect, broken-form distractors; **u10 l4** the second conditional
against the first-conditional form.

## Where it lives

- **`lib/curriculum/src/englishGrammar.ts`:** `GrammarUnit` gains an optional `items`:
  `{ topic: string; text: string; answer: string; distractor: string; kind: 'form' | 'meaning' }[]`, and `patterns`
  may be empty. `unitSentences` turns each item into a `GrammarSentence`: `patternId` is the topic; `choose` is a
  phrase choice blanking `answer` against `distractor`; `claim.falseText` is `text` with `answer` replaced by
  `distractor`; `build` is the whole sentence; no picture, no `yesNo`. `GrammarSentence['claim']` gains an optional
  `voiced: false`, set on every authored item. `allGrammarSpoken` omits a claim whose `voiced` is `false`.
  `GRAMMAR_UNITS` already includes the G9 units. Grades 1–4 and the Unit 4 pilot are unchanged.
- **`lib/curriculum/src/englishGrammarG9Items.ts`** (new): the item data for the thirteen lessons, types only from
  the engine; **`englishGrammarG9.ts`** appends the thirteen units (`reviewedBy: null`, `patterns: []`) to
  `GRAMMAR_UNITS_G9` and extends `NOT_COVERED_G9`.
- **`lib/curriculum/src/englishGrammarReview.ts`:** an authored-unit page (grouped by topic: sentence, correct
  answer, distractor, kind, tick, notes; the book-page check; the words outside the hub lists; the sign-off
  strip); `GRADE_COPY[9]` updated; `docs/english-grammar-g9-review.html` and `-sheet.md` regenerated by
  `lib/curriculum/scripts/grammar-sheet.ts`. The Unit 4 pages and data page are unchanged.
- **`artifacts/mobile/components/englishHub/GrammarActivities.tsx`:** the True or false screen plays no sound and
  shows no speaker button when the item's claim is `voiced: false`. `games.ts` and the strings are expected to
  need nothing else.
- **STATUS.md** index line and the top of `docs/status-log.md`.

No server, schema or migration change. Progress stays on the device.

## Tests

- **Engine (`englishGrammarEngine.test.ts`):** an item becomes a sentence with the right `choose` and `claim`;
  `right` appears exactly once, as whole words; `answer` ≠ `distractor`; the twin is not one of the unit's true
  sentences; `allGrammarSpoken` omits unvoiced twins and keeps true sentences; the existing units' output is
  unchanged.
- **Data (`englishGrammarG9Items.test.ts`):** the thirteen lessons are hub lessons and match the id table above, and each
  lesson's book statement equals the `objectives[0]` of that id in `data/iqra_curriculum_g9_eng_sem{1,2}.json` (added while
  planning, so the mapping to the book's data is pinned, not only printed);
  every unit is unsigned and `offered…` is `null` for each; each topic has at least 6 items; every sentence is at
  most 9 tokens; no duplicate sentence within a lesson; every item has a `kind`; per-lesson totals and the
  `form` / `meaning` counts are pinned; the sentences contain no real person's name.
- **Docs:** the committed Grade 9 form and sheet equal what the generator writes; the Grade 1–4 documents are
  byte-identical; the form lists every sentence once, every lesson's book-page check, and the not-covered notes.
- **App (`englishGrammarG9ItemGames.test.ts`):** Choose, Build and True or false are offered on all thirteen
  lessons and Yes or No on none; rounds of each have the right answer where the item says, the tiles are the
  build tokens, and a True or false item is silent.

The existing tests, the Unit 4 pilot's and Grades 1–4, must pass unchanged. The screens are checked in a browser at
390 px in Arabic and English with temporary local sign-offs restored afterwards: Choose, Build and a silent True
or false on a Grade 9 lesson, no horizontal scroll, an unsigned lesson shows nothing.

## Open points for the teacher (printed on the form)

1. Do the book's pages match these lesson ids?
2. Is any distractor ever acceptable in your classroom?
3. Is the vocabulary right for the level?
4. Are sentences of this length right for Build?
5. Are the `meaning` items (u1 l1 markers, u5 l1 modals) clear enough that the other option is wrong?

## Known limits

- The sentences are written by us. A teacher checks each correct answer and distractor on the printed form; the
  mechanical tests only catch malformed items, not wrong English.
- The vocabulary check is a printed list, not a test.
- Five book topics are out because the hub has no lesson for them (used to, the present perfects, first
  conditional, reported speech).
- u6 tests form, not the choice between future forms.
- No audio is recorded (`english-audio` needs the OpenAI and R2 keys), and True or false on these lessons is
  silent by design.
- The mapping to the printed pages is unchecked until a teacher does it.
- After a child answers a false item the screen shows only «the correct answer: false», not the correct form, because True or false is silent here.

## Switching a lesson on

A Grade 9 English teacher signs that lesson's page of `docs/english-grammar-g9-review.html`, printed; the audio is
recorded for the correct sentences; then the unit's `reviewedBy` is set in `englishGrammarG9.ts`.

## Not done here

- The five topics with no hub lesson, and the hub change that would give them one.
- Grade 10 grammar; Grade 9 reading comprehension.
- Signing off any unit: that is the teacher's, from the printed form.
