/**
 * Vector addition for the lab's interactive.
 *
 * The edge cases are the ones a demo hits live: opposite vectors that cancel
 * (a zero resultant must not report a stray angle), and vectors straddling 0°,
 * where atan2 returns a tiny negative angle that must not render as 359.999°.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { addVectors, fromComponents, layoutScene, toComponents } from '../labVectors.ts';

function close(actual: number, expected: number, tol = 1e-6): void {
  assert.ok(Math.abs(actual - expected) <= tol, `${actual} is not within ${tol} of ${expected}`);
}

/** Angles are circular: 359.9999999° and 0° are the same direction. */
function angleClose(actual: number, expected: number, tol = 1e-6): void {
  const d = Math.abs(((actual - expected + 540) % 360) - 180);
  assert.ok(d <= tol, `${actual}° is not ${expected}°`);
}

describe('toComponents / fromComponents', () => {
  it('round-trips', () => {
    const c = toComponents({ magnitude: 10, angleDeg: 30 });
    close(c.x, 10 * Math.cos(Math.PI / 6));
    close(c.y, 5);
    const p = fromComponents(c);
    close(p.magnitude, 10);
    angleClose(p.angleDeg, 30);
  });

  it('keeps angles in [0, 360)', () => {
    const p = fromComponents({ x: 1, y: -1 });
    close(p.angleDeg, 315);
    const zero = fromComponents({ x: 0, y: 0 });
    assert.deepEqual(zero, { magnitude: 0, angleDeg: 0 });
  });
});

describe('addVectors', () => {
  it('adds a 3-4-5 pair at right angles', () => {
    const { resultant } = addVectors({ magnitude: 3, angleDeg: 0 }, { magnitude: 4, angleDeg: 90 });
    close(resultant.magnitude, 5);
    close(resultant.angleDeg, 53.13010235, 1e-6);
  });

  it('is commutative', () => {
    const a = { magnitude: 7, angleDeg: 20 };
    const b = { magnitude: 2, angleDeg: 200 };
    const ab = addVectors(a, b).resultant;
    const ba = addVectors(b, a).resultant;
    close(ab.magnitude, ba.magnitude);
    angleClose(ab.angleDeg, ba.angleDeg);
  });

  it('cancels opposite vectors to a clean zero', () => {
    const { resultant } = addVectors({ magnitude: 5, angleDeg: 0 }, { magnitude: 5, angleDeg: 180 });
    assert.deepEqual(resultant, { magnitude: 0, angleDeg: 0 });
  });

  it('does not report 359.99° for vectors straddling zero', () => {
    const { resultant } = addVectors({ magnitude: 10, angleDeg: 350 }, { magnitude: 10, angleDeg: 10 });
    close(resultant.magnitude, 20 * Math.cos((10 * Math.PI) / 180));
    angleClose(resultant.angleDeg, 0);
    // Not merely circularly close: the value shown must be 0, not 359.99999.
    assert.ok(resultant.angleDeg < 1e-6);
  });
});

describe('layoutScene', () => {
  const size = 300;
  const padding = 24;

  it('keeps every point inside the padded box', () => {
    const cases: Array<[number, number, number, number]> = [
      [10, 0, 10, 90],
      [20, 45, 5, 225],
      [1, 10, 19, 350],
    ];
    for (const [ma, aa, mb, ab] of cases) {
      const { origin, aTip, rTip } = layoutScene(
        { magnitude: ma, angleDeg: aa },
        { magnitude: mb, angleDeg: ab },
        size,
        padding,
      );
      for (const p of [origin, aTip, rTip]) {
        assert.ok(p.x >= padding - 1e-6 && p.x <= size - padding + 1e-6, `x ${p.x}`);
        assert.ok(p.y >= padding - 1e-6 && p.y <= size - padding + 1e-6, `y ${p.y}`);
      }
    }
  });

  it('flips y so that an upward vector points up the screen', () => {
    const { origin, aTip } = layoutScene({ magnitude: 10, angleDeg: 90 }, { magnitude: 0, angleDeg: 0 }, size, padding);
    assert.ok(aTip.y < origin.y);
  });

  it('survives two zero vectors without dividing by zero', () => {
    const { origin, aTip, rTip } = layoutScene({ magnitude: 0, angleDeg: 0 }, { magnitude: 0, angleDeg: 0 }, size, padding);
    for (const p of [origin, aTip, rTip]) {
      assert.ok(Number.isFinite(p.x) && Number.isFinite(p.y));
    }
  });
});
