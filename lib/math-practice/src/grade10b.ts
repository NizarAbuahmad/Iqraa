/**
 * Grade 10 maths lessons the first batch (`grade10.ts`) left on a shared bank family,
 * measured 2026-11-14 with the real KB lesson through `takeConcreteMath`:
 *
 *   • «الأقواس والقطاعات الدائرية» got `circle` — 5 items, two of them circle equations;
 *   • «تركيب الاقترانات» and «الاقتران العكسي» shared `functions` — 5 items, «f(3)» and an
 *     arithmetic sequence among them;
 *   • «المتتاليات» got 7 items of sums and geometric terms the book does not teach;
 *   • the derivatives unit's four lessons shared `derivative`'s nine fixed items;
 *   • the three vector lessons shared `vectors`' five, the dot product in the first;
 *   • the probability lessons got `stats` — a median, a mean, a die;
 *   • the scatter-plot lab («معمل برمجية جيوجبرا», u8) got linear–quadratic systems.
 *
 * One generator per lesson, asking what its student-book pages ask (S1 pp.41–46; S2 pp.25–49,
 * 54–75, 80–101, 115–116, 131–147). Same contract as `grade10.ts`: the lesson title picks the
 * generator, Grade 10 only, every answer is computed from the numbers in its own stem, and
 * nothing here is `verified`.
 */
import { STATS_TOPICS } from './stats.ts';
import { gcd, int, nz, pick, sfrac, signed, sup, wrongsFrom, type Draft, type Rng, type Topic } from './topicKit.ts';

type D = 'easy' | 'medium' | 'hard';
type Gen = (c: { rng: Rng; diff: D; grade: number }) => Draft;
/** `eq` is the item's dedupe key; it carries the real minus sign like every other field. */
const T = (id: string, match: RegExp, make: Gen): Topic => ({
  id, match, grades: [10, 10],
  make: c => { const d = make(c as { rng: Rng; diff: D; grade: number }); return { ...d, eq: d.eq.replace(/-(?=\d)/g, '−') }; },
});

/** Whole-number options above zero. */
const pos = (ans: number, cands: number[]) =>
  wrongsFrom(String(ans), cands.filter(c => Number.isInteger(c) && c > 0).map(String), k => (ans + Math.abs(k) > 0 ? String(ans + Math.abs(k)) : ''));
/** Signed whole-number options. */
const sgn = (ans: number, cands: number[]) =>
  wrongsFrom(signed(ans), cands.filter(Number.isInteger).map(signed), k => signed(ans + k));
/** Probabilities in hundredths, printed «0.35». */
const pr = (h: number) => {
  const s = (h / 100).toFixed(2).replace(/0$/, '');
  return s.endsWith('.') ? s.slice(0, -1) : s;
};
const prOpts = (ans: number, cands: number[]) =>
  wrongsFrom(pr(ans), cands.filter(c => Number.isInteger(c) && c > 0 && c < 100).map(pr), k => (ans + 5 * k > 0 && ans + 5 * k < 100 ? pr(ans + 5 * k) : ''));
/** Fraction options in lowest terms. */
const frOpts = (n: number, d: number, cands: Array<[number, number]>) =>
  wrongsFrom(sfrac(n, d), cands.filter(([a, b]) => a > 0 && b > 0 && a <= b).map(([a, b]) => sfrac(a, b)), k => (n + Math.abs(k) <= d ? sfrac(n + Math.abs(k), d) : ''));

/** √n in simplest form: «7», «2√7», «√37». */
function root(n: number): string {
  let out = 1, r = n;
  for (let k = 2; k * k <= r; k++) while (r % (k * k) === 0) { out *= k; r /= k * k; }
  return r === 1 ? String(out) : out === 1 ? `√${r}` : `${out}√${r}`;
}

/** Terms, highest power first, in variable `v`: [3, 0, −2, 5] → «3x³ − 2x + 5». */
function poly(cs: readonly number[], v = 'x'): string {
  let out = '';
  cs.forEach((c, i) => {
    const e = cs.length - 1 - i;
    if (c === 0) return;
    const a = Math.abs(c);
    const body = e === 0 ? String(a) : `${a === 1 ? '' : a}${v}${e === 1 ? '' : sup(e)}`;
    out += out === '' ? (c < 0 ? `−${body}` : body) : ` ${c < 0 ? '−' : '+'} ${body}`;
  });
  return out === '' ? '0' : out;
}
const evalP = (cs: readonly number[], x: number) => cs.reduce((acc, c) => acc * x + c, 0);
const derivP = (cs: readonly number[]) => cs.slice(0, -1).map((c, i) => c * (cs.length - 1 - i));
/** «y = 2x − 3», «y = −x», «y = 4». */
const lineStr = (m: number, c: number) => `y = ${poly([m, c])}`;
const dg = (d: number) => `${d}°`;
const vec = (x: string | number, y: string | number) => `⟨${typeof x === 'number' ? signed(x) : x} ، ${typeof y === 'number' ? signed(y) : y}⟩`;
const pt = (x: number, y: number) => `(${signed(x)} ، ${signed(y)})`;

// ─── «الأقواس والقطاعات الدائرية» (S1 pp.41–46) ──────────────────────────────

const ANGLES = [30, 36, 40, 45, 60, 72, 90, 120, 135, 150, 210, 240, 270, 300];
/** A sector angle and radius where the arc (and, if asked, the area) is a whole multiple of π. */
function sector(rng: Rng, needArea: boolean): [number, number] {
  for (;;) {
    const th = pick(rng, ANGLES), r = int(rng, 2, 24);
    if ((th * 2 * r) % 360 !== 0) continue;
    if (needArea && (th * r * r) % 360 !== 0) continue;
    if ((th * 2 * r) / 360 < 2) continue;
    return [th, r];
  }
}
const piOpts = (ans: number, cands: number[]) =>
  wrongsFrom(`${ans}π`, cands.filter(c => Number.isInteger(c) && c > 0 && c !== ans).map(c => `${c}π`), k => (ans + Math.abs(k) > 0 ? `${ans + Math.abs(k)}π` : ''));

const arcs = T('g10_arcs', /^الاقواس والقطاعات الدائريه$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 3] : [0, 1, 2, 3, 4, 5]);
  if (k === 3) {
    const th = pick(rng, ANGLES);
    return {
      eq: `${th}/360`, answer: sfrac(th, 360),
      wrongs: frOpts(th, 360, [[th, 180], [360 - th, 360], [th, 100]]),
      ar: `قطاع دائري قياس زاويته ${dg(th)}. ما الكسر الذي يمثله القطاع من الدائرة؟`,
      en: `A sector has an angle of ${th}°. What fraction of the circle is it?`,
    };
  }
  if (k === 4) {
    const [th, r] = sector(rng, true);
    const A = (th * r * r) / 360;
    return {
      eq: `A=${A}π r=${r}`, answer: dg(th),
      wrongs: wrongsFrom(dg(th), [360 - th, (360 * A) / r, th / 2, 2 * th].filter(v => Number.isInteger(v) && v > 0 && v < 360).map(dg), j => (th + 10 * Math.abs(j) < 360 ? dg(th + 10 * Math.abs(j)) : dg(th - 5 * Math.abs(j)))),
      ar: `مساحة قطاع دائري ${A}π سم²، وطول نصف قطر دائرته ${r} سم. ما قياس زاوية القطاع؟`,
      en: `A sector has an area of ${A}π cm² in a circle of radius ${r} cm. What is the sector's angle?`,
    };
  }
  if (k === 5) {
    const th = pick(rng, [45, 60, 90, 120, 135, 150, 210, 240]), r = int(rng, 3, 15);
    const area = (th / 360) * Math.PI * r * r;
    const f = (v: number) => v.toFixed(1);
    return {
      eq: `sprinkler ${th} ${r}`, answer: f(area),
      wrongs: wrongsFrom(f(area), [f((th / 360) * 2 * Math.PI * r), f(Math.PI * r * r), f((th / 360) * Math.PI * r), f(2 * area)], j => f(area + j)),
      ar: `مرشّ ماء في حديقة يدور بزاوية ${dg(th)}، ويصل الماء إلى مسافة ${r} م منه. ما مساحة المنطقة التي يرويها بالمتر المربع، مقرّبةً إلى أقرب منزلة عشرية واحدة؟`,
      en: `A garden sprinkler turns through ${th}° and the water reaches ${r} m. What area does it water, in square metres, to one decimal place?`,
    };
  }
  const [th, r] = sector(rng, k === 1 || k === 2);
  const arc = (th * 2 * r) / 360, area = (th * r * r) / 360;
  const head = `دائرة طول نصف قطرها ${r} سم، وفيها قطاع قياس زاويته ${dg(th)}.`;
  const headEn = `A circle has radius ${r} cm, and a sector in it has an angle of ${th}°.`;
  if (k === 0) {
    return {
      eq: `arc ${th} ${r}`, answer: `${arc}π`, wrongs: piOpts(arc, [arc / 2, 2 * r, area, 2 * arc]),
      ar: `${head} ما طول قوس القطاع؟ (أكتب الإجابة بدلالة π)`, en: `${headEn} What is the arc length? (in terms of π)`,
    };
  }
  if (k === 1) {
    return {
      eq: `area ${th} ${r}`, answer: `${area}π`, wrongs: piOpts(area, [arc, r * r, area * 2, area / 2]),
      ar: `${head} ما مساحة القطاع؟ (أكتب الإجابة بدلالة π)`, en: `${headEn} What is the sector's area? (in terms of π)`,
    };
  }
  const ans = `${arc}π + ${2 * r}`;
  return {
    eq: `perim ${th} ${r}`, answer: ans,
    wrongs: wrongsFrom(ans, [`${arc}π + ${r}`, `${arc}π`, `${2 * arc}π + ${2 * r}`, `${area}π + ${2 * r}`], j => `${arc + Math.abs(j)}π + ${2 * r}`),
    ar: `${head} ما محيط القطاع؟ (أكتب الإجابة بدلالة π)`, en: `${headEn} What is the sector's perimeter? (in terms of π)`,
  };
});

// ─── «تركيب الاقترانات» (S2 pp.25–31) ────────────────────────────────────────

const composition = T('g10_composition', /^تركيب الاقترانات$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : [0, 1, 2, 3, 4, 5]);
  if (k === 3) {
    const fm = int(rng, 1, 6), gn = int(rng, 1, 9), q = fm * int(rng, 1, 5), p = int(rng, 1, 9);
    const ex = [gn, gn + q / fm].sort((x, y) => x - y);
    const ans = ex.join(' ، ');
    return {
      eq: `dom ${p} ${fm} ${q} ${gn}`, answer: ans,
      wrongs: wrongsFrom(ans, [String(gn), [fm, gn].sort((x, y) => x - y).join(' ، '), [gn, gn + q].sort((x, y) => x - y).join(' ، '), [fm, gn + q / fm].sort((x, y) => x - y).join(' ، ')].filter(s => s !== ans && !/^(\d+) ، \1$/.test(s)), j => [gn, gn + q / fm + Math.abs(j)].join(' ، ')),
      ar: `إذا كان f(x) = ${p}/(x − ${fm}) و g(x) = ${q}/(x − ${gn})، فما الأعداد الحقيقية المستثناة من مجال (f∘g)(x)؟`,
      en: `If f(x) = ${p}/(x − ${fm}) and g(x) = ${q}/(x − ${gn}), which real numbers are excluded from the domain of (f∘g)(x)?`,
    };
  }
  if (k === 4) {
    const kq = int(rng, 5, 30), b = int(rng, 1, 9), c = 50 * int(rng, 4, 20), t0 = int(rng, 1, 5);
    const C = (q: number) => q * q + b * q + c, ans = C(kq * t0);
    return {
      eq: `C(q(${t0}))`, answer: String(ans),
      wrongs: pos(ans, [C(t0), kq * t0, C(kq) * t0, C(kq) + t0]),
      ar: `يُعطى عدد القطع q التي ينتجها مصنع في t ساعة بالاقتران q(t) = ${kq}t، وتكلفة إنتاجها بالدينار بالاقتران C(q) = ${poly([1, b, c], 'q')}. ما تكلفة الإنتاج بالدينار في نهاية الساعة ${t0}، أي (C∘q)(${t0})؟`,
      en: `A factory makes q(t) = ${kq}t items in t hours, and making q items costs C(q) = ${poly([1, b, c], 'q')} dinars. What does production cost by the end of hour ${t0}, that is (C∘q)(${t0})?`,
    };
  }
  if (k === 5) {
    const a = int(rng, 2, 5), b = nz(rng, 7), n = int(rng, 2, 6);
    const inner = poly([a, b]);
    const ans = `f(x) = x${sup(n)} ، g(x) = ${inner}`;
    return {
      eq: `(${inner})^${n}`, answer: ans,
      wrongs: [`f(x) = ${inner} ، g(x) = x${sup(n)}`, `f(x) = x${sup(n)} ، g(x) = ${a}x`, `f(x) = ${a}x${sup(n)} ، g(x) = x ${b < 0 ? '−' : '+'} ${Math.abs(b)}`],
      ar: `إذا كان h(x) = (${inner})${sup(n)}، وكان h(x) = f(g(x))، فأيّ مما يأتي يصلح أن يكون f و g؟`,
      en: `If h(x) = (${inner})${sup(n)} and h(x) = f(g(x)), which pair could f and g be?`,
    };
  }
  // f, g linear, or one of them x² + c
  const lin = () => [pick(rng, [2, 3, 4, 5, -2, -3]), nz(rng, 9)];
  const quad = () => [1, 0, nz(rng, 9)];
  const sq = rng() < 0.5;
  const f = sq && diff !== 'easy' ? quad() : lin(), g = lin();
  const F = poly(f), G = poly(g);
  const fx = (x: number) => evalP(f, x), gx = (x: number) => evalP(g, x);
  const head = `إذا كان f(x) = ${F} و g(x) = ${G}، `;
  const headEn = `If f(x) = ${F} and g(x) = ${G}, `;
  if (k === 2) {
    // (f∘g)(x): substitute g into f
    const comp = f.length === 2 ? [f[0]! * g[0]!, f[0]! * g[1]! + f[1]!] : [g[0]! * g[0]!, 2 * g[0]! * g[1]!, g[1]! * g[1]! + f[2]!];
    const ans = `(f∘g)(x) = ${poly(comp)}`;
    const wrongComp = f.length === 2 ? [f[0]! * g[0]!, g[0]! * f[1]! + g[1]!] : [g[0]!, g[1]! + f[2]!];
    return {
      eq: `${F} ∘ ${G}`, answer: ans,
      wrongs: wrongsFrom(ans, [`(f∘g)(x) = ${poly(wrongComp)}`, `(f∘g)(x) = ${poly(f.length === 2 ? [f[0]! + g[0]!, f[1]! + g[1]!] : [1, g[0]!, g[1]! + f[2]!])}`, `(f∘g)(x) = ${poly(f.length === 2 ? [f[0]! * g[0]!, f[1]! * g[1]!] : [g[0]! * g[0]!, g[1]! * g[1]! + f[2]!])}`], j => `(f∘g)(x) = ${poly([...comp.slice(0, -1), comp.at(-1)! + j])}`),
      ar: `${head}فما قاعدة الاقتران (f∘g)(x)؟`, en: `${headEn}what is the rule of (f∘g)(x)?`,
    };
  }
  const n = nz(rng, 4);
  if (k === 1) {
    const which = rng() < 0.5 ? 'f' : 'g', h = which === 'f' ? fx : gx, ans = h(h(n));
    return {
      eq: `(${which}∘${which})(${n})`, answer: signed(ans),
      wrongs: sgn(ans, [h(n) * h(n), 2 * h(n), h(n), h(2 * n)]),
      ar: `${head}فأوجد (${which}∘${which})(${signed(n)}).`, en: `${headEn}find (${which}∘${which})(${signed(n)}).`,
    };
  }
  const fg = rng() < 0.5, ans = fg ? fx(gx(n)) : gx(fx(n));
  return {
    eq: `${fg ? 'f∘g' : 'g∘f'} ${n}`, answer: signed(ans),
    wrongs: sgn(ans, [fg ? gx(fx(n)) : fx(gx(n)), fx(n) * gx(n), fx(n) + gx(n), fg ? fx(n) : gx(n)]),
    ar: `${head}فأوجد (${fg ? 'f∘g' : 'g∘f'})(${signed(n)}).`, en: `${headEn}find (${fg ? 'f∘g' : 'g∘f'})(${signed(n)}).`,
  };
});

// ─── «الاقتران العكسي» (S2 pp.32–41) ─────────────────────────────────────────

const shiftStr = (b: number) => `${b < 0 ? '+' : '−'} ${Math.abs(b)}`; // x − b, written for the inverse
const inverse = T('g10_inverse', /^الاقتران العكسي$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : [0, 1, 2, 3, 4, 5]);
  const a = int(rng, 2, 9), b = nz(rng, 12);
  const f = poly([a, b]);
  if (k === 0) {
    const ans = `f⁻¹(x) = (x ${shiftStr(b)})/${a}`;
    return {
      eq: f, answer: ans,
      wrongs: [`f⁻¹(x) = (x ${shiftStr(-b)})/${a}`, `f⁻¹(x) = ${a}x ${shiftStr(b)}`, `f⁻¹(x) = (x ${shiftStr(b)})/${a + 1}`],
      ar: `أوجد الاقتران العكسي للاقتران f(x) = ${f}.`, en: `Find the inverse of f(x) = ${f}.`,
    };
  }
  if (k === 1) {
    const x0 = nz(rng, 9), y0 = a * x0 + b;
    return {
      eq: `${f} ⁻¹(${y0})`, answer: signed(x0),
      wrongs: sgn(x0, [a * y0 + b, Math.round(y0 / a) === y0 / a ? y0 / a : x0 + 2, (y0 + b) / a, -x0]),
      ar: `إذا كان f(x) = ${f}، فأوجد f⁻¹(${signed(y0)}).`, en: `If f(x) = ${f}, find f⁻¹(${signed(y0)}).`,
    };
  }
  if (k === 2) {
    const xs = [1, 2, 3, 4].map(() => 0);
    const used = new Set<number>();
    for (let i = 0; i < 3; i++) { let v: number; do { v = int(rng, 1, 12); } while (used.has(v)); used.add(v); xs[i] = v; }
    const ys = xs.slice(0, 3).map(() => 0);
    const usedY = new Set<number>();
    for (let i = 0; i < 3; i++) { let v: number; do { v = int(rng, 1, 15); } while (usedY.has(v)); usedY.add(v); ys[i] = v; }
    const pairs = xs.slice(0, 3).map((x, i) => [x, ys[i]!] as const);
    const set = (ps: ReadonlyArray<readonly [number, number]>) => `{${ps.map(([x, y]) => pt(x, y)).join(' ، ')}}`;
    const ans = set(pairs.map(([x, y]) => [y, x]));
    return {
      eq: set(pairs), answer: ans,
      wrongs: wrongsFrom(ans, [set(pairs), set(pairs.map(([x, y], i) => (i === 0 ? [y, x] : [x, y]))), set(pairs.map(([x, y]) => [y, -x]))], j => set(pairs.map(([x, y]) => [y, x + Math.abs(j)]))),
      ar: `ما الاقتران العكسي للاقتران ${set(pairs)}؟`, en: `What is the inverse of the function ${set(pairs)}?`,
    };
  }
  if (k === 3) {
    const m = int(rng, 1, 9), c = int(rng, 2, 6), ans = `x ≥ ${m}`;
    return {
      eq: `√(${c}x − ${c * m})`, answer: ans,
      wrongs: [`x ≤ ${m}`, `x ≥ ${c * m}`, `x ≥ −${m}`],
      ar: `ما مجال الاقتران f(x) = √(${c}x − ${c * m})؟`, en: `What is the domain of f(x) = √(${c}x − ${c * m})?`,
    };
  }
  if (k === 4) {
    const n = nz(rng, 20);
    return {
      eq: `identity ${n}`, answer: signed(n),
      wrongs: sgn(n, [-n, 0, 2 * n, n + 1].filter(v => v !== n)),
      ar: `إذا كان g هو الاقتران العكسي للاقتران f، فما قيمة (f∘g)(${signed(n)})؟`,
      en: `If g is the inverse of f, what is (f∘g)(${signed(n)})?`,
    };
  }
  const c = int(rng, 2, 5), d = nz(rng, 9), fq = poly([c, 0, d]);
  const ans = `f⁻¹(x) = √((x ${shiftStr(d)})/${c})`;
  return {
    eq: fq, answer: ans,
    wrongs: [`f⁻¹(x) = √((x ${shiftStr(-d)})/${c})`, `f⁻¹(x) = (x ${shiftStr(d)})/${c}`, `f⁻¹(x) = √(x/${c}) ${shiftStr(d)}`],
    ar: `أوجد الاقتران العكسي للاقتران f(x) = ${fq} حيث x ≥ 0.`, en: `Find the inverse of f(x) = ${fq}, where x ≥ 0.`,
  };
});

// ─── «المتتاليات» (S2 pp.42–49) ──────────────────────────────────────────────

const KIND_NAMES = ['متتالية ثابتة', 'متتالية خطية', 'متتالية تربيعية', 'متتالية تكعيبية'];
const KIND_EN = ['constant', 'linear', 'quadratic', 'cubic'];
/** A general term of degree 1, 2 or 3 with whole coefficients. */
function generalTerm(rng: Rng, deg: number): number[] {
  if (deg === 1) return [pick(rng, [2, 3, 4, 5, 6, 7, -2, -3]), nz(rng, 9)];
  if (deg === 2) return [pick(rng, [1, 1, 2]), 0, nz(rng, 9)];
  return [1, 0, 0, nz(rng, 5)];
}
const list = (xs: number[]) => xs.map(signed).join(' ، ');
const sequences = T('g10_sequences', /^المتتاليات$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 2] : [0, 1, 2, 3, 4, 5]);
  if (k === 0) {
    if (rng() < 0.5) {
      const d = nz(rng, 9), t0 = int(rng, d < 0 ? 40 : 1, d < 0 ? 90 : 30);
      const t = [0, 1, 2, 3].map(i => t0 + i * d), ans = t0 + 4 * d;
      return {
        eq: list(t), answer: signed(ans), wrongs: sgn(ans, [t[3]! + d + 1, t[3]! - d, t[3]! + 2 * d, t[3]! * 2]),
        ar: `ما الحد التالي في المتتالية: ${list(t)} ، …؟`, en: `What is the next term of the sequence ${t.map(signed).join(', ')}, …?`,
      };
    }
    const r = pick(rng, [2, 3, 4]), t0 = int(rng, 1, 6), up = rng() < 0.6;
    const t = up ? [0, 1, 2, 3].map(i => t0 * r ** i) : [3, 2, 1, 0].map(i => t0 * r ** (i + 1));
    const ans = up ? t[3]! * r : t[3]! / r;
    return {
      eq: list(t), answer: signed(ans), wrongs: sgn(ans, up ? [t[3]! + (t[3]! - t[2]!), t[3]! * (r + 1), t[3]! + r] : [t[3]! - (t[2]! - t[3]!), t[3]! - r, t[3]! / 2 === ans ? t[3]! - 1 : t[3]! / 2].filter(v => v > 0)),
      ar: `ما الحد التالي في المتتالية: ${list(t)} ، …؟`, en: `What is the next term of the sequence ${t.map(signed).join(', ')}, …?`,
    };
  }
  const deg = int(rng, 1, 3), cs = generalTerm(rng, deg), Tn = poly(cs, 'n');
  if (k === 1) {
    const n0 = pick(rng, [10, 12, 15, 20, 25, 30, 50, 75]), ans = evalP(cs, n0);
    return {
      eq: `${Tn} @${n0}`, answer: signed(ans), wrongs: sgn(ans, [evalP(cs, n0 - 1), evalP(cs, n0 + 1), evalP(cs, n0) - cs.at(-1)!, n0 + cs.at(-1)!]),
      ar: `متتالية حدها العام T(n) = ${Tn}. ما الحد الذي رتبته ${n0}؟`, en: `A sequence has general term T(n) = ${Tn}. What is term number ${n0}?`,
    };
  }
  if (k === 2) {
    return {
      eq: Tn, answer: KIND_NAMES[deg]!, wrongs: KIND_NAMES.filter((_, i) => i !== deg),
      ar: `صنّف المتتالية التي حدها العام T(n) = ${Tn}: خطية، أم تربيعية، أم تكعيبية؟`,
      en: `Is the sequence with general term T(n) = ${Tn} linear, quadratic or cubic? (${KIND_EN.join(' / ')})`,
    };
  }
  if (k === 3) {
    const t = [1, 2, 3, 4].map(n => evalP(cs, n)), ans = list(t);
    return {
      eq: `first ${Tn}`, answer: ans,
      wrongs: wrongsFrom(ans, [list([0, 1, 2, 3].map(n => evalP(cs, n))), list([2, 3, 4, 5].map(n => evalP(cs, n))), list(t.map(v => v + 1))], j => list(t.map(v => v + j))),
      ar: `اكتب الحدود الأربعة الأولى للمتتالية التي حدها العام T(n) = ${Tn}.`, en: `Write the first four terms of the sequence with general term T(n) = ${Tn}.`,
    };
  }
  const dg2 = k === 4 ? 1 : pick(rng, [2, 3]);
  const c2 = generalTerm(rng, dg2), t = [1, 2, 3, 4, 5].map(n => evalP(c2, n));
  const ans = `T(n) = ${poly(c2, 'n')}`;
  const alt = dg2 === 1
    ? [[c2[0]!, t[0]!], [t[0]!, c2[0]!], [1, c2[0]!]]
    : dg2 === 2 ? [[1, 0, 0, c2.at(-1)!], [c2[0]!, 0, c2.at(-1)! + 1], [c2[0]! + 2, c2.at(-1)! - c2[0]!]] : [[1, 0, c2.at(-1)!], [1, 0, 0, c2.at(-1)! + 1], [2, 0, 0, c2.at(-1)!]];
  return {
    eq: list(t), answer: ans, wrongs: wrongsFrom(ans, alt.map(c => `T(n) = ${poly(c, 'n')}`), j => `T(n) = ${poly([...c2.slice(0, -1), c2.at(-1)! + j], 'n')}`),
    ar: `أوجد الحد العام للمتتالية: ${list(t)} ، …`, en: `Find the general term of the sequence ${t.map(signed).join(', ')}, …`,
  };
});

// ─── «تقدير ميل المنحنى» and its lab (S2 pp.54–62) ───────────────────────────

const SIGNS = ['موجبة', 'سالبة', 'صفر', 'غير معرّفة'];
const slope = T('g10_slope', /^تقدير ميل المنحني$|^معمل برمجيه جيوجبرا استكشاف ميل مماس المنحني$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : [0, 1, 2, 3, 4]);
  if (k === 0) {
    const m = nz(rng, 5), x1 = int(rng, -3, 2), y1 = int(rng, -4, 6), dx = int(rng, 1, 4);
    const x2 = x1 + dx, y2 = y1 + m * dx;
    return {
      eq: `${x1},${y1},${x2},${y2}`, answer: signed(m),
      wrongs: wrongsFrom(signed(m), [signed(-m), sfrac(dx, m * dx), signed(y2 - y1), signed(m + 1)].filter(s => s !== signed(m)), j => signed(m + j)),
      ar: `مماس منحنى اقتران عند النقطة A يمر بالنقطتين ${pt(x1, y1)} و ${pt(x2, y2)}. ما ميل منحنى الاقتران عند A؟`,
      en: `The tangent to a curve at A passes through ${pt(x1, y1)} and ${pt(x2, y2)}. What is the slope of the curve at A?`,
    };
  }
  if (k === 1) {
    const m = nz(rng, 6), a = int(rng, -4, 5), b = int(rng, -8, 10), c = b - m * a;
    const ans = lineStr(m, c);
    return {
      eq: `${m} @ (${a},${b})`, answer: ans,
      wrongs: wrongsFrom(ans, [lineStr(m, b + m * a), lineStr(-m, b + m * a), lineStr(m, b), lineStr(a, b - a * m)].filter(s => s !== ans), j => lineStr(m, c + j)),
      ar: `ميل منحنى اقتران عند النقطة ${pt(a, b)} يساوي ${signed(m)}. ما معادلة المماس عند هذه النقطة؟`,
      en: `The slope of a curve at ${pt(a, b)} is ${signed(m)}. What is the equation of the tangent there?`,
    };
  }
  if (k === 2) {
    const pc = int(rng, 1, 5), qc = int(rng, 0, 6), t1 = int(rng, 0, 4), t2 = t1 + int(rng, 1, 4);
    const s = (t: number) => pc * t * t + qc * t, ans = (s(t2) - s(t1)) / (t2 - t1);
    return {
      eq: `${pc}t²+${qc}t [${t1},${t2}]`, answer: String(ans),
      wrongs: pos(ans, [s(t2) - s(t1), s(t2) / t2, 2 * pc * t2 + qc, ans + pc]),
      ar: `يمثّل الاقتران s(t) = ${poly([pc, qc, 0], 't')} موقع جسم يتحرك في مسار مستقيم، حيث s بالأمتار و t بالثواني. ما سرعته المتوسطة في الفترة [${t1} ، ${t2}] بالمتر لكل ثانية؟`,
      en: `s(t) = ${poly([pc, qc, 0], 't')} gives the position, in metres after t seconds, of a body moving in a straight line. What is its average velocity over [${t1}, ${t2}], in m/s?`,
    };
  }
  if (k === 3) {
    const pc = int(rng, 1, 4), ts = [0, 1, 2, 3, 4, 5], ss = ts.map(t => pc * t * t);
    const t1 = int(rng, 0, 3), t2 = t1 + int(rng, 1, 5 - t1), ans = (ss[t2]! - ss[t1]!) / (t2 - t1);
    const table = ts.map(t => pt(t, ss[t]!)).join(' ');
    return {
      eq: `${table} [${t1},${t2}]`, answer: String(ans),
      wrongs: pos(ans, [ss[t2]! - ss[t1]!, ss[t2]! / t2, ans + pc, 2 * pc * t2]),
      ar: `يبين الجدول (t ، s) موقع دراجة s بالأمتار بعد t ثانية من بدء حركتها: ${table}. ما سرعتها المتوسطة في الفترة [${t1} ، ${t2}] بالمتر لكل ثانية؟`,
      en: `The table (t, s) gives a motorbike's position s in metres t seconds after it starts: ${table}. What is its average velocity over [${t1}, ${t2}], in m/s?`,
    };
  }
  const c = int(rng, 0, 2);
  const situation = ['يصنع مماس منحنى اقتران عند نقطة عليه زاوية حادة مع الاتجاه الموجب لمحور x.', 'يصنع مماس منحنى اقتران عند نقطة عليه زاوية منفرجة مع الاتجاه الموجب لمحور x.', 'مماس منحنى اقتران عند نقطة عليه أفقيًا.'][c]!;
  const situationEn = ['The tangent to a curve at a point makes an acute angle with the positive x-axis.', 'The tangent to a curve at a point makes an obtuse angle with the positive x-axis.', 'The tangent to a curve at a point is horizontal.'][c]!;
  return {
    eq: `sign ${c}`, answer: SIGNS[c]!, wrongs: SIGNS.filter((_, i) => i !== c),
    ar: `${situation} ما إشارة ميل المنحنى عند تلك النقطة؟`, en: `${situationEn} What is the sign of the curve's slope there?`,
  };
});

// ─── «الاشتقاق» (S2 pp.63–69) ────────────────────────────────────────────────

/** The bare derivative, as the bank writes it: «f′(x) = …» is a syntax error to the SymPy verifier. */
const prime = (cs: number[]) => poly(cs);
const derivative = T('g10_derivative', /^الاشتقاق$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 2] : [0, 1, 2, 3, 4, 5, 6, 7]);
  if (k === 0) {
    const a = nz(rng, 9), n = int(rng, 2, 9), cs = [a, ...Array(n).fill(0)];
    const ans = prime(derivP(cs));
    return {
      eq: poly(cs), answer: ans,
      wrongs: wrongsFrom(ans, [prime([a * n, ...Array(n).fill(0)]), prime([a, ...Array(n - 1).fill(0)]), prime([a * (n - 1), ...Array(n - 1).fill(0)])], j => prime([a * n + j, ...Array(n - 1).fill(0)])),
      ar: `أوجد f′(x) إذا كان f(x) = ${poly(cs)}.`, en: `Find f′(x) if f(x) = ${poly(cs)}.`,
    };
  }
  const cubic = () => [nz(rng, 4), nz(rng, 6), nz(rng, 9), int(rng, -9, 9)];
  if (k === 1) {
    const cs = cubic(), ans = prime(derivP(cs));
    const d = derivP(cs);
    return {
      eq: poly(cs), answer: ans,
      wrongs: wrongsFrom(ans, [prime([...d.slice(0, -1), d.at(-1)! + cs.at(-1)!]), prime([cs[0]!, cs[1]!, cs[2]!]), prime([3 * cs[0]!, 2 * cs[1]!, 0])], j => prime([...d.slice(0, -1), d.at(-1)! + j])),
      ar: `أوجد f′(x) إذا كان f(x) = ${poly(cs)}.`, en: `Find f′(x) if f(x) = ${poly(cs)}.`,
    };
  }
  if (k === 2) {
    const p = nz(rng, 9), q = nz(rng, 9);
    const ans = prime([2, p + q]);
    const prod = `(x ${p < 0 ? '−' : '+'} ${Math.abs(p)})(x ${q < 0 ? '−' : '+'} ${Math.abs(q)})`;
    return {
      eq: prod, answer: ans,
      wrongs: wrongsFrom(ans, [prime([1]), prime([2, p * q]), prime([1, p + q])], j => prime([2, p + q + j])),
      ar: `أوجد f′(x) إذا كان f(x) = ${prod}.`, en: `Find f′(x) if f(x) = ${prod}.`,
    };
  }
  if (k === 3) {
    const cs = rng() < 0.5 ? [nz(rng, 5), nz(rng, 9), int(rng, -9, 9)] : cubic(), x0 = nz(rng, 4);
    const ans = evalP(derivP(cs), x0);
    return {
      eq: `${poly(cs)} @${x0}`, answer: signed(ans),
      wrongs: sgn(ans, [evalP(cs, x0), evalP(derivP(cs), -x0), evalP(derivP(cs), x0 + 1), ans - cs.at(-2)!]),
      ar: `إذا كان f(x) = ${poly(cs)}، فما ميل منحنى الاقتران عند x = ${signed(x0)}؟`,
      en: `If f(x) = ${poly(cs)}, what is the slope of its curve at x = ${signed(x0)}?`,
    };
  }
  if (k === 4 || k === 5) {
    const a = int(rng, 1, 5), b = int(rng, 1, 9), t0 = int(rng, 1, 6);
    const cs = k === 4 ? [a, b, int(rng, 0, 9)] : [a, b, int(rng, 1, 9), 0];
    const S = poly(cs, 't');
    if (k === 4) {
      const ans = evalP(derivP(cs), t0);
      return {
        eq: `${S} v(${t0})`, answer: String(ans), wrongs: pos(ans, [evalP(cs, t0), a * t0 + b, 2 * a, ans + b]),
        ar: `يمثّل الاقتران s(t) = ${S} موقع جسم يتحرك في مسار مستقيم، حيث s بالأمتار و t بالثواني. ما سرعة الجسم بالمتر لكل ثانية عندما t = ${t0}؟`,
        en: `s(t) = ${S} gives the position in metres after t seconds of a body moving in a straight line. What is its velocity, in m/s, when t = ${t0}?`,
      };
    }
    const ans = evalP(derivP(derivP(cs)), t0);
    return {
      eq: `${S} a(${t0})`, answer: String(ans), wrongs: pos(ans, [evalP(derivP(cs), t0), 6 * a, 3 * a * t0 + 2 * b, ans + 2 * b]),
      ar: `يمثّل الاقتران s(t) = ${S} موقع جسم يتحرك في مسار مستقيم، حيث s بالأمتار و t بالثواني. ما تسارع الجسم بالمتر لكل ثانية تربيع عندما t = ${t0}؟`,
      en: `s(t) = ${S} gives the position in metres after t seconds of a body moving in a straight line. What is its acceleration, in m/s², when t = ${t0}?`,
    };
  }
  if (k === 6) {
    const cs = [nz(rng, 3), nz(rng, 8), int(rng, -9, 9)], x0 = nz(rng, 3);
    const m = evalP(derivP(cs), x0), y0 = evalP(cs, x0), ans = lineStr(m, y0 - m * x0);
    return {
      eq: `${poly(cs)} tangent @${x0}`, answer: ans,
      wrongs: wrongsFrom(ans, [lineStr(m, y0), lineStr(y0, m), lineStr(-m, y0 + m * x0), lineStr(m, y0 + m * x0)].filter(s => s !== ans), j => lineStr(m, y0 - m * x0 + j)),
      ar: `ما معادلة مماس منحنى الاقتران f(x) = ${poly(cs)} عند x = ${signed(x0)}؟`,
      en: `What is the equation of the tangent to f(x) = ${poly(cs)} at x = ${signed(x0)}?`,
    };
  }
  const a = nz(rng, 4), b = nz(rng, 9), x0 = nz(rng, 5), slopeK = 2 * a * x0 + b;
  const cs = [a, b, int(rng, -9, 9)];
  return {
    eq: `${poly(cs)} slope ${slopeK}`, answer: `x = ${signed(x0)}`,
    wrongs: wrongsFrom(`x = ${signed(x0)}`, [`x = ${signed(-x0)}`, `x = ${signed(slopeK)}`, `x = ${signed(x0 + 1)}`, `x = ${signed(slopeK - b)}`], j => `x = ${signed(x0 + j)}`),
    ar: `عند أيّ قيمة لـ x يكون ميل منحنى الاقتران f(x) = ${poly(cs)} يساوي ${signed(slopeK)}؟`,
    en: `For which x is the slope of f(x) = ${poly(cs)} equal to ${signed(slopeK)}?`,
  };
});

// ─── «القيم العظمى والقيم الصغرى» (S2 pp.70–75) ──────────────────────────────

const extrema = T('g10_extrema', /^القيم العظمي والقيم الصغري$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : [0, 1, 2, 3, 4, 5]);
  if (k === 0 || k === 1) {
    const a = pick(rng, [1, 1, 2, 3, -1, -2]), h = nz(rng, 6), c = int(rng, -15, 15);
    const cs = [a, -2 * a * h, c], F = poly(cs);
    if (k === 0) {
      const ans = `x = ${signed(h)}`;
      return {
        eq: F, answer: ans, wrongs: wrongsFrom(ans, [`x = ${signed(-h)}`, `x = ${signed(2 * h)}`, `x = ${signed(evalP(cs, h))}`, `x = ${signed(h + 1)}`], j => `x = ${signed(h + j)}`),
        ar: `ما القيمة الحرجة للاقتران f(x) = ${F}؟`, en: `What is the critical value of f(x) = ${F}?`,
      };
    }
    const v = evalP(cs, h), kind = a > 0 ? 'الصغرى' : 'العظمى';
    return {
      eq: `${F} ext`, answer: signed(v), wrongs: sgn(v, [h, evalP(cs, -h), c, v + a]),
      ar: `ما القيمة ${kind} المحلية للاقتران f(x) = ${F}؟`, en: `What is the local ${a > 0 ? 'minimum' : 'maximum'} value of f(x) = ${F}?`,
    };
  }
  if (k === 2 || k === 3) {
    const m = int(rng, 1, 4), c = int(rng, -10, 10), cs = [1, 0, -3 * m * m, c], F = poly(cs);
    if (k === 2) {
      const ans = `x = ${signed(-m)} ، x = ${m}`;
      return {
        eq: F, answer: ans, wrongs: [`x = ${m}`, `x = ${signed(-3 * m * m)} ، x = 0`, `x = 0 ، x = ${m}`].filter(s => s !== ans),
        ar: `ما القيم الحرجة للاقتران f(x) = ${F}؟`, en: `What are the critical values of f(x) = ${F}?`,
      };
    }
    const max = rng() < 0.5, x0 = max ? -m : m, v = evalP(cs, x0);
    return {
      eq: `${F} ${max ? 'max' : 'min'}`, answer: signed(v), wrongs: sgn(v, [evalP(cs, -x0), x0, c, v + 2 * m]),
      ar: `ما القيمة ${max ? 'العظمى' : 'الصغرى'} المحلية للاقتران f(x) = ${F}؟`, en: `What is the local ${max ? 'maximum' : 'minimum'} value of f(x) = ${F}?`,
    };
  }
  if (k === 4) {
    const b = 10 * int(rng, 1, 5), c = int(rng, 1, 3), top = b / 10, ans = c + (b * b) / 20;
    return {
      eq: `${c}+${b}t−5t²`, answer: String(ans), wrongs: pos(ans, [top, (b * b) / 20, c + (b * b) / 10, ans + 5]),
      ar: `يمثّل الاقتران s(t) = ${c} + ${b}t − 5t² ارتفاع كرة بالأمتار بعد t ثانية من ركلها رأسيًا لأعلى. ما أعلى ارتفاع تصل إليه الكرة بالأمتار؟`,
      en: `s(t) = ${c} + ${b}t − 5t² is a ball's height in metres t seconds after it is kicked straight up. What is the greatest height it reaches, in metres?`,
    };
  }
  const L = 4 * int(rng, 5, 25), ans = (L * L) / 8;
  return {
    eq: `x(${L}−2x)`, answer: String(ans), wrongs: pos(ans, [L / 4, (L * L) / 4, (L * L) / 16, (L / 4) * (L / 4)]),
    ar: `لدى مزارع ${L} م من السياج، يريد أن يسيّج بها حظيرة مستطيلة بجانب جدار يكوّن أحد أضلاعها، فتكون مساحتها A(x) = x(${L} − 2x)، حيث x عرضها بالأمتار. ما أكبر مساحة ممكنة للحظيرة بالمتر المربع؟`,
    en: `A farmer has ${L} m of fencing for a rectangular pen against a wall, so its area is A(x) = x(${L} − 2x), where x is its width in metres. What is the largest possible area, in square metres?`,
  };
});

// ─── «المتجهات في المستوى الإحداثي» (S2 pp.80–87) ────────────────────────────

const TRIPLES: Array<[number, number, number]> = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [7, 24, 25], [9, 12, 15]];
const vectors = T('g10_vectors', /^المتجهات في المستوي الاحداثي$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 5] : [0, 1, 2, 3, 4, 5]);
  if (k === 0 || k === 2) {
    const [p, q, h] = pick(rng, TRIPLES), useTriple = rng() < 0.7;
    const vx = (rng() < 0.5 ? -1 : 1) * (useTriple ? p : int(rng, 1, 7)), vy = (rng() < 0.5 ? -1 : 1) * (useTriple ? q : int(rng, 1, 7));
    const ax = int(rng, -6, 6), ay = int(rng, -6, 6);
    if (k === 0) {
      const ans = vec(vx, vy);
      return {
        eq: `${ax},${ay} → ${ax + vx},${ay + vy}`, answer: ans,
        wrongs: wrongsFrom(ans, [vec(-vx, -vy), vec(ax + (ax + vx), ay + (ay + vy)), vec(vy, vx)].filter(s => s !== ans), j => vec(vx + j, vy)),
        ar: `أكتب المتجه AB⃗ بالصورة الإحداثية، حيث A${pt(ax, ay)} و B${pt(ax + vx, ay + vy)}.`,
        en: `Write AB⃗ in component form, where A${pt(ax, ay)} and B${pt(ax + vx, ay + vy)}.`,
      };
    }
    const n = vx * vx + vy * vy, ans = useTriple ? String(h) : root(n);
    return {
      eq: `|AB| ${vx},${vy}`, answer: ans,
      wrongs: wrongsFrom(ans, [String(Math.abs(vx) + Math.abs(vy)), String(n), root(Math.abs(vx * vx - vy * vy) || 2)].filter(s => s !== ans), j => root(n + Math.abs(j))),
      ar: `ما مقدار المتجه AB⃗، حيث A${pt(ax, ay)} و B${pt(ax + vx, ay + vy)}؟`,
      en: `What is the magnitude of AB⃗, where A${pt(ax, ay)} and B${pt(ax + vx, ay + vy)}?`,
    };
  }
  if (k === 1) {
    const [p, q] = rng() < 0.6 ? pick(rng, TRIPLES) : [int(rng, 1, 9), int(rng, 1, 9)];
    const vx = (rng() < 0.5 ? -1 : 1) * p, vy = (rng() < 0.5 ? -1 : 1) * q, ans = root(vx * vx + vy * vy);
    return {
      eq: vec(vx, vy), answer: ans,
      wrongs: wrongsFrom(ans, [String(Math.abs(vx) + Math.abs(vy)), String(vx * vx + vy * vy), root(Math.abs(vx * vx - vy * vy) || 3)].filter(s => s !== ans), j => root(vx * vx + vy * vy + Math.abs(j))),
      ar: `ما مقدار المتجه ${vec(vx, vy)}؟`, en: `What is the magnitude of the vector ${vec(vx, vy)}?`,
    };
  }
  if (k === 3) {
    const m = int(rng, 1, 9);
    const [vx, vy, ang] = pick(rng, [[m, m, 45], [0, m, 90], [-m, m, 135], [-m, 0, 180], [m, 0, 0], [-m, -m, 225], [0, -m, 270], [m, -m, 315]] as Array<[number, number, number]>);
    return {
      eq: vec(vx, vy), answer: dg(ang),
      wrongs: wrongsFrom(dg(ang), [dg((ang + 90) % 360), dg((ang + 180) % 360), dg((360 - ang) % 360), dg(45)].filter(s => s !== dg(ang)), j => dg((ang + 360 + 45 * j) % 360)),
      ar: `ما قياس الزاوية التي يصنعها المتجه ${vec(vx, vy)} مع الاتجاه الموجب لمحور x؟ (بين 0° و 360°)`,
      en: `What angle does the vector ${vec(vx, vy)} make with the positive x-axis? (between 0° and 360°)`,
    };
  }
  if (k === 4) {
    const half = int(rng, 2, 15), s = 2 * half, th = pick(rng, [30, 60, 90]);
    const comp = th === 30 ? [`${half}√3`, String(half)] : th === 60 ? [String(half), `${half}√3`] : ['0', String(s)];
    const ans = vec(comp[0]!, comp[1]!);
    return {
      eq: `${s}@${th}`, answer: ans,
      wrongs: wrongsFrom(ans, [vec(comp[1]!, comp[0]!), vec(s, th), vec(half, half), vec(`${s}√3`, String(s))].filter(x => x !== ans), j => vec(half + Math.abs(j), half)),
      ar: `رُكلت كرة بسرعة مقدارها ${s} m/s وبزاوية ${dg(th)} مع الأفقي. ما متجه سرعتها بالصورة الإحداثية؟`,
      en: `A ball is kicked at ${s} m/s at ${th}° to the horizontal. What is its velocity vector in component form?`,
    };
  }
  const ax = int(rng, -6, 6), ay = int(rng, -6, 6), vx = nz(rng, 8), vy = nz(rng, 8), ans = pt(ax + vx, ay + vy);
  return {
    eq: `${ax},${ay}+${vx},${vy}`, answer: ans,
    wrongs: wrongsFrom(ans, [pt(ax - vx, ay - vy), pt(vx, vy), pt(ax + vy, ay + vx)].filter(s => s !== ans), j => pt(ax + vx + j, ay + vy)),
    ar: `متجه نقطة بدايته A${pt(ax, ay)} ويساوي ${vec(vx, vy)}. ما إحداثيا نقطة نهايته؟`,
    en: `A vector starts at A${pt(ax, ay)} and equals ${vec(vx, vy)}. What are the coordinates of its end point?`,
  };
});

// ─── «جمع المتجهات وطرحها» (S2 pp.88–95) ─────────────────────────────────────

const coef = (c: number, name: string) => (c === 1 ? name : c === -1 ? `−${name}` : `${signed(c)}${name}`);
const vectorOps = T('g10_vector_ops', /^جمع المتجهات وطرحها$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 3] : [0, 1, 2, 3, 4, 5]);
  if (k <= 2) {
    const a = [nz(rng, 9), nz(rng, 9)], b = [nz(rng, 9), nz(rng, 9)];
    const [ca, cb] = k === 0 ? [1, 1] : k === 1 ? [1, -1] : [pick(rng, [2, 3, 4, -2]), pick(rng, [2, 3, -2, -3])];
    const ex = `${coef(ca, 'a')} ${cb < 0 ? '−' : '+'} ${Math.abs(cb) === 1 ? '' : Math.abs(cb)}b`;
    const r = [ca * a[0]! + cb * b[0]!, ca * a[1]! + cb * b[1]!], ans = vec(r[0]!, r[1]!);
    return {
      eq: ex, answer: ans,
      wrongs: wrongsFrom(ans, [vec(ca * a[0]! - cb * b[0]!, ca * a[1]! - cb * b[1]!), vec(a[0]! + b[0]!, a[1]! + b[1]!), vec(ca * a[0]! + cb * b[1]!, ca * a[1]! + cb * b[0]!), vec(r[0]! + 1, r[1]!)].filter(s => s !== ans), j => vec(r[0]!, r[1]! + j)),
      ar: `إذا كان a = ${vec(a[0]!, a[1]!)} و b = ${vec(b[0]!, b[1]!)}، فأوجد ${ex}.`,
      en: `If a = ${vec(a[0]!, a[1]!)} and b = ${vec(b[0]!, b[1]!)}, find ${ex}.`,
    };
  }
  if (k === 3) {
    const start = int(rng, 0, 2), len = int(rng, 2, 4), L = 'ABCDEFG'.slice(start, start + len + 1).split('');
    const parts = L.slice(0, -1).map((c, i) => `${c}${L[i + 1]}⃗`);
    const ans = `${L[0]}${L.at(-1)}⃗`;
    return {
      eq: parts.join(' + '), answer: ans,
      wrongs: [`${L.at(-1)}${L[0]}⃗`, `${L[0]}${L.at(-2)}⃗`, `${L[1]}${L.at(-1)}⃗`].filter(s => s !== ans),
      ar: `ما ناتج ${parts.join(' + ')}؟`, en: `What is ${parts.join(' + ')}?`,
    };
  }
  if (k === 4) {
    const [p, q, h] = pick(rng, TRIPLES), f = int(rng, 1, 5);
    const [d1, d2] = rng() < 0.5 ? [p * f, q * f] : [q * f, p * f];
    const [w1, w2] = pick(rng, [['جنوبًا', 'شرقًا'], ['شمالًا', 'غربًا'], ['شرقًا', 'شمالًا'], ['غربًا', 'جنوبًا']]);
    const ans = String(h * f);
    return {
      eq: `${d1} ${d2}`, answer: ans, wrongs: pos(h * f, [d1 + d2, Math.abs(d1 - d2), d1 * d2]),
      ar: `أبحر قارب مسافة ${d1} كم ${w1}، ثم ${d2} كم ${w2}. كم كيلومترًا يبلغ بُعده عن نقطة انطلاقه؟`,
      en: `A boat sails ${d1} km ${w1 === 'جنوبًا' ? 'south' : w1 === 'شمالًا' ? 'north' : w1 === 'شرقًا' ? 'east' : 'west'}, then ${d2} km ${w2 === 'شرقًا' ? 'east' : w2 === 'غربًا' ? 'west' : w2 === 'شمالًا' ? 'north' : 'south'}. How far is it from its start, in km?`,
    };
  }
  const va = nz(rng, 6), vb = nz(rng, 6), t = pick(rng, [2, 3, -2, -3, 4]), c2 = vb * t, ans = va * t;
  return {
    eq: `k ${va} ${vb} ${c2}`, answer: signed(ans), wrongs: sgn(ans, [vb * t, -ans, va + t, c2 - vb]),
    ar: `ما قيمة k التي تجعل المتجه ⟨k ، ${signed(c2)}⟩ موازيًا للمتجه ${vec(va, vb)}؟`,
    en: `For which k is the vector ⟨k, ${signed(c2)}⟩ parallel to ${vec(va, vb)}?`,
  };
});

// ─── «الضرب القياسي» (S2 pp.96–101) ──────────────────────────────────────────

const dot = T('g10_dot', /^الضرب القياسي$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 1, 4] : [0, 1, 2, 3, 4]);
  if (k === 0) {
    const u = [nz(rng, 9), nz(rng, 9)], v = [nz(rng, 9), nz(rng, 9)], ans = u[0]! * v[0]! + u[1]! * v[1]!;
    return {
      eq: `${u} · ${v}`, answer: signed(ans),
      wrongs: sgn(ans, [u[0]! * v[1]! + u[1]! * v[0]!, u[0]! * v[0]! - u[1]! * v[1]!, u[0]! + v[0]! + u[1]! + v[1]!, -ans]),
      ar: `أوجد ناتج الضرب القياسي ${vec(u[0]!, u[1]!)} · ${vec(v[0]!, v[1]!)}.`, en: `Find the scalar product ${vec(u[0]!, u[1]!)} · ${vec(v[0]!, v[1]!)}.`,
    };
  }
  if (k === 1) {
    const ma = 2 * int(rng, 1, 9), mb = int(rng, 2, 12), th = pick(rng, [0, 60, 90, 120, 180]);
    const cos = th === 0 ? 1 : th === 60 ? 0.5 : th === 90 ? 0 : th === 120 ? -0.5 : -1, ans = ma * mb * cos;
    return {
      eq: `${ma} ${mb} ${th}`, answer: signed(ans), wrongs: sgn(ans, [ma * mb, -ans, ma * mb / 2, ma + mb].filter(v => v !== ans)),
      ar: `إذا كان |a| = ${ma} و |b| = ${mb}، وقياس الزاوية بين المتجهين a و b هو ${dg(th)}، فما ناتج a · b؟`,
      en: `If |a| = ${ma}, |b| = ${mb} and the angle between a and b is ${th}°, what is a · b?`,
    };
  }
  if (k === 2) {
    const ux = nz(rng, 6), t = nz(rng, 5), uy = ux * t === 0 ? 1 : nz(rng, 6);
    const c = ux * t, ans = -(uy * c) / ux;
    if (!Number.isInteger(ans)) return dot.make({ rng, diff, grade: 10 });
    return {
      eq: `⊥ ${ux} ${uy} ${c}`, answer: signed(ans), wrongs: sgn(ans, [-ans, uy * c, c, ux]),
      ar: `ما قيمة k التي تجعل المتجهين ${vec(ux, uy)} و ⟨k ، ${signed(c)}⟩ متعامدين؟`,
      en: `For which k are ${vec(ux, uy)} and ⟨k, ${signed(c)}⟩ perpendicular?`,
    };
  }
  if (k === 3) {
    const m = int(rng, 1, 6), n = int(rng, 1, 6);
    const [u, v, ang] = pick(rng, [[[m, 0], [n, n], 45], [[m, 0], [-n, n], 135], [[m, n], [-n, m], 90], [[m, n], [2 * m, 2 * n], 0], [[m, n], [-m, -n], 180], [[0, m], [n, n], 45]] as Array<[number[], number[], number]>);
    return {
      eq: `∠ ${u} ${v}`, answer: dg(ang),
      wrongs: wrongsFrom(dg(ang), [dg(180 - ang === ang ? 45 : 180 - ang), dg((ang + 90) % 360), dg(60), dg(30)].filter(s => s !== dg(ang)), j => dg((ang + 15 * Math.abs(j)) % 180)),
      ar: `ما قياس الزاوية بين المتجهين u = ${vec(u[0]!, u[1]!)} و v = ${vec(v[0]!, v[1]!)}؟`,
      en: `What is the angle between u = ${vec(u[0]!, u[1]!)} and v = ${vec(v[0]!, v[1]!)}?`,
    };
  }
  const F = 10 * int(rng, 2, 9), d = 2 * int(rng, 2, 15), th = pick(rng, [0, 60, 60]);
  const ans = th === 0 ? F * d : (F * d) / 2;
  return {
    eq: `W ${F} ${d} ${th}`, answer: String(ans), wrongs: pos(ans, [F * d === ans ? F * d / 2 : F * d, F + d, ans * 2, F * d / 4]),
    ar: `دفع محمد عربة بقوة مقدارها ${F} N تصنع زاوية ${dg(th)} مع اتجاه الحركة، فتحركت العربة ${d} m. ما مقدار الشغل الذي بذله بالجول؟ (بإهمال الاحتكاك)`,
    en: `Mohammad pushes a cart with a ${F} N force at ${th}° to the direction of motion, and it moves ${d} m. How much work does he do, in joules? (ignore friction)`,
  };
});

// ─── «معمل برمجية جيوجبرا» (S2 pp.115–116: scatter plots, the line of best fit) ─

const scatterTopic = STATS_TOPICS.find(t => t.id === 'scatter')!;
const scatterLab = T('g10_scatter_lab', /^معمل برمجيه جيوجبرا$/, c => {
  for (let i = 0; i < 20; i++) {
    const d = scatterTopic.make(c);
    if (d.wrongs.length === 3) return d;
    // the correlation kind has two wrong options; a fourth is a real misreading of a plot
    if (d.wrongs.length === 2) return { ...d, wrongs: [...d.wrongs, 'لا يمكن تحديد نوعه من النقاط'] };
  }
  return scatterTopic.make(c);
});

// ─── «احتمالات الحوادث المتنافية» (S2 pp.131–138) ───────────────────────────

const exclusive = T('g10_exclusive', /^احتمالات الحوادث المتنافيه$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 3, 6] : [0, 1, 2, 3, 4, 5, 6]);
  if (k === 6) {
    const N = int(rng, 12, 30), m = pick(rng, [3, 5]);
    let c = 0;
    for (let x = 1; x <= N; x++) if (x % 2 === 0 || x % m === 0) c++;
    const ev = Math.floor(N / 2), mm = Math.floor(N / m), both = Math.floor(N / (2 * m));
    return {
      eq: `${N} even or ${m}`, answer: sfrac(c, N),
      wrongs: frOpts(c, N, [[ev + mm, N], [ev, N], [both, N], [c - 1, N]]),
      ar: `صندوق فيه ${N} ${N <= 10 ? 'بطاقات' : 'بطاقةً'} مرقّمة من 1 إلى ${N}. سُحبت بطاقة عشوائيًا. ما احتمال أن يكون العدد عليها زوجيًا أو من مضاعفات العدد ${m}؟`,
      en: `A box holds ${N} cards numbered 1 to ${N}. One is drawn at random. What is the probability that its number is even or a multiple of ${m}?`,
    };
  }
  if (k === 0) {
    const a = 5 * int(rng, 1, 9), b = 5 * int(rng, 1, 19 - a / 5);
    return {
      eq: `excl ${a} ${b}`, answer: pr(a + b), wrongs: prOpts(a + b, [Math.round((a * b) / 100), Math.abs(a - b), 100 - a - b]),
      ar: `إذا كان A و B حادثين متنافيين في تجربة عشوائية، وكان P(A) = ${pr(a)} و P(B) = ${pr(b)}، فما P(A ∪ B)؟`,
      en: `A and B are mutually exclusive events with P(A) = ${pr(a)} and P(B) = ${pr(b)}. What is P(A ∪ B)?`,
    };
  }
  if (k === 3) {
    const a = 5 * int(rng, 1, 19);
    return {
      eq: `comp ${a}`, answer: pr(100 - a), wrongs: prOpts(100 - a, [a, 50, Math.abs(100 - 2 * a)].filter(v => v !== 100 - a)),
      ar: `إذا كان P(A) = ${pr(a)}، فما احتمال متممة الحادث A؟`, en: `If P(A) = ${pr(a)}, what is the probability of the complement of A?`,
    };
  }
  // A, B, A∩B in hundredths, with P(A ∪ B) < 1
  let a = 0, b = 0, ab = 0;
  for (;;) {
    a = 5 * int(rng, 4, 15); b = 5 * int(rng, 4, 15); ab = 5 * int(rng, 1, Math.min(a, b) / 5 - 1);
    if (a + b - ab < 100) break;
  }
  const u = a + b - ab;
  const given = `P(A) = ${pr(a)} و P(B) = ${pr(b)}`;
  if (k === 2) {
    return {
      eq: `∩ ${a} ${b} ${u}`, answer: pr(ab), wrongs: prOpts(ab, [a + b - ab === u ? Math.round((a * b) / 100) : ab + 5, u - a, 100 - u, Math.abs(a - b)]),
      ar: `إذا كان A و B حادثين في تجربة عشوائية، وكان ${given} و P(A ∪ B) = ${pr(u)}، فما P(A ∩ B)؟`,
      en: `A and B are events with P(A) = ${pr(a)}, P(B) = ${pr(b)} and P(A ∪ B) = ${pr(u)}. What is P(A ∩ B)?`,
    };
  }
  const full = `إذا كان A و B حادثين غير متنافيين في تجربة عشوائية، وكان ${given} و P(A ∩ B) = ${pr(ab)}، `;
  const fullEn = `A and B are events with P(A) = ${pr(a)}, P(B) = ${pr(b)} and P(A ∩ B) = ${pr(ab)}. `;
  if (k === 1) {
    return {
      eq: `∪ ${a} ${b} ${ab}`, answer: pr(u), wrongs: prOpts(u, [a + b < 100 ? a + b : u + 10, a + b - 2 * ab, 100 - u]),
      ar: `${full}فما P(A ∪ B)؟`, en: `${fullEn}What is P(A ∪ B)?`,
    };
  }
  if (k === 4) {
    return {
      eq: `only ${a} ${ab}`, answer: pr(a - ab), wrongs: prOpts(a - ab, [a, b - ab, u - b === a - ab ? ab : u - b, a + ab]),
      ar: `${full}فما احتمال وقوع الحادث A فقط؟`, en: `${fullEn}What is the probability that only A happens?`,
    };
  }
  return {
    eq: `neither ${a} ${b} ${ab}`, answer: pr(100 - u), wrongs: prOpts(100 - u, [u, 100 - a - b > 0 ? 100 - a - b : ab, ab, 100 - ab]),
    ar: `${full}فما احتمال عدم وقوع أيٍّ من الحادثين؟`, en: `${fullEn}What is the probability that neither happens?`,
  };
});

// ─── «احتمالات الحوادث المستقلة والحوادث غير المستقلة» (S2 pp.139–147) ──────

const DIE_EVENTS: Array<[string, string, number[]]> = [
  ['عدد فردي', 'an odd number', [1, 3, 5]], ['عدد زوجي', 'an even number', [2, 4, 6]], ['عدد أولي', 'a prime', [2, 3, 5]],
  ['عدد أكبر من 4', 'a number greater than 4', [5, 6]], ['عدد أكبر من 3', 'a number greater than 3', [4, 5, 6]],
  ['عدد أقل من 3', 'a number less than 3', [1, 2]], ['العدد 6', 'a 6', [6]], ['عدد من مضاعفات 3', 'a multiple of 3', [3, 6]],
];
/** «زوجيًا»: the condition phrase as an adjective after «إذا كان العدد الظاهر». */
const CONDITIONS: Array<[string, string, number[]]> = [
  ['زوجيًا', 'even', [2, 4, 6]], ['فرديًا', 'odd', [1, 3, 5]], ['أقل من 5', 'less than 5', [1, 2, 3, 4]], ['أوليًا', 'prime', [2, 3, 5]],
];
const independent = T('g10_independent', /^احتمالات الحوادث المستقله والحوادث غير المستقله$/, ({ rng, diff }) => {
  const k = pick(rng, diff === 'easy' ? [0, 2, 3] : [0, 1, 2, 3, 4, 5]);
  if (k === 0) {
    const a = int(rng, 1, 9), b = int(rng, 1, 9), ans = a * b;
    return {
      eq: `ind ${a} ${b}`, answer: pr(ans), wrongs: prOpts(ans, [10 * (a + b) < 100 ? 10 * (a + b) : ans + 10, 10 * Math.abs(a - b) || ans + 5, 100 - ans]),
      ar: `إذا كان A و B حادثين مستقلين في تجربة عشوائية، وكان P(A) = ${pr(10 * a)} و P(B) = ${pr(10 * b)}، فما P(A ∩ B)؟`,
      en: `A and B are independent events with P(A) = ${pr(10 * a)} and P(B) = ${pr(10 * b)}. What is P(A ∩ B)?`,
    };
  }
  if (k === 1) {
    const b = int(rng, 2, 9), c = int(rng, 1, 9), ab = b * c;
    return {
      eq: `cond ${ab} ${b}`, answer: pr(10 * c), wrongs: prOpts(10 * c, [ab, 10 * b, 100 - 10 * c]),
      ar: `إذا كان P(A ∩ B) = ${pr(ab)} و P(B) = ${pr(10 * b)}، فما P(A | B)؟`,
      en: `If P(A ∩ B) = ${pr(ab)} and P(B) = ${pr(10 * b)}, what is P(A | B)?`,
    };
  }
  if (k === 2) {
    const [e1, e1en, s1] = pick(rng, DIE_EVENTS), [e2, e2en, s2] = pick(rng, DIE_EVENTS);
    const n = s1.length * s2.length;
    return {
      eq: `dice ${e1} ${e2}`, answer: sfrac(n, 36),
      wrongs: frOpts(n, 36, [[s1.length + s2.length, 36], [s1.length + s2.length, 12], [s1.length * s2.length, 6]]),
      ar: `أُلقي حجرا نرد منتظمان معًا مرة واحدة. ما احتمال ظهور ${e1} على الأول وظهور ${e2} على الثاني؟`,
      en: `Two fair dice are thrown together. What is the probability of ${e1en} on the first and ${e2en} on the second?`,
    };
  }
  if (k === 3 || k === 4) {
    const r = int(rng, 3, 8), g = int(rng, 3, 8), n = r + g, red = rng() < 0.5, c = red ? r : g;
    const back = k === 3;
    const num = back ? c * c : c * (c - 1), den = back ? n * n : n * (n - 1);
    return {
      eq: `${r}R ${g}G ${back ? 'with' : 'without'} ${red ? 'R' : 'G'}`, answer: sfrac(num, den),
      wrongs: frOpts(num, den, back ? [[c * (c - 1), n * (n - 1)], [c, n], [2 * c, n * n]] : [[c * c, n * n], [c, n], [c * (c - 1), n * n]]),
      ar: `كيس فيه ${r} كرات حمراء و${g} كرات خضراء متماثلة. سُحبت منه كرة عشوائيًا ${back ? 'ثم أُعيدت إليه' : 'دون إرجاعها'}، ثم سُحبت كرة أخرى. ما احتمال أن تكون الكرتان ${red ? 'حمراوين' : 'خضراوين'}؟`,
      en: `A bag holds ${r} red and ${g} green identical balls. One is drawn at random ${back ? 'and put back' : 'and not put back'}, then a second is drawn. What is the probability that both are ${red ? 'red' : 'green'}?`,
    };
  }
  for (;;) {
    const [ea, eaEn, sa] = pick(rng, DIE_EVENTS), [eb, ebEn, sb] = pick(rng, CONDITIONS);
    const both = sa.filter(x => sb.includes(x)).length;
    if (both === 0 || both === sb.length || both === sa.length) continue;
    return {
      eq: `cond die ${ea} | ${eb}`, answer: sfrac(both, sb.length),
      wrongs: frOpts(both, sb.length, [[both, 6], [sa.length, 6], [both, sa.length], [sb.length, 6]]),
      ar: `أُلقي حجر نرد منتظم مرة واحدة. ما احتمال ظهور ${ea} إذا كان العدد الظاهر ${eb}؟`,
      en: `A fair die is thrown once. What is the probability of ${eaEn}, given that the number shown is ${ebEn}?`,
    };
  }
});

export const G10B_TOPICS: readonly Topic[] = [
  arcs, composition, inverse, sequences, slope, derivative, extrema, vectors, vectorOps, dot, scatterLab, exclusive, independent,
];
void gcd;
