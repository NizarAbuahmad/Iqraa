/**
 * Grade 9 chemistry is asked in the Grade 9 book's terms (found 2026-11-14, Grade 9 review).
 *
 * The Grade 9 lesson «التوزيع الإلكتروني والجدول الدوري» used to be routed to the Grade 10
 * family, so a Grade 9 quiz asked for «1s² 2s² 2p⁶ 3s² 3p⁶ 4s²», whether 4s fills before 3d,
 * how Fe²⁺ loses its electrons and how many electrons are unpaired — none of which the Grade 9
 * book teaches. It writes an arrangement as energy levels, «2, 8, 8, 2», for the representative
 * elements up to calcium (student book S1 p.20, table 3). Its pH lesson (p.44) compares pH values
 * and never says the scale is logarithmic, and it has no mole. It names zinc «الخارصين» and the
 * indicator «تبّاع الشمس» throughout and never «الزنك» or «عباد الشمس».
 *
 * What none of this can say: whether each item is the best question for the lesson. That is
 * a chemistry teacher's call.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CHEM_BANK, detectChemFamily } from '../index.ts';

const GRADE_9 = ['atom_basics', 'electron_shells', 'acids_bases', 'metal_activity', 'redox'];
const g9 = CHEM_BANK.filter(i => GRADE_9.includes(i.family));
const text = (i: (typeof CHEM_BANK)[number]) => [i.promptAr, i.eq, i.answer, ...i.wrongs].join(' ');

/** Energy levels as the Grade 9 book fills them: 2, then 8, then 8, then the rest (Z ≤ 20). */
function shells(electrons: number): string {
  const out: number[] = [];
  let left = electrons;
  for (const cap of [2, 8, 8, 2]) {
    if (left <= 0) break;
    out.push(Math.min(cap, left));
    left -= cap;
  }
  return out.join(', ');
}

const SUP: Record<string, string> = { '²': '2', '³': '3' };
/** The charge an ion symbol carries in a prompt: «Cl⁻» → −1, «Mg²⁺» → +2, none → 0. */
function chargeIn(prompt: string): number {
  const m = /[A-Z][a-z]?([²³]?)([⁺⁻])/.exec(prompt);
  if (!m) return 0;
  const n = m[1] ? Number(SUP[m[1]]) : 1;
  return m[2] === '⁺' ? n : -n;
}

describe('Grade 9 chemistry follows the Grade 9 book', () => {
  it('routes the Grade 9 electron-arrangement lesson to its own family, and leaves Grade 10 alone', () => {
    const g9Lesson = [
      'التوزيعُ الإلكترونيُّ والجدولُ الدوريُّ',
      'أكتب التوزيع الإلكتروني لذرات بعض العناصر الممثلة وأيوناتها في المجموعات المختلفة.',
      'أتنبأ باستخدام الجدول الدوري ببعض خصائص العناصر (الحجم والنشاط الكيميائي).',
    ].join(' ');
    assert.equal(detectChemFamily(g9Lesson), 'electron_shells');
    assert.equal(detectChemFamily('التوزيع الإلكتروني للذرات'), 'electron_config');
  });

  it('writes no subshell, no mole and no logarithmic scale', () => {
    const bad = g9
      .filter(i => /[1-7][spdf][⁰¹²³⁴⁵⁶⁷⁸⁹]|أوربيتال|mol\b|مولًا|لوغاريتم/.test(text(i)))
      .map(i => i.id);
    assert.deepEqual(bad, []);
  });

  it('uses the book\'s words for zinc and for litmus', () => {
    const bad = g9.filter(i => /الزنك|عباد الشمس/.test(text(i))).map(i => i.id);
    assert.deepEqual(bad, []);
  });

  it('every energy-level arrangement it keys is the right one', () => {
    const checked: string[] = [];
    const bad: string[] = [];
    for (const i of CHEM_BANK.filter(i => i.family === 'electron_shells')) {
      if (!/^\d+(, \d+)*$/.test(i.answer)) continue;
      const z = /Z = (\d+)/.exec(i.promptAr ?? '');
      assert.ok(z, `${i.id}: a keyed arrangement must name its atomic number`);
      const want = shells(Number(z[1]) - chargeIn(i.promptAr ?? ''));
      if (i.answer !== want) bad.push(`${i.id}: ${i.answer} ≠ ${want}`);
      if (i.wrongs.includes(want)) bad.push(`${i.id}: a distractor is also right`);
      checked.push(i.id);
    }
    assert.deepEqual(bad, []);
    assert.ok(checked.length >= 4, `only ${checked.length} arrangements checked`);
  });

  it('asks about the atomic models and the signs that a reaction happened', () => {
    // «أتتبع تطور النماذج الذرية» and «أستنتج مؤشرات حدوث التفاعل الكيميائي» are outcomes of
    // their lessons, and no item used to ask either.
    const atom = CHEM_BANK.filter(i => i.family === 'atom_basics').map(text).join(' ');
    assert.match(atom, /رذرفورد/);
    assert.match(atom, /ثومسون/);
    assert.match(atom, /المهبطية/);
    const acids = CHEM_BANK.filter(i => i.family === 'acids_bases').map(text).join(' ');
    assert.match(acids, /حدوث تفاعل كيميائي/);
  });
});
