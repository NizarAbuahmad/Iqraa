/**
 * Computed maths items for lessons the Grade 1–6 operation drills and the
 * Grade 10 bank do not reach — factors, rounding, integers, ratio, exponent
 * laws and so on.
 *
 * Same rule as `elementary.ts`: the lesson TITLE picks the generator, the grade
 * sizes the numbers, and every answer is computed from the numbers in the stem,
 * never typed. A title no generator is about is refused (`topicFor` → null),
 * not handed something nearby.
 *
 * Each stem is self-contained: it reads as a question with no options, because
 * the same item is also served as short-answer, fill-in-the-blank and
 * true/false.
 */
import type { ConcreteItem, DiffTier } from './index.ts';
import { fixedDec, fmtDec, fold, frac } from './elementary.ts';
import { ALGEBRA_TOPICS } from './algebra.ts';
import { GEOMETRY_TOPICS } from './geometry.ts';
import { STATS_TOPICS } from './stats.ts';
import { PROPORTION_TOPICS } from './proportion.ts';
import { EARLY_TOPICS } from './early.ts';
import { FRESH_DRAWS, servedFrames, spreadScore, stemFrame } from './stemFrame.ts';
import {
  gcd, int, lcm, mixed, nz, numWrongs, numerator, paren, pick, sfrac, signed, sup, tier, valueOf, wrongsFrom,
  type Ctx, type Draft, type Rng, type Topic,
} from './topicKit.ts';

// ─── rounding and estimating ────────────────────────────────────────────────

const PLACE_AR: Record<number, string> = { 10: 'عشرة', 100: 'مئة', 1000: 'ألف', 10000: 'عشرة آلاف' };
const PLACE_EN: Record<number, string> = { 10: 'ten', 100: 'hundred', 1000: 'thousand', 10000: 'ten thousand' };
const roundTo = (n: number, place: number) => Math.round(n / place) * place;
/** Round to the greatest place: 4 872 → 5 000, 38 → 40. */
const lead = (n: number) => { const p = 10 ** (String(Math.round(n)).length - 1); return p === 1 ? n : roundTo(n, p); };

/**
 * A counted noun after a numeral, which goes by the numeral's last two digits:
 * «5 أيام», «12 يومًا», «300 يوم». Only used for n ≥ 3.
 */
const counted = (n: number, plural: string, acc: string, gen: string) => {
  const r = n % 100;
  return `${n} ${r >= 3 && r <= 10 ? plural : r >= 11 ? acc : gen}`;
};

/** Shuffled with the item's own rng, so a draw stays reproducible. */
function shuffle<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/**
 * «Which of these…» items list their options inside the stem: the same item is
 * also served as short answer, where there are no options to read.
 */
const listed = (rng: Rng, answer: string, wrongs: readonly string[]) => {
  const xs = shuffle(rng, [answer, ...wrongs]);
  return { ar: xs.join(' ، '), en: xs.join(', ') };
};

/** Largest number a grade's rounding lesson works with: 3 digits in Grade 2, 4 in Grade 3, 5 in Grade 4. */
const roundCap = (grade: number) => (grade <= 2 ? 999 : grade <= 3 ? 9999 : grade <= 4 ? 99999 : 999999);

/**
 * Round a number; the edge of a rounding interval (the smallest/largest whole
 * number that rounds to 40); and which of four numbers rounds to a value.
 */
const roundWhole: Topic = {
  id: 'round_whole', match: /تقريب(?!.*عشري)/, grades: [2, 6],
  make({ rng, diff, grade }) {
    const place = pick(rng, diff === 'easy' ? [10] : grade <= 2 || diff === 'medium' ? [10, 100] : grade <= 3 ? [10, 100, 1000] : [10, 100, 1000, 10000]);
    const P = PLACE_AR[place]!, PE = PLACE_EN[place]!;
    const cap = roundCap(grade);
    const half = place / 2;
    const k = pick(rng, [0, 1, 2]);
    if (k === 0) {
      const n = int(rng, place * 3 + 1, Math.min(place * (diff === 'easy' ? 30 : 90) + place - 1, cap));
      if (n % place === 0) return roundWhole.make({ rng, diff, grade });
      const a = roundTo(n, place);
      return {
        eq: `${n}`, answer: String(a),
        wrongs: numWrongs(a, [Math.floor(n / place) * place, Math.ceil(n / place) * place, roundTo(n, place * 10), roundTo(n, place / 10)].filter(x => x !== n)),
        ar: `قرّب العدد ${n} إلى أقرب ${P}.`,
        en: `Round ${n} to the nearest ${PE}.`,
      };
    }
    const a = place * int(rng, 2, Math.min(diff === 'easy' ? 9 : 30, Math.floor(cap / place) - 1));
    if (k === 1) {
      // 35 is the smallest whole number that rounds to 40, and 44 the largest
      const small = rng() < 0.5;
      const ans = small ? a - half : a + half - 1;
      return {
        eq: `${a}`, answer: String(ans),
        wrongs: numWrongs(ans, small ? [a - half - 1, a - place, a, a - half + 1] : [a + half, a + place - 1, a, a + half - 2]),
        ar: `ما ${small ? 'أصغر' : 'أكبر'} عدد كلي يُقرَّب إلى ${a} عند تقريبه إلى أقرب ${P}؟`,
        en: `What is the ${small ? 'smallest' : 'largest'} whole number that rounds to ${a} to the nearest ${PE}?`,
      };
    }
    // one number inside the interval; one below it, the boundary just above it (75 → 80), one above it
    let off = int(rng, -half, half - 1);
    if (off === 0) off = -1;
    const ans = String(a + off);
    const wrongs = [a - half - int(rng, 1, half), a + half, a + half + int(rng, 1, half - 1)].map(String);
    const L = listed(rng, ans, wrongs);
    return {
      eq: L.en, answer: ans, wrongs,
      ar: `أيّ الأعداد الآتية يُقرَّب إلى ${a} عند تقريبه إلى أقرب ${P}: ${L.ar}؟`,
      en: `Which of these numbers rounds to ${a} to the nearest ${PE}: ${L.en}?`,
    };
  },
};

/** Rounding a decimal to a whole number, a tenth or (Grade 5) a hundredth; a measure to round; which number rounds to a whole. */
const roundDec: Topic = {
  id: 'round_dec', match: /تقريب.*عشري/, grades: [4, 6],
  make({ rng, diff, grade }) {
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      // a measurement read off a scale, rounded to the nearest whole unit
      const raw = int(rng, 101, diff === 'easy' ? 999 : 9999); // hundredths
      if (raw % 100 === 0) return roundDec.make({ rng, diff, grade });
      const shown = fmtDec(raw, 2);
      const a = Math.round(raw / 100);
      const [ar, en] = pick(rng, [
        [`كتلة حقيبة ${shown} كغ. قرّب كتلتها إلى أقرب كيلوغرام.`, `A bag has a mass of ${shown} kg. Round its mass to the nearest kilogram.`],
        [`طول طاولة ${shown} م. قرّب طولها إلى أقرب متر.`, `A table is ${shown} m long. Round its length to the nearest metre.`],
      ] as const);
      return { eq: shown, answer: String(a), wrongs: numWrongs(a, [Math.floor(raw / 100), Math.ceil(raw / 100), Math.round(raw / 10) / 10, a + 1].filter(v => v !== a)), ar, en };
    }
    if (k === 2) {
      // which of four tenths rounds to t: one inside [t − 0.5, t + 0.5), one below, the boundary t + 0.5, one above
      const t = int(rng, 2, diff === 'easy' ? 20 : 99);
      let off = int(rng, -5, 4);
      if (off === 0) off = 3;
      const ans = fmtDec(t * 10 + off, 1);
      const wrongs = [t * 10 - 5 - int(rng, 1, 5), t * 10 + 5, t * 10 + 5 + int(rng, 1, 4)].map(v => fmtDec(v, 1));
      const L = listed(rng, ans, wrongs);
      return {
        eq: L.en, answer: ans, wrongs,
        ar: `أيّ الأعداد الآتية يُقرَّب إلى ${t} عند تقريبه إلى أقرب عدد كلي: ${L.ar}؟`,
        en: `Which of these numbers rounds to ${t} to the nearest whole number: ${L.en}?`,
      };
    }
    const places = diff === 'easy' ? 0 : grade <= 4 ? pick(rng, [0, 1]) : pick(rng, [0, 1, 2]);
    const raw = int(rng, 1001, 99999); // thousandths
    const scale = 10 ** (3 - places);
    if (raw % scale === 0) return roundDec.make({ rng, diff, grade });
    const r = Math.round(raw / scale);
    const a = fixedDec(r, places);
    const shown = fmtDec(raw, 3);
    const lower = fixedDec(Math.floor(raw / scale), places), upper = fixedDec(Math.ceil(raw / scale), places);
    const otherPlaces = places === 0 ? 1 : 0;
    const other = fixedDec(Math.round(raw / 10 ** (3 - otherPlaces)), otherPlaces);
    const where = places === 0 ? ['أقرب عدد كلي', 'the nearest whole number'] : places === 1 ? ['أقرب جزء من عشرة', 'the nearest tenth'] : ['أقرب جزء من مئة', 'the nearest hundredth'];
    return {
      eq: shown, answer: a,
      wrongs: wrongsFrom(a, [lower, upper, other, fixedDec(Math.round(raw / 10), 2), fmtDec(raw, 3)], j => fixedDec(r + j, places)),
      ar: `قرّب العدد ${shown} إلى ${where[0]}.`,
      en: `Round ${shown} to ${where[1]}.`,
    };
  },
};

/**
 * «تقدير ناتج الجمع» estimates sums only, «…الطرح» differences only, «المجموع
 * والفرق» either. Rounding to the greatest place, rounding to the nearest ten
 * or hundred (the Grade 2 objective), and a word problem.
 */
const estSum = (id: string, match: RegExp, mode: 'add' | 'sub' | 'both'): Topic => {
  const make = (c: Ctx): Draft => {
    const { rng, diff, grade } = c;
    const digits = Math.min(grade <= 2 ? 3 : 4, diff === 'easy' ? 2 : diff === 'medium' ? 3 : 4);
    let a = 0, b = 0, add = true;
    do {
      a = int(rng, 10 ** (digits - 1) + 1, 10 ** digits - 1);
      b = int(rng, 10 ** (digits - 1) + 1, a);
      add = mode === 'both' ? rng() < 0.5 : mode === 'add';
    } while (!add && lead(a) === lead(b));
    const exact = add ? a + b : a - b;
    const op = add ? '+' : '−';
    const byLead = add ? lead(a) + lead(b) : lead(a) - lead(b);
    const k = pick(rng, [0, 1, 2, 3, 4]);
    if (k === 3) {
      // judging an answer's size: which round number is nearest the real result
      const place = digits === 2 ? 10 : pick(rng, [10, 100]);
      const ans = roundTo(exact, place);
      if (exact % place === place / 2 || ans <= 0) return make(c);
      const near = shuffle(rng, [ans - place, ans + place]).filter(x => x > 0);
      const far = shuffle(rng, [ans + 2 * place, ans - 2 * place]).filter(x => x > 0);
      const wrongs = [...near, ...far, ans + 3 * place].slice(0, 3).map(String);
      const L = listed(rng, String(ans), wrongs);
      return {
        eq: `${a} ${op} ${b}`, answer: String(ans), wrongs,
        ar: `أيّ الأعداد الآتية أقرب إلى ناتج ${a} ${op} ${b}: ${L.ar}؟`,
        en: `Which of these numbers is closest to ${a} ${op} ${b}: ${L.en}?`,
      };
    }
    if (k === 4) {
      // working back from an estimate: the other number, rounded
      const place = digits === 2 ? 10 : pick(rng, [10, 100]);
      const ra = roundTo(a, place), rb = roundTo(b, place);
      const est = add ? ra + rb : ra - rb;
      if (est <= 0 || rb <= 0) return make(c);
      const P = PLACE_AR[place]!, PE = PLACE_EN[place]!;
      const slip = add ? est - a : a - est; // the shown number used without rounding it
      const wrongs = numWrongs(rb, [slip, rb + place, rb - place, b].filter(x => x > 0 && x !== rb));
      return add
        ? {
          eq: `${a}, ${est}`, answer: String(rb), wrongs,
          ar: `قرّبت سلمى عددين إلى أقرب ${P} ثم جمعتهما، فكان التقدير ${est}. إذا كان أحد العددين ${a}، فما العدد الآخر بعد تقريبه؟`,
          en: `Salma rounded two numbers to the nearest ${PE} and added them; her estimate was ${est}. If one number is ${a}, what is the other number after rounding?`,
        }
        : {
          eq: `${a}, ${est}`, answer: String(rb), wrongs,
          ar: `قرّبت سلمى عددين إلى أقرب ${P} ثم طرحت الأصغر من الأكبر، فكان التقدير ${est}. إذا كان العدد الأكبر ${a}، فما العدد الأصغر بعد تقريبه؟`,
          en: `Salma rounded two numbers to the nearest ${PE} and subtracted the smaller from the larger; her estimate was ${est}. If the larger number is ${a}, what is the smaller number after rounding?`,
        };
    }
    if (k === 0) {
      return {
        eq: `${a} ${op} ${b}`, answer: String(byLead),
        wrongs: numWrongs(byLead, [exact, add ? roundTo(a, 10) + roundTo(b, 10) : roundTo(a, 10) - roundTo(b, 10), byLead * 10, byLead / 10].filter(x => Number.isInteger(x) && x >= 0 && x !== byLead)),
        ar: `قدّر ناتج ${a} ${op} ${b} بتقريب كل عدد إلى أكبر منزلة له.`,
        en: `Estimate ${a} ${op} ${b} by rounding each number to its greatest place.`,
      };
    }
    const place = digits === 2 ? 10 : pick(rng, [10, 100]);
    const est = add ? roundTo(a, place) + roundTo(b, place) : roundTo(a, place) - roundTo(b, place);
    if (est <= 0) return make(c);
    const P = PLACE_AR[place]!, PE = PLACE_EN[place]!;
    const wrongs = numWrongs(est, [exact, byLead, est + place, est - place].filter(x => x >= 0 && x !== est));
    if (k === 1) {
      return {
        eq: `${a} ${op} ${b}`, answer: String(est), wrongs,
        ar: `قدّر ناتج ${a} ${op} ${b} بتقريب كل عدد إلى أقرب ${P}.`,
        en: `Estimate ${a} ${op} ${b} by rounding each number to the nearest ${PE}.`,
      };
    }
    return add
      ? {
        eq: `${a} + ${b}`, answer: String(est), wrongs,
        ar: `كان عدد زوّار معرض الكتاب ${a} في اليوم الأول، و${b} في اليوم الثاني. قدّر عدد الزوّار في اليومين معًا بتقريب كل عدد إلى أقرب ${P}.`,
        en: `A book fair had ${a} visitors on the first day and ${b} on the second. Estimate the visitors over both days by rounding each number to the nearest ${PE}.`,
      }
      : {
        eq: `${a} − ${b}`, answer: String(est), wrongs,
        ar: `كان عدد الكتب في مكتبة المدرسة ${a}، وأعار الطلبة منها ${b}. قدّر عدد الكتب الباقية في المكتبة بتقريب كل عدد إلى أقرب ${P}.`,
        en: `A school library had ${a} books and students borrowed ${b} of them. Estimate the books left by rounding each number to the nearest ${PE}.`,
      };
  };
  return { id, match, grades: [2, 6], make };
};

/** Decimals rounded to the nearest whole number or the nearest ten (the Grade 5 objective), and a measurement problem. */
const estSumDec: Topic = {
  id: 'est_sum_dec', match: /تقدير.*عشري/, grades: [5, 6],
  make({ rng, diff, grade }) {
    const k = pick(rng, [0, 1, 2]);
    if (k === 0) {
      const a = int(rng, 11, diff === 'easy' ? 99 : 999) / 10 + int(rng, 0, 9) / 100;
      const b = int(rng, 11, diff === 'easy' ? 99 : 999) / 10 + int(rng, 0, 9) / 100;
      const [x, y] = [Math.round(a * 100) / 100, Math.round(b * 100) / 100];
      const hi = Math.max(x, y), lo = Math.min(x, y);
      const add = rng() < 0.5;
      const est = add ? Math.round(hi) + Math.round(lo) : Math.round(hi) - Math.round(lo);
      const exact = add ? hi + lo : hi - lo;
      const op = add ? '+' : '−';
      return {
        eq: `${hi} ${op} ${lo}`, answer: String(est),
        wrongs: numWrongs(est, [Math.round(exact * 10) / 10 === est ? NaN : Math.round(exact), Math.floor(exact), est + 10, Math.max(0, est - 10)].filter(v => v !== est)),
        ar: `قدّر ناتج ${hi} ${op} ${lo} بتقريب كل عدد إلى أقرب عدد كلي.`,
        en: `Estimate ${hi} ${op} ${lo} by rounding each number to the nearest whole number.`,
      };
    }
    // in hundredths, so nothing is rounded by floating point
    const top = k === 1 ? (diff === 'easy' ? 9999 : 99999) : (diff === 'easy' ? 2999 : 9999);
    const A = int(rng, 1501, top), B = int(rng, 1501, top);
    const hi = Math.max(A, B), lo = Math.min(A, B);
    const add = rng() < 0.5;
    const unit = k === 1 ? 1000 : 100; // a ten, or a whole one
    const r = (v: number) => Math.round(v / unit) * (unit / 100);
    const est = add ? r(hi) + r(lo) : r(hi) - r(lo);
    if (est <= 0 || hi === lo || hi % 100 === 0 || lo % 100 === 0) return estSumDec.make({ rng, diff, grade });
    const byWhole = add ? Math.round(hi / 100) + Math.round(lo / 100) : Math.round(hi / 100) - Math.round(lo / 100);
    const exact = (add ? hi + lo : hi - lo) / 100;
    const step = unit / 100;
    const wrongs = numWrongs(est, [k === 1 ? byWhole : Math.trunc(exact), Math.ceil(exact), est + step, est - step].filter(v => v >= 0 && v !== est));
    const [x, y] = [fmtDec(hi, 2), fmtDec(lo, 2)];
    const op = add ? '+' : '−';
    if (k === 1) {
      return {
        eq: `${x} ${op} ${y}`, answer: String(est), wrongs,
        ar: `قدّر ناتج ${x} ${op} ${y} بتقريب كل عدد إلى أقرب عشرة.`,
        en: `Estimate ${x} ${op} ${y} by rounding each number to the nearest ten.`,
      };
    }
    return add
      ? {
        eq: `${x} + ${y}`, answer: String(est), wrongs,
        ar: `قطع عدّاء ${x} كم يوم السبت، و${y} كم يوم الأحد. قدّر المسافة التي قطعها في اليومين بتقريب كل مسافة إلى أقرب كيلومتر.`,
        en: `A runner ran ${x} km on Saturday and ${y} km on Sunday. Estimate the total distance by rounding each distance to the nearest kilometre.`,
      }
      : {
        eq: `${x} − ${y}`, answer: String(est), wrongs,
        ar: `حبل طوله ${x} م، قُصّ منه ${y} م. قدّر طول الجزء الباقي بتقريب كل طول إلى أقرب متر.`,
        en: `A rope is ${x} m long and ${y} m is cut off. Estimate the length left by rounding each length to the nearest metre.`,
      };
  },
};

/** Estimate by rounding to the greatest place; the same in a word problem; and using an estimate to pick the real product. */
const estProd: Topic = {
  id: 'est_prod', match: /تقدير.*ضرب/, grades: [3, 6],
  make({ rng, diff, grade }) {
    const a = grade <= 3 ? int(rng, 11, 99) : int(rng, diff === 'easy' ? 11 : 101, diff === 'easy' ? 99 : 899);
    const b = grade <= 3 ? int(rng, 2, 9) : int(rng, 11, diff === 'hard' ? 99 : 59);
    const est = lead(a) * lead(b);
    const k = pick(rng, [0, 1, 2]);
    if (k === 2) {
      // the product and three numbers an estimate rules out: a place too many, a place too few, about double
      const p = a * b;
      const wrongs = [p * 10, Math.floor(p / 10), p + est].map(String);
      const L = listed(rng, String(p), wrongs);
      return {
        eq: `${a} × ${b}`, answer: String(p), wrongs,
        ar: `استعمل التقدير لتحديد أيّ الأعداد الآتية هو ناتج ${a} × ${b}: ${L.ar}؟`,
        en: `Use an estimate to decide which of these is ${a} × ${b}: ${L.en}?`,
      };
    }
    const wrongs = numWrongs(est, [a * b, est * 10, est / 10, lead(a) * b]);
    if (k === 1) {
      if (b < 3) return estProd.make({ rng, diff, grade }); // «صندوقان» takes no numeral
      return {
        eq: `${a} × ${b}`, answer: String(est), wrongs,
        ar: `في مستودع ${counted(b, 'صناديق', 'صندوقًا', 'صندوق')}، في كل منها ${counted(a, 'أقلام', 'قلمًا', 'قلم')}. قدّر عدد الأقلام في المستودع بتقريب كل عدد إلى أكبر منزلة له.`,
        en: `A store room has ${b} boxes with ${a} pens in each. Estimate the number of pens by rounding each number to its greatest place.`,
      };
    }
    return {
      eq: `${a} × ${b}`, answer: String(est), wrongs,
      ar: `قدّر ناتج ${a} × ${b} بتقريب كل عدد إلى أكبر منزلة له.`,
      en: `Estimate ${a} × ${b} by rounding each number to its greatest place.`,
    };
  },
};

/** Estimate by rounding the dividend; with compatible numbers (the Grade 5 objective); and a word problem. */
const estQuot: Topic = {
  id: 'est_quot', match: /تقدير.*قسم/, grades: [3, 6],
  make({ rng, diff, grade }) {
    const k = pick(rng, [0, 1, 2]);
    const d = k === 2 ? int(rng, 3, 9) : int(rng, 2, 9);
    const q = int(rng, 2, 9);
    const m = diff === 'easy' || grade <= 3 ? 1 : pick(rng, [1, 2]);
    const unit = 10 ** m;
    const est = q * unit;
    if (k === 1) {
      // compatible numbers: the multiple of d × unit nearest the dividend, then a basic fact
      const M = d * unit;
      const noise = int(rng, -(Math.ceil(M / 2) - 1), Math.ceil(M / 2) - 1);
      const n = q * M + noise;
      if (noise === 0 || n % unit === 0) return estQuot.make({ rng, diff, grade });
      return {
        eq: `${n} ÷ ${d}`, answer: String(est),
        wrongs: numWrongs(est, [Math.floor(n / d), q, est * 10, est + unit].filter(v => v !== est)),
        ar: `قدّر ناتج ${n} ÷ ${d} باستعمال الأعداد المتناغمة (أقرب عدد إلى ${n} من مضاعفات ${M}).`,
        en: `Estimate ${n} ÷ ${d} using compatible numbers (the multiple of ${M} nearest to ${n}).`,
      };
    }
    const noise = int(rng, -(unit / 2 - 1), unit / 2 - 1);
    if (noise === 0) return estQuot.make({ rng, diff, grade }); // a dividend already rounded leaves nothing to estimate
    const n = d * q * unit + noise;
    const wrongs = numWrongs(est, [Math.floor(n / d), est * 10, est / 10, est + unit].filter(v => v !== est));
    if (k === 2) {
      return {
        eq: `${n} ÷ ${d}`, answer: String(est), wrongs,
        ar: `دفع نادٍ ${counted(n, 'دنانير', 'دينارًا', 'دينار')} ثمنًا لـ ${d} دراجات هوائية متماثلة. قدّر ثمن الدراجة الواحدة بالدينار بتقريب ${n} إلى أقرب ${PLACE_AR[unit]}.`,
        en: `A club paid ${n} dinars for ${d} identical bicycles. Estimate the price of one bicycle by rounding ${n} to the nearest ${PLACE_EN[unit]}.`,
      };
    }
    return {
      eq: `${n} ÷ ${d}`, answer: String(est), wrongs,
      ar: `قدّر ناتج ${n} ÷ ${d} بتقريب ${n} إلى أقرب ${PLACE_AR[unit]}.`,
      en: `Estimate ${n} ÷ ${d} by rounding ${n} to the nearest ${PLACE_EN[unit]}.`,
    };
  },
};

/** Multiply by multiples of ten: compute, find the missing factor, extend a basic fact, and a word problem. */
const tensMul: Topic = {
  id: 'tens_mul', match: /الضرب في مضاعفات/, grades: [4, 4],
  make({ rng, diff }) {
    const a = int(rng, 2, 9), b = int(rng, 2, 9);
    const k = int(rng, 1, diff === 'easy' ? 1 : 3);
    const j = diff === 'hard' ? int(rng, 1, 2) : 0;
    const x = a * 10 ** k, y = b * 10 ** j;
    const ans = x * y;
    const text = `${x} × ${y}`;
    const kind = pick(rng, [0, 1, 2, 3]);
    if (kind === 1) {
      // the missing factor: a × ▢ = product
      const f = b * 10 ** k;
      return {
        eq: `${a} × ? = ${a * f}`, answer: String(f),
        wrongs: numWrongs(f, [f * 10, f / 10, b, a * f]),
        ar: `ما العدد المناسب مكان ▢ لتصبح الجملة صحيحة: ${a} × ▢ = ${a * f}؟`,
        en: `What number goes in ▢ to make this true: ${a} × ▢ = ${a * f}?`,
      };
    }
    const wrongs = numWrongs(ans, [ans * 10, ans / 10, a * b]);
    if (kind === 2) {
      return {
        eq: text, answer: String(ans), wrongs,
        ar: `إذا كان ${a} × ${b} = ${a * b}، فما ناتج ${text}؟`,
        en: `If ${a} × ${b} = ${a * b}, what is ${text}?`,
      };
    }
    if (kind === 3) {
      const boxes = int(rng, 3, 9);
      const each = a * 10 ** k;
      const tot = each * boxes;
      return {
        eq: `${each} × ${boxes}`, answer: String(tot), wrongs: numWrongs(tot, [tot * 10, tot / 10, a * boxes]),
        ar: `في كل صندوق ${counted(each, 'تفاحات', 'تفاحةً', 'تفاحة')}. كم تفاحةً في ${boxes} صناديق؟`,
        en: `Each box holds ${each} apples. How many apples are in ${boxes} boxes?`,
      };
    }
    return { eq: text, answer: String(ans), wrongs, ar: `أوجد ناتج ${text}.`, en: `Find ${text}.` };
  },
};

/** Divide multiples of ten: compute, extend a basic fact, and share equally in a word problem. */
const tensDiv: Topic = {
  id: 'tens_div', match: /قسمه مضاعفات/, grades: [4, 4],
  make({ rng, diff }) {
    const kind = pick(rng, [0, 1, 2]);
    const c = kind === 2 ? int(rng, 3, 9) : int(rng, 2, 9), q = int(rng, 2, 9);
    const m = int(rng, 1, diff === 'easy' ? 2 : 3);
    const j = diff === 'easy' || kind === 2 ? 0 : 1;
    const n = c * q * 10 ** m, d = c * 10 ** j;
    const ans = n / d;
    const wrongs = numWrongs(ans, [ans * 10, ans / 10, q]);
    if (kind === 1) {
      return {
        eq: `${n} ÷ ${d}`, answer: String(ans), wrongs,
        ar: `إذا كان ${c * q} ÷ ${c} = ${q}، فما ناتج ${n} ÷ ${d}؟`,
        en: `If ${c * q} ÷ ${c} = ${q}, what is ${n} ÷ ${d}?`,
      };
    }
    if (kind === 2) {
      return {
        eq: `${n} ÷ ${d}`, answer: String(ans), wrongs,
        ar: `وُزِّع ${counted(n, 'كتب', 'كتابًا', 'كتاب')} بالتساوي على ${d} مدارس. كم كتابًا نصيب كل مدرسة؟`,
        en: `${n} books are shared equally among ${d} schools. How many books does each school get?`,
      };
    }
    return { eq: `${n} ÷ ${d}`, answer: String(ans), wrongs, ar: `أوجد ناتج ${n} ÷ ${d}.`, en: `Find ${n} ÷ ${d}.` };
  },
};

// ─── number theory ──────────────────────────────────────────────────────────

const divisors = (n: number) => { const o: number[] = []; for (let i = 1; i <= n; i++) if (n % i === 0) o.push(i); return o; };
const isPrime = (n: number) => n > 1 && divisors(n).length === 2;
const primeFactors = (n: number) => { const o: number[] = []; for (let p = 2; n > 1; p++) while (n % p === 0) { o.push(p); n /= p; } return o; };
const range = (lo: number, hi: number) => Array.from({ length: Math.max(0, hi - lo + 1) }, (_, i) => lo + i);

/** How many factors, the largest proper factor, all the factors, and which listed number is not a factor. */
const factors: Topic = {
  id: 'factors', match: /^العوامل$/, grades: [4, 6],
  make({ rng, diff }) {
    const n = int(rng, 6, diff === 'easy' ? 30 : diff === 'medium' ? 60 : 100);
    const ds = divisors(n);
    const k = pick(rng, [0, 1, 2, 3]);
    if (k === 0) {
      const a = ds.length;
      return {
        eq: `${n}`, answer: String(a),
        wrongs: numWrongs(a, [a - 1, a + 1, a + 2, Math.floor(a / 2)]),
        ar: `كم عاملًا للعدد ${n}؟`, en: `How many factors does ${n} have?`,
      };
    }
    const small = ds.filter(x => x > 1 && x < n);
    if (small.length < (k === 3 ? 3 : 1)) return factors.make({ rng, diff, grade: 4 });
    if (k === 1) {
      const f = ds[ds.length - 2]!; // largest factor smaller than n
      return {
        eq: `${n}`, answer: String(f),
        wrongs: numWrongs(f, [f - 1, f + 1, n + f, n - 1].filter(x => x > 0 && n % x !== 0)),
        ar: `ما أكبر عامل للعدد ${n} أصغر من ${n} نفسه؟`,
        en: `What is the largest factor of ${n} that is smaller than ${n}?`,
      };
    }
    const misses = range(2, n - 1).filter(x => n % x !== 0);
    const miss = pick(rng, misses.filter(x => x <= n / 2).length ? misses.filter(x => x <= n / 2) : misses);
    if (k === 2) {
      const ans = ds.join(' ، ');
      const mid = small[Math.floor(small.length / 2)]!;
      const cands = [ds.slice(0, -1), ds.slice(1), ds.filter(x => x !== mid), [...ds, miss].sort((a, b) => a - b)].map(l => l.join(' ، '));
      return {
        eq: `${n}`, answer: ans, wrongs: wrongsFrom(ans, cands, () => ''),
        ar: `اكتب جميع عوامل العدد ${n}.`, en: `List all the factors of ${n}.`,
      };
    }
    const wrongs = shuffle(rng, small).slice(0, 3).map(String);
    const L = listed(rng, String(miss), wrongs);
    return {
      eq: L.en, answer: String(miss), wrongs,
      ar: `أيّ الأعداد الآتية ليس عاملًا للعدد ${n}: ${L.ar}؟`,
      en: `Which of these is not a factor of ${n}: ${L.en}?`,
    };
  },
};

/** The next prime; pick the prime (or the composite) out of four; and count the primes between two composites. */
const primes: Topic = {
  id: 'primes', match: /الاعداد الاوليه/, grades: [4, 6],
  make({ rng, diff }) {
    const k = pick(rng, [0, 1, 2, 3]);
    const top = diff === 'easy' ? 30 : diff === 'medium' ? 60 : 100;
    if (k === 0) {
      const lo = int(rng, 4, diff === 'easy' ? 25 : diff === 'medium' ? 60 : 120);
      let p = lo + 1;
      while (!isPrime(p)) p++;
      const comps = [p + 1, p + 2, p - 1, p - 2, p + 3].filter(x => x > 3 && !isPrime(x));
      return {
        eq: `${lo}`, answer: String(p),
        wrongs: numWrongs(p, comps),
        ar: `ما أصغر عدد أولي أكبر من ${lo}؟`,
        en: `What is the smallest prime number greater than ${lo}?`,
      };
    }
    // odd composites are the ones that look prime; even numbers give themselves away
    const oddComposites = range(9, top).filter(x => x % 2 === 1 && !isPrime(x));
    const oddPrimes = range(11, top).filter(isPrime);
    if (k === 1 || k === 2) {
      const ans = String(k === 1 ? pick(rng, oddPrimes) : pick(rng, oddComposites));
      const wrongs = shuffle(rng, k === 1 ? [...oddComposites, 1] : oddPrimes).slice(0, 3).map(String);
      const L = listed(rng, ans, wrongs);
      return {
        eq: L.en, answer: ans, wrongs,
        ar: k === 1 ? `أيّ الأعداد الآتية عدد أولي: ${L.ar}؟` : `أيّ الأعداد الآتية عدد غير أولي: ${L.ar}؟`,
        en: k === 1 ? `Which of these numbers is prime: ${L.en}?` : `Which of these numbers is not prime: ${L.en}?`,
      };
    }
    // both ends composite, so «between» means the same whether the ends count or not
    let a = int(rng, 4, top - 12);
    while (isPrime(a)) a++;
    let b = a + int(rng, 8, 16);
    while (isPrime(b)) b++;
    const c = range(a + 1, b - 1).filter(isPrime).length;
    return {
      eq: `${a}, ${b}`, answer: String(c),
      wrongs: numWrongs(c, [c + 1, c - 1, range(a + 1, b - 1).filter(x => x % 2 === 1).length].filter(x => x !== c)),
      ar: `كم عددًا أوليًّا يقع بين ${a} و${b}؟`,
      en: `How many prime numbers are there between ${a} and ${b}?`,
    };
  },
};

/** For each divisor, the number it is most often confused with: 4 and 2, 9 and 3, 10 and 5. */
const NEAR_DIVISOR: Record<number, number[]> = { 2: [1], 3: [1], 5: [1], 10: [5, 2], 4: [2], 6: [2, 3], 9: [3] };

/** The missing digit (smallest/largest), which listed number is divisible, and how many listed numbers are. */
const divisibility: Topic = {
  id: 'divisibility', match: /قابليه القسمه/, grades: [4, 5],
  make({ rng, diff, grade }) {
    const pool = grade <= 4 ? [2, 3, 5, 10] : [4, 6, 9];
    const d = pick(rng, pool);
    const len = diff === 'easy' ? 3 : 4;
    const lo = 10 ** (len - 1), hi = 10 ** len - 1;
    const k = pick(rng, [0, 1, 2, 3, 4]);
    if (k === 3) {
      // the next multiple: test the numbers after n with the rule until one passes
      const n = int(rng, lo, hi - 2 * d);
      const ans = (Math.floor(n / d) + 1) * d;
      return {
        eq: `${n}`, answer: String(ans),
        wrongs: numWrongs(ans, [ans - d, ans + d, n + 1, ans + 1].filter(x => x !== ans)),
        ar: `ما أصغر عدد أكبر من ${n} يقبل القسمة على ${d}؟`,
        en: `What is the smallest number greater than ${n} that is divisible by ${d}?`,
      };
    }
    if (k === 4) {
      // one number against every rule of the lesson
      const p0 = pick(rng, pool), n = p0 * int(rng, Math.ceil(lo / p0), Math.floor(hi / p0));
      const yes = pool.filter(p => n % p === 0);
      const show = (xs: number[]) => xs.join(' ، ');
      // the other answers some number could have (never 10 without 2 and 5, or 4 and 9 without 6), one rule away first
      const subsets = [...new Set(range(1, 180).map(x => show(pool.filter(p => x % p === 0))))].filter(Boolean).map(t => t.split(' ، ').map(Number));
      const away = (xs: number[]) => pool.filter(p => xs.includes(p) !== yes.includes(p)).length;
      const cands = shuffle(rng, subsets.filter(xs => away(xs) > 0)).sort((x, y) => away(x) - away(y));
      return {
        eq: `${n}`, answer: show(yes), wrongs: cands.slice(0, 3).map(show),
        ar: `اكتب الأعداد التي يقبل العدد ${n} القسمة عليها من بين الأعداد ${show(pool)}.`,
        en: `List the numbers among ${pool.join(', ')} that ${n} is divisible by.`,
      };
    }
    if (k > 0) {
      const multiple = () => d * int(rng, Math.ceil(lo / d), Math.floor(hi / d));
      // a near miss: divisible by the number d is confused with, but not by d
      const miss = () => { for (;;) { const x = int(rng, lo, hi); const p = pick(rng, NEAR_DIVISOR[d]!); if (x % d !== 0 && x % p === 0) return x; } };
      const fill = (want: number, gen: () => number, into: Set<number>) => { while (into.size < want) into.add(gen()); };
      if (k === 1) {
        const ans = multiple();
        const ws = new Set<number>();
        fill(3, miss, ws);
        const wrongs = [...ws].map(String);
        const L = listed(rng, String(ans), wrongs);
        return {
          eq: L.en, answer: String(ans), wrongs,
          ar: `أيّ الأعداد الآتية يقبل القسمة على ${d}: ${L.ar}؟`,
          en: `Which of these numbers is divisible by ${d}: ${L.en}?`,
        };
      }
      const c = int(rng, 0, 4);
      const yes = new Set<number>(), no = new Set<number>();
      fill(c, multiple, yes);
      fill(4 - c, miss, no);
      const xs = shuffle(rng, [...yes, ...no]);
      return {
        eq: xs.join(', '), answer: String(c),
        wrongs: numWrongs(c, [4 - c, c + 1, c - 1].filter(x => x !== c)),
        ar: `كم عددًا من الأعداد الآتية يقبل القسمة على ${d}: ${xs.join(' ، ')}؟`,
        en: `How many of these numbers are divisible by ${d}: ${xs.join(', ')}?`,
      };
    }
    for (let attempt = 0; attempt < 200; attempt++) {
      const digs = Array.from({ length: len }, () => int(rng, 1, 9));
      const hole = d === 2 || d === 5 || d === 10 ? len - 1 : int(rng, 0, len - 1);
      const ok: number[] = [];
      for (let v = 0; v <= 9; v++) {
        const t = digs.slice(); t[hole] = v;
        if (t[0] === 0) continue;
        if (Number(t.join('')) % d === 0) ok.push(v);
      }
      if (ok.length === 0 || ok.length === 10) continue;
      const wantMax = rng() < 0.4 && ok.length > 1;
      const ans = wantMax ? ok[ok.length - 1]! : ok[0]!;
      const shown = digs.map((x, i) => (i === hole ? '■' : String(x))).join('');
      const bad = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].filter(v => !ok.includes(v));
      return {
        eq: shown, answer: String(ans),
        wrongs: wrongsFrom(String(ans), [...bad, ...ok.filter(v => v !== ans)].slice(0, 6), j => String((ans + j + 10) % 10)),
        ar: `ما ${wantMax ? 'أكبر' : 'أصغر'} رقم يوضع مكان ■ ليصبح العدد ${shown} قابلًا للقسمة على ${d}؟`,
        en: `What is the ${wantMax ? 'largest' : 'smallest'} digit that can replace ■ so that ${shown} is divisible by ${d}?`,
      };
    }
    return divisibility.make({ rng, diff, grade: 4 });
  },
};

/** Factorise; the number a factorisation stands for; and the largest prime factor. */
const primeFact: Topic = {
  id: 'prime_fact', match: /تحليل العدد الي عوامله الاوليه/, grades: [5, 6],
  make({ rng, diff }) {
    let n = 0;
    do { n = int(rng, 12, diff === 'easy' ? 60 : diff === 'medium' ? 150 : 400); } while (isPrime(n) || primeFactors(n).length < 2);
    const fs = primeFactors(n);
    const shown = fs.join(' × ');
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      return {
        eq: shown, answer: String(n),
        wrongs: numWrongs(n, [fs.reduce((a, b) => a + b, 0), n / fs[fs.length - 1]!, n * fs[0]!]),
        ar: `ما العدد الذي تحليله إلى عوامله الأولية هو ${shown}؟`,
        en: `Which number has the prime factorisation ${shown}?`,
      };
    }
    if (k === 2) {
      const top = fs[fs.length - 1]!;
      let next = top + 1;
      while (!isPrime(next)) next++;
      return {
        eq: `${n}`, answer: String(top),
        wrongs: numWrongs(top, [n / fs[0]!, fs[0]!, next, n].filter(x => x !== top)),
        ar: `ما أكبر عامل أولي للعدد ${n}؟`,
        en: `What is the largest prime factor of ${n}?`,
      };
    }
    const cands: string[] = [];
    if (fs.length >= 3) cands.push([fs[0]! * fs[1]!, ...fs.slice(2)].join(' × '));
    cands.push(`${n} × 1`);
    const alt = fs.slice(); alt[alt.length - 1] = alt[alt.length - 1]! + 2; cands.push(alt.join(' × '));
    return {
      eq: `${n}`, answer: shown,
      wrongs: wrongsFrom(shown, cands, j => fs.map((f, i) => (i === 0 ? f + j : f)).join(' × ')),
      ar: `حلّل العدد ${n} إلى عوامله الأولية.`, en: `Write ${n} as a product of prime factors.`,
    };
  },
};

/** The GCF; the common factors themselves; and the largest number of equal groups in a word problem. */
const gcf: Topic = {
  id: 'gcf', match: /العامل المشترك الاكبر/, grades: [5, 6],
  make({ rng, diff }) {
    const g = int(rng, 2, diff === 'easy' ? 6 : 12);
    let a = 0, b = 0;
    do { a = g * int(rng, 2, diff === 'hard' ? 12 : 8); b = g * int(rng, 2, diff === 'hard' ? 12 : 8); } while (a === b || gcd(a, b) !== g);
    const k = pick(rng, [0, 1, 2]);
    if (k === 2) {
      const dg = divisors(g);
      const ans = dg.join(' ، ');
      const onlyA = divisors(a).find(x => b % x !== 0)!, onlyB = divisors(b).find(x => a % x !== 0)!;
      const cands = [dg.slice(0, -1), dg.slice(1), [...dg, onlyA].sort((x, y) => x - y), [...dg, onlyB].sort((x, y) => x - y)].map(l => l.join(' ، '));
      return {
        eq: `${a}, ${b}`, answer: ans, wrongs: wrongsFrom(ans, cands, () => ''),
        ar: `ما العوامل المشتركة للعددين ${a} و${b}؟`,
        en: `What are the common factors of ${a} and ${b}?`,
      };
    }
    const wrongs = numWrongs(g, [lcm(a, b), Math.min(a, b), Math.abs(a - b) === g ? NaN : Math.abs(a - b), g * 2].filter(x => x !== g));
    if (k === 1) {
      return {
        eq: `${a}, ${b}`, answer: String(g), wrongs,
        ar: `لدى معلمة ${counted(a, 'أقلام', 'قلمًا', 'قلم')} و${counted(b, 'دفاتر', 'دفترًا', 'دفتر')}، وتريد توزيعها على مجموعات متساوية، في كل منها العدد نفسه من الأقلام والعدد نفسه من الدفاتر، دون أن يبقى شيء. ما أكبر عدد ممكن من المجموعات؟`,
        en: `A teacher has ${a} pens and ${b} notebooks to share into identical groups, with nothing left over. What is the greatest number of groups she can make?`,
      };
    }
    return {
      eq: `${a}, ${b}`, answer: String(g), wrongs,
      ar: `أوجد العامل المشترك الأكبر للعددين ${a} و${b}.`,
      en: `Find the greatest common factor of ${a} and ${b}.`,
    };
  },
};

/** The LCM; the first multiples of a number; and when two repeating events next coincide. */
const lcmT: Topic = {
  id: 'lcm', match: /المضاعف المشترك الاصغر/, grades: [5, 6],
  make({ rng, diff }) {
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      const a = int(rng, 2, diff === 'easy' ? 9 : 15);
      const ms = (step: number, from: number, n = 4) => Array.from({ length: n }, (_, i) => from + i * step).join(' ، ');
      const ans = ms(a, a);
      return {
        eq: `${a}`, answer: ans,
        wrongs: wrongsFrom(ans, [ms(a, 2 * a), ms(1, a), [a, 2 * a, 4 * a, 8 * a].join(' ، '), ms(a, 0)], () => ''),
        ar: `اكتب أول أربعة مضاعفات غير صفرية للعدد ${a}.`,
        en: `Write the first four non-zero multiples of ${a}.`,
      };
    }
    let a = 0, b = 0;
    do { a = int(rng, k === 2 ? 3 : 2, diff === 'easy' ? 9 : 15); b = int(rng, k === 2 ? 3 : 2, diff === 'easy' ? 9 : 15); } while (a === b || a % b === 0 || b % a === 0 || lcm(a, b) > 120);
    const ans = lcm(a, b);
    const wrongs = numWrongs(ans, [a * b === ans ? NaN : a * b, Math.max(a, b), gcd(a, b), ans * 2, ans + Math.max(a, b)].filter(x => x !== ans));
    if (k === 2) {
      const days = (n: number) => counted(n, 'أيام', 'يومًا', 'يوم');
      return {
        eq: `${a}, ${b}`, answer: String(ans), wrongs,
        ar: `تسقي سلمى نبتةً كل ${days(a)}، ونبتةً أخرى كل ${days(b)}. إذا سقتهما معًا اليوم، فبعد كم يومًا ستسقيهما معًا مرة أخرى؟`,
        en: `Salma waters one plant every ${a} days and another every ${b} days. If she waters both today, after how many days will she next water both on the same day?`,
      };
    }
    return {
      eq: `${a}, ${b}`, answer: String(ans), wrongs,
      ar: `أوجد المضاعف المشترك الأصغر للعددين ${a} و${b}.`,
      en: `Find the least common multiple of ${a} and ${b}.`,
    };
  },
};

/** Square and square root; a square's side from its area (or area from side); which number is a perfect square; Grade 6 cubes. */
const squares: Topic = {
  id: 'squares', match: /مربع العدد|الجذر التربيعي/, grades: [5, 6],
  make({ rng, diff, grade }) {
    const k = pick(rng, grade >= 6 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]);
    if (k === 4) {
      const b = int(rng, 2, diff === 'hard' ? 10 : 6);
      return rng() < 0.5
        ? { eq: `∛${b ** 3}`, answer: String(b), wrongs: numWrongs(b, [b * 3, b * b, b + 1]), ar: `أوجد قيمة ∛${b ** 3}.`, en: `Find ∛${b ** 3}.` }
        : { eq: `${b}³`, answer: String(b ** 3), wrongs: numWrongs(b ** 3, [b * 3, b * b, b ** 3 + b]), ar: `أوجد قيمة ${b}³.`, en: `Find ${b}³.` };
    }
    const b = int(rng, k === 3 ? 4 : 2, diff === 'easy' ? 10 : diff === 'medium' ? 15 : 25);
    if (k === 2) {
      return rng() < 0.5
        ? { eq: `√${b * b}`, answer: String(b), wrongs: numWrongs(b, [(b * b) % 4 === 0 ? (b * b) / 4 : NaN, b * 2, b + 1, b - 1].filter(x => x !== b)), ar: `قطعة أرض مربعة الشكل مساحتها ${b * b} م². ما طول ضلعها بالمتر؟`, en: `A square plot of land has an area of ${b * b} m². How long is its side, in metres?` }
        : { eq: `${b}²`, answer: String(b * b), wrongs: numWrongs(b * b, [4 * b, 2 * b, b * b + b]), ar: `مربع طول ضلعه ${b} سم. ما مساحته بالسنتيمتر المربع؟`, en: `A square has a side of ${b} cm. What is its area in square centimetres?` };
    }
    if (k === 3) {
      const ans = String(b * b);
      const wrongs = [b * b + 1, b * b - 1, b * (b + 1)].map(String);
      const L = listed(rng, ans, wrongs);
      return { eq: L.en, answer: ans, wrongs, ar: `أيّ الأعداد الآتية مربع كامل: ${L.ar}؟`, en: `Which of these numbers is a perfect square: ${L.en}?` };
    }
    return k === 0
      ? { eq: `${b}²`, answer: String(b * b), wrongs: numWrongs(b * b, [b * 2, b + b + 1, b * b + b, (b + 1) ** 2]), ar: `أوجد مربع العدد ${b}.`, en: `Find the square of ${b}.` }
      : { eq: `√${b * b}`, answer: String(b), wrongs: numWrongs(b, [b * 2, (b * b) / 2 | 0, b + 1, b - 1]), ar: `أوجد قيمة √${b * b}.`, en: `Find √${b * b}.` };
  },
};

/** Repeated multiplication as a power, its value, a power as repeated multiplication, and a number as a power of a given base. */
const powers: Topic = {
  id: 'powers', match: /القوي والاسس/, grades: [6, 6],
  make({ rng, diff }) {
    const base = int(rng, 2, diff === 'easy' ? 5 : 10);
    const e = int(rng, 2, base <= 3 ? 5 : 3);
    const v = base ** e;
    const times = (b: number, n: number) => Array(n).fill(b).join(' × ');
    const k = pick(rng, [0, 1, 2, 3]);
    if (k === 0) {
      return {
        eq: times(base, e), answer: `${base}${sup(e)}`,
        wrongs: wrongsFrom(`${base}${sup(e)}`, [`${e}${sup(base)}`, `${base}${sup(e + 1)}`, `${base}${sup(e - 1)}`], j => `${base}${sup(e + Math.abs(j) + 1)}`),
        ar: `اكتب ${times(base, e)} باستعمال الأسس.`,
        en: `Write ${times(base, e)} using exponents.`,
      };
    }
    if (k === 2) {
      const ans = times(base, e);
      return {
        eq: `${base}${sup(e)}`, answer: ans,
        wrongs: wrongsFrom(ans, [`${base} × ${e}`, base <= 5 ? times(e, base) : times(base, e + 1), times(base, e + 1), times(base, e - 1)], j => times(base, e + Math.abs(j) + 1)),
        ar: `اكتب القوة ${base}${sup(e)} على صورة ضرب متكرر.`,
        en: `Write ${base}${sup(e)} as a repeated multiplication.`,
      };
    }
    if (k === 3) {
      const ans = `${base}${sup(e)}`;
      return {
        eq: `${v}`, answer: ans,
        wrongs: wrongsFrom(ans, [`${base}${sup(e + 1)}`, `${base}${sup(e - 1)}`, `${e}${sup(base)}`], j => `${base}${sup(e + Math.abs(j) + 1)}`),
        ar: `اكتب العدد ${v} على صورة قوة أساسها ${base}.`,
        en: `Write ${v} as a power of ${base}.`,
      };
    }
    return {
      eq: `${base}${sup(e)}`, answer: String(v),
      wrongs: numWrongs(v, [base * e, base + e, e ** base, base ** (e - 1), base ** (e + 1)]),
      ar: `أوجد قيمة ${base}${sup(e)}.`, en: `Find the value of ${base}${sup(e)}.`,
    };
  },
};

// ─── order of operations ────────────────────────────────────────────────────

type Tok = number | string; // numbers, '+ − × ÷', '(' ')', or «5²» as a string

const val = (t: Tok): number => (typeof t === 'number' ? t : t.endsWith('²') ? Number(t.slice(0, -1)) ** 2 : NaN);

/** Correct value: parentheses and precedence honoured; null if a division is not exact. */
function evalPrec(tokens: Tok[]): number | null {
  let i = 0;
  const factor = (): number | null => {
    const t = tokens[i++]!;
    if (t === '(') { const v = expr(); i++; return v; }
    return val(t);
  };
  const term = (): number | null => {
    let v = factor();
    while (v !== null && (tokens[i] === '×' || tokens[i] === '÷')) {
      const op = tokens[i++]; const r = factor();
      if (r === null) return null;
      if (op === '×') v *= r; else { if (r === 0 || v % r !== 0) return null; v /= r; }
    }
    return v;
  };
  const expr = (): number | null => {
    let v = term();
    while (v !== null && (tokens[i] === '+' || tokens[i] === '−')) {
      const op = tokens[i++]; const r = term();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  };
  return expr();
}

/** The slip: left to right, parentheses ignored. */
function evalLtr(tokens: Tok[]): number | null {
  const t = tokens.filter(x => x !== '(' && x !== ')');
  let v = val(t[0]!);
  for (let i = 1; i < t.length; i += 2) {
    const r = val(t[i + 1]!);
    const op = t[i];
    if (op === '+') v += r; else if (op === '−') v -= r; else if (op === '×') v *= r; else { if (r === 0 || v % r !== 0) return null; v /= r; }
  }
  return v;
}

/** The other slip: precedence honoured, parentheses ignored. */
const evalNoParens = (tokens: Tok[]) => evalPrec(tokens.filter(x => x !== '(' && x !== ')'));
const showOps = (shape: Tok[]) => shape.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');

/** An expression where the order of operations matters: its value and the two usual slips. */
function opsShape(rng: Rng, diff: DiffTier, grade: number, flat: boolean): { shape: Tok[]; v: number; ltr: number | null; np: number | null } | null {
  const t = tier(diff);
  for (let attempt = 0; attempt < 100; attempt++) {
    const n = () => int(rng, 2, t === 0 ? 9 : 12);
    const [a, b, c, d] = [n(), n(), n(), n()];
    const powers = grade >= 6 && t >= 1;
    const shapes: Tok[][] = t === 0
      ? [[a, '+', b, '×', c], [b * c + int(rng, 2, 9), '−', b, '×', c], [a, '+', b * c, '÷', c]]
      : t === 1 || !powers
        ? [['(', a, '+', b, ')', '×', c], ['(', a + c, '−', b, ')', '×', d], [a, '×', b, '−', c * d, '÷', c], [a, '+', b, '×', c, '−', d]]
        : [[a, '+', `${b}²`, '×', c], [`${a}²`, '−', '(', b, '+', c, ')', '×', d], [a, '×', '(', b, '+', c, ')', '−', `${d}²`], ['(', a, '+', b, ')', '×', c, '−', `${d}²`]];
    const shape = pick(rng, flat ? shapes.filter(s => !s.includes('(')) : shapes);
    const v = evalPrec(shape);
    const ltr = evalLtr(shape), np = evalNoParens(shape);
    if (v === null || v < 0 || !Number.isInteger(v)) continue;
    if (ltr === v && np === v) continue; // no slip to catch: not an order-of-operations item
    if (flat && (ltr === null || ltr < 0)) continue;
    return { shape, v, ltr, np };
  }
  return null;
}

/** Evaluate; place one pair of brackets to reach a value; and correct a left-to-right slip. */
const orderOps: Topic = {
  id: 'order_ops', match: /اولويات العمليات/, grades: [4, 8],
  make({ rng, diff, grade }) {
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      const top = tier(diff) === 0 ? 9 : 12;
      for (let attempt = 0; attempt < 100; attempt++) {
        const ns = [int(rng, 2, top), int(rng, 2, top), int(rng, 2, top), int(rng, 2, top)];
        const ops = [pick(rng, ['+', '−', '×']), pick(rng, ['+', '−', '×']), pick(rng, ['+', '−', '×'])];
        if (!ops.includes('×') || ops.every(o => o === '×')) continue;
        const flat: Tok[] = [ns[0]!, ops[0]!, ns[1]!, ops[1]!, ns[2]!, ops[2]!, ns[3]!];
        const plain = evalPrec(flat);
        if (plain === null || plain < 0) continue;
        // one pair of brackets around numbers i..j (never the whole expression); nothing negative on the way
        const placed = ([[0, 1], [1, 2], [2, 3], [0, 2], [1, 3]] as const).map(([i, j]) => {
          const shape: Tok[] = [...flat.slice(0, 2 * i), '(', ...flat.slice(2 * i, 2 * j + 1), ')', ...flat.slice(2 * j + 1)];
          return { shape, v: evalPrec(shape), inner: evalPrec(flat.slice(2 * i, 2 * j + 1)) };
        }).filter(p => p.v !== null && p.v >= 0 && p.inner !== null && p.inner >= 0);
        const targets = placed.filter(p => p.v !== plain && placed.filter(q => q.v === p.v).length === 1);
        if (targets.length === 0) continue;
        const target = pick(rng, targets);
        const others = shuffle(rng, placed.filter(p => p.v !== target.v)).slice(0, 3).map(p => showOps(p.shape));
        if (others.length < 3) continue;
        const ans = showOps(target.shape);
        return {
          eq: ans, answer: ans, wrongs: others,
          ar: `ضع قوسين في المقدار ${showOps(flat)} ليصبح ناتجه ${target.v}.`,
          en: `Put one pair of brackets in ${showOps(flat)} so that its value is ${target.v}.`,
        };
      }
    }
    const s = opsShape(rng, diff, grade, k === 2);
    if (!s) return { eq: '2 + 3 × 4', answer: '14', wrongs: ['20', '24', '9'], ar: 'أوجد قيمة المقدار: 2 + 3 × 4', en: 'Evaluate: 2 + 3 × 4' };
    const text = showOps(s.shape);
    const wrongs = numWrongs(s.v, [s.ltr ?? NaN, s.np ?? NaN].filter(x => Number.isFinite(x) && x !== s.v && x >= 0));
    if (k === 2) {
      return {
        eq: text, answer: String(s.v), wrongs,
        ar: `حسب طالب قيمة المقدار ${text} بإجراء العمليات بالترتيب من اليسار إلى اليمين، فحصل على ${s.ltr}. ما القيمة الصحيحة للمقدار؟`,
        en: `A student worked out ${text} strictly from left to right and got ${s.ltr}. What is its correct value?`,
      };
    }
    return { eq: text, answer: String(s.v), wrongs, ar: `أوجد قيمة المقدار: ${text}`, en: `Evaluate: ${text}` };
  },
};

// ─── integers ───────────────────────────────────────────────────────────────

const span = (diff: DiffTier, grade: number) => (diff === 'easy' ? 9 : diff === 'medium' ? 15 : grade >= 7 ? 40 : 25);

const intIntro: Topic = {
  id: 'int_intro', match: /الاعداد السالبه/, grades: [5, 5],
  make({ rng, diff }) {
    const m = span(diff, 5);
    const k = int(rng, 0, 2);
    if (k === 0) {
      const a = int(rng, 1, m);
      const ans = signed(-a);
      return { eq: `${a}`, answer: ans, wrongs: wrongsFrom(ans, [String(a), `${a + 1}`, signed(-(a + 1))]), ar: `ما العدد المقابل للعدد ${a}؟`, en: `What is the opposite of ${a}?` };
    }
    if (k === 1) {
      const t = nz(rng, m); const up = int(rng, 1, m) * (rng() < 0.5 ? 1 : -1);
      const ans = signed(t + up);
      return {
        eq: `${signed(t)} ${up >= 0 ? '+' : '−'} ${Math.abs(up)}`, answer: ans,
        wrongs: numWrongs(t + up, [t - up, -(t + up), Math.abs(t) + Math.abs(up)], signed),
        ar: `كانت درجة الحرارة ${signed(t)}° ثم ${up >= 0 ? 'ارتفعت' : 'انخفضت'} ${Math.abs(up)}°. ما درجة الحرارة الآن؟`,
        en: `The temperature was ${signed(t)}° and then ${up >= 0 ? 'rose' : 'fell'} by ${Math.abs(up)}°. What is it now?`,
      };
    }
    const a = nz(rng, m); let b = nz(rng, m);
    if (a === b) b = -b;
    const ans = a < b ? '<' : '>';
    return { eq: `${signed(a)} ___ ${signed(b)}`, answer: ans, wrongs: ['>', '<', '='].filter(s => s !== ans), ar: `ضع الإشارة المناسبة (> أو < أو =):\n${signed(a)} ___ ${signed(b)}`, en: `Write the correct sign (>, < or =):\n${signed(a)} ___ ${signed(b)}` };
  },
};

/** Absolute value; the opposite; the two integers with a given absolute value; a height or depth as an integer. */
const intAbs: Topic = {
  id: 'int_abs', match: /الاعداد الصحيحه والقيمه المطلقه/, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    const a = nz(rng, m);
    const k = pick(rng, [0, 1, 2, 3]);
    if (k === 0) {
      return { eq: `|${signed(a)}|`, answer: String(Math.abs(a)), wrongs: wrongsFrom(String(Math.abs(a)), [signed(a), signed(-Math.abs(a)), String(Math.abs(a) + 1)]), ar: `أوجد قيمة |${signed(a)}|.`, en: `Find |${signed(a)}|.` };
    }
    if (k === 2) {
      const v = Math.abs(a);
      const ans = `${signed(-v)} ، ${v}`;
      return {
        eq: `|x| = ${v}`, answer: ans,
        wrongs: wrongsFrom(ans, [String(v), signed(-v), `0 ، ${v}`], j => `${signed(-v - Math.abs(j))} ، ${v + Math.abs(j)}`),
        ar: `ما العددان الصحيحان اللذان القيمة المطلقة لكلٍّ منهما ${v}؟`,
        en: `Which two integers have an absolute value of ${v}?`,
      };
    }
    if (k === 3) {
      const h = int(rng, 2, m) * 10;
      const below = rng() < 0.5;
      const ans = below ? -h : h;
      return {
        eq: signed(ans), answer: signed(ans),
        wrongs: numWrongs(ans, [-ans, ans + 10, ans - 10], signed),
        ar: below
          ? `غاصت غوّاصة إلى عمق ${h} م تحت سطح البحر. ما العدد الصحيح الذي يمثّل موقعها بالنسبة إلى سطح البحر؟`
          : `تقع قمة تلّ على ارتفاع ${h} م فوق سطح البحر. ما العدد الصحيح الذي يمثّل موقعها بالنسبة إلى سطح البحر؟`,
        en: below
          ? `A submarine dives to ${h} m below sea level. Which integer gives its position relative to sea level?`
          : `A hilltop is ${h} m above sea level. Which integer gives its position relative to sea level?`,
      };
    }
    const ans = signed(-a);
    return { eq: `${signed(a)}`, answer: ans, wrongs: wrongsFrom(ans, [signed(a), String(Math.abs(a)), signed(-a + 1)]), ar: `ما العدد المقابل للعدد ${signed(a)}؟`, en: `What is the opposite of ${signed(a)}?` };
  },
};

/** The smallest of three; ascending and descending order; and a sign between two integers. */
const intCompare: Topic = {
  id: 'int_compare', match: /مقارنه الاعداد الصحيحه/, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    const k = pick(rng, [0, 1, 2, 3]);
    if (k === 3) {
      const a = nz(rng, m); let b = nz(rng, m);
      if (a === b) b = -b;
      if (a > 0 && b > 0) b = -b; // at least one negative: that is what the lesson compares
      const ans = a < b ? '<' : '>';
      return { eq: `${signed(a)} ___ ${signed(b)}`, answer: ans, wrongs: ['>', '<', '='].filter(s => s !== ans), ar: `ضع الإشارة المناسبة (> أو < أو =):\n${signed(a)} ___ ${signed(b)}`, en: `Write the correct sign (>, < or =):\n${signed(a)} ___ ${signed(b)}` };
    }
    const xs = new Set<number>();
    while (xs.size < 3) xs.add(int(rng, -m, m));
    const arr = [...xs];
    if (k === 0) {
      const ans = signed(Math.min(...arr));
      return { eq: arr.map(signed).join(' ، '), answer: ans, wrongs: wrongsFrom(ans, arr.filter(x => x !== Math.min(...arr)).map(signed).concat(signed(Math.max(...arr) + 1)), j => signed(Math.min(...arr) + j)), ar: `ما أصغر الأعداد الآتية: ${arr.map(signed).join(' ، ')}؟`, en: `Which is the smallest of: ${arr.map(signed).join(', ')}?` };
    }
    const asc = arr.slice().sort((a, b) => a - b);
    const order = k === 1 ? asc : asc.slice().reverse();
    const ans = order.map(signed).join(' ، ');
    const wrong = [order.slice().reverse(), arr.slice().sort((a, b) => (k === 1 ? 1 : -1) * (Math.abs(a) - Math.abs(b))), [order[1]!, order[0]!, order[2]!]].map(r => r.map(signed).join(' ، '));
    return {
      eq: arr.map(signed).join(' ، '), answer: ans,
      wrongs: wrongsFrom(ans, wrong, j => [order[0]!, order[1]!, order[2]! + j].map(signed).join(' ، ')),
      ar: `رتّب الأعداد الآتية ${k === 1 ? 'تصاعديًا' : 'تنازليًا'}: ${arr.map(signed).join(' ، ')}`,
      en: `Order from ${k === 1 ? 'least to greatest' : 'greatest to least'}: ${arr.map(signed).join(', ')}`,
    };
  },
};

/**
 * Integer addition, subtraction, or multiplication and division: compute; a
 * real-life problem (temperature, a lift); and the missing number — or, for ×÷,
 * an expression that needs the order of operations. `eq` is always the
 * calculation the answer comes from.
 */
const intOp = (id: string, match: RegExp, op: '+' | '−' | '×÷'): Topic => ({
  id, match, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    const k = pick(rng, [0, 1, 2]);
    if (op === '×÷') {
      if (k === 1) {
        const a = nz(rng, 9), b = nz(rng, diff === 'easy' ? 5 : 9), d = nz(rng, 5), q = nz(rng, 9);
        const c = d * q;
        const plus = rng() < 0.5;
        const ans = plus ? a * b + q : a * b - q;
        const text = `${signed(a)} × ${paren(b)} ${plus ? '+' : '−'} ${paren(c)} ÷ ${paren(d)}`;
        const ltr = (plus ? a * b + c : a * b - c) / d;
        return {
          eq: text, answer: signed(ans),
          wrongs: numWrongs(ans, [Number.isInteger(ltr) ? ltr : NaN, -ans, plus ? a * b - q : a * b + q, plus ? -a * b + q : -a * b - q], signed),
          ar: `أوجد قيمة المقدار: ${text}`, en: `Evaluate: ${text}`,
        };
      }
      if (k === 2) {
        const drop = int(rng, 2, diff === 'easy' ? 5 : 9), h = int(rng, 3, 9);
        if (rng() < 0.5) {
          const ans = -drop * h;
          return {
            eq: `${signed(-drop)} × ${h}`, answer: signed(ans),
            wrongs: numWrongs(ans, [-ans, -(drop + h), -drop], signed),
            ar: `انخفضت درجة الحرارة ${drop}° كل ساعة مدة ${h} ساعات. ما التغيّر الكلي في درجة الحرارة؟`,
            en: `The temperature fell ${drop}° every hour for ${h} hours. What was the total change in temperature?`,
          };
        }
        const tot = -drop * h;
        return {
          eq: `${signed(tot)} ÷ ${h}`, answer: signed(-drop),
          wrongs: numWrongs(-drop, [drop, tot + h, -h], signed),
          ar: `تغيّرت درجة الحرارة بمقدار ${signed(tot)}° خلال ${h} ساعات بالتساوي. ما التغيّر في درجة الحرارة في كل ساعة؟`,
          en: `The temperature changed by ${signed(tot)}° evenly over ${h} hours. What was the change each hour?`,
        };
      }
      const a = nz(rng, diff === 'hard' ? 12 : 9), b = nz(rng, diff === 'easy' ? 5 : 9);
      if (rng() < 0.5) {
        const ans = a * b;
        return { eq: `${paren(a)} × ${paren(b)}`, answer: signed(ans), wrongs: numWrongs(ans, [-ans, a + b, a - b, Math.abs(ans)], signed), ar: `أوجد ناتج ${paren(a)} × ${paren(b)}.`, en: `Find ${paren(a)} × ${paren(b)}.` };
      }
      const ans = b, n = a * b;
      return { eq: `${signed(n)} ÷ ${paren(a)}`, answer: signed(ans), wrongs: numWrongs(ans, [-ans, n - a, a, Math.abs(ans)], signed), ar: `أوجد ناتج ${signed(n)} ÷ ${paren(a)}.`, en: `Find ${signed(n)} ÷ ${paren(a)}.` };
    }
    if (k === 1) {
      if (op === '+') {
        if (rng() < 0.5) {
          const t = -int(rng, 1, m), ch = nz(rng, m);
          const ans = t + ch;
          return {
            eq: `${signed(t)} + ${paren(ch)}`, answer: signed(ans),
            wrongs: numWrongs(ans, [t - ch, -ans, Math.abs(t) + Math.abs(ch)], signed),
            ar: `كانت درجة الحرارة صباحًا ${signed(t)}°، ثم ${ch > 0 ? 'ارتفعت' : 'انخفضت'} ${Math.abs(ch)}° حتى الظهر. ما درجة الحرارة عند الظهر؟`,
            en: `In the morning the temperature was ${signed(t)}°; by noon it had ${ch > 0 ? 'risen' : 'fallen'} ${Math.abs(ch)}°. What was it at noon?`,
          };
        }
        const f = nz(rng, 5), n = int(rng, 3, 9), up = rng() < 0.5;
        const ch = up ? n : -n, ans = f + ch;
        return {
          eq: `${signed(f)} + ${paren(ch)}`, answer: signed(ans),
          wrongs: numWrongs(ans, [f - ch, -ans, Math.abs(f) + n], signed),
          ar: `كان مصعد في الطابق ${signed(f)}، ثم ${up ? 'صعد' : 'نزل'} ${n} طوابق. في أيّ طابق أصبح؟`,
          en: `A lift was at floor ${signed(f)} and went ${up ? 'up' : 'down'} ${n} floors. Which floor is it on now?`,
        };
      }
      // the difference between two temperatures, the warmer first
      let a = nz(rng, m), b = nz(rng, m);
      if (a === b) b = -b;
      if (a < b) [a, b] = [b, a];
      if (b > 0) b = -b;
      const ans = a - b;
      return {
        eq: `${signed(a)} − ${paren(b)}`, answer: signed(ans),
        wrongs: numWrongs(ans, [a + b, -ans, Math.abs(Math.abs(a) - Math.abs(b))], signed),
        ar: `في يوم شتوي، كانت درجة الحرارة في مدينة ${signed(a)}°، وفي مدينة أخرى ${signed(b)}°. بكم درجة تزيد درجة الحرارة في المدينة الأولى على درجة الحرارة في المدينة الثانية؟`,
        en: `On a winter day it was ${signed(a)}° in one city and ${signed(b)}° in another. How many degrees warmer was the first city?`,
      };
    }
    if (k === 2) {
      const a = nz(rng, m);
      let c = nz(rng, m);
      if (c === a) c = -c;
      // + : a + x = c, so x = c − a ;  − : a − x = c, so x = a − c
      const x = op === '+' ? c - a : a - c;
      return op === '+'
        ? {
          eq: `${signed(c)} − ${paren(a)}`, answer: signed(x),
          wrongs: numWrongs(x, [c + a, -x, Math.abs(c) - Math.abs(a)], signed),
          ar: `ما العدد الذي إذا أُضيف إلى ${signed(a)} كان الناتج ${signed(c)}؟`,
          en: `What number added to ${signed(a)} gives ${signed(c)}?`,
        }
        : {
          eq: `${signed(a)} − ${paren(c)}`, answer: signed(x),
          wrongs: numWrongs(x, [a + c, -x, Math.abs(a) - Math.abs(c)], signed),
          ar: `ما العدد الذي إذا طُرح من ${signed(a)} كان الناتج ${signed(c)}؟`,
          en: `What number subtracted from ${signed(a)} gives ${signed(c)}?`,
        };
    }
    const a = nz(rng, m), b = nz(rng, m);
    const ans = op === '+' ? a + b : a - b;
    const other = op === '+' ? a - b : a + b;
    return {
      eq: `${signed(a)} ${op} ${paren(b)}`, answer: signed(ans),
      wrongs: numWrongs(ans, [other, -ans, Math.abs(a) + Math.abs(b), Math.abs(a) - Math.abs(b)], signed),
      ar: `أوجد ناتج ${signed(a)} ${op} ${paren(b)}.`, en: `Find ${signed(a)} ${op} ${paren(b)}.`,
    };
  },
});

// ─── fractions, decimals, percent, ratio ────────────────────────────────────

/**
 * Fractions «a/b» that differ in value from `answer` (a fraction or a whole
 * number) and from each other — wrong options for a fraction answer. The
 * candidates come first; if they run short, the answer ± 1, ± 2…
 */
function fracWrongs(answer: string, cands: string[]): string[] {
  const seen = [valueOf(answer)!];
  const out: string[] = [];
  const m = answer.replace('−', '-').match(/^(-?\d+)(?:\/(\d+))?$/);
  const [p, q] = m ? [Number(m[1]), Number(m[2] ?? 1)] : [0, 1];
  const near = m ? Array.from({ length: 6 }, (_, i) => sfrac(p + (i % 2 ? -1 : 1) * (Math.floor(i / 2) + 1) * q, q)) : [];
  for (const c of [...cands, ...near]) {
    const v = valueOf(c);
    if (v === null || out.length === 3 || out.includes(c) || seen.some(s => Math.abs(s - v) < 1e-9)) continue;
    seen.push(v); out.push(c);
  }
  return out;
}

/**
 * Equivalent fractions: the missing numerator; which listed fraction is
 * equivalent; multiplying numerator and denominator by the same number; and
 * (Grade 4) simplest form.
 */
const equivFrac: Topic = {
  id: 'equiv_frac', match: /الكسور المتكافئه/, grades: [3, 5],
  make({ rng, diff, grade }) {
    const d = pick(rng, [2, 3, 4, 5, 6, 8]);
    let n = int(rng, 1, d - 1);
    while (gcd(n, d) !== 1) n = int(rng, 1, d - 1);
    const k = int(rng, 2, diff === 'easy' ? 4 : 9);
    const kind = pick(rng, grade >= 4 ? [0, 1, 2, 3] : [0, 1, 2]);
    if (kind === 1) {
      const ans = `${n * k}/${d * k}`;
      // adding the same number to both parts is the classic slip
      const wrongs = fracWrongs(ans, [`${n + k}/${d + k}`, `${n * k}/${d + k}`, `${n + k}/${d * k}`, `${n * k + 1}/${d * k}`, `${n * k}/${d * k - 1}`, `${d * k}/${n * k}`]);
      if (wrongs.length < 3) return equivFrac.make({ rng, diff, grade });
      const L = listed(rng, ans, wrongs);
      return {
        eq: `${n}/${d}`, answer: ans, wrongs,
        ar: `أيّ الكسور الآتية يكافئ الكسر ${n}/${d}: ${L.ar}؟`,
        en: `Which of these fractions is equivalent to ${n}/${d}: ${L.en}?`,
      };
    }
    if (kind === 2) {
      const ans = `${n * k}/${d * k}`;
      const wrongs = fracWrongs(ans, [`${n * k}/${d}`, `${n}/${d * k}`, `${n + k}/${d + k}`, `${n * k}/${d + k}`, `${n + k}/${d * k}`]);
      if (wrongs.length < 3) return equivFrac.make({ rng, diff, grade });
      return {
        eq: `${n}/${d} × ${k}/${k}`, answer: ans, wrongs,
        ar: `اضرب كلًّا من بسط الكسر ${n}/${d} ومقامه في ${k}. ما الكسر المكافئ الناتج؟`,
        en: `Multiply the numerator and the denominator of ${n}/${d} by ${k}. What equivalent fraction do you get?`,
      };
    }
    if (kind === 3) {
      const ans = sfrac(n, d);
      const wrongs = fracWrongs(ans, [`${n}/${d * k}`, `${n * k}/${d}`, n * k > 2 ? `${n * k - 2}/${d * k - 2}` : '', n + 1 < d ? `${n + 1}/${d}` : '', `${n}/${d + 1}`, sfrac(d, n)]);
      if (wrongs.length < 3) return equivFrac.make({ rng, diff, grade });
      return {
        eq: `${n * k}/${d * k}`, answer: ans, wrongs,
        ar: `اكتب الكسر ${n * k}/${d * k} في أبسط صورة.`,
        en: `Write ${n * k}/${d * k} in simplest form.`,
      };
    }
    const ans = n * k;
    return {
      eq: `${n}/${d} = ?/${d * k}`, answer: String(ans),
      wrongs: numWrongs(ans, [n + k, n * (k - 1), n + d * k - d, ans + d]),
      ar: `أكمل لتحصل على كسرين متكافئين: ${n}/${d} = ؟/${d * k}`,
      en: `Complete the equivalent fractions: ${n}/${d} = ?/${d * k}`,
    };
  },
};

/** Improper ↔ mixed; which listed fraction is improper; and pieces eaten, written as a mixed number. */
const mixedImproper: Topic = {
  id: 'mixed_improper', match: /^الاعداد الكسريه(?: والكسور غير الفعليه)?$/, grades: [4, 6],
  make({ rng, diff }) {
    const d = pick(rng, diff === 'easy' ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8, 10]);
    const w = int(rng, 1, diff === 'easy' ? 3 : 9);
    let r = int(rng, 1, d - 1);
    while (gcd(r, d) !== 1) r = int(rng, 1, d - 1);
    const n = w * d + r;
    const k = pick(rng, [0, 1, 2, 3]);
    if (k === 2) {
      // one improper fraction among proper ones (its reciprocal is one of them)
      const ans = `${n}/${d}`;
      const props = new Set<string>([`${d}/${n}`]);
      while (props.size < 3) { const q = int(rng, 3, 10); const p = int(rng, 1, q - 1); if (gcd(p, q) === 1) props.add(`${p}/${q}`); }
      const wrongs = [...props];
      const L = listed(rng, ans, wrongs);
      return { eq: L.en, answer: ans, wrongs, ar: `أيّ الكسور الآتية كسر غير فعلي: ${L.ar}؟`, en: `Which of these fractions is improper: ${L.en}?` };
    }
    if (k === 0 || k === 3) {
      const ans = `${w} ${r}/${d}`;
      // only well-formed mixed numbers: a whole part, then a proper fraction that is not zero
      const ok = (x: string) => { const m = x.match(/^(\d+) (\d+)\/(\d+)$/); return !!m && Number(m[2]) > 0 && Number(m[2]) < Number(m[3]); };
      const wrongs = wrongsFrom(ans, [`${w + 1} ${r}/${d}`, `${w} ${d - r}/${d}`, `${w} ${r + 1}/${d}`, `${w} ${r - 1}/${d}`, `${r} ${w}/${d}`].filter(ok), j => `${w + Math.abs(j) + 1} ${r}/${d}`);
      return k === 0
        ? { eq: `${n}/${d}`, answer: ans, wrongs, ar: `اكتب الكسر غير الفعلي ${n}/${d} على صورة عدد كسري.`, en: `Write the improper fraction ${n}/${d} as a mixed number.` }
        : {
          eq: `${n}/${d}`, answer: ans, wrongs,
          ar: `قُسّمت كل فطيرة إلى أجزاء متساوية، كل جزء منها 1/${d} الفطيرة. أكل الضيوف ${counted(n, 'أجزاء', 'جزءًا', 'جزء')}. اكتب ما أكلوه من الفطائر على صورة عدد كسري.`,
          en: `Each pie was cut into equal pieces, each 1/${d} of a pie. The guests ate ${n} pieces. Write how many pies they ate as a mixed number.`,
        };
    }
    const ans = `${n}/${d}`;
    return {
      eq: `${w} ${r}/${d}`, answer: ans,
      wrongs: wrongsFrom(ans, [`${w + r}/${d}`, `${w * r + d}/${d}`, `${n - d}/${d}`, r > 1 ? `${n}/${r}` : ''], j => `${n + j}/${d}`),
      ar: `اكتب العدد الكسري ${w} ${r}/${d} على صورة كسر غير فعلي.`, en: `Write the mixed number ${w} ${r}/${d} as an improper fraction.`,
    };
  },
};

/** Denominators whose fractions terminate, with the decimal places that takes. */
const TERMINATING: Array<[number, number]> = [[2, 1], [4, 2], [5, 1], [10, 1], [20, 2], [25, 2], [50, 2], [100, 2], [8, 3]];

const PLACE_NAME: Record<number, [string, string]> = {
  [-1]: ['العشرات', 'tens'], 0: ['الآحاد', 'ones'], 1: ['الأجزاء من عشرة', 'tenths'], 2: ['الأجزاء من مئة', 'hundredths'], 3: ['الأجزاء من ألف', 'thousandths'],
};

/** A decimal in expanded form, «4 + 0.3 + 0.05», with its standard form — the digits are kept nonzero after the point. */
function expanded(rng: Rng, places: number, whole: number) {
  const ds = Array.from({ length: places }, () => int(rng, 1, 9));
  const raw = whole * 10 ** places + ds.reduce((s, x, i) => s + x * 10 ** (places - 1 - i), 0);
  const terms = [...(whole ? [String(whole)] : []), ...ds.map((x, i) => fmtDec(x, i + 1))];
  return { raw, ds, text: terms.join(' + ') };
}

/**
 * Fraction ↔ decimal; for Grades 4–6 also expanded → standard form and the
 * place value of a digit (the «أجزاء العشرة/المئة/الألف» objectives); for
 * Grade 7 (the rational-number lessons) also which two integers a rational lies
 * between on the number line, and a mixed number as an improper fraction.
 */
const fracDec: Topic = {
  id: 'frac_dec', match: /التحويل بين الكسور والاعداد العشريه|اجزاء (?:العشره|المئه|الالف)|العدد النسبي$|كتابه العدد النسبي بالصوره العشريه/, grades: [4, 7],
  make({ rng, diff, grade }) {
    const kind = pick(rng, grade >= 7 ? [0, 1, 4, 5] : [0, 1, 2, 3]);
    if (kind === 2) {
      const places = grade <= 4 ? pick(rng, diff === 'easy' ? [1] : [1, 2]) : pick(rng, diff === 'easy' ? [1, 2] : [2, 3]);
      const e = expanded(rng, places, int(rng, 0, diff === 'hard' ? 99 : 9));
      const ans = fmtDec(e.raw, places);
      const swapped = places >= 2 && e.ds[0] !== e.ds[1] ? fmtDec(e.raw + (e.ds[1]! - e.ds[0]!) * 10 ** (places - 1) + (e.ds[0]! - e.ds[1]!) * 10 ** (places - 2), places) : '';
      return {
        eq: e.text, answer: ans,
        wrongs: wrongsFrom(ans, [String(e.raw), fmtDec(e.raw, places + 1), swapped, fmtDec(e.raw * 10, places)].filter(Boolean), j => fmtDec(e.raw + Math.abs(j) * 10 ** (places - 1), places)),
        ar: `اكتب العدد الآتي بالصيغة القياسية: ${e.text}`,
        en: `Write in standard form: ${e.text}`,
      };
    }
    if (kind === 3) {
      // a number whose digits are all different, so «the digit 7» names one place
      const places = grade <= 4 ? pick(rng, diff === 'easy' ? [1] : [1, 2]) : pick(rng, diff === 'easy' ? [2] : [2, 3]);
      const digs: number[] = [];
      while (digs.length < places + 1) { const x = int(rng, digs.length === 0 ? 1 : 0, 9); if (!digs.includes(x)) digs.push(x); }
      const s = `${digs[0]}.${digs.slice(1).join('')}`;
      const pos = int(rng, 1, places);
      const digit = digs[pos]!;
      if (digit === 0) return fracDec.make({ rng, diff, grade });
      const ans = fmtDec(digit, pos);
      return {
        eq: s, answer: ans,
        wrongs: wrongsFrom(ans, [String(digit), fmtDec(digit, pos + 1), pos > 1 ? fmtDec(digit, pos - 1) : String(digit * 10)], j => fmtDec(digit, pos + Math.abs(j) + 1)),
        ar: `ما القيمة المنزلية للرقم ${digit} في العدد ${s}؟`,
        en: `What is the place value of the digit ${digit} in ${s}?`,
      };
    }
    if (kind === 4) {
      const d = pick(rng, [2, 3, 4, 5, 6, 8]);
      let n = numerator(rng, d, d * (diff === 'easy' ? 3 : 6));
      if (Math.abs(n) < d) n = n < 0 ? n - d : n + d;
      if (gcd(Math.abs(n), d) !== 1) return fracDec.make({ rng, diff, grade });
      const lo = Math.floor(n / d);
      const pair = (x: number) => `${signed(x)} ، ${signed(x + 1)}`;
      const ans = pair(lo);
      return {
        eq: sfrac(n, d), answer: ans,
        wrongs: wrongsFrom(ans, [pair(lo - 1), pair(lo + 1), pair(-lo - 1)], j => pair(lo + j * 2)),
        ar: `بين أيّ عددين صحيحين متتاليين يقع العدد النسبي ${sfrac(n, d)} على خط الأعداد؟`,
        en: `Between which two consecutive integers does ${sfrac(n, d)} lie on the number line?`,
      };
    }
    if (kind === 5) {
      const d = pick(rng, [2, 3, 4, 5, 6, 8]);
      const w = int(rng, 1, diff === 'easy' ? 3 : 9);
      let r = int(rng, 1, d - 1);
      while (gcd(r, d) !== 1) r = int(rng, 1, d - 1);
      const neg = rng() < 0.6;
      const s = neg ? -1 : 1;
      const ans = sfrac(s * (w * d + r), d);
      // −2 1/3 is −(2 + 1/3); reading it as −2 + 1/3 is the slip
      const wrongs = fracWrongs(ans, [sfrac(s * (w * d - r), d), sfrac(-s * (w * d + r), d), sfrac(s * (w + r), d), sfrac(s * (w * r + d), d), sfrac(s * (w * d + r + 1), d)]);
      return {
        eq: `${neg ? '−' : ''}${w} ${r}/${d}`, answer: ans, wrongs,
        ar: `اكتب العدد ${neg ? '−' : ''}${w} ${r}/${d} على صورة كسر غير فعلي في أبسط صورة.`,
        en: `Write ${neg ? '−' : ''}${w} ${r}/${d} as an improper fraction in simplest form.`,
      };
    }
    const [d, places] = pick(rng, diff === 'easy' ? TERMINATING.slice(0, 5) : grade <= 4 ? TERMINATING.slice(0, 8) : TERMINATING);
    let n = int(rng, 1, d - 1);
    if (gcd(n, d) !== 1 && rng() < 0.5) n = 1;
    const neg = grade >= 7 && rng() < 0.5;
    const raw = (n * 10 ** places) / d; // exact for these denominators
    const dec = (neg ? '−' : '') + fmtDec(raw, places);
    const f = neg ? `−${n}/${d}` : `${n}/${d}`;
    if (kind === 0) {
      return {
        eq: f, answer: dec,
        wrongs: wrongsFrom(dec, [(neg ? '−' : '') + fmtDec(n * 10 ** places, places + 1), (neg ? '−' : '') + fmtDec(Math.round((d / n) * 100), 2), (neg ? '−' : '') + fmtDec(raw * 10, places)].filter(w => !/NaN/.test(w)), j => (neg ? '−' : '') + fmtDec(raw + Math.abs(j), places)),
        ar: `اكتب الكسر ${f} على صورة عدد عشري.`, en: `Write the fraction ${f} as a decimal.`,
      };
    }
    const ans = sfrac(neg ? -n : n, d);
    return {
      eq: dec, answer: ans,
      wrongs: wrongsFrom(ans, [sfrac(neg ? -d : d, n), sfrac(neg ? -(n + 1) : n + 1, d), sfrac(neg ? -n : n, d + 1)].filter(w => w !== ans), j => sfrac(neg ? -(n + Math.abs(j) + 1) : n + Math.abs(j) + 1, d)),
      ar: `اكتب العدد العشري ${dec} على صورة كسر في أبسط صورة.`, en: `Write the decimal ${dec} as a fraction in simplest form.`,
    };
  },
};

/** Reading and writing decimals: the place value of a digit, expanded → standard form, and the digit in a named place. */
const decPlace: Topic = {
  id: 'dec_place', match: /^الاعداد العشريه$/, grades: [4, 4],
  make({ rng, diff }) {
    const places = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3;
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      const e = expanded(rng, places, int(rng, 1, 9));
      const ans = fmtDec(e.raw, places);
      return {
        eq: e.text, answer: ans,
        wrongs: wrongsFrom(ans, [String(e.raw), fmtDec(e.raw, places + 1), fmtDec(e.raw * 10, places)], j => fmtDec(e.raw + Math.abs(j) * 10 ** (places - 1), places)),
        ar: `اكتب العدد الآتي بالصيغة القياسية: ${e.text}`,
        en: `Write in standard form: ${e.text}`,
      };
    }
    if (k === 2) {
      // all digits different, so the digit in a place is the only right answer
      const digs: number[] = [];
      while (digs.length < places + 2) { const x = int(rng, digs.length === 0 ? 1 : 0, 9); if (!digs.includes(x)) digs.push(x); }
      const s = `${digs[0]}${digs[1]}.${digs.slice(2).join('')}`;
      const at = int(rng, -1, places); // −1 tens, 0 ones, 1.. after the point
      const ans = digs[at + 1]!;
      const [ar, en] = PLACE_NAME[at]!;
      return {
        eq: s, answer: String(ans),
        wrongs: numWrongs(ans, digs.filter(x => x !== ans)),
        ar: `ما الرقم الذي في منزلة ${ar} في العدد ${s}؟`,
        en: `Which digit is in the ${en} place of ${s}?`,
      };
    }
    const raw = int(rng, 10 ** places + 1, 10 ** (places + 1) - 1) + int(rng, 1, 9) * 10 ** (places + 1);
    const s = fixedDec(raw, places);
    const pos = int(rng, 1, places);
    const idx = s.indexOf('.') + pos;
    const digit = Number(s[idx]);
    if (digit === 0) return decPlace.make({ rng, diff, grade: 4 });
    const ans = fmtDec(digit * 10 ** (places - pos), places);
    return {
      eq: s, answer: ans,
      wrongs: wrongsFrom(ans, [String(digit), fmtDec(digit * 10 ** (places - pos), places - 1 < 0 ? 0 : places + 1), fmtDec(digit * 10 ** (places - pos) * 10, places), fmtDec(digit * 10 ** Math.max(0, places - pos - 1), places)].filter(x => !/NaN/.test(x))),
      ar: `ما القيمة المنزلية للرقم ${digit} في العدد ${s}؟`, en: `What is the place value of the digit ${digit} in ${s}?`,
    };
  },
};

type Mixed = { w: number; r: number; d: number };
const impN = (x: Mixed) => x.w * x.d + x.r;
const showMixed = (x: Mixed) => `${x.w} ${x.r}/${x.d}`;

/**
 * Mixed-number sum/difference/product/quotient, answered as a mixed number in
 * simplest form; plus, per operation, a measurement problem and one more kind:
 * the missing addend (+−), a mixed number times a whole number (×), the
 * reciprocal of a mixed number (÷).
 */
const mixedOp = (id: string, match: RegExp, ops: Array<'+' | '−' | '×' | '÷'>): Topic => ({
  id, match, grades: [5, 6],
  make({ rng, diff }) {
    const op = pick(rng, ops);
    const dens = diff === 'easy' ? [2, 4] : [2, 3, 4, 5, 6, 8];
    const mk = (): Mixed => { const d = pick(rng, dens); let r = int(rng, 1, d - 1); while (gcd(r, d) !== 1) r = int(rng, 1, d - 1); return { w: int(rng, 1, diff === 'hard' ? 6 : 3), r, d }; };
    const again = () => mixedOp(id, match, ops).make({ rng, diff, grade: 5 });
    let A = mk(), B = mk();
    let [an, ad, bn, bd] = [impN(A), A.d, impN(B), B.d];
    if (op === '−' && an * bd < bn * ad) { [A, B] = [B, A]; [an, ad, bn, bd] = [bn, bd, an, ad]; }
    if (op === '−' && an * bd === bn * ad) return again();
    const k = pick(rng, [0, 1, 2]);
    if (k === 2 && op === '÷') {
      const ans = sfrac(ad, an);
      const wrongs = fracWrongs(ans, [`${an}/${ad}`, sfrac(A.d, A.r), `1/${an}`, `${ad}/${an + 1}`]);
      if (wrongs.length < 3) return again();
      return {
        eq: `1 ÷ ${showMixed(A)}`, answer: ans, wrongs,
        ar: `ما مقلوب العدد الكسري ${showMixed(A)}؟`,
        en: `What is the reciprocal of the mixed number ${showMixed(A)}?`,
      };
    }
    if (k === 2 && op === '×') {
      const m = int(rng, 2, diff === 'easy' ? 4 : 9);
      const ans = mixed(an * m, ad);
      return {
        eq: `${showMixed(A)} × ${m}`, answer: ans,
        wrongs: wrongsFrom(ans, [`${A.w * m} ${A.r}/${A.d}`, mixed(an * m + ad, ad), mixed(an + m * ad, ad), mixed(an * m - ad, ad)].filter(w => w !== ans), j => mixed(an * m + Math.abs(j) * ad, ad)),
        ar: `اضرب العدد الكسري ${showMixed(A)} في ${m}، واكتب الناتج في أبسط صورة.`,
        en: `Multiply the mixed number ${showMixed(A)} by ${m} and write the result in simplest form.`,
      };
    }
    if (k === 2) {
      // the missing addend: B + ? = A + B
      const [cn, cd] = [an * bd + bn * ad, ad * bd];
      const C = mixed(cn, cd);
      const ans = mixed(an, ad);
      return {
        eq: `${C} − ${showMixed(B)}`, answer: ans,
        wrongs: wrongsFrom(ans, [mixed(cn * bd + bn * cd, cd * bd), mixed(an + ad, ad), mixed(Math.max(1, an - ad), ad), mixed(an * bd + ad * bd, ad * bd)].filter(w => w !== ans), j => mixed(an + Math.abs(j) * ad, ad)),
        ar: `ما العدد الذي إذا أُضيف إلى ${showMixed(B)} كان الناتج ${C}؟ أجب بعدد كسري في أبسط صورة.`,
        en: `What number added to ${showMixed(B)} gives ${C}? Answer as a mixed number in simplest form.`,
      };
    }
    if (op === '÷' && k === 1) {
      // a whole number of pieces: the length is the piece times a whole number
      const pieces = int(rng, 2, diff === 'easy' ? 5 : 9);
      const L = mixed(bn * pieces, bd);
      if (!L.includes(' ')) return again();
      return {
        eq: `${L} ÷ ${showMixed(B)}`, answer: String(pieces),
        wrongs: numWrongs(pieces, [pieces + 1, pieces - 1, Math.floor((bn * pieces) / bd), pieces * 2].filter(x => x > 0 && x !== pieces)),
        ar: `شريط طوله ${L} م، قُصّ إلى قطع طول كل منها ${showMixed(B)} م. كم قطعة نحصل عليها؟`,
        en: `A ribbon ${L} m long is cut into pieces of ${showMixed(B)} m. How many pieces are there?`,
      };
    }
    const [n, d] = op === '+' ? [an * bd + bn * ad, ad * bd] : op === '−' ? [an * bd - bn * ad, ad * bd] : op === '×' ? [an * bn, ad * bd] : [an * bd, ad * bn];
    const ans = mixed(n, d);
    const wrongs = wrongsFrom(ans, [mixed(n + d, d), mixed(Math.max(1, n - d), d), op === '×' ? `${A.w * B.w} ${A.r * B.r}/${ad * bd}` : mixed(an + bn, ad + bd)].filter(w => w !== ans), j => mixed(n + j, d));
    if (k === 1) {
      const text = op === '+'
        ? [`قطعت سلمى ${showMixed(A)} كم صباحًا، و${showMixed(B)} كم مساءً. كم كيلومترًا قطعت في ذلك اليوم؟ أجب بعدد كسري في أبسط صورة.`, `Salma walked ${showMixed(A)} km in the morning and ${showMixed(B)} km in the evening. How many kilometres did she walk that day? Answer as a mixed number in simplest form.`]
        : op === '−'
          ? [`حبل طوله ${showMixed(A)} م، قُصّ منه ${showMixed(B)} م. كم مترًا بقي من الحبل؟ أجب بعدد كسري في أبسط صورة.`, `A rope is ${showMixed(A)} m long and ${showMixed(B)} m is cut off. How many metres are left? Answer as a mixed number in simplest form.`]
          : [`ما مساحة مستطيل طوله ${showMixed(A)} م وعرضه ${showMixed(B)} م، بالمتر المربع؟ أجب بعدد كسري في أبسط صورة.`, `What is the area, in square metres, of a rectangle ${showMixed(A)} m long and ${showMixed(B)} m wide? Answer as a mixed number in simplest form.`];
      return { eq: `${showMixed(A)} ${op} ${showMixed(B)}`, answer: ans, wrongs, ar: text[0], en: text[1] };
    }
    return {
      eq: `${showMixed(A)} ${op} ${showMixed(B)}`, answer: ans, wrongs,
      ar: `أوجد ناتج ${showMixed(A)} ${op} ${showMixed(B)} وأجب بعدد كسري في أبسط صورة.`,
      en: `Find ${showMixed(A)} ${op} ${showMixed(B)} and give the answer as a mixed number in simplest form.`,
    };
  },
});

const pctConv: Topic = {
  id: 'pct_conv', match: /النسبه المئويه و(?:ال)?كسور/, grades: [6, 7],
  make({ rng, diff }) {
    const p = pick(rng, diff === 'easy' ? [10, 20, 25, 50, 75] : [5, 8, 12, 15, 24, 35, 40, 45, 60, 64, 80, 85]);
    const kind = int(rng, 0, 3);
    if (kind === 0) {
      const ans = frac(p, 100);
      return { eq: `${p}%`, answer: ans, wrongs: wrongsFrom(ans, [`${p}/10`, `${p}/1000`, `1/${p}`, frac(p, 10)].filter(w => w !== ans)), ar: `اكتب ${p}% على صورة كسر في أبسط صورة.`, en: `Write ${p}% as a fraction in simplest form.` };
    }
    if (kind === 1) {
      const ans = `${p}%`;
      return { eq: frac(p, 100), answer: ans, wrongs: wrongsFrom(ans, [`${p / 10}%`, `${p * 10}%`, `${100 - p}%`], k => `${p + k}%`), ar: `اكتب الكسر ${frac(p, 100)} على صورة نسبة مئوية.`, en: `Write the fraction ${frac(p, 100)} as a percent.` };
    }
    if (kind === 2) {
      const ans = fmtDec(p, 2);
      return { eq: `${p}%`, answer: ans, wrongs: wrongsFrom(ans, [fmtDec(p, 1), fmtDec(p * 10, 2), String(p)]), ar: `اكتب ${p}% على صورة عدد عشري.`, en: `Write ${p}% as a decimal.` };
    }
    const ans = `${p}%`;
    const dec = fmtDec(p, 2);
    return { eq: dec, answer: ans, wrongs: wrongsFrom(ans, [`${p / 10}%`, `${p * 10}%`, `${Math.round(p / 100)}%`], k => `${p + k}%`), ar: `اكتب العدد العشري ${dec} على صورة نسبة مئوية.`, en: `Write the decimal ${dec} as a percent.` };
  },
};

/** A ratio in simplest form; a unit rate (the lesson's «معدل الوحدة»); and a class's ratio of boys to girls, or of girls to all. */
const ratioSimplest: Topic = {
  id: 'ratio', match: /^النسبه$/, grades: [6, 7],
  make({ rng, diff }) {
    const g = int(rng, 2, diff === 'easy' ? 4 : 9);
    let a = int(rng, 1, 9), b = int(rng, 1, 9);
    while (a === b || gcd(a, b) !== 1) { a = int(rng, 1, 9); b = int(rng, 1, 9); }
    const x = a * g, y = b * g;
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      if (rng() < 0.5) {
        const h = int(rng, 3, 9), r = 5 * int(rng, 8, 18);
        return {
          eq: `${r * h} ÷ ${h}`, answer: String(r),
          wrongs: numWrongs(r, [r * h, r + 10, r - 10, r * h - h]),
          ar: `قطعت سيارة ${r * h} كم في ${h} ساعات بسرعة ثابتة. ما معدل الوحدة بالكيلومتر لكل ساعة؟`,
          en: `A car travels ${r * h} km in ${h} hours at a steady speed. What is the unit rate in kilometres per hour?`,
        };
      }
      const n = int(rng, 3, 9), p = int(rng, 2, diff === 'easy' ? 5 : 12);
      const tot = n * p;
      return {
        eq: `${tot} ÷ ${n}`, answer: String(p),
        wrongs: numWrongs(p, [tot, tot - n, p + 1, n].filter(v => v !== p)),
        ar: `اشترى خالد ${n} دفاتر متماثلة بمبلغ ${counted(tot, 'دنانير', 'دينارًا', 'دينار')}. ما ثمن الدفتر الواحد بالدينار؟`,
        en: `Khaled bought ${n} identical notebooks for ${tot} dinars. What is the price of one notebook, in dinars?`,
      };
    }
    if (k === 2) {
      if (x < 3 || y < 3) return ratioSimplest.make({ rng, diff, grade: 6 });
      const boys = counted(x, 'طلاب', 'طالبًا', 'طالب'), girls = counted(y, 'طالبات', 'طالبةً', 'طالبة');
      if (rng() < 0.5) {
        const ans = `${a} : ${b}`;
        return {
          eq: `${x} : ${y}`, answer: ans,
          wrongs: wrongsFrom(ans, [`${b} : ${a}`, `${x} : ${y}`, `${a} : ${a + b}`, `${a + 1} : ${b}`], () => ''),
          ar: `في صفٍّ ${boys} و${girls}. ما نسبة عدد الطلاب إلى عدد الطالبات في أبسط صورة؟`,
          en: `A class has ${x} boys and ${y} girls. What is the ratio of boys to girls in simplest form?`,
        };
      }
      const ans = `${b} : ${a + b}`;
      return {
        eq: `${y} : ${x + y}`, answer: ans,
        wrongs: wrongsFrom(ans, [`${b} : ${a}`, `${y} : ${x + y}`, `${a + b} : ${b}`, `${a} : ${a + b}`], () => ''),
        ar: `في صفٍّ ${boys} و${girls}. ما نسبة عدد الطالبات إلى عدد طلبة الصف جميعهم في أبسط صورة؟`,
        en: `A class has ${x} boys and ${y} girls. What is the ratio of girls to all the students in the class, in simplest form?`,
      };
    }
    const ans = `${a} : ${b}`;
    return {
      eq: `${x} : ${y}`, answer: ans,
      wrongs: wrongsFrom(ans, [`${b} : ${a}`, `${x} : ${y}`, `${a * 2} : ${b * 2}`, `${a + 1} : ${b}`]),
      ar: `اكتب النسبة ${x} : ${y} في أبسط صورة.`, en: `Write the ratio ${x} : ${y} in simplest form.`,
    };
  },
};

/** Complete a pair of equivalent ratios; pick the equivalent ratio out of four; and scale a recipe. */
const ratioEquiv: Topic = {
  id: 'ratio_equiv', match: /النسب المتكافئه/, grades: [6, 7],
  make({ rng, diff }) {
    let a = int(rng, 1, 9), b = int(rng, 2, 9);
    while (a === b) b = int(rng, 2, 9);
    const k = int(rng, 2, diff === 'easy' ? 5 : 12);
    const ans = b * k;
    const kind = pick(rng, [0, 1, 2]);
    if (kind === 1) {
      const right = `${a * k} : ${b * k}`;
      const equivalent = (s: string) => { const [p, q] = s.split(' : ').map(Number); return p! * b === q! * a; };
      const wrongs = [...new Set([`${b * k} : ${a * k}`, `${a + k} : ${b + k}`, `${a * k} : ${b + k}`, `${a * k} : ${b * k + 1}`, `${a + k} : ${b * k}`])]
        .filter(s => s !== right && !equivalent(s)).slice(0, 3);
      if (wrongs.length < 3) return ratioEquiv.make({ rng, diff, grade: 6 });
      const L = listed(rng, right, wrongs);
      return {
        eq: `${a} : ${b}`, answer: right, wrongs,
        ar: `أيّ النسب الآتية تكافئ النسبة ${a} : ${b}؟\n${L.ar}`,
        en: `Which of these ratios is equivalent to ${a} : ${b}?\n${L.en}`,
      };
    }
    const wrongs = numWrongs(ans, [b + k, b + a * k - a, ans + b, a * k * b]);
    if (kind === 2) {
      if (a * k < 3) return ratioEquiv.make({ rng, diff, grade: 6 });
      return {
        eq: `${a} : ${b} = ${a * k} : ?`, answer: String(ans), wrongs,
        ar: `في وصفة عصير، نسبة الماء إلى العصير المركّز ${a} : ${b}. إذا استُعمل ${counted(a * k, 'أكواب', 'كوبًا', 'كوب')} من الماء، فكم كوبًا من العصير المركّز يلزم؟`,
        en: `In a juice recipe the ratio of water to concentrate is ${a} : ${b}. If ${a * k} cups of water are used, how many cups of concentrate are needed?`,
      };
    }
    return {
      eq: `${a} : ${b} = ${a * k} : ?`, answer: String(ans), wrongs,
      ar: `أكمل لتحصل على نسبتين متكافئتين: ${a} : ${b} = ${a * k} : ؟`, en: `Complete the equivalent ratios: ${a} : ${b} = ${a * k} : ?`,
    };
  },
};

// ─── rational numbers and exponent laws (Grade 7) ───────────────────────────

/** All six orders of three items, as text — the wrong options of an ordering question. */
const orders = <T,>(xs: readonly T[], show: (x: T) => string) => {
  const [p, q, r] = xs;
  return [[p, q, r], [p, r, q], [q, p, r], [q, r, p], [r, p, q], [r, q, p]].map(o => o.map(x => show(x!)).join(' ، '));
};

/** A sign between two rationals; three rationals in ascending order; and the largest or smallest of four. */
const ratCompare: Topic = {
  id: 'rat_compare', match: /مقارنه الاعداد النسبيه/, grades: [7, 7],
  make({ rng, diff }) {
    const f = (x: { n: number; d: number }) => `${signed(x.n)}/${x.d}`;
    const kind = pick(rng, [0, 1, 2]);
    if (kind === 0) {
      const [d1, d2] = [pick(rng, [2, 3, 4, 5, 6, 8]), pick(rng, [2, 3, 4, 5, 6, 8])];
      const n1 = numerator(rng, d1, d1 * 2), n2 = numerator(rng, d2, d2 * 2);
      if (n1 * d2 === n2 * d1) return ratCompare.make({ rng, diff, grade: 7 });
      const ans = n1 * d2 < n2 * d1 ? '<' : '>';
      const g = (n: number, d: number) => `${signed(n)}/${d}`;
      return {
        eq: `${g(n1, d1)} ___ ${g(n2, d2)}`, answer: ans, wrongs: ['>', '<', '='].filter(s => s !== ans),
        ar: `ضع الإشارة المناسبة (> أو < أو =):\n${g(n1, d1)} ___ ${g(n2, d2)}`, en: `Write the correct sign (>, < or =):\n${g(n1, d1)} ___ ${g(n2, d2)}`,
      };
    }
    // distinct values, each in lowest terms
    const xs: Array<{ n: number; d: number }> = [];
    while (xs.length < (kind === 1 ? 3 : 4)) {
      const d = pick(rng, [2, 3, 4, 5, 6, 8]);
      const n = numerator(rng, d, d * 2);
      if (!xs.some(o => o.n * d === n * o.d)) xs.push({ n, d });
    }
    const v = (x: { n: number; d: number }) => x.n / x.d;
    if (kind === 1) {
      const asc = xs.slice().sort((p, q) => v(p) - v(q));
      const ans = asc.map(f).join(' ، ');
      return {
        eq: xs.map(f).join(', '), answer: ans,
        // descending, by numerator and by size first, then any other order
        wrongs: wrongsFrom(ans, [asc.slice().reverse().map(f).join(' ، '), xs.slice().sort((p, q) => p.n - q.n).map(f).join(' ، '), xs.slice().sort((p, q) => Math.abs(v(p)) - Math.abs(v(q))).map(f).join(' ، '), ...orders(asc, f)], () => ''),
        ar: `رتّب الأعداد النسبية الآتية تصاعديًا: ${xs.map(f).join(' ، ')}`,
        en: `Order these rational numbers from least to greatest: ${xs.map(f).join(', ')}`,
      };
    }
    const big = rng() < 0.5;
    const best = xs.reduce((p, q) => ((big ? v(q) > v(p) : v(q) < v(p)) ? q : p));
    const ans = f(best);
    const wrongs = xs.filter(x => x !== best).map(f);
    return {
      eq: xs.map(f).join(', '), answer: ans, wrongs,
      ar: `ما ${big ? 'أكبر' : 'أصغر'} الأعداد النسبية الآتية: ${xs.map(f).join(' ، ')}؟`,
      en: `Which is the ${big ? 'greatest' : 'least'} of these rational numbers: ${xs.map(f).join(', ')}?`,
    };
  },
};

/**
 * Rational addition/subtraction or multiplication/division: compute; the
 * additive (or multiplicative) inverse; and a jump along the number line (or
 * the missing factor).
 */
const ratOp = (id: string, match: RegExp, ops: Array<'+' | '−' | '×' | '÷'>): Topic => ({
  id, match, grades: [7, 7],
  make({ rng, diff }) {
    const op = pick(rng, ops);
    const dens = diff === 'easy' ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8];
    const [d1, d2] = [pick(rng, dens), pick(rng, dens)];
    const n1 = numerator(rng, d1, d1 + 2), n2 = numerator(rng, d2, d2 + 2);
    const f = (x: number, y: number) => `${x < 0 ? '(' : ''}${signed(x)}/${y}${x < 0 ? ')' : ''}`;
    const addLike = op === '+' || op === '−';
    const kind = pick(rng, [0, 1, 2]);
    if (kind === 1) {
      const ans = addLike ? sfrac(-n1, d1) : sfrac(d1, n1);
      const wrongs = fracWrongs(ans, addLike ? [sfrac(n1, d1), sfrac(d1, n1), sfrac(-d1, n1)] : [sfrac(-n1, d1), sfrac(-d1, n1), sfrac(n1, d1)]);
      return addLike
        ? { eq: `0 − ${f(n1, d1)}`, answer: ans, wrongs, ar: `ما النظير الجمعي للعدد ${sfrac(n1, d1)}؟`, en: `What is the additive inverse of ${sfrac(n1, d1)}?` }
        : { eq: `1 ÷ ${f(n1, d1)}`, answer: ans, wrongs, ar: `ما النظير الضربي للعدد ${sfrac(n1, d1)}؟`, en: `What is the multiplicative inverse of ${sfrac(n1, d1)}?` };
    }
    if (kind === 2 && addLike) {
      const ans = sfrac(n1 * d2 + n2 * d1, d1 * d2);
      const right = n2 > 0;
      const step = `${Math.abs(n2)}/${d2}`;
      return {
        eq: `${f(n1, d1)} + ${f(n2, d2)}`, answer: ans,
        wrongs: fracWrongs(ans, [sfrac(n1 * d2 - n2 * d1, d1 * d2), sfrac(-(n1 * d2 + n2 * d1), d1 * d2), sfrac(n1 + n2, d1 + d2), sfrac(n1, d1), sfrac(n2, d2)]),
        ar: `يقف جندب على خط الأعداد عند النقطة ${sfrac(n1, d1)}، ثم قفز ${step} وحدة نحو ${right ? 'اليمين' : 'اليسار'}. عند أيّ نقطة أصبح؟`,
        en: `A grasshopper on the number line is at ${sfrac(n1, d1)} and jumps ${step} of a unit to the ${right ? 'right' : 'left'}. Where does it land?`,
      };
    }
    if (kind === 2) {
      // f1 × ? = P, so ? = P ÷ f1 — the second number back
      const P = sfrac(n1 * n2, d1 * d2);
      const ans = sfrac(n2, d2);
      const wrongs = fracWrongs(ans, [sfrac(n1 * n1 * n2, d1 * d1 * d2), sfrac(-n2, d2), sfrac(d2, n2), sfrac(n2 + d2, d2)]);
      return {
        eq: `${P} ÷ ${f(n1, d1)}`, answer: ans, wrongs,
        ar: `ما العدد الذي إذا ضُرب في ${f(n1, d1)} كان الناتج ${P}؟`,
        en: `What number multiplied by ${f(n1, d1)} gives ${P}?`,
      };
    }
    const [n, d] = op === '+' ? [n1 * d2 + n2 * d1, d1 * d2] : op === '−' ? [n1 * d2 - n2 * d1, d1 * d2] : op === '×' ? [n1 * n2, d1 * d2] : [n1 * d2, d1 * n2];
    const ans = sfrac(n, d);
    const swapped = op === '+' ? sfrac(n1 * d2 - n2 * d1, d1 * d2) : op === '−' ? sfrac(n1 * d2 + n2 * d1, d1 * d2) : op === '×' ? sfrac(n1 * d2, n2 * d1) : sfrac(n1 * n2, d1 * d2);
    const wrongs = wrongsFrom(ans, [swapped, sfrac(-n, d), op === '+' || op === '−' ? sfrac(n1 + n2, d1 + d2) : sfrac(n1 * n2, d1 + d2), sfrac(n + d, d)].filter(w => w !== ans), j => sfrac(n + j, d));
    return {
      eq: `${f(n1, d1)} ${op} ${f(n2, d2)}`, answer: ans, wrongs,
      ar: `أوجد ناتج ${f(n1, d1)} ${op} ${f(n2, d2)} في أبسط صورة.`, en: `Find ${f(n1, d1)} ${op} ${f(n2, d2)} in simplest form.`,
    };
  },
});

/** The repeating block of a fraction; a repeating decimal written as a fraction; and a repeating decimal compared with a number. */
const repeating: Topic = {
  id: 'repeating', match: /الكسور العشريه الدوريه/, grades: [7, 7],
  make({ rng }) {
    for (let a = 0; a < 100; a++) {
      const d = pick(rng, [3, 6, 7, 9, 11, 12, 13, 15]);
      const n = int(rng, 1, d - 1);
      if (gcd(n, d) !== 1) continue;
      // long division, remembering remainders to find where the cycle starts
      const seen = new Map<number, number>(); const digs: number[] = [];
      let r = n;
      while (r !== 0 && !seen.has(r)) { seen.set(r, digs.length); r *= 10; digs.push(Math.floor(r / d)); r %= d; }
      if (r === 0) continue; // terminating
      const start = seen.get(r)!;
      const period = digs.slice(start).join('');
      if (period.length > 6) continue;
      const prefix = digs.slice(0, start).join('');
      const D = prefix + period;
      // «0.1666…», «0.4545…»: the block written out until it is clear what repeats
      const shown = `0.${prefix}${period.repeat(period.length === 1 ? 3 : 2)}…`;
      const kind = pick(rng, [0, 1, 2]);
      if (kind === 1) {
        const ans = `${n}/${d}`;
        // ignoring the digits before the block, and treating the decimal as if it ended
        const wrongs = fracWrongs(ans, [prefix ? `${Number(period)}/${'9'.repeat(period.length)}` : '', `${Number(D)}/${10 ** D.length}`, `${Number(D)}/${'9'.repeat(D.length)}`, `${n}/${d + 1}`, `${n + 1}/${d}`]);
        if (wrongs.length < 3) continue;
        return {
          eq: shown, answer: ans, wrongs,
          ar: `اكتب العدد العشري الدوري ${shown} على صورة كسر في أبسط صورة.`,
          en: `Write the repeating decimal ${shown} as a fraction in simplest form.`,
        };
      }
      if (kind === 2) {
        // = its own fraction; > the decimal cut off after one block; < that cut-off plus one in its last place
        const which = int(rng, 0, 2);
        const up = String(Number(D) + 1).padStart(D.length, '0');
        const other = which === 0 ? `${n}/${d}` : which === 1 ? `0.${D}` : `0.${up}`;
        const ans = which === 0 ? '=' : which === 1 ? '>' : '<';
        return {
          eq: `${shown} ___ ${other}`, answer: ans, wrongs: ['>', '<', '='].filter(s => s !== ans),
          ar: `ضع الإشارة المناسبة (> أو < أو =):\n${shown} ___ ${other}`,
          en: `Write the correct sign (>, < or =):\n${shown} ___ ${other}`,
        };
      }
      return {
        eq: `${n}/${d}`, answer: period,
        wrongs: wrongsFrom(period, [period.split('').reverse().join(''), digs.slice(0, period.length + 1).join(''), period.slice(0, -1) || '1', `${period}${period[0]}`], j => String(Number(period) + Math.abs(j)).padStart(period.length, '0')),
        ar: `حوّل ${n}/${d} إلى عدد عشري دوري. ما الأرقام التي تتكرر؟`,
        en: `Convert ${n}/${d} to a repeating decimal. Which digits repeat?`,
      };
    }
    return { eq: '1/3', answer: '3', wrongs: ['33', '0', '1'], ar: 'اذكر الرقم المتكرر في 1/3.', en: 'Give the repeating digit in 1/3.' };
  },
};

const expLaws: Topic = {
  id: 'exp_laws', match: /قوانين الاسس/, grades: [7, 8],
  make({ rng, diff }) {
    const m = int(rng, 2, 7), n = int(rng, 2, 5);
    // «بسّط: …» is one kind however it is built (0 product, 1 quotient, 2 power of a power, 5 power of a product);
    // 3 a zero exponent, 4 a negative one, 6 the missing exponent, 7 a power of a number worked out by the laws.
    const simplify = pick(rng, diff === 'easy' ? [0, 1] : diff === 'medium' ? [0, 1, 2] : [0, 1, 2, 5]);
    const k = pick(rng, diff === 'easy' ? [simplify, 3, 6, 7] : [simplify, 3, 4, 6, 7]);
    if (k === 6) {
      // xᵐ × xⁿ = xᵐ⁺ⁿ, xᵐ ÷ xⁿ = xᵐ⁻ⁿ, (xᵐ)ⁿ = xᵐⁿ — solve for n
      const law = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2]);
      const [lhs, rhs, wr]: [string, number, number[]] = law === 0 ? [`x${sup(m)} × xⁿ`, m + n, [m + n, m, n + 1]]
        : law === 1 ? [`x${sup(m + n)} ÷ xⁿ`, m, [m + n, m, 2 * m + n]]
        : [`(x${sup(m)})ⁿ`, m * n, [m * n, m * n - m, m + n]];
      return { eq: `${lhs} = x${sup(rhs)}`, answer: String(n), wrongs: wrongsFrom(String(n), wr.filter(v => v !== n && v > 0).map(String)), ar: `ما قيمة n التي تجعل العبارة صحيحة: ${lhs} = x${sup(rhs)}؟`, en: `What value of n makes this true: ${lhs} = x${sup(rhs)}?` };
    }
    if (k === 7) {
      // bᵖ × bᵠ ÷ bʳ = bᵖ⁺ᵠ⁻ʳ, a small whole number
      const b = pick(rng, [2, 3, 5, 10]), e = b === 2 ? int(rng, 2, 5) : b === 10 ? int(rng, 2, 4) : int(rng, 1, 3), p = int(rng, e + 1, e + 5), q = int(rng, 1, 4), r = p + q - e;
      const ans = b ** e;
      return { eq: `${b}${sup(p)} × ${b}${sup(q)} ÷ ${b}${sup(r)}`, answer: String(ans), wrongs: wrongsFrom(String(ans), [b ** (e + 1), b * e, b ** (p + q), ans + b].filter(v => v !== ans).map(String)), ar: `احسب ناتج ${b}${sup(p)} × ${b}${sup(q)} ÷ ${b}${sup(r)} باستعمال قوانين الأسس.`, en: `Use the laws of exponents to work out ${b}${sup(p)} × ${b}${sup(q)} ÷ ${b}${sup(r)}.` };
    }
    const x = (e: number) => (e === 1 ? 'x' : `x${sup(e)}`);
    const mk = (eq: string, e: number, ar: string, en: string, w: number[]): Draft => ({
      eq, answer: x(e), wrongs: wrongsFrom(x(e), w.filter(v => Number.isInteger(v) && v > 1 && v !== e).map(x), j => x(e + Math.abs(j) + 1)), ar, en,
    });
    if (k === 0) return mk(`x${sup(m)} × x${sup(n)}`, m + n, `بسّط: x${sup(m)} × x${sup(n)}`, `Simplify: x${sup(m)} × x${sup(n)}`, [m * n, m - n, m + n + 1]);
    if (k === 1) { const [a, b] = m > n ? [m, n] : [n + 1, m]; return mk(`x${sup(a)} ÷ x${sup(b)}`, a - b, `بسّط: x${sup(a)} ÷ x${sup(b)}`, `Simplify: x${sup(a)} ÷ x${sup(b)}`, [a + b, a * b, a / b]); }
    if (k === 2) return mk(`(x${sup(m)})${sup(n)}`, m * n, `بسّط: (x${sup(m)})${sup(n)}`, `Simplify: (x${sup(m)})${sup(n)}`, [m + n, m ** n, m * n + 1]);
    if (k === 3) { const b = int(rng, 2, 9); return { eq: `${b}⁰`, answer: '1', wrongs: wrongsFrom('1', ['0', String(b), signed(-b)]), ar: `أوجد قيمة ${b}⁰.`, en: `Find ${b}⁰.` }; }
    if (k === 4) { const b = pick(rng, [2, 3, 5, 10]), e = int(rng, 1, 3); const ans = `1/${b ** e}`; return { eq: `${b}${sup(-e)}`, answer: ans, wrongs: wrongsFrom(ans, [signed(-(b ** e)), signed(-b * e), `1/${b * e}`, `1/${b ** (e + 1)}`], k2 => `1/${b ** e + k2}`), ar: `اكتب ${b}${sup(-e)} على صورة كسر.`, en: `Write ${b}${sup(-e)} as a fraction.` }; }
    const b = int(rng, 2, 4), e = int(rng, 2, 4);
    return { eq: `(${b}x)${sup(e)}`, answer: `${b ** e}x${sup(e)}`, wrongs: wrongsFrom(`${b ** e}x${sup(e)}`, [`${b * e}x${sup(e)}`, `${b}x${sup(e)}`, `${b ** e}x`], k => `${b ** e + Math.abs(k)}x${sup(e)}`), ar: `بسّط: (${b}x)${sup(e)}`, en: `Simplify: (${b}x)${sup(e)}` };
  },
};

/** Specific titles first; the more general patterns after. */
export const TOPICS: readonly Topic[] = [
  roundDec, roundWhole, estSumDec,
  estSum('est_sum', /تقدير.*(?:مجموع|فرق)/, 'both'), estSum('est_add', /تقدير.*جمع/, 'add'), estSum('est_sub', /تقدير.*طرح/, 'sub'),
  estProd, estQuot, tensMul, tensDiv,
  orderOps, factors, primes, divisibility, primeFact, gcf, lcmT, squares, powers,
  intIntro, intAbs, intCompare,
  intOp('int_add', /جمع الاعداد الصحيحه/, '+'), intOp('int_sub', /طرح الاعداد الصحيحه/, '−'), intOp('int_muldiv', /ضرب الاعداد الصحيحه/, '×÷'),
  equivFrac,
  mixedOp('mixed_addsub', /(?:جمع|طرح).*الاعداد الكسريه/, ['+', '−']), mixedOp('mixed_mul', /ضرب الاعداد الكسريه/, ['×']), mixedOp('mixed_div', /قسمه الاعداد الكسريه/, ['÷']),
  mixedImproper, fracDec, decPlace, pctConv, ratioEquiv, ratioSimplest,
  ratCompare, ratOp('rat_addsub', /جمع الاعداد النسبيه/, ['+', '−']), ratOp('rat_muldiv', /ضرب الاعداد النسبيه/, ['×', '÷']),
  repeating, expLaws,
  ...ALGEBRA_TOPICS,
  ...GEOMETRY_TOPICS,
  ...STATS_TOPICS,
  ...PROPORTION_TOPICS,
  ...EARLY_TOPICS,
];

/** The generator for a lesson title and grade, or null when none is about it. */
export function topicFor(title: string, grade: number): Topic | null {
  const t = fold(title).replace(/[:،,]/g, ' ').replace(/\s+/g, ' ').trim();
  return TOPICS.find(x => grade >= x.grades[0] && grade <= x.grades[1] && x.match.test(t)) ?? null;
}


/**
 * A fresh item for a lesson `topicFor` matched; a draw that repeats a stem this
 * pass is retried.
 *
 * Most generators ask one of several kinds of question («ما بُعد الوتر عن
 * المركز؟», «ما طول الوتر؟», «ما طول المماس؟») and pick the kind at random, so
 * a paper could hold five of one kind and none of another. Of a few fresh
 * draws, the one whose kind this pass has served least is kept (`spreadScore`:
 * sentences a word or two apart are one kind, `sameKind`). A draw of an unserved
 * kind ends the search at once, so the first item of a pass costs one draw as
 * before.
 *
 * The bank (`takeFromBank`) deliberately does not do this. Its items are finite:
 * on a lesson holding a few one-item kinds, spreading puts those items on
 * nearly every paper, and «أعد التجهيز» could no longer find a paper that
 * avoids the last one (`quizRegenerateStems.test.ts`). A generator makes new
 * numbers on every draw, so nothing is lost here.
 */
export function makeTopicItem(topic: Topic, grade: number, diff: DiffTier, used: Set<string>, rng: Rng = Math.random): ConcreteItem {
  const served = servedFrames(used);
  let d: Draft | null = null;
  let best: Draft | null = null;
  let bestServed = Infinity;
  let fresh = 0;
  for (let attempt = 0; attempt < 25 && fresh < FRESH_DRAWS; attempt++) {
    d = topic.make({ rng, diff, grade });
    if (used.has(`stem:${d.ar}`)) continue;
    fresh += 1;
    const n = spreadScore(stemFrame(d.ar), served);
    if (n < bestServed) {
      best = d;
      bestServed = n;
    }
    if (n === 0) break;
  }
  d = best ?? d;
  used.add(`stem:${d!.ar}`);
  used.add(`ask:${d!.ar}`);
  const wrongs = d!.wrongs.filter(w => w !== d!.answer).slice(0, 3);
  return {
    id: `topic-${topic.id}-${grade}-${used.size}-${int(rng, 0, 9)}`,
    family: 'topic', diff, eq: d!.eq, answer: d!.answer, wrongs,
    promptAr: d!.ar, promptEn: d!.en,
  };
}
