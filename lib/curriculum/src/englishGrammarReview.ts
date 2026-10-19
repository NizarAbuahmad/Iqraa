/**
 * The teacher's printable review form for the Grade 1 grammar activities:
 * an Arabic-first page listing every sentence a pupil can be shown, unit by
 * unit, with its picture, its «اختر الكلمة» options and its «صح أم خطأ» wrong
 * picture, a tick box and a notes column per sentence, and a sign-off strip
 * per unit. It prints on A4 landscape, one unit per page.
 *
 * Built from the same data as the app (`unitSentences`, `wordPicture`), so it
 * cannot drift from what children see. `scripts/grammar-sheet.ts` writes it to
 * docs/english-grammar-g1-review.html beside the markdown sheet, and a test
 * fails when the committed copy is stale.
 */
import { grammarUnitsForGrade, unitSentences, type GrammarSentence, type GrammarUnit } from './englishGrammar.ts';
import { hubLesson } from './englishHub.ts';
import { wordPicture } from './englishPictures.ts';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AR_DIGITS = (n: number) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** «٥ جمل», «١٦ جملة»: Arabic counts 3–10 with the plural, everything else with the singular. */
export function sentenceCountAr(n: number): string {
  return `${AR_DIGITS(n)} ${n >= 3 && n <= 10 ? 'جمل' : 'جملة'}`;
}
/** «الوحدة ٣»; unit 0 by name, since «الوحدة ٠» reads as a dot beside the «·» separators. */
export function unitLabelAr(n: number): string {
  return n === 0 ? 'وحدة الترحيب' : `الوحدة ${AR_DIGITS(n)}`;
}
const MARKER: Record<string, string> = { yes: '✅', no: '❌', boy: '👦', girl: '👧' };

const NOTES: Record<string, string> = {
  'kbl-g1-eng-s1-nccd-u1_l1': 'لا يوجد نشاط «صح أم خطأ» في هذه الوحدة: لكلمتي mum وdad فقط صورة واضحة، وصورة brother قد تُقرأ boy.',
  'kbl-g1-eng-s2-nccd-u0_l1': 'وحدة الترحيب لا تحتوي كلمات العائلة، لذلك تستخدم نمطي الوحدة الثانية (I\'ve got) والوحدة الرابعة (favourite toy).',
};

function picture(word: string | null, count: 1 | 2, marker: string | null): string {
  const pic = word ? wordPicture(word) : null;
  const glyph = marker ? MARKER[marker] ?? '' : '';
  if (!pic && !glyph) return '<span class="none">—</span>';
  const art = pic ? (count === 2 ? pic + pic : pic) : '';
  const label = word && pic ? `<span class="pic-word" dir="ltr">${esc(word)}${count === 2 ? ' ×٢' : ''}</span>` : '';
  return `<span class="pic"><span class="pic-art">${glyph}${art}</span>${label}</span>`;
}

function chooseCell(s: GrammarSentence): string {
  if (!s.choose) return '<span class="none">لا يظهر</span>';
  return `<span class="opt opt-right" dir="ltr">${esc(s.choose.right)}</span><span class="opt opt-wrong" dir="ltr">${esc(s.choose.wrong)}</span>`;
}

function falseCell(s: GrammarSentence): string {
  if (!s.picture || !s.falsePicture) return '<span class="none">لا يظهر</span>';
  return picture(s.falsePicture, s.picture.count, s.marker);
}

const patternText = (t: string) => t.replace(/\{(?:a:|s:)?\w+\}/g, '…');

function renderUnit(u: GrammarUnit, idx: number): string {
  const lesson = hubLesson(u.lessonId)!;
  const sentences = unitSentences(u);
  const rows = sentences.map((s, i) => `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="sentence" dir="ltr">${esc(s.text)}</td>
          <td>${s.picture ? picture(s.picture.word, s.picture.count, s.marker) : picture(null, 1, s.marker)}</td>
          <td class="choose">${chooseCell(s)}</td>
          <td>${falseCell(s)}</td>
          <td class="tick"><span class="box" aria-hidden="true"></span></td>
          <td class="note"></td>
        </tr>`).join('');
  const sem = lesson.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  const note = NOTES[u.lessonId] ? `<p class="unit-note">${NOTES[u.lessonId]}</p>` : '';
  return `
  <section class="unit" id="unit-${idx + 1}">
    <header class="unit-head">
      <div class="unit-meta"><span>${sem}</span><span>${unitLabelAr(lesson.unitNumber)}</span><span>${sentenceCountAr(sentences.length)}</span></div>
      <h2><span dir="ltr">${esc(lesson.unitTitle)}</span> <span class="unit-ar">${esc(lesson.unitTitleAr)}</span></h2>
      <ul class="patterns" dir="ltr">${u.patterns.map(p => `<li>${esc(patternText(p.text))}</li>`).join('')}</ul>
      ${note}
    </header>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الجملة</th>
            <th>الصورة</th>
            <th>«اختر الكلمة»<small>الصحيح ثم الخاطئ</small></th>
            <th>«صح أم خطأ»<small>الصورة الخاطئة</small></th>
            <th class="tick">✓</th>
            <th class="note">ملاحظات</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>
    <div class="signoff">
      <div class="verdict">
        <span><span class="box" aria-hidden="true"></span> موافق كما هي</span>
        <span><span class="box" aria-hidden="true"></span> موافق بعد التعديلات المكتوبة</span>
        <span><span class="box" aria-hidden="true"></span> غير موافق</span>
      </div>
      <div class="lines">
        <span>الاسم: <i></i></span>
        <span>التاريخ: <i></i></span>
        <span>التوقيع: <i></i></span>
      </div>
    </div>
  </section>`;
}

export function renderGrammarReviewHtml(grade = 1): string {
  const units = grammarUnitsForGrade(grade);
  const total = units.reduce((n, u) => n + unitSentences(u).length, 0);
  const sections = units.map(renderUnit).join('');

  const page = `<title>مراجعة قواعد الصف الأول</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Almarai:wght@400;700&family=Readex+Pro:wght@400;500;600;700&display=swap">
<style>
  /* Layout: an A4 review form — instructions first, then one section per unit, each ending in a sign-off strip. */
  :root {
    --paper: #FBFCFB;
    --ink: #13302C;
    --muted: #4E6661;
    --rule: #D3E2DE;
    --tint: #EAF3F1;
    --teal: #006D65;
    --right: #17643A;
    --right-bg: #E3F2E8;
    --wrong: #9B2C25;
    --wrong-bg: #F8E6E4;
    --display: "Readex Pro", "Almarai", "Noto Sans Arabic", system-ui, sans-serif;
    --body: "Almarai", "Readex Pro", "Noto Sans Arabic", system-ui, sans-serif;
    --latin: "Readex Pro", "Segoe UI", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #0E1A18; --ink: #E3EFEC; --muted: #9DB5AF; --rule: #2A3D39; --tint: #15302C;
      --teal: #2DD4BF; --right: #7FD8A1; --right-bg: #173726; --wrong: #F2A099; --wrong-bg: #3A1D1A;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --paper: #0E1A18; --ink: #E3EFEC; --muted: #9DB5AF; --rule: #2A3D39; --tint: #15302C;
    --teal: #2DD4BF; --right: #7FD8A1; --right-bg: #173726; --wrong: #F2A099; --wrong-bg: #3A1D1A;
    color-scheme: dark;
  }
  body {
    background: var(--paper); color: var(--ink);
    font-family: var(--body); font-size: 15px; line-height: 1.7;
    padding-left: max(16px, env(safe-area-inset-left, 0px));
    padding-right: max(16px, env(safe-area-inset-right, 0px));
    padding-block: 28px 56px;
  }
  .sheet { max-width: 1040px; margin-inline: auto; display: grid; gap: 40px; }
  h1, h2 { font-family: var(--display); text-wrap: balance; margin: 0; }
  h1 { font-size: 1.85rem; line-height: 1.3; font-weight: 700; }
  .eyebrow { font-family: var(--display); color: var(--teal); font-weight: 600; font-size: .9rem; }
  .intro { display: grid; gap: 18px; max-width: 880px; }
  .intro > p { max-width: 70ch; }
  .intro p { margin: 0; }
  .lead { font-size: 1.05rem; }
  .card { border: 1px solid var(--rule); border-radius: 10px; padding: 16px 20px; background: var(--tint); }
  .card h3 { font-family: var(--display); font-size: 1.05rem; margin: 0 0 8px; }
  .card ol, .card ul { margin: 0; padding-inline-start: 1.3em; display: grid; gap: 6px; }
  .card ol { list-style-type: arabic-indic; }
  .acts { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; }
  .act { border: 1px solid var(--rule); border-radius: 10px; padding: 12px 14px; }
  .act b { font-family: var(--display); display: block; color: var(--teal); }
  .legend { display: flex; flex-wrap: wrap; gap: 8px 18px; font-size: .92rem; }
  .meta-line { color: var(--muted); font-size: .9rem; }

  .unit { display: grid; gap: 14px; }
  .unit-head { display: grid; gap: 6px; border-bottom: 3px solid var(--teal); padding-bottom: 12px; }
  .unit-meta { color: var(--teal); font-family: var(--display); font-weight: 600; font-size: .9rem; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .unit-meta span + span::before { content: "·"; margin-inline-end: 14px; color: var(--muted); }
  h2 { font-size: 1.45rem; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  h2 [dir="ltr"] { font-family: var(--latin); }
  .unit-ar { color: var(--muted); font-size: 1.05rem; font-weight: 400; font-family: var(--body); }
  .patterns { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; justify-content: flex-end; }
  .patterns li { font-family: var(--latin); font-size: .9rem; border: 1px solid var(--rule); border-radius: 999px; padding: 2px 12px; }
  .unit-note { margin: 0; font-size: .92rem; color: var(--muted); }

  .table-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; min-width: 780px; font-variant-numeric: tabular-nums; }
  th, td { border-bottom: 1px solid var(--rule); padding: 7px 10px; text-align: start; vertical-align: middle; }
  thead th { background: var(--tint); font-family: var(--display); font-weight: 600; font-size: .85rem; line-height: 1.35; }
  thead th small { display: block; font-weight: 400; color: var(--muted); font-size: .75rem; }
  tbody tr:last-child td { border-bottom: 0; }
  td.num, th.num { width: 2.2em; color: var(--muted); text-align: center; }
  td.sentence { font-family: var(--latin); font-size: 1.02rem; font-weight: 500; text-align: left; white-space: nowrap; }
  .pic { display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .pic-art { font-size: 1.45rem; letter-spacing: 2px; font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
  .pic-word { font-family: var(--latin); font-size: .72rem; color: var(--muted); }
  .none { color: var(--muted); font-size: .85rem; }
  td.choose { white-space: nowrap; }
  .opt { display: inline-block; font-family: var(--latin); font-size: .88rem; border-radius: 6px; padding: 1px 8px; margin: 2px; }
  .opt-right { background: var(--right-bg); color: var(--right); font-weight: 600; }
  .opt-wrong { background: var(--wrong-bg); color: var(--wrong); text-decoration: line-through; text-decoration-thickness: 1px; }
  th.tick, td.tick { width: 2.6em; text-align: center; }
  .box { display: inline-block; width: 18px; height: 18px; border: 1.5px solid var(--ink); border-radius: 3px; vertical-align: -3px; }
  th.note, td.note { width: 26%; }

  .signoff { display: grid; gap: 12px; border: 1.5px dashed var(--teal); border-radius: 10px; padding: 14px 18px; }
  .verdict { display: flex; flex-wrap: wrap; gap: 10px 26px; font-family: var(--display); font-size: .95rem; }
  .verdict span { display: inline-flex; gap: 8px; align-items: center; }
  .lines { display: flex; flex-wrap: wrap; gap: 14px 28px; }
  .lines span { display: inline-flex; gap: 6px; align-items: baseline; flex: 1 1 200px; }
  .lines i { flex: 1; border-bottom: 1px solid var(--ink); min-width: 80px; height: 1.2em; }

  @page { size: A4 landscape; margin: 12mm; }
  @media print {
    :root { --paper: #fff; --ink: #111; --muted: #4d4d4d; --rule: #bbb; --tint: #F1F5F4; color-scheme: light; }
    body { padding: 0; font-size: 12px; }
    .sheet { gap: 0; max-width: none; }
    .intro { max-width: none; }
    .unit { break-before: page; }
    .table-wrap { overflow: visible; border-radius: 0; }
    table { min-width: 0; }
    tr, .signoff { break-inside: avoid; }
    thead { display: table-header-group; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>

<main class="sheet" dir="rtl" lang="ar">
  <section class="intro">
    <div class="eyebrow">إقرأ · ركن اللغة الإنجليزية · الصف الأول</div>
    <h1>مراجعة جمل القواعد قبل عرضها على الطلاب</h1>
    <p class="lead">بناءً على ملاحظتكم، أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة لتثبيت القواعد. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة في ${AR_DIGITS(units.length)} وحدات.</p>

    <div class="acts">
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ وصورة، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">I've got / I haven't got</span> أو <span dir="ltr">is / are</span> أو <span dir="ltr">He's / She's</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. لا تُستخدم جملة أطول من ٧ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة، ونصفها بصورة كلمة أخرى من الوحدة.</div>
    </div>

    <div class="card">
      <h3>ما المطلوب في كل جملة</h3>
      <ol>
        <li>هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟</li>
        <li>هل الصورة تناسب الجملة؟</li>
        <li>في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح مع هذه الصورة؟</li>
        <li>في «صح أم خطأ»: هل الصورة الخاطئة لا تحتمل أن تكون صحيحة؟</li>
        <li>هل الكلمات مناسبة لطالب الصف الأول؟</li>
      </ol>
    </div>

    <div class="card">
      <h3>طريقة التعبئة</h3>
      <ul>
        <li>ضعوا ✓ في المربع إذا كانت الجملة سليمة، أو اكتبوا الملاحظة في عمود «ملاحظات».</li>
        <li>في آخر كل وحدة اختاروا: موافق، أو موافق بعد التعديلات، أو غير موافق، مع الاسم والتاريخ.</li>
        <li>يمكن مراجعة وحدة واحدة في كل مرة؛ كل وحدة تُفعَّل وحدها بعد الموافقة عليها.</li>
      </ul>
    </div>

    <div class="legend">
      <span>✅ لديّ / أحب</span>
      <span>❌ ليس لديّ / لا أحب</span>
      <span>👦 He</span>
      <span>👧 She</span>
      <span>صورتان من الشيء = جمع (are / They're)</span>
      <span><span class="opt opt-right" dir="ltr">right</span> الخيار الصحيح</span>
      <span><span class="opt opt-wrong" dir="ltr">wrong</span> الخيار الخاطئ</span>
    </div>
    <p class="meta-line">«لا يظهر» تعني أن الجملة لا تُستخدم في هذا النشاط (لا توجد صورة واضحة لها). الصور هي الرموز التي تظهر في التطبيق نفسه.</p>
  </section>
${sections}
</main>
`;
  // A standalone file: opened from disk in any browser and printed from there.
  const split = page.indexOf('<main ');
  return `<!doctype html>
<html lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${page.slice(0, split).trimEnd()}
</head>
<body>
${page.slice(split).trimEnd()}
</body>
</html>
`;
}
