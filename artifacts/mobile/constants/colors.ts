// ─── IQRA Brand Palette ───────────────────────────────────────────────────────
//
//  Midnight Navy  #081B3A  — trust, intelligence, professionalism
//  Emerald Teal   #00A99D  — innovation, growth, learning
//  Soft Aqua      #34D6C6  — interactive & AI-element highlight
//  Light Gray     #F5F7FA  — page background
//  Dark Gray      #1D2939  — body text, dark surfaces

const colors = {
  light: {
    text:                '#081B3A',
    tint:                '#00A99D',
    background:          '#F5F7FA',
    foreground:          '#081B3A',
    card:                '#FFFFFF',
    cardForeground:      '#081B3A',
    primary:             '#00A99D',   // Emerald Teal
    primaryForeground:   '#FFFFFF',
    secondary:           '#E6F7F6',
    secondaryForeground: '#00A99D',
    muted:               '#EEF4F4',
    mutedForeground:     '#6B7A8D',
    accent:              '#34D6C6',   // Soft Aqua — AI element highlights
    accentForeground:    '#081B3A',
    destructive:         '#EF4444',
    destructiveForeground: '#FFFFFF',
    border:              '#DDE6E8',
    input:               '#E8EEF0',
    success:             '#10B981',
    warning:             '#F59E0B',
    info:                '#3B82F6',
  },
  dark: {
    text:                '#E8F4F2',
    tint:                '#34D6C6',
    background:          '#081B3A',   // Midnight Navy
    foreground:          '#E8F4F2',
    card:                '#0D2247',
    cardForeground:      '#E8F4F2',
    primary:             '#34D6C6',   // Soft Aqua — pops on navy
    primaryForeground:   '#081B3A',
    secondary:           '#0D2450',
    secondaryForeground: '#34D6C6',
    muted:               '#0D2247',
    mutedForeground:     '#8BA0B8',
    accent:              '#34D6C6',
    accentForeground:    '#081B3A',
    destructive:         '#F87171',
    destructiveForeground: '#FFFFFF',
    border:              '#1A3356',
    input:               '#152B4A',
    success:             '#34D399',
    warning:             '#FBBF24',
    info:                '#60A5FA',
  },
  radius: 12,
};

export default colors;
