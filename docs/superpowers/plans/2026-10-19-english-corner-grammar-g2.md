# English corner: Grade 2 grammar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grade 2 grammar practice in the English corner: 212 generated sentences over 8 lessons, the three Grade 1 activities plus a new **Yes or No**, every unit hidden until a teacher signs it off.

**Architecture:** The Grade 1 engine (`lib/curriculum/src/englishGrammar.ts`) is extended in place: optional `choose`, a `yesNo` pattern field, filled-in plural/article tables, and grade-aware helpers. Grade 2 data lives in a new file that imports only types from the engine. The mobile app gets one builder, one screen and one card; the teacher's sheet and form become per-grade, with the Grade 1 files unchanged to the byte.

**Tech Stack:** TypeScript, `node --test` with `--experimental-strip-types`, React Native / Expo (also the web build), Playwright for the browser check.

**Spec:** `docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md`

## Global Constraints

- Grade 2 English **grammar** only; reading is a separate spec. No server, schema, migration or new-artwork change.
- 9 Grade 2 hub lessons (`kbl-g2-eng-s{1,2}-nccd-u*_l1`); 8 get grammar; **S1 U3 gets none**; there is **no S2 U0** in the hub.
- Every Grade 2 unit ships `reviewedBy: null`. **Never commit a sign-off** made for local testing.
- A slot may name only words of its own lesson or an earlier lesson **of the same grade**.
- `MAX_BUILD_TILES` stays **7**; no Grade 2 sentence has more than 7 tokens.
- `orange` is not in U6's food slot; `balcony` is not in U8's rooms; `swing` and `slide` are in no slot.
- A pattern with `yesNo` yields **no Choose item and no True or false item** (`choose: null`, `falsePicture: null`); it still yields Build the sentence.
- Yes or No: 8 items per round, half Yes (rounded up), half No, shuffled; offered at ≥ 4 sentences with `yesNo` (`MIN_GRAMMAR_SENTENCES`); full short answers on the buttons, ✓ answer on the left.
- **The Grade 1 files must stay byte-identical:** `docs/english-grammar-g1-sheet.md`, `docs/english-grammar-g1-review.html`.
- English text is laid out left to right whatever the UI language; an English answer inside an Arabic line is wrapped in LRI…PDI (`⁦…⁩`).
- Mobile tests live in `artifacts/mobile/services/__tests__/` and import no `react-native` / `expo-*`.
- Arabic UI copy never spells the brand «اقرأ» (use «إقرأ»); `i18nTerminology.test.ts` enforces it.
- Commits end with the session's `Co-Authored-By` / `Claude-Session` lines; no model id appears in code, comments or PR text.

## File map

| File | Responsibility |
| --- | --- |
| `lib/curriculum/src/englishGrammar.ts` | engine: forms tables, optional `choose`, `yesNo`, `grammarUnitsForGrade`, `allGrammarSpoken`, per-grade sheet |
| `lib/curriculum/src/englishGrammarG2.ts` (new) | `GRAMMAR_UNITS_G2` and `NOT_COVERED_G2` (Arabic reasons) |
| `lib/curriculum/src/englishGrammarReview.ts` | teacher's form per grade: copy, Yes/No column, not-covered blocks |
| `lib/curriculum/scripts/grammar-sheet.ts` | writes the sheets and forms for grades 1 and 2, plus the reading form |
| `lib/curriculum/scripts/generate-english-audio.ts` | voices `allGrammarSpoken()` |
| `docs/english-grammar-g2-sheet.md`, `docs/english-grammar-g2-review.html` (generated) | Grade 2 sheet and teacher's form |
| `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts` (new) | forms, `yesNo`, grade helpers |
| `lib/curriculum/src/__tests__/englishGrammarG2.test.ts` (new) | Grade 2 data, forms, exclusions, committed files |
| `lib/curriculum/src/__tests__/englishGrammar.test.ts` | scoped to Grade 1; spoken-string collision check |
| `artifacts/mobile/services/englishHub/games.ts` | `grammar-yesno` activity, builder, availability |
| `artifacts/mobile/services/__tests__/englishGrammarGames.test.ts` | scoped to Grade 1 |
| `artifacts/mobile/services/__tests__/englishGrammarG2Games.test.ts` (new) | Grade 2 builders and Yes or No |
| `artifacts/mobile/components/englishHub/GrammarActivities.tsx` | `YesNo` screen |
| `artifacts/mobile/app/curriculum/english/[lessonId].tsx` | `META` entry and route |
| `artifacts/mobile/services/i18n.ts` | Arabic + English strings |
| `STATUS.md` | new section and sign-off steps |

---

### Task 1: Engine — forms, `yesNo`, grade helpers

**Files:**
- Modify: `lib/curriculum/src/englishGrammar.ts`, `lib/curriculum/src/englishGrammarReview.ts` (scoping only)
- Modify: `lib/curriculum/src/__tests__/englishGrammar.test.ts` (scope to Grade 1)
- Create: `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts`

**Interfaces:**
- Produces (all exported from `englishGrammar.ts`):
  - `GrammarPattern.choose?` (now optional) and `GrammarPattern.yesNo?: { kind: 'match' | 'marker'; question: string; yes: string; no: string }`
  - `GrammarSentence.yesNo: { kind: 'match' | 'marker'; question: string; otherQuestion: string | null; yes: string; no: string; answer: boolean } | null`
  - `unitGrade(unit: GrammarUnit): number`, `grammarUnitsForGrade(grade: number): GrammarUnit[]`
  - `allGrammarSpoken(): string[]`
  - `renderGrammarSheet(grade?: number): string` and `renderGrammarReviewHtml(grade?: number): string` (default 1)

- [ ] **Step 1: Write the failing tests** — create `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts`:

```ts
/**
 * The grammar engine pieces Grade 2 added (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md):
 * word forms, the optional Choose, the `yesNo` pattern field, grade helpers and the spoken-string list.
 * The units here are inline, so these hold whatever data the grades carry.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  allGrammarSpoken, grammarUnitsForGrade, pluralOf, unitGrade, unitSentences, withArticle, type GrammarUnit,
} from '../englishGrammar.ts';

test('Grade 2 word forms: irregular plurals, words with no article, a/an', () => {
  for (const [word, plural] of [
    ['mouse', 'mice'], ['fish', 'fish'], ['potato', 'potatoes'], ['tomato', 'tomatoes'], ['shelf', 'shelves'],
    ['tortoise', 'tortoises'], ['cat', 'cats'], ['eggs', 'eggs'], ['scissors', 'scissors'], ['shoes', 'shoes'],
    ['shorts', 'shorts'], ['trousers', 'trousers'], ['rice', 'rice'], ['milk', 'milk'], ['pencil case', 'pencil cases'],
  ] as const) assert.equal(pluralOf(word), plural, word);
  for (const [word, phrase] of [
    ['action figure', 'an action figure'], ['T-shirt', 'a T-shirt'], ['mouse', 'a mouse'], ['fish', 'a fish'],
    ['rice', 'rice'], ['bread', 'bread'], ['cheese', 'cheese'], ['chicken', 'chicken'], ['juice', 'juice'],
    ['water', 'water'], ['scissors', 'scissors'], ['shorts', 'shorts'], ['trousers', 'trousers'], ['eggs', 'eggs'],
  ] as const) assert.equal(withArticle(word), phrase, word);
});

const MATCH_UNIT: GrammarUnit = {
  lessonId: 'kbl-g2-eng-s1-nccd-u1_l1',
  reviewedBy: null,
  patterns: [
    { id: 'is', text: 'Is it {a:p}? Yes, it is.', picture: 'p', yesNo: { kind: 'match', question: 'Is it {a:p}?', yes: 'Yes, it is.', no: "No, it isn't." } },
    { id: 'this', text: "What's this? It's {a:p}.", picture: 'p', choose: { kind: 'slot', slot: 'p' } },
  ],
  // robot's next pictured word skips «action figure» (no picture) and wraps to «car».
  slots: { p: ['car', 'plane', 'robot', 'action figure'] },
};

test('a match pattern asks about the picture, and its No question names the next pictured word', () => {
  const sentences = unitSentences(MATCH_UNIT).filter(s => s.patternId === 'is');
  const car = sentences.find(s => s.picture?.word === 'car')!;
  assert.equal(car.text, 'Is it a car? Yes, it is.');
  assert.deepEqual(car.yesNo, { kind: 'match', question: 'Is it a car?', otherQuestion: 'Is it a plane?', yes: 'Yes, it is.', no: "No, it isn't.", answer: true });
  assert.equal(sentences.find(s => s.picture?.word === 'robot')!.yesNo!.otherQuestion, 'Is it a car?');
  // An unpictured word cannot be asked about: no yesNo, no picture.
  const figure = sentences.find(s => s.text.includes('action figure'))!;
  assert.equal(figure.text, 'Is it an action figure? Yes, it is.');
  assert.equal(figure.picture, null);
  assert.equal(figure.yesNo, null);
  for (const s of sentences) assert.ok(s.text.startsWith(s.yesNo?.question ?? s.text), s.key);
});

test('a pattern with yesNo gives no Choose and no True or false item; one without it still does', () => {
  for (const s of unitSentences(MATCH_UNIT).filter(x => x.patternId === 'is')) {
    assert.equal(s.choose, null, s.key);
    assert.equal(s.falsePicture, null, s.key);
  }
  const plain = unitSentences(MATCH_UNIT).filter(s => s.patternId === 'this' && s.picture);
  assert.ok(plain.every(s => s.choose && s.falsePicture && s.yesNo === null));
});

const MARKER_UNIT: GrammarUnit = {
  lessonId: 'kbl-g2-eng-s2-nccd-u6_l1',
  reviewedBy: null,
  patterns: [
    { id: 'ylike', text: 'Do you like {s:f}? Yes, I do.', picture: 'f', marker: 'yes', yesNo: { kind: 'marker', question: 'Do you like {s:f}?', yes: 'Yes, I do.', no: "No, I don't." } },
    { id: 'ydont', text: "Do you like {s:f}? No, I don't.", picture: 'f', marker: 'no', yesNo: { kind: 'marker', question: 'Do you like {s:f}?', yes: 'Yes, I do.', no: "No, I don't." } },
  ],
  slots: { f: ['apple', 'cheese', 'potato'] },
};

test('a marker pattern answers from its own ✅ / ❌', () => {
  const sentences = unitSentences(MARKER_UNIT);
  const yes = sentences.find(s => s.patternId === 'ylike' && s.picture?.word === 'potato')!;
  assert.equal(yes.text, 'Do you like potatoes? Yes, I do.');
  assert.deepEqual(yes.yesNo, { kind: 'marker', question: 'Do you like potatoes?', otherQuestion: null, yes: 'Yes, I do.', no: "No, I don't.", answer: true });
  const no = sentences.find(s => s.patternId === 'ydont' && s.picture?.word === 'cheese')!;
  assert.equal(no.text, "Do you like cheese? No, I don't.");
  assert.equal(no.yesNo!.answer, false);
});

test('every spoken string of a yesNo sentence is listed: the question, the exchange, the No exchange', () => {
  const all = new Set(allGrammarSpoken());
  // The inline units are not in GRAMMAR_UNITS, so check the rule on the data that is.
  const withYesNo = grammarUnitsForGrade(2).flatMap(u => unitSentences(u)).filter(s => s.yesNo);
  for (const s of withYesNo) {
    assert.ok(all.has(s.text), s.text);
    assert.ok(all.has(s.yesNo!.question), s.yesNo!.question);
    if (s.yesNo!.otherQuestion) {
      assert.ok(all.has(s.yesNo!.otherQuestion), s.yesNo!.otherQuestion);
      assert.ok(all.has(`${s.yesNo!.otherQuestion} ${s.yesNo!.no}`), s.yesNo!.otherQuestion);
    }
  }
});

test('the grade helpers read the grade off the lesson', () => {
  assert.equal(unitGrade(MATCH_UNIT), 2);
  assert.equal(grammarUnitsForGrade(1).length, 9);
  assert.ok(grammarUnitsForGrade(1).every(u => unitGrade(u) === 1));
  assert.deepEqual(grammarUnitsForGrade(3), []);
});
```

Note: the fifth test's `withYesNo` loop is vacuous until Task 2 adds Grade 2 data; Task 2 makes it bite (it asserts a count there too).

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts`
Expected: FAIL (`allGrammarSpoken`/`grammarUnitsForGrade` are not exports).

- [ ] **Step 3: Implement in `englishGrammar.ts`.** Apply these edits.

(a) The forms tables — replace the block from `/** Words that are plural in form` through `const PLURAL_OVERRIDES: Record<string, string> = {};` with:

```ts
/**
 * Words that take no article and no extra "s": plural in form («boots», «eggs») or
 * uncountable («rice», «milk»). "I like rice", "I'm wearing shorts".
 */
const PLURAL_FORMS = new Set([
  'boots', 'jeans', 'socks', 'arms', 'feet', 'hands', 'legs',
  'apples', 'cakes', 'carrots', 'grapes', 'lemons', 'sweets',
  'eggs', 'scissors', 'shoes', 'shorts', 'trousers',
  'rice', 'bread', 'cheese', 'chicken', 'juice', 'milk', 'water',
]);
/** Words whose article the first letter gets wrong. None yet; "a uniform", "an hour" later. */
const ARTICLE_OVERRIDES: Record<string, 'a' | 'an'> = {};
/** Irregular plurals (Grade 2). «fish» is an animal in Unit 5 and a food in Unit 6; both take the same plural. */
const PLURAL_OVERRIDES: Record<string, string> = {
  mouse: 'mice', fish: 'fish', potato: 'potatoes', tomato: 'tomatoes', shelf: 'shelves',
};
```

(b) `GrammarPattern`: change `  choose:` to `  choose?:`, extend its comment, and add `yesNo` after the union. The block becomes:

```ts
  /**
   * What Choose the word blanks: a fixed phrase and its contrast, the slot's
   * word (the picture says which), or the whole answer after the question
   * (the question is then not shown — it would give the answer away).
   * Absent on a pattern with `yesNo`: Yes or No is its judging.
   */
  choose?:
    | { kind: 'phrase'; right: string; wrong: string }
    | { kind: 'slot'; slot: string }
    | { kind: 'whole'; other: string };
  /**
   * Yes or No (Grade 2). `match` («Is it a car?»): the picture stays and the
   * question names the pictured word (Yes) or the next pictured word of the
   * slot (No). `marker` («Do you like cheese?»): the pattern's ✅ / ❌ is the
   * truth. `question` takes the pattern's slots.
   */
  yesNo?: { kind: 'match' | 'marker'; question: string; yes: string; no: string };
```

(c) `GrammarSentence`: after the `falsePicture` field add:

```ts
  /** Null unless the pattern has `yesNo` and the picture exists. `otherQuestion` is a `match` item's No question. */
  yesNo: {
    kind: 'match' | 'marker';
    question: string;
    otherQuestion: string | null;
    yes: string;
    no: string;
    /** True when the sentence's own answer is «yes». */
    answer: boolean;
  } | null;
```

(d) `unitSentences` — replace the part from `const falsePicture = …` through the `out.push({…});` call with:

```ts
      const otherWord = picture && p.picture ? nextPictured(unit.slots[p.picture], picture.word) : null;
      // A pattern with `yesNo` is judged by Yes or No, so it has no True or false item.
      const falsePicture = p.yesNo ? null : otherWord;

      let choose: GrammarSentence['choose'] = null;
      const c = p.choose;
      if (c?.kind === 'phrase') {
        const [start, length] = phraseSpan(tokens, c.right);
        choose = { kind: 'phrase', start, length, right: c.right, wrong: c.wrong };
      } else if (c?.kind === 'slot' && picture) {
        const other = nextPictured(unit.slots[c.slot], fill[c.slot]);
        if (other) {
          const span = spans[c.slot];
          const wrong = spanText(realise(p.text, { ...fill, [c.slot]: other }).tokens, span);
          choose = { kind: 'slot', start: span[0], length: span[1], right: spanText(tokens, span), wrong };
        }
      } else if (c?.kind === 'whole' && picture) {
        const other = unit.patterns.find(q => q.id === c.other)!;
        const otherTokens = realise(other.text, fill).tokens;
        const span = answerSpan(tokens);
        choose = { kind: 'whole', start: span[0], length: span[1], right: spanText(tokens, span), wrong: spanText(otherTokens, answerSpan(otherTokens)) };
      }

      let yesNo: GrammarSentence['yesNo'] = null;
      const y = p.yesNo;
      if (y && picture) {
        const question = realise(y.question, fill).tokens.join(' ');
        const otherQuestion = y.kind === 'match' && otherWord && p.picture
          ? realise(y.question, { ...fill, [p.picture]: otherWord }).tokens.join(' ')
          : null;
        yesNo = { kind: y.kind, question, otherQuestion, yes: y.yes, no: y.no, answer: y.kind === 'match' ? true : p.marker === 'yes' };
      }

      out.push({
        key: `${unit.lessonId}|${p.id}|${slots.map(s => fill[s]).join('+')}`,
        lessonId: unit.lessonId,
        patternId: p.id,
        text: tokens.join(' '),
        tokens,
        picture,
        marker: p.marker ?? null,
        choose,
        falsePicture,
        yesNo,
      });
```
(Check the old `choose`/`whole` branch code in the file is the one being replaced; the only changes are `c?.kind`, `otherWord`/`falsePicture`, and the new `yesNo` block.)

(e) After `grammarUnit(...)` add:

```ts
export function unitGrade(unit: GrammarUnit): number {
  return hubLesson(unit.lessonId)!.grade;
}

export function grammarUnitsForGrade(grade: number): GrammarUnit[] {
  return GRAMMAR_UNITS.filter(u => unitGrade(u) === grade);
}
```

(f) After `allGrammarSentences()` add:

```ts
/**
 * Every string the grammar activities speak: each sentence, and for Yes or No the
 * question alone and the No exchange («Is it a plane? No, it isn't.»). Voiced before
 * a unit is signed off, like the sentences.
 */
export function allGrammarSpoken(): string[] {
  const out = new Set<string>();
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      out.add(s.text);
      const y = s.yesNo;
      if (!y) continue;
      out.add(y.question);
      if (y.otherQuestion) {
        out.add(y.otherQuestion);
        out.add(`${y.otherQuestion} ${y.no}`);
      }
    }
  }
  return [...out];
}
```

(g) `renderGrammarSheet` — change the signature to `renderGrammarSheet(grade = 1)`, the title line to `` `# English corner — Grade ${grade} grammar sentences` ``, and `for (const unit of GRAMMAR_UNITS)` to `for (const unit of grammarUnitsForGrade(grade))`. Nothing else changes in this task (Grade 1 output must stay identical).

(h) `englishGrammarReview.ts`: import `grammarUnitsForGrade` instead of `GRAMMAR_UNITS`; change `renderGrammarReviewHtml()` to `renderGrammarReviewHtml(grade = 1)` and start it with `const units = grammarUnitsForGrade(grade);`, using `units` for `total`, the `units.map(renderUnit).join('')` list and `${AR_DIGITS(units.length)}`. (Rename the existing local `units` string to `sections`.)

- [ ] **Step 4: Scope the existing Grade 1 test.** In `lib/curriculum/src/__tests__/englishGrammar.test.ts`:
  - in the import list replace `GRAMMAR_UNITS, allGrammarSentences, grammarUnit,` with `allGrammarSentences, grammarUnit, grammarUnitsForGrade,`;
  - after `const order = new Map(...)` add `const UNITS = grammarUnitsForGrade(1);`;
  - replace every remaining `GRAMMAR_UNITS` in the file with `UNITS`.

- [ ] **Step 5: Run the tests**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts src/__tests__/englishGrammar.test.ts src/__tests__/englishReading.test.ts`
Expected: PASS. The committed Grade 1 sheet and form tests passing prove the output is unchanged.

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @workspace/curriculum run typecheck` — no errors.

```bash
git add lib/curriculum/src/englishGrammar.ts lib/curriculum/src/englishGrammarReview.ts lib/curriculum/src/__tests__/englishGrammar.test.ts lib/curriculum/src/__tests__/englishGrammarEngine.test.ts
git commit -m "feat(curriculum): grammar engine for Grade 2 — word forms, yesNo patterns, grade helpers

Fills the irregular-plural and no-article tables, makes Choose optional, adds
the yesNo pattern field and allGrammarSpoken, and scopes the sheet and form
to a grade. Grade 1 output is unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 2: Grade 2 data

**Files:**
- Create: `lib/curriculum/src/englishGrammarG2.ts`
- Modify: `lib/curriculum/src/englishGrammar.ts` (wire the data in)
- Modify: `artifacts/mobile/services/__tests__/englishGrammarGames.test.ts` (scope to Grade 1)
- Test: `lib/curriculum/src/__tests__/englishGrammarG2.test.ts`

**Interfaces:**
- Consumes: `GrammarUnit`, `GrammarPattern` (types only) from Task 1.
- Produces: `GRAMMAR_UNITS_G2: GrammarUnit[]`; `NOT_COVERED_G2: Record<string, string[]>` (lesson id → Arabic reasons, one per bullet; covers all 9 Grade 2 lessons).

- [ ] **Step 1: Write the failing test** — create `lib/curriculum/src/__tests__/englishGrammarG2.test.ts`:

```ts
/**
 * Grade 2 grammar sentences (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { NOT_COVERED_G2 } from '../englishGrammarG2.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G2 = hubLessonsForGrade(2);
const order = new Map(G2.map((l, i) => [l.id, i]));
const UNITS = grammarUnitsForGrade(2);
const L = (sem: number, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;
/** Mirrors `MAX_BUILD_TILES` in the app's games.ts: a longer sentence is silently dropped from Build the sentence. */
const MAX_BUILD_TILES = 7;

test('the hub has nine Grade 2 lessons; eight have grammar, and S1 U3 has none', () => {
  assert.equal(G2.length, 9);
  assert.equal(UNITS.length, 8);
  for (const u of UNITS) assert.ok(order.has(u.lessonId), u.lessonId);
  assert.equal(grammarUnit(L(1, 3)), undefined);
});

test('a slot names only words of its own lesson or an earlier Grade 2 lesson', () => {
  for (const u of UNITS) {
    const allowed = new Set(G2.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en)));
    for (const [slot, words] of Object.entries(u.slots)) {
      for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    }
  }
});

test('the generator produces the counted sentences, none longer than the Build cap', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [
    [L(1, 0), 16], [L(1, 1), 26], [L(1, 2), 31], [L(1, 4), 10], [L(2, 5), 20], [L(2, 6), 56], [L(2, 7), 17], [L(2, 8), 36],
  ]);
  for (const u of UNITS) {
    for (const s of unitSentences(u)) assert.ok(s.tokens.length <= MAX_BUILD_TILES, `${s.text} (${s.tokens.length})`);
  }
});

test('every picture exists, a false picture is another word, and a slot or whole choice has a picture', () => {
  for (const u of UNITS) {
    for (const s of unitSentences(u)) {
      assert.equal(s.tokens.join(' '), s.text, s.key);
      if (s.picture) assert.ok(wordPicture(s.picture.word), s.key);
      if (s.falsePicture) {
        assert.ok(wordPicture(s.falsePicture), s.key);
        assert.notEqual(s.falsePicture, s.picture?.word, s.key);
      }
      if (s.choose && s.choose.kind !== 'phrase') assert.ok(s.picture, `${s.key}: a ${s.choose.kind} choice with no picture`);
      if (s.choose) {
        const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
        assert.equal(blanked, s.choose.right, s.key);
        assert.notEqual(s.choose.right, s.choose.wrong, s.key);
      }
    }
  }
});

test('Yes or No: only toys and food ask it; a match question names the picture, a marker follows its mark', () => {
  const byUnit = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).filter(s => s.yesNo)]));
  assert.deepEqual(
    [...byUnit].filter(([, ss]) => ss.length).map(([id, ss]) => [id, ss.length]),
    [[L(1, 1), 12], [L(2, 6), 28]],
  );
  for (const s of byUnit.get(L(1, 1))!) {
    const y = s.yesNo!;
    assert.equal(y.kind, 'match');
    assert.equal(y.question, `Is it a ${s.picture!.word}?`, s.key);
    assert.ok(s.text.startsWith(y.question), s.key);
    const other = /^Is it an? (.+)\?$/.exec(y.otherQuestion!)![1];
    assert.notEqual(other, s.picture!.word, s.key);
    assert.ok(wordPicture(other), s.key);
    assert.equal(y.answer, true);
  }
  const likes = byUnit.get(L(2, 6))!;
  assert.equal(likes.filter(s => s.yesNo!.answer).length, 14);
  assert.equal(likes.filter(s => !s.yesNo!.answer).length, 14);
  for (const s of likes) {
    assert.equal(s.yesNo!.kind, 'marker');
    assert.equal(s.yesNo!.answer, s.marker === 'yes', s.key);
    assert.equal(s.choose, null, s.key);
    assert.equal(s.falsePicture, null, s.key);
    assert.ok(s.text.startsWith(s.yesNo!.question), s.key);
  }
});

test('left-out words are in no slot', () => {
  const slotWords = new Map(UNITS.map(u => [u.lessonId, new Set(Object.values(u.slots).flat())]));
  assert.ok(!slotWords.get(L(2, 6))!.has('orange'), 'orange: its only picture is the colour');
  assert.ok(!slotWords.get(L(2, 8))!.has('balcony'), 'balcony: «on the balcony»');
  for (const words of slotWords.values()) {
    for (const w of ['swing', 'slide']) assert.ok(!words.has(w), w);
  }
  assert.ok(slotWords.get(L(1, 0))!.has('orange'), 'the colour orange stays in the Welcome unit');
});

test('the sentences the book uses come out word for word, and the wrong forms do not', () => {
  const texts = new Set(UNITS.flatMap(u => unitSentences(u).map(s => s.text)));
  for (const t of [
    "What's this? It's an action figure.", "What's this? It's a car.", 'Is it a car? Yes, it is.',
    'This is my pencil case.', 'These are my scissors.', 'These are my shelves.', 'These are my books.',
    "Who's this? It's my granny.", "He's got blue eyes.", "She's got green eyes.",
    "What's this? It's a fish.", "What are these? They're fish.", "What are these? They're mice.",
    "What are these? They're tortoises.", 'I like potatoes.', 'I like tomatoes.', 'I like rice.', "I don't like eggs.",
    'Do you like cheese? Yes, I do.', "Do you like milk? No, I don't.",
    "What's the weather like? It's cloudy.", "I'm wearing shorts.", "I'm wearing a T-shirt.", "I'm wearing a jumper.",
    "Where's my dad? He's in the kitchen.", "Where's my mum? She's in the living room.",
    "What colour is it? It's pink.", "How old are you? I'm seven.",
  ]) assert.ok(texts.has(t), t);
  for (const bad of [
    'This is my scissors.', 'These are my scissorss.', 'I like rices.', 'I like eggss.', "What are these? They're mouses.",
    'I like tomatos.', 'I like oranges.', "Where's my mum? He's in the kitchen.", "Where's my dad? She's in the kitchen.",
    "I'm wearing a shorts.", "What's this? It's a action figure.", "Is it a swing? Yes, it is.",
  ]) assert.ok(!texts.has(bad), bad);
});

test('every Grade 2 unit ships unsigned, so none is offered', () => {
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
  }
});

test('the not-covered table has an entry for every Grade 2 lesson and only for them', () => {
  assert.deepEqual(Object.keys(NOT_COVERED_G2).sort(), G2.map(l => l.id).sort());
  for (const [id, items] of Object.entries(NOT_COVERED_G2)) {
    assert.ok(items.length > 0, id);
    // The form wraps English runs in spans without escaping entities: no markup characters.
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG2.test.ts`
Expected: FAIL — `Cannot find module '../englishGrammarG2.ts'`.

- [ ] **Step 3: Create `lib/curriculum/src/englishGrammarG2.ts`:**

```ts
/**
 * Grade 2 grammar units for the English corner
 * (spec: docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md).
 *
 * Patterns are the book's (`objectives` in data/iqra_curriculum_g2_english_sem{1,2}.json), restricted
 * to what the corner can picture. The rest is listed in `NOT_COVERED_G2`, which the teacher's form
 * prints, so nothing is missing silently. A unit is offered to nobody until `reviewedBy` is set.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (sem: 1 | 2, unit: number) => `kbl-g2-eng-s${sem}-nccd-u${unit}_l1`;

const YES_NO_IS = { kind: 'match', yes: 'Yes, it is.', no: "No, it isn't." } as const;
const YES_NO_LIKE = { kind: 'marker', yes: 'Yes, I do.', no: "No, I don't." } as const;

const COLOURS = ['black', 'blue', 'brown', 'green', 'orange', 'pink', 'purple', 'red', 'white', 'yellow'];
/** «swing» and «slide» have no picture; «action figure» and «building set» appear in Build the sentence only. */
const TOYS = ['action figure', 'building set', 'car', 'dinosaur', 'doll', 'plane', 'puzzle', 'robot', 'teddy', 'yoyo', 'ball', 'bike', 'kite', 'scooter'];
const PICTURED_TOYS = ['car', 'dinosaur', 'doll', 'plane', 'puzzle', 'robot', 'teddy', 'yoyo', 'ball', 'bike', 'kite', 'scooter'];
const SCHOOL = [
  'bag', 'book', 'chair', 'computer', 'crayon', 'cupboard', 'desk', 'eraser', 'pen', 'pencil',
  'pencil case', 'pencil sharpener', 'ruler', 'shelf', 'table',
];
/** «orange» is left out: its only picture is the colour 🟠. */
const FOOD = [
  'apple', 'banana', 'carrot', 'potato', 'tomato', 'rice', 'bread', 'cheese', 'chicken', 'eggs', 'fish', 'juice', 'milk', 'water',
];
/** «balcony» is left out: «on the balcony», not «in». */
const ROOMS = ['bathroom', 'bedroom', 'kitchen', 'house', 'garden', 'garage', 'hall', 'living room', 'flat'];

export const GRAMMAR_UNITS_G2: GrammarUnit[] = [
  {
    // What colour is it? / How old are you?
    lessonId: L(1, 0),
    reviewedBy: null,
    patterns: [
      { id: 'colour', text: "What colour is it? It's {colour}.", picture: 'colour', choose: { kind: 'slot', slot: 'colour' } },
      { id: 'age', text: "How old are you? I'm {age}.", picture: 'age', choose: { kind: 'slot', slot: 'age' } },
    ],
    slots: { colour: COLOURS, age: ['five', 'six', 'seven', 'eight', 'nine', 'ten'] },
  },
  {
    // What's this? It's a (car). It's an (action figure). / Is it a (car)? Yes, it is. No, it isn't.
    lessonId: L(1, 1),
    reviewedBy: null,
    patterns: [
      { id: 'this', text: "What's this? It's {a:toy}.", picture: 'toy', choose: { kind: 'slot', slot: 'toy' } },
      { id: 'is', text: 'Is it {a:pictured}? Yes, it is.', picture: 'pictured', yesNo: { ...YES_NO_IS, question: 'Is it {a:pictured}?' } },
    ],
    slots: { toy: TOYS, pictured: PICTURED_TOYS },
  },
  {
    // This is (my pencil case). These are (my books).
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: [
      { id: 'this', text: 'This is my {one}.', picture: 'one', choose: { kind: 'phrase', right: 'This is', wrong: 'These are' } },
      { id: 'these', text: 'These are my {s:many}.', picture: 'many', marker: 'many', choose: { kind: 'phrase', right: 'These are', wrong: 'This is' } },
    ],
    // «scissors» is plural in form, so only «These are» takes it.
    slots: { one: SCHOOL, many: [...SCHOOL, 'scissors'] },
  },
  {
    // Who's this? It's (my uncle). / He's got (blue eyes). She's got (green eyes).
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'who', text: "Who's this? It's my {family}.", picture: 'family', choose: { kind: 'phrase', right: "Who's", wrong: "What's" } },
      { id: 'he', text: "He's got {colour} eyes.", picture: 'colour', marker: 'boy', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'she', text: "She's got {colour} eyes.", picture: 'colour', marker: 'girl', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
    ],
    slots: { family: ['mum', 'dad', 'grandad', 'granny'], colour: ['blue', 'brown', 'green'] },
  },
  {
    // What are these? They're cats. — against «What's this? It's a cat.»
    lessonId: L(2, 5),
    reviewedBy: null,
    patterns: [
      { id: 'one', text: "What's this? It's {a:animal}.", picture: 'animal', choose: { kind: 'whole', other: 'many' } },
      { id: 'many', text: "What are these? They're {s:animal}.", picture: 'animal', marker: 'many', choose: { kind: 'whole', other: 'one' } },
    ],
    slots: { animal: ['cat', 'duck', 'fish', 'hamster', 'mouse', 'parrot', 'rabbit', 'snake', 'spider', 'tortoise'] },
  },
  {
    // I like apples. / I don't like pasta. / Do you like cheese? Yes, I do. No, I don't.
    lessonId: L(2, 6),
    reviewedBy: null,
    patterns: [
      { id: 'like', text: 'I like {s:food}.', picture: 'food', marker: 'yes', choose: { kind: 'phrase', right: 'like', wrong: "don't like" } },
      { id: 'dont', text: "I don't like {s:food}.", picture: 'food', marker: 'no', choose: { kind: 'phrase', right: "don't like", wrong: 'like' } },
      { id: 'ylike', text: 'Do you like {s:food}? Yes, I do.', picture: 'food', marker: 'yes', yesNo: { ...YES_NO_LIKE, question: 'Do you like {s:food}?' } },
      { id: 'ydont', text: "Do you like {s:food}? No, I don't.", picture: 'food', marker: 'no', yesNo: { ...YES_NO_LIKE, question: 'Do you like {s:food}?' } },
    ],
    slots: { food: FOOD },
  },
  {
    // What's the weather like? It's cloudy. / I'm wearing a T-shirt.
    lessonId: L(2, 7),
    reviewedBy: null,
    patterns: [
      { id: 'weather', text: "What's the weather like? It's {weather}.", picture: 'weather', choose: { kind: 'slot', slot: 'weather' } },
      { id: 'wear', text: "I'm wearing {a:garment}.", picture: 'garment', choose: { kind: 'slot', slot: 'garment' } },
    ],
    slots: {
      weather: ['cloudy', 'cold', 'foggy', 'hot', 'rainy', 'snowy', 'stormy', 'sunny', 'windy'],
      garment: ['boots', 'coat', 'jumper', 'shoes', 'shorts', 'skirt', 'T-shirt', 'trousers'],
    },
  },
  {
    // Where's my dad? He's in the garden. — two patterns: the pronoun follows the person.
    lessonId: L(2, 8),
    reviewedBy: null,
    patterns: [
      { id: 'he', text: "Where's my {male}? He's in the {room}.", picture: 'room', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'she', text: "Where's my {female}? She's in the {room}.", picture: 'room', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
    ],
    slots: { male: ['dad', 'grandad'], female: ['mum', 'granny'], room: ROOMS },
  },
];

/**
 * What a Grade 2 lesson does not cover, and why — printed on the teacher's form. One bullet per
 * item, Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G2: Record<string, string[]> = {
  [L(1, 0)]: [
    "«What's your name? My name's …» و«How many …?»: لا توجد صورة تُظهرها.",
    '«How old are you?»: الأعمار المستخدمة من خمس إلى عشر فقط.',
  ],
  [L(1, 1)]: [
    'الكلمتان swing وslide ليس لهما صورة، وswing هي مثال الكتاب في «Is it a swing?»، لذلك تُستخدم ألعاب لها صور.',
    'action figure وbuilding set تظهران في «رتّب الجملة» فقط لأنه لا صورة لهما.',
    '«Can I play with it, please?»: حوار بلا صورة.',
  ],
  [L(1, 2)]: [
    "«Where's the pencil? It's in / on / under the desk»: لا يمكن لرمز تعبيري أن يُظهر in أو on أو under.",
    '«Can I borrow it, please?»: حوار بلا صورة.',
    'كلمة scissors تأتي مع «These are» فقط لأنها جمع دائمًا.',
  ],
  [L(1, 3)]: [
    'لا أنشطة قواعد في هذه الوحدة: لا توجد صور للكلمات face وtoes وfingers وhead وknees وtummy.',
    'الكلمات المصوّرة (arms وfeet وhands وlegs) مستخدمة في قواعد الصف الأول.',
    'أفعال الحركة مثل «Touch your head!» لا صور لها.',
  ],
  [L(1, 4)]: [
    "uncle وaunt وbrother وsister وcousin ليس لها صور، لذلك يقتصر «Who's this?» على mum وdad وgrandad وgranny.",
    "«His name's … / Her name's …»: لا صورة لها.",
    'لون العينين يظهر دائرة ملوّنة بجانب 👦 أو 👧؛ إن رأيتم ذلك غير واضح فيُحذف هذا النمط بسطر واحد.',
  ],
  [L(2, 5)]: [
    "«It's got big teeth»: لا صورة تُظهر big.",
  ],
  [L(2, 6)]: [
    'جمل «… and … too» و«… but …» و«… or …»: تحتاج صورتين، ويمكن تبديل الطعامين وتبقى الجملة صحيحة.',
    'bean وpea وpasta وmeat ليس لها صور.',
    'كلمة orange مستبعدة لأن صورتها الوحيدة هي اللون 🟠.',
    'في «Do you like …?» تُظهر الصورة ✅ أو ❌ ويختار الطالب الجواب المطابق (✅ = يحبّه). إن لم يكن ذلك واضحًا يبقى «نعم أم لا» على «Is it a …?» فقط.',
  ],
  [L(2, 7)]: [
    "«I'm wearing a T-shirt and shorts»: تحتاج صورتين.",
    'jumper وshorts وskirt وtrousers وfoggy وstormy ليس لها صور: تظهر في «رتّب الجملة» فقط.',
    'الوجهان 🥵 و🥶 يعبّران عن الحر والبرد، وليسا صورتين للطقس نفسه.',
  ],
  [L(2, 8)]: [
    "«He's / She's tidying up» وأعمال المنزل: لا صور لها.",
    'كلمة balcony مستبعدة لأن الجملة معها on the balcony وليست in.',
    'garden وgarage وhall وliving room وflat تظهر في «رتّب الجملة» فقط لأنه لا صور لها.',
    'الرمز 🍳 يمثّل المطبخ.',
  ],
};
```

- [ ] **Step 4: Wire it in `englishGrammar.ts`.** At the top add `import { GRAMMAR_UNITS_G2 } from './englishGrammarG2.ts';` (after the existing imports). Rename the Grade 1 array and add the combined export — change `export const GRAMMAR_UNITS: GrammarUnit[] = [` to `const GRAMMAR_UNITS_G1: GrammarUnit[] = [`, and after its closing `];` add:

```ts
/** Grade 1 first, then Grade 2: the order the lessons come in. */
export const GRAMMAR_UNITS: GrammarUnit[] = [...GRAMMAR_UNITS_G1, ...GRAMMAR_UNITS_G2];
```

- [ ] **Step 5: Scope the mobile Grade 1 test.** In `artifacts/mobile/services/__tests__/englishGrammarGames.test.ts`: change the import to `import { grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';`, line 24 to `const UNITS = grammarUnitsForGrade(1).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));` and `unitSentences(GRAMMAR_UNITS[1]!)` to `unitSentences(grammarUnitsForGrade(1)[1]!)`.

- [ ] **Step 6: Run the tests**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG2.test.ts src/__tests__/englishGrammarEngine.test.ts src/__tests__/englishGrammar.test.ts` and `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishGrammarGames.test.ts`.
Expected: PASS. If a count or an expected sentence is off, **stop and reconcile with the spec** (counts: 16, 26, 31, 10, 20, 56, 17, 36 = 212) before changing any expectation.

- [ ] **Step 7: Typecheck and commit**

Run: `pnpm --filter @workspace/curriculum run typecheck` — no errors.

```bash
git add lib/curriculum/src/englishGrammarG2.ts lib/curriculum/src/englishGrammar.ts lib/curriculum/src/__tests__/englishGrammarG2.test.ts artifacts/mobile/services/__tests__/englishGrammarGames.test.ts
git commit -m "feat(curriculum): Grade 2 grammar units — 212 sentences over 8 lessons, hidden until signed off

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 3: The teacher's sheet and form, per grade

**Files:**
- Modify: `lib/curriculum/src/englishGrammar.ts` (`renderGrammarSheet`), `lib/curriculum/src/englishGrammarReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`
- Create (generated): `docs/english-grammar-g2-sheet.md`, `docs/english-grammar-g2-review.html`
- Test: `lib/curriculum/src/__tests__/englishGrammarG2.test.ts` (append)

**Interfaces:**
- Consumes: `grammarUnitsForGrade`, `NOT_COVERED_G2`, `GrammarSentence.yesNo`.
- Produces: `renderGrammarSheet(grade)` and `renderGrammarReviewHtml(grade)` with Grade 2 output; Grade 1 output byte-identical.

- [ ] **Step 1: Write the failing tests** — append to `englishGrammarG2.test.ts`:

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderGrammarSheet } from '../englishGrammar.ts';

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'docs');

test("the Grade 2 teacher's form lists every sentence once, with a Yes or No column and a not-covered block per lesson", async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml(2);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const all = UNITS.flatMap(u => unitSentences(u).map(s => s.text));
  for (const text of new Set(all)) {
    assert.equal(html.split(`<td class="sentence" dir="ltr">${esc(text)}</td>`).length - 1, all.filter(t => t === text).length, text);
  }
  assert.equal((html.match(/<td class="sentence"/g) ?? []).length, 212);
  // Two units ask Yes or No (toys, food), so two tables carry the column.
  assert.equal((html.match(/<th>«نعم أم لا»/g) ?? []).length, 2);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 9);
  for (const word of ['orange', 'balcony', 'swing', 'slide']) assert.ok(html.includes(word), word);
  assert.ok(html.includes('مراجعة قواعد الصف الثاني'));
  assert.ok(html.includes('Is it a plane? → No, it isn&#39;t.') || html.includes("Is it a plane? → No, it isn't."), 'a No variant is shown');
});

test("the committed Grade 2 sheet and form are exactly what the generators produce", async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g2-sheet.md'), 'utf8'), renderGrammarSheet(2), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g2-review.html'), 'utf8'), renderGrammarReviewHtml(2), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
});
```

- [ ] **Step 2: Run to make sure they fail**

Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG2.test.ts`
Expected: FAIL (no `نعم أم لا` column, no committed files).

- [ ] **Step 3: The sheet.** In `renderGrammarSheet` (`englishGrammar.ts`): compute `const units = grammarUnitsForGrade(grade);` and `const hasYesNo = (u: GrammarUnit) => unitSentences(u).some(s => s.yesNo);`. After the existing intro lines (before the unit loop) add, only when some unit asks Yes or No:

```ts
  if (units.some(hasYesNo)) {
    lines.push(
      '«Yes or No» shows the question, the answer it expects and, for «Is it …?», the question the «No»',
      'item asks about the same picture.',
      '',
    );
  }
```
In the unit loop: header/separator rows become
`hasYesNo(unit) ? '| Sentence | Picture | Choose | True or false: wrong picture | Yes or No |' : <the existing header>` and `'|---|---|---|---|---|'` vs the existing separator; and each row appends a cell when `hasYesNo(unit)`:

```ts
      const y = s.yesNo;
      const yn = !y ? '—'
        : y.kind === 'marker' ? `${y.question} → ${y.answer ? y.yes : y.no}`
        : `${y.question} → ${y.yes}${y.otherQuestion ? `<br>${y.otherQuestion} → ${y.no}` : ''}`;
      lines.push(`| ${s.text} | ${pic} | ${choose} | ${s.falsePicture ?? '—'} |${hasYesNo(unit) ? ` ${yn} |` : ''}`);
```
Use `units` in `for (const unit of units)`. Grade 1 rows have no extra cell, so the file is unchanged.

- [ ] **Step 4: The form.** In `englishGrammarReview.ts`:

(a) Imports: `import { grammarUnitsForGrade, unitSentences, type GrammarSentence, type GrammarUnit } from './englishGrammar.ts';`, `import { NOT_COVERED_G2 } from './englishGrammarG2.ts';`, `import { hubLesson, hubLessonsForGrade } from './englishHub.ts';`.

(b) After `NOTES` add:

```ts
/** Per grade: lesson id → why part of it is not covered (Grade 1 uses `NOTES` instead). */
const NOT_COVERED: Record<number, Record<string, string[]>> = { 2: NOT_COVERED_G2 };

/** Wraps each run of English in `dir="ltr"`, so a phrase with punctuation does not scramble inside an Arabic line. */
const ltr = (s: string) =>
  esc(s).replace(/[A-Za-z][A-Za-z0-9'’-]*(?:[ ,.?!/…]+[A-Za-z0-9'’][A-Za-z0-9'’-]*)*[.?!]?/g, m => `<span dir="ltr">${m}</span>`);

function yesNoCell(s: GrammarSentence): string {
  const y = s.yesNo;
  if (!y) return '<span class="none">لا يظهر</span>';
  const line = (q: string, a: string, cls: string) => `<span class="yn ${cls}" dir="ltr">${esc(q)} → ${esc(a)}</span>`;
  if (y.kind === 'marker') return line(y.question, y.answer ? y.yes : y.no, y.answer ? 'yn-yes' : 'yn-no');
  return line(y.question, y.yes, 'yn-yes') + (y.otherQuestion ? line(y.otherQuestion, y.no, 'yn-no') : '');
}

function notCoveredList(items: string[] | undefined): string {
  if (!items) return '';
  return `<p class="unit-note"><b>غير مشمول، ولماذا:</b></p><ul class="not-covered">${items.map(i => `<li>${ltr(i)}</li>`).join('')}</ul>`;
}
```

(c) `renderUnit(u, idx)`: add `const withYesNo = sentences.some(s => s.yesNo);`; after the `<td>${falseCell(s)}</td>` row cell add `${withYesNo ? `\n          <td class="yesno">${yesNoCell(s)}</td>` : ''}` — written so the template, with no yes/no, is identical to today's; likewise add `${withYesNo ? `\n            <th>«نعم أم لا»<small>السؤال والجواب، ثم سؤال «لا»</small></th>` : ''}` after the false-picture `<th>` line; and replace `${note}` in the header with `${note}${notCoveredList(NOT_COVERED[unitGradeOf(u)]?.[u.lessonId])}` where `unitGradeOf = (u) => hubLesson(u.lessonId)!.grade`.

(d) Add the section for a lesson with no unit:

```ts
function renderUncovered(lessonId: string, idx: number, items: string[]): string {
  const lesson = hubLesson(lessonId)!;
  const sem = lesson.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  return `
  <section class="unit" id="unit-${idx + 1}">
    <header class="unit-head">
      <div class="unit-meta"><span>${sem}</span><span>${unitLabelAr(lesson.unitNumber)}</span><span>بلا أنشطة قواعد</span></div>
      <h2><span dir="ltr">${esc(lesson.unitTitle)}</span> <span class="unit-ar">${esc(lesson.unitTitleAr)}</span></h2>
      ${notCoveredList(items)}
    </header>
  </section>`;
}
```

(e) Per-grade copy. Above `renderGrammarReviewHtml` add:

```ts
interface GradeCopy {
  title: string;
  eyebrow: string;
  lead: (total: number, units: number) => string;
  acts: string;
  checks: string[];
  extraCss: string;
}

const GRADE_COPY: Record<number, GradeCopy> = {
  1: {
    title: 'مراجعة قواعد الصف الأول',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الأول',
    lead: (total, units) => `بناءً على ملاحظتكم، أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة لتثبيت القواعد. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة في ${AR_DIGITS(units)} وحدات.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ وصورة، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">I've got / I haven't got</span> أو <span dir="ltr">is / are</span> أو <span dir="ltr">He's / She's</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. لا تُستخدم جملة أطول من ٧ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة، ونصفها بصورة كلمة أخرى من الوحدة.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح مع هذه الصورة؟',
      'في «صح أم خطأ»: هل الصورة الخاطئة لا تحتمل أن تكون صحيحة؟',
      'هل الكلمات مناسبة لطالب الصف الأول؟',
    ],
    extraCss: '',
  },
  2: {
    title: 'مراجعة قواعد الصف الثاني',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثاني',
    lead: (total, units) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثاني أربعة أنشطة لتثبيت القواعد، منها نشاط جديد للأجوبة القصيرة. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها، وما استُبعد منها مذكور مع سببه في كل وحدة. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة في ${AR_DIGITS(units)} وحدات.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ وصورة، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">This is / These are</span> أو <span dir="ltr">He's / She's</span> أو <span dir="ltr">like / don't like</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. لا تُستخدم جملة أطول من ٧ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة، ونصفها بصورة كلمة أخرى من الوحدة.</div>
      <div class="act"><b>نعم أم لا</b>صورة وسؤال، ويختار الطالب الجواب القصير: <span dir="ltr">Yes, it is. / No, it isn't.</span> أو <span dir="ltr">Yes, I do. / No, I don't.</span> نصف الأسئلة جوابها «نعم» ونصفها «لا».</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح مع هذه الصورة؟',
      'في «صح أم خطأ»: هل الصورة الخاطئة لا تحتمل أن تكون صحيحة؟',
      'في «نعم أم لا»: هل الجواب القصير هو الصحيح للسؤال وللصورة؟',
      'هل الكلمات مناسبة لطالب الصف الثاني؟',
    ],
    extraCss: `
  .yn { display: block; font-family: var(--latin); font-size: .88rem; white-space: nowrap; }
  .yn-yes { color: var(--right); }
  .yn-no { color: var(--wrong); }
  td.yesno { white-space: nowrap; }
  .not-covered { margin: 0; padding-inline-start: 1.3em; display: grid; gap: 4px; font-size: .92rem; color: var(--muted); }
  .not-covered [dir="ltr"] { font-family: var(--latin); }`,
  },
};
```
(The Grade 1 strings above are the current file's, moved verbatim.)

(f) `renderGrammarReviewHtml(grade = 1)`:

```ts
export function renderGrammarReviewHtml(grade = 1): string {
  const copy = GRADE_COPY[grade]!;
  const units = grammarUnitsForGrade(grade);
  const total = units.reduce((n, u) => n + unitSentences(u).length, 0);
  const byLesson = new Map(units.map(u => [u.lessonId, u]));
  const uncovered = NOT_COVERED[grade] ?? {};
  let idx = 0;
  const sections = hubLessonsForGrade(grade).flatMap(l => {
    const u = byLesson.get(l.id);
    if (u) return [renderUnit(u, idx++)];
    return uncovered[l.id] ? [renderUncovered(l.id, idx++, uncovered[l.id])] : [];
  }).join('');
```
and in the template: `<title>${copy.title}</title>`; the CSS tail `  }${copy.extraCss}\n</style>` (the last rule's `}` then the extra, so Grade 1 is unchanged); the eyebrow `${copy.eyebrow}`; the lead `${copy.lead(total, units.length)}`; the `.acts` block `<div class="acts">${copy.acts}</div>` written so the Grade 1 whitespace is unchanged (the string above carries the current newlines and indentation: check with the byte-identical test); the first card's `<ol>` items `${copy.checks.map(c => `<li>${c}</li>`).join('\n        ')}`; and `${sections}` where `${units}` was.

- [ ] **Step 5: Write the generator output.** In `lib/curriculum/scripts/grammar-sheet.ts` replace the list with a loop over grades:

```ts
for (const grade of [1, 2]) {
  for (const [name, text] of [
    [`english-grammar-g${grade}-sheet.md`, renderGrammarSheet(grade)],
    [`english-grammar-g${grade}-review.html`, renderGrammarReviewHtml(grade)],
  ] as const) {
    const out = path.join(DOCS, name);
    writeFileSync(out, text);
    console.log(`wrote ${path.relative(process.cwd(), out)}`);
  }
}
{
  const out = path.join(DOCS, 'english-reading-g1-review.html');
  writeFileSync(out, renderReadingReviewHtml());
  console.log(`wrote ${path.relative(process.cwd(), out)}`);
}
```
and update the header comment to say it writes the sheet and form per grade (1 and 2) and the reading form.

- [ ] **Step 6: Generate and verify Grade 1 is unchanged**

Run: `pnpm --filter @workspace/curriculum run grammar-sheet && git status --short docs/`
Expected: only the two new Grade 2 files are untracked; **`git diff --stat docs/`** is empty (the Grade 1 sheet, the Grade 1 form and the reading form are unchanged).

- [ ] **Step 7: Look at the Grade 2 form** (Playwright, `executablePath: '/opt/pw-browsers/chromium'`): screenshot the intro, the toys unit (Yes or No column, No variants) and S1 U3 (not-covered only), at 1100 px, and print to PDF (`landscape`, A4). Check: English runs sit left to right inside Arabic bullets; the unit labels read «وحدة الترحيب» for none (no unit 0 in Grade 2); page count is sensible; no horizontal scroll at 390 px (`scrollWidth === 390`).

- [ ] **Step 8: Run all curriculum tests and commit**

Run: `pnpm --filter @workspace/curriculum test` — PASS.

```bash
git add lib/curriculum/src/englishGrammar.ts lib/curriculum/src/englishGrammarReview.ts lib/curriculum/scripts/grammar-sheet.ts lib/curriculum/src/__tests__/englishGrammarG2.test.ts docs/english-grammar-g2-sheet.md docs/english-grammar-g2-review.html
git commit -m "feat(curriculum): the teacher's sheet and review form for Grade 2 grammar

Per-grade generators; the Grade 2 form adds the Yes or No column and a
not-covered block per lesson. The Grade 1 sheet and form are unchanged.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 4: Audio

**Files:**
- Modify: `lib/curriculum/scripts/generate-english-audio.ts`, `lib/curriculum/src/__tests__/englishGrammar.test.ts`

**Interfaces:**
- Consumes: `allGrammarSpoken()` (Task 1).

- [ ] **Step 1: Extend the collision test** (write it first). In `englishGrammar.test.ts` change the recording-key test to walk `allGrammarSpoken()` (add it to the import) instead of `allGrammarSentences()`, and add after the loop:

```ts
  // Grade 2 added the Yes or No questions and exchanges; they are in the list too.
  const spoken = new Set(allGrammarSpoken());
  for (const t of ['Is it a car? Yes, it is.', 'Is it a plane?', "Is it a plane? No, it isn't.", 'Do you like cheese?', "Do you like cheese? No, I don't."]) {
    assert.ok(spoken.has(t), t);
  }
```
Run: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammar.test.ts` — expected PASS (the function exists since Task 1; this pins the new strings and checks no slug collides with a word or another string).

- [ ] **Step 2: Switch the script.** In `generate-english-audio.ts` change the import to `allGrammarSpoken` and the constant to:

```ts
/** Every string the grammar activities speak (sentences, and Yes or No's questions and exchanges), voiced like the grade's words. */
const GRAMMAR_SENTENCES = allGrammarSpoken();
```

- [ ] **Step 3: Check the new strings without keys.** The script needs R2 and OpenAI keys to run, so confirm the list instead:

Run: `cd lib/curriculum && node --experimental-strip-types -e "import('./src/englishGrammar.ts').then(m => console.log(m.allGrammarSentences().length, '->', m.allGrammarSpoken().length))"`
Expected: two counts, the second larger. Record both numbers in the commit message. Then `pnpm --filter @workspace/curriculum run typecheck`.

- [ ] **Step 4: Commit**

```bash
git add lib/curriculum/scripts/generate-english-audio.ts lib/curriculum/src/__tests__/englishGrammar.test.ts
git commit -m "feat(curriculum): voice the Yes or No questions and exchanges with the grammar sentences

The script walks allGrammarSpoken(), so the next voicing run covers them.
Not run here: it needs the OpenAI and R2 keys.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 5: Mobile builders

**Files:**
- Modify: `artifacts/mobile/services/englishHub/games.ts`
- Test: `artifacts/mobile/services/__tests__/englishGrammarG2Games.test.ts` (new)

**Interfaces:**
- Consumes: `GrammarSentence.yesNo`, `grammarUnitsForGrade`.
- Produces (exports of `games.ts`):
  - `HubActivity` gains `'grammar-yesno'`; `GRAMMAR_ACTIVITIES` and `SCORED_ACTIVITIES` include it
  - `interface YesNoQuestion { sentence: GrammarSentence; picture: { word: string; count: 1 | 2 }; marker: GrammarMarker | null; kind: 'match' | 'marker'; question: string; answer: boolean; yes: string; no: string }`
  - `buildYesNoRound(sentences: readonly GrammarSentence[], rng?: () => number): YesNoQuestion[]`
  - `isYesNoRight(q: YesNoQuestion, saidYes: boolean): boolean`
  - `yesNoExchange(q: YesNoQuestion): string` — the whole exchange spoken after an answer
  - `grammarActivityAvailable('grammar-yesno', sentences)` (≥ 4 sentences with `yesNo` and a picture)

- [ ] **Step 1: Write the failing test** — create `artifacts/mobile/services/__tests__/englishGrammarG2Games.test.ts`:

```ts
/**
 * Round builders on the Grade 2 grammar data, and Yes or No. The builders do not gate on review
 * (the lesson screen's `offeredGrammar` does), so they are tested over every Grade 2 unit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  EMPTY_PROGRESS,
  GRAMMAR_ACTIVITIES,
  MAX_BUILD_TILES,
  ROUND_LENGTH,
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  buildYesNoRound,
  grammarActivityAvailable,
  isYesNoRight,
  lessonStars,
  recordResult,
  yesNoExchange,
} from '../englishHub/games.ts';

const UNITS = grammarUnitsForGrade(2).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const YES_NO_UNITS = ['kbl-g2-eng-s1-nccd-u1_l1', 'kbl-g2-eng-s2-nccd-u6_l1'];
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());

describe('the Grade 1 activities on Grade 2 data', () => {
  it('Choose, Build and True or false are offered on every Grade 2 unit', () => {
    assert.equal(UNITS.length, 8);
    for (const { id, sentences } of UNITS) {
      for (const a of ['grammar-choose', 'grammar-build', 'grammar-true'] as const) {
        assert.ok(grammarActivityAvailable(a, sentences), `${id} ${a}`);
      }
    }
  });

  it('every round is well formed and no Build sentence is longer than the cap', () => {
    for (const { id, sentences } of UNITS) {
      for (const seed of SEEDS) {
        for (const q of buildChooseRound(sentences, makeRng(seed))) {
          assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
          assert.notEqual(q.options[0], q.options[1], id);
        }
        for (const q of buildSentenceRound(sentences, makeRng(seed))) {
          assert.ok(q.sentence.tokens.length <= MAX_BUILD_TILES, q.sentence.text);
          assert.equal(q.tiles.length, q.sentence.tokens.length);
        }
        for (const q of buildTrueFalseRound(sentences, makeRng(seed))) {
          assert.ok(q.sentence.picture && q.sentence.falsePicture, q.sentence.key);
        }
      }
    }
  });

  it('a Yes or No sentence is never a Choose or True or false item', () => {
    for (const { sentences } of UNITS) {
      const asked = new Set(sentences.filter(s => s.yesNo).map(s => s.key));
      for (const seed of SEEDS) {
        for (const q of buildChooseRound(sentences, makeRng(seed))) assert.ok(!asked.has(q.sentence.key), q.sentence.key);
        for (const q of buildTrueFalseRound(sentences, makeRng(seed))) assert.ok(!asked.has(q.sentence.key), q.sentence.key);
      }
    }
  });
});

describe('Yes or No', () => {
  it('is offered on toys and food only', () => {
    for (const { id, sentences } of UNITS) {
      assert.equal(grammarActivityAvailable('grammar-yesno', sentences), YES_NO_UNITS.includes(id), id);
    }
    assert.ok(GRAMMAR_ACTIVITIES.includes('grammar-yesno'));
  });

  it('a round is eight items, half Yes and half No, never a picture twice, and every exchange is voiced', () => {
    for (const { id, sentences } of UNITS.filter(u => YES_NO_UNITS.includes(u.id))) {
      for (const seed of SEEDS) {
        const round = buildYesNoRound(sentences, makeRng(seed));
        assert.equal(round.length, ROUND_LENGTH, id);
        assert.equal(round.filter(q => q.answer).length, ROUND_LENGTH / 2, id);
        const pictures = round.map(q => q.picture.word);
        assert.equal(new Set(pictures).size, pictures.length, `${id}: a picture twice`);
        for (const q of round) {
          assert.ok(spoken.has(q.question), q.question);
          assert.ok(spoken.has(yesNoExchange(q)), yesNoExchange(q));
        }
      }
    }
  });

  it('a match question names the picture exactly when the answer is Yes', () => {
    const toys = UNITS.find(u => u.id === YES_NO_UNITS[0])!.sentences;
    for (const seed of SEEDS) {
      for (const q of buildYesNoRound(toys, makeRng(seed))) {
        assert.equal(q.kind, 'match');
        const named = /^Is it an? (.+)\?$/.exec(q.question)![1];
        assert.equal(named === q.picture.word, q.answer, q.question);
        assert.equal(isYesNoRight(q, q.answer), true);
        assert.equal(isYesNoRight(q, !q.answer), false);
        assert.equal(yesNoExchange(q), `${q.question} ${q.answer ? "Yes, it is." : "No, it isn't."}`);
      }
    }
  });

  it('a marker answer follows the ✅ / ❌ beside the picture', () => {
    const food = UNITS.find(u => u.id === YES_NO_UNITS[1])!.sentences;
    for (const seed of SEEDS) {
      for (const q of buildYesNoRound(food, makeRng(seed))) {
        assert.equal(q.kind, 'marker');
        assert.equal(q.answer, q.marker === 'yes', q.question);
        assert.equal(yesNoExchange(q), q.sentence.text, q.question);
      }
    }
  });

  it('stars for it count toward the lesson', () => {
    const p = recordResult(EMPTY_PROGRESS, YES_NO_UNITS[0], 'grammar-yesno', 3, '2026-10-19');
    assert.equal(lessonStars(p, YES_NO_UNITS[0]), 3);
  });
});
```

- [ ] **Step 2: Run to make sure it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishGrammarG2Games.test.ts`
Expected: FAIL (`buildYesNoRound` is not exported).

- [ ] **Step 3: Implement in `games.ts`.**

(a) Import: `import type { GrammarMarker, GrammarSentence } from '@workspace/curriculum/englishGrammar';`.

(b) Types and lists — `HubActivity` gets `| 'grammar-yesno'` after `'grammar-true'`; `GRAMMAR_ACTIVITIES` becomes `['grammar-choose', 'grammar-build', 'grammar-true', 'grammar-yesno']`; `SCORED_ACTIVITIES` gets `'grammar-yesno'` after `'grammar-true'`.

(c) After `buildTrueFalseRound` and before `grammarActivityAvailable` add:

```ts
// ─── Yes or No (Grade 2) ────────────────────────────────────────────────────

export interface YesNoQuestion {
  sentence: GrammarSentence;
  picture: { word: string; count: 1 | 2 };
  marker: GrammarMarker | null;
  kind: 'match' | 'marker';
  /** What the child is asked, in English. */
  question: string;
  /** True when the right answer is «yes». */
  answer: boolean;
  yes: string;
  no: string;
}

function yesNoUsable(s: GrammarSentence): boolean {
  return s.yesNo !== null && s.picture !== null;
}

function yesNoItem(s: GrammarSentence, question: string, answer: boolean): YesNoQuestion {
  const y = s.yesNo!;
  return { sentence: s, picture: s.picture!, marker: s.marker, kind: y.kind, question, answer, yes: y.yes, no: y.no };
}

/** The whole exchange, spoken once the child has answered: a string `allGrammarSpoken` lists. */
export function yesNoExchange(q: YesNoQuestion): string {
  return `${q.question} ${q.answer ? q.yes : q.no}`;
}

/**
 * Half the round (rounded up) answers «yes», the rest «no», then shuffled. A `match` sentence gives
 * a Yes item (the question names its picture) and a No item (it names the next pictured word); a
 * `marker` sentence gives the one item its ✅ / ❌ decides. The same picture is not asked twice
 * (cheese ✅ and cheese ❌ would be two questions about one picture).
 */
export function buildYesNoRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): YesNoQuestion[] {
  const yesItems: YesNoQuestion[] = [];
  const noItems: YesNoQuestion[] = [];
  for (const s of sentences.filter(yesNoUsable)) {
    const y = s.yesNo!;
    if (y.kind === 'match') {
      yesItems.push(yesNoItem(s, y.question, true));
      if (y.otherQuestion) noItems.push(yesNoItem(s, y.otherQuestion, false));
    } else {
      (y.answer ? yesItems : noItems).push(yesNoItem(s, y.question, y.answer));
    }
  }
  const wantYes = Math.ceil(ROUND_LENGTH / 2);
  const wantNo = ROUND_LENGTH - wantYes;
  const yes = sample(yesItems, wantYes, rng);
  const taken = new Set(yes.map(q => q.picture.word));
  const fresh = noItems.filter(q => !taken.has(q.picture.word));
  const no = sample(fresh.length >= wantNo ? fresh : noItems, wantNo, rng);
  return shuffle([...yes, ...no], rng);
}

export function isYesNoRight(q: YesNoQuestion, saidYes: boolean): boolean {
  return saidYes === q.answer;
}
```

(d) In `grammarActivityAvailable` add the case before `: []`:

```ts
          : activity === 'grammar-yesno' ? sentences.filter(yesNoUsable)
```
(chained after the `grammar-true` branch).

- [ ] **Step 4: Run the tests**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/englishGrammarG2Games.test.ts services/__tests__/englishGrammarGames.test.ts` — PASS, then `pnpm test` in `artifacts/mobile` — all pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/englishHub/games.ts artifacts/mobile/services/__tests__/englishGrammarG2Games.test.ts
git commit -m "feat(english-hub): the Yes or No round builder

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 6: The screen, the card and the strings

**Files:**
- Modify: `artifacts/mobile/components/englishHub/GrammarActivities.tsx`, `artifacts/mobile/app/curriculum/english/[lessonId].tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: Task 5's `buildYesNoRound`, `isYesNoRight`, `yesNoExchange`, `YesNoQuestion`; existing `Feedback`, `GrammarPicture`, `EnglishLine`, `HearButton`, `Progress`, `RIGHT`, `WRONG`.
- Produces: `YesNo({ sentences, onFinish })`.

- [ ] **Step 1: Strings.** In `services/i18n.ts`, after `hubGIsFalse: 'خطأ',` add:

```ts
    hubGYesNo: 'نعم أم لا',
    hubGYesNoDesc: 'اختر الجواب المناسب للصورة',
    hubGYesNoLikes: '✅ = يحبّ الطفل هذا الطعام، ❌ = لا يحبّه',
```
and after `hubGIsFalse: 'False',` add:

```ts
    hubGYesNo: 'Yes or No',
    hubGYesNoDesc: 'Pick the answer that fits the picture',
    hubGYesNoLikes: "✅ = the child likes it, ❌ = the child doesn't",
```

- [ ] **Step 2: The screen.** In `GrammarActivities.tsx` add `buildYesNoRound, isYesNoRight, yesNoExchange,` to the `games` import, and after `TrueFalse` add:

```tsx
// ─── Yes or No ──────────────────────────────────────────────────────────────

export function YesNo({ sentences, onFinish }: { sentences: readonly GrammarSentence[]; onFinish: Finish }) {
  const colors = useColors();
  const { t } = useLanguage();
  const round = useMemo(() => buildYesNoRound(sentences), [sentences]);
  const [i, setI] = useState(0);
  const [picked, setPicked] = useState<boolean | null>(null);
  const [correct, setCorrect] = useState(0);
  const q = round[i];

  const pick = (saidYes: boolean) => {
    if (picked !== null) return;
    setPicked(saidYes);
    const ok = isYesNoRight(q, saidYes);
    if (ok) setCorrect(c => c + 1);
    buzz(ok);
  };

  const next = () => {
    if (i + 1 >= round.length) return onFinish(correct, round.length);
    setI(i + 1);
    setPicked(null);
    // Hearing the question gives nothing away, as in True or false: it is read with the sound.
    void playWord(round[i + 1].question);
  };

  const answerButton = (saidYes: boolean) => {
    const text = saidYes ? q.yes : q.no;
    const shown = picked !== null && (saidYes === q.answer || saidYes === picked);
    const tint = !shown ? colors.border : saidYes === q.answer ? RIGHT : WRONG;
    return (
      <Pressable
        key={String(saidYes)}
        onPress={() => pick(saidYes)}
        accessibilityRole="button"
        accessibilityLabel={text}
        style={[styles.answerBtn, { borderColor: tint, backgroundColor: shown ? tint + '18' : colors.card }]}
      >
        <Ionicons name={saidYes ? 'checkmark' : 'close'} size={32} color={saidYes ? RIGHT : WRONG} />
        <Text style={[styles.answerText, { color: colors.foreground }]}>{text}</Text>
      </Pressable>
    );
  };

  return (
    <View style={{ gap: 16, alignItems: 'center' }}>
      <Progress i={i} n={round.length} />
      <GrammarPicture word={q.picture.word} count={q.picture.count} marker={q.marker} />
      {q.kind === 'marker' ? (
        <Text style={{ color: colors.mutedForeground, fontFamily: 'Almarai_400Regular', fontSize: 13, textAlign: 'center' }}>{t('hubGYesNoLikes')}</Text>
      ) : null}
      <EnglishLine text={q.question} />
      {picked === null ? <HearButton word={q.question} /> : null}
      {/* ✓ on the left in both languages: the pair is read with the English question. */}
      <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
        {answerButton(true)}
        {answerButton(false)}
      </View>
      {picked !== null ? (
        <Feedback ok={isYesNoRight(q, picked)} answer={q.answer ? q.yes : q.no} onNext={next} sentence={yesNoExchange(q)} />
      ) : null}
    </View>
  );
}
```
and to `styles`:

```ts
  answerBtn: { flex: 1, borderWidth: 1.5, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 8, alignItems: 'center', gap: 4 },
  answerText: { fontFamily: 'ReadexPro_600SemiBold', fontSize: TYPE.bodyLg, textAlign: 'center', writingDirection: 'ltr' },
```
(import `TYPE` from `@/constants/theme`; the design-scale test fails on any off-scale font size, so use the scale).

- [ ] **Step 3: The lesson screen.** In `[lessonId].tsx`: add `YesNo` to the `GrammarActivities` import; add to `META`:

```ts
  'grammar-yesno': { icon: 'chatbubbles-outline', title: 'hubGYesNo', desc: 'hubGYesNoDesc' },
```
and the route after the `grammar-true` line:

```tsx
    if (grammar && activity === 'grammar-yesno') return <YesNo key={round} sentences={grammar} onFinish={finish} />;
```

- [ ] **Step 4: Typecheck and the suites**

Run: `pnpm run typecheck` (root) — no errors; `cd artifacts/mobile && pnpm test` — all pass (the design-scale and terminology tests included).

- [ ] **Step 5: Browser check** (never committed). Sign off two units **in the working tree only** by setting `reviewedBy: { name: 'LOCAL', date: 'x' }` on S1 U1 and S2 U6 in `GRAMMAR_UNITS_G2`; build the web app (`cd artifacts/mobile && EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), **restore the file immediately** (`git checkout lib/curriculum/src/englishGrammarG2.ts`, then `grep -c LOCAL` = 0), serve it with `node e2e/serve.mjs` (port 8098) and drive `/curriculum/english/kbl-g2-eng-s1-nccd-u1_l1` and `…-s2-nccd-u6_l1` with Playwright (Chromium at `/opt/pw-browsers/chromium`; `localStorage` `@iqra_intro_seen_v1`; `@iqra_language` `ar` then `en`; 4.5 s splash wait; viewport 390×844). For each language: open «نعم أم لا» / «Yes or No», screenshot the question, tap an answer, screenshot the feedback. Check: the question and both answers read left to right; the answer line in Arabic keeps «No, it isn't.» whole; the food screen shows the ✅ / ❌ hint; an unsigned unit (S1 U2) shows no Yes or No card; a signed toys unit shows Choose, Build, True or false and Yes or No. Stop the server with `kill` by PID (not `pkill -f`).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/components/englishHub/GrammarActivities.tsx "artifacts/mobile/app/curriculum/english/[lessonId].tsx" artifacts/mobile/services/i18n.ts
git status --short   # nothing else, and no sign-off in englishGrammarG2.ts
git commit -m "feat(english-hub): the Yes or No screen, shown per unit once signed off

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
```

---

### Task 7: STATUS.md and wrap-up

**Files:**
- Modify: `STATUS.md`, `docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md`

- [ ] **Step 1: STATUS.md.** After the «Grade 1 reading in the English corner» section add «Grade 2 grammar in the English corner — built, shown to nobody yet, 2026-10-19»: what it is (4 activities incl. Yes or No; 8 of 9 lessons; 212 sentences; no S2 U0 in the hub; S1 U3 none); that every unit is `reviewedBy: null` in `englishGrammarG2.ts`; the form `docs/english-grammar-g2-review.html` and sheet (regenerate with `pnpm --filter @workspace/curriculum run grammar-sheet`; tests pin them; the Grade 1 files unchanged); the not-covered table and the four open points for the teacher (eye-colour circle, whose ✅, hot/cold faces, ages five to ten); the audio step (`english-audio` now voices `allGrammarSpoken()`; needs keys); and **To switch a unit on**: voice, teacher signs the unit's page, set `reviewedBy`.

- [ ] **Step 2: Spec status.** Change the spec's **Status** line to «implemented (PR #1158)».

- [ ] **Step 3: Full verification before pushing**

Run, and read the output: `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test`; `git status --short` (clean apart from the commit); `git diff origin/main --stat -- docs/english-grammar-g1-sheet.md docs/english-grammar-g1-review.html docs/english-reading-g1-review.html` (empty).

- [ ] **Step 4: Commit, merge `main`, push**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-19-english-corner-grammar-g2-design.md docs/superpowers/plans/2026-10-19-english-corner-grammar-g2.md
git commit -m "docs: Grade 2 grammar in STATUS.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
git fetch origin main && git merge origin/main
```
Re-run the checks in Step 3 if the merge brought changes, then `git push -u origin ccr-d9db5f6c-mgwkuo`, update PR #1158's title and body to describe the build, and mark it ready only when the user asks.
