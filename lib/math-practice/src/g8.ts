/**
 * Four Grade 8 Semester 2 lessons that had no offline questions (found
 * 2026-11-13, every quiz / worksheet / homework on them threw
 * `NoQuestionBankError`):
 *
 *   - «رسم الأشكال ثلاثيّة الأبعاد»      (u8_l1)  g8_draw_3d
 *   - «المقاطع والمجسّمات الدّورانيّة»   (u8_l2)  g8_solids_revolution
 *   - «الرُّبَيعيّات»                    (u9_l1)  g8_quartiles
 *   - «اختيار التمثيل الأنسب»            (u9_l2)  g8_best_chart
 *
 * There is no extracted Grade 8 maths book, so each generator asks what the
 * lesson's NCCD objectives list (`iqra_curriculum_g8_math_sem2.json`), in kinds
 * that can be put in words: counts of squares in a view, the shape of a cross
 * section, the volume of a solid of revolution, a quartile, the chart that fits
 * a described data situation.
 *
 * Same contract as `geometry.ts`: the lesson TITLE picks the generator
 * (`[8, 8]` only, so a Grade 9 or 10 lesson with the same words is not
 * captured), every answer is computed from the numbers printed in its own
 * stem, and an item is never `verified` and carries no `check`. Maths stays in
 * latin digits and `x`; display converts.
 *
 * Quartile method (stated in every quartile stem): Q2 is the median; Q1 and Q3
 * are the medians of the lower and upper halves of the ordered data, and the
 * median itself is left out of both halves when the number of values is odd.
 */
import { int, pick, tamyiz, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
const T = (id: string, match: RegExp, make: Gen): Topic => ({ id, match, grades: [8, 8], make });

function shuffle<X>(rng: Rng, xs: readonly X[]): X[] {
  const a = xs.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = int(rng, 0, i); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}
/** Whole-number options that are never 0 or negative. */
const cnt = (ans: number, cands: number[]) =>
  wrongsFrom(String(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(String), k => String(ans + Math.abs(k)));
const PI = (k: number) => (k === 1 ? 'π' : `${k}π`);
const piOpts = (ans: number, cands: number[]) =>
  wrongsFrom(PI(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(PI), k => PI(ans + Math.abs(k)));
const degOpts = (ans: number, cands: number[]) =>
  wrongsFrom(`${ans}°`, cands.filter(c => Number.isInteger(c) && c > 0).map(c => `${c}°`), k => `${ans + Math.abs(k)}°`);
/** Three other names from a pool. */
const others = (rng: Rng, ans: string, pool: readonly string[]) => shuffle(rng, pool.filter(x => x !== ans)).slice(0, 3);
/** «5» or «5.5». */
const n1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));
const decOpts = (ans: number, cands: number[], step = 0.5) =>
  wrongsFrom(n1(ans), cands.filter(c => Number.isFinite(c) && c > 0).map(n1), k => n1(ans + Math.abs(k) * step));
const span = (diff: D, a: number, b: number, c: number) => (diff === 'easy' ? a : diff === 'medium' ? b : c);

// ─── u8_l1: drawing three-dimensional shapes ────────────────────────────────

const BASE_AR: Record<number, string> = { 3: 'مثلثية', 4: 'رباعية', 5: 'خماسية', 6: 'سداسية' };
const BASE_EN: Record<number, string> = { 3: 'triangular', 4: 'quadrilateral', 5: 'pentagonal', 6: 'hexagonal' };
const COLS_AR: Record<number, string> = { 3: 'ثلاثة', 4: 'أربعة' };

/** Projections a student can name without a picture: [solid, view, shape, three shapes that are not it]. */
const VIEWS: Array<[string, string, string, string, string, string[]]> = [
  ['أسطوانة قائمة موضوعة على إحدى قاعدتيها', 'a right cylinder standing on one base', 'العلوي', 'top', 'دائرة', ['مستطيل', 'مثلث', 'مربع']],
  ['أسطوانة قائمة موضوعة على إحدى قاعدتيها', 'a right cylinder standing on one base', 'الأمامي', 'front', 'مستطيل', ['دائرة', 'مثلث', 'نصف دائرة']],
  ['مخروط قائم موضوع على قاعدته', 'a right cone standing on its base', 'العلوي', 'top', 'دائرة', ['مثلث', 'مستطيل', 'مربع']],
  ['مخروط قائم موضوع على قاعدته', 'a right cone standing on its base', 'الأمامي', 'front', 'مثلث', ['دائرة', 'مستطيل', 'مربع']],
  ['كرة', 'a sphere', 'العلوي', 'top', 'دائرة', ['مثلث', 'مستطيل', 'مربع']],
  ['كرة', 'a sphere', 'الجانبي', 'side', 'دائرة', ['مثلث', 'مستطيل', 'مربع']],
  ['منشور ثلاثي قائم موضوع على إحدى قاعدتيه', 'a right triangular prism standing on one base', 'العلوي', 'top', 'مثلث', ['مستطيل', 'دائرة', 'مربع']],
  ['منشور ثلاثي قائم موضوع على إحدى قاعدتيه', 'a right triangular prism standing on one base', 'الأمامي', 'front', 'مستطيل', ['مثلث', 'دائرة', 'نصف دائرة']],
  ['هرم رباعي منتظم موضوع على قاعدته', 'a regular square pyramid standing on its base', 'الأمامي', 'front', 'مثلث', ['مربع', 'دائرة', 'مستطيل']],
  ['مكعب', 'a cube', 'العلوي', 'top', 'مربع', ['دائرة', 'مثلث', 'نصف دائرة']],
  ['متوازي مستطيلات أبعاده الثلاثة مختلفة', 'a cuboid whose three dimensions all differ', 'العلوي', 'top', 'مستطيل', ['دائرة', 'مثلث', 'نصف دائرة']],
  ['نصف كرة موضوعة على سطحها المستوي', 'a hemisphere resting on its flat face', 'العلوي', 'top', 'دائرة', ['نصف دائرة', 'مثلث', 'مستطيل']],
  ['نصف كرة موضوعة على سطحها المستوي', 'a hemisphere resting on its flat face', 'الأمامي', 'front', 'نصف دائرة', ['دائرة', 'مثلث', 'مستطيل']],
];

const draw3d = T('g8_draw_3d', /^رسم الاشكال ثلاثيه الابعاد$/, ({ rng, diff }) => {
  // 0 squares in a view of a cube stack, 1 the shape of a projection, 2 Euler's relation, 3 a net's pieces.
  const k = pick(rng, diff === 'easy' ? [0, 0, 1, 3] : [0, 0, 1, 2, 3]);

  if (k === 1) {
    const [solid, solidEn, view, viewEn, ans, wrongs] = pick(rng, VIEWS);
    return {
      eq: `view ${solid} ${view}`, answer: ans, wrongs,
      ar: `ما شكل المسقط ${view} ل${solid}؟`,
      en: `What is the shape of the ${viewEn} view of ${solidEn}?`,
    };
  }

  if (k === 2) {
    // a prism or a pyramid with an n-sided base; two of its three counts are given, Euler's V − E + F = 2 gives the third
    const n = int(rng, 3, 8), prism = rng() < 0.5;
    const F = prism ? n + 2 : n + 1, V = prism ? 2 * n : n + 1, E = prism ? 3 * n : 2 * n;
    const ask = pick(rng, ['E', 'F', 'V'] as const);
    const noun = {
      F: [tamyiz(F, 'أوجه', 'وجهًا', 'وجه'), 'faces'], V: [tamyiz(V, 'رؤوس', 'رأسًا', 'رأس'), 'vertices'], E: [tamyiz(E, 'أحرف', 'حرفًا', 'حرف'), 'edges'],
    } as const;
    const has = (c: 'E' | 'F' | 'V') => `${{ E, F, V }[c]} ${noun[c][0]}`;
    const hasEn = (c: 'E' | 'F' | 'V') => `${{ E, F, V }[c]} ${noun[c][1]}`;
    const given = (['F', 'V', 'E'] as const).filter(c => c !== ask);
    const ans = { E, F, V }[ask];
    const askAr = ask === 'E' ? 'كم حرفًا له؟' : ask === 'F' ? 'كم وجهًا له؟' : 'كم رأسًا له؟';
    const askEn = ask === 'E' ? 'How many edges does it have?' : ask === 'F' ? 'How many faces does it have?' : 'How many vertices does it have?';
    const [g1, g2] = given as [typeof ask, typeof ask];
    return {
      eq: `euler ${g1} ${{ E, F, V }[g1]} ${g2} ${{ E, F, V }[g2]}`, answer: String(ans),
      wrongs: cnt(ans, [{ E, F, V }[g1] + { E, F, V }[g2], Math.abs({ E, F, V }[g1] - { E, F, V }[g2]), ans + 2, ans - 2]),
      ar: `مجسّم متعدّد الأوجه له ${has(g1)} و${has(g2)}. بحسب علاقة أويلر (عدد الرؤوس − عدد الأحرف + عدد الأوجه = 2)، ${askAr}`,
      en: `A polyhedron has ${hasEn(g1)} and ${hasEn(g2)}. By Euler's relation (vertices − edges + faces = 2), ${askEn}`,
    };
  }

  if (k === 3) {
    const n = int(rng, 3, 6);
    const prism = rng() < 0.5;
    const solid = `${prism ? 'منشور' : 'هرم'} قاعدته ${BASE_AR[n]}`;
    const solidEn = `a ${prism ? 'prism' : 'pyramid'} with a ${BASE_EN[n]} base`;
    // the triangles of a pyramid's net: one per side of the base (a triangular base is a triangle too, so ask for the sides)
    if (!prism && n !== 3 && rng() < 0.5) {
      return {
        eq: `net triangles ${n}`, answer: String(n), wrongs: cnt(n, [n + 1, n - 1, n + 2, 2 * n]),
        ar: `كم مثلثًا جانبيًّا في شبكة ${solid}؟`, en: `How many triangular side faces are in the net of ${solidEn}?`,
      };
    }
    const total = prism ? n + 2 : n + 1;
    return {
      eq: `net ${prism ? 'prism' : 'pyramid'} ${n}`, answer: String(total), wrongs: cnt(total, [n, n + 1 + (prism ? 1 : -1), 2 * n, 2 * n + 2, n + 3]),
      ar: `كم شكلًا (مضلّعًا) في شبكة ${solid}، بما فيها القاعدة أو القاعدتان؟`,
      en: `How many polygons make up the net of ${solidEn}, bases included?`,
    };
  }

  // a stack of unit cubes drawn in isometric view: two rows (front, back) of `cols` columns, each with 0–3 cubes
  const cols = pick(rng, [3, 4]);
  let rows: number[][] = [];
  let top = 0, front = 0, side = 0, total = 0;
  for (let tries = 0; tries < 50; tries++) {
    rows = [0, 1].map(() => Array.from({ length: cols }, () => int(rng, 0, 3)));
    top = rows.flat().filter(h => h > 0).length;
    total = rows.flat().reduce((a, b) => a + b, 0);
    front = Array.from({ length: cols }, (_, c) => Math.max(rows[0]![c]!, rows[1]![c]!)).reduce((a, b) => a + b, 0);
    side = rows.map(r => Math.max(...r)).reduce((a, b) => a + b, 0);
    if (Math.min(top, front, side) >= 3 && new Set([top, front, side, total]).size >= 3) break;
  }
  const ask = pick(rng, ['top', 'front', 'side', 'total'] as const);
  const ans = { top, front, side, total }[ask];
  const askAr = ask === 'top' ? 'كم مربعًا يظهر في المسقط العلوي؟' : ask === 'front' ? 'كم مربعًا يظهر في المسقط الأمامي (بالنظر إلى المجسّم من جهة الصف الأمامي)؟' : ask === 'side' ? 'كم مربعًا يظهر في المسقط الجانبي (بالنظر إلى المجسّم من جانبه)؟' : 'كم مكعّبًا في المجسّم كله؟';
  const askEn = ask === 'top' ? 'How many squares appear in the top view?' : ask === 'front' ? 'How many squares appear in the front view (looking from the front row)?' : ask === 'side' ? 'How many squares appear in the side view?' : 'How many cubes are in the whole solid?';
  const r0 = rows[0]!.join(' ، '), r1 = rows[1]!.join(' ، ');
  return {
    eq: `stack ${r0} / ${r1} ${ask}`, answer: String(ans),
    wrongs: cnt(ans, [top, front, side, total, ans + 1, ans - 1].filter(v => v !== ans)),
    ar: `رُسم بالرسم المتساوي مجسّم من مكعّبات وحدة مبنيّة فوق شبكة مربّعات من صفّين و${COLS_AR[cols]} أعمدة. عدد المكعّبات فوق كل مربّع (الصفر يعني مربّعًا فارغًا) هو: الصف الأمامي: ${r0}؛ الصف الخلفي: ${r1}. ${askAr}`,
    en: `A solid of unit cubes is drawn in isometric view on a grid of two rows and ${cols} columns. The number of cubes on each square (0 means empty) is: front row: ${r0}; back row: ${r1}. ${askEn}`,
  };
});

// ─── u8_l2: cross-sections and solids of revolution ─────────────────────────

/** [plane figure, axis, solid, three solids that are not it] */
const ROTATIONS: Array<[string, string, string, string, string, string, string[]]> = [
  ['مستطيل', 'a rectangle', 'أحد أضلاعه', 'one of its sides', 'أسطوانة', 'a cylinder', ['مخروط', 'كرة', 'منشور']],
  ['مربع', 'a square', 'أحد أضلاعه', 'one of its sides', 'أسطوانة', 'a cylinder', ['مخروط', 'كرة', 'هرم']],
  ['مثلث قائم الزاوية', 'a right triangle', 'أحد ضلعيه القائمين', 'one of its legs', 'مخروط', 'a cone', ['أسطوانة', 'كرة', 'هرم']],
  ['مثلث متطابق الضلعين', 'an isosceles triangle', 'ارتفاعه المرسوم من الرأس إلى القاعدة', 'its altitude from the apex to the base', 'مخروط', 'a cone', ['أسطوانة', 'كرة', 'منشور']],
  ['نصف دائرة', 'a semicircle', 'قطره', 'its diameter', 'كرة', 'a sphere', ['أسطوانة', 'مخروط', 'نصف كرة']],
  ['دائرة', 'a circle', 'أحد أقطارها', 'one of its diameters', 'كرة', 'a sphere', ['أسطوانة', 'مخروط', 'نصف كرة']],
  ['شبه منحرف قائم الزاوية', 'a right trapezoid', 'الساق العمودية على القاعدتين', 'the leg perpendicular to the bases', 'مخروط ناقص', 'a truncated cone', ['مخروط', 'أسطوانة', 'كرة']],
];
const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15], [7, 24, 25], [12, 16, 20]];

/** Planes cutting a solid: [solid, plane, shape, three shapes that are not it]. */
const SECTIONS: Array<[string, string, string, string, string, string[]]> = [
  ['أسطوانة قائمة', 'a right cylinder', 'بمستوٍ يوازي قاعدتيها', 'by a plane parallel to its bases', 'دائرة', ['مستطيل', 'مثلث', 'شبه منحرف']],
  ['أسطوانة قائمة', 'a right cylinder', 'بمستوٍ رأسي يمرّ بمحورها', 'by a vertical plane through its axis', 'مستطيل', ['دائرة', 'مثلث', 'شبه منحرف']],
  ['مخروط قائم', 'a right cone', 'بمستوٍ يوازي قاعدته', 'by a plane parallel to its base', 'دائرة', ['مثلث', 'مستطيل', 'مربع']],
  ['مخروط قائم', 'a right cone', 'بمستوٍ رأسي يمرّ برأسه ومحوره', 'by a vertical plane through its apex and axis', 'مثلث', ['دائرة', 'مستطيل', 'شبه منحرف']],
  ['كرة', 'a sphere', 'بأي مستوٍ يقطعها', 'by any plane that cuts it', 'دائرة', ['مثلث', 'مستطيل', 'مربع']],
  ['مكعب', 'a cube', 'بمستوٍ يوازي أحد أوجهه', 'by a plane parallel to one of its faces', 'مربع', ['دائرة', 'مثلث', 'شبه منحرف']],
  ['متوازي مستطيلات أبعاده الثلاثة مختلفة', 'a cuboid whose three dimensions all differ', 'بمستوٍ يوازي أحد أوجهه', 'by a plane parallel to one of its faces', 'مستطيل', ['دائرة', 'مثلث', 'شبه منحرف']],
  ['هرم رباعي منتظم', 'a regular square pyramid', 'بمستوٍ يوازي قاعدته', 'by a plane parallel to its base', 'مربع', ['دائرة', 'مثلث', 'شبه منحرف']],
  ['هرم قاعدته مثلث', 'a pyramid with a triangular base', 'بمستوٍ يوازي قاعدته', 'by a plane parallel to its base', 'مثلث', ['دائرة', 'مربع', 'مستطيل']],
  ['منشور ثلاثي قائم', 'a right triangular prism', 'بمستوٍ يوازي قاعدتيه', 'by a plane parallel to its bases', 'مثلث', ['مستطيل', 'دائرة', 'مربع']],
  ['منشور ثلاثي قائم', 'a right triangular prism', 'بمستوٍ عمودي على القاعدتين وموازٍ لأحد وجهيه المستطيلين', 'by a plane perpendicular to the bases and parallel to one of its rectangular faces', 'مستطيل', ['مثلث', 'دائرة', 'شبه منحرف']],
];

const SYMMETRY_OPEN = 'عدد لا نهائي';

const solidsRevolution = T('g8_solids_revolution', /^المقاطع والمجسمات الدورانيه$/, ({ rng, diff }) => {
  // 0 the solid a figure makes, 1 a dimension or volume of a cylinder / cone, 2 a sphere, 3 a cross-section's shape,
  // 4 a cross-section's area, 5 planes of symmetry, 6 a prism with a compound base.
  const k = pick(rng, diff === 'easy' ? [0, 0, 1, 3, 5] : [0, 1, 1, 2, 3, 4, 5, 6]);

  if (k === 0) {
    const [fig, figEn, axis, axisEn, ans, , wrongs] = pick(rng, ROTATIONS);
    return {
      eq: `rotate ${fig} ${axis}`, answer: ans, wrongs,
      ar: `${fig === 'دائرة' ? 'تدور' : 'يدور'} ${fig} دورة كاملة حول ${axis}. ما اسم المجسّم الناتج؟`,
      en: `${figEn[0]!.toUpperCase()}${figEn.slice(1)} is rotated one full turn about ${axisEn}. What is the solid formed?`,
    };
  }

  if (k === 1) {
    if (rng() < 0.5) {
      // a rectangle a × b turned about its side b: a cylinder of radius a and height b
      let a = int(rng, 2, span(diff, 6, 8, 10)), b = int(rng, 2, span(diff, 8, 10, 12));
      if (a === b) b += 1;
      const ask = pick(rng, diff === 'easy' ? ['r', 'h', 'v'] : ['r', 'h', 'v', 'v', 's']);
      const stem = `يدور مستطيل بُعداه ${a} سم و${b} سم دورة كاملة حول الضلع الذي طوله ${b} سم.`;
      const stemEn = `A rectangle ${a} cm by ${b} cm is rotated one full turn about its side of length ${b} cm.`;
      if (ask === 'r') return { eq: `cyl r ${a} ${b}`, answer: String(a), wrongs: cnt(a, [b, 2 * a, a + b, a * b]), ar: `${stem} ما نصف قطر قاعدة المجسّم الناتج (سم)؟`, en: `${stemEn} What is the radius of the base of the solid formed (cm)?` };
      if (ask === 'h') return { eq: `cyl h ${a} ${b}`, answer: String(b), wrongs: cnt(b, [a, 2 * b, a + b, a * b]), ar: `${stem} ما ارتفاع المجسّم الناتج (سم)؟`, en: `${stemEn} What is the height of the solid formed (cm)?` };
      if (ask === 'v') return { eq: `cyl v ${a} ${b}`, answer: PI(a * a * b), wrongs: piOpts(a * a * b, [a * b * b, a * b, 2 * a * b, a * a * b * 2]), ar: `${stem} ما حجم المجسّم الناتج بدلالة π (سم³)؟`, en: `${stemEn} What is the volume of the solid formed in terms of π (cm³)?` };
      return { eq: `cyl s ${a} ${b}`, answer: PI(2 * a * (a + b)), wrongs: piOpts(2 * a * (a + b), [2 * a * b, a * (a + b), 2 * a * a, 2 * b * (a + b), a * a * b]), ar: `${stem} ما المساحة الكلية لسطح المجسّم الناتج بدلالة π (سم²)؟`, en: `${stemEn} What is the total surface area of the solid formed in terms of π (cm²)?` };
    }
    // a right triangle with legs a and b turned about the leg b: a cone of radius a, height b and slant height c
    const [p, q, c] = pick(rng, TRIPLES);
    const [a, b] = rng() < 0.5 ? [p, q] : [q, p];
    const ask = pick(rng, diff === 'easy' ? ['r', 'h', 'l'] : ['r', 'h', 'l', 'v', 'v', 's']);
    const stem = `يدور مثلث قائم الزاوية طولا ضلعيه القائمين ${a} سم و${b} سم دورة كاملة حول الضلع الذي طوله ${b} سم.`;
    const stemEn = `A right triangle with legs ${a} cm and ${b} cm is rotated one full turn about the leg of length ${b} cm.`;
    if (ask === 'r') return { eq: `cone r ${a} ${b}`, answer: String(a), wrongs: cnt(a, [b, c, a + b, 2 * a]), ar: `${stem} ما نصف قطر قاعدة المجسّم الناتج (سم)؟`, en: `${stemEn} What is the radius of the base of the solid formed (cm)?` };
    if (ask === 'h') return { eq: `cone h ${a} ${b}`, answer: String(b), wrongs: cnt(b, [a, c, a + b, 2 * b]), ar: `${stem} ما ارتفاع المجسّم الناتج (سم)؟`, en: `${stemEn} What is the height of the solid formed (cm)?` };
    if (ask === 'l') return { eq: `cone l ${a} ${b}`, answer: String(c), wrongs: cnt(c, [a + b, a * b, c + 1, c - 1, Math.abs(b - a)]), ar: `${stem} ما طول راسم المجسّم الناتج، أي الضلع المائل من سطحه الجانبي (سم)؟`, en: `${stemEn} What is the slant height of the solid formed (cm)?` };
    if (ask === 'v') {
      const v = (a * a * b) / 3;
      return { eq: `cone v ${a} ${b}`, answer: PI(v), wrongs: piOpts(v, [a * a * b, (a * b * b) / 3, a * b, 3 * v + a, (a * a * c) / 3]), ar: `${stem} ما حجم المجسّم الناتج بدلالة π (سم³)؟`, en: `${stemEn} What is the volume of the solid formed in terms of π (cm³)?` };
    }
    return { eq: `cone s ${a} ${b}`, answer: PI(a * (a + c)), wrongs: piOpts(a * (a + c), [a * c, a * a, a * (a + b), 2 * a * (a + c), a * (b + c)]), ar: `${stem} ما المساحة الكلية لسطح المجسّم الناتج بدلالة π (سم²)؟`, en: `${stemEn} What is the total surface area of the solid formed in terms of π (cm²)?` };
  }

  if (k === 2) {
    const volume = rng() < 0.5;
    if (volume) {
      const r = pick(rng, [3, 6, 9]), v = (4 * r * r * r) / 3;
      return { eq: `sphere v ${r}`, answer: PI(v), wrongs: piOpts(v, [(r * r * r) / 3, 4 * r * r, (2 * r * r * r) / 3, 4 * r * r * r, (4 * 2 * r * 2 * r * 2 * r) / 3]), ar: `يدور نصف دائرة نصف قطره ${r} سم دورة كاملة حول قطره. ما حجم المجسّم الناتج بدلالة π (سم³)؟`, en: `A semicircle of radius ${r} cm is rotated one full turn about its diameter. What is the volume of the solid formed in terms of π (cm³)?` };
    }
    const r = int(rng, 2, 10), s = 4 * r * r;
    return { eq: `sphere s ${r}`, answer: PI(s), wrongs: piOpts(s, [2 * r * r, r * r, (4 * r * r * r) / 3, 4 * r, 16 * r * r]), ar: `يدور نصف دائرة نصف قطره ${r} سم دورة كاملة حول قطره. ما مساحة سطح المجسّم الناتج بدلالة π (سم²)؟`, en: `A semicircle of radius ${r} cm is rotated one full turn about its diameter. What is the surface area of the solid formed in terms of π (cm²)?` };
  }

  if (k === 3) {
    const [solid, solidEn, plane, planeEn, ans, wrongs] = pick(rng, SECTIONS);
    return {
      eq: `section ${solid} ${plane}`, answer: ans, wrongs,
      ar: `ما شكل المقطع الناتج عند قطع ${solid} ${plane}؟`,
      en: `What shape is the cross-section when ${solidEn} is cut ${planeEn}?`,
    };
  }

  if (k === 4) {
    const r = int(rng, 2, span(diff, 6, 8, 10)), h = int(rng, r + 1, r + 8);
    const which = pick(rng, ['cylAxis', 'cylBase', 'coneAxis', 'sphere', 'cuboid'] as const);
    if (which === 'cylAxis') return { eq: `sec cylAxis ${r} ${h}`, answer: String(2 * r * h), wrongs: cnt(2 * r * h, [r * h, 4 * r * h, 2 * r + h, r * r * h, 2 * (r + h)]), ar: `أسطوانة قائمة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم، قُطعت بمستوٍ رأسي يمرّ بمحورها. ما مساحة المقطع الناتج (سم²)؟`, en: `A right cylinder has base radius ${r} cm and height ${h} cm. It is cut by a vertical plane through its axis. What is the area of the cross-section (cm²)?` };
    if (which === 'cylBase') return { eq: `sec cylBase ${r} ${h}`, answer: PI(r * r), wrongs: piOpts(r * r, [2 * r, r * r * h, r, 2 * r * r, r * h]), ar: `أسطوانة قائمة نصف قطر قاعدتها ${r} سم وارتفاعها ${h} سم، قُطعت بمستوٍ يوازي قاعدتيها. ما مساحة المقطع الناتج بدلالة π (سم²)؟`, en: `A right cylinder has base radius ${r} cm and height ${h} cm. It is cut by a plane parallel to its bases. What is the area of the cross-section in terms of π (cm²)?` };
    if (which === 'coneAxis') return { eq: `sec coneAxis ${r} ${h}`, answer: String(r * h), wrongs: cnt(r * h, [2 * r * h, r * r, (r * h) / 2, r + h, r * r * h]), ar: `مخروط قائم نصف قطر قاعدته ${r} سم وارتفاعه ${h} سم، قُطع بمستوٍ رأسي يمرّ برأسه ومحوره. ما مساحة المقطع الناتج (سم²)؟`, en: `A right cone has base radius ${r} cm and height ${h} cm. It is cut by a vertical plane through its apex and axis. What is the area of the cross-section (cm²)?` };
    if (which === 'sphere') return { eq: `sec sphere ${r}`, answer: PI(r * r), wrongs: piOpts(r * r, [4 * r * r, 2 * r, 2 * r * r, (4 * r * r * r) / 3, r]), ar: `كرة نصف قطرها ${r} سم، قُطعت بمستوٍ يمرّ بمركزها. ما مساحة المقطع الناتج بدلالة π (سم²)؟`, en: `A sphere has radius ${r} cm and is cut by a plane through its centre. What is the area of the cross-section in terms of π (cm²)?` };
    const a = int(rng, 2, 6), b = a + int(rng, 1, 4), c = b + int(rng, 1, 4);
    return { eq: `sec cuboid ${a} ${b} ${c}`, answer: String(a * c), wrongs: cnt(a * c, [a * b, b * c, a * b * c, 2 * (a + c), a + c]), ar: `متوازي مستطيلات أبعاده ${a} سم و${b} سم و${c} سم، قُطع بمستوٍ يوازي الوجه الذي بعداه ${a} سم و${c} سم. ما مساحة المقطع الناتج (سم²)؟`, en: `A cuboid measures ${a} cm by ${b} cm by ${c} cm. It is cut by a plane parallel to the face measuring ${a} cm by ${c} cm. What is the area of the cross-section (cm²)?` };
  }

  if (k === 5) {
    // planes of symmetry: [solid, english, count or null for «unlimited»]
    const n = pick(rng, [3, 5, 6]), m = pick(rng, [4, 5, 6]);
    const regAr: Record<number, string> = { 3: 'مثلث متطابق الأضلاع', 4: 'مربع', 5: 'مخمّس منتظم', 6: 'مسدّس منتظم' };
    const rows: Array<[string, string, number | null]> = [
      ['متوازي مستطيلات أبعاده الثلاثة مختلفة', 'a cuboid whose three dimensions all differ', 3],
      ['مكعب', 'a cube', 9],
      ['منشور رباعي قائم قاعدته مربعة وارتفاعه يخالف طول ضلع القاعدة', 'a right square prism whose height differs from the side of its base', 5],
      [`منشور قائم قاعدته ${regAr[n]}`, `a right prism whose base is a regular ${n}-sided polygon`, n + 1],
      [`هرم قاعدته ${regAr[m]} ورأسه فوق مركز القاعدة تمامًا`, `a pyramid whose base is a regular ${m}-sided polygon, with its apex directly above the centre`, m],
      ['رباعي أوجه منتظم (أوجهه الأربعة مثلثات متطابقة الأضلاع)', 'a regular tetrahedron', 6],
      ['أسطوانة قائمة', 'a right cylinder', null],
      ['مخروط قائم', 'a right cone', null],
      ['كرة', 'a sphere', null],
    ];
    const [solid, solidEn, planes] = pick(rng, rows);
    const ans = planes === null ? SYMMETRY_OPEN : String(planes);
    const wrongs = others(rng, ans, [1, 2, 3, 4, 5, 6, 7, 9, 12].map(String).concat(planes === null ? [] : [SYMMETRY_OPEN]));
    return {
      eq: `symmetry ${solid}`, answer: ans, wrongs,
      ar: `كم مستوى تماثل ل${solid}؟`,
      en: `How many planes of symmetry does ${solidEn} have?`,
    };
  }

  // a prism with a compound base: volume = base area × height
  const h = int(rng, 3, span(diff, 8, 10, 12));
  if (rng() < 0.5) {
    // a rectangle L × W with a rectangle c × d cut from one corner
    const L = int(rng, 6, 12), W = int(rng, 5, 10), c = int(rng, 2, L - 3), d = int(rng, 2, W - 2);
    const base = L * W - c * d;
    return { eq: `prism cut ${L} ${W} ${c} ${d} ${h}`, answer: String(base * h), wrongs: cnt(base * h, [L * W * h, c * d * h, (L * W + c * d) * h, base, (L + W) * h * 2]), ar: `قاعدة منشور قائم مستطيل بُعداه ${L} سم و${W} سم قُصَّ من إحدى زواياه مستطيل بُعداه ${c} سم و${d} سم، وارتفاع المنشور ${h} سم. ما حجمه (سم³)؟`, en: `The base of a right prism is a ${L} cm by ${W} cm rectangle with a ${c} cm by ${d} cm rectangle cut from one corner. The prism is ${h} cm high. What is its volume (cm³)?` };
  }
  const a = int(rng, 3, 9), b = int(rng, 2, 6), c = int(rng, 2, 7), d = int(rng, 2, 6);
  const base = a * b + c * d;
  return { eq: `prism join ${a} ${b} ${c} ${d} ${h}`, answer: String(base * h), wrongs: cnt(base * h, [a * b * h, c * d * h, a * b * c * d * h, base, (a + b + c + d) * h]), ar: `قاعدة منشور قائم مركّبة من مستطيلين متجاورين لا يتداخلان، بُعدا الأول ${a} سم و${b} سم وبُعدا الثاني ${c} سم و${d} سم، وارتفاع المنشور ${h} سم. ما حجمه (سم³)؟`, en: `The base of a right prism is made of two adjacent, non-overlapping rectangles, one ${a} cm by ${b} cm and the other ${c} cm by ${d} cm. The prism is ${h} cm high. What is its volume (cm³)?` };
});

// ─── u9_l1: quartiles ───────────────────────────────────────────────────────

const ascending = (xs: number[]) => xs.slice().sort((a, b) => a - b);
const medianOf = (s: number[]) => { const m = s.length >> 1; return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2; };
/** Q1 and Q3 as the medians of the lower and upper halves; the median is left out of both when n is odd. */
function quartiles(xs: number[]) {
  const s = ascending(xs), h = s.length >> 1;
  return { s, q1: medianOf(s.slice(0, h)), q2: medianOf(s), q3: medianOf(s.slice(s.length % 2 ? h + 1 : h)) };
}
const METHOD_AR = '(الربيع الأول والربيع الثالث هما وسيطا النصفين الأدنى والأعلى للقيم المرتّبة، ويُستبعد الوسيط من النصفين إذا كان عدد القيم فرديًا)';
const METHOD_EN = '(Q1 and Q3 are the medians of the lower and upper halves of the ordered data; the median is left out of both halves when the number of values is odd)';
const joinAr = (xs: number[]) => xs.join(' ، ');
const joinEn = (xs: number[]) => xs.join(', ');

const quartilesTopic = T('g8_quartiles', /^الربيعيات$/, ({ rng, diff }) => {
  // 0 Q1, 1 Q3, 2 the interquartile range, 3 the outlier, 4 a five-number summary, 5 which of two sets is more spread out.
  const k = pick(rng, diff === 'easy' ? [0, 1, 2, 4] : [0, 1, 2, 2, 3, 4, 5]);

  if (k === 4) {
    const lo = int(rng, 1, 20), q1 = lo + int(rng, 2, 12), med = q1 + int(rng, 2, 10), q3 = med + int(rng, 2, 12), hi = q3 + int(rng, 3, 15);
    const ask = pick(rng, ['iqr', 'range', 'share'] as const);
    const sum = `أصغر قيمة ${lo}، والربيع الأول ${q1}، والوسيط ${med}، والربيع الثالث ${q3}، وأكبر قيمة ${hi}`;
    const sumEn = `smallest value ${lo}, Q1 ${q1}, median ${med}, Q3 ${q3}, largest value ${hi}`;
    if (ask === 'share') {
      return { eq: `box share ${lo} ${q1} ${med} ${q3} ${hi}`, answer: '50%', wrongs: ['25%', '75%', '100%'], ar: `في الصندوق ذي العارضتين لمجموعة من البيانات: ${sum}. ما النسبة المئوية للبيانات التي تقع داخل الصندوق، أي بين الربيع الأول والربيع الثالث؟`, en: `A box plot has ${sumEn}. What percentage of the data lies inside the box, between Q1 and Q3?` };
    }
    const ans = ask === 'iqr' ? q3 - q1 : hi - lo;
    return {
      eq: `box ${ask} ${lo} ${q1} ${med} ${q3} ${hi}`, answer: String(ans),
      wrongs: cnt(ans, ask === 'iqr' ? [hi - lo, q3 - med, med - q1, q3, hi - q3 + (q1 - lo)] : [q3 - q1, hi - q3, q1 - lo, hi, hi - med]),
      ar: `في الصندوق ذي العارضتين لمجموعة من البيانات: ${sum}. ما ${ask === 'iqr' ? 'المدى الربيعي' : 'المدى'}؟`,
      en: `A box plot has ${sumEn}. What is the ${ask === 'iqr' ? 'interquartile range' : 'range'}?`,
    };
  }

  if (k === 5) {
    const a1 = int(rng, 40, 65), ia = int(rng, 6, 20), b1 = int(rng, 40, 65);
    let ib = int(rng, 6, 20);
    if (ib === ia) ib += 3;
    const aWider = ia > ib, ans = aWider ? 'الصف أ' : 'الصف ب';
    return {
      eq: `spread ${a1} ${ia} ${b1} ${ib}`, answer: ans, wrongs: ['متساويان في التشتّت', aWider ? 'الصف ب' : 'الصف أ', 'لا يمكن المقارنة بينهما'],
      ar: `في اختبار واحد، كان الربيع الأول لعلامات الصف أ ${a1} والربيع الثالث ${a1 + ia}، وكان الربيع الأول لعلامات الصف ب ${b1} والربيع الثالث ${b1 + ib}. أيّ الصفين علاماته أكثر تشتّتًا بحسب المدى الربيعي؟`,
      en: `On the same test, class A has Q1 = ${a1} and Q3 = ${a1 + ia}, and class B has Q1 = ${b1} and Q3 = ${b1 + ib}. Which class's marks are more spread out by the interquartile range?`,
    };
  }

  const n = pick(rng, diff === 'easy' ? [8, 9, 10, 11] : [8, 9, 10, 11, 12, 13]);

  if (k === 3) {
    // one value outside [Q1 − 1.5·IQR, Q3 + 1.5·IQR] and every other value inside
    for (let tries = 0; tries < 200; tries++) {
      const centre = int(rng, 20, 45);
      const xs = Array.from({ length: n - 1 }, () => centre + int(rng, -8, 8));
      xs.push(rng() < 0.7 ? centre + int(rng, 30, 60) : Math.max(1, centre - int(rng, 28, 40)));
      const { s, q1, q3 } = quartiles(xs), iqr = q3 - q1;
      const out = s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
      if (out.length !== 1) continue;
      const inside = [...new Set(s.filter(v => v !== out[0]))];
      if (inside.length < 4) continue;
      const shown = shuffle(rng, xs);
      const wrongs = shuffle(rng, [...new Set([s[0] === out[0] ? s[1]! : s[0]!, s[s.length - 1] === out[0] ? s[s.length - 2]! : s[s.length - 1]!, medianOf(s), q1, q3].filter(v => v !== out[0] && Number.isInteger(v)))]).map(String);
      if (new Set(wrongs).size < 3) continue;
      return {
        eq: `outlier ${joinEn(shown)}`, answer: String(out[0]), wrongs: wrongs.slice(0, 3),
        ar: `تُعدّ القيمة متطرّفة إذا كانت أصغر من (الربيع الأول − 1.5 × المدى الربيعي) أو أكبر من (الربيع الثالث + 1.5 × المدى الربيعي). ما القيمة المتطرّفة في البيانات: ${joinAr(shown)}؟ ${METHOD_AR}`,
        en: `A value is an outlier if it is below (Q1 − 1.5 × IQR) or above (Q3 + 1.5 × IQR). Which value is the outlier in ${joinEn(shown)}? ${METHOD_EN}`,
      };
    }
    return quartilesTopic.make({ rng, diff, grade: 8 });
  }

  // Q1, Q3 or the interquartile range of n listed values
  let xs: number[] = [];
  let r = quartiles([0, 1]);
  for (let tries = 0; tries < 50; tries++) {
    xs = Array.from({ length: n }, () => int(rng, 4, 60));
    r = quartiles(xs);
    if (r.q3 > r.q1 && new Set(xs).size >= n - 2) break;
  }
  const shown = diff === 'easy' ? r.s : shuffle(rng, xs);
  const { s, q1, q2, q3 } = r;
  // what a student gets by keeping the median in both halves when n is odd, or by using a position instead of a median
  const h = s.length >> 1;
  const keepQ1 = medianOf(s.slice(0, h + (s.length % 2)));
  const keepQ3 = medianOf(s.slice(h));
  const ask = k === 0 ? 'q1' : k === 1 ? 'q3' : 'iqr';
  const ans = ask === 'q1' ? q1 : ask === 'q3' ? q3 : q3 - q1;
  const cands = ask === 'q1' ? [q2, keepQ1, s[Math.floor(n / 4)]!, s[0]!, q3] : ask === 'q3' ? [q2, keepQ3, s[Math.ceil((3 * n) / 4) - 1]!, s[n - 1]!, q1] : [s[n - 1]! - s[0]!, keepQ3 - keepQ1, q3 - q2, q2 - q1, q3];
  const what = ask === 'q1' ? ['الربيع الأول Q1', 'the lower quartile Q1'] : ask === 'q3' ? ['الربيع الثالث Q3', 'the upper quartile Q3'] : ['المدى الربيعي', 'the interquartile range'];
  return {
    eq: `${ask} ${joinEn(shown)}`, answer: n1(ans), wrongs: decOpts(ans, cands.filter(v => v !== ans)),
    ar: `ما ${what[0]} للقيم الآتية: ${joinAr(shown)}؟ ${METHOD_AR}`,
    en: `What is ${what[1]} of ${joinEn(shown)}? ${METHOD_EN}`,
  };
});

// ─── u9_l2: choosing the best representation ────────────────────────────────

const CHART = { bar: 'التمثيل بالأعمدة', pie: 'التمثيل بالقطاعات الدائرية', line: 'التمثيل بالخط', hist: 'المدرّج التكراري', box: 'الصندوق ذو العارضتين' } as const;
type ChartKey = keyof typeof CHART;
const CHARTS = Object.keys(CHART) as ChartKey[];

const GROUPS: Array<{ ask: string; askEn: string; cats: string[]; catsEn: string[] }> = [
  { ask: 'مادتهم الدراسية المفضّلة', askEn: 'their favourite school subject', cats: ['الرياضيات', 'العلوم', 'اللغة العربية', 'التربية الرياضية'], catsEn: ['mathematics', 'science', 'Arabic', 'sport'] },
  { ask: 'الفاكهة المفضّلة لديهم', askEn: 'their favourite fruit', cats: ['التفاح', 'الموز', 'البرتقال', 'العنب'], catsEn: ['apples', 'bananas', 'oranges', 'grapes'] },
  { ask: 'وسيلة وصولهم إلى المدرسة', askEn: 'how they get to school', cats: ['الحافلة', 'السيارة', 'الدرّاجة', 'المشي'], catsEn: ['bus', 'car', 'bicycle', 'walking'] },
  { ask: 'نوع الرياضة التي يفضّلونها', askEn: 'the sport they prefer', cats: ['كرة القدم', 'كرة السلة', 'السباحة', 'الجري'], catsEn: ['football', 'basketball', 'swimming', 'running'] },
];
const OVER_TIME: Array<[string, string]> = [
  ['درجة الحرارة العظمى في مدينة، مسجّلة في أول كل شهر من السنة', 'the highest temperature in a city, recorded on the first day of each month of the year'],
  ['عدد زوّار مكتبة المدرسة في كل شهر من العام الدراسي', 'the number of visitors to the school library in each month of the school year'],
  ['ارتفاع نبتة، مقيسًا في نهاية كل أسبوع منذ زراعتها', 'the height of a plant, measured at the end of each week since it was planted'],
];
const SPREAD: Array<[string, string]> = [
  ['علامات طلبة صفّين (أ و ب) في الاختبار نفسه', "two classes' marks (A and B) on the same test"],
  ['أزمنة سباق الجري لفريقين في المدرسة', 'race times of two school teams'],
  ['كتل حقائب طلبة صفّين دراسيين', 'the masses of the school bags of two classes'],
];
const BINNED: Array<[string, string]> = [
  ['الأطوال بالسنتيمتر', 'heights in centimetres'],
  ['أزمنة الجري لمسافة 100 م بالثواني', 'times for a 100 m run in seconds'],
  ['العلامات في اختبار من 100', 'marks on a test out of 100'],
];
const QUALITATIVE = ['لون العينين', 'نوع الفاكهة المفضّلة', 'المدينة التي يسكن فيها الطالب', 'المادة الدراسية المفضّلة', 'لون السيارة', 'الهواية المفضّلة'];
const NUMERICAL = ['عدد الإخوة', 'طول الطالب بالسنتيمتر', 'علامة الطالب في اختبار', 'عمر الطالب بالسنوات', 'كتلة حقيبة الطالب بالكيلوغرام', 'عدد الكتب في مكتبة البيت'];

const bestChart = T('g8_best_chart', /^اختيار التمثيل الانسب$/, ({ rng, diff }) => {
  // 0 the chart that fits a described situation, 1 qualitative vs numerical data, 2 a pie chart's count,
  // 3 a pie chart's angle, 4 the biggest rise on a line graph.
  const k = pick(rng, diff === 'easy' ? [0, 0, 1, 2] : [0, 0, 0, 1, 2, 3, 4]);

  if (k === 0) {
    const want = pick(rng, CHARTS);
    const N = int(rng, 31, 99);
    const students = `${N} طالبًا`;
    let ar = '', en = '';
    if (want === 'bar' || want === 'pie') {
      const g = pick(rng, GROUPS);
      ar = `سُئل ${students} عن ${g.ask}، فكانت الإجابات: ${g.cats.join(' ، ')}. ${want === 'bar' ? 'يريد المعلّم المقارنة بين أعداد الطلبة في كل إجابة.' : 'يريد المعلّم إظهار ما تشكّله كل إجابة من مجموع الإجابات، أي كجزء من الكل.'}`;
      en = `${N} students were asked about ${g.askEn}; the answers were ${g.catsEn.join(', ')}. ${want === 'bar' ? 'The teacher wants to compare the number of students for each answer.' : 'The teacher wants to show what part of all the answers each one makes up.'}`;
    } else if (want === 'line') {
      const [what, whatEn] = pick(rng, OVER_TIME);
      ar = `لدى طالب جدول يبيّن ${what}. يريد الطالب إظهار كيف تغيّرت هذه القيم مع مرور الزمن.`;
      en = `A student has a table showing ${whatEn}. The student wants to show how the values changed over time.`;
    } else if (want === 'hist') {
      const [what, whatEn] = pick(rng, BINNED);
      ar = `جُمعت بيانات ${what} لدى ${students}، ويريد المعلّم عرض هذه البيانات العددية بعد تنظيمها في فئات متساوية الطول ليرى كيف تتوزّع القيم على الفئات.`;
      en = `Data on ${whatEn} were collected from ${N} students. The teacher wants to show these numerical data grouped in classes of equal width to see how the values are distributed over the classes.`;
    } else {
      const [what, whatEn] = pick(rng, SPREAD);
      ar = `لدينا ${what}. يريد المعلّم المقارنة بين وسيطَي المجموعتين ومدى انتشار النصف الأوسط من القيم في كل منهما.`;
      en = `We have ${whatEn}. The teacher wants to compare the two medians and how widely the middle half of the values is spread in each.`;
    }
    const ans = CHART[want];
    return {
      eq: `chart ${want} ${ar.length}`, answer: ans, wrongs: others(rng, ans, CHARTS.map(c => CHART[c])),
      ar: `${ar} ما التمثيل الأنسب لهذه البيانات؟`,
      en: `${en} Which representation suits these data best?`,
    };
  }

  if (k === 1) {
    const qual = rng() < 0.5;
    const right = pick(rng, qual ? QUALITATIVE : NUMERICAL);
    const wrongs = shuffle(rng, qual ? NUMERICAL : QUALITATIVE).slice(0, 3);
    const opts = shuffle(rng, [right, ...wrongs]).join(' ، ');
    return {
      eq: `type ${qual ? 'qual' : 'num'} ${right}`, answer: right, wrongs,
      ar: `أيّ مما يأتي يمثّل بيانات ${qual ? 'نوعية' : 'عددية'}: ${opts}؟`,
      en: `Which of these is ${qual ? 'qualitative' : 'numerical'} data: ${opts}?`,
    };
  }

  if (k === 2 || k === 3) {
    const g = pick(rng, GROUPS);
    const cat = int(rng, 0, g.cats.length - 1);
    const total = pick(rng, [40, 60, 80, 100, 120, 200]);
    const pct = pick(rng, [10, 15, 20, 25, 30, 40, 45, 50, 60]);
    if (k === 2) {
      const n = (total * pct) / 100;
      return {
        eq: `pie count ${total} ${pct}`, answer: String(n), wrongs: cnt(n, [pct, total - n, 100 - pct, n + 5, (total * (100 - pct)) / 100].filter(v => v !== n)),
        ar: `في تمثيل بالقطاعات الدائرية لإجابات ${total} طالبًا عن ${g.ask}، شكّلت إجابة «${g.cats[cat]}» ${pct}% من المجموع. كم طالبًا اختاروا هذه الإجابة؟`,
        en: `In a pie chart of the answers of ${total} students about ${g.askEn}, the answer “${g.catsEn[cat]}” makes up ${pct}% of the total. How many students gave that answer?`,
      };
    }
    const ang = (360 * pct) / 100;
    return {
      eq: `pie angle ${pct}`, answer: `${ang}°`, wrongs: degOpts(ang, [pct, 180 * pct / 100 | 0, 3 * pct, 90 - (pct % 90), 360 - ang]),
      ar: `في تمثيل بالقطاعات الدائرية لإجابات طلبة عن ${g.ask}، شكّلت إجابة «${g.cats[cat]}» ${pct}% من المجموع. ما قياس الزاوية المركزية للقطاع الذي يمثّلها؟`,
      en: `In a pie chart of students' answers about ${g.askEn}, the answer “${g.catsEn[cat]}” makes up ${pct}% of the total. What is the central angle of its sector?`,
    };
  }

  // the biggest rise on a line graph: five yearly values, the four changes between them, one largest
  for (;;) {
    const y0 = int(rng, 2018, 2021);
    const vals = [int(rng, 5, 12) * 10];
    for (let i = 1; i < 5; i++) vals.push(Math.max(10, vals[i - 1]! + int(rng, -4, 9) * 10));
    const rises = vals.slice(1).map((v, i) => v - vals[i]!);
    const top = Math.max(...rises);
    if (top <= 0 || rises.filter(r => r === top).length !== 1) continue;
    const period = (i: number) => `من ${y0 + i} إلى ${y0 + i + 1}`;
    const at = rises.indexOf(top);
    const table = vals.map((v, i) => `${y0 + i}: ${v}`).join('، ');
    const tableEn = vals.map((v, i) => `${y0 + i}: ${v}`).join(', ');
    return {
      eq: `line ${table}`, answer: period(at), wrongs: rises.map((_, i) => period(i)).filter((_, i) => i !== at),
      ar: `يبيّن التمثيل بالخط عدد زوّار معرض في خمسة أعوام متتالية (العام: عدد الزوّار بالمئات): ${table}. في أيّ فترة كانت أكبر زيادة في عدد الزوّار؟`,
      en: `A line graph shows the visitors to an exhibition over five consecutive years (year: visitors in hundreds): ${tableEn}. In which period was the increase largest?`,
    };
  }
});

export const G8_TOPICS: readonly Topic[] = [draw3d, solidsRevolution, quartilesTopic, bestChart];
