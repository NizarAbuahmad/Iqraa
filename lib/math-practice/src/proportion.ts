/**
 * Ratio, proportion and percent generators (Grades 7–8): unit rate,
 * proportions, direct and inverse variation, proportional division, money
 * (interest, discount, profit), map scale, similar figures and percent change.
 * Every figure is chosen so the answer is a whole number or a one-place
 * decimal, then printed in the stem.
 */
import { gcd, int, numWrongs, pick, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const ints = (ans: number, cands: number[]) => numWrongs(ans, cands.filter(Number.isInteger));
const decs = (ans: number, cands: number[], step = 0.5) =>
  wrongsFrom(n1(ans), cands.filter(c => Number.isFinite(c) && c > 0).map(n1), k => n1(ans + Math.abs(k) * step));

const unitRate = T('unit_rate', /^معدل الوحده$/, [7, 7], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const v = int(rng, 20, span(diff, 60, 90, 120)), h = int(rng, 2, 6); return { eq: `${v * h}, ${h}`, answer: String(v), wrongs: ints(v, [v * h, v + h, v * h - h, h]), ar: `قطعت سيارة ${v * h} كم في ${h} ساعات بسرعة ثابتة. ما سرعتها بالكيلومتر لكل ساعة؟`, en: `A car travels ${v * h} km in ${h} hours at a steady speed. What is its speed in km per hour?` }; }
  if (k === 1) { const p = int(rng, 2, span(diff, 9, 15, 30)), q = int(rng, 3, 9); return { eq: `${p * q}, ${q}`, answer: String(p), wrongs: ints(p, [p * q, p + q, p * q - q, q]), ar: `ثمن ${q} كيلوغرامات من التفاح ${p * q} دينارًا. كم ثمن الكيلوغرام الواحد بالدينار؟`, en: `${q} kg of apples cost ${p * q} dinars. What is the price of 1 kg in dinars?` }; }
  const q1 = int(rng, 2, 5), u1 = int(rng, 3, 9), q2 = q1 + int(rng, 1, 3), u2 = u1 + int(rng, 1, 2);
  // offer 1: q1 kg for q1*u1; offer 2: q2 kg for q2*u2 — compare the unit prices u1 and u2
  const first = u1 < u2;
  return { eq: `${q1 * u1}/${q1}, ${q2 * u2}/${q2}`, answer: first ? 'العرض الأول' : 'العرض الثاني', wrongs: [first ? 'العرض الثاني' : 'العرض الأول', 'السعر نفسه'], ar: `العرض الأول: ${q1} كغم بـ ${q1 * u1} دينارًا. العرض الثاني: ${q2} كغم بـ ${q2 * u2} دينارًا. أي العرضين أرخص للكيلوغرام الواحد؟`, en: `Offer 1: ${q1} kg for ${q1 * u1} dinars. Offer 2: ${q2} kg for ${q2 * u2} dinars. Which offer is cheaper per kilogram?` };
});

const proportion = T('proportion', /^التناسب$/, [7, 7], ({ rng, diff }) => {
  const a = int(rng, 2, 9), k = int(rng, 2, span(diff, 5, 8, 12)), b = int(rng, 2, 9);
  if (a === b) return proportion.make({ rng, diff, grade: 7 });
  const c = a * k, x = b * k, shown = rng() < 0.5;
  if (shown) return { eq: `${a}/${b} = ${c}/x`, answer: String(x), wrongs: ints(x, [b + (c - a), c + b, (c * a) / b | 0, x + k]), ar: `أوجد قيمة x في التناسب: ${a}/${b} = ${c}/x`, en: `Find x in the proportion ${a}/${b} = ${c}/x.` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(x), wrongs: ints(x, [b + (c - a), c + b, (c * a) / b | 0, x + k]), ar: `إذا كانت ${a} أقلام تكلف ${b} دنانير، فكم دينارًا تكلف ${c} قلمًا بالسعر نفسه؟`, en: `If ${a} pens cost ${b} dinars, how many dinars do ${c} pens cost at the same rate?` };
});

const proportionalRelation = T('proportional_relation', /^العلاقات التناسبيه$/, [7, 7], ({ rng, diff }) => {
  const k = int(rng, 2, span(diff, 6, 9, 12)), xs = [2, 3, 4, 5];
  const prop = rng() < 0.6;
  const off = int(rng, 1, 4);
  const ys = xs.map(x => (prop ? k * x : k * x + off));
  const table = xs.map((x, i) => `${x} → ${ys[i]}`).join('، ');
  const tableEn = xs.map((x, i) => `${x} → ${ys[i]}`).join(', ');
  if (rng() < 0.5) return { eq: table, answer: prop ? 'نعم' : 'لا', wrongs: [prop ? 'لا' : 'نعم'], ar: `الجدول (x → y): ${table}. هل العلاقة بين x و y تناسبية؟ (نعم / لا)`, en: `Table (x → y): ${tableEn}. Is the relation between x and y proportional? (yes / no)` };
  if (!prop) return proportionalRelation.make({ rng, diff, grade: 7 });
  return { eq: table, answer: String(k), wrongs: ints(k, [k + 1, k - 1, ys[0]! + xs[0]!, k * 2]), ar: `الجدول (x → y): ${table} علاقة تناسبية. ما ثابت التناسب y/x؟`, en: `Table (x → y): ${tableEn} is a proportional relation. What is the constant of proportionality y/x?` };
});

const directVar = T('direct_variation', /^التغير الطردي$/, [7, 7], ({ rng, diff }) => {
  const k = int(rng, 2, span(diff, 6, 9, 12)), x1 = int(rng, 2, 8), x2 = int(rng, 3, 12);
  if (x1 === x2) return directVar.make({ rng, diff, grade: 7 });
  if (rng() < 0.4) return { eq: `${x1}, ${k * x1}`, answer: String(k), wrongs: ints(k, [k + 1, k * x1, k - 1, x1]), ar: `y يتغير طرديًا مع x، وعندما x = ${x1} فإن y = ${k * x1}. ما ثابت التغير k؟`, en: `y varies directly with x, and y = ${k * x1} when x = ${x1}. What is the constant k?` };
  return { eq: `${x1}, ${k * x1}, ${x2}`, answer: String(k * x2), wrongs: ints(k * x2, [k * x1 + x2, k + x2, x2 * x1, k * x2 + k]), ar: `y يتغير طرديًا مع x، وعندما x = ${x1} فإن y = ${k * x1}. أوجد y عندما x = ${x2}.`, en: `y varies directly with x, and y = ${k * x1} when x = ${x1}. Find y when x = ${x2}.` };
});

const inverseVar = T('inverse_variation', /^التغير العكسي$/, [7, 7], ({ rng, diff }) => {
  const x1 = int(rng, 2, 9), q = int(rng, 2, span(diff, 8, 12, 20)), K = x1 * q;
  const divisors = Array.from({ length: K }, (_, i) => i + 1).filter(d => K % d === 0 && d !== x1);
  const x2 = pick(rng, divisors), y1 = K / x1;
  return { eq: `${x1}, ${y1}, ${x2}`, answer: String(K / x2), wrongs: ints(K / x2, [y1 + x2, y1 * x2, y1 - x2 > 0 ? y1 - x2 : y1 + 1, K / x2 + y1]), ar: `y يتغير عكسيًا مع x، وعندما x = ${x1} فإن y = ${y1}. أوجد y عندما x = ${x2}.`, en: `y varies inversely with x, and y = ${y1} when x = ${x1}. Find y when x = ${x2}.` };
});

const proportionalDivision = T('proportional_division', /^التقسيم التناسبي$/, [7, 7], ({ rng, diff }) => {
  const parts = rng() < 0.7 || diff === 'easy' ? 2 : 3;
  const rs = Array.from({ length: parts }, () => int(rng, 1, 6));
  if (new Set(rs).size < parts) return proportionalDivision.make({ rng, diff, grade: 7 });
  const unit = int(rng, 2, span(diff, 10, 20, 40)), total = unit * rs.reduce((a, b) => a + b, 0);
  const g = rs.reduce(gcd);
  if (g !== 1) return proportionalDivision.make({ rng, diff, grade: 7 });
  const big = Math.max(...rs) * unit, small = Math.min(...rs) * unit;
  const ratio = rs.join(' : ');
  const largest = rng() < 0.5;
  return { eq: `${total}, ${ratio}`, answer: String(largest ? big : small), wrongs: ints(largest ? big : small, [total / parts, largest ? small : big, unit, total - (largest ? big : small)]), ar: `قُسّم مبلغ ${total} دينارًا بين أشخاص بنسبة ${ratio}. كم دينارًا يأخذ صاحب ${largest ? 'النصيب الأكبر' : 'النصيب الأصغر'}؟`, en: `${total} dinars is shared in the ratio ${ratio}. How many dinars does the person with the ${largest ? 'largest' : 'smallest'} share get?` };
});

const financial = T('financial_math', /^تطبيقات ماليه$/, [7, 7], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 0) { const P = int(rng, 2, 20) * 100, r = int(rng, 2, span(diff, 6, 8, 10)), t = int(rng, 1, 5); const I = (P * r * t) / 100; return { eq: `${P}, ${r}, ${t}`, answer: String(I), wrongs: ints(I, [P * r * t, I + P, (P * r) / 100, I * 2]), ar: `ما الفائدة البسيطة على مبلغ ${P} دينارًا بمعدل ${r}% سنويًا لمدة ${t === 1 ? 'سنة واحدة' : t === 2 ? 'سنتين' : `${t} سنوات`}؟`, en: `What is the simple interest on ${P} dinars at ${r}% per year for ${t} year${t === 1 ? '' : 's'}?` }; }
  if (k === 1) { const price = int(rng, 2, 20) * 20, d = pick(rng, [10, 20, 25, 50]); const now = price - (price * d) / 100; return { eq: `${price}, ${d}`, answer: String(now), wrongs: ints(now, [(price * d) / 100, price - d, price + (price * d) / 100, now + d]), ar: `ثمن سلعة ${price} دينارًا، وعليها خصم ${d}%. ما ثمنها بعد الخصم؟`, en: `An item costs ${price} dinars with a ${d}% discount. What is its price after the discount?` }; }
  if (k === 2) { const cost = int(rng, 2, 20) * 20, p = pick(rng, [10, 20, 25, 50]); const sell = cost + (cost * p) / 100; return { eq: `${cost}, ${p}`, answer: String(sell), wrongs: ints(sell, [(cost * p) / 100, cost + p, cost - (cost * p) / 100, sell + p]), ar: `اشترى تاجر سلعة بـ ${cost} دينارًا وباعها بربح ${p}%. بكم باعها؟`, en: `A trader buys an item for ${cost} dinars and sells it at a ${p}% profit. What is the selling price?` }; }
  const cost = int(rng, 2, 20) * 20, p = pick(rng, [10, 20, 25, 50]), profit = (cost * p) / 100;
  return { eq: `${cost}, ${cost + profit}`, answer: `${p}%`, wrongs: wrongsFrom(`${p}%`, [`${profit}%`, `${100 - p}%`, `${p * 2}%`, `${p + 10}%`], k2 => `${p + 5 * Math.abs(k2)}%`), ar: `اشترى تاجر سلعة بـ ${cost} دينارًا وباعها بـ ${cost + profit} دينارًا. ما نسبة الربح المئوية؟`, en: `A trader buys an item for ${cost} dinars and sells it for ${cost + profit} dinars. What is the percentage profit?` };
});

const scale = T('map_scale', /^مقياس الرسم$/, [7, 7], ({ rng, diff }) => {
  const km = pick(rng, [1, 2, 5, 10, 20, 25, 50]), cm = int(rng, 2, span(diff, 8, 12, 20));
  if (rng() < 0.55) return { eq: `1:${km}, ${cm}`, answer: String(km * cm), wrongs: ints(km * cm, [km + cm, cm / km > 0 ? Math.round(cm / km) : 1, km * cm * 10, km * cm + km]), ar: `مقياس رسم خريطة 1 سم : ${km} كم. المسافة بين مدينتين على الخريطة ${cm} سم. ما المسافة الحقيقية بالكيلومتر؟`, en: `A map scale is 1 cm : ${km} km. Two cities are ${cm} cm apart on the map. What is the real distance in km?` };
  return { eq: `1:${km}, ${km * cm}`, answer: String(cm), wrongs: ints(cm, [km * cm, cm + km, cm * 2, km]), ar: `مقياس رسم خريطة 1 سم : ${km} كم. المسافة الحقيقية بين مدينتين ${km * cm} كم. كم سنتيمترًا تبلغ المسافة بينهما على الخريطة؟`, en: `A map scale is 1 cm : ${km} km. Two cities are ${km * cm} km apart. How many cm apart are they on the map?` };
});

const similar = T('similar_figures', /^التشابه$/, [7, 7], ({ rng, diff }) => {
  const a = int(rng, 2, 8), b = int(rng, 2, 8), k = int(rng, 2, span(diff, 4, 5, 6));
  if (rng() < 0.5) return { eq: `${a}x${b}, ${a * k}`, answer: String(b * k), wrongs: ints(b * k, [b + k, b + (a * k - a), a * b, b * k + k]), ar: `مستطيلان متشابهان، أبعاد الأول ${a} سم و ${b} سم، وطول الثاني المناظر لـ ${a} هو ${a * k} سم. ما طول بُعده الآخر؟`, en: `Two rectangles are similar. The first is ${a} cm by ${b} cm and the side of the second matching ${a} cm is ${a * k} cm. What is its other side?` };
  return { eq: `${a}, ${a * k}`, answer: String(k), wrongs: ints(k, [a * k - a, k + 1, a * k, k * k]), ar: `شكلان متشابهان، طول ضلع في الأول ${a} سم وطول الضلع المناظر له في الثاني ${a * k} سم. ما معامل التشابه من الأول إلى الثاني؟`, en: `Two figures are similar. A side of the first is ${a} cm and the matching side of the second is ${a * k} cm. What is the scale factor from the first to the second?` };
});

const percent = T('percent_g8', /^النسبه المئويه$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3, 4]);
  const p = pick(rng, [5, 10, 15, 20, 25, 30, 40, 50, 60, 75]), base = int(rng, 1, 12) * 20;
  if (k === 0) { const v = (base * p) / 100; return { eq: `${p}%, ${base}`, answer: n1(v), wrongs: decs(v, [base + p, v * 10, base - v, v / 2]), ar: `ما ${p}% من ${base}؟`, en: `What is ${p}% of ${base}?` }; }
  if (k === 1) { const v = (base * p) / 100; return { eq: `${v}, ${base}`, answer: `${p}%`, wrongs: wrongsFrom(`${p}%`, [`${(base / v) * 10 | 0}%`, `${100 - p}%`, `${p * 2}%`, `${p + 10}%`], j => `${p + 5 * Math.abs(j)}%`), ar: `ما النسبة المئوية التي يمثلها ${n1(v)} من ${base}؟`, en: `What percent of ${base} is ${n1(v)}?` }; }
  if (k === 2) { const up = rng() < 0.5, v = (base * p) / 100, fin = up ? base + v : base - v; return { eq: `${base}, ${fin}`, answer: `${p}%`, wrongs: wrongsFrom(`${p}%`, [`${Math.round((v / fin) * 100)}%`, `${100 - p}%`, `${p + 10}%`, `${p * 2}%`], j => `${p + 5 * Math.abs(j)}%`), ar: `${up ? 'ارتفع' : 'انخفض'} سعر سلعة من ${base} إلى ${n1(fin)} دينارًا. ما نسبة ${up ? 'الزيادة' : 'النقصان'} المئوية؟`, en: `The price of an item ${up ? 'rose' : 'fell'} from ${base} to ${n1(fin)} dinars. What is the percent ${up ? 'increase' : 'decrease'}?` }; }
  if (k === 3) { const v = (base * p) / 100; return { eq: `${p}%, ${v}`, answer: String(base), wrongs: ints(base, [v * 100 / (100 + p) | 0, v * p, base + v, base - v]), ar: `${p}% من عدد يساوي ${n1(v)}. ما العدد؟`, en: `${p}% of a number is ${n1(v)}. What is the number?` }; }
  const fin = base + (base * p) / 100;
  return { eq: `${p}%, ${fin}`, answer: String(base), wrongs: ints(base, [fin - p, Math.round(fin * (1 - p / 100)), fin - (fin * p) / 100 | 0, fin + p]), ar: `بعد زيادة ${p}% أصبح سعر سلعة ${n1(fin)} دينارًا. ما سعرها الأصلي؟`, en: `After a ${p}% increase an item costs ${n1(fin)} dinars. What was its original price?` };
});

export const PROPORTION_TOPICS: readonly Topic[] = [
  unitRate, proportion, proportionalRelation, directVar, inverseVar, proportionalDivision, financial, scale, similar, percent,
];
