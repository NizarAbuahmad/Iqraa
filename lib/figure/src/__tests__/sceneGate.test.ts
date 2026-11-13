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
