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
import { gcd, int, pick, sfrac, signed, tier, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

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
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);

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
  const k = pick(rng, grade >= 4 ? [0, 1, 2] : [0, 1]);
  if (k === 0) {
    const l = int(rng, 2, m), w = int(rng, 2, m);
    return { eq: `${l}, ${w}`, answer: String(l * w), wrongs: pos(l * w, [2 * (l + w), l + w, l * w + l, l * w - w]), ar: `ما مساحة مستطيل طوله ${l} سم وعرضه ${w} سم (بالسنتيمتر المربع)؟`, en: `What is the area, in cm², of a rectangle ${l} cm long and ${w} cm wide?` };
  }
  if (k === 1) {
    const s = int(rng, 2, m);
    return { eq: `${s}`, answer: String(s * s), wrongs: pos(s * s, [4 * s, 2 * s, s * s + s]), ar: `ما مساحة مربع طول ضلعه ${s} سم (بالسنتيمتر المربع)؟`, en: `What is the area, in cm², of a square with side ${s} cm?` };
  }
  const l = int(rng, 3, m), w = int(rng, 2, m);
  return { eq: `${l * w}, ${l}`, answer: String(w), wrongs: pos(w, [l * w - l, l * w + l, l + w, l]), ar: `مساحة مستطيل ${l * w} سم² وطوله ${l} سم. ما عرضه؟`, en: `A rectangle has area ${l * w} cm² and length ${l} cm. What is its width?` };
});

const composite = T('composite_L', /^محيط الشكل المركب ومساحته$/, [5, 5], ({ rng, diff }) => {
  const W = int(rng, 8, span(diff, 12, 16, 20)), H = int(rng, 6, span(diff, 10, 14, 18));
  const w = int(rng, 2, W - 3), h = int(rng, 2, H - 3);
  const ask = rng() < 0.5;
  const stem = `شكل على صورة حرف L داخل مستطيل أبعاده ${W} سم × ${H} سم، أُزيل من إحدى زواياه مستطيل أبعاده ${w} سم × ${h} سم`;
  const stemEn = `An L-shaped figure sits inside a ${W} cm × ${H} cm rectangle with a ${w} cm × ${h} cm rectangle removed from one corner`;
  if (ask) { const a = W * H - w * h; return { eq: `${W}, ${H}, ${w}, ${h}`, answer: String(a), wrongs: pos(a, [W * H, W * H + w * h, W * H - w - h, (W - w) * (H - h)]), ar: `${stem}. ما مساحته؟`, en: `${stemEn}. What is its area?` }; }
  const p = 2 * (W + H);
  return { eq: `${W}, ${H}, ${w}, ${h}`, answer: String(p), wrongs: pos(p, [p - 2 * (w + h), p + 2 * (w + h), W + H, W * H - w * h]), ar: `${stem}. ما محيطه؟`, en: `${stemEn}. What is its perimeter?` };
});

const parallelogramArea = T('area_parallelogram', /^مساحه متوازي الاضلاع$/, [6, 6], ({ rng, diff }) => {
  const b = int(rng, 4, span(diff, 12, 18, 25)), h = int(rng, 3, span(diff, 9, 14, 20));
  if (diff === 'hard' && rng() < 0.4) return { eq: `${b * h}, ${b}`, answer: String(h), wrongs: pos(h, [b * h - b, b + h, b * h / 2, h + b]), ar: `مساحة متوازي أضلاع ${b * h} سم² وطول قاعدته ${b} سم. ما ارتفاعه؟`, en: `A parallelogram has area ${b * h} cm² and base ${b} cm. What is its height?` };
  const s = int(rng, 2, 9);
  return { eq: `${b}, ${h}`, answer: String(b * h), wrongs: pos(b * h, [(b * h) / 2, b + h, b * (h + s), 2 * (b + h)]), ar: `ما مساحة متوازي أضلاع طول قاعدته ${b} سم وارتفاعه ${h} سم؟`, en: `What is the area of a parallelogram with base ${b} cm and height ${h} cm?` };
});

const triangleArea = T('area_triangle', /^مساحه المثلث$/, [6, 6], ({ rng, diff }) => {
  const b = int(rng, 4, span(diff, 12, 18, 24)), h = int(rng, 3, span(diff, 10, 14, 20));
  const bb = (b * h) % 2 === 0 ? b : b + 1;
  if (diff === 'hard' && rng() < 0.4) { const a = (bb * h) / 2; return { eq: `${a}, ${bb}`, answer: String(h), wrongs: pos(h, [a / bb, 2 * a - bb, a - bb, (a * 2) / bb + 1]), ar: `مساحة مثلث ${a} سم² وطول قاعدته ${bb} سم. ما ارتفاعه؟`, en: `A triangle has area ${a} cm² and base ${bb} cm. What is its height?` }; }
  const a = (bb * h) / 2;
  return { eq: `${bb}, ${h}`, answer: String(a), wrongs: pos(a, [bb * h, bb + h, a + h, 2 * (bb + h)]), ar: `ما مساحة مثلث طول قاعدته ${bb} سم وارتفاعه ${h} سم؟`, en: `What is the area of a triangle with base ${bb} cm and height ${h} cm?` };
});

const trapezoidArea = T('area_trapezoid', /^مساحه شبه المنحرف$/, [6, 6], ({ rng, diff }) => {
  const a = int(rng, 3, span(diff, 9, 13, 18));
  let b = int(rng, 3, span(diff, 9, 13, 18)), h = int(rng, 2, span(diff, 8, 12, 16));
  if (((a + b) * h) % 2) h += 1;
  const A = ((a + b) * h) / 2;
  return { eq: `${a}, ${b}, ${h}`, answer: String(A), wrongs: pos(A, [(a + b) * h, a * b * h / 2, (a + b + h) / 2 | 0, A + h, a * h]), ar: `ما مساحة شبه منحرف طولا قاعدتيه المتوازيتين ${a} سم و ${b} سم وارتفاعه ${h} سم؟`, en: `What is the area of a trapezoid whose parallel sides are ${a} cm and ${b} cm and whose height is ${h} cm?` };
});

const rectPrism = T('prism_rect', /^حجم المنشور الرباعي ومساحه سطحه$/, [6, 6], ({ rng, diff }) => {
  const l = int(rng, 3, span(diff, 8, 10, 14)), w = int(rng, 2, span(diff, 6, 8, 12)), h = int(rng, 2, span(diff, 6, 8, 12));
  if (rng() < 0.5) return { eq: `${l}, ${w}, ${h}`, answer: String(l * w * h), wrongs: pos(l * w * h, [l + w + h, 2 * (l * w + l * h + w * h), l * w, l * w * h + l]), ar: `ما حجم منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the volume of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
  const s = 2 * (l * w + l * h + w * h);
  return { eq: `${l}, ${w}, ${h}`, answer: String(s), wrongs: pos(s, [l * w * h, l * w + l * h + w * h, 2 * l * w + 2 * l * h, s + 2 * l]), ar: `ما مساحة سطح منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the surface area of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
});

// ─── circles ────────────────────────────────────────────────────────────────

const circleParts = T('circle_parts', /^الدائره واجزاؤها$/, [6, 6], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 30));
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${2 * r}`, answer: String(r), wrongs: pos(r, [2 * r + 1, 4 * r, r + 2, r * r]), ar: `قطر دائرة ${2 * r} سم. ما طول نصف قطرها؟`, en: `A circle has diameter ${2 * r} cm. What is its radius?` };
  if (k === 1) return { eq: `${r}`, answer: String(2 * r), wrongs: pos(2 * r, [r, r * r, 4 * r, r + 2]), ar: `نصف قطر دائرة ${r} سم. ما طول قطرها؟`, en: `A circle has radius ${r} cm. What is its diameter?` };
  return { eq: `${r}`, answer: String(2 * r), wrongs: pos(2 * r, [r, r * r, 4 * r, 3 * r]), ar: `ما طول أطول وتر في دائرة نصف قطرها ${r} سم؟`, en: `What is the length of the longest chord in a circle with radius ${r} cm?` };
});

const SECTOR_ANGLES = [30, 45, 60, 72, 90, 120, 180, 240, 270];
const sector = T('sector_fraction', /^القطاعات الدائريه$/, [6, 6], ({ rng }) => {
  const a = pick(rng, SECTOR_ANGLES);
  if (rng() < 0.5) {
    const ans = sfrac(a, 360);
    return { eq: `${a}°`, answer: ans, wrongs: wrongsFrom(ans, [sfrac(a, 180), sfrac(a, 100), sfrac(360 - a, 360), sfrac(a, 90 + a)], k => sfrac(a + 30 * Math.abs(k), 360)), ar: `قطاع دائري زاويته ${a}°. ما الكسر الذي يمثله من الدائرة كلها؟`, en: `A circular sector has angle ${a}°. What fraction of the whole circle is it?` };
  }
  const f = sfrac(a, 360);
  return { eq: f, answer: `${a}°`, wrongs: deg(a, [360 - a, a * 2, 180 - a, a / 2, a + 30]), ar: `قطاع دائري يمثل ${f} من الدائرة. ما قياس زاويته المركزية؟`, en: `A circular sector is ${f} of the circle. What is its central angle?` };
});

const circumference = T('circle_circumference', /^محيط الدائره$/, [7, 7], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 25));
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${r}`, answer: PI(2 * r), wrongs: piOpts(2 * r, [r, r * r, 4 * r, r + 2]), ar: `ما محيط دائرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the circumference of a circle with radius ${r} cm? (Leave your answer in terms of π)` };
  if (k === 1) return { eq: `${2 * r}`, answer: PI(2 * r), wrongs: piOpts(2 * r, [r, r * r, 4 * r, 4 * r * r]), ar: `ما محيط دائرة قطرها ${2 * r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the circumference of a circle with diameter ${2 * r} cm? (Leave your answer in terms of π)` };
  return { eq: PI(2 * r), answer: String(r), wrongs: pos(r, [2 * r, 4 * r, r * r, r + 2]), ar: `محيط دائرة ${PI(2 * r)} سم. ما طول نصف قطرها؟`, en: `A circle has circumference ${PI(2 * r)} cm. What is its radius?` };
});

const circleArea = T('circle_area', /^مساحه الدائره$/, [7, 7], ({ rng, diff }) => {
  const r = int(rng, 2, span(diff, 9, 15, 25));
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: `${r}`, answer: PI(r * r), wrongs: piOpts(r * r, [2 * r, r, 4 * r * r, r * r + r]), ar: `ما مساحة دائرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the area of a circle with radius ${r} cm? (Leave your answer in terms of π)` };
  if (k === 1) return { eq: `${2 * r}`, answer: PI(r * r), wrongs: piOpts(r * r, [4 * r * r, 2 * r, r, 2 * r * r]), ar: `ما مساحة دائرة قطرها ${2 * r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the area of a circle with diameter ${2 * r} cm? (Leave your answer in terms of π)` };
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
  if (rng() < 0.5) {
    const B = 3 * int(rng, 2, span(diff, 8, 14, 20)), h = int(rng, 3, span(diff, 9, 12, 15));
    return { eq: `${B}, ${h}`, answer: String((B * h) / 3), wrongs: pos((B * h) / 3, [B * h, B * h / 2, B + h, (B * h) / 3 + h]), ar: `ما حجم هرم مساحة قاعدته ${B} سم² وارتفاعه ${h} سم؟`, en: `What is the volume of a pyramid whose base area is ${B} cm² and whose height is ${h} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), h = 3 * int(rng, 1, span(diff, 4, 5, 6));
  return { eq: `${r}, ${h}`, answer: PI((r * r * h) / 3), wrongs: piOpts((r * r * h) / 3, [r * r * h, (r * h) / 3, 2 * r * h, (r * r * h) / 3 + r]), ar: `ما حجم مخروط نصف قطر قاعدته ${r} سم وارتفاعه ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the volume of a cone with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
});

const prismCylinderSurface = T('surface_prism_cyl', /^مساحه سطح المنشور والاسطوانه$/, [7, 7], ({ rng, diff }) => {
  if (rng() < 0.5) {
    const l = int(rng, 3, span(diff, 8, 10, 14)), w = int(rng, 2, span(diff, 6, 8, 12)), h = int(rng, 2, span(diff, 6, 8, 12));
    const s = 2 * (l * w + l * h + w * h);
    return { eq: `${l}, ${w}, ${h}`, answer: String(s), wrongs: pos(s, [l * w * h, l * w + l * h + w * h, 2 * l * w + 2 * l * h, s + 2 * l]), ar: `ما مساحة سطح منشور رباعي أبعاده ${l} سم و ${w} سم و ${h} سم؟`, en: `What is the surface area of a rectangular prism measuring ${l} cm, ${w} cm and ${h} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), h = int(rng, 2, span(diff, 8, 12, 16));
  const N = 2 * r * (r + h);
  return { eq: `${r}, ${h}`, answer: PI(N), wrongs: piOpts(N, [2 * r * h, 2 * r * r, r * r * h, r * (r + h), N + 2 * r]), ar: `ما مساحة السطح الكلية لأسطوانة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the total surface area of a cylinder with base radius ${r} cm and height ${h} cm? (Leave your answer in terms of π)` };
});

const pyramidConeSurface = T('surface_pyr_cone', /^مساحه سطح الهرم والمخروط$/, [7, 7], ({ rng, diff }) => {
  if (rng() < 0.5) {
    const b = int(rng, 3, span(diff, 8, 12, 16)), l = int(rng, 3, span(diff, 10, 14, 18));
    const s = b * b + 2 * b * l;
    return { eq: `${b}, ${l}`, answer: String(s), wrongs: pos(s, [4 * b * l, b * b + 4 * b * l, b * b + b * l, s + b]), ar: `ما مساحة السطح الكلية لهرم قاعدته مربعة طول ضلعها ${b} سم وارتفاع كل وجه جانبي (الارتفاع المائل) ${l} سم؟`, en: `What is the total surface area of a pyramid with a square base of side ${b} cm and slant height ${l} cm?` };
  }
  const r = int(rng, 2, span(diff, 6, 9, 12)), l = r + int(rng, 1, 8);
  const N = r * (r + l);
  return { eq: `${r}, ${l}`, answer: PI(N), wrongs: piOpts(N, [r * l, r * r, 2 * r * l, r * (r + l) + r, r * r * l]), ar: `ما مساحة السطح الكلية لمخروط نصف قطر قاعدته ${r} سم وارتفاعه المائل ${l} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the total surface area of a cone with base radius ${r} cm and slant height ${l} cm? (Leave your answer in terms of π)` };
});

const sphere = T('sphere', /^حجم الكره ومساحه سطحها$/, [8, 8], ({ rng, diff }) => {
  if (rng() < 0.5) {
    const r = 3 * int(rng, 1, span(diff, 2, 3, 4)); // 4/3·r³ is whole when 3 | r
    const N = (4 * r ** 3) / 3;
    return { eq: `${r}`, answer: PI(N), wrongs: piOpts(N, [4 * r * r, (4 * r ** 3), r ** 3, (2 * r ** 3) / 3 | 0, N + r]), ar: `ما حجم كرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the volume of a sphere with radius ${r} cm? (Leave your answer in terms of π)` };
  }
  const r = int(rng, 2, span(diff, 8, 12, 15));
  return { eq: `${r}`, answer: PI(4 * r * r), wrongs: piOpts(4 * r * r, [2 * r * r, r * r, (4 * r ** 3) / 3 | 0, 4 * r, 8 * r * r]), ar: `ما مساحة سطح كرة نصف قطرها ${r} سم؟ (اترك الإجابة بدلالة π)`, en: `What is the surface area of a sphere with radius ${r} cm? (Leave your answer in terms of π)` };
});

// ─── angles, triangles, quadrilaterals ──────────────────────────────────────

const ANGLE_KINDS = ['حادة', 'قائمة', 'منفرجة', 'مستقيمة'];
const angleKind = T('angle_kind', /^الخطوط والاشعه والزوايا$/, [4, 4], ({ rng }) => {
  const kind = pick(rng, [0, 1, 2, 3]);
  const a = kind === 0 ? int(rng, 5, 85) : kind === 1 ? 90 : kind === 2 ? int(rng, 95, 175) : 180;
  return { eq: `${a}°`, answer: ANGLE_KINDS[kind]!, wrongs: ANGLE_KINDS.filter((_, i) => i !== kind), ar: `زاوية قياسها ${a}°. ما نوعها: حادة أم قائمة أم منفرجة أم مستقيمة؟`, en: `An angle measures ${a}°. Is it acute, right, obtuse or straight?` };
});

const lineAndPoint = T('angles_line_point', /^مجموع الزوايا علي مستقيم وحول نقطه$/, [5, 5], ({ rng, diff }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const a = int(rng, 20, 160); return { eq: `${a}`, answer: `${180 - a}°`, wrongs: deg(180 - a, [90 - a > 0 ? 90 - a : 0, 360 - a, a, 180 + a - 90]), ar: `زاويتان على مستقيم، قياس إحداهما ${a}°. ما قياس الأخرى؟`, en: `Two angles lie on a straight line. One measures ${a}°. What does the other measure?` }; }
  if (k === 1) { const a = int(rng, 40, 150), b = int(rng, 40, 150); const c = 360 - a - b; if (c <= 0) return lineAndPoint.make({ rng, diff, grade: 5 }); return { eq: `${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [180 - a - b > 0 ? 180 - a - b : 0, 360 - a, a + b, 360 - b]), ar: `ثلاث زوايا حول نقطة، قياس إحداها ${a}° والثانية ${b}°. ما قياس الثالثة؟`, en: `Three angles surround a point. Two measure ${a}° and ${b}°. What does the third measure?` }; }
  const a = int(rng, 30, 100), b = int(rng, 20, 160 - a);
  const c = 180 - a - b;
  return { eq: `${a}, ${b}`, answer: `${c}°`, wrongs: deg(c, [360 - a - b, 180 - a, 90 - a > 0 ? 90 - a : 0, a + b]), ar: `ثلاث زوايا متجاورة على مستقيم، قياس إحداها ${a}° والثانية ${b}°. ما قياس الثالثة؟`, en: `Three adjacent angles lie on a straight line. Two measure ${a}° and ${b}°. What does the third measure?` };
});

const TRI_SIDES = ['متساوي الأضلاع', 'متساوي الساقين', 'مختلف الأضلاع', 'لا يمكن رسم مثلث'];
const triBySides = T('triangle_sides', /^تصنيف المثلثات حسب اطوال اضلاعها$/, [5, 5], ({ rng, diff }) => {
  const m = span(diff, 9, 12, 16);
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
  const kind = pick(rng, [0, 1, 2, 0, 1, 2, 3]);
  let a = 0, b = 0, c = 0;
  if (kind === 0) { do { a = int(rng, 30, 85); b = int(rng, 30, 85); c = 180 - a - b; } while (c >= 90 || c <= 20); }
  else if (kind === 1) { a = 90; b = int(rng, 20, 70); c = 90 - b; }
  else if (kind === 2) { a = int(rng, 95, 150); b = int(rng, 10, Math.min(60, 175 - a)); c = 180 - a - b; }
  else { a = int(rng, 30, 90); b = int(rng, 30, 90); c = int(rng, 30, 90); if (a + b + c === 180) c += 7; }
  const angles = shuffle(rng, [a, b, c]);
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
const prismPyramid = T('prism_pyramid_parts', /^المنشور والهرم$/, [5, 5], ({ rng }) => {
  const [n, ar, en] = pick(rng, SHAPE_BASES);
  const prism = rng() < 0.5;
  const what = pick(rng, [0, 1, 2]);
  const f = prism ? n + 2 : n + 1, e = prism ? 3 * n : 2 * n, v = prism ? 2 * n : n + 1;
  const [ans, wr, arW, enW] = what === 0 ? [f, [e, v, f + 1, f - 1], 'أوجه', 'faces'] : what === 1 ? [e, [f, v, 2 * e, e + 1], 'أحرف', 'edges'] : [v, [f, e, v + 2, 2 * v], 'رؤوس', 'vertices'];
  return { eq: `${n}`, answer: String(ans), wrongs: pos(ans as number, wr as number[]), ar: `كم عدد ${arW} ${prism ? `منشور قاعدته ${ar}` : `هرم قاعدته ${ar}`}؟`, en: `How many ${enW} does a ${prism ? 'prism' : 'pyramid'} with a ${en} base have?` };
});

const symmetry = T('symmetry_lines', /^التماثل$/, [4, 4], ({ rng }) => {
  const shapes: Array<[string, string, number]> = [
    ['المثلث المتساوي الأضلاع', 'equilateral triangle', 3], ['المربع', 'square', 4], ['المستطيل غير المربع', 'non-square rectangle', 2],
    ['المثلث المتساوي الساقين غير المتساوي الأضلاع', 'isosceles triangle that is not equilateral', 1], ['الخماسي المنتظم', 'regular pentagon', 5], ['السداسي المنتظم', 'regular hexagon', 6],
  ];
  const [ar, en, k] = pick(rng, shapes);
  return { eq: ar, answer: String(k), wrongs: pos(k, [k + 1, k - 1, 2 * k, k + 2, 4]), ar: `كم محور تماثل في ${ar}؟`, en: `How many lines of symmetry does a ${en} have?` };
});

const complement = T('angle_relations', /^العلاقات بين الزوايا$/, [7, 7], ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 2] : [0, 1, 2, 3, 4]);
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
  const a = int(rng, 40, 140);
  const rel: Array<[string, string, number]> = [['متناظرتان', 'corresponding', a], ['متبادلتان داخليًا', 'alternate interior', a], ['متحالفتان (داخليتان على جهة واحدة من القاطع)', 'co-interior (same-side interior)', 180 - a], ['متبادلتان خارجيًا', 'alternate exterior', a]];
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
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2, 3]);
  const a = int(rng, 50, 130);
  if (k === 0) return { eq: `${a}`, answer: `${180 - a}°`, wrongs: deg(180 - a, [a, 90, 360 - a, 90 - a > 0 ? 90 - a : 0]), ar: `في متوازي الأضلاع ABCD قياس الزاوية A هو ${a}°. ما قياس الزاوية B؟`, en: `In parallelogram ABCD, angle A measures ${a}°. What does angle B measure?` };
  if (k === 1) return { eq: `${a}`, answer: `${a}°`, wrongs: deg(a, [180 - a, 90, 360 - a, 2 * a]), ar: `في متوازي الأضلاع ABCD قياس الزاوية A هو ${a}°. ما قياس الزاوية C؟`, en: `In parallelogram ABCD, angle A measures ${a}°. What does angle C measure?` };
  if (k === 2) { const d = 2 * int(rng, 4, 12); return { eq: `${d}`, answer: String(d / 2), wrongs: pos(d / 2, [d, 2 * d, d / 2 + 2, d - 2]), ar: `في متوازي الأضلاع ABCD يتقاطع القطران في النقطة O، وطول القطر AC يساوي ${d} سم. ما طول AO؟`, en: `In parallelogram ABCD the diagonals meet at O, and diagonal AC is ${d} cm long. What is AO?` }; }
  const l = int(rng, 4, 14), w = int(rng, 3, 12);
  return { eq: `${l}, ${w}`, answer: String(2 * (l + w)), wrongs: pos(2 * (l + w), [l + w, l * w, 2 * l + w, 4 * l]), ar: `في متوازي الأضلاع ABCD، AB = ${l} سم و BC = ${w} سم. ما محيطه؟`, en: `In parallelogram ABCD, AB = ${l} cm and BC = ${w} cm. What is its perimeter?` };
});

const parallelogramTest = T('parallelogram_test', /^تمييز متوازي الاضلاع$/, [8, 8], ({ rng, diff }) => {
  const x = int(rng, 3, 15), p = int(rng, 2, 5), q = int(rng, 1, p - 1);
  const c = int(rng, 1, 12), d = (p - q) * x + c;
  const angle = diff !== 'easy' && rng() < 0.4;
  if (angle) {
    const P = int(rng, 2, 4), Q = int(rng, 1, P - 1), c1 = int(rng, 2, 20), c2 = (P - Q) * x + c1;
    if (P * x + c1 >= 170 || Q * x >= 170) return parallelogramTest.make({ rng, diff, grade: 8 });
    return { eq: `${P}, ${c1}, ${Q}, ${c2}`, answer: String(x), wrongs: pos(x, [x + 3, x - 3, c2 - c1, P * x + c1]), ar: `ما قيمة x التي تجعل الشكل ABCD متوازي أضلاع إذا كان A = (${P}x + ${c1})° و C = (${Q}x + ${c2})°؟`.replace(`${Q}x + ${c2}`, `${Q === 1 ? '' : Q}x + ${c2}`).replace(`${P}x + ${c1}`, `${P}x + ${c1}`).replace('(' + (Q === 1 ? '' : String(Q)) + 'x + ' + c2 + ')', '(' + (Q === 1 ? '' : String(Q)) + 'x + ' + c2 + ')'), en: `For what x is ABCD a parallelogram if A = (${P}x + ${c1})° and C = (${Q === 1 ? '' : Q}x + ${c2})°?` };
  }
  return { eq: `${p}, ${c}, ${q}, ${d}`, answer: String(x), wrongs: pos(x, [x + 2, x - 2, d - c, (d + c) / (p + q) | 0]), ar: `ما قيمة x التي تجعل الشكل ABCD متوازي أضلاع إذا كان AB = ${p}x + ${c} و CD = ${q === 1 ? '' : q}x + ${d}؟`, en: `For what x is ABCD a parallelogram if AB = ${p}x + ${c} and CD = ${q === 1 ? '' : q}x + ${d}?` };
});

const specialParallelograms = T('parallelogram_special', /^حالات خاصه من متوازي الاضلاع$/, [8, 8], ({ rng, diff }) => {
  const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17]];
  const [a, b, c] = pick(rng, TRIPLES);
  const k = pick(rng, diff === 'easy' ? [0, 1] : [0, 1, 2]);
  if (k === 0) return { eq: `${2 * a}, ${2 * b}`, answer: String(2 * a * b), wrongs: pos(2 * a * b, [4 * a * b, a * b, 2 * (a + b), 4 * a * a + 4 * b * b > 0 ? 2 * c : 1]), ar: `قطرا معين طولاهما ${2 * a} سم و ${2 * b} سم. ما مساحته؟`, en: `A rhombus has diagonals ${2 * a} cm and ${2 * b} cm. What is its area?` };
  if (k === 1) return { eq: `${2 * a}, ${2 * b}`, answer: String(c), wrongs: pos(c, [a + b, 2 * c, a * b, c + 1]), ar: `قطرا معين طولاهما ${2 * a} سم و ${2 * b} سم. ما طول ضلعه؟`, en: `A rhombus has diagonals ${2 * a} cm and ${2 * b} cm. What is the length of its side?` };
  return { eq: `${a}, ${b}`, answer: String(c), wrongs: pos(c, [a + b, a * b, c + 2, c - 1]), ar: `مستطيل طوله ${b} سم وعرضه ${a} سم. ما طول قطره؟`, en: `A rectangle is ${b} cm long and ${a} cm wide. What is the length of its diagonal?` };
});

const parallelProof = T('parallel_proof', /^اثبات توازي المستقيمات وتعامدها$/, [8, 8], ({ rng, diff }) => {
  const x = int(rng, 4, 20), p = int(rng, 2, 6), q = int(rng, 1, p - 1);
  const c1 = int(rng, 1, 25), kind = pick(rng, [0, 1, 2]);
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

const similarity = T('similar_triangles', /^تشابه المثلثات$/, [8, 8], ({ rng, diff }) => {
  const a = int(rng, 2, 6), k = int(rng, 2, 5), c = int(rng, 2, span(diff, 8, 12, 15));
  const b = a * k, f = c * k;
  if (rng() < 0.7) return { eq: `${a}, ${b}, ${c}`, answer: String(f), wrongs: pos(f, [c + (b - a), c + k, (c * a) / b | 0, b * c]), ar: `المثلثان ABC و DEF متشابهان، AB = ${a} سم و DE = ${b} سم و BC = ${c} سم. ما طول EF؟`, en: `Triangles ABC and DEF are similar, with AB = ${a} cm, DE = ${b} cm and BC = ${c} cm. What is EF?` };
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
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[x - dx, y - dy], [x + dy, y + dx], [x + dx, y], [x, y + dy], [x - dx, y + dy]]), ar: `انسحبت النقطة ${pt(x, y)} بمقدار ${unitAr(Math.abs(dx))} إلى ${hDir} و ${unitAr(Math.abs(dy))} إلى ${vDir}. ما إحداثيات صورتها؟`, en: `The point ${pt(x, y)} is translated ${Math.abs(dx)} units ${hDirEn} and ${Math.abs(dy)} units ${vDirEn}. What are the coordinates of its image?` };
});

const reflectAxes = T('reflect_axes', /^الانعكاس في المستوي الاحداثي$/, [6, 6], ({ rng }) => {
  const x = (rng() < 0.5 ? -1 : 1) * int(rng, 1, 9), y = (rng() < 0.5 ? -1 : 1) * int(rng, 1, 9);
  const axis = pick(rng, [0, 1]);
  const ans: [number, number] = axis === 0 ? [x, -y] : [-x, y];
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [axis === 0 ? [-x, y] : [x, -y], [-x, -y], [y, x], [x, y]]), ar: `انعكاس النقطة ${pt(x, y)} حول المحور ${axis === 0 ? 'السيني (x)' : 'الصادي (y)'}. ما إحداثيات صورتها؟`, en: `Reflect the point ${pt(x, y)} in the ${axis === 0 ? 'x-axis' : 'y-axis'}. What are the coordinates of the image?` };
});

const QUADRANTS = ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'];
const coordPlane6 = T('coord_plane_g6', /^المستوي الاحداثي$/, [6, 6], ({ rng }) => {
  const q = pick(rng, [0, 1, 2, 3]);
  const x = (q === 0 || q === 3 ? 1 : -1) * int(rng, 1, 9), y = (q === 0 || q === 1 ? 1 : -1) * int(rng, 1, 9);
  return { eq: pt(x, y), answer: QUADRANTS[q]!, wrongs: QUADRANTS.filter((_, i) => i !== q), ar: `في أي ربع من المستوى الإحداثي تقع النقطة ${pt(x, y)}؟`, en: `In which quadrant of the coordinate plane is the point ${pt(x, y)}?` };
});
const coordPlane5 = T('coord_plane_g5', /^المستوي الاحداثي$/, [5, 5], ({ rng, diff }) => {
  const x = int(rng, 1, 9), y = int(rng, 1, 9);
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) return { eq: pt(x, y), answer: String(x), wrongs: pos(x, [y, x + 1, x * y, x + y]), ar: `ما الإحداثي السيني للنقطة (${x} ، ${y})؟`, en: `What is the x-coordinate of the point (${x}, ${y})?` };
  if (k === 1) return { eq: pt(x, y), answer: String(y), wrongs: pos(y, [x, y + 1, x * y, x + y]), ar: `ما الإحداثي الصادي للنقطة (${x} ، ${y})؟`, en: `What is the y-coordinate of the point (${x}, ${y})?` };
  const y2 = y + int(rng, 1, span(diff, 5, 7, 9));
  return { eq: `${pt(x, y)}, ${pt(x, y2)}`, answer: String(y2 - y), wrongs: pos(y2 - y, [y2 + y, y2, y + 1, y2 - y + 1]), ar: `ما المسافة بين النقطتين (${x} ، ${y}) و (${x} ، ${y2}) بالوحدات؟`, en: `What is the distance, in units, between the points (${x}, ${y}) and (${x}, ${y2})?` };
});

const rotate = T('rotate', /^الدوران$/, [7, 7], ({ rng }) => {
  const x = int(rng, -8, 8) || 3, y = int(rng, -8, 8) || -4;
  const k = pick(rng, [0, 1, 2]);
  const [ans, ar, en]: [[number, number], string, string] = k === 0 ? [[-y, x], '90° عكس اتجاه عقارب الساعة', '90° counterclockwise'] : k === 1 ? [[y, -x], '90° باتجاه عقارب الساعة', '90° clockwise'] : [[-x, -y], '180°', '180°'];
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[-x, -y], [x, -y], [-x, y], [y, x], [-y, -x], [y, -x], [-y, x]].filter(c => c[0] !== ans[0] || c[1] !== ans[1]) as Array<[number, number]>), ar: `دُوِّرت النقطة ${pt(x, y)} حول نقطة الأصل بزاوية ${ar}. ما إحداثيات صورتها؟`, en: `The point ${pt(x, y)} is rotated ${en} about the origin. What are the coordinates of its image?` };
});

const dilate = (id: string, match: RegExp, grade: number) => T(id, match, [grade, grade], ({ rng, diff }) => {
  const k = pick(rng, grade === 8 && diff !== 'easy' ? [2, 3, 0.5, 4] : [2, 3, 4]);
  const x0 = int(rng, -5, 6) || 2, y0 = int(rng, -5, 6) || 3;
  const [x, y] = k === 0.5 ? [2 * x0, 2 * y0] : [x0, y0];
  const ans: [number, number] = [x * k, y * k];
  const ks = k === 0.5 ? '1/2' : String(k);
  return { eq: pt(x, y), answer: pt(...ans), wrongs: ptOpts(ans, [[x + k, y + k], [x * k, y], [x, y * k], [x / k, y / k], [-x * k, -y * k]].filter(c => Number.isInteger(c[0]) && Number.isInteger(c[1]) && (c[0] !== ans[0] || c[1] !== ans[1])) as Array<[number, number]>), ar: `كُبِّرت النقطة ${pt(x, y)} بمعامل تمدد ${ks} ومركز التمدد نقطة الأصل. ما إحداثيات صورتها؟`.replace('كُبِّرت', k < 1 ? 'تمددت' : 'كُبِّرت'), en: `The point ${pt(x, y)} is dilated by scale factor ${ks} from the origin. What are the coordinates of its image?` };
});

// ─── Grade 9: coordinates, proportional parts, trigonometry ─────────────────

const distance = T('distance_plane', /^المسافه في المستوي الاحداثي$/, [9, 9], ({ rng, diff }) => {
  const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10]];
  const [a, b, c] = pick(rng, TRIPLES);
  const x1 = int(rng, -5, 5), y1 = int(rng, -5, 5);
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
  const line = `${A}x + ${B}y ${C < 0 ? '−' : '+'} ${Math.abs(C)} = 0`;
  return { eq: `${pt(x0, y0)}, ${line}`, answer: String(d), wrongs: pos(d, [d * N, d + 1, Math.abs(num) / (A + B) | 0, d * N / 2 | 0, d - 1]), ar: `ما بُعد النقطة ${pt(x0, y0)} عن المستقيم ${line}؟`, en: `What is the distance from the point ${pt(x0, y0)} to the line ${line}?` };
});

const proportionalParts = T('proportional_parts', /^الاجزاء المتناسبه في المثلثات$/, [9, 9], ({ rng, diff }) => {
  const a = int(rng, 2, 8), k = int(rng, 2, 4), c = int(rng, 2, span(diff, 6, 9, 12));
  const b = a * k, e = c * k;
  const which = rng() < 0.7;
  if (which) return { eq: `${a}, ${b}, ${c}`, answer: String(c * k), wrongs: pos(c * k, [a + b + c, b + c - a, c + k, (a * c) / b | 0, a * b]), ar: `في المثلث ABC، النقطة D على AB والنقطة E على AC وDE ∥ BC. إذا كان AD = ${a} سم و DB = ${b} سم و AE = ${c} سم، فما طول EC؟`, en: `In triangle ABC, D lies on AB and E on AC with DE ∥ BC. If AD = ${a} cm, DB = ${b} cm and AE = ${c} cm, what is EC?` };
  return { eq: `${a}, ${b}, ${e}`, answer: String(c), wrongs: pos(c, [e - 1, e + 1, a + b, (a * b) / e | 0, e - a]), ar: `في المثلث ABC، النقطة D على AB والنقطة E على AC وDE ∥ BC. إذا كان AD = ${a} سم و DB = ${b} سم و EC = ${e} سم، فما طول AE؟`, en: `In triangle ABC, D lies on AB and E on AC with DE ∥ BC. If AD = ${a} cm, DB = ${b} cm and EC = ${e} cm, what is AE?` };
});

const bisector = T('angle_bisector_thm', /^منصفات في المثلث$/, [9, 9], ({ rng, diff }) => {
  const a = int(rng, 2, 7), k = int(rng, 2, 4), bd = int(rng, 2, span(diff, 6, 9, 12));
  const b = a * k, dc = bd * k;
  return { eq: `${a}, ${b}, ${bd}`, answer: String(dc), wrongs: pos(dc, [bd + (b - a), a + b + bd, (a * bd) / b | 0, dc + 1]), ar: `في المثلث ABC، AD منصف للزاوية A ويقطع BC في D. إذا كان AB = ${a} سم و AC = ${b} سم و BD = ${bd} سم، فما طول DC؟`, en: `In triangle ABC, AD bisects angle A and meets BC at D. If AB = ${a} cm, AC = ${b} cm and BD = ${bd} cm, what is DC?` };
});

const medians = T('medians_centroid', /^القطع المتوسطه والارتفاعات في المثلث$/, [9, 9], ({ rng }) => {
  const m = 3 * int(rng, 2, 12);
  const k = rng() < 0.5;
  const ans = k ? (2 * m) / 3 : m / 3;
  return { eq: `${m}`, answer: String(ans), wrongs: pos(ans, [m / 2, m, k ? m / 3 : (2 * m) / 3, ans + 1, m - 1]), ar: `في المثلث ABC، القطعة المتوسطة من الرأس A طولها ${m} سم، ومركز المثلث G. ما طول ${k ? 'AG' : 'GD (حيث D منتصف BC)'}؟`, en: `In triangle ABC the median from vertex A is ${m} cm long, and G is the centroid. What is the length of ${k ? 'AG' : 'GD (where D is the midpoint of BC)'}?` };
});

const TRI9: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25]];
const trigRatios = T('trig_ratios', /^النسب المثلثيه$/, [9, 9], ({ rng }) => {
  const [a, b, c] = pick(rng, TRI9);
  const which = pick(rng, [0, 1, 2]);
  const [name, num, den] = which === 0 ? ['sin', a, c] : which === 1 ? ['cos', b, c] : ['tan', a, b];
  const ans = sfrac(num, den);
  const others = [sfrac(den, num), which === 0 ? sfrac(b, c) : which === 1 ? sfrac(a, c) : sfrac(b, a), which === 2 ? sfrac(a, c) : sfrac(a, b), sfrac(c, b)];
  return { eq: `${a}, ${b}, ${c}`, answer: ans, wrongs: wrongsFrom(ans, others, k => sfrac(num + Math.abs(k), den)), ar: `في المثلث ABC القائم الزاوية في C، BC = ${a} سم و AC = ${b} سم و AB = ${c} سم. ما قيمة ${name} A؟`, en: `In triangle ABC, right-angled at C, BC = ${a} cm, AC = ${b} cm and AB = ${c} cm. What is ${name} A?` };
});

const trigApplications = T('trig_applications', /^تطبيقات النسب المثلثيه$/, [9, 9], ({ rng }) => {
  const k = pick(rng, [0, 1, 2]);
  if (k === 0) { const c = 2 * int(rng, 2, 20); return { eq: `${c}`, answer: String(c / 2), wrongs: pos(c / 2, [c, 2 * c, c / 2 + 2, c - 2]), ar: `مثلث ABC قائم الزاوية في C، فيه A = 30° والوتر AB = ${c} سم. ما طول الضلع BC المقابل للزاوية A؟`, en: `Triangle ABC is right-angled at C with A = 30° and hypotenuse AB = ${c} cm. What is the side BC opposite A?` }; }
  if (k === 1) { const c = 2 * int(rng, 2, 20); return { eq: `${c}`, answer: String(c / 2), wrongs: pos(c / 2, [c, 2 * c, c / 2 + 2, c - 2]), ar: `مثلث ABC قائم الزاوية في C، فيه A = 60° والوتر AB = ${c} سم. ما طول الضلع AC المجاور للزاوية A؟`, en: `Triangle ABC is right-angled at C with A = 60° and hypotenuse AB = ${c} cm. What is the side AC adjacent to A?` }; }
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
const bearing = T('bearing', /^الاتجاه من الشمال/, [10, 10], ({ rng }) => {
  const b = int(rng, 10, 350);
  const back = b < 180 ? b + 180 : b - 180;
  return { eq: pad3(b), answer: `${pad3(back)}°`, wrongs: wrongsFrom(`${pad3(back)}°`, [`${pad3(b)}°`, `${pad3((b + 90) % 360)}°`, `${pad3((360 - b) % 360)}°`, `${pad3((b + 270) % 360)}°`], k => `${pad3((back + 10 * Math.abs(k)) % 360)}°`), ar: `اتجاه النقطة B من النقطة A هو ${pad3(b)}°. ما اتجاه A من B؟`, en: `The bearing of B from A is ${pad3(b)}°. What is the bearing of A from B?` };
});

const sineArea = T('sine_area', /^استعمال جيب الزاويه لايجاد مساحه المثلث$/, [10, 10], ({ rng }) => {
  const C = pick(rng, [30, 150, 90]);
  const a = int(rng, 4, 16), b = int(rng, 4, 16);
  const need = C === 90 ? (a * b) % 2 : (a * b) % 4;
  if (need) return sineArea.make({ rng, diff: 'easy', grade: 10 });
  const A = C === 90 ? (a * b) / 2 : (a * b) / 4;
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
const convertGen = (id: string, match: RegExp, sets: string[], grades: [number, number]) => T(id, match, grades, ({ rng, diff, grade }) => {
  const [bigAr, smallAr, bigEn, smallEn, f] = UNIT_SETS[pick(rng, sets)]!;
  const n = int(rng, 2, span(diff, 9, 25, 90));
  if (rng() < 0.5) return { eq: `${n}`, answer: String(n * f), wrongs: pos(n * f, [n * f * 10, (n * f) / 10, n + f, n * f / 100 | 0, n * 10]), ar: `حوّل ${n} ${bigAr} إلى ${smallAr}.`, en: `Convert ${n} ${bigEn} to ${smallEn}.` };
  const q = int(rng, 2, span(diff, 9, 25, 60));
  const small = q * f;
  void grade;
  return { eq: `${small}`, answer: String(q), wrongs: pos(q, [q * 10, small / 10, q * 100, q + 1, small]), ar: `حوّل ${small} ${smallAr} إلى ${bigAr}.`, en: `Convert ${small} ${smallEn} to ${bigEn}.` };
});

/** The lesson names the quantity — length, mass or capacity — and only that quantity's units appear. */
const unitsMixed = (id: string, match: RegExp, sets: string[]) => T(id, match, [4, 5], ({ rng, diff, grade }) => {
  const [bigAr, smallAr, bigEn, smallEn, f] = UNIT_SETS[pick(rng, sets)]!;
  const a = int(rng, 1, span(diff, 5, 9, 15)), b = int(rng, 1, f / 10 - 1) * (f >= 1000 ? 10 : 1);
  if (rng() < 0.4 && (diff !== 'easy' || grade === 5)) return { eq: `${a}, ${b}`, answer: String(a * f + b), wrongs: pos(a * f + b, [a + b, a * f * b, a * 10 + b, (a * f + b) * 10, a * f - b]), ar: `كم ${smallAr} في ${a} ${bigAr} و ${b} ${smallAr}؟`, en: `How many ${smallEn} are in ${a} ${bigEn} ${b} ${smallEn}?` };
  const n = int(rng, 2, span(diff, 9, 30, 90));
  return { eq: `${n}`, answer: String(n * f), wrongs: pos(n * f, [n * f * 10, (n * f) / 10, n + f, n * 10]), ar: `حوّل ${n} ${bigAr} إلى ${smallAr}.`, en: `Convert ${n} ${bigEn} to ${smallEn}.` };
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
const clockWords = T('time_words', /^قراءه الوقت/, [3, 3], ({ rng }) => {
  const h = int(rng, 1, 12);
  const forms: Array<[string, number]> = [['والنصف', 30], ['والربع', 15], ['إلا ربعًا', -15], ['وخمس دقائق', 5], ['وعشر دقائق', 10], ['إلا خمس دقائق', -5], ['إلا عشر دقائق', -10], ['وثلث', 20], ['إلا ثلثًا', -20]];
  const [word, off] = pick(rng, forms);
  const [h2, m2] = addMinutes(h, 0, off);
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
  congruence('congruence_a', /^تطابق المثلثات \(SSS SAS HL\)$/, ['SSS', 'SAS', 'HL']), congruence('congruence_b', /^تطابق المثلثات \(ASA AAS\)$/, ['ASA', 'AAS']),
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
