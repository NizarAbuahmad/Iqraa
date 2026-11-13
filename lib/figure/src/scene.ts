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
    const dx = Math.cos(rad(a.dir));
    const dy = -Math.sin(rad(a.dir));
    const toEdge = Math.min(
      Math.abs(dx) > 1e-9 ? (dx > 0 ? box.w - c.x : -c.x) / dx : Infinity,
      Math.abs(dy) > 1e-9 ? (dy > 0 ? box.h - c.y : -c.y) / dy : Infinity,
    );
    const len = Math.min(unit * [0, 0.18, 0.27, 0.36][a.size]!, Math.max(toEdge - 26, 0));
    const tip = polar(c, a.dir, len);
    out.push(arrow(c, tip, series(i), `arrow:${a.label}`));
    const label = tagged(a.label, a.value);
    const half = (label.length * GLYPH) / 2;
    const at = polar(c, a.dir, len + 12 + Math.abs(dx) * half);
    out.push(text({ x: at.x, y: at.y + 4 }, label, box, `label:${a.label}`, series(i)));
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
  const ground0 = box.h - M - 12;
  // A low trajectory is centred vertically; one scaled up to the box stays put.
  let ground = ground0;
  if (f.launch === 'ground') {
    const Hmax0 = ground0 - M - 14;
    const H0 = ((box.w - 2 * M) * Math.tan(rad(f.angle!))) / 4;
    if (H0 < Hmax0) ground = ground0 - (Hmax0 - H0) / 2;
  }
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
    // Inside the angle, between the ground and the v0 arrow, so it never meets the vx label.
    const len = Math.min(unit * 0.22, R * 0.45);
    const ang = polar(O, deg / 2, Math.max(36, len * 0.7));
    out.push(text({ x: ang.x, y: ang.y }, `${deg}°`, box, 'angle', 'muted'));
    const tip = polar(O, deg, len);
    if (has('v0')) {
      out.push(arrow(O, tip, 1, 'v0'));
    }
    if (has('vx')) {
      out.push(arrow(O, { x: tip.x, y: O.y }, 2, 'vx', true));
      out.push(text({ x: tip.x + 26, y: O.y - 4 }, 'vx', box, 'vx-label', 2));
    }
    if (has('vy')) {
      out.push(arrow(O, { x: O.x, y: tip.y }, 2, 'vy', true));
      out.push(text({ x: O.x - 12, y: tip.y - 4 }, 'vy', box, 'vy-label', 2));
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
    if (has('v0')) {
      // The first spot that crosses neither the path nor another word: above the arrow, then
      // beside its tip inside the arch, then below it, then further out.
      const s = tagged('v0', f.speed);
      const half = (s.length * GLYPH) / 2;
      const words = out.filter((p): p is Extract<ScenePrim, { t: 'text' }> => p.t === 'text');
      const clear = (t: Extract<ScenePrim, { t: 'text' }>) => {
        const h = (t.text.length * GLYPH) / 2;
        const hit = (x: number, y: number, w: number, h2: number) =>
          Math.abs(x - t.at.x) < h + w && y > t.at.y - 11 - h2 && y < t.at.y + 2 + h2;
        return !pts.some(q => hit(q.x, q.y, 0, 0))
          && !words.some(w => {
            const wh = (w.text.length * GLYPH) / 2;
            return Math.abs(w.at.x - t.at.x) < h + wh && w.at.y - 11 < t.at.y + 2 && w.at.y + 2 > t.at.y - 11;
          });
      };
      const spots: Pt[] = [
        polar(tip, deg + 90, 14 + 6.5),
        { x: tip.x + 10 + half, y: tip.y },
        { x: tip.x + 10 + half, y: tip.y - 16 },
        polar(tip, deg - 90, 14 + 6.5),
        polar(tip, deg, 16 + half),
        { x: tip.x + 14 + half, y: tip.y + 20 },
      ];
      let pick: ScenePrim | null = null;
      for (const sp of spots) {
        const t = text(sp, s, box, 'v0-label', 1);
        if (t.t === 'text' && clear(t)) { pick = t; break; }
      }
      out.push(pick ?? text(spots[0]!, s, box, 'v0-label', 1));
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
  if (f.height) {
    const hl = tagged('h', f.height);
    out.push(text({ x: P.x + 8 + (hl.length * GLYPH) / 2, y: (P.y + ground) / 2 + 30 }, hl, box, 'height-label', 'muted'));
  }
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
    const yl = Math.min(box.h - 22, y0 + (doubled ? 2 * A : A) + 26);
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
