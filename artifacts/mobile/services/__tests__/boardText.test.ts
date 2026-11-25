/**
 * Typed text on the whiteboard: the model (add / edit / remove, one undo history with the
 * strokes), the saved file (version 3, written only for a board that has text, validated
 * because it is untrusted) and the printed page. Written before the screen that uses them.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CANVAS_H,
  CANVAS_W,
  EMPTY_BOARD,
  EMPTY_DOC,
  HISTORY_LIMIT,
  MAX_TEXTS_PER_PAGE,
  MAX_TEXT_CHARS,
  MAX_TEXT_LINES,
  STROKE_WIDTHS,
  TEXT_SIZES,
  addText,
  canRedo,
  canUndo,
  cleanText,
  clearBoard,
  commitStrokes,
  currentPage,
  docHasInk,
  docHasText,
  editText,
  hasInk,
  makeText,
  redoBoard,
  removeText,
  textIsRtl,
  textSizeFor,
  undoBoard,
  updateCurrent,
  type BoardDoc,
  type BoardState,
  type Stroke,
  type TextItem,
} from '../whiteboardModel.ts';
import {
  BOARD_FILE_VERSION,
  boardFileOf,
  boardFileVersionOf,
  docOfFile,
  isBoardDirty,
  parseBoard,
  serializeBoard,
} from '../boardFile.ts';
import { buildBoardHTML } from '../boardExportHtml.ts';
import translations from '../i18n.ts';
import { BOARD_PEN_COLORS } from '../penColors.ts';
import { trackWhiteboardText } from '../classUsage.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...parts: string[]) => readFileSync(join(here, '..', '..', ...parts), 'utf8');

const RED = '#DC2626';
const stroke = (points = '0.1,0.1 0.2,0.2'): Stroke => ({ color: '#000', width: 6, points });
const item = (text = 'x = 4', extra: Partial<TextItem> = {}): TextItem => ({ x: 100, y: 80, size: 56, color: RED, rtl: false, text, ...extra });
const withText = (...items: TextItem[]): BoardDoc =>
  updateCurrent(EMPTY_DOC, p => ({ ...p, board: items.reduce<BoardState>((b, t) => addText(b, t), p.board) }));

describe('text direction', () => {
  it('reads the first letter of either script, ignoring digits and punctuation before it', () => {
    assert.equal(textIsRtl('حل المعادلة'), true);
    assert.equal(textIsRtl('Solve it'), false);
    assert.equal(textIsRtl('12 + 3 = 15 ثم'), true);
    assert.equal(textIsRtl('(x) س'), false);
    assert.equal(textIsRtl('123'), false);
    assert.equal(textIsRtl(''), false);
  });
});

describe('cleanText', () => {
  it('unifies line endings, trims the ends of lines and the blank lines around, keeps blank lines inside', () => {
    assert.equal(cleanText('\r\n  a  \r\n\r\nb \n\n'), '  a\n\nb');
    assert.equal(cleanText('   \n  '), '');
    assert.equal(cleanText(''), '');
  });
  it('drops control and bidi-override characters but keeps newlines', () => {
    assert.equal(cleanText('a\u0000b\u0007c‮d⁦e\nf'), 'abcde\nf');
  });
  it('caps the lines and the characters', () => {
    const many = Array.from({ length: MAX_TEXT_LINES + 5 }, (_, i) => `line ${i}`).join('\n');
    assert.equal(cleanText(many).split('\n').length, MAX_TEXT_LINES);
    assert.equal(cleanText('x'.repeat(MAX_TEXT_CHARS + 50)).length, MAX_TEXT_CHARS);
  });
});

describe('makeText and sizes', () => {
  it('makes an item from the spot, the colour and the size, reading the direction from the words', () => {
    const t = makeText(10.123, 20.987, 'مرحبا', RED, 56)!;
    assert.deepEqual(t, { x: 10.1, y: 21, size: 56, color: RED, rtl: true, text: 'مرحبا' });
    assert.equal(makeText(1, 1, 'hi', RED, 56)!.rtl, false);
  });
  it('is null for empty text and clamps the spot onto the page', () => {
    assert.equal(makeText(5, 5, '  \n ', RED, 56), null);
    const t = makeText(-50, 9999, 'a', RED, 56)!;
    assert.deepEqual([t.x, t.y], [0, CANVAS_H]);
    assert.equal(makeText(Number.NaN, 5, 'a', RED, 56)!.x, 0);
    assert.equal(makeText(CANVAS_W + 10, 5, 'a', RED, 56)!.x, CANVAS_W);
  });
  it('ties the three text sizes to the three line widths, in order', () => {
    assert.equal(TEXT_SIZES.length, STROKE_WIDTHS.length);
    STROKE_WIDTHS.forEach((w, i) => assert.equal(textSizeFor(w), TEXT_SIZES[i]));
    assert.equal(textSizeFor(7), TEXT_SIZES[1], 'a width that is not one of the three gets the middle size');
    assert.ok(TEXT_SIZES[0] < TEXT_SIZES[1] && TEXT_SIZES[1] < TEXT_SIZES[2]);
  });
});

describe('texts on the board', () => {
  it('counts as something on the page, so clear, leave and export see it', () => {
    const b = addText(EMPTY_BOARD, item());
    assert.equal(hasInk(b), true);
    assert.equal(hasInk(EMPTY_BOARD), false);
    assert.equal(docHasInk(withText(item())), true);
    assert.equal(docHasText(withText(item())), true);
    assert.equal(docHasText(EMPTY_DOC), false);
  });

  it('adds, edits and removes, each as one undo step', () => {
    let b = addText(EMPTY_BOARD, item('one'));
    b = addText(b, item('two'));
    assert.deepEqual(b.texts.map(t => t.text), ['one', 'two']);
    b = editText(b, 0, 'uno');
    assert.deepEqual(b.texts.map(t => t.text), ['uno', 'two']);
    b = removeText(b, 1);
    assert.deepEqual(b.texts.map(t => t.text), ['uno']);
    b = undoBoard(b);
    assert.deepEqual(b.texts.map(t => t.text), ['uno', 'two']);
    b = undoBoard(b);
    assert.deepEqual(b.texts.map(t => t.text), ['one', 'two']);
    b = redoBoard(b);
    assert.deepEqual(b.texts.map(t => t.text), ['uno', 'two']);
  });

  it('editing keeps the place, colour and size, and re-reads the direction from the new words', () => {
    const b = editText(addText(EMPTY_BOARD, item('abc', { x: 300, y: 40, size: 84, color: '#2563EB' })), 0, 'أ ب ج');
    assert.deepEqual(b.texts[0], { x: 300, y: 40, size: 84, color: '#2563EB', rtl: true, text: 'أ ب ج' });
  });

  it('editing to empty removes the text; to the same words, or a bad index, changes nothing', () => {
    const b = addText(EMPTY_BOARD, item('keep'));
    assert.equal(editText(b, 0, 'keep'), b);
    assert.equal(editText(b, 0, 'keep  \n'), b, 'cleaning gives the same words');
    assert.equal(editText(b, 0, '  keep').texts[0]!.text, '  keep', 'leading spaces are kept: they are indentation');
    assert.equal(editText(b, 5, 'x'), b);
    assert.equal(removeText(b, 5), b);
    assert.deepEqual(editText(b, 0, '  ').texts, []);
  });

  it('keeps one history for strokes and texts together', () => {
    let b = commitStrokes(EMPTY_BOARD, [stroke()]);
    b = addText(b, item('label'));
    assert.equal(b.strokes.length, 1);
    assert.equal(b.texts.length, 1);
    b = undoBoard(b);
    assert.equal(b.strokes.length, 1, 'undo took the text, not the stroke');
    assert.equal(b.texts.length, 0);
    b = undoBoard(b);
    assert.equal(b.strokes.length, 0);
    b = redoBoard(redoBoard(b));
    assert.deepEqual([b.strokes.length, b.texts.length], [1, 1]);
  });

  it('a stroke drawn after an undo drops the redo list, and keeps the texts', () => {
    let b = addText(EMPTY_BOARD, item('stay'));
    b = commitStrokes(b, [stroke()]);
    b = undoBoard(b);
    assert.equal(canRedo(b), true);
    b = commitStrokes(b, [stroke('0.3,0.3 0.4,0.4')]);
    assert.equal(canRedo(b), false);
    assert.deepEqual(b.texts.map(t => t.text), ['stay']);
  });

  it('clear wipes strokes and texts as one undoable step', () => {
    const b = addText(commitStrokes(EMPTY_BOARD, [stroke()]), item());
    const cleared = clearBoard(b);
    assert.deepEqual([cleared.strokes.length, cleared.texts.length], [0, 0]);
    assert.equal(clearBoard(cleared), cleared);
    const back = undoBoard(cleared);
    assert.deepEqual([back.strokes.length, back.texts.length], [1, 1]);
    assert.equal(canUndo(cleared), true);
  });

  it('a board of only text can be cleared', () => {
    const cleared = clearBoard(addText(EMPTY_BOARD, item()));
    assert.equal(cleared.texts.length, 0);
  });

  it('refuses a text past MAX_TEXTS_PER_PAGE, giving the same state back', () => {
    let b: BoardState = EMPTY_BOARD;
    for (let i = 0; i < MAX_TEXTS_PER_PAGE; i++) b = addText(b, item(`t${i}`));
    assert.equal(b.texts.length, MAX_TEXTS_PER_PAGE);
    assert.equal(addText(b, item('one too many')), b);
  });

  it('bounds the history as before when texts fill it', () => {
    let b: BoardState = EMPTY_BOARD;
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) b = editText(addText(b, item('a')), b.texts.length, `b${i}`);
    assert.ok(b.past.length <= HISTORY_LIMIT);
  });
});

describe('the saved file', () => {
  const versionOf = (doc: BoardDoc) => boardFileOf(doc).version;

  it('is version 3 only for a board with text, and the lowest version otherwise', () => {
    assert.equal(versionOf(EMPTY_DOC), 1);
    assert.equal(versionOf(withText(item())), 3);
    assert.equal(boardFileVersionOf(withText(item())), 3);
    assert.equal(BOARD_FILE_VERSION, 3);
  });

  it('round-trips texts onto the right page, in order, with every field', () => {
    let doc = withText(item('first'), item('الثاني', { x: 900, y: 300, size: 84, color: '#15803D', rtl: true }));
    doc = { ...doc, pages: [...doc.pages, { background: 'grid', board: addText(EMPTY_BOARD, item('page two')) }], current: 0 };
    const out = serializeBoard(doc);
    assert.ok(out.ok);
    if (!out.ok) return;
    const back = parseBoard(out.json);
    assert.ok(back.ok);
    if (!back.ok) return;
    assert.equal(back.file.version, 3);
    assert.deepEqual(back.file.pages[0]!.texts, doc.pages[0]!.board.texts);
    assert.deepEqual(back.file.pages[1]!.texts!.map(t => t.text), ['page two']);
    const again = docOfFile(back.file);
    assert.deepEqual(again.pages[0]!.board.texts, doc.pages[0]!.board.texts);
    assert.equal(again.pages[0]!.board.past.length, 0);
    assert.equal(serializeBoard(again).ok && (serializeBoard(again) as { json: string }).json, out.json, 'equal boards serialise to equal strings');
  });

  it('writes no texts key on a page without text', () => {
    const doc = withText(item());
    const withBlank = { ...doc, pages: [...doc.pages, { background: 'blank' as const, board: EMPTY_BOARD }] };
    const out = serializeBoard(withBlank);
    assert.ok(out.ok);
    if (!out.ok) return;
    const pages = (JSON.parse(out.json) as { pages: Record<string, unknown>[] }).pages;
    assert.ok('texts' in pages[0]!);
    assert.ok(!('texts' in pages[1]!));
  });

  it('keeps a solution and text together on one board (version 3 holds both)', () => {
    const solved = updateCurrent(withText(item()), p => ({
      ...p,
      solution: {
        problem: 'حل المعادلة 2x+5=13', steps: ['2x + 5 = 13', '2x = 8', 'x = 4'], answer: 'x = 4',
        verified: true, source: 'sympy', understoodAs: '2x+5=13',
      },
    }));
    const out = serializeBoard(solved);
    assert.ok(out.ok);
    if (!out.ok) return;
    const back = parseBoard(out.json);
    assert.ok(back.ok);
    if (!back.ok) return;
    assert.ok(back.file.pages[0]!.solution);
    assert.equal(back.file.pages[0]!.texts!.length, 1);
  });

  it('counts as unsaved work until it is saved, and again after an edit', () => {
    const doc = withText(item('a'));
    assert.equal(isBoardDirty(doc, null), true);
    const saved = serializeBoard(doc);
    assert.ok(saved.ok);
    if (!saved.ok) return;
    assert.equal(isBoardDirty(doc, saved.json), false);
    const edited = updateCurrent(doc, p => ({ ...p, board: editText(p.board, 0, 'b') }));
    assert.equal(isBoardDirty(edited, saved.json), true);
  });

  const base = () => JSON.parse((serializeBoard(withText(item())) as { json: string }).json) as {
    version: number;
    pages: { texts: Record<string, unknown>[] }[];
  };
  const refuses = (mutate: (b: ReturnType<typeof base>) => void, why: string) => {
    const b = base();
    mutate(b);
    const r = parseBoard(JSON.stringify(b));
    assert.equal(r.ok, false, why);
  };

  it('refuses a malformed text, whole', () => {
    refuses(b => { b.pages[0]!.texts[0]!.text = ''; }, 'empty text');
    refuses(b => { b.pages[0]!.texts[0]!.text = 5; }, 'text that is not a string');
    refuses(b => { b.pages[0]!.texts[0]!.text = 'x'.repeat(MAX_TEXT_CHARS + 1); }, 'too long');
    refuses(b => { b.pages[0]!.texts[0]!.text = Array.from({ length: MAX_TEXT_LINES + 1 }, () => 'a').join('\n'); }, 'too many lines');
    refuses(b => { b.pages[0]!.texts[0]!.text = 'a\u0000b'; }, 'a control character');
    refuses(b => { b.pages[0]!.texts[0]!.text = 'a‮b'; }, 'a bidi override');
    refuses(b => { b.pages[0]!.texts[0]!.x = -1; }, 'x off the page');
    refuses(b => { b.pages[0]!.texts[0]!.x = CANVAS_W + 1; }, 'x past the page');
    refuses(b => { b.pages[0]!.texts[0]!.y = CANVAS_H + 1; }, 'y past the page');
    refuses(b => { b.pages[0]!.texts[0]!.x = Number.POSITIVE_INFINITY as never; }, 'x not finite (JSON turns it to null)');
    refuses(b => { b.pages[0]!.texts[0]!.size = 2; }, 'size too small');
    refuses(b => { b.pages[0]!.texts[0]!.size = 500; }, 'size too big');
    refuses(b => { b.pages[0]!.texts[0]!.color = 'red'; }, 'a colour name');
    refuses(b => { b.pages[0]!.texts[0]!.color = '#fff" onload="x'; }, 'a colour that breaks out of an attribute');
    refuses(b => { b.pages[0]!.texts[0]!.rtl = 'yes'; }, 'rtl not a boolean');
    refuses(b => { b.pages[0]!.texts = [null as never]; }, 'an item that is not an object');
    refuses(b => { (b.pages[0]! as { texts: unknown }).texts = 'x'; }, 'texts not a list');
    refuses(b => { b.pages[0]!.texts = Array.from({ length: MAX_TEXTS_PER_PAGE + 1 }, () => b.pages[0]!.texts[0]!); }, 'too many texts on a page');
  });

  it('refuses text in a file that is not version 3', () => {
    refuses(b => { b.version = 2; }, 'texts in a version 2 file');
    refuses(b => { b.version = 1; }, 'texts in a version 1 file');
  });

  it('drops keys it does not know, rebuilding the item field by field', () => {
    const b = base();
    (b.pages[0]!.texts[0]! as Record<string, unknown>).onclick = 'evil()';
    const r = parseBoard(JSON.stringify(b));
    assert.ok(r.ok);
    if (!r.ok) return;
    assert.deepEqual(Object.keys(r.file.pages[0]!.texts![0]!).sort(), ['color', 'rtl', 'size', 'text', 'x', 'y']);
  });

  it('accepts a version 3 file that has no texts on any page', () => {
    const b = base();
    delete (b.pages[0] as Record<string, unknown>).texts;
    assert.ok(parseBoard(JSON.stringify(b)).ok);
  });

  it('counts text toward the size cap: text alone cannot reach it, but it can tip a board that is nearly full', () => {
    // 20 pages x 100 texts x 400 characters is 800,000: well under the 2,000,000 cap on its own.
    assert.ok(20 * MAX_TEXTS_PER_PAGE * MAX_TEXT_CHARS < 2_000_000);
    const points = Array.from({ length: 50_000 }, () => '1,1').join(' '); // 199,999 characters: just under a stroke's limit
    const heavy = { color: '#000', width: 6, points };
    const strokes = Array.from({ length: 10 }, () => heavy); // 1,999,990 characters of ink
    const full = { version: 3, canvas: { w: CANVAS_W, h: CANVAS_H }, pages: [{ background: 'blank', strokes }] };
    assert.equal(parseBoard(full).ok, true, 'the ink alone fits');
    const text = { x: 1, y: 1, size: 56, color: '#000', rtl: false, text: 'x'.repeat(MAX_TEXT_CHARS) };
    const tipped = { ...full, pages: [{ background: 'blank', strokes, texts: [text] }] };
    assert.deepEqual(parseBoard(tipped), { ok: false, reason: 'too-big' });
  });
});

describe('the printed page', () => {
  const html = (doc: BoardDoc, isAr = false) => buildBoardHTML(boardFileOf(doc), 'Board', isAr)!;

  it('prints every line of a text as its own SVG line, after the strokes, at its place and size', () => {
    const doc = updateCurrent(withText(item('one\ntwo', { x: 120, y: 200, size: 56, color: '#2563EB' })), p => ({ ...p, board: commitStrokes(p.board, [stroke()]) }));
    const out = html(doc);
    assert.ok(out.includes('>one</text>') && out.includes('>two</text>'));
    assert.match(out, /<text x="120" y="256" font-size="56" fill="#2563EB" direction="ltr" text-anchor="start"[^>]*>one<\/text>/);
    // The second line is one line-height lower.
    assert.match(out, /<text x="120" y="328\.8" [^>]*>two<\/text>/);
    assert.ok(out.indexOf('<polyline') < out.indexOf('>one</text>'), 'text is drawn over the ink');
  });

  it('hangs an Arabic text from its right edge: direction rtl, anchored at its start (which is the right)', () => {
    const out = html(withText(item('مرحبا', { x: 900, y: 100, rtl: true })), true);
    assert.match(out, /<text x="900" y="156" font-size="56" fill="#DC2626" direction="rtl" text-anchor="start"/);
    assert.ok(out.includes('مرحبا'));
    // `end` would flip it: in a right-to-left line the end is the LEFT edge.
    assert.doesNotMatch(out, /text-anchor="end"/);
  });

  it('escapes what was typed', () => {
    const out = html(withText(item('<b>&"x"</b>')));
    assert.ok(!out.includes('<b>&"x"</b>'));
    assert.ok(out.includes('&lt;b&gt;&amp;'));
  });

  it('prints a board of only text, and refuses a text file that is invalid', () => {
    assert.ok(html(withText(item())).includes('x = 4'));
    const bad = JSON.parse((serializeBoard(withText(item())) as { json: string }).json) as { pages: { texts: { color: string }[] }[] };
    bad.pages[0]!.texts[0]!.color = 'red';
    assert.equal(buildBoardHTML(bad, 'Board', false), null);
  });

  it('prints nothing extra for a page without text', () => {
    assert.ok(!html(EMPTY_DOC).includes('<text x='));
    assert.ok(currentPage(EMPTY_DOC).board.texts.length === 0);
  });
});

describe('the screen', () => {
  const screen = read('app', 'ai-tools', 'whiteboard.tsx');
  const dialog = read('components', 'classroom', 'TextDialog.tsx');
  const layer = read('components', 'classroom', 'TextLayer.tsx');
  const toolbar = read('components', 'classroom', 'BoardToolbar.tsx');

  it('puts the text layer over the pen, and turns the pen off while the text tool is on', () => {
    assert.ok(screen.indexOf('<PenCanvas') < screen.indexOf('<TextLayer'), 'text is drawn over the ink');
    assert.match(screen, /active=\{!loading && tool !== 'text'\}/);
    assert.match(screen, /erase=\{tool === 'erase'\}/);
  });

  it('records a saved board under the lowest file version, not the newest', () => {
    assert.match(screen, /boardFileVersionOf\(docRef\.current\)/);
    assert.doesNotMatch(screen, /BOARD_FILE_VERSION/, 'a solution-only board must still be saved as version 2');
  });

  it('blocks leaving and Escape while the text dialog is open, like the other dialogs', () => {
    assert.match(screen, /askTextRef\.current/);
    assert.equal((screen.match(/askTextRef\.current/g) ?? []).length >= 3, true);
  });

  it('wraps the dialog body in a KeyboardSafeView, because a Modal is its own window', () => {
    assert.match(dialog, /<KeyboardSafeView>/);
    assert.match(dialog, /multiline/);
  });

  it('draws one single-line Text per line, clipped at the page edge, hung from the start edge', () => {
    assert.match(layer, /numberOfLines=\{1\}/);
    assert.match(layer, /ellipsizeMode="clip"/);
    assert.match(layer, /t\.rtl\s*\?\s*\{ right:/);
    assert.match(layer, /textAlign: t\.rtl \? 'right' : 'left'/);
    assert.doesNotMatch(layer, /\bpalette\b/);
  });

  it('lets touches through to the pen when neither text nor erase is on', () => {
    assert.match(layer, /pointerEvents=\{active \? 'box-none' : 'none'\}/);
  });

  it('gives the toolbar a three-way tool and a label for the text tool and each size', () => {
    assert.match(toolbar, /export type BoardTool = 'pen' \| 'erase' \| 'text'/);
    assert.match(toolbar, /labels\.text\b/);
    assert.match(toolbar, /tool === 'text' \? labels\.textSizes\[i\] : labels\.widths\[i\]/);
    assert.match(screen, /textSizes: \[t\('boardTextSmall'\), t\('boardTextMedium'\), t\('boardTextLarge'\)\]/);
  });

  it('never sends what was typed to analytics', () => {
    const sends = [...screen.matchAll(/trackWhiteboardText\(([^;]*)\);/g)].map(m => m[1]!);
    assert.equal(sends.length, 1);
    assert.doesNotMatch(sends[0]!, /\.text\b|raw|title/);
    assert.doesNotThrow(() => trackWhiteboardText({ size: 'small', rtl: false }));
  });
});

describe('the words', () => {
  const keys = [
    'boardTextTool', 'boardTextSmall', 'boardTextMedium', 'boardTextLarge', 'boardTextAddTitle', 'boardTextEditTitle',
    'boardTextField', 'boardTextPlaceholder', 'boardTextAdd', 'boardTextRemove', 'boardTextTooManyLines', 'boardTextFull',
    'whatsNewBoardTextTitle', 'whatsNewBoardTextBody',
  ] as const;

  it('exist in both languages, and the three sizes are told apart', () => {
    for (const lang of ['ar', 'en'] as const) {
      const table = translations[lang] as unknown as Record<string, string>;
      for (const k of keys) assert.ok(table[k] && table[k]!.length > 0, `${lang}: ${k}`);
      assert.equal(new Set([table.boardTextSmall, table.boardTextMedium, table.boardTextLarge]).size, 3, `${lang}: sizes`);
    }
  });

  it('says the number of lines that are kept, and it is the real limit', () => {
    for (const lang of ['ar', 'en'] as const) {
      const table = translations[lang] as unknown as Record<string, string>;
      assert.ok(table.boardTextTooManyLines!.includes(String(MAX_TEXT_LINES)), lang);
    }
  });

  it('offers the text a colour from the board palette, and the three sizes the three line widths', () => {
    assert.ok(BOARD_PEN_COLORS.length >= 3);
    assert.equal(TEXT_SIZES.length, 3);
  });
});
