import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  BOARD_FILE_VERSION,
  boardFileOf,
  docOfFile,
  isBoardDirty,
  parseBoard,
  serializeBoard,
} from '../boardFile.ts';
import { buildBoardHTML } from '../boardExportHtml.ts';
import {
  CANVAS_H,
  CANVAS_W,
  MAX_TEXT_CHARS,
  STROKE_WIDTHS,
  TEXT_SIZES,
  cleanText,
  commitStrokes,
  docHasInk,
  docHasText,
  EMPTY_BOARD,
  eraseAt,
  isText,
  makeText,
  moveText,
  replaceStrokeAt,
  textAt,
  textBox,
  textDirection,
  textSizeFor,
  undoBoard,
  type BoardDoc,
  type Stroke,
} from '../whiteboardModel.ts';

/** One width unit in stored units on the board: strokeScale / canvasW = 1 / CANVAS_W. */
const UNIT = 1 / CANVAS_W;
const ink: Stroke = { color: '#DC2626', width: 6, points: '0.1,0.1 0.2,0.2' };

const docOf = (strokes: Stroke[]): BoardDoc => ({ current: 0, pages: [{ background: 'blank', board: { strokes, past: [], future: [] } }] });

describe('cleanText', () => {
  it('keeps line breaks, drops other control characters and blank space at either end', () => {
    assert.equal(cleanText('  سطر\r\nثانٍ\u0007  \n\n'), 'سطر\nثانٍ');
  });
  it('caps the length', () => {
    assert.equal(cleanText('أ'.repeat(MAX_TEXT_CHARS + 50)).length, MAX_TEXT_CHARS);
  });
  it('an only-blank text is empty', () => {
    assert.equal(cleanText(' \n\t '), '');
  });
});

describe('textDirection', () => {
  it('follows the first strong character', () => {
    assert.equal(textDirection('المعادلة 2x+5'), 'rtl');
    assert.equal(textDirection('2 + 3 = ٥ مثال'), 'rtl');
    assert.equal(textDirection('x = 4 ثم'), 'ltr');
    assert.equal(textDirection('123'), 'ltr');
  });
});

describe('textSizeFor', () => {
  it('maps each pen width to a text size, and anything else to the middle one', () => {
    STROKE_WIDTHS.forEach((w, i) => assert.equal(textSizeFor(w), TEXT_SIZES[i]));
    assert.equal(textSizeFor(7), TEXT_SIZES[1]);
  });
});

describe('makeText', () => {
  it('anchors a cleaned text at the tap point, in stored units', () => {
    const t = makeText(' مرحبا\r\n', 0.25, 0.1, '#0F766E', 40);
    assert.deepEqual(t, { color: '#0F766E', width: 40, points: '0.25,0.1', text: 'مرحبا' });
    assert.ok(t && isText(t));
  });
  it('is null for an empty text', () => {
    assert.equal(makeText('   ', 0.2, 0.2, '#000000', 40), null);
  });
  it('keeps the anchor on the page', () => {
    const t = makeText('x', -0.5, 9, '#000000', 40);
    assert.equal(t?.points, `0,${Number((CANVAS_H / CANVAS_W).toFixed(5))}`);
  });
  it('ink is not text', () => {
    assert.equal(isText(ink), false);
  });
});

describe('textBox / textAt', () => {
  const ltr = makeText('abcd', 0.5, 0.2, '#000000', 40)!;
  const rtl = makeText('أبجد', 0.5, 0.2, '#000000', 40)!;

  it('a left-to-right text grows right of its anchor, a right-to-left one left of it', () => {
    const a = textBox(ltr, UNIT);
    const b = textBox(rtl, UNIT);
    assert.equal(a.minX, 0.5);
    assert.ok(a.maxX > 0.5);
    assert.equal(b.maxX, 0.5);
    assert.ok(b.minX < 0.5);
    assert.equal(a.minY, 0.2);
    assert.ok(a.maxY > 0.2);
  });

  it('more lines make a taller box', () => {
    const one = textBox(makeText('ab', 0.1, 0.1, '#000000', 40)!, UNIT);
    const two = textBox(makeText('ab\nab', 0.1, 0.1, '#000000', 40)!, UNIT);
    assert.ok(two.maxY - two.minY > 1.9 * (one.maxY - one.minY));
  });

  it('finds the topmost text under a point and ignores ink', () => {
    const strokes = [ink, ltr, makeText('zz', 0.5, 0.2, '#000000', 40)!];
    const inside = { x: 0.5 + 5 * UNIT, y: 0.2 + 10 * UNIT };
    assert.equal(textAt(strokes, inside.x, inside.y, UNIT), 2);
    assert.equal(textAt(strokes, 0.15, 0.15, UNIT), -1);
    assert.equal(textAt([ink], 0.5, 0.2, UNIT), -1);
  });
});

describe('editing text on the board', () => {
  it('replaceStrokeAt replaces or removes one item, and an out-of-range index changes nothing', () => {
    const t = makeText('a', 0.1, 0.1, '#000000', 40)!;
    const list = [ink, t];
    const edited = makeText('b', 0.1, 0.1, '#000000', 40)!;
    assert.deepEqual(replaceStrokeAt(list, 1, edited), [ink, edited]);
    assert.deepEqual(replaceStrokeAt(list, 1, null), [ink]);
    assert.equal(replaceStrokeAt(list, 5, null), list);
  });

  it('moveText moves the anchor and keeps it on the page', () => {
    const t = makeText('a', 0.1, 0.1, '#000000', 40)!;
    assert.equal(moveText(t, 0.2, 0.05).points, '0.3,0.15');
    assert.equal(moveText(t, -1, -1).points, '0,0');
  });

  it('placing text is one undoable step', () => {
    const t = makeText('a', 0.1, 0.1, '#000000', 40)!;
    const s = commitStrokes(EMPTY_BOARD, [t]);
    assert.deepEqual(s.strokes, [t]);
    assert.deepEqual(undoBoard(s).strokes, []);
  });

  it('the eraser removes a text it touches anywhere in its box, not only at the anchor', () => {
    const t = makeText('abcdef', 0.5, 0.2, '#000000', 40)!;
    const box = textBox(t, UNIT);
    const midX = (box.minX + box.maxX) / 2;
    const midY = (box.minY + box.maxY) / 2;
    assert.deepEqual(eraseAt([ink, t], midX, midY, 16 * UNIT, UNIT), [ink]);
    const far = [ink, t];
    assert.equal(eraseAt(far, 0.9, 0.5, 16 * UNIT, UNIT), far);
  });

  it('text counts as content on the board', () => {
    const d = docOf([makeText('a', 0.1, 0.1, '#000000', 40)!]);
    assert.equal(docHasInk(d), true);
    assert.equal(docHasText(d), true);
    assert.equal(docHasText(docOf([ink])), false);
    assert.equal(isBoardDirty(d, null), true);
  });
});

describe('saving a board with text (version 3)', () => {
  const t = makeText('المساحة = ط نق²\nx = 4', 0.3, 0.2, '#0F766E', 60)!;

  it('writes version 3 only when some page has text, and round-trips it', () => {
    assert.equal(BOARD_FILE_VERSION, 3);
    assert.equal(boardFileOf(docOf([ink])).version, 1);
    assert.equal(boardFileOf(docOf([ink, t])).version, 3);
    const r = serializeBoard(docOf([ink, t]));
    assert.ok(r.ok);
    if (!r.ok) return;
    const p = parseBoard(r.json);
    assert.ok(p.ok);
    if (!p.ok) return;
    assert.deepEqual(docOfFile(p.file).pages[0]!.board.strokes, [ink, t]);
    assert.equal(isBoardDirty(docOfFile(p.file), r.json), false);
  });

  const v3 = (s: unknown) => ({ version: 3, canvas: { w: 1280, h: 720 }, pages: [{ background: 'blank', strokes: [s] }] });

  it('refuses text inside an older version', () => {
    for (const version of [1, 2]) {
      const r = parseBoard({ ...v3({ ...t }), version });
      assert.equal(r.ok, false);
      assert.equal(!r.ok && r.reason, 'text');
    }
  });

  it('refuses a bad text item', () => {
    for (const bad of [
      { ...t, text: '' },
      { ...t, text: 7 },
      { ...t, text: 'a\u0000b' },
      { ...t, text: 'ب'.repeat(MAX_TEXT_CHARS + 1) },
      { ...t, points: '0.1,0.1 0.2,0.2' },
    ]) {
      assert.equal(parseBoard(v3(bad)).ok, false, JSON.stringify(bad).slice(0, 80));
    }
  });

  it('accepts a version-3 board with no text at all', () => {
    assert.equal(parseBoard(v3({ ...ink })).ok, true);
  });
});

describe('exporting a board with text', () => {
  it('prints each line as escaped SVG text in its colour and direction', () => {
    const t = makeText('أهلاً <b>بكم</b>\nسطر', 0.5, 0.1, '#0F766E', 40)!;
    const html = buildBoardHTML(boardFileOf(docOf([t])), 'سبورة', true);
    assert.ok(html);
    assert.ok(html!.includes('&lt;b&gt;'));
    assert.ok(!html!.includes('<b>'));
    const texts = html!.match(/<text [^>]*fill="#0F766E"[^>]*>/g) ?? [];
    assert.equal(texts.length, 2);
    assert.ok(texts.every(x => x.includes('direction="rtl"') && x.includes('x="640"')));
  });

  it('draws no polyline for a text item', () => {
    const t = makeText('abc', 0.5, 0.1, '#0F766E', 40)!;
    const html = buildBoardHTML(boardFileOf(docOf([t])), 'b', false)!;
    assert.ok(!html.includes('<polyline'));
  });
});
