# English corner: grammar activities for Grade 3 — design

**Status:** design approved in conversation (2026-10-21), awaiting review of
this written spec. **Scope:** Grade 3 English **grammar** only, on the 8 Grade 3
hub lessons (`kbl-g3-eng-s{1,2}-nccd-u*_l1`). Grade 3 reading is a separate
spec that follows this one. Builds on Grade 1 grammar (PR #1088), Grade 2
grammar (`2026-10-19-english-corner-grammar-g2-design.md`, PR #1158) and the
engine they share, `lib/curriculum/src/englishGrammar.ts`.

## Why

Grades 1 and 2 have grammar activities (Choose the word, Build the sentence,
True or false, and Yes or No), hidden until a teacher signs each unit off. Grade
3 has none. Its book is different in kind: the patterns are mostly **verb forms**
(play / plays, have / has, go / goes, Is / Are) in routines, activities and
having things, and **three of the eight lessons have no pictured word at all**,
because their words are verbs and phrases. Grade 2's rule, «only what we can
picture», would drop those three.

## What the hub holds

8 lessons: S1 U2–U5 and S2 U7–U10. S1 U1 (this / these / that / those) and S2
U6 (habits) are book units with no vocabulary list, so they are not hub lessons
and have no grammar here; the teacher's form says so.

| Lesson | Book pattern | Pictured words |
| --- | --- | --- |
| S1 U2 «It's a happy day!» | present simple, daily routines | 0 |
| S1 U3 «Let's dress up!» | present continuous with clothes; our / your / their | 12 of 16 |
| S1 U4 «The activity centre» | present simple, third person | 0 |
| S1 U5 «I want to be a teacher!» | want to be; goes to work by… | 16 of 16 |
| S2 U7 «Fun on the farm» | present continuous, Yes / No questions | 10 of 16 (animals; the actions have none) |
| S2 U8 «Out in the forest» | have got, negative and Yes / No | 0 |
| S2 U9 «Look at the stars» | there is / are, affirmative and negative | 6 of 15 |
| S2 U10 «Animals are fun!» | can (ability); there is / are, Yes / No | 15 of 16 |

## Decisions taken (and why)

1. **All 8 lessons, pictures only where honest** (chosen in conversation,
   2026-10-21). Alternatives considered: only the picturable lessons (drops
   routines, activities and the forest), and adding curated emoji for verbs
   (needs a teacher's review of each new picture; the biggest build and not
   asked for). The picture set stays as it is.
2. **A picture appears only where it shows what the sentence says.** The engine
   already allows it: a pattern's `picture` is optional, Choose the word's
   `phrase` kind and Build the sentence need none, and the Choose screen shows
   no picture when there is none. So the picture-free lessons get **Choose the
   word and Build the sentence**; True or false and Yes or No only on lessons
   with pictures. In S2 U7 the animals are pictured but «brushing» is not, so
   U7 uses no pictures at all.
3. **Verb forms by rule plus exceptions**, as plurals already work
   (`PLURAL_FORMS`, `PLURAL_OVERRIDES`): the data holds base verbs and a pattern
   asks for the form it needs. Considered: writing every pair out (more data to
   mistype) and one pattern per verb (about 25 near-duplicates).
4. **Build the sentence caps at 9 tiles for Grade 3, and stays at 7 for Grades 1
   and 2.** A longer question-and-answer pair (e.g. «When do you go home? We go
   home in the afternoon.», 11 tokens) builds only its **answer half**; the
   question is printed above as the prompt and spoken. A sentence over the cap
   with no question half is a test failure, not a silent omission.
5. **Slot words may come from this lesson, an earlier Grade 3 lesson, or any
   Grade 1–2 lesson** (a child has already met them). Grade 3's hub has no
   colour lesson, and its sentences name colours. The ability verbs in S2 U10
   (swim, fly, jump, run, climb) are not hub words in any grade; they come from
   the book's own examples and live in the rows (below), where the teacher can
   check every one.
6. **Every unit ships `reviewedBy: null`.** Nobody sees any Grade 3 grammar
   until the audio is recorded and a Grade 3 English teacher signs that unit's
   page of a printed form. Same gate as Grades 1 and 2.
7. **Grade 3 reading is not in this spec**; it follows once this is built. Grade
   3 children can read, so Grade 1's first-sound activities matter less, and what
   reading should be at this level is a separate question for the user.

## Engine changes (all additive: the Grade 1 and 2 sheets and forms must stay byte-identical)

1. **Third-person verbs: `{3:slot}`.** Inflects the slot's verb: +s, +es after
   s / sh / ch / x / z / o, consonant+y → ies. Overrides: `has`, `goes`, `does`.
   The verb is normally the first word of the slot value; a phrase override
   covers the exception, «roller skate» → «roller skates». A test checks every
   Grade 3 verb's form.
2. **Present participle: `{ing:slot}`**, the same mechanism (brush → brushing,
   sweep → sweeping; drop a final e, double a final consonant only by override).
   Found while drafting S2 U7, which needs «Are they brushing the horses?».
3. **A verb-form Choose: `{ kind: 'form', slot }`.** Blanks the one token that
   differs between the third-person and the base realisation («plays» /
   «play», «watches» / «watch») and offers the other form. A test asserts
   exactly one token differs for every Grade 3 verb. Contrasts that are not a
   slot's verb (Are / Is, has / have, don't / doesn't) use the existing
   fixed-phrase Choose.
4. **Rows.** A pattern may list explicit rows of slot values instead of the
   cross-product, so «We have dinner in the evening» cannot become «…in the
   morning», and an animal's abilities are explicit facts. Optional; the
   cross-product stays the default.
5. **A third Yes or No kind: `fact`.** «Can penguins swim?» shows the penguin
   and the child answers from what they know. The truth is the row's, with no
   ✅/❌ beside the picture. «Is there a coconut?» keeps the `marker` kind, with a
   new hint line («✅ = it's there»). Every fact is written down and is on the
   teacher's form; none is computed.
6. **Build the sentence: a cap by grade and a `build` half.** A sentence gets a
   `build` field (tokens and text) that is the whole sentence, or, over the cap,
   its answer half. `isSentenceBuilt` and the Build screen use it; the screen
   prints the question above the tiles when only the answer is built. The cap
   comes from the sentence's lesson grade.
7. **Word-form fixes** the Grade 3 words need, with Grades 1 and 2 pinned
   unchanged: plural of -ch / -sh / -o words and a consonant+y word (`torches`,
   `mangoes`, `ice lollies`); plural-form words `glasses`, `sandals`,
   `trainers`, `pyjamas` (no «a glasses», no «glassess»); uncountables with no
   article: `shampoo`, `toothpaste`, `sunscreen`. (Measured: the current rule
   gives `mangos`, `ice lollys`, `torchs`, `glassess`, `a glasses`.)

## Per-lesson design

Counts are the designed number of sentences; a test pins each once built, as in
Grade 2. Roughly **326** sentences in all.

| Lesson | Patterns (slot sources) | Activities | Sentences |
| --- | --- | --- | --- |
| S1 U2 routine | «I {act}.», «We {act}.», «I don't {act}.» (don't / doesn't); «When do you {act}? We {act} in the {time}.» as rows, e.g. go home / afternoon (builds the answer half) | Choose, Build | 40 |
| S1 U3 clothes | «You're wearing {a:clothes}.», «They're wearing {a:clothes}.» (pictured: 7 of the 11; sandals, pyjamas, trainers, baseball cap have none); «Our / Your / Their {things} are {colour}.» as 12 rows (are / is) | Choose, Build, True or false | 34 |
| S1 U4 activities | «He / She {3:act}.» (plays / play), «He / She doesn't {act}.» (doesn't / don't), «Does he {act} on {day}? Yes, he does. / No, he doesn't.» as 16 rows | Choose, Build | 52 |
| S1 U5 jobs, transport | «I want to be {a:job}.»; «He / She goes to work by {transport}.» (goes / go, with the 👦 / 👧 marker) | Choose, Build, True or false | 22 |
| S2 U7 farm | «Are they {ing:act}? Yes, they are. / No, they aren't.»; «Is he / she {ing:act}? …» (Are / Is) | Choose, Build | 24 |
| S2 U8 forest | «I haven't got {a:thing}.», «He / She hasn't got…», «Have you got…? Yes, I have. / No, I haven't.», «Has he / she got…?» (have / has) | Choose, Build | 54 |
| S2 U9 furniture | «There's {a:item}.», «There isn't…», «There are {s:item}.», «There aren't any…», «Is there {a:item}? Yes, there is. / No, there isn't.» | Choose, Build, True or false, Yes or No (✅/❌ marker, pictured items) | 60 |
| S2 U10 animals, food | «Can {s:animal} {ability}? Yes, they can. / No, they can't.» as 16 fact rows (8 yes, 8 no); «Is there {a:food}? / Are there any {s:food}?» Yes / No (✅/❌ marker) | Choose, Build, Yes or No (`fact` and `marker`) | 40 |

- **Choose needs evidence in the sentence or picture.** «Our glasses are blue»
  has none for our / your / their, so the possessives are Build-only and their
  Choose is «are / is», which the plural noun answers.
- **Left out, with reasons on the form:** this / these / that / those (S1 U1) and
  S2 U6 (not hub lessons); days of the week and times of day as pictures (no
  honest single picture); prepositions of place in U9 (in front of, between,
  behind…), which an emoji cannot show; the unpictured clothes, activities and
  forest objects in the picture activities.

## Where it lives

- **`lib/curriculum/src/englishGrammarG3.ts`** (new): `GRAMMAR_UNITS_G3` (8
  units, all `reviewedBy: null`) and `NOT_COVERED_G3`. `GRAMMAR_UNITS` becomes
  Grade 1 + 2 + 3. Imports only types from the engine, as `englishGrammarG2.ts`
  does.
- **`lib/curriculum/src/englishGrammar.ts`:** the seven engine changes.
- **`englishGrammarReview.ts`, `scripts/grammar-sheet.ts`:** a Grade 3 copy
  block; the script loops grades 1–3 and writes
  `docs/english-grammar-g3-sheet.md` and `-review.html`.
- **App:** `services/englishHub/games.ts` (the cap by grade, `build`, `fact`
  Yes or No), `components/englishHub/GrammarActivities.tsx` (the question
  prompt above the Build tiles, the «✅ = it's there» hint) and
  `services/i18n.ts`.
- **Audio script:** unchanged; it already voices `allGrammarSpoken()`, and
  Grades 1–4 use the young voice.
- **STATUS.md:** a «Grade 3 grammar in the English corner» section with the
  switch-on steps.

No server, schema or migration change.

## Tests

- **Engine** (`englishGrammarEngine.test.ts`): every Grade 3 verb's
  third-person and `-ing` form (`has`, `goes`, `does`, `watches`, `roller
  skates`, `brushing`, `sweeping`); the form-Choose blanks exactly one token;
  rows replace the cross-product; a `fact` Yes or No answers from its row; the
  new plural and article forms; `build` is the whole sentence or its answer
  half.
- **Grade 3 data** (`englishGrammarG3.test.ts`): 8 units for the 8 hub
  lessons; the sentence counts per lesson; slot words allowed by decision 5; no
  sentence over the cap unless it has a question half; a picture only on
  lessons the rule allows (none on S1 U2, U4, S2 U7, U8); every unit unsigned;
  the not-covered table has an entry for every lesson and only for them; the
  committed Grade 3 sheet and form equal the generator's output.
- **Mobile** (`englishGrammarG3Games.test.ts`): every round is well formed;
  True or false and Yes or No are offered only where pictures exist; a built
  answer half is judged against its own text; Grade 1 and 2 rounds are
  unchanged (cap still 7).
- **Byte-identical:** the Grade 1 and 2 grammar sheets and forms and both
  reading forms, and the Grade 1 and 2 grammar and reading tests, unchanged.
- **Browser, 390 px, Arabic and English,** with units signed off in the working
  tree only and the file restored immediately: a verb-form Choose on U4, a Build
  with the question printed above (U2) and a 9-tile Build, Yes or No `fact` on
  U10 and `marker` with the new hint on U9, and an unsigned unit showing nothing.

## Open points for the teacher (printed on the form)

1. The animal-ability facts: every row (e.g. penguin swim ✅, hippo jump ❌) is
   listed to check, and the verbs swim, fly, jump, run, climb are the book's own.
2. «✅ = it's there» for «Is there a…?».
3. Building only the answer half of the long question-and-answer pairs, with the
   question shown above.
4. The paired routine times (go home / afternoon, go to bed / night).
5. The third-person forms and the do / does, have / has contrasts, which are
   asked as «which word is right?».

## Switching a unit on

The audio is recorded (the pending `english-audio` run, which now covers Grade 3
too); a Grade 3 English teacher signs that unit's page of
`docs/english-grammar-g3-review.html`, printed; then its `reviewedBy` is set in
`englishGrammarG3.ts` and merged.

## Not done here

- Grade 3 reading (next spec); Grade 4.
- New pictures for verbs, times or days.
- Signing off any unit: that is the teacher's, from the printed form.
