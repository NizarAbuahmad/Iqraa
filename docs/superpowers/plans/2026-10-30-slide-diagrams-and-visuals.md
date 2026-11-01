# Slide diagrams and visuals — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Four drawn diagram layouts (cycle, tree, Venn, mind map) in all three deck renderers, taught to both slide generators, and curriculum (Slides Maker) explanation slides gaining shapes, icons, charts and up to two photos.

**Architecture:** Diagrams are new `ActivitySlide.layout` values gated by `resolveSlideLayout` like the existing layouts. One pure module (`diagramGeometry.ts`) turns a resolved diagram into positioned boxes, ellipses, lines and text boxes; the presenter, the PDF/HTML and PowerPoint each draw those primitives. The generators gain prompt text; Slides Maker's teaching section gains optional per-concept extras checked by the same gates.

**Tech Stack:** TypeScript, React Native / react-native-web + react-native-svg (presenter), HTML/SVG (PDF), pptxgenjs (PowerPoint), Express (API), `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-30-slide-diagrams-and-visuals-design.md`

## Global Constraints

- Arabic is the product language; RTL first. Text is never rasterised: diagrams draw shapes, renderers place real text.
- No `sed -i` / `perl -pi` on source; use the Edit tool (CLAUDE.md, "Tool pitfalls").
- Mobile tests run only from `artifacts/mobile/services/__tests__/**/*.test.ts` under bare `node --test`: anything imported there must not import `react-native` or `expo-*` at module scope.
- Relative imports loaded by `node --test` need an explicit `.ts` extension.
- The API cannot import the app: `DECK_LAYOUT_NAMES` (API) is a copy of `SLIDE_LAYOUTS` (app), pinned equal by `promptSlidesPrompt.test.ts`.
- A gate refuses, never repairs: a payload that fails falls back to the slide's own words (`payloadLines`), never a blank or half-drawn slide.
- Limits (from the spec, with the three-set Venn tightened during planning because a third of a 960-unit circle cannot hold 4 × 32 characters): cycle 3–6 stages, label 1–24 chars, note ≤ 60; tree root 1–32, 2–4 branches of 1–24, 0–4 leaves of 1–24; Venn 2–3 sets, label 1–24, `only`/`shared` 0–4 items of 1–32 (three sets: `only` 0–3 items of 1–20, `shared` 0–2 items of 1–20), at least one item; mind map centre 1–40, 3–6 nodes of 1–40, role `cause` | `effect` optional.
- Photos on curriculum decks: at most 2 explanation-slide photos (3 with the cover), never on a slide with `sideImageUrl` or a `layout`.
- Pool: `PROMPT_VERSION_BY_KIND['lesson-teaching']` becomes `'2026-10-31.1'`.
- Commits end with the session's attribution lines; `git add` named paths only.

## File map

| File | Responsibility |
|---|---|
| `artifacts/mobile/services/ai/AIService.ts` | `ActivitySlide.layout` union + four payload fields; `LessonTeachingOutput` concept extras |
| `artifacts/mobile/services/slideLayout.ts` | gate for the four layouts, `SLIDE_LAYOUTS`, `PAYLOAD_LAYOUTS`, `payloadLines` |
| `artifacts/mobile/services/diagramGeometry.ts` (new) | pure geometry: `diagramGeometry`, `isDiagram`, `diagramBeats`, `trimLine`, `arrowHead` |
| `artifacts/mobile/services/deckTheme.ts` | `diagramTint(theme)` |
| `artifacts/mobile/services/diagramHtml.ts` (new) | pure HTML/SVG string for the PDF |
| `artifacts/mobile/services/pptxDiagram.ts` (new) | pure: draws geometry onto a pptxgenjs-like slide |
| `artifacts/mobile/services/deckSlidesHtml.ts` | calls `diagramHtml` from `layoutSlide` |
| `artifacts/mobile/services/exportPptx.ts` | calls `drawPptxDiagram` from its layout branch |
| `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` | `DiagramView` in `SlideView`'s layout branch |
| `artifacts/mobile/services/pacedReveal.ts` | beats for the four kinds |
| `artifacts/mobile/services/promptSlidesPolish.ts` | the four join `STRUCTURE_LAYOUTS` |
| `artifacts/api-server/src/lib/promptSlidesPrompt.ts` | `DECK_LAYOUT_NAMES`, prompt text (AR/EN) |
| `artifacts/api-server/src/lib/deckChecks.ts` | `*_incomplete` warnings |
| `artifacts/api-server/src/lib/lessonTeachingPrompt.ts` | concept extras in the prompt; `teachingVisualCounts` |
| `artifacts/api-server/src/lib/generationKey.ts` | lesson-teaching version bump |
| `artifacts/api-server/src/routes/generate.ts` | «lesson-teaching visuals» log |
| `artifacts/mobile/services/lessonSlides.ts` | `usableTeaching` extras, builder copies them, `teachingPhotoTargets` |
| `artifacts/mobile/app/ai-tools/slides.tsx` | fetch and attach up to two concept photos |
| `docs/status-log.md`, `STATUS.md` | write-up |

---

### Task 1: Types and the gate for the four diagram layouts

**Files:**
- Modify: `artifacts/mobile/services/ai/AIService.ts` (the `layout?:` union near line 532 and the payload fields after `concepts?: string[];`)
- Modify: `artifacts/mobile/services/slideLayout.ts`
- Test: `artifacts/mobile/services/__tests__/slideLayout.test.ts`

**Interfaces:**
- Produces: `ResolvedLayout` members
  `{ kind: 'cycle'; stages: { label: string; note?: string }[] }`,
  `{ kind: 'tree'; root: string; branches: { label: string; leaves: string[] }[] }`,
  `{ kind: 'venn'; sets: { label: string; only: string[] }[]; shared: string[] }`,
  `{ kind: 'mindmap'; center: string; nodes: { text: string; role?: 'cause' | 'effect' }[] }`;
  `SLIDE_LAYOUTS` includes `'cycle','tree','venn','mindmap'`; `PAYLOAD_LAYOUTS` too; `payloadLines` reads the four payloads.

- [ ] **Step 1: Write the failing tests** (append to `slideLayout.test.ts`)

```ts
describe('diagram layouts', () => {
  const cyc = (stages: unknown) => slide({ layout: 'cycle', cycle: { stages } as never });
  it('draws a cycle of 3 to 6 named stages', () => {
    const r = resolveSlideLayout(cyc([{ label: 'تبخر' }, { label: 'تكاثف', note: 'تبرد' }, { label: 'هطول' }]));
    assert.deepEqual(r, { kind: 'cycle', stages: [{ label: 'تبخر' }, { label: 'تكاثف', note: 'تبرد' }, { label: 'هطول' }] });
  });
  it('refuses a cycle that is too short, too long, repeated or over-long', () => {
    assert.equal(resolveSlideLayout(cyc([{ label: 'a' }, { label: 'b' }])), null);
    assert.equal(resolveSlideLayout(cyc(Array.from({ length: 7 }, (_, i) => ({ label: `s${i}` })))), null);
    assert.equal(resolveSlideLayout(cyc([{ label: 'a' }, { label: 'a' }, { label: 'b' }])), null);
    assert.equal(resolveSlideLayout(cyc([{ label: 'x'.repeat(25) }, { label: 'b' }, { label: 'c' }])), null);
    assert.equal(resolveSlideLayout(cyc([{ label: 'a', note: 'n'.repeat(61) }, { label: 'b' }, { label: 'c' }])), null);
  });

  const tree = (t: unknown) => slide({ layout: 'tree', tree: t as never });
  it('draws a tree of 2 to 4 branches with up to 4 leaves each', () => {
    const r = resolveSlideLayout(tree({ root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر', 'مركب'] }, { label: 'مخلوط' }] }));
    assert.deepEqual(r, { kind: 'tree', root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر', 'مركب'] }, { label: 'مخلوط', leaves: [] }] });
  });
  it('refuses a tree with one branch, five leaves, or a repeated sibling', () => {
    assert.equal(resolveSlideLayout(tree({ root: 'r', branches: [{ label: 'a' }] })), null);
    assert.equal(resolveSlideLayout(tree({ root: 'r', branches: [{ label: 'a', leaves: ['1', '2', '3', '4', '5'] }, { label: 'b' }] })), null);
    assert.equal(resolveSlideLayout(tree({ root: 'r', branches: [{ label: 'a' }, { label: 'a' }] })), null);
    assert.equal(resolveSlideLayout(tree({ root: '', branches: [{ label: 'a' }, { label: 'b' }] })), null);
  });

  const venn = (v: unknown) => slide({ layout: 'venn', venn: v as never });
  it('draws a two-set Venn and a three-set one within the tighter limits', () => {
    assert.ok(resolveSlideLayout(venn({ sets: [{ label: 'فلزات', only: ['موصلة'] }, { label: 'لافلزات', only: [] }], shared: ['عناصر'] })));
    assert.ok(resolveSlideLayout(venn({ sets: [{ label: 'a', only: ['x'] }, { label: 'b', only: [] }, { label: 'c', only: [] }], shared: [] })));
  });
  it('refuses an empty Venn, a fourth set, and three-set items past the tighter limit', () => {
    assert.equal(resolveSlideLayout(venn({ sets: [{ label: 'a', only: [] }, { label: 'b', only: [] }], shared: [] })), null);
    assert.equal(resolveSlideLayout(venn({ sets: ['a', 'b', 'c', 'd'].map(label => ({ label, only: ['x'] })), shared: [] })), null);
    assert.equal(resolveSlideLayout(venn({ sets: [{ label: 'a', only: ['1', '2', '3', '4'] }, { label: 'b', only: [] }, { label: 'c', only: [] }], shared: [] })), null);
    assert.equal(resolveSlideLayout(venn({ sets: [{ label: 'a', only: ['x'.repeat(21)] }, { label: 'b', only: [] }, { label: 'c', only: [] }], shared: [] })), null);
  });

  const mind = (m: unknown) => slide({ layout: 'mindmap', mindmap: m as never });
  it('draws a mind map of 3 to 6 nodes, roles optional', () => {
    const r = resolveSlideLayout(mind({ center: 'التلوث', nodes: [{ text: 'المصانع', role: 'cause' }, { text: 'أمراض', role: 'effect' }, { text: 'حلول' }] }));
    assert.deepEqual(r, { kind: 'mindmap', center: 'التلوث', nodes: [{ text: 'المصانع', role: 'cause' }, { text: 'أمراض', role: 'effect' }, { text: 'حلول' }] });
  });
  it('refuses a mind map with two nodes or an unknown role', () => {
    assert.equal(resolveSlideLayout(mind({ center: 'c', nodes: [{ text: 'a' }, { text: 'b' }] })), null);
    assert.equal(resolveSlideLayout(mind({ center: 'c', nodes: [{ text: 'a', role: 'reason' }, { text: 'b' }, { text: 'c' }] })), null);
  });

  it('lists the four in SLIDE_LAYOUTS and falls back to their words', () => {
    for (const l of ['cycle', 'tree', 'venn', 'mindmap']) assert.ok((SLIDE_LAYOUTS as readonly string[]).includes(l), l);
    const lines = payloadLines(slide({
      cycle: { stages: [{ label: 'تبخر', note: 'حرارة' }] },
      tree: { root: 'المادة', branches: [{ label: 'نقية', leaves: ['عنصر'] }] },
      venn: { sets: [{ label: 'فلزات', only: ['موصلة'] }], shared: ['عناصر'] },
      mindmap: { center: 'التلوث', nodes: [{ text: 'المصانع' }] },
    }));
    assert.deepEqual(lines, ['تبخر — حرارة', 'المادة', 'نقية — عنصر', 'فلزات — موصلة', 'عناصر', 'التلوث', 'المصانع']);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/slideLayout.test.ts`
Expected: FAIL (`cycle` is not a known layout / type errors are not checked by node, assertions fail with `null`).

- [ ] **Step 3: Extend the type** (`AIService.ts`)

Replace the `layout?:` union line with:

```ts
  layout?: 'statement' | 'stat' | 'compare' | 'steps' | 'timeline' | 'stats' | 'table' | 'flow' | 'quote' | 'photo' | 'concepts'
    | 'cycle' | 'tree' | 'venn' | 'mindmap';
```

After `concepts?: string[];` add:

```ts
  /** Stages on a circle, for `layout: 'cycle'` (3–6). */
  cycle?: { stages: { label: string; note?: string }[] };
  /** A classification, for `layout: 'tree'`: one root, 2–4 branches, 0–4 leaves each. */
  tree?: { root: string; branches: { label: string; leaves?: string[] }[] };
  /** Two or three sets, for `layout: 'venn'`; `shared` is what all of them have. */
  venn?: { sets: { label: string; only: string[] }[]; shared: string[] };
  /** One idea and 3–6 linked ones, for `layout: 'mindmap'`; a role draws an arrow. */
  mindmap?: { center: string; nodes: { text: string; role?: 'cause' | 'effect' }[] };
```

- [ ] **Step 4: Implement the gate** (`slideLayout.ts`)

Add to `ResolvedLayout`:

```ts
  | { kind: 'cycle'; stages: { label: string; note?: string }[] }
  | { kind: 'tree'; root: string; branches: { label: string; leaves: string[] }[] }
  | { kind: 'venn'; sets: { label: string; only: string[] }[]; shared: string[] }
  | { kind: 'mindmap'; center: string; nodes: { text: string; role?: 'cause' | 'effect' }[] }
```

Add constants after `MAX_CONCEPT_CHARS`:

```ts
export const MIN_CYCLE_STAGES = 3;
export const MAX_CYCLE_STAGES = 6;
export const MAX_DIAGRAM_LABEL_CHARS = 24;
export const MAX_CYCLE_NOTE_CHARS = 60;
export const MAX_TREE_ROOT_CHARS = 32;
export const MIN_TREE_BRANCHES = 2;
export const MAX_TREE_BRANCHES = 4;
export const MAX_TREE_LEAVES = 4;
export const MAX_VENN_ITEMS = 4;
export const MAX_VENN_ITEM_CHARS = 32;
/** Three circles leave a third of the room per region. */
export const MAX_VENN3_ONLY = 3;
export const MAX_VENN3_SHARED = 2;
export const MAX_VENN3_ITEM_CHARS = 20;
export const MIN_MINDMAP_NODES = 3;
export const MAX_MINDMAP_NODES = 6;
export const MAX_MINDMAP_CHARS = 40;

/** Labels a reader tells apart: no repeats after trimming. */
function distinct(items: string[]): boolean {
  return new Set(items).size === items.length;
}
```

Add these cases before `default:` in `resolveSlideLayout` (`needText` returns the trimmed string or `null`; `needTexts` returns the trimmed list or `null` when any item fails; both already exist in this file):

```ts
    case 'cycle': {
      const raw = slide.cycle?.stages;
      if (!Array.isArray(raw) || raw.length < MIN_CYCLE_STAGES || raw.length > MAX_CYCLE_STAGES) return null;
      const stages: { label: string; note?: string }[] = [];
      for (const s of raw) {
        const label = needText(s?.label, MAX_DIAGRAM_LABEL_CHARS);
        if (label === null) return null;
        const rawNote = s?.note;
        const note = rawNote === undefined || rawNote === null || rawNote === '' ? undefined : needText(rawNote, MAX_CYCLE_NOTE_CHARS);
        if (note === null) return null;
        stages.push({ label, ...(note ? { note } : {}) });
      }
      return distinct(stages.map(s => s.label)) ? { kind: 'cycle', stages } : null;
    }

    case 'tree': {
      const root = needText(slide.tree?.root, MAX_TREE_ROOT_CHARS);
      const raw = slide.tree?.branches;
      if (root === null || !Array.isArray(raw) || raw.length < MIN_TREE_BRANCHES || raw.length > MAX_TREE_BRANCHES) return null;
      const branches: { label: string; leaves: string[] }[] = [];
      for (const b of raw) {
        const label = needText(b?.label, MAX_DIAGRAM_LABEL_CHARS);
        const leaves = b?.leaves === undefined ? [] : needTexts(b.leaves, MAX_DIAGRAM_LABEL_CHARS);
        if (label === null || leaves === null || leaves.length > MAX_TREE_LEAVES || !distinct(leaves)) return null;
        branches.push({ label, leaves });
      }
      return distinct(branches.map(b => b.label)) ? { kind: 'tree', root, branches } : null;
    }

    case 'venn': {
      const raw = slide.venn?.sets;
      if (!Array.isArray(raw) || raw.length < 2 || raw.length > 3) return null;
      const three = raw.length === 3;
      const itemChars = three ? MAX_VENN3_ITEM_CHARS : MAX_VENN_ITEM_CHARS;
      const sets: { label: string; only: string[] }[] = [];
      for (const s of raw) {
        const label = needText(s?.label, MAX_DIAGRAM_LABEL_CHARS);
        const only = needTexts(s?.only ?? [], itemChars);
        if (label === null || only === null || only.length > (three ? MAX_VENN3_ONLY : MAX_VENN_ITEMS)) return null;
        sets.push({ label, only });
      }
      const shared = needTexts(slide.venn?.shared ?? [], itemChars);
      if (shared === null || shared.length > (three ? MAX_VENN3_SHARED : MAX_VENN_ITEMS)) return null;
      if (!distinct(sets.map(s => s.label))) return null;
      if (shared.length === 0 && sets.every(s => s.only.length === 0)) return null;
      return { kind: 'venn', sets, shared };
    }

    case 'mindmap': {
      const center = needText(slide.mindmap?.center, MAX_MINDMAP_CHARS);
      const raw = slide.mindmap?.nodes;
      if (center === null || !Array.isArray(raw) || raw.length < MIN_MINDMAP_NODES || raw.length > MAX_MINDMAP_NODES) return null;
      const nodes: { text: string; role?: 'cause' | 'effect' }[] = [];
      for (const n of raw) {
        const text = needText(n?.text, MAX_MINDMAP_CHARS);
        const role = n?.role;
        if (text === null || (role !== undefined && role !== 'cause' && role !== 'effect')) return null;
        nodes.push({ text, ...(role ? { role } : {}) });
      }
      return distinct(nodes.map(n => n.text)) ? { kind: 'mindmap', center, nodes } : null;
    }
```

Check before writing: read `needTexts` — if it accepts `[]` and returns `[]`, the `only`/`shared` calls above are right; if it returns `null` for an empty list, wrap: `Array.isArray(x) && x.length === 0 ? [] : needTexts(x, n)`.

Extend `PAYLOAD_LAYOUTS` with `'cycle', 'tree', 'venn', 'mindmap'`, `SLIDE_LAYOUTS` the same, and append to `payloadLines` before `return out;`:

```ts
  for (const s of Array.isArray(slide.cycle?.stages) ? slide.cycle!.stages : []) add(s?.label, s?.note);
  if (slide.tree) {
    add(slide.tree.root);
    for (const b of Array.isArray(slide.tree.branches) ? slide.tree.branches : []) add(b?.label, ...(Array.isArray(b?.leaves) ? b.leaves : []));
  }
  if (slide.venn) {
    for (const s of Array.isArray(slide.venn.sets) ? slide.venn.sets : []) add(s?.label, ...(Array.isArray(s?.only) ? s.only : []));
    for (const x of Array.isArray(slide.venn.shared) ? slide.venn.shared : []) add(x);
  }
  if (slide.mindmap) {
    add(slide.mindmap.center);
    for (const n of Array.isArray(slide.mindmap.nodes) ? slide.mindmap.nodes : []) add(n?.text);
  }
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/slideLayout.test.ts`
Expected: PASS. Then `cd /home/user/Iqraa && pnpm --filter ./artifacts/mobile run typecheck` — expected clean (the renderers' `layout.kind` branches fall through to their `null`/ordinary path for unknown kinds; if a `switch` is exhaustive with `never`, add the four kinds returning the ordinary path there for now).

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/slideLayout.ts artifacts/mobile/services/__tests__/slideLayout.test.ts
git commit -m "Slides: cycle, tree, Venn and mind-map layouts — types and gate"
```

---

### Task 2: Diagram geometry (pure) and the tint colour

**Files:**
- Create: `artifacts/mobile/services/diagramGeometry.ts`
- Modify: `artifacts/mobile/services/deckTheme.ts`
- Test: `artifacts/mobile/services/__tests__/diagramGeometry.test.ts`, `artifacts/mobile/services/__tests__/deckTheme.test.ts`

**Interfaces:**
- Consumes: `ResolvedLayout` (Task 1).
- Produces:

```ts
export type DiagramLayout = Extract<ResolvedLayout, { kind: 'cycle' | 'tree' | 'venn' | 'mindmap' }>;
export type Paint = 'card' | 'tint' | 'none';
export type Stroke = 'accent' | 'border';
export type DiagramShape =
  | { t: 'box'; x: number; y: number; w: number; h: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; arrow: boolean; beat: number };
export interface DiagramText { x: number; y: number; w: number; h: number; text: string; size: 'lg' | 'md' | 'sm'; bold: boolean; beat: number }
export interface DiagramGeometry { width: number; height: number; shapes: DiagramShape[]; texts: DiagramText[]; beats: number }
export const ALWAYS = -1;
export const DIAGRAM_W = 960;
export const DIAGRAM_H = 430;
/** Font size per text size, in the same units as `DIAGRAM_W`. */
export const DIAGRAM_FONT = { lg: 26, md: 21, sm: 17 } as const;
export function isDiagram(l: ResolvedLayout | null): l is DiagramLayout;
export function diagramBeats(l: DiagramLayout): number;
export function diagramGeometry(l: DiagramLayout, width: number, height: number, rtl: boolean): DiagramGeometry;
export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): [number, number][];
// deckTheme.ts
export function diagramTint(T: DeckTheme): string; // '#RRGGBB'
```

- [ ] **Step 1: Write the failing tests** (`diagramGeometry.test.ts`)

```ts
/**
 * What this guards: the one set of positions all three renderers draw. A box
 * outside the area is cut off on the projector; two boxes overlapping hide a
 * label; a beat count that disagrees with `pacedBeats` leaves a point hidden.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ALWAYS, diagramBeats, diagramGeometry, isDiagram, arrowHead, DIAGRAM_W, DIAGRAM_H, type DiagramLayout, type DiagramShape } from '../diagramGeometry.ts';

const stages = (n: number) => Array.from({ length: n }, (_, i) => ({ label: `مرحلة ${i + 1}`, note: 'ملاحظة' }));
const LAYOUTS: DiagramLayout[] = [
  ...[3, 4, 5, 6].map(n => ({ kind: 'cycle' as const, stages: stages(n) })),
  ...[2, 3, 4].map(n => ({ kind: 'tree' as const, root: 'الجذر', branches: Array.from({ length: n }, (_, i) => ({ label: `فرع ${i}`, leaves: ['أ', 'ب', 'ج', 'د'] })) })),
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3', '4'] }, { label: 'ب', only: ['5'] }], shared: ['م'] },
  { kind: 'venn', sets: [{ label: 'أ', only: ['1', '2', '3'] }, { label: 'ب', only: ['4'] }, { label: 'ج', only: ['5'] }], shared: ['م', 'ن'] },
  ...[3, 4, 5, 6].map(n => ({ kind: 'mindmap' as const, center: 'الفكرة', nodes: Array.from({ length: n }, (_, i) => ({ text: `فكرة ${i}`, role: i % 2 ? 'cause' as const : 'effect' as const })) })),
];

type Rect = { x: number; y: number; w: number; h: number };
const rectOf = (s: DiagramShape): Rect | null =>
  s.t === 'box' ? { x: s.x, y: s.y, w: s.w, h: s.h }
  : s.t === 'ellipse' ? { x: s.cx - s.rx, y: s.cy - s.ry, w: 2 * s.rx, h: 2 * s.ry }
  : null;
const overlap = (a: Rect, b: Rect) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('diagramGeometry', () => {
  for (const l of LAYOUTS) {
    const tag = `${l.kind}/${JSON.stringify(l).length}`;
    for (const rtl of [false, true]) {
      const g = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, rtl);
      it(`${tag} rtl=${rtl}: everything inside the area`, () => {
        for (const s of g.shapes) {
          const r = rectOf(s);
          if (!r) continue;
          assert.ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= DIAGRAM_W + 0.01 && r.y + r.h <= DIAGRAM_H + 0.01, JSON.stringify(s));
        }
        for (const t of g.texts) assert.ok(t.x >= 0 && t.y >= 0 && t.x + t.w <= DIAGRAM_W + 0.01 && t.y + t.h <= DIAGRAM_H + 0.01, t.text);
      });
      if (l.kind !== 'venn') {
        it(`${tag} rtl=${rtl}: no two boxes overlap`, () => {
          const rects = g.shapes.map(rectOf).filter((r): r is Rect => !!r);
          for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
            assert.ok(!overlap(rects[i]!, rects[j]!), `${i} overlaps ${j}`);
          }
        });
      }
      it(`${tag} rtl=${rtl}: beats agree with diagramBeats, and every beat has something`, () => {
        assert.equal(g.beats, diagramBeats(l));
        for (let b = 0; b < g.beats; b++) assert.ok(g.texts.some(t => t.beat === b) || g.shapes.some(s => s.beat === b), `beat ${b} empty`);
        for (const x of [...g.texts, ...g.shapes]) assert.ok(x.beat === ALWAYS || (x.beat >= 0 && x.beat < g.beats));
      });
    }
  }

  it('mirrors in RTL: the first stage of a cycle goes the other way round', () => {
    const l = LAYOUTS[0]!;
    const ltr = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, false);
    const rtl = diagramGeometry(l, DIAGRAM_W, DIAGRAM_H, true);
    const second = (g: typeof ltr) => g.texts.find(t => t.text === 'مرحلة 2')!;
    assert.ok(second(ltr).x > DIAGRAM_W / 2 && second(rtl).x + second(rtl).w < DIAGRAM_W / 2);
  });

  it('puts every label of the layout on the drawing', () => {
    const g = diagramGeometry(LAYOUTS[4]!, DIAGRAM_W, DIAGRAM_H, true);
    const all = g.texts.map(t => t.text).join('\n');
    for (const w of ['الجذر', 'فرع 0', 'أ', 'د']) assert.ok(all.includes(w), w);
  });

  it('points a cause at the centre and an effect away from it', () => {
    const g = diagramGeometry({ kind: 'mindmap', center: 'c', nodes: [{ text: 'a', role: 'cause' }, { text: 'b', role: 'effect' }, { text: 'n' }] }, DIAGRAM_W, DIAGRAM_H, false);
    const lines = g.shapes.filter((s): s is Extract<DiagramShape, { t: 'line' }> => s.t === 'line');
    const dist = (x: number, y: number) => Math.hypot(x - DIAGRAM_W / 2, y - DIAGRAM_H / 2);
    const cause = lines.find(l => l.beat === 0)!;
    const effect = lines.find(l => l.beat === 1)!;
    const plain = lines.find(l => l.beat === 2)!;
    assert.ok(cause.arrow && dist(cause.x2, cause.y2) < dist(cause.x1, cause.y1));
    assert.ok(effect.arrow && dist(effect.x2, effect.y2) > dist(effect.x1, effect.y1));
    assert.equal(plain.arrow, false);
  });

  it('isDiagram knows exactly the four', () => {
    assert.equal(isDiagram(LAYOUTS[0]!), true);
    assert.equal(isDiagram({ kind: 'flow', nodes: ['a', 'b', 'c'], cycle: false }), false);
    assert.equal(isDiagram(null), false);
  });

  it('arrowHead is a triangle whose tip is the line end', () => {
    const pts = arrowHead(0, 0, 100, 0, 12);
    assert.equal(pts.length, 3);
    assert.deepEqual(pts[0], [100, 0]);
    assert.ok(pts[1]![0] < 100 && pts[2]![0] < 100);
  });
});
```

Append to `deckTheme.test.ts`:

```ts
import { diagramTint } from '../deckTheme.ts';
describe('diagram tint', () => {
  it('carries body text at 4.5:1 in every theme', () => {
    for (const id of DECK_THEME_ORDER) {
      const T = DECK_THEMES[id];
      assert.ok(contrast(T.text, diagramTint(T)) >= 4.5, id);
    }
  });
});
```

(Use the file's existing imports of `DECK_THEMES`, `DECK_THEME_ORDER` and `contrast` from `../readableColor.ts`; add whichever is missing.)

- [ ] **Step 2: Run to verify they fail**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/diagramGeometry.test.ts services/__tests__/deckTheme.test.ts`
Expected: FAIL — module not found / `diagramTint` not exported.

- [ ] **Step 3: Implement `diagramTint`** (`deckTheme.ts`, after `slideTypeAccent`)

```ts
/**
 * The pale fill a diagram's emphasis shape takes (a tree's root, a mind map's
 * centre): the accent at 18% over the card, as a solid colour so PowerPoint,
 * the PDF and the presenter draw the same one. Body text sits on it, so
 * `deckTheme.test.ts` holds it to 4.5:1 against `text` in every theme.
 */
export function diagramTint(T: DeckTheme): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  const mix = (i: number) => Math.round(ch(T.accent, i) * 0.18 + ch(T.card, i) * 0.82);
  return `#${[0, 1, 2].map(i => mix(i).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}
```

- [ ] **Step 4: Implement `diagramGeometry.ts`**

```ts
/**
 * Where every part of a drawn diagram goes — computed once, drawn three times.
 *
 * The presenter, the PDF and PowerPoint each draw a `DiagramGeometry`: boxes,
 * ellipses and straight connectors, plus text boxes the renderer fills with real
 * text (never rasterised, so Arabic shapes and bidi isolation still apply). One
 * set of positions is why a cycle looks the same projected, printed and in
 * PowerPoint. Units are whatever the caller passes (`DIAGRAM_W` × `DIAGRAM_H`
 * for the screen and the PDF, inches for PowerPoint); the shapes scale with them.
 *
 * `beat` says when a part appears under «نقطة بنقطة»: `ALWAYS` (-1) is drawn
 * from the start (a tree's root, a mind map's centre), 0.. are revealed in
 * order. `diagramBeats` is the count, and `pacedBeats` uses it.
 *
 * Pure and react-free so `node --test` can load it.
 */
import type { ResolvedLayout } from './slideLayout.ts';

export type DiagramLayout = Extract<ResolvedLayout, { kind: 'cycle' | 'tree' | 'venn' | 'mindmap' }>;
export type Paint = 'card' | 'tint' | 'none';
export type Stroke = 'accent' | 'border';
export type DiagramShape =
  | { t: 'box'; x: number; y: number; w: number; h: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'ellipse'; cx: number; cy: number; rx: number; ry: number; fill: Paint; stroke: Stroke; beat: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; arrow: boolean; beat: number };
export interface DiagramText { x: number; y: number; w: number; h: number; text: string; size: 'lg' | 'md' | 'sm'; bold: boolean; beat: number }
export interface DiagramGeometry { width: number; height: number; shapes: DiagramShape[]; texts: DiagramText[]; beats: number }

export const ALWAYS = -1;
export const DIAGRAM_W = 960;
export const DIAGRAM_H = 430;
export const DIAGRAM_FONT = { lg: 26, md: 21, sm: 17 } as const;

export function isDiagram(l: ResolvedLayout | null): l is DiagramLayout {
  return !!l && (l.kind === 'cycle' || l.kind === 'tree' || l.kind === 'venn' || l.kind === 'mindmap');
}

export function diagramBeats(l: DiagramLayout): number {
  switch (l.kind) {
    case 'cycle': return l.stages.length;
    case 'tree': return l.branches.length;
    case 'venn': return l.sets.length + 1;
    case 'mindmap': return l.nodes.length;
  }
}

type Pt = { x: number; y: number };
type Half = { hw: number; hh: number; round: boolean };

/** The connector between two shapes, cut back to their outlines plus a small gap. */
function connect(a: Pt, ah: Half, b: Pt, bh: Half, gap: number): { x1: number; y1: number; x2: number; y2: number } {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const exit = (h: Half) => (h.round
    ? 1 / Math.hypot(dx / h.hw, dy / h.hh)
    : Math.min(dx ? h.hw / Math.abs(dx) : Infinity, dy ? h.hh / Math.abs(dy) : Infinity));
  const s1 = exit(ah) + gap / len;
  const s2 = exit(bh) + gap / len;
  return { x1: a.x + dx * s1, y1: a.y + dy * s1, x2: b.x - dx * s2, y2: b.y - dy * s2 };
}

export function arrowHead(x1: number, y1: number, x2: number, y2: number, size: number): [number, number][] {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const wing = (s: number): [number, number] => [x2 - size * Math.cos(a + s), y2 - size * Math.sin(a + s)];
  return [[x2, y2], wing(0.45), wing(-0.45)];
}

/** Positions on an ellipse starting at 12 o'clock, clockwise LTR, counter-clockwise RTL. */
function ring(n: number, cx: number, cy: number, rx: number, ry: number, rtl: boolean): Pt[] {
  const dir = rtl ? -1 : 1;
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (dir * 2 * Math.PI * i) / n;
    return { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) };
  });
}

export function diagramGeometry(l: DiagramLayout, width: number, height: number, rtl: boolean): DiagramGeometry {
  const W = width;
  const H = height;
  const pad = W * 0.025;
  const gap = W * 0.006;
  const shapes: DiagramShape[] = [];
  const texts: DiagramText[] = [];
  const box = (x: number, y: number, w: number, h: number, fill: Paint, stroke: Stroke, beat: number) =>
    shapes.push({ t: 'box', x, y, w, h, fill, stroke, beat });
  const text = (x: number, y: number, w: number, h: number, t: string, size: DiagramText['size'], bold: boolean, beat: number) =>
    texts.push({ x, y, w, h, text: t, size, bold, beat });

  switch (l.kind) {
    case 'cycle': {
      const n = l.stages.length;
      const bw = W * (n >= 5 ? 0.22 : 0.26);
      const bh = H * 0.2;
      const centres = ring(n, W / 2, H / 2, W / 2 - bw / 2 - pad, H / 2 - bh / 2 - pad, rtl);
      const half: Half = { hw: bw / 2, hh: bh / 2, round: false };
      centres.forEach((c, i) => {
        const s = l.stages[i]!;
        const x = c.x - bw / 2;
        const y = c.y - bh / 2;
        box(x, y, bw, bh, 'card', 'accent', i);
        if (s.note) {
          text(x + 6, y + 4, bw - 12, bh * 0.5, s.label, 'md', true, i);
          text(x + 6, y + bh * 0.5, bw - 12, bh * 0.5 - 4, s.note, 'sm', false, i);
        } else {
          text(x + 6, y + 4, bw - 12, bh - 8, s.label, 'md', true, i);
        }
        const next = centres[(i + 1) % n]!;
        shapes.push({ t: 'line', ...connect(c, half, next, half, gap), arrow: true, beat: i === n - 1 ? n - 1 : i + 1 });
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }

    case 'tree': {
      const n = l.branches.length;
      const colGap = W * 0.02;
      const rootW = W * 0.34;
      const rootH = H * 0.17;
      const rootY = pad * 0.5;
      box((W - rootW) / 2, rootY, rootW, rootH, 'tint', 'accent', ALWAYS);
      text((W - rootW) / 2 + 6, rootY + 4, rootW - 12, rootH - 8, l.root, 'lg', true, ALWAYS);
      const bw = (W - 2 * pad - colGap * (n - 1)) / n;
      const bh = H * 0.15;
      const by = H * 0.33;
      const maxLeaves = Math.max(0, ...l.branches.map(b => b.leaves.length));
      const leafTop = by + bh + H * 0.05;
      const leafGap = H * 0.025;
      const leafH = maxLeaves ? Math.min(H * 0.12, (H - pad * 0.5 - leafTop - leafGap * (maxLeaves - 1)) / maxLeaves) : 0;
      l.branches.forEach((b, i) => {
        const col = rtl ? n - 1 - i : i;
        const x = pad + col * (bw + colGap);
        shapes.push({ t: 'line', x1: W / 2, y1: rootY + rootH, x2: x + bw / 2, y2: by, arrow: false, beat: i });
        box(x, by, bw, bh, 'card', 'accent', i);
        text(x + 6, by + 4, bw - 12, bh - 8, b.label, 'md', true, i);
        if (b.leaves.length) shapes.push({ t: 'line', x1: x + bw / 2, y1: by + bh, x2: x + bw / 2, y2: leafTop, arrow: false, beat: i });
        b.leaves.forEach((leaf, j) => {
          const ly = leafTop + j * (leafH + leafGap);
          box(x + bw * 0.08, ly, bw * 0.84, leafH, 'card', 'border', i);
          text(x + bw * 0.08 + 4, ly + 2, bw * 0.84 - 8, leafH - 4, leaf, 'sm', false, i);
        });
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }

    case 'venn': {
      const n = l.sets.length;
      const order = (i: number) => (rtl && n === 2 ? 1 - i : i);
      if (n === 2) {
        const r = Math.min(H / 2 - pad, W * 0.25);
        const cy = H / 2;
        l.sets.forEach((s, i) => {
          const side = order(i) === 0 ? -1 : 1;
          const cx = W / 2 + side * r * 0.62;
          shapes.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: 'none', stroke: 'accent', beat: i });
          text(cx - r * 0.75, cy - r * 0.9, r * 1.5, r * 0.3, s.label, 'lg', true, i);
          const ex = cx + side * r * 0.42;
          if (s.only.length) text(ex - r * 0.4, cy - r * 0.45, r * 0.8, r * 1.0, s.only.join('\n'), 'sm', false, i);
        });
        if (l.shared.length) text(W / 2 - r * 0.3, cy - r * 0.45, r * 0.6, r * 1.0, l.shared.join('\n'), 'sm', true, n);
        return { width: W, height: H, shapes, texts, beats: n + 1 };
      }
      const r = H * 0.29;
      const cxs = [W / 2 - r * 0.6, W / 2 + r * 0.6, W / 2];
      const cys = [H / 2 - r * 0.35, H / 2 - r * 0.35, H / 2 + r * 0.62];
      l.sets.forEach((s, i) => {
        const at = rtl && i < 2 ? 1 - i : i;
        const cx = cxs[at]!;
        const cy = cys[at]!;
        shapes.push({ t: 'ellipse', cx, cy, rx: r, ry: r, fill: 'none', stroke: 'accent', beat: i });
        if (at === 2) {
          text(cx - r * 0.45, cy + r * 0.62, r * 0.9, r * 0.28, s.label, 'md', true, i);
          if (s.only.length) text(cx - r * 0.42, cy + r * 0.12, r * 0.84, r * 0.48, s.only.join('\n'), 'sm', false, i);
        } else {
          const side = at === 0 ? -1 : 1;
          text(cx + side * r * 0.5 - r * 0.45, cy - r * 0.85, r * 0.9, r * 0.28, s.label, 'md', true, i);
          if (s.only.length) text(cx + side * r * 0.45 - r * 0.4, cy - r * 0.5, r * 0.8, r * 0.6, s.only.join('\n'), 'sm', false, i);
        }
      });
      if (l.shared.length) text(W / 2 - r * 0.3, H / 2 - r * 0.15, r * 0.6, r * 0.38, l.shared.join('\n'), 'sm', true, n);
      return { width: W, height: H, shapes, texts, beats: n + 1 };
    }

    case 'mindmap': {
      const n = l.nodes.length;
      const crx = W * 0.15;
      const cry = H * 0.17;
      const centre = { x: W / 2, y: H / 2 };
      shapes.push({ t: 'ellipse', cx: centre.x, cy: centre.y, rx: crx, ry: cry, fill: 'tint', stroke: 'accent', beat: ALWAYS });
      text(centre.x - crx * 0.8, centre.y - cry * 0.7, crx * 1.6, cry * 1.4, l.center, 'lg', true, ALWAYS);
      const nw = W * 0.22;
      const nh = H * 0.17;
      const pts = ring(n, centre.x, centre.y, W / 2 - nw / 2 - pad, H / 2 - nh / 2 - pad, rtl);
      const ch: Half = { hw: crx, hh: cry, round: true };
      const nhf: Half = { hw: nw / 2, hh: nh / 2, round: false };
      pts.forEach((p, i) => {
        const node = l.nodes[i]!;
        const seg = node.role === 'cause' ? connect(p, nhf, centre, ch, gap) : connect(centre, ch, p, nhf, gap);
        shapes.push({ t: 'line', ...seg, arrow: !!node.role, beat: i });
        box(p.x - nw / 2, p.y - nh / 2, nw, nh, 'card', 'accent', i);
        text(p.x - nw / 2 + 6, p.y - nh / 2 + 4, nw - 12, nh - 8, node.text, 'md', false, i);
      });
      return { width: W, height: H, shapes, texts, beats: n };
    }
  }
}
```

Note: the Venn test skips the overlap check (circles overlap by design); the bounds test still applies. If a bounds or overlap assertion fails for a size, adjust that kind's fractions (not the test) and re-run.

- [ ] **Step 5: Run to verify they pass**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/diagramGeometry.test.ts services/__tests__/deckTheme.test.ts`
Expected: PASS. If `diagramTint` fails 4.5:1 for a theme, lower the mix from 0.18 (try 0.14) and update its comment.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/diagramGeometry.ts artifacts/mobile/services/deckTheme.ts artifacts/mobile/services/__tests__/diagramGeometry.test.ts artifacts/mobile/services/__tests__/deckTheme.test.ts
git commit -m "Slides: one geometry for drawn diagrams, and the diagram tint"
```

---

### Task 3: PDF/HTML renderer

**Files:**
- Create: `artifacts/mobile/services/diagramHtml.ts`
- Modify: `artifacts/mobile/services/deckSlidesHtml.ts` (`layoutSlide`, near the `flow` branch, line ~538; CSS block near line 745)
- Test: `artifacts/mobile/services/__tests__/diagramHtml.test.ts`, `artifacts/mobile/services/__tests__/deckSlidesHtml.test.ts`

**Interfaces:**
- Consumes: `diagramGeometry`, `DIAGRAM_W`, `DIAGRAM_H`, `DIAGRAM_FONT`, `arrowHead`, `ALWAYS` (Task 2); `diagramTint` (Task 2).
- Produces: `export function diagramHtml(g: DiagramGeometry, colors: DiagramColors, rtl: boolean, escape: (s: string) => string): string` and `export interface DiagramColors { card: string; tint: string; accent: string; border: string; text: string }`.

- [ ] **Step 1: Write the failing test** (`diagramHtml.test.ts`)

```ts
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { diagramHtml } from '../diagramHtml.ts';
import { diagramGeometry, DIAGRAM_W, DIAGRAM_H } from '../diagramGeometry.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const C = { card: '#FFFFFF', tint: '#E0F0F0', accent: '#1E8E8E', border: '#EFDCD4', text: '#22303C' };

describe('diagramHtml', () => {
  const g = diagramGeometry({ kind: 'cycle', stages: [{ label: 'تبخر' }, { label: 'تكاثف' }, { label: 'هطول <x>' }] }, DIAGRAM_W, DIAGRAM_H, true);
  const html = diagramHtml(g, C, true, esc);
  it('draws every shape and every label as real text', () => {
    assert.equal((html.match(/<rect /g) ?? []).length, 3);
    assert.equal((html.match(/<line /g) ?? []).length, 3);
    assert.equal((html.match(/<polygon /g) ?? []).length, 3);
    for (const w of ['تبخر', 'تكاثف']) assert.ok(html.includes(w));
  });
  it('escapes labels and sets the reading direction on the text', () => {
    assert.ok(html.includes('هطول &lt;x>'));
    assert.ok(!html.includes('<x>'));
    assert.match(html, /direction:rtl/);
  });
  it('uses the theme colours, never a hard-coded one', () => {
    assert.match(html, /stroke="#1E8E8E"/);
    assert.match(html, /fill="#FFFFFF"/);
  });
});
```

Append to `deckSlidesHtml.test.ts` (use that file's existing deck/slide helpers and its HTML builder; the call below names the builder the file already imports — keep its name):

```ts
it('draws a cycle slide as a diagram, and a refused one as its words', () => {
  const ok = { slideNumber: 2, type: 'intro' as const, title: 'دورة الماء', content: 'الماء يدور', durationSeconds: 0,
    layout: 'cycle' as const, cycle: { stages: [{ label: 'تبخر' }, { label: 'تكاثف' }, { label: 'هطول' }] } };
  const html = buildHtml([ok]);
  assert.match(html, /class="deck-diagram"/);
  const thin = { ...ok, cycle: { stages: [{ label: 'تبخر' }] } };
  assert.doesNotMatch(buildHtml([thin]), /class="deck-diagram"/);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/diagramHtml.test.ts services/__tests__/deckSlidesHtml.test.ts`
Expected: FAIL — module not found; the deck test has no `deck-diagram`.

- [ ] **Step 3: Implement `diagramHtml.ts`**

```ts
/**
 * A drawn diagram for the PDF: the shapes as inline SVG, the labels as HTML
 * text over them. Text stays text — the print engine shapes Arabic and wraps
 * a long label inside its box, which SVG <text> would do neither of.
 *
 * Sized for the A4-landscape deck slide (`.deck-slide` is 297mm wide, the body
 * pads 48px a side): the drawing is `PX_W` pixels wide, and every position and
 * font size is the geometry's own unit scaled by `PX_W / width`.
 */
import { ALWAYS, arrowHead, DIAGRAM_FONT, type DiagramGeometry, type Paint } from './diagramGeometry.ts';

export interface DiagramColors { card: string; tint: string; accent: string; border: string; text: string }

const PX_W = 1000;

export function diagramHtml(g: DiagramGeometry, c: DiagramColors, rtl: boolean, escape: (s: string) => string): string {
  const k = PX_W / g.width;
  const pxH = Math.round(g.height * k);
  const fill = (p: Paint) => (p === 'none' ? 'none' : p === 'tint' ? c.tint : c.card);
  const stroke = (s: 'accent' | 'border') => (s === 'accent' ? c.accent : c.border);
  const n = (v: number) => (v * k).toFixed(1);
  const shapes = g.shapes.map(s => {
    if (s.t === 'box') {
      return `<rect x="${n(s.x)}" y="${n(s.y)}" width="${n(s.w)}" height="${n(s.h)}" rx="${n(10)}" fill="${fill(s.fill)}" stroke="${stroke(s.stroke)}" stroke-width="2.5"/>`;
    }
    if (s.t === 'ellipse') {
      return `<ellipse cx="${n(s.cx)}" cy="${n(s.cy)}" rx="${n(s.rx)}" ry="${n(s.ry)}" fill="${fill(s.fill)}" stroke="${stroke(s.stroke)}" stroke-width="3"/>`;
    }
    const line = `<line x1="${n(s.x1)}" y1="${n(s.y1)}" x2="${n(s.x2)}" y2="${n(s.y2)}" stroke="${c.accent}" stroke-width="3"/>`;
    if (!s.arrow) return line;
    const pts = arrowHead(s.x1 * k, s.y1 * k, s.x2 * k, s.y2 * k, 14).map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    return `${line}<polygon points="${pts}" fill="${c.accent}"/>`;
  }).join('');
  const labels = g.texts.map(t => `<div class="deck-diagram-text" style="left:${n(t.x)}px;top:${n(t.y)}px;width:${n(t.w)}px;height:${n(t.h)}px;font-size:${n(DIAGRAM_FONT[t.size])}px;font-weight:${t.bold ? 700 : 400};color:${c.text};direction:${rtl ? 'rtl' : 'ltr'}">${escape(t.text).replace(/\n/g, '<br>')}</div>`).join('');
  void ALWAYS;
  return `<div class="deck-diagram" style="width:${PX_W}px;height:${pxH}px"><svg width="${PX_W}" height="${pxH}" viewBox="0 0 ${PX_W} ${pxH}">${shapes}</svg>${labels}</div>`;
}
```

(Remove the `void ALWAYS;` line and the `ALWAYS` import if the linter or typecheck flags them unused — the PDF draws every beat.)

- [ ] **Step 4: Wire it into `deckSlidesHtml.ts`**

Add imports:

```ts
import { diagramGeometry, DIAGRAM_H, DIAGRAM_W, isDiagram } from './diagramGeometry.ts';
import { diagramHtml } from './diagramHtml.ts';
import { diagramTint } from './deckTheme.ts';
```

In `layoutSlide`, before `if (layout.kind === 'flow') {`:

```ts
    if (isDiagram(layout)) {
      const g = diagramGeometry(layout, DIAGRAM_W, DIAGRAM_H, isAr);
      return `<div class="deck-slide">
      ${deckHeader(slide.title, accent, slide.icon)}
      <div class="deck-body deck-diagram-body">
        ${diagramHtml(g, { card: T.card, tint: diagramTint(T), accent, border: T.border, text: T.text }, isAr, esc)}
      </div>
      ${footer(num)}</div>`;
    }
```

(`isAr` — use whatever the file's `layoutSlide` closure already uses for direction; read the surrounding function and use that name, e.g. the `L`-helper's flag.)

Add CSS next to `.deck-flow-row`:

```css
.deck-diagram-body { align-items:center; justify-content:center; }
.deck-diagram { position:relative; margin:0 auto; }
.deck-diagram svg { position:absolute; inset:0; }
.deck-diagram-text { position:absolute; display:flex; align-items:center; justify-content:center; text-align:center; line-height:1.25; overflow:hidden; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/diagramHtml.test.ts services/__tests__/deckSlidesHtml.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/diagramHtml.ts artifacts/mobile/services/deckSlidesHtml.ts artifacts/mobile/services/__tests__/diagramHtml.test.ts artifacts/mobile/services/__tests__/deckSlidesHtml.test.ts
git commit -m "Slides: the PDF draws cycle, tree, Venn and mind-map slides"
```

---

### Task 4: PowerPoint renderer

**Files:**
- Create: `artifacts/mobile/services/pptxDiagram.ts`
- Modify: `artifacts/mobile/services/exportPptx.ts` (layout branch, before `if (layout.kind === 'flow')` near line 499)
- Test: `artifacts/mobile/services/__tests__/pptxDiagram.test.ts`

**Interfaces:**
- Consumes: Task 2 exports.
- Produces: `export function drawPptxDiagram(s: PptxSlideLike, g: DiagramGeometry, colors: PptxDiagramColors, opts: { x: number; y: number; rtl: boolean; font: string }): void` with
  `PptxSlideLike = { addShape(type: string, o: Record<string, unknown>): unknown; addText(text: string, o: Record<string, unknown>): unknown }` and `PptxDiagramColors` = hex strings **without** `#`: `{ card; tint; accent; border; text }`.

- [ ] **Step 1: Write the failing test**

```ts
/**
 * What this guards: the PowerPoint drawing is native shapes and text boxes (so
 * a teacher can edit a label), placed where the shared geometry says, inside
 * the 10 × 5.63 in slide.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { drawPptxDiagram } from '../pptxDiagram.ts';
import { diagramGeometry } from '../diagramGeometry.ts';

function fakeSlide() {
  const calls: { kind: 'shape' | 'text'; type?: string; text?: string; o: Record<string, unknown> }[] = [];
  return {
    calls,
    addShape(type: string, o: Record<string, unknown>) { calls.push({ kind: 'shape', type, o }); },
    addText(text: string, o: Record<string, unknown>) { calls.push({ kind: 'text', text, o }); },
  };
}
const C = { card: 'FFFFFF', tint: 'E0F0F0', accent: '1E8E8E', border: 'EFDCD4', text: '22303C' };

describe('drawPptxDiagram', () => {
  const g = diagramGeometry({ kind: 'mindmap', center: 'التلوث', nodes: [{ text: 'المصانع', role: 'cause' }, { text: 'أمراض', role: 'effect' }, { text: 'حلول' }] }, 8.9, 3.99, true);
  const s = fakeSlide();
  drawPptxDiagram(s, g, C, { x: 0.55, y: 1.35, rtl: true, font: 'Readex Pro' });
  it('draws native shapes: one ellipse, three boxes, three lines', () => {
    const types = s.calls.filter(c => c.kind === 'shape').map(c => c.type);
    assert.equal(types.filter(t => t === 'ellipse').length, 1);
    assert.equal(types.filter(t => t === 'roundRect').length, 3);
    assert.equal(types.filter(t => t === 'line').length, 3);
  });
  it('puts an arrowhead only on the cause and the effect', () => {
    const lines = s.calls.filter(c => c.type === 'line');
    assert.equal(lines.filter(l => (l.o.line as { endArrowType?: string }).endArrowType === 'triangle').length, 2);
  });
  it('labels are editable text boxes, right-aligned reading order in Arabic, inside the slide', () => {
    const texts = s.calls.filter(c => c.kind === 'text');
    assert.deepEqual(texts.map(t => t.text).sort(), ['أمراض', 'التلوث', 'المصانع', 'حلول'].sort());
    for (const t of texts) {
      const { x, y, w, h, rtlMode } = t.o as { x: number; y: number; w: number; h: number; rtlMode: boolean };
      assert.equal(rtlMode, true);
      assert.ok(x >= 0 && y >= 0 && x + w <= 10 && y + h <= 5.63);
    }
  });
  it('draws a line with a negative extent as a flipped box, as pptxgenjs needs', () => {
    for (const l of s.calls.filter(c => c.type === 'line')) {
      const o = l.o as { w: number; h: number };
      assert.ok(o.w >= 0 && o.h >= 0);
    }
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/pptxDiagram.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `pptxDiagram.ts`**

```ts
/**
 * A drawn diagram in PowerPoint: native ellipses, rounded boxes and lines, and
 * a text box per label, so a teacher can move a stage or fix a word. Positions
 * come from `diagramGeometry`, built in inches for the area this draws into.
 *
 * Kept apart from `exportPptx.ts` (which imports react-native and expo) so the
 * bare `node --test` runner can check it with a fake slide.
 *
 * A line in pptxgenjs is a box from (x, y) of size (w, h) drawn corner to
 * corner; a line that runs left or up is the same box flipped (`flipH`/`flipV`).
 */
import type { DiagramGeometry, Paint } from './diagramGeometry.ts';

export interface PptxSlideLike {
  addShape(type: string, o: Record<string, unknown>): unknown;
  addText(text: string, o: Record<string, unknown>): unknown;
}
export interface PptxDiagramColors { card: string; tint: string; accent: string; border: string; text: string }

/** Points per text size; the slide is 10 in wide, the drawing 8.9. */
const PT = { lg: 16, md: 13, sm: 11 } as const;

export function drawPptxDiagram(
  s: PptxSlideLike,
  g: DiagramGeometry,
  c: PptxDiagramColors,
  opts: { x: number; y: number; rtl: boolean; font: string },
): void {
  const fill = (p: Paint) => (p === 'none' ? { type: 'none' } : { color: p === 'tint' ? c.tint : c.card });
  for (const sh of g.shapes) {
    if (sh.t === 'box') {
      s.addShape('roundRect', {
        x: opts.x + sh.x, y: opts.y + sh.y, w: sh.w, h: sh.h, rectRadius: 0.12,
        fill: fill(sh.fill), line: { color: sh.stroke === 'accent' ? c.accent : c.border, width: 1.75 },
      });
    } else if (sh.t === 'ellipse') {
      s.addShape('ellipse', {
        x: opts.x + sh.cx - sh.rx, y: opts.y + sh.cy - sh.ry, w: 2 * sh.rx, h: 2 * sh.ry,
        fill: fill(sh.fill), line: { color: sh.stroke === 'accent' ? c.accent : c.border, width: 2.25 },
      });
    } else {
      const x = Math.min(sh.x1, sh.x2);
      const y = Math.min(sh.y1, sh.y2);
      s.addShape('line', {
        x: opts.x + x, y: opts.y + y, w: Math.abs(sh.x2 - sh.x1), h: Math.abs(sh.y2 - sh.y1),
        flipH: sh.x2 < sh.x1, flipV: sh.y2 < sh.y1,
        line: { color: c.accent, width: 2, ...(sh.arrow ? { endArrowType: 'triangle' } : {}) },
      });
    }
  }
  for (const t of g.texts) {
    s.addText(t.text, {
      x: opts.x + t.x, y: opts.y + t.y, w: t.w, h: t.h, align: 'center', valign: 'middle',
      fontSize: PT[t.size], bold: t.bold, color: c.text, fontFace: opts.font, rtlMode: opts.rtl, fit: 'shrink',
    });
  }
}
```

- [ ] **Step 4: Wire into `exportPptx.ts`**

Imports:

```ts
import { diagramGeometry, isDiagram } from './diagramGeometry.ts';
import { drawPptxDiagram } from './pptxDiagram.ts';
```

Before `if (layout.kind === 'flow') {` in the layout branch:

```ts
      if (isDiagram(layout)) {
        const g = diagramGeometry(layout, 8.9, 3.99, isAr);
        drawPptxDiagram(s, g, {
          card: P.card, tint: theme.pptxHex(theme.diagramTint(T)), accent, border: P.border, text: P.text,
        }, { x: 0.55, y: 1.35, rtl: isAr, font: HEAD_FONT });
        continue;
      }
```

(Read the flow branch first: the heading for layout slides is drawn before these branches — confirm `y: 1.35` sits under it, and match the flow branch's use of `accent`.)

- [ ] **Step 5: Run to verify**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/pptxDiagram.test.ts && cd /home/user/Iqraa && pnpm --filter ./artifacts/mobile run typecheck`
Expected: PASS, clean.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/pptxDiagram.ts artifacts/mobile/services/exportPptx.ts artifacts/mobile/services/__tests__/pptxDiagram.test.ts
git commit -m "Slides: PowerPoint draws the four diagrams as editable shapes"
```

---

### Task 5: Presenter view and paced reveal

**Files:**
- Modify: `artifacts/mobile/app/ai-tools/classroom/presentation.tsx` (new `DiagramView` near `StatsRowView`; call in `SlideView`'s layout branch next to `layout.kind === 'timeline'`)
- Modify: `artifacts/mobile/services/pacedReveal.ts`
- Test: `artifacts/mobile/services/__tests__/pacedReveal.test.ts`

**Interfaces:**
- Consumes: Task 2 (`diagramGeometry`, `diagramBeats`, `isDiagram`, `ALWAYS`, `DIAGRAM_W`, `DIAGRAM_H`, `DIAGRAM_FONT`, `arrowHead`), `diagramTint`, `Reveal` and `ThemeContext` already in `presentation.tsx`.
- Produces: `pacedBeats` returns `range(diagramBeats(layout))` for the four kinds.

- [ ] **Step 1: Write the failing tests** (append to `pacedReveal.test.ts`)

```ts
describe('paced diagrams', () => {
  it('reveals a cycle stage by stage, a Venn set by set then the shared part', () => {
    const cyc = slide({ layout: 'cycle', cycle: { stages: [{ label: 'a' }, { label: 'b' }, { label: 'c' }] } });
    assert.deepEqual(pacedBeats(cyc), [0, 1, 2]);
    const venn = slide({ layout: 'venn', venn: { sets: [{ label: 'a', only: ['x'] }, { label: 'b', only: [] }], shared: ['s'] } });
    assert.deepEqual(pacedBeats(venn), [0, 1, 2]);
  });
});

describe('the presenter draws diagrams', () => {
  const src = readFileSync(
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app', 'ai-tools', 'classroom', 'presentation.tsx'),
    'utf8',
  );
  it('from the shared geometry, each beat inside a Reveal, labels as Text', () => {
    const view = src.slice(src.indexOf('function DiagramView('), src.indexOf('function LayoutHeading('));
    assert.ok(view.length > 200, 'DiagramView not found before LayoutHeading');
    assert.match(view, /diagramGeometry\(/);
    assert.match(view, /<Reveal key=\{b\} index=\{b\}/);
    assert.match(view, /isolateForeignRuns\(/);
    assert.match(src, /isDiagram\(layout\) && <DiagramView/);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/pacedReveal.test.ts`
Expected: FAIL.

- [ ] **Step 3: `pacedReveal.ts`**

Import `import { diagramBeats, isDiagram } from './diagramGeometry.ts';` and in `beatsFor`, first line inside `if (layout) {`:

```ts
    if (isDiagram(layout)) return range(diagramBeats(layout));
```

- [ ] **Step 4: `DiagramView` in `presentation.tsx`**

Imports (with the other `@/services` imports): `import { ALWAYS, arrowHead, DIAGRAM_FONT, DIAGRAM_H, DIAGRAM_W, diagramGeometry, isDiagram, type DiagramLayout, type DiagramShape } from '@/services/diagramGeometry';` and add `diagramTint` to the existing `deckTheme` import. `Polygon` and `Line`, `Ellipse` must be added to the existing `react-native-svg` import if absent (check the import line).

Place before `function LayoutHeading(`:

```tsx
/**
 * A cycle, tree, Venn or mind map, drawn from `diagramGeometry` — the same
 * positions the PDF and PowerPoint use. Each beat is its own full-size layer
 * (an Svg for its shapes and positioned Text for its labels) inside a `Reveal`,
 * so «نقطة بنقطة» brings a stage or a branch in on the teacher's press; the
 * `ALWAYS` layer (a tree's root, a mind map's centre) is there from the start.
 * Labels are Text, not SVG text, so `isolateForeignRuns` keeps maths and Latin
 * runs whole inside Arabic on the web, as everywhere else in the deck.
 */
function DiagramView({ layout, accent, isRTL }: { layout: DiagramLayout; accent: string; isRTL: boolean }) {
  const T = useContext(ThemeContext);
  const [w, setW] = useState(0);
  const g = diagramGeometry(layout, DIAGRAM_W, DIAGRAM_H, isRTL);
  const k = w / DIAGRAM_W;
  const fill = (p: 'card' | 'tint' | 'none') => (p === 'none' ? 'none' : p === 'tint' ? diagramTint(T) : T.card);
  const shape = (s: DiagramShape, i: number) => {
    if (s.t === 'box') return <Rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={10} fill={fill(s.fill)} stroke={s.stroke === 'accent' ? accent : T.border} strokeWidth={2.5} />;
    if (s.t === 'ellipse') return <Ellipse key={i} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} fill={fill(s.fill)} stroke={s.stroke === 'accent' ? accent : T.border} strokeWidth={3} />;
    return (
      <G key={i}>
        <Line x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={accent} strokeWidth={3} />
        {s.arrow ? <Polygon points={arrowHead(s.x1, s.y1, s.x2, s.y2, 14).map(p => p.join(',')).join(' ')} fill={accent} /> : null}
      </G>
    );
  };
  const layer = (beat: number) => (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg viewBox={`0 0 ${DIAGRAM_W} ${DIAGRAM_H}`} width="100%" height="100%">
        {g.shapes.filter(s => s.beat === beat).map(shape)}
      </Svg>
      {k > 0 && g.texts.filter(t => t.beat === beat).map((t, i) => (
        <View
          key={i}
          style={{ position: 'absolute', left: t.x * k, top: t.y * k, width: t.w * k, height: t.h * k, justifyContent: 'center' }}
        >
          <Text
            style={{
              fontSize: DIAGRAM_FONT[t.size] * k, lineHeight: DIAGRAM_FONT[t.size] * k * 1.25, textAlign: 'center',
              writingDirection: isRTL ? 'rtl' : 'ltr', color: T.text,
              fontFamily: t.bold ? 'ReadexPro_700Bold' : 'Almarai_400Regular',
            }}
          >
            {isolateForeignRuns(t.text)}
          </Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ width: '100%', aspectRatio: DIAGRAM_W / DIAGRAM_H }} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {layer(ALWAYS)}
      {Array.from({ length: g.beats }, (_, b) => (
        <Reveal key={b} index={b} style={StyleSheet.absoluteFill}>{layer(b)}</Reveal>
      ))}
    </View>
  );
}
```

In `SlideView`'s layout branch, next to the other `{layout.kind === … && (` blocks inside the `slideStyles.cover` view, add:

```tsx
        {isDiagram(layout) && <DiagramView layout={layout} accent={accent} isRTL={isRTL} />}
```

preceded by the same `<LayoutHeading heading={heading} icon={headIcon} accent={accent} isRTL={isRTL} />` the timeline branch uses (wrap both in a fragment with the `isDiagram(layout) &&` guard; keep the exact substring `isDiagram(layout) && <DiagramView` for the test, e.g. put the heading inside DiagramView's caller as a separate `{isDiagram(layout) && <LayoutHeading … />}` line above it).

- [ ] **Step 5: Run to verify**

Run: `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/pacedReveal.test.ts services/__tests__/presenterMotion.test.ts && cd /home/user/Iqraa && pnpm --filter ./artifacts/mobile run typecheck`
Expected: PASS; typecheck clean. `presenterMotion.test.ts` pins `Reveal`; if it counts `<Reveal` uses against a list, add `DiagramView` to that list.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/app/ai-tools/classroom/presentation.tsx artifacts/mobile/services/pacedReveal.ts artifacts/mobile/services/__tests__/pacedReveal.test.ts
git commit -m "Slides: the presenter draws the four diagrams, revealed beat by beat"
```

---

### Task 6: Prompt Slides learns the diagrams (API + polish)

**Files:**
- Modify: `artifacts/api-server/src/lib/promptSlidesPrompt.ts` (`DECK_LAYOUT_NAMES`; the layout list in both prompts — after the `"flow"` bullet)
- Modify: `artifacts/api-server/src/lib/deckChecks.ts`
- Modify: `artifacts/mobile/services/promptSlidesPolish.ts`
- Test: `artifacts/api-server/src/lib/__tests__/promptSlidesPrompt.test.ts`, `artifacts/api-server/src/lib/__tests__/deckChecks.test.ts`, `artifacts/mobile/services/__tests__/promptSlidesPolish.test.ts`

**Interfaces:**
- Consumes: Task 1 field names and limits.
- Produces: the model may return `layout` ∈ {cycle, tree, venn, mindmap} with payloads `cycle`, `tree`, `venn`, `mindmap`.

- [ ] **Step 1: Failing tests**

`promptSlidesPrompt.test.ts`:

```ts
describe("diagram layouts", () => {
  for (const [label, build] of BOTH) {
    const prompt = build(baseBody);
    it(`${label}: describes cycle, tree, venn and mindmap with their JSON`, () => {
      for (const k of ['"cycle"', '"tree"', '"venn"', '"mindmap"', '"stages"', '"branches"', '"shared"', '"nodes"']) {
        assert.ok(prompt.includes(k), k);
      }
    });
    it(`${label}: says when each fits`, () => {
      assert.match(prompt, label === "ar" ? /تعود إلى بدايتها/ : /return to the start/);
      assert.match(prompt, label === "ar" ? /تصنيف/ : /classification/);
    });
  }
});
```

`deckChecks.test.ts`:

```ts
it("flags diagrams too thin to draw", () => {
  const d = goodDeck();
  Object.assign(d.slides[3]!, { layout: "cycle", mediaPrompt: "", cycle: { stages: [{ label: "a" }] } });
  Object.assign(d.slides[4]!, { layout: "mindmap", mediaPrompt: "", mindmap: { center: "c", nodes: [{ text: "a" }] } });
  const c = codes(d);
  assert.ok(c.includes("cycle_incomplete"));
  assert.ok(c.includes("mindmap_incomplete"));
});
```

`promptSlidesPolish.test.ts` (use the file's existing `polishDeck` call helper and deck builder):

```ts
it('turns a refused cycle back into its words', () => {
  const deck = deckWith([{ slideNumber: 2, type: 'intro', title: 'دورة', content: 'الماء يدور', durationSeconds: 0,
    layout: 'cycle', cycle: { stages: [{ label: 'تبخر' }] } }]);
  const s = polishDeck(deck, true).slides.find(x => x.title === 'دورة')!;
  assert.equal(s.layout, undefined);
  assert.equal(s.cycle, undefined);
  assert.match(s.content, /• تبخر/);
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/promptSlidesPrompt.test.ts src/lib/__tests__/deckChecks.test.ts; cd ../mobile && node --experimental-strip-types --test services/__tests__/promptSlidesPolish.test.ts`
Expected: FAIL (the layout-list parity test also fails once Task 1's `SLIDE_LAYOUTS` is in — that is expected and fixed in Step 3).

- [ ] **Step 3: Implement**

`DECK_LAYOUT_NAMES`: append `"cycle", "tree", "venn", "mindmap"`.

`deckChecks.ts`, after the `flow_incomplete` line:

```ts
    if (layout === "cycle" && nItems(isRec(s.cycle) ? s.cycle.stages : null) < 3) add("warn", "cycle_incomplete", n);
    if (layout === "tree" && nItems(isRec(s.tree) ? s.tree.branches : null) < 2) add("warn", "tree_incomplete", n);
    if (layout === "venn" && nItems(isRec(s.venn) ? s.venn.sets : null) < 2) add("warn", "venn_incomplete", n);
    if (layout === "mindmap" && nItems(isRec(s.mindmap) ? s.mindmap.nodes : null) < 3) add("warn", "mindmap_incomplete", n);
```

Arabic prompt, after the `"flow"` bullet:

```
- "cycle": مراحل تعود إلى بدايتها (دورة الماء، دورة الصخور، دورة الخلية). أضف "cycle": {"stages":[{"label":"اسم المرحلة، قصير","note":"توضيح اختياري"}, ...]} من ٣ إلى ٦ مراحل.
- "tree": تصنيف أو تفرّع (أنواع المادة، مجموعات الأعداد، سلطات الدولة). أضف "tree": {"root":"الأصل","branches":[{"label":"فرع","leaves":["..",".."]}, ...]}: من ٢ إلى ٤ فروع، ولكل فرع حتى ٤ أوراق.
- "venn": ما تشترك فيه مجموعتان أو ثلاث وما تنفرد به كل منها. أضف "venn": {"sets":[{"label":"..","only":[".."]},{"label":"..","only":[".."]}],"shared":[".."]}، وفي ثلاث مجموعات حتى ٣ عناصر قصيرة لكل منها.
- "mindmap": فكرة في الوسط تحيط بها أسباب أو نتائج أو أفكار فرعية. أضف "mindmap": {"center":"..","nodes":[{"text":"..","role":"cause"},{"text":"..","role":"effect"},{"text":".."}]} من ٣ إلى ٦، و"role" اختياري: "cause" للسبب و"effect" للنتيجة.
الأشكال الأربعة الأخيرة كالأشكال السابقة: "content" جملة واحدة، و"type" يبقى "intro" أو "summary"، ولا "mediaPrompt" ولا "visual". استعملها فقط حين يكون للمحتوى هذا الشكل فعلًا.
```

English prompt, after the `"flow"` bullet:

```
- "cycle": stages that return to the start (the water cycle, the rock cycle, the cell cycle). Add "cycle": {"stages":[{"label":"stage name, short","note":"optional one-line note"}, ...]}, 3 to 6 stages.
- "tree": a classification or breakdown (types of matter, number sets, branches of government). Add "tree": {"root":"..","branches":[{"label":"..","leaves":["..",".."]}, ...]}: 2 to 4 branches, up to 4 leaves each.
- "venn": what two or three sets share and what each has alone. Add "venn": {"sets":[{"label":"..","only":[".."]},{"label":"..","only":[".."]}],"shared":[".."]}; with three sets, at most 3 short items each.
- "mindmap": one idea in the middle with causes, effects or sub-ideas around it. Add "mindmap": {"center":"..","nodes":[{"text":"..","role":"cause"},{"text":"..","role":"effect"},{"text":".."}]}, 3 to 6 nodes; "role" is optional: "cause" or "effect".
These four work like the others above: "content" is one sentence, "type" stays "intro" or "summary", no "mediaPrompt" and no "visual". Use one only when the content really has that shape.
```

`promptSlidesPolish.ts`: add the four to `STRUCTURE_LAYOUTS`, and in the refusal branch destructure them away too:

```ts
const STRUCTURE_LAYOUTS = new Set<NonNullable<ActivitySlide['layout']>>(['timeline', 'stats', 'table', 'flow', 'quote', 'cycle', 'tree', 'venn', 'mindmap']);
...
      const { layout: _l, timeline: _t, stats: _s, table: _b, flow: _f, quote: _q, cycle: _c, tree: _r, venn: _v, mindmap: _m, ...rest } = next;
```

- [ ] **Step 4: Run to verify they pass**

Run the Step 2 commands. Expected: PASS, including the API/app layout parity test.

- [ ] **Step 5: Commit**

```bash
git add artifacts/api-server/src/lib/promptSlidesPrompt.ts artifacts/api-server/src/lib/deckChecks.ts artifacts/mobile/services/promptSlidesPolish.ts artifacts/api-server/src/lib/__tests__/promptSlidesPrompt.test.ts artifacts/api-server/src/lib/__tests__/deckChecks.test.ts artifacts/mobile/services/__tests__/promptSlidesPolish.test.ts
git commit -m "Prompt Slides: the model may draw a cycle, tree, Venn or mind map"
```

---

### Task 7: Slides Maker's teaching section carries shapes, icons, charts and photos

**Files:**
- Modify: `artifacts/api-server/src/lib/lessonTeachingPrompt.ts`, `artifacts/api-server/src/lib/generationKey.ts`, `artifacts/api-server/src/routes/generate.ts` (the `/generate/lesson-teaching` handler, line ~853)
- Modify: `artifacts/mobile/services/ai/AIService.ts` (`LessonTeachingOutput.concepts[]`), `artifacts/mobile/services/lessonSlides.ts`
- Test: `artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts`, `artifacts/api-server/src/lib/__tests__/generationKey.test.ts`, `artifacts/mobile/services/__tests__/lessonSlides.test.ts`

**Interfaces:**
- Consumes: `resolveSlideLayout` (Task 1), `isSectionIconName` (`deckIcons.ts`), `usableChartVisual` (`deckVisuals.ts`).
- Produces: `UsableTeaching.concepts[i].extras: Partial<ActivitySlide>` (any of `layout` + its payload field, `icon`, `visual`, `mediaPrompt`); `teachingVisualCounts(content: unknown): { concepts: number; shape: number; icon: number; chart: number; photo: number }` (API).

- [ ] **Step 1: Failing tests**

`lessonTeachingPrompt.test.ts` (inside the per-language loop):

```ts
    it(`${lang}: offers a shape, icon, chart and photo per concept, each optional`, () => {
      const p = build(BODY);
      for (const k of ['"shape"', '"icon"', '"chart"', '"photo"', '"cycle"', '"tree"', '"venn"', '"mindmap"']) assert.ok(p.includes(k), k);
      assert.match(p, lang === "ar" ? /لا تخترع أرقامًا/ : /never invent figures/);
    });
```

and at file level:

```ts
import { teachingVisualCounts } from "../lessonTeachingPrompt.ts";
describe("teachingVisualCounts", () => {
  it("counts the extras the model returned", () => {
    assert.deepEqual(teachingVisualCounts({ concepts: [
      { title: "a", points: ["x"], shape: { layout: "cycle" }, icon: "drop" },
      { title: "b", points: ["y"], chart: { kind: "chart" }, photo: "water cycle" },
      { title: "c", points: ["z"] },
    ] }), { concepts: 3, shape: 1, icon: 1, chart: 1, photo: 1 });
    assert.deepEqual(teachingVisualCounts(null), { concepts: 0, shape: 0, icon: 0, chart: 0, photo: 0 });
  });
});
```

`generationKey.test.ts`: change the expectation in "gives lesson-teaching its own version" to

```ts
    assert.equal(promptVersionFor("lesson-teaching"), "2026-10-31.1");
```

`lessonSlides.test.ts` (new `describe` near the spot-the-mistake tests):

```ts
  describe('concept extras', () => {
    const cycleShape = { layout: 'cycle', cycle: { stages: [{ label: 'تبخر' }, { label: 'تكاثف' }, { label: 'هطول' }] } };
    const withExtras = (extra: Record<string, unknown>) => ({
      ...TEACHING,
      concepts: [{ ...TEACHING.concepts[0]!, ...extra }, TEACHING.concepts[1]!],
    });
    const first = (deck: ReturnType<typeof buildLessonDeck>) => deck.slides.find(s => s.title === TEACHING.concepts[0]!.title)!;

    it('draws a concept in its shape, keeping its points as the fallback', () => {
      const s = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({ shape: cycleShape, icon: 'drop' }) }));
      assert.equal(s.layout, 'cycle');
      assert.deepEqual(s.cycle, cycleShape.cycle);
      assert.equal(s.icon, 'drop');
      assert.match(s.content, /^• /);
    });
    it('drops a shape the gate refuses, an unknown icon, or a shape it does not allow', () => {
      const bad = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({
        shape: { layout: 'cycle', cycle: { stages: [{ label: 'a' }] } }, icon: 'rocket',
      }) }));
      assert.equal(bad.layout, undefined);
      assert.equal(bad.icon, undefined);
      const photo = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({ shape: { layout: 'photo' } }) }));
      assert.equal(photo.layout, undefined);
    });
    it('keeps a real chart only when there is no shape, and a photo only when there is neither', () => {
      const chart = { kind: 'chart', chartType: 'bar', categories: ['أ', 'ب'], values: [3, 5] };
      const c = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({ chart, photo: 'salt crystals' }) }));
      assert.equal(c.visual?.kind, 'chart');
      assert.equal(c.mediaPrompt, undefined);
      const p = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({ photo: 'salt crystals' }) }));
      assert.equal(p.mediaPrompt, 'salt crystals');
      const ar = first(buildLessonDeck('x', true, { lesson: BARE, plan: PLAN, teaching: withExtras({ photo: 'بلورات الملح' }) }));
      assert.equal(ar.mediaPrompt, undefined);
    });
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd artifacts/api-server && node --experimental-strip-types --test src/lib/__tests__/lessonTeachingPrompt.test.ts src/lib/__tests__/generationKey.test.ts; cd ../mobile && node --experimental-strip-types --test services/__tests__/lessonSlides.test.ts`
Expected: FAIL.

- [ ] **Step 3: API**

`generationKey.ts`: `"lesson-teaching": "2026-10-31.1",` and extend its comment with: «2026-10-31: concepts gained optional `shape`, `icon`, `chart` and `photo`.»

`lessonTeachingPrompt.ts` — add rule 13 to the Arabic prompt (after rule 12):

```
13. لكل فكرة في "concepts" إضافات اختيارية، فقط حين تفيد فعلًا:
   - "shape": شكل يرسم الفكرة بدل القائمة، واحد من: "compare" {"leftTitle","left","rightTitle","right"}، "table" {"headers","rows"}، "flow" {"steps"}، "timeline" [{"label","text"}]، "stat" {"value","label"}، "cycle" {"stages":[{"label","note"}]}، "tree" {"root","branches":[{"label","leaves"}]}، "venn" {"sets":[{"label","only"}],"shared"}، "mindmap" {"center","nodes":[{"text","role"}]}. اكتبه هكذا: "shape": {"layout":"cycle","cycle":{...}}. عندها اجعل "points" سطرين يلخّصان الشكل.
   - "icon": اسم أيقونة واحد من: ${DECK_ICON_NAMES.join(", ")}.
   - "chart": {"kind":"chart","chartType":"bar","categories":[..],"values":[..]} فقط من أرقام واردة في محتوى الكتاب أعلاه. لا تخترع أرقامًا أبدًا، ولا تجمع "chart" مع "shape".
   - "photo": عبارة بحث إنجليزية من ٢-٥ كلمات لمشهد حقيقي (مكان، تجربة، ظاهرة)، لا لقاعدة رياضية؛ في فكرتين على الأكثر.
```

and to the English prompt:

```
13. Each item in "concepts" may carry optional extras, only where they genuinely help:
   - "shape": a drawing of the idea instead of a list, one of: "compare" {"leftTitle","left","rightTitle","right"}, "table" {"headers","rows"}, "flow" {"steps"}, "timeline" [{"label","text"}], "stat" {"value","label"}, "cycle" {"stages":[{"label","note"}]}, "tree" {"root","branches":[{"label","leaves"}]}, "venn" {"sets":[{"label","only"}],"shared"}, "mindmap" {"center","nodes":[{"text","role"}]}. Write it as "shape": {"layout":"cycle","cycle":{...}}. Then make "points" two lines that sum the drawing up.
   - "icon": one icon name from: ${DECK_ICON_NAMES.join(", ")}.
   - "chart": {"kind":"chart","chartType":"bar","categories":[..],"values":[..]} only from figures in the textbook content above. Never invent figures, and never put "chart" with "shape".
   - "photo": a 2-5 word English search phrase for a real scene (a place, an experiment, a phenomenon), never for a maths rule; on two concepts at most.
```

Import `DECK_ICON_NAMES` from `./promptSlidesPrompt.ts`. In both prompts' JSON example, add to the concept object: `"icon": "bulb"` (only the icon, so the example does not push every concept into a shape).

Add the counter:

```ts
/** What the model attached to its concepts — logged per section, see routes/generate.ts. */
export function teachingVisualCounts(content: unknown): { concepts: number; shape: number; icon: number; chart: number; photo: number } {
  const list = content !== null && typeof content === "object" && Array.isArray((content as { concepts?: unknown }).concepts)
    ? (content as { concepts: unknown[] }).concepts.filter((c): c is Record<string, unknown> => c !== null && typeof c === "object")
    : [];
  const has = (k: string) => list.filter(c => c[k] !== undefined && c[k] !== null && c[k] !== "").length;
  return { concepts: list.length, shape: has("shape"), icon: has("icon"), chart: has("chart"), photo: has("photo") };
}
```

`routes/generate.ts` lesson-teaching handler, after the result is obtained and before `res.json`:

```ts
    logger.info({ visuals: teachingVisualCounts(result.content) }, "lesson-teaching visuals");
```

(import `teachingVisualCounts` with `lessonTeachingPromptAr/En`).

- [ ] **Step 4: Mobile**

`AIService.ts` — concept type in `LessonTeachingOutput`:

```ts
  concepts?: {
    title?: string; points?: string[]; teacherNote?: string; misconception?: string;
    /** `{ layout, [layout]: payload }` — drawn instead of the points when the gate accepts it. */
    shape?: Record<string, unknown>;
    icon?: string;
    chart?: unknown;
    /** An English photo-search phrase. */
    photo?: string;
  }[];
```

`lessonSlides.ts` — imports: add `isSectionIconName` to the `./deckIcons.ts` import, `usableChartVisual` to the `./deckVisuals.ts` import, and `resolveSlideLayout` is already imported from `./slideLayout.ts`.

Add above `usableTeaching`:

```ts
/** Shapes a teaching concept may take: each carries its data in a field of the same name. */
const TEACHING_SHAPES = new Set(['compare', 'table', 'flow', 'timeline', 'stat', 'cycle', 'tree', 'venn', 'mindmap']);
const PHOTO_QUERY = /^[\x20-\x7E]{3,60}$/;

/**
 * The extras one generated concept may carry, each kept only if the renderers
 * can draw it — the same gates they ask (`resolveSlideLayout`,
 * `isSectionIconName`, `usableChartVisual`). One bad extra is dropped alone; the
 * points always stay as the slide's words, so a refused shape is a list.
 * A chart and a shape never share a slide (the shape fills it), and a photo goes
 * only where neither is.
 */
function conceptExtras(raw: unknown, title: string, points: string[]): Partial<ActivitySlide> {
  const c = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const out: Partial<ActivitySlide> = {};
  const shape = c.shape && typeof c.shape === 'object' ? (c.shape as Record<string, unknown>) : null;
  const layout = typeof shape?.layout === 'string' ? shape.layout : '';
  if (shape && TEACHING_SHAPES.has(layout)) {
    const payload = { layout, [layout]: shape[layout] } as Partial<ActivitySlide>;
    const probe = { slideNumber: 2, type: 'intro', title, content: points.map(p => `• ${p}`).join('\n'), durationSeconds: 0, ...payload } as ActivitySlide;
    if (resolveSlideLayout(probe)) Object.assign(out, payload);
  }
  if (isSectionIconName(c.icon)) out.icon = c.icon;
  if (!out.layout) {
    const chart = usableChartVisual(c.chart);
    if (chart) out.visual = chart;
  }
  const photo = typeof c.photo === 'string' ? c.photo.trim() : '';
  if (!out.layout && !out.visual && PHOTO_QUERY.test(photo)) out.mediaPrompt = photo;
  return out;
}
```

Change `UsableTeaching.concepts` to `{ title: string; points: string[]; teacherNote: string; misconception: string; extras: Partial<ActivitySlide> }[]`, and in `usableTeaching`'s concept map:

```ts
    .map(c => {
      const title = str(c?.title);
      const points = lines(c?.points, 4);
      return { title, points, teacherNote: str(c?.teacherNote), misconception: str(c?.misconception), extras: conceptExtras(c, title, points) };
    })
```

In `buildLessonDeck`'s generated-concepts loop, change `for (const { points, ...c } of generatedConcepts) {` to `for (const { points, extras, ...c } of generatedConcepts) {` and spread `...extras,` into the pushed slide right after `aiWritten: true,`.

Update the existing `usableTeaching` deep-equality tests in `lessonSlides.test.ts` that list concept objects: each concept now also has `extras: {}`.

- [ ] **Step 5: Run to verify**

Run the Step 2 commands, then `cd /home/user/Iqraa && pnpm run typecheck`.
Expected: PASS; clean.

- [ ] **Step 6: Commit**

```bash
git add artifacts/api-server/src/lib/lessonTeachingPrompt.ts artifacts/api-server/src/lib/generationKey.ts artifacts/api-server/src/routes/generate.ts artifacts/api-server/src/lib/__tests__/lessonTeachingPrompt.test.ts artifacts/api-server/src/lib/__tests__/generationKey.test.ts artifacts/mobile/services/ai/AIService.ts artifacts/mobile/services/lessonSlides.ts artifacts/mobile/services/__tests__/lessonSlides.test.ts
git commit -m "Slides Maker: explanation slides may carry a shape, icon, chart or photo"
```

---

### Task 8: Up to two concept photos on curriculum decks

**Files:**
- Modify: `artifacts/mobile/services/lessonSlides.ts` (new export `teachingPhotoTargets`)
- Modify: `artifacts/mobile/app/ai-tools/slides.tsx` (media block, ~line 841)
- Test: `artifacts/mobile/services/__tests__/lessonSlides.test.ts`

**Interfaces:**
- Produces: `export const MAX_TEACHING_PHOTOS = 2;` and `export function teachingPhotoTargets(slides: readonly ActivitySlide[]): { title: string; query: string }[]`.

- [ ] **Step 1: Failing test**

```ts
import { MAX_TEACHING_PHOTOS, teachingPhotoTargets } from '../lessonSlides.ts';
describe('teachingPhotoTargets', () => {
  const s = (over: Partial<ActivitySlide>): ActivitySlide => ({ slideNumber: 3, type: 'intro', title: 't', content: '• a', durationSeconds: 0, aiWritten: true, ...over });
  it('takes AI-written slides that asked for a photo, two at most, no repeats', () => {
    const out = teachingPhotoTargets([
      s({ title: 'a', mediaPrompt: 'salt' }), s({ title: 'b', mediaPrompt: 'salt' }),
      s({ title: 'c', mediaPrompt: 'river' }), s({ title: 'd', mediaPrompt: 'desert' }),
    ]);
    assert.equal(MAX_TEACHING_PHOTOS, 2);
    assert.deepEqual(out, [{ title: 'a', query: 'salt' }, { title: 'c', query: 'river' }]);
  });
  it('skips a slide with a book figure, a layout, or no AI hand in it', () => {
    assert.deepEqual(teachingPhotoTargets([
      s({ title: 'a', mediaPrompt: 'x', sideImageUrl: 'book.png' }),
      s({ title: 'b', mediaPrompt: 'y', layout: 'cycle' }),
      s({ title: 'c', mediaPrompt: 'z', aiWritten: undefined }),
    ]), []);
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `cd artifacts/mobile && node --experimental-strip-types --test services/__tests__/lessonSlides.test.ts` → FAIL.

- [ ] **Step 3: Implement** (`lessonSlides.ts`, after `rebuildAnswerKey`)

```ts
/** Explanation-slide photos per deck; with the cover photo that makes three. */
export const MAX_TEACHING_PHOTOS = 2;

/**
 * The generated concept slides that asked for a photo (`mediaPrompt`, from the
 * teaching section's `photo`) and can show one: written by the model, no book
 * figure already beside the text, no layout filling the slide. First two, by
 * distinct query, so one search never puts the same picture on two slides.
 * Matched back by title by the caller, like the unit-break photos, because the
 * teacher may move or delete a slide while the search runs.
 */
export function teachingPhotoTargets(slides: readonly ActivitySlide[]): { title: string; query: string }[] {
  const out: { title: string; query: string }[] = [];
  const seen = new Set<string>();
  for (const s of slides) {
    const query = s.mediaPrompt?.trim() ?? '';
    if (!s.aiWritten || !query || s.sideImageUrl || s.layout || seen.has(query)) continue;
    seen.add(query);
    out.push({ title: s.title, query });
    if (out.length === MAX_TEACHING_PHOTOS) break;
  }
  return out;
}
```

- [ ] **Step 4: Wire into `slides.tsx`**

In the media block: import `teachingPhotoTargets` alongside the `classMedia` imports (`const { teachingPhotoTargets } = await import('@/services/lessonSlides');`), compute `const conceptTargets = wide ? [] : teachingPhotoTargets(built.slides);`, add `Promise.all(conceptTargets.map(t => searchDeckPhoto(t.query)))` as a fifth entry of the `Promise.all` destructured as `conceptPhotos`, include `conceptPhotos.some(Boolean)` in the early-return check, and inside `setDeck` after the unit-break loop:

```ts
            conceptTargets.forEach((target, i) => {
              const photo = conceptPhotos[i];
              const at = slides.findIndex(s => s.title === target.title && !s.sideImageUrl && !s.layout);
              if (!photo || at < 0) return;
              slides = slides.map((s, j) => (j === at
                ? { ...s, sideImageUrl: photo.url, sideImageCaption: photoCreditText(photo, isAr), sideImageCredit: creditFromPhoto(photo) }
                : s));
            });
```

- [ ] **Step 5: Run** — the Step 2 command → PASS; `pnpm --filter ./artifacts/mobile run typecheck` → clean.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/services/lessonSlides.ts artifacts/mobile/app/ai-tools/slides.tsx artifacts/mobile/services/__tests__/lessonSlides.test.ts
git commit -m "Slides Maker: up to two photos on explanation slides that asked for one"
```

---

### Task 9: See it, write it up, ship it

**Files:**
- Create (scratchpad only, not committed): a fixture deck JSON and render scripts
- Modify: `docs/status-log.md` (new entry at the top), `STATUS.md` (one line under *Open*)

- [ ] **Step 1: Full checks**

```bash
cd /home/user/Iqraa && pnpm run typecheck
cd artifacts/api-server && pnpm build && pnpm test
cd ../mobile && pnpm test
```
Expected: clean; 0 failures.

- [ ] **Step 2: Look at the PDF.** Write a scratch Node script (in the scratchpad) that builds a deck with one slide of each diagram at maximum size (6-stage cycle with notes, 4×4 tree, 2- and 3-set Venn, 6-node mind map with roles), runs the HTML builder from `deckSlidesHtml.ts`, prints it to PDF with Playwright's Chromium (`page.pdf({ landscape: true, format: 'A4' })`) in Arabic and English, light and dark themes (`themeId` 'iqraa' and 'graphite'), and screenshot each page. Read every screenshot: labels inside boxes, nothing clipped, arrows touch the right boxes.

- [ ] **Step 3: Inspect the PowerPoint.** Run `exportPptx`'s slide loop the way the 2026-10-18 log entry did (native modules stubbed), unzip the .pptx, and check `ppt/slides/slideN.xml` for each diagram slide: `prstGeom prst="ellipse"`/`roundRect`/`line` counts, `tailEnd type="triangle"` on cause/effect lines, the labels present.

- [ ] **Step 4: Look at the presenter.** Build the web bundle (`EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`), serve it (`cd e2e && node serve.mjs`), and drive it with Playwright: stub `/api/**` as `e2e/screens.mjs` does, open the fixture deck through the saved-material view (stub the workspace item read to return the fixture deck; find the route by reading `app/workspace/view.tsx`), press «اعرض على الشاشة», step through the four diagram slides at 1366×860 and 390×844, with «نقطة بنقطة» on and off. Read the screenshots.

- [ ] **Step 5: Write the log entry** at the top of `docs/status-log.md` — what changed per task, the verified list with numbers, and **not verified**: a live model choosing these (the session key lacks `model.request`), PowerPoint's own rendering, native devices; plus the `lesson-teaching` pool restart to `2026-10-31.1` (first teacher per lesson pays; re-run `pregenerate.ts`). Add one line under *Open* in `STATUS.md`: `- 2026-10-31 — Slides: cycle, tree, Venn and mind-map diagrams; curriculum slides gain shapes, icons, charts and photos (untested against a live model)`.

- [ ] **Step 6: Commit, push, draft PR**

```bash
git add docs/status-log.md STATUS.md
git commit -m "Log: slide diagrams and visuals"
git push -u origin ccr-0f72cfa3-riioxg
```
Then open a draft PR against `main` with the template-free body (what changed, verified, not verified, the pool note), subscribe to its activity, and drive CI to green.
