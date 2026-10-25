/**
 * Iqraa's own icons: twenty drawings for the things a teacher meets most (the
 * five prep tools, homework, assessments, the class challenge, classes, the
 * library, messages, the five corners and the tab bar's Today, Ask, Tools and
 * Profile). The first sixteen were approved 2026-10-23 from the review sheet,
 * the tab four the same day; until then each was a stock Ionicons glyph shared
 * with every other app.
 *
 * One style for all of them: a 24-unit grid, a 1.75 stroke with round ends and
 * joins, and two tones — the outline in the concept's colour, the main shape
 * filled with the same colour at 18%. `components/ui/Glyph.tsx` draws them with
 * react-native-svg; this file is pure data so `node --test` can check it.
 *
 * Roles:
 *  - `line`   (default) stroke only
 *  - `tinted` stroke + 18% fill — the shape the eye should land on
 *  - `tint`   22% fill, no stroke (liquid in the flask)
 *  - `solid`  full fill, no stroke (a play triangle, a button dot)
 *  - `faint`  stroke at 35% (the calculator's cross rules)
 * `cut` removes a disc from every part marked `cut: true`, so a badge drawn on
 * top (the assessment's tick) reads on any background without painting one.
 */
export type GlyphRole = 'line' | 'tinted' | 'tint' | 'solid' | 'faint';

type Common = { role?: GlyphRole; cut?: true };
export type GlyphPart =
  | (Common & { el: 'path'; d: string })
  | (Common & { el: 'rect'; x: number; y: number; width: number; height: number; rx?: number })
  | (Common & { el: 'circle'; cx: number; cy: number; r: number });

export type GlyphDef = { parts: readonly GlyphPart[]; cut?: { cx: number; cy: number; r: number } };

export const GLYPH_VIEWBOX = 24;
export const GLYPH_STROKE = 1.75;
export const GLYPH_TINT = 0.18;

export const GLYPHS = {
  'lesson-plan': {
    parts: [
      { el: 'rect', role: 'tinted', x: 3.5, y: 3, width: 11, height: 18, rx: 2 },
      { el: 'path', d: 'M6.5 8h5M6.5 11.5h5M6.5 15h3' },
      { el: 'path', d: 'M20.6 8.4a1.5 1.5 0 0 0-2.1 0L13 13.9l-.8 2.9 2.9-.8 5.5-5.5a1.5 1.5 0 0 0 0-2.1z' },
    ],
  },
  worksheet: {
    parts: [
      { el: 'rect', role: 'tinted', x: 4, y: 3, width: 16, height: 18, rx: 2 },
      { el: 'rect', x: 7, y: 6.5, width: 3, height: 3, rx: 0.7 },
      { el: 'path', d: 'M12.5 8h4.5' },
      { el: 'rect', x: 7, y: 11, width: 3, height: 3, rx: 0.7 },
      { el: 'path', d: 'M7.6 12.5l.8.8 1.4-1.5' },
      { el: 'path', d: 'M12.5 12.5h4.5' },
      { el: 'rect', x: 7, y: 15.5, width: 3, height: 3, rx: 0.7 },
      { el: 'path', d: 'M12.5 17h3' },
    ],
  },
  quiz: {
    parts: [
      { el: 'circle', role: 'tinted', cx: 12, cy: 13.5, r: 7.5 },
      { el: 'path', d: 'M10 2.5h4M12 2.5V6M18.2 6.8l1.3-1.3' },
      { el: 'path', d: 'M8.6 13.6l2.3 2.3 4.4-4.6' },
    ],
  },
  slides: {
    parts: [
      { el: 'rect', role: 'tinted', x: 3, y: 3.5, width: 18, height: 12, rx: 1.6 },
      { el: 'path', role: 'solid', d: 'M10.5 7.2v4.6l3.9-2.3z' },
      { el: 'path', d: 'M12 15.5V18M8 21l4-3 4 3' },
    ],
  },
  activity: {
    parts: [
      { el: 'circle', role: 'tinted', cx: 12, cy: 7, r: 2.7 },
      { el: 'path', role: 'tinted', d: 'M7.3 19.5a4.7 4.7 0 0 1 9.4 0z' },
      { el: 'circle', cx: 5.3, cy: 9.6, r: 1.9 },
      { el: 'path', d: 'M2.4 18.2a3.3 3.3 0 0 1 4.1-3.4' },
      { el: 'circle', cx: 18.7, cy: 9.6, r: 1.9 },
      { el: 'path', d: 'M21.6 18.2a3.3 3.3 0 0 0-4.1-3.4' },
    ],
  },
  homework: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M5 11a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z' },
      { el: 'path', d: 'M9.5 7V5.6a2.5 2.5 0 0 1 5 0V7' },
      { el: 'path', d: 'M8.5 21v-3.6a1.5 1.5 0 0 1 1.5-1.5h4a1.5 1.5 0 0 1 1.5 1.5V21' },
      { el: 'path', d: 'M9 12h6' },
    ],
  },
  evaluations: {
    cut: { cx: 16.5, cy: 16.5, r: 4.7 },
    parts: [
      { el: 'rect', role: 'tinted', cut: true, x: 3.5, y: 3, width: 12, height: 16, rx: 2 },
      { el: 'path', cut: true, d: 'M6.8 7.5h5.4M6.8 11h3.4' },
      { el: 'circle', role: 'tinted', cx: 16.5, cy: 16.5, r: 4.7 },
      { el: 'path', d: 'M14.5 16.6l1.4 1.4 2.7-2.9' },
    ],
  },
  challenge: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M7.5 4h9v5a4.5 4.5 0 0 1-9 0z' },
      { el: 'path', d: 'M7.5 6h-3a3 3 0 0 0 3.6 4.2M16.5 6h3a3 3 0 0 1-3.6 4.2' },
      { el: 'path', d: 'M12 13.5V17M9 20.5v-2a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M7.5 20.5h9' },
    ],
  },
  classes: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M5 10.6V20h14v-9.4L12 5.6z' },
      { el: 'path', d: 'M3 11.6l9-6.6 9 6.6' },
      { el: 'path', d: 'M10 20v-3.6a2 2 0 0 1 4 0V20' },
      { el: 'circle', cx: 12, cy: 11, r: 1.5 },
      { el: 'path', d: 'M3 20h18' },
    ],
  },
  library: {
    parts: [
      { el: 'rect', role: 'tinted', x: 3.5, y: 5, width: 4, height: 15, rx: 1 },
      { el: 'rect', x: 8.5, y: 3.5, width: 4, height: 16.5, rx: 1 },
      { el: 'path', role: 'tinted', d: 'M14.2 6.3l3.8-1 3.7 13.7-3.8 1z' },
      { el: 'path', d: 'M2.5 20.5h19M5.5 8.5v1.5M10.5 7v1.5' },
    ],
  },
  messages: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M3.5 5.5A2.5 2.5 0 0 1 6 3h7.5A2.5 2.5 0 0 1 16 5.5v4a2.5 2.5 0 0 1-2.5 2.5H9l-3.5 3v-3A2.5 2.5 0 0 1 3.5 9.5z' },
      { el: 'path', d: 'M18.6 8.6A2 2 0 0 1 20.5 10.5v4a2.5 2.5 0 0 1-2.5 2.5h-.5v3l-3.5-3h-2.5a2.5 2.5 0 0 1-2.4-1.8' },
    ],
  },
  math: {
    parts: [
      { el: 'rect', role: 'tinted', x: 3.5, y: 3.5, width: 17, height: 17, rx: 3.5 },
      { el: 'path', role: 'faint', d: 'M12 4v16M4 12h16' },
      { el: 'path', d: 'M6.3 7.8h3M7.8 6.3v3M14.7 7.8h3M6.7 15.1l2.2 2.2M8.9 15.1l-2.2 2.2M14.7 15.3h3M14.7 17.3h3' },
    ],
  },
  lab: {
    parts: [
      { el: 'path', role: 'tint', d: 'M7.7 14h8.6l2.4 3.7A2.2 2.2 0 0 1 16.8 21H7.2a2.2 2.2 0 0 1-1.9-3.3z' },
      { el: 'path', d: 'M9.5 3h5M10.5 3v5.2l-5.2 9.5A2.2 2.2 0 0 0 7.2 21h9.6a2.2 2.2 0 0 0 1.9-3.3l-5.2-9.5V3' },
      { el: 'circle', role: 'solid', cx: 10.5, cy: 17.4, r: 0.8 },
      { el: 'circle', role: 'solid', cx: 13.6, cy: 18.6, r: 0.8 },
    ],
  },
  quran: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M12 7.5C10 6 7 5.5 3.5 6v8.5c3.5-.5 6.5 0 8.5 1.5 2-1.5 5-2 8.5-1.5V6C17 5.5 14 6 12 7.5z' },
      { el: 'path', d: 'M12 7.5V16' },
      { el: 'path', d: 'M6.5 15.4L16 21M17.5 15.4L8 21' },
    ],
  },
  english: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M3.5 6.5A2.5 2.5 0 0 1 6 4h12a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 18 16h-7l-4.5 4v-4H6a2.5 2.5 0 0 1-2.5-2.5z' },
      { el: 'path', d: 'M7.6 13l2.2-6 2.2 6M8.4 11h2.8M14.4 7v6' },
      { el: 'circle', cx: 15.9, cy: 11.5, r: 1.5 },
    ],
  },
  games: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M7 7.5h10a4.5 4.5 0 0 1 4.4 5.4l-.9 4.4a2.3 2.3 0 0 1-3.9 1.1L14.5 16h-5l-2.1 2.4a2.3 2.3 0 0 1-3.9-1.1l-.9-4.4A4.5 4.5 0 0 1 7 7.5z' },
      { el: 'path', d: 'M7.6 10.5v3M6.1 12h3' },
      { el: 'circle', role: 'solid', cx: 15.6, cy: 11, r: 0.95 },
      { el: 'circle', role: 'solid', cx: 17.7, cy: 13.1, r: 0.95 },
    ],
  },
  today: {
    parts: [
      { el: 'rect', role: 'tinted', x: 3.5, y: 5, width: 17, height: 15.5, rx: 2.5 },
      { el: 'path', d: 'M8 3v4M16 3v4M3.5 10h17' },
      { el: 'rect', role: 'solid', x: 13, y: 13, width: 4, height: 4, rx: 1 },
    ],
  },
  ask: {
    parts: [
      { el: 'path', role: 'tinted', d: 'M12 4c4.4 0 8 3.1 8 7s-3.6 7-8 7c-1 0-2-.2-2.9-.5L5 19.5l1.2-3.6C4.8 14.7 4 13 4 11c0-3.9 3.6-7 8-7z' },
      { el: 'path', role: 'solid', d: 'M12 7.3l.95 2.75 2.75.95-2.75.95L12 14.7l-.95-2.75L8.3 11l2.75-.95z' },
    ],
  },
  tools: {
    parts: [
      { el: 'rect', role: 'tinted', x: 3, y: 8.5, width: 18, height: 11.5, rx: 2 },
      { el: 'path', d: 'M9 8.5V6.5A1.5 1.5 0 0 1 10.5 5h3A1.5 1.5 0 0 1 15 6.5v2' },
      { el: 'path', d: 'M3 13.5h7.5M13.5 13.5H21' },
      { el: 'rect', x: 10.5, y: 12, width: 3, height: 3, rx: 0.6 },
    ],
  },
  profile: {
    parts: [
      { el: 'circle', role: 'tinted', cx: 12, cy: 12, r: 9 },
      { el: 'circle', cx: 12, cy: 10, r: 3 },
      { el: 'path', d: 'M6.6 18.3a6 6 0 0 1 10.8 0' },
    ],
  },
} as const satisfies Record<string, GlyphDef>;

export type GlyphId = keyof typeof GLYPHS;

/** The evenodd path that keeps everything in the box except the `cut` disc. */
export function cutPath({ cx, cy, r }: { cx: number; cy: number; r: number }): string {
  const s = GLYPH_VIEWBOX;
  return `M0 0H${s}V${s}H0Z M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0Z`;
}
