/**
 * Builds the `docx` Document for the plain-text Word export (every generator's
 * "Word" button; the Ministry form has its own builder in `ministryPlan.ts`).
 *
 * Split out of `share.ts` (which imports `react-native` and so cannot be loaded
 * by `node:test`) so the right-to-left behaviour can be checked against the
 * generated XML rather than by opening a file in Word. `docx` is passed in for
 * the same reason `buildMinistryPlanDocx` takes it: the caller imports it
 * lazily to keep it off the startup path.
 *
 * **Why Arabic needs more than alignment.** Word lays a paragraph out
 * left-to-right unless it carries `<w:bidi/>`, and no `<w:jc>` value changes
 * that: the old export set `AlignmentType.RIGHT` and nothing else, so Arabic
 * came out right-aligned but with its punctuation, digits, Latin terms and
 * bullet markers on the wrong side. A bidi paragraph also *flips* the meaning
 * of `left`/`right` (they become start/end), so alignment is left to the
 * default — start — which is right for both directions.
 */

import type * as Docx from 'docx';

import { classifyDocLines, docLineText } from './docxOutline.ts';

export function buildWordDocument(text: string, isAr: boolean, docx: typeof Docx): Docx.Document {
  const { Document, HeadingLevel, Paragraph, TextRun } = docx;

  const lines = text.split('\n');
  const kinds = classifyDocLines(lines);

  const para = (
    content: string,
    run: { size?: number; bold?: boolean } = {},
    opts: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; bullet?: boolean } = {},
  ) =>
    new Paragraph({
      bidirectional: isAr,
      heading: opts.heading,
      bullet: opts.bullet ? { level: 0 } : undefined,
      children: [new TextRun({ ...run, text: content, rightToLeft: isAr })],
    });

  const children = lines.map((line, i) => {
    const kind = kinds[i]!;
    const content = docLineText(line, kind);

    switch (kind) {
      case 'blank':
        return para('');
      // The underline belonging to the heading above has already done its
      // job by marking it; printing it would just draw dashes in the doc.
      case 'rule':
        return new Paragraph({ bidirectional: isAr, children: [new TextRun({ text: '', break: 1 })] });
      case 'title':
        return para(content, { bold: true, size: 32 }, { heading: HeadingLevel.HEADING_1 });
      case 'heading':
        return para(content, { bold: true, size: 24 }, { heading: HeadingLevel.HEADING_2 });
      case 'bullet':
        return para(content, { size: 22 }, { bullet: true });
      default:
        return para(content, { size: 22 });
    }
  });

  return new Document({ sections: [{ properties: {}, children }] });
}
