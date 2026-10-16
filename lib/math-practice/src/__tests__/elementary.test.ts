/**
 * Grade 1–6 maths items. Before these, every such lesson fell through to the
 * Grade 10 bank's `algebra` family: a Grade 2 «الجمع» quiz asked «x² = 49».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { detectElementaryOp, lessonTable, makeElementaryItem } from '../elementary.ts';
import { itemStem, stemFrame, takeElementaryMath, type DiffTier } from '../index.ts';
import type { ConcreteItem } from '../index.ts';

/** mulberry32 — a seeded rng so a failure names a reproducible draw. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A counted noun written as a dual carries no digit: «في كل صف شجرتان» is two trees. */
const DUAL = 'شجرتان|قلمان|مربعان|بيضتان|طالبَين|مدرستَين|ديناران|كتابان|بطاقتان|لتران|كعكتان|تفاحتان|طالبان';
const TOKEN = new RegExp(`\\d+(?:\\.\\d+)?(?:/\\d+)?|${DUAL}`, 'g');
/** The numbers of a stem in reading order: whole, decimal, «a/b» as its value, a dual as 2. */
const tokens = (s: string) => s.match(TOKEN) ?? [];
const value = (s: string): number => {
  if (new RegExp(`^(?:${DUAL})$`).test(s)) return 2;
  const t = s.replace(/%$/, '');
  const [n, d] = t.split('/').map(Number);
  return d === undefined ? n! : n! / d;
};
const nums = (s: string) => tokens(s).map(value);

/** Recompute an item's answer from its own stem — the key must never be typed. */
function recompute(eq: string): string | null {
  const bin = eq.match(/^(\d+(?:\.\d+)?) ([+−×÷]) (\d+(?:\.\d+)?)$/);
  if (bin) {
    const [a, op, b] = [Number(bin[1]), bin[2], Number(bin[3])];
    const v = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    return String(Math.round(v * 100) / 100);
  }
  const cmp = eq.match(/^(\d+)(?:\/(\d+))? ___ (\d+)(?:\/(\d+))?$/);
  if (cmp) {
    const l = Number(cmp[1]) / Number(cmp[2] ?? 1);
    const r = Number(cmp[3]) / Number(cmp[4] ?? 1);
    return l > r ? '>' : l < r ? '<' : '=';
  }
  return null;
}

describe('the lesson decides the operation', () => {
  const cases: Array<[string, string | null]> = [
    ['الْجَمْعُ', 'add'],
    ['الطَّرْحُ مَعَ إِعادَةِ التَّجْميعِ (1)', 'sub'],
    ['الضَّرْبُ في 2', 'mul'],
    ['الْقِسْمَةُ عَلى 5', 'div'],
    ['مُقارَنَةُ الكُسورِ وَالأَعْدادِ الكَسْرِيَّةِ وَتَرْتيبُها', 'frac_compare'],
    ['جمع الكسور', 'frac'],
    ['الْقيمَةُ الْمَنْزِلِيَة', 'place'],
    ['مُقارَنَةُ الْأَعْدادِ', 'compare'],
    // Collecting data is not addition.
    ['جَمْعُ الْبَياناتِ وَتَنْظيمُها', null],
  ];
  for (const [title, want] of cases) {
    it(title, () => assert.equal(detectElementaryOp(title), want));
  }

  it('reads the times table a lesson drills', () => {
    assert.equal(lessonTable('الضَّرْبُ في 2'), 2);
    assert.equal(lessonTable('الْقِسْمَةُ عَلى 5'), 5);
    assert.equal(lessonTable('الْجَمْعُ'), null);
  });
});

describe('every answer is right', () => {
  const tiers: DiffTier[] = ['easy', 'medium', 'hard'];
  for (let grade = 1; grade <= 6; grade++) {
    it(`grade ${grade}`, () => {
      const used = new Set<string>();
      for (const title of ['الجمع', 'الطرح', 'الضرب', 'القسمة', 'المقارنة', 'مقارنة الكسور', 'الأعداد العشرية']) {
        for (const tier of tiers) {
          const item = makeElementaryItem(title, grade, tier, used);
          const want = recompute(item.eq);
          if (want !== null) assert.equal(item.answer, want, `${title} ${item.eq}`);
          assert.equal(item.wrongs.length >= 2, true, `${item.eq} has too few distractors`);
          assert.ok(!item.wrongs.includes(item.answer), `${item.eq}: a distractor equals the key`);
        }
      }
    });
  }
});

describe('numbers fit the grade', () => {
  const largest = (grade: number) => {
    const used = new Set<string>();
    let max = 0;
    for (let i = 0; i < 60; i++) {
      const item = makeElementaryItem('الجمع', grade, 'hard', used);
      for (const n of item.eq.match(/\d+/g) ?? []) max = Math.max(max, Number(n));
    }
    return max;
  };
  it('grade 1 adds within 20', () => assert.ok(largest(1) <= 20));
  it('grade 2 stays within 1000', () => assert.ok(largest(2) <= 1000));

  it('«الضرب في 2» drills the 2 times table only', () => {
    // Every kind — the product, the missing factor, repeated addition, the word
    // problem — keeps 2 as the known factor.
    const used = new Set<string>();
    for (let i = 0; i < 60; i++) {
      assert.match(makeElementaryItem('الضَّرْبُ في 2', 3, 'medium', used).eq, /(?:^|[^\d.])2 ×|× 2(?:$|[^\d./])/);
    }
  });

  it('grade 1 never sees a three-digit number, and adds and compares within 20', () => {
    const rng = seeded(11);
    for (const title of ['الجمع', 'الطرح', 'مقارنة الأعداد', 'ترتيب الأعداد', 'القيمة المنزلية']) {
      for (let i = 0; i < 300; i++) {
        const item = makeElementaryItem(title, 1, (['easy', 'medium', 'hard'] as const)[i % 3], new Set(), rng);
        const stem = itemStem(item, true);
        const limit = /منزلي/.test(title) ? 99 : 20;
        for (const n of nums(stem)) assert.ok(n <= limit, `${title}: ${stem}`);
      }
    }
  });
});

describe('question formats', () => {
  it('true/false items are not all «صح»', () => {
    const session = new Set<string>();
    const keys = new Set<string>();
    for (let i = 0; i < 30; i++) {
      keys.add(takeElementaryMath('true_false', 'الجمع', null, 2, 'medium', 'ar', 1, session)!.answer);
    }
    assert.deepEqual([...keys].sort(), ['خطأ', 'صح']);
  });

  it('no algebra reaches a primary grade', () => {
    const session = new Set<string>();
    for (const type of ['multiple_choice', 'short_answer', 'fill_blank', 'true_false', 'word_problem'] as const) {
      const q = takeElementaryMath(type, 'الجمع', null, 2, 'medium', 'ar', 1, session);
      assert.doesNotMatch(q!.text, /[xy]\s*[=²^]|\^|√/);
    }
  });
});

describe('fraction addition distractors', () => {
  const value = (s: string) => { const [n, d] = s.split('/').map(Number); return d === undefined ? n! : n! / d; };
  it('never offers a second option equal in value to the answer', () => {
    for (let i = 0; i < 2000; i++) {
      const item = makeElementaryItem('جمع الكسور', 4 + (i % 3), 'medium', new Set());
      const all = [item.answer, ...item.wrongs].map(value);
      assert.equal(item.wrongs.length, 3, item.eq);
      assert.equal(new Set(all).size, 4, `${item.eq}: ${item.answer} vs ${item.wrongs.join(', ')}`);
      assert.ok(![item.answer, ...item.wrongs].some(w => /\/1$/.test(w)), `${item.eq}: x/1 option`);
    }
  });
});

// ─── Every kind of question, answered again from its printed Arabic stem ─────

const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;
const lcm = (a: number, b: number): number => { const g = (x: number, y: number): number => (y ? g(y, x % y) : x); return (a * b) / g(a, b); };

/** Left to right over + − × ÷ (the stems never mix precedence). */
function evalExpr(e: string): number {
  const parts = e.trim().split(' ');
  let acc = value(parts[0]!);
  for (let i = 1; i < parts.length; i += 2) {
    const [op, x] = [parts[i]!, value(parts[i + 1]!)];
    acc = op === '+' ? acc + x : op === '−' ? acc - x : op === '×' ? acc * x : acc / x;
  }
  return acc;
}

/** «x op ؟ = z», «؟ op y = z» or «… = ؟ × a»: the unknown, solved by the inverse operation. */
function solveMissing(eq: string): number {
  const [lhs, rhs] = eq.split(' = ') as [string, string];
  const [side, other] = lhs.includes('؟') ? [lhs, evalExpr(rhs)] : [rhs, evalExpr(lhs)];
  const [x, op, y] = side.trim().split(' ') as [string, string, string];
  if (x === '؟') {
    const k = value(y);
    return op === '+' ? other - k : op === '−' ? other + k : op === '×' ? other / k : other * k;
  }
  const k = value(x);
  return op === '+' ? other - k : op === '−' ? k - other : op === '×' ? other / k : k / other;
}

const PLACE = ['الآحاد', 'العشرات', 'المئات', 'الألوف'];
const listOf = (p: string) => p.slice(p.lastIndexOf(':') + 1).replace(/[؟.]/g, '').split('،').map(x => x.trim());

/** [kind, expected answer] from the Arabic stem alone. */
function solve(p: string): [string, number | string] {
  const n = nums(p);
  const has = (w: string) => p.includes(w);
  let m: RegExpMatchArray | null;
  if ((m = p.match(/^أوجد ناتج: (.+)$/))) return ['drill', evalExpr(m[1]!)];
  if (has('ضع الإشارة المناسبة')) {
    const [l, r] = nums(p.split('\n')[1]!);
    return ['sign', l! > r! ? '>' : l! < r! ? '<' : '='];
  }
  if (has('أوجد ') && has('% من ')) return ['drill', n[0]! * n[1]! / 100];
  if (has('ما القيمة المنزلية للرقم')) {
    const [d, num] = [String(n[0]), String(n[1])];
    assert.equal(num.indexOf(d), num.lastIndexOf(d), `ambiguous digit: ${p}`);
    return ['value', Number(d) * 10 ** (num.length - 1 - num.indexOf(d))];
  }
  if (has('بالصورة التحليلية.')) {
    const ds = String(n[0]);
    return ['expand', [...ds].map((c, i) => Number(c) * 10 ** (ds.length - 1 - i)).filter(v => v > 0).join(' + ')];
  }
  if (has('صورته التحليلية')) return ['standard', n.reduce((x, y) => x + y, 0)];
  if ((m = p.match(/^ما الرقم في منزلة (\S+) في العدد (\d+)؟$/))) {
    const ds = m[2]!;
    return ['digit', Number(ds[ds.length - 1 - PLACE.indexOf(m[1]!)])];
  }
  if (has('رتّب')) {
    const xs = listOf(p).sort((x, y) => value(x) - value(y));
    return ['order', (has('تصاعديًّا') ? xs : xs.reverse()).join('، ')];
  }
  if ((m = p.match(/^ما (?:العدد|الكسر) (الأكبر|الأصغر) بين/))) {
    const xs = listOf(p).sort((x, y) => value(x) - value(y));
    return ['extreme', m[1] === 'الأكبر' ? xs[xs.length - 1]! : xs[0]!];
  }
  if (has('يمكن تكوينه من الأرقام')) {
    const ds = n.slice().sort((x, y) => x - y);
    return ['digits', (has('أكبر') ? ds.reverse() : ds).join('')];
  }
  if ((m = p.match(/^(?:أوجد العدد المجهول|أكمل بالعدد المناسب): (.+)$/))) {
    return [has('أكمل بالعدد المناسب') ? 'groups' : 'missing', solveMissing(m[1]!)];
  }
  if ((m = p.match(/^أوجد ناتج جمع الأعداد الثلاثة: (.+)$/))) return ['three', evalExpr(m[1]!)];
  if ((m = p.match(/^إذا كان (.+) = (\S+)، فما ناتج (.+)؟$/))) {
    assert.ok(near(evalExpr(m[1]!), value(m[2]!)), `false premise: ${p}`);
    return ['fact', evalExpr(m[3]!)];
  }
  if ((m = p.match(/^أكمل: 1\/(\d+) العدد (\d+) = \2 ÷ ؟$/))) {
    // «1/d of n = n ÷ ؟»: the divisor that gives the same value.
    return ['unitdiv', Number(m[2]) / (Number(m[2]) / Number(m[1]))];
  }
  if (has('العدد') && (m = p.match(/^أوجد 1\/(\d+) العدد (\d+)\.$/))) return ['unit', Number(m[2]) / Number(m[1])];
  if (has('أعطت 1/')) return ['unitword', n[0]! * n[1]!];
  if (has('مقلوب الكسر')) return ['recip', 1 / n[0]!];
  if (has('سعة كل منها')) return ['cups', n[0]! / n[1]!];
  if (has('قسمة الكسر')) return ['bywhole', n[0]! / n[1]!];
  if (has('المقام المشترك الأصغر')) {
    const [d1, d2] = tokens(p).map(t => Number(t.split('/')[1]));
    return ['lcd', lcm(d1!, d2!)];
  }
  if (has('ما مجموع الكسور')) return ['sum3', n.reduce((x, y) => x + y, 0)];
  if (has('على صورة كسر')) return ['pfrac', n[0]! / 100];
  if (has('لُوِّن')) return ['grid', `${n[0]}%`];
  if (has('منهم يأتون') || has('خصم')) return ['pword', n[0]! * n[1]! / 100];
  if (has('منهم يمارسون')) return ['of', n[0]! * n[1]!];
  if (has('مساحتها')) return ['area', n[0]! * n[1]!];
  if (has('اضرب العدد')) return ['shift', n[0]! * n[1]!];
  if (has('اقسم العدد')) return ['shift', n[0]! / n[1]!];
  if (has('العددين العشريين')) return ['dd', n[0]! * n[1]!];
  if (has('على العدد العشري')) return ['dd', n[0]! / n[1]!];
  if (has('اشترى') && has('ثمن الكيلوغرام الواحد')) return ['kg', n[1]! / n[0]!];
  if (has('ثمن الكيلوغرام الواحد')) return ['kg', n[0]! * n[1]!];
  if (has('كم مرة نطرح')) return ['repeat', n[1]! / n[0]!];
  if (has('ما أقل عدد من العلب')) return ['ceil', Math.ceil(n[0]! / n[1]!)];
  if (has('بالتساوي')) return ['share', n[0]! / n[1]!];
  if (has('كم طبقًا')) return ['trays', n[0]! / n[1]!];
  if (has('في كل صف') || has('في كل علبة')) return ['word', n[0]! * n[1]!];
  if (has('يزيد')) return ['more', n[0]! - n[1]!];
  if (has('بقي')) return ['take', n[0]! - n[1]!];
  if (has('أصبح') || has('في اليومين') || has('في الأسبوعين') || has('دفعت') || has('أكلاه معًا') || has('كم كيلوغرامًا اشترت')) {
    return ['word', n[0]! + n[1]!];
  }
  throw new Error(`no solver for: ${p}`);
}

/** Draws for a lesson title at a grade, every tier, from a seeded rng. */
function draws(title: string, grade: number, count = 360): ConcreteItem[] {
  const rng = seeded(grade * 7919 + title.length);
  const out: ConcreteItem[] = [];
  let used = new Set<string>();
  for (let i = 0; i < count; i++) {
    if (i % 30 === 0) used = new Set();
    out.push(makeElementaryItem(title, grade, (['easy', 'medium', 'hard'] as const)[i % 3], used, rng));
  }
  return out;
}

describe('every kind of question: the key is recomputed from the printed stem', () => {
  const CASES: Array<[string, number, string[]]> = [
    ['الجمع', 1, ['drill', 'missing', 'three', 'word', 'fact']],
    ['الجمع', 4, ['drill', 'missing', 'three', 'word', 'fact']],
    ['الطرح', 1, ['drill', 'missing', 'take', 'more', 'fact']],
    ['الطرح', 3, ['drill', 'missing', 'take', 'more', 'fact']],
    ['الضرب في 2', 2, ['drill', 'missing', 'groups', 'word']],
    ['ضرب الأعداد', 5, ['drill', 'missing', 'groups', 'word']],
    ['القسمة على 3', 2, ['drill', 'missing', 'fact', 'share', 'trays', 'repeat']],
    ['قسمة الأعداد', 4, ['drill', 'missing', 'fact', 'share', 'trays', 'ceil']],
    ['مقارنة الأعداد', 1, ['sign', 'order', 'extreme']],
    ['ترتيب الأعداد', 3, ['sign', 'order', 'extreme', 'digits']],
    ['القيمة المنزلية', 1, ['value', 'expand', 'digit', 'standard']],
    ['القيمة المنزلية', 5, ['value', 'expand', 'digit', 'standard']],
    ['مقارنة الكسور', 3, ['sign', 'order', 'extreme']],
    ['ترتيب الكسور', 5, ['sign', 'order', 'extreme']],
    ['جمع الكسور المتشابهة وطرحها', 4, ['drill', 'missing', 'word', 'sum3', 'take', 'more']],
    ['جمع الكسور', 5, ['drill', 'missing', 'word', 'lcd']],
    ['طرح الكسور', 5, ['drill', 'missing', 'take', 'more']],
    ['ضرب الكسور', 5, ['drill', 'of', 'area', 'missing']],
    // Grade 3 is a unit fraction of a number; Grade 5 divides fractions.
    ['قسمة الكسور', 3, ['unit', 'unitword', 'unitdiv']],
    ['قسمة الكسور', 5, ['drill', 'recip', 'cups', 'bywhole']],
    ['مقارنة الأعداد العشرية وترتيبها', 4, ['sign', 'order', 'extreme']],
    ['جمع الأعداد العشرية وطرحها', 5, ['drill', 'missing', 'word', 'take']],
    ['ضرب الأعداد العشرية وقسمتها', 5, ['drill', 'shift', 'dd', 'kg']],
    ['النسبة المئوية', 6, ['drill', 'pfrac', 'grid', 'pword']],
  ];
  for (const [title, grade, kinds] of CASES) {
    it(`${title} (G${grade})`, () => {
      const seen = new Set<string>();
      const frames = new Set<string>();
      for (const item of draws(title, grade)) {
        const stem = itemStem(item, true);
        const [kind, want] = solve(stem);
        seen.add(kind);
        frames.add(stemFrame(stem));
        if (typeof want === 'number') {
          assert.ok(Number.isFinite(want) && want >= 0, `${stem}: ${want}`);
          assert.ok(near(value(item.answer), want), `${stem}\n  keyed ${item.answer}, is ${want}`);
        } else {
          assert.equal(item.answer, want, stem);
        }
        // The options: the right count, no repeats, none worth the key, nothing odd.
        const sign = ['>', '<', '='].includes(item.answer);
        assert.equal(item.wrongs.length, sign ? 2 : 3, `${stem}: ${item.wrongs.join(' | ')}`);
        const all = [item.answer, ...item.wrongs];
        assert.equal(new Set(all).size, all.length, `${stem}: repeated option ${all.join(' | ')}`);
        if (Number.isFinite(value(item.answer))) {
          const vals = all.map(value);
          assert.ok(vals.every(v => Number.isFinite(v) && v >= 0), `${stem}: ${all.join(' | ')}`);
          assert.equal(new Set(vals.map(v => Math.round(v * 1e9))).size, vals.length, `${stem}: two options are worth the same (${all.join(' | ')})`);
        }
        for (const o of all) {
          assert.doesNotMatch(o, /NaN|undefined|Infinity|-|\/1$|\.\d{5,}/, `${stem}: odd option ${o}`);
        }
        assert.doesNotMatch(stem, /NaN|undefined|-|\b1 (?:دينار|كتاب|قلم)/, stem);
      }
      assert.deepEqual([...seen].sort(), [...kinds].sort(), `kinds drawn for ${title}`);
      assert.ok(frames.size >= 3, `${title}: ${frames.size} frames`);
    });
  }

  it('a counted noun agrees with its number', () => {
    const plural = /(\d+) (دنانير|كتب|بطاقات|زوار|أقلام|أشجار|صفوف|مربعات|علب|بيضات|كعكات|تفاحات|لترات|طلاب|مدارس)(?![\p{L}])/u;
    const accusative = /(\d+) (دينارًا|كتابًا|زائرًا|قلمًا|صفًّا|مربعًا|لترًا|طالبًا)/;
    for (const [title, grade] of [['الجمع', 2], ['الطرح', 4], ['الضرب في 3', 3], ['قسمة الأعداد', 5], ['القسمة على 2', 2], ['قسمة الكسور', 3], ['النسبة المئوية', 6], ['ضرب الكسور', 5]] as const) {
      for (const item of draws(title, grade, 240)) {
        const stem = itemStem(item, true);
        for (const m of stem.matchAll(new RegExp(plural, 'gu'))) {
          const r = Number(m[1]) % 100;
          assert.ok(r >= 3 && r <= 10, `plural after ${m[1]}: ${stem}`);
        }
        for (const m of stem.matchAll(new RegExp(accusative, 'g'))) {
          assert.ok(Number(m[1]) % 100 >= 11, `accusative after ${m[1]}: ${stem}`);
        }
      }
    }
  });

  it('a word problem is served as one, in the word-problem format too', () => {
    const session = new Set<string>();
    let words = 0;
    for (let i = 0; i < 60; i++) {
      const q = takeElementaryMath('word_problem', 'الطرح', null, 2, 'medium', 'ar', 1, session)!;
      if (/بقيت|يزيد/.test(q.text)) {
        words++;
        assert.doesNotMatch(q.text, /اكتب الحل/, 'a real word problem needs no «show your working» wrapper');
      }
    }
    assert.ok(words > 0);
  });
});
