/**
 * Every HTML document the app exports — worksheet, quiz, lesson plan, activity,
 * the projector-handout slide decks, and the all-in-one lesson-flow PDF.
 *
 * Split out of `share.ts` because that file imports `react-native` at module
 * scope for Platform/Share, which `node:test` cannot parse — so nothing in it
 * could be tested. That is not a hypothetical cost. In August 2026 every
 * Arabic PDF laid its option letters out left-to-right, and lettered them
 * A/B/C/D on an Arabic paper, for an unknown length of time; the bug reached a
 * teacher's printer because no test could see the markup. Same reason
 * `deckSlidesHtml.ts` was split out before this.
 *
 * Everything here is a pure string builder: same inputs, same HTML, no IO. The
 * IO — expo-print, the share sheet, the clipboard — stays in `share.ts`, which
 * re-exports these so no caller had to change.
 *
 * The RTL rule these builders live by, learned the hard way: `<body>` sets
 * `direction`, which already lays flex items right-to-left in Arabic. Adding
 * `flex-direction: row-reverse` on top reverses a reversal and lands the row
 * back on the left. Never re-reverse a row inside an already-RTL document —
 * and note this is the opposite of the rule in React Native components, where
 * `row-reverse` is correct because RN has no document direction to inherit.
 */
import { labelAnswer, labelOption, labelOptionLine } from './optionLabels.ts';
import { arCountPhrase } from './arCount.ts';
import { isolateForeignRuns } from './mathRender.ts';
import type {
  ActivityOutput,
  LessonFlowOutput,
  LessonPlanOutput,
  QuizOutput,
  SimplifiedExplanationOutput,
  WorksheetOutput,
} from './ai/AIService.ts';

/**
 * Every export below sets `direction` on `<body>`, which already lays flex
 * items right-to-left in Arabic. Adding `flex-direction: row-reverse` on top of
 * that reverses a reversal: main-start moves back to the left edge, so the row
 * packs against the left of a right-aligned page. That is what put the option
 * letter on the wrong side of its own option, and the school block opposite the
 * date, in every Arabic PDF. Rows are plain `row` now and let `direction` do
 * the work — never re-reverse a row inside an already-RTL document.
 */
/**
 * The accent a printed document is built around.
 *
 * The same four colours the projector already uses per artifact type
 * (`buildWorksheetSlidesHTML` et al, and `deckTheme.ts`'s `slideTypeAccent`),
 * so a teacher who prints a worksheet and then projects it sees one product.
 * They were previously teal for everything except the activity, which had its
 * own orange and its own hand-built document to put it in.
 */
export const DOC_ACCENT = {
  lesson: '#1B6B62',
  worksheet: '#8B5CF6',
  quiz: '#F59E0B',
  activity: '#E67E22',
  explainer: '#00A99D',
} as const;

/** Where the name-and-date block gets its rule, and every section its tint. */
type DocKind = keyof typeof DOC_ACCENT;

/**
 * A tinted section band with an icon — the one shape this stylesheet is
 * built around.
 *
 * Lifted from `buildLessonFlowHTML`'s `secHeader`, which was the only builder
 * in this file that looked designed: an 8%-alpha tint of the accent
 * (`${color}15` is 8-digit hex, not a typo) behind an emoji and a bold label,
 * with a 4px bar on the inline-start edge. Everything else here printed a
 * grey hairline and 13px uppercase letter-spaced caps.
 *
 * The bar is branched rather than written with `border-inline-start` because
 * this document's other physical properties already are, and expo-print's
 * WebKit is the older of the two engines it has to satisfy. Note it must not
 * become a flex row with `row-reverse` — see this file's header.
 */
function sectionBand(label: string, icon: string, color: string, isRTL: boolean): string {
  const bar = isRTL
    ? `border-right:4px solid ${color}`
    : `border-left:4px solid ${color}`;
  return `<div class="sec-band" style="background:${color}15;${bar}">
      <span class="sec-icon">${icon}</span>
      <span class="sec-label" style="color:${color}">${esc(label)}</span>
    </div>`;
}

function htmlBase(
  content: string,
  isRTL: boolean,
  title: string,
  kind: DocKind = 'lesson',
): string {
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  const accent = DOC_ACCENT[kind];
  // The app's own typefaces. The stack here has always NAMED Amiri and never
  // loaded it, and Amiri ships on no phone or desktop we target — so every
  // worksheet a teacher has ever printed fell through to system Arial while
  // the projector deck rendered in Cairo/Almarai. Same product, two
  // typographies. Linked rather than embedded for the reason
  // `deckSlidesHtml.ts` documents at length: ~440KB of faces would sit in
  // every bundle including those that never export, this path already assumes
  // network for images, and with none the stack falls back to Arial — exactly
  // what it printed before, so offline is no worse than today. `share.ts`'s
  // `waitForFonts` (2.5s ceiling) exists for precisely this.
  return `<!DOCTYPE html>
<html lang="${isRTL ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Cairo:wght@500;600;700&family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 portrait; margin: 14mm 12mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isRTL ? "'Almarai', 'Noto Naskh Arabic', Arial" : "'Inter', 'Helvetica Neue', Arial"}, sans-serif;
      font-size: 13px; line-height: 1.7; color: #1f2937;
      padding: 0; direction: ${dir}; text-align: ${align};
      background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact;
    }
    /* A4 portrait minus the 12mm side margins above is ~186mm ≈ 703px at
       96dpi. 800px (what the lesson-flow document uses, which declares no
       @page and so inherits the engine's own wider default) would clip on
       the inline-end edge once a page size is declared. */
    .page { max-width: 700px; margin: 0 auto; padding: 8px 4px 0; }
    h1, h2, h3, .doc-title, .sec-label, .school-placeholder {
      font-family: ${isRTL ? "'Cairo', 'Almarai', Arial" : "'Inter', 'Helvetica Neue', Arial"}, sans-serif;
    }
    /* Masthead — an accent band, not a hairline. */
    .school-header {
      display: flex; justify-content: space-between; align-items: center;
      flex-direction: row; gap: 12px;
      background: ${accent}0F; border-radius: 10px;
      padding: 12px 16px; margin-bottom: 18px;
    }
    .school-name { font-size: 12px; color: #6b7280; }
    .school-placeholder { font-weight: 700; color: ${accent}; font-size: 14px; }
    .doc-title { font-size: 23px; font-weight: 700; color: #111827; margin-bottom: 6px; line-height: 1.35; }
    .doc-meta { font-size: 12px; color: #6b7280; margin-bottom: 20px; }
    /* Sections */
    .section { margin-bottom: 18px; break-inside: avoid; }
    .sec-band {
      display: flex; align-items: center; gap: 8px; flex-direction: row;
      padding: 7px 12px; border-radius: 6px; margin-bottom: 10px;
    }
    .sec-icon { font-size: 15px; }
    .sec-label { font-size: 13.5px; font-weight: 700; }
    .section-title {
      font-size: 13px; font-weight: 700; color: ${accent};
      padding-bottom: 4px; margin-bottom: 8px;
      border-bottom: 1px solid ${accent}33;
    }
    .body-text { font-size: 12.5px; line-height: 1.8; color: #374151; }
    ul { padding-${isRTL ? 'right' : 'left'}: 18px; }
    li { margin-bottom: 5px; font-size: 12.5px; color: #374151; line-height: 1.6; }
    /* Question cards — a numbered badge instead of a bold full stop. */
    .q-card {
      background: #f9fafb; border: 1px solid #eef0f3; border-radius: 8px;
      padding: 11px 13px; margin-bottom: 8px; break-inside: avoid;
    }
    .q-head { display: flex; align-items: center; gap: 8px; flex-direction: row; margin-bottom: 5px; }
    .q-num {
      background: ${accent}; color: #fff;
      min-width: 22px; height: 22px; border-radius: 50%;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 700; flex-shrink: 0;
    }
    .q-text { font-size: 12.5px; color: #111827; line-height: 1.6; flex: 1; }
    .q-option {
      display: flex; flex-direction: row; gap: 8px; align-items: flex-start;
      margin-top: 5px; font-size: 12px; color: #4b5563;
      padding-${isRTL ? 'right' : 'left'}: 12px;
    }
    .q-pts { font-size: 10.5px; color: #9ca3af; margin-top: 5px; }
    .q-type {
      font-size: 10px; background: #fef3c7; color: #92400e;
      padding: 2px 8px; border-radius: 9px; white-space: nowrap; flex-shrink: 0;
      align-self: flex-start;
    }
    /* Writing room: a worksheet a student answers ON needs ruled space. */
    .q-lines { margin-top: 8px; }
    .q-rule { border-bottom: 1px solid #d1d5db; height: 20px; }
    /* Answer key stays green — it is the one block that is not about the
       document's own accent but about being obviously the teacher's half. */
    .answer-key {
      background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px;
      padding: 14px; margin-top: 22px; break-inside: avoid;
    }
    .answer-key .section-title { color: #15803d; border-color: #bbf7d0; }
    .answer-row { display: flex; flex-direction: row; gap: 8px; margin-bottom: 5px; font-size: 12px; }
    .answer-num { font-weight: 700; color: #15803d; min-width: 24px; }
    /* Step cards, for the activity's numbered run-sheet. */
    .step-card {
      display: flex; flex-direction: row; gap: 10px; align-items: flex-start;
      background: #f9fafb; border-radius: 8px; padding: 10px 12px;
      margin-bottom: 8px; break-inside: avoid;
    }
    .step-num {
      min-width: 24px; height: 24px; border-radius: 50%;
      background: ${accent}; color: #fff; font-size: 11px; font-weight: 700;
      display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .step-body { flex: 1; }
    .step-title { font-size: 12.5px; font-weight: 700; color: #111827; margin-bottom: 3px; }
    .step-desc { font-size: 11.5px; color: #6b7280; line-height: 1.55; }
    /* A tinted callout for the one line that matters most on the page. */
    .callout {
      background: ${accent}0F; border-radius: 8px; padding: 12px 14px;
      margin-bottom: 16px; font-size: 12.5px; color: #374151; line-height: 1.7;
      ${isRTL ? `border-right:4px solid ${accent}` : `border-left:4px solid ${accent}`};
    }
    .footer {
      margin-top: 28px; padding-top: 12px; border-top: 1px solid #e5e7eb;
      font-size: 10.5px; color: #9ca3af; text-align: center;
    }
  </style>
</head>
<body>
  <div class="page">
  <div class="school-header">
    <div>
      <div class="school-placeholder">${isRTL ? 'اقرأ — مساعد التدريس الذكي' : 'Iqra — AI Teaching Assistant'}</div>
      <div class="school-name">${isRTL ? 'اسم المدرسة' : 'School Name'}</div>
    </div>
    <div class="school-name">${new Date().toLocaleDateString(isRTL ? 'ar-JO' : 'en-GB')}</div>
  </div>
  ${content}
  <div class="footer">${isRTL ? 'أُنشئ بواسطة اقرأ — مساعد التدريس الذكي' : 'Generated by Iqra — AI Teaching Assistant'}</div>
  </div>
</body>
</html>`;
}

/** Escape only. For attribute values — above all URLs, which must not carry
 *  the directional isolates `esc` adds. */
function escAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Escape *and* bidi-isolate. Every text node in this file is model-written
 * Arabic that can carry an equation, and a printed worksheet reordering
 * «f(x) = 2x⁴ - x² + 3» is the same bug the screens had — a teacher hands it
 * to a class on paper, where nobody can reload to check. Isolation belongs
 * here rather than at the 57 call sites so a new builder cannot forget it;
 * `escAttr` is the deliberate opt-out for the one URL attribute.
 */
function esc(s: string): string {
  // Null-safe via isolateForeignRuns, which two builders here relied on when
  // they each carried their own `s ?? ''` copy of this function.
  return escAttr(isolateForeignRuns(s));
}

/**
 * A book figure ready to print — already resolved to a loadable URI and
 * already captioned. Kept separate from `BookFigure` in `bookFigures.ts`:
 * this file is pure and pulled into `node --test` (see the header note), and
 * resolving a figure to a URI needs `bookFigureUri.ts`, which imports
 * react-native to do it. The caller resolves both and hands over a plain
 * object — the same dependency-injection shape `lessonSlides.ts` already uses
 * for `opts.figureUri`, so this file still never touches react-native.
 */
export interface BookFigureRef {
  uri: string;
  /** 1-based page in the source PDF — the citation a teacher can check. */
  page: number;
  caption: string;
}

/**
 * Cap on how many of a lesson's figures print in a document's appendix.
 *
 * Unlike a slide deck (`BOOK_FIGURE_MAX = 2`, one per beat), this is one
 * static page: the circle-geometry lesson alone has 25 figures, and printing
 * all of them before the answer key would bury it. Six is generous for "the
 * diagrams this lesson's exercises reference" while keeping the appendix a
 * page, not a photocopy of the chapter.
 */
export const EXPORT_FIGURE_MAX = 6;

/**
 * The "from the textbook" appendix a worksheet, quiz, lesson plan or activity
 * can carry — lesson-level, never per-question.
 *
 * A generated question can say «انظر الشكل المجاور» because that is how the
 * book itself writes such a question, and a teacher reading it expects a
 * picture. But the model that wrote the question never saw the book's
 * figures, so it cannot know which one goes with which item — letting it
 * choose would be the same fabrication `demoExtractFromName`'s fence exists
 * to stop, in a new place. What is safe without a vision model is showing
 * every diagram the book prints for this lesson, cited by page, and trusting
 * the teacher to match it to a question by eye, exactly as a student does
 * from the printed book itself.
 *
 * Self-contained inline styles rather than the `.section`/`.section-title`
 * classes `htmlBase` defines: `buildActivityHTML` builds its own document
 * with no such classes, and this function is called from both.
 */
function figuresSectionHTML(figures: readonly BookFigureRef[], isAr: boolean): string {
  if (!figures.length) return '';
  const shown = figures.slice(0, EXPORT_FIGURE_MAX);
  const cards = shown.map(f => `
      <div style="break-inside:avoid;page-break-inside:avoid;border:1px solid #e5e7eb;border-radius:6px;padding:10px;text-align:center;background:#fafafa">
        <img src="${escAttr(f.uri)}" alt="${esc(f.caption)}" style="max-width:100%;max-height:260px;object-fit:contain" />
        <div style="font-size:11px;color:#666;margin-top:6px">${esc(f.caption)}</div>
      </div>`).join('');
  const note = isAr
    ? 'أشكالٌ من الكتاب المدرسي لهذا الدرس، ليطابقها المعلّم بعينه مع أيّ سؤال يشير إلى شكل.'
    : "Figures from this lesson's student book, for the teacher to match by eye against any question that refers to one.";
  return `
    <div style="margin-top:24px;break-inside:avoid">
      <div style="font-size:13px;font-weight:700;color:#1B6B62;text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:6px">${isAr ? 'من الكتاب المدرسي' : 'From the Student Book'}</div>
      <div style="font-size:11px;color:#888;margin-bottom:10px;font-style:italic">${esc(note)}</div>
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">${cards}</div>
    </div>`;
}

/**
 * One `.q-option` row. Shared by the worksheet and quiz builders, which had
 * byte-identical copies of this line — the kind of duplication that lets one
 * export get fixed and the other keep printing A/B/C/D.
 */
/**
 * The «من الكتاب المدرسي» appendix as a *projector* slide, for the four
 * `*SlidesHTML` builders.
 *
 * `figuresSectionHTML` above is the A4-portrait version those same four
 * documents print. This is the landscape one, because the slide builders lay
 * out 297×210mm pages with their own `.slide` / `.slide-header` /
 * `.slide-body` chrome, and a figure grid sized for a printed page overflows
 * a projected one.
 *
 * Why this exists at all: the print and project paths of the same worksheet
 * disagreed. `buildWorksheetHTML` ended with the figure appendix while
 * `buildWorksheetSlidesHTML` was marked "Text only in this builder" and took
 * no figures argument — so a teacher who printed the paper got the book's
 * diagrams and the same teacher projecting the same worksheet got none, with
 * nothing to say why. The two call sites sit two lines apart in
 * `useGeneratorExport.ts`.
 *
 * Returns '' for no figures, so a builder can interpolate it unconditionally
 * and a lesson without figures renders exactly as it did before.
 */
function figureGridHTML(figures: readonly BookFigureRef[]): string {
  const shown = figures.slice(0, EXPORT_FIGURE_MAX);
  // Three across at most: beyond that each crop is too small to read from the
  // back row, which is the only reason to put one on a projector at all. Four
  // is the exception — three across leaves one figure alone on a second row,
  // so it goes 2×2. (The portrait appendix always uses two columns; it can
  // spend as many rows as it likes on a page that scrolls.)
  const cols = shown.length === 4 ? 2 : Math.min(shown.length, 3);
  const cards = shown.map(f => `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:6px;min-width:0">
          <img src="${escAttr(f.uri)}" alt="${esc(f.caption)}" style="max-width:100%;max-height:110mm;object-fit:contain" />
          <div style="font-size:10px;color:#6b7280;text-align:center">${esc(f.caption)}</div>
        </div>`).join('');
  return `<div class="slide-body">
      <div style="height:100%;display:grid;grid-template-columns:repeat(${cols},1fr);gap:14px;align-items:end">${cards}</div>
    </div>`;
}

/**
 * The whole slide, for the three builders that emit `<div class="slide">`
 * blocks themselves and number their own footers. `buildLessonPlanSlidesHTML`
 * assembles an array and numbers it afterwards, so that one takes
 * `figureGridHTML` directly and lets the loop supply the footer.
 */
function figuresSlideHTML(
  figures: readonly BookFigureRef[],
  isAr: boolean,
  header: (sub: string) => string,
  footerHTML: string,
): string {
  if (!figures.length) return '';
  return `<div class="slide">
    ${header(isAr ? 'من الكتاب المدرسي' : 'From the Student Book')}
    ${figureGridHTML(figures)}
    ${footerHTML}</div>`;
}

/**
 * Ruled lines under a question with no options, for the student to write on.
 *
 * Three: enough for a worked short answer, few enough that four questions
 * still fit a page. An array rather than a count so the caller reads as
 * markup rather than arithmetic.
 */
const ANSWER_RULES = [0, 1, 2];

/**
 * Section glyphs, cycled. A worksheet's sections are generated and named by
 * difficulty ("القسم الأول"), so there is nothing to map an icon to
 * semantically the way the lesson plan's fixed phases allow — cycling keeps
 * consecutive bands visually distinct without claiming meaning they lack.
 */
const SECTION_GLYPHS = ['📝', '🧩', '📐', '🔎', '🧠'];

function optionRowHTML(text: string, index: number, isAr: boolean): string {
  const { letter, text: body } = labelOption(text, index, isAr);
  return `<div class="q-option"><span>${esc(letter)}</span> <span>${esc(body)}</span></div>`;
}

export function buildLessonPlanHTML(
  plan: LessonPlanOutput,
  title: string,
  meta: { subject: string; grade: string; duration?: number },
  isAr: boolean,
  figures: readonly BookFigureRef[] = [],
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  const A = DOC_ACCENT.lesson;
  // One icon per phase of the lesson, in the order a teacher walks it. The
  // colours are not decorative: they are the same per-phase palette
  // `buildLessonFlowHTML` prints, so the plan and the all-in-one flow read as
  // the same document family rather than two unrelated PDFs of one lesson.
  const section = (label: string, icon: string, color: string, body: string) =>
    `<div class="section">${sectionBand(label, icon, color, isAr)}<div class="body-text">${esc(body)}</div></div>`;

  const bullets = (label: string, icon: string, color: string, items: string[]) =>
    `<div class="section">${sectionBand(label, icon, color, isAr)}<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)}${meta.duration ? ` • ${L(arCountPhrase(meta.duration, 'دقيقة', 'دقيقتان', 'دقائق'), `${meta.duration} min`)}` : ''}</div>
    ${bullets(L('الأهداف', 'Objectives'), '🎯', '#081B3A', plan.objectives)}
    ${bullets(L('المواد اللازمة', 'Materials Needed'), '🧰', '#6B7280', plan.materials)}
    ${plan.priorReview?.trim() ? section(L('مراجعة سابقة', 'Prior Knowledge Review'), '🔁', '#0EA5E9', plan.priorReview) : ''}
    ${section(L('التمهيد', 'Introduction'), '🔥', '#E67E22', plan.introduction)}
    ${section(L('النشاط الرئيسي', 'Main Activity'), '⚡', '#4F46E5', plan.mainActivity)}
    ${section(L('التدريب الموجّه', 'Guided Practice'), '✏️', A, plan.guidedPractice)}
    ${section(L('التدريب المستقل', 'Independent Practice'), '🧑', A, plan.independentPractice)}
    ${section(L('الختام', 'Closure'), '⏹', '#8B5CF6', plan.closure)}
    ${section(L('التقييم', 'Assessment'), '✅', '#16A34A', plan.assessment)}
    ${section(L('التمايز', 'Differentiation'), '🔀', '#0891B2', plan.differentiation)}
    ${section(L('الواجب المنزلي', 'Homework'), '🏠', '#F59E0B', plan.homework)}
    ${figuresSectionHTML(figures, isAr)}
  `;
  return htmlBase(content, isAr, title, 'lesson');
}

export function buildWorksheetHTML(
  ws: WorksheetOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  figures: readonly BookFigureRef[] = [],
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  let qNum = 1;
  const sections = ws.sections.map((sec, si) => {
    const questions = sec.questions.map(q => {
      const options = q.options
        ? q.options.map((o, oi) => optionRowHTML(o, oi, isAr)).join('')
        : '';
      // Somewhere to write. A worksheet is the one document a student fills
      // in, and this printed multiple-choice options or nothing at all — so
      // every short-answer question arrived as a sentence floating above the
      // next sentence, and the teacher's copier did the ruling by hand.
      // Options mean the answer goes in the margin, so the rules are only for
      // questions that have none.
      const room = q.options ? '' : `<div class="q-lines">${ANSWER_RULES.map(() => '<div class="q-rule"></div>').join('')}</div>`;
      const html = `<div class="q-card">`
        + `<div class="q-head"><span class="q-num">${qNum}</span><span class="q-text">${esc(q.text)}</span></div>`
        + `${options}${room}`
        + `<div class="q-pts">${L(arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط'), `${q.points} pts`)}</div>`
        + `</div>`;
      qNum++;
      return html;
    }).join('');
    return `<div class="section">${sectionBand(sec.title, SECTION_GLYPHS[si % SECTION_GLYPHS.length]!, DOC_ACCENT.worksheet, isAr)}${questions}</div>`;
  }).join('');

  const akRows = ws.answerKey?.map(item =>
    `<div class="answer-row"><span class="answer-num">${item.num}.</span><span>${esc(item.answer)}</span></div>`
  ).join('') ?? '';

  const answerKey = akRows
    ? `<div class="answer-key"><div class="section-title">${L('مفتاح الإجابات', 'Answer Key')}</div>${akRows}</div>`
    : '';

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)}</div>
    ${ws.instructions ? `<div class="callout">${esc(ws.instructions)}</div>` : ''}
    ${sections}
    ${answerKey}
    ${figuresSectionHTML(figures, isAr)}
  `;
  return htmlBase(content, isAr, title, 'worksheet');
}

export function buildQuizHTML(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  figures: readonly BookFigureRef[] = [],
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  const typeLabel = (t: string) =>
    t === 'multiple_choice' ? L('اختيار متعدد', 'MCQ')
      : t === 'true_false' ? L('صح/خطأ', 'True/False')
        : L('إجابة قصيرة', 'Short Answer');

  const questions = quiz.questions.map((q, i) => {
    const options = q.options
      ? q.options.map((o, oi) => optionRowHTML(o, oi, isAr)).join('')
      : '';
    // A short-answer question on a quiz needs writing room for the same
    // reason it does on a worksheet — this is the paper a student sits.
    const room = q.options ? '' : `<div class="q-lines">${ANSWER_RULES.map(() => '<div class="q-rule"></div>').join('')}</div>`;
    return `<div class="q-card">
      <div class="q-head">
        <span class="q-num">${i + 1}</span>
        <span class="q-text">${esc(q.text)}</span>
        <span class="q-type">${typeLabel(q.type)}</span>
      </div>
      ${options}${room}
      <div class="q-pts">${L(arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط'), `${q.points} pts`)}</div>
    </div>`;
  }).join('');

  const akRows = quiz.questions.map((q, i) =>
    `<div class="answer-row"><span class="answer-num">${i + 1}.</span><span>${esc(labelAnswer(q.options, q.correctAnswer, isAr))}</span></div>`
  ).join('');

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)} • ${L(arCountPhrase(quiz.duration, 'دقيقة', 'دقيقتان', 'دقائق'), `${quiz.duration} min`)} • ${L(arCountPhrase(quiz.totalPoints, 'نقطة', 'نقطتان', 'نقاط'), `${quiz.totalPoints} pts`)}</div>
    ${sectionBand(L('الأسئلة', 'Questions'), '📋', DOC_ACCENT.quiz, isAr)}
    ${questions}
    <div class="answer-key"><div class="section-title">${L('مفتاح الإجابات', 'Answer Key')}</div>${akRows}</div>
    ${figuresSectionHTML(figures, isAr)}
  `;
  return htmlBase(content, isAr, title, 'quiz');
}
export function buildActivityHTML(
  activity: ActivityOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  figures: readonly BookFigureRef[] = [],
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  const A = DOC_ACCENT.activity;

  // This builder used to write its own `<!DOCTYPE html>` with a five-rule
  // stylesheet and inline styles on every element — which is why
  // `figuresSectionHTML` is inline-styled too (it is shared with the three
  // builders that DO have classes, and a class-based version rendered
  // unstyled here). Moving it onto `htmlBase` closes that: the activity now
  // gets the same fonts, the same section bands and the same question
  // vocabulary as the other three, and the appendix's inline styles are no
  // longer load-bearing — left alone here only because nothing forces the
  // change and a shared function is the wrong place to take a risk.
  const stepsHtml = activity.steps.map(s => `
    <div class="step-card">
      <span class="step-num">${s.stepNumber}</span>
      <div class="step-body">
        <div class="step-title">${esc(s.title)}<span class="q-pts" style="margin-${isAr ? 'right' : 'left'}:8px;display:inline">${s.durationMin} ${L('د', 'min')}</span></div>
        <div class="step-desc">${esc(s.description)}</div>
      </div>
    </div>`).join('');

  const section = (label: string, icon: string, color: string, body: string) =>
    `<div class="section">${sectionBand(label, icon, color, isAr)}${body}</div>`;

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)} • ${L(arCountPhrase(activity.totalDuration, 'دقيقة', 'دقيقتان', 'دقائق'), `${activity.totalDuration} min`)}</div>
    <div class="callout"><strong>${L('الهدف:', 'Objective:')}</strong> ${esc(activity.objective)}</div>
    <div class="doc-meta"><strong>${L('حجم المجموعة:', 'Group size:')}</strong> ${esc(activity.groupSize)}</div>
    ${section(L('المواد اللازمة', 'Materials Needed'), '🧰', '#6B7280', `<ul>${activity.materials.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`)}
    ${section(L('خطوات النشاط', 'Activity Steps'), '⚡', A, stepsHtml)}
    ${section(L('نصائح للمعلم', 'Teacher Tips'), '💡', '#F59E0B', `<ul>${activity.teacherTips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`)}
    ${section(L('التمايز', 'Differentiation'), '🔀', '#0891B2', `<div class="body-text">${esc(activity.differentiation)}</div>`)}
    ${section(L('التقييم', 'Assessment'), '✅', '#16A34A', `<div class="body-text">${esc(activity.assessment)}</div>`)}
    ${figuresSectionHTML(figures, isAr)}
  `;
  return htmlBase(content, isAr, title, 'activity');
}

// ─── Slides HTML (lesson plan) ────────────────────────────────────────────────

export function buildLessonPlanSlidesHTML(
  plan: LessonPlanOutput,
  title: string,
  meta: { subject: string; grade: string; duration?: number },
  isAr: boolean,
  /**
   * The lesson's book figures, appended as a final slide. Optional so
   * existing four-argument callers keep working; passing none renders
   * exactly what this builder rendered before.
   */
  figures: readonly BookFigureRef[] = [],
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#1B6B62';
  const bullets = (items: string[]) => items.map(i => `<li>${esc(i)}</li>`).join('');
  const L = (ar: string, en: string) => isAr ? ar : en;

  const footer = (num: number, total: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة اقرأ', 'Generated by Iqra')}</span>
      <span>${num} / ${total}</span>
    </div>`;

  const slideOpen = (extraClass = '') =>
    `<div class="slide${extraClass ? ' ' + extraClass : ''}">`;

  const header = (sub: string) =>
    `<div class="slide-header"><div class="header-accent"></div><div class="header-content">
      <div class="slide-eyebrow">${esc(sub)}</div>
      <div class="slide-topic">${esc(title)}</div>
    </div></div>`;

  const sectionBlock = (icon: string, label: string, content: string) =>
    `<div class="section-block">
      <div class="section-label"><span class="section-icon">${icon}</span>${label}</div>
      <div class="section-body">${content}</div>
    </div>`;

  const slide1 = `${slideOpen('title-slide')}
    <div class="title-content">
      <div class="title-badge">${L('خطة درس', 'Lesson Plan')}</div>
      <h1 class="title-main">${esc(title)}</h1>
      <div class="title-meta">${esc(meta.subject)} &nbsp;•&nbsp; ${esc(meta.grade)}${meta.duration ? ` &nbsp;•&nbsp; ${L(arCountPhrase(meta.duration, 'دقيقة', 'دقيقتان', 'دقائق'), `${meta.duration} min`)}` : ''}</div>
      <div class="title-brand">${L('اقرأ — مساعد التدريس الذكي', 'Iqra — AI Teaching Assistant')}</div>
    </div>`;

  // Optional: present only when the teacher asked for a warm-up review of
  // prior material. One block, not two-col — there is nothing to pair it with.
  const priorReviewSlide = plan.priorReview?.trim() ? `${slideOpen()}
    ${header(L('مراجعة سابقة', 'Prior Knowledge Review'))}
    <div class="slide-body">
      ${sectionBlock('🔄', L('مراجعة المعارف السابقة', 'Prior Knowledge Review'), `<p>${esc(plan.priorReview)}</p>`)}
    </div>` : null;

  const slide2 = `${slideOpen()}
    ${header(L('الأهداف والمواد', 'Objectives & Materials'))}
    <div class="slide-body two-col">
      ${sectionBlock('🎯', L('الأهداف التعليمية', 'Learning Objectives'), `<ul>${bullets(plan.objectives)}</ul>`)}
      ${sectionBlock('🎒', L('المواد اللازمة', 'Materials'), `<ul>${bullets(plan.materials)}</ul>`)}
    </div>`;

  const slide3 = `${slideOpen()}
    ${header(L('التمهيد والنشاط الرئيسي', 'Introduction & Main Activity'))}
    <div class="slide-body two-col">
      ${sectionBlock('▶', L('التمهيد', 'Introduction'), `<p>${esc(plan.introduction)}</p>`)}
      ${sectionBlock('👥', L('النشاط الرئيسي', 'Main Activity'), `<p>${esc(plan.mainActivity)}</p>`)}
    </div>`;

  const slide4 = `${slideOpen()}
    ${header(L('التدريب الموجّه والمستقل', 'Guided & Independent Practice'))}
    <div class="slide-body two-col">
      ${sectionBlock('✋', L('التدريب الموجّه', 'Guided Practice'), `<p>${esc(plan.guidedPractice)}</p>`)}
      ${sectionBlock('🧑', L('التدريب المستقل', 'Independent Practice'), `<p>${esc(plan.independentPractice)}</p>`)}
    </div>`;

  const slide5 = `${slideOpen()}
    ${header(L('الختام والتقييم', 'Closure & Assessment'))}
    <div class="slide-body two-col">
      ${sectionBlock('⏹', L('الختام', 'Closure'), `<p>${esc(plan.closure)}</p>`)}
      ${sectionBlock('✅', L('التقييم', 'Assessment'), `<p>${esc(plan.assessment)}</p>`)}
    </div>`;

  const slide6 = `${slideOpen()}
    ${header(L('التمايز والواجب المنزلي', 'Differentiation & Homework'))}
    <div class="slide-body two-col">
      ${sectionBlock('📚', L('التمايز', 'Differentiation'), `<p>${esc(plan.differentiation)}</p>`)}
      ${sectionBlock('🏠', L('الواجب المنزلي', 'Homework'), `<p>${esc(plan.homework)}</p>`)}
    </div>`;

  // Numbered after assembly so an optional slide never desyncs the footer
  // count from how many slides actually render.
  const figuresSlide = figures.length
    ? `${slideOpen()}
    ${header(L('من الكتاب المدرسي', 'From the Student Book'))}
    ${figureGridHTML(figures)}`
    : null;

  // Numbered after assembly so an optional slide never desyncs the footer
  // count from how many slides actually render.
  const slides = [
    slide1, priorReviewSlide, slide2, slide3, slide4, slide5, slide6, figuresSlide,
  ].filter((s): s is string => s !== null);
  const total = slides.length;
  const body = slides.map((s, i) => `${s}\n    ${footer(i + 1, total)}</div>`).join('\n');

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide {
  width: 297mm; height: 210mm; background: #fff; position: relative;
  overflow: hidden; page-break-after: always; display: flex; flex-direction: column;
}
/* Title slide */
.title-slide { background: linear-gradient(135deg, ${ACCENT} 0%, #144f49 100%); }
.title-content { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px; text-align: center; }
.title-badge { background: rgba(255,255,255,0.2); color:#fff; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:4px 16px; border-radius:20px; margin-bottom:20px; }
.title-main { font-size:36px; font-weight:700; color:#fff; line-height:1.3; margin-bottom:16px; max-width:500px; }
.title-meta { font-size:15px; color:rgba(255,255,255,0.8); margin-bottom:10px; }
.title-brand { font-size:11px; color:rgba(255,255,255,0.5); margin-top:8px; }
/* Header bar */
.slide-header { display:flex; align-items:stretch; height:64px; flex-shrink:0; }
.header-accent { width:8px; background:${ACCENT}; flex-shrink:0; }
.header-content { flex:1; background:#f8faf9; padding:10px 24px; display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid #e5e7eb; }
.slide-eyebrow { font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:${ACCENT}; font-weight:600; margin-bottom:3px; }
.slide-topic { font-size:14px; font-weight:700; color:#111827; }
/* Body */
.slide-body { flex:1; padding:20px 28px; overflow:hidden; }
.two-col { display:flex; gap:20px; }
.section-block { flex:1; }
.section-label { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:${ACCENT}; margin-bottom:8px; padding-bottom:5px; border-bottom:1.5px solid ${ACCENT}33; }
.section-icon { font-size:14px; }
.section-body { font-size:11.5px; color:#374151; line-height:1.7; }
.section-body ul { padding-${isAr ? 'right' : 'left'}:14px; }
.section-body li { margin-bottom:4px; }
.section-body p { margin:0; }
/* Footer */
.slide-footer { height:28px; border-top:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; padding:0 28px; flex-shrink:0; }
.slide-footer span { font-size:9px; color:#9ca3af; }
</style>
</head>
<body>
${body}
</body>
</html>`;
}

// ─── Slides HTML (activity) ───────────────────────────────────────────────────

export function buildActivitySlidesHTML(
  activity: ActivityOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  /**
   * The lesson's book figures, appended as a final slide. Optional so
   * existing four-argument callers keep working; passing none renders
   * exactly what this builder rendered before.
   */
  figures: readonly BookFigureRef[] = [],
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#E67E22';
  const L = (ar: string, en: string) => isAr ? ar : en;

  const TOTAL = 3 + Math.ceil(activity.steps.length / 2) + (figures.length ? 1 : 0);

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة اقرأ', 'Generated by Iqra')}</span>
      <span>${num} / ${TOTAL}</span>
    </div>`;

  const header = (sub: string) =>
    `<div class="slide-header"><div class="header-accent"></div><div class="header-content">
      <div class="slide-eyebrow">${esc(sub)}</div>
      <div class="slide-topic">${esc(title)}</div>
    </div></div>`;

  const sBlock = (icon: string, label: string, content: string) =>
    `<div class="section-block">
      <div class="section-label"><span class="section-icon">${icon}</span>${label}</div>
      <div class="section-body">${content}</div>
    </div>`;

  const slide1 = `<div class="slide title-slide">
    <div class="title-content">
      <div class="title-badge">${L('نشاط تعليمي', 'Classroom Activity')}</div>
      <h1 class="title-main">${esc(title)}</h1>
      <div class="title-meta">${esc(meta.subject)} &nbsp;•&nbsp; ${esc(meta.grade)} &nbsp;•&nbsp; ${L(arCountPhrase(activity.totalDuration, 'دقيقة', 'دقيقتان', 'دقائق'), `${activity.totalDuration} min`)}</div>
      <div class="title-obj">${esc(activity.objective)}</div>
    </div>
    ${footer(1)}</div>`;

  const slide2 = `<div class="slide">
    ${header(L('نظرة عامة', 'Overview'))}
    <div class="slide-body two-col">
      ${sBlock('🎯', L('الهدف', 'Objective'), `<p>${esc(activity.objective)}</p>`)}
      <div class="section-block">
        ${sBlock('👥', L('حجم المجموعة', 'Group Size'), `<p>${esc(activity.groupSize)}</p>`)}
        ${sBlock('🎒', L('المواد اللازمة', 'Materials'), `<ul>${activity.materials.map(m => `<li>${esc(m)}</li>`).join('')}</ul>`)}
      </div>
    </div>
    ${footer(2)}</div>`;

  // Pair up steps, two per slide
  const stepSlides = [];
  for (let i = 0; i < activity.steps.length; i += 2) {
    const pair = activity.steps.slice(i, i + 2);
    const slideNum = 3 + Math.floor(i / 2);
    const stepsHtml = pair.map(s => `
      <div class="step-card">
        <div class="step-head">
          <span class="step-num">${s.stepNumber}</span>
          <span class="step-title">${esc(s.title)}</span>
          <span class="step-dur">${s.durationMin} ${L('د', 'min')}</span>
        </div>
        <p class="step-desc">${esc(s.description)}</p>
      </div>`).join('');
    stepSlides.push(`<div class="slide">
      ${header(L('خطوات النشاط', 'Activity Steps'))}
      <div class="slide-body">${stepsHtml}</div>
      ${footer(slideNum)}</div>`);
  }

  const lastSlide = `<div class="slide">
    ${header(L('نصائح للمعلم والتقييم', 'Teacher Tips & Assessment'))}
    <div class="slide-body two-col">
      ${sBlock('💡', L('نصائح للمعلم', 'Teacher Tips'), `<ul>${activity.teacherTips.map(t => `<li>${esc(t)}</li>`).join('')}</ul>`)}
      <div class="section-block">
        ${sBlock('📊', L('التقييم', 'Assessment'), `<p>${esc(activity.assessment)}</p>`)}
        ${sBlock('🔀', L('التمايز', 'Differentiation'), `<p>${esc(activity.differentiation)}</p>`)}
      </div>
    </div>
    ${footer(TOTAL)}</div>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width:297mm; height:210mm; background:#fff; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
.title-slide { background:linear-gradient(135deg,${ACCENT} 0%,#b55a0f 100%); }
.title-content { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; }
.title-badge { background:rgba(255,255,255,0.2); color:#fff; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:4px 16px; border-radius:20px; margin-bottom:20px; }
.title-main { font-size:34px; font-weight:700; color:#fff; line-height:1.3; margin-bottom:14px; max-width:520px; }
.title-meta { font-size:14px; color:rgba(255,255,255,0.8); margin-bottom:10px; }
.title-obj { font-size:12px; color:rgba(255,255,255,0.7); max-width:480px; line-height:1.5; }
.slide-header { display:flex; align-items:stretch; height:60px; flex-shrink:0; }
.header-accent { width:8px; background:${ACCENT}; flex-shrink:0; }
.header-content { flex:1; background:#FFF7ED; padding:10px 24px; display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid #e5e7eb; }
.slide-eyebrow { font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:${ACCENT}; font-weight:600; margin-bottom:3px; }
.slide-topic { font-size:13px; font-weight:700; color:#111827; }
.slide-body { flex:1; padding:18px 26px; overflow:hidden; }
.two-col { display:flex; gap:20px; }
.section-block { flex:1; margin-bottom:12px; }
.section-label { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:${ACCENT}; margin-bottom:7px; padding-bottom:5px; border-bottom:1.5px solid ${ACCENT}33; }
.section-icon { font-size:13px; }
.section-body { font-size:11.5px; color:#374151; line-height:1.7; }
.section-body ul { padding-${isAr ? 'right' : 'left'}:14px; }
.section-body li { margin-bottom:4px; }
.section-body p { margin:0; }
.step-card { border:1px solid #e5e7eb; border-radius:8px; padding:12px 16px; margin-bottom:10px; }
.step-head { display:flex; align-items:center; gap:10px; margin-bottom:7px; }
.step-num { background:${ACCENT}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
.step-title { font-weight:600; font-size:12px; flex:1; color:#111827; }
.step-dur { font-size:10px; color:#9ca3af; }
.step-desc { font-size:11.5px; color:#374151; line-height:1.6; }
.slide-footer { height:26px; border-top:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; padding:0 26px; flex-shrink:0; }
.slide-footer span { font-size:9px; color:#9ca3af; }
</style>
</head>
<body>
${slide1}
${slide2}
${stepSlides.join('\n')}
${lastSlide}
${figuresSlideHTML(figures, isAr, header, footer(TOTAL))}
</body>
</html>`;
}

// ─── Slides HTML (worksheet) ─────────────────────────────────────────────────

export function buildWorksheetSlidesHTML(
  ws: WorksheetOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  /**
   * The lesson's book figures, appended as a final slide. Optional so
   * existing four-argument callers keep working; passing none renders
   * exactly what this builder rendered before.
   */
  figures: readonly BookFigureRef[] = [],
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#8B5CF6';
  // Text only in this builder — no attribute or URL goes through `e`, so it
  // is the isolating `esc` under a shorter name.
  const e = esc;
  const L = (ar: string, en: string) => isAr ? ar : en;

  // Total: title + (instructions if present: 1) + sections + answer key
  const hasInstructions = !!ws.instructions;
  const TOTAL = 1 + (hasInstructions ? 1 : 0) + ws.sections.length
    + (ws.answerKey && ws.answerKey.length > 0 ? 1 : 0) + (figures.length ? 1 : 0);

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة اقرأ', 'Generated by Iqra')}</span>
      <span>${num} / ${TOTAL}</span>
    </div>`;

  const header = (sub: string) =>
    `<div class="slide-header"><div class="header-accent"></div><div class="header-content">
      <div class="slide-eyebrow">${e(sub)}</div>
      <div class="slide-topic">${e(title)}</div>
    </div></div>`;

  const sBlock = (icon: string, label: string, content: string) =>
    `<div class="section-block">
      <div class="section-label"><span class="section-icon">${icon}</span>${label}</div>
      <div class="section-body">${content}</div>
    </div>`;

  let slideNum = 1;

  // Slide 1: Title
  const slide1 = `<div class="slide title-slide">
    <div class="title-content">
      <div class="title-badge">${L('ورقة عمل', 'Worksheet')}</div>
      <h1 class="title-main">${e(title)}</h1>
      <div class="title-meta">${e(meta.subject)} &nbsp;•&nbsp; ${e(meta.grade)}</div>
      <div class="title-brand">${L('اقرأ — مساعد التدريس الذكي', 'Iqra — AI Teaching Assistant')}</div>
    </div>
    ${footer(slideNum++)}</div>`;

  // Slide 2 (optional): Instructions
  const instrSlide = hasInstructions ? `<div class="slide">
    ${header(L('التعليمات', 'Instructions'))}
    <div class="slide-body">
      ${sBlock('📋', L('التعليمات', 'Instructions'), `<p>${e(ws.instructions!)}</p>`)}
    </div>
    ${footer(slideNum++)}</div>` : '';

  // One slide per section
  let qCounter = 1;
  const sectionSlides = ws.sections.map(sec => {
    const questionsHtml = sec.questions.map(q => {
      const opts = q.options
        ? `<div class="q-opts">${q.options.map((o, oi) => `<div class="q-opt">${e(labelOptionLine(o, oi, isAr))}</div>`).join('')}</div>`
        : '';
      const html = `<div class="q-card"><span class="q-num">${qCounter}.</span> <span class="q-text">${e(q.text)}</span>${opts}<span class="q-pts">${L(arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط'), `${q.points} pts`)}</span></div>`;
      qCounter++;
      return html;
    }).join('');

    const slide = `<div class="slide">
      ${header(e(sec.title))}
      <div class="slide-body">
        ${sBlock('📝', e(sec.title), questionsHtml)}
      </div>
      ${footer(slideNum++)}</div>`;
    return slide;
  });

  // Answer key slide
  const akSlide = ws.answerKey && ws.answerKey.length > 0 ? `<div class="slide">
    ${header(L('مفتاح الإجابات', 'Answer Key'))}
    <div class="slide-body">
      <div class="ak-grid">
        ${ws.answerKey.map(item => `<div class="ak-row"><span class="ak-num">${item.num}.</span><span class="ak-ans">${e(item.answer)}</span></div>`).join('')}
      </div>
    </div>
    ${footer(slideNum++)}</div>` : '';

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width:297mm; height:210mm; background:#fff; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
.title-slide { background:linear-gradient(135deg,${ACCENT} 0%,#5b21b6 100%); }
.title-content { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; }
.title-badge { background:rgba(255,255,255,0.2); color:#fff; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:4px 16px; border-radius:20px; margin-bottom:20px; }
.title-main { font-size:34px; font-weight:700; color:#fff; line-height:1.3; margin-bottom:14px; max-width:520px; }
.title-meta { font-size:14px; color:rgba(255,255,255,0.8); margin-bottom:10px; }
.title-brand { font-size:11px; color:rgba(255,255,255,0.5); margin-top:8px; }
.slide-header { display:flex; align-items:stretch; height:60px; flex-shrink:0; }
.header-accent { width:8px; background:${ACCENT}; flex-shrink:0; }
.header-content { flex:1; background:#faf5ff; padding:10px 24px; display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid #e5e7eb; }
.slide-eyebrow { font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:${ACCENT}; font-weight:600; margin-bottom:3px; }
.slide-topic { font-size:13px; font-weight:700; color:#111827; }
.slide-body { flex:1; padding:18px 26px; overflow:hidden; }
.section-block { margin-bottom:12px; }
.section-label { display:flex; align-items:center; gap:7px; font-size:12px; font-weight:700; color:${ACCENT}; margin-bottom:8px; padding-bottom:5px; border-bottom:1.5px solid ${ACCENT}33; }
.section-icon { font-size:13px; }
.section-body { font-size:11.5px; color:#374151; line-height:1.6; }
.q-card { display:flex; flex-wrap:wrap; gap:4px; align-items:baseline; border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; margin-bottom:7px; font-size:11.5px; }
.q-num { font-weight:700; color:${ACCENT}; flex-shrink:0; }
.q-text { flex:1; color:#111827; }
.q-opts { display:flex; gap:10px; flex-wrap:wrap; margin-top:4px; width:100%; padding-${isAr ? 'right' : 'left'}:12px; font-size:10.5px; color:#6b7280; }
.q-opt { white-space:nowrap; }
.q-pts { font-size:10px; color:#9ca3af; margin-${isAr ? 'right' : 'left'}:auto; }
.ak-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(160px,1fr)); gap:8px; }
.ak-row { display:flex; gap:6px; align-items:baseline; background:#faf5ff; border:1px solid ${ACCENT}22; border-radius:6px; padding:6px 10px; font-size:11.5px; }
.ak-num { font-weight:700; color:${ACCENT}; flex-shrink:0; }
.ak-ans { color:#374151; }
.slide-footer { height:26px; border-top:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; padding:0 26px; flex-shrink:0; }
.slide-footer span { font-size:9px; color:#9ca3af; }
</style>
</head>
<body>
${slide1}
${instrSlide}
${sectionSlides.join('\n')}
${akSlide}
${figuresSlideHTML(figures, isAr, header, footer(TOTAL))}
</body>
</html>`;
}

// ─── Slides HTML (quiz) ───────────────────────────────────────────────────────

export function buildQuizSlidesHTML(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  /**
   * The lesson's book figures, appended as a final slide. Optional so
   * existing four-argument callers keep working; passing none renders
   * exactly what this builder rendered before.
   */
  figures: readonly BookFigureRef[] = [],
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#F59E0B';
  // Text only in this builder — no attribute or URL goes through `e`, so it
  // is the isolating `esc` under a shorter name.
  const e = esc;
  const L = (ar: string, en: string) => isAr ? ar : en;
  const typeLabel = (t: string) =>
    t === 'multiple_choice' ? L('اختيار متعدد', 'MCQ')
      : t === 'true_false' ? L('صح/خطأ', 'T/F')
        : L('إجابة قصيرة', 'Short');

  const GROUP_SIZE = 3;
  const questionGroups: typeof quiz.questions[] = [];
  for (let i = 0; i < quiz.questions.length; i += GROUP_SIZE) {
    questionGroups.push(quiz.questions.slice(i, i + GROUP_SIZE));
  }

  // title + groups + answer key + the optional book-figures slide
  const TOTAL = 1 + questionGroups.length + 1 + (figures.length ? 1 : 0);
  let slideNum = 1;

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة اقرأ', 'Generated by Iqra')}</span>
      <span>${num} / ${TOTAL}</span>
    </div>`;

  const header = (sub: string) =>
    `<div class="slide-header"><div class="header-accent"></div><div class="header-content">
      <div class="slide-eyebrow">${e(sub)}</div>
      <div class="slide-topic">${e(title)}</div>
    </div></div>`;

  // Slide 1: Title
  const slide1 = `<div class="slide title-slide">
    <div class="title-content">
      <div class="title-badge">${L('اختبار', 'Quiz')}</div>
      <h1 class="title-main">${e(title)}</h1>
      <div class="title-meta">${e(meta.subject)} &nbsp;•&nbsp; ${e(meta.grade)}</div>
      <div class="title-meta">${L(arCountPhrase(quiz.duration, 'دقيقة', 'دقيقتان', 'دقائق'), `${quiz.duration} min`)} &nbsp;•&nbsp; ${L(arCountPhrase(quiz.totalPoints, 'نقطة', 'نقطتان', 'نقاط'), `${quiz.totalPoints} pts`)}</div>
      <div class="title-brand">${L('اقرأ — مساعد التدريس الذكي', 'Iqra — AI Teaching Assistant')}</div>
    </div>
    ${footer(slideNum++)}</div>`;

  // Question group slides
  const qSlides = questionGroups.map((group, gi) => {
    const startIdx = gi * GROUP_SIZE;
    const questionsHtml = group.map((q, qi) => {
      const idx = startIdx + qi + 1;
      const opts = q.options
        ? `<div class="q-opts">${q.options.map((o, oi) => `<div class="q-opt">${e(labelOptionLine(o, oi, isAr))}</div>`).join('')}</div>`
        : '';
      return `<div class="q-card">
        <div class="q-top">
          <span class="q-num">${idx}</span>
          <span class="type-badge">${typeLabel(q.type)}</span>
          <span class="q-pts">${L(arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط'), `${q.points} pts`)}</span>
        </div>
        <div class="q-text">${e(q.text)}</div>
        ${opts}
      </div>`;
    }).join('');

    return `<div class="slide">
      ${header(L(`الأسئلة ${startIdx + 1}–${startIdx + group.length}`, `Questions ${startIdx + 1}–${startIdx + group.length}`))}
      <div class="slide-body">${questionsHtml}</div>
      ${footer(slideNum++)}</div>`;
  });

  // Answer key slide
  const akSlide = `<div class="slide">
    ${header(L('مفتاح الإجابات', 'Answer Key'))}
    <div class="slide-body">
      <div class="ak-grid">
        ${quiz.questions.map((q, i) => `<div class="ak-row"><span class="ak-num">${i + 1}.</span><span class="ak-ans">${e(q.correctAnswer)}</span></div>`).join('')}
      </div>
    </div>
    ${footer(slideNum++)}</div>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.slide { width:297mm; height:210mm; background:#fff; position:relative; overflow:hidden; page-break-after:always; display:flex; flex-direction:column; }
.title-slide { background:linear-gradient(135deg,${ACCENT} 0%,#b45309 100%); }
.title-content { flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px; text-align:center; }
.title-badge { background:rgba(255,255,255,0.2); color:#fff; font-size:11px; letter-spacing:2px; text-transform:uppercase; padding:4px 16px; border-radius:20px; margin-bottom:20px; }
.title-main { font-size:34px; font-weight:700; color:#fff; line-height:1.3; margin-bottom:14px; max-width:520px; }
.title-meta { font-size:14px; color:rgba(255,255,255,0.8); margin-bottom:6px; }
.title-brand { font-size:11px; color:rgba(255,255,255,0.5); margin-top:8px; }
.slide-header { display:flex; align-items:stretch; height:60px; flex-shrink:0; }
.header-accent { width:8px; background:${ACCENT}; flex-shrink:0; }
.header-content { flex:1; background:#fffbeb; padding:10px 24px; display:flex; flex-direction:column; justify-content:center; border-bottom:1px solid #e5e7eb; }
.slide-eyebrow { font-size:10px; letter-spacing:1.5px; text-transform:uppercase; color:${ACCENT}; font-weight:600; margin-bottom:3px; }
.slide-topic { font-size:13px; font-weight:700; color:#111827; }
.slide-body { flex:1; padding:16px 26px; overflow:hidden; display:flex; flex-direction:column; gap:8px; }
.q-card { border:1px solid #e5e7eb; border-radius:8px; padding:10px 14px; flex-shrink:0; }
.q-top { display:flex; align-items:center; gap:8px; margin-bottom:6px; }
.q-num { background:${ACCENT}; color:#fff; width:22px; height:22px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700; flex-shrink:0; }
.type-badge { font-size:10px; background:#fef3c7; color:#92400e; padding:2px 8px; border-radius:10px; }
.q-pts { font-size:10px; color:#9ca3af; margin-${isAr ? 'right' : 'left'}:auto; }
.q-text { font-size:12px; color:#111827; line-height:1.5; }
.q-opts { display:grid; grid-template-columns:1fr 1fr; gap:4px; margin-top:6px; padding-${isAr ? 'right' : 'left'}:12px; font-size:10.5px; color:#6b7280; }
.q-opt { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.ak-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; }
.ak-row { display:flex; gap:6px; align-items:baseline; background:#fffbeb; border:1px solid ${ACCENT}33; border-radius:6px; padding:6px 10px; font-size:11.5px; }
.ak-num { font-weight:700; color:${ACCENT}; flex-shrink:0; }
.ak-ans { color:#374151; }
.slide-footer { height:26px; border-top:1px solid #f3f4f6; display:flex; align-items:center; justify-content:space-between; padding:0 26px; flex-shrink:0; }
.slide-footer span { font-size:9px; color:#9ca3af; }
</style>
</head>
<body>
${slide1}
${qSlides.join('\n')}
${akSlide}
${figuresSlideHTML(figures, isAr, header, footer(TOTAL))}
</body>
</html>`;
}

// ─── Lesson Flow HTML (all-in-one PDF) ───────────────────────────────────────

export function buildLessonFlowHTML(
  flow: LessonFlowOutput,
  isAr: boolean,
  /**
   * The lesson's book figures. Optional so the existing two-argument callers
   * keep working; passing none prints no appendix, exactly as before.
   *
   * The flow PDF is the one document that bundles a worksheet and an exit
   * ticket into a single hand-out, so it was the odd one out among the five:
   * printing the same worksheet on its own carried «من الكتاب المدرسي» and
   * printing it inside the flow did not.
   */
  figures: readonly BookFigureRef[] = [],
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const font = isAr ? `'Amiri', 'Noto Naskh Arabic', serif` : `'Inter', 'Helvetica Neue', sans-serif`;
  const TEAL = '#00A99D';
  const NAVY = '#081B3A';

  const meta = `${flow.grade} · ${flow.subject} · ${isAr ? arCountPhrase(flow.duration, 'دقيقة', 'دقيقتان', 'دقائق') : `${flow.duration} min`}`;

  /* ── Helpers ── */
  const secHeader = (label: string, icon: string, color: string) =>
    `<div class="sec-header" style="background:${color}15;border-left:4px solid ${color};${isAr ? 'border-left:none;border-right:4px solid ' + color : ''}">
       <span class="sec-icon">${icon}</span>
       <span class="sec-label" style="color:${color}">${label}</span>
     </div>`;

  const bulletList = (items: string[]) =>
    `<ul class="bullets">${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>`;

  const stepCard = (step: { title: string; description: string }, idx: number) =>
    `<div class="step-card">
       <div class="step-num" style="background:${TEAL}">${idx + 1}</div>
       <div class="step-body">
         <div class="step-title">${esc(step.title)}</div>
         <div class="step-desc">${esc(step.description)}</div>
       </div>
     </div>`;

  const questionBlock = (q: { text: string; options?: string[]; correctAnswer?: string; points: number }, idx: number) =>
    `<div class="q-block">
       <div class="q-top"><span class="q-num">${idx + 1}</span><span class="q-pts">${isAr ? arCountPhrase(q.points, 'نقطة', 'نقطتان', 'نقاط') : `${q.points} pts`}</span></div>
       <div class="q-text">${esc(q.text)}</div>
       ${q.options ? `<div class="q-opts">${q.options.map(o => `<span class="q-opt">○ ${esc(o)}</span>`).join('')}</div>` : ''}
     </div>`;

  /* ── Activity section body ── */
  const activityBody = (act: ActivityOutput) =>
    `${act.steps.map((s, i) => stepCard(s, i)).join('')}`;

  /* ── Worksheet questions ── */
  const wsBody = flow.worksheet.sections.flatMap(s =>
    s.questions.map((q, i) => questionBlock(q, i))
  ).join('');

  /* ── Exit ticket questions ── */
  const etBody = flow.exitTicket.questions.map((q, i) => questionBlock(q, i)).join('');

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Amiri:wght@400;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: ${font}; font-size: 13px; color: #1f2937; background: #fff; direction: ${dir}; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .page { padding: 28px 32px; max-width: 800px; margin: 0 auto; }
  /* Cover */
  .cover { text-align: center; padding: 40px 0 32px; border-bottom: 2px solid ${NAVY}; margin-bottom: 28px; }
  .cover-icon { font-size: 40px; }
  .cover-title { font-size: 22px; font-weight: 700; color: ${NAVY}; margin-top: 10px; }
  .cover-topic { font-size: 16px; color: ${TEAL}; font-weight: 600; margin-top: 6px; }
  .cover-meta { font-size: 12px; color: #6b7280; margin-top: 8px; }
  /* Section headers */
  .sec-header { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 6px; margin: 22px 0 12px; }
  .sec-icon { font-size: 16px; }
  .sec-label { font-size: 14px; font-weight: 700; }
  /* Objectives */
  .bullets { padding-${isAr ? 'right' : 'left'}: 18px; display: flex; flex-direction: column; gap: 5px; }
  .bullets li { font-size: 12.5px; color: #374151; line-height: 1.5; }
  /* Step cards */
  .step-card { display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; }
  .step-num { min-width: 24px; height: 24px; border-radius: 50%; color: #fff; font-size: 11px; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .step-body { flex: 1; }
  .step-title { font-size: 12.5px; font-weight: 600; color: #111827; margin-bottom: 3px; }
  .step-desc { font-size: 11.5px; color: #6b7280; line-height: 1.5; }
  /* Guided practice */
  .guided-text { font-size: 12.5px; color: #374151; line-height: 1.7; background: #f0fdf9; border-radius: 8px; padding: 14px; border: 1px solid ${TEAL}30; }
  /* Questions */
  .q-block { padding: 10px 12px; background: #f9fafb; border-radius: 8px; margin-bottom: 8px; }
  .q-top { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
  .q-num { background: ${NAVY}; color: #fff; width: 22px; height: 22px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700; flex-shrink: 0; }
  .q-pts { font-size: 10px; color: #9ca3af; margin-${isAr ? 'right' : 'left'}: auto; }
  .q-text { font-size: 12px; color: #111827; line-height: 1.5; }
  .q-opts { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; margin-top: 6px; padding-${isAr ? 'right' : 'left'}: 12px; font-size: 10.5px; color: #6b7280; }
  .q-opt { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  /* Page break between sections */
  .page-break { page-break-before: always; padding-top: 24px; }
  /* Footer */
  .footer { text-align: center; padding: 20px 0 8px; border-top: 1px solid #e5e7eb; margin-top: 24px; font-size: 10px; color: #9ca3af; }
</style>
</head>
<body>
<div class="page">

  <!-- Cover -->
  <div class="cover">
    <div class="cover-icon">🎯</div>
    <div class="cover-title">${isAr ? 'مسار الدرس الكامل' : 'Complete Lesson Flow'}</div>
    <div class="cover-topic">${esc(flow.topic)}</div>
    <div class="cover-meta">${esc(meta)}</div>
  </div>

  <!-- 1. Objectives -->
  ${secHeader(isAr ? 'الأهداف التعليمية' : 'Learning Objectives', '🎯', NAVY)}
  ${bulletList(flow.objectives)}

  <!-- 2. Warm-up -->
  ${secHeader(isAr ? 'النشاط التمهيدي' : 'Warm-up Activity', '🔥', '#E67E22')}
  <div style="font-weight:600;font-size:12.5px;color:#1f2937;margin-bottom:6px">${esc(flow.warmup.title)}</div>
  ${activityBody(flow.warmup)}

  <!-- 3. Interactive Activity -->
  <div class="page-break">
  ${secHeader(isAr ? 'النشاط التفاعلي' : 'Interactive Activity', '⚡', '#4F46E5')}
  <div style="font-weight:600;font-size:12.5px;color:#1f2937;margin-bottom:6px">${esc(flow.activity.title)}</div>
  ${activityBody(flow.activity)}
  </div>

  <!-- 4. Guided Practice -->
  ${secHeader(isAr ? 'التدريب الموجّه' : 'Guided Practice', '✏️', TEAL)}
  <div class="guided-text">${esc(flow.guidedPractice)}</div>

  <!-- 5. Worksheet -->
  <div class="page-break">
  ${secHeader(isAr ? 'ورقة العمل' : 'Student Worksheet', '📄', '#8B5CF6')}
  ${wsBody}
  </div>

  <!-- 6. Exit Ticket -->
  ${secHeader(isAr ? 'بطاقة الخروج' : 'Exit Ticket', '🎫', '#F59E0B')}
  ${etBody}

  ${figuresSectionHTML(figures, isAr)}

  <div class="footer">${isAr ? 'اقرأ — مساعد التدريس الذكي' : 'IQRA Teaching Assistant'} · ${esc(flow.topic)} · ${new Date().toLocaleDateString(isAr ? 'ar-JO' : 'en-GB')}</div>
</div>
</body>
</html>`;
}

/**
 * «تبسيط الشرح» as a printable handout.
 *
 * Deliberately NOT routed through `buildLessonPlanSlidesHTML` or given a
 * «خطة درس» badge: this used to be a lesson plan behind a flag, and a student
 * handout carrying the lesson-plan label is the exact mislabelling the tool
 * was rebuilt to remove.
 */
export function buildSimplifiedExplanationHTML(
  out: SimplifiedExplanationOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
  figures: readonly BookFigureRef[] = [],
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  const accent = DOC_ACCENT.explainer;
  const band = (label: string, glyph: string) => sectionBand(label, glyph, accent, isAr);
  const numbered = (items: readonly string[]) =>
    items.map((s, i) =>
      `<div class="q-card"><div class="q-head"><span class="q-num">${i + 1}</span>`
      + `<span class="q-text">${esc(s)}</span></div></div>`,
    ).join('');

  const keyWords = out.keyWords?.length
    ? `<div class="section">${band(L('كلمات مفتاحية', 'Key Words'), '📖')}`
      + out.keyWords.map(w =>
          `<div class="q-card"><div class="q-text"><strong>${esc(w.term)}</strong> — ${esc(w.meaning)}</div></div>`,
        ).join('')
      + `</div>`
    : '';

  const answered = out.checks
    .map((c, i) => ({ n: i + 1, answer: (c.answer ?? '').trim() }))
    .filter(a => a.answer.length > 0);
  // An omitted answer prints nothing here. A guess under a heading that looks
  // official is worse than a blank the student has to think about.
  const answers = answered.length
    ? `<div class="answer-key"><div class="section-title">${L('الإجابات', 'Answers')}</div>`
      + answered.map(a =>
          `<div class="answer-row"><span class="answer-num">${a.n}.</span><span>${esc(a.answer)}</span></div>`,
        ).join('')
      + `</div>`
    : '';

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)}</div>
    <div class="callout">${esc(out.bigIdea)}</div>
    <div class="section">${band(L('الشرح خطوة بخطوة', 'Step by Step'), '🪜')}${numbered(out.explanation)}</div>
    ${keyWords}
    <div class="section">${band(L('مثال محلول', 'Worked Example'), '✏️')}
      <div class="q-card"><div class="q-text">${esc(out.workedExample.text)}</div></div>
      ${numbered(out.workedExample.steps)}
      <div class="q-card"><div class="q-text"><strong>${L('الإجابة:', 'Answer:')}</strong> ${esc(out.workedExample.answer)}</div></div>
    </div>
    <div class="section">${band(L('خطأ شائع', 'A Common Mistake'), '⚠️')}
      <div class="q-card"><div class="q-text">${esc(out.misconception.claim)}</div></div>
      <div class="q-card"><div class="q-text">${esc(out.misconception.correction)}</div></div>
    </div>
    <div class="section">${band(L('تحقّق من فهمك', 'Check Your Understanding'), '🧠')}
      ${out.checks.map((c, i) =>
        `<div class="q-card"><div class="q-head"><span class="q-num">${i + 1}</span>`
        + `<span class="q-text">${esc(c.text)}</span></div>`
        + `<div class="q-lines">${ANSWER_RULES.map(() => '<div class="q-rule"></div>').join('')}</div></div>`,
      ).join('')}
    </div>
    ${answers}
    ${figuresSectionHTML(figures, isAr)}
  `;
  return htmlBase(content, isAr, title, 'explainer');
}
