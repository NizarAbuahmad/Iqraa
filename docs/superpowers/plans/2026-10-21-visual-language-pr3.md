# Shared Visual Language (PR 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the app depth, press feedback, entry motion and gradient bands
through a few shared pieces. Use them on the five corners, the library and
Profile.

**Architecture:**
- Pure data and arithmetic (`ELEVATION`, `MOTION`, `entranceDelay`, `shade`,
  `bandGradient`) live where `node --test` can load them, and are tested
  there.
- Four React Native pieces in `components/ui` (`Surface`/`useSurface`,
  `PressableScale`, `Entrance`, `Band`) and one hook (`useReduceMotion`) build
  on that data.
- Screens adopt the pieces. Source-reading tests in `cornerTheme.test.ts` pin
  that they did.

**Tech Stack:** Expo SDK 54, React Native 0.81.5 (new architecture, so
`boxShadow` works), react-native-web 0.21, `expo-linear-gradient` (already
installed and already used by the app, so the native surface does not change
and there is no `app.json` version bump), `react-native-svg`, `node --test`.

**Spec:** `docs/superpowers/specs/2026-10-21-visual-language-design.md`

## Global Constraints

- **Working directory.** Run app commands in `artifacts/mobile`. The tests are
  `pnpm test` (bare `node --test` over `services/__tests__/**/*.test.ts`).
  Run the typecheck from the repo root with `pnpm run typecheck`.
- **What a test may import.** A file loaded by `node --test` must not import
  `react-native` or `expo-*`. Its relative imports need an explicit `.ts`
  extension.
- **Colour.**
  - Every text/background pair is at least 4.5:1.
  - Text on a `primary` fill is `primaryForeground`, never `'#fff'`.
  - Corner code takes colours from `useColors()`, never from the global
    `palette` (`cornerTheme.test.ts` enforces this).
- **Scale.** New styles use `TYPE`/`SPACE`/`RADIUS` from
  `constants/theme.ts`. `designScale.test.ts` must keep passing.
- **Driver.** Every `Animated` call passes `useNativeDriver: NATIVE_DRIVER`
  from `constants/animation.ts`, never a literal.
- **Reduce motion.** When the device asks for reduced motion, nothing slides
  or scales.
- **Direction.** Layout direction stays per component: `flexDirection: isRTL ?
  'row-reverse' : 'row'`, as the surrounding code does.
- **Commits.** Commit messages end with exactly these two lines:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
  ```
  Write no model name anywhere else.

---

### Task 1: Tokens and pure helpers

**Files:**
- Modify: `artifacts/mobile/constants/theme.ts` (append `ELEVATION`)
- Create: `artifacts/mobile/services/motion.ts`
- Create: `artifacts/mobile/services/band.ts`
- Test: create `artifacts/mobile/services/__tests__/motion.test.ts`
- Test: create `artifacts/mobile/services/__tests__/band.test.ts`
- Test: modify `artifacts/mobile/services/__tests__/cornerTheme.test.ts`
- Test: modify `artifacts/mobile/services/__tests__/designScale.test.ts`

**Interfaces:**
- Produces:
  - `ELEVATION: { card: string; raised: string }` and
    `type Elevation = 'card' | 'raised'` (`constants/theme.ts`)
  - `MOTION: { enterMs: 220; rise: 8; staggerMs: 40; staggerCap: 6; pressScale: 0.97 }`
    and `entranceDelay(index: number): number` (`services/motion.ts`)
  - `BAND_DEEPEN = 0.18`, `shade(hex: string, amount: number): string` and
    `bandGradient(hero: string): [string, string]` (`services/band.ts`)

- [ ] **Step 1: Write the failing tests**

Create `artifacts/mobile/services/__tests__/motion.test.ts`:

```ts
// Pins the entry stagger used by components/ui/Entrance.tsx
// (docs/superpowers/specs/2026-10-21-visual-language-design.md).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MOTION, entranceDelay } from '../motion.ts';

test('the first card starts at once and each next one a stagger later', () => {
  assert.equal(entranceDelay(0), 0);
  assert.equal(entranceDelay(1), MOTION.staggerMs);
  assert.equal(entranceDelay(3), 3 * MOTION.staggerMs);
});

test('cards past the cap start together, so a long list does not crawl in', () => {
  const last = MOTION.staggerCap * MOTION.staggerMs;
  assert.equal(entranceDelay(MOTION.staggerCap), last);
  assert.equal(entranceDelay(MOTION.staggerCap + 1), last);
  assert.equal(entranceDelay(400), last);
});

test('a bad index starts at once', () => {
  assert.equal(entranceDelay(-2), 0);
  assert.equal(entranceDelay(Number.NaN), 0);
  assert.equal(entranceDelay(Number.POSITIVE_INFINITY), 0);
});

test('the slowest card is in place within half a second', () => {
  assert.ok(MOTION.staggerCap * MOTION.staggerMs + MOTION.enterMs <= 500);
});
```

Create `artifacts/mobile/services/__tests__/band.test.ts`:

```ts
// Pins the band gradient used by components/ui/Band.tsx.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BAND_DEEPEN, bandGradient, shade } from '../band.ts';

test('shade moves a colour toward black by the given share', () => {
  assert.equal(shade('#FFFFFF', 0), '#FFFFFF');
  assert.equal(shade('#ffffff', 0.5), '#808080');
  assert.equal(shade('#3730A3', 1), '#000000');
});

test('shade clamps the share to 0–1', () => {
  assert.equal(shade('#3730A3', -1), '#3730A3');
  assert.equal(shade('#3730A3', 2), '#000000');
});

test('a band starts at its hero colour and only deepens', () => {
  const [from, to] = bandGradient('#006D65');
  assert.equal(from, '#006D65');
  assert.equal(to, shade('#006D65', BAND_DEEPEN));
  assert.ok(BAND_DEEPEN > 0 && BAND_DEEPEN < 0.4);
});
```

In `artifacts/mobile/services/__tests__/cornerTheme.test.ts`, add this import
after the `readableColor.ts` import:

```ts
import { bandGradient } from '../band.ts';
```

Then add this test after the `'motif opacity stays subtle enough for the band text'` test:

```ts
// palette.hero, copied from constants/colors.ts (which cannot be imported here).
const BRAND_HERO = { light: '#006D65', dark: '#0F766E' };

test('band text reads on both stops of every band gradient', () => {
  const heroes: [string, string][] = [
    ...CORNER_IDS.flatMap((id): [string, string][] => [
      [`${id} light`, CORNERS[id].light.hero],
      [`${id} dark`, CORNERS[id].dark.hero],
    ]),
    ['brand light', BRAND_HERO.light],
    ['brand dark', BRAND_HERO.dark],
  ];
  for (const [what, hero] of heroes) {
    for (const stop of bandGradient(hero)) {
      atLeast(WHITE, stop, `${what} band title`);
      atLeast(blendWhite(0.85, stop), stop, `${what} band subtitle`);
    }
  }
});
```

In `artifacts/mobile/services/__tests__/designScale.test.ts`:
- Add `shadowColor` to `CEILING`. For now set it to `0`, so the new test fails
  and reports the real count.
- Add this test at the end of the file:

```ts
test('hand-written shadows do not grow — use ELEVATION', () => {
  const n = sources.reduce((k, s) => k + (s.match(/\bshadowColor\s*:/g) ?? []).length, 0);
  assert.ok(n <= CEILING.shadowColor, `${n} hand-written shadowColor values (ceiling ${CEILING.shadowColor}) — use ELEVATION in constants/theme.ts through useSurface()`);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd artifacts/mobile && node --test services/__tests__/motion.test.ts services/__tests__/band.test.ts services/__tests__/cornerTheme.test.ts services/__tests__/designScale.test.ts`

Expected: these fail.
- `motion.test.ts` and `band.test.ts`: cannot find `../motion.ts` / `../band.ts`.
- `cornerTheme.test.ts`: cannot find `../band.ts`.
- `designScale.test.ts`: the shadow test fails with a message like
  "8 hand-written shadowColor values (ceiling 0)". Note the number.

- [ ] **Step 3: Write the implementation**

Create `artifacts/mobile/services/motion.ts`:

```ts
/**
 * Motion timings, shared by `Entrance` and `PressableScale` (components/ui).
 * Pure data and arithmetic, so `node --test` can read it.
 */
export const MOTION = {
  /** How long a card takes to fade and rise into place. */
  enterMs: 220,
  /** How far below its place a card starts, in px. */
  rise: 8,
  /** The gap between one card starting and the next. */
  staggerMs: 40,
  /** Cards from this position on start together, so a long list does not crawl in. */
  staggerCap: 6,
  /** How far a held card shrinks. */
  pressScale: 0.97,
} as const;

/** When the card at `index` (0-based, in reading order) starts entering, in ms. */
export function entranceDelay(index: number): number {
  if (!Number.isFinite(index) || index <= 0) return 0;
  return Math.min(Math.floor(index), MOTION.staggerCap) * MOTION.staggerMs;
}
```

Create `artifacts/mobile/services/band.ts`:

```ts
/**
 * A header band's gradient: the hero colour, deepening toward the far corner.
 * It only ever deepens, so white text that reads on the hero reads at the
 * other stop too. cornerTheme.test.ts measures both stops for every corner
 * and for the brand teal.
 */
export const BAND_DEEPEN = 0.18;

/** `hex` (#RRGGBB) moved `amount` (0–1, clamped) of the way to black, as upper-case #RRGGBB. */
export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const keep = 1 - Math.min(Math.max(amount, 0), 1);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(c => Math.round(c * keep));
  return '#' + channels.map(c => c.toString(16).padStart(2, '0')).join('').toUpperCase();
}

/** The two stops of a band drawn in `hero`. */
export function bandGradient(hero: string): [string, string] {
  return [hero, shade(hero, BAND_DEEPEN)];
}
```

Append to `artifacts/mobile/constants/theme.ts`:

```ts
/**
 * Depth: CSS box-shadow strings in the brand navy. React Native 0.81 (new
 * architecture) and react-native-web both take them as `boxShadow`.
 *
 * Light mode only. A shadow does not show on the navy dark page, so a dark
 * card keeps a 1px border instead. `useSurface` (components/ui/Surface.tsx)
 * makes that choice; take depth from it, not from hand-written
 * `shadowColor`/`shadowOpacity`, which designScale.test.ts counts.
 */
export const ELEVATION = {
  card: '0px 1px 2px rgba(11, 27, 51, 0.06), 0px 4px 14px rgba(11, 27, 51, 0.06)',
  raised: '0px 2px 4px rgba(11, 27, 51, 0.08), 0px 8px 24px rgba(11, 27, 51, 0.10)',
} as const;

export type Elevation = keyof typeof ELEVATION;
```

In `designScale.test.ts`:
- Set `CEILING.shadowColor` to the count Step 2 reported (8 was measured on
  2026-10-21).
- Extend the header comment's last sentence with: "`shadowColor` is counted
  the same way: new depth comes from `ELEVATION` through `useSurface()`."

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd artifacts/mobile && node --test services/__tests__/motion.test.ts services/__tests__/band.test.ts services/__tests__/cornerTheme.test.ts services/__tests__/designScale.test.ts`

Expected: all pass. If the gradient test fails for a corner, stop and report
the failing pair. Do not change `BAND_DEEPEN` or any corner colour to make it
pass.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/constants/theme.ts artifacts/mobile/services/motion.ts artifacts/mobile/services/band.ts artifacts/mobile/services/__tests__/motion.test.ts artifacts/mobile/services/__tests__/band.test.ts artifacts/mobile/services/__tests__/cornerTheme.test.ts artifacts/mobile/services/__tests__/designScale.test.ts
git commit -m "$(cat <<'EOF'
Visual language: elevation, motion and band-gradient tokens

ELEVATION (light-mode box shadows), MOTION and entranceDelay, and the band
gradient, with its contrast measured on both stops for every corner and the
brand teal. designScale now counts hand-written shadowColor too.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 2: The shared pieces

**Files:**
- Create: `artifacts/mobile/hooks/useReduceMotion.ts`
- Create: `artifacts/mobile/components/ui/Surface.tsx`
- Create: `artifacts/mobile/components/ui/PressableScale.tsx`
- Create: `artifacts/mobile/components/ui/Entrance.tsx`
- Create: `artifacts/mobile/components/ui/Band.tsx`
- Modify: `artifacts/mobile/constants/corners.ts:18` (`MotifId` gains `'leaf'`)
- Modify: `artifacts/mobile/components/corners/CornerMotif.tsx` (add the
  `leaf` motif and update the header comment)

**Interfaces:**
- Consumes:
  - `ELEVATION`, `Elevation`, `RADIUS` (`@/constants/theme`)
  - `MOTION`, `entranceDelay` (`@/services/motion`)
  - `bandGradient` (`@/services/band`)
  - `NATIVE_DRIVER` (`@/constants/animation`)
  - `scheme` (`@/constants/colors`)
- Produces:
  - `useReduceMotion(): boolean`
  - `useSurface(level?: Elevation): ViewStyle` and
    `Surface(props: ViewProps & { level?: Elevation })`
  - `PressableScale(props: Omit<PressableProps, 'style' | 'children'> & { style?: StyleProp<ViewStyle>; children?: React.ReactNode })`
  - `Entrance(props: { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode })`
  - `Band(props: { color: string; motif?: MotifId; motifOpacity?: number; style?: StyleProp<ViewStyle>; children?: React.ReactNode })`
    and `BRAND_MOTIF_OPACITY = 0.1`
  - `MotifId` now includes `'leaf'`

These are React Native components, which `node --test` cannot load. Their
check is the typecheck here, then the source-reading tests and the screenshot
pass in later tasks.

- [ ] **Step 1: Add the `leaf` motif**

In `artifacts/mobile/constants/corners.ts`, change the union:

```ts
export type MotifId = 'grid' | 'bubbles' | 'hex' | 'stars' | 'confetti' | 'leaf';
```

In `artifacts/mobile/components/corners/CornerMotif.tsx`:
- Replace the header sentence "Five motifs, one per corner — add a case when a
  corner is added, or the band is plain." with: "One motif per corner, plus
  `leaf` for the brand-teal bands (the library, Profile, a `CornerFrame`
  outside every corner). Add a case when a corner is added, or the band is
  plain."
- Add the `leaf` entry to `MOTIFS`, next to the others:

```tsx
  leaf: id => (
    <>
      <Defs>
        <Pattern id={id} width={56} height={56} patternUnits="userSpaceOnUse">
          <G transform="rotate(-35 28 28)">
            <Path d="M28 10 C 40 18 40 38 28 46 C 16 38 16 18 28 10 Z" fill="none" stroke="#fff" strokeWidth={1.5} />
            <Path d="M28 13 V 44" fill="none" stroke="#fff" strokeWidth={1} />
          </G>
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill={`url(#${id})`} />
    </>
  ),
```

`G` is already imported in that file. Check the existing entries for how they
use `transform` on `G`, and match them if they differ.

- [ ] **Step 2: Create `useReduceMotion`**

Create `artifacts/mobile/hooks/useReduceMotion.ts`:

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/**
 * Whether the device asks for reduced motion. It is read once when this
 * module first loads, so a screen mounted after that knows on its first
 * render and does not animate before the answer arrives. It then follows the
 * setting while the app runs. On the web, react-native-web answers from
 * `prefers-reduced-motion`.
 */
let current = false;
const first = AccessibilityInfo.isReduceMotionEnabled()
  .then(v => { current = v; })
  .catch(() => {});

export function useReduceMotion(): boolean {
  const [reduced, setReduced] = useState(current);
  useEffect(() => {
    let alive = true;
    void first.then(() => { if (alive) setReduced(current); });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', v => {
      current = v;
      setReduced(v);
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);
  return reduced;
}
```

- [ ] **Step 3: Create `Surface`**

Create `artifacts/mobile/components/ui/Surface.tsx`:

```tsx
/**
 * A card's look: the card colour at radius 16, lifted by a soft shadow in
 * light mode and outlined by a 1px border in dark mode, where a shadow does
 * not show on the navy page. Use `useSurface()` in a Pressable's style array,
 * and `<Surface>` for a plain container.
 *
 * Two traps:
 * - Remove the card's own `borderWidth: 1` when it takes this. A light surface
 *   has no `borderColor`, so a leftover width draws a black border.
 * - Do not put `overflow: 'hidden'` on a surface: iOS clips a view's own shadow
 *   to its bounds. Round the child that needs clipping instead.
 */
import React from 'react';
import { View, type ViewProps, type ViewStyle } from 'react-native';
import { scheme } from '@/constants/colors';
import { ELEVATION, RADIUS, type Elevation } from '@/constants/theme';
import { useColors } from '@/hooks/useColors';

export function useSurface(level: Elevation = 'card'): ViewStyle {
  const colors = useColors();
  return scheme === 'dark'
    ? { backgroundColor: colors.card, borderRadius: RADIUS.lg, borderWidth: 1, borderColor: colors.border }
    : { backgroundColor: colors.card, borderRadius: RADIUS.lg, boxShadow: ELEVATION[level] };
}

export function Surface({ level, style, ...rest }: ViewProps & { level?: Elevation }) {
  const surface = useSurface(level);
  return <View {...rest} style={[surface, style]} />;
}
```

- [ ] **Step 4: Create `PressableScale`**

Create `artifacts/mobile/components/ui/PressableScale.tsx`:

```tsx
/**
 * A Pressable that gives as you press it: it springs to MOTION.pressScale
 * while held and back on release. That replaces the 70–85% opacity fades the
 * screens each chose for themselves.
 *
 * - With reduced motion, a held card dims to 0.85 instead of moving.
 * - On the web it has a pointer cursor and a focus ring in the current primary
 *   colour (the corner's, inside a corner), so a keyboard user can tell which
 *   card they are on.
 * - `style` is a plain style, not a callback: the press state lives here.
 */
import React, { useRef, useState } from 'react';
import { Animated, Platform, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';
import { MOTION } from '@/services/motion';
import { useColors } from '@/hooks/useColors';
import { useReduceMotion } from '@/hooks/useReduceMotion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function PressableScale({ style, onPressIn, onPressOut, onFocus, onBlur, children, ...rest }: Props) {
  const colors = useColors();
  const reduced = useReduceMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const [held, setHeld] = useState(false);
  const [focused, setFocused] = useState(false);

  const springTo = (toValue: number) =>
    Animated.spring(scale, { toValue, speed: 40, bounciness: 0, useNativeDriver: NATIVE_DRIVER }).start();

  return (
    <AnimatedPressable
      {...rest}
      onPressIn={e => {
        setHeld(true);
        if (!reduced) springTo(MOTION.pressScale);
        onPressIn?.(e);
      }}
      onPressOut={e => {
        setHeld(false);
        if (!reduced) springTo(1);
        onPressOut?.(e);
      }}
      onFocus={e => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setFocused(false);
        onBlur?.(e);
      }}
      style={[
        style,
        { transform: [{ scale }] },
        reduced && held ? { opacity: 0.85 } : null,
        Platform.OS === 'web'
          ? ({
              cursor: 'pointer',
              ...(focused ? { outlineStyle: 'solid', outlineWidth: 3, outlineColor: colors.primary, outlineOffset: 2 } : {}),
            } as object)
          : null,
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
```

- [ ] **Step 5: Create `Entrance`**

Create `artifacts/mobile/components/ui/Entrance.tsx`:

```tsx
/**
 * Brings its child in: a fade and an MOTION.rise-px rise over MOTION.enterMs,
 * starting entranceDelay(index) after mount, so a list arrives one card after
 * another. With reduced motion the child renders in place, fully visible on
 * its first frame.
 *
 * It animates once, on mount. A list that re-renders does not replay it.
 * Layout styles (flexBasis, width, flexGrow) go on `style`, because this view
 * is the one the parent lays out.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Easing, type StyleProp, type ViewStyle } from 'react-native';
import { NATIVE_DRIVER } from '@/constants/animation';
import { MOTION, entranceDelay } from '@/services/motion';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type Props = { index?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode };

export function Entrance({ index = 0, style, children }: Props) {
  const reduced = useReduceMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    const run = Animated.timing(progress, {
      toValue: 1,
      duration: MOTION.enterMs,
      delay: entranceDelay(index),
      easing: Easing.out(Easing.cubic),
      useNativeDriver: NATIVE_DRIVER,
    });
    run.start();
    return () => run.stop();
    // Mount only: a re-render must not replay the entrance.
  }, []);

  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [MOTION.rise, 0] }) }],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}
```

If the repo's lint or typecheck flags the empty dependency array, add the
project's usual suppression comment on that line. Do not add dependencies:
replaying on a re-render is the bug the comment describes.

- [ ] **Step 6: Create `Band`**

Create `artifacts/mobile/components/ui/Band.tsx`:

```tsx
/**
 * A header band: a diagonal gradient from `color` to it 18% darker
 * (services/band.ts), an optional motif, and in light mode a soft shadow
 * where it meets the page.
 *
 * The shadow is on an outer view and the clipping on an inner one, because
 * iOS clips a view's own shadow when it has `overflow: 'hidden'`. The outer
 * view takes `zIndex: 1` so the shadow paints over the scroll view below it.
 * `style` (padding and the rest of the band's own layout) goes on the inner
 * view.
 *
 * White text on it is measured on both stops by cornerTheme.test.ts.
 */
import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { scheme } from '@/constants/colors';
import type { MotifId } from '@/constants/corners';
import { ELEVATION } from '@/constants/theme';
import { bandGradient } from '@/services/band';
import { CornerMotif } from '@/components/corners/CornerMotif';

/** The leaf motif's strength on a brand-teal band: like the corners', subtle enough for the band text. */
export const BRAND_MOTIF_OPACITY = 0.1;

type Props = {
  color: string;
  motif?: MotifId;
  motifOpacity?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function Band({ color, motif, motifOpacity = BRAND_MOTIF_OPACITY, style, children }: Props) {
  const [from, to] = bandGradient(color);
  return (
    <View style={[styles.outer, scheme === 'light' ? { boxShadow: ELEVATION.raised } : null]}>
      <View style={[styles.inner, { backgroundColor: color }, style]}>
        <LinearGradient colors={[from, to]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {motif ? <CornerMotif motif={motif} opacity={motifOpacity} /> : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { zIndex: 1 },
  inner: { overflow: 'hidden' },
});
```

- [ ] **Step 7: Typecheck and run the suite**

Run, from the repo root: `pnpm run typecheck`
Expected: no errors. If `boxShadow` is reported as missing from `ViewStyle`,
stop and report it. Do not cast it away.

Run: `cd artifacts/mobile && pnpm test`
Expected: all pass. Nothing uses the new pieces yet, so this only proves
nothing broke.

- [ ] **Step 8: Commit**

```bash
git add artifacts/mobile/hooks/useReduceMotion.ts artifacts/mobile/components/ui/Surface.tsx artifacts/mobile/components/ui/PressableScale.tsx artifacts/mobile/components/ui/Entrance.tsx artifacts/mobile/components/ui/Band.tsx artifacts/mobile/constants/corners.ts artifacts/mobile/components/corners/CornerMotif.tsx
git commit -m "$(cat <<'EOF'
Visual language: Surface, PressableScale, Entrance, Band and the leaf motif

Shared card depth (shadow in light, border in dark), a press that springs,
a staggered fade-and-rise entrance, and a gradient band with its shadow on an
outer view so iOS does not clip it. All honour reduced motion.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 3: The corners take the shared pieces

**Files:**
- Modify: `artifacts/mobile/components/corners/CornerFrame.tsx`
- Modify: `artifacts/mobile/components/corners/CornerGrid.tsx`
- Modify: `artifacts/mobile/app/curriculum/math/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/lab/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/quran/index.tsx`
- Modify: `artifacts/mobile/app/curriculum/english/index.tsx`
- Modify: `artifacts/mobile/app/play/index.tsx`
- Test: modify `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

**Interfaces:**
- Consumes (from Task 2):
  - `Band`, `BRAND_MOTIF_OPACITY` (`@/components/ui/Band`)
  - `Entrance` (`@/components/ui/Entrance`)
  - `PressableScale` (`@/components/ui/PressableScale`)
  - `useSurface` (`@/components/ui/Surface`)
- Produces: nothing new. `CornerFrame`'s props are unchanged.

- [ ] **Step 1: Write the failing tests**

Add to the end of `artifacts/mobile/services/__tests__/cornerTheme.test.ts`:

```ts
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
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd artifacts/mobile && node --test services/__tests__/cornerTheme.test.ts`
Expected: both new tests fail ("CornerFrame does not draw its band with
Band"; "math hub cards are not PressableScale").

- [ ] **Step 3: Move `CornerFrame` onto `Band`**

In `artifacts/mobile/components/corners/CornerFrame.tsx`:
- Replace the import of `CornerMotif` with
  `import { Band, BRAND_MOTIF_OPACITY } from '@/components/ui/Band';`.
- Replace the band's opening `<View style={[styles.hero, { backgroundColor:
  colors.hero, paddingTop: insets.top + SPACE.md }]}>` and the
  `{corner ? <CornerMotif … /> : null}` line after it with:

```tsx
      <Band
        color={colors.hero}
        motif={corner?.motif ?? 'leaf'}
        motifOpacity={corner?.motifOpacity ?? BRAND_MOTIF_OPACITY}
        style={[styles.hero, { paddingTop: insets.top + SPACE.md }]}
      >
```

- Change that band's matching closing `</View>` (the one after the hairline
  line) to `</Band>`.
- Leave the glyph, `heroInner` and hairline children exactly as they are.
- In the header comment, change "the band in the corner's hero colour with its
  motif" to "the band (components/ui/Band.tsx: a gradient from the corner's
  hero colour, its motif, a soft shadow in light mode)". Change "outside every
  provider it is teal" to "outside every provider it is brand teal with the
  leaf motif".

- [ ] **Step 4: Bring the grid's cells in with `Entrance`**

Replace the body of `CornerGrid` in
`artifacts/mobile/components/corners/CornerGrid.tsx`:

```tsx
export function CornerGrid({ children }: { children: React.ReactNode }) {
  const viewportW = useViewportWidth();
  const { isRTL } = useLanguage();
  const cols = cornerColumns(Math.min(viewportW, CONTENT_MAX_WIDTH));
  const width: `${number}%` = `${100 / cols}%`;
  // toArray drops null/false children, so the stagger counts only cards that are there.
  return (
    <View style={[styles.grid, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
      {React.Children.toArray(children).map((child, i) => (
        <Entrance key={React.isValidElement(child) && child.key != null ? child.key : i} index={i} style={[styles.cell, { width }]}>
          {child}
        </Entrance>
      ))}
    </View>
  );
}
```

Add `import { Entrance } from '@/components/ui/Entrance';`. Extend the header
comment with: "Each cell enters in turn (`Entrance`), in reading order."

- [ ] **Step 5: Move the hub cards onto `useSurface()` and `PressableScale`**

Apply the same change to every card-like `Pressable` in the five hub files.
A card is a Pressable whose style sets `backgroundColor: colors.card` and
`borderColor: colors.border`. For each one:
1. Swap `Pressable` for `PressableScale`, imported from
   `@/components/ui/PressableScale`. Remove `Pressable` from the
   `react-native` import if nothing else uses it.
2. Call `const surface = useSurface();` at the top of the component that
   renders the card. Import it from `@/components/ui/Surface`.
3. Make the style a plain array: the card's `styles.x`, then `surface`, then
   whatever per-render values remain, such as `flexDirection`. Drop
   `backgroundColor: colors.card`, `borderColor: colors.border`, any inline
   `borderRadius` and any `opacity: pressed ? … : 1`. A style callback becomes
   a plain array.
4. In that card's `StyleSheet` entry, delete `borderWidth: 1` and
   `borderRadius` (the surface supplies radius 16, and a leftover border width
   draws black in light mode). Leave every other property.

Per file:
- **`app/curriculum/math/index.tsx`.** The tool card, `styles.row`. Example
  of the finished card:

```tsx
            <PressableScale
              key={id}
              onPress={() => {
                Haptics.selectionAsync();
                router.push(mathToolPath(id) as never);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${t(meta.titleKey)}, ${t(meta.hintKey)}`}
              style={[styles.row, surface, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
            >
```

  with `row: { flexGrow: 1, alignItems: 'center', gap: SPACE.md, padding: SPACE.md }`.
  Check `components/math/GeogebraLink.tsx`, which renders inside the same
  grid. If it is a bordered card, give it the same change so the grid matches.
- **`app/curriculum/lab/index.tsx`.** Both card Pressables, around lines 60
  and 104, sharing `styles.row`. Each is in its own row component, which
  receives `colors` as a prop: call `useSurface()` inside each.
- **`app/curriculum/quran/index.tsx`.** Both card Pressables, around lines 72
  and 114, `styles.row`.
- **`app/curriculum/english/index.tsx`.** The unit card, `styles.card`.
  Leave `badge` and `chip`: they are outlined pills, not cards.
- **`app/play/index.tsx`.** The game card, `styles.card`, and the `ctaCard`
  container. `ctaCard` is not pressable, so give it the `surface` style only.
  This hub does not use `CornerGrid`, so also wrap each game card:
  `<Entrance key={g.id} index={i} style={styles.cell}>…</Entrance>`.
  - Map with an index: `GAMES.map((g, i) => …)`.
  - Move `key` from the card to the `Entrance`.
  - Move `flexBasis: '46%', flexGrow: 1` out of `styles.card` into a new
    `cell: { flexBasis: '46%', flexGrow: 1 }`.
  - Give the card `flexGrow: 1` so it fills the cell.

- [ ] **Step 6: Run the tests and typecheck**

Run: `cd artifacts/mobile && pnpm test`
Expected: all pass, including the two new tests and `designScale.test.ts`.

Run, from the repo root: `pnpm run typecheck`
Expected: no errors.

Then check that no card kept a stray width:
`grep -n "borderWidth: 1" app/curriculum/{math,lab,quran}/index.tsx app/play/index.tsx`.
Expected: no output.
`grep -n "borderWidth: 1" app/curriculum/english/index.tsx`.
Expected: only the `badge` and `chip` lines.

- [ ] **Step 7: Commit**

```bash
git add artifacts/mobile/components/corners artifacts/mobile/app/curriculum/math/index.tsx artifacts/mobile/app/curriculum/lab/index.tsx artifacts/mobile/app/curriculum/quran/index.tsx artifacts/mobile/app/curriculum/english/index.tsx artifacts/mobile/app/play/index.tsx artifacts/mobile/components/math artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "$(cat <<'EOF'
Corners: gradient band, lifted cards that give when pressed, staggered entry

CornerFrame draws its band with Band; CornerGrid brings each cell in with
Entrance; the five hubs' cards move from hairline borders to useSurface()
and PressableScale.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 4: Livelier library tiles and the library band

**Files:**
- Create: `artifacts/mobile/components/library/LibraryTile.tsx`
- Modify: `artifacts/mobile/app/curriculum/resources.tsx`:
  - near line 115, the `ACCENT` and `cornerLook` constants;
  - lines 610-639, the hero;
  - lines 771-927, the tiles;
  - near line 1166, the `tiles`, `tile`, `tileIcon`, `tileLabel` and
    `tileCount` styles.
- Test: modify `artifacts/mobile/services/__tests__/cornerTheme.test.ts` (the
  `'the library tiles take each corner its own colour'` test)

**Interfaces:**
- Consumes (from Task 2):
  - `Entrance`, `PressableScale`, `useSurface`
  - `Band`, `BRAND_MOTIF_OPACITY`
  - `CornerMotif`
  - `MotifId`
- Produces: `LibraryTile` and `type TileLook = { hero: string; primary: string; primaryForeground: string }`.

- [ ] **Step 1: Rewrite the library tile test so it fails**

Replace the whole `'the library tiles take each corner its own colour'` test
in `cornerTheme.test.ts` with:

```ts
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
```

Run: `cd artifacts/mobile && node --test services/__tests__/cornerTheme.test.ts`
Expected: FAIL with "the front-row tiles are not LibraryTile".

- [ ] **Step 2: Create `LibraryTile`**

Create `artifacts/mobile/components/library/LibraryTile.tsx`:

```tsx
/**
 * One tile on the library's front row, in three parts:
 * - a strip of its corner's colour and pattern across the top;
 * - the icon on a filled circle that sits across the strip's edge;
 * - the title, and a line under it.
 *
 * The corner tiles wear their corner, so its look is learned before it is
 * entered. The curriculum and «my exams» tiles wear the brand teal and leaf.
 *
 * The strip rounds its own top corners instead of the tile clipping it: a
 * clipping tile would cut off its own shadow on iOS (see Surface.tsx). The
 * accessibility label is «title, line», as the library's tiles always read.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useColors } from '@/hooks/useColors';
import type { MotifId } from '@/constants/corners';
import { RADIUS, SPACE, TYPE } from '@/constants/theme';
import { CornerMotif } from '@/components/corners/CornerMotif';
import { Entrance } from '@/components/ui/Entrance';
import { PressableScale } from '@/components/ui/PressableScale';
import { useSurface } from '@/components/ui/Surface';

export type TileLook = { hero: string; primary: string; primaryForeground: string };

type Props = {
  /** Position in the row, for the entrance stagger. */
  index: number;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  title: string;
  desc: string;
  /** The «my exams» waiting count is a call to act, drawn in the tile's primary. */
  descStrong?: boolean;
  look: TileLook;
  motif: MotifId;
  motifOpacity: number;
  onPress: () => void;
};

const STRIP = 28;
const BADGE = 52;

export function LibraryTile({ index, icon, title, desc, descStrong, look, motif, motifOpacity, onPress }: Props) {
  const colors = useColors();
  const surface = useSurface();
  return (
    <Entrance index={index} style={styles.cell}>
      <PressableScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}, ${desc}`}
        style={[styles.tile, surface]}
      >
        <View style={[styles.strip, { backgroundColor: look.hero }]}>
          <CornerMotif motif={motif} opacity={motifOpacity} />
        </View>
        <View style={[styles.badge, { backgroundColor: look.primary, borderColor: colors.card }]}>
          <Ionicons name={icon} size={24} color={look.primaryForeground} />
        </View>
        <Text numberOfLines={2} style={[styles.title, { color: colors.foreground, fontFamily: 'ReadexPro_600SemiBold' }]}>
          {title}
        </Text>
        <Text
          numberOfLines={2}
          style={[
            styles.desc,
            {
              color: descStrong ? look.primary : colors.mutedForeground,
              fontFamily: descStrong ? 'ReadexPro_600SemiBold' : 'Almarai_400Regular',
            },
          ]}
        >
          {desc}
        </Text>
      </PressableScale>
    </Entrance>
  );
}

const styles = StyleSheet.create({
  cell: { flexGrow: 1, flexBasis: '30%', minWidth: 104, maxWidth: 220 },
  tile: { flexGrow: 1, alignItems: 'center', gap: SPACE.xs, paddingBottom: SPACE.lg, paddingHorizontal: SPACE.sm },
  strip: {
    alignSelf: 'stretch',
    height: STRIP,
    marginHorizontal: -SPACE.sm,
    borderTopLeftRadius: RADIUS.lg,
    borderTopRightRadius: RADIUS.lg,
    overflow: 'hidden',
  },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderWidth: 3,
    marginTop: -BADGE / 2,
    marginBottom: SPACE.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: TYPE.label, textAlign: 'center' },
  desc: { fontSize: TYPE.caption, textAlign: 'center' },
});
```

- [ ] **Step 3: Use it in the library, and draw the header with `Band`**

In `artifacts/mobile/app/curriculum/resources.tsx`:

(a) Imports. Add:
- `import { LibraryTile, type TileLook } from '@/components/library/LibraryTile';`
- `import { Band, BRAND_MOTIF_OPACITY } from '@/components/ui/Band';`

Add `type MotifId` to the existing `@/constants/corners` import.

(b) Next to `cornerLook` (near line 117), add:

```ts
/** A front-row tile in its corner's look and pattern. */
const cornerTile = (id: CornerId) => ({ look: cornerLook(id), motif: CORNERS[id].motif, motifOpacity: CORNERS[id].motifOpacity });
/** The curriculum and «my exams» tiles are the library's own: brand teal and the leaf. */
const BRAND_TILE = {
  look: { hero: palette.hero, primary: palette.primary, primaryForeground: palette.primaryForeground } as TileLook,
  motif: 'leaf' as MotifId,
  motifOpacity: BRAND_MOTIF_OPACITY,
};
```

(c) Hero. Replace `<View style={[styles.hero, { backgroundColor: ACCENT_FILL,
paddingTop: heroTop }]}>` with
`<Band color={ACCENT_FILL} motif="leaf" style={[styles.hero, { paddingTop: heroTop }]}>`.
Change its matching closing `</View>`, just before the `<ScrollView`, to
`</Band>`.

(d) Tiles. Inside the screen component, before `return (`, build the row:

```tsx
  type FrontTile = {
    key: string;
    icon: React.ComponentProps<typeof Ionicons>['name'];
    title: string;
    desc: string;
    descStrong?: boolean;
    look: TileLook;
    motif: MotifId;
    motifOpacity: number;
    go: () => void;
  };
  // The curriculum itself (the books, by grade, subject, unit and lesson) is
  // the first tile. It opens the browser rather than a shelf, so it is not in
  // `shelves`.
  const englishLevel = gradeInfo && (ENGLISH_HUB_GRADES as readonly number[]).includes(gradeInfo.level) ? gradeInfo.level : null;
  const front: FrontTile[] = [
    {
      key: 'curriculum', icon: 'book', title: t('curriculumTitle'), desc: t('libraryCurriculumDesc'), ...BRAND_TILE,
      go: () => router.push({ pathname: '/curriculum/browse' as never, params: { gradeId: grade } }),
    },
    ...(englishLevel !== null
      ? [{
          key: 'english', icon: 'headset' as const, title: t('hubTitle'), desc: t('hubListenDesc'), ...cornerTile('english'),
          go: () => router.push({ pathname: '/curriculum/english' as never, params: { grade: String(englishLevel) } }),
        }]
      : []),
    {
      key: 'lab', icon: 'flask-outline', title: t('labEntryTitle'), desc: t('labEntryHint'), ...cornerTile('lab'),
      go: () => router.push('/curriculum/lab' as never),
    },
    {
      key: 'math', icon: 'calculator-outline', title: t('mathEntryTitle'), desc: t('mathEntryHint'), ...cornerTile('math'),
      go: () => router.push('/curriculum/math' as never),
    },
    ...(quranCornerVisible(QURAN_CORNER_RELEASED, __DEV__)
      ? [{
          key: 'quran', icon: 'book-outline' as const, title: t('quranTitle'), desc: t('quranEntryHint'), ...cornerTile('quran'),
          go: () => router.push('/curriculum/quran' as never),
        }]
      : []),
    ...(isStudent || isParent
      ? [{
          key: 'exams',
          icon: 'document-text' as const,
          title: t(isParent ? 'childResultsTitle' : 'myExamsTitle'),
          desc: isParent ? t('childResultsTileDesc') : waitingExams ? t('myExamsTileCount', waitingExams) : t('myExamsTileDesc'),
          descStrong: !!waitingExams,
          ...BRAND_TILE,
          go: () => router.push('/my-exams' as never),
        }]
      : []),
  ];
```

Keep the existing comments about «اختباراتي» / «نتائج أبنائي» (around lines
432-437) where they are.

Replace everything inside `<View style={[styles.tiles, …]}>` (the six
Pressables and their conditionals, lines ~772-927) with:

```tsx
            {front.map((tile, i) => (
              <LibraryTile
                key={tile.key}
                index={i}
                icon={tile.icon}
                title={tile.title}
                desc={tile.desc}
                descStrong={tile.descStrong}
                look={tile.look}
                motif={tile.motif}
                motifOpacity={tile.motifOpacity}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  tile.go();
                }}
              />
            ))}
```

(e) Styles. Delete `tile`, `tileIcon`, `tileLabel` and `tileCount`. Keep
`tiles`. Remove any import that becomes unused. `Pressable` is still used
elsewhere in the file.

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd artifacts/mobile && pnpm test`
Expected: all pass, including the rewritten library test and
`designScale.test.ts`.

Run, from the repo root: `pnpm run typecheck`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add artifacts/mobile/components/library/LibraryTile.tsx artifacts/mobile/app/curriculum/resources.tsx artifacts/mobile/services/__tests__/cornerTheme.test.ts
git commit -m "$(cat <<'EOF'
Library: tiles wear their corner's strip and pattern, the header is a Band

One LibraryTile replaces six copy-pasted tiles: a strip in the corner's hero
colour and motif, the icon on a filled primary circle, a lifted surface that
gives when pressed, entering in turn. The curriculum and «my exams» tiles wear
the brand teal and the new leaf motif.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

### Task 5: Profile, and the docs

**Files:**
- Modify: `artifacts/mobile/app/(tabs)/profile.tsx`:
  - `SettingRow` at lines 31-51;
  - the header at lines 160-205;
  - the `infoCard` uses at ~line 205 and ~line 263;
  - styles at ~line 428 (`headerBg`), ~446 (`infoCard`) and ~475
    (`settingRow`).
- Modify: `CLAUDE.md` (a new bullet after the "A corner's colour lives in one
  table" bullet)
- Modify: `STATUS.md` (a new section after "Each corner has its own colour and
  band, 2026-10-21")
- Test: modify `artifacts/mobile/services/__tests__/cornerTheme.test.ts`

**Interfaces:**
- Consumes (from Task 2): `Band`, `BRAND_MOTIF_OPACITY`, `PressableScale`,
  `useSurface`.
- Produces: nothing new.

- [ ] **Step 1: Write the failing test**

Add to the end of `cornerTheme.test.ts`:

```ts
test('Profile has the brand band and lifted cards', () => {
  const src = readFileSync(join(root, 'app', '(tabs)', 'profile.tsx'), 'utf8');
  assert.match(src, /<Band\b[^>]*motif="leaf"/, 'the Profile header is not a leaf Band');
  assert.match(src, /\buseSurface\(/, 'the Profile cards do not take useSurface()');
  assert.match(src, /<PressableScale\b/, 'the Profile setting rows are not PressableScale');
});
```

Run: `cd artifacts/mobile && node --test services/__tests__/cornerTheme.test.ts`
Expected: FAIL with "the Profile header is not a leaf Band".

- [ ] **Step 2: Change Profile**

In `artifacts/mobile/app/(tabs)/profile.tsx`:
- Imports: add `Band`, `BRAND_MOTIF_OPACITY` from `@/components/ui/Band`,
  `PressableScale` from `@/components/ui/PressableScale`, and `useSurface`
  from `@/components/ui/Surface`.
- **Header.** Replace
  `<View style={[styles.headerBg, { backgroundColor: colors.hero, paddingTop: topPad + 16 }]}>`
  with
  `<Band color={colors.hero} motif="leaf" motifOpacity={BRAND_MOTIF_OPACITY} style={[styles.headerBg, { paddingTop: topPad + 16 }]}>`.
  Change its matching closing `</View>`, just before the
  `<View style={{ paddingHorizontal: 20, paddingTop: 24 }}>` line, to
  `</Band>`. Leave the avatar and badges inside it unchanged.
- **`SettingRow`.** Call `const surface = useSurface();` first in the
  component, swap `Pressable` for `PressableScale`, and use this style:

```tsx
      style={[styles.settingRow, surface, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}
```

  This drops `backgroundColor`, `borderColor`, `borderRadius` and the
  pressed-opacity callback.
- **Info cards.** In `ProfileScreen`, call `const surface = useSurface();`
  after `const colors = useColors();`. Then:
  - The plain info card `View`: style becomes `[styles.infoCard, surface]`.
  - The pressable info card (the one whose style callback sets `opacity:
    pressed ? 0.85 : 1`): make it `PressableScale` with
    `style={[styles.infoCard, surface]}`.
  - Find any other `borderColor: colors.border` card container in the file
    and give it the same change. Leave the `divider` lines alone.
- **Styles.**
  - `infoCard: {}` stays as an empty entry, so the call sites read the same.
    Delete its `borderWidth: 1` and `overflow: 'hidden'`: nothing inside
    paints to the card's edge, and a clipping surface loses its shadow on iOS.
  - `settingRow: { alignItems: 'center', padding: 16, gap: 12 }` (delete
    `borderWidth: 1`).
  - Leave `headerBg` as it is.
- Remove `Pressable` from the `react-native` import only if nothing else in
  the file uses it. The avatar badges still do.

- [ ] **Step 3: Write the docs**

In `CLAUDE.md`, add this bullet right after the bullet that starts "**A
corner's colour lives in one table (since 2026-10-21).**":

```markdown
- **Cards, presses, entry motion and bands are shared pieces (since 2026-10-21).**
  The pieces are `useSurface()`/`Surface`, `PressableScale`, `Entrance` and
  `Band` in `components/ui`, built from `ELEVATION` (`constants/theme.ts`) and
  `MOTION` (`services/motion.ts`). Traps:
  - A shadow is light-mode only; dark cards keep their 1px border.
  - A surface must not set `overflow: 'hidden'`, because iOS clips a view's
    own shadow.
  - When a card takes `useSurface()`, delete its own `borderWidth: 1`. A light
    surface has no border colour, so a leftover width draws black.
  - Motion goes through `useReduceMotion()`. With it on, nothing slides or
    scales.
  - Header bands are `Band`: a gradient that only deepens, and
    `cornerTheme.test.ts` measures white text on both stops.
  - `designScale.test.ts` counts hand-written `shadowColor`, so new depth
    comes from the tokens.
  **Amber (`palette.live`) means *now*** (start class, due today, live) and
  nothing else.
```

In `STATUS.md`, read the section titled "Each corner has its own colour and
band, 2026-10-21" and match its heading level and style. Right after it, add:

```markdown
### Cards lift, presses give, screens arrive — 2026-10-21

The second half of the "dull, everything looks the same" feedback.

- **Shared pieces** in `components/ui`:
  - `useSurface()`/`Surface`: a soft shadow in light mode, a 1px border in
    dark mode, radius 16.
  - `PressableScale`: springs to 0.97 while held, with a focus ring on web.
  - `Entrance`: fades in and rises 8px over 220ms, staggered 40ms, capped at
    the 6th item.
  - `Band`: the hero colour deepening 18% on a diagonal, with a soft shadow.
  - All of it honours reduce motion (`useReduceMotion`).
- **Where they are used:**
  - The corner bands are now `Band`, and every corner hub's cards are lifted
    and enter in turn.
  - The library's front-row tiles (`components/library/LibraryTile.tsx`)
    wear their corner's strip and pattern; the curriculum and «my exams»
    tiles wear the brand teal and a new `leaf` motif.
  - The library and Profile headers are leaf `Band`s.
- **Not moved yet:** the other ~150 bordered cards move when their screens
  are touched. `designScale.test.ts` stops hand-written shadows from growing
  meanwhile.
- **Next:** the phone Today screen (PR 4).
```

- [ ] **Step 4: Run the tests and typecheck**

Run: `cd artifacts/mobile && pnpm test`
Expected: all pass.

Run, from the repo root: `pnpm run typecheck`
Expected: no errors.

Run: `grep -n "borderWidth: 1" "app/(tabs)/profile.tsx"`
Expected: no output, or only lines that are not `infoCard`/`settingRow`.

- [ ] **Step 5: Commit**

```bash
git add "artifacts/mobile/app/(tabs)/profile.tsx" artifacts/mobile/services/__tests__/cornerTheme.test.ts CLAUDE.md STATUS.md
git commit -m "$(cat <<'EOF'
Profile: leaf band and lifted cards; document the shared visual language

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_014vGPyzFau13ooF3sJZAybJ
EOF
)"
```

---

## After the tasks (controller)

- **Screenshot pass.** Run `e2e/screens.mjs` (see `e2e/README-screens.md`)
  over the five corners, the library and Profile, in light and dark, phone
  and desktop. Look for:
  - a black card border (a leftover `borderWidth`);
  - a tile strip not lining up with the card's top corners;
  - band text that reads poorly;
  - cards still at opacity 0 after the waits.
- **Reduce motion.** Run once more with Playwright's
  `reducedMotion: 'reduce'`. The cards must be fully visible in a shot taken
  with no wait after the page's content appears.
- **Final review.** Run a whole-branch review, then open the PR.
