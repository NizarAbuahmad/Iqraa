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
import { DARK_CARD as MATERIAL_DARK_CARD, MATERIAL_CONCEPT, MATERIAL_FILL, MATERIAL_ICON, MATERIAL_ON_DARK } from '../../constants/materialKindData.ts';
import { SHELF_COLOR, SHELF_CONCEPT, SHELF_ICON } from '../../constants/shelfLook.ts';
import { FLOW_STEP, FLOW_STEP_CONCEPT, FLOW_STEP_KEYS, flowStepColor } from '../../constants/lessonFlowSteps.ts';
import { RESOURCE_KIND_ICON } from '../../constants/resourceKind.ts';
import { SHELF_ORDER } from '../resourceCatalog.ts';
import { DOC_ACCENT } from '../exportHtml.ts';
import { typeColor, type ContinueMaterialKind } from '../continueTeaching.ts';

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

test('every literal icon size (Ionicons, ConceptIcon, Glyph) is on the icon scale', () => {
  const off: string[] = [];
  let seen = 0;
  for (const { rel, src } of files) {
    for (const m of src.matchAll(/<(?:Ionicons|ConceptIcon|Glyph)\b[\s\S]*?\/>/g)) {
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

/**
 * Why a colour is amber, or null. Two ways: (1) hue 25°–50° at saturation > 0.6, where palette.live (#B45309, 26°)
 * and every lighter amber sit; (2) within ΔE2000 3 of the two oranges the app already used for "attention"
 * (#B54708, the old quiz and challenge colour; #B45309). The activity orange #C2410C is 17°, ΔE2000 3.5 from #B54708
 * and 6.9 from #B45309: close, but a red-orange, and the prep board has always worn it. It is the nearest concept to amber.
 */
function amberProblem(color: string): string | null {
  const { hue, sat } = hueSat(color);
  if (hue >= 25 && hue <= 50 && sat > 0.6) return `${color} is in the amber hue band (${hue.toFixed(0)}°)`;
  for (const amber of ['#B54708', '#B45309']) {
    if (deltaE2000(color, amber) < 3) return `${color} is within ΔE2000 3 of the amber ${amber}`;
  }
  return null;
}

test('no concept is amber: amber (palette.live) means "now" and nothing else', () => {
  for (const id of ids) assert.equal(amberProblem(CONCEPTS[id].color), null, id);
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
    assert.match(src, /<ConceptIcon icon=\{tool\.icon\} glyph=\{tool\.glyph\}[^>]*color=\{readableOn\(tool\.color, colors\.card, 3\)\}/, `${rel} draws the tool glyph without readableOn`);
  }
  const raw = files.filter(f => /<(?:Ionicons|ConceptIcon|Glyph)\b[^>]*color=\{tool\.color\}/.test(f.src)).map(f => f.rel);
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

// ---------------------------------------------------------------- the tables that used to keep their own

// Left open by "Icons follow one system": «موادي» and the printed copies (materialKind), the lesson-flow builder and
// viewer, and the Library shelves each kept a table of icon + colour and disagreed with CONCEPTS. The audio shelf was
// #B45309, exactly palette.live. A table entry that IS a concept reads CONCEPTS; one that is not has a colour of its own
// that carries white at 4.5:1, is not amber, and is not a twin of a concept.

const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
const hexLiterals = (src: string) => [...src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').matchAll(/#[0-9A-Fa-f]{6}\b/g)].map(m => m[0].toUpperCase());
const conceptColors = ids.map(id => CONCEPTS[id].color);
const liftForDark = (c: string) => readableOn(c, DARK_CARD, 3);

/** An entry with a colour of its own: white text at 4.5:1, not amber, at least ΔE2000 7 (the near-twin floor) from every concept. */
function assertOwnColour(label: string, color: string) {
  assert.ok(contrast('#FFFFFF', color) >= 4.5, `${label}: white on ${color} is ${contrast('#FFFFFF', color).toFixed(2)}:1`);
  assert.equal(amberProblem(color), null, label);
  for (const id of ids) {
    const d = deltaE2000(color, CONCEPTS[id].color);
    assert.ok(d >= 7, `${label} ${color} is a near twin of the ${id} concept ${CONCEPTS[id].color} (ΔE2000 ${d.toFixed(1)})`);
  }
}

function assertApart(label: string, colours: Record<string, string>, min: number, lift: (c: string) => string = c => c) {
  const keys = Object.keys(colours);
  const bad: string[] = [];
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const d = deltaE2000(lift(colours[keys[i]!]!), lift(colours[keys[j]!]!));
    if (d < min) bad.push(`${keys[i]} ${colours[keys[i]!]} ~ ${keys[j]} ${colours[keys[j]!]} (ΔE2000 ${d.toFixed(1)})`);
  }
  assert.deepEqual(bad, [], `${label}: pairs closer than ΔE2000 ${min}`);
}

// ----- saved materials («موادي», the viewer's header, the printed and projected copies)

const MATERIAL_KINDS = (() => {
  const m = read('services/workspace.ts').match(/export type MaterialType = ([^;]+);/);
  assert.ok(m, 'MaterialType moved — update this test');
  return [...m![1]!.matchAll(/'([^']+)'/g)].map(x => x[1]!);
})();

test('every saved-material kind has an icon and a colour, and the table holds no other', () => {
  assert.ok(MATERIAL_KINDS.length >= 8, `found ${MATERIAL_KINDS.join(', ')}`);
  assert.deepEqual(Object.keys(MATERIAL_FILL).sort(), [...MATERIAL_KINDS].sort());
  assert.deepEqual(Object.keys(MATERIAL_ICON).sort(), [...MATERIAL_KINDS].sort());
  assert.deepEqual(Object.keys(MATERIAL_ON_DARK).sort(), [...MATERIAL_KINDS].sort());
});

test('a material that is a teaching concept takes icon and colour from CONCEPTS', () => {
  for (const [kind, id] of Object.entries(MATERIAL_CONCEPT)) {
    assert.equal(MATERIAL_ICON[kind as keyof typeof MATERIAL_ICON], CONCEPTS[id!].icon, `${kind} icon`);
    assert.equal(MATERIAL_FILL[kind as keyof typeof MATERIAL_FILL], CONCEPTS[id!].color, `${kind} colour`);
  }
  // Seven of the eight kinds are concepts; only the whiteboard canvas is not.
  assert.deepEqual(MATERIAL_KINDS.filter(k => !(k in MATERIAL_CONCEPT)), ['board']);
  assert.equal(MATERIAL_ICON.quiz, 'checkmark-done-outline', 'the quiz was help-circle-outline here and checkmark-done-outline everywhere else');
  assert.equal(MATERIAL_ICON.activity, CONCEPTS.activity.icon);
});

test('the material tables hold no colour literal but the whiteboard slate and the dark card', () => {
  assert.deepEqual(hexLiterals(read('constants/materialKindData.ts')).sort(), ['#111F36', '#475569']);
  assert.deepEqual(hexLiterals(read('constants/materialKind.ts')), [], 'materialKind.ts re-exports the data; it holds no colour');
  assert.match(read('constants/colors.ts'), /card:\s*'#111F36'/, 'palette.card in dark mode moved: update DARK_CARD in materialKindData.ts');
  assert.equal(MATERIAL_DARK_CARD, DARK_CARD);
});

test('material fills carry white at 4.5:1, are not amber, and are told apart', () => {
  for (const kind of MATERIAL_KINDS) {
    const c = MATERIAL_FILL[kind as keyof typeof MATERIAL_FILL];
    assert.ok(contrast('#FFFFFF', c) >= 4.5, `${kind}: white on ${c}`);
    assert.equal(amberProblem(c), null, kind);
  }
  assertOwnColour('board', MATERIAL_FILL.board);
  // Seven, not eight: lesson plan and prompt slides are the concept pair 7.4 apart, and the same holds on the Tools tab.
  assertApart('material fills', MATERIAL_FILL, 7);
});

test('the material text colours on the dark card are at least 7:1', () => {
  for (const kind of MATERIAL_KINDS) {
    const c = MATERIAL_ON_DARK[kind as keyof typeof MATERIAL_ON_DARK];
    assert.ok(contrast(c, DARK_CARD) >= 7, `${kind}: ${c} on the dark card is ${contrast(c, DARK_CARD).toFixed(2)}:1`);
  }
});

test('a printed or projected document wears the same colour as its material in «موادي»', () => {
  for (const kind of Object.keys(DOC_ACCENT) as (keyof typeof DOC_ACCENT)[]) {
    assert.equal(DOC_ACCENT[kind], MATERIAL_FILL[kind], `${kind}: printed and in-app colours differ`);
    assert.equal(amberProblem(DOC_ACCENT[kind]), null, kind);
  }
  assert.deepEqual(Object.keys(DOC_ACCENT).sort(), ['activity', 'lesson', 'quiz', 'worksheet']);
});

test('the dormant continue-card typeColor follows CONCEPTS too, and none of it is amber', () => {
  const expected: Record<ContinueMaterialKind, string> = {
    lesson: CONCEPTS['lesson-plan'].color,
    worksheet: CONCEPTS.worksheet.color,
    homework: CONCEPTS.homework.color,
    quiz: CONCEPTS.quiz.color,
    activity: CONCEPTS.activity.color,
    flow: CONCEPTS['lesson-flow'].color,
  };
  for (const [kind, color] of Object.entries(expected)) assert.equal(typeColor(kind as ContinueMaterialKind), color, kind);
});

// ----- the Library shelves

test('a Library shelf that is a teaching concept reads CONCEPTS; the table covers exactly the catalog shelves', () => {
  assert.deepEqual(Object.keys(SHELF_COLOR).sort(), [...SHELF_ORDER].sort());
  assert.deepEqual(Object.keys(SHELF_ICON).sort(), [...SHELF_ORDER].sort());
  assert.deepEqual(SHELF_CONCEPT, { game: 'games', worksheet: 'worksheet', presentation: 'slides' });
  for (const [shelf, id] of Object.entries(SHELF_CONCEPT)) {
    assert.equal(SHELF_COLOR[shelf as keyof typeof SHELF_COLOR], CONCEPTS[id!].color, `${shelf} colour`);
    assert.equal(SHELF_ICON[shelf as keyof typeof SHELF_ICON], CONCEPTS[id!].icon, `${shelf} icon`);
    // The class's Resources tab and the picker draw the same kind from RESOURCE_KIND_ICON.
    assert.equal(RESOURCE_KIND_ICON[shelf as keyof typeof RESOURCE_KIND_ICON], CONCEPTS[id!].icon, `${shelf} resource-kind icon`);
  }
  const screen = read('app/curriculum/resources.tsx');
  assert.match(screen, /from '@\/constants\/shelfLook'/);
  assert.doesNotMatch(screen, /const SHELF_(?:COLOR|ICON)\b/, 'resources.tsx declares a shelf table of its own again');
});

test('Library shelf icons are outline glyphs, like every other navigation icon', () => {
  for (const shelf of SHELF_ORDER) assert.match(SHELF_ICON[shelf], /-outline$/, `${shelf}: ${SHELF_ICON[shelf]}`);
});

test('a Library shelf that is not a concept has its own colour: white at 4.5:1, not amber, no concept twin', () => {
  const own = SHELF_ORDER.filter(s => !(s in SHELF_CONCEPT));
  assert.deepEqual(own, ['infographic', 'image', 'video', 'audio', 'template', 'document']);
  for (const shelf of own) assertOwnColour(shelf, SHELF_COLOR[shelf]);
  assert.notEqual(SHELF_COLOR.audio.toUpperCase(), '#B45309', 'the audio shelf was palette.live, the amber that means "now"');
});

test('the nine Library shelves are clearly different colours on the light card and on the dark one', () => {
  assertApart('light', SHELF_COLOR, 8);
  // Lifted by readableOn for the dark card, as the screen does; the Tools tab's 8 would need the audio emerald and the
  // worksheet teal (7.8 apart once lifted) to move, so the dark floor is the near-twin 7.
  assertApart('dark', SHELF_COLOR, 7, liftForDark);
});

// ----- the lesson flow's six steps (builder and viewer)

test('a lesson-flow step that is a teaching concept reads CONCEPTS', () => {
  assert.deepEqual(FLOW_STEP_CONCEPT, { activity: 'activity', worksheet: 'worksheet' });
  for (const [step, id] of Object.entries(FLOW_STEP_CONCEPT)) {
    assert.equal(FLOW_STEP[step as keyof typeof FLOW_STEP].icon, CONCEPTS[id!].icon, `${step} icon`);
    assert.equal(FLOW_STEP[step as keyof typeof FLOW_STEP].color, CONCEPTS[id!].color, `${step} colour`);
  }
  assert.equal(FLOW_STEP.worksheet.icon, 'list-outline', 'the worksheet step was document-text-outline, the lesson plan\'s icon');
});

test('the other lesson-flow steps have their own colours: white at 4.5:1, not amber, no concept twin, told apart', () => {
  assert.equal(FLOW_STEP.objectives.color, null, 'objectives is ink, resolved by each screen');
  const own = FLOW_STEP_KEYS.filter(k => !(k in FLOW_STEP_CONCEPT) && FLOW_STEP[k].color);
  assert.deepEqual(own, ['warmup', 'guided', 'exitTicket']);
  for (const k of own) assertOwnColour(k, FLOW_STEP[k].color!);
  // Everything a flow shows at once: ink, the three, and the two concept steps.
  const shown: Record<string, string> = { ink: '#0B1B33' };
  for (const k of FLOW_STEP_KEYS) if (FLOW_STEP[k].color) shown[k] = FLOW_STEP[k].color!;
  assert.equal(Object.keys(shown).length, 6);
  assertApart('flow steps, light', shown, 8);
  assertApart('flow steps, dark', shown, 7, liftForDark);
  assert.equal(flowStepColor('objectives', '#123456'), '#123456');
  assert.equal(flowStepColor('warmup', '#123456'), FLOW_STEP.warmup.color);
});

test('the lesson-flow builder and viewer read the shared step table, not icon and colour literals of their own', () => {
  for (const rel of ['app/ai-tools/lesson-flow.tsx', 'app/workspace/view.tsx']) {
    const whole = read(rel);
    assert.match(whole, /from '@\/constants\/lessonFlowSteps'/, `${rel} does not import the step table`);
    // The viewer also draws lesson-plan sections (its own `flag-outline` objectives): only the flow renderer is in question.
    const marker = whole.indexOf('// ─── Lesson Flow renderer');
    assert.ok(rel !== 'app/workspace/view.tsx' || marker > 0, 'the viewer\'s flow renderer moved — update this test');
    const src = rel === 'app/workspace/view.tsx' ? whole.slice(marker) : whole;
    for (const icon of ['flag-outline', 'flame-outline', 'flash-outline', 'pencil-outline', 'ticket-outline']) {
      assert.ok(!src.includes(`'${icon}'`), `${rel} spells the step icon ${icon} itself`);
    }
    for (const old of ['#6D28D9', '#B54708']) assert.ok(!src.includes(old), `${rel} still holds the old step colour ${old}`);
    assert.doesNotMatch(src, /icon: 'document-text-outline', color:/, `${rel}: the worksheet step is back to the lesson plan's icon`);
  }
});
