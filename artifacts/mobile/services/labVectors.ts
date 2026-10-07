/**
 * Vector addition for the lab's interactive, plus the layout that fits the
 * drawing to its canvas.
 *
 * Maths in latin and radians internally; angles in and out are degrees counter-
 * clockwise from +x, kept in [0, 360). A resultant that is zero (opposite
 * vectors) reports angle 0 rather than whatever atan2 returns for rounding
 * noise.
 */
export interface PolarVector {
  magnitude: number;
  angleDeg: number;
}

export interface Components {
  x: number;
  y: number;
}

export interface ScenePoint {
  x: number;
  y: number;
}

const EPS = 1e-9;
const RAD = Math.PI / 180;

export function toComponents(v: PolarVector): Components {
  return { x: v.magnitude * Math.cos(v.angleDeg * RAD), y: v.magnitude * Math.sin(v.angleDeg * RAD) };
}

export function fromComponents(c: Components): PolarVector {
  const magnitude = Math.hypot(c.x, c.y);
  if (magnitude < EPS) return { magnitude: 0, angleDeg: 0 };
  let angleDeg = Math.atan2(c.y, c.x) / RAD;
  if (angleDeg < 0) angleDeg += 360;
  // atan2 of a hair below zero lands at 359.99999… — that is 0°.
  if (angleDeg >= 360 - EPS) angleDeg = 0;
  return { magnitude, angleDeg };
}

export function addVectors(a: PolarVector, b: PolarVector): { components: Components; resultant: PolarVector } {
  const ca = toComponents(a);
  const cb = toComponents(b);
  const components = { x: ca.x + cb.x, y: ca.y + cb.y };
  return { components, resultant: fromComponents(components) };
}

/**
 * Head-to-tail drawing fitted to a square canvas: A from the origin to `aTip`,
 * B from `aTip` to `rTip`, and the resultant from the origin to `rTip`. The
 * scale is chosen so all three points sit inside `padding`; y is flipped for a
 * screen that counts downward.
 */
export function layoutScene(
  a: PolarVector,
  b: PolarVector,
  size: number,
  padding = 24,
): { origin: ScenePoint; aTip: ScenePoint; rTip: ScenePoint } {
  const ca = toComponents(a);
  const cb = toComponents(b);
  const pts = [
    { x: 0, y: 0 },
    { x: ca.x, y: ca.y },
    { x: ca.x + cb.x, y: ca.y + cb.y },
  ];
  const minX = Math.min(...pts.map(p => p.x));
  const maxX = Math.max(...pts.map(p => p.x));
  const minY = Math.min(...pts.map(p => p.y));
  const maxY = Math.max(...pts.map(p => p.y));
  const span = Math.max(maxX - minX, maxY - minY, EPS);
  const scale = (size - 2 * padding) / span;
  // Centre the drawing in the box along the shorter axis.
  const offX = padding + ((size - 2 * padding) - (maxX - minX) * scale) / 2;
  const offY = padding + ((size - 2 * padding) - (maxY - minY) * scale) / 2;
  const map = (p: { x: number; y: number }): ScenePoint => ({
    x: offX + (p.x - minX) * scale,
    y: size - (offY + (p.y - minY) * scale),
  });
  return { origin: map(pts[0]), aTip: map(pts[1]), rTip: map(pts[2]) };
}
