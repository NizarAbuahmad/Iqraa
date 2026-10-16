# New worksheet formats (صِل، رتّب، أين الخطأ؟، ارسم): implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use subagent-driven-development (recommended) or executing-plans to work through this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four new worksheet question formats. Each is built only from the bank, prints and projects in its own layout, and converts to an auto-marked (or teacher-marked) question when sent to a class.

**Architecture:**
- **Bank side.** `lib/math-practice` gains `missteps.ts` (hand-written errors) and `formatsBank.ts`, which picks bank items for each format.
- **App side.** The mobile `services/ai/worksheetFormats.ts` turns those picks into `WorksheetQuestion`s carrying a structured `format`, plus their answer-key entries.
- **Who calls it.** The offline generator calls the builder directly. The live path strips the format types from the request and appends the builder's questions to the model's result.
- **Downstream.** Print, slides, the deck and the class converter read `format`. Everything else keeps reading `text`.

**Tech stack:**
- TypeScript, pnpm monorepo, `node --test`.
- Expo / React Native: `artifacts/mobile`.
- Express API: `artifacts/api-server`.

**Spec:** `docs/superpowers/specs/2026-10-11-worksheet-formats-design.md`

## Global constraints

- **Bank only.** The model is never asked for a format; a test asserts the format kinds never reach the prompt text.
- **Counts.** A format question counts INSIDE the teacher's total (`numQuestions`), the same as the worked example.
- **Maths notation.** Stored in latin `x`; converted to «س» / Arabic digits only at display time.
- **Arabic copy.** Use «ًا», never «اً» (the i18n terminology test).
- **Design scale** for any new React Native style. `designScale.test` enforces it:
  - spacing: 2, 4, 8, 12, 16, 20, 24, 32, 40, 48
  - font size: 11, 13, 14, 15, 17, 20, 24, 28, 32
  - radius: 4, 8, 12, 16, 24, 999
- **Test locations.**
  - Mobile tests must live in `artifacts/mobile/services/__tests__/`.
  - API tests go in `artifacts/api-server/src/**/__tests__/`.
  - `lib/math-practice` tests go in `lib/math-practice/src/__tests__/`.
- **Imports.** Use an explicit `.ts` extension on every relative import in a file loaded by `node --test`.
- **Picker order is persisted state.** The new `QType`s are **appended** to `ALL_Q_TYPES`, never inserted.
- **No schema change, no migration.** Evaluation types stay `matching` / `multiple_choice` / `short_answer`.
- **Commits** end with:

  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01EyHmbQd9t5zG1fSHiTV7d2
  ```

**Spec refinement made here:** every `format` variant carries a `stem` (the instruction plus the problem, without the inlined lines). Print and slides then show the stem above the structured block instead of re-parsing `text`.

---

### Task 1: Hand-written missteps

**Files:**
- Create: `lib/math-practice/src/missteps.ts`
- Modify: `lib/math-practice/src/index.ts` (export)
- Test: `lib/math-practice/src/__tests__/missteps.test.ts`

**Interfaces:**
- Produces:
  - `export interface Misstep { itemId: string; stepIndex: number; wrongAr: string; wrongEn: string; whyAr: string; whyEn: string }`
  - `export const MISSTEPS: readonly Misstep[]`
  - `export function misstepsFor(itemId: string): Misstep[]`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MISSTEPS, misstepsFor } from '../missteps.ts';
import { stepsFor } from '../steps.ts';
import { MATH_BANK } from '../index.ts';

describe('missteps', () => {
  it('every entry names a solved item, a step that is not the last, and a line that differs', () => {
    for (const m of MISSTEPS) {
      const steps = stepsFor(m.itemId);
      assert.ok(steps, `${m.itemId} has no working`);
      assert.ok(m.stepIndex >= 0 && m.stepIndex < steps!.ar.length - 1, `${m.itemId}: step ${m.stepIndex} is the last or out of range`);
      assert.notEqual(m.wrongAr.trim(), steps!.ar[m.stepIndex]!.trim(), `${m.itemId}: ar wrong line equals the real one`);
      assert.notEqual(m.wrongEn.trim(), steps!.en[m.stepIndex]!.trim(), `${m.itemId}: en wrong line equals the real one`);
      assert.ok(m.whyAr.length > 10 && m.whyEn.length > 10, `${m.itemId}: explain the mistake`);
      assert.ok(!/اً/.test(m.wrongAr + m.whyAr), `${m.itemId}: write «ًا», not «اً»`);
    }
  });

  it('covers every Grade-10 maths family that has working, at least once', () => {
    const solvedFamilies = new Set(MATH_BANK.filter(i => stepsFor(i.id)).map(i => i.family));
    const covered = new Set(MISSTEPS.map(m => MATH_BANK.find(i => i.id === m.itemId)?.family));
    for (const f of solvedFamilies) assert.ok(covered.has(f), `family ${f} has working but no misstep`);
  });

  it('looks entries up by item', () => {
    const first = MISSTEPS[0]!;
    assert.ok(misstepsFor(first.itemId).includes(first));
    assert.deepEqual(misstepsFor('no-such-item'), []);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lib/math-practice && node --test src/__tests__/missteps.test.ts`
Expected: FAIL, `Cannot find module '../missteps.ts'`.

- [ ] **Step 3: Write `missteps.ts`**

Use this skeleton and the two worked entries below. Then author the rest the same way. For each Grade-10 maths family with working, list its solved items with:

```
node -e "import('./src/index.ts').then(m=>{for(const i of m.MATH_BANK){const s=m.stepsFor(i.id);if(s)console.log(i.family,i.id,JSON.stringify(s.ar))}})" --experimental-strip-types
```

Pick two items per family. For each, write one realistic mistake in a middle step:

- **Mistake types:** a sign slip, a wrong exponent law, a dropped term, a wrong trig value, or a wrong rearrangement.
- **Line:** in the same notation as the original line.
- **Why:** a one-sentence explanation.

Never the last step.

```ts
/**
 * A deliberate, realistic mistake in one step of a bank item's working, for
 * «أين الخطأ؟». Hand-written: an automatic swap can produce another correct
 * line, and a mistake only teaches when it is the kind students make.
 * `stepIndex` is 0-based into `stepsFor(itemId)` and never the last line,
 * which states the result. `missteps.test.ts` checks every entry.
 */
export interface Misstep {
  itemId: string;
  stepIndex: number;
  wrongAr: string;
  wrongEn: string;
  whyAr: string;
  whyEn: string;
}

export const MISSTEPS: readonly Misstep[] = [
  // Two worked entries — copy their shape. Replace the ids and lines with ones
  // read from `stepsFor` (the command in the plan prints them).
];

const BY_ITEM = new Map<string, Misstep[]>();
for (const m of MISSTEPS) BY_ITEM.set(m.itemId, [...(BY_ITEM.get(m.itemId) ?? []), m]);

export function misstepsFor(itemId: string): Misstep[] {
  return BY_ITEM.get(itemId) ?? [];
}
```

Each authored entry has this shape. The text below is illustrative; take the real line from `stepsFor`:

```ts
  {
    itemId: 'e-e1',           // an exp_eq item whose step 2 reads e.g. «3^(x+1) = 3^4»
    stepIndex: 1,
    wrongAr: 'x + 1 = 3',
    wrongEn: 'x + 1 = 3',
    whyAr: 'عند تساوي الأساسين نُساوي الأسس: الأس في الطرف الأيمن ٤ وليس ٣.',
    whyEn: 'With equal bases the exponents are equal: the right-hand exponent is 4, not 3.',
  },
```

Export it from `index.ts`, next to the `steps.ts` export:

```ts
export { MISSTEPS, misstepsFor } from './missteps.ts';
export type { Misstep } from './missteps.ts';
```

- [ ] **Step 4: Run the test until it passes**

Run: `cd lib/math-practice && node --test src/__tests__/missteps.test.ts`
Expected: PASS (3 tests). The coverage test lists any family still missing; add entries until it passes.

- [ ] **Step 5: Commit**

```bash
git add lib/math-practice/src/missteps.ts lib/math-practice/src/index.ts lib/math-practice/src/__tests__/missteps.test.ts
git commit -m "feat(bank): hand-written missteps for «أين الخطأ؟»"
```

---

### Task 2: Bank pickers for the four formats

**Files:**
- Create: `lib/math-practice/src/formatsBank.ts`
- Modify: `lib/math-practice/src/index.ts` (export; also export `itemStem` if it isn't exported)
- Test: `lib/math-practice/src/__tests__/formatsBank.test.ts`

**Interfaces:**
- Consumes: `MATH_BANK`, `CHEM_BANK`, `matchMathFamily`, `detectChemFamily`, `lessonTextBlob`, `stepsFor`, `misstepsFor`, `itemStem` (`index.ts`), `Lang`, `KBLesson`.
- Produces:
  - `export type FormatKind = 'match' | 'order' | 'spot_error' | 'graph'`
  - `export interface MatchPick { pairs: { problem: string; answer: string }[] }`
  - `export interface OrderPick { problem: string; steps: string[]; answer: string }`
  - `export interface SpotErrorPick { problem: string; steps: string[]; wrongStep: number; correctLine: string; why: string; answer: string }`
  - `export interface GraphPick { problem: string; exprs: string[]; answer: string; window: { xMin: number; xMax: number; yMin: number; yMax: number } }`
  - `export function pickForFormat(kind: FormatKind, topic: string, kb: KBLesson | null, lang: Lang, session: Set<string>, subject?: string): MatchPick | OrderPick | SpotErrorPick | GraphPick | null`
  - `export function formatSupported(kind: FormatKind, topic: string, kb: KBLesson | null, subject?: string): boolean` (pure; marks nothing used)

Rules:

- **Family.** `familyFor` = `matchMathFamily` for maths, `detectChemFamily(lessonTextBlob)` for chemistry, chosen by `isChemContext(topic, kb)`.
- **Match:**
  - At least 4 unused items of the family with `answer.length <= 24` and distinct normalised answers.
  - Take up to 5 and mark them used.
  - The problem is `itemStem(item, lang==='ar')`.
- **Order:**
  - One unused item with working of 3–6 lines; mark it used.
  - Steps are the full working; the answer is `item.answer`.
- **Spot error:**
  - One unused **maths** item with at least one misstep; mark it used.
  - Build `steps` with `steps[m.stepIndex] = wrong{Ar|En}`.
  - Keep `correctLine` (the real line) and `why`.
- **Graph:**
  - One unused **maths** item with `kind === 'graph'`; mark it used.
  - `exprs = [eq, eq2].filter(Boolean)` with `y = ` stripped. Keep the original notation; the renderer normalises it.
  - The window is the answer's points (parsed from `(a ، b)`), expanded by 3 and rounded to integers.
  - Default window when none can be parsed: −5..5 × −5..5.
  - Window is clamped to −10..10.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { pickForFormat, formatSupported } from '../formatsBank.ts';
import { stepsFor } from '../steps.ts';

const EXP = 'المعادلات الأسية';          // a Grade-10 lesson whose family (exp_eq) has many solved items
const GRAPH = 'حل نظام معادلتين بيانيًا'; // routes to system_graph

describe('pickForFormat', () => {
  it('match: 4–5 distinct short answers, none reused', () => {
    const used = new Set<string>();
    const p = pickForFormat('match', EXP, null, 'ar', used) as any;
    assert.ok(p && p.pairs.length >= 4 && p.pairs.length <= 5);
    assert.equal(new Set(p.pairs.map((x: any) => x.answer)).size, p.pairs.length);
    assert.equal(used.size, p.pairs.length);
  });

  it('order: the steps are an item\'s real working, 3–6 lines', () => {
    const p = pickForFormat('order', EXP, null, 'ar', new Set()) as any;
    assert.ok(p && p.steps.length >= 3 && p.steps.length <= 6);
  });

  it('spot_error: exactly one step differs from the real working, and never the last', () => {
    const used = new Set<string>();
    const p = pickForFormat('spot_error', EXP, null, 'ar', used) as any;
    assert.ok(p);
    const real = stepsFor([...used][0]!)!.ar;
    const diffs = p.steps.map((s: string, i: number) => s !== real[i]).filter(Boolean).length;
    assert.equal(diffs, 1);
    assert.equal(p.steps[p.wrongStep] === real[p.wrongStep], false);
    assert.equal(p.correctLine, real[p.wrongStep]);
    assert.ok(p.wrongStep < p.steps.length - 1);
  });

  it('graph: equations and a window containing the answer points', () => {
    const p = pickForFormat('graph', GRAPH, null, 'ar', new Set()) as any;
    assert.ok(p && p.exprs.length >= 1 && !p.exprs[0].startsWith('y'));
    assert.ok(p.window.xMin < p.window.xMax && p.window.yMin < p.window.yMax);
  });

  it('returns null, and formatSupported says false, when the lesson cannot support it', () => {
    assert.equal(formatSupported('graph', EXP, null), false);
    assert.equal(pickForFormat('graph', EXP, null, 'ar', new Set()), null);
    assert.equal(formatSupported('spot_error', 'الروابط الكيميائية', null, 'Chemistry'), false);
  });

  it('formatSupported marks nothing used', () => {
    assert.equal(formatSupported('match', EXP, null), true);
    const used = new Set<string>();
    formatSupported('match', EXP, null);
    assert.equal(used.size, 0);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lib/math-practice && node --test src/__tests__/formatsBank.test.ts`
Expected: FAIL (module missing). If either lesson title does not route as the comment says, pick another title from `matchMathFamily`'s keyword table and update the constant. That is fixing a test fixture, not the rule under test.

- [ ] **Step 3: Implement `formatsBank.ts`**

```ts
/**
 * Bank items picked for the worksheet formats (صِل، رتّب، أين الخطأ؟، ارسم).
 * Same family routing and the same per-pass `session` set as every other
 * worksheet question, so a format never reuses an item the sheet already spent.
 * Bank only — nothing here is generated or guessed (spec 2026-10-11).
 */
import {
  MATH_BANK, CHEM_BANK, matchMathFamily, detectChemFamily, lessonTextBlob, isChemContext, itemStem,
  type ConcreteItem, type KBLesson, type Lang,
} from './index.ts';
import { stepsFor } from './steps.ts';
import { misstepsFor } from './missteps.ts';

export type FormatKind = 'match' | 'order' | 'spot_error' | 'graph';
export interface MatchPick { pairs: { problem: string; answer: string }[] }
export interface OrderPick { problem: string; steps: string[]; answer: string }
export interface SpotErrorPick { problem: string; steps: string[]; wrongStep: number; correctLine: string; why: string; answer: string }
export interface GraphPick {
  problem: string; exprs: string[]; answer: string;
  window: { xMin: number; xMax: number; yMin: number; yMax: number };
}

function pool(topic: string, kb: KBLesson | null, subject?: string): { items: ConcreteItem[]; maths: boolean } {
  if (isChemContext(topic, kb, subject)) {
    const fam = detectChemFamily(lessonTextBlob(topic, kb));
    return { items: CHEM_BANK.filter(i => i.family === fam), maths: false };
  }
  const fam = matchMathFamily(topic, kb);
  return { items: fam ? MATH_BANK.filter(i => i.family === fam) : [], maths: true };
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();
const shuffle = <T,>(xs: T[]): T[] => xs.map(x => [Math.random(), x] as const).sort((a, b) => a[0] - b[0]).map(p => p[1]);

function matchCandidates(items: ConcreteItem[], used: Set<string>): ConcreteItem[] {
  const seen = new Set<string>();
  return shuffle(items.filter(i => !used.has(i.id) && i.answer.length <= 24)).filter(i => {
    const k = norm(i.answer);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
const orderCandidates = (items: ConcreteItem[], used: Set<string>) =>
  items.filter(i => !used.has(i.id) && (stepsFor(i.id)?.ar.length ?? 0) >= 3 && (stepsFor(i.id)?.ar.length ?? 0) <= 6);
const spotCandidates = (items: ConcreteItem[], used: Set<string>, maths: boolean) =>
  maths ? items.filter(i => !used.has(i.id) && stepsFor(i.id) && misstepsFor(i.id).length > 0) : [];
const graphCandidates = (items: ConcreteItem[], used: Set<string>, maths: boolean) =>
  maths ? items.filter(i => !used.has(i.id) && i.kind === 'graph') : [];

export function formatSupported(kind: FormatKind, topic: string, kb: KBLesson | null, subject?: string): boolean {
  const { items, maths } = pool(topic, kb, subject);
  const none = new Set<string>();
  if (kind === 'match') return matchCandidates(items, none).length >= 4;
  if (kind === 'order') return orderCandidates(items, none).length > 0;
  if (kind === 'spot_error') return spotCandidates(items, none, maths).length > 0;
  return graphCandidates(items, none, maths).length > 0;
}

function windowFor(answer: string): GraphPick['window'] {
  const pts = [...answer.matchAll(/\(\s*([-−]?\d+(?:\.\d+)?)\s*[،,]\s*([-−]?\d+(?:\.\d+)?)\s*\)/g)]
    .map(m => [Number(m[1]!.replace('−', '-')), Number(m[2]!.replace('−', '-'))] as const);
  if (pts.length === 0) return { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
  const clamp = (v: number) => Math.max(-10, Math.min(10, v));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  return {
    xMin: clamp(Math.floor(Math.min(...xs, 0) - 3)), xMax: clamp(Math.ceil(Math.max(...xs, 0) + 3)),
    yMin: clamp(Math.floor(Math.min(...ys, 0) - 3)), yMax: clamp(Math.ceil(Math.max(...ys, 0) + 3)),
  };
}

export function pickForFormat(
  kind: FormatKind, topic: string, kb: KBLesson | null, lang: Lang, session: Set<string>, subject?: string,
): MatchPick | OrderPick | SpotErrorPick | GraphPick | null {
  const { items, maths } = pool(topic, kb, subject);
  const ar = lang === 'ar';
  if (kind === 'match') {
    const c = matchCandidates(items, session);
    if (c.length < 4) return null;
    const take = c.slice(0, 5);
    take.forEach(i => session.add(i.id));
    return { pairs: take.map(i => ({ problem: itemStem(i, ar), answer: i.answer })) };
  }
  if (kind === 'order') {
    const c = shuffle(orderCandidates(items, session))[0];
    if (!c) return null;
    session.add(c.id);
    return { problem: itemStem(c, ar), steps: [...stepsFor(c.id)![lang]], answer: c.answer };
  }
  if (kind === 'spot_error') {
    const c = shuffle(spotCandidates(items, session, maths))[0];
    if (!c) return null;
    session.add(c.id);
    const m = shuffle(misstepsFor(c.id))[0]!;
    const real = [...stepsFor(c.id)![lang]];
    const steps = real.map((s, i) => (i === m.stepIndex ? (ar ? m.wrongAr : m.wrongEn) : s));
    return { problem: itemStem(c, ar), steps, wrongStep: m.stepIndex, correctLine: real[m.stepIndex]!, why: ar ? m.whyAr : m.whyEn, answer: c.answer };
  }
  const c = shuffle(graphCandidates(items, session, maths))[0];
  if (!c) return null;
  session.add(c.id);
  const exprs = [c.eq, c.eq2].filter((e): e is string => !!e).map(e => e.replace(/^\s*y\s*=\s*/, ''));
  return { problem: itemStem(c, ar), exprs, answer: c.answer, window: windowFor(c.answer) };
}
```

If `itemStem` or `isChemContext` isn't exported from `index.ts`, export it there (they are already used by `formatItem` / `takeSolvedFromBank`). Add to `index.ts`:

```ts
export { pickForFormat, formatSupported } from './formatsBank.ts';
export type { FormatKind, MatchPick, OrderPick, SpotErrorPick, GraphPick } from './formatsBank.ts';
```

If the re-export creates an import cycle that `node --test` rejects, export from `formatsBank.ts` only and import it by path in consumers.

- [ ] **Step 4: Run the tests until they pass**

Run: `cd lib/math-practice && node --test src/__tests__/*.test.ts`
Expected: all PASS, including the existing `steps.test.ts`.

- [ ] **Step 5: Commit**

```bash
git add lib/math-practice/src/formatsBank.ts lib/math-practice/src/index.ts lib/math-practice/src/__tests__/formatsBank.test.ts
git commit -m "feat(bank): pick bank items for the four worksheet formats"
```

---

### Task 3: The `format` field and the question builder

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (`WorksheetQuestion` ~239, `WorksheetSection` ~218, `WorksheetOutput` ~198)
- Create: `artifacts/mobile/services/ai/worksheetFormats.ts`
- Test: `artifacts/mobile/services/__tests__/worksheetFormats.test.ts`

**Interfaces:**
- Consumes: `pickForFormat`, `formatSupported`, `FormatKind` (Task 2).
- Produces:
  - `WorksheetQuestionFormat` (the union below, exported from `AIService.ts`)
  - `WorksheetQuestion.format?: WorksheetQuestionFormat`
  - `WorksheetSection.type` extended with `'match' | 'order' | 'spot_error' | 'graph'`
  - `WorksheetOutput.missingFormats?: FormatKind[]`
  - `export const FORMAT_KINDS: readonly FormatKind[]`
  - `export function isFormatKind(t: string): t is FormatKind`
  - `export function buildFormatQuestion(kind, ctx: { topic: string; kb: KBLesson | null; lang: 'ar' | 'en'; subject?: string; session?: Set<string>; points: number }): { section: WorksheetSection; key: { answer: string; solution?: string[] } } | null`
  - `export function formatAvailability(topic, kb, subject?): Record<FormatKind, boolean>`
  - `export function formatSectionTitle(kind, lang): string`

```ts
// AIService.ts — beside WorksheetQuestion
export type WorksheetQuestionFormat =
  | { kind: 'match'; stem: string; left: string[]; right: string[]; pairs: number[] }
  | { kind: 'order'; stem: string; steps: string[]; order: number[] }
  | { kind: 'spot_error'; stem: string; steps: string[]; wrongStep: number; fix: string; why: string }
  | { kind: 'graph'; stem: string; exprs: string[]; window: { xMin: number; xMax: number; yMin: number; yMax: number } };
// in WorksheetQuestion:
  /** A structured format (spec 2026-10-11). `text` is still the whole question in plain text. */
  format?: WorksheetQuestionFormat;
```

Builder rules, with exact strings:

- **match**
  - Stem: «صِل كل سؤال في العمود الأول بإجابته في العمود الثاني.» / "Match each problem with its answer."
  - `left` = the problems; `right` = the answers shuffled; `pairs[i]` = the index in `right` of left i's answer.
  - Text: stem, blank line, then «١) problem» lines, blank line, then «أ) answer» lines. Letters «أ ب ج د هـ» or "A B C D E".
  - Key answer: «١-ب، ٢-د، …» (Arabic) or "1-B, 2-D, …".
- **order**
  - Stem: «رتّب خطوات حل المسألة الآتية:» + `\n` + problem / "Put the steps of this solution in order:" + `\n` + problem.
  - `steps` = the first n−1 lines shuffled, then the last line appended (kept last). `order[k]` = the index in `steps` of the k-th true step.
  - Text: stem, then lettered steps.
  - Key answer: the letters in order. Solution: the true working.
- **spot_error**
  - Stem: «في الحل الآتي خطوة واحدة خاطئة. حدّدها واكتبها صحيحة.» + `\n` + problem / "One step in this solution is wrong. Find it and correct it." + `\n` + problem.
  - `fix` = the real line; `why` from the pick.
  - Text: stem, then «١) step» lines.
  - Key answer: «الخطوة ٣: <fix>» / "Step 3: <fix>". Solution: `[why, ...real working]`.
- **graph**
  - Stem: «ارسم في المستوى الإحداثي ثم أجب:» + `\n` + problem / "Draw on the grid, then answer:" + `\n` + problem.
  - Text: stem.
  - Key answer: the bank answer.
- **Every format**
  - The section is `{ type: kind, title: formatSectionTitle(kind, lang), questions: [question] }`.
  - The question has `fromBank: true`, `points`, `text` and `format`.
  - Numbers in the text stay latin; digits in labels may be Arabic, since they are labels, not maths.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildFormatQuestion, formatAvailability, FORMAT_KINDS, isFormatKind } from '../ai/worksheetFormats.ts';

const ctx = (topic: string) => ({ topic, kb: null, lang: 'ar' as const, points: 3, session: new Set<string>() });
const EXP = 'المعادلات الأسية';
const GRAPH = 'حل نظام معادلتين بيانيًا';

describe('buildFormatQuestion', () => {
  it('match: pairs map every left item to its own answer', () => {
    const r = buildFormatQuestion('match', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.equal(f.kind, 'match');
    assert.equal(f.left.length, f.right.length);
    assert.equal(new Set(f.pairs).size, f.pairs.length);
    assert.match(r.key.answer, /^١-/);
    assert.ok(r.section.questions[0]!.text.includes(f.left[0]));
  });

  it('order: following `order` recovers the working, and the last step stays last', () => {
    const r = buildFormatQuestion('order', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.deepEqual(f.order.map((i: number) => f.steps[i]), r.key.solution);
    assert.equal(f.order[f.order.length - 1], f.steps.length - 1);
  });

  it('spot_error: the wrong step is in the text, the fix is in the key', () => {
    const r = buildFormatQuestion('spot_error', ctx(EXP))!;
    const f = r.section.questions[0]!.format as any;
    assert.notEqual(f.steps[f.wrongStep], f.fix);
    assert.ok(r.key.answer.includes(f.fix));
    assert.equal(r.key.solution![0], f.why);
  });

  it('graph: equations and a window, no answer in the student text', () => {
    const r = buildFormatQuestion('graph', ctx(GRAPH))!;
    const q = r.section.questions[0]!;
    assert.equal((q.format as any).kind, 'graph');
    assert.ok(!q.text.includes(r.key.answer));
  });

  it('counts each format as one question, in its own titled section', () => {
    for (const k of ['match', 'order'] as const) {
      const r = buildFormatQuestion(k, ctx(EXP))!;
      assert.equal(r.section.questions.length, 1);
      assert.equal(r.section.type, k);
      assert.ok(r.section.title.length > 0);
    }
  });

  it('null when the lesson cannot support it; availability agrees', () => {
    assert.equal(buildFormatQuestion('graph', ctx(EXP)), null);
    assert.deepEqual(formatAvailability(EXP, null).graph, false);
    assert.equal(formatAvailability(EXP, null).match, true);
  });

  it('knows its kinds', () => {
    assert.deepEqual([...FORMAT_KINDS], ['match', 'order', 'spot_error', 'graph']);
    assert.ok(isFormatKind('match') && !isFormatKind('short_answer'));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --test services/__tests__/worksheetFormats.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement the type change and `worksheetFormats.ts`**

Follow the builder rules above exactly. Imports:

```ts
import { pickForFormat, formatSupported, type FormatKind } from '@workspace/math-practice';
import type { WorksheetSection, WorksheetQuestionFormat } from './AIService.ts';
import type { KBLesson } from '@workspace/math-practice';
```

Use the package path the other mobile services use for `lib/math-practice`; check `services/ai/generators.ts`' imports and copy them.

Labels: `const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩'`, `const AR_LETTERS = ['أ','ب','ج','د','هـ','و']`, `const EN_LETTERS = ['A','B','C','D','E','F']`. Numbers for item labels: `n => lang==='ar' ? String(n).replace(/\d/g, d => AR_DIGITS[+d]) : String(n)`.

Section titles:

| Kind | Arabic | English |
|---|---|---|
| match | «صِل» | "Match" |
| order | «رتّب الخطوات» | "Put in order" |
| spot_error | «أين الخطأ؟» | "Spot the mistake" |
| graph | «ارسم» | "Draw the graph" |

- [ ] **Step 4: Run it until it passes**

Run: `cd artifacts/mobile && node --test services/__tests__/worksheetFormats.test.ts && cd ../.. && pnpm run typecheck`
Expected: PASS and a clean typecheck. Adding a union member to `WorksheetSection.type` may need a `case` wherever it's switched on; typecheck shows where.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/ai/worksheetFormats.ts artifacts/mobile/services/__tests__/worksheetFormats.test.ts
git commit -m "feat(worksheet): structured format questions built from the bank"
```

---

### Task 4: Generator integration (offline and live) with an honest shortfall

**Files:**
- Modify: `artifacts/mobile/services/ai/generators.ts` (`worksheetOnce`, ~1168–1440)
- Modify: `artifacts/mobile/services/ai/RemoteAIService.ts` (`generateWorksheet`, ~112)
- Modify: `artifacts/api-server/src/lib/prompts.ts` (`worksheetPromptAr/En` — drop format kinds from the type list)
- Test: `artifacts/mobile/services/__tests__/worksheetFormatsGenerator.test.ts`
- Test: `artifacts/api-server/src/lib/__tests__/worksheetFormatPrompt.test.ts`

**Interfaces:**
- Consumes: `buildFormatQuestion`, `isFormatKind`, `FORMAT_KINDS` (Task 3).
- Produces:
  - `export function splitFormatTypes(types: string[]): { formats: FormatKind[]; rest: string[] }` (in `worksheetFormats.ts`)
  - `export function appendFormats(ws: WorksheetOutput, req: AIRequest, formats: FormatKind[]): WorksheetOutput` (in `worksheetFormats.ts`)
  - `export function requestWithoutFormats(req: AIRequest): AIRequest` (in `worksheetFormats.ts`)

Rules:

- **`requestWithoutFormats`**
  - Returns `req` with `questionTypes` minus format kinds.
  - `numQuestions` is reduced by the number of format kinds, floored at 5 (the picker minimum the server honours).
  - If no type is left, it uses `['short_answer']`.
- **`appendFormats`**
  - Builds each kind with a fresh `Set` session, seeded with nothing; the live paper's items are not bank-tracked.
  - Pushes each built section and its key entry, `num` = last num + 1.
  - Kinds that return `null` go into `missingFormats`.
- **Offline (`worksheetOnce`)**
  - Split the types first: `mainTypes` excludes format kinds.
  - Reserve `formats.length` inside `mainTotal`: `mainTotal = totalQ − reserved − wordProblem − formats.length`, floored at 0.
  - After the word problem, call `buildFormatQuestion` with the same session as the rest of the paper (the module session: `beginMathPracticeSession()` has run; pass `undefined`) and points `saPts(band[1])`.
  - Push the section and key; collect `missingFormats`.
  - Return `missingFormats` when non-empty.
- **Live (`RemoteAIService.generateWorksheet`)**
  - Send `requestWithoutFormats(req)` to `/generate/worksheet`.
  - On success return `appendFormats(result, req, formats)`.
  - The fallback still calls `this.fallback.generateWorksheet(req)` with the **original** `req`, which adds formats itself.

- [ ] **Step 1: Write the failing tests**

```ts
// services/__tests__/worksheetFormatsGenerator.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MockAIService } from '../ai/MockAIService.ts';
import { requestWithoutFormats, appendFormats } from '../ai/worksheetFormats.ts';

const base = { topic: 'المعادلات الأسية', language: 'arabic', subject: 'الرياضيات', numQuestions: 8 } as any;

describe('worksheet formats in the generator', () => {
  it('offline: each ticked format is one question, inside the total', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, questionTypes: ['short_answer', 'match', 'order'] });
    const all = ws.sections.flatMap(s => s.questions);
    const total = all.length + (ws.workedExample ? 1 : 0);
    assert.equal(total, 8);
    assert.equal(all.filter(q => q.format?.kind === 'match').length, 1);
    assert.equal(all.filter(q => q.format?.kind === 'order').length, 1);
    assert.equal(ws.answerKey.length, all.length);
  });

  it('offline: an unsupported format is reported, not invented', async () => {
    const ws = await new MockAIService().generateWorksheet({ ...base, questionTypes: ['short_answer', 'graph'] });
    assert.ok(!ws.sections.some(s => s.type === 'graph'));
    assert.deepEqual(ws.missingFormats, ['graph']);
  });

  it('live: the model is asked for neither the format types nor their count', () => {
    const r = requestWithoutFormats({ ...base, questionTypes: ['multiple_choice', 'match', 'spot_error'] });
    assert.deepEqual(r.questionTypes, ['multiple_choice']);
    assert.equal(r.numQuestions, 6);
  });

  it('live: formats are appended after the model\'s questions, numbered on', () => {
    const live = { title: 't', instructions: '', sections: [{ type: 'short_answer', title: 'x', questions: [{ text: 'q', points: 1 }] }], answerKey: [{ num: 1, answer: 'a' }] } as any;
    const out = appendFormats(live, { ...base }, ['match']);
    assert.equal(out.sections.length, 2);
    assert.deepEqual(out.answerKey.map((k: any) => k.num), [1, 2]);
  });
});
```

```ts
// api-server/src/lib/__tests__/worksheetFormatPrompt.test.ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { worksheetPromptAr, worksheetPromptEn } from '../prompts.ts';

describe('worksheet prompt and formats', () => {
  it('never asks the model for a bank-only format', () => {
    const body = { topic: 'المعادلات الأسية', numQuestions: 8, questionTypes: ['short_answer', 'match', 'order', 'spot_error', 'graph'] } as any;
    for (const p of [worksheetPromptAr(body), worksheetPromptEn(body)]) {
      for (const k of ['match', 'order', 'spot_error', 'graph']) assert.ok(!p.includes(k), `${k} leaked into the prompt`);
    }
  });
});
```

Check the real argument shape of `worksheetPromptAr` at `prompts.ts:364` and match the test's call to it.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd artifacts/mobile && node --test services/__tests__/worksheetFormatsGenerator.test.ts`
Expected: FAIL (`requestWithoutFormats` missing; offline totals wrong).

Run: `cd artifacts/api-server && node --test src/lib/__tests__/worksheetFormatPrompt.test.ts`
Expected: FAIL (`match` appears in the prompt).

- [ ] **Step 3: Implement**

- **`prompts.ts`.** At the top of both `worksheetPromptAr` and `worksheetPromptEn`, filter `types` with `const BANK_ONLY = new Set(['match','order','spot_error','graph']); const types = (b.questionTypes ?? ['short_answer']).filter(t => !BANK_ONLY.has(t)); if (types.length === 0) types.push('short_answer');`. Comment it: the bank builds these, see `worksheetFormats.ts`.
- **`worksheetFormats.ts`.** Add `splitFormatTypes`, `requestWithoutFormats` and `appendFormats` per the rules above.
- **`generators.ts`.**
  - After `selectedTypes`, do `const { formats, rest } = splitFormatTypes(selectedTypes)`.
  - Base `wantsWordProblem` and `mainTypes` on `rest`.
  - Subtract `formats.length` in `mainTotal`.
  - After the word-problem block (inside the `try`), loop over `formats` calling `buildFormatQuestion`. Push the section and `answerKey.push({ num: qNum++, ...key })`; collect `missingFormats`.
  - Add `...(missingFormats.length ? { missingFormats } : {})` to the returned object.
- **`RemoteAIService.ts`.** Wrap the live call as above. Import from `./worksheetFormats.ts`.

- [ ] **Step 4: Run until passing, then run the suites**

Run: `cd artifacts/mobile && node --test services/__tests__/worksheetFormatsGenerator.test.ts && pnpm test`
Run: `cd artifacts/api-server && pnpm build && pnpm test`
Expected: all PASS. Existing worksheet-count tests must still pass, because format types are absent from their requests.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/ai/generators.ts artifacts/mobile/services/ai/RemoteAIService.ts artifacts/mobile/services/ai/worksheetFormats.ts artifacts/mobile/services/__tests__/worksheetFormatsGenerator.test.ts artifacts/api-server/src/lib/prompts.ts artifacts/api-server/src/lib/__tests__/worksheetFormatPrompt.test.ts
git commit -m "feat(worksheet): formats count inside the total, offline and live, bank-only"
```

---

### Task 5: Worksheet screen ticks, greyed availability, missing-format note, edits

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/worksheet.tsx` (`QType` 77, `ALL_Q_TYPES` 86, labels ~572, `ShortPaperNotice` usage ~817)
- Modify: `artifacts/mobile/services/i18n.ts` (ar + en)
- Modify: `artifacts/mobile/services/worksheetEdits.ts` (`applyWorksheetQuestionEdit`)
- Test: `artifacts/mobile/services/__tests__/worksheetFormatEdits.test.ts`

**Interfaces:**
- Consumes: `formatAvailability`, `FORMAT_KINDS` (Task 3); `WorksheetOutput.missingFormats` (Task 4).
- Produces: i18n keys:
  - `typeMatch` «صِل» / "Match"
  - `typeOrder` «رتّب الخطوات» / "Put in order"
  - `typeSpotError` «أين الخطأ؟» / "Spot the mistake"
  - `typeGraph` «ارسم» / "Draw the graph"
  - `formatUnavailable` «غير متاح لهذا الدرس: لا توجد في البنك أسئلة كافية لهذا النوع.» / "Not available for this lesson: the bank has nothing to build it from."
  - `formatsMissing(names: string)` «لم تُضف الأنواع الآتية لأن البنك لا يكفي: {names}» / "Not added because the bank has too little for them: {names}"

Rules:

- **Ticks.**
  - `QType` and `ALL_Q_TYPES` are **appended** with `'match','order','spot_error','graph'`.
  - A tick whose kind `formatAvailability(topic, kb, subject)` reports false renders disabled at `opacity: 0.5`, and its `formatUnavailable` line shows under the list.
  - It is removed from the selection if it was selected.
  - `kb` and `topic` are the same ones the screen already grounds with.
- **The missing note.** When `result.missingFormats?.length`, show `formatsMissing` with the localised names under `ShortPaperNotice`.
- **Edits.** In `applyWorksheetQuestionEdit`, a patch with `text` also drops `format`. A points-only edit keeps it.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyWorksheetQuestionEdit } from '../worksheetEdits.ts';

const ws = {
  title: 't', instructions: '',
  sections: [{ type: 'match', title: 'صِل', questions: [{ text: 'صِل…', points: 3, format: { kind: 'match', stem: 's', left: ['a'], right: ['b'], pairs: [0] } }] }],
  answerKey: [{ num: 1, answer: '١-أ' }],
} as any;

describe('editing a formatted question', () => {
  it('rewording drops the format — the structure no longer matches the words', () => {
    const out = applyWorksheetQuestionEdit(ws, 0, 0, { text: 'سؤال جديد' });
    assert.equal(out.sections[0]!.questions[0]!.format, undefined);
  });
  it('changing points keeps it', () => {
    const out = applyWorksheetQuestionEdit(ws, 0, 0, { points: 5 });
    assert.equal(out.sections[0]!.questions[0]!.format?.kind, 'match');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --test services/__tests__/worksheetFormatEdits.test.ts`
Expected: the first test fails.

- [ ] **Step 3: Implement**

`worksheetEdits.ts`, inside `applyWorksheetQuestionEdit`'s map:

```ts
? { ...('text' in patch ? withoutSolution(f) : f), question: { ...('text' in patch ? withoutFormat(f.question) : f.question), ...patch } }
```

with `const withoutFormat = ({ format: _f, ...q }: WorksheetQuestion): WorksheetQuestion => q;`.

Then do the screen and i18n changes as listed; styles must stay on the design scale.

- [ ] **Step 4: Run the checks**

Run: `cd artifacts/mobile && pnpm test && cd ../.. && pnpm run typecheck`
Expected: PASS. That includes `designScale.test` and the i18n terminology test.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/ai-tools/worksheet.tsx artifacts/mobile/services/i18n.ts artifacts/mobile/services/worksheetEdits.ts artifacts/mobile/services/__tests__/worksheetFormatEdits.test.ts
git commit -m "feat(worksheet): format ticks on the screen, greyed when the lesson cannot support them"
```

---

### Task 6: Print — per-format layout, graph grid, answer key

**Files:**
- Create: `artifacts/mobile/services/formatPrintHtml.ts` (pure HTML builders; keeps `exportHtml.ts` from growing further)
- Modify: `artifacts/mobile/services/exportHtml.ts` (`buildWorksheetHTML` question card ~621–640; key rows ~642; CSS)
- Test: `artifacts/mobile/services/__tests__/formatPrintHtml.test.ts`

**Interfaces:**
- Consumes: `WorksheetQuestionFormat` (Task 3); `samplePlot` (`deckVisuals.ts`); `esc` (`exportHtml.ts`). If `esc` isn't exported, export it.
- Produces:
  - `export function normalizePlotExpr(e: string): string` (`−`→`-`, `²`→`^2`, `³`→`^3`, `×`→`*`)
  - `export function gridSvg(window, opts: { isAr: boolean; exprs?: string[]; width?: number; height?: number }): string`
  - `export function formatBodyHTML(f: WorksheetQuestionFormat, isAr: boolean): string`
  - `export function formatKeyExtraHTML(f: WorksheetQuestionFormat, isAr: boolean): string` (the graph drawn on its grid; empty for other kinds)

Layout (classes added to the print CSS):

- **match:** `<table class="fmt-match">`. One row per item: the right cell is the number + problem + a `<span class="fmt-box"></span>`; the left cell is a letter + answer. Right-to-left on Arabic papers, from document `dir`.
- **order:** `<div class="fmt-order">` of `<div class="fmt-card"><span class="fmt-box"></span><b>أ)</b> step</div>`.
- **spot_error:** `<ol class="fmt-steps">` of the steps. Below it: «رقم الخطوة الخاطئة: <span class="exam-blank"></span>» and two `q-rule` lines labelled «التصحيح:».
- **graph:** `gridSvg(window, { isAr })`: a 1-unit grid in `#d0d5dd` 0.5px, axes 1.2px, integer tick labels in Arabic digits on Arabic papers, an `x`/`y` (or «س»/«ص») axis label. Then one `q-rule` line labelled «الإجابة:».
- **Card changes in `buildWorksheetHTML`:**
  - When `q.format` is set, the head shows `q.format.stem` (through `questionBodyHTML`) instead of `text`.
  - The body is `formatBodyHTML`; `room` is `''` (formats bring their own writing space).
- **Key:** after the answer and solution of a row whose question has `format.kind === 'graph'`, append `formatKeyExtraHTML` (the same grid with each expression drawn via `samplePlot(normalizePlotExpr(e), { from: xMin, to: xMax, steps: 120 })`, clipped to the window). Map key rows to questions by flat position, as `buildDeckFromWorksheet` does.
- **Print styles:**
  - Ink-saver: grid lines `#bbb`, no fills.
  - Large print: `.fmt-card` and `.fmt-match` font +2 steps; grid SVG width 100%.
  - Add both under the existing ink-saver and large-print CSS blocks.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatBodyHTML, gridSvg, normalizePlotExpr, formatKeyExtraHTML } from '../formatPrintHtml.ts';

describe('format print HTML', () => {
  it('normalises bank notation for the plotter', () => {
    assert.equal(normalizePlotExpr('x² − 4'), 'x^2 - 4');
    assert.equal(normalizePlotExpr('−x + 3'), '-x + 3');
  });
  it('match prints a two-column table with a box per row', () => {
    const h = formatBodyHTML({ kind: 'match', stem: 's', left: ['2^x = 8', '3^x = 9'], right: ['2', '3'], pairs: [1, 0] }, true);
    assert.match(h, /<table class="fmt-match"/);
    assert.equal((h.match(/fmt-box/g) ?? []).length, 2);
  });
  it('order prints lettered cards with a position box', () => {
    const h = formatBodyHTML({ kind: 'order', stem: 's', steps: ['a', 'b', 'c'], order: [1, 0, 2] }, true);
    assert.equal((h.match(/fmt-card/g) ?? []).length, 3);
    assert.match(h, /أ\)/);
  });
  it('spot_error prints numbered steps and a place for the step number', () => {
    const h = formatBodyHTML({ kind: 'spot_error', stem: 's', steps: ['a', 'b', 'c'], wrongStep: 1, fix: 'B', why: 'w' }, true);
    assert.match(h, /<ol class="fmt-steps"/);
    assert.match(h, /رقم الخطوة الخاطئة/);
    assert.ok(!h.includes('B'), 'the fix must not print on the student copy');
  });
  it('graph prints an empty grid on the paper and the drawn curve in the key', () => {
    const f = { kind: 'graph' as const, stem: 's', exprs: ['x² − 4'], window: { xMin: -4, xMax: 4, yMin: -5, yMax: 5 } };
    const paper = formatBodyHTML(f, true);
    assert.match(paper, /<svg/);
    assert.ok(!/<path|<polyline/.test(paper), 'no curve on the student copy');
    assert.match(formatKeyExtraHTML(f, true), /<polyline|<path/);
    assert.match(gridSvg(f.window, { isAr: true }), /٤/);
  });
});
```

Then add one integration assertion to the existing `services/__tests__/exportHtml.test.ts`, in a new `describe('worksheet formats')`. Build a worksheet with one `match` question and check that `buildWorksheetHTML` output contains `fmt-match` and no `q-lines` inside that card.

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --test services/__tests__/formatPrintHtml.test.ts`
Expected: FAIL (module missing).

- [ ] **Step 3: Implement** `formatPrintHtml.ts` and the `exportHtml.ts` changes as specified. Draw the curve as an SVG `<polyline>`, mapping domain to pixels with the window. Drop points outside `yMin..yMax`, splitting the polyline at gaps.

- [ ] **Step 4: Run the checks**

Run: `cd artifacts/mobile && pnpm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/formatPrintHtml.ts artifacts/mobile/services/exportHtml.ts artifacts/mobile/services/__tests__/formatPrintHtml.test.ts artifacts/mobile/services/__tests__/exportHtml.test.ts
git commit -m "feat(print): matching table, step cards, numbered working and graph grid on the worksheet"
```

---

### Task 7: Projector — slides export and the live deck

**Files:**
- Modify: `artifacts/mobile/services/exportHtml.ts` (`buildWorksheetSlidesHTML` ~1131: the section slides)
- Modify: `artifacts/mobile/services/classDeck.ts` (`buildDeckFromWorksheet` ~330)
- Test: `artifacts/mobile/services/__tests__/formatSlides.test.ts`

**Interfaces:**
- Consumes: `formatBodyHTML`, `formatKeyExtraHTML`, `normalizePlotExpr` (Task 6); `samplePlot`; `VisualBlock`.
- Produces: no new exports.

Rules:

- **Slides export (`buildWorksheetSlidesHTML`).** A formatted question in a section slide renders `stem` and `formatBodyHTML` (the same blocks as print), scaled by the slide CSS. The answer-key slide appends `formatKeyExtraHTML` for graph rows.
- **Live deck (`buildDeckFromWorksheet`).** A question with `format` becomes a `challenge` slide.
  - `content` is the stem plus the format's lines, laid out for a screen:
    - match: «١) left  ⟷  أ) right» lines (left as numbered, right as lettered, in two blocks);
    - order: lettered steps;
    - spot_error: numbered steps;
    - graph: the equations.
  - `answer` is the key answer.
  - For `graph`, also set `visual: { kind: 'plot', series: exprs.map(e => ({ label: e, points: samplePlot(normalizePlotExpr(e), { from: xMin, to: xMax, steps: 120 }) ?? [] })) }`, so the presenter draws the graph. The presenter already renders `visual` on reveal.
  - It must not shift the `outcomes[qNum-1]` numbering. One slide per question as today.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorksheetSlidesHTML } from '../exportHtml.ts';
import { buildDeckFromWorksheet } from '../classDeck.ts';

const ws = {
  title: 't', instructions: '',
  sections: [
    { type: 'match', title: 'صِل', questions: [{ text: 'x', points: 2, format: { kind: 'match', stem: 'صِل', left: ['2^x = 8', '3^x = 9'], right: ['2', '3'], pairs: [1, 0] } }] },
    { type: 'graph', title: 'ارسم', questions: [{ text: 'y', points: 2, format: { kind: 'graph', stem: 'ارسم', exprs: ['x + 1'], window: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 } } }] },
  ],
  answerKey: [{ num: 1, answer: '١-ب، ٢-أ' }, { num: 2, answer: '(1 ، 2)' }],
} as any;

describe('formats on the projector', () => {
  it('slides export draws the same blocks as print', () => {
    const h = buildWorksheetSlidesHTML(ws, 't', { subject: 's', grade: 'g' }, true);
    assert.match(h, /fmt-match/);
    assert.match(h, /<svg/);
  });
  it('live deck: one challenge slide per formatted question, the graph carries a plot', () => {
    const deck = buildDeckFromWorksheet(ws, 't', true);
    const qs = deck.slides.filter(s => s.type === 'challenge');
    assert.equal(qs.length, 2);
    assert.match(qs[0]!.content, /⟷/);
    assert.equal(qs[1]!.visual?.kind, 'plot');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd artifacts/mobile && node --test services/__tests__/formatSlides.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement** as specified.

- [ ] **Step 4: Run the checks**

Run: `cd artifacts/mobile && pnpm test && cd ../.. && pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/exportHtml.ts artifacts/mobile/services/classDeck.ts artifacts/mobile/services/__tests__/formatSlides.test.ts
git commit -m "feat(projector): worksheet formats on slides and in the live deck"
```

---

### Task 8: Sent to a class — payload, parser and converter

**Files:**
- Modify: `artifacts/mobile/services/worksheetAssignment.ts` (`worksheetSendPayload`, `WorksheetSendBody`)
- Modify: `artifacts/api-server/src/modules/assessment/worksheetRequest.ts` (`parseWorksheetRequest`)
- Modify: `artifacts/api-server/src/modules/assessment/fromWorksheet.ts` (`WorksheetInput`, `convertWorksheet`)
- Test: extend `artifacts/mobile/services/__tests__/worksheetAssignment.test.ts`
- Test: extend `artifacts/api-server/src/modules/assessment/__tests__/worksheetRequest.test.ts`
- Test: extend `artifacts/api-server/src/modules/assessment/__tests__/fromWorksheet.test.ts`

**Interfaces:**
- Consumes: `WorksheetQuestionFormat`. The API gets its own copy of the type in `fromWorksheet.ts`; the two packages share no types.
- Produces: `WorksheetInput.sections[].questions[].format?: WorksheetFormatInput` (the same union as `WorksheetQuestionFormat`).

Conversion (checked before the existing rules; a format that fails validation falls through to them):

- **match** → `matching`
  - Body: `{ left: left.map((t,i)=>({id:`l${i}`,text:t})), right: right.map((t,j)=>({id:`r${j}`,text:t})) }`.
  - Key: `{ pairs: pairs.map((j,i)=>({left:`l${i}`,right:`r${j}`})) }`.
  - Valid when `left.length === pairs.length >= 2`, `right.length >= 2` and every `pairs[i]` is in range.
- **order** → `matching`
  - Body: `left` = the steps (`s${i}`); `right` = the positions «الأولى، الثانية، الثالثة، الرابعة، الخامسة، السادسة» (or "1st", "2nd", … in English), `p${k}`.
  - Key: `{ pairs: order.map((stepIdx,k)=>({left:`s${stepIdx}`,right:`p${k}`})) }`.
  - Valid when `order` is a permutation of `0..steps.length-1` and `2 <= steps.length <= 6`.
  - The stem says «طابق كل خطوة بترتيبها في الحل.» before the problem.
- **spot_error** → `multiple_choice`
  - Stem: `stem + '\n' + steps.map((s,i)=>`${i+1}) ${s}`).join('\n')`.
  - Options: «الخطوة ١ … ن» (ids `a…`).
  - Key: `{ optionIds: [OPTION_IDS[wrongStep]] }`.
  - Valid when `3 <= steps.length <= 10` and `wrongStep` is in range.
- **graph** → `short_answer`
  - Prompt: `stem + '\n' + exprs.map(e=>`y = ${e}`).join('\n')`.
  - Model answer: the key answer; `keyConcepts: [answer]`.

`autoMarked` counts match, order and spot_error. Every converted question must pass `QUESTION_TYPES[type].validate`.

`parseWorksheetRequest`:
- Rebuilds `format` field by field: `kind` must be one of the four, arrays of strings, integers in range.
- Anything malformed drops `format` (it does not reject the request), so the text rules still apply.
- Caps: `left`/`right`/`steps` ≤ 10 items, each ≤ 300 chars.

`worksheetSendPayload` copies `format` through unchanged.

- [ ] **Step 1: Write the failing tests**

Append to `fromWorksheet.test.ts`, using the file's existing `one()` and `only()` helpers:

```ts
describe('formats', () => {
  it('match → matching, auto-marked, pairs by id', () => {
    const q = only(one({ text: 'x', points: 3, format: { kind: 'match', stem: 'صِل', left: ['2^x = 8', '3^x = 9'], right: ['2', '3'], pairs: [1, 0] } } as any, '١-ب، ٢-أ'));
    assert.equal(q.type, 'matching');
    assert.deepEqual(q.expectedAnswer, { pairs: [{ left: 'l0', right: 'r1' }, { left: 'l1', right: 'r0' }] });
  });
  it('order → matching against positions', () => {
    const q = only(one({ text: 'x', points: 2, format: { kind: 'order', stem: 'رتّب', steps: ['b', 'a', 'c'], order: [1, 0, 2] } } as any, 'ب، أ، ج'));
    assert.equal(q.type, 'matching');
    assert.deepEqual((q.expectedAnswer as any).pairs[0], { left: 's1', right: 'p0' });
  });
  it('spot_error → multiple choice over step numbers', () => {
    const q = only(one({ text: 'x', points: 2, format: { kind: 'spot_error', stem: 'أين الخطأ؟', steps: ['a', 'b', 'c'], wrongStep: 1, fix: 'B', why: 'w' } } as any, 'الخطوة ٢: B'));
    assert.equal(q.type, 'multiple_choice');
    assert.deepEqual(q.expectedAnswer, { optionIds: ['b'] });
  });
  it('graph → teacher-marked short answer', () => {
    const q = only(one({ text: 'x', points: 2, format: { kind: 'graph', stem: 'ارسم', exprs: ['x + 1'], window: { xMin: -3, xMax: 3, yMin: -3, yMax: 3 } } } as any, '(1 ، 2)'));
    assert.equal(q.type, 'short_answer');
  });
  it('a malformed format falls back to the text rules', () => {
    const q = only(one({ text: 'x', points: 2, format: { kind: 'match', stem: 's', left: ['a'], right: ['b'], pairs: [5] } } as any, 'شرح طويل'));
    assert.equal(q.type, 'short_answer');
  });
});
```

Add to `worksheetRequest.test.ts`:

- A valid `format` survives parsing.
- A `format` with `kind: 'other'`, or with a non-string in `left`, is dropped without rejecting the request.

Add to `worksheetAssignment.test.ts`: `format` is copied into the payload.

- [ ] **Step 2: Run them to verify they fail**

Run: `cd artifacts/api-server && node --test src/modules/assessment/__tests__/fromWorksheet.test.ts src/modules/assessment/__tests__/worksheetRequest.test.ts`
Run: `cd artifacts/mobile && node --test services/__tests__/worksheetAssignment.test.ts`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement** the conversion, parsing and payload rules above.

- [ ] **Step 4: Run the checks**

Run: `cd artifacts/api-server && pnpm build && pnpm test`
Run: `cd artifacts/mobile && pnpm test`
Run: `pnpm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/worksheetAssignment.ts artifacts/mobile/services/__tests__/worksheetAssignment.test.ts artifacts/api-server/src/modules/assessment/
git commit -m "feat(assessment): worksheet formats convert to matching and multiple choice when sent to a class"
```

---

### Task 9: Verify in the web build, document it, open the PR

**Files:**
- Modify: `STATUS.md` (a new dated entry at the top of the dated entries)
- Modify: `docs/superpowers/specs/2026-10-11-worksheet-formats-design.md` (note the `stem` refinement and anything else that changed in the build)

- [ ] **Step 1: Run every check**

```bash
pnpm run typecheck
cd artifacts/mobile && pnpm test
cd ../api-server && pnpm build && pnpm test
cd ../../lib/math-practice && node --test src/__tests__/*.test.ts
pnpm --filter @workspace/db run generate   # expect "No schema changes"
```

- [ ] **Step 2: Drive it in the web build**

Use the local API + Postgres + Expo web against `http://localhost:8080/api`, signed in as a teacher with a class.

- On «المعادلات الأسية»: tick صِل, رتّب and أين الخطأ؟ and generate. Screenshot each section.
- Export the PDF; check the table, the cards and the numbered working, and that the key holds the answers.
- Open «اعرض على الشاشة» and screenshot the slides.
- Send the sheet to the class, take it as a student, and answer صِل and رتّب correctly and أين الخطأ؟ wrongly. Check in the database: صِل and رتّب `correct` at full marks, أين الخطأ؟ `incorrect`.
- On a lesson that routes to `system_graph`: tick ارسم. Check the empty grid on the paper, the drawn graph in the key and on the projector reveal, and that the class version is a teacher-marked question.
- Check that ارسم shows greyed on «المعادلات الأسية».

- [ ] **Step 3: STATUS.md entry.** Cover:
  - what changed, per format;
  - where it lives (files);
  - the bank-only rule and the live-path append;
  - how it was verified (the tests by name and count, plus the web-build run above);
  - what wasn't: device, chemistry missteps, drawing on the phone.

- [ ] **Step 4: Commit, push, open a draft PR, subscribe**

```bash
git add STATUS.md docs/superpowers/specs/2026-10-11-worksheet-formats-design.md
git commit -m "docs: worksheet formats in STATUS"
git push -u origin ccr-3ada7411-worksheet-formats
```

Open the draft PR with the GitHub tool, then call `subscribe_pr_activity` for it.
