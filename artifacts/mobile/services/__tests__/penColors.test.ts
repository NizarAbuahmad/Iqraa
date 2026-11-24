/**
 * The pen colours (services/penColors.ts). The slide and book-page pens stay at three; the
 * board adds four. Ink has to read on the board's white paper and the colours have to be
 * told apart on a projector, so the palette is held to numbers rather than to taste.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { BOARD_PEN_COLORS, BOARD_PEN_LABEL_KEYS, PEN_COLORS } from '../penColors.ts';
import { contrast } from '../readableColor.ts';
import { deltaE2000 } from '../colorDistance.ts';
import { parseBoard, serializeBoard } from '../boardFile.ts';
import { EMPTY_DOC, commitStrokes, updateCurrent } from '../whiteboardModel.ts';
import translations from '../i18n.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');

describe('pen colours', () => {
  it('keeps the slide and book-page pen at three, and the board pen starts with the same three', () => {
    assert.equal(PEN_COLORS.length, 3);
    assert.deepEqual(BOARD_PEN_COLORS.slice(0, 3), PEN_COLORS);
    assert.equal(BOARD_PEN_COLORS.length, 7);
  });

  it('has no repeated colour', () => {
    assert.equal(new Set(BOARD_PEN_COLORS.map(c => c.toUpperCase())).size, BOARD_PEN_COLORS.length);
  });

  it('shows on the board\'s white paper: at least 3:1 for a drawn line', () => {
    for (const c of BOARD_PEN_COLORS) assert.ok(contrast('#FFFFFF', c) >= 3, `${c} is ${contrast('#FFFFFF', c).toFixed(2)}:1 on white`);
  });

  it('keeps every pair at least ΔE2000 10 apart, so neighbours are told apart on a projector', () => {
    const close: string[] = [];
    for (let i = 0; i < BOARD_PEN_COLORS.length; i++) for (let j = i + 1; j < BOARD_PEN_COLORS.length; j++) {
      const d = deltaE2000(BOARD_PEN_COLORS[i]!, BOARD_PEN_COLORS[j]!);
      if (d < 10) close.push(`${BOARD_PEN_COLORS[i]} ~ ${BOARD_PEN_COLORS[j]} (${d.toFixed(1)})`);
    }
    assert.deepEqual(close, []);
  });

  it('names every board colour, in both languages, in the same order', () => {
    assert.equal(BOARD_PEN_LABEL_KEYS.length, BOARD_PEN_COLORS.length);
    for (const lang of ['ar', 'en'] as const) {
      const names = BOARD_PEN_LABEL_KEYS.map(k => (translations[lang] as unknown as Record<string, string>)[k]);
      for (const [i, n] of names.entries()) assert.ok(n && n.length > 0, `${lang}: ${BOARD_PEN_LABEL_KEYS[i]} has no text`);
      assert.equal(new Set(names).size, names.length, `${lang}: two colours share a name`);
    }
  });

  it('is saved and reopened: a board drawn in a new colour round-trips', () => {
    const colour = BOARD_PEN_COLORS[6]!;
    const doc = updateCurrent(EMPTY_DOC, p => ({ ...p, board: commitStrokes(p.board, [{ color: colour, width: 6, points: '0.1,0.1 0.2,0.2' }]) }));
    const out = serializeBoard(doc);
    assert.ok(out.ok);
    const back = parseBoard((out as { ok: true; json: string }).json);
    assert.ok(back.ok);
    assert.equal((back as { ok: true; file: { pages: { strokes: { color: string }[] }[] } }).file.pages[0]!.strokes[0]!.color, colour);
  });
});

describe('the screens use the right palette', () => {
  it('the board toolbar draws the board palette, the slide pen palette the three', () => {
    assert.match(read('components/classroom/BoardToolbar.tsx'), /BOARD_PEN_COLORS\.map/);
    assert.match(read('components/classroom/PenLayer.tsx'), /PEN_COLORS\.map/);
    assert.doesNotMatch(read('components/classroom/PenLayer.tsx'), /BOARD_PEN_COLORS/);
  });

  it('the board screen labels one swatch per colour from the same list', () => {
    const src = read('app/ai-tools/whiteboard.tsx');
    assert.match(src, /BOARD_PEN_LABEL_KEYS\.map/);
    assert.doesNotMatch(src, /t\('penRed'\)/);
  });
});
