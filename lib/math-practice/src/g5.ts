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
 * The two problem-solving-plan lessons («خطة حل المسألة») stay unserved, as in
 * Grades 3 and 4: they teach a method, which a question bank cannot drill.
 */
import { int, numWrongs, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

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
  [3, 'ثلاثي', 'triangle'], [4, 'رباعي', 'quadrilateral'], [5, 'خماسي', 'pentagon'], [6, 'سداسي', 'hexagon'],
  [7, 'سباعي', 'heptagon'], [8, 'ثماني', 'octagon'], [9, 'تساعي', 'nonagon'], [10, 'عشاري', 'decagon'],
];
const NOT_POLY = [['دائرة'], ['شكل بيضاوي'], ['نصف دائرة']] as const;
const IS_POLY = ['مثلث', 'مربع', 'مستطيل', 'مضلع خماسي', 'مضلع سداسي', 'معين'];

/** «المضلعات»: a polygon's name and its sides, vertices and perimeter. */
const polygons = T('polygons_g5', /^المضلعات$/, ({ rng, diff }) => {
  const [n, name, en] = pick(rng, POLY.slice(diff === 'easy' ? 1 : 0, diff === 'easy' ? 5 : 8));
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
    return { eq: `is ${q}`, answer: yes ? 'نعم' : 'لا', wrongs: [yes ? 'لا' : 'نعم'], ar: `هل السؤال «${q}» سؤال إحصائي؟ (نعم / لا)`, en: `Is «${qEn}» a statistical question? (yes / no)` };
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

/** «التمثيل بالخطوط»: a week's temperatures read from the points of the line. */
const lineGraph = T('line_graph_g5', /^التمثيل بالخطوط$/, ({ rng, diff }) => {
  const n = span(diff, 5, 5, 6), days = DAYS.slice(0, n);
  // values with one highest, one lowest, and one largest day-to-day rise
  let v: number[] = [];
  for (let t = 0; t < 200; t++) {
    v = Array.from({ length: n }, () => int(rng, 12, 34));
    const rises = v.slice(1).map((x, i) => x - v[i]!), best = Math.max(...rises);
    if (best > 0 && rises.filter(r => r === best).length === 1 && v.filter(x => x === Math.max(...v)).length === 1 && v.filter(x => x === Math.min(...v)).length === 1) break;
  }
  const list = days.map((d, i) => `${d[0]}: ${v[i]}°`).join('، '), listEn = days.map((d, i) => `${d[1]}: ${v[i]}°`).join(', ');
  const head = `يبيّن تمثيل بالخطوط درجات الحرارة العظمى في مدينة إربد خلال ${n} أيام، وقراءات نقاطه هي: ${list}. `;
  const headEn = `A line graph shows the highest temperature in Irbid over ${n} days; its points read: ${listEn}. `;
  const names = days.map(d => d[0]);
  const k = int(rng, 0, 3);
  if (k === 0) { const i = v.indexOf(Math.max(...v)); return { eq: `max ${v.join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names), ar: `${head}في أيّ يوم كانت أعلى درجة حرارة؟`, en: `${headEn}On which day was it hottest?` }; }
  if (k === 1) { const i = v.indexOf(Math.min(...v)); return { eq: `min ${v.join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names), ar: `${head}في أيّ يوم كانت أدنى درجة حرارة؟`, en: `${headEn}On which day was it coldest?` }; }
  if (k === 2) {
    const rises = v.slice(1).map((x, i) => x - v[i]!), i = rises.indexOf(Math.max(...rises));
    const pairs = names.slice(1).map((x, j) => `من ${names[j]} إلى ${x}`);
    return { eq: `rise ${v.join(',')}`, answer: pairs[i]!, wrongs: others(rng, pairs[i]!, pairs), ar: `${head}بين أيّ يومين متتاليين كان أكبر ارتفاع في درجة الحرارة؟`, en: `${headEn}Between which two days in a row did the temperature rise the most?` };
  }
  let a = 0, b = 1;
  for (let t = 0; t < 50; t++) { a = int(rng, 0, n - 2); b = int(rng, a + 1, n - 1); if (v[a] !== v[b]) break; }
  if (v[a] === v[b]) v[b] = v[b]! + 3; // still a distinct reading
  const d = Math.abs(v[b]! - v[a]!);
  const listB = days.map((x, i) => `${x[0]}: ${v[i]}°`).join('، ');
  return { eq: `change ${v[a]}, ${v[b]}`, answer: String(d), wrongs: ints(d, [v[a]! + v[b]!, d + 1, d - 1, Math.max(v[a]!, v[b]!)]), ar: `يبيّن تمثيل بالخطوط درجات الحرارة العظمى في مدينة إربد خلال ${n} أيام، وقراءات نقاطه هي: ${listB}. بكم درجة اختلفت درجة الحرارة بين ${names[a]} و${names[b]}؟`, en: `A line graph shows the highest temperature in Irbid over ${n} days; its points read: ${days.map((x, i) => `${x[1]}: ${v[i]}°`).join(', ')}. By how many degrees did the temperature differ between ${days[a]![1]} and ${days[b]![1]}?` };
});

// ─── double bar graphs ─────────────────────────────────────────────────────

const SPORTS: Array<[string, string]> = [['كرة القدم', 'football'], ['كرة السلة', 'basketball'], ['السباحة', 'swimming'], ['الجري', 'running'], ['الكرة الطائرة', 'volleyball'], ['تنس الطاولة', 'table tennis']];

/** «التمثيل بالأعمدة المزدوجة»: two bars per sport, boys and girls. */
const doubleBar = T('double_bar_g5', /^التمثيل بالاعمده المزدوجه$/, ({ rng, diff }) => {
  const sports = shuffle(rng, SPORTS).slice(0, 4);
  // distinct, non-zero gaps: one widest; exactly one sport leans the other way
  const gaps = shuffle(rng, [1, 2, 3, 4, 5, 6, 7]).slice(0, 4);
  const odd = int(rng, 0, 3), girlsLead = rng() < 0.5; // the one sport where the minority side is ahead
  const rows = sports.map((s, i) => {
    const base = int(rng, 3, span(diff, 9, 12, 15)), up = base + gaps[i]!;
    const girlsAhead = i === odd ? girlsLead : !girlsLead;
    return { s, boys: girlsAhead ? base : up, girls: girlsAhead ? up : base };
  });
  const table = rows.map(r => `${r.s[0]}: الطلاب ${r.boys} والطالبات ${r.girls}`).join('؛ ');
  const tableEn = rows.map(r => `${r.s[1]}: boys ${r.boys}, girls ${r.girls}`).join('; ');
  const head = `يبيّن تمثيل بالأعمدة المزدوجة عدد الطلاب والطالبات الذين يفضّلون كل رياضة في مدرسة: ${table}. `;
  const headEn = `A double bar graph shows how many boys and girls at a school prefer each sport: ${tableEn}. `;
  const names = rows.map(r => r.s[0]);
  const k = int(rng, 0, 3);
  if (k === 0) {
    const r = pick(rng, rows), t = r.boys + r.girls;
    return { eq: `total ${r.boys} + ${r.girls}`, answer: String(t), wrongs: ints(t, [Math.abs(r.boys - r.girls), r.boys, r.girls, t + 1]), ar: `${head}كم طالبًا وطالبة يفضّلون ${r.s[0]}؟`, en: `${headEn}How many boys and girls altogether prefer ${r.s[1]}?` };
  }
  if (k === 1) {
    const r = pick(rng, rows), d = Math.abs(r.boys - r.girls), girls = r.girls > r.boys;
    return { eq: `diff ${r.boys}, ${r.girls}`, answer: String(d), wrongs: ints(d, [r.boys + r.girls, d + 1, d - 1, Math.max(r.boys, r.girls)]), ar: `${head}بكم يزيد عدد ${girls ? 'الطالبات' : 'الطلاب'} على عدد ${girls ? 'الطلاب' : 'الطالبات'} الذين يفضّلون ${r.s[0]}؟`, en: `${headEn}How many more ${girls ? 'girls than boys' : 'boys than girls'} prefer ${r.s[1]}?` };
  }
  if (k === 2) {
    const d = rows.map(r => Math.abs(r.boys - r.girls)), i = d.indexOf(Math.max(...d));
    return { eq: `widest ${d.join(',')}`, answer: names[i]!, wrongs: others(rng, names[i]!, names), ar: `${head}في أيّ رياضة يوجد أكبر فرق بين عدد الطلاب وعدد الطالبات؟`, en: `${headEn}For which sport is the gap between boys and girls the widest?` };
  }
  return { eq: `lead ${girlsLead ? 'girls' : 'boys'}`, answer: names[odd]!, wrongs: others(rng, names[odd]!, names), ar: `${head}في أيّ رياضة كان عدد ${girlsLead ? 'الطالبات أكثر من عدد الطلاب' : 'الطلاب أكثر من عدد الطالبات'}؟`, en: `${headEn}For which sport did more ${girlsLead ? 'girls than boys' : 'boys than girls'} choose it?` };
});

export const G5_TOPICS: readonly Topic[] = [mentalMul, polygons, statQuestion, lineGraph, doubleBar];

void wrongsFrom;
