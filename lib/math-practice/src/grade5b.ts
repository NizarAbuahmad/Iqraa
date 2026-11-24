/**
 * Grade 5 maths lessons that did not ask their own skill (review, 2026-11-24).
 * Measured with the real lesson through `takeElementaryMath`, 300 draws each:
 *
 *   • «مقارنة الكسور والأعداد الكسرية وترتيبها», «جمع الكسور» («أجمع أعدادًا كسرية غير متشابهة»)
 *     and «طرح الكسور» («أطرح الكسور والأعداد الكسرية») drew proper fractions only: 0 mixed numbers;
 *   • «أجزاء الألف» and «التحويل بين الكسور والأعداد العشرية» shared `frac_dec`: the thousandths lesson
 *     asked «7/50 على صورة عدد عشري» and the conversion lesson asked the place value of a digit;
 *   • «ضرب الأعداد العشرية وقسمتها» says «في 10، 100، 1000» but drew decimal × decimal, and a
 *     decimal divided by a decimal, in three items of four;
 *   • «الزمن» has one key concept, «توقيت 24 ساعة», and wrote no time past 12:59.
 *
 * One generator per lesson, Grade 5 only. Same contract as the other topic modules: the title picks the
 * generator, and every answer is computed from the numbers printed in its own stem.
 */
import { fracCompareDraft } from './grade4b.ts';
import { gcd, int, lcm, mixed, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [5, 5], make: c => make(c as { rng: Rng; diff: D }) });
const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const NAMES = ['سامر', 'خالد', 'عمر', 'يزن'];
const GIRLS = ['سلمى', 'هند', 'ليلى', 'تالا'];

// ─── fractions and mixed numbers ─────────────────────────────────────────────────────────

/** A mixed number (w = 0: a proper fraction) with its own denominator. */
interface Q { w: number; n: number; d: number }
const qStr = (x: Q) => (x.w > 0 ? `${x.w} ${x.n}/${x.d}` : `${x.n}/${x.d}`);
/** The numerator of x over x.d. */
const top = (x: Q) => x.w * x.d + x.n;
const DENS: Record<D, number[]> = { easy: [2, 3, 4, 5, 6, 8, 10], medium: [2, 3, 4, 5, 6, 8, 10, 12], hard: [2, 3, 4, 5, 6, 8, 10, 12] };

const properFrac = (rng: Rng, d: number): [number, number] => {
  for (;;) { const n = int(rng, 1, d - 1); if (gcd(n, d) === 1) return [n, d]; }
};
/** Two operands with different denominators: both mixed (or one a plain fraction), or both fractions. */
function operands(rng: Rng, diff: D, useMixed: boolean): [Q, Q] {
  const dens = DENS[diff];
  // the common denominator stays one a Grade 5 pupil finds by listing multiples: 6, 12, 24, but not 60
  const cap = diff === 'easy' ? 12 : diff === 'medium' ? 24 : 30;
  let d1 = pick(rng, dens), d2 = pick(rng, dens);
  for (let t = 0; t < 200 && (d1 === d2 || lcm(d1, d2) > cap); t++) { d1 = pick(rng, dens); d2 = pick(rng, dens); }
  if (d1 === d2) d2 = d1 === 2 ? 3 : 2;
  const wMax = diff === 'easy' ? 3 : 6;
  const mk = (d: number, mixedHere: boolean): Q => { const [n] = properFrac(rng, d); return { w: mixedHere ? int(rng, 1, wMax) : 0, n, d }; };
  if (!useMixed) return [mk(d1, false), mk(d2, false)];
  const lone = rng() < 0.2; // «2 1/3 + 1/2»: one plain fraction
  return rng() < 0.5 ? [mk(d1, true), mk(d2, !lone)] : [mk(d1, !lone), mk(d2, true)];
}
const isMixedForm = (s: string) => /^(?:\d+ )?\d+\/\d+$|^\d+$/.test(s);

const fracCompareG5 = T('frac_compare_g5', /^مقارنه الكسور والاعداد الكسريه وترتيبها$/, ({ rng, diff }) => fracCompareDraft(rng, diff, diff === 'easy' ? 10 : 12));

/** The sum of a and b as one mixed number in lowest terms, from its numerator and common denominator. */
const sumOf = (a: Q, b: Q) => { const L = lcm(a.d, b.d); return { N: top(a) * (L / a.d) + top(b) * (L / b.d), L }; };
const diffOf = (a: Q, b: Q) => { const L = lcm(a.d, b.d); return { N: top(a) * (L / a.d) - top(b) * (L / b.d), L }; };

const fracAddG5 = T('frac_add_g5', /^جمع الكسور$/, ({ rng, diff }) => {
  const useMixed = rng() < 0.55;
  const [A, B] = operands(rng, diff, useMixed);
  const { N, L } = sumOf(A, B), ans = mixed(N, L);
  const slips = [
    useMixed ? `${A.w + B.w} ${mixed(A.n + B.n, A.d + B.d)}` : mixed(A.n + B.n, A.d + B.d), // numerators and denominators added
    mixed(N + L, L), mixed(N + 1, L), mixed(N - 1, L), A.w + B.w > 0 ? mixed(N - L, L) : '',
  ].filter(x => x && isMixedForm(x));
  const near = (k: number) => (N + k > 0 ? mixed(N + k, L) : '');
  const k = pick(rng, [0, 0, 1, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${qStr(A)} + ${qStr(B)}`, answer: ans, wrongs: wrongsFrom(ans, slips, near), ar: `أوجد ناتج: ${qStr(A)} + ${qStr(B)}\n(اكتب الناتج في أبسط صورة)`, en: `Find ${qStr(A)} + ${qStr(B)} (in simplest form).` };
  if (k === 1) {
    const girl = pick(rng, GIRLS);
    return { eq: `word ${qStr(A)} + ${qStr(B)}`, answer: ans, wrongs: wrongsFrom(ans, slips, near), ar: `اشترت ${girl} ${qStr(A)} كغ من التفاح، و${qStr(B)} كغ من البرتقال. كم كيلوغرامًا اشترت؟`, en: `${girl} bought ${qStr(A)} kg of apples and ${qStr(B)} kg of oranges. How many kilograms did she buy?`, word: true };
  }
  if (k === 2) {
    const m = lcm(A.d, B.d);
    const fa = properFrac(rng, A.d), fb = properFrac(rng, B.d);
    const l = lcm(fa[1], fb[1]);
    return { eq: `lcd ${fa[0]}/${fa[1]}, ${fb[0]}/${fb[1]}`, answer: String(l), wrongs: wrongsFrom(String(l), [fa[1] * fb[1], fa[1] + fb[1], Math.max(fa[1], fb[1]), 2 * l, m !== l ? m : '']), ar: `ما المقام المشترك الأصغر للكسرين ${fa[0]}/${fa[1]} و ${fb[0]}/${fb[1]}؟`, en: `What is the least common denominator of ${fa[0]}/${fa[1]} and ${fb[0]}/${fb[1]}?` };
  }
  if (k === 3) {
    // the missing addend: A + ؟ = S
    return { eq: `${qStr(A)} + ? = ${ans}`, answer: mixed(top(B) * (L / B.d), L), wrongs: wrongsFrom(mixed(top(B) * (L / B.d), L), [ans, qStr(A), mixed(top(B) * (L / B.d) + 1, L), mixed(top(B) * (L / B.d) + L, L)].filter(isMixedForm), k2 => (top(B) * (L / B.d) + k2 > 0 ? mixed(top(B) * (L / B.d) + k2, L) : '')), ar: `أوجد العدد المجهول: ${qStr(A)} + ؟ = ${ans}`, en: `Find the missing number: ${qStr(A)} + ? = ${ans}` };
  }
  // the classic slip: numerators added, denominators added
  const [F, G] = operands(rng, diff, false);
  const [a, da, b, db] = [F.n, F.d, G.n, G.d];
  const s = sumOf({ w: 0, n: a, d: da }, { w: 0, n: b, d: db }), right = mixed(s.N, s.L);
  return { eq: `slip ${a}/${da} + ${b}/${db}`, answer: right, wrongs: wrongsFrom(right, [mixed(a + b, da + db), mixed(s.N + 1, s.L), mixed(s.N - 1, s.L), mixed(s.N + s.L, s.L)].filter(isMixedForm), k2 => (s.N + k2 > 0 ? mixed(s.N + k2, s.L) : '')), ar: `جمع ${pick(rng, NAMES)} ${a}/${da} + ${b}/${db} فكتب ${a + b}/${da + db}. ما الناتج الصحيح؟`, en: `A pupil added ${a}/${da} + ${b}/${db} and wrote ${a + b}/${da + db}. What is the right answer?` };
});

/** Subtraction operands: the minuend is the larger; about two in five mixed pairs need a regroup (the fraction part is the smaller). */
function subOperands(rng: Rng, diff: D, useMixed: boolean): [Q, Q] {
  if (!useMixed) {
    for (;;) { const [A, B] = operands(rng, diff, false); if (top(A) * B.d > top(B) * A.d) return [A, B]; if (top(A) * B.d < top(B) * A.d) return [B, A]; }
  }
  const wantRegroup = rng() < 0.45;
  for (let t = 0; t < 400; t++) {
    const [A, B] = operands(rng, diff, true);
    if (A.w <= B.w) continue;
    const reg = A.n * B.d < B.n * A.d;
    if (reg === wantRegroup) return [A, B];
  }
  return [{ w: 4, n: 1, d: 4 }, { w: 1, n: 1, d: 2 }];
}

const fracSubG5 = T('frac_sub_g5', /^طرح الكسور$/, ({ rng, diff }) => {
  const useMixed = rng() < 0.55;
  const [A, B] = subOperands(rng, diff, useMixed);
  const { N, L } = diffOf(A, B), ans = mixed(N, L);
  const slips = [
    useMixed && A.w > B.w ? `${A.w - B.w} ${mixed(Math.abs(A.n * B.d - B.n * A.d), L)}` : '', // each part taken from the other way round
    mixed(top(A) * (L / A.d) + top(B) * (L / B.d), L), // the sum
    mixed(N + L, L), mixed(N + 1, L), N - L > 0 ? mixed(N - L, L) : '', mixed(N - 1, L),
  ].filter(x => x && isMixedForm(x) && !/^0/.test(x));
  const near = (k: number) => (N + k > 0 ? mixed(N + k, L) : '');
  const k = pick(rng, [0, 0, 1, 2, 3]);
  if (k === 0) return { eq: `${qStr(A)} − ${qStr(B)}`, answer: ans, wrongs: wrongsFrom(ans, slips, near), ar: `أوجد ناتج: ${qStr(A)} − ${qStr(B)}\n(اكتب الناتج في أبسط صورة)`, en: `Find ${qStr(A)} − ${qStr(B)} (in simplest form).` };
  if (k === 1) {
    const boy = pick(rng, NAMES);
    return { eq: `jug ${qStr(A)} − ${qStr(B)}`, answer: ans, wrongs: wrongsFrom(ans, slips, near), ar: `في إبريق ${qStr(A)} لتر من الحليب، شرب ${boy} منه ${qStr(B)} لتر. كم لترًا بقي في الإبريق؟`, en: `A jug holds ${qStr(A)} litres of milk and ${boy} drinks ${qStr(B)} litres. How much is left?`, word: true };
  }
  if (k === 2) return { eq: `more ${qStr(A)} − ${qStr(B)}`, answer: ans, wrongs: wrongsFrom(ans, slips, near), ar: `بكم يزيد ${qStr(A)} على ${qStr(B)}؟`, en: `By how much is ${qStr(A)} greater than ${qStr(B)}?` };
  // the missing subtrahend: A − ؟ = D
  const bAns = mixed(top(B) * (L / B.d), L);
  return { eq: `${qStr(A)} − ? = ${ans}`, answer: bAns, wrongs: wrongsFrom(bAns, [ans, qStr(A), mixed(top(B) * (L / B.d) + 1, L), mixed(top(A) * (L / A.d) + top(B) * (L / B.d), L)].filter(x => isMixedForm(x)), k2 => (top(B) * (L / B.d) + k2 > 0 ? mixed(top(B) * (L / B.d) + k2, L) : '')), ar: `أوجد العدد المجهول: ${qStr(A)} − ؟ = ${ans}`, en: `Find the missing number: ${qStr(A)} − ? = ${ans}` };
});

// ─── decimals: «أجزاء الألف» and the conversions ──────────────────────────────────────────

/** h thousandths as a decimal, trailing zeros dropped: 125 → «0.125», 450 → «0.45», 3000 → «3». */
const decOf = (h: number) => {
  const w = Math.floor(h / 1000), f = h % 1000;
  if (f === 0) return String(w);
  return `${w}.${String(f).padStart(3, '0').replace(/0+$/, '')}`;
};
/** A decimal a Grade 5 pupil would write: at most three places, no trailing zero. */
const cleanDec = (c: string) => /^\d+(\.\d{1,3})?$/.test(c) && !/\.\d*0$/.test(c);
const properMixed = (c: string) => { const m = c.match(/^(\d+) (\d+)\/(\d+)$/); return !!m && +m[2]! < +m[3]!; };
const thousandthsWords = (n: number) => (n === 1 ? 'جزء واحد من ألف' : n === 2 ? 'جزءان من ألف' : `${n} ${tamyiz(n, 'أجزاء', 'جزءًا', 'جزء')} من ألف`);
const hundredthsWords = (n: number) => (n === 1 ? 'جزء واحد من مئة' : n === 2 ? 'جزءان من مئة' : `${n} ${tamyiz(n, 'أجزاء', 'جزءًا', 'جزء')} من مئة`);

const thousandths = T('thousandths_g5', /^اجزاء الالف$/, ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 2, 3, 4, 5, 6]);
  // four different non-zero digits, so «the digit 7» names one place
  const [w, a, b, c] = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4) as [number, number, number, number];
  const whole = diff === 'hard' ? w * 10 + int(rng, 0, 9) : w;
  if ([a, b, c].some(x => String(whole).includes(String(x)))) return thousandths.make({ rng, diff, grade: 5 }); // «the digit 7» must name one digit
  if (k === 0) {
    let n = 0; do { n = int(rng, 1, 999); } while (n % 10 === 0);
    const ans = (n / 1000).toFixed(3);
    return { eq: `${n}/1000`, answer: ans, wrongs: wrongsFrom(ans, [`0.${n}`, (n / 100).toFixed(2), (n / 10000).toFixed(4), `${n}.000`].filter(cleanDec)), ar: `اكتب الكسر ${n}/1000 على صورة عدد عشري.`, en: `Write the fraction ${n}/1000 as a decimal.` };
  }
  if (k === 1) {
    const n = a * 100 + b * 10 + c, x = `0.${a}${b}${c}`;
    return { eq: `${x} /1000`, answer: `${n}/1000`, wrongs: wrongsFrom(`${n}/1000`, [`${n}/100`, `${n}/10000`, `${c * 100 + b * 10 + a}/1000`, `${a}${b}/1000`, `${n}/10`]), ar: `اكتب العدد العشري ${x} على صورة كسر مقامه 1000.`, en: `Write the decimal ${x} as a fraction with denominator 1000.` };
  }
  if (k === 2) {
    const pos = int(rng, 1, 3), digit = [a, b, c][pos - 1]!, x = `${whole}.${a}${b}${c}`;
    const ans = digit === 0 ? '0' : (digit / 10 ** pos).toFixed(pos);
    return { eq: `${x} place ${digit}`, answer: ans, wrongs: wrongsFrom(ans, [String(digit), (digit / 10 ** (pos === 3 ? 2 : pos + 1)).toFixed(pos === 3 ? 2 : pos + 1), `${digit}0`, (digit / 10 ** (pos === 1 ? 3 : pos - 1)).toFixed(pos === 1 ? 3 : pos - 1)].filter(cleanDec)), ar: `ما القيمة المنزلية للرقم ${digit} في العدد ${x}؟`, en: `What is the place value of the digit ${digit} in ${x}?` };
  }
  if (k === 3) {
    const ans = `${whole}.${a}${b}${c}`, terms = `${whole} + 0.${a} + 0.0${b} + 0.00${c}`;
    return { eq: terms, answer: ans, wrongs: wrongsFrom(ans, [`${whole}.${c}${b}${a}`, `${whole}.0${a}${b}${c}`, `${whole}.${a}${c}${b}`, `${whole}${a}${b}${c}`].filter(cleanDec)), ar: `اكتب العدد الآتي بالصيغة القياسية: ${terms}`, en: `Write in standard form: ${terms}` };
  }
  if (k === 4) {
    const x = `${whole}.${a}${b}${c}`, ans = `${whole} + 0.${a} + 0.0${b} + 0.00${c}`;
    return { eq: `${x} expanded`, answer: ans, wrongs: wrongsFrom(ans, [`${whole} + 0.0${a} + 0.${b} + 0.00${c}`, `${whole} + 0.${a} + 0.${b} + 0.${c}`, `${whole} + 0.${c} + 0.0${b} + 0.00${a}`, `${whole} + ${a} + ${b} + ${c}`, `${whole}0 + 0.${a} + 0.0${b} + 0.00${c}`]), ar: `اكتب العدد ${x} بالصيغة التحليلية.`, en: `Write ${x} in expanded form.` };
  }
  if (k === 5) {
    const x = `${whole}.${a}${b}${c}`;
    return { eq: `thousandths digit ${x}`, answer: String(c), wrongs: wrongsFrom(String(c), [a, b, w, a + b > 9 ? 0 : a + b].map(String)), ar: `ما الرقم الذي في منزلة الأجزاء من ألف في العدد ${x}؟`, en: `Which digit is in the thousandths place of ${x}?` };
  }
  let n = 0; do { n = int(rng, 1, 999); } while (n % 10 === 0 || n < 3);
  const nn = String(n).padStart(3, '0'), rev = Number(String(n).split('').reverse().join('')) || 12;
  return { eq: `read 0.${nn}`, answer: thousandthsWords(n), wrongs: wrongsFrom(thousandthsWords(n), [hundredthsWords(n), thousandthsWords(n + 1), thousandthsWords(rev === n ? n + 2 : rev), `${n} ${tamyiz(n, 'أجزاء', 'جزءًا', 'جزء')} من عشرة`]), ar: `كيف يُقرأ العدد 0.${nn}؟`, en: `How is 0.${nn} read?` };
});

/** [denominator, thousandths-per-numerator] — fractions whose decimal ends. */
const TERMINATING = [2, 4, 5, 8, 10, 20, 25, 50, 100, 1000];

const decConvertG5 = T('dec_convert_g5', /^التحويل بين الكسور والاعداد العشريه$/, ({ rng }) => {
  const k = pick(rng, [0, 0, 1, 2, 2, 3, 4]);
  const near = (h: number) => (j: number) => (h + 5 * j > 0 && cleanDec(decOf(h + 5 * j)) ? decOf(h + 5 * j) : '');
  if (k === 0 || k === 4) {
    const d = pick(rng, TERMINATING), [n] = properFrac(rng, d), h = (n * 1000) / d, ans = decOf(h);
    // the slips of a fraction below one: the digits run together, the value rounded to hundredths, or a thousandth off
    const slips = [`0.${n}${d}`, decOf(Math.round(h / 10) * 10 + (h % 10 === 0 ? 10 : 0)), decOf(Math.min(999, h + 5)), decOf(Math.max(1, h - 5)), decOf(Math.round((n / d) * 10) * 100)].filter(c => cleanDec(c) && Number(c) < 1);
    if (k === 0) return { eq: `${n}/${d}`, answer: ans, wrongs: wrongsFrom(ans, slips, near(h)), ar: `اكتب الكسر ${n}/${d} على صورة عدد عشري.`, en: `Write the fraction ${n}/${d} as a decimal.` };
    const w = wrongsFrom(ans, slips, near(h));
    const opts = shuffle(rng, [ans, ...w]);
    return { eq: `which ${n}/${d}`, answer: ans, wrongs: w, ar: `أيّ الأعداد العشرية الآتية يساوي الكسر ${n}/${d}: ${opts.join(' ، ')}؟`, en: `Which of these decimals equals ${n}/${d}: ${opts.join(', ')}?` };
  }
  if (k === 1 || k === 3) {
    const w = int(rng, 1, 9), d = pick(rng, [2, 4, 5, 8, 10, 20, 25]), [n] = properFrac(rng, d), h = w * 1000 + (n * 1000) / d;
    if (k === 1) return { eq: `${w} ${n}/${d}`, answer: decOf(h), wrongs: wrongsFrom(decOf(h), [`${w}.${n}${d}`, `${w}.${n}`, decOf(h + 5), decOf(h - 5), decOf(w * 1000 + n * 10)].filter(cleanDec), near(h)), ar: `اكتب العدد الكسري ${w} ${n}/${d} على صورة عدد عشري.`, en: `Write the mixed number ${w} ${n}/${d} as a decimal.` };
    const ans = mixed(h, 1000);
    return { eq: `${decOf(h)} mixed`, answer: ans, wrongs: wrongsFrom(ans, [`${w} ${n}/${d + 1}`, `${w + 1} ${n}/${d}`, `${n} ${w}/${d}`, `${w} ${n + 1}/${d + 2}`, `${w} ${n}/${d * 2}`, `${w} ${n}/10`].filter(properMixed)), ar: `اكتب العدد العشري ${decOf(h)} على صورة عدد كسري في أبسط صورة.`, en: `Write the decimal ${decOf(h)} as a mixed number in simplest form.` };
  }
  // a decimal below one, as a fraction in simplest form
  const places = pick(rng, [1, 2, 2, 3]);
  let h = 0;
  do { h = int(rng, 1, 999); } while (h % 10 ** (3 - places) !== 0 || (places === 3 && h % 10 === 0));
  const g = gcd(h, 1000), n = h / g, d = 1000 / g, ans = `${n}/${d}`;
  return { eq: `${decOf(h)}`, answer: ans, wrongs: wrongsFrom(ans, [`${n}/${d + 1}`, `${d}/${n}`, `${n + 1}/${d}`, `${h}/${10 ** places}`, `${h}/100`, `${n}/${d * 10}`].filter(c => !/^\d+\/\d+$/.test(c) || +c.split('/')[0]! > 0)), ar: `اكتب العدد العشري ${decOf(h)} على صورة كسر في أبسط صورة.`, en: `Write the decimal ${decOf(h)} as a fraction in simplest form.` };
});

// ─── «ضرب الأعداد العشرية وقسمتها»: by 10, 100 and 1000 ───────────────────────────────────

/** a / 10^places, trailing zeros dropped: (45, 2) → «0.45», (4500, 2) → «45», (7, -1) → «70». */
const dec = (a: number, places: number): string => {
  if (places <= 0) return String(a * 10 ** -places);
  const s = String(a).padStart(places + 1, '0');
  const whole = s.slice(0, -places), frac = s.slice(-places).replace(/0+$/, '');
  return frac ? `${whole}.${frac}` : whole;
};
const pens = (n: number) => `${n} ${n === 10 ? 'أقلام' : 'قلم'}`;
const placesWords = (k: number) => (k === 1 ? 'منزلة واحدة' : k === 2 ? 'منزلتين' : '3 منازل');

const decShift = T('dec_shift_g5', /^ضرب الاعداد العشريه وقسمتها$/, ({ rng, diff }) => {
  // X = a / 10^p with a last digit that is not 0, so «3.40» is never printed
  const p = pick(rng, diff === 'easy' ? [1, 2] : [1, 2, 3]);
  let a = 0;
  do { a = int(rng, 10 ** (p - 1) + 1, (diff === 'easy' ? 9 : 99) * 10 ** p + 10 ** p - 1); } while (a % 10 === 0);
  const X = dec(a, p), K = pick(rng, [1, 2, 3]), P = 10 ** K;
  const mulWrongs = (n = a) => [dec(n, p - K + 1), dec(n, p - K - 1), dec(n, p + K), dec(n, p - K + 2)].filter(c => c !== dec(n, p - K));
  const k = pick(rng, [0, 0, 0, 1, 1, 1, 2, 3, 4, 5]);
  if (k === 0) return { eq: `${X} × ${P}`, answer: dec(a, p - K), wrongs: wrongsFrom(dec(a, p - K), mulWrongs()), ar: `اضرب العدد ${X} في ${P}.`, en: `Multiply ${X} by ${P}.` };
  if (k === 1) return { eq: `${X} ÷ ${P}`, answer: dec(a, p + K), wrongs: wrongsFrom(dec(a, p + K), [dec(a, p + K - 1), dec(a, p + K + 1), dec(a, p - K), dec(a, p)].filter(c => c !== dec(a, p + K))), ar: `اقسم العدد ${X} على ${P}.`, en: `Divide ${X} by ${P}.` };
  if (k === 2) {
    const times = rng() < 0.5, Y = times ? dec(a, p - K) : dec(a, p + K);
    return { eq: `${X} ${times ? '×' : '÷'} ? = ${Y}`, answer: String(P), wrongs: wrongsFrom(String(P), [10, 100, 1000, 10000, 1].filter(x => x !== P).map(String)), ar: `أكمل: ${X} ${times ? '×' : '÷'} ؟ = ${Y}`, en: `Complete: ${X} ${times ? '×' : '÷'} ? = ${Y}` };
  }
  if (k === 3) {
    const times = rng() < 0.5, dir = times ? 'اليمين' : 'اليسار', flip = times ? 'اليسار' : 'اليمين', ans = `${placesWords(K)} إلى ${dir}`;
    const others = [1, 2, 3].filter(x => x !== K);
    return { eq: `places ${X} ${times ? '×' : '÷'} ${P}`, answer: ans, wrongs: wrongsFrom(ans, [`${placesWords(K)} إلى ${flip}`, ...others.map(x => `${placesWords(x)} إلى ${dir}`), ...others.map(x => `${placesWords(x)} إلى ${flip}`)]), ar: `عند ${times ? 'ضرب' : 'قسمة'} العدد ${X} ${times ? 'في' : 'على'} ${P}، إلى أي جهة تنتقل الفاصلة العشرية وبكم منزلة؟`, en: `When ${X} is ${times ? 'multiplied' : 'divided'} by ${P}, which way does the decimal point move and by how many places?` };
  }
  if (k === 4) {
    // a pen costs under 5 dinars: «0.45», «1.25», «0.075»
    let c = 0;
    do { c = int(rng, 10 ** (p - 1) + 1, 5 * 10 ** p - 1); } while (c % 10 === 0);
    const price = dec(c, p);
    return { eq: `pens ${price} × ${P}`, answer: dec(c, p - K), wrongs: wrongsFrom(dec(c, p - K), mulWrongs(c)), ar: `ثمن القلم الواحد ${price} دينار. كم دينارًا ثمن ${pens(P)}؟`, en: `One pen costs ${price} dinars. How many dinars do ${P} pens cost?`, word: true };
  }
  // units: ×100 or ×1000 one way, ÷ the other
  const [big, small, f] = pick(rng, [['م', 'سم', 100], ['كغ', 'غ', 1000], ['لتر', 'مل', 1000]] as Array<[string, string, number]>);
  const kk = Math.log10(f), toSmall = rng() < 0.5;
  const pp = p;
  if (toSmall) return { eq: `convert ${dec(a, pp)} ${big}`, answer: dec(a, pp - kk), wrongs: wrongsFrom(dec(a, pp - kk), [dec(a, pp - kk + 1), dec(a, pp - kk - 1), dec(a, pp + kk), dec(a, pp)]), ar: `حوّل ${dec(a, pp)} ${big} إلى ${small}.`, en: `Convert ${dec(a, pp)} ${big} to ${small}.` };
  return { eq: `convert ${dec(a, pp)} ${small}`, answer: dec(a, pp + kk), wrongs: wrongsFrom(dec(a, pp + kk), [dec(a, pp + kk - 1), dec(a, pp + kk + 1), dec(a, pp - kk), dec(a, pp)]), ar: `حوّل ${dec(a, pp)} ${small} إلى ${big}.`, en: `Convert ${dec(a, pp)} ${small} to ${big}.` };
});

// ─── «الزمن»: the 24-hour clock ─────────────────────────────────────────────────────────

const two = (n: number) => String(n).padStart(2, '0');
const t24 = (minutes: number) => { const m = ((minutes % 1440) + 1440) % 1440; return `${two(Math.floor(m / 60))}:${two(m % 60)}`; };
const t12 = (h: number, m: number) => `${h % 12 === 0 ? 12 : h % 12}:${two(m)} ${h < 12 ? 'ص' : 'م'}`;
const hoursWord = (n: number) => (n === 1 ? 'ساعة واحدة' : n === 2 ? 'ساعتين' : n <= 10 ? `${n} ساعات` : `${n} ساعة`);
const minutesWord = (n: number) => (n <= 10 ? `${n} دقائق` : `${n} دقيقة`);

const time24 = T('time_24h_g5', /^الزمن$/, ({ rng, diff }) => {
  // about four in five times of day fall after noon, where 24-hour time and 12-hour time differ
  const afternoon = () => rng() < 0.8;
  const step = diff === 'easy' ? 15 : 5;
  const minutePart = () => step * int(rng, 0, Math.floor(55 / step));
  const k = pick(rng, [0, 0, 1, 1, 2, 2, 3, 4, 5, 6]);
  if (k === 0) {
    const h = afternoon() ? int(rng, 13, 23) : int(rng, 0, 12), m = minutePart();
    const ans = t12(h, m);
    const swapped = ans.replace(h < 12 ? 'ص' : 'م', h < 12 ? 'م' : 'ص');
    return { eq: `24→12 ${two(h)}:${two(m)}`, answer: ans, wrongs: wrongsFrom(ans, [swapped, t12((h + 1) % 24, m), t12((h + 23) % 24, m)], j => t12(h, (m + 5 * Math.abs(j)) % 60)), ar: `الساعة ${two(h)}:${two(m)} بتوقيت 24 ساعةً. كيف تُكتب بتوقيت 12 ساعةً؟`, en: `The time is ${two(h)}:${two(m)} on the 24-hour clock. How is it written on the 12-hour clock?` };
  }
  if (k === 1) {
    const pm = afternoon(), h12 = int(rng, 1, 12), m = minutePart();
    const h24 = (h12 % 12) + (pm ? 12 : 0), ans = `${two(h24)}:${two(m)}`;
    const cand = [`${two(h12)}:${two(m)}`, `${two((h24 + 12) % 24)}:${two(m)}`, `${two((h12 + 10) % 24)}:${two(m)}`, `${two((h24 + 1) % 24)}:${two(m)}`];
    return { eq: `12→24 ${h12}:${two(m)} ${pm ? 'م' : 'ص'}`, answer: ans, wrongs: wrongsFrom(ans, cand, j => `${two(h24)}:${two((m + 5 * Math.abs(j)) % 60)}`), ar: `اكتب الوقت ${h12}:${two(m)} ${pm ? 'م' : 'ص'} بتوقيت 24 ساعةً.`, en: `Write ${h12}:${two(m)} ${pm ? 'p.m.' : 'a.m.'} on the 24-hour clock.` };
  }
  if (k === 2) {
    const start = (afternoon() ? int(rng, 12, 18) : int(rng, 5, 11)) * 60 + minutePart();
    const len = step === 15 ? 60 * int(rng, 1, 6) + 15 * int(rng, 0, 3) : 60 * int(rng, 1, 6) + 5 * int(rng, 0, 11);
    const end = start + (start + len >= 1440 ? 120 : len);
    const real = end - start;
    return { eq: `bus ${t24(start)} → ${t24(end)}`, answer: String(real), wrongs: wrongsFrom(String(real), [real + 60, real - 60, real + 10, Math.abs(end - start - 12 * 60), (Math.floor(real / 60)) * 100 + (real % 60)].filter(x => x > 0).map(String)), ar: `انطلقت حافلة الساعة ${t24(start)} ووصلت الساعة ${t24(end)}. كم دقيقة استغرقت الرحلة؟`, en: `A bus left at ${t24(start)} and arrived at ${t24(end)}. How many minutes did the trip take?` };
  }
  if (k === 3) {
    const start = (afternoon() ? int(rng, 13, 19) : int(rng, 6, 11)) * 60 + minutePart();
    const hh = int(rng, 1, 3), mm = pick(rng, [0, 10, 15, 20, 25, 30, 40, 45, 50]);
    const endMin = start + hh * 60 + mm, ans = t24(endMin);
    const dur = `${hoursWord(hh)}${mm ? ` و ${minutesWord(mm)}` : ''}`;
    return { eq: `show ${t24(start)} + ${hh}h ${mm}`, answer: ans, wrongs: wrongsFrom(ans, [t24(endMin + 60), t24(endMin - 60), t24(start + hh * 60), t24(start + mm), t24(endMin + 40)], j => t24(endMin + 10 * j)), ar: `بدأ عرض مسرحي الساعة ${t24(start)} واستمر ${dur}. متى انتهى بتوقيت 24 ساعةً؟`, en: `A play started at ${t24(start)} and lasted ${hh} h ${mm} min. When did it end on the 24-hour clock?` };
  }
  if (k === 4) {
    const end = (afternoon() ? int(rng, 14, 21) : int(rng, 8, 11)) * 60 + minutePart();
    const len = step === 15 ? 15 * int(rng, 2, 6) : 5 * int(rng, 3, 19), start = end - len;
    return { eq: `lesson ${t24(end)} − ${len}`, answer: t24(start), wrongs: wrongsFrom(t24(start), [t24(end + len), t24(start - 60), t24(start + 60), t24(end - len - 10), t24(end - 60)], j => t24(start + 5 * j)), ar: `انتهى الدرس الساعة ${t24(end)} وكان قد استمر ${len} دقيقة. متى بدأ بتوقيت 24 ساعةً؟`, en: `A lesson ended at ${t24(end)} after ${len} minutes. When did it start on the 24-hour clock?` };
  }
  if (k === 5) {
    const h = int(rng, 3, 9), m = pick(rng, [15, 20, 25, 35, 40, 45, 50, 55]), ans = h * 60 + m;
    return { eq: `${h}h ${m}m`, answer: String(ans), wrongs: wrongsFrom(String(ans), [h + m, h * 100 + m, h * 60, (h + 1) * 60 + m, h * 60 - m].filter(x => x > 0).map(String)), ar: `كم دقيقة في ${h} ساعات و ${m} دقيقة؟`, en: `How many minutes are in ${h} hours and ${m} minutes?` };
  }
  const mn = int(rng, 3, 9);
  if (rng() < 0.5) {
    const s = pick(rng, [15, 20, 30, 45, 50]), ans = mn * 60 + s;
    return { eq: `${mn}m ${s}s`, answer: String(ans), wrongs: wrongsFrom(String(ans), [mn + s, mn * 100 + s, mn * 60, (mn + 1) * 60 + s, mn * 60 - s].map(String)), ar: `كم ثانية في ${mn} دقائق و ${s} ثانية؟`, en: `How many seconds are in ${mn} minutes and ${s} seconds?` };
  }
  return { eq: `${mn}m`, answer: String(mn * 60), wrongs: wrongsFrom(String(mn * 60), [mn * 100, mn * 10, mn + 60, (mn + 1) * 60].map(String)), ar: `كم ثانية في ${mn} دقائق؟`, en: `How many seconds are in ${mn} minutes?` };
});

/** Registered ahead of the shared generators in `topics.ts` — the lesson-specific ones win. */
export const G5_LESSON_TOPICS: readonly Topic[] = [fracCompareG5, fracAddG5, fracSubG5, thousandths, decConvertG5, decShift, time24];
