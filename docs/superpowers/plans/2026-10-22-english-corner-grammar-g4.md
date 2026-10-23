# English corner: Grade 4 grammar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the 9 Grade 4 hub lessons grammar activities (Choose the word, Build the sentence, True or false, Yes or No), all hidden until a teacher signs off.

**Architecture:** Grade 3's engine plus three word forms (`{cmp:}`, `{sup:}`, `{ed:}`), a form Choose that can name its wrong option (`base` / `past` / `comparative`), and picture-free fact items (a `claim` for True or false, a picture-less `fact` Yes or No) used only on S1 U4. Data in a new `englishGrammarG4.ts`; a teacher form with a data page; two mobile screens learn to hide the picture area.

**Tech Stack:** TypeScript, `node --test` (curriculum and mobile suites), the `grammar-sheet` script, React Native (Expo web build for the browser check).

**Spec:** `docs/superpowers/specs/2026-10-22-english-corner-grammar-g4-design.md`

## Global Constraints

- Every Grade 4 unit ships `reviewedBy: null`; no sign-off is ever committed.
- The Grade 1, 2 and 3 grammar sheets and forms and the Grade 1, 2 and 3 reading forms stay byte-identical (tests pin them).
- Build the sentence keeps `buildCap` = 9 for Grade 3 and up; every sentence must be buildable (a whole sentence of 2–9 tiles, or an answer half).
- Slot words come from this lesson, an earlier Grade 4 lesson, or any earlier grade; row-only free text lives in slots listed in the test's `FREE_SLOTS`.
- A Choose option is always a real form, never a made-up word.
- Arabic not-covered notes: no `"`, `&`, `<` or `>` (the form does not escape runs).
- Extensionless relative imports do not work under `node --test`: use explicit `.ts`.
- Commits end with the trailers `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01D1TReadGL7F7nC91Wxx8ez`; push only to `ccr-d9db5f6c-mgwkuo`; run `pnpm run typecheck` before committing a task; never commit a sign-off.
- Deviation from the spec's examples, decided while planning: ranking sentences use the definite article («The mountain is higher than the hill.») so `a` / `an` never needs capitalising; `ADJECTIVE_FORMS` holds the 11 adjectives used with a comparative or superlative (high, deep, wide short; beautiful, boring, colourful, dangerous, delicious, difficult, exciting, interesting long), not the S2 U8 adjectives, which are only used positively; the form Choose `wrong` values are `base`, `past`, `comparative` (`positive` is the same as `base`).

## File Structure

- Modify `lib/curriculum/src/englishGrammar.ts`: word forms, form Choose `wrong`, `claim`, picture-free fact yes-no, hint `'was'`, voiced claims, sheet column, import and merge `GRAMMAR_UNITS_G4`.
- Create `lib/curriculum/src/englishGrammarG4.ts`: `GRAMMAR_UNITS_G4`, `NOT_COVERED_G4`, `G4_DATA_PAGE`.
- Modify `lib/curriculum/src/englishGrammarReview.ts`: Grade 4 copy, the claim cell, the data page.
- Modify `lib/curriculum/scripts/grammar-sheet.ts`; generate `docs/english-grammar-g4-sheet.md` and `-review.html`.
- Modify `artifacts/mobile/services/englishHub/games.ts`, `components/englishHub/GrammarActivities.tsx`, `services/i18n.ts`.
- Tests: `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts` (append), `englishGrammarG4.test.ts` (create); `artifacts/mobile/services/__tests__/englishGrammarG4Games.test.ts` (create).
- Docs: top of `docs/status-log.md`, `STATUS.md` index line, spec status.

---

### Task 1: Word forms `{cmp:}`, `{sup:}`, `{ed:}`

**Files:** Modify `lib/curriculum/src/englishGrammar.ts`; Test `lib/curriculum/src/__tests__/englishGrammarEngine.test.ts`.

**Interfaces:**
- Produces: `comparativeOf(adj: string): string`, `superlativeOf(adj: string): string`, `pastTense(phrase: string): string` exported from `englishGrammar.ts`; `ADJECTIVE_FORMS: Record<string, [string, string]>`; `PAST_OVERRIDES`; the slot syntax `{cmp:slot}`, `{sup:slot}`, `{ed:slot}` (the slot's value is a base adjective or a verb phrase whose first word is the verb).

- [ ] **Step 1: Write the failing test** — append to `englishGrammarEngine.test.ts`:

```ts
import { comparativeOf, pastTense, superlativeOf } from '../englishGrammar.ts';

test('comparatives and superlatives come from the explicit adjective table', () => {
  assert.equal(comparativeOf('high'), 'higher');
  assert.equal(superlativeOf('high'), 'highest');
  assert.equal(comparativeOf('wide'), 'wider');
  assert.equal(superlativeOf('deep'), 'deepest');
  assert.equal(comparativeOf('exciting'), 'more exciting');
  assert.equal(superlativeOf('dangerous'), 'most dangerous');
  assert.throws(() => comparativeOf('purple'), /no comparative/);
});

test('past tense: +ed, +d after e, doubling and irregulars by table, the verb is the first word', () => {
  assert.equal(pastTense('visit'), 'visited');
  assert.equal(pastTense('use'), 'used');
  assert.equal(pastTense('arrive'), 'arrived');
  assert.equal(pastTense('live'), 'lived');
  assert.equal(pastTense('stop'), 'stopped');
  assert.equal(pastTense('need'), 'needed');
  assert.equal(pastTense('work'), 'worked');
  assert.equal(pastTense('start'), 'started');
  assert.equal(pastTense('wear'), 'wore');
  assert.equal(pastTense('see'), 'saw');
  assert.equal(pastTense('get'), 'got');
  assert.equal(pastTense('go'), 'went');
  assert.equal(pastTense('carry'), 'carried');
});
```

- [ ] **Step 2: Run to verify it fails** — `pnpm --filter @workspace/curriculum exec node --experimental-strip-types --test src/__tests__/englishGrammarEngine.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** in `englishGrammar.ts`: after `presentParticiple` add

```ts
// ─── Adjective and past forms (Grade 4) ───────────────────────────────────

/** The comparative and superlative of every adjective a Grade 4 pattern compares, written out: a rule would guess `quieter` against `more quiet`. */
export const ADJECTIVE_FORMS: Record<string, [string, string]> = {
  high: ['higher', 'highest'], deep: ['deeper', 'deepest'], wide: ['wider', 'widest'],
  beautiful: ['more beautiful', 'most beautiful'], boring: ['more boring', 'most boring'],
  colourful: ['more colourful', 'most colourful'], dangerous: ['more dangerous', 'most dangerous'],
  delicious: ['more delicious', 'most delicious'], difficult: ['more difficult', 'most difficult'],
  exciting: ['more exciting', 'most exciting'], interesting: ['more interesting', 'most interesting'],
};

export function comparativeOf(adj: string): string {
  const forms = ADJECTIVE_FORMS[adj];
  if (!forms) throw new Error(`no comparative for «${adj}»: add it to ADJECTIVE_FORMS`);
  return forms[0];
}

export function superlativeOf(adj: string): string {
  const forms = ADJECTIVE_FORMS[adj];
  if (!forms) throw new Error(`no superlative for «${adj}»: add it to ADJECTIVE_FORMS`);
  return forms[1];
}

/** Irregular and doubled past forms. Every regular verb the rule below gets right is not listed. */
export const PAST_OVERRIDES: Record<string, string> = {
  stop: 'stopped', wear: 'wore', see: 'saw', get: 'got', go: 'went', eat: 'ate', have: 'had', give: 'gave', make: 'made', buy: 'bought',
};

function pastWord(word: string): string {
  if (PAST_OVERRIDES[word]) return PAST_OVERRIDES[word];
  if (/e$/.test(word)) return `${word}d`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ied`;
  return `${word}ed`;
}

/** «visit the museum» → «visited the museum». The first word is the verb. */
export function pastTense(phrase: string): string {
  return inflectFirst(phrase, pastWord);
}
```

and extend `realise`'s regex and branches: `const SLOT = /\{(?:(a|s|v|3|ing|cmp|sup|ed):)?([A-Za-z0-9]+)\}/g;` plus

```ts
    else if (form === 'cmp') tokens.push(...comparativeOf(word).split(' '));
    else if (form === 'sup') tokens.push(...superlativeOf(word).split(' '));
    else if (form === 'ed') tokens.push(...pastTense(word).split(' '));
```

Update the `GrammarPattern.text` doc comment to list the three forms.

- [ ] **Step 4: Run to verify it passes**; then `pnpm --filter @workspace/curriculum test` (Grade 1–3 unchanged).
- [ ] **Step 5: Typecheck and commit** — `Grade 4 grammar engine: comparative, superlative and past forms`.

---

### Task 2: A form Choose that names its wrong option

**Files:** Modify `englishGrammar.ts`; Test `englishGrammarEngine.test.ts`.

**Interfaces:**
- Consumes: Task 1 forms.
- Produces: `choose: { kind: 'form'; slot: string; wrong?: 'base' | 'past' | 'comparative' }`. With `wrong` present the right option is the slot's span as realised and the wrong option is the same slot in the named form (`base` → `{v:slot}`, `past` → `{ed:slot}`, `comparative` → `{cmp:slot}`). Without `wrong` the behaviour is exactly today's third-person diff (Grade 3 output unchanged).

- [ ] **Step 1: Write the failing test** — append:

```ts
import { unitSentences, type GrammarUnit } from '../englishGrammar.ts';

const FORM_UNIT = (patterns: GrammarUnit['patterns'], slots: GrammarUnit['slots']): GrammarUnit =>
  ({ lessonId: 'kbl-g4-eng-s1-nccd-u4_l1', reviewedBy: null, patterns, slots });

test('a form Choose offers a real form: comparative against base, superlative against comparative, past against base, base against past', () => {
  const cmp = unitSentences(FORM_UNIT([{ id: 'c', text: 'The {big} is {cmp:adj} than the {small}.', rows: [{ big: 'mountain', small: 'hill', adj: 'high' }, { big: 'lion', small: 'rabbit', adj: 'dangerous' }], choose: { kind: 'form', slot: 'adj', wrong: 'base' } }], {}));
  assert.deepEqual(cmp.map(s => [s.text, s.choose!.right, s.choose!.wrong, s.choose!.start, s.choose!.length]), [
    ['The mountain is higher than the hill.', 'higher', 'high', 3, 1],
    ['The lion is more dangerous than the rabbit.', 'more dangerous', 'dangerous', 3, 2],
  ]);
  const sup = unitSentences(FORM_UNIT([{ id: 's', text: 'This is the {sup:adj} {n}.', rows: [{ adj: 'deep', n: 'lake' }], choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } }], {}));
  assert.deepEqual([sup[0].choose!.right, sup[0].choose!.wrong], ['deepest', 'deeper']);
  const past = unitSentences(FORM_UNIT([
    { id: 'p', text: 'We {ed:verb} {o}.', rows: [{ verb: 'stop', o: 'there' }], choose: { kind: 'form', slot: 'verb', wrong: 'base' } },
    { id: 'n', text: "We didn't {v:verb} {o}.", rows: [{ verb: 'stop', o: 'there' }], choose: { kind: 'form', slot: 'verb', wrong: 'past' } },
  ], {}));
  assert.deepEqual([past[0].choose!.right, past[0].choose!.wrong], ['stopped', 'stop']);
  assert.deepEqual([past[1].choose!.right, past[1].choose!.wrong], ['stop', 'stopped']);
});
```

- [ ] **Step 2: Run → FAIL** (`wrong` is ignored today: the diff path throws or returns the third-person pair).
- [ ] **Step 3: Implement** — change the `form` member of the `choose` union to `{ kind: 'form'; slot: string; wrong?: 'base' | 'past' | 'comparative' }` and in `unitSentences` replace the `c?.kind === 'form'` branch by:

```ts
      } else if (c?.kind === 'form' && c.wrong) {
        // The right option is the slot as realised; the wrong one is the same slot in the named form.
        const formRe = new RegExp(`\\{(?:3|cmp|sup|ed|v):${c.slot}\\}`);
        if (!formRe.test(p.text)) throw new Error(`"${p.text}" has no form of «${c.slot}» to choose`);
        const code = { base: 'v', past: 'ed', comparative: 'cmp' }[c.wrong];
        const wrongRealised = realise(p.text.replace(formRe, `{${code}:${c.slot}}`), fill);
        const span = spans[c.slot];
        choose = { kind: 'form', start: span[0], length: span[1], right: spanText(tokens, span), wrong: spanText(wrongRealised.tokens, wrongRealised.spans[c.slot]) };
      } else if (c?.kind === 'form') {
```

keeping the existing third-person diff body in the final branch. Update the type's doc comment.

- [ ] **Step 4: Run → PASS**; full curriculum suite green (Grade 3 pinned output unchanged).
- [ ] **Step 5: Typecheck and commit** — `Grade 4 grammar engine: a form Choose that names its wrong option`.

---

### Task 3: Picture-free fact items (`claim` and picture-less `fact`)

**Files:** Modify `englishGrammar.ts`; Test `englishGrammarEngine.test.ts`.

**Interfaces:**
- Produces: `GrammarPattern.claim?: { swap: [string, string] }`; `GrammarSentence.claim: { falseText: string } | null`; a `fact` yes-no is built even when the pattern has no `picture` (its `picture` stays null); `allGrammarSpoken()` also lists every `claim.falseText`.

- [ ] **Step 1: Write the failing test** — append:

```ts
test('a ranking row gives a true sentence, its swapped false twin, and picture-free Yes or No facts', () => {
  const unit = FORM_UNIT([
    { id: 'c', text: 'The {big} is {cmp:adj} than the {small}.', rows: [{ big: 'mountain', small: 'hill', adj: 'high' }], claim: { swap: ['big', 'small'] }, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
    { id: 'q', text: 'Is the {big} {cmp:adj} than the {small}? Yes, it is.', rows: [{ big: 'mountain', small: 'hill', adj: 'high' }], yesNo: { kind: 'fact', question: 'Is the {big} {cmp:adj} than the {small}?', yes: 'Yes, it is.', no: "No, it isn't.", answer: true } },
  ], {});
  const [c, q] = unitSentences(unit);
  assert.equal(c.text, 'The mountain is higher than the hill.');
  assert.deepEqual(c.claim, { falseText: 'The hill is higher than the mountain.' });
  assert.equal(c.picture, null);
  assert.equal(c.falsePicture, null);
  assert.equal(q.picture, null);
  assert.deepEqual([q.yesNo!.kind, q.yesNo!.question, q.yesNo!.answer], ['fact', 'Is the mountain higher than the hill?', true]);
  assert.equal(q.claim, null);
});
```

(The assertion that the false twin is voiced is added in Task 7, once the Grade 4 data exists.)

- [ ] **Step 2: Run → FAIL** (`claim` is undefined; `q.yesNo` is null without a picture).
- [ ] **Step 3: Implement** — add `claim?: { swap: [string, string] }` to `GrammarPattern` and `claim: { falseText: string } | null` to `GrammarSentence`; in `unitSentences`: after computing `picture`,

```ts
      const claim = p.claim
        ? { falseText: realise(p.text, { ...fill, [p.claim.swap[0]]: fill[p.claim.swap[1]], [p.claim.swap[1]]: fill[p.claim.swap[0]] }).tokens.join(' ') }
        : null;
```

change `if (y && picture) {` to `if (y && (picture || (y.kind === 'fact' && !p.picture))) {`, and add `claim,` to the pushed object. In `allGrammarSpoken` add `if (s.claim) out.add(s.claim.falseText);`. In `renderGrammarSheet` show the claim in the «wrong picture» column: `${s.falsePicture ?? (s.claim ? `_${s.claim.falseText}_` : '—')}`.

- [ ] **Step 4: Run → PASS**; full curriculum suite (Grade 1–3 docs byte-identical: `claim` is null there).
- [ ] **Step 5: Typecheck** (root; fix any fake `GrammarSentence` in tests by adding `claim: null`) **and commit** — `Grade 4 grammar engine: picture-free fact items`.

---

### Task 4: The hint `'was'` and mobile support for picture-free items

**Files:** Modify `englishGrammar.ts` (hint type), `artifacts/mobile/services/englishHub/games.ts`, `components/englishHub/GrammarActivities.tsx`, `services/i18n.ts`; Test `artifacts/mobile/services/__tests__/englishGrammarG4Games.test.ts` (created here, extended in Task 8).

**Interfaces:**
- Produces: `hint: 'likes' | 'there' | 'was'` on `GrammarPattern.yesNo`, `GrammarSentence.yesNo` and `YesNoQuestion`; `TrueFalseQuestion = { sentence; pictureWord: string | null; text: string; isTrue: boolean }` (`text` is what is shown and spoken); `YesNoQuestion.picture: { word; count } | null`; i18n `hubGYesNoWas`.

- [ ] **Step 1: Write the failing test** — create `englishGrammarG4Games.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { allGrammarSpoken, type GrammarSentence } from '@workspace/curriculum/englishGrammar';
import { makeRng } from '../publicGames/rng.ts';
import { buildTrueFalseRound, buildYesNoRound, grammarActivityAvailable } from '../englishHub/games.ts';

const sentence = (over: Partial<GrammarSentence>): GrammarSentence => ({
  key: 'k', lessonId: 'kbl-g4-eng-s1-nccd-u4_l1', patternId: 'p', text: 'The mountain is higher than the hill.', tokens: [], picture: null,
  marker: null, choose: null, falsePicture: null, yesNo: null, claim: null, build: null, ...over,
});
const claims = ['mountain', 'lion', 'river', 'lake', 'sea'].map((w, i) =>
  sentence({ key: `c${i}`, text: `The ${w} is higher than the hill.`, claim: { falseText: `The hill is higher than the ${w}.` } }));

describe('picture-free True or false', () => {
  it('draws claims: a true one shows its text, a false one its swapped twin, and no picture word', () => {
    const round = buildTrueFalseRound(claims, makeRng(1));
    assert.equal(round.length, 5);
    for (const q of round) {
      assert.equal(q.pictureWord, null);
      assert.equal(q.text, q.isTrue ? q.sentence.text : q.sentence.claim!.falseText);
    }
    assert.equal(round.filter(q => q.isTrue).length, 3);
    assert.equal(grammarActivityAvailable('grammar-true', claims), true);
  });
});
```

- [ ] **Step 2: Run** — `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishGrammarG4Games.test.ts` → FAIL.
- [ ] **Step 3: Implement.**
  - `englishGrammar.ts`: widen the two `hint` types to `'likes' | 'there' | 'was'`.
  - `games.ts`: `TrueFalseQuestion` as above; `judgeable = Boolean((s.picture && s.falsePicture) || s.claim)`; in `buildTrueFalseRound` map to `{ sentence, isTrue, pictureWord: s.picture && s.falsePicture ? (isTrue ? s.picture.word : s.falsePicture) : null, text: isTrue || !s.claim ? s.text : s.claim.falseText }` (a pictured sentence keeps its own text; a claim's false twin shows the twin). `YesNoQuestion.picture` nullable, `hint` widened; `yesNoUsable = s.yesNo !== null`; `yesNoItem` uses `s.picture` (nullable); `pickByWord` and the `n` computation key on `q.picture?.word ?? q.question`.
  - `GrammarActivities.tsx`: in `TrueFalse` render `{q.pictureWord ? <GrammarPicture word={q.pictureWord} count={q.sentence.picture?.count ?? 1} marker={q.sentence.marker} /> : null}`, show and hear `q.text`, and pass `sentence={q.text}` to `Feedback`; in `YesNo` render the picture only when `q.picture`, and map the hint with `t(q.hint === 'was' ? 'hubGYesNoWas' : q.hint === 'there' ? 'hubGYesNoThere' : 'hubGYesNoLikes')`; `void playWord(round[i + 1].text)` in `TrueFalse.next`.
  - `i18n.ts`: `hubGYesNoWas` — Arabic `'✅ = كان موجودًا، ❌ = لم يكن موجودًا'`, English `"✅ = it was there, ❌ = it wasn't"`, beside the existing `hubGYesNoThere` lines.
- [ ] **Step 4: Run → PASS**; the existing Grade 1–3 mobile grammar tests pass unchanged (`pictureWord` is still the picture word for pictured sentences; add `claim: null` to any fake `GrammarSentence` in existing tests if typecheck asks).
- [ ] **Step 5: Typecheck and commit** — `Grade 4 grammar: picture-free True or false and Yes or No, and the past-tense hint`.

---

### Task 5: Grade 4 data, batch 1 — S1 U1, U2, U3

**Files:** Create `lib/curriculum/src/englishGrammarG4.ts`; Modify `englishGrammar.ts` (`GRAMMAR_UNITS = [...G1, ...G2, ...G3, ...G4]`, import); Test `lib/curriculum/src/__tests__/englishGrammarG4.test.ts`.

**Interfaces:**
- Produces: `GRAMMAR_UNITS_G4: GrammarUnit[]` (grows in Tasks 5–7), `NOT_COVERED_G4: Record<string, string[]>`, helper `L = (sem, unit) => `kbl-g4-eng-s${sem}-nccd-u${unit}_l1``.

The data (written into the file exactly as below; counts are then read from the generator and pinned):

```ts
const COUNTRY_ROWS = [
  { country: 'Egypt', nat: 'Egyptian' }, { country: 'Jordan', nat: 'Jordanian' }, { country: 'Qatar', nat: 'Qatari' },
  { country: 'Spain', nat: 'Spanish' }, { country: 'the United Kingdom', nat: 'British' }, { country: 'the United Arab Emirates', nat: 'Emirati' },
];
const COUNTRIES = COUNTRY_ROWS.map(r => r.country);
const LIKES = ['canoeing', 'going shopping', 'playing basketball', 'playing football', 'playing table tennis', 'playing tennis', 'reading', 'swimming'];
const SUBJECTS = ['Arabic', 'Art', 'Digital Skills', 'English', 'Islamic Studies', 'Maths', 'PE', 'Science', 'Social Studies'];
/** An invented timetable: the subject, day and time are not information. The form says so. */
const TIMETABLE = [
  { subject: 'Arabic', day: 'Sunday', time: '8' }, { subject: 'Maths', day: 'Monday', time: '9' }, { subject: 'English', day: 'Tuesday', time: '10' },
  { subject: 'Science', day: 'Wednesday', time: '11' }, { subject: 'Art', day: 'Thursday', time: '12' }, { subject: 'PE', day: 'Sunday', time: '10' },
  { subject: 'Digital Skills', day: 'Monday', time: '11' }, { subject: 'Islamic Studies', day: 'Tuesday', time: '8' }, { subject: 'Social Studies', day: 'Wednesday', time: '9' },
];
const FREQ = ['always', 'never', 'often', 'sometimes'];
const WHEN = ['every day', 'at the weekend', 'once a week', 'twice a week', 'three times a week'];
const SPORTS5 = ['watch TV', 'read books', 'play tennis', 'play basketball', 'do karate'];
const HOW_OFTEN = [
  { act: 'play tennis', when: 'twice a week' }, { act: 'watch TV', when: 'every day' }, { act: 'read books', when: 'at the weekend' },
  { act: 'do karate', when: 'once a week' }, { act: 'play basketball', when: 'three times a week' },
];
const WHEN_ROWS = [
  { act: 'play tennis', when: 'twice a week' }, { act: 'watch TV', when: 'every day' }, { act: 'read books', when: 'at the weekend' },
  { act: 'do karate', when: 'once a week' }, { act: 'play basketball', when: 'three times a week' }, { act: 'roller skate', when: 'at the weekend' },
  { act: 'skateboard', when: 'every day' }, { act: 'play badminton', when: 'once a week' },
];
/** Countable plural and uncountable foods, classed by hand. `milkshake` is a singular countable and is left out of the quantity patterns. */
const FOOD_PL = ['cupcakes', 'noodles', 'olives', 'sandwiches', 'vegetables'];
const FOOD_UNC = ['cereal', 'fruit', 'salad', 'coffee', 'lemonade', 'tea'];
const CONTAINERS = [
  { cont: 'a bowl of', unc: 'salad' }, { cont: 'a glass of', unc: 'lemonade' }, { cont: 'a cup of', unc: 'coffee' },
  { cont: 'a cup of', unc: 'tea' }, { cont: 'a box of', unc: 'cereal' }, { cont: 'a bag of', unc: 'fruit' },
];
const THERE_Q = (q: string, yes: string, no: string) => ({ kind: 'marker' as const, question: q, yes, no, hint: 'there' as const });
```

Units:

```ts
  { // to be and like; nationalities
    lessonId: L(1, 1), reviewedBy: null,
    patterns: [
      { id: 'from', text: "I'm from {v:country}.", picture: 'country', choose: { kind: 'slot', slot: 'country' } },
      { id: 'hefrom', text: "He's from {v:country}.", picture: 'country', marker: 'boy', choose: { kind: 'phrase', right: "He's", wrong: "She's" } },
      { id: 'shefrom', text: "She's from {v:country}.", picture: 'country', marker: 'girl', choose: { kind: 'phrase', right: "She's", wrong: "He's" } },
      { id: 'where', text: "Where are you from? I'm from {v:country}.", picture: 'country' },
      { id: 'isfrom', text: 'Are you from {v:country}? Yes, I am.', picture: 'country', yesNo: { kind: 'match', question: 'Are you from {v:country}?', yes: 'Yes, I am.', no: "No, I'm not." } },
      { id: 'nat', text: "I'm {nat}.", picture: 'country', rows: COUNTRY_ROWS },
      { id: 'like', text: 'I like {act}.', choose: { kind: 'phrase', right: 'like', wrong: 'likes' } },
      { id: 'helikes', text: 'He likes {act}.', choose: { kind: 'phrase', right: 'likes', wrong: 'like' } },
      { id: 'shelikes', text: 'She likes {act}.', choose: { kind: 'phrase', right: 'likes', wrong: 'like' } },
    ],
    slots: { country: COUNTRIES, act: LIKES },
  },
  { // present simple with days and times; adverbs of frequency
    lessonId: L(1, 2), reviewedBy: null,
    patterns: [
      { id: 'timetable', text: "We have {v:subject} on {s:day} at {time} o'clock.", rows: TIMETABLE, choose: { kind: 'phrase', right: 'on', wrong: 'at' } },
      { id: 'hefreq', text: 'He {freq} {3:act}.', choose: { kind: 'form', slot: 'act' } },
      { id: 'shewhen', text: 'She {3:act} {v:when}.', rows: WHEN_ROWS, choose: { kind: 'form', slot: 'act' } },
      { id: 'often', text: 'How often do you {v:act}? I {v:act} {v:when}.', rows: HOW_OFTEN, choose: { kind: 'phrase', right: 'do', wrong: 'does' } },
    ],
    slots: { freq: FREQ, act: SPORTS5, when: WHEN },
  },
  { // there is / are with countable and uncountable nouns; a lot of, a little, any
    lessonId: L(1, 3), reviewedBy: null,
    patterns: [
      { id: 'lotu', text: "There's a lot of {unc}.", picture: 'unc', marker: 'yes', choose: { kind: 'phrase', right: "There's", wrong: 'There are' } },
      { id: 'lotp', text: 'There are a lot of {pl}.', picture: 'pl', marker: 'many', choose: { kind: 'phrase', right: 'There are', wrong: "There's" } },
      { id: 'little', text: "There's a little {unc}.", picture: 'unc', marker: 'yes', choose: { kind: 'phrase', right: 'a little', wrong: 'a few' } },
      { id: 'anyu', text: "There isn't any {unc}.", picture: 'unc', marker: 'no', choose: { kind: 'phrase', right: "isn't", wrong: "aren't" } },
      { id: 'anyp', text: "There aren't any {pl}.", picture: 'pl', marker: 'no', choose: { kind: 'phrase', right: "aren't", wrong: "isn't" } },
      { id: 'cont', text: "There's {v:cont} {unc}.", picture: 'unc', marker: 'yes', rows: CONTAINERS },
      { id: 'qpy', text: 'Are there any {pl}? Yes, there are.', picture: 'pl', marker: 'yes', yesNo: THERE_Q('Are there any {pl}?', 'Yes, there are.', "No, there aren't.") },
      { id: 'qpn', text: "Are there any {pl}? No, there aren't.", picture: 'pl', marker: 'no', yesNo: THERE_Q('Are there any {pl}?', 'Yes, there are.', "No, there aren't.") },
      { id: 'quy', text: 'Is there any {unc}? Yes, there is.', picture: 'unc', marker: 'yes', yesNo: THERE_Q('Is there any {unc}?', 'Yes, there is.', "No, there isn't.") },
      { id: 'qun', text: "Is there any {unc}? No, there isn't.", picture: 'unc', marker: 'no', yesNo: THERE_Q('Is there any {unc}?', 'Yes, there is.', "No, there isn't.") },
    ],
    slots: { unc: FOOD_UNC, pl: FOOD_PL },
  },
```

and `NOT_COVERED_G4` keys for the lessons (text in Arabic, form-safe): S1 U1 (nationalities have no Choose: no picture word to offer; «Are you from…» Yes/No by flags), S1 U2 (no pictures; the timetable is invented), S1 U3 (`milkshake` left out; «a few» appears only as a wrong option; quantities are not shown by the picture; the picture says only that the food is there).

- [ ] **Step 1: Write the failing test** — create `englishGrammarG4.test.ts` with: units exist for the lessons built so far, `reviewedBy: null`, `offeredGrammar` null; `unitSentences` of each builds; every sentence has `build`; slot words (and row words outside `FREE_SLOTS = new Set(['time', 'when', 'subj', 'obj', 'big', 'small', 'where', 'n', 'thing'])`) come from this lesson, an earlier Grade 4 lesson or an earlier grade; S1 U1 `isfrom` is `match` Yes or No; S1 U3 picture-and-marker patterns have pictures only for pictured words. The per-lesson counts are pinned in Step 4.
- [ ] **Step 2: Run → FAIL** (module missing).
- [ ] **Step 3: Implement** — create the file with the data above, header comment pointing to the spec, and `import type { GrammarUnit } from './englishGrammar.ts'`; add `import { GRAMMAR_UNITS_G4 } from './englishGrammarG4.ts'` to `englishGrammar.ts` and include it in `GRAMMAR_UNITS`.
- [ ] **Step 4: Run, read the measured counts** with `node --experimental-strip-types -e` over `unitSentences`, **write them into the test as pinned numbers**, run again → PASS; `pnpm --filter @workspace/curriculum test` (Grade 1–3 forms unchanged; the Grade 4 form does not exist yet, so no pin yet).
- [ ] **Step 5: Typecheck and commit** — `Grade 4 grammar data: S1 U1, U2 and U3 (hidden)`.

---

### Task 6: Grade 4 data, batch 2 — S1 U4 and U5

**Files:** Modify `englishGrammarG4.ts`; Test `englishGrammarG4.test.ts`.

Add the data:

```ts
/** Plainly true comparisons: the first is the bigger, higher, deeper or wider. Every pair is on the teacher's form; the swapped twin is the false statement. */
const RANKING = [
  { big: 'mountain', small: 'hill', adj: 'high' }, { big: 'lake', small: 'pool', adj: 'deep' }, { big: 'sea', small: 'lake', adj: 'deep' },
  { big: 'river', small: 'stream', adj: 'wide' }, { big: 'lion', small: 'rabbit', adj: 'dangerous' }, { big: 'shark', small: 'goldfish', adj: 'dangerous' },
];
const RANKING_SWAPPED = RANKING.map(r => ({ big: r.small, small: r.big, adj: r.adj }));
const LONG_ROWS = [
  { a: 'Swimming', b: 'walking', adj: 'exciting' }, { a: 'Canoeing', b: 'reading', adj: 'exciting' }, { a: 'Football', b: 'chess', adj: 'difficult' },
];
const SUPER_ROWS = [
  { adj: 'deep', n: 'lake', where: 'Jordan' }, { adj: 'high', n: 'mountain', where: 'Jordan' }, { adj: 'wide', n: 'river', where: 'Jordan' },
  { adj: 'beautiful', n: 'island', where: 'the world' }, { adj: 'interesting', n: 'town', where: 'Jordan' },
];
const JOBS4 = ['bus driver', 'carpenter', 'chef', 'doctor', 'farmer', 'firefighter', 'mechanic', 'police officer', 'scientist', 'teacher', 'vet'];
/** What a pupil must and mustn't do at school. Every rule is on the form, so a wrong rule cannot be generated. */
const MUST = ['arrive on time', 'be quiet in class', 'follow the rules', 'put litter in the bin'];
const MUSTNT = ['be late', 'break the rules', 'drop litter', 'shout in class'];
const WEAR = [
  { colour: 'green', clothes: 'coat' }, { colour: 'red', clothes: 'dress' }, { colour: 'blue', clothes: 'hat' },
  { colour: 'yellow', clothes: 'scarf' }, { colour: 'white', clothes: 'shirt' }, { colour: 'green', clothes: 'jacket' },
];
```

Units:

```ts
  { // comparatives and superlatives
    lessonId: L(1, 4), reviewedBy: null,
    patterns: [
      { id: 'cmp', text: 'The {big} is {cmp:adj} than the {small}.', rows: RANKING, claim: { swap: ['big', 'small'] }, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
      { id: 'cmpy', text: 'Is the {big} {cmp:adj} than the {small}? Yes, it is.', rows: RANKING, yesNo: { kind: 'fact', question: 'Is the {big} {cmp:adj} than the {small}?', yes: 'Yes, it is.', no: "No, it isn't.", answer: true } },
      { id: 'cmpn', text: "Is the {big} {cmp:adj} than the {small}? No, it isn't.", rows: RANKING_SWAPPED, yesNo: { kind: 'fact', question: 'Is the {big} {cmp:adj} than the {small}?', yes: 'Yes, it is.', no: "No, it isn't.", answer: false } },
      { id: 'long', text: '{a} is {cmp:adj} than {b}.', rows: LONG_ROWS, choose: { kind: 'form', slot: 'adj', wrong: 'base' } },
      { id: 'sup', text: 'This is the {sup:adj} {n} in {v:where}.', rows: SUPER_ROWS, choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } },
      { id: 'amman', text: 'Amman is the {sup:adj} city in the world.', choose: { kind: 'form', slot: 'adj', wrong: 'comparative' } },
    ],
    slots: { adj: ['exciting', 'beautiful', 'interesting'] },
  },
  { // present continuous; must / mustn't
    lessonId: L(1, 5), reviewedBy: null,
    patterns: [
      { id: 'hejob', text: "He's {a:job}.", picture: 'job', marker: 'boy', choose: { kind: 'slot', slot: 'job' } },
      { id: 'shejob', text: "She's {a:job}.", picture: 'job', marker: 'girl', choose: { kind: 'slot', slot: 'job' } },
      { id: 'must', text: 'You must {v:rule}.', rows: MUST.map(rule => ({ rule })), choose: { kind: 'phrase', right: 'must', wrong: "mustn't" } },
      { id: 'mustnt', text: "You mustn't {v:rule}.", rows: MUSTNT.map(rule => ({ rule })), choose: { kind: 'phrase', right: "mustn't", wrong: 'must' } },
      { id: 'wear', text: "I'm wearing {a:colour} {clothes}.", picture: 'clothes', rows: WEAR, choose: { kind: 'slot', slot: 'clothes' } },
      { id: 'wearq', text: 'Are you wearing {a:colour} {clothes}? Yes, I am.', picture: 'clothes', rows: WEAR, yesNo: { kind: 'match', question: 'Are you wearing {a:colour} {clothes}?', yes: 'Yes, I am.', no: "No, I'm not." } },
    ],
    slots: { job: JOBS4 },
  },
```

Notes: `slotList` falls back to the rows' values for `clothes`, so True or false and the slot Choose pick another pictured clothes word; `jacket` has no picture, so its `wear` and `wearq` items drop out of the picture activities only. `NOT_COVERED_G4` adds notes for these two lessons (S1 U4: pictures not used; comparisons only from the written ranking; superlatives and long-adjective opinions are Choose and Build only; S1 U5: `jacket` has no picture; the rules are the eight written rows).

- [ ] **Step 1: Failing test** — append: S1 U4 has no pictures and no `claim`-less True or false (every `cmp` sentence has a `claim`; the swapped twin is never itself a ranking row: `RANKING` pairs checked by building the set of «big|small|adj» keys and asserting `{small|big|adj}` is absent); every `cmpy` is `fact` answer true and every `cmpn` answer false; `choose.right` and `choose.wrong` differ on every form Choose and the sentence with the right option replaced by the wrong one differs only there; `unitSentences(S1U4)` has picture-free Yes or No items only here (no other Grade 4 unit has a `fact` yes-no without a picture).
- [ ] **Step 2: Run → FAIL**, **Step 3: implement**, **Step 4: read counts, pin them, run → PASS** (`pnpm --filter @workspace/curriculum test`), **Step 5: typecheck and commit** — `Grade 4 grammar data: S1 U4 and U5 (hidden)`.

---

### Task 7: Grade 4 data, batch 3 — S2 U7, U8, U9, U10

**Files:** Modify `englishGrammarG4.ts`; Test `englishGrammarG4.test.ts`.

```ts
const HOBBIES = ['build a robot', 'dress up', 'go fishing', 'go sailing', 'go windsurfing', 'kick', 'knit', 'play board games', 'play chess', 'play computer games', 'sew', 'skip'];
/** One adverb each, with an act it plausibly goes with. The teacher checks each. */
const MANNER = [
  { act: 'sew', adv: 'well' }, { act: 'knit', adv: 'carefully' }, { act: 'kick', adv: 'badly' }, { act: 'skip', adv: 'quickly' },
  { act: 'build a robot', adv: 'easily' }, { act: 'play chess', adv: 'quietly' }, { act: 'go sailing', adv: 'slowly' }, { act: 'play board games', adv: 'loudly' },
];
const WELL = ['sew', 'play chess', 'skip', 'go sailing'].map(act => ({ act }));
const PLACES = ['bridge', 'bus stop', 'car park', 'clothes shop', 'hotel', 'market', 'museum', 'restaurant', 'shopping centre', 'square', 'train station', 'zoo'];
const PLACE_ADJ = [
  { adj: 'expensive', place: 'clothes shop' }, { adj: 'cheap', place: 'market' }, { adj: 'busy', place: 'train station' }, { adj: 'noisy', place: 'shopping centre' },
  { adj: 'quiet', place: 'museum' }, { adj: 'safe', place: 'square' }, { adj: 'modern', place: 'hotel' }, { adj: 'ancient', place: 'bridge' },
];
const VISIT_PLACES = ['museum', 'zoo', 'market', 'hotel', 'restaurant', 'bridge'];
/** Regular past: a subject, a verb of the lesson and what it did. Every row is on the form. */
const PAST_ROWS = [
  { subj: 'People in the past', verb: 'use', obj: 'clay' }, { subj: 'People in the past', verb: 'use', obj: 'iron' }, { subj: 'People in the past', verb: 'use', obj: 'stone' },
  { subj: 'People in the past', verb: 'need', obj: 'water' }, { subj: 'The builders', verb: 'work', obj: 'with stone' }, { subj: 'The visitors', verb: 'arrive', obj: 'at the museum' },
  { subj: 'We', verb: 'visit', obj: 'the museum' }, { subj: 'The bus', verb: 'stop', obj: 'at the bus stop' }, { subj: 'The family', verb: 'live', obj: 'in a house' },
  { subj: 'The lesson', verb: 'start', obj: 'at eight' },
];
/** Irregular past: the book's own examples (wore, saw, got) and a few more for a celebration. Every row is on the form. */
const IRREGULAR_ROWS = [
  { subj: 'I', verb: 'wear', obj: 'this dress at our wedding' }, { subj: 'We', verb: 'see', obj: 'the ring again' }, { subj: 'I', verb: 'get', obj: 'an invitation' },
  { subj: 'We', verb: 'go', obj: 'to the funfair' }, { subj: 'They', verb: 'eat', obj: 'a big cake' }, { subj: 'He', verb: 'give', obj: 'me a present' },
  { subj: 'We', verb: 'make', obj: 'a costume' }, { subj: 'I', verb: 'buy', obj: 'a candle' }, { subj: 'The bride', verb: 'wear', obj: 'a white dress' },
  { subj: 'We', verb: 'see', obj: 'the groom' },
];
const DID_ROWS = [
  { verb: 'get', obj: 'any presents' }, { verb: 'go', obj: 'to the funfair' }, { verb: 'see', obj: 'the bride' }, { verb: 'make', obj: 'a costume' }, { verb: 'eat', obj: 'the cake' },
];
```

Units:

```ts
  { // can / can't; adverbs of manner
    lessonId: L(2, 7), reviewedBy: null,
    patterns: [
      { id: 'ican', text: 'I can {v:act}.' },
      { id: 'icant', text: "I can't {v:act}." },
      { id: 'youyes', text: 'Can you {v:act}? Yes, I can.', choose: { kind: 'phrase', right: 'Can', wrong: 'Do' } },
      { id: 'youno', text: "Can you {v:act}? No, I can't.", choose: { kind: 'phrase', right: 'Can', wrong: 'Do' } },
      { id: 'adv', text: 'She can {v:act} {adv}.', rows: MANNER },
      { id: 'well', text: 'She can {v:act} well.', rows: WELL, choose: { kind: 'phrase', right: 'well', wrong: 'good' } },
    ],
    slots: { act: HOBBIES },
  },
  { // past simple of to be; there was / were
    lessonId: L(2, 8), reviewedBy: null,
    patterns: [
      { id: 'she', text: 'She was at the {v:place} last week.', choose: { kind: 'phrase', right: 'was', wrong: 'were' } },
      { id: 'they', text: 'They were at the {v:place} yesterday.', choose: { kind: 'phrase', right: 'were', wrong: 'was' } },
      { id: 'where', text: 'Where were you yesterday morning? I was at the {v:place}.', choose: { kind: 'phrase', right: 'were', wrong: 'was' } },
      { id: 'was', text: 'There was {a:place}.', picture: 'place', marker: 'yes', choose: { kind: 'phrase', right: 'There was', wrong: 'There were' } },
      { id: 'wasnt', text: "There wasn't {a:place}.", picture: 'place', marker: 'no', choose: { kind: 'phrase', right: "There wasn't", wrong: "There weren't" } },
      { id: 'were', text: 'There were two {s:place}.', picture: 'place', marker: 'many', choose: { kind: 'phrase', right: 'There were', wrong: 'There was' } },
      { id: 'adj', text: 'There was {a:adj} {place}.', picture: 'place', marker: 'yes', rows: PLACE_ADJ },
      { id: 'qy', text: 'Was there {a:place}? Yes, there was.', picture: 'place', marker: 'yes', yesNo: { kind: 'marker', question: 'Was there {a:place}?', yes: 'Yes, there was.', no: "No, there wasn't.", hint: 'was' } },
      { id: 'qn', text: "Was there {a:place}? No, there wasn't.", picture: 'place', marker: 'no', yesNo: { kind: 'marker', question: 'Was there {a:place}?', yes: 'Yes, there was.', no: "No, there wasn't.", hint: 'was' } },
    ],
    slots: { place: PLACES },
  },
  { // past simple, regular verbs
    lessonId: L(2, 9), reviewedBy: null,
    patterns: [
      { id: 'past', text: '{v:subj} {ed:verb} {v:obj}.', rows: PAST_ROWS, choose: { kind: 'form', slot: 'verb', wrong: 'base' } },
      { id: 'neg', text: "{v:subj} didn't {v:verb} {v:obj}.", rows: PAST_ROWS, choose: { kind: 'form', slot: 'verb', wrong: 'past' } },
      { id: 'qy', text: 'Did you visit the {v:place}? Yes, I did.', choose: { kind: 'phrase', right: 'Did', wrong: 'Do' } },
      { id: 'qn', text: "Did you visit the {v:place}? No, I didn't.", choose: { kind: 'phrase', right: 'Did', wrong: 'Do' } },
    ],
    slots: { place: VISIT_PLACES },
  },
  { // past simple, irregular verbs
    lessonId: L(2, 10), reviewedBy: null,
    patterns: [
      { id: 'past', text: '{v:subj} {ed:verb} {v:obj}.', rows: IRREGULAR_ROWS, choose: { kind: 'form', slot: 'verb', wrong: 'base' } },
      { id: 'neg', text: "{v:subj} didn't {v:verb} {v:obj}.", rows: IRREGULAR_ROWS, choose: { kind: 'form', slot: 'verb', wrong: 'past' } },
      { id: 'qy', text: 'Did you {v:verb} {v:obj}? Yes, I did.', rows: DID_ROWS, choose: { kind: 'phrase', right: 'Did', wrong: 'Do' } },
      { id: 'qn', text: "Did you {v:verb} {v:obj}? No, I didn't.", rows: DID_ROWS, choose: { kind: 'phrase', right: 'Did', wrong: 'Do' } },
    ],
    slots: {},
  },
```

Note for S2 U8's `were` pattern: pictured with `many`; `adj` places use picture marker yes; `qy/qn` use the hint `'was'`. Add `NOT_COVERED_G4` notes for S2 U7 (no pictures; the adverb rows are the teacher's check), S2 U8 (pictures only for there was / wasn't; past of to be has no picture; `clothes shop`, `shopping centre`, `square` have no picture), S2 U9 (no pictures; verb-object rows), S2 U10 (no pictures; irregular rows; ordinals not covered), and a `S2 U6` entry rendered by the form as a lesson with no grammar activities.

- [ ] **Step 1: Failing test** — append: every Grade 4 hub lesson has a unit (9), all unsigned, none offered; the 9 per-lesson counts and the total pinned from the generator; every Grade 4 sentence is buildable; every verb used with `{ed:}` has its expected past (`pastTense` of each verb in `PAST_ROWS` and `IRREGULAR_ROWS` equals the list in the test); every adjective used with `{cmp:}`/`{sup:}` is in `ADJECTIVE_FORMS`; pictures only on S1 U1, U3, U5 and S2 U8, and S2 U8's pictured patterns are exactly `was, wasnt, were, adj, qy, qn`; Yes or No lessons are exactly S1 U1, U3, U4, U5, S2 U8; the hint of every S2 U8 `marker` yes-no is `'was'`; the false twin of every `cmp` sentence is in `allGrammarSpoken()`; no two sentences of one unit have the same text (a duplicate would print twice).
- [ ] **Step 2: Run → FAIL**, **Step 3: implement**, **Step 4: read counts, pin them, run → PASS**, **Step 5: typecheck and commit** — `Grade 4 grammar data: S2 U7, U8, U9 and U10 (hidden)`.

---

### Task 8: Mobile builders on the Grade 4 data

**Files:** Test `artifacts/mobile/services/__tests__/englishGrammarG4Games.test.ts` (extend); `games.ts` only if a test shows a real defect.

- [ ] **Step 1: Extend the test** over the real data (`offeredGrammar` is null, so use `unitSentences(grammarUnit(id)!)`): for every Grade 4 lesson and seeds 1–8, `buildChooseRound`, `buildBuildRound` (every question's tiles judged right by `isSentenceBuilt` when ordered), `buildTrueFalseRound` and `buildYesNoRound` produce at most 8 questions with the shapes the Grade 3 test asserts; the S1 U4 True or false round has no `pictureWord` and its false items show the swapped twin; the S1 U4 Yes or No round has no picture and keeps half yes, half no; S2 U8's Yes or No hint is `'was'`; the activity matrix per lesson (`grammarActivityAvailable`): Choose on all nine, Build on all nine, True or false on S1 U1, U3, U4, U5 and S2 U8, Yes or No on S1 U1, U3, U4, U5 and S2 U8; every sentence, prompt and claim is in `allGrammarSpoken()`.
- [ ] **Step 2: Run** (`cd artifacts/mobile && pnpm test` for the suite or the single file with the alias flags) → PASS without changing `games.ts`; if a case fails, fix the builder narrowly and say so in the commit.
- [ ] **Step 3: Typecheck and commit** — `Grade 4 grammar: round builder tests on the Grade 4 lessons`.

---

### Task 9: The teacher's form, data page and sheet

**Files:** Modify `englishGrammarReview.ts`, `scripts/grammar-sheet.ts`, `englishGrammarG4.ts` (`G4_DATA_PAGE`, `NOT_COVERED_G4`); Generate `docs/english-grammar-g4-sheet.md`, `docs/english-grammar-g4-review.html`; Test `englishGrammarG4.test.ts` (append).

**Interfaces:**
- Produces: `G4_DATA_PAGE: { title: string; headers: string[]; rows: string[][] }[]` exported from `englishGrammarG4.ts` (adjective forms, ranking pairs with the false twin, the food classes, the rule rows, the nationalities, the irregular and doubled pasts, the invented timetable, the manner-adverb rows); `renderGrammarReviewHtml(4)`.

- [ ] **Step 1: Failing tests** — append: the form lists every Grade 4 sentence once (`<td class="sentence" dir="ltr">` count equals the total), has 9 `<section class="unit"` unit pages plus a not-covered block for S2 U6, a data page with every table of `G4_DATA_PAGE` (a row count per table), shows a `cmp` claim (`The hill is higher than the mountain.`) in the True or false cell and a picture-free Yes or No row, and the committed `english-grammar-g4-review.html` and `-sheet.md` equal their generators; the Grade 1, 2 and 3 grammar sheets and forms and the three reading forms equal their generators.
- [ ] **Step 2: Run → FAIL**.
- [ ] **Step 3: Implement.** In `englishGrammarReview.ts`: add `4: NOT_COVERED_G4` to `NOT_COVERED`; in `falseCell` return a red `<span class="yn yn-no" dir="ltr">…</span>` of `s.claim.falseText` when there is a claim and no picture; add `GRADE_COPY[4]` (title «مراجعة قواعد الصف الرابع», eyebrow, lead naming the units and sentence count and that comparisons and rules come from written lists, the four activities, checks that name the ranking pairs, the comparative options and «✅ = it was there»); render the data page after the intro as one `<section class="data">` of tables (CSS in `extraCss`, print `break-before: page`); add the S2 U6 block through the existing `renderUncovered` with `NOT_COVERED_G4` text («لا قائمة كلمات لهذه الوحدة (مراجعة)، فلا قواعد لها هنا»). In `scripts/grammar-sheet.ts` extend the loop to `[1, 2, 3, 4]` and the header comment. Build `G4_DATA_PAGE` from the same constants the units use, so the page cannot drift.
- [ ] **Step 4: Generate** — `pnpm --filter @workspace/curriculum run grammar-sheet`; `git status` must show only the two new Grade 4 files and **no change** to any Grade 1–3 grammar file or reading form; `pnpm --filter @workspace/curriculum test` green.
- [ ] **Step 5: Typecheck and commit** — `Grade 4 grammar: the teacher's printable form, data page and sheet`.

---

### Task 10: Browser check, docs, PR

- [ ] **Step 1: Full verification** — `pnpm run typecheck`; `pnpm --filter @workspace/curriculum test`; `cd artifacts/mobile && pnpm test` (about 5 minutes, in the background; do not edit sign-offs until it finishes).
- [ ] **Step 2: Browser check** (390 px, Arabic and English). With the mobile suite finished, set `reviewedBy: { name: 'LOCAL CHECK', date: '2026-10-22' }` on S1 U1, S1 U3, S1 U4, S2 U8 and S2 U9 in `englishGrammarG4.ts` (working tree only), build the web bundle (`EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web` in `artifacts/mobile`), serve it with `WEB_PORT=8098 node e2e/serve.mjs` (kill by PID), and drive it with Playwright through: a pictured lesson (S1 U1 flags, Choose and Yes or No); a picture-free Choose and Build (S2 U9 form Choose «visited / visit», Build); S1 U4 picture-free True or false (a true claim and its swapped twin) and Yes or No (no picture, half yes and half no); S2 U8 Yes or No with the hint «✅ = it was there»; an unsigned unit showing nothing; no horizontal scroll. Then **restore** `englishGrammarG4.ts` with `git checkout` and confirm `grep -c "LOCAL CHECK"` is 0 and `git status` is clean.
- [ ] **Step 3: Docs** — a «Grade 4 grammar in the English corner — built, shown to nobody yet» section at the **top** of `docs/status-log.md` (what was built, what was and was not verified, the switch-on steps), one index line in `STATUS.md`, the spec's status set to implemented and its example sentences aligned with the plan's definite-article rows.
- [ ] **Step 4: Commit, push to `ccr-d9db5f6c-mgwkuo`, update the PR body** of #1171 (it stays a draft; do not mark ready or merge), then check its `mergeable_state` and CI.
