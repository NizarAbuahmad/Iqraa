import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_BACKGROUNDS,
  BOARD_DEFAULT_WIDTH,
  CANVAS_H,
  CANVAS_W,
  EMPTY_BOARD,
  EMPTY_DOC,
  HISTORY_LIMIT,
  MAX_PAGES,
  STROKE_WIDTHS,
  addPage,
  axesGeometry,
  canUndo,
  clearBoard,
  commitStrokes,
  currentPage,
  docHasInk,
  eraseAlong,
  eraseAt,
  fitCanvas,
  goToPage,
  gridLines,
  hasInk,
  localizeDigits,
  parsePoints,
  removePage,
  strokeHit,
  undoBoard,
  updateCurrent,
  type BoardDoc,
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

  it('rejects a point just outside the stroke\'s reach and accepts one just inside, repeatably', () => {
    const s = line('0,0 100,0'); // default width 4, radius 10 -> reach 12
    for (let pass = 0; pass < 2; pass++) {
      assert.equal(strokeHit(s, 111, 0, 10), true);
      assert.equal(strokeHit(s, 113, 0, 10), false);
    }
  });

  it('measures a diagonal stroke by its line, not its bounding box', () => {
    const s = line('0,0 100,100'); // reach = 1 + 2
    assert.equal(strokeHit(s, 50, 50, 1), true);
    assert.equal(strokeHit(s, 50, 62, 1), false); // inside the box, ~8.5 from the line
  });

  it('pins the bounding-box early-out on all four sides', () => {
    const s = line('50,50 150,150'); // default width 4, radius 10 -> reach 12; box edges at 50 and 150
    // min-X: left of the first point, on its row (distance to the vertex is 50 - x)
    assert.equal(strokeHit(s, 39, 50, 10), true); // 11 <= 12
    assert.equal(strokeHit(s, 37, 50, 10), false); // 13 > 12
    // min-Y: above the first point
    assert.equal(strokeHit(s, 50, 39, 10), true);
    assert.equal(strokeHit(s, 50, 37, 10), false);
    // max-Y: below the last point (150,150)
    assert.equal(strokeHit(s, 150, 161, 10), true);
    assert.equal(strokeHit(s, 150, 163, 10), false);
    // max-X: right of the last point
    assert.equal(strokeHit(s, 161, 150, 10), true);
    assert.equal(strokeHit(s, 163, 150, 10), false);
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
    assert.equal(localizeDigits('0123456789', 'ar'), '٠١٢٣٤٥٦٧٨٩');
  });

  it('defaults the board to a width the toolbar actually offers', () => {
    assert.ok(STROKE_WIDTHS.includes(BOARD_DEFAULT_WIDTH));
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

  it('samples densely enough to catch a thin stroke between far-apart samples', () => {
    const thin = line('25,0 25,100', { width: 3 }); // reach = 16 + 1.5
    assert.equal(eraseAt([thin], 0, 50, 16).length, 1);
    assert.equal(eraseAt([thin], 100, 50, 16).length, 1);
    // A 2-sample sweep (ends only) would miss it; the half-radius steps do not.
    assert.deepEqual(eraseAlong([thin], 0, 50, 100, 50, 16), []);
  });

  it('removes only the strokes the sweep crosses', () => {
    const far = line('0,300 50,300');
    assert.deepEqual(eraseAlong([wall, far], 0, 50, 200, 50, 16), [far]);
  });
});

describe('strokes stored as fractions of the canvas width (unit = 1 / canvas width)', () => {
  // A 800px-wide canvas: one pixel is 1/800 of a stored unit. The stroke runs
  // across at y = 0.25 (200px) and is drawn 4px wide (the default).
  const unit = 1 / 800;
  const across = line('0.1,0.25 0.9,0.25');

  it('counts the stroke width in PIXELS: reach = 16px eraser + 2px half-width = 18px = 0.0225', () => {
    assert.equal(strokeHit(across, 0.5, 0.272, 16 * unit, unit), true); //  17.6px away
    assert.equal(strokeHit(across, 0.5, 0.273, 16 * unit, unit), false); // 18.4px away
  });

  it('a thicker stroke is easier to hit, in pixels too', () => {
    const thick = line('0.1,0.25 0.9,0.25', { width: 12 }); // reach = 16 + 6 = 22px = 0.0275
    assert.equal(strokeHit(thick, 0.5, 0.277, 16 * unit, unit), true);
    assert.equal(strokeHit(thick, 0.5, 0.278, 16 * unit, unit), false);
  });

  it('keeps the pixel meaning when no unit is given', () => {
    // Same numbers as the first test but interpreted as pixels: nothing like 0.0225 away.
    assert.equal(strokeHit(line('0,0 100,0'), 50, 17, 16), true); // 17 <= 16 + 2
    assert.equal(strokeHit(line('0,0 100,0'), 50, 19, 16), false);
  });

  it('eraseAt removes only what the eraser reaches and returns the same array on a miss', () => {
    const strokes = [across];
    assert.deepEqual(eraseAt(strokes, 0.5, 0.272, 16 * unit, unit), []);
    assert.equal(eraseAt(strokes, 0.5, 0.5, 16 * unit, unit), strokes);
  });

  it('eraseAlong still sweeps in these units (the step floor is one pixel, not one whole unit)', () => {
    const wall = line('0.5,0.4 0.5,0.6');
    // The pointer jumps from x = 0.1 to x = 0.9 in one event: neither end is near the wall.
    assert.equal(eraseAt([wall], 0.1, 0.5, 16 * unit, unit).length, 1);
    assert.equal(eraseAt([wall], 0.9, 0.5, 16 * unit, unit).length, 1);
    assert.deepEqual(eraseAlong([wall], 0.1, 0.5, 0.9, 0.5, 16 * unit, unit), []);
  });
});

describe('fitCanvas', () => {
  it('is the identity on an area that is exactly the reference size', () => {
    assert.deepEqual(fitCanvas(1280, 720), { scale: 1, width: 1280, height: 720, offsetX: 0, offsetY: 0 });
  });

  it('letterboxes a wide area at the sides, keeping the scale limited by the height', () => {
    assert.deepEqual(fitCanvas(2560, 720), { scale: 1, width: 1280, height: 720, offsetX: 640, offsetY: 0 });
  });

  it('letterboxes a tall area above and below, keeping the scale limited by the width', () => {
    assert.deepEqual(fitCanvas(640, 1000), { scale: 0.5, width: 640, height: 360, offsetX: 0, offsetY: 320 });
  });

  it('always yields a 16:9 stage that fits inside the area', () => {
    for (const [w, h] of [[390, 844], [844, 390], [1920, 1080], [1000, 1000], [300, 50]] as const) {
      const s = fitCanvas(w, h);
      assert.ok(Math.abs(s.width / s.height - CANVAS_W / CANVAS_H) < 1e-9, `${w}x${h}`);
      assert.ok(s.width <= w + 1e-9 && s.height <= h + 1e-9, `${w}x${h}`);
      assert.ok(Math.abs(s.offsetX * 2 + s.width - w) < 1e-9, `${w}x${h} centred horizontally`);
      assert.ok(Math.abs(s.offsetY * 2 + s.height - h) < 1e-9, `${w}x${h} centred vertically`);
    }
  });

  it('returns an empty stage for an area with no size yet', () => {
    const empty = { scale: 0, width: 0, height: 0, offsetX: 0, offsetY: 0 };
    assert.deepEqual(fitCanvas(0, 720), empty);
    assert.deepEqual(fitCanvas(1280, 0), empty);
    assert.deepEqual(fitCanvas(-5, 100), empty);
    assert.deepEqual(fitCanvas(Number.NaN, 100), empty);
  });
});

describe('pages', () => {
  const stroke = line('0,0 10,10');
  const draw = (doc: BoardDoc): BoardDoc =>
    updateCurrent(doc, p => ({ ...p, board: commitStrokes(p.board, [...p.board.strokes, stroke]) }));
  const paper = (doc: BoardDoc, background: 'blank' | 'grid' | 'axes'): BoardDoc =>
    updateCurrent(doc, p => ({ ...p, background }));
  /** Three pages with distinct papers [blank, grid, axes] and no ink; `current` selects one of them. */
  const threePages = (current: number): BoardDoc => {
    let d = paper(EMPTY_DOC, 'blank');
    d = paper(addPage(d), 'grid');
    d = paper(addPage(d), 'axes');
    return goToPage(d, current);
  };

  it('starts as one blank page', () => {
    assert.equal(EMPTY_DOC.pages.length, 1);
    assert.equal(EMPTY_DOC.current, 0);
    assert.equal(currentPage(EMPTY_DOC).background, 'blank');
    assert.equal(docHasInk(EMPTY_DOC), false);
  });

  it('adds a page right after the current one, selects it, and inherits the paper but not the ink', () => {
    let d = draw(paper(EMPTY_DOC, 'axes'));
    d = addPage(goToPage(addPage(d), 0)); // pages: [axes+ink, new, new]  → current is index 1
    assert.equal(d.pages.length, 3);
    assert.equal(d.current, 1);
    assert.equal(currentPage(d).background, 'axes');
    assert.equal(hasInk(currentPage(d).board), false);
    assert.equal(hasInk(d.pages[0]!.board), true);
  });

  it('refuses to grow past MAX_PAGES, returning the same document', () => {
    let d = EMPTY_DOC;
    for (let i = 1; i < MAX_PAGES; i++) d = addPage(d);
    assert.equal(d.pages.length, MAX_PAGES);
    assert.equal(addPage(d), d);
  });

  it('removes the current page and keeps pointing at a real page', () => {
    // [blank, grid, axes], current 2 → remove the last page: current moves back to 1.
    let d = removePage(threePages(2));
    assert.deepEqual(d.pages.map(p => p.background), ['blank', 'grid']);
    assert.equal(d.current, 1);
    // current 1 → remove it: the next page slides in and stays selected.
    d = removePage(threePages(1));
    assert.deepEqual(d.pages.map(p => p.background), ['blank', 'axes']);
    assert.equal(currentPage(d).background, 'axes');
  });

  it('keeps the same page selected when an earlier page is removed', () => {
    // [blank, grid, axes], current 1 (grid); remove index 0 (< current) → [grid, axes], current 0.
    const d = removePage(threePages(1), 0);
    assert.deepEqual(d.pages.map(p => p.background), ['grid', 'axes']);
    assert.equal(currentPage(d).background, 'grid');
    assert.equal(d.current, 0);
  });

  it('inserts the new page right after the current one, not at the end', () => {
    // [blank, grid, axes], current 0 → [blank, new blank, grid, axes], current 1.
    const d = addPage(threePages(0));
    assert.deepEqual(d.pages.map(p => p.background), ['blank', 'blank', 'grid', 'axes']);
    assert.equal(d.current, 1);
  });

  it('never removes the last page, and ignores a bad index', () => {
    assert.equal(removePage(EMPTY_DOC), EMPTY_DOC);
    const d = threePages(0);
    assert.equal(removePage(d, 9), d);
    assert.equal(removePage(d, -1), d);
    assert.equal(removePage(d, 1.5), d);
  });

  it('goToPage clamps, and returns the same document when nothing changes', () => {
    const d = threePages(0);
    assert.equal(goToPage(d, 99).current, 2);
    assert.equal(goToPage(d, -5).current, 0);
    assert.equal(goToPage(d, 0), d);
    assert.equal(goToPage(d, Number.NaN), d);
  });

  it('updateCurrent edits only the current page, and is a no-op when the page is unchanged', () => {
    const d = threePages(1);
    assert.equal(updateCurrent(d, p => p), d);
    const e = draw(d);
    assert.equal(hasInk(e.pages[1]!.board), true);
    assert.equal(hasInk(e.pages[0]!.board), false);
    assert.equal(hasInk(e.pages[2]!.board), false);
  });

  it('sees ink on any page, not just the current one', () => {
    const d = goToPage(draw(addPage(EMPTY_DOC)), 0); // ink on page 1, viewing page 0
    assert.equal(hasInk(currentPage(d).board), false);
    assert.equal(docHasInk(d), true);
  });

  it('keeps undo history per page', () => {
    let d = draw(EMPTY_DOC);                    // page 0: one stroke, one undo step
    d = addPage(d);                              // page 1, current
    assert.equal(canUndo(currentPage(d).board), false);
    d = goToPage(d, 0);
    assert.equal(canUndo(currentPage(d).board), true);
    d = updateCurrent(d, p => ({ ...p, board: undoBoard(p.board) }));
    assert.equal(hasInk(currentPage(d).board), false);
  });
});
