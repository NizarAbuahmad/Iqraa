import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_BACKGROUNDS,
  EMPTY_BOARD,
  HISTORY_LIMIT,
  axesGeometry,
  canUndo,
  clearBoard,
  commitStrokes,
  eraseAlong,
  eraseAt,
  gridLines,
  hasInk,
  localizeDigits,
  parsePoints,
  strokeHit,
  undoBoard,
  type BoardState,
  type Stroke,
} from '../whiteboardModel.ts';

const line = (points: string, extra: Partial<Stroke> = {}): Stroke => ({ color: '#000', points, ...extra });

describe('parsePoints', () => {
  it('reads "x,y x,y" pairs', () => {
    assert.deepEqual(parsePoints('0,0 10,5.5 -3,4'), [
      { x: 0, y: 0 },
      { x: 10, y: 5.5 },
      { x: -3, y: 4 },
    ]);
  });

  it('skips malformed pairs instead of inventing zeros', () => {
    assert.deepEqual(parsePoints(''), []);
    assert.deepEqual(parsePoints('1,2 oops 3, 4,x'), [{ x: 1, y: 2 }]);
  });
});

describe('strokeHit / eraseAt', () => {
  it('hits a stroke within radius plus half its width', () => {
    const s = line('0,0 100,0'); // default width 4 -> reach = radius + 2
    assert.equal(strokeHit(s, 50, 10, 16), true);
    assert.equal(strokeHit(s, 50, 30, 16), false);
  });

  it('measures to the segment, not just the recorded points', () => {
    // Only two points, 100px apart: the middle is 50px from either vertex but 4px from the line.
    const s = line('0,0 100,0');
    assert.equal(strokeHit(s, 50, 4, 2), true);
    assert.equal(strokeHit(s, 50, 8, 2), false);
  });

  it('honours a stroke width', () => {
    const wide = line('0,0 100,0', { width: 12 }); // reach = 2 + 6
    assert.equal(strokeHit(wide, 50, 8, 2), true);
    assert.equal(strokeHit(wide, 50, 9, 2), false);
  });

  it('treats a dot (two identical points) and a single point as zero-length', () => {
    assert.equal(strokeHit(line('10,10 10,10'), 12, 10, 2), true);
    assert.equal(strokeHit(line('10,10 10,10'), 30, 10, 2), false);
    assert.equal(strokeHit(line('10,10'), 12, 10, 2), true);
  });

  it('never hits, and never throws on, a stroke with no readable points', () => {
    assert.equal(strokeHit(line(''), 0, 0, 1000), false);
  });

  it('removes only the strokes that were hit', () => {
    const a = line('0,0 100,0');
    const b = line('0,200 100,200');
    assert.deepEqual(eraseAt([a, b], 50, 4, 2), [b]);
  });

  it('returns the same array instance when nothing was hit', () => {
    const strokes = [line('0,0 100,0')];
    assert.equal(eraseAt(strokes, 50, 90, 4), strokes);
  });

  it('defaults to a finger-sized radius', () => {
    const strokes = [line('0,0 100,0')];
    assert.deepEqual(eraseAt(strokes, 50, 15), []); // 15 <= 16 + 2
  });
});

describe('board state', () => {
  const a = line('0,0 1,1');
  const b = line('2,2 3,3');

  it('starts empty with nothing to undo', () => {
    assert.equal(hasInk(EMPTY_BOARD), false);
    assert.equal(canUndo(EMPTY_BOARD), false);
  });

  it('undoes commits in reverse order, then stops', () => {
    let s: BoardState = commitStrokes(EMPTY_BOARD, [a]);
    s = commitStrokes(s, [a, b]);
    assert.equal(hasInk(s), true);
    s = undoBoard(s);
    assert.deepEqual(s.strokes, [a]);
    s = undoBoard(s);
    assert.deepEqual(s.strokes, []);
    assert.equal(canUndo(s), false);
    assert.equal(undoBoard(s), s);
  });

  it('ignores a commit that changes nothing', () => {
    const s = commitStrokes(EMPTY_BOARD, [a]);
    assert.equal(commitStrokes(s, s.strokes), s);
  });

  it('makes clear undoable, and does nothing on an empty board', () => {
    const s = commitStrokes(EMPTY_BOARD, [a, b]);
    const cleared = clearBoard(s);
    assert.deepEqual(cleared.strokes, []);
    assert.deepEqual(undoBoard(cleared).strokes, [a, b]);
    assert.equal(clearBoard(EMPTY_BOARD), EMPTY_BOARD);
  });

  it('keeps at most HISTORY_LIMIT undo steps, dropping the oldest', () => {
    let s: BoardState = EMPTY_BOARD;
    const total = HISTORY_LIMIT + 10;
    for (let i = 1; i <= total; i++) {
      s = commitStrokes(s, Array.from({ length: i }, () => a));
    }
    assert.equal(s.strokes.length, total);
    assert.equal(s.past.length, HISTORY_LIMIT);
    for (let i = 0; i < HISTORY_LIMIT; i++) s = undoBoard(s);
    assert.equal(s.strokes.length, total - HISTORY_LIMIT);
    assert.equal(undoBoard(s), s);
  });
});

describe('gridLines', () => {
  it('draws a vertical at every step inside the width and a horizontal inside the height', () => {
    const lines = gridLines(100, 60, 20);
    const verticals = lines.filter(l => l.x1 === l.x2);
    const horizontals = lines.filter(l => l.y1 === l.y2);
    assert.deepEqual(verticals.map(l => l.x1), [20, 40, 60, 80]);
    assert.deepEqual(horizontals.map(l => l.y1), [20, 40]);
    assert.equal(lines.length, 6);
    for (const v of verticals) assert.deepEqual([v.y1, v.y2], [0, 60]);
    for (const h of horizontals) assert.deepEqual([h.x1, h.x2], [0, 100]);
  });

  it('returns nothing for a degenerate size or step', () => {
    assert.deepEqual(gridLines(0, 60, 20), []);
    assert.deepEqual(gridLines(100, 60, 0), []);
    assert.deepEqual(gridLines(100, -1, 20), []);
  });
});

describe('axesGeometry', () => {
  it('puts the axes through the centre, on a grid line', () => {
    const g = axesGeometry(200, 120, 20);
    assert.deepEqual(g.xAxis, { x1: 0, y1: 60, x2: 200, y2: 60 });
    assert.deepEqual(g.yAxis, { x1: 100, y1: 0, x2: 100, y2: 120 });
  });

  it('snaps the origin to the grid so ticks sit on grid lines', () => {
    const g = axesGeometry(230, 130, 20);
    assert.equal(g.yAxis.x1 % 20, 0);
    assert.equal(g.xAxis.y1 % 20, 0);
  });

  it('ticks every step, skips the origin and the edges, y grows upward', () => {
    const g = axesGeometry(200, 120, 20);
    assert.equal(g.ticks.length, 12);
    const xs = g.ticks.filter(t => t.axis === 'x');
    const ys = g.ticks.filter(t => t.axis === 'y');
    assert.equal(xs.length, 8);
    assert.equal(ys.length, 4);
    assert.deepEqual(xs.find(t => t.x === 120), { axis: 'x', x: 120, y: 60, value: '1' });
    assert.deepEqual(xs.find(t => t.x === 80), { axis: 'x', x: 80, y: 60, value: '-1' });
    assert.deepEqual(ys.find(t => t.y === 40), { axis: 'y', x: 100, y: 40, value: '1' });
    assert.deepEqual(ys.find(t => t.y === 80), { axis: 'y', x: 100, y: 80, value: '-1' });
    assert.equal(g.ticks.some(t => t.value === '0'), false);
  });

  it('returns no ticks for a degenerate size or step', () => {
    assert.deepEqual(axesGeometry(0, 0, 20).ticks, []);
    assert.deepEqual(axesGeometry(200, 120, 0).ticks, []);
  });
});

describe('localizeDigits / BOARD_BACKGROUNDS', () => {
  it('shows Arabic-Indic digits only for Arabic', () => {
    assert.equal(localizeDigits('-12', 'ar'), '-١٢');
    assert.equal(localizeDigits('-12', 'en'), '-12');
  });

  it('offers blank, grid and axes in that order', () => {
    assert.deepEqual([...BOARD_BACKGROUNDS], ['blank', 'grid', 'axes']);
  });
});

describe('eraseAlong', () => {
  const wall = line('100,0 100,100'); // a vertical stroke at x = 100

  it('catches a stroke that lies between two far-apart pointer samples', () => {
    // Neither end point is within reach of the stroke...
    assert.equal(eraseAt([wall], 0, 50, 16).length, 1);
    assert.equal(eraseAt([wall], 200, 50, 16).length, 1);
    // ...but the sweep between them crosses it.
    assert.deepEqual(eraseAlong([wall], 0, 50, 200, 50, 16), []);
  });

  it('returns the same array when the sweep touches nothing', () => {
    const strokes = [wall];
    assert.equal(eraseAlong(strokes, 0, 300, 200, 300, 16), strokes);
  });

  it('still tests the end point when the pointer has not moved', () => {
    assert.deepEqual(eraseAlong([wall], 100, 50, 100, 50, 16), []);
  });

  it('removes only the strokes the sweep crosses', () => {
    const far = line('0,300 50,300');
    assert.deepEqual(eraseAlong([wall, far], 0, 50, 200, 50, 16), [far]);
  });
});
