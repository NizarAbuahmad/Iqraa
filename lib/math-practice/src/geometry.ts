/**
 * Geometry and measurement topic generators (Grades 3–10): perimeter and area,
 * circles, solids, angles, triangles and quadrilaterals, Pythagoras,
 * similarity, coordinate transformations, trigonometry, circle theorems,
 * units and time. Same contract as `topics.ts` and `algebra.ts`: the lesson
 * title picks the generator, every answer is computed from the numbers in the
 * stem, never typed.
 *
 * Lengths are in cm and areas in cm² throughout, written into the stem, so an
 * answer is a bare number (or «Nπ» when the lesson works in terms of π).
 */
import { gcd, int, nz, pick, sfrac, signed, tamyiz, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, grades: [number, number], make: Gen): Topic => ({ id, match, grades, make });

const shuffle = <X,>(rng: Rng, xs: X[]) => {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
};
/** Positive whole-number options. */
const pos = (ans: number, cands: number[]) =>
  wrongsFrom(String(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(String), k => String(ans + Math.abs(k)));
const deg = (ans: number, cands: number[]) =>
  wrongsFrom(`${ans}°`, cands.filter(c => Number.isInteger(c) && c > 0).map(c => `${c}°`), k => `${ans + Math.abs(k)}°`);
const PI = (k: number) => (k === 1 ? 'π' : `${k}π`);
const piOpts = (ans: number, cands: number[]) =>
  wrongsFrom(PI(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(PI), k => PI(ans + Math.abs(k)));
const pt = (x: number, y: number) => `(${signed(x)} ، ${signed(y)})`;
const ptOpts = (ans: [number, number], cands: Array<[number, number]>) =>
  wrongsFrom(pt(...ans), cands.map(c => pt(...c)), k => pt(ans[0] + Math.abs(k), ans[1]));
/** A name answer with three other names from the same list. */
const names = (rng: Rng, ans: string, all: string[]) => shuffle(rng, all.filter(x => x !== ans)).slice(0, 3);
/** «دقيقة / دقيقتان … دقائق / دقيقة» — the number-noun agreement a teacher would write. */
const minAr = (n: number) => (n === 1 ? 'دقيقة واحدة' : n === 2 ? 'دقيقتين' : n <= 10 ? `${n} دقائق` : `${n} دقيقة`);
const hourAr = (n: number) => (n === 1 ? 'ساعة واحدة' : n === 2 ? 'ساعتين' : n <= 10 ? `${n} ساعات` : `${n} ساعة`);
const unitAr = (n: number) => (n === 1 ? 'وحدة واحدة' : n === 2 ? 'وحدتين' : n <= 10 ? `${n} وحدات` : `${n} وحدة`);
const unitEn = (n: number) => (n === 1 ? '1 unit' : `${n} units`);
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);
/** Signed whole-number options that never offer 0. */
const sgn = (ans: number, cands: number[]) =>
  wrongsFrom(signed(ans), cands.filter(c => Number.isInteger(c) && c !== 0).map(signed), k => (ans + k === 0 ? '' : signed(ans + k)));
/** «2x + 5», «x + 5» — a linear expression in x with a positive constant. */
const lin = (p: number, c: number) => `${p === 1 ? '' : p}x + ${c}`;
const isIntPt = (c: [number, number]) => Number.isInteger(c[0]) && Number.isInteger(c[1]);

// ─── Grades 3–6: perimeter and area ─────────────────────────────────────────

const perimeter = T('perimeter', /^المحيط$/, [3, 4], ({ rng, diff, grade }) => {
  const m = grade === 3 ? span(diff, 8, 12, 15) : span(diff, 15, 25, 40);
  const k = pick(rng, grade >= 4 && diff !== 'easy' ? [0, 1, 2, 3] : [0, 1, 2]);
  if (k === 0) {
    const l = int(rng, 3, m), w = int(rng, 2, m - 1);
    const a = 2 * (l + w);
    return { eq: `${l}, ${w}`, answer: String(a), wrongs: pos(a, [l + w, l * w, 2 * l + w, a + 2]), ar: `ما محيط مستطيل طوله ${l} سم وعرضه ${w} سم؟`, en: `What is the perimeter of a rectangle ${l} cm long and ${w} cm wide?` };
  }
  if (k === 1) {
    const s = int(rng, 2, m);
    return { eq: `${s}`, answer: String(4 * s), wrongs: pos(4 * s, [2 * s, s * s, s + 4, 8 * s]), ar: `ما محيط مربع طول ضلعه ${s} سم؟`, en: `What is the perimeter of a square with side ${s} cm?` };
  }
  if (k === 2) {
    let a = 0, b = 0, c = 0;
    do { a = int(rng, 3, m); b = int(rng, 3, m); c = int(rng, 3, m); } while (a + b <= c || a + c <= b || b + c <= a);
    return { eq: `${a}, ${b}, ${c}`, answer: String(a + b + c), wrongs: pos(a + b + c, [a + b, b + c, a + c, 2 * (a + b + c)]), ar: `ما محيط مثلث أطوال أضلاعه ${a} سم و ${b} سم و ${c} سم؟`, en: `What is the perimeter of a triangle with sides ${a} cm, ${b} cm and ${c} cm?` };
  }
  const l = int(rng, 4, m), w = int(rng, 2, l - 1), P = 2 * (l + w);
  return { eq: `${P}, ${l}`, answer: String(w), wrongs: pos(w, [P - l, P / 2 + l, P - 2 * l, w + l]), ar: `محيط مستطيل ${P} سم وطوله ${l} سم. ما عرضه؟`, en: `A rectangle has perimeter ${P} cm and length ${l} cm. What is its width?` };
});

const area = T('area_rect', /^(?:المساحه|مساحه المستطيل)$/, [3, 4], ({ rng, diff, grade }) => {
  const m = grade === 3 ? span(diff, 6, 9, 12) : span(diff, 9, 15, 25);
  // 3: count unit squares, 4: a room's floor, 5 (Grade 4): compare a rectangle with a square.
  const k = pick(rng, grade >= 4 ? [0, 1, 2, 3, 4, 5] : [0, 1, 2, 3, 4]);
  if (k === 0) {
    const l = int(rng, 2, m), w = int(rng, 2, m);
    return { eq: `${l}, ${w}`, answer: String(l * w), wrongs: pos(l * w, [2 * (l + w), l + w, l * w + l, l * w - w]), ar: `ما مساحة مستطيل طوله ${l} سم وعرضه ${w} سم (بالسنتيمتر المربع)؟`, en: `What is the area, in cm², of a rectangle ${l} cm long and ${w} cm wide?` };
  }
  if (k === 1) {
    const s = int(rng, 2, m);
    return { eq: `${s}`, answer: String(s * s), wrongs: pos(s * s, [4 * s, 2 * s, s * s + s]), ar: `ما مساحة مربع طول ضلعه ${s} سم (بالسنتيمتر المربع)؟`, en: `What is the area, in cm², of a square with side ${s} cm?` };
  }
  if (k === 3) {
    const r = int(rng, 3, Math.min(m, 9)), c = int(rng, 3, Math.min(m, 10));
    return { eq: `grid ${r}, ${c}`, answer: String(r * c), wrongs: pos(r * c, [r + c, 2 * (r + c), r * c + c, r * c - r]), ar: `شكل مرسوم على شبكة مربعات، يتكوّن من ${r} صفوف، في كل صف ${c} مربعات وحدة. ما مساحته بالوحدات المربعة؟`, en: `A shape drawn on a square grid is made of ${r} rows with ${c} unit squares in each row. What is its area in square units?` };
  }
  if (k === 4) {
    const l = int(rng, 3, m), w = int(rng, 2, l - 1);
    return { eq: `room ${l}, ${w}`, answer: String(l * w), wrongs: pos(l * w, [2 * (l + w), l + w, l * w + l, l * w - w]), ar: `غرفة مستطيلة الشكل طولها ${l} م وعرضها ${w} م. ما مساحة أرضيتها بالمتر المربع؟`, en: `A rectangular room is ${l} m long and ${w} m wide. What is the area of its floor in square metres?` };
  }
  if (k === 5) {
    let l = 0, w = 0, s = 0;
    do { l = int(rng, 3, m); w = int(rng, 2, m); s = int(rng, 2, m); } while (l * w <= s * s || l === w);
    const d = l * w - s * s;
    return { eq: `compare ${l}, ${w}, ${s}`, answer: String(d), wrongs: pos(d, [l * w + s * s, l * w - 4 * s, 2 * (l + w) - 4 * s, s * s, l * w]), ar: `كم سنتيمترًا مربعًا تزيد مساحة مستطيل طوله ${l} سم وعرضه ${w} سم على مساحة مربع طول ضلعه ${s} سم؟`, en: `By how many cm² is the area of a rectangle ${l} cm long and ${w} cm wide greater than the area of a square with side ${s} cm?` };
  }
  const l = int(rng, 3, m), w = int(rng, 2, m);
  return { eq: `${l * w}, ${l}`, answer: String(w), wrongs: pos(w, [l * w - l, l * w + l, l + w, l]), ar: `مساحة مستطيل ${l * w} سم² وطوله ${l} سم. ما عرضه؟`, en: `A rectangle has area ${l * w} cm² and length ${l} cm. What is its width?` };
});

const composite = T('composite_L', /^محيط الشكل المركب ومساحته$/, [5, 5], ({ rng, diff }) => {
  const W = int(rng, 8, span(diff, 12, 16, 20)), H = int(rng, 6, span(diff, 10, 14, 18));
  const w = int(rng, 2, W - 3), h = int(rng, 2, H - 3);
  // 0 area, 1 perimeter of the L; 2 two rectangles joined (an area by adding, not removing); 3 a fence round an L-shaped garden.
  const ask = pick(rng, [0, 1, 2, 3]);
  const stem = `شكل على صورة حرف L داخل مستطيل أبعاده ${W} سم × ${H} سم، أُزيل من إحدى زواياه مستطيل أبعاده ${w} سم × ${h} سم`;
  const stemEn = `An L-shaped figure sits inside a ${W} cm × ${H} cm rectangle with a ${w} cm × ${h} cm rectangle removed from one corner`;
  if (ask === 0) { const a = W * H - w * h; return { eq: `${W}, ${H}, ${w}, ${h}`, answer: String(a), wrongs: pos(a, [W * H, W * H + w * h, W * H - w - h, (W - w) * (H - h)]), ar: `${stem}. ما مساحته؟`, en: `${stemEn}. What is its area?` }; }
  if (ask === 2) {
    const a = int(rng, 3, span(diff, 8, 10, 14)), b = int(rng, 2, span(diff, 6, 8, 10)), c = int(rng, 3, span(diff, 8, 10, 14)), d = int(rng, 2, span(diff, 6, 8, 10));
    const A = a * b + c * d;
    return { eq: `join ${a}, ${b}, ${c}, ${d}`, answer: String(A), wrongs: pos(A, [(a + c) * (b + d), a * b, 2 * (a + b + c + d), a + b + c + d, A + a]), ar: `شكل مركب من مستطيلين متلاصقين لا يتداخلان، بُعدا الأول ${a} سم × ${b} سم، وبُعدا الثاني ${c} سم × ${d} سم. ما مساحته؟`, en: `A composite shape is made of two rectangles that touch but do not overlap: one is ${a} cm × ${b} cm and the other ${c} cm × ${d} cm. What is its area?` };
  }
  const p = 2 * (W + H);
  if (ask === 3) return { eq: `fence ${W}, ${H}, ${w}, ${h}`, answer: String(p), wrongs: pos(p, [p - 2 * (w + h), p + 2 * (w + h), W + H, W * H - w * h]), ar: `حديقة على شكل حرف L داخل مستطيل أبعاده ${W} م × ${H} م، اقتُطع من إحدى زواياه مستطيل أبعاده ${w} م × ${h} م. كم مترًا من السياج يلزم لإحاطة الحديقة؟`, en: `An L-shaped garden sits inside a ${W} m × ${H} m rectangle with a ${w} m × ${h} m rectangle cut from one corner. How many metres of fence are needed to go round it?` };
  return { eq: `${W}, ${H}, ${w}, ${h}`, answer: String(p), wrongs: pos(p, [p - 2 * (w + h), p + 2 * (w + h), W + H, W * H - w * h]), ar: `${stem}. ما محيطه؟`, en: `${stemEn}. What is its perimeter?` };
});

const parallelogramArea = T('area_parallelogram', /^مساحه متوازي الاضلاع$/, [6, 6], ({ rng, diff }) => {
  const b = int(rng, 4, span(diff, 12, 18, 25)), h = int(rng, 3, span(diff, 9, 14, 20));
  // 0 area, 1 height from the area, 2 area with the slanted side given too, 3 a plot of land.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) return { eq: `${b * h}, ${b}`, answer: String(h), wrongs: pos(h, [b * h - b, b + h, b * h / 2, h + b]), ar: `مساحة متوازي أضلاع ${b * h} سم² وطول قاعدته ${b} سم. ما ارتفاعه؟`, en: `A parallelogram has area ${b * h} cm² and base ${b} cm. What is its height?` };
  if (k === 2) {
    const sl = h + int(rng, 1, 6);
    return { eq: `slant ${b}, ${sl}, ${h}`, answer: String(b * h), wrongs: pos(b * h, [b * sl, 2 * (b + sl), (b * h) / 2, b * h + b]), ar: `متوازي أضلاع طول قاعدته ${b} سم وطول ضلعه الآخر ${sl} سم، وارتفاعه المرسوم على القاعدة ${h} سم. ما مساحته؟`, en: `A parallelogram has base ${b} cm, other side ${sl} cm and height to the base ${h} cm. What is its area?` };
  }
  if (k === 3) {
    const B = int(rng, 10, span(diff, 20, 30, 50)), H = int(rng, 5, span(diff, 12, 20, 30));
    return { eq: `land ${B}, ${H}`, answer: String(B * H), wrongs: pos(B * H, [(B * H) / 2, B + H, 2 * (B + H), B * H + B]), ar: `قطعة أرض على شكل متوازي أضلاع، طول قاعدتها ${B} م وارتفاعها ${H} م. ما مساحتها بالمتر المربع؟`, en: `A plot of land is a parallelogram with base ${B} m and height ${H} m. What is its area in square metres?` };
  }
  const s = int(rng, 2, 9);
  return { eq: `${b}, ${h}`, answer: String(b * h), wrongs: pos(b * h, [(b * h) / 2, b + h, b * (h + s), 2 * (b + h)]), ar: `ما مساحة متوازي أضلاع طول قاعدته ${b} سم وارتفاعه ${h} سم؟`, en: `What is the area of a parallelogram with base ${b} cm and height ${h} cm?` };
});

const triangleArea = T('area_triangle', /^مساحه المثلث$/, [6, 6], ({ rng, diff }) => {
  const b = int(rng, 4, span(diff, 12, 18, 24)), h = int(rng, 3, span(diff, 10, 14, 20));
  const bb = (b * h) % 2 === 0 ? b : b + 1;
  // 0 area, 1 height from the area, 2 a right triangle from its legs, 3 a sail.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) {
    const p = int(rng, 3, span(diff, 10, 15, 20));
    let q = int(rng, 3, span(diff, 10, 15, 20));
    if ((p * q) % 2) q += 1;
    const A = (p * q) / 2;
    return { eq: `right ${p}, ${q}`, answer: String(A), wrongs: pos(A, [p * q, p + q, A + p, 2 * (p + q)]), ar: `مثلث قائم الزاوية طولا ضلعيه القائمين ${p} سم و ${q} سم. ما مساحته؟`, en: `A right triangle has legs ${p} cm and ${q} cm. What is its area?` };
  }
  if (k === 3) { const a = (bb * h) / 2; return { eq: `sail ${bb}, ${h}`, answer: String(a), wrongs: pos(a, [bb * h, bb + h, a + h, 2 * (bb + h)]), ar: `شراع قارب على شكل مثلث، طول قاعدته ${bb} م وارتفاعه ${h} م. كم مترًا مربعًا من القماش يلزم لصنعه؟`, en: `A boat's sail is a triangle with base ${bb} m and height ${h} m. How many square metres of cloth does it take?` }; }
  if (k === 1) { const a = (bb * h) / 2; return { eq: `${a}, ${bb}`, answer: String(h), wrongs: pos(h, [a / bb, 2 * a - bb, a - bb, (a * 2) / bb + 1]), ar: `مساحة مثلث ${a} سم² وطول قاعدته ${bb} سم. ما ارتفاعه؟`, en: `A triangle has area ${a} cm² and base ${bb} cm. What is its height?` }; }
  const a = (bb * h) / 2;
  return { eq: `${bb}, ${h}`, answer: String(a), wrongs: pos(a, [bb * h, bb + h, a + h, 2 * (bb + h)]), ar: `ما مساحة مثلث طول قاعدته ${bb} سم وارتفاعه ${h} سم؟`, en: `What is the area of a triangle with base ${bb} cm and height ${h} cm?` };
});

const trapezoidArea = T('area_trapezoid', /^مساحه شبه المنحرف$/, [6, 6], ({ rng, diff }) => {
  const a = int(rng, 3, span(diff, 9, 13, 18));
  let b = int(rng, 3, span(diff, 9, 13, 18)), h = int(rng, 2, span(diff, 8, 12, 16));
  if (b === a) b += 1; // equal parallel sides would make a parallelogram
  if (((a + b) * h) % 2) h += 1;
  const A = ((a + b) * h) / 2;
  // 0 area, 1 height from the area, 2 the other base from the area, 3 a plot of land.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) return { eq: `h ${A}, ${a}, ${b}`, answer: String(h), wrongs: pos(h, [A / (a + b), A - a - b, 2 * h, A / a, h + 2]), ar: `مساحة شبه منحرف ${A} سم²، وطولا قاعدتيه المتوازيتين ${a} سم و ${b} سم. ما ارتفاعه؟`, en: `A trapezoid has area ${A} cm² and parallel sides ${a} cm and ${b} cm. What is its height?` };
  if (k === 2) return { eq: `base ${A}, ${h}, ${a}`, answer: String(b), wrongs: pos(b, [(2 * A) / h, A / h - a, a, b + 2, A / h]), ar: `مساحة شبه منحرف ${A} سم² وارتفاعه ${h} سم، وطول إحدى قاعدتيه المتوازيتين ${a} سم. ما طول القاعدة الأخرى؟`, en: `A trapezoid has area ${A} cm², height ${h} cm and one parallel side ${a} cm. How long is the other parallel side?` };
  if (k === 3) return { eq: `land ${a}, ${b}, ${h}`, answer: String(A), wrongs: pos(A, [(a + b) * h, a * b * h / 2, A + h, a * h]), ar: `قطعة أرض على شكل شبه منحرف، طولا ضلعيها المتوازيين ${a} م و ${b} م، والبعد بينهما ${h} م. ما مساحتها بالمتر المربع؟`, en: `A plot of land is a trapezoid with parallel sides ${a} m and ${b} m, ${h} m apart. What is its area in square metres?` };
  return { eq: `${a}, ${b}, ${h}`, answer: String(A), wrongs: pos(A, [(a + b) * h, a * b * h / 2, (a + b + h) / 2 | 0, A + h, a * h]), ar: `ما مساحة شبه منحرف طولا قاعدتيه المتوازيتين ${a} سم و ${b} سم وارتفاعه ${h} سم؟`, en: `What is the area of a trapezoid whose parallel sides are ${a} cm and ${b} cm and whose height is ${h} cm?` };
});

const rectPrism = T('prism_rect', /^حجم المنشور الرباعي ومساحه سطحه$/, [6, 6], ({ rng, diff }) => {
  const l = int(rng, 3, span(diff, 8, 10, 14)), w = int(rng, 2, span(diff, 6, 8, 12)), h = int(rng, 2, span(diff, 6, 8, 12));
  // 0 volume, 1 surface area, 2 a cube's volume, 3 a cube's surface area, 4 the height from the volume.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${l}, ${w}, ${h}`, answer: String(l * w * h), wrongs: pos(l * w * h, [l + w + h, 2 * (l * w + l * h + w * h), l * w, l * w * h + l]), ar: `ما حجم منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the volume of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
  if (k === 2 || k === 3) {
    const e = int(rng, 2, span(diff, 6, 8, 10));
    if (k === 2) return { eq: `cube ${e}`, answer: String(e ** 3), wrongs: pos(e ** 3, [6 * e * e, e * e, 3 * e, 12 * e, e ** 3 + e]), ar: `ما حجم مكعب طول حرفه ${e} سم؟`, en: `What is the volume of a cube with edge ${e} cm?` };
    return { eq: `cube ${e}`, answer: String(6 * e * e), wrongs: pos(6 * e * e, [e ** 3, 4 * e * e, e * e, 6 * e, 12 * e]), ar: `ما مساحة سطح مكعب طول حرفه ${e} سم؟`, en: `What is the surface area of a cube with edge ${e} cm?` };
  }
  if (k === 4) { const V = l * w * h; return { eq: `h ${V}, ${l}, ${w}`, answer: String(h), wrongs: pos(h, [V / l, V - l * w, l * w, h + 2, V / (l + w)]), ar: `حجم منشور رباعي ${V} سم³، وطول قاعدته ${l} سم وعرضها ${w} سم. ما ارتفاعه؟`, en: `A rectangular prism has volume ${V} cm³ and a base ${l} cm long and ${w} cm wide. What is its height?` }; }
  const s = 2 * (l * w + l * h + w * h);
  return { eq: `${l}, ${w}, ${h}`, answer: String(s), wrongs: pos(s, [l * w * h, l * w + l * h + w * h, 2 * l * w + 2 * l * h, s + 2 * l]), ar: `ما مساحة سطح منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the surface area of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
});

// ─── circles ────────────────────────────────────────────────────────────────

/**
 * [name, which segment it is, English] — the segments of a circle the Grade 6 lesson names, written in one
 * sentence so naming them is one kind of question; the centre stays an option.
 */
const CIRCLE_PARTS: Array<[string, string, string]> = [
  ['نصف القطر', 'نقطة على الدائرة ومركزها', 'joins a point on the circle to its centre'],
  ['القطر', 'نقطتين على الدائرة وتمر بمركزها', 'joins two points on the circle and passes through its centre'],
  ['الوتر', 'نقطتين على الدائرة ولا تمر بمركزها', 'joins two points on the circle without passing through its centre'],
];
const CIRCLE_PART_NAMES = ['المركز', 'نصف القطر', 'القطر', 'الوتر'];
const circleParts = T('circle_parts', /^الدائره واجزاؤها$/, [6, 6], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 30));
  // 0 radius from diameter, 1 diameter from radius, 2 the longest chord; 3 name a part from its description, 4 the perimeter of a triangle made of two radii and a chord.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${2 * r}`, answer: String(r), wrongs: pos(r, [2 * r + 1, 4 * r, r + 2, r * r]), ar: `قطر دائرة ${2 * r} سم. ما طول نصف قطرها؟`, en: `A circle has diameter ${2 * r} cm. What is its radius?` };
  if (k === 1) return { eq: `${r}`, answer: String(2 * r), wrongs: pos(2 * r, [r, r * r, 4 * r, r + 2]), ar: `نصف قطر دائرة ${r} سم. ما طول قطرها؟`, en: `A circle has radius ${r} cm. What is its diameter?` };
  if (k === 3) {
    const [name, ar, en] = pick(rng, CIRCLE_PARTS);
    return { eq: `part ${name}`, answer: name, wrongs: CIRCLE_PART_NAMES.filter(n => n !== name), ar: `ما اسم القطعة المستقيمة التي تصل بين ${ar}؟`, en: `What do we call the segment that ${en}?` };
  }
  if (k === 4) {
    const rr = int(rng, 3, span(diff, 9, 15, 25)), c = int(rng, 2, 2 * rr - 1), P = 2 * rr + c;
    return { eq: `tri ${rr}, ${c}`, answer: String(P), wrongs: pos(P, [rr + c, 2 * rr, 2 * (rr + c), 4 * rr + c, P + rr]), ar: `النقطة M مركز دائرة نصف قطرها ${rr} سم، و AB وتر فيها طوله ${c} سم. ما محيط المثلث MAB؟`, en: `M is the centre of a circle of radius ${rr} cm, and AB is a chord of it ${c} cm long. What is the perimeter of triangle MAB?` };
  }
  return { eq: `${r}`, answer: String(2 * r), wrongs: pos(2 * r, [r, r * r, 4 * r, 3 * r]), ar: `ما طول أطول وتر في دائرة نصف قطرها ${r} سم؟`, en: `What is the length of the longest chord in a circle with radius ${r} cm?` };
});

const SECTOR_ANGLES = [30, 45, 60, 72, 90, 120, 180, 240, 270];
/** Survey sizes whose name agrees as «N طالبًا» (last two digits 11–99). */
const SURVEY_TOTALS = [36, 60, 72, 120, 180, 240, 360];
const sector = T('sector_fraction', /^القطاعات الدائريه$/, [6, 6], ({ rng }) => {
  const a = pick(rng, SECTOR_ANGLES);
  // 0 angle → fraction, 1 fraction → angle; reading a pie chart: 2 a count from an angle, 3 an angle from a count, 4 the missing sector.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 2 || k === 3) {
    const N = pick(rng, SURVEY_TOTALS.filter(t => (t * a) % 360 === 0));
    const c = (N * a) / 360;
    if (k === 2) return { eq: `count ${N}, ${a}`, answer: String(c), wrongs: pos(c, [N - c, a, 2 * c, c + 10, (N * a) / 100]), ar: `مُثِّلت نتائج استطلاع شارك فيه ${N} طالبًا بالقطاعات الدائرية، فكان قياس زاوية قطاع «الرياضة» ${a}°. كم طالبًا اختاروا الرياضة؟`, en: `The results of a survey of ${N} students are shown in a pie chart, and the «sport» sector has an angle of ${a}°. How many students chose sport?` };
    return { eq: `angle ${N}, ${c}`, answer: `${a}°`, wrongs: deg(a, [c, 360 - a, (180 * c) / N, a + 30, 2 * a]), ar: `شارك ${N} طالبًا في استطلاع عن الهوايات، فاختار ${c} منهم القراءة. ما قياس زاوية قطاع القراءة عند تمثيل النتائج بالقطاعات الدائرية؟`, en: `${N} students took part in a survey about hobbies and ${c} of them chose reading. What is the angle of the reading sector when the results are shown in a pie chart?` };
  }
  if (k === 4) {
    const a1 = 10 * int(rng, 3, 15), a2 = 10 * int(rng, 3, 15), a3 = 360 - a1 - a2;
    return { eq: `third ${a1}, ${a2}`, answer: `${a3}°`, wrongs: deg(a3, [180 - a1 - a2, a1 + a2, 360 - a1, 360 - a2, a3 + 10]), ar: `تمثيل بالقطاعات الدائرية فيه ثلاثة قطاعات فقط، قياسا زاويتي اثنين منها ${a1}° و ${a2}°. ما قياس زاوية القطاع الثالث؟`, en: `A pie chart has exactly three sectors. Two of them have angles of ${a1}° and ${a2}°. What is the angle of the third sector?` };
  }
  if (k === 0) {
    const ans = sfrac(a, 360);
    return { eq: `${a}°`, answer: ans, wrongs: wrongsFrom(ans, [sfrac(a, 180), sfrac(a, 100), sfrac(360 - a, 360), sfrac(a, 90 + a)], k => sfrac(a + 30 * Math.abs(k), 360)), ar: `قطاع دائري زاويته ${a}°. ما الكسر الذي يمثله من الدائرة كلها؟`, en: `A circular sector has angle ${a}°. What fraction of the whole circle is it?` };
  }
  const f = sfrac(a, 360);
  return { eq: f, answer: `${a}°`, wrongs: deg(a, [360 - a, a * 2, 180 - a, a / 2, a + 30]), ar: `قطاع دائري يمثل ${f} من الدائرة. ما قياس زاويته المركزية؟`, en: `A circular sector is ${f} of the circle. What is its central angle?` };
});

const circumference = T('circle_circumference', /^محيط الدائره$/, [7, 7], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 25));
  // 0 from the radius, 1 from the diameter, 2 the radius back; 3 a wheel's distance over several turns, 4 a semicircle's perimeter (both with π ≈ 22/7).
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${r}`, answer: PI(2 * r), wrongs: piOpts(2 * r, [r, r * r, 4 * r, r + 2]), ar: `ما محيط دائرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the circumference of a circle with radius ${r} cm? (Leave your answer in terms of π)` };
  if (k === 1) return { eq: `${2 * r}`, answer: PI(2 * r), wrongs: piOpts(2 * r, [r, r * r, 4 * r, 4 * r * r]), ar: `ما محيط دائرة قطرها ${2 * r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the circumference of a circle with diameter ${2 * r} cm? (Leave your answer in terms of π)` };
  if (k === 3) {
    // 2πr with π = 22/7 is whole when 7 | r.
    const R = 7 * int(rng, 1, span(diff, 2, 3, 5)), n = int(rng, 3, 10), turn = (44 * R) / 7, D = n * turn;
    return { eq: `wheel ${R}, ${n}`, answer: String(D), wrongs: pos(D, [turn, (n * 22 * R) / 7, n * 2 * R, (n * 22 * R * R) / 7, D + turn]), ar: `عجلة دراجة نصف قطرها ${R} سم. كم سنتيمترًا تقطع الدراجة عندما تدور العجلة ${n} دورات كاملة؟ (استعمل π ≈ 22/7)`, en: `A bicycle wheel has radius ${R} cm. How many centimetres does the bicycle travel when the wheel turns ${n} complete times? (Use π ≈ 22/7)` };
  }
  if (k === 4) {
    const d = 7 * int(rng, 1, span(diff, 2, 4, 6)), arc = (11 * d) / 7, P = arc + d;
    return { eq: `semi ${d}`, answer: String(P), wrongs: pos(P, [arc, (22 * d) / 7, (22 * d) / 7 + d, arc + d / 2, P + d]), ar: `ما محيط شكل على صورة نصف دائرة قطرها ${d} سم؟ (استعمل π ≈ 22/7)`, en: `What is the perimeter of a semicircle with diameter ${d} cm? (Use π ≈ 22/7)` };
  }
  return { eq: PI(2 * r), answer: String(r), wrongs: pos(r, [2 * r, 4 * r, r * r, r + 2]), ar: `محيط دائرة ${PI(2 * r)} سم. ما طول نصف قطرها؟`, en: `A circle has circumference ${PI(2 * r)} cm. What is its radius?` };
});

const circleArea = T('circle_area', /^مساحه الدائره$/, [7, 7], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 25));
  // 0 from the radius, 1 from the diameter, 2 the radius back; 3 a ring between two circles with one centre, 4 the area from the circumference.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: `${r}`, answer: PI(r * r), wrongs: piOpts(r * r, [2 * r, r, 4 * r * r, r * r + r]), ar: `ما مساحة دائرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the area of a circle with radius ${r} cm? (Leave your answer in terms of π)` };
  if (k === 1) return { eq: `${2 * r}`, answer: PI(r * r), wrongs: piOpts(r * r, [4 * r * r, 2 * r, r, 2 * r * r]), ar: `ما مساحة دائرة قطرها ${2 * r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the area of a circle with diameter ${2 * r} cm? (Leave your answer in terms of π)` };
  if (k === 3) {
    const R = int(rng, 3, span(diff, 8, 12, 15)), q = int(rng, 1, R - 1), N = R * R - q * q;
    return { eq: `ring ${R}, ${q}`, answer: PI(N), wrongs: piOpts(N, [(R - q) ** 2, R * R, R * R + q * q, 2 * (R - q), 2 * R * q]), ar: `ممر على شكل حلقة بين دائرتين لهما المركز نفسه، نصف قطر الكبرى ${R} م ونصف قطر الصغرى ${q} م. ما مساحة الممر بالمتر المربع؟ (اترك الإجابة بدلالة π)`, en: `A path is the ring between two circles with the same centre, of radii ${R} m and ${q} m. What is the area of the path in square metres? (Leave your answer in terms of π)` };
  }
  if (k === 4) return { eq: `fromC ${2 * r}`, answer: PI(r * r), wrongs: piOpts(r * r, [2 * r, 4 * r * r, r, 2 * r * r]), ar: `محيط دائرة ${PI(2 * r)} سم. ما مساحتها؟ (اترك الإجابة بدلالة π)`, en: `A circle has circumference ${PI(2 * r)} cm. What is its area? (Leave your answer in terms of π)` };
  return { eq: PI(r * r), answer: String(r), wrongs: pos(r, [r * r, 2 * r, r / 2 | 0, r + 2]), ar: `مساحة دائرة ${PI(r * r)} سم². ما طول نصف قطرها؟`, en: `A circle has area ${PI(r * r)} cm². What is its radius?` };
});

// ─── solids ─────────────────────────────────────────────────────────────────

const prismCylinderVolume = T('volume_prism_cyl', /^حجم المنشور والاسطوانه$/, [7, 7], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const B = int(rng, 6, 60), h = int(rng, 3, span(diff, 8, 12, 16)); return { eq: `${B}, ${h}`, answer: String(B * h), wrongs: pos(B * h, [B + h, 2 * (B + h), B * h / 2, B * h + B]), ar: `ما حجم منشور مساحة قاعدته ${B} سم² وارتفاعه ${h} سم؟`, en: `What is the volume of a prism whose base area is ${B} cm² and whose height is ${h} cm?` }; }
  const r = int(rng, 2, span(diff, 6, 9, 12)), h = int(rng, 2, span(diff, 8, 12, 16));
  if (k === 1) return { eq: `${r}, ${h}`, answer: PI(r * r * h), wrongs: piOpts(r * r * h, [r * h, 2 * r * h, r * r * h * 2, r * (r + h)]), ar: `ما حجم أسطوانة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the volume of a cylinder with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
  const l = int(rng, 3, 10), w = int(rng, 2, 8), hh = int(rng, 2, 9);
  return { eq: `${l}, ${w}, ${hh}`, answer: String(l * w * hh), wrongs: pos(l * w * hh, [l + w + hh, 2 * (l * w + l * hh + w * hh), l * w, l * w * hh + l]), ar: `ما حجم منشور رباعي أبعاده ${l} سم و ${w} سم و ${hh} سم؟`, en: `What is the volume of a rectangular prism measuring ${l} cm, ${w} cm and ${hh} cm?` };
});

const pyramidConeVolume = T('volume_pyr_cone', /^حجم الهرم والمخروط$/, [7, 7], ({ rng, diff }) => {
  // 0 pyramid, 1 cone, 2 a tent (square pyramid, real life), 3 a pyramid's height from its volume.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) {
    const s = int(rng, 2, span(diff, 4, 6, 8));
    const h = s % 3 === 0 ? int(rng, 2, span(diff, 4, 6, 8)) : 3 * int(rng, 1, 2);
    const V = (s * s * h) / 3;
    return { eq: `tent ${s}, ${h}`, answer: String(V), wrongs: pos(V, [s * s * h, s * h, (s * s * h) / 2, V + s, 4 * s * h]), ar: `خيمة على شكل هرم قاعدته مربعة طول ضلعها ${s} م وارتفاعه ${h} م. ما حجم الهواء داخل الخيمة بالمتر المكعب؟`, en: `A tent is a pyramid with a square base of side ${s} m and height ${h} m. What volume of air, in cubic metres, is inside it?` };
  }
  if (k === 3) {
    const B = 3 * int(rng, 2, span(diff, 6, 10, 15)), h = int(rng, 2, span(diff, 9, 12, 15)), V = (B * h) / 3;
    return { eq: `h ${V}, ${B}`, answer: String(h), wrongs: pos(h, [V / B, V - B, 3 * V, h + 3, 3 * h]), ar: `حجم هرم ${V} سم³، ومساحة قاعدته ${B} سم². ما ارتفاعه؟`, en: `A pyramid has volume ${V} cm³ and base area ${B} cm². What is its height?` };
  }
  if (k === 0) {
    const B = 3 * int(rng, 2, span(diff, 8, 14, 20)), h = int(rng, 3, span(diff, 9, 12, 15));
    return { eq: `${B}, ${h}`, answer: String((B * h) / 3), wrongs: pos((B * h) / 3, [B * h, B * h / 2, B + h, (B * h) / 3 + h]), ar: `ما حجم هرم مساحة قاعدته ${B} سم² وارتفاعه ${h} سم؟`, en: `What is the volume of a pyramid whose base area is ${B} cm² and whose height is ${h} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), h = 3 * int(rng, 1, span(diff, 4, 5, 6));
  return { eq: `${r}, ${h}`, answer: PI((r * r * h) / 3), wrongs: piOpts((r * r * h) / 3, [r * r * h, (r * h) / 3, 2 * r * h, (r * r * h) / 3 + r]), ar: `ما حجم مخروط نصف قطر قاعدته ${r} سم وارتفاعه ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the volume of a cone with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
});

const prismCylinderSurface = T('surface_prism_cyl', /^مساحه سطح المنشور والاسطوانه$/, [7, 7], ({ rng, diff }) => {
  // 0 prism total, 1 cylinder total; 2 cylinder lateral, 3 prism lateral, 4 an open box (real life).
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 2) {
    const r = int(rng, 2, span(diff, 6, 9, 12)), h = int(rng, 2, span(diff, 8, 12, 16));
    return { eq: `lat ${r}, ${h}`, answer: PI(2 * r * h), wrongs: piOpts(2 * r * h, [r * h, 2 * r * (r + h), r * r * h, 2 * r * h + 2 * r * r, 4 * r * h]), ar: `ما المساحة الجانبية لأسطوانة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the lateral surface area of a cylinder with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
  }
  if (k === 3 || k === 4) {
    const l = int(rng, 3, span(diff, 8, 10, 14)), w = int(rng, 2, span(diff, 6, 8, 12)), h = int(rng, 2, span(diff, 6, 8, 12));
    if (k === 3) { const L = 2 * (l + w) * h; return { eq: `lat ${l}, ${w}, ${h}`, answer: String(L), wrongs: pos(L, [2 * (l * w + l * h + w * h), (l + w) * h, l * w * h, L + 2 * l * w]), ar: `ما المساحة الجانبية لمنشور رباعي قاعدته مستطيل بُعداه ${l} سم و ${w} سم، وارتفاعه ${h} سم؟`, en: `What is the lateral surface area of a rectangular prism whose base is ${l} cm by ${w} cm and whose height is ${h} cm?` }; }
    const S = l * w + 2 * (l * h + w * h);
    return { eq: `box ${l}, ${w}, ${h}`, answer: String(S), wrongs: pos(S, [2 * (l * w + l * h + w * h), 2 * (l * h + w * h), l * w * h, l * w + l * h + w * h]), ar: `صندوق على شكل منشور رباعي مفتوح من الأعلى (بلا غطاء)، طول قاعدته ${l} سم وعرضها ${w} سم وارتفاعه ${h} سم. كم سنتيمترًا مربعًا من الورق المقوّى يلزم لصنعه؟`, en: `An open box (no lid) is a rectangular prism with a base ${l} cm by ${w} cm and height ${h} cm. How many cm² of cardboard does it take to make?` };
  }
  if (k === 0) {
    const l = int(rng, 3, span(diff, 8, 10, 14)), w = int(rng, 2, span(diff, 6, 8, 12)), h = int(rng, 2, span(diff, 6, 8, 12));
    const s = 2 * (l * w + l * h + w * h);
    return { eq: `${l}, ${w}, ${h}`, answer: String(s), wrongs: pos(s, [l * w * h, l * w + l * h + w * h, 2 * l * w + 2 * l * h, s + 2 * l]), ar: `ما مساحة سطح منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the surface area of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), h = int(rng, 2, span(diff, 8, 12, 16));
  const N = 2 * r * (r + h);
  return { eq: `${r}, ${h}`, answer: PI(N), wrongs: piOpts(N, [2 * r * h, 2 * r * r, r * r * h, r * (r + h), N + 2 * r]), ar: `ما مساحة السطح الكلية لأسطوانة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the total surface area of a cylinder with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
});

const pyramidConeSurface = T('surface_pyr_cone', /^مساحه سطح الهرم والمخروط$/, [7, 7], ({ rng, diff }) => {
  // 0 pyramid total, 1 cone total; 2 pyramid lateral, 3 cone lateral, 4 a paper hat (cone lateral, real life).
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 2) {
    const b = int(rng, 3, span(diff, 8, 12, 16)), l = int(rng, 3, span(diff, 10, 14, 18));
    return { eq: `lat ${b}, ${l}`, answer: String(2 * b * l), wrongs: pos(2 * b * l, [b * b + 2 * b * l, 4 * b * l, b * l, b * b + b * l]), ar: `ما المساحة الجانبية لهرم منتظم قاعدته مربعة طول ضلعها ${b} سم، وارتفاعه المائل ${l} سم؟`, en: `What is the lateral surface area of a regular pyramid with a square base of side ${b} cm and slant height ${l} cm?` };
  }
  if (k === 3 || k === 4) {
    const r = int(rng, 2, span(diff, 6, 9, 12)), l = r + int(rng, 1, 8);
    const wr = piOpts(r * l, [r * (r + l), 2 * r * l, r * r, r * l + r]);
    if (k === 3) return { eq: `lat ${r}, ${l}`, answer: PI(r * l), wrongs: wr, ar: `ما المساحة الجانبية لمخروط نصف قطر قاعدته ${r} سم وارتفاعه المائل ${l} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the lateral surface area of a cone with base radius ${r} cm and slant height ${l} cm? (Leave your answer in terms of π)` };
    return { eq: `hat ${r}, ${l}`, answer: PI(r * l), wrongs: wr, ar: `قبعة على شكل مخروط بلا قاعدة، نصف قطر فتحتها ${r} سم وارتفاعها المائل ${l} سم. ما مساحة الورق اللازم لصنعها؟ (اترك الإجابة بدلالة π)`, en: `A party hat is a cone with no base, opening radius ${r} cm and slant height ${l} cm. How much paper does it take? (Leave your answer in terms of π)` };
  }
  if (k === 0) {
    const b = int(rng, 3, span(diff, 8, 12, 16)), l = int(rng, 3, span(diff, 10, 14, 18));
    const s = b * b + 2 * b * l;
    return { eq: `${b}, ${l}`, answer: String(s), wrongs: pos(s, [4 * b * l, b * b + 4 * b * l, b * b + b * l, s + b]), ar: `ما مساحة السطح الكلية لهرم قاعدته مربعة طول ضلعها ${b} سم وارتفاع كل وجه جانبي (الارتفاع المائل) ${l} سم؟`, en: `What is the total surface area of a pyramid with a square base of side ${b} cm and slant height ${l} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), l = r + int(rng, 1, 8);
  const N = r * (r + l);
  return { eq: `${r}, ${l}`, answer: PI(N), wrongs: piOpts(N, [r * l, r * r, 2 * r * l, r * (r + l) + r, r * r * l]), ar: `ما مساحة السطح الكلية لمخروط نصف قطر قاعدته ${r} سم وارتفاعه المائل ${l} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the total surface area of a cone with base radius ${r} cm and slant height ${l} cm? (Leave your answer in terms of π)` };
});

const sphere = T('sphere', /^حجم الكره ومساحه سطحها$/, [8, 8], ({ rng, diff }) => {
  // One kind each: a volume or surface area from the radius or diameter (0, 1, 4); the radius back from either (2);
  // a hemispherical bowl (3); a solid hemisphere's whole surface (5); how many times the area or volume when the radius is scaled (6).
  const k = pick(rng, [pick(rng, [0, 1, 4]), 2, 3, 5, 6]);
  if (k === 2) {
    if (rng() < 0.5) {
      const r = 3 * int(rng, 1, span(diff, 2, 3, 4)), N = (4 * r ** 3) / 3;
      return { eq: `r ${N}`, answer: String(r), wrongs: pos(r, [r / 3, 2 * r, r * r, r + 3]), ar: `حجم كرة ${PI(N)} سم³. ما طول نصف قطرها؟`, en: `A sphere has volume ${PI(N)} cm³. What is its radius?` };
    }
    const r = int(rng, 2, span(diff, 8, 12, 15));
    return { eq: `r ${4 * r * r}`, answer: String(r), wrongs: pos(r, [2 * r, r * r, 4 * r, r + 2]), ar: `مساحة سطح كرة ${PI(4 * r * r)} سم². ما طول نصف قطرها؟`, en: `A sphere has surface area ${PI(4 * r * r)} cm². What is its radius?` };
  }
  if (k === 5) {
    // the curved half 2πr² and the flat circle πr²
    const r = int(rng, 2, span(diff, 8, 12, 15));
    return { eq: `hemi ${r}`, answer: PI(3 * r * r), wrongs: piOpts(3 * r * r, [2 * r * r, 4 * r * r, r * r, 6 * r * r]), ar: `نصف كرة مصمتة نصف قطرها ${r} سم. أوجد مساحة سطحها الكلي (الجزء المنحني مع القاعدة الدائرية) بدلالة π.`, en: `A solid hemisphere has radius ${r} cm. Find its total surface area (the curved part and the circular base) in terms of π.` };
  }
  if (k === 6) {
    // area goes with r², volume with r³
    const a = int(rng, 2, span(diff, 3, 4, 5)), vol = rng() < 0.5, ans = vol ? a ** 3 : a * a;
    return { eq: `scale ${a} ${vol ? 'V' : 'A'}`, answer: String(ans), wrongs: pos(ans, [a, vol ? a * a : a ** 3, 2 * a, 4 * a]), ar: `نصف قطر كرة يساوي ${a === 2 ? 'مثلَي' : `${a} أمثال`} نصف قطر كرة أخرى. كم مثلًا ${vol ? 'حجم' : 'مساحة سطح'} الكرة الأولى من ${vol ? 'حجم' : 'مساحة سطح'} الثانية؟`, en: `One sphere's radius is ${a} times another's. How many times the second sphere's ${vol ? 'volume' : 'surface area'} is the first's?` };
  }
  if (k === 3) {
    const r = 3 * int(rng, 1, span(diff, 2, 3, 4)), N = (2 * r ** 3) / 3;
    return { eq: `bowl ${r}`, answer: PI(N), wrongs: piOpts(N, [(4 * r ** 3) / 3, 2 * r * r, r ** 3, 3 * r * r]), ar: `وعاء على شكل نصف كرة نصف قطره ${r} سم. ما سعته؟ (اترك الإجابة بدلالة π)`, en: `A bowl is a hemisphere of radius ${r} cm. What is its capacity? (Leave your answer in terms of π)` };
  }
  if (k === 4) {
    const r = int(rng, 2, span(diff, 6, 9, 12));
    return { eq: `d ${2 * r}`, answer: PI(4 * r * r), wrongs: piOpts(4 * r * r, [16 * r * r, 2 * r * r, 8 * r * r, 4 * r]), ar: `ما مساحة سطح كرة قطرها ${2 * r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the surface area of a sphere with diameter ${2 * r} cm? (Leave your answer in terms of π)` };
  }
  if (k === 0) {
    const r = 3 * int(rng, 1, span(diff, 2, 3, 4)); // 4/3·r³ is whole when 3 | r
    const N = (4 * r ** 3) / 3;
    return { eq: `${r}`, answer: PI(N), wrongs: piOpts(N, [4 * r * r, (4 * r ** 3), r ** 3, (2 * r ** 3) / 3 | 0, N + r]), ar: `ما حجم كرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the volume of a sphere with radius ${r} cm? (Leave your answer in terms of π)` };
  }
  const r = int(rng, 2, span(diff, 8, 12, 15));
  return { eq: `${r}`, answer: PI(4 * r * r), wrongs: piOpts(4 * r * r, [2 * r * r, r * r, (4 * r ** 3) / 3 | 0, 4 * r, 8 * r * r]), ar: `ما مساحة سطح كرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the surface area of a sphere with radius ${r} cm? (Leave your answer in terms of π)` };
});

// ─── angles, triangles, quadrilaterals ──────────────────────────────────────

const ANGLE_KINDS = ['حادة', 'قائمة', 'منفرجة', 'مستقيمة'];
/** [name, «ما اسم …؟» description, English] — the figures the lesson names. */
const FIGURES: Array<[string, string, string]> = [
  ['مستقيم', 'الخط المستقيم الذي يمتد من جهتيه بلا نهاية', 'a straight path that goes on without end in both directions'],
  ['قطعة مستقيمة', 'الجزء من المستقيم الذي له نقطتا طرفين', 'the part of a line that has two endpoints'],
  ['شعاع', 'الجزء من المستقيم الذي له نقطة بداية واحدة ويمتد بلا نهاية في اتجاه واحد', 'the part of a line that has one endpoint and goes on without end in one direction'],
  ['زاوية', 'الشكل المكوَّن من شعاعين لهما نقطة البداية نفسها', 'the figure made of two rays with the same endpoint'],
  ['نقطة', 'الموقع المحدد الذي يُرسم علامةً صغيرة ويُسمّى بحرف', 'an exact location, drawn as a small dot and named by a letter'],
];
const angleKind = T('angle_kind', /^الخطوط والاشعه والزوايا$/, [4, 4], ({ rng }) => {
  // 0 classify by measure, 1 the angle between clock hands, 2 name a figure from its description, 3 how far from a right angle.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) {
    const h = int(rng, 1, 11), a = 30 * Math.min(h, 12 - h);
    const kind = a < 90 ? 0 : a === 90 ? 1 : a < 180 ? 2 : 3;
    return { eq: `clock ${h}`, answer: ANGLE_KINDS[kind]!, wrongs: ANGLE_KINDS.filter((_, i) => i !== kind), ar: `عندما تشير الساعة إلى ${h}:00 تمامًا، ما نوع الزاوية الصغرى بين عقربي الساعة: حادة أم قائمة أم منفرجة أم مستقيمة؟`, en: `At exactly ${h}:00, is the smaller angle between the clock hands acute, right, obtuse or straight?` };
  }
  if (k === 2) {
    const [name, ar, en] = pick(rng, FIGURES);
    return { eq: name, answer: name, wrongs: names(rng, name, FIGURES.map(f => f[0])), ar: `ما اسم ${ar}؟`, en: `What is the name of ${en}?` };
  }
  if (k === 3) {
    const a = 5 * int(rng, 1, 17);
    return { eq: `to90 ${a}`, answer: `${90 - a}°`, wrongs: deg(90 - a, [180 - a, a, 90 + a, 360 - a]), ar: `زاوية حادة قياسها ${a}°. كم درجة يلزم أن يُضاف إلى قياسها لتصبح زاوية قائمة؟`, en: `An acute angle measures ${a}°. How many degrees must be added to make it a right angle?` };
  }
  const kind = pick(rng, [0, 1, 2, 3]);
  const a = kind === 0 ? int(rng, 5, 85) : kind === 1 ? 90 : kind === 2 ? int(rng, 95, 175) : 180;
  return { eq: `${a}°`, answer: ANGLE_KINDS[kind]!, wrongs: ANGLE_KINDS.filter((_, i) => i !== kind), ar: `زاوية قياسها ${a}°. ما نوعها: حادة أم قائمة أم منفرجة أم مستقيمة؟`, en: `An angle measures ${a}°. Is it acute, right, obtuse or straight?` };
});

const lineAndPoint = T('angles_line_point', /^مجموع الزوايا علي مستقيم وحول نقطه$/, [5, 5], ({ rng, diff }) => {
  // 0 two on a line, 1 three round a point, 2 three on a line; 3 equal angles sharing a line or a point, 4 two equal angles beside a known one.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 3) {
    const point = rng() < 0.5, total = point ? 360 : 180;
    const n = pick(rng, point ? [3, 4, 5, 6, 8, 9, 10] : [3, 4, 5, 6]), a = total / n;
    return { eq: `equal ${n}, ${total}`, answer: `${a}°`, wrongs: deg(a, [(point ? 180 : 360) / n, total - a, 90 / n, a + 10, 2 * a]), ar: `${point ? 'تحيط بنقطة' : 'على مستقيم'} ${n} زوايا متجاورة متساوية في القياس. ما قياس كل منها؟`, en: `${n} equal adjacent angles ${point ? 'surround a point' : 'lie on a straight line'}. What does each measure?` };
  }
  if (k === 4) {
    const point = rng() < 0.5, total = point ? 360 : 180;
    const a = 2 * int(rng, point ? 30 : 10, point ? 150 : 75), e = (total - a) / 2;
    return { eq: `pair ${a}, ${total}`, answer: `${e}°`, wrongs: deg(e, [total - a, (point ? 180 : 360) - a, ((point ? 180 : 360) - a) / 2, a, e + 10]), ar: `ثلاث زوايا متجاورة ${point ? 'تحيط بنقطة' : 'على مستقيم'}، قياس إحداها ${a}°، والأخريان متساويتان في القياس. ما قياس كل من الزاويتين المتساويتين؟`, en: `Three adjacent angles ${point ? 'surround a point' : 'lie on a straight line'}. One measures ${a}° and the other two are equal. What does each of the equal angles measure?` };
  }
  if (k === 0) { const a = int(rng, 20, 160); return { eq: `${a}`, answer: `${180 - a}°`, wrongs: deg(180 - a, [90 - a > 0 ? 90 - a : 0, 360 - a, a, 180 + a - 90]), ar: `زاويتان على مستقيم، قياس إحداهما ${a}°. ما قياس الأخرى؟`, en: `Two angles lie on a straight line. One measures ${a}°. What does the other measure?` }; }
  if (k === 1) { const a = int(rng, 40, 150), b = int(rng, 40, 150); const c = 360 - a - b; if (c <= 0) return lineAndPoint.make({ rng, diff, grade: 5 }); return { eq: `${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [180 - a - b > 0 ? 180 - a - b : 0, 360 - a, a + b, 360 - b]), ar: `ثلاث زوايا حول نقطة، قياس إحداها ${a}° والثانية ${b}°. ما قياس الثالثة؟`, en: `Three angles surround a point. Two measure ${a}° and ${b}°. What does the third measure?` }; }
  const a = int(rng, 30, 100), b = int(rng, 20, 160 - a);
  const c = 180 - a - b;
  return { eq: `${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [360 - a - b, 180 - a, 90 - a > 0 ? 90 - a : 0, a + b]), ar: `ثلاث زوايا متجاورة على مستقيم، قياس إحداها ${a}° والثانية ${b}°. ما قياس الثالثة؟`, en: `Three adjacent angles lie on a straight line. Two measure ${a}° and ${b}°. What does the third measure?` };
});

const TRI_SIDES = ['متساوي الأضلاع', 'متساوي الساقين', 'مختلف الأضلاع', 'لا يمكن رسم مثلث'];
const triBySides = T('triangle_sides', /^تصنيف المثلثات حسب اطوال اضلاعها$/, [5, 5], ({ rng, diff }) => {
  const m = span(diff, 9, 12, 16);
  // 0 classify; 1 an equilateral side from the perimeter, 2 an isosceles leg from perimeter and base, 3 an isosceles perimeter.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) { const s = int(rng, 3, m), P = 3 * s; return { eq: `equi ${P}`, answer: String(s), wrongs: pos(s, [P - s, P / 2, 2 * s, s + 3]), ar: `مثلث متساوي الأضلاع محيطه ${P} سم. ما طول ضلعه؟`, en: `An equilateral triangle has a perimeter of ${P} cm. How long is each side?` }; }
  if (k === 2 || k === 3) {
    const L = int(rng, 3, m);
    let c = 0;
    do { c = int(rng, 2, 2 * L - 1); } while (c === L);
    const P = 2 * L + c;
    if (k === 2) return { eq: `legs ${P}, ${c}`, answer: String(L), wrongs: pos(L, [P - c, P / 3, c, L + 2, (P + c) / 2]), ar: `مثلث متساوي الساقين محيطه ${P} سم وطول قاعدته ${c} سم. ما طول كل من ساقيه؟`, en: `An isosceles triangle has a perimeter of ${P} cm and a base of ${c} cm. How long is each of its equal sides?` };
    return { eq: `iso ${L}, ${c}`, answer: String(P), wrongs: pos(P, [L + c, 2 * c + L, 3 * L, 2 * (L + c)]), ar: `مثلث متساوي الساقين طول كل من ساقيه ${L} سم وطول قاعدته ${c} سم. ما محيطه؟`, en: `An isosceles triangle has equal sides of ${L} cm and a base of ${c} cm. What is its perimeter?` };
  }
  const kind = pick(rng, [0, 1, 1, 2, 2, 3]);
  let a = int(rng, 3, m), b = a, c = a;
  if (kind === 1) { do { c = int(rng, 2, 2 * a - 1); } while (c === a); }
  else if (kind === 2) { do { b = int(rng, 3, m); c = int(rng, 3, m); } while (a === b || b === c || a === c || a + b <= c || a + c <= b || b + c <= a); }
  else if (kind === 3) { b = int(rng, 2, m); c = a + b + int(rng, 0, 3); }
  const sides = shuffle(rng, [a, b, c]);
  return { eq: sides.join(', '), answer: TRI_SIDES[kind]!, wrongs: TRI_SIDES.filter((_, i) => i !== kind), ar: `ثلاثة أطوال ${sides[0]} سم و ${sides[1]} سم و ${sides[2]} سم. ما نوع المثلث الذي أضلاعه بهذه الأطوال حسب أضلاعه؟`, en: `Three lengths ${sides[0]} cm, ${sides[1]} cm and ${sides[2]} cm are used for a triangle. What type is it by its sides (or is it impossible)?` };
});

const TRI_ANGLES = ['حاد الزوايا', 'قائم الزاوية', 'منفرج الزاوية', 'لا يمكن أن يكون مثلثًا'];
const triByAngles = T('triangle_angles', /^تصنيف المثلثات حسب قياسات زواياها$/, [5, 5], ({ rng }) => {
  // 0 classify from three angles, 1 classify from two (the third is found first), 2 the other acute angle of a right triangle, 3 the third angle of an obtuse triangle.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) { const b = int(rng, 20, 70); return { eq: `right ${b}`, answer: `${90 - b}°`, wrongs: deg(90 - b, [180 - b, 90 + b, b, 180 - 2 * b]), ar: `مثلث قائم الزاوية، قياس إحدى زاويتيه الحادتين ${b}°. ما قياس الزاوية الحادة الأخرى؟`, en: `In a right triangle one acute angle measures ${b}°. What does the other acute angle measure?` }; }
  if (k === 3) {
    const a = int(rng, 95, 150), b = int(rng, 10, Math.min(60, 170 - a)), c = 180 - a - b;
    return { eq: `obtuse ${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [360 - a - b, a + b, 180 - a, 90 - b]), ar: `في المثلث ABC الزاوية A منفرجة قياسها ${a}°، وقياس الزاوية B يساوي ${b}°. ما قياس الزاوية C؟`, en: `In triangle ABC, angle A is obtuse and measures ${a}°, and angle B measures ${b}°. What does angle C measure?` };
  }
  const kind = pick(rng, k === 1 ? [0, 1, 2] : [0, 1, 2, 0, 1, 2, 3]);
  let a = 0, b = 0, c = 0;
  if (kind === 0) { do { a = int(rng, 30, 85); b = int(rng, 30, 85); c = 180 - a - b; } while (c >= 90 || c <= 20); }
  else if (kind === 1) { a = 90; b = int(rng, 20, 70); c = 90 - b; }
  else if (kind === 2) { a = int(rng, 95, 150); b = int(rng, 10, Math.min(60, 175 - a)); c = 180 - a - b; }
  else { a = int(rng, 30, 90); b = int(rng, 30, 90); c = int(rng, 30, 90); if (a + b + c === 180) c += 7; }
  const angles = shuffle(rng, [a, b, c]);
  if (k === 1) return { eq: `two ${angles[0]}, ${angles[1]}`, answer: TRI_ANGLES[kind]!, wrongs: TRI_ANGLES.filter((_, i) => i !== kind), ar: `في مثلث قياسا زاويتين ${angles[0]}° و ${angles[1]}°. ما نوع المثلث حسب زواياه؟`, en: `Two angles of a triangle measure ${angles[0]}° and ${angles[1]}°. What type of triangle is it by its angles?` };
  return { eq: angles.join(', '), answer: TRI_ANGLES[kind]!, wrongs: TRI_ANGLES.filter((_, i) => i !== kind), ar: `ثلاث زوايا قياساتها ${angles[0]}° و ${angles[1]}° و ${angles[2]}°. ما نوع المثلث الذي زواياه بهذه القياسات حسب زواياه؟`, en: `Three angles measure ${angles[0]}°, ${angles[1]}° and ${angles[2]}°. What type of triangle has these angles (or is it impossible)?` };
});

const QUADS: Array<[string, string, string]> = [
  ['مربع', 'أربعة أضلاع متساوية الطول وأربع زوايا قائمة', 'four equal sides and four right angles'],
  ['مستطيل', 'كل ضلعين متقابلين متساويان ومتوازيان وأربع زوايا قائمة، وأضلاعه الأربعة غير متساوية', 'opposite sides equal and parallel, four right angles, and the four sides are not all equal'],
  ['معين', 'أربعة أضلاع متساوية الطول وزواياه غير قائمة', 'four equal sides and no right angles'],
  ['متوازي أضلاع', 'كل ضلعين متقابلين متوازيان ومتساويان، وزواياه غير قائمة وأضلاعه الأربعة غير متساوية', 'opposite sides parallel and equal, no right angles, and the four sides are not all equal'],
  ['شبه منحرف', 'زوج واحد فقط من الأضلاع المتقابلة متوازٍ', 'exactly one pair of parallel sides'],
];
const quadName = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng }) => {
  const [n, ar, en] = pick(rng, QUADS);
  return { eq: n, answer: n, wrongs: names(rng, n, QUADS.map(q => q[0])), ar: `أي شكل رباعي له الخصائص الآتية: ${ar}؟`, en: `Which quadrilateral has these properties: ${en}?` };
});

const SHAPE_BASES: Array<[number, string, string]> = [[3, 'مثلثية', 'triangular'], [4, 'رباعية', 'square'], [5, 'خماسية', 'pentagonal'], [6, 'سداسية', 'hexagonal']];
/** The solid's name by its base, and a net's base faces: [one, two of them]. */
const SOLID_ADJ: Record<number, [string, string]> = { 3: ['ثلاثي', 'triangular'], 4: ['رباعي', 'square'], 5: ['خماسي', 'pentagonal'], 6: ['سداسي', 'hexagonal'] };
const NET_BASE: Record<number, [string, string]> = { 3: ['مثلث', 'مثلثين متطابقين'], 4: ['مربع', 'مربعين متطابقين'], 5: ['خماسي منتظم', 'خماسيين منتظمين متطابقين'], 6: ['سداسي منتظم', 'سداسيين منتظمين متطابقين'] };
const solidName = (prism: boolean, n: number) => `${prism ? 'منشور' : 'هرم'} ${SOLID_ADJ[n]![0]}`;
const prismPyramid = T('prism_pyramid_parts', /^المنشور والهرم$/, [5, 5], ({ rng }) => {
  const [n, ar, en] = pick(rng, SHAPE_BASES);
  const prism = rng() < 0.5;
  // 0 count faces, edges or vertices; 1 name the solid a net folds into; 2 the base from a count (the count read backwards).
  const ask = pick(rng, [0, 1, 2]);
  if (ask === 1) {
    const [one, two] = NET_BASE[n]!;
    const name = solidName(prism, n);
    const near = n === 3 ? [4, 5] : n === 6 ? [5, 4] : [n - 1, n + 1];
    const wr = [solidName(!prism, n), ...near.map(m => solidName(prism, m))];
    return { eq: `net ${name}`, answer: name, wrongs: wr, ar: prism ? `تتكوّن شبكة مجسم من ${two} و ${n} مستطيلات. ما اسم هذا المجسم؟` : `تتكوّن شبكة مجسم من ${one} واحد و ${n} مثلثات تحيط به. ما اسم هذا المجسم؟`, en: prism ? `The net of a solid is made of two congruent ${SOLID_ADJ[n]![1]} bases and ${n} rectangles. What is the solid?` : `The net of a solid is made of one ${SOLID_ADJ[n]![1]} base with ${n} triangles around it. What is the solid?` };
  }
  if (ask === 2) {
    const b = int(rng, 3, 8), what = pick(rng, [0, 1, 2]);
    const count = what === 0 ? (prism ? b + 2 : b + 1) : what === 1 ? (prism ? 3 * b : 2 * b) : prism ? 2 * b : b + 1;
    const [arW, enW] = what === 0 ? ['أوجهه', 'faces'] : what === 1 ? ['أحرفه', 'edges'] : ['رؤوسه', 'vertices'];
    return { eq: `base ${prism ? 'prism' : 'pyramid'} ${what} ${count}`, answer: String(b), wrongs: pos(b, [count, count - 2, count / 2, count / 3, b + 1, b - 1]), ar: `${prism ? 'منشور' : 'هرم'} عدد ${arW} ${count}. كم ضلعًا لقاعدته؟`, en: `A ${prism ? 'prism' : 'pyramid'} has ${count} ${enW}. How many sides does its base have?` };
  }
  const what = pick(rng, [0, 1, 2]);
  const f = prism ? n + 2 : n + 1, e = prism ? 3 * n : 2 * n, v = prism ? 2 * n : n + 1;
  const [ans, wr, arW, enW] = what === 0 ? [f, [e, v, f + 1, f - 1], 'أوجه', 'faces'] : what === 1 ? [e, [f, v, 2 * e, e + 1], 'أحرف', 'edges'] : [v, [f, e, v + 2, 2 * v], 'رؤوس', 'vertices'];
  return { eq: `${n}`, answer: String(ans), wrongs: pos(ans as number, wr as number[]), ar: `كم عدد ${arW} ${prism ? `منشور قاعدته ${ar}` : `هرم قاعدته ${ar}`}؟`, en: `How many ${enW} does a ${prism ? 'prism' : 'pyramid'} with a ${en} base have?` };
});

/** Capital letters with a line of symmetry as printed (a vertical one), and letters with none (N, S, Z only turn onto themselves). */
const SYM_LETTERS = ['A', 'H', 'M', 'T', 'U', 'V', 'W', 'O', 'X', 'Y', 'I'];
const NO_SYM_LETTERS = ['F', 'G', 'J', 'L', 'N', 'P', 'Q', 'R', 'S', 'Z'];
/** How many lines of symmetry a shape has — and since 2026-10-16 which letter has one, and how far a point is from its match across the axis. */
const symmetry = T('symmetry_lines', /^التماثل$/, [4, 4], ({ rng }) => {
  const shapes: Array<[string, string, number]> = [
    ['المثلث المتساوي الأضلاع', 'equilateral triangle', 3], ['المربع', 'square', 4], ['المستطيل غير المربع', 'non-square rectangle', 2],
    ['المثلث المتساوي الساقين غير المتساوي الأضلاع', 'isosceles triangle that is not equilateral', 1], ['الخماسي المنتظم', 'regular pentagon', 5], ['السداسي المنتظم', 'regular hexagon', 6],
  ];
  const ask = pick(rng, [0, 1, 2]);
  if (ask === 1) { // which letter has (or has not) a line of symmetry — the options are in the stem
    const has = rng() < 0.6, [one, rest] = has ? [SYM_LETTERS, NO_SYM_LETTERS] : [NO_SYM_LETTERS, SYM_LETTERS];
    const ans = pick(rng, one), opts = shuffle(rng, [ans, ...shuffle(rng, rest).slice(0, 3)]);
    return { eq: opts.join(' '), answer: ans, wrongs: opts.filter(o => o !== ans), ar: `أيّ الحروف الآتية ${has ? 'له' : 'ليس له'} محور تماثل: ${opts.join('، ')}؟`, en: `Which of these letters ${has ? 'has' : 'has no'} line of symmetry: ${opts.join(', ')}?` };
  }
  if (ask === 2) { // a point and its match are the same distance from the axis, on either side
    const d = int(rng, 3, 9);
    return { eq: `mirror ${d}`, answer: String(2 * d), wrongs: pos(2 * d, [d, 2 * d + 1, 2 * d - 1, d + 2]), ar: `رُسم شكل له محور تماثل رأسي على ورقة مربعات. تبعد النقطة A من الشكل ${d} مربعات عن المحور إلى يساره. كم مربعًا بين A والنقطة المقابلة لها على الجهة الأخرى من المحور؟`, en: `A shape with a vertical line of symmetry is drawn on squared paper. Point A of the shape is ${d} squares to the left of the line. How many squares apart are A and the matching point on the other side of the line?` };
  }
  const [ar, en, k] = pick(rng, shapes);
  return { eq: ar, answer: String(k), wrongs: pos(k, [k + 1, k - 1, 2 * k, k + 2, 4]), ar: `كم محور تماثل في ${ar}؟`, en: `How many lines of symmetry does a ${en} have?` };
});

const complement = T('angle_relations', /^العلاقات بين الزوايا$/, [7, 7], ({ rng, diff }) => {
  // 0–2 the other angle of a pair, 3–4 x from a pair in x; 5 the larger of a pair from the difference between them, 6 the supplement of a complement (two steps).
  const k = pick(rng, diff === 'easy' ? [0, 1, 2, 5, 6] : [0, 1, 2, 3, 4, 5, 6]);
  if (k === 5) {
    const comp = rng() < 0.5, total = comp ? 90 : 180;
    const small = int(rng, 10, total / 2 - 5), big = total - small, d = big - small;
    return { eq: `diff ${total}, ${d}`, answer: `${big}°`, wrongs: deg(big, [small, total - d, d, (comp ? 180 : 90) - small, big + 10]), ar: `زاويتان ${comp ? 'متتامتان' : 'متكاملتان'}، والفرق بين قياسيهما ${d}°. ما قياس الكبرى منهما؟`, en: `Two angles are ${comp ? 'complementary' : 'supplementary'} and their measures differ by ${d}°. What does the larger one measure?` };
  }
  if (k === 6) {
    const a = int(rng, 10, 80);
    return { eq: `supcomp ${a}`, answer: `${90 + a}°`, wrongs: deg(90 + a, [90 - a, 180 - a, a, 270 - a]), ar: `ما قياس الزاوية المكمِّلة لمتمِّمة زاوية قياسها ${a}°؟`, en: `What is the supplement of the complement of an angle measuring ${a}°?` };
  }
  if (k === 0) { const a = int(rng, 10, 80); return { eq: `${a}`, answer: `${90 - a}°`, wrongs: deg(90 - a, [180 - a, a, 90 + a, 360 - a]), ar: `زاويتان متتامتان، قياس إحداهما ${a}°. ما قياس الأخرى؟`, en: `Two angles are complementary. One measures ${a}°. What does the other measure?` }; }
  if (k === 1) { const a = int(rng, 20, 160); return { eq: `${a}`, answer: `${180 - a}°`, wrongs: deg(180 - a, [90 - a > 0 ? 90 - a : 0, a, 360 - a, 90 + a]), ar: `زاويتان متكاملتان، قياس إحداهما ${a}°. ما قياس الأخرى؟`, en: `Two angles are supplementary. One measures ${a}°. What does the other measure?` }; }
  if (k === 2) { const a = int(rng, 20, 160); return { eq: `${a}`, answer: `${a}°`, wrongs: deg(a, [180 - a, 90 - a > 0 ? 90 - a : 0, 360 - a, 2 * a]), ar: `زاويتان متقابلتان بالرأس، قياس إحداهما ${a}°. ما قياس الأخرى؟`, en: `Two angles are vertical angles. One measures ${a}°. What does the other measure?` }; }
  const x = int(rng, 5, 25), p = int(rng, 1, 3), q = int(rng, 1, 3);
  const c1 = int(rng, 1, 15), total = k === 3 ? 90 : 180;
  // (p x + c1) + (q x + c2) = total, c2 chosen so x is the solution
  const c2 = total - (p + q) * x - c1;
  if (c2 <= 0) return complement.make({ rng, diff, grade: 7 });
  const kind = k === 3 ? ['متتامتين', 'complementary'] : ['متكاملتين', 'supplementary'];
  const A = `${p === 1 ? '' : p}x + ${c1}`, B = `${q === 1 ? '' : q}x + ${c2}`;
  return { eq: `${A}, ${B}`, answer: String(x), wrongs: pos(x, [total - c1 - c2, x + 5, x - 5, Math.round(total / (p + q))]), ar: `قياسا زاويتين ${kind[0]} هما (${A})° و (${B})°. ما قيمة x؟`, en: `Two ${kind[1]} angles measure (${A})° and (${B})°. What is x?` };
});

const transversal = T('parallel_transversal', /^المستقيمات المتوازيه والقاطع$/, [7, 7], ({ rng, diff }) => {
  // 0 the other angle of a named pair (or, hard, x from one); 1 co-interior angles from the difference between them, 2 the largest or smallest of the eight angles.
  const kind = pick(rng, [0, 0, 1, 2]);
  if (kind === 1) {
    const small = int(rng, 20, 85), big = 180 - small, d = big - small;
    return { eq: `coint ${d}`, answer: `${big}°`, wrongs: deg(big, [small, 180 - d, d, 90 + d, big + 10]), ar: `زاويتان متحالفتان بين مستقيمين متوازيين وقاطع لهما، والفرق بين قياسيهما ${d}°. ما قياس الكبرى منهما؟`, en: `Two co-interior angles lie between two parallel lines and a transversal, and their measures differ by ${d}°. What does the larger one measure?` };
  }
  if (kind === 2) {
    let b = int(rng, 25, 155);
    if (b === 90) b += 7;
    const large = rng() < 0.5, ans = large ? Math.max(b, 180 - b) : Math.min(b, 180 - b);
    return { eq: `eight ${b}, ${large}`, answer: `${ans}°`, wrongs: deg(ans, [180 - ans, 360 - b, 90, b + 10, ans + 20]), ar: `قطع مستقيمٌ مستقيمين متوازيين فتكوّنت ثماني زوايا، قياس إحداها ${b}°. ما قياس ${large ? 'أكبر' : 'أصغر'} زاوية من هذه الزوايا الثماني؟`, en: `A line cuts two parallel lines, making eight angles. One of them measures ${b}°. What does the ${large ? 'largest' : 'smallest'} of the eight angles measure?` };
  }
  const a = int(rng, 40, 140);
  const rel: Array<[string, string, number]> = [['متناظرتين', 'corresponding', a], ['متبادلتين داخليًا', 'alternate interior', a], ['متحالفتين (داخليتين على جهة واحدة من القاطع)', 'co-interior (same-side interior)', 180 - a], ['متبادلتين خارجيًا', 'alternate exterior', a]];
  const [ar, en, ans] = pick(rng, rel);
  if (diff === 'hard' && rng() < 0.5 && ans === a) {
    const x = int(rng, 5, 25), p = int(rng, 2, 4), c = int(rng, 1, 20);
    const A = p * x + c, d = int(rng, 1, 20);
    return { eq: `${A}`, answer: String(x), wrongs: pos(x, [x + 5, x - 5, A - c, (A + c) / p | 0]), ar: `مستقيمان متوازيان يقطعهما قاطع، وكان قياسا زاويتين ${ar} هما ${p}x + ${c} و ${A}. ما قيمة x؟`.replace(`${p}x + ${c} و ${A}`, `(${p}x + ${c})° و ${A}°`).replace(String(d), String(d)), en: `Two parallel lines are cut by a transversal. Two ${en} angles measure (${p}x + ${c})° and ${A}°. What is x?` };
  }
  return { eq: `${a}`, answer: `${ans}°`, wrongs: deg(ans, [180 - ans, 90 - a > 0 ? 90 - a : 0, 360 - ans, a + 10]), ar: `مستقيمان متوازيان يقطعهما قاطع، وقياس إحدى زاويتين ${ar} هو ${a}°. ما قياس الزاوية الأخرى؟`, en: `Two parallel lines are cut by a transversal. One of two ${en} angles measures ${a}°. What does the other measure?` };
});

const triangleAngles = T('triangle_angle_sum', /^زوايا المثلث$/, [7, 7], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0) { const a = int(rng, 20, 100), b = int(rng, 20, 150 - a); return { eq: `${a}, ${b}`, answer: `${180 - a - b}°`, wrongs: deg(180 - a - b, [360 - a - b, a + b, 90 - a > 0 ? 90 - a : 0, 180 - a]), ar: `في مثلث قياس زاويتين ${a}° و ${b}°. ما قياس الزاوية الثالثة؟`, en: `Two angles of a triangle measure ${a}° and ${b}°. What does the third measure?` }; }
  if (k === 1) { const a = int(rng, 30, 100), b = int(rng, 20, 150 - a); return { eq: `${a}, ${b}`, answer: `${a + b}°`, wrongs: deg(a + b, [180 - a - b, 180 - a, a, 360 - a - b]), ar: `في مثلث قياس زاويتين داخليتين ${a}° و ${b}°. ما قياس الزاوية الخارجية عند الرأس الثالث؟`, en: `Two interior angles of a triangle measure ${a}° and ${b}°. What is the exterior angle at the third vertex?` }; }
  if (k === 2) {
    // ratios whose parts divide 180 evenly
    const [p, q, r] = pick(rng, [[1, 2, 3], [2, 3, 4], [1, 1, 2], [1, 2, 6], [3, 4, 5], [2, 2, 5], [1, 3, 5], [1, 4, 7]] as Array<[number, number, number]>);
    const unit = 180 / (p + q + r);
    if (!Number.isInteger(unit)) return triangleAngles.make({ rng, diff, grade: 7 });
    const big = Math.max(p, q, r) * unit;
    return { eq: `${p}, ${q}, ${r}`, answer: `${big}°`, wrongs: deg(big, [Math.max(p, q, r) * 30, unit, Math.min(p, q, r) * unit + 10, 180 - big, 90]), ar: `زوايا مثلث بنسبة ${p} : ${q} : ${r}. ما قياس أكبر زاوية؟`, en: `The angles of a triangle are in the ratio ${p} : ${q} : ${r}. What does the largest angle measure?` };
  }
  const a = int(rng, 20, 80);
  return { eq: `${a}`, answer: `${180 - 2 * a}°`, wrongs: deg(180 - 2 * a, [180 - a, a, 90 - a > 0 ? 90 - a : 0, 2 * a]), ar: `في مثلث متساوي الساقين قياس كل من زاويتي القاعدة ${a}°. ما قياس زاوية الرأس؟`, en: `In an isosceles triangle each base angle measures ${a}°. What does the apex angle measure?` };
});

const polygonAngles = T('polygon_angles', /^زوايا المضلع$/, [7, 7], ({ rng, diff }) => {
  const n = int(rng, 5, span(diff, 8, 10, 12));
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2]);
  if (k === 0) { const s = (n - 2) * 180; return { eq: `${n}`, answer: `${s}°`, wrongs: deg(s, [n * 180, (n - 1) * 180, (n - 3) * 180, 360]), ar: `ما مجموع قياسات الزوايا الداخلية لمضلع عدد أضلاعه ${n}؟`, en: `What is the sum of the interior angles of a polygon with ${n} sides?` }; }
  const sides = pick(rng, [5, 6, 8, 9, 10, 12]);
  if (k === 1) { const a = ((sides - 2) * 180) / sides; return { eq: `${sides}`, answer: `${a}°`, wrongs: deg(a, [360 / sides, 180 - a / 2, ((sides - 2) * 180) / (sides - 1), a + 10]), ar: `ما قياس كل زاوية داخلية في مضلع منتظم عدد أضلاعه ${sides}؟`, en: `What does each interior angle of a regular polygon with ${sides} sides measure?` }; }
  const ext = 360 / sides;
  return { eq: `${ext}`, answer: String(sides), wrongs: pos(sides, [sides + 2, sides - 2, 180 - ext, sides * 2]), ar: `قياس كل زاوية خارجية في مضلع منتظم ${ext}°. كم عدد أضلاعه؟`, en: `Each exterior angle of a regular polygon measures ${ext}°. How many sides does it have?` };
});

// ─── Grade 8: parallelograms, congruence, similarity, Pythagoras ────────────

const parallelogram = T('parallelogram_props', /^متوازي الاضلاع$/, [8, 8], ({ rng, diff }) => {
  // One kind each: an angle from A (0 B, 1 C), half a diagonal (2), the perimeter (3), a side from the perimeter (4),
  // A from how much B exceeds it (5).
  const k = pick(rng, diff === 'easy' ? [pick(rng, [0, 1]), 2, 3, 4] : [pick(rng, [0, 1]), 2, 3, 4, 5]);
  const a = int(rng, 50, 130);
  if (k === 4) {
    const l = int(rng, 4, 14), w = int(rng, 3, 12), P = 2 * (l + w);
    return { eq: `P ${P}, ${l}`, answer: String(w), wrongs: pos(w, [P - l, P / 2, P - 2 * l, w + 2]), ar: `محيط متوازي الأضلاع ABCD يساوي ${P} سم، وطول الضلع AB يساوي ${l} سم. ما طول الضلع BC؟`, en: `Parallelogram ABCD has perimeter ${P} cm and AB = ${l} cm. How long is BC?` };
  }
  if (k === 5) {
    // consecutive angles add to 180°: A + (A + d) = 180
    const d = 2 * int(rng, 5, 40), A = (180 - d) / 2;
    return { eq: `B − A ${d}`, answer: `${A}°`, wrongs: deg(A, [A + d, 180 - d, d, 90]), ar: `في متوازي الأضلاع ABCD يزيد قياس الزاوية B على قياس الزاوية A بمقدار ${d}°. ما قياس الزاوية A؟`, en: `In parallelogram ABCD, angle B is ${d}° more than angle A. What does angle A measure?` };
  }
  if (k === 0) return { eq: `${a}`, answer: `${180 - a}°`, wrongs: deg(180 - a, [a, 90, 360 - a, 90 - a > 0 ? 90 - a : 0]), ar: `في متوازي الأضلاع ABCD قياس الزاوية A هو ${a}°. ما قياس الزاوية B؟`, en: `In parallelogram ABCD, angle A measures ${a}°. What does angle B measure?` };
  if (k === 1) return { eq: `${a}`, answer: `${a}°`, wrongs: deg(a, [180 - a, 90, 360 - a, 2 * a]), ar: `في متوازي الأضلاع ABCD قياس الزاوية A هو ${a}°. ما قياس الزاوية C؟`, en: `In parallelogram ABCD, angle A measures ${a}°. What does angle C measure?` };
  if (k === 2) { const d = 2 * int(rng, 4, 12); return { eq: `${d}`, answer: String(d / 2), wrongs: pos(d / 2, [d, 2 * d, d / 2 + 2, d - 2]), ar: `في متوازي الأضلاع ABCD يتقاطع القطران في النقطة O، وطول القطر AC يساوي ${d} سم. ما طول AO؟`, en: `In parallelogram ABCD the diagonals meet at O, and diagonal AC is ${d} cm long. What is AO?` }; }
  const l = int(rng, 4, 14), w = int(rng, 3, 12);
  return { eq: `${l}, ${w}`, answer: String(2 * (l + w)), wrongs: pos(2 * (l + w), [l + w, l * w, 2 * l + w, 4 * l]), ar: `في متوازي الأضلاع ABCD، AB = ${l} سم و BC = ${w} سم. ما محيطه؟`, en: `In parallelogram ABCD, AB = ${l} cm and BC = ${w} cm. What is its perimeter?` };
});

const parallelogramTest = T('parallelogram_test', /^تمييز متوازي الاضلاع$/, [8, 8], ({ rng, diff }) => {
  const x = int(rng, 3, 15), p = int(rng, 2, 5), q = int(rng, 1, p - 1);
  const c = int(rng, 1, 12), d = (p - q) * x + c;
  // 0 opposite sides, 1 opposite angles, 2 diagonals bisecting each other, 3 the fourth vertex in the plane.
  const kind = pick(rng, diff === 'easy' ? [0, 2, 3] : [0, 1, 2, 3]);
  if (kind === 2) return { eq: `diag ${p}, ${c}, ${q}, ${d}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, d - c, (d + c) / (p + q) | 0]), ar: `في الشكل الرباعي ABCD يتقاطع القطران AC و BD في النقطة M. ما قيمة x التي تجعل الشكل ABCD متوازي أضلاع إذا كان AM = ${lin(p, c)} و MC = ${lin(q, d)}؟`, en: `In quadrilateral ABCD the diagonals AC and BD meet at M. For what x is ABCD a parallelogram if AM = ${lin(p, c)} and MC = ${lin(q, d)}?` };
  if (kind === 3) {
    let A: [number, number] = [0, 0], B: [number, number] = [0, 0], C: [number, number] = [0, 0];
    do {
      A = [int(rng, -4, 6), int(rng, -4, 6)]; B = [int(rng, -4, 6), int(rng, -4, 6)]; C = [int(rng, -4, 6), int(rng, -4, 6)];
    } while ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) === 0);
    const D: [number, number] = [A[0] + C[0] - B[0], A[1] + C[1] - B[1]];
    return { eq: `vertex ${pt(...A)}, ${pt(...B)}, ${pt(...C)}`, answer: pt(...D), wrongs: ptOpts(D, [[B[0] + C[0] - A[0], B[1] + C[1] - A[1]], [A[0] + B[0] - C[0], A[1] + B[1] - C[1]], [D[1], D[0]], [C[0] - B[0], C[1] - B[1]]]), ar: `النقاط A${pt(...A)} و B${pt(...B)} و C${pt(...C)} ثلاثة رؤوس متتالية في متوازي الأضلاع ABCD. ما إحداثيات الرأس D؟`, en: `A${pt(...A)}, B${pt(...B)} and C${pt(...C)} are three consecutive vertices of parallelogram ABCD. What are the coordinates of D?` };
  }
  if (kind === 1) {
    const P = int(rng, 2, 4), Q = int(rng, 1, P - 1), c1 = int(rng, 2, 20), c2 = (P - Q) * x + c1;
    if (P * x + c1 >= 170 || Q * x >= 170) return parallelogramTest.make({ rng, diff, grade: 8 });
    return { eq: `${P}, ${c1}, ${Q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 3, x - 3, c2 - c1, P * x + c1]), ar: `ما قيمة x التي تجعل الشكل ABCD متوازي أضلاع إذا كان A = (${P}x + ${c1})° و C = (${Q}x + ${c2})°؟`.replace(`${Q}x + ${c2}`, `${Q === 1 ? '' : Q}x + ${c2}`).replace(`${P}x + ${c1}`, `${P}x + ${c1}`).replace('(' + (Q === 1 ? '' : String(Q)) + 'x + ' + c2 + ')', '(' + (Q === 1 ? '' : String(Q)) + 'x + ' + c2 + ')'), en: `For what x is ABCD a parallelogram if A = (${P}x + ${c1})° and C = (${Q === 1 ? '' : Q}x + ${c2})°?` };
  }
  return { eq: `${p}, ${c}, ${q}, ${d}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, d - c, (d + c) / (p + q) | 0]), ar: `ما قيمة x التي تجعل الشكل ABCD متوازي أضلاع إذا كان AB = ${p}x + ${c} و CD = ${q === 1 ? '' : q}x + ${d}؟`, en: `For what x is ABCD a parallelogram if AB = ${p}x + ${c} and CD = ${q === 1 ? '' : q}x + ${d}?` };
});

const SPECIAL_PGRAMS_NAMES = ['مستطيل', 'معين', 'مربع', 'متوازي أضلاع'];
/** [what is known, English, the most exact name] — Grade 8's tests for a special parallelogram. */
const SPECIAL_PGRAMS: Array<[string, string, string]> = [
  ['قطراه متطابقان وغير متعامدين', 'has congruent diagonals that are not perpendicular', 'مستطيل'],
  ['قطراه متعامدان وغير متطابقين', 'has perpendicular diagonals that are not congruent', 'معين'],
  ['قطراه متطابقان ومتعامدان', 'has diagonals that are both congruent and perpendicular', 'مربع'],
  ['قطراه غير متطابقين وغير متعامدين', 'has diagonals that are neither congruent nor perpendicular', 'متوازي أضلاع'],
  ['فيه ضلعان متجاوران متطابقان، وزواياه غير قائمة', 'has two congruent adjacent sides and no right angle', 'معين'],
  ['إحدى زواياه قائمة، وضلعاه المتجاوران غير متطابقين', 'has a right angle, and its adjacent sides are not congruent', 'مستطيل'],
];
const specialParallelograms = T('parallelogram_special', /^حالات خاصه من متوازي الاضلاع$/, [8, 8], ({ rng, diff }) => {
  const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]];
  const [a, b, c] = pick(rng, TRIPLES);
  // 0 a rhombus's area, 1 its side, both from its diagonals; 2 a rectangle's diagonal; 3 an angle the rhombus's perpendicular diagonals make,
  // 4 x from a rectangle's congruent diagonals, 5 the most exact name for a parallelogram from its diagonals or sides.
  const k = pick(rng, diff === 'easy' ? [0, 1, 3, 5] : [0, 1, 2, 3, 4, 5]);
  if (k === 3) {
    let t = int(rng, 20, 70);
    if (t === 45) t += 5;
    return { eq: `rhombus ${t}`, answer: `${90 - t}°`, wrongs: deg(90 - t, [t, 180 - 2 * t, 2 * t, 180 - t]), ar: `في المعين ABCD يتقاطع القطران في النقطة O، وقياس الزاوية ABD يساوي ${t}°. ما قياس الزاوية BAC؟`, en: `In rhombus ABCD the diagonals meet at O, and angle ABD measures ${t}°. What does angle BAC measure?` };
  }
  if (k === 4) {
    const x = int(rng, 2, span(diff, 8, 12, 15)), p = int(rng, 2, 5), q = int(rng, 1, p - 1), c1 = int(rng, 1, 12), c2 = c1 + (p - q) * x;
    return { eq: `rect ${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, c2 - c1, (c1 + c2) / (p + q) | 0, p * x + c1]), ar: `في المستطيل ABCD، طول القطر AC يساوي (${lin(p, c1)}) سم، وطول القطر BD يساوي (${lin(q, c2)}) سم. ما قيمة x؟`, en: `In rectangle ABCD, diagonal AC is (${lin(p, c1)}) cm and diagonal BD is (${lin(q, c2)}) cm. What is x?` };
  }
  if (k === 5) {
    const [cond, en, ans] = pick(rng, SPECIAL_PGRAMS);
    return { eq: `name ${ans}`, answer: ans, wrongs: SPECIAL_PGRAMS_NAMES.filter(n => n !== ans), ar: `متوازي أضلاع ${cond}. ما أدق اسم له: مستطيل أم معين أم مربع أم متوازي أضلاع؟`, en: `A parallelogram ${en}. What is its most exact name: rectangle, rhombus, square or parallelogram?` };
  }
  if (k === 0) return { eq: `${2 * a}, ${2 * b}`, answer: String(2 * a * b), wrongs: pos(2 * a * b, [4 * a * b, a * b, 2 * (a + b), 4 * a * a + 4 * b * b > 0 ? 2 * c : 1]), ar: `قطرا معين طولاهما ${2 * a} سم و ${2 * b} سم. ما مساحته؟`, en: `A rhombus has diagonals ${2 * a} cm and ${2 * b} cm. What is its area?` };
  if (k === 1) return { eq: `${2 * a}, ${2 * b}`, answer: String(c), wrongs: pos(c, [a + b, 2 * c, a * b, c + 1]), ar: `قطرا معين طولاهما ${2 * a} سم و ${2 * b} سم. ما طول ضلعه؟`, en: `A rhombus has diagonals ${2 * a} cm and ${2 * b} cm. What is the length of its side?` };
  return { eq: `${a}, ${b}`, answer: String(c), wrongs: pos(c, [a + b, a * b, c + 2, c - 1]), ar: `مستطيل طوله ${b} سم وعرضه ${a} سم. ما طول قطره؟`, en: `A rectangle is ${b} cm long and ${a} cm wide. What is the length of its diagonal?` };
});

const parallelProof = T('parallel_proof', /^اثبات توازي المستقيمات وتعامدها$/, [8, 8], ({ rng, diff }) => {
  const x = int(rng, 4, 20), p = int(rng, 2, 6), q = int(rng, 1, p - 1);
  // 0 corresponding, 1 co-interior, 2 complementary adjacent angles: x for parallel or perpendicular lines;
  // 3 x from two congruent adjacent angles on a line, 4 x by the perpendicular-transversal theorem, 5 the angle a named pair needs for the lines to be parallel.
  const c1 = int(rng, 1, 25), kind = pick(rng, [0, 1, 2, 3, 4, 5]);
  if (kind === 3 || kind === 4) {
    const px = int(rng, 2, 6), xx = int(rng, 4, Math.floor(85 / px)), c = 90 - px * xx;
    if (c <= 0) return parallelProof.make({ rng, diff, grade: 8 });
    const wr = pos(xx, [xx + 2, xx - 2, Math.round(180 / px) - c, (180 - c) / px, 90 - c]);
    if (kind === 3) return { eq: `linear ${px}, ${c}`, answer: String(xx), wrongs: wr, ar: `تقاطع مستقيمان فكوّنا زاويتين متجاورتين متطابقتين، قياس كل منهما (${lin(px, c)})°. ما قيمة x؟`, en: `Two intersecting lines form two congruent adjacent angles, each measuring (${lin(px, c)})°. What is x?` };
    return { eq: `perp ${px}, ${c}`, answer: String(xx), wrongs: wr, ar: `المستقيم m يوازي المستقيم l، والمستقيم n عمودي على l. إذا قطع n المستقيم m مكوّنًا زاوية قياسها (${lin(px, c)})°، فما قيمة x؟`, en: `Line m is parallel to line l, and line n is perpendicular to l. If n meets m at an angle of (${lin(px, c)})°, what is x?` };
  }
  if (kind === 5) {
    const a = int(rng, 35, 145), [ar, en, need] = pick(rng, [['متحالفتين', 'co-interior', 180 - a], ['متبادلتين داخليًا', 'alternate interior', a], ['متناظرتين', 'corresponding', a]] as Array<[string, string, number]>);
    return { eq: `need ${ar} ${a}`, answer: `${need}°`, wrongs: deg(need, [180 - need, 90 - a > 0 ? 90 - a : 0, a + 10, 360 - a]), ar: `قطع مستقيمٌ المستقيمين l و m، فكانت إحدى زاويتين ${ar} قياسها ${a}°. كم يجب أن يكون قياس الأخرى ليكون l ∥ m؟`, en: `A line cuts lines l and m, and one of two ${en} angles measures ${a}°. What must the other measure for l ∥ m?` };
  }
  if (kind === 0) { const c2 = c1 + (p - q) * x; return { eq: `${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, c2 - c1, (c2 + c1) / (p + q) | 0]), ar: `قياسا زاويتين متناظرتين (${p}x + ${c1})° و (${q === 1 ? '' : q}x + ${c2})°... ما قيمة x التي تجعل المستقيمين متوازيين؟`.replace('... ', '. '), en: `Two corresponding angles measure (${p}x + ${c1})° and (${q === 1 ? '' : q}x + ${c2})°. What value of x makes the lines parallel?` }; }
  if (kind === 1) { const c2 = 180 - (p + q) * x - c1; if (c2 <= 0) return parallelProof.make({ rng, diff, grade: 8 }); return { eq: `${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, (180 - c1 - c2) / (p + q) + 2 | 0, 180 - c1 - c2]), ar: `قياسا زاويتين متحالفتين (${p}x + ${c1})° و (${q === 1 ? '' : q}x + ${c2})°. ما قيمة x التي تجعل المستقيمين متوازيين؟`, en: `Two co-interior angles measure (${p}x + ${c1})° and (${q === 1 ? '' : q}x + ${c2})°. What value of x makes the lines parallel?` }; }
  const c2 = 90 - (p + q) * x - c1;
  if (c2 <= 0) return parallelProof.make({ rng, diff, grade: 8 });
  return { eq: `${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, (90 - c1 - c2) / (p + q) + 2 | 0, 90 - c1 - c2]), ar: `زاويتان متجاورتان قياسهما (${p}x + ${c1})° و (${q === 1 ? '' : q}x + ${c2})°. ما قيمة x التي تجعل المستقيمين متعامدين؟`, en: `Two adjacent angles measure (${p}x + ${c1})° and (${q === 1 ? '' : q}x + ${c2})°. What value of x makes the lines perpendicular?` };
});

const isosceles = T('isosceles', /^المثلثات المتطابقه الضلعين والمثلثات المتطابقه الاضلاع$/, [8, 8], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2]);
  if (k === 0) { const a = 2 * int(rng, 10, 70); return { eq: `${a}`, answer: `${(180 - a) / 2}°`, wrongs: deg((180 - a) / 2, [180 - a, a / 2, 90 - a > 0 ? 90 - a : 0, a]), ar: `في مثلث متطابق الضلعين قياس زاوية الرأس ${a}°. ما قياس كل من زاويتي القاعدة؟`, en: `In an isosceles triangle the apex angle is ${a}°. What does each base angle measure?` }; }
  if (k === 1) { const b = int(rng, 20, 80); return { eq: `${b}`, answer: `${180 - 2 * b}°`, wrongs: deg(180 - 2 * b, [180 - b, 2 * b, 90 - b > 0 ? 90 - b : 0, b]), ar: `في مثلث متطابق الضلعين قياس كل من زاويتي القاعدة ${b}°. ما قياس زاوية الرأس؟`, en: `In an isosceles triangle each base angle is ${b}°. What does the apex angle measure?` }; }
  const s = int(rng, 4, 20);
  return { eq: `${s}`, answer: String(3 * s), wrongs: pos(3 * s, [2 * s, s * s, 4 * s, s + 3]), ar: `ما محيط مثلث متطابق الأضلاع طول ضلعه ${s} سم؟`, en: `What is the perimeter of an equilateral triangle with side ${s} cm?` };
});

const congruence = (id: string, match: RegExp, answers: string[]) => T(id, match, [8, 8], ({ rng }) => {
  const DESC: Record<string, [string, string]> = {
    SSS: ['ثلاثة أضلاع في أحد المثلثين تطابق ثلاثة أضلاع في المثلث الآخر', 'three sides of one triangle equal three sides of the other'],
    SAS: ['ضلعان والزاوية المحصورة بينهما في أحد المثلثين تطابق ما يناظرها في الآخر', 'two sides and the included angle of one triangle equal those of the other'],
    HL: ['الوتر وضلع من ضلعي الزاوية القائمة في مثلث قائم الزاوية يطابقان ما يناظرهما في مثلث قائم آخر', 'the hypotenuse and a leg of one right triangle equal those of another right triangle'],
    ASA: ['زاويتان والضلع المحصور بينهما في أحد المثلثين تطابق ما يناظرها في الآخر', 'two angles and the included side of one triangle equal those of the other'],
    AAS: ['زاويتان وضلع غير محصور بينهما في أحد المثلثين تطابق ما يناظرها في الآخر', 'two angles and a non-included side of one triangle equal those of the other'],
  };
  const ans = pick(rng, answers);
  const all = ['SSS', 'SAS', 'HL', 'ASA', 'AAS'];
  return { eq: ans, answer: ans, wrongs: names(rng, ans, all), ar: `إذا كان ${DESC[ans]![0]}، فبأي حالة تتطابق المثلثان؟`, en: `If ${DESC[ans]![1]}, by which criterion are the triangles congruent?` };
});

/**
 * ASA and AAS: besides naming the criterion from its description (0), name it
 * from marked parts (1), pick the extra part a criterion needs (2), and use the
 * congruence to find an angle (3).
 */
const congruenceAsa = (id: string, match: RegExp) => {
  const base = congruence(id, match, ['ASA', 'AAS']);
  const all = ['SSS', 'SAS', 'HL', 'ASA', 'AAS'];
  return T(id, match, [8, 8], ({ rng, diff, grade }) => {
    // 4 a side from the congruence, 5 x from two corresponding sides.
    const k = pick(rng, [0, 1, 2, 3, 4, 5]);
    const corr = (v: string) => v.split('').map(c => 'DEF'['ABC'.indexOf(c)]).join('');
    if (k === 1) {
      // two marked angles and a side: ASA when the side joins the two angles
      const [p, q] = pick(rng, ['AB', 'BC', 'AC']).split('') as [string, string], side = pick(rng, ['AB', 'BC', 'AC']);
      const ans = side === p + q ? 'ASA' : 'AAS';
      return { eq: `parts ${p}${q} ${side}`, answer: ans, wrongs: names(rng, ans, all), ar: `في المثلثين ABC و DEF: ∠${p} ≅ ∠${corr(p)} و ∠${q} ≅ ∠${corr(q)} و ${side} ≅ ${corr(side)}. بأي حالة يتطابق المثلثان؟`, en: `In triangles ABC and DEF, ∠${p} ≅ ∠${corr(p)}, ∠${q} ≅ ∠${corr(q)} and ${side} ≅ ${corr(side)}. By which criterion are the triangles congruent?` };
    }
    if (k === 2) {
      // one angle and a side through it: ASA needs the angle at the side's other end, AAS the angle off the side
      const angle = pick(rng, ['A', 'B', 'C']), side = pick(rng, ['AB', 'BC', 'AC'].filter(s => s.includes(angle))), asa = rng() < 0.5;
      const other = side.replace(angle, ''), off = 'ABC'.replace(side[0]!, '').replace(side[1]!, '');
      const ans = `∠${asa ? other : off} ≅ ∠${corr(asa ? other : off)}`;
      const sides = ['AB', 'BC', 'AC'].filter(s => s !== side).map(s => `${s} ≅ ${corr(s)}`);
      return { eq: `need ${angle} ${side} ${asa ? 'ASA' : 'AAS'}`, answer: ans, wrongs: [`∠${asa ? off : other} ≅ ∠${corr(asa ? off : other)}`, ...sides], ar: `في المثلثين ABC و DEF: ∠${angle} ≅ ∠${corr(angle)} و ${side} ≅ ${corr(side)}. ما التطابق الإضافي الذي يلزم لإثبات تطابق المثلثين بحالة ${asa ? 'ASA' : 'AAS'}؟`, en: `In triangles ABC and DEF, ∠${angle} ≅ ∠${corr(angle)} and ${side} ≅ ${corr(side)}. Which extra congruence proves the triangles congruent by ${asa ? 'ASA' : 'AAS'}?` };
    }
    if (k === 4) {
      let s = [0, 0, 0];
      do s = [int(rng, 3, 15), int(rng, 3, 15), int(rng, 3, 15)]; while (s[0]! + s[1]! <= s[2]! || s[0]! + s[2]! <= s[1]! || s[1]! + s[2]! <= s[0]! || new Set(s).size < 3);
      const [ab, bc, ac] = s as [number, number, number], i = int(rng, 0, 2), ask = ['DE', 'EF', 'DF'][i]!, ans = s[i]!;
      return { eq: `sides ${ab}, ${bc}, ${ac} ${ask}`, answer: String(ans), wrongs: pos(ans, s.filter(v => v !== ans).concat(ab + bc + ac, ans + 1)), ar: `إذا كان △ABC ≅ △DEF، وكانت أطوال أضلاع المثلث ABC هي AB = ${ab} سم و BC = ${bc} سم و AC = ${ac} سم، فما طول الضلع ${ask}؟`, en: `If △ABC ≅ △DEF with AB = ${ab} cm, BC = ${bc} cm and AC = ${ac} cm, how long is ${ask}?` };
    }
    if (k === 5) {
      const x = int(rng, 2, span(diff, 8, 12, 15)), p = int(rng, 2, 5), q = int(rng, 1, p - 1), c1 = int(rng, 1, 12), c2 = c1 + (p - q) * x;
      const side = pick(rng, ['AB', 'BC', 'AC']);
      return { eq: `x ${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, c2 - c1, p * x + c1, (c1 + c2) / (p + q) | 0]), ar: `المثلثان ABC و DEF متطابقان (△ABC ≅ △DEF). إذا كان ${side} = (${lin(p, c1)}) سم و ${corr(side)} = (${lin(q, c2)}) سم، فما قيمة x؟`, en: `Triangles ABC and DEF are congruent (△ABC ≅ △DEF). If ${side} = (${lin(p, c1)}) cm and ${corr(side)} = (${lin(q, c2)}) cm, what is x?` };
    }
    if (k === 3) {
      const a = int(rng, 30, 90), b = int(rng, 25, 150 - a), c = 180 - a - b;
      return { eq: `angle ${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [a, b, a + b, 180 - a]), ar: `إذا كان △ABC ≅ △DEF، وكان قياس الزاوية A يساوي ${a}° وقياس الزاوية B يساوي ${b}°، فما قياس الزاوية F؟`, en: `If △ABC ≅ △DEF, angle A = ${a}° and angle B = ${b}°, what does angle F measure?` };
    }
    return base.make({ rng, diff, grade });
  });
};

const similarity = T('similar_triangles', /^تشابه المثلثات$/, [8, 8], ({ rng, diff }) => {
  const a = int(rng, 2, 6), k = int(rng, 2, 5), c = int(rng, 2, span(diff, 8, 12, 15));
  const b = a * k, f = c * k;
  // 0 a missing side, 1 a perimeter; 2 the scale factor, 3 a corresponding angle (AA), 4 a height from shadows.
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 2) return { eq: `scale ${a}, ${b}`, answer: String(k), wrongs: wrongsFrom(String(k), [`1/${k}`, String(b - a), String(k + 1), String(k * k)], j => String(k + 1 + Math.abs(j))), ar: `المثلثان ABC و DEF متشابهان، AB = ${a} سم و DE = ${b} سم. ما معامل التشابه من المثلث ABC إلى المثلث DEF؟`, en: `Triangles ABC and DEF are similar, with AB = ${a} cm and DE = ${b} cm. What is the scale factor from ABC to DEF?` };
  if (kind === 3) {
    const A = int(rng, 30, 80), B = int(rng, 30, 130 - A), C = 180 - A - B;
    return { eq: `AA ${A}, ${B}`, answer: `${C}°`, wrongs: deg(C, [A, B, A + B, 180 - A, 90]), ar: `المثلثان ABC و DEF متشابهان، وفيهما قياس الزاوية A يساوي ${A}° وقياس الزاوية E يساوي ${B}°. ما قياس الزاوية F؟`, en: `Triangles ABC and DEF are similar, with angle A = ${A}° and angle E = ${B}°. What does angle F measure?` };
  }
  if (kind === 4) {
    const p = int(rng, 1, 3);
    let s = int(rng, 2, 5);
    if (s === p) s += 1;
    const t = int(rng, 3, span(diff, 5, 8, 10));
    return { eq: `shadow ${p}, ${s}, ${s * t}`, answer: String(p * t), wrongs: pos(p * t, [s * t, (s * s * t) / p, s * t - s + p, p * t + p, t]), ar: `في اللحظة نفسها، يلقي عمود طوله ${p} م ظلًّا طوله ${s} م، وتلقي شجرة ظلًّا طوله ${s * t} م. ما طول الشجرة؟`, en: `At the same moment, a pole ${p} m tall casts a shadow ${s} m long and a tree casts a shadow ${s * t} m long. How tall is the tree?` };
  }
  if (kind === 0) return { eq: `${a}, ${b}, ${c}`, answer: String(f), wrongs: pos(f, [c + (b - a), c + k, (c * a) / b | 0, b * c]), ar: `المثلثان ABC و DEF متشابهان، AB = ${a} سم و DE = ${b} سم و BC = ${c} سم. ما طول EF؟`, en: `Triangles ABC and DEF are similar, with AB = ${a} cm, DE = ${b} cm and BC = ${c} cm. What is EF?` };
  const P = int(rng, 6, 30) * 1;
  return { eq: `${P}, ${k}`, answer: String(P * k), wrongs: pos(P * k, [P + k, P * k * k, P / k | 0, P * k + k]), ar: `المثلثان ABC و DEF متشابهان، وطول كل ضلع في DEF يساوي ${k} أمثال طول الضلع المناظر في ABC، ومحيط ABC يساوي ${P} سم. ما محيط DEF؟`, en: `Triangles ABC and DEF are similar, each side of DEF is ${k} times the matching side of ABC, and the perimeter of ABC is ${P} cm. What is the perimeter of DEF?` };
});

const pyth = T('pythagoras', /^نظريه فيثاغورس$/, [8, 8], ({ rng, diff }) => {
  const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29]];
  const [a, b, c] = pick(rng, TRIPLES);
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  if (k === 0) return { eq: `${a}, ${b}`, answer: String(c), wrongs: pos(c, [a + b, b - a, a * b, c + 1]), ar: `مثلث قائم الزاوية طولا ضلعيه القائمين ${a} سم و ${b} سم. ما طول وتره؟`, en: `A right triangle has legs ${a} cm and ${b} cm. What is the length of its hypotenuse?` };
  if (k === 1) return { eq: `${c}, ${a}`, answer: String(b), wrongs: pos(b, [c - a, c + a, c * a, b + 1]), ar: `مثلث قائم الزاوية وتره ${c} سم وأحد ضلعيه القائمين ${a} سم. ما طول الضلع القائم الآخر؟`, en: `A right triangle has hypotenuse ${c} cm and one leg ${a} cm. What is the other leg?` };
  if (k === 2) { const p = pick(rng, [1, 2, 3, 4, 5, 6]), q = pick(rng, [1, 2, 3, 5, 6, 7]); const s = p * p + q * q; const sqfree = ![4, 8, 9, 12, 16, 18, 20, 25, 27, 28, 32, 36, 40, 45, 48, 50, 52, 54, 60, 61 * 0].some(v => v === s) && [4, 9, 25, 49].every(sq => s % sq !== 0); if (!sqfree || Number.isInteger(Math.sqrt(s)) || p === q) return pyth.make({ rng, diff, grade: 8 }); return { eq: `${p}, ${q}`, answer: `√${s}`, wrongs: wrongsFrom(`√${s}`, [`${p + q}`, `√${p + q}`, `${s}`, `√${s + 1}`], j => `√${s + Math.abs(j) + 1}`), ar: `مثلث قائم الزاوية طولا ضلعيه القائمين ${p} سم و ${q} سم. ما طول وتره (بالصورة الجذرية)؟`, en: `A right triangle has legs ${p} cm and ${q} cm. What is its hypotenuse (in radical form)?` }; }
  const kinds = ['حاد الزوايا', 'قائم الزاوية', 'منفرج الزاوية', 'لا يوجد مثلث بهذه الأطوال'];
  const t = pick(rng, [0, 1, 2, 3]);
  let x = a, y = b, z = c;
  if (t === 1) { /* a triple */ } else if (t === 0) { x = 5; y = 6; z = int(rng, 6, 7); } else if (t === 2) { x = 4; y = 5; z = int(rng, 7, 8); } else { x = 3; y = 4; z = int(rng, 8, 10); }
  const sides = shuffle(rng, [x, y, z]);
  return { eq: sides.join(', '), answer: kinds[t]!, wrongs: kinds.filter((_, i) => i !== t), ar: `مثلث أطوال أضلاعه ${sides[0]} سم و ${sides[1]} سم و ${sides[2]} سم. ما نوعه حسب زواياه (أو لا يوجد مثلث)؟`, en: `A triangle has sides ${sides[0]} cm, ${sides[1]} cm and ${sides[2]} cm. What type is it by its angles (or does no such triangle exist)?` };
});

// ─── transformations and the coordinate plane ───────────────────────────────

const reflectLine = T('reflect_line', /^الانعكاس$/, [4, 4], ({ rng, diff }) => {
  const a = int(rng, 3, 8), x = int(rng, 1, a - 1), y = int(rng, 1, 9);
  const dx = a - x;
  // 0 in a vertical line, 1 in a horizontal line, 2 find the mirror line from a point and its image, 3 how far a point is from its image.
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) {
    const b = int(rng, 3, 8), yy = int(rng, 1, b - 1), xx = int(rng, 1, 9);
    const img: [number, number] = [xx, 2 * b - yy];
    return { eq: `h ${pt(xx, yy)}, ${b}`, answer: pt(...img), wrongs: ptOpts(img, [[xx, yy], [xx, b], [2 * b - yy, xx], [2 * b - xx, yy], [xx, b + yy]]), ar: `انعكاس النقطة ${pt(xx, yy)} حول المستقيم الأفقي y = ${b}. ما إحداثيات صورتها؟`, en: `Reflect the point ${pt(xx, yy)} in the horizontal line y = ${b}. What are the coordinates of the image?` };
  }
  if (k === 2) {
    const x2 = a + dx;
    return { eq: `mirror ${pt(x, y)}, ${pt(x2, y)}`, answer: `x = ${a}`, wrongs: wrongsFrom(`x = ${a}`, [`x = ${x2 - x}`, `y = ${y}`, `x = ${x + x2}`, `y = ${a}`], j => `x = ${a + Math.abs(j)}`), ar: `صورة النقطة ${pt(x, y)} بالانعكاس حول مستقيم رأسي هي النقطة ${pt(x2, y)}. ما معادلة محور الانعكاس؟`, en: `The image of ${pt(x, y)} after a reflection in a vertical line is ${pt(x2, y)}. What is the equation of the line of reflection?` };
  }
  if (k === 3) return { eq: `dist ${pt(x, y)}, ${a}`, answer: String(2 * dx), wrongs: pos(2 * dx, [dx, a, 2 * a, x + a, 2 * dx + 1]), ar: `ما المسافة بالوحدات بين النقطة ${pt(x, y)} وصورتها بالانعكاس حول المستقيم الرأسي x = ${a}؟`, en: `What is the distance, in units, between ${pt(x, y)} and its image after a reflection in the vertical line x = ${a}?` };
  const ans: [number, number] = [a + dx, y];
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[x, y], [a, y], [x + dx, y], [y, a + dx], [a + dx, -y]]), ar: `انعكاس النقطة ${pt(x, y)} حول المستقيم الرأسي x = ${a}. ما إحداثيات صورتها؟`.replace(`x = ${a}`, `x = ${a}`), en: `Reflect the point ${pt(x, y)} in the vertical line x = ${a}. What are the coordinates of the image?` };
});

const translate = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const m = span(diff, 5, 8, 10);
  const x = int(rng, grade === 5 ? 1 : -6, 8), y = int(rng, grade === 5 ? 1 : -6, 8);
  const dx = grade === 5 ? int(rng, 1, m) : (rng() < 0.5 ? -1 : 1) * int(rng, 1, m), dy = grade === 5 ? int(rng, 1, m) : (rng() < 0.5 ? -1 : 1) * int(rng, 1, m);
  const hDir = dx >= 0 ? 'اليمين' : 'اليسار', vDir = dy >= 0 ? 'الأعلى' : 'الأسفل';
  const hDirEn = dx >= 0 ? 'right' : 'left', vDirEn = dy >= 0 ? 'up' : 'down';
  const ans: [number, number] = [x + dx, y + dy];
  // 0 the image; 1 the point before the translation, from its image; 2 the translation itself, from a point and its image.
  const k = pick(rng, [0, 1, 2]);
  if (k === 1) return { eq: `pre ${pt(...ans)}, ${dx}, ${dy}`, answer: pt(x, y), wrongs: ptOpts([x, y], ([[ans[0] + dx, ans[1] + dy], [ans[0] - dy, ans[1] - dx], [x, ans[1]], [ans[0], y]] as Array<[number, number]>).filter(c => grade !== 5 || (c[0] > 0 && c[1] > 0))), ar: `بعد انسحاب ${unitAr(Math.abs(dx))} إلى ${hDir} و ${unitAr(Math.abs(dy))} إلى ${vDir} وصلت النقطة A إلى الموقع ${pt(...ans)}. أين كانت النقطة A قبل الانسحاب؟`, en: `After a translation of ${unitEn(Math.abs(dx))} ${hDirEn} and ${unitEn(Math.abs(dy))} ${vDirEn}, point A is at ${pt(...ans)}. Where was A before the translation?` };
  if (k === 2) {
    const say = (h: number, v: number) => `${unitAr(Math.abs(h))} إلى ${h >= 0 ? 'اليمين' : 'اليسار'} و ${unitAr(Math.abs(v))} إلى ${v >= 0 ? 'الأعلى' : 'الأسفل'}`;
    return { eq: `move ${pt(x, y)}, ${pt(...ans)}`, answer: say(dx, dy), wrongs: wrongsFrom(say(dx, dy), [say(-dx, -dy), say(dy, dx), say(-dx, dy), say(dx, -dy)], j => say(dx + Math.sign(dx) * Math.abs(j), dy)), ar: `انسحبت النقطة ${pt(x, y)} فكانت صورتها ${pt(...ans)}. بكم وحدة انسحبت أفقيًا ورأسيًا، وفي أي اتجاه؟`, en: `The point ${pt(x, y)} was translated to ${pt(...ans)}. By how many units did it move across and up or down, and in which directions?` };
  }
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, ([[x - dx, y - dy], [x + dy, y + dx], [x + dx, y], [x, y + dy], [x - dx, y + dy]] as Array<[number, number]>).filter(c => grade !== 5 || (c[0] > 0 && c[1] > 0))), ar: `انسحبت النقطة ${pt(x, y)} بمقدار ${unitAr(Math.abs(dx))} إلى ${hDir} و ${unitAr(Math.abs(dy))} إلى ${vDir}. ما إحداثيات صورتها؟`, en: `The point ${pt(x, y)} is translated ${unitEn(Math.abs(dx))} ${hDirEn} and ${unitEn(Math.abs(dy))} ${vDirEn}. What are the coordinates of its image?` };
});

const reflectAxes = T('reflect_axes', /^الانعكاس في المستوي الاحداثي$/, [6, 6], ({ rng }) => {
  const x = (rng() < 0.5 ? -1 : 1) * int(rng, 1, 9), y = (rng() < 0.5 ? -1 : 1) * int(rng, 1, 9);
  const axis = pick(rng, [0, 1]);
  const ans: [number, number] = axis === 0 ? [x, -y] : [-x, y];
  // 0 the image, 1 the original point from its image, 2 the distance between a point and its image.
  const k = pick(rng, [0, 1, 2]);
  const axAr = axis === 0 ? 'السيني (x)' : 'الصادي (y)', axEn = axis === 0 ? 'x-axis' : 'y-axis';
  if (k === 1) return { eq: `pre ${pt(...ans)}`, answer: pt(x, y), wrongs: ptOpts([x, y], [ans, [-x, -y], [y, x], axis === 0 ? [-x, y] : [x, -y]]), ar: `صورة النقطة A بالانعكاس حول المحور ${axAr} هي ${pt(...ans)}. ما إحداثيات النقطة A؟`, en: `The image of point A after a reflection in the ${axEn} is ${pt(...ans)}. What are the coordinates of A?` };
  if (k === 2) {
    const d = 2 * Math.abs(axis === 0 ? y : x);
    return { eq: `dist ${pt(x, y)}`, answer: String(d), wrongs: pos(d, [d / 2, 2 * Math.abs(axis === 0 ? x : y), Math.abs(x) + Math.abs(y), d + 2]), ar: `ما المسافة بالوحدات بين النقطة ${pt(x, y)} وصورتها بالانعكاس حول المحور ${axAr}؟`, en: `What is the distance, in units, between ${pt(x, y)} and its image after a reflection in the ${axEn}?` };
  }
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [axis === 0 ? [-x, y] : [x, -y], [-x, -y], [y, x], [x, y]]), ar: `انعكاس النقطة ${pt(x, y)} حول المحور ${axis === 0 ? 'السيني (x)' : 'الصادي (y)'}. ما إحداثيات صورتها؟`, en: `Reflect the point ${pt(x, y)} in the ${axis === 0 ? 'x-axis' : 'y-axis'}. What are the coordinates of the image?` };
});

const QUADRANTS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
const coordPlane6 = T('coord_plane_g6', /^المستوي الاحداثي$/, [6, 6], ({ rng }) => {
  // 0 the quadrant of a point, 1 the point reached by moves from the origin, 2 a distance along a grid line across an axis.
  const k = pick(rng, [0, 1, 2]);
  if (k === 1) {
    const dx = int(rng, 3, 9), dy = int(rng, 3, 9), sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1;
    const ans: [number, number] = [sx * dx, sy * dy];
    return { eq: `walk ${pt(...ans)}`, answer: pt(...ans), wrongs: ptOpts(ans, [[sy * dy, sx * dx], [-sx * dx, sy * dy], [sx * dx, -sy * dy], [-sx * dx, -sy * dy]]), ar: `انطلقت نملة من نقطة الأصل، فتحرّكت ${dx} وحدات إلى ${sx > 0 ? 'اليمين' : 'اليسار'} ثم ${dy} وحدات إلى ${sy > 0 ? 'الأعلى' : 'الأسفل'}. ما إحداثيات النقطة التي وصلت إليها؟`, en: `An ant starts at the origin and moves ${unitEn(dx)} ${sx > 0 ? 'right' : 'left'}, then ${unitEn(dy)} ${sy > 0 ? 'up' : 'down'}. What are the coordinates of the point it reaches?` };
  }
  if (k === 2) {
    const a = -int(rng, 1, 9), b = int(rng, 1, 9), c = (rng() < 0.5 ? -1 : 1) * int(rng, 1, 9), vert = rng() < 0.5;
    const P: [number, number] = vert ? [c, a] : [a, c], Q: [number, number] = vert ? [c, b] : [b, c];
    const d = b - a;
    return { eq: `dist ${pt(...P)}, ${pt(...Q)}`, answer: String(d), wrongs: pos(d, [Math.abs(b + a), b, -a, d + 1, 2 * d]), ar: `ما المسافة بالوحدات بين النقطتين ${pt(...P)} و ${pt(...Q)}؟`, en: `What is the distance, in units, between the points ${pt(...P)} and ${pt(...Q)}?` };
  }
  const q = pick(rng, [0, 1, 2, 3]);
  const x = (q === 0 || q === 3 ? 1 : -1) * int(rng, 1, 9), y = (q === 0 || q === 1 ? 1 : -1) * int(rng, 1, 9);
  return { eq: pt(x, y), answer: QUADRANTS[q]!, wrongs: QUADRANTS.filter((_, i) => i !== q), ar: `في أي ربع من المستوى الإحداثي تقع النقطة ${pt(x, y)}؟`, en: `In which quadrant of the coordinate plane is the point ${pt(x, y)}?` };
});
const coordPlane5 = T('coord_plane_g5', /^المستوي الاحداثي$/, [5, 5], ({ rng, diff }) => {
  const x = int(rng, 1, 9), y = int(rng, 1, 9);
  // 0–1 read a coordinate, 2 a distance along a grid line; 3 plot a point from moves, 4 a rectangle's fourth vertex.
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 0) return { eq: pt(x, y), answer: String(x), wrongs: pos(x, [y, x + 1, x * y, x + y]), ar: `ما الإحداثي السيني للنقطة (${x} ، ${y})؟`, en: `What is the x-coordinate of the point (${x}, ${y})?` };
  if (k === 1) return { eq: pt(x, y), answer: String(y), wrongs: pos(y, [x, y + 1, x * y, x + y]), ar: `ما الإحداثي الصادي للنقطة (${x} ، ${y})؟`, en: `What is the y-coordinate of the point (${x}, ${y})?` };
  if (k === 3) {
    const dx = int(rng, 1, 9), dy = int(rng, 1, 9), ans: [number, number] = [dx, dy];
    return { eq: `walk ${pt(dx, dy)}`, answer: pt(...ans), wrongs: ptOpts(ans, [[dy, dx], [dx, 0], [0, dy], [dx + dy, dy], [dx, dx + dy]]), ar: `انطلق سامر من نقطة الأصل، فتحرّك ${unitAr(dx)} إلى اليمين ثم ${unitAr(dy)} إلى الأعلى. ما إحداثيات النقطة التي وصل إليها؟`, en: `Samer starts at the origin and moves ${unitEn(dx)} right, then ${unitEn(dy)} up. What are the coordinates of the point he reaches?` };
  }
  if (k === 4) {
    const x1 = int(rng, 1, 5), x2 = x1 + int(rng, 2, 4), y1 = int(rng, 1, 5), y2 = y1 + int(rng, 2, 4);
    const corners: Array<[number, number]> = [[x1, y1], [x2, y1], [x2, y2], [x1, y2]];
    const miss = int(rng, 0, 3), given = [1, 2, 3].map(i => corners[(miss + i) % 4]!), ans = corners[miss]!;
    const [xo, yo] = corners[(miss + 2) % 4]!;
    return { eq: `rect ${given.map(c => pt(...c)).join(', ')}`, answer: pt(...ans), wrongs: ptOpts(ans, [[ans[1], ans[0]], [xo, yo], [ans[0] + (x2 - x1), ans[1] + (y2 - y1)], [ans[0], yo + (y2 - y1)]].filter(c => c[0] > 0 && c[1] > 0) as Array<[number, number]>), ar: `النقاط ${given.map(c => pt(...c)).join(' و ')} ثلاثة رؤوس لمستطيل. ما إحداثيات الرأس الرابع؟`, en: `The points ${given.map(c => pt(...c)).join(', ')} are three vertices of a rectangle. What are the coordinates of the fourth vertex?` };
  }
  const y2 = y + int(rng, 1, span(diff, 5, 7, 9));
  return { eq: `${pt(x, y)}, ${pt(x, y2)}`, answer: String(y2 - y), wrongs: pos(y2 - y, [y2 + y, y2, y + 1, y2 - y + 1]), ar: `ما المسافة بين النقطتين (${x} ، ${y}) و (${x} ، ${y2}) بالوحدات؟`, en: `What is the distance, in units, between the points (${x}, ${y}) and (${x}, ${y2})?` };
});

const rotate = T('rotate', /^الدوران$/, [7, 7], ({ rng }) => {
  const x = int(rng, -8, 8) || 3, y = int(rng, -8, 8) || -4;
  const k = pick(rng, [0, 1, 2]);
  const [ans, ar, en]: [[number, number], string, string] = k === 0 ? [[-y, x], '90° عكس اتجاه عقارب الساعة', '90° counterclockwise'] : k === 1 ? [[y, -x], '90° باتجاه عقارب الساعة', '90° clockwise'] : [[-x, -y], '180°', '180°'];
  // 0 the image; 1 the point before the rotation, from its image; 2 the order of a regular polygon's rotational symmetry, 3 the smallest angle that maps it onto itself.
  const ask = pick(rng, [0, 1, 2, 3]);
  if (ask === 1) {
    const back: Array<[number, number]> = [[ans[0], ans[1]], [-ans[1], ans[0]], [ans[1], -ans[0]], [-ans[0], -ans[1]], [y, x], [-x, y]];
    return { eq: `pre ${pt(...ans)}, ${k}`, answer: pt(x, y), wrongs: ptOpts([x, y], back.filter(c => c[0] !== x || c[1] !== y)), ar: `بعد دوران بزاوية ${ar} حول نقطة الأصل أصبحت النقطة B في الموقع ${pt(...ans)}. أين كانت النقطة B قبل الدوران؟`, en: `After a rotation of ${en} about the origin, point B is at ${pt(...ans)}. Where was B before the rotation?` };
  }
  if (ask === 2 || ask === 3) {
    const n = pick(rng, [3, 4, 5, 6, 8, 9, 10, 12]);
    if (ask === 2) return { eq: `order ${n}`, answer: String(n), wrongs: pos(n, [n - 1, n + 1, 2 * n, n / 2, 360 / n]), ar: `مضلع منتظم عدد أضلاعه ${n}. ما رتبة تماثله الدوراني؟`, en: `A regular polygon has ${n} sides. What is the order of its rotational symmetry?` };
    return { eq: `turn ${n}`, answer: `${360 / n}°`, wrongs: deg(360 / n, [180 / n, 360 / (n - 1), 360 / (n + 1), ((n - 2) * 180) / n, 360 - 360 / n]), ar: `ما أصغر زاوية يُدار بها مضلع منتظم عدد أضلاعه ${n} حول مركزه لينطبق على نفسه؟`, en: `What is the smallest angle a regular polygon with ${n} sides can be turned about its centre to land on itself?` };
  }
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[-x, -y], [x, -y], [-x, y], [y, x], [-y, -x], [y, -x], [-y, x]].filter(c => c[0] !== ans[0] || c[1] !== ans[1]) as Array<[number, number]>), ar: `دُوِّرت النقطة ${pt(x, y)} حول نقطة الأصل بزاوية ${ar}. ما إحداثيات صورتها؟`, en: `The point ${pt(x, y)} is rotated ${en} about the origin. What are the coordinates of its image?` };
});

const dilate = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const k = pick(rng, grade === 8 && diff !== 'easy' ? [2, 3, 0.5, 4] : [2, 3, 4]);
  const x0 = int(rng, -5, 6) || 2, y0 = int(rng, -5, 6) || 3;
  const [x, y] = k === 0.5 ? [2 * x0, 2 * y0] : [x0, y0];
  const ans: [number, number] = [x * k, y * k];
  const ks = k === 0.5 ? '1/2' : String(k);
  const noun = grade === 7 ? 'تكبير' : 'تمدد';
  // 0 the image, 1 the scale factor from a point and its image, 2 the original point, 3 an enlarged photo (real life), 4 (Grade 8) a negative factor.
  const kind = pick(rng, grade === 8 ? [0, 1, 2, 3, 4] : [0, 1, 2, 3]);
  if (kind === 1) return { eq: `factor ${pt(x, y)}, ${pt(...ans)}`, answer: ks, wrongs: wrongsFrom(ks, k === 0.5 ? ['2', '1/4', '1'] : [`1/${k}`, String(k + 1), String(k * k), String(k - 1)], j => String((k === 0.5 ? 2 : k) + 1 + Math.abs(j))), ar: `النقطة ${pt(...ans)} هي صورة النقطة ${pt(x, y)} تحت تأثير ${noun} مركزه نقطة الأصل. ما معامل ال${noun}؟`, en: `The point ${pt(...ans)} is the image of ${pt(x, y)} under a dilation centred at the origin. What is the scale factor?` };
  if (kind === 2) return { eq: `pre ${pt(...ans)}, ${ks}`, answer: pt(x, y), wrongs: ptOpts([x, y], ([[ans[0] * k, ans[1] * k], [ans[0] - k, ans[1] - k], ans, [-x, -y], [y, x]] as Array<[number, number]>).filter(isIntPt)), ar: `النقطة ${pt(...ans)} هي صورة نقطة تحت تأثير ${noun} مركزه نقطة الأصل ومعامله ${ks}. ما إحداثيات النقطة الأصلية؟`, en: `The point ${pt(...ans)} is the image of a point under a dilation centred at the origin with scale factor ${ks}. What are the coordinates of the original point?` };
  if (kind === 3) {
    const kk = k === 0.5 ? 2 : k, a = int(rng, 2, 9), b = int(rng, 2, 9), P = 2 * (a + b) * kk;
    return { eq: `photo ${a}, ${b}, ${kk}`, answer: String(P), wrongs: pos(P, [2 * (a + b), (a + b) * kk, 2 * (a + b) + kk, a * b * kk, P * kk]), ar: `صورة فوتوغرافية مستطيلة الشكل بُعداها ${a} سم و ${b} سم، كُبِّرت بمعامل ${noun} ${kk}. ما محيط الصورة بعد التكبير؟`, en: `A rectangular photo measures ${a} cm by ${b} cm and is enlarged by scale factor ${kk}. What is the perimeter of the enlarged photo?` };
  }
  if (kind === 4) {
    const kn = -pick(rng, [2, 3]), img: [number, number] = [kn * x0, kn * y0];
    return { eq: `neg ${pt(x0, y0)}, ${kn}`, answer: pt(...img), wrongs: ptOpts(img, [[-kn * x0, -kn * y0], [-x0, -y0], [kn * x0, y0], [x0 + kn, y0 + kn]]), ar: `ما صورة النقطة ${pt(x0, y0)} تحت تأثير تمدد مركزه نقطة الأصل ومعامله ${signed(kn)}؟`, en: `What is the image of ${pt(x0, y0)} under a dilation centred at the origin with scale factor ${signed(kn)}?` };
  }
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[x + k, y + k], [x * k, y], [x, y * k], [x / k, y / k], [-x * k, -y * k]].filter(c => Number.isInteger(c[0]) && Number.isInteger(c[1]) && (c[0] !== ans[0] || c[1] !== ans[1])) as Array<[number, number]>), ar: `كُبِّرت النقطة ${pt(x, y)} بمعامل تمدد ${ks} ومركز التمدد نقطة الأصل. ما إحداثيات صورتها؟`.replace('كُبِّرت', k < 1 ? 'تمددت' : 'كُبِّرت'), en: `The point ${pt(x, y)} is dilated by scale factor ${ks} from the origin. What are the coordinates of its image?` };
});

// ─── Grade 9: coordinates, proportional parts, trigonometry ─────────────────

const distance = T('distance_plane', /^المسافه في المستوي الاحداثي$/, [9, 9], ({ rng, diff }) => {
  const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]];
  const [a, b, c] = pick(rng, TRIPLES);
  const x1 = int(rng, -5, 5), y1 = int(rng, -5, 5);
  // 0 distance in the plane; 1 distance on the number line; midpoints: 2 in the plane, 3 on the number line, 4 an endpoint from the midpoint.
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 1 || kind === 3) {
    let u = 0, v = 0;
    do { u = int(rng, -9, 9); v = int(rng, -9, 9); } while (u === v || (kind === 3 && ((u + v) % 2 !== 0 || u + v === 0)));
    if (kind === 1) {
      const d = Math.abs(u - v);
      return { eq: `line ${u}, ${v}`, answer: String(d), wrongs: pos(d, [Math.abs(u + v), Math.abs(u) + Math.abs(v), d + 1, Math.abs(v), Math.abs(u)]), ar: `على خط الأعداد، تمثل النقطة A العدد ${signed(u)} وتمثل النقطة B العدد ${signed(v)}. ما المسافة بين النقطتين A و B؟`, en: `On the number line, point A is at ${signed(u)} and point B is at ${signed(v)}. What is the distance between A and B?` };
    }
    const m = (u + v) / 2;
    return { eq: `mid ${u}, ${v}`, answer: signed(m), wrongs: sgn(m, [u + v, (v - u) / 2, (u - v) / 2, -m, m + 1]), ar: `على خط الأعداد، ما العدد الذي يمثل نقطة منتصف القطعة المستقيمة الواصلة بين العددين ${signed(u)} و ${signed(v)}؟`, en: `On the number line, what number is the midpoint of the segment joining ${signed(u)} and ${signed(v)}?` };
  }
  if (kind === 2) {
    const x2 = x1 + 2 * int(rng, 1, 5) * (rng() < 0.5 ? 1 : -1), y2 = y1 + 2 * int(rng, 1, 5) * (rng() < 0.5 ? 1 : -1);
    const M: [number, number] = [(x1 + x2) / 2, (y1 + y2) / 2];
    return { eq: `mid ${pt(x1, y1)}, ${pt(x2, y2)}`, answer: pt(...M), wrongs: ptOpts(M, [[x1 + x2, y1 + y2], [(x2 - x1) / 2, (y2 - y1) / 2], [M[1], M[0]], [M[0], -M[1]]]), ar: `ما إحداثيا نقطة منتصف القطعة المستقيمة الواصلة بين النقطتين ${pt(x1, y1)} و ${pt(x2, y2)}؟`, en: `What are the coordinates of the midpoint of the segment joining ${pt(x1, y1)} and ${pt(x2, y2)}?` };
  }
  if (kind === 4) {
    const M: [number, number] = [int(rng, -4, 4), int(rng, -4, 4)], A: [number, number] = [M[0] + nz(rng, 5), M[1] + nz(rng, 5)];
    const B: [number, number] = [2 * M[0] - A[0], 2 * M[1] - A[1]];
    return { eq: `end ${pt(...M)}, ${pt(...A)}`, answer: pt(...B), wrongs: ptOpts(B, ([[(M[0] + A[0]) / 2, (M[1] + A[1]) / 2], [M[0] - A[0], M[1] - A[1]], [2 * A[0] - M[0], 2 * A[1] - M[1]], [M[0] + A[0], M[1] + A[1]]] as Array<[number, number]>).filter(isIntPt)), ar: `النقطة M${pt(...M)} منتصف القطعة المستقيمة AB، والنقطة A هي ${pt(...A)}. ما إحداثيات النقطة B؟`, en: `M${pt(...M)} is the midpoint of segment AB and A is ${pt(...A)}. What are the coordinates of B?` };
  }
  const sx = rng() < 0.5 ? 1 : -1, sy = rng() < 0.5 ? 1 : -1;
  const x2 = x1 + sx * a, y2 = y1 + sy * b;
  if (diff === 'hard' && rng() < 0.5) {
    const p = pick(rng, [1, 2, 3, 4]), q = pick(rng, [1, 2, 3, 5, 6]);
    const s = p * p + q * q;
    if (Number.isInteger(Math.sqrt(s)) || p === q || [4, 9, 25].some(sq => s % sq === 0)) return distance.make({ rng, diff, grade: 9 });
    return { eq: `${pt(x1, y1)}, ${pt(x1 + p, y1 + q)}`, answer: `√${s}`, wrongs: wrongsFrom(`√${s}`, [`${p + q}`, `√${p + q}`, `${s}`, `√${s + 1}`], j => `√${s + Math.abs(j) + 1}`), ar: `ما المسافة بين النقطتين ${pt(x1, y1)} و ${pt(x1 + p, y1 + q)}؟`, en: `What is the distance between ${pt(x1, y1)} and ${pt(x1 + p, y1 + q)}?` };
  }
  return { eq: `${pt(x1, y1)}, ${pt(x2, y2)}`, answer: String(c), wrongs: pos(c, [a + b, a * b, c + 1, Math.abs(a - b)]), ar: `ما المسافة بين النقطتين ${pt(x1, y1)} و ${pt(x2, y2)}؟`, en: `What is the distance between ${pt(x1, y1)} and ${pt(x2, y2)}?` };
});

const pointLine = T('distance_point_line', /^البعد بين نقطه ومستقيم$/, [9, 9], ({ rng, diff }) => {
  const x0 = int(rng, -6, 8), y0 = int(rng, -6, 8);
  // 0 a point and a line; 1 two parallel lines; 2 the origin and a line; 3 a triangle's area, its height being a point's distance from the line its base lies on.
  const kind = pick(rng, [0, 1, 2, 3]);
  if (kind !== 0) {
    const [A, B, N] = pick(rng, [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13]] as Array<[number, number, number]>);
    const lineOf = (C: number) => (C === 0 ? `${A}x + ${B}y = 0` : `${A}x + ${B}y ${C < 0 ? '−' : '+'} ${Math.abs(C)} = 0`);
    const d = int(rng, 1, 5);
    if (kind === 1) {
      if (diff === 'easy') {
        const c1 = int(rng, -8, 8), c2 = c1 + nz(rng, 9), dd = Math.abs(c1 - c2);
        return { eq: `par y ${c1}, ${c2}`, answer: String(dd), wrongs: pos(dd, [Math.abs(c1 + c2), Math.abs(c1) + Math.abs(c2), dd + 1, dd * 2]), ar: `ما البعد بين المستقيمين المتوازيين y = ${signed(c1)} و y = ${signed(c2)}؟`, en: `What is the distance between the parallel lines y = ${signed(c1)} and y = ${signed(c2)}?` };
      }
      const C1 = int(rng, -20, 20), C2 = C1 + d * N * (rng() < 0.5 ? 1 : -1);
      return { eq: `par ${A}, ${B}, ${C1}, ${C2}`, answer: String(d), wrongs: pos(d, [d * N, Math.abs(C1) + Math.abs(C2), (d * N) / (A + B) | 0, d + 1, (d * N) / 2 | 0]), ar: `ما البعد بين المستقيمين المتوازيين ${lineOf(C1)} و ${lineOf(C2)}؟`, en: `What is the distance between the parallel lines ${lineOf(C1)} and ${lineOf(C2)}?` };
    }
    if (kind === 2) {
      const C = d * N * (rng() < 0.5 ? 1 : -1);
      return { eq: `origin ${A}, ${B}, ${C}`, answer: String(d), wrongs: pos(d, [d * N, Math.abs(C) / (A + B) | 0, d + 1, d * N - d, (d * N) / 2 | 0]), ar: `ما بُعد نقطة الأصل عن المستقيم ${lineOf(C)}؟`, en: `What is the distance from the origin to the line ${lineOf(C)}?` };
    }
    const C = d * N * (rng() < 0.5 ? 1 : -1) - A * x0 - B * y0, base = 2 * int(rng, 2, 5), S = (base * d) / 2;
    return { eq: `tri ${pt(x0, y0)}, ${A}, ${B}, ${C}, ${base}`, answer: String(S), wrongs: pos(S, [base * d, base + d, S + base, d * N, (base * d * N) / 2]), ar: `في المثلث ABC، يقع الضلع BC على المستقيم ${lineOf(C)} وطوله ${base} وحدات، والرأس A هو النقطة ${pt(x0, y0)}. ما مساحة المثلث بالوحدات المربعة؟`, en: `In triangle ABC, side BC lies on the line ${lineOf(C)} and is ${base} units long, and vertex A is ${pt(x0, y0)}. What is the area of the triangle in square units?` };
  }
  if (diff === 'easy' || rng() < 0.4) {
    const c = int(rng, -8, 10);
    if (rng() < 0.5) { const d = Math.abs(y0 - c); if (d === 0) return pointLine.make({ rng, diff, grade: 9 }); return { eq: `${pt(x0, y0)}, y = ${signed(c)}`, answer: String(d), wrongs: pos(d, [Math.abs(x0 - c), d + 1, Math.abs(y0 + c), Math.abs(x0) + Math.abs(y0)]), ar: `ما بُعد النقطة ${pt(x0, y0)} عن المستقيم y = ${signed(c)}؟`, en: `What is the distance from the point ${pt(x0, y0)} to the line y = ${signed(c)}?` }; }
    const d = Math.abs(x0 - c); if (d === 0) return pointLine.make({ rng, diff, grade: 9 });
    return { eq: `${pt(x0, y0)}, x = ${signed(c)}`, answer: String(d), wrongs: pos(d, [Math.abs(y0 - c), d + 1, Math.abs(x0 + c), Math.abs(x0) + Math.abs(y0)]), ar: `ما بُعد النقطة ${pt(x0, y0)} عن المستقيم x = ${signed(c)}؟`, en: `What is the distance from the point ${pt(x0, y0)} to the line x = ${signed(c)}?` };
  }
  // 3x + 4y + C = 0 (or 5x + 12y …): the distance |Ax0 + By0 + C| / √(A²+B²) is whole when the numerator is a multiple of √ = 5 or 13
  const [A, B, N] = pick(rng, [[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13]] as Array<[number, number, number]>);
  const d = int(rng, 1, 6);
  const num = d * N * (rng() < 0.5 ? 1 : -1);
  const C = num - A * x0 - B * y0; // so that Ax0 + By0 + C = num
  const line = C === 0 ? `${A}x + ${B}y = 0` : `${A}x + ${B}y ${C < 0 ? '−' : '+'} ${Math.abs(C)} = 0`;
  return { eq: `${pt(x0, y0)}, ${line}`, answer: String(d), wrongs: pos(d, [d * N, d + 1, Math.abs(num) / (A + B) | 0, d * N / 2 | 0, d - 1]), ar: `ما بُعد النقطة ${pt(x0, y0)} عن المستقيم ${line}؟`, en: `What is the distance from the point ${pt(x0, y0)} to the line ${line}?` };
});

const proportionalParts = T('proportional_parts', /^الاجزاء المتناسبه في المثلثات$/, [9, 9], ({ rng, diff }) => {
  const a = int(rng, 2, 8), k = int(rng, 2, 4), c = int(rng, 2, span(diff, 6, 9, 12));
  const b = a * k, e = c * k;
  // 0 EC, 1 AE; 2 DE from BC, 3 the midsegment, 4 three parallel lines cut by two transversals.
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 2) {
    const db = int(rng, 2, 9), t = int(rng, 2, span(diff, 4, 6, 8)), BC = (a + db) * t;
    return { eq: `DE ${a}, ${db}, ${BC}`, answer: String(a * t), wrongs: pos(a * t, [db * t, BC - a, (BC * a) / db, a * t + t, BC - db]), ar: `في المثلث ABC، النقطة D على AB والنقطة E على AC وDE ∥ BC. إذا كان AD = ${a} سم و DB = ${db} سم و BC = ${BC} سم، فما طول DE؟`, en: `In triangle ABC, D lies on AB and E on AC with DE ∥ BC. If AD = ${a} cm, DB = ${db} cm and BC = ${BC} cm, what is DE?` };
  }
  if (kind === 3) {
    const BC = 2 * int(rng, 3, span(diff, 8, 12, 16));
    return { eq: `mid ${BC}`, answer: String(BC / 2), wrongs: pos(BC / 2, [BC, 2 * BC, BC / 2 + 2, BC - 2]), ar: `في المثلث ABC، النقطتان D و E منتصفا الضلعين AB و AC على الترتيب، وطول BC يساوي ${BC} سم. ما طول DE؟`, en: `In triangle ABC, D and E are the midpoints of AB and AC, and BC = ${BC} cm. How long is DE?` };
  }
  if (kind === 4) {
    const s1 = int(rng, 2, 8);
    let s2 = int(rng, 2, 9);
    if (s2 === s1) s2 += 1;
    const u1 = s1 * k, u2 = s2 * k;
    return { eq: `lines ${s1}, ${s2}, ${u1}`, answer: String(u2), wrongs: pos(u2, [u1 + s2 - s1, s2, s1 * s2, u2 + 1, u1]), ar: `ثلاثة مستقيمات متوازية يقطعها قاطعان، فتقسم القاطع الأول إلى قطعتين طولاهما ${s1} سم و ${s2} سم، وتقسم القاطع الثاني إلى قطعتين طول الأولى منهما ${u1} سم. ما طول القطعة الثانية؟`, en: `Three parallel lines cut two transversals. On the first they cut segments of ${s1} cm and ${s2} cm; on the second the first segment is ${u1} cm. How long is the second segment?` };
  }
  if (kind === 0) return { eq: `${a}, ${b}, ${c}`, answer: String(c * k), wrongs: pos(c * k, [a + b + c, b + c - a, c + k, (a * c) / b | 0, a * b]), ar: `في المثلث ABC، النقطة D على AB والنقطة E على AC وDE ∥ BC. إذا كان AD = ${a} سم و DB = ${b} سم و AE = ${c} سم، فما طول EC؟`, en: `In triangle ABC, D lies on AB and E on AC with DE ∥ BC. If AD = ${a} cm, DB = ${b} cm and AE = ${c} cm, what is EC?` };
  return { eq: `${a}, ${b}, ${e}`, answer: String(c), wrongs: pos(c, [e - 1, e + 1, a + b, (a * b) / e | 0, e - a]), ar: `في المثلث ABC، النقطة D على AB والنقطة E على AC وDE ∥ BC. إذا كان AD = ${a} سم و DB = ${b} سم و EC = ${e} سم، فما طول AE؟`, en: `In triangle ABC, D lies on AB and E on AC with DE ∥ BC. If AD = ${a} cm, DB = ${b} cm and EC = ${e} cm, what is AE?` };
});

const bisector = T('angle_bisector_thm', /^منصفات في المثلث$/, [9, 9], ({ rng, diff }) => {
  const a = int(rng, 2, 7), k = int(rng, 2, 4), bd = int(rng, 2, span(diff, 6, 9, 12));
  const b = a * k, dc = bd * k;
  // 0 the angle bisector theorem; 1 a point on a perpendicular bisector, 2 a point on an angle bisector (both equidistant); 3 the incentre's distance from a side.
  const kind = pick(rng, [0, 1, 2, 3]);
  if (kind === 1 || kind === 2) {
    const x = int(rng, 2, span(diff, 8, 12, 15)), p = int(rng, 2, 5), q = int(rng, 1, p - 1), c1 = int(rng, 1, 12), c2 = c1 + (p - q) * x;
    const wr = pos(x, [x + 2, x - 2, c2 - c1, (c1 + c2) / (p + q) | 0, p * x + c1]);
    if (kind === 1) return { eq: `perp ${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: wr, ar: `النقطة P تقع على المنصِّف العمودي للقطعة المستقيمة AB. إذا كان PA = ${lin(p, c1)} و PB = ${lin(q, c2)}، فما قيمة x؟`, en: `Point P lies on the perpendicular bisector of segment AB. If PA = ${lin(p, c1)} and PB = ${lin(q, c2)}, what is x?` };
    return { eq: `bis ${p}, ${c1}, ${q}, ${c2}`, answer: String(x), wrongs: wr, ar: `النقطة P تقع على منصِّف الزاوية ABC، وبُعدها عن الضلع BA يساوي ${lin(p, c1)}، وبُعدها عن الضلع BC يساوي ${lin(q, c2)}. ما قيمة x؟`, en: `Point P lies on the bisector of angle ABC. Its distance from side BA is ${lin(p, c1)} and from side BC is ${lin(q, c2)}. What is x?` };
  }
  if (kind === 3) {
    const [r, f, h] = pick(rng, [[3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13], [8, 15, 17]] as Array<[number, number, number]>);
    return { eq: `in ${h}, ${f}`, answer: String(r), wrongs: pos(r, [h - f, f, h, r + 1, h + f]), ar: `النقطة I ملتقى منصِّفات زوايا المثلث ABC، والنقطة F على الضلع AB بحيث IF ⊥ AB. إذا كان IA = ${h} سم و AF = ${f} سم، فما بُعد النقطة I عن الضلع BC؟`, en: `I is the point where the angle bisectors of triangle ABC meet, and F is on AB with IF ⊥ AB. If IA = ${h} cm and AF = ${f} cm, how far is I from side BC?` };
  }
  return { eq: `${a}, ${b}, ${bd}`, answer: String(dc), wrongs: pos(dc, [bd + (b - a), a + b + bd, (a * bd) / b | 0, dc + 1]), ar: `في المثلث ABC، AD منصف للزاوية A ويقطع BC في D. إذا كان AB = ${a} سم و AC = ${b} سم و BD = ${bd} سم، فما طول DC؟`, en: `In triangle ABC, AD bisects angle A and meets BC at D. If AB = ${a} cm, AC = ${b} cm and BD = ${bd} cm, what is DC?` };
});

const medians = T('medians_centroid', /^القطع المتوسطه والارتفاعات في المثلث$/, [9, 9], ({ rng }) => {
  // 0 AG, 1 GD from the median; 2 the median from AG; 3 the centroid's coordinates; 4 the orthocentre's coordinates.
  const kind = pick(rng, [0, 1, 2, 3, 4]);
  if (kind === 2) {
    const ag = 2 * int(rng, 2, 12), ad = (3 * ag) / 2;
    return { eq: `AD ${ag}`, answer: String(ad), wrongs: pos(ad, [2 * ag, ag / 2, 3 * ag, ag + 2, ag]), ar: `في المثلث ABC، AD قطعة متوسطة، و G مركز المثلث. إذا كان AG = ${ag} سم، فما طول AD؟`, en: `In triangle ABC, AD is a median and G is the centroid. If AG = ${ag} cm, how long is AD?` };
  }
  if (kind === 3) {
    let A: [number, number] = [0, 0], B: [number, number] = [0, 0], C: [number, number] = [0, 0], G: [number, number] = [0, 0];
    do {
      G = [int(rng, -3, 4), int(rng, -3, 4)]; A = [int(rng, -6, 6), int(rng, -6, 6)]; B = [int(rng, -6, 6), int(rng, -6, 6)];
      C = [3 * G[0] - A[0] - B[0], 3 * G[1] - A[1] - B[1]];
    } while ((B[0] - A[0]) * (C[1] - A[1]) - (B[1] - A[1]) * (C[0] - A[0]) === 0 || Math.abs(C[0]) > 9 || Math.abs(C[1]) > 9);
    const S: [number, number] = [A[0] + B[0] + C[0], A[1] + B[1] + C[1]];
    return { eq: `G ${pt(...A)}, ${pt(...B)}, ${pt(...C)}`, answer: pt(...G), wrongs: ptOpts(G, ([S, [S[0] / 2, S[1] / 2], [G[1], G[0]], [G[0], -G[1]]] as Array<[number, number]>).filter(isIntPt)), ar: `ما إحداثيات مركز المثلث الذي رؤوسه A${pt(...A)} و B${pt(...B)} و C${pt(...C)}؟`, en: `What are the coordinates of the centroid of the triangle with vertices A${pt(...A)}, B${pt(...B)} and C${pt(...C)}?` };
  }
  if (kind === 4) {
    // BC is horizontal (y = c), so the altitude from A is the vertical line x = p; it meets the altitude from B where (H − B)·(C − A) = 0.
    for (let i = 0; i < 60; i++) {
      const c = int(rng, -3, 3), q = c + nz(rng, 6), b = int(rng, -6, 0), e = int(rng, 1, 7), p = int(rng, -5, 7);
      const num = (p - b) * (e - p);
      if (num % (c - q) !== 0) continue;
      const y = c - num / (c - q) || 0;
      if (Math.abs(y) > 12) continue;
      const A: [number, number] = [p, q], B: [number, number] = [b, c], C: [number, number] = [e, c], H: [number, number] = [p, y];
      const G: [number, number] = [(p + b + e) / 3, (q + 2 * c) / 3];
      return { eq: `H ${pt(...A)}, ${pt(...B)}, ${pt(...C)}`, answer: pt(...H), wrongs: ptOpts(H, ([G, A, [p, c], [y, p], [p, -y], [p, y + 1]] as Array<[number, number]>).filter(isIntPt)), ar: `ما إحداثيات نقطة تلاقي ارتفاعات المثلث الذي رؤوسه A${pt(...A)} و B${pt(...B)} و C${pt(...C)}؟`, en: `What are the coordinates of the orthocentre of the triangle with vertices A${pt(...A)}, B${pt(...B)} and C${pt(...C)}?` };
    }
  }
  const m = 3 * int(rng, 2, 12);
  const k = kind === 0 || (kind === 4 && rng() < 0.5);
  const ans = k ? (2 * m) / 3 : m / 3;
  return { eq: `${m}`, answer: String(ans), wrongs: pos(ans, [m / 2, m, k ? m / 3 : (2 * m) / 3, ans + 1, m - 1]), ar: `في المثلث ABC، القطعة المتوسطة من الرأس A طولها ${m} سم، ومركز المثلث G. ما طول ${k ? 'AG' : 'GD (حيث D منتصف BC)'}؟`, en: `In triangle ABC the median from vertex A is ${m} cm long, and G is the centroid. What is the length of ${k ? 'AG' : 'GD (where D is the midpoint of BC)'}?` };
});

const TRI9: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
type Ratio = 'sin' | 'cos' | 'tan';
const RATIOS: Ratio[] = ['sin', 'cos', 'tan'];
const trigRatios = T('trig_ratios', /^النسب المثلثيه$/, [9, 9], ({ rng }) => {
  const [a, b, c] = pick(rng, TRI9);
  /** BC = a is opposite A, AC = b is adjacent to it, AB = c is the hypotenuse. */
  const ratio = (r: Ratio): [number, number] => (r === 'sin' ? [a, c] : r === 'cos' ? [b, c] : [a, b]);
  // 0 a ratio from the three sides; 1 a side from a ratio and one side, 2 one ratio from another, 3 an angle from two sides and the value of its ratio.
  const kind = pick(rng, [0, 1, 2, 3]);
  if (kind === 1) {
    const m = int(rng, 2, 5), r = pick(rng, RATIOS), [n, d] = ratio(r);
    const S: Record<string, number> = { BC: m * a, AC: m * b, AB: m * c };
    const [known, want, third] = r === 'sin' ? ['AB', 'BC', 'AC'] : r === 'cos' ? ['AB', 'AC', 'BC'] : ['AC', 'BC', 'AB'];
    const ans = S[want]!;
    return { eq: `side ${r} ${n}/${d}, ${known} ${S[known]}`, answer: String(ans), wrongs: pos(ans, [S[third]!, S[known]! - ans, (S[known]! * d) / n, n, ans + m]), ar: `في المثلث ABC القائم الزاوية في C، ${r} A = ${sfrac(n, d)} و ${known} = ${S[known]} سم. ما طول ${want}؟`, en: `In triangle ABC, right-angled at C, ${r} A = ${sfrac(n, d)} and ${known} = ${S[known]} cm. How long is ${want}?` };
  }
  if (kind === 2) {
    const g = pick(rng, RATIOS), w = pick(rng, RATIOS.filter(x => x !== g)), o = RATIOS.find(x => x !== g && x !== w)!;
    const [gn, gd] = ratio(g), [wn, wd] = ratio(w), [on, od] = ratio(o);
    const ans = sfrac(wn, wd);
    return { eq: `from ${g} ${gn}/${gd} to ${w}`, answer: ans, wrongs: wrongsFrom(ans, [sfrac(wd, wn), sfrac(on, od), sfrac(gd, gn), sfrac(gn, gd)], k => sfrac(wn + Math.abs(k), wd)), ar: `إذا كانت A زاوية حادة في مثلث قائم الزاوية، و ${g} A = ${sfrac(gn, gd)}، فما قيمة ${w} A؟`, en: `A is an acute angle of a right triangle and ${g} A = ${sfrac(gn, gd)}. What is ${w} A?` };
  }
  if (kind === 3) {
    const s0 = int(rng, 2, 12);
    const [r, angle, sides, sidesEn, value] = pick(rng, [
      ['sin', 30, `BC = ${s0} سم و AB = ${2 * s0} سم`, `BC = ${s0} cm and AB = ${2 * s0} cm`, '1/2'],
      ['cos', 60, `AC = ${s0} سم و AB = ${2 * s0} سم`, `AC = ${s0} cm and AB = ${2 * s0} cm`, '1/2'],
      ['tan', 45, `BC = ${s0} سم و AC = ${s0} سم`, `BC = ${s0} cm and AC = ${s0} cm`, '1'],
    ] as Array<[Ratio, number, string, string, string]>);
    return { eq: `angle ${r} ${s0}`, answer: `${angle}°`, wrongs: deg(angle, [30, 45, 60, 90].filter(v => v !== angle).concat(180 - angle)), ar: `علمًا بأن ${r} ${angle}° = ${value}، ما قياس الزاوية A في مثلث قائم الزاوية في C، فيه ${sides}؟`, en: `Given that ${r} ${angle}° = ${value}, what is the measure of angle A in a triangle right-angled at C with ${sidesEn}?` };
  }
  const which = pick(rng, [0, 1, 2]);
  const [name, num, den] = which === 0 ? ['sin', a, c] : which === 1 ? ['cos', b, c] : ['tan', a, b];
  const ans = sfrac(num, den);
  const others = [sfrac(den, num), which === 0 ? sfrac(b, c) : which === 1 ? sfrac(a, c) : sfrac(b, a), which === 2 ? sfrac(a, c) : sfrac(a, b), sfrac(c, b)];
  return { eq: `${a}, ${b}, ${c}`, answer: ans, wrongs: wrongsFrom(ans, others, k => sfrac(num + Math.abs(k), den)), ar: `في المثلث ABC القائم الزاوية في C، BC = ${a} سم و AC = ${b} سم و AB = ${c} سم. ما قيمة ${name} A؟`, en: `In triangle ABC, right-angled at C, BC = ${a} cm, AC = ${b} cm and AB = ${c} cm. What is ${name} A?` };
});

const trigApplications = T('trig_applications', /^تطبيقات النسب المثلثيه$/, [9, 9], ({ rng }) => {
  // 0–2 a leg from the hypotenuse and a special angle; 3 a height from an angle of elevation, 4 a hypotenuse from a leg, 5 an angle from two sides.
  const k = pick(rng, [0, 1, 2, 3, 4, 5]);
  if (k === 0) { const c = 2 * int(rng, 2, 20); return { eq: `${c}`, answer: String(c / 2), wrongs: pos(c / 2, [c, 2 * c, c / 2 + 2, c - 2]), ar: `مثلث ABC قائم الزاوية في C، فيه A = 30° والوتر AB = ${c} سم. ما طول الضلع BC المقابل للزاوية A؟`, en: `Triangle ABC is right-angled at C with A = 30° and hypotenuse AB = ${c} cm. What is the side BC opposite A?` }; }
  if (k === 1) { const c = 2 * int(rng, 2, 20); return { eq: `${c}`, answer: String(c / 2), wrongs: pos(c / 2, [c, 2 * c, c / 2 + 2, c - 2]), ar: `مثلث ABC قائم الزاوية في C، فيه A = 60° والوتر AB = ${c} سم. ما طول الضلع AC المجاور للزاوية A؟`, en: `Triangle ABC is right-angled at C with A = 60° and hypotenuse AB = ${c} cm. What is the side AC adjacent to A?` }; }
  if (k === 3) {
    // tan 45° = 1, tan 60° = √3: the height is the distance, or the distance times √3.
    const d = int(rng, 5, 40), th = pick(rng, [45, 60]);
    const ans = th === 45 ? String(d) : `${d}√3`;
    const wr = th === 45 ? wrongsFrom(ans, [`${d}√2`, String(2 * d), `${d}√3`], j => String(d + Math.abs(j))) : wrongsFrom(ans, [String(d), String(2 * d), `${d}√2`], j => `${d + Math.abs(j)}√3`);
    return { eq: `tower ${d}, ${th}`, answer: ans, wrongs: wr, ar: `من نقطة على سطح الأرض تبعد ${d} م عن قاعدة برج رأسي، كان قياس زاوية ارتفاع قمة البرج ${th}°. ما ارتفاع البرج بالأمتار؟`, en: `From a point on the ground ${d} m from the foot of a vertical tower, the angle of elevation of its top is ${th}°. How tall is the tower in metres?` };
  }
  if (k === 4) {
    const h = int(rng, 2, 12);
    return { eq: `ladder ${h}`, answer: String(2 * h), wrongs: pos(2 * h, [h, 3 * h, h + 2, 4 * h]), ar: `يستند سلم إلى حائط رأسي، فتصل قمته إلى ارتفاع ${h} م عن الأرض، ويصنع مع الأرض زاوية قياسها 30°. ما طول السلم بالأمتار؟`, en: `A ladder leans on a vertical wall. Its top is ${h} m above the ground and it makes a 30° angle with the ground. How long is the ladder in metres?` };
  }
  if (k === 5) {
    // cos A = foot / ladder = 1/2 gives 60°; sin A = top / ladder = 1/2 gives 30°.
    const h = int(rng, 2, 9), foot = rng() < 0.5, ans = foot ? 60 : 30;
    return { eq: `lean ${h}, ${foot}`, answer: `${ans}°`, wrongs: deg(ans, [90 - ans, 45, 90, 120]), ar: `سلم طوله ${2 * h} م يستند إلى حائط رأسي، ${foot ? `وتبعد قاعدته ${h} م عن الحائط` : `وتصل قمته إلى ارتفاع ${h} م عن الأرض`}. ما قياس الزاوية التي يصنعها السلم مع الأرض؟`, en: `A ladder ${2 * h} m long leans on a vertical wall${foot ? `, its foot ${h} m from the wall` : `, its top ${h} m above the ground`}. What angle does the ladder make with the ground?` };
  }
  const s = int(rng, 2, 12);
  return { eq: `${s}√2`, answer: String(s), wrongs: pos(s, [2 * s, s + 2, s * s, s - 1]), ar: `مثلث ABC قائم الزاوية في C، فيه A = 45° والوتر AB = ${s}√2 سم. ما طول الضلع BC؟`, en: `Triangle ABC is right-angled at C with A = 45° and hypotenuse AB = ${s}√2 cm. What is BC?` };
});

// ─── Grade 10: circles, bearings, area by sine ──────────────────────────────

const circleChords = T('circle_chords', /^اوتار الدائره واقطارها ومماساتها$/, [10, 10], ({ rng }) => {
  const [h, d, r] = pick(rng, [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]] as Array<[number, number, number]>);
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${r}, ${2 * h}`, answer: String(d), wrongs: pos(d, [r - h, r + h, h, d + 1]), ar: `دائرة نصف قطرها ${r} سم، وفيها وتر طوله ${2 * h} سم. ما بُعد الوتر عن مركز الدائرة؟`, en: `A circle has radius ${r} cm and a chord ${2 * h} cm long. How far is the chord from the centre?` };
  if (k === 1) return { eq: `${r}, ${d}`, answer: String(2 * h), wrongs: pos(2 * h, [h, r + d, 2 * r, 2 * h + 2]), ar: `دائرة نصف قطرها ${r} سم، وبُعد وتر فيها عن المركز ${d} سم. ما طول الوتر؟`, en: `A circle has radius ${r} cm and a chord ${d} cm from the centre. How long is the chord?` };
  return { eq: `${r}, ${d}`, answer: String(h), wrongs: pos(h, [r - d, r + d, r * d, h + 1]), ar: `من نقطة تبعد ${r} سم عن مركز دائرة نصف قطرها ${d} سم رُسم مماس للدائرة. ما طول المماس من النقطة إلى نقطة التماس؟`, en: `A tangent is drawn to a circle of radius ${d} cm from a point ${r} cm from the centre. How long is the tangent from the point to the point of contact?` };
});

const circleAngles = T('circle_angles', /^الزوايا في الدائره$/, [10, 10], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  const a = 2 * int(rng, 15, 80);
  if (k === 0) return { eq: `${a}`, answer: `${a / 2}°`, wrongs: deg(a / 2, [a, 2 * a, 180 - a / 2, 90]), ar: `قوس في دائرة قياسه ${a}°. ما قياس الزاوية المحيطية المرسومة على هذا القوس؟`, en: `An arc of a circle measures ${a}°. What is the inscribed angle that stands on this arc?` };
  if (k === 1) return { eq: `${a}`, answer: `${a * 2}°`, wrongs: deg(a * 2, [a, a / 2, 180 - a, 360 - a]), ar: `زاوية محيطية في دائرة قياسها ${a}°. ما قياس الزاوية المركزية المرسومة على القوس نفسه؟`, en: `An inscribed angle in a circle measures ${a}°. What is the central angle on the same arc?` };
  if (k === 2) return { eq: '', answer: '90°', wrongs: ['45°', '180°', '60°'], ar: 'ما قياس الزاوية المحيطية المرسومة على قطر الدائرة؟', en: 'What is the measure of an inscribed angle that stands on a diameter?' };
  const b = int(rng, 50, 130);
  return { eq: `${b}`, answer: `${180 - b}°`, wrongs: deg(180 - b, [b, 90, 360 - b, 2 * b]), ar: `في الشكل الرباعي الدائري ABCD قياس الزاوية A هو ${b}°. ما قياس الزاوية C؟`, en: `In cyclic quadrilateral ABCD, angle A measures ${b}°. What does angle C measure?` };
});

const pad3 = (n: number) => String(n).padStart(3, '0');
const brg = (n: number) => `${pad3(((n % 360) + 360) % 360)}°`;
/** [ar, en, bearing] — the eight points of the compass the lesson writes as bearings. */
const COMPASS: Array<[string, string, number]> = [
  ['الشمال الشرقي', 'north-east', 45], ['الجنوب الشرقي', 'south-east', 135], ['الجنوب الغربي', 'south-west', 225],
  ['الشمال الغربي', 'north-west', 315], ['الشرق', 'east', 90], ['الجنوب', 'south', 180], ['الغرب', 'west', 270],
];
/**
 * The lesson's four objectives, one kind each (2026-10-15): read a compass
 * direction as a bearing, the back bearing, a change of course, and a bearing
 * problem — plus the angle between two bearings from one point. It used to ask
 * the back bearing only, so a quiz was twenty copies of one sentence.
 */
const bearing = T('bearing', /^الاتجاه من الشمال/, [10, 10], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3, 4]);
  if (k === 1) {
    const [ar, en, b] = pick(rng, COMPASS);
    return { eq: `compass ${b}`, answer: brg(b), wrongs: wrongsFrom(brg(b), [brg(360 - b), brg(b + 90), brg(b + 180), brg(b - 90)], j => brg(b + 15 * Math.abs(j))), ar: `ما الاتجاه من الشمال لجهة ${ar}؟ اكتبه بثلاثة أرقام.`, en: `What is the bearing of the direction ${en}? Write it in three figures.` };
  }
  if (k === 2) {
    const b = int(rng, 10, 350), t = 10 * int(rng, 2, 9), cw = rng() < 0.5;
    const nb = cw ? b + t : b - t;
    return { eq: `turn ${b} ${cw ? '+' : '−'}${t}`, answer: brg(nb), wrongs: wrongsFrom(brg(nb), [brg(cw ? b - t : b + t), brg(b + 180), brg(t), brg(nb + 180)], j => brg(nb + 10 * Math.abs(j))), ar: `تسير سفينة بالاتجاه ${brg(b)}، ثم تنعطف ${t}° ${cw ? 'مع' : 'عكس'} اتجاه حركة عقارب الساعة. ما اتجاهها الجديد من الشمال؟`, en: `A ship on a bearing of ${brg(b)} turns ${t}° ${cw ? 'clockwise' : 'anticlockwise'}. What is its new bearing?` };
  }
  if (k === 3) {
    const [a, b, c] = pick(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15], [12, 16, 20]] as Array<[number, number, number]>);
    const east = rng() < 0.5;
    return { eq: `${a}, ${b}`, answer: String(c), wrongs: pos(c, [a + b, b - a, c + 1, c - 1]), ar: `سار قارب ${a} كم بالاتجاه 000°، ثم ${b} كم بالاتجاه ${east ? '090°' : '270°'}. كم كيلومترًا يبعد القارب عن نقطة انطلاقه؟`, en: `A boat sails ${a} km on a bearing of 000°, then ${b} km on a bearing of ${east ? '090°' : '270°'}. How many kilometres is it from its starting point?` };
  }
  if (k === 4) {
    const b1 = int(rng, 10, 170), d = int(rng, 20, 160), b2 = b1 + d;
    return { eq: `${b1}, ${b2}`, answer: `${d}°`, wrongs: deg(d, [180 - d, 360 - d, b2, b1 + b2 > 360 ? b1 + b2 - 360 : 90]), ar: `من النقطة A، اتجاه النقطة B هو ${brg(b1)} واتجاه النقطة C هو ${brg(b2)}. ما قياس الزاوية BAC؟`, en: `From point A, the bearing of B is ${brg(b1)} and the bearing of C is ${brg(b2)}. What is angle BAC?` };
  }
  const b = int(rng, 10, 350);
  const back = b < 180 ? b + 180 : b - 180;
  return { eq: pad3(b), answer: `${pad3(back)}°`, wrongs: wrongsFrom(`${pad3(back)}°`, [`${pad3(b)}°`, `${pad3((b + 90) % 360)}°`, `${pad3((360 - b) % 360)}°`, `${pad3((b + 270) % 360)}°`], k => `${pad3((back + 10 * Math.abs(k)) % 360)}°`), ar: `اتجاه النقطة B من النقطة A هو ${pad3(b)}°. ما اتجاه A من B؟`, en: `The bearing of B from A is ${pad3(b)}°. What is the bearing of A from B?` };
});

/** Triangles whose area by Heron's formula is a whole number. */
const HERON: Array<[number, number, number]> = [[5, 5, 6], [5, 5, 8], [13, 14, 15], [6, 8, 10], [10, 10, 12], [13, 13, 10], [9, 10, 17], [5, 12, 13], [7, 15, 20], [3, 4, 5]];
const heronArea = (a: number, b: number, c: number) => { const p = (a + b + c) / 2; return Math.sqrt(p * (p - a) * (p - b) * (p - c)); };
/**
 * Area from two sides and the included angle, the lesson's first objective — and
 * since 2026-10-15 its others: from three sides (Heron), and the same formula
 * read backwards for a missing side or the included angle.
 */
const sineArea = T('sine_area', /^استعمال جيب الزاويه لايجاد مساحه المثلث$/, [10, 10], ({ rng }) => {
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 1) {
    const [a0, b0, c0] = pick(rng, HERON), m = pick(rng, [1, 2]);
    const [a, b, c] = [a0 * m, b0 * m, c0 * m], A = heronArea(a, b, c);
    return { eq: `heron ${a}, ${b}, ${c}`, answer: String(A), wrongs: pos(A, [(a * b) / 2, a + b + c, 2 * A, A / 2, (a * b * c) / 4]), ar: `مثلث أطوال أضلاعه ${a} سم و ${b} سم و ${c} سم. ما مساحته بالسنتيمتر المربع؟`, en: `A triangle has sides ${a} cm, ${b} cm and ${c} cm. What is its area in square centimetres?` };
  }
  // k 2 and 3 read ½·a·b·sin C backwards; sin C is 1/2 or 1, so every number stays whole.
  const C = pick(rng, [30, 150, 90]);
  const a = int(rng, 4, 16), b = int(rng, 4, 16);
  const A = C === 90 ? (a * b) / 2 : (a * b) / 4;
  if (!Number.isInteger(A)) return sineArea.make({ rng, diff: 'easy', grade: 10 });
  if (k === 2) return { eq: `side ${A}, ${a}, ${C}`, answer: String(b), wrongs: pos(b, [2 * b, (2 * A) / a, A - a, a]), ar: `مثلث مساحته ${A} سم²، وفيه ضلع طوله ${a} سم يحصر مع ضلع آخر زاوية قياسها ${C}°. ما طول الضلع الآخر؟${C === 90 ? '' : ' (sin 30° = sin 150° = 1/2)'}`, en: `A triangle has area ${A} cm². One side is ${a} cm and makes an angle of ${C}° with another side. How long is the other side?${C === 90 ? '' : ' (sin 30° = sin 150° = 1/2)'}` };
  if (k === 3) {
    const right = C === 90;
    return { eq: `angle ${a}, ${b}, ${A}`, answer: right ? '90°' : '30°', wrongs: right ? deg(90, [45, 60, 30]) : deg(30, [60, 45, 150]), ar: `مثلث فيه ضلعان طولاهما ${a} سم و ${b} سم، ومساحته ${A} سم². ما قياس الزاوية ${right ? '' : 'الحادة '}المحصورة بين الضلعين؟`, en: `A triangle has two sides ${a} cm and ${b} cm and an area of ${A} cm². What is the ${right ? '' : 'acute '}angle between those sides?` };
  }
  if ((C === 90 ? (a * b) % 2 : (a * b) % 4) !== 0) return sineArea.make({ rng, diff: 'easy', grade: 10 });
  return { eq: `${a}, ${b}, ${C}`, answer: String(A), wrongs: pos(A, [a * b, (a * b) / 2, A * 2, A + a, a + b]), ar: `مثلث فيه ضلعان طولاهما ${a} سم و ${b} سم والزاوية المحصورة بينهما ${C}°. ما مساحته؟ (sin 30° = sin 150° = 1/2)`, en: `A triangle has two sides ${a} cm and ${b} cm with an included angle of ${C}°. What is its area? (sin 30° = sin 150° = 1/2)` };
});

// ─── units and time (Grades 3–5) ────────────────────────────────────────────

type Unit = [string, string, string, string, number]; // [big ar, small ar, big en, small en, factor]
const UNIT_SETS: Record<string, Unit> = {
  length_m: ['متر', 'سنتيمتر', 'm', 'cm', 100],
  length_km: ['كيلومتر', 'متر', 'km', 'm', 1000],
  mass: ['كيلوغرام', 'غرام', 'kg', 'g', 1000],
  volume: ['لتر', 'مليلتر', 'L', 'mL', 1000],
};
/**
 * The unit symbols a story or a compound measure is written with (no number–noun
 * agreement to get wrong), the accusative «كم …» asks with, and a real-life
 * «what is left» story per quantity.
 */
const UNIT_WORDS: Record<string, { big: string; small: string; acc: string; story: (n: number, p: number) => [string, string] }> = {
  length_m: { big: 'م', small: 'سم', acc: 'سنتيمترًا', story: (n, p) => [`شريط طوله ${n} م، قُصَّت منه قطعة طولها ${p} سم. كم سنتيمترًا بقي من الشريط؟`, `A ribbon is ${n} m long and a piece ${p} cm long is cut off. How many centimetres of ribbon are left?`] },
  length_km: { big: 'كم', small: 'م', acc: 'مترًا', story: (n, p) => [`يريد عدّاء أن يركض مسافة ${n} كم، وقد ركض منها ${p} م. كم مترًا بقي عليه أن يركض؟`, `A runner wants to run ${n} km and has run ${p} m of it. How many metres are left to run?`] },
  mass: { big: 'كغ', small: 'غ', acc: 'غرامًا', story: (n, p) => [`في كيس ${n} كغ من الأرز، استُعمل منه ${p} غ. كم غرامًا بقي في الكيس؟`, `A bag holds ${n} kg of rice and ${p} g of it is used. How many grams are left in the bag?`] },
  volume: { big: 'لتر', small: 'مل', acc: 'مليلترًا', story: (n, p) => [`في إبريق ${bigAmount('volume', n)} من الماء، سُكب منه ${p} مل. كم مليلترًا بقي في الإبريق؟`, `A jug holds ${n} L of water and ${p} mL is poured out. How many millilitres are left in the jug?`] },
};
/**
 * A whole number of the big unit. Every unit is written with its symbol except
 * the litre, whose word agrees with the number: «5 لترات», «12 لترًا», «300 لتر».
 * One and two take their own words, so a litre count starts at 3 (`bigMin`).
 */
const bigAmount = (set: string, n: number) => (set === 'volume' ? `${n} ${tamyiz(n, 'لترات', 'لترًا', 'لتر')}` : `${n} ${UNIT_WORDS[set]!.big}`);
const bigTarget = (set: string) => (set === 'volume' ? 'لترات' : UNIT_WORDS[set]!.big);
const bigMin = (set: string, min: number) => (set === 'volume' ? Math.max(3, min) : min);
/** «كم غرامًا في 3 كغ و 250 غ؟» — a compound measure written in the small unit. */
const unitCompound = (rng: Rng, diff: D, set: string): Draft => {
  const [, , bigEn, smallEn, f] = UNIT_SETS[set]!, w = UNIT_WORDS[set]!;
  const a = int(rng, bigMin(set, 1), span(diff, 5, 9, 15)), b = f === 100 ? int(rng, 1, 99) : 10 * int(rng, 1, 99);
  return { eq: `${a}, ${b}`, answer: String(a * f + b), wrongs: pos(a * f + b, [a + b, a * f * b, a * 10 + b, (a * f + b) * 10, a * f - b]), ar: `كم ${w.acc} في ${bigAmount(set, a)} و ${b} ${w.small}؟`, en: `How many ${smallEn} are in ${a} ${bigEn} ${b} ${smallEn}?` };
};
/** A whole number of the big unit, less a part in the small unit: convert, then subtract. */
const unitStory = (rng: Rng, diff: D, set: string): Draft => {
  const f = UNIT_SETS[set]![4];
  const n = int(rng, bigMin(set, 2), span(diff, 5, 9, 15)), p = f === 100 ? 10 * int(rng, 1, 9) : 50 * int(rng, 1, 19);
  const left = n * f - p;
  const [ar, en] = UNIT_WORDS[set]!.story(n, p);
  return { eq: `left ${n}, ${p}`, answer: String(left), wrongs: pos(left, [n * f + p, n * f, n * f - 10 * p, (n - 1) * f, left + f / 10]), ar, en };
};
const convertGen = (id: string, match: RegExp, sets: string[], grades: [number, number]) => T(id, match, grades, ({ rng, diff }) => {
  const set = pick(rng, sets);
  const [, , bigEn, smallEn, f] = UNIT_SETS[set]!;
  // 0 big → small, 1 small → big; 2 a compound measure in the small unit, 3 what is left (real life).
  const k = pick(rng, [0, 1, 2, 3]);
  if (k === 2) return unitCompound(rng, diff, set);
  if (k === 3) return unitStory(rng, diff, set);
  const n = int(rng, bigMin(set, 2), span(diff, 9, 25, 90));
  if (k === 0) return { eq: `${n}`, answer: String(n * f), wrongs: pos(n * f, [n * f * 10, (n * f) / 10, n + f, n * f / 100 | 0, n * 10]), ar: `حوّل ${bigAmount(set, n)} إلى ${UNIT_WORDS[set]!.small}.`, en: `Convert ${n} ${bigEn} to ${smallEn}.` };
  const q = int(rng, 2, span(diff, 9, 25, 60));
  const small = q * f;
  return { eq: `${small}`, answer: String(q), wrongs: pos(q, [q * 10, small / 10, q * 100, q + 1, small]), ar: `حوّل ${small} ${UNIT_WORDS[set]!.small} إلى ${bigTarget(set)}.`, en: `Convert ${small} ${smallEn} to ${bigEn}.` };
});

/** The lesson names the quantity — length, mass or capacity — and only that quantity's units appear. */
const unitsMixed = (id: string, match: RegExp, sets: string[]) => T(id, match, [4, 5], ({ rng, diff, grade }) => {
  const set = pick(rng, sets);
  const [, , bigEn, smallEn, f] = UNIT_SETS[set]!;
  // 0 big → small, 1 a compound measure → small, 2 small → big, 3 what is left (real life).
  const k = pick(rng, diff === 'easy' && grade === 4 ? [0, 2, 3] : [0, 1, 2, 3]);
  if (k === 1) return unitCompound(rng, diff, set);
  if (k === 3) return unitStory(rng, diff, set);
  if (k === 2) {
    const q = int(rng, 2, span(diff, 9, 30, 60)), small = q * f;
    return { eq: `${small}`, answer: String(q), wrongs: pos(q, [q * 10, small / 10, q * 100, q + 1, small]), ar: `حوّل ${small} ${UNIT_WORDS[set]!.small} إلى ${bigTarget(set)}.`, en: `Convert ${small} ${smallEn} to ${bigEn}.` };
  }
  const n = int(rng, bigMin(set, 2), span(diff, 9, 30, 90));
  return { eq: `${n}`, answer: String(n * f), wrongs: pos(n * f, [n * f * 10, (n * f) / 10, n + f, n * 10]), ar: `حوّل ${bigAmount(set, n)} إلى ${UNIT_WORDS[set]!.small}.`, en: `Convert ${n} ${bigEn} to ${smallEn}.` };
});

const clock = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;
const addMinutes = (h: number, m: number, d: number): [number, number] => { const t = ((h * 60 + m + d) % 720 + 720) % 720; const hh = Math.floor(t / 60); return [hh === 0 ? 12 : hh, t % 60]; };

const timeGen = (id: string, match: RegExp, grades: [number, number]) => T(id, match, grades, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2]);
  const step = diff === 'easy' ? 5 : 1;
  const h = int(rng, 1, 11), m = step * int(rng, 0, Math.floor(59 / step));
  if (k === 0) {
    const d = (diff === 'easy' ? 5 : 1) * int(rng, 3, 24);
    const [h2, m2] = addMinutes(h, m, d);
    return { eq: `${clock(h, m)}, ${d}`, answer: clock(h2, m2), wrongs: wrongsFrom(clock(h2, m2), [clock(...addMinutes(h, m, -d)), clock(...addMinutes(h, m, d + 10)), clock(...addMinutes(h, m, d - 10)), clock(h, (m + d) % 60)], j => clock(...addMinutes(h, m, d + 5 * Math.abs(j)))), ar: `بدأ درس الساعة ${clock(h, m)} واستمر ${minAr(d)}. متى انتهى؟`, en: `A lesson starts at ${clock(h, m)} and lasts ${d} minutes. When does it end?` };
  }
  if (k === 1) {
    const d = (diff === 'easy' ? 15 : 5) * int(rng, 1, 14);
    const [h2, m2] = addMinutes(h, m, d);
    return { eq: `${clock(h, m)}, ${clock(h2, m2)}`, answer: String(d), wrongs: pos(d, [d + 10, d - 10, d + 60, d * 2, 60 - (d % 60)]), ar: `بدأ نشاط الساعة ${clock(h, m)} وانتهى الساعة ${clock(h2, m2)}. كم دقيقة استغرق؟`, en: `An activity starts at ${clock(h, m)} and ends at ${clock(h2, m2)}. How many minutes did it take?` };
  }
  const hh = int(rng, 1, 5), mm = 5 * int(rng, 1, 11);
  return { eq: `${hh}, ${mm}`, answer: String(hh * 60 + mm), wrongs: pos(hh * 60 + mm, [hh + mm, hh * 100 + mm, hh * 60, (hh + 1) * 60 + mm, hh * 60 - mm]), ar: `كم دقيقة في ${hourAr(hh)} و ${minAr(mm)}؟`, en: `How many minutes are in ${hh} hours and ${mm} minutes?` };
});

const HOURS_AR = ['', 'الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
/**
 * Arabic clock words into digits — and since 2026-10-16 digits into words, the
 * time read off the hands, and the minutes left to the hour («إلا»).
 */
const clockWords = T('time_words', /^قراءه الوقت/, [3, 3], ({ rng }) => {
  const h = int(rng, 1, 12);
  const forms: Array<[string, number]> = [['والنصف', 30], ['والربع', 15], ['إلا ربعًا', -15], ['وخمس دقائق', 5], ['وعشر دقائق', 10], ['إلا خمس دقائق', -5], ['إلا عشر دقائق', -10], ['وثلث', 20], ['إلا ثلثًا', -20]];
  const ask = pick(rng, [0, 1, 2, 3]);
  if (ask === 2) { // the hands of a clock: the minute hand on a number, the hour hand between two
    const mn = pick(rng, [1, 2, 3, 4, 6, 8, 9, 10, 11]), mm = 5 * mn, nx = (h % 12) + 1;
    return { eq: `hands ${h}, ${mn}`, answer: clock(h, mm), wrongs: wrongsFrom(clock(h, mm), [clock(nx, mm), clock(h, mn), ...(h * 5 < 60 && mn !== h ? [clock(mn, h * 5)] : [])], j => clock(h, (mm + 5 * Math.abs(j)) % 60)), ar: `يشير عقرب الدقائق إلى العدد ${mn}، ويقع عقرب الساعات بين العددين ${h} و ${nx}. ما الوقت بالأرقام؟`, en: `The minute hand points to ${mn} and the hour hand is between ${h} and ${nx}. What is the time in digits?` };
  }
  if (ask === 3) { // «إلا»: how many minutes are left to the next hour
    const m = 5 * int(rng, 7, 11), nx = (h % 12) + 1, left = 60 - m;
    return { eq: `${clock(h, m)} → ${nx}`, answer: String(left), wrongs: pos(left, [m, left + 5, left - 5, 100 - m]), ar: `الساعة الآن ${clock(h, m)}. كم دقيقة بقيت على الساعة ${HOURS_AR[nx]}؟`, en: `It is ${clock(h, m)} now. How many minutes are left until ${nx} o'clock?` };
  }
  const [word, off] = pick(rng, forms);
  const [h2, m2] = addMinutes(h, 0, off);
  if (ask === 1) { // the other way: digits into words, with the word the stem names
    const other = off < 0 ? h2 : (h % 12) + 1, mirror = forms.find(f => f[1] === -off)?.[0];
    const ans = `${HOURS_AR[h]} ${word}`;
    const cands = [`${HOURS_AR[other]} ${word}`, ...(mirror ? [`${HOURS_AR[h]} ${mirror}`, `${HOURS_AR[other]} ${mirror}`] : [`${HOURS_AR[h]} والربع`, `${HOURS_AR[other]} إلا ربعًا`])];
    return { eq: clock(h2, m2), answer: ans, wrongs: wrongsFrom(ans, cands, j => `${HOURS_AR[((h + j + 23) % 12) + 1]} ${word}`), ar: `اكتب الوقت ${clock(h2, m2)} بالكلمات باستعمال (${off < 0 ? 'إلا' : 'و'}).`, en: `Write the time ${clock(h2, m2)} in Arabic words using «${off < 0 ? 'إلا' : 'و'}».` };
  }
  return { eq: `${HOURS_AR[h]} ${word}`, answer: clock(h2, m2), wrongs: wrongsFrom(clock(h2, m2), [clock(...addMinutes(h, 0, -off)), clock(h, 0), clock(...addMinutes(h, 0, off + 5)), clock(...addMinutes(h, 0, off - 5))], j => clock(...addMinutes(h, 0, off + 5 * Math.abs(j) + 10))), ar: `كيف تُكتب الساعة «${HOURS_AR[h]} ${word}» بالأرقام؟`, en: `How is the time «${HOURS_AR[h]} ${word}» (Arabic wording) written in digits?` };
});

export const GEOMETRY_TOPICS: readonly Topic[] = [
  perimeter, area, composite, parallelogramArea, triangleArea, trapezoidArea, rectPrism,
  circleParts, sector, circumference, circleArea,
  prismCylinderVolume, pyramidConeVolume, prismCylinderSurface, pyramidConeSurface, sphere,
  angleKind, lineAndPoint, triBySides, triByAngles,
  quadName('quad_name_g5', /^تصنيف الاشكال الرباعيه$/, 5), quadName('quad_name_g6', /^الاشكال الرباعيه$/, 6),
  prismPyramid, symmetry, complement, transversal, triangleAngles, polygonAngles,
  parallelogram, parallelogramTest, specialParallelograms, parallelProof, isosceles,
  congruence('congruence_a', /^تطابق المثلثات \(SSS SAS HL\)$/, ['SSS', 'SAS', 'HL']), congruenceAsa('congruence_b', /^تطابق المثلثات \(ASA AAS\)$/),
  similarity, pyth,
  reflectLine, translate('translate_g5', /^الانسحاب$/, 5), translate('translate_g6', /^الانسحاب في المستوي الاحداثي$/, 6), reflectAxes, coordPlane5, coordPlane6, rotate,
  dilate('dilate_g7', /^التكبير$/, 7), dilate('dilate_g8', /^التمدد$/, 8),
  distance, pointLine, proportionalParts, bisector, medians, trigRatios, trigApplications,
  circleChords, circleAngles, bearing, sineArea,
  convertGen('units_m', /^المتر والسنتيمتر$/, ['length_m'], [3, 3]), convertGen('units_km', /^الكيلومتر$/, ['length_km'], [3, 3]),
  convertGen('units_mass', /^الغرام والكيلوغرام$/, ['mass'], [3, 3]), convertGen('units_volume', /^اللتر والمليلتر$/, ['volume'], [3, 3]),
  unitsMixed('units_length', /^وحدات قياس الطول$/, ['length_m', 'length_km']), unitsMixed('units_mass_g45', /^وحدات قياس الكتله$/, ['mass']),
  unitsMixed('units_capacity', /^وحدات قياس السعه$/, ['volume']), unitsMixed('units_capacity_length', /^وحدات قياس السعه والطول$/, ['length_m', 'volume']),
  timeGen('time_g3', /^(?:الوقت بالدقائق|الفترات الزمنيه)/, [3, 3]), timeGen('time_g45', /^الزمن$/, [4, 5]), clockWords,
];
