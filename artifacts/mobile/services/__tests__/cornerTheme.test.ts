// Pins the corner identities (docs/superpowers/specs/2026-10-21-corner-identities-design.md):
// every colour pair a corner introduces is measured here, not eyeballed, and
// the structural traps (a layout that forgets the provider, a module-scope
// palette constant that ignores it) fail the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CORNERS, CORNER_IDS, type CornerId } from '../../constants/corners.ts';
import { contrast } from '../readableColor.ts';
import { bandGradient } from '../band.ts';

// The global palette's fixed surfaces and text, copied from constants/colors.ts
// (which cannot be imported here: it reads Appearance from react-native).
const LIGHT = { page: '#F6F5F1', card: '#FFFFFF', foreground: '#0B1B33', muted: '#5C6675' };
const DARK = { page: '#0A1628', card: '#111F36', foreground: '#E8EEF4', muted: '#9AA9BC' };
const WHITE = '#FFFFFF';
const AA = 4.5;

const atLeast = (a: string, b: string, what: string) =>
  assert.ok(contrast(a, b) >= AA, `${what}: ${a} on ${b} is ${contrast(a, b).toFixed(2)}:1, needs ${AA}`);

/** `fg` at `alpha` over the opaque hex `bg`, as a hex: what the eye sees of a translucent label. */
const blendWhite = (alpha: number, bg: string) => {
  const n = parseInt(bg.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(255 * alpha + c * (1 - alpha)));
  return '#' + ch.map((c) => c.toString(16).padStart(2, '0')).join('').toUpperCase();
};

test('five corners, in library order', () => {
  assert.deepEqual([...CORNER_IDS], ['math', 'english', 'lab', 'quran', 'play']);
  for (const id of CORNER_IDS) assert.equal(CORNERS[id].id, id);
});

for (const id of CORNER_IDS) {
  test(`${id}: light tokens read on every surface they sit on`, () => {
    const c = CORNERS[id].light;
    atLeast(WHITE, c.hero, `${id} white on hero`);
    // CornerFrame draws its subtitle as rgba(255,255,255,0.85) on the hero.
    atLeast(blendWhite(0.85, c.hero), c.hero, `${id} band subtitle on hero`);
    atLeast(c.primaryForeground, c.primary, `${id} button label`);
    atLeast(c.primary, LIGHT.card, `${id} primary on card`);
    atLeast(c.primary, LIGHT.page, `${id} primary on page`);
    atLeast(c.primary, c.secondary, `${id} icon on its tint`);
    atLeast(c.secondaryForeground, c.secondary, `${id} secondary label`);
    atLeast(c.primary, c.selected, `${id} primary on selected`);
    atLeast(LIGHT.muted, c.selected, `${id} muted caption on selected`);
    atLeast(LIGHT.foreground, c.selected, `${id} text on selected`);
    assert.equal(c.tint, c.primary);
  });

  test(`${id}: dark tokens read on every surface they sit on`, () => {
    const c = CORNERS[id].dark;
    atLeast(WHITE, c.hero, `${id} white on dark hero`);
    atLeast(blendWhite(0.85, c.hero), c.hero, `${id} band subtitle on dark hero`);
    atLeast(c.primaryForeground, c.primary, `${id} dark button label`);
    atLeast(c.primary, DARK.card, `${id} dark primary on card`);
    atLeast(c.primary, DARK.page, `${id} dark primary on page`);
    atLeast(c.primary, c.secondary, `${id} dark icon on its tint`);
    atLeast(c.secondaryForeground, c.secondary, `${id} dark secondary label`);
    atLeast(c.primary, c.selected, `${id} dark primary on selected`);
    atLeast(DARK.muted, c.selected, `${id} dark muted caption on selected`);
    atLeast(DARK.foreground, c.selected, `${id} dark text on selected`);
    assert.equal(c.tint, c.primary);
  });
}

test('motif opacity stays subtle enough for the band text', () => {
  for (const id of CORNER_IDS) {
    const { motifOpacity } = CORNERS[id];
    assert.ok(motifOpacity > 0 && motifOpacity <= 0.14, `${id} motifOpacity ${motifOpacity}`);
  }
});

// palette.hero, copied from constants/colors.ts (which cannot be imported here).
// Measured at 0.95, the library header's meta line; a brand band drawing 0.85 white would be 4.42:1 in dark mode — measure it here before adding one.
const BRAND_HERO = { light: '#006D65', dark: '#0F766E' };

test('band text reads on both stops of every band gradient', () => {
  // [name, hero, alpha of the white subtitle drawn on the band]
  const heroes: [string, string, number][] = [
    ...CORNER_IDS.flatMap((id): [string, string, number][] => [
      [`${id} light`, CORNERS[id].light.hero, 0.85],
      [`${id} dark`, CORNERS[id].dark.hero, 0.85],
    ]),
    ['brand light', BRAND_HERO.light, 0.95],
    ['brand dark', BRAND_HERO.dark, 0.95],
  ];
  for (const [what, hero, alpha] of heroes) {
    for (const stop of bandGradient(hero)) {
      atLeast(WHITE, stop, `${what} band title`);
      atLeast(blendWhite(alpha, stop), stop, `${what} band subtitle at ${alpha}`);
    }
  }
});

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Every corner is wired. */
const WIRED: readonly CornerId[] = CORNER_IDS;

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* files(p);
    else if (p.endsWith('.ts') || p.endsWith('.tsx')) yield p;
  }
}

const routeDir = (id: CornerId) => join(root, 'app', ...CORNERS[id].route.split('/').filter(Boolean));

test('each wired corner has a layout that mounts its own provider', () => {
  for (const id of WIRED) {
    const layout = join(routeDir(id), '_layout.tsx');
    assert.ok(existsSync(layout), `${id}: ${layout} missing`);
    const src = readFileSync(layout, 'utf8');
    assert.match(src, new RegExp(`<CornerThemeProvider corner="${id}"`), `${id}: layout does not mount CornerThemeProvider for ${id}`);
  }
});

test('no layout outside a corner directory mounts a provider — the library stays teal', () => {
  const cornerDirs = new Set(CORNER_IDS.map(routeDir));
  for (const f of files(join(root, 'app'))) {
    if (!f.endsWith('_layout.tsx')) continue;
    const src = readFileSync(f, 'utf8');
    if (!src.includes('CornerThemeProvider')) continue;
    assert.ok(cornerDirs.has(dirname(f)), `${f} mounts CornerThemeProvider but is not a corner directory`);
  }
});

test('corner code never imports the global palette', () => {
  // `palette` is the fixed global colours: it ignores the corner provider whether it is read at module scope
  // or inside render, so it stays teal in every corner. Colours come from useColors() (or `scheme` for the mode).
  const dirs = [
    ...WIRED.map(routeDir),
    join(root, 'components', 'math'),
    join(root, 'components', 'lab'),
    join(root, 'components', 'quran'),
    join(root, 'components', 'englishHub'),
    join(root, 'components', 'publicGames'),
    join(root, 'components', 'corners'),
  ];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of files(d)) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(
        src,
        /import[^;]*\bpalette\b[^;]*from\s*['"]@\/constants\/colors['"]/,
        `${f} imports the global palette, which ignores the corner provider (at module scope or inside render); take colours from useColors()`,
      );
    }
  }
});

test('the library tiles take each corner its own colour and pattern', () => {
  const src = readFileSync(join(root, 'app', 'curriculum', 'resources.tsx'), 'utf8');
  assert.match(src, /from '@\/constants\/corners'/, 'resources.tsx does not import the corner table');
  assert.match(src, /<LibraryTile\b/, 'the front-row tiles are not LibraryTile');
  assert.match(src, /cornerLook\(id\)/, 'cornerTile does not read the corner look');
  assert.match(src, /CORNERS\[id\]\.motif\b/, 'cornerTile does not take the corner motif');
  for (const id of ['english', 'lab', 'math', 'quran'] as const) {
    assert.match(src, new RegExp(`cornerTile\\('${id}'\\)`), `${id} tile does not wear its corner`);
  }
  // The flat teal icon tint is gone: the curriculum and «my exams» tiles wear the brand look (BRAND_TILE).
  assert.equal((src.match(/ACCENT \+ '1F'/g) ?? []).length, 0, 'a tile still uses the old flat teal icon tint');
  assert.match(src, /<Band\b/, 'the library header is not a Band');
});

test('text on a primary fill in the English corner is primaryForeground, not white', () => {
  // In dark mode a corner's primary is a light 300-level shade with navy text on it;
  // white there is ~1.9:1 on English's #FDBA74.
  const dirs = [routeDir('english'), join(root, 'components', 'englishHub')];
  for (const d of dirs) {
    for (const f of files(d)) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /primaryText:\s*\{[^}]*color:\s*'#fff'/, `${f}: primaryText is white; use colors.primaryForeground`);
      assert.doesNotMatch(src, /color:\s*on\s*\?\s*'#fff'/, `${f}: a selected chip's text is white; use colors.primaryForeground`);
      // The hub screen's band legitimately draws white icons on the hero, so only the components are held to this.
      if (f.startsWith(join(root, 'components', 'englishHub'))) {
        assert.doesNotMatch(src, /color=(?:"#fff"|\{\s*'#fff'\s*\})/, `${f}: an icon is white; on a primary fill use colors.primaryForeground`);
      }
    }
  }
});

test('the corner frame draws its band with Band, and the grid brings cards in with Entrance', () => {
  const frame = readFileSync(join(root, 'components', 'corners', 'CornerFrame.tsx'), 'utf8');
  assert.match(frame, /<Band\b/, 'CornerFrame does not draw its band with Band');
  const grid = readFileSync(join(root, 'components', 'corners', 'CornerGrid.tsx'), 'utf8');
  assert.match(grid, /<Entrance\b/, 'CornerGrid does not wrap its cells in Entrance');
});

test('every corner hub card is a lifted surface that gives when pressed', () => {
  for (const id of CORNER_IDS) {
    const src = readFileSync(join(routeDir(id), 'index.tsx'), 'utf8');
    assert.match(src, /<PressableScale\b/, `${id} hub cards are not PressableScale`);
    assert.match(src, /\buseSurface\(/, `${id} hub cards do not take useSurface()`);
  }
});
