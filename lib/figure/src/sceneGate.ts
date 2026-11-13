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
  // Never negative: a drawn arrow's direction carries the sign, and the leak guard compares magnitudes.
  if (!isNum(n) || n < 0 || n > S.maxValue) return null;
  if (Math.abs(n * 10 ** S.valueDecimals - Math.round(n * 10 ** S.valueDecimals)) > 1e-6) return null;
  if (!oneOf(unit, PHYSICS_UNITS)) return null;
  return { n: Number(n.toFixed(S.valueDecimals)), unit };
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
    if (!isInt(i) || i < S.minIncline || i > S.maxIncline || body !== 'block') return null;
    incline = i;
  }
  const list = raw['arrows'];
  if (!Array.isArray(list) || list.length < 1 || list.length > S.maxArrows) return null;
  const labels = new Set<string>();
  const arrows: ForcesFigure['arrows'] = [];
  for (const a of list) {
    if (!isRec(a)) return null;
    const dir = a['dir'];
    const size = a['size'];
    const label = a['label'];
    if (!isInt(dir) || dir < 0 || dir > 359) return null;
    // Two arrows from one body less than MIN_ARROW_GAP apart (on the circle: 355° and 5° are 10°) draw over each other.
    if (arrows.some(b => Math.min(Math.abs(b.dir - dir), 360 - Math.abs(b.dir - dir)) < MIN_ARROW_GAP)) return null;
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
    if (!isInt(angleRaw) || angleRaw < S.minAngle || angleRaw > S.maxAngle) return null;
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
  if (!isInt(cycles) || cycles < 1 || cycles > S.maxCycles) return null;
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
    kind: 'wave', cycles: cycles as WaveFigure['cycles'], marks,
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
