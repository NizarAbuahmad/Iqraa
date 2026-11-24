/**
 * The pen colours, as pure data (PenLayer.tsx imports react-native, so a test cannot load it).
 *
 * `PEN_COLORS` is the slide pen and the book-page pen: three, deliberately, so a teacher
 * circling a term mid-lesson is not choosing from a palette. The whiteboard offers four more
 * — `BOARD_PEN_COLORS` — because a board is where a teacher colour-codes (given / working /
 * answer) and a marker set has blue and green. The three first, in the same order, so
 * `BOARD_PEN_COLORS[0]` is still the board's default and a board saved earlier reads the same.
 *
 * Every ink colour is judged on the board's white paper: at least 3:1 (a drawn line, not text)
 * and at least ΔE2000 10 from every other, so neighbours in the palette are told apart on a
 * projector. `penColors.test.ts` holds it to that. A saved board stores the hex of each
 * stroke (`boardFile.ts` accepts any hex), so an older client opens a board drawn in the new
 * colours and an old board opens here: no file version change.
 */
import type { TranslationKey } from './i18n.ts';
import { DECK_ACCENT, DECK_TEXT, TIMER_RED } from './deckTheme.ts';

export const PEN_COLORS = [TIMER_RED, DECK_ACCENT, DECK_TEXT];

export const BOARD_PEN_COLORS = [...PEN_COLORS, '#2563EB', '#15803D', '#EA580C', '#7C3AED'];

/** The spoken name of each `BOARD_PEN_COLORS` entry, same order (the swatch's accessibility label). */
export const BOARD_PEN_LABEL_KEYS: readonly TranslationKey[] = [
  'penRed', 'penTeal', 'penBlack', 'penBlue', 'penGreen', 'penOrange', 'penPurple',
];
