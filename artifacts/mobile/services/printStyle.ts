/**
 * How a printed worksheet or quiz looks — the two papers a student holds.
 *
 * - `colour`: the page as designed. The default, and exactly today's output.
 * - `ink`: for a school's black-and-white copier, which turns grey cards,
 *   tinted bands, solid badges and colour emoji into grey blocks and lets
 *   light-grey writing lines vanish.
 * - `large`: the same paper at a size a weak-sighted or young student reads.
 *
 * Pure: `exportHtml.ts` runs under bare `node --test`. The teacher's choice is
 * remembered by `hooks/usePrintStyle.ts`.
 */
export type PrintStyle = 'colour' | 'ink' | 'large';

export const PRINT_STYLES: readonly PrintStyle[] = ['colour', 'ink', 'large'];

/** A stored value read back; anything unknown is the default. */
export function parsePrintStyle(raw: unknown): PrintStyle {
  return PRINT_STYLES.includes(raw as PrintStyle) ? (raw as PrintStyle) : 'colour';
}

/**
 * The declarations a style adds after the base stylesheet, or '' for colour.
 *
 * `!important` throughout: `sectionBand` and the figure cards set their
 * colours inline, and an inline style beats any rule without it.
 */
export function printStyleCss(style: PrintStyle): string {
  if (style === 'ink') return INK;
  if (style === 'large') return LARGE;
  return '';
}

const INK = `
    /* print-style: ink */
    .school-header, .callout, .worked, .answer-key, .q-card, .marks-table th, .q-type, .lab-box, .step-card {
      background: #fff !important;
    }
    .school-header { border-bottom: 1.5px solid #111 !important; border-radius: 0 !important; }
    .q-card, .worked, .answer-key, .lab-box { border: 1px solid #555 !important; }
    .callout { border-color: #111 !important; }
    .sec-band {
      background: none !important; border: 0 !important; border-radius: 0 !important;
      border-bottom: 1.5px solid #111 !important; padding-left: 0 !important; padding-right: 0 !important;
    }
    .sec-icon { display: none !important; }
    .sec-label, .school-placeholder, .section-title, .worked-label, .answer-num, .answer-key .section-title { color: #111 !important; }
    .section-title { border-color: #555 !important; }
    .q-num, .step-num {
      background: #fff !important; color: #111 !important;
      border: 1.5px solid #111 !important;
    }
    .q-type { color: #111 !important; border: 1px solid #555 !important; }
    .q-rule { border-bottom: 1px solid #555 !important; }
    .exam-blank, .q-blank .exam-blank { border-bottom-color: #333 !important; }
    .q-pts, .school-name, .doc-meta, .footer { color: #333 !important; }
    .marks-table th, .marks-table td { border-color: #555 !important; }`;

const LARGE = `
    /* print-style: large */
    body { font-size: 16px; line-height: 1.8; }
    .doc-title { font-size: 28px; }
    .sec-label { font-size: 17px; }
    .q-text, .body-text, li, .callout, .worked-problem, .worked-steps li, .worked-self { font-size: 16px; }
    .q-option { font-size: 15.5px; margin-top: 7px; }
    .q-num { min-width: 28px; height: 28px; font-size: 14px; }
    .q-rule { height: 30px; }
    .q-blank { height: 34px; }
    .q-card { padding: 12px 14px; }
    .exam-fields { font-size: 15px; }
    .doc-meta { font-size: 14px; }
    .q-pts { font-size: 13px; }
    .worked-label, .section-title { font-size: 16px; }
    .answer-row { font-size: 15px; }`;
