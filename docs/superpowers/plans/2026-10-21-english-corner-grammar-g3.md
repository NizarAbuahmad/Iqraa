# English corner: Grade 3 grammar — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Grammar activities for the 8 Grade 3 hub lessons (324 sentences), hidden until a teacher signs each unit's printed form.

**Architecture:** The shared engine (`lib/curriculum/src/englishGrammar.ts`) gets seven additive changes (word forms, verb forms `{v:} {3:} {ing:}`, a verb-form Choose, `rows`, a `fact` Yes or No with a `hint`, a `build` half and a Grade 3 cap, spoken prompts). The Grade 3 data lives in a new file, as Grade 2's does. The form and sheet already take a grade. The app changes in `games.ts` and two screens.

**Tech Stack:** TypeScript, node:test (`node --experimental-strip-types --test`), Expo / React Native (+ web build), Playwright.

**Spec:** `docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md` (approved 2026-10-22). Two deviations found while drafting the data, recorded in the spec by Task 8: the sentence count is **324** (S2 U10 is 38, not 40: `grapes` cannot take «Is there a…?»), and `{v:slot}` (a base verb phrase split into tiles) is a fourth verb form alongside `{3:}` and `{ing:}`.

## Global Constraints

- Every Grade 3 unit ships `reviewedBy: null`. **Never commit a sign-off**; a local one for the browser check is restored immediately (`grep -c LOCAL` = 0).
- The Grade 1 and 2 grammar sheets and forms and both reading forms must stay **byte-identical**; the Grade 1 and 2 tests keep passing. Where a test deep-compares an object that gained a field (`yesNo.hint`), update the expectation, never loosen it.
- A picture appears only where it shows what the sentence says: none on S1 U2, U4, S2 U7, U8. Yes or No only on S2 U9 and U10.
- Build the sentence: cap **9** for Grade 3, **7** for Grades 1–2 (`buildCap`). A sentence over the cap builds its answer half, the question printed above; a sentence that can be built neither way is `build: null` and a test fails for any Grade 3 sentence like that.
- Slot words come from this lesson, an earlier Grade 3 lesson, or any Grade 1–2 lesson. Free-text slots, checked by nobody but the teacher's form: `ability`, `pre`, `poss`.
- The form's English runs go through `ltr()` unescaped: strings in `NOT_COVERED_G3` contain no `"`, `&`, `<`, `>`.
- Arabic UI strings only; brand «إقرأ», never «اقرأ» in UI strings; fonts from `TYPE`; pictures are artwork constants.
- Commits end with the two trailer lines (`Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`). No model id elsewhere. Push only to `ccr-d9db5f6c-mgwkuo`.
- Mobile tests live only in `artifacts/mobile/services/__tests__/` and may not import react-native/expo.
- Commands: curriculum `pnpm --filter @workspace/curriculum test` (one file: `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/<file>`); mobile `cd artifacts/mobile && pnpm test` (one file: `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/<file>`; the full run takes ~4 min, run it in the background); typecheck `pnpm run typecheck` from the root (it rebuilds the curriculum declarations the mobile typecheck reads); docs `pnpm --filter @workspace/curriculum run grammar-sheet`.

---

### Task 1: Word forms

**Files:** Modify `lib/curriculum/src/englishGrammar.ts`; test `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts`.

**Produces:** `pluralOf` handles -es / -ies / overrides; `withArticle` returns no article for the new plural-form and uncountable words.

- [ ] **Step 1: Failing test** — append to `englishGrammarEngine.test.ts`:

```ts
test('Grade 3 word forms: -es and -ies plurals, plural-form words, uncountables', () => {
  for (const [word, plural] of [
    ['torch', 'torches'], ['mango', 'mangoes'], ['ice lolly', 'ice lollies'], ['dress', 'dresses'], ['monkey', 'monkeys'],
    ['kiwi', 'kiwis'], ['baseball cap', 'baseball caps'], ['sheep', 'sheep'], ['glasses', 'glasses'], ['sandals', 'sandals'],
    ['trainers', 'trainers'], ['pyjamas', 'pyjamas'], ['keys', 'keys'],
  ] as const) assert.equal(pluralOf(word), plural, word);
  for (const [word, phrase] of [
    ['glasses', 'glasses'], ['sandals', 'sandals'], ['trainers', 'trainers'], ['pyjamas', 'pyjamas'], ['keys', 'keys'],
    ['shampoo', 'shampoo'], ['toothpaste', 'toothpaste'], ['sunscreen', 'sunscreen'],
    ['ice lolly', 'an ice lolly'], ['television', 'a television'], ['armchair', 'an armchair'],
  ] as const) assert.equal(withArticle(word), phrase, word);
});
```

- [ ] **Step 2: Run to fail** — `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts` → FAIL (`torchs`, `mangos`…).

- [ ] **Step 3: Implement** in `englishGrammar.ts`. Replace the `PLURAL_FORMS` set, `PLURAL_OVERRIDES` and `pluralOf` with:

```ts
const PLURAL_FORMS = new Set([
  'boots', 'jeans', 'socks', 'arms', 'feet', 'hands', 'legs',
  'apples', 'cakes', 'carrots', 'grapes', 'lemons', 'sweets',
  'eggs', 'scissors', 'shoes', 'shorts', 'trousers',
  'rice', 'bread', 'cheese', 'chicken', 'juice', 'milk', 'water',
  // Grade 3: plural in form, or uncountable.
  'glasses', 'sandals', 'trainers', 'pyjamas', 'keys', 'shampoo', 'toothpaste', 'sunscreen',
]);
```
```ts
/** Irregular plurals (Grade 2) and words the rules below get wrong. «fish» is an animal in Unit 5 and a food in Unit 6; both take the same plural. */
const PLURAL_OVERRIDES: Record<string, string> = {
  mouse: 'mice', fish: 'fish', potato: 'potatoes', tomato: 'tomatoes', shelf: 'shelves', mango: 'mangoes', sheep: 'sheep',
};
```
```ts
export function pluralOf(word: string): string {
  if (PLURAL_FORMS.has(word)) return word;
  if (PLURAL_OVERRIDES[word]) return PLURAL_OVERRIDES[word];
  if (/(s|x|z|ch|sh)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}
```

- [ ] **Step 4: Run** the engine test (PASS), then `pnpm --filter @workspace/curriculum test` — **the Grade 1 and 2 sheet/form pins must still pass**. If one fails, a Grade 1 or 2 word hit the new rule: add it to `PLURAL_OVERRIDES` rather than weakening the rule.

- [ ] **Step 5: Commit** `feat(curriculum): plural and article forms the Grade 3 words need` (files: engine + test).

---

### Task 2: Verb forms, the verb-form Choose, and rows

**Files:** Modify `englishGrammar.ts`; test `englishGrammarEngine.test.ts`.

**Produces:** `thirdPerson(phrase)`, `presentParticiple(phrase)`; slot forms `{v:slot}` (base verb phrase, one tile per word), `{3:slot}`, `{ing:slot}`; `GrammarPattern.rows?: Record<string, string>[]`; `choose: { kind: 'form'; slot }` and `GrammarSentence.choose.kind` gains `'form'`.

- [ ] **Step 1: Failing tests** — append to `englishGrammarEngine.test.ts` (add `presentParticiple, thirdPerson` to the import):

```ts
test('third person and -ing: the first word is inflected unless the whole phrase is listed', () => {
  for (const [phrase, third] of [
    ['play', 'plays'], ['watch TV', 'watches TV'], ['read books', 'reads books'], ['have breakfast', 'has breakfast'],
    ['go to school', 'goes to school'], ['do homework', 'does homework'], ['roller skate', 'roller skates'],
    ['skateboard', 'skateboards'], ['get up', 'gets up'], ['brush', 'brushes'], ['fix', 'fixes'], ['study', 'studies'],
    ['play with my friends', 'plays with my friends'],
  ] as const) assert.equal(thirdPerson(phrase), third, phrase);
  for (const [phrase, ing] of [
    ['brush the horses', 'brushing the horses'], ['clean the cage', 'cleaning the cage'], ['collect the eggs', 'collecting the eggs'],
    ['fix the gate', 'fixing the gate'], ['milk the cows', 'milking the cows'], ['sweep the barn', 'sweeping the barn'],
    ['make', 'making'], ['run', 'running'], ['die', 'dying'],
  ] as const) assert.equal(presentParticiple(phrase), ing, phrase);
});

const VERB_UNIT: GrammarUnit = {
  lessonId: 'kbl-g3-eng-s1-nccd-u4_l1',
  reviewedBy: null,
  patterns: [
    { id: 'he', text: 'He {3:act}.', choose: { kind: 'form', slot: 'act' } },
    { id: 'dont', text: "He doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
  ],
  slots: { act: ['watch TV', 'play tennis', 'roller skate', 'have lunch', 'skateboard'] },
};

test('a verb phrase is one tile per word, and the form Choose blanks the one word that changes', () => {
  const he = unitSentences(VERB_UNIT).filter(s => s.patternId === 'he');
  const by = (text: string) => he.find(s => s.text === text)!;
  assert.deepEqual(by('He watches TV.').tokens, ['He', 'watches', 'TV.']);
  assert.deepEqual(by('He watches TV.').choose, { kind: 'form', start: 1, length: 1, right: 'watches', wrong: 'watch' });
  assert.deepEqual(by('He has lunch.').choose, { kind: 'form', start: 1, length: 1, right: 'has', wrong: 'have' });
  assert.deepEqual(by('He roller skates.').tokens, ['He', 'roller', 'skates.']);
  assert.deepEqual(by('He roller skates.').choose, { kind: 'form', start: 2, length: 1, right: 'skates', wrong: 'skate' });
  // The verb last in the sentence: the full stop stays off the options.
  assert.deepEqual(by('He skateboards.').choose, { kind: 'form', start: 1, length: 1, right: 'skateboards', wrong: 'skateboard' });
  const dont = unitSentences(VERB_UNIT).find(s => s.patternId === 'dont' && s.text.includes('have'))!;
  assert.deepEqual(dont.tokens, ['He', "doesn't", 'have', 'lunch.']);
  for (const s of he) {
    const blanked = s.tokens.slice(s.choose!.start, s.choose!.start + s.choose!.length).join(' ').replace(/[.?!,]+$/, '');
    assert.equal(blanked, s.choose!.right, s.text);
    assert.notEqual(s.choose!.right, s.choose!.wrong, s.text);
  }
});

test('rows replace the cross-product, and a slot used twice takes the same value', () => {
  const unit: GrammarUnit = {
    lessonId: 'kbl-g3-eng-s1-nccd-u2_l1',
    reviewedBy: null,
    patterns: [{
      id: 'when',
      text: 'When do you {v:act}? We {v:act} {pre} {time}.',
      rows: [{ act: 'go home', pre: 'in the', time: 'afternoon' }, { act: 'go to bed', pre: 'at', time: 'night' }],
      choose: { kind: 'phrase', right: 'do', wrong: 'does' },
    }],
    slots: { act: ['go home', 'go to bed', 'get up'] },
  };
  assert.deepEqual(unitSentences(unit).map(s => s.text), [
    'When do you go home? We go home in the afternoon.',
    'When do you go to bed? We go to bed at night.',
  ]);
  assert.equal(new Set(unitSentences(unit).map(s => s.key)).size, 2);
});
```

- [ ] **Step 2: Run to fail** (`thirdPerson` is not exported).

- [ ] **Step 3: Implement** in `englishGrammar.ts`.

(a) Types. In `GrammarPattern` add, after `text`: `/** Explicit slot values for this pattern instead of every combination of its slots (a routine with its time, an animal with its ability). */ rows?: Record<string, string>[];`, update the doc comment of `text` to ``{slot}` bare, `{a:slot}` with a/an, `{s:slot}` plural, `{v:slot}` a verb phrase split into tiles, `{3:slot}` its third-person form, `{ing:slot}` its -ing form.``, and add a fourth member to `choose`: `| { kind: 'form'; slot: string }` with the comment `/** The slot's verb in its third-person form against the base form («plays» / «play»). The pattern's text must use {3:slot}. */`. In `GrammarSentence.choose` change `kind: 'phrase' | 'slot' | 'whole'` to `kind: 'phrase' | 'slot' | 'whole' | 'form'`.

(b) Forms — add after `pluralOf`:

```ts
// ─── Verb forms (Grade 3) ─────────────────────────────────────────────────

const THIRD_WORDS: Record<string, string> = { have: 'has', go: 'goes', do: 'does' };
/** A phrase whose verb is not its first word. */
const THIRD_PHRASES: Record<string, string> = { 'roller skate': 'roller skates' };
const ING_WORDS: Record<string, string> = { get: 'getting', run: 'running', swim: 'swimming', sit: 'sitting', stop: 'stopping' };

function inflectFirst(phrase: string, fn: (word: string) => string): string {
  const [first, ...rest] = phrase.split(' ');
  return [fn(first), ...rest].join(' ');
}

function thirdWord(word: string): string {
  if (THIRD_WORDS[word]) return THIRD_WORDS[word];
  if (/(s|sh|ch|x|z|o)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
}

function ingWord(word: string): string {
  if (ING_WORDS[word]) return ING_WORDS[word];
  if (/ie$/.test(word)) return `${word.slice(0, -2)}ying`;
  if (/[^e]e$/.test(word)) return `${word.slice(0, -1)}ing`;
  return `${word}ing`;
}

/** «watch TV» → «watches TV». The first word is the verb unless the whole phrase is listed. */
export function thirdPerson(phrase: string): string {
  return THIRD_PHRASES[phrase] ?? inflectFirst(phrase, thirdWord);
}

/** «brush the horses» → «brushing the horses». */
export function presentParticiple(phrase: string): string {
  return inflectFirst(phrase, ingWord);
}
```

(c) The slot syntax: `const SLOT = /\{(?:(a|s|v|3|ing):)?([A-Za-z0-9]+)\}/g;`.

(d) In `realise`, replace the `if (form === 's') … else {…}` block with:

```ts
    if (form === 's') tokens.push(pluralOf(word));
    else if (form === 'v') tokens.push(...word.split(' '));
    else if (form === '3') tokens.push(...thirdPerson(word).split(' '));
    else if (form === 'ing') tokens.push(...presentParticiple(word).split(' '));
    else {
      const article = form === 'a' ? articleFor(word) : null;
      if (article) tokens.push(article);
      tokens.push(word);
    }
```

(e) Rows and the slot list. Add before `unitSentences`:

```ts
/** A slot's words: the unit's own list, or, for a slot that only the rows name, the values the rows give it. */
function slotList(unit: GrammarUnit, p: GrammarPattern, slot: string): string[] {
  return unit.slots[slot] ?? [...new Set((p.rows ?? []).map(r => r[slot]).filter(Boolean))];
}
```
In `unitSentences` change `for (const fill of fills(slots, unit.slots)) {` to `for (const fill of p.rows ?? fills(slots, unit.slots)) {`, and replace the two uses `unit.slots[p.picture]` / `unit.slots[c.slot]` (in `otherWord = …` and the `slot` choose branch) with `slotList(unit, p, p.picture)` and `slotList(unit, p, c.slot)`.

(f) The form Choose — add this branch after the `whole` branch of the `choose` chain:

```ts
      } else if (c?.kind === 'form') {
        // The same sentence with the base verb: the one token that differs is what Choose blanks.
        const base = realise(p.text.replace(`{3:${c.slot}}`, `{v:${c.slot}}`), fill).tokens;
        const at = tokens.findIndex((t, i) => t !== base[i]);
        if (at < 0 || tokens.length !== base.length) throw new Error(`"${p.text}" has no verb form to choose in «${tokens.join(' ')}»`);
        choose = { kind: 'form', start: at, length: 1, right: strip(tokens[at]), wrong: strip(base[at]) };
      }
```
(placing the closing `}` of the chain after it; the `else if (c?.kind === 'whole' && picture) {…}` block loses its own closing brace to this `}`: keep the chain a single `if / else if` ladder.)

- [ ] **Step 4: Run** the engine test (PASS), `pnpm --filter @workspace/curriculum test` (Grade 1/2 pins still PASS) and `pnpm --filter @workspace/curriculum run typecheck`.

- [ ] **Step 5: Commit** `feat(curriculum): verb forms, a verb-form Choose and rows for Grade 3`.

---

### Task 3: `fact` Yes or No with a hint, the `build` half and cap, and the spoken prompts

**Files:** Modify `englishGrammar.ts`; test `englishGrammarEngine.test.ts` (update two deep-equals).

**Produces:** `yesNo.kind` adds `'fact'` (the pattern gives `answer`); `yesNo.hint: 'likes' | 'there' | null`; `GrammarSentence.build: { tokens: string[]; text: string; prompt: string | null } | null`; `buildCap(grade): 7 | 9`; `allGrammarSpoken()` also lists each `build.prompt`.

- [ ] **Step 1: Failing tests** — in `englishGrammarEngine.test.ts` (add `buildCap` to the import):

(a) Update the two existing deep-equals: the match one (`car.yesNo`) gains `hint: null`, and the marker one (`yes.yesNo`) gains `hint: 'likes'`.

(b) Append:

```ts
const FACT_UNIT: GrammarUnit = {
  lessonId: 'kbl-g3-eng-s2-nccd-u10_l1',
  reviewedBy: null,
  patterns: [
    { id: 'y', text: 'Can {s:animal} {ability}? Yes, they can.', picture: 'animal', marker: 'many', rows: [{ animal: 'penguin', ability: 'swim' }],
      yesNo: { kind: 'fact', question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't.", answer: true } },
    { id: 'n', text: "Can {s:animal} {ability}? No, they can't.", picture: 'animal', marker: 'many', rows: [{ animal: 'penguin', ability: 'fly' }],
      yesNo: { kind: 'fact', question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't.", answer: false } },
    { id: 'there', text: 'Is there {a:food}? No, there isn\'t.', picture: 'food', marker: 'no', rows: [{ food: 'coconut' }],
      yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
  ],
  slots: {},
};

test('a fact Yes or No answers from its own row, with no marker and no hint', () => {
  const [yes, no, there] = unitSentences(FACT_UNIT);
  assert.equal(yes.text, 'Can penguins swim? Yes, they can.');
  assert.deepEqual(yes.picture, { word: 'penguin', count: 2 });
  assert.deepEqual(yes.yesNo, { kind: 'fact', question: 'Can penguins swim?', otherQuestion: null, yes: 'Yes, they can.', no: "No, they can't.", answer: true, hint: null });
  assert.equal(no.yesNo!.answer, false);
  assert.equal(yes.choose, null);
  assert.equal(yes.falsePicture, null);
  assert.equal(there.yesNo!.hint, 'there');
  assert.equal(there.yesNo!.answer, false);
});

test('Build: a cap by grade; a long question-and-answer pair builds its answer half; nothing else is dropped silently', () => {
  assert.equal(buildCap(1), 7);
  assert.equal(buildCap(2), 7);
  assert.equal(buildCap(3), 9);
  const unit = (lessonId: string, texts: string[]): GrammarUnit => ({
    lessonId, reviewedBy: null, slots: {}, patterns: texts.map((text, i) => ({ id: `p${i}`, text })),
  });
  const g3 = unitSentences(unit('kbl-g3-eng-s1-nccd-u2_l1', [
    'When do you go home? We go home in the afternoon.',
    'We have dinner.',
    'I get up and I wash and I eat and I go to school now.',
    'Hello.',
  ]));
  assert.deepEqual(g3[0].build, { tokens: ['We', 'go', 'home', 'in', 'the', 'afternoon.'], text: 'We go home in the afternoon.', prompt: 'When do you go home?' });
  assert.deepEqual(g3[1].build, { tokens: ['We', 'have', 'dinner.'], text: 'We have dinner.', prompt: null });
  assert.equal(g3[2].build, null, 'over the cap with no question half');
  assert.equal(g3[3].build, null, 'one tile');
  // Grade 2 stays at 7: the same 8-token pair builds its answer half there.
  const g2 = unitSentences(unit('kbl-g2-eng-s1-nccd-u1_l1', ['Is it a plane or a car? No, it is a big red car.']));
  assert.equal(g2[0].build!.prompt, 'Is it a plane or a car?');
});

test('every spoken string of a Build prompt is listed', () => {
  const all = new Set(allGrammarSpoken());
  for (const s of grammarUnitsForGrade(2).flatMap(u => unitSentences(u))) {
    if (s.build?.prompt) assert.ok(all.has(s.build.prompt), s.build.prompt);
  }
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement** in `englishGrammar.ts`.

(a) Types: in `GrammarPattern.yesNo` change to
```ts
  yesNo?: {
    kind: 'match' | 'marker' | 'fact';
    question: string;
    yes: string;
    no: string;
    /** `fact` only: the truth, e.g. «Can penguins swim?» → true. The picture is the subject, with no ✅ / ❌. */
    answer?: boolean;
    /** The line shown above a `marker` question: ✅ = the child likes it (default), or = it's there. */
    hint?: 'likes' | 'there';
  };
```
(extend its doc comment with a sentence about `fact`). In `GrammarSentence.yesNo` change `kind: 'match' | 'marker';` to `kind: 'match' | 'marker' | 'fact';` and add after `answer: boolean;`: `/** Which line the app shows above a `marker` question; null for the others. */ hint: 'likes' | 'there' | null;`. Add to `GrammarSentence` (after `yesNo`): 
```ts
  /**
   * What Build the sentence puts in order: the whole sentence, or, over the grade's cap, its answer
   * half with the question as `prompt`. Null when it can be built neither way.
   */
  build: { tokens: string[]; text: string; prompt: string | null } | null;
```

(b) Add after `unitGrade`/`grammarUnitsForGrade`:

```ts
/** Tiles a child can order: Grade 3 reads longer sentences than Grades 1 and 2. */
export function buildCap(grade: number): 7 | 9 {
  return grade >= 3 ? 9 : 7;
}

function buildOf(tokens: string[], cap: number): GrammarSentence['build'] {
  const part = (t: string[], prompt: string | null) => ({ tokens: t, text: t.join(' '), prompt });
  if (tokens.length >= 2 && tokens.length <= cap) return part(tokens, null);
  const q = tokens.findIndex(t => t.endsWith('?'));
  if (q < 0) return null;
  const answer = tokens.slice(q + 1);
  return answer.length >= 2 && answer.length <= cap ? part(answer, tokens.slice(0, q + 1).join(' ')) : null;
}
```

(c) In `unitSentences`: compute `const cap = buildCap(hubLesson(unit.lessonId)!.grade);` once before the loop; change the `yesNo` assignment to
```ts
        const answer = y.kind === 'match' ? true : y.kind === 'fact' ? Boolean(y.answer) : p.marker === 'yes';
        yesNo = { kind: y.kind, question, otherQuestion, yes: y.yes, no: y.no, answer, hint: y.hint ?? (y.kind === 'marker' ? 'likes' : null) };
```
and add `build: buildOf(tokens, cap),` to the pushed sentence object.

(d) `allGrammarSpoken`: after `out.add(s.text);` add `if (s.build?.prompt) out.add(s.build.prompt);`.

- [ ] **Step 4: Run** the engine test; `pnpm --filter @workspace/curriculum test` (Grade 1/2 pins); `pnpm --filter @workspace/curriculum run typecheck`. The mobile `YesNoQuestion` and `buildable` still compile (they read fields that still exist).

- [ ] **Step 5: Commit** `feat(curriculum): fact Yes or No, the Build half and a Grade 3 cap`.

---

### Task 4: The Grade 3 data

**Files:** Create `lib/curriculum/src/englishGrammarG3.ts`, `lib/curriculum/src/__tests__/englishGrammarG3.test.ts`; modify `englishGrammar.ts` (import and `GRAMMAR_UNITS`).

**Produces:** `GRAMMAR_UNITS_G3: GrammarUnit[]` (8, unsigned), `NOT_COVERED_G3: Record<string, string[]>`; `GRAMMAR_UNITS` = Grade 1 + 2 + 3.

- [ ] **Step 1: Failing test** — create `englishGrammarG3.test.ts`:

```ts
/**
 * Grade 3 grammar sentences (spec: docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grammarUnit, grammarUnitsForGrade, offeredGrammar, unitSentences } from '../englishGrammar.ts';
import { NOT_COVERED_G3 } from '../englishGrammarG3.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G3 = hubLessonsForGrade(3);
const UNITS = grammarUnitsForGrade(3);
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const order = new Map(G3.map((l, i) => [l.id, i]));
/** Slots that hold free text from the book's examples, not hub words: checked on the teacher's form instead. */
const FREE_SLOTS = new Set(['ability', 'pre', 'poss']);

test('the 8 Grade 3 hub lessons have a unit each, all unsigned, none offered', () => {
  assert.equal(G3.length, 8);
  assert.deepEqual(UNITS.map(u => u.lessonId), G3.map(l => l.id));
  for (const u of UNITS) {
    assert.equal(u.reviewedBy, null, u.lessonId);
    assert.equal(offeredGrammar(u.lessonId), null, u.lessonId);
    assert.ok(grammarUnit(u.lessonId));
  }
});

test('the generator produces the designed sentences: 324 in all', () => {
  const counts = new Map(UNITS.map(u => [u.lessonId, unitSentences(u).length]));
  assert.deepEqual([...counts], [
    [L(1, 2), 40], [L(1, 3), 34], [L(1, 4), 52], [L(1, 5), 22], [L(2, 7), 24], [L(2, 8), 54], [L(2, 9), 60], [L(2, 10), 38],
  ]);
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 324);
});

test('slot words come from this lesson, an earlier Grade 3 lesson, or Grades 1–2; rows too, bar the free-text slots', () => {
  const earlier = new Set(hubLessonsForGrade(1).concat(hubLessonsForGrade(2)).flatMap(l => l.words.map(w => w.en)));
  for (const u of UNITS) {
    const allowed = new Set([...earlier, ...G3.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en))]);
    for (const [slot, words] of Object.entries(u.slots)) for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    for (const p of u.patterns) {
      for (const row of p.rows ?? []) {
        for (const [slot, w] of Object.entries(row)) if (!FREE_SLOTS.has(slot)) assert.ok(allowed.has(w), `${u.lessonId} ${p.id} row ${slot}: ${w}`);
      }
    }
  }
});

test('every sentence can be built, and none is dropped for length', () => {
  for (const u of UNITS) for (const s of unitSentences(u)) assert.ok(s.build, `${s.text} (${s.tokens.length} tiles)`);
});

test('a long question-and-answer pair builds its answer half, with the question as the prompt', () => {
  const routine = unitSentences(grammarUnit(L(1, 2))!).find(s => s.text === 'When do you go home? We go home in the afternoon.')!;
  assert.deepEqual(routine.build, { tokens: ['We', 'go', 'home', 'in', 'the', 'afternoon.'], text: 'We go home in the afternoon.', prompt: 'When do you go home?' });
  const halves = UNITS.flatMap(u => unitSentences(u)).filter(s => s.build?.prompt);
  assert.ok(halves.length > 10);
});

test('pictures only where the sentence is shown by them; Yes or No only on S2 U9 and U10', () => {
  for (const id of [L(1, 2), L(1, 4), L(2, 7), L(2, 8)]) {
    for (const s of unitSentences(grammarUnit(id)!)) {
      assert.equal(s.picture, null, `${id} ${s.text}`);
      assert.equal(s.yesNo, null, `${id} ${s.text}`);
    }
  }
  const withYesNo = UNITS.filter(u => unitSentences(u).some(s => s.yesNo)).map(u => u.lessonId);
  assert.deepEqual(withYesNo, [L(2, 9), L(2, 10)]);
  for (const u of UNITS) for (const s of unitSentences(u)) if (s.picture) assert.ok(wordPicture(s.picture.word), s.text);
});

test('the verb lessons ask for a verb form, and Choose has evidence in the sentence', () => {
  const kinds = (id: string) => new Set(unitSentences(grammarUnit(id)!).map(s => s.choose?.kind ?? 'none'));
  assert.ok(kinds(L(1, 4)).has('form'));
  const plays = unitSentences(grammarUnit(L(1, 4))!).find(s => s.text === 'He plays badminton.' || s.text === 'He plays tennis.')!;
  assert.deepEqual([plays.choose!.right, plays.choose!.wrong], ['plays', 'play']);
  for (const u of UNITS) for (const s of unitSentences(u)) {
    if (s.choose) assert.notEqual(s.choose.right, s.choose.wrong, s.text);
    if (s.choose) {
      const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
      assert.equal(blanked, s.choose.right, s.text);
    }
  }
});

test('the animal facts are exactly the ones the teacher is asked to check', () => {
  const facts = unitSentences(grammarUnit(L(2, 10))!).filter(s => s.yesNo?.kind === 'fact').map(s => s.text).sort();
  assert.deepEqual(facts, [
    "Can crocodiles fly? No, they can't.", 'Can crocodiles swim? Yes, they can.', "Can eagles fly? Yes, they can.",
    "Can elephants fly? No, they can't.", "Can elephants jump? No, they can't.", "Can giraffes fly? No, they can't.",
    "Can hippos fly? No, they can't.", "Can hippos jump? No, they can't.", 'Can hippos swim? Yes, they can.',
    'Can kangaroos jump? Yes, they can.', "Can monkeys climb? Yes, they can.", "Can monkeys fly? No, they can't.",
    "Can penguins fly? No, they can't.", 'Can penguins swim? Yes, they can.', 'Can tigers run? Yes, they can.',
    'Can zebras run? Yes, they can.',
  ].sort());
});

test('the not-covered table has an entry for every Grade 3 lesson and only for them, in form-safe text', () => {
  assert.deepEqual(Object.keys(NOT_COVERED_G3).sort(), G3.map(l => l.id).sort());
  for (const [id, items] of Object.entries(NOT_COVERED_G3)) {
    assert.ok(items.length > 0, id);
    for (const text of items) assert.ok(!/["&<>]/.test(text), `${id}: ${text}`);
  }
});
```

- [ ] **Step 2: Run to fail** (the file does not exist).

- [ ] **Step 3: Implement** `lib/curriculum/src/englishGrammarG3.ts`:

```ts
/**
 * Grade 3 grammar units for the English corner
 * (spec: docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md).
 *
 * Patterns are the book's (`objectives` in data/iqra_curriculum_g3_english_sem{1,2}.json). A picture appears
 * only where it shows what the sentence says, so four lessons carry none. What is left out is in
 * `NOT_COVERED_G3`, which the teacher's form prints. A unit is offered to nobody until `reviewedBy` is set.
 *
 * Imports only types from the engine: `englishGrammar.ts` imports this file.
 */
import type { GrammarUnit } from './englishGrammar.ts';

const L = (sem: 1 | 2, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;

const ROUTINE = [
  'get up', 'have breakfast', 'go to school', 'have art lessons', 'play with my friends',
  'go home', 'have lunch', 'do homework', 'have dinner', 'go to bed',
];
/** Each routine with its time: a cross-product would say «We have dinner in the morning». */
const ROUTINE_TIMES: Record<string, string>[] = [
  { act: 'get up', pre: 'in the', time: 'morning' }, { act: 'have breakfast', pre: 'in the', time: 'morning' },
  { act: 'go to school', pre: 'in the', time: 'morning' }, { act: 'have art lessons', pre: 'in the', time: 'morning' },
  { act: 'play with my friends', pre: 'in the', time: 'afternoon' }, { act: 'go home', pre: 'in the', time: 'afternoon' },
  { act: 'have lunch', pre: 'in the', time: 'afternoon' }, { act: 'do homework', pre: 'in the', time: 'afternoon' },
  { act: 'have dinner', pre: 'in the', time: 'evening' }, { act: 'go to bed', pre: 'at', time: 'night' },
];

const WEARABLE = [
  'dress', 'hat', 'scarf', 'shirt', 'jeans', 'socks', 'glasses', 'sandals', 'pyjamas', 'trainers', 'baseball cap',
];
/** Whose things are what colour. «grey» is in the book's example but in no hub list, so it is not used. */
const OWNED: Record<string, string>[] = [
  { poss: 'Our', thing: 'glasses', colour: 'blue' }, { poss: 'Our', thing: 'phone', colour: 'green' },
  { poss: 'Our', thing: 'backpack', colour: 'red' }, { poss: 'Our', thing: 'computer', colour: 'black' },
  { poss: 'Your', thing: 'keys', colour: 'brown' }, { poss: 'Your', thing: 'handbag', colour: 'pink' },
  { poss: 'Your', thing: 'hat', colour: 'white' }, { poss: 'Your', thing: 'scarf', colour: 'purple' },
  { poss: 'Their', thing: 'phone', colour: 'yellow' }, { poss: 'Their', thing: 'backpack', colour: 'blue' },
  { poss: 'Their', thing: 'glasses', colour: 'green' }, { poss: 'Their', thing: 'handbag', colour: 'red' },
];

const SPORTS = [
  'watch TV', 'read books', 'play badminton', 'play video games', 'play tennis', 'play basketball', 'roller skate', 'skateboard', 'do karate',
];
const DOES_YES: Record<string, string>[] = [
  { act: 'watch TV', day: 'Friday' }, { act: 'read books', day: 'Tuesday' }, { act: 'play badminton', day: 'Monday' },
  { act: 'play tennis', day: 'Wednesday' }, { act: 'play basketball', day: 'Thursday' }, { act: 'roller skate', day: 'Sunday' },
  { act: 'skateboard', day: 'Saturday' }, { act: 'do karate', day: 'Saturday' },
];
const DOES_NO: Record<string, string>[] = [
  { act: 'watch TV', day: 'Sunday' }, { act: 'read books', day: 'Monday' }, { act: 'play badminton', day: 'Friday' },
  { act: 'play video games', day: 'Tuesday' }, { act: 'play tennis', day: 'Saturday' }, { act: 'play basketball', day: 'Sunday' },
  { act: 'roller skate', day: 'Wednesday' }, { act: 'do karate', day: 'Thursday' },
];

const JOBS = ['teacher', 'doctor', 'nurse', 'firefighter', 'astronaut', 'pilot', 'police officer', 'builder', 'chef', 'artist'];
const TRANSPORT = ['bus', 'boat', 'underground', 'train', 'motorbike', 'car'];

const FARM_JOBS = ['brush the horses', 'clean the cage', 'collect the eggs', 'fix the gate', 'milk the cows', 'sweep the barn'];

const CAMP = ['tent', 'sleeping bag', 'torch', 'shampoo', 'toothpaste', 'sunscreen'];

const FURNITURE = ['door', 'window', 'sofa', 'armchair', 'television', 'bed', 'wardrobe', 'mirror', 'clock', 'bookcase'];
const THERE: GrammarUnit['patterns'][number]['yesNo'] = {
  kind: 'marker', question: 'Is there {a:item}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there',
};

/** What a child can be asked about an animal, and the truth. Every row is on the teacher's form. */
const CAN_YES: Record<string, string>[] = [
  { animal: 'penguin', ability: 'swim' }, { animal: 'hippo', ability: 'swim' }, { animal: 'crocodile', ability: 'swim' },
  { animal: 'eagle', ability: 'fly' }, { animal: 'kangaroo', ability: 'jump' }, { animal: 'monkey', ability: 'climb' },
  { animal: 'tiger', ability: 'run' }, { animal: 'zebra', ability: 'run' },
];
const CAN_NO: Record<string, string>[] = [
  { animal: 'penguin', ability: 'fly' }, { animal: 'hippo', ability: 'fly' }, { animal: 'hippo', ability: 'jump' },
  { animal: 'elephant', ability: 'jump' }, { animal: 'elephant', ability: 'fly' }, { animal: 'crocodile', ability: 'fly' },
  { animal: 'monkey', ability: 'fly' }, { animal: 'giraffe', ability: 'fly' },
];
const CAN = { question: 'Can {s:animal} {ability}?', yes: 'Yes, they can.', no: "No, they can't." } as const;
const FOOD_ONE = ['coconut', 'burger', 'kiwi', 'mango', 'ice lolly'];
const FOOD_MANY = ['coconut', 'burger', 'kiwi', 'grapes', 'mango', 'ice lolly'];

export const GRAMMAR_UNITS_G3: GrammarUnit[] = [
  {
    // Present simple, daily routines: I play / don't play. We have lunch. When do you go home? We go home in the afternoon.
    lessonId: L(1, 2),
    reviewedBy: null,
    patterns: [
      { id: 'i', text: 'I {v:act}.' },
      { id: 'we', text: 'We {v:act}.' },
      { id: 'dont', text: "I don't {v:act}.", choose: { kind: 'phrase', right: "don't", wrong: "doesn't" } },
      { id: 'when', text: 'When do you {v:act}? We {v:act} {v:pre} {time}.', rows: ROUTINE_TIMES, choose: { kind: 'phrase', right: 'do', wrong: 'does' } },
    ],
    slots: { act: ROUTINE },
  },
  {
    // Present continuous with clothes: You're / They're wearing …; our / your / their.
    lessonId: L(1, 3),
    reviewedBy: null,
    patterns: [
      { id: 'you', text: "You're wearing {a:clothes}.", picture: 'clothes', choose: { kind: 'slot', slot: 'clothes' } },
      { id: 'they', text: "They're wearing {a:clothes}.", picture: 'clothes', choose: { kind: 'slot', slot: 'clothes' } },
      // Nothing in the picture says «our» or «your», so only «are» is asked, which the plural noun answers.
      { id: 'owned', text: '{poss} {s:thing} are {colour}.', picture: 'thing', rows: OWNED, choose: { kind: 'phrase', right: 'are', wrong: 'is' } },
    ],
    slots: { clothes: WEARABLE },
  },
  {
    // Present simple, third person: He plays … He doesn't watch TV. Does he do karate on Saturday? Yes, he does.
    lessonId: L(1, 4),
    reviewedBy: null,
    patterns: [
      { id: 'he', text: 'He {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'she', text: 'She {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'hedont', text: "He doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
      { id: 'shedont', text: "She doesn't {v:act}.", choose: { kind: 'phrase', right: "doesn't", wrong: "don't" } },
      { id: 'doesyes', text: 'Does he {v:act} on {day}? Yes, he does.', rows: DOES_YES, choose: { kind: 'phrase', right: 'Does', wrong: 'Do' } },
      { id: 'doesno', text: "Does she {v:act} on {day}? No, she doesn't.", rows: DOES_NO, choose: { kind: 'phrase', right: 'Does', wrong: 'Do' } },
    ],
    slots: { act: SPORTS },
  },
  {
    // want to be; goes to work by …
    lessonId: L(1, 5),
    reviewedBy: null,
    patterns: [
      { id: 'want', text: 'I want to be {a:job}.', picture: 'job', choose: { kind: 'slot', slot: 'job' } },
      { id: 'he', text: 'He goes to work by {transport}.', picture: 'transport', marker: 'boy', choose: { kind: 'phrase', right: 'goes', wrong: 'go' } },
      { id: 'she', text: 'She goes to work by {transport}.', picture: 'transport', marker: 'girl', choose: { kind: 'phrase', right: 'goes', wrong: 'go' } },
    ],
    slots: { job: JOBS, transport: TRANSPORT },
  },
  {
    // Present continuous, Yes / No questions. The animals are pictured but «brushing» is not: no pictures here.
    lessonId: L(2, 7),
    reviewedBy: null,
    patterns: [
      { id: 'theyyes', text: 'Are they {ing:act}? Yes, they are.', choose: { kind: 'phrase', right: 'Are', wrong: 'Is' } },
      { id: 'theyno', text: "Are they {ing:act}? No, they aren't.", choose: { kind: 'phrase', right: 'Are', wrong: 'Is' } },
      { id: 'heyes', text: 'Is he {ing:act}? Yes, he is.', choose: { kind: 'phrase', right: 'Is', wrong: 'Are' } },
      { id: 'sheno', text: "Is she {ing:act}? No, she isn't.", choose: { kind: 'phrase', right: 'Is', wrong: 'Are' } },
    ],
    slots: { act: FARM_JOBS },
  },
  {
    // have got, negative and Yes / No questions.
    lessonId: L(2, 8),
    reviewedBy: null,
    patterns: [
      { id: 'inot', text: "I haven't got {a:thing}.", choose: { kind: 'phrase', right: "haven't", wrong: "hasn't" } },
      { id: 'henot', text: "He hasn't got {a:thing}.", choose: { kind: 'phrase', right: "hasn't", wrong: "haven't" } },
      { id: 'shenot', text: "She hasn't got {a:thing}.", choose: { kind: 'phrase', right: "hasn't", wrong: "haven't" } },
      { id: 'youyes', text: 'Have you got {a:thing}? Yes, I have.', choose: { kind: 'phrase', right: 'Have', wrong: 'Has' } },
      { id: 'youno', text: "Have you got {a:thing}? No, I haven't.", choose: { kind: 'phrase', right: 'Have', wrong: 'Has' } },
      { id: 'heyes', text: 'Has he got {a:thing}? Yes, he has.', choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'heno', text: "Has he got {a:thing}? No, he hasn't.", choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'sheyes', text: 'Has she got {a:thing}? Yes, she has.', choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
      { id: 'sheno', text: "Has she got {a:thing}? No, she hasn't.", choose: { kind: 'phrase', right: 'Has', wrong: 'Have' } },
    ],
    slots: { thing: CAMP },
  },
  {
    // there is / are, affirmative and negative. The prepositions of place have no picture, so they are not here.
    lessonId: L(2, 9),
    reviewedBy: null,
    patterns: [
      { id: 'is', text: "There's {a:item}.", picture: 'item', marker: 'yes', choose: { kind: 'phrase', right: "There's", wrong: "There isn't" } },
      { id: 'isnt', text: "There isn't {a:item}.", picture: 'item', marker: 'no', choose: { kind: 'phrase', right: "There isn't", wrong: "There's" } },
      { id: 'are', text: 'There are {s:item}.', picture: 'item', marker: 'many', choose: { kind: 'phrase', right: 'There are', wrong: "There's" } },
      // No picture or Choose: a picture of a bed does not say «there aren't any beds».
      { id: 'arent', text: "There aren't any {s:item}." },
      { id: 'yes', text: 'Is there {a:item}? Yes, there is.', picture: 'item', marker: 'yes', yesNo: THERE },
      { id: 'no', text: "Is there {a:item}? No, there isn't.", picture: 'item', marker: 'no', yesNo: THERE },
    ],
    slots: { item: FURNITURE },
  },
  {
    // can (ability) and there is / are, Yes / No questions.
    lessonId: L(2, 10),
    reviewedBy: null,
    patterns: [
      { id: 'canyes', text: 'Can {s:animal} {ability}? Yes, they can.', picture: 'animal', marker: 'many', rows: CAN_YES, yesNo: { kind: 'fact', ...CAN, answer: true } },
      { id: 'canno', text: "Can {s:animal} {ability}? No, they can't.", picture: 'animal', marker: 'many', rows: CAN_NO, yesNo: { kind: 'fact', ...CAN, answer: false } },
      { id: 'isyes', text: 'Is there {a:food}? Yes, there is.', picture: 'food', marker: 'yes', yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
      { id: 'isno', text: "Is there {a:food}? No, there isn't.", picture: 'food', marker: 'no', yesNo: { kind: 'marker', question: 'Is there {a:food}?', yes: 'Yes, there is.', no: "No, there isn't.", hint: 'there' } },
      { id: 'areyes', text: 'Are there any {s:many}? Yes, there are.', picture: 'many', marker: 'yes', yesNo: { kind: 'marker', question: 'Are there any {s:many}?', yes: 'Yes, there are.', no: "No, there aren't.", hint: 'there' } },
      { id: 'areno', text: "Are there any {s:many}? No, there aren't.", picture: 'many', marker: 'no', yesNo: { kind: 'marker', question: 'Are there any {s:many}?', yes: 'Yes, there are.', no: "No, there aren't.", hint: 'there' } },
    ],
    // «grapes» is plural in form, so only the plural question takes it.
    slots: { food: FOOD_ONE, many: FOOD_MANY },
  },
];

/**
 * What a Grade 3 lesson does not cover, and why — printed on the teacher's form. One bullet per item,
 * Arabic with English phrases inline; no `"`, `&`, `<` or `>` (the form does not escape runs).
 */
export const NOT_COVERED_G3: Record<string, string[]> = {
  [L(1, 2)]: [
    'لا صور لهذه الوحدة: كلماتها أفعال وعبارات، فتبقى «اختر الكلمة» و«رتّب الجملة» فقط.',
    'الجمل الطويلة مثل «When do you go home? We go home in the afternoon.» تُرتَّب إجابتها فقط، ويظهر السؤال مكتوبًا ومسموعًا فوق الكلمات.',
    'ربط كل نشاط بوقته (go home مع afternoon وgo to bed مع night) مكتوب جملة جملة في القائمة، فتأكدوا منه.',
  ],
  [L(1, 3)]: [
    'our وyour وtheir لا تظهر في «اختر الكلمة»: لا شيء في الصورة يدل عليها. يُسأل عن are وis فقط، وهما جوابان بالجمع.',
    'sandals وpyjamas وtrainers وbaseball cap بلا صور فلا تظهر في «اختر الكلمة» ولا «صح أم خطأ».',
    'اللون الرمادي grey في مثال الكتاب غير موجود في أي قائمة كلمات، فاستُبدل بألوان من الصفين الأول والثاني.',
  ],
  [L(1, 4)]: [
    'لا صور لهذه الوحدة: كلماتها أفعال وعبارات.',
    'في «اختر الكلمة» يُسأل عن صيغة الفعل (plays مقابل play) وعن does وdo.',
    'أيام الأسبوع بلا صور، وتظهر في الأسئلة فقط. ارتباط كل نشاط بيوم عشوائي ولا يُقصد به معلومة.',
  ],
  [L(1, 5)]: [
    'جملة «He goes to work by bus.» تظهر بصورة الوسيلة فقط، ولا صورة للعمل نفسه.',
    'يُسأل في «اختر الكلمة» عن goes مقابل go، وجوابه من قاعدة الكتاب لا من الصورة.',
  ],
  [L(2, 7)]: [
    'لا صور لهذه الوحدة: الحيوانات لها صور لكن الأفعال (brushing وcollecting…) لا صور لها، فلا «صح أم خطأ» ولا «نعم أم لا».',
    'يُسأل عن Are وIs فقط، والجواب من ضمير الجملة.',
    'السؤال Is it flying? بلا نشاط له صورة، فلم يُستعمل.',
  ],
  [L(2, 8)]: [
    'لا صور لهذه الوحدة: tent وtorch وغيرهما بلا صور في القائمة المعتمدة.',
    'shampoo وtoothpaste وsunscreen تُكتب بلا أداة نكرة (Have you got sunscreen?).',
    'الصفات (dirty وclean وold…) لم تُستعمل لأن الكتاب لا يدرّسها في نمط have got.',
  ],
  [L(2, 9)]: [
    'الجمل عن الأثاث المصوّر فقط فيها صورة. armchair وbed وwardrobe وbookcase بلا صور: تظهر في «رتّب الجملة» فقط.',
    'in front of وbetween وopposite وbehind وnext to: لا يمكن لرمز تعبيري أن يُظهرها، فلا جمل لها.',
    'في «نعم أم لا» تُظهر الصورة ✅ أو ❌ ويختار الطالب الجواب المطابق (✅ = موجود). إن لم يكن ذلك واضحًا يُحذف النشاط من الوحدة.',
    'جملة There aren\'t any beds بلا صورة، لأن صورة سرير لا تدل على أنه غير موجود.',
  ],
  [L(2, 10)]: [
    'أسئلة can تستند إلى معلومة عن الحيوان (هل يسبح البطريق؟). كل معلومة مكتوبة في القائمة لتتأكدوا منها، والأفعال swim وfly وjump وrun وclimb من أمثلة الكتاب.',
    'لا ✅ ولا ❌ بجانب الصورة في أسئلة can: الصورة هي الحيوان فقط ويجيب الطالب مما يعرفه.',
    'ice lolly بلا صورة فلا يظهر في «نعم أم لا»، وgrapes جمع فقط فتأتي مع Are there any فقط.',
  ],
};
```


Then in `englishGrammar.ts` add `import { GRAMMAR_UNITS_G3 } from './englishGrammarG3.ts';` beside the Grade 2 import and change `GRAMMAR_UNITS` to `[...GRAMMAR_UNITS_G1, ...GRAMMAR_UNITS_G2, ...GRAMMAR_UNITS_G3]` with the comment «Grade 1, then 2, then 3: the order the lessons come in.»

- [ ] **Step 4: Run** `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammarG3.test.ts`. If a count differs, **stop and look**: either the data has a slip or a rule (plural, article) is wrong; fix the data or the rule, never the expected count to match. Then `pnpm --filter @workspace/curriculum test` — **fails expected** in: `englishGrammarEngine.test.ts` 'the grade helpers' (`grammarUnitsForGrade(3)` is no longer `[]` — change that line to grade 4), and the Grade 1/2 pins must still pass.

- [ ] **Step 5: Run** `pnpm --filter @workspace/curriculum run typecheck`, then **Commit** `feat(curriculum): Grade 3 grammar units — 324 sentences over 8 lessons, hidden until signed off`.

---

### Task 5: The teacher's form and sheet for Grade 3

**Files:** Modify `lib/curriculum/src/englishGrammarReview.ts`, `lib/curriculum/scripts/grammar-sheet.ts`, `lib/curriculum/src/englishGrammar.ts` (sheet cell); append to `englishGrammarG3.test.ts`; create (generated) `docs/english-grammar-g3-sheet.md`, `docs/english-grammar-g3-review.html`.

- [ ] **Step 1: Failing tests** — append to `englishGrammarG3.test.ts` (add `readFileSync`, `path`, `fileURLToPath` imports and `renderGrammarSheet` to the engine import):

```ts
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..', 'docs');

test("the Grade 3 teacher's form lists every sentence once, shows the Build half, and has a not-covered block per lesson", async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  const html = renderGrammarReviewHtml(3);
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const all = UNITS.flatMap(u => unitSentences(u));
  assert.equal(all.length, 324);
  assert.equal((html.match(/<td class="sentence"/g) ?? []).length, 324);
  for (const s of all) assert.ok(html.includes(esc(s.text)), s.text);
  assert.equal((html.match(/class="not-covered"/g) ?? []).length, 8);
  assert.equal((html.match(/<th>«نعم أم لا»/g) ?? []).length, 2, 'toys-like Yes or No columns: S2 U9 and U10');
  assert.equal((html.match(/class="build-half"/g) ?? []).length, all.filter(s => s.build?.prompt).length);
  assert.ok(html.includes('مراجعة قواعد الصف الثالث'));
  assert.ok(html.includes('Can penguins swim?'));
});

test('the committed Grade 3 sheet and form are exactly what the generators produce', async () => {
  const { renderGrammarReviewHtml } = await import('../englishGrammarReview.ts');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g3-sheet.md'), 'utf8'), renderGrammarSheet(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
  assert.equal(readFileSync(path.join(docs, 'english-grammar-g3-review.html'), 'utf8'), renderGrammarReviewHtml(3), 'run: pnpm --filter @workspace/curriculum run grammar-sheet');
});
```

- [ ] **Step 2: Run to fail.**

- [ ] **Step 3: Implement.**

(a) `englishGrammarReview.ts`: import `NOT_COVERED_G3` beside `NOT_COVERED_G2` and set `const NOT_COVERED: Record<number, Record<string, string[]>> = { 2: NOT_COVERED_G2, 3: NOT_COVERED_G3 };`. In `yesNoCell` change `if (y.kind === 'marker')` to `if (y.kind !== 'match')`. Make the sentence cell show the Build half — in `renderUnit` replace `<td class="sentence" dir="ltr">${esc(s.text)}</td>` with `<td class="sentence" dir="ltr">${esc(s.text)}${buildHalf(s)}</td>` and add:

```ts
/** When Build the sentence builds only the answer, the form says so: a teacher signs what the child orders. */
function buildHalf(s: GrammarSentence): string {
  return s.build?.prompt ? `<small class="build-half" dir="ltr">Build: ${esc(s.build.text)}</small>` : '';
}
```
(Grade 1 and 2 have no prompt, so their markup is unchanged.) (Do that in the test: `assert.ok(html.includes(esc(s.text)), s.text)`.)

(b) The G3 copy: add `3:` to `GRADE_COPY`:

```ts
  3: {
    title: 'مراجعة قواعد الصف الثالث',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثالث',
    lead: (total, units) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثالث أنشطة لتثبيت القواعد على ${AR_DIGITS(units)} وحدات. القواعد هنا في معظمها صيغ أفعال (<span dir="ltr">play / plays</span> و<span dir="ltr">have / has</span> و<span dir="ltr">Is / Are</span>)، ولذلك تجدون وحدات بلا صور لأن كلماتها أفعال وعبارات، وما استُبعد مذكور مع سببه في كل وحدة. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">plays / play</span> أو <span dir="ltr">Does / Do</span> أو <span dir="ltr">There's / There isn't</span>. تظهر معها صورة حيث توجد صورة صادقة فقط.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. حتى ٩ كلمات. إن زادت الجملة (سؤال وجواب) يُرتّب الجواب وحده ويظهر السؤال فوق الكلمات؛ ويُكتب ذلك تحت الجملة في القائمة.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة ونصفها بصورة كلمة أخرى من الوحدة. في الوحدات المصوّرة فقط.</div>
      <div class="act"><b>نعم أم لا</b>صورة وسؤال، ويختار الطالب الجواب القصير. في أسئلة <span dir="ltr">Can penguins swim?</span> يجيب الطالب مما يعرفه عن الحيوان، وفي <span dir="ltr">Is there a sofa?</span> تدل ✅ أو ❌ على الجواب.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة (إن وُجدت) تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح؟ وهل في الجملة أو الصورة ما يدل على الصحيح؟',
      'في «رتّب الجملة»: هل يكفي ترتيب الجواب وحده حين تطول الجملة؟',
      'في «نعم أم لا»: هل الجواب القصير هو الصحيح للسؤال وللصورة؟ وهل معلومات الحيوانات صحيحة؟',
      'هل الكلمات مناسبة لطالب الصف الثالث؟',
    ],
    extraCss: GRADE_2_CSS + `
  .build-half { display: block; color: var(--muted); font-size: .78rem; font-weight: 400; white-space: nowrap; }`,
  },
```
To avoid duplicating Grade 2's CSS, extract it: change `extraCss: \`...\`` of grade 2 into a module constant `const YESNO_CSS = \`…the same text…\`;` and set both grades' `extraCss` to `YESNO_CSS` (Grade 2 byte-identical) / `YESNO_CSS + build-half rule` (Grade 3). The name `GRADE_2_CSS` above is `YESNO_CSS`.

(c) The sheet: in `englishGrammar.ts` `renderGrammarSheet`, change `y.kind === 'marker'` to `y.kind !== 'match'` in `yesNoText`; and add to the sentence cell of a halved sentence the half: `const text = s.build?.prompt ? \`${s.text} _(Build: ${s.build.text})_\` : s.text;` using `text` in the row (Grade 1/2 unchanged).

(d) `scripts/grammar-sheet.ts`: `for (const grade of [1, 2, 3])`, and update the doc comment («for Grades 1, 2 and 3»).

- [ ] **Step 4: Generate and verify**

Run: `pnpm --filter @workspace/curriculum run grammar-sheet && git status --short docs/ && git diff --stat docs/`
Expected: two new files (`english-grammar-g3-*`); **no other doc changed**. Then `pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run typecheck` — all pass.

- [ ] **Step 5: Look at it** (scratchpad Playwright script, never committed): open `docs/english-grammar-g3-review.html` at 1123×794 and 390 wide; screenshot the intro, S1 U2 (halved rows with the «Build:» note), S1 U4, S2 U10 (fact column), and a not-covered block; check `scrollWidth <= innerWidth` at 390 px; print to PDF. Fix anything that overflows or reads backwards.

- [ ] **Step 6: Commit** `feat(curriculum): Grade 3 grammar sheet and teacher's form` (add `docs/english-grammar-g3-*`).

---

### Task 6: The app's round builders

**Files:** Modify `artifacts/mobile/services/englishHub/games.ts`; create `artifacts/mobile/services/__tests__/englishGrammarG3Games.test.ts`.

**Produces:** `BuildQuestion.prompt: string | null`; `buildSentenceRound` builds from `sentence.build`; `isSentenceBuilt` judges against `sentence.build.text`; `YesNoQuestion.kind` adds `'fact'` and gains `hint: 'likes' | 'there' | null`; `MAX_BUILD_TILES` stays 7 (Grades 1–2).

- [ ] **Step 1: Failing test** — create `englishGrammarG3Games.test.ts`:

```ts
/**
 * Round builders on the Grade 3 grammar data. The builders do not gate on review (the lesson screen's
 * `offeredGrammar` does), so they are tested over every Grade 3 unit.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { allGrammarSpoken, buildCap, grammarUnitsForGrade, unitSentences } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import {
  MAX_BUILD_TILES,
  ROUND_LENGTH,
  buildChooseRound,
  buildSentenceRound,
  buildTrueFalseRound,
  buildYesNoRound,
  grammarActivityAvailable,
  isSentenceBuilt,
  isYesNoRight,
  yesNoExchange,
} from '../englishHub/games.ts';

const UNITS = grammarUnitsForGrade(3).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const G2 = grammarUnitsForGrade(2).map(u => ({ id: u.lessonId, sentences: unitSentences(u) }));
const L = (sem: number, unit: number) => `kbl-g3-eng-s${sem}-nccd-u${unit}_l1`;
const SEEDS = [1, 2, 3, 4, 5, 6];
const spoken = new Set(allGrammarSpoken());

describe('which activity each Grade 3 lesson offers', () => {
  it('Choose and Build everywhere; True or false on clothes, jobs and furniture; Yes or No on furniture and animals', () => {
    assert.equal(UNITS.length, 8);
    const offered = (a: Parameters<typeof grammarActivityAvailable>[0]) => UNITS.filter(u => grammarActivityAvailable(a, u.sentences)).map(u => u.id);
    assert.equal(offered('grammar-choose').length, 8);
    assert.equal(offered('grammar-build').length, 8);
    assert.deepEqual(offered('grammar-true'), [L(1, 3), L(1, 5), L(2, 9)]);
    assert.deepEqual(offered('grammar-yesno'), [L(2, 9), L(2, 10)]);
  });

  it('Grade 1 and 2 keep their cap of 7', () => {
    assert.equal(MAX_BUILD_TILES, 7);
    assert.equal(buildCap(2), 7);
    for (const { id, sentences } of G2) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) assert.ok(q.tiles.length <= MAX_BUILD_TILES, `${id}: ${q.sentence.text}`);
    }
  });
});

describe('Choose and Build on Grade 3', () => {
  it('Choose: the right option is the blanked word', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildChooseRound(sentences, makeRng(seed))) {
        assert.equal(q.options[q.answerIndex], q.sentence.choose!.right, id);
        assert.notEqual(q.options[0], q.options[1], id);
      }
    }
  });

  it('Build: tiles are the build tokens, at most nine, and the placed tiles in order are judged against the build text', () => {
    for (const { id, sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildSentenceRound(sentences, makeRng(seed))) {
        const build = q.sentence.build!;
        assert.equal(q.tiles.length, build.tokens.length, `${id} ${q.sentence.text}`);
        assert.ok(q.tiles.length <= buildCap(3), q.sentence.text);
        assert.equal(q.prompt, build.prompt);
        assert.equal(isSentenceBuilt(build.tokens.map(text => ({ text })), q.sentence), true, q.sentence.text);
        assert.equal(isSentenceBuilt([...build.tokens].reverse().map(text => ({ text })), q.sentence), build.tokens.length < 2 || build.tokens.join(' ') === [...build.tokens].reverse().join(' '));
      }
    }
  });

  it('Build: a long pair asks for its answer only, with the question as the prompt, and the whole sentence has a recording', () => {
    const routine = UNITS.find(u => u.id === L(1, 2))!.sentences;
    const rounds = SEEDS.flatMap(seed => buildSentenceRound(routine, makeRng(seed)));
    const halved = rounds.filter(q => q.prompt);
    assert.ok(halved.length > 0);
    for (const q of halved) {
      assert.ok(q.prompt!.endsWith('?'), q.prompt!);
      assert.ok(spoken.has(q.prompt!), `${q.prompt} is not voiced`);
      assert.ok(spoken.has(q.sentence.text));
    }
  });

  it('True or false: only sentences with a picture and a wrong picture are asked', () => {
    for (const { sentences } of UNITS) for (const seed of SEEDS) {
      for (const q of buildTrueFalseRound(sentences, makeRng(seed))) assert.ok(q.sentence.picture && q.sentence.falsePicture, q.sentence.key);
    }
  });
});

describe('Yes or No on Grade 3', () => {
  it('a round is eight items, half Yes and half No, no picture twice, every exchange voiced', () => {
    for (const { id, sentences } of UNITS.filter(u => [L(2, 9), L(2, 10)].includes(u.id))) for (const seed of SEEDS) {
      const round = buildYesNoRound(sentences, makeRng(seed));
      assert.equal(round.length, ROUND_LENGTH, id);
      assert.equal(round.filter(q => q.answer).length, ROUND_LENGTH / 2, id);
      const pictures = round.map(q => q.picture.word);
      assert.equal(new Set(pictures).size, pictures.length, `${id}: a picture twice`);
      for (const q of round) {
        assert.ok(spoken.has(q.question), q.question);
        assert.ok(spoken.has(yesNoExchange(q)), yesNoExchange(q));
        assert.equal(isYesNoRight(q, q.answer), true);
      }
    }
  });

  it('a fact asks from the row, with no hint; a marker asks «✅ = it\'s there»; Grade 2 food still says «likes»', () => {
    const animals = UNITS.find(u => u.id === L(2, 10))!.sentences;
    const kinds = new Set(SEEDS.flatMap(seed => buildYesNoRound(animals, makeRng(seed)).map(q => `${q.kind}:${q.hint}`)));
    assert.ok(kinds.has('fact:null'));
    assert.ok(kinds.has('marker:there'));
    assert.ok(![...kinds].some(k => k.startsWith('fact:') && k !== 'fact:null'));
    const food = G2.find(u => u.id === 'kbl-g2-eng-s2-nccd-u6_l1')!.sentences;
    for (const q of buildYesNoRound(food, makeRng(1))) assert.equal(q.hint, 'likes');
    for (const q of SEEDS.flatMap(seed => buildYesNoRound(animals, makeRng(seed)))) {
      if (q.kind === 'fact') assert.equal(q.answer, q.sentence.yesNo!.answer, q.question);
    }
  });
});
```


- [ ] **Step 2: Run to fail** — `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG3Games.test.ts` → FAIL (`q.prompt` / `q.hint` undefined).

- [ ] **Step 3: Implement** in `games.ts` (the root typecheck must have rebuilt the curriculum declarations: run `pnpm run typecheck` once first if `buildCap` is not found):

(a) `BuildQuestion` gains `/** The question printed above the tiles when only the answer is built; null otherwise. */ prompt: string | null;`.
(b) Replace `buildable`, `buildSentenceRound` and `isSentenceBuilt`:

```ts
function buildable(s: GrammarSentence): boolean {
  return s.build !== null;
}

export function buildSentenceRound(sentences: readonly GrammarSentence[], rng: () => number = Math.random): BuildQuestion[] {
  return sample(sentences.filter(buildable), ROUND_LENGTH, rng).map(sentence => ({
    sentence,
    prompt: sentence.build!.prompt,
    tiles: shuffledTokens(sentence.build!.tokens, rng).map((text, id) => ({ id, text })),
  }));
}

/** The tiles placed so far, read in order, are what the child was asked to build: the whole sentence, or its answer half. */
export function isSentenceBuilt(tiles: readonly { text: string }[], sentence: GrammarSentence): boolean {
  return tiles.map(t => t.text).join(' ') === (sentence.build?.text ?? sentence.text);
}
```
Update the `MAX_BUILD_TILES` comment: «Grades 1 and 2 (the engine's `buildCap`; Grade 3 builds nine).»
(c) `YesNoQuestion`: `kind: 'match' | 'marker' | 'fact';` and add `hint: 'likes' | 'there' | null;`; in `yesNoItem` add `hint: y.hint` to the returned object.

- [ ] **Step 4: Run** the new test and `englishGrammarG2Games.test.ts` / `englishGrammarGames.test.ts` (PASS), then `pnpm run typecheck` (root). The Yes or No screen still compiles (it reads `q.kind === 'marker'`; Task 7 moves it to `q.hint`).

- [ ] **Step 5: Commit** `feat(english-hub): Grade 3 round builders — answer-half Build, fact Yes or No`.

---

### Task 7: The screens, the strings and the browser check

**Files:** Modify `artifacts/mobile/components/englishHub/GrammarActivities.tsx`, `artifacts/mobile/services/i18n.ts`.

- [ ] **Step 1: Strings** — in `i18n.ts`, after `hubGYesNoLikes: '✅ = يحبّ الطفل هذا الطعام، ❌ = لا يحبّه',` add `hubGYesNoThere: '✅ = موجود، ❌ = غير موجود',` and after the English `hubGYesNoLikes` line add `hubGYesNoThere: "✅ = it's there, ❌ = it isn't",`.

- [ ] **Step 2: Yes or No hint** — in `GrammarActivities.tsx`, in `YesNo` replace
```tsx
      {q.kind === 'marker' ? (
        <Text …>{t('hubGYesNoLikes')}</Text>
      ) : null}
```
with the same `<Text>` shown when `q.hint` is set, text `t(q.hint === 'there' ? 'hubGYesNoThere' : 'hubGYesNoLikes')`.

- [ ] **Step 3: Build prompt** — in `BuildSentence`, after `<SentencePicture s={q.sentence} />` add:

```tsx
      {/* Over the cap, only the answer is built: the question is the prompt, read before the words are ordered. */}
      {q.prompt ? (
        <>
          <EnglishLine text={q.prompt} />
          <HearButton word={q.prompt} />
        </>
      ) : null}
```
and change `<Feedback ok={result} answer={q.sentence.text} …` to `answer={q.sentence.build!.text}` (the whole sentence still plays through `sentence={q.sentence.text}`).

- [ ] **Step 4: Typecheck and suites** — `pnpm run typecheck` (root, clean); `cd artifacts/mobile && pnpm test` (background, ~4 min): all pass, design-scale and terminology tests included.

- [ ] **Step 5: Browser check** (never committed). Sign off **in the working tree only** `reviewedBy: { name: 'LOCAL', date: 'x' }` on S1 U2, S1 U4, S2 U9 and S2 U10 in `GRAMMAR_UNITS_G3` (`englishGrammarG3.ts`); build (`cd artifacts/mobile && EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`); **restore the file at once** (`git checkout lib/curriculum/src/englishGrammarG3.ts`, `grep -c LOCAL` = 0); serve with `WEB_PORT=8098 node e2e/serve.mjs` (note the PID); drive `/curriculum/english/<id>` with Playwright (`/opt/pw-browsers/chromium`; `localStorage` `@iqra_intro_seen_v1` = `1`, `@iqra_language` = `ar` then `en`; 4.5 s wait; 390×844). For each language check:
  - S1 U2: cards «اختر الكلمة» and «رتّب الجملة» only (no True or false, no Yes or No). A Build round reaches a long pair: the question shows above the tiles with a hear button, the tiles are the answer words, tapping them in order is judged right.
  - S1 U4: Choose shows «plays» against «play» as two left-to-right options, no picture; a 9-tile Build fits 390 px without scrolling sideways.
  - S2 U9: Yes or No shows the «✅ = it's there» hint; True or false is offered.
  - S2 U10: a `fact` question shows the animal ×2 and **no** hint line; a marker food question shows the hint; the plural «Can penguins swim?» reads left to right in Arabic with «Yes, they can.» whole.
  - S2 U7 (unsigned): no grammar section.
  Stop the server by PID (not `pkill -f`).

- [ ] **Step 6: Commit** `feat(english-hub): the Grade 3 Build prompt and the «it's there» hint` (the two components and `i18n.ts`; `git status` shows nothing else and no sign-off).

---

### Task 8: STATUS.md, the spec's numbers, and wrap-up

**Files:** Modify `STATUS.md`, `docs/superpowers/specs/2026-10-21-english-corner-grammar-g3-design.md`.

- [ ] **Step 1: Spec.** Change **Status** to «implemented (PR #1171)». In «Per-lesson design» change «Roughly **326** sentences» to «**324** sentences» and the S2 U10 count from 40 to 38 (with the reason: `grapes` takes only the plural question). In «Engine changes» add under item 1 a sentence: «`{v:slot}` is a fourth form: a base verb phrase split into one tile per word, so `I don't {v:act}` builds as words, not one tile.»
- [ ] **Step 2: STATUS.md.** After the «Grade 2 reading in the English corner» section add «Grade 3 grammar in the English corner — built, shown to nobody yet, 2026-10-22»: what it is (8 lessons, 324 sentences; S1 U1 and S2 U6 are not hub lessons; four lessons carry no pictures; Choose, Build, True or false on three lessons, Yes or No on two); the engine additions (word forms; `{v:} {3:} {ing:}`; the verb-form Choose; `rows`; the `fact` Yes or No and `hint`; Build's cap by grade, the answer half and `build`; spoken prompts); that every unit is `reviewedBy: null` in `englishGrammarG3.ts`; the form `docs/english-grammar-g3-review.html` and sheet (regenerate with `pnpm --filter @workspace/curriculum run grammar-sheet`; tests pin them; Grade 1 and 2 files unchanged); the teacher's open points (the animal facts, «✅ = it's there», the answer-half Build, the paired routine times, the third-person forms); the audio step (`english-audio` now also voices the Grade 3 sentences and Build prompts; needs keys); and **To switch a unit on**: audio recorded, teacher signs the unit's page, set `reviewedBy`. Mention Grade 3 reading as the next spec.
- [ ] **Step 3: Verify** — run and read: `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test`; `git status --short`; `git diff origin/main --stat -- docs/english-grammar-g1-sheet.md docs/english-grammar-g1-review.html docs/english-grammar-g2-sheet.md docs/english-grammar-g2-review.html docs/english-reading-g1-review.html docs/english-reading-g2-review.html` (empty); `grep -c LOCAL lib/curriculum/src/englishGrammarG3.ts` (0).
- [ ] **Step 4: Commit, merge `main`, push.**
```bash
git add STATUS.md docs/superpowers
git commit -m "docs: Grade 3 grammar in STATUS.md

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez"
git fetch origin main && git merge origin/main
```
Re-run Step 3's checks if the merge brought code changes, `git push -u origin ccr-d9db5f6c-mgwkuo` (if rejected because the remote has a merge commit, merge `origin/ccr-d9db5f6c-mgwkuo`, never force), update PR #1171's title and body to describe the build, and mark it ready only when the user asks.
