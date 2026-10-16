/**
 * The section icons a deck heading carries — one definition, two renderers.
 *
 * The deck builders write titles like «🎯 نتاجات التعلم», and the glyph is a
 * section marker rather than part of the sentence (see `splitEmoji`). As an
 * emoji it is a different picture on every device: Apple, Google, Microsoft
 * and a PDF viewer's fallback font each draw their own, none of them takes the
 * slide's accent colour, and in a printed handout it is the one coloured thing
 * on the page that the rest of the design did not choose. As a stroked outline
 * icon it is the same shape everywhere, in the accent colour, at any size.
 *
 * Plain data, no JSX and no markup, so the HTML export can turn it into an
 * inline `<svg>` string and the presenter can turn it into `react-native-svg`
 * elements from the same table — the point of the shared definition is that the
 * handout and the projector cannot disagree about what a section's icon is.
 * Everything is drawn on a 24×24 grid with a 2-unit round stroke, so the set
 * reads as one family.
 *
 * Fails open: a glyph with no entry — the playful ones game decks use, where
 * the emoji IS the picture — comes back `null` and the caller draws the emoji
 * it always drew.
 *
 * Pure and react-free so the bare `node --test` runner can load it.
 */

export type IconShape =
  | { t: 'path'; d: string }
  | { t: 'circle'; cx: number; cy: number; r: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number };

export type DeckIconName =
  | 'target' | 'book' | 'books' | 'bulb' | 'ruler' | 'flag' | 'home' | 'users'
  | 'help' | 'pencil' | 'ticket' | 'sparkles' | 'trophy' | 'bars' | 'trend' | 'check'
  // Subject icons (2026-10-17): the model picks one per slide by name, so the set has to
  // reach past the generic section markers above into what a lesson is *about*.
  | 'atom' | 'flask' | 'leaf' | 'globe' | 'calculator' | 'clock' | 'pin' | 'heart' | 'star' | 'sun' | 'drop' | 'laptop'
  // Inline marks rather than section markers — they sit in a line of text (a
  // link, a badge, a correct-answer tick), not in a heading chip.
  | 'shield' | 'play' | 'file' | 'tick';

const path = (d: string): IconShape => ({ t: 'path', d });
const circle = (cx: number, cy: number, r: number): IconShape => ({ t: 'circle', cx, cy, r });
const rect = (x: number, y: number, w: number, h: number): IconShape => ({ t: 'rect', x, y, w, h });

export const DECK_ICON_SHAPES: Record<DeckIconName, readonly IconShape[]> = {
  target: [circle(12, 12, 10), circle(12, 12, 6), circle(12, 12, 2)],
  book: [
    path('M2 5.5C4 4.5 8 4 12 6.5c4-2.5 8-2 10-1V19c-2-1-6-1.5-10 1-4-2.5-8-2-10-1z'),
    path('M12 6.5V20'),
  ],
  books: [rect(3.5, 4, 4, 16), rect(9.5, 4, 4, 16), path('M15.7 5.4l3.7-1 2.4 14.6-3.7 1z')],
  bulb: [
    path('M9 18h6M10 21h4'),
    path('M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z'),
  ],
  ruler: [path('M4 20V5l15 15z'), path('M4 13h3M4 9h2M8 20v-3M12 20v-2')],
  flag: [path('M5 21V4'), path('M5 4h12l-2 4 2 4H5')],
  home: [path('M3 11l9-8 9 8'), path('M5 10v10h14V10'), path('M10 20v-6h4v6')],
  users: [
    circle(9, 8, 3.5),
    path('M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6'),
    circle(17, 9, 2.5),
    path('M17.5 14c2.5.2 4.5 2 4.5 5'),
  ],
  help: [
    circle(12, 12, 10),
    path('M9.2 9.2a3 3 0 0 1 5.6 1c0 2-3 2.5-3 4.3'),
    path('M12 17.8h.01'),
  ],
  pencil: [path('M4 20l1-4L16.5 4.5a2.1 2.1 0 0 1 3 3L8 19z'), path('M14.5 6.5l3 3')],
  ticket: [path('M3 6h18v4a2 2 0 0 0 0 4v4H3v-4a2 2 0 0 0 0-4z'), path('M14 6v12')],
  sparkles: [
    path('M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z'),
    path('M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z'),
  ],
  trophy: [
    path('M8 4h8v6a4 4 0 0 1-8 0z'),
    path('M8 6H4v2a4 4 0 0 0 4 4M16 6h4v2a4 4 0 0 1-4 4'),
    path('M12 14v4M9 18h6M8 21h8'),
  ],
  bars: [path('M4 20h16'), rect(5, 11, 3, 9), rect(10.5, 5, 3, 15), rect(16, 14, 3, 6)],
  trend: [path('M3 17l6-6 4 4 8-8'), path('M15 7h6v6')],
  check: [circle(12, 12, 10), path('M8 12.5l2.7 2.7L16.5 9.5')],
  shield: [path('M12 3l8 3v5.5c0 4.7-3.2 8.4-8 9.5-4.8-1.1-8-4.8-8-9.5V6z'), path('M8.5 12l2.5 2.5L15.5 10')],
  play: [path('M7 4.5v15l12-7.5z')],
  file: [path('M6 3h8l4 4v14H6z'), path('M14 3v4h4M9 12h6M9 16h6')],
  tick: [path('M5 12.5l4.5 4.5L19 7.5')],
  // Three orbits and a nucleus. The arcs use SVG's own x-axis-rotation, so the
  // two tilted ellipses need no transform — this table has none to offer.
  atom: [
    circle(12, 12, 1.8),
    path('M2 12A10 4 0 0 1 22 12A10 4 0 0 1 2 12z'),
    path('M7 3.34A10 4 60 0 1 17 20.66A10 4 60 0 1 7 3.34z'),
    path('M17 3.34A10 4 -60 0 1 7 20.66A10 4 -60 0 1 17 3.34z'),
  ],
  flask: [path('M9 3h6'), path('M10 3v6L4.5 19a2 2 0 0 0 1.8 3h11.4a2 2 0 0 0 1.8-3L14 9V3'), path('M7.5 15h9')],
  leaf: [path('M5 19C5 10 10 5 20 4c0 10-5 15-15 15z'), path('M5 19c2-5 5-8 9-10')],
  globe: [
    circle(12, 12, 10),
    path('M2 12h20'),
    path('M12 2c3 3 4.5 6.5 4.5 10S15 19 12 22c-3-3-4.5-6.5-4.5-10S9 5 12 2z'),
  ],
  calculator: [
    rect(5, 2, 14, 20),
    rect(8, 5, 8, 4),
    path('M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01'),
  ],
  clock: [circle(12, 12, 10), path('M12 6v6l4 2')],
  pin: [path('M12 22s7-6.5 7-12a7 7 0 0 0-14 0c0 5.5 7 12 7 12z'), circle(12, 10, 2.5)],
  heart: [path('M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z')],
  star: [path('M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z')],
  sun: [
    circle(12, 12, 4),
    path('M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4'),
  ],
  drop: [path('M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z')],
  laptop: [rect(4, 5, 16, 11), path('M2 20h20')],
};

/**
 * The names a deck may carry in `slide.icon` — the section markers and subject
 * icons, NOT the inline marks (a shield, a play button, a file, a tick), which
 * sit inside a line of text rather than naming a slide's idea.
 *
 * The API server's prompt lists the same names and cannot import this file, so
 * `promptSlidesPrompt.test.ts` reads this array out of the source and fails if
 * the two ever differ. Add an icon here and there in the same change.
 */
export const DECK_SECTION_ICONS = [
  'target', 'book', 'books', 'bulb', 'ruler', 'flag', 'home', 'users',
  'help', 'pencil', 'ticket', 'sparkles', 'trophy', 'bars', 'trend', 'check',
  'atom', 'flask', 'leaf', 'globe', 'calculator', 'clock', 'pin', 'heart', 'star', 'sun', 'drop', 'laptop',
] as const;

/** Whether a value from a model is a name this build can draw. */
export function isSectionIconName(v: unknown): v is DeckIconName {
  return typeof v === 'string' && (DECK_SECTION_ICONS as readonly string[]).includes(v);
}

/**
 * Which icon each heading emoji stands for.
 *
 * Only the section markers of the lesson and class decks, where the glyph is
 * chrome. Two emoji may share a picture when they mean the same thing to a
 * class (a raised hand and a question mark are both "a check for the class").
 */
const GLYPH_ICON: Record<string, DeckIconName> = {
  '🎯': 'target',
  '📖': 'book',
  '📚': 'books',
  '💡': 'bulb',
  '📐': 'ruler',
  '🎉': 'flag',
  '🏠': 'home',
  '🤝': 'users',
  '✋': 'help',
  '🙋': 'help',
  '❓': 'help',
  '✍': 'pencil',
  '🎫': 'ticket',
  '✨': 'sparkles',
  '🏆': 'trophy',
  '📊': 'bars',
  '📈': 'trend',
  '✅': 'check',
};

/** The icon for a heading glyph, or `null` to draw the emoji as before. */
export function iconForGlyph(glyph: string): DeckIconName | null {
  // `splitEmoji` strips the variation selector, but a glyph may arrive from
  // elsewhere with one still on («✍️»); the table is keyed without it.
  const key = (glyph ?? '').replace(/️/g, '').trim();
  return GLYPH_ICON[key] ?? null;
}

/**
 * The icon as an inline SVG string, drawn in `color` at `size` px.
 *
 * Marked decorative (`aria-hidden`): it always sits beside the visible heading
 * text it stands for, so a screen reader would only be told the same thing
 * twice. `currentColor` is not used — the exported file is a standalone
 * document, and the stroke is stated outright so a print stylesheet cannot
 * lose it.
 */
export function deckIconSvg(name: DeckIconName, color: string, size = 32, className = 'deck-icon'): string {
  const body = DECK_ICON_SHAPES[name].map(s => {
    if (s.t === 'path') return `<path d="${s.d}"/>`;
    if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`;
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/>`;
  }).join('');
  return `<svg class="${className}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
