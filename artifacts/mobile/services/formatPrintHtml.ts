/**
 * The printed paper for the four structured worksheet formats (spec
 * 2026-10-11): a matching table, lettered step cards to put in order, numbered
 * working with a mistake in it, and a coordinate grid to draw on.
 *
 * Pure string builders, split out of `exportHtml.ts` so that file does not
 * grow further. `exportHtml.ts` owns the card; this file owns what goes in it.
 *
 * **Nothing here prints an answer.** `pairs`, `order`, `wrongStep`, `fix`,
 * `why` and every drawn curve belong to the key. `formatBodyHTML` is the
 * student's paper and never reads those fields; `formatKeyExtraHTML` is the
 * only place a curve is drawn, and is only called for the teacher's key.
 */
import type { WorksheetQuestionFormat } from './ai/AIService.ts';
import { normalizePlotExpr } from './ai/worksheetFormats.ts';
import { samplePlot } from './deckVisuals.ts';
// `escLines` for every cell that can hold a system: collapsed onto one line,
// «x − y = 1» and «3ˣ = 9ʸ» printed as «x − y = 1 3ˣ = 9ʸ», which reads «13ˣ».
import { esc, escLines } from './htmlEscape.ts';
import { toArabicDigits } from './labFormat.ts';
import { optionLetter } from './optionLabels.ts';

type Win = { xMin: number; xMax: number; yMin: number; yMax: number };

const L = (isAr: boolean, ar: string, en: string) => (isAr ? ar : en);

const BOX = '<span class="fmt-box"></span>';
const RULE = '<div class="q-rule"></div>';

/** Print CSS for the four layouts, interpolated into the base stylesheet. */
export const FORMAT_CSS = `
    /* Structured worksheet formats. */
    .fmt-match { width: 100%; border-collapse: separate; border-spacing: 0 6px; font-size: 12.5px; }
    .fmt-match td { vertical-align: middle; padding: 3px 8px; }
    .fmt-match .fmt-prob { width: 55%; }
    .fmt-match .fmt-prob-row { display: flex; flex-direction: row; align-items: center; gap: 8px; }
    .fmt-match .fmt-ans { border: 1px solid #d1d5db; border-radius: 6px; background: #fff; }
    .fmt-box { display: inline-block; width: 22px; height: 22px; border: 1.2px solid #6b7280; border-radius: 4px; flex-shrink: 0; vertical-align: middle; background: #fff; }
    .fmt-order { display: grid; grid-template-columns: repeat(2, 1fr); gap: 7px 12px; margin-top: 4px; }
    .fmt-card { display: flex; flex-direction: row; align-items: center; gap: 8px; border: 1px solid #d1d5db; border-radius: 6px; padding: 7px 10px; background: #fff; font-size: 12.5px; line-height: 1.6; break-inside: avoid; }
    .fmt-steps { margin: 4px 0 6px; padding-inline-start: 22px; }
    html[lang="ar"] .fmt-steps { list-style-type: arabic-indic; }
    .fmt-steps li { font-size: 12.5px; color: #111827; line-height: 1.8; margin-bottom: 3px; }
    .fmt-line { display: flex; flex-direction: row; align-items: flex-end; gap: 8px; margin-top: 8px; font-size: 12.5px; }
    .fmt-line .exam-blank { max-width: 60px; }
    .fmt-label { font-size: 12.5px; margin-top: 8px; }
    .fmt-grid-row { width: 100%; }
    .fmt-grid-wrap { position: relative; margin: 6px auto; max-width: 100%; direction: ltr; break-inside: avoid; page-break-inside: avoid; }
    .fmt-grid { display: block; width: 100%; height: auto; }
    .fmt-grid .g-line { stroke: #d0d5dd; stroke-width: 0.5; }
    .fmt-grid .g-axis { stroke: #111827; stroke-width: 1.2; }
    .g-lbl { position: absolute; width: 28px; font-size: 9px; line-height: 10px; color: #374151; white-space: nowrap; }
    .g-lbl-middle { margin-left: -14px; text-align: center; }
    .g-lbl-end { margin-left: -28px; text-align: right; }
    .g-lbl-start { text-align: left; }
    .fmt-curve { fill: none; stroke: #1d4ed8; stroke-width: 1.8; stroke-linejoin: round; }
    .fmt-curve-1 { stroke: #dc2626; }
    .fmt-curve-2 { stroke: #15803d; }
    .fmt-legend { font-size: 11.5px; margin: 2px 0 4px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 18px; }
    .fmt-leg-item { display: inline-flex; align-items: center; gap: 6px; direction: ltr; }
    .fmt-swatch { display: inline-block; flex-shrink: 0; }
    .fmt-key, .answer-row.ak-graph { break-inside: avoid; page-break-inside: avoid; }`;

function fmtNum(n: number, isAr: boolean): string {
  const s = String(n).replace('-', '−');
  return isAr ? toArabicDigits(s) : s;
}

function validWindow(w: Win): Win {
  const ok = [w.xMin, w.xMax, w.yMin, w.yMax].every(Number.isFinite) && w.xMax > w.xMin && w.yMax > w.yMin;
  return ok ? w : { xMin: -5, xMax: 5, yMin: -5, yMax: 5 };
}

interface Frame {
  width: number;
  height: number;
  px: (x: number) => number;
  py: (y: number) => number;
}

const PAD_L = 22;
const PAD_R = 18;
const PAD_T = 12;
const PAD_B = 20;

function frameFor(win: Win, width?: number, height?: number): Frame {
  const xSpan = win.xMax - win.xMin;
  const ySpan = win.yMax - win.yMin;
  const w = width ?? 340;
  const plotW = w - PAD_L - PAD_R;
  // Square units where the window allows: a parabola drawn on a stretched
  // grid is a different parabola to the eye.
  const plotH = height !== undefined ? height - PAD_T - PAD_B : Math.max(140, Math.min(320, (plotW * ySpan) / xSpan));
  const h = height ?? Math.round(plotH + PAD_T + PAD_B);
  return {
    width: w,
    height: h,
    px: x => PAD_L + ((x - win.xMin) / xSpan) * plotW,
    py: y => PAD_T + (1 - (y - win.yMin) / ySpan) * plotH,
  };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * A 1-unit coordinate grid as inline SVG. With `exprs`, each is drawn as a
 * `<polyline>` — answer-key use only; the student's copy passes none.
 */
export function gridSvg(
  window: Win,
  opts: { isAr: boolean; exprs?: string[]; width?: number; height?: number },
): string {
  const win = validWindow(window);
  const { isAr } = opts;
  const f = frameFor(win, opts.width, opts.height);
  const x0 = Math.ceil(win.xMin);
  const x1 = Math.floor(win.xMax);
  const y0 = Math.ceil(win.yMin);
  const y1 = Math.floor(win.yMax);
  const left = f.px(win.xMin);
  const right = f.px(win.xMax);
  const top = f.py(win.yMax);
  const bottom = f.py(win.yMin);
  const axisX = f.px(Math.min(Math.max(0, win.xMin), win.xMax));
  const axisY = f.py(Math.min(Math.max(0, win.yMin), win.yMax));
  // A 20-unit window labelled every unit is a smear; every second one reads.
  const stepX = x1 - x0 > 12 ? 2 : 1;
  const stepY = y1 - y0 > 12 ? 2 : 1;

  const parts: string[] = [];
  for (let x = x0; x <= x1; x++) {
    parts.push(`<line class="g-line" x1="${r1(f.px(x))}" y1="${r1(top)}" x2="${r1(f.px(x))}" y2="${r1(bottom)}"/>`);
  }
  for (let y = y0; y <= y1; y++) {
    parts.push(`<line class="g-line" x1="${r1(left)}" y1="${r1(f.py(y))}" x2="${r1(right)}" y2="${r1(f.py(y))}"/>`);
  }
  parts.push(`<line class="g-axis" x1="${r1(left)}" y1="${r1(axisY)}" x2="${r1(right)}" y2="${r1(axisY)}"/>`);
  parts.push(`<line class="g-axis" x1="${r1(axisX)}" y1="${r1(top)}" x2="${r1(axisX)}" y2="${r1(bottom)}"/>`);

  (opts.exprs ?? []).forEach((e, i) => {
    for (const run of curveRuns(e, win)) {
      const pts = run.map(p => `${r1(f.px(p.x))},${r1(f.py(p.y))}`).join(' ');
      parts.push(`<polyline class="fmt-curve fmt-curve-${i % 3}" points="${pts}"/>`);
    }
  });

  // The labels are HTML laid over the SVG, not SVG <text>: the web PDF export
  // (html2canvas) mis-sizes an inline SVG that holds text and cuts the grid
  // off part-way across (driven 2026-10-11). Positions are percentages of the
  // drawing so they stay on their ticks when the grid is scaled.
  const labels: string[] = [];
  const label = (x: number, y: number, anchor: 'start' | 'middle' | 'end', text: string) => {
    const pos = `left:${r1((x / f.width) * 100)}%;top:${r1(((y - 8) / f.height) * 100)}%`;
    labels.push(`<span class="g-lbl g-lbl-${anchor}" style="${pos}">${text}</span>`);
  };
  for (let x = x0; x <= x1; x++) {
    if (x === 0 || x % stepX !== 0) continue;
    label(f.px(x), Math.min(axisY + 11, bottom + 12), 'middle', fmtNum(x, isAr));
  }
  for (let y = y0; y <= y1; y++) {
    if (y === 0 || y % stepY !== 0) continue;
    label(Math.max(axisX - 4, left - 3), f.py(y) + 3, 'end', fmtNum(y, isAr));
  }
  // The origin only exists when 0 is inside both ranges; otherwise the axes sit
  // on the window's edge and a «٠» there would label a point that is not 0.
  if (win.xMin <= 0 && win.xMax >= 0 && win.yMin <= 0 && win.yMax >= 0) {
    label(axisX - 4, axisY + 11, 'end', fmtNum(0, isAr));
  }
  label(right + 3, axisY + 3, 'start', isAr ? 'س' : 'x');
  label(axisX + 5, top - 2, 'start', isAr ? 'ص' : 'y');

  const svg = `<svg class="fmt-grid" xmlns="http://www.w3.org/2000/svg" width="${f.width}" height="${f.height}" viewBox="0 0 ${f.width} ${f.height}">${parts.join('')}</svg>`;
  return `<div class="fmt-grid-wrap" dir="ltr" style="width:${f.width}px">${svg}${labels.join('')}</div>`;
}

/**
 * The curve as runs of consecutive points inside the window. Points above or
 * below it are dropped and the polyline is split there — and at any x the
 * sampler skipped (an asymptote) — so no segment joins across a gap.
 */
function curveRuns(expr: string, win: Win): { x: number; y: number }[][] {
  const steps = 120;
  const pts = samplePlot(normalizePlotExpr(expr), { from: win.xMin, to: win.xMax, steps });
  if (!pts) return [];
  const dx = (win.xMax - win.xMin) / (steps - 1);
  const runs: { x: number; y: number }[][] = [];
  let cur: { x: number; y: number }[] = [];
  let prevX: number | null = null;
  const flush = () => {
    if (cur.length >= 2) runs.push(cur);
    cur = [];
  };
  for (const p of pts) {
    const inside = p.y >= win.yMin && p.y <= win.yMax;
    const gap = prevX !== null && p.x - prevX > dx * 1.5;
    if (!inside || gap) flush();
    if (inside) cur.push(p);
    prevX = p.x;
  }
  flush();
  return runs;
}

/** The student's paper for a format. Reads no answer field. */
export function formatBodyHTML(f: WorksheetQuestionFormat, isAr: boolean): string {
  switch (f.kind) {
    case 'match': {
      const rows = Math.max(f.left.length, f.right.length);
      const body: string[] = [];
      for (let i = 0; i < rows; i++) {
        const prob = i < f.left.length
          ? `<div class="fmt-prob-row">${BOX}<span>${isAr ? toArabicDigits(String(i + 1)) : i + 1}.</span><span>${escLines(f.left[i]!)}</span></div>`
          : '';
        const ans = i < f.right.length
          ? `<span><b>${optionLetter(i, isAr)}</b> ${escLines(f.right[i]!)}</span>`
          : '';
        body.push(`<tr><td class="fmt-prob">${prob}</td><td class="fmt-ans">${ans}</td></tr>`);
      }
      return `<table class="fmt-match"><tbody>${body.join('')}</tbody></table>`;
    }
    case 'order':
      return `<div class="fmt-order">${f.steps
        .map((s, i) => `<div class="fmt-card">${BOX}<b>${optionLetter(i, isAr)})</b> <span>${escLines(s)}</span></div>`)
        .join('')}</div>`;
    case 'spot_error':
      return `<ol class="fmt-steps">${f.steps.map(s => `<li>${escLines(s)}</li>`).join('')}</ol>`
        + `<div class="fmt-line"><span>${L(isAr, 'رقم الخطوة الخاطئة', 'Number of the wrong step')}:</span><span class="exam-blank"></span></div>`
        + `<div class="fmt-label">${L(isAr, 'التصحيح', 'Correction')}:</div>`
        + `<div class="q-lines">${RULE}${RULE}</div>`;
    case 'graph':
      return `<div class="fmt-grid-row">${gridSvg(f.window, { isAr })}</div>`
        + `<div class="fmt-label">${L(isAr, 'الإجابة', 'Answer')}:</div><div class="q-lines">${RULE}</div>`;
  }
}

/** A short sample of curve `i`'s stroke, styled by the same classes as the curve. */
function legendSwatch(i: number): string {
  return `<svg class="fmt-swatch" xmlns="http://www.w3.org/2000/svg" width="26" height="10" viewBox="0 0 26 10"><line class="fmt-curve fmt-curve-${i % 3}" x1="1" y1="5" x2="25" y2="5"/></svg>`;
}

/** The teacher's key: the graph drawn on its grid. Empty for every other kind. */
export function formatKeyExtraHTML(f: WorksheetQuestionFormat | null | undefined, isAr: boolean): string {
  if (!f || f.kind !== 'graph') return '';
  // The paper's own convention, «y = …» in latin on both papers, never a «ص»
  // beside a latin x. Each entry carries a sample of its line, so the colour —
  // or the ink-saver dash — says which curve is which.
  const legend = f.exprs.map((e, i) => `<span class="fmt-leg-item" dir="ltr">${legendSwatch(i)}${esc(`y = ${e}`)}</span>`).join('');
  return `<div class="fmt-key">${gridSvg(f.window, { isAr, exprs: f.exprs })}<div class="fmt-legend">${legend}</div></div>`;
}
