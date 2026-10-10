/**
 * A whiteboard as printable HTML: one A4-landscape `.slide` per board page,
 * which is the shape `exportAsPDF` / `capturePdf` already turns into one PDF
 * page each (`SLIDE_SELECTOR` in `pdfCapture.web.ts`).
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
import { parseBoard } from './boardFile.ts';
import { DECK_BORDER, DECK_MUTED, DECK_TEXT } from './deckTheme.ts';
import { scaleInkPoints } from './penInk.ts';
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

/** The whole document, or null when `content` is not a valid board. */
export function buildBoardHTML(content: unknown, title: string, isAr: boolean): string | null {
  const parsed = parseBoard(content);
  if (!parsed.ok) return null;
  const lang = isAr ? 'ar' : 'en';
  const total = parsed.file.pages.length;
  const safeTitle = escapeHtml(title);

  const slides = parsed.file.pages
    .map((page, i) => {
      const strokes = page.strokes
        .map(
          s =>
            `<polyline points="${scaleInkPoints(s.points, CANVAS_W)}" fill="none" stroke="${s.color}" stroke-width="${num(s.width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
        )
        .join('');
      const label = `${localizeDigits(String(i + 1), lang)} / ${localizeDigits(String(total), lang)}`;
      return `<div class="slide">
  <div class="bar"><span class="title">${safeTitle}</span><span class="num">${label}</span></div>
  <div class="page"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" direction="ltr" style="direction:ltr">${paperSVG(page.background, lang)}${strokes}</svg></div>
</div>`;
    })
    .join('\n');

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
