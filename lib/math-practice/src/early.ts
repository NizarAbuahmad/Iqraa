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
import { gcd, int, numWrongs, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';
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
/** «كرة واحدة / كرتان / 5 كرات / 12 كرةً» */
const balls = (n: number) => (n === 1 ? 'كرة واحدة' : n === 2 ? 'كرتان' : `${n} ${tamyiz(n, 'كرات', 'كرةً', 'كرة')}`);
/** «45 قرشًا / 7 قروش / 300 قرش» — for 3 or more. */
const qirsh = (n: number) => `${n} ${tamyiz(n, 'قروش', 'قرشًا', 'قرش')}`;
/** Two colours of ball, 1–10 of each: «كرة حمراء واحدة / كرتان حمراوان / 4 كرات حمراء». */
const redBalls = (n: number) => (n === 1 ? 'كرة حمراء واحدة' : n === 2 ? 'كرتان حمراوان' : `${n} كرات حمراء`);
const blueBalls = (n: number) => (n === 1 ? 'كرة زرقاء واحدة' : n === 2 ? 'كرتان زرقاوان' : `${n} كرات زرقاء`);

const ORD = ['الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر'];

/** Number names 0–10 as a Grade 1 book writes them under the digit. */
const NUM_WORDS = ['صفر', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة'];
const NUM_EN = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const TEENS_W = ['عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
const TENS_W = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
const HUNDS_W = ['', 'مئة', 'مئتان', 'ثلاثمئة', 'أربعمئة', 'خمسمئة', 'ستمئة', 'سبعمئة', 'ثمانمئة', 'تسعمئة'];
/** «ثلاثمئة وسبعة وأربعون» — how 1–999 is read aloud (counting form). */
const arWords = (n: number) => {
  const h = Math.floor(n / 100), r = n % 100, parts: string[] = [];
  if (h) parts.push(HUNDS_W[h]!);
  if (r) parts.push(r <= 10 ? NUM_WORDS[r]! : r < 20 ? TEENS_W[r - 10]! : r % 10 ? `${NUM_WORDS[r % 10]} و${TENS_W[Math.floor(r / 10)]}` : TENS_W[r / 10]!);
  return parts.join(' و');
};
/** A row of stars to count: «★ ★ ★». */
const stars = (n: number) => Array.from({ length: n }, () => '★').join(' ');

// ─── counting and place value ───────────────────────────────────────────────

const countingRange = (id: string, match: RegExp, lo: number, hi: number) => T(id, match, [1, 1], ({ rng }) => {
  const kinds = hi - lo >= 2 ? [0, 1, 2, 3, 4] : [0, 1, 3, 4];
  const k = pick(rng, kinds);
  if (k === 0) { const x = int(rng, lo, hi - 1); return { eq: `${x}`, answer: String(x + 1), wrongs: ints(x + 1, [x, x + 2, x - 1, x + 3]), ar: `ما العدد الذي يأتي بعد ${x}؟`, en: `Which number comes after ${x}?` }; }
  if (k === 1) { const x = int(rng, lo + 1, hi); return { eq: `${x}`, answer: String(x - 1), wrongs: ints(x - 1, [x, x - 2, x + 1, x - 3]), ar: `ما العدد الذي يأتي قبل ${x}؟`, en: `Which number comes before ${x}?` }; }
  if (k === 3) { const x = int(rng, lo, hi); return { eq: stars(x), answer: String(x), wrongs: ints(x, [x + 1, x - 1, x + 2, x - 2]), ar: `كم نجمة في الصف الآتي: ${stars(x)}؟`, en: `How many stars are in this row: ${stars(x)}?` }; }
  if (k === 4) { const x = int(rng, lo, hi); return { eq: NUM_WORDS[x]!, answer: String(x), wrongs: ints(x, [x + 1, x - 1, x + 2, x - 2]), ar: `اكتب العدد «${NUM_WORDS[x]}» بالأرقام.`, en: `Write the number «${NUM_WORDS[x]}» (${NUM_EN[x]}) in digits.` }; }
  const x = int(rng, lo, hi - 2);
  return { eq: `${x}, ${x + 2}`, answer: String(x + 1), wrongs: ints(x + 1, [x, x + 2, x + 3, x - 1]), ar: `ما العدد الذي يقع بين ${x} و ${x + 2}؟`, en: `Which number lies between ${x} and ${x + 2}?` };
});

const zero = T('count_zero', /^العدد صفر$/, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  const n = int(rng, 3, 9);
  if (k === 0) return { eq: `${n} − ${n}`, answer: '0', wrongs: ints(0, [n, 1, 2 * n, n - 1]), ar: `ما ناتج ${n} − ${n}؟`, en: `What is ${n} − ${n}?` };
  if (k === 1) return { eq: `${n} + 0`, answer: String(n), wrongs: ints(n, [0, n + 1, n - 1, 2 * n]), ar: `ما ناتج ${n} + 0؟`, en: `What is ${n} + 0?` };
  if (k === 2) return { eq: `${n} − 0`, answer: String(n), wrongs: ints(n, [0, n + 1, n - 1, 2 * n]), ar: `ما ناتج ${n} − 0؟`, en: `What is ${n} − 0?` };
  if (k === 4) return { eq: `${n}`, answer: '0', wrongs: ints(0, [n, 1, n - 1, 2]), ar: `في صندوق ${n} كرات، أُخرجت الكرات كلها. كم كرة بقيت في الصندوق؟`, en: `A box has ${n} balls and all of them are taken out. How many balls are left in the box?` };
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
  const k = pick(rng, [0, 1, 2]);
  const h = grade === 1 ? 0 : int(rng, 1, 9), t = int(rng, 1, 9), o = int(rng, 1, 9), n = h * 100 + t * 10 + o, top = grade === 1 ? 99 : 999;
  if (k === 1) {
    // read it: the number in words, as the book prints it under the digits
    const swap = grade === 1 ? o * 10 + t : o * 100 + t * 10 + h;
    const ans = arWords(n);
    return { eq: `${n}`, answer: ans, wrongs: wrongsFrom(ans, [swap, n + 10 <= top ? n + 10 : n - 10, n + 1 <= top ? n + 1 : n - 1].filter(v => v !== n).map(arWords), j => arWords(Math.min(top, Math.max(11, n + 2 * j)))), ar: `كيف نقرأ العدد ${n}؟`, en: `How do we read the number ${n} (in Arabic words)?` };
  }
  if (k === 2) {
    // the value of one digit: pick a place whose digit appears only once in the number
    const places = ([[h, 100], [t, 10], [o, 1]] as Array<[number, number]>).filter(([d, p]) => d > 0 && (p < 100 || grade === 2) && [h, t, o].filter(x => x === d).length === 1);
    if (!places.length) return readWrite.make({ rng, diff: 'easy', grade });
    const [d, p] = pick(rng, places), v = d * p;
    return { eq: `${n}`, answer: String(v), wrongs: ints(v, [d, d * 10, d * 100, n].filter(x => x !== v)), ar: `ما قيمة الرقم ${d} في العدد ${n}؟`, en: `What is the value of the digit ${d} in ${n}?` };
  }
  if (grade === 1) return { eq: `${t * 10} + ${o}`, answer: String(n), wrongs: ints(n, [t + o, o * 10 + t, n + 10, n - 1]), ar: `ما العدد ${t * 10} + ${o}؟`, en: `What number is ${t * 10} + ${o}?` };
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
  const even = rng() < 0.5, k = pick(rng, [0, 1, 2]);
  const word = even ? 'زوجيًا' : 'فرديًا';
  if (k === 2) {
    // how many even (odd) numbers in a short run a..b, both ends included
    const len = int(rng, 5, 9), a = int(rng, 1, hi - len), b = a + len;
    const evens = Math.floor(b / 2) - Math.floor((a - 1) / 2), ans = even ? evens : len + 1 - evens;
    return { eq: `${a}, ${b}`, answer: String(ans), wrongs: ints(ans, [len + 1, len + 1 - ans, ans + 1, ans - 1, len]), ar: `كم عددًا ${word} في الأعداد من ${a} إلى ${b}؟`, en: `How many ${even ? 'even' : 'odd'} numbers are there from ${a} to ${b}?` };
  }
  if (k === 1) {
    // the next even (odd) number after n, whatever n's own parity
    const n = int(rng, 1, hi - 2), ans = (n + 1) % 2 === (even ? 0 : 1) ? n + 1 : n + 2;
    return { eq: `${n}`, answer: String(ans), wrongs: ints(ans, [ans === n + 1 ? n + 2 : n + 1, ans + 2, n, ans + 1]), ar: `ما أول عدد ${even ? 'زوجي' : 'فردي'} يأتي بعد العدد ${n}؟`, en: `What is the first ${even ? 'even' : 'odd'} number after ${n}?` };
  }
  const pickOf = (e: boolean) => { let v = int(rng, 1, hi); if ((v % 2 === 0) !== e) v += v < hi ? 1 : -1; return v; };
  const xs = new Set<number>([pickOf(even)]);
  while (xs.size < 4) xs.add(pickOf(!even));
  const list = shuffle(rng, [...xs]);
  const ans = list.find(v => (v % 2 === 0) === even)!;
  return { eq: list.join(', '), answer: String(ans), wrongs: list.filter(v => v !== ans).map(String), ar: `أي الأعداد الآتية ${even ? 'زوجي' : 'فردي'}: ${list.join('، ')}؟`, en: `Which of these numbers is ${even ? 'even' : 'odd'}: ${list.join(', ')}?` };
});

const CHART_ROWS = (r: number) => (r === 1 ? 'صفًا واحدًا' : r === 2 ? 'صفين' : `${r} صفوف`);
const CHART_STEPS = (c: number) => (c === 1 ? 'خطوة واحدة' : c === 2 ? 'خطوتين' : `${c} خطوات`);
const numberChart = T('number_chart', /^لوحه الاعداد$/, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3, 4, 4, 4, 4, 5, 5, 5, 5]);
  if (k === 4) {
    // two moves: whole rows up or down (tens), then steps along the row (ones)
    for (;;) {
      const n = int(rng, 1, 100), rows = int(rng, 1, 3), steps = int(rng, 1, 3), down = rng() < 0.5, right = rng() < 0.5;
      const col = (n - 1) % 10 + 1, r = n + (down ? 10 : -10) * rows + (right ? 1 : -1) * steps;
      if (r < 1 || r > 100 || (right ? col + steps > 10 : col - steps < 1)) continue;
      const tens = (down ? 10 : -10) * rows, ones = (right ? 1 : -1) * steps;
      return { eq: `${n}, ${r}`, answer: String(r), wrongs: ints(r, [n + tens - ones, n - tens + ones, n + (down ? 1 : -1) * rows + (right ? 10 : -10) * steps, r + 10, r - 10, r + 1]), ar: `ابدأ من العدد ${n} في لوحة الأعداد من 1 إلى 100، و${down ? 'انزل' : 'اصعد'} ${CHART_ROWS(rows)} في العمود نفسه، ثم تحرّك ${CHART_STEPS(steps)} إلى ${right ? 'اليمين' : 'اليسار'} في الصف نفسه. عند أي عدد تصل؟ (في كل صف 10 أعداد)`, en: `Start at ${n} on the 1–100 number chart (10 numbers in each row), go ${down ? 'down' : 'up'} ${rows} row${rows === 1 ? '' : 's'} in the same column, then move ${steps} step${steps === 1 ? '' : 's'} to the ${right ? 'right' : 'left'} in the same row. Which number do you reach?` };
    }
  }
  if (k === 5) {
    // the structure of the chart: which number starts the row a number sits in
    let n = int(rng, 12, 100); if (n % 10 === 1) n += 1;
    const ans = Math.floor((n - 1) / 10) * 10 + 1;
    return { eq: `${n}`, answer: String(ans), wrongs: ints(ans, [Math.floor(n / 10) * 10, ans + 10, ans - 10, ans + 9, n - 1]), ar: `الصف الأول في لوحة الأعداد يبدأ بالعدد 1 وينتهي بالعدد 10، والصف الثاني يبدأ بالعدد 11. بأي عدد يبدأ الصف الذي فيه العدد ${n}؟`, en: `On a number chart the first row starts at 1 and ends at 10, and the second row starts at 11. Which number starts the row that ${n} is in?` };
  }
  if (k === 0) { const n = int(rng, 1, 90); return { eq: `${n}`, answer: String(n + 10), wrongs: ints(n + 10, [n + 1, n - 10, n + 9, n + 11]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع تحت العدد ${n} مباشرة؟`, en: `On a number chart with 10 numbers in each row, which number is directly below ${n}?` }; }
  if (k === 1) { const n = int(rng, 11, 100); return { eq: `${n}`, answer: String(n - 10), wrongs: ints(n - 10, [n - 1, n + 10, n - 9, n - 11]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع فوق العدد ${n} مباشرة؟`, en: `On a number chart with 10 numbers in each row, which number is directly above ${n}?` }; }
  if (k === 2) { let n = int(rng, 1, 99); if (n % 10 === 0) n -= 1; return { eq: `${n}`, answer: String(n + 1), wrongs: ints(n + 1, [n - 1, n + 10, n + 2, n - 10]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع على يمين العدد ${n} مباشرة في الصف نفسه؟`, en: `On a number chart with 10 numbers in each row, which number is directly to the right of ${n} in the same row?` }; }
  let n = int(rng, 2, 100); if (n % 10 === 1) n += 1;
  return { eq: `${n}`, answer: String(n - 1), wrongs: ints(n - 1, [n + 1, n - 10, n - 2, n + 10]), ar: `في لوحة الأعداد (كل صف فيه 10 أعداد) ما العدد الذي يقع على يسار العدد ${n} مباشرة في الصف نفسه؟`, en: `On a number chart with 10 numbers in each row, which number is directly to the left of ${n} in the same row?` };
});

const countUpDown = T('count_up_down', /^العد تصاعديا وتنازليا$/, [1, 1], ({ rng }) => {
  const up = rng() < 0.5, a = up ? int(rng, 1, 15) : int(rng, 8, 20), k = pick(rng, [0, 1, 2]);
  if (k === 2) {
    // five numbers of a count with one left out of the middle: which one?
    const seq = [0, 1, 2, 3, 4].map(i => (up ? a + i : a - i)), gap = int(rng, 1, 3), miss = seq[gap]!, said = seq.filter((_, i) => i !== gap);
    return { eq: said.join(', '), answer: String(miss), wrongs: ints(miss, [up ? seq[4]! + 1 : seq[4]! - 1, up ? a - 1 : a + 1, miss + 1, miss - 1]), ar: `عدّت سلمى ${up ? 'تصاعديًا' : 'تنازليًا'} فقالت: ${said.join('، ')}. ما العدد الذي نسيته؟`, en: `Salma counted ${up ? 'up' : 'down'} and said: ${said.join(', ')}. Which number did she forget?` };
  }
  if (k === 1) {
    // count on (back) j numbers from a: where does the count stop?
    const j = int(rng, 3, 5), r = up ? a + j : a - j;
    return { eq: `${a}, ${j}`, answer: String(r), wrongs: ints(r, [up ? r - 1 : r + 1, up ? r + 1 : r - 1, up ? a - j : a + j, a]), ar: `ابدأ من العدد ${a} وعُدّ ${up ? 'تصاعديًا' : 'تنازليًا'} ${j} أعداد. عند أي عدد تتوقف؟`, en: `Start at ${a} and count ${up ? 'up' : 'down'} ${j} numbers. Which number do you stop at?` };
  }
  const seq = [0, 1, 2].map(i => (up ? a + i : a - i)), next = up ? a + 3 : a - 3;
  return { eq: seq.join(', '), answer: String(next), wrongs: ints(next, [next + 1, next - 1, up ? a : a + 1, next + 2]), ar: `أكمل العدّ ${up ? 'تصاعديًا' : 'تنازليًا'}: ${seq.join('، ')}، ___`, en: `Complete the count going ${up ? 'up' : 'down'}: ${seq.join(', ')}, ___` };
});

const skipCount = (id: string, match: RegExp, grades: [number, number], steps: (g: number) => number[], top: (g: number) => number) => T(id, match, grades, ({ rng, grade }) => {
  const s = pick(rng, steps(grade)), start = s * int(rng, 0, Math.max(5, Math.floor(top(grade) / s / 3)));
  const seq = [0, 1, 2, 3, 4].map(i => start + i * s);
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) return { eq: seq.slice(0, 4).join(', '), answer: String(s), wrongs: ints(s, [s * 2, s + 1, s * 10, s - 1, s + 2]), ar: `ما مقدار القفزة في العدّ: ${seq.slice(0, 4).join('، ')}؟`, en: `What is the size of each jump in the count ${seq.slice(0, 4).join(', ')}?` };
  if (k === 3) {
    // jumps along a number line, inside the numbers the grade works with
    const limit = grade === 1 ? 100 : grade === 2 ? 999 : 9999, j = int(rng, 3, 5);
    const a = start + j * s <= limit ? start : 0, r = a + j * s;
    return { eq: `${a}, ${s}, ${j}`, answer: String(r), wrongs: ints(r, [r + s, r - s, a + j, a + s]), ar: `ابدأ من ${a} على خط الأعداد واقفز ${j} قفزات، طول كل قفزة ${s}. عند أي عدد تصل؟`, en: `Start at ${a} on a number line and take ${j} jumps of ${s}. Which number do you reach?` };
  }
  const down = k === 1, order = down ? seq.slice().reverse() : seq;
  const hole = int(rng, 3, 4);
  const shown = order.map((v, i) => (i === hole ? '___' : String(v)));
  const ans = order[hole]!;
  if (down) return { eq: order.join(', '), answer: String(ans), wrongs: ints(ans, [ans - s, ans + s, ans - 1, ans + 2 * s]), ar: `أكمل العدّ التنازلي بالقفز: ${shown.join('، ')}`, en: `Complete the skip count going down: ${shown.join(', ')}` };
  return { eq: seq.join(', '), answer: String(ans), wrongs: ints(ans, [ans + s, ans - s, ans + 1, ans + 2 * s]), ar: `أكمل العدّ بالقفز: ${shown.join('، ')}`, en: `Complete the skip count: ${shown.join(', ')}` };
});

const beforeAfter = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const hi = grade === 1 ? 99 : 999, n = int(rng, 11, hi - 1), k = pick(rng, [0, 1, 2, 3, 3]);
  if (k === 3) {
    // how many whole numbers lie strictly between two numbers a few apart
    const g = int(rng, 3, 9), a = int(rng, 11, hi - g), b = a + g;
    return { eq: `${a}, ${b}`, answer: String(g - 1), wrongs: ints(g - 1, [g, g + 1, g - 2, b - a + 1]), ar: `كم عددًا يقع بين العددين ${a} و ${b}؟`, en: `How many whole numbers lie between ${a} and ${b}?` };
  }
  if (k === 0) return { eq: `${n}`, answer: String(n - 1), wrongs: ints(n - 1, [n + 1, n - 2, n + 10, n - 10]), ar: `ما العدد السابق للعدد ${n}؟`, en: `What is the number before ${n}?` };
  if (k === 1) return { eq: `${n}`, answer: String(n + 1), wrongs: ints(n + 1, [n - 1, n + 2, n + 10, n - 10]), ar: `ما العدد التالي للعدد ${n}؟`, en: `What is the number after ${n}?` };
  return { eq: `${n - 1}, ${n + 1}`, answer: String(n), wrongs: ints(n, [n - 1, n + 1, n + 2, n - 2]), ar: `ما العدد الذي يقع بين ${n - 1} و ${n + 1}؟`, en: `Which number lies between ${n - 1} and ${n + 1}?` };
});

const nearestTen = T('nearest_ten_g1', /^التقدير$/, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 1) {
    // which two tens does n sit between?
    let n = int(rng, 11, 49); if (n % 10 === 0) n += 1;
    const t = Math.floor(n / 10) * 10, pair = (x: number) => `${x} و ${x + 10}`;
    const ans = pair(t);
    return { eq: `${n}`, answer: ans, wrongs: wrongsFrom(ans, [t >= 20 ? pair(t - 10) : `${t} و ${t + 20}`, pair(t + 10), `${t + 10} و ${t + 30}`], j => pair(t + 10 * (Math.abs(j) + 1))), ar: `بين أي عشرتين يقع العدد ${n}؟`, en: `Between which two tens does ${n} lie?` };
  }
  if (k === 2) {
    // which of four numbers is closest to a ten: four different distances, so one clear answer
    const ten = 10 * int(rng, 2, 4), dist = shuffle(rng, [1, 2, 3, 4, 6, 7, 8, 9]).slice(0, 4);
    const list = dist.map(d => (rng() < 0.5 ? ten - d : ten + d)), ans = list[dist.indexOf(Math.min(...dist))]!;
    return { eq: `${ten}`, answer: String(ans), wrongs: list.filter(v => v !== ans).map(String), ar: `أي الأعداد الآتية أقرب إلى العدد ${ten}: ${list.join('، ')}؟`, en: `Which of these numbers is closest to ${ten}: ${list.join(', ')}?` };
  }
  for (;;) {
    const n = int(rng, 11, 49);
    if (n % 10 === 5) continue;
    const near = Math.round(n / 10) * 10;
    return { eq: `${n}`, answer: String(near), wrongs: ints(near, [near + 10, near - 10, near + 20, near - 20]), ar: `أي عدد من مضاعفات العشرة الآتية أقرب إلى العدد ${n}؟ (10، 20، 30، 40، 50)`, en: `Which of these tens is closest to ${n}? (10, 20, 30, 40, 50)` };
  }
});

const numberLineAdd = (id: string, match: RegExp, add: boolean) => T(id, match, [1, 1], ({ rng }) => {
  // at least 3 jumps, so «${b} قفزات» is always the plural
  const a = add ? int(rng, 1, 12) : int(rng, 6, 19), b = add ? int(rng, 3, Math.min(8, 20 - a)) : int(rng, 3, Math.min(8, a - 1));
  const r = add ? a + b : a - b, side = add ? 'اليمين' : 'اليسار', sideEn = add ? 'right' : 'left';
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) return { eq: `${a}, ${b}`, answer: String(r), wrongs: ints(r, [add ? a - b : a + b, r + 1, r - 1, a]), ar: `استعمل خط الأعداد لإيجاد ${a} ${add ? '+' : '−'} ${b} = ___`, en: `Use the number line to find ${a} ${add ? '+' : '−'} ${b} = ___` };
  if (k === 2) return { eq: `${a}, ${r}`, answer: String(b), wrongs: ints(b, [b + 1, b - 1, r, a + r]), ar: `على خط الأعداد، كم قفزة إلى ${side} تلزم للانتقال من ${a} إلى ${r} (قفزة واحدة لكل وحدة)؟`, en: `On the number line, how many one-unit jumps to the ${sideEn} take you from ${a} to ${r}?` };
  if (k === 3) return { eq: `${b}, ${r}`, answer: String(a), wrongs: ints(a, [add ? r + b : r - b, a + 1, a - 1, r]), ar: `قفزت سلمى على خط الأعداد ${b} قفزات إلى ${side} (قفزة واحدة لكل وحدة) فوصلت إلى العدد ${r}. من أي عدد بدأت؟`, en: `Salma took ${b} one-unit jumps to the ${sideEn} on the number line and reached ${r}. Which number did she start from?` };
  return { eq: `${a}, ${b}`, answer: String(r), wrongs: ints(r, [add ? a - b : a + b, r + 1, r - 1, a]), ar: `ابدأ من العدد ${a} على خط الأعداد، ثم اقفز ${b} قفزات إلى ${add ? 'اليمين' : 'اليسار'} (قفزة واحدة لكل وحدة). عند أي عدد تصل؟`, en: `Start at ${a} on the number line and take ${b} jumps to the ${add ? 'right' : 'left'} (one unit per jump). Which number do you reach?` };
});

const doubles = (id: string, match: RegExp, plusOne: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const n = int(rng, 1, 9), r = plusOne ? 2 * n + 1 : 2 * n, k = pick(rng, [0, 1, 2]);
  if (!plusOne && k === 1) return { eq: `${2 * n}`, answer: String(n), wrongs: ints(n, [2 * n, n + 1, n - 1, n + 2]), ar: `ما العدد الذي ضعفه ${2 * n}؟`, en: `Which number has ${2 * n} as its double?` };
  if (!plusOne && k === 2) { const m = int(rng, 3, 10); return { eq: `${m}`, answer: String(2 * m), wrongs: ints(2 * m, [m, 2 * m + 1, 2 * m - 1, m + 2]), ar: `مع سلمى ${m} كرات، ومع أختها العدد نفسه من الكرات. كم كرة معهما معًا؟`, en: `Salma has ${m} balls and her sister has the same number. How many balls do they have together?` }; }
  if (plusOne && k === 1) return { eq: `${n} + ${n + 1}`, answer: String(r), wrongs: ints(r, [2 * n, 2 * n + 2, r + 2, n + 1]), ar: `استعمل الضعف مضافًا إليه 1 لإيجاد ${n} + ${n + 1}`, en: `Use double plus 1 to find ${n} + ${n + 1}` };
  if (plusOne && k === 2) return { eq: `${n} + ${n + 1}`, answer: String(n), wrongs: ints(n, [n + 1, 2 * n, n - 1, r]), ar: `أكمل: ${n} + ${n + 1} = ضعف ___ + 1`, en: `Complete: ${n} + ${n + 1} = double ___ + 1` };
  return { eq: `${n}`, answer: String(r), wrongs: ints(r, [n, n + 1, r + 1, r - 1, n * n]), ar: plusOne ? `ما ضعف العدد ${n} مضافًا إليه 1؟` : `ما ضعف العدد ${n}؟`, en: plusOne ? `What is double ${n}, plus 1?` : `What is double ${n}?` };
});
const doubling = T('doubling_g3', /^المضاعفه$/, [3, 3], ({ rng, diff }) => {
  const n = int(rng, 11, span(diff, 49, 99, 499)), k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) {
    // near doubles: n + (n + 1) is double n and one more
    const s = 2 * n + 1;
    return { eq: `${n} + ${n + 1}`, answer: String(s), wrongs: ints(s, [2 * n, 2 * n + 2, s + 10, s - 10]), ar: `استعمل المضاعفة لإيجاد ناتج ${n} + ${n + 1} ذهنيًا.`, en: `Use doubling to work out ${n} + ${n + 1} in your head.` };
  }
  if (k === 4) {
    // double in parts: split off the ones, double each part, the blank is the bigger part's double
    const m = n % 10 ? n : n + 1, o = m % 10, t = m - o;
    return { eq: `2 × ${m}`, answer: String(2 * t), wrongs: ints(2 * t, [t, 2 * m, 2 * t + 10, 2 * t - 10]), ar: `أكمل: ضعف ${m} = ضعف ${t} + ضعف ${o} = ___ + ${2 * o}`, en: `Complete: double ${m} = double ${t} + double ${o} = ___ + ${2 * o}` };
  }
  if (k === 2) return { eq: `${n}`, answer: String(4 * n), wrongs: ints(4 * n, [2 * n, 3 * n, 4 * n + 10, 8 * n]), ar: `ما ضعف ضعف العدد ${n}؟`, en: `What is double double ${n}?` };
  if (k === 1) return { eq: `${2 * n}`, answer: String(n), wrongs: ints(n, [2 * n, n + 1, n - 1, 4 * n]), ar: `ما العدد الذي ضعفه ${2 * n}؟`, en: `Which number has ${2 * n} as its double?` };
  return { eq: `${n}`, answer: String(2 * n), wrongs: ints(2 * n, [n + 2, 2 * n + 10, n * n, 2 * n - 1]), ar: `ما ضعف العدد ${n}؟`, en: `What is double ${n}?` };
});

const makeTen = T('make_ten', /^مكونات العدد 10$/, [1, 1], ({ rng }) => {
  const a = int(rng, 1, 9), k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) { const m = int(rng, 3, 9); return { eq: `${m}`, answer: String(10 - m), wrongs: ints(10 - m, [m, 10, 10 - m + 1, 10 - m - 1]), ar: `مع ليلى ${m} كرات حمراء. كم كرة زرقاء تلزمها ليصبح معها 10 كرات؟`, en: `Layla has ${m} red balls. How many blue balls does she need to have 10 balls?` }; }
  if (k === 4) return { eq: `${a}`, answer: String(10 - a), wrongs: ints(10 - a, [a, 10 + a, 10 - a + 1, 10 - a - 1]), ar: `ما العدد الذي إذا جمعته مع ${a} كان الناتج 10؟`, en: `Which number added to ${a} makes 10?` };
  if (k === 0) return { eq: `${a}`, answer: String(10 - a), wrongs: ints(10 - a, [a, 10 + a, 10 - a + 1, 10 - a - 1]), ar: `${a} + ___ = 10`, en: `${a} + ___ = 10` };
  if (k === 1) return { eq: `${a}`, answer: String(10 - a), wrongs: ints(10 - a, [a, a + 1, 10, 9 - a]), ar: `10 = ${a} + ___`, en: `10 = ${a} + ___` };
  const good = `${a} + ${10 - a}`;
  const bad = shuffle(rng, [`${a} + ${9 - a > 0 ? 9 - a : 8}`, `${a} + ${11 - a}`, `${a + 1} + ${10 - a}`, `${a} + ${a}`]).filter(p => { const [x, y] = p.split(' + ').map(Number); return x! + y! !== 10; });
  return { eq: good, answer: good, wrongs: [...new Set(bad)].slice(0, 3), ar: `أي جمع مما يأتي ناتجه 10؟`, en: 'Which of these sums makes 10?' };
});

const addProps = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const hi = grade === 1 ? 9 : 99, a = int(rng, 2, hi), b = int(rng, 2, hi), c = int(rng, 2, hi), k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) return { eq: `${a} + ${b}`, answer: String(a + b), wrongs: ints(a + b, [a + b + 1, a + b - 1, a, b]), ar: `إذا كان ${a} + ${b} = ${a + b}، فما ناتج ${b} + ${a}؟`, en: `If ${a} + ${b} = ${a + b}, what is ${b} + ${a}?` };
  if (k === 4) {
    // three numbers: two of them make a ten (Grade 1) or a hundred (Grade 2), so add those first
    const whole = grade === 1 ? 10 : 100, x = int(rng, grade === 1 ? 1 : 11, whole - (grade === 1 ? 1 : 11)), y = whole - x, m = int(rng, grade === 1 ? 1 : 11, hi), s = whole + m;
    return { eq: `${x} + ${m} + ${y}`, answer: String(s), wrongs: ints(s, [s + 1, s - 1, s + 10, x + m]), ar: `اجمع بأسهل طريقة: ${x} + ${m} + ${y}`, en: `Add the easiest way: ${x} + ${m} + ${y}` };
  }
  if (k === 0) return { eq: `${a} + ${b}`, answer: String(a), wrongs: ints(a, [b, a + b, a + 1, a - 1]), ar: `أكمل: ${b} + ${a} = ___ + ${b}`, en: `Complete: ${b} + ${a} = ___ + ${b}` };
  if (k === 1) return { eq: `${a} + 0`, answer: String(a), wrongs: ints(a, [0, a + 1, a - 1, 2 * a]), ar: `ما ناتج ${a} + 0؟`, en: `What is ${a} + 0?` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, a + b, c + 1]), ar: `أكمل: (${a} + ${b}) + ${c} = ${a} + (${b} + ___)`, en: `Complete: (${a} + ${b}) + ${c} = ${a} + (${b} + ___)` };
});

const relatedFacts = (id: string, grade: number) => T(id, /^الحقائق المترابطه$/, [grade, grade], ({ rng }) => {
  if (grade === 1) {
    const a = int(rng, 2, 9), b = int(rng, 2, 9), s = a + b, k = pick(rng, [0, 1, 2, 3]);
    if (k === 2) return { eq: `${a}, ${b}, ${s}`, answer: String(a), wrongs: ints(a, [b, s, a + 1, a - 1]), ar: `مثلث الحقائق فيه الأعداد ${a} و ${b} و ${s}. ما ناتج ${s} − ${b}؟`, en: `A fact triangle holds ${a}, ${b} and ${s}. What is ${s} − ${b}?` };
    if (k === 3) return { eq: `${s}, ${a}`, answer: String(b), wrongs: ints(b, [a, s, b + 1, b - 1]), ar: `ما العدد المفقود في حقيقة الطرح: ${s} − ___ = ${a}؟`, en: `What is the missing number in the subtraction fact ${s} − ___ = ${a}?` };
    return k === 0 ? { eq: `${a}, ${b}, ${s}`, answer: String(b), wrongs: ints(b, [a, s, b + 1, b - 1]), ar: `إذا كان ${a} + ${b} = ${s} فإن ${s} − ${a} = ___`, en: `If ${a} + ${b} = ${s} then ${s} − ${a} = ___` } : { eq: `${s}, ${a}, ${b}`, answer: String(s), wrongs: ints(s, [a, b, s + 1, s - 1]), ar: `إذا كان ${s} − ${a} = ${b} فإن ${b} + ${a} = ___`, en: `If ${s} − ${a} = ${b} then ${b} + ${a} = ___` }; }
  const a = int(rng, 2, 9), b = int(rng, 2, 9), p = a * b, k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) return { eq: `${a}, ${b}, ${p}`, answer: String(a), wrongs: ints(a, [b, p, a + 1, a - 1]), ar: `مثلث الحقائق فيه الأعداد ${a} و ${b} و ${p}. ما ناتج ${p} ÷ ${b}؟`, en: `A fact triangle holds ${a}, ${b} and ${p}. What is ${p} ÷ ${b}?` };
  if (k === 3) return { eq: `${b}, ${p}`, answer: String(a), wrongs: ints(a, [b, p, a + 1, p - b]), ar: `ما العدد المفقود في حقيقة الضرب: ___ × ${b} = ${p}؟`, en: `What is the missing number in the multiplication fact ___ × ${b} = ${p}?` };
  return k === 0 ? { eq: `${a}, ${b}, ${p}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `إذا كان ${a} × ${b} = ${p} فإن ${p} ÷ ${a} = ___`, en: `If ${a} × ${b} = ${p} then ${p} ÷ ${a} = ___` } : { eq: `${p}, ${a}, ${b}`, answer: String(p), wrongs: ints(p, [a + b, a, b, p + a]), ar: `إذا كان ${p} ÷ ${a} = ${b} فإن ${b} × ${a} = ___`, en: `If ${p} ÷ ${a} = ${b} then ${b} × ${a} = ___` };
});

const missingNumber = T('missing_number', /^العدد المفقود$/, [1, 1], ({ rng, diff }) => {
  const a = int(rng, 1, span(diff, 9, 12, 15)), b = int(rng, 1, span(diff, 9, 12, 15)), s = a + b, k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 4) {
    // a story: some balls, then b more, and we know how many there are now
    const c = int(rng, 3, 9), t = a + c;
    return { eq: `${c}, ${t}`, answer: String(a), wrongs: ints(a, [t + c, c, t, a + 1]), ar: `كان مع سلمى بعض الكرات، فأعطتها أمها ${c} كرات أخرى فأصبح عدد كراتها ${t}. كم كرة كانت معها؟`, en: `Salma had some balls. Her mother gave her ${c} more and now she has ${t}. How many balls did she have at first?` };
  }
  if (k === 0) return { eq: `${a}, ${s}`, answer: String(b), wrongs: ints(b, [a, s, b + 1, b - 1]), ar: `${a} + ___ = ${s}`, en: `${a} + ___ = ${s}` };
  if (k === 1) return { eq: `${b}, ${s}`, answer: String(a), wrongs: ints(a, [b, s, a + 1, a - 1]), ar: `___ + ${b} = ${s}`, en: `___ + ${b} = ${s}` };
  if (k === 2) return { eq: `${s}, ${b}`, answer: String(a), wrongs: ints(a, [b, s, a + 1, a - 1]), ar: `أكمل جملة الطرح: ${s} − ___ = ${b}`, en: `${s} − ___ = ${b}` };
  return { eq: `${a}, ${b}`, answer: String(s), wrongs: ints(s, [a, b, s + 1, s - 1]), ar: `أكمل جملة الطرح: ___ − ${b} = ${a}`, en: `___ − ${b} = ${a}` };
});

const mentalG1 = (id: string, match: RegExp, add: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) {
    // a two-digit number and a one-digit number, with no regrouping to do in the head
    const t = int(rng, 1, 9), o = add ? int(rng, 0, 7) : int(rng, 2, 9), x = add ? int(rng, 1, 9 - o) : int(rng, 1, o), n = t * 10 + o, r = add ? n + x : n - x;
    return { eq: `${n}, ${x}`, answer: String(r), wrongs: ints(r, [add ? r + 10 : r - 10, add ? n - x : n + x, r + 1, r - 1]), ar: `ما ناتج ${n} ${add ? '+' : '−'} ${x} ذهنيًا؟`, en: `Work out ${n} ${add ? '+' : '−'} ${x} in your head.` };
  }
  if (k === 4) {
    // tens in a money story; both amounts stay at 11 qirsh or more so «قرشًا» is right
    const tens = int(rng, 2, 4) * 10, n = add ? int(rng, 11, 99 - tens) : int(rng, tens + 11, 99), r = add ? n + tens : n - tens;
    return { eq: `${n}, ${tens}`, answer: String(r), wrongs: ints(r, [add ? n - tens : n + tens, add ? r + 10 : r - 10, add ? n + tens / 10 : n - tens / 10, r + 1]), ar: add ? `مع رامي ${n} قرشًا، وأعطاه والده ${tens} قرشًا. كم قرشًا أصبح معه؟` : `مع رامي ${n} قرشًا، أنفق منها ${tens} قرشًا. كم قرشًا بقي معه؟`, en: add ? `Rami has ${n} qirsh and his father gives him ${tens} qirsh. How many qirsh does he have now?` : `Rami has ${n} qirsh and spends ${tens} qirsh. How many qirsh are left?` };
  }
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
  if (k === 0) return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n - 1, n + 2, 2 * n]), ar: `كم ضلعًا ${li(name)}؟`, en: `How many sides does the ${name} have?` };
  if (k === 1) return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n - 1, n + 2, 2 * n]), ar: `كم رأسًا ${li(name)}؟`, en: `How many vertices does the ${name} have?` };
  const uniq = PLANE.filter(([, c]) => c !== 4);
  const [nm, c] = pick(rng, uniq);
  return { eq: `${c}`, answer: nm, wrongs: others(rng, nm, [...uniq.map(u => u[0]), 'المربع']), ar: `أي شكل له ${c} أضلاع و ${c} رؤوس؟`, en: `Which shape has ${c} sides and ${c} vertices?` };
});

const SOLID_FEV: Array<[string, number, number, number]> = [['المكعب', 6, 12, 8], ['متوازي المستطيلات', 6, 12, 8], ['المنشور الثلاثي', 5, 9, 6], ['الهرم الرباعي', 5, 8, 5], ['الهرم الثلاثي', 4, 6, 4]];
const solidParts = T('solid_parts', /^الاحرف والاوجه والرؤوس$/, [2, 2], ({ rng }) => {
  const [name, f, e, v] = pick(rng, SOLID_FEV), k = pick(rng, [0, 1, 2]);
  const [val, ar, en] = k === 0 ? [f, 'وجهًا', 'faces'] : k === 1 ? [e, 'حرفًا', 'edges'] : [v, 'رأسًا', 'vertices'];
  return { eq: name, answer: String(val), wrongs: ints(val, [val + 1, val - 1, val + 2, val * 2, f + e + v]), ar: `كم ${ar} ${li(name)}؟`, en: `How many ${en} does the ${name} have?` };
});

const SHAPES3 = ['◯', '△', '□', '◇'];
const SHAPES_AR: Record<string, string> = { '◯': 'دائرة', '△': 'مثلث', '□': 'مربع', '◇': 'معين' };
const geoPattern = T('geo_pattern', /^الانماط الهندسيه$/, [1, 4], ({ rng, grade, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (grade <= 2) {
    const len = pick(rng, [2, 3]), unit = shuffle(rng, SHAPES3).slice(0, len);
    const NAMES = ' (دائرة = circle, مثلث = triangle, مربع = square, معين = diamond)';
    if (k === 1) {
      // the unit of the pattern: how many shapes before it repeats
      const shown = Array.from({ length: len * 3 }, (_, i) => unit[i % len]!);
      return { eq: shown.join(' '), answer: String(len), wrongs: ints(len, [len * 3, len + 1, len - 1, len * 2]), ar: `كم شكلًا في وحدة النمط: ${shown.join(' ')}؟`, en: `How many shapes are in the repeating unit of the pattern ${shown.join(' ')}?` };
    }
    const shown = Array.from({ length: len * 2 + 1 }, (_, i) => unit[i % len]!);
    if (k === 2) {
      // a position beyond the part shown, found from the unit
      const pos = int(rng, len * 2 + 3, 12), at = unit[(pos - 1) % len]!;
      return { eq: shown.join(' '), answer: SHAPES_AR[at]!, wrongs: SHAPES3.filter(s => s !== at).map(s => SHAPES_AR[s]!), ar: `يستمر النمط: ${shown.join(' ')} … ما الشكل رقم ${pos} فيه؟ (اكتب اسمه)`, en: `The pattern ${shown.join(' ')} … keeps going. Which shape is number ${pos}?${NAMES}` };
    }
    const next = unit[(len * 2 + 1) % len]!;
    return { eq: shown.join(' '), answer: SHAPES_AR[next]!, wrongs: SHAPES3.filter(s => s !== next).map(s => SHAPES_AR[s]!), ar: `ما الشكل التالي في النمط: ${shown.join(' ')} ___ ؟ (اكتب اسمه)`, en: `What shape comes next in the pattern ${shown.join(' ')} ___ ? (name it: دائرة = circle, مثلث = triangle, مربع = square, معين = diamond)` };
  }
  const first = int(rng, 3, 6), d = int(rng, 2, span(diff, 3, 4, 6)), n = int(rng, 5, 7), kind = pick(rng, [0, 1, 2]);
  if (kind === 1) {
    // the table of a growing pattern with one output missing
    const outs = [1, 2, 3, 4, 5].map(i => first + (i - 1) * d), gap = int(rng, 1, 3), ans = outs[gap]!;
    const cells = outs.map((v, i) => `${i + 1} ← ${i === gap ? '___' : v}`);
    return { eq: outs.join(', '), answer: String(ans), wrongs: ints(ans, [ans + d, ans - d, ans + 1, outs[gap - 1]! + 1]), ar: `جدول المدخلات والمخرجات لنمط هندسي، المدخل رقم الشكل والمخرج عدد المربعات فيه: ${cells.join('، ')}. ما العدد المفقود في الجدول؟`, en: `Input–output table of a geometric pattern (input: figure number, output: number of squares in it): ${outs.map((v, i) => `${i + 1} → ${i === gap ? '___' : v}`).join(', ')}. What is the missing number in the table?` };
  }
  if (kind === 2) {
    // a square of squares: figure m is m rows of m, so it does not grow by the same amount each time
    const m = int(rng, 4, span(diff, 6, 8, 10)), sq = m * m;
    return { eq: `${m}`, answer: String(sq), wrongs: ints(sq, [4 * m, (m - 1) * (m - 1), 2 * m, sq + m, sq - 1]), ar: `في نمط من المربعات، الشكل 1 مربع واحد، والشكل 2 مربع كبير من 4 مربعات (2 × 2)، والشكل 3 مربع كبير من 9 مربعات (3 × 3). كم مربعًا صغيرًا في الشكل ${m}؟`, en: `In a pattern of squares, figure 1 is one square, figure 2 is a big square of 4 squares (2 × 2) and figure 3 a big square of 9 squares (3 × 3). How many small squares are in figure ${m}?` };
  }
  const t = [1, 2, 3].map(i => first + (i - 1) * d), ans = first + (n - 1) * d;
  const head = `في نمط من الأعواد، الشكل 1 فيه ${t[0]} أعواد والشكل 2 فيه ${t[1]} والشكل 3 فيه ${t[2]}.`;
  const headEn = `In a matchstick pattern, figure 1 has ${t[0]} sticks, figure 2 has ${t[1]} and figure 3 has ${t[2]}.`;
  if (k === 1) return { eq: t.join(', '), answer: String(d), wrongs: ints(d, [first, d + 1, d - 1, t[1]!]), ar: `${head} بكم عودًا يزيد كل شكل على الشكل الذي قبله؟`, en: `${headEn} By how many sticks does each figure grow?` };
  if (k === 2) { const m = int(rng, 5, 9), v = first + (m - 1) * d; return { eq: t.join(', '), answer: String(m), wrongs: ints(m, [m + 1, m - 1, Math.round(v / d), v - first]), ar: `${head} ما رقم الشكل الذي عدد أعواده ${v}؟`, en: `${headEn} Which figure has ${v} sticks?` }; }
  return { eq: t.join(', '), answer: String(ans), wrongs: ints(ans, [ans + d, ans - d, first * n, ans + 1]), ar: `${head} كم عودًا في الشكل ${n}؟`, en: `${headEn} How many sticks are in figure ${n}?` };
});

// ─── fractions ──────────────────────────────────────────────────────────────

const halfQuarter = (id: string, match: RegExp, name: 'نصف' | 'ربع') => T(id, match, [1, 1], ({ rng }) => {
  const d = name === 'نصف' ? 2 : 4, q = int(rng, 1, name === 'نصف' ? 10 : 5), n = d * q, k = pick(rng, [0, 0, 1, 2, 3]);
  const nameEn = name === 'نصف' ? 'half' : 'a quarter';
  if (k === 2) {
    // a share of a few balls: 4–10 of them, so «كرات» is the right plural
    const qq = name === 'نصف' ? int(rng, 2, 5) : int(rng, 1, 2), m = d * qq;
    return { eq: `${m}`, answer: String(qq), wrongs: ints(qq, [m, m - qq, qq + 1, qq - 1]), ar: `مع سامي ${m} كرات، أعطى ${name}ها لأخيه. كم كرة أعطى أخاه؟`, en: `Sami has ${m} balls and gives ${nameEn} of them to his brother. How many balls does he give?` };
  }
  if (k === 3) return { eq: `${q}`, answer: String(n), wrongs: ints(n, [q, n + d, n - d, q + d]), ar: `ما العدد الذي ${name}ه ${q}؟`, en: `Which number has ${q} as its ${name === 'نصف' ? 'half' : 'quarter'}?` };
  if (k === 0) return { eq: `${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q, 2 * q]), ar: `ما ${name} العدد ${n}؟`, en: `What is ${nameEn} of ${n}?` };
  return { eq: name, answer: String(d), wrongs: ints(d, [d + 1, d - 1, 2 * d, 3]), ar: `كم ${name === 'نصف' ? 'نصفًا' : 'ربعًا'} في الكل الواحد؟`, en: `How many ${name === 'نصف' ? 'halves' : 'quarters'} make one whole?` };
});
const PARTS: Array<[number, string]> = [[2, 'نصف'], [3, 'ثلث'], [4, 'ربع']];
/** «جزأين متطابقين» / «3 أجزاء متطابقة» */
const sameParts = (d: number) => (d === 2 ? 'جزأين متطابقين' : `${d} أجزاء متطابقة`);
const equalParts = T('equal_parts', /^الاجزاء المتطابقه$/, [1, 1], ({ rng }) => {
  const [d, name] = pick(rng, PARTS), k = pick(rng, [0, 1, 2]);
  if (k === 1) return { eq: `${d}`, answer: String(d - 1), wrongs: ints(d - 1, [d, d + 1, d - 2, 2 * d]), ar: `قُسّمت قطعة بيتزا إلى ${sameParts(d)}، وأُكل جزء واحد منها. كم جزءًا بقي؟`, en: `A pizza is cut into ${d} equal parts and one part is eaten. How many parts are left?` };
  if (k === 2) {
    const q = int(rng, 2, 5), n = d * q;
    return { eq: `${n}, ${d}`, answer: String(q), wrongs: ints(q, [n, n - d, q + 1, q - 1, d]), ar: `قطار مكعبات عددها ${n} قُسّم إلى ${sameParts(d)}. كم مكعبًا في كل جزء؟`, en: `A train of ${n} cubes is split into ${d} equal parts. How many cubes are in each part?` };
  }
  return { eq: `${d}`, answer: name, wrongs: [...PARTS.map(p => p[1]).filter(x => x !== name), 'كل'], ar: `قُسّمت قطعة بيتزا إلى ${sameParts(d)}. ماذا يسمّى كل جزء منها؟`, en: `A pizza is cut into ${d} equal parts. What is each part called? (نصف = half, ثلث = third, ربع = quarter)` };
});
const PART_NAMES = ['النصف', 'الثلث', 'الربع'];
const fractionOfSetG1 = T('fraction_of_set_g1', /^الكسر كجزء من مجموعه$/, [1, 1], ({ rng }) => {
  // at least 3 balls in the group, so it is «4 كرات» or «12 كرةً», never «2 كرات»
  const [d, name] = pick(rng, PARTS), q = int(rng, d === 2 ? 2 : 1, d === 2 ? 8 : d === 3 ? 4 : 3), n = d * q, k = pick(rng, [0, 1, 2]);
  const named = `ال${name}`;
  if (k === 1) {
    // the part is known, find the whole group
    return { eq: `${name}, ${q}`, answer: String(n), wrongs: ints(n, [q, q + d, n + q, n - q, n + d]), ar: `أخذ سامي ${name} الكرات التي في الصندوق، فكان معه ${balls(q)}. كم كرة كانت في الصندوق؟`, en: `Sami took ${name === 'نصف' ? 'half' : name === 'ثلث' ? 'a third' : 'a quarter'} of the balls in the box and had ${q}. How many balls were in the box?` };
  }
  if (k === 2) {
    // name the part: q of n is a half, a third or a quarter
    return { eq: `${q}, ${n}`, answer: named, wrongs: [...PART_NAMES.filter(x => x !== named), 'الكل'], ar: `في مجموعة ${balls(n)}، منها ${redBalls(q)}. ما الجزء الذي تمثله الكرات الحمراء من المجموعة: النصف أم الثلث أم الربع؟`, en: `A group has ${n} balls and ${q} of them are red. What part of the group are the red balls: a half, a third or a quarter? (النصف = half, الثلث = third, الربع = quarter)` };
  }
  return { eq: `${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q]), ar: `في مجموعة ${balls(n)}، كم كرة في ${name} المجموعة؟`, en: `A group has ${n} balls. How many balls are in ${name === 'نصف' ? 'half' : name === 'ثلث' ? 'a third' : 'a quarter'} of the group?` };
});
const fractionOfSetG3 = T('fraction_of_set_g3', /^الكسر كجزء من مجموعه$/, [3, 3], ({ rng, diff }) => {
  const d = pick(rng, [2, 3, 4, 5, 6, 8, 10]), q = int(rng, 1, span(diff, 4, 6, 9)), n = d * q, a = int(rng, 1, d - 1), kind = pick(rng, [0, 1, 2]);
  if (kind === 2) {
    // two colours in a bag: the whole is not given, it is both colours together
    let r = 0, b = 0, red = true;
    do { r = int(rng, 1, 7); b = int(rng, 1, 7); red = rng() < 0.5; } while (r + b < 3 || r + b > 10 || gcd(red ? r : b, r + b) !== 1);
    const top = red ? r : b, all = r + b, ans = `${top}/${all}`;
    return { eq: `${r}, ${b}`, answer: ans, wrongs: wrongsFrom(ans, [`${top}/${all - top}`, `${all - top}/${all}`, `${all}/${top}`, `${top}/${all + 1}`], j => `${top}/${all + 1 + Math.abs(j)}`), ar: `في كيس ${redBalls(r)} و${b > 2 ? ' ' : ''}${blueBalls(b)}. ما الكسر الذي يمثل الكرات ${red ? 'الحمراء' : 'الزرقاء'} من كرات الكيس كلها؟`, en: `A bag holds ${r} red ball${r === 1 ? '' : 's'} and ${b} blue ball${b === 1 ? '' : 's'}. What fraction of all the balls in the bag are ${red ? 'red' : 'blue'}?` };
  }
  if (kind === 1) return { eq: `${a}/${d}, ${n}`, answer: String(a * q), wrongs: ints(a * q, [q, n - a * q, a + n / d, n - q]), ar: `ما ${a}/${d} من العدد ${n}؟`, en: `What is ${a}/${d} of ${n}?` };
  // a class of 3–10 students («طلاب»), some of them in hats; ask for those with or without one
  const c = pick(rng, [3, 4, 5, 6, 8, 10]); let k = int(rng, 1, c - 1); while (gcd(k, c) !== 1) k = int(rng, 1, c - 1);
  const without = rng() < 0.5, top = without ? c - k : k;
  const head = `في صف ${c} طلاب، يلبس ${k === 1 ? 'واحد' : k} منهم قبعة.`;
  const ans = `${top}/${c}`;
  return { eq: `${k}, ${c}`, answer: ans, wrongs: wrongsFrom(ans, [`${c - top}/${c}`, `${top}/${c - top}`, `${c}/${top}`, `${top + 1}/${c}`], j => `${top + Math.abs(j) + 1}/${c + 1}`), ar: `${head} ما الكسر الذي يمثل الطلاب الذين ${without ? 'لا يلبسون' : 'يلبسون'} قبعة؟`, en: `A class has ${c} students and ${k} of them wear a hat. What fraction of the students ${without ? 'do not wear' : 'wear'} a hat?` };
});
const unitFraction = T('unit_fraction', /^كسر الوحده$/, [2, 2], ({ rng }) => {
  const d = int(rng, 3, 10), k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${d}`, answer: `1/${d}`, wrongs: wrongsFrom(`1/${d}`, [`${d}/1`, `1/${d + 1}`, `${d - 1}/${d}`, `2/${d}`], j => `1/${d + 1 + Math.abs(j)}`), ar: `ما كسر الوحدة الذي يمثل جزءًا واحدًا من ${d} أجزاء متساوية؟`, en: `Which unit fraction stands for one of ${d} equal parts?` };
  if (k === 2) return { eq: `1/${d}`, answer: String(d), wrongs: ints(d, [1, d + 1, d - 1, 2 * d]), ar: `إلى كم جزءًا متساويًا قُسّم الكل إذا كان كل جزء منه 1/${d}؟`, en: `Into how many equal parts is a whole cut if each part is 1/${d}?` };
  if (k === 3) return { eq: `${d}`, answer: `1/${d}`, wrongs: wrongsFrom(`1/${d}`, [`${d}/1`, `${d - 1}/${d}`, `1/${d - 1}`, `1/${d + 1}`], j => `1/${d + 1 + Math.abs(j)}`), ar: `قُسّمت كعكة إلى ${d} قطع متساوية، وأخذ سامي قطعة واحدة منها. ما الكسر الذي يمثل ما أخذه سامي؟`, en: `A cake is cut into ${d} equal pieces and Sami takes one piece. What fraction of the cake does Sami take?` };
  let e = int(rng, 2, 10); while (e === d) e = int(rng, 2, 10);
  const big = Math.min(d, e), small = Math.max(d, e);
  return { eq: `1/${d}, 1/${e}`, answer: `1/${big}`, wrongs: wrongsFrom(`1/${big}`, [`1/${small}`, `1/${small + 1}`, `1/${big + small}`], j => `1/${small + 1 + Math.abs(j)}`), ar: `أي الكسرين أكبر: 1/${d} أم 1/${e}؟ (اكتب الكسر الأكبر)`, en: `Which fraction is larger, 1/${d} or 1/${e}? (write the larger one)` };
});
const unitFractionOfSet = T('unit_fraction_set', /^كسر الوحده كجزء من مجموعه$/, [2, 2], ({ rng }) => {
  const d = pick(rng, [2, 3, 4, 5, 6, 10]), k = pick(rng, [0, 1, 2]);
  if (k === 1) {
    // at least 11 apples, so «تفاحة» is the right form after the number
    const q = int(rng, Math.max(2, Math.ceil(11 / d)), 9), n = d * q;
    return { eq: `1/${d}, ${n}`, answer: String(q), wrongs: ints(q, [n, n - q, q + 1, q - 1, d]), ar: `في سلة ${n} تفاحة، 1/${d} منها حمراء. كم تفاحة حمراء في السلة؟`, en: `A basket holds ${n} apples and 1/${d} of them are red. How many red apples are there?` };
  }
  if (k === 2) {
    // the part is known: 3–9 balls, find the whole group
    const q = int(rng, 3, 9), n = d * q;
    return { eq: `1/${d}, ${q}`, answer: String(n), wrongs: ints(n, [q, q + d, n + q, n - q]), ar: `إذا كان 1/${d} مجموعة من الكرات يساوي ${q} كرات، فكم كرة في المجموعة كلها؟`, en: `If 1/${d} of a group of balls is ${q} balls, how many balls are in the whole group?` };
  }
  const q = int(rng, 2, 9), n = d * q;
  return { eq: `1/${d}, ${n}`, answer: String(q), wrongs: ints(q, [n, q + 1, q - 1, n - q, d]), ar: `ما 1/${d} من العدد ${n}؟`, en: `What is 1/${d} of ${n}?` };
});
const wholeFraction = T('fraction_of_whole', /^الكسر كجزء من كل$/, [3, 3], ({ rng }) => {
  const d = pick(rng, [3, 4, 5, 6, 8, 10]); let k = int(rng, 1, d - 1); while (gcd(k, d) !== 1) k = int(rng, 1, d - 1);
  const kind = pick(rng, [0, 1, 2, 3]);
  if (kind === 1) { const u = d - k, ans = `${u}/${d}`; return { eq: `${k}, ${d}`, answer: ans, wrongs: wrongsFrom(ans, [`${k}/${d}`, `${u}/${k}`, `${d}/${u}`, `${u}/${d + 1}`], j => `${u + Math.abs(j) + 1}/${d + 1}`), ar: `قُسّم شكل إلى ${d} أجزاء متساوية ولُوّن ${k} منها. ما الكسر الذي يمثل الجزء غير الملوّن؟`, en: `A shape is split into ${d} equal parts and ${k} are coloured. What fraction is not coloured?` }; }
  if (kind === 2) return { eq: `${k}/${d}`, answer: String(d), wrongs: ints(d, [k, d - k, d + k, d + 1]), ar: `ما مقام الكسر ${k}/${d}؟`, en: `What is the denominator of ${k}/${d}?` };
  if (kind === 3) return { eq: `${k}/${d}`, answer: String(k), wrongs: ints(k, [d, d - k, k + 1, d + k]), ar: `يمثل الكسر ${k}/${d} الجزء الملوّن من شكل. كم جزءًا لُوّن؟`, en: `The fraction ${k}/${d} shows the coloured part of a shape. How many parts are coloured?` };
  return { eq: `${k}, ${d}`, answer: `${k}/${d}`, wrongs: wrongsFrom(`${k}/${d}`, [`${d - k}/${d}`, `${k}/${d - k}`, `${d}/${k}`, `${k}/${d + 1}`], j => `${k + Math.abs(j) + 1}/${d + 1}`), ar: `قُسّم شكل إلى ${d} أجزاء متساوية ولُوّن ${k} منها. ما الكسر الذي يمثل الجزء الملوّن؟`, en: `A shape is split into ${d} equal parts and ${k} are coloured. What fraction is coloured?` };
});
const fractionOne = T('fraction_equals_one', /^الكسور المساويه للواحد$/, [3, 3], ({ rng }) => {
  const n = int(rng, 3, 10), k = pick(rng, [0, 1, 2]);
  if (k === 1) return { eq: `___/${n}`, answer: String(n), wrongs: ints(n, [1, n - 1, n + 1, 2 * n]), ar: `أكمل ليكون الكسر مساويًا للواحد: ___/${n}`, en: `Fill in the blank so the fraction equals one: ___/${n}` };
  if (k === 2) return { eq: `${n}`, answer: String(n), wrongs: ints(n, [1, n - 1, n + 1, 0]), ar: `قُسّم شريط إلى ${n} أجزاء متساوية. كم جزءًا نلوّن ليكون الجزء الملوّن هو الشريط كله؟`, en: `A strip is cut into ${n} equal parts. How many parts must be coloured to colour the whole strip?` };
  // the fractions are in the stem, so the question reads the same with or without options
  const pool = shuffle(rng, [[n, n], [n - 1, n], [n, n + 1], [n + 1, n]] as Array<[number, number]>), list = pool.map(([a, b]) => `${a}/${b}`);
  return { eq: list.join(', '), answer: `${n}/${n}`, wrongs: list.filter(f => f !== `${n}/${n}`), ar: `أي الكسور الآتية يساوي 1: ${list.join('، ')}؟`, en: `Which of these fractions equals 1: ${list.join(', ')}?` };
});
const fractionLine = T('fraction_number_line', /^الكسور علي خط الاعداد$/, [3, 3], ({ rng }) => {
  const d = pick(rng, [4, 5, 6, 8, 10]); let k = int(rng, 1, d - 1); while (gcd(k, d) !== 1) k = int(rng, 1, d - 1);
  const kind = pick(rng, [0, 1, 2]);
  if (kind === 1) return { eq: `${k}/${d}`, answer: String(k), wrongs: ints(k, [d, d - k, k + 1, k - 1]), ar: `قُسّمت المسافة بين 0 و 1 على خط الأعداد إلى ${d} أجزاء متساوية. كم جزءًا نعدّ بدءًا من الصفر لنصل إلى الكسر ${k}/${d}؟`, en: `The distance from 0 to 1 on a number line is split into ${d} equal parts. How many parts do we count from zero to reach ${k}/${d}?` };
  if (kind === 2) {
    // the next mark: an odd prime denominator keeps both neighbours in lowest terms
    const p = pick(rng, [3, 5, 7]), m = int(rng, 1, p - 2), ans = `${m + 1}/${p}`;
    return { eq: `${m}/${p}`, answer: ans, wrongs: wrongsFrom(ans, [`${m}/${p}`, `${m + 1}/${p + 1}`, `${m + 2}/${p}`, `${m}/${m + 1}`], j => `${m + 1}/${p + 1 + Math.abs(j)}`), ar: `قُسّمت المسافة بين 0 و 1 على خط الأعداد إلى ${p} أجزاء متساوية. ما الكسر الذي يقع مباشرة بعد الكسر ${m}/${p}؟`, en: `The distance from 0 to 1 on a number line is split into ${p} equal parts. Which fraction comes right after ${m}/${p}?` };
  }
  return { eq: `${k}, ${d}`, answer: `${k}/${d}`, wrongs: wrongsFrom(`${k}/${d}`, [`${d - k}/${d}`, `${k}/${d - k}`, `${k + 1}/${d}`, `${d}/${k}`], j => `${k + Math.abs(j) + 1}/${d + 1}`), ar: `قُسّمت المسافة بين 0 و 1 على خط الأعداد إلى ${d} أجزاء متساوية. ما الكسر الذي يدل على النقطة الواقعة بعد ${k} من هذه الأجزاء بدءًا من الصفر؟`, en: `The distance from 0 to 1 on a number line is split into ${d} equal parts. Which fraction marks the point ${k} parts from zero?` };
});

// ─── Grade 2: numbers and mental arithmetic ─────────────────────────────────

const numberLineG2 = T('number_line_g2', /^تمثيل الاعداد علي خط الاعداد$/, [2, 2], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const a = 10 * int(rng, 1, span(diff, 8, 20, 40)), gap = 20 * int(rng, 1, 4); return { eq: `${a}, ${a + gap}`, answer: String(a + gap / 2), wrongs: ints(a + gap / 2, [a + gap, a, a + gap / 2 + 10, a + gap / 2 - 10]), ar: `ما العدد الذي يقع في منتصف المسافة بين ${a} و ${a + gap} على خط الأعداد؟`, en: `Which number is exactly halfway between ${a} and ${a + gap} on a number line?` }; }
  if (k === 2) {
    // a number line from one hundred to the next, marked in tens
    const a = 100 * int(rng, 1, 8), j = int(rng, 3, 9), v = a + 10 * j;
    return { eq: `${a}, ${j}`, answer: String(v), wrongs: ints(v, [a + j, a + 10 * (j + 1), a + 10 * (j - 1), a + 100 - 10 * j]), ar: `خط أعداد يبدأ من ${a} وينتهي عند ${a + 100}، وقُسّم إلى 10 أقسام متساوية. ما العدد الذي يقع بعد ${j} أقسام من ${a}؟`, en: `A number line from ${a} to ${a + 100} is split into 10 equal parts. Which number is ${j} parts after ${a}?` };
  }
  if (k === 3) {
    const h = int(rng, 1, 8), n = 100 * h + int(rng, 1, 99), pair = (x: number) => `${x} و ${x + 100}`, ans = pair(100 * h);
    return { eq: `${n}`, answer: ans, wrongs: wrongsFrom(ans, [pair(100 * h + 100), h > 1 ? pair(100 * h - 100) : `0 و 100`, `${100 * h} و ${n % 100 === 50 ? 100 * h + 10 : 100 * h + 50}`], j => pair(100 * (h + Math.abs(j) + 1))), ar: `بين أي مئتين متتاليتين يقع العدد ${n} على خط الأعداد؟`, en: `Between which two consecutive hundreds does ${n} lie on a number line?` };
  }
  const s = pick(rng, [5, 10]), a = s * int(rng, 1, 9), j = int(rng, 3, 6);
  return { eq: `${a}, ${s}, ${j}`, answer: String(a + s * j), wrongs: ints(a + s * j, [a + j, a + s, a + s * (j + 1), a + s * (j - 1)]), ar: `ابدأ من ${a} على خط الأعداد واقفز ${j} قفزات، طول كل قفزة ${s}. عند أي عدد تصل؟`, en: `Start at ${a} on a number line and take ${j} jumps of ${s}. Which number do you reach?` };
});

const mentalMultiples = (id: string, match: RegExp, add: boolean, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const place = pick(rng, grade === 2 ? [10, 100] : [10, 100, 1000]), k = pick(rng, [0, 1, 2, 3]), op = add ? '+' : '−';
  if (k > 0) {
    // a 3-digit (Grade 2) or 4-digit (Grade 3) number, and a multiple of `place` that changes only that digit — so it is done in the head
    const lo = grade === 2 ? 100 : 1000, hi = grade === 2 ? 999 : 9999;
    let N = 0, dg = 0;
    do { N = int(rng, lo, hi); dg = Math.floor(N / place) % 10; } while (add ? dg > 8 : dg < 1 || N === place);
    // never take N down to nothing (200 − 200): when N is only that digit, stop one short of it
    const b = int(rng, 1, add ? 9 - dg : N === dg * place ? dg - 1 : dg), m = b * place, R = add ? N + m : N - m;
    const wrongR = ints(R, [add ? N - m : N + m, add ? R + place : R - place, add ? N + b : N - b, add ? R - place : R + place]);
    if (k === 1) return { eq: `${N}, ${m}`, answer: String(R), wrongs: wrongR, ar: `ما ناتج ${N} ${op} ${m} ذهنيًا؟`, en: `Work out ${N} ${op} ${m} in your head.` };
    if (k === 2) return { eq: `${N}, ${m}`, answer: String(R), wrongs: wrongR, ar: `ما العدد الذي ${add ? 'يزيد على' : 'يقل عن'} ${N} بمقدار ${m}؟`, en: `Which number is ${m} ${add ? 'more' : 'less'} than ${N}?` };
    return { eq: `${N}, ${R}`, answer: String(m), wrongs: ints(m, [b, m * 10, m / 10, m + place, R]), ar: `أي عدد ${add ? 'نضيفه إلى' : 'نطرحه من'} ${N} لنحصل على ${R}؟`, en: `Which number do we ${add ? 'add to' : 'take away from'} ${N} to get ${R}?` };
  }
  let a = 0, b = 0;
  // Grade 2 works within three places, so 900 + 600 is out of reach there
  do { a = int(rng, 1, 9); b = int(rng, 1, 9); } while (add ? grade === 2 && place === 100 && a + b > 9 : a <= b);
  const x = a * place, y = b * place, r = add ? x + y : x - y;
  return { eq: `${x}, ${y}`, answer: String(r), wrongs: ints(r, [r * 10, r / 10, add ? x - y : x + y, r + place]), ar: `${x} ${op} ${y} = ___`, en: `${x} ${op} ${y} = ___` };
});

const equalGroups = (id: string, match: RegExp) => T(id, match, [2, 2], ({ rng }) => {
  const g = int(rng, 2, 5), n = int(rng, 2, 6), t = g * n, k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${g}, ${n}`, answer: String(t), wrongs: ints(t, [g + n, t + g, t - n, g * g]), ar: `${g} مجموعات متساوية، في كل منها ${n} أقلام. كم قلمًا في المجموع؟`, en: `There are ${g} equal groups with ${n} pencils in each. How many pencils are there in all?` };
  if (k === 1) return { eq: `${t}, ${g}`, answer: String(n), wrongs: ints(n, [t, g, n + 1, t - g]), ar: `وُزّعت ${t} قطع بالتساوي على ${g} مجموعات. كم قطعة في كل مجموعة؟`, en: `${t} pieces are shared equally among ${g} groups. How many pieces are in each group?` };
  return { eq: `${t}, ${n}`, answer: String(g), wrongs: ints(g, [t, n, g + 1, t - n]), ar: `${t} قطع، وُضع في كل مجموعة ${n} قطع. كم مجموعة تكوّنت؟`, en: `${t} pieces are put into groups of ${n}. How many groups are made?` };
});

const divisionRelation = T('division_relation', /^العلاقه بين القسمه والضرب$|^علاقه القسمه بالضرب$/, [2, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), p = a * b, k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${a}, ${b}, ${p}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `إذا كان ${a} × ${b} = ${p} فإن ${p} ÷ ${a} = ___`, en: `If ${a} × ${b} = ${p} then ${p} ÷ ${a} = ___` };
  if (k === 2) return { eq: `${a}, ${p}`, answer: String(b), wrongs: ints(b, [a, p, p - a, b + 1]), ar: `ما العدد الذي إذا ضُرب في ${a} كان الناتج ${p}؟`, en: `Which number multiplied by ${a} gives ${p}?` };
  return { eq: `${p}, ${a}, ${b}`, answer: String(b), wrongs: ints(b, [a, p, b + 1, b - 1]), ar: `أكمل: ${p} ÷ ${a} = ___ لأن ___ × ${a} = ${p}`, en: `Complete: ${p} ÷ ${a} = ___ because ___ × ${a} = ${p}` };
});

// ─── Grade 3 multiplication and division ────────────────────────────────────

const mulProps = T('mul_properties', /^خواص الضرب$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), c = int(rng, 2, 9), k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${a} × ${b}`, answer: String(a), wrongs: ints(a, [b, a * b, a + 1, a - 1]), ar: `أكمل باستعمال خاصية التبديل: ${b} × ${a} = ___ × ${b}`, en: `Complete using the commutative property: ${b} × ${a} = ___ × ${b}` };
  if (k === 1) return { eq: `${a} × 1`, answer: String(a), wrongs: ints(a, [1, 0, a + 1, 2 * a]), ar: `ما ناتج ${a} × 1؟`, en: `What is ${a} × 1?` };
  if (k === 2) return { eq: `${a} × 0`, answer: '0', wrongs: ints(0, [a, 1, 2 * a, a - 1]), ar: `ما ناتج ${a} × 0؟`, en: `What is ${a} × 0?` };
  if (k === 3) return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, c + 1, b + c]), ar: `أكمل باستعمال خاصية التوزيع: ${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ___`, en: `Complete using the distributive property: ${a} × (${b} + ${c}) = ${a} × ${b} + ${a} × ___` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(c), wrongs: ints(c, [b, a, c + 1, a * b]), ar: `أكمل باستعمال خاصية التجميع: (${a} × ${b}) × ${c} = ${a} × (${b} × ___)`, en: `Complete using the associative property: (${a} × ${b}) × ${c} = ${a} × (${b} × ___)` };
});

const divProps = T('div_properties', /^خواص القسمه$/, [3, 3], ({ rng }) => {
  const n = int(rng, 2, 9), k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${n * 3} ÷ 1`, answer: String(n * 3), wrongs: ints(n * 3, [1, 0, n, n * 3 + 1]), ar: `ما ناتج ${n * 3} ÷ 1؟`, en: `What is ${n * 3} ÷ 1?` };
  if (k === 1) return { eq: `${n} ÷ ${n}`, answer: '1', wrongs: ints(1, [0, n, 2, n - 1]), ar: `ما ناتج قسمة العدد ${n} على نفسه؟`, en: `What do you get when you divide ${n} by itself?` };
  if (k === 3) { const m = n * 3; return { eq: `${m} ÷ ___ = ${m}`, answer: '1', wrongs: ints(1, [0, m, 2, 10]), ar: `أكمل: ${m} ÷ ___ = ${m}`, en: `Complete: ${m} ÷ ___ = ${m}` }; }
  return { eq: `0 ÷ ${n}`, answer: '0', wrongs: ints(0, [1, n, 2 * n, n - 1]), ar: `ما ناتج 0 ÷ ${n}؟`, en: `What is 0 ÷ ${n}?` };
});

/** Sharing stories: «قطع حلوى عددها 23» keeps the noun clear of the number's agreement. */
const shareAr = (n: number, d: number) => `وُزّعت قطع حلوى عددها ${n} بالتساوي على ${d} أطفال.`;
const shareEn = (n: number, d: number) => `${n} sweets are shared equally among ${d} children.`;

const remainder = T('remainder', /^الباقي$/, [3, 3], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]), d = int(rng, k === 2 ? 3 : 2, span(diff, 5, 7, 9)), q = int(rng, 2, 9), r = int(rng, 1, d - 1), n = d * q + r;
  if (k === 2) return { eq: `${n}, ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d]), ar: `${shareAr(n, d)} كم قطعة بقيت؟`, en: `${shareEn(n, d)} How many are left over?` };
  if (k === 3) return { eq: `${d}, ${q}, ${r}`, answer: String(n), wrongs: ints(n, [d * q, d * q - r, q * r + d, n + d]), ar: `ما العدد الذي إذا قُسم على ${d} كان الخارج ${q} والباقي ${r}؟`, en: `Which number divided by ${d} gives ${q} with remainder ${r}?` };
  return k === 0
    ? { eq: `${n}, ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d, n % (d + 1)]), ar: `ما الباقي عند قسمة ${n} على ${d}؟`, en: `What is the remainder when ${n} is divided by ${d}?` }
    : { eq: `${n}, ${d}`, answer: String(q), wrongs: ints(q, [r, q + 1, q - 1, n - r]), ar: `ما خارج قسمة ${n} على ${d} (من دون الباقي)؟`, en: `What is the whole-number quotient of ${n} ÷ ${d} (ignoring the remainder)?` };
});
/**
 * A two-digit number divided by a one-digit number, as the lesson titles say:
 * the quotient has two digits (`twoDigit`) or one, with or without a remainder.
 */
const divisionQ = (id: string, match: RegExp, twoDigit: boolean, withRemainder: boolean) => T(id, match, [3, 3], ({ rng }) => {
  const k = pick(rng, withRemainder ? [0, 1, 2, 3, 4] : [0, 2, 4]);
  let d = 0, q = 0, r = 0, n = 0;
  do {
    d = int(rng, k === 2 || k === 3 ? 3 : 2, 9);
    q = twoDigit ? int(rng, 10, withRemainder ? Math.floor(100 / d) - 1 : Math.floor(99 / d)) : int(rng, 2, 9);
    r = withRemainder ? int(rng, 1, d - 1) : 0;
    n = d * q + r;
  } while (n < 10);
  if (k === 2) return { eq: `${n} ÷ ${d}`, answer: String(q), wrongs: ints(q, [q + 1, q - 1, r || q + 10, n - d, d]), ar: `${shareAr(n, d)} كم قطعة أخذ كل طفل؟`, en: `${shareEn(n, d)} How many does each child get?` };
  if (k === 3) return { eq: `${n} ÷ ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d]), ar: `${shareAr(n, d)} كم قطعة بقيت؟`, en: `${shareEn(n, d)} How many are left over?` };
  if (k === 4) return withRemainder
    ? { eq: `${d}, ${q}, ${r}`, answer: String(n), wrongs: ints(n, [d * q, d * q - r, n + d, q + d + r]), ar: `ما العدد الذي إذا قُسم على ${d} كان الخارج ${q} والباقي ${r}؟`, en: `Which number divided by ${d} gives ${q} with remainder ${r}?` }
    : { eq: `${d}, ${q}`, answer: String(n), wrongs: ints(n, [d + q, n + d, n - d, n + 10]), ar: `ما العدد الذي إذا قُسم على ${d} كان الناتج ${q}؟`, en: `Which number divided by ${d} gives ${q}?` };
  if (!withRemainder) return { eq: `${n} ÷ ${d}`, answer: String(q), wrongs: ints(q, [q + 1, q - 1, q + 10, n - d, q * 10]), ar: `ما ناتج ${n} ÷ ${d}؟`, en: `What is ${n} ÷ ${d}?` };
  return k === 0
    ? { eq: `${n} ÷ ${d}`, answer: String(q), wrongs: ints(q, [q + 1, q - 1, r, q + 10, n - d]), ar: `ما خارج قسمة ${n} على ${d}؟ (من دون الباقي)`, en: `What is the quotient of ${n} ÷ ${d}? (ignore the remainder)` }
    : { eq: `${n} ÷ ${d}`, answer: String(r), wrongs: ints(r, [q, d - r, r + 1, d]), ar: `ما الباقي عند قسمة ${n} على ${d}؟`, en: `What is the remainder of ${n} ÷ ${d}?` };
});

const tensMulG3 = T('tens_mul_g3', /^الضرب في مضاعفات العدد 10$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), b = int(rng, 2, 9), p = a * b * 10, k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) return { eq: `${a} × ${b * 10}`, answer: String(p), wrongs: ints(p, [a * b, p * 10, a * b + 10, p + 10]), ar: `إذا كان ${a} × ${b} = ${a * b}، فما ناتج ${a} × ${b * 10}؟`, en: `If ${a} × ${b} = ${a * b}, what is ${a} × ${b * 10}?` };
  if (k === 3) { const c = int(rng, 3, 9), v = c * b * 10; return { eq: `${c} × ${b * 10}`, answer: String(v), wrongs: ints(v, [c * b, v * 10, c + b * 10, v + b * 10]), ar: `في كل صندوق ${b * 10} قلمًا. كم قلمًا في ${c} صناديق؟`, en: `Each box holds ${b * 10} pencils. How many pencils are in ${c} boxes?` }; }
  return k === 0 ? { eq: `${a} × ${b * 10}`, answer: String(p), wrongs: ints(p, [a * b, a * b * 100, a + b * 10, p + 10]), ar: `ما ناتج ${a} × ${b * 10}؟`, en: `What is ${a} × ${b * 10}?` } : { eq: `${b * 10} × ${a}`, answer: String(p), wrongs: ints(p, [a * b, a * b * 100, a + b * 10, p - 10]), ar: `ما ناتج ${b * 10} × ${a}؟`, en: `What is ${b * 10} × ${a}?` };
});
const tensDivG3 = T('tens_div_g3', /^قسمه مضاعفات العدد 10$/, [3, 3], ({ rng }) => {
  const k = pick(rng, [0, 1, 2]), d = int(rng, k === 2 ? 3 : 2, 9), q = int(rng, 2, 9), n = d * q * 10;
  const wrongs = ints(q * 10, [q, q * 100, n - d, q * 10 + 10]);
  if (k === 1) return { eq: `${n} ÷ ${d}`, answer: String(q * 10), wrongs, ar: `إذا كان ${d * q} ÷ ${d} = ${q}، فما ناتج ${n} ÷ ${d}؟`, en: `If ${d * q} ÷ ${d} = ${q}, what is ${n} ÷ ${d}?` };
  if (k === 2) return { eq: `${n} ÷ ${d}`, answer: String(q * 10), wrongs, ar: `وُزّعت أقلام عددها ${n} بالتساوي على ${d} صناديق. كم قلمًا في كل صندوق؟`, en: `${n} pencils are shared equally among ${d} boxes. How many pencils are in each box?` };
  return { eq: `${n} ÷ ${d}`, answer: String(q * 10), wrongs, ar: `ما ناتج ${n} ÷ ${d}؟`, en: `What is ${n} ÷ ${d}?` };
});
const distributive = T('mul_distribute', /^الضرب باستعمال خاصيه التوزيع$/, [3, 3], ({ rng }) => {
  const a = int(rng, 2, 9), t = int(rng, 1, 5) * 10, o = int(rng, 2, 9), n = t + o, k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: `${a} × ${n}`, answer: String(o), wrongs: ints(o, [t, n, o + 1, a]), ar: `أكمل: ${a} × ${n} = ${a} × ${t} + ${a} × ___`, en: `Complete: ${a} × ${n} = ${a} × ${t} + ${a} × ___` };
  if (k === 2) return { eq: `${a} × ${n}`, answer: String(a * o), wrongs: ints(a * o, [o, a + o, a * n, a * o + 10]), ar: `أكمل الناتجين الجزئيين: ${a} × ${n} = ${a * t} + ___`, en: `Complete the partial products: ${a} × ${n} = ${a * t} + ___` };
  if (k === 3) { const c = int(rng, 3, 9); return { eq: `${c} × ${n}`, answer: String(c * n), wrongs: ints(c * n, [c * t, c * t + o, c + n, c * n + c]), ar: `في قاعة ${c} صفوف، في كل صف ${n} كرسيًا. كم كرسيًا في القاعة؟ (استعمل خاصية التوزيع)`, en: `A hall has ${c} rows with ${n} chairs in each row. How many chairs are in the hall? (use the distributive property)` }; }
  return { eq: `${a} × ${n}`, answer: String(a * n), wrongs: ints(a * n, [a * t, a * t + o, a + n, a * n + a]), ar: `استعمل خاصية التوزيع لإيجاد ${a} × ${n} = ${a} × ${t} + ${a} × ${o}`, en: `Use the distributive property to find ${a} × ${n} = ${a} × ${t} + ${a} × ${o}` };
});
const mulNoRegroup = (id: string, match: RegExp, regroup: boolean) => T(id, match, [3, 3], ({ rng }) => {
  const kind = pick(rng, regroup ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]);
  for (let i = 0; i < 400; i++) {
    const k = int(rng, kind === 1 ? 3 : 2, 6), t = int(rng, 1, 9), o = int(rng, 1, 9);
    const carry = o * k >= 10;
    if (carry !== regroup) continue;
    const n = t * 10 + o, r = n * k;
    if (!regroup && t * k >= 10) continue;
    if (kind === 1) return { eq: `${n} × ${k}`, answer: String(r), wrongs: ints(r, [r + 10, r - 10, t * k * 10 + o, n + k]), ar: `في صندوق ${n} قلمًا. كم قلمًا في ${k} صناديق مثله؟`, en: `A box holds ${n} pencils. How many pencils are in ${k} such boxes?` };
    if (kind === 2) { const u = r % 10; return { eq: `${n} × ${k}`, answer: String(u), wrongs: ints(u, [o * k, Math.floor(r / 10) % 10, o, (u + 1) % 10, (u + 9) % 10]), ar: `ما رقم الآحاد في ناتج ${n} × ${k}؟`, en: `What is the ones digit of ${n} × ${k}?` }; }
    if (kind === 3) { const tn = Math.floor(r / 10) % 10; return { eq: `${n} × ${k}`, answer: String(tn), wrongs: ints(tn, [t * k, r % 10, t, (tn + 1) % 10, (tn + 9) % 10]), ar: `ما رقم العشرات في ناتج ${n} × ${k}؟`, en: `What is the tens digit of ${n} × ${k}?` }; }
    if (kind === 4) { const c = Math.floor((o * k) / 10); return { eq: `${o} × ${k}`, answer: String(c), wrongs: ints(c, [(o * k) % 10, o * k, c + 1, t]), ar: `عند ضرب ${n} × ${k}، نضرب الآحاد أولًا: ${o} × ${k} = ${o * k}. كم عشرة نُعيد تجميعها إلى منزلة العشرات؟`, en: `To multiply ${n} × ${k}, multiply the ones first: ${o} × ${k} = ${o * k}. How many tens are regrouped into the tens place?` }; }
    return { eq: `${n} × ${k}`, answer: String(r), wrongs: ints(r, [r + 10, r - 10, t * k * 10 + o, r + k, n + k]), ar: `ما ناتج ${n} × ${k}؟`, en: `What is ${n} × ${k}?` };
  }
  return { eq: '12 × 3', answer: '36', wrongs: ['26', '46', '15'], ar: 'ما ناتج 12 × 3؟', en: 'What is 12 × 3?' };
});

const twoWay = T('two_way_table', /^الجدول ذو الاتجاهين$/, [3, 3], ({ rng }) => {
  // 3–9 in each cell, so «أولاد» / «بنات» is always the right plural
  const bt = int(rng, 3, 9), bj = int(rng, 3, 9), gt = int(rng, 3, 9), gj = int(rng, 3, 9), kind = pick(rng, [0, 1, 2]);
  if (kind === 1) {
    // a cell is missing and the row total is given: total − the other cell
    const cell = int(rng, 0, 3), v = [bt, bj, gt, gj], ans = v[cell]!, other = v[cell ^ 1]!, show = (i: number) => (i === cell ? '___' : String(v[i]));
    return { eq: `${bt}, ${bj}, ${gt}, ${gj}`, answer: String(ans), wrongs: ints(ans, [ans + other, ans + 2 * other, other, ans + 1, ans - 1]), ar: `جدول ذو اتجاهين عن المشروب المفضل: الأولاد: الشاي ${show(0)}، العصير ${show(1)}، المجموع ${bt + bj}. البنات: الشاي ${show(2)}، العصير ${show(3)}، المجموع ${gt + gj}. ما العدد المفقود في الجدول؟`, en: `A two-way table of favourite drinks: boys: tea ${show(0)}, juice ${show(1)}, total ${bt + bj}. Girls: tea ${show(2)}, juice ${show(3)}, total ${gt + gj}. What is the missing number in the table?` };
  }
  if (kind === 2) {
    // add along each row, then compare the rows
    const fb = bt, fg = gt, sb = bj, sg = gj, f = fb + fg, w = sb + sg;
    if (f === w) return twoWay.make({ rng, diff: 'easy', grade: 3 });
    const footballMore = f > w, diff = Math.abs(f - w);
    return { eq: `${fb}, ${fg}, ${sb}, ${sg}`, answer: String(diff), wrongs: ints(diff, [f + w, Math.abs(fb - sb), Math.abs(fg - sg), diff + 1, diff - 1]), ar: `جدول ذو اتجاهين عن الرياضة المفضلة: كرة القدم يحبها ${fb} أولاد و ${fg} بنات، والسباحة يحبها ${sb} أولاد و ${sg} بنات. بكم يزيد عدد محبي ${footballMore ? 'كرة القدم' : 'السباحة'} على عدد محبي ${footballMore ? 'السباحة' : 'كرة القدم'}؟`, en: `A two-way table of favourite sports: football is liked by ${fb} boys and ${fg} girls, swimming by ${sb} boys and ${sg} girls. How many more like ${footballMore ? 'football than swimming' : 'swimming than football'}?` };
  }
  const head = `في صف: ${bt} أولاد يحبون الشاي و ${bj} أولاد يحبون العصير، و ${gt} بنات يحببن الشاي و ${gj} بنات يحببن العصير`;
  const headEn = `In a class: ${bt} boys like tea and ${bj} boys like juice; ${gt} girls like tea and ${gj} girls like juice`;
  const k = pick(rng, [0, 1, 2, 3]);
  const [v, ar, en] = k === 0 ? [bt + bj, 'كم ولدًا في الصف؟', 'How many boys are in the class?'] : k === 1 ? [gt + gj, 'كم بنتًا في الصف؟', 'How many girls are in the class?'] : k === 2 ? [bj + gj, 'كم طالبًا يحبون العصير؟', 'How many students like juice?'] : [bt + bj + gt + gj, 'كم طالبًا في الصف؟', 'How many students are in the class?'];
  return { eq: `${bt}, ${bj}, ${gt}, ${gj}`, answer: String(v), wrongs: ints(v, [v + 1, v - 1, bt + gt, bj + gt, v + 2]), ar: `${head}. ${ar}`, en: `${headEn}. ${en}` };
});

// ─── lines, angles ──────────────────────────────────────────────────────────

const LINE_PARTS: Array<[string, number]> = [['القطعة المستقيمة', 2], ['الشعاع', 1], ['المستقيم', 0]];
const LINE_DESC: Array<[string, string, string]> = [
  ['جزء من المستقيم له نقطتا نهاية', 'قطعة مستقيمة', 'a part of a line with two endpoints'],
  ['جزء من المستقيم له نقطة بداية واحدة، ويمتد بلا نهاية في اتجاه واحد', 'شعاع', 'a part of a line with one starting point that goes on forever in one direction'],
  ['خط مستقيم يمتد بلا نهاية في الاتجاهين، وليس له نقطة نهاية', 'مستقيم', 'a straight line that goes on forever both ways and has no endpoint'],
  ['شكل يحدّد موقعًا، وليس له طول', 'نقطة', 'a mark that shows a place and has no length'],
];
/** «قطعة مستقيمة واحدة / قطعتان مستقيمتان / 3 قطع مستقيمة» and the same for rays and lines. */
const segs = (n: number) => (n === 1 ? 'قطعة مستقيمة واحدة' : n === 2 ? 'قطعتان مستقيمتان' : `${n} قطع مستقيمة`);
const rays = (n: number) => (n === 1 ? 'شعاع واحد' : n === 2 ? 'شعاعان' : `${n} أشعة`);
const lines = (n: number) => (n === 1 ? 'مستقيم واحد' : n === 2 ? 'مستقيمان' : `${n} مستقيمات`);
const pointLineRay = T('point_line_ray', /^النقطه والمستقيم والشعاع$/, [3, 3], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2]);
  if (kind === 1) {
    // from the description to the name
    const [desc, ans, en] = pick(rng, LINE_DESC);
    return { eq: desc, answer: ans, wrongs: LINE_DESC.map(l => l[1]).filter(x => x !== ans), ar: `${desc}. ماذا يسمّى هذا الشكل؟`, en: `${en} (Arabic). What is it called? (نقطة = point, مستقيم = line, شعاع = ray, قطعة مستقيمة = line segment)` };
  }
  if (kind === 2) {
    // endpoints of a whole drawing: 2 for each segment, 1 for each ray, none for a line
    const sg = int(rng, 1, 4), ry = int(rng, 1, 4), ln = int(rng, 0, 2), ans = 2 * sg + ry;
    const parts = [segs(sg), rays(ry), ...(ln ? [lines(ln)] : [])];
    return { eq: `${sg}, ${ry}, ${ln}`, answer: String(ans), wrongs: ints(ans, [sg + ry + ln, sg + ry, 2 * sg + ry + 2 * ln, ans + 1, ans - 1]), ar: `في رسم ${parts.map((x, i) => (i === 0 ? x : /^\d/.test(x) ? ` و ${x}` : ` و${x}`)).join('')}، ولا يلتقي أي منها بغيره. كم نقطة نهاية في الرسم كله؟`, en: `A drawing has ${sg} line segment${sg === 1 ? '' : 's'}, ${ry} ray${ry === 1 ? '' : 's'}${ln ? ` and ${ln} line${ln === 1 ? '' : 's'}` : ''}, none touching another. How many endpoints are in the whole drawing?` };
  }
  const [name, n] = pick(rng, LINE_PARTS);
  return { eq: name, answer: String(n), wrongs: ints(n, [n + 1, n + 2, 3, n === 0 ? 4 : n - 1]), ar: `كم نقطة نهاية ${li(name)}؟`, en: `How many endpoints does ${name === 'الشعاع' ? 'a ray' : name === 'المستقيم' ? 'a line' : 'a line segment'} have?` };
});

const ANGLE_NAMES = ['حادة', 'قائمة', 'منفرجة'];
const angleG3 = T('angle_kind_g3', /^الزوايا$/, [3, 3], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2]), measure = (t: number) => (t === 0 ? 5 * int(rng, 2, 17) : t === 1 ? 90 : 5 * int(rng, 19, 35)), a = kind === 0 ? int(rng, 10, 85) : kind === 1 ? 90 : int(rng, 95, 175);
  const ask = pick(rng, [0, 1, 2]);
  if (ask === 2) {
    // the hands of a clock on the hour: 30° for each hour between them (never 6:00, a straight angle)
    const h = pick(rng, [1, 2, 3, 4, 5, 7, 8, 9, 10, 11]), deg = Math.min(30 * h, 360 - 30 * h), t = deg < 90 ? 0 : deg === 90 ? 1 : 2;
    return { eq: `${h}:00`, answer: ANGLE_NAMES[t]!, wrongs: [...ANGLE_NAMES.filter((_, i) => i !== t), 'مستقيمة'], ar: `تشير الساعة إلى ${h}:00. ما نوع الزاوية الصغرى بين عقربي الساعة؟`, en: `A clock shows ${h}:00. What kind of angle is the smaller angle between its hands? (حادة = acute, قائمة = right, منفرجة = obtuse, مستقيمة = straight)` };
  }
  if (ask === 1) {
    // four measures, exactly one of the asked kind
    const list = new Set<number>([measure(kind)]);
    while (list.size < 4) list.add(measure(pick(rng, [0, 1, 2].filter(t => t !== kind && (t !== 1 || !list.has(90))))));
    const xs = shuffle(rng, [...list]), ans = xs.find(x => (x < 90 ? 0 : x === 90 ? 1 : 2) === kind)!;
    return { eq: xs.join(', '), answer: `${ans}°`, wrongs: xs.filter(x => x !== ans).map(x => `${x}°`), ar: `أي القياسات الآتية قياس زاوية ${ANGLE_NAMES[kind]}: ${xs.map(x => `${x}°`).join('، ')}؟`, en: `Which of these is the measure of a${kind === 0 ? 'n acute' : kind === 1 ? ' right' : 'n obtuse'} angle: ${xs.map(x => `${x}°`).join(', ')}?` };
  }
  return { eq: `${a}°`, answer: ANGLE_NAMES[kind]!, wrongs: [...ANGLE_NAMES.filter((_, i) => i !== kind), 'مستقيمة'], ar: `زاوية قياسها ${a}°. ما نوعها؟`, en: `An angle measures ${a}°. What kind is it? (حادة = acute, قائمة = right, منفرجة = obtuse, مستقيمة = straight)` };
});

const LINE_REL: Array<[string, string]> = [['مستقيمان لا يلتقيان مهما امتدّا', 'متوازيان'], ['مستقيمان يلتقيان في نقطة واحدة وزاوية التقاطع بينهما قائمة', 'متعامدان'], ['مستقيمان يلتقيان في نقطة واحدة وزاوية التقاطع بينهما ليست قائمة', 'متقاطعان']];
const LINE_THINGS: Array<[string, string, string]> = [
  ['قضيبا سكة القطار', 'متوازيان', 'the two rails of a railway track'],
  ['الحافتان الطويلتان للمسطرة', 'متوازيان', 'the two long edges of a ruler'],
  ['حافتان متجاورتان لصفحة الكتاب', 'متعامدان', 'two edges of a book page that meet at a corner'],
  ['خطّا إشارة الجمع (+)', 'متعامدان', 'the two strokes of a plus sign (+)'],
  ['شفرتا المقص وهو مفتوح قليلًا', 'متقاطعان', 'the two blades of a pair of scissors opened a little'],
];
const lineRelations = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2]), NAMES = ['متوازيان', 'متعامدان', 'متقاطعان'];
  if (kind === 1) {
    // a pair of lines in the things around us
    const [thing, ans, en] = pick(rng, LINE_THINGS);
    return { eq: thing, answer: ans, wrongs: [...NAMES.filter(x => x !== ans), 'منحنيان'], ar: `${thing}: هل هما متوازيان أم متعامدان أم متقاطعان؟`, en: `${en} (Arabic): are they parallel, perpendicular or intersecting? (متوازيان = parallel, متعامدان = perpendicular, متقاطعان = intersecting)` };
  }
  if (kind === 2) {
    // two crossing lines make four angles: all right if perpendicular, else two acute and two obtuse
    const perp = rng() < 0.5, ask = pick(rng, ANGLE_NAMES), ans = perp ? (ask === 'قائمة' ? 4 : 0) : ask === 'قائمة' ? 0 : 2;
    return { eq: `${perp}, ${ask}`, answer: String(ans), wrongs: ints(ans, [4, 2, 0, 1, 3].filter(x => x !== ans)), ar: `${perp ? 'مستقيمان متعامدان يتقاطعان في نقطة.' : 'مستقيمان يتقاطعان في نقطة، وليسا متعامدين.'} كم زاوية ${ask} تتكوّن حول نقطة التقاطع؟`, en: `${perp ? 'Two perpendicular lines cross at a point.' : 'Two lines cross at a point and are not perpendicular.'} How many ${ask === 'حادة' ? 'acute' : ask === 'قائمة' ? 'right' : 'obtuse'} angles are formed around the crossing point?` };
  }
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
  const k = pick(rng, [0, 1, 2, 3]);
  const rule = `${up ? '+' : '−'}${d}`;
  if (k === 2) return { eq: seq.join(', '), answer: String(seq[2]), wrongs: ints(seq[2]!, [seq[2]! + d, seq[2]! - d, seq[1]! + 1, seq[3]! + d]), ar: `ما العدد المفقود في النمط: ${seq[0]}، ${seq[1]}، ___، ${seq[3]}؟`, en: `What is the missing number in the pattern ${seq[0]}, ${seq[1]}, ___, ${seq[3]}?` };
  if (k === 3) {
    // the rule is given: build the pattern from its first number to the fifth
    const fifth = up ? seq[0]! + 4 * d : seq[0]! - 4 * d;
    return { eq: `${seq[0]}, ${rule}`, answer: String(fifth), wrongs: ints(fifth, [up ? fifth + d : fifth - d, up ? fifth - d : fifth + d, up ? seq[0]! + 5 * d : seq[0]! - 5 * d, seq[0]! + d]), ar: `نمط يبدأ بالعدد ${seq[0]}، وقاعدته «${up ? 'أضف' : 'اطرح'} ${d}». ما العدد الخامس في النمط؟`, en: `A pattern starts at ${seq[0]} and its rule is «${up ? 'add' : 'subtract'} ${d}». What is the fifth number in the pattern?` };
  }
  if (k === 0) return { eq: seq.join(', '), answer: String(next), wrongs: ints(next, [next + d, next - d, seq[3]! + 1, up ? next - 1 : next + 1]), ar: `ما العدد التالي في النمط: ${seq.join('، ')}، ___؟`, en: `What number comes next in the pattern ${seq.join(', ')}, ___?` };
  return { eq: seq.join(', '), answer: rule, wrongs: wrongsFrom(rule, [`${up ? '−' : '+'}${d}`, `${up ? '+' : '−'}${d + 1}`, `${up ? '+' : '−'}${d - 1 > 0 ? d - 1 : d + 2}`, `×${d}`], j => `${up ? '+' : '−'}${d + 1 + Math.abs(j)}`), ar: `ما قاعدة النمط: ${seq.join('، ')}؟`, en: `What is the rule of the pattern ${seq.join(', ')}?` };
});

const inputOutput = T('input_output', /^جداول المدخلات والمخرجات$/, [4, 4], ({ rng, diff }) => {
  const mul = rng() < 0.5, c = int(rng, 2, span(diff, 5, 8, 9));
  const f = (x: number) => (mul ? x * c : x + c);
  const xs = shuffle(rng, [1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, 4);
  const [x1, x2, x3, q] = xs as [number, number, number, number];
  const rule = mul ? `ضرب في ${c}` : `جمع ${c}`;
  if (rng() < 0.3) {
    // work backwards: the rule and an output are known, find the input
    const y = f(q);
    return { eq: `${rule}, ${y}`, answer: String(q), wrongs: ints(q, mul ? [y * c, y - c, y, q + 1] : [y + c, y, q + 1, q - 1]), ar: `جدول مدخلات ومخرجات قاعدته «${rule}». ما المدخل إذا كان المخرج ${y}؟`, en: `An input–output table has the rule «${mul ? `multiply by ${c}` : `add ${c}`}». What is the input when the output is ${y}?` };
  }
  if (rng() < 0.7) return { eq: `${x1}, ${x2}, ${x3}, ${q}`, answer: String(f(q)), wrongs: ints(f(q), [mul ? q + c : q * c, f(q) + 1, f(q) - 1, f(q) + c]), ar: `جدول مدخلات ومخرجات: المدخل ${x1} ← المخرج ${f(x1)}، والمدخل ${x2} ← المخرج ${f(x2)}، والمدخل ${x3} ← المخرج ${f(x3)}. ما المخرج عندما يكون المدخل ${q}؟`, en: `Input–output table: input ${x1} gives output ${f(x1)}, input ${x2} gives ${f(x2)}, input ${x3} gives ${f(x3)}. What is the output when the input is ${q}?` };
  const alt = mul ? `جمع ${c}` : `ضرب في ${c}`;
  return { eq: `${x1}, ${x2}`, answer: rule, wrongs: [alt, mul ? `ضرب في ${c + 1}` : `جمع ${c + 1}`, `طرح ${c}`], ar: `جدول مدخلات ومخرجات: المدخل ${x1} ← المخرج ${f(x1)}، والمدخل ${x2} ← المخرج ${f(x2)}. ما القاعدة؟`, en: `Input–output table: input ${x1} gives output ${f(x1)} and input ${x2} gives ${f(x2)}. What is the rule? (جمع = add, ضرب في = multiply by)` };
});

const decimalMoney = T('decimal_money', /^الاعداد العشريه والنقود$/, [4, 4], ({ rng, diff }) => {
  const a = int(rng, 105, span(diff, 450, 900, 1900)), b = int(rng, 105, span(diff, 450, 900, 1900)), k = pick(rng, [0, 1, 2]);
  // Prices are never a whole number of dinars (that would print «2 دينارًا»); the amount
  // paid is, and takes the counted noun: «5 دنانير», «15 دينارًا».
  if (a % 100 === 0 || b % 100 === 0) return decimalMoney.make({ rng, diff, grade: 4 });
  const dec = (v: number) => fmtDec(v, 2);
  const money = (v: number) => (v % 100 === 0 ? dinars(v / 100) : `${dec(v)} دينارًا`);
  if (k === 0) return { eq: `${dec(a)}, ${dec(b)}`, answer: dec(a + b), wrongs: wrongsFrom(dec(a + b), [dec(a + b + 10), dec(a + b - 10), dec(Math.abs(a - b)), dec(a + b + 100)], j => dec(a + b + Math.abs(j))), ar: `اشترى سامر قلمًا بـ ${dec(a)} دينارًا ودفترًا بـ ${dec(b)} دينارًا. كم دينارًا دفع؟`, en: `Sami bought a pen for ${dec(a)} dinars and a notebook for ${dec(b)} dinars. How many dinars did he pay?` };
  if (k === 1) { const pay = Math.ceil((a + 1) / 500) * 500, change = pay - a; return { eq: `${dec(pay)}, ${dec(a)}`, answer: dec(change), wrongs: wrongsFrom(dec(change), [dec(change + 10), dec(change > 10 ? change - 10 : change + 20), dec(pay + a), dec(change + 50)], j => dec(change + Math.abs(j))), ar: `دفع خالد ${money(pay)} ثمن سلعة ثمنها ${dec(a)} دينارًا. كم دينارًا يستردّ؟`, en: `Khaled pays ${dec(pay)} dinars for an item costing ${dec(a)} dinars. How many dinars does he get back?` }; }
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
  const d = int(rng, 2, 9), k = pick(rng, [0, 1, 2, 2, 3, 3]);
  if (k === 2) {
    // change from one dinar: 100 − the price
    const p = 5 * int(rng, 3, 19);
    return { eq: `100, ${p}`, answer: String(100 - p), wrongs: ints(100 - p, [p, 100 + p, 100 - p + 10, 100 - p - 10]), ar: `اشترت ليلى دفترًا بـ ${qirsh(p)}، ودفعت للبائع دينارًا واحدًا. كم قرشًا يعيد لها البائع؟ (الدينار الواحد = 100 قرش)`, en: `Layla buys a notebook for ${p} qirsh and pays one dinar. How many qirsh change does she get? (1 dinar = 100 qirsh)` };
  }
  if (k === 3) {
    // a price in dinars, money in qirsh: how much more is needed
    const price = int(rng, 2, 5), m = 10 * int(rng, 1, 9), have = price * 100 - m;
    return { eq: `${price}, ${have}`, answer: String(m), wrongs: ints(m, [100 - m, m + 100, m + 10, m - 10]), ar: `ثمن لعبة ${dinars(price)}، ومع رامي ${qirsh(have)}. كم قرشًا ينقصه ليشتري اللعبة؟ (الدينار الواحد = 100 قرش)`, en: `A toy costs ${price} dinars and Rami has ${have} qirsh. How many more qirsh does he need to buy it? (1 dinar = 100 qirsh)` };
  }
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
  const i = int(rng, 0, 6), k = pick(rng, [0, 1, 2, 3, 3, 4, 4]);
  if (k === 3) {
    // a day's place in the week
    const ans = ORD[i]!;
    return { eq: DAYS[i]!, answer: ans, wrongs: [ORD[(i + 1) % 7]!, ORD[(i + 6) % 7]!, ORD[(i + 2) % 7]!], ar: `إذا بدأ الأسبوع بيوم الأحد، فما ترتيب يوم ${DAYS[i]} بين أيام الأسبوع؟`, en: `If the week starts on Sunday, what is the place of ${DAYS[i]} in the week? (answer with an Arabic ordinal: الأول = first, الثاني = second, …)` };
  }
  if (k === 4) {
    // two steps from yesterday to tomorrow (or back)
    const fwd = rng() < 0.5, ans = DAYS[(i + (fwd ? 2 : 5)) % 7]!;
    return { eq: DAYS[i]!, answer: ans, wrongs: [DAYS[(i + (fwd ? 1 : 6)) % 7]!, DAYS[i]!, DAYS[(i + (fwd ? 3 : 4)) % 7]!], ar: fwd ? `إذا كان أمس يوم ${DAYS[i]}، فما اليوم غدًا؟` : `إذا كان غدًا يوم ${DAYS[i]}، فما اليوم أمس؟`, en: fwd ? `If yesterday was ${DAYS[i]}, what day is tomorrow? (Arabic day names)` : `If tomorrow is ${DAYS[i]}, what day was yesterday? (Arabic day names)` };
  }
  if (k === 0) return { eq: DAYS[i]!, answer: DAYS[(i + 1) % 7]!, wrongs: others(rng, DAYS[(i + 1) % 7]!, DAYS), ar: `ما اليوم الذي يأتي بعد يوم ${DAYS[i]}؟ (الأسبوع يبدأ بالأحد)`, en: `Which day comes after ${DAYS[i]}? (the week starts on Sunday)` };
  if (k === 1) return { eq: DAYS[i]!, answer: DAYS[(i + 6) % 7]!, wrongs: others(rng, DAYS[(i + 6) % 7]!, DAYS), ar: `ما اليوم الذي يأتي قبل يوم ${DAYS[i]}؟ (الأسبوع يبدأ بالأحد)`, en: `Which day comes before ${DAYS[i]}? (the week starts on Sunday)` };
  return { eq: '', answer: '7', wrongs: ['5', '6', '10'], ar: 'كم يومًا في الأسبوع؟', en: 'How many days are in a week?' };
});

/** How the hour is read aloud: «السابعة والنصف». */
const HOUR_W = ['الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
const hourTime = (id: string, match: RegExp, half: boolean) => T(id, match, [1, 1], ({ rng }) => {
  const h = int(rng, 1, 11), j = int(rng, 1, 3), hh = (h + j - 1) % 12 + 1;
  const pad = (m: number) => String(m).padStart(2, '0');
  if (!half) {
    const k = pick(rng, [0, 1, 2]);
    if (k === 1) {
      // the hands on a clock face, described: minute hand on 12, hour hand on a number
      const ans = `${h}:00`;
      return { eq: ans, answer: ans, wrongs: wrongsFrom(ans, [`12:${pad(5 * h)}`, `${h}:12`, `${h % 12 + 1}:00`, `${(h + 10) % 12 + 1}:00`], q => `${(h + Math.abs(q)) % 12 + 1}:00`), ar: `عقرب الدقائق عند العدد 12، وعقرب الساعات عند العدد ${h}. ما الوقت؟`, en: `The minute hand points to 12 and the hour hand points to ${h}. What time is it?` };
    }
    if (k === 2) {
      // from one whole hour to another, on the same morning or afternoon
      const s = int(rng, 1, 9), d = int(rng, 1, Math.min(4, 12 - s)), e = s + d;
      return { eq: `${s}:00, ${e}:00`, answer: String(d), wrongs: ints(d, [e, s + e, d + 1, d + 2, d - 1]), ar: `بدأ سامي اللعب الساعة ${s}:00 وانتهى الساعة ${e}:00. كم ساعة لعب؟`, en: `Sami started playing at ${s}:00 and stopped at ${e}:00. How many hours did he play?` };
    }
    return { eq: `${h}:00, ${j}`, answer: `${hh}:00`, wrongs: wrongsFrom(`${hh}:00`, [`${h}:00`, `${hh % 12 + 1}:00`, `${(hh + 10) % 12 + 1}:00`, `${h}:30`], k => `${(hh + Math.abs(k)) % 12 + 1}:00`), ar: `الساعة الآن ${h}:00. ما الوقت بعد ${j === 1 ? 'ساعة واحدة' : j === 2 ? 'ساعتين' : '3 ساعات'}؟`, en: `It is ${h}:00 now. What time will it be in ${j} hour${j === 1 ? '' : 's'}?` };
  }
  const k = pick(rng, [0, 1, 2, 3, 3]);
  if (k === 3) {
    // a digital clock read aloud
    const g = int(rng, 1, 12), ans = `${HOUR_W[g - 1]} والنصف`;
    return { eq: `${g}:30`, answer: ans, wrongs: [`${HOUR_W[g % 12]} والنصف`, `${HOUR_W[g - 1]} تمامًا`, `${HOUR_W[(g + 10) % 12]} والنصف`], ar: `تعرض ساعة رقمية الوقت ${g}:30. كيف نقرأ هذا الوقت؟`, en: `A digital clock shows ${g}:30. How do we say this time in Arabic?` };
  }
  if (k === 1) {
    // the hands of a clock face, described: hour hand halfway between h and the next hour, minute hand on 6
    const g = int(rng, 1, 12), next = g % 12 + 1;
    return { eq: `${g}:30`, answer: `${g}:30`, wrongs: wrongsFrom(`${g}:30`, [`${next}:30`, `${g}:06`, `6:${String((g * 5) % 60).padStart(2, '0')}`, `${g}:00`], j => `${(g + Math.abs(j)) % 12 + 1}:30`), ar: `عقرب الساعات بين ${g} و ${next}، وعقرب الدقائق عند العدد 6. ما الوقت؟`, en: `The hour hand is between ${g} and ${next} and the minute hand points to 6. What time is it?` };
  }
  if (k === 2) return { eq: `${h}:30`, answer: `${h}:00`, wrongs: wrongsFrom(`${h}:00`, [`${h}:30`, `${h % 12 + 1}:00`, `${(h + 10) % 12 + 1}:30`, `${h}:15`], j => `${(h + Math.abs(j)) % 12 + 1}:00`), ar: `تشير الساعة إلى ${h}:30. ما الوقت قبل نصف ساعة؟`, en: `A clock shows ${h}:30. What time was it half an hour earlier?` };
  return { eq: `${h}:00`, answer: `${h}:30`, wrongs: wrongsFrom(`${h}:30`, [`${h}:00`, `${h % 12 + 1}:00`, `${h}:15`, `${h % 12 + 1}:30`], k => `${(h + Math.abs(k)) % 12 + 1}:30`), ar: `الساعة الآن ${h}:00. ما الوقت بعد نصف ساعة؟`, en: `It is ${h}:00 now. What time will it be in half an hour?` };
});

const nearestMinutes = (id: string, match: RegExp, step: 5 | 15) => T(id, match, [2, 2], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2]);
  if (kind > 0) {
    // the minute hand on a number of the clock face: each number is 5 minutes on from the last
    const h = int(rng, 1, 12), m = step * int(rng, 1, 60 / step - 1), mark = m / 5, next = h % 12 + 1;
    const fmt = (x: number, y: number) => `${x}:${String(y).padStart(2, '0')}`;
    if (kind === 1) return { eq: fmt(h, m), answer: fmt(h, m), wrongs: wrongsFrom(fmt(h, m), [fmt(next, m), fmt(h, mark), fmt(h, (m + step) % 60 || step)], j => fmt(h, (m + step * (Math.abs(j) + 1)) % 60)), ar: `عقرب الساعات بين ${h} و ${next}، وعقرب الدقائق عند العدد ${mark}. ما الوقت؟`, en: `The hour hand is between ${h} and ${next} and the minute hand points to ${mark}. What time is it?` };
    return { eq: `${mark}`, answer: String(m), wrongs: ints(m, [mark, m + 5, m - 5, mark * 10]), ar: `يشير عقرب الدقائق إلى العدد ${mark}. كم دقيقة مضت بعد رأس الساعة؟`, en: `The minute hand points to ${mark}. How many minutes past the hour is it?` };
  }
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
  const a = int(rng, 5, 11), b = int(rng, 1, 9), k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) return { eq: `${b + 12}`, answer: String(b), wrongs: ints(b, [b + 12, b + 2, b + 1, b - 1]), ar: `الساعة ${b + 12}:00 بنظام 24 ساعة. كم تكون الساعة بعد الظهر؟ (اكتب العدد قبل «:00»)`, en: `It is ${b + 12}:00 in 24-hour time. What time is it in the afternoon? (write the number before ':00')` };
  if (k === 3) {
    // a morning start that runs past noon
    const s = int(rng, 7, 11), len = int(rng, Math.max(3, 13 - s), 10), end = s + len - 12;
    return { eq: `${s}, ${len}`, answer: String(end), wrongs: ints(end, [s + len, end + 1, end - 1, len]), ar: `بدأت رحلة الساعة ${s}:00 قبل الظهر واستمرت ${len} ساعات. في أي ساعة بعد الظهر انتهت؟ (اكتب العدد قبل «:00»)`, en: `A trip starts at ${s}:00 a.m. and lasts ${len} hours. At what hour p.m. does it end? (write the number before ':00')` };
  }
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

/**
 * A thing measured in a big non-standard unit, and the big unit is two small
 * ones: how many small units is it? (3–7 big units, so the plural noun fits.)
 */
const UNIT_STORY: Record<string, (n: number) => [string, string]> = {
  length: n => [`طول طاولة ${n} أقلام طويلة، وطول القلم الطويل يساوي طول قلمين قصيرين. كم قلمًا قصيرًا طول الطاولة؟`, `A table is ${n} long pencils long, and a long pencil is as long as two short pencils. How many short pencils long is the table?`],
  mass: n => [`كتلة حقيبة ${n} مكعبات كبيرة، وكتلة المكعب الكبير تساوي كتلة مكعبين صغيرين. كم مكعبًا صغيرًا كتلة الحقيبة؟`, `A bag has the mass of ${n} big cubes, and a big cube has the mass of two small cubes. How many small cubes is the mass of the bag?`],
  capacity: n => [`سعة دلو ${n} أكواب كبيرة، وسعة الكوب الكبير تساوي سعة كوبين صغيرين. كم كوبًا صغيرًا سعة الدلو؟`, `A bucket holds ${n} big cups, and a big cup holds as much as two small cups. How many small cups does the bucket hold?`],
};
const compareMeasure = (id: string, match: RegExp, what: string, bigWord: string, en: string, big: string, what3: string) => T(id, match, [1, 1], ({ rng }) => {
  const a = int(rng, 2, 14); let b = int(rng, 2, 14); while (b === a) b = int(rng, 2, 14);
  const k = pick(rng, [0, 1, 2, 3, 3]);
  if (k === 3) {
    const n = int(rng, 3, 7), [ar, enS] = UNIT_STORY[en]!(n);
    return { eq: `${n}, 2`, answer: String(2 * n), wrongs: ints(2 * n, [n, n + 2, 2 * n + 1, 2 * n - 1, n * n]), ar, en: enS };
  }
  if (k === 2) {
    // order three things: ascending puts the smallest first, descending the largest
    let c = int(rng, 2, 14); while (c === a || c === b) c = int(rng, 2, 14);
    const up = rng() < 0.5, xs = [a, b, c], r = up ? Math.min(...xs) : Math.max(...xs);
    return { eq: `${a}, ${b}, ${c}`, answer: String(r), wrongs: ints(r, [...xs.filter(x => x !== r), up ? r + 1 : r - 1, a + b + c]), ar: `قيست ${what3} ثلاثة أشياء بالوحدة نفسها: ${a}، ${b}، ${c}. إذا رُتّبت ${up ? 'تصاعديًا' : 'تنازليًا'}، فما القياس الأول؟`, en: `The ${en} of three things is measured with the same unit: ${a}, ${b}, ${c}. Ordered ${up ? 'from smallest to largest' : 'from largest to smallest'}, which measure comes first?` };
  }
  if (k === 0) { const r = Math.max(a, b); return { eq: `${a}, ${b}`, answer: String(r), wrongs: ints(r, [Math.min(a, b), a + b, r + 1, Math.abs(a - b)]), ar: `قيست ${what} شيئين بالوحدة نفسها: الأول: ${a}، الثاني: ${b}. ما قياس ${bigWord}؟`, en: `The ${en} of two things is measured with the same unit: first: ${a}, second: ${b}. What is the measure of the ${big}?` }; }
  const d = Math.abs(a - b);
  return { eq: `${a}, ${b}`, answer: String(d), wrongs: ints(d, [a + b, Math.max(a, b), d + 1, Math.min(a, b)]), ar: `قيست ${what} شيئين بالوحدة نفسها: الأول: ${a}، الثاني: ${b}. بكم يزيد الأكبر قياسًا على الأصغر؟`, en: `The ${en} of two things is measured with the same unit: first: ${a}, second: ${b}. By how much does the larger measure exceed the smaller?` };
});

/** «لـ» before a word: «للمثلث», «للشعاع» — the article's alif drops after it. */
const li = (w: string) => (w.startsWith('ال') ? `لل${w.slice(2)}` : `لـ${w}`);

/** Things to measure, for choosing the unit: [quantity, things for the small unit, things for the big unit, other units as slips]. */
const UNIT_FIT: Record<string, [string, Array<[string, string]>, Array<[string, string]>, string[]]> = {
  'متر': ['طول', [['قلم الرصاص', 'a pencil'], ['الممحاة', 'an eraser'], ['إصبع اليد', 'a finger']], [['ملعب المدرسة', 'the school playground'], ['ممر المدرسة', 'the school corridor'], ['سور الحديقة', 'the garden wall']], ['الكيلوغرام', 'اللتر']],
  'كيلوغرام': ['كتلة', [['تفاحة', 'an apple'], ['قلم الرصاص', 'a pencil'], ['ملعقة', 'a spoon']], [['كيس أرز كبير', 'a big bag of rice'], ['بطيخة كبيرة', 'a big watermelon'], ['حقيبة سفر', 'a suitcase']], ['المتر', 'اللتر']],
  'لتر': ['كمية الماء في', [['ملعقة دواء', 'a medicine spoon'], ['قطّارة العين', 'an eye dropper'], ['فنجان قهوة صغير', 'a small coffee cup']], [['خزان ماء', 'a water tank'], ['حوض استحمام', 'a bathtub'], ['دلو كبير', 'a big bucket']], ['المتر', 'الكيلوغرام']],
};
/** A unit's plural and accusative singular: «5 أمتار», «كم مترًا», «20 سنتيمترًا», «300 غرام». */
const UNIT_NOUN: Record<string, [string, string]> = {
  'متر': ['أمتار', 'مترًا'], 'سنتيمتر': ['سنتيمترات', 'سنتيمترًا'], 'كيلوغرام': ['كيلوغرامات', 'كيلوغرامًا'],
  'غرام': ['غرامات', 'غرامًا'], 'لتر': ['لترات', 'لترًا'], 'مليلتر': ['مليلترات', 'مليلترًا'],
};
/** A measure of 3 or more: one and two take their own words, so counts start at 3. */
const measure = (n: number, unit: string) => `${n} ${tamyiz(n, UNIT_NOUN[unit]![0], UNIT_NOUN[unit]![1], unit)}`;
const howMany = (unit: string) => `كم ${UNIT_NOUN[unit]![1]}`;
const unitsG2 = (id: string, match: RegExp, big: string, small: string, f: number, bigEn: string, smallEn: string) => T(id, match, [2, 2], ({ rng }) => {
  const n = int(rng, 3, 9), k = pick(rng, [0, 1, 2, 3, 4, 4]), fact = `1 ${big} = ${f} ${small}.`, factEn = `1 ${bigEn} = ${f} ${smallEn}.`;
  if (k === 4) {
    // the unit that fits: a small thing in the small unit, a big thing in the big one
    const [what, smallThings, bigThings, slips] = UNIT_FIT[big]!, isBig = rng() < 0.5, [thing, thingEn] = pick(rng, isBig ? bigThings : smallThings);
    const ans = `ال${isBig ? big : small}`, other = `ال${isBig ? small : big}`;
    return { eq: thing, answer: ans, wrongs: [other, ...slips], ar: `ما الوحدة المناسبة لقياس ${what} ${thing}: ال${big} أم ال${small}؟`, en: `Which unit fits for measuring ${what === 'طول' ? 'the length of' : what === 'كتلة' ? 'the mass of' : 'the water in'} ${thingEn}: the ${bigEn} or the ${smallEn.replace(/s$/, '')}?` };
  }
  // a part of the big unit: 10–90 cm, or 100–900 g / mL
  const m = int(rng, 1, 9) * (f / 10);
  if (k === 2) { const w = int(rng, 3, 5), v = w * f + m; return { eq: `${w}, ${m}`, answer: String(v), wrongs: ints(v, [w * f, w + m, w * f + m * 10, (w + 1) * f + m]), ar: `${fact} ${howMany(small)} في ${measure(w, big)} و ${measure(m, small)}؟`, en: `${factEn} How many ${smallEn} are in ${w} ${bigEn} and ${m} ${smallEn}?` }; }
  if (k === 3) return { eq: `${m}`, answer: String(f - m), wrongs: ints(f - m, [m, f + m, f - m + f / 10, f - m - f / 10]), ar: `${fact} ${howMany(small)} نضيف إلى ${measure(m, small)} لنحصل على ${big} واحد؟`, en: `${factEn} How many ${smallEn} do we add to ${m} ${smallEn} to make 1 ${bigEn}?` };
  if (k === 0) return { eq: `${n}`, answer: String(n * f), wrongs: ints(n * f, [n * f * 10, n * f / 10, n + f, n * f + f]), ar: `${fact} ${howMany(small)} في ${measure(n, big)}؟`, en: `1 ${bigEn} = ${f} ${smallEn}. How many ${smallEn} are in ${n} ${bigEn}?` };
  return { eq: `${n * f}`, answer: String(n), wrongs: ints(n, [n * 10, n + 1, n - 1, n * f]), ar: `${fact} ${howMany(big)} في ${measure(n * f, small)}؟`, en: `1 ${bigEn} = ${f} ${smallEn}. How many ${bigEn} are in ${n * f} ${smallEn}?` };
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
  skipCount('skip_g1', /^العد القفزي$/, [1, 1], () => [2, 5, 10], () => 60), skipCount('skip_g3', /^العد القفزي$/, [3, 3], () => [3, 4, 6, 7, 8, 9, 10, 25, 50, 100, 1000], () => 400),
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
  compareMeasure('compare_len', /^مقارنه الاطوال وترتيبها$|^وحدات الطول غير القياسيه$/, 'أطوال', 'الأطول', 'length', 'longest', 'أطوال'),
  compareMeasure('compare_mass', /^مقارنه الكتل وترتيبها$|^وحدات الكتله غير القياسيه$/, 'كتلتا', 'الأثقل', 'mass', 'heaviest', 'كتل'),
  compareMeasure('compare_cap', /^مقارنه السعات وترتيبها$|^وحدات السعه غير القياسيه$/, 'سعتا', 'الأكبر سعة', 'capacity', 'largest', 'سعات'),
  centimetre, unitsG2('units_m_g2', /^المتر$/, 'متر', 'سنتيمتر', 100, 'metre', 'centimetres'),
  unitsG2('units_kg_g2', /^الغرام والكيلوغرام$/, 'كيلوغرام', 'غرام', 1000, 'kilogram', 'grams'), unitsG2('units_l_g2', /^اللتر والمليلتر$/, 'لتر', 'مليلتر', 1000, 'litre', 'millilitres'),
];
