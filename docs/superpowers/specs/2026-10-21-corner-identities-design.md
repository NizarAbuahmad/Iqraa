# Corner identities — a colour and a signature header per corner

**Date:** 2026-10-21 · **Status:** approved in discussion, awaiting spec review ·
**Scope:** `artifacts/mobile`

## Why

Comments on the app's look came back as «dull, everything looks the same». A
screenshot pass over the current build (phone 390px and desktop 1366px, Arabic,
signed out, as a teacher and as a student) agrees, and says why: the library,
the Math Corner, the English corner, the lab, the Quran corner and the games
hub all open with the identical solid teal band, the same intro paragraph, and
the same white rows with the same teal-tinted icon square. Only the title says
where you are. The library's own tiles for the five corners are pixel-identical
apart from the glyph. Teal does every job at once: page band, selected chip,
primary button, icon tint, tab highlight.

The foundation is not the problem — one type pair (Readex Pro + Almarai), a
4-point spacing scale, contrast-checked tokens, RTL-first — so this is not a
restyle. It gives each corner an identity on top of the shared system, and
makes the library and the browser carry that identity so it is learned before
the corner is entered. The games hub, the one screen today with per-item
colour, is visibly the liveliest screen in the app; that is the evidence.

Two smaller findings ride along: at desktop width the corner hubs stretch a
single column of short rows across the whole 1120px cap, reading as a
spreadsheet under a thin strip; and the games hub keeps module-level colour
constants (`const ACCENT = palette.primary`) that would ignore any theme.

## Goals

- Each of the five corners — Math, English, Lab, Quran, Games — has its own
  hue applied to its band, icon tints, selected chips and primary buttons, and
  a band with its own motif, **without** changing cards, type, spacing or layout
  rules. One app, five rooms.
- The library tiles and the browser's English banner carry each corner's colour.
- A seventh corner costs one table row and one two-line layout file.
- Every new colour pair meets the repo's ≥ 4.5:1 rule, light and dark, with the
  same margins the teal palette keeps; a test measures it, nobody eyeballs it.
- Desktop corner hubs become a card grid in a sensible column.

## Non-goals

- Teacher tools, school, messages, profile, auth, the home workspace and the
  curriculum browser keep brand teal. The library stays teal: it is the shelf
  the corners sit on, not a corner.
- No layout, card-shape or typography differences per corner.
- No live dark-mode switching (the scheme stays fixed at startup, as today).
- The per-game colours on the games grid and inside `GameShell` are kept as
  they are; only the hub's band and chrome take the games hue.

## Section 1 — identities and tokens (approved)

Light scheme. `hero` is the band (white text on it), `primary` is text, links,
buttons and the active chip fill, `secondary` the icon-square tint,
`selected` the chosen chip/row fill. `tint` = `primary`, `primaryForeground` =
white, `secondaryForeground` = `primary`. Everything else (`text`, `card`,
`border`, `muted`, `destructive`…) stays the global palette.

| Corner | hero | primary | secondary | selected | motif | motif opacity |
| --- | --- | --- | --- | --- | --- | --- |
| math | `#3730A3` | `#4338CA` | `#F2F1FB` | `#E5E3F8` | graph paper + one curve | 0.14 |
| english | `#C2410C` | `#C2410C` | `#FBF4F0` | `#FAF0EC` | speech bubbles «Hi!» «Hello» «ABC» | 0.10 |
| lab | `#5B21B6` | `#6D28D9` | `#F5F0FC` | `#EBE1FA` | hexagon lattice | 0.14 |
| quran | `#14532D` | `#166534` | `#ECF3EF` | `#DCE8E1` | eight-point stars; 3px gold hairline (`#E3C25C`, 0.75) under the band | 0.14 |
| play | `#BE185D` | `#BE185D` | `#FAEFF4` | `#F6DFE8` | confetti dots and stars | 0.14 |

Measured (WCAG relative luminance, same formula as `services/readableColor.ts`):
white on every hero ≥ 5.18:1; primary on white ≥ 5.18; primary on paper
`#F6F5F1` ≥ 4.75; primary on its `secondary` ≥ 4.76; primary on its `selected`
≥ 4.62; **muted `#5C6675` on `selected` ≥ 4.61** — that pair is the binding
one (it is the pair that failed at 4.08 in the teal palette's history), which
is why these selected fills are lighter than the teal `#CDE9E3`: the hues are
darker than teal, so the tint has to be lighter to keep a grey caption legible.

Dark scheme: `primary` is a 300-level of the hue with navy text on it
(`primaryForeground` `#081B3A`), `hero` stays deep enough for white text, and
`secondary`/`selected` are dark tints of the hue on the navy page.

| Corner | hero (dark) | primary (dark) | secondary (dark) | selected (dark) |
| --- | --- | --- | --- | --- |
| math | `#3730A3` | `#A5B4FC` | `#1C1D47` | `#2E2A6B` |
| english | `#9A3412` | `#FDBA74` | `#3A1F10` | `#5A2A10` |
| lab | `#5B21B6` | `#C4B5FD` | `#261B47` | `#3B2A6B` |
| quran | `#14532D` | `#86EFAC` | `#10281C` | `#1A3D2A` |
| play | `#9D174D` | `#F9A8D4` | `#331222` | `#4A1A33` |

Measured: primary on navy `#0A1628` ≥ 9.0; navy text on primary ≥ 8.5; white on
dark hero ≥ 7.3; primary on dark selected ≥ 6.3; dark muted `#9AA9BC` on dark
selected ≥ 4.95. The secondary (dark) values are proposed and must pass the
same test before merge; the test, not this table, is the source of truth.

The large corner glyph (∑, Aa, ⚗, ۞, ★) in the band's far corner is phone
only: at desktop width it would sit under the back button.

## Section 2 — mechanism: one table, one provider, one hook

**`constants/corners.ts`** (pure data, no React imports, so `node --test` can
read it):

```ts
export type CornerId = 'math' | 'english' | 'lab' | 'quran' | 'play';
export type CornerTokens = Pick<Palette, 'hero' | 'primary' | 'primaryForeground' | 'tint' | 'secondary' | 'secondaryForeground' | 'selected'>;
export type Corner = {
  id: CornerId;
  route: string;                    // '/curriculum/math' …
  icon: IoniconName;                // the library tile and hub glyph
  motif: 'grid' | 'bubbles' | 'hex' | 'stars' | 'confetti';
  motifOpacity: number;
  glyph: string;                    // '∑' …, phones only
  hairline?: string;                // quran: '#E3C25C'
  light: CornerTokens;
  dark: CornerTokens;
};
export const CORNERS: Record<CornerId, Corner>;
export const CORNER_IDS: readonly CornerId[];   // library tile order
```

**`context/CornerTheme.tsx`**: `CornerThemeProvider({ corner, children })`
puts `CORNERS[corner][scheme]` in a context. **`hooks/useColors.ts`** reads
that context first:

```ts
export function useColors() {
  const corner = useContext(CornerThemeContext);   // null outside a corner
  return { ...palette, ...(corner ?? {}), radius: colors.radius };
}
```

So every component rendered under the provider — `Button`, `Input`,
`EmptyState`, `BackButton`, chips, switches, the frame itself — takes the
corner's hue with no edit, which is the point of approach 1 over passing
colours as props. The provider is mounted by a layout file per corner
directory, the repo's existing nested-layout shape
(`app/ai-tools/classroom/_layout.tsx`):

```tsx
// app/curriculum/math/_layout.tsx  (and english/, lab/, quran/, app/play/)
export default function MathLayout() {
  return (
    <CornerThemeProvider corner="math">
      <Stack screenOptions={{ headerShown: false }} />
    </CornerThemeProvider>
  );
}
```

**The trap this creates, and its guard.** A screen that reads the palette at
module scope (`const ACCENT = palette.primary`) is outside React and sees no
provider. `app/play/index.tsx` does this today (lines 25–27) and is fixed in
this work. `cornerTheme.test.ts` (Section 7) fails the build if any file under
a corner directory or a corner's component directory declares one, the way
`paperOrder.test.ts` reads `quiz.tsx` to pin an import.

Routes under `/curriculum` other than the four corner directories, and every
other screen, render with no provider and are byte-for-byte unchanged.

## Section 3 — `CornerFrame`, replacing `MathFrame` and `LabFrame`

`MathFrame` and `LabFrame` are the same component twice (band, back button,
title, subtitle, width-capped `ScrollView`), differing only in that `MathFrame`
adds the scroll-lock context the grapher needs. They merge into
**`components/corners/CornerFrame.tsx`**:

```ts
type Props = {
  title: string;
  subtitle?: string;
  /** Rendered inside the band under the subtitle — grade chips, a switch. */
  bandChildren?: React.ReactNode;
  children: React.ReactNode;
};
```

- Band: `colors.hero`, then `<CornerMotif>` absolutely filled at the corner's
  `motifOpacity`, then the glyph (phone widths only), then the back button,
  title and subtitle; the quran hairline last. The band stays full-bleed, but
  its **inner content is capped at `CONTENT_MAX_WIDTH` and centred**, so the
  title lines up with the list below it on desktop instead of hugging the
  window edge.
- The desktop grid is a sibling component, `CornerGrid` (`components/corners/CornerGrid.tsx`),
  that a hub wraps around its cards — not a frame prop, because the lab and
  Quran hubs interleave headings and chip rows with their cards.
- `useScrollLock()` moves here unchanged; `MathFrame` and `LabFrame` become
  one-line re-exports for one PR and are deleted in the second (Section 8).
- The frame takes **no colour props**. It reads `useColors()`; the provider
  decides the hue. Rendered outside any provider it is simply teal, which is
  what a future non-corner caller should get.

**`components/corners/CornerMotif.tsx`**: one `react-native-svg` component,
`motif` → a `<Pattern>`-tiled or hand-placed drawing in white, sized to the
band. Five motifs, each a function returning SVG nodes; no raster assets, so
nothing to ship per density and nothing to bump in `app.json` (`react-native-svg`
is already in the binary).

## Section 4 — adopting it, corner by corner

| Corner | today | change |
| --- | --- | --- |
| Math `app/curriculum/math/*` | `MathFrame` | `_layout.tsx`; `MathFrame` → `CornerFrame`; hub uses `layout="hub"`. Tool screens otherwise untouched (their canvases draw with `colors.primary`, which now reads indigo). |
| Lab `app/curriculum/lab/*` | `LabFrame` | `_layout.tsx`; `LabFrame` → `CornerFrame`; hub `layout="hub"`. Check `LabPeriodicTable`'s category colours still read on violet chrome — they are their own palette and stay. |
| Quran `app/curriculum/quran/**` | `LabFrame` (index, surah, memorize) | `_layout.tsx`; `LabFrame` → `CornerFrame`; hub `layout="hub"`. The mushaf text, its font and the audio controls are unchanged. |
| English `app/curriculum/english/*` | inline band in `index.tsx` and `[lessonId].tsx` (`colors.hero`, grade chips and the reminder `Switch` inside it) | `_layout.tsx`; both bands → `CornerFrame` with the chips/switch as `bandChildren`. The `Switch`'s `thumbColor={colors.hero}` and streak/badge colours follow the hook. |
| Games `app/play/*` | inline band in `index.tsx`, `ACCENT`/`ACCENT_FILL` at module scope | `_layout.tsx`; hub band → `CornerFrame`; the two module constants become `colors.*` reads. The per-game card colours (`GAMES[].color`) and `GameShell`'s per-game band stay as they are: the game decides its own colour once inside. |

The library's `/curriculum/resources` and the browser are **not** wrapped.

## Section 5 — entry points: library tiles, browser banner, desktop grid

- **Library tiles** (`app/curriculum/resources.tsx`, the five corner tiles):
  icon circle takes `CORNERS[id].light.secondary` / `.primary` (per scheme)
  instead of `ACCENT + '1F'` / `ACCENT`; the glyph is `CORNERS[id].icon`. The
  curriculum tile, the games tile's position and the role-gated tiles are
  unchanged. The tiles keep their white card and teal everything-else: the
  colour is a cue, not a theme change on the library.
- **Browser banner** (`app/curriculum/browse.tsx` «ركن الإنجليزية» banner, and
  the link in `lesson-detail.tsx`): background `CORNERS.english[scheme].hero`.
- **Desktop hub grid.** `CornerGrid` lays its children in
  `cornerColumns(width)` columns (3 ≥ 960px track, 2 ≥ 600px, else 1 — the same
  breaks as `libraryColumns`, kept as its own function so the two can drift on
  purpose), inside the existing 1120px cap. On a phone nothing changes. The
  math hub's `GeogebraLink` is one more grid cell.

## Section 6 — dark mode

The provider picks `CORNERS[id][scheme]` with the same startup-fixed `scheme`
from `constants/colors.ts`. No live switching is added; the ponytail note there
still applies. The screenshot pass before each PR runs both schemes (Section 7).

## Section 7 — testing

**`services/__tests__/cornerTheme.test.ts`** (inside the mobile test glob;
imports only `constants/corners.ts` and `services/readableColor.ts`, both
import-free of React Native):

1. For every corner and both schemes: white on `hero` ≥ 4.5; `primary` on
   `#FFFFFF`/paper (light) or on the navy page (dark) ≥ 4.5; `primaryForeground`
   on `primary` ≥ 4.5; `primary` on `secondary` and on `selected` ≥ 4.5; the
   scheme's `mutedForeground` on `selected` ≥ 4.5; the scheme's `foreground`
   on `selected` ≥ 4.5.
2. Every `CORNER_IDS` entry has a `_layout.tsx` in its route directory whose
   source contains `CornerThemeProvider corner="<id>"`, and no other
   `_layout.tsx` under `app/` mounts a provider (the library must never be
   wrapped by accident).
3. No file under a corner route directory or under `components/{math,lab,
   quran,englishHub,publicGames,corners}` matches `/^const \w+ = palette\./m`.
4. `resources.tsx` imports `CORNERS` and no longer contains `ACCENT + '1F'`
   inside the corner tiles (read the source, as `paperOrder.test.ts` does).
5. `designScale.test.ts` keeps passing: the frame and motif use `TYPE`/`SPACE`/
   `RADIUS` only.

**Visual check, not automated:** the Playwright pass used for this spec
(serves `dist/`, plants a fake session, stubs `/api/**`) is kept as
`e2e/screens.mjs` and run before each PR at 390px and 1366px, light and dark,
for the five hubs, one inner screen per corner, and the library. Its output is
looked at, not diffed — the point is a human eye on the hues on real screens.

## Section 8 — rollout

Two PRs, so each review fits on a screen:

1. **Mechanism + three corners:** `constants/corners.ts`, provider, hook
   change, `CornerFrame` + `CornerMotif`, layouts and adoption for Math, Lab
   and Quran, the library tiles, `cornerTheme.test.ts`, `e2e/screens.mjs`.
   `MathFrame`/`LabFrame` re-export `CornerFrame`.
2. **English + Games + cleanup:** the two inline bands → `CornerFrame`, the
   games constants, the browser banner, delete the two re-export shims.

Pure JS and SVG: no native module changes, so **no `app.json` `version` bump**
(see CLAUDE.md on the OTA runtime key). Each PR updates STATUS.md and adds one
CLAUDE.md bullet: *a corner's colour lives in one table* — the provider, the
module-scope trap, and that the library is deliberately not wrapped.

## Risks and open points

- `useColors()` is called in nearly every screen; adding a `useContext` read is
  negligible, but it must stay a hook (no conditional call sites).
- Screens that compute colours from `colors.primary` for canvases (grapher,
  sketchpad) will draw in indigo. Reviewed as intended; the mock shows the curve
  in the hue and it reads.
- The English corner's gold streak/badge colours were chosen against teal;
  check them on orange in the screenshot pass and adjust `BADGE_META` only if
  they vanish.
- Deepened lab hero (`#5B21B6`) vs. its button (`#6D28D9`): two violets on one
  screen is deliberate (band darker than controls) and mirrors how dark mode
  already splits teal into `hero` and `primary`.
