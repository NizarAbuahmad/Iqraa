import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MATH_FORMULAS } from '@workspace/curriculum/math-formulas';
import { getLessonById } from '../knowledgeBase.ts';
import { buildFormulaSheet, filterFormulaSheet, formulaCaption } from '../mathFormulaView.ts';

describe('buildFormulaSheet', () => {
  it('places every formula exactly once', () => {
    for (const lang of ['ar', 'en'] as const) {
      const rows = buildFormulaSheet(lang).flatMap(u => u.lessons.flatMap(l => l.formulas));
      assert.equal(rows.length, MATH_FORMULAS.length, lang);
      assert.deepEqual(rows.map(r => r.id).sort(), MATH_FORMULAS.map(f => f.id).sort(), lang);
    }
  });

  it('every lesson title is the knowledge base title, never typed here', () => {
    for (const lang of ['ar', 'en'] as const) {
      for (const unit of buildFormulaSheet(lang)) {
        for (const lesson of unit.lessons) {
          const kb = getLessonById(lesson.lessonId);
          assert.ok(kb, `${lesson.lessonId} is not in the knowledge base`);
          assert.equal(lesson.title, lang === 'ar' ? kb.titleAr : kb.titleEn);
          assert.ok(lesson.title.trim().length > 0);
        }
      }
    }
  });

  it('is grouped by unit, units and lessons in book order', () => {
    const sheet = buildFormulaSheet('ar');
    assert.ok(sheet.length >= 5, `only ${sheet.length} units`);
    const unitOrders = sheet.map(u => u.order);
    assert.deepEqual(unitOrders, [...unitOrders].sort((a, b) => a - b));
    for (const unit of sheet) {
      const lessonOrders = unit.lessons.map(l => l.order);
      assert.deepEqual(lessonOrders, [...lessonOrders].sort((a, b) => a - b));
      assert.ok(unit.title.trim().length > 0);
    }
  });

  it('only Grade 10 maths units appear', () => {
    for (const unit of buildFormulaSheet('en')) assert.match(unit.unitId, /^kbu-math-/);
  });

  it('a row carries the book and page it was printed on', () => {
    const arc = buildFormulaSheet('en')
      .flatMap(u => u.lessons.flatMap(l => l.formulas))
      .find(r => r.id === 'mf-sector-area');
    assert.deepEqual({ book: arc?.book, page: arc?.page }, { book: 's1', page: 42 });
  });
});

describe('formulaCaption', () => {
  const rows = buildFormulaSheet('ar').flatMap(u => u.lessons.flatMap(l => l.formulas));
  const withAr = rows.find(r => r.captionAr);
  const withoutAr = rows.find(r => !r.captionAr);

  it('English always has a caption', () => {
    for (const r of rows) assert.ok((formulaCaption(r, 'en') ?? '').length > 0, r.id);
  });
  it('Arabic shows the book\'s own phrase when there is one', () => {
    assert.ok(withAr);
    assert.equal(formulaCaption(withAr, 'ar'), withAr.captionAr);
  });
  it('Arabic shows nothing rather than an invented phrase when the book has none', () => {
    assert.ok(withoutAr);
    assert.equal(formulaCaption(withoutAr, 'ar'), null);
  });
});

describe('filterFormulaSheet', () => {
  const sheet = buildFormulaSheet('ar');
  it('null keeps everything', () => {
    assert.equal(filterFormulaSheet(sheet, null), sheet);
  });
  it('a unit id keeps only that unit', () => {
    const only = filterFormulaSheet(sheet, sheet[1].unitId);
    assert.equal(only.length, 1);
    assert.equal(only[0].unitId, sheet[1].unitId);
  });
  it('an unknown unit id keeps nothing', () => {
    assert.deepEqual(filterFormulaSheet(sheet, 'kbu-nope'), []);
  });
});
