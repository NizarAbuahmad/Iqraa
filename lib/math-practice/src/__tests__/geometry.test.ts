/**
 * Geometry and measurement generators (`../geometry.ts`). Each answer is
 * recomputed from the numbers printed in the Arabic stem, written separately
 * from the generator, and every option set is checked for shape.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { GEOMETRY_TOPICS } from '../geometry.ts';
import { mathBankCovers, type ConcreteItem, type DiffTier } from '../index.ts';

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
const GEO_IDS = GEOMETRY_TOPICS.map(t => t.id);
function draws(id: string, n = 240): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) =>
    makeTopicItem(t, t.grades[0] + (i % (t.grades[1] - t.grades[0] + 1)), TIERS[i % 3]!, new Set(), seeded(i * 15485863 + 11)));
}

/** Numbers printed in the stem, in order (Latin digits; the stems print no other numbers before the answer). */
const nums = (s: string) => (s.match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
const coef = (s: string) => (s === 'π' ? 1 : Number(s.replace('π', '')));
const dg = (s: string) => Number(s.replace('°', ''));
const pt = (s: string) => [...s.matchAll(/(−?\d+)/g)].map(m => Number(m[1]!.replace('−', '-')));
/** A signed number as printed («−4»). */
const sn = (s: string) => Number(s.replace('−', '-'));
/** Every «(x ، y)» point printed in a stem, in order. */
const pts = (s: string) => [...s.matchAll(/\((−?\d+) ، (−?\d+)\)/g)].map(m => [sn(m[1]!), sn(m[2]!)] as [number, number]);
/** «1/2» or «3». */
const val = (s: string) => (s.includes('/') ? Number(s.split('/')[0]) / Number(s.split('/')[1]) : sn(s));
/** The two linear expressions «px + c» printed in a stem, evaluated at x. */
const linPair = (s: string, x: number) => [...s.matchAll(/(\d*)x \+ (\d+)/g)].slice(0, 2).map(m => (m[1] ? Number(m[1]) : 1) * x + Number(m[2]));

describe('geometry generators: shape', () => {
  it('there are many', () => assert.ok(GEO_IDS.length >= 60, String(GEO_IDS.length)));
  for (const id of GEO_IDS) {
    it(`${id}: distinct options, clean text, both languages`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
          assert.ok(!/\d\.\d{4,}/.test(s), `unrounded number: ${s}`);
        }
        // whole-number options never negative or zero for lengths/angles/counts
        for (const s of [item.answer, ...item.wrongs]) if (/^\d+$/.test(s)) assert.ok(Number(s) > 0, `non-positive option: ${where}`);
      }
    });
  }
});

describe('geometry generators: answers recomputed from the stem', () => {
  it('perimeter and area of plane figures', () => {
    for (const item of draws('perimeter')) {
      const n = nums(item.promptAr!);
      const want = has(item.promptAr!, 'ما عرضه') ? n[0]! / 2 - n[1]! : has(item.promptAr!, 'مربع') ? 4 * n[0]! : has(item.promptAr!, 'مثلث') ? n[0]! + n[1]! + n[2]! : 2 * (n[0]! + n[1]!);
      assert.equal(Number(item.answer), want, item.promptAr);
      if (has(item.promptAr!, 'مثلث')) assert.ok(n[0]! + n[1]! > n[2]! && n[0]! + n[2]! > n[1]! && n[1]! + n[2]! > n[0]!, `impossible triangle: ${item.promptAr}`);
    }
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    for (const item of draws('area_rect')) {
      const p = item.promptAr!, n = nums(p);
      let want: number;
      if (has(p, 'تزيد')) { saw('area_rect', 'compare'); want = n[0]! * n[1]! - n[2]! ** 2; assert.ok(want > 0, p); }
      else if (has(p, 'ما عرضه')) { saw('area_rect', 'width'); want = n[0]! / n[1]!; }
      else if (has(p, 'صفوف')) { saw('area_rect', 'grid'); want = n[0]! * n[1]!; }
      else if (has(p, 'غرفة')) { saw('area_rect', 'room'); want = n[0]! * n[1]!; }
      else if (has(p, 'مربع طول')) { saw('area_rect', 'square'); want = n[0]! ** 2; }
      else { saw('area_rect', 'rectangle'); want = n[0]! * n[1]!; }
      assert.equal(Number(item.answer), want, p);
    }
    for (const item of draws('composite_L')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'مستطيلين')) { saw('composite_L', 'join'); assert.equal(Number(item.answer), n[0]! * n[1]! + n[2]! * n[3]!, p); continue; }
      const [W, H, w, h] = n;
      assert.ok(w! < W! && h! < H!, 'the removed corner must fit');
      if (has(p, 'مساحته')) { saw('composite_L', 'area'); assert.equal(Number(item.answer), W! * H! - w! * h!, p); }
      else { saw('composite_L', has(p, 'السياج') ? 'fence' : 'perimeter'); assert.equal(Number(item.answer), 2 * (W! + H!), p); }
    }
    for (const item of draws('area_parallelogram')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما ارتفاعه')) { saw('area_parallelogram', 'height'); assert.equal(Number(item.answer), n[0]! / n[1]!, p); }
      else if (has(p, 'ضلعه الآخر')) { saw('area_parallelogram', 'slant'); assert.ok(n[1]! > n[2]!, `the slanted side is longer than the height: ${p}`); assert.equal(Number(item.answer), n[0]! * n[2]!, p); }
      else { saw('area_parallelogram', has(p, 'قطعة أرض') ? 'land' : 'area'); assert.equal(Number(item.answer), n[0]! * n[1]!, p); }
    }
    for (const item of draws('area_triangle')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما ارتفاعه')) { saw('area_triangle', 'height'); assert.equal(Number(item.answer), (2 * n[0]!) / n[1]!, p); }
      else { saw('area_triangle', has(p, 'قائم') ? 'right' : has(p, 'شراع') ? 'sail' : 'area'); assert.equal(Number(item.answer), (n[0]! * n[1]!) / 2, p); }
    }
    for (const item of draws('area_trapezoid')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'ما ارتفاعه')) { saw('area_trapezoid', 'height'); assert.notEqual(n[1], n[2], p); assert.equal(Number(item.answer), (2 * n[0]!) / (n[1]! + n[2]!), p); }
      else if (has(p, 'القاعدة الأخرى')) { saw('area_trapezoid', 'base'); assert.notEqual(Number(item.answer), n[2], p); assert.equal(Number(item.answer), (2 * n[0]!) / n[1]! - n[2]!, p); }
      else { saw('area_trapezoid', has(p, 'قطعة أرض') ? 'land' : 'area'); assert.notEqual(n[0], n[1], `a trapezoid's parallel sides differ: ${p}`); assert.equal(Number(item.answer), ((n[0]! + n[1]!) * n[2]!) / 2, p); }
    }
    for (const item of draws('prism_rect')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'مكعب')) { saw('prism_rect', has(p, 'حجم') ? 'cube volume' : 'cube surface'); assert.equal(Number(item.answer), has(p, 'حجم') ? n[0]! ** 3 : 6 * n[0]! ** 2, p); }
      else if (has(p, 'ما ارتفاعه')) { saw('prism_rect', 'height'); assert.equal(Number(item.answer), n[0]! / (n[1]! * n[2]!), p); }
      else if (has(p, 'حجم')) { saw('prism_rect', 'volume'); assert.equal(Number(item.answer), n[0]! * n[1]! * n[2]!, p); }
      else { saw('prism_rect', 'surface'); assert.equal(Number(item.answer), 2 * (n[0]! * n[1]! + n[0]! * n[2]! + n[1]! * n[2]!), p); }
    }
    const want = { area_rect: 6, composite_L: 4, area_parallelogram: 4, area_triangle: 4, area_trapezoid: 4, prism_rect: 5 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
  });

  it('circles', () => {
    for (const item of draws('circle_parts')) {
      const [v] = nums(item.promptAr!);
      assert.equal(Number(item.answer), item.promptAr!.startsWith('قطر') ? v! / 2 : 2 * v!, item.promptAr);
    }
    const sectorKinds = new Set<string>();
    for (const item of draws('sector_fraction')) {
      const [v, w] = nums(item.promptAr!);
      const p = item.promptAr!;
      if (has(p, 'كم طالبًا')) { sectorKinds.add('count'); assert.equal(Number(item.answer), (v! * w!) / 360, p); continue; }
      if (has(p, 'القطاع الثالث')) { sectorKinds.add('third'); assert.equal(dg(item.answer), 360 - v! - w!, p); continue; }
      if (has(p, 'زاوية قطاع القراءة')) { sectorKinds.add('angle from count'); assert.equal(dg(item.answer), (360 * w!) / v!, p); continue; }
      sectorKinds.add(p.startsWith('قطاع دائري زاويته') ? 'fraction' : 'angle');
      if (item.promptAr!.startsWith('قطاع دائري زاويته')) {
        const [nn, dd] = item.answer.includes('/') ? item.answer.split('/').map(Number) : [Number(item.answer), 1];
        assert.equal(nn! / dd!, v! / 360, item.promptAr);
        assert.equal(gcd(nn!, dd!), 1);
      } else {
        const [nn, dd] = item.promptAr!.match(/يمثل (\d+)(?:\/(\d+))?/)!.slice(1).map(Number);
        assert.equal(dg(item.answer), (360 * nn!) / (dd ?? 1), item.promptAr);
      }
      void w;
    }
    assert.equal(sectorKinds.size, 5, `sector kinds drawn: ${[...sectorKinds]}`);
    for (const item of draws('circle_circumference')) {
      const [v] = nums(item.promptAr!);
      if (has(item.promptAr!, 'ما طول نصف قطرها')) assert.equal(Number(item.answer), coef(item.promptAr!.match(/(\d*π)/)![1]!) / 2);
      else assert.equal(coef(item.answer), has(item.promptAr!, 'دائرة قطرها') ? v! : 2 * v!, item.promptAr);
    }
    for (const item of draws('circle_area')) {
      const [v] = nums(item.promptAr!);
      if (has(item.promptAr!, 'ما طول نصف قطرها')) assert.equal(Number(item.answer) ** 2, coef(item.promptAr!.match(/(\d*π)/)![1]!));
      else assert.equal(coef(item.answer), has(item.promptAr!, 'دائرة قطرها') ? (v! / 2) ** 2 : v! ** 2, item.promptAr);
    }
  });

  it('solids', () => {
    for (const item of draws('volume_prism_cyl')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'أسطوانة')) assert.equal(coef(item.answer), n[0]! ** 2 * n[1]!);
      else if (has(item.promptAr!, 'مساحة قاعدته')) assert.equal(Number(item.answer), n[0]! * n[1]!);
      else assert.equal(Number(item.answer), n[0]! * n[1]! * n[2]!);
    }
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    for (const item of draws('volume_pyr_cone')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'مخروط')) { saw('volume_pyr_cone', 'cone'); assert.equal(coef(item.answer), (n[0]! ** 2 * n[1]!) / 3, p); }
      else if (has(p, 'خيمة')) { saw('volume_pyr_cone', 'tent'); assert.equal(Number(item.answer), (n[0]! ** 2 * n[1]!) / 3, p); }
      else if (has(p, 'ما ارتفاعه')) { saw('volume_pyr_cone', 'height'); assert.equal(Number(item.answer), (3 * n[0]!) / n[1]!, p); }
      else { saw('volume_pyr_cone', 'pyramid'); assert.equal(Number(item.answer), (n[0]! * n[1]!) / 3, p); }
      assert.ok(Number.isInteger(coef(item.answer)), p);
    }
    for (const item of draws('surface_prism_cyl')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'الجانبية لأسطوانة')) { saw('surface_prism_cyl', 'cylinder lateral'); assert.equal(coef(item.answer), 2 * n[0]! * n[1]!, p); }
      else if (has(p, 'الجانبية لمنشور')) { saw('surface_prism_cyl', 'prism lateral'); assert.equal(Number(item.answer), 2 * (n[0]! + n[1]!) * n[2]!, p); }
      else if (has(p, 'مفتوح')) { saw('surface_prism_cyl', 'open box'); assert.equal(Number(item.answer), n[0]! * n[1]! + 2 * (n[0]! * n[2]! + n[1]! * n[2]!), p); }
      else if (has(p, 'أسطوانة')) { saw('surface_prism_cyl', 'cylinder'); assert.equal(coef(item.answer), 2 * n[0]! * (n[0]! + n[1]!), p); }
      else { saw('surface_prism_cyl', 'prism'); assert.equal(Number(item.answer), 2 * (n[0]! * n[1]! + n[0]! * n[2]! + n[1]! * n[2]!), p); }
    }
    for (const item of draws('surface_pyr_cone')) {
      const p = item.promptAr!;
      const [a, b] = nums(p);
      if (has(p, 'الجانبية لهرم')) { saw('surface_pyr_cone', 'pyramid lateral'); assert.equal(Number(item.answer), 2 * a! * b!, p); }
      else if (has(p, 'قبعة') || has(p, 'الجانبية لمخروط')) { saw('surface_pyr_cone', has(p, 'قبعة') ? 'hat' : 'cone lateral'); assert.equal(coef(item.answer), a! * b!, p); assert.ok(b! > a!, `slant height beats the radius: ${p}`); }
      else if (has(p, 'مخروط')) { saw('surface_pyr_cone', 'cone'); assert.equal(coef(item.answer), a! * (a! + b!), p); }
      else { saw('surface_pyr_cone', 'pyramid'); assert.equal(Number(item.answer), a! * a! + 2 * a! * b!, p); }
    }
    for (const item of draws('sphere')) {
      const p = item.promptAr!;
      const [r] = nums(p);
      if (has(p, 'نصف كرة')) { saw('sphere', 'bowl'); assert.equal(coef(item.answer), (2 * r! ** 3) / 3, p); }
      else if (has(p, 'ما طول نصف قطرها')) { saw('sphere', 'radius'); assert.equal(4 * Number(item.answer) ** 2, coef(p.match(/(\d*π)/)![1]!), p); }
      else if (has(p, 'كرة قطرها')) { saw('sphere', 'diameter'); assert.equal(coef(item.answer), 4 * (r! / 2) ** 2, p); }
      else { saw('sphere', has(p, 'حجم') ? 'volume' : 'surface'); assert.equal(coef(item.answer), has(p, 'حجم') ? (4 * r! ** 3) / 3 : 4 * r! ** 2, p); }
      assert.ok(Number.isInteger(coef(item.answer)));
    }
    const want = { volume_pyr_cone: 4, surface_prism_cyl: 5, surface_pyr_cone: 5, sphere: 5 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
    for (const item of draws('prism_pyramid_parts')) {
      const base = { 'مثلثية': 3, 'رباعية': 4, 'خماسية': 5, 'سداسية': 6 }[item.promptAr!.match(/(مثلثية|رباعية|خماسية|سداسية)/)![1]!]!;
      const prism = has(item.promptAr!, 'منشور');
      const f = prism ? base + 2 : base + 1, e = prism ? 3 * base : 2 * base, v = prism ? 2 * base : base + 1;
      assert.equal(f - e + v, 2, 'Euler');
      assert.equal(Number(item.answer), has(item.promptAr!, 'أوجه') ? f : has(item.promptAr!, 'أحرف') ? e : v, item.promptAr);
    }
  });

  it('angles', () => {
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    const angleName = (a: number) => (a < 90 ? 'حادة' : a === 90 ? 'قائمة' : a < 180 ? 'منفرجة' : 'مستقيمة');
    const FIGURE: Record<string, string> = { 'مستقيم': 'يمتد من جهتيه', 'قطعة مستقيمة': 'نقطتا طرفين', 'شعاع': 'نقطة بداية واحدة', 'زاوية': 'من شعاعين', 'نقطة': 'الموقع المحدد' };
    for (const item of draws('angle_kind')) {
      const p = item.promptAr!;
      const [a] = nums(p);
      if (has(p, 'عقربي الساعة')) { saw('angle_kind', 'clock'); assert.equal(item.answer, angleName(30 * Math.min(a!, 12 - a!)), p); }
      else if (has(p, 'ما اسم')) { saw('angle_kind', 'name'); assert.ok(p.includes(FIGURE[item.answer]!), `${p} → ${item.answer}`); }
      else if (has(p, 'لتصبح زاوية قائمة')) { saw('angle_kind', 'to a right angle'); assert.equal(dg(item.answer), 90 - a!, p); }
      else { saw('angle_kind', 'classify'); assert.equal(item.answer, angleName(a!)); }
    }
    for (const item of draws('angles_line_point')) {
      const n = nums(item.promptAr!);
      const want = has(item.promptAr!, 'حول نقطة') ? 360 - n[0]! - n[1]! : has(item.promptAr!, 'ثلاث زوايا متجاورة') ? 180 - n[0]! - n[1]! : 180 - n[0]!;
      assert.equal(dg(item.answer), want, item.promptAr);
    }
    for (const item of draws('triangle_sides')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'متساوي الأضلاع محيطه')) { saw('triangle_sides', 'equilateral side'); assert.equal(Number(item.answer), n[0]! / 3, p); continue; }
      if (has(p, 'ما طول كل من ساقيه')) { saw('triangle_sides', 'isosceles leg'); assert.equal(Number(item.answer), (n[0]! - n[1]!) / 2, p); assert.ok(2 * Number(item.answer) > n[1]!, `impossible triangle: ${p}`); continue; }
      if (has(p, 'ما محيطه')) { saw('triangle_sides', 'isosceles perimeter'); assert.equal(Number(item.answer), 2 * n[0]! + n[1]!, p); assert.ok(2 * n[0]! > n[1]!, `impossible triangle: ${p}`); continue; }
      saw('triangle_sides', 'classify');
      const s = nums(item.promptAr!).slice(0, 3).sort((a, b) => a - b);
      const want = s[0]! + s[1]! <= s[2]! ? 'لا يمكن رسم مثلث' : s[0] === s[2] ? 'متساوي الأضلاع' : s[0] === s[1] || s[1] === s[2] ? 'متساوي الساقين' : 'مختلف الأضلاع';
      assert.equal(item.answer, want, item.promptAr);
    }
    for (const item of draws('triangle_angles')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'الحادة الأخرى')) { saw('triangle_angles', 'right'); assert.equal(dg(item.answer), 90 - n[0]!, p); continue; }
      if (has(p, 'ما قياس الزاوية C')) { saw('triangle_angles', 'obtuse'); assert.ok(n[0]! > 90, p); assert.equal(dg(item.answer), 180 - n[0]! - n[1]!, p); continue; }
      const two = has(p, 'قياسا زاويتين');
      saw('triangle_angles', two ? 'two angles' : 'three angles');
      const s = two ? [n[0]!, n[1]!, 180 - n[0]! - n[1]!] : n.slice(0, 3);
      if (two) assert.ok(s[2]! > 0, p);
      const sum = s[0]! + s[1]! + s[2]!;
      const want = sum !== 180 ? 'لا يمكن أن يكون مثلثًا' : s.some(v => v === 90) ? 'قائم الزاوية' : s.some(v => v > 90) ? 'منفرج الزاوية' : 'حاد الزوايا';
      assert.equal(item.answer, want, item.promptAr);
    }
    for (const item of draws('symmetry_lines')) {
      const table: Record<string, number> = { 'المثلث المتساوي الأضلاع': 3, 'المربع': 4, 'المستطيل غير المربع': 2, 'المثلث المتساوي الساقين غير المتساوي الأضلاع': 1, 'الخماسي المنتظم': 5, 'السداسي المنتظم': 6 };
      assert.equal(Number(item.answer), table[item.eq], item.promptAr);
    }
    for (const item of draws('angle_relations')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'x')) {
        const total = has(item.promptAr!, 'متتاميتين') || has(item.promptAr!, 'متتامتين') ? 90 : 180;
        const m = item.promptAr!.match(/\((\d*)x \+ (\d+)\)° و \((\d*)x \+ (\d+)\)°/)!;
        const [p, c1, q, c2] = [m[1] ? Number(m[1]) : 1, Number(m[2]), m[3] ? Number(m[3]) : 1, Number(m[4])];
        assert.equal(p * Number(item.answer) + c1 + q * Number(item.answer) + c2, total, item.promptAr);
      } else {
        const a = n[0]!;
        const want = has(item.promptAr!, 'متتامتان') ? 90 - a : has(item.promptAr!, 'متكاملتان') ? 180 - a : a;
        assert.equal(dg(item.answer), want, item.promptAr);
      }
    }
    for (const item of draws('parallel_transversal')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'x')) {
        const m = item.promptAr!.match(/\((\d+)x \+ (\d+)\)° و (\d+)°/)!;
        assert.equal(Number(m[1]) * Number(item.answer) + Number(m[2]), Number(m[3]), item.promptAr);
      } else {
        const a = n[0]!;
        assert.equal(dg(item.answer), has(item.promptAr!, 'متحالفتان') ? 180 - a : a, item.promptAr);
      }
    }
    for (const item of draws('triangle_angle_sum')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'نسبة')) {
        const r = item.promptAr!.match(/(\d) : (\d) : (\d)/)!.slice(1).map(Number);
        assert.equal(dg(item.answer), (Math.max(...r) * 180) / (r[0]! + r[1]! + r[2]!), item.promptAr);
      }
      else if (has(item.promptAr!, 'متساوي الساقين')) assert.equal(dg(item.answer), 180 - 2 * n[0]!);
      else if (has(item.promptAr!, 'الخارجية')) assert.equal(dg(item.answer), n[0]! + n[1]!);
      else assert.equal(dg(item.answer), 180 - n[0]! - n[1]!);
    }
    for (const item of draws('polygon_angles')) {
      const [n] = nums(item.promptAr!);
      if (has(item.promptAr!, 'كل زاوية خارجية')) assert.equal(Number(item.answer), 360 / n!);
      else if (has(item.promptAr!, 'كل زاوية داخلية')) assert.equal(dg(item.answer), ((n! - 2) * 180) / n!);
      else assert.equal(dg(item.answer), (n! - 2) * 180);
    }
    const want = { angle_kind: 4, triangle_sides: 4, triangle_angles: 4 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
  });

  it('quadrilaterals, parallel lines, isosceles, congruence, similarity', () => {
    for (const id of ['quad_name_g5', 'quad_name_g6']) for (const item of draws(id)) {
      const props: Record<string, string> = { 'مربع': 'أربعة أضلاع متساوية الطول وأربع زوايا قائمة', 'معين': 'أربعة أضلاع متساوية الطول وزواياه غير قائمة', 'شبه منحرف': 'زوج واحد فقط' };
      if (props[item.answer]) assert.ok(item.promptAr!.includes(props[item.answer]!), item.promptAr);
      assert.equal(new Set(['مربع', 'مستطيل', 'معين', 'متوازي أضلاع', 'شبه منحرف']).has(item.answer), true);
    }
    for (const item of draws('parallelogram_props')) {
      const n = nums(item.promptAr!);
      const p = item.promptAr!;
      const want = has(p, 'الزاوية B') ? 180 - n[0]! : has(p, 'الزاوية C') ? n[0]! : has(p, 'AO') ? n[0]! / 2 : 2 * (n[0]! + n[1]!);
      assert.equal(has(p, 'محيطه') || has(p, 'AO') ? Number(item.answer) : dg(item.answer), want, p);
    }
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    for (const item of draws('parallelogram_test')) {
      const p = item.promptAr!;
      if (has(p, 'الرأس D')) {
        saw('parallelogram_test', 'fourth vertex');
        const [A, B, C] = pts(p);
        assert.notEqual((B![0] - A![0]) * (C![1] - A![1]) - (B![1] - A![1]) * (C![0] - A![0]), 0, `collinear: ${p}`);
        // ABCD is a parallelogram when its diagonals AC and BD share a midpoint.
        const D = pt(item.answer);
        assert.deepEqual([A![0] + C![0], A![1] + C![1]], [B![0] + D[0]!, B![1] + D[1]!], p);
        continue;
      }
      const x = Number(item.answer);
      if (has(p, 'AM =')) { saw('parallelogram_test', 'diagonals'); const [l, r] = linPair(p, x); assert.equal(l, r, p); continue; }
      const m = item.promptAr!.match(/AB = (\d+)x \+ (\d+) و CD = (\d*)x \+ (\d+)/);
      saw('parallelogram_test', m ? 'sides' : 'angles');
      if (m) assert.equal(Number(m[1]) * x + Number(m[2]), (m[3] ? Number(m[3]) : 1) * x + Number(m[4]), item.promptAr);
      else {
        const a = item.promptAr!.match(/A = \((\d+)x \+ (\d+)\)° و C = \((\d*)x \+ (\d+)\)°/)!;
        assert.equal(Number(a[1]) * x + Number(a[2]), (a[3] ? Number(a[3]) : 1) * x + Number(a[4]), item.promptAr);
      }
    }
    for (const item of draws('parallelogram_special')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'مستطيل')) assert.equal(Number(item.answer), Math.hypot(n[0]!, n[1]!));
      else if (has(item.promptAr!, 'مساحته')) assert.equal(Number(item.answer), (n[0]! * n[1]!) / 2);
      else assert.equal(Number(item.answer), Math.hypot(n[0]! / 2, n[1]! / 2));
    }
    for (const item of draws('parallel_proof')) {
      const x = Number(item.answer);
      const m = item.promptAr!.match(/\((\d+)x \+ (\d+)\)° و \((\d*)x \+ (\d+)\)°/)!;
      const [p, c1, q, c2] = [Number(m[1]), Number(m[2]), m[3] ? Number(m[3]) : 1, Number(m[4])];
      const a = p * x + c1, b = q * x + c2;
      if (has(item.promptAr!, 'متناظرتين')) assert.equal(a, b);
      else if (has(item.promptAr!, 'متحالفتين')) assert.equal(a + b, 180);
      else assert.equal(a + b, 90);
    }
    for (const item of draws('isosceles')) {
      const [v] = nums(item.promptAr!);
      if (has(item.promptAr!, 'متطابق الأضلاع')) assert.equal(Number(item.answer), 3 * v!);
      else if (has(item.promptAr!, 'قياس زاوية الرأس') && has(item.promptAr!, 'ما قياس كل')) assert.equal(dg(item.answer), (180 - v!) / 2);
      else assert.equal(dg(item.answer), 180 - 2 * v!);
    }
    const CRITERIA: Record<string, string> = { SSS: 'ثلاثة أضلاع', SAS: 'ضلعان والزاوية المحصورة', HL: 'الوتر وضلع', ASA: 'زاويتان والضلع المحصور', AAS: 'زاويتان وضلع غير محصور' };
    for (const item of draws('congruence_a')) assert.ok(item.promptAr!.includes(CRITERIA[item.answer]!), `${item.promptAr} → ${item.answer}`);
    for (const item of draws('congruence_b')) {
      const p = item.promptAr!;
      if (has(p, 'التطابق الإضافي')) {
        saw('congruence_b', 'missing part');
        // Given ∠A and side AB: ASA needs the angle at the side's other end, AAS the angle off the side.
        const [angle, side] = [p.match(/∠([A-C]) ≅/)![1]!, p.match(/ ([A-C]{2}) ≅/)![1]!];
        const other = side.replace(angle, ''), off = 'ABC'.replace(side[0]!, '').replace(side[1]!, '');
        const corr = (v: string) => 'DEF'['ABC'.indexOf(v)];
        const need = has(p, 'بحالة ASA') ? other : off;
        assert.equal(item.answer, `∠${need} ≅ ∠${corr(need)}`, p);
      } else if (has(p, '∠B ≅ ∠E و')) {
        saw('congruence_b', 'marked parts');
        // the side is included between the two angles A and B only when it is AB
        const side = p.match(/و ([A-C]{2}) ≅/)![1]!;
        assert.equal(item.answer, side === 'AB' ? 'ASA' : 'AAS', p);
      } else if (has(p, 'الزاوية F')) {
        saw('congruence_b', 'angle');
        const n = nums(p);
        assert.equal(dg(item.answer), 180 - n[0]! - n[1]!, p);
      } else { saw('congruence_b', 'describe'); assert.ok(p.includes(CRITERIA[item.answer]!), `${p} → ${item.answer}`); }
    }
    for (const item of draws('similar_triangles')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'معامل التشابه')) { saw('similar_triangles', 'scale factor'); assert.equal(Number(item.answer), n[1]! / n[0]!, p); }
      else if (has(p, 'الزاوية F')) { saw('similar_triangles', 'angle'); assert.equal(dg(item.answer), 180 - n[0]! - n[1]!, p); }
      else if (has(p, 'ظل')) { saw('similar_triangles', 'shadow'); assert.equal(Number(item.answer), (n[0]! * n[2]!) / n[1]!, p); }
      else if (has(p, 'محيط')) { saw('similar_triangles', 'perimeter'); assert.equal(Number(item.answer), n[0]! * n[1]!, p); }
      else { saw('similar_triangles', 'side'); assert.equal(Number(item.answer) / n[2]!, n[1]! / n[0]!, p); }
    }
    const want = { parallelogram_test: 4, congruence_b: 4, similar_triangles: 5 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
    for (const item of draws('pythagoras')) {
      const p = item.promptAr!;
      const n = nums(p);
      if (has(p, 'بالصورة الجذرية')) assert.equal(item.answer, `√${n[0]! ** 2 + n[1]! ** 2}`);
      else if (has(p, 'ما طول وتره')) assert.equal(Number(item.answer), Math.hypot(n[0]!, n[1]!));
      else if (has(p, 'الضلع القائم الآخر')) assert.equal(Number(item.answer), Math.sqrt(n[0]! ** 2 - n[1]! ** 2));
      else {
        const s = n.slice(0, 3).sort((a, b) => a - b);
        const want = s[0]! + s[1]! <= s[2]! ? 'لا يوجد مثلث بهذه الأطوال' : s[0]! ** 2 + s[1]! ** 2 === s[2]! ** 2 ? 'قائم الزاوية' : s[0]! ** 2 + s[1]! ** 2 > s[2]! ** 2 ? 'حاد الزوايا' : 'منفرج الزاوية';
        assert.equal(item.answer, want, p);
      }
    }
  });

  it('transformations and the coordinate plane', () => {
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    for (const item of draws('reflect_line')) {
      const p = item.promptAr!, P = pts(p);
      if (has(p, 'الأفقي')) {
        saw('reflect_line', 'horizontal');
        const b = Number(p.match(/y = (\d+)/)![1]);
        assert.deepEqual(pt(item.answer), [P[0]![0], 2 * b - P[0]![1]], p);
      } else if (has(p, 'معادلة محور')) {
        saw('reflect_line', 'mirror line');
        assert.equal(P[0]![1], P[1]![1], p);
        assert.equal(item.answer, `x = ${(P[0]![0] + P[1]![0]) / 2}`, p);
      } else {
        const a = Number(p.match(/x = (\d+)/)![1]);
        if (has(p, 'المسافة')) { saw('reflect_line', 'distance'); assert.equal(Number(item.answer), 2 * Math.abs(a - P[0]![0]), p); }
        else { saw('reflect_line', 'vertical'); assert.deepEqual(pt(item.answer), [2 * a - P[0]![0], P[0]![1]], p); }
      }
      assert.ok(pt(item.answer).every(v => v > 0), `Grade 4 stays in the first quadrant: ${p} → ${item.answer}`);
    }
    for (const id of ['translate_g5', 'translate_g6']) for (const item of draws(id)) {
      const [x, y] = pt(item.eq);
      const m = item.promptAr!.match(/بمقدار (وحدة واحدة|وحدتين|\d+ وحدات|\d+ وحدة) إلى (اليمين|اليسار) و (وحدة واحدة|وحدتين|\d+ وحدات|\d+ وحدة) إلى (الأعلى|الأسفل)/)!;
      const count = (s: string) => (s === 'وحدة واحدة' ? 1 : s === 'وحدتين' ? 2 : Number(s.match(/\d+/)![0]));
      const dx = (m[2] === 'اليمين' ? 1 : -1) * count(m[1]!), dy = (m[4] === 'الأعلى' ? 1 : -1) * count(m[3]!);
      assert.deepEqual(pt(item.answer), [x! + dx, y! + dy]);
      if (id === 'translate_g5') assert.ok(pt(item.answer).every(v => v > 0), 'Grade 5 stays in the first quadrant');
    }
    for (const item of draws('reflect_axes')) {
      const p = item.promptAr!;
      const [x, y] = pts(p)[0]!;
      const xAxis = has(p, 'السيني');
      const reflect = (q: number[]) => (xAxis ? [q[0]!, -q[1]!] : [-q[0]!, q[1]!]);
      if (has(p, 'المسافة')) { saw('reflect_axes', 'distance'); assert.equal(Number(item.answer), 2 * Math.abs(xAxis ? y : x), p); }
      else if (has(p, 'ما إحداثيات النقطة A')) { saw('reflect_axes', 'original'); assert.deepEqual(reflect(pt(item.answer)), [x, y], p); }
      else { saw('reflect_axes', 'image'); assert.deepEqual(pt(item.answer), reflect([x, y]), p); }
    }
    for (const item of draws('coord_plane_g6')) {
      const p = item.promptAr!;
      if (has(p, 'نقطة الأصل')) {
        saw('coord_plane_g6', 'moves');
        const [dx, dy] = nums(p);
        assert.deepEqual(pt(item.answer), [(has(p, 'اليسار') ? -1 : 1) * dx!, (has(p, 'الأسفل') ? -1 : 1) * dy!], p);
      } else if (has(p, 'المسافة')) {
        saw('coord_plane_g6', 'distance');
        const [A, B] = pts(p);
        assert.ok(A![0] === B![0] || A![1] === B![1], p);
        assert.equal(Number(item.answer), Math.abs(A![0] - B![0]) + Math.abs(A![1] - B![1]), p);
      } else {
        saw('coord_plane_g6', 'quadrant');
        const [x, y] = pts(p)[0]!;
        assert.equal(item.answer, ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][x > 0 ? (y > 0 ? 0 : 3) : (y > 0 ? 1 : 2)]);
      }
    }
    for (const item of draws('coord_plane_g5')) {
      const n = nums(item.promptAr!);
      const p = item.promptAr!;
      assert.equal(Number(item.answer), has(p, 'السيني') ? n[0]! : has(p, 'الصادي') ? n[1]! : n[3]! - n[1]!, p);
    }
    for (const item of draws('rotate')) {
      const [x, y] = pt(item.eq);
      const p = item.promptAr!;
      const want = has(p, '180') ? [-x!, -y!] : has(p, 'عكس') ? [-y!, x!] : [y!, -x!];
      assert.deepEqual(pt(item.answer), want, p);
    }
    for (const id of ['dilate_g7', 'dilate_g8']) for (const item of draws(id)) {
      const p = item.promptAr!, P = pts(p);
      if (has(p, 'ما معامل')) {
        saw(id, 'factor');
        const k = val(item.answer);
        assert.deepEqual(P[0], [P[1]![0] * k, P[1]![1] * k], p);
      } else if (has(p, 'النقطة الأصلية')) {
        saw(id, 'original');
        const k = val(p.match(/ومعامله (\d+(?:\/\d+)?)/)![1]!);
        const o = pt(item.answer);
        assert.deepEqual([o[0]! * k, o[1]! * k], P[0], p);
      } else if (has(p, 'محيط')) {
        saw(id, 'photo');
        const n = nums(p);
        assert.equal(Number(item.answer), 2 * (n[0]! + n[1]!) * n[2]!, p);
      } else if (has(p, 'ومعامله −')) {
        saw(id, 'negative');
        const k = -Number(p.match(/ومعامله −(\d+)/)![1]);
        assert.deepEqual(pt(item.answer), [P[0]![0] * k, P[0]![1] * k], p);
      } else {
        saw(id, 'image');
        const [x, y] = P[0]!;
        const k = val(p.match(/معامل تمدد (\d+(?:\/\d+)?)/)![1]!);
        assert.deepEqual(pt(item.answer), [x * k, y * k], p);
      }
    }
    const want = { reflect_line: 4, reflect_axes: 3, coord_plane_g6: 3, dilate_g7: 4, dilate_g8: 5 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
  });

  it('Grade 9: distance, proportional parts, trigonometry', () => {
    const kinds: Record<string, Set<string>> = {};
    const saw = (id: string, k: string) => (kinds[id] ??= new Set()).add(k);
    for (const item of draws('distance_plane')) {
      const p = item.promptAr!, P = pts(p);
      if (has(p, 'تمثل النقطة A العدد')) {
        saw('distance_plane', 'number line distance');
        const [u, v] = [...p.matchAll(/العدد (−?\d+)/g)].map(m => sn(m[1]!));
        assert.equal(Number(item.answer), Math.abs(u! - v!), p);
      } else if (has(p, 'بين العددين')) {
        saw('distance_plane', 'number line midpoint');
        const m = p.match(/العددين (−?\d+) و (−?\d+)/)!;
        assert.equal(sn(item.answer), (sn(m[1]!) + sn(m[2]!)) / 2, p);
      } else if (has(p, 'ما إحداثيا نقطة منتصف')) {
        saw('distance_plane', 'midpoint');
        assert.deepEqual(pt(item.answer), [(P[0]![0] + P[1]![0]) / 2, (P[0]![1] + P[1]![1]) / 2], p);
      } else if (has(p, 'ما إحداثيات النقطة B')) {
        saw('distance_plane', 'endpoint');
        const [M, A] = P;
        const B = pt(item.answer);
        assert.deepEqual([(A![0] + B[0]!) / 2, (A![1] + B[1]!) / 2], M, p);
      } else {
        saw('distance_plane', 'distance');
        const [[x1, y1], [x2, y2]] = P as [[number, number], [number, number]];
        const d2 = (x2 - x1) ** 2 + (y2 - y1) ** 2;
        assert.ok(item.answer === `√${d2}` || Number(item.answer) ** 2 === d2, `${p} → ${item.answer}`);
      }
    }
    /** |Ax0 + By0 + C| / √(A² + B²) for a line printed as «3x + 4y − 5 = 0», «y = −2» or «x = 4». */
    const LINE = /\d+x \+ \d+y(?: [+−] \d+)? = 0|[xy] = −?\d+/g;
    const lineParts = (line: string) => {
      const h = line.match(/^y = (−?\d+)$/), v = line.match(/^x = (−?\d+)$/);
      if (h) return [0, 1, -sn(h[1]!)];
      if (v) return [1, 0, -sn(v[1]!)];
      const m = line.match(/^(\d+)x \+ (\d+)y(?: ([+−]) (\d+))? = 0$/)!;
      return [Number(m[1]), Number(m[2]), m[3] ? (m[3] === '−' ? -1 : 1) * Number(m[4]) : 0];
    };
    const lineDist = (line: string, x0: number, y0: number) => { const [A, B, C] = lineParts(line); return Math.abs(A! * x0 + B! * y0 + C!) / Math.hypot(A!, B!); };
    for (const item of draws('distance_point_line')) {
      const p = item.promptAr!, lines = p.match(LINE)!;
      if (has(p, 'المتوازيين')) {
        saw('distance_point_line', 'parallel lines');
        const [l1, l2] = lines.map(lineParts);
        assert.deepEqual([l1![0], l1![1]], [l2![0], l2![1]], `not parallel: ${p}`);
        assert.equal(Number(item.answer), Math.abs(l1![2]! - l2![2]!) / Math.hypot(l1![0]!, l1![1]!), p);
        continue;
      }
      if (has(p, 'نقطة الأصل')) { saw('distance_point_line', 'origin'); assert.equal(Number(item.answer), lineDist(lines[0]!, 0, 0), p); continue; }
      if (has(p, 'مساحة المثلث')) {
        saw('distance_point_line', 'triangle area');
        const [x0, y0] = pts(p)[0]!, base = Number(p.match(/وطوله (\d+)/)![1]);
        assert.equal(Number(item.answer), (base * lineDist(lines[0]!, x0, y0)) / 2, p);
        continue;
      }
      saw('distance_point_line', 'point');
      const [x0, y0] = pt(item.eq.split(', ')[0]!.concat(')').replace('))', ')'));
      const line = item.eq.split('), ')[1] ?? item.eq.split(', ').slice(2).join(', ');
      let want: number;
      const horiz = line.match(/^y = (−?\d+)$/), vert = line.match(/^x = (−?\d+)$/);
      if (horiz) want = Math.abs(y0! - Number(horiz[1]!.replace('−', '-')));
      else if (vert) want = Math.abs(x0! - Number(vert[1]!.replace('−', '-')));
      else { const m = line.match(/^(\d+)x \+ (\d+)y ([+−]) (\d+) = 0$/)!; const C = (m[3] === '−' ? -1 : 1) * Number(m[4]); want = Math.abs(Number(m[1]) * x0! + Number(m[2]) * y0! + C) / Math.hypot(Number(m[1]), Number(m[2])); }
      assert.equal(Number(item.answer), want, item.eq);
    }
    for (const item of draws('proportional_parts')) {
      const p = item.promptAr!;
      const [a, b, c] = nums(item.promptAr!.replace(/ABC|DE|AD|DB|AE|EC|BC/g, ''));
      if (has(p, 'منتصفا')) { saw('proportional_parts', 'midsegment'); assert.equal(Number(item.answer), a! / 2, p); continue; }
      if (has(p, 'ثلاثة مستقيمات')) { saw('proportional_parts', 'parallel lines'); assert.equal(Number(item.answer), (b! * c!) / a!, p); continue; }
      if (has(p, 'فما طول DE')) { saw('proportional_parts', 'DE'); assert.equal(Number(item.answer) / c!, a! / (a! + b!), p); continue; }
      const ec = has(item.promptAr!, 'فما طول EC');
      saw('proportional_parts', ec ? 'EC' : 'AE');
      assert.equal(Number(item.answer), ec ? (b! * c!) / a! : (a! * c!) / b!, item.promptAr);
    }
    for (const item of draws('angle_bisector_thm')) {
      const p = item.promptAr!;
      if (has(p, 'x')) {
        // a point on a perpendicular bisector is as far from A as from B; on an angle bisector, as far from both sides
        saw('angle_bisector_thm', has(p, 'العمودي') ? 'perpendicular bisector' : 'angle bisector point');
        const [l, r] = linPair(p, Number(item.answer));
        assert.equal(l, r, p);
        continue;
      }
      if (has(p, 'ملتقى')) {
        // the incentre is as far from BC as from AB, and IF ⊥ AB makes IAF right-angled at F
        saw('angle_bisector_thm', 'incentre');
        const [ia, af] = nums(p);
        assert.equal(Number(item.answer), Math.sqrt(ia! ** 2 - af! ** 2), p);
        continue;
      }
      saw('angle_bisector_thm', 'ratio');
      const [ab, ac, bd] = nums(item.promptAr!.replace(/ABC|AD|BC|DC|AB|AC|BD/g, m => `_${m}_`).replace(/_[A-Z]+_/g, ' '));
      assert.equal(Number(item.answer), (ac! * bd!) / ab!, item.promptAr);
    }
    for (const item of draws('medians_centroid')) {
      const p = item.promptAr!;
      if (has(p, 'تلاقي ارتفاعات')) {
        saw('medians_centroid', 'orthocentre');
        const [A, B, C] = pts(p), H = pt(item.answer);
        const dot = (u: number[], v: number[], w: number[], z: number[]) => (u[0]! - v[0]!) * (w[0]! - z[0]!) + (u[1]! - v[1]!) * (w[1]! - z[1]!);
        assert.equal(dot(H, A!, C!, B!), 0, `AH ⟂ BC: ${p}`);
        assert.equal(dot(H, B!, C!, A!), 0, `BH ⟂ AC: ${p}`);
        continue;
      }
      if (has(p, 'رؤوسه')) {
        saw('medians_centroid', 'centroid');
        const [A, B, C] = pts(p), G = pt(item.answer);
        assert.deepEqual([3 * G[0]!, 3 * G[1]!], [A![0] + B![0] + C![0], A![1] + B![1] + C![1]], p);
        continue;
      }
      if (has(p, 'فما طول AD')) { saw('medians_centroid', 'AD'); assert.equal(Number(item.answer), (3 * nums(p)[0]!) / 2, p); continue; }
      saw('medians_centroid', has(p, 'ما طول AG') ? 'AG' : 'GD');
      const [m] = nums(item.promptAr!.replace(/ABC/g, ''));
      assert.equal(Number(item.answer), has(item.promptAr!, 'AG') ? (2 * m!) / 3 : m! / 3, item.promptAr);
    }
    for (const item of draws('trig_ratios')) {
      const [a, b, c] = item.eq.split(', ').map(Number);
      const name = item.promptAr!.match(/ما قيمة (sin|cos|tan) A/)![1];
      const [nn, dd] = name === 'sin' ? [a, c] : name === 'cos' ? [b, c] : [a, b];
      const [rn, rd] = item.answer.includes('/') ? item.answer.split('/').map(Number) : [Number(item.answer), 1];
      assert.equal(rn! * dd!, nn! * rd!, item.promptAr);
      assert.equal(a! * a! + b! * b!, c! * c!);
    }
    for (const item of draws('trig_applications')) {
      const n = nums(item.promptAr!.replace(/ABC|AB|BC|AC/g, ''));
      if (has(item.promptAr!, '√2')) assert.equal(Number(item.answer), n[n.length - 1]! === 2 ? n[n.length - 2]! : n[0]!);
    }
    const want = { distance_plane: 5, distance_point_line: 4, proportional_parts: 5, angle_bisector_thm: 4, medians_centroid: 5 };
    for (const [id, k] of Object.entries(want)) assert.equal(kinds[id]?.size, k, `${id} kinds drawn: ${[...(kinds[id] ?? [])]}`);
  });

  it('Grade 10: circles, bearings, area by sine', () => {
    for (const item of draws('circle_chords')) {
      const [a, b] = nums(item.promptAr!);
      const p = item.promptAr!;
      if (has(p, 'بُعد الوتر')) assert.equal(Number(item.answer), Math.sqrt(a! ** 2 - (b! / 2) ** 2), p);
      else if (has(p, 'ما طول الوتر')) assert.equal(Number(item.answer), 2 * Math.sqrt(a! ** 2 - b! ** 2), p);
      else assert.equal(Number(item.answer), Math.sqrt(a! ** 2 - b! ** 2), p);
    }
    for (const item of draws('circle_angles')) {
      const p = item.promptAr!;
      const [a] = nums(p);
      if (has(p, 'قطر الدائرة')) assert.equal(dg(item.answer), 90);
      else if (has(p, 'الرباعي الدائري')) assert.equal(dg(item.answer), 180 - a!);
      else if (has(p, 'ما قياس الزاوية المحيطية')) assert.equal(dg(item.answer), a! / 2);
      else assert.equal(dg(item.answer), a! * 2);
    }
    const mod = (n: number) => ((n % 360) + 360) % 360;
    const COMPASS: Record<string, number> = { 'الشمال الشرقي': 45, 'الجنوب الشرقي': 135, 'الجنوب الغربي': 225, 'الشمال الغربي': 315, 'الشرق': 90, 'الجنوب': 180, 'الغرب': 270 };
    const kinds = new Set<string>();
    for (const item of draws('bearing')) {
      const p = item.promptAr!;
      const n = nums(p);
      if (has(p, 'ما اتجاه A من B')) { kinds.add('back'); assert.equal(dg(item.answer), mod(n[0]! + 180), p); }
      else if (has(p, 'لجهة')) { kinds.add('compass'); assert.equal(dg(item.answer), COMPASS[p.match(/لجهة (.+)؟/)![1]!], p); }
      else if (has(p, 'تنعطف')) { kinds.add('turn'); assert.equal(dg(item.answer), mod(n[0]! + (has(p, ' مع ') ? n[1]! : -n[1]!)), p); }
      else if (has(p, 'كيلومترًا')) { kinds.add('distance'); assert.equal(Number(item.answer), Math.hypot(n[0]!, n[2]!), p); }
      else if (has(p, 'الزاوية BAC')) { kinds.add('angle'); assert.equal(dg(item.answer), n[1]! - n[0]!, p); }
      else assert.fail(`unknown bearing stem: ${p}`);
      if (!has(p, 'كيلومترًا') && !has(p, 'الزاوية BAC')) assert.match(item.answer, /^\d{3}°$/, p);
      for (const w of item.wrongs) assert.notEqual(w, item.answer, p);
    }
    assert.equal(kinds.size, 5, `bearing kinds drawn: ${[...kinds]}`);
    const heron = (a: number, b: number, c: number) => { const s = (a + b + c) / 2; return Math.sqrt(s * (s - a) * (s - b) * (s - c)); };
    const areaKinds = new Set<string>();
    for (const item of draws('sine_area')) {
      const p = item.promptAr!;
      const n = nums(p);
      if (has(p, 'أطوال أضلاعه')) {
        areaKinds.add('heron');
        const [a, b, c] = n;
        assert.ok(a! + b! > c! && a! + c! > b! && b! + c! > a!, `impossible triangle: ${p}`);
        assert.equal(Number(item.answer), heron(a!, b!, c!), p);
      } else if (has(p, 'ما طول الضلع الآخر')) {
        areaKinds.add('side');
        const [A, a, C] = n;
        assert.equal(Number(item.answer), (2 * A!) / (a! * Math.round(Math.sin((C! * Math.PI) / 180) * 2) / 2), p);
      } else if (has(p, 'ما قياس الزاوية')) {
        areaKinds.add('angle');
        const [a, b, A] = n;
        const sinC = (2 * A!) / (a! * b!);
        assert.equal(dg(item.answer), has(p, 'الحادة') ? 30 : 90, p);
        assert.ok(Math.abs(Math.sin((dg(item.answer) * Math.PI) / 180) - sinC) < 1e-9, p);
      } else {
        areaKinds.add('included');
        const [a, b, C] = item.eq.split(', ').map(Number);
        assert.equal(Number(item.answer), Math.round(0.5 * a! * b! * Math.sin((C! * Math.PI) / 180) * 1e6) / 1e6);
      }
    }
    assert.equal(areaKinds.size, 4, `area kinds drawn: ${[...areaKinds]}`);
  });

  it('units and time', () => {
    // «حوّل N A إلى B.» either way; «كم Xًا في a … و b …؟» (compound); «… بقي …؟» (what is left after taking b away)
    const FACTOR: Record<string, number> = { 'متر>سنتيمتر': 100, 'كيلومتر>متر': 1000, 'كيلوغرام>غرام': 1000, 'لتر>مليلتر': 1000 };
    const PER_BIG: Record<string, number> = { 'سنتيمترًا': 100, 'مترًا': 1000, 'غرامًا': 1000, 'مليلترًا': 1000 };
    const FAMILY: Record<string, string[]> = { units_m: ['متر'], units_km: ['متر'], units_mass: ['غرام'], units_volume: ['لتر'], units_length: ['متر'], units_mass_g45: ['غرام'], units_capacity: ['لتر'], units_capacity_length: ['متر', 'لتر'] };
    for (const id of Object.keys(FAMILY)) {
      const unitKinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, n = nums(p);
        assert.ok(FAMILY[id]!.some(w => p.includes(w)), `${id}: ${p}`);
        if (id === 'units_mass_g45' || id === 'units_mass') assert.ok(!p.includes('لتر') && !p.includes('متر'), p);
        if (id === 'units_capacity' || id === 'units_volume') assert.ok(!p.includes('غرام') && !p.includes('متر'), p);
        const conv = p.match(/^حوّل \d+ (\S+) إلى (\S+)\.$/);
        let want: number;
        if (conv) {
          const down = FACTOR[`${conv[1]}>${conv[2]}`], up = FACTOR[`${conv[2]}>${conv[1]}`];
          assert.ok(down || up, p);
          unitKinds.add(down ? 'down' : 'up');
          want = down ? n[0]! * down : n[0]! / up!;
        } else {
          const f = PER_BIG[p.match(/كم (سنتيمترًا|مترًا|غرامًا|مليلترًا)/)![1]!]!;
          assert.ok(n[1]! < f, `the small part is less than one big unit: ${p}`);
          if (has(p, 'بقي')) { unitKinds.add('left'); want = n[0]! * f - n[1]!; }
          else { unitKinds.add('compound'); want = n[0]! * f + n[1]!; }
        }
        assert.equal(Number(item.answer), want, p);
      }
      assert.equal(unitKinds.size, 4, `${id} kinds drawn: ${[...unitKinds]}`);
    }
    const min = (s: string) => { const [h, m] = s.split(':').map(Number); return h! * 60 + m!; };
    const wrap = (t: number) => ((t % 720) + 720) % 720;
    for (const id of ['time_g3', 'time_g45']) for (const item of draws(id)) {
      const p = item.promptAr!;
      const clocks = p.match(/\d+:\d\d/g) ?? [];
      if (has(p, 'متى انتهى')) assert.equal(wrap(min(item.answer)), wrap(min(clocks[0]!) + nums(p.replace(/\d+:\d\d/g, ''))[0]!), p);
      else if (has(p, 'كم دقيقة استغرق')) assert.equal(Number(item.answer), wrap(min(clocks[1]!) - min(clocks[0]!)), p);
      else {
        const word = (s: string) => (s.includes('واحدة') ? 1 : s.includes('ين') ? 2 : Number(s.match(/[0-9]+/)![0]));
        const m = p.match(/في (ساعة واحدة|ساعتين|[0-9]+ ساعات|[0-9]+ ساعة) و (دقيقة واحدة|دقيقتين|[0-9]+ دقائق|[0-9]+ دقيقة)/)!;
        assert.equal(Number(item.answer), word(m[1]!) * 60 + word(m[2]!), p);
      }
    }
    for (const item of draws('time_words')) {
      const HOURS = ['', 'الواحدة', 'الثانية', 'الثالثة', 'الرابعة', 'الخامسة', 'السادسة', 'السابعة', 'الثامنة', 'التاسعة', 'العاشرة', 'الحادية عشرة', 'الثانية عشرة'];
      const h = HOURS.map((w, i) => [w, i] as const).filter(([w, i]) => i > 0 && item.eq.startsWith(`${w} `)).sort((a, b) => b[0].length - a[0].length)[0]![1];
      const off = has(item.eq, 'والنصف') ? 30 : has(item.eq, 'والربع') ? 15 : has(item.eq, 'إلا ربعًا') ? -15 : has(item.eq, 'وخمس') ? 5 : has(item.eq, 'وعشر') ? 10 : has(item.eq, 'إلا خمس') ? -5 : has(item.eq, 'إلا عشر') ? -10 : has(item.eq, 'وثلث') ? 20 : -20;
      assert.equal(wrap(min(item.answer)), wrap(h * 60 + off), item.eq);
    }
  });
});

describe('geometry routing', () => {
  const cases: Array<[string, number, string | null]> = [
    ['المحيط', 3, 'perimeter'], ['المساحة', 4, 'area_rect'], ['محيط الشكل المركب ومساحته', 5, 'composite_L'], ['مساحة شبه المنحرف', 6, 'area_trapezoid'],
    ['حجم المنشور الرباعي ومساحة سطحه', 6, 'prism_rect'], ['الدائرة وأجزاؤها', 6, 'circle_parts'], ['القطاعات الدائرية', 6, 'sector_fraction'],
    ['محيط الدائرة', 7, 'circle_circumference'], ['مساحة سطح الهرم والمخروط', 7, 'surface_pyr_cone'], ['حجم الكرة ومساحة سطحها', 8, 'sphere'],
    ['الخطوط، والأشعة، والزوايا', 4, 'angle_kind'], ['تصنيف المثلثات حسب أطوال أضلاعها', 5, 'triangle_sides'], ['زوايا المضلع', 7, 'polygon_angles'],
    ['تطابق المثلثات (SSS, SAS, HL)', 8, 'congruence_a'], ['تطابق المثلثات (ASA, AAS)', 8, 'congruence_b'], ['نظرية فيثاغورس', 8, 'pythagoras'],
    ['المستوى الإحداثي', 5, 'coord_plane_g5'], ['المستوى الإحداثي', 6, 'coord_plane_g6'], ['الدوران', 7, 'rotate'], ['التمدد', 8, 'dilate_g8'],
    ['المسافة في المستوى الإحداثي', 9, 'distance_plane'], ['النسب المثلثية', 9, 'trig_ratios'], ['الاتجاه من الشمال (Bearing)', 10, 'bearing'],
    ['المتر والسنتيمتر', 3, 'units_m'], ['الزمن', 4, 'time_g45'], ['الفترات الزمنية (1)', 3, 'time_g3'], ['قراءة الوقت باستعمال (و، إلا)', 3, 'time_words'],
    // lessons that stay refused: no generator is about them
    ['الأرقام الهندية', 3, null], ['رسم الأشكال ثلاثية الأبعاد', 8, null], ['التطابق', 7, null],
  ];
  for (const [title, grade, id] of cases) {
    it(`${title} (G${grade}) → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, grade)?.id ?? null, id);
      if (id) assert.ok(mathBankCovers(title, null, grade));
    });
  }
});
