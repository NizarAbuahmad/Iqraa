import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Source-level guard for the 2026-10 type pass: headings are Readex Pro, and
// the scale has no half steps. Both came back once already by copy-paste from
// an old screen, and neither fails loudly — a stray Cairo key falls back to
// the system font on a device, and 12.5 just looks "almost right".

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..', '..');
const DIRS = ['app', 'components', 'constants'];

function* sources(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '__tests__') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* sources(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const all = DIRS.flatMap(d => [...sources(join(root, d))]);

test('no screen asks for a Cairo font key (only Readex Pro is loaded)', () => {
  const bad = all.filter(f => /Cairo_\d{3}/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});

test('font sizes are whole numbers', () => {
  const bad = all.filter(f => /fontSize: ?\d+\.\d/.test(readFileSync(f, 'utf8')));
  assert.deepEqual(bad, []);
});
