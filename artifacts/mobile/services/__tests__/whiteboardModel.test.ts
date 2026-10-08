import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  EMPTY_BOARD,
  HISTORY_LIMIT,
  canUndo,
  clearBoard,
  commitStrokes,
  eraseAt,
  hasInk,
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
