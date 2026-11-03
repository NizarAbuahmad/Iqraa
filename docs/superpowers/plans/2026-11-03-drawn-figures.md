# Drawn Figures (graphs, vectors) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let exam questions and student lesson cards carry a drawn function graph or vector diagram, from a typed spec that one shared gate validates and our own code draws.

**Architecture:** A new pure package `lib/figure` (`@workspace/figure`) holds the figure types, the gate `resolveFigure`, the expression compiler (moved out of `deckVisuals.ts`), the viewport maths (moved out of `mathViewport.ts`), a pure geometry module, alt text, and a standalone-SVG writer. The API stores a gated `body.visual` on exam questions and re-gates it where it builds the student's copy; the app draws it with react-native-svg (`FigureView`). Lesson cards get the same optional `visual`, gated in the pure card builder. A refusal anywhere falls back to words.

**Tech Stack:** TypeScript, `node --test` with `--experimental-strip-types`, react-native-svg (already installed), Express API, pnpm workspaces.

**Spec:** `docs/superpowers/specs/2026-11-03-drawn-figures-design.md` (approved 2026-11-03).

## Global Constraints

Copied from the spec and CLAUDE.md; every task includes these.

- **Scope v1:** Evaluations (teacher preview + student sitting) and student lesson-explanation cards; **maths only**; two kinds, `function-graph` and `vectors`. Out: quiz/worksheet/lesson-plan outputs and exports, slides reuse, chemistry/physics-scale vectors, geometry figures, number lines, head-to-tail sums.
- **Gate limits (refuse the whole figure otherwise):** `function-graph`: 1–3 functions; `expr` ≤ 60 chars and accepted by `compileExpression`; finite at ≥ 80% of 200 samples; `x` increasing, width 0.5–40, within ±50; no sample beyond 1e9 (`maxSampleAbs`); `y` (optional) increasing, height 0.1–200, within ±1000; ≤ 4 `points`, each `at` inside `x` with `f(at)` finite (and inside a given `y`), `on` an existing function index (default 0). `vectors`: 1–5 vectors; each coordinate a multiple of 0.5 with |coord| ≤ 12; non-zero length; labels distinct. **Labels (both):** 1–3 letters (Latin or Arabic), optionally followed by one digit and/or a prime — never `=`, brackets, or a number on its own. Serialised spec ≤ 1.5 KB.
- **Trust rules:** the model never draws pixels; any refusal leaves words; a label cannot carry a value; a drawing never wears «تم التحقق»; the question's words must suffice to answer it; the student path re-validates; editing a question's text or key removes its drawing.
- **Maths is Latin `x` internally**, converted to «س» only at display time (alt text, axis names).
- **Colours** come from `useColors()`, never the global `palette`; text/curves on a card go through `readableOn(color, colors.card, 3)`. Colour is never the only cue (each curve/vector carries its letter). Nothing under a corner directory.
- **Plane is not mirrored in RTL** (x grows right in both languages); tick digits through `axisLabel` (Arabic-Indic in Arabic); do not put digits next to operators in an RTL `Text` without `forceLtr`/`displayLtr` (`services/mathCalc.ts`).
- **Imports loaded by `node --test` need explicit `.ts` extensions** (all of `lib/figure/src`, and mobile/API files under test).
- **No `sed -i` / `perl -pi` on source** (UTF-8 with Arabic). Use the Edit tool. `sed -n` for reading is fine. After editing, `git diff --stat` must not show `Bin N -> M bytes` for a text file.
- **No native module, no migration:** `app.json` `version` does not change; `body` and `ai_artifacts` are JSON.
- **A visible change adds a «ما الجديد» entry** to `WHATS_NEW` (`artifacts/mobile/services/whatsNew.ts`), dated the day it merges, or the PR body says why none.
- **Each PR's write-up goes at the TOP of `docs/status-log.md`**, and a STATUS.md line is edited only if it stops being true.
- **Branch discipline:** the designated branch is `claude/nifty-bell-uepuh2`. The three PRs go out **one after another** on that branch name: when a PR is merged, `git fetch origin main && git checkout -B claude/nifty-bell-uepuh2 origin/main` and start the next. Never push to `main`. PRs are opened as drafts.
- **Commit messages** end with the session attribution lines the harness gives; `git add` named paths only, never `-A`.
- **Before each PR:** `pnpm run typecheck`; `pnpm --filter @workspace/figure run test`; `pnpm --filter @workspace/api-server run build` then `pnpm --filter @workspace/api-server run test`; `pnpm --filter @workspace/mobile run test` (prints nothing until it ends, minutes).

## File Structure

**Create**
- `lib/figure/package.json`, `lib/figure/tsconfig.json` — package shell (copy of `lib/exam-paper`'s shape).
- `lib/figure/src/viewport.ts` — moved verbatim from `artifacts/mobile/services/mathViewport.ts`.
- `lib/figure/src/expression.ts` — moved verbatim from `deckVisuals.ts` lines 59–242 (`compileExpression`, `CompiledExpression`).
- `lib/figure/src/types.ts` — `Figure`, `FunctionGraph`, `VectorsFigure`.
- `lib/figure/src/gate.ts` — `FIGURE_LIMITS`, `resolveFigure`, `figureConsistentWith`.
- `lib/figure/src/geometry.ts` — `layoutFigure` (pure; pixel primitives).
- `lib/figure/src/alt.ts` — `figureAltText`.
- `lib/figure/src/svg.ts` — `figureSvg` (standalone SVG string; used by the review script and a later HTML export).
- `lib/figure/src/index.ts` — barrel.
- `lib/figure/src/__tests__/{expression,gate,geometry,alt,svg}.test.ts`.
- `artifacts/mobile/components/ui/FigureView.tsx`, `artifacts/mobile/components/ui/QuestionVisual.tsx`.
- `artifacts/mobile/services/__tests__/figureView.test.ts` (static source checks).
- `artifacts/api-server/src/modules/assessment/questionVisual.ts` and its test.
- `artifacts/api-server/src/lib/figurePrompt.ts` — prompt text shared by the exam and lesson prompts.
- `artifacts/api-server/src/modules/assessment/__tests__/llmGeneratorVisual.test.ts`.

**Modify**
- `artifacts/mobile/services/mathViewport.ts` → becomes a re-export.
- `artifacts/mobile/services/deckVisuals.ts` → imports/re-exports `compileExpression` from the package.
- Root `tsconfig.json`, `artifacts/api-server/package.json`, `artifacts/mobile/package.json`, `.github/workflows/ci.yml`, `pnpm-lock.yaml`.
- `artifacts/api-server/src/modules/assessment/llmGenerator.ts`, `studentView.ts`; `artifacts/api-server/src/routes/evaluations.ts` (PATCH question).
- `artifacts/mobile/app/evaluations/[id]/index.tsx`, `artifacts/mobile/app/take/[code].tsx`.
- `artifacts/mobile/services/ai/AIService.ts`, `lessonExplanationCards.ts`, `app/curriculum/lesson-explanation.tsx`, `scripts/pregenerate.ts`.
- `artifacts/api-server/src/lib/lessonTeachingPrompt.ts`, `generationKey.ts`.
- `artifacts/mobile/services/whatsNew.ts`, `services/i18n.ts`.
- `docs/status-log.md`, `STATUS.md`.

---

# PR 1 — `lib/figure` and `FigureView` (no behaviour change)

### Task A1: Package shell, wiring, and the viewport move

**Files:**
- Create: `lib/figure/package.json`, `lib/figure/tsconfig.json`, `lib/figure/src/index.ts`, `lib/figure/src/viewport.ts`
- Modify: `artifacts/mobile/services/mathViewport.ts`, `tsconfig.json`, `artifacts/api-server/package.json`, `artifacts/mobile/package.json`, `.github/workflows/ci.yml`, `pnpm-lock.yaml`

**Interfaces:**
- Produces: `@workspace/figure` (root export `src/index.ts`) and subpath `@workspace/figure/viewport` exporting everything `mathViewport.ts` exports today (`Viewport`, `ViewPreset`, `Point`, `MIN_SCALE`, `MAX_SCALE`, `makeViewport`, `bounds`, `toPx`, `toWorld`, `panBy`, `zoomAt`, `resize`, `equalize`, `pinchDelta`, `niceStep`, `Tick`, `gridTicks`).

- [ ] **Step 1: Create the package files**

`lib/figure/package.json`:
```json
{
  "name": "@workspace/figure",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts",
    "./viewport": "./src/viewport.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --experimental-strip-types --test \"src/**/__tests__/**/*.test.ts\""
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}
```

`lib/figure/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "composite": true,
    "declarationMap": true,
    "emitDeclarationOnly": true,
    "outDir": "dist",
    "rootDir": ".",
    "allowImportingTsExtensions": true,
    "types": ["node"]
  },
  "include": ["src/**/*.ts"]
}
```

`lib/figure/src/index.ts` (grows in later tasks; start with the viewport only):
```ts
export * from './viewport.ts';
```

- [ ] **Step 2: Move the viewport file verbatim**

```bash
cd /home/user/Iqraa
cp artifacts/mobile/services/mathViewport.ts lib/figure/src/viewport.ts
```
Then replace `artifacts/mobile/services/mathViewport.ts` entirely (Write tool) with:
```ts
/**
 * The view onto the plane. The implementation moved to `lib/figure/src/viewport.ts`
 * (2026-11) so the drawn-figure code that the API and the app share can use it;
 * this file re-exports it unchanged for the grapher, the sketchpad and the tests.
 */
export * from '@workspace/figure/viewport';
```

- [ ] **Step 3: Wire the package in**

In root `tsconfig.json`, after the `{ "path": "./lib/exam-paper" },` entry add `{ "path": "./lib/figure" },` (Edit: old `"path": "./lib/exam-paper"\n    },` → add a sibling block; keep valid JSON).

In `artifacts/api-server/package.json` and `artifacts/mobile/package.json`, add `"@workspace/figure": "workspace:*",` on the line after `"@workspace/exam-paper": "workspace:*",` (Edit, one file at a time).

In `.github/workflows/ci.yml`, after the `Test exam-paper core` step add:
```yaml
      - name: Test figure core
        run: pnpm --filter @workspace/figure run test
```

Run `pnpm install` from the repo root so `pnpm-lock.yaml` gains the `lib/figure` importer and both `link:` entries (CI uses `--frozen-lockfile`, so the lockfile must be committed). Check: `git diff --stat pnpm-lock.yaml` shows a small diff (tens of lines), not a rewrite.

- [ ] **Step 4: Verify nothing moved behaviour**

```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/mathViewport.test.ts services/__tests__/mathGraph.test.ts services/__tests__/mathGeometry.test.ts
cd /home/user/Iqraa && pnpm --filter @workspace/figure run typecheck
```
Expected: all pass (the three mobile suites are unchanged and now run through the re-export); typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/figure/package.json lib/figure/tsconfig.json lib/figure/src/index.ts lib/figure/src/viewport.ts artifacts/mobile/services/mathViewport.ts tsconfig.json artifacts/api-server/package.json artifacts/mobile/package.json .github/workflows/ci.yml pnpm-lock.yaml
git diff --cached --stat
git commit -m "lib/figure: new package; viewport maths moves into it"
```

### Task A2: The expression compiler moves into the package

**Files:**
- Create: `lib/figure/src/expression.ts`, `lib/figure/src/__tests__/expression.test.ts`
- Modify: `artifacts/mobile/services/deckVisuals.ts`, `lib/figure/src/index.ts`

**Interfaces:**
- Produces: `compileExpression(src: string, variable = 'x'): CompiledExpression | null` and `type CompiledExpression = (x: number) => number | null`, exported from `@workspace/figure` and still re-exported by `deckVisuals.ts`.

- [ ] **Step 1: Write the failing test**

`lib/figure/src/__tests__/expression.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { compileExpression } from '../expression.ts';

describe('compileExpression (moved from deckVisuals)', () => {
  it('evaluates a polynomial with school notation', () => {
    const f = compileExpression('x^2 - 4')!;
    assert.equal(f(2), 0);
    assert.equal(f(0), -4);
    assert.equal(compileExpression('3x + 1')!(2), 7);
  });

  it('knows sin/cos/tan in radians and demands brackets', () => {
    assert.ok(Math.abs(compileExpression('sin(x)')!(Math.PI / 2) - 1) < 1e-12);
    assert.equal(compileExpression('sin x + 1'), null);
  });

  it('fails closed on anything it cannot read', () => {
    assert.equal(compileExpression('y + 1'), null, 'unknown symbol');
    assert.equal(compileExpression('x; DROP'), null, 'stray characters');
    assert.equal(compileExpression('(x'), null, 'unbalanced');
    assert.equal(compileExpression(''), null);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

`cd /home/user/Iqraa && pnpm --filter @workspace/figure run test` → fails: cannot find module `../expression.ts`.

- [ ] **Step 3: Move lines 59–242 of `deckVisuals.ts` verbatim**

Confirm the range first: `sed -n '59p;242p;244p' artifacts/mobile/services/deckVisuals.ts` must print `/**`, `}`, and `export type SampleOptions = {`. Then save this script **outside the repo** (e.g. your scratchpad as `move-expression.mjs`) and run it from the repo root with `node <path>`:
```js
import fs from 'node:fs';
const p = 'artifacts/mobile/services/deckVisuals.ts';
const lines = fs.readFileSync(p, 'utf8').split('\n');
const block = lines.slice(58, 242); // lines 59..242
fs.writeFileSync('lib/figure/src/expression.ts', block.join('\n') + '\n');
const replacement = [
  "import { compileExpression, type CompiledExpression } from '@workspace/figure';",
  "export { compileExpression, type CompiledExpression };",
];
fs.writeFileSync(p, [...lines.slice(0, 58), ...replacement, ...lines.slice(242)].join('\n'));
```
Then in `lib/figure/src/index.ts` add `export * from './expression.ts';`.

Check: `git diff --stat artifacts/mobile/services/deckVisuals.ts` shows roughly 184 deletions and 2 insertions; `grep -c "compileExpression" artifacts/mobile/services/deckVisuals.ts` is unchanged apart from the two new lines.

- [ ] **Step 4: Run tests — expect PASS**

```bash
pnpm --filter @workspace/figure run test
cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/deckVisuals.test.ts
cd .. && pnpm --filter @workspace/mobile run typecheck
```
Expected: the new suite passes, the existing `deckVisuals.test.ts` passes untouched, typecheck clean.

- [ ] **Step 5: Commit**

```bash
git add lib/figure/src/expression.ts lib/figure/src/index.ts lib/figure/src/__tests__/expression.test.ts artifacts/mobile/services/deckVisuals.ts
git commit -m "lib/figure: the expression compiler moves out of deckVisuals"
```

### Task A3: Types and the gate

**Files:**
- Create: `lib/figure/src/types.ts`, `lib/figure/src/gate.ts`, `lib/figure/src/__tests__/gate.test.ts`
- Modify: `lib/figure/src/index.ts`

**Interfaces:**
- Produces:
  - `type FunctionGraph = { kind: 'function-graph'; functions: { expr: string; label?: string }[]; x: [number, number]; y?: [number, number]; points?: { at: number; label: string; on?: number }[] }`
  - `type VectorsFigure = { kind: 'vectors'; vectors: { from: [number, number]; to: [number, number]; label?: string }[]; components?: boolean }`
  - `type Figure = FunctionGraph | VectorsFigure`
  - `const FIGURE_LIMITS` (fields used by prompts: `maxFunctions`, `maxExprChars`, `maxPoints`, `maxVectors`, `maxXWidth`, `maxCoord`, `maxBytes`)
  - `resolveFigure(raw: unknown): Figure | null` — never throws, never repairs; returns a fresh normalised object (unknown keys dropped, `on` filled in).
  - `figureConsistentWith(figure: Figure, checkQuestion: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing tests**

`lib/figure/src/__tests__/gate.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FIGURE_LIMITS, figureConsistentWith, resolveFigure } from '../gate.ts';

const graph = (over: Record<string, unknown> = {}) => ({
  kind: 'function-graph',
  functions: [{ expr: 'x^2 - 4', label: 'f' }],
  x: [-3, 3],
  ...over,
});
const vecs = (over: Record<string, unknown> = {}) => ({
  kind: 'vectors',
  vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }],
  ...over,
});

describe('resolveFigure: function-graph', () => {
  it('accepts a plain graph and fills in the defaults', () => {
    const f = resolveFigure(graph({ points: [{ at: 2, label: 'A' }], junk: 1 }));
    assert.deepEqual(f, {
      kind: 'function-graph',
      functions: [{ expr: 'x^2 - 4', label: 'f' }],
      x: [-3, 3],
      points: [{ at: 2, label: 'A', on: 0 }],
    });
  });

  it('refuses what is not an object, an unknown kind, and junk', () => {
    for (const raw of [null, undefined, 7, 'x', [], {}, { kind: 'pie' }]) {
      assert.equal(resolveFigure(raw), null, JSON.stringify(raw));
    }
  });

  it('refuses expressions the compiler cannot read, and too many or too long', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'y + 1' }] })), null);
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x'.repeat(FIGURE_LIMITS.maxExprChars + 1) }] })), null);
    assert.equal(resolveFigure(graph({ functions: [] })), null);
    const four = Array.from({ length: 4 }, (_, i) => ({ expr: `x + ${i}` }));
    assert.equal(resolveFigure(graph({ functions: four })), null);
  });

  it('refuses a bad domain', () => {
    for (const x of [[3, -3], [0, 0], [-60, 0], [0, 41], [-30, 30], ['a', 1], [1], null]) {
      assert.equal(resolveFigure(graph({ x })), null, JSON.stringify(x));
    }
  });

  it('refuses a function that is mostly gaps', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'sqrt(x)' }] })), null, 'unknown function');
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x/0' }] })), null, 'undefined at every sample');
  });

  it('checks the y range', () => {
    assert.ok(resolveFigure(graph({ y: [-5, 5] })));
    for (const y of [[5, -5], [0, 0], [0, 201], [-2000, 0], 'x']) {
      assert.equal(resolveFigure(graph({ y })), null, JSON.stringify(y));
    }
  });

  it('refuses a marked point off the domain, on a gap, or on a missing curve', () => {
    assert.equal(resolveFigure(graph({ points: [{ at: 5, label: 'A' }] })), null, 'outside x');
    assert.equal(resolveFigure(graph({ points: [{ at: 2, label: 'A', on: 1 }] })), null, 'no such curve');
    assert.equal(resolveFigure(graph({ functions: [{ expr: '1/x' }], x: [-1, 1], points: [{ at: 0, label: 'A' }] })), null, 'on a gap');
    const five = Array.from({ length: 5 }, (_, i) => ({ at: i - 2, label: 'P' }));
    assert.equal(resolveFigure(graph({ points: five })), null, 'too many');
  });
});

describe('labels never carry a value', () => {
  const ok = ['f', 'AB', 'ABC', 'u', 'v1', "B'", 'A′', 'س', 'ق', 'أب'];
  const bad = ['', 'ABCD', 'x=3', '(2,3)', '5', 'f(x)', 'A B', '3A', '|v|', 'A1B', 'AB12'];
  it('accepts short letter labels', () => {
    for (const label of ok) assert.ok(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), label);
  });
  it('refuses anything that could hold a number, coordinates or an equation', () => {
    for (const label of bad) assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label }] })), null, JSON.stringify(label));
    for (const label of bad) assert.equal(resolveFigure(graph({ functions: [{ expr: 'x', label }] })), null, JSON.stringify(label));
    for (const label of bad) assert.equal(resolveFigure(graph({ points: [{ at: 0, label }] })), null, JSON.stringify(label));
  });
  it('refuses repeated curve or vector labels', () => {
    assert.equal(resolveFigure(graph({ functions: [{ expr: 'x', label: 'f' }, { expr: '2x', label: 'f' }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [1, 1], label: 'u' }, { from: [0, 0], to: [2, 1], label: 'u' }] })), null);
  });
});

describe('resolveFigure: vectors', () => {
  it('accepts vectors and normalises', () => {
    assert.deepEqual(resolveFigure(vecs({ components: true, junk: 1 })), {
      kind: 'vectors',
      vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }],
      components: true,
    });
  });
  it('refuses a zero-length vector, off-grid coordinates, big coordinates and too many', () => {
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [1, 1], to: [1, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [0.3, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [13, 1] }] })), null);
    assert.equal(resolveFigure(vecs({ vectors: [] })), null);
    const six = Array.from({ length: 6 }, (_, i) => ({ from: [0, 0], to: [i + 1, 1] }));
    assert.equal(resolveFigure(vecs({ vectors: six })), null);
  });
  it('accepts half-unit coordinates and refuses a non-boolean components flag', () => {
    assert.ok(resolveFigure(vecs({ vectors: [{ from: [0, 0], to: [-1.5, 2.5] }] })));
    assert.equal(resolveFigure(vecs({ components: 'yes' })), null);
  });
});

describe('size', () => {
  it('refuses a spec over the byte cap', () => {
    const long = Array.from({ length: 3 }, (_, i) => ({ expr: `${'x + '.repeat(14)}${i}`, label: String.fromCharCode(102 + i) }));
    const f = resolveFigure(graph({ functions: long, points: Array.from({ length: 4 }, (_, i) => ({ at: i, label: 'P' })) }));
    assert.ok(f === null || JSON.stringify(f).length <= FIGURE_LIMITS.maxBytes);
  });
});

describe('figureConsistentWith', () => {
  const f = resolveFigure(graph())!;
  it('agrees when the checked function is one of the drawn ones', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 4'), true);
    assert.equal(figureConsistentWith(f, '-4 + x*x'), true);
  });
  it('disagrees when the checked function is a different one', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 5'), false);
  });
  it('cannot compare an equation or nothing, and then does not object', () => {
    assert.equal(figureConsistentWith(f, 'x^2 - 4 = 0'), true);
    assert.equal(figureConsistentWith(f, null), true);
    assert.equal(figureConsistentWith(f, undefined), true);
  });
  it('has nothing to say about vectors', () => {
    assert.equal(figureConsistentWith(resolveFigure(vecs())!, 'x^2'), true);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module '../gate.ts'`).

- [ ] **Step 3: Write `types.ts` and `gate.ts`**

`lib/figure/src/types.ts`:
```ts
export type FunctionGraph = {
  kind: 'function-graph';
  /** Latin, variable `x`. */
  functions: { expr: string; label?: string }[];
  /** The domain drawn. */
  x: [number, number];
  /** The range drawn; fitted to the samples when absent. */
  y?: [number, number];
  /** Marked points: the model gives only x, the y is computed on the curve. */
  points?: { at: number; label: string; on?: number }[];
};

export type VectorsFigure = {
  kind: 'vectors';
  vectors: { from: [number, number]; to: [number, number]; label?: string }[];
  /** Dashed horizontal and vertical parts of each vector. */
  components?: boolean;
};

/** Open on purpose: `resolveFigure` returns null for a kind this build does not know. */
export type Figure = FunctionGraph | VectorsFigure;
```

`lib/figure/src/gate.ts`:
```ts
/**
 * The one gate every drawn figure passes: when the model writes it, when the API
 * hands it to a student, when a card is built. It never repairs — a figure
 * outside the limits is refused whole and the caller shows words, as
 * `resolveSlideLayout` does for slide diagrams.
 *
 * A label can never hold a value (1–3 letters, optionally one digit and a
 * prime), which is what stops a drawing giving a question's answer away.
 */
import { compileExpression } from './expression.ts';
import type { Figure, FunctionGraph, VectorsFigure } from './types.ts';

export const FIGURE_LIMITS = {
  maxFunctions: 3,
  maxExprChars: 60,
  maxPoints: 4,
  maxVectors: 5,
  maxXWidth: 40,
  maxXAbs: 50,
  maxYHeight: 200,
  maxYAbs: 1000,
  maxCoord: 12,
  maxBytes: 1500,
  samples: 200,
  minFiniteShare: 0.8,
} as const;

const L = FIGURE_LIMITS;
const LABEL = /^[A-Za-zء-ي]{1,3}[0-9]?['′]?$/u;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isPair = (v: unknown): v is [number, number] => Array.isArray(v) && v.length === 2 && isNum(v[0]) && isNum(v[1]);
const isLabel = (v: unknown): v is string => typeof v === 'string' && LABEL.test(v);
const onHalfGrid = (v: number) => Math.abs(v) <= L.maxCoord && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;

function resolveGraph(raw: Rec): FunctionGraph | null {
  const fns = raw['functions'];
  if (!Array.isArray(fns) || fns.length < 1 || fns.length > L.maxFunctions) return null;
  const functions: FunctionGraph['functions'] = [];
  const compiled: ((x: number) => number | null)[] = [];
  const labels = new Set<string>();
  for (const f of fns) {
    if (!isRec(f) || typeof f['expr'] !== 'string') return null;
    const expr = f['expr'].trim();
    if (expr.length < 1 || expr.length > L.maxExprChars) return null;
    const fn = compileExpression(expr);
    if (!fn) return null;
    compiled.push(fn);
    const label = f['label'];
    if (label === undefined) {
      functions.push({ expr });
    } else {
      if (!isLabel(label) || labels.has(label)) return null;
      labels.add(label);
      functions.push({ expr, label });
    }
  }

  const xr = raw['x'];
  if (!isPair(xr)) return null;
  const [x0, x1] = xr;
  if (!(x1 > x0) || x1 - x0 > L.maxXWidth || Math.abs(x0) > L.maxXAbs || Math.abs(x1) > L.maxXAbs) return null;

  const dx = (x1 - x0) / (L.samples - 1);
  for (const fn of compiled) {
    let finite = 0;
    for (let i = 0; i < L.samples; i++) {
      const y = fn(x0 + i * dx);
      if (y !== null && Number.isFinite(y)) finite++;
    }
    if (finite / L.samples < L.minFiniteShare) return null;
  }

  let y: [number, number] | undefined;
  if (raw['y'] !== undefined) {
    const yr = raw['y'];
    if (!isPair(yr)) return null;
    const [y0, y1] = yr;
    if (!(y1 > y0) || y1 - y0 > L.maxYHeight || Math.abs(y0) > L.maxYAbs || Math.abs(y1) > L.maxYAbs) return null;
    y = [y0, y1];
  }

  const points: NonNullable<FunctionGraph['points']> = [];
  if (raw['points'] !== undefined) {
    const list = raw['points'];
    if (!Array.isArray(list) || list.length > L.maxPoints) return null;
    for (const p of list) {
      if (!isRec(p)) return null;
      const at = p['at'];
      const label = p['label'];
      if (!isNum(at) || at < x0 || at > x1 || !isLabel(label)) return null;
      const on = p['on'] === undefined ? 0 : p['on'];
      if (typeof on !== 'number' || !Number.isInteger(on) || on < 0 || on >= compiled.length) return null;
      const py = compiled[on]!(at);
      if (py === null || !Number.isFinite(py)) return null;
      points.push({ at, label, on });
    }
  }

  return {
    kind: 'function-graph',
    functions,
    x: [x0, x1],
    ...(y ? { y } : {}),
    ...(points.length > 0 ? { points } : {}),
  };
}

function resolveVectors(raw: Rec): VectorsFigure | null {
  const list = raw['vectors'];
  if (!Array.isArray(list) || list.length < 1 || list.length > L.maxVectors) return null;
  const vectors: VectorsFigure['vectors'] = [];
  const labels = new Set<string>();
  for (const v of list) {
    if (!isRec(v)) return null;
    const from = v['from'];
    const to = v['to'];
    if (!isPair(from) || !isPair(to)) return null;
    if (![...from, ...to].every(onHalfGrid)) return null;
    if (from[0] === to[0] && from[1] === to[1]) return null;
    const label = v['label'];
    if (label === undefined) {
      vectors.push({ from: [from[0], from[1]], to: [to[0], to[1]] });
    } else {
      if (!isLabel(label) || labels.has(label)) return null;
      labels.add(label);
      vectors.push({ from: [from[0], from[1]], to: [to[0], to[1]], label });
    }
  }
  const components = raw['components'];
  if (components !== undefined && typeof components !== 'boolean') return null;
  return { kind: 'vectors', vectors, ...(components === true ? { components: true } : {}) };
}

export function resolveFigure(raw: unknown): Figure | null {
  try {
    if (!isRec(raw)) return null;
    const out = raw['kind'] === 'function-graph' ? resolveGraph(raw)
      : raw['kind'] === 'vectors' ? resolveVectors(raw)
        : null;
    if (!out) return null;
    return JSON.stringify(out).length <= L.maxBytes ? out : null;
  } catch {
    return null;
  }
}

/**
 * Does a drawn function agree with the function an exam question's `check`
 * was written for? A different function means the picture and the checked key
 * are about two things, so the caller drops the picture. When the check is an
 * equation, absent, or compares too few points, this cannot tell and says yes —
 * it is a narrow guard, not a proof the drawing is right.
 */
export function figureConsistentWith(figure: Figure, checkQuestion: string | null | undefined): boolean {
  if (figure.kind !== 'function-graph' || !checkQuestion) return true;
  const checked = compileExpression(checkQuestion.trim());
  if (!checked) return true;
  const [x0, x1] = figure.x;
  const xs = Array.from({ length: 24 }, (_, i) => x0 + ((x1 - x0) * i) / 23);
  let compared = 0;
  for (const { expr } of figure.functions) {
    const drawn = compileExpression(expr);
    if (!drawn) continue;
    let same = true;
    let n = 0;
    for (const x of xs) {
      const a = drawn(x);
      const b = checked(x);
      if (a === null || b === null || !Number.isFinite(a) || !Number.isFinite(b)) continue;
      n++;
      if (Math.abs(a - b) > 1e-6 * Math.max(1, Math.abs(a), Math.abs(b))) { same = false; break; }
    }
    if (n < 8) continue;
    compared++;
    if (same) return true;
  }
  return compared === 0;
}
```
Add `export * from './types.ts'; export * from './gate.ts';` to `lib/figure/src/index.ts`.

- [ ] **Step 4: Run — expect PASS**

`pnpm --filter @workspace/figure run test` and `pnpm --filter @workspace/figure run typecheck`. (`sqrt(x)` is refused because the compiler reads `sqrt` as an unknown symbol; `x/0` compiles but is `NaN` at every sample, so the 80% rule refuses it.) If the byte-cap test is vacuous because the spec fits, leave it: the assertion is the invariant.

- [ ] **Step 5: Commit**

```bash
git add lib/figure/src/types.ts lib/figure/src/gate.ts lib/figure/src/index.ts lib/figure/src/__tests__/gate.test.ts
git commit -m "lib/figure: the figure types and the gate"
```

### Task A4: Geometry

**Files:**
- Create: `lib/figure/src/geometry.ts`, `lib/figure/src/__tests__/geometry.test.ts`
- Modify: `lib/figure/src/index.ts`

**Interfaces:**
- Consumes: `Figure`, `FunctionGraph`, `VectorsFigure` (A3); `compileExpression` (A2); `Viewport`, `toPx` (A1).
- Produces:
```ts
export type Pt = { x: number; y: number };
export type FigureLayout = {
  viewport: Viewport;                       // world↔pixel mapping; PlaneGrid draws the backdrop from it
  curves: { colorIndex: number; label?: string; segments: Pt[][]; labelAt: Pt | null }[];
  points: { colorIndex: number; label: string; at: Pt; labelAt: Pt }[];
  arrows: { colorIndex: number; label?: string; from: Pt; to: Pt; head: [Pt, Pt, Pt]; labelAt: Pt | null }[];
  components: { from: Pt; to: Pt }[];       // dashed projections, already in pixels
};
export function layoutFigure(figure: Figure, box: { w: number; h: number }): FigureLayout;
```

- [ ] **Step 1: Write the failing tests**

`lib/figure/src/__tests__/geometry.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { layoutFigure } from '../geometry.ts';
import { resolveFigure } from '../gate.ts';
import { bounds, toPx, toWorld } from '../viewport.ts';

const BOX = { w: 400, h: 300 };
const fig = (raw: unknown) => resolveFigure(raw)!;
const near = (a: number, b: number, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

describe('layoutFigure: function-graph', () => {
  const parabola = fig({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }], x: [-3, 3], points: [{ at: 2, label: 'A' }] });
  const lay = layoutFigure(parabola, BOX);

  it('draws one unbroken curve of 240 samples', () => {
    assert.equal(lay.curves.length, 1);
    assert.equal(lay.curves[0]!.segments.length, 1);
    assert.equal(lay.curves[0]!.segments[0]!.length, 240);
  });

  it('fits the viewport around the curve and keeps the x axis in view', () => {
    const b = bounds(lay.viewport);
    assert.ok(b.xMin <= -3 && b.xMax >= 3);
    assert.ok(b.yMin <= -4 && b.yMax >= 5, `${b.yMin}..${b.yMax}`);
    assert.ok(b.yMin <= 0 && b.yMax >= 0);
  });

  it('puts a marked point on the curve at its computed y', () => {
    const a = lay.points[0]!;
    const want = toPx(lay.viewport, 2, 0);
    near(a.at.x, want.x);
    near(a.at.y, want.y);
    assert.equal(a.label, 'A');
  });

  it('keeps labels inside the box', () => {
    for (const p of [lay.curves[0]!.labelAt!, lay.points[0]!.labelAt]) {
      assert.ok(p.x >= 0 && p.x <= BOX.w && p.y >= 0 && p.y <= BOX.h, JSON.stringify(p));
    }
  });

  it('honours a given y range', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'x' }], x: [-2, 2], y: [-10, 10] }), BOX);
    const b = bounds(l.viewport);
    near(b.yMin, -10);
    near(b.yMax, 10);
  });
});

describe('layoutFigure: asymptotes never join two branches', () => {
  // A branch that wrongly joined across an asymptote would, in world units, step
  // the wrong way (tan only rises on a branch, 1/x only falls). Steep climbs that
  // run off the canvas are legitimate and are not what this checks.
  const monotone = (l: ReturnType<typeof layoutFigure>, dir: 1 | -1) => {
    for (const c of l.curves) for (const s of c.segments) {
      const ys = s.map(p => toWorld(l.viewport, p.x, p.y).y);
      for (let i = 1; i < ys.length; i++) {
        assert.ok(dir * (ys[i]! - ys[i - 1]!) >= -1e-9, `a branch steps the wrong way at point ${i}`);
      }
    }
  };

  it('splits 1/x into two branches', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '1/x' }], x: [-2, 2] }), BOX);
    assert.equal(l.curves[0]!.segments.length, 2);
    monotone(l, -1);
  });

  it('splits tan(x) at its asymptotes', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: 'tan(x)' }], x: [-3, 3] }), BOX);
    assert.ok(l.curves[0]!.segments.length >= 3);
    monotone(l, 1);
  });

  it('does not cut a steep monotone curve short', () => {
    const l = layoutFigure(fig({ kind: 'function-graph', functions: [{ expr: '2^x' }], x: [0, 10] }), BOX);
    const segs = l.curves[0]!.segments;
    assert.equal(segs.length, 1);
    assert.equal(segs[0]!.length, 240);
  });
});

describe('layoutFigure: vectors', () => {
  const v = fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }, { from: [0, 0], to: [-1, 2.5], label: 'v' }], components: true });
  const lay = layoutFigure(v, BOX);

  it('uses the same scale on both axes', () => {
    near(lay.viewport.sx, lay.viewport.sy);
  });

  it('shows the origin and every endpoint', () => {
    const b = bounds(lay.viewport);
    for (const [x, y] of [[0, 0], [3, 2], [-1, 2.5]] as const) {
      assert.ok(x >= b.xMin && x <= b.xMax && y >= b.yMin && y <= b.yMax, `${x},${y}`);
    }
  });

  it('puts the arrow tip on the end point and the head behind it', () => {
    const a = lay.arrows[0]!;
    const tip = toPx(lay.viewport, 3, 2);
    near(a.to.x, tip.x);
    near(a.to.y, tip.y);
    assert.deepEqual(a.head[0], a.to);
    // the two base corners are equally far from the shaft
    const d = (p: { x: number; y: number }) => Math.hypot(p.x - a.to.x, p.y - a.to.y);
    near(d(a.head[1]), d(a.head[2]), 1e-6);
  });

  it('draws two dashed component lines per vector', () => {
    assert.equal(lay.components.length, 4);
  });

  it('leaves a figure without components with none', () => {
    const plain = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [1, 1] }] }), BOX);
    assert.equal(plain.components.length, 0);
    assert.equal(plain.arrows[0]!.label, undefined);
  });

  it('keeps a small figure from filling the canvas with one tiny arrow', () => {
    const l = layoutFigure(fig({ kind: 'vectors', vectors: [{ from: [0, 0], to: [0.5, 0.5] }] }), BOX);
    const b = bounds(l.viewport);
    assert.ok(b.xMax - b.xMin >= 4 && b.yMax - b.yMin >= 4);
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module '../geometry.ts'`).

- [ ] **Step 3: Write `geometry.ts`**

```ts
/**
 * Where everything goes. Pure: a figure and a box in, pixel primitives out, so
 * the app (react-native-svg), the review script (`figureSvg`) and any later
 * export draw the same picture.
 */
import { compileExpression } from './expression.ts';
import type { Figure, FunctionGraph, VectorsFigure } from './types.ts';
import { toPx, type Viewport } from './viewport.ts';

export type Pt = { x: number; y: number };
export type Box = { w: number; h: number };

export type FigureLayout = {
  viewport: Viewport;
  curves: { colorIndex: number; label?: string; segments: Pt[][]; labelAt: Pt | null }[];
  points: { colorIndex: number; label: string; at: Pt; labelAt: Pt }[];
  arrows: { colorIndex: number; label?: string; from: Pt; to: Pt; head: [Pt, Pt, Pt]; labelAt: Pt | null }[];
  components: { from: Pt; to: Pt }[];
};

const SAMPLES = 240;

const clampPt = (p: Pt, box: Box): Pt => ({
  x: Math.min(box.w - 14, Math.max(4, p.x)),
  y: Math.min(box.h - 4, Math.max(12, p.y)),
});

const percentile = (sorted: number[], q: number): number =>
  sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))]!;

function layoutGraph(fig: FunctionGraph, box: Box): FigureLayout {
  const fns = fig.functions.map(f => compileExpression(f.expr));
  const [x0, x1] = fig.x;
  const dx = (x1 - x0) / (SAMPLES - 1);
  const series = fns.map(fn =>
    Array.from({ length: SAMPLES }, (_, i) => {
      const x = x0 + i * dx;
      const y = fn ? fn(x) : null;
      return { x, y: y !== null && Number.isFinite(y) ? y : null };
    }),
  );

  // The range: given, or fitted to the 2nd–98th percentile of the samples so one
  // asymptote spike cannot flatten the rest of the curve.
  let lo: number;
  let hi: number;
  if (fig.y) {
    [lo, hi] = fig.y;
  } else {
    const ys = series.flat().map(s => s.y).filter((y): y is number => y !== null).sort((a, b) => a - b);
    let min = ys.length ? percentile(ys, 0.02) : -1;
    let max = ys.length ? percentile(ys, 0.98) : 1;
    if (max - min < 1e-9) { min -= 1; max += 1; }
    const pad = (max - min) * 0.1;
    lo = min - pad;
    hi = max + pad;
    const span = hi - lo;
    // Keep the x axis in view when it is close to the data.
    if (lo > 0 && hi <= 4 * span) lo = -0.1 * span;
    else if (hi < 0 && -lo <= 4 * span) hi = 0.1 * span;
  }
  const span = hi - lo;
  const viewport: Viewport = {
    cx: (x0 + x1) / 2,
    cy: (lo + hi) / 2,
    sx: box.w / ((x1 - x0) * 1.08),
    sy: box.h / span,
    w: box.w,
    h: box.h,
  };

  const clip = span * 3;
  const curves = series.map((s, k) => {
    // A jump across zero much bigger than a normal step is an asymptote, not a line.
    const steps: number[] = [];
    for (let i = 1; i < s.length; i++) {
      const a = s[i - 1]!.y;
      const b = s[i]!.y;
      if (a !== null && b !== null) steps.push(Math.abs(b - a));
    }
    steps.sort((a, b) => a - b);
    const jump = 8 * (steps.length ? steps[Math.floor(steps.length / 2)]! : 0);

    const runs: Pt[][] = [];
    let cur: Pt[] | null = null;
    let prevY: number | null = null;
    for (const p of s) {
      const y = p.y;
      if (y === null || y < lo - clip || y > hi + clip) { cur = null; prevY = null; continue; }
      if (cur !== null && prevY !== null && Math.sign(y) !== Math.sign(prevY) && Math.abs(y - prevY) > jump) cur = null;
      if (cur === null) { cur = []; runs.push(cur); }
      cur.push(toPx(viewport, p.x, y));
      prevY = y;
    }
    const segments = runs.filter(r => r.length >= 2);
    const last = segments[segments.length - 1];
    const end = last ? last[last.length - 1]! : null;
    const label = fig.functions[k]!.label;
    return {
      colorIndex: k,
      ...(label ? { label } : {}),
      segments,
      labelAt: end ? clampPt({ x: end.x + 4, y: end.y - 6 }, box) : null,
    };
  });

  const points: FigureLayout['points'] = [];
  for (const p of fig.points ?? []) {
    const on = p.on ?? 0;
    const f = fns[on];
    const y = f ? f(p.at) : null;
    if (y === null || !Number.isFinite(y)) continue;
    const at = toPx(viewport, p.at, y);
    points.push({ colorIndex: on, label: p.label, at, labelAt: clampPt({ x: at.x + 6, y: at.y - 8 }, box) });
  }

  return { viewport, curves, points, arrows: [], components: [] };
}

function arrowHead(from: Pt, to: Pt): [Pt, Pt, Pt] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const head = Math.min(10, len * 0.4);
  const half = head * 0.45;
  const bx = to.x - ux * head;
  const by = to.y - uy * head;
  return [to, { x: bx - uy * half, y: by + ux * half }, { x: bx + uy * half, y: by - ux * half }];
}

function layoutVectors(fig: VectorsFigure, box: Box): FigureLayout {
  const xs = [0, ...fig.vectors.flatMap(v => [v.from[0], v.to[0]])];
  const ys = [0, ...fig.vectors.flatMap(v => [v.from[1], v.to[1]])];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = Math.max(maxX - minX, 4) + 2;
  const spanY = Math.max(maxY - minY, 4) + 2;
  const s = Math.min(box.w / spanX, box.h / spanY);
  const viewport: Viewport = { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, sx: s, sy: s, w: box.w, h: box.h };

  const arrows = fig.vectors.map((v, i) => {
    const from = toPx(viewport, v.from[0], v.from[1]);
    const to = toPx(viewport, v.to[0], v.to[1]);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy) || 1;
    const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
    return {
      colorIndex: i % 3,
      ...(v.label ? { label: v.label } : {}),
      from,
      to,
      head: arrowHead(from, to),
      labelAt: v.label ? clampPt({ x: mid.x - (dy / len) * 12, y: mid.y + (dx / len) * 12 }, box) : null,
    };
  });

  const components: FigureLayout['components'] = [];
  if (fig.components) {
    for (const v of fig.vectors) {
      const a = toPx(viewport, v.from[0], v.from[1]);
      const corner = toPx(viewport, v.to[0], v.from[1]);
      const b = toPx(viewport, v.to[0], v.to[1]);
      components.push({ from: a, to: corner }, { from: corner, to: b });
    }
  }
  return { viewport, curves: [], points: [], arrows, components };
}

export function layoutFigure(figure: Figure, box: Box): FigureLayout {
  return figure.kind === 'function-graph' ? layoutGraph(figure, box) : layoutVectors(figure, box);
}
```
Add `export * from './geometry.ts';` to `index.ts`.

- [ ] **Step 4: Run — expect PASS**

`pnpm --filter @workspace/figure run test` and `typecheck`. If `tan(x)` yields fewer than 3 segments, `1/x` not exactly 2, or a branch steps the wrong way, print `segments.map(s => s.length)` and adjust the *threshold* (`jump` multiplier / `clip`), not the assertions: the assertions state the product behaviour (branches split at the asymptote, never joined; a steep monotone curve intact).

- [ ] **Step 5: Commit**

```bash
git add lib/figure/src/geometry.ts lib/figure/src/index.ts lib/figure/src/__tests__/geometry.test.ts
git commit -m "lib/figure: pure geometry for graphs and vectors"
```

### Task A5: Alt text and the standalone SVG

**Files:**
- Create: `lib/figure/src/alt.ts`, `lib/figure/src/svg.ts`, `lib/figure/src/__tests__/alt.test.ts`, `lib/figure/src/__tests__/svg.test.ts`
- Modify: `lib/figure/src/index.ts`

**Interfaces:**
- Consumes: `layoutFigure` (A4), `gridTicks`, `toPx` (A1), `Figure` (A3).
- Produces: `figureAltText(figure: Figure, lang: 'ar' | 'en'): string`; `figureSvg(figure: Figure, opts?: { lang?: 'ar' | 'en'; width?: number; height?: number }): string` (a complete `<svg …>…</svg>` string, default 480×320).

- [ ] **Step 1: Write the failing tests**

`lib/figure/src/__tests__/alt.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureAltText } from '../alt.ts';
import { resolveFigure } from '../gate.ts';

const g = resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }, { expr: 'sin(x)' }], x: [-3, 3] })!;
const v = resolveFigure({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }, { from: [1, 1], to: [-1, 2.5] }] })!;

describe('figureAltText', () => {
  it('describes a graph and shows the variable as س in Arabic only', () => {
    const ar = figureAltText(g, 'ar');
    assert.ok(ar.includes('س^2 - 4') && ar.includes('sin(س)'), ar);
    assert.ok(!/\bx\b/.test(ar), ar);
    const en = figureAltText(g, 'en');
    assert.ok(en.includes('x^2 - 4') && en.includes('f:'), en);
  });
  it('describes vectors by their end points', () => {
    const ar = figureAltText(v, 'ar');
    assert.ok(ar.includes('(0, 0)') && ar.includes('(3, 2)') && ar.includes('u'), ar);
    assert.ok(figureAltText(v, 'en').includes('(1, 1)'));
  });
});
```

`lib/figure/src/__tests__/svg.test.ts`:
```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureSvg } from '../svg.ts';
import { resolveFigure } from '../gate.ts';

describe('figureSvg', () => {
  it('draws a graph: a curve, a point, its label', () => {
    const svg = figureSvg(resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x^2 - 4', label: 'f' }], x: [-3, 3], points: [{ at: 2, label: 'A' }] })!);
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
    assert.equal((svg.match(/<polyline /g) ?? []).length, 1);
    assert.equal((svg.match(/<circle /g) ?? []).length, 1);
    assert.ok(svg.includes('>f<') && svg.includes('>A<'));
  });
  it('draws vectors: a shaft and a head each, dashes for components', () => {
    const svg = figureSvg(resolveFigure({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }], components: true })!);
    assert.equal((svg.match(/<polygon /g) ?? []).length, 1);
    assert.ok(svg.includes('stroke-dasharray'));
  });
  it('escapes text and names the axes for the language', () => {
    const f = resolveFigure({ kind: 'function-graph', functions: [{ expr: 'x' }], x: [-2, 2] })!;
    assert.ok(figureSvg(f, { lang: 'ar' }).includes('>س<'));
    assert.ok(figureSvg(f, { lang: 'en' }).includes('>x<'));
    assert.ok(!figureSvg(f).includes('<script'));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (modules not found).

- [ ] **Step 3: Write `alt.ts` and `svg.ts`**

`lib/figure/src/alt.ts`:
```ts
import type { Figure } from './types.ts';

/** Maths is Latin `x` everywhere; «س» appears only when it is shown in Arabic. */
const show = (expr: string, lang: 'ar' | 'en'): string =>
  lang === 'ar' ? expr.replace(/(?<![A-Za-z])x(?![A-Za-z])/g, 'س') : expr;

const pt = (p: [number, number]) => `(${p[0]}, ${p[1]})`;

/** A text alternative generated from the spec, for screen readers. */
export function figureAltText(figure: Figure, lang: 'ar' | 'en'): string {
  if (figure.kind === 'function-graph') {
    const list = figure.functions.map(f => `${f.label ? `${f.label}: ` : ''}${show(f.expr, lang)}`).join(lang === 'ar' ? '، ' : ', ');
    return lang === 'ar' ? `رسم بياني للاقتران: ${list}` : `Graph of: ${list}`;
  }
  const list = figure.vectors
    .map(v => (lang === 'ar'
      ? `${v.label ? `المتجه ${v.label}` : 'متجه'} من ${pt(v.from)} إلى ${pt(v.to)}`
      : `${v.label ? `vector ${v.label}` : 'vector'} from ${pt(v.from)} to ${pt(v.to)}`))
    .join(lang === 'ar' ? '؛ ' : '; ');
  return lang === 'ar' ? `رسم متجهات على المستوى الإحداثي: ${list}` : `Vectors on the coordinate plane: ${list}`;
}
```

`lib/figure/src/svg.ts`:
```ts
/**
 * A figure as a standalone SVG string. The app draws with react-native-svg; this
 * is for places with no React: the pregenerate review files an admin looks at
 * before approving an explanation, and any later HTML/PDF export.
 */
import { figureAltText } from './alt.ts';
import { layoutFigure, type Pt } from './geometry.ts';
import type { Figure } from './types.ts';
import { gridTicks, toPx } from './viewport.ts';

const COLORS = ['#2563EB', '#DC2626', '#15803D'];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const n = (v: number) => v.toFixed(1);

export function figureSvg(figure: Figure, opts: { lang?: 'ar' | 'en'; width?: number; height?: number } = {}): string {
  const w = opts.width ?? 480;
  const h = opts.height ?? 320;
  const lang = opts.lang ?? 'en';
  const lay = layoutFigure(figure, { w, h });
  const vp = lay.viewport;
  const { xs, ys } = gridTicks(vp);
  const o = toPx(vp, 0, 0);
  const axisX = o.x >= 0 && o.x <= w ? o.x : null;
  const axisY = o.y >= 0 && o.y <= h ? o.y : null;
  const color = (i: number) => COLORS[i % COLORS.length]!;
  const text = (p: Pt, s: string, fill: string, size = 13, anchor = 'start') =>
    `<text x="${n(p.x)}" y="${n(p.y)}" fill="${fill}" font-size="${size}" font-family="sans-serif" text-anchor="${anchor}">${esc(s)}</text>`;

  const out: string[] = [];
  out.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(figureAltText(figure, lang))}">`);
  out.push(`<rect width="${w}" height="${h}" fill="#ffffff"/>`);
  for (const t of xs) out.push(`<line x1="${n(t.px)}" y1="0" x2="${n(t.px)}" y2="${h}" stroke="#e5e7eb"/>`);
  for (const t of ys) out.push(`<line x1="0" y1="${n(t.px)}" x2="${w}" y2="${n(t.px)}" stroke="#e5e7eb"/>`);
  if (axisX !== null) out.push(`<line x1="${n(axisX)}" y1="0" x2="${n(axisX)}" y2="${h}" stroke="#6b7280" stroke-width="1.5"/>`);
  if (axisY !== null) out.push(`<line x1="0" y1="${n(axisY)}" x2="${w}" y2="${n(axisY)}" stroke="#6b7280" stroke-width="1.5"/>`);
  const labelY = Math.min(h - 4, Math.max(14, (axisY ?? h) + 14));
  const labelX = Math.min(w - 28, Math.max(4, (axisX ?? 0) + 5));
  for (const t of xs) if (t.value !== 0) out.push(text({ x: t.px, y: labelY }, String(t.value), '#6b7280', 10, 'middle'));
  for (const t of ys) if (t.value !== 0) out.push(text({ x: labelX, y: t.px - 3 }, String(t.value), '#6b7280', 10));
  if (axisY !== null) out.push(text({ x: w - 14, y: axisY - 5 }, lang === 'ar' ? 'س' : 'x', '#374151'));
  if (axisX !== null) out.push(text({ x: axisX + 6, y: 14 }, lang === 'ar' ? 'ص' : 'y', '#374151'));

  for (const c of lay.curves) {
    for (const s of c.segments) {
      out.push(`<polyline points="${s.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="none" stroke="${color(c.colorIndex)}" stroke-width="2"/>`);
    }
    if (c.label && c.labelAt) out.push(text(c.labelAt, c.label, color(c.colorIndex)));
  }
  for (const p of lay.points) {
    out.push(`<circle cx="${n(p.at.x)}" cy="${n(p.at.y)}" r="4" fill="${color(p.colorIndex)}"/>`);
    out.push(text(p.labelAt, p.label, color(p.colorIndex)));
  }
  for (const c of lay.components) {
    out.push(`<line x1="${n(c.from.x)}" y1="${n(c.from.y)}" x2="${n(c.to.x)}" y2="${n(c.to.y)}" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3"/>`);
  }
  for (const a of lay.arrows) {
    out.push(`<line x1="${n(a.from.x)}" y1="${n(a.from.y)}" x2="${n(a.to.x)}" y2="${n(a.to.y)}" stroke="${color(a.colorIndex)}" stroke-width="2"/>`);
    out.push(`<polygon points="${a.head.map(p => `${n(p.x)},${n(p.y)}`).join(' ')}" fill="${color(a.colorIndex)}"/>`);
    if (a.label && a.labelAt) out.push(text(a.labelAt, a.label, color(a.colorIndex)));
  }
  out.push('</svg>');
  return out.join('');
}
```
Add `export * from './alt.ts'; export * from './svg.ts';` to `index.ts`.

- [ ] **Step 4: Run — expect PASS** (`pnpm --filter @workspace/figure run test` and `typecheck`).

- [ ] **Step 5: Commit**

```bash
git add lib/figure/src/alt.ts lib/figure/src/svg.ts lib/figure/src/index.ts lib/figure/src/__tests__/alt.test.ts lib/figure/src/__tests__/svg.test.ts
git commit -m "lib/figure: alt text and a standalone SVG writer"
```

### Task A6: `FigureView` and `QuestionVisual` (app)

**Files:**
- Create: `artifacts/mobile/components/ui/FigureView.tsx`, `artifacts/mobile/components/ui/QuestionVisual.tsx`, `artifacts/mobile/services/__tests__/figureView.test.ts`

**Interfaces:**
- Consumes: `layoutFigure`, `figureAltText`, `resolveFigure`, `Figure` (`@workspace/figure`); `toPx` (`@workspace/figure/viewport`); `PlaneGrid` (`@/components/math/PlaneGrid`, props `{ vp, degreeAxis?, lang, colors }`); `useColors`; `readableOn(hex, surface, min)` from `@/services/readableColor`; `TYPE` from `@/constants/theme`.
- Produces: `<FigureView figure: Figure lang: 'ar'|'en' />`; `questionVisualOf(body: Record<string, unknown>): Figure | null`; `<QuestionVisual body lang />`.

- [ ] **Step 1: Write the failing static test**

`artifacts/mobile/services/__tests__/figureView.test.ts`:
```ts
/**
 * What this guards. react-native-svg cannot load under bare `node --test`, so the
 * component is checked as source: it takes colours from `useColors()` (never the
 * global palette), makes curve colours readable on the card, and names itself to
 * screen readers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (rel: string) => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('FigureView draws from useColors, not palette, and is labelled', () => {
  const src = read('../../components/ui/FigureView.tsx');
  assert.match(src, /useColors\(\)/);
  assert.doesNotMatch(src, /import[^;]*\bpalette\b/);
  assert.match(src, /readableOn\(/);
  assert.match(src, /accessibilityLabel=\{figureAltText\(/);
  assert.match(src, /PlaneGrid/);
});

test('QuestionVisual re-validates what it is given', () => {
  const src = read('../../components/ui/QuestionVisual.tsx');
  assert.match(src, /resolveFigure\(body\['visual'\]\)/);
});
```

- [ ] **Step 2: Run — expect FAIL** (cannot read the files).
`cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureView.test.ts`

- [ ] **Step 3: Write the components**

`artifacts/mobile/components/ui/FigureView.tsx`:
```tsx
/**
 * A drawn figure (function graph or vectors) on a card, from a gated spec.
 *
 * The geometry is `layoutFigure` in lib/figure — the same numbers the review
 * script's SVG uses — and the backdrop is the Math Corner's `PlaneGrid`, so a
 * figure reads like the grapher. The plane is not mirrored in RTL (x grows to
 * the right in both languages); only the axis names and tick digits change.
 * Colour is never the only cue: every curve and vector carries its letter.
 */
import React, { useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg';
import { figureAltText, layoutFigure, type Figure } from '@workspace/figure';
import { toPx } from '@workspace/figure/viewport';
import { PlaneGrid } from '@/components/math/PlaneGrid';
import { TYPE } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';

const SERIES = ['#2563EB', '#DC2626', '#15803D'];
const HEIGHT = 240;

export function FigureView({ figure, lang }: { figure: Figure; lang: 'ar' | 'en' }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const layout = useMemo(() => (width > 0 ? layoutFigure(figure, { w: width, h: HEIGHT }) : null), [figure, width]);
  const series = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 3)), [colors.card]);
  const color = (i: number) => series[i % series.length]!;

  const origin = layout ? toPx(layout.viewport, 0, 0) : null;
  const axisName = { fontFamily: 'ReadexPro_500Medium', fontSize: TYPE.micro, fill: colors.foreground };

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={figureAltText(figure, lang)}
      style={{ marginTop: 12, height: HEIGHT, borderWidth: 1, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden' }}
    >
      {layout ? (
        <Svg width={width} height={HEIGHT}>
          <PlaneGrid vp={layout.viewport} lang={lang} colors={colors} />
          {origin && origin.y >= 0 && origin.y <= HEIGHT ? (
            <SvgText x={width - 14} y={origin.y - 5} {...axisName}>{lang === 'ar' ? 'س' : 'x'}</SvgText>
          ) : null}
          {origin && origin.x >= 0 && origin.x <= width ? (
            <SvgText x={origin.x + 6} y={14} {...axisName}>{lang === 'ar' ? 'ص' : 'y'}</SvgText>
          ) : null}
          {layout.curves.map((c, i) => (
            <React.Fragment key={`c${i}`}>
              {c.segments.map((s, j) => (
                <Polyline key={j} points={s.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={color(c.colorIndex)} strokeWidth={2} />
              ))}
              {c.label && c.labelAt ? <SvgText x={c.labelAt.x} y={c.labelAt.y} fill={color(c.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{c.label}</SvgText> : null}
            </React.Fragment>
          ))}
          {layout.components.map((c, i) => (
            <Line key={`d${i}`} x1={c.from.x} y1={c.from.y} x2={c.to.x} y2={c.to.y} stroke={colors.mutedForeground} strokeWidth={1.5} strokeDasharray="4 3" />
          ))}
          {layout.arrows.map((a, i) => (
            <React.Fragment key={`a${i}`}>
              <Line x1={a.from.x} y1={a.from.y} x2={a.to.x} y2={a.to.y} stroke={color(a.colorIndex)} strokeWidth={2} />
              <Polygon points={a.head.map(p => `${p.x},${p.y}`).join(' ')} fill={color(a.colorIndex)} />
              {a.label && a.labelAt ? <SvgText x={a.labelAt.x} y={a.labelAt.y} fill={color(a.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{a.label}</SvgText> : null}
            </React.Fragment>
          ))}
          {layout.points.map((p, i) => (
            <React.Fragment key={`p${i}`}>
              <Circle cx={p.at.x} cy={p.at.y} r={4} fill={color(p.colorIndex)} />
              <SvgText x={p.labelAt.x} y={p.labelAt.y} fill={color(p.colorIndex)} fontSize={13} fontFamily="ReadexPro_600SemiBold">{p.label}</SvgText>
            </React.Fragment>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
```

`artifacts/mobile/components/ui/QuestionVisual.tsx`:
```tsx
/**
 * The drawing an exam question carries (`body.visual`). The server already
 * re-gates it before a student receives it; this gates again, because the
 * teacher's screen reads the stored body directly.
 */
import React from 'react';
import { resolveFigure, type Figure } from '@workspace/figure';
import { FigureView } from './FigureView';

export function questionVisualOf(body: Record<string, unknown>): Figure | null {
  return resolveFigure(body['visual']);
}

export function QuestionVisual({ body, lang }: { body: Record<string, unknown>; lang: 'ar' | 'en' }) {
  const figure = questionVisualOf(body);
  return figure ? <FigureView figure={figure} lang={lang} /> : null;
}
```

- [ ] **Step 4: Run — expect PASS; then typecheck**

```bash
cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/figureView.test.ts
cd /home/user/Iqraa && pnpm --filter @workspace/mobile run typecheck
```
If `TYPE.micro` or `colors.mutedForeground` do not exist under those names, use the exact tokens `PlaneGrid.tsx` itself uses (it uses `TYPE.micro` and `colors.mutedForeground`, so they do).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/ui/FigureView.tsx artifacts/mobile/components/ui/QuestionVisual.tsx artifacts/mobile/services/__tests__/figureView.test.ts
git commit -m "FigureView: draws a gated figure on a card"
```

### Task A7: Close PR 1

**Files:** Modify `docs/status-log.md` (top), `STATUS.md`.

- [ ] **Step 1: Run every check**

```bash
cd /home/user/Iqraa
pnpm run typecheck
pnpm --filter @workspace/figure run test
pnpm --filter @workspace/api-server run build && pnpm --filter @workspace/api-server run test
pnpm --filter @workspace/mobile run test
pnpm --filter @workspace/exam-paper run test && pnpm --filter @workspace/math-verify run test
```
Expected: all green. Note the test counts for the log.

- [ ] **Step 2: Look at it once.** Write a throwaway script outside the repo that imports `figureSvg` and writes four files (a parabola with a point, `1/x`, `tan(x)`, two vectors with components) to the scratchpad; open them (e.g. with the Playwright browser or by reading the PNG a Chromium screenshot produces) and check by eye: curves not flattened, branches split at asymptotes, arrows point the right way, labels not clipped. Record what you saw in the log entry. Do not commit the script or the files.

- [ ] **Step 3: Write the log entry and STATUS line.** Add at the **top** of `docs/status-log.md` an entry titled `## lib/figure: a shared gate and geometry for drawn graphs and vectors — <date>` stating: what was built (package contents, the two moves and that both old files re-export), what was verified (the commands above with counts; the by-eye look), what was not (no screen yet draws a figure — PRs 2 and 3), and the limits (two kinds; maths only; asymptote splitting is a heuristic). In `STATUS.md` under *Open*, add one line: `- <date> — Drawn figures: the shared package is merged (PR 1 of 3); exams and student lessons follow (spec docs/superpowers/specs/2026-11-03-drawn-figures-design.md)`.

- [ ] **Step 4: Commit, push, open the draft PR**

```bash
git add docs/status-log.md STATUS.md
git commit -m "Log: lib/figure"
git push -u origin claude/nifty-bell-uepuh2
```
Open a **draft** PR titled `lib/figure: shared gate and geometry for drawn graphs and vectors (1 of 3)`; body: what/why in two sentences, the verification list, "no user-visible change, so no «ما الجديد» entry", and that PRs 2 and 3 depend on it. Subscribe to the PR; fix CI. When it is merged: `git fetch origin main && git checkout -B claude/nifty-bell-uepuh2 origin/main`.

---

# PR 2 — Exams

### Task B1: `questionVisual.ts` — the student gate and the edit rule

**Files:**
- Create: `artifacts/api-server/src/modules/assessment/questionVisual.ts`, `artifacts/api-server/src/modules/assessment/__tests__/questionVisual.test.ts`

**Interfaces:**
- Consumes: `resolveFigure`, `Figure` from `@workspace/figure`.
- Produces:
  - `studentVisual(body: Record<string, unknown>): Figure | null`
  - `bodyAfterEdit(existing: { body: unknown; expectedAnswer: unknown }, next: { body: unknown; expectedAnswer: unknown }): Record<string, unknown>` — returns the body to store: the next body with any client-sent `visual` removed, and the **existing** (re-gated) visual put back only if neither the body (ignoring `visual` and `figure`) nor the expected answer changed.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bodyAfterEdit, studentVisual } from "../questionVisual.ts";

const visual = { kind: "vectors", vectors: [{ from: [0, 0], to: [3, 2], label: "u" }] };
const base = { stem: "ما طول المتجه u = ⟨3, 2⟩؟", options: [{ id: "a", text: "√13" }] };

describe("studentVisual", () => {
  it("passes a gated figure, normalised", () => {
    assert.deepEqual(studentVisual({ visual: { ...visual, junk: 1 } }), visual);
  });
  it("refuses anything else", () => {
    for (const v of [undefined, null, 7, { kind: "vectors", vectors: [] }, { ...visual, vectors: [{ from: [0, 0], to: [3, 2], label: "x=3" }] }]) {
      assert.equal(studentVisual({ visual: v }), null, JSON.stringify(v));
    }
    assert.equal(studentVisual({}), null);
  });
});

describe("bodyAfterEdit", () => {
  const existing = { body: { ...base, visual }, expectedAnswer: { optionIds: ["a"] } };

  it("keeps the drawing when nothing the student reads changed (marks, objective, rubric edits)", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, visual }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
  });

  it("takes the drawing from the stored question, never from the client", () => {
    const forged = { kind: "vectors", vectors: [{ from: [0, 0], to: [9, 9], label: "w" }] };
    const out = bodyAfterEdit(existing, { body: { ...base, visual: forged }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
  });

  it("drops it when the text changes", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, stem: "ما طول u؟", visual }, expectedAnswer: { optionIds: ["a"] } });
    assert.equal("visual" in out, false);
  });

  it("drops it when the key changes", () => {
    const out = bodyAfterEdit(existing, { body: { ...base, visual }, expectedAnswer: { optionIds: ["b"] } });
    assert.equal("visual" in out, false);
  });

  it("does not let a client add a drawing to a question that had none", () => {
    const out = bodyAfterEdit({ body: base, expectedAnswer: {} }, { body: { ...base, visual }, expectedAnswer: {} });
    assert.equal("visual" in out, false);
  });

  it("ignores the book figure and key order when deciding whether the text changed", () => {
    const fig = { uri: "u", caption: "c" };
    const out = bodyAfterEdit(existing, { body: { visual, figure: fig, options: base.options, stem: base.stem }, expectedAnswer: { optionIds: ["a"] } });
    assert.deepEqual(out["visual"], visual);
    assert.deepEqual(out["figure"], fig);
  });

  it("drops a stored drawing that no longer passes the gate", () => {
    const bad = { body: { ...base, visual: { kind: "pie" } }, expectedAnswer: {} };
    const out = bodyAfterEdit(bad, { body: { ...base, visual: { kind: "pie" } }, expectedAnswer: {} });
    assert.equal("visual" in out, false);
  });
});
```

- [ ] **Step 2: Run — expect FAIL.** `cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/questionVisual.test.ts` → module not found.

- [ ] **Step 3: Write `questionVisual.ts`**

```ts
/**
 * A drawing an exam question carries (`body.visual`), as a student may receive
 * it, and what an edit does to it.
 *
 * A question body is stored as-is, so the check lives at the point every
 * student-facing question passes (`studentView.ts`), beside `studentFigure`:
 * only a figure the gate accepts is sent. The drawing was made for one wording
 * and one key, so an edit to either removes it (the same precedent as a
 * worksheet's working, `worksheetEdits.ts`) — a drawing that may no longer
 * match is worse than none. It is also never taken from the client: it is put
 * back from the stored question or not at all.
 */
import { resolveFigure, type Figure } from "@workspace/figure";

type Rec = Record<string, unknown>;
const asRec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

export function studentVisual(body: Rec): Figure | null {
  return resolveFigure(body["visual"]);
}

/** JSON with sorted keys, so two bodies that differ only in key order are equal. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object") {
    const rec = value as Rec;
    return `{${Object.keys(rec).sort().map(k => `${JSON.stringify(k)}:${canonical(rec[k])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

const text = (body: Rec): Rec => {
  const { visual: _visual, figure: _figure, ...rest } = body;
  return rest;
};

export function bodyAfterEdit(
  existing: { body: unknown; expectedAnswer: unknown },
  next: { body: unknown; expectedAnswer: unknown },
): Rec {
  const oldBody = asRec(existing.body);
  const { visual: _clientVisual, ...nextBody } = asRec(next.body);
  const unchanged =
    canonical(text(oldBody)) === canonical(text(nextBody)) &&
    canonical(existing.expectedAnswer ?? {}) === canonical(next.expectedAnswer ?? {});
  const kept = unchanged ? resolveFigure(oldBody["visual"]) : null;
  return kept ? { ...nextBody, visual: kept } : nextBody;
}
```

- [ ] **Step 4: Run — expect PASS.** Same command, then `pnpm --filter @workspace/api-server run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/modules/assessment/questionVisual.ts artifacts/api-server/src/modules/assessment/__tests__/questionVisual.test.ts
git commit -m "exams: the student gate and the edit rule for a question's drawing"
```

### Task B2: The student's copy carries a checked drawing

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/studentView.ts` (the block at the `studentFigure(source)` call, ~lines 183–185 and the import at line 24)
- Test: `artifacts/api-server/src/modules/assessment/__tests__/questionFigure.test.ts` (append a describe)

**Interfaces:** Consumes `studentVisual` (B1). Produces: `sanitizeQuestionForStudent(q, attemptId).body["visual"]` is the gated figure or absent.

- [ ] **Step 1: Append the failing test** to `questionFigure.test.ts`:
```ts
describe("the student projection carries a checked drawing", () => {
  const vis = { kind: "vectors", vectors: [{ from: [0, 0], to: [3, 2], label: "u" }] };
  const q = (visual: unknown) => ({
    id: "q1", orderIndex: 0, type: "true_false", marks: "1",
    body: { statement: "س", visual },
  });

  it("keeps a figure the gate accepts", () => {
    assert.deepEqual(sanitizeQuestionForStudent(q(vis), "a1").body["visual"], vis);
  });

  it("drops one that is over a limit or of an unknown kind", () => {
    const tooBig = { kind: "vectors", vectors: [{ from: [0, 0], to: [13, 1] }] };
    for (const v of [tooBig, { kind: "pie" }, "x"]) {
      assert.equal(sanitizeQuestionForStudent(q(v), "a1").body["visual"], undefined);
    }
  });

  it("adds nothing to a question without one", () => {
    assert.ok(!("visual" in sanitizeQuestionForStudent(q(undefined), "a1").body));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`visual` is undefined for the accepted case; the allowlist drops it).

- [ ] **Step 3: Implement.** In `studentView.ts` add `import { studentVisual } from "./questionVisual.ts";` beside the `studentFigure` import, and directly after the `if (figure) body["figure"] = figure;` line add:
```ts
  // Same door: a drawing the gate accepts, or nothing (see questionVisual.ts).
  const visual = studentVisual(source);
  if (visual) body["visual"] = visual;
```

- [ ] **Step 4: Run — expect PASS** (`node --experimental-strip-types --test src/modules/assessment/__tests__/questionFigure.test.ts src/modules/assessment/__tests__/studentView.test.ts` from `artifacts/api-server`). The existing `studentView.test.ts` "no answer key survives anywhere in the string" test must still pass.

- [ ] **Step 5: Commit** `git add` the two files; message `exams: a student's question carries a checked drawing`.

### Task B3: Editing a question removes its drawing

**Files:** Modify `artifacts/api-server/src/routes/evaluations.ts` (the PATCH handler, the block that sets `patch["body"] = nextBody;`, ~line 1649).

**Interfaces:** Consumes `bodyAfterEdit` (B1).

- [ ] **Step 1:** There is no unit seam in the route; the rule is covered by B1's tests and the route test below. Add to `artifacts/api-server/src/routes/__tests__/evaluationQuestionEditRace.db.test.ts` (it needs the database harness; it is skipped without one and runs in CI's database job) a case in the existing `describeDb` block, after the "adds, edits and removes a question" control test, following that test's own helpers (`edit`, the seeded draft). The case: set a question's `body.visual` directly with `db.pool.query("UPDATE evaluation_questions SET body = body || $1::jsonb WHERE id = $2", [JSON.stringify({ visual }), qid])`; then PATCH `{ marks: 5 }` and read the row back → `visual` still present; then PATCH `{ body: { ...body, stem: "غيّرت النص" } }` → `visual` absent. Use the file's own `edit(id, qid, patch)` helper and its row-reading helper; read them first (`sed -n 150,200p`) and mirror their call shapes exactly.

- [ ] **Step 2: Run it against a database** if one is configured (`DATABASE_URL`/the repo's test DB setup per `LOCAL_SETUP.md`); otherwise state in the PR that CI's database job is what runs it. Expected before the implementation: the second assertion FAILS (`visual` still present).

- [ ] **Step 3: Implement.** Add `import { bodyAfterEdit } from "../modules/assessment/questionVisual.ts";` with the other `modules/assessment` imports, and replace the line `patch["body"] = nextBody;` with:
```ts
            // A drawing is put back from the stored question only if nothing the
            // student reads has changed (modules/assessment/questionVisual.ts).
            patch["body"] = bodyAfterEdit(
              { body: existing.body, expectedAnswer: existing.expectedAnswer },
              { body: nextBody, expectedAnswer: nextAnswer },
            );
```
`validate` above still runs on `nextBody` unchanged.

- [ ] **Step 4: Run** `pnpm --filter @workspace/api-server run typecheck` and the unit suites; the database case if available.

- [ ] **Step 5: Commit** (`routes/evaluations.ts` + the test); message `exams: editing a question removes its drawing`.

### Task B4: Shared prompt text for drawings

**Files:**
- Create: `artifacts/api-server/src/lib/figurePrompt.ts`, `artifacts/api-server/src/lib/__tests__/figurePrompt.test.ts`

**Interfaces:**
- Consumes: `FIGURE_LIMITS` from `@workspace/figure`.
- Produces: `figureFormatEn(): string`, `figureFormatAr(): string` — the two kinds, their limits, the label rule and two examples, with every number read from `FIGURE_LIMITS`.

- [ ] **Step 1: Write the failing test**
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIGURE_LIMITS, resolveFigure } from "@workspace/figure";
import { figureFormatAr, figureFormatEn } from "../figurePrompt.ts";

describe("figure prompt text", () => {
  for (const [lang, text] of [["en", figureFormatEn()], ["ar", figureFormatAr()]] as const) {
    it(`${lang}: names both kinds and prints the limits from the gate`, () => {
      assert.ok(text.includes('"function-graph"') && text.includes('"vectors"'));
      for (const n of [FIGURE_LIMITS.maxFunctions, FIGURE_LIMITS.maxPoints, FIGURE_LIMITS.maxVectors, FIGURE_LIMITS.maxExprChars, FIGURE_LIMITS.maxXWidth, FIGURE_LIMITS.maxCoord]) {
        assert.ok(text.includes(String(n)), `${lang}: ${n}`);
      }
    });
    it(`${lang}: its examples pass the gate`, () => {
      const examples = text.split("\n").filter(l => l.startsWith('{"kind"'));
      assert.equal(examples.length, 2);
      for (const e of examples) assert.ok(resolveFigure(JSON.parse(e)), e);
    });
  }
});
```

- [ ] **Step 2: Run — expect FAIL** (module not found).

- [ ] **Step 3: Write `figurePrompt.ts`**
```ts
/**
 * The drawing format, as the exam and lesson prompts describe it to the model.
 * Every number comes from `FIGURE_LIMITS`, so the prompt cannot drift from the
 * gate; the examples are tested against the gate.
 */
import { FIGURE_LIMITS as L } from "@workspace/figure";

const EXAMPLES = [
  '{"kind":"function-graph","functions":[{"expr":"x^2 - 4","label":"f"}],"x":[-3,3],"points":[{"at":2,"label":"A"}]}',
  '{"kind":"vectors","vectors":[{"from":[0,0],"to":[3,2],"label":"u"},{"from":[0,0],"to":[-1,2.5],"label":"v"}],"components":true}',
];

export function figureFormatEn(): string {
  return [
    "A drawing is one of two kinds. Anything outside these limits is dropped and the text stands alone:",
    `- "function-graph": {"kind","functions":[{"expr","label"}] (1 to ${L.maxFunctions}; expr is Latin, in x, using + - * / ^ ( ) and sin/cos/tan in radians, at most ${L.maxExprChars} characters), "x":[from,to] (width at most ${L.maxXWidth}), optional "y":[from,to], optional "points":[{"at": an x value,"label"}] (at most ${L.maxPoints}; the point is placed on the curve, you give only x)}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (1 to ${L.maxVectors}; every coordinate a multiple of 0.5 with absolute value at most ${L.maxCoord}), optional "components": true (dashed horizontal and vertical parts)}.`,
    "A label is 1 to 3 letters, optionally followed by one digit or a prime (A, u, f, v1, B'). Never put a value, coordinates or an equation in a label: the drawing is shown to the student and must not give the answer away.",
    "Examples:",
    ...EXAMPLES,
  ].join("\n");
}

export function figureFormatAr(): string {
  return [
    "الرسم من نوعين، وما يتجاوز هذه الحدود يُحذف فيبقى النص وحده:",
    `- "function-graph": {"kind","functions":[{"expr","label"}] (من 1 إلى ${L.maxFunctions}؛ expr بالأحرف اللاتينية بدلالة x وتستعمل + - * / ^ ( ) و sin/cos/tan بالراديان، بحدٍّ أقصى ${L.maxExprChars} حرفًا)، "x":[من,إلى] (العرض ${L.maxXWidth} على الأكثر)، و"y":[من,إلى] اختياري، و"points":[{"at": قيمة x,"label"}] اختياري (حتى ${L.maxPoints}؛ تُوضع النقطة على المنحنى وأنت تعطي x فقط)}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (من 1 إلى ${L.maxVectors}؛ كل إحداثي من مضاعفات 0.5 وقيمته المطلقة ${L.maxCoord} على الأكثر)، و"components": true اختياري (الجزآن الأفقي والرأسي بخط متقطع)}.`,
    "الوسم من 1 إلى 3 أحرف، يليه رقم واحد أو شرطة عليا اختيارًا (A، u، f، v1، B'). لا تكتب في الوسم قيمةً أو إحداثيات أو معادلة: الرسم يُعرض على الطالب ويجب ألّا يكشف الإجابة.",
    "أمثلة:",
    ...EXAMPLES,
  ].join("\n");
}
```

- [ ] **Step 4: Run — expect PASS** (`node --experimental-strip-types --test src/lib/__tests__/figurePrompt.test.ts` from `artifacts/api-server`) and typecheck.

- [ ] **Step 5: Commit** both files; message `prompts: one description of the drawing format, read from the gate`.

### Task B5: The exam generator accepts, gates and ties a drawing

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/llmGenerator.ts`
- Create: `artifacts/api-server/src/modules/assessment/__tests__/llmGeneratorVisual.test.ts`
- Modify: `artifacts/api-server/src/modules/assessment/__tests__/llmGeneratorPromptPin.test.ts` (version string, header note)

**Interfaces:**
- Consumes: `resolveFigure`, `figureConsistentWith` (`@workspace/figure`); `figureFormatEn()` (B4); existing `paperIsMathematics`, `parseAnswerKeyCheck`.
- Produces: `parseGeneratedQuestions(...)` now also returns `visualsDropped: { index: number; reason: string }[]` and sets `question.body.visual` for accepted drawings; `GENERATION_PROMPT_VERSION = "exam-gen-8"`; the maths system prompt gains rule 9 and the user prompt gains a `"visual"` field description.

- [ ] **Step 1: Write the failing tests**

`llmGeneratorVisual.test.ts` — reuse the fixtures pattern from `llmGenerator.test.ts` (copy its `objective`/`subjectObjective`/`META` helpers; `subjectObjective("obj-1", "mathematics")` makes a maths paper):
```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildGenerationPrompt, parseGeneratedQuestions, type LlmGenerationRequest } from "../llmGenerator.ts";
import type { CurriculumObjective } from "@workspace/curriculum";

function objective(id: string, subjectId?: string): CurriculumObjective {
  return {
    id, description: `Objective ${id}`, descriptionAr: `نتاج ${id}`,
    effectiveBloomsLevel: "Apply", inferredBloomsLevel: null, bloomsSource: "authored",
    lessonTitle: "Lesson", lessonTitleAr: "الدرس", ...(subjectId ? { subjectId } : {}),
  } as unknown as CurriculumObjective;
}
const req = (subjectId?: string): LlmGenerationRequest => ({
  objectives: [objective("obj-1", subjectId)],
  assessmentTypes: ["multiple_choice"],
  count: 1, difficulty: "standard", language: "ar",
});
const META = { model: "test-model" };
const graph = { kind: "function-graph", functions: [{ expr: "x^2 - 4", label: "f" }], x: [-3, 3] };
const mcq = (extra: Record<string, unknown> = {}) => ({
  questions: [{
    type: "multiple_choice", objectiveId: "obj-1", competencyKey: "application", marks: 2, skill: "graphs",
    body: { stem: "ما جذرا الاقتران f(س) = س² − ٤؟", multiSelect: false, options: [{ id: "a", text: "±٢" }, { id: "b", text: "٤" }] },
    expectedAnswer: { optionIds: ["a"] },
    ...extra,
  }],
});

describe("a question's drawing", () => {
  it("is kept, gated, in body.visual on a maths paper", () => {
    const out = parseGeneratedQuestions(mcq({ visual: { ...graph, junk: 1 } }), req("mathematics"), META);
    assert.deepEqual(out.questions[0]!.body["visual"], graph);
    assert.deepEqual(out.visualsDropped, []);
  });

  it("is dropped, with a reason, when the gate refuses it — the question stays", () => {
    const out = parseGeneratedQuestions(mcq({ visual: { kind: "pie" } }), req("mathematics"), META);
    assert.equal(out.questions.length, 1);
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.equal(out.visualsDropped.length, 1);
  });

  it("is not accepted on a paper that is not maths", () => {
    const out = parseGeneratedQuestions(mcq({ visual: graph }), req("chemistry"), META);
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.equal(out.visualsDropped.length, 1);
  });

  it("is never taken from inside body", () => {
    const q = mcq();
    (q.questions[0]!.body as Record<string, unknown>)["visual"] = graph;
    const out = parseGeneratedQuestions(q, req("mathematics"), META);
    assert.equal("visual" in out.questions[0]!.body, false);
  });

  it("is dropped when the checked function is a different one", () => {
    const check = { topic: "derivative_polynomial", question: "x^3 - 4x", answer: "3x^2 - 4" };
    const out = parseGeneratedQuestions(mcq({ visual: graph, check }), req("mathematics"), META);
    assert.equal("visual" in out.questions[0]!.body, false);
    assert.match(out.visualsDropped[0]!.reason, /check/);
  });

  it("is kept when the checked function is the drawn one", () => {
    const check = { topic: "derivative_polynomial", question: "x^2 - 4", answer: "2x" };
    const out = parseGeneratedQuestions(mcq({ visual: graph, check }), req("mathematics"), META);
    assert.deepEqual(out.questions[0]!.body["visual"], graph);
  });
});

describe("the prompt", () => {
  const { system, user } = buildGenerationPrompt(req("mathematics"));
  const plain = buildGenerationPrompt(req("chemistry"));

  it("offers a drawing on a maths paper, with the stem-is-sufficient rule", () => {
    assert.match(system, /ONE drawing/);
    assert.match(system, /answerable without it/);
    assert.ok(user.includes('"visual"') && user.includes('"function-graph"') && user.includes('"vectors"'));
  });

  it("does not mention drawings on other papers", () => {
    assert.ok(!plain.system.includes("ONE drawing") && !plain.user.includes('"function-graph"'));
  });

  it("keeps rule 7 about book figures word for word", () => {
    assert.ok(system.includes("Never name or number a specific one"));
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`visualsDropped` undefined; prompt lacks the rule).

- [ ] **Step 3: Implement** in `llmGenerator.ts`:
  1. `export const GENERATION_PROMPT_VERSION = "exam-gen-8";`
  2. Imports: `import { figureConsistentWith, resolveFigure } from "@workspace/figure";` and `import { figureFormatEn } from "../../lib/figurePrompt.ts";` (check the relative depth: `modules/assessment` → `../../lib`).
  3. In `buildGenerationPrompt`, inside the existing `...(isMaths ? [ "8. …" ] : [])` spread of the **system** rules, append a second string to that array:
```ts
        "9. A question may carry ONE drawing, in a question-level \"visual\" field (a sibling of \"check\", never inside \"body\"), when it is about a graph or a vector. "
          + "The stem must state everything the question needs — write the function out, give the vectors' components — so the drawing only illustrates and the question is answerable without it. "
          + "The drawing is yours, so the stem may say «في الرسم المرافق»; never name a textbook figure (rule 7 still holds).",
```
  4. In the **user** prompt, in the maths-only part (reuse the same `isMaths` condition used around line 413 for the check topics block), add after the `check` documentation:
```ts
      ...(isMaths ? ["", 'Optionally, for a question about a graph or a vector, include "visual" (see rule 9):', figureFormatEn()] : []),
```
  (Place it so the array order is: check block, then this block, then the existing `variationBlock(...)`.)
  5. In `ParseResult` add `visualsDropped: { index: number; reason: string }[];`. In `parseGeneratedQuestions` add `const visualsDropped: { index: number; reason: string }[] = [];` beside `discarded`, `const maths = paperIsMathematics(req.objectives);` before the loop, and after `const check = parseAnswerKeyCheck(q["check"]);` insert:
```ts
    // The model's only door for a drawing is the question-level field; a
    // `visual` it tucked inside `body` is removed either way.
    const { visual: _inBody, ...bodyRest } = body;
    let visual: ReturnType<typeof resolveFigure> = null;
    if (q["visual"] !== undefined && q["visual"] !== null) {
      if (!maths) {
        visualsDropped.push({ index, reason: "drawings are offered on maths papers only" });
      } else {
        visual = resolveFigure(q["visual"]);
        if (!visual) visualsDropped.push({ index, reason: "the drawing is outside the limits" });
        else if (!figureConsistentWith(visual, check?.question)) {
          visualsDropped.push({ index, reason: "the drawn function differs from the check" });
          visual = null;
        }
      }
    }
```
  and in the `questions.push({ ... })` change `body,` to `body: visual ? { ...bodyRest, visual } : bodyRest,`. Return `{ questions, discarded, visualsDropped }`. In `LlmGenerationResult` nothing changes (it extends `ParseResult`).
  6. Fix any other place that builds a `ParseResult`/`LlmGenerationResult` literal: `grep -rn "discarded" artifacts/api-server/src --include=*.ts | grep -v __tests__` — the only constructors are in this file.

- [ ] **Step 4: Run** `node --experimental-strip-types --test src/modules/assessment/__tests__/llmGeneratorVisual.test.ts src/modules/assessment/__tests__/llmGenerator.test.ts src/modules/assessment/__tests__/llmGeneratorPromptPin.test.ts` from `artifacts/api-server`. If the two `check` tests fail because `parseAnswerKeyCheck` rejects the fixture check (it returns `null` for a topic/question it does not accept, and then no tie is applied), replace the fixture with a topic/question pair taken from `lib/math-verify/src/__tests__` that it does accept, keeping the shape "a function-style `check.question` that equals / differs from the drawn expression". The pin test will fail on the version string `exam-gen-7`: update its expectation to `exam-gen-8` and add one line to its header comment (`Edited by hand, 2026-11-03, for rule 9 only (exam-gen-8): the model may attach one drawing; rules 1–8 are unchanged`). Every other pinned rule text must still pass untouched — if one fails, the rule was edited by accident; revert that edit.

- [ ] **Step 5: Log what the model does.** Find where the route consumes the result (`grep -n "generateWithModel(" artifacts/api-server/src/routes/*.ts`) and, next to the existing log of the generation, add `logger.info({ proposed: <number of questions whose raw item had a visual>, kept: <questions with body.visual>, dropped: result.visualsDropped }, "exam visuals")`. Compute `kept` from `result.questions.filter(q => q.body["visual"]).length` and `dropped` as `result.visualsDropped.length`; `proposed = kept + dropped`. This is the only way we will see how a live model uses the field.

- [ ] **Step 6: Commit** (all touched files); message `exams: the generator may attach a gated drawing to a maths question`.

### Task B6: The two exam screens draw it

**Files:**
- Modify: `artifacts/mobile/app/evaluations/[id]/index.tsx` (~line 799), `artifacts/mobile/app/take/[code].tsx` (~lines 666–668 and 838)

**Interfaces:** Consumes `QuestionVisual` (A6).

- [ ] **Step 1: Failing test.** Append to `artifacts/mobile/services/__tests__/figureView.test.ts`:
```ts
test('both exam screens draw a question’s drawing, and the take screen skips the book-figure hint for it', () => {
  const take = read('../../app/take/[code].tsx');
  const teacher = read('../../app/evaluations/[id]/index.tsx');
  assert.match(take, /<QuestionVisual body=\{body\} lang=\{lang\} \/>/);
  assert.match(teacher, /<QuestionVisual body=\{q\.body\} lang=\{lang\} \/>/);
  assert.match(take, /!question\.body\['visual'\]/);
});
```
Run → FAIL.

- [ ] **Step 2: Implement.**
  - `evaluations/[id]/index.tsx`: add `import { QuestionVisual } from '@/components/ui/QuestionVisual';` after the `QuestionFigure` import (line 50) and, directly under the `<QuestionFigure body={q.body} … />` line, add `<QuestionVisual body={q.body} lang={lang} />`.
  - `take/[code].tsx`: add the same import after line 72; under `<QuestionFigure body={body} … />` (line 838) add `<QuestionVisual body={body} lang={lang} />`; and change the `examFigures` condition at line 666 from `question && !question.body['figure'] && questionRefersToFigure(question.body)` to `question && !question.body['figure'] && !question.body['visual'] && questionRefersToFigure(question.body)` — a question with its own drawing does not also get the lesson's book-figure panel just because its stem says «الرسم».

- [ ] **Step 3: Run** the figureView test (PASS), `pnpm --filter @workspace/mobile run typecheck`.

- [ ] **Step 4: Commit** (the two screens + the test); message `exams: both screens draw a question's drawing`.

### Task B7: «ما الجديد» entry, then look at it for real

**Files:** Modify `artifacts/mobile/services/whatsNew.ts`, `artifacts/mobile/services/i18n.ts` (both the Arabic and English tables).

- [ ] **Step 1: Add the entry** at the top of `WHATS_NEW` (after the opening `[`), dated **the day this PR merges** (a later day stays hidden until it comes):
```ts
  {
    id: 'exam-drawn-figures',
    date: '2026-11-0X', // set to the merge day before merging
    roles: ['teacher'],
    titleKey: 'whatsNewDrawnFiguresTitle',
    bodyKey: 'whatsNewDrawnFiguresBody',
    route: '/evaluations',
  },
```
and in `i18n.ts` add next to the `whatsNewExamsTitle` keys (Arabic table ~line 3162, English ~6756):
```ts
    whatsNewDrawnFiguresTitle: 'رسوم بيانية ومتجهات في أسئلة الاختبار',
    whatsNewDrawnFiguresBody: 'صار سؤال الرياضيات في الاختبار يحمل رسمًا حين يلزم: منحنى اقتران أو متجهات على المستوى الإحداثي. يراه الطالب مع السؤال وتراه أنت قبل النشر. إن عدّلتَ نص السؤال أو مفتاحه يُحذف الرسم حتى لا يخالف ما كتبتَ.',
```
```ts
    whatsNewDrawnFiguresTitle: 'Graphs and vectors in exam questions',
    whatsNewDrawnFiguresBody: 'A maths question in an exam now carries a drawing when it needs one: a function graph or vectors on the coordinate plane. Students see it with the question and you see it before publishing. If you edit a question’s text or key, its drawing is removed so it never disagrees with what you wrote.',
```
Replace `2026-11-0X` with the real merge date before the final push (the entry must not stay hidden by a later date).

- [ ] **Step 2: Run** `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts` from `artifacts/mobile` (checks the keys exist in both languages, the date and that `/evaluations` is a real screen a teacher may open). Expected PASS.

- [ ] **Step 3: See it.** Follow `LOCAL_SETUP.md`: a throwaway Postgres, `pnpm --filter @workspace/db run migrate -- --from-env`, API with `AI_LIVE_MODE=false` on :8080, `pnpm run dev:mobile:web`. Register a throwaway teacher (the API logs the 6-digit code), create an evaluation, generate it (the mock writes the paper), then plant a drawing on a question with SQL (never against production): `UPDATE evaluation_questions SET body = body || '{"visual": {"kind":"function-graph","functions":[{"expr":"x^2 - 4","label":"f"}],"x":[-3,3],"points":[{"at":2,"label":"A"}]}}'::jsonb WHERE id = '<qid>';`. With Playwright (the browser pane never fires `animationend`; use Playwright, not that pane) open the evaluation as the teacher, then publish and open `/take/<code>`; screenshots at 390×844 and 1280×800, Arabic and English, light and dark. Look for: the curve and the point «A» present; digits not scrambled; the figure not clipped; text legible on the card in dark mode; no figure on a question without one. Repeat with a `vectors` spec. Record in the log what you saw and what you changed because of it.

- [ ] **Step 4: Commit** `whatsNew.ts`, `i18n.ts`; message `«ما الجديد»: drawn figures in exam questions`.

### Task B8: Close PR 2

- [ ] **Step 1: Run every check** (same list as A7 Step 1, plus `pnpm --filter @workspace/api-server run test` must include the new suites). Note counts.
- [ ] **Step 2: Write the log entry** at the top of `docs/status-log.md`: `## Exam questions can carry a drawn graph or vector — <date>`: what was built (gate at generation and at the student door, the edit rule, prompt `exam-gen-8` rule 9, the two screens, the entry), what was verified (commands with counts; the screenshots from B7; the DB test ran in CI or locally — say which), what was **not** (a live model has never filled `visual`: the first live run is the test, watch the `exam visuals` log line; the DB case if it only ran in CI), known limits (maths only; edit drops the drawing; the `check` tie only compares function checks that compile; quizzes/worksheets unchanged). Edit `STATUS.md`'s drawn-figures Open line to `PR 2 of 3 merged: exams`.
- [ ] **Step 3: Commit, push, draft PR** titled `Exam questions can carry a drawn graph or vector (2 of 3)`; body per the log plus: no migration, no native change, deploys the API and the web bundle. Subscribe; fix CI. After merge: `git fetch origin main && git checkout -B claude/nifty-bell-uepuh2 origin/main`.

---

# PR 3 — Student lessons

### Task C1: Cards carry a gated drawing

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (the `LessonTeachingOutput` interface, ~lines 793–808), `artifacts/mobile/services/lessonExplanationCards.ts`
- Test: `artifacts/mobile/services/__tests__/lessonExplanationCards.test.ts` (append)

**Interfaces:**
- Consumes: `resolveFigure`, `Figure` (`@workspace/figure`).
- Produces: `ExplanationCard` concept/example variants gain `visual?: Figure`; `LessonTeachingOutput.concepts[].visual?: unknown` and `workedExample.visual?: unknown`.

- [ ] **Step 1: Append failing tests**
```ts
const vec = { kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }] };

test('a concept and a worked example carry a drawing the gate accepts', () => {
  const cards = buildExplanationCards({
    ...full,
    concepts: [{ title: 'المتجه له مقدار واتجاه', points: ['u = ⟨3, 2⟩'], visual: { ...vec, junk: 1 } }],
    workedExample: { ...full.workedExample, visual: vec },
  } as never);
  assert.deepEqual((cards.find(c => c.kind === 'concept') as { visual?: unknown }).visual, vec);
  assert.deepEqual((cards.find(c => c.kind === 'example') as { visual?: unknown }).visual, vec);
});

test('a drawing the gate refuses is dropped alone — the card keeps its words', () => {
  const bad = { kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'x=3' }] };
  const cards = buildExplanationCards({ ...full, concepts: [{ title: 'ت', points: ['نقطة'], visual: bad }] } as never);
  const concept = cards.find(c => c.kind === 'concept')!;
  assert.equal('visual' in concept, false);
  assert.deepEqual((concept as { points: string[] }).points, ['نقطة']);
});

test('a card with no drawing is unchanged', () => {
  const [, first] = buildExplanationCards(full);
  assert.equal('visual' in first!, false);
});

test('a hostile value does not throw', () => {
  for (const visual of [null, 7, 'x', [], { kind: 'vectors', vectors: 5 }, { get kind(): string { throw new Error('boom'); } }]) {
    assert.doesNotThrow(() => buildExplanationCards({ ...full, concepts: [{ title: 'ت', points: ['ن'], visual }] } as never));
  }
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** In `AIService.ts` add `/** A drawing (graph or vectors); gated by `resolveFigure` where it is used. */ visual?: unknown;` to the `concepts` item type and to `workedExample`. In `lessonExplanationCards.ts`: `import { resolveFigure, type Figure } from '@workspace/figure';`; widen the two card kinds (`| { kind: 'concept'; …; visual?: Figure } | { kind: 'example'; …; visual?: Figure }`); add
```ts
/** Cards are built in render with no boundary above them, so a hostile stored value must not throw. */
function drawing(raw: unknown): { visual: Figure } | Record<string, never> {
  try {
    const visual = resolveFigure(raw);
    return visual ? { visual } : {};
  } catch {
    return {};
  }
}
```
and spread `...drawing(concept.visual)` into the concept card and `...drawing(example?.visual)` into the example card (after their existing fields).

- [ ] **Step 3: Run** `node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/lessonExplanationCards.test.ts` (PASS, including the old tests) and typecheck.

- [ ] **Step 4: Commit**; message `lessons: student cards carry a gated drawing`.

### Task C2: The lesson screen draws it

**Files:** Modify `artifacts/mobile/app/curriculum/lesson-explanation.tsx` (the `renderCard` cases, ~lines 165–195); append to `figureView.test.ts`.

- [ ] **Step 1: Failing test** (append):
```ts
test('the student lesson screen draws a card’s drawing', () => {
  const src = read('../../app/curriculum/lesson-explanation.tsx');
  assert.match(src, /import \{ FigureView \} from '@\/components\/ui\/FigureView'/);
  assert.equal((src.match(/<FigureView figure=\{c\.visual\} lang=\{lang\} \/>/g) ?? []).length, 2);
});
```
Run → FAIL.

- [ ] **Step 2: Implement.** Add the import. In the `concept` case, after `{c.points.map(…)}` add `{c.visual ? <FigureView figure={c.visual} lang={lang} /> : null}`; in the `example` case, after the steps map and before the answer line add the same line. (`lang` is already destructured from `useLanguage()` on line 47.)

- [ ] **Step 3: Run** the test (PASS) and typecheck. **Step 4: Commit**; message `lessons: the explanation screen draws a card's drawing`.

### Task C3: The lesson prompt may ask for one

**Files:**
- Modify: `artifacts/api-server/src/lib/lessonTeachingPrompt.ts`, `artifacts/api-server/src/lib/generationKey.ts`
- Test: `artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts` (append)

**Interfaces:**
- Consumes: `figureFormatAr/En` (B4); `isMathContext(topic, null, subject)` from `@workspace/math-practice`.
- Produces: rule 16 in both prompts on maths lessons only; `teachingVisualCounts(content)` gains `visual: number`; `LESSON_VISUALS_MAX = 2`.

- [ ] **Step 1: Failing tests** (append to the existing file; it already imports the builders and `teachingVisualCounts`):
```ts
describe("lesson-teaching drawings", () => {
  const MATH = { ...BODY, subject: "Mathematics", topic: "المتجهات في المستوى" };
  for (const [lang, build, needle] of [["ar", lessonTeachingPromptAr, "رسم بياني أو متجهات"], ["en", lessonTeachingPromptEn, "graph or vectors"]] as const) {
    it(`${lang}: a maths lesson may ask for a drawing, told to write everything in the words`, () => {
      const p = build(MATH);
      assert.ok(p.includes(needle), needle);
      assert.ok(p.includes('"visual"') && p.includes('"function-graph"') && p.includes('"vectors"'));
    });
    it(`${lang}: a chemistry lesson is not offered one`, () => {
      const p = build(BODY);
      assert.ok(!p.includes(needle) && !p.includes('"function-graph"'));
    });
  }

  it("counts drawings on concepts and on the worked example", () => {
    const counts = teachingVisualCounts({
      concepts: [{ visual: { kind: "vectors" } }, {}, { visual: { kind: "function-graph" } }],
      workedExample: { visual: { kind: "vectors" } },
    });
    assert.equal(counts.visual, 3);
  });
});
```
Also update the existing `teachingVisualCounts` assertions in this file that `deepEqual` the whole result: add `visual: 0` (or the right number) to each expected object. Run → FAIL.

- [ ] **Step 2: Implement** in `lessonTeachingPrompt.ts`: `import { isMathContext } from "@workspace/math-practice";` and `import { figureFormatAr, figureFormatEn } from "./figurePrompt.ts";`; `export const LESSON_VISUALS_MAX = 2;`. Extend `teachingVisualCounts`:
```ts
export function teachingVisualCounts(content: unknown): { concepts: number; shape: number; icon: number; chart: number; photo: number; visual: number } {
  // …existing body unchanged up to `has`…
  const example = content !== null && typeof content === "object" ? (content as { workedExample?: unknown }).workedExample : undefined;
  const exampleVisual = example !== null && typeof example === "object" && (example as Record<string, unknown>)["visual"] ? 1 : 0;
  return { concepts: list.length, shape: has("shape"), icon: has("icon"), chart: has("chart"), photo: has("photo"), visual: has("visual") + exampleVisual };
}
```
In each prompt builder, after rule 15's block and before `Return only JSON in this shape:`, insert (Arabic builder shown; English analogue below) a conditional section:
```ts
${isMathContext(b.topic, null, b.subject) ? `16. رسم بياني أو متجهات (لدروس الرياضيات فقط): يجوز أن يحمل "concept" أو "workedExample" حقلًا اختياريًّا واحدًا اسمه "visual"، وبحدٍّ أقصى ${LESSON_VISUALS_MAX} في القسم كله. اكتب في "points" أو "problem" كل ما يحتاجه الطالب (الاقتران مكتوبًا أو مركّبات المتجه): الرسم يوضّح ولا يحمل المعلومة وحده.
${figureFormatAr()}
` : ''}
```
English:
```ts
${isMathContext(b.topic, null, b.subject) ? `16. A graph or vectors (maths lessons only): a "concept" or the "workedExample" may carry one optional "visual", at most ${LESSON_VISUALS_MAX} in the whole section. Write everything the student needs in "points" or "problem" (the function written out, the vector's components): the drawing illustrates and never carries the information alone.
${figureFormatEn()}
` : ''}
```
Add `"visual"` to the **route's** log call if it spreads `teachingVisualCounts` (it logs the object under "lesson-teaching visuals" — nothing to change if it logs the whole object). In `generationKey.ts` move `"lesson-teaching"` to a new version: `<merge date>.1` if the merge date is after 2026-11-03, else `"2026-11-03.2"`; update `generationKey.test.ts` expectations if it pins the string (`grep -n "2026-11-03.1" artifacts/api-server/src -r`).

- [ ] **Step 3: Run** `node --experimental-strip-types --test src/lib/__tests__/lessonTeachingPrompt.test.ts src/lib/__tests__/generationKey.test.ts src/lib/__tests__/lessonTeachingChecks.test.ts` from `artifacts/api-server`; all existing prompt pins must still pass untouched (rules 1–15 are not edited).

- [ ] **Step 4: Commit**; message `lessons: the explanation prompt may ask a maths lesson for a drawing`.

### Task C4: The admin sees the drawing before approving

**Files:**
- Modify: `artifacts/mobile/scripts/pregenerate.ts`
- Test: the existing pregenerate test file (`ls artifacts/mobile/services/__tests__ | grep -i pregen`); append there.

**Interfaces:**
- Consumes: `resolveFigure`, `figureSvg`, `figureAltText` (`@workspace/figure`).
- Produces: `export function reviewFigures(entry: ReviewEntry): { name: string; svg: string; alt: string }[]` — one per drawing the cards would draw (concept drawings in order, then the example's), `name` = `<lessonId>-<n>.svg`; and `--approve` refuses an entry whose drawings have no file beside the review file.

- [ ] **Step 1: Failing tests**
```ts
import { reviewFigures, type ReviewEntry } from '../../scripts/pregenerate.ts';

const entry = (content: unknown): ReviewEntry => ({ variantId: 'v', lessonId: 'L1', lesson: 'درس', contentHash: 'h', content });

test('reviewFigures yields one SVG per drawing the student would see, in card order', () => {
  const vis = { kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }] };
  const out = reviewFigures(entry({
    concepts: [{ title: 'أ', points: ['ن'], visual: vis }, { title: 'ب', points: ['ن'] }],
    workedExample: { problem: 'م', steps: ['خ'], answer: '2', visual: vis },
  }));
  assert.deepEqual(out.map(f => f.name), ['L1-1.svg', 'L1-2.svg']);
  assert.ok(out[0]!.svg.startsWith('<svg ') && out[0]!.alt.length > 0);
});

test('reviewFigures ignores a drawing the gate refuses and a section with none', () => {
  assert.deepEqual(reviewFigures(entry({ concepts: [{ title: 'أ', points: ['ن'], visual: { kind: 'pie' } }] })), []);
  assert.deepEqual(reviewFigures(entry({})), []);
  assert.deepEqual(reviewFigures(entry(null)), []);
});
```
Run → FAIL (export missing). (If pregenerate.ts cannot be imported in tests because of top-level side effects, note that the existing test already imports `plannedCalls`/`reviewEntry` from it, so it can.)

- [ ] **Step 2: Implement.** Add `import { figureAltText, figureSvg, resolveFigure } from '@workspace/figure';` and `import { basename, dirname, join } from 'node:path';` (add `mkdirSync` to the existing `node:fs` import), then:
```ts
/** The drawings a student would see in this explanation, as files an admin can open. */
export function reviewFigures(entry: ReviewEntry): { name: string; svg: string; alt: string }[] {
  const c = entry.content as { concepts?: unknown; workedExample?: unknown } | null;
  if (!c || typeof c !== 'object') return [];
  const raws: unknown[] = [
    ...(Array.isArray(c.concepts) ? c.concepts.map(x => (x as { visual?: unknown } | null)?.visual) : []),
    (c.workedExample as { visual?: unknown } | null | undefined)?.visual,
  ];
  const out: { name: string; svg: string; alt: string }[] = [];
  for (const raw of raws) {
    const figure = resolveFigure(raw);
    if (figure) out.push({ name: `${entry.lessonId}-${out.length + 1}.svg`, svg: figureSvg(figure, { lang: 'ar' }), alt: figureAltText(figure, 'ar') });
  }
  return out;
}

/** `pregen-review.json` → `pregen-review-figures/`, beside it. */
const figuresDirFor = (reviewFile: string) => join(dirname(reviewFile), `${basename(reviewFile, '.json')}-figures`);
```
In `main()`, right after `writeFileSync(reviewPath, JSON.stringify(review, null, 2));` add:
```ts
        const figures = reviewFigures(entry);
        if (figures.length > 0) {
          const dir = figuresDirFor(reviewPath);
          mkdirSync(dir, { recursive: true });
          for (const f of figures) writeFileSync(join(dir, f.name), f.svg);
          console.log(`  ${figures.length} drawing(s) to look at in ${dir}: ${c.lesson}`);
        }
```
In `approve(file)`, immediately before `let approved = 0;` (confirm it is unique: `grep -c "let approved = 0;" artifacts/mobile/scripts/pregenerate.ts` → 1), add:
```ts
  const unseen = entries.filter(e => reviewFigures(e).some(f => !existsSync(join(figuresDirFor(file), f.name))));
  if (unseen.length > 0) {
    throw new Error(`${unseen.length} entr${unseen.length === 1 ? 'y' : 'ies'} in ${file} ${unseen.length === 1 ? 'has' : 'have'} a drawing with no file in ${figuresDirFor(file)} (${titles(unseen)}): the drawings were not written for you to look at (regenerate the review file). Nothing was approved.`);
  }
```
Use the variable that `approve` already holds for the parsed entries (read the function's first lines: it is the array produced by the `malformed`/`edited` checks; name it exactly as there). Also extend the script's header comment (step 2 of its usage list) with one sentence: drawings are written as SVG files beside the review file; open them before approving.

- [ ] **Step 3: Run** the pregenerate test file (PASS) and `pnpm --filter @workspace/mobile run typecheck`. Add one test that `--approve`'s guard fires: call the exported pure helper if the guard is factored out; if `approve` is not unit-testable (it posts to the API), factor the filter into `export function entriesMissingFigures(entries: ReviewEntry[], reviewFile: string, exists = existsSync): ReviewEntry[]` and test it with a stub `exists`.

- [ ] **Step 4: Commit**; message `lessons: an admin gets the drawings as files before approving`.

### Task C5: «ما الجديد» (students), look at it, close PR 3

**Files:** `artifacts/mobile/services/whatsNew.ts`, `services/i18n.ts`; `docs/status-log.md`, `STATUS.md`.

- [ ] **Step 1: Entry.** Add `{ id: 'lesson-drawn-figures', date: '<merge day>', roles: ['student'], titleKey: 'whatsNewLessonFiguresTitle', bodyKey: 'whatsNewLessonFiguresBody', route: '/curriculum' }` — first confirm a route a student may open that shows lessons: `grep -n "route: '/" artifacts/mobile/services/whatsNew.ts` and `ls artifacts/mobile/app/curriculum`; use the route that `whatsNew.test.ts`'s "real screen each role may open" accepts for `student` (run the test; if `/curriculum` is refused, use the student route the test accepts for the lessons list, or omit `route`, which the type allows). Add Arabic and English strings (Arabic: «صارت شروح الدروس تعرض رسمًا حين يلزم: منحنى أو متجهات على المستوى الإحداثي، ويأتي الرسم مع الشرح المكتوب لا بدلًا منه.» English: "Lesson explanations now show a drawing where it helps: a graph or vectors on the coordinate plane, alongside the written explanation, never instead of it.").
- [ ] **Step 2: Run** `whatsNew.test.ts` (PASS).
- [ ] **Step 3: See it.** As in B7: local stack, a throwaway student account linked through a class code, an `ai_artifacts` lesson-teaching row with `student_approved_at` set and a concept carrying a `visual` (plant it with SQL in the throwaway database only), open `/curriculum/lesson-explanation` for that lesson at phone and desktop widths, Arabic and English, light and dark. Look for the same list as B7, and that the card still reads without the drawing (hide it in devtools and read the words).
- [ ] **Step 4: Run every check** (A7 Step 1 list). **Step 5: Log entry** at the top of `docs/status-log.md`: `## Student lesson cards can show a drawn graph or vectors — <date>`: built (card field and gate, the screen, prompt rule 16 on maths lessons, the `lesson-teaching` pool version moved to `<version>`, review files with SVGs and the approve guard, the entry); verified (counts, screenshots); **not** verified (a live model has never filled `visual` in a lesson; the first `pregenerate` run on maths lessons is the test, read its SVGs; `pregenerate.ts` needs re-running to fill the pool — a cost to state with the number of maths lessons × the per-call estimate in the script); limits (approved explanations stay drawing-free until regenerated and approved; teacher decks do not draw `visual`; maths only). Update `STATUS.md`: replace the drawn-figures Open line with `shipped` wording or remove it, and fix any line this makes untrue (the 2026-10-31 slides entry's «Students still see no drawing» belongs to the log, not STATUS).
- [ ] **Step 6: Commit, push, draft PR** `Student lesson cards can show a drawn graph or vectors (3 of 3)`; body states the pool consequence (each maths lesson's first teacher after the merge pays for a new teaching section; the 55 approved student explanations keep being served without drawings), no migration, no native change. Subscribe; fix CI.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| §1 package `lib/figure`, sampler moved, `resolveFigure`, `figureAltText` | A1–A3, A5 |
| §1 gate limits table, label rule, 1.5 KB cap | A3 (tests enumerate every row) |
| §1 honest scale (vectors equal scale; asymptote drop) | A4 |
| §2 geometry once, `FigureView` with `PlaneGrid`, RTL not mirrored, alt text, one renderer, no native change | A4, A6, A1 (no version bump) |
| §3 generation: `visual` schema, maths only, refusal counted, rule 9 / rule 7 intact, stem-sufficient rule | B4, B5 |
| §3 tie to `check`; no badge | B5 (`figureConsistentWith`, tests); no code touches `verified` |
| §3 storage + `studentVisual` re-gate | B1, B2 |
| §3 editing drops the drawing, server-side | B1, B3 |
| §3 screens; book-figure hint skipped | B6 |
| §4 types, prompt rule (maths only, ≤ 2), cards gate, screen | C1–C3 |
| §4 pool version bump; `pregenerate` re-run | C3, C5 |
| §4 review hole (admin sees the drawing) | C4 |
| §6 three PRs | A7, B8, C5 |
| §7 verification (package, API, mobile, on-screen) | tests in each task; B7/C5 on-screen; A7 by-eye |
| «ما الجديد» | B7, C5 |

**Spec correction found while planning:** the spec (§4) said `usableTeaching` would run the gate. It is the *deck's* builder and the deck does not draw `visual` in v1, so it is untouched; the student cards are built by `buildExplanationCards` (C1), which is where the gate sits. Also the spec's "log refusal counts in the generation notes" is implemented as `visualsDropped` + the `exam visuals` log line (B5), not in teacher-facing `notes`, which a teacher reads.

**Placeholder scan:** the only deliberate fill-ins are results that cannot exist yet (merge date, test counts, screenshot observations, the pool version string), each with the rule for choosing it.

**Type consistency:** `Figure`, `FunctionGraph`, `VectorsFigure` (A3) are used unchanged in A4–A6, B1, B5, C1, C4. `resolveFigure(raw: unknown): Figure | null` everywhere. `layoutFigure(figure, { w, h })` returns `FigureLayout` with `curves/points/arrows/components/viewport` (A4) as consumed in A5 and A6. `studentVisual`/`bodyAfterEdit` (B1) as used in B2/B3. `figureFormatEn/Ar` (B4) as used in B5/C3. `visualsDropped` (B5). `reviewFigures`/`figuresDirFor` (C4).
