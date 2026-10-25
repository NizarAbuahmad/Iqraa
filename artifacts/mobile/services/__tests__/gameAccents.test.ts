// A game's accent fills its header and its buttons, in light and dark mode
// alike. The play-again button once kept Button's own label colour (navy in dark
// mode) over the accent: 2.2–4.3:1 on every game. So a coloured button takes
// `fill`, which picks its label with textOn, and every accent must carry white
// text (the header's title and score are white) at 4.5:1.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { contrast, textOn } from '../readableColor.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const SOURCES = [
  ['components', 'publicGames', 'ColorSpotGame.tsx'],
  ['components', 'publicGames', 'ElementsGame.tsx'],
  ['components', 'publicGames', 'MathDrillGame.tsx'],
  ['components', 'publicGames', 'MemoryGame.tsx'],
  ['components', 'publicGames', 'TermScrambleGame.tsx'],
  ['app', 'play', 'capitals.tsx'],
  ['app', 'play', 'flags.tsx'],
  ['app', 'play', 'index.tsx'],
  ['app', 'play', 'lesson', '[lessonId].tsx'],
];

/** Every hex a game declares as its accent or its hub tile colour. */
function accents(): Array<{ file: string; hex: string }> {
  const out: Array<{ file: string; hex: string }> = [];
  for (const parts of SOURCES) {
    const src = read(...parts);
    const file = parts.join('/');
    const patterns = [
      /ACCENT\s*=\s*'(#[0-9A-Fa-f]{6})'/g, // const ACCENT = '#…'
      /accent="(#[0-9A-Fa-f]{6})"/g, // accent="#…"
      /\b(?:mul|div|add|sub):\s*'(#[0-9A-Fa-f]{6})'/g, // the drill's ACCENTS table
      /\bcolor:\s*'(#[0-9A-Fa-f]{6})'/g, // hub and lesson-game tiles
    ];
    for (const re of patterns) for (const m of src.matchAll(re)) out.push({ file, hex: m[1]! });
  }
  return out;
}

test('the accent list is found (a renamed constant must not empty this test)', () => {
  assert.ok(accents().length >= 15, `found only ${accents().length} accents`);
});

test('every game accent carries white text at 4.5:1', () => {
  for (const { file, hex } of accents()) {
    const c = contrast('#FFFFFF', hex);
    assert.ok(c >= 4.5, `${file}: white on ${hex} is ${c.toFixed(2)}:1`);
  }
});

test('textOn picks a readable label on every accent', () => {
  for (const { file, hex } of accents()) {
    const c = contrast(textOn(hex), hex);
    assert.ok(c >= 4.5, `${file}: ${textOn(hex)} on ${hex} is ${c.toFixed(2)}:1`);
  }
});

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.tsx') ? [p] : [];
  });
}

test('a coloured Button takes `fill`, never a backgroundColor style', () => {
  for (const dir of ['app', 'components']) {
    for (const f of walk(join(ROOT, dir))) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(/<Button\b[\s\S]*?\/>/g)) {
        assert.doesNotMatch(m[0], /backgroundColor/, `${f}: ${m[0]} sets its fill by style, so its label keeps the wrong colour; use fill=`);
      }
    }
  }
});

test('the game buttons are filled with the accent', () => {
  assert.match(read('components', 'publicGames', 'GameShell.tsx'), /<Button\b[\s\S]*?fill=\{accent\}[\s\S]*?\/>/);
  assert.match(read('components', 'publicGames', 'MathDrillGame.tsx'), /<Button\b[\s\S]*?fill=\{ACCENT\}[\s\S]*?\/>/);
  assert.match(read('components', 'ui', 'Button.tsx'), /textOn\(fill\)/);
});
