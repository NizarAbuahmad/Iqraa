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
import {
  gcd, int, lcm, mixed, nz, numWrongs, numerator, paren, pick, sfrac, signed, sup, tier, valueOf, wrongsFrom,
  type Ctx, type Draft, type Rng, type Topic,
} from './topicKit.ts';

// ─── rounding and estimating ────────────────────────────────────────────────

const PLACE_AR: Record<number, string> = { 10: 'عشرة', 100: 'مئة', 1000: 'ألف' };
const PLACE_EN: Record<number, string> = { 10: 'ten', 100: 'hundred', 1000: 'thousand' };
const roundTo = (n: number, place: number) => Math.round(n / place) * place;
/** Round to the greatest place: 4 872 → 5 000, 38 → 40. */
const lead = (n: number) => { const p = 10 ** (String(Math.round(n)).length - 1); return p === 1 ? n : roundTo(n, p); };

const roundWhole: Topic = {
  id: 'round_whole', match: /تقريب(?!.*عشري)/, grades: [3, 6],
  make({ rng, diff, grade }) {
    const place = pick(rng, diff === 'easy' ? [10] : diff === 'medium' || grade <= 4 ? [10, 100] : [10, 100, 1000]);
    const n = int(rng, place * 3 + 1, place * (diff === 'easy' ? 30 : 90) + place - 1);
    if (n % place === 0) return roundWhole.make({ rng, diff, grade });
    const a = roundTo(n, place);
    return {
      eq: `${n}`, answer: String(a),
      wrongs: numWrongs(a, [Math.floor(n / place) * place, Math.ceil(n / place) * place, roundTo(n, place * 10), roundTo(n, place / 10)].filter(x => x !== n)),
      ar: `قرّب العدد ${n} إلى أقرب ${PLACE_AR[place]}.`,
      en: `Round ${n} to the nearest ${PLACE_EN[place]}.`,
    };
  },
};

const roundDec: Topic = {
  id: 'round_dec', match: /تقريب.*عشري/, grades: [4, 6],
  make({ rng, diff, grade }) {
    const places = diff === 'easy' || grade <= 4 ? 0 : pick(rng, [0, 1]);
    const raw = int(rng, 1001, 99999); // thousandths
    const n = raw / 1000;
    const scale = 10 ** (3 - places);
    if (raw % scale === 0) return roundDec.make({ rng, diff, grade });
    const r = Math.round(raw / scale);
    const a = fixedDec(r, places);
    const shown = fmtDec(raw, 3);
    const lower = fixedDec(Math.floor(raw / scale), places), upper = fixedDec(Math.ceil(raw / scale), places);
    const otherPlaces = places === 0 ? 1 : 0;
    const other = fixedDec(Math.round(raw / 10 ** (3 - otherPlaces)), otherPlaces);
    const where = places === 0 ? ['أقرب عدد صحيح', 'the nearest whole number'] : ['أقرب أعشار', 'the nearest tenth'];
    return {
      eq: shown, answer: a,
      wrongs: wrongsFrom(a, [lower, upper, other, fixedDec(Math.round(raw / 10), 2)], k => fixedDec(r + k, places)),
      ar: `قرّب العدد ${shown} إلى ${where[0]}.`,
      en: `Round ${shown} to ${where[1]}.`,
    };
  },
};

/** «تقدير ناتج الجمع» estimates sums only, «…الطرح» differences only, «المجموع والفرق» either. */
const estSum = (id: string, match: RegExp, mode: 'add' | 'sub' | 'both'): Topic => ({
  id, match, grades: [3, 6],
  make({ rng, diff }) {
    const digits = diff === 'easy' ? 2 : diff === 'medium' ? 3 : 4;
    let a = 0, b = 0, add = true;
    do {
      a = int(rng, 10 ** (digits - 1) + 1, 10 ** digits - 1);
      b = int(rng, 10 ** (digits - 1) + 1, a);
      add = mode === 'both' ? rng() < 0.5 : mode === 'add';
    } while (!add && lead(a) === lead(b));
    const est = add ? lead(a) + lead(b) : lead(a) - lead(b);
    const exact = add ? a + b : a - b;
    const op = add ? '+' : '−';
    return {
      eq: `${a} ${op} ${b}`, answer: String(est),
      wrongs: numWrongs(est, [exact, add ? roundTo(a, 10) + roundTo(b, 10) : roundTo(a, 10) - roundTo(b, 10), est * 10, est / 10].filter(x => Number.isInteger(x) && x >= 0 && x !== est)),
      ar: `قدّر ناتج ${a} ${op} ${b} بتقريب كل عدد إلى أكبر منزلة له.`,
      en: `Estimate ${a} ${op} ${b} by rounding each number to its greatest place.`,
    };
  },
});

const estSumDec: Topic = {
  id: 'est_sum_dec', match: /تقدير.*عشري/, grades: [5, 6],
  make({ rng, diff }) {
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
      ar: `قدّر ناتج ${hi} ${op} ${lo} بتقريب كل عدد إلى أقرب عدد صحيح.`,
      en: `Estimate ${hi} ${op} ${lo} by rounding each number to the nearest whole number.`,
    };
  },
};

const estProd: Topic = {
  id: 'est_prod', match: /تقدير.*ضرب/, grades: [4, 6],
  make({ rng, diff }) {
    const a = int(rng, diff === 'easy' ? 11 : 101, diff === 'easy' ? 99 : 899);
    const b = int(rng, 11, diff === 'hard' ? 99 : 59);
    const est = lead(a) * lead(b);
    return {
      eq: `${a} × ${b}`, answer: String(est),
      wrongs: numWrongs(est, [a * b, est * 10, est / 10, lead(a) * b]),
      ar: `قدّر ناتج ${a} × ${b} بتقريب كل عدد إلى أكبر منزلة له.`,
      en: `Estimate ${a} × ${b} by rounding each number to its greatest place.`,
    };
  },
};

const estQuot: Topic = {
  id: 'est_quot', match: /تقدير.*قسم/, grades: [4, 6],
  make({ rng, diff }) {
    const d = int(rng, 2, 9);
    const q = int(rng, 2, 9);
    const m = diff === 'easy' ? 1 : pick(rng, [1, 2]);
    const unit = 10 ** m;
    const noise = int(rng, -(unit / 2 - 1), unit / 2 - 1);
    const n = d * q * unit + noise;
    const est = q * unit;
    return {
      eq: `${n} ÷ ${d}`, answer: String(est),
      wrongs: numWrongs(est, [Math.floor(n / d), est * 10, est / 10, est + unit].filter(v => v !== est)),
      ar: `قدّر ناتج ${n} ÷ ${d} بتقريب ${n} إلى أقرب ${PLACE_AR[unit]}.`,
      en: `Estimate ${n} ÷ ${d} by rounding ${n} to the nearest ${PLACE_EN[unit]}.`,
    };
  },
};

const tensMul: Topic = {
  id: 'tens_mul', match: /الضرب في مضاعفات/, grades: [4, 4],
  make({ rng, diff }) {
    const a = int(rng, 2, 9), b = int(rng, 2, 9);
    const k = int(rng, 1, diff === 'easy' ? 1 : 3);
    const j = diff === 'hard' ? int(rng, 1, 2) : 0;
    const x = a * 10 ** k, y = b * 10 ** j;
    const ans = x * y;
    const text = j === 0 ? `${a * 10 ** k} × ${b}` : `${x} × ${y}`;
    return {
      eq: text, answer: String(ans),
      wrongs: numWrongs(ans, [ans * 10, ans / 10, a * b]),
      ar: `أوجد ناتج ${text}.`, en: `Find ${text}.`,
    };
  },
};

const tensDiv: Topic = {
  id: 'tens_div', match: /قسمه مضاعفات/, grades: [4, 4],
  make({ rng, diff }) {
    const c = int(rng, 2, 9), q = int(rng, 2, 9);
    const m = int(rng, 1, diff === 'easy' ? 2 : 3);
    const j = diff === 'easy' ? 0 : 1;
    const n = c * q * 10 ** m, d = c * 10 ** j;
    const ans = n / d;
    return {
      eq: `${n} ÷ ${d}`, answer: String(ans),
      wrongs: numWrongs(ans, [ans * 10, ans / 10, q]),
      ar: `أوجد ناتج ${n} ÷ ${d}.`, en: `Find ${n} ÷ ${d}.`,
    };
  },
};

// ─── number theory ──────────────────────────────────────────────────────────

const divisors = (n: number) => { const o: number[] = []; for (let i = 1; i <= n; i++) if (n % i === 0) o.push(i); return o; };
const isPrime = (n: number) => n > 1 && divisors(n).length === 2;
const primeFactors = (n: number) => { const o: number[] = []; for (let p = 2; n > 1; p++) while (n % p === 0) { o.push(p); n /= p; } return o; };

const factors: Topic = {
  id: 'factors', match: /^العوامل$/, grades: [4, 6],
  make({ rng, diff }) {
    const n = int(rng, 6, diff === 'easy' ? 30 : diff === 'medium' ? 60 : 100);
    const ds = divisors(n);
    if (rng() < 0.5) {
      const a = ds.length;
      return {
        eq: `${n}`, answer: String(a),
        wrongs: numWrongs(a, [a - 1, a + 1, a + 2, Math.floor(a / 2)]),
        ar: `كم عاملًا للعدد ${n}؟`, en: `How many factors does ${n} have?`,
      };
    }
    const small = ds.filter(x => x > 1 && x < n);
    if (small.length === 0) return factors.make({ rng, diff, grade: 4 });
    const f = ds[ds.length - 2]!; // largest factor smaller than n
    return {
      eq: `${n}`, answer: String(f),
      wrongs: numWrongs(f, [f - 1, f + 1, n + f, n - 1].filter(x => x > 0 && n % x !== 0)),
      ar: `ما أكبر عامل للعدد ${n} أصغر من ${n} نفسه؟`,
      en: `What is the largest factor of ${n} that is smaller than ${n}?`,
    };
  },
};

const primes: Topic = {
  id: 'primes', match: /الاعداد الاوليه/, grades: [4, 6],
  make({ rng, diff }) {
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
  },
};

const divisibility: Topic = {
  id: 'divisibility', match: /قابليه القسمه/, grades: [4, 5],
  make({ rng, diff, grade }) {
    const pool = grade <= 4 ? [2, 3, 5, 10] : [4, 6, 9];
    const d = pick(rng, pool);
    for (let attempt = 0; attempt < 200; attempt++) {
      const len = diff === 'easy' ? 3 : 4;
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
        wrongs: wrongsFrom(String(ans), [...bad, ...ok.filter(v => v !== ans)].slice(0, 6), k => String((ans + k + 10) % 10)),
        ar: `ما ${wantMax ? 'أكبر' : 'أصغر'} رقم يوضع مكان ■ ليصبح العدد ${shown} قابلًا للقسمة على ${d}؟`,
        en: `What is the ${wantMax ? 'largest' : 'smallest'} digit that can replace ■ so that ${shown} is divisible by ${d}?`,
      };
    }
    return divisibility.make({ rng, diff, grade: 4 });
  },
};

const primeFact: Topic = {
  id: 'prime_fact', match: /تحليل العدد الي عوامله الاوليه/, grades: [5, 6],
  make({ rng, diff }) {
    let n = 0;
    do { n = int(rng, 12, diff === 'easy' ? 60 : diff === 'medium' ? 150 : 400); } while (isPrime(n) || primeFactors(n).length < 2);
    const fs = primeFactors(n);
    const ans = fs.join(' × ');
    const cands: string[] = [];
    if (fs.length >= 3) cands.push([fs[0]! * fs[1]!, ...fs.slice(2)].join(' × '));
    cands.push(`${n} × 1`);
    const alt = fs.slice(); alt[alt.length - 1] = alt[alt.length - 1]! + 2; cands.push(alt.join(' × '));
    return {
      eq: `${n}`, answer: ans,
      wrongs: wrongsFrom(ans, cands, k => fs.map((f, i) => (i === 0 ? f + k : f)).join(' × ')),
      ar: `حلّل العدد ${n} إلى عوامله الأولية.`, en: `Write ${n} as a product of prime factors.`,
    };
  },
};

const gcf: Topic = {
  id: 'gcf', match: /العامل المشترك الاكبر/, grades: [5, 6],
  make({ rng, diff }) {
    const g = int(rng, 2, diff === 'easy' ? 6 : 12);
    let a = 0, b = 0;
    do { a = g * int(rng, 2, diff === 'hard' ? 12 : 8); b = g * int(rng, 2, diff === 'hard' ? 12 : 8); } while (a === b || gcd(a, b) !== g);
    const ans = g;
    return {
      eq: `${a}, ${b}`, answer: String(ans),
      wrongs: numWrongs(ans, [lcm(a, b), Math.min(a, b), Math.abs(a - b) === g ? NaN : Math.abs(a - b), g * 2].filter(x => x !== g)),
      ar: `أوجد العامل المشترك الأكبر للعددين ${a} و${b}.`,
      en: `Find the greatest common factor of ${a} and ${b}.`,
    };
  },
};

const lcmT: Topic = {
  id: 'lcm', match: /المضاعف المشترك الاصغر/, grades: [5, 6],
  make({ rng, diff }) {
    let a = 0, b = 0;
    do { a = int(rng, 2, diff === 'easy' ? 9 : 15); b = int(rng, 2, diff === 'easy' ? 9 : 15); } while (a === b || a % b === 0 || b % a === 0 || lcm(a, b) > 120);
    const ans = lcm(a, b);
    return {
      eq: `${a}, ${b}`, answer: String(ans),
      wrongs: numWrongs(ans, [a * b === ans ? NaN : a * b, Math.max(a, b), gcd(a, b), ans * 2, ans + Math.max(a, b)].filter(x => x !== ans)),
      ar: `أوجد المضاعف المشترك الأصغر للعددين ${a} و${b}.`,
      en: `Find the least common multiple of ${a} and ${b}.`,
    };
  },
};

const squares: Topic = {
  id: 'squares', match: /مربع العدد|الجذر التربيعي/, grades: [5, 6],
  make({ rng, diff, grade }) {
    const cube = grade >= 6 && rng() < 0.35;
    if (cube) {
      const b = int(rng, 2, diff === 'hard' ? 10 : 6);
      return rng() < 0.5
        ? { eq: `∛${b ** 3}`, answer: String(b), wrongs: numWrongs(b, [b * 3, b * b, b + 1]), ar: `أوجد قيمة ∛${b ** 3}.`, en: `Find ∛${b ** 3}.` }
        : { eq: `${b}³`, answer: String(b ** 3), wrongs: numWrongs(b ** 3, [b * 3, b * b, b ** 3 + b]), ar: `أوجد قيمة ${b}³.`, en: `Find ${b}³.` };
    }
    const b = int(rng, 2, diff === 'easy' ? 10 : diff === 'medium' ? 15 : 25);
    return rng() < 0.5
      ? { eq: `${b}²`, answer: String(b * b), wrongs: numWrongs(b * b, [b * 2, b + b + 1, b * b + b, (b + 1) ** 2]), ar: `أوجد مربع العدد ${b}.`, en: `Find the square of ${b}.` }
      : { eq: `√${b * b}`, answer: String(b), wrongs: numWrongs(b, [b * 2, (b * b) / 2 | 0, b + 1, b - 1]), ar: `أوجد قيمة √${b * b}.`, en: `Find √${b * b}.` };
  },
};

const powers: Topic = {
  id: 'powers', match: /القوي والاسس/, grades: [6, 6],
  make({ rng, diff }) {
    const base = int(rng, 2, diff === 'easy' ? 5 : 10);
    const e = int(rng, 2, base <= 3 ? 5 : 3);
    const v = base ** e;
    if (rng() < 0.4) {
      return {
        eq: `${base} × `.repeat(e - 1) + base, answer: `${base}${sup(e)}`,
        wrongs: wrongsFrom(`${base}${sup(e)}`, [`${e}${sup(base)}`, `${base}${sup(e + 1)}`, `${base}${sup(e - 1)}`], k => `${base}${sup(e + Math.abs(k) + 1)}`),
        ar: `اكتب ${Array(e).fill(base).join(' × ')} باستعمال الأسس.`,
        en: `Write ${Array(e).fill(base).join(' × ')} using exponents.`,
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

const orderOps: Topic = {
  id: 'order_ops', match: /اولويات العمليات/, grades: [4, 8],
  make({ rng, diff, grade }) {
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
      const shape = pick(rng, shapes);
      const v = evalPrec(shape);
      const ltr = evalLtr(shape), np = evalNoParens(shape);
      if (v === null || v < 0 || !Number.isInteger(v)) continue;
      if (ltr === v && np === v) continue; // no slip to catch: not an order-of-operations item
      const text = shape.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
      return {
        eq: text, answer: String(v),
        wrongs: numWrongs(v, [ltr ?? NaN, np ?? NaN].filter(x => Number.isFinite(x) && x !== v && x >= 0)),
        ar: `أوجد قيمة المقدار: ${text}`, en: `Evaluate: ${text}`,
      };
    }
    return { eq: '2 + 3 × 4', answer: '14', wrongs: ['20', '24', '9'], ar: 'أوجد قيمة المقدار: 2 + 3 × 4', en: 'Evaluate: 2 + 3 × 4' };
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

const intAbs: Topic = {
  id: 'int_abs', match: /الاعداد الصحيحه والقيمه المطلقه/, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    const a = nz(rng, m);
    if (rng() < 0.5) {
      return { eq: `|${signed(a)}|`, answer: String(Math.abs(a)), wrongs: wrongsFrom(String(Math.abs(a)), [signed(a), signed(-Math.abs(a)), String(Math.abs(a) + 1)]), ar: `أوجد قيمة |${signed(a)}|.`, en: `Find |${signed(a)}|.` };
    }
    const ans = signed(-a);
    return { eq: `${signed(a)}`, answer: ans, wrongs: wrongsFrom(ans, [signed(a), String(Math.abs(a)), signed(-a + 1)]), ar: `ما العدد المقابل للعدد ${signed(a)}؟`, en: `What is the opposite of ${signed(a)}?` };
  },
};

const intCompare: Topic = {
  id: 'int_compare', match: /مقارنه الاعداد الصحيحه/, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    const xs = new Set<number>();
    while (xs.size < 3) xs.add(int(rng, -m, m));
    const arr = [...xs];
    if (rng() < 0.5) {
      const ans = signed(Math.min(...arr));
      return { eq: arr.map(signed).join(' ، '), answer: ans, wrongs: wrongsFrom(ans, arr.filter(x => x !== Math.min(...arr)).map(signed).concat(signed(Math.max(...arr) + 1)), k => signed(Math.min(...arr) + k)), ar: `ما أصغر الأعداد الآتية: ${arr.map(signed).join(' ، ')}؟`, en: `Which is the smallest of: ${arr.map(signed).join(', ')}?` };
    }
    const ans = arr.slice().sort((a, b) => a - b).map(signed).join(' ، ');
    const asc = arr.slice().sort((a, b) => a - b);
    const wrong = [asc.slice().reverse(), arr.slice().sort((a, b) => Math.abs(a) - Math.abs(b)), [asc[1]!, asc[0]!, asc[2]!]].map(r => r.map(signed).join(' ، '));
    return { eq: arr.map(signed).join(' ، '), answer: ans, wrongs: wrongsFrom(ans, wrong, k => [asc[0]!, asc[1]!, asc[2]! + k].map(signed).join(' ، ')), ar: `رتّب الأعداد الآتية تصاعديًا: ${arr.map(signed).join(' ، ')}`, en: `Order from least to greatest: ${arr.map(signed).join(', ')}` };
  },
};

const intOp = (id: string, match: RegExp, op: '+' | '−' | '×÷'): Topic => ({
  id, match, grades: [6, 7],
  make({ rng, diff, grade }) {
    const m = span(diff, grade);
    if (op === '×÷') {
      const a = nz(rng, diff === 'hard' ? 12 : 9), b = nz(rng, diff === 'easy' ? 5 : 9);
      if (rng() < 0.5) {
        const ans = a * b;
        return { eq: `${paren(a)} × ${paren(b)}`, answer: signed(ans), wrongs: numWrongs(ans, [-ans, a + b, a - b, Math.abs(ans)], signed), ar: `أوجد ناتج ${paren(a)} × ${paren(b)}.`, en: `Find ${paren(a)} × ${paren(b)}.` };
      }
      const ans = b, n = a * b;
      return { eq: `${signed(n)} ÷ ${paren(a)}`, answer: signed(ans), wrongs: numWrongs(ans, [-ans, n - a, a, Math.abs(ans)], signed), ar: `أوجد ناتج ${signed(n)} ÷ ${paren(a)}.`, en: `Find ${signed(n)} ÷ ${paren(a)}.` };
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

const equivFrac: Topic = {
  id: 'equiv_frac', match: /الكسور المتكافئه/, grades: [4, 5],
  make({ rng, diff }) {
    const d = pick(rng, [2, 3, 4, 5, 6, 8]);
    let n = int(rng, 1, d - 1);
    while (gcd(n, d) !== 1) n = int(rng, 1, d - 1);
    const k = int(rng, 2, diff === 'easy' ? 4 : 9);
    const ans = n * k;
    return {
      eq: `${n}/${d} = ?/${d * k}`, answer: String(ans),
      wrongs: numWrongs(ans, [n + k, n * (k - 1), n + d * k - d, ans + d]),
      ar: `أكمل لتحصل على كسرين متكافئين: ${n}/${d} = ؟/${d * k}`,
      en: `Complete the equivalent fractions: ${n}/${d} = ?/${d * k}`,
    };
  },
};

const mixedImproper: Topic = {
  id: 'mixed_improper', match: /^الاعداد الكسريه(?: والكسور غير الفعليه)?$/, grades: [4, 6],
  make({ rng, diff }) {
    const d = pick(rng, diff === 'easy' ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8, 10]);
    const w = int(rng, 1, diff === 'easy' ? 3 : 9);
    let r = int(rng, 1, d - 1);
    while (gcd(r, d) !== 1) r = int(rng, 1, d - 1);
    const n = w * d + r;
    if (rng() < 0.5) {
      const ans = `${w} ${r}/${d}`;
      return {
        eq: `${n}/${d}`, answer: ans,
        wrongs: wrongsFrom(ans, [`${w + 1} ${r}/${d}`, `${w} ${d - r}/${d}`, `${w} ${r + 1 < d ? r + 1 : r - 1}/${d}`, `${r} ${w}/${d}`], k => `${w + Math.abs(k) + 1} ${r}/${d}`),
        ar: `اكتب الكسر غير الفعلي ${n}/${d} على صورة عدد كسري.`, en: `Write the improper fraction ${n}/${d} as a mixed number.`,
      };
    }
    const ans = `${n}/${d}`;
    return {
      eq: `${w} ${r}/${d}`, answer: ans,
      wrongs: wrongsFrom(ans, [`${w + r}/${d}`, `${w * r + d}/${d}`, `${n - d}/${d}`, `${n}/${r}`], k => `${n + k}/${d}`),
      ar: `اكتب العدد الكسري ${w} ${r}/${d} على صورة كسر غير فعلي.`, en: `Write the mixed number ${w} ${r}/${d} as an improper fraction.`,
    };
  },
};

/** Denominators whose fractions terminate, with the decimal places that takes. */
const TERMINATING: Array<[number, number]> = [[2, 1], [4, 2], [5, 1], [10, 1], [20, 2], [25, 2], [50, 2], [100, 2], [8, 3]];

const fracDec: Topic = {
  id: 'frac_dec', match: /التحويل بين الكسور والاعداد العشريه|اجزاء (?:العشره|المئه|الالف)|العدد النسبي$|كتابه العدد النسبي بالصوره العشريه/, grades: [4, 7],
  make({ rng, diff, grade }) {
    const [d, places] = pick(rng, diff === 'easy' ? TERMINATING.slice(0, 5) : grade <= 4 ? TERMINATING.slice(0, 8) : TERMINATING);
    let n = int(rng, 1, d - 1);
    if (gcd(n, d) !== 1 && rng() < 0.5) n = 1;
    const neg = grade >= 7 && rng() < 0.5;
    const raw = (n * 10 ** places) / d; // exact for these denominators
    const dec = (neg ? '−' : '') + fmtDec(raw, places);
    const f = neg ? `−${n}/${d}` : `${n}/${d}`;
    if (rng() < 0.5) {
      return {
        eq: f, answer: dec,
        wrongs: wrongsFrom(dec, [(neg ? '−' : '') + fmtDec(n * 10 ** places, places + 1), (neg ? '−' : '') + fmtDec(Math.round((d / n) * 100), 2), (neg ? '−' : '') + fmtDec(raw * 10, places)].filter(w => !/NaN/.test(w)), k => (neg ? '−' : '') + fmtDec(raw + Math.abs(k), places)),
        ar: `اكتب الكسر ${f} على صورة عدد عشري.`, en: `Write the fraction ${f} as a decimal.`,
      };
    }
    const ans = sfrac(neg ? -n : n, d);
    return {
      eq: dec, answer: ans,
      wrongs: wrongsFrom(ans, [sfrac(neg ? -d : d, n), sfrac(neg ? -(n + 1) : n + 1, d), sfrac(neg ? -n : n, d + 1)].filter(w => w !== ans), k => sfrac(neg ? -(n + Math.abs(k) + 1) : n + Math.abs(k) + 1, d)),
      ar: `اكتب العدد العشري ${dec} على صورة كسر في أبسط صورة.`, en: `Write the decimal ${dec} as a fraction in simplest form.`,
    };
  },
};

const decPlace: Topic = {
  id: 'dec_place', match: /^الاعداد العشريه$/, grades: [4, 4],
  make({ rng, diff }) {
    const places = diff === 'easy' ? 1 : diff === 'medium' ? 2 : 3;
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

/** Mixed-number sum/difference/product/quotient, answered as a mixed number. */
const mixedOp = (id: string, match: RegExp, ops: Array<'+' | '−' | '×' | '÷'>): Topic => ({
  id, match, grades: [5, 6],
  make({ rng, diff }) {
    const op = pick(rng, ops);
    const dens = diff === 'easy' ? [2, 4] : [2, 3, 4, 5, 6, 8];
    const mk = () => { const d = pick(rng, dens); return { w: int(rng, 1, diff === 'hard' ? 6 : 3), r: int(rng, 1, d - 1), d }; };
    let A = mk(), B = mk();
    const impN = (x: { w: number; r: number; d: number }) => x.w * x.d + x.r;
    let [an, ad, bn, bd] = [impN(A), A.d, impN(B), B.d];
    if (op === '−' && an * bd < bn * ad) { [A, B] = [B, A]; [an, ad, bn, bd] = [bn, bd, an, ad]; }
    if (op === '−' && an * bd === bn * ad) return mixedOp(id, match, ops).make({ rng, diff, grade: 5 });
    const [n, d] = op === '+' ? [an * bd + bn * ad, ad * bd] : op === '−' ? [an * bd - bn * ad, ad * bd] : op === '×' ? [an * bn, ad * bd] : [an * bd, ad * bn];
    const ans = mixed(n, d);
    const sh = (x: { w: number; r: number; d: number }) => `${x.w} ${x.r}/${x.d}`;
    return {
      eq: `${sh(A)} ${op} ${sh(B)}`, answer: ans,
      wrongs: wrongsFrom(ans, [mixed(n + d, d), mixed(Math.max(1, n - d), d), op === '×' ? `${A.w * B.w} ${A.r * B.r}/${ad * bd}` : mixed(an + bn, ad + bd)].filter(w => w !== ans), k => mixed(n + k, d)),
      ar: `أوجد ناتج ${sh(A)} ${op} ${sh(B)} وأجب بعدد كسري في أبسط صورة.`,
      en: `Find ${sh(A)} ${op} ${sh(B)} and give the answer as a mixed number in simplest form.`,
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

const ratioSimplest: Topic = {
  id: 'ratio', match: /^النسبه$/, grades: [6, 7],
  make({ rng, diff }) {
    const g = int(rng, 2, diff === 'easy' ? 4 : 9);
    let a = int(rng, 1, 9), b = int(rng, 1, 9);
    while (a === b || gcd(a, b) !== 1) { a = int(rng, 1, 9); b = int(rng, 1, 9); }
    const x = a * g, y = b * g;
    const ans = `${a} : ${b}`;
    return {
      eq: `${x} : ${y}`, answer: ans,
      wrongs: wrongsFrom(ans, [`${b} : ${a}`, `${x} : ${y}`, `${a * 2} : ${b * 2}`, `${a + 1} : ${b}`]),
      ar: `اكتب النسبة ${x} : ${y} في أبسط صورة.`, en: `Write the ratio ${x} : ${y} in simplest form.`,
    };
  },
};

const ratioEquiv: Topic = {
  id: 'ratio_equiv', match: /النسب المتكافئه/, grades: [6, 7],
  make({ rng, diff }) {
    let a = int(rng, 1, 9), b = int(rng, 2, 9);
    while (a === b) b = int(rng, 2, 9);
    const k = int(rng, 2, diff === 'easy' ? 5 : 12);
    const ans = b * k;
    return {
      eq: `${a} : ${b} = ${a * k} : ?`, answer: String(ans),
      wrongs: numWrongs(ans, [b + k, b + a * k - a, ans + b, a * k * b]),
      ar: `أكمل لتحصل على نسبتين متكافئتين: ${a} : ${b} = ${a * k} : ؟`, en: `Complete the equivalent ratios: ${a} : ${b} = ${a * k} : ?`,
    };
  },
};

// ─── rational numbers and exponent laws (Grade 7) ───────────────────────────

const ratCompare: Topic = {
  id: 'rat_compare', match: /مقارنه الاعداد النسبيه/, grades: [7, 7],
  make({ rng }) {
    const [d1, d2] = [pick(rng, [2, 3, 4, 5, 6, 8]), pick(rng, [2, 3, 4, 5, 6, 8])];
    const n1 = numerator(rng, d1, d1 * 2), n2 = numerator(rng, d2, d2 * 2);
    if (n1 * d2 === n2 * d1) return ratCompare.make({ rng, diff: 'easy', grade: 7 });
    const ans = n1 * d2 < n2 * d1 ? '<' : '>';
    const f = (n: number, d: number) => `${signed(n)}/${d}`;
    return {
      eq: `${f(n1, d1)} ___ ${f(n2, d2)}`, answer: ans, wrongs: ['>', '<', '='].filter(s => s !== ans),
      ar: `ضع الإشارة المناسبة (> أو < أو =):\n${f(n1, d1)} ___ ${f(n2, d2)}`, en: `Write the correct sign (>, < or =):\n${f(n1, d1)} ___ ${f(n2, d2)}`,
    };
  },
};

const ratOp = (id: string, match: RegExp, ops: Array<'+' | '−' | '×' | '÷'>): Topic => ({
  id, match, grades: [7, 7],
  make({ rng, diff }) {
    const op = pick(rng, ops);
    const dens = diff === 'easy' ? [2, 3, 4, 5] : [2, 3, 4, 5, 6, 8];
    const [d1, d2] = [pick(rng, dens), pick(rng, dens)];
    const n1 = numerator(rng, d1, d1 + 2), n2 = numerator(rng, d2, d2 + 2);
    const [n, d] = op === '+' ? [n1 * d2 + n2 * d1, d1 * d2] : op === '−' ? [n1 * d2 - n2 * d1, d1 * d2] : op === '×' ? [n1 * n2, d1 * d2] : [n1 * d2, d1 * n2];
    const ans = sfrac(n, d);
    const f = (x: number, y: number) => `${x < 0 ? '(' : ''}${signed(x)}/${y}${x < 0 ? ')' : ''}`;
    const swapped = op === '+' ? sfrac(n1 * d2 - n2 * d1, d1 * d2) : op === '−' ? sfrac(n1 * d2 + n2 * d1, d1 * d2) : op === '×' ? sfrac(n1 * d2, n2 * d1) : sfrac(n1 * n2, d1 * d2);
    const wrongs = wrongsFrom(ans, [swapped, sfrac(-n, d), op === '+' || op === '−' ? sfrac(n1 + n2, d1 + d2) : sfrac(n1 * n2, d1 + d2), sfrac(n + d, d)].filter(w => w !== ans), k => sfrac(n + k, d));
    return {
      eq: `${f(n1, d1)} ${op} ${f(n2, d2)}`, answer: ans, wrongs,
      ar: `أوجد ناتج ${f(n1, d1)} ${op} ${f(n2, d2)} في أبسط صورة.`, en: `Find ${f(n1, d1)} ${op} ${f(n2, d2)} in simplest form.`,
    };
  },
});

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
      return {
        eq: `${n}/${d}`, answer: period,
        wrongs: wrongsFrom(period, [period.split('').reverse().join(''), digs.slice(0, period.length + 1).join(''), period.slice(0, -1) || '1', `${period}${period[0]}`], k => String(Number(period) + Math.abs(k)).padStart(period.length, '0')),
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
    const kinds = diff === 'easy' ? [0, 1] : diff === 'medium' ? [0, 1, 2, 3] : [0, 1, 2, 3, 4, 5];
    const k = pick(rng, kinds);
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
];

/** The generator for a lesson title and grade, or null when none is about it. */
export function topicFor(title: string, grade: number): Topic | null {
  const t = fold(title).replace(/[:،,]/g, ' ').replace(/\s+/g, ' ').trim();
  return TOPICS.find(x => grade >= x.grades[0] && grade <= x.grades[1] && x.match.test(t)) ?? null;
}

/** A fresh item for a lesson `topicFor` matched; a draw that repeats a stem this pass is retried. */
export function makeTopicItem(topic: Topic, grade: number, diff: DiffTier, used: Set<string>, rng: Rng = Math.random): ConcreteItem {
  let d: Draft | null = null;
  for (let attempt = 0; attempt < 25; attempt++) {
    d = topic.make({ rng, diff, grade });
    if (!used.has(`stem:${d.ar}`)) break;
  }
  used.add(`stem:${d!.ar}`);
  const wrongs = d!.wrongs.filter(w => w !== d!.answer).slice(0, 3);
  return {
    id: `topic-${topic.id}-${grade}-${used.size}-${int(rng, 0, 9)}`,
    family: 'topic', diff, eq: d!.eq, answer: d!.answer, wrongs,
    promptAr: d!.ar, promptEn: d!.en,
  };
}
