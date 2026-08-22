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
import type {
  ActivityOutput,
  LessonFlowOutput,
  LessonPlanOutput,
  QuizOutput,
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
function htmlBase(content: string, isRTL: boolean, title: string): string {
  const dir = isRTL ? 'rtl' : 'ltr';
  const align = isRTL ? 'right' : 'left';
  return `<!DOCTYPE html>
<html lang="${isRTL ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(title)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: ${isRTL ? "'Amiri', 'Noto Naskh Arabic', 'Arabic UI Text', Arial" : "'Inter', 'Helvetica Neue', Arial"}, sans-serif;
      font-size: 14px; line-height: 1.7; color: #1a1a1a;
      padding: 40px; direction: ${dir}; text-align: ${align};
      background: #fff;
    }
    .school-header {
      border-bottom: 2px solid #1B6B62; padding-bottom: 16px; margin-bottom: 24px;
      display: flex; justify-content: space-between; align-items: flex-start;
      flex-direction: row;
    }
    .school-name { font-size: 13px; color: #666; }
    .school-placeholder { font-weight: bold; color: #1B6B62; font-size: 15px; }
    .doc-title { font-size: 22px; font-weight: 700; color: #111; margin-bottom: 6px; }
    .doc-meta { font-size: 12px; color: #666; margin-bottom: 24px; }
    .section { margin-bottom: 20px; }
    .section-title {
      font-size: 13px; font-weight: 700; color: #1B6B62;
      text-transform: uppercase; letter-spacing: 0.5px;
      border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; margin-bottom: 8px;
    }
    .body-text { font-size: 13px; line-height: 1.8; color: #333; }
    ul { padding-${isRTL ? 'right' : 'left'}: 20px; }
    li { margin-bottom: 4px; font-size: 13px; color: #333; }
    .answer-key { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; padding: 14px; margin-top: 24px; }
    .answer-key .section-title { color: #15803d; border-color: #bbf7d0; }
    .answer-row { display: flex; flex-direction: row; gap: 8px; margin-bottom: 4px; font-size: 12px; }
    .answer-num { font-weight: 600; color: #15803d; min-width: 24px; }
    .q-card { border: 1px solid #e5e7eb; border-radius: 6px; padding: 12px; margin-bottom: 8px; }
    .q-num { font-weight: 700; color: #1B6B62; }
    .q-option { display: flex; flex-direction: row; gap: 8px; align-items: flex-start; margin-top: 4px; font-size: 12px; color: #555; }
    .q-pts { font-size: 11px; color: #999; margin-top: 4px; }
    .footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #aaa; text-align: center; }
  </style>
</head>
<body>
  <div class="school-header">
    <div>
      <div class="school-placeholder">${isRTL ? 'إقرأ — مساعد التدريس الذكي' : 'Iqra — AI Teaching Assistant'}</div>
      <div class="school-name">${isRTL ? 'اسم المدرسة' : 'School Name'}</div>
    </div>
    <div class="school-name">${new Date().toLocaleDateString(isRTL ? 'ar-JO' : 'en-GB')}</div>
  </div>
  ${content}
  <div class="footer">${isRTL ? 'أُنشئ بواسطة إقرأ — مساعد التدريس الذكي' : 'Generated by Iqra — AI Teaching Assistant'}</div>
</body>
</html>`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * One `.q-option` row. Shared by the worksheet and quiz builders, which had
 * byte-identical copies of this line — the kind of duplication that lets one
 * export get fixed and the other keep printing A/B/C/D.
 */
function optionRowHTML(text: string, index: number, isAr: boolean): string {
  const { letter, text: body } = labelOption(text, index, isAr);
  return `<div class="q-option"><span>${esc(letter)}</span> <span>${esc(body)}</span></div>`;
}

export function buildLessonPlanHTML(
  plan: LessonPlanOutput,
  title: string,
  meta: { subject: string; grade: string; duration?: number },
  isAr: boolean,
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  const section = (label: string, body: string) =>
    `<div class="section"><div class="section-title">${esc(label)}</div><div class="body-text">${esc(body)}</div></div>`;

  const bullets = (label: string, items: string[]) =>
    `<div class="section"><div class="section-title">${esc(label)}</div><ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul></div>`;

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)}${meta.duration ? ` • ${meta.duration} ${L('دقيقة', 'min')}` : ''}</div>
    ${bullets(L('الأهداف', 'Objectives'), plan.objectives)}
    ${bullets(L('المواد اللازمة', 'Materials Needed'), plan.materials)}
    ${section(L('التمهيد', 'Introduction'), plan.introduction)}
    ${section(L('النشاط الرئيسي', 'Main Activity'), plan.mainActivity)}
    ${section(L('التدريب الموجّه', 'Guided Practice'), plan.guidedPractice)}
    ${section(L('التدريب المستقل', 'Independent Practice'), plan.independentPractice)}
    ${section(L('الختام', 'Closure'), plan.closure)}
    ${section(L('التقييم', 'Assessment'), plan.assessment)}
    ${section(L('التمايز', 'Differentiation'), plan.differentiation)}
    ${section(L('الواجب المنزلي', 'Homework'), plan.homework)}
  `;
  return htmlBase(content, isAr, title);
}

export function buildWorksheetHTML(
  ws: WorksheetOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
): string {
  const L = (ar: string, en: string) => isAr ? ar : en;
  let qNum = 1;
  const sections = ws.sections.map(sec => {
    const questions = sec.questions.map(q => {
      const options = q.options
        ? q.options.map((o, oi) => optionRowHTML(o, oi, isAr)).join('')
        : '';
      const html = `<div class="q-card"><span class="q-num">${qNum}.</span> ${esc(q.text)}${options}<div class="q-pts">${q.points} ${L('نقطة', 'pts')}</div></div>`;
      qNum++;
      return html;
    }).join('');
    return `<div class="section"><div class="section-title">${esc(sec.title)}</div>${questions}</div>`;
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
    ${ws.instructions ? `<div class="body-text" style="margin-bottom:16px;color:#555;font-style:italic">${esc(ws.instructions)}</div>` : ''}
    ${sections}
    ${answerKey}
  `;
  return htmlBase(content, isAr, title);
}

export function buildQuizHTML(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
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
    return `<div class="q-card">
      <span class="q-num">${i + 1}.</span>
      <span style="font-size:11px;background:#fef3c7;color:#92400e;padding:2px 7px;border-radius:9px;margin-${isAr ? 'right' : 'left'}:6px">${typeLabel(q.type)}</span>
      ${esc(q.text)}
      ${options}
      <div class="q-pts">${q.points} ${L('نقطة', 'pts')}</div>
    </div>`;
  }).join('');

  const akRows = quiz.questions.map((q, i) =>
    `<div class="answer-row"><span class="answer-num">${i + 1}.</span><span>${esc(labelAnswer(q.options, q.correctAnswer, isAr))}</span></div>`
  ).join('');

  const content = `
    <div class="doc-title">${esc(title)}</div>
    <div class="doc-meta">${esc(meta.subject)} • ${esc(meta.grade)} • ${quiz.duration} ${L('دقيقة', 'min')} • ${quiz.totalPoints} ${L('نقطة', 'pts')}</div>
    ${questions}
    <div class="answer-key"><div class="section-title">${L('مفتاح الإجابات', 'Answer Key')}</div>${akRows}</div>
  `;
  return htmlBase(content, isAr, title);
}
export function buildActivityHTML(
  activity: ActivityOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const align = isAr ? 'right' : 'left';
  const ACCENT = '#E67E22';
  const L = (ar: string, en: string) => isAr ? ar : en;
  const e = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const stepsHtml = activity.steps.map(s => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:14px;margin-bottom:10px;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;flex-direction:row">
        <span style="background:${ACCENT};color:#fff;width:24px;height:24px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0">${s.stepNumber}</span>
        <span style="font-weight:600;font-size:13px;flex:1;text-align:${align}">${e(s.title)}</span>
        <span style="font-size:11px;color:#9ca3af">${s.durationMin} ${L('د', 'min')}</span>
      </div>
      <p style="font-size:12px;color:#374151;line-height:1.6;margin:0;text-align:${align}">${e(s.description)}</p>
    </div>`).join('');

  const section = (label: string, body: string) => `
    <div style="margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;color:${ACCENT};text-transform:uppercase;letter-spacing:0.5px;border-bottom:1px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px;text-align:${align}">${label}</div>
      ${body}
    </div>`;

  return `<!DOCTYPE html>
<html lang="${isAr ? 'ar' : 'en'}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${e(title)}</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:${isAr ? "'Amiri','Arial'" : "'Inter','Helvetica Neue',Arial"},sans-serif;font-size:14px;line-height:1.7;color:#1a1a1a;padding:40px;direction:${dir};text-align:${align};background:#fff}
    ul{padding-${isAr ? 'right' : 'left'}:20px}li{margin-bottom:4px;font-size:13px;color:#333}
    .footer{margin-top:32px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:11px;color:#aaa;text-align:center}
  </style>
</head>
<body>
  <div style="border-bottom:2px solid ${ACCENT};padding-bottom:16px;margin-bottom:24px;display:flex;justify-content:space-between;flex-direction:row">
    <div>
      <div style="font-weight:bold;color:${ACCENT};font-size:15px">${L('إقرأ — مساعد التدريس الذكي', 'Iqra — AI Teaching Assistant')}</div>
      <div style="font-size:13px;color:#666">${L('اسم المدرسة', 'School Name')}</div>
    </div>
    <div style="font-size:13px;color:#666">${new Date().toLocaleDateString(isAr ? 'ar-JO' : 'en-GB')}</div>
  </div>
  <div style="font-size:22px;font-weight:700;color:#111;margin-bottom:6px">${e(title)}</div>
  <div style="font-size:12px;color:#666;margin-bottom:16px">${e(meta.subject)} • ${e(meta.grade)} • ${activity.totalDuration} ${L('دقيقة', 'min')}</div>
  <div style="background:#FFF7ED;border-${isAr ? 'right' : 'left'}:4px solid ${ACCENT};padding:12px 16px;margin:0 0 18px;border-radius:6px;font-size:13px">
    <strong>${L('الهدف:', 'Objective:')}</strong> ${e(activity.objective)}
  </div>
  <div style="font-size:12px;color:#6b7280;margin-bottom:18px">
    <strong>${L('حجم المجموعة:', 'Group size:')}</strong> ${e(activity.groupSize)}
  </div>
  ${section(L('المواد اللازمة', 'Materials Needed'), `<ul>${activity.materials.map(m => `<li>${e(m)}</li>`).join('')}</ul>`)}
  ${section(L('خطوات النشاط', 'Activity Steps'), stepsHtml)}
  ${section(L('نصائح للمعلم', 'Teacher Tips'), `<ul>${activity.teacherTips.map(t => `<li>${e(t)}</li>`).join('')}</ul>`)}
  ${section(L('التمايز', 'Differentiation'), `<p style="font-size:13px;color:#374151;line-height:1.8">${e(activity.differentiation)}</p>`)}
  ${section(L('التقييم', 'Assessment'), `<p style="font-size:13px;color:#374151;line-height:1.8">${e(activity.assessment)}</p>`)}
  <div class="footer">${L('أُنشئ بواسطة إقرأ — مساعد التدريس الذكي', 'Generated by Iqra — AI Teaching Assistant')}</div>
</body>
</html>`;
}

// ─── Slides HTML (lesson plan) ────────────────────────────────────────────────

export function buildLessonPlanSlidesHTML(
  plan: LessonPlanOutput,
  title: string,
  meta: { subject: string; grade: string; duration?: number },
  isAr: boolean,
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#1B6B62';
  const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const bullets = (items: string[]) => items.map(i => `<li>${esc(i)}</li>`).join('');
  const L = (ar: string, en: string) => isAr ? ar : en;

  const footer = (num: number, total: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة إقرأ', 'Generated by Iqra')}</span>
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

  const TOTAL = 6;

  const slide1 = `${slideOpen('title-slide')}
    <div class="title-content">
      <div class="title-badge">${L('خطة درس', 'Lesson Plan')}</div>
      <h1 class="title-main">${esc(title)}</h1>
      <div class="title-meta">${esc(meta.subject)} &nbsp;•&nbsp; ${esc(meta.grade)}${meta.duration ? ` &nbsp;•&nbsp; ${meta.duration} ${L('دقيقة', 'min')}` : ''}</div>
      <div class="title-brand">Iqra — ${L('مساعد التدريس الذكي', 'AI Teaching Assistant')}</div>
    </div>
    ${footer(1, TOTAL)}</div>`;

  const slide2 = `${slideOpen()}
    ${header(L('الأهداف والمواد', 'Objectives & Materials'))}
    <div class="slide-body two-col">
      ${sectionBlock('🎯', L('الأهداف التعليمية', 'Learning Objectives'), `<ul>${bullets(plan.objectives)}</ul>`)}
      ${sectionBlock('🎒', L('المواد اللازمة', 'Materials'), `<ul>${bullets(plan.materials)}</ul>`)}
    </div>
    ${footer(2, TOTAL)}</div>`;

  const slide3 = `${slideOpen()}
    ${header(L('التمهيد والنشاط الرئيسي', 'Introduction & Main Activity'))}
    <div class="slide-body two-col">
      ${sectionBlock('▶', L('التمهيد', 'Introduction'), `<p>${esc(plan.introduction)}</p>`)}
      ${sectionBlock('👥', L('النشاط الرئيسي', 'Main Activity'), `<p>${esc(plan.mainActivity)}</p>`)}
    </div>
    ${footer(3, TOTAL)}</div>`;

  const slide4 = `${slideOpen()}
    ${header(L('التدريب الموجّه والمستقل', 'Guided & Independent Practice'))}
    <div class="slide-body two-col">
      ${sectionBlock('✋', L('التدريب الموجّه', 'Guided Practice'), `<p>${esc(plan.guidedPractice)}</p>`)}
      ${sectionBlock('🧑', L('التدريب المستقل', 'Independent Practice'), `<p>${esc(plan.independentPractice)}</p>`)}
    </div>
    ${footer(4, TOTAL)}</div>`;

  const slide5 = `${slideOpen()}
    ${header(L('الختام والتقييم', 'Closure & Assessment'))}
    <div class="slide-body two-col">
      ${sectionBlock('⏹', L('الختام', 'Closure'), `<p>${esc(plan.closure)}</p>`)}
      ${sectionBlock('✅', L('التقييم', 'Assessment'), `<p>${esc(plan.assessment)}</p>`)}
    </div>
    ${footer(5, TOTAL)}</div>`;

  const slide6 = `${slideOpen()}
    ${header(L('التمايز والواجب المنزلي', 'Differentiation & Homework'))}
    <div class="slide-body two-col">
      ${sectionBlock('📚', L('التمايز', 'Differentiation'), `<p>${esc(plan.differentiation)}</p>`)}
      ${sectionBlock('🏠', L('الواجب المنزلي', 'Homework'), `<p>${esc(plan.homework)}</p>`)}
    </div>
    ${footer(6, TOTAL)}</div>`;

  return `<!DOCTYPE html>
<html dir="${dir}" lang="${isAr ? 'ar' : 'en'}">
<head>
<meta charset="utf-8"/>
<style>
@page { size: A4 landscape; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; }
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
${slide1}
${slide2}
${slide3}
${slide4}
${slide5}
${slide6}
</body>
</html>`;
}

// ─── Slides HTML (activity) ───────────────────────────────────────────────────

export function buildActivitySlidesHTML(
  activity: ActivityOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#E67E22';
  const esc = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const L = (ar: string, en: string) => isAr ? ar : en;

  const TOTAL = 3 + Math.ceil(activity.steps.length / 2);

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة إقرأ', 'Generated by Iqra')}</span>
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
      <div class="title-meta">${esc(meta.subject)} &nbsp;•&nbsp; ${esc(meta.grade)} &nbsp;•&nbsp; ${activity.totalDuration} ${L('دقيقة', 'min')}</div>
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
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; }
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
</body>
</html>`;
}

// ─── Slides HTML (worksheet) ─────────────────────────────────────────────────

export function buildWorksheetSlidesHTML(
  ws: WorksheetOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#8B5CF6';
  const e = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const L = (ar: string, en: string) => isAr ? ar : en;

  // Total: title + (instructions if present: 1) + sections + answer key
  const hasInstructions = !!ws.instructions;
  const TOTAL = 1 + (hasInstructions ? 1 : 0) + ws.sections.length + (ws.answerKey && ws.answerKey.length > 0 ? 1 : 0);

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة إقرأ', 'Generated by Iqra')}</span>
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
      <div class="title-brand">Iqra — ${L('مساعد التدريس الذكي', 'AI Teaching Assistant')}</div>
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
      const html = `<div class="q-card"><span class="q-num">${qCounter}.</span> <span class="q-text">${e(q.text)}</span>${opts}<span class="q-pts">${q.points} ${L('نقطة', 'pts')}</span></div>`;
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
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; }
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
</body>
</html>`;
}

// ─── Slides HTML (quiz) ───────────────────────────────────────────────────────

export function buildQuizSlidesHTML(
  quiz: QuizOutput,
  title: string,
  meta: { subject: string; grade: string },
  isAr: boolean,
): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const ACCENT = '#F59E0B';
  const e = (s: string) => (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
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

  const TOTAL = 1 + questionGroups.length + 1; // title + groups + answer key
  let slideNum = 1;

  const footer = (num: number) => `
    <div class="slide-footer">
      <span>${L('أُنشئ بواسطة إقرأ', 'Generated by Iqra')}</span>
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
      <div class="title-meta">${quiz.duration} ${L('دقيقة', 'min')} &nbsp;•&nbsp; ${quiz.totalPoints} ${L('نقطة', 'pts')}</div>
      <div class="title-brand">Iqra — ${L('مساعد التدريس الذكي', 'AI Teaching Assistant')}</div>
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
          <span class="q-pts">${q.points} ${L('نقطة', 'pts')}</span>
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
body { font-family: ${isAr ? "'Arial','Tahoma',sans-serif" : "'Helvetica Neue','Arial',sans-serif"}; background:#f0f0f0; }
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
</body>
</html>`;
}

// ─── Lesson Flow HTML (all-in-one PDF) ───────────────────────────────────────

export function buildLessonFlowHTML(flow: LessonFlowOutput, isAr: boolean): string {
  const dir = isAr ? 'rtl' : 'ltr';
  const font = isAr ? `'Amiri', 'Noto Naskh Arabic', serif` : `'Inter', 'Helvetica Neue', sans-serif`;
  const TEAL = '#00A99D';
  const NAVY = '#081B3A';

  const meta = `${flow.grade} · ${flow.subject} · ${flow.duration} ${isAr ? 'دقيقة' : 'min'}`;

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
       <div class="q-top"><span class="q-num">${idx + 1}</span><span class="q-pts">${q.points} ${isAr ? 'نقطة' : 'pts'}</span></div>
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
  body { font-family: ${font}; font-size: 13px; color: #1f2937; background: #fff; direction: ${dir}; }
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

  <div class="footer">IQRA Teaching Assistant · ${esc(flow.topic)} · ${new Date().toLocaleDateString()}</div>
</div>
</body>
</html>`;
}
