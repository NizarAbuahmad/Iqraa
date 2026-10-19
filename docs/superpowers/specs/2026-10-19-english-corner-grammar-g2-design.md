# English corner: grammar activities for Grade 2 — design

**Status:** implemented (PR #1158). **Scope:** Grade 2 English **grammar** only. Grade 2 reading
is a separate, smaller spec that follows this one.

## Why

Grade 1 grammar shipped on 2026-10-16 (`2026-10-16-english-corner-grammar-g1-design.md`):
three activities, generated sentences, every unit hidden until a teacher signs
it off. Grade 2's book teaches the next step, and it is partly new in kind:
**short answers** («Is it a car? Yes, it is. / No, it isn't.», «Do you like
cheese? Yes, I do. / No, I don't.»), which Grade 1's book never teaches (the
Grade 1 spec says so and renames its third activity True or false for that
reason). The Grade 2 patterns live in the `objectives` of
`lib/curriculum/src/data/iqra_curriculum_g2_english_sem{1,2}.json`. Nothing in
the app practises them.

## Decisions taken (and why)

1. **Grammar first, reading after.** Grammar is the larger piece (new
   patterns, a new activity, a new review). Reading mostly reuses the Grade 1
   code and gets its own short spec.
2. **Only what we can picture.** Several Grade 2 patterns need pictures the
   corner does not have (in / on / under, chores, most body parts). They are
   left out and *listed on the teacher's form with the reason*, so nothing is
   missing silently. No new artwork.
3. **The three Grade 1 activities plus Yes or No.** Choose the word, Build the
   sentence and True or false carry over unchanged. **Yes or No** is new: it
   practises exactly what Grade 2 adds, the short answer.
4. **Extend the Grade 1 engine in place** rather than copy it. The engine, the
   per-unit `reviewedBy` switch, the lesson screen and the teacher's form are
   already keyed by lesson id. Grade 2 adds a data file, one optional pattern
   field and some table entries.
5. **Hidden until a teacher has reviewed it.** Every Grade 2 unit ships
   `reviewedBy: null`; the only switch is the unit's sign-off, as in Grade 1.
6. **Sentences are generated from patterns and the lesson's own words**, so the
   whole set is finite and listable, as decided for Grade 1.

## What the hub has, and what is covered

The hub has **9** Grade 2 lessons (`kbl-g2-eng-s{1,2}-nccd-u*_l1`): S1 U0–U4 and
S2 U5–U8. There is **no S2 U0** in the hub (the revision unit has no word list),
so unlike Grade 1 there is no revision unit to cover. Eight of the nine get
grammar; S1 U3 gets none. Counts are what the generator produces (measured on a
prototype against the existing engine, 2026-10-19).

| Lesson | Patterns covered | Sentences (pictured) | Not covered, and why |
|---|---|---|---|
| S1 U0 Welcome | *What colour is it? It's red.* · *How old are you? I'm seven.* | 16 (16) | *What's your name? My name's…* and *How many…?* have nothing to picture. Ages are five to ten only |
| S1 U1 Toys | *What's this? It's a car.* · **Yes or No** *Is it a car? Yes, it is.* | 26 (24) | swing and slide have no picture (swing is the book's own Yes/No example); *Can I play with it, please?* is a dialogue. action figure and building set appear only in Build the sentence |
| S1 U2 School | *This is my pen.* · *These are my books.* | 31 (15) | *Where's the pencil? It's in / on / under the desk*: an emoji cannot show «under»; *Can I borrow it, please?* |
| S1 U3 Body | none | 0 | face, toes, fingers, head, knees, tummy have no pictures; the pictured ones (arms, feet, hands, legs) repeat Grade 1; the actions (*Touch your head!*) have none |
| S1 U4 Family | *Who's this? It's my mum.* · *He's / She's got blue eyes.* | 10 (10) | uncle, aunt, brother, sister, cousin have no pictures; *His / Her name's…* |
| S2 U5 Animals | *What's this? It's a cat.* · *What are these? They're cats.* | 20 (20) | *It's got big teeth*: no picture for «big» |
| S2 U6 Food | *I like apples.* · *I don't like rice.* · **Yes or No** *Do you like cheese? Yes, I do. / No, I don't.* | 56 (56) | *…and / but / or…, too*: needs two pictures, and the two foods could swap places and both be right; bean, pea, pasta, meat have no pictures; **orange** is left out: its only picture is the colour 🟠 |
| S2 U7 Weather | *What's the weather like? It's sunny.* · *I'm wearing a coat.* | 17 (11) | *…a T-shirt and shorts*: needs two pictures |
| S2 U8 House | *Where's my dad? He's in the kitchen.* · *Where's my mum? She's in the kitchen.* | 36 (16) | *He's tidying up* and the other chores have no pictures; **balcony** is left out («on the balcony», not «in») |

212 sentences in all. «Not pictured» sentences appear in Build the sentence only,
as in Grade 1 (a word with no picture never appears in a picture item).

## The patterns, unit by unit

`{a:x}` takes a/an, `{s:x}` the plural, `{x}` the word as listed. A slot may
name only words of its own lesson or an **earlier lesson of the same grade**.

- **S1 U0:** `What colour is it? It's {colour}.` (the 10 colours, picture = the
  colour circle); `How old are you? I'm {n}.` (`n` = five … ten, picture = the
  number).
- **S1 U1:** `What's this? It's {a:toy}.` (14 toys; *an action figure*
  exercises the a/an rule, the unit's heart) and `Is it {a:toy}? Yes, it is.`
  (the 12 pictured toys; **Yes or No**, `match`).
- **S1 U2:** `This is my {one}.` (15 nouns incl. *pencil case*, one tile) and
  `These are my {s:many}.` (those 15 plus *scissors*, a plural-only word; two
  pictures, marker «many»).
- **S1 U4:** `Who's this? It's my {family}.` (mum, dad, grandad, granny; Choose =
  Who's / What's); `He's got {colour} eyes.` and `She's got {colour} eyes.`
  (blue, brown, green; marker 👦 / 👧; Choose = He's / She's).
- **S2 U5:** `What's this? It's {a:animal}.` and `What are these? They're
  {s:animal}.` (10 animals; Choose = the whole answer, as Grade 1 Unit 7).
- **S2 U6:** `I like {s:food}.` / `I don't like {s:food}.` (markers ✅ / ❌, the
  Grade 1 Unit 8 patterns) and `Do you like {s:food}? Yes, I do.` /
  `Do you like {s:food}? No, I don't.` (markers ✅ / ❌; **Yes or No**,
  `marker`). 14 foods.
- **S2 U7:** `What's the weather like? It's {weather}.` (9 words; foggy and
  stormy are Build-only) and `I'm wearing {a:garment}.` (8 garments; jumper,
  shorts, skirt, trousers are Build-only).
- **S2 U8:** `Where's my {m}? He's in the {room}.` (dad, grandad) and
  `Where's my {f}? She's in the {room}.` (mum, granny); 9 rooms, of which
  bathroom, bedroom, kitchen and house are pictured. Choose = He's / She's. Two
  patterns, not one, because the pronoun follows the person.

## The Yes or No activity

The fourth grammar activity (`grammar-yesno`), offered only on a unit whose
patterns declare `yesNo`: S1 U1 and S2 U6.

**What the child sees:** the picture (with its ✅ / ❌ where the pattern has
one); the question, printed large, left to right, with a listen button (not
read out before the child taps, as True or false); two buttons holding the
**full short answers**, «Yes, it is.» and «No, it isn't.» (the form is what
Grade 2 teaches, so bare ✓ / ✗ would not practise it), ✓ always on the left as in
True or false. After the tap: the correct answer in the feedback line, wrapped
in an LRI…PDI isolate so the full stop and apostrophe do not jump inside the
Arabic line; the whole exchange plays («Is it a car? Yes, it is.»); Next plays
the next question.

**Two kinds of item, declared by the pattern:**
- `match` (*Is it a car?*): the picture stays; a **Yes** item has the question
  name the pictured word, a **No** item names `falsePicture` (the next pictured
  word in the slot list, the rule True or false already uses), so no new data to
  review. 12 toys give 12 Yes and 12 No items.
- `marker` (*Do you like cheese?*): the sentence's own ✅ / ❌ is the truth.
  ✅ → «Yes, I do.», ❌ → «No, I don't.» A one-line hint under the picture says
  «✅ = the child likes it» (Arabic string `hubGYesNoLikes`).

**A round** is 8 items, half Yes (rounded up) and half No, shuffled; scored like
the rest (stars, badges, `lessonStars`, kept on the device). Offered when a unit
has at least 4 sentences with `yesNo` (`MIN_GRAMMAR_SENTENCES`).

**How it differs from True or false:** there the child judges a sentence that is
given; here the child answers a question by choosing the short-answer form, which
is the grammar being practised.

**The rule that keeps it from repeating the others:** a pattern with `yesNo`
produces **no Choose item and no True or false item** (`choose: null`,
`falsePicture: null`); Yes or No is its judging. It still gives Build the
sentence («Is it a car? Yes, it is.», 7 tokens).

## Engine changes

All in `lib/curriculum/src/englishGrammar.ts` unless stated.

- **Forms.** `PLURAL_OVERRIDES` (empty in Grade 1) gets `mouse → mice`,
  `fish → fish`, `potato → potatoes`, `tomato → tomatoes`, `shelf → shelves`.
  The «takes no article and no extra s» set gets the uncountable foods (rice,
  bread, cheese, chicken, juice, milk, water) and the words that are plural in
  form (eggs, scissors, shoes, shorts, trousers; boots, socks and the rest are
  already there); its comment is updated, since it no
  longer means «plural in form» alone. `ARTICLE_OVERRIDES` stays empty: no
  covered word needs one (a test pins *a T-shirt*, *an action figure*).
  `fish` is an animal in U5 and a food in U6; both senses take the same plural.
- **Pattern type.** `choose` becomes optional; a new optional
  `yesNo?: { kind: 'match' | 'marker'; question: string; yes: string; no: string }`.
  `GrammarSentence` gains
  `yesNo: { kind; question; yes; no; answer: boolean; otherQuestion: string | null } | null`
  (`otherQuestion` is the `match` kind's No question, built from `falsePicture`).
- **Slot rule.** The test «only words of its own lesson or an earlier Grade 1
  lesson» becomes «… of an earlier lesson **of the same grade**», and the one that
  says every unit is a Grade 1 lesson is scoped per grade.
- **Build tile cap stays 7** (`MAX_BUILD_TILES`). The longest Grade 2 sentences
  are exactly 7 tokens; the compound sentences that would need more are the ones
  left out. A test fails if a sentence over the cap is added, so none is dropped
  from the round silently.
- **New file `lib/curriculum/src/englishGrammarG2.ts`:** the Grade 2 units and the
  «not covered» table. It imports only *types* from the engine (no cycle).
  `GRAMMAR_UNITS` becomes Grade 1 followed by Grade 2; `unitGrade(unit)` reads
  the grade off the lesson.
- **Mobile.** `HubActivity` gains `'grammar-yesno'`; `GRAMMAR_ACTIVITIES`,
  `SCORED_ACTIVITIES` and the lesson screen's `META` get it;
  `services/englishHub/games.ts` gets `buildYesNoRound`, `isYesNoRight` and the
  availability case; `GrammarActivities.tsx` gets `YesNo`; `services/i18n.ts` gets
  `hubGYesNo`, `hubGYesNoDesc`, `hubGYesNoLikes` in Arabic and English. Old stored
  progress is unaffected (new key, tolerant parse).
- **Existing tests that iterate every unit** (`englishGrammar.test.ts`,
  `englishGrammarGames.test.ts`) assume Grade 1, for example «Unit 1 has no True
  or false». They are scoped to Grade 1, and Grade 2 gets its own.

## The teacher's forms, per grade

`renderGrammarSheet` and `renderGrammarReviewHtml` take a grade. Grade 2 adds
`docs/english-grammar-g2-sheet.md` and `docs/english-grammar-g2-review.html`
(A4 landscape, one unit per page, same layout as Grade 1), with:

- a Yes or No column: the question, its «Yes» answer, and the «No» variant (same
  picture, the other word's question);
- a **«not covered» block per unit** with the reasons above, and the left-out
  words (orange, balcony, swing, slide);
- an intro box describing four activities.

**The Grade 1 files must stay byte-identical.** Their tests already pin them; a
new check fails if the change moves a character. `grammar-sheet.ts` writes all
the committed files.

## Audio

Grammar sentences are already in the «young» voice set (every Grade 1–4 word),
so Grade 2 keeps that voice. Yes or No speaks two more kinds of string, the
**question alone** and the **whole exchange** («Is it a plane? No, it isn't.»).
A new `allGrammarSpoken()` lists every spoken string of every sentence;
`generate-english-audio.ts` walks it instead of `allGrammarSentences()`, so the
next voicing run covers them with no new step. The slug-collision test is
extended to these strings.

## Rollout

Every Grade 2 unit ships `reviewedBy: null`; nobody sees them. To switch a unit
on: voice its strings (`pnpm --filter @workspace/curriculum run english-audio`,
needs the OpenAI and R2 keys), a Grade 2 English teacher signs that unit's page
of `docs/english-grammar-g2-review.html`, then set its `reviewedBy` in
`englishGrammarG2.ts`. STATUS.md gets a section with these steps, and
CLAUDE.md's grammar notes are updated if any rule there changes.

## Tests

In `lib/curriculum`:
- every Grade 2 unit is a Grade 2 hub lesson; every slot word comes from its own
  or an earlier Grade 2 lesson; no sentence exceeds 7 tokens;
- every pictured word has a picture; every `falsePicture` is another word;
- forms: *mice, fish, potatoes, tomatoes, shelves, rice, scissors*;
  *a T-shirt*, *an action figure*;
- `orange` is not in U6's food slot, `balcony` not in U8's rooms;
- `yesNo`: a `match` Yes question names the picture word and the `otherQuestion`
  a different pictured word; a `marker` answer follows its marker; a pattern with
  `yesNo` yields no Choose and no `falsePicture`;
- the example sentences the book prints come out word for word (*What's this?
  It's an action figure.*, *Do you like cheese? Yes, I do.*);
- every Grade 2 unit is unsigned and `offeredGrammar` returns null for each;
- the committed Grade 1 and Grade 2 sheets and forms equal the generators; the
  Grade 1 ones are unchanged;
- every spoken string has its own recording key, shared with no word and no other
  string.

In `artifacts/mobile/services/__tests__/`, over every Grade 2 unit:
- Yes or No: half Yes and half No; a `match` question names the picture word
  exactly when the answer is Yes; a No question names a different, pictured word;
  a `marker` answer equals the marker; a unit with no `yesNo` pattern never gets
  the card;
- Choose / Build / True or false builders behave as in Grade 1 on Grade 2 data;
- `lessonStars` counts the new activity.

The Yes or No screen is checked in a browser at 390 px in Arabic and English with
two units signed off in the working tree only (never committed), as the Grade 1
screens were.

## Open points the teacher's form will raise

1. **Eye colour** is a coloured circle beside 👦 / 👧. A circle standing for an
   eye colour is a stretch; it is its own pattern, so dropping it is one line.
2. **Whose ✅?** In *Do you like cheese?* the child answers for the pictured ✅ /
   ❌; the hint line helps. If it is still unclear, the `marker` kind is dropped
   and Yes or No stays on *Is it a…?* only.
3. **Pictures that may mislead:** 🥵 / 🥶 for hot / cold are faces, not weather;
   🍳 stands for the kitchen; 👩 (mum) and 👵 (granny) look alike.
4. **Ages** in *How old are you?* are five to ten.

## Not done here

- Grade 2 **reading** (its own spec).
- Patterns that need new pictures (in / on / under, chores, body parts, two-item
  sentences), the compound *and / but / or* sentences, and the dialogue lines
  (*Can I borrow it, please?*).
- A fruit picture for «orange» (a change to the shared picture table).
- Signing off any unit: that is the teacher's, from the printed form.
