/**
 * Grades 1–4 number sense, early arithmetic, shapes, measurement and
 * patterns: the lessons the operation drills in `elementary.ts` do not reach.
 * Same contract as the other topic modules: the lesson title picks the
 * generator, every answer is computed from the numbers in the stem.
 *
 * Nothing here needs a picture. A lesson about a figure or a chart is asked
 * through its numbers or its name («كم ضلعًا للمثلث؟»), and every fact a
 * question relies on that is not obvious from the grade (how many qirsh in a
 * dinar) is stated in the question.
 */
import { gcd, int, numWrongs, pick, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';
import { fmtDec } from './elementary.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const ints = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(Number.isInteger));
const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
/** Name options: three other names from the same list, in a stable order. */
const others = (rng: Rng, ans: string, all: readonly string[]) => shuffle(rng, all.filter(x => x !== ans)).slice(0, 3);
/** «دينار واحد / ديناران / 5 دنانير / 12 دينارًا» */
const counted = (n: number, one: string, two: string, few: string, many: string) => (n === 1 ? one : n === 2 ? two : n <= 10 ? `${n} ${few}` : `${n} ${many}`);
const dinars = (n: number) => counted(n, 'دينار واحد', 'ديناران', 'دنانير', 'دينارًا');

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

// ─── counting and place value ───────────────────────────────────────────────

const countingRange = (id: string, match: RegExp, lo: number, hi: number) => T(id, match, [1, 1], ({ rng }) => {
  const kinds = hi - lo >= 2 ? [0, 1, 2] : [0, 1];
  const k = pick(rng, kinds);
  if (k === 0) { const x = int(rng, lo, hi - 1); return { eq: `${x}`, answer: String(x + 1), wrongs: ints(x + 1, [x, x + 2, x - 1, x + 3]), ar: `ما العدد الذي يأتي بعد ${x}؟`, en: `Which number comes after ${x}?` }; }
  if (k === 1) { const x = int(rng, lo + 1, hi); return { eq: `${x}`, answer: String(x - 1), wrongs: ints(x - 1, [x, x - 2, x + 1, x - 3]), ar: `ما العدد الذي يأتي قبل ${x}؟`, en: `Which number comes before ${x}?` }; }
  const x = int(rng, lo, hi - 2);
  return { eq: `${x}, ${x + 2}`, answer: String(x + 1), wrongs: ints(x + 1, [x, x + 2, x + 3, x - 1]), ar: `ما العدد الذي يقع بين ${x} و ${x + 2}؟`, en: `Which number lies between ${x} and ${x + 2}?` };
});

const zero = T('count_zero', /^العدد صفر$/, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  const n = int(rng, 2, 9);
  if (k === 0) return { eq: `${n} − ${n}`, answer: '0', wrongs: ints(0, [n, 1, 2 * n, n - 1]), ar: `ما ناتج ${n} − ${n}؟`, en: `What is ${n} − ${n}?` };
  if (k === 1) return { eq: `${n} + 0`, answer: String(n), wrongs: ints(n, [0, n + 1, n - 1, 2 * n]), ar: `ما ناتج ${n} + 0؟`, en: `What is ${n} + 0?` };
  if (k === 2) return { eq: `${n} − 0`, answer: String(n), wrongs: ints(n, [0, n + 1, n - 1, 2 * n]), ar: `ما ناتج ${n} − 0؟`, en: `What is ${n} − 0?` };
  return { eq: '', answer: '0', wrongs: ['1', '10', '2'], ar: 'ما العدد الذي يدل على عدم وجود أي شيء؟', en: 'Which number tells that there is nothing at all?' };
});

const ordinal = T('ordinal', /^العد الترتيبي$/, [1, 1], ({ rng }) => {
  const k = int(rng, 1, 9), kind = pick(rng, [0, 1, 2]);
  if (kind === 0) return { eq: `${k + 1}`, answer: String(k), wrongs: ints(k, [k + 1, k - 1, k + 2, 10 - k]), ar: `يقف خالد في الصف في المكان ${ORD[k]}. كم طفلًا يقف أمامه؟`, en: `Khaled stands in place number ${k + 1} in a line. How many children stand in front of him?` };
  if (kind === 1) return { eq: ORD[k - 1]!, answer: String(k), wrongs: ints(k, [k + 1, k - 1, k + 2, 10 - k]), ar: `أي رقم يدل على الترتيب «${ORD[k - 1]}»؟`, en: `Which number stands for the ordinal «${ORD[k - 1]}»?` };
  return { eq: ORD[k - 1]!, answer: ORD[k]!, wrongs: others(rng, ORD[k]!, ORD), ar: `ما الترتيب الذي يأتي بعد «${ORD[k - 1]}»؟`, en: `Which ordinal comes after «${ORD[k - 1]}»?` };
});

const tensOnes = (id: string, match: RegExp) => T(id, match, [1, 1], ({ rng }) => {
  const t = int(rng, 1, 9), o = int(rng, 1, 9), n = t * 10 + o, k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${n}`, answer: String(t), wrongs: ints(t, [o, n, t + 1, t - 1]), ar: `كم عشرة في العدد ${n}؟`, en: `How many tens are in ${n}?` };
  if (k === 1) return { eq: `${n}`, answer: String(o), wrongs: ints(o, [t, n, o + 1, o - 1]), ar: `كم آحادًا في العدد ${n}؟`, en: `How many ones are in ${n}?` };
  if (k === 2) return { eq: `${t}, ${o}`, answer: String(n), wrongs: ints(n, [o * 10 + t, t + o, n + 10, n - 1]), ar: `${t} عشرات و ${o} آحاد: ما العدد؟`, en: `${t} tens and ${o} ones: what is the number?` };
  return { eq: `${t}`, answer: String(t * 10), wrongs: ints(t * 10, [t, t * 100, t * 10 + 1, (t + 1) * 10]), ar: `ما العدد الذي يتكون من ${t} عشرات؟`, en: `Which number is made of ${t} tens?` };
});

const hundreds = (id: string, match: RegExp) => T(id, match, [2, 2], ({ rng }) => {
  const h = int(rng, 1, 9), t = int(rng, 1, 9), o = int(rng, 1, 9), n = h * 100 + t * 10 + o, k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${n}`, answer: String(h), wrongs: ints(h, [t, o, h + 1, h - 1]), ar: `كم مئة في العدد ${n}؟`, en: `How many hundreds are in ${n}?` };
  if (k === 1) return { eq: `${h}, ${t}, ${o}`, answer: String(n), wrongs: ints(n, [o * 100 + t * 10 + h, h + t + o, n + 100, n - 10]), ar: `${h} مئات و ${t} عشرات و ${o} آحاد: ما العدد؟`, en: `${h} hundreds, ${t} tens and ${o} ones: what is the number?` };
  if (k === 2) return { eq: `${n}`, answer: String(t), wrongs: ints(t, [h, o, t * 10, t + 1]), ar: `ما رقم العشرات في العدد ${n}؟`, en: `What is the tens digit of ${n}?` };
  return { eq: `${h * 100}`, answer: String(h), wrongs: ints(h, [h * 10, h + 1, h - 1, h * 100]), ar: `كم مئة في ${h * 100}؟`, en: `How many hundreds are in ${h * 100}?` };
});

const readWrite = T('expanded_form', /^قراءه الاعداد وكتابتها$/, [1, 2], ({ rng, grade }) => {
  if (grade === 1) { const t = int(rng, 1, 9), o = int(rng, 1, 9), n = t * 10 + o; return { eq: `${t * 10} + ${o}`, answer: String(n), wrongs: ints(n, [t + o, o * 10 + t, n + 10, n - 1]), ar: `ما العدد ${t * 10} + ${o}؟`, en: `What number is ${t * 10} + ${o}?` }; }
  const h = int(rng, 1, 9), t = int(rng, 1, 9), o = int(rng, 1, 9), n = h * 100 + t * 10 + o;
  return { eq: `${h * 100} + ${t * 10} + ${o}`, answer: String(n), wrongs: ints(n, [h + t + o, o * 100 + t * 10 + h, n + 10, n - 1]), ar: `ما العدد ${h * 100} + ${t * 10} + ${o}؟`, en: `What number is ${h * 100} + ${t * 10} + ${o}?` };
});

const thousands = T('thousands', /^الالوف$/, [3, 3], ({ rng }) => {
  const a = int(rng, 1, 9), b = int(rng, 1, 9), c = int(rng, 1, 9), d = int(rng, 1, 9), n = a * 1000 + b * 100 + c * 10 + d, k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${n}`, answer: String(a), wrongs: ints(a, [b, c, d, a + 1]), ar: `ما رقم الألوف في العدد ${n}؟`, en: `What is the thousands digit of ${n}?` };
  if (k === 1) return { eq: `${a}, ${b}, ${c}, ${d}`, answer: String(n), wrongs: ints(n, [a + b + c + d, d * 1000 + c * 100 + b * 10 + a, n + 1000, n - 100]), ar: `${a} آلاف و ${b} مئات و ${c} عشرات و ${d} آحاد: ما العدد؟`, en: `${a} thousands, ${b} hundreds, ${c} tens and ${d} ones: what is the number?` };
  const place = pick(rng, [[a, 1000, 'الألوف'], [b, 100, 'المئات'], [c, 10, 'العشرات']] as Array<[number, number, string]>);
  return { eq: `${n}`, answer: String(place[0] * place[1]), wrongs: ints(place[0] * place[1], [place[0], place[0] * place[1] * 10, place[0] * place[1] / 10, place[0] + place[1]]), ar: `ما قيمة الرقم ${place[0]} (في منزلة ${place[2]}) في العدد ${n}؟`, en: `What is the value of the digit ${place[0]} (in the ${place[1] === 1000 ? 'thousands' : place[1] === 100 ? 'hundreds' : 'tens'} place) in ${n}?` };
});

const evenOdd = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const hi = grade === 1 ? 20 : span(diff, 99, 500, 999);
  const even = rng() < 0.5;
  const pickOf = (e: boolean) => { let v = int(rng, 1, hi); if ((v % 2 === 0) !== e) v += v < hi ? 1 : -1; return v; };
  const xs = new Set<number>([pickOf(even)]);
  while (xs.size < 4) xs.add(pickOf(!even));
  const list = shuffle(rng, [...xs]);
  const ans = list.find(v => (v % 2 === 0) === even)!;
  return { eq: list.join(', '), answer: String(ans), wrongs: list.filter(v => v !== ans).map(String), ar: `أي الأعداد الآتية ${even ? 'زوجي' : 'فردي'}: ${list.join('، ')}؟`, en: `Which of these numbers is ${even ? 'even' : 'odd'}: ${list.join(', ')}?` };
});

const numberChart = T('number_chart', /^لوحه الاعداد$/, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const n = int(rng, 1, 90); return { eq: `${n}`, answer: String(n + 10), wrongs: ints(n + 10, [n + 1, n - 10, n + 9, n + 11]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع تحت العدد ${n} مباشرة؟`, en: `On a number chart with 10 numbers in each row, which number is directly below ${n}?` }; }
  if (k === 1) { const n = int(rng, 11, 100); return { eq: `${n}`, answer: String(n - 10), wrongs: ints(n - 10, [n - 1, n + 10, n - 9, n - 11]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع فوق العدد ${n} مباشرة؟`, en: `On a number chart with 10 numbers in each row, which number is directly above ${n}?` }; }
  if (k === 2) { let n = int(rng, 1, 99); if (n % 10 === 0) n -= 1; return { eq: `${n}`, answer: String(n + 1), wrongs: ints(n + 1, [n - 1, n + 10, n + 2, n - 10]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع على يمين العدد ${n} مباشرة في الصف نفسه؟`, en: `On a number chart with 10 numbers in each row, which number is directly to the right of ${n} in the same row?` }; }
  let n = int(rng, 2, 100); if (n % 10 === 1) n += 1;
  return { eq: `${n}`, answer: String(n - 1), wrongs: ints(n - 1, [n + 1, n - 10, n - 2, n + 10]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع على يسار العدد ${n} مباشرة في الصف نفسه؟`, en: `On a number chart with 10 numbers in each row, which number is directly to the left of ${n} in the same row?` };
});

const countUpDown = T('count_up_down', /^العد تصاعديا وتنازليا$/, [1, 1], ({ rng }) => {
  const up = rng() < 0.5, a = up ? int(rng, 1, 15) : int(rng, 8, 20);
  const seq = [0, 1, 2].map(i => (up ? a + i : a - i)), next = up ? a + 3 : a - 3;
  return { eq: seq.join(', '), answer: String(next), wrongs: ints(next, [next + 1, next - 1, up ? a : a + 1, next + 2]), ar: `أكمل العدّ ${up ? 'تصاعديًا' : 'تنازليًا'}: ${seq.join('، ')}، ___`, en: `Complete the count going ${up ? 'up' : 'down'}: ${seq.join(', ')}, ___` };
});

const skipCount = (id: string, match: RegExp, grades: [number, number], steps: (g: number) => number[], top: (g: number) => number) => T(id, match, grades, ({ rng, grade, diff }) => {
  const s = pick(rng, steps(grade)), start = s * int(rng, 0, Math.floor(top(grade) / s / 3));
  const seq = [0, 1, 2, 3, 4].map(i => start + i * s);
  const hole = int(rng, 3, 4);
  const shown = seq.map((v, i) => (i === hole ? '___' : String(v)));
  const ans = seq[hole]!;
  void diff;
  return { eq: seq.join(', '), answer: String(ans), wrongs: ints(ans, [ans + s, ans - s, ans + 1, ans + 2 * s]), ar: `أكمل العدّ بالقفز: ${shown.join('، ')}`, en: `Complete the skip count: ${shown.join(', ')}` };
});

const beforeAfter = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const hi = grade === 1 ? 99 : 999, n = int(rng, 11, hi - 1), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${n}`, answer: String(n - 1), wrongs: ints(n - 1, [n + 1, n - 2, n + 10, n - 10]), ar: `ما العدد السابق للعدد ${n}؟`, en: `What is the number before ${n}?` };
  if (k === 1) return { eq: `${n}`, answer: String(n + 1), wrongs: ints(n + 1, [n - 1, n + 2, n + 10, n - 10]), ar: `ما العدد التالي للعدد ${n}؟`, en: `What is the number after ${n}?` };
  return { eq: `${n - 1}, ${n + 1}`, answer: String(n), wrongs: ints(n, [n - 1, n + 1, n + 2, n - 2]), ar: `ما العدد الذي يقع بين ${n - 1} و ${n + 1}؟`, en: `Which number lies between ${n - 1} and ${n + 1}?` };
});

const nearestTen = T('nearest_ten_g1', /^التقدير$/, [1, 1], ({ rng }) => {
  for (;;) {
    const n = int(rng, 11, 49);
    if (n % 10 === 5) continue;
    const near = Math.round(n / 10) * 10;
    return { eq: `${n}`, answer: String(near), wrongs: ints(near, [near + 10, near - 10, near + 20, near - 20]), ar: `أي عدد من مضاعفات العشرة الآتية أقرب إلى العدد ${n}؟ (10، 20، 30، 40، 50)`, en: `Which of these tens is closest to ${n}? (10, 20, 30, 40, 50)` };
  }
});

const numberLineAdd = (id: string, match: RegExp, add: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const a = add ? int(rng, 1, 12) : int(rng, 6, 19), b = add ? int(rng, 1, 20 - a > 0 ? Math.min(8, 20 - a) : 1) : int(rng, 1, Math.min(8, a - 1));
  const r = add ? a + b : a - b;
  return { eq: `${a}, ${b}`, answer: String(r), wrongs: ints(r, [add ? a - b : a + b, r + 1, r - 1, a]), ar: `ابدأ من العدد ${a} على خط الأعداد، ثم اقفز ${b} قفزات إلى ${add ? 'اليمين' : 'اليسار'} (قفزة واحدة لكل وحدة). عند أي عدد تصل؟`, en: `Start at ${a} on the number line and take ${b} jumps to the ${add ? 'right' : 'left'} (one unit per jump). Which number do you reach?` };
});

const doubles = (id: string, match: RegExp, plusOne: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const n = int(rng, 1, 9), r = plusOne ? 2 * n + 1 : 2 * n;
  return { eq: `${n}`, answer: String(r), wrongs: ints(r, [n, n + 1, r + 1, r - 1, n * n]), ar: plusOne ? `ما ضعف العدد ${n} مضافًا إليه 1؟` : `ما ضعف العدد ${n}؟`, en: plusOne ? `What is double ${n}, plus 1?` : `What is double ${n}?` };
});
const doubling = T('doubling_g3', /^المضاعفه$/, [3, 3], ({ rng, diff }) => {
  const n = int(rng, 11, span(diff, 49, 99, 499)), k = pick(rng, [0, 1, 2]);
  if (k === 2) return { eq: `${n}`, answer: String(4 * n), wrongs: ints(4 * n, [2 * n, 3 * n, 4 * n + 10, 8 * n]), ar: `ما ضعف ضعف العدد ${n}؟`, en: `What is double double ${n}?` };
  if (k === 1) return { eq: `${2 * n}`, answer: String(n), wrongs: ints(n, [2 * n, n + 1, n - 1, 4 * n]), ar: `ما العدد الذي ضعفه ${2 * n}؟`, en: `Which number has ${2 * n} as its double?` };
  return { eq: `${n}`, answer: String(2 * n), wrongs: ints(2 * n, [n + 2, 2 * n + 10, n * n, 2 * n - 1]), ar: `ما ضعف العدد ${n}؟`, en: `What is double ${n}?` };
});

const makeTen = T('make_ten', /^مكونات العدد 10$/, [1, 1], ({ rng }) => {
  const a = int(rng, 1, 9), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${a}`, answer: String(10 - a), wrongs: ints(10 - a, [a, 10 + a, 10 - a + 1, 10 - a - 1]), ar: `${a} + ___ = 10`, en: `${a} + ___ = 10` };
  if (k === 1) return { eq: `${a}`, answer: String(10 - a), wrongs: ints(10 - a, [a, a + 1, 10, 9 - a]), ar: `10 = ${a} + ___`, en: `10 = ${a} + ___` };
  const good = `${a} + ${10 - a}`;
  const bad = shuffle(rng, [`${a} + ${9 - a > 0 ? 9 - a : 8}`, `${a} + ${11 - a}`, `${a + 1} + ${10 - a}`, `${a} + ${a}`]).filter(p => { const [x, y] = p.split(' + ').map(Number); return x! + y! !== 10; });
  return { eq: good, answer: good, wrongs: [...new Set(bad)].slice(0, 3), ar: `أي جمع مما يأتي ناتجه 10؟`, en: 'Which of these sums makes 10?' };
});

const addProps = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const hi = grade === 1 ? 9 : 99, a = int(rng, 2, hi), b = int(rng, 2, hi), c = int(rng, 2, hi), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${a} + ${b}`, answer: String(a), wrongs: ints(a, [b, a + b, a + 1, a - 1]), ar: `أكمل: ${b} + ${a} = ___ + ${b}`, en: `Complete: ${b} + ${a} = ___ + ${b}` };
  if (k === 1) return { eq: `${a} + 0`, answer: String(a), wrongs: ints(a, [0, a + 1, a - 1, 2 * a]), ar: `ما ناتج ${a} + 0؟`, en: `What is ${a} + 0?` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, a + b, c + 1]), ar: `أكمل: (${a} + ${b}) + ${c} = ${a} + (${b} + ___)`, en: `Complete: (${a} + ${b}) + ${c} = ${a} + (${b} + ___)` };
});

const relatedFacts = (id: string, grade: number) => T(id, /^الحقائق المترابطه$/, [grade, grade], ({ rng }) => {
  if (grade === 1) { const a = int(rng, 2, 9), b = int(rng, 2, 9), s = a + b, k = pick(rng, [0, 1]); return k === 0 ? { eq: `${a}, ${b}, ${s}`, answer: String(b), wrongs: ints(b, [a, s, b + 1, b - 1]), ar: `إذا كان ${a} + ${b} = ${s} فإن ${s} − ${a} = ___`, en: `If ${a} + ${b} = ${s} then ${s} − ${a} = ___` } : { eq: `${s}, ${a}, ${b}`, answer: String(s), wrongs: ints(s, [a, b, s + 1, s - 1]), ar: `إذا كان ${s} − ${a} = ${b} فإن ${b} + ${a} = ___`, en: `If ${s} − ${a} = ${b} then ${b} + ${a} = ___` }; }
  const a = int(rng, 2, 9), b = int(rng, 2, 9), p = a * b, k = pick(rng, [0, 1]);
  return k === 0 ? { eq: `${a}, ${b}, ${p}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `إذا كان ${a} × ${b} = ${p} فإن ${p} ÷ ${a} = ___`, en: `If ${a} × ${b} = ${p} then ${p} ÷ ${a} = ___` } : { eq: `${p}, ${a}, ${b}`, answer: String(p), wrongs: ints(p, [a + b, a, b, p + a]), ar: `إذا كان ${p} ÷ ${a} = ${b} فإن ${b} × ${a} = ___`, en: `If ${p} ÷ ${a} = ${b} then ${b} × ${a} = ___` };
});

const missingNumber = T('missing_number', /^العدد المفقود$/, [1, 1], ({ rng, diff }) => {
  const a = int(rng, 1, span(diff, 9, 12, 15)), b = int(rng, 1, span(diff, 9, 12, 15)), s = a + b, k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${a}, ${s}`, answer: String(b), wrongs: ints(b, [a, s, b + 1, b - 1]), ar: `${a} + ___ = ${s}`, en: `${a} + ___ = ${s}` };
  if (k === 1) return { eq: `${b}, ${s}`, answer: String(a), wrongs: ints(a, [b, s, a + 1, a - 1]), ar: `___ + ${b} = ${s}`, en: `___ + ${b} = ${s}` };
  if (k === 2) return { eq: `${s}, ${b}`, answer: String(a), wrongs: ints(a, [b, s, a + 1, a - 1]), ar: `${s} − ___ = ${b}`, en: `${s} − ___ = ${b}` };
  return { eq: `${a}, ${b}`, answer: String(s), wrongs: ints(s, [a, b, s + 1, s - 1]), ar: `___ − ${b} = ${a}`, en: `___ − ${b} = ${a}` };
});

const mentalG1 = (id: string, match: RegExp, add: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  const n = add ? int(rng, 1, 79) : int(rng, 21, 99);
  const d = k === 2 ? 20 : 10;
  const r = add ? n + (k === 2 ? 20 : 10) : n - (k === 2 ? 20 : 10);
  if (k === 0 || k === 2) return { eq: `${n}, ${d}`, answer: String(r), wrongs: ints(r, [add ? r + 10 : r - 10, add ? n + 1 : n - 1, r + 1, r - 1]), ar: `${n} ${add ? '+' : '−'} ${d} = ___`, en: `${n} ${add ? '+' : '−'} ${d} = ___` };
  const m = add ? int(rng, 1, 70) : int(rng, 21, 99), r9 = add ? m + 9 : m - 9;
  return { eq: `${m}, 9`, answer: String(r9), wrongs: ints(r9, [add ? m + 10 : m - 10, add ? m + 8 : m - 8, r9 + 2, r9 - 2]), ar: `${m} ${add ? '+' : '−'} 9 = ___ (فكّر: ${add ? 'أضف 10 ثم انقص 1' : 'انقص 10 ثم أضف 1'})`, en: `${m} ${add ? '+' : '−'} 9 = ___ (think: ${add ? 'add 10 then take away 1' : 'take away 10 then add 1'})` };
});

// ─── shapes ─────────────────────────────────────────────────────────────────

const SOLIDS: Array<[string, string]> = [['كرة القدم', 'كرة'], ['حجر النرد', 'مكعب'], ['علبة المعلبات', 'أسطوانة'], ['قبعة الحفلات المدببة', 'مخروط'], ['علبة الأحذية', 'متوازي مستطيلات']];
const solidNames = SOLIDS.map(s => s[1]);
const solids = T('solid_names', /^المجسمات$/, [1, 2], ({ rng }) => {
  const [obj, name] = pick(rng, SOLIDS);
  return { eq: obj, answer: name, wrongs: others(rng, name, solidNames), ar: `أي مجسم يشبه ${obj}؟`, en: `Which solid does this look like: ${obj} (Arabic)?` };
});

const PLANE: Array<[string, number]> = [['المثلث', 3], ['المربع', 4], ['المستطيل', 4], ['الخماسي المنتظم', 5], ['السداسي المنتظم', 6]];
const planeShapes = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  const [name, n] = pick(rng, PLANE);
  if (k === 0) return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n - 1, n + 2, 2 * n]), ar: `كم ضلعًا لـ ${name}؟`, en: `How many sides does the ${name} have?` };
  if (k === 1) return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n - 1, n + 2, 2 * n]), ar: `كم رأسًا لـ ${name}؟`, en: `How many vertices does the ${name} have?` };
  const uniq = PLANE.filter(([, c]) => c !== 4);
  const [nm, c] = pick(rng, uniq);
  return { eq: `${c}`, answer: nm, wrongs: others(rng, nm, [...uniq.map(u => u[0]), 'المربع']), ar: `أي شكل له ${c} أضلاع و ${c} رؤوس؟`, en: `Which shape has ${c} sides and ${c} vertices?` };
});

const SOLID_FEV: Array<[string, number, number, number]> = [['المكعب', 6, 12, 8], ['متوازي المستطيلات', 6, 12, 8], ['المنشور الثلاثي', 5, 9, 6], ['الهرم الرباعي', 5, 8, 5], ['الهرم الثلاثي', 4, 6, 4]];
const solidParts = T('solid_parts', /^الاحرف والاوجه والرؤوس$/, [2, 2], ({ rng }) => {
  const [name, f, e, v] = pick(rng, SOLID_FEV), k = pick(rng, [0, 1, 2]);
  const [val, ar, en] = k === 0 ? [f, 'وجهًا', 'faces'] : k === 1 ? [e, 'حرفًا', 'edges'] : [v, 'رأسًا', 'vertices'];
  return { eq: name, answer: String(val), wrongs: ints(val, [val + 1, val - 1, val + 2, val * 2, f + e + v]), ar: `كم ${ar} لـ ${name}؟`, en: `How many ${en} does the ${name} have?` };
});

const SHAPES3 = ['◯', '△', '□', '◇'];
const SHAPES_AR: Record<string, string> = { '◯': 'دائرة', '△': 'مثلث', '□': 'مربع', '◇': 'معين' };
const geoPattern = T('geo_pattern', /^الانماط الهندسيه$/, [1, 4], ({ rng, grade, diff }) => {
  if (grade <= 2) {
    const len = pick(rng, [2, 3]), unit = shuffle(rng, SHAPES3).slice(0, len);
    const shown = Array.from({ length: len * 2 + 1 }, (_, i) => unit[i % len]!);
    const next = unit[(len * 2 + 1) % len]!;
    return { eq: shown.join(' '), answer: SHAPES_AR[next]!, wrongs: SHAPES3.filter(s => s !== next).map(s => SHAPES_AR[s]!), ar: `ما الشكل التالي في النمط: ${shown.join(' ')} ___ ؟ (اكتب اسمه)`, en: `What shape comes next in the pattern ${shown.join(' ')} ___ ? (name it: دائرة = circle, مثلث = triangle, مربع = square, معين = diamond)` };
  }
  const first = int(rng, 2, 5), d = int(rng, 2, span(diff, 3, 4, 6)), n = int(rng, 5, 7);
  const t = [1, 2, 3].map(i => first + (i - 1) * d), ans = first + (n - 1) * d;
  return { eq: t.join(', '), answer: String(ans), wrongs: ints(ans, [ans + d, ans - d, first * n, ans + 1]), ar: `في نمط من الأعواد، الشكل 1 فيه ${t[0]} أعواد والشكل 2 فيه ${t[1]} والشكل 3 فيه ${t[2]}. كم عودًا في الشكل ${n}؟`, en: `In a matchstick pattern, figure 1 has ${t[0]} sticks, figure 2 has ${t[1]} and figure 3 has ${t[2]}. How many sticks are in figure ${n}?` };
});

// ─── fractions ──────────────────────────────────────────────────────────────

const halfQuarter = (id: string, match: RegExp, name: 'نصف' | 'ربع') => T(id, match, [1, 1], ({ rng }) => {
  const d = name === 'نصف' ? 2 : 4, q = int(rng, 1, name === 'نصف' ? 10 : 5), n = d * q;
  if (rng() < 0.7) return { eq: `${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q, 2 * q]), ar: `ما ${name} العدد ${n}؟`, en: `What is ${name === 'نصف' ? 'half' : 'a quarter'} of ${n}?` };
  return { eq: name, answer: String(d), wrongs: ints(d, [d + 1, d - 1, 2 * d, 3]), ar: `كم ${name === 'نصف' ? 'نصفًا' : 'ربعًا'} في الكل الواحد؟`, en: `How many ${name === 'نصف' ? 'halves' : 'quarters'} make one whole?` };
});
const PARTS: Array<[number, string]> = [[2, 'نصف'], [3, 'ثلث'], [4, 'ربع']];
const equalParts = T('equal_parts', /^الاجزاء المتطابقه$/, [1, 1], ({ rng }) => {
  const [d, name] = pick(rng, PARTS);
  return { eq: `${d}`, answer: name, wrongs: [...PARTS.map(p => p[1]).filter(x => x !== name), 'كل'], ar: `قُسّمت قطعة بيتزا إلى ${d} أجزاء متطابقة. ماذا يسمّى كل جزء منها؟`, en: `A pizza is cut into ${d} equal parts. What is each part called? (نصف = half, ثلث = third, ربع = quarter)` };
});
const fractionOfSetG1 = T('fraction_of_set_g1', /^الكسر كجزء من مجموعه$/, [1, 1], ({ rng }) => {
  const [d, name] = pick(rng, PARTS), q = int(rng, 1, d === 2 ? 8 : d === 3 ? 4 : 3), n = d * q;
  return { eq: `${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q]), ar: `في مجموعة ${n} كرات، كم كرة في ${name} المجموعة؟`, en: `A group has ${n} balls. How many balls are in ${name === 'نصف' ? 'half' : name === 'ثلث' ? 'a third' : 'a quarter'} of the group?` };
});
const fractionOfSetG3 = T('fraction_of_set_g3', /^الكسر كجزء من مجموعه$/, [3, 3], ({ rng, diff }) => {
  const d = pick(rng, [2, 3, 4, 5, 6, 8, 10]), q = int(rng, 1, span(diff, 4, 6, 9)), n = d * q, a = int(rng, 1, d - 1);
  if (rng() < 0.55) return { eq: `${a}/${d}, ${n}`, answer: String(a * q), wrongs: ints(a * q, [q, n - a * q, a + n / d, n - q]), ar: `ما ${a}/${d} من العدد ${n}؟`, en: `What is ${a}/${d} of ${n}?` };
  let k = a; while (gcd(k, d) !== 1) k = int(rng, 1, d - 1);
  return { eq: `${k}, ${d}`, answer: `${k}/${d}`, wrongs: wrongsFrom(`${k}/${d}`, [`${d - k}/${d}`, `${k}/${d - k}`, `${d}/${k}`, `${k + 1}/${d}`], j => `${k + Math.abs(j) + 1}/${d + 1}`), ar: `في صف ${d} طلاب، ${k} منهم يلبسون قبعة. ما الكسر الذي يمثل الطلاب الذين يلبسون قبعة؟`, en: `A row has ${d} students and ${k} of them wear a hat. What fraction of the students wear a hat?` };
});
const unitFraction = T('unit_fraction', /^كسر الوحده$/, [2, 2], ({ rng }) => {
  const d = int(rng, 2, 10), k = pick(rng, [0, 1]);
  if (k === 0) return { eq: `${d}`, answer: `1/${d}`, wrongs: wrongsFrom(`1/${d}`, [`${d}/1`, `1/${d + 1}`, `${d - 1}/${d}`, `2/${d}`], j => `1/${d + 1 + Math.abs(j)}`), ar: `ما كسر الوحدة الذي يمثل جزءًا واحدًا من ${d} أجزاء متساوية؟`, en: `Which unit fraction stands for one of ${d} equal parts?` };
  let e = int(rng, 2, 10); while (e === d) e = int(rng, 2, 10);
  const big = Math.min(d, e), small = Math.max(d, e);
  return { eq: `1/${d}, 1/${e}`, answer: `1/${big}`, wrongs: wrongsFrom(`1/${big}`, [`1/${small}`, `1/${small + 1}`, `1/${big + small}`], j => `1/${small + 1 + Math.abs(j)}`), ar: `أي الكسرين أكبر: 1/${d} أم 1/${e}؟ (اكتب الكسر الأكبر)`, en: `Which fraction is larger, 1/${d} or 1/${e}? (write the larger one)` };
});
const unitFractionOfSet = T('unit_fraction_set', /^كسر الوحده كجزء من مجموعه$/, [2, 2], ({ rng }) => {
  const d = pick(rng, [2, 3, 4, 5, 6, 10]), q = int(rng, 2, 9), n = d * q;
  return { eq: `1/${d}, ${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q, d]), ar: `ما 1/${d} من العدد ${n}؟`, en: `What is 1/${d} of ${n}?` };
});
const wholeFraction = T('fraction_of_whole', /^الكسر كجزء من كل$/, [3, 3], ({ rng }) => {
  const d = pick(rng, [3, 4, 5, 6, 8, 10]); let k = int(rng, 1, d - 1); while (gcd(k, d) !== 1) k = int(rng, 1, d - 1);
  return { eq: `${k}, ${d}`, answer: `${k}/${d}`, wrongs: wrongsFrom(`${k}/${d}`, [`${d - k}/${d}`, `${k}/${d - k}`, `${d}/${k}`, `${k}/${d + 1}`], j => `${k + Math.abs(j) + 1}/${d + 1}`), ar: `قُسّم شكل إلى ${d} أجزاء متساوية ولُوّن ${k} منها. ما الكسر الذي يمثل الجزء الملوّن؟`, en: `A shape is split into ${d} equal parts and ${k} are coloured. What fraction is coloured?` };
});
const fractionOne = T('fraction_equals_one', /^الكسور المساويه للواحد$/, [3, 3], ({ rng }) => {
  const n = int(rng, 3, 10), pool = [[n - 1, n], [n, n + 1], [1, n], [n + 1, n]].filter(([a, b]) => a !== b) as Array<[number, number]>;
  return { eq: `${n}/${n}`, answer: `${n}/${n}`, wrongs: pool.map(([a, b]) => `${a}/${b}`).slice(0, 3), ar: 'أي الكسور الآتية يساوي 1؟', en: 'Which of these fractions equals 1?' };
});
const fractionLine = T('fraction_number_line', /^الكسور علي خط الاعداد$/, [3, 3], ({ rng }) => {
  const d = pick(rng, [4, 5, 6, 8, 10]); let k = int(rng, 1, d - 1); while (gcd(k, d) !== 1) k = int(rng, 1, d - 1);
  return { eq: `${k}, ${d}`, answer: `${k}/${d}`, wrongs: wrongsFrom(`${k}/${d}`, [`${d - k}/${d}`, `${k}/${d - k}`, `${k + 1}/${d}`, `${d}/${k}`], j => `${k + Math.abs(j) + 1}/${d + 1}`), ar: `قُسّمت المسافة بين 0 و 1 على خط الأعداد إلى ${d} أجزاء متساوية. ما الكسر الذي يدل على النقطة الواقعة بعد ${k} من هذه الأجزاء بدءًا من الصفر؟`, en: `The distance from 0 to 1 on a number line is split into ${d} equal parts. Which fraction marks the point ${k} parts from zero?` };
});

// ─── Grade 2: numbers and mental arithmetic ─────────────────────────────────

const numberLineG2 = T('number_line_g2', /^تمثيل الاعداد علي خط الاعداد$/, [2, 2], ({ rng, diff }) => {
  if (rng() < 0.5) { const a = 10 * int(rng, 1, span(diff, 8, 20, 40)), gap = 20 * int(rng, 1, 4); return { eq: `${a}, ${a + gap}`, answer: String(a + gap / 2), wrongs: ints(a + gap / 2, [a + gap, a, a + gap / 2 + 10, a + gap / 2 - 10]), ar: `ما العدد الذي يقع في منتصف المسافة بين ${a} و ${a + gap} على خط الأعداد؟`, en: `Which number is exactly halfway between ${a} and ${a + gap} on a number line?` }; }
  const s = pick(rng, [5, 10]), a = s * int(rng, 1, 9), j = int(rng, 2, 6);
  return { eq: `${a}, ${s}, ${j}`, answer: String(a + s * j), wrongs: ints(a + s * j, [a + j, a + s, a + s * (j + 1), a + s * (j - 1)]), ar: `ابدأ من ${a} على خط الأعداد واقفز ${j} قفزات، طول كل قفزة ${s}. عند أي عدد تصل؟`, en: `Start at ${a} on a number line and take ${j} jumps of ${s}. Which number do you reach?` };
});

const mentalMultiples = (id: string, match: RegExp, add: boolean, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const place = pick(rng, grade === 2 ? [10, 100] : [10, 100, 1000]);
  let a = 0, b = 0;
  do { a = int(rng, 1, 9); b = int(rng, 1, 9); } while (!add && a <= b);
  const x = a * place, y = b * place, r = add ? x + y : x - y;
  return { eq: `${x}, ${y}`, answer: String(r), wrongs: ints(r, [r * 10, r / 10, add ? x - y : x + y, r + place]), ar: `${x} ${add ? '+' : '−'} ${y} = ___`, en: `${x} ${add ? '+' : '−'} ${y} = ___` };
});

const equalGroups = (id: string, match: RegExp) => T(id, match, [2, 2], ({ rng }) => {
  const g = int(rng, 2, 5), n = int(rng, 2, 6), t = g * n, k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${g}, ${n}`, answer: String(t), wrongs: ints(t, [g + n, t + g, t - n, g * g]), ar: `${g} مجموعات متساوية، في كل منها ${n} أقلام. كم قلمًا في المجموع؟`, en: `There are ${g} equal groups with ${n} pencils in each. How many pencils are there in all?` };
  if (k === 1) return { eq: `${t}, ${g}`, answer: String(n), wrongs: ints(n, [t, g, n + 1, t - g]), ar: `وُزّعت ${t} قطع بالتساوي على ${g} مجموعات. كم قطعة في كل مجموعة؟`, en: `${t} pieces are shared equally among ${g} groups. How many pieces are in each group?` };
  return { eq: `${t}, ${n}`, answer: String(g), wrongs: ints(g, [t, n, g + 1, t - n]), ar: `${t} قطع، وُضع في كل مجموعة ${n} قطع. كم مجموعة تكوّنت؟`, en: `${t} pieces are put into groups of ${n}. How many groups are made?` };
});

const divisionRelation = T('division_relation', /^العلاقه بين القسمه والضرب$|^علاقه القسمه بالضرب$/, [2, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), p = a * b;
  if (rng() < 0.5) return { eq: `${a}, ${b}, ${p}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `إذا كان ${a} × ${b} = ${p} فإن ${p} ÷ ${a} = ___`, en: `If ${a} × ${b} = ${p} then ${p} ÷ ${a} = ___` };
  return { eq: `${p}, ${a}, ${b}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `أكمل: ${p} ÷ ${a} = ___ لأن ___ × ${a} = ${p}`, en: `Complete: ${p} ÷ ${a} = ___ because ___ × ${a} = ${p}` };
});

// ─── Grade 3 multiplication and division ────────────────────────────────────

const mulProps = T('mul_properties', /^خواص الضرب$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), c = int(rng, 2, 9), k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${a} × ${b}`, answer: String(a), wrongs: ints(a, [b, a * b, a + 1, a - 1]), ar: `أكمل: ${b} × ${a} = ___ × ${b}`, en: `Complete: ${b} × ${a} = ___ × ${b}` };
  if (k === 1) return { eq: `${a} × 1`, answer: String(a), wrongs: ints(a, [1, 0, a + 1, 2 * a]), ar: `ما ناتج ${a} × 1؟`, en: `What is ${a} × 1?` };
  if (k === 2) return { eq: `${a} × 0`, answer: '0', wrongs: ints(0, [a, 1, 2 * a, a - 1]), ar: `ما ناتج ${a} × 0؟`, en: `What is ${a} × 0?` };
  if (k === 3) return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, c + 1, b + c]), ar: `أكمل: ${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ___`, en: `Complete: ${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ___` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, c + 1, a * b]), ar: `أكمل: (${a} × ${b}) × ${c} = ${a} × (${b} × ___)`, en: `Complete: (${a} × ${b}) × ${c} = ${a} × (${b} × ___)` };
});

const divProps = T('div_properties', /^خواص القسمه$/, [3, 3], ({ rng }) => {
  const n = int(rng, 2, 9), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${n * 3} ÷ 1`, answer: String(n * 3), wrongs: ints(n * 3, [1, 0, n, n * 3 + 1]), ar: `ما ناتج ${n * 3} ÷ 1؟`, en: `What is ${n * 3} ÷ 1?` };
  if (k === 1) return { eq: `${n} ÷ ${n}`, answer: '1', wrongs: ints(1, [0, n, 2, n - 1]), ar: `ما ناتج ${n} ÷ ${n}؟`, en: `What is ${n} ÷ ${n}?` };
  return { eq: `0 ÷ ${n}`, answer: '0', wrongs: ints(0, [1, n, 2 * n, n - 1]), ar: `ما ناتج 0 ÷ ${n}؟`, en: `What is 0 ÷ ${n}?` };
});

const remainder = T('remainder', /^الباقي$/, [3, 3], ({ rng, diff }) => {
  const d = int(rng, 2, span(diff, 5, 7, 9)), q = int(rng, 2, 9), r = int(rng, 1, d - 1), n = d * q + r;
  return rng() < 0.5
    ? { eq: `${n}, ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d, n % (d + 1)]), ar: `ما الباقي عند قسمة ${n} على ${d}؟`, en: `What is the remainder when ${n} is divided by ${d}?` }
    : { eq: `${n}, ${d}`, answer: String(q), wrongs: ints(q, [r, q + 1, q - 1, n - r]), ar: `ما خارج قسمة ${n} على ${d} (من دون الباقي)؟`, en: `What is the whole-number quotient of ${n} ÷ ${d} (ignoring the remainder)?` };
});
const divisionQ = (id: string, match: RegExp, twoDigit: boolean, withRemainder: boolean) => T(id, match, [3, 3], ({ rng }) => {
  const d = int(rng, 2, 9), q = twoDigit ? int(rng, 10, Math.min(99, Math.floor(999 / d))) : int(rng, 2, 9);
  const r = withRemainder ? int(rng, 1, d - 1) : 0, n = d * q + r;
  if (!withRemainder) return { eq: `${n} ÷ ${d}`, answer: String(q), wrongs: ints(q, [q + 1, q - 1, q + 10, n - d, q * 10]), ar: `ما ناتج ${n} ÷ ${d}؟`, en: `What is ${n} ÷ ${d}?` };
  return rng() < 0.5
    ? { eq: `${n} ÷ ${d}`, answer: String(q), wrongs: ints(q, [q + 1, q - 1, r, q + 10, n - d]), ar: `ما خارج قسمة ${n} على ${d}؟ (من دون الباقي)`, en: `What is the quotient of ${n} ÷ ${d}? (ignore the remainder)` }
    : { eq: `${n} ÷ ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d]), ar: `ما الباقي عند قسمة ${n} على ${d}؟`, en: `What is the remainder of ${n} ÷ ${d}?` };
});

const tensMulG3 = T('tens_mul_g3', /^الضرب في مضاعفات العدد 10$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), k = pick(rng, [0, 1]);
  return k === 0 ? { eq: `${a} × ${b * 10}`, answer: String(a * b * 10), wrongs: ints(a * b * 10, [a * b, a * b * 100, a + b * 10, a * b * 10 + 10]), ar: `ما ناتج ${a} × ${b * 10}؟`, en: `What is ${a} × ${b * 10}?` } : { eq: `${b * 10} × ${a}`, answer: String(a * b * 10), wrongs: ints(a * b * 10, [a * b, a * b * 100, a + b * 10, a * b * 10 - 10]), ar: `ما ناتج ${b * 10} × ${a}؟`, en: `What is ${b * 10} × ${a}?` };
});
const tensDivG3 = T('tens_div_g3', /^قسمه مضاعفات العدد 10$/, [3, 3], ({ rng }) => {
  const d = int(rng, 2, 9), q = int(rng, 2, 9), n = d * q * 10;
  return { eq: `${n} ÷ ${d}`, answer: String(q * 10), wrongs: ints(q * 10, [q, q * 100, n - d, q * 10 + 10]), ar: `ما ناتج ${n} ÷ ${d}؟`, en: `What is ${n} ÷ ${d}?` };
});
const distributive = T('mul_distribute', /^الضرب باستعمال خاصيه التوزيع$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), t = int(rng, 1, 5) * 10, o = int(rng, 2, 9), n = t + o;
  if (rng() < 0.5) return { eq: `${a} × ${n}`, answer: String(o), wrongs: ints(o, [t, n, o + 1, a]), ar: `أكمل: ${a} × ${n} = ${a} × ${t} + ${a} × ___`, en: `Complete: ${a} × ${n} = ${a} × ${t} + ${a} × ___` };
  return { eq: `${a} × ${n}`, answer: String(a * n), wrongs: ints(a * n, [a * t, a * t + o, a + n, a * n + a]), ar: `استعمل خاصية التوزيع لإيجاد ${a} × ${n} = ${a} × ${t} + ${a} × ${o}`, en: `Use the distributive property to find ${a} × ${n} = ${a} × ${t} + ${a} × ${o}` };
});
const mulNoRegroup = (id: string, match: RegExp, regroup: boolean) => T(id, match, [3, 3], ({ rng }) => {
  for (let i = 0; i < 400; i++) {
    const k = int(rng, 2, 6), t = int(rng, 1, 9), o = int(rng, 1, 9);
    const carry = o * k >= 10;
    if (carry !== regroup) continue;
    const n = t * 10 + o, r = n * k;
    if (!regroup && t * k >= 10) continue;
    return { eq: `${n} × ${k}`, answer: String(r), wrongs: ints(r, [r + 10, r - 10, t * k * 10 + o, r + k, n + k]), ar: `ما ناتج ${n} × ${k}؟`, en: `What is ${n} × ${k}?` };
  }
  return { eq: '12 × 3', answer: '36', wrongs: ['26', '46', '15'], ar: 'ما ناتج 12 × 3؟', en: 'What is 12 × 3?' };
});

const twoWay = T('two_way_table', /^الجدول ذو الاتجاهين$/, [3, 3], ({ rng }) => {
  const bt = int(rng, 2, 9), bj = int(rng, 2, 9), gt = int(rng, 2, 9), gj = int(rng, 2, 9);
  const head = `في صف: ${bt} أولاد يحبون الشاي و ${bj} أولاد يحبون العصير، و ${gt} بنات يحببن الشاي و ${gj} بنات يحببن العصير`;
  const headEn = `In a class: ${bt} boys like tea and ${bj} boys like juice; ${gt} girls like tea and ${gj} girls like juice`;
  const k = pick(rng, [0, 1, 2, 3]);
  const [v, ar, en] = k === 0 ? [bt + bj, 'كم ولدًا في الصف؟', 'How many boys are in the class?'] : k === 1 ? [gt + gj, 'كم بنتًا في الصف؟', 'How many girls are in the class?'] : k === 2 ? [bj + gj, 'كم طالبًا يحبون العصير؟', 'How many students like juice?'] : [bt + bj + gt + gj, 'كم طالبًا في الصف؟', 'How many students are in the class?'];
  return { eq: `${bt}, ${bj}, ${gt}, ${gj}`, answer: String(v), wrongs: ints(v, [v + 1, v - 1, bt + gt, bj + gt, v + 2]), ar: `${head}. ${ar}`, en: `${headEn}. ${en}` };
});

// ─── lines, angles ──────────────────────────────────────────────────────────

const LINE_PARTS: Array<[string, number]> = [['القطعة المستقيمة', 2], ['الشعاع', 1], ['المستقيم', 0]];
const pointLineRay = T('point_line_ray', /^النقطه والمستقيم والشعاع$/, [3, 3], ({ rng }) => {
  const [name, n] = pick(rng, LINE_PARTS);
  return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n + 2, 3, n === 0 ? 4 : n - 1]), ar: `كم نقطة نهاية لـ ${name}؟`, en: `How many endpoints does ${name === 'الشعاع' ? 'a ray' : name === 'المستقيم' ? 'a line' : 'a line segment'} have?` };
});

const ANGLE_NAMES = ['حادة', 'قائمة', 'منفرجة'];
const angleG3 = T('angle_kind_g3', /^الزوايا$/, [3, 3], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2]), a = kind === 0 ? int(rng, 10, 85) : kind === 1 ? 90 : int(rng, 95, 175);
  return { eq: `${a}°`, answer: ANGLE_NAMES[kind]!, wrongs: [...ANGLE_NAMES.filter((_, i) => i !== kind), 'مستقيمة'], ar: `زاوية قياسها ${a}°. ما نوعها؟`, en: `An angle measures ${a}°. What kind is it? (حادة = acute, قائمة = right, منفرجة = obtuse, مستقيمة = straight)` };
});

const LINE_REL: Array<[string, string]> = [['مستقيمان لا يلتقيان مهما امتدّا', 'متوازيان'], ['مستقيمان يلتقيان في نقطة واحدة وزاوية التقاطع بينهما قائمة', 'متعامدان'], ['مستقيمان يلتقيان في نقطة واحدة وزاوية التقاطع بينهما ليست قائمة', 'متقاطعان']];
const lineRelations = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const [desc, name] = pick(rng, LINE_REL);
  return { eq: desc, answer: name, wrongs: [...LINE_REL.map(l => l[1]).filter(x => x !== name), 'منحنيان'], ar: `${desc}: ماذا يسمّيان؟`, en: `${desc} (Arabic): what are they called? (متوازيان = parallel, متعامدان = perpendicular, متقاطعان = intersecting)` };
});

const angleArithmetic = T('angle_measure', /^قياس الزوايا ورسمها$/, [4, 4], ({ rng }) => {
  const a = 5 * int(rng, 2, 16), b = 5 * int(rng, 1, 15), k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const s = a + b; return { eq: `${a}, ${b}`, answer: `${s}°`, wrongs: wrongsFrom(`${s}°`, [`${Math.abs(a - b)}°`, `${s + 10}°`, `${180 - s > 0 ? 180 - s : 5}°`], j => `${s + 5 * Math.abs(j)}°`), ar: `رُسمت زاويتان متجاورتان قياسهما ${a}° و ${b}°. ما قياس الزاوية الكلية؟`, en: `Two adjacent angles measure ${a}° and ${b}°. What is the total angle?` }; }
  if (k === 1) { const x = 5 * int(rng, 2, 17); return { eq: `${x}`, answer: `${180 - x}°`, wrongs: wrongsFrom(`${180 - x}°`, [`${90 - x > 0 ? 90 - x : 10}°`, `${x}°`, `${360 - x}°`], j => `${180 - x + 5 * Math.abs(j)}°`), ar: `زاوية على مستقيم قياسها ${x}°. ما قياس الزاوية المجاورة لها على المستقيم نفسه؟`, en: `An angle on a straight line measures ${x}°. What does the angle next to it on the same line measure?` }; }
  if (k === 2) { const x = 5 * int(rng, 2, 17); return { eq: `${x}`, answer: `${90 - x}°`, wrongs: wrongsFrom(`${90 - x}°`, [`${180 - x}°`, `${x}°`, `${90 + x}°`], j => `${90 - x + 5 * Math.abs(j)}°`), ar: `زاوية قياسها ${x}° تتمم زاوية قائمة. ما قياس الزاوية المتمّمة؟`, en: `An angle of ${x}° is placed next to another to make a right angle. What does the other measure?` }; }
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi === lo) return angleArithmetic.make({ rng, diff: 'easy', grade: 4 });
  return { eq: `${hi}, ${lo}`, answer: `${hi - lo}°`, wrongs: wrongsFrom(`${hi - lo}°`, [`${hi + lo}°`, `${hi}°`, `${lo}°`], j => `${hi - lo + 5 * Math.abs(j)}°`), ar: `ما الفرق بين زاويتين قياسهما ${hi}° و ${lo}°؟`, en: `What is the difference between angles of ${hi}° and ${lo}°?` };
});

// ─── patterns, tables, money, time, measurement ─────────────────────────────

const numberPatterns = T('number_patterns_g4', /^الانماط$/, [4, 4], ({ rng, diff }) => {
  const d = int(rng, 2, span(diff, 6, 9, 12)), a = int(rng, 1, 30), up = rng() < 0.7 || a < 5 * d;
  const seq = [0, 1, 2, 3].map(i => (up ? a + i * d : a + 4 * d - i * d));
  const next = up ? seq[3]! + d : seq[3]! - d;
  const k = pick(rng, [0, 1]);
  const rule = `${up ? '+' : '−'}${d}`;
  if (k === 0) return { eq: seq.join(', '), answer: String(next), wrongs: ints(next, [next + d, next - d, seq[3]! + 1, up ? next - 1 : next + 1]), ar: `ما العدد التالي في النمط: ${seq.join('، ')}، ___؟`, en: `What number comes next in the pattern ${seq.join(', ')}, ___?` };
  return { eq: seq.join(', '), answer: rule, wrongs: wrongsFrom(rule, [`${up ? '−' : '+'}${d}`, `${up ? '+' : '−'}${d + 1}`, `${up ? '+' : '−'}${d - 1 > 0 ? d - 1 : d + 2}`, `×${d}`], j => `${up ? '+' : '−'}${d + 1 + Math.abs(j)}`), ar: `ما قاعدة النمط: ${seq.join('، ')}؟`, en: `What is the rule of the pattern ${seq.join(', ')}?` };
});

const inputOutput = T('input_output', /^جداول المدخلات والمخرجات$/, [4, 4], ({ rng, diff }) => {
  const mul = rng() < 0.5, c = int(rng, 2, span(diff, 5, 8, 9));
  const f = (x: number) => (mul ? x * c : x + c);
  const xs = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const [x1, x2, x3, q] = xs as [number, number, number, number];
  const rule = mul ? `ضرب في ${c}` : `جمع ${c}`;
  if (rng() < 0.7) return { eq: `${x1}, ${x2}, ${x3}, ${q}`, answer: String(f(q)), wrongs: ints(f(q), [mul ? q + c : q * c, f(q) + 1, f(q) - 1, f(q) + c]), ar: `جدول مدخلات ومخرجات: المدخل ${x1} ← المخرج ${f(x1)}، والمدخل ${x2} ← المخرج ${f(x2)}، والمدخل ${x3} ← المخرج ${f(x3)}. ما المخرج عندما يكون المدخل ${q}؟`, en: `Input–output table: input ${x1} gives output ${f(x1)}, input ${x2} gives ${f(x2)}, input ${x3} gives ${f(x3)}. What is the output when the input is ${q}?` };
  const alt = mul ? `جمع ${c}` : `ضرب في ${c}`;
  return { eq: `${x1}, ${x2}`, answer: rule, wrongs: [alt, mul ? `ضرب في ${c + 1}` : `جمع ${c + 1}`, `طرح ${c}`], ar: `جدول مدخلات ومخرجات: المدخل ${x1} ← المخرج ${f(x1)}، والمدخل ${x2} ← المخرج ${f(x2)}. ما القاعدة؟`, en: `Input–output table: input ${x1} gives output ${f(x1)} and input ${x2} gives ${f(x2)}. What is the rule? (جمع = add, ضرب في = multiply by)` };
});

const decimalMoney = T('decimal_money', /^الاعداد العشريه والنقود$/, [4, 4], ({ rng, diff }) => {
  const a = int(rng, 105, span(diff, 450, 900, 1900)), b = int(rng, 105, span(diff, 450, 900, 1900)), k = pick(rng, [0, 1, 2]);
  const dec = (v: number) => fmtDec(v, 2);
  if (k === 0) return { eq: `${dec(a)}, ${dec(b)}`, answer: dec(a + b), wrongs: wrongsFrom(dec(a + b), [dec(a + b + 10), dec(a + b - 10), dec(Math.abs(a - b)), dec(a + b + 100)], j => dec(a + b + Math.abs(j))), ar: `اشترى سامر قلمًا بـ ${dec(a)} دينارًا ودفترًا بـ ${dec(b)} دينارًا. كم دينارًا دفع؟`, en: `Sami bought a pen for ${dec(a)} dinars and a notebook for ${dec(b)} dinars. How many dinars did he pay?` };
  if (k === 1) { const pay = Math.ceil((a + 1) / 500) * 500, change = pay - a; return { eq: `${dec(pay)}, ${dec(a)}`, answer: dec(change), wrongs: wrongsFrom(dec(change), [dec(change + 10), dec(change - 10), dec(pay + a), dec(change + 50)], j => dec(change + Math.abs(j))), ar: `دفع خالد ${dec(pay)} دينارًا ثمن سلعة ثمنها ${dec(a)} دينارًا. كم دينارًا يستردّ؟`, en: `Khaled pays ${dec(pay)} dinars for an item costing ${dec(a)} dinars. How many dinars does he get back?` }; }
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi === lo) return decimalMoney.make({ rng, diff, grade: 4 });
  return { eq: `${dec(a)}, ${dec(b)}`, answer: dec(hi), wrongs: wrongsFrom(dec(hi), [dec(lo), dec(hi + 10), dec(hi - 10), dec(hi + lo)], j => dec(hi + Math.abs(j))), ar: `أي المبلغين أكبر: ${dec(a)} دينارًا أم ${dec(b)} دينارًا؟ (اكتب المبلغ الأكبر)`, en: `Which amount is larger: ${dec(a)} dinars or ${dec(b)} dinars? (write the larger amount)` };
});

const coins = (id: string, match: RegExp) => T(id, match, [1, 1], ({ rng }) => {
  const v = pick(rng, [5, 10]), n = int(rng, 2, 6), w = v === 5 ? 10 : 5, m = int(rng, 2, 4), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${v}, ${n}`, answer: String(v * n), wrongs: ints(v * n, [v + n, v * n + v, n, v * n - 1]), ar: `مع ليلى ${n} قطع نقدية، قيمة كل منها ${v} قروش. كم قرشًا معها؟`, en: `Layla has ${n} coins worth ${v} qirsh each. How many qirsh does she have?` };
  if (k === 1) return { eq: `${v}, ${n}, ${w}, ${m}`, answer: String(v * n + w * m), wrongs: ints(v * n + w * m, [v + n + w + m, v * n, w * m, v * n + w * m + v]), ar: `مع ليلى ${n} قطع من فئة ${v} قروش و ${m} قطع من فئة ${w} قروش. كم قرشًا معها؟`, en: `Layla has ${n} coins of ${v} qirsh and ${m} coins of ${w} qirsh. How many qirsh does she have?` };
  const total = v * n;
  return { eq: `${total}, ${v}`, answer: String(n), wrongs: ints(n, [total, v, n + 1, n - 1]), ar: `كم قطعة من فئة ${v} قروش تلزم لتكوين ${total} قرشًا؟`, en: `How many coins of ${v} qirsh make ${total} qirsh?` };
});

const dinar = T('dinar', /^الدينار$/, [2, 2], ({ rng }) => {
  const d = int(rng, 2, 9), k = pick(rng, [0, 1]);
  if (k === 0) return { eq: `${d}`, answer: String(d * 100), wrongs: ints(d * 100, [d * 10, d, d * 1000, d * 100 + 100]), ar: `إذا كان الدينار الواحد = 100 قرش فكم قرشًا في ${dinars(d)}؟`, en: `If 1 dinar = 100 qirsh, how many qirsh are in ${d} dinars?` };
  return { eq: `${d * 100}`, answer: String(d), wrongs: ints(d, [d * 10, d + 1, d - 1, d * 100]), ar: `إذا كان الدينار الواحد = 100 قرش فكم دينارًا في ${d * 100} قرش؟`, en: `If 1 dinar = 100 qirsh, how many dinars are in ${d * 100} qirsh?` };
});
const banknotes = T('banknotes', /^فئات النقود الورقيه$/, [2, 2], ({ rng }) => {
  const f = pick(rng, [5, 10, 20]), n = int(rng, 2, 6), g = pick(rng, [1, 5, 10].filter(x => x !== f)), m = int(rng, 2, 4), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${f}, ${n}`, answer: String(f * n), wrongs: ints(f * n, [f + n, f * n + f, f * n - n, n]), ar: `كم دينارًا في ${n} أوراق نقدية من فئة ${dinars(f)}؟`, en: `How many dinars are in ${n} banknotes of ${f} dinars?` };
  if (k === 1) return { eq: `${f}, ${n}, ${g}, ${m}`, answer: String(f * n + g * m), wrongs: ints(f * n + g * m, [f + n + g + m, f * n, g * m, f * n + g * m + g]), ar: `مع سلمى ${n} أوراق من فئة ${dinars(f)} و ${m} أوراق من فئة ${dinars(g)}. كم دينارًا معها؟`, en: `Salma has ${n} notes of ${f} dinars and ${m} notes of ${g} dinar${g === 1 ? '' : 's'}. How many dinars does she have?` };
  const total = f * n;
  return { eq: `${total}, ${f}`, answer: String(n), wrongs: ints(n, [total, f, n + 1, n - 1]), ar: `كم ورقة من فئة ${dinars(f)} تلزم لدفع ${dinars(total)}؟`, en: `How many ${f}-dinar notes are needed to pay ${total} dinars?` };
});

const DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
const weekDays = T('week_days', /^ايام الاسبوع$/, [1, 1], ({ rng }) => {
  const i = int(rng, 0, 6), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: DAYS[i]!, answer: DAYS[(i + 1) % 7]!, wrongs: others(rng, DAYS[(i + 1) % 7]!, DAYS), ar: `ما اليوم الذي يأتي بعد يوم ${DAYS[i]}؟ (الأسبوع يبدأ بالأحد)`, en: `Which day comes after ${DAYS[i]}? (the week starts on Sunday)` };
  if (k === 1) return { eq: DAYS[i]!, answer: DAYS[(i + 6) % 7]!, wrongs: others(rng, DAYS[(i + 6) % 7]!, DAYS), ar: `ما اليوم الذي يأتي قبل يوم ${DAYS[i]}؟ (الأسبوع يبدأ بالأحد)`, en: `Which day comes before ${DAYS[i]}? (the week starts on Sunday)` };
  return { eq: '', answer: '7', wrongs: ['5', '6', '10'], ar: 'كم يومًا في الأسبوع؟', en: 'How many days are in a week?' };
});

const hourTime = (id: string, match: RegExp, half: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const h = int(rng, 1, 11), j = int(rng, 1, 3), hh = (h + j - 1) % 12 + 1;
  if (!half) return { eq: `${h}:00, ${j}`, answer: `${hh}:00`, wrongs: wrongsFrom(`${hh}:00`, [`${h}:00`, `${hh % 12 + 1}:00`, `${(hh + 10) % 12 + 1}:00`, `${h}:30`], k => `${(hh + Math.abs(k)) % 12 + 1}:00`), ar: `الساعة الآن ${h}:00. ما الوقت بعد ${j === 1 ? 'ساعة واحدة' : j === 2 ? 'ساعتين' : '3 ساعات'}؟`, en: `It is ${h}:00 now. What time will it be in ${j} hour${j === 1 ? '' : 's'}?` };
  return { eq: `${h}:00`, answer: `${h}:30`, wrongs: wrongsFrom(`${h}:30`, [`${h}:00`, `${h % 12 + 1}:00`, `${h}:15`, `${h % 12 + 1}:30`], k => `${(h + Math.abs(k)) % 12 + 1}:30`), ar: `الساعة الآن ${h}:00. ما الوقت بعد نصف ساعة؟`, en: `It is ${h}:00 now. What time will it be in half an hour?` };
});

const nearestMinutes = (id: string, match: RegExp, step: 5 | 15) => T(id, match, [2, 2], ({ rng }) => {
  for (;;) {
    const h = int(rng, 1, 12), m = int(rng, 1, 58);
    const lo = Math.floor(m / step) * step, hi = lo + step, d1 = m - lo, d2 = hi - m;
    if (d1 === d2 || m % step === 0) continue;
    const near = d1 < d2 ? lo : hi, hh = near === 60 ? h % 12 + 1 : h, mm = near === 60 ? 0 : near;
    const fmt = (x: number, y: number) => `${x}:${String(y).padStart(2, '0')}`;
    const ans = fmt(hh, mm);
    const alt = d1 < d2 ? (hi === 60 ? fmt(h % 12 + 1, 0) : fmt(h, hi)) : fmt(h, lo);
    return { eq: fmt(h, m), answer: ans, wrongs: wrongsFrom(ans, [alt, fmt(h, m), fmt(h % 12 + 1, 0)], k => fmt(h, (mm + step * (1 + Math.abs(k))) % 60)), ar: `تشير الساعة إلى ${fmt(h, m)}. ما الوقت لأقرب ${step === 5 ? '5 دقائق' : 'ربع ساعة'}؟`, en: `A clock shows ${fmt(h, m)}. What is the time to the nearest ${step === 5 ? '5 minutes' : 'quarter hour'}?` };
  }
});

const MONTHS = ['كانون الثاني', 'شباط', 'آذار', 'نيسان', 'أيار', 'حزيران', 'تموز', 'آب', 'أيلول', 'تشرين الأول', 'تشرين الثاني', 'كانون الأول'];
const monthsOfYear = T('months', /^اشهر السنه$/, [2, 2], ({ rng }) => {
  const i = int(rng, 0, 11), k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: MONTHS[i]!, answer: MONTHS[(i + 1) % 12]!, wrongs: others(rng, MONTHS[(i + 1) % 12]!, MONTHS), ar: `ما الشهر الذي يأتي بعد شهر ${MONTHS[i]}؟`, en: `Which month comes after ${MONTHS[i]}? (Arabic month names)` };
  if (k === 1) return { eq: MONTHS[i]!, answer: MONTHS[(i + 11) % 12]!, wrongs: others(rng, MONTHS[(i + 11) % 12]!, MONTHS), ar: `ما الشهر الذي يأتي قبل شهر ${MONTHS[i]}؟`, en: `Which month comes before ${MONTHS[i]}? (Arabic month names)` };
  if (k === 2) return { eq: `${i + 1}`, answer: MONTHS[i]!, wrongs: others(rng, MONTHS[i]!, MONTHS), ar: `ما الشهر الذي ترتيبه ${i + 1} في السنة (يبدأ العام بكانون الثاني)؟`, en: `Which month is number ${i + 1} of the year (the year starts with كانون الثاني)?` };
  return { eq: '', answer: '12', wrongs: ['10', '11', '13'], ar: 'كم شهرًا في السنة؟', en: 'How many months are in a year?' };
});

const amPm = T('am_pm', /^قبل الظهر بعد الظهر$/, [3, 3], ({ rng }) => {
  const a = int(rng, 5, 11), b = int(rng, 1, 9), k = pick(rng, [0, 1]);
  if (k === 0) return { eq: `${a}, ${b}`, answer: String(12 - a + b), wrongs: ints(12 - a + b, [b - a > 0 ? b - a : 2, 12 - a, a + b, 12 - a + b + 1]), ar: `بدأ نشاط الساعة ${a}:00 قبل الظهر وانتهى الساعة ${b}:00 بعد الظهر. كم ساعة استغرق؟`, en: `An activity starts at ${a}:00 a.m. and ends at ${b}:00 p.m. How many hours does it last?` };
  return { eq: `${b}`, answer: String(b + 12), wrongs: ints(b + 12, [b, b + 10, 12 - b > 0 ? 12 - b : 11, b + 11]), ar: `الساعة ${b}:00 بعد الظهر. كم تبلغ الساعة بنظام 24 ساعة؟ (اكتب العدد قبل «:00»)`, en: `It is ${b}:00 p.m. What is the hour in 24-hour time? (write the number before ':00')` };
});

const calendar = T('calendar', /^التقويم$/, [3, 3], ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const w = int(rng, 2, 8); return { eq: `${w}`, answer: String(w * 7), wrongs: ints(w * 7, [w * 5, w * 6, w * 7 + 1, w + 7]), ar: `كم يومًا في ${w} أسابيع؟`, en: `How many days are in ${w} weeks?` }; }
  if (k === 1) { const d = 7 * int(rng, 2, 8); return { eq: `${d}`, answer: String(d / 7), wrongs: ints(d / 7, [d / 7 + 1, d / 7 - 1, d, d / 7 + 2]), ar: `كم أسبوعًا في ${d} يومًا؟`, en: `How many weeks are in ${d} days?` }; }
  const i = int(rng, 0, 6), j = int(rng, 1, 20), ans = DAYS[(i + j) % 7]!;
  return { eq: `${DAYS[i]}, ${j}`, answer: ans, wrongs: others(rng, ans, DAYS), ar: `اليوم ${DAYS[i]}. ما اليوم بعد ${j} يومًا؟`, en: `Today is ${DAYS[i]}. Which day will it be after ${j} days? (Arabic day names)` };
});

const compareMeasure = (id: string, match: RegExp, what: string, bigWord: string, en: string, big: string) => T(id, match, [1, 1], ({ rng }) => {
  const a = int(rng, 2, 14); let b = int(rng, 2, 14); while (b === a) b = int(rng, 2, 14);
  const k = pick(rng, [0, 1]);
  if (k === 0) { const r = Math.max(a, b); return { eq: `${a}, ${b}`, answer: String(r), wrongs: ints(r, [Math.min(a, b), a + b, r + 1, Math.abs(a - b)]), ar: `قيست ${what} شيئين بالوحدة نفسها: الأول: ${a}، الثاني: ${b}. ما قياس ${bigWord}؟`, en: `The ${en} of two things is measured with the same unit: first: ${a}, second: ${b}. What is the measure of the ${big}?` }; }
  const d = Math.abs(a - b);
  return { eq: `${a}, ${b}`, answer: String(d), wrongs: ints(d, [a + b, Math.max(a, b), d + 1, Math.min(a, b)]), ar: `قيست ${what} شيئين بالوحدة نفسها: الأول: ${a}، الثاني: ${b}. بكم يزيد الأكبر قياسًا على الأصغر؟`, en: `The ${en} of two things is measured with the same unit: first: ${a}, second: ${b}. By how much does the larger measure exceed the smaller?` };
});

const unitsG2 = (id: string, match: RegExp, big: string, small: string, f: number, bigEn: string, smallEn: string) => T(id, match, [2, 2], ({ rng }) => {
  const n = int(rng, 2, 9), k = pick(rng, [0, 1]);
  if (k === 0) return { eq: `${n}`, answer: String(n * f), wrongs: ints(n * f, [n * f * 10, n * f / 10, n + f, n * f + f]), ar: `1 ${big} = ${f} ${small}. كم ${small} في ${n} ${big}؟`, en: `1 ${bigEn} = ${f} ${smallEn}. How many ${smallEn} are in ${n} ${bigEn}?` };
  return { eq: `${n * f}`, answer: String(n), wrongs: ints(n, [n * 10, n + 1, n - 1, n * f]), ar: `1 ${big} = ${f} ${small}. كم ${big} في ${n * f} ${small}؟`, en: `1 ${bigEn} = ${f} ${smallEn}. How many ${bigEn} are in ${n * f} ${smallEn}?` };
});
const centimetre = T('cm_lengths', /^السنتيمتر$/, [2, 2], ({ rng }) => {
  const a = int(rng, 5, 30), b = int(rng, 3, 25), k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${a}, ${b}`, answer: String(a + b), wrongs: ints(a + b, [Math.abs(a - b), a + b + 1, a + b - 1, a * 2]), ar: `قلم طوله ${a} سم وممحاة طولها ${b} سم. ما طولهما معًا بالسنتيمتر؟`, en: `A pencil is ${a} cm long and an eraser is ${b} cm long. How long are they together, in cm?` };
  if (k === 1) { const hi = Math.max(a, b), lo = Math.min(a, b); if (hi === lo) return centimetre.make({ rng, diff: 'easy', grade: 2 }); return { eq: `${hi}, ${lo}`, answer: String(hi - lo), wrongs: ints(hi - lo, [hi + lo, hi, lo, hi - lo + 1]), ar: `طول حبل ${hi} سم وطول آخر ${lo} سم. بكم يزيد الأول على الثاني بالسنتيمتر؟`, en: `One rope is ${hi} cm long and another is ${lo} cm long. By how many cm is the first longer?` }; }
  return { eq: `${a}`, answer: String(a * 2), wrongs: ints(a * 2, [a, a + 2, a * 3, a * 2 + 1]), ar: `طول قلم ${a} سم. ما طول قلمين مثله إذا وُضعا طرفًا إلى طرف؟`, en: `A pencil is ${a} cm long. How long are two such pencils placed end to end?` };
});

export const EARLY_TOPICS: readonly Topic[] = [
  countingRange('count_123', /^الاعداد 1 2 3$/, 1, 3), countingRange('count_45', /^العددان 4 5$/, 4, 5), countingRange('count_678', /^الاعداد 6 7 8$/, 6, 8), countingRange('count_910', /^العددان 9 10$/, 9, 10),
  zero, ordinal, tensOnes('tens_ones_a', /^العشرات$/), tensOnes('tens_ones_b', /^الاحاد والعشرات$/), tensOnes('tens_ones_c', /^تمثيل الاعداد ضمن منزلتين$/),
  hundreds('hundreds_a', /^المئات$/), hundreds('hundreds_b', /^الاعداد ضمن ثلاث منازل$/), readWrite, thousands,
  evenOdd('even_odd_g1', /^الاعداد الزوجيه والاعداد الفرديه$/, 1), evenOdd('even_odd_g2', /^الاعداد الزوجيه والاعداد الفرديه$/, 2),
  numberChart, countUpDown,
  skipCount('skip_g1', /^العد القفزي$/, [1, 1], () => [2, 5, 10], () => 60), skipCount('skip_g3', /^العد القفزي$/, [3, 3], () => [3, 4, 6, 7, 8, 9, 25, 50], () => 400),
  skipCount('skip_g2', /^العد بالواحدات والعشرات والمئات$/, [2, 2], () => [1, 10, 100], () => 600),
  beforeAfter('before_after_g1', /^العدد السابق والعدد التالي$/, 1), beforeAfter('before_after_g2', /^العدد السابق والعدد التالي$/, 2),
  nearestTen, numberLineAdd('line_add', /^الجمع باستعمال خط الاعداد$/, true), numberLineAdd('line_sub', /^الطرح باستعمال خط الاعداد$/, false),
  doubles('double_a', /^الضعف$/, false), doubles('double_b', /^الضعف مضافا اليه 1$/, true), doubling,
  makeTen, addProps('add_props_g1', /^خصائص عمليه الجمع$/, 1), addProps('add_props_g2', /^خصائص الجمع$/, 2),
  relatedFacts('related_g1', 1), relatedFacts('related_g3', 3), missingNumber,
  mentalG1('mental_add', /^الجمع الذهني$/, true), mentalG1('mental_sub', /^الطرح الذهني$/, false),
  solids, planeShapes('plane_shapes', /^الاشكال المستويه$/, [1, 2]), planeShapes('plane_sides_g1', /^اضلاع الاشكال المستويه ورؤوسها$/, [1, 1]), planeShapes('plane_sides_g2', /^الاضلاع والرؤوس$/, [2, 2]),
  solidParts, geoPattern,
  halfQuarter('half', /^النصف$/, 'نصف'), halfQuarter('quarter', /^الربع$/, 'ربع'), equalParts, fractionOfSetG1, fractionOfSetG3,
  unitFraction, unitFractionOfSet, wholeFraction, fractionOne, fractionLine,
  numberLineG2,
  mentalMultiples('mental_mult_add_g2', /^جمع مضاعفات العشره والمئه ذهنيا$/, true, 2), mentalMultiples('mental_mult_sub_g2', /^طرح مضاعفات العشره والمئه ذهنيا$/, false, 2),
  mentalMultiples('mental_mult_add_g3', /^جمع مضاعفات 10 و100 و1000$/, true, 3), mentalMultiples('mental_mult_sub_g3', /^طرح مضاعفات 10 و100 و1000$/, false, 3),
  equalGroups('equal_groups_a', /^المجموعات المتساويه$/), equalGroups('equal_groups_b', /^تكوين المجموعات المتساويه$/), divisionRelation,
  mulProps, divProps, remainder,
  divisionQ('div_no_rem', /^القسمه من دون باق \(الناتج من رقمين\)$/, true, false), divisionQ('div_rem_2', /^القسمه مع باق \(الناتج من رقمين\)$/, true, true), divisionQ('div_rem_1', /^القسمه مع باق \(الناتج من رقم واحد\)$/, false, true),
  tensMulG3, tensDivG3, distributive, mulNoRegroup('mul_no_regroup', /^الضرب من دون اعاده التجميع$/, false), mulNoRegroup('mul_regroup', /^الضرب مع اعاده التجميع$/, true),
  twoWay, pointLineRay, angleG3, lineRelations('lines_g3', /^مستقيمات خاصه$/, 3), lineRelations('lines_g4', /^المستقيمات المتوازيه والمتقاطعه$/, 4), angleArithmetic,
  numberPatterns, inputOutput, decimalMoney,
  coins('coins_a', /^القطع النقديه$/), coins('coins_b', /^القطع النقديه المتساويه$/), coins('coins_c', /^استعمال القطع النقديه$/), dinar, banknotes,
  weekDays, hourTime('hour_full', /^الوقت بالساعات الكامله$/, false), hourTime('hour_half', /^الوقت بنصف الساعه$/, true),
  nearestMinutes('time_5', /^الوقت لاقرب 5 دقائق$/, 5), nearestMinutes('time_15', /^الوقت لاقرب ربع ساعه$/, 15), monthsOfYear, amPm, calendar,
  compareMeasure('compare_len', /^مقارنه الاطوال وترتيبها$|^وحدات الطول غير القياسيه$/, 'أطوال', 'الأطول', 'length', 'longest'),
  compareMeasure('compare_mass', /^مقارنه الكتل وترتيبها$|^وحدات الكتله غير القياسيه$/, 'كتلتي', 'الأثقل', 'mass', 'heaviest'),
  compareMeasure('compare_cap', /^مقارنه السعات وترتيبها$|^وحدات السعه غير القياسيه$/, 'سعتي', 'الأكبر سعة', 'capacity', 'largest'),
  centimetre, unitsG2('units_m_g2', /^المتر$/, 'متر', 'سنتيمتر', 100, 'metre', 'centimetres'),
  unitsG2('units_kg_g2', /^الغرام والكيلوغرام$/, 'كيلوغرام', 'غرام', 1000, 'kilogram', 'grams'), unitsG2('units_l_g2', /^اللتر والمليلتر$/, 'لتر', 'مليلتر', 1000, 'litre', 'millilitres'),
];
