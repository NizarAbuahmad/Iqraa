// Desktop Today was the one screen the design refresh never reached: a navy
// band for every lesson, bordered grey cards, and five prep rows in one teal.
// "Nothing changed" — so these pin what it looks like now.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PREP_ROWS } from '../lessonBoard.ts';
import { contrast } from '../readableColor.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');
const workspace = read('app', '(tabs)', 'index.tsx');
const phone = read('components', 'today', 'PhoneToday.tsx');

test('each prep row has its own hue, and white reads on it', () => {
  const hues = PREP_ROWS.map(r => r.color);
  assert.equal(new Set(hues).size, hues.length, `two rows share a hue: ${hues.join(' ')}`);
  for (const r of PREP_ROWS) {
    assert.ok(contrast('#FFFFFF', r.color) >= 4.5, `${r.type}: white on ${r.color} is ${contrast('#FFFFFF', r.color).toFixed(2)}:1`);
  }
});

test('the board draws each row in its own hue', () => {
  const board = read('components', 'ui', 'LessonPrepBoard.tsx');
  assert.match(board, /row\.done \? row\.color : row\.color \+/);
});

test('Today wears the lesson subject on both sizes', () => {
  for (const src of [workspace, phone]) {
    assert.match(src, /subjectTheme\(today\.active\?\.subjectId\)/);
    assert.match(src, /<Band\b[^>]*color=\{hero\}/);
  }
  assert.doesNotMatch(workspace, /bandGlow/, 'the hand-built navy glows are gone; the band is a Band');
});

test('desktop Today is built from the shared pieces', () => {
  assert.match(workspace, /const surface = useSurface\(\)/);
  assert.match(workspace, /style=\{\[s\.card, surface\]\}/);
  assert.match(workspace, /style=\{\[s\.side, surface\]\}/);
  assert.match(workspace, /<PressableScale[\s\S]*?style=\{\[s\.tool, surface\]\}/);
  assert.match(workspace, /subjectChipColor\(group\.subjectId, colors\.card\)/, 'class chips take their subject colour');
  for (const name of ['card', 'tool', 'side']) {
    const m = workspace.match(new RegExp(`\\n  ${name}: \\{[\\s\\S]*?\\n?\\s*\\},`));
    assert.ok(m, `style ${name} not found`);
    assert.doesNotMatch(m[0], /borderWidth/, `${name} keeps a borderWidth; a surface draws its own edge`);
  }
});
