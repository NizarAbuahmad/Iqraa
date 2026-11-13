/**
 * The four Grade 8 Semester 2 lessons that had no offline questions until
 * 2026-11-13 (`../g8.ts`): «رسم الأشكال ثلاثيّة الأبعاد», «المقاطع والمجسّمات
 * الدّورانيّة», «الرُّبَيعيّات» and «اختيار التمثيل الأنسب». There is no
 * extracted Grade 8 book, so the kinds follow the lessons' NCCD objectives.
 *
 * Every key is recomputed from the numbers printed in its own stem by a route
 * that shares no code with the generator: a voxel set for the views of a cube
 * stack, numerical integration of the turned profile for a solid of revolution,
 * a brute-force reflection test on real vertex coordinates for planes of
 * symmetry, an independent sort-and-halve for quartiles.
 *
 * QUARTILE METHOD (the one every quartile stem states): Q2 is the median; Q1 and
 * Q3 are the medians of the lower and upper halves of the ordered data, and the
 * median is left out of both halves when the number of values is odd. Known
 * textbook cases pin the helper below (`quartile method`).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G8_TOPICS } from '../g8.ts';
import { mathBankCovers, takeElementaryMath, type ConcreteItem, type DiffTier } from '../index.ts';

const TIERS: DiffTier[] = ['easy', 'medium', 'hard'];
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draws(id: string, n = 500): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 8, TIERS[i % 3]!, new Set(), seeded(i * 15485863 + 41)));
}
const seen = new Map<string, Set<string>>();
const saw = (id: string, kind: string) => seen.set(id, (seen.get(id) ?? new Set()).add(kind));
const has = (s: string, w: string) => s.includes(w);
const coef = (s: string) => (s === 'π' ? 1 : Number(s.replace('π', '')));
const near = (a: number, b: number, where: string, tol = 1e-6) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${a} ≠ ${b}: ${where}`);
/** Midpoint rule. */
const integrate = (f: (t: number) => number, a: number, b: number, n = 4000) => {
  let s = 0;
  const h = (b - a) / n;
  for (let i = 0; i < n; i++) s += f(a + (i + 0.5) * h);
  return s * h;
};

const TITLES = {
  g8_draw_3d: 'رَسْمُ الأَشْكالِ ثُلاثِيَّةِ الأَبْعادِ',
  g8_solids_revolution: 'المقاطع والمجسّمات الدّورانيّة',
  g8_quartiles: 'الرُّبَيعيّات',
  g8_best_chart: 'اختيار التمثيل الأنسب',
};

describe('Grade 8 lessons that had no offline questions: routing', () => {
  for (const [id, title] of Object.entries(TITLES)) {
    it(`«${title}» reaches ${id} in Grade 8, and nowhere else`, () => {
      assert.equal(topicFor(title, 8)?.id, id);
      assert.ok(mathBankCovers(title, null, 8), 'covered');
      const q = takeElementaryMath('short_answer', title, null, 8, 'medium', 'ar', 2);
      assert.ok(q && q.text && q.answer, 'an item comes back');
      // Grades 7, 9 and 10 have lessons with these words; none of them may be served this lesson's items
      for (const g of [1, 2, 3, 4, 5, 6, 7, 9, 10, 11, 12]) {
        const t = topicFor(title, g);
        assert.ok(!t || !t.id.startsWith('g8_'), `Grade ${g} «${title}» captured by ${t?.id}`);
      }
    });
  }

  it('the generators cover only Grade 8 and are not reached by a similar title', () => {
    for (const t of G8_TOPICS) assert.deepEqual(t.grades, [8, 8], t.id);
    for (const title of ['الربيعيات والمدى الربيعي', 'التمثيل الأنسب', 'رسم الأشكال', 'المقاطع المخروطية', 'المجسمات الدورانية', 'تمثيل البيانات']) {
      assert.ok(!topicFor(title, 8)?.id.startsWith('g8_'), title);
    }
  });

  it('every title written the way the catalog writes it (diacritics, ى, ة) is found', () => {
    for (const [id, title] of [
      ['g8_draw_3d', 'رسم الأشكال ثلاثيّة الأبعاد'], ['g8_draw_3d', 'رسم الاشكال ثلاثية الابعاد'],
      ['g8_solids_revolution', 'المقاطع والمجسَّمات الدَّوَرانيَّة'], ['g8_quartiles', 'الرُّبَيعيَّات'], ['g8_quartiles', 'الربيعيات'],
      ['g8_best_chart', 'اختيارُ التمثيلِ الأنسبِ'],
    ] as const) assert.equal(topicFor(title, 8)?.id, id, title);
  });
});

describe('Grade 8 generators: shape', () => {
  for (const t of G8_TOPICS) {
    it(`${t.id}: distinct options, clean text, never verified, no check, both languages`, () => {
      for (const item of draws(t.id)) {
        const where = `${t.id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        assert.ok(!('check' in item) && !('verified' in item), `carries a check: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{3,}/.test(s), `unrounded number: ${s}`);
        }
        // the maths is latin digits; Arabic-Indic digits belong to display
        assert.ok(!/[٠-٩]/.test(item.promptAr! + item.answer + item.wrongs.join('')), where);
        for (const s of [item.answer, ...item.wrongs]) if (/^\d+$/.test(s)) assert.ok(Number(s) > 0 || /صفر/.test(item.promptAr!), `non-positive option: ${where}`);
      }
    });
    it(`${t.id}: a quiz of ten finds ten different questions`, () => {
      for (const seed of [1, 2, 3]) {
        const used = new Set<string>();
        const rng = seeded(seed * 977);
        const stems = Array.from({ length: 10 }, (_, i) => makeTopicItem(t, 8, TIERS[i % 3]!, used, rng).promptAr);
        assert.ok(new Set(stems).size >= 9, `${t.id} seed ${seed}: ${new Set(stems).size} of 10`);
      }
    });
  }
});

// ─── u8_l1 ───────────────────────────────────────────────────────────────────

const ADJ_N: Record<string, number> = { 'مثلثية': 3, 'رباعية': 4, 'خماسية': 5, 'سداسية': 6 };

describe('g8_draw_3d: answers recomputed from the stem', () => {
  it('views of a cube stack come from a voxel set', () => {
    const asked = new Set<string>();
    for (const item of draws('g8_draw_3d')) {
      const p = item.promptAr!;
      if (!has(p, 'الصف الأمامي:')) continue;
      const m = p.match(/الصف الأمامي: ([\d ،]+)؛ الصف الخلفي: ([\d ،]+)\./)!;
      const rows = [m[1]!, m[2]!].map(r => r.split(' ، ').map(Number));
      const cubes = new Set<string>();
      rows.forEach((row, r) => row.forEach((h, c) => { for (let z = 0; z < h; z++) cubes.add(`${r},${c},${z}`); }));
      const cells = [...cubes].map(s => s.split(',').map(Number) as [number, number, number]);
      const project = (key: (c: [number, number, number]) => string) => new Set(cells.map(key)).size;
      let want: number;
      if (has(p, 'المسقط العلوي')) { asked.add('top'); want = project(([r, c]) => `${r},${c}`); }
      else if (has(p, 'المسقط الأمامي')) { asked.add('front'); want = project(([, c, z]) => `${c},${z}`); }
      else if (has(p, 'المسقط الجانبي')) { asked.add('side'); want = project(([r, , z]) => `${r},${z}`); }
      else { asked.add('total'); assert.ok(has(p, 'كم مكعّبًا'), p); want = cubes.size; }
      assert.equal(Number(item.answer), want, p);
      assert.equal(rows[0]!.length, rows[1]!.length, p);
    }
    assert.equal(asked.size, 4, `asked: ${[...asked]}`);
    saw('g8_draw_3d', 'stack');
  });

  it('the shape of a projection follows from the solid', () => {
    // each solid is described by its outline seen from above (top) and from the front
    const outline = (solid: string, view: 'top' | 'front'): string => {
      if (has(solid, 'نصف كرة')) return view === 'top' ? 'دائرة' : 'نصف دائرة';
      if (has(solid, 'كرة')) return 'دائرة';
      if (has(solid, 'أسطوانة')) return view === 'top' ? 'دائرة' : 'مستطيل';
      if (has(solid, 'مخروط')) return view === 'top' ? 'دائرة' : 'مثلث';
      if (has(solid, 'منشور ثلاثي')) return view === 'top' ? 'مثلث' : 'مستطيل';
      if (has(solid, 'هرم رباعي')) { assert.equal(view, 'front'); return 'مثلث'; }
      if (has(solid, 'مكعب')) return 'مربع';
      if (has(solid, 'متوازي مستطيلات')) return 'مستطيل';
      throw new Error(`unknown solid ${solid}`);
    };
    const solids = new Set<string>();
    for (const item of draws('g8_draw_3d')) {
      const m = item.promptAr!.match(/^ما شكل المسقط (العلوي|الأمامي|الجانبي) ل(.+)؟$/);
      if (!m) continue;
      const view = m[1] === 'العلوي' ? 'top' : 'front'; // a side view of a sphere is the only «side»: same as front
      solids.add(m[2]!);
      assert.equal(item.answer, outline(m[2]!, view), item.promptAr);
      // a square is a rectangle: never offer both
      assert.ok(!(item.wrongs.includes('مستطيل') && item.answer === 'مربع') && !(item.wrongs.includes('مربع') && item.answer === 'مستطيل'), item.promptAr);
    }
    assert.ok(solids.size >= 8, `solids drawn: ${solids.size}`);
    saw('g8_draw_3d', 'projection');
  });

  it("Euler's relation, checked against real prisms and pyramids", () => {
    // every polyhedron the generator can name: (F, V, E)
    const real = new Set<string>();
    for (let n = 3; n <= 8; n++) {
      real.add([n + 2, 2 * n, 3 * n].join()); // prism
      real.add([n + 1, n + 1, 2 * n].join()); // pyramid
    }
    for (const item of draws('g8_draw_3d')) {
      const p = item.promptAr!;
      if (!has(p, 'علاقة أويلر')) continue;
      const given = new Map<string, number>();
      for (const [re, k] of [[/(\d+) (?:أوجه|وجهًا|وجه)(?![؀-ۿ])/, 'F'], [/(\d+) (?:رؤوس|رأسًا|رأس)(?![؀-ۿ])/, 'V'], [/(\d+) (?:أحرف|حرفًا|حرف)(?![؀-ۿ])/, 'E']] as const) {
        const mm = p.split('بحسب')[0]!.match(re);
        if (mm) given.set(k, Number(mm[1]));
      }
      assert.equal(given.size, 2, p);
      const ask = has(p, 'كم حرفًا') ? 'E' : has(p, 'كم وجهًا') ? 'F' : 'V';
      assert.ok(!given.has(ask), p);
      const all = { ...Object.fromEntries(given), [ask]: Number(item.answer) } as Record<'F' | 'V' | 'E', number>;
      assert.equal(all.V - all.E + all.F, 2, p);
      assert.ok(real.has([all.F, all.V, all.E].join()), `no prism or pyramid has F V E = ${all.F} ${all.V} ${all.E}: ${p}`);
      saw('g8_draw_3d', `euler ${ask}`);
    }
    assert.equal([...(seen.get('g8_draw_3d') ?? [])].filter(k => k.startsWith('euler')).length, 3);
  });

  it('a net is built piece by piece and counted', () => {
    for (const item of draws('g8_draw_3d')) {
      const p = item.promptAr!;
      const m = p.match(/في شبكة (منشور|هرم) قاعدته (\S+?)(?:،|؟)/);
      if (!m) continue;
      const n = ADJ_N[m[2]!]!;
      assert.ok(n, p);
      const net = m[1] === 'منشور'
        ? [...Array(n).fill('rect'), 'base', 'base']
        : [...Array(n).fill('tri'), 'base'];
      if (has(p, 'مثلثًا جانبيًّا')) { saw('g8_draw_3d', 'net triangles'); assert.equal(Number(item.answer), net.filter(x => x === 'tri').length, p); }
      else { saw('g8_draw_3d', 'net total'); assert.equal(Number(item.answer), net.length, p); }
    }
    for (const k of ['net triangles', 'net total']) assert.ok(seen.get('g8_draw_3d')!.has(k), k);
  });
});

// ─── u8_l2 ───────────────────────────────────────────────────────────────────

/** The radius of a turned profile at height y, from the figure's name alone. */
type Profile = { r: (y: number) => number; h: number };
const profileOf = (fig: string): 'const' | 'taper' | 'circle' | 'frustum' => {
  if (fig === 'مستطيل' || fig === 'مربع') return 'const';
  if (fig.startsWith('مثلث')) return 'taper';
  if (fig === 'نصف دائرة' || fig === 'دائرة') return 'circle';
  if (fig.startsWith('شبه منحرف')) return 'frustum';
  throw new Error(fig);
};
const NAME_OF: Record<string, string> = { const: 'أسطوانة', taper: 'مخروط', circle: 'كرة', frustum: 'مخروط ناقص' };

function lateral(pr: Profile): number {
  // 2π ∫ r ds, ds = √(1 + r'^2) dy
  const d = 1e-6;
  return integrate(y => 2 * Math.PI * pr.r(y) * Math.sqrt(1 + (((pr.r(y + d) - pr.r(y - d)) / (2 * d)) ** 2)), 0, pr.h, 20000);
}

describe('g8_solids_revolution: answers recomputed from the stem', () => {
  it('the solid a figure makes is read off the turned profile', () => {
    let n = 0;
    for (const item of draws('g8_solids_revolution')) {
      const m = item.promptAr!.match(/^(?:يدور|تدور) (.+?) دورة كاملة حول (.+)\. ما اسم المجسّم الناتج؟$/);
      if (!m) continue;
      n++;
      assert.equal(item.answer, NAME_OF[profileOf(m[1]!)], item.promptAr);
      if (m[1]!.startsWith('مثلث متطابق')) assert.ok(has(m[2]!, 'ارتفاعه'), 'an isosceles triangle makes a cone only about its altitude');
      assert.ok(!has(m[1]!, 'دائرة') || /قطر|أقطار/.test(m[2]!), item.promptAr);
      assert.equal(item.promptAr!.startsWith(m[1] === 'دائرة' ? 'تدور' : 'يدور'), true, 'verb agrees');
    }
    assert.ok(n > 20);
    saw('g8_solids_revolution', 'name');
  });

  it('cylinder and cone dimensions, volume and surface come from integrating the profile', () => {
    for (const item of draws('g8_solids_revolution')) {
      const p = item.promptAr!;
      let m = p.match(/^يدور مستطيل بُعداه (\d+) سم و(\d+) سم دورة كاملة حول الضلع الذي طوله (\d+) سم\. (.+)$/);
      let pr: Profile | null = null;
      let kind = '';
      let radius = 0, height = 0;
      if (m) {
        const [x, y, ax] = [Number(m[1]), Number(m[2]), Number(m[3])];
        assert.ok(ax === x || ax === y, p);
        radius = ax === x ? y : x; height = ax;
        pr = { r: () => radius, h: height }; kind = 'cyl';
      } else if ((m = p.match(/^يدور مثلث قائم الزاوية طولا ضلعيه القائمين (\d+) سم و(\d+) سم دورة كاملة حول الضلع الذي طوله (\d+) سم\. (.+)$/))) {
        const [x, y, ax] = [Number(m[1]), Number(m[2]), Number(m[3])];
        assert.ok(ax === x || ax === y, p);
        radius = ax === x ? y : x; height = ax;
        pr = { r: t => radius * (1 - t / height), h: height }; kind = 'cone';
      }
      if (!pr) continue;
      const ask = m![4]!;
      const disks = (pr.r(0) ** 2 + pr.r(pr.h) ** 2) * Math.PI;
      if (has(ask, 'نصف قطر')) near(Number(item.answer), radius, p);
      else if (has(ask, 'ارتفاع')) near(Number(item.answer), height, p);
      else if (has(ask, 'طول راسم')) near(Number(item.answer), Math.hypot(radius, height), p);
      else if (has(ask, 'حجم')) near(coef(item.answer), integrate(y => pr!.r(y) ** 2, 0, pr.h), p, 1e-6);
      else { assert.ok(has(ask, 'المساحة الكلية'), p); near(coef(item.answer) * Math.PI, lateral(pr) + disks, p, 1e-4); }
      if (has(ask, 'حجم') || has(ask, 'المساحة')) assert.ok(item.answer.endsWith('π'), p);
      saw('g8_solids_revolution', `${kind} ${has(ask, 'نصف قطر') ? 'r' : has(ask, 'ارتفاع') ? 'h' : has(ask, 'راسم') ? 'l' : has(ask, 'حجم') ? 'v' : 's'}`);
    }
    for (const k of ['cyl r', 'cyl h', 'cyl v', 'cyl s', 'cone r', 'cone h', 'cone l', 'cone v', 'cone s']) assert.ok(seen.get('g8_solids_revolution')!.has(k), `never asked: ${k}`);
  });

  it('a sphere, from a semicircle turned about its diameter', () => {
    let n = 0;
    for (const item of draws('g8_solids_revolution')) {
      const m = item.promptAr!.match(/^يدور نصف دائرة نصف قطره (\d+) سم دورة كاملة حول قطره\. ما (حجم|مساحة سطح) المجسّم الناتج بدلالة π \((?:سم³|سم²)\)؟$/);
      if (!m) continue;
      n++;
      const r = Number(m[1]);
      // x = r sinθ, y = −r cosθ on [0, π]: the turned semicircle
      const want = m[2] === 'حجم'
        ? integrate(t => Math.PI * (r * Math.sin(t)) ** 2 * r * Math.sin(t), 0, Math.PI) // π x² dy, dy = r sinθ dθ
        : integrate(t => 2 * Math.PI * (r * Math.sin(t)) * r, 0, Math.PI); // 2π x ds, ds = r dθ
      near(coef(item.answer), want / Math.PI, item.promptAr!, 1e-5);
    }
    assert.ok(n > 10);
  });

  it('the shape of a cross-section follows from the solid and the plane', () => {
    const baseOf = (s: string): 'circle' | 'square' | 'rect' | 'tri' | 'sphere' => {
      if (has(s, 'كرة')) return 'sphere';
      if (has(s, 'أسطوانة') || has(s, 'مخروط')) return 'circle';
      if (has(s, 'مكعب') || has(s, 'هرم رباعي')) return 'square';
      if (has(s, 'متوازي مستطيلات')) return 'rect';
      if (has(s, 'مثلث') || has(s, 'ثلاثي')) return 'tri'; // a triangular prism, a triangular-based pyramid
      throw new Error(s);
    };
    const NAME = { circle: 'دائرة', square: 'مربع', rect: 'مستطيل', tri: 'مثلث' } as const;
    const pointed = (s: string) => has(s, 'مخروط') || has(s, 'هرم');
    let n = 0;
    for (const item of draws('g8_solids_revolution')) {
      const m = item.promptAr!.match(/^ما شكل المقطع الناتج عند قطع (.+?) (بمستوٍ.+|بأي مستوٍ يقطعها)؟$/);
      if (!m) continue;
      n++;
      const [solid, plane] = [m[1]!, m[2]!];
      const b = baseOf(solid);
      let want: string;
      if (b === 'sphere') want = 'دائرة';
      else if (has(plane, 'يوازي')) want = NAME[b]; // parallel to a base (or a face): the base's shape
      else if (has(plane, 'يمرّ بمحورها')) want = 'مستطيل'; // axial section of a cylinder
      else if (has(plane, 'يمرّ برأسه ومحوره')) want = 'مثلث'; // axial section of a cone
      else if (has(plane, 'عمودي على القاعدتين')) want = 'مستطيل'; // a prism cut parallel to a side face
      else throw new Error(plane);
      assert.equal(item.answer, want, item.promptAr);
      // a cone or pyramid sliced parallel to its base is a smaller copy of the base, never a different shape
      if (pointed(solid) && has(plane, 'يوازي')) assert.equal(want, NAME[b as 'circle']);
      assert.ok(!(item.wrongs.includes('مستطيل') && item.answer === 'مربع') && !(item.wrongs.includes('مربع') && item.answer === 'مستطيل'), item.promptAr);
    }
    assert.ok(n > 20);
  });

  it('the area of a cross-section is measured from its outline', () => {
    const shoelace = (pts: Array<[number, number]>) => Math.abs(pts.reduce((s, [x, y], i) => { const [x2, y2] = pts[(i + 1) % pts.length]!; return s + (x * y2 - x2 * y); }, 0)) / 2;
    const kinds = new Set<string>();
    for (const item of draws('g8_solids_revolution')) {
      const p = item.promptAr!;
      let m = p.match(/^أسطوانة قائمة نصف قطر قاعدتها (\d+) سم وارتفاعها (\d+) سم، قُطعت بمستوٍ رأسي يمرّ بمحورها\./);
      if (m) { const [r, h] = [Number(m[1]), Number(m[2])]; kinds.add('cylAxis'); assert.equal(Number(item.answer), shoelace([[-r, 0], [r, 0], [r, h], [-r, h]]), p); continue; }
      m = p.match(/^أسطوانة قائمة نصف قطر قاعدتها (\d+) سم وارتفاعها (\d+) سم، قُطعت بمستوٍ يوازي قاعدتيها\./);
      if (m) { kinds.add('cylBase'); near(coef(item.answer), integrate(x => 2 * x, 0, Number(m[1])), p, 1e-6); continue; } // ∫ 2πx dx = πr²
      m = p.match(/^مخروط قائم نصف قطر قاعدته (\d+) سم وارتفاعه (\d+) سم، قُطع بمستوٍ رأسي يمرّ برأسه ومحوره\./);
      if (m) { const [r, h] = [Number(m[1]), Number(m[2])]; kinds.add('coneAxis'); assert.equal(Number(item.answer), shoelace([[-r, 0], [r, 0], [0, h]]), p); continue; }
      m = p.match(/^كرة نصف قطرها (\d+) سم، قُطعت بمستوٍ يمرّ بمركزها\./);
      if (m) { kinds.add('sphere'); near(coef(item.answer), integrate(x => 2 * x, 0, Number(m[1])), p, 1e-6); continue; }
      m = p.match(/^متوازي مستطيلات أبعاده (\d+) سم و(\d+) سم و(\d+) سم، قُطع بمستوٍ يوازي الوجه الذي بعداه (\d+) سم و(\d+) سم\./);
      if (m) { kinds.add('cuboid'); const [a, b, c] = [1, 2, 3].map(i => Number(m![i])); assert.deepEqual([Number(m[4]), Number(m[5])], [a, c]); assert.equal(Number(item.answer), a! * c!, p); continue; }
    }
    assert.equal(kinds.size, 5, `kinds: ${[...kinds]}`);
  });

  it('planes of symmetry are counted by reflecting real vertices', () => {
    type V3 = [number, number, number];
    const polygon = (n: number): Array<[number, number]> => Array.from({ length: n }, (_, i) => [Math.cos((2 * Math.PI * i) / n), Math.sin((2 * Math.PI * i) / n)]);
    const prism = (n: number, h: number): V3[] => polygon(n).flatMap(([x, y]) => [[x, y, h], [x, y, -h]] as V3[]);
    const pyramid = (n: number): V3[] => [...polygon(n).map(([x, y]) => [x, y, 0] as V3), [0, 0, 1.37]];
    /** Planes of symmetry of a finite vertex set: a plane that swaps two vertices is their perpendicular bisector, so try those. */
    const planesOf = (vs: V3[]): number => {
      const key = (v: V3) => v.map(c => Math.round(c * 1e6) / 1e6 + 0).join();
      const set = new Set(vs.map(key));
      const found = new Set<string>();
      for (let i = 0; i < vs.length; i++) for (let j = i + 1; j < vs.length; j++) {
        const n = vs[j]!.map((c, k) => c - vs[i]![k]!) as V3;
        const len = Math.hypot(...n);
        const u = n.map(c => c / len) as V3;
        const mid = vs[i]!.map((c, k) => (c + vs[j]![k]!) / 2) as V3;
        const d = u[0] * mid[0] + u[1] * mid[1] + u[2] * mid[2];
        const reflect = (v: V3) => { const s = 2 * (u[0] * v[0] + u[1] * v[1] + u[2] * v[2] - d); return v.map((c, k) => c - s * u[k]!) as V3; };
        if (!vs.every(v => set.has(key(reflect(v))))) continue;
        const sign = u.find(c => Math.abs(c) > 1e-9)! < 0 ? -1 : 1;
        found.add([...u.map(c => sign * c), sign * d].map(c => (Math.round(c * 1e6) / 1e6 + 0).toFixed(5)).join());
      }
      return found.size;
    };
    // the helper itself, on solids whose count is known to everyone
    assert.equal(planesOf([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]), 6, 'regular tetrahedron');
    assert.equal(planesOf(prism(4, Math.SQRT2 / 2)), 9, 'cube');
    assert.equal(planesOf(prism(4, 1)), 5, 'a square prism that is not a cube');
    const regular: Record<string, number> = { 'مثلث متطابق الأضلاع': 3, 'مربع': 4, 'مخمّس منتظم': 5, 'مسدّس منتظم': 6 };
    let n = 0;
    for (const item of draws('g8_solids_revolution')) {
      const m = item.promptAr!.match(/^كم مستوى تماثل ل(.+)؟$/);
      if (!m) continue;
      n++;
      const s = m[1]!;
      let want: number | null;
      if (has(s, 'متوازي مستطيلات')) want = planesOf([1.5, -1.5].flatMap(x => [2, -2].flatMap(y => [2.5, -2.5].map(z => [x, y, z] as V3)))); // 3 × 4 × 5
      else if (has(s, 'مكعب')) want = planesOf(prism(4, Math.SQRT2 / 2)); // a square ring of circumradius 1 has side √2, so half-height √2/2 makes a cube
      else if (has(s, 'منشور رباعي قائم قاعدته مربعة')) want = planesOf(prism(4, 0.6));
      else if (has(s, 'منشور قائم قاعدته')) want = planesOf(prism(regular[s.replace('منشور قائم قاعدته ', '')]!, 0.6));
      else if (has(s, 'هرم قاعدته')) want = planesOf(pyramid(regular[s.replace('هرم قاعدته ', '').replace(' ورأسه فوق مركز القاعدة تمامًا', '')]!));
      else if (has(s, 'رباعي أوجه منتظم')) want = 6;
      else if (['أسطوانة قائمة', 'مخروط قائم', 'كرة'].includes(s)) want = null; // a turned solid: every plane through its axis, so no finite count
      else throw new Error(s);
      assert.equal(item.answer, want === null ? 'عدد لا نهائي' : String(want), item.promptAr);
    }
    assert.ok(n > 20);
  });

  it('a prism with a compound base: cells of the base are counted, then multiplied by the height', () => {
    let cut = 0, join = 0;
    for (const item of draws('g8_solids_revolution')) {
      const p = item.promptAr!;
      let m = p.match(/^قاعدة منشور قائم مستطيل بُعداه (\d+) سم و(\d+) سم قُصَّ من إحدى زواياه مستطيل بُعداه (\d+) سم و(\d+) سم، وارتفاع المنشور (\d+) سم\./);
      if (m) {
        const [L, W, c, d, h] = m.slice(1).map(Number) as [number, number, number, number, number];
        assert.ok(c < L && d < W, p);
        let cells = 0;
        for (let x = 0; x < L; x++) for (let y = 0; y < W; y++) if (!(x >= L - c && y >= W - d)) cells++;
        assert.equal(Number(item.answer), cells * h, p);
        cut++;
        continue;
      }
      m = p.match(/^قاعدة منشور قائم مركّبة من مستطيلين متجاورين لا يتداخلان، بُعدا الأول (\d+) سم و(\d+) سم وبُعدا الثاني (\d+) سم و(\d+) سم، وارتفاع المنشور (\d+) سم\./);
      if (m) {
        const [a, b, c, d, h] = m.slice(1).map(Number) as [number, number, number, number, number];
        let cells = 0;
        for (let x = 0; x < a + c; x++) for (let y = 0; y < Math.max(b, d); y++) if ((x < a && y < b) || (x >= a && y < d)) cells++; // side by side along x
        assert.equal(Number(item.answer), cells * h, p);
        join++;
      }
    }
    assert.ok(cut > 5 && join > 5, `cut ${cut}, join ${join}`);
  });
});

// ─── u9_l1 ───────────────────────────────────────────────────────────────────

/** Q1, Q2, Q3 by the method stated in the header: halves exclude the median when n is odd. Written differently from the generator's. */
function quart(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b), n = s.length;
  const med = (v: number[]) => (v.length % 2 ? v[(v.length - 1) / 2]! : (v[v.length / 2 - 1]! + v[v.length / 2]!) / 2);
  const lowerCount = Math.floor(n / 2);
  const lower = s.filter((_, i) => i < lowerCount);
  const upper = s.filter((_, i) => i >= n - lowerCount);
  return { s, q1: med(lower), q2: med(s), q3: med(upper) };
}

describe('g8_quartiles: answers recomputed from the stem', () => {
  it('quartile method', () => {
    // textbook cases of «median of each half, median left out of both when n is odd»
    assert.deepEqual(quart([1, 2, 3, 4, 5, 6, 7, 8, 9]), { s: [1, 2, 3, 4, 5, 6, 7, 8, 9], q1: 2.5, q2: 5, q3: 7.5 });
    const b = quart([3, 5, 7, 8, 12, 13, 14, 18, 21]);
    assert.deepEqual([b.q1, b.q2, b.q3], [6, 12, 16]);
    const c = quart([1, 3, 3, 6, 7, 8, 9]);
    assert.deepEqual([c.q1, c.q2, c.q3], [3, 6, 8]);
    const d = quart([1, 2, 5, 6, 7, 9, 12, 15, 18, 19, 27]);
    assert.deepEqual([d.q1, d.q2, d.q3], [5, 9, 18]);
    const e = quart([5, 7, 4, 4, 6, 2, 8]); // sorted 2 4 4 5 6 7 8 (n = 7, odd)
    assert.deepEqual([e.q1, e.q2, e.q3], [4, 5, 7]);
    const f = quart([2, 4, 4, 6, 7, 8]);
    assert.deepEqual([f.q1, f.q2, f.q3], [4, 5, 7]);
  });

  it('Q1, Q3, the interquartile range, the outlier, the box plot and the spread', () => {
    const list = (p: string) => p.match(/(?:للقيم الآتية|في البيانات): ([\d ،]+)؟/)![1]!.split(' ، ').map(Number);
    for (const item of draws('g8_quartiles', 900)) {
      const p = item.promptAr!;
      const ans = Number(item.answer);
      if (has(p, 'ما الربيع الأول Q1') || has(p, 'ما الربيع الثالث Q3') || has(p, 'ما المدى الربيعي للقيم')) {
        assert.ok(has(p, 'ويُستبعد الوسيط من النصفين'), 'the method is stated');
        const xs = list(p), q = quart(xs);
        const kind = has(p, 'Q1') ? 'q1' : has(p, 'Q3') ? 'q3' : 'iqr';
        const want = kind === 'q1' ? q.q1 : kind === 'q3' ? q.q3 : q.q3 - q.q1;
        assert.equal(ans, want, p);
        assert.ok(q.q3 > q.q1, p);
        for (const w of item.wrongs) assert.notEqual(Number(w), want, `a wrong option is the key: ${p}`);
        assert.ok(xs.length >= 8 && xs.length <= 13, p);
        // the generator prints a half as .5 and nothing finer
        assert.ok(/^\d+(\.5)?$/.test(item.answer), item.answer);
        saw('g8_quartiles', kind + (xs.length % 2 ? ' odd' : ' even'));
      } else if (has(p, 'ما القيمة المتطرّفة')) {
        const xs = list(p), { s, q1, q3 } = quart(xs), iqr = q3 - q1;
        const out = s.filter(v => v < q1 - 1.5 * iqr || v > q3 + 1.5 * iqr);
        assert.deepEqual(out, [ans], p);
        for (const w of item.wrongs) assert.ok(s.includes(Number(w)) || [q1, q3, quart(xs).q2].includes(Number(w)), `wrong option ${w} is not from the data: ${p}`);
        for (const w of item.wrongs) assert.ok(!out.includes(Number(w)), p);
        saw('g8_quartiles', 'outlier');
      } else if (has(p, 'في الصندوق ذي العارضتين')) {
        const [lo, q1, med, q3, hi] = (p.match(/أصغر قيمة (\d+)، والربيع الأول (\d+)، والوسيط (\d+)، والربيع الثالث (\d+)، وأكبر قيمة (\d+)/)!).slice(1).map(Number) as [number, number, number, number, number];
        assert.ok(lo < q1 && q1 < med && med < q3 && q3 < hi, p);
        if (has(p, 'ما المدى الربيعي')) { assert.equal(ans, q3 - q1, p); saw('g8_quartiles', 'box iqr'); }
        else if (has(p, 'ما المدى؟')) { assert.equal(ans, hi - lo, p); saw('g8_quartiles', 'box range'); }
        else {
          // a quarter of the values lies below Q1, a quarter between Q1 and the median, a quarter up to Q3, a quarter above: the box holds two of the four
          assert.equal(item.answer, `${(2 / 4) * 100}%`, p); saw('g8_quartiles', 'box share');
        }
      } else {
        const m = p.match(/الصف أ (\d+) والربيع الثالث (\d+).*الصف ب (\d+) والربيع الثالث (\d+)/)!;
        const [a1, a3, b1, b3] = m.slice(1).map(Number) as [number, number, number, number];
        assert.notEqual(a3 - a1, b3 - b1, p);
        assert.equal(item.answer, a3 - a1 > b3 - b1 ? 'الصف أ' : 'الصف ب', p);
        assert.ok(['الصف أ', 'الصف ب'].includes(item.answer));
        saw('g8_quartiles', 'spread');
      }
    }
    const got = seen.get('g8_quartiles')!;
    for (const k of ['q1 odd', 'q1 even', 'q3 odd', 'q3 even', 'iqr odd', 'iqr even', 'outlier', 'box iqr', 'box range', 'box share', 'spread']) assert.ok(got.has(k), `never drawn: ${k}`);
  });
});

// ─── u9_l2 ───────────────────────────────────────────────────────────────────

describe('g8_best_chart: answers recomputed from the stem', () => {
  it('a described situation has exactly one cue, and the cue decides the chart', () => {
    // the purpose each chart serves, as the lesson teaches it
    const CUES: Array<[RegExp, string]> = [
      [/المقارنة بين أعداد الطلبة/, 'التمثيل بالأعمدة'],
      [/كجزء من الكل/, 'التمثيل بالقطاعات الدائرية'],
      [/كيف تغيّرت هذه القيم مع مرور الزمن/, 'التمثيل بالخط'],
      [/فئات متساوية الطول/, 'المدرّج التكراري'],
      [/وسيطَي المجموعتين/, 'الصندوق ذو العارضتين'],
    ];
    const got = new Set<string>();
    for (const item of draws('g8_best_chart')) {
      const p = item.promptAr!;
      if (!has(p, 'ما التمثيل الأنسب')) continue;
      const hits = CUES.filter(([re]) => re.test(p));
      assert.equal(hits.length, 1, `needs exactly one cue: ${p}`);
      assert.equal(item.answer, hits[0]![1], p);
      got.add(item.answer);
      // a quantity on a time axis, a histogram for numerical data in classes: the stem must say so
      if (item.answer === 'المدرّج التكراري') assert.ok(has(p, 'البيانات العددية'), p);
      assert.ok(!has(p, 'سُجّلت'), `old ungrammatical wording: ${p}`);
    }
    assert.equal(got.size, 5, `charts asked: ${[...got]}`);
  });

  it('qualitative vs numerical: exactly one option is of the asked type', () => {
    const numerical = (s: string) => /عدد|طول|علامة|عمر|كتلة/.test(s);
    let n = 0;
    for (const item of draws('g8_best_chart')) {
      const m = item.promptAr!.match(/^أيّ مما يأتي يمثّل بيانات (نوعية|عددية): (.+)؟$/);
      if (!m) continue;
      n++;
      const opts = m[2]!.split(' ، ');
      assert.equal(opts.length, 4);
      const right = opts.filter(o => (m[1] === 'عددية') === numerical(o));
      assert.deepEqual(right, [item.answer], item.promptAr);
    }
    assert.ok(n > 20);
  });

  it('pie chart counts and angles', () => {
    let count = 0, angle = 0;
    for (const item of draws('g8_best_chart')) {
      const p = item.promptAr!;
      let m = p.match(/لإجابات (\d+) طالبًا عن .*، شكّلت إجابة «.+» (\d+)% من المجموع\. كم طالبًا/);
      if (m) { const [t, pc] = [Number(m[1]), Number(m[2])]; assert.equal(Number(item.answer) * 100, t * pc, p); assert.ok(Number.isInteger((t * pc) / 100)); count++; continue; }
      m = p.match(/شكّلت إجابة «.+» (\d+)% من المجموع\. ما قياس الزاوية المركزية/);
      if (m) { assert.equal(item.answer, `${(Number(m[1]) / 100) * 360}°`, p); angle++; }
    }
    assert.ok(count > 10 && angle > 10, `count ${count}, angle ${angle}`);
  });

  it('the largest rise on a line graph is the only one', () => {
    let n = 0;
    for (const item of draws('g8_best_chart')) {
      const p = item.promptAr!;
      if (!has(p, 'التمثيل بالخط عدد زوّار')) continue;
      n++;
      const pts = [...p.matchAll(/(\d{4}): (\d+)/g)].map(m => [Number(m[1]), Number(m[2])] as const);
      assert.equal(pts.length, 5, p);
      const rises = pts.slice(1).map(([y, v], i) => ({ y: pts[i]![0], v: v - pts[i]![1] }));
      const top = Math.max(...rises.map(r => r.v));
      const best = rises.filter(r => r.v === top);
      assert.equal(best.length, 1, `tie for the largest rise: ${p}`);
      assert.ok(top > 0, p);
      assert.equal(item.answer, `من ${best[0]!.y} إلى ${best[0]!.y + 1}`, p);
      for (const w of item.wrongs) {
        const y = Number(w.match(/من (\d{4})/)![1]);
        assert.notEqual(y, best[0]!.y);
      }
    }
    assert.ok(n > 10);
  });
});
