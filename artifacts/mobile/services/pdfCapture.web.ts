/**
 * Web-only: turns an already-loaded export document (the hidden iframe
 * `exportAsPDF` builds) into a PDF file and downloads it, with no print dialog.
 *
 * The `.web.ts` suffix is the point: Metro resolves it on web only, so
 * html2canvas and jsPDF never reach the Android/iOS bundle (`pdfCapture.ts` is
 * the native stub). Both libraries are also imported lazily, so the web app
 * pays for them only when someone exports.
 *
 * Trade-off, stated plainly: each page is a JPEG of the rendered HTML, so the
 * text in the PDF is not selectable or searchable. Arabic renders correctly
 * because the browser lays it out and we only copy pixels; it is the reason
 * this is not a jsPDF text API job (jsPDF does no Arabic shaping).
 */

import { planPageSlices } from './pdfPagination.ts';

const A4_W = 210;
const A4_H = 297;
const PORTRAIT_MARGIN_Y = 14; // matches `@page { margin: 14mm 12mm }` in exportHtml.ts
const PORTRAIT_PX_WIDTH = 794; // A4 at 96dpi; the print layout the HTML was designed for
const SLIDE_SELECTOR = '.slide, .deck-slide';
// Browsers cap a canvas around 16k px on a side (and silently return a blank
// one beyond it), so a long document trades resolution for fitting at all.
const MAX_CANVAS_PX = 16000;

function pdfFilename(name: string): string {
  const clean = name.replace(/[\\/:*?"<>|]+/g, ' ').trim().replace(/\.pdf$/i, '');
  return `${clean || 'iqraa'}.pdf`;
}

function toJpeg(src: HTMLCanvasElement, sy = 0, sh = src.height): string {
  const slice = document.createElement('canvas');
  slice.width = src.width;
  slice.height = sh;
  const ctx = slice.getContext('2d')!;
  ctx.fillStyle = '#fff'; // JPEG has no alpha — transparent would go black
  ctx.fillRect(0, 0, slice.width, slice.height);
  ctx.drawImage(src, 0, sy, src.width, sh, 0, 0, src.width, sh);
  return slice.toDataURL('image/jpeg', 0.92);
}

/** Cut points (and mandatory page starts) of a portrait document, in px from its top. */
function measureBreaks(doc: Document): { breakpoints: number[]; forced: number[] } {
  const win = doc.defaultView!;
  const top0 = doc.body.getBoundingClientRect().top;
  const y = (el: Element, edge: 'top' | 'bottom') => el.getBoundingClientRect()[edge] - top0;

  const all = Array.from(doc.body.querySelectorAll('*'));
  const avoid = all.filter(el => win.getComputedStyle(el).breakInside === 'avoid');
  // Outermost only: cutting at the edge of a card nested inside a
  // break-inside:avoid section would still split the section.
  const outer = avoid.filter(el => !avoid.some(o => o !== el && o.contains(el)));
  const blocks = Array.from((doc.querySelector('.page') ?? doc.body).children);

  const breakpoints = [...outer, ...blocks].flatMap(el => [y(el, 'top'), y(el, 'bottom')]);
  const forced = all.flatMap(el => {
    const s = win.getComputedStyle(el);
    const out: number[] = [];
    if (s.breakBefore === 'page' || s.breakBefore === 'always') out.push(y(el, 'top'));
    if (s.breakAfter === 'page' || s.breakAfter === 'always') out.push(y(el, 'bottom'));
    return out;
  });
  return { breakpoints, forced };
}

type Html2Canvas = typeof import('html2canvas').default;
type JsPdf = typeof import('jspdf').jsPDF;

/** Renders the iframe's document into a jsPDF: one landscape page per slide, else A4 portrait pages. */
async function buildPdf(iframe: HTMLIFrameElement, html2canvas: Html2Canvas, jsPDF: JsPdf) {
  const doc = iframe.contentDocument!;
  const opts = { useCORS: true, backgroundColor: '#ffffff', logging: false } as const;
  const slides = Array.from(doc.querySelectorAll<HTMLElement>(SLIDE_SELECTOR));

  if (slides.length > 0) {
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
    for (let i = 0; i < slides.length; i++) {
      const canvas = await html2canvas(slides[i], { ...opts, scale: 2 });
      // Fixed-size slides are exactly A4 landscape; a flexible one (the
      // workspace viewer's) keeps its ratio instead of being stretched.
      const h = Math.min(A4_W, A4_H * (canvas.height / canvas.width));
      if (i > 0) pdf.addPage('a4', 'landscape');
      pdf.addImage(toJpeg(canvas), 'JPEG', 0, 0, A4_H, h); // landscape: 297 wide, 210 tall
    }
    return pdf;
  }

  // Flowing document: lay out at A4 width, render once, cut into pages.
  // Reading scrollWidth/Height below forces layout synchronously. Don't wait
  // for a frame instead: requestAnimationFrame never fires in a background tab.
  iframe.style.width = `${PORTRAIT_PX_WIDTH}px`;
  const width = doc.body.scrollWidth;
  const height = doc.body.scrollHeight;
  const scale = Math.min(2, MAX_CANVAS_PX / height);
  const canvas = await html2canvas(doc.body, {
    ...opts, scale, width, height, windowWidth: width, windowHeight: height,
  });

  const mmPerPx = A4_W / width;
  const pageH = (A4_H - 2 * PORTRAIT_MARGIN_Y) / mmPerPx;
  const { breakpoints, forced } = measureBreaks(doc);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  planPageSlices(height, pageH, breakpoints, forced).forEach(([start, end], i) => {
    const sy = Math.round(start * scale);
    const sh = Math.min(canvas.height - sy, Math.round((end - start) * scale));
    if (i > 0) pdf.addPage('a4', 'portrait');
    pdf.addImage(toJpeg(canvas, sy, sh), 'JPEG', 0, PORTRAIT_MARGIN_Y, A4_W, (end - start) * mmPerPx);
  });
  return pdf;
}

export async function capturePdf(iframe: HTMLIFrameElement, filename: string): Promise<void> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf'),
  ]);
  const doc = iframe.contentDocument!;

  // Arabic must not be letter-spaced (it breaks the joins) and html2canvas
  // draws any letter-spaced text glyph by glyph, which disjoints it. The
  // decorative tracking on Latin eyebrows is not worth that. Same shape for
  // list markers: html2canvas parks the native one at the physical left even
  // in an RTL list, so draw them inline, where the text direction puts them.
  const style = doc.createElement('style');
  style.textContent = `
    * { letter-spacing: 0 !important; }
    ul, ol { list-style: none !important; }
    ul > li::before { content: '•'; margin-inline-end: 0.5em; }
    ol { counter-reset: pdfn; }
    ol > li { counter-increment: pdfn; }
    ol > li::before { content: counter(pdfn) '. '; }`;
  doc.head.appendChild(style);

  // html2canvas paints text with canvas `ctx.font`, which resolves against the
  // fonts of the page that owns the canvas — this one, not the iframe. The
  // iframe's Almarai/Cairo are invisible here, so the PDF came out in system
  // Arial. Lend the iframe's loaded faces to this page for the capture.
  // A face still mid-download would be left out and text measured in it would
  // be painted in Arial, with the spacing of the real font.
  // (FontFaceSet is Set-like; the project's DOM lib typings omit its members.)
  const fontSet = (d: Document) => d.fonts as unknown as Set<FontFace>;
  const all = Array.from(fontSet(doc));
  await Promise.race([
    Promise.allSettled(all.filter(f => f.status === 'loading').map(f => f.loaded)),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  const faces = all.filter(f => f.status === 'loaded');
  faces.forEach(f => fontSet(document).add(f));
  try {
    (await buildPdf(iframe, html2canvas, jsPDF)).save(pdfFilename(filename));
  } finally {
    faces.forEach(f => fontSet(document).delete(f));
  }
}
