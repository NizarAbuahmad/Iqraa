/**
 * The Iqrra lockup (leaf mark + إقرأ wordmark) for exported files — the same
 * drawing `BrandLogo` puts on screen, from the same vector data
 * (`constants/brandMark.ts`), as an SVG string for the printed page and a PNG
 * for Word, which cannot be relied on to draw an SVG.
 *
 * Exports carried the brand only as a line of text («إقرأ — مساعد التدريس
 * الذكي»), and the Word file — built from plain text — not even that, so a
 * teacher who opened a worksheet in Word saw no logo at all.
 *
 * The PNG is rendered from `brandLockupSvg()` by
 * `scripts/render-brand-png.mjs`; rerun it when the mark changes.
 * `brandLockup.test.ts` fails if the PNG's size stops matching the lockup.
 */
import {
  BRAND_INK,
  BRAND_TEAL,
  DOT,
  LEAF_PATH,
  LOCKUP_ASPECT,
  LOCKUP_MARK_OFFSET,
  LOCKUP_VIEWBOX,
  MARK_RADIUS,
  STEM_PATH,
  WORDMARK_PATH,
} from '../constants/brandMark.ts';
import { BRAND_LOCKUP_PNG_BASE64, BRAND_LOCKUP_PNG_SIZE } from './brandLockupPng.ts';

export { BRAND_LOCKUP_PNG_BASE64, BRAND_LOCKUP_PNG_SIZE };

/** The lockup on a light page: teal mark, ink wordmark. */
export function brandLockupSvg(width: number): string {
  const height = Math.round((width / LOCKUP_ASPECT) * 100) / 100;
  const { x, y } = LOCKUP_MARK_OFFSET;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${LOCKUP_VIEWBOX}" role="img" aria-label="إقرأ">`
    + `<g transform="translate(${x} ${y})">`
    + `<rect width="48" height="48" rx="${48 * MARK_RADIUS}" fill="${BRAND_TEAL}"/>`
    + `<path d="${LEAF_PATH}" fill="#FFFFFF"/>`
    + `<path d="${STEM_PATH}" stroke="${BRAND_TEAL}" stroke-width="1.8" stroke-linecap="round" fill="none"/>`
    + `<circle cx="${DOT.cx}" cy="${DOT.cy}" r="${DOT.r}" fill="#FFFFFF"/>`
    + `</g>`
    + `<path d="${WORDMARK_PATH}" fill="${BRAND_INK}"/>`
    + `</svg>`;
}

/**
 * How wide the lockup sits at the top of the printed page (PDF), in CSS pixels —
 * centred on its own line above the masthead, as in Word.
 */
export const PDF_LOCKUP_WIDTH = 104;

/** How wide the lockup sits in a Word header, in pixels (docx scales the PNG to it). */
export const WORD_LOCKUP_WIDTH = 104;
export const WORD_LOCKUP_HEIGHT = Math.round(WORD_LOCKUP_WIDTH / LOCKUP_ASPECT);

/** Space under the logo before the page's first line, in twips (12pt). */
export const WORD_LOCKUP_SPACE_AFTER = 240;

/**
 * The lockup as a Word paragraph, for the top of every page (a section header):
 * centred, with a gap under it so the title does not sit against it.
 */
export function wordLockupHeader(isAr: boolean, docx: typeof import('docx')): import('docx').Header {
  const { AlignmentType, Header, ImageRun, Paragraph } = docx;
  return new Header({
    children: [
      new Paragraph({
        bidirectional: isAr,
        alignment: AlignmentType.CENTER,
        spacing: { after: WORD_LOCKUP_SPACE_AFTER },
        children: [
          new ImageRun({
            type: 'png',
            data: BRAND_LOCKUP_PNG_BASE64,
            transformation: { width: WORD_LOCKUP_WIDTH, height: WORD_LOCKUP_HEIGHT },
            altText: { name: 'Iqrra', title: 'Iqrra', description: isAr ? 'شعار إقرأ' : 'Iqrra logo' },
          }),
        ],
      }),
    ],
  });
}
