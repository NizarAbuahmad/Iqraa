/**
 * Six Grades 2–9 maths lessons that drew another lesson's or another grade's questions. Their
 * ready-made sheets were held back after the hand review of 2026-11-20 and were still wrong on
 * 2026-11-27 (`HELD_BACK` in `artifacts/mobile/scripts/build-premade-sheets.ts`):
 *
 *   • «الشبكات والضرب» (G2 u6_l3) drew the shared `mul` bank: one grid question in ten;
 *   • «ضرب الأعداد» (G4 u2_l3), whose objectives are 3-digit × 1-digit and 2-digit × 2-digit,
 *     drew repeated addition and division facts, and no 2-digit × 2-digit at all;
 *   • «ضرب الكسور» (G5 u4_l5) asked for missing factors, which need the next lesson's division;
 *   • «ضرب الأعداد العشرية وقسمتها» (G5 u6_l7: «في 10, 100, 1000») multiplied decimals by
 *     decimals, Grade 6's lesson;
 *   • «كتابة العدد النسبي بالصورة العشرية» (G7 u1_l2) shared `frac_dec`: seven in ten were
 *     «العدد النسبي» (u1_l1) questions — consecutive integers, improper fractions;
 *   • «المدرجات التكرارية» (G9 u8_l3) shared `grouped_g9` with the grouped-table lesson before
 *     it: eight in ten were tables, no histogram and no frequency density.
 *
 * One generator per lesson, matched by the lesson's own title and grade only, so no other lesson
 * moves. Same contract as the other topic modules: every answer is computed from the numbers
 * printed in its own stem (`__tests__/heldBackLessons.test.ts` recomputes each).
 */
import { gcd, int, numWrongs, pick, sfrac, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';
import { fmtDec } from './elementary.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D }) => Draft;
const T = (id: string, match: RegExp, grade: number, make: Gen): Topic => ({ id, match, grades: [grade, grade], make: c => make(c as { rng: Rng; diff: D }) });
const span = <X,>(diff: D, a: X, b: X, c: X): X => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
/** Integer options, never negative and never the answer. */
const nw = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(Number.isInteger));
/** A proper fraction n/d in lowest terms, d in [2, hi]. */
const proper = (rng: Rng, hi: number): [number, number] => {
  for (;;) { const d = int(rng, 2, hi), n = int(rng, 1, d - 1); if (gcd(n, d) === 1) return [n, d]; }
};

// ─── G2 «الشبكات والضرب»: a product found from a grid ───────────────────────────────────────

const rowsW = (n: number) => `${n} ${tamyiz(n, 'صفوف', 'صفًّا', 'صف')}`;
const squaresW = (n: number) => `${n} ${tamyiz(n, 'مربعات', 'مربعًا', 'مربع')}`;
const treesW = (n: number) => `${n} ${tamyiz(n, 'أشجار', 'شجرةً', 'شجرة')}`;

const gridsG2 = T('grids_g2', /^الشبكات والضرب$/, 2, ({ rng, diff }) => {
  const r = int(rng, 3, 5), c = int(rng, 3, span(diff, 5, 6, 10)), total = r * c;
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) {
    // the grid itself, drawn: a child counts it or multiplies rows by squares
    const cc = Math.min(c, 6), t = r * cc;
    const grid = Array.from({ length: r }, () => Array(cc).fill('■').join(' ')).join('\n');
    return { eq: `grid ${r}x${cc}`, answer: String(t), wrongs: nw(t, [r + cc, t + cc, t - cc, r * (cc + 1)]).map(String), ar: `كم مربعًا في الشبكة الآتية؟\n${grid}`, en: `How many squares are in this grid?\n${grid}` };
  }
  const head = `شبكة مربعات فيها ${rowsW(r)}، في كل صف ${squaresW(c)}`;
  if (k === 1) return { eq: `${r} × ${c}`, answer: String(total), wrongs: nw(total, [r + c, total + c, total - r, r * (c + 1)]).map(String), ar: `${head}. كم مربعًا في الشبكة؟`, en: `A grid has ${r} rows of ${c} squares. How many squares are there?` };
  if (k === 2) {
    // which multiplication sentence the grid shows: the choices are in the question
    const ans = `${r} × ${c}`, wrongs = [`${r} + ${c}`, `${r} × ${c + 1}`, `${r + 1} × ${c}`], shown = shuffle(rng, [ans, ...wrongs]);
    return { eq: `sentence ${r}x${c}`, answer: ans, wrongs, ar: `أيّ جملة ضرب تمثّل ${head}: ${shown.join('، ')}؟`, en: `Which multiplication sentence shows a grid of ${r} rows of ${c} squares: ${shown.join(', ')}?` };
  }
  if (k === 3) return { eq: `trees ${r} × ${c}`, answer: String(total), wrongs: nw(total, [r + c, total + c, total - c, (r + 1) * c]).map(String), ar: `زُرعت أشجار في بستان على شكل شبكة: ${rowsW(r)}، في كل صف ${treesW(c)}. كم شجرة في البستان؟`, en: `Trees are planted in a grid of ${r} rows of ${c}. How many trees are there?` };
  // the squares are known, and how many rows: how many in each row
  return { eq: `${total} ÷ ${r}`, answer: String(c), wrongs: nw(c, [r, total - r, c + 1, c - 1]).map(String), ar: `شبكة فيها ${squaresW(total)} موزّعة على ${rowsW(r)} متساوية. كم مربعًا في كل صف؟`, en: `A grid of ${total} squares has ${r} equal rows. How many squares are in each row?` };
});

// ─── G4 «ضرب الأعداد»: 3 digits × 1, and 2 digits × 2 ─────────────────────────────────────

const pensW = (n: number) => `${n} ${tamyiz(n, 'أقلام', 'قلمًا', 'قلم')}`;
const boxesW = (n: number) => `${n} ${tamyiz(n, 'صناديق', 'صندوقًا', 'صندوق')}`;

const mulG4 = T('mul_g4', /^ضرب الاعداد$/, 4, ({ rng, diff }) => {
  const k = pick(rng, [0, 0, 1, 1, 2, 3]);
  const threeByOne = k === 0 || k === 2;
  const a = threeByOne ? int(rng, span(diff, 100, 120, 200), span(diff, 499, 999, 999)) : int(rng, 11, span(diff, 30, 60, 99));
  const b = threeByOne ? int(rng, k === 2 ? 3 : 2, span(diff, 5, 9, 9)) : int(rng, 11, span(diff, 20, 40, 99));
  const p = a * b;
  // the slips the lesson warns about: a carry dropped, the tens product not shifted
  const unshifted = a * (b % 10) + a * Math.floor(b / 10);
  const wrongs = nw(p, [unshifted, p + 10, p - 10, a * (b - 1), p + a]).map(String);
  if (k === 2) return { eq: `${b} × ${a}`, answer: String(p), wrongs, ar: `في مخزن ${boxesW(b)}، في كل صندوق ${pensW(a)}. كم قلمًا في الصناديق كلها؟`, en: `A store has ${b} boxes of ${a} pens. How many pens are there?` };
  if (k === 3) return { eq: `${a} × ${b} seats`, answer: String(p), wrongs, ar: `في قاعة ${rowsW(a)} من المقاعد، في كل صف ${b} مقعدًا. كم مقعدًا في القاعة؟`, en: `A hall has ${a} rows of ${b} seats. How many seats are there?` };
  return { eq: `${a} × ${b}`, answer: String(p), wrongs, ar: `أوجد ناتج: ${a} × ${b}`, en: `Find ${a} × ${b}.` };
});

// ─── G5 «ضرب الكسور»: the product in simplest form ─────────────────────────────────────────

const fracOpts = (ans: string, cands: string[]) => wrongsFrom(ans, cands, j => sfrac(Math.max(1, Number(ans.split('/')[0]) + j), Number(ans.split('/')[1] ?? 1)));

const fracMulG5 = T('frac_mul_g5', /^ضرب الكسور$/, 5, ({ rng, diff }) => {
  const hi = span(diff, 6, 9, 12), k = pick(rng, [0, 0, 1, 2, 3]);
  if (k === 1) {
    // a whole number times a fraction, kept to a proper or whole product
    for (;;) {
      const n = int(rng, 2, 9), [a, b] = proper(rng, hi);
      if (n * a % b !== 0 && n * a > b) continue;
      const ans = sfrac(n * a, b);
      return { eq: `${n} × ${a}/${b}`, answer: ans, wrongs: fracOpts(ans, [`${n * a}/${n * b}`, `${a}/${n * b}`, sfrac(n + a, b), `${n * a}/${b + 1}`]), ar: `أوجد ناتج: ${n} × ${a}/${b} في أبسط صورة.`, en: `Find ${n} × ${a}/${b} in simplest form.` };
    }
  }
  if (k === 2) {
    // a fraction of a quantity
    const [a, b] = proper(rng, hi), w = b * int(rng, 2, span(diff, 5, 8, 10)), ans = String((a * w) / b);
    return { eq: `${a}/${b} of ${w}`, answer: ans, wrongs: nw(Number(ans), [w / b, w - (a * w) / b, (a * w) / b + a, a * w]).map(String), ar: `ما ${a}/${b} من ${w}؟`, en: `What is ${a}/${b} of ${w}?` };
  }
  const [a, b] = proper(rng, hi), [c, d] = proper(rng, hi), ans = sfrac(a * c, b * d);
  const wrongs = fracOpts(ans, [sfrac(a + c, b + d), sfrac(a * c, b + d), sfrac(a * d, b * c), sfrac(a * c + 1, b * d)]);
  if (k === 3) return { eq: `area ${a}/${b} × ${c}/${d}`, answer: ans, wrongs, ar: `قطعة قماش مستطيلة الشكل طولها ${a}/${b} م، وعرضها ${c}/${d} م. ما مساحتها بالمتر المربع في أبسط صورة؟`, en: `A rectangle of cloth is ${a}/${b} m by ${c}/${d} m. What is its area in square metres, in simplest form?` };
  return { eq: `${a}/${b} × ${c}/${d}`, answer: ans, wrongs, ar: `أوجد ناتج: ${a}/${b} × ${c}/${d} في أبسط صورة.`, en: `Find ${a}/${b} × ${c}/${d} in simplest form.` };
});

// ─── G5 «ضرب الأعداد العشرية وقسمتها»: by 10, 100 and 1000 ────────────────────────────────

const POW: Array<[number, number]> = [[10, 1], [100, 2], [1000, 3]];
const piecesW = (n: number) => `${n} ${tamyiz(n, 'قطع', 'قطعةً', 'قطعة')}`;

const decPow10G5 = T('dec_pow10_g5', /^ضرب الاعداد العشريه وقسمتها$/, 5, ({ rng, diff }) => {
  const dp = pick(rng, diff === 'easy' ? [1] : [1, 2]);
  let raw = int(rng, 11, span(diff, 999, 9999, 99999));
  if (raw % 10 === 0) raw += int(rng, 1, 9);
  const x = fmtDec(raw, dp), [P, z] = pick(rng, POW), k = pick(rng, [0, 0, 1, 1, 2, 3, 4]);
  /** raw × 10^e, written: e > 0 shifts left, e < 0 right. */
  const shift = (e: number) => (dp - e >= 0 ? fmtDec(raw, dp - e) : String(raw * 10 ** (e - dp)));
  if (k === 0 || k === 2 || k === 3) {
    const ans = shift(z), wrongs = wrongsFrom(ans, [shift(z - 1), shift(z + 1), shift(-z), x]);
    if (k === 2) return { eq: `${x} × ? = ${ans}`, answer: String(P), wrongs: wrongsFrom(String(P), POW.filter(([q]) => q !== P).map(([q]) => String(q)).concat(['10000'])), ar: `أوجد العدد المجهول: ${x} × ؟ = ${ans}`, en: `Find the missing number: ${x} × ? = ${ans}` };
    if (k === 3) return { eq: `price ${x} × ${P}`, answer: ans, wrongs, ar: `ثمن القلم ${x} دينار. كم دينارًا ثمن ${pensW(P)}؟`, en: `A pen costs ${x} dinars. How much do ${P} pens cost?` };
    return { eq: `${x} × ${P}`, answer: ans, wrongs, ar: `اضرب العدد ${x} في ${P}.`, en: `Multiply ${x} by ${P}.` };
  }
  const ans = shift(-z), wrongs = wrongsFrom(ans, [shift(-z + 1), shift(-z - 1), shift(z), x]);
  if (k === 4) return { eq: `ribbon ${x} ÷ ${P}`, answer: ans, wrongs, ar: `يُقسم شريط طوله ${x} م إلى ${piecesW(P)} متساوية. ما طول كل قطعة بالمتر؟`, en: `A ribbon ${x} m long is cut into ${P} equal pieces. How long is each piece, in metres?` };
  return { eq: `${x} ÷ ${P}`, answer: ans, wrongs, ar: `اقسم العدد ${x} على ${P}.`, en: `Divide ${x} by ${P}.` };
});

// ─── G7 «كتابة العدد النسبي بالصورة العشرية»: terminating and repeating ─────────────────────

const TERMINATING = [2, 4, 5, 8, 20, 25, 40];
const REPEATING = [3, 6, 9, 11, 12, 15];
const MINUS = '−';
/** n/d (0 < n < d) by long division: «0.375», or the repeating block written out, «0.1666…». */
function decimalOf(n: number, d: number): string {
  const seen = new Map<number, number>(), digs: number[] = [];
  let r = n;
  while (r !== 0 && !seen.has(r)) { seen.set(r, digs.length); r *= 10; digs.push(Math.floor(r / d)); r %= d; }
  if (r === 0) return `0.${digs.join('')}`;
  const start = seen.get(r)!, period = digs.slice(start).join(''), prefix = digs.slice(0, start).join('');
  return `0.${prefix}${period.repeat(period.length === 1 ? 3 : 2)}…`;
}
const coprime = (rng: Rng, d: number) => { for (;;) { const n = int(rng, 1, d - 1); if (gcd(n, d) === 1) return n; } };

const ratToDecG7 = T('rat_to_dec_g7', /^كتابه العدد النسبي بالصوره العشريه$/, 7, ({ rng }) => {
  const k = pick(rng, [0, 0, 1, 2, 2, 3]);
  if (k === 3) {
    // which kind of decimal it will be, decided by the denominator
    const d = pick(rng, [...TERMINATING, ...REPEATING, 7, 16]), n = coprime(rng, d);
    let dd = d; while (dd % 2 === 0) dd /= 2; while (dd % 5 === 0) dd /= 5;
    const ans = dd === 1 ? 'كسر عشري منتهٍ' : 'كسر عشري دوري';
    return { eq: `kind ${n}/${d}`, answer: ans, wrongs: [dd === 1 ? 'كسر عشري دوري' : 'كسر عشري منتهٍ', 'عدد صحيح', 'لا يُكتب بالصورة العشرية'], ar: `هل يُكتب العدد النسبي ${n}/${d} كسرًا عشريًّا منتهيًا أم كسرًا عشريًّا دوريًّا؟`, en: `Is ${n}/${d} a terminating or a repeating decimal?` };
  }
  if (k === 1) {
    const w = int(rng, 1, 9), d = pick(rng, TERMINATING), n = coprime(rng, d), frac = decimalOf(n, d), ans = `${w}${frac.slice(1)}`;
    return { eq: `${w} ${n}/${d}`, answer: ans, wrongs: wrongsFrom(ans, [`${w}.${n}`, `${w}.${n}${d}`, `${w + 1}${frac.slice(1)}`, `${w}.${d}`]), ar: `اكتب العدد ${w} ${n}/${d} بالصورة العشرية.`, en: `Write ${w} ${n}/${d} as a decimal.` };
  }
  const d = pick(rng, k === 2 ? REPEATING : TERMINATING), n = coprime(rng, d), neg = rng() < 0.35, sign = neg ? MINUS : '';
  const ans = `${sign}${decimalOf(n, d)}`;
  const wrongs = wrongsFrom(ans, [`${sign}0.${n}`, `${sign}0.${n}${d}`, `${sign}${decimalOf(d % n || 1, n + d)}`, neg ? decimalOf(n, d) : `${MINUS}${decimalOf(n, d)}`, `${sign}0.${d}`]);
  return { eq: `${sign}${n}/${d}`, answer: ans, wrongs, ar: `اكتب العدد النسبي ${sign}${n}/${d} بالصورة العشرية.`, en: `Write ${sign}${n}/${d} as a decimal.` };
});

// ─── G9 «المدرجات التكرارية»: reading a histogram, and frequency density ───────────────────

const HIST_CTX: Array<[string, string, string]> = [
  ['أطوال نباتات بالسنتيمتر', 'النباتات', 'plant heights in cm'],
  ['أزمنة جري طلاب بالثانية', 'الطلاب', 'pupils\' running times in seconds'],
  ['كتل طرود بالكيلوغرام', 'الطرود', 'parcel masses in kg'],
];

const histogramG9 = T('histogram_g9', /^المدرجات التكراريه$/, 9, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 1, 2, 3, 4, 4]);
  if (k === 4) {
    // unequal classes: the bar's height is the frequency density, frequency ÷ class width
    const w = pick(rng, [5, 10, 20]), a = w * int(rng, 0, 4), b = a + w - 1, dens = int(rng, 1, span(diff, 5, 8, 12)), f = dens * w;
    if (rng() < 0.5) return { eq: `density ${f} / ${w}`, answer: String(dens), wrongs: nw(dens, [f, w, f - w, dens + 1, f * w]).map(String), ar: `في مدرج تكراري فئاته غير متساوية الطول، تكرار الفئة ${a}–${b} يساوي ${f}. ما الكثافة التكرارية لهذه الفئة (التكرار ÷ طول الفئة)؟`, en: `In a histogram with unequal classes, the class ${a}–${b} has frequency ${f}. What is its frequency density (frequency ÷ class width)?` };
    return { eq: `freq ${dens} × ${w}`, answer: String(f), wrongs: nw(f, [dens, dens + w, f + w, f - w]).map(String), ar: `في مدرج تكراري فئاته غير متساوية الطول، الكثافة التكرارية للفئة ${a}–${b} تساوي ${dens}. ما تكرار هذه الفئة؟`, en: `In a histogram with unequal classes, the class ${a}–${b} has frequency density ${dens}. What is its frequency?` };
  }
  const [what, noun, whatEn] = pick(rng, HIST_CTX);
  const w = pick(rng, [5, 10]), s0 = w * int(rng, 0, 3), size = span(diff, 4, 5, 5);
  for (;;) {
    const fs = Array.from({ length: size }, () => int(rng, 2, 15));
    const top = Math.max(...fs);
    if (fs.filter(f => f === top).length > 1) continue;
    const starts = fs.map((_, i) => s0 + i * w), label = (a: number) => `${a}–${a + w - 1}`;
    const table = starts.map((a, i) => `${label(a)}: ${fs[i]}`).join('، '), tableEn = starts.map((a, i) => `${label(a)}: ${fs[i]}`).join(', ');
    const head = `في مدرج تكراري يمثل ${what}، الفئات وارتفاعات أعمدتها (الفئة: الارتفاع): ${table}.`;
    const headEn = `A histogram of ${whatEn} has these classes and bar heights (class: height): ${tableEn}.`;
    const total = fs.reduce((s, f) => s + f, 0);
    if (k === 0) return { eq: `total ${table}`, answer: String(total), wrongs: nw(total, [total - fs[0]!, top, total + w, size * top]).map(String), ar: `${head} ما عدد ${noun} الكلي؟`, en: `${headEn} How many are there in all?` };
    if (k === 1) {
      const at = starts[fs.indexOf(top)]!;
      return { eq: `tallest ${table}`, answer: label(at), wrongs: shuffle(rng, starts.filter(a => a !== at)).slice(0, 3).map(label), ar: `${head} ما الفئة التي يمثلها أطول عمود؟`, en: `${headEn} Which class has the tallest bar?` };
    }
    if (k === 3) return { eq: `width ${table}`, answer: String(w), wrongs: nw(w, [w - 1, w + 1, w * 2, s0 + w]).map(String), ar: `${head} ما طول كل فئة؟`, en: `${headEn} What is the width of each class?` };
    // how many in the classes from a mark upward, or below one
    const i = int(rng, 1, size - 1), up = rng() < 0.5;
    const ans = up ? fs.slice(i).reduce((s, f) => s + f, 0) : fs.slice(0, i).reduce((s, f) => s + f, 0);
    return { eq: `${up ? 'from' : 'below'} ${starts[i]} ${table}`, answer: String(ans), wrongs: nw(ans, [total - ans, ans + fs[i]!, ans - fs[i - 1]!, total]).map(String), ar: up ? `${head} ما عدد ${noun} في الفئات من ${starts[i]} فأكثر؟` : `${head} ما عدد ${noun} في الفئات الأقل من ${starts[i]}؟`, en: `${headEn} How many are in the classes ${up ? `from ${starts[i]} up` : `below ${starts[i]}`}?` };
  }
});

export const LESSON_FIT_TOPICS: readonly Topic[] = [gridsG2, mulG4, fracMulG5, decPow10G5, ratToDecG7, histogramG9];
