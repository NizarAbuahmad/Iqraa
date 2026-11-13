# Drawn physics figures, part 2: the server — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A physics quiz, worksheet or homework request asks the model for an optional drawing per question, and the server keeps only drawings that pass the gate, state no number the question does not, and fit the per-paper cap of 6, before anything is pooled or served.

**Architecture:** The model writes a question-level `"visual"` (a sibling of `"text"`). One pure function, `settlePaperVisuals` (`artifacts/api-server/src/lib/paperVisuals.ts`), runs on the finished paper, after every merge and trim and just before the artifact is stored. It removes every visual from a non-physics paper, and on a physics paper it gates each visual with `resolvePhysicsFigure`, checks it with `figureNumbersInText`, and applies the cap in paper order. The prompt block is built from the package's own limits, so it cannot drift from the gate. Physics papers get a new strict-cache-key field, so papers pooled before drawings existed are not served to them. Every other subject's prompt and key stay byte for byte the same.

**Tech Stack:** TypeScript, Express (`artifacts/api-server`), `@workspace/figure` (`lib/figure`), `node --test --experimental-strip-types`.

**Spec:** `docs/superpowers/specs/2026-11-13-physics-figures-design.md` §2. Part 1 (the package) is `docs/superpowers/plans/2026-11-13-physics-figures-1-package.md`, on NizarAbuahmad/Iqraa#1443.

## Global Constraints

- **Branch:** `claude/physics-figures-2`, cut from `claude/physics-figures-1` because it needs that branch's package. Until #1443 merges, the draft PR is opened with base `claude/physics-figures-1`; once #1443 merges, retarget it to `main`.
- **Physics only:** the subject id is `physics` (`subjectIdOf(body) === "physics"`, `lessonKinds.ts`). For every other subject, the quiz, worksheet and homework prompts and their strict and coarse cache keys are **byte for byte unchanged**.
- **The model's drawing field:** question-level `"visual"`, a sibling of `"text"`, in quiz `questions[]` and worksheet/homework `sections[].questions[]`. Nowhere else is read.
- **Gate:** `resolvePhysicsFigure` (scenes or plane vectors), then `figureNumbersInText(visual, question.text)` on the question's **`text` only**: never options, never the answer key.
- **Cap:** at most `MAX_PAPER_VISUALS = 6` per paper, the first six in paper order. A dropped drawing never removes its question.
- **Where the check runs:** once, on the finished paper, after top-ups, repeat replacement and trims, and before `storeVariant`. Spec §2 places it "beside `sanitizeWorksheetExtras`" and repeats it on top-ups. Running it once on the finished paper is equivalent, and it is the only place a per-paper cap can be counted.
- **Drop reasons:** exactly `gate | numbers | cap | not-physics`. Log line message: `"paper visuals"`, fields `{ kind, lessonId, kept, dropped }`.
- **Strict key:** a physics quiz, worksheet or homework request gets `drawings: "physics-1"`. Nothing else gets the field, and the coarse key never gets it.
- **No change to:** answer keys (a drawing never earns «تم التحقق»), the offline generators, the evaluation generator (`modules/assessment/llmGenerator.ts`) or the app.
- **Repo rules:**
  - No `sed -i` / `perl -pi` on source; files hold Arabic. Use the Edit tool.
  - `git add` named paths only.
  - Commit messages end with the two attribution lines the controller gives.
  - Never push to `main`.
- **Tests:**
  - Package: `cd lib/figure && pnpm test`.
  - API: `cd artifacts/api-server && pnpm build && pnpm test`. Build first: the mount-order suite boots the bundle.
  - Root: `pnpm run typecheck`.

## File map

| File | Change |
|---|---|
| `lib/figure/src/sceneGate.ts` | Export `SCENE_LIMITS`; the gate reads its numbers from it (behaviour unchanged) |
| `lib/figure/src/figureNumbers.ts` | Judge `vectors`: non-zero components count as printed numbers; a drawn sum/difference of two drawn vectors fails |
| `lib/figure/src/__tests__/sceneGate.test.ts`, `figureNumbers.test.ts` | Tests for the above |
| `artifacts/api-server/src/lib/figurePrompt.ts` | Add `physicsFigureFormatAr/En` |
| `artifacts/api-server/src/lib/__tests__/physicsFigurePrompt.test.ts` | **Create.** |
| `artifacts/api-server/src/lib/paperVisuals.ts` | **Create.** `MAX_PAPER_VISUALS`, `isPhysicsRequest`, `physicsVisualClauseAr/En`, `settlePaperVisuals` |
| `artifacts/api-server/src/lib/__tests__/paperVisuals.test.ts` | **Create.** |
| `artifacts/api-server/src/lib/prompts.ts` | Quiz and worksheet prompts append the clause (empty for non-physics) |
| `artifacts/api-server/src/lib/__tests__/physicsPromptClause.test.ts` | **Create.** |
| `artifacts/api-server/src/lib/generationKey.ts` | `strict.drawings` for physics papers |
| `artifacts/api-server/src/lib/__tests__/generationKey.test.ts` | Pinned keys + the new field |
| `artifacts/api-server/src/routes/generate.ts` | Call `settlePaperVisuals` before storing; log; +1500 output tokens for physics papers |
| `artifacts/api-server/src/routes/__tests__/paperVisualsWiring.test.ts` | **Create.** |
| `docs/status-log.md` | Top entry |

## Pre-flight (controller, once)

```bash
cd /home/user/wt-physics-figures-2
pnpm install
pnpm run typecheck            # must be clean before Task 1
```

Capture the prompts for non-physics subjects **before** Task 4 changes them. The script below writes the file Task 4's byte-identity check reads:

```bash
cat > /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-before.ts <<'EOF'
import { writeFileSync } from "node:fs";
import { quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn } from "/home/user/wt-physics-figures-2/artifacts/api-server/src/lib/prompts.ts";
const subjects = ["Mathematics", "Chemistry", "Biology", "Science", "Arabic", "English", "الرياضيات", "الكيمياء", ""];
const out: Record<string, string> = {};
for (const subject of subjects) {
  const b = { subject, grade: "Grade 10", topic: "t", numQuestions: 8, questionTypes: ["multiple_choice", "short_answer"], additionalContext: "ctx" };
  out[`quizAr|${subject}`] = quizPromptAr(b);
  out[`quizEn|${subject}`] = quizPromptEn(b);
  out[`wsAr|${subject}`] = worksheetPromptAr(b);
  out[`wsEn|${subject}`] = worksheetPromptEn(b);
  out[`hwAr|${subject}`] = worksheetPromptAr({ ...b, homework: true });
}
writeFileSync("/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-before.json", JSON.stringify(out));
console.log(Object.keys(out).length, "prompts captured");
EOF
cd artifacts/api-server && node --experimental-strip-types /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-before.ts
```

Expected: `45 prompts captured`.

---

### Task 1: The package's limits as one constant, and vectors judged by the leak guard

**Files:**
- Modify: `lib/figure/src/sceneGate.ts`
- Modify: `lib/figure/src/figureNumbers.ts`
- Test: `lib/figure/src/__tests__/sceneGate.test.ts`, `lib/figure/src/__tests__/figureNumbers.test.ts`

**Interfaces:**
- Produces: `SCENE_LIMITS` (exported from `@workspace/figure`), read by Task 2's prompt:
  ```ts
  export const SCENE_LIMITS = {
    maxArrows: 5, minIncline: 5, maxIncline: 60, minAngle: 10, maxAngle: 80,
    maxCycles: 3, maxValue: 1_000_000, valueDecimals: 3, minArrowGap: 15,
  } as const;
  ```
- Produces: `vectorsShowResult(f: VectorsFigure): boolean`. `figureNumbers` for `vectors` now returns each vector's non-zero |dx| and |dy|, and `figureNumbersInText` is false for a vectors figure where `vectorsShowResult` is true.
- `MIN_ARROW_GAP` stays exported, as `SCENE_LIMITS.minArrowGap`.

- [ ] **Step 1: Write the failing tests.**

In `sceneGate.test.ts`, add:

```ts
import { SCENE_LIMITS } from '../sceneGate.ts';

describe('SCENE_LIMITS is what the gate enforces', () => {
  const S = SCENE_LIMITS;
  const block = (arrows: unknown[], incline?: number) =>
    resolveSceneFigure({ kind: 'forces', body: 'block', ...(incline !== undefined ? { incline } : {}), arrows });
  const arrows = (n: number) => Array.from({ length: n }, (_, i) => ({ dir: i * 60, size: 1, label: 'ABCDEFG'[i] }));
  it('arrows', () => {
    assert.ok(block(arrows(S.maxArrows)));
    assert.equal(block(arrows(S.maxArrows + 1)), null);
  });
  it('incline', () => {
    assert.ok(block(arrows(1), S.minIncline));
    assert.ok(block(arrows(1), S.maxIncline));
    assert.equal(block(arrows(1), S.minIncline - 1), null);
    assert.equal(block(arrows(1), S.maxIncline + 1), null);
  });
  it('projectile angle', () => {
    const p = (angle: number) => resolveSceneFigure({ kind: 'projectile', launch: 'ground', angle, marks: [] });
    assert.ok(p(S.minAngle));
    assert.ok(p(S.maxAngle));
    assert.equal(p(S.minAngle - 1), null);
    assert.equal(p(S.maxAngle + 1), null);
  });
  it('wave cycles', () => {
    assert.ok(resolveSceneFigure({ kind: 'wave', cycles: S.maxCycles, marks: [] }));
    assert.equal(resolveSceneFigure({ kind: 'wave', cycles: S.maxCycles + 1, marks: [] }), null);
  });
  it('values', () => {
    const v = (n: number) => resolveSceneFigure({ kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n, unit: 'm' } } });
    assert.ok(v(S.maxValue));
    assert.equal(v(S.maxValue + 1), null);
    assert.ok(v(Number(`0.${'0'.repeat(S.valueDecimals - 1)}1`)));
    assert.equal(v(Number(`0.${'0'.repeat(S.valueDecimals)}1`)), null);
  });
  it('arrow gap', () => {
    assert.ok(block([{ dir: 0, size: 1, label: 'A' }, { dir: S.minArrowGap, size: 1, label: 'B' }]));
    assert.equal(block([{ dir: 0, size: 1, label: 'A' }, { dir: S.minArrowGap - 1, size: 1, label: 'B' }]), null);
  });
});
```

In `figureNumbers.test.ts`, **replace** the line
`assert.deepEqual(figureNumbers({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2] }] }), []);`
with
`assert.deepEqual(figureNumbers({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2] }, { from: [1, 1], to: [1, 3.5] }] }), [3, 2, 2.5]);`
and add:

```ts
import { vectorsShowResult } from '../figureNumbers.ts';

describe('vectors on the numbered grid', () => {
  const two = { kind: 'vectors' as const, vectors: [{ from: [0, 0] as [number, number], to: [3, 0] as [number, number], label: 'A' }, { from: [0, 0] as [number, number], to: [0, 4] as [number, number], label: 'B' }] };
  it('passes only when every non-zero component is stated', () => {
    assert.equal(figureNumbersInText(two, 'قوتان A = 3 N شرقًا و B = 4 N شمالًا. احسب المحصلة.'), true);
    assert.equal(figureNumbersInText(two, 'قوتان متعامدتان. احسب مقدار المحصلة.'), false);
  });
  it('refuses a drawn sum or difference of two drawn vectors', () => {
    const tipToTail = { kind: 'vectors' as const, vectors: [
      { from: [0, 0] as [number, number], to: [3, 0] as [number, number], label: 'A' },
      { from: [3, 0] as [number, number], to: [3, 4] as [number, number], label: 'B' },
      { from: [0, 0] as [number, number], to: [3, 4] as [number, number], label: 'R' },
    ] };
    assert.equal(vectorsShowResult(tipToTail), true);
    assert.equal(figureNumbersInText(tipToTail, 'A = 3 و B = 4، احسب R'), false);
    const diff = { kind: 'vectors' as const, vectors: [
      { from: [0, 0] as [number, number], to: [3, 1] as [number, number] },
      { from: [0, 0] as [number, number], to: [1, 1] as [number, number] },
      { from: [1, 1] as [number, number], to: [3, 1] as [number, number] },
    ] };
    assert.equal(vectorsShowResult(diff), true);
    assert.equal(vectorsShowResult(two), false);
  });
});
```

- [ ] **Step 2: Run, and see the new tests fail.** Command: `cd lib/figure && pnpm test`. Expected failures: `SCENE_LIMITS` is not exported, `vectorsShowResult` is not exported, and the changed `figureNumbers` assertion.

- [ ] **Step 3: Implement.**

In `sceneGate.ts`, replace `export const MIN_ARROW_GAP = 15;` with:

```ts
/** Every numeric limit of the physics gate, in one place, so a prompt can quote them and never drift. */
export const SCENE_LIMITS = {
  maxArrows: 5,
  minIncline: 5,
  maxIncline: 60,
  minAngle: 10,
  maxAngle: 80,
  maxCycles: 3,
  maxValue: 1_000_000,
  valueDecimals: 3,
  /** Degrees: the least angle between two force arrows on one body. */
  minArrowGap: 15,
} as const;
const S = SCENE_LIMITS;
/** Degrees: the least angle between two force arrows on one body. */
export const MIN_ARROW_GAP = S.minArrowGap;
```

Then replace each literal with its limit, changing no behaviour:
- `n > 1e6` → `n > S.maxValue`
- `n * 1000 - Math.round(n * 1000)` → `n * 10 ** S.valueDecimals - Math.round(n * 10 ** S.valueDecimals)`
- `n.toFixed(3)` → `n.toFixed(S.valueDecimals)`
- `i < 5 || i > 60` → `i < S.minIncline || i > S.maxIncline`
- `list.length > 5` → `list.length > S.maxArrows`
- `angleRaw < 10 || angleRaw > 80` → `angleRaw < S.minAngle || angleRaw > S.maxAngle`
- `cycles !== 1 && cycles !== 2 && cycles !== 3` → `!isInt(cycles) || cycles < 1 || cycles > S.maxCycles`
  - `WaveFigure['cycles']` is the type `1 | 2 | 3`, so cast where it is used: `kind: 'wave', cycles: cycles as WaveFigure['cycles'], …`.

In `figureNumbers.ts`, add `VectorsFigure` to the type import from `./sceneTypes.ts` (it is re-exported there from `./types.ts`; otherwise import it from `./types.ts`). Replace the `case 'vectors': return [];` arm and the two docstrings with:

```ts
    case 'vectors':
      // Drawn on a numbered grid: a student reads each component off it, so each counts as printed.
      return f.vectors.flatMap(v => [Math.abs(v.to[0] - v.from[0]), Math.abs(v.to[1] - v.from[1])]).filter(n => n > 1e-9);
```

```ts
/**
 * True when one drawn vector is the sum or the difference of two others (tip to tail or
 * from one origin): the drawing then shows the resultant a question asks for. Coordinates
 * are multiples of 0.5, so the arithmetic is exact.
 */
export function vectorsShowResult(f: VectorsFigure): boolean {
  const d = f.vectors.map(v => [v.to[0] - v.from[0], v.to[1] - v.from[1]] as const);
  const same = (a: readonly number[], x: number, y: number) => Math.abs(a[0]! - x) < 1e-9 && Math.abs(a[1]! - y) < 1e-9;
  for (let k = 0; k < d.length; k++) {
    for (let i = 0; i < d.length; i++) {
      for (let j = i + 1; j < d.length; j++) {
        if (i === k || j === k) continue;
        const a = d[i]!, b = d[j]!;
        if (same(d[k]!, a[0] + b[0], a[1] + b[1]) || same(d[k]!, a[0] - b[0], a[1] - b[1]) || same(d[k]!, b[0] - a[0], b[1] - a[1])) return true;
      }
    }
  }
  return false;
}
```

and make `figureNumbersInText` start with:

```ts
  if (f.kind === 'vectors' && vectorsShowResult(f)) return false;
```

Update both docstrings so they say vectors **are** judged: their components count as printed numbers, and a drawn sum or difference fails.

- [ ] **Step 4: Run, and see everything pass.** Command: `cd lib/figure && pnpm test`. Every test passes; the count is 159 plus the new tests.

- [ ] **Step 5: Commit** `sceneGate.ts`, `figureNumbers.ts` and the two test files: "lib/figure: one table of physics limits; the leak guard judges vectors".

---

### Task 2: The physics drawing format, from the package's own limits

**Files:**
- Modify: `artifacts/api-server/src/lib/figurePrompt.ts`
- Create: `artifacts/api-server/src/lib/__tests__/physicsFigurePrompt.test.ts`

**Interfaces:**
- Consumes: `SCENE_LIMITS`, `PHYSICS_UNITS`, `FIGURE_LIMITS`, `resolvePhysicsFigure` from `@workspace/figure`.
- Produces: `physicsFigureFormatEn(): string`, `physicsFigureFormatAr(): string`, and `PHYSICS_FIGURE_EXAMPLES: readonly string[]` (exported for the test).

- [ ] **Step 1: Write the failing test** at `artifacts/api-server/src/lib/__tests__/physicsFigurePrompt.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { FIGURE_LIMITS as L, PHYSICS_UNITS, SCENE_LIMITS as S, resolvePhysicsFigure } from "@workspace/figure";
import { PHYSICS_FIGURE_EXAMPLES, physicsFigureFormatAr, physicsFigureFormatEn } from "../figurePrompt.ts";

// Each limit inside the phrase that templates it: a bare includes(String(n)) is vacuous for small numbers.
const PHRASES = {
  en: [
    `${S.minIncline} to ${S.maxIncline}`,
    `1 to ${S.maxArrows};`,
    `less than ${S.minArrowGap}° apart`,
    `${S.minAngle} to ${S.maxAngle})`,
    `from 0 to ${S.maxValue}`,
    `at most ${S.valueDecimals} decimals`,
    `1 to ${L.maxVectors};`,
    `at most ${L.maxCoord})`,
  ],
  ar: [
    `من ${S.minIncline} إلى ${S.maxIncline}`,
    `من 1 إلى ${S.maxArrows}؛`,
    `عن ${S.minArrowGap}°`,
    `من ${S.minAngle} إلى ${S.maxAngle})`,
    `من 0 إلى ${S.maxValue}`,
    `بحدٍّ أقصى ${S.valueDecimals} منازل عشرية`,
    `من 1 إلى ${L.maxVectors}؛`,
    `${L.maxCoord} على الأكثر`,
  ],
};

describe("physics drawing format", () => {
  for (const [lang, text] of [["en", physicsFigureFormatEn()], ["ar", physicsFigureFormatAr()]] as const) {
    it(`${lang}: quotes every limit from the package`, () => {
      for (const p of PHRASES[lang]) assert.ok(text.includes(p), `missing «${p}»`);
    });
    it(`${lang}: lists every unit`, () => {
      for (const u of PHYSICS_UNITS) assert.ok(text.includes(u), `missing unit ${u}`);
    });
    it(`${lang}: names all six kinds and carries the examples`, () => {
      for (const k of ["forces", "attraction", "projectile", "circular", "wave", "vectors"]) assert.ok(text.includes(`"${k}"`), k);
      for (const e of PHYSICS_FIGURE_EXAMPLES) assert.ok(text.includes(e));
    });
  }
  it("every example passes the gate, one per kind", () => {
    const kinds = PHYSICS_FIGURE_EXAMPLES.map(e => resolvePhysicsFigure(JSON.parse(e))?.kind);
    assert.deepEqual(kinds, ["forces", "attraction", "projectile", "circular", "wave", "vectors"]);
  });
  it("says a drawing never carries the answer", () => {
    assert.match(physicsFigureFormatEn(), /Never put on the drawing the quantity the question asks for/);
    assert.match(physicsFigureFormatAr(), /لا تضع في الرسم الكمية التي يطلبها السؤال/);
  });
});
```

- [ ] **Step 2: Run, and see it fail** because the exports are missing. Command: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/physicsFigurePrompt.test.ts`.

- [ ] **Step 3: Implement.** In `figurePrompt.ts`, change the import to `import { FIGURE_LIMITS as L, PHYSICS_UNITS, SCENE_LIMITS as S } from "@workspace/figure";` and append:

```ts
/** One example per kind, in the order the format lists them. Tested against the gate. */
export const PHYSICS_FIGURE_EXAMPLES = [
  '{"kind":"forces","body":"block","incline":30,"arrows":[{"dir":270,"size":3,"label":"W","value":{"n":49,"unit":"N"}},{"dir":120,"size":2,"label":"N"},{"dir":210,"size":1,"label":"f"}]}',
  '{"kind":"attraction","bodies":["m1","m2"],"force":"F","distance":{"label":"r","value":{"n":2,"unit":"m"}}}',
  '{"kind":"projectile","launch":"ground","angle":30,"speed":{"n":20,"unit":"m/s"},"marks":["v0","H","R"]}',
  '{"kind":"circular","radius":{"label":"r","value":{"n":0.5,"unit":"m"}},"turning":"ccw","arrows":["v","F"]}',
  '{"kind":"wave","cycles":2,"marks":["crest","trough","A","lambda"]}',
  '{"kind":"vectors","vectors":[{"from":[0,0],"to":[3,0],"label":"A"},{"from":[0,0],"to":[0,4],"label":"B"}]}',
] as const;

/**
 * The physics drawing format. Every number comes from `SCENE_LIMITS` / `FIGURE_LIMITS`
 * and the units from `PHYSICS_UNITS`, so the prompt cannot promise what the gate refuses.
 */
export function physicsFigureFormatEn(): string {
  return [
    "A drawing is one of six kinds. A drawing outside these limits is dropped whole and the question keeps only its text:",
    `- "forces": {"kind","body":"block" or "point","incline": optional, whole degrees ${S.minIncline} to ${S.maxIncline} (a block on a slope; "block" only),"arrows":[{"dir": whole degrees 0 to 359, counter-clockwise from the right (270 is straight down),"size": 1, 2 or 3 (relative strength),"label","value": optional}] (1 to ${S.maxArrows}; no two arrows less than ${S.minArrowGap}° apart; weight points 270, a normal force is perpendicular to the surface)}.`,
    `- "attraction": {"kind","bodies":[label,label],"force": label,"distance": optional {"label","value": optional}}.`,
    `- "projectile": {"kind","launch":"ground" (needs "angle", whole degrees ${S.minAngle} to ${S.maxAngle}) or "horizontal" (off a height: no "angle", optional "height" value),"speed": optional value (needs "v0" in "marks"),"marks": any of "v0","vx","vy","H","R" ("H" never with "horizontal"; "H" and "R" never carry a value: they are what questions ask for)}.`,
    `- "circular": {"kind","turning":"cw" or "ccw","arrows": one or two of "v","F","a" ("F" and "a" never together),"radius": optional {"label","value": optional}}.`,
    `- "wave": {"kind","cycles": 1 to ${S.maxCycles},"marks": any of "crest","trough","A","lambda","second": optional {"phase":"in" or "out","sum": true or false} (two waves and, with "sum", their sum),"amplitude" and "wavelength": optional values}.`,
    `- "vectors": {"kind","vectors":[{"from":[x,y],"to":[x,y],"label"}] (1 to ${L.maxVectors}; every coordinate a multiple of 0.5 with absolute value at most ${L.maxCoord}), optional "components": true}. It is drawn on a numbered grid, so the question must state every non-zero component, and never draw a vector that is the sum or difference of two drawn vectors.`,
    `A value is {"n": a number from 0 to ${S.maxValue} with at most ${S.valueDecimals} decimals,"unit": one of ${PHYSICS_UNITS.join(", ")}}, printed in Latin as written.`,
    "A label is 1 to 3 letters (Latin, Arabic, or one of λ θ α β ω Δ μ), optionally followed by one digit or a prime (F, N, m1, v0, θ). Never a value or a word that names a number.",
    "Every number the drawing shows (a value, an angle, an incline) must appear in the question text, written the same way. Never put on the drawing the quantity the question asks for: a drawing that gives the answer away is dropped.",
    "Examples:",
    ...PHYSICS_FIGURE_EXAMPLES,
  ].join("\n");
}

export function physicsFigureFormatAr(): string {
  return [
    "الرسم من ستة أنواع، والرسم الذي يتجاوز هذه الحدود يُحذف كاملًا ويبقى للسؤال نصه وحده:",
    `- "forces": {"kind"، "body": "block" أو "point"، و"incline" اختياري بالدرجات الصحيحة من ${S.minIncline} إلى ${S.maxIncline} (جسم على سطح مائل؛ مع "block" فقط)، و"arrows":[{"dir": بالدرجات الصحيحة من 0 إلى 359 عكس اتجاه عقارب الساعة بدءًا من اليمين (270 إلى الأسفل مباشرة)، "size": 1 أو 2 أو 3 (المقدار النسبي)، "label"، و"value" اختياري}] (من 1 إلى ${S.maxArrows}؛ ولا يقل الفرق بين اتجاهي سهمين عن ${S.minArrowGap}°؛ الوزن باتجاه 270 والقوة العمودية عمودية على السطح)}.`,
    `- "attraction": {"kind"، "bodies":[وسم، وسم]، "force": وسم، و"distance" اختياري {"label"، و"value" اختياري}}.`,
    `- "projectile": {"kind"، "launch": "ground" (يلزمه "angle" بالدرجات الصحيحة من ${S.minAngle} إلى ${S.maxAngle}) أو "horizontal" (من ارتفاع: بلا "angle"، و"height" قيمة اختيارية)، و"speed" قيمة اختيارية (يلزمها "v0" في "marks")، و"marks": أيٌّ من "v0" و"vx" و"vy" و"H" و"R" ("H" لا تأتي مع "horizontal"؛ و"H" و"R" لا تحملان قيمة أبدًا لأنهما ما تسأل عنه الأسئلة)}.`,
    `- "circular": {"kind"، "turning": "cw" أو "ccw"، و"arrows": واحد أو اثنان من "v" و"F" و"a" (لا يجتمع "F" و"a")، و"radius" اختياري {"label"، و"value" اختياري}}.`,
    `- "wave": {"kind"، "cycles": من 1 إلى ${S.maxCycles}، و"marks": أيٌّ من "crest" و"trough" و"A" و"lambda"، و"second" اختياري {"phase": "in" أو "out"، "sum": true أو false} (موجتان، ومع "sum" مجموعهما)، و"amplitude" و"wavelength" قيمتان اختياريتان}.`,
    `- "vectors": {"kind"، "vectors":[{"from":[x,y]، "to":[x,y]، "label"}] (من 1 إلى ${L.maxVectors}؛ كل إحداثي من مضاعفات 0.5 وقيمته المطلقة ${L.maxCoord} على الأكثر)، و"components": true اختياري}. يُرسم على شبكة مرقّمة، فيجب أن يذكر السؤال كل مركّبة غير صفرية، ولا ترسم متجهًا هو مجموع متجهين مرسومين أو الفرق بينهما.`,
    `القيمة {"n": عدد من 0 إلى ${S.maxValue} بحدٍّ أقصى ${S.valueDecimals} منازل عشرية، "unit": واحدة من ${PHYSICS_UNITS.join("، ")}}، وتُطبع بالأحرف اللاتينية كما كُتبت.`,
    "الوسم من 1 إلى 3 أحرف (لاتينية أو عربية أو واحد من λ θ α β ω Δ μ)، ويجوز أن يليها رقم واحد أو شرطة عليا (F، N، m1، v0، θ). لا تكتب في الوسم قيمة ولا كلمة تدل على عدد.",
    "كل عدد يظهر في الرسم (قيمة أو زاوية أو ميل) يجب أن يرد في نص السؤال مكتوبًا بالطريقة نفسها. لا تضع في الرسم الكمية التي يطلبها السؤال: الرسم الذي يكشف الإجابة يُحذف.",
    "أمثلة:",
    ...PHYSICS_FIGURE_EXAMPLES,
  ].join("\n");
}
```

- [ ] **Step 4: Run, and see it pass**: the new test plus `figurePrompt.test.ts`, whose maths format is unchanged.

- [ ] **Step 5: Commit** `figurePrompt.ts` and the new test: "API: the physics drawing format, quoted from the package's limits".

---

### Task 3: `settlePaperVisuals`, the paper's one gate

**Files:**
- Create: `artifacts/api-server/src/lib/paperVisuals.ts`
- Create: `artifacts/api-server/src/lib/__tests__/paperVisuals.test.ts`

**Interfaces:**
- Consumes: `resolvePhysicsFigure`, `figureNumbersInText` (`@workspace/figure`); `subjectIdOf` (`./lessonKinds.ts`); `physicsFigureFormatAr/En` (Task 2).
- Produces:
  ```ts
  export const MAX_PAPER_VISUALS = 6;
  export type VisualDropReason = "gate" | "numbers" | "cap" | "not-physics";
  export type VisualsSummary = { physics: boolean; kept: Record<string, number>; dropped: Partial<Record<VisualDropReason, number>> };
  export function isPhysicsRequest(body: { subject?: unknown; subjectId?: unknown } | undefined): boolean;
  export function physicsVisualClauseAr(b: { subject?: unknown; subjectId?: unknown }): string; // "" unless physics
  export function physicsVisualClauseEn(b: { subject?: unknown; subjectId?: unknown }): string; // "" unless physics
  export function settlePaperVisuals(kind: string, parsed: unknown, body: Record<string, unknown>): VisualsSummary | null; // null for a kind that is not quiz/worksheet/homework
  ```

- [ ] **Step 1: Write the failing test** at `artifacts/api-server/src/lib/__tests__/paperVisuals.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PAPER_VISUALS, isPhysicsRequest, physicsVisualClauseAr, physicsVisualClauseEn, settlePaperVisuals,
} from "../paperVisuals.ts";

const PROJ = { kind: "projectile", launch: "ground", angle: 30, speed: { n: 20, unit: "m/s" }, marks: ["v0", "H", "R"] };
const STEM = "قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.";
const physics = { subject: "Physics" };
const q = (text: string, visual?: unknown) => ({ id: "q", type: "short_answer", text, ...(visual !== undefined ? { visual } : {}) });

describe("isPhysicsRequest", () => {
  it("reads the subject id or the subject's name, in either language", () => {
    assert.equal(isPhysicsRequest({ subject: "Physics" }), true);
    assert.equal(isPhysicsRequest({ subject: "الفيزياء" }), true);
    assert.equal(isPhysicsRequest({ subjectId: "physics" }), true);
    assert.equal(isPhysicsRequest({ subject: "Chemistry" }), false);
    assert.equal(isPhysicsRequest({ subject: "Mathematics" }), false);
    assert.equal(isPhysicsRequest({}), false);
    assert.equal(isPhysicsRequest(undefined), false);
  });
});

describe("the prompt clause", () => {
  it("is empty for every subject but physics", () => {
    for (const subject of ["Mathematics", "Chemistry", "Biology", "Science", "Arabic", "English", "", "Unknown"]) {
      assert.equal(physicsVisualClauseAr({ subject }), "");
      assert.equal(physicsVisualClauseEn({ subject }), "");
    }
  });
  it("for physics: starts on a new line, names the field and the cap, forbids pointing at the drawing", () => {
    const en = physicsVisualClauseEn(physics);
    const ar = physicsVisualClauseAr(physics);
    assert.ok(en.startsWith("\n") && ar.startsWith("\n"));
    assert.match(en, /"visual"/);
    assert.match(ar, /"visual"/);
    assert.ok(en.includes(`At most ${MAX_PAPER_VISUALS} drawings`));
    assert.ok(ar.includes(`${MAX_PAPER_VISUALS} رسوم على الأكثر`));
    assert.match(en, /never refers to it/);
    assert.match(ar, /ولا يشير إليه/);
  });
});

describe("settlePaperVisuals", () => {
  it("ignores kinds that are not papers", () => {
    assert.equal(settlePaperVisuals("lesson-plan", { questions: [q(STEM, PROJ)] }, physics), null);
  });

  it("keeps a valid drawing on a physics quiz, rebuilt from the gate", () => {
    const paper = { questions: [q(STEM, { ...PROJ, extra: "x" })] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: 1 }, dropped: {} });
    assert.deepEqual(paper.questions[0]!.visual, PROJ);
  });

  it("removes every drawing from a paper that is not physics", () => {
    const paper = { questions: [q(STEM, PROJ), q("x")] };
    const s = settlePaperVisuals("quiz", paper, { subject: "Chemistry" })!;
    assert.deepEqual(s, { physics: false, kept: {}, dropped: { "not-physics": 1 } });
    assert.ok(!("visual" in paper.questions[0]!));
  });

  it("drops a drawing the gate refuses, and keeps its question", () => {
    const paper = { questions: [q(STEM, { ...PROJ, angle: 85 })] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s.dropped, { gate: 1 });
    assert.equal(paper.questions.length, 1);
    assert.ok(!("visual" in paper.questions[0]!));
  });

  it("drops a drawing that shows a number the question does not state", () => {
    const paper = { questions: [q("قُذفت كرة بزاوية 30°. احسب سرعتها الابتدائية.", PROJ)] };
    assert.deepEqual(settlePaperVisuals("quiz", paper, physics)!.dropped, { numbers: 1 });
  });

  it("reads only the stem: a number in the options or the answer does not count", () => {
    const paper = { questions: [{ ...q("قُذفت كرة بزاوية 30°. ما سرعتها؟", PROJ), options: ["20 م/ث", "10 م/ث"], correctAnswer: "20 م/ث" }] };
    assert.deepEqual(settlePaperVisuals("quiz", paper, physics)!.dropped, { numbers: 1 });
  });

  it(`keeps the first ${MAX_PAPER_VISUALS} in paper order on a worksheet, across sections`, () => {
    const sec = (n: number) => ({ title: "s", questions: Array.from({ length: n }, () => q(STEM, PROJ)) });
    const paper = { sections: [sec(4), sec(4)] };
    const s = settlePaperVisuals("worksheet", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { projectile: MAX_PAPER_VISUALS }, dropped: { cap: 8 - MAX_PAPER_VISUALS } });
    const flags = paper.sections.flatMap(x => x.questions.map(y => "visual" in y));
    assert.deepEqual(flags, [true, true, true, true, true, true, false, false]);
  });

  it("removes an explicit null and a drawing on a question with no text", () => {
    const paper = { questions: [q(STEM, null), { id: "q2", type: "short_answer", visual: PROJ }] };
    const s = settlePaperVisuals("homework", { sections: [{ questions: paper.questions }] }, physics)!;
    assert.deepEqual(s.dropped, { gate: 1, numbers: 1 });
  });

  it("accepts physics vectors, and refuses a function graph on a physics paper", () => {
    const vec = { kind: "vectors", vectors: [{ from: [0, 0], to: [3, 0], label: "A" }, { from: [0, 0], to: [0, 4], label: "B" }] };
    const graph = { kind: "function-graph", functions: [{ expr: "x^2", label: "f" }], x: [-2, 2] };
    const paper = { questions: [q("A = 3 N و B = 4 N متعامدتان", vec), q("x", graph)] };
    const s = settlePaperVisuals("quiz", paper, physics)!;
    assert.deepEqual(s, { physics: true, kept: { vectors: 1 }, dropped: { gate: 1 } });
  });

  it("never throws on a malformed paper", () => {
    for (const p of [null, 1, "x", [], { questions: "x" }, { sections: [null, { questions: [null, 1] }] }]) {
      assert.doesNotThrow(() => settlePaperVisuals("quiz", p, physics));
      assert.doesNotThrow(() => settlePaperVisuals("worksheet", p, physics));
    }
  });
});
```

- [ ] **Step 2: Run, and see it fail** because the module is missing. Command: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/paperVisuals.test.ts`.

- [ ] **Step 3: Implement** `artifacts/api-server/src/lib/paperVisuals.ts`:

```ts
/**
 * Drawings on a generated quiz, worksheet or homework (physics only).
 *
 * The model may give a question one `"visual"` (a sibling of `"text"`). Nothing it
 * writes there is trusted: on the finished paper — after top-ups, merges and trims,
 * just before it is pooled — every drawing is gated (`resolvePhysicsFigure`), checked
 * against its own question's text (`figureNumbersInText`: every number it prints must
 * be stated, so it can repeat a given but never show an answer), and capped at
 * MAX_PAPER_VISUALS in paper order. A drawing that fails is removed; its question
 * always stays, which is why the prompt makes the text answerable without it.
 * Spec: docs/superpowers/specs/2026-11-13-physics-figures-design.md §2.
 */
import { figureNumbersInText, resolvePhysicsFigure } from "@workspace/figure";

import { physicsFigureFormatAr, physicsFigureFormatEn } from "./figurePrompt.ts";
import { subjectIdOf } from "./lessonKinds.ts";

export const MAX_PAPER_VISUALS = 6;

export type VisualDropReason = "gate" | "numbers" | "cap" | "not-physics";
export type VisualsSummary = {
  physics: boolean;
  kept: Record<string, number>;
  dropped: Partial<Record<VisualDropReason, number>>;
};

const PAPER_KINDS = new Set(["quiz", "worksheet", "homework"]);

/** A physics request, by its subject id or its subject's name (either language). */
export function isPhysicsRequest(body: { subject?: unknown; subjectId?: unknown } | undefined): boolean {
  if (!body) return false;
  const subject = typeof body.subject === "string" ? body.subject : undefined;
  const subjectId = typeof body.subjectId === "string" ? body.subjectId : undefined;
  return subjectIdOf({ subject, subjectId }) === "physics";
}

/** The prompt's drawing rules, or "" for any other subject, so its prompt stays byte for byte the same. */
export function physicsVisualClauseAr(b: { subject?: unknown; subjectId?: unknown }): string {
  if (!isPhysicsRequest(b)) return "";
  return `\nالرسوم (للفيزياء فقط): يجوز أن يحمل السؤال حقلًا اختياريًا واحدًا "visual" بجانب "text" حيث يفيد الرسم: قوى تؤثر في جسم، أو مقذوف، أو حركة دائرية، أو موجة، أو جسمان يتجاذبان، أو متجهات. ${MAX_PAPER_VISUALS} رسوم على الأكثر في الورقة كلها. يجب أن يذكر نص السؤال كل ما يلزم للإجابة دون الرسم، ولا يشير إليه («في الشكل»، «المبيّن»): الرسم الذي يخالف قاعدة يُحذف ويبقى السؤال وحده.\n${physicsFigureFormatAr()}`;
}

export function physicsVisualClauseEn(b: { subject?: unknown; subjectId?: unknown }): string {
  if (!isPhysicsRequest(b)) return "";
  return `\nDrawings (physics only): a question MAY carry one optional "visual" field, a sibling of "text", where a drawing helps: forces on a body, a projectile, circular motion, a wave, two attracting bodies, or vectors. At most ${MAX_PAPER_VISUALS} drawings in the whole paper. The question text must state everything needed to answer without the drawing, and never refers to it ("in the figure", "shown"): a drawing that breaks a rule is removed and the question stands alone.\n${physicsFigureFormatEn()}`;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);

/** The paper's questions in paper order: a quiz's `questions`, or every section's `questions`. */
function paperQuestions(kind: string, parsed: unknown): Rec[] {
  if (!isRec(parsed)) return [];
  if (kind === "quiz") return Array.isArray(parsed.questions) ? parsed.questions.filter(isRec) : [];
  if (!Array.isArray(parsed.sections)) return [];
  return parsed.sections.filter(isRec).flatMap(s => (Array.isArray(s.questions) ? s.questions.filter(isRec) : []));
}

/**
 * Settle every question's drawing in place. Returns what was kept (by kind) and dropped
 * (by reason), or null for a kind that is not a paper. Never throws.
 */
export function settlePaperVisuals(kind: string, parsed: unknown, body: Record<string, unknown>): VisualsSummary | null {
  if (!PAPER_KINDS.has(kind)) return null;
  const physics = isPhysicsRequest(body);
  const summary: VisualsSummary = { physics, kept: {}, dropped: {} };
  const drop = (q: Rec, reason: VisualDropReason) => {
    delete q.visual;
    summary.dropped[reason] = (summary.dropped[reason] ?? 0) + 1;
  };
  let kept = 0;
  for (const q of paperQuestions(kind, parsed)) {
    if (!("visual" in q)) continue;
    if (!physics) { drop(q, "not-physics"); continue; }
    const figure = resolvePhysicsFigure(q.visual);
    if (!figure) { drop(q, "gate"); continue; }
    if (typeof q.text !== "string" || !figureNumbersInText(figure, q.text)) { drop(q, "numbers"); continue; }
    if (kept >= MAX_PAPER_VISUALS) { drop(q, "cap"); continue; }
    q.visual = figure;
    kept += 1;
    summary.kept[figure.kind] = (summary.kept[figure.kind] ?? 0) + 1;
  }
  return summary;
}
```

> Note: `"visual": null` counts as present and is dropped with reason `gate`. The test above relies on that.

- [ ] **Step 4: Run, and see it pass.** If `@workspace/figure` does not resolve `SCENE_LIMITS` or `vectorsShowResult`, Task 1 is missing; stop and report.

- [ ] **Step 5: Commit** `paperVisuals.ts` and its test: "API: settle a paper's drawings — gate, numbers, cap of 6".

---

### Task 4: The quiz and worksheet prompts carry the clause for physics only

**Files:**
- Modify: `artifacts/api-server/src/lib/prompts.ts`: `worksheetPromptAr`, `worksheetPromptEn`, `quizPromptAr`, `quizPromptEn`
- Create: `artifacts/api-server/src/lib/__tests__/physicsPromptClause.test.ts`

**Interfaces:**
- Consumes: `physicsVisualClauseAr/En` (Task 3).

- [ ] **Step 1: Write the failing test** at `artifacts/api-server/src/lib/__tests__/physicsPromptClause.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn } from "../prompts.ts";
import { physicsVisualClauseAr, physicsVisualClauseEn } from "../paperVisuals.ts";

const base = { grade: "Grade 10", topic: "المقذوفات", numQuestions: 8, questionTypes: ["multiple_choice", "short_answer"], additionalContext: "ctx" };

describe("physics drawing clause in the paper prompts", () => {
  const physics = { ...base, subject: "Physics" };
  const cases: [string, (b: any) => string, (b: any) => string][] = [
    ["quizAr", quizPromptAr, physicsVisualClauseAr],
    ["quizEn", quizPromptEn, physicsVisualClauseEn],
    ["worksheetAr", worksheetPromptAr, physicsVisualClauseAr],
    ["worksheetEn", worksheetPromptEn, physicsVisualClauseEn],
    ["homeworkAr", (b) => worksheetPromptAr({ ...b, homework: true }), physicsVisualClauseAr],
  ];
  for (const [name, prompt, clause] of cases) {
    it(`${name}: a physics prompt carries the clause once, before the JSON shape`, () => {
      const text = prompt(physics);
      const at = text.indexOf(clause(physics));
      assert.ok(at > 0, "clause present");
      assert.equal(text.indexOf(clause(physics), at + 1), -1, "only once");
      const shape = Math.max(text.indexOf("أعد JSON"), text.indexOf("Return JSON"));
      assert.ok(at < shape, "before the output shape");
    });
    it(`${name}: no other subject mentions "visual"`, () => {
      for (const subject of ["Mathematics", "Chemistry", "Biology", "الرياضيات"]) {
        assert.ok(!prompt({ ...base, subject }).includes('"visual"'), subject);
      }
    });
  }
});
```

- [ ] **Step 2: Run, and see it fail**: the physics prompts lack the clause.

- [ ] **Step 3: Implement.** In `prompts.ts`, add `import { physicsVisualClauseAr, physicsVisualClauseEn } from "./paperVisuals.ts";` next to the other `./` imports. In each of the four functions, append the clause **at the end of the `additionalContext` line**, so that for every other subject the clause is `""` and not one byte moves:

- `worksheetPromptAr`, the line
  `${b.additionalContext ? `\nسياق الكتاب المدرسي (استخدمه لصياغة أسئلة دقيقة ومرتبطة بالمنهج):\n${b.additionalContext}` : ""}`
  becomes the same line followed by `${physicsVisualClauseAr(b)}`.
- `worksheetPromptEn`: the `Textbook context` line, followed by `${physicsVisualClauseEn(b)}`.
- `quizPromptAr`: the `سياق الكتاب المدرسي` line, followed by `${physicsVisualClauseAr(b)}`.
- `quizPromptEn`: the `Textbook context` line, followed by `${physicsVisualClauseEn(b)}`.

Use the Edit tool for each: four edits, `old_string` taken exactly from the file. The two worksheet lines and the two quiz lines are textually identical, so include a neighbouring line in each `old_string` to make it unique.

- [ ] **Step 4: Byte-identity check against the capture from pre-flight:**

```bash
cat > /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-after.ts <<'EOF'
import { readFileSync } from "node:fs";
import { quizPromptAr, quizPromptEn, worksheetPromptAr, worksheetPromptEn } from "/home/user/wt-physics-figures-2/artifacts/api-server/src/lib/prompts.ts";
const before = JSON.parse(readFileSync("/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-before.json", "utf8")) as Record<string, string>;
let bad = 0;
for (const [key, text] of Object.entries(before)) {
  const [fn, subject] = key.split("|");
  const b = { subject, grade: "Grade 10", topic: "t", numQuestions: 8, questionTypes: ["multiple_choice", "short_answer"], additionalContext: "ctx" };
  const now = fn === "quizAr" ? quizPromptAr(b) : fn === "quizEn" ? quizPromptEn(b) : fn === "wsAr" ? worksheetPromptAr(b) : fn === "wsEn" ? worksheetPromptEn(b) : worksheetPromptAr({ ...b, homework: true });
  if (now !== text) { bad++; console.log("CHANGED", key); }
}
console.log(bad === 0 ? "all 45 prompts byte-identical" : `${bad} changed`);
process.exit(bad === 0 ? 0 : 1);
EOF
cd artifacts/api-server && node --experimental-strip-types /tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad/prompts-after.ts
```

Expected: `all 45 prompts byte-identical`.

- [ ] **Step 5: Run the prompt tests**: `node --experimental-strip-types --test src/lib/__tests__/physicsPromptClause.test.ts src/lib/__tests__/quizPrompts.test.ts src/lib/__tests__/prompts.test.ts src/lib/__tests__/difficultyPrompts.test.ts src/lib/__tests__/lessonKindPrompts.test.ts`. All must pass.

- [ ] **Step 6: Commit** `prompts.ts` and the new test: "API: physics quiz and worksheet prompts offer one drawing per question".

---

### Task 5: Physics papers get their own pool partition

**Files:**
- Modify: `artifacts/api-server/src/lib/generationKey.ts`
- Test: `artifacts/api-server/src/lib/__tests__/generationKey.test.ts`

**Interfaces:**
- Consumes: `subjectIdOf` (`./lessonKinds.ts`). It is pure; `generationKey.ts` must stay free of DB/OpenAI imports, and `lessonKinds.ts` imports only `@workspace/math-practice`.

- [ ] **Step 1: Write the failing tests.** Append to `generationKey.test.ts`. The three literals were computed on this branch's base, `33880d0`, with model `gpt-4o-mini`:

```ts
describe("drawings partition physics papers, and only them", () => {
  const MODEL = "gpt-4o-mini";
  const mathsQuiz = { subject: "Mathematics", grade: "Grade 10", topic: "المتجهات", lessonId: "kbl-math-x", numQuestions: 10, questionTypes: ["multiple_choice", "true_false"], language: "arabic", contextSource: "curriculum" };
  const chemistryWorksheet = { subject: "Chemistry", grade: "Grade 10", topic: "المول", lessonId: "kbl-chem-x", numQuestions: 8, questionTypes: ["short_answer"], language: "arabic", contextSource: "curriculum" };
  const physicsLessonPlan = { subject: "Physics", grade: "Grade 10", topic: "المقذوفات", lessonId: "kbl-phys-x", language: "arabic", contextSource: "curriculum" };

  it("leaves every other key exactly as it was (pinned before the change)", () => {
    assert.equal(generationKeys("quiz", MODEL, mathsQuiz).strictKey, "e9fcdeb7b80b47e7");
    assert.equal(generationKeys("worksheet", MODEL, chemistryWorksheet).strictKey, "766d78d4a0fe36b2");
    assert.equal(generationKeys("lesson-plan", MODEL, physicsLessonPlan).strictKey, "1f0ca89b4b9dc1ca");
  });

  it("moves a physics quiz, worksheet and homework to a new strict key, coarse key unchanged", () => {
    for (const kind of ["quiz", "worksheet", "homework"]) {
      const phys = { ...physicsLessonPlan, numQuestions: 8, questionTypes: ["short_answer"] };
      const asPhysics = generationKeys(kind, MODEL, phys);
      // Same body, but the id says chemistry: `subjectId` is in neither key, so only `drawings` differs.
      const notPhysics = generationKeys(kind, MODEL, { ...phys, subjectId: "chemistry" });
      assert.notEqual(asPhysics.strictKey, notPhysics.strictKey, kind);
      assert.equal(asPhysics.coarseKey, notPhysics.coarseKey, `${kind}: coarse key never carries drawings`);
    }
    // A lesson plan is not a paper: no partition.
    const plan = generationKeys("lesson-plan", MODEL, physicsLessonPlan);
    assert.equal(plan.strictKey, generationKeys("lesson-plan", MODEL, { ...physicsLessonPlan, subjectId: "chemistry" }).strictKey);
  });

  it("the field depends on the subject id too, not only the name", () => {
    const a = generationKeys("quiz", MODEL, { ...mathsQuiz, subject: "x", subjectId: "physics" });
    const b = generationKeys("quiz", MODEL, { ...mathsQuiz, subject: "x" });
    assert.notEqual(a.strictKey, b.strictKey);
    assert.equal(a.coarseKey, b.coarseKey);
  });
});
```

> The second test relies on two facts:
> - `subjectId: "chemistry"` overrides the name, because `subjectIdOf` prefers the id.
> - `subjectId` is in neither key today (it is not in `shared` or `STRICT_ONLY_FIELDS`), so the only difference between the two bodies is the new field.

- [ ] **Step 2: Run, and see it fail.** The pinned assertions pass, which proves the literals; the other two fail. Command: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/generationKey.test.ts`.

- [ ] **Step 3: Implement.** In `generationKey.ts`, add `import { subjectIdOf } from "./lessonKinds.ts";` after the `./coverage.ts` import. In `generationKeys`, right after `strict.bookFigures = hasBookFigures(body);`, add:

```ts
  // A physics paper may carry drawings (paperVisuals.ts). Papers pooled before
  // drawings existed have none, so physics papers get their own partition; every
  // other key is untouched. Bump the value if the drawing contract changes.
  if ((kind === "quiz" || kind === "worksheet" || kind === "homework")
    && subjectIdOf({
      subject: typeof body.subject === "string" ? body.subject : undefined,
      subjectId: typeof body.subjectId === "string" ? body.subjectId : undefined,
    }) === "physics") {
    strict.drawings = "physics-1";
  }
```

- [ ] **Step 4: Run, and see the whole file pass.**

- [ ] **Step 5: Commit** `generationKey.ts` and its test: "API: physics papers get their own pool partition for drawings".

---

### Task 6: The route settles drawings before storing, and logs them

**Files:**
- Modify: `artifacts/api-server/src/routes/generate.ts`
- Create: `artifacts/api-server/src/routes/__tests__/paperVisualsWiring.test.ts`

**Interfaces:**
- Consumes: `settlePaperVisuals`, `isPhysicsRequest` (Task 3).

- [ ] **Step 1: Write the failing test.** A source-order test; the route imports the OpenAI client and cannot be loaded bare. `paperOrder.test.ts` reads source the same way. File: `artifacts/api-server/src/routes/__tests__/paperVisualsWiring.test.ts`:

```ts
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../generate.ts", import.meta.url), "utf8");

describe("the generate route settles a paper's drawings", () => {
  it("once, after every merge and trim, before the artifact is stored", () => {
    const calls = src.split("settlePaperVisuals(").length - 1;
    assert.equal(calls, 1, "called exactly once");
    const at = src.indexOf("settlePaperVisuals(");
    assert.ok(at > src.lastIndexOf("trimWorksheet("), "after the worksheet trim");
    assert.ok(at > src.lastIndexOf("absorbQuizTopUp("), "after the quiz top-up");
    assert.ok(at < src.indexOf("storeVariant({"), "before storing");
  });
  it('logs "paper visuals" with kind, lessonId, kept and dropped', () => {
    assert.match(src, /\{ kind, lessonId: lessonRefOf\(body\), kept: visuals\.kept, dropped: visuals\.dropped \},\s*"paper visuals"/);
  });
  it("gives a physics paper more output room for its drawings, in both ceilings", () => {
    const body = (name: string) => src.slice(src.indexOf(`function ${name}`), src.indexOf("\n}\n", src.indexOf(`function ${name}`)));
    for (const name of ["quizTokens", "worksheetTokens"]) {
      assert.ok(body(name).includes("isPhysicsRequest(body) ? PHYSICS_VISUAL_TOKENS : 0"), name);
    }
  });
});
```

- [ ] **Step 2: Run, and see it fail.** Command: `cd artifacts/api-server && node --experimental-strip-types --test src/routes/__tests__/paperVisualsWiring.test.ts`.

- [ ] **Step 3: Implement** in `routes/generate.ts`:

1. Add `import { isPhysicsRequest, settlePaperVisuals } from "../lib/paperVisuals.ts";` beside the other `../lib/` imports.

2. Above `function quizTokens`, add the constant:

```ts
/**
 * Room for a physics paper's drawings: at most six specs of a few hundred
 * characters each. A ceiling, not a spend.
 */
const PHYSICS_VISUAL_TOKENS = 1500;
```

In both functions, add the term inside the min:
- `quizTokens`: `return Math.min(24000, Math.max(GENERATION_TOKENS, 2500 + 800 * n) + (isPhysicsRequest(body) ? PHYSICS_VISUAL_TOKENS : 0));`
- `worksheetTokens`: `return Math.min(24000, Math.max(GENERATION_TOKENS, 3000 + 900 * n) + (isPhysicsRequest(body) ? PHYSICS_VISUAL_TOKENS : 0));`

For a non-physics body the value is unchanged.

3. In `generateContent`'s `run`, immediately **before** the `// A lesson explanation is read by a student…` comment (that is, after the worksheet block's closing `}`), add:

```ts
    // A paper's drawings are settled once, on the finished paper — after top-ups,
    // repeats and trims, so a merged question's drawing is gated like any other —
    // and before anything is pooled. See lib/paperVisuals.ts.
    if (kind === "quiz" || kind === "worksheet" || kind === "homework") {
      const visuals = settlePaperVisuals(kind, chosen.parsed, body);
      if (visuals && (visuals.physics || Object.keys(visuals.dropped).length > 0)) {
        logger.info(
          { kind, lessonId: lessonRefOf(body), kept: visuals.kept, dropped: visuals.dropped },
          "paper visuals",
        );
      }
    }
```

The homework route passes `body: { ...body, homework: true }` with the subject intact, so `isPhysicsRequest(body)` holds for it too.

- [ ] **Step 4: Run, and see the wiring test pass**, then the whole API suite: `cd artifacts/api-server && pnpm build && pnpm test`. Expected: all pass. Report the totals.

- [ ] **Step 5: Commit** `generate.ts` and the wiring test: "API: settle physics drawings on every quiz and worksheet before it is pooled".

---

### Task 7: Docs and the full check

**Files:**
- Modify: `docs/status-log.md` (a new entry at the TOP, under the header, above «lib/figure: physics scenes …»)

- [ ] **Step 1: Write the log entry**, titled `## Physics quizzes and worksheets ask for drawings, and the server checks them — 2026-11-13`. Plain, short sentences, in the style of the entries around it. Cover:
  - **What it does.** The physics quiz, worksheet and homework prompts offer one optional `"visual"` per question (`paperVisuals.ts`, `physicsFigureFormatAr/En`), quoted from `SCENE_LIMITS`.
  - **The checks.** `settlePaperVisuals` runs once on the finished paper before it is pooled: gate, then numbers (stem only), then the cap of 6 in paper order. A drawing that fails is removed and its question stays. The log line is «paper visuals».
  - **Vectors are now judged:** their non-zero components count as printed numbers, and a drawn sum or difference of two drawn vectors is refused.
  - **Pool.** The strict key gets `drawings: "physics-1"` for physics papers only, so each physics paper kind regenerates once per lesson. Every other subject's prompt and key is byte for byte the same; this was checked against 45 captured prompts and 3 pinned keys.
  - **Not verified:**
    - no live model has written a drawing (the OpenAI key is out of credit);
    - the app does not draw them yet (PR 3), so a served physics paper carries `visual` fields nobody shows;
    - the evaluation generator and the offline generators make no drawings.
  - **«ما الجديد»:** none; nothing a user sees changes until PR 3.

- [ ] **Step 2: Run everything CI runs.** Report each count.

```bash
cd /home/user/wt-physics-figures-2
pnpm run typecheck
(cd lib/figure && pnpm test)
(cd artifacts/api-server && pnpm build && pnpm test)
(cd artifacts/mobile && pnpm test)        # silent for minutes; that is normal
```

- [ ] **Step 3: Commit** `docs/status-log.md`: "Docs: physics drawings on the server".

---

## After the plan (controller)

- Final whole-branch review on the most capable model, against spec §2 and this plan's Global Constraints.
- Push `claude/physics-figures-2` and open a **draft** PR with base `claude/physics-figures-1`. Retarget it to `main` when #1443 merges.
- Known conflict ahead: NizarAbuahmad/Iqraa#1422 also edits `generationKey.ts` (`keyTermsHash`) and the same four prompt functions (a key-terms clause). Whichever merges second merges `main` in and keeps both; neither change touches the other's lines.
