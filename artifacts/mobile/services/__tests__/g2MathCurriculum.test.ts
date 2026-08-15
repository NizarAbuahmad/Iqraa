/**
 * Grade 2 mathematics curriculum tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/g2MathCurriculum.test.ts
 *
 * The dataset's honesty contract is what these tests hold:
 *  • Units 7–10 came from the teacher guide's مخطط الوحدة tables — every
 *    lesson there must carry at least one objective and a period count.
 *  • Unit 6 came from the student book's أتعلم اليوم boxes — objectives yes,
 *    periods unknown.
 *  • Units 1–5 are title-only (guide not delivered) — they must exist for the
 *    cascade, and they must NOT pretend to have outcomes.
 * The G10 rule applies unchanged: gaps are recorded, never filled in.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  buildG2MathCatalog,
  G2_MATH_S1_BOOK_ID,
  G2_MATH_S2_BOOK_ID,
  isG2MathTitleOnlyTier,
  nccdG2Math,
} from '../curriculumG2Math.ts';
import {
  getLessonsForUnit,
  getUnitsForSubjectGrade,
  hasKBContent,
  KB_BOOKS,
} from '../knowledgeBase.ts';
import { resolveGeneratorGrounding } from '../kbContext.ts';

describe('dataset shape', () => {
  it('carries the full year: 10 units, 61 lessons', () => {
    assert.equal(nccdG2Math.units.length, 10);
    const lessons = nccdG2Math.units.flatMap(u => u.lessons);
    assert.equal(lessons.length, 61);
  });

  it('splits semesters 1 and 2 as the books do (units 1–5 / 6–10)', () => {
    for (const u of nccdG2Math.units) {
      assert.equal(u.semester, u.number <= 5 ? 1 : 2, `unit ${u.number}`);
    }
  });

  it('gives every lesson a non-empty Arabic title and unique id', () => {
    const ids = new Set<string>();
    for (const u of nccdG2Math.units) {
      for (const l of u.lessons) {
        assert.ok(l.title_ar.trim().length > 0);
        assert.equal(ids.has(l.id), false, `duplicate id ${l.id}`);
        ids.add(l.id);
      }
    }
  });
});

describe('provenance tiers', () => {
  it('teacher-guide units (7–10) have objectives and periods on every lesson', () => {
    for (const u of nccdG2Math.units.filter(u => u.data_tier === 'teacher_guide')) {
      for (const l of u.lessons) {
        assert.ok(l.objectives.length > 0, `${l.id} lost its guide objectives`);
        assert.ok((l.periods ?? 0) > 0, `${l.id} lost its period count`);
      }
    }
  });

  it('unit 6 (student book) has objectives on every lesson, periods unknown', () => {
    const u6 = nccdG2Math.units.find(u => u.number === 6)!;
    assert.equal(u6.data_tier, 'student_book_lesson');
    for (const l of u6.lessons) {
      assert.ok(l.objectives.length > 0, `${l.id} lost its أتعلم اليوم outcome`);
      assert.equal(l.periods, null);
    }
  });

  it('title-only units (1–5) never pretend to have outcomes', () => {
    const titleOnly = nccdG2Math.units.filter(u => isG2MathTitleOnlyTier(u.data_tier));
    assert.equal(titleOnly.length, 5);
    for (const u of titleOnly) {
      assert.ok(u.number <= 5);
      for (const l of u.lessons) {
        assert.equal(l.objectives.length, 0, `${l.id} has invented objectives`);
      }
    }
  });

  it('teacher-guide period sums match the مخطط rows net of تهيئة/مشروع/اختبار', () => {
    // Guide totals include 1 تهيئة + 1 مشروع + 1 اختبار (3 periods) beyond
    // the lesson rows. Units 7 (19), 8 (15) and 9 (13) reconcile exactly.
    // Unit 10 does NOT: its rows sum to 6+3=9 while the guide prints 13 —
    // the guide disagrees with itself, and the values were transcribed as
    // printed rather than "fixed" (see meta.known_gaps).
    const sums = new Map<number, number>();
    for (const u of nccdG2Math.units.filter(u => u.data_tier === 'teacher_guide')) {
      sums.set(u.number, u.lessons.reduce((acc, l) => acc + (l.periods ?? 0), 0));
    }
    assert.equal(sums.get(7)! + 3, 19);
    assert.equal(sums.get(8)! + 3, 15);
    assert.equal(sums.get(9)! + 3, 13);
    assert.equal(sums.get(10), 6);
    const u10 = nccdG2Math.units.find(u => u.number === 10)!;
    assert.equal(u10.total_periods, 13); // as printed, discrepancy recorded
  });
});

describe('KB integration', () => {
  it('registers both semester books under grade-2 mathematics', () => {
    const g2books = KB_BOOKS.filter(b => b.gradeId === 'grade-2');
    assert.deepEqual(g2books.map(b => b.id).sort(), [G2_MATH_S1_BOOK_ID, G2_MATH_S2_BOOK_ID]);
    assert.ok(g2books.every(b => b.subjectId === 'mathematics'));
  });

  it('lights up the cascade: hasKBContent and 10 browsable units', () => {
    assert.equal(hasKBContent('mathematics', 'grade-2'), true);
    const units = getUnitsForSubjectGrade('mathematics', 'grade-2');
    assert.equal(units.length, 10);
    // Lessons resolve per unit — spot-check division (unit 7, 8 lessons).
    const div = units.find(u => u.titleAr === 'القسمة')!;
    assert.equal(getLessonsForUnit(div.id).length, 8);
  });

  it('keeps other grade-2 subjects honestly empty', () => {
    assert.equal(hasKBContent('arabic', 'grade-2'), false);
    assert.deepEqual(getUnitsForSubjectGrade('arabic', 'grade-2'), []);
  });

  it('maps vocabulary into key concepts so the deck and context can use it', () => {
    const { lessons } = buildG2MathCatalog();
    const division = lessons.find(l => l.titleAr === 'القسمة كطرح متكرر')!;
    assert.ok(division.keyConceptsAr.includes('جملة القسمة'));
    assert.ok(division.keyConceptsEn.includes('quotient'));
  });
});

describe('grounding', () => {
  it('grounds a G2 topic for grade-2 mathematics with the guide objectives', () => {
    const g = resolveGeneratorGrounding('القسمة على 2', 'ar', {
      gradeId: 'grade-2', subjectId: 'mathematics',
    });
    assert.equal(g.grounded, true);
    assert.ok(g.lesson);
    assert.ok(g.lesson!.objectives.some(o => o.includes('حقائق القسمة على 2')));
  });

  it('still refuses a grade with no books (G7 math)', () => {
    const g = resolveGeneratorGrounding('القسمة على 2', 'ar', {
      gradeId: 'grade-7', subjectId: 'mathematics',
    });
    assert.equal(g.grounded, false);
  });

  it('grounds a title-only S1 lesson without inventing objectives', () => {
    const g = resolveGeneratorGrounding('الجمع مع إعادة التجميع (1)', 'ar', {
      gradeId: 'grade-2', subjectId: 'mathematics',
    });
    assert.equal(g.grounded, true);
    assert.equal(g.lesson!.objectives.length, 0);
    // The serialized context must not carry an outcomes section it doesn't have.
    assert.equal(g.context.includes('النتاجات (من المنهج الرسمي)'), false);
  });
});
