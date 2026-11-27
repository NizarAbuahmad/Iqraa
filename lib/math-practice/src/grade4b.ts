/**
 * Grade 4 maths lessons that shared a generator with a lesson they are not (review, 2026-11-21).
 * Measured with the real lesson through `takeElementaryMath`, 300 draws each:
 *
 *   • «قسمة الأعداد» (u3_l3: «من دون باقٍ» and «مع باقٍ») and «القسمة مع وجود أصفار في الناتج»
 *     (u3_l4) drew the one `div` bank: no remainder in 300 items, and 174 ÷ 6 = 29 asked as the
 *     lesson about zeros in the quotient;
 *   • «أجزاء العشرة», «أجزاء المئة» and «التحويل بين الكسور والأعداد العشرية» shared `frac_dec`:
 *     the tenths lesson asked «0.25» and «1/25»;
 *   • «مقارنة الكسور والأعداد الكسرية وترتيبها» drew proper fractions only: no mixed number;
 *   • «الزمن» (u9_l4, «أُحوّل بين وحدات قياس الزمن») asked start and end times, Grade 3's lessons.
 *
 * One generator per lesson, Grade 4 only. Same contract as the other topic modules: the title
 * picks the generator, and every answer is computed from the numbers printed in its own stem.
 */
import { gcd, int, mixed, numWrongs, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [4, 4], make: c => make(c as { rng: Rng; diff: D }) });
const span = <X,>(diff: D, a: X, b: X, c: X): X => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
/** Integer options, never negative and never the answer. */
const nw = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(Number.isInteger));

// ─── «قسمة الأعداد»: three digits by one, without and with a remainder ───────────────────────

/** «كتب» after 3–10, «كتابًا» after 11–99, «كتاب» from 100. */
const books = (n: number) => `${n} ${tamyiz(n, 'كتب', 'كتابًا', 'كتاب')}`;

const divG4 = T('div_g4', /^قسمه الاعداد$/, ({ rng, diff }) => {
  const b = int(rng, 2, span(diff, 5, 9, 9));
  const [lo, hi] = span<[number, number]>(diff, [20, 199], [100, 599], [200, 999]);
  const k = pick(rng, [0, 1, 1, 2, 2, 3, 3, 4, 5]);
  const withRem = () => { for (;;) { const a = int(rng, lo, hi); if (a % b !== 0) return a; } };
  if (k === 0 || k === 5) {
    const q = int(rng, Math.ceil(Math.max(lo, 2 * b) / b), Math.floor(hi / b)), a = b * q;
    if (k === 0) return { eq: `${a} ÷ ${b}`, answer: String(q), wrongs: nw(q, [q + 1, q - 1, q + 10, q - 10, a - b]).map(String), ar: `أوجد ناتج: ${a} ÷ ${b}`, en: `Find ${a} ÷ ${b}.` };
    if (rng() < 0.5) return { eq: `${a} ÷ ? = ${q}`, answer: String(b), wrongs: nw(b, [q, b + 1, b - 1, a - q]).map(String), ar: `أوجد العدد المجهول: ${a} ÷ ؟ = ${q}`, en: `Find the missing number: ${a} ÷ ? = ${q}` };
    return { eq: `? ÷ ${b} = ${q}`, answer: String(a), wrongs: nw(a, [q + b, a + b, a - b, q]).map(String), ar: `أوجد العدد المجهول: ؟ ÷ ${b} = ${q}`, en: `Find the missing number: ? ÷ ${b} = ${q}` };
  }
  if (k === 4) {
    const bb = Math.max(b, 3), q = int(rng, Math.ceil(lo / bb), Math.floor((hi - bb) / bb)), r = int(rng, 1, bb - 1), a = bb * q + r;
    return { eq: `${bb}, ${q}, ${r}`, answer: String(a), wrongs: nw(a, [bb * q, bb * q - r, bb * q + bb, q + r + bb]).map(String), ar: `قُسم عدد على ${bb} فكان الخارج ${q} والباقي ${r}. ما العدد؟`, en: `A number divided by ${bb} gives quotient ${q} and remainder ${r}. What is the number?` };
  }
  const a = withRem(), q = Math.floor(a / b), r = a % b;
  if (k === 1) return { eq: `${a} ÷ ${b} q`, answer: String(q), wrongs: nw(q, [q + 1, q - 1, r, q * 10, b]).map(String), ar: `ما خارج قسمة ${a} على ${b}؟ (من دون الباقي)`, en: `What is the quotient of ${a} ÷ ${b} (without the remainder)?` };
  if (k === 2) return { eq: `${a} ÷ ${b} r`, answer: String(r), wrongs: nw(r, [q, b - r, r + 1, r - 1, b]).map(String), ar: `ما الباقي عند قسمة ${a} على ${b}؟`, en: `What is the remainder when ${a} is divided by ${b}?` };
  // a story: how many shelves are full, or how many books are left over (three or more to a shelf)
  const bb = Math.max(b, 3), aa = (() => { for (;;) { const x = int(rng, lo, hi); if (x % bb !== 0) return x; } })(), qq = Math.floor(aa / bb), rr = aa % bb;
  const head = `وُضع ${books(aa)} على رفوف، في كل رف ${books(bb)}.`;
  if (rng() < 0.5) return { eq: `shelves ${aa}, ${bb}`, answer: String(qq), wrongs: nw(qq, [qq + 1, qq - 1, rr, qq * 10]).map(String), ar: `${head} كم رفًّا امتلأ تمامًا؟`, en: `${aa} books are put on shelves of ${bb} each. How many shelves are filled completely?` };
  return { eq: `left ${aa}, ${bb}`, answer: String(rr), wrongs: nw(rr, [qq, bb - rr, rr + 1, rr - 1, bb]).map(String), ar: `${head} كم كتابًا بقي دون رف كامل؟`, en: `${aa} books are put on shelves of ${bb} each. How many books are left over?` };
});

// ─── «القسمة مع وجود أصفار في الناتج» ──────────────────────────────────────────────────────

/** Every (divisor, quotient) with a three-digit dividend and a zero in the quotient. */
const ZERO_QUOTIENTS: Array<[number, number]> = [];
for (let b = 2; b <= 9; b++) for (let q = Math.ceil(100 / b); q <= Math.floor(999 / b); q++) if (String(q).includes('0')) ZERO_QUOTIENTS.push([b, q]);
const MIDDLE_ZERO = ZERO_QUOTIENTS.filter(([, q]) => /^[1-9]0[1-9]$/.test(String(q)));

const divZeros = T('div_zeros_g4', /^القسمه مع وجود اصفار في الناتج$/, ({ rng }) => {
  const k = pick(rng, [0, 0, 1, 2, 3, 4, 5]);
  const pool = rng() < 0.5 ? MIDDLE_ZERO : ZERO_QUOTIENTS;
  let [b, q] = pick(rng, pool);
  if (k === 4 && b < 3) [b, q] = pick(rng, pool.filter(([x]) => x >= 3));
  const a = b * q, s = String(q);
  if (k === 0) return { eq: `${a} ÷ ${b}`, answer: s, wrongs: nw(q, [Number(s.replace(/0/g, '')), q * 10, q / 10, q + 1, q - 1]).map(String), ar: `أوجد ناتج: ${a} ÷ ${b}`, en: `Find ${a} ÷ ${b}.` };
  if (k === 1) { const z = (s.match(/0/g) ?? []).length; return { eq: `zeros ${a} ÷ ${b}`, answer: String(z), wrongs: nw(z, [z + 1, z - 1, 0, 1, 2, 3]).map(String), ar: `كم صفرًا في ناتج ${a} ÷ ${b}؟`, en: `How many zeros are in ${a} ÷ ${b}?` }; }
  if (k === 2) {
    const place = pick(rng, ['الآحاد', 'العشرات']), d = Number(s.split('').reverse()[place === 'الآحاد' ? 0 : 1]);
    return { eq: `digit ${place} ${a} ÷ ${b}`, answer: String(d), wrongs: nw(d, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== d)).map(String), ar: `ما رقم ${place} في ناتج ${a} ÷ ${b}؟`, en: `What is the ${place === 'الآحاد' ? 'ones' : 'tens'} digit of ${a} ÷ ${b}?` };
  }
  if (k === 3) {
    // the classic slip: the zero is left out
    const slip = s.replace(/0/g, '');
    return { eq: `slip ${a} ÷ ${b}`, answer: s, wrongs: nw(q, [Number(slip), q * 10, q / 10, q + 1]).map(String), ar: `حلّ سامر ${a} ÷ ${b} فكتب ${slip}. ما الناتج الصحيح؟`, en: `Samer solved ${a} ÷ ${b} and wrote ${slip}. What is the right answer?` };
  }
  if (k === 4) return { eq: `sweets ${a} ÷ ${b}`, answer: s, wrongs: nw(q, [Number(s.replace(/0/g, '')), q * 10, q / 10, q + 1]).map(String), ar: `وُزّعت ${a} ${tamyiz(a, 'قطع', 'قطعةً', 'قطعة')} من الحلوى بالتساوي على ${b} صناديق. كم قطعة في كل صندوق؟`, en: `${a} sweets are shared equally among ${b} boxes. How many sweets are in each box?` };
  return { eq: `? ÷ ${b} = ${q}`, answer: String(a), wrongs: nw(a, [a + b, a - b, q + b, a * 10]).map(String), ar: `أوجد العدد المجهول: ؟ ÷ ${b} = ${q}`, en: `Find the missing number: ? ÷ ${b} = ${q}` };
});

// ─── «أجزاء العشرة», «أجزاء المئة», «التحويل بين الكسور والأعداد العشرية» ───────────────────

const tenthsWords = (n: number) => (n === 1 ? 'جزء واحد من عشرة' : n === 2 ? 'جزءان من عشرة' : `${n} أجزاء من عشرة`);
const hundredthsWords = (n: number) => (n === 1 ? 'جزء واحد من مئة' : n === 2 ? 'جزءان من مئة' : n <= 10 ? `${n} أجزاء من مئة` : `${n} جزءًا من مئة`);
/** A decimal from hundredths, trailing zero dropped: 25 → «0.25», 50 → «0.5», 305 → «3.05». */
const decOf = (h: number) => {
  const w = Math.floor(h / 100), f = h % 100;
  return f === 0 ? String(w) : f % 10 === 0 ? `${w}.${f / 10}` : `${w}.${String(f).padStart(2, '0')}`;
};
const other = (n: number, lo = 1, hi = 9) => { const xs = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i).filter(x => x !== n); return xs; };

const tenths = T('tenths_g4', /^اجزاء العشره$/, ({ rng }) => {
  const n = int(rng, 1, 9), w = int(rng, 1, 9);
  const k = pick(rng, [0, 1, 2, 3, 4, 5, 6]);
  if (k === 0) return { eq: `${n}/10`, answer: `0.${n}`, wrongs: wrongsFrom(`0.${n}`, [`0.0${n}`, `${n}.0`, `0.${n === 9 ? 8 : n + 1}`, `${n}`]), ar: `اكتب الكسر ${n}/10 على صورة عدد عشري.`, en: `Write the fraction ${n}/10 as a decimal.` };
  if (k === 1) return { eq: `0.${n}`, answer: `${n}/10`, wrongs: wrongsFrom(`${n}/10`, [`${n}/100`, `10/${n}`, `1/${n}`, `${n === 9 ? 8 : n + 1}/10`]), ar: `اكتب العدد العشري 0.${n} على صورة كسر مقامه 10.`, en: `Write the decimal 0.${n} as a fraction with denominator 10.` };
  if (k === 2) return { eq: `${w} + 0.${n}`, answer: `${w}.${n}`, wrongs: wrongsFrom(`${w}.${n}`, [`${w}${n}`, `${w}.0${n}`, `${n}.${w}`, `0.${w}${n}`]), ar: `اكتب العدد الآتي بالصيغة القياسية: ${w} + 0.${n}`, en: `Write in standard form: ${w} + 0.${n}` };
  if (k === 3) {
    const y = pick(rng, other(w));
    return { eq: `${w}.${y}`, answer: `0.${y}`, wrongs: wrongsFrom(`0.${y}`, [`${y}`, `0.0${y}`, `${y}0`, `0.${y === 9 ? 8 : y + 1}`]), ar: `ما القيمة المنزلية للرقم ${y} في العدد ${w}.${y}؟`, en: `What is the place value of the digit ${y} in ${w}.${y}?` };
  }
  if (k === 4) return { eq: `read 0.${n}`, answer: tenthsWords(n), wrongs: wrongsFrom(tenthsWords(n), [hundredthsWords(n), tenthsWords(n === 9 ? 8 : n + 1), hundredthsWords(n === 9 ? 8 : n + 1), tenthsWords(10 - n || 1)]), ar: `كيف يُقرأ العدد 0.${n}؟`, en: `How is 0.${n} read?` };
  if (k === 5) {
    const m = int(rng, 3, 9), lw = int(rng, 0, 8), from = lw === 0 ? 'الصفر' : String(lw);
    return { eq: `line ${lw}.${m}`, answer: `${lw}.${m}`, wrongs: wrongsFrom(`${lw}.${m}`, [`${lw}.${m === 9 ? 8 : m + 1}`, `${lw}.0${m}`, `${m}.${lw}`, `${lw + 1}.${m}`]), ar: `قُسّمت المسافة بين ${lw} و ${lw + 1} على خط الأعداد إلى 10 أجزاء متساوية. ما العدد العشري الذي يدل على النقطة الواقعة بعد ${m} أجزاء من ${from}؟`, en: `The distance between ${lw} and ${lw + 1} on a number line is split into 10 equal parts. Which decimal is the point ${m} parts after ${lw}?` };
  }
  const whole = int(rng, 10, 99);
  if (rng() < 0.5) return { eq: `tenths digit ${whole}.${n}`, answer: String(n), wrongs: nw(n, other(n).slice(0, 8)).map(String), ar: `ما الرقم الذي في منزلة الأجزاء من عشرة في العدد ${whole}.${n}؟`, en: `Which digit is in the tenths place of ${whole}.${n}?` };
  return { eq: `tenths digit ${whole}.${n}`, answer: String(n), wrongs: nw(n, [whole % 10, Math.floor(whole / 10), n + 1, n - 1]).map(String), ar: `ما الرقم الذي في منزلة الأجزاء من عشرة في العدد ${whole}.${n}؟`, en: `Which digit is in the tenths place of ${whole}.${n}?` };
});

const hundredths = T('hundredths_g4', /^اجزاء المئه$/, ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  const w = int(rng, 1, 9);
  const digits = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9].filter(x => x !== w)).slice(0, 2) as [number, number], [a, b] = digits;
  if (k === 0) {
    let n = 0; do { n = int(rng, 1, 99); } while (n % 10 === 0);
    const ans = (n / 100).toFixed(2);
    return { eq: `${n}/100`, answer: ans, wrongs: wrongsFrom(ans, [`0.${n}`, `${n}.00`, `0.0${n}`, (n / 1000).toFixed(3)]), ar: `اكتب الكسر ${n}/100 على صورة عدد عشري.`, en: `Write the fraction ${n}/100 as a decimal.` };
  }
  if (k === 1) return { eq: `${w} + 0.${a} + 0.0${b}`, answer: `${w}.${a}${b}`, wrongs: wrongsFrom(`${w}.${a}${b}`, [`${w}.${b}${a}`, `${w}.0${a}${b}`, `${w}${a}${b}`, `0.${w}${a}${b}`]), ar: `اكتب العدد الآتي بالصيغة القياسية: ${w} + 0.${a} + 0.0${b}`, en: `Write in standard form: ${w} + 0.${a} + 0.0${b}` };
  if (k === 2) { const ans = `${w} + 0.${a} + 0.0${b}`; return { eq: `${w}.${a}${b} expanded`, answer: ans, wrongs: wrongsFrom(ans, [`${w} + 0.0${a} + 0.${b}`, `${w} + 0.${b} + 0.0${a}`, `${w} + ${a} + ${b}`, `${w}0 + 0.${a} + 0.0${b}`]), ar: `اكتب العدد ${w}.${a}${b} بالصيغة التحليلية.`, en: `Write ${w}.${a}${b} in expanded form.` }; }
  if (k === 3) {
    const tenths = rng() < 0.5, d = tenths ? a : b, ans = tenths ? `0.${a}` : `0.0${b}`;
    return { eq: `${w}.${a}${b} place ${d}`, answer: ans, wrongs: wrongsFrom(ans, [`${d}`, tenths ? `0.0${d}` : `0.${d}`, `${d}0`, `0.00${d}`]), ar: `ما القيمة المنزلية للرقم ${d} في العدد ${w}.${a}${b}؟`, en: `What is the place value of the digit ${d} in ${w}.${a}${b}?` };
  }
  if (k === 4) {
    let n = 0; do { n = int(rng, 1, 99); } while (n % 10 === 0);
    const nn = String(n).padStart(2, '0');
    return { eq: `read 0.${nn}`, answer: hundredthsWords(n), wrongs: wrongsFrom(hundredthsWords(n), [tenthsWords(n <= 9 ? n : 7), `${n} جزءًا من ألف`, hundredthsWords(n === 99 ? 98 : n + 1), hundredthsWords(Number(String(n).split('').reverse().join('')) || 12)]), ar: `كيف يُقرأ العدد 0.${nn}؟`, en: `How is 0.${nn} read?` };
  }
  return { eq: `hundredths digit ${w}.${a}${b}`, answer: String(b), wrongs: nw(b, [a, w, a + b > 9 ? 0 : a + b, b + 1, b - 1]).map(String), ar: `ما الرقم الذي في منزلة الأجزاء من مئة في العدد ${w}.${a}${b}؟`, en: `Which digit is in the hundredths place of ${w}.${a}${b}?` };
});

/** A decimal a Grade 4 pupil would write: at most two places, no trailing zero («0.810», «5.0», «0.1725» are not). */
const cleanDec = (c: string) => /^\d+(\.\d{1,2})?$/.test(c) && !/\.\d*0$/.test(c);
/** A mixed number whose fraction part is proper. */
const properMixed = (c: string) => { const m = c.match(/^(\d+) (\d+)\/(\d+)$/); return !!m && +m[2]! < +m[3]!; };

const decConvert = T('dec_convert_g4', /^التحويل بين الكسور والاعداد العشريه$/, ({ rng }) => {
  const k = pick(rng, [0, 0, 1, 1, 2, 3, 4]);
  const near = (h: number) => (j: number) => (h + 5 * j > 0 && cleanDec(decOf(h + 5 * j)) ? decOf(h + 5 * j) : '');
  if (k === 0 || k === 4) {
    const d = pick(rng, [2, 4, 5, 10, 20, 25, 50, 100]), n = int(rng, 1, d - 1), h = (n * 100) / d, ans = decOf(h);
    const slips = [decOf(n * 100 + d), `0.${n}${d}`, `${(d / n).toFixed(1)}`, decOf(Math.min(99, h + 5))].filter(cleanDec);
    if (k === 0) return { eq: `${n}/${d}`, answer: ans, wrongs: wrongsFrom(ans, slips, near(h)), ar: `اكتب الكسر ${n}/${d} على صورة عدد عشري.`, en: `Write the fraction ${n}/${d} as a decimal.` };
    const w = wrongsFrom(ans, [`0.${n}${d}`, decOf(n * 100 + d > 99 ? 99 : n * 100 + d), decOf(Math.min(99, h + 5)), decOf(Math.max(1, h - 5))].filter(cleanDec), near(h));
    const opts = shuffle(rng, [ans, ...w]);
    return { eq: `which ${n}/${d}`, answer: ans, wrongs: w, ar: `أيّ الأعداد العشرية الآتية يساوي الكسر ${n}/${d}: ${opts.join(' ، ')}؟`, en: `Which of these decimals equals ${n}/${d}: ${opts.join(', ')}?` };
  }
  if (k === 1) {
    const h = pick(rng, [5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 12, 15, 24, 35, 45, 36, 64]), g = gcd(h, 100), n = h / g, d = 100 / g, ans = `${n}/${d}`;
    return { eq: `${decOf(h)}`, answer: ans, wrongs: wrongsFrom(ans, [`${n}/${d + 1}`, `${d}/${n}`, `1/${h}`, `${n + 1}/${d}`, `${h}/10`]), ar: `اكتب العدد العشري ${decOf(h)} على صورة كسر في أبسط صورة.`, en: `Write the decimal ${decOf(h)} as a fraction in simplest form.` };
  }
  const w = int(rng, 1, 9), d = pick(rng, [2, 4, 5, 10]), n = int(rng, 1, d - 1), h = w * 100 + (n * 100) / d;
  if (k === 2) return { eq: `${w} ${n}/${d}`, answer: decOf(h), wrongs: wrongsFrom(decOf(h), [`${w}.${n}${d}`, `${w}.${n}`, decOf(h + 5), decOf(h - 5)].filter(cleanDec), near(h)), ar: `اكتب العدد الكسري ${w} ${n}/${d} على صورة عدد عشري.`, en: `Write the mixed number ${w} ${n}/${d} as a decimal.` };
  const ans = mixed(w * d + n, d);
  return { eq: `${decOf(h)} mixed`, answer: ans, wrongs: wrongsFrom(ans, [`${w} ${n}/${d + 1}`, `${w + 1} ${n}/${d}`, `${n} ${w}/${d}`, `${w} ${n + 1}/${d + 2}`, `${w} ${n}/${d * 2}`].filter(properMixed)), ar: `اكتب العدد العشري ${decOf(h)} على صورة عدد كسري في أبسط صورة.`, en: `Write the decimal ${decOf(h)} as a mixed number in simplest form.` };
});

// ─── «مقارنة الكسور والأعداد الكسرية وترتيبها» ─────────────────────────────────────────────

interface Num { n: number; d: number; w: number }
const numStr = (x: Num) => (x.w > 0 ? `${x.w} ${x.n}/${x.d}` : `${x.n}/${x.d}`);
const numVal = (x: Num) => x.w + x.n / x.d;

const fracCompareG4 = T('frac_compare_g4', /^مقارنه الكسور والاعداد الكسريه وترتيبها$/, ({ rng, diff }) => {
  const useMixed = rng() < 0.6;
  // two in five mixed sets share one whole part, so the fraction decides: «3 1/4 ___ 3 2/5»
  const sharedWhole = useMixed && rng() < 0.4, whole = int(rng, 1, 5);
  const one = (): Num => {
    const d = int(rng, 2, span(diff, 8, 10, 12)), n = int(rng, 1, d - 1);
    if (!useMixed) return { n, d, w: 0 };
    if (sharedWhole) return { n, d, w: whole };
    // mostly mixed; now and then an improper fraction written as one
    return rng() < 0.2 ? { n: n + d * int(rng, 1, 3), d, w: 0 } : { n, d, w: int(rng, 1, 5) };
  };
  const set = (k: number): Num[] => {
    for (let t = 0; t < 200; t++) {
      const xs = Array.from({ length: k }, one);
      if (new Set(xs.map(x => numVal(x).toFixed(9))).size === k) return xs;
    }
    return Array.from({ length: k }, (_, i) => ({ n: 1, d: i + 2, w: useMixed ? 1 : 0 }));
  };
  const kind = pick(rng, [0, 0, 1, 2]);
  if (kind === 0) {
    let [A, B] = set(2) as [Num, Num];
    if (useMixed && rng() < 0.2) { const w = int(rng, 1, 4), d = int(rng, 2, 8), n = int(rng, 1, d - 1); A = { w, n, d }; B = { w: 0, n: w * d + n, d }; } // 2 1/2 ___ 5/2
    const sign = numVal(A) > numVal(B) + 1e-9 ? '>' : numVal(A) < numVal(B) - 1e-9 ? '<' : '=';
    return { eq: `${numStr(A)} ? ${numStr(B)}`, answer: sign, wrongs: ['>', '<', '='].filter(x => x !== sign), ar: `ضع الإشارة المناسبة (> أو < أو =):\n${numStr(A)} ___ ${numStr(B)}`, en: `Write the correct sign (>, < or =):\n${numStr(A)} ___ ${numStr(B)}` };
  }
  const noun = useMixed ? ['العدد', 'الأعداد'] : ['الكسر', 'الكسور'];
  if (kind === 1) {
    const xs = set(4), big = rng() < 0.5, best = xs.reduce((m, x) => ((numVal(x) > numVal(m)) === big ? x : m));
    return { eq: xs.map(numStr).join(', '), answer: numStr(best), wrongs: xs.filter(x => x !== best).map(numStr), ar: `ما ${noun[0]} ${big ? 'الأكبر' : 'الأصغر'} بين ${noun[1]} الآتية: ${xs.map(numStr).join('، ')}؟`, en: `Which is the ${big ? 'greatest' : 'least'} of these: ${xs.map(numStr).join(', ')}?` };
  }
  const xs = set(3), asc = rng() < 0.5, order = [...xs].sort((x, y) => (asc ? numVal(x) - numVal(y) : numVal(y) - numVal(x)));
  const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]].map(p => p.map(i => xs[i]!).map(numStr).join('، '));
  const ans = order.map(numStr).join('، ');
  return { eq: xs.map(numStr).join(', '), answer: ans, wrongs: shuffle(rng, perms.filter(x => x !== ans)).slice(0, 3), ar: `رتّب ${noun[1]} الآتية ${asc ? 'تصاعديًّا' : 'تنازليًّا'}: ${xs.map(numStr).join('، ')}`, en: `Order these ${asc ? 'from least to greatest' : 'from greatest to least'}: ${xs.map(numStr).join(', ')}` };
});

// ─── «الزمن»: converting units of time ───────────────────────────────────────────────────

interface TimeUnit { few: string; accusative: string; genitive: string; ask: string; en: string }
const U: Record<string, TimeUnit> = {
  h: { few: 'ساعات', accusative: 'ساعةً', genitive: 'ساعة', ask: 'ساعة', en: 'hours' },
  min: { few: 'دقائق', accusative: 'دقيقةً', genitive: 'دقيقة', ask: 'دقيقة', en: 'minutes' },
  sec: { few: 'ثوانٍ', accusative: 'ثانيةً', genitive: 'ثانية', ask: 'ثانية', en: 'seconds' },
  d: { few: 'أيام', accusative: 'يومًا', genitive: 'يوم', ask: 'يومًا', en: 'days' },
  w: { few: 'أسابيع', accusative: 'أسبوعًا', genitive: 'أسبوع', ask: 'أسبوعًا', en: 'weeks' },
  mo: { few: 'أشهر', accusative: 'شهرًا', genitive: 'شهر', ask: 'شهرًا', en: 'months' },
  y: { few: 'سنوات', accusative: 'سنةً', genitive: 'سنة', ask: 'سنة', en: 'years' },
};
const count = (n: number, u: string) => `${n} ${tamyiz(n, U[u]!.few, U[u]!.accusative, U[u]!.genitive)}`;
/** [big, small, how many small make one big, the small counts a mixed measure may add] */
const PAIRS: Array<[string, string, number, number[]]> = [
  ['h', 'min', 60, [10, 15, 20, 25, 30, 35, 40, 45, 50]], ['min', 'sec', 60, [10, 15, 20, 30, 40, 45, 50]],
  ['d', 'h', 24, [3, 4, 5, 6, 8, 10, 12, 15, 18]], ['w', 'd', 7, [3, 4, 5, 6]], ['y', 'mo', 12, [3, 4, 5, 6, 8, 9, 10]],
];

const timeUnits = T('time_units_g4', /^الزمن$/, ({ rng }) => {
  const [big, small, f, adds] = pick(rng, PAIRS);
  const k = pick(rng, [0, 0, 1, 1, 2, 3]);
  const N = int(rng, 3, 10);
  if (k === 0) { const ans = N * f; return { eq: `${N} ${big}`, answer: String(ans), wrongs: nw(ans, [N + f, ans / 10, N * 10, ans + f, ans - f]).map(String), ar: `كم ${U[small]!.ask} في ${count(N, big)}؟`, en: `How many ${U[small]!.en} are in ${N} ${U[big]!.en}?` }; }
  if (k === 1) { const sm = N * f; return { eq: `${sm} ${small}`, answer: String(N), wrongs: nw(N, [N + 1, N - 1, N * 10, sm - f, Math.floor(sm / 10)]).map(String), ar: `كم ${U[big]!.ask} في ${count(sm, small)}؟`, en: `How many ${U[big]!.en} are in ${sm} ${U[small]!.en}?` }; }
  const add = pick(rng, adds), ans = N * f + add, both = `${count(N, big)} و ${count(add, small)}`;
  const wrongs = nw(ans, [N + add, N * f, N * 10 + add, ans + f, ans - f, N * f * add]).map(String);
  if (k === 2) return { eq: `${N} ${big} ${add} ${small}`, answer: String(ans), wrongs, ar: `كم ${U[small]!.ask} في ${both}؟`, en: `How many ${U[small]!.en} are in ${N} ${U[big]!.en} and ${add} ${U[small]!.en}?` };
  return { eq: `trip ${N} ${big} ${add} ${small}`, answer: String(ans), wrongs, ar: `تستغرق رحلة ${both}. كم ${U[small]!.ask} تستغرق الرحلة؟`, en: `A trip takes ${N} ${U[big]!.en} and ${add} ${U[small]!.en}. How many ${U[small]!.en} does it take?` };
});

/** Registered ahead of the shared generators in `topics.ts` — the lesson-specific ones win. */
export const G4_LESSON_TOPICS: readonly Topic[] = [divG4, divZeros, tenths, hundredths, decConvert, fracCompareG4, timeUnits];
