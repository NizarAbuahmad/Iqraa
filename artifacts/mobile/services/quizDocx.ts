/**
 * The quiz as an editable Word exam paper — the file a teacher opens in Word,
 * adjusts, and prints. Before this the Word button ran the plain-text share
 * through `buildWordDocument`, so the "exam" was a list of lines: no space
 * for the student's name, no marks table, and the answer key always on it.
 *
 * Same parts as the printed page (`buildQuizHTML`), from the same helpers
 * (`quizPaper.ts`): student fields, instructions, a marks table for the
 * marker, the questions with lettered options and writing lines, and — on
 * the teacher's copy only — the answer key on a page of its own.
 *
 * Takes the `docx` module as an argument for the reason `ministryPlan.ts`
 * does: this file stays loadable by `node --test`, and the library is only
 * fetched when someone exports.
 */
import type * as Docx from 'docx';

import type { QuizOutput } from './ai/AIService.ts';
import { arCountPhrase } from './arCount.ts';
import { isolateForeignRuns, normalizeExponents } from './mathRender.ts';
import { labelAnswerParts, labelOption } from './optionLabels.ts';
import { quizBlockPoints, quizBlocks, quizInstructions, quizMarkRows, quizMarksTotal, quizStudentFields } from './quizPaper.ts';

/** The marks table's header grey. */
const GREY = 'F3F4F6';

// 2cm margins all round, in twips.
const PAGE_MARGIN = 1134;
const MARKS_COLS = [3200, 1400, 2000];

export function buildQuizDocx(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  includeAnswers: boolean,
  docx: typeof Docx,
): Docx.Document {
  const {
    AlignmentType, BorderStyle, Document, Paragraph, ShadingType,
    Table, TableCell, TableLayoutType, TableRow, TextRun, WidthType,
  } = docx;
  const L = (ar: string, en: string) => isAr ? ar : en;

  // As the printed page does (`esc` in exportHtml.ts): real superscripts, and
  // an equation inside Arabic kept in one left-to-right run.
  const text = (s: string) => isolateForeignRuns(normalizeExponents(s ?? ''));

  // Letter and option text apart: isolating the joined line wraps the
  // letter's full stop with the maths, and Word prints «أ x = 1 .».
  const optionLine = (o: string, index: number) => {
    const { letter, text: body } = labelOption(o, index, isAr);
    return `${letter} ${text(body)}`;
  };
  const answerLine = (options: string[] | undefined, correctAnswer: string) => {
    const { letter, text: body } = labelAnswerParts(options, correctAnswer, isAr);
    return letter ? `${letter} ${text(body)}` : text(body);
  };

  // Arabic is a complex script: Word sizes and bolds it from the
  // *ComplexScript properties, so `size`/`bold` alone leave it at default.
  const run = (s: string, opts: { bold?: boolean; size?: number; color?: string } = {}) => {
    const size = opts.size ?? 22;
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

  // `bidirectional` lays the paragraph out right-to-left; alignment is left
  // to the default — start — which is right for both directions (see
  // docxBuild.ts on why RIGHT lands left in a bidi paragraph).
  const para = (
    s: string,
    opts: { bold?: boolean; size?: number; color?: string; center?: boolean; after?: number; before?: number; indent?: number; pageBreak?: boolean } = {},
  ) => new Paragraph({
    bidirectional: isAr,
    alignment: opts.center ? AlignmentType.CENTER : undefined,
    spacing: { after: opts.after ?? 80, before: opts.before ?? 0 },
    indent: opts.indent ? { start: opts.indent } : undefined,
    pageBreakBefore: opts.pageBreak,
    children: [run(s, opts)],
  });

  const heading = (s: string, opts: { pageBreak?: boolean } = {}) =>
    para(s, { bold: true, size: 26, before: 200, after: 100, pageBreak: opts.pageBreak });

  // ── Head ──────────────────────────────────────────────────────────────────
  const duration = L(arCountPhrase(quiz.duration, 'دقيقة', 'دقيقتان', 'دقائق'), `${quiz.duration} min`);
  const points = L(arCountPhrase(quiz.totalPoints, 'نقطة', 'نقطتان', 'نقاط'), `${quiz.totalPoints} pts`);
  const head = [
    para(text(title), { bold: true, size: 32, center: true, after: 60 }),
    para(`${meta.subject} • ${meta.grade} • ${duration} • ${points}`, { size: 20, color: '6B7280', center: true, after: 240 }),
    para(quizStudentFields(isAr).map(f => `${f}: ________________`).join('     '), { size: 22, after: 240 }),
  ];

  const instructions = [
    heading(L('التعليمات', 'Instructions')),
    ...quizInstructions(quiz.questions, isAr).map(l => para(`• ${l}`, { size: 21, after: 40 })),
  ];

  // ── Marks table ───────────────────────────────────────────────────────────
  const single = { style: BorderStyle.SINGLE, size: 6, color: '9CA3AF' };
  const cell = (s: string, width: number, opts: { bold?: boolean; shaded?: boolean } = {}) => new TableCell({
    children: [para(s, { bold: opts.bold, size: 21, after: 0 })],
    width: { size: width, type: WidthType.DXA },
    margins: { top: 60, bottom: 60, left: 100, right: 100 },
    shading: opts.shaded ? { fill: GREY, type: ShadingType.CLEAR, color: 'auto' } : undefined,
  });
  const rows = quizMarkRows(quiz.questions, isAr);
  // Isolated whole: `isolateForeignRuns` would wrap only «/ 6», and Arabic
  // ordering then prints the blank on the wrong side of the slash.
  const score = (outOf: number) => `\u2066____ / ${outOf}\u2069`;
  const marks = new Table({
    columnWidths: MARKS_COLS,
    width: { size: MARKS_COLS.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    // The first column on the right, as an Arabic table reads.
    visuallyRightToLeft: isAr,
    borders: { top: single, bottom: single, left: single, right: single, insideHorizontal: single, insideVertical: single },
    rows: [
      new TableRow({
        tableHeader: true,
        children: [L('الأسئلة', 'Questions'), L('العدد', 'Count'), L('العلامة', 'Score')]
          .map((h, i) => cell(h, MARKS_COLS[i]!, { bold: true, shaded: true })),
      }),
      ...rows.map(r => new TableRow({
        children: [cell(r.label, MARKS_COLS[0]!), cell(String(r.count), MARKS_COLS[1]!), cell(score(r.points), MARKS_COLS[2]!)],
      })),
      new TableRow({
        children: [
          cell(L('المجموع', 'Total'), MARKS_COLS[0]!, { bold: true }),
          cell(String(quiz.questions.length), MARKS_COLS[1]!, { bold: true }),
          cell(score(quizMarksTotal(rows)), MARKS_COLS[2]!, { bold: true }),
        ],
      }),
    ],
  });

  // ── Questions ─────────────────────────────────────────────────────────────
  const questions = quizBlocks(quiz.questions, isAr).flatMap(block => {
    const pts = quizBlockPoints(block);
    const head = para(
      `${block.heading} (${L(arCountPhrase(pts, 'علامة', 'علامتان', 'علامات'), `${pts} marks`)})`,
      { bold: true, size: 24, before: 280, after: 80 },
    );
    return [head, ...block.questions.flatMap((q, bi) => {
      const i = block.start + bi;
      const qPts = L(arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط'), `${q.points} pts`);
      const stem = new Paragraph({
        bidirectional: isAr,
        keepNext: true,
        spacing: { before: 160, after: 60 },
        children: [run(`${i + 1}. ${text(q.text)}`, { bold: true }), run(`  (${qPts})`, { size: 18, color: '6B7280' })],
      });
      // Options under the stem; a written question gets writing lines, a
      // fill-blank has its blanks in the sentence.
      const body = q.options?.length
        ? q.options.map((o, oi) => para(optionLine(o, oi), { indent: 360, after: 40 }))
        : q.type === 'fill_blank'
          ? []
          : [0, 1, 2].map(() => para('_'.repeat(70), { color: '9CA3AF', after: 120 }));
      return [stem, ...body];
    })];
  });

  // ── Answer key (teacher's copy) ───────────────────────────────────────────
  const key = includeAnswers
    ? [
      heading(L('مفتاح الإجابات', 'Answer Key'), { pageBreak: true }),
      ...quiz.questions.map((q, i) =>
        para(`${i + 1}. ${answerLine(q.options, q.correctAnswer)}${q.explanation ? ` — ${text(q.explanation)}` : ''}`, { after: 60 })),
    ]
    : [];

  return new Document({
    sections: [{
      properties: {
        page: { margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN } },
      },
      children: [
        ...head,
        ...instructions,
        heading(L('جدول العلامات (للمصحّح)', 'Marks (for the marker)')),
        marks,
        ...questions,
        ...key,
      ],
    }],
  });
}

