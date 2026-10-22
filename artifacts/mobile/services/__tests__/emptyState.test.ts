// The empty state is one shared card; School's hand-drawn ones moved onto it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p: string[]) => readFileSync(join(root, ...p), 'utf8');

test('EmptyState is a lifted surface with its icon on a tinted circle', () => {
  const src = read('components', 'ui', 'EmptyState.tsx');
  assert.match(src, /\buseSurface\(/, 'EmptyState is not a surface');
  assert.match(src, /colors\.secondary/, 'the icon does not sit on the secondary tint');
});

test('School draws its empty homework and empty timetable with EmptyState', () => {
  const src = read('app', '(tabs)', 'school.tsx');
  assert.equal((src.match(/<EmptyState\b/g) ?? []).length, 2, 'school.tsx should use EmptyState for both empty sections');
  assert.doesNotMatch(src, /styles\.emptyIcon/, 'school.tsx still draws its own empty icon');
});
