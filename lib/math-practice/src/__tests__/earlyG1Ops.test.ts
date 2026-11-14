/**
 * Grade 1 operation lessons that used to have no generator of their own.
 *
 * Swept 2026-11-13: «جمع العشرات», «طرح العشرات», «جمع/طرح عددين من منزلتين»,
 * «الطرح باستعمال الضعف», «الطرح بإيجاد عشرة», «الجمع بالإكمال إلى العشرة» and
 * «جمع ثلاثة أعداد» fell through to generic one-digit drills, so a «جمع
 * العشرات» quiz asked «3 + ؟ = 4» and nothing about tens. Each answer here is
 * recomputed from the numbers in the Arabic stem, and each item is checked to
 * be about its lesson's own skill.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
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
function draws(id: string, n = 300): ConcreteItem[] {
  const t = TOPICS.find(x => x.id === id);
  assert.ok(t, `no generator ${id}`);
  return Array.from({ length: n }, (_, i) => makeTopicItem(t, 1, TIERS[i % 3]!, new Set(), seeded(i * 7919 + 11)));
}
const nums = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const has = (s: string, w: string) => s.includes(w);

const ROUTES: Array<[string, string]> = [
  ['جَمْعُ الْعَشَراتِ', 'tens_add_g1'], ['طَرْحُ الْعَشَراتِ', 'tens_sub_g1'],
  ['جَمْعُ عَدَدَيْنِ مِنْ مَنْزِلَتَيْنِ', 'two_digit_add_g1'], ['طَرْحُ عَدَدَيْنِ مِنْ مَنْزِلَتَيْنِ', 'two_digit_sub_g1'],
  ['الطَّرْحُ بِاسْتِعْمالِ الضِّعْفِ', 'sub_doubles_g1'], ['الطَّرْحُ بِإيجادِ عَشَرَةٍ', 'sub_make_ten_g1'],
  ['الْجَمْعُ بِالْإِكْمالِ إِلى الْعَشَرَةِ', 'add_make_ten_g1'], ['جَمْعُ ثَلاثَةِ أَعْدادٍ', 'add_three_g1'],
];

describe('Grade 1 operation lessons route to their own generator', () => {
  for (const [title, id] of ROUTES) {
    it(`${title} → ${id}`, () => {
      assert.equal(topicFor(title, 1)?.id, id);
      assert.ok(mathBankCovers(title, null, 1));
    });
  }
  it('and only at Grade 1', () => {
    for (const [title] of ROUTES) assert.equal(topicFor(title, 2)?.id?.endsWith('_g1') ?? false, false, title);
  });
});

describe('Grade 1 operation generators: shape and answers', () => {
  for (const [, id] of ROUTES) {
    it(`${id}: four distinct options, no stray text`, () => {
      for (const item of draws(id)) {
        const where = `${id} «${item.promptAr}» → ${item.answer} | ${item.wrongs.join(' | ')}`;
        assert.equal(item.wrongs.length, 3, where);
        assert.equal(new Set([item.answer, ...item.wrongs]).size, 4, where);
        for (const s of [item.answer, ...item.wrongs, item.promptAr!, item.promptEn!]) assert.ok(!/NaN|undefined|-\d/.test(s), where);
        for (const n of [...nums(item.promptAr!), ...item.wrongs.map(Number)]) assert.ok(n <= 99, `beyond Grade 1: ${where}`);
      }
    });
  }

  it('whole tens: every number is a ten, the answer is right', () => {
    for (const id of ['tens_add_g1', 'tens_sub_g1']) {
      const add = id.includes('_add_'), kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, a = Number(item.answer);
        if (has(p, 'عشرات')) {
          // «3 عشرات + 4 عشرات = ___ عشرات» (main's kind, merged 2026-11-14): counts of 3 or more
          kinds.add('counted'); const [c, d] = nums(p); assert.equal(a, add ? c! + d! : c! - d!, p); assert.ok(c! >= 3 && d! >= 3, p);
          continue;
        }
        if (has(p, 'إذا كان')) {
          kinds.add('hint'); const [x, y, , X, Y] = nums(p);
          assert.equal(X, x! * 10); assert.equal(Y, y! * 10); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        } else if (has(p, 'قلم')) {
          kinds.add('story'); const [X, Y] = nums(p); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        } else if (has(p, '___ =')) {
          kinds.add('missing'); const [X, R] = nums(p); assert.equal(add ? X! + a : X! - a, R, p);
        } else {
          kinds.add('plain'); const [X, Y] = nums(p); assert.equal(a, add ? X! + Y! : X! - Y!, p);
        }
        for (const n of nums(p).filter(n => n >= 10)) assert.equal(n % 10, 0, `not a ten: ${p}`);
        assert.ok(a > 0 && a <= 90, p);
      }
      assert.equal(kinds.size, 5, `${id}: ${[...kinds]}`);
    }
  });

  it('two-digit numbers: no regrouping, the answer is right', () => {
    for (const id of ['two_digit_add_g1', 'two_digit_sub_g1']) {
      const add = id.includes('_add_'), kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!, a = Number(item.answer), [x, y] = nums(p);
        assert.ok(x! >= 10 && x! <= 99, p);
        if (has(p, 'كم عشرة')) { kinds.add('tens'); assert.equal(a, Math.floor((add ? x! + y! : x! - y!) / 10), p); }
        else if (has(p, 'رقم الآحاد')) { kinds.add('ones'); assert.equal(a, (add ? x! + y! : x! - y!) % 10, p); }
        else if (has(p, '___ =')) { kinds.add('missing'); const r = nums(p)[1]!; assert.equal(add ? x! + a : x! - a, r, p); assert.ok(a >= 10, p); }
        else { kinds.add(has(p, 'قرش') ? 'story' : 'plain'); assert.equal(a, add ? x! + y! : x! - y!, p); assert.ok(y! >= 10, p); }
        const other = has(p, '___ =') ? a : y!;
        const ones = add ? (x! % 10) + (other % 10) : (x! % 10) - (other % 10);
        assert.ok(ones >= 0 && ones <= 9, `regrouping: ${p}`);
        if (add) assert.ok(x! + other <= 99, p); else assert.ok(x! - other >= 10, p);
      }
      assert.equal(kinds.size, 5, `${id}: ${[...kinds]}`);
    }
  });

  it('subtraction using doubles: the minuend is a double of the answer', () => {
    for (const item of draws('sub_doubles_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'إذا كان')) { assert.equal(n[0], n[1]); assert.equal(n[2], 2 * n[0]!); assert.equal(a, n[3]! - n[4]!); }
      else if (has(p, '___ =')) assert.equal(n[0]! - a, n[1], p);
      else assert.equal(a, n[0]! - n[1]!, p);
      assert.equal(n[0], has(p, 'إذا كان') ? a : 2 * a, p);
    }
  });

  it('subtraction by making ten: a teen minus a number that crosses ten', () => {
    const kinds = new Set<string>();
    for (const item of draws('sub_make_ten_g1')) {
      const p = item.promptAr!, a = Number(item.answer), [x, y, z] = nums(p);
      assert.ok(x! >= 11 && x! <= 18 && y! <= 9 && y! > x! - 10, `does not cross ten: ${p}`);
      if (has(p, 'نطرح')) { kinds.add('steps'); assert.equal(z, x! - 10); assert.equal(a, y! - z!, p); }
      else if (has(p, '10 − ___')) { kinds.add('complete'); assert.equal(10 - a, x! - y!, p); }
      else { kinds.add(has(p, 'برتقال') ? 'story' : 'plain'); assert.equal(a, x! - y!, p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('adding by making ten: crosses ten, the steps are right', () => {
    const kinds = new Set<string>();
    for (const item of draws('add_make_ten_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'نأخذ')) { kinds.add('steps'); const [x, y, need] = n; assert.equal(need, 10 - x!); assert.equal(a, y! - need!, p); assert.ok(x! + y! > 10, p); }
      else if (has(p, '10 + ___')) { kinds.add('complete'); assert.equal(10 + a, n[0]! + n[1]!, p); assert.ok(n[0]! + n[1]! > 10, p); }
      else if (has(p, '___ = 10')) { kinds.add('ten'); assert.equal(n[0]! + a, 10, p); }
      else { kinds.add('plain'); assert.equal(a, n[0]! + n[1]!, p); assert.ok(a > 10 && a <= 18, p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('three addends: the sum is right and within 20', () => {
    const kinds = new Set<string>();
    for (const item of draws('add_three_g1')) {
      const p = item.promptAr!, a = Number(item.answer), n = nums(p);
      if (has(p, 'مجموعهما 10')) { kinds.add('ten'); const [, x, m, y] = n; assert.equal(x! + y!, 10, p); assert.equal(a, x! + m! + y!, p); }
      else if (has(p, '___ =')) { kinds.add('missing'); assert.equal(n[0]! + n[1]! + a, n[2], p); }
      else { kinds.add(has(p, 'كرة') ? 'story' : 'plain'); assert.equal(n.length, 3, p); assert.equal(a, n[0]! + n[1]! + n[2]!, p); }
      assert.ok((has(p, '___ =') ? n[2]! : a) <= 20, p);
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });
});

describe('a word-problem slot in a Grade 1 operation lesson', () => {
  it('gets a story, not a bare sum with «اكتب الحل موضّحًا الخطوات»', () => {
    for (const [title] of ROUTES) {
      let stories = 0;
      for (let i = 0; i < 20; i++) {
        const q = takeElementaryMath('word_problem', title, null, 1, 'easy', 'ar', 1, new Set());
        assert.ok(q, title);
        if (!/موضّحًا الخطوات/.test(q.text)) stories++;
      }
      assert.equal(stories, 20, `${title}: ${20 - stories} of 20 were a bare item`);
    }
  });
});

/** Any generator by id, drawn at Grade 1. */
const g1Draws = (id: string, n = 400) => draws(id, n);

describe('Grade 1 maths fits the book (review, 2026-11-13)', () => {
  it('semester 1 adds and subtracts within 20', () => {
    for (const id of ['add_props_g1', 'missing_number']) {
      for (const item of g1Draws(id)) {
        const p = item.promptAr!;
        for (const n of (p.match(/\d+/g) ?? []).map(Number)) assert.ok(n <= 20, `${id}: past 20: ${p}`);
        assert.ok(Number(item.answer) <= 20, `${id}: ${p} → ${item.answer}`);
      }
    }
  });

  it('«العدد صفر» has no sums or differences — + and − come in units 3 and 4', () => {
    for (const item of g1Draws('count_zero')) assert.doesNotMatch(item.promptAr!, /[+−]/, item.promptAr);
  });

  it('the fractions unit teaches the half and the quarter: no third, no hidden multiplication', () => {
    for (const id of ['equal_parts', 'fraction_of_set_g1', 'half', 'quarter']) {
      for (const item of g1Draws(id)) {
        const t = `${item.promptAr} ${item.answer} ${item.wrongs.join(' ')}`;
        assert.doesNotMatch(t, /ثلث/, `${id}: ${item.promptAr}`);
        assert.doesNotMatch(item.promptAr!, /ما العدد الذي (نصفه|ربعه)|كم كرة كانت/, `${id}: ${item.promptAr}`);
      }
    }
  });

  it('the number chart never says left or right', () => {
    for (const item of g1Draws('number_chart')) assert.doesNotMatch(item.promptAr!, /يمين|يسار/, item.promptAr);
  });

  it('whole hours are read off a clock, not counted as elapsed time', () => {
    for (const item of g1Draws('hour_full')) assert.doesNotMatch(item.promptAr!, /كم ساعة|بعد \d|بعد ساع/, item.promptAr);
  });

  it('Grade 1 shapes are the triangle, square, rectangle and circle', () => {
    for (const id of ['plane_shapes', 'plane_sides_g1']) {
      for (const item of g1Draws(id)) assert.doesNotMatch(`${item.promptAr} ${item.answer} ${item.wrongs.join(' ')}`, /الخماسي|السداسي/, item.promptAr);
    }
  });

  it('counted nouns read right: no «1 عشرات», «2 قطع», «10 قرشًا», «كم آحادًا»', () => {
    for (const id of ['tens_ones_a', 'tens_ones_b', 'tens_ones_c', 'coins_a', 'coins_b', 'coins_c']) {
      for (const item of g1Draws(id)) {
        const p = item.promptAr!;
        assert.doesNotMatch(p, /(^|\D)[12] (عشرات|آحاد|قطع|أعمدة|مكعبات)|(^|\D)([3-9]|10) قرشًا|كم آحادًا/, `${id}: ${p}`);
      }
    }
  });

  it('a lesson whose bank used to be shared now asks its own thing', () => {
    const frames = (id: string) => new Set(g1Draws(id, 120).map(i => i.promptAr!.replace(/\d+/g, '#').replace(/«[^»]*»/g, '«»')));
    for (const group of [['tens_ones_a', 'tens_ones_b', 'tens_ones_c'], ['coins_a', 'coins_b', 'coins_c'], ['plane_shapes', 'plane_sides_g1'],
      ['data_table_g1', 'picto_make_g1', 'picto_read_g1'], ['compare_len', 'units_len_g1'], ['compare_mass', 'units_mass_g1'], ['compare_cap', 'units_cap_g1']]) {
      const sets = group.map(frames);
      for (let i = 0; i < sets.length; i++) for (let j = i + 1; j < sets.length; j++) {
        const shared = [...sets[i]!].filter(f => sets[j]!.has(f)).length;
        assert.ok(shared / Math.min(sets[i]!.size, sets[j]!.size) < 0.5, `${group[i]} and ${group[j]} share ${shared} frames`);
      }
    }
  });

  it('«using coins» is about buying', () => {
    assert.ok(g1Draws('coins_c').some(i => /اشترى/.test(i.promptAr!)));
  });
});

describe('Grade 1 lessons that were refused or shared a bank: answers recomputed', () => {
  const STARS = (s: string) => (s.match(/★/g) ?? []).length;

  it('position: opposites, a queue, a relation read back, right and left', () => {
    const OPP: Record<string, string> = { 'فوق': 'تحت', 'تحت': 'فوق', 'أمام': 'خلف', 'خلف': 'أمام', 'داخل': 'خارج', 'خارج': 'داخل', 'قريب': 'بعيد', 'بعيد': 'قريب', 'يمين': 'يسار', 'يسار': 'يمين' };
    const kinds = new Set<string>();
    for (const item of draws('position_g1')) {
      const p = item.promptAr!;
      if (has(p, 'ما عكس')) { kinds.add('opposite'); assert.equal(item.answer, OPP[p.match(/«(.+)»/)![1]!], p); }
      else if (has(p, 'طابور')) { kinds.add('queue'); const names = p.split(': ')[1]!.split('.')[0]!.split('، '); const who = p.match(/خلف (\S+) مباشرة/)![1]!; assert.equal(item.answer, names[names.indexOf(who) + 1], p); }
      else if (has(p, 'إذا كانت')) { kinds.add('relation'); const rel = p.match(/إذا كانت \S+ (\S+) /)![1]!; assert.equal(item.answer, OPP[rel], p); }
      else { kinds.add('hand'); assert.equal(item.answer, has(p, 'يدي اليمنى،') ? 'اليسرى' : 'اليمنى', p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('sorting by one property: odd one out, counting a colour, the group, the rule', () => {
    const G: Record<string, string> = {};
    for (const [g, xs] of [['الفواكه', ['تفاحة', 'موزة', 'برتقالة', 'عنب', 'فراولة']], ['الحيوانات', ['قطة', 'أرنب', 'حصان', 'بقرة', 'خروف']], ['الأدوات المدرسية', ['قلم', 'ممحاة', 'مسطرة', 'دفتر', 'مبراة']], ['الملابس', ['قميص', 'حذاء', 'قبعة', 'معطف', 'جورب']]] as const) for (const x of xs) G[x] = g;
    const kinds = new Set<string>();
    for (const item of draws('classify_one_g1')) {
      const p = item.promptAr!;
      if (has(p, 'لا ينتمي')) { kinds.add('odd'); const xs = p.split(': ')[1]!.replace('؟', '').split('، '); const groups = xs.map(x => G[x]); assert.equal(groups.filter(g => g === G[item.answer]).length, 1, p); }
      else if (has(p, 'حسب اللون')) { kinds.add('colour'); const red = (p.match(/حمراء/g) ?? []).length, yellow = (p.match(/صفراء/g) ?? []).length; assert.equal(Number(item.answer), has(p, 'شيئًا أحمر') ? red : yellow, p); }
      else if (has(p, 'في أيّ مجموعة')) { kinds.add('group'); assert.equal(item.answer, G[p.match(/«(.+)»/)![1]!], p); }
      else { kinds.add('rule'); const xs = p.split(': ')[1]!.split('.')[0]!.split('، '); assert.ok(xs.every(x => G[x] === item.answer), p); }
    }
    assert.equal(kinds.size, 4, [...kinds].join());
  });

  it('sorting by two properties: count both, find both, the right box', () => {
    const kinds = new Set<string>();
    for (const item of draws('classify_two_g1')) {
      const p = item.promptAr!;
      if (has(p, 'عند سامي')) {
        kinds.add('count');
        const items = p.split(': ')[1]!.split('. ')[0]!.split('، ');
        const m = p.match(/كم (\S+?)ً?ا? (أحمر|أزرق|حمراء|زرقاء) عنده/)!;
        const shape = m[1]!.replace(/ًا$|ً$/, '').replace(/ا$/, '');
        assert.equal(Number(item.answer), items.filter(x => x === `${shape === 'دائرة' || m[1]!.startsWith('دائرة') ? 'دائرة' : shape} ${m[2]}`).length, p);
      } else if (has(p, 'معًا')) { kinds.add('both'); const [, col, size] = item.answer.split(' '); assert.match(p, new RegExp(`أيّ هذه ${col} و${size}`), p); }
      else { kinds.add('box'); const it = p.match(/«(.+)»؟/)![1]!; assert.equal(item.answer, `صندوق «${it}»`, p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('guess and check: sum and difference, a number thought of, coins', () => {
    const kinds = new Set<string>();
    for (const item of draws('guess_check_g1')) {
      const p = item.promptAr!, n = nums(p), a = Number(item.answer);
      if (has(p, 'مجموعهما')) { kinds.add('sum-diff'); const [s, d] = n; const big = (s! + d!) / 2; assert.equal(a, has(p, 'الأكبر؟') ? big : s! - big, p); assert.ok(Number.isInteger(big) && s! <= 20, p); }
      else if (has(p, 'فكّرت')) { kinds.add('think'); assert.equal(a + n[0]!, n[1], p); assert.ok(a > 0, p); }
      else { kinds.add('coins'); const cnt = n[0], total = Number(p.match(/ومجموعها (\d+)/)![1]); assert.equal(10 * a + 5 * (cnt! - a), total, p); assert.ok(a >= 1 && a < cnt!, p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('choosing the operation: which one, the number sentence, the result', () => {
    const kinds = new Set<string>();
    for (const item of draws('choose_op_g1')) {
      const p = item.promptAr!, [a, b] = nums(p), add = /صعد|أُضيف|حطّ/.test(p);
      if (has(p, 'أيّ عملية')) { kinds.add('which'); assert.equal(item.answer, add ? 'الجمع' : 'الطرح', p); }
      else if (has(p, 'جملة عددية')) { kinds.add('sentence'); assert.equal(item.answer, `${a} ${add ? '+' : '−'} ${b}`, p); }
      else { kinds.add('result'); assert.equal(Number(item.answer), add ? a! + b! : a! - b!, p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('daily routines: first or last, what comes next, the time of day', () => {
    const ORDER = ['أستيقظ من النوم', 'أتناول الفطور', 'أذهب إلى المدرسة', 'أعود من المدرسة', 'أتناول الغداء', 'أكتب واجباتي', 'أتناول العشاء', 'أنام'];
    const kinds = new Set<string>();
    for (const item of draws('daily_order_g1')) {
      const p = item.promptAr!;
      if (has(p, 'أيّ هذه الأعمال')) { kinds.add('first/last'); const xs = p.split('المدرسة: ')[1]!.replace('؟', '').split('، ').map(x => ORDER.indexOf(x)); assert.equal(ORDER.indexOf(item.answer), has(p, 'أولًا') ? Math.min(...xs) : Math.max(...xs), p); }
      else if (has(p, 'بعد')) { kinds.add('next'); assert.equal(ORDER.indexOf(item.answer), ORDER.indexOf(p.match(/«(.+)»/)![1]!) + 1, p); }
      else { kinds.add('time'); assert.match(item.answer, /^في (الصباح|الظهر|المساء|الليل)$/, p); }
    }
    assert.equal(kinds.size, 3, [...kinds].join());
  });

  it('data: a table read, a picture graph made, a picture graph read', () => {
    /** «name: value» pairs between the lead's colon and the full stop. */
    const pairs = (p: string, val: (v: string) => number) => p.slice(p.indexOf(':') + 1, p.indexOf('.')).split('، ').map(x => { const [k, v] = x.split(': '); return [k!.trim(), val(v!)] as const; });
    const check = (item: { promptAr?: string; answer: string }, rows: ReadonlyArray<readonly [string, number]>) => {
      const p = item.promptAr!, v = rows.map(r => r[1]), a = item.answer;
      assert.equal(rows.length, 3, p); assert.equal(new Set(v).size, 3, p);
      if (/أكثر/.test(p)) assert.equal(a, rows[v.indexOf(Math.max(...v))]![0], p);
      else if (/أقل/.test(p)) assert.equal(a, rows[v.indexOf(Math.min(...v))]![0], p);
      else if (/جميعًا|كلّه/.test(p)) assert.equal(Number(a), v.reduce((x, y) => x + y, 0), p);
      else if (/بكم/.test(p)) assert.equal(Number(a), Math.max(...v) - Math.min(...v), p);
      else { const name = rows.find(r => p.endsWith(`${r[0]}؟`))!; assert.ok(name, p); assert.equal(Number(a), name[1], p); }
    };
    for (const item of draws('data_table_g1')) check(item, pairs(item.promptAr!, Number));
    for (const item of draws('picto_make_g1')) {
      const p = item.promptAr!, n = nums(p);
      if (has(p, 'بقي عليه')) assert.equal(Number(item.answer), n[0]! - STARS(p.split('صفها:')[1]!.split('.')[0]!), p);
      else if (has(p, 'كلّها')) assert.equal(Number(item.answer), n[0]! + n[1]!, p);
      else assert.match(item.answer, new RegExp(n[0]! > n[1]! ? p.match(/بالصور: (\S+) /)![1]! : p.match(/، و(\S+) \d/)![1]!), p);
    }
    for (const item of draws('picto_read_g1')) check(item, pairs(item.promptAr!, STARS));
  });

  it('non-standard units: the bigger unit from two measures, the fitting unit, the story', () => {
    for (const id of ['units_len_g1', 'units_mass_g1', 'units_cap_g1']) {
      const kinds = new Set<string>();
      for (const item of draws(id)) {
        const p = item.promptAr!;
        if (has(p, 'مرتين')) { kinds.add('two measures'); const m = [...p.matchAll(/بوحدة «(.+?)» فكان القياس (\d+)/g)].map(x => [x[1]!, Number(x[2])] as const); assert.equal(item.answer, m[0]![1] < m[1]![1] ? m[0]![0] : m[1]![0], p); }
        else if (has(p, 'أنسب')) kinds.add('fit');
        else { kinds.add('story'); assert.equal(Number(item.answer), 2 * nums(p)[0]!, p); }
      }
      assert.equal(kinds.size, 3, `${id}: ${[...kinds]}`);
    }
  });
});
