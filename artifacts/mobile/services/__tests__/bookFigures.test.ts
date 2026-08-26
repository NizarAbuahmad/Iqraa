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
    // is exactly a linear-quadratic system. It sits in the SEMESTER-1 book:
    // units 1-4 are semester 1, and the PDF whose filename says otherwise is
    // the one that is wrong (see scripts/extract_book_figures.py BOOKS).
    const figures = figuresForLesson('kbl-math-s1-nccd-u1_l1');
    assert.ok(figures.length > 0, 'the lesson has figures');
    assert.ok(figures.some(f => f.file === 'p021.png'));
    assert.ok(figures.every(f => f.sourceId === 'math-s1-student-book'));
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
    // Financial literacy, whose book is not in the repo at all — so this stays
    // empty for a structural reason rather than an incidental one. It used to
    // be a chemistry lesson, picked when that book yielded five figures; it now
    // yields 68 and that lesson has eleven, which made the example wrong
    // without making the behaviour wrong.
    assert.deepEqual(figuresForLesson('kbl-finlit-s1-nccd-u1_l1'), []);
    assert.deepEqual(figuresForLesson('no-such-lesson'), []);
    assert.deepEqual(figuresForLesson(null), []);
    assert.deepEqual(figuresForLesson(undefined), []);
  });

  it("draws each lesson's figures from its own subject and semester's book", () => {
    // The invariant the source ids were violating: Grade 10 maths puts units
    // 1-4 in semester 1 and 5-8 in semester 2, so a `kbl-math-s1-…` lesson can
    // only be illustrated by the semester-1 maths book.
    //
    // This was false for all 54 maths figures, because the ids came from PDF
    // filenames that are backwards. Nothing failed — the figures were on the
    // right lessons and only the book label was wrong, which is why it
    // shipped. Hence a test rather than a comment.
    for (const id of lessonsWithFigures()) {
      const m = /^kbl-(math|chem)-(s[12])-/.exec(id);
      assert.ok(m, `${id} has a subject and semester`);
      const expected = `${m![1]}-${m![2]}-student-book`;
      for (const f of figuresForLesson(id)) {
        assert.equal(f.sourceId, expected, `${id} is illustrated from ${f.sourceId}`);
      }
    }
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

  it('places the chemistry figures its book does carry', () => {
    // Chemistry yielded no outline at all until the opener detector learned
    // its layout, so these four figures existed but nothing could ask for
    // them. Joined on the Arabic title, which matches the curriculum's word
    // for word — the book states no English lesson title on its openers.
    const wave = figuresForLesson('kbl-chem-s1-nccd-u1_l2');
    assert.ok(wave.some(f => f.file === 'p024.png'), 'the wave-model figure');
    assert.ok(wave.every(f => f.sourceId === 'chem-s1-student-book'));
    // Counts are asserted as "some", not as a number. They were 2 and 1 when
    // the extractor only found figures seeded on a pair of axes; teaching the
    // seed to follow curve clusters took chemistry from 5 figures to 68, and a
    // pinned count here would have to be edited every time extraction improves
    // — which makes it a changelog, not a guard. What must stay true is that
    // the lesson resolves to figures, and to figures from its own book.
    for (const id of ['kbl-chem-s1-nccd-u2_l2', 'kbl-chem-s1-nccd-u3_l2']) {
      const figs = figuresForLesson(id);
      assert.ok(figs.length > 0, `${id} lost its figures`);
      assert.ok(figs.every(f => f.sourceId === 'chem-s1-student-book'), id);
    }
  });

  it('carries the page number, so any figure can be checked against the book', () => {
    for (const id of lessonsWithFigures()) {
      for (const f of figuresForLesson(id)) {
        assert.ok(Number.isInteger(f.pdfPage) && f.pdfPage > 0, `${f.file} has a page`);
        // `p035.png`, and `p035b.png` for the second figure on a page. One
        // page routinely prints four or five independent diagrams down the
        // margin; before the extractor could yield more than one per page,
        // the bare form was the only shape a filename could take.
        assert.match(f.file, /^p\d{3}[a-z]?\.png$/);
      }
    }
  });
});

describe('figurePath', () => {
  it('points at the file inside its book directory', () => {
    const [figure] = figuresForLesson('kbl-math-s1-nccd-u1_l1');
    assert.equal(
      figurePath(figure!),
      `knowledge-base/grade-10-math/figures/math-s1-student-book/${figure!.file}`,
    );
  });
});
