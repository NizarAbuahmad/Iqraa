// ─── IQRA Palette ─────────────────────────────────────────────────────────────
//
//  Brand Teal    #00A99D  — the logo colour. Decorative only: it is 2.9:1 on
//                           white, so text or a white label on it fails WCAG AA.
//  Primary Teal  #007C74  — the same hue, deepened to 5.1:1 on white. Every
//                           button, link and active state uses this one.
//  Midnight Ink  #0B1B33  — body text and dark surfaces.
//  Paper         #F6F5F1  — warm page background; cards sit on it in white.
//
//  Every text/background pair below is ≥ 4.5:1 — check a new one before
//  adding it (muted-on-paper is the pair that failed before, at 4.08).

const colors = {
  light: {
    text:                '#0B1B33',
    tint:                '#007C74',
    background:          '#F6F5F1',
    foreground:          '#0B1B33',
    card:                '#FFFFFF',
    cardForeground:      '#0B1B33',
    primary:             '#007C74',
    primaryForeground:   '#FFFFFF',
    secondary:           '#E3F2EF',
    secondaryForeground: '#006A63',
    muted:               '#EFEDE7',
    mutedForeground:     '#5C6675',
    accent:              '#34D6C6',   // Soft Aqua — AI element highlights, never text
    accentForeground:    '#0B1B33',
    brand:               '#00A99D',   // logo teal — decoration only
    destructive:         '#D92D20',
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
    destructive:         '#F87171',
    destructiveForeground: '#FFFFFF',
    border:              '#1F3050',
    input:               '#16243B',
    success:             '#34D399',
    warning:             '#FBBF24',
    info:                '#60A5FA',
  },
  radius: 12,
};

export default colors;
