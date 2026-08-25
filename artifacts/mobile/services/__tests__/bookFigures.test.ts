/**
 * Book-figure lookup tests.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/mobile/services/__tests__/bookFigures.test.ts
 *
 * These assert against the REAL extracted data rather than fixtures, because
 * the thing most likely to break is the join between two files that disagree
 * about lesson boundaries — and a fixture would agree with itself.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { figuresForLesson, figurePath, lessonsWithFigures } from '../bookFigures.ts';

describe('figuresForLesson', () => {
  it('finds the system figures under the lesson that teaches systems', () => {
    // p021 is the x² + y² = 9 / y + x = 5 figure — a circle and a line, which
    // is exactly a linear-quadratic system.
    const figures = figuresForLesson('kbl-math-s1-nccd-u1_l1');
    assert.ok(figures.length > 0, 'the lesson has figures');
    assert.ok(figures.some(f => f.file === 'p021.png'));
    assert.ok(figures.every(f => f.sourceId === 'math-s2-student-book'));
  });

  it('keeps the circle-and-parabola figure with the two-quadratics lesson', () => {
    const figures = figuresForLesson('kbl-math-s1-nccd-u1_l2');
    assert.ok(figures.some(f => f.file === 'p028.png'));
  });

  it('puts the hyperbolas under Rational Functions', () => {
    // Matched by the curriculum's ARABIC title — «قسمة كثيرات الحدود
    // والاقترانات النسبية» — which the English matcher could not see.
    const figures = figuresForLesson('kbl-math-s2-nccd-u5_l2');
    assert.ok(figures.length > 0);
    assert.ok(figures.every(f => f.lessonTitleEn === 'Rational Functions'));
  });

  it('returns figures in the order the book prints them', () => {
    for (const id of lessonsWithFigures()) {
      const pages = figuresForLesson(id).map(f => f.pdfPage);
      assert.deepEqual(pages, [...pages].sort((a, b) => a - b), id);
    }
  });

  it('is empty for a lesson with nothing mapped, and for nothing at all', () => {
    // Chemistry is unmapped by design — its book yields no usable outline.
    assert.deepEqual(figuresForLesson('kbl-chem-s1-nccd-u1_l1'), []);
    assert.deepEqual(figuresForLesson('no-such-lesson'), []);
    assert.deepEqual(figuresForLesson(null), []);
    assert.deepEqual(figuresForLesson(undefined), []);
  });

  it('never files a figure under two different lessons', () => {
    const seen = new Map<string, string>();
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) {
        const key = `${f.sourceId}/${f.file}`;
        const already = seen.get(key);
        assert.equal(already, undefined, `${key} is in both ${already} and ${id}`);
        seen.set(key, id);
      }
    }
  });

  it('carries the page number, so any figure can be checked against the book', () => {
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) {
        assert.ok(Number.isInteger(f.pdfPage) && f.pdfPage > 0, `${f.file} has a page`);
        assert.match(f.file, /^p\d{3}\.png$/);
      }
    }
  });
});

describe('figurePath', () => {
  it('points at the file inside its book directory', () => {
    const [figure] = figuresForLesson('kbl-math-s1-nccd-u1_l1');
    assert.equal(
      figurePath(figure!),
      `knowledge-base/grade-10-math/figures/math-s2-student-book/${figure!.file}`,
    );
  });
});
