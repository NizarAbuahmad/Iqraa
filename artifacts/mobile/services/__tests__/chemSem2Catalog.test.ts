/**
 * Chemistry Semester 2 in the knowledge base.
 *
 * Until 2026-08-24 this book was two hand-written placeholder rows: a unit
 * literally titled «الوحدة الرابعة» with no subject, and a unit 5 titled
 * «التفاعلات الكيميائية» — which is unit 4's subject. A teacher browsing
 * chemistry S2 got a placeholder and a wrong answer, and nothing failed.
 *
 * These tests assert the NCCD book replaced both, and are written against
 * KB_UNITS/KB_LESSONS rather than the JSON so that they cover the wiring too:
 * data that never reaches the catalog helps nobody.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { KB_LESSONS, KB_UNITS } from '../knowledgeBase.ts';

const BOOK = 'kb-chem-10-s2';
const units = KB_UNITS.filter(u => u.bookId === BOOK);
const unitIds = new Set(units.map(u => u.id));
const lessons = KB_LESSONS.filter(l => unitIds.has(l.unitId));

describe('chemistry S2 — units', () => {
  it('carries the book’s two real units, in book order', () => {
    assert.equal(units.length, 2);
    const byOrder = [...units].sort((a, b) => a.order - b.order);
    assert.equal(byOrder[0]!.titleAr, 'التفاعلات والحسابات الكيميائية');
    assert.equal(byOrder[1]!.titleAr, 'الطاقة الكيميائية');
  });

  it('no longer calls unit 5 «التفاعلات الكيميائية»', () => {
    // The specific past wrongness: reactions are unit 4's subject.
    const byOrder = [...units].sort((a, b) => a.order - b.order);
    assert.notEqual(byOrder[1]!.titleAr, 'التفاعلات الكيميائية');
  });

  it('drops the placeholder rows entirely', () => {
    for (const id of ['kbu-chem-s2-4', 'kbu-chem-s2-5']) {
      assert.equal(KB_UNITS.some(u => u.id === id), false, `${id} still in KB_UNITS`);
    }
    for (const id of ['kbl-chem-s2-4-1', 'kbl-chem-s2-5-1']) {
      assert.equal(KB_LESSONS.some(l => l.id === id), false, `${id} still in KB_LESSONS`);
    }
  });
});

describe('chemistry S2 — lessons', () => {
  it('has three taught lessons and one lab per unit', () => {
    assert.equal(lessons.length, 8);
    const labs = lessons.filter(l => l.titleAr.startsWith('تجربة استهلالية'));
    assert.equal(labs.length, 2);
  });

  it('gives every taught lesson at least one official outcome', () => {
    // Labs legitimately carry none — the book prints no outcomes for them.
    for (const lesson of lessons) {
      const isLab = lesson.titleAr.startsWith('تجربة استهلالية');
      assert.equal(
        lesson.objectives.length > 0,
        !isLab,
        `${lesson.titleAr}: objectives ${lesson.objectives.length}`,
      );
    }
  });

  it('carries the teacher guide’s period counts', () => {
    // The S1 book shipped with periods null everywhere because its guide was
    // not on hand. This one is, so a null here means the guide's مخطط الوحدة
    // stopped being read.
    const taught = lessons.filter(l => !l.titleAr.startsWith('تجربة استهلالية'));
    for (const lesson of taught) {
      assert.ok(
        typeof lesson.periods === 'number' && lesson.periods > 0,
        `${lesson.titleAr} has no periods`,
      );
    }
    assert.equal(taught.reduce((sum, l) => sum + (l.periods ?? 0), 0), 18);
  });

  it('keeps the bilingual vocabulary from the lesson openers', () => {
    const mole = lessons.find(l => l.titleAr === 'المول والكتلة المولية');
    assert.ok(mole, 'mole lesson missing');
    assert.ok(mole!.keyConceptsAr.includes('عدد أفوجادرو'));
    assert.ok(mole!.keyConceptsEn.includes("Avogadro's Number"));
  });
});
