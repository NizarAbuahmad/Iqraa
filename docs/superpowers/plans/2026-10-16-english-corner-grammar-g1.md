# English corner: Grade 1 grammar activities — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three grammar activities (Choose the word, Build the sentence, True or
false) for the Grade 1 English-corner lessons, generated from the book's
patterns and the lessons' words, offered to nobody until a teacher signs a unit
off.

**Architecture:** A pure generator in `lib/curriculum` turns per-lesson pattern
data into a finite list of sentences (with tokens, Choose blank, pictures);
the same module renders the teacher's sheet, and a test pins the committed
sheet to it. The emoji map moves into `lib/curriculum` so the sheet and the
app agree on which items have pictures. The mobile side adds round builders to
`services/englishHub/games.ts` and three components, shown under a «القواعد»
heading on the lesson screen only when `offeredGrammar(lessonId)` is non-null.

**Tech Stack:** TypeScript, `node --test` (no RN transform), Expo / React
Native Web.

**Spec:** `docs/superpowers/specs/2026-10-16-english-corner-grammar-g1-design.md`

## Global Constraints

- Grade 1 only; Semester 1 Unit 0 gets no grammar.
- A slot may name words of its own lesson or an earlier Grade 1 lesson, never a later one.
- `reviewedBy: null` → no grammar card for anyone. It is the only switch.
- Sentences longer than 7 tiles are never used in Build the sentence.
- English text is always LTR; only instructions follow the UI language.
- Mobile tests must live in `artifacts/mobile/services/__tests__/` and import nothing from `react-native`.
- Relative imports loaded by `node --test` carry an explicit `.ts` extension.
- Progress stays device-only; nothing new reaches the server.
- Gaps and sizes stay on the `SPACE`/`TYPE` steps the design-scale ratchet allows (`designScale.test.ts`).

**Deviation from the spec, decided while planning:** Semester 2 Unit 0's
vocabulary has no family words, so it uses the Unit 2 (I've got) and Unit 4
(favourite toy) patterns instead of Unit 1's.

---

### Task 1: Move the picture map into `lib/curriculum`

**Files:**
- Create: `lib/curriculum/src/englishPictures.ts` (the `WORD_EMOJI` table, `wordPicture`, `isPicturable`)
- Modify: `lib/curriculum/package.json` exports (add `./englishPictures`)
- Modify: `artifacts/mobile/services/englishHub/games.ts` (delete the table; import and re-export)
- Test: existing `artifacts/mobile/services/__tests__/englishHubGames.test.ts` (unchanged, must stay green)

**Interfaces:**
- Produces: `wordPicture(word: string): string | null`, `isPicturable(word: string): boolean` from `@workspace/curriculum/englishPictures`; `games.ts` keeps exporting both names.

- [ ] Step 1: Copy the `WORD_EMOJI` object and its doc comment verbatim from `games.ts` into `englishPictures.ts`, with:

```ts
export function wordPicture(word: string): string | null {
  return WORD_EMOJI[word] ?? null;
}
export function isPicturable(word: string): boolean {
  return wordPicture(word) !== null;
}
```

- [ ] Step 2: In `games.ts`, delete the table and the two functions; add
  `import { isPicturable, wordPicture } from '@workspace/curriculum/englishPictures';`
  and `export { isPicturable, wordPicture };`. Replace the remaining internal
  `WORD_EMOJI[w.en]` uses with `wordPicture(w.en)` (`buildPictureBoard`).
- [ ] Step 3: Add `"./englishPictures": "./src/englishPictures.ts"` to the curriculum package `exports` (same shape as `./englishHub`).
- [ ] Step 4: Run `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/englishHubGames.test.ts` — expected all pass.
- [ ] Step 5: Commit `refactor: move the English corner's picture map into lib/curriculum`.

### Task 2: The grammar generator and the Grade 1 data

**Files:**
- Create: `lib/curriculum/src/englishGrammar.ts`
- Modify: `lib/curriculum/package.json` exports (add `./englishGrammar`)
- Test: `lib/curriculum/src/__tests__/englishGrammar.test.ts`

**Interfaces:**
- Consumes: `wordPicture` (Task 1); `hubLessonsForGrade`, `hubLesson` from `./englishHub.ts`.
- Produces:

```ts
export type GrammarMarker = 'yes' | 'no' | 'boy' | 'girl' | 'many';
export interface GrammarPattern {
  id: string;
  /** `{slot}` bare, `{a:slot}` with a/an, `{s:slot}` plural. */
  text: string;
  /** The slot whose word is pictured. */
  picture?: string;
  marker?: GrammarMarker;
  choose:
    | { kind: 'phrase'; right: string; wrong: string }
    | { kind: 'slot'; slot: string }
    | { kind: 'whole'; other: string };
}
export interface GrammarUnit {
  lessonId: string;
  reviewedBy: { name: string; date: string } | null;
  patterns: GrammarPattern[];
  slots: Record<string, string[]>;
}
export interface GrammarSentence {
  key: string;            // `${lessonId}|${patternId}|${fill words joined by '+'}`
  lessonId: string;
  patternId: string;
  text: string;
  tokens: string[];       // word tiles; a multi-word slot word is one tile
  picture: { word: string; count: 1 | 2 } | null;   // null when the pictured word has no emoji
  marker: GrammarMarker | null;
  choose: { kind: 'phrase' | 'slot' | 'whole'; start: number; length: number; right: string; wrong: string } | null;
  falsePicture: string | null; // another word of the picture slot with an emoji, for True or false
}
export const GRAMMAR_UNITS: GrammarUnit[];
export function grammarUnit(lessonId: string): GrammarUnit | undefined;
export function unitSentences(unit: GrammarUnit): GrammarSentence[];
export function offeredGrammar(lessonId: string): GrammarSentence[] | null; // null unless reviewed
export function withArticle(word: string): string;
export function pluralOf(word: string): string;
export function renderGrammarSheet(): string;
export function allGrammarSentences(): string[]; // every sentence text, for the audio script
```

- [ ] Step 1: Write the failing tests in `englishGrammar.test.ts`:

```ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  GRAMMAR_UNITS, grammarUnit, offeredGrammar, pluralOf, renderGrammarSheet, unitSentences, withArticle,
} from '../englishGrammar.ts';
import { hubLessonsForGrade } from '../englishHub.ts';
import { wordPicture } from '../englishPictures.ts';

const G1 = hubLessonsForGrade(1);
const order = new Map(G1.map((l, i) => [l.id, i]));

test('every grammar unit is a Grade 1 lesson, and not Semester 1 Unit 0', () => {
  for (const u of GRAMMAR_UNITS) {
    assert.ok(order.has(u.lessonId), u.lessonId);
    assert.ok(!u.lessonId.endsWith('-s1-nccd-u0_l1'), u.lessonId);
  }
  assert.equal(GRAMMAR_UNITS.length, 9);
});

test('a slot names only words of its own lesson or an earlier Grade 1 lesson', () => {
  for (const u of GRAMMAR_UNITS) {
    const allowed = new Set(G1.slice(0, order.get(u.lessonId)! + 1).flatMap(l => l.words.map(w => w.en)));
    for (const [slot, words] of Object.entries(u.slots)) {
      for (const w of words) assert.ok(allowed.has(w), `${u.lessonId} ${slot}: ${w}`);
    }
  }
});

test('a/an and plurals', () => {
  assert.equal(withArticle('eraser'), 'an eraser');
  assert.equal(withArticle('pen'), 'a pen');
  assert.equal(withArticle('T-shirt'), 'a T-shirt');
  assert.equal(withArticle('boots'), 'boots');
  assert.equal(pluralOf('frog'), 'frogs');
  assert.equal(pluralOf('pencil case'), 'pencil cases');
  assert.equal(pluralOf('apples'), 'apples');
});

test('every sentence re-joins from its tiles, and every Choose has one right option shown at its blank', () => {
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      assert.equal(s.tokens.join(' '), s.text, s.key);
      if (!s.choose) continue;
      assert.notEqual(s.choose.right, s.choose.wrong, s.key);
      const blanked = s.tokens.slice(s.choose.start, s.choose.start + s.choose.length).join(' ').replace(/[.?!,]+$/, '');
      assert.equal(blanked, s.choose.right, s.key);
    }
  }
});

test('the pictures a sentence uses all exist, and a false picture is another word', () => {
  for (const u of GRAMMAR_UNITS) {
    for (const s of unitSentences(u)) {
      if (s.picture) assert.ok(wordPicture(s.picture.word), s.key);
      if (s.falsePicture) {
        assert.ok(wordPicture(s.falsePicture), s.key);
        assert.notEqual(s.falsePicture, s.picture?.word, s.key);
      }
      // A slot or whole choice is decided by the picture, so it must have one.
      if (s.choose && s.choose.kind !== 'phrase') assert.ok(s.picture, `${s.key}: a ${s.choose.kind} choice with no picture`);
    }
  }
});

test('the sentences the book uses as its own examples come out word for word', () => {
  const texts = new Set(GRAMMAR_UNITS.flatMap(u => unitSentences(u).map(s => s.text)));
  for (const t of [
    "I've got a pen.", "I haven't got an eraser.", 'The book is on the chair.', 'The pens are on the floor.',
    "What are these? They're tigers.", 'I like cakes.', "I don't like lemons.", "He's got two arms.",
    "Who's this? This is my mum.", "I'm wearing boots.", "Where's my jacket? It's on the chair.",
  ]) assert.ok(texts.has(t), t);
  for (const bad of ["I'm wearing a boots.", "Where's my boots? It's on the chair.", "Who's this? This is my cat."]) {
    assert.ok(!texts.has(bad), bad);
  }
});

test('an unreviewed unit is offered to nobody', () => {
  for (const u of GRAMMAR_UNITS) {
    assert.equal(offeredGrammar(u.lessonId), u.reviewedBy ? unitSentences(u) : null);
  }
  assert.equal(offeredGrammar('kbl-g1-eng-s1-nccd-u0_l1'), null);
  assert.equal(grammarUnit('nope'), undefined);
});

test("the committed teacher's sheet is exactly what the generator produces", () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const committed = readFileSync(path.join(here, '..', '..', '..', '..', 'docs', 'english-grammar-g1-sheet.md'), 'utf8');
  assert.equal(committed, renderGrammarSheet());
});
```

- [ ] Step 2: Run `cd lib/curriculum && node --experimental-strip-types --test src/__tests__/englishGrammar.test.ts` — expected FAIL (module not found).
- [ ] Step 3: Implement `englishGrammar.ts` — the realiser, the data for the nine units in the spec's table (Semester 2 Unit 0 per the deviation above), the gate and the sheet renderer. Realisation: split the template on `{…}`; literal text is split on spaces into tokens, a leading punctuation run attaches to the previous token; a slot fill is one token for the word (plus a separate `a`/`an` token for `{a:…}`). Choose: `phrase` blanks the token run equal to `right`; `slot` blanks the fill (article + word) and takes as `wrong` the fill of the next word of that slot that has a picture; `whole` blanks from the first token after a `?`-ending token to the end, and takes as `wrong` the same span of pattern `other` realised with the same words. `falsePicture` is the next word of the picture slot (cyclic) that has a picture. A pattern with markers `many` pictures the word twice.
- [ ] Step 4: Write `lib/curriculum/scripts/grammar-sheet.ts` (`writeFileSync(<repo>/docs/english-grammar-g1-sheet.md, renderGrammarSheet())`), add `"grammar-sheet": "node --experimental-strip-types scripts/grammar-sheet.ts"` to the curriculum `package.json` scripts, run it.
- [ ] Step 5: Run the test file — expected PASS. Run the whole curriculum suite.
- [ ] Step 6: Commit `feat(curriculum): Grade 1 grammar sentences from the book's patterns, and the teacher's sheet`.

### Task 3: Round builders in the hub's game logic

**Files:**
- Modify: `artifacts/mobile/services/englishHub/games.ts`
- Test: `artifacts/mobile/services/__tests__/englishGrammarGames.test.ts`

**Interfaces:**
- Consumes: `GrammarSentence`, `unitSentences`, `GRAMMAR_UNITS` (Task 2).
- Produces:

```ts
export type HubActivity = …existing… | 'grammar-choose' | 'grammar-build' | 'grammar-true';
export const GRAMMAR_ACTIVITIES: HubActivity[]; // ['grammar-choose', 'grammar-build', 'grammar-true']
export const MAX_BUILD_TILES = 7;
export interface ChooseQuestion { sentence: GrammarSentence; options: string[]; answerIndex: number }
export function buildChooseRound(s: readonly GrammarSentence[], rng?): ChooseQuestion[];
export interface BuildQuestion { sentence: GrammarSentence; tiles: { id: number; text: string }[] }
export function buildSentenceRound(s: readonly GrammarSentence[], rng?): BuildQuestion[];
export function isSentenceBuilt(tiles: readonly { text: string }[], sentence: GrammarSentence): boolean;
export interface TrueFalseQuestion { sentence: GrammarSentence; pictureWord: string; isTrue: boolean }
export function buildTrueFalseRound(s: readonly GrammarSentence[], rng?): TrueFalseQuestion[];
export function grammarActivityAvailable(a: HubActivity, s: readonly GrammarSentence[]): boolean; // ≥ 4 usable sentences
```
`SCORED_ACTIVITIES` gains the three, so `lessonStars` counts them.

- [ ] Step 1: Failing tests (`englishGrammarGames.test.ts`), over every unit's `unitSentences` (unreviewed units included — the builders do not gate):
  - Choose: every question has 2 distinct options, `options[answerIndex] === sentence.choose.right`, only sentences with `choose` are drawn, round ≤ 8.
  - Build: tiles are a permutation of `sentence.tokens`, never already in order when ≥ 2 tiles, never more than 7 tiles, `isSentenceBuilt` true for the token order and false for a swap.
  - True or false: `isTrue` questions picture the sentence's own word, false ones its `falsePicture`; a round of 8 holds both kinds; only sentences with a picture and a false picture are drawn.
  - `grammarActivityAvailable` is false for an empty list; `lessonStars` counts a `grammar-choose` result.
  - Reproducible for a seed.
- [ ] Step 2: Run — expected FAIL.
- [ ] Step 3: Implement. True or false: shuffle the usable sentences, take 8, mark the first half (rounded up) true, then shuffle the questions. Build reuses the "never already solved" retry used by `shuffledLetters`, generalised to tiles.
- [ ] Step 4: Run — PASS; run `englishHubGames.test.ts` too.
- [ ] Step 5: Commit `feat(english-hub): grammar round builders`.

### Task 4: The three activities on the lesson screen

**Files:**
- Create: `artifacts/mobile/components/englishHub/GrammarActivities.tsx` (`GrammarChoose`, `BuildSentence`, `TrueFalse`, `GrammarPicture`)
- Modify: `artifacts/mobile/components/englishHub/Activities.tsx` (export `HearButton`, `Progress`, `RIGHT`, `WRONG`)
- Modify: `artifacts/mobile/app/curriculum/english/[lessonId].tsx` (META entries, «القواعد» heading and cards, routing, finish text)
- Modify: `artifacts/mobile/services/i18n.ts` (ar + en keys)

**Interfaces:**
- Consumes: Task 3 builders; `offeredGrammar(lesson.id)`; `playWord(text)` speaks a sentence (its recording, or the browser's voice on web).

- [ ] Step 1: i18n keys, both languages: `hubGrammar` («القواعد» / "Grammar"), `hubGChoose` («اختر الكلمة» / "Choose the word"), `hubGChooseDesc` («اختر ما يكمل الجملة» / "Pick what completes the sentence"), `hubGBuild` («رتّب الجملة» / "Build the sentence"), `hubGBuildDesc` («رتّب الكلمات لتكوين جملة» / "Put the words in order"), `hubGTrue` («صح أم خطأ» / "True or false"), `hubGTrueDesc` («هل تطابق الجملة الصورة؟» / "Does the sentence match the picture?").
- [ ] Step 2: Components. `GrammarPicture` shows the emoji (twice for `count: 2`) and a marker badge (✅ yes, ❌ no, 👦 boy, 👧 girl). `GrammarChoose`: picture, the gapped sentence (hidden for `kind: 'whole'`), two option buttons, feedback + 🔊 of the full sentence after answering, Next. `BuildSentence`: slots + tray, tap to place / tap to return, Check, 🔊 the sentence after checking. `TrueFalse`: picture of `pictureWord` with the marker, the sentence, ✓ and ✗ buttons. All English text `writingDirection: 'ltr'`. Each calls `onFinish(correct, total)`.
- [ ] Step 3: Lesson screen: `const grammar = offeredGrammar(lesson.id)`; when non-null, render a «القواعد» heading and one card per `GRAMMAR_ACTIVITIES` entry for which `grammarActivityAvailable` is true; route the three activities to their components.
- [ ] Step 4: `pnpm run typecheck` clean.
- [ ] Step 5: Browser check: build web with a unit temporarily signed off **locally only** (`reviewedBy` set in the working tree, never committed), screenshot the three activities at 390 px in Arabic and English, then revert.
- [ ] Step 6: Commit `feat(english-hub): grammar activities on the lesson screen (hidden until a unit is reviewed)`.

### Task 5: Audio, docs, full verification

**Files:**
- Modify: `lib/curriculum/scripts/generate-english-audio.ts` (voice `allGrammarSentences()` too, young register)
- Modify: `STATUS.md` (new section; English-corner line)

- [ ] Step 1: In the audio script, add the grammar sentences to `bySlug` alongside `allHubWords()`, and to `YOUNG_WORDS` (Grade 1 sentences take the young register). `--dry-run` must list them.
- [ ] Step 2: STATUS.md: what exists, that every unit is `reviewedBy: null`, the sign-off checklist (voice the unit's sentences → teacher reads the sheet → set `reviewedBy`), and the Semester 2 Unit 0 deviation.
- [ ] Step 3: `pnpm run typecheck`; full `artifacts/mobile` and `lib/curriculum` suites.
- [ ] Step 4: Commit, push, update PR #1088's description.
