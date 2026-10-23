// Iqraa's own icons (constants/glyphs.ts), approved 2026-10-23 from the review
// sheet (sixteen), and the tab bar's four the same day. These pin the drawings to the approved style and make sure each one is
// actually drawn where its concept appears, rather than sitting in a table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GLYPHS, GLYPH_STROKE, GLYPH_VIEWBOX, cutPath, type GlyphDef, type GlyphId } from '../../constants/glyphs.ts';
import { CONCEPTS, conceptOf, type ConceptId } from '../../constants/icons.ts';
import { CORNERS } from '../../constants/corners.ts';
import { ALL_TOOLS } from '../toolCatalog.ts';
import { PREP_ROWS } from '../lessonBoard.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ids = Object.keys(GLYPHS) as GlyphId[];
const def = (id: GlyphId): GlyphDef => GLYPHS[id];

test('the set is the twenty that were approved', () => {
  assert.deepEqual([...ids].sort(), [
    'activity', 'ask', 'challenge', 'classes', 'english', 'evaluations', 'games', 'homework', 'lab',
    'lesson-plan', 'library', 'math', 'messages', 'profile', 'quiz', 'quran', 'slides', 'today', 'tools', 'worksheet',
  ]);
  assert.equal(GLYPH_VIEWBOX, 24);
  assert.equal(GLYPH_STROKE, 1.75);
});

test('every drawing is two-tone: an outline and one tinted shape', () => {
  for (const id of ids) {
    const roles = def(id).parts.map(p => p.role ?? 'line');
    assert.ok(roles.some(r => r === 'tinted' || r === 'tint'), `${id} has no tinted shape`);
    assert.ok(roles.some(r => r === 'line' || r === 'tinted'), `${id} has no outline`);
  }
});

test('every drawing is on the 24 grid: shapes inside the box, no path number past 24', () => {
  for (const id of ids) {
    for (const p of def(id).parts) {
      if (p.el === 'rect') {
        assert.ok(p.x >= 0 && p.y >= 0 && p.x + p.width <= 24 && p.y + p.height <= 24, `${id}: rect leaves the box`);
      } else if (p.el === 'circle') {
        assert.ok(p.cx - p.r >= 0 && p.cy - p.r >= 0 && p.cx + p.r <= 24 && p.cy + p.r <= 24, `${id}: circle leaves the box`);
      } else {
        for (const n of p.d.match(/-?\d*\.?\d+/g) ?? []) assert.ok(Math.abs(Number(n)) <= 24, `${id}: ${n} in «${p.d}»`);
      }
    }
  }
});

test('a cut is declared once and used', () => {
  for (const id of ids) {
    const d = def(id);
    const marked = d.parts.filter(p => p.cut).length;
    if (d.cut) assert.ok(marked > 0, `${id} declares a cut no part uses`);
    else assert.equal(marked, 0, `${id} marks parts to cut but declares no cut`);
    // Glyph draws the cut parts first, so they must already come first, or the layers reorder.
    const firstUncut = d.parts.findIndex(p => !p.cut);
    if (firstUncut >= 0) assert.ok(d.parts.slice(firstUncut).every(p => !p.cut), `${id}: a cut part comes after an uncut one`);
  }
  // The box, then the disc, under evenodd: everything but the disc survives.
  assert.equal(cutPath({ cx: 16.5, cy: 16.5, r: 4.7 }), 'M0 0H24V24H0Z M11.8 16.5a4.7 4.7 0 1 0 9.4 0a4.7 4.7 0 1 0 -9.4 0Z');
});

test('the drawn tools and prep rows carry their drawing', () => {
  // The tools the approved set drew, by catalog id; every other tool keeps its stock glyph.
  const drawn: Record<string, GlyphId> = {
    slides: 'slides', 'lesson-plan': 'lesson-plan', worksheet: 'worksheet', quiz: 'quiz',
    activity: 'activity', game: 'challenge', games: 'games', evaluations: 'evaluations', homework: 'homework',
  };
  for (const tool of ALL_TOOLS) assert.equal(tool.glyph, drawn[tool.id], `${tool.id}: drawing`);
  for (const row of PREP_ROWS) assert.equal(row.glyph, row.type, `prep row ${row.type}: drawing`);
  for (const id of Object.keys(CONCEPTS) as ConceptId[]) {
    const g = conceptOf(id).glyph;
    if (g) assert.ok(GLYPHS[g], `${id} names a drawing that does not exist: ${g}`);
  }
});

test('every corner has a drawing', () => {
  for (const corner of Object.values(CORNERS)) assert.ok(GLYPHS[corner.drawing], `${corner.id}: no drawing ${corner.drawing}`);
});

function* tsx(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* tsx(p);
    else if (name.endsWith('.tsx')) yield p;
  }
}
const files = ['app', 'components'].flatMap(d => [...tsx(join(root, d))]).map(f => ({ rel: relative(root, f), src: readFileSync(f, 'utf8') }));

/** Drawn and approved, but held back with the reason — each must stay unused, so the list cannot rot. */
const HELD: Partial<Record<GlyphId, string>> = {};

test('every drawing is used somewhere, or held back with a reason', () => {
  const used = new Set<string>();
  for (const c of Object.values(CONCEPTS)) { const g = (c as { glyph?: string }).glyph; if (g) used.add(g); }
  for (const corner of Object.values(CORNERS)) used.add(corner.drawing);
  for (const { src } of files) for (const m of src.matchAll(/glyph=\{?["']([a-z-]+)["']/g)) used.add(m[1]!);
  for (const m of readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8').matchAll(/\btabIcon\('([a-z-]+)'\)/g)) used.add(m[1]!);
  const prefGlyph = readFileSync(join(root, 'app', 'settings.tsx'), 'utf8').match(/const PREF_GLYPH[^=]*= \{([^}]*)\}/);
  assert.ok(prefGlyph, 'settings.tsx PREF_GLYPH not found');
  for (const m of prefGlyph[1]!.matchAll(/'([a-z-]+)'/g)) used.add(m[1]!);
  for (const id of ids) {
    if (HELD[id]) assert.ok(!used.has(id), `${id} is used now — remove it from HELD`);
    else assert.ok(used.has(id), `${id} is drawn but nothing draws it`);
  }
});

test('the screens draw the drawing, not just carry it', () => {
  const src = (rel: string) => readFileSync(join(root, rel), 'utf8');
  assert.match(src('components/ui/IconTile.tsx'), /<ConceptIcon icon=\{icon\} glyph=\{glyph\}/);
  assert.match(src('components/ui/LessonPrepBoard.tsx'), /<ConceptIcon[\s\S]*?glyph=\{row\.glyph\}/);
  assert.match(src('components/library/LibraryTile.tsx'), /<ConceptIcon icon=\{icon\} glyph=\{glyph\}/);
  assert.match(src('components/ui/ToolHeader.tsx'), /glyph=\{conceptOf\(concept\)\.glyph\}/);
  assert.match(src('components/ui/Glyph.tsx'), /\baria-hidden\b/, 'web needs aria-hidden; the native props do not reach the DOM');
  // A concept's IconTile takes its glyph too, or a concept that gains a drawing keeps its stock glyph there.
  for (const { rel, src: code } of files) {
    for (const m of code.matchAll(/<IconTile\b[^>]*icon=\{(?:CONCEPTS\[|conceptOf\()[^>]*\/>/g)) {
      assert.match(m[0], /glyph=/, `${rel}: an IconTile draws a concept without its glyph`);
    }
  }
  assert.match(src('app/curriculum/resources.tsx'), /glyph: CORNERS\[id\]\.drawing/);
});

test('every tab is drawn with its Iqraa icon, on every platform', () => {
  const layout = readFileSync(join(root, 'app', '(tabs)', '_layout.tsx'), 'utf8');
  const drawn = [...layout.matchAll(/\bicon: tabIcon\('([a-z-]+)'\)/g)].map(m => m[1]);
  // One per tab, in the bar's order: Today, Ask, School, Library, Tools, Messages, Profile.
  assert.deepEqual(drawn, ['today', 'ask', 'classes', 'library', 'tools', 'messages', 'profile']);
  for (const id of drawn) assert.ok(GLYPHS[id as GlyphId], `tab icon ${id} is not a drawing`);
  // iOS drew SF Symbols and the rest Ionicons, so the bar differed per platform; no second source may creep back.
  assert.doesNotMatch(layout, /expo-symbols|SymbolView|<Ionicons/, 'a tab is drawn with a stock icon again');
  assert.match(layout, /<Glyph name=\{name\} size=\{24\} color=\{color\} tint=\{focused\} \/>/, 'selected tabs carry the tint, idle ones are outline');
  const side = readFileSync(join(root, 'components', 'ui', 'WebSidebar.tsx'), 'utf8');
  assert.match(side, /entry\.icon\(\{ color: active \? colors\.primary : colors\.mutedForeground, focused: active \}\)/, 'the sidebar draws the same entry icons');
});

test('Glyph can draw the outline alone', () => {
  const g = readFileSync(join(root, 'components', 'ui', 'Glyph.tsx'), 'utf8');
  assert.match(g, /tint = true/, 'the tint is on unless asked off');
  // Both arms, not just the opening: a swapped `tint ? {} : { fill }` must fail.
  assert.match(g, /case 'tinted': return tint \? \{ fill: color, fillOpacity: GLYPH_TINT \} : \{\};/, 'a tinted part loses its fill when tint is off');
  assert.match(g, /case 'tint': return tint \? \{ fill: color, fillOpacity: 0\.22, stroke: 'none' \} : \{ stroke: 'none' \};/, 'the flask liquid draws nothing when tint is off');
});
