// The amber that means "now" (`palette.live`, #B45309) is only for now: «ابدأ الحصة»,
// a class happening this minute. The multiplication game (hub tile and drill) and the
// lesson "spot the term" game wore exactly that hex as their accent, so a student saw
// "now" on a game tile. These tests keep every game accent out of the amber family,
// white-text readable, and apart from its neighbours.
//
// Sibling tests: gameAccents.test.ts (white text, `Button fill`) and iconSystem.test.ts
// (the same amber rule for CONCEPTS). The data lives in .tsx files that import
// react-native, so the sources are read as text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { contrast } from '../readableColor.ts';
import { deltaE2000 } from '../colorDistance.ts';
import { CONCEPTS } from '../../constants/icons.ts';
import { CORNERS } from '../../constants/corners.ts';

const ROOT = join(import.meta.dirname, '..', '..');
const read = (...p: string[]) => readFileSync(join(ROOT, ...p), 'utf8');

const LIVE = /\blive:\s*'(#[0-9A-Fa-f]{6})'/.exec(read('constants', 'colors.ts'))?.[1]?.toUpperCase();
const WARNING = /\bwarning:\s*'(#[0-9A-Fa-f]{6})'/.exec(read('constants', 'colors.ts'))?.[1]?.toUpperCase();

const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
function hueSat(h: string): { hue: number; sat: number } {
  const [r, g, b] = hex(h).map(v => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return { hue: 0, sat: 0 };
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60; if (hue < 0) hue += 360;
  return { hue, sat: d / (1 - Math.abs(2 * l - 1)) };
}

/** Same rule as iconSystem.test.ts: hue 25°–50° at saturation > 0.6, or within ΔE2000 3 of the two oranges the app used for "attention". */
function amberProblem(color: string): string | null {
  const { hue, sat } = hueSat(color);
  if (hue >= 25 && hue <= 50 && sat > 0.6) return `${color} is in the amber hue band (${hue.toFixed(0)}°)`;
  for (const amber of ['#B54708', '#B45309']) {
    if (deltaE2000(color, amber) < 3) return `${color} is within ΔE2000 3 of the amber ${amber}`;
  }
  return null;
}

// ---------------------------------------------------------------- where the accents are

const ELEMENTS_ACCENT = /export const ELEMENTS_ACCENT\s*=\s*'(#[0-9A-Fa-f]{6})'/.exec(read('components', 'publicGames', 'ElementsGame.tsx'))?.[1];

/** One `color:` expression from a tile table, as a hex. */
function resolve(expr: string): string {
  const e = expr.trim();
  const lit = /^'(#[0-9A-Fa-f]{6})'$/.exec(e);
  if (lit) return lit[1]!.toUpperCase();
  if (e === 'ELEMENTS_ACCENT' && ELEMENTS_ACCENT) return ELEMENTS_ACCENT.toUpperCase();
  const corner = /^CORNERS\.(\w+)\.light\.primary$/.exec(e);
  if (corner && (CORNERS as Record<string, any>)[corner[1]!]) return (CORNERS as Record<string, any>)[corner[1]!].light.primary.toUpperCase();
  throw new Error(`cannot resolve the colour expression «${e}» — teach resolve() about it`);
}

/** The games hub tiles, id → accent. */
function hubAccents(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of read('app', 'play', 'index.tsx').matchAll(/\{\s*id:\s*'(\w+)'[^}]*?\bcolor:\s*([^,]+),/g)) out[m[1]!] = resolve(m[2]!);
  return out;
}

/** The lesson-game chooser's tiles, game → accent. */
function lessonAccents(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of read('app', 'play', 'lesson', '[lessonId].tsx').matchAll(/^\s*(\w+):\s*\{[^}]*?\bcolor:\s*([^,]+),/gm)) out[m[1]!] = resolve(m[2]!);
  return out;
}

/** The drill game's four operation accents. */
function drillAccents(): Record<string, string> {
  const src = read('components', 'publicGames', 'MathDrillGame.tsx');
  const table = /const ACCENTS:[^=]*=\s*\{([^}]*)\}/.exec(src)?.[1] ?? '';
  const out: Record<string, string> = {};
  for (const m of table.matchAll(/(\w+):\s*'(#[0-9A-Fa-f]{6})'/g)) out[m[1]!] = m[2]!.toUpperCase();
  return out;
}

/** Every game accent anywhere: the three tables above plus the `const ACCENT` / `accent="…"` of the single-game files. */
function allAccents(): Array<{ where: string; hex: string }> {
  const out: Array<{ where: string; hex: string }> = [];
  for (const [k, v] of Object.entries(hubAccents())) out.push({ where: `hub ${k}`, hex: v });
  for (const [k, v] of Object.entries(lessonAccents())) out.push({ where: `lesson game ${k}`, hex: v });
  for (const [k, v] of Object.entries(drillAccents())) out.push({ where: `drill ${k}`, hex: v });
  for (const parts of [
    ['components', 'publicGames', 'ColorSpotGame.tsx'], ['components', 'publicGames', 'MemoryGame.tsx'],
    ['components', 'publicGames', 'TermScrambleGame.tsx'], ['app', 'play', 'capitals.tsx'], ['app', 'play', 'flags.tsx'],
  ]) {
    const src = read(...parts);
    for (const re of [/\bACCENT\s*=\s*'(#[0-9A-Fa-f]{6})'/g, /\baccent="(#[0-9A-Fa-f]{6})"/g]) {
      for (const m of src.matchAll(re)) out.push({ where: parts.join('/'), hex: m[1]!.toUpperCase() });
    }
  }
  return out;
}

test('the accent tables are found (a renamed constant must not empty these tests)', () => {
  assert.equal(LIVE, '#B45309', 'palette.live moved: re-read this file');
  assert.equal(WARNING, '#B54708');
  assert.ok(ELEMENTS_ACCENT, 'ELEMENTS_ACCENT not found');
  assert.equal(Object.keys(hubAccents()).length, 10, 'the hub lists ten games');
  assert.deepEqual(Object.keys(lessonAccents()).sort(), ['memory', 'scramble', 'spot']);
  assert.deepEqual(Object.keys(drillAccents()).sort(), ['add', 'div', 'mul', 'sub']);
  assert.ok(allAccents().length >= 22, `found only ${allAccents().length} accents`);
});

// ---------------------------------------------------------------- not "now"

test('no game accent is palette.live, the amber that means "now"', () => {
  for (const { where, hex: h } of allAccents()) assert.notEqual(h, LIVE, `${where} is palette.live`);
});

test('no game accent is amber, or within ΔE2000 3 of palette.live / palette.warning', () => {
  for (const { where, hex: h } of allAccents()) {
    assert.equal(amberProblem(h), null, where);
    assert.ok(deltaE2000(h, LIVE!) >= 3 && deltaE2000(h, WARNING!) >= 3, `${where} ${h} sits beside an attention amber`);
  }
});

test('every game accent carries white text at 4.5:1', () => {
  for (const { where, hex: h } of allAccents()) {
    const c = contrast('#FFFFFF', h);
    assert.ok(c >= 4.5, `${where}: white on ${h} is ${c.toFixed(2)}:1`);
  }
});

// ---------------------------------------------------------------- apart from each other

const MIN_DE = 8;

// Pairs on the hub that were already closer than MIN_DE when this test was written
// (2026-10-23, measured). They are listed, not fixed, because recolouring a game nobody
// asked about is a separate decision; the list cannot rot, because each pair must still
// be under MIN_DE (fix one and this test makes you delete its line).
const KNOWN_CLOSE: Record<string, string> = {
  'capitals~elements': 'two teals, ΔE2000 3.2 — the elements game and the capitals game',
  'add~flags': 'indigo and blue, ΔE2000 7.4',
};
const pairKey = (a: string, b: string) => [a, b].sort().join('~');

test(`hub tiles are ${MIN_DE}+ ΔE2000 apart (except the pairs listed in KNOWN_CLOSE)`, () => {
  const hub = hubAccents();
  const ids = Object.keys(hub);
  const bad: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const a = ids[i]!, b = ids[j]!;
    const d = deltaE2000(hub[a]!, hub[b]!);
    if (d < MIN_DE && !KNOWN_CLOSE[pairKey(a, b)]) bad.push(`${a} ${hub[a]} ~ ${b} ${hub[b]} (ΔE2000 ${d.toFixed(1)})`);
  }
  assert.deepEqual(bad, []);
});

test('every KNOWN_CLOSE pair is still close (so the list shrinks when a pair is fixed)', () => {
  const hub = hubAccents();
  for (const key of Object.keys(KNOWN_CLOSE)) {
    const [a, b] = key.split('~') as [string, string];
    assert.ok(hub[a] && hub[b], `${key}: not a hub pair any more`);
    assert.ok(deltaE2000(hub[a]!, hub[b]!) < MIN_DE, `${key} is now ${MIN_DE}+ apart: delete it from KNOWN_CLOSE`);
  }
});

test(`the lesson-game chooser's three tiles are ${MIN_DE}+ ΔE2000 apart`, () => {
  const l = lessonAccents();
  const ids = Object.keys(l);
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const d = deltaE2000(l[ids[i]!]!, l[ids[j]!]!);
    assert.ok(d >= MIN_DE, `${ids[i]} ${l[ids[i]!]} ~ ${ids[j]} ${l[ids[j]!]} (ΔE2000 ${d.toFixed(1)})`);
  }
});

test('the drill game uses one accent per operation, each apart from the others, and the hub tile matches its game', () => {
  const d = drillAccents();
  const ops = Object.keys(d);
  for (let i = 0; i < ops.length; i++) for (let j = i + 1; j < ops.length; j++) {
    const x = deltaE2000(d[ops[i]!]!, d[ops[j]!]!);
    assert.ok(x >= MIN_DE, `${ops[i]} ~ ${ops[j]} (ΔE2000 ${x.toFixed(1)})`); // the closest pair is div~add, 9.4
  }
  const hub = hubAccents();
  assert.equal(hub.multiply, d.mul, 'the multiply tile and the multiply drill are one game, one colour');
  assert.equal(hub.divide, d.div);
  assert.equal(hub.add, d.add);
  assert.equal(hub.subtract, d.sub);
});

test('the two accents that used to be palette.live are also apart from every concept colour', () => {
  for (const [where, h] of [['hub multiply', hubAccents().multiply!], ['lesson game spot', lessonAccents().spot!]] as const) {
    for (const [id, c] of Object.entries(CONCEPTS)) {
      const d = deltaE2000(h, c.color);
      assert.ok(d >= MIN_DE, `${where} ${h} ~ concept ${id} ${c.color} (ΔE2000 ${d.toFixed(1)})`);
    }
  }
});
