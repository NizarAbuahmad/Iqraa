// The Tools tab is one grid of lifted, coloured cards on every size, with no section headings
// (dropped on purpose on 2026-09-25).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = readFileSync(join(root, 'app', '(tabs)', 'ai-tools.tsx'), 'utf8');

test('the tools are lifted cards that give when pressed', () => {
  assert.match(src, /<PressableScale\b/, 'ToolCard is not PressableScale');
  assert.match(src, /\buseSurface\(/, 'ToolCard does not take useSurface()');
});

test('phones get the grid card too, not the old row', () => {
  assert.doesNotMatch(src, /grid=\{isDesktop\}/, 'the grid card is still desktop-only');
});

test('no section headings came back', () => {
  assert.doesNotMatch(src, /toolsBeforeClass|toolsDuringClass|toolsAfterClass/, 'the before/during/after headings were dropped on purpose');
});
