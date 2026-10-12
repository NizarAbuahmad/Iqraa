/**
 * The class marks register as an editable Word file (landscape, one table).
 *
 * Marks the app holds are filled in; the rest of the register — the paper
 * assessments a teacher still records by hand — is left as blank columns, so
 * the printed sheet is the whole register and not only the half Iqraa knows.
 * See `marksRegister.ts` for what counts as a mark.
 *
 * Takes the `docx` module as an argument, like `quizDocx.ts`, so this stays
 * loadable by `node --test`.
 */
import type * as Docx from 'docx';

import { formatMark, type MarksRegister } from './marksRegister.ts';

const GREY = 'F3F4F6';

// A4 landscape, 1.27cm margins, in twips.
const PAGE_W = 16838;
const PAGE_H = 11906;
const MARGIN = 720;
const USABLE = PAGE_W - MARGIN * 2;
const NO_COL = 500;
const NAME_COL = 3200;
const TOTAL_COL = 1000;

/** Assessments the teacher still records on paper (the register's other columns). */
const BLANK_COLUMNS_AR = ['اختبار قصير', 'واجب', 'مشروع', 'امتحان نصفي'];
const BLANK_COLUMNS_EN = ['Short test', 'Homework', 'Project', 'Midterm'];

export function buildMarksRegisterDocx(
  register: MarksRegister,
  meta: { className: string; subject: string; grade: string },
  isAr: boolean,
  docx: typeof Docx,
): Docx.Document {
  const {
    AlignmentType, BorderStyle, Document, PageOrientation, Paragraph, ShadingType,
    Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
  } = docx;
  const L = (ar: string, en: string) => isAr ? ar : en;

  const run = (s: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => {
    const size = opts.size ?? 20;
    return new TextRun({
      text: s,
      rightToLeft: isAr,
      font: 'Arial',
      bold: opts.bold,
      boldComplexScript: opts.bold,
      size,
      sizeComplexScript: size,
      color: opts.color,
    });
  };
  const para = (s: string, opts: { bold?: boolean; size?: number; center?: boolean; after?: number; color?: string } = {}) =>
    new Paragraph({
      bidirectional: isAr,
      alignment: opts.center ? AlignmentType.CENTER : undefined,
      spacing: { after: opts.after ?? 0 },
      children: [run(s, opts)],
    });

  const blanks = isAr ? BLANK_COLUMNS_AR : BLANK_COLUMNS_EN;
  const dataCols = register.columns.length + blanks.length;
  const dataW = Math.max(600, Math.floor((USABLE - NO_COL - NAME_COL - TOTAL_COL) / dataCols));
  const widths = [NO_COL, NAME_COL, ...Array<number>(dataCols).fill(dataW), TOTAL_COL];

  const single = { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF' };
  const cell = (s: string, width: number, opts: { bold?: boolean; shaded?: boolean; center?: boolean } = {}) => new TableCell({
    children: [para(s, { bold: opts.bold, size: 19, center: opts.center })],
    width: { size: width, type: WidthType.DXA },
    margins: { top: 50, bottom: 50, left: 70, right: 70 },
    shading: opts.shaded ? { fill: GREY, type: ShadingType.CLEAR, color: 'auto' } : undefined,
  });
  const rowOf = (cells: string[], opts: { bold?: boolean; shaded?: boolean } = {}) => new TableRow({
    cantSplit: true,
    children: cells.map((s, i) => cell(s, widths[i]!, { ...opts, center: i !== 1 })),
  });

  const header = [
    L('م', '#'), L('اسم الطالب', 'Student'),
    ...register.columns.map(c => c.title), ...blanks, L('المجموع', 'Total'),
  ];
  const outOf = [
    '', L('العلامة العظمى', 'Out of'),
    ...register.columns.map(c => formatMark(c.outOf)), ...blanks.map(() => ''),
    register.columns.length ? formatMark(register.outOf) : '',
  ];

  const table = new Table({
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    // First column on the right, as an Arabic table reads.
    visuallyRightToLeft: isAr,
    borders: { top: single, bottom: single, left: single, right: single, insideHorizontal: single, insideVertical: single },
    rows: [
      new TableRow({ tableHeader: true, cantSplit: true, children: header.map((s, i) => cell(s, widths[i]!, { bold: true, shaded: true, center: i !== 1 })) }),
      rowOf(outOf, { bold: true }),
      ...register.rows.map((r, i) => rowOf([
        String(i + 1), r.name,
        ...r.marks.map(formatMark), ...blanks.map(() => ''),
        formatMark(r.total),
      ])),
    ],
  });

  return new Document({
    sections: [{
      properties: {
        page: {
          size: { width: PAGE_W, height: PAGE_H, orientation: PageOrientation.LANDSCAPE },
          margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        },
      },
      children: [
        para(L('سجل العلامات', 'Marks Register'), { bold: true, size: 30, center: true, after: 60 }),
        para(`${meta.className} • ${meta.subject} • ${meta.grade}`, { size: 20, color: '6B7280', center: true, after: 160 }),
        table,
      ],
    }],
  });
}
