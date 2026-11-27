/**
 * One board page as a picture to send. The SVG builder shares its drawing with the PDF
 * (`pageInnerSVG`), so a page looks the same either way; these tests pin what is specific to
 * the single-page picture: white ground, the right page, and the refusals.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildBoardPageSVG } from '../boardExportHtml.ts';
import { shapePoints } from '../boardShapes.ts';

const here = dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => readFileSync(join(here, '..', '..', ...p), 'utf8');

const LABELS = { ai: 'AI written', verified: 'verified', unchecked: 'unchecked', understoodAs: 'read as' };
const board = {
  version: 3,
  canvas: { w: 1280, h: 720 },
  pages: [
    { background: 'grid', strokes: [{ color: '#DC2626', width: 6, points: shapePoints('rect', { x: 0.1, y: 0.1 }, { x: 0.3, y: 0.2 }) }], texts: [{ x: 600, y: 100, size: 56, color: '#2563EB', rtl: false, text: 'page one' }] },
    { background: 'blank', strokes: [], texts: [{ x: 600, y: 100, size: 56, color: '#2563EB', rtl: false, text: 'page two' }] },
  ],
};

describe('buildBoardPageSVG', () => {
  it('draws the asked page on a white ground, standalone', () => {
    const svg = buildBoardPageSVG(board, 1, false)!;
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg" width="1280" height="720"/);
    assert.match(svg, /<rect width="1280" height="720" fill="#FFFFFF"\/>/);
    assert.match(svg, /font-family="Almarai[^"]*sans-serif"/, 'a picture has no page CSS, so it names its own font');
    assert.match(svg, /page two/);
    assert.doesNotMatch(svg, /page one/);
  });

  it('page one carries its ink and its paper', () => {
    const svg = buildBoardPageSVG(board, 0, false)!;
    assert.match(svg, /<polyline /);
    assert.match(svg, /<line /);
    assert.match(svg, /page one/);
  });

  it('refuses a page that is not there, and content that is not a board', () => {
    assert.equal(buildBoardPageSVG(board, 2, false), null);
    assert.equal(buildBoardPageSVG(board, -1, false), null);
    assert.equal(buildBoardPageSVG({ nope: 1 }, 0, false), null);
  });

  it('never draws a solution without its honesty labels', () => {
    const withSolution = { ...board, version: 3, pages: [{ ...board.pages[0], solution: { problem: '2x=4', steps: ['x = 2'], answer: 'x = 2', verified: true, source: 'sympy', understoodAs: '2x=4' } }] };
    assert.equal(buildBoardPageSVG(withSolution, 0, false), null);
    const ok = buildBoardPageSVG(withSolution, 0, false, LABELS)!;
    assert.match(ok, /AI written/);
  });
});

describe('the whiteboard offers the picture on the web only', () => {
  const wb = read('app', 'ai-tools', 'whiteboard.tsx');
  const bar = read('components', 'classroom', 'BoardToolbar.tsx');
  it('the toolbar shows the button only when the screen gives it a handler', () => {
    assert.match(bar, /onShareImage\?: \(\) => void/);
    assert.match(bar, /onShareImage \? \(/);
  });
  it('the screen builds the current page and hands it to the image helper', () => {
    assert.match(wb, /buildBoardPageSVG\(boardFileOf\(docRef\.current\), docRef\.current\.current/);
    assert.match(wb, /shareSvgAsImage\(/);
    assert.match(wb, /onShareImage=\{Platform\.OS === 'web' \? onShareImage : undefined\}/);
  });
});
