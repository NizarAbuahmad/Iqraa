import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { figureSvg } from '../svg.ts';
import { layoutFigure } from '../geometry.ts';
import { resolveFigure } from '../gate.ts';

// Figures the first gate accepted and every renderer then hung or threw on.
// Either the gate refuses them now, or they lay out and draw with finite numbers.
const g = (functions: unknown, x: unknown, y?: unknown) => ({ kind: 'function-graph', functions, x, ...(y ? { y } : {}) });

const probes: [string, unknown][] = [
  ['x [-50, -49.99999999999999]', g([{ expr: 'x' }], [-50, -49.99999999999999])],
  ['y [999.9999999999999, 1000]', g([{ expr: 'x' }], [-1, 1], [999.9999999999999, 1000])],
  ['10^12 + x/10000 on [-1, 1]', g([{ expr: '10^12 + x/10000' }], [-1, 1])],
  ['y [0, 1e-120]', g([{ expr: 'x' }], [-1, 1], [0, 1e-120])],
  ['x [0, 1e-300]', g([{ expr: 'x' }], [0, 1e-300])],
  ['10^300*x', g([{ expr: '10^300*x' }], [-1, 1])],
  ['1e8 + x/10000 on [-1, 1]', g([{ expr: '100000000 + x/10000' }], [-1, 1])],
  ['1000000*x on [-20, 20]', g([{ expr: '1000000*x' }], [-20, 20])],
];

describe('adversarial figures', () => {
  for (const [name, raw] of probes) {
    it(name, () => {
      const f = resolveFigure(raw);
      if (f === null) return;
      for (const [w, h] of [[480, 320], [300, 200]] as const) {
        const lay = layoutFigure(f, { w, h });
        assert.ok(Number.isFinite(lay.viewport.sx) && Number.isFinite(lay.viewport.sy));
        const svg = figureSvg(f, { width: w, height: h });
        assert.ok(!/NaN|Infinity/.test(svg), 'no NaN or Infinity in the svg');
        assert.ok(svg.length < 2_000_000, `svg is ${svg.length} bytes`);
      }
    });
  }
});
