/**
 * The Ministry of Education's lesson-plan form (نموذج خطة الدرس) as printable
 * HTML — one A4-landscape page per lesson, laid out like the paper form
 * teachers are inspected against: a header line (subject / grade / unit /
 * lesson / periods / prior learning), the learning outcomes, the four-stage
 * table (teacher role · learner role · time), the class/absence/date block,
 * the self-reflection box and the signature line.
 *
 * Pure string builder, no IO and no React Native, so `node --test` can load it
 * (same split as exportHtml.ts). The form is Arabic by definition — there is
 * no English variant of a Ministry document.
 *
 * What is filled: everything the app knows (subject, grade, unit, lesson,
 * period count, official outcomes, class, date). What is deliberately left
 * ruled and empty: the teacher-role / learner-role cells. Those are the
 * teacher's own pedagogy, and inventing them would put words in the mouth of
 * a document a supervisor signs.
 */
import { isolateForeignRuns } from './mathRender.ts';

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
}

/** The form's four stages, with the minutes it prints beside each (a 45-minute period). */
export const MINISTRY_STAGES = [
  { label: '1-التهيئة والاندماج', minutes: 5, height: 64 },
  { label: '2-الشرح والتفسير', minutes: 15, height: 118 },
  { label: '3-التوسع ودعم التميز', minutes: 15, height: 100 },
  { label: '4-تأكيد التعلم', minutes: 10, height: 84 },
] as const;

const WEEKDAYS_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

/** «الأحد 2026-09-20», or the raw string when it is not a real date. */
export function ministryDayAndDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${WEEKDAYS_AR[d.getDay()]} ${iso}`;
}

function esc(s: string): string {
  return isolateForeignRuns(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** The form prints at least four numbered outcome slots, filled or not. */
const MIN_OUTCOME_SLOTS = 4;

function pageHTML(p: MinistryLessonPage, last: boolean): string {
  const slots = Math.max(MIN_OUTCOME_SLOTS, p.outcomes.length);
  const outcomes = Array.from({ length: slots }, (_, i) => {
    const text = p.outcomes[i];
    return `<div class="outcome"><span class="n">${i + 1}_</span> ${text ? esc(text) : ''}</div>`;
  }).join('');

  const rows = MINISTRY_STAGES.map(
    s => `<tr style="height:${s.height}px">
      <td class="stage"><span>${esc(s.label)}</span></td>
      <td></td><td></td>
      <td class="time">${s.minutes}د</td>
    </tr>`,
  ).join('');

  const periods = p.periods ? String(p.periods) : '';
  return `<section class="page"${last ? ' style="page-break-after:auto"' : ''}>
  <div class="title">خطة الدرس</div>
  <div class="head">
    <span>المبحث: ${esc(p.subject)}</span>
    <span>الصف: ${esc(p.grade)}</span>
    <span>الوحدة: ${esc(p.unit)}</span>
    <span>الدرس: ${esc(p.lesson)}</span>
    <span>عدد الحصص: ${esc(periods)}</span>
    <span>التعلم القبلي: ${esc(p.priorLearning)}</span>
  </div>
  <div class="box outcomes"><div class="lbl">النتاجات التعليمية :</div>${outcomes}</div>
  <table class="stages">
    <thead><tr><th class="c-stage">المراحل</th><th>دور المُعلم</th><th>دور المُتعلم</th><th class="c-time">الزمن</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="foot">
    <div class="box reflect">*التأمل الذاتي : حول عمليتي التعلم والتعليم</div>
    <table class="meta">
      <tr><th>الصف/الشعبة</th><td>${esc(p.section)}</td></tr>
      <tr><th>عدد الغياب/العدد الكلي</th><td></td></tr>
      <tr><th>ترتيب الحصة</th><td></td></tr>
      <tr><th>اليوم والتاريخ</th><td>${esc(ministryDayAndDate(p.date))}</td></tr>
    </table>
  </div>
  <div class="sign">
    <span>الاسم والتوقيع: المعلم : ${esc(p.teacher)}</span>
    <span>اخصائي المبحث:</span>
    <span>مدير المدرسة:</span>
    <span>مستشار التطوير المدرسي :</span>
  </div>
</section>`;
}

/** One form page per lesson, in the order given. */
export function buildMinistryPlanHTML(pages: readonly MinistryLessonPage[], title: string): string {
  const body = pages.map((p, i) => pageHTML(p, i === pages.length - 1)).join('\n');
  const BLUE = '#b4c6e7';
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>${esc(title)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Cairo:wght@600;700&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Almarai', 'Noto Naskh Arabic', Arial, sans-serif; font-size: 12px; line-height: 1.6;
      color: #000; direction: rtl; text-align: right; background: #fff;
      -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { width: 100%; max-width: 1040px; margin: 0 auto; padding: 4px 6px; border: 1px dashed #444;
      page-break-after: always; }
    .title { text-align: center; font: 700 16px 'Cairo', Arial, sans-serif; }
    .head { display: flex; flex-wrap: wrap; gap: 4px 28px; margin: 4px 0 8px; font-weight: 700; }
    .box { border: 1px solid #333; padding: 4px 8px; }
    .lbl { font-weight: 700; }
    .outcomes { display: flex; flex-wrap: wrap; gap: 0 26px; margin-bottom: 8px; min-height: 60px; }
    .outcomes .lbl { flex: 0 0 100%; }
    .outcome { font-weight: 700; }
    .n { display: inline-block; min-width: 22px; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #333; padding: 4px 8px; vertical-align: top; }
    th { background: ${BLUE}; font: 700 12px 'Cairo', Arial, sans-serif; text-align: center; }
    .stages .c-stage { width: 52px; }
    .stages .c-time { width: 56px; }
    td.stage { background: ${BLUE}; text-align: center; vertical-align: middle; width: 52px; }
    td.stage span { display: inline-block; writing-mode: vertical-rl; transform: rotate(180deg);
      font: 700 12px 'Cairo', Arial, sans-serif; }
    td.time { text-align: right; font-weight: 700; width: 56px; }
    .foot { display: flex; gap: 24px; margin-top: 14px; align-items: flex-start; }
    .reflect { flex: 1; min-height: 100px; font-weight: 700; }
    .meta { width: 340px; }
    .meta th { width: 150px; }
    .meta td { height: 26px; }
    .sign { display: flex; justify-content: space-between; margin-top: 30px; font-weight: 700; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}
