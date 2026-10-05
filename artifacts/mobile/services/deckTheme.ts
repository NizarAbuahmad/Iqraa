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

/** Per-slide-type accent: the header rule, the eyebrow, the option ticks. */
export function slideTypeAccent(type: ActivitySlide['type']): string {
  if (type === 'challenge') return '#C2410C';
  if (type === 'reveal') return TIMER_GREEN;
  if (type === 'summary') return DECK_PINK;
  if (type === 'bingo-call') return '#7E22CE';
  if (type === 'relay-problem') return '#BE123C';
  if (type === 'question') return '#1D4ED8';
  if (type === 'graph') return '#0E7490';
  if (type === 'media') return '#B45309';
  if (type === 'scoreboard') return '#B45309';
  if (type === 'podium') return '#A16207';
  if (type === 'divider') return DECK_TEAL;
  // Concept slides — most of the deck, so this is the colour the deck is read
  // in. It was a slate (#5B5D78, and before that #8B8CA4 at ~3:1), which made
  // every content slide the one colour the product itself never uses; the deck
  // now wears the brand teal. It colours the slide title — the one line the
  // prompt works hardest on — so it has to clear 4.5:1 on DECK_BG, and does.
  return DECK_TEAL;
}

/** `#1E8E8E` → `1E8E8E`. pptxgenjs rejects the hash. */
export function pptxHex(color: string): string {
  return color.replace('#', '');
}
