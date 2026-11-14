/**
 * Grade 5 lessons the operation drills and the other topic modules did not
 * reach, so they had no offline questions (Grade 5 audit, 2026-11-13):
 * mental multiplication, polygons, the statistical question, line graphs and
 * double bar graphs.
 *
 * Same contract as the other topic modules: the lesson title picks the
 * generator and every answer is computed from the numbers in the stem. A graph
 * is given by its values in words («السبت: 18°، الأحد: 21°…»), never as a
 * picture the paper cannot show.
 *
 * The two problem-solving-plan lessons («خطة حل المسألة») stay unserved here;
 * Grades 4, 6 and 7 serve theirs with problems the plan solves.
 */
import { int, numWrongs, pick, tamyiz, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [5, 5], make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const ints = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(Number.isInteger));
const shuffle = <X,>(rng: Rng, xs: readonly X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
/** Three other names from the same list. */
const others = (rng: Rng, ans: string, all: readonly string[]) => shuffle(rng, all.filter(x => x !== ans)).slice(0, 3);

// ─── mental multiplication ─────────────────────────────────────────────────

/** «الضرب الذهني»: multiples of ten and powers of ten, doubling, halving and doubling, the distributive property. */
const mentalMul = T('mental_mul_g5', /^الضرب الذهني$/, ({ rng, diff }) => {
  const k = int(rng, 0, 4);
  if (k === 0) { // a basic fact with zeros: 30 × 400, 25 × 100
    const a = int(rng, 2, 9) * 10 ** int(rng, 0, span(diff, 1, 2, 2));
    const b = (rng() < 0.3 ? int(rng, 11, 25) : int(rng, 2, 9)) * 10 ** int(rng, 1, span(diff, 2, 3, 3));
    const p = a * b;
    return { eq: `${a} × ${b}`, answer: String(p), wrongs: ints(p, [p * 10, p / 10, (a * b) / 100, p + a]), ar: `ما ناتج ${a} × ${b} ذهنيًا؟`, en: `Work out ${a} × ${b} in your head.` };
  }
  if (k === 1) { // the missing factor
    const a = int(rng, 2, 9) * 10 ** int(rng, 1, 2), f = int(rng, 2, 9) * 10 ** int(rng, 0, span(diff, 1, 1, 2)), p = a * f;
    return { eq: `${a} × ؟ = ${p}`, answer: String(f), wrongs: ints(f, [f * 10, f / 10, p / 10, f + 10]), ar: `أكمل بالعدد المناسب: ${a} × ؟ = ${p}`, en: `Fill in the missing number: ${a} × ? = ${p}` };
  }
  if (k === 2) { // double a number: 75 → 150
    const n = span(diff, int(rng, 13, 49), int(rng, 51, 99), int(rng, 105, 499));
    return { eq: `2 × ${n}`, answer: String(2 * n), wrongs: ints(2 * n, [n + 2, 2 * n + 10, 2 * n - 10, n * 20]), ar: `ما ضعف العدد ${n}؟ أوجده ذهنيًا.`, en: `What is double ${n}? Work it out in your head.` };
  }
  if (k === 3) { // halve one factor, double the other: 16 × 25 = 8 × 50 = 4 × 100
    const b = pick(rng, [5, 15, 25, 35, 45, 50]), a = 2 * int(rng, 2, span(diff, 9, 14, 24));
    const p = a * b;
    return { eq: `${a} × ${b}`, answer: String(p), wrongs: ints(p, [(a / 2) * b, a * b * 2, a + b, p + b]), ar: `استعمل التنصيف والمضاعفة لإيجاد ناتج ${a} × ${b} ذهنيًا.`, en: `Use halving and doubling to work out ${a} × ${b} in your head.` };
  }
  // the distributive property: 7 × 43 = 7 × 40 + 7 × 3
  const a = int(rng, 3, 9);
  let b = int(rng, 21, span(diff, 49, 99, 99));
  if (b % 10 === 0) b += 1;
  const p = a * b, tens = b - (b % 10);
  return { eq: `${a} × ${b}`, answer: String(p), wrongs: ints(p, [a * tens + (b % 10), a * tens, p + a, p - a]), ar: `استعمل خاصية التوزيع لإيجاد ناتج ${a} × ${b} ذهنيًا.`, en: `Use the distributive property to work out ${a} × ${b} in your head.` };
});

// ─── polygons ──────────────────────────────────────────────────────────────

const POLY: Array<[number, string, string]> = [
  [4, 'رباعي', 'quadrilateral'], [5, 'خماسي', 'pentagon'], [6, 'سداسي', 'hexagon'],
  [7, 'سباعي', 'heptagon'], [8, 'ثماني', 'octagon'], [9, 'تساعي', 'nonagon'], [10, 'عشاري', 'decagon'],
];
const NOT_POLY = [['دائرة'], ['شكل بيضاوي'], ['نصف دائرة']] as const;
const IS_POLY = ['مثلث', 'مربع', 'مستطيل', 'مضلع خماسي', 'مضلع سداسي', 'معين'];

/** «المضلعات»: a polygon's name and its sides, vertices and perimeter. Four sides and up: a triangle is «مثلث», with its own lessons. */
const polygons = T('polygons_g5', /^المضلعات$/, ({ rng, diff }) => {
  const [n, name, en] = pick(rng, POLY.slice(0, diff === 'easy' ? 4 : 7));
  const k = int(rng, 0, 5);
  if (k === 0) {
    const [shape] = pick(rng, NOT_POLY);
    return { eq: `not ${shape}`, answer: shape, wrongs: shuffle(rng, IS_POLY).slice(0, 3), ar: 'أيّ الأشكال الآتية ليس مضلعًا؟', en: 'Which of these shapes is not a polygon?' };
  }
  if (k === 1) {
    const answer = `مضلع ${name}`;
    return { eq: `name ${n}`, answer, wrongs: others(rng, answer, POLY.map(p => `مضلع ${p[1]}`)), ar: `ما اسم المضلع الذي له ${n} ${tamyiz(n, 'أضلاع', 'ضلعًا', 'ضلع')}؟`, en: `What is the name of a polygon with ${n} sides?` };
  }
  if (k === 2) {
    const s = int(rng, 2, span(diff, 9, 15, 25)), P = n * s;
    return { eq: `P ${n} × ${s}`, answer: String(P), wrongs: ints(P, [n + s, s * (n - 1), s * (n + 1), 4 * s]), ar: `مضلع ${name} منتظم طول ضلعه ${s} سم. ما محيطه بالسنتيمتر؟`, en: `A regular ${en} has sides of ${s} cm. What is its perimeter in centimetres?` };
  }
  if (k === 3) {
    const s = int(rng, 2, span(diff, 9, 15, 25)), P = n * s;
    return { eq: `s ${P} ÷ ${n}`, answer: String(s), wrongs: ints(s, [P - n, s + 1, s - 1, P / 2]), ar: `مضلع ${name} منتظم محيطه ${P} سم. كم سنتيمترًا طول كل ضلع فيه؟`, en: `A regular ${en} has a perimeter of ${P} cm. How long is each side in centimetres?` };
  }
  if (k === 4) return { eq: `vertices ${n}`, answer: String(n), wrongs: ints(n, [n + 1, n - 1, 2 * n, n + 2]), ar: `كم رأسًا في المضلع ال${name}؟`, en: `How many vertices does a ${en} have?` };
  return { eq: `sides ${n}`, answer: String(n), wrongs: ints(n, [n + 1, n - 1, 2 * n, n + 2]), ar: `كم ضلعًا في المضلع ال${name}؟`, en: `How many sides does a ${en} have?` };
});

// ─── the statistical question ───────────────────────────────────────────────

/** Asked of a group, expecting answers that vary. */
const STAT: Array<[string, string]> = [
  ['كم ساعة يقضيها طلاب صفي في القراءة كل أسبوع؟', 'How many hours a week do the students in my class spend reading?'],
  ['ما الرياضة المفضلة لدى طلاب الصف الخامس في مدرستي؟', 'What is the favourite sport of the Grade 5 students at my school?'],
  ['كم أخًا وأختًا لكل واحد من زملائي في الصف؟', 'How many brothers and sisters does each of my classmates have?'],
  ['ما أطوال لاعبي فريق كرة السلة في مدرستي؟', 'How tall are the players on my school basketball team?'],
  ['كم دقيقة يحتاج طلاب صفي للوصول إلى المدرسة؟', 'How many minutes do the students in my class take to get to school?'],
  ['ما الفاكهة المفضلة لدى أفراد عائلتي؟', 'What is the favourite fruit of the people in my family?'],
  ['كم كتابًا قرأ كل طالب من طلاب صفي هذا الشهر؟', 'How many books did each student in my class read this month?'],
  ['ما أعمار سكان العمارة التي أسكن فيها؟', 'How old are the people living in my building?'],
];
/** About one person or one fact: a single answer. */
const NON: Array<[string, string]> = [
  ['كم ساعة نمتُ الليلة الماضية؟', 'How many hours did I sleep last night?'],
  ['ما الرياضة المفضلة لدى صديقي أحمد؟', 'What is my friend Ahmad\'s favourite sport?'],
  ['كم أخًا لي؟', 'How many brothers do I have?'],
  ['ما طول معلّمي؟', 'How tall is my teacher?'],
  ['كم دقيقة استغرقتُ اليوم للوصول إلى المدرسة؟', 'How many minutes did it take me to get to school today?'],
  ['ما عاصمة الأردن؟', 'What is the capital of Jordan?'],
  ['كم يومًا في الأسبوع؟', 'How many days are there in a week?'],
  ['كم كتابًا قرأتُ هذا الشهر؟', 'How many books did I read this month?'],
  ['ما عمر أخي؟', 'How old is my brother?'],
];
const SURVEYS: Array<{ q: string; qEn: string; opts: Array<[string, string]> }> = [
  { q: 'ما لونك المفضّل؟', qEn: 'What is your favourite colour?', opts: [['أزرق', 'blue'], ['أحمر', 'red'], ['أخضر', 'green'], ['أصفر', 'yellow']] },
  { q: 'ما فاكهتك المفضّلة؟', qEn: 'What is your favourite fruit?', opts: [['تفاح', 'apples'], ['موز', 'bananas'], ['برتقال', 'oranges'], ['عنب', 'grapes']] },
  { q: 'ما رياضتك المفضّلة؟', qEn: 'What is your favourite sport?', opts: [['كرة القدم', 'football'], ['السباحة', 'swimming'], ['الجري', 'running'], ['كرة السلة', 'basketball']] },
];

/** «السؤال الإحصائي»: telling one from a question with a single answer, and reading the answers collected. */
const statQuestion = T('stat_question_g5', /^السؤال الاحصائي$/, ({ rng, diff }) => {
  const k = int(rng, 0, 2);
  if (k === 0) {
    const [q] = pick(rng, STAT);
    return { eq: `pick ${q}`, answer: q, wrongs: shuffle(rng, NON).slice(0, 3).map(x => x[0]), ar: 'أيّ الأسئلة الآتية سؤال إحصائي؟', en: 'Which of these is a statistical question?' };
  }
  if (k === 1) {
    const yes = rng() < 0.5, [q, qEn] = pick(rng, yes ? STAT : NON);
    return { eq: `is ${q}`, answer: yes ? 'نعم' : 'لا', wrongs: [yes ? 'لا' : 'نعم'], ar: `هل السؤال «${q}» سؤال إحصائي؟ (نعم / لا)`, en: `Is "${qEn}" a statistical question? (yes / no)` };
  }
  const s = pick(rng, SURVEYS), opts = shuffle(rng, s.opts);
  const top = int(rng, 4, span(diff, 5, 6, 7));
  const counts = opts.map((_, i) => (i === 0 ? top : int(rng, 1, top - 1)));
  const answers = shuffle(rng, opts.flatMap((o, i) => Array.from({ length: counts[i]! }, () => o)));
  const girl = pick(rng, ['سلمى', 'ليلى', 'جود', 'تالا']);
  return {
    eq: `mode ${answers.map(a => a[0]).join(',')}`, answer: opts[0]![0], wrongs: opts.slice(1).map(o => o[0]),
    ar: `سألت ${girl} زميلاتها: «${s.q}» فكانت الإجابات: ${answers.map(a => a[0]).join('، ')}. ما الإجابة الأكثر تكرارًا؟`,
    en: `A pupil asked her classmates «${s.qEn}» and the answers were: ${answers.map(a => a[1]).join(', ')}. Which answer was given most often?`,
  };
});

// ─── line graphs ───────────────────────────────────────────────────────────

const DAYS: Array<[string, string]> = [['السبت', 'Saturday'], ['الأحد', 'Sunday'], ['الاثنين', 'Monday'], ['الثلاثاء', 'Tuesday'], ['الأربعاء', 'Wednesday'], ['الخميس', 'Thursday']];
const MONTHS: Array<[string, string]> = [['أيلول', 'September'], ['تشرين الأول', 'October'], ['تشرين الثاني', 'November'], ['كانون الأول', 'December'], ['كانون الثاني', 'January'], ['شباط', 'February']];
const WEEKS: Array<[string, string]> = [['الأسبوع الأول', 'week 1'], ['الأسبوع الثاني', 'week 2'], ['الأسبوع الثالث', 'week 3'], ['الأسبوع الرابع', 'week 4'], ['الأسبوع الخامس', 'week 5'], ['الأسبوع السادس', 'week 6']];
/** `n` values in [lo, hi] with one highest, one lowest and one largest step up from the point before. */
function points(rng: Rng, n: number, lo: number, hi: number): number[] {
  let v: number[] = [];
  for (let t = 0; t < 500; t++) {
    v = Array.from({ length: n }, () => int(rng, lo, hi));
    const rises = v.slice(1).map((x, i) => x - v[i]!), best = Math.max(...rises);
    const one = (x: number) => v.filter(y => y === x).length === 1;
    if (best > 0 && rises.filter(r => r === best).length === 1 && one(Math.max(...v)) && one(Math.min(...v))) return v;
  }
  return Array.from({ length: n }, (_, i) => lo + (i * (i + 1)) / 2); // strictly rising by 1, 2, 3…: one of each, inside [lo, hi]
}

/**
 * «التمثيل بالخطوط»: a line graph read from its points. Each kind has its own
 * story (a week's temperatures, a library's visitors, a plant's height), so a
 * paper is not four questions under one paragraph.
 */
const lineGraph = T('line_graph_g5', /^التمثيل بالخطوط$/, ({ rng, diff }) => {
  const n = span(diff, 5, 5, 6);
  const k = int(rng, 0, 2);
  if (k === 0) { // temperatures: the hottest or the coldest day
    const days = DAYS.slice(0, n), v = points(rng, n, 12, 34), names = days.map(d => d[0]);
    const hot = rng() < 0.5, i = v.indexOf(hot ? Math.max(...v) : Math.min(...v));
    return {
      eq: `${hot ? 'max' : 'min'} ${v.join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names),
      ar: `يبيّن تمثيل بالخطوط درجات الحرارة العظمى في مدينة إربد خلال ${n} أيام: ${days.map((d, j) => `${d[0]}: ${v[j]}°`).join('، ')}. في أيّ يوم كانت ${hot ? 'أعلى' : 'أدنى'} درجة حرارة؟`,
      en: `A line graph shows the highest temperature in Irbid over ${n} days: ${days.map((d, j) => `${d[1]}: ${v[j]}°`).join(', ')}. On which day was it ${hot ? 'hottest' : 'coldest'}?`,
    };
  }
  if (k === 1) { // a library's visitors: the biggest rise from one month to the next
    const months = MONTHS.slice(0, n), v = points(rng, n, 40, 150), names = months.map(m => m[0]);
    const rises = v.slice(1).map((x, j) => x - v[j]!), i = rises.indexOf(Math.max(...rises));
    const pairs = names.slice(1).map((x, j) => `من ${names[j]} إلى ${x}`);
    return {
      eq: `rise ${v.join(',')}`, answer: pairs[i]!, wrongs: others(rng, pairs[i]!, pairs),
      ar: `مثّلت مكتبة المدرسة عدد زوارها في ${n} أشهر بالخطوط: ${months.map((m, j) => `${m[0]}: ${v[j]}`).join('، ')}. بين أيّ شهرين متتاليين كانت أكبر زيادة في عدد الزوار؟`,
      en: `The school library drew a line graph of its visitors over ${n} months: ${months.map((m, j) => `${m[1]}: ${v[j]}`).join(', ')}. Between which two months in a row did the number of visitors rise the most?`,
    };
  }
  // a plant's height, which only grows: how much between two weeks
  const weeks = WEEKS.slice(0, n), v: number[] = [];
  for (let j = 0, h = int(rng, 2, 6); j < n; j++) { v.push(h); h += int(rng, 1, span(diff, 3, 4, 6)); }
  const a = int(rng, 0, n - 2), b = int(rng, a + 1, n - 1), d = v[b]! - v[a]!;
  return {
    eq: `grow ${v[a]}, ${v[b]}`, answer: String(d), wrongs: ints(d, [v[a]! + v[b]!, v[b]!, d + 1, d - 1]),
    ar: `قاست سلمى طول نبتة كل أسبوع ومثّلته بالخطوط: ${weeks.map((w, j) => `${w[0]}: ${v[j]} سم`).join('، ')}. كم سنتيمترًا زاد طول النبتة بين ${weeks[a]![0]} و${weeks[b]![0]}؟`,
    en: `Salma measured a plant every week and drew a line graph: ${weeks.map((w, j) => `${w[1]}: ${v[j]} cm`).join(', ')}. By how many centimetres did the plant grow between ${weeks[a]![1]} and ${weeks[b]![1]}?`,
  };
});

// ─── double bar graphs ─────────────────────────────────────────────────────

/** Four categories, two series; the gaps are distinct and non-zero, and exactly one category leans the other way. */
function pairs(rng: Rng, diff: D) {
  const gaps = shuffle(rng, [1, 2, 3, 4, 5, 6, 7]).slice(0, 4);
  const odd = int(rng, 0, 3), firstLeads = rng() < 0.5; // in the odd category the first series is ahead iff firstLeads
  return gaps.map((g, i) => {
    const base = int(rng, 3, span(diff, 9, 12, 15)), ahead = i === odd ? firstLeads : !firstLeads;
    return ahead ? [base + g, base] as const : [base, base + g] as const;
  });
}

const SPORTS: Array<[string, string]> = [['كرة القدم', 'football'], ['كرة السلة', 'basketball'], ['السباحة', 'swimming'], ['الجري', 'running'], ['الكرة الطائرة', 'volleyball'], ['تنس الطاولة', 'table tennis']];
const SUBJECTS: Array<[string, string]> = [['الرياضيات', 'maths'], ['العلوم', 'science'], ['اللغة العربية', 'Arabic'], ['التربية الفنية', 'art'], ['اللغة الإنجليزية', 'English']];
const TRANSPORT: Array<[string, string]> = [['الحافلة', 'the bus'], ['المشي', 'walking'], ['السيارة', 'a car'], ['الدراجة', 'a bicycle']];

/**
 * «التمثيل بالأعمدة المزدوجة»: two bars per category. Each kind has its own
 * story, as in the line graphs.
 */
const doubleBar = T('double_bar_g5', /^التمثيل بالاعمده المزدوجه$/, ({ rng, diff }) => {
  const k = int(rng, 0, 3);
  const row = (label: string, s1: string, a: number, s2: string, b: number) => `${label}: ${s1} ${a} و${s2} ${b}`;
  if (k === 0) { // boys and girls by sport: a category's total
    const cats = shuffle(rng, SPORTS).slice(0, 4), v = pairs(rng, diff), i = int(rng, 0, 3), t = v[i]![0] + v[i]![1];
    return {
      eq: `total ${v[i]!.join(' + ')}`, answer: String(t), wrongs: ints(t, [Math.abs(v[i]![0] - v[i]![1]), v[i]![0], v[i]![1], t + 1]),
      ar: `يبيّن تمثيل بالأعمدة المزدوجة عدد الطلاب والطالبات الذين يفضّلون كل رياضة: ${cats.map((c, j) => row(c[0], 'الطلاب', v[j]![0], 'الطالبات', v[j]![1])).join('؛ ')}. كم طالبًا وطالبة يفضّلون ${cats[i]![0]}؟`,
      en: `A double bar graph shows how many boys and girls prefer each sport: ${cats.map((c, j) => `${c[1]}: boys ${v[j]![0]}, girls ${v[j]![1]}`).join('; ')}. How many boys and girls altogether prefer ${cats[i]![1]}?`,
    };
  }
  if (k === 1) { // two class sections by favourite subject: the gap in one subject
    const cats = shuffle(rng, SUBJECTS).slice(0, 4), v = pairs(rng, diff), i = int(rng, 0, 3);
    const aHead = v[i]![0] > v[i]![1], d = Math.abs(v[i]![0] - v[i]![1]);
    const [more, less] = aHead ? ['أ', 'ب'] : ['ب', 'أ'];
    return {
      eq: `gap ${v[i]!.join(', ')}`, answer: String(d), wrongs: ints(d, [v[i]![0] + v[i]![1], Math.max(...v[i]!), d + 1, d - 1]),
      ar: `مثّل معلم الصف الخامس بالأعمدة المزدوجة المادة المفضلة لدى طلاب الشعبتين: ${cats.map((c, j) => row(c[0], 'الشعبة أ', v[j]![0], 'الشعبة ب', v[j]![1])).join('؛ ')}. بكم يزيد عدد طلاب الشعبة ${more} الذين يفضّلون ${cats[i]![0]} على عدد طلاب الشعبة ${less}؟`,
      en: `A Grade 5 teacher drew a double bar graph of the favourite subject in two sections: ${cats.map((c, j) => `${c[1]}: section A ${v[j]![0]}, section B ${v[j]![1]}`).join('; ')}. How many more pupils in section ${aHead ? 'A' : 'B'} than in section ${aHead ? 'B' : 'A'} prefer ${cats[i]![1]}?`,
    };
  }
  if (k === 2) { // last year and this year by way to school: the widest change
    const cats = shuffle(rng, TRANSPORT), v = pairs(rng, diff), names = cats.map(c => c[0]);
    const d = v.map(p => Math.abs(p[0] - p[1])), i = d.indexOf(Math.max(...d));
    return {
      eq: `widest ${d.join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names),
      ar: `يبيّن تمثيل بالأعمدة المزدوجة عدد الطلاب الذين يأتون إلى المدرسة بكل وسيلة في عامين: ${cats.map((c, j) => row(c[0], 'العام الماضي', v[j]![0], 'هذا العام', v[j]![1])).join('؛ ')}. أيّ وسيلة كان الفرق في عدد مستعمليها بين العامين هو الأكبر؟`,
      en: `A double bar graph shows how many pupils came to school each way in two years: ${cats.map((c, j) => `${c[1]}: last year ${v[j]![0]}, this year ${v[j]![1]}`).join('; ')}. For which way did the number of pupils change the most?`,
    };
  }
  // two sections' reading, month by month: the one month the other section read more
  const cats = MONTHS.slice(0, 4), v = pairs(rng, diff), names = cats.map(c => c[0]);
  const aLead = v.filter(p => p[0] > p[1]).length === 1, i = v.findIndex(p => (aLead ? p[0] > p[1] : p[1] > p[0]));
  return {
    eq: `lead ${v.map(p => p.join('/')).join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names),
    ar: `مثّلت مكتبة المدرسة بالأعمدة المزدوجة عدد الكتب التي استعارتها شعبتا الصف الخامس في كل شهر: ${cats.map((c, j) => row(c[0], 'الشعبة أ', v[j]![0], 'الشعبة ب', v[j]![1])).join('؛ ')}. في أيّ شهر استعارت الشعبة ${aLead ? 'أ' : 'ب'} كتبًا أكثر من الشعبة ${aLead ? 'ب' : 'أ'}؟`,
    en: `The school library drew a double bar graph of the books two Grade 5 sections borrowed each month: ${cats.map((c, j) => `${c[1]}: section A ${v[j]![0]}, section B ${v[j]![1]}`).join('; ')}. In which month did section ${aLead ? 'A' : 'B'} borrow more books than section ${aLead ? 'B' : 'A'}?`,
  };
});

// ─── the two problem-solving-plan lessons (Grade 5 review, 2026-11-14) ─────────
//
// Both follow the student book's worked example and «أتدرب» problems: S1 pp. 24-25 («أنشئ جدولًا»: a ratio table of
// green and red balls up to 24, bunches of flowers, shirts and caps, ways to pay 50 piastres) and S2 pp. 56-57
// («أرسم نموذجًا»: a bar model becomes «x + 11 = 27»; a bill that fell by 3 dinars; 336 km in 3 hours; five whales).

const counted = (n: number, plural: string, acc: string, gen: string) => `${n} ${tamyiz(n, plural, acc, gen)}`;

/** «خطة حل المسألة: أنشئ جدولًا»: a ratio table, a growing daily pattern, outfits, and ways to pay with two coins. */
const makeTable = T('make_table_g5', /^خطه حل المساله انشئ جدولا$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) {
    // for every a green there are b red; T in all = n(a + b); red = nb
    const a = int(rng, 1, 3), b = int(rng, Math.max(3, a + 1), 5), n = int(rng, 3, span(diff, 5, 8, 12)); // b ≥ 3: «2 كرةً» is wrong
    const total = n * (a + b), red = n * b;
    return {
      eq: `table ${a}:${b} of ${total}`, answer: String(red), wrongs: ints(red, [n * a, total - n * a + a, red + b, total / b]),
      ar: `في صندوق كرات خضراء وحمراء، ومقابل كل ${a === 1 ? 'كرة خضراء واحدة' : a === 2 ? 'كرتين خضراوين' : counted(a, 'كرات خضراء', 'كرةً خضراء', 'كرة خضراء')} توجد ${counted(b, 'كرات حمراء', 'كرةً حمراء', 'كرة حمراء')}. إذا كان في الصندوق ${counted(total, 'كرات', 'كرةً', 'كرة')}، فكم كرةً حمراء فيه؟`,
      en: `A box holds green and red balls: for every ${a} green there are ${b} red. If the box holds ${total} balls, how many are red?`,
    };
  }
  if (k === 1) {
    // a daily amount that grows by the same step: day n is s + (n − 1)d
    const s = int(rng, 3, 10), d = int(rng, 3, 6), n = int(rng, 5, span(diff, 7, 10, 14));
    const ans = s + (n - 1) * d;
    return {
      eq: `grow ${s} +${d} day ${n}`, answer: String(ans), wrongs: ints(ans, [s + n * d, s * n, (n - 1) * d, ans + d]),
      ar: `ادّخرت هند في اليوم الأول ${counted(s, 'قروش', 'قرشًا', 'قرش')}، وتدّخر كل يوم ${counted(d, 'قروش', 'قرشًا', 'قرش')} أكثر مما ادّخرته في اليوم الذي قبله. كم قرشًا تدّخر في اليوم ${n}؟`,
      en: `Hind saves ${s} piastres on the first day and ${d} piastres more each day than the day before. How many piastres does she save on day ${n}?`,
    };
  }
  if (k === 2) {
    const a = int(rng, 3, span(diff, 4, 6, 8)), b = int(rng, 3, span(diff, 4, 5, 7));
    const ans = a * b;
    return {
      eq: `outfits ${a} × ${b}`, answer: String(ans), wrongs: ints(ans, [a + b, ans - 1, ans + a, 2 * (a + b)]),
      ar: `لدى أحمد ${counted(a, 'قمصان', 'قميصًا', 'قميص')} و${counted(b, 'قبعات', 'قبعةً', 'قبعة')}. بكم طريقة مختلفة يمكنه أن يلبس قميصًا وقبعة؟`,
      en: `Ahmad has ${a} shirts and ${b} caps. In how many different ways can he wear one shirt and one cap?`,
    };
  }
  // ways to pay N piastres with 5- and 10-piastre coins: y tens for y = 0 … N/10, the rest in fives
  const N = 10 * int(rng, 2, span(diff, 4, 6, 9));
  const ans = N / 10 + 1;
  return {
    eq: `coins ${N}`, answer: String(ans), wrongs: ints(ans, [N / 10, N / 5, N / 5 + 1, ans + 1]),
    ar: `بكم طريقة يمكن دفع ${counted(N, 'قروش', 'قرشًا', 'قرش')} باستعمال قطع نقدية من فئة 5 قروش وفئة 10 قروش فقط؟`,
    en: `In how many ways can ${N} piastres be paid using only 5-piastre and 10-piastre coins?`,
  };
});

/** «خطة حل المسألة (أرسم نموذجًا)»: a bar model turned into an equation, as on S2 p. 56. */
const drawModel = T('draw_model_g5', /^خطه حل المساله \(ارسم نموذجا\)$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) {
    // x + a = b
    const b = int(rng, 20, span(diff, 50, 90, 150)), a = int(rng, 5, b - 5);
    const ans = b - a;
    return {
      eq: `model x + ${a} = ${b}`, answer: String(ans), wrongs: ints(ans, [a + b, a, ans + 10, ans - 1]),
      ar: `جمع سعيد ${counted(b, 'قطع', 'قطعةً', 'قطعة')} من الملابس لجمعية خيرية، وجمع خالد عددًا أقل منه بمقدار ${counted(a, 'قطع', 'قطعةً', 'قطعة')}. كم قطعةً جمع خالد؟`,
      en: `Saeed collected ${b} pieces of clothing for a charity, and Khaled collected ${a} fewer. How many pieces did Khaled collect?`,
    };
  }
  if (k === 1) {
    // x − a = b: a bill that fell by a to b
    const a = int(rng, 3, 9), b = int(rng, 11, span(diff, 25, 40, 60));
    const ans = a + b;
    return {
      eq: `model x - ${a} = ${b}`, answer: String(ans), wrongs: ints(ans, [b - a, b, ans + a, ans - 1]),
      ar: `انخفضت قيمة فاتورة الكهرباء لعائلة جميل بمقدار ${counted(a, 'دنانير', 'دينارًا', 'دينار')} عن الشهر السابق، فأصبحت ${counted(b, 'دنانير', 'دينارًا', 'دينار')}. كم دينارًا كانت قيمة فاتورة الشهر السابق؟`,
      en: `The Jameel family's electricity bill fell by ${a} JD from last month to ${b} JD. How many JD was last month's bill?`,
    };
  }
  if (k === 2) {
    // h · x = d
    const h = int(rng, 3, 6), x = int(rng, 40, span(diff, 70, 95, 120)), d = h * x;
    return {
      eq: `model ${h}x = ${d}`, answer: String(x), wrongs: ints(x, [d - h, d * h, x + h, x - 1]),
      ar: `قطع فهد ${d} كيلومترًا في ${counted(h, 'ساعات', 'ساعةً', 'ساعة')} بالسرعة نفسها. كم كيلومترًا يقطع في الساعة الواحدة؟`,
      en: `A cheetah covered ${d} km in ${h} hours at the same speed. How many kilometres does it cover in one hour?`,
    };
  }
  if (k === 3) {
    // x = n · m
    const n = int(rng, 3, 9), m = int(rng, 40, span(diff, 60, 90, 120));
    const ans = n * m;
    return {
      eq: `model ${n} × ${m}`, answer: String(ans), wrongs: ints(ans, [n + m, ans + m, ans - m, m * (n + 1) - 1]),
      ar: `كتلة الحوت الزعنفي نحو ${counted(m, 'أطنان', 'طنًا', 'طن')}. كم طنًا يبلغ مجموع كتل ${counted(n, 'حيتان', 'حوتًا', 'حوت')} زعنفية تقريبًا؟`,
      en: `A fin whale has a mass of about ${m} tonnes. About how many tonnes do ${n} fin whales have together?`,
    };
  }
  // the equation a bar model shows
  const a = int(rng, 5, 30), b = a + int(rng, 5, 40);
  const ans = `x + ${a} = ${b}`;
  return {
    eq: `which equation ${a} ${b}`, answer: ans, wrongs: [`x − ${a} = ${b}`, `${a} × x = ${b}`, `x + ${b} = ${a}`],
    ar: `رسمت سلمى نموذجًا: شريط طوله ${b} مقسوم إلى جزأين، أحدهما ${a} والآخر مجهول x. أيّ المعادلات الآتية يمثّلها النموذج؟`,
    en: `Salma drew a bar of length ${b} split into two parts, ${a} and an unknown x. Which equation does the model show?`,
  };
});

export const G5_TOPICS: readonly Topic[] = [mentalMul, polygons, statQuestion, lineGraph, doubleBar, makeTable, drawModel];

