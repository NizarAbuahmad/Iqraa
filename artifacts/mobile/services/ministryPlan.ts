/**
 * The Ministry of Education's lesson-plan form (نموذج خطة الدرس) as a Word
 * document — one A4-landscape page per lesson, laid out like the paper form
 * teachers are inspected against: a header line (subject / grade / unit /
 * lesson / periods / prior learning), the learning outcomes, the four-stage
 * table (teacher role · learner role · time), the class/absence/date block,
 * the self-reflection box and the signature line.
 *
 * Word rather than PDF because teachers fill and edit this form after
 * exporting it — the absences, the period order, the reflection, and usually
 * the roles themselves. It was a printed HTML page first; that let the table
 * size its columns by content, so a filled teacher column squeezed an empty
 * learner column to a sliver and the page ran onto a second sheet.
 *
 * Takes the `docx` module as an argument rather than importing it, so this
 * file stays free of IO and loadable by `node --test`, and the ~400KB library
 * is still only fetched when someone exports (share.ts imports it lazily).
 * The form is Arabic by definition — there is no English Ministry form.
 *
 * What is filled: everything the app knows (subject, grade, unit, lesson,
 * period count, official outcomes, class, date). The teacher- and
 * learner-role cells are filled only when the caller passes `stages` (from the
 * lesson-plan generator, see `stagesFromLessonPlan`); otherwise they stay
 * empty for the teacher to write.
 */
import type * as Docx from 'docx';

export interface MinistryStage {
  teacher: string;
  learner: string;
}

export interface MinistryLessonPage {
  subject: string;
  grade: string;
  unit: string;
  lesson: string;
  /** Period count from the teacher guide; null when the catalog has none. */
  periods: number | null;
  /** The lesson taught before this one — «التعلم القبلي». */
  priorLearning: string;
  /** Official curriculum outcomes (النتاجات). */
  outcomes: readonly string[];
  /** Class / section name, e.g. «العاشر أ». */
  section: string;
  /** ISO `YYYY-MM-DD`, the day the plan schedules this lesson. */
  date: string;
  teacher: string;
  /** Teacher- and learner-role text for each of the four stages, in order. */
  stages?: readonly MinistryStage[];
}

/**
 * A generated lesson plan as the form's four stages. Uses the model's own
 * teacher/learner split (`ministryRoles`) when it came back whole; otherwise
 * folds the phases into the teacher column and leaves the learner column
 * empty: intro → تهيئة; main + guided → شرح; independent + differentiation →
 * توسع; closure + assessment → تأكيد.
 */
export function stagesFromLessonPlan(plan: {
  ministryRoles?: ReadonlyArray<{ teacher?: unknown; learner?: unknown }>;
  introduction: string;
  mainActivity: string;
  guidedPractice: string;
  independentPractice: string;
  differentiation: string;
  closure: string;
  assessment: string;
}): MinistryStage[] {
  const roles = plan.ministryRoles;
  if (Array.isArray(roles) && roles.length === MINISTRY_STAGES.length) {
    const text = (x: unknown) => (typeof x === 'string' ? x.trim() : '');
    const stages = roles.map(r => ({ teacher: text(r?.teacher), learner: text(r?.learner) }));
    if (stages.every(s => s.teacher || s.learner)) return stages;
  }
  const join = (...xs: string[]) => xs.map(x => (x ?? '').trim()).filter(Boolean).join('\n');
  return [
    join(plan.introduction),
    join(plan.mainActivity, plan.guidedPractice),
    join(plan.independentPractice, plan.differentiation),
    join(plan.closure, plan.assessment),
  ].map(teacher => ({ teacher, learner: '' }));
}

/**
 * The form's four stages, with the minutes it prints beside each (a 45-minute
 * period) and the row's minimum height in twips — the rows grow with their
 * text, but an empty form still leaves room to write by hand.
 */
export const MINISTRY_STAGES = [
  { label: '1-التهيئة والاندماج', minutes: 5, minHeight: 750 },
  { label: '2-الشرح والتفسير', minutes: 15, minHeight: 1150 },
  { label: '3-التوسع ودعم التميز', minutes: 15, minHeight: 1050 },
  { label: '4-تأكيد التعلم', minutes: 10, minHeight: 850 },
] as const;

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** «الأحد 2026-09-20», or the raw string when it is not a real date. */
export function ministryDayAndDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS_AR[d.getDay()]} ${iso}`;
}

/** The form prints at least four numbered outcome slots, filled or not. */
const MIN_OUTCOME_SLOTS = 4;

/** The form's header blue. */
const BLUE = 'B4C6E7';

// A4 landscape in twips, minus 1cm (567) margins all round.
const PAGE_MARGIN = 567;
const CONTENT_WIDTH = 16838 - 2 * PAGE_MARGIN;

/**
 * Stage-table columns, in reading order (right to left on the page): stage,
 * teacher role, learner role, time. Fixed and equal for the two role columns
 * whatever they hold — the bug this file exists to fix.
 */
const STAGE_COLS = [1000, 6650, 6650, CONTENT_WIDTH - 1000 - 6650 * 2];

/** One Word document, one landscape page (section) per lesson. */
export function buildMinistryPlanDocx(pages: readonly MinistryLessonPage[], docx: typeof Docx): Docx.Document {
  const {
    AlignmentType, BorderStyle, Document, HeightRule, PageOrientation, Paragraph, ShadingType,
    Table, TableCell, TableLayoutType, TableRow, TextDirection, TextRun, VerticalAlign, WidthType,
  } = docx;

  // Arabic is a complex script: Word sizes and bolds it from the *ComplexScript
  // properties, so setting only `size`/`bold` silently leaves it at default.
  const run = (text: string, opts: { bold?: boolean; size?: number } = {}) => {
    const size = opts.size ?? 22;
    return new TextRun({
      text,
      rightToLeft: true,
      font: 'Arial',
      bold: opts.bold,
      boldComplexScript: opts.bold,
      size,
      sizeComplexScript: size,
    });
  };

  // `START` is the logical start — the right edge of a bidi paragraph. `RIGHT`
  // is read relative to the paragraph direction by Word and lands left.
  const para = (
    text: string,
    opts: { bold?: boolean; size?: number; align?: 'start' | 'center'; after?: number } = {},
  ) => new Paragraph({
    bidirectional: true,
    alignment: opts.align === 'center' ? AlignmentType.CENTER : AlignmentType.START,
    spacing: { after: opts.after ?? 0 },
    children: [run(text, opts)],
  });

  /** Multi-line text as one paragraph per line; a cell must hold at least one. */
  const lines = (text: string, size: number) => {
    const ps = text.split('\n').map(l => l.trim()).filter(Boolean).map(l => para(l, { size, after: 40 }));
    return ps.length > 0 ? ps : [para('')];
  };

  const single = { style: BorderStyle.SINGLE, size: 6, color: '000000' };
  const none = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
  const allBorders = (b: Docx.IBorderOptions) => ({
    top: b, bottom: b, left: b, right: b, insideHorizontal: b, insideVertical: b,
  });
  const margins = { top: 60, bottom: 60, left: 100, right: 100 };
  const blue = { fill: BLUE, type: ShadingType.CLEAR, color: 'auto' };

  const cell = (
    children: (Docx.Paragraph | Docx.Table)[],
    width: number,
    opts: { shaded?: boolean; vertical?: boolean; center?: boolean; borders?: 'none' } = {},
  ) => new TableCell({
    children,
    width: { size: width, type: WidthType.DXA },
    margins,
    shading: opts.shaded ? blue : undefined,
    textDirection: opts.vertical ? TextDirection.BOTTOM_TO_TOP_LEFT_TO_RIGHT : undefined,
    verticalAlign: opts.center ? VerticalAlign.CENTER : VerticalAlign.TOP,
    borders: opts.borders === 'none' ? { top: none, bottom: none, left: none, right: none } : undefined,
  });

  // `visuallyRightToLeft` puts the first cell on the right, as the form reads.
  const table = (rows: Docx.TableRow[], widths: number[], borders: 'single' | 'none' = 'single') => new Table({
    rows,
    columnWidths: widths,
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    layout: TableLayoutType.FIXED,
    visuallyRightToLeft: true,
    borders: allBorders(borders === 'none' ? none : single),
  });

  /** A spacer between blocks — Word puts no gap between consecutive tables. */
  const gap = (after: number) => new Paragraph({ spacing: { after, line: 120 }, children: [] });

  const page = (p: MinistryLessonPage): (Docx.Paragraph | Docx.Table)[] => {
    const header = [
      `المبحث: ${p.subject}`,
      `الصف: ${p.grade}`,
      `الوحدة: ${p.unit}`,
      `الدرس: ${p.lesson}`,
      `عدد الحصص: ${p.periods ?? ''}`,
      `التعلم القبلي: ${p.priorLearning}`,
    ].join('        ');

    const slots = Math.max(MIN_OUTCOME_SLOTS, p.outcomes.length);
    const outcomes = table([
      new TableRow({
        children: [cell([
          para('النتاجات التعليمية :', { bold: true, size: 22, after: 60 }),
          ...Array.from({ length: slots }, (_, i) => para(`${i + 1}_ ${p.outcomes[i] ?? ''}`, { size: 20, after: 40 })),
        ], CONTENT_WIDTH)],
      }),
    ], [CONTENT_WIDTH]);

    const headCell = (text: string, w: number) =>
      cell([para(text, { bold: true, size: 20, align: 'center' })], w, { shaded: true, center: true });
    const stages = table([
      new TableRow({
        tableHeader: true,
        children: [
          headCell('المراحل', STAGE_COLS[0]),
          headCell('دور المُعلم', STAGE_COLS[1]),
          headCell('دور المُتعلم', STAGE_COLS[2]),
          headCell('الزمن', STAGE_COLS[3]),
        ],
      }),
      ...MINISTRY_STAGES.map((s, i) => new TableRow({
        cantSplit: true,
        height: { value: s.minHeight, rule: HeightRule.ATLEAST },
        children: [
          cell([para(s.label, { bold: true, size: 20, align: 'center' })], STAGE_COLS[0], { shaded: true, vertical: true, center: true }),
          cell(lines(p.stages?.[i]?.teacher ?? '', 19), STAGE_COLS[1]),
          cell(lines(p.stages?.[i]?.learner ?? '', 19), STAGE_COLS[2]),
          cell([para(`${s.minutes}د`, { bold: true, size: 20 })], STAGE_COLS[3]),
        ],
      })),
    ], STAGE_COLS);

    // The class/date block on the left, the reflection box on the right,
    // side by side as on the paper form: a borderless outer table holding
    // both. A cell must end in a paragraph, hence the trailing empty one.
    const META = [2600, 2600];
    const meta = table(
      [
        ['الصف/الشعبة', p.section],
        ['عدد الغياب/العدد الكلي', ''],
        ['ترتيب الحصة', ''],
        ['اليوم والتاريخ', ministryDayAndDate(p.date)],
      ].map(([label, value]) => new TableRow({
        height: { value: 330, rule: HeightRule.ATLEAST },
        children: [
          cell([para(label, { bold: true, size: 20 })], META[0], { shaded: true, center: true }),
          cell([para(value, { size: 20 })], META[1], { center: true }),
        ],
      })),
      META,
    );
    const metaWidth = META[0] + META[1];
    const gutter = 500;
    const reflectWidth = CONTENT_WIDTH - metaWidth - gutter;
    // One unsplittable row: the class/date block and the reflection box move
    // to a new page together or not at all.
    const footer = table([
      new TableRow({
        cantSplit: true,
        children: [
          new TableCell({
            children: [para('*التأمل الذاتي : حول عمليتي التعلم والتعليم', { bold: true, size: 20 })],
            width: { size: reflectWidth, type: WidthType.DXA },
            margins,
            borders: { top: single, bottom: single, left: single, right: single },
          }),
          cell([para('')], gutter, { borders: 'none' }),
          cell([meta, para('')], metaWidth, { borders: 'none' }),
        ],
      }),
    ], [reflectWidth, gutter, metaWidth], 'none');

    const signWidth = CONTENT_WIDTH / 4;
    const signature = table([
      new TableRow({
        children: [
          `الاسم والتوقيع: المعلم : ${p.teacher}`,
          'اخصائي المبحث:',
          'مدير المدرسة:',
          'مستشار التطوير المدرسي :',
        ].map(text => cell([para(text, { bold: true, size: 20 })], signWidth, { borders: 'none' })),
      }),
    ], [signWidth, signWidth, signWidth, signWidth], 'none');

    return [
      para('خطة الدرس', { bold: true, size: 28, align: 'center', after: 40 }),
      para(header, { bold: true, size: 20, after: 80 }),
      outcomes,
      gap(60),
      stages,
      gap(120),
      footer,
      gap(160),
      signature,
    ];
  };

  return new Document({
    sections: pages.map(p => ({
      properties: {
        page: {
          size: { orientation: PageOrientation.LANDSCAPE },
          margin: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
        },
      },
      children: page(p),
    })),
  });
}
