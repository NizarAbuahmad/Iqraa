// artifacts/mobile/constants/corners.ts
/**
 * The corners' identities — one hue and one band motif each, on top of the
 * shared cards, type and spacing. Design:
 * docs/superpowers/specs/2026-10-21-corner-identities-design.md
 *
 * Pure data with no runtime imports, so `node --test` can read it. `CornerTokens` is
 * the slice of the palette a corner overrides; the provider spreads it over
 * `palette` (constants/colors.ts) and every `useColors()` under it follows.
 * Every pair here is measured by services/__tests__/cornerTheme.test.ts —
 * change a value and the test tells you what stopped reading.
 *
 * `selected` is lighter than the teal palette's (#CDE9E3) on purpose: these
 * hues are darker than teal, and the binding pair is the muted grey caption
 * (#5C6675) on the chip, which fails before the primary does.
 */
import type { GlyphId } from './glyphs.ts';
export type CornerId = 'math' | 'english' | 'lab' | 'quran' | 'play';
export type MotifId = 'grid' | 'bubbles' | 'hex' | 'stars' | 'confetti' | 'leaf';

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
  /** Ionicons glyph for the library tile — the fallback for `drawing`. */
  icon: string;
  /** Iqraa's own icon for the corner (`constants/glyphs.ts`), drawn on the library tile. */
  drawing: GlyphId;
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
    id: 'math', route: '/curriculum/math', icon: 'calculator-outline', drawing: 'math', motif: 'grid', motifOpacity: 0.14, glyph: '∑',
    light: light('#3730A3', '#4338CA', '#F2F1FB', '#E5E3F8'),
    dark: dark('#3730A3', '#A5B4FC', '#1C1D47', '#2E2A6B'),
  },
  english: {
    id: 'english', route: '/curriculum/english', icon: 'headset', drawing: 'english', motif: 'bubbles', motifOpacity: 0.10, glyph: 'Aa',
    light: light('#9A3412', '#C2410C', '#FBF4F0', '#FAF0EC'),
    dark: dark('#9A3412', '#FDBA74', '#3A1F10', '#5A2A10'),
  },
  lab: {
    id: 'lab', route: '/curriculum/lab', icon: 'flask-outline', drawing: 'lab', motif: 'hex', motifOpacity: 0.14, glyph: '⚗',
    light: light('#5B21B6', '#6D28D9', '#F5F0FC', '#EBE1FA'),
    dark: dark('#5B21B6', '#C4B5FD', '#261B47', '#3B2A6B'),
  },
  quran: {
    id: 'quran', route: '/curriculum/quran', icon: 'book-outline', drawing: 'quran', motif: 'stars', motifOpacity: 0.14, glyph: '۞', hairline: '#E3C25C',
    light: light('#14532D', '#166534', '#ECF3EF', '#DCE8E1'),
    dark: dark('#14532D', '#86EFAC', '#10281C', '#1A3D2A'),
  },
  play: {
    id: 'play', route: '/play', icon: 'game-controller-outline', drawing: 'games', motif: 'confetti', motifOpacity: 0.14, glyph: '★',
    light: light('#BE185D', '#BE185D', '#FAEFF4', '#F6DFE8'),
    dark: dark('#9D174D', '#F9A8D4', '#331222', '#4A1A33'),
  },
};

/** Library tile order. Append, never insert (see CLAUDE.md on picker order). */
export const CORNER_IDS = ['math', 'english', 'lab', 'quran', 'play'] as const satisfies readonly CornerId[];
