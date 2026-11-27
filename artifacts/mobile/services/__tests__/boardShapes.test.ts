/**
 * Shapes on the whiteboard are ordinary strokes: a line, an arrow, a rectangle or an ellipse is
 * a polyline in the stored unit (fractions of the canvas width), so undo, the eraser, the saved
 * file, the PDF and a shared board all handle it with no format change. These tests pin the
 * geometry and that wiring.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { SHAPE_KINDS, isShapeBigEnough, shapePoints } from '../boardShapes.ts';
import { MAX_POINTS_CHARS, parseBoard } from '../boardFile.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(here, '..', '..', ...p), 'utf8');

const pts = (s: string) => s.split(' ').map(p => p.split(',').map(Number) as [number, number]);
const A = { x: 0.2, y: 0.1 };
const B = { x: 0.6, y: 0.3 };

describe('shapePoints', () => {
  it('lists four kinds, in toolbar order', () => {
    assert.deepEqual([...SHAPE_KINDS], ['line', 'arrow', 'rect', 'ellipse']);
  });

  it('a line is its two ends', () => {
    assert.deepEqual(pts(shapePoints('line', A, B)), [[0.2, 0.1], [0.6, 0.3]]);
  });

  it('a line follows the finger in any direction', () => {
    assert.deepEqual(pts(shapePoints('line', B, A)), [[0.6, 0.3], [0.2, 0.1]]);
  });

  it('an arrow runs shaft then head, both barbs ending on the tip', () => {
    const p = pts(shapePoints('arrow', A, B));
    assert.deepEqual(p[0], [0.2, 0.1]);
    assert.deepEqual(p[1], [0.6, 0.3]);
    assert.deepEqual(p[3], [0.6, 0.3]);
    assert.equal(p.length, 5);
    // the barbs sit behind the tip, one each side of the shaft
    const dir = [B.x - A.x, B.y - A.y];
    const side = (q: [number, number]) => (q[0] - B.x) * dir[1]! - (q[1] - B.y) * dir[0]!;
    assert.ok(side(p[2]!) * side(p[4]!) < 0, 'barbs on opposite sides');
    for (const i of [2, 4]) assert.ok((p[i]![0] - B.x) * dir[0]! + (p[i]![1] - B.y) * dir[1]! < 0, 'barb is behind the tip');
  });

  it('an arrow head never outgrows a short arrow', () => {
    const p = pts(shapePoints('arrow', A, { x: 0.22, y: 0.1 }));
    const barb = Math.hypot(p[2]![0] - 0.22, p[2]![1] - 0.1);
    assert.ok(barb <= 0.02 * 0.5 + 1e-9, `barb ${barb}`);
  });

  it('a rectangle is closed and has the finger as one corner and its opposite as the other', () => {
    assert.deepEqual(pts(shapePoints('rect', A, B)), [[0.2, 0.1], [0.6, 0.1], [0.6, 0.3], [0.2, 0.3], [0.2, 0.1]]);
    assert.deepEqual(pts(shapePoints('rect', B, A)), [[0.6, 0.3], [0.2, 0.3], [0.2, 0.1], [0.6, 0.1], [0.6, 0.3]]);
  });

  it('an ellipse fills the box the finger drew and closes on itself', () => {
    const p = pts(shapePoints('ellipse', A, B));
    assert.deepEqual(p[0], p[p.length - 1]);
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    assert.ok(Math.abs(Math.min(...xs) - 0.2) < 1e-4 && Math.abs(Math.max(...xs) - 0.6) < 1e-4);
    assert.ok(Math.abs(Math.min(...ys) - 0.1) < 1e-4 && Math.abs(Math.max(...ys) - 0.3) < 1e-4);
    assert.ok(p.length >= 33);
  });

  it('every shape is a valid stored stroke: digits, commas and spaces only', () => {
    for (const k of SHAPE_KINDS) assert.match(shapePoints(k, A, B), /^-?[\d.]+,-?[\d.]+( -?[\d.]+,-?[\d.]+)+$/);
  });

  it('a board holding every shape is a valid saved file', () => {
    const strokes = SHAPE_KINDS.map(k => ({ color: '#DC2626', width: 6, points: shapePoints(k, A, B) }));
    assert.ok(strokes.every(s => s.points.length < MAX_POINTS_CHARS));
    const r = parseBoard({ version: 1, canvas: { w: 1280, h: 720 }, pages: [{ background: 'blank', strokes }] });
    assert.equal(r.ok, true);
  });
});

describe('a tap is not a shape', () => {
  it('needs the finger to travel a little', () => {
    assert.equal(isShapeBigEnough(A, A), false);
    assert.equal(isShapeBigEnough(A, { x: 0.205, y: 0.1 }), false);
    assert.equal(isShapeBigEnough(A, B), true);
    assert.equal(isShapeBigEnough(A, { x: 0.2, y: 0.4 }), true, 'a vertical line is a shape');
  });
});

describe('the board wires shapes in', () => {
  const pen = read('components', 'classroom', 'PenLayer.tsx');
  const bar = read('components', 'classroom', 'BoardToolbar.tsx');
  const wb = read('app', 'ai-tools', 'whiteboard.tsx');
  it('PenCanvas draws a shape while dragging and drops a tap', () => {
    assert.match(pen, /shapePoints\(/);
    assert.match(pen, /isShapeBigEnough\(/);
  });
  it('the toolbar has a shape tool and a kind for each shape', () => {
    assert.match(bar, /export type BoardTool = 'pen' \| 'erase' \| 'text' \| 'shape'/);
    for (const k of ['line', 'arrow', 'rect', 'ellipse']) assert.ok(bar.includes(`${k}:`), k);
  });
  it('the screen feeds the picked kind to the canvas, only while the shape tool is on', () => {
    assert.match(wb, /shape=\{tool === 'shape' \? shapeKind : null\}/);
  });
});
