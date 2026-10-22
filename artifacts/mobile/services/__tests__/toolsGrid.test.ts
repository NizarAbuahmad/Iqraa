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

// The app sets direction per component (LanguageContext turns OS-level RTL off), so a row
// container must flip itself. The phone grid did from 2026-10-22; the desktop grid ran
// left-to-right in Arabic, putting TAB_TOOLS[0] at the top LEFT until the same day.
test('the desktop grid reads right to left in Arabic, like the phone grid', () => {
  const style = src.match(/style=\{\[\s*styles\.list,([\s\S]*?)\]\}\s*>/);
  assert.ok(style, 'the tools grid container style was not found');
  assert.match(style[1], /styles\.listGrid\b/, 'the container no longer takes styles.listGrid');
  assert.match(
    style[1],
    /flexDirection:\s*isRTL \? 'row-reverse' : 'row'/,
    'the grid container does not flip with isRTL',
  );
  const desktop = src.match(/\blistGrid:\s*\{([^}]*)\}/);
  assert.ok(desktop, 'styles.listGrid was not found');
  assert.doesNotMatch(desktop[1], /flexDirection/, 'styles.listGrid fixes a direction of its own');
  assert.doesNotMatch(
    style[1],
    /isDesktop \? styles\.listGrid : \[/,
    'only the phone branch flips; the desktop branch is a bare styles.listGrid',
  );
});
