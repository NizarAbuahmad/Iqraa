/**
 * Verifies Math G10 S1/S2 browser catalogs are NCCD-aligned.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  UNITS,
  LESSONS,
  getUnitsForBook,
  getLessonsForUnit,
  getLessonById,
  isBrowserCurriculumPreparing,
  isBrowserLessonTitleOnly,
  isBrowserUnitTitleOnly,
} from '../curriculumData.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';

describe('Math G10 S2 browser catalog — NCCD unify', () => {
  it('exports NCCD units 5–8 for book-math-10-s2', () => {
    const units = getUnitsForBook('book-math-10-s2');
    assert.deepEqual(
      units.map(u => u.nameAr),
      ['الاقترانات', 'المشتقات', 'المتجهات', 'الإحصاء والاحتمالات'],
    );
    assert.ok(units.every(u => u.id.startsWith('kbu-math-s2-nccd-')));
  });

  it('hides legacy معادلات / حل معادلات خاصة from active catalog', () => {
    assert.equal(UNITS.some(u => u.id === 'unit-math-10-s2-1'), false);
    assert.equal(LESSONS.some(l => l.id === 'lesson-math-s2-1-1'), false);
  });

  it('includes تركيب الاقترانات under unit 5', () => {
    const lessons = getLessonsForUnit('kbu-math-s2-nccd-u5');
    assert.ok(lessons.some(l => l.id === 'kbl-math-s2-nccd-u5_l3' && l.titleAr === 'تركيب الاقترانات'));
  });
});

describe('Math G10 S1 browser catalog — NCCD unify', () => {
  it('exports NCCD units 1–4 for book-math-10', () => {
    const units = getUnitsForBook('book-math-10');
    assert.deepEqual(
      units.map(u => u.nameAr),
      ['الأسس والمعادلات', 'الدائرة', 'حساب المثلثات', 'تطبيقات المثلثات'],
    );
    assert.equal(units.length, 4);
    assert.ok(units.every(u => u.id.startsWith('kbu-math-s1-nccd-')));
  });

  it('hides legacy S1 browser units/lessons', () => {
    assert.equal(UNITS.some(u => u.id === 'unit-math-10-1'), false);
    assert.equal(LESSONS.some(l => l.id === 'lesson-math-1'), false);
  });

  it('has 18 Sem1 lessons total', () => {
    const units = getUnitsForBook('book-math-10');
    const count = units.reduce((n, u) => n + getLessonsForUnit(u.id).length, 0);
    assert.equal(count, 18);
  });

  it('Unit 1 is fully grounded (no title-only badge)', () => {
    assert.equal(isBrowserUnitTitleOnly('kbu-math-s1-nccd-u1'), false);
    assert.equal(isBrowserLessonTitleOnly('kbl-math-s1-nccd-u1_l4'), false);
    const lesson = getLessonById('kbl-math-s1-nccd-u1_l4');
    assert.ok(lesson && lesson.objectives.length > 0);
  });

  it('Units 2–4 are title-only', () => {
    assert.equal(isBrowserUnitTitleOnly('kbu-math-s1-nccd-u2'), true);
    assert.equal(isBrowserUnitTitleOnly('kbu-math-s1-nccd-u3'), true);
    assert.equal(isBrowserUnitTitleOnly('kbu-math-s1-nccd-u4'), true);
    assert.equal(isBrowserLessonTitleOnly('kbl-math-s1-nccd-u2_l1'), true);
  });

  it('isBrowserCurriculumPreparing is always false (S1 is NCCD-backed)', () => {
    assert.equal(isBrowserCurriculumPreparing('book-math-10'), false);
    assert.equal(isBrowserCurriculumPreparing('book-math-10-s2'), false);
  });

  it('Unit 1 generator context includes per-lesson objectives', () => {
    const g = resolveGeneratorGrounding('حل المعادلة الأسية', 'ar');
    assert.equal(g.grounded, true);
    assert.ok(g.context.includes('النتاجات (من المنهج الرسمي):'));
    assert.ok(g.context.includes('حل معادلات أسية'));
    assert.ok(!g.context.includes('على مستوى الوحدة'));
  });

  it('Unit 2 generator context uses unit_objectives, labeled as unit-level', () => {
    const g = resolveGeneratorGrounding('أوتار الدائرة وأقطارها ومماساتها', 'ar');
    assert.equal(g.grounded, true);
    assert.ok(g.context.includes('على مستوى الوحدة'));
    assert.ok(g.context.includes('حساب طول القوس، ومساحة القطاع الدائري'));
    assert.ok(!g.context.includes('النتاجات (من المنهج الرسمي):'));
  });
});
