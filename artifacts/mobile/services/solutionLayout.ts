/**
 * Where a board solution's text goes, shared by the screen and the PDF.
 *
 * Pure and unit-agnostic: callers pass the box and the font range in the same
 * unit (canvas units for the PDF, pixels on screen). Text width is estimated
 * from the character count — good enough to pick a font size that fits, not a
 * typesetter. The screen draws with `MathText`; the PDF draws each returned row
 * as SVG text, which cannot wrap by itself.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { BoardSolution } from '@workspace/math-verify';

/** The block's panel on the 1280x720 page: the left column, clear of the top bar and the palette. */
export const SOLUTION_BOX = { x: 24, y: 72, w: 544, h: 528 } as const;
export const SOLUTION_PAD = 16;

export type SolutionLabels = { ai: string; verified: string; unchecked: string; understoodAs: string };
export type SolutionItemKind = 'ai' | 'problem' | 'step' | 'answer' | 'verdict' | 'understood';
export type SolutionItem = { kind: SolutionItemKind; text: string };

/**
 * What is on the block when `shown` steps are revealed. The AI label is always
 * there. The final answer and its verdict label arrive together, after the last
 * step: an answer is never on screen without saying whether anything checked it.
 */
export function solutionItems(solution: BoardSolution, labels: SolutionLabels, shown: number): SolutionItem[] {
  const n = Math.max(0, Math.min(solution.steps.length, Math.floor(Number.isFinite(shown) ? shown : 0)));
  const items: SolutionItem[] = [
    { kind: 'ai', text: labels.ai },
    { kind: 'problem', text: solution.problem },
  ];
  for (const step of solution.steps.slice(0, n)) items.push({ kind: 'step', text: step });
  if (n === solution.steps.length) {
    items.push({ kind: 'answer', text: solution.answer });
    items.push({ kind: 'verdict', text: solution.verified ? labels.verified : labels.unchecked });
    if (solution.verified && solution.understoodAs) {
      items.push({ kind: 'understood', text: `${labels.understoodAs} ${solution.understoodAs}` });
    }
  }
  return items;
}

/** Greedy word wrap. A token longer than a line is cut across lines, never dropped. */
export function wrapText(text: string, maxChars: number): string[] {
  const limit = Math.max(1, Math.floor(Number.isFinite(maxChars) ? maxChars : 1));
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (word === '') continue;
    let w = word;
    while (w.length > limit) {
      if (current) {
        lines.push(current);
        current = '';
      }
      lines.push(w.slice(0, limit));
      w = w.slice(limit);
    }
    if (current === '') current = w;
    else if (current.length + 1 + w.length <= limit) current += ` ${w}`;
    else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export type SolutionRow = { kind: SolutionItemKind; text: string; /** Baseline, from the top of the box. */ y: number };
export type SolutionLayout = { fontSize: number; lineHeight: number; fits: boolean; rows: SolutionRow[] };

/** Average glyph advance as a fraction of the font size (Arabic and Latin mixed). */
const CHAR_W = 0.55;
const LINE_H = 1.5;
/** Extra space before each item, in font sizes. */
const GAP = 0.5;
const SHRINK = 0.94;

function build(items: SolutionItem[], box: { w: number }, fontSize: number) {
  const maxChars = Math.floor(box.w / (fontSize * CHAR_W));
  const lineHeight = fontSize * LINE_H;
  const rows: SolutionRow[] = [];
  let top = 0;
  items.forEach((item, i) => {
    if (i > 0) top += fontSize * GAP;
    for (const text of wrapText(item.text, maxChars)) {
      rows.push({ kind: item.kind, text, y: top + fontSize * 1.05 });
      top += lineHeight;
    }
  });
  return { fontSize, lineHeight, rows, height: top };
}

/**
 * The largest font in `[minFont, maxFont]` at which `items` fit `box`. When even
 * `minFont` does not fit, `fits` is false and the rows are laid out at `minFont`
 * anyway — the caller decides what an overflow means.
 */
export function layoutSolution(
  items: SolutionItem[],
  box: { w: number; h: number },
  opts: { maxFont: number; minFont: number } = { maxFont: 28, minFont: 14 },
): SolutionLayout {
  const minFont = opts.minFont;
  const maxFont = Math.max(opts.maxFont, minFont);
  let size = maxFont;
  for (;;) {
    const built = build(items, box, size);
    if (built.height <= box.h) return { fontSize: built.fontSize, lineHeight: built.lineHeight, fits: true, rows: built.rows };
    const next = size * SHRINK;
    if (next < minFont) {
      const last = build(items, box, minFont);
      return { fontSize: last.fontSize, lineHeight: last.lineHeight, fits: last.height <= box.h, rows: last.rows };
    }
    size = next;
  }
}
