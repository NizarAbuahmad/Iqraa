// A ratchet on the design scales in constants/theme.ts.
//
// On 2026-10-09 the app had 324 font sizes, 336 corner radii and 1,371
// padding/margin/gap values outside those scales, picked screen by screen.
// Moving them all at once would be a thousand-line diff nobody can review, so
// this only stops the count from growing: a new screen that uses the scale
// passes, one that invents a 19px font fails. When you move a screen onto the
// scale, lower the ceiling to the new count so it cannot creep back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RADIUS, SPACE, TYPE } from '../../constants/theme.ts';

const CEILING = { fontSize: 324, borderRadius: 336, spacing: 1371 };

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function* tsx(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (name !== 'dev') yield* tsx(p);
    } else if (name.endsWith('.tsx')) yield p;
  }
}

const sources = ['app', 'components'].flatMap(d => [...tsx(join(root, d))]).map(f => readFileSync(f, 'utf8'));

const typeSteps = new Set<number>(Object.values(TYPE));
const radiusSteps = new Set<number>([0, ...Object.values(RADIUS)]);
const spaceSteps = new Set<number>([0, ...Object.values(SPACE)]);

function offScale(re: RegExp, steps: Set<number>): number {
  let n = 0;
  for (const s of sources) {
    for (const m of s.matchAll(re)) {
      const v = Math.abs(Number(m[1] ?? m[2]));
      if (!steps.has(v)) n++;
    }
  }
  return n;
}

test('font sizes off the type scale do not grow', () => {
  const n = offScale(/fontSize: ?(\d+)\b/g, typeSteps);
  assert.ok(n <= CEILING.fontSize, `${n} font sizes are off TYPE in constants/theme.ts (ceiling ${CEILING.fontSize}) — use a TYPE step`);
});

test('corner radii off the radius scale do not grow', () => {
  const n = offScale(/borderRadius: ?(\d+)\b/g, radiusSteps);
  assert.ok(n <= CEILING.borderRadius, `${n} radii are off RADIUS in constants/theme.ts (ceiling ${CEILING.borderRadius}) — use a RADIUS step`);
});

test('spacing off the 4-point scale does not grow', () => {
  const n = offScale(/\b(?:padding|margin)(?:Horizontal|Vertical|Top|Bottom|Left|Right|Start|End)?: ?(-?\d+)\b|\bgap: ?(\d+)\b/g, spaceSteps);
  assert.ok(n <= CEILING.spacing, `${n} spacing values are off SPACE in constants/theme.ts (ceiling ${CEILING.spacing}) — use a SPACE step`);
});
