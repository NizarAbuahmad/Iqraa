/**
 * A family can hold several of the book's lessons, and a worksheet must study
 * its own lesson.
 *
 * `trig_apps` holds «قانون الجيوب», «قانون جيب التمام» and the triangle-area
 * lesson; a «قانون الجيوب» worksheet opened with a worked example on the law of
 * cosines (2026-11-13), which that class has not been taught yet. Each item in
 * such a family names its lesson (`focus`), the worked example is taken only
 * from the lesson's own items, and practice takes the lesson's own items first.
 *
 * Also here: one equation is one question however it is asked
 * (`9^x = 27` came twice on one paper, once «هل x = 2 حل…» and once «أوجد
 * الحل»), and printed working spends what it states («81 = 3^4» in a
 * half-solved question, then «اكتب العدد 81 على صورة قوة أساسها 3»).
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  MATH_BANK, itemSpent, lessonFocus, markShown, spendItem, takeConcreteMath, takeSolvedMath,
} from '../index.ts';
import { stepsFor } from '../steps.ts';
import { CHEM_BANK } from '../chemistry.ts';
import { SPLIT_FAMILIES } from '../lessonFocus.ts';

const item = (id: string) => MATH_BANK.find(i => i.id === id)!;

describe('lessonFocus', () => {
  it('tells the three trig_apps lessons apart', () => {
    assert.deepEqual(lessonFocus('قانون الجيوب', null), ['sine_rule']);
    assert.deepEqual(lessonFocus('قانون جيب التمام', null), ['cosine_rule']);
    assert.equal(lessonFocus('المعادلات الأسية', null), null, 'a one-lesson family has no focus');
  });

  it('every item of a split family names a lesson, and every lesson has an item', () => {
    for (const fam of SPLIT_FAMILIES) {
      const items = MATH_BANK.filter(i => i.family === fam);
      assert.ok(items.every(i => i.focus), `${fam}: an item without a focus`);
    }
    for (const title of ['قانون الجيوب', 'قانون جيب التمام', 'الأقواس والقطاعات', 'معادلة الدائرة',
      'النسب المثلثية', 'حل المعادلات المثلثية', 'تركيب الاقترانات', 'الاقتران العكسي',
      'المتجهات في المستوى', 'جمع المتجهات وطرحها', 'الضرب القياسي', 'احتمالات الحوادث المستقلة']) {
      const focus = lessonFocus(title, null);
      assert.ok(focus, `${title}: no focus`);
      assert.ok(MATH_BANK.some(i => i.focus && focus.includes(i.focus)), `${title}: no item for its focus`);
    }
  });
});

for (const [title, focus, story] of [
  ['قانون الجيوب', 'sine_rule', /نهر/],
  ['قانون جيب التمام', 'cosine_rule', /سفينت|بحيرة/],
] as const) {
  describe(`«${title}» has a lesson's worth of items`, () => {
    const own = () => MATH_BANK.filter(i => i.focus === focus);

    it('enough for an eight-question worksheet, in every tier, with a story', () => {
      assert.ok(own().length >= 7, `${own().length} items`);
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        assert.ok(own().some(i => i.diff === tier), `no ${tier} item`);
      }
      assert.ok(own().some(i => i.story && story.test(i.wordAr ?? '')), 'no real-life story of its own');
    });

    it('every one has checked working, so any can be the worked example', () => {
      for (const i of own()) assert.ok(stepsFor(i.id), `${i.id} has no working`);
    });

    it('asks both ways the lesson does: a side, and an angle', () => {
      assert.ok(own().some(i => /°$/.test(i.answer)), 'no item asks for an angle');
      assert.ok(own().some(i => !/°$/.test(i.answer)), 'no item asks for a side');
    });

    it('studies only its own law', () => {
      for (const tier of ['easy', 'medium', 'hard'] as const) {
        for (let k = 0; k < 20; k++) {
          const s = takeSolvedMath(title, null, tier, 'ar', new Set());
          assert.ok(s, 'the lesson has a solved item');
          assert.equal(item(s.id).focus, focus, `got ${s.id}: ${s.problem}`);
        }
      }
    });

    it('its word problem is its own story', () => {
      const q = takeConcreteMath('word_problem', title, null, 'medium', 'ar', 6, new Set(), false)!;
      assert.equal(q.story, true, q.text);
      assert.match(q.text, story);
    });
  });
}

describe('the worked example is the lesson\'s own', () => {
  it('a «قانون الجيوب» worksheet never studies the law of cosines or the area formula', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let k = 0; k < 20; k++) {
        const s = takeSolvedMath('قانون الجيوب', null, tier, 'ar', new Set());
        assert.ok(s, 'the law of sines has a solved item');
        assert.equal(item(s.id).focus, 'sine_rule', `got ${s.id}: ${s.problem}`);
      }
    }
  });

  it('runs out rather than leave the lesson', () => {
    // «المتجهات في المستوى» has two solved items of its own: two worked examples, then none.
    const session = new Set<string>();
    assert.ok(takeSolvedMath('المتجهات في المستوى', null, 'medium', 'ar', session));
    assert.ok(takeSolvedMath('المتجهات في المستوى', null, 'medium', 'ar', session));
    assert.equal(takeSolvedMath('المتجهات في المستوى', null, 'medium', 'ar', session), null);
  });

  it('practice takes the lesson\'s own items first, within the tier asked', () => {
    for (let k = 0; k < 20; k++) {
      // Medium holds v-m1 (adding vectors) and v-m2 (dot product): the lesson's own wins.
      // Typed topics, as the API's evaluation generator passes an objective's
      // wording: the book's own titles now have generators (`grade10.ts`,
      // `grade10b.ts`), which come before the bank for practice.
      const q = takeConcreteMath('short_answer', 'إيجاد الضرب القياسي لمتجهين', null, 'medium', 'ar', 4, new Set(), false)!;
      const ownStems = MATH_BANK.filter(i => i.focus === 'dot_product').map(i => i.promptAr!);
      assert.ok(ownStems.some(stem => q.text.startsWith(stem)), q.text);
      const arc = takeConcreteMath('short_answer', 'حساب أطوال الأقواس', null, 'medium', 'ar', 4, new Set(), false)!;
      assert.match(arc.text, /قطاع|قوس/, arc.text);
    }
  });

  it('a lesson with items of its own takes one from another tier before the next lesson\'s', () => {
    // Trigonometric equations have no easy item; an easy slot still takes the
    // lesson's own (t-m1, t-h1) before the family's easy ones, which belong to
    // «النسب المثلثية». A typed topic: the book's own title has a generator.
    // (Only a lesson with a single bank item keeps it to its own tier —
    // `takeFromBank` — and since every split lesson got items of its own, none has.)
    for (let k = 0; k < 20; k++) {
      const q = takeConcreteMath('short_answer', 'المعادلات المثلثية البسيطة', null, 'easy', 'ar', 4, new Set(), false)!;
      assert.match(q.text, /θ/, q.text);
    }
  });
});

describe('«الاقتران العكسي» has a lesson\'s worth of items, every key checked', () => {
  const own = () => MATH_BANK.filter(i => i.focus === 'inverse');
  // Each item's f, and where to test it. A formula answer («f⁻¹(x) = …») is read
  // as printed and must undo f there; a value answer must be the x that f sends
  // to the value asked for.
  const F: Record<string, { f: (x: number) => number; xs: number[]; at?: number }> = {
    'f-m2': { f: x => 2 * x - 6, xs: [-3, 0, 2.5, 7] },
    'if-e1': { f: x => x + 5, xs: [-4, 0, 3] },
    'if-e2': { f: x => 3 * x, xs: [-2, 0, 5] },
    'if-m1': { f: x => (x - 1) / 4, xs: [-3, 1, 9] },
    'if-m2': { f: x => 5 - 2 * x, xs: [-1, 0, 4] },
    'if-m3': { f: x => 2 * x + 1, xs: [], at: 7 },
    'if-h1': { f: x => x ** 3 + 2, xs: [-2, 0, 1.5, 3] },
    'if-h2': { f: x => x * x + 1, xs: [0, 0.5, 2, 6] },
    'if-w1': { f: d => 0.5 * d + 2, xs: [], at: 7 },
  };
  /** The printed formula after «=», as a function of x: «(5 − x)/2», «∛(x − 2)», «√(x − 1)، x ≥ 1». */
  const formula = (answer: string) => {
    const rhs = answer.split('=')[1]!.split('،')[0]!.trim()
      .replace(/−/g, '-').replace(/∛/g, 'Math.cbrt').replace(/√/g, 'Math.sqrt')
      .replace(/(\d)(x|\()/g, '$1*$2');
    return new Function('x', `return ${rhs};`) as (x: number) => number;
  };
  const value = (answer: string) => Number(answer.split('=').pop()!.replace(/[^0-9.]/g, ''));

  it('lists every item of the lesson', () => {
    assert.deepEqual(own().map(i => i.id).sort(), Object.keys(F).sort());
  });

  it('every key undoes its function', () => {
    for (const [id, { f, xs, at }] of Object.entries(F)) {
      const answer = item(id).answer;
      if (at !== undefined) {
        assert.ok(Math.abs(f(value(answer)) - at) < 1e-9, `${id}: f(${value(answer)}) is not ${at}`);
        continue;
      }
      const inv = formula(answer);
      for (const x of xs) {
        assert.ok(Math.abs(inv(f(x)) - x) < 1e-9, `${id}: «${answer}» does not undo f at x = ${x}`);
      }
    }
  });

  it('enough for a worksheet, in every tier, with a story, every one with working', () => {
    assert.ok(own().length >= 8, `${own().length} items`);
    for (const tier of ['easy', 'medium', 'hard'] as const) assert.ok(own().some(i => i.diff === tier), `no ${tier} item`);
    assert.ok(own().some(i => i.story), 'no real-life story');
    for (const i of own()) assert.ok(stepsFor(i.id), `${i.id} has no working`);
  });

  it('studies only its own lesson', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let k = 0; k < 20; k++) {
        const s = takeSolvedMath('الاقتران العكسي', null, tier, 'ar', new Set());
        assert.ok(s);
        assert.equal(item(s.id).focus, 'inverse', `got ${s.id}: ${s.problem}`);
      }
    }
  });
});

describe('«جمع المتجهات وطرحها» has a lesson\'s worth of items, every key recomputed', () => {
  type V = [number, number];
  const add = (a: V, b: V): V => [a[0] + b[0], a[1] + b[1]];
  const scale = (k: number, a: V): V => [k * a[0], k * a[1]];
  const len = (a: V) => Math.hypot(a[0], a[1]);
  // Each item's vectors and what it asks, computed here from the numbers in its stem.
  const KEYS: Record<string, V | number> = {
    'v-m1': add([1, 2], [3, -1]),
    'va-e1': add([2, 5], [4, 1]),
    'va-e2': add([7, 3], scale(-1, [2, 5])),
    'va-m1': add(scale(2, [1, -2]), [3, 4]),
    'va-m2': add(scale(3, [2, 1]), scale(-2, [1, -3])),
    'va-m3': len(add([1, 2], [2, 2])),
    'va-h1': add([-2, 4], scale(-1, [3, -1])),
    // AB⃗ + BC⃗ for A(0,1), B(2,5), C(6,4).
    'va-h2': add(add([2, 5], scale(-1, [0, 1])), add([6, 4], scale(-1, [2, 5]))),
    'va-w1': len(add([0, 4], [3, 0])),
    'va-e3': add([-3, 2], [5, -6]),
    'va-e4': scale(-1, [4, -1]),
    'va-m4': add([5, 2], scale(-3, [1, -1])),
    // k with ⟨1, 4⟩ + k⟨3, −2⟩ = ⟨7, 0⟩, from the first component; the second must agree.
    'va-m5': (() => { const k = (7 - 1) / 3; assert.equal(4 + k * -2, 0, 'va-m5 has no single k'); return k; })(),
    'va-m6': len(add([7, 2], scale(-1, [2, -10]))),
    // The fourth vertex C of parallelogram ABCD: A + AB⃗ + AD⃗, for A(1,1), B(5,2), D(2,4).
    'va-h3': add([1, 1], add(add([5, 2], scale(-1, [1, 1])), add([2, 4], scale(-1, [1, 1])))),
    'va-w2': len(add([9, 4], [-3, 4])),
  };
  const own = () => MATH_BANK.filter(i => i.focus === 'vector_add');
  /** «⟨5, −2⟩» as [5, -2], or the number after «=». */
  const stated = (answer: string): V | number => {
    const m = /⟨\s*([−-]?\d+)\s*[,،]\s*([−-]?\d+)\s*⟩/.exec(answer);
    if (m) return [Number(m[1]!.replace('−', '-')), Number(m[2]!.replace('−', '-'))];
    const pt = /\(\s*([−-]?\d+)\s*[,،]\s*([−-]?\d+)\s*\)/.exec(answer);
    if (pt) return [Number(pt[1]!.replace('−', '-')), Number(pt[2]!.replace('−', '-'))];
    return Number(answer.split('=').pop()!.replace(/[^0-9.]/g, ''));
  };

  it('lists every item of the lesson', () => {
    assert.deepEqual(own().map(i => i.id).sort(), Object.keys(KEYS).sort());
  });

  it('every key is the vectors\' own sum, difference or length', () => {
    for (const [id, want] of Object.entries(KEYS)) {
      assert.deepEqual(stated(item(id).answer), want, `${id}: key «${item(id).answer}»`);
    }
  });

  it('enough for a worksheet, in every tier, with a story, every one with working', () => {
    assert.ok(own().length >= 8, `${own().length} items`);
    for (const tier of ['easy', 'medium', 'hard'] as const) assert.ok(own().some(i => i.diff === tier), `no ${tier} item`);
    assert.ok(own().some(i => i.story), 'no real-life story');
    for (const i of own()) assert.ok(stepsFor(i.id), `${i.id} has no working`);
  });

  it('has more than one story, and asks for a scalar and a point as well as a vector', () => {
    assert.ok(own().filter(i => i.story).length >= 2, 'one story');
    assert.ok(own().some(i => /^k\s*=/.test(i.answer)), 'no item solves for a scalar');
    assert.ok(own().some(i => /\(\s*[−-]?\d+\s*,/.test(i.answer)), 'no item asks for a point');
  });

  it('studies only its own lesson', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let k = 0; k < 20; k++) {
        const s = takeSolvedMath('جمع المتجهات وطرحها', null, tier, 'ar', new Set());
        assert.ok(s);
        assert.equal(item(s.id).focus, 'vector_add', `got ${s.id}: ${s.problem}`);
      }
    }
  });
});

describe('«الضرب القياسي» has a lesson\'s worth of items, every key recomputed', () => {
  type V = [number, number];
  const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1];
  const angle = (a: V, b: V) => (Math.acos(dot(a, b) / (Math.hypot(...a) * Math.hypot(...b))) * 180) / Math.PI;
  const r3 = Math.sqrt(3);
  // Each item's vectors and what it asks; a «yes» key must come with a zero dot product.
  const KEYS: Record<string, number | 'perpendicular'> = {
    'v-m2': dot([2, 3], [4, -1]),
    'v-h1': 'perpendicular',
    'dp-e1': dot([3, 1], [2, 5]),
    'dp-e2': dot([4, -2], [1, 3]),
    'dp-m1': dot([3, 4], [3, 4]),
    // k with ⟨k, 2⟩ · ⟨3, −6⟩ = 0: 3k − 12 = 0.
    'dp-m2': 12 / 3,
    'dp-m3': angle([1, 1], [2, 0]),
    'dp-h1': angle([2, 0], [-1, r3]),
    // A(1,1), B(4,2), C(0,4): AB⃗ = ⟨3, 1⟩, AC⃗ = ⟨−1, 3⟩.
    'dp-h2': dot([3, 1], [-1, 3]) === 0 ? 'perpendicular' : -1,
    // Work W = F · d for F = ⟨10, 5⟩ N and d = ⟨6, 0⟩ m.
    'dp-w1': dot([10, 5], [6, 0]),
  };
  const own = () => MATH_BANK.filter(i => i.focus === 'dot_product');
  /** The signed number after the last «=»: «u·v = −2», «θ = 45°», «الشغل = 60 جول». */
  const stated = (answer: string) => Number(answer.split('=').pop()!.replace(/−/g, '-').replace(/[^0-9.-]/g, ''));

  it('lists every item of the lesson', () => {
    assert.deepEqual(own().map(i => i.id).sort(), Object.keys(KEYS).sort());
  });

  it('every key is the vectors\' own dot product, angle or scalar', () => {
    assert.equal(dot([1, 0], [0, 1]), 0);
    for (const [id, want] of Object.entries(KEYS)) {
      const answer = item(id).answer;
      if (want === 'perpendicular') {
        assert.match(answer, /متعامد|نعم/, `${id}: «${answer}» should say perpendicular`);
        continue;
      }
      assert.ok(Math.abs(stated(answer) - want) < 1e-9, `${id}: key «${answer}», the vectors give ${want}`);
    }
  });

  it('enough for a worksheet, in every tier, with a story, every one with working', () => {
    assert.ok(own().length >= 8, `${own().length} items`);
    for (const tier of ['easy', 'medium', 'hard'] as const) assert.ok(own().some(i => i.diff === tier), `no ${tier} item`);
    assert.ok(own().some(i => i.story), 'no real-life story');
    for (const i of own()) assert.ok(stepsFor(i.id), `${i.id} has no working`);
  });

  it('asks for an angle and for perpendicularity, not only a number', () => {
    assert.ok(own().some(i => /°$/.test(i.answer)), 'no angle');
    assert.ok(own().filter(i => KEYS[i.id] === 'perpendicular').length >= 2, 'perpendicularity asked once');
  });

  it('studies only its own lesson', () => {
    for (const tier of ['easy', 'medium', 'hard'] as const) {
      for (let k = 0; k < 20; k++) {
        const s = takeSolvedMath('الضرب القياسي', null, tier, 'ar', new Set());
        assert.ok(s);
        assert.equal(item(s.id).focus, 'dot_product', `got ${s.id}: ${s.problem}`);
      }
    }
  });
});

describe('every law-of-cosines key, recomputed from its triangle', () => {
  // [id, what is asked, two sides and the angle between them | three sides].
  // An angle item asks the angle facing the third side.
  const SIDE = 'side', ANGLE = 'angle';
  const TRIANGLES: Array<[string, typeof SIDE | typeof ANGLE, number, number, number]> = [
    ['ta-m1', SIDE, 7, 7, 60],
    ['lc-e1', SIDE, 3, 5, 60],
    ['lc-e2', SIDE, 6, 8, 90],
    ['lc-e3', SIDE, 4, 4, 60],
    ['lc-e4', SIDE, 9, 12, 90],
    ['lc-m1', SIDE, 3, 5, 120],
    ['lc-m2', ANGLE, 3, 8, 7],
    ['lc-m3', ANGLE, 5, 12, 13],
    ['lc-m4', SIDE, 5, 16, 120],
    ['lc-m5', ANGLE, 8, 15, 13],
    ['lc-m6', ANGLE, 5, 5, 5 * Math.sqrt(3)],
    ['lc-h1', ANGLE, 7, 8, 13],
    ['lc-h2', SIDE, 6, 10, 120],
    ['lc-w1', SIDE, 5, 8, 60],
    ['lc-w2', SIDE, 80, 150, 60],
  ];
  const rad = (d: number) => (d * Math.PI) / 180;
  /** The number an answer states: «c = 5√3», «C = 60°», «المسافة = 130 م». */
  const stated = (answer: string): number => {
    const rhs = answer.split('=').pop()!.replace(/[^0-9.√]/g, '');
    const m = /^(\d*(?:\.\d+)?)√(\d+)$/.exec(rhs);
    return m ? (m[1] ? Number(m[1]) : 1) * Math.sqrt(Number(m[2])) : Number(rhs);
  };
  const sides = (kind: string, x: number, y: number, z: number) =>
    (kind === SIDE ? [x, y, Math.sqrt(x * x + y * y - 2 * x * y * Math.cos(rad(z)))] : [x, y, z]).sort((p, q) => p - q);

  it('lists every item of the lesson', () => {
    const own = MATH_BANK.filter(i => i.focus === 'cosine_rule').map(i => i.id).sort();
    assert.deepEqual(own, TRIANGLES.map(t => t[0]).sort());
  });

  it('every key is the triangle\'s own side or angle', () => {
    for (const [id, kind, x, y, z] of TRIANGLES) {
      const want = kind === SIDE
        ? Math.sqrt(x * x + y * y - 2 * x * y * Math.cos(rad(z)))
        : (Math.acos((x * x + y * y - z * z) / (2 * x * y)) * 180) / Math.PI;
      const got = stated(item(id).answer);
      assert.ok(Math.abs(got - want) < 1e-9, `${id}: key «${item(id).answer}», triangle gives ${want}`);
    }
  });

  it('no two items are the same triangle, so one\'s working never answers another', () => {
    const seen = new Map<string, string>();
    for (const [id, kind, x, y, z] of TRIANGLES) {
      const key = sides(kind, x, y, z).map(v => v.toFixed(6)).join(',');
      assert.ok(!seen.has(key), `${id} is the same triangle as ${seen.get(key)}`);
      seen.set(key, id);
    }
  });

  it('has more than one real-life story', () => {
    assert.ok(MATH_BANK.filter(i => i.focus === 'cosine_rule' && i.story).length >= 2);
  });
});

describe('one equation is one question', () => {
  it('two items of the same equation, asked two ways, are spent together', () => {
    const used = new Set<string>();
    spendItem(item('exp-m4'), used);
    assert.equal(itemSpent(item('exp-v2'), used), true);
    assert.equal(itemSpent(item('exp-p2'), used), false);
  });

  it('a lesson drawn dry never serves an equation twice', () => {
    const used = new Set<string>();
    const texts: string[] = [];
    for (;;) {
      const q = takeConcreteMath('short_answer', 'المعادلات الأسية', null, 'medium', 'ar', 4, used, false);
      if (!q) break;
      texts.push(q.text);
    }
    assert.ok(texts.filter(t => t.includes('9^x = 27')).length <= 1, texts.join('\n'));
  });

  it('a chemistry tag is not an equation: two questions about Cl₂ are two questions', () => {
    const chem = (id: string) => CHEM_BANK.find(i => i.id === id)!;
    assert.equal(chem('ch-bd-e2').eq, chem('ch-bd-e4').eq, 'the fixture still shares a tag');
    const used = new Set<string>();
    spendItem(chem('ch-bd-e2'), used);
    assert.equal(itemSpent(chem('ch-bd-e4'), used), false);
  });

  it('working that states a given, or a longer expression, answers nothing', () => {
    const used = new Set<string>();
    markShown(['إذا كان f(x) = x² − 1', 'n = 2 mol', 'pH = 3'], used);
    assert.equal(itemSpent(item('d-e1'), used), false, '«f(x) = x²» is inside «x² − 1», and is not the derivative asked');
    for (const i of CHEM_BANK) assert.equal(itemSpent(i, used), false, `${i.id} spent by chemistry working`);
  });

  it('printed working spends the items whose equation it states', () => {
    const used = new Set<string>();
    markShown(['نكتب 81 بالأساس 3: 81 = 3^4', 'نعوّض: 3^{2x} = 3^4'], used);
    assert.equal(itemSpent(item('exp-p2'), used), true, '«اكتب 81 على صورة قوة أساسها 3» is answered on the page');
    assert.equal(itemSpent(item('exp-p1'), used), false);
  });
});

describe('a word problem is a story', () => {
  it('the word-problem slot takes a story while the lesson has one', () => {
    for (let k = 0; k < 20; k++) {
      const q = takeConcreteMath('word_problem', 'المعادلات الأسية', null, 'medium', 'ar', 6, new Set(), false)!;
      assert.equal(q.story, true, q.text);
    }
  });

  it('says so when the lesson has none — another lesson\'s story in its family does not count', () => {
    // `trig_apps` holds the law-of-sines river crossing; once «قانون جيب التمام»'s
    // own stories are spent, the river crossing must not stand in for them.
    for (let k = 0; k < 20; k++) {
      const used = new Set<string>();
      for (const s of MATH_BANK.filter(i => i.focus === 'cosine_rule' && i.story)) spendItem(s, used);
      const q = takeConcreteMath('word_problem', 'قانون جيب التمام', null, 'medium', 'ar', 6, used, false)!;
      assert.notEqual(q.story, true, q.text);
      assert.doesNotMatch(q.text, /نهر/);
    }
  });

  it('a story asked as multiple choice does not tell the student to write and solve', () => {
    const used = new Set<string>(MATH_BANK.filter(i => i.id !== 'exp-h5').map(i => i.id));
    const q = takeConcreteMath('multiple_choice', 'المعادلات الأسية', null, 'hard', 'ar', 4, used, false)!;
    assert.match(q.text, /بكتيريا/);
    assert.doesNotMatch(q.text, /اكتب المعادلة وحلّها/);
  });
});
