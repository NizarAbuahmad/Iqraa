# English corner: Grade 9 grammar pilot (Unit 4) — design

**Status:** implemented (PR #1171; where the build differs from what was first written, the text says how). **Scope:** Grade 9 English **grammar**, **one unit only**: S1 U4
«A good buy», on its two grammar hub lessons (`kbl-g9-eng-s1-nccd-u4_l1` comparatives and
superlatives, `kbl-g9-eng-s1-nccd-u4_l3` quantifiers). The other nine Grade 9 units, Grade 10, and
reading comprehension are separate specs that follow once this pilot has shown the content model works.
Builds on Grades 1–4 grammar (PRs #1088, #1158, #1171) and the engine they share,
`lib/curriculum/src/englishGrammar.ts`.

## Why

Grades 1–4 have grammar activities (Choose the word, Build the sentence, True or false, Yes or No),
hidden until a teacher signs each unit off. Grade 9 has none. Its book is different in kind: 394 words in 36
hub lessons, only 5 with a picture, and about 19 grammar topics across ten units (tenses, modals,
conditionals, the passive, reported speech). A Grade 9 point such as «present simple or continuous?» needs
a written context, so its sentences are **authored**, not generated from a slot list, and every one is a
claim a teacher must check. That is a heavier review than Grades 1–4, so this spec proves the model on one
unit before the rest are designed. Unit 4 is the right pilot because its two topics (comparatives and
superlatives, quantifiers) reuse pieces Grade 4 already built (`{cmp:}`, `{sup:}`, the form Choose, the
picture-free `claim`).

## What the hub holds

The hub's Grade 9 lessons come from the book's own lesson list, with the words the book prints on each
lesson page: the book's «Grammar» (quantifiers) page prints shopping words, and a lesson's title is not
a guide to its grammar. So grammar attaches to a hub lesson **by id**, never by title.

| Hub lesson | Book topic | Hub words |
| --- | --- | --- |
| `…s1-nccd-u4_l1` «Vocabulary and Grammar» | comparatives and superlatives | 8 adjectives: cheap, expensive, fattening, filling, healthy, nutritious, popular, tasty |
| `…s1-nccd-u4_l2` «Vocabulary: Food and drink» | (no grammar of its own) | 36 words: croissant, doughnut, grapes, honey, jam… |
| `…s1-nccd-u4_l3` «Grammar» | quantifiers | 10 shopping words: chain store, checkout, customer… |
| `…s1-nccd-u4_l4` «Reading and Vocabulary» | (reading) | 14 clothes words |

The book's JSON has the objectives only («I can use comparatives and superlatives to compare things»),
with no example sentences to anchor on, so every sentence below is authored.

## Decisions taken (and why)

1. **One unit first** (chosen in conversation, 2026-10-23). Alternatives considered: all ten units' grammar
   in one spec (a very large authored set, hundreds of items, for a teacher to check before anything can be
   switched on); reading comprehension first (needs the book's passages in the repo and a new design); and
   better word practice for Grades 9–10 (no new content model, and not what the book's objectives centre
   on).
2. **Authored rows through the existing engine.** A sentence is a frame plus a written row (the Grade 4
   pattern), not free text and not a generator. The comparative comes from the explicit
   `ADJECTIVE_FORMS` table, so a form is checked once. Rejected: a rule-based comparative, which guesses
   `healthier` against `more healthy` wrongly.
3. **No pictures.** A food does not show «healthier». Pictures stay out; the foods are named in text.
4. **True or false and Yes or No only from a written ranking list**, as in Grade 4's S1 U4 (the same
   picture-free `claim` and `fact` mechanism). A pair is only used when it is plainly true; opinion
   comparisons («Pancakes are tastier than porridge.») are Choose and Build only and are never judged.
5. **A Choose option is always a real form**, never a made-up word: the comparative against the base
   adjective («healthier» / «healthy»), the superlative against the comparative («the cheapest» /
   «the cheaper»), and «many» against «much» decided by the noun.
6. **Build the sentence keeps its cap of 9 tiles.** Measured on the drafted sentences: the longest are the
   Yes or No pairs («Are croissants more fattening than melons? No, they aren't.», 9 words) and
   «Salmon is the most expensive dish on the menu.» (9), so no Grade 9 cap change is needed. A longer
   question-and-answer pair would still build its answer half, and a sentence that fits neither way is a
   test failure.
7. **Slot words come from this lesson, an earlier lesson of Grade 9, or any earlier grade**, as in Grade 4.
   Food words come from the unit's food lesson and Grades 1–4; plurals are formed by `{s:}` from the singular
   hub word (`mushroom` → `mushrooms`). Row-only free text (the comparison sentences' capitalised foods, the
   quantity rows) lives in the pattern's rows, where the teacher can check it.
8. **Every unit ships `reviewedBy: null`.** Nobody sees any of it until the audio is recorded and a
   Grade 9 English teacher signs the unit's pages of a printed form. Same gate as every other grade.
9. **Not in this spec:** the other nine units, Grade 10, reading comprehension, and the quantifiers
   «some», «any», «enough» (the pilot takes the four most common: many, much, a few, a little, with
   «too many / too much»; the book's objective names quantifiers without listing them). A topic added later is an addition to the same
   data, not an engine change.

## Engine changes (all additive: the Grade 1–4 sheets and forms must stay byte-identical)

1. **Eight `ADJECTIVE_FORMS` entries** for the lesson's adjectives:

   | Adjective | Comparative | Superlative |
   | --- | --- | --- |
   | cheap | cheaper | cheapest |
   | healthy | healthier | healthiest |
   | tasty | tastier | tastiest |
   | expensive | more expensive | most expensive |
   | fattening | more fattening | most fattening |
   | filling | more filling | most filling |
   | nutritious | more nutritious | most nutritious |
   | popular | more popular | most popular |

2. **Grade 9 units join `GRAMMAR_UNITS`**, from a new `englishGrammarG9.ts`. Nothing else in the engine
   changes: the form Choose, the `claim`, the picture-free `fact` Yes or No, the fixed-phrase Choose and
   `{s:}` already exist. `unitSentences` already reads the lesson's grade from the hub, and `buildCap(9)`
   is already 9.
3. **The form and sheet** gain a Grade 9 copy and a data page (the Grade 4 data page, with Grade 9's
   tables); `grammar-sheet.ts` writes `docs/english-grammar-g9-review.html` and `-sheet.md`.

## Per-lesson design

Counts are designed from the drafted rows; a test pins each once built, as in Grades 2–4.

### `u4_l1`: comparatives and superlatives (about 42 sentences)

**Ranking rows** (plainly true; the first food is the healthier, more fattening, more nutritious, more
expensive, cheaper or more filling). Both foods in a row are the same kind (both plural or both
uncountable), so «is» and «are» stay right when the pair is swapped for its false twin:

| Adjective | True sentence |
| --- | --- |
| healthy | Carrots are healthier than doughnuts. |
| healthy | Cucumbers are healthier than muffins. |
| fattening | Doughnuts are more fattening than cucumbers. |
| fattening | Croissants are more fattening than melons. |
| nutritious | Carrots are more nutritious than croissants. |
| expensive | Salmon is more expensive than bread. |
| expensive | Honey is more expensive than sugar. |
| cheap | Bread is cheaper than salmon. |
| cheap | Sugar is cheaper than honey. |
| filling | Porridge is more filling than water. |

| Pattern | Sentences | Activities |
| --- | --- | --- |
| «{Foods} {be} {cmp:adj} than {foods}.» from the 10 ranking rows | 10 | Choose (comparative / base), Build, True or false (the swapped twin is the false item) |
| «Is {food} {cmp:adj} than {food}? Yes, it is.» / «Are {foods} {cmp:adj} than {foods}? Yes, they are.» | 10 | Yes or No (fact, no picture) |
| the same with the swapped row, «No, it isn't.» / «No, they aren't.» | 10 | Yes or No (fact, no picture) |
| «{Food} {be} the {sup:adj} {thing} {where}.» (written rows, e.g. «Salmon is the most expensive dish on the menu.») | 6 | Choose (superlative / comparative), Build |
| opinion comparisons («Pancakes are tastier than porridge.») | 6 | Choose, Build; never judged |

The number-matched yes / no answers are separate patterns for the plural and uncountable rows.

### `u4_l3`: quantifiers (about 80 sentences)

**Hand-classed foods:** countable plurals `grapes`, `olive`, `mushroom`, `pancake`, `doughnut`, `croissant`,
`muffin`, `carrots` (formed with `{s:}`); uncountable `cream`, `honey`, `jam`, `salt`, `sugar`, `porridge`,
`milk`, `rice`. Five patterns per class, each decided by the noun, with no picture:

| Pattern (plural / uncountable) | Choose |
| --- | --- |
| «How many {foods} are there?» / «How much {food} is there?» | many / much |
| «There aren't many {foods}.» / «There isn't much {food}.» | many / much |
| «There are too many {foods}.» / «There's too much {food}.» | many / much |
| «Are there many {foods}?» / «Is there much {food}?» | many / much |
| «I'd like a few {foods}, please.» / «I'd like a little {food}, please.» | a few / a little |

Only the Grade 9 food classes and the patterns above are new data. Built: 42 sentences on `u4_l1`, 80 on
`u4_l3`, 122 in all (pinned in `englishGrammarG9.test.ts`).

## Where it lives

- **`lib/curriculum/src/englishGrammar.ts`:** the eight `ADJECTIVE_FORMS` entries; `GRAMMAR_UNITS` gains
  `GRAMMAR_UNITS_G9`.
- **`lib/curriculum/src/englishGrammarG9.ts` (new):** `GRAMMAR_UNITS_G9` (2 units) and `NOT_COVERED_G9`.
  Imports only types from the engine, as the other grade files do.
- **`lib/curriculum/src/englishGrammarReview.ts` and `scripts/grammar-sheet.ts`:** the Grade 9 form and
  sheet with a data page of the tables a teacher checks.
- **`artifacts/mobile`:** expected **no change**: the Grade 9 hub lessons already show their grammar cards
  through `offeredGrammar`, and the picture-free True or false and Yes or No screens exist. This is
  verified, not assumed: a mobile builder test and a browser check.
- **STATUS.md** index line and the top of `docs/status-log.md`: a «Grade 9 grammar pilot (Unit 4)» section
  with the switch-on steps.

No server, schema or migration change. Progress stays on the device, keyed by lesson and activity.

## Tests

In `lib/curriculum/src/__tests__/englishGrammarG9.test.ts`:

- Both units exist for the two lessons and ship `reviewedBy: null`; `offeredGrammar` is `null` for each.
- Per-lesson sentence counts and the total, pinned once built; every sentence is buildable within 9 tiles
  (or as an answer half with its prompt).
- **Forms:** every adjective a pattern compares is in `ADJECTIVE_FORMS` with the forms in the table; every
  form Choose offers two different real forms; every quantifier Choose offers «many / much» or «a few /
  a little» matching the noun's class.
- **Rankings:** the swapped twin of a true row is never itself a true row; both foods of a row share a
  class, so the verb still agrees in the twin; the opinion rows carry no claim.
- **Classes:** every food is in exactly one class; every slot word comes from this lesson, an earlier
  Grade 9 lesson or an earlier grade; no unit prints one sentence twice.
- The Grade 1–4 grammar sheets and forms and the four reading forms equal their generators and are unchanged;
  the committed Grade 9 form and sheet equal theirs.

In the mobile suite: round builders on the two lessons, a picture-free True or false round (true sentence or
swapped twin, half true) and Yes or No round (half yes), the activity matrix (`u4_l1`: Choose, Build, True or
false, Yes or No; `u4_l3`: Choose and Build), and every sentence, prompt and false twin in `allGrammarSpoken()`.

The screens are checked in a browser at 390 px in Arabic and English with the two units signed off in the
working tree only (restored straight after, never committed): both lessons' cards, a comparison True or false
and Yes or No with no picture, a quantifier Choose, no horizontal scroll, an unsigned lesson showing nothing.

## Open points for the teacher (printed on the form)

1. Is every ranking pair plainly true, and is each adjective used the way the book uses it?
2. Do the Choose options test what the book teaches («healthier» / «healthy», «many» / «much»)?
3. Is the food classification right (countable or uncountable)?
4. Are sentences with no context («How many grapes are there?») acceptable at Grade 9, or should each sit in a
   short written scene? (This decides whether the other nine units follow the same model.)
5. Are the opinion comparisons suitable as practice sentences that are never judged?

## Switching a unit on

Record the audio (`english-audio` voices the new sentences, Build prompts and false twins; needs OpenAI and R2
keys); a Grade 9 English teacher signs the unit's pages of `docs/english-grammar-g9-review.html`, printed, and
its data page; then each lesson's `reviewedBy` is set in `englishGrammarG9.ts`.

## Not done here

- The other nine Grade 9 units, Grade 10, reading comprehension, other quantifiers, and any picture.
- Signing off any unit: that is the teachers' job, from the printed form.
