# Shared visual language — depth, motion, bands (PR 3)

Approved in chat on 2026-10-21. It follows the corner identities
(`2026-10-21-corner-identities-design.md`, PRs #1167 and #1169).

## Problem

The feedback was "dull, everything looks the same". The corners now differ by
colour, but every surface is still flat:

- 164 files draw a 1px hairline border on a white card, and there is no shared
  card.
- Presses fade to 70–85% opacity.
- Nothing moves on entry.
- The library and Profile headers are flat teal blocks.

## Decisions

1. **Depth tokens.** `ELEVATION` sits in `constants/theme.ts` next to
   `TYPE`/`SPACE`/`RADIUS`.
   - It has two levels, `card` and `raised`. Each is a CSS `boxShadow` string
     in soft navy, `rgba(11,27,51,…)`. React Native 0.81 with the new
     architecture and react-native-web 0.21 both take `boxShadow`.
   - In light mode a card has a shadow and no border.
   - In dark mode a shadow is invisible on navy, so a card keeps its 1px
     `colors.border` and has no shadow.
   - Cards built on the new pieces use radius `RADIUS.lg` (16).
2. **Shared pieces.**
   - `useSurface(level)` returns a card style; `Surface` is a `View` with it.
   - `PressableScale` is a Pressable that springs to scale 0.97 while held.
     It shows a focus ring on web and has a pointer cursor.
   - With reduce motion on, `PressableScale` uses opacity 0.85 instead of the
     scale.
3. **Entry motion.** `Entrance` fades content in and raises it 8px over 220ms.
   - Items are staggered 40ms apart, capped at the 6th, so a long list does
     not crawl.
   - It uses React Native `Animated` with `NATIVE_DRIVER`. Reanimated is not
     used: it is installed but unused and needs build config.
   - Reduce motion means no movement: content renders in place.
   - `useReduceMotion()` reads the setting once at startup and follows
     changes.
4. **Bands.** `Band` draws a header.
   - It is a diagonal gradient from the hero colour to the hero 18% darker
     (`bandGradient`), with an optional motif.
   - In light mode it has a `raised` shadow under it. That shadow sits on an
     outer view, because `overflow: hidden` on iOS would clip it.
   - `CornerFrame` draws its band with `Band`.
   - The library and Profile headers use `Band` with a new brand `leaf` motif
     on teal.
   - White text and the 0.85-white subtitle must stay at 4.5:1 or better on
     both gradient stops. `cornerTheme.test.ts` measures this.
5. **Livelier library tiles.** One `LibraryTile` replaces six copy-pasted
   tiles. It has three parts:
   - a strip along the top in the hero colour, with the motif (the corner's
     own, or brand `leaf` for the curriculum and «my exams» tiles);
   - the icon on a filled circle of `primary`, drawn in `primaryForeground`
     and ringed in the card colour where it crosses the strip;
   - `PressableScale`, with `Entrance` staggered by position.
6. **Corner hubs.**
   - `CornerGrid` wraps each cell in `Entrance`, so every hub's cards stagger
     in.
   - The math, lab, quran, english and play hub cards move to `useSurface()`
     and `PressableScale`.
   - The play hub has its own grid, so it wraps its cards in `Entrance` itself.
7. **Profile.**
   - The header uses `Band` with `leaf`.
   - The info cards and setting rows move to `useSurface()`, and the setting
     rows to `PressableScale`.
8. **Amber means "now".**
   - `palette.live` (`#B45309`) is reserved for things happening now: start
     class, due today, live.
   - The rule is written in CLAUDE.md. No amber changes on screen in this PR;
     its first new use is PR 4's Today card.
9. **A ratchet.** `designScale.test.ts` counts raw `shadowColor` in `app/` and
   `components/`. The ceiling is today's count, 8, so new code uses
   `ELEVATION`.

## Out of scope

- The phone Today screen, empty states and the Tools grid (PR 4).
- Celebrations.
- The dark-mode game-button contrast fix.
- Moving the other ~150 bordered cards: they move as their screens are
  touched.

## Verification

- `pnpm test` in `artifacts/mobile`:
  - contrast on the gradient stops;
  - `entranceDelay`;
  - the shadow ratchet;
  - the structural checks on hubs and tiles.
- `pnpm run typecheck`.
- A screenshot pass (`e2e/screens.mjs`) of the five corners, the library and
  Profile, in light and dark, phone and desktop.
- Reduce motion checked by emulating `prefers-reduced-motion: reduce` in
  Playwright: the cards are fully visible on the first frame.
