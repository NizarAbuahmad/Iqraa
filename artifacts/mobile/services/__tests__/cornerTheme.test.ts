// Pins the corner identities (docs/superpowers/specs/2026-10-21-corner-identities-design.md):
// every colour pair a corner introduces is measured here, not eyeballed, and
// the structural traps (a layout that forgets the provider, a module-scope
// palette constant that ignores it) fail the build.
import { test } from 'node:test';
import assert from 'node:assert/strict';
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
