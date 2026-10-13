/**
 * The deck palette — one definition, three renderers.
 *
 * A teacher projects the deck, then hands out the PDF and opens the PPTX in
 * PowerPoint. Those three had three private copies of the palette, and the
 * exporters' copy was the *old* dark one: the class saw cream and teal while
 * the handout was near-black with indigo. Same deck, two products.
 *
 * The projected values win, because that is the surface a room full of people
 * looks at. Light, warm, print-like: a near-black slide washes out next to a
 * whiteboard in a lit room, and it eats a printer's toner for nothing.
 *
 * Hex is stored with the leading `#` for CSS and React Native. pptxgenjs wants
 * it without — `pptxHex()` is the only place that difference lives.
 */
import type { ActivitySlide } from './ai/AIService.ts';

export const DECK_BG = '#FDF1EC';
export const DECK_CARD_BG = '#FFFFFF';
export const DECK_BORDER = '#EFDCD4';
export const DECK_TEXT = '#22303C';
export const DECK_MUTED = '#7C6A65';
export const DECK_ACCENT = '#1E8E8E';
/**
 * The brand teal at a depth that carries text. DECK_ACCENT is the right colour
 * for a fill or a rule, but as a heading on DECK_BG it is ~3.6:1 and as the
 * ground under white type on a divider it is ~4:1 — both short of 4.5. This is
 * the app's own primary (#006D65), ~5.6:1 on DECK_BG and ~6.2:1 under white.
 */
export const DECK_TEAL = '#006D65';
/** Second accent — section rules, kickers, the "look here" mark. */
export const DECK_PINK = '#D6206B';
/** The soft shapes behind the slide. Low-contrast on purpose. */
export const DECK_BLOB = '#F8DCD2';

export const TIMER_GREEN = '#16A34A';
export const TIMER_AMBER = '#D97706';
export const TIMER_RED = '#DC2626';

// ─── Themes ──────────────────────────────────────────────────────────────────
// One deck, one theme. Until 2026-10-10 the palette above was the only one, so
// a maths deck, an Arabic deck and an English deck were the same cream-and-teal
// slide with different words on it. A theme is a handful of colours; every
// renderer reads the deck's theme and nothing else about the look changes, which
// keeps this a swap and not a second design system. The constants above stay as
// the default theme's values — the whiteboard and the book page import them.

export type DeckThemeId = 'iqraa' | 'ocean' | 'forest' | 'parchment' | 'violet' | 'graphite';

export interface DeckTheme {
  id: DeckThemeId;
  nameAr: string;
  nameEn: string;
  /** The slide ground. */
  bg: string;
  card: string;
  border: string;
  text: string;
  /** Secondary text — must read on `bg`, not just exist. */
  muted: string;
  /** A fill or a rule: bars, chips, buttons. Too light to carry text on `bg`. */
  accent: string;
  /** The accent at a depth that carries text — headings on `bg`, the ground under white type. */
  primary: string;
  /** Second accent — summary headings, kickers. Also carries text on `bg`. */
  secondary: string;
  /** The soft shapes behind the slide. Low-contrast on purpose. */
  blob: string;
}

export const DECK_THEMES: Record<DeckThemeId, DeckTheme> = {
  iqraa: {
    id: 'iqraa', nameAr: 'إقرأ', nameEn: 'Iqrra',
    bg: DECK_BG, card: DECK_CARD_BG, border: DECK_BORDER, text: DECK_TEXT, muted: DECK_MUTED,
    accent: DECK_ACCENT, primary: DECK_TEAL, secondary: DECK_PINK, blob: DECK_BLOB,
  },
  ocean: {
    id: 'ocean', nameAr: 'المحيط', nameEn: 'Ocean',
    bg: '#EDF4FB', card: '#FFFFFF', border: '#CFE0F0', text: '#1B2B3C', muted: '#53687C',
    accent: '#2F7DC0', primary: '#0B5894', secondary: '#B45309', blob: '#D5E6F5',
  },
  forest: {
    id: 'forest', nameAr: 'الغابة', nameEn: 'Forest',
    bg: '#EEF6EC', card: '#FFFFFF', border: '#D0E3CC', text: '#1F2D22', muted: '#54695A',
    accent: '#3E8E50', primary: '#1D6A33', secondary: '#9A3412', blob: '#D9EAD4',
  },
  parchment: {
    id: 'parchment', nameAr: 'الورق القديم', nameEn: 'Parchment',
    bg: '#F8F1E2', card: '#FFFCF5', border: '#E5D6B8', text: '#2B2218', muted: '#6F5F49',
    accent: '#B07A25', primary: '#7A4A0C', secondary: '#8E1F45', blob: '#EEDFC0',
  },
  violet: {
    id: 'violet', nameAr: 'البنفسج', nameEn: 'Violet',
    bg: '#F3EFFB', card: '#FFFFFF', border: '#DBD1F0', text: '#251E3A', muted: '#62577D',
    accent: '#7B4FCB', primary: '#5A2FA6', secondary: '#B3174F', blob: '#E4DAF5',
  },
  graphite: {
    id: 'graphite', nameAr: 'الجرافيت', nameEn: 'Graphite',
    bg: '#F1F3F5', card: '#FFFFFF', border: '#D6DBE0', text: '#16202A', muted: '#525F6D',
    accent: '#4A6684', primary: '#27425F', secondary: '#A8321A', blob: '#E0E5EA',
  },
};

export const DEFAULT_DECK_THEME: DeckTheme = DECK_THEMES.iqraa;

/** Picker order: the default first. */
export const DECK_THEME_ORDER: readonly DeckThemeId[] = ['iqraa', 'ocean', 'forest', 'parchment', 'violet', 'graphite'];

export function isDeckThemeId(v: unknown): v is DeckThemeId {
  return typeof v === 'string' && Object.prototype.hasOwnProperty.call(DECK_THEMES, v);
}

/**
 * The theme a subject starts with, from its id OR its name in either language —
 * a deck carries the label it was built under («الرياضيات»), not the picker id.
 *
 * Unknown or empty falls to the brand default rather than guessing: a wrong
 * tint reads as a bug, the brand teal reads as the app. Tested in order, so
 * «Social Studies» (parchment) is not caught by the looser «science» word first.
 */
const SUBJECT_THEMES: [RegExp, DeckThemeId][] = [
  [/arabic|islamic|social|history|geograph|civic|عربي|العربية|إسلام|اسلام|دينية|اجتماع|تاريخ|جغراف|وطنية|مدنية/i, 'parchment'],
  [/english|creative|\bart\b|arts|music|drama|إنجليز|انجليز|فنون|موسيق|مسرح/i, 'violet'],
  [/chem|phys(?!ical)|biolog|earth|environment|science|كيمياء|فيزياء|أحياء|احياء|علوم|الأرض|بيئ/i, 'forest'],
  [/math|financ|statist|رياضيات|مالية|مالي|إحصاء|احصاء/i, 'ocean'],
  [/comput|digital|vocation|حاسوب|رقمية|مهني/i, 'graphite'],
];

export function themeIdForSubject(subject: string | undefined | null): DeckThemeId {
  const text = (subject ?? '').trim();
  if (!text) return 'iqraa';
  for (const [re, id] of SUBJECT_THEMES) if (re.test(text)) return id;
  return 'iqraa';
}

/** The theme this deck is drawn in: the one it carries, else its subject's, else the brand's. */
export function resolveDeckTheme(
  deck: { themeId?: unknown; subject?: string | null } | null | undefined,
): DeckTheme {
  if (!deck) return DEFAULT_DECK_THEME;
  if (isDeckThemeId(deck.themeId)) return DECK_THEMES[deck.themeId];
  return DECK_THEMES[themeIdForSubject(deck.subject)];
}

/** Per-slide-type accent: the header rule, the eyebrow, the option ticks. */
export function slideTypeAccent(type: ActivitySlide['type'], theme: DeckTheme = DEFAULT_DECK_THEME): string {
  if (type === 'challenge') return '#C2410C';
  if (type === 'reveal') return TIMER_GREEN;
  if (type === 'summary') return theme.secondary;
  if (type === 'bingo-call') return '#7E22CE';
  if (type === 'relay-problem') return '#BE123C';
  if (type === 'question') return '#1D4ED8';
  if (type === 'graph') return '#0E7490';
  if (type === 'media') return '#B45309';
  if (type === 'scoreboard') return '#B45309';
  if (type === 'podium') return '#A16207';
  if (type === 'divider') return theme.primary;
  // Concept slides — most of the deck, so this is the colour the deck is read
  // in. It was a slate (#5B5D78, and before that #8B8CA4 at ~3:1), which made
  // every content slide the one colour the product itself never uses; the deck
  // now wears the deck's primary — the brand teal unless the subject or the
  // teacher picked another theme. It colours the slide title — the one line the
  // prompt works hardest on — so every theme's primary has to clear 4.5:1 on
  // its own background, and deckTheme.test.ts checks that each one does.
  return theme.primary;
}

/** `#1E8E8E` → `1E8E8E`. pptxgenjs rejects the hash. */
export function pptxHex(color: string): string {
  return color.replace('#', '');
}
