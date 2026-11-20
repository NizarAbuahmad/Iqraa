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
    // «الاقتران العكسي» has one item of its own: one worked example, then none.
    const session = new Set<string>();
    assert.ok(takeSolvedMath('الاقتران العكسي', null, 'medium', 'ar', session));
    assert.equal(takeSolvedMath('الاقتران العكسي', null, 'medium', 'ar', session), null);
  });

  it('practice takes the lesson\'s own items first, within the tier asked', () => {
    for (let k = 0; k < 20; k++) {
      // Medium holds v-m1 (adding vectors) and v-m2 (dot product): the lesson's own wins.
      // Typed topics, as the API's evaluation generator passes an objective's
      // wording: the book's own titles now have generators (`grade10.ts`,
      // `grade10b.ts`), which come before the bank for practice.
      const q = takeConcreteMath('short_answer', 'إيجاد الضرب القياسي لمتجهين', null, 'medium', 'ar', 4, new Set(), false)!;
      assert.match(q.text, /الضرب القياسي/, q.text);
      const arc = takeConcreteMath('short_answer', 'حساب أطوال الأقواس', null, 'medium', 'ar', 4, new Set(), false)!;
      assert.match(arc.text, /قطاع|قوس/, arc.text);
    }
  });

  it('the tier still comes first, so a one-item lesson does not open every paper', () => {
    // The inverse function has one bank item, and it is medium: an easy slot takes
    // an easy one. (A typed topic: the book's own title now has a generator.)
    const q = takeConcreteMath('short_answer', 'إيجاد الاقتران العكسي لاقتران خطي', null, 'easy', 'ar', 4, new Set(), false)!;
    assert.doesNotMatch(q.text, /العكسي/);
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
