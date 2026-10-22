# English corner: grammar activities for Grade 4 — design

**Status:** implemented (PR #1171; where the build differs from what was first written, the text below says how). **Scope:** Grade 4 English **grammar** only, on the 9 Grade 4
hub lessons (`kbl-g4-eng-s{1,2}-nccd-u*_l1`). Grade 4 reading is a separate spec that follows this one.
Builds on Grade 1 grammar (PR #1088), Grade 2 (`2026-10-19-english-corner-grammar-g2-design.md`,
PR #1158), Grade 3 (`2026-10-21-english-corner-grammar-g3-design.md`, PR #1171) and the engine they share,
`lib/curriculum/src/englishGrammar.ts`.

## Why

Grades 1–3 have grammar activities (Choose the word, Build the sentence, True or false, Yes or No), hidden
until a teacher signs each unit off. Grade 4 has none. Its book is different in kind again: the grammar is
**comparison** (higher than, the deepest, more exciting than), **modals** (must / mustn't, can / can't),
**adverbs of manner**, and the whole **past simple** (to be, regular verbs, irregular verbs). A picture
cannot show a tense or a comparison, and only 44 of the 172 hub words have a picture.

## What the hub holds

9 lessons: S1 U1–U5 and S2 U7–U10. S2 U6 «Hello from Hamed!» is a revision unit with no word list, so it
is not a hub lesson and has no grammar here; the teacher's form says so (as for Grade 3's S1 U1 and S2 U6).
Source of the book grammar: the unit-level objectives in `lib/curriculum/src/data/iqra_curriculum_g4_english_sem{1,2}.json`.

| Lesson | Book grammar | Pictured words |
| --- | --- | --- |
| S1 U1 «New Neighbours» | to be and like; «Where are you from? I'm from Jordan. I'm Jordanian.» | 6 of 20 (countries) |
| S1 U2 «New School» | present simple with days and times; adverbs of frequency | 0 |
| S1 U3 «Picnic Time!» | there is / are, countable and uncountable; a lot of, a little, any | 8 of 20 |
| S1 U4 «Along the River» | comparatives and superlatives, short and long adjectives | 5 of 20 (places; not used for comparing) |
| S1 U5 «All About Jobs» | present continuous; must / mustn't | 8 of 19 (jobs) |
| S2 U7 «Hobbies» | can / can't; adverbs of manner | 0 |
| S2 U8 «Our Town» | past simple of to be; there was / were | 9 of 20 (places) |
| S2 U9 «Our History» | past simple, regular verbs; didn't; «Did you…?» | 1 of 20 |
| S2 U10 «Let's Celebrate!» | past simple, irregular verbs | 7 of 12 |

## Decisions taken (and why)

1. **All 9 lessons, pictures only where honest** (chosen in conversation, 2026-10-22). The Grade 3 rule
   carries over: a picture appears only where it shows what the sentence says. Countries, foods and jobs
   (S1 U1, U3, U5) keep their pictures. Tenses, comparisons, hobbies and school (S1 U2, U4, S2 U7, U9,
   U10) get **Choose the word and Build the sentence with no pictures**. S2 U8's places are pictured, but
   a picture of a museum does not say «was», so it gets pictures only for there was / wasn't, with the
   hint «✅ = it was there». Alternatives considered: only the five lessons a picture can show (drops
   comparatives, can / can't and the whole past simple, the heart of Grade 4), and curated emoji for
   verbs and adjectives (needs a teacher's review of each new picture; the biggest build).
2. **True or false and Yes or No on picture-free lessons: only S1 U4, from a written ranking list**
   (chosen in conversation). Other picture-free lessons get Choose and Build only. Rejected: world facts
   across tenses («Did people in the past use plastic?»), since each is a claim a teacher must check and
   tense facts are easy to get subtly wrong.
3. **Adjective and past-tense forms by explicit table, not rules alone.** The adjective table writes both
   forms for every adjective it compares (the 11 of S1 U4); the past rule (+ed, +d after e, doubling only by override) is
   tested against every Grade 4 verb, and irregular verbs are explicit rows. Rules guess `quieter` against
   `more quiet` wrongly; a table is checked once by a teacher.
4. **A Choose option is always a real form, never a made-up word:** the comparative against the base
   adjective («higher» / «high», «more exciting» / «exciting»), the superlative against the comparative
   («the deepest» / «the deeper»), the past against the base («used» / «use»), and after didn't the base
   against the past. Rejected: «excitinger» / «more high», which teach by showing the error.
5. **Build the sentence keeps its cap of 9 tiles** (Grade 3 and up). A longer question-and-answer pair
   builds its answer half, the question printed and spoken above. A sentence over the cap with no question
   half is a test failure. Measured on the drafted sentences, only «There's a lot of salad and a little
   lemonade.» is near it, at 9 words, which fits.
6. **Slot words may come from this lesson, an earlier Grade 4 lesson, or any earlier grade** (the Grade 3
   rule extended). Words in no hub list (`plastic`, a stream, the days' times) live in the pattern's rows,
   where the teacher can check them.
7. **Every unit ships `reviewedBy: null`.** Nobody sees any Grade 4 grammar until the audio is recorded and
   a Grade 4 English teacher signs that unit's page of a printed form.
8. **Not in this spec:** Grade 4 reading (the next spec); ordinal numbers first to thirty-first and dates
   beyond S1 U2's examples (the book gives no sentence frame for them, so they are number words, not
   sentences); S2 U6; new pictures.

## Engine changes (all additive: the Grade 1–3 sheets and forms must stay byte-identical)

1. **Comparative and superlative: `{cmp:slot}` and `{sup:slot}`**, read from an explicit
   `ADJECTIVE_FORMS` table that writes both forms of the 11 adjectives S1 U4 compares: high / higher /
   highest, deep / deeper / deepest, wide / wider / widest; and for the long adjectives (beautiful, boring,
   colourful, dangerous, delicious, difficult, exciting, interesting) «more» / «most» plus the word, as two
   tiles. S2 U8's adjectives (busy, cheap, noisy, quiet, safe…) are only used in the positive («There was an
   expensive shop.»), so they are not in the table. A test asserts every adjective a Grade 4 pattern
   compares is in the table.
2. **Past: `{ed:slot}`.** +ed; +d after e (`arrive` → `arrived`, `live` → `lived`, `use` → `used`);
   consonant + y → -ied; doubling only by override (`stop` → `stopped`). Irregular verbs (`wore`, `saw`,
   `got`, and the other irregulars the book's S2 U10 examples use) are an explicit `PAST_OVERRIDES` table;
   a test checks every Grade 4 verb's past. The verb is the first word of the slot value, as for `{3:}`.
3. **A generalised form Choose: `{ kind: 'form', slot, wrong }`** with `wrong` one of `base`, `past`,
   `comparative` (`positive` is the same as `base` for an adjective). The right option is what the text realises; the wrong option is the same slot
   in the named form. It may blank a span of more than one token («more exciting»). The existing
   third-person form Choose is the same kind with `wrong: 'base'`, and Grade 3's output must not change.
   A test asserts that for every Grade 4 sentence the right and wrong options differ and that the rest of
   the sentence is identical.
4. **Picture-free fact items (S1 U4 only).** True or false and Yes or No need a picture today. A
   **ranking row** (a small thing, a big thing, an adjective) gives:
   - a true sentence, «The mountain is higher than the hill.» (the definite article, so `a` / `an` never
     needs capitalising at the start of a sentence);
   - its swapped false twin, «The hill is higher than the mountain.»;
   - a question, «Is the mountain higher than the hill?», with its answer, and the swapped question with
     the opposite answer.

   The sentence gets a `claim` (the swapped text) and a picture-free `fact` yes-no. `unitSentences` stops
   requiring a picture for these two; `buildTrueFalseRound` and `buildYesNoRound` draw them, and the two
   screens hide the picture area when an item has none. The false twin is voiced (it is heard), so
   `allGrammarSpoken` lists it.
5. **A past-tense hint** for a `marker` Yes or No and True or false: `hint: 'was'`, shown as «✅ = it was
   there» (Arabic «✅ = كان موجودًا، ❌ = لم يكن موجودًا»), alongside the existing `'likes'` and `'there'`.
6. **Slot sources** extended as in decision 6; the unit's `slots` comment and the slot-word test name the
   rule.

## Per-lesson design

Counts are not fixed in this spec: the plan measures each lesson and a test pins the number, as for
Grades 2 and 3. A pattern's sentences come from its `rows` where the combination must be controlled.

| Lesson | Patterns (slot sources) | Activities |
| --- | --- | --- |
| S1 U1 | «I'm from {country}.», «He's / She's from {country}.» (pictured: the six countries; the picture is the country's flag); «Where are you from? I'm from {country}.» (builds the answer half); «I'm {nationality}.» from six country ↔ nationality rows, pictured by the country; «I like {act}.», «He likes {act}.» (likes / like). Acts: the eight activity phrases of the lesson | Choose, Build; True or false and Yes or No on the flag sentences |
| S1 U2 | «We have {subject} on {day}s at {time} o'clock.» as rows (subject, day, time; arbitrary, the form says so); «I {freq} {v:act}.» and «He {freq} {3:act}.» (always, never, often, sometimes); «He {3:act} {when}.» (every day, at the weekend, once / twice / three times a week). Acts: the sports and hobby phrases of earlier grades. Choose on / at and plays / play | Choose, Build |
| S1 U3 | «There's a lot of {unc}.», «There are a lot of {pl}.», «There's a little {unc}.», «There isn't any {unc}.», «There aren't any {pl}.», «Are there any {pl}? Yes, there are. / No, there aren't.» The twelve foods are classed in a written list: plural countable (cupcakes, noodles, olives, sandwiches, vegetables), uncountable (cereal, fruit, salad, coffee, lemonade, tea) and `milkshake`, a singular countable left out of the quantity patterns (listed on the form). Containers: «a bowl of salad», «a cup of tea» as explicit rows. Pictured: the eight pictured foods | Choose (a lot of / a little, is / are, any), Build; True or false and Yes or No with the hint «✅ = it's there», on there is / isn't only |
| S1 U4 | «The {big} is {cmp:adj} than the {small}.» as ranking rows; «{Activity} is {cmp:adj} than {activity}.» for the long adjectives; «This is the {sup:adj} {place} in {…}.» and «{City} is the {sup:adj} city in the world.» as written rows. Choose comparative / base, superlative / comparative | Choose, Build; True or false and Yes or No from the ranking rows only (decision 2) |
| S1 U5 | «He's / She's a {job}.» (eight pictured jobs, the picture shows the job); «You {modal} {v:rule}.» from eight written rule rows, e.g. «You mustn't drop litter.», so a wrong rule cannot be generated; present continuous with clothes and colours of earlier grades: «I'm wearing a {colour} {clothes}.», «They aren't wearing…», «Are you wearing a green coat? Yes, I am. / No, I'm not.» (pictured where the clothes word is) | Choose (must / mustn't, am / are), Build; True or false on the job and clothes pictures |
| S2 U7 | «I can {v:act}.», «I can't {v:act}.», «Can you {v:act}? Yes, I can. / No, I can't.»; «She can {v:act} {adv}.» as eight rows, one per adverb, chosen so the sentence is plausible (the teacher checks each); Choose can / can't and well / good | Choose, Build |
| S2 U8 | «She was at the {place} {when}.» (last week, yesterday morning); «Where were you yesterday morning? I was at the {place}.» (answer half); «There was a {place}.», «There were two {places}.», «Was there a {place}? Yes, there was. / No, there wasn't.»; adjectives of the lesson: «The shop was {adj}.» Choose was / were. Pictured: the nine place words | Choose, Build; True or false on the pictured places, there was / wasn't, hint «✅ = it was there» |
| S2 U9 | «People in the past {ed:v} {material}.»; «They didn't {v:v} {material}.»; «Did you visit the {place}? Yes, I did. / No, I didn't.» (answer half). Verbs: arrive, live, need, start, stop, use, visit, work; materials: clay, iron, stone, coins, plastic (the last in rows). Choose used / use, and use / used after didn't | Choose, Build |
| S2 U10 | «I wore this {thing} at our wedding.», «We didn't see the {thing} again.», «Did you get any presents? Yes, I did. / No, I didn't.» (answer half). Irregular verbs as explicit rows | Choose, Build |

## Where it lives

- **`lib/curriculum/src/englishGrammar.ts`:** the engine additions above; `ADJECTIVE_FORMS` and
  `PAST_OVERRIDES` live here or beside the data (as `PLURAL_OVERRIDES`).
- **`lib/curriculum/src/englishGrammarG4.ts` (new):** `GRAMMAR_UNITS_G4` (9 units) and `NOT_COVERED_G4`,
  imported into `GRAMMAR_UNITS`. Imports only types from the engine, as `englishGrammarG3.ts` does.
- **`lib/curriculum/src/englishGrammarReview.ts` and `scripts/grammar-sheet.ts`:** a Grade 4 form and
  sheet (`docs/english-grammar-g4-review.html`, `-sheet.md`), with a **data page** at the front that
  prints the adjective table, the ranking pairs, the countable / uncountable list, the rule rows, the
  nationalities, the irregular past verbs and the timetable rows. The Build half is shown under a
  sentence, as in Grade 3.
- **`artifacts/mobile/services/englishHub/games.ts`:** `buildTrueFalseRound` and `buildYesNoRound` accept
  a picture-free item; `TrueFalseQuestion` carries the sentence text to show.
- **`artifacts/mobile/components/englishHub/GrammarActivities.tsx`:** the True or false and Yes or No
  screens hide the picture area when an item has none; the `'was'` hint.
- **`artifacts/mobile/services/i18n.ts`:** the `'was'` hint, Arabic and English.
- **STATUS.md** index line and the top of `docs/status-log.md`: a «Grade 4 grammar in the English corner»
  section with the switch-on steps.

No server, schema or migration change. Progress stays on the device, keyed by lesson and activity.

## Tests

In `lib/curriculum/src/__tests__/englishGrammarG4.test.ts` and the engine test:

- Every Grade 4 hub lesson has a unit, every unit ships `reviewedBy: null`, and `offeredGrammar` is
  `null` for each.
- Per-lesson sentence counts, pinned once built.
- **Every sentence is buildable** (a whole sentence of 2–9 tiles, or an answer half with its prompt).
- **Slot words** come only from this lesson, an earlier Grade 4 lesson or an earlier grade, except the
  named row-only words.
- **Forms:** every adjective a pattern uses is in `ADJECTIVE_FORMS`; every Grade 4 verb's past equals the
  rule or an override; for every form Choose the right and wrong options differ and the rest of the
  sentence is identical.
- **Rankings:** the swapped twin of a ranking row is never itself a ranking row; every picture-free item
  has an answer; no other lesson has a picture-free fact item.
- The Grade 1, 2 and 3 sheets, forms and the three reading forms equal their generators and are unchanged.
- The committed Grade 4 form and sheet equal the generators; the form lists the data page items and a
  not-covered block for each lesson with a gap. S2 U6 is not a hub lesson, so the form's intro, not a unit
  page, says it is not covered. The data page is built in `englishGrammarReview.ts` from the units' own
  rows (a value import of the engine's tables into the data file would be circular).
- In the mobile suite: round builders on the new item types, a picture-free True or false round and Yes
  or No round, the `'was'` hint, and every sentence (false twins included) in `allGrammarSpoken()`.

The screens are checked in a browser at 390 px in Arabic and English with units signed off in the working
tree only (restored straight after, never committed): a pictured lesson, a picture-free Choose and Build, a
picture-free True or false and Yes or No on S1 U4, the `'was'` hint on S2 U8, no horizontal scroll, an
unsigned unit showing nothing.

## Open points for the teacher (printed on the form)

1. Is every ranking pair on S1 U4 plainly true, and is each adjective used in the way the book uses it?
2. Do the comparative and superlative Choose options (comparative against the base, superlative against
   the comparative) test what the book teaches?
3. Is the countable / uncountable list right, and is it right to leave `milkshake` out of the quantity
   patterns?
4. Are the eight must / mustn't rules the ones the book means?
5. Does «✅ = it was there» read clearly on S2 U8, and are the plausible-adverb rows on S2 U7 plausible?
6. Is building only the answer half of a question-and-answer pair acceptable at Grade 4?

## Switching a unit on

Record the audio (`english-audio`, which now also voices the Grade 4 sentences, the Build prompts and the
false twins; needs OpenAI and R2 keys); a Grade 4 English teacher signs that unit's page of
`docs/english-grammar-g4-review.html`, printed; then its `reviewedBy` is set in `englishGrammarG4.ts`.

## Not done here

- Grade 4 reading (the next spec), ordinal numbers, dates and times beyond S1 U2's examples, S2 U6, new
  pictures.
- Signing off any unit: that is the teachers' job, from the printed form.
