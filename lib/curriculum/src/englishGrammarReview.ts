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
import {
  ADJECTIVE_FORMS, PAST_OVERRIDES, grammarUnit, grammarUnitsForGrade, pastTense, unitSentences, type GrammarSentence, type GrammarUnit,
} from './englishGrammar.ts';
import { NOT_COVERED_G2 } from './englishGrammarG2.ts';
import { NOT_COVERED_G3 } from './englishGrammarG3.ts';
import { G4_TABLES, NOT_COVERED_G4 } from './englishGrammarG4.ts';
import { hubLesson, hubLessonsForGrade } from './englishHub.ts';
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

/** Per grade: lesson id → why part of it is not covered (Grade 1 uses `NOTES` instead). */
const NOT_COVERED: Record<number, Record<string, string[]>> = { 2: NOT_COVERED_G2, 3: NOT_COVERED_G3, 4: NOT_COVERED_G4 };

/** Wraps each run of English in `dir="ltr"`, so a phrase with punctuation does not scramble inside an Arabic line. */
export const ltr = (s: string) =>
  esc(s).replace(/[A-Za-z][A-Za-z0-9'’-]*(?:[ ,.?!/…]+[A-Za-z0-9'’][A-Za-z0-9'’-]*)*[.?!]?/g, m => `<span dir="ltr">${m}</span>`);

function yesNoCell(s: GrammarSentence): string {
  const y = s.yesNo;
  if (!y) return '<span class="none">لا يظهر</span>';
  const line = (q: string, a: string, cls: string) => `<span class="yn ${cls}" dir="ltr">${esc(q)} → ${esc(a)}</span>`;
  if (y.kind !== 'match') return line(y.question, y.answer ? y.yes : y.no, y.answer ? 'yn-yes' : 'yn-no');
  return line(y.question, y.yes, 'yn-yes') + (y.otherQuestion ? line(y.otherQuestion, y.no, 'yn-no') : '');
}

export function notCoveredList(items: string[] | undefined): string {
  if (!items) return '';
  return `<p class="unit-note"><b>غير مشمول، ولماذا:</b></p><ul class="not-covered">${items.map(i => `<li>${ltr(i)}</li>`).join('')}</ul>`;
}

export function picture(word: string | null, count: 1 | 2, marker: string | null): string {
  const pic = word ? wordPicture(word) : null;
  const glyph = marker ? MARKER[marker] ?? '' : '';
  if (!pic && !glyph) return '<span class="none">—</span>';
  const art = pic ? (count === 2 ? pic + pic : pic) : '';
  const label = word && pic ? `<span class="pic-word" dir="ltr">${esc(word)}${count === 2 ? ' ×٢' : ''}</span>` : '';
  return `<span class="pic"><span class="pic-art">${glyph}${art}</span>${label}</span>`;
}

/** When Build the sentence builds only the answer, the form says so: a teacher signs what the child orders. */
function buildHalf(s: GrammarSentence): string {
  return s.build?.prompt ? `<small class="build-half" dir="ltr">Build: ${esc(s.build.text)}</small>` : '';
}

function chooseCell(s: GrammarSentence): string {
  if (!s.choose) return '<span class="none">لا يظهر</span>';
  return `<span class="opt opt-right" dir="ltr">${esc(s.choose.right)}</span><span class="opt opt-wrong" dir="ltr">${esc(s.choose.wrong)}</span>`;
}

function falseCell(s: GrammarSentence): string {
  // A picture-free comparison (Grade 4, S1 U4): the false twin is the sentence a child is told is false.
  if (s.claim) return `<span class="yn yn-no" dir="ltr">${esc(s.claim.falseText)}</span>`;
  if (!s.picture || !s.falsePicture) return '<span class="none">لا يظهر</span>';
  return picture(s.falsePicture, s.picture.count, s.marker);
}

/** The pattern with its slots as «…». Grades 1–3 keep the older cleaner, which leaves `{v:act}` as written, so their printed forms do not change. */
const patternText = (t: string, grade: number) => t.replace(grade >= 4 ? /\{(?:a:|s:|v:|3:|ing:|cmp:|sup:|ed:)?\w+\}/g : /\{(?:a:|s:)?\w+\}/g, '…');

function renderUnit(u: GrammarUnit, idx: number): string {
  const lesson = hubLesson(u.lessonId)!;
  const sentences = unitSentences(u);
  const withYesNo = sentences.some(s => s.yesNo);
  const rows = sentences.map((s, i) => `
        <tr>
          <td class="num">${AR_DIGITS(i + 1)}</td>
          <td class="sentence" dir="ltr">${esc(s.text)}${buildHalf(s)}</td>
          <td>${s.picture ? picture(s.picture.word, s.picture.count, s.marker) : picture(null, 1, s.marker)}</td>
          <td class="choose">${chooseCell(s)}</td>
          <td>${falseCell(s)}</td>${withYesNo ? `\n          <td class="yesno">${yesNoCell(s)}</td>` : ''}
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
      <ul class="patterns" dir="ltr">${u.patterns.map(p => `<li>${esc(patternText(p.text, lesson.grade))}</li>`).join('')}</ul>
      ${note}${notCoveredList(NOT_COVERED[hubLesson(u.lessonId)!.grade]?.[u.lessonId])}
    </header>
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th class="num">#</th>
            <th>الجملة</th>
            <th>الصورة</th>
            <th>«اختر الكلمة»<small>الصحيح ثم الخاطئ</small></th>
            <th>«صح أم خطأ»<small>الصورة الخاطئة</small></th>${withYesNo ? `\n            <th>«نعم أم لا»<small>السؤال والجواب، ثم سؤال «لا»</small></th>` : ''}
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

function renderUncovered(lessonId: string, idx: number, items: string[]): string {
  const lesson = hubLesson(lessonId)!;
  const sem = lesson.semester === 1 ? 'الفصل الأول' : 'الفصل الثاني';
  return `
  <section class="unit" id="unit-${idx + 1}">
    <header class="unit-head">
      <div class="unit-meta"><span>${sem}</span><span>${unitLabelAr(lesson.unitNumber)}</span><span>بلا أنشطة قواعد</span></div>
      <h2><span dir="ltr">${esc(lesson.unitTitle)}</span> <span class="unit-ar">${esc(lesson.unitTitleAr)}</span></h2>
      ${notCoveredList(items)}
    </header>
  </section>`;
}

interface GradeCopy {
  title: string;
  eyebrow: string;
  lead: (total: number, units: number) => string;
  acts: string;
  checks: string[];
  extraCss: string;
  /** Extra intro HTML after the legend line (Grade 4: the revision unit that is not a hub lesson). */
  extra?: string;
}

const YESNO_CSS = `
  .yn { display: block; font-family: var(--latin); font-size: .88rem; white-space: nowrap; }
  .yn-yes { color: var(--right); }
  .yn-no { color: var(--wrong); }
  td.yesno { white-space: nowrap; }
  .not-covered { margin: 0; padding-inline-start: 1.3em; display: grid; gap: 4px; font-size: .92rem; color: var(--muted); }
  .not-covered [dir="ltr"] { font-family: var(--latin); }`;

const GRADE_COPY: Record<number, GradeCopy> = {
  1: {
    title: 'مراجعة قواعد الصف الأول',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الأول',
    lead: (total, units) => `بناءً على ملاحظتكم، أضفنا إلى ركن اللغة الإنجليزية ثلاثة أنشطة لتثبيت القواعد. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة في ${AR_DIGITS(units)} وحدات.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ وصورة، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">I've got / I haven't got</span> أو <span dir="ltr">is / are</span> أو <span dir="ltr">He's / She's</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. لا تُستخدم جملة أطول من ٧ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة، ونصفها بصورة كلمة أخرى من الوحدة.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح مع هذه الصورة؟',
      'في «صح أم خطأ»: هل الصورة الخاطئة لا تحتمل أن تكون صحيحة؟',
      'هل الكلمات مناسبة لطالب الصف الأول؟',
    ],
    extraCss: '',
  },
  2: {
    title: 'مراجعة قواعد الصف الثاني',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثاني',
    lead: (total, units) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثاني أربعة أنشطة لتثبيت القواعد، منها نشاط جديد للأجوبة القصيرة. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها، وما استُبعد منها مذكور مع سببه في كل وحدة. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة في ${AR_DIGITS(units)} وحدات.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ وصورة، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">This is / These are</span> أو <span dir="ltr">He's / She's</span> أو <span dir="ltr">like / don't like</span>.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. لا تُستخدم جملة أطول من ٧ كلمات.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة، ونصفها بصورة كلمة أخرى من الوحدة.</div>
      <div class="act"><b>نعم أم لا</b>صورة وسؤال، ويختار الطالب الجواب القصير: <span dir="ltr">Yes, it is. / No, it isn't.</span> أو <span dir="ltr">Yes, I do. / No, I don't.</span> نصف الأسئلة جوابها «نعم» ونصفها «لا».</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح مع هذه الصورة؟',
      'في «صح أم خطأ»: هل الصورة الخاطئة لا تحتمل أن تكون صحيحة؟',
      'في «نعم أم لا»: هل الجواب القصير هو الصحيح للسؤال وللصورة؟',
      'هل الكلمات مناسبة لطالب الصف الثاني؟',
    ],
    extraCss: YESNO_CSS,
  },
  3: {
    title: 'مراجعة قواعد الصف الثالث',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الثالث',
    lead: (total, units) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الثالث أنشطة لتثبيت القواعد على ${AR_DIGITS(units)} وحدات. القواعد هنا في معظمها صيغ أفعال (<span dir="ltr">play / plays</span> و<span dir="ltr">have / has</span> و<span dir="ltr">Is / Are</span>)، ولذلك تجدون وحدات بلا صور لأن كلماتها أفعال وعبارات، وما استُبعد مذكور مع سببه في كل وحدة. الجمل مبنية من نمط القواعد في كل وحدة من الكتاب ومن كلمات الوحدة نفسها. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ، وخياران: الصحيح ونقيضه في القاعدة، مثل <span dir="ltr">plays / play</span> أو <span dir="ltr">Does / Do</span> أو <span dir="ltr">There's / There isn't</span>. تظهر معها صورة حيث توجد صورة صادقة فقط.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. حتى ٩ كلمات. إن زادت الجملة (سؤال وجواب) يُرتّب الجواب وحده ويظهر السؤال فوق الكلمات؛ ويُكتب ذلك تحت الجملة في القائمة.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة: نصف الأسئلة بصورتها الصحيحة ونصفها بصورة كلمة أخرى من الوحدة. في الوحدات المصوّرة فقط.</div>
      <div class="act"><b>نعم أم لا</b>صورة وسؤال، ويختار الطالب الجواب القصير. في أسئلة <span dir="ltr">Can penguins swim?</span> يجيب الطالب مما يعرفه عن الحيوان، وفي <span dir="ltr">Is there a sofa?</span> تدل ✅ أو ❌ على الجواب.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة (إن وُجدت) تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ خاطئ بوضوح؟ وهل في الجملة أو الصورة ما يدل على الصحيح؟',
      'في «رتّب الجملة»: هل يكفي ترتيب الجواب وحده حين تطول الجملة؟',
      'في «نعم أم لا»: هل الجواب القصير هو الصحيح للسؤال وللصورة؟ وهل معلومات الحيوانات صحيحة؟',
      'هل الكلمات مناسبة لطالب الصف الثالث؟',
    ],
    extraCss: YESNO_CSS + `
  .build-half { display: block; color: var(--muted); font-size: .78rem; font-weight: 400; white-space: nowrap; }`,
  },
  4: {
    title: 'مراجعة قواعد الصف الرابع',
    eyebrow: 'إقرأ · ركن اللغة الإنجليزية · الصف الرابع',
    lead: (total, units) => `أضفنا إلى ركن اللغة الإنجليزية في الصف الرابع أنشطة لتثبيت القواعد على ${AR_DIGITS(units)} وحدات. قواعد هذا الصف مقارنات (<span dir="ltr">higher / the deepest / more exciting</span>) وأفعال مساعدة (<span dir="ltr">must / can</span>) وماضٍ بسيط، ولا تدل صورة على زمن أو مقارنة، لذلك تجدون وحدات بلا صور، وما استُبعد مذكور مع سببه في كل وحدة. المقارنات والقواعد والأفعال الشاذة وتصنيف الأطعمة وغيرها مكتوب في <b>صفحة البيانات</b> بعد هذه المقدمة لتتأكدوا منه قبل أي جملة. <b>لن يرى الطلاب أي وحدة قبل أن توافقوا عليها.</b> هذه الورقة تعرض كل جملة يمكن أن تظهر للطالب، ${AR_DIGITS(total)} جملة.`,
    acts: `
      <div class="act"><b>اختر الكلمة</b>جملة فيها فراغ، وخياران صيغتان حقيقيتان: <span dir="ltr">higher / high</span> أو <span dir="ltr">the deepest / the deeper</span> أو <span dir="ltr">used / use</span> أو <span dir="ltr">must / mustn't</span>. تظهر معها صورة حيث توجد صورة صادقة فقط.</div>
      <div class="act"><b>رتّب الجملة</b>كلمات الجملة مبعثرة، ويرتّبها الطالب بالنقر. حتى ٩ كلمات. إن زادت الجملة (سؤال وجواب) يُرتّب الجواب وحده ويظهر السؤال فوق الكلمات؛ ويُكتب ذلك تحت الجملة في القائمة.</div>
      <div class="act"><b>صح أم خطأ</b>جملة بجانب صورة، أو بلا صورة في المقارنات: تُعرض الجملة نفسها، أو توأمها الخاطئ بعد تبديل الطرفين (<span dir="ltr">The hill is higher than the mountain.</span>).</div>
      <div class="act"><b>نعم أم لا</b>سؤال بصورة أو بلا صورة. في المقارنات (<span dir="ltr">Is the mountain higher than the hill?</span>) يجيب الطالب مما يعرفه، وفي <span dir="ltr">Was there a market?</span> تدل ✅ أو ❌ على أنه كان موجودًا.</div>
    `,
    checks: [
      'هل الجملة صحيحة لغويًا، وبالصيغة التي يدرّسها الكتاب؟',
      'هل الصورة (إن وُجدت) تناسب الجملة؟',
      'في «اختر الكلمة»: هل الخيار الخاطئ صيغة حقيقية خاطئة بوضوح؟ وهل في الجملة ما يدل على الصحيح؟',
      'في «رتّب الجملة»: هل يكفي ترتيب الجواب وحده حين تطول الجملة؟',
      'في صفحة البيانات: هل كل زوج في المقارنات صحيح دون جدال؟ وهل تصنيف الأطعمة وقواعد must وmustn\'t والأفعال الشاذة وظروف الحال سليمة؟',
      'هل تُقرأ ✅ و❌ بوضوح على أنها «كان موجودًا» و«لم يكن موجودًا» في الوحدة الثامنة؟',
      'هل الكلمات مناسبة لطالب الصف الرابع؟',
    ],
    extra: '<p class="meta-line">الوحدة السادسة <span dir="ltr">Hello from Hamed!</span> مراجعة لقواعد الفصل الأول ولا قائمة كلمات لها، فليست درسًا في الركن ولا قواعد لها هنا. الأعداد الترتيبية (من <span dir="ltr">first</span> إلى <span dir="ltr">thirty-first</span>) غير مشمولة: لا يعطي الكتاب لها جملة نموذجية.</p>',
    extraCss: YESNO_CSS + `
  .build-half { display: block; color: var(--muted); font-size: .78rem; font-weight: 400; white-space: nowrap; }
  .data { display: grid; gap: 14px; }
  .data .table-wrap table { min-width: 0; }
  .data-table td { font-size: .95rem; }
  @media print { .data { break-before: page; } }`,
  },
};

/** One checkable table of the data page. Cells are English or Arabic; English runs are set left-to-right. */
function dataTable(title: string, headers: string[], rows: string[][]): string {
  const head = headers.map(h => `<th>${esc(h)}</th>`).join('');
  const body = rows.map(r => `<tr>${r.map(c => `<td>${ltr(c)}</td>`).join('')}</tr>`).join('');
  return `
    <h3 class="sub-h">${esc(title)} <span class="meta-line">(${AR_DIGITS(rows.length)})</span></h3>
    <div class="table-wrap"><table class="data-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/** Everything in Grade 4 that is a claim rather than a sentence, built from the same rows and tables the units use. */
function gradeFourDataPage(): string {
  const sentences = (lesson: string, pattern: string) => unitSentences(grammarUnit(lesson)!).filter(s => s.patternId === pattern);
  const U4 = 'kbl-g4-eng-s1-nccd-u4_l1';
  const U5 = 'kbl-g4-eng-s1-nccd-u5_l1';
  const T = G4_TABLES;
  const usedVerbs = new Set<string>();
  const verbs = [...T.pastRows.map(r => r.verb), ...T.irregularRows.map(r => r.verb), ...T.didRows.map(r => r.verb)];
  for (const v of verbs) usedVerbs.add(v);
  const pastKind = (v: string) => (v === 'stop' ? 'تضعيف الحرف الأخير' : PAST_OVERRIDES[v] ? 'شاذ (من الجدول)' : 'منتظم (قاعدة -ed)');
  const tables = [
    dataTable('المقارنات: الجملة الصحيحة وتوأمها الخاطئ', ['الجملة الصحيحة', 'توأمها الخاطئ في «صح أم خطأ»'], sentences(U4, 'cmp').map(s => [s.text, s.claim!.falseText])),
    dataTable('صيغ الصفات', ['الصفة', 'المقارنة', 'التفضيل'], Object.entries(ADJECTIVE_FORMS).map(([a, [c, sup]]) => [a, c, sup])),
    dataTable('الأطعمة: معدودة أم غير معدودة', ['الطعام', 'التصنيف'], [
      ...T.foodPlural.map(f => [f, 'معدود بالجمع: There are a lot of …']),
      ...T.foodUncountable.map(f => [f, 'غير معدود: There\'s a lot of …']),
      ['milkshake', 'مفرد معدود: خارج جمل المقدار'],
    ]),
    dataTable('قواعد must وmustn\'t', ['القاعدة'], [...sentences(U5, 'must'), ...sentences(U5, 'mustnt')].map(s => [s.text])),
    dataTable('البلدان والجنسيات', ['البلد', 'الجنسية'], T.countryRows.map(r => [r.country, r.nat])),
    dataTable('أفعال الماضي', ['الفعل', 'الماضي', 'النوع'], [...usedVerbs].sort().map(v => [v, pastTense(v), pastKind(v)])),
    dataTable('الجدول الدراسي (مخترَع: ليس معلومة)', ['المادة', 'اليوم', 'الساعة'], T.timetable.map(r => [r.subject, r.day, r.time])),
    dataTable('ظروف الحال مع الأفعال', ['الفعل', 'الظرف'], [...T.manner.map(r => [r.act, r.adv]), ...T.well.map(r => [r.act, 'well'])]),
  ];
  return `
  <section class="data">
    <h2>صفحة البيانات: ما يجب أن تتأكدوا منه</h2>
    <p class="meta-line">هذه القوائم هي المعلومات التي تُبنى منها الجمل. إن كان فيها خطأ فكل الجمل المبنية عليه خاطئة.</p>${tables.join('')}
  </section>`;
}

export function renderGrammarReviewHtml(grade = 1): string {
  const copy = GRADE_COPY[grade]!;
  const units = grammarUnitsForGrade(grade);
  const total = units.reduce((n, u) => n + unitSentences(u).length, 0);
  const byLesson = new Map(units.map(u => [u.lessonId, u]));
  const uncovered = NOT_COVERED[grade] ?? {};
  let idx = 0;
  // In the order the lessons come in: a lesson with no unit still gets its page when it has reasons to list.
  const sections = hubLessonsForGrade(grade).flatMap(l => {
    const u = byLesson.get(l.id);
    if (u) return [renderUnit(u, idx++)];
    return uncovered[l.id] ? [renderUncovered(l.id, idx++, uncovered[l.id])] : [];
  }).join('');

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
  }${copy.extraCss}
</style>

<main class="sheet" dir="rtl" lang="ar">
  <section class="intro">
    <div class="eyebrow">${copy.eyebrow}</div>
    <h1>مراجعة جمل القواعد قبل عرضها على الطلاب</h1>
    <p class="lead">${copy.lead(total, units.length)}</p>

    <div class="acts">${copy.acts}</div>

    <div class="card">
      <h3>ما المطلوب في كل جملة</h3>
      <ol>
        ${copy.checks.map(c => `<li>${c}</li>`).join('\n        ')}
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
    <p class="meta-line">«لا يظهر» تعني أن الجملة لا تُستخدم في هذا النشاط (لا توجد صورة واضحة لها). الصور هي الرموز التي تظهر في التطبيق نفسه.</p>${copy.extra ?? ''}
  </section>${grade === 4 ? gradeFourDataPage() : ''}
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
