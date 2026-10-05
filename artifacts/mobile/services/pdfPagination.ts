/**
 * Where to cut a tall rendered document into PDF pages. Pure, so it can be
 * tested — the DOM measuring that feeds it lives in `pdfCapture.web.ts`.
 *
 * All numbers share one unit (CSS px of the laid-out document). `breakpoints`
 * are offsets where a cut is harmless (the edge of a block that must not be
 * split); `forced` are offsets that must start a new page (`break-before:
 * page`). A page ends at a forced break if one falls inside it, else at the
 * last breakpoint that still fits, else — a block taller than a page — hard at
 * `pageH`.
 */
export function planPageSlices(
  totalH: number,
  pageH: number,
  breakpoints: number[],
  forced: number[] = [],
): Array<[number, number]> {
  const cuts = [...new Set(breakpoints)].sort((a, b) => a - b);
  const must = [...new Set(forced)].sort((a, b) => a - b);
  const slices: Array<[number, number]> = [];
  let start = 0;
  while (start < totalH - 0.5) {
    const limit = start + pageH;
    const forcedCut = must.find(f => f > start + 0.5 && f <= limit);
    let end: number;
    if (forcedCut !== undefined) end = forcedCut;
    else if (totalH <= limit) end = totalH;
    else end = cuts.filter(c => c > start + 0.5 && c <= limit).pop() ?? limit;
    slices.push([start, end]);
    start = end;
  }
  return slices;
}
