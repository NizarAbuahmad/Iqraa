/**
 * Statistics, data and probability generators (Grades 1–10). Same contract as
 * the other topic modules: the lesson title picks the generator, every answer
 * is computed from the data printed in the stem. Data is always written out as
 * a list or a small table — there is no chart to look at — so every stem is
 * self-contained.
 *
 * Three-way answers (certain / possible / impossible) have two wrong options,
 * not three; the rest have three.
 */
import { gcd, int, numWrongs, pick, sfrac, signed, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);

const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
const list = (xs: number[]) => xs.join('، ');
const listEn = (xs: number[]) => xs.join(', ');
/** «5» or «5.5». */
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const decOpts = (ans: number, cands: number[], step = 1) =>
  wrongsFrom(n1(ans), cands.filter(c => Number.isFinite(c) && c >= 0).map(n1), k => n1(ans + Math.abs(k) * step));
const countOpts = (ans: number, cands: number[]) => numWrongs(ans, cands);
const fracOpts = (n: number, d: number, cands: string[]) => wrongsFrom(sfrac(n, d), cands, k => sfrac(n + Math.abs(k), d));

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const sorted = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const median = (xs: number[]) => { const s = sorted(xs), m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
/** The single most frequent value, or null when there is a tie. */
function mode(xs: number[]): number | null {
  const c = new Map<number, number>();
  xs.forEach(x => c.set(x, (c.get(x) ?? 0) + 1));
  const top = Math.max(...c.values());
  const tops = [...c.entries()].filter(([, k]) => k === top);
  return tops.length === 1 ? tops[0]![0] : null;
}

const COLORS: Array<[string, string]> = [['حمراء', 'red'], ['زرقاء', 'blue'], ['خضراء', 'green'], ['صفراء', 'yellow']];
const bagAr = (cs: number[]) => cs.map((c, i) => `${c} كرات ${COLORS[i]![0]}`).join(' و ');
const bagEn = (cs: number[]) => cs.map((c, i) => `${c} ${COLORS[i]![1]} balls`).join(', ').replace(/, ([^,]*)$/, ' and $1');

// ─── chance and probability ─────────────────────────────────────────────────

const LIKELY = ['أكيد', 'ممكن', 'مستحيل'];
const LIKELY_EN: Record<string, string> = { 'أكيد': 'certain', 'ممكن': 'possible', 'مستحيل': 'impossible' };
const certainty = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng }) => {
  const present = pick(rng, [1, 2, 3]);
  const counts = Array.from({ length: present }, () => int(rng, 3, 9));
  const ci = int(rng, 0, 3);
  const kind = pick(rng, [0, 0, 1]);
  const has = ci < present;
  let ans: string, ar: string, en: string;
  if (kind === 0) {
    ans = !has ? 'مستحيل' : present === 1 ? 'أكيد' : 'ممكن';
    ar = `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. سحب كرة ${COLORS[ci]![0]}: أكيد أم ممكن أم مستحيل؟`;
    en = `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Drawing a ${COLORS[ci]![1]} ball is certain, possible or impossible?`;
  } else {
    ans = 'أكيد';
    ar = `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. سحب كرة لونها أحد ألوان الكرات الموجودة في الكيس: أكيد أم ممكن أم مستحيل؟`;
    en = `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Drawing a ball whose colour is one of those in the bag is certain, possible or impossible?`;
  }
  return { eq: counts.join(', '), answer: ans, wrongs: LIKELY.filter(x => x !== ans), ar, en };
});

const outcomes = T('outcomes', /^التجربه العشوائيه وانواع الحوادث$/, [4, 4], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) return { eq: '', answer: '6', wrongs: ['5', '12', '3'], ar: 'ما عدد النواتج الممكنة عند رمي مكعب مرقم من 1 إلى 6 مرة واحدة؟', en: 'How many possible outcomes are there when a 1–6 die is rolled once?' };
  if (k === 1) return { eq: '', answer: '2', wrongs: ['1', '4', '3'], ar: 'ما عدد النواتج الممكنة عند رمي قطعة نقد مرة واحدة؟', en: 'How many possible outcomes are there when a coin is tossed once?' };
  if (k === 2) { const s = int(rng, 3, span(diff, 8, 10, 12)); return { eq: `${s}`, answer: String(s), wrongs: countOpts(s, [s - 1, s + 1, 2 * s, 1]), ar: `قرص دوار مقسم إلى ${s} قطاعات متساوية مرقمة من 1 إلى ${s}. ما عدد النواتج الممكنة عند تدويره مرة واحدة؟`, en: `A spinner has ${s} equal sectors numbered 1 to ${s}. How many outcomes are possible when it is spun once?` }; }
  const counts = [int(rng, 3, 9), int(rng, 3, 9)];
  const t = sum(counts);
  return { eq: counts.join(', '), answer: '2', wrongs: ['1', String(t), '3'], ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة. ما عدد الألوان الممكنة للكرة المسحوبة؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn. How many different colours could it be?` };
});

const likelihood = T('likelihood', /^فرص الحدوث$/, [5, 5], ({ rng, diff }) => {
  const counts = shuffle(rng, [2, 3, 4, 5, 6, 7, 8, 9, 10]).slice(0, span(diff, 3, 4, 4));
  const most = rng() < 0.5;
  const target = most ? Math.max(...counts) : Math.min(...counts);
  const idx = counts.indexOf(target);
  const names = COLORS.slice(0, counts.length).map(c => c[0]);
  return {
    eq: counts.join(', '), answer: names[idx]!, wrongs: names.filter((_, i) => i !== idx).concat(COLORS.map(c => c[0]).filter(c => !names.includes(c))).slice(0, 3),
    ar: `في كيس ${bagAr(counts)}. سُحبت كرة دون النظر. أي لون ${most ? 'أكثر' : 'أقل'} احتمالًا للسحب؟ (اكتب اللون)`,
    en: `A bag holds ${bagEn(counts)}. A ball is drawn without looking. Which colour is ${most ? 'most' : 'least'} likely? (give the colour)`,
  };
});

const DICE_EVENTS: Array<[string, string, (v: number) => boolean]> = [
  ['عدد زوجي', 'an even number', v => v % 2 === 0], ['عدد فردي', 'an odd number', v => v % 2 === 1],
  ['عدد أكبر من 4', 'a number greater than 4', v => v > 4], ['عدد أصغر من 3', 'a number less than 3', v => v < 3],
  ['العدد 6', 'a 6', v => v === 6], ['عدد يقبل القسمة على 3', 'a multiple of 3', v => v % 3 === 0], ['عدد أولي', 'a prime number', v => [2, 3, 5].includes(v)],
];
const probability = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const k = pick(rng, grade === 6 ? [0, 0, 1] : [0, 1, 2, 3]);
  if (k === 0) {
    const counts = Array.from({ length: pick(rng, [2, 3, 4]) }, () => int(rng, 2, span(diff, 6, 9, 10)));
    const i = int(rng, 0, counts.length - 1), t = sum(counts);
    return { eq: counts.join(', '), answer: sfrac(counts[i]!, t), wrongs: fracOpts(counts[i]!, t, [sfrac(counts[i]!, t - counts[i]!), sfrac(t - counts[i]!, t), sfrac(counts[i]!, counts.length), sfrac(1, t)].filter(f => f !== sfrac(counts[i]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال أن تكون ${COLORS[i]![0] === 'حمراء' ? 'الكرة حمراء' : `الكرة ${COLORS[i]![0]}`}؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is ${COLORS[i]![1]}?` };
  }
  if (k === 1) {
    const [ar, en, f] = pick(rng, DICE_EVENTS);
    const c = [1, 2, 3, 4, 5, 6].filter(f).length;
    return { eq: ar, answer: sfrac(c, 6), wrongs: fracOpts(c, 6, [sfrac(6 - c, 6), sfrac(c, 5), sfrac(c, 12), sfrac(1, 6)].filter(x => x !== sfrac(c, 6))), ar: `رُمي مكعب مرقم من 1 إلى 6. ما احتمال ظهور ${ar}؟`, en: `A 1–6 die is rolled. What is the probability of ${en}?` };
  }
  if (k === 2) {
    const counts = [int(rng, 2, 9), int(rng, 2, 9), int(rng, 2, 9)], t = sum(counts);
    const [a, b] = [0, 1];
    return { eq: counts.join(', '), answer: sfrac(t - counts[a]!, t), wrongs: fracOpts(t - counts[a]!, t, [sfrac(counts[a]!, t), sfrac(t - counts[a]!, t - 1), sfrac(counts[b]!, t), sfrac(1, t)].filter(x => x !== sfrac(t - counts[a]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال ألّا تكون الكرة ${COLORS[a]![0]}؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is not ${COLORS[a]![1]}?` };
  }
  const counts = [int(rng, 2, 8), int(rng, 2, 8)], t = sum(counts), N = t * int(rng, 2, 6);
  const exp = (N * counts[0]!) / t;
  return { eq: counts.join(', '), answer: String(exp), wrongs: countOpts(exp, [N / 2, N - exp, counts[0]!, exp + counts[1]!]), ar: `في كيس ${bagAr(counts)}. سُحبت كرة عشوائيًا وأُعيدت إلى الكيس، وتكررت العملية ${N} مرة. كم مرة يُتوقَّع أن تكون الكرة المسحوبة ${COLORS[0]![0]}؟`, en: `A bag holds ${bagEn(counts)}. A ball is drawn at random and replaced, ${N} times. How many times is it expected to be ${COLORS[0]![1]}?` };
});

const experimental = T('experimental', /^الاحتمال التجريبي$/, [7, 7], ({ rng, diff }) => {
  const N = pick(rng, [20, 25, 40, 50, 60, 80, 100]), k = int(rng, 3, Math.floor(N * 0.7));
  const M = N * int(rng, 2, span(diff, 4, 6, 10)); // M is a multiple of N, so the prediction is whole
  if (rng() < 0.5) return { eq: `${k}, ${N}`, answer: sfrac(k, N), wrongs: fracOpts(k, N, [sfrac(N - k, N), sfrac(k, N - k), sfrac(N, k), sfrac(k + 1, N)].filter(x => x !== sfrac(k, N))), ar: `رُمي سهم ${N} مرة فأصاب الهدف ${k} مرة. ما الاحتمال التجريبي لإصابة الهدف؟`, en: `An arrow is shot ${N} times and hits the target ${k} times. What is the experimental probability of a hit?` };
  const exp = (M * k) / N;
  return { eq: `${k}, ${N}, ${M}`, answer: String(exp), wrongs: countOpts(exp, [M - exp, k * M / 10, M / N, exp + k]), ar: `أصاب لاعب الهدف ${k} مرة من ${N} محاولة. كم مرة يُتوقَّع أن يصيب الهدف في ${M} محاولة؟`, en: `A player hits the target ${k} times in ${N} attempts. How many hits are expected in ${M} attempts?` };
});

const nPr = (n: number, r: number) => { let p = 1; for (let i = 0; i < r; i++) p *= n - i; return p; };
const fact = (n: number) => nPr(n, n);
const counting = T('counting', /^عد النواتج$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3, 4]);
  if (k === 0) { const a = int(rng, 2, 6), b = int(rng, 2, 6); return { eq: `${a}, ${b}`, answer: String(a * b), wrongs: countOpts(a * b, [a + b, a * b + a, a ** b, a * b - b]), ar: `لدى سامر ${a} قمصان و ${b} بناطيل. كم زيًّا مختلفًا (قميص وبنطال) يمكنه تكوينه؟`, en: `Sami has ${a} shirts and ${b} pairs of trousers. How many different outfits (a shirt and a pair of trousers) can he make?` }; }
  if (k === 1) { const a = int(rng, 2, 5), b = int(rng, 2, 5), c = int(rng, 2, 4); return { eq: `${a}, ${b}, ${c}`, answer: String(a * b * c), wrongs: countOpts(a * b * c, [a + b + c, a * b + c, a * b * c + a, (a + b) * c]), ar: `في مطعم ${a} أنواع من الطبق الرئيسي و ${b} أنواع من العصير و ${c} أنواع من الحلوى. كم وجبة مختلفة (طبق وعصير وحلوى) يمكن اختيارها؟`, en: `A restaurant offers ${a} main dishes, ${b} drinks and ${c} desserts. How many different meals (one of each) can be chosen?` }; }
  if (k === 2) { const n = int(rng, 3, span(diff, 5, 6, 7)); return { eq: `${n}`, answer: String(fact(n)), wrongs: countOpts(fact(n), [n * n, fact(n - 1), 2 * n, fact(n) + n]), ar: `بكم طريقة مختلفة يمكن ترتيب ${n} كتب مختلفة على رف في صف واحد؟`, en: `In how many different ways can ${n} different books be arranged in a row on a shelf?` }; }
  const n = int(rng, 4, span(diff, 6, 8, 9)), r = int(rng, 2, 3);
  if (k === 3) return { eq: `${n}, ${r}`, answer: String(nPr(n, r)), wrongs: countOpts(nPr(n, r), [n ** r, nPr(n, r) / fact(r), n * r, nPr(n, r + 1)]), ar: `بكم طريقة يمكن اختيار ${r} طلاب من ${n} طلاب لشغل ${r === 2 ? 'منصبي الرئيس ونائبه' : 'مناصب الرئيس ونائبه وأمين السر'} (الترتيب مهم)؟`, en: `In how many ways can ${r} students from ${n} be chosen to fill ${r === 2 ? 'the posts of president and deputy' : 'the posts of president, deputy and secretary'} (order matters)?` };
  const c = nPr(n, r) / fact(r);
  return { eq: `${n}, ${r}`, answer: String(c), wrongs: countOpts(c, [nPr(n, r), n * r, c + n, nPr(n, r) / 2]), ar: `بكم طريقة يمكن اختيار لجنة من ${r} طلاب من بين ${n} طلاب (الترتيب غير مهم)؟`, en: `In how many ways can a committee of ${r} students be chosen from ${n} students (order does not matter)?` };
});

const compound = T('compound_prob', /^احتمال الحوادث المركبه$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0) { const [ar, en, f] = pick(rng, DICE_EVENTS.slice(0, 4)); const c = [1, 2, 3, 4, 5, 6].filter(f).length; const ans = sfrac(c, 12); return { eq: ar, answer: ans, wrongs: fracOpts(c, 12, [sfrac(c, 6), sfrac(c + 1, 12), sfrac(1, 12), sfrac(c, 8)].filter(x => x !== ans)), ar: `رُميت قطعة نقد ومكعب مرقم من 1 إلى 6. ما احتمال ظهور شعار على القطعة و${ar} على المكعب؟`, en: `A coin is tossed and a 1–6 die is rolled. What is the probability of a head and ${en}?` }; }
  if (k === 1) { const a = int(rng, 1, 5), b = int(rng, 2, 6), c = int(rng, 1, 5), d = int(rng, 2, 6); if (a >= b || c >= d) return compound.make({ rng, diff, grade: 8 }); const n = a * c, den = b * d; return { eq: `${a}/${b}, ${c}/${d}`, answer: sfrac(n, den), wrongs: fracOpts(n, den, [sfrac(a * d + c * b, b * d), sfrac(a + c, b + d), sfrac(a * d, b * c), sfrac(n, den + 1)].filter(x => x !== sfrac(n, den))), ar: `حادثتان مستقلتان احتمال الأولى ${a}/${b} واحتمال الثانية ${c}/${d}. ما احتمال وقوعهما معًا؟`, en: `Two independent events have probabilities ${a}/${b} and ${c}/${d}. What is the probability that both happen?` }; }
  if (k === 2) { const r = int(rng, 3, 7), o = int(rng, 2, 6), t = r + o; const n = r * (r - 1), den = t * (t - 1); return { eq: `${r}, ${o}`, answer: sfrac(n, den), wrongs: fracOpts(n, den, [sfrac(r * r, t * t), sfrac(r, t), sfrac(r * (r - 1), t * t), sfrac(2 * r, t)].filter(x => x !== sfrac(n, den))), ar: `في كيس ${r} كرات حمراء و ${o} كرات زرقاء. سُحبت كرتان الواحدة بعد الأخرى دون إرجاع. ما احتمال أن تكون الكرتان حمراوين؟`, en: `A bag holds ${r} red balls and ${o} blue balls. Two balls are drawn one after the other without replacement. What is the probability that both are red?` }; }
  const counts = [int(rng, 2, 7), int(rng, 2, 7), int(rng, 2, 7)], t = sum(counts);
  return { eq: counts.join(', '), answer: sfrac(counts[0]! + counts[1]!, t), wrongs: fracOpts(counts[0]! + counts[1]!, t, [sfrac(counts[0]! * counts[1]!, t * t), sfrac(counts[2]!, t), sfrac(counts[0]! + counts[1]!, t - 1), sfrac(counts[0]!, t)].filter(x => x !== sfrac(counts[0]! + counts[1]!, t))), ar: `في كيس ${bagAr(counts)}. سُحبت كرة واحدة عشوائيًا. ما احتمال أن تكون حمراء أو زرقاء؟`, en: `A bag holds ${bagEn(counts)}. One ball is drawn at random. What is the probability that it is red or blue?` };
});

const venn = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const both = int(rng, 2, 8), onlyA = int(rng, 2, 10), onlyB = int(rng, 2, 10), none = int(rng, 1, 8);
  const A = onlyA + both, B = onlyB + both, total = A + B - both + none;
  const prob = grade >= 9;
  const subjects = pick(rng, [['كرة القدم', 'السباحة', 'football', 'swimming'], ['الرسم', 'القراءة', 'drawing', 'reading'], ['الشاي', 'القهوة', 'tea', 'coffee']] as const);
  const head = `في مجموعة من ${total} شخصًا، ${A} منهم يحبون ${subjects[0]} و ${B} منهم يحبون ${subjects[1]} و ${both} يحبون الاثنين معًا`;
  const headEn = `In a group of ${total} people, ${A} like ${subjects[2]}, ${B} like ${subjects[3]} and ${both} like both`;
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (!prob || k < 2) {
    const [val, ar, en] = k === 0 ? [A + B - both, 'يحب أحد النشاطين على الأقل', 'like at least one of the two'] : k === 1 ? [onlyA, `يحبون ${subjects[0]} فقط`, `like only ${subjects[2]}`] : [none, 'لا يحبون أيًّا منهما', 'like neither'];
    if (prob) { const ans = sfrac(val, total); return { eq: `${total}, ${A}, ${B}, ${both}`, answer: ans, wrongs: fracOpts(val, total, [sfrac(A + B, total), sfrac(val, total - 1), sfrac(both, total), sfrac(val + 1, total)].filter(x => x !== ans)), ar: `${head}. اختير شخص عشوائيًا. ما احتمال أن ${k === 0 ? 'يحب أحد النشاطين على الأقل' : k === 1 ? `يحب ${subjects[0]} فقط` : 'لا يحب أيًّا منهما'}؟`, en: `${headEn}. One person is chosen at random. What is the probability that they ${en.replace('like ', 'like ').replace('only', 'only')}?` }; }
    return { eq: `${total}, ${A}, ${B}, ${both}`, answer: String(val), wrongs: countOpts(val, [A + B, val + both, val - 1 > 0 ? val - 1 : val + 2, total - val]), ar: `${head}. كم شخصًا ${ar}؟`, en: `${headEn}. How many ${en}?` };
  }
  const ans = k === 2 ? sfrac(both, total) : sfrac(total - A, total);
  return { eq: `${total}, ${A}, ${B}, ${both}`, answer: ans, wrongs: fracOpts(k === 2 ? both : total - A, total, [sfrac(A, total), sfrac(A + B - both, total), sfrac(both, A), sfrac(B, total)].filter(x => x !== ans)), ar: `${head}. اختير شخص عشوائيًا. ما احتمال أن ${k === 2 ? 'يحب الاثنين معًا' : `لا يحب ${subjects[0]}`}؟`, en: `${headEn}. One person is chosen at random. What is the probability that they ${k === 2 ? 'like both' : `do not like ${subjects[2]}`}?` };
});

const geometricProb = T('geometric_prob', /^الاحتمال الهندسي$/, [9, 9], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const s = int(rng, 4, span(diff, 10, 14, 20)), t = int(rng, 1, s - 1); const ans = sfrac(t * t, s * s); return { eq: `${s}, ${t}`, answer: ans, wrongs: fracOpts(t * t, s * s, [sfrac(t, s), sfrac(s * s - t * t, s * s), sfrac(4 * t, 4 * s + 1), sfrac(t * t, s * s + 1)].filter(x => x !== ans)), ar: `مربع طول ضلعه ${s} سم، وفي داخله مربع طول ضلعه ${t} سم. أُلقي سهم عشوائيًا على المربع الكبير. ما احتمال أن يقع في المربع الصغير؟`, en: `A square of side ${s} cm contains a smaller square of side ${t} cm. A dart lands at random on the large square. What is the probability that it lands in the small square?` }; }
  if (k === 1) { const a = pick(rng, [30, 45, 60, 72, 90, 120, 135, 150, 180]); const ans = sfrac(a, 360); return { eq: `${a}`, answer: ans, wrongs: fracOpts(a, 360, [sfrac(a, 180), sfrac(360 - a, 360), sfrac(a, 100), sfrac(a + 30, 360)].filter(x => x !== ans)), ar: `قرص دوار مقسم إلى قطاعات، وزاوية أحد القطاعات ${a}°. ما احتمال أن يتوقف المؤشر عند هذا القطاع؟`, en: `A spinner is divided into sectors, and one sector has angle ${a}°. What is the probability that the pointer stops in that sector?` }; }
  const L = int(rng, 6, span(diff, 20, 30, 50)), l = int(rng, 1, L - 1); const ans = sfrac(l, L);
  return { eq: `${L}, ${l}`, answer: ans, wrongs: fracOpts(l, L, [sfrac(L - l, L), sfrac(l, L - l), sfrac(L, l), sfrac(l + 1, L)].filter(x => x !== ans)), ar: `اختيرت نقطة عشوائيًا على قطعة مستقيمة طولها ${L} سم. ما احتمال أن تقع على الجزء الأول منها الذي طوله ${l} سم؟`, en: `A point is chosen at random on a segment ${L} cm long. What is the probability that it falls in its first part, ${l} cm long?` };
});

// ─── averages, range, data lists ────────────────────────────────────────────

/** A data set with a whole-number mean: n values, then the last is nudged so the sum divides n. */
function dataWithMean(rng: Rng, n: number, lo: number, hi: number): number[] {
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, lo, hi));
    for (let v = lo; v <= hi; v++) if ((sum(xs.slice(0, -1)) + v) % n === 0) { xs[n - 1] = v; return xs; }
  }
}

const meanT = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff }) => {
  const n = int(rng, 4, span(diff, 5, 6, 8)), hi = span(diff, 12, 25, 60);
  const xs = dataWithMean(rng, n, 1, hi), m = sum(xs) / n;
  if (diff !== 'easy' && rng() < 0.35) {
    const shown = xs.slice(0, -1), miss = xs[n - 1]!;
    return { eq: `${list(shown)}; ${m}`, answer: String(miss), wrongs: countOpts(miss, [m, sum(shown), m * (n - 1) - sum(shown) + 1, miss + n]), ar: `الوسط الحسابي لـ ${n} أعداد هو ${m}. إذا كانت ${n - 1} منها: ${list(shown)} فما العدد الأخير؟`, en: `The mean of ${n} numbers is ${m}. If ${n - 1} of them are ${listEn(shown)}, what is the last number?` };
  }
  const x = shuffle(rng, xs);
  return { eq: list(x), answer: String(m), wrongs: countOpts(m, [median(xs), Math.max(...xs), sum(xs), Math.min(...xs), m + 1]), ar: `ما الوسط الحسابي للأعداد: ${list(x)}؟`, en: `What is the mean of ${listEn(x)}?` };
});

const medianModeT = (id: string, match: RegExp, grades: [number, number], kinds: Array<'median' | 'mode' | 'range'>): Topic => T(id, match, grades, ({ rng, diff }) => {
  const kind = pick(rng, kinds);
  if (kind === 'mode') {
    for (;;) {
      const n = int(rng, 7, span(diff, 9, 11, 13));
      const xs = Array.from({ length: n }, () => int(rng, 1, span(diff, 9, 15, 20)));
      const m = mode(xs);
      if (m === null) continue;
      if (xs.filter(v => v === m).length < 3) continue;
      return { eq: list(xs), answer: String(m), wrongs: countOpts(m, [median(xs), Math.max(...xs), Math.round(sum(xs) / n), Math.min(...xs), m + 1]), ar: `ما المنوال للأعداد: ${list(xs)}؟`, en: `What is the mode of ${listEn(xs)}?` };
    }
  }
  const n = int(rng, 5, span(diff, 8, 10, 12)), hi = span(diff, 20, 40, 90);
  const xs = Array.from({ length: n }, () => int(rng, 1, hi));
  if (kind === 'median') { const md = median(xs); return { eq: list(xs), answer: n1(md), wrongs: decOpts(md, [sum(xs) / n, sorted(xs)[0]!, Math.max(...xs), sorted(xs)[n >> 1]! + (n % 2 ? 1 : 0)].map(v => Math.round(v * 2) / 2).filter(v => v !== md), 0.5), ar: `ما الوسيط للأعداد: ${list(xs)}؟`, en: `What is the median of ${listEn(xs)}?` }; }
  const r = Math.max(...xs) - Math.min(...xs);
  if (r === 0) return medianModeT(id, match, grades, kinds).make({ rng, diff, grade: grades[0] });
  return { eq: list(xs), answer: String(r), wrongs: countOpts(r, [Math.max(...xs), r + 1, r - 1, Math.max(...xs) + Math.min(...xs), sum(xs) / n | 0]), ar: `ما المدى للأعداد: ${list(xs)}؟`, en: `What is the range of ${listEn(xs)}?` };
});

const stemLeaf = T('stem_leaf', /^التمثيل بالساق والورقه$/, [7, 7], ({ rng, diff }) => {
  const n = int(rng, 9, span(diff, 11, 13, 16));
  const xs = Array.from({ length: n }, () => int(rng, 10, 59));
  const stems = [...new Set(xs.map(x => Math.floor(x / 10)))].sort((a, b) => a - b);
  const table = stems.map(s => `${s} | ${sorted(xs.filter(x => Math.floor(x / 10) === s)).map(x => x % 10).join(' ')}`).join('\n');
  const k = pick(rng, [0, 1, 2, 3]);
  const head = `يبين التمثيل بالساق والورقة الآتي علامات مجموعة من الطلاب (الساق للعشرات والورقة للآحاد):\n${table}\n`;
  const headEn = `The stem-and-leaf plot shows students' marks (stem = tens, leaf = units):\n${table}\n`;
  if (k === 0) { const v = Math.max(...xs); return { eq: table, answer: String(v), wrongs: countOpts(v, [Math.min(...xs), v - 1, median(xs), stems[stems.length - 1]!]), ar: `${head}ما أعلى علامة؟`, en: `${headEn}What is the highest mark?` }; }
  if (k === 1) { const r = Math.max(...xs) - Math.min(...xs); return { eq: table, answer: String(r), wrongs: countOpts(r, [Math.max(...xs), r + 1, r - 10, Math.min(...xs)]), ar: `${head}ما مدى العلامات؟`, en: `${headEn}What is the range of the marks?` }; }
  if (k === 2) { const md = median(xs); return { eq: table, answer: n1(md), wrongs: decOpts(md, [sum(xs) / n, sorted(xs)[0]!, Math.max(...xs), md + 1].map(v => Math.round(v * 2) / 2).filter(v => v !== md), 0.5), ar: `${head}ما وسيط العلامات؟`, en: `${headEn}What is the median mark?` }; }
  return { eq: table, answer: String(n), wrongs: countOpts(n, [n - 1, n + 1, stems.length, sum(xs) / n | 0]), ar: `${head}كم طالبًا في المجموعة؟`, en: `${headEn}How many students are in the group?` };
});

// ─── reading data tables ────────────────────────────────────────────────────

const CATS: Array<[string, string]> = [['التفاح', 'apples'], ['الموز', 'bananas'], ['البرتقال', 'oranges'], ['العنب', 'grapes'], ['الكرز', 'cherries']];
const readData = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const m = grade <= 1 ? 6 : grade === 2 ? 9 : span(diff, 12, 20, 30);
  const k = grade <= 2 ? 3 : 4;
  const cats = shuffle(rng, CATS).slice(0, k);
  const raw = shuffle(rng, Array.from({ length: m }, (_, i) => i + 1)).slice(0, k);
  const key = grade === 2 && rng() < 0.6 ? 2 : 1;
  const counts = raw.map(v => (key === 2 ? v : v)); // symbols (or tally marks) per category
  const vals = counts.map(c => c * key);
  const where = key === 2 ? `في جدول الصور الآتي كل صورة تمثل ${key} من الفاكهة، وعدد الصور: ` : 'في الجدول الآتي عدد الطلاب الذين يفضلون كل نوع من الفاكهة: ';
  const whereEn = key === 2 ? `In a picture graph each picture stands for ${key} fruits; the numbers of pictures are: ` : 'The table shows how many students prefer each fruit: ';
  const tab = cats.map((c, i) => `${c[0]}: ${counts[i]}`).join('، ');
  const tabEn = cats.map((c, i) => `${c[1]}: ${counts[i]}`).join(', ');
  const q = pick(rng, grade <= 2 ? [0, 1, 3] : [0, 1, 2, 3]);
  const hi = vals.indexOf(Math.max(...vals)), lo = vals.indexOf(Math.min(...vals));
  // the other categories first, then fruits not in the table, so there are always three wrong options
  const others = (i: number) => [...cats.filter((_, j) => j !== i), ...CATS.filter(c => !cats.includes(c))].map(c => c[0]).slice(0, 3);
  const head = `${where}${tab}.`, headEn = `${whereEn}${tabEn}.`;
  if (q === 0) return { eq: tab, answer: cats[hi]![0], wrongs: others(hi), ar: `${head} أي نوع هو الأكثر ${key === 2 ? 'عددًا' : 'تفضيلًا'}؟`, en: `${headEn} Which fruit has the most?` };
  if (q === 1) return { eq: tab, answer: cats[lo]![0], wrongs: others(lo), ar: `${head} أي نوع هو الأقل ${key === 2 ? 'عددًا' : 'تفضيلًا'}؟`, en: `${headEn} Which fruit has the least?` };
  if (q === 2) { const d = vals[hi]! - vals[lo]!; return { eq: tab, answer: String(d), wrongs: countOpts(d, [vals[hi]!, d + 1, d - 1, vals[hi]! + vals[lo]!]), ar: `${head} بكم يزيد عدد الأكثر على عدد الأقل؟`, en: `${headEn} By how many does the largest exceed the smallest?` }; }
  const t = sum(vals);
  return { eq: tab, answer: String(t), wrongs: countOpts(t, [t - 1, t + 1, Math.max(...vals), t + key]), ar: `${head} ما المجموع الكلي؟`, en: `${headEn} What is the total?` };
});

const freqTable = T('freq_table', /^(?:الجداول التكراريه|جمع البيانات)$/, [6, 6], ({ rng, diff }) => {
  const n = span(diff, 15, 20, 25), hi = span(diff, 4, 5, 6);
  for (;;) {
    const xs = Array.from({ length: n }, () => int(rng, 1, hi));
    const v = pick(rng, [...new Set(xs)]);
    const f = xs.filter(x => x === v).length;
    const m = mode(xs);
    if (rng() < 0.5) return { eq: list(xs), answer: String(f), wrongs: countOpts(f, [f + 1, f - 1, v, n - f]), ar: `سُجّلت ${n} قراءة: ${list(xs)}. ما تكرار القيمة ${v}؟`, en: `${n} readings were recorded: ${listEn(xs)}. What is the frequency of the value ${v}?` };
    if (m === null) continue;
    return { eq: list(xs), answer: String(m), wrongs: countOpts(m, [m + 1, xs.filter(x => x === m).length, Math.max(...xs), Math.min(...xs)]), ar: `سُجّلت ${n} قراءة: ${list(xs)}. ما القيمة الأكثر تكرارًا؟`, en: `${n} readings were recorded: ${listEn(xs)}. Which value occurs most often?` };
  }
});

const classOf = (w: number, lo: number, v: number) => { const a = lo + Math.floor((v - lo) / w) * w; return [a, a + w - 1] as const; };
const grouped = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff }) => {
  const w = pick(rng, [5, 10]), lo = 0;
  for (;;) {
    const n = span(diff, 16, 20, 24);
    const xs = Array.from({ length: n }, () => int(rng, 1, w * 4 - 1));
    const cls = new Map<number, number>();
    xs.forEach(x => { const [a] = classOf(w, lo, x); cls.set(a, (cls.get(a) ?? 0) + 1); });
    const tops = [...cls.entries()].sort((a, b) => b[1] - a[1]);
    if (tops.length < 3 || tops[0]![1] === tops[1]![1]) continue;
    const label = (a: number) => `${a}–${a + w - 1}`;
    const head = `سُجّلت ${n} علامة: ${list(xs)}. نظّمها في فئات طول كل منها ${w}.`;
    const headEn = `${n} marks were recorded: ${listEn(xs)}. They are grouped in classes of width ${w}.`;
    const pickClass = [...cls.keys()][int(rng, 0, cls.size - 1)]!;
    if (rng() < 0.5) { const f = cls.get(pickClass)!; return { eq: list(xs), answer: String(f), wrongs: countOpts(f, [f + 1, f - 1, n - f, cls.size]), ar: `${head} ما تكرار الفئة ${label(pickClass)}؟`, en: `${headEn} What is the frequency of the class ${label(pickClass)}?` }; }
    const modal = tops[0]![0];
    const others = [...cls.keys()].filter(a => a !== modal).map(label);
    while (others.length < 3) others.push(label(Math.max(...cls.keys(), modal) + w * (others.length + 1)));
    return { eq: list(xs), answer: label(modal), wrongs: others.slice(0, 3), ar: `${head} ما الفئة المنوالية (الأكثر تكرارًا)؟`, en: `${headEn} Which is the modal class (the one with the highest frequency)?` };
  }
});

// ─── dispersion (Grade 9) ───────────────────────────────────────────────────

const dispersion = T('dispersion', /^مقاييس التشتت$/, [9, 9], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0 || k === 1) {
    const n = int(rng, 6, 9), xs = Array.from({ length: n }, () => int(rng, 3, 60));
    const r = Math.max(...xs) - Math.min(...xs);
    if (r === 0) return dispersion.make({ rng, diff, grade: 9 });
    return { eq: list(xs), answer: String(r), wrongs: countOpts(r, [r + 1, Math.max(...xs), r - 1, Math.round(sum(xs) / n)]), ar: `ما مدى القيم: ${list(xs)}؟`, en: `What is the range of ${listEn(xs)}?` };
  }
  if (k === 2) { // interquartile range: even n, Q1 and Q3 are the medians of the lower and upper halves
    const n = pick(rng, [8, 10, 12]);
    const xs = sorted(Array.from({ length: n }, () => int(rng, 2, 60)));
    const lowerHalf = xs.slice(0, n / 2), upperHalf = xs.slice(n / 2);
    const iqr = median(upperHalf) - median(lowerHalf);
    const shown = shuffle(rng, xs);
    return { eq: list(shown), answer: n1(iqr), wrongs: decOpts(iqr, [Math.max(...xs) - Math.min(...xs), median(upperHalf), iqr + 1, iqr / 2].map(v => Math.round(v * 2) / 2).filter(v => v !== iqr && v > 0), 0.5), ar: `ما المدى الربيعي للقيم: ${list(shown)}؟ (الربيع الأول والثالث هما وسيطا النصفين الأدنى والأعلى للقيم المرتبة)`, en: `What is the interquartile range of ${listEn(shown)}? (Q1 and Q3 are the medians of the lower and upper halves of the ordered data)` };
  }
  // standard deviation: rejection-sample a small set whose population variance is a perfect square
  for (let attempt = 0; attempt < 5000; attempt++) {
    const n = pick(rng, [4, 5, 6]);
    const xs = dataWithMean(rng, n, 2, 30), m = sum(xs) / n;
    const ss = sum(xs.map(x => (x - m) ** 2));
    if (ss % n !== 0) continue;
    const v = ss / n, sd = Math.sqrt(v);
    if (!Number.isInteger(sd) || sd === 0) continue;
    return { eq: list(xs), answer: String(sd), wrongs: countOpts(sd, [v, sd + 1, m, sd * 2, Math.sqrt(ss / (n - 1)) | 0]), ar: `ما الانحراف المعياري للقيم: ${list(xs)}؟ (استعمل القسمة على n)`, en: `What is the standard deviation of ${listEn(xs)}? (divide by n)` };
  }
  return dispersion.make({ rng, diff: 'easy', grade: 9 });
});

// ─── Grade 10: scatter, cumulative frequency, grouped data ──────────────────

function correlation(pts: Array<[number, number]>): number {
  const n = pts.length, mx = sum(pts.map(p => p[0])) / n, my = sum(pts.map(p => p[1])) / n;
  let sxy = 0, sxx = 0, syy = 0;
  pts.forEach(([x, y]) => { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; });
  return sxy / Math.sqrt(sxx * syy);
}
const CORR = ['ارتباط طردي (موجب)', 'ارتباط عكسي (سالب)', 'لا يوجد ارتباط'];
const scatter = T('scatter', /^اشكال الانتشار$/, [10, 10], ({ rng }) => {
  for (;;) {
    const kind = int(rng, 0, 2), n = 7;
    const xs = Array.from({ length: n }, (_, i) => i + 1);
    const ys = xs.map(x => (kind === 0 ? 2 * x : kind === 1 ? 20 - 2 * x : int(rng, 2, 18)) + (kind === 2 ? 0 : int(rng, -2, 2)));
    if (ys.some(y => y < 0)) continue;
    const pts = xs.map((x, i) => [x, ys[i]!] as [number, number]);
    const r = correlation(pts);
    const real = r > 0.85 ? 0 : r < -0.85 ? 1 : Math.abs(r) < 0.3 ? 2 : -1;
    if (real < 0) continue;
    const text = pts.map(p => `(${p[0]} ، ${p[1]})`).join(' ');
    return { eq: text, answer: CORR[real]!, wrongs: CORR.filter((_, i) => i !== real), ar: `يبين الجدول مجموعة من النقاط (x ، y): ${text}. ما نوع الارتباط بين x و y في شكل الانتشار؟`, en: `Points (x, y): ${text}. What kind of correlation does their scatter plot show?` };
  }
});

const cumulative = T('cumulative', /^المنحني التكراري التراكمي$/, [10, 10], ({ rng, diff }) => {
  const w = pick(rng, [10, 20]), k = span(diff, 4, 5, 6);
  const f = Array.from({ length: k }, () => int(rng, 2, 12));
  const label = (i: number) => `${i * w}–${(i + 1) * w - 1}`;
  const table = f.map((v, i) => `${label(i)}: ${v}`).join('، ');
  const tableEn = f.map((v, i) => `${label(i)}: ${v}`).join(', ');
  const n = sum(f);
  const j = int(rng, 1, k - 2);
  if (rng() < 0.55) { const c = sum(f.slice(0, j + 1)); return { eq: table, answer: String(c), wrongs: countOpts(c, [f[j]!, c + f[j + 1]!, c - f[0]!, n]), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما التكرار التراكمي حتى نهاية الفئة ${label(j)}؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the cumulative frequency up to the end of the class ${label(j)}?` }; }
  let acc = 0, mc = 0;
  for (let i = 0; i < k; i++) { acc += f[i]!; if (acc >= n / 2) { mc = i; break; } }
  const others = Array.from({ length: k }, (_, i) => i).filter(i => i !== mc).map(label);
  return { eq: table, answer: label(mc), wrongs: others.slice(0, 3), ar: `الجدول التكراري (الفئة: التكرار): ${table}. في أي فئة يقع الوسيط (القيمة التي ترتيبها n/2)؟`, en: `Frequency table (class: frequency): ${tableEn}. In which class does the median (the value in position n/2) lie?` };
});

const groupedMean = T('grouped_mean', /^مقاييس التشتت للجداول التكراريه ذات الفئات$/, [10, 10], ({ rng, diff }) => {
  const w = pick(rng, [4, 6, 10]);
  for (;;) {
    const k = span(diff, 3, 5, 5), half = (k - 1) / 2;
    const mid0 = half * w + w / 2 + int(rng, 0, 6) * w; // centre class midpoint; the first class starts at a non-negative multiple of w
    const f = Array.from({ length: k }, () => int(rng, 1, 8));
    for (let i = 0; i < half; i++) f[k - 1 - i] = f[i]!; // symmetric, so the mean is the centre midpoint
    const n = sum(f);
    const dev = f.map((v, i) => v * ((i - half) * w) ** 2);
    const variance = sum(dev) / n;
    if (variance * 10 !== Math.round(variance * 10) || variance === 0) continue;
    const mids = Array.from({ length: k }, (_, i) => mid0 + (i - half) * w);
    const lo = (m: number) => m - w / 2, hi = (m: number) => m + w / 2;
    // continuous classes: «60 إلى أقل من 70», so a boundary value belongs to exactly one class
    const table = mids.map((m, i) => `${lo(m)} إلى أقل من ${hi(m)}: ${f[i]}`).join('، ');
    const tableEn = mids.map((m, i) => `${lo(m)} to under ${hi(m)}: ${f[i]}`).join(', ');
    if (rng() < 0.5) return { eq: table, answer: String(mid0), wrongs: countOpts(mid0, [mid0 + w, mid0 - w, mids[0]!, mids[k - 1]!]), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما الوسط الحسابي التقريبي باستعمال مراكز الفئات؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the approximate mean using class midpoints?` };
    return { eq: table, answer: n1(variance), wrongs: decOpts(variance, [Math.sqrt(variance), variance * 2, sum(dev) / (n - 1), mid0].map(v => Math.round(v * 10) / 10).filter(v => v !== variance && v > 0), 0.5), ar: `الجدول التكراري (الفئة: التكرار): ${table}. ما التباين التقريبي باستعمال مراكز الفئات (القسمة على مجموع التكرارات)؟`, en: `Frequency table (class: frequency): ${tableEn}. What is the approximate variance using class midpoints (divide by the total frequency)?` };
  }
});

void gcd; void signed; void tier;

export const STATS_TOPICS: readonly Topic[] = [
  certainty('certainty_g3', /^اكيد ممكن مستحيل$/, [3, 3]), { id: 'certainty_g4', match: /^التجربه العشوائيه وانواع الحوادث$/, grades: [4, 4], make: c => (c.rng() < 0.4 ? outcomes : certainty('c4', /./, [4, 4])).make(c) },
  likelihood,
  probability('prob_g6', /^الاحتمالات$/, 6), probability('prob_g7', /^الاحتمالات$/, 7), experimental, counting, compound,
  venn('venn_g3', /^اشكال ڤن$/, [3, 3]), venn('venn_g4', /^تمثيل البيانات باشكال ڤن$/, [4, 4]), venn('venn_g9', /^الاحتمالات واشكال ڤن$/, [9, 9]), geometricProb,
  meanT('mean_g5', /^الوسط الحسابي$/, [5, 5]), meanT('mean_g7', /^الوسط الحسابي$/, [7, 7]),
  medianModeT('median_mode_g5', /^الوسيط والمنوال$/, [5, 5], ['median', 'mode']), medianModeT('range_g5', /^المدي$/, [5, 5], ['range']),
  medianModeT('median_mode_range_g7', /^الوسيط والمنوال والمدي$/, [7, 7], ['median', 'mode', 'range']),
  stemLeaf,
  readData('read_data_g12', /^(?:جداول البيانات|تمثيل البيانات بالصور|تفسير بيانات ممثله بالصور|تفسير البيانات الممثله بالصور|تفسير البيانات الممثله بجدول الاشارات|جمع البيانات وتنظيمها)$/, [1, 2]),
  readData('read_data_g34', /^(?:تمثيل البيانات بالاعمده|تفسير البيانات الممثله بالاعمده|تمثيل البيانات بالنقاط)$/, [3, 4]),
  freqTable,
  grouped('grouped_g6', /^الجداول والمخططات التكراريه ذات الفئات$/, [6, 6]), grouped('grouped_g9', /^(?:الجداول التكراريه ذات الفئات|المدرجات التكراريه)$/, [9, 9]),
  dispersion, scatter, cumulative, groupedMean,
];
