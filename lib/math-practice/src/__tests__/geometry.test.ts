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
    for (const item of draws('area_rect')) {
      const n = nums(item.promptAr!);
      const want = has(item.promptAr!, 'ما عرضه') ? n[0]! / n[1]! : has(item.promptAr!, 'مربع طول') ? n[0]! ** 2 : n[0]! * n[1]!;
      assert.equal(Number(item.answer), want, item.promptAr);
    }
    for (const item of draws('composite_L')) {
      const [W, H, w, h] = nums(item.promptAr!);
      assert.equal(Number(item.answer), has(item.promptAr!, 'مساحته') ? W! * H! - w! * h! : 2 * (W! + H!), item.promptAr);
      assert.ok(w! < W! && h! < H!, 'the removed corner must fit');
    }
    for (const item of draws('area_parallelogram')) {
      const n = nums(item.promptAr!);
      assert.equal(Number(item.answer), has(item.promptAr!, 'ما ارتفاعه') ? n[0]! / n[1]! : n[0]! * n[1]!, item.promptAr);
    }
    for (const item of draws('area_triangle')) {
      const n = nums(item.promptAr!);
      assert.equal(Number(item.answer), has(item.promptAr!, 'ما ارتفاعه') ? (2 * n[0]!) / n[1]! : (n[0]! * n[1]!) / 2, item.promptAr);
    }
    for (const item of draws('area_trapezoid')) {
      const [a, b, h] = nums(item.promptAr!);
      assert.equal(Number(item.answer), ((a! + b!) * h!) / 2, item.promptAr);
    }
    for (const item of draws('prism_rect')) {
      const [l, w, h] = nums(item.promptAr!);
      assert.equal(Number(item.answer), has(item.promptAr!, 'حجم') ? l! * w! * h! : 2 * (l! * w! + l! * h! + w! * h!), item.promptAr);
    }
  });

  it('circles', () => {
    for (const item of draws('circle_parts')) {
      const [v] = nums(item.promptAr!);
      assert.equal(Number(item.answer), item.promptAr!.startsWith('قطر') ? v! / 2 : 2 * v!, item.promptAr);
    }
    for (const item of draws('sector_fraction')) {
      const [v, w] = nums(item.promptAr!);
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
    for (const item of draws('volume_pyr_cone')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'مخروط')) assert.equal(coef(item.answer), (n[0]! ** 2 * n[1]!) / 3);
      else assert.equal(Number(item.answer), (n[0]! * n[1]!) / 3);
    }
    for (const item of draws('surface_prism_cyl')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'أسطوانة')) assert.equal(coef(item.answer), 2 * n[0]! * (n[0]! + n[1]!));
      else assert.equal(Number(item.answer), 2 * (n[0]! * n[1]! + n[0]! * n[2]! + n[1]! * n[2]!));
    }
    for (const item of draws('surface_pyr_cone')) {
      const [a, b] = nums(item.promptAr!);
      if (has(item.promptAr!, 'مخروط')) assert.equal(coef(item.answer), a! * (a! + b!));
      else assert.equal(Number(item.answer), a! * a! + 2 * a! * b!);
    }
    for (const item of draws('sphere')) {
      const [r] = nums(item.promptAr!);
      assert.equal(coef(item.answer), has(item.promptAr!, 'حجم') ? (4 * r! ** 3) / 3 : 4 * r! ** 2, item.promptAr);
      assert.ok(Number.isInteger(coef(item.answer)));
    }
    for (const item of draws('prism_pyramid_parts')) {
      const base = { 'مثلثية': 3, 'رباعية': 4, 'خماسية': 5, 'سداسية': 6 }[item.promptAr!.match(/(مثلثية|رباعية|خماسية|سداسية)/)![1]!]!;
      const prism = has(item.promptAr!, 'منشور');
      const f = prism ? base + 2 : base + 1, e = prism ? 3 * base : 2 * base, v = prism ? 2 * base : base + 1;
      assert.equal(f - e + v, 2, 'Euler');
      assert.equal(Number(item.answer), has(item.promptAr!, 'أوجه') ? f : has(item.promptAr!, 'أحرف') ? e : v, item.promptAr);
    }
  });

  it('angles', () => {
    for (const item of draws('angle_kind')) {
      const [a] = nums(item.promptAr!);
      assert.equal(item.answer, a! < 90 ? 'حادة' : a === 90 ? 'قائمة' : a! < 180 ? 'منفرجة' : 'مستقيمة');
    }
    for (const item of draws('angles_line_point')) {
      const n = nums(item.promptAr!);
      const want = has(item.promptAr!, 'حول نقطة') ? 360 - n[0]! - n[1]! : has(item.promptAr!, 'ثلاث زوايا متجاورة') ? 180 - n[0]! - n[1]! : 180 - n[0]!;
      assert.equal(dg(item.answer), want, item.promptAr);
    }
    for (const item of draws('triangle_sides')) {
      const s = nums(item.promptAr!).slice(0, 3).sort((a, b) => a - b);
      const want = s[0]! + s[1]! <= s[2]! ? 'لا يمكن رسم مثلث' : s[0] === s[2] ? 'متساوي الأضلاع' : s[0] === s[1] || s[1] === s[2] ? 'متساوي الساقين' : 'مختلف الأضلاع';
      assert.equal(item.answer, want, item.promptAr);
    }
    for (const item of draws('triangle_angles')) {
      const s = nums(item.promptAr!).slice(0, 3);
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
    for (const item of draws('parallelogram_test')) {
      const x = Number(item.answer);
      const m = item.promptAr!.match(/AB = (\d+)x \+ (\d+) و CD = (\d*)x \+ (\d+)/);
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
    for (const id of ['congruence_a', 'congruence_b']) for (const item of draws(id)) assert.ok(item.promptAr!.includes(CRITERIA[item.answer]!), `${item.promptAr} → ${item.answer}`);
    for (const item of draws('similar_triangles')) {
      const n = nums(item.promptAr!);
      if (has(item.promptAr!, 'محيط')) assert.equal(Number(item.answer), n[0]! * n[1]!, item.promptAr);
      else assert.equal(Number(item.answer) / n[2]!, n[1]! / n[0]!, item.promptAr);
    }
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
    for (const item of draws('reflect_line')) {
      const [x, y] = pt(item.eq);
      const a = nums(item.promptAr!.match(/x = (\d+)/)![0])[0]!;
      assert.deepEqual(pt(item.answer), [2 * a - x!, y]);
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
      const [x, y] = pt(item.eq);
      assert.deepEqual(pt(item.answer), has(item.promptAr!, 'السيني') ? [x, -y!] : [-x!, y]);
    }
    for (const item of draws('coord_plane_g6')) {
      const [x, y] = pt(item.eq);
      assert.equal(item.answer, ['الربع الأول', 'الربع الثاني', 'الربع الثالث', 'الربع الرابع'][x! > 0 ? (y! > 0 ? 0 : 3) : (y! > 0 ? 1 : 2)]);
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
      const [x, y] = pt(item.eq);
      const m = item.promptAr!.match(/معامل تمدد (\d+(?:\/\d+)?)/)!;
      const k = m[1]!.includes('/') ? 0.5 : Number(m[1]);
      assert.deepEqual(pt(item.answer), [x! * k, y! * k], item.promptAr);
    }
  });

  it('Grade 9: distance, proportional parts, trigonometry', () => {
    for (const item of draws('distance_plane')) {
      const [x1, y1, x2, y2] = pt(item.eq);
      const d2 = (x2! - x1!) ** 2 + (y2! - y1!) ** 2;
      assert.ok(item.answer === `√${d2}` || Number(item.answer) ** 2 === d2, `${item.eq} → ${item.answer}`);
    }
    for (const item of draws('distance_point_line')) {
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
      const [a, b, c] = nums(item.promptAr!.replace(/ABC|DE|AD|DB|AE|EC|BC/g, ''));
      const ec = has(item.promptAr!, 'فما طول EC');
      assert.equal(Number(item.answer), ec ? (b! * c!) / a! : (a! * c!) / b!, item.promptAr);
    }
    for (const item of draws('angle_bisector_thm')) {
      const [ab, ac, bd] = nums(item.promptAr!.replace(/ABC|AD|BC|DC|AB|AC|BD/g, m => `_${m}_`).replace(/_[A-Z]+_/g, ' '));
      assert.equal(Number(item.answer), (ac! * bd!) / ab!, item.promptAr);
    }
    for (const item of draws('medians_centroid')) {
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
    for (const item of draws('bearing')) {
      const b = Number(item.eq);
      assert.equal(Number(item.answer.replace('°', '')), (b + 180) % 360);
      assert.match(item.answer, /^\d{3}°$/);
    }
    for (const item of draws('sine_area')) {
      const [a, b, C] = item.eq.split(', ').map(Number);
      assert.equal(Number(item.answer), Math.round(0.5 * a! * b! * Math.sin((C! * Math.PI) / 180) * 1e6) / 1e6);
    }
  });

  it('units and time', () => {
    for (const id of ['units_m', 'units_km', 'units_mass', 'units_volume']) for (const item of draws(id)) {
      const f = id === 'units_m' ? 100 : 1000;
      const [v] = nums(item.promptAr!);
      const big = { units_m: 'متر', units_km: 'كيلومتر', units_mass: 'كيلوغرام', units_volume: 'لتر' }[id]!;
      const toSmall = item.promptAr!.startsWith(`حوّل ${v} ${big} إلى`);
      assert.equal(Number(item.answer), toSmall ? v! * f : v! / f, item.promptAr);
    }
    const FAMILY: Record<string, string[]> = { units_length: ['متر'], units_mass_g45: ['غرام'], units_capacity: ['لتر'], units_capacity_length: ['متر', 'لتر'] };
    for (const id of Object.keys(FAMILY)) for (const item of draws(id)) {
      assert.ok(FAMILY[id]!.some(w => item.promptAr!.includes(w)), `${id}: ${item.promptAr}`);
      if (id === 'units_mass_g45') assert.ok(!item.promptAr!.includes('لتر') && !item.promptAr!.includes('متر'), item.promptAr);
      if (id === 'units_capacity') assert.ok(!item.promptAr!.includes('غرام') && !item.promptAr!.includes('متر'), item.promptAr);
      const n = nums(item.promptAr!);
      const big = n.length === 2;
      const f = has(item.promptAr!, 'سنتيمتر') ? 100 : 1000;
      assert.equal(Number(item.answer), big ? n[0]! * f + n[1]! : n[0]! * f, item.promptAr);
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
