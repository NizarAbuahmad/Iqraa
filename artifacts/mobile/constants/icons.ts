/**
 * Icons follow one system. Pure data (no react-native import) so `node --test`
 * can load it; `services/__tests__/iconSystem.test.ts` enforces all of it.
 *
 * SIZES. Four steps for a UI icon and four for a large decorative glyph. An
 * audit on 2026-10-23 found 15 sizes between 12 and 48, mostly 16/18/20/22
 * side by side in one row, which reads as an accident rather than a choice.
 *  - `sm`  14 — inline with small text, chips, meta lines
 *  - `md`  16 — beside body text, in buttons and list rows
 *  - `lg`  20 — row leading icons, header actions, tab bars
 *  - `xl`  24 — a tile's glyph, a prominent action
 * `ICON_DISPLAY` is for glyphs that ARE the picture: empty states, trophies,
 * hero tiles.
 *
 * STYLE. Outline for actions and navigation. Filled for status
 * (`checkmark-circle`, `close-circle`, `alert-circle`, `information-circle`) and
 * for the selected tab.
 *
 * CONCEPTS. Each teaching concept has one icon and one colour, whichever screen
 * draws it. The Tools catalog and the prep board used to keep their own copies
 * and disagreed (the quiz was two different icons; the quiz and the class
 * challenge shared #B54708, which sits beside the amber that means "now" —
 * `palette.live` — and nothing else). Every colour carries white text at 4.5:1;
 * none is amber; none is a near twin of another.
 */
import type { Ionicons } from '@expo/vector-icons';

export type IconName = keyof typeof Ionicons.glyphMap;

export const ICON = { sm: 14, md: 16, lg: 20, xl: 24 } as const;
export type IconSize = (typeof ICON)[keyof typeof ICON];

export const ICON_DISPLAY = [32, 40, 48, 64] as const;
export type IconDisplaySize = (typeof ICON_DISPLAY)[number];

export type Concept = { icon: IconName; color: string };

export const CONCEPTS = {
  'lesson-plan': { icon: 'document-text-outline', color: '#4338CA' },
  worksheet: { icon: 'list-outline', color: '#0F766E' },
  quiz: { icon: 'checkmark-done-outline', color: '#7C3AED' },
  slides: { icon: 'tv-outline', color: '#0369A1' },
  activity: { icon: 'people-outline', color: '#C2410C' },
  homework: { icon: 'home-outline', color: '#0E7490' },
  evaluations: { icon: 'clipboard-outline', color: '#BE185D' },
  /** The class-challenge tool (tool id `game`). */
  challenge: { icon: 'trophy-outline', color: '#BE123C' },
  /** The public games hub. */
  games: { icon: 'game-controller-outline', color: '#15803D' },
  classroom: { icon: 'grid-outline', color: '#3F6212' },
  'parent-msg': { icon: 'mail-outline', color: '#A21CAF' },
  'lesson-flow': { icon: 'git-branch-outline', color: '#4D7C0F' },
  'prompt-slides': { icon: 'sparkles-outline', color: '#1D4ED8' },
  geogebra: { icon: 'analytics-outline', color: '#990000' },
} as const satisfies Record<string, Concept>;

export type ConceptId = keyof typeof CONCEPTS;

/** `IconTile` sizes and the glyph each carries (always a step on the scale). */
export const TILE_ICON = { 36: ICON.lg, 44: ICON.xl, 56: 32 } as const;
export type TileSize = keyof typeof TILE_ICON;
