import { Appearance } from 'react-native';

// ─── IQRA Palette ─────────────────────────────────────────────────────────────
//
//  Brand Teal    #00A99D  — the logo colour. Decorative only: it is 2.9:1 on
//                           white, so text or a white label on it fails WCAG AA.
//  Primary Teal  #006D65  — the same hue, deepened until teal text stays
//                           ≥ 4.5:1 on white, on paper, and on the teal tints
//                           chips and selected rows sit on (#007C74 was 4.3
//                           on those). Every button, link and active state.
//  Midnight Ink  #0B1B33  — body text and dark surfaces.
//  Paper         #F6F5F1  — warm page background; cards sit on it in white.
//
//  Every text/background pair below is ≥ 4.5:1 — check a new one before
//  adding it (muted-on-paper is the pair that failed before, at 4.08).
//
//  Dark mode splits the teal in two: `primary` is light (#2DD4BF, navy text on
//  it) for buttons and links, `hero` stays deep for solid header bands that
//  carry white text. No single teal is ≥ 4.5:1 both under white text and on
//  the navy page.

const colors = {
  light: {
    text:                '#0B1B33',
    tint:                '#006D65',
    background:          '#F6F5F1',
    foreground:          '#0B1B33',
    card:                '#FFFFFF',
    cardForeground:      '#0B1B33',
    primary:             '#006D65',
    primaryForeground:   '#FFFFFF',
    secondary:           '#E3F2EF',
    secondaryForeground: '#006A63',
    muted:               '#EFEDE7',
    mutedForeground:     '#5C6675',
    accent:              '#34D6C6',   // Soft Aqua — AI element highlights, never text
    accentForeground:    '#0B1B33',
    brand:               '#00A99D',   // logo teal — decoration only
    hero:                '#006D65',   // solid header bands; white text on it
    destructive:         '#C4281C',
    destructiveForeground: '#FFFFFF',
    border:              '#E6E3DB',
    input:               '#F2F0EB',
    success:             '#067647',
    warning:             '#B54708',
    info:                '#1D4ED8',
  },
  dark: {
    text:                '#E8EEF4',
    tint:                '#2DD4BF',
    background:          '#0A1628',
    foreground:          '#E8EEF4',
    card:                '#111F36',
    cardForeground:      '#E8EEF4',
    primary:             '#2DD4BF',
    primaryForeground:   '#081B3A',
    secondary:           '#12302F',
    secondaryForeground: '#5EEAD4',
    muted:               '#16243B',
    mutedForeground:     '#9AA9BC',
    accent:              '#34D6C6',
    accentForeground:    '#081B3A',
    brand:               '#00A99D',
    hero:                '#0F766E',   // white on it is 5.5:1; primary here is too light for that
    destructive:         '#F87171',
    destructiveForeground: '#2A0A0A',
    border:              '#1F3050',
    input:               '#16243B',
    success:             '#34D399',
    warning:             '#FBBF24',
    info:                '#60A5FA',
  },
  radius: 12,
};

export type Palette = typeof colors.light;

/**
 * The scheme, read once at startup.
 *
 * ponytail: not live. ~30 screens keep module-level colour constants
 * (`const ACCENT = palette.primary`) that feed StyleSheets and sub-components;
 * a live switch would flip the tokens but not those, and a half-flipped screen
 * is worse than a late one. A change of system theme applies on next launch.
 * Going live means moving those constants into components (useColors).
 */
export const scheme: 'light' | 'dark' = Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
export const palette: Palette = colors[scheme];

export default colors;
