# Exam-paper core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One list of question types and one set of repeat-rule inputs, shared by the quiz and evaluation code, with no change to any paper a teacher or student receives.

**Architecture:** A new pure-TypeScript workspace package `lib/exam-paper` owns `EXAM_TYPE_ORDER`, the derived `QUIZ_TYPE_ORDER`, `inPaperOrder`, and the three repeat-rule inputs (`MAX_WORDS_CHANGED`, `hasSentence`, `sameAsk`). The five existing sites import from it and keep their current export names, so nothing else needs editing. Before touching any code, a baseline of repeat-detection output over every lesson's offline papers is captured; after, it is compared byte for byte.

**Tech Stack:** TypeScript, pnpm workspaces, `node:test` with `--experimental-strip-types`, esbuild (API), Metro/Expo (app).

**Spec:** `docs/superpowers/specs/2026-10-18-exam-paper-core-design.md`. Read it first: decision 3 (the two grouping algorithms are NOT unified) is the one most likely to be undone by accident.

## Global Constraints

- No behaviour change: same papers, same prompts, same stored rows. The prompt version stays `exam-gen-7`.
- `QUIZ_TYPES` is exactly `['multiple_choice', 'true_false', 'fill_blank', 'short_answer']`, in that order. `normalizeQuiz` silently drops any type not in it.
- `kindOf` (`generationShape.ts`) and `dominantKind` (`validator.ts`) keep their own grouping and their own quotas (a third replaces, a quarter warns). Only their inputs move.
- Every moved export keeps its current export name at its current path (`paperOrder.ts`, `generationShape.ts`, `examBlocks.ts`, `quizPaper.ts`).
- Files loaded by bare `node --test` need explicit `.ts` extensions on relative imports (CLAUDE.md, "Extensionless relative imports only work through esbuild").
- A package with tests that CI does not run is unguarded: `ci.yml` must run the new package's tests.
- `lib/exam-paper` has exactly one dependency, `@workspace/math-practice` (for `sameKind`).
- Commit messages end with the two attribution lines the session specifies. Never rewrite history; merge `main` rather than rebase.
- Work happens on branch `ccr-c53b65db-2szi4w`. Spec PR #1146 is open on it; this plan's PR carries the spec and the plan together unless #1146 has merged first.

---

## File Structure

| Path | Responsibility |
|---|---|
| `lib/exam-paper/package.json`, `tsconfig.json` | the package, laid out like `lib/math-practice` |
| `lib/exam-paper/src/index.ts` | the whole public API: ordering and the repeat-rule inputs |
| `lib/exam-paper/src/__tests__/index.test.ts` | what the package must keep true |
| `artifacts/api-server/src/modules/assessment/paperOrder.ts` | now only re-exports from the package, with its doc comment |
| `artifacts/api-server/src/lib/generationShape.ts` | imports the package; `kindOf` uses `hasSentence`/`sameAsk` |
| `artifacts/api-server/src/modules/assessment/validator.ts` | `dominantKind` uses `hasSentence`/`sameAsk` |
| `artifacts/mobile/services/examBlocks.ts`, `quizPaper.ts` | re-export the package's lists |
| `artifacts/api-server/src/modules/assessment/__tests__/paperOrder.test.ts` | the regex drift test becomes a "no local copy" guard |
| scratchpad (not committed) | baseline harness: `corpus.mts`, `digest.mts` |

---

### Task 1: Capture the baseline (no repository changes)

**Why first:** the before/after comparison is only meaningful if the "before" is taken from unmodified code. Do this on a clean checkout of `main`, before Task 2.

**Files:**
- Create (scratchpad, **not committed**): `$SCRATCH/corpus.mts`, `$SCRATCH/digest.mts`
- Output: `$SCRATCH/corpus.json`, `$SCRATCH/digest-before.json`

`$SCRATCH` is the session scratchpad directory. Write its full absolute path out when using it.

**Interfaces:**
- Produces: `corpus.json` (an array of `{ lessonId: string; n: number; stems: string[] }`) and `digest-before.json` (consumed by Task 5).

- [ ] **Step 1: Confirm a clean tree on `main`'s code**

```bash
cd /home/user/Iqraa && git status --short && git log --oneline -1
pnpm install --frozen-lockfile
```
Expected: no output from `git status --short`. If the tree is dirty, stash or stop; the baseline must be the old code.

- [ ] **Step 2: Write the corpus generator**

`$SCRATCH/corpus.mts`: every lesson's offline quiz at two sizes, from a seeded `Math.random` so it can be regenerated. It calls the private `quizOnce` to skip the mock's 1–2 s artificial delay.

```ts
import { writeFileSync } from 'node:fs';
import { KB_LESSONS } from '/home/user/Iqraa/artifacts/mobile/services/knowledgeBase.ts';
import { resolveLessonPrepContext } from '/home/user/Iqraa/artifacts/mobile/services/lessonPrep.ts';
import { MockAIService } from '/home/user/Iqraa/artifacts/mobile/services/ai/generators.ts';

// mulberry32: a small seeded PRNG, so the corpus is reproducible.
let a = 0x9e3779b9;
Math.random = () => {
  a = (a + 0x6d2b79f5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const svc = new MockAIService() as unknown as { quizOnce(req: object): Promise<{ questions: { text: string }[] }> };
const out: { lessonId: string; n: number; stems: string[] }[] = [];
let skipped = 0;
for (const lesson of KB_LESSONS) {
  const ctx = resolveLessonPrepContext(lesson.id, 'ar');
  if (!ctx) { skipped += 1; continue; }
  for (const n of [10, 20]) {
    try {
      const quiz = await svc.quizOnce({
        topic: ctx.topic, subject: ctx.subjectLabel, grade: ctx.gradeName, lessonId: lesson.id,
        language: 'arabic', totalMarks: 20, duration: 20, difficulty: 'medium',
        numQuestions: n, questionTypes: ['multiple_choice', 'true_false', 'short_answer'],
      });
      out.push({ lessonId: lesson.id, n, stems: quiz.questions.map(q => q.text) });
    } catch { skipped += 1; }
  }
}
writeFileSync(process.argv[2]!, JSON.stringify(out));
console.log(`papers: ${out.length}, stems: ${out.reduce((s, p) => s + p.stems.length, 0)}, skipped: ${skipped}`);
```

- [ ] **Step 3: Write the digest script**

`$SCRATCH/digest.mts`: runs both rules over the corpus, plus a hand-made set that is **guaranteed** to contain repeats, so the comparison cannot pass vacuously.

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import { quizRepeats } from '/home/user/Iqraa/artifacts/api-server/src/lib/generationShape.ts';
import { dominantKind } from '/home/user/Iqraa/artifacts/api-server/src/modules/assessment/validator.ts';

type Paper = { lessonId: string; n: number; stems: string[] };
const corpus: Paper[] = JSON.parse(readFileSync(process.argv[2]!, 'utf8'));

// Papers that repeat on purpose: one ask reworded, one ask with new numbers, a symbol-only stem.
const molar = (c: string) => `أوجد الكتلة المولية لـ ${c} علما أن الكتل الذرية معطاة في الجدول`;
const SYNTHETIC: Paper[] = [
  { lessonId: 'synthetic-molar', n: 9, stems: ['O₂', 'Na₂CO₃', 'CaCO₃', 'H₂O', 'NaCl', 'KOH', 'HCl', 'CO₂', 'NH₃'].map(molar) },
  { lessonId: 'synthetic-order', n: 9, stems: Array.from({ length: 9 }, (_, i) => (i % 2 ? 'ما العدد الأكبر بين الأعداد الآتية' : 'ما العدد الأصغر بين الأعداد الآتية')) },
  { lessonId: 'synthetic-symbols', n: 6, stems: ['٣ + ٤ = ؟', '٥ + ٢ = ؟', '٦ + ١ = ؟', 'ما هو الجذر التربيعي للعدد ١٦', 'اذكر خاصية الإبدال', 'عرّف المتوسط الحسابي'] },
  { lessonId: 'synthetic-varied', n: 6, stems: ['ما هو الجذر التربيعي للعدد ١٦', 'اذكر خاصية الإبدال', 'عرّف المتوسط الحسابي', 'قارن بين الكسرين', 'اشرح مفهوم الاحتمال', 'ما الفرق بين المجموعتين'] },
];

const rows = [...corpus, ...SYNTHETIC].map(p => ({
  lessonId: p.lessonId,
  n: p.n,
  repeats: quizRepeats({ questions: p.stems.map(text => ({ text })) }, p.n),
  dominant: dominantKind(p.stems.slice(0, 15)),
}));
writeFileSync(process.argv[3]!, JSON.stringify(rows, null, 1));
const withRepeats = rows.filter(r => r.repeats.length).length;
const withDominant = rows.filter(r => r.dominant).length;
console.log(`rows: ${rows.length}, with quiz repeats: ${withRepeats}, with a dominant kind: ${withDominant}`);
if (!withRepeats || !withDominant) { console.error('comparison would be vacuous'); process.exit(1); }
```

- [ ] **Step 4: Generate the corpus and the baseline digest**

```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types $SCRATCH/corpus.mts $SCRATCH/corpus.json
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types $SCRATCH/digest.mts $SCRATCH/corpus.json $SCRATCH/digest-before.json
```
Expected: the first prints `papers: <hundreds>, stems: <thousands>, skipped: <some>`; the second prints `rows: ..., with quiz repeats: >0, with a dominant kind: >0` and exits 0. If it exits 1, the comparison is vacuous: fix the synthetic papers before going on.

- [ ] **Step 5: Prove the corpus is reproducible**

```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types $SCRATCH/corpus.mts $SCRATCH/corpus-again.json
cmp $SCRATCH/corpus.json $SCRATCH/corpus-again.json && echo "corpus is reproducible"
```
Expected: `corpus is reproducible`. If not, something else in the generator is non-deterministic; `corpus.json` is still the single file both runs read, so it remains valid, but note it.

No commit: nothing in the repository changed.

---

### Task 2: The `lib/exam-paper` package

**Files:**
- Create: `lib/exam-paper/package.json`, `lib/exam-paper/tsconfig.json`, `lib/exam-paper/src/index.ts`, `lib/exam-paper/src/__tests__/index.test.ts`
- Modify: `tsconfig.json` (root, add a reference), `artifacts/api-server/package.json`, `artifacts/mobile/package.json` (add the dependency), `.github/workflows/ci.yml` (add a test step), `pnpm-lock.yaml` (via `pnpm install`)

**Interfaces:**
- Produces (consumed by Tasks 3 and 4):
  - `EXAM_TYPE_ORDER: readonly string[]`
  - `QUIZ_TYPES: readonly ['multiple_choice', 'true_false', 'fill_blank', 'short_answer']`
  - `type QuizType = (typeof QUIZ_TYPES)[number]`
  - `QUIZ_TYPE_ORDER: readonly QuizType[]`
  - `inPaperOrder<T>(items: readonly T[], typeOf: (item: T) => string): T[]`
  - `MAX_WORDS_CHANGED: 3`
  - `hasSentence(frame: string): boolean`
  - `sameAsk(frameA: string, frameB: string): boolean`

- [ ] **Step 1: Create the package skeleton**

`lib/exam-paper/package.json`:

```json
{
  "name": "@workspace/exam-paper",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  },
  "scripts": {
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "node --experimental-strip-types --test \"src/**/__tests__/**/*.test.ts\""
  },
  "dependencies": {
    "@workspace/math-practice": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "catalog:"
  }
}
```

`lib/exam-paper/tsconfig.json`:

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
    "types": [
      "node"
    ]
  },
  "include": [
    "src/**/*.ts"
  ],
  "references": [
    {
      "path": "../math-practice"
    }
  ]
}
```

- [ ] **Step 2: Register it in the workspace**

In root `tsconfig.json`, add `{ "path": "./lib/exam-paper" }` to `references`, right after the `./lib/math-practice` entry. In `artifacts/api-server/package.json` and `artifacts/mobile/package.json`, add `"@workspace/exam-paper": "workspace:*"` to `dependencies`, directly above the existing `"@workspace/math-practice": "workspace:*"` line. Then:

```bash
cd /home/user/Iqraa && pnpm install
```
Expected: succeeds and updates `pnpm-lock.yaml`; `ls lib/exam-paper/node_modules/@workspace` lists `math-practice`.

- [ ] **Step 3: Write the failing tests**

`lib/exam-paper/src/__tests__/index.test.ts`:

```ts
/**
 * What this guards: the one list of question types, and the inputs of the
 * repeat rule, which the quiz (`generationShape.ts`) and the evaluation
 * validator (`validator.ts`) both build on.
 *
 * The quiz list is pinned as a literal on purpose. `normalizeQuiz` silently
 * drops any question whose type is not in it, so a wrong list would lose
 * questions without an error anywhere.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { sameKind } from '@workspace/math-practice';
import {
  EXAM_TYPE_ORDER,
  MAX_WORDS_CHANGED,
  QUIZ_TYPES,
  QUIZ_TYPE_ORDER,
  hasSentence,
  inPaperOrder,
  sameAsk,
} from '../index.ts';

describe('the type lists', () => {
  it('keeps the exam order exactly as the ministry paper has it', () => {
    assert.deepEqual([...EXAM_TYPE_ORDER], [
      'multiple_choice', 'true_false', 'matching', 'fill_blank',
      'short_answer', 'open_ended', 'problem_solving', 'practical_task',
      'read_aloud', 'dictation',
    ]);
  });

  it('has no type twice', () => {
    assert.equal(new Set(EXAM_TYPE_ORDER).size, EXAM_TYPE_ORDER.length);
  });

  it('pins the quiz types to the four it has always had', () => {
    assert.deepEqual([...QUIZ_TYPES], ['multiple_choice', 'true_false', 'fill_blank', 'short_answer']);
  });

  it('derives the quiz order from the exam order, so the two cannot disagree', () => {
    assert.deepEqual([...QUIZ_TYPE_ORDER], EXAM_TYPE_ORDER.filter(t => (QUIZ_TYPES as readonly string[]).includes(t)));
    assert.deepEqual([...QUIZ_TYPE_ORDER], ['multiple_choice', 'true_false', 'fill_blank', 'short_answer']);
  });

  it('only offers a quiz type that is also an exam type', () => {
    for (const t of QUIZ_TYPES) assert.ok(EXAM_TYPE_ORDER.includes(t), `${t} is not an exam type`);
  });
});

describe('inPaperOrder', () => {
  const q = (id: string, type: string) => ({ id, type });
  const ids = (xs: { id: string }[]) => xs.map(x => x.id).join(',');

  it('groups a mixed paper into ministry blocks', () => {
    const paper = [q('a', 'short_answer'), q('b', 'multiple_choice'), q('c', 'fill_blank'), q('d', 'true_false')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), 'b,d,c,a');
  });

  it('is stable inside a type, so the generator\'s own sequence survives', () => {
    const paper = [q('1', 'true_false'), q('2', 'multiple_choice'), q('3', 'true_false'), q('4', 'multiple_choice')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), '2,4,1,3');
  });

  it('sorts a type it does not know last, not first', () => {
    const paper = [q('x', 'mystery'), q('a', 'dictation'), q('b', 'multiple_choice')];
    assert.equal(ids(inPaperOrder(paper, x => x.type)), 'b,a,x');
  });

  it('does not touch its input', () => {
    const paper = [q('a', 'short_answer'), q('b', 'multiple_choice')];
    inPaperOrder(paper, x => x.type);
    assert.equal(ids(paper), 'a,b');
  });
});

describe('the repeat rule\'s inputs', () => {
  const words = (n: number, changed: number) => {
    const base = Array.from({ length: n }, (_, i) => `w${i}`);
    const other = base.map((w, i) => (i < changed ? `x${i}` : w));
    return [base.join(' '), other.join(' ')] as const;
  };

  it('caps the words a reworded ask may change at three', () => {
    assert.equal(MAX_WORDS_CHANGED, 3);
  });

  it('calls two identical frames one ask', () => {
    assert.equal(sameAsk('ما العدد الأكبر', 'ما العدد الأكبر'), true);
  });

  it('allows three changed words in a long stem and no more', () => {
    // 30 words: the 37% allowance is 11, so only the cap of 3 decides.
    const [a3, b3] = words(30, 3);
    const [a4, b4] = words(30, 4);
    assert.equal(sameAsk(a3, b3), true);
    assert.equal(sameAsk(a4, b4), false);
    // The cap is what makes this different from `sameKind` uncapped.
    assert.equal(sameKind(a4, b4), true);
  });

  it('agrees with sameKind at the cap on every pair of a small corpus', () => {
    const frames = ['ما العدد الأكبر بين', 'ما العدد الأصغر بين', 'أوجد الكتلة المولية لـ', 'عرّف المتوسط', '# + # = ؟'];
    for (const x of frames) for (const y of frames) {
      assert.equal(sameAsk(x, y), sameKind(x, y, 3), `${x} / ${y}`);
    }
  });

  it('says a stem has a sentence only when it has a letter', () => {
    assert.equal(hasSentence('ما العدد الأكبر'), true);
    assert.equal(hasSentence('what is'), true);
    assert.equal(hasSentence('# + # = ؟'), false);
    assert.equal(hasSentence(''), false);
  });
});
```

- [ ] **Step 4: Run it to see it fail**

```bash
cd /home/user/Iqraa && pnpm --filter @workspace/exam-paper run test
```
Expected: FAIL: `Cannot find module '.../src/index.ts'` (the file does not exist yet).

- [ ] **Step 5: Write the implementation**

`lib/exam-paper/src/index.ts`:

```ts
/**
 * What a question paper has in common, whichever generator made it.
 *
 * The quiz (`/ai-tools/quiz`, a paper that stores nothing) and evaluations
 * (rows, a share link, marks) are two systems and stay two. They do share
 * these, which used to be copied by hand: the order a ministry paper puts its
 * question types in, and the inputs of the "one ask reworded" rule. Both the
 * API and the app import them, which is why they live in `lib/`.
 *
 * Not here, on purpose: the two ways of *grouping* repeats (`kindOf` in
 * `generationShape.ts` replaces past a third; `dominantKind` in `validator.ts`
 * warns past a quarter) and anything about prompts. See the spec,
 * `docs/superpowers/specs/2026-10-18-exam-paper-core-design.md`, decision 3.
 */
import { sameKind } from '@workspace/math-practice';

/**
 * The order a ministry exam puts its question types in: choice, then صح/خطأ,
 * matching, complete, then the written answers, then the practical. A type
 * this list does not know sorts last, not first (`inPaperOrder`).
 */
export const EXAM_TYPE_ORDER: readonly string[] = [
  'multiple_choice', 'true_false', 'matching', 'fill_blank',
  'short_answer', 'open_ended', 'problem_solving', 'practical_task',
  'read_aloud', 'dictation',
];

/**
 * The types a quiz can hold. `normalizeQuiz` drops any question whose type is
 * not one of these, so changing this list changes what a quiz keeps.
 */
export const QUIZ_TYPES = ['multiple_choice', 'true_false', 'fill_blank', 'short_answer'] as const;
export type QuizType = (typeof QUIZ_TYPES)[number];

/** The quiz's order: the exam order, restricted to the quiz's types. */
export const QUIZ_TYPE_ORDER: readonly QuizType[] = EXAM_TYPE_ORDER.filter(
  (t): t is QuizType => (QUIZ_TYPES as readonly string[]).includes(t),
);

/** Rank of a type; a type this list does not know sorts last rather than first. */
function rank(type: string): number {
  const i = EXAM_TYPE_ORDER.indexOf(type);
  return i === -1 ? EXAM_TYPE_ORDER.length : i;
}

/**
 * A new array grouped into ministry blocks; the input is not touched. Stable
 * within a type, so the generator's own sequence (and which questions a surplus
 * trim dropped) is untouched.
 */
export function inPaperOrder<T>(items: readonly T[], typeOf: (item: T) => string): T[] {
  return items
    .map((item, i) => ({ item, i, r: rank(typeOf(item)) }))
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map(x => x.item);
}

/**
 * Words a reworded ask may change, whatever its length. A paper's stems can
 * quote a whole objective, and 37% of thirty words is a different instruction
 * in front of the same quote, so the cap stays at three (see `sameKind`).
 * Measured 2026-10-17.
 */
export const MAX_WORDS_CHANGED = 3;

/** A stem that is only symbols («٣ + ٤ = ؟») has no sentence to share and is not counted as a kind. */
export function hasSentence(frame: string): boolean {
  return /\p{L}/u.test(frame);
}

/** Whether two `stemFrame`s are one ask, reworded or with other numbers, capped at `MAX_WORDS_CHANGED`. */
export function sameAsk(frameA: string, frameB: string): boolean {
  return sameKind(frameA, frameB, MAX_WORDS_CHANGED);
}
```

- [ ] **Step 6: Run the package tests and its typecheck**

```bash
cd /home/user/Iqraa && pnpm --filter @workspace/exam-paper run test && pnpm --filter @workspace/exam-paper run typecheck
```
Expected: all pass (the first command reports `# fail 0`) and `tsc` prints nothing.

- [ ] **Step 7: Run it in CI**

In `.github/workflows/ci.yml`, directly after the step named `Test practice banks` (the one running `pnpm --filter @workspace/math-practice run test`), add:

```yaml
      - name: Test exam-paper core
        run: pnpm --filter @workspace/exam-paper run test
```

- [ ] **Step 8: Commit**

```bash
git add lib/exam-paper tsconfig.json artifacts/api-server/package.json artifacts/mobile/package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "Add lib/exam-paper: one question-type order, one set of repeat-rule inputs

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJ5jtGzaYE96CaxaxHExxx"
```

---

### Task 3: Point the API at the package

**Files:**
- Modify: `artifacts/api-server/src/modules/assessment/paperOrder.ts` (whole file), `artifacts/api-server/src/lib/generationShape.ts` (the `import` at line 30, the `QUIZ_TYPE_ORDER` block at lines 132-141, `MAX_WORDS_CHANGED` at line 284, `kindOf` at lines 298-307), `artifacts/api-server/src/modules/assessment/validator.ts` (the `import` at line 15, `MAX_WORDS_CHANGED` at line 191, `dominantKind` at lines 210-219)
- Test: the existing suites below; no new test file (the package tests cover the primitives)

**Interfaces:**
- Consumes: everything Task 2 produces.
- Produces: unchanged export names `EXAM_TYPE_ORDER`, `inPaperOrder` (from `paperOrder.ts`) and `QUIZ_TYPE_ORDER`, `QuizType` (from `generationShape.ts`).

- [ ] **Step 1: Run the behaviour guard and see it pass before any edit**

```bash
cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/paperOrder.test.ts src/lib/__tests__/generationShape.test.ts src/lib/__tests__/quizPrompts.test.ts 2>&1 | grep -E "^# (pass|fail)"
```
Expected: `# fail 0`. This is the "before" for this task.

- [ ] **Step 2: Replace `paperOrder.ts`**

Whole file:

```ts
/**
 * The order a generated evaluation is stored in.
 *
 * A ministry exam puts its question types in blocks — choice, then صح/خطأ,
 * then matching, complete, then the written answers — each under its own
 * «السؤال الأول: …» direction. A model asked for a mixed paper returns it in
 * whatever order it likes, and the mock generator rotates types, so a stored
 * paper read MCQ, written, true/false, MCQ… and the teacher screen had no
 * block to put a heading over.
 *
 * `orderIndex` is assigned from this order at insert, so every reader — the
 * teacher's list, the student's walk through the exam, a future print — sees
 * the same paper. The list itself now lives in `lib/exam-paper`, which the app
 * imports too, so there is no second copy to keep in step.
 */
export { EXAM_TYPE_ORDER, inPaperOrder } from "@workspace/exam-paper";
```

- [ ] **Step 3: Edit `generationShape.ts`**

Change the math-practice import (line 30) and add the package import beside it:

```ts
import { stemFrame } from "@workspace/math-practice";
import { QUIZ_TYPE_ORDER, hasSentence, sameAsk, type QuizType } from "@workspace/exam-paper";
```

Replace the doc comment and the two declarations at lines 132-141 (from `/**` « The order a ministry exam paper puts its question types in … » through `export type QuizType = (typeof QUIZ_TYPE_ORDER)[number];`) with:

```ts
/**
 * The order a ministry exam paper puts its question types in — the «السؤال
 * الأول: ضع دائرة…», «السؤال الثاني: ضع إشارة ✓/✗…» structure every Jordanian
 * school exam follows. The prompt asks for it and `normalizeQuiz` enforces it,
 * so the app's screen, PDF, Word file and shared text all print the same
 * grouped paper from the same array. The list lives in `lib/exam-paper`; the
 * offline generator reads the same one.
 */
export { QUIZ_TYPE_ORDER, type QuizType };
```

Delete the `MAX_WORDS_CHANGED` comment and constant (lines 282-284, the `/** Words a reworded ask may change … */` block and `const MAX_WORDS_CHANGED = 3;`). Then `kindOf` becomes:

```ts
function kindOf(groups: string[], text: string): number {
  const frame = stemFrame(text);
  if (!hasSentence(frame)) return -1; // only symbols — no sentence to share
  const at = groups.findIndex(g => sameAsk(g, frame));
  if (at >= 0) return at;
  groups.push(frame);
  return groups.length - 1;
}
```

In the "Repeated asks" comment block above `kindQuota`, the sentence « (`sameKind` on `stemFrame`, three words changed at most, as `dominantKind` in the evaluation validator) » stays true; leave it.

- [ ] **Step 4: Edit `validator.ts`**

Replace line 15 and add the package import:

```ts
import { stemFrame } from "@workspace/math-practice";
import { hasSentence, sameAsk } from "@workspace/exam-paper";
```

Delete the `/** Words a reworded ask may change … */` comment and `const MAX_WORDS_CHANGED = 3;` (lines 190-191). Then the body of `dominantKind` becomes (the doc comment above it is unchanged):

```ts
export function dominantKind(prompts: readonly string[]): { count: number; example: string } | null {
  const framed = prompts
    .map(prompt => ({ prompt, frame: stemFrame(prompt) }))
    .filter(({ frame }) => hasSentence(frame));
  let top: { count: number; example: string } = { count: 0, example: "" };
  for (const centre of framed) {
    const count = framed.filter(({ frame }) => sameAsk(centre.frame, frame)).length;
    if (count > top.count) top = { count, example: centre.prompt };
  }
  return top.count >= 3 && top.count * 4 > prompts.length ? top : null;
}
```

- [ ] **Step 5: Typecheck and rerun the guard**

```bash
cd /home/user/Iqraa && pnpm --filter @workspace/api-server run typecheck
cd artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/paperOrder.test.ts src/lib/__tests__/generationShape.test.ts src/lib/__tests__/quizPrompts.test.ts 2>&1 | grep -E "^# (pass|fail)"
```
Expected: `tsc` prints nothing and the tests report `# fail 0`. The regex test "matches artifacts/mobile/services/examBlocks.ts" still passes here: the mobile file keeps its own literal until Task 4, and the values are equal. It starts failing only once Task 4 removes that literal, which is why Task 4 replaces it. If anything fails now, stop and fix it before continuing.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src
git commit -m "api-server: take the type order and repeat-rule inputs from lib/exam-paper

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJ5jtGzaYE96CaxaxHExxx"
```

---

### Task 4: Point the app at the package, and replace the drift test

**Files:**
- Modify: `artifacts/mobile/services/examBlocks.ts` (the doc comment and `EXAM_TYPE_ORDER` at lines 10-24), `artifacts/mobile/services/quizPaper.ts` (the comment and `QUIZ_TYPE_ORDER` at lines 20-27), `artifacts/api-server/src/modules/assessment/__tests__/paperOrder.test.ts` (the last `describe`, from `describe("the server and the app order a paper identically"` to the end of the file)
- Test: `artifacts/mobile/services/__tests__/examBlocks.test.ts`, `quizMinistryOrder.test.ts` (existing, unchanged), and the replaced test

**Interfaces:**
- Consumes: `EXAM_TYPE_ORDER`, `QUIZ_TYPE_ORDER` from `@workspace/exam-paper`.
- Produces: unchanged export names `EXAM_TYPE_ORDER` (from `examBlocks.ts`) and `QUIZ_TYPE_ORDER` (from `quizPaper.ts`).

- [ ] **Step 1: Run the mobile guard before editing**

```bash
cd /home/user/Iqraa/artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/examBlocks.test.ts services/__tests__/quizMinistryOrder.test.ts services/__tests__/quizCount.test.ts 2>&1 | grep -E "^# (pass|fail)"
```
Expected: `# fail 0`.

- [ ] **Step 2: Edit `examBlocks.ts`**

Add the import under the header comment (before `const ORDINAL_AR`), and replace the `EXAM_TYPE_ORDER` comment and literal:

```ts
import { EXAM_TYPE_ORDER } from '@workspace/exam-paper';

export { EXAM_TYPE_ORDER };
```

Delete the old block (the comment « The order a ministry exam puts its question types in … Keep in step with … » and the `export const EXAM_TYPE_ORDER: readonly string[] = [ … ];` literal). The list now lives in `lib/exam-paper`; `examBlockDirection` and everything below are unchanged.

- [ ] **Step 3: Edit `quizPaper.ts`**

Add to the imports at the top:

```ts
import { QUIZ_TYPE_ORDER } from '@workspace/exam-paper';
```

Replace the comment and the `export const QUIZ_TYPE_ORDER: readonly QuizQuestion['type'][] = [ … ];` declaration (lines 20-27) with:

```ts
/**
 * The order a ministry exam puts its question types in: choice, then
 * صح/خطأ, then complete, then written answers. The list lives in
 * `lib/exam-paper`, shared with the API's `normalizeQuiz` and prompt, so a
 * paper reads the same whichever path made it.
 */
export { QUIZ_TYPE_ORDER };
```

- [ ] **Step 4: Write the replacement guard (it must fail first)**

In `artifacts/api-server/src/modules/assessment/__tests__/paperOrder.test.ts`, delete the final `describe("the server and the app order a paper identically", …)` block and replace it with:

```ts
describe("the server and the app share one list, not two copies", () => {
  // The list used to be copied into `examBlocks.ts` and kept equal by a regex
  // over its source text. It now lives in `lib/exam-paper`, so the guard that
  // matters is the opposite one: nobody puts a second literal back. Read as
  // text because importing the mobile module would not load under node:test.
  const strip = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

  it("examBlocks.ts and quizPaper.ts import their lists from lib/exam-paper", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const mobile = (file: string) => strip(readFileSync(path.resolve(here, "../../../../../mobile/services", file), "utf8"));
    for (const [file, name] of [["examBlocks.ts", "EXAM_TYPE_ORDER"], ["quizPaper.ts", "QUIZ_TYPE_ORDER"]] as const) {
      const source = mobile(file);
      assert.match(source, /from '@workspace\/exam-paper'/, `${file} no longer imports from lib/exam-paper`);
      assert.doesNotMatch(source, new RegExp(`${name}[^=\\n]*=\\s*\\[`), `${file} has its own ${name} list again`);
    }
  });

  it("the API's own modules do not declare a list of their own either", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const { fileURLToPath } = await import("node:url");
    const here = path.dirname(fileURLToPath(import.meta.url));
    const read = (rel: string) => strip(readFileSync(path.resolve(here, rel), "utf8"));
    assert.doesNotMatch(read("../paperOrder.ts"), /EXAM_TYPE_ORDER[^=\n]*=\s*\[/);
    assert.doesNotMatch(read("../../../lib/generationShape.ts"), /QUIZ_TYPE_ORDER[^=\n]*=\s*(\[|\w+ as const)/);
  });
});
```

Run it first with the mobile edits **not yet applied** if you are executing strictly test-first (stash Steps 2-3), and see it fail:

```bash
cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/paperOrder.test.ts 2>&1 | grep -E "^# (pass|fail)|not ok"
```
Expected without the mobile edits: FAIL ("no longer imports from lib/exam-paper"). With them: PASS.

- [ ] **Step 5: Run the guards, the whole mobile suite and both typechecks**

```bash
cd /home/user/Iqraa/artifacts/api-server && node --experimental-strip-types --test src/modules/assessment/__tests__/paperOrder.test.ts 2>&1 | grep -E "^# (pass|fail)"
cd /home/user/Iqraa && pnpm run typecheck 2>&1 | tail -5
cd artifacts/mobile && pnpm test 2>&1 | grep -E "^# (tests|pass|fail)"
```
Expected: `# fail 0` for the guard; the typecheck prints no errors; the mobile suite reports `# fail 0`. If `designScale.test.ts` fails, a raw spacing value crept in: use a `SPACE` step.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services artifacts/api-server/src/modules/assessment/__tests__/paperOrder.test.ts
git commit -m "app: take the type orders from lib/exam-paper; guard against a second copy

The regex test that kept examBlocks.ts equal to the server's list would fail
once that file imports the list, and the thing worth guarding is now the other
way round: that nobody writes a second literal.

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJ5jtGzaYE96CaxaxHExxx"
```

---

### Task 5: Prove nothing changed

**Files:** none modified. Output: `$SCRATCH/digest-after.json`.

**Interfaces:**
- Consumes: `$SCRATCH/corpus.json` and `$SCRATCH/digest-before.json` from Task 1.

- [ ] **Step 1: Re-run the digest on the refactored code, with the SAME corpus**

```bash
cd /home/user/Iqraa/artifacts/mobile
node --import ./scripts/registerTestAlias.mjs --experimental-strip-types $SCRATCH/digest.mts $SCRATCH/corpus.json $SCRATCH/digest-after.json
cmp $SCRATCH/digest-before.json $SCRATCH/digest-after.json && echo "IDENTICAL: repeat detection and dominant kind unchanged"
```
Expected: the digest prints non-zero repeat and dominant counts, then `IDENTICAL: …`. **Do not** regenerate `corpus.json`: the generators import the lists Task 4 changed, and the comparison must read the pre-refactor stems. Any difference is a bug in this change: diff the two files, find the row, and fix the code. Do not edit the baseline.

- [ ] **Step 2: Run every suite**

```bash
cd /home/user/Iqraa
pnpm run typecheck
pnpm --filter @workspace/exam-paper run test
pnpm --filter @workspace/math-practice run test
(cd artifacts/api-server && pnpm build && pnpm test)
(cd artifacts/mobile && pnpm test)
```
Expected: typecheck clean; every suite `# fail 0`. Record the pass counts for the PR description. The API suite must be run **after** `pnpm build`, or the mount-order suite skips (CLAUDE.md).

- [ ] **Step 3: Build what CI and deploy build**

```bash
cd /home/user/Iqraa
pnpm --filter @workspace/api-server run build
cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web
```
Expected: both succeed. This is the check that esbuild (API) and Metro (app) resolve the new workspace package; `math-practice` is consumed by both the same way, but the claim is verified here, not assumed.

- [ ] **Step 4: Run the repo's browser smoke test**

Follow "Browser smoke test" in `CLAUDE.md` (throwaway Postgres, migrate, `seed:assessment`, build, `cd e2e && E2E_DATABASE_URL=<throwaway> pnpm test`). It publishes an evaluation, which exercises the evaluation generator and `inPaperOrder` through the built bundle.
Expected: the teacher-to-student test passes.

- [ ] **Step 5: Look at a quiz and an evaluation in a browser**

With the stack from Step 4 still up and a signed-in teacher (see how `e2e/tests/teacher-to-student.spec.ts` signs up): open `/ai-tools/quiz`, generate an offline quiz with all three question types, and confirm its blocks read multiple choice, then صح/خطأ, then short answer under «السؤال الأول/الثاني/الثالث». Open an evaluation's generated paper and confirm the same grouping. Expected: identical to what `main` produces. If the stack is unavailable, say so in the PR; do not claim this step.

No commit.

---

### Task 6: Docs and the PR

**Files:**
- Modify: `STATUS.md` (a new dated section), `CLAUDE.md` (the bullet «A quiz's question types and their order live in three places»)

- [ ] **Step 1: Update `STATUS.md`**

Add a section above the newest existing one (headings run newest-first; copy the format of «One card for quizzes and evaluations, 2026-10-18»), titled «One question-type order, one repeat-rule input set, 2026-10-18». It must say, with the real numbers from Task 5: what moved (`lib/exam-paper`: `EXAM_TYPE_ORDER`, `QUIZ_TYPE_ORDER`, `inPaperOrder`, `MAX_WORDS_CHANGED`, `hasSentence`, `sameAsk`); what deliberately did not (the two grouping algorithms and their quotas, prompt text, count/top-up/replace, the offline banks, `ai_artifacts`); that behaviour is unchanged and **how that was checked** (the old-versus-new repeat digest over N papers, identical; suite counts; the browser pass); that the merge redeploys the API because it changes `lib/**`; and that `paperOrder.test.ts`'s regex check became a "no second copy" guard.

- [ ] **Step 2: Update `CLAUDE.md`**

In the bullet «A quiz's question types and their order live in three places», the clause « The two `EXAM_TYPE_ORDER` lists are pinned equal by `paperOrder.test.ts` » is no longer true. Replace it with: « The type order is one list, `lib/exam-paper` (`EXAM_TYPE_ORDER`; the quiz's four types are `QUIZ_TYPES`, its order derived), imported by the API and the app. `paperOrder.test.ts` fails if either side writes a second literal. The prompts, `normalizeQuiz` and `quizOnce` are still three separate places that must agree on *types*, and a new quiz type still needs an entry in `QUIZ_TYPES`, the prompt's type contract and `quizOnce`. » Keep the rest of the bullet.

- [ ] **Step 3: Commit, push, open the PR**

```bash
git add STATUS.md CLAUDE.md
git commit -m "docs: one question-type order in lib/exam-paper

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01BJ5jtGzaYE96CaxaxHExxx"
git fetch origin main && git merge --no-edit origin/main
git push -u origin ccr-c53b65db-2szi4w
```
Open a **draft** PR against `main` using the PR body's structure from #1140 (What / Not in this PR / Verification), listing the Task 5 evidence honestly, including anything not run. Then subscribe to its activity. If #1146 (spec only) is still open and shares this branch, this PR supersedes it: say so on both.

---

## Self-Review

**Spec coverage:** the package and its exports → Task 2. Five call sites → Tasks 3 and 4. The replaced regex test and the new guards → Task 4. The new package's tests, including the pinned quiz literal and the `sameAsk`/`hasSentence` cases → Task 2. Wiring (root tsconfig reference, both consumers, lockfile, CI step) → Task 2. Behaviour guard and the before/after digest → Tasks 1 and 5. Build verification (API bundle, mobile web export) and the browser pass → Task 5. `STATUS.md` and `CLAUDE.md` → Task 6. The deploy side effect is recorded in Task 6. Out-of-scope items are not touched by any task.

**Placeholders:** none. Every code step shows the code. Line numbers are those on `main` at `3ad7fcd` and are anchors; where an edit replaces a block, the block is quoted by its first and last lines.

**Type consistency:** `EXAM_TYPE_ORDER`, `QUIZ_TYPES`, `QuizType`, `QUIZ_TYPE_ORDER`, `inPaperOrder`, `MAX_WORDS_CHANGED`, `hasSentence`, `sameAsk` are spelled identically in the Interfaces blocks, the implementation, the tests and the call sites. `sameAsk` takes two frames in every use. `QUIZ_TYPE_ORDER`'s type changes from a readonly tuple to `readonly QuizType[]`; Task 3's typecheck is the check that no consumer relied on the tuple.

**Known risks the executor should watch:**
- `QUIZ_TYPE_ORDER` losing its tuple type may surface a typecheck error in `prompts.ts` or `generators.ts`. Fix by widening the consumer, never by changing `QUIZ_TYPES`.
- The corpus covers lessons that have an offline question bank; lessons without one are skipped and counted. That is fine for the comparison but means "every lesson" in the PR must read "every lesson the offline generator can write".
