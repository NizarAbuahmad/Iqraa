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
