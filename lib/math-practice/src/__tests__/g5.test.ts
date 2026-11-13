/**
 * Grade 5 lessons that had no offline questions (`../g5.ts`): mental
 * multiplication, polygons, the statistical question, line graphs and double
 * bar graphs. Every answer is recomputed from the Arabic stem with separately
 * written code; option sets are checked for shape. (Grade 5 audit, 2026-11-13.)
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { G5_TOPICS } from '../g5.ts';
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
function draws(id: string, n = 240): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 5, TIERS[i % 3]!, new Set(), seeded(i * 6700417 + 11)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);
/** «السبت 18°، الأحد 21°…» or «كرة القدم: 12 و 8؛ …» → the labelled values, in order. */
const series = (s: string, re: RegExp) => [...s.matchAll(re)].map(m => ({ k: m[1]!.trim(), v: m.slice(2).map(Number) }));

describe('Grade 5 generators: shape', () => {
  for (const t of G5_TOPICS) {
    it(`${t.id}: three distinct wrong options, clean text, both languages`, () => {
      for (const item of draws(t.id)) {
        const where = `${t.id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.ok(item.answer && item.promptAr && item.promptEn, where);
        assert.ok(item.wrongs.length >= 1 && item.wrongs.length <= 3, where);
        if (!/^(?:نعم|لا)$/.test(item.answer)) assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, item.wrongs.length + 1, `not distinct: ${where}`);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) {
          assert.ok(!/NaN|undefined|Infinity|\[object/.test(s), `bad text: ${where}`);
          assert.ok(!/(^|[^\w])-\d/.test(s), `hyphen-minus: ${s}`);
        }
      }
    });
  }
});

describe('Grade 5 generators: answers recomputed from the stem', () => {
  it('mental multiplication', () => {
    const kinds = new Set<string>();
    for (const item of draws('mental_mul_g5')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'ضعف')) { kinds.add('double'); assert.equal(a, 2 * n[0]!, p); continue; }
      if (has(p, 'التنصيف والمضاعفة')) { kinds.add('halve'); assert.equal(a, n[0]! * n[1]!, p); assert.ok(n[0]! % 2 === 0 || n[1]! % 2 === 0, p); continue; }
      if (has(p, 'خاصية التوزيع')) { kinds.add('distribute'); assert.equal(a, n[0]! * n[1]!, p); continue; }
      if (has(p, '؟')) {
        const m = p.match(/(\d+) × (\d+|؟) = (\d+|؟)/);
        if (m && m[2] === '؟') { kinds.add('missing'); assert.equal(Number(m[1]) * a, Number(m[3]), p); continue; }
      }
      kinds.add('zeros');
      assert.equal(a, n[0]! * n[1]!, p);
      assert.ok(String(n[0]).endsWith('0') || String(n[1]).endsWith('0'), `no multiple of ten: ${p}`);
    }
    assert.ok(kinds.size >= 4, [...kinds].join(', '));
  });

  it('polygons', () => {
    const SIDES: Record<string, number> = { 'الثلاثي': 3, 'الرباعي': 4, 'الخماسي': 5, 'السداسي': 6, 'السباعي': 7, 'الثماني': 8, 'التساعي': 9, 'العشاري': 10 };
    const NAME: Record<number, string> = { 3: 'ثلاثي', 4: 'رباعي', 5: 'خماسي', 6: 'سداسي', 7: 'سباعي', 8: 'ثماني', 9: 'تساعي', 10: 'عشاري' };
    const named = (p: string) => { const k = Object.keys(SIDES).find(w => p.includes(`المضلع ${w}`) || p.includes(`مضلع ${w.slice(2)}`)); return k ? SIDES[k]! : null; };
    const kinds = new Set<string>();
    for (const item of draws('polygons_g5')) {
      const p = item.promptAr!, n = nums(p), a = item.answer;
      if (has(p, 'ليس مضلعًا')) { kinds.add('not'); assert.ok(['دائرة', 'شكل بيضاوي', 'نصف دائرة'].includes(a), p); continue; }
      if (has(p, 'ما اسم المضلع')) { kinds.add('name'); assert.equal(a, `مضلع ${NAME[n[0]!]}`, p); continue; }
      if (has(p, 'محيطه') && has(p, 'طول ضلعه')) { kinds.add('perimeter'); assert.equal(Number(a), named(p)! * n[0]!, p); continue; }
      if (has(p, 'محيطه')) { kinds.add('side'); assert.equal(Number(a) * named(p)!, n[0], p); continue; }
      if (has(p, 'رأسًا') || has(p, 'رؤوس')) { kinds.add('vertices'); assert.equal(Number(a), named(p), p); continue; }
      kinds.add('sides'); assert.equal(Number(a), named(p), p);
    }
    assert.equal(kinds.size, 6, [...kinds].join(', '));
  });

  it('the statistical question', () => {
    const kinds = new Set<string>();
    for (const item of draws('stat_question_g5')) {
      const p = item.promptAr!;
      if (has(p, 'الأكثر تكرارًا')) {
        kinds.add('mode');
        const answers = p.slice(p.indexOf('الإجابات:') + 'الإجابات:'.length, p.lastIndexOf('.')).split('،').map(x => x.trim());
        const count = (w: string) => answers.filter(x => x === w).length;
        const top = Math.max(...answers.map(count));
        assert.equal(count(item.answer), top, p);
        assert.equal(answers.filter((x, i) => answers.indexOf(x) === i && count(x) === top).length, 1, `a tie: ${p}`);
        continue;
      }
      if (has(p, '(نعم / لا)')) {
        kinds.add('yesno');
        // «هل السؤال «…» سؤال إحصائي؟»: a question about one person or one fact has one answer.
        const q = p.slice(p.indexOf('«') + 1, p.indexOf('»'));
        const one = /(?:^| )(?:أنا|لي|نمتُ|قرأتُ|استغرقتُ|صديقي|معلّمي|أخي|عاصمة|كم يومًا في)/.test(q);
        assert.equal(item.answer, one ? 'لا' : 'نعم', p);
        continue;
      }
      kinds.add('pick');
      // The statistical one asks a group and expects answers that vary.
      assert.ok(/طلاب|أفراد|لاعبي|زملائي|سكان|أسر/.test(item.answer), `${item.answer} ← ${p}`);
      for (const w of item.wrongs) assert.ok(!/طلاب صفي|أفراد|لاعبي|زملائي|سكان|أسر/.test(w), `${w} ← ${p}`);
    }
    assert.equal(kinds.size, 3, [...kinds].join(', '));
  });

  it('line graphs', () => {
    const kinds = new Set<string>();
    for (const item of draws('line_graph_g5')) {
      const p = item.promptAr!;
      const pts = series(p, /([^\s:،]+(?: [^\s:،]+)?): (\d+)°/g);
      assert.ok(pts.length >= 4, p);
      const v = pts.map(x => x.v[0]!), k = pts.map(x => x.k);
      if (has(p, 'أعلى درجة')) { kinds.add('max'); assert.equal(item.answer, k[v.indexOf(Math.max(...v))], p); assert.equal(v.filter(x => x === Math.max(...v)).length, 1, p); continue; }
      if (has(p, 'أدنى درجة')) { kinds.add('min'); assert.equal(item.answer, k[v.indexOf(Math.min(...v))], p); assert.equal(v.filter(x => x === Math.min(...v)).length, 1, p); continue; }
      if (has(p, 'أكبر ارتفاع')) {
        kinds.add('rise');
        const rises = v.slice(1).map((x, i) => x - v[i]!), best = Math.max(...rises);
        assert.equal(rises.filter(r => r === best).length, 1, p);
        const i = rises.indexOf(best);
        assert.equal(item.answer, `من ${k[i]} إلى ${k[i + 1]}`, p);
        continue;
      }
      kinds.add('change');
      const m = p.match(/بين (\S+(?: \S+)?) و ?(\S+(?: \S+)?)؟/)!;
      const a = v[k.indexOf(m[1]!)]!, b = v[k.indexOf(m[2]!)]!;
      assert.equal(Number(item.answer), Math.abs(b - a), p);
    }
    assert.equal(kinds.size, 4, [...kinds].join(', '));
  });

  it('double bar graphs', () => {
    const kinds = new Set<string>();
    for (const item of draws('double_bar_g5')) {
      const p = item.promptAr!;
      const rows = series(p, /([^:؛]+?): الطلاب (\d+) والطالبات (\d+)/g);
      assert.ok(rows.length >= 3, p);
      const find = (name: string) => rows.find(r => r.k.endsWith(name))!;
      if (has(p, 'كم طالبًا وطالبة')) { kinds.add('total'); const r = rows.find(r => p.includes(`يفضّلون ${r.k}`))!; assert.equal(Number(item.answer), r.v[0]! + r.v[1]!, p); continue; }
      if (has(p, 'بكم يزيد')) {
        kinds.add('diff'); const r = rows.find(r => p.includes(`يفضّلون ${r.k}`))!;
        assert.equal(Number(item.answer), Math.abs(r.v[0]! - r.v[1]!), p); assert.notEqual(r.v[0], r.v[1], p); continue;
      }
      if (has(p, 'أكبر فرق')) {
        kinds.add('widest'); const d = rows.map(r => Math.abs(r.v[0]! - r.v[1]!)), best = Math.max(...d);
        assert.equal(d.filter(x => x === best).length, 1, p); assert.equal(find(item.answer).k, rows[d.indexOf(best)]!.k, p); continue;
      }
      kinds.add('more');
      const girls = has(p, 'الطالبات أكثر');
      const hits = rows.filter(r => (girls ? r.v[1]! > r.v[0]! : r.v[0]! > r.v[1]!));
      assert.equal(hits.length, 1, p);
      assert.equal(find(item.answer).k, hits[0]!.k, p);
    }
    assert.equal(kinds.size, 4, [...kinds].join(', '));
  });
});

describe('Grade 5 routing', () => {
  const cases: Array<[string, string | null]> = [
    ['الضَّرْبُ الذِّهْنِيُّ', 'mental_mul_g5'], ['الْمُضَلَّعاتُ', 'polygons_g5'], ['السُّؤالُ الإِحْصائِيُّ', 'stat_question_g5'],
    ['التَّمْثيلُ بِالخُطوطِ', 'line_graph_g5'], ['التَّمْثيلُ بِالأَعْمِدَةِ المُزْدَوَجَةِ', 'double_bar_g5'],
    // a problem-solving plan is a method, not a skill a question bank can drill; it stays refused as in Grades 3–4
    ['خُطَّةُ حَلِّ المَسْأَلَةِ: أُنْشِئُ جَدْوَلًا', null], ['خُطَّةُ حَلِّ الْمَسْأَلَةِ (أَرْسُمُ نَموذَجًا)', null],
  ];
  for (const [title, id] of cases) {
    it(`${title} → ${id ?? 'refused'}`, () => {
      assert.equal(topicFor(title, 5)?.id ?? null, id);
      assert.equal(mathBankCovers(title, null, 5), id !== null);
    });
  }
  it('only Grade 5 gets them', () => {
    for (const t of G5_TOPICS) assert.deepEqual(t.grades, [5, 5], t.id);
  });
});
