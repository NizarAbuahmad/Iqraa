# Drawn Physics Figures (1/3): the Figure Package — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `lib/figure` can validate, lay out and draw five physics figure kinds (forces, attraction, projectile, circular, wave), check that every number a drawing prints is in its question, and draw them both as an SVG string and in the app — with no change for any existing caller.

**Architecture:** The physics kinds are a separate family (`SceneFigure`) with their own gate (`resolveSceneFigure`, `resolvePhysicsFigure`) and a new primitive layout (`layoutScene`) that both renderers draw (`figureSvg`, `SceneFigureView`). The existing `Figure` type, `resolveFigure`, `layoutFigure` and the plane renderer are untouched, so maths exams and lesson cards cannot receive a physics kind by accident.

**Tech Stack:** TypeScript, `node --test --experimental-strip-types`, react-native-svg (app renderer), Playwright/Chromium (by-eye PNG check).

**Spec:** `docs/superpowers/specs/2026-11-13-physics-figures-design.md`

**Refinement of the spec (recorded for the reviewer):** spec §1 says the new kinds join `Figure` and are gated "in `resolveFigure`". This plan keeps them in a separate union and resolver instead, because `resolveFigure`'s existing callers (maths exam generator, `studentVisual`, lesson cards) pass whatever it accepts to the plane renderer; widening it would let a maths paper store a `forces` figure that `layoutFigure` cannot draw. Behaviour the spec asks for is unchanged.

## Global Constraints

- Existing behaviour unchanged: `resolveFigure`, `Figure`, `layoutFigure`, `FigureLayout` and the plane path of `figureSvg` / `FigureView` keep their signatures and output (except the clip-id fix).
- Gate never repairs and never throws; anything outside a limit refuses the whole figure (`null`).
- Physics labels: 1–3 letters (Latin, Arabic, or Greek λ θ α β ω Δ μ), optional one digit and/or prime; never a number or number word.
- `PhysicsValue`: `n` finite, |n| ≤ 10⁶, ≤ 3 decimals; `unit` ∈ `m, cm, km, s, m/s, km/h, m/s², N, kg, g, °, Hz, J, W, Pa, N/m², kg/m³, g/cm³, m³, cm³`.
- `H` and `R` projectile marks never carry a value.
- Serialised spec ≤ 1500 bytes (`FIGURE_LIMITS.maxBytes`).
- Numbers and units drawn in Latin; Arabic only for the words «قمة» / «قاع».
- No native module; `app.json` `version` unchanged. No user-visible change in this PR.
- No `sed -i` / `perl -pi` on source (Arabic text). Use the Edit tool.
- Package tests: `cd lib/figure && pnpm test`. Mobile tests only under `artifacts/mobile/services/__tests__/`.

## File map

| File | Change |
|---|---|
| `lib/figure/src/sceneTypes.ts` | **Create.** Physics figure types, `AnyFigure`, `isSceneFigure` |
| `lib/figure/src/sceneGate.ts` | **Create.** `PHYSICS_UNITS`, `resolveSceneFigure`, `resolvePhysicsFigure` |
| `lib/figure/src/figureNumbers.ts` | **Create.** `foldDigits`, `figureNumbers`, `figureNumbersInText` |
| `lib/figure/src/scene.ts` | **Create.** `ScenePrim`, `layoutScene`, `formatValue` |
| `lib/figure/src/gate.ts` | Export `isNumberWord` |
| `lib/figure/src/geometry.ts` | Export `arrowHead` |
| `lib/figure/src/alt.ts` | `figureAltText(AnyFigure)` |
| `lib/figure/src/svg.ts` | `figureSvg(AnyFigure)`, scene drawing, unique clip id |
| `lib/figure/src/index.ts` | Export the new modules |
| `lib/figure/src/__tests__/{sceneGate,figureNumbers,scene}.test.ts` | **Create** |
| `lib/figure/src/__tests__/{svg,alt}.test.ts` | Add cases |
| `artifacts/mobile/components/ui/SceneFigureView.tsx` | **Create.** react-native-svg scene renderer |
| `artifacts/mobile/components/ui/FigureView.tsx` | Accept `AnyFigure`; delegate scenes |
| `docs/status-log.md` | Entry at the top |

---

### Task 1: Physics types and the gate

**Files:**
- Create: `lib/figure/src/sceneTypes.ts`, `lib/figure/src/sceneGate.ts`, `lib/figure/src/__tests__/sceneGate.test.ts`
- Modify: `lib/figure/src/gate.ts` (export `isNumberWord`), `lib/figure/src/index.ts`

**Interfaces:**
- Produces: types `PhysicsValue`, `ForcesFigure`, `AttractionFigure`, `ProjectileFigure`, `ProjectileMark`, `CircularFigure`, `WaveFigure`, `WaveMark`, `SceneFigure`, `PhysicsFigure`, `AnyFigure`; `SCENE_KINDS`; `isSceneFigure(f: AnyFigure): f is SceneFigure`; `PHYSICS_UNITS`; `resolveSceneFigure(raw: unknown): SceneFigure | null`; `resolvePhysicsFigure(raw: unknown): PhysicsFigure | null`; `isNumberWord(label: string): boolean` (from gate.ts).

- [ ] **Step 0: Prepare the worktree** (once, if not done)

Run from `/home/user/wt-physics-figures`: `pnpm install --frozen-lockfile && pnpm exec tsc --build`
Expected: install completes; tsc --build prints nothing or only finishes (CLAUDE.md: a fresh worktree needs both before typecheck/tests are trustworthy).

- [ ] **Step 1: Write the failing test** — `lib/figure/src/__tests__/sceneGate.test.ts`

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { resolvePhysicsFigure, resolveSceneFigure } from '../sceneGate.ts';
import { resolveFigure } from '../gate.ts';

const forces = (over: Record<string, unknown> = {}) => ({
  kind: 'forces', body: 'block',
  arrows: [{ dir: 270, size: 2, label: 'W' }, { dir: 90, size: 2, label: 'N' }],
  ...over,
});
const projectile = (over: Record<string, unknown> = {}) => ({
  kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'], ...over,
});

describe('resolveSceneFigure', () => {
  it('accepts each kind and drops unknown fields', () => {
    assert.deepEqual(resolveSceneFigure(forces({ junk: 1 })), forces());
    assert.deepEqual(resolveSceneFigure({ kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n: 2, unit: 'm' } } }),
      { kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n: 2, unit: 'm' } } });
    assert.deepEqual(resolveSceneFigure(projectile()), projectile());
    assert.deepEqual(resolveSceneFigure({ kind: 'projectile', launch: 'horizontal', height: { n: 45, unit: 'm' }, marks: ['R'] }),
      { kind: 'projectile', launch: 'horizontal', height: { n: 45, unit: 'm' }, marks: ['R'] });
    assert.deepEqual(resolveSceneFigure({ kind: 'circular', turning: 'ccw', arrows: ['F', 'v'] }),
      { kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] });
    assert.deepEqual(resolveSceneFigure({ kind: 'wave', cycles: 2, marks: ['lambda', 'crest'], wavelength: { n: 0.5, unit: 'm' } }),
      { kind: 'wave', cycles: 2, marks: ['crest', 'lambda'], wavelength: { n: 0.5, unit: 'm' } });
  });

  it('refuses junk and unknown kinds', () => {
    for (const raw of [null, 7, 'x', [], {}, { kind: 'pie' }, { kind: 'function-graph' }]) {
      assert.equal(resolveSceneFigure(raw), null, JSON.stringify(raw));
    }
  });

  it('forces: arrows 1–5, integer directions 0–359, sizes 1–3, distinct labels, incline only on a block', () => {
    assert.equal(resolveSceneFigure(forces({ arrows: [] })), null);
    assert.equal(resolveSceneFigure(forces({ arrows: Array.from({ length: 6 }, (_, i) => ({ dir: i * 10, size: 1, label: `F${i}` })) })), null);
    assert.equal(resolveSceneFigure(forces({ arrows: [{ dir: 360, size: 1, label: 'F' }] })), null);
    assert.equal(resolveSceneFigure(forces({ arrows: [{ dir: 12.5, size: 1, label: 'F' }] })), null);
    assert.equal(resolveSceneFigure(forces({ arrows: [{ dir: 0, size: 4, label: 'F' }] })), null);
    assert.equal(resolveSceneFigure(forces({ arrows: [{ dir: 0, size: 1, label: 'F' }, { dir: 90, size: 1, label: 'F' }] })), null);
    assert.ok(resolveSceneFigure(forces({ incline: 30 })));
    assert.equal(resolveSceneFigure(forces({ incline: 4 })), null);
    assert.equal(resolveSceneFigure(forces({ incline: 61 })), null);
    assert.equal(resolveSceneFigure(forces({ body: 'point', incline: 30 })), null);
  });

  it('labels never carry a value; Greek letters are allowed', () => {
    for (const label of ['20', 'F=20', 'ten', 'ستة', 'ABCD', '']) {
      assert.equal(resolveSceneFigure(forces({ arrows: [{ dir: 0, size: 1, label }] })), null, label);
    }
    for (const label of ['F', 'F1', "F'", 'mg', 'λ', 'θ', 'Δx', 'ق']) {
      assert.ok(resolveSceneFigure(forces({ arrows: [{ dir: 0, size: 1, label }] })), label);
    }
  });

  it('values: allowed units only, |n| ≤ 1e6, at most 3 decimals', () => {
    const withValue = (value: unknown) => forces({ arrows: [{ dir: 0, size: 1, label: 'F', value }] });
    assert.ok(resolveSceneFigure(withValue({ n: 12.5, unit: 'N' })));
    assert.ok(resolveSceneFigure(withValue({ n: 9.8, unit: 'm/s²' })));
    assert.equal(resolveSceneFigure(withValue({ n: 12, unit: 'newtons' })), null);
    assert.equal(resolveSceneFigure(withValue({ n: 1.2345, unit: 'N' })), null);
    assert.equal(resolveSceneFigure(withValue({ n: 2e6, unit: 'N' })), null);
    assert.equal(resolveSceneFigure(withValue({ n: '12', unit: 'N' })), null);
    assert.equal(resolveSceneFigure(withValue('12 N')), null);
  });

  it('projectile: ground needs an angle 10–80 and no height; horizontal has no angle and no H; speed needs the v0 mark', () => {
    assert.equal(resolveSceneFigure(projectile({ angle: undefined })), null);
    assert.equal(resolveSceneFigure(projectile({ angle: 85 })), null);
    assert.equal(resolveSceneFigure(projectile({ height: { n: 5, unit: 'm' } })), null);
    assert.equal(resolveSceneFigure({ kind: 'projectile', launch: 'horizontal', angle: 30, marks: [] }), null);
    assert.equal(resolveSceneFigure({ kind: 'projectile', launch: 'horizontal', marks: ['H'] }), null);
    assert.equal(resolveSceneFigure(projectile({ marks: ['H', 'R'] })), null);
    assert.equal(resolveSceneFigure(projectile({ marks: ['v0', 'v0'] })), null);
    assert.equal(resolveSceneFigure(projectile({ marks: ['v0', 'T'] })), null);
  });

  it('circular: 1–2 arrows, never F and a together; wave: cycles 1–3, known marks', () => {
    assert.equal(resolveSceneFigure({ kind: 'circular', turning: 'ccw', arrows: [] }), null);
    assert.equal(resolveSceneFigure({ kind: 'circular', turning: 'ccw', arrows: ['F', 'a'] }), null);
    assert.equal(resolveSceneFigure({ kind: 'circular', turning: 'up', arrows: ['v'] }), null);
    assert.equal(resolveSceneFigure({ kind: 'wave', cycles: 4, marks: [] }), null);
    assert.equal(resolveSceneFigure({ kind: 'wave', cycles: 1, marks: ['peak'] }), null);
    assert.ok(resolveSceneFigure({ kind: 'wave', cycles: 1, marks: [], second: { phase: 'out', sum: true } }));
    assert.equal(resolveSceneFigure({ kind: 'wave', cycles: 1, marks: [], second: { phase: 'sideways', sum: true } }), null);
  });

  it('attraction: two distinct body labels and a force label that is neither', () => {
    assert.equal(resolveSceneFigure({ kind: 'attraction', bodies: ['m', 'm'], force: 'F' }), null);
    assert.equal(resolveSceneFigure({ kind: 'attraction', bodies: ['m1'], force: 'F' }), null);
    assert.equal(resolveSceneFigure({ kind: 'attraction', bodies: ['m1', 'm2'], force: 'm1' }), null);
  });

  it('drops unknown fields before the 1500-byte cap is measured (no valid scene can reach the cap)', () => {
    assert.deepEqual(resolveSceneFigure(forces({ pad: 'x'.repeat(2000) })), forces());
  });
});

describe('resolvePhysicsFigure', () => {
  it('accepts scenes and vectors, but not a function graph', () => {
    assert.ok(resolvePhysicsFigure(forces()));
    assert.ok(resolvePhysicsFigure({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2], label: 'u' }] }));
    assert.equal(resolvePhysicsFigure({ kind: 'function-graph', functions: [{ expr: 'x' }], x: [-2, 2] }), null);
  });
});

describe('resolveFigure is unchanged', () => {
  it('still refuses every physics kind', () => {
    assert.equal(resolveFigure(forces()), null);
    assert.equal(resolveFigure(projectile()), null);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lib/figure && node --experimental-strip-types --test src/__tests__/sceneGate.test.ts`
Expected: FAIL — cannot find module `../sceneGate.ts`.

- [ ] **Step 3: Export `isNumberWord` from gate.ts**

In `lib/figure/src/gate.ts` change
```ts
const isNumberWord = (label: string): boolean => NUMBER_WORDS.has(label.replace(/[0-9'′]+$/u, '').toLowerCase());
```
to
```ts
export const isNumberWord = (label: string): boolean => NUMBER_WORDS.has(label.replace(/[0-9'′]+$/u, '').toLowerCase());
```

- [ ] **Step 4: Create `lib/figure/src/sceneTypes.ts`**

```ts
/**
 * Physics figures: drawn as a scene (a block and its forces, a projectile's path,
 * a wave…), not on a coordinate plane. A separate family from `Figure` on purpose:
 * `resolveFigure`'s callers (maths exams, lesson cards) hand what it accepts to the
 * plane renderer, so a physics kind must never pass through it. Physics papers use
 * `resolvePhysicsFigure`, which accepts these kinds and plane `vectors`.
 */
import type { Figure, VectorsFigure } from './types.ts';

/** A given printed on the drawing, e.g. 20 m/s. Every one must also be in the question (`figureNumbersInText`). */
export type PhysicsValue = { n: number; unit: string };

export type ForcesFigure = {
  kind: 'forces';
  body: 'block' | 'point';
  /** Degrees, 5–60: the block sits on a slope rising to the right. */
  incline?: number;
  /** Direction in degrees counter-clockwise from the +x axis (270 is straight down). */
  arrows: { dir: number; size: 1 | 2 | 3; label: string; value?: PhysicsValue }[];
};

export type AttractionFigure = {
  kind: 'attraction';
  bodies: [string, string];
  /** The label on both arrows: the pair is equal and opposite. */
  force: string;
  distance?: { label: string; value?: PhysicsValue };
};

export type ProjectileMark = 'v0' | 'vx' | 'vy' | 'H' | 'R';

export type ProjectileFigure = {
  kind: 'projectile';
  launch: 'ground' | 'horizontal';
  /** Ground launch only, degrees 10–80. */
  angle?: number;
  /** Shown with the v0 mark, which it requires. */
  speed?: PhysicsValue;
  /** Horizontal launch only: the height it leaves from. */
  height?: PhysicsValue;
  /** H and R are what questions ask for, so they are never given a value. */
  marks: ProjectileMark[];
};

export type CircularFigure = {
  kind: 'circular';
  radius?: { label: string; value?: PhysicsValue };
  turning: 'cw' | 'ccw';
  /** v is tangent; F or a points to the centre (never both). */
  arrows: ('v' | 'F' | 'a')[];
};

export type WaveMark = 'crest' | 'trough' | 'A' | 'lambda';

export type WaveFigure = {
  kind: 'wave';
  cycles: 1 | 2 | 3;
  marks: WaveMark[];
  /** A second wave in or out of phase, and optionally their sum. */
  second?: { phase: 'in' | 'out'; sum: boolean };
  amplitude?: PhysicsValue;
  wavelength?: PhysicsValue;
};

export type SceneFigure = ForcesFigure | AttractionFigure | ProjectileFigure | CircularFigure | WaveFigure;
/** What a physics paper question may carry. */
export type PhysicsFigure = SceneFigure | VectorsFigure;
/** Anything a renderer can draw. */
export type AnyFigure = Figure | SceneFigure;

export const SCENE_KINDS = ['forces', 'attraction', 'projectile', 'circular', 'wave'] as const;

export const isSceneFigure = (f: AnyFigure): f is SceneFigure => (SCENE_KINDS as readonly string[]).includes(f.kind);
```

- [ ] **Step 5: Create `lib/figure/src/sceneGate.ts`**

```ts
/**
 * The gate for physics figures. Same contract as `resolveFigure`: never repairs,
 * never throws, refuses the whole figure on any breach, and a label can never hold
 * a value. A value (a given like 20 m/s) is a separate field, and the CALLER checks
 * that each one appears in the question (`figureNumbersInText`).
 */
import { FIGURE_LIMITS, isNumberWord, resolveFigure } from './gate.ts';
import type {
  AttractionFigure, CircularFigure, ForcesFigure, PhysicsFigure, PhysicsValue,
  ProjectileFigure, ProjectileMark, SceneFigure, WaveFigure, WaveMark,
} from './sceneTypes.ts';

/** The units a drawing may print, as the Grade 10 book writes them. */
export const PHYSICS_UNITS = [
  'm', 'cm', 'km', 's', 'm/s', 'km/h', 'm/s²', 'N', 'kg', 'g', '°',
  'Hz', 'J', 'W', 'Pa', 'N/m²', 'kg/m³', 'g/cm³', 'm³', 'cm³',
] as const;

const PROJECTILE_MARKS: readonly ProjectileMark[] = ['v0', 'vx', 'vy', 'H', 'R'];
const WAVE_MARKS: readonly WaveMark[] = ['crest', 'trough', 'A', 'lambda'];
const CIRCULAR_ARROWS = ['v', 'F', 'a'] as const;

// The maths label rule plus the Greek letters the physics book uses. Tatweel (U+0640) is excluded as in gate.ts.
const PHYS_LABEL = /^[A-Za-zء-غف-يλθαβωΔμ]{1,3}[0-9]?['′]?$/u;

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isInt = (v: unknown): v is number => isNum(v) && Number.isInteger(v);
const isLabel = (v: unknown): v is string => typeof v === 'string' && PHYS_LABEL.test(v) && !isNumberWord(v);
const oneOf = <T extends string>(v: unknown, list: readonly T[]): v is T => typeof v === 'string' && (list as readonly string[]).includes(v);

/** `undefined` when absent, `null` when present but invalid. */
function resolveValue(raw: unknown): PhysicsValue | null | undefined {
  if (raw === undefined) return undefined;
  if (!isRec(raw)) return null;
  const n = raw['n'];
  const unit = raw['unit'];
  if (!isNum(n) || Math.abs(n) > 1e6) return null;
  if (Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-6) return null;
  if (!oneOf(unit, PHYSICS_UNITS)) return null;
  return { n: Number(n.toFixed(3)), unit };
}

/** Unique members of `list`, in `order`; `null` on a duplicate or an unknown member. */
function orderedSet<T extends string>(raw: unknown, order: readonly T[], min: number, max: number): T[] | null {
  if (!Array.isArray(raw) || raw.length < min || raw.length > max) return null;
  const seen = new Set<T>();
  for (const m of raw) {
    if (!oneOf(m, order) || seen.has(m)) return null;
    seen.add(m);
  }
  return order.filter(m => seen.has(m));
}

function resolveForces(raw: Rec): ForcesFigure | null {
  const body = raw['body'];
  if (!oneOf(body, ['block', 'point'] as const)) return null;
  let incline: number | undefined;
  if (raw['incline'] !== undefined) {
    const i = raw['incline'];
    if (!isInt(i) || i < 5 || i > 60 || body !== 'block') return null;
    incline = i;
  }
  const list = raw['arrows'];
  if (!Array.isArray(list) || list.length < 1 || list.length > 5) return null;
  const labels = new Set<string>();
  const arrows: ForcesFigure['arrows'] = [];
  for (const a of list) {
    if (!isRec(a)) return null;
    const dir = a['dir'];
    const size = a['size'];
    const label = a['label'];
    if (!isInt(dir) || dir < 0 || dir > 359) return null;
    if (size !== 1 && size !== 2 && size !== 3) return null;
    if (!isLabel(label) || labels.has(label)) return null;
    labels.add(label);
    const value = resolveValue(a['value']);
    if (value === null) return null;
    arrows.push({ dir, size, label, ...(value ? { value } : {}) });
  }
  return { kind: 'forces', body, ...(incline !== undefined ? { incline } : {}), arrows };
}

function resolveAttraction(raw: Rec): AttractionFigure | null {
  const bodies = raw['bodies'];
  if (!Array.isArray(bodies) || bodies.length !== 2) return null;
  const [b0, b1] = bodies as unknown[];
  if (!isLabel(b0) || !isLabel(b1) || b0 === b1) return null;
  const force = raw['force'];
  if (!isLabel(force) || force === b0 || force === b1) return null;
  let distance: AttractionFigure['distance'];
  if (raw['distance'] !== undefined) {
    const d = raw['distance'];
    if (!isRec(d)) return null;
    const label = d['label'];
    if (!isLabel(label)) return null;
    const value = resolveValue(d['value']);
    if (value === null) return null;
    distance = { label, ...(value ? { value } : {}) };
  }
  return { kind: 'attraction', bodies: [b0, b1], force, ...(distance ? { distance } : {}) };
}

function resolveProjectile(raw: Rec): ProjectileFigure | null {
  const launch = raw['launch'];
  if (!oneOf(launch, ['ground', 'horizontal'] as const)) return null;
  const angleRaw = raw['angle'];
  let angle: number | undefined;
  if (launch === 'ground') {
    if (!isInt(angleRaw) || angleRaw < 10 || angleRaw > 80) return null;
    if (raw['height'] !== undefined) return null;
    angle = angleRaw;
  } else if (angleRaw !== undefined) {
    return null;
  }
  const speed = resolveValue(raw['speed']);
  const height = resolveValue(raw['height']);
  if (speed === null || height === null) return null;
  const marks = orderedSet(raw['marks'], PROJECTILE_MARKS, 0, PROJECTILE_MARKS.length);
  if (!marks) return null;
  if (launch === 'horizontal' && marks.includes('H')) return null;
  // A value is printed beside its mark; a speed with no v0 arrow would be a number with nowhere to go.
  if (speed && !marks.includes('v0')) return null;
  return {
    kind: 'projectile', launch,
    ...(angle !== undefined ? { angle } : {}),
    ...(speed ? { speed } : {}),
    ...(height ? { height } : {}),
    marks,
  };
}

function resolveCircular(raw: Rec): CircularFigure | null {
  const turning = raw['turning'];
  if (!oneOf(turning, ['cw', 'ccw'] as const)) return null;
  const arrows = orderedSet(raw['arrows'], CIRCULAR_ARROWS, 1, 2);
  if (!arrows || (arrows.includes('F') && arrows.includes('a'))) return null;
  let radius: CircularFigure['radius'];
  if (raw['radius'] !== undefined) {
    const r = raw['radius'];
    if (!isRec(r)) return null;
    const label = r['label'];
    if (!isLabel(label)) return null;
    const value = resolveValue(r['value']);
    if (value === null) return null;
    radius = { label, ...(value ? { value } : {}) };
  }
  return { kind: 'circular', ...(radius ? { radius } : {}), turning, arrows };
}

function resolveWave(raw: Rec): WaveFigure | null {
  const cycles = raw['cycles'];
  if (cycles !== 1 && cycles !== 2 && cycles !== 3) return null;
  const marks = orderedSet(raw['marks'], WAVE_MARKS, 0, WAVE_MARKS.length);
  if (!marks) return null;
  let second: WaveFigure['second'];
  if (raw['second'] !== undefined) {
    const s = raw['second'];
    if (!isRec(s)) return null;
    const phase = s['phase'];
    const sum = s['sum'];
    if (!oneOf(phase, ['in', 'out'] as const) || typeof sum !== 'boolean') return null;
    second = { phase, sum };
  }
  const amplitude = resolveValue(raw['amplitude']);
  const wavelength = resolveValue(raw['wavelength']);
  if (amplitude === null || wavelength === null) return null;
  return {
    kind: 'wave', cycles, marks,
    ...(second ? { second } : {}),
    ...(amplitude ? { amplitude } : {}),
    ...(wavelength ? { wavelength } : {}),
  };
}

export function resolveSceneFigure(raw: unknown): SceneFigure | null {
  try {
    if (!isRec(raw)) return null;
    const out: SceneFigure | null =
      raw['kind'] === 'forces' ? resolveForces(raw)
        : raw['kind'] === 'attraction' ? resolveAttraction(raw)
          : raw['kind'] === 'projectile' ? resolveProjectile(raw)
            : raw['kind'] === 'circular' ? resolveCircular(raw)
              : raw['kind'] === 'wave' ? resolveWave(raw)
                : null;
    if (!out) return null;
    return JSON.stringify(out).length <= FIGURE_LIMITS.maxBytes ? out : null;
  } catch {
    return null;
  }
}

/** What a physics paper question may carry: a scene, or vectors on the plane. Never a function graph. */
export function resolvePhysicsFigure(raw: unknown): PhysicsFigure | null {
  const scene = resolveSceneFigure(raw);
  if (scene) return scene;
  const plane = resolveFigure(raw);
  return plane && plane.kind === 'vectors' ? plane : null;
}
```

- [ ] **Step 6: Export from `lib/figure/src/index.ts`** — add after `export * from './gate.ts';`:

```ts
export * from './sceneTypes.ts';
export * from './sceneGate.ts';
```

- [ ] **Step 7: Run the tests**

Run: `cd lib/figure && pnpm test`
Expected: PASS, including every existing test file.

- [ ] **Step 8: Commit**

```bash
git add lib/figure/src/sceneTypes.ts lib/figure/src/sceneGate.ts lib/figure/src/gate.ts lib/figure/src/index.ts lib/figure/src/__tests__/sceneGate.test.ts
git commit -m "lib/figure: physics figure kinds and their gate"
```

---

### Task 2: Every number on the drawing is in the question

**Files:**
- Create: `lib/figure/src/figureNumbers.ts`, `lib/figure/src/__tests__/figureNumbers.test.ts`
- Modify: `lib/figure/src/index.ts`

**Interfaces:**
- Consumes: `PhysicsFigure` (Task 1).
- Produces: `foldDigits(text: string): string`; `figureNumbers(f: PhysicsFigure): number[]`; `figureNumbersInText(f: PhysicsFigure, text: string): boolean`.

- [ ] **Step 1: Write the failing test** — `lib/figure/src/__tests__/figureNumbers.test.ts`

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureNumbers, figureNumbersInText, foldDigits } from '../figureNumbers.ts';
import type { PhysicsFigure } from '../sceneTypes.ts';

const proj: PhysicsFigure = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
const slope: PhysicsFigure = { kind: 'forces', body: 'block', incline: 37, arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }] };

describe('foldDigits', () => {
  it('turns Arabic-Indic and Persian digits into Latin, and «٫» between digits into a point', () => {
    assert.equal(foldDigits('٢٠ م/ث'), '20 م/ث');
    assert.equal(foldDigits('۴۵'), '45');
    assert.equal(foldDigits('٩٫٨'), '9.8');
    assert.equal(foldDigits('٩،٨'), '9.8');
    assert.equal(foldDigits('20، 30'), '20، 30');
  });
});

describe('figureNumbers', () => {
  it('lists every number the drawing prints', () => {
    assert.deepEqual(figureNumbers(proj), [30, 20]);
    assert.deepEqual(figureNumbers(slope), [37, 49]);
    assert.deepEqual(figureNumbers({ kind: 'wave', cycles: 2, marks: ['A'], amplitude: { n: 0.05, unit: 'm' }, wavelength: { n: 2, unit: 'm' } }), [0.05, 2]);
    assert.deepEqual(figureNumbers({ kind: 'circular', turning: 'cw', arrows: ['v'] }), []);
    assert.deepEqual(figureNumbers({ kind: 'vectors', vectors: [{ from: [0, 0], to: [3, 2] }] }), []);
  });
});

describe('figureNumbersInText', () => {
  it('passes when every printed number is in the question, in either digit system', () => {
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 20 م/ث بزاوية 30° مع الأفق. احسب أقصى ارتفاع.'), true);
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة ٢٠ م/ث بزاوية ٣٠° مع الأفق.'), true);
    assert.equal(figureNumbersInText({ kind: 'wave', cycles: 1, marks: ['A'], amplitude: { n: 9.8, unit: 'm' } }, 'سعتها ٩٫٨ م'), true);
    assert.equal(figureNumbersInText(proj, 'A ball is thrown at 20.0 m/s at 30 degrees.'), true);
  });

  it('fails when the drawing shows a number the question does not state', () => {
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 25 م/ث بزاوية 30°.'), false);
    assert.equal(figureNumbersInText(slope, 'جسم على سطح مائل بزاوية 37°.'), false);
    assert.equal(figureNumbersInText(proj, 'قُذفت كرة بسرعة 120 م/ث بزاوية 130°.'), false);
  });

  it('a drawing that prints no number always passes', () => {
    assert.equal(figureNumbersInText({ kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] }, 'جسم يتحرك حركة دائرية.'), true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd lib/figure && node --experimental-strip-types --test src/__tests__/figureNumbers.test.ts`
Expected: FAIL — cannot find module `../figureNumbers.ts`.

- [ ] **Step 3: Create `lib/figure/src/figureNumbers.ts`**

```ts
/**
 * A physics drawing may print givens (20 m/s, 30°), so a label-only guard is not
 * enough to stop it showing an answer. This one is: every number the drawing
 * prints must also be in the question, so the drawing can only repeat what the
 * student is already told. The figure cannot see its question; the caller runs this.
 */
import type { PhysicsFigure } from './sceneTypes.ts';

const ARABIC_INDIC = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN = '۰۱۲۳۴۵۶۷۸۹';

/** Arabic-Indic and Persian digits to Latin; «٫» or «،» between two digits to a decimal point. */
export function foldDigits(text: string): string {
  return text
    .replace(/[٠-٩]/gu, d => String(ARABIC_INDIC.indexOf(d)))
    .replace(/[۰-۹]/gu, d => String(PERSIAN.indexOf(d)))
    .replace(/(\d)[٫،](?=\d)/gu, '$1.');
}

/** Every number the drawing prints, in the order the renderer prints them. */
export function figureNumbers(f: PhysicsFigure): number[] {
  switch (f.kind) {
    case 'forces':
      return [...(f.incline !== undefined ? [f.incline] : []), ...f.arrows.flatMap(a => (a.value ? [a.value.n] : []))];
    case 'attraction':
      return f.distance?.value ? [f.distance.value.n] : [];
    case 'projectile':
      return [...(f.angle !== undefined ? [f.angle] : []), ...(f.speed ? [f.speed.n] : []), ...(f.height ? [f.height.n] : [])];
    case 'circular':
      return f.radius?.value ? [f.radius.value.n] : [];
    case 'wave':
      return [...(f.amplitude ? [f.amplitude.n] : []), ...(f.wavelength ? [f.wavelength.n] : [])];
    case 'vectors':
      return [];
  }
}

/** True when each number the drawing prints appears, as a whole number token, in `text`. */
export function figureNumbersInText(f: PhysicsFigure, text: string): boolean {
  const found = (foldDigits(text).match(/\d+(?:\.\d+)?/gu) ?? []).map(Number);
  return figureNumbers(f).every(n => found.some(m => Math.abs(m - Math.abs(n)) < 1e-9));
}
```

- [ ] **Step 4: Export** — in `lib/figure/src/index.ts` add `export * from './figureNumbers.ts';`

- [ ] **Step 5: Run the tests**

Run: `cd lib/figure && pnpm test`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/figure/src/figureNumbers.ts lib/figure/src/__tests__/figureNumbers.test.ts lib/figure/src/index.ts
git commit -m "lib/figure: a physics drawing may print only numbers its question states"
```

---

### Task 3: Scene layout

**Files:**
- Create: `lib/figure/src/scene.ts`, `lib/figure/src/__tests__/scene.test.ts`
- Modify: `lib/figure/src/geometry.ts` (export `arrowHead`), `lib/figure/src/index.ts`

**Interfaces:**
- Consumes: `SceneFigure` and kinds (Task 1); `arrowHead(from: Pt, to: Pt): [Pt, Pt, Pt]`, `Pt`, `Box` (geometry.ts).
- Produces: `type Tone = 0 | 1 | 2 | 'ink' | 'muted'`; `type ScenePrim` (below); `type SceneLayout = { prims: ScenePrim[] }`; `SCENE_MARGIN = 24`; `formatValue(v: PhysicsValue): string`; `layoutScene(f: SceneFigure, box: Box, lang?: 'ar' | 'en'): SceneLayout`.

- [ ] **Step 1: Export `arrowHead`** — in `lib/figure/src/geometry.ts` change `function arrowHead(from: Pt, to: Pt): [Pt, Pt, Pt] {` to `export function arrowHead(from: Pt, to: Pt): [Pt, Pt, Pt] {`.

- [ ] **Step 2: Write the failing test** — `lib/figure/src/__tests__/scene.test.ts`

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatValue, layoutScene, type ScenePrim } from '../scene.ts';
import type { SceneFigure } from '../sceneTypes.ts';

const BOX = { w: 480, h: 320 };
const SMALL = { w: 320, h: 240 };
const role = (prims: ScenePrim[], r: string) => prims.filter(p => p.role === r);
const one = (prims: ScenePrim[], r: string) => {
  const found = role(prims, r);
  assert.equal(found.length, 1, `exactly one ${r}`);
  return found[0]!;
};
const pointsOf = (p: ScenePrim) =>
  p.t === 'line' || p.t === 'arrow' ? [p.a, p.b] : p.t === 'poly' ? p.pts : p.t === 'circle' ? [p.c] : [p.at];

const SAMPLES: SceneFigure[] = [
  { kind: 'forces', body: 'block', arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }, { dir: 90, size: 2, label: 'N' }, { dir: 0, size: 3, label: 'F' }, { dir: 180, size: 1, label: 'f' }] },
  { kind: 'forces', body: 'block', incline: 30, arrows: [{ dir: 270, size: 2, label: 'W' }, { dir: 120, size: 2, label: 'N' }] },
  { kind: 'forces', body: 'point', arrows: [{ dir: 45, size: 3, label: 'F1' }, { dir: 135, size: 3, label: 'F2' }] },
  { kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n: 2, unit: 'm' } } },
  { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'vx', 'vy', 'H', 'R'] },
  { kind: 'projectile', launch: 'ground', angle: 75, marks: ['H', 'R'] },
  { kind: 'projectile', launch: 'horizontal', speed: { n: 15, unit: 'm/s' }, height: { n: 45, unit: 'm' }, marks: ['v0', 'vx', 'vy', 'R'] },
  { kind: 'circular', turning: 'ccw', radius: { label: 'r', value: { n: 0.5, unit: 'm' } }, arrows: ['v', 'F'] },
  { kind: 'circular', turning: 'cw', arrows: ['v', 'a'] },
  { kind: 'wave', cycles: 2, marks: ['crest', 'trough', 'A', 'lambda'], amplitude: { n: 0.2, unit: 'm' }, wavelength: { n: 4, unit: 'm' } },
  { kind: 'wave', cycles: 3, marks: [], second: { phase: 'in', sum: true } },
  { kind: 'wave', cycles: 1, marks: ['lambda'], second: { phase: 'out', sum: true } },
];

describe('layoutScene: everything inside the box', () => {
  for (const box of [BOX, SMALL]) {
    for (const f of SAMPLES) {
      it(`${f.kind} ${JSON.stringify(f).slice(0, 60)} in ${box.w}x${box.h}`, () => {
        for (const p of layoutScene(f, box).prims) {
          for (const q of pointsOf(p)) {
            assert.ok(Number.isFinite(q.x) && Number.isFinite(q.y), `${p.role} is finite`);
            assert.ok(q.x >= 0 && q.x <= box.w && q.y >= 0 && q.y <= box.h, `${p.role} at ${q.x},${q.y} inside`);
          }
        }
      });
    }
  }
});

describe('layoutScene: physics the drawing gets right', () => {
  it('forces: an arrow at 270° points straight down from the body', () => {
    const w = one(layoutScene(SAMPLES[0]!, BOX).prims, 'arrow:W');
    assert.equal(w.t, 'arrow');
    if (w.t !== 'arrow') return;
    assert.ok(Math.abs(w.a.x - w.b.x) < 1e-9 && w.b.y > w.a.y);
  });

  it('forces: the slope rises at the incline angle', () => {
    const s = one(layoutScene(SAMPLES[1]!, BOX).prims, 'slope');
    if (s.t !== 'poly') return assert.fail('slope is a polygon');
    const [left, right, top] = s.pts as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
    const deg = Math.atan2(right.y - top.y, top.x - left.x) * 180 / Math.PI;
    assert.ok(Math.abs(deg - 30) < 1e-6, `slope ${deg}°`);
  });

  it('projectile: the path is the parabola for its angle (H / R = tan θ / 4) with the apex mid-range', () => {
    for (const f of [SAMPLES[4]!, SAMPLES[5]!]) {
      const path = one(layoutScene(f, BOX).prims, 'path');
      if (path.t !== 'poly' || f.kind !== 'projectile') return assert.fail('path is a polyline');
      const xs = path.pts.map(p => p.x);
      const ground = path.pts[0]!.y;
      const R = Math.max(...xs) - Math.min(...xs);
      const top = path.pts.reduce((a, b) => (b.y < a.y ? b : a));
      const H = ground - top.y;
      assert.ok(Math.abs(H / R - Math.tan(f.angle! * Math.PI / 180) / 4) < 0.01, `H/R for ${f.angle}°`);
      assert.ok(Math.abs(top.x - (Math.min(...xs) + R / 2)) < R / 60 + 1e-9, 'apex mid-range');
      assert.ok(Math.abs(path.pts[path.pts.length - 1]!.y - ground) < 1e-9, 'lands on the ground');
    }
  });

  it('projectile: values are printed beside their marks', () => {
    const texts = layoutScene(SAMPLES[4]!, BOX).prims.filter(p => p.t === 'text').map(p => (p.t === 'text' ? p.text : ''));
    assert.ok(texts.includes('v0 = 20 m/s'));
    assert.ok(texts.includes('30°'));
    assert.ok(texts.includes('H') && texts.includes('R'));
  });

  it('circular: v is tangent and F points to the centre', () => {
    const prims = layoutScene(SAMPLES[7]!, BOX).prims;
    const v = one(prims, 'v');
    const F = one(prims, 'F');
    const c = one(prims, 'centre');
    if (v.t !== 'arrow' || F.t !== 'arrow' || c.t !== 'circle') return assert.fail('shapes');
    const rx = v.a.x - c.c.x;
    const ry = v.a.y - c.c.y;
    const dot = rx * (v.b.x - v.a.x) + ry * (v.b.y - v.a.y);
    assert.ok(Math.abs(dot) < 1e-6, 'tangent');
    const toCentre = (c.c.x - F.a.x) * (F.b.x - F.a.x) + (c.c.y - F.a.y) * (F.b.y - F.a.y);
    assert.ok(toCentre > 0, 'F toward the centre');
  });

  it('circular: ccw and cw velocities point opposite ways', () => {
    const vccw = one(layoutScene({ kind: 'circular', turning: 'ccw', arrows: ['v'] }, BOX).prims, 'v');
    const vcw = one(layoutScene({ kind: 'circular', turning: 'cw', arrows: ['v'] }, BOX).prims, 'v');
    if (vccw.t !== 'arrow' || vcw.t !== 'arrow') return assert.fail('arrows');
    const dot = (vccw.b.x - vccw.a.x) * (vcw.b.x - vcw.a.x) + (vccw.b.y - vccw.a.y) * (vcw.b.y - vcw.a.y);
    assert.ok(dot < 0);
  });

  it('wave: λ spans exactly one cycle', () => {
    for (const cycles of [1, 2, 3] as const) {
      const l = one(layoutScene({ kind: 'wave', cycles, marks: ['lambda'] }, BOX).prims, 'lambda');
      if (l.t !== 'line') return assert.fail('λ is a line');
      assert.ok(Math.abs(Math.abs(l.b.x - l.a.x) - (BOX.w - 48) / cycles) < 1e-9, `${cycles} cycles`);
    }
  });

  it('wave: in phase the sum is twice as tall; out of phase it is flat', () => {
    const height = (p: ScenePrim) => (p.t === 'poly' ? Math.max(...p.pts.map(q => q.y)) - Math.min(...p.pts.map(q => q.y)) : NaN);
    const inPhase = layoutScene(SAMPLES[10]!, BOX).prims;
    assert.ok(Math.abs(height(one(inPhase, 'sum')) - 2 * height(one(inPhase, 'wave1'))) < 0.5);
    const outPhase = layoutScene(SAMPLES[11]!, BOX).prims;
    assert.ok(height(one(outPhase, 'sum')) < 1e-9);
  });

  it('wave: the crest and trough words follow the language', () => {
    const f: SceneFigure = { kind: 'wave', cycles: 1, marks: ['crest', 'trough'] };
    const words = (lang: 'ar' | 'en') => layoutScene(f, BOX, lang).prims.flatMap(p => (p.t === 'text' ? [p.text] : []));
    assert.deepEqual(words('ar'), ['قمة', 'قاع']);
    assert.deepEqual(words('en'), ['crest', 'trough']);
  });

  it('attraction: the two force arrows are equal and opposite', () => {
    const prims = layoutScene(SAMPLES[3]!, BOX).prims;
    const a = one(prims, 'force1');
    const b = one(prims, 'force2');
    if (a.t !== 'arrow' || b.t !== 'arrow') return assert.fail('arrows');
    assert.ok(Math.abs((a.b.x - a.a.x) + (b.b.x - b.a.x)) < 1e-9 && a.b.x > a.a.x);
  });
});

describe('formatValue', () => {
  it('prints at most 3 decimals and a degree sign without a space', () => {
    assert.equal(formatValue({ n: 20, unit: 'm/s' }), '20 m/s');
    assert.equal(formatValue({ n: 9.8, unit: 'm/s²' }), '9.8 m/s²');
    assert.equal(formatValue({ n: 30, unit: '°' }), '30°');
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `cd lib/figure && node --experimental-strip-types --test src/__tests__/scene.test.ts`
Expected: FAIL — cannot find module `../scene.ts`.

- [ ] **Step 4: Create `lib/figure/src/scene.ts`**

```ts
/**
 * Where a physics figure's pieces go: a figure and a box in, pixel primitives out,
 * so `figureSvg` and the app's `SceneFigureView` draw the same picture. Screen
 * coordinates (y grows downward); angles are degrees counter-clockwise from +x.
 *
 * What the layout guarantees, because a wrong picture is worse than none: arrow
 * directions are the stated degrees; a slope rises at its incline; a projectile's
 * path is the true parabola for its angle (its shape, not the speed's scale);
 * a wave's λ spans exactly one cycle and a sum is the computed sum.
 *
 * Every primitive carries a `role` so tests (and nothing else) can find it.
 */
import { arrowHead, type Box, type Pt } from './geometry.ts';
import type {
  AttractionFigure, CircularFigure, ForcesFigure, PhysicsValue, ProjectileFigure, SceneFigure, WaveFigure,
} from './sceneTypes.ts';

/** Series colours 0–2 as on the plane; `ink` for bodies and words; `muted` for surfaces and dimensions. */
export type Tone = 0 | 1 | 2 | 'ink' | 'muted';

export type ScenePrim =
  | { t: 'line'; a: Pt; b: Pt; tone: Tone; dash?: boolean; role: string }
  | { t: 'arrow'; a: Pt; b: Pt; head: [Pt, Pt, Pt]; tone: Tone; dash?: boolean; role: string }
  | { t: 'poly'; pts: Pt[]; tone: Tone; dash?: boolean; closed?: boolean; role: string }
  | { t: 'circle'; c: Pt; r: number; tone: Tone; fill?: boolean; role: string }
  | { t: 'text'; at: Pt; text: string; tone: Tone; anchor: 'start' | 'middle' | 'end'; role: string };

export type SceneLayout = { prims: ScenePrim[] };

export const SCENE_MARGIN = 24;
const M = SCENE_MARGIN;
/** Rough width of one 13px glyph, to keep a centred text inside the box. */
const GLYPH = 7.2;

export function formatValue(v: PhysicsValue): string {
  const n = String(Number(v.n.toFixed(3)));
  return v.unit === '°' ? `${n}°` : `${n} ${v.unit}`;
}

const tagged = (label: string, v?: PhysicsValue) => (v ? `${label} = ${formatValue(v)}` : label);
const rad = (deg: number) => (deg * Math.PI) / 180;
const polar = (c: Pt, deg: number, len: number): Pt => ({ x: c.x + Math.cos(rad(deg)) * len, y: c.y - Math.sin(rad(deg)) * len });
const series = (i: number): Tone => (i % 3) as 0 | 1 | 2;
const line = (a: Pt, b: Pt, tone: Tone, role: string, dash?: boolean): ScenePrim => ({ t: 'line', a, b, tone, role, ...(dash ? { dash } : {}) });
const arrow = (a: Pt, b: Pt, tone: Tone, role: string, dash?: boolean): ScenePrim => ({ t: 'arrow', a, b, head: arrowHead(a, b), tone, role, ...(dash ? { dash } : {}) });

/** A text centred near `p`, pulled inside the box by its estimated width. */
function text(p: Pt, s: string, box: Box, role: string, tone: Tone = 'ink'): ScenePrim {
  const half = (s.length * GLYPH) / 2;
  const x = Math.max(half + 2, Math.min(box.w - half - 2, p.x));
  const y = Math.max(14, Math.min(box.h - 4, p.y));
  return { t: 'text', at: { x, y }, text: s, tone, anchor: 'middle', role };
}

function layoutForces(f: ForcesFigure, box: Box): ScenePrim[] {
  const out: ScenePrim[] = [];
  const unit = Math.min(box.w, box.h);
  const s = unit * 0.16;
  const h = s / 2;
  let c: Pt = { x: box.w / 2, y: box.h / 2 };
  if (f.incline !== undefined) {
    const th = rad(f.incline);
    const base = box.h - M;
    const rise = Math.min((box.w - 2 * M) * Math.tan(th), box.h - 2 * M);
    const run = rise / Math.tan(th);
    const left = { x: M, y: base };
    const right = { x: M + run, y: base };
    const top = { x: M + run, y: base - rise };
    out.push({ t: 'poly', pts: [left, right, top], tone: 'muted', closed: true, role: 'slope' });
    out.push(text({ x: left.x + 40, y: base - 6 }, `${f.incline}°`, box, 'incline', 'muted'));
    const mid = { x: (left.x + top.x) / 2, y: (left.y + top.y) / 2 };
    const u = { x: Math.cos(th), y: -Math.sin(th) };   // along the slope, up it
    const n = { x: -Math.sin(th), y: -Math.cos(th) };  // away from the surface
    c = { x: mid.x + n.x * h, y: mid.y + n.y * h };
    const corner = (a: number, b: number): Pt => ({ x: c.x + u.x * h * a + n.x * h * b, y: c.y + u.y * h * a + n.y * h * b });
    out.push({ t: 'poly', pts: [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)], tone: 'ink', closed: true, role: 'body' });
  } else if (f.body === 'block') {
    out.push(line({ x: M, y: c.y + h }, { x: box.w - M, y: c.y + h }, 'muted', 'surface'));
    out.push({ t: 'poly', pts: [{ x: c.x - h, y: c.y - h }, { x: c.x + h, y: c.y - h }, { x: c.x + h, y: c.y + h }, { x: c.x - h, y: c.y + h }], tone: 'ink', closed: true, role: 'body' });
  } else {
    out.push({ t: 'circle', c, r: 5, tone: 'ink', fill: true, role: 'body' });
  }
  f.arrows.forEach((a, i) => {
    const len = unit * [0, 0.18, 0.27, 0.36][a.size]!;
    const tip = polar(c, a.dir, len);
    out.push(arrow(c, tip, series(i), `arrow:${a.label}`));
    const at = polar(c, a.dir, len + 14);
    out.push(text({ x: at.x, y: at.y + 4 }, tagged(a.label, a.value), box, `label:${a.label}`, series(i)));
  });
  return out;
}

function layoutAttraction(f: AttractionFigure, box: Box): ScenePrim[] {
  const out: ScenePrim[] = [];
  const r = Math.min(box.w, box.h) * 0.1;
  const y = box.h * 0.42;
  const c1 = { x: box.w * 0.27, y };
  const c2 = { x: box.w * 0.73, y };
  const L = box.w * 0.13;
  out.push({ t: 'circle', c: c1, r, tone: 'muted', fill: true, role: 'body1' });
  out.push({ t: 'circle', c: c2, r, tone: 'muted', fill: true, role: 'body2' });
  out.push(text({ x: c1.x, y: y + r + 16 }, f.bodies[0], box, 'body1-label'));
  out.push(text({ x: c2.x, y: y + r + 16 }, f.bodies[1], box, 'body2-label'));
  out.push(arrow({ x: c1.x + r, y }, { x: c1.x + r + L, y }, 0, 'force1'));
  out.push(arrow({ x: c2.x - r, y }, { x: c2.x - r - L, y }, 0, 'force2'));
  out.push(text({ x: c1.x + r + L / 2, y: y - 8 }, f.force, box, 'force1-label', 0));
  out.push(text({ x: c2.x - r - L / 2, y: y - 8 }, f.force, box, 'force2-label', 0));
  if (f.distance) {
    const yd = y + r + 34;
    out.push(line({ x: c1.x, y: yd }, { x: c2.x, y: yd }, 'muted', 'distance', true));
    out.push(line({ x: c1.x, y: yd - 5 }, { x: c1.x, y: yd + 5 }, 'muted', 'distance-tick'));
    out.push(line({ x: c2.x, y: yd - 5 }, { x: c2.x, y: yd + 5 }, 'muted', 'distance-tick'));
    out.push(text({ x: (c1.x + c2.x) / 2, y: yd - 6 }, tagged(f.distance.label, f.distance.value), box, 'distance-label'));
  }
  return out;
}

function layoutProjectile(f: ProjectileFigure, box: Box): ScenePrim[] {
  const out: ScenePrim[] = [];
  const unit = Math.min(box.w, box.h);
  const ground = box.h - M - 12;
  const has = (m: string) => f.marks.includes(m as never);
  out.push(line({ x: M - 8, y: ground }, { x: box.w - M + 8, y: ground }, 'muted', 'ground'));

  if (f.launch === 'ground') {
    const deg = f.angle!;
    const tan = Math.tan(rad(deg));
    let R = box.w - 2 * M;
    let H = (R * tan) / 4;
    const Hmax = ground - M - 14;
    if (H > Hmax) {
      R = (R * Hmax) / H;
      H = Hmax;
    }
    const O = { x: M, y: ground };
    const pts = Array.from({ length: 61 }, (_, i) => {
      const x = (R * i) / 60;
      return { x: O.x + x, y: O.y - x * tan * (1 - x / R) };
    });
    out.push({ t: 'poly', pts, tone: 0, role: 'path' });
    out.push(text({ x: O.x + 40, y: O.y - 6 }, `${deg}°`, box, 'angle', 'muted'));
    const len = Math.min(unit * 0.22, R * 0.45);
    const tip = polar(O, deg, len);
    if (has('v0')) {
      out.push(arrow(O, tip, 1, 'v0'));
      const at = polar(O, deg, len + 14);
      out.push(text({ x: at.x + 10, y: at.y }, tagged('v0', f.speed), box, 'v0-label', 1));
    }
    if (has('vx')) {
      out.push(arrow(O, { x: tip.x, y: O.y }, 2, 'vx', true));
      out.push(text({ x: tip.x + 12, y: O.y + 14 }, 'vx', box, 'vx-label', 2));
    }
    if (has('vy')) {
      out.push(arrow(O, { x: O.x, y: tip.y }, 2, 'vy', true));
      out.push(text({ x: O.x + 12, y: tip.y - 4 }, 'vy', box, 'vy-label', 2));
    }
    const apex = { x: O.x + R / 2, y: O.y - H };
    if (has('H')) {
      out.push(line(apex, { x: apex.x, y: ground }, 'muted', 'H', true));
      out.push(text({ x: apex.x + 12, y: (apex.y + ground) / 2 }, 'H', box, 'H-label'));
    }
    if (has('R')) {
      out.push(line({ x: O.x, y: ground + 8 }, { x: O.x + R, y: ground + 8 }, 'muted', 'R'));
      out.push(text({ x: O.x + R / 2, y: ground + 22 }, 'R', box, 'R-label'));
    }
    return out;
  }

  // Launched horizontally off a height.
  const P = { x: M + 40, y: M + 18 };
  out.push(line({ x: P.x, y: P.y }, { x: P.x, y: ground }, 'muted', 'cliff'));
  out.push(line({ x: M - 8, y: P.y }, P, 'muted', 'ledge'));
  const X = box.w - M - P.x;
  const drop = ground - P.y;
  const pts = Array.from({ length: 61 }, (_, i) => {
    const x = (X * i) / 60;
    return { x: P.x + x, y: P.y + drop * (x / X) ** 2 };
  });
  out.push({ t: 'poly', pts, tone: 0, role: 'path' });
  out.push(text({ x: P.x + 8 + (`${tagged('h', f.height)}`.length * GLYPH) / 2, y: (P.y + ground) / 2 + 30 }, tagged('h', f.height), box, 'height-label', 'muted'));
  if (has('v0')) {
    out.push(arrow(P, { x: P.x + unit * 0.2, y: P.y }, 1, 'v0'));
    out.push(text({ x: P.x + unit * 0.1, y: P.y - 8 }, tagged('v0', f.speed), box, 'v0-label', 1));
  }
  const qx = X / 2;
  const Q = { x: P.x + qx, y: P.y + drop * 0.25 };
  const vx = unit * 0.12;
  const vy = Math.min(unit * 0.25, vx * ((2 * drop * qx) / (X * X)));
  if (has('vx')) {
    out.push(arrow(Q, { x: Q.x + vx, y: Q.y }, 2, 'vx', true));
    out.push(text({ x: Q.x + vx + 12, y: Q.y + 4 }, 'vx', box, 'vx-label', 2));
  }
  if (has('vy')) {
    out.push(arrow(Q, { x: Q.x, y: Q.y + vy }, 2, 'vy', true));
    out.push(text({ x: Q.x - 12, y: Q.y + vy }, 'vy', box, 'vy-label', 2));
  }
  if (has('R')) {
    out.push(line({ x: P.x, y: ground + 8 }, { x: P.x + X, y: ground + 8 }, 'muted', 'R'));
    out.push(text({ x: P.x + X / 2, y: ground + 22 }, 'R', box, 'R-label'));
  }
  return out;
}

function layoutCircular(f: CircularFigure, box: Box): ScenePrim[] {
  const out: ScenePrim[] = [];
  const unit = Math.min(box.w, box.h);
  const c = { x: box.w / 2, y: box.h / 2 + 4 };
  const r = unit * 0.3;
  const phi = 40;
  const P = polar(c, phi, r);
  out.push({ t: 'circle', c, r, tone: 'muted', role: 'path' });
  out.push({ t: 'circle', c, r: 3, tone: 'ink', fill: true, role: 'centre' });
  if (f.radius) {
    const end = polar(c, 200, r);
    out.push(line(c, end, 'muted', 'radius'));
    const mid = polar(c, 200, r / 2);
    out.push(text({ x: mid.x, y: mid.y - 8 }, tagged(f.radius.label, f.radius.value), box, 'radius-label'));
  }
  out.push({ t: 'circle', c: P, r: 7, tone: 'ink', fill: true, role: 'body' });
  if (f.arrows.includes('v')) {
    const dir = f.turning === 'ccw' ? phi + 90 : phi - 90;
    const len = unit * 0.26;
    out.push(arrow(P, polar(P, dir, len), 0, 'v'));
    const at = polar(P, dir, len + 14);
    out.push(text({ x: at.x, y: at.y + 4 }, 'v', box, 'v-label', 0));
  }
  const inward = f.arrows.includes('F') ? 'F' : f.arrows.includes('a') ? 'a' : null;
  if (inward) {
    const tip = polar(P, phi + 180, r * 0.55);
    out.push(arrow(P, tip, 1, inward));
    out.push(text({ x: tip.x + 4, y: tip.y + 16 }, inward, box, `${inward}-label`, 1));
  }
  return out;
}

function layoutWave(f: WaveFigure, box: Box, lang: 'ar' | 'en'): ScenePrim[] {
  const out: ScenePrim[] = [];
  const W = box.w - 2 * M;
  const y0 = box.h / 2;
  const doubled = !!f.second && f.second.sum && f.second.phase === 'in';
  const A = (box.h - 2 * M) * (doubled ? 0.18 : 0.3);
  const k = (2 * Math.PI * f.cycles) / W;
  const wave = (amp: number): Pt[] =>
    Array.from({ length: 121 }, (_, i) => {
      const x = (W * i) / 120;
      return { x: M + x, y: y0 - amp * Math.sin(k * x) };
    });
  out.push(line({ x: M, y: y0 }, { x: box.w - M, y: y0 }, 'muted', 'axis', true));
  out.push({ t: 'poly', pts: wave(A), tone: 0, role: 'wave1' });
  if (f.second) {
    const sign = f.second.phase === 'in' ? 1 : -1;
    out.push({ t: 'poly', pts: wave(sign * A), tone: 1, dash: true, role: 'wave2' });
    if (f.second.sum) out.push({ t: 'poly', pts: wave(A + sign * A), tone: 2, role: 'sum' });
  }
  const crestX = M + W / (4 * f.cycles);
  const troughX = M + (3 * W) / (4 * f.cycles);
  if (f.marks.includes('crest')) out.push(text({ x: crestX, y: y0 - A - 8 }, lang === 'ar' ? 'قمة' : 'crest', box, 'crest'));
  if (f.marks.includes('trough')) out.push(text({ x: troughX, y: y0 + A + 16 }, lang === 'ar' ? 'قاع' : 'trough', box, 'trough'));
  if (f.marks.includes('A')) {
    out.push(line({ x: crestX, y: y0 }, { x: crestX, y: y0 - A }, 'muted', 'A', true));
    const s = tagged('A', f.amplitude);
    out.push(text({ x: crestX + 8 + (s.length * GLYPH) / 2, y: y0 - A / 2 }, s, box, 'A-label'));
  }
  if (f.marks.includes('lambda')) {
    const yl = Math.min(box.h - 22, y0 + A + 26);
    out.push(line({ x: M, y: yl }, { x: M + W / f.cycles, y: yl }, 'muted', 'lambda'));
    out.push(line({ x: M, y: yl - 5 }, { x: M, y: yl + 5 }, 'muted', 'lambda-tick'));
    out.push(line({ x: M + W / f.cycles, y: yl - 5 }, { x: M + W / f.cycles, y: yl + 5 }, 'muted', 'lambda-tick'));
    out.push(text({ x: M + W / (2 * f.cycles), y: yl + 16 }, tagged('λ', f.wavelength), box, 'lambda-label'));
  }
  return out;
}

export function layoutScene(f: SceneFigure, box: Box, lang: 'ar' | 'en' = 'en'): SceneLayout {
  switch (f.kind) {
    case 'forces': return { prims: layoutForces(f, box) };
    case 'attraction': return { prims: layoutAttraction(f, box) };
    case 'projectile': return { prims: layoutProjectile(f, box) };
    case 'circular': return { prims: layoutCircular(f, box) };
    case 'wave': return { prims: layoutWave(f, box, lang) };
  }
}
```

- [ ] **Step 5: Export** — in `lib/figure/src/index.ts` add `export * from './scene.ts';`

- [ ] **Step 6: Run the tests**

Run: `cd lib/figure && pnpm test`
Expected: PASS. If an "inside the box" case fails, fix the layout constant for that kind (e.g. a label offset) so the primitive lands inside; never loosen the test.

- [ ] **Step 7: Commit**

```bash
git add lib/figure/src/scene.ts lib/figure/src/geometry.ts lib/figure/src/index.ts lib/figure/src/__tests__/scene.test.ts
git commit -m "lib/figure: lay out forces, attraction, projectile, circular and wave scenes"
```

---

### Task 4: SVG and alt text for scenes; unique clip id

**Files:**
- Modify: `lib/figure/src/svg.ts`, `lib/figure/src/alt.ts`
- Test: `lib/figure/src/__tests__/svg.test.ts`, `lib/figure/src/__tests__/alt.test.ts` (add cases)

**Interfaces:**
- Consumes: `AnyFigure`, `isSceneFigure` (Task 1); `layoutScene`, `formatValue`, `ScenePrim`, `Tone` (Task 3).
- Produces: `figureSvg(figure: AnyFigure, opts?: { lang?: 'ar' | 'en'; width?: number; height?: number; id?: string }): string`; `figureAltText(figure: AnyFigure, lang: 'ar' | 'en'): string`.

- [ ] **Step 1: Add the failing tests**

Append to `lib/figure/src/__tests__/svg.test.ts` (keep existing imports; add `import type { SceneFigure } from '../sceneTypes.ts';`):

```ts
describe('figureSvg: scenes', () => {
  const proj: SceneFigure = { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'H', 'R'] };
  it('draws a projectile: the path, an arrow head, and its labels', () => {
    const svg = figureSvg(proj);
    assert.ok(svg.startsWith('<svg ') && svg.endsWith('</svg>'));
    assert.ok((svg.match(/<polyline /g) ?? []).length >= 1);
    assert.ok((svg.match(/<polygon /g) ?? []).length >= 1);
    for (const s of ['>v0 = 20 m/s<', '>30°<', '>H<', '>R<']) assert.ok(svg.includes(s), s);
  });
  it('draws the wave words in the language asked for', () => {
    const w: SceneFigure = { kind: 'wave', cycles: 1, marks: ['crest', 'trough'] };
    assert.ok(figureSvg(w, { lang: 'ar' }).includes('>قمة<'));
    assert.ok(figureSvg(w, { lang: 'en' }).includes('>crest<'));
  });
  it('gives each drawing its own clip id, so two on one page do not share one', () => {
    const id = (svg: string) => /<clipPath id="([^"]+)"/.exec(svg)?.[1];
    const a = figureSvg(proj);
    const b = figureSvg(proj);
    assert.ok(id(a) && id(b) && id(a) !== id(b));
    assert.equal(id(figureSvg(proj, { id: 'q3' })), 'fig-q3');
  });
});
```

Append to `lib/figure/src/__tests__/alt.test.ts` (add the import `import type { SceneFigure } from '../sceneTypes.ts';`):

```ts
describe('figureAltText: scenes', () => {
  const cases: [SceneFigure, string, string][] = [
    [{ kind: 'forces', body: 'block', incline: 30, arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }] },
      'مخطط قوى على جسم على سطح مائل بزاوية 30°: W = 49 N', 'Force diagram on a block on a 30° incline: W = 49 N'],
    [{ kind: 'attraction', bodies: ['m1', 'm2'], force: 'F' }, 'قوتا تجاذب F بين m1 وm2', 'Attraction forces F between m1 and m2'],
    [{ kind: 'projectile', launch: 'ground', angle: 30, marks: ['H', 'R'] }, 'مسار مقذوف أُطلق بزاوية 30° من سطح الأرض', 'Path of a projectile launched at 30° from the ground'],
    [{ kind: 'circular', turning: 'ccw', arrows: ['v', 'F'] }, 'حركة دائرية منتظمة عكس اتجاه دوران عقارب الساعة: v، F', 'Uniform circular motion, counter-clockwise: v, F'],
    [{ kind: 'wave', cycles: 2, marks: [] }, 'موجة على طولين موجيين', 'A wave over 2 wavelengths'],
  ];
  for (const [f, ar, en] of cases) {
    it(f.kind, () => {
      assert.equal(figureAltText(f, 'ar'), ar);
      assert.equal(figureAltText(f, 'en'), en);
    });
  }
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `cd lib/figure && node --experimental-strip-types --test src/__tests__/svg.test.ts src/__tests__/alt.test.ts`
Expected: FAIL (scene figures fall into the plane path / wrong alt text).

- [ ] **Step 3: Implement `figureAltText` for scenes** — in `lib/figure/src/alt.ts`:

Change the import line to:
```ts
import type { Figure } from './types.ts';
import { isSceneFigure, type AnyFigure, type SceneFigure } from './sceneTypes.ts';
import { formatValue } from './scene.ts';
```
Add above `figureAltText`:
```ts
const tag = (label: string, v?: { n: number; unit: string }) => (v ? `${label} = ${formatValue(v)}` : label);

function sceneAlt(f: SceneFigure, lang: 'ar' | 'en'): string {
  const ar = lang === 'ar';
  switch (f.kind) {
    case 'forces': {
      const list = f.arrows.map(a => tag(a.label, a.value)).join(ar ? '، ' : ', ');
      const where = f.incline !== undefined ? (ar ? ` على سطح مائل بزاوية ${f.incline}°` : ` on a ${f.incline}° incline`) : '';
      return ar ? `مخطط قوى على ${f.body === 'block' ? 'جسم' : 'نقطة'}${where}: ${list}` : `Force diagram on a ${f.body}${where}: ${list}`;
    }
    case 'attraction': {
      const d = f.distance ? (ar ? `، والمسافة بينهما ${tag(f.distance.label, f.distance.value)}` : `, ${tag(f.distance.label, f.distance.value)} apart`) : '';
      return ar ? `قوتا تجاذب ${f.force} بين ${f.bodies[0]} و${f.bodies[1]}${d}` : `Attraction forces ${f.force} between ${f.bodies[0]} and ${f.bodies[1]}${d}`;
    }
    case 'projectile':
      return f.launch === 'ground'
        ? (ar ? `مسار مقذوف أُطلق بزاوية ${f.angle}° من سطح الأرض` : `Path of a projectile launched at ${f.angle}° from the ground`)
        : (ar ? `مسار جسم قُذف أفقيًا من ارتفاع${f.height ? ` ${formatValue(f.height)}` : ''}` : `Path of a body thrown horizontally from a height${f.height ? ` of ${formatValue(f.height)}` : ''}`);
    case 'circular': {
      const list = f.arrows.join(ar ? '، ' : ', ');
      return ar
        ? `حركة دائرية منتظمة ${f.turning === 'ccw' ? 'عكس' : 'مع'} اتجاه دوران عقارب الساعة: ${list}`
        : `Uniform circular motion, ${f.turning === 'ccw' ? 'counter-clockwise' : 'clockwise'}: ${list}`;
    }
    case 'wave': {
      const n = f.cycles;
      const base = ar ? `موجة على ${n === 1 ? 'طول موجي واحد' : n === 2 ? 'طولين موجيين' : 'ثلاثة أطوال موجية'}` : `A wave over ${n} wavelength${n === 1 ? '' : 's'}`;
      const second = f.second ? (ar ? `، وموجة ثانية ${f.second.phase === 'in' ? 'متفقة' : 'معاكسة'} في الطور${f.second.sum ? ' ومحصلتهما' : ''}` : `, a second wave ${f.second.phase === 'in' ? 'in' : 'out of'} phase${f.second.sum ? ' and their sum' : ''}`) : '';
      return base + second;
    }
  }
}
```
Change the signature line `export function figureAltText(figure: Figure, lang: 'ar' | 'en'): string {` to
```ts
export function figureAltText(figure: AnyFigure, lang: 'ar' | 'en'): string {
  if (isSceneFigure(figure)) return sceneAlt(figure, lang);
```
(the rest of the function body stays; its `figure` is now narrowed to `Figure`.) Keep the `import type { Figure }` only if still used; remove it if the typechecker reports it unused.

- [ ] **Step 4: Implement scenes in `figureSvg`** — in `lib/figure/src/svg.ts`:

Add imports:
```ts
import { isSceneFigure, type AnyFigure, type SceneFigure } from './sceneTypes.ts';
import { layoutScene, type Tone } from './scene.ts';
```
Add above `figureSvg`:
```ts
/** Unique per call within a page, so two figures never share a clip id (they did, per size, until 2026-11-13). */
let nextId = 0;
const TONE: Record<string, string> = { 0: COLORS[0]!, 1: COLORS[1]!, 2: COLORS[2]!, ink: '#111827', muted: '#6b7280' };
const tone = (t: Tone) => TONE[String(t)]!;

function sceneBody(f: SceneFigure, w: number, h: number, lang: 'ar' | 'en'): string[] {
  const out: string[] = [];
  for (const p of layoutScene(f, { w, h }, lang).prims) {
    const dash = 'dash' in p && p.dash ? ' stroke-dasharray="5 4"' : '';
    const width = p.tone === 'muted' ? 1.5 : 2;
    if (p.t === 'line') {
      out.push(`<line x1="${n(p.a.x)}" y1="${n(p.a.y)}" x2="${n(p.b.x)}" y2="${n(p.b.y)}" stroke="${tone(p.tone)}" stroke-width="${width}"${dash}/>`);
    } else if (p.t === 'arrow') {
      out.push(`<line x1="${n(p.a.x)}" y1="${n(p.a.y)}" x2="${n(p.b.x)}" y2="${n(p.b.y)}" stroke="${tone(p.tone)}" stroke-width="${width}"${dash}/>`);
      out.push(`<polygon points="${p.head.map(q => `${n(q.x)},${n(q.y)}`).join(' ')}" fill="${tone(p.tone)}"/>`);
    } else if (p.t === 'poly') {
      const pts = p.pts.map(q => `${n(q.x)},${n(q.y)}`).join(' ');
      out.push(p.closed
        ? `<polygon points="${pts}" fill="none" stroke="${tone(p.tone)}" stroke-width="${width}"${dash}/>`
        : `<polyline points="${pts}" fill="none" stroke="${tone(p.tone)}" stroke-width="${width}"${dash}/>`);
    } else if (p.t === 'circle') {
      out.push(`<circle cx="${n(p.c.x)}" cy="${n(p.c.y)}" r="${n(p.r)}" fill="${p.fill ? tone(p.tone) : 'none'}" stroke="${tone(p.tone)}" stroke-width="${width}"/>`);
    } else {
      out.push(`<text x="${n(p.at.x)}" y="${n(p.at.y)}" fill="${tone(p.tone)}" font-size="13" font-family="sans-serif" text-anchor="${p.anchor}">${esc(p.text)}</text>`);
    }
  }
  return out;
}
```
Change the signature to
```ts
export function figureSvg(figure: AnyFigure, opts: { lang?: 'ar' | 'en'; width?: number; height?: number; id?: string } = {}): string {
```
Replace `const clipId = \`fig-clip-${w}x${h}\`;` with
```ts
  const clipId = opts.id ? `fig-${opts.id}` : `fig-clip-${++nextId}`;
```
Immediately after the `w`, `h`, `lang` constants, before `layoutFigure`, insert the scene branch:
```ts
  if (isSceneFigure(figure)) {
    const clip = opts.id ? `fig-${opts.id}` : `fig-clip-${++nextId}`;
    return [
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" overflow="hidden" role="img" aria-label="${esc(figureAltText(figure, lang))}">`,
      `<defs><clipPath id="${clip}"><rect width="${w}" height="${h}"/></clipPath></defs>`,
      `<g clip-path="url(#${clip})">`,
      `<rect width="${w}" height="${h}" fill="#ffffff"/>`,
      ...sceneBody(figure, w, h, lang),
      '</g>',
      '</svg>',
    ].join('');
  }
```
(after this branch `figure` is narrowed to `Figure`, so `layoutFigure(figure, …)` keeps compiling.)

- [ ] **Step 5: Run the tests**

Run: `cd lib/figure && pnpm test`
Expected: PASS, including the four existing `figureSvg` tests (the old clip-id regex still matches).

- [ ] **Step 6: Commit**

```bash
git add lib/figure/src/svg.ts lib/figure/src/alt.ts lib/figure/src/__tests__/svg.test.ts lib/figure/src/__tests__/alt.test.ts
git commit -m "lib/figure: draw physics scenes as SVG, describe them, and stop sharing clip ids"
```

---

### Task 5: The app renderer

**Files:**
- Create: `artifacts/mobile/components/ui/SceneFigureView.tsx`
- Modify: `artifacts/mobile/components/ui/FigureView.tsx`

**Interfaces:**
- Consumes: `layoutScene`, `ScenePrim`, `Tone`, `isSceneFigure`, `SceneFigure`, `AnyFigure`, `figureAltText` (Tasks 1, 3, 4).
- Produces: `SceneFigureView({ figure, lang }: { figure: SceneFigure; lang: 'ar' | 'en' })`; `FigureView` accepts `figure: AnyFigure`.

No runtime test is possible here (the mobile runner cannot load react-native); the typecheck is the gate and the browser check comes in PR 3.

- [ ] **Step 1: Create `artifacts/mobile/components/ui/SceneFigureView.tsx`**

```tsx
/**
 * A physics figure (forces, attraction, projectile, circular motion, wave) on a
 * card. The geometry is `layoutScene` in lib/figure — the same primitives the
 * PDF's `figureSvg` draws — so the screen and the paper show one picture.
 * Colours follow the card (`readableOn`), and colour is never the only cue:
 * every arrow and mark carries its letter. Numbers and units are Latin, as in
 * the book; only «قمة» / «قاع» are Arabic.
 */
import React, { useId, useMemo, useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, ClipPath, Defs, G, Line, Polygon, Polyline, Rect, Text as SvgText } from 'react-native-svg';
import { figureAltText, layoutScene, type SceneFigure, type Tone } from '@workspace/figure';
import { useColors } from '@/hooks/useColors';
import { readableOn } from '@/services/readableColor';

const SERIES = ['#2563EB', '#DC2626', '#15803D'];
const HEIGHT = 240;
const BORDER = 1;
const MAX_WIDTH = 520;

export function SceneFigureView({ figure, lang }: { figure: SceneFigure; lang: 'ar' | 'en' }) {
  const colors = useColors();
  const [width, setWidth] = useState(0);
  const clipId = `scene${useId().replace(/[^A-Za-z0-9]/g, '')}`;
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));
  const W = Math.max(0, width - 2 * BORDER);
  const H = HEIGHT - 2 * BORDER;
  const layout = useMemo(() => (W > 0 ? layoutScene(figure, { w: W, h: H }, lang) : null), [figure, W, H, lang]);
  const series = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 3)), [colors.card]);
  const ink = useMemo(() => SERIES.map(c => readableOn(c, colors.card, 4.5)), [colors.card]);
  const stroke = (t: Tone) => (t === 'ink' ? colors.foreground : t === 'muted' ? colors.mutedForeground : series[t]!);
  const letter = (t: Tone) => (t === 'ink' ? colors.foreground : t === 'muted' ? colors.mutedForeground : ink[t]!);

  return (
    <View
      onLayout={onLayout}
      accessible
      accessibilityRole="image"
      accessibilityLabel={figureAltText(figure, lang)}
      style={{ marginTop: 12, height: HEIGHT, width: '100%', maxWidth: MAX_WIDTH, alignSelf: lang === 'ar' ? 'flex-end' : 'flex-start', borderWidth: BORDER, borderColor: colors.border, borderRadius: colors.radius, overflow: 'hidden', backgroundColor: colors.card }}
    >
      {layout ? (
        <Svg width={W} height={H}>
          <Defs>
            <ClipPath id={clipId}>
              <Rect x={0} y={0} width={W} height={H} />
            </ClipPath>
          </Defs>
          <G clipPath={`url(#${clipId})`}>
            {layout.prims.map((p, i) => {
              const dash = 'dash' in p && p.dash ? '5 4' : undefined;
              const sw = p.tone === 'muted' ? 1.5 : 2;
              if (p.t === 'line') return <Line key={i} x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />;
              if (p.t === 'arrow') {
                return (
                  <React.Fragment key={i}>
                    <Line x1={p.a.x} y1={p.a.y} x2={p.b.x} y2={p.b.y} stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />
                    <Polygon points={p.head.map(q => `${q.x},${q.y}`).join(' ')} fill={stroke(p.tone)} />
                  </React.Fragment>
                );
              }
              if (p.t === 'poly') {
                const pts = p.pts.map(q => `${q.x},${q.y}`).join(' ');
                return p.closed
                  ? <Polygon key={i} points={pts} fill="none" stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />
                  : <Polyline key={i} points={pts} fill="none" stroke={stroke(p.tone)} strokeWidth={sw} strokeDasharray={dash} />;
              }
              if (p.t === 'circle') return <Circle key={i} cx={p.c.x} cy={p.c.y} r={p.r} fill={p.fill ? stroke(p.tone) : 'none'} stroke={stroke(p.tone)} strokeWidth={sw} />;
              return (
                <SvgText key={i} x={p.at.x} y={p.at.y} textAnchor={p.anchor} fill={letter(p.tone)} fontSize={13} fontFamily="ReadexPro_600SemiBold">
                  {p.text}
                </SvgText>
              );
            })}
          </G>
        </Svg>
      ) : null}
    </View>
  );
}
```

- [ ] **Step 2: Make `FigureView` delegate scenes** — in `artifacts/mobile/components/ui/FigureView.tsx`:

Change the import `import { figureAltText, layoutFigure, type Figure } from '@workspace/figure';` to
```ts
import { figureAltText, isSceneFigure, layoutFigure, type AnyFigure, type Figure } from '@workspace/figure';
import { SceneFigureView } from './SceneFigureView';
```
Rename the existing component `export function FigureView({ figure, lang }: { figure: Figure; lang: 'ar' | 'en' }) {` to `function PlaneFigureView({ figure, lang }: { figure: Figure; lang: 'ar' | 'en' }) {` and add, after it:
```tsx
/** A gated figure on a card: a physics scene, or a graph / vectors on the plane. */
export function FigureView({ figure, lang }: { figure: AnyFigure; lang: 'ar' | 'en' }) {
  return isSceneFigure(figure) ? <SceneFigureView figure={figure} lang={lang} /> : <PlaneFigureView figure={figure} lang={lang} />;
}
```
(Hooks stay inside `PlaneFigureView`, so the rules of hooks hold: `FigureView` calls none.)

- [ ] **Step 3: Typecheck**

Run from the worktree root: `pnpm run typecheck`
Expected: no errors. `QuestionVisual.tsx` and `lesson-explanation.tsx` pass a `Figure`, which is an `AnyFigure`, so they compile unchanged.

- [ ] **Step 4: Commit**

```bash
git add artifacts/mobile/components/ui/SceneFigureView.tsx artifacts/mobile/components/ui/FigureView.tsx
git commit -m "App: draw physics scenes with the same layout as the PDF"
```

---

### Task 6: Look at every kind, write it up, run everything

**Files:**
- Create (scratchpad, not committed): `$SCRATCH/figs/gallery.ts`, PNGs. `export SCRATCH=/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad` in each shell call.
- Modify: `docs/status-log.md`

- [ ] **Step 1: Render the gallery**

```ts
// $SCRATCH/figs/gallery.ts — run: cd /home/user/wt-physics-figures/lib/figure && node --experimental-strip-types $SCRATCH/figs/gallery.ts
import { writeFileSync, mkdirSync } from 'node:fs';
import { figureSvg } from '/home/user/wt-physics-figures/lib/figure/src/svg.ts';
import { resolveSceneFigure } from '/home/user/wt-physics-figures/lib/figure/src/sceneGate.ts';

const SAMPLES: Record<string, unknown> = {
  'forces-flat': { kind: 'forces', body: 'block', arrows: [{ dir: 270, size: 2, label: 'W', value: { n: 49, unit: 'N' } }, { dir: 90, size: 2, label: 'N' }, { dir: 0, size: 3, label: 'F' }, { dir: 180, size: 1, label: 'f' }] },
  'forces-incline': { kind: 'forces', body: 'block', incline: 30, arrows: [{ dir: 270, size: 2, label: 'W' }, { dir: 120, size: 2, label: 'N' }, { dir: 210, size: 1, label: 'f' }] },
  'forces-point': { kind: 'forces', body: 'point', arrows: [{ dir: 45, size: 3, label: 'F1' }, { dir: 135, size: 3, label: 'F2' }] },
  'attraction': { kind: 'attraction', bodies: ['m1', 'm2'], force: 'F', distance: { label: 'r', value: { n: 2, unit: 'm' } } },
  'projectile-30': { kind: 'projectile', launch: 'ground', angle: 30, speed: { n: 20, unit: 'm/s' }, marks: ['v0', 'vx', 'vy', 'H', 'R'] },
  'projectile-75': { kind: 'projectile', launch: 'ground', angle: 75, marks: ['H', 'R'] },
  'projectile-horizontal': { kind: 'projectile', launch: 'horizontal', speed: { n: 15, unit: 'm/s' }, height: { n: 45, unit: 'm' }, marks: ['v0', 'vx', 'vy', 'R'] },
  'circular-ccw': { kind: 'circular', turning: 'ccw', radius: { label: 'r', value: { n: 0.5, unit: 'm' } }, arrows: ['v', 'F'] },
  'circular-cw': { kind: 'circular', turning: 'cw', arrows: ['v', 'a'] },
  'wave-marks': { kind: 'wave', cycles: 2, marks: ['crest', 'trough', 'A', 'lambda'], amplitude: { n: 0.2, unit: 'm' }, wavelength: { n: 4, unit: 'm' } },
  'wave-in-phase': { kind: 'wave', cycles: 3, marks: [], second: { phase: 'in', sum: true } },
  'wave-out-phase': { kind: 'wave', cycles: 1, marks: ['lambda'], second: { phase: 'out', sum: true } },
};

mkdirSync(`${process.env.SCRATCH}/figs`, { recursive: true });
const cells: string[] = [];
for (const [name, raw] of Object.entries(SAMPLES)) {
  const f = resolveSceneFigure(raw);
  if (!f) throw new Error(`gate refused ${name}`);
  for (const lang of ['ar', 'en'] as const) cells.push(`<figure><figcaption>${name} (${lang})</figcaption>${figureSvg(f, { lang })}</figure>`);
}
writeFileSync(`${process.env.SCRATCH}/figs/gallery.html`, `<!doctype html><meta charset="utf-8"><style>body{display:grid;grid-template-columns:repeat(2,500px);gap:12px;font:12px sans-serif}figure{margin:0}</style>${cells.join('')}`);
console.log('wrote gallery.html with', cells.length, 'figures');
```

Then screenshot it with the pre-installed Playwright (deviceScaleFactor 1, full page):
```bash
export SCRATCH=/tmp/claude-0/-home-user-Iqraa/33e07f7b-582b-5db3-b942-62ad2d3e357f/scratchpad
cd /home/user/wt-physics-figures/lib/figure && node --experimental-strip-types $SCRATCH/figs/gallery.ts
node -e "const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1040,height:800},deviceScaleFactor:1});await p.goto('file://'+process.env.SCRATCH+'/figs/gallery.html');await p.screenshot({path:process.env.SCRATCH+'/figs/gallery.png',fullPage:true});await b.close();})()"
```
Expected: `gallery.png` exists.

- [ ] **Step 2: Read the gallery image by eye** (the controller does this, not a subagent) and check each figure: arrows point the stated way (W down, N up, F right; incline N perpendicular-ish to the slope as specified by `dir`); the slope rises at 30°; projectile apex mid-range and the 75° path tall and narrow; horizontal launch leaves the ledge horizontally; v tangent and F/a toward the centre, cw and ccw opposite; λ spans one cycle; in-phase sum twice as tall, out-of-phase sum flat; no label clipped or sitting on a line; Arabic «قمة»/«قاع» render. Any defect → fix the layout in `scene.ts`, re-run Task 3's tests and this step.

- [ ] **Step 3: Write the status-log entry** at the top of `docs/status-log.md` (after the file's header paragraph, before the first `## ` entry), titled «lib/figure: physics scenes (forces, attraction, projectile, circular motion, wave) — 2026-11-13». Say: what was added (kinds, `resolveSceneFigure` / `resolvePhysicsFigure`, `figureNumbersInText`, `layoutScene`, both renderers, unique clip id); that `resolveFigure` / `Figure` are deliberately unchanged and why (maths callers must never receive a scene); what was verified (package tests, typecheck, the gallery read by eye — list the kinds); what was **not** (no caller passes a scene yet — server and app wiring are PRs 2 and 3; `SceneFigureView` has only been typechecked, not seen on a device or in a browser; no live model has written one); spec link.

- [ ] **Step 4: Run every check**

```bash
cd /home/user/wt-physics-figures/lib/figure && pnpm test
```
```bash
cd /home/user/wt-physics-figures && pnpm run typecheck
```
```bash
cd /home/user/wt-physics-figures/artifacts/api-server && pnpm build && pnpm test
```
```bash
cd /home/user/wt-physics-figures/artifacts/mobile && pnpm test
```
Expected: all pass (api-server and mobile consume `@workspace/figure`; their figure tests must be unchanged).

- [ ] **Step 5: Commit, push, update the PR**

```bash
cd /home/user/wt-physics-figures && git add docs/status-log.md && git commit -m "Docs: physics scenes in lib/figure"
git push -u origin claude/physics-figures-1
```
Update NizarAbuahmad/Iqraa#1443's body: what this PR now contains, the checks with counts, the gallery verdict, the not-verified list, and «ما الجديد: none — no user-visible change in this PR».
