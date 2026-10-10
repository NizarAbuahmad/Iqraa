/**
 * A whiteboard as printable HTML: one A4-landscape `.slide` per board page,
 * which is the shape `exportAsPDF` / `capturePdf` already turns into one PDF
 * page each (`SLIDE_SELECTOR` in `pdfCapture.web.ts`).
 *
 * A page that carries a solution also gets its panel, all steps revealed.
 *
 * Each page is an inline `<svg viewBox="0 0 1280 720">` holding the paper and
 * the strokes (stored fractions of the width, times 1280, are canvas units).
 * The page is 16:9 and A4 is not, so it is centred under a thin title bar.
 *
 * The input is saved content, so it is UNTRUSTED. `buildBoardHTML` validates it
 * itself with `parseBoard` and returns null for anything invalid; after that
 * the only values interpolated are validated hex colours, numbers computed
 * here, digit-only points, and the title, which is escaped.
 *
 * Free of react-native so `node --test` can load it.
 */
import type { BoardSolution } from '@workspace/math-verify';
import { parseBoard } from './boardFile.ts';
import { DECK_ACCENT, DECK_BORDER, DECK_MUTED, DECK_TEXT } from './deckTheme.ts';
import { mathLineToUnicode } from './mathRender.ts';
import { scaleInkPoints } from './penInk.ts';
import { SOLUTION_BOX, SOLUTION_PAD, layoutSolution, solutionItems, type SolutionItemKind, type SolutionLabels } from './solutionLayout.ts';
import {
  BOARD_STEP,
  CANVAS_H,
  CANVAS_W,
  axesGeometry,
  gridLines,
  localizeDigits,
  type BoardBackground,
  type Segment,
} from './whiteboardModel.ts';

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/** A number for an attribute: at most two decimals, never exponent notation for our ranges. */
const num = (n: number): string => String(Number(n.toFixed(2)));

const line = (s: Segment, stroke: string, strokeWidth: number): string =>
  `<line x1="${num(s.x1)}" y1="${num(s.y1)}" x2="${num(s.x2)}" y2="${num(s.y2)}" stroke="${stroke}" stroke-width="${strokeWidth}"/>`;

/** The same paper as the screen (`BoardBackground`) at the reference scale. */
function paperSVG(background: BoardBackground, lang: string): string {
  if (background === 'blank') return '';
  const grid = gridLines(CANVAS_W, CANVAS_H, BOARD_STEP).map(s => line(s, DECK_BORDER, 1.5)).join('');
  if (background === 'grid') return grid;
  const axes = axesGeometry(CANVAS_W, CANVAS_H, BOARD_STEP);
  const ticks = axes.ticks
    .map(tick => {
      const x = tick.axis === 'x' ? tick.x : tick.x - 8;
      const y = tick.axis === 'x' ? tick.y + 22 : tick.y + 5;
      const anchor = tick.axis === 'x' ? 'middle' : 'end';
      return `<text x="${num(x)}" y="${num(y)}" font-size="16" fill="${DECK_MUTED}" text-anchor="${anchor}">${escapeHtml(localizeDigits(tick.value, lang))}</text>`;
    })
    .join('');
  return grid + line(axes.xAxis, DECK_MUTED, 3) + line(axes.yAxis, DECK_MUTED, 3) + ticks;
}

/** An unchecked verdict is amber so it cannot be mistaken for the teal ✓. */
const UNCHECKED_COLOR = '#B45309';

const MATH_KINDS: ReadonlySet<SolutionItemKind> = new Set(['problem', 'step', 'answer', 'understood']);

/**
 * The solution as SVG text on the page's left panel, ALL steps shown: a printed
 * page is the record, not a lesson in progress. SVG text cannot wrap, so
 * `layoutSolution` breaks it into rows. Both honesty labels are always drawn.
 *
 * Paper may use smaller type than the screen (10 canvas units is still ~6.5pt
 * on A4 landscape). If it STILL does not fit, the last rows (answer, verdict)
 * would be clipped off the page, so this returns null and the export is refused:
 * a loud failure, never a silently lost honesty label.
 */
function solutionSVG(s: BoardSolution, labels: SolutionLabels, isAr: boolean): string | null {
  const items = solutionItems(s, labels, s.steps.length).map(item => ({
    ...item,
    text: MATH_KINDS.has(item.kind) ? mathLineToUnicode(item.text) : item.text,
  }));
  const inner = { w: SOLUTION_BOX.w - 2 * SOLUTION_PAD, h: SOLUTION_BOX.h - 2 * SOLUTION_PAD };
  const layout = layoutSolution(items, inner, { maxFont: 28, minFont: 10 });
  if (!layout.fits) return null;
  const anchorX = isAr ? SOLUTION_BOX.x + SOLUTION_BOX.w - SOLUTION_PAD : SOLUTION_BOX.x + SOLUTION_PAD;
  const top = SOLUTION_BOX.y + SOLUTION_PAD;
  const rows = layout.rows
    .map(row => {
      const small = row.kind === 'ai' || row.kind === 'understood';
      const bold = row.kind === 'problem' || row.kind === 'answer' || row.kind === 'verdict';
      const fill =
        small ? DECK_MUTED
        : row.kind === 'answer' ? DECK_ACCENT
        : row.kind === 'verdict' ? (s.verified ? DECK_ACCENT : UNCHECKED_COLOR)
        : DECK_TEXT;
      const size = small ? layout.fontSize * 0.8 : layout.fontSize;
      return `<text x="${num(anchorX)}" y="${num(top + row.y)}" font-size="${num(size)}" font-weight="${bold ? 700 : 400}" fill="${fill}" direction="${isAr ? 'rtl' : 'ltr'}" text-anchor="start">${escapeHtml(row.text)}</text>`;
    })
    .join('');
  return `<rect x="${SOLUTION_BOX.x}" y="${SOLUTION_BOX.y}" width="${SOLUTION_BOX.w}" height="${SOLUTION_BOX.h}" rx="14" fill="#FFFFFF" fill-opacity="0.92" stroke="${DECK_BORDER}"/>${rows}`;
}

/** `ai`, `verified` and `unchecked` must be real text; `understoodAs` may be anything. */
const hasHonestyLabels = (l: SolutionLabels | undefined): l is SolutionLabels =>
  !!l && [l.ai, l.verified, l.unchecked].every(v => typeof v === 'string' && v.trim() !== '');

/** The whole document, or null when `content` is not a valid board. */
export function buildBoardHTML(content: unknown, title: string, isAr: boolean, solutionLabels?: SolutionLabels): string | null {
  const parsed = parseBoard(content);
  if (!parsed.ok) return null;
  // A solution is never printed without the labels that say it is AI-written
  // and whether its answer was checked.
  const hasSolution = parsed.file.pages.some(p => p.solution);
  if (hasSolution && !hasHonestyLabels(solutionLabels)) return null;
  const lang = isAr ? 'ar' : 'en';
  const total = parsed.file.pages.length;
  const safeTitle = escapeHtml(title);

  let refused = false;
  const slides = parsed.file.pages
    .map((page, i) => {
      const strokes = page.strokes
        .map(
          s =>
            `<polyline points="${scaleInkPoints(s.points, CANVAS_W)}" fill="none" stroke="${s.color}" stroke-width="${num(s.width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join('');
      const panel = page.solution && solutionLabels ? solutionSVG(page.solution, solutionLabels, isAr) : '';
      if (panel === null) refused = true;
      const label = `${localizeDigits(String(i + 1), lang)} / ${localizeDigits(String(total), lang)}`;
      return `<div class="slide">
  <div class="bar"><span class="title">${safeTitle}</span><span class="num">${label}</span></div>
  <div class="page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" direction="ltr" style="direction:ltr">${paperSVG(page.background, lang)}${panel ?? ''}${strokes}</svg></div>
</div>`;
    })
    .join('\n');
  if (refused) return null;

  const font = isAr ? "'Almarai', 'Noto Naskh Arabic', Arial" : "'Inter', 'Helvetica Neue', Arial";
  return `<!DOCTYPE html>
<html dir="${isAr ? 'rtl' : 'ltr'}" lang="${lang}">
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${font}, sans-serif; background: #f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width: 297mm; height: 210mm; background: #fff; position: relative; overflow: hidden; page-break-after: always; display: flex; flex-direction: column; }
.bar { height: 14mm; flex-shrink: 0; display: flex; align-items: center; justify-content: space-between; padding: 0 10mm; border-bottom: 1px solid ${DECK_BORDER}; color: ${DECK_TEXT}; font-size: 14px; }
.title { font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; margin-inline-end: 12px; }
.num { color: ${DECK_MUTED}; direction: ltr; unicode-bidi: isolate; }
.page { flex: 1; display: flex; align-items: center; justify-content: center; }
.page svg { width: 297mm; height: 167.06mm; display: block; }
</style>
</head>
<body>
${slides}
</body>
</html>`;
}
