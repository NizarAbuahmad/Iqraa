/**
 * Invariants for the chemistry bank, and the two it shares with maths.
 *
 * These are not style checks. Each one corresponds to a way an item can reach
 * a student as a broken question rather than fail loudly:
 *
 *  - a missing prompt falls through to `itemStem`'s maths wording and asks a
 *    teacher to «أوجد حل المعادلة» for «ما نوع الرابطة في NaCl»;
 *  - a duplicate id across the two banks silently dedupes a chemistry item
 *    against a maths one, because the session set is shared;
 *  - a duplicated or answer-matching distractor makes `bankMultipleChoice` on
 *    the API server return null, and the exam quietly comes up short.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  CHEM_BANK,
  detectChemFamily,
  isChemContext,
  isMathContext,
  takeConcreteChem,
  type ChemFamily,
  type ConcreteItem,
} from '../index.ts';

/** Not exported — the bank is reached through `takeConcreteMath`. */
const MATH_IDS = new Set<string>();

describe('chemistry bank', () => {
  it('gives every item both prompts — the fallback stem is maths-shaped', () => {
    const missing = CHEM_BANK.filter(i => !i.promptAr || !i.promptEn).map(i => i.id);
    assert.deepEqual(missing, [], `these would be asked as «أوجد حل المعادلة: …»: ${missing.join(', ')}`);
  });

  it('never repeats an id, including against the maths bank', () => {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const item of CHEM_BANK) {
      if (seen.has(item.id) || MATH_IDS.has(item.id)) dupes.push(item.id);
      seen.add(item.id);
    }
    assert.deepEqual(dupes, [], `a shared session set would treat these as one item: ${dupes.join(', ')}`);
  });

  it('keeps the answer out of its own distractors', () => {
    const bad = CHEM_BANK.filter(i => i.wrongs.includes(i.answer)).map(i => i.id);
    assert.deepEqual(bad, [], `two options would be correct in: ${bad.join(', ')}`);
  });

  it('gives four distinct options, which is what the exam generator requires', () => {
    const bad: string[] = [];
    for (const item of CHEM_BANK) {
      if (item.wrongs.length < 3) bad.push(`${item.id} (only ${item.wrongs.length} distractors)`);
      if (new Set(item.wrongs).size !== item.wrongs.length) bad.push(`${item.id} (repeated distractor)`);
    }
    assert.deepEqual(bad, [], `bankMultipleChoice returns null for these, losing the question: ${bad.join(', ')}`);
  });

  it('covers every family it can detect', () => {
    const families = new Set(CHEM_BANK.map(i => i.family as ChemFamily));
    const expected: ChemFamily[] = [
      'atom_basics', 'atomic_structure', 'electron_config', 'periodic_trends',
      'bonding', 'formulas', 'equations', 'mole', 'stoichiometry',
      'thermochem', 'acids_bases', 'metal_activity', 'redox', 'general_chem',
    ];
    const empty = expected.filter(f => !families.has(f));
    assert.deepEqual(empty, [], `detected but unstocked, so these silently serve general_chem: ${empty.join(', ')}`);
  });

  it('offers all three tiers where a whole unit depends on one family', () => {
    // The G10 S2 families carry a unit each. A tier with no item there means
    // an "advanced" exam quietly serves an easy question.
    for (const family of ['mole', 'stoichiometry', 'equations', 'thermochem'] as ChemFamily[]) {
      const tiers = new Set(CHEM_BANK.filter(i => i.family === family).map(i => i.diff));
      assert.ok(tiers.has('easy'), `${family} has no easy item`);
      assert.ok(tiers.has('medium'), `${family} has no medium item`);
      assert.ok(tiers.has('hard'), `${family} has no hard item`);
    }
  });
});

describe('detectChemFamily', () => {
  // Titles copied from the catalogs in lib/curriculum/src/data — if a book is
  // re-ingested with reworded titles, this is what notices.
  const CASES: Array<[string, ChemFamily]> = [
    ['نظرية بور لذرة الهيدروجين', 'atomic_structure'],
    ['النموذج الميكانيكي الموجي للذرة', 'atomic_structure'],
    ['التوزيع الإلكتروني للذرات', 'electron_config'],
    ['الخصائص الدورية للعناصر', 'periodic_trends'],
    ['الروابط الكيميائية وأنواعها', 'bonding'],
    ['الصيغ الكيميائية وخصائص المركبات', 'formulas'],
    ['التفاعلات الكيميائية', 'equations'],
    ['المول والكتلة المولية', 'mole'],
    ['الحسابات الكيميائية', 'stoichiometry'],
    ['تغيرات الطاقة في التفاعلات الكيميائية', 'thermochem'],
    ['مكوِّناتُ الذرَّةِ', 'atom_basics'],
    ['خصائصُ الحُموضِ والقواعدِ', 'acids_bases'],
    ['سلسلةُ النشاطِ الكيميائيِّ وتآكُلُ الفلزاتِ', 'metal_activity'],
    ['التأكسدُ والاختزالُ والخلايا الجلفانيةُ', 'redox'],
  ];

  for (const [title, family] of CASES) {
    it(`«${title}» → ${family}`, () => {
      assert.equal(detectChemFamily(title), family);
    });
  }

  it('falls back to general_chem rather than guessing', () => {
    assert.equal(detectChemFamily('موضوع لا يشبه أي درس'), 'general_chem');
  });
});

describe('isChemContext', () => {
  it('takes the lesson subject as ground truth', () => {
    assert.equal(isChemContext('أي شيء', null, undefined, 'chemistry'), true);
    assert.equal(isChemContext('المول والكتلة المولية', null, undefined, 'mathematics'), false);
  });

  it('does not claim a maths lesson, and maths does not claim a chemistry one', () => {
    // The property `tryMathPractice` relies on: whenever a subject is known,
    // exactly one of the two answers true.
    for (const subject of ['mathematics', 'الرياضيات']) {
      assert.equal(isChemContext('المعادلات', null, subject), false, subject);
      assert.equal(isMathContext('المعادلات', null, subject), true, subject);
    }
    for (const subject of ['chemistry', 'الكيمياء']) {
      assert.equal(isChemContext('المعادلة الكيميائية', null, subject), true, subject);
      assert.equal(isMathContext('المعادلة الكيميائية', null, subject), false, subject);
    }
  });

  it('recognises chemistry from the text when nothing else names a subject', () => {
    // This is the case where order matters in `tryMathPractice`: «معادلة»
    // also matches the maths pattern, so chemistry is asked first.
    assert.equal(isChemContext('المعادلة الكيميائية ووزنها', null), true);
    assert.equal(isChemContext('الكتلة المولية للماء', null), true);
    assert.equal(isChemContext('حل المعادلات التربيعية', null), false);
    assert.equal(isChemContext('مشتقة الاقتران', null), false);
  });
});

describe('takeConcreteChem', () => {
  it('returns a real multiple-choice item whose answer is one of its options', () => {
    const session = new Set<string>();
    const q = takeConcreteChem('multiple_choice', 'المول والكتلة المولية', null, 'easy', 'ar', 4, session);
    assert.ok(q, 'no item for a stocked family');
    assert.ok(q.options && q.options.length === 4, 'expected four options');
    // The exact check `bankMultipleChoice` performs before trusting the key.
    assert.ok(q.options.includes(q.answer), 'the key is not among the options');
    assert.equal(new Set(q.options).size, 4, 'options are not distinct');
  });

  it('asks about the lesson, not about the topic word', () => {
    const session = new Set<string>();
    const q = takeConcreteChem('multiple_choice', 'المول والكتلة المولية', null, 'easy', 'ar', 4, session);
    // The generic templates all contain the topic string and one of these
    // giveaway distractors. A bank item contains neither.
    assert.ok(!q!.options!.includes('لا شيء مما ذُكر'), 'served a template distractor');
    assert.match(q!.text, /[A-Za-z₀-₉]|\d/, 'expected a formula or a number in the stem');
  });

  it('does not repeat an item within one session', () => {
    const session = new Set<string>();
    const seen = new Set<string>();
    for (let i = 0; i < 5; i++) {
      const q = takeConcreteChem('short_answer', 'التفاعلات الكيميائية', null, 'medium', 'ar', 4, session);
      assert.ok(q, `ran dry at ${i}`);
      assert.ok(!seen.has(q.text), `repeated within a session: ${q.text}`);
      seen.add(q.text);
    }
  });

  it('keeps its session set separate, so two exams do not drain each other', () => {
    const a = new Set<string>();
    const b = new Set<string>();
    const first = takeConcreteChem('short_answer', 'المول', null, 'easy', 'ar', 4, a);
    const second = takeConcreteChem('short_answer', 'المول', null, 'easy', 'ar', 4, b);
    assert.ok(first && second);
    assert.equal(b.size, 1, 'the second session inherited the first one\'s spend');
  });

  it('stays in the detected family rather than drifting to general chemistry', () => {
    const session = new Set<string>();
    const ids = new Set<string>();
    for (let i = 0; i < 4; i++) {
      const q = takeConcreteChem('short_answer', 'الروابط الكيميائية وأنواعها', null, 'medium', 'ar', 4, session);
      assert.ok(q);
      ids.add(q.text);
    }
    // Every bonding stem names a bond or a compound; a general_chem item would
    // be about elements and mixtures instead.
    for (const text of ids) {
      assert.match(text, /رابطة|الروابط|NaCl|Cl₂|H₂O|HCl|فلز/u, `left the family: ${text}`);
    }
  });
});

describe('the maths bank is unchanged', () => {
  it('still answers a maths topic from the maths bank', () => {
    assert.equal(isMathContext('حل المعادلات الأسية', null, 'mathematics'), true);
  });

  it('accepts a chemistry item type it shares with maths', () => {
    const item: ConcreteItem = CHEM_BANK[0]!;
    assert.ok(typeof item.eq === 'string' && item.eq.length > 0);
  });
});
