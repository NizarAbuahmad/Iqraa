/**
 * Grade 10 maths works in real numbers only. «حل معادلات خاصة» served the
 * example «x³−2x²+9x−18=0: حلول x=2 و x=±3i», where the book (math S1 p.9)
 * says x² + 9 = 0 has no real solution and the equation has the one root 2.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KB_BOOKS, KB_LESSONS, KB_UNITS, getLessonById } from '../knowledgeBase.ts';

/** A complex root as text: «3i», «±3i», «2 + 5i» — a digit followed by a lone i. */
const COMPLEX = /\d\s*i\b/;

describe('Grade 10 maths lesson text', () => {
  it('serves no complex root', () => {
    const books = new Set(KB_BOOKS.filter(b => b.gradeId === 'grade-10' && b.subjectId === 'mathematics').map(b => b.id));
    const units = new Set(KB_UNITS.filter(u => books.has(u.bookId)).map(u => u.id));
    const lessons = KB_LESSONS.filter(l => units.has(l.unitId));
    assert.ok(lessons.length > 30, 'the Grade 10 maths lessons were found');
    for (const l of lessons) {
      const text = [l.summaryAr, l.summaryEn, ...(l.examplesAr ?? []), ...(l.examplesEn ?? []), ...(l.rulesAr ?? []), ...(l.rulesEn ?? [])].join('\n');
      assert.doesNotMatch(text, COMPLEX, `${l.id} «${l.titleAr}»`);
    }
  });

  it('gives «حل معادلات خاصة» the book’s one real root', () => {
    const l = getLessonById('kbl-math-s1-nccd-u1_l5');
    assert.ok(l, 'the lesson exists');
    assert.ok(l!.examplesAr?.some(e => e.includes('x³−2x²+9x−18=0') && e.includes('جذر واحد هو 2')));
  });
});
