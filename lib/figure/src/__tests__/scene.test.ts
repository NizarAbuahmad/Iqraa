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
  p.t === 'line' ? [p.a, p.b]
    : p.t === 'arrow' ? [p.a, p.b, ...p.head]
      : p.t === 'poly' ? p.pts
        : p.t === 'circle' ? [{ x: p.c.x - p.r, y: p.c.y - p.r }, { x: p.c.x + p.r, y: p.c.y + p.r }]
          : [p.at];

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
  { kind: 'forces', body: 'block', incline: 5, arrows: [{ dir: 270, size: 3, label: 'W' }, { dir: 95, size: 3, label: 'N' }] },
  { kind: 'forces', body: 'block', incline: 60, arrows: [{ dir: 270, size: 3, label: 'W' }, { dir: 150, size: 3, label: 'N' }] },
  { kind: 'forces', body: 'block', arrows: [{ dir: 0, size: 3, label: 'F', value: { n: 100, unit: 'N' } }, { dir: 180, size: 3, label: 'f', value: { n: 20, unit: 'N' } }] },
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

  it('projectile: the v0 label sits above the path, and a low drawing is centred', () => {
    const prims = layoutScene(SAMPLES[4]!, BOX).prims;
    const lab = one(prims, 'v0-label');
    const path = one(prims, 'path');
    if (lab.t !== 'text' || path.t !== 'poly') return assert.fail('shapes');
    const half = (lab.text.length * 7.2) / 2;
    const near = path.pts.filter(q => q.x >= lab.at.x - half && q.x <= lab.at.x + half);
    assert.ok(near.length > 0);
    for (const q of near) assert.ok(lab.at.y - 4 < q.y, `label centre ${lab.at.y - 4} above path ${q.y}`);
    const apex = path.pts.reduce((a, b) => (b.y < a.y ? b : a));
    const rl = one(prims, 'R-label');
    if (rl.t !== 'text') return assert.fail('R-label');
    assert.ok(Math.abs(apex.y - (BOX.h - rl.at.y)) < 40, 'roughly centred');
    const tall = one(layoutScene(SAMPLES[5]!, BOX).prims, 'path');
    if (tall.t !== 'poly') return assert.fail('path');
    assert.ok(Math.abs(Math.min(...tall.pts.map(q => q.y)) - (24 + 14)) <= 1, 'steep path still reaches Hmax');
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

  it('forces: a value label never covers its own arrowhead', () => {
    for (const box of [BOX, SMALL]) {
      for (const f of SAMPLES.filter(s => s.kind === 'forces')) {
        const prims = layoutScene(f, box).prims;
        for (const lab of prims.filter(p => p.t === 'text' && p.role.startsWith('label:'))) {
          const arr = one(prims, 'arrow:' + lab.role.slice(6));
          if (lab.t !== 'text' || arr.t !== 'arrow') return assert.fail('shapes');
          const half = (lab.text.length * 7.2) / 2;
          const inside = arr.b.x >= lab.at.x - half && arr.b.x <= lab.at.x + half && arr.b.y >= lab.at.y - 13 && arr.b.y <= lab.at.y + 4;
          assert.ok(!inside, `${lab.text} covers its tip in ${box.w}x${box.h}`);
        }
      }
    }
  });

  it('wave: the λ line sits below the in-phase sum', () => {
    const prims = layoutScene({ kind: 'wave', cycles: 2, marks: ['lambda'], second: { phase: 'in', sum: true } }, BOX).prims;
    const sum = one(prims, 'sum');
    const l = one(prims, 'lambda');
    if (sum.t !== 'poly' || l.t !== 'line') return assert.fail('shapes');
    assert.ok(l.a.y > Math.max(...sum.pts.map(q => q.y)));
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
