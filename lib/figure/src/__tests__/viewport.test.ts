import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { gridTicks, type Viewport } from '../viewport.ts';

// Viewports shaped like the figures the gate once accepted and then hung on:
// the tick loop's counter stopped changing above 2^53, or toFixed threw.
const W = 400;
const H = 300;
const from = (x0: number, x1: number, y0: number, y1: number): Viewport => ({
  cx: (x0 + x1) / 2,
  cy: (y0 + y1) / 2,
  sx: W / ((x1 - x0) * 1.08),
  sy: H / (y1 - y0),
  w: W,
  h: H,
});

describe('gridTicks never hangs or throws on a degenerate view', () => {
  const probes: [string, Viewport][] = [
    ['x [-50, -49.99999999999999]', from(-50, -49.99999999999999, -1, 1)],
    ['y [999.9999999999999, 1000]', from(-1, 1, 999.9999999999999, 1000)],
    ['y around 1e12, span 2.4e-4', from(-1, 1, 1e12 - 1.2e-4, 1e12 + 1.2e-4)],
    ['y [0, 1e-120]', from(-1, 1, 0, 1e-120)],
    ['x [0, 1e-300]', from(0, 1e-300, -1, 1)],
    ['infinite scale', { cx: 0, cy: 0, sx: Infinity, sy: Infinity, w: W, h: H }],
    ['NaN centre', { cx: NaN, cy: NaN, sx: 10, sy: 10, w: W, h: H }],
  ];
  for (const [name, vp] of probes) {
    it(name, () => {
      for (const mode of ['decimal', 'deg'] as const) {
        const t = gridTicks(vp, mode);
        assert.ok(t.xs.length <= 2000 && t.ys.length <= 2000, `${t.xs.length}/${t.ys.length}`);
        for (const k of [...t.xs, ...t.ys]) assert.ok(Number.isFinite(k.value), String(k.value));
      }
    });
  }

  it('still draws an ordinary grid', () => {
    const t = gridTicks({ cx: 0, cy: 0, sx: 20, sy: 20, w: W, h: H });
    assert.ok(t.xs.length >= 5 && t.ys.length >= 5);
  });
});
