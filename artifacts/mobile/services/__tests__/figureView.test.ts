/**
 * What this guards. react-native-svg cannot load under bare `node --test`, so the
 * component is checked as source: it takes colours from `useColors()` (never the
 * global palette), makes curve colours readable on the card, and names itself to
 * screen readers.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(join(here, rel), 'utf8');

test('FigureView draws from useColors, not palette, and is labelled', () => {
  const src = read('../../components/ui/FigureView.tsx');
  assert.match(src, /useColors\(\)/);
  assert.doesNotMatch(src, /import[^;]*\bpalette\b/);
  assert.match(src, /readableOn\(/);
  assert.match(src, /accessibilityLabel=\{figureAltText\(/);
  assert.match(src, /PlaneGrid/);
});

test('FigureView sizes the drawing to the inside of its border, so no edge is cropped', () => {
  const src = read('../../components/ui/FigureView.tsx');
  // The Svg and the clip are the inner box, not the measured outer width / fixed height.
  assert.match(src, /const W = Math\.max\(0, width - 2 \* BORDER\)/);
  assert.match(src, /const H = HEIGHT - 2 \* BORDER/);
  assert.match(src, /<Svg width=\{W\} height=\{H\}>/);
  assert.match(src, /<Rect x=\{0\} y=\{0\} width=\{W\} height=\{H\} \/>/);
  assert.match(src, /layoutFigure\(figure, \{ w: W, h: H \}\)/);
  assert.doesNotMatch(src, /<Svg width=\{width\}/);
  assert.match(src, /borderWidth: BORDER/);
});

test('FigureView keeps its axis names off the tick numbers and its letters inside the box', () => {
  const src = read('../../components/ui/FigureView.tsx');
  // «س» / x ends inside the box whatever the glyph's width, and only when its row is not cut by the top edge.
  assert.match(src, /origin\.y >= 14 && origin\.y <= H/);
  assert.match(src, /x=\{W - 6\} y=\{origin\.y - 5\} textAnchor="end"/);
  // «ص» / y goes left of the axis (the ticks are on the right) and is skipped where it would sit on a number.
  assert.match(src, /origin\.x - 6 : origin\.x \+ 6/);
  assert.match(src, /gridTicks\(layout\.viewport\)/);
  // Curve, vector and point letters are clamped into the box and are readable text, not just readable lines.
  // `inBox` is only the net under `placeLabel` (lib/figure), with the same bounds as its glyph box.
  assert.match(src, /Math\.min\(Math\.max\(p\.x, 2\), W - 12\), y: Math\.min\(Math\.max\(p\.y, 13\), H - 4\)/);
  assert.match(src, /inBox\(c\.labelAt\)/);
  assert.match(src, /inBox\(a\.labelAt\)/);
  assert.match(src, /inBox\(p\.labelAt\)/);
  assert.match(src, /readableOn\(c, colors\.card, 4\.5\)/);
});

test('FigureView does not stretch across a desktop screen', () => {
  const src = read('../../components/ui/FigureView.tsx');
  assert.match(src, /width: '100%', maxWidth: MAX_WIDTH, alignSelf: lang === 'ar' \? 'flex-end' : 'flex-start'/);
});

test('QuestionVisual re-validates what it is given', () => {
  const src = read('../../components/ui/QuestionVisual.tsx');
  assert.match(src, /resolveFigure\(body\['visual'\]\)/);
});

test('both exam screens draw a question’s drawing, and the take screen skips the book-figure hint for it', () => {
  const take = read('../../app/take/[code].tsx');
  const teacher = read('../../app/evaluations/[id]/index.tsx');
  assert.match(take, /<QuestionVisual body=\{body\} lang=\{lang\} \/>/);
  assert.match(teacher, /<QuestionVisual body=\{q\.body\} lang=\{lang\} \/>/);
  assert.match(take, /!question\.body\['visual'\]/);
});

test('the student lesson screen draws a card’s drawing', () => {
  const src = read('../../app/curriculum/lesson-explanation.tsx');
  assert.match(src, /import \{ FigureView \} from '@\/components\/ui\/FigureView'/);
  assert.equal((src.match(/<FigureView figure=\{c\.visual\} lang=\{lang\} \/>/g) ?? []).length, 2);
});
