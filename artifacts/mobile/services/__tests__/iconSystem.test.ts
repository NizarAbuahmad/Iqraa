// Icons follow one system (constants/icons.ts).
//
// An audit on 2026-10-23 found 709 Ionicons across 172 files in 15 different
// sizes (12–48, mostly 16/18/20/22 side by side), 161 of them muted grey, emoji
// standing in for icons in ~32 files, and the same teaching concept drawn
// differently in different places: the quiz was `checkmark-circle-outline` in
// the Tools catalog and `checkmark-done-outline` on the prep board; lesson plan,
// worksheet and homework shared one teal; the quiz and the class challenge
// shared #B54708, which sits next to the amber that means "now". These tests
// keep that from coming back.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONCEPTS, ICON, ICON_DISPLAY, type ConceptId } from '../../constants/icons.ts';
import { ALL_TOOLS, TAB_TOOLS } from '../toolCatalog.ts';
import { PREP_ROWS } from '../lessonBoard.ts';
import { contrast, readableOn } from '../readableColor.ts';
import { deltaE2000, deltaE2000Lab } from '../colorDistance.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function* tsx(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) yield* tsx(p);
    else if (name.endsWith('.tsx')) yield p;
  }
}
const files = ['app', 'components'].flatMap(d => [...tsx(join(root, d))]).map(f => ({ rel: relative(root, f), src: readFileSync(f, 'utf8') }));

// ---------------------------------------------------------------- sizes

const SCALE = new Set<number>([...Object.values(ICON), ...ICON_DISPLAY]);

/** Every integer literal an `<Ionicons … size={…}>` can resolve to: `size={20}` and both arms of `size={a ? 20 : 16}`. */
function literalSizes(element: string): number[] {
  const m = element.match(/\bsize=\{([^}]*)\}/);
  if (!m) return [];
  const expr = m[1]!.trim();
  if (/^\d+$/.test(expr)) return [Number(expr)];
  const tern = expr.match(/\?\s*(\d+)\s*:\s*(\d+)\s*$/);
  return tern ? [Number(tern[1]), Number(tern[2])] : [];
}

test('the scale is the one the sweep mapped onto', () => {
  assert.deepEqual(ICON, { sm: 14, md: 16, lg: 20, xl: 24 });
  assert.deepEqual([...ICON_DISPLAY], [32, 40, 48, 64]);
});

test('every literal Ionicons size is on the icon scale', () => {
  const off: string[] = [];
  let seen = 0;
  for (const { rel, src } of files) {
    for (const m of src.matchAll(/<Ionicons\b[\s\S]*?\/>/g)) {
      for (const n of literalSizes(m[0])) {
        seen++;
        if (!SCALE.has(n)) off.push(`${rel}: size ${n}`);
      }
    }
  }
  assert.ok(seen > 400, `the scan found only ${seen} literal sizes — the regex stopped matching`);
  assert.deepEqual(off, [], `Ionicons sizes off the scale (${[...SCALE].join('/')}) — use ICON.* from constants/icons.ts`);
});

// Files that keep a second icon family, each with the reason.
const OTHER_FAMILY_ALLOWED: Record<string, string> = {
  'components/classroom/BoardToolbar.tsx': 'the whiteboard eraser: Ionicons has no eraser glyph (its `backspace` reads as "delete a character")',
};

test('no other icon family is left in the app', () => {
  const stray = files
    .filter(f => !OTHER_FAMILY_ALLOWED[f.rel] && /<(?:Feather|MaterialCommunityIcons|MaterialIcons|FontAwesome\d*|AntDesign|Entypo)\b/.test(f.src))
    .map(f => f.rel);
  assert.deepEqual(stray, [], 'use Ionicons, so the size scale and the outline/filled rule apply');
  const eraser = files.find(f => f.rel === 'components/classroom/BoardToolbar.tsx')!;
  assert.equal((eraser.src.match(/<MaterialCommunityIcons\b/g) ?? []).length, 1, 'the allow-list is for one eraser, not a second family');
});

// ---------------------------------------------------------------- concepts

const hex = (h: string): [number, number, number] => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

function hueSat(h: string): { hue: number; sat: number } {
  const [r, g, b] = hex(h).map(v => v / 255) as [number, number, number];
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, l = (mx + mn) / 2;
  if (d === 0) return { hue: 0, sat: 0 };
  let hue = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  hue *= 60; if (hue < 0) hue += 360;
  return { hue, sat: d / (1 - Math.abs(2 * l - 1)) };
}

const ids = Object.keys(CONCEPTS) as ConceptId[];

// A tool's id is not always its concept's: the class-challenge tool is `game`.
const CONCEPT_OF_TOOL: Record<string, ConceptId> = { game: 'challenge' };

test('the concept list covers every teaching concept the audit named', () => {
  for (const id of ['lesson-plan', 'worksheet', 'quiz', 'slides', 'activity', 'homework', 'evaluations', 'challenge', 'games', 'classroom', 'parent-msg', 'lesson-flow', 'prompt-slides', 'geogebra'] as ConceptId[]) {
    assert.ok(CONCEPTS[id], `missing concept ${id}`);
  }
  assert.equal(CONCEPTS.quiz.icon, 'checkmark-done-outline');
  assert.equal(CONCEPTS.challenge.icon, 'trophy-outline');
});

test('white text reads on every concept colour at 4.5:1', () => {
  for (const id of ids) {
    const c = contrast('#FFFFFF', CONCEPTS[id].color);
    assert.ok(c >= 4.5, `${id}: white on ${CONCEPTS[id].color} is ${c.toFixed(2)}:1`);
  }
});

test('CIEDE2000 matches the published reference pairs', () => {
  // Sharma, Wu and Dalal (2005), the first rows of their test data.
  assert.ok(Math.abs(deltaE2000Lab([50, 2.6772, -79.7751], [50, 0, -82.7485]) - 2.0425) < 1e-3);
  assert.ok(Math.abs(deltaE2000Lab([50, 3.1571, -77.2803], [50, 0, -82.7485]) - 2.8615) < 1e-3);
  assert.ok(Math.abs(deltaE2000Lab([50, 2.5, 0], [50, 0, -2.5]) - 4.3065) < 1e-3);
  assert.equal(deltaE2000('#4338CA', '#4338CA'), 0);
});

// The Tools tab's own concepts: the ones a teacher sees side by side as a grid of tiles.
const TAB_CONCEPTS = [...new Set(TAB_TOOLS.map(t => CONCEPT_OF_TOOL[t.id] ?? t.id))] as ConceptId[];
const DARK_CARD = '#111F36'; // palette.card in dark mode

// ΔE2000 ≥ 8 on the light card and again after `readableOn` has lifted each colour for the dark card. 10 would be
// the target, but the prep board's own hues (lesson-plan #4338CA, quiz #7C3AED) are 9.4 apart (8.5 on dark) and
// those are kept; every other pair is further apart than that.
const TAB_MIN_DE = 8;

test('Tools-tab concepts are clearly different colours on the light card', () => {
  assert.ok(TAB_CONCEPTS.length >= 8, `the Tools tab lists ${TAB_CONCEPTS.length} concepts`);
  const bad: string[] = [];
  for (let i = 0; i < TAB_CONCEPTS.length; i++) for (let j = i + 1; j < TAB_CONCEPTS.length; j++) {
    const a = TAB_CONCEPTS[i]!, b = TAB_CONCEPTS[j]!;
    const d = deltaE2000(CONCEPTS[a].color, CONCEPTS[b].color);
    if (d < TAB_MIN_DE) bad.push(`${a} ${CONCEPTS[a].color} ~ ${b} ${CONCEPTS[b].color} (ΔE2000 ${d.toFixed(1)})`);
  }
  assert.deepEqual(bad, []);
});

test('Tools-tab concepts are clearly different colours on the dark card', () => {
  const lift = (id: ConceptId) => readableOn(CONCEPTS[id].color, DARK_CARD, 3);
  const bad: string[] = [];
  for (let i = 0; i < TAB_CONCEPTS.length; i++) for (let j = i + 1; j < TAB_CONCEPTS.length; j++) {
    const a = TAB_CONCEPTS[i]!, b = TAB_CONCEPTS[j]!;
    const d = deltaE2000(lift(a), lift(b));
    if (d < TAB_MIN_DE) bad.push(`${a} ${lift(a)} ~ ${b} ${lift(b)} (ΔE2000 ${d.toFixed(1)})`);
  }
  assert.deepEqual(bad, []);
});

test('no two concepts anywhere (hidden tools included) are near twins', () => {
  const bad: string[] = [];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const d = deltaE2000(CONCEPTS[ids[i]!].color, CONCEPTS[ids[j]!].color);
    if (d < 7) bad.push(`${ids[i]} ${CONCEPTS[ids[i]!].color} ~ ${ids[j]} ${CONCEPTS[ids[j]!].color} (ΔE2000 ${d.toFixed(1)})`);
  }
  assert.deepEqual(bad, []);
});

test('no concept is amber: amber (palette.live) means "now" and nothing else', () => {
  // Amber family, two ways. (1) Hue 25°–50° at saturation > 0.6 — where palette.live (#B45309, 26°) and every
  // lighter amber sit. (2) Within ΔE2000 3 of the two oranges the app already used for "attention" (#B54708, the old
  // quiz and challenge colour; #B45309). The activity orange #C2410C is 17°, ΔE2000 3.5 from #B54708 and 6.9 from
  // #B45309: close, but a red-orange, and the prep board has always worn it. It is the nearest concept to amber.
  for (const id of ids) {
    const { color } = CONCEPTS[id];
    const { hue, sat } = hueSat(color);
    assert.ok(!(hue >= 25 && hue <= 50 && sat > 0.6), `${id} ${color} is in the amber hue band (${hue.toFixed(0)}°)`);
    for (const amber of ['#B54708', '#B45309']) {
      assert.ok(deltaE2000(color, amber) >= 3, `${id} ${color} is within ΔE2000 3 of the amber ${amber}`);
    }
  }
});

// ---------------------------------------------------------------- one source

test('the tool catalog takes icon and colour from CONCEPTS', () => {
  for (const tool of ALL_TOOLS) {
    const id = (CONCEPT_OF_TOOL[tool.id] ?? tool.id) as ConceptId;
    assert.ok(CONCEPTS[id], `tool ${tool.id} has no concept`);
    assert.equal(tool.icon, CONCEPTS[id].icon, `${tool.id} icon`);
    assert.equal(tool.color, CONCEPTS[id].color, `${tool.id} colour`);
  }
  const catalog = readFileSync(join(root, 'services', 'toolCatalog.ts'), 'utf8');
  assert.doesNotMatch(catalog, /\bcolor: '#/, 'toolCatalog.ts holds a literal colour — add it to CONCEPTS');
});

test('the prep board takes icon and colour from CONCEPTS', () => {
  for (const row of PREP_ROWS) {
    const id = row.type as ConceptId;
    assert.ok(CONCEPTS[id], `prep row ${row.type} has no concept`);
    assert.equal(row.icon, CONCEPTS[id].icon, `${row.type} icon`);
    assert.equal(row.color, CONCEPTS[id].color, `${row.type} colour`);
  }
  const board = readFileSync(join(root, 'services', 'lessonBoard.ts'), 'utf8');
  assert.doesNotMatch(board, /\bcolor: '#/, 'lessonBoard.ts holds a literal colour — add it to CONCEPTS');
});

test('the same concept is the same icon on both surfaces', () => {
  const rows = new Map(PREP_ROWS.map(r => [r.type as string, r]));
  for (const tool of ALL_TOOLS) {
    const row = rows.get(tool.id);
    if (!row) continue;
    assert.equal(tool.icon, row.icon, `${tool.id}: Tools tab and prep board draw it differently`);
    assert.equal(tool.color, row.color, `${tool.id}: Tools tab and prep board colour it differently`);
  }
});

// ---------------------------------------------------------------- emoji as icons

// Status ticks, crosses, warnings and tips are drawn by <Ionicons>, which renders the same on every platform.
const UI_EMOJI = /[✓✔✕✖✗✘⚠💡✅❌⬜]/u;

/** Files where one of those characters is content, not chrome — each with its reason. */
const EMOJI_ALLOWED: Record<string, string> = {
  'components/englishHub/GrammarActivities.tsx': '✅/❌ are the lesson\'s own pictures for got / likes vs. does not, shown to children as the exercise (MARKER_GLYPH), not status chrome',
  'app/dev/cqv/[lessonId].tsx': 'internal curriculum-QA tooling, not a user-facing screen',
  'app/dev/cqv/index.tsx': 'internal curriculum-QA tooling, not a user-facing screen',
};

test('app chrome draws ticks, crosses, warnings and tips with Ionicons, not emoji', () => {
  const hits: string[] = [];
  for (const { rel, src } of files) {
    if (EMOJI_ALLOWED[rel]) continue;
    // Comments are prose about the glyph, not the glyph: blank block comments (keeping their newlines), then each line's `//` tail.
    const code = src.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ''));
    code.split('\n').forEach((line, i) => {
      if (UI_EMOJI.test(line.replace(/\/\/.*$/, ''))) hits.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`);
    });
  }
  assert.deepEqual(hits, [], 'replace with <Ionicons> (checkmark-circle, close-circle, alert-circle, bulb-outline …), or allow-list the file in EMOJI_ALLOWED with the reason it is content');
});

test('every allow-listed emoji file still holds one (so the list cannot rot)', () => {
  for (const rel of Object.keys(EMOJI_ALLOWED)) {
    const f = files.find(x => x.rel === rel);
    assert.ok(f, `${rel} no longer exists`);
    assert.ok(UI_EMOJI.test(f!.src), `${rel} no longer holds a UI emoji — remove it from EMOJI_ALLOWED`);
  }
});

// ---------------------------------------------------------------- glyphs on the card

// A concept colour is picked to carry white text, which is the opposite surface from the dark card: a raw `#4338CA`
// glyph is 2.0:1 on `#111F36`. Every screen that draws a tool's glyph lifts it with readableOn(…, colors.card, 3).
const TOOL_GLYPH_FILES = [
  'app/(tabs)/ai-tools.tsx',
  'app/(tabs)/index.tsx',
  'components/today/PhoneToday.tsx',
  'components/ui/ComposerToolsMenu.tsx',
];

test('a tool glyph on a card goes through readableOn', () => {
  for (const rel of TOOL_GLYPH_FILES) {
    const src = readFileSync(join(root, rel), 'utf8');
    assert.match(src, /<Ionicons name=\{tool\.icon\}[^>]*color=\{readableOn\(tool\.color, colors\.card, 3\)\}/, `${rel} draws the tool glyph without readableOn`);
  }
  const raw = files.filter(f => /<Ionicons\b[^>]*color=\{tool\.color\}/.test(f.src)).map(f => f.rel);
  assert.deepEqual(raw, [], 'a raw tool.color glyph on a card: wrap it in readableOn(tool.color, colors.card, 3)');
});

// ---------------------------------------------------------------- strings that sit beside an icon

test('relatedResourcesDone has no leading emoji: its panel draws a checkmark-circle', () => {
  const i18n = readFileSync(join(root, 'services', 'i18n.ts'), 'utf8');
  const found = [...i18n.matchAll(/relatedResourcesDone:\s*'([^']*)'/g)].map(m => m[1]!);
  assert.equal(found.length, 2, 'one string in Arabic and one in English');
  for (const text of found) assert.doesNotMatch(text, /^\s*[✅✓✔\p{Extended_Pictographic}]/u, `«${text}» starts with an emoji`);
  const panel = readFileSync(join(root, 'components', 'ui', 'RelatedResourcesPanel.tsx'), 'utf8');
  assert.match(panel, /name="checkmark-circle"/, 'the panel no longer draws the tick this test assumes');
});
