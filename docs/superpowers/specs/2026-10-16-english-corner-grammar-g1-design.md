# English corner: grammar activities for Grade 1 — design

**Status:** design approved in conversation (2026-10-16), awaiting review of this
written spec. **Scope:** Grade 1 English only, both semesters.

## Why

A Grade 1 English teacher reviewed the English corner (`/curriculum/english`)
on 2026-10-15 and asked for activities that target grammar, not only
vocabulary: «القواعد خصوصاً أكثر مهارة بحاجة لتثبيت عند الطلاب». Today the
corner's seven activities all drill single words (`services/englishHub/games.ts`).
Every Grade 1 "Vocabulary & Grammar" lesson already names its grammar target
in the curriculum data (`objectives` in
`lib/curriculum/src/data/iqra_curriculum_g1_english_sem{1,2}.json`), for example
«I've got … / I haven't got …» for Unit 2. Nothing in the app practises it.

## Decisions taken (and why)

1. **Grade 1 only first.** 9 units, small enough for the reviewing teacher to
   check every sentence. Grades 2–4 bring tenses and need their own patterns
   and review.
2. **Sentences are generated from patterns and the lesson's own words**
   (approach B), not hand-written per sentence and not model-written. The set
   of sentences is finite and listable, so a teacher can read all of it.
3. **Hidden until a teacher has reviewed it.** A unit's grammar activities are
   offered to nobody — pupil, visitor or teacher — until its data carries a
   reviewer's name and date.
4. **Three activities:** Choose the word, Build the sentence, True or false.
   *Correction to what was agreed in conversation:* the third was agreed as
   "Yes or No" with «Yes, it is. / No, it isn't.» answers, but Grade 1's book
   never teaches short answers (they arrive in Grade 2, Unit 1: «Is it a
   (swing)? Yes, it is.»). It becomes **True or false**: the unit's own
   sentence beside a picture, tap ✓ or ✗. Same yes/no decision for the child,
   Grade 1 grammar only.

## The patterns, unit by unit

The grammar target is the book's. A slot `{x}` takes only words tagged `x` in
that unit. Every picture is the corner's existing emoji (`wordPicture`); a word
with no picture can still appear in Build the sentence, never in a picture item.

| Unit | Book target | Patterns | Choose: the contrast blanked |
|---|---|---|---|
| S1 U1 Family and Friends | Who's this? This is (my) … | «Who's this? This is my {family}.» (mum, dad, brother, sister, friend — not "cat", which could be *what*) | **Who's / What's** (a person is *who*) |
| S1 U2 My School Bag | I've got … / I haven't got … | «I've got {a thing}.» «I haven't got {a thing}.» | **I've got / I haven't got**, decided by ✓/✗ on the picture |
| S1 U3 Our Classroom | What's this? It's a … / The book is on the chair. The pens are on the floor. | «What's this? It's {a thing}.» (chair, desk, door, wall, whiteboard, window) «The {object} is on the {place}.» «The {objects} are on the {place}.» (objects: the U2 school things, as the book's own example uses; places: chair, desk, floor) | **is / are** (one thing or several) |
| S1 U4 My Favourite Toy | I'm happy/sad. What's your favourite toy? It's my … | «I'm {feeling}.» «What's your favourite toy? It's my {toy}.» | the word the picture shows (😊/😢, the toy) |
| S2 U0 Welcome | This is (my) … / I've got … | U1 and U2 patterns over this lesson's words | as U1/U2 |
| S2 U5 My Body | He's got … / She's got … | «He's got two {pair}.» «She's got two {pair}.» | **He's / She's**, decided by 👦/👧 |
| S2 U6 My Blue Jacket | I'm wearing … / Where's my …? It's on the … | «I'm wearing {a garment}.» «Where's my {single garment}? It's on the {place}.» (single: dress, jacket, jumper, skirt, T-shirt — never boots, jeans, socks: «Where's my boots?» is wrong) | the garment the picture shows |
| S2 U7 They're Tigers! | What are these? They're … | «What are these? They're {animals}.» and, for contrast, «What's this? It's {an animal}.» | the whole answer, «It's a frog.» or «They're frogs.», decided by one or two animals in the picture. The question is not shown with the gap: it would give the answer away |
| S2 U8 I Like Cakes | I like … / I don't like … | «I like {food}.» «I don't like {food}.» | **like / don't like**, decided by ✓/✗ |

Semester 1 Unit 0 (numbers and colours) has no grammar line in the book and gets
no grammar activities. A slot may name words from its own lesson **or an earlier
Grade 1 lesson** (U3's objects are U2's school things; U6's places are U3's
chair, desk and floor), never a later one. The blank in Choose may take in the
subject («___ a pen.» → «I've got» / «I haven't got»), so no option is a
fragment like «'ve got».

## Data

Grammar data lives beside the hub's word lists in
`lib/curriculum/src/englishGrammar.ts` (new), one entry per lesson id:

```ts
{
  lessonId: 'kbl-g1-eng-s1-nccd-u2_l1',
  reviewedBy: null,            // { name, date } once a teacher signs it off
  patterns: [
    { id: 'have', text: "I've got {a thing}.",      choose: { blank: "I've got", other: "I haven't got" }, marker: 'yes' },
    { id: 'not',  text: "I haven't got {a thing}.", choose: { blank: "I haven't got", other: "I've got" }, marker: 'no' },
  ],
  slots: { thing: ['bag', 'book', 'crayon', 'eraser', 'pen', 'pencil', 'pencil case', 'ruler'] },
}
```

- **Tags are per lesson**, as slot lists naming vocabulary of this lesson or
  an earlier Grade 1 lesson. A test fails if a slot names any other word.
- **`{a x}` adds the article; `{x}` does not.** "a / an" is worked out from the
  first letter, with an explicit override list for exceptions (none in Grade 1;
  "an eraser" is the one vowel word). A word that is plural in form (boots,
  jeans, socks) takes no article: «I'm wearing boots.».
- **Plurals** are regular "+s" with an override field; Grade 1 needs no
  override (pens, books, frogs, monkeys…).
- **The picture** for an item comes from the slot word (`wordPicture`), plus a
  marker where the contrast needs one: ✓/✗ (U2, U8), 👦/👧 (U5), one or two of
  the animal (U7), the thing alone or twice (U3 is/are).

## The three activities

All three sit on the lesson screen (`app/curriculum/english/[lessonId].tsx`)
under a heading «القواعد» / «Grammar», after the vocabulary cards, and reuse the
corner's round of 8, 🔊 button, colours and finish card. The English is always
left to right; only instructions follow the UI language.

- **Choose the word.** Picture, the sentence with a gap, two option buttons
  (the right one and its contrast). 🔊 reads the full sentence after an answer.
- **Build the sentence.** The sentence as word tiles, shuffled, tap into order,
  tap a placed tile to send it back — the letter scramble's interaction with
  words. Punctuation stays on its word («pen.»), and "pencil case" stays one
  tile. A sentence over 7 tiles is not used.
- **True or false.** Picture and a sentence; half the round shows a matching
  picture, half a mismatching one from the same slot. Tap ✓ or ✗.

## Review gate and the teacher's sheet

- `reviewedBy: null` → the lesson offers none of the three cards. This is the
  only switch; there is no role or build flag.
- `pnpm --filter @workspace/curriculum run grammar-sheet` writes
  `docs/english-grammar-g1-sheet.md`: per unit, every sentence the generator
  can produce, with its picture and, for Choose, the wrong option it is shown
  beside. It is the complete set. (There is no Arabic line: sentences have no
  gloss, and the instructions are the corner's existing ones.)
- A test regenerates the sheet and fails if the committed one differs, so a
  reviewer's sign-off always refers to the text that ships.
- Signing off a unit is a data change: `reviewedBy: { name, date }`.

## Audio

Sentences go through `generate-english-audio.ts` in the young-learner voice,
keyed by the sentence's slug. Until voiced, web speaks the sentence with the
browser's voice (`wordSpeech.ts`) and native is silent. **A unit is switched on
only after its sentences are voiced** — the sign-off checklist in STATUS.md
says so; nothing enforces it in code.

## Scoring and progress

Scored like the other games (`starsFor`): 3/2/1 stars by accuracy, recorded
under the same `${lessonId}|${activity}` key, counted by `lessonStars` and the
badges. Device-only, as today. Nothing new reaches the server.

## Tests (`artifacts/mobile/services/__tests__` and `lib/curriculum/src/__tests__`)

- Every slot word exists in its lesson's vocabulary.
- Every generated sentence fills a slot only with that slot's words; a/an and
  plurals come out right for every Grade 1 word (pinned list).
- Every Choose item has exactly one right option, and the picture marker agrees
  with it.
- Build tiles re-join to the exact sentence; no sentence over 7 tiles.
- True or false: a matching item's picture is its own word's, a mismatching
  one's is another word of the same slot; both kinds occur in a round.
- `reviewedBy: null` → no grammar activity is offered for that lesson.
- The committed teacher's sheet equals a freshly generated one.

## Out of scope

Grades 2–4; reading passages; any report to the teacher; voicing the sentences
(needs the OpenAI and R2 keys, as for words).
