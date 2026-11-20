/**
 * Grade 5 maths lessons whose offline questions did not match their objective
 * (Grade 5 review, 2026-11-20), checked against the Grade 5 student books:
 * - «مقارنة الأعداد وترتيبها» (S1 u1_l2, «ضمن الملايين») compared 4–6-digit numbers;
 *   the book compares 3456210 with 3759120;
 * - «قسمة الأعداد» (u2_l5) asked «؟ ÷ 7 = 4» and «12 ÷ ؟ = 2»: times-table facts;
 *   the book's easiest is 85 ÷ 5;
 * - «الأعداد السالبة» (u1_l4, «أتعرف العدد السالب، وأعينه على خط الأعداد») asked
 *   «10 ___ 9» and «6° ثم ارتفعت 5°» with no negative number, and added integers;
 * - «مقارنة الكسور والأعداد الكسرية», «جمع الكسور», «طرح الكسور» (u4_l2–l4) never
 *   showed a mixed number; the book adds «2 1/2 + 3 1/6»;
 * - «أجزاء الألف» (S2 u6_l1) and «التحويل بين الكسور والأعداد العشرية» (u6_l2)
 *   drew one pool, mostly hundredths, so each asked the other's questions;
 * - «ضرب الأعداد العشرية وقسمتها» (u6_l7) multiplies and divides by 10, 100, 1000;
 *   it asked «9.1 × 0.6» and «9.6 ÷ 0.8»;
 * - «الزمن» (u9_l3, «توقيت 24 ساعة») never asked the 24-hour clock, a.m./p.m. or
 *   hours as days.
 * Every answer is recomputed from the numbers printed in its own stem, by code
 * that shares nothing with the generators.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { TOPICS, makeTopicItem, topicFor } from '../topics.ts';
import { makeElementaryItem } from '../elementary.ts';
import { itemStem, type ConcreteItem, type DiffTier } from '../index.ts';

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
/** A lesson's items as a paper draws them: the lesson's own generator, or the elementary ops for its title. */
function lesson(title: string, n = 300): Array<{ item: ConcreteItem; stem: string }> {
  const gen = topicFor(title, 5);
  return Array.from({ length: n }, (_, i) => {
    const rng = seeded(i * 7919 + 101);
    const item = gen ? makeTopicItem(gen, 5, TIERS[i % 3]!, new Set(), rng) : makeElementaryItem(title, 5, TIERS[i % 3]!, new Set(), rng);
    return { item, stem: itemStem(item, true) };
  });
}
const ints = (s: string) => (s.match(/\d+/g) ?? []).map(Number);
const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
/** «−7» / «7» → number. */
const signedNum = (s: string) => Number(s.trim().replace('−', '-'));
/** A mixed number, a fraction or a whole, as a value: «2 1/3», «5/6», «4». */
function value(s: string): number {
  const t = s.trim();
  let m = t.match(/^(\d+) (\d+)\/(\d+)$/);
  if (m) return Number(m[1]) + Number(m[2]) / Number(m[3]);
  m = t.match(/^(\d+)\/(\d+)$/);
  if (m) return Number(m[1]) / Number(m[2]);
  assert.match(t, /^\d+$/, `not a number: «${s}»`);
  return Number(t);
}
/** In simplest form, as the book writes a result: a proper, reduced fraction part. */
function simplest(s: string): boolean {
  const m = s.trim().match(/^(?:(\d+) )?(\d+)\/(\d+)$/);
  if (!m) return /^\d+$/.test(s.trim());
  const [r, d] = [Number(m[2]), Number(m[3])];
  return r < d && gcd(r, d) === 1;
}
const MIXED = /(?<![\d/])\d+ \d+\/\d+/g;
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

describe('Grade 5: each maths lesson asks about its own objective', () => {
  it('«مقارنة الأعداد وترتيبها» compares numbers within millions', () => {
    let digitsKind = 0;
    for (const { item, stem } of lesson('مُقارَنَةُ الأَعْدادِ وَتَرْتيبُها')) {
      if (stem.includes('يمكن تكوينه من الأرقام')) {
        digitsKind++;
        const ds = ints(stem.split(':')[0]!.split('الأرقام')[1]!);
        assert.equal(ds.length, 7, `seven digits make a number in the millions: ${stem}`);
        const want = [...ds].sort((x, y) => (stem.includes('أكبر') ? y - x : x - y)).join('');
        assert.equal(item.answer, want, stem);
        continue;
      }
      for (const n of ints(stem)) assert.ok(n >= 1_000_000, `«${n}» is not within the millions: ${stem}`);
    }
    assert.ok(digitsKind > 10, `the greatest/least-number kind was drawn ${digitsKind} times`);
  });

  it('«قسمة الأعداد» divides past the times tables', () => {
    for (const { item, stem } of lesson('قِسْمَةُ الأَعْدادِ')) {
      if (stem.includes('أقل عدد من العلب')) continue; // what a remainder means
      let m = stem.match(/(\d+) ÷ ؟ = (\d+)/);
      if (m) { assert.ok(Number(m[2]) >= 11, stem); assert.equal(Number(item.answer), Number(m[1]) / Number(m[2]), stem); continue; }
      m = stem.match(/؟ ÷ (\d+) = (\d+)/);
      if (m) { assert.ok(Number(m[2]) >= 11, stem); assert.equal(Number(item.answer), Number(m[1]) * Number(m[2]), stem); continue; }
      const q = Number(item.answer);
      assert.ok(q >= 11, `a quotient inside the times tables: ${stem} → ${item.answer}`);
    }
  });

  it('«الأعداد السالبة» is about negative numbers, and adds none', () => {
    const kinds = new Set<string>();
    for (const { item, stem } of lesson('الأَعْدادُ السّالِبَةُ')) {
      assert.ok(/−\d/.test(stem + ' ' + item.answer), `no negative number: ${stem} → ${item.answer}`);
      assert.doesNotMatch(stem, /ارتفعت|انخفضت/, `integer addition is Grade 6: ${stem}`);
      let m: RegExpMatchArray | null;
      if ((m = stem.match(/(?:عمق|تحت الصفر).*?(\d+)|(\d+)°? تحت الصفر/))) {
        kinds.add('situation');
        const a = Number(m[1] ?? m[2]);
        assert.equal(signedNum(item.answer), -a, stem);
      } else if (stem.includes('إلى يسار الصفر')) {
        kinds.add('left of zero');
        assert.equal(signedNum(item.answer), -ints(stem)[0]!, stem);
      } else if ((m = stem.match(/يقع العدد (−?\d+)/))) {
        kinds.add('other side');
        assert.equal(signedNum(item.answer), -signedNum(m[1]!), stem);
      } else if (stem.includes('عدد سالب')) {
        kinds.add('which is negative');
        assert.ok(signedNum(item.answer) < 0, stem);
        for (const w of item.wrongs) assert.ok(signedNum(w) >= 0, `a second negative option: ${w}`);
      } else {
        kinds.add('compare');
        m = stem.match(/(−?\d+) ___ (−?\d+)/)!;
        assert.ok(m, stem);
        const [a, b] = [signedNum(m[1]!), signedNum(m[2]!)];
        assert.equal(item.answer, a > b ? '>' : a < b ? '<' : '=', stem);
      }
    }
    assert.deepEqual([...kinds].sort(), ['compare', 'left of zero', 'other side', 'situation', 'which is negative']);
  });

  for (const [title, op] of [['جَمْعُ الكُسورِ', '+'], ['طَرْحُ الكُسورِ', '−']] as const) {
    it(`«${title}» adds and subtracts mixed numbers too, answered in simplest form`, () => {
      let mixedSeen = 0;
      for (const { item, stem } of lesson(title)) {
        const ms = stem.match(MIXED);
        if (!ms) continue;
        mixedSeen++;
        assert.equal(ms.length, 2, stem);
        const [a, b] = [value(ms[0]!), value(ms[1]!)];
        assert.ok(near(value(item.answer), op === '+' ? a + b : a - b), `${stem} → ${item.answer}`);
        assert.ok(simplest(item.answer), `not in simplest form: ${item.answer}`);
        for (const w of item.wrongs) assert.ok(!near(value(w), value(item.answer)), `a wrong option equals the key: ${w}`);
      }
      assert.ok(mixedSeen >= 60, `${mixedSeen} of 300 questions had a mixed number`);
    });
  }

  it('«مقارنة الكسور والأعداد الكسرية وترتيبها» compares mixed numbers too', () => {
    let mixedSeen = 0;
    for (const { item, stem } of lesson('مُقارَنَةُ الكُسورِ وَالأَعْدادِ الكَسْرِيَّةِ وَتَرْتيبُها')) {
      if (!MIXED.test(stem)) continue;
      MIXED.lastIndex = 0;
      mixedSeen++;
      const m = stem.match(/([\d /]+?) ___ ([\d /]+)$/m);
      if (m) {
        const [a, b] = [value(m[1]!), value(m[2]!)];
        assert.equal(item.answer, a > b ? '>' : a < b ? '<' : '=', stem);
        continue;
      }
      const list = stem.split(':').pop()!.replace('؟', '').split('،').map(s => s.trim());
      const vals = list.map(value);
      if (stem.includes('رتّب')) {
        const asc = stem.includes('تصاعديًّا');
        const want = list.map((s, i) => [s, vals[i]!] as const).sort((x, y) => (asc ? x[1] - y[1] : y[1] - x[1])).map(x => x[0]).join('، ');
        assert.equal(item.answer, want, stem);
      } else {
        const want = stem.includes('الأكبر') ? Math.max(...vals) : Math.min(...vals);
        assert.ok(near(value(item.answer), want), stem);
      }
    }
    assert.ok(mixedSeen >= 60, `${mixedSeen} of 300 questions had a mixed number`);
  });

  it('«أجزاء الألف» is place value to thousandths; «التحويل…» converts', () => {
    assert.equal(topicFor('أَجْزاءُ الأَلْفِ', 5)?.id, 'thousandths_g5');
    assert.equal(topicFor('التَّحْويلُ بَيْنَ الكُسورِ وَالأَعْدادِ الْعَشْرِيَّةِ', 5)?.id, 'frac_dec');
    // Grade 4's tenths and hundredths lessons keep their pool
    assert.equal(topicFor('أَجْزاءُ المِئَةِ', 4)?.id, 'frac_dec');
    const kinds = new Set<string>();
    for (const { item, stem } of lesson('أَجْزاءُ الأَلْفِ')) {
      assert.doesNotMatch(stem, /على صورة/, `a conversion is the next lesson's: ${stem}`);
      assert.ok(/\d\.\d{3}(?!\d)/.test(stem + ' ' + item.answer), `no thousandths: ${stem} → ${item.answer}`);
      let m: RegExpMatchArray | null;
      if ((m = stem.match(/القيمة المنزلية للرقم (\d) في العدد (\d+)\.(\d{3})/))) {
        kinds.add('place value');
        const pos = m[3]!.indexOf(m[1]!) + 1;
        assert.equal(Number(item.answer), Number(m[1]) / 10 ** pos, stem);
      } else if ((m = stem.match(/ما الرقم في منزلة (الأجزاء من عشرة|الأجزاء من مئة|الأجزاء من ألف) في العدد \d+\.(\d{3})/))) {
        kinds.add('digit');
        const pos = ['الأجزاء من عشرة', 'الأجزاء من مئة', 'الأجزاء من ألف'].indexOf(m[1]!);
        assert.equal(item.answer, m[2]![pos], stem);
      } else if (stem.includes('بالصيغة القياسية') && stem.includes('+')) {
        kinds.add('expanded → standard');
        const terms = stem.split(':')[1]!.split('+').map(Number);
        assert.ok(near(Number(item.answer), terms.reduce((s, x) => s + x, 0)), stem);
      } else if (stem.includes('بالصيغة التحليلية')) {
        kinds.add('standard → expanded');
        const n = Number(stem.match(/العدد (\d+\.\d+)/)![1]);
        assert.ok(near(item.answer.split('+').map(Number).reduce((s, x) => s + x, 0), n), stem);
        for (const w of item.wrongs) assert.ok(!near(w.split('+').map(Number).reduce((s, x) => s + x, 0), n), `a wrong option adds up to the number: ${w}`);
      } else if ((m = stem.match(/(\d+) جزءًا من ألف/))) {
        kinds.add('thousandths');
        assert.ok(near(Number(item.answer), Number(m[1]) / 1000), stem);
      } else assert.fail(`unknown stem: ${stem}`);
    }
    assert.deepEqual([...kinds].sort(), ['digit', 'expanded → standard', 'place value', 'standard → expanded', 'thousandths']);
    const conv = new Set<string>();
    for (const { item, stem } of lesson('التَّحْويلُ بَيْنَ الكُسورِ وَالأَعْدادِ الْعَشْرِيَّةِ')) {
      assert.match(stem, /على صورة/, `not a conversion: ${stem}`);
      let m: RegExpMatchArray | null;
      if ((m = stem.match(/الكسر (\d+)\/(\d+) على صورة عدد عشري، نكتبه كسرًا مكافئًا مقامه (\d+)/))) {
        conv.add('equivalent');
        assert.ok(near(Number(item.answer) / Number(m[3]), Number(m[1]) / Number(m[2])), stem);
      } else if ((m = stem.match(/العدد الكسري (\d+ \d+\/\d+) على صورة عدد عشري/))) {
        conv.add('mixed → decimal');
        assert.ok(near(Number(item.answer), value(m[1]!)), stem);
      } else if ((m = stem.match(/العدد العشري (\d+\.\d+) على صورة عدد كسري/))) {
        conv.add('decimal → mixed');
        assert.ok(near(value(item.answer), Number(m[1])) && simplest(item.answer), stem);
      } else conv.add('fraction ↔ decimal');
    }
    assert.equal(conv.size, 4, `conversion kinds drawn: ${[...conv]}`);
  });

  it('«ضرب الأعداد العشرية وقسمتها» multiplies and divides by 10, 100, 1000 only', () => {
    const kinds = new Set<string>();
    for (const { item, stem } of lesson('ضَرْبُ الأَعْدادِ الْعَشْرِيَّةِ وَقِسْمَتُها')) {
      const a = Number(item.answer);
      let m: RegExpMatchArray | null;
      if ((m = stem.match(/اضرب العدد (\d+(?:\.\d+)?) في (10|100|1000)\./))) {
        kinds.add('×'); assert.ok(near(a, Number(m[1]) * Number(m[2])), stem);
      } else if ((m = stem.match(/اقسم العدد (\d+(?:\.\d+)?) على (10|100|1000)\./))) {
        kinds.add('÷'); assert.ok(near(a, Number(m[1]) / Number(m[2])), stem);
      } else if ((m = stem.match(/(\d+\.\d+) × ؟ = (\d+(?:\.\d+)?)/))) {
        kinds.add('missing ×'); assert.ok([10, 100, 1000].includes(a) && near(Number(m[1]) * a, Number(m[2])), stem);
      } else if ((m = stem.match(/(\d+(?:\.\d+)?) ÷ ؟ = (\d+\.\d+)/))) {
        kinds.add('missing ÷'); assert.ok([10, 100, 1000].includes(a) && near(Number(m[1]) / a, Number(m[2])), stem);
      } else if ((m = stem.match(/الواحد (\d+\.\d+) دينار.*?ثمن (10|100|1000) /))) {
        kinds.add('price of many'); assert.ok(near(a, Number(m[1]) * Number(m[2])), stem);
      } else if ((m = stem.match(/ثمن (10|100|1000) \S+ (\d+(?:\.\d+)?) (\S+)\./))) {
        kinds.add('price of one'); assert.ok(near(a, Number(m[2]) / Number(m[1])), stem);
        // after a decimal the noun is «دينار»; after a whole number it agrees with the last two digits
        const r = Number(m[2]) % 100;
        const want = m[2]!.includes('.') || (Number(m[2]) >= 100 && r <= 2) ? 'دينار' : r >= 3 && r <= 10 ? 'دنانير' : 'دينارًا';
        assert.equal(m[3], want, `«${m[2]} ${m[3]}»: the noun does not agree`);
      } else assert.fail(`not ×/÷ by 10, 100, 1000: ${stem}`);
    }
    assert.deepEqual([...kinds].sort(), ['missing ×', 'missing ÷', 'price of many', 'price of one', '×', '÷']);
  });

  it('«الزمن» asks the 24-hour clock, a.m./p.m. and hours as days', () => {
    const kinds = new Set<string>();
    const mins = (h: number, m: number, ap: string) => ((h % 12) + (ap === 'p.m.' ? 12 : 0)) * 60 + m;
    for (const { item, stem } of lesson('الزَّمَنُ')) {
      let m: RegExpMatchArray | null;
      if ((m = stem.match(/حوّل الوقت (\d+):(\d\d) (a\.m\.|p\.m\.) إلى التوقيت 24 ساعةً/))) {
        kinds.add('to 24');
        const t = mins(Number(m[1]), Number(m[2]), m[3]!);
        assert.equal(item.answer, `${String(Math.floor(t / 60)).padStart(2, '0')}:${m[2]}`, stem);
      } else if ((m = stem.match(/الساعة (\d\d):(\d\d) بالتوقيت 24 ساعةً/))) {
        kinds.add('from 24');
        const H = Number(m[1]);
        assert.equal(item.answer, `${H % 12 === 0 ? 12 : H % 12}:${m[2]} ${H < 12 ? 'a.m.' : 'p.m.'}`, stem);
      } else if ((m = stem.match(/الساعة (\d+):(\d\d) (a\.m\.|p\.m\.).*الساعة (\d+):(\d\d) (a\.m\.|p\.m\.)/))) {
        kinds.add('across noon or midnight');
        const d = (mins(Number(m[4]), Number(m[5]), m[6]!) - mins(Number(m[1]), Number(m[2]), m[3]!) + 1440) % 1440;
        assert.notEqual(m[3], m[6], `the interval crosses noon or midnight: ${stem}`);
        assert.equal(Number(item.answer), d, stem);
      } else if ((m = stem.match(/حوّل (\d+) (ساعات|ساعةً|ساعة) إلى أيام وساعات/))) {
        const r = Number(m[1]) % 100;
        assert.equal(m[2], r >= 3 && r <= 10 ? 'ساعات' : Number(m[1]) >= 100 && r <= 2 ? 'ساعة' : 'ساعةً', `«${m[1]} ${m[2]}»: the noun does not agree`);
        kinds.add('hours as days');
        const n = Number(m[1]);
        const a = item.answer.match(/^(?:(\d+) (?:أيام|يومًا)|(يوم واحد)|(يومان)) و (?:(\d+) (?:ساعات|ساعةً)|(ساعة واحدة)|(ساعتان))$/);
        assert.ok(a, `answer not read: «${item.answer}»`);
        const days = a[1] ? Number(a[1]) : a[2] ? 1 : 2;
        const hrs = a[4] ? Number(a[4]) : a[5] ? 1 : 2;
        assert.equal(days * 24 + hrs, n, stem);
        if (a[1]) assert.equal(a[0]!.includes('أيام'), days <= 10, `«${item.answer}»: the noun does not agree`);
        if (a[4]) assert.equal(a[0]!.includes('ساعات'), hrs <= 10, `«${item.answer}»: the noun does not agree`);
      } else kinds.add('minutes'); // the Grade 4 kinds, already recomputed in geometry.test.ts
    }
    for (const k of ['to 24', 'from 24', 'across noon or midnight', 'hours as days']) assert.ok(kinds.has(k), `never drawn: ${k}`);
  });

  it('Grade 4 «الزمن» is unchanged: no 24-hour clock', () => {
    const gen = topicFor('الزَّمَنُ', 4)!;
    for (let i = 0; i < 200; i++) {
      const item = makeTopicItem(gen, 4, TIERS[i % 3]!, new Set(), seeded(i + 7));
      assert.doesNotMatch(itemStem(item, true), /24 ساعةً|a\.m\.|p\.m\./);
    }
  });
});

void TOPICS;
