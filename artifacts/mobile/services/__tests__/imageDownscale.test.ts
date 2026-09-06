/**
 * The arithmetic behind shrinking a photo.
 *
 * `downscaleImage` itself needs a browser, but this is the part that decides
 * whether a photo gets smaller, stays the same, or is accidentally scaled *up*
 * — and the last of those would add bytes to make the page blurrier.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { fitWithin, MAX_SCAN_EDGE } from '../imageFit.ts';

describe('fitWithin', () => {
  it('shrinks a phone photo to the long edge, keeping its shape', () => {
    // A typical 12MP portrait photo.
    const out = fitWithin(3024, 4032, 1600);
    assert.equal(out.height, 1600);
    assert.equal(out.width, 1200);
    assert.equal(Math.abs(out.width / out.height - 3024 / 4032) < 0.01, true);
  });

  it('handles landscape the same way', () => {
    const out = fitWithin(4032, 3024, 1600);
    assert.equal(out.width, 1600);
    assert.equal(out.height, 1200);
  });

  it('never scales a small image up', () => {
    // Enlarging costs bytes and adds no detail — the result would be a bigger,
    // blurrier upload.
    assert.deepEqual(fitWithin(800, 600, 1600), { width: 800, height: 600 });
    assert.deepEqual(fitWithin(1600, 1200, 1600), { width: 1600, height: 1200 });
  });

  it('keeps a very thin image at least one pixel wide', () => {
    // 8000x3 would otherwise round the short side to zero and give a canvas
    // nothing can be drawn on.
    const out = fitWithin(8000, 3, 1600);
    assert.equal(out.width, 1600);
    assert.ok(out.height >= 1);
  });

  it('is zero for a dimensionless image rather than NaN', () => {
    for (const [w, h] of [[0, 100], [100, 0], [-5, 5], [NaN, 100]]) {
      assert.deepEqual(fitWithin(w!, h!, 1600), { width: 0, height: 0 });
    }
  });

  it('cuts a 12MP photo to about a sixth of its pixels', () => {
    // The point of the exercise: the first production scan was refused for
    // size. Pixels are a fair proxy for the bytes that got it refused.
    // 3024x4032 (12.2MP) becomes 1200x1600 (1.9MP) — a factor of about 6.35.
    const before = 3024 * 4032;
    const { width, height } = fitWithin(3024, 4032, MAX_SCAN_EDGE);
    const after = width * height;
    const factor = before / after;
    assert.ok(factor > 5, `expected at least a 5x cut, got ${factor.toFixed(1)}x`);
    assert.ok(after < 2_000_000, `expected under 2MP, got ${after}`);
  });
});
