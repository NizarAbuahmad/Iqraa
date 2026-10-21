# Corner Identities — PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the Math, Lab and Quran corners their own colour and band motif through one table and one provider, make the library tiles carry those colours, and lay desktop hubs out as a card grid.

**Architecture:** A pure-data table `constants/corners.ts` holds five corners' tokens (light + dark). `CornerThemeProvider` (mounted by a `_layout.tsx` per corner directory) puts the corner's tokens in a context; `useColors()` spreads them over the global palette, so every component under the provider follows with no edits. `MathFrame` and `LabFrame` merge into `CornerFrame` (band + `CornerMotif` SVG + capped scroll area); `CornerGrid` lays hub cards in 1–3 columns. English and Games are PR 2.

**Tech Stack:** Expo Router (nested `Stack` layout), React Native, `react-native-svg` 15, `node --test` with `--experimental-strip-types`, TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-21-corner-identities-design.md`

## Global Constraints

- Every text/background pair introduced must measure ≥ 4.5:1 (`contrast()` in `services/readableColor.ts`); the test is the source of truth, not the spec's tables.
- Files read by `node --test` (`constants/corners.ts`, `services/cornerLayout.ts`) import nothing from `react-native`, `expo-*` or `constants/colors.ts` (which imports `Appearance`). Relative imports in tests carry an explicit `.ts` extension.
- New styles use `TYPE` / `SPACE` / `RADIUS` from `constants/theme.ts` only, or `designScale.test.ts` fails.
- Arabic UI; RTL-first (`isRTL` decides `row` vs `row-reverse`, `textAlign`).
- No native modules touched → no `app.json` `version` bump.
- The library (`app/curriculum/resources.tsx`) and the curriculum browser are never wrapped in a provider.
- Commit after every task with the attribution footer this session uses. Run from `artifacts/mobile`: `pnpm test` and `pnpm typecheck` before each commit that touches `.ts`/`.tsx`.
- The two-line layout files use the repo's shape (`app/ai-tools/classroom/_layout.tsx`): a `Stack` with `headerShown: false`.

---

### Task 1: The corner table, measured

**Files:**
- Create: `artifacts/mobile/constants/corners.ts`
- Test: `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

**Interfaces:**
- Produces: `CornerId`, `CornerTokens`, `Corner`, `CORNERS: Record<CornerId, Corner>`, `CORNER_IDS: readonly CornerId[]`, `MotifId`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/mobile/services/__tests__/cornerTheme.test.ts
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
```

- [ ] **Step 2: Run it to verify it fails**

Run (from `artifacts/mobile`): `pnpm test 2>&1 | grep -E "cornerTheme|not ok|Cannot find" | head`
Expected: FAIL — `Cannot find module '.../constants/corners.ts'`.

- [ ] **Step 3: Write the table**

```ts
// artifacts/mobile/constants/corners.ts
/**
 * The corners' identities — one hue and one band motif each, on top of the
 * shared cards, type and spacing. Design:
 * docs/superpowers/specs/2026-10-21-corner-identities-design.md
 *
 * Pure data with no imports, so `node --test` can read it. `CornerTokens` is
 * the slice of the palette a corner overrides; the provider spreads it over
 * `palette` (constants/colors.ts) and every `useColors()` under it follows.
 * Every pair here is measured by services/__tests__/cornerTheme.test.ts —
 * change a value and the test tells you what stopped reading.
 *
 * `selected` is lighter than the teal palette's (#CDE9E3) on purpose: these
 * hues are darker than teal, and the binding pair is the muted grey caption
 * (#5C6675) on the chip, which fails before the primary does.
 */
export type CornerId = 'math' | 'english' | 'lab' | 'quran' | 'play';
export type MotifId = 'grid' | 'bubbles' | 'hex' | 'stars' | 'confetti';

export type CornerTokens = {
  /** The band; white text on it. */
  hero: string;
  /** Text, links, buttons, the active chip fill. */
  primary: string;
  primaryForeground: string;
  tint: string;
  /** Icon-square tint. */
  secondary: string;
  secondaryForeground: string;
  /** A chosen chip or row. */
  selected: string;
};

export type Corner = {
  id: CornerId;
  route: string;
  /** Ionicons glyph for the library tile. */
  icon: string;
  motif: MotifId;
  motifOpacity: number;
  /** Large glyph in the band's far corner, phones only. */
  glyph: string;
  /** A hairline under the band (quran: gold). */
  hairline?: string;
  light: CornerTokens;
  dark: CornerTokens;
};

const light = (hero: string, primary: string, secondary: string, selected: string): CornerTokens => ({
  hero, primary, primaryForeground: '#FFFFFF', tint: primary, secondary, secondaryForeground: primary, selected,
});
const dark = (hero: string, primary: string, secondary: string, selected: string): CornerTokens => ({
  hero, primary, primaryForeground: '#081B3A', tint: primary, secondary, secondaryForeground: primary, selected,
});

export const CORNERS: Record<CornerId, Corner> = {
  math: {
    id: 'math', route: '/curriculum/math', icon: 'calculator-outline', motif: 'grid', motifOpacity: 0.14, glyph: '∑',
    light: light('#3730A3', '#4338CA', '#F2F1FB', '#E5E3F8'),
    dark: dark('#3730A3', '#A5B4FC', '#1C1D47', '#2E2A6B'),
  },
  english: {
    id: 'english', route: '/curriculum/english', icon: 'headset', motif: 'bubbles', motifOpacity: 0.10, glyph: 'Aa',
    light: light('#C2410C', '#C2410C', '#FBF4F0', '#FAF0EC'),
    dark: dark('#9A3412', '#FDBA74', '#3A1F10', '#5A2A10'),
  },
  lab: {
    id: 'lab', route: '/curriculum/lab', icon: 'flask-outline', motif: 'hex', motifOpacity: 0.14, glyph: '⚗',
    light: light('#5B21B6', '#6D28D9', '#F5F0FC', '#EBE1FA'),
    dark: dark('#5B21B6', '#C4B5FD', '#261B47', '#3B2A6B'),
  },
  quran: {
    id: 'quran', route: '/curriculum/quran', icon: 'book-outline', motif: 'stars', motifOpacity: 0.14, glyph: '۞', hairline: '#E3C25C',
    light: light('#14532D', '#166534', '#ECF3EF', '#DCE8E1'),
    dark: dark('#14532D', '#86EFAC', '#10281C', '#1A3D2A'),
  },
  play: {
    id: 'play', route: '/play', icon: 'game-controller-outline', motif: 'confetti', motifOpacity: 0.14, glyph: '★',
    light: light('#BE185D', '#BE185D', '#FAEFF4', '#F6DFE8'),
    dark: dark('#9D174D', '#F9A8D4', '#331222', '#4A1A33'),
  },
};

/** Library tile order. Append, never insert (see CLAUDE.md on picker order). */
export const CORNER_IDS = ['math', 'english', 'lab', 'quran', 'play'] as const satisfies readonly CornerId[];
```

- [ ] **Step 4: Run the test; fix any pair that fails by moving the failing token, not the threshold**

Run: `pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok" | head`
Expected: all `cornerTheme` tests `ok`. If a dark `secondary` fails «dark icon on its tint», darken that secondary (toward the page `#0A1628`) until it passes — the spec marks those values as proposed.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/constants/corners.ts artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "feat(corners): the corner identity table, with every colour pair measured"
```

---

### Task 2: Hub columns

**Files:**
- Create: `artifacts/mobile/services/cornerLayout.ts`
- Test: `artifacts/mobile/services/__tests__/cornerLayout.test.ts`

**Interfaces:**
- Produces: `cornerColumns(trackWidth: number): 1 | 2 | 3`.

- [ ] **Step 1: Write the failing test**

```ts
// artifacts/mobile/services/__tests__/cornerLayout.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cornerColumns } from '../cornerLayout.ts';

test('a phone gets one column, a tablet two, a desktop three', () => {
  assert.equal(cornerColumns(390), 1);
  assert.equal(cornerColumns(599), 1);
  assert.equal(cornerColumns(600), 2);
  assert.equal(cornerColumns(959), 2);
  assert.equal(cornerColumns(960), 3);
  assert.equal(cornerColumns(1120), 3);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm test 2>&1 | grep -E "cornerLayout|Cannot find" | head -3`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

```ts
// artifacts/mobile/services/cornerLayout.ts
/**
 * Columns for a corner hub's card grid. The same breaks as `libraryColumns`
 * (services/libraryLayout.ts) today, kept as its own function so the two can
 * drift on purpose. `trackWidth` is the content track, i.e. the viewport
 * capped at CONTENT_MAX_WIDTH — not the window.
 */
export function cornerColumns(trackWidth: number): 1 | 2 | 3 {
  if (trackWidth >= 960) return 3;
  if (trackWidth >= 600) return 2;
  return 1;
}
```

- [ ] **Step 4: Run the test**

Run: `pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/services/cornerLayout.ts artifacts/mobile/services/__tests__/cornerLayout.test.ts
git commit -m "feat(corners): cornerColumns for the hub grid"
```

---

### Task 3: The provider and the hook

**Files:**
- Create: `artifacts/mobile/context/CornerTheme.tsx`
- Modify: `artifacts/mobile/hooks/useColors.ts`

**Interfaces:**
- Consumes: `CORNERS`, `CornerId`, `CornerTokens` (Task 1).
- Produces: `CornerThemeProvider({ corner: CornerId; children })`, `useCorner(): Corner | null`, and `useColors()` now returning the corner's tokens when under a provider.

- [ ] **Step 1: Write the provider**

```tsx
// artifacts/mobile/context/CornerTheme.tsx
/**
 * Which corner a screen is in, so `useColors()` can hand it that corner's
 * tokens (constants/corners.ts). Mounted by the `_layout.tsx` of each corner
 * directory and nowhere else — the library and the browser stay teal on
 * purpose (cornerTheme.test.ts pins that).
 *
 * Trap: a module-scope `const ACCENT = palette.primary` is read before any
 * provider exists and stays teal. Read colours inside the component.
 */
import React, { createContext, useContext } from 'react';
import { CORNERS, type Corner, type CornerId } from '@/constants/corners';

const CornerContext = createContext<Corner | null>(null);

export function CornerThemeProvider({ corner, children }: { corner: CornerId; children: React.ReactNode }) {
  return <CornerContext.Provider value={CORNERS[corner]}>{children}</CornerContext.Provider>;
}

/** The corner this screen is in, or null outside every corner. */
export function useCorner(): Corner | null {
  return useContext(CornerContext);
}
```

- [ ] **Step 2: Make `useColors()` read it first**

Replace the body of `artifacts/mobile/hooks/useColors.ts`:

```ts
import colors, { palette, scheme } from '@/constants/colors';
import { useCorner } from '@/context/CornerTheme';

/**
 * The design tokens for this session's colour scheme, plus scheme-independent
 * values like `radius`. The scheme is fixed at startup — see `scheme` in
 * constants/colors.ts for why it is not live.
 *
 * Inside a corner (context/CornerTheme.tsx) the corner's own hero, primary,
 * secondary and selected replace the teal ones, so a button or chip rendered
 * there takes the corner's hue without knowing it is in one.
 */
export function useColors() {
  const corner = useCorner();
  return { ...palette, ...(corner ? corner[scheme] : {}), radius: colors.radius };
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm typecheck`
Expected: clean. (`CornerTokens`' seven fields are all `string` keys of `Palette`, so the spread keeps the return type.)

- [ ] **Step 4: Run the mobile tests**

Run: `pnpm test 2>&1 | grep -E "^# (pass|fail)"`
Expected: `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/context/CornerTheme.tsx artifacts/mobile/hooks/useColors.ts
git commit -m "feat(corners): CornerThemeProvider; useColors reads the corner first"
```

---

### Task 4: The band motifs

**Files:**
- Create: `artifacts/mobile/components/corners/CornerMotif.tsx`

**Interfaces:**
- Consumes: `MotifId` (Task 1).
- Produces: `CornerMotif({ motif: MotifId; opacity: number })` — absolutely-filled SVG, white strokes, `pointerEvents="none"`.

- [ ] **Step 1: Write the component**

```tsx
// artifacts/mobile/components/corners/CornerMotif.tsx
/**
 * A corner's band pattern, drawn in white at the corner's `motifOpacity` over
 * the hero colour. Vector only: nothing to ship per density, nothing to bump
 * in app.json. Five motifs, one per corner — add a case when a corner is
 * added, or the band is plain.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Circle, Defs, G, Path, Pattern, Rect, Text as SvgText } from 'react-native-svg';
import type { MotifId } from '@/constants/corners';

type Props = { motif: MotifId; opacity: number };

export function CornerMotif({ motif, opacity }: Props) {
  return (
    <Svg pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity }]} width="100%" height="100%">
      {MOTIFS[motif]}
    </Svg>
  );
}

const MOTIFS: Record<MotifId, React.ReactNode> = {
  grid: (
    <>
      <Defs>
        <Pattern id="corner-grid" width={24} height={24} patternUnits="userSpaceOnUse">
          <Path d="M24 0H0V24" fill="none" stroke="#fff" strokeWidth={1} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#corner-grid)" />
      <Path d="M0 150 Q 100 20 200 120 T 420 40" fill="none" stroke="#fff" strokeWidth={2.5} />
    </>
  ),
  bubbles: (
    <>
      <G fill="none" stroke="#fff" strokeWidth={2}>
        <Rect x={20} y={30} width={90} height={46} rx={14} />
        <Path d="M40 76 l-8 14 l22 -14" />
        <Rect x={250} y={95} width={110} height={50} rx={16} />
        <Path d="M340 145 l8 14 l-22 -14" />
        <Rect x={150} y={10} width={70} height={36} rx={12} />
      </G>
      <SvgText x={55} y={63} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hi!</SvgText>
      <SvgText x={275} y={130} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={22}>Hello</SvgText>
      <SvgText x={165} y={36} fill="#fff" fontFamily="ReadexPro_700Bold" fontSize={18}>ABC</SvgText>
    </>
  ),
  hex: (
    <>
      <Defs>
        <Pattern id="corner-hex" width={40} height={69} patternUnits="userSpaceOnUse">
          <Path d="M20 0L40 11.5V34.5L20 46L0 34.5V11.5Z M20 46L40 57.5V80 M0 57.5L20 46" fill="none" stroke="#fff" strokeWidth={1.4} />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#corner-hex)" />
    </>
  ),
  stars: (
    <>
      <Defs>
        <Pattern id="corner-stars" width={64} height={64} patternUnits="userSpaceOnUse">
          <G fill="none" stroke="#fff" strokeWidth={1.2}>
            <Rect x={18} y={18} width={28} height={28} transform="rotate(45 32 32)" />
            <Rect x={18} y={18} width={28} height={28} />
            <Circle cx={0} cy={0} r={6} />
            <Circle cx={64} cy={64} r={6} />
            <Circle cx={0} cy={64} r={6} />
            <Circle cx={64} cy={0} r={6} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#corner-stars)" />
    </>
  ),
  confetti: (
    <G fill="#fff">
      <Circle cx={30} cy={40} r={5} />
      <Circle cx={90} cy={120} r={4} />
      <Circle cx={330} cy={30} r={6} />
      <Circle cx={280} cy={140} r={4} />
      <Rect x={150} y={20} width={10} height={10} transform="rotate(20 155 25)" />
      <Rect x={230} y={90} width={9} height={9} transform="rotate(-15 234 94)" />
      <Rect x={60} y={150} width={8} height={8} transform="rotate(35 64 154)" />
      <Path d="M350 100 l6 12 l13 2 l-9 9 l2 13 l-12 -6 l-12 6 l2 -13 l-9 -9 l13 -2z" />
      <Path d="M190 130 l5 10 l11 2 l-8 8 l2 11 l-10 -5 l-10 5 l2 -11 l-8 -8 l11 -2z" />
      <Path d="M110 60 l4 8 l9 1 l-6 6 l1 9 l-8 -4 l-8 4 l1 -9 l-6 -6 l9 -1z" />
    </G>
  ),
};
```

- [ ] **Step 2: Typecheck**

Run: `pnpm typecheck`
Expected: clean. If `pointerEvents` is rejected on `Svg`, move it to a wrapping `<View pointerEvents="none" style={StyleSheet.absoluteFill}>` around the `Svg`.

- [ ] **Step 3: Commit**

```bash
git add artifacts/mobile/components/corners/CornerMotif.tsx
git commit -m "feat(corners): CornerMotif — five band patterns in white SVG"
```

---

### Task 5: `CornerFrame` and `CornerGrid`; the two old frames become shims

**Files:**
- Create: `artifacts/mobile/components/corners/CornerFrame.tsx`
- Create: `artifacts/mobile/components/corners/CornerGrid.tsx`
- Modify: `artifacts/mobile/components/math/MathFrame.tsx` (whole file → re-export)
- Modify: `artifacts/mobile/components/lab/LabFrame.tsx` (whole file → re-export)

**Interfaces:**
- Consumes: `useCorner` (Task 3), `CornerMotif` (Task 4), `cornerColumns` (Task 2), `useViewportWidth` (`hooks/useViewportWidth.ts`), `CONTENT_MAX_WIDTH`, `DESKTOP_BREAKPOINT` (`constants/layout.ts`), `BackButton`.
- Produces: `CornerFrame({ title, subtitle?, bandChildren?, children })`, `useScrollLock()`, `CornerGrid({ children })`.

- [ ] **Step 1: Write `CornerFrame`**

```tsx
// artifacts/mobile/components/corners/CornerFrame.tsx
/**
 * A corner's page frame: the band in the corner's hero colour with its motif,
 * a back button, title and subtitle, then a centred, width-capped scroll area.
 * `MathFrame`'s and `LabFrame`'s layout, merged — they were the same component
 * twice, differing only in the scroll lock the grapher needs, which lives here.
 *
 * It takes no colour props. It reads `useColors()`, and the corner's
 * `_layout.tsx` provider decides the hue; outside every provider it is teal,
 * which is what a future non-corner caller should get.
 *
 * The band stays full-bleed, but what is in it is capped at CONTENT_MAX_WIDTH
 * and centred, so on desktop the title lines up with the content column
 * instead of hugging the window edge. The large glyph is phone-only: on
 * desktop it would sit under the back button.
 *
 * Without the scroll lock a drag on the grapher scrolls the page instead of
 * panning the graph. A tool calls `useScrollLock()(true)` when a touch starts
 * on its canvas and `(false)` when it ends.
 */
import React, { createContext, useContext, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useLanguage } from '@/context/LanguageContext';
import { useCorner } from '@/context/CornerTheme';
import { CONTENT_MAX_WIDTH, DESKTOP_BREAKPOINT } from '@/constants/layout';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { BackButton } from '@/components/ui/BackButton';
import { CornerMotif } from './CornerMotif';

const ScrollLockContext = createContext<(locked: boolean) => void>(() => {});

/** Lock (true) or release (false) the page's scrolling. A no-op outside a `CornerFrame`. */
export function useScrollLock(): (locked: boolean) => void {
  return useContext(ScrollLockContext);
}

type Props = {
  title: string;
  subtitle?: string;
  /** Rendered inside the band under the subtitle — grade chips, a switch. */
  bandChildren?: React.ReactNode;
  children: React.ReactNode;
};

export function CornerFrame({ title, subtitle, bandChildren, children }: Props) {
  const colors = useColors();
  const corner = useCorner();
  const { isRTL } = useLanguage();
  const insets = useSafeAreaInsets();
  const viewportW = useViewportWidth();
  const [locked, setLocked] = useState(false);
  const align = isRTL ? 'right' : 'left';
  const isDesktop = viewportW >= DESKTOP_BREAKPOINT;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.hero, { backgroundColor: colors.hero, paddingTop: insets.top + SPACE.md }]}>
        {corner ? <CornerMotif motif={corner.motif} opacity={corner.motifOpacity} /> : null}
        {corner && !isDesktop ? (
          <View pointerEvents="none" style={[styles.glyphWrap, isRTL ? { left: -SPACE.md } : { right: -SPACE.md }]}>
            <Text style={[styles.glyph, { fontFamily: 'ReadexPro_700Bold' }]}>{corner.glyph}</Text>
          </View>
        ) : null}
        <View style={styles.heroInner}>
          <BackButton color="#fff" style={{ alignSelf: isRTL ? 'flex-end' : 'flex-start', marginBottom: SPACE.sm }} />
          <Text style={[styles.title, { fontFamily: 'ReadexPro_700Bold', textAlign: align }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { fontFamily: 'Almarai_400Regular', textAlign: align }]}>{subtitle}</Text>
          ) : null}
          {bandChildren}
        </View>
        {corner?.hairline ? <View style={[styles.hairline, { backgroundColor: corner.hairline }]} /> : null}
      </View>
      <ScrollView
        scrollEnabled={!locked}
        contentContainerStyle={{ paddingBottom: SPACE.hero, width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' }}
        showsVerticalScrollIndicator={false}
      >
        <ScrollLockContext.Provider value={setLocked}>{children}</ScrollLockContext.Provider>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingHorizontal: SPACE.lg, paddingBottom: SPACE.lg, overflow: 'hidden' },
  heroInner: { width: '100%', maxWidth: CONTENT_MAX_WIDTH, alignSelf: 'center' },
  title: { color: '#fff', fontSize: TYPE.title },
  subtitle: { color: 'rgba(255,255,255,0.85)', fontSize: TYPE.caption, marginTop: SPACE.xs },
  glyphWrap: { position: 'absolute', bottom: -SPACE.xl },
  // 3.5 × the hero step: a decoration, not a type size, so it is not a new
  // off-scale value for designScale.test.ts.
  glyph: { color: 'rgba(255,255,255,0.18)', fontSize: TYPE.hero * 3.5, lineHeight: TYPE.hero * 3.5 },
  hairline: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.75, borderRadius: RADIUS.xs },
});
```

Note on `designScale.test.ts`: this file adds no literal off-scale `fontSize`/`borderRadius`/spacing value, and Step 3 deletes `LabFrame`'s `fontSize: 22` (off-scale), so the ceilings hold.

- [ ] **Step 2: Write `CornerGrid`**

```tsx
// artifacts/mobile/components/corners/CornerGrid.tsx
/**
 * A corner hub's cards: one column on a phone, two on a tablet, three on
 * desktop (services/cornerLayout.ts), inside the frame's 1120px cap. Cards
 * carry no margins of their own — the grid pays the edges and the gutters —
 * so a card looks the same in a column and in a cell.
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useViewportWidth } from '@/hooks/useViewportWidth';
import { useLanguage } from '@/context/LanguageContext';
import { CONTENT_MAX_WIDTH } from '@/constants/layout';
import { SPACE } from '@/constants/theme';
import { cornerColumns } from '@/services/cornerLayout';

export function CornerGrid({ children }: { children: React.ReactNode }) {
  const viewportW = useViewportWidth();
  const { isRTL } = useLanguage();
  const cols = cornerColumns(Math.min(viewportW, CONTENT_MAX_WIDTH));
  const width: `${number}%` = `${100 / cols}%`;
  return (
    <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {React.Children.map(children, child =>
        child === null || child === undefined || child === false ? null : <View style={[styles.cell, { width }]}>{child}</View>,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexWrap: 'wrap', paddingHorizontal: SPACE.sm, paddingTop: SPACE.sm },
  cell: { padding: SPACE.sm },
});
```

- [ ] **Step 3: Turn the old frames into shims**

Replace the whole of `artifacts/mobile/components/math/MathFrame.tsx` with:

```ts
/** Kept for one PR so importers move gradually; PR 2 deletes it. Use `CornerFrame`. */
export { CornerFrame as MathFrame, useScrollLock } from '@/components/corners/CornerFrame';
```

Replace the whole of `artifacts/mobile/components/lab/LabFrame.tsx` with:

```ts
/** Kept for one PR so importers move gradually; PR 2 deletes it. Use `CornerFrame`. */
export { CornerFrame as LabFrame } from '@/components/corners/CornerFrame';
```

- [ ] **Step 4: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: clean, `# fail 0`. Every current importer (`app/curriculum/{math,lab,quran}/**`, `components/math/MathGrapher.tsx`, `MathSketchpad.tsx`, `components/quran/QuranGate.tsx`) still compiles through the shims. Nothing is wrapped yet, so every corner still renders teal — behaviour unchanged.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/corners artifacts/mobile/components/math/MathFrame.tsx artifacts/mobile/components/lab/LabFrame.tsx
git commit -m "feat(corners): CornerFrame and CornerGrid; MathFrame and LabFrame re-export them"
```

---

### Task 6: The Math Corner in indigo

**Files:**
- Create: `artifacts/mobile/app/curriculum/math/_layout.tsx`
- Modify: `artifacts/mobile/app/curriculum/math/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/math/[toolId].tsx` (import lines only)
- Modify: `artifacts/mobile/components/math/MathGrapher.tsx`, `MathSketchpad.tsx` (import line only)
- Test: `artifacts/mobile/services/__tests__/cornerTheme.test.ts` (structural tests added)

**Interfaces:**
- Consumes: `CornerThemeProvider` (Task 3), `CornerFrame`, `useScrollLock`, `CornerGrid` (Task 5).

- [ ] **Step 1: Add the structural tests (they fail until the layout exists)**

Append to `cornerTheme.test.ts`:

```ts
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Corners wired in PR 1. PR 2 adds 'english' and 'play' and removes this list. */
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
  // A `const X = palette.y` at module scope runs before any provider exists and
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
      assert.doesNotMatch(src, /^const \w+ = palette\./m, `${f} reads the palette at module scope`);
    }
  }
});
```

- [ ] **Step 2: Run to verify the first structural test fails**

Run: `pnpm test 2>&1 | grep -E "not ok|missing" | head -3`
Expected: FAIL — `math: .../app/curriculum/math/_layout.tsx missing`.

- [ ] **Step 3: Add the layout**

```tsx
// artifacts/mobile/app/curriculum/math/_layout.tsx
import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/math takes the Math Corner's hue (constants/corners.ts). */
export default function MathCornerLayout() {
  return (
    <CornerThemeProvider corner="math">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
```

- [ ] **Step 4: Move the hub onto `CornerFrame` + `CornerGrid`**

In `app/curriculum/math/index.tsx`:

Replace the import `import { MathFrame } from '@/components/math/MathFrame';` with
```ts
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
```

Replace `<MathFrame title={t('mathTitle')} subtitle={t('mathIntro')}>` with `<CornerFrame title={t('mathTitle')} subtitle={t('mathIntro')}>` and the closing `</MathFrame>` with `</CornerFrame>`.

Replace `<View style={styles.list}>` … `</View>` (the wrapper around the map and `<GeogebraLink />`) with `<CornerGrid>` … `</CornerGrid>`, and delete `list: { padding: SPACE.lg, gap: SPACE.md },` from `styles`. The rows keep `styles.row` unchanged (they carry no margins).

- [ ] **Step 5: Point the tool screen and the two canvases at the new file**

In `app/curriculum/math/[toolId].tsx`: `import { MathFrame } from '@/components/math/MathFrame';` → `import { CornerFrame } from '@/components/corners/CornerFrame';`, and rename the two `<MathFrame` / `</MathFrame>` pairs to `CornerFrame`.

In `components/math/MathGrapher.tsx` and `components/math/MathSketchpad.tsx`: `import { useScrollLock } from '@/components/math/MathFrame';` → `import { useScrollLock } from '@/components/corners/CornerFrame';` (keep the rest of the line identical).

- [ ] **Step 6: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: clean, `# fail 0`.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/app/curriculum/math artifacts/mobile/components/math/MathGrapher.tsx artifacts/mobile/components/math/MathSketchpad.tsx artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "feat(math-corner): indigo identity — provider layout, CornerFrame, hub grid"
```

---

### Task 7: The Lab in violet

**Files:**
- Create: `artifacts/mobile/app/curriculum/lab/_layout.tsx`
- Modify: `artifacts/mobile/app/curriculum/lab/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/lab/[itemId].tsx` (import + tag names)

- [ ] **Step 1: Run the structural test to see it fail for lab**

Run: `pnpm test 2>&1 | grep -E "not ok|missing" | head -3`
Expected: FAIL — `lab: .../app/curriculum/lab/_layout.tsx missing`. (The Task 6 test already lists `lab` in `WIRED`.)

- [ ] **Step 2: Add the layout**

```tsx
// artifacts/mobile/app/curriculum/lab/_layout.tsx
import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/lab takes the Lab's hue (constants/corners.ts). */
export default function LabLayout() {
  return (
    <CornerThemeProvider corner="lab">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
```

- [ ] **Step 3: Move the hub onto `CornerFrame` + `CornerGrid`**

In `app/curriculum/lab/index.tsx`:

Replace `import { LabFrame } from '@/components/lab/LabFrame';` with
```ts
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
```

Rename `<LabFrame …>` / `</LabFrame>` to `CornerFrame`.

Replace the list branch
```tsx
        shown.map(item => <ItemRow key={item.id} item={item} colors={colors} isRTL={isRTL} lang={lang} t={t} />)
```
with
```tsx
        <CornerGrid>
          {shown.map(item => <ItemRow key={item.id} item={item} colors={colors} isRTL={isRTL} lang={lang} t={t} />)}
        </CornerGrid>
```

In `styles.row`, delete the two lines `marginHorizontal: 16,` and `marginTop: 12,` — the grid pays the edges and gutters now. Leave `styles.chips` as it is (the chips are not in the grid).

- [ ] **Step 4: Point the item screen at the new file**

In `app/curriculum/lab/[itemId].tsx`: `import { LabFrame } from '@/components/lab/LabFrame';` → `import { CornerFrame } from '@/components/corners/CornerFrame';`, rename both `<LabFrame` / `</LabFrame>` pairs to `CornerFrame`.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: clean, `# fail 0`.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/app/curriculum/lab
git commit -m "feat(lab): violet identity — provider layout, CornerFrame, hub grid"
```

---

### Task 8: The Quran corner in green with a gold hairline

**Files:**
- Create: `artifacts/mobile/app/curriculum/quran/_layout.tsx`
- Modify: `artifacts/mobile/app/curriculum/quran/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/quran/[surahId]/index.tsx`, `memorize.tsx` (import + tag names)
- Modify: `artifacts/mobile/components/quran/QuranGate.tsx` (import + tag names)

- [ ] **Step 1: Run the structural test to see it fail for quran**

Run: `pnpm test 2>&1 | grep -E "not ok|missing" | head -3`
Expected: FAIL — `quran: .../app/curriculum/quran/_layout.tsx missing`.

- [ ] **Step 2: Add the layout**

```tsx
// artifacts/mobile/app/curriculum/quran/_layout.tsx
import { Stack } from 'expo-router';
import { CornerThemeProvider } from '@/context/CornerTheme';

/** Every screen under /curriculum/quran takes the Quran corner's hue (constants/corners.ts). */
export default function QuranCornerLayout() {
  return (
    <CornerThemeProvider corner="quran">
      <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />
    </CornerThemeProvider>
  );
}
```

- [ ] **Step 3: Move the hub onto `CornerFrame` + `CornerGrid`**

In `app/curriculum/quran/index.tsx`:

Replace `import { LabFrame } from '@/components/lab/LabFrame';` with
```ts
import { CornerFrame } from '@/components/corners/CornerFrame';
import { CornerGrid } from '@/components/corners/CornerGrid';
```

Rename `<LabFrame …>` / `</LabFrame>` to `CornerFrame`.

Wrap each group's surah rows and the resource rows:

```tsx
      {GROUPS.map(group => (
        <View key={group.gradeId}>
          <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
            {gradeName(group.gradeId)}
          </Text>
          <CornerGrid>
            {group.surahs.map(s => (
              <SurahRow key={s.number} surah={s} progress={progress} colors={colors} isRTL={isRTL} lang={lang} t={t} />
            ))}
          </CornerGrid>
        </View>
      ))}

      <Text style={[styles.heading, { color: colors.foreground, textAlign: align, fontFamily: 'ReadexPro_600SemiBold' }]}>
        {t('quranResourcesTitle')}
      </Text>
      <Text style={[styles.note, { color: colors.mutedForeground, textAlign: align, fontFamily: 'Almarai_400Regular' }]}>
        {t('quranResourcesNote')}
      </Text>
      <CornerGrid>
        {QURAN_RESOURCES.map(r => (
          <ResourceRow key={r.id} item={r} colors={colors} isRTL={isRTL} t={t} />
        ))}
      </CornerGrid>
```

In `styles.row`, delete `marginHorizontal: 16,` and `marginTop: 12,`. Change `heading`'s `marginTop: 20` to `marginTop: SPACE.md` (12 — the grid's own top padding adds 8) and leave `marginHorizontal: 16`.

- [ ] **Step 4: Point the surah screens and the gate at the new file**

In `app/curriculum/quran/[surahId]/index.tsx`, `app/curriculum/quran/[surahId]/memorize.tsx` and `components/quran/QuranGate.tsx`: `import { LabFrame } from '@/components/lab/LabFrame';` → `import { CornerFrame } from '@/components/corners/CornerFrame';`, and rename every `<LabFrame` / `</LabFrame>` to `CornerFrame`.

- [ ] **Step 5: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: clean, `# fail 0` — including the three structural tests, now that all of `WIRED` is wired.

- [ ] **Step 6: Commit**

```bash
git add artifacts/mobile/app/curriculum/quran artifacts/mobile/components/quran/QuranGate.tsx
git commit -m "feat(quran-corner): green identity with a gold hairline — provider layout, CornerFrame, hub grid"
```

---

### Task 9: The library tiles carry each corner's colour

**Files:**
- Modify: `artifacts/mobile/app/curriculum/resources.tsx` (the four corner tiles, ~lines 794–880)
- Test: `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `cornerTheme.test.ts`:

```ts
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
```

- [ ] **Step 2: Run to verify it fails**

Run: `pnpm test 2>&1 | grep -E "not ok|does not import" | head -3`
Expected: FAIL — `resources.tsx does not import the corner table`.

- [ ] **Step 3: Give the tiles their colours**

In `app/curriculum/resources.tsx`, next to `import { palette } from '@/constants/colors';`, add:

```ts
import { scheme } from '@/constants/colors';
import { CORNERS, type CornerId } from '@/constants/corners';
```

(Merge into the existing line: `import { palette, scheme } from '@/constants/colors';`.)

Below `const ACCENT = palette.primary;` add:

```ts
/** A corner tile's icon colours — the corner's own, so its hue is learned before it is entered. */
const cornerLook = (id: CornerId) => CORNERS[id][scheme];
```

Then in each of the four corner tiles replace the icon square:

| tile | find | replace with |
| --- | --- | --- |
| English (`/curriculum/english`) | `<View style={[styles.tileIcon, { backgroundColor: ACCENT + '1F' }]}>` + `<Ionicons name="headset" size={26} color={ACCENT} />` | `<View style={[styles.tileIcon, { backgroundColor: cornerLook('english').secondary }]}>` + `<Ionicons name="headset" size={26} color={cornerLook('english').primary} />` |
| Lab (`/curriculum/lab`) | same shape, `flask-outline` | `cornerLook('lab').secondary` / `cornerLook('lab').primary` |
| Math (`/curriculum/math`) | same shape, `calculator-outline` | `cornerLook('math').secondary` / `cornerLook('math').primary` |
| Quran (`/curriculum/quran`) | same shape, `book-outline` | `cornerLook('quran').secondary` / `cornerLook('quran').primary` |

Leave the curriculum tile (`<Ionicons name="book" …>`) and the student/parent «my exams» tile as they are. (There is no games tile in the library today; the spec's mock showed one, the real screen does not — nothing to do for `play` here.)

- [ ] **Step 4: Typecheck and test**

Run: `pnpm typecheck && pnpm test 2>&1 | grep -E "^# (pass|fail)|not ok"`
Expected: clean, `# fail 0`.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "feat(library): corner tiles carry each corner's colour"
```

---

### Task 10: Look at it — the screenshot pass

**Files:**
- Create: `e2e/screens.mjs`
- Create: `e2e/README-screens.md` (how to run; 6 lines)

**Interfaces:**
- Consumes: the web build in `artifacts/mobile/dist`, `e2e/serve.mjs`, `@playwright/test` from `e2e/node_modules`.

- [ ] **Step 1: Write the script**

```js
// e2e/screens.mjs
// Screenshots the corners and the library on the built web bundle, phone and
// desktop, light and dark, with a fake teacher session and every /api call
// stubbed. For looking at, not diffing: the point is a human eye on the hues
// on real screens before a PR. Run `node serve.mjs` first (port 8098), then
// `OUT=/tmp/shots node screens.mjs`.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = process.env.OUT ?? './screens-out';
const BASE = process.env.BASE ?? 'http://localhost:8098';
mkdirSync(OUT, { recursive: true });

const teacher = {
  id: 'u-teacher', firstName: 'سارة', lastName: 'الخطيب', name: 'سارة الخطيب', email: 't@example.com',
  role: 'teacher', preferredLanguage: 'ar', avatarUrl: null, createdAt: '2026-01-01T00:00:00Z',
  gradeIds: ['grade-10'], subjectIds: ['mathematics'],
};

const ROUTES = [
  ['library', '/curriculum/resources'],
  ['math-hub', '/curriculum/math'],
  ['math-grapher', '/curriculum/math/grapher'],
  ['lab-hub', '/curriculum/lab'],
  ['quran-hub', '/curriculum/quran'],
  ['english-hub', '/curriculum/english?grade=1'],
  ['play-hub', '/play'],
];
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'desktop', width: 1366, height: 860, isMobile: false, hasTouch: false, deviceScaleFactor: 1 },
];

let browser;
try { browser = await chromium.launch(); }
catch { browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' }); }

for (const colorScheme of ['light', 'dark']) {
  for (const vp of VIEWPORTS) {
    for (const [name, path] of ROUTES) {
      const { name: _vpName, width, height, ...device } = vp;
      const ctx = await browser.newContext({ ...device, viewport: { width, height }, locale: 'ar-JO', colorScheme });
      await ctx.addInitScript((who) => {
        localStorage.setItem('@iqra_language', 'ar');
        localStorage.setItem('@iqra_intro_seen_v1', '1');
        localStorage.setItem('iqra_access_token', 'fake');
        localStorage.setItem('iqra_refresh_token', 'fake');
        localStorage.setItem('@iqra_user_snapshot_v1', JSON.stringify(who));
      }, teacher);
      await ctx.route('**/api/**', (route) => {
        const p = new URL(route.request().url()).pathname.replace(/^\/api/, '');
        const body = p === '/auth/me' ? teacher : /s$/.test(p) ? [] : {};
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await ctx.newPage();
      try {
        await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 30000 });
        await page.waitForTimeout(1200);
        await page.screenshot({ path: `${OUT}/${colorScheme}-${vp.name}-${name}.png` });
        console.log(`${colorScheme} ${vp.name} ${name}`);
      } catch (e) {
        console.log(`${colorScheme} ${vp.name} ${name} FAILED ${String(e.message).slice(0, 80)}`);
      }
      await ctx.close();
    }
  }
}
await browser.close();
```

- [ ] **Step 2: Write the README**

```md
# Screens pass

Looks, not asserts. From the repo root:

1. `cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web`
2. `cd e2e && node serve.mjs &` (serves `dist/` on :8098)
3. `OUT=/tmp/shots node screens.mjs` — then open the PNGs. Dark mode uses `prefers-color-scheme`, which the app reads once at startup.
```

- [ ] **Step 3: Build, serve, shoot, look**

Run (from the repo root):
```bash
cd artifacts/mobile && EXPO_PUBLIC_API_BASE_URL=http://localhost:8099/api EXPO_PUBLIC_DEMO_MODE=true pnpm run build:web
cd ../../e2e && (node serve.mjs &) && sleep 2 && OUT=/tmp/claude-0/-home-user-Iqraa/56f8cf83-ca77-5f09-a10e-0e07ede3998f/scratchpad/pr1-shots node screens.mjs
```
Expected: 28 PNGs, no `FAILED` lines. Open the phone and desktop shots of the three wired hubs and the library (`montage` into one sheet if ImageMagick is present). Check:
  - the math band is indigo with the grid, lab violet with hexagons, quran green with stars and a gold line; the English and games hubs are still teal (PR 2);
  - icon squares, chevrons, chips and buttons inside each corner took the hue; nothing teal is left inside a wired corner except the tab bar, which is outside the frame;
  - the library's four corner tiles show four different icon tints and the curriculum tile stays teal;
  - at 1366px the hub cards sit in three columns under a band whose title aligns with the first column;
  - dark mode: primary is the light 300-level, bands stay deep, no black text on a dark fill.
Fix anything wrong in the task that owns it and re-shoot.

- [ ] **Step 4: Commit**

```bash
git add e2e/screens.mjs e2e/README-screens.md
git commit -m "chore(e2e): screens.mjs — screenshot pass for the corners and the library"
```

---

### Task 11: Docs, the whole check, push, PR

**Files:**
- Modify: `STATUS.md` (new section, inserted directly above `## One question-type order, one set of repeat-rule inputs, 2026-10-18`)
- Modify: `CLAUDE.md` (one bullet appended to «Things that have bitten before»)

- [ ] **Step 1: STATUS.md section**

```md
## Each corner has its own colour and band, 2026-10-21 (PR 1 of 2)

**What changed.** The Math Corner is indigo with graph paper, the Lab violet
with a hexagon lattice, the Quran corner deep green with eight-point stars and
a gold hairline — band, icon tints, chips and buttons — on top of the shared
cards, type and spacing. The library's corner tiles show each corner's colour.
At desktop width a hub's cards sit in up to three columns under a band whose
title aligns with them. Design:
`docs/superpowers/specs/2026-10-21-corner-identities-design.md`; plan:
`docs/superpowers/plans/2026-10-21-corner-identities-pr1.md`.

**How.** `constants/corners.ts` is the one table (light + dark tokens, motif,
glyph); `context/CornerTheme.tsx` is mounted by each corner directory's
`_layout.tsx`; `hooks/useColors.ts` spreads the corner's tokens over the
palette, so every component under it follows. `components/corners/CornerFrame`
replaced `MathFrame` and `LabFrame`, which re-export it until PR 2 deletes
them. `cornerTheme.test.ts` measures every pair at ≥ 4.5:1 in both schemes and
pins the structure: a wired corner has a provider layout, nothing else does,
and no corner code reads the palette at module scope.

**Not yet.** English corner and games (PR 2), which still open teal; the
browser's English banner; `app/play/index.tsx` still holds module-scope
palette constants, which is why `WIRED` in the test lists three corners.
Dark-mode secondaries were measured by the test, not by eye on a device.
```

- [ ] **Step 2: CLAUDE.md bullet**

Append to the «Things that have bitten before» list:

```md
- **A corner's colour lives in one table (since 2026-10-21).** `constants/corners.ts`
  holds each corner's tokens; `CornerThemeProvider` (mounted only by the
  `_layout.tsx` of a corner directory) puts them in context and `useColors()`
  spreads them over the palette, so a shared button or chip inside a corner is
  that corner's colour with no edit. Two traps: a module-scope
  `const ACCENT = palette.primary` runs before any provider and stays teal, and
  the library (`/curriculum/resources`) is deliberately **not** a corner — its
  tiles borrow each corner's colour, its own chrome is brand teal.
  `cornerTheme.test.ts` fails both. A new corner is one table row, one layout
  file, and a `CornerFrame`.
```

- [ ] **Step 3: The whole check**

Run from `artifacts/mobile`: `pnpm typecheck && pnpm test 2>&1 | tail -8`
Run from the repo root: `pnpm run typecheck`
Expected: both clean; `# fail 0`.

- [ ] **Step 4: Commit and push**

```bash
git add STATUS.md CLAUDE.md
git commit -m "docs: corner identities PR 1 in STATUS and CLAUDE"
git push -u origin ccr-67f8e601-xopnnx
```

- [ ] **Step 5: Retitle PR #1167**

Title: `Corner identities (1/2): Math, Lab and Quran get their own colour and band; library tiles follow`. Body: keep the spec paragraph, add «What is in this PR» (the STATUS section's first two paragraphs) and «Not in this PR» (its third), and the screenshot sheet from Task 10 attached as an image. Mark ready for review only when CI is green.
