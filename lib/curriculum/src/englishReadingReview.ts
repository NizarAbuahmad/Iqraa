/**
 * The teacher's printable review form for the Grade 1 reading activities: per
 * unit, every word with its picture and the letter the app will call its
 * first sound, the words left out with the reason, a tick box and notes per
 * word, and a sign-off strip. A4 landscape, one unit per page.
 *
 * Built from the same data as the app (`firstSound`, `wordPicture`), so it
 * cannot drift from what children see. `scripts/grammar-sheet.ts` writes it to
 * docs/english-reading-g1-review.html, and a test fails when that copy is stale.
 */
import {
  READING_NOT_COVERED_G2, READING_NOT_COVERED_G3, firstSound, firstSoundSkip, readSentencePool, readingUnitsForGrade, sentencePartner,
  type ReadingUnit, type SoundSkip,
} from './englishReading.ts';
import type { GrammarSentence } from './englishGrammar.ts';
import { notCoveredList, picture, unitLabelAr } from './englishGrammarReview.ts';
import { hubLesson } from './englishHub.ts';
import { wordPicture } from './englishPictures.ts';

/** Why a lesson has no, or fewer, «Read the sentence» — the two grades' tables never share a lesson. */
const NOT_COVERED: Record<string, string[]> = { ...READING_NOT_COVERED_G2, ...READING_NOT_COVERED_G3 };

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const AR_DIGITS = (n: number) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]);
/** «٨ كلمات», «١٦ كلمة»: Arabic counts 3–10 with the plural, everything else with the singular. */
const wordCountAr = (n: number) => `${AR_DIGITS(n)} ${n >= 3 && n <= 10 ? 'كلمات' : 'كلمة'}`;

const SKIP_AR: Record<SoundSkip, string> = {
  vowel: 'لا تُستعمل: تبدأ بحرف علّة، وله أكثر من صوت',
  digraph: 'لا تُستعمل: أول حرفين صوت واحد (<span dir="ltr">ch / sh / th</span>)',
  'soft-c': 'لا تُستعمل: <span dir="ltr">c</span> تُلفظ <span dir="ltr">s</span> هنا',
  'soft-g': 'لا تُستعمل: <span dir="ltr">g</span> تُلفظ <span dir="ltr">j</span> هنا',
};

/** A sentence's picture, in the same markup as the grammar form. */
function pictureOf(s: GrammarSentence): string {
  return picture(s.picture!.word, s.picture!.count, s.marker);
}

/** Grades 2 and 3: the «Read the sentence» pool of a unit, with the wrong picture each is shown against; then why anything is left out. */
function sentenceSection(lessonId: string): string {
  const pool = readSentencePool(lessonId);
  const rows = pool.map((s, i) => {
    const partner = sentencePartner(s, pool);
    const against = partner
      ? `${pictureOf(partner)} <span class="none">+ كلمة أخرى من القائمة</span>`
      : '<span class="none">كلمتان أخريان من القائمة</span>';
    return `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="sentence" dir="ltr">${esc(s.text)}</td>
          <td>${pictureOf(s)}</td>
          <td>${against}</td>
          <td class="tick"><span class="box" aria-hidden="true"></span></td>
          <td class="note"></td>
        </tr>`;
  }).join('');
  const table = pool.length
    ? `
    <h3 class="sub-h">جمل «اقرَأ الجملة» <span class="meta-line">(${AR_DIGITS(pool.length)})</span></h3>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الجملة</th>
            <th>الصورة</th>
            <th>صورة خاطئة تظهر معها<small>تُختار الأخرى عشوائيًا</small></th>
            <th class="tick">✓</th>
            <th class="note">ملاحظات</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>`
    : '';
  return `${table}${notCoveredList(NOT_COVERED[lessonId])}`;
}

function renderUnit(u: ReadingUnit, grade: number): string {
  const lesson = hubLesson(u.lessonId)!;
  const rows = lesson.words.map((w, i) => {
    const pic = wordPicture(w.en);
    const letter = firstSound(w.en);
    const skip = firstSoundSkip(w.en);
    const sound = letter
      ? `<td class="letter" dir="ltr">${letter}</td>`
      : `<td class="skip">${skip ? SKIP_AR[skip] : 'لا تُستعمل'}</td>`;
    return `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="word" dir="ltr">${esc(w.en)}</td>
          <td>${pic ? `<span class="pic-art">${pic}</span>` : '<span class="none">بلا صورة</span>'}</td>
          ${sound}
          <td class="tick"><span class="box" aria-hidden="true"></span></td>
          <td class="note"></td>
        </tr>`;
  }).join('');
  const sem = lesson.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  return `
  <section class="unit" id="${esc(u.lessonId)}">
    <header class="unit-head">
      <div class="unit-meta"><span>${sem}</span><span>${unitLabelAr(lesson.unitNumber)}</span><span>${wordCountAr(lesson.words.length)}</span></div>
      <h2><span dir="ltr">${esc(lesson.unitTitle)}</span> <span class="unit-ar">${esc(lesson.unitTitleAr)}</span></h2>
    </header>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الكلمة</th>
            <th>الصورة</th>
            <th>الحرف الأول<small>كما يظهر للطالب</small></th>
            <th class="tick">✓</th>
            <th class="note">ملاحظات</th>
          </tr>
        </thead>
        <tbody>${rows}
        </tbody>
      </table>
    </div>${grade >= 2 ? sentenceSection(u.lessonId) : ''}
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

interface GradeCopy {
  title: string;
  eyebrow: string;
  lead: (words: number, units: number, sentences: number, sentenceUnits: number) => string;
  acts: string;
  checks: string[];
  meta: string;
  extraCss: string;
}

const ACT_FIND = '<div class="act"><b>اقرَأ واختر الصورة</b>تظهر الكلمة مكتوبة دون صوت، ويختار الطالب صورتها من ثلاث صور. تُسمع الكلمة بعد الإجابة.</div>';
const ACT_LETTER = '<div class="act"><b>الحرف الأول</b>يسمع الطالب الكلمة ويرى صورتها، ويختار حرفها الأول من ثلاثة أحرف. لا تُكتب الكلمة قبل الإجابة.</div>';
const ACT_STARTS = '<div class="act"><b>يبدأ بهذا الحرف</b>يظهر حرف، ويختار الطالب الصورة التي يبدأ اسمها بصوته من ثلاث صور.</div>';
const CHECKS_WORD = [
  'هل الحرف المكتوب هو فعلًا أول صوت يسمعه الطالب في الكلمة؟',
  'هل الصورة تدل على الكلمة دون لبس؟',
  'هل توافقون على استبعاد الكلمات المستبعدة، أم تريدون إضافة إحداها؟',
];

const ACTS_SENTENCE = ACT_FIND + '\n      ' + ACT_LETTER + '\n      ' + ACT_STARTS +
  '\n      <div class="act"><b>اقرَأ الجملة</b>تظهر جملة مكتوبة دون صوت، ويختار الطالب صورتها من ثلاث صور. إحدى الصورتين الخاطئتين هي صورة الجملة المقابلة إن وُجدت (🐭 مقابل 🐭🐭، أو ✅ مقابل ❌، أو 👦 مقابل 👧) ليقرأ الطالب الكلمة الصغيرة.</div>';

const META_SENTENCE = '«بلا صورة» تعني أن الكلمة لا تظهر في نشاطَي الصور، وتظهر في «الحرف الأول» بالصوت وحده. لا يشمل التطبيق الصوت الأوسط أو الأخير في الكلمة. الصور هي الرموز التي تظهر في التطبيق نفسه.';

const CSS_SENTENCE = `
  td.sentence { font-family: var(--latin); font-size: 1.02rem; font-weight: 500; text-align: left; white-space: nowrap; }
  .pic { display: inline-flex; flex-direction: column; align-items: center; line-height: 1.2; }
  .pic-word { font-family: var(--latin); font-size: .72rem; color: var(--muted); }
  .sub-h { font-family: var(--display); font-size: 1.05rem; margin: 6px 0 0; }
  .unit-note { margin: 0; }
  .not-covered { margin: 0; padding-inline-start: 1.3em; display: grid; gap: 4px; font-size: .92rem; color: var(--muted); }
  .not-covered [dir="ltr"] { font-family: var(--latin); }`;

const GRADE_COPY: Record<number, GradeCopy> = {
  1: {
    title: 'مراجعة قراءة الصف الأول',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الأول',
    lead: (words, units) => `أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة قراءة مبنية على كلمات كل وحدة وصورها وتسجيلاتها، وعلى هدف الكتاب: تمييز الصوت الأول في الكلمة. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل كلمة في ${AR_DIGITS(units)} وحدات، ${wordCountAr(words)}.`,
    acts: ACT_FIND + '\n      ' + ACT_LETTER + '\n      ' + ACT_STARTS,
    checks: CHECKS_WORD,
    meta: '«بلا صورة» تعني أن الكلمة لا تظهر في نشاطَي الصور، وتظهر في «الحرف الأول» بالصوت وحده. الصور هي الرموز التي تظهر في التطبيق نفسه.',
    extraCss: '',
  },
  2: {
    title: 'مراجعة قراءة الصف الثاني',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثاني',
    lead: (words, units, sentences, sentenceUnits) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثاني أربعة أنشطة قراءة: ثلاثة على كلمات كل وحدة كما في الصف الأول، ونشاط رابع لقراءة جملة كاملة. الجمل هي جمل القواعد نفسها، وتُسمع بعد الإجابة فقط، ولا يظهر هذا النشاط لوحدة قبل موافقتكم على قواعدها أيضًا. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل كلمة في ${AR_DIGITS(units)} وحدات، ${wordCountAr(words)}، وجمل النشاط الرابع في ${AR_DIGITS(sentenceUnits)} وحدات، ${AR_DIGITS(sentences)} جملة.`,
    acts: ACTS_SENTENCE,
    checks: [
      ...CHECKS_WORD,
      'في «اقرَأ الجملة»: هل يستطيع طالب الصف الثاني قراءة الجملة كاملة؟ وهل جملتا السؤال والجواب معًا أطول مما يُحتمل في هذه المرحلة، أم يكفي عرض الجواب وحده؟',
      'هل تُقرأ ✅ و❌ والصورة الواحدة مقابل الصورتين بوضوح على أنها «don\'t» و«these are»؟',
      'هل تسبب صورة pink (القلب الوردي) أو orange (الدائرة 🟠) أو لون العينين لبسًا؟',
    ],
    meta: META_SENTENCE,
    extraCss: CSS_SENTENCE,
  },
  3: {
    title: 'مراجعة قراءة الصف الثالث',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثالث',
    lead: (words, units, sentences, sentenceUnits) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثالث أربعة أنشطة قراءة: ثلاثة على كلمات كل وحدة كما في الصفين الأول والثاني، ونشاط رابع لقراءة جملة كاملة. الجمل هي جمل القواعد نفسها، وتُسمع بعد الإجابة فقط، ولا يظهر هذا النشاط لوحدة قبل موافقتكم على قواعدها أيضًا. ثلاث وحدات من الثماني بلا صور لكلماتها، فتبقى فيها «الحرف الأول» وحده. لا يُسمع في التطبيق صوت الحرف وحده؛ يظهر الحرف مكتوبًا فقط. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل كلمة في ${AR_DIGITS(units)} وحدات، ${wordCountAr(words)}، وجمل النشاط الرابع في ${AR_DIGITS(sentenceUnits)} وحدات، ${AR_DIGITS(sentences)} جملة.`,
    acts: ACTS_SENTENCE,
    checks: [
      ...CHECKS_WORD,
      'في «اقرَأ الجملة»: هل يستطيع طالب الصف الثالث قراءة الجملة كاملة، مثل «She goes to work by underground.»؟',
      'هل تُقرأ ✅ و❌ والصورة المضاعفة بوضوح على أنها «There\'s» و«There isn\'t» و«There are»، وهل تُقرأ صورة الولد مقابل البنت على أنها «he» و«she»؟',
      'في وحدة «Look at the stars» ست كلمات مصورة فقط، فالجولة ستة أسئلة: هل يكفي هذا أم تفضلون إخفاء النشاط هناك؟',
      'هل تسبب أي صورة من صور الجمل لبسًا في الاسم المطلوب؟',
    ],
    meta: META_SENTENCE,
    extraCss: CSS_SENTENCE,
  },
};

export function renderReadingReviewHtml(grade = 1): string {
  const copy = GRADE_COPY[grade]!;
  const unitRows = readingUnitsForGrade(grade);
  const words = unitRows.reduce((n, u) => n + (hubLesson(u.lessonId)?.words.length ?? 0), 0);
  const pools = unitRows.map(u => readSentencePool(u.lessonId)).filter(p => p.length > 0);
  const sentences = pools.reduce((n, p) => n + p.length, 0);
  const units = unitRows.map(u => renderUnit(u, grade)).join('');

  const page = `<title>${copy.title}</title>
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
    --display: "Readex Pro", "Almarai", "Noto Sans Arabic", system-ui, sans-serif;
    --body: "Almarai", "Readex Pro", "Noto Sans Arabic", system-ui, sans-serif;
    --latin: "Readex Pro", "Segoe UI", system-ui, sans-serif;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper: #0E1A18; --ink: #E3EFEC; --muted: #9DB5AF; --rule: #2A3D39; --tint: #15302C; --teal: #2DD4BF;
      color-scheme: dark;
    }
  }
  :root[data-theme="dark"] {
    --paper: #0E1A18; --ink: #E3EFEC; --muted: #9DB5AF; --rule: #2A3D39; --tint: #15302C; --teal: #2DD4BF;
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
  .meta-line { color: var(--muted); font-size: .9rem; }

  .unit { display: grid; gap: 14px; }
  .unit-head { display: grid; gap: 6px; border-bottom: 3px solid var(--teal); padding-bottom: 12px; }
  .unit-meta { color: var(--teal); font-family: var(--display); font-weight: 600; font-size: .9rem; display: flex; flex-wrap: wrap; gap: 4px 14px; }
  .unit-meta span + span::before { content: "·"; margin-inline-end: 14px; color: var(--muted); }
  h2 { font-size: 1.45rem; display: flex; flex-wrap: wrap; gap: 4px 12px; align-items: baseline; }
  h2 [dir="ltr"] { font-family: var(--latin); }
  .unit-ar { color: var(--muted); font-size: 1.05rem; font-weight: 400; font-family: var(--body); }

  .table-wrap { overflow-x: auto; border: 1px solid var(--rule); border-radius: 10px; }
  table { border-collapse: collapse; width: 100%; min-width: 640px; font-variant-numeric: tabular-nums; }
  th, td { border-bottom: 1px solid var(--rule); padding: 7px 10px; text-align: start; vertical-align: middle; }
  thead th { background: var(--tint); font-family: var(--display); font-weight: 600; font-size: .85rem; line-height: 1.35; }
  thead th small { display: block; font-weight: 400; color: var(--muted); font-size: .75rem; }
  tbody tr:last-child td { border-bottom: 0; }
  td.num, th.num { width: 2.2em; color: var(--muted); text-align: center; }
  td.word { font-family: var(--latin); font-size: 1.05rem; font-weight: 500; text-align: left; white-space: nowrap; }
  td.letter { font-family: var(--latin); font-size: 1.35rem; font-weight: 700; color: var(--teal); text-align: center; }
  td.skip { color: var(--muted); font-size: .85rem; }
  td.skip [dir="ltr"] { font-family: var(--latin); }
  .pic-art { font-size: 1.45rem; letter-spacing: 2px; font-family: "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif; }
  .none { color: var(--muted); font-size: .85rem; }
  th.tick, td.tick { width: 2.6em; text-align: center; }
  .box { display: inline-block; width: 18px; height: 18px; border: 1.5px solid var(--ink); border-radius: 3px; vertical-align: -3px; }
  th.note, td.note { width: 30%; }

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
  }${copy.extraCss}
</style>

<main class="sheet" dir="rtl" lang="ar">
  <section class="intro">
    <div class="eyebrow">${copy.eyebrow}</div>
    <h1>مراجعة أنشطة القراءة قبل عرضها على الطلاب</h1>
    <p class="lead">${copy.lead(words, unitRows.length, sentences, pools.length)}</p>

    <div class="acts">
      ${copy.acts}
    </div>

    <div class="card">
      <h3>ما المطلوب في كل كلمة</h3>
      <ol>
        ${copy.checks.map(c => `<li>${esc(c)}</li>`).join('\n        ')}
      </ol>
    </div>

    <div class="card">
      <h3>طريقة التعبئة</h3>
      <ul>
        <li>ضعوا ✓ في المربع إذا كانت الكلمة سليمة، أو اكتبوا الملاحظة في عمود «ملاحظات».</li>
        <li>في آخر كل وحدة اختاروا: موافق، أو موافق بعد التعديلات، أو غير موافق، مع الاسم والتاريخ.</li>
        <li>يمكن مراجعة وحدة واحدة في كل مرة؛ كل وحدة تُفعَّل وحدها بعد الموافقة عليها.</li>
      </ul>
    </div>

    <p class="meta-line">${copy.meta}</p>
  </section>
${units}
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
