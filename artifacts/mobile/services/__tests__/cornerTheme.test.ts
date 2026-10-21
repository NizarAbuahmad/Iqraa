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

// The global palette's fixed surfaces and text, copied from constants/colors.ts
// (which cannot be imported here: it reads Appearance from react-native).
const LIGHT = { page: '#F6F5F1', card: '#FFFFFF', foreground: '#0B1B33', muted: '#5C6675' };
const DARK = { page: '#0A1628', card: '#111F36', foreground: '#E8EEF4', muted: '#9AA9BC' };
const WHITE = '#FFFFFF';
const AA = 4.5;

const atLeast = (a: string, b: string, what: string) =>
  assert.ok(contrast(a, b) >= AA, `${what}: ${a} on ${b} is ${contrast(a, b).toFixed(2)}:1, needs ${AA}`);

test('five corners, in library order', () => {
  assert.deepEqual([...CORNER_IDS], ['math', 'english', 'lab', 'quran', 'play']);
  for (const id of CORNER_IDS) assert.equal(CORNERS[id].id, id);
});

for (const id of CORNER_IDS) {
  test(`${id}: light tokens read on every surface they sit on`, () => {
    const c = CORNERS[id].light;
    atLeast(WHITE, c.hero, `${id} white on hero`);
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

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Corners wired so far. PR 2 adds 'english' and 'play' and removes this list. */
const WIRED: readonly CornerId[] = ['math', 'lab', 'quran'];

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

test('corner code reads colours inside components, never at module scope', () => {
  // A `const|let|var X = palette.y` (exported or not) at module scope runs before any provider exists and
  // stays teal whatever corner the screen is in.
  const dirs = [
    ...WIRED.map(routeDir),
    join(root, 'components', 'math'),
    join(root, 'components', 'lab'),
    join(root, 'components', 'quran'),
    join(root, 'components', 'corners'),
  ];
  for (const d of dirs) {
    if (!existsSync(d)) continue;
    for (const f of files(d)) {
      const src = readFileSync(f, 'utf8');
      assert.doesNotMatch(src, /^(?:export\s+)?(?:const|let|var) \w+ = palette\./m, `${f} reads the palette at module scope (a const, let or var, exported or not)`);
    }
  }
});

test('the library tiles take each corner its own colour', () => {
  const src = readFileSync(join(root, 'app', 'curriculum', 'resources.tsx'), 'utf8');
  assert.match(src, /from '@\/constants\/corners'/, 'resources.tsx does not import the corner table');
  for (const id of ['english', 'lab', 'math', 'quran'] as const) {
    assert.match(src, new RegExp(`cornerLook\\('${id}'\\)`), `${id} tile does not read its corner look`);
  }
  // The old identical-teal tile icon must be gone from the four corner tiles;
  // the curriculum tile and the student/parent «my exams» tile keep ACCENT on purpose.
  assert.equal((src.match(/ACCENT \+ '1F'/g) ?? []).length, 2, 'only the curriculum and my-exams tiles may keep the teal icon tint');
});
