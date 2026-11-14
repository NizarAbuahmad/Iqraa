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
import { mathBankCovers, takeElementaryMath, beginMathPracticeSession, type ConcreteItem, type DiffTier } from '../index.ts';

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
    const SIDES: Record<string, number> = { 'الرباعي': 4, 'الخماسي': 5, 'السداسي': 6, 'السباعي': 7, 'الثماني': 8, 'التساعي': 9, 'العشاري': 10 };
    const NAME: Record<number, string> = { 4: 'رباعي', 5: 'خماسي', 6: 'سداسي', 7: 'سباعي', 8: 'ثماني', 9: 'تساعي', 10: 'عشاري' };
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

  /** A graph stem: «…: label: 18°، label: 21°…. question» → the points and the question. */
  const graph = (p: string, sep: string) => {
    const table = p.slice(p.indexOf(': ') + 2, p.lastIndexOf('. ')), q = p.slice(p.lastIndexOf('. ') + 2);
    const rows = table.split(sep).map(r => { const m = r.match(/^\s*(.+?): \D*?(\d+)(?:\D*?(\d+))?/)!; return { k: m[1]!.trim(), v: [Number(m[2]), Number(m[3])] }; });
    return { rows, q };
  };

  it('line graphs', () => {
    const kinds = new Set<string>();
    for (const item of draws('line_graph_g5')) {
      const { rows, q } = graph(item.promptAr!, '، ');
      const v = rows.map(r => r.v[0]!), k = rows.map(r => r.k), p = item.promptAr!;
      assert.ok(rows.length >= 5, p);
      if (/أعلى|أدنى/.test(q)) {
        kinds.add('extreme'); const x = q.includes('أعلى') ? Math.max(...v) : Math.min(...v);
        assert.equal(v.filter(y => y === x).length, 1, `a tie: ${p}`); assert.equal(item.answer, k[v.indexOf(x)], p); continue;
      }
      if (q.includes('أكبر زيادة')) {
        kinds.add('rise');
        const rises = v.slice(1).map((x, i) => x - v[i]!), best = Math.max(...rises);
        assert.ok(best > 0, p); assert.equal(rises.filter(r => r === best).length, 1, `a tie: ${p}`);
        const i = rises.indexOf(best);
        assert.equal(item.answer, `من ${k[i]} إلى ${k[i + 1]}`, p);
        continue;
      }
      kinds.add('grow');
      const named = k.filter(x => q.includes(x));
      assert.equal(named.length, 2, p);
      assert.equal(Number(item.answer), v[k.indexOf(named[1]!)]! - v[k.indexOf(named[0]!)]!, p);
      for (let i = 1; i < v.length; i++) assert.ok(v[i]! > v[i - 1]!, `a plant shrank: ${p}`);
    }
    assert.equal(kinds.size, 3, [...kinds].join(', '));
  });

  it('double bar graphs', () => {
    const kinds = new Set<string>();
    for (const item of draws('double_bar_g5')) {
      const p = item.promptAr!, { rows, q } = graph(p, '؛ ');
      assert.equal(rows.length, 4, p);
      const gap = (r: (typeof rows)[number]) => Math.abs(r.v[0]! - r.v[1]!);
      const asked = rows.filter(r => q.includes(r.k));
      if (q.includes('كم طالبًا وطالبة')) { kinds.add('total'); assert.equal(asked.length, 1, p); assert.equal(Number(item.answer), asked[0]!.v[0]! + asked[0]!.v[1]!, p); continue; }
      if (q.includes('بكم يزيد')) {
        kinds.add('gap'); assert.equal(asked.length, 1, p);
        assert.equal(Number(item.answer), gap(asked[0]!), p);
        // «بكم يزيد عدد طلاب الشعبة X … على عدد طلاب الشعبة Y»: X is the larger
        const x = q.match(/الشعبة (\S)/)![1], larger = asked[0]!.v[0]! > asked[0]!.v[1]! ? 'أ' : 'ب';
        assert.equal(x, larger, p);
        continue;
      }
      if (q.includes('الفرق')) {
        kinds.add('widest'); const best = Math.max(...rows.map(gap));
        assert.equal(rows.filter(r => gap(r) === best).length, 1, `a tie: ${p}`);
        assert.equal(item.answer, rows.find(r => gap(r) === best)!.k, p); continue;
      }
      kinds.add('lead');
      const first = rows.filter(r => r.v[0]! > r.v[1]!), second = rows.filter(r => r.v[1]! > r.v[0]!);
      const odd = first.length === 1 ? first : second;
      assert.equal(odd.length, 1, p);
      assert.equal(item.answer, odd[0]!.k, p);
      // the question names the section that is ahead in that month
      const leader = q.match(/استعارت الشعبة (\S)/)![1];
      assert.equal(leader, odd[0]!.v[0]! > odd[0]!.v[1]! ? 'أ' : 'ب', p);
    }
    assert.equal(kinds.size, 4, [...kinds].join(', '));
  });
});

describe('Grade 5 problem-solving plans: answers recomputed from the stem (2026-11-14)', () => {
  it('make a table: the table is built row by row', () => {
    const kinds = new Set<string>();
    for (const item of draws('make_table_g5')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'كرات خضراء وحمراء')) {
        kinds.add('ratio');
        const green = has(p, 'كرة خضراء واحدة') ? 1 : has(p, 'كرتين') ? 2 : n[0]!;
        const red = n[has(p, 'كرة خضراء واحدة') || has(p, 'كرتين') ? 0 : 1]!, total = n[n.length - 1]!;
        let g = 0, r = 0;
        while (g + r < total) { g += green; r += red; }
        assert.equal(g + r, total, `the total is not a whole number of rows: ${p}`);
        assert.equal(a, r, p);
      } else if (has(p, 'ادّخرت هند')) {
        kinds.add('pattern');
        const [s, d, day] = n as [number, number, number];
        let v = s;
        for (let i = 1; i < day; i++) v += d;
        assert.equal(a, v, p);
      } else if (has(p, 'قمصان') || has(p, 'قميصًا')) {
        kinds.add('outfits');
        let c = 0;
        for (let i = 0; i < n[0]!; i++) for (let j = 0; j < n[1]!; j++) c++;
        assert.equal(a, c, p);
      } else {
        kinds.add('coins');
        const N = n[0]!;
        let ways = 0;
        for (let tens = 0; tens * 10 <= N; tens++) if ((N - tens * 10) % 5 === 0) ways++;
        assert.equal(a, ways, p);
      }
    }
    assert.deepEqual([...kinds].sort(), ['coins', 'outfits', 'pattern', 'ratio']);
  });

  it('draw a model: the equation the model gives is solved', () => {
    const kinds = new Set<string>();
    for (const item of draws('draw_model_g5')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'أيّ المعادلات')) {
        kinds.add('equation');
        const [b, a] = n as [number, number];
        assert.equal(item.answer, `x + ${a} = ${b}`, p);
        continue;
      }
      const x = Number(item.answer);
      if (has(p, 'أقل منه بمقدار')) { kinds.add('fewer'); assert.equal(x + n[1]!, n[0], p); }
      else if (has(p, 'انخفضت')) { kinds.add('drop'); assert.equal(x - n[0]!, n[1], p); }
      else if (has(p, 'الساعة الواحدة')) { kinds.add('equal parts'); assert.equal(n[1]! * x, n[0], p); }
      else { kinds.add('groups'); assert.equal(x, n[0]! * n[1]!, p); }
    }
    assert.deepEqual([...kinds].sort(), ['drop', 'equal parts', 'equation', 'fewer', 'groups']);
  });
});

describe('Grade 5 «قسمة الكسور» never prints a fraction equal to 1 (2026-11-14)', () => {
  it('no «2/2» or «3/3» in 400 questions', () => {
    for (let i = 0; i < 400; i++) {
      if (i % 20 === 0) beginMathPracticeSession();
      const q = takeElementaryMath('multiple_choice', 'قِسْمَةُ الكُسورِ', null, 5, TIERS[i % 3]!, 'ar', 1);
      assert.ok(q, 'an item comes back');
      for (const m of q.text.matchAll(/(?<![\d.])(\d+)\/(\d+)(?![\d.])/g)) assert.notEqual(m[1], m[2], q.text);
    }
  });
});

describe('Grade 5 routing', () => {
  const cases: Array<[string, string | null]> = [
    ['الضَّرْبُ الذِّهْنِيُّ', 'mental_mul_g5'], ['الْمُضَلَّعاتُ', 'polygons_g5'], ['السُّؤالُ الإِحْصائِيُّ', 'stat_question_g5'],
    ['التَّمْثيلُ بِالخُطوطِ', 'line_graph_g5'], ['التَّمْثيلُ بِالأَعْمِدَةِ المُزْدَوَجَةِ', 'double_bar_g5'],
    // the two problem-solving plans were refused until 2026-11-14, when Grades 3, 4, 6 and 7 already served theirs;
    // they now get the problems their book pages solve with the plan (S1 pp. 24-25, S2 pp. 56-57)
    ['خُطَّةُ حَلِّ المَسْأَلَةِ: أُنْشِئُ جَدْوَلًا', 'make_table_g5'], ['خُطَّةُ حَلِّ الْمَسْأَلَةِ (أَرْسُمُ نَموذَجًا)', 'draw_model_g5'],
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
