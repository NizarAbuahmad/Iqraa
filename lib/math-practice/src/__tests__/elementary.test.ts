/**
 * Grade 1–6 maths items. Before these, every such lesson fell through to the
 * Grade 10 bank's `algebra` family: a Grade 2 «الجمع» quiz asked «x² = 49».
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { detectElementaryOp, lessonTable, makeElementaryItem } from '../elementary.ts';
import { takeElementaryMath, type DiffTier } from '../index.ts';

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
    const used = new Set<string>();
    for (let i = 0; i < 20; i++) {
      assert.match(makeElementaryItem('الضَّرْبُ في 2', 3, 'medium', used).eq, /^2 × \d+$/);
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
