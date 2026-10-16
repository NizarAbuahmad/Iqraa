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
const deg = (ans: number, cands: number[]) =>
  wrongsFrom(`${ans}°`, cands.filter(c => Number.isInteger(c) && c > 0 && c < 180).map(c => `${c}°`), k => `${ans + 5 * Math.abs(k)}°`);
/** Equation options such as «y = 3x»: the near fallback keeps the form, so there are always three. */
const eqOpts = (ans: string, cands: string[], near: (k: number) => string) => wrongsFrom(ans, cands, near);
/** «5 أقلام» / «12 قلمًا» / «100 قلم»: the counted noun after a numeral. */
const tamyiz = (n: number, plural: string, singularAcc: string, singularGen: string) => {
  const r = n % 100;
  return r >= 3 && r <= 10 ? plural : n >= 100 && r <= 2 ? singularGen : singularAcc;
};
const dinars = (n: number) => `${n} ${tamyiz(n, 'دنانير', 'دينارًا', 'دينار')}`;

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
  const c = a * k, x = b * k, kind = pick(rng, [0, 1, 2, 3]);
  if (kind === 2) { // is it a proportion? «no» is often the additive slip: the same number added to both terms
    const yes = rng() < 0.5, add = int(rng, 1, 6);
    const [p, q] = yes ? [c, x] : rng() < 0.6 ? [a + add, b + add] : [c, x + pick(rng, [1, 2, b])];
    return { eq: `${a}/${b}, ${p}/${q}`, answer: a * q === b * p ? 'نعم' : 'لا', wrongs: [a * q === b * p ? 'لا' : 'نعم'], ar: `هل تشكّل النسبتان ${a}/${b} و ${p}/${q} تناسبًا؟ (نعم / لا)`, en: `Do the ratios ${a}/${b} and ${p}/${q} form a proportion? (yes / no)` };
  }
  if (kind === 3) { // a recipe: cups of flour to eggs, find the eggs
    const f = int(rng, 3, 9), e = int(rng, 3, 9);
    if (f === e) return proportion.make({ rng, diff, grade: 7 });
    const F = f * k, E = e * k;
    return { eq: `${f}, ${e}, ${F}`, answer: String(E), wrongs: ints(E, [e + (F - f), F, (F * f) / e, E + k]), ar: `تحتاج وصفة كعك إلى ${f} أكواب من الطحين لكل ${e} بيضات. كم بيضة تلزم إذا استُعمل ${F} ${tamyiz(F, 'أكواب', 'كوبًا', 'كوب')} من الطحين بالنسبة نفسها؟`, en: `A cake recipe uses ${f} cups of flour for every ${e} eggs. How many eggs are needed for ${F} cups of flour in the same ratio?` };
  }
  if (kind === 0) return { eq: `${a}/${b} = ${c}/x`, answer: String(x), wrongs: ints(x, [b + (c - a), c + b, (c * a) / b | 0, x + k]), ar: `أوجد قيمة x في التناسب: ${a}/${b} = ${c}/x`, en: `Find x in the proportion ${a}/${b} = ${c}/x.` };
  return { eq: `${a}, ${b}, ${c}`, answer: String(x), wrongs: ints(x, [b + (c - a), c + b, (c * a) / b | 0, x + k]), ar: `إذا كانت ${a} أقلام تكلف ${b} دنانير، فكم دينارًا تكلف ${c} قلمًا بالسعر نفسه؟`, en: `If ${a} pens cost ${b} dinars, how many dinars do ${c} pens cost at the same rate?` };
});

const proportionalRelation = T('proportional_relation', /^العلاقات التناسبيه$/, [7, 7], ({ rng, diff }) => {
  const k = int(rng, 2, span(diff, 6, 9, 12)), xs = [2, 3, 4, 5];
  const prop = rng() < 0.6;
  const off = int(rng, 1, 4);
  const ys = xs.map(x => (prop ? k * x : k * x + off));
  const table = xs.map((x, i) => `${x} → ${ys[i]}`).join('، ');
  const tableEn = xs.map((x, i) => `${x} → ${ys[i]}`).join(', ');
  const kind = pick(rng, [0, 0, 1, 2, 3, 4, 5]);
  if (kind >= 2) {
    const yt = xs.map(x => k * x), t = xs.map((x, i) => `${x} → ${yt[i]}`).join('، '), tEn = xs.map((x, i) => `${x} → ${yt[i]}`).join(', ');
    const x2 = int(rng, 6, 12);
    if (kind === 2) return { eq: t, answer: String(k * x2), wrongs: ints(k * x2, [yt[3]! + (x2 - xs[3]!), k * x2 + k, x2 + k, yt[3]! + yt[0]!]), ar: `الجدول (x → y) يمثل علاقة تناسبية: ${t}. ما قيمة y عندما x = ${x2}؟`, en: `The table (x → y) shows a proportional relation: ${tEn}. What is y when x = ${x2}?` };
    if (kind === 3) { const ans = `y = ${k}x`; return { eq: t, answer: ans, wrongs: eqOpts(ans, [`y = x + ${yt[0]! - xs[0]!}`, `x = ${k}y`, `y = ${yt[0]}x`], j => `y = ${k + Math.abs(j)}x`), ar: `الجدول (x → y) يمثل علاقة تناسبية: ${t}. ما المعادلة التي تمثل هذه العلاقة؟`, en: `The table (x → y) shows a proportional relation: ${tEn}. Which equation represents it?` }; }
    if (kind === 4) { const px = int(rng, 2, 6); return { eq: `${px}, ${k * px}`, answer: String(k), wrongs: ints(k, [k * px, k * px - px, px, k + 1]), ar: `يمر المستقيم الذي يمثل علاقة تناسبية في المستوى الإحداثي بنقطة الأصل وبالنقطة (${px} ، ${k * px}). ما ثابت التناسب؟`, en: `The line of a proportional relation in the coordinate plane passes through the origin and (${px}, ${k * px}). What is the constant of proportionality?` }; }
    // kind 5: pay proportional to hours worked
    const h = int(rng, 3, 8), h2 = int(rng, 3, 10);
    if (h === h2) return proportionalRelation.make({ rng, diff, grade: 7 });
    return { eq: `${k * h}, ${h}, ${h2}`, answer: String(k * h2), wrongs: ints(k * h2, [k * h + (h2 - h), k * h * h2, k * h + h2, k * h2 + k]), ar: `أجر عامل يتناسب مع عدد ساعات عمله. إذا كان أجره ${dinars(k * h)} مقابل ${h} ساعات، فكم دينارًا يكون أجره مقابل ${h2} ساعات؟`, en: `A worker's pay is proportional to the hours worked. If the pay is ${k * h} dinars for ${h} hours, how many dinars is it for ${h2} hours?` };
  }
  if (kind === 0) return { eq: table, answer: prop ? 'نعم' : 'لا', wrongs: [prop ? 'لا' : 'نعم'], ar: `الجدول (x → y): ${table}. هل العلاقة بين x و y تناسبية؟ (نعم / لا)`, en: `Table (x → y): ${tableEn}. Is the relation between x and y proportional? (yes / no)` };
  if (!prop) return proportionalRelation.make({ rng, diff, grade: 7 });
  return { eq: table, answer: String(k), wrongs: ints(k, [k + 1, k - 1, ys[0]! + xs[0]!, k * 2]), ar: `الجدول (x → y): ${table} علاقة تناسبية. ما ثابت التناسب y/x؟`, en: `Table (x → y): ${tableEn} is a proportional relation. What is the constant of proportionality y/x?` };
});

const directVar = T('direct_variation', /^التغير الطردي$/, [7, 7], ({ rng, diff }) => {
  const k = int(rng, 2, span(diff, 6, 9, 12)), x1 = int(rng, 2, 8), x2 = int(rng, 3, 12);
  if (x1 === x2) return directVar.make({ rng, diff, grade: 7 });
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  const given = `y يتغير طرديًا مع x، وعندما x = ${x1} فإن y = ${k * x1}.`, givenEn = `y varies directly with x, and y = ${k * x1} when x = ${x1}.`;
  if (kind === 2) { const ans = `y = ${k}x`; return { eq: `${x1}, ${k * x1}`, answer: ans, wrongs: eqOpts(ans, [`y = ${k * x1}x`, `y = x + ${k * x1 - x1}`, `x = ${k}y`], j => `y = ${k + Math.abs(j)}x`), ar: `${given} ما معادلة التغير الطردي؟`, en: `${givenEn} What is the direct variation equation?` }; }
  if (kind === 3) return { eq: `${x1}, ${k * x1}, y=${k * x2}`, answer: String(x2), wrongs: ints(x2, [k * k * x2, k * x2 - k * x1 + x1, x2 + k, k * x2]), ar: `${given} ما قيمة x التي تكون عندها y = ${k * x2}؟`, en: `${givenEn} For which x is y = ${k * x2}?` };
  if (kind === 4) {
    const b = int(rng, 1, 9), form = pick(rng, [0, 0, 1, 2, 3]);
    const eq = form === 0 ? `y = ${k}x` : form === 1 ? `y = ${k}x + ${b}` : form === 2 ? `y = x + ${k}` : `xy = ${k * b}`;
    return { eq, answer: form === 0 ? 'نعم' : 'لا', wrongs: [form === 0 ? 'لا' : 'نعم'], ar: `هل تمثل المعادلة ${eq} تغيرًا طرديًا؟ (نعم / لا)`, en: `Does the equation ${eq} show direct variation? (yes / no)` };
  }
  if (kind === 0) return { eq: `${x1}, ${k * x1}`, answer: String(k), wrongs: ints(k, [k + 1, k * x1, k - 1, x1]), ar: `y يتغير طرديًا مع x، وعندما x = ${x1} فإن y = ${k * x1}. ما ثابت التغير k؟`, en: `y varies directly with x, and y = ${k * x1} when x = ${x1}. What is the constant k?` };
  return { eq: `${x1}, ${k * x1}, ${x2}`, answer: String(k * x2), wrongs: ints(k * x2, [k * x1 + x2, k + x2, x2 * x1, k * x2 + k]), ar: `y يتغير طرديًا مع x، وعندما x = ${x1} فإن y = ${k * x1}. أوجد y عندما x = ${x2}.`, en: `y varies directly with x, and y = ${k * x1} when x = ${x1}. Find y when x = ${x2}.` };
});

const inverseVar = T('inverse_variation', /^التغير العكسي$/, [7, 7], ({ rng, diff }) => {
  const x1 = int(rng, 2, 9), q = int(rng, 2, span(diff, 8, 12, 20)), K = x1 * q;
  const divisors = Array.from({ length: K }, (_, i) => i + 1).filter(d => K % d === 0 && d !== x1);
  const x2 = pick(rng, divisors), y1 = K / x1;
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  const given = `y يتغير عكسيًا مع x، وعندما x = ${x1} فإن y = ${y1}.`, givenEn = `y varies inversely with x, and y = ${y1} when x = ${x1}.`;
  if (kind === 1) return { eq: `${x1}, ${y1}`, answer: String(K), wrongs: ints(K, [x1 + y1, y1 / x1, x1 * y1 + y1, K * 2]), ar: `${given} ما ثابت التغير k؟`, en: `${givenEn} What is the constant k?` };
  if (kind === 2) { const ans = `y = ${K}/x`; return { eq: `${x1}, ${y1}`, answer: ans, wrongs: eqOpts(ans, [`y = ${K}x`, `y = ${y1}/x`, `y = ${x1 + y1}/x`], j => `y = ${K + Math.abs(j)}/x`), ar: `${given} ما معادلة التغير العكسي؟`, en: `${givenEn} What is the inverse variation equation?` }; }
  if (kind === 3) { // decreasing is not enough: the products x·y must all be equal
    const inv = rng() < 0.5, xs = [1, 2, 3, 4], C = 12 * int(rng, 1, 5), d = int(rng, 2, 5), a0 = 3 * d + int(rng, 1, 12);
    const ys = inv ? xs.map(x => C / x) : xs.map((_, i) => a0 - i * d);
    const t = xs.map((x, i) => `${x} → ${ys[i]}`).join('، '), tEn = xs.map((x, i) => `${x} → ${ys[i]}`).join(', ');
    const yes = new Set(xs.map((x, i) => x * ys[i]!)).size === 1;
    return { eq: t, answer: yes ? 'نعم' : 'لا', wrongs: [yes ? 'لا' : 'نعم'], ar: `الجدول (x → y): ${t}. هل يتغير y عكسيًا مع x؟ (نعم / لا)`, en: `Table (x → y): ${tEn}. Does y vary inversely with x? (yes / no)` };
  }
  if (kind === 4) { // workers and days: more workers, fewer days
    const w1 = int(rng, 3, 10), d1 = int(rng, 3, span(diff, 8, 12, 15)), W = w1 * d1;
    const opts = Array.from({ length: 20 }, (_, i) => i + 2).filter(w => w !== w1 && W % w === 0 && w >= 3 && w <= 24);
    if (!opts.length) return inverseVar.make({ rng, diff, grade: 7 });
    const w2 = pick(rng, opts), d2 = W / w2;
    return { eq: `${w1}, ${d1}, ${w2}`, answer: String(d2), wrongs: ints(d2, [(d1 * w2) / w1, d1 + w1 - w2 > 0 ? d1 + w1 - w2 : d1 + 1, W, d1]), ar: `يُنجز ${w1} ${tamyiz(w1, 'عمال', 'عاملًا', 'عامل')} عملًا ما في ${d1} ${tamyiz(d1, 'أيام', 'يومًا', 'يوم')}. في كم يومًا يُنجز ${w2} ${tamyiz(w2, 'عمال', 'عاملًا', 'عامل')} العمل نفسه إذا عملوا بالسرعة نفسها؟`, en: `${w1} workers finish a job in ${d1} days. How many days do ${w2} workers take for the same job at the same rate?` };
  }
  return { eq: `${x1}, ${y1}, ${x2}`, answer: String(K / x2), wrongs: ints(K / x2, [y1 + x2, y1 * x2, y1 - x2 > 0 ? y1 - x2 : y1 + 1, K / x2 + y1]), ar: `y يتغير عكسيًا مع x، وعندما x = ${x1} فإن y = ${y1}. أوجد y عندما x = ${x2}.`, en: `y varies inversely with x, and y = ${y1} when x = ${x1}. Find y when x = ${x2}.` };
});

const TRI_RATIOS: Array<[number, number, number]> = [[1, 2, 3], [2, 3, 4], [1, 3, 5], [3, 4, 5], [2, 3, 5], [1, 4, 5], [4, 5, 6], [1, 2, 6], [2, 3, 7], [3, 5, 7], [2, 5, 8], [1, 1, 2], [2, 2, 5]];
/**
 * Sharing in a ratio — and since 2026-10-16 the whole from one share, the
 * difference between two shares, and the angles of a triangle in a ratio.
 */
const proportionalDivision = T('proportional_division', /^التقسيم التناسبي$/, [7, 7], ({ rng, diff }) => {
  const kind = pick(rng, [0, 0, 1, 2, 3]);
  if (kind === 3) {
    const rs = pick(rng, TRI_RATIOS), u = 180 / (rs[0] + rs[1] + rs[2]), big = rng() < 0.6;
    const ans = (big ? Math.max(...rs) : Math.min(...rs)) * u;
    return { eq: rs.join(' : '), answer: `${ans}°`, wrongs: deg(ans, [u, 60, big ? Math.min(...rs) * u : Math.max(...rs) * u, (big ? Math.max(...rs) : Math.min(...rs)) * 10]), ar: `قياسات زوايا مثلث بنسبة ${rs.join(' : ')}. ما قياس ${big ? 'أكبر' : 'أصغر'} زاوية فيه؟`, en: `The angles of a triangle are in the ratio ${rs.join(' : ')}. What is the ${big ? 'largest' : 'smallest'} angle?` };
  }
  if (kind === 1 || kind === 2) {
    const r1 = int(rng, 1, 7), r2 = int(rng, 1, 7), unit = int(rng, 3, span(diff, 10, 20, 40)); // a share of at least 3 dinars, so «دنانير/دينارًا» agrees
    if (r1 === r2 || gcd(r1, r2) !== 1) return proportionalDivision.make({ rng, diff, grade: 7 });
    const total = (r1 + r2) * unit;
    if (kind === 1) return { eq: `${r1} : ${r2}, ${r1 * unit}`, answer: String(total), wrongs: ints(total, [r1 * unit + r2, r2 * unit, r1 * unit * r2, total + unit]), ar: `قُسّم مبلغ من المال بين أخوين بنسبة ${r1} : ${r2}، فكان نصيب الأول ${dinars(r1 * unit)}. كم دينارًا المبلغ كله؟`, en: `A sum of money is shared between two brothers in the ratio ${r1} : ${r2}, and the first gets ${r1 * unit} dinars. How many dinars is the whole sum?` };
    const d = Math.abs(r1 - r2) * unit;
    return { eq: `${total}, ${r1} : ${r2}`, answer: String(d), wrongs: ints(d, [Math.abs(r1 - r2), Math.max(r1, r2) * unit, total / 2, d + unit]), ar: `قُسّم مبلغ ${dinars(total)} بين شخصين بنسبة ${r1} : ${r2}. بكم دينارًا يزيد النصيب الأكبر على النصيب الأصغر؟`, en: `${total} dinars is shared between two people in the ratio ${r1} : ${r2}. By how many dinars does the larger share exceed the smaller?` };
  }
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
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 2) return { eq: `${cm}, ${km * cm}`, answer: String(km), wrongs: ints(km, [km * cm - cm, cm, km * cm * cm, km * 10]), ar: `المسافة بين مدينتين على الخريطة ${cm} سم، والمسافة الحقيقية بينهما ${km * cm} كم. كم كيلومترًا يمثل كل 1 سم على الخريطة؟`, en: `Two cities are ${cm} cm apart on a map and ${km * cm} km apart in reality. How many km does 1 cm on the map stand for?` };
  if (kind === 3 || kind === 4) { // a model: 1 : s, lengths in cm on the model and in metres in reality
    const s = pick(rng, [20, 25, 50, 100, 200]), step = 100 / gcd(s, 100);
    const L = step * int(rng, Math.ceil(4 / step), Math.floor(span(diff, 30, 45, 60) / step)), R = (L * s) / 100;
    if (R < 3 || R > 80) return scale.make({ rng, diff, grade: 7 });
    const [obj, objEn] = R <= 6 ? ['سيارة', 'car'] : R <= 15 ? ['حافلة', 'bus'] : ['سفينة', 'ship'];
    if (kind === 3) return { eq: `1:${s}, ${L}`, answer: String(R), wrongs: ints(R, [L * s, (L * s) / 10, L + s, R * 10]), ar: `صُنع نموذج ل${obj} بمقياس 1 : ${s}. إذا كان طول النموذج ${L} سم، فما الطول الحقيقي لل${obj} بالمتر؟`, en: `A model of a ${objEn} is made at a scale of 1 : ${s}. If the model is ${L} cm long, how long is the real ${objEn} in metres?` };
    return { eq: `1:${s}, ${R}`, answer: String(L), wrongs: ints(L, [R * s, (R * 10) / s, R * 100, L * 10]), ar: `طول ${obj} ${R} م. صُنع لها نموذج بمقياس 1 : ${s}. ما طول النموذج بالسنتيمتر؟`, en: `A ${objEn} is ${R} m long. A model of it is made at a scale of 1 : ${s}. How long is the model in cm?` };
  }
  if (kind === 0) return { eq: `1:${km}, ${cm}`, answer: String(km * cm), wrongs: ints(km * cm, [km + cm, cm / km > 0 ? Math.round(cm / km) : 1, km * cm * 10, km * cm + km]), ar: `مقياس رسم خريطة 1 سم : ${km} كم. المسافة بين مدينتين على الخريطة ${cm} سم. ما المسافة الحقيقية بالكيلومتر؟`, en: `A map scale is 1 cm : ${km} km. Two cities are ${cm} cm apart on the map. What is the real distance in km?` };
  return { eq: `1:${km}, ${km * cm}`, answer: String(cm), wrongs: ints(cm, [km * cm, cm + km, cm * 2, km]), ar: `مقياس رسم خريطة 1 سم : ${km} كم. المسافة الحقيقية بين مدينتين ${km * cm} كم. كم سنتيمترًا تبلغ المسافة بينهما على الخريطة؟`, en: `A map scale is 1 cm : ${km} km. Two cities are ${km * cm} km apart. How many cm apart are they on the map?` };
});

const similar = T('similar_figures', /^التشابه$/, [7, 7], ({ rng, diff }) => {
  const a = int(rng, 2, 8), b = int(rng, 2, 8), k = int(rng, 2, span(diff, 4, 5, 6));
  const kind = pick(rng, [0, 1, 2, 3, 4, 5]);
  if (kind === 2) { // corresponding angles are equal
    const A = 5 * int(rng, 6, 16), B = 5 * int(rng, 6, 16), C = 180 - A - B;
    if (C <= 0 || A === B || B === C || A === C) return similar.make({ rng, diff, grade: 7 });
    const third = rng() < 0.6, ans = third ? C : B;
    return { eq: `${A}, ${B}`, answer: `${ans}°`, wrongs: deg(ans, [A, third ? B : C, 180 - (third ? C : B), A + B]), ar: `المثلث ABC يشابه المثلث DEF، حيث يناظر الرأس A الرأس D، والرأس B الرأس E، والرأس C الرأس F. إذا كان قياس الزاوية A يساوي ${A}° وقياس الزاوية B يساوي ${B}°، فما قياس الزاوية ${third ? 'F' : 'E'}؟`, en: `Triangle ABC is similar to triangle DEF, with A matching D, B matching E and C matching F. If angle A is ${A}° and angle B is ${B}°, what is angle ${third ? 'F' : 'E'}?` };
  }
  if (kind === 3) { // shadows at the same moment: height / shadow is the same for both
    const h = int(rng, 2, 6), s = int(rng, 2, 5), m = int(rng, 2, 5);
    if (h === s) return similar.make({ rng, diff, grade: 7 });
    const S = s * m, H = h * m;
    return { eq: `${h}, ${s}, ${S}`, answer: String(H), wrongs: ints(H, [S + (h - s), (s * S) / h, h * S, H + m]), ar: `طول عمود ${h} م وطول ظله ${s} م، وفي الوقت نفسه كان طول ظل شجرة ${S} م. ما طول الشجرة بالمتر؟`, en: `A pole ${h} m tall casts a shadow ${s} m long, and at the same moment a tree casts a shadow ${S} m long. How tall is the tree in metres?` };
  }
  if (kind === 4) { // similar rectangles: the sides must be in one ratio (either way round)
    // scale factor num/den (e.g. 3/2), so «similar» is not just «both doubled»; «not» adds to one side only
    const num = int(rng, 3, 5), den = num - 1;
    if (a === b) return similar.make({ rng, diff, grade: 7 });
    const p = a * den, q = b * den, r = a * num, t = rng() < 0.5 ? b * num : b * num + pick(rng, [1, 2]);
    const sim = p * t === q * r || p * r === q * t;
    return { eq: `${p}x${q}, ${r}x${t}`, answer: sim ? 'نعم' : 'لا', wrongs: [sim ? 'لا' : 'نعم'], ar: `مستطيل بُعداه ${p} سم و ${q} سم، ومستطيل آخر بُعداه ${r} سم و ${t} سم. هل المستطيلان متشابهان؟ (نعم / لا)`, en: `One rectangle is ${p} cm by ${q} cm and another is ${r} cm by ${t} cm. Are the rectangles similar? (yes / no)` };
  }
  if (kind === 5) { // perimeters scale by the same factor as the sides
    const P = 2 * (a + b);
    return { eq: `${k}, ${P}`, answer: String(k * P), wrongs: ints(k * P, [P + k, k * k * P, P * 2, k * P + k]), ar: `مضلعان متشابهان، معامل التشابه من الأصغر إلى الأكبر ${k}، ومحيط الأصغر ${P} سم. ما محيط الأكبر بالسنتيمتر؟`, en: `Two polygons are similar with scale factor ${k} from the smaller to the larger. The smaller has perimeter ${P} cm. What is the perimeter of the larger in cm?` };
  }
  if (kind === 0) return { eq: `${a}x${b}, ${a * k}`, answer: String(b * k), wrongs: ints(b * k, [b + k, b + (a * k - a), a * b, b * k + k]), ar: `مستطيلان متشابهان، أبعاد الأول ${a} سم و ${b} سم، وطول الثاني المناظر لـ ${a} هو ${a * k} سم. ما طول بُعده الآخر؟`, en: `Two rectangles are similar. The first is ${a} cm by ${b} cm and the side of the second matching ${a} cm is ${a * k} cm. What is its other side?` };
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
