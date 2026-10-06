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
  | 'help' | 'pencil' | 'ticket' | 'sparkles' | 'trophy' | 'bars' | 'trend' | 'check';

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
};

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
export function deckIconSvg(name: DeckIconName, color: string, size = 32): string {
  const body = DECK_ICON_SHAPES[name].map(s => {
    if (s.t === 'path') return `<path d="${s.d}"/>`;
    if (s.t === 'circle') return `<circle cx="${s.cx}" cy="${s.cy}" r="${s.r}"/>`;
    return `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}"/>`;
  }).join('');
  return `<svg class="deck-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
}
