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
