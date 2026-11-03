/**
 * What this guards. `PlaneGrid` imports react-native-svg and cannot load under bare `node --test`, so it is
 * checked as source. Seen on a real screen (2026-11-03): a y tick at the very top edge printed half its number
 * above the box. (Negative Arabic ticks were checked at the same time and already read «−٢» with the sign on
 * the left, in order, for «−١٠» too; the sign is not reordered in SVG text, so no override is wanted there.)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '../../components/math/PlaneGrid.tsx'), 'utf8');

test('a y tick whose number would sit above the box keeps its gridline but loses its number', () => {
  assert.match(src, /t\.value !== 0 && t\.px - 3 >= TYPE\.micro/);
  // The gridlines are drawn from the unfiltered list.
  assert.match(src, /\{ys\.map\(t => \(\s*<Line key=\{`gy\$\{t\.value\}`\}/);
});

test('the tick text keeps the sign before the digits in both languages', () => {
  // `axisLabel` builds sign + digits + degree mark in that order; the draw sites print it as is.
  assert.match(src, /return `\$\{value < 0 \? '−' : ''\}\$\{body\}\$\{degrees \? '°' : ''\}`/);
  assert.match(src, /\{axisLabel\(t\.value, lang, degreeAxis\)\}/);
  assert.match(src, /\{axisLabel\(t\.value, lang, false\)\}/);
});
