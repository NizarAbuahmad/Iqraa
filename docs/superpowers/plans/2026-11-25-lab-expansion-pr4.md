# Lab expansion PR 4: projectile, fluid-pressure and buoyancy tools — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three in-house interactive tools join the Science Lab, each on its own lesson:
- **projectile motion**, Grade 10 «الحركة في بعدين»;
- **fluid pressure**, Grade 9 «المائعُ الساكنُ»;
- **buoyant force**, Grade 10 «الموائع السكونية».

Each tool's numbers come from a pure, tested module that reproduces the book's worked examples.

**Architecture:** This follows `LabVectorAddition`: an SVG scene, −/+ steppers sized for a projector, and a results card. Every number comes from a pure module in `artifacts/mobile/services/` with its own test, so what is drawn is what was tested.

The −/+ stepper is copied privately into each tool file today. It moves into a shared `components/lab/LabControls.tsx` first, together with the mole calculator's result row, so the three new tools do not copy it a third, fourth and fifth time. Each tool is then:
- an id appended to `LAB_INTERACTIVE_IDS`;
- its component in `LabInteractive`'s `Record`;
- a lab item in `lab_items.json`.

**Tech Stack:** TypeScript, `react-native-svg`, `node:test`, Expo / React Native (web build for the visual check).

**Spec:** `docs/superpowers/specs/2026-11-13-lab-expansion-design.md` §4 (as corrected by PR 2: «`g` is the value the tool's own book uses»), *Scope and order* item 4. It builds on:
- PR 1: NizarAbuahmad/Iqraa#1447;
- PR 2: `docs/superpowers/plans/2026-11-13-lab-expansion-pr2.md`. Its `FILES` table in `lab.test.ts` includes Grade 9 physics, which Task 5's Grade 9 item needs;
- PR 3: `docs/superpowers/plans/2026-11-24-lab-expansion-pr3.md`.

## Global Constraints

- **Prerequisite:** PRs 1–3 are merged to `main`. Start from the latest `origin/main`, in a fresh branch or in the session branch restarted from `origin/main` if its PR merged. PR 4 is its own pull request.
- **The books' numbers, not general references.** Each value below is cited to a page of the book's extracted text, `lib/curriculum/src/data/extracted/<file>`, by PDF page.
  - **Grade 10 projectile** (phys-s1 p.59–62): `g = 9.8 m/s²`.
    - Worked example: `v0 = 22.5 m/s`, `θ = 53°`, with the book rounding sin 53° = 0.8 and cos 53° = 0.6. Results: maximum height `16.5 m`, time of flight `3.68 s`, range `49.68 m`.
    - Horizontal launch from `1.5 m`: `t = 0.55 s`.
  - **Grade 9 fluid pressure** (g9-physics-s2 p.15, 20–21): `g = 10 m/s²` and `P0 = 1 × 10⁵ Pa`.
    - Water `1 × 10³ kg/m³`: at 20 m, P = 3 × 10⁵ Pa; at 40 m, P = 5 × 10⁵ Pa.
    - Mercury `13.6 × 10³ kg/m³`: a 0.35 m column gives ρhg = 4.76 × 10⁴ Pa.
  - **Grade 10 buoyancy** (phys-s2 p.59, 64–66, 71): `g = 10 m/s²`. Densities: sea water `1024`, glycerin `1.3 × 10³` (p.71) and water `1000`.
    - p.64: at h = 30 m in sea water, P = 3.07 × 10⁵ Pa.
    - p.65: 0.3 kg of fluid displaced gives FB = 3 N, an object of weight 9 N, and an apparent weight of 6 N.
    - p.66 (the sink/float table): ρf = 1200, ρo = 970, Vo = 0.004 m³ → the object floats.
- Steppers are chosen so a teacher can set the book's worked example on the projector:
  - v0 in 0.5 m/s steps (22.5 is reachable);
  - θ in 1° steps (53 is reachable);
  - launch height in 0.5 m steps (1.5 is reachable).
- Maths in Latin; Arabic digits only at display time, through `formatLabNumber` / `formatLabQuantity` (`services/labFormat.ts`). A unit is never printed next to a number. It lives in the row's label, as the mole calculator's «الكتلة المولية (غ/مول)» does. This avoids the bidi scrambling CLAUDE.md warns about.
- Corner components (`components/lab/*`) take theme colours from `useColors()`, never `palette`. Fixed fluid/vector hues are hex constants in the component, as `LabVectorAddition` does. No hand-written `shadowColor`.
- `<Ionicons size>` only on the scale (14/16/20/24, 32/40/48/64). Touch targets are at least 44 × 44.
- New ids are **appended** to `LAB_INTERACTIVE_IDS`. Existing lab item ids never change.
- Mobile tests live in `artifacts/mobile/services/__tests__/`, import no `react-native`/`expo-*`, and use explicit `.ts` relative imports.
- Edit with the Edit tool; never `sed -i` / `perl -pi`. Read the `git diff` of `i18n.ts` and `lab_items.json` after editing.

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `artifacts/mobile/services/labSteps.ts` (+ test) | Create | Stepper value lists, index clamping |
| `artifacts/mobile/components/lab/LabControls.tsx` | Create | `LabStepper`, `LabResultRow`, `LabQuantity`, `LabChoice` |
| `artifacts/mobile/components/lab/LabVectorAddition.tsx`, `LabMoleCalculator.tsx` | Modify | Use the shared controls (no behaviour change) |
| `artifacts/mobile/services/labProjectile.ts` (+ test) | Create | Flight maths, path, fit-to-box |
| `artifacts/mobile/components/lab/LabProjectile.tsx` | Create | The projectile tool |
| `artifacts/mobile/services/labFluids.ts` (+ test) | Create | Fluids table, pressure, buoyancy |
| `artifacts/mobile/components/lab/LabFluidPressure.tsx`, `LabBuoyancy.tsx` | Create | The two fluids tools |
| `lib/curriculum/src/lab.ts`, `lib/curriculum/src/data/lab_items.json` | Modify | Three ids, three items |
| `artifacts/mobile/components/lab/LabInteractive.tsx` | Modify | Three `Record` entries |
| `artifacts/mobile/services/i18n.ts` | Modify | Tool labels (ar + en), What's New keys |
| `artifacts/mobile/services/whatsNew.ts`, `docs/status-log.md`, the spec | Modify | Entry, log, status |

---

### Task 1: Shared lab controls

A pure refactor. The vector tool and the mole calculator behave exactly as before.

**Files:**
- Create: `artifacts/mobile/services/labSteps.ts`
- Test: `artifacts/mobile/services/__tests__/labSteps.test.ts`
- Create: `artifacts/mobile/components/lab/LabControls.tsx`
- Modify: `artifacts/mobile/components/lab/LabVectorAddition.tsx`, `artifacts/mobile/components/lab/LabMoleCalculator.tsx`

**Interfaces:**
- Produces:
  - `stepValues(from: number, to: number, step: number): number[]`
  - `stepIndex(i: number, length: number, dir: -1 | 1): number`
  - `LabStepper({ label, value, onMinus, onPlus, colors, isRTL })`: the vector tool's `Stepper`, unchanged.
  - `LabResultRow({ label, children, colors, align })` and `LabQuantity({ q })`: the mole calculator's `ResultRow` and `Quantity`, unchanged.
  - `LabChoice({ options, value, onChange, colors, isRTL })`: one-of-N chips.
  - Types `StepperColors`, `ChoiceColors`.

- [ ] **Step 1: Failing tests for the step helpers**

Create `artifacts/mobile/services/__tests__/labSteps.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { stepIndex, stepValues } from '../labSteps.ts';

describe('stepValues', () => {
  it('runs from start to end inclusive', () => {
    assert.deepEqual(stepValues(0, 20, 5), [0, 5, 10, 15, 20]);
  });
  it('never shows floating-point noise', () => {
    const v = stepValues(0, 1, 0.05);
    assert.equal(v.length, 21);
    assert.equal(v[6], 0.3);
    assert.equal(v[20], 1);
  });
  it('reaches the book example on a half-step list', () => {
    assert.ok(stepValues(5, 30, 0.5).includes(22.5));
  });
});

describe('stepIndex', () => {
  it('moves one place and stops at both ends', () => {
    assert.equal(stepIndex(2, 5, 1), 3);
    assert.equal(stepIndex(4, 5, 1), 4);
    assert.equal(stepIndex(0, 5, -1), 0);
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSteps.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the helpers**

Create `artifacts/mobile/services/labSteps.ts`:

```ts
/**
 * The values a lab stepper walks through. Pure, so `node --test` can load it.
 * A stepper holds an INDEX into one of these lists, so a value outside the
 * list can never be shown, and float steps never print 0.30000000000000004.
 */
export function stepValues(from: number, to: number, step: number): number[] {
  const n = Math.round((to - from) / step);
  return Array.from({ length: n + 1 }, (_, i) => Number((from + i * step).toFixed(6)));
}

/** One place along a list of `length`, stopping at both ends. */
export function stepIndex(i: number, length: number, dir: -1 | 1): number {
  return Math.min(length - 1, Math.max(0, i + dir));
}
```

Run the test again. Expected: PASS (4 tests).

- [ ] **Step 4: Move the controls**

Create `artifacts/mobile/components/lab/LabControls.tsx`. Into it:
- **Move** `function Stepper` from `LabVectorAddition.tsx` verbatim, renamed `export function LabStepper`, with its styles `stepper`, `stepBtn` and `stepText`.
- **Move** `function ResultRow` and `function Quantity` from `LabMoleCalculator.tsx` verbatim, renamed `export function LabResultRow` and `export function LabQuantity`, with the styles they use (`row`, `value`, `exp`, copied exactly from `LabMoleCalculator.tsx`'s `StyleSheet`).
- Export `type StepperColors = { foreground: string; mutedForeground: string; muted: string }` and use it for `LabStepper`'s `colors` prop.
- Add:

```tsx
export type ChoiceColors = { primary: string; primaryForeground: string; muted: string; foreground: string };

/** One of a few options as chips: a fluid, a mode. 44-point targets, `aria-selected` state. */
export function LabChoice({
  options,
  value,
  onChange,
  colors,
  isRTL,
}: {
  options: readonly { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
  colors: ChoiceColors;
  isRTL: boolean;
}) {
  return (
    <View style={[choiceStyles.row, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {options.map(o => {
        const on = o.id === value;
        return (
          <Pressable
            key={o.id}
            onPress={() => onChange(o.id)}
            accessibilityRole="button"
            aria-selected={on}
            style={[choiceStyles.chip, { backgroundColor: on ? colors.primary : colors.muted }]}
          >
            <Text style={{ color: on ? colors.primaryForeground : colors.foreground, fontFamily: 'ReadexPro_500Medium' }}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const choiceStyles = StyleSheet.create({
  row: { flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, paddingHorizontal: 16, borderRadius: 999, alignItems: 'center', justifyContent: 'center' },
});
```

In `LabVectorAddition.tsx`:
- import `LabStepper` from `./LabControls`;
- replace each `<Stepper` with `<LabStepper`;
- delete the local `Stepper` and the three moved styles.

In `LabMoleCalculator.tsx`:
- import `LabResultRow` and `LabQuantity` from `./LabControls`;
- rename the uses;
- delete the local definitions and the moved styles. Keep any style the file still uses itself.

- [ ] **Step 5: Typecheck and the mobile suite**

Run: root `pnpm run typecheck`, then `cd artifacts/mobile && pnpm test`. The mobile suite prints nothing for minutes; that is not a hang.
Expected: PASS. `git diff --stat` shows the two tool files shrinking by the moved blocks and nothing else changing in them.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/labSteps.ts artifacts/mobile/services/__tests__/labSteps.test.ts artifacts/mobile/components/lab/LabControls.tsx artifacts/mobile/components/lab/LabVectorAddition.tsx artifacts/mobile/components/lab/LabMoleCalculator.tsx
git diff --cached --stat
git commit -m "refactor(lab): shared stepper, result row and choice chips"
```

---

### Task 2: Projectile maths

**Files:**
- Create: `artifacts/mobile/services/labProjectile.ts`
- Test: `artifacts/mobile/services/__tests__/labProjectile.test.ts`

**Interfaces:**
- Produces:
  - `G_PROJECTILE = 9.8`
  - `type Launch = { v0: number; angleDeg: number; height: number; g?: number }`
  - `type Flight = { vx: number; vy: number; time: number; range: number; maxHeight: number; leavesGround: boolean }`
  - `flight(l: Launch): Flight`
  - `flightPath(l: Launch, samples?: number): { x: number; y: number }[]`
  - `fitToBox(points: { x: number; y: number }[], width: number, height: number, pad?: number): { x: number; y: number }[]`

- [ ] **Step 1: Failing tests**

Create `artifacts/mobile/services/__tests__/labProjectile.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { G_PROJECTILE, fitToBox, flight, flightPath } from '../labProjectile.ts';

const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

describe('flight — the book's worked examples (phys-s1 p.59–62, g = 9.8)', () => {
  it('uses the book\'s g', () => {
    assert.equal(G_PROJECTILE, 9.8);
  });
  it('v0 = 22.5 m/s at 53°: max height 16.5 m, T 3.68 s, R 49.68 m', () => {
    // The book rounds sin 53° to 0.8 and cos 53° to 0.6; exact trigonometry lands within 0.1.
    const f = flight({ v0: 22.5, angleDeg: 53, height: 0 });
    near(f.maxHeight, 16.5, 0.1, 'max height');
    near(f.time, 3.68, 0.1, 'time of flight');
    near(f.range, 49.68, 0.1, 'range');
    assert.equal(f.leavesGround, true);
  });
  it('launched horizontally from 1.5 m, it lands after 0.55 s', () => {
    near(flight({ v0: 5, angleDeg: 0, height: 1.5 }).time, 0.55, 0.01, 'time');
  });
});

describe('flight — identities that catch a wrong formula', () => {
  it('complementary angles give the same range from the ground', () => {
    near(flight({ v0: 20, angleDeg: 30, height: 0 }).range, flight({ v0: 20, angleDeg: 60, height: 0 }).range, 1e-9, '30 vs 60');
  });
  it('45° gives the longest range from the ground', () => {
    const r = (a: number) => flight({ v0: 20, angleDeg: a, height: 0 }).range;
    assert.ok(r(45) > r(40) && r(45) > r(50));
  });
  it('straight up has no range', () => {
    assert.equal(flight({ v0: 20, angleDeg: 90, height: 0 }).range, 0);
  });
  it('a horizontal launch from the ground never leaves it', () => {
    const f = flight({ v0: 20, angleDeg: 0, height: 0 });
    assert.equal(f.leavesGround, false);
    assert.equal(f.time, 0);
    assert.equal(f.range, 0);
  });
  it('the time from a height is √(2h/g) when launched flat', () => {
    near(flight({ v0: 3, angleDeg: 0, height: 20 }).time, Math.sqrt((2 * 20) / 9.8), 1e-9, 'time');
  });
});

describe('flightPath and fitToBox', () => {
  it('starts at the launch point and ends on the ground at the range', () => {
    const l = { v0: 22.5, angleDeg: 53, height: 0 };
    const p = flightPath(l, 40);
    assert.equal(p.length, 41);
    assert.deepEqual(p[0], { x: 0, y: 0 });
    near(p[40].x, flight(l).range, 1e-9, 'end x');
    near(p[40].y, 0, 1e-6, 'end y');
    assert.ok(p.every(q => q.y >= 0));
  });
  it('a body that never leaves the ground has a one-point path', () => {
    assert.deepEqual(flightPath({ v0: 20, angleDeg: 0, height: 0 }), [{ x: 0, y: 0 }]);
  });
  it('fits every point inside the box, ground at the bottom, shape kept', () => {
    const box = fitToBox(flightPath({ v0: 22.5, angleDeg: 53, height: 0 }), 320, 200, 20);
    assert.ok(box.every(q => q.x >= 20 - 1e-9 && q.x <= 300 + 1e-9 && q.y >= 20 - 1e-9 && q.y <= 180 + 1e-9));
    near(box[0].y, 180, 1e-9, 'launch on the ground line');
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labProjectile.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labProjectile.ts`:

```ts
/**
 * Projectile motion for the lab's interactive (Grade 10, «الحركة في بعدين»).
 * Latin maths, degrees in, SI units, no air resistance, as the book.
 *
 * `g` is the book's own: the Grade 10 physics worked examples use 9.8 m/s²
 * (phys-s1 p.59–62). The tests pin those examples.
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §4.
 */
export const G_PROJECTILE = 9.8;

const RAD = Math.PI / 180;
const EPS = 1e-9;

export type Launch = { v0: number; angleDeg: number; height: number; g?: number };
export type Flight = { vx: number; vy: number; time: number; range: number; maxHeight: number; leavesGround: boolean };

/** cos 90° is 6e-17, not 0; anything that small is 0. */
const tidy = (n: number) => (Math.abs(n) < EPS ? 0 : n);

export function flight({ v0, angleDeg, height, g = G_PROJECTILE }: Launch): Flight {
  const vx = tidy(v0 * Math.cos(angleDeg * RAD));
  const vy = tidy(v0 * Math.sin(angleDeg * RAD));
  // Lands when height + vy·t − ½·g·t² = 0: the root after launch.
  const t = (vy + Math.sqrt(vy * vy + 2 * g * height)) / g;
  const leavesGround = t > EPS;
  const time = leavesGround ? t : 0;
  return {
    vx,
    vy,
    time,
    range: tidy(vx * time),
    maxHeight: height + (vy > 0 ? (vy * vy) / (2 * g) : 0),
    leavesGround,
  };
}

/** `samples + 1` points from launch to landing (metres, y up from the ground). */
export function flightPath(l: Launch, samples = 40): { x: number; y: number }[] {
  const f = flight(l);
  const g = l.g ?? G_PROJECTILE;
  if (!f.leavesGround) return [{ x: 0, y: l.height }];
  return Array.from({ length: samples + 1 }, (_, i) => {
    const t = (f.time * i) / samples;
    return { x: tidy(f.vx * t), y: Math.max(0, l.height + f.vy * t - 0.5 * g * t * t) };
  });
}

/**
 * Metres to screen: one scale for both axes (the curve keeps its true shape),
 * the ground on the bottom padding line, the launch point on the left one.
 */
export function fitToBox(points: { x: number; y: number }[], width: number, height: number, pad = 20): { x: number; y: number }[] {
  const maxX = Math.max(EPS, ...points.map(p => p.x));
  const maxY = Math.max(EPS, ...points.map(p => p.y));
  const scale = Math.min((width - 2 * pad) / maxX, (height - 2 * pad) / maxY);
  return points.map(p => ({ x: pad + p.x * scale, y: height - pad - p.y * scale }));
}
```

- [ ] **Step 4: See them pass**

Run the same command. Expected: PASS (11 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labProjectile.ts artifacts/mobile/services/__tests__/labProjectile.test.ts
git commit -m "feat(lab): projectile maths pinned to the Grade 10 book's examples"
```

---

### Task 3: The projectile tool

**Files:**
- Create: `artifacts/mobile/components/lab/LabProjectile.tsx`
- Modify: `lib/curriculum/src/lab.ts` (`LAB_INTERACTIVE_IDS`), `lib/curriculum/src/data/lab_items.json`, `artifacts/mobile/components/lab/LabInteractive.tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes: `flight`, `flightPath`, `fitToBox` (Task 2); `stepValues`, `stepIndex`, `LabStepper`, `LabResultRow`, `LabQuantity` (Task 1); `formatLabNumber`, `formatLabQuantity` (`services/labFormat.ts`).
- Produces: interactive id `projectile-motion` and lab item `lab-projectile-motion`.

- [ ] **Step 1: The id, the item, the Record entry**

In `lib/curriculum/src/lab.ts`, change `LAB_INTERACTIVE_IDS` to

```ts
export const LAB_INTERACTIVE_IDS = ['periodic-table', 'mole-calculator', 'vector-addition', 'projectile-motion'] as const;
```

In `lib/curriculum/src/data/lab_items.json`, append after the last row (comma on the previous closing `}`):

```json
    {
      "id": "lab-projectile-motion",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "projectile-motion",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s1-nccd-u2_l2",
      "titleAr": "حركة المقذوف تفاعليًا",
      "titleEn": "Interactive Projectile Motion"
    }
```

In `components/lab/LabInteractive.tsx`, import `LabProjectile` from `./LabProjectile` and add `'projectile-motion': LabProjectile,` to `COMPONENTS`. The `Record` type refuses to compile without it.

In `lib/curriculum/src/__tests__/lab.test.ts`, rename `it('ships the three flagship interactives, once each', …)` to `it('ships every interactive, once each', …)`. The body stays.

- [ ] **Step 2: Labels**

In `services/i18n.ts`, `ar` block, after `labVecResultant`:

```ts
    labProjV0: 'السرعة الابتدائية v0 (m/s)',
    labProjAngle: 'زاوية الإطلاق θ (°)',
    labProjHeight: 'ارتفاع الإطلاق (m)',
    labProjTime: 'زمن التحليق T (s)',
    labProjRange: 'المدى الأفقي R (m)',
    labProjMaxHeight: 'أقصى ارتفاع (m)',
    labProjGrounded: 'بهذه القيم لا يغادر الجسم الأرض.',
    labProjNote: 'تسارع السقوط الحر g = 9.8 m/s²، كما في أمثلة الكتاب، ومقاومة الهواء مهملة.',
```

`en` block, after `labVecResultant`:

```ts
    labProjV0: 'Launch speed v0 (m/s)',
    labProjAngle: 'Launch angle θ (°)',
    labProjHeight: 'Launch height (m)',
    labProjTime: 'Time of flight T (s)',
    labProjRange: 'Horizontal range R (m)',
    labProjMaxHeight: 'Maximum height (m)',
    labProjGrounded: 'With these values the body does not leave the ground.',
    labProjNote: 'Free-fall acceleration g = 9.8 m/s², as in the book\'s examples; air resistance is ignored.',
```

- [ ] **Step 3: The component**

Create `artifacts/mobile/components/lab/LabProjectile.tsx`:

```tsx
/**
 * Projectile motion: launch speed, angle and height on −/+ steppers, the path
 * drawn to scale, and T, R and the maximum height. Every number comes from
 * services/labProjectile.ts, which the book's worked examples pin.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { fitToBox, flight, flightPath } from '@/services/labProjectile';
import { stepIndex, stepValues } from '@/services/labSteps';
import { formatLabNumber } from '@/services/labFormat';
import { LabResultRow, LabStepper } from './LabControls';

const W = 320;
const H = 200;
const PAD = 20;
const SPEEDS = stepValues(5, 30, 0.5);
const ANGLES = stepValues(0, 90, 1);
const HEIGHTS = stepValues(0, 20, 0.5);
const PATH_COLOR = '#F97316';

export function LabProjectile() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [vi, setVi] = useState(SPEEDS.indexOf(20));
  const [ai, setAi] = useState(ANGLES.indexOf(45));
  const [hi, setHi] = useState(0);
  const launch = { v0: SPEEDS[vi], angleDeg: ANGLES[ai], height: HEIGHTS[hi] };
  // Cheap enough to recompute on every render: 41 points.
  const f = flight(launch);
  const pts = fitToBox(flightPath(launch), W, H, PAD);
  const peak = pts.reduce((best, p) => (p.y < best.y ? p : best), pts[0]);

  return (
    <View style={styles.wrap}>
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Line x1={0} y1={H - PAD} x2={W} y2={H - PAD} stroke={colors.mutedForeground} strokeWidth={2} />
          {pts.length > 1 ? (
            <Polyline points={pts.map(p => `${p.x},${p.y}`).join(' ')} fill="none" stroke={PATH_COLOR} strokeWidth={3} />
          ) : null}
          <Circle cx={pts[0].x} cy={pts[0].y} r={6} fill={colors.primary} />
          {f.leavesGround ? <Circle cx={peak.x} cy={peak.y} r={4} fill={PATH_COLOR} /> : null}
        </Svg>
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LabStepper label={t('labProjV0')} value={formatLabNumber(launch.v0, lang, 1)} colors={colors} isRTL={isRTL}
          onMinus={() => setVi(i => stepIndex(i, SPEEDS.length, -1))} onPlus={() => setVi(i => stepIndex(i, SPEEDS.length, 1))} />
        <LabStepper label={t('labProjAngle')} value={formatLabNumber(launch.angleDeg, lang, 0)} colors={colors} isRTL={isRTL}
          onMinus={() => setAi(i => stepIndex(i, ANGLES.length, -1))} onPlus={() => setAi(i => stepIndex(i, ANGLES.length, 1))} />
        <LabStepper label={t('labProjHeight')} value={formatLabNumber(launch.height, lang, 1)} colors={colors} isRTL={isRTL}
          onMinus={() => setHi(i => stepIndex(i, HEIGHTS.length, -1))} onPlus={() => setHi(i => stepIndex(i, HEIGHTS.length, 1))} />
      </View>

      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        {f.leavesGround ? (
          <>
            <LabResultRow label={t('labProjTime')} colors={colors} align={align}>
              <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(f.time, lang, 2)}</Text>
            </LabResultRow>
            <LabResultRow label={t('labProjRange')} colors={colors} align={align}>
              <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(f.range, lang, 2)}</Text>
            </LabResultRow>
            <LabResultRow label={t('labProjMaxHeight')} colors={colors} align={align}>
              <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(f.maxHeight, lang, 2)}</Text>
            </LabResultRow>
          </>
        ) : (
          <Text style={{ color: colors.foreground, textAlign: align, fontFamily: 'Almarai_400Regular' }}>{t('labProjGrounded')}</Text>
        )}
      </View>
      <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>{t('labProjNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  value: { fontSize: 20, fontFamily: 'ReadexPro_700Bold' },
});
```

If `LabResultRow`'s `colors` prop needs fields `useColors()` does not have under those names, adapt the call, not the shared component. If `formatLabNumber`'s signature differs from `(n, lang, maxFractionDigits)`, read `services/labFormat.ts` and follow it.

- [ ] **Step 4: Tests and typecheck**

Run:
- `pnpm --filter @workspace/curriculum test`. Expect: `lab.test.ts` passes, including "names a lesson that exists" and "files every item under its own lesson's grade". The known `r2.test.ts` environmental failure is not this task's.
- `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labSlides.test.ts services/__tests__/labLessons.test.ts`. Expect PASS: the interactive becomes a share-link slide, and the lesson resolves.
- Root `pnpm run typecheck`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/lab/LabProjectile.tsx lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json lib/curriculum/src/__tests__/lab.test.ts artifacts/mobile/components/lab/LabInteractive.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): interactive projectile motion for Grade 10"
```

---

### Task 4: Fluids maths

**Files:**
- Create: `artifacts/mobile/services/labFluids.ts`
- Test: `artifacts/mobile/services/__tests__/labFluids.test.ts`

**Interfaces:**
- Produces:
  - `G_FLUIDS = 10` and `ATMOSPHERE = 1e5`
  - `type FluidId = 'water' | 'mercury' | 'sea-water' | 'glycerin'`
  - `FLUID_DENSITY: Record<FluidId, number>`
  - `fluidPressure(p: { density: number; depth: number; openToAir: boolean; g?: number }): { gauge: number; total: number }`
  - `type FloatState = 'sinks' | 'floats' | 'suspended'`
  - `buoyancy(b: { objectDensity: number; objectVolume: number; fluidDensity: number; g?: number }): { weight: number; buoyantForce: number; apparentWeight: number; submergedFraction: number; state: FloatState }`

- [ ] **Step 1: Failing tests**

Create `artifacts/mobile/services/__tests__/labFluids.test.ts`:

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ATMOSPHERE, FLUID_DENSITY, G_FLUIDS, buoyancy, fluidPressure } from '../labFluids.ts';

const near = (a: number, b: number, tol: number, msg: string) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

describe('the books\' constants', () => {
  it('g = 10 and P0 = 1 × 10⁵ Pa, as both fluids chapters use', () => {
    assert.equal(G_FLUIDS, 10);
    assert.equal(ATMOSPHERE, 1e5);
  });
  it('densities as printed: water, mercury (G9), sea water and glycerin (G10)', () => {
    assert.deepEqual(FLUID_DENSITY, { water: 1000, mercury: 13600, 'sea-water': 1024, glycerin: 1300 });
  });
});

describe('fluidPressure — Grade 9 worked examples (g9-physics-s2 p.15, p.21)', () => {
  it('water, open to the air: 3 × 10⁵ Pa at 20 m and 5 × 10⁵ Pa at 40 m', () => {
    assert.equal(fluidPressure({ density: 1000, depth: 20, openToAir: true }).total, 3e5);
    assert.equal(fluidPressure({ density: 1000, depth: 40, openToAir: true }).total, 5e5);
  });
  it('a 0.35 m mercury column: ρhg = 4.76 × 10⁴ Pa', () => {
    near(fluidPressure({ density: 13600, depth: 0.35, openToAir: false }).gauge, 4.76e4, 1e-6, 'gauge');
  });
  it('closed to the air, the total is the fluid\'s own pressure', () => {
    const p = fluidPressure({ density: 1000, depth: 20, openToAir: false });
    assert.equal(p.total, p.gauge);
  });
  it('sea water at 30 m: 3.07 × 10⁵ Pa (phys-s2 p.64)', () => {
    near(fluidPressure({ density: 1024, depth: 30, openToAir: false }).gauge, 3.072e5, 1e-6, 'gauge');
  });
});

describe('buoyancy — Grade 10 worked examples (phys-s2 p.64–66)', () => {
  it('a body that displaces 0.3 kg of water: FB = 3 N, weight 9 N, apparent weight 6 N (p.65)', () => {
    const b = buoyancy({ objectDensity: 3000, objectVolume: 3e-4, fluidDensity: 1000 });
    near(b.buoyantForce, 3, 1e-9, 'FB');
    near(b.weight, 9, 1e-9, 'weight');
    near(b.apparentWeight, 6, 1e-9, 'apparent');
    assert.equal(b.state, 'sinks');
  });
  it('ρo 970 in ρf 1200, Vo 0.004 m³ floats with FB = Fg (p.66)', () => {
    const b = buoyancy({ objectDensity: 970, objectVolume: 0.004, fluidDensity: 1200 });
    assert.equal(b.state, 'floats');
    near(b.buoyantForce, b.weight, 1e-9, 'FB = Fg');
    near(b.weight, 38.8, 1e-9, 'weight');
    near(b.submergedFraction, 970 / 1200, 1e-12, 'Vf / Vo');
    assert.equal(b.apparentWeight, 0);
  });
  it('a submarine of 250 m³ in sea water: FB = 2.56 × 10⁶ N (p.64)', () => {
    near(buoyancy({ objectDensity: 1100, objectVolume: 250, fluidDensity: 1024 }).buoyantForce, 2.56e6, 1e-3, 'FB');
  });
  it('equal densities are suspended, fully under, FB = Fg', () => {
    const b = buoyancy({ objectDensity: 1024, objectVolume: 1, fluidDensity: 1024 });
    assert.equal(b.state, 'suspended');
    assert.equal(b.submergedFraction, 1);
    near(b.buoyantForce, b.weight, 1e-9, 'FB = Fg');
  });
});
```

- [ ] **Step 2: See them fail**

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/labFluids.test.ts`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement**

Create `artifacts/mobile/services/labFluids.ts`:

```ts
/**
 * Fluids for the lab's two interactives: pressure at a depth (Grade 9,
 * «المائعُ الساكنُ») and the buoyant force (Grade 10, «الموائع السكونية»).
 * Latin maths, SI units, the books' own constants:
 *  - g = 10 m/s² and P0 = 1 × 10⁵ Pa: g9-physics-s2 p.15 and p.20 («1 atm ≈ 1.0 × 10⁵ Pa»), phys-s2 p.59 and p.64–68;
 *  - densities: water 1 × 10³ (g9 p.15), mercury 13.6 × 10³ (g9 p.20),
 *    sea water 1024 (phys-s2 p.59), glycerin 1.3 × 10³ (phys-s2 p.71).
 * Spec: docs/superpowers/specs/2026-11-13-lab-expansion-design.md §4.
 */
export const G_FLUIDS = 10;
export const ATMOSPHERE = 1e5;

export type FluidId = 'water' | 'mercury' | 'sea-water' | 'glycerin';
export const FLUID_DENSITY: Record<FluidId, number> = { water: 1000, mercury: 13600, 'sea-water': 1024, glycerin: 1300 };

/** P = ρhg below the surface; plus P0 when the surface is open to the air (P = P0 + ρhg). */
export function fluidPressure({ density, depth, openToAir, g = G_FLUIDS }: { density: number; depth: number; openToAir: boolean; g?: number }): { gauge: number; total: number } {
  const gauge = density * depth * g;
  return { gauge, total: openToAir ? ATMOSPHERE + gauge : gauge };
}

export type FloatState = 'sinks' | 'floats' | 'suspended';

/**
 * The book's table (phys-s2 p.66): ρo > ρf sinks, ρo < ρf floats with
 * Vf = (ρo/ρf)·Vo and FB = Fg, ρo = ρf is suspended. FB = ρf·Vf·g.
 */
export function buoyancy({ objectDensity, objectVolume, fluidDensity, g = G_FLUIDS }: { objectDensity: number; objectVolume: number; fluidDensity: number; g?: number }): {
  weight: number;
  buoyantForce: number;
  apparentWeight: number;
  submergedFraction: number;
  state: FloatState;
} {
  const weight = objectDensity * objectVolume * g;
  const same = Math.abs(objectDensity - fluidDensity) <= 1e-9 * Math.max(objectDensity, fluidDensity);
  const state: FloatState = same ? 'suspended' : objectDensity > fluidDensity ? 'sinks' : 'floats';
  const submergedFraction = state === 'floats' ? objectDensity / fluidDensity : 1;
  const buoyantForce = fluidDensity * submergedFraction * objectVolume * g;
  return { weight, buoyantForce, apparentWeight: state === 'sinks' ? weight - buoyantForce : 0, submergedFraction, state };
}
```

- [ ] **Step 4: See them pass**

Run the same command. Expected: PASS (10 tests).

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/labFluids.ts artifacts/mobile/services/__tests__/labFluids.test.ts
git commit -m "feat(lab): fluid pressure and buoyancy maths pinned to the books' examples"
```

---

### Task 5: The fluid-pressure and buoyancy tools

**Files:**
- Create: `artifacts/mobile/components/lab/LabFluidPressure.tsx`, `artifacts/mobile/components/lab/LabBuoyancy.tsx`
- Modify: `lib/curriculum/src/lab.ts`, `lib/curriculum/src/data/lab_items.json`, `artifacts/mobile/components/lab/LabInteractive.tsx`, `artifacts/mobile/services/i18n.ts`

**Interfaces:**
- Consumes:
  - `FLUID_DENSITY`, `fluidPressure`, `buoyancy`, `FluidId`, `FloatState` (Task 4);
  - `stepValues`, `stepIndex`, `LabStepper`, `LabResultRow`, `LabQuantity`, `LabChoice` (Task 1);
  - `formatLabNumber`, `formatLabQuantity`.
- Produces: interactive ids `fluid-pressure` and `buoyancy`, and lab items `lab-fluid-pressure` and `lab-buoyancy`.

- [ ] **Step 1: Ids, items, Record**

`LAB_INTERACTIVE_IDS` becomes

```ts
export const LAB_INTERACTIVE_IDS = ['periodic-table', 'mole-calculator', 'vector-addition', 'projectile-motion', 'fluid-pressure', 'buoyancy'] as const;
```

Append two rows to `lab_items.json`:

```json
    {
      "id": "lab-fluid-pressure",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "fluid-pressure",
      "gradeId": "grade-9",
      "subjectId": "physics",
      "lessonId": "kbl-g9-phys-s2-nccd-u4_l1",
      "titleAr": "ضغط المائع تفاعليًا",
      "titleEn": "Interactive Fluid Pressure"
    },
    {
      "id": "lab-buoyancy",
      "kind": "interactive",
      "origin": "original",
      "interactiveId": "buoyancy",
      "gradeId": "grade-10",
      "subjectId": "physics",
      "lessonId": "kbl-phys-s2-nccd-u5_l1",
      "titleAr": "قوة الطفو تفاعليًا",
      "titleEn": "Interactive Buoyant Force"
    }
```

Add `'fluid-pressure': LabFluidPressure,` and `buoyancy: LabBuoyancy,` to `LabInteractive.tsx`'s `COMPONENTS`, with their imports.

- [ ] **Step 2: Labels**

`ar` block, after the `labProj*` keys:

```ts
    labFluidWater: 'الماء',
    labFluidMercury: 'الزئبق',
    labFluidSeaWater: 'ماء البحر',
    labFluidGlycerin: 'الجليسرين',
    labFluidDepth: 'العمق h (m)',
    labFluidOpen: 'السطح مفتوح للهواء',
    labFluidClosed: 'دون الضغط الجوي',
    labFluidGauge: 'ضغط المائع ρhg (kPa)',
    labFluidTotal: 'الضغط الكلي P0 + ρhg (kPa)',
    labFluidNote: 'g = 10 m/s² و P0 = 100 kPa، كما في أمثلة الكتاب.',
    labBuoyDensity: 'كثافة الجسم ρo (kg/m³)',
    labBuoyVolume: 'حجم الجسم Vo (m³)',
    labBuoyWeight: 'وزن الجسم Fg (N)',
    labBuoyForce: 'قوة الطفو FB (N)',
    labBuoyApparent: 'الوزن الظاهري (N)',
    labBuoySubmerged: 'الجزء المغمور من الحجم (٪)',
    labBuoySinks: 'يغوص: كثافة الجسم أكبر من كثافة المائع.',
    labBuoyFloats: 'يطفو: كثافة الجسم أقل من كثافة المائع، وقوة الطفو تساوي وزنه.',
    labBuoySuspended: 'معلّق: كثافة الجسم تساوي كثافة المائع.',
```

`en` block:

```ts
    labFluidWater: 'Water',
    labFluidMercury: 'Mercury',
    labFluidSeaWater: 'Sea water',
    labFluidGlycerin: 'Glycerin',
    labFluidDepth: 'Depth h (m)',
    labFluidOpen: 'Open to the air',
    labFluidClosed: 'Without air pressure',
    labFluidGauge: 'Fluid pressure ρhg (kPa)',
    labFluidTotal: 'Total pressure P0 + ρhg (kPa)',
    labFluidNote: 'g = 10 m/s² and P0 = 100 kPa, as in the book\'s examples.',
    labBuoyDensity: 'Object density ρo (kg/m³)',
    labBuoyVolume: 'Object volume Vo (m³)',
    labBuoyWeight: 'Weight Fg (N)',
    labBuoyForce: 'Buoyant force FB (N)',
    labBuoyApparent: 'Apparent weight (N)',
    labBuoySubmerged: 'Volume under the surface (%)',
    labBuoySinks: 'Sinks: the object is denser than the fluid.',
    labBuoyFloats: 'Floats: the object is less dense than the fluid, and the buoyant force equals its weight.',
    labBuoySuspended: 'Suspended: the object and the fluid have the same density.',
```

- [ ] **Step 3: Fluid pressure (Grade 9)**

Create `artifacts/mobile/components/lab/LabFluidPressure.tsx`:

```tsx
/**
 * Pressure at a depth (Grade 9): water or mercury, the depth on a stepper, the
 * surface open to the air or not. Water goes to 50 m in 5 m steps, mercury to
 * 1 m in 5 cm steps (a column, as the book's barometer examples). Numbers from
 * services/labFluids.ts.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { FLUID_DENSITY, fluidPressure } from '@/services/labFluids';
import { stepIndex, stepValues } from '@/services/labSteps';
import { formatLabNumber } from '@/services/labFormat';
import { LabChoice, LabResultRow, LabStepper } from './LabControls';

const W = 320;
const H = 220;
const TOP = 30;
const BOTTOM = 200;
type G9Fluid = 'water' | 'mercury';
const DEPTHS: Record<G9Fluid, number[]> = { water: stepValues(0, 50, 5), mercury: stepValues(0, 1, 0.05) };
const COLOR: Record<G9Fluid, string> = { water: '#38BDF8', mercury: '#9CA3AF' };

export function LabFluidPressure() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [fluid, setFluid] = useState<G9Fluid>('water');
  const [di, setDi] = useState(4);
  const [open, setOpen] = useState(true);
  const depths = DEPTHS[fluid];
  const i = Math.min(di, depths.length - 1);
  const depth = depths[i];
  const p = fluidPressure({ density: FLUID_DENSITY[fluid], depth, openToAir: open });
  const y = TOP + (BOTTOM - TOP) * (depth / depths[depths.length - 1]);

  return (
    <View style={styles.wrap}>
      <LabChoice
        options={[{ id: 'water', label: t('labFluidWater') }, { id: 'mercury', label: t('labFluidMercury') }]}
        value={fluid}
        onChange={id => { setFluid(id as G9Fluid); setDi(4); }}
        colors={colors}
        isRTL={isRTL}
      />
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={110} y={TOP} width={100} height={BOTTOM - TOP} fill={COLOR[fluid]} opacity={0.5} />
          <Line x1={110} y1={TOP} x2={210} y2={TOP} stroke={colors.foreground} strokeWidth={2} />
          <Line x1={110} y1={y} x2={210} y2={y} stroke={colors.foreground} strokeWidth={1} strokeDasharray="4 4" />
          <Circle cx={160} cy={y} r={7} fill={colors.primary} />
          <Line x1={230} y1={TOP} x2={230} y2={y} stroke={colors.primary} strokeWidth={2} />
          <SvgText x={240} y={(TOP + y) / 2 + 5} fill={colors.primary} fontSize={16} fontWeight="bold">h</SvgText>
          {open ? <SvgText x={150} y={TOP - 10} fill={colors.foreground} fontSize={14}>P0</SvgText> : null}
        </Svg>
      </View>
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LabStepper label={t('labFluidDepth')} value={formatLabNumber(depth, lang, 2)} colors={colors} isRTL={isRTL}
          onMinus={() => setDi(stepIndex(i, depths.length, -1))} onPlus={() => setDi(stepIndex(i, depths.length, 1))} />
        <LabChoice
          options={[{ id: 'open', label: t('labFluidOpen') }, { id: 'closed', label: t('labFluidClosed') }]}
          value={open ? 'open' : 'closed'}
          onChange={id => setOpen(id === 'open')}
          colors={colors}
          isRTL={isRTL}
        />
      </View>
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        <LabResultRow label={t('labFluidGauge')} colors={colors} align={align}>
          <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(p.gauge / 1000, lang, 2)}</Text>
        </LabResultRow>
        {open ? (
          <LabResultRow label={t('labFluidTotal')} colors={colors} align={align}>
            <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(p.total / 1000, lang, 2)}</Text>
          </LabResultRow>
        ) : null}
      </View>
      <Text style={{ color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular', fontSize: 12 }}>{t('labFluidNote')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  value: { fontSize: 20, fontFamily: 'ReadexPro_700Bold' },
});
```

The default index 4 is 20 m of water: the book's first example (300 kPa), or 0.2 m of mercury.

- [ ] **Step 4: Buoyancy (Grade 10)**

Create `artifacts/mobile/components/lab/LabBuoyancy.tsx`:

```tsx
/**
 * The buoyant force (Grade 10): a fluid, an object's density and volume, and
 * where it settles — floating with the right fraction under the surface,
 * suspended, or on the bottom. Numbers from services/labFluids.ts.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import { useLanguage } from '@/context/LanguageContext';
import { FLUID_DENSITY, buoyancy, type FluidId } from '@/services/labFluids';
import { stepIndex } from '@/services/labSteps';
import { formatLabNumber, formatLabQuantity } from '@/services/labFormat';
import { LabChoice, LabQuantity, LabResultRow, LabStepper } from './LabControls';

const W = 320;
const H = 220;
const SURFACE = 70;
const FLOOR = 200;
const SIDE = 50;
type G10Fluid = Exclude<FluidId, 'mercury'>;
const FLUIDS: readonly G10Fluid[] = ['water', 'sea-water', 'glycerin'];
// Object densities to try, around the book's examples: 100 (p.68), 970 (p.66), 2500 (p.71) and the fluids themselves.
const DENSITIES = [100, 500, 970, 1000, 1024, 1300, 2500, 7800];
const VOLUMES = [0.001, 0.002, 0.004, 0.008, 0.016];
const COLOR: Record<G10Fluid, string> = { water: '#38BDF8', 'sea-water': '#0EA5E9', glycerin: '#FCD34D' };
const LABEL = { water: 'labFluidWater', 'sea-water': 'labFluidSeaWater', glycerin: 'labFluidGlycerin' } as const;
const STATE = { sinks: 'labBuoySinks', floats: 'labBuoyFloats', suspended: 'labBuoySuspended' } as const;

export function LabBuoyancy() {
  const colors = useColors();
  const { t, lang, isRTL } = useLanguage();
  const align = isRTL ? 'right' : 'left';
  const [fluid, setFluid] = useState<G10Fluid>('water');
  const [rho, setRho] = useState(DENSITIES.indexOf(970));
  const [vol, setVol] = useState(VOLUMES.indexOf(0.004));
  const b = buoyancy({ objectDensity: DENSITIES[rho], objectVolume: VOLUMES[vol], fluidDensity: FLUID_DENSITY[fluid] });
  const top =
    b.state === 'sinks' ? FLOOR - SIDE
    : b.state === 'suspended' ? (SURFACE + FLOOR) / 2 - SIDE / 2
    : SURFACE - SIDE * (1 - b.submergedFraction);
  const q = (n: number) => <LabQuantity q={formatLabQuantity(n, lang, 2)} />;

  return (
    <View style={styles.wrap}>
      <LabChoice
        options={FLUIDS.map(id => ({ id, label: t(LABEL[id]) }))}
        value={fluid}
        onChange={id => setFluid(id as G10Fluid)}
        colors={colors}
        isRTL={isRTL}
      />
      <View style={[styles.canvas, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`}>
          <Rect x={60} y={SURFACE} width={200} height={FLOOR - SURFACE} fill={COLOR[fluid]} opacity={0.5} />
          <Line x1={60} y1={SURFACE} x2={260} y2={SURFACE} stroke={colors.foreground} strokeWidth={2} />
          <Line x1={60} y1={FLOOR} x2={260} y2={FLOOR} stroke={colors.foreground} strokeWidth={3} />
          <Rect x={135} y={top} width={SIDE} height={SIDE} fill={colors.primary} rx={4} />
        </Svg>
      </View>
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <LabStepper label={t('labBuoyDensity')} value={formatLabNumber(DENSITIES[rho], lang, 0)} colors={colors} isRTL={isRTL}
          onMinus={() => setRho(i => stepIndex(i, DENSITIES.length, -1))} onPlus={() => setRho(i => stepIndex(i, DENSITIES.length, 1))} />
        <LabStepper label={t('labBuoyVolume')} value={formatLabNumber(VOLUMES[vol], lang, 3)} colors={colors} isRTL={isRTL}
          onMinus={() => setVol(i => stepIndex(i, VOLUMES.length, -1))} onPlus={() => setVol(i => stepIndex(i, VOLUMES.length, 1))} />
      </View>
      <View style={[styles.panel, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 2 }]}>
        <Text style={{ color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }}>{t(STATE[b.state])}</Text>
        <LabResultRow label={t('labBuoyWeight')} colors={colors} align={align}>{q(b.weight)}</LabResultRow>
        <LabResultRow label={t('labBuoyForce')} colors={colors} align={align}>{q(b.buoyantForce)}</LabResultRow>
        {b.state === 'sinks' ? (
          <LabResultRow label={t('labBuoyApparent')} colors={colors} align={align}>{q(b.apparentWeight)}</LabResultRow>
        ) : null}
        <LabResultRow label={t('labBuoySubmerged')} colors={colors} align={align}>
          <Text style={[styles.value, { color: colors.foreground }]}>{formatLabNumber(b.submergedFraction * 100, lang, 1)}</Text>
        </LabResultRow>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 16, gap: 12 },
  canvas: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  panel: { borderWidth: 1, borderRadius: 14, padding: 12, gap: 8 },
  value: { fontSize: 20, fontFamily: 'ReadexPro_700Bold' },
});
```

If `t(...)` is typed to `TranslationKey` and rejects the `as const` lookups, type `LABEL` and `STATE` as `Record<…, TranslationKey>` (import the type from `@/services/i18n`), as `KIND_LABEL` does in `app/curriculum/lab/index.tsx`.

- [ ] **Step 5: Tests, typecheck, browser**

Run:
- `pnpm --filter @workspace/curriculum test`. Expect PASS: `lab.test.ts` sees the Grade 9 item through PR 2's `FILES` row; the known `r2.test.ts` failure aside.
- Root `pnpm run typecheck`.
- `cd artifacts/mobile && pnpm test`. Expect PASS, including `labSlides`, `labLessons`, `cornerTheme`, `iconSystem` and `designScale`.

Browser: run `pnpm run dev:mobile:web` against a throwaway Postgres (the recipe in the PR 1 plan's Task 4; never read `.env`). Use Arabic, a phone at 390 × 844 and a desktop at 1280 × 800. Open each tool from the Lab's list:

- **Projectile.** Set v0 22.5 and θ 53: T ≈ ٣٫٦٧, R ≈ ٤٩٫٦٦, max height ≈ ١٦٫٤٨. Set θ 0 with height 0: the "does not leave the ground" line shows. Set θ 0 with height 1.5: T ≈ ٠٫٥٥.
- **Fluid pressure.** Water, 20 m, open: ρhg = ٢٠٠ and total = ٣٠٠. Mercury, 0.35: ρhg = ٤٧٫٦.
- **Buoyancy.** Glycerin (1300) with 970: floats, «الجزء المغمور» ≈ ٧٤٫٦. Water with 2500: sinks, and the apparent weight shows.
- In each tool, the steppers stop at both ends and numbers read left-to-right.

Take screenshots at deviceScaleFactor 2 into the scratchpad, one per tool: phone light for two of them and desktop dark for the third. Stop every server and the cluster.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/components/lab/LabFluidPressure.tsx artifacts/mobile/components/lab/LabBuoyancy.tsx lib/curriculum/src/lab.ts lib/curriculum/src/data/lab_items.json artifacts/mobile/components/lab/LabInteractive.tsx artifacts/mobile/services/i18n.ts
git diff --cached --stat
git commit -m "feat(lab): interactive fluid pressure (Grade 9) and buoyant force (Grade 10)"
```

---

### Task 6: «ما الجديد», status log, checks

**Files:**
- Modify: `artifacts/mobile/services/whatsNew.ts`, `artifacts/mobile/services/i18n.ts`, `docs/status-log.md`, the spec

- [ ] **Step 1: The entry**

Put this at the top of `WHATS_NEW`. `date` is the output of `TZ=Asia/Amman date +%F`. If `main` has a later-dated entry, place this one directly above the newest entry that is not later.

```ts
  {
    id: 'lab-physics-tools',
    date: '2026-11-26', // replace with the output of: TZ=Asia/Amman date +%F
    roles: ['teacher', 'student'],
    titleKey: 'whatsNewLabToolsTitle',
    bodyKey: 'whatsNewLabToolsBody',
    route: '/curriculum/lab',
  },
```

Keys. `ar`:

```ts
    whatsNewLabToolsTitle: 'أدوات فيزياء تفاعلية في «المختبر»',
    whatsNewLabToolsBody: 'جرّب في «المختبر» حركة المقذوف للصف العاشر، وضغط المائع للصف التاسع، وقوة الطفو للصف العاشر: غيّر القيم وشاهد النتيجة على السبّورة، بأرقام أمثلة الكتاب نفسها.',
```

`en`:

```ts
    whatsNewLabToolsTitle: 'Interactive physics tools in the Lab',
    whatsNewLabToolsBody: 'Try projectile motion (Grade 10), fluid pressure (Grade 9) and the buoyant force (Grade 10) in the Science Lab: change the values and watch the result on the board, with the same numbers as the book\'s examples.',
```

Run: `cd artifacts/mobile && node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test services/__tests__/whatsNew.test.ts`. Expected: PASS.

- [ ] **Step 2: Status log and spec**

At the top of `docs/status-log.md`, directly under the header paragraph:

```markdown
## Science Lab: projectile, fluid-pressure and buoyancy tools — 2026-11-26

PR 4 of `docs/superpowers/specs/2026-11-13-lab-expansion-design.md`.

**What changed.**
- Three interactives:
  - `projectile-motion`, Grade 10 «الحركة في بعدين»: g = 9.8, as phys-s1 p.59–62.
  - `fluid-pressure`, Grade 9 «المائعُ الساكنُ»: water or mercury, the surface open or not; g = 10 and P0 = 1 × 10⁵ Pa, as g9-physics-s2 p.15–21.
  - `buoyancy`, Grade 10 «الموائع السكونية»: water, sea water or glycerin; the book's sink/float table, phys-s2 p.64–66.
- Each tool's numbers come from a pure module, tested against the books' worked examples:
  - `labProjectile.ts`: 22.5 m/s at 53° → 16.5 m, 3.68 s, 49.68 m; and 0.55 s from 1.5 m.
  - `labFluids.ts`: 3 × 10⁵ Pa at 20 m of water; 4.76 × 10⁴ Pa for 0.35 m of mercury; FB 3 N with an apparent weight of 6 N; ρo 970 in ρf 1200 floats.
- The −/+ stepper, result row and choice chips moved to `components/lab/LabControls.tsx`. The vector tool and the mole calculator use them unchanged.

**Verified.**
- Root typecheck.
- Curriculum `test` (N/M; name any failure, e.g. `r2.test.ts` where R2 is configured locally) and `verify`.
- Mobile `pnpm test` (N tests, 0 failing).
- api-server build + test (N).
- math-verifier (ran / not run, and why).
- Browser: each tool reproduces its book example on screen, at phone and desktop sizes, in light and dark.

**Not done.** Refraction, thin lens and lever (PR 5).
```

Replace each N/M with the counts your runs printed. Correct any clause that did not hold. Use the same date as the What's New entry.

In the spec, make two changes:
- Update the status line to name PR 4 as built, matching what is merged by then.
- In §4's tool table, bring the Controls column in line with what shipped:
  - `projectile-motion`: v0 5–30 m/s (0.5), θ 0–90° (1), launch height 0–20 m (0.5). These steps let the teacher set the book example (22.5 m/s at 53°, and 1.5 m).
  - `fluid-pressure`: water depth 0–50 m (5) or mercury 0–1 m (0.05), and open to the air on/off.
  - `buoyancy`: object density from a list (100, 500, 970, 1000, 1024, 1300, 2500, 7800 kg/m³), volume from 0.001 to 0.016 m³, and water, sea water or glycerin.

- [ ] **Step 3: Run what CI runs**

```bash
pnpm run typecheck
```

```bash
pnpm --filter @workspace/curriculum test && pnpm --filter @workspace/curriculum run verify
```

```bash
cd artifacts/mobile && pnpm test
```

```bash
cd artifacts/api-server && pnpm build && pnpm test
```

```bash
cd artifacts/math-verifier && python -X utf8 test_equations.py
```

Expected: all PASS. If something cannot run here, report it rather than installing system packages.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/services/whatsNew.ts artifacts/mobile/services/i18n.ts docs/status-log.md docs/superpowers/specs/2026-11-13-lab-expansion-design.md
git diff --cached --stat
git commit -m "docs(lab): what's new, status log and spec status for the physics tools"
```

Then push and open a new PR titled «Science Lab: projectile, fluid-pressure and buoyancy tools». The body carries:
- what changed, with the book example behind each tool;
- the three screenshots;
- the What's New entry and its date note;
- «Deploy: web bundle and API (lib/ changed); no migration, no native change».
