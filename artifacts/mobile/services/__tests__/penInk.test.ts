/**
 * Pen ink has to stay on the slide it marks when the stage is resized.
 *
 * Strokes were stored in raw canvas pixels, so toggling fullscreen, rotating a
 * tablet or dragging the browser window left every circle and underline where
 * it was while the slide reflowed underneath — «ink drifts off the content on
 * resize», the last open item from the PR #772 review. Points are now kept as
 * fractions of the canvas width and scaled back at render time. Both axes use
 * the WIDTH: a uniform scale keeps a drawn circle round, where scaling y by
 * the height would squash it whenever the aspect ratio changed.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { appendInkPoint, scaleInkPoints } from '../penInk.ts';

describe('appendInkPoint', () => {
  it('records a point as a fraction of the canvas width', () => {
    assert.equal(appendInkPoint('', 100, 50, 200), '0.5,0.25');
  });

  it('appends to an existing stroke', () => {
    assert.equal(appendInkPoint('0.5,0.25', 200, 100, 200), '0.5,0.25 1,0.5');
  });

  it('records nothing before the canvas has a width', () => {
    assert.equal(appendInkPoint('0.5,0.25', 10, 10, 0), '0.5,0.25');
    assert.equal(appendInkPoint('', 10, 10, 0), '');
    assert.equal(appendInkPoint('', 10, 10, Number.NaN), '');
  });

  it('keeps a tap as a zero-length segment so it leaves a dot', () => {
    const p = appendInkPoint(appendInkPoint('', 40, 40, 400), 40, 40, 400);
    assert.equal(p, '0.1,0.1 0.1,0.1');
  });
});

describe('scaleInkPoints', () => {
  it('draws the stored fractions at the current width', () => {
    assert.equal(scaleInkPoints('0.5,0.25 1,0.5', 400), '200,100 400,200');
  });

  it('puts a stroke at the same place on the slide after a resize', () => {
    const drawn = appendInkPoint('', 300, 150, 600); // at 600 wide
    // Stage narrows to 300: the same spot is half as far across and down.
    assert.equal(scaleInkPoints(drawn, 300), '150,75');
    // …and back again lands exactly where it started.
    assert.equal(scaleInkPoints(drawn, 600), '300,150');
  });

  it('keeps proportions, so a circle stays round', () => {
    const w1 = 800;
    const pts = [[400, 100], [500, 200], [400, 300], [300, 200]];
    const stored = pts.reduce((acc, [x, y]) => appendInkPoint(acc, x!, y!, w1), '');
    const out = scaleInkPoints(stored, 400).split(' ').map(s => s.split(',').map(Number));
    const xs = out.map(p => p[0]!), ys = out.map(p => p[1]!);
    assert.equal(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  });

  it('draws nothing at an unusable width, and tolerates an empty stroke', () => {
    assert.equal(scaleInkPoints('0.5,0.25', 0), '');
    assert.equal(scaleInkPoints('0.5,0.25', Number.NaN), '');
    assert.equal(scaleInkPoints('', 400), '');
  });
});
