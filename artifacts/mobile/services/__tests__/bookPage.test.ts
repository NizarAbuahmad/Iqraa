/**
 * bookPagesForLesson — the lesson's pages of the student book.
 *
 * Asserts invariants over the REAL data rather than a snapshot of which books
 * passed, because `scripts/verify_book_pages.py` rewrites that list whenever
 * NCCD re-issues a book.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import pageLinks from '../../../../knowledge-base/book-page-links.json' with { type: 'json' };
import { BOOK_PAGES_BASE_URL, bookPagesForLesson, lessonsWithFigures, type BookPageLink } from '../bookFigures.ts';
import { KB_BOOKS, KB_LESSONS, KB_UNITS } from '../knowledgeBase.ts';

const { books, lessons } = pageLinks as {
  books: Record<string, { pages: number }>;
  lessons: Record<string, { sourceId: string; startPage: number; endPage: number; aspect: number }>;
};

describe('book-page-links.json', () => {
  it('lists at least one lesson', () => {
    assert.ok(Object.keys(lessons).length > 0);
  });

  it('only cuts verified books, inside their pages, at most 20 pages long', () => {
    for (const [id, l] of Object.entries(lessons)) {
      const book = books[l.sourceId];
      assert.ok(book, `${id} is cut from an unverified book`);
      assert.ok(l.startPage >= 1 && l.startPage <= l.endPage && l.endPage <= book.pages, id);
      assert.ok(l.endPage - l.startPage < 20, `${id} is ${l.endPage - l.startPage + 1} pages`);
    }
  });

  it('a corrected range reads only pages its folder actually holds', () => {
    // `rendered` points a lesson at images cut for another range. Each folder
    // was cut as one contiguous run of pages, so the lesson's pages must sit
    // inside that run, in a folder named after a real lesson.
    const known = new Set(KB_LESSONS.map(l => l.id));
    for (const [id, l] of Object.entries(lessons as Record<string, BookPageLink>)) {
      const r = l.rendered;
      if (!r) continue;
      // `<lesson>-vN`: a re-render that could not reuse the lesson's own folder (render_lesson_pages.py, target_dir)
      assert.ok(known.has(r.dir.replace(/-v\d+$/, '')), `${id} reads from unknown folder ${r.dir}`);
      assert.ok(r.startPage <= l.startPage && l.endPage <= r.endPage,
        `${id} (${l.startPage}-${l.endPage}) is outside ${r.dir}'s pages (${r.startPage}-${r.endPage})`);
      assert.ok(r.endPage - r.startPage < 20, `${r.dir} cannot hold ${r.endPage - r.startPage + 1} pages`);
    }
  });

  it('a folder another lesson reads from says the same pages everywhere', () => {
    // Two entries naming one folder must agree on which pages it holds, and
    // a folder still used by its own lesson (no `rendered`) holds that
    // lesson's range — so one image index never means two pages.
    const holds = new Map<string, string>();
    for (const [id, l] of Object.entries(lessons as Record<string, BookPageLink>)) {
      const dir = l.rendered?.dir ?? id;
      const span = `${l.sourceId}:${l.rendered?.startPage ?? l.startPage}`;
      const prev = holds.get(dir);
      assert.ok(prev === undefined || prev === span, `${dir} is read as ${prev} and as ${span}`);
      holds.set(dir, span);
    }
  });

  it('only names lessons the curriculum knows', () => {
    const known = new Set(KB_LESSONS.map(l => l.id));
    for (const id of Object.keys(lessons)) assert.ok(known.has(id), id);
  });

  it('a lesson rendered from our own copy sits in the book of its own grade, subject and semester', () => {
    // These lessons were placed by title, so the cheapest way for one to go wrong is
    // to be filed under another book (grade 9 Arabic semester 1 for a semester 2 lesson).
    const SUBJECT: Record<string, string> = {
      arabic: 'arabic', islamic: 'islamic', pe: 'physical-education',
      digital: 'digital-literacy', 'digital-literacy': 'digital-literacy', civic: 'civic-education',
    };
    const unitBook = new Map(KB_UNITS.map(u => [u.id, u.bookId]));
    const bookOf = new Map(KB_BOOKS.map(b => [b.id, b]));
    let checked = 0;
    for (const [id, l] of Object.entries(lessons)) {
      const m = l.sourceId.match(/^(?:g(\d+)-)?(.+)-s([12])-student-book$/);
      const subject = m && SUBJECT[m[2]!];
      if (!m || !subject) continue; // a figure-backed book: covered by the figure map
      const kb = KB_LESSONS.find(x => x.id === id)!;
      const book = bookOf.get(unitBook.get(kb.unitId)!)!;
      assert.deepEqual(
        [book.gradeId, book.subjectId, book.semester],
        [`grade-${m[1] ?? 10}`, subject, Number(m[3])],
        `${id} is filed under ${l.sourceId}`,
      );
      checked++;
    }
    assert.ok(checked > 0, 'no lessons from the page-only subjects to check');
  });

  it('a book without a live copy (pdfUrl null) was rendered from ours, and says so', () => {
    for (const [id, book] of Object.entries(books as Record<string, { pdfUrl?: string | null; source?: string }>)) {
      if (book.pdfUrl === null) assert.ok(book.source, `${id} has no pdfUrl and no source`);
    }
  });
});

describe('Grade 1 Arabic semester 2 pages (audit 2026-11-13)', () => {
  // The mapper matched «أستمع بانتباه وتركيز» by title, which repeats in every
  // unit, and filed unit 7's speaking lesson under unit 6 and units 8-10 under
  // unit 7. Each page was read by eye; these pin where the right images sit.
  const A = 'kbl-g1-arabic-s2-nccd-';
  it('unit 8 reads its own pages from the folders they were cut into', () => {
    const p = bookPagesForLesson(`${A}u8_l1`)!;
    assert.equal(p.page, 74);
    assert.equal(p.urls[0], `${BOOK_PAGES_BASE_URL}/${A}u7_l1/1.jpg`);
    assert.equal(bookPagesForLesson(`${A}u7_l2`)!.urls[0], `${BOOK_PAGES_BASE_URL}/${A}u6_l2/1.jpg`);
  });

  it('a unit 7 lesson whose pages were never cut shows none, not unit 8 or 9', () => {
    for (const l of ['u7_l1', 'u7_l3', 'u7_l4', 'u7_l5', 'u7_l6']) assert.equal(bookPagesForLesson(`${A}${l}`), null, l);
  });
});

describe('Grade 3 Arabic semester 2 and maths pages (audit 2026-11-13)', () => {
  // Every Arabic S2 lesson was cut one lesson early (its folder opens on the
  // lesson BEFORE it), the same fault as Grade 6 Arabic. Read by eye.
  const A = 'kbl-g3-arabic-s2-nccd-';
  it('each Arabic S2 lesson reads the folder that opens on it', () => {
    assert.equal(bookPagesForLesson(`${A}u6_l1`)!.urls[0], `${BOOK_PAGES_BASE_URL}/${A}u6_l2/1.jpg`);
    assert.equal(bookPagesForLesson(`${A}u9_l5`)!.urls[0], `${BOOK_PAGES_BASE_URL}/${A}u10_l1/1.jpg`);
    // unit 10's last folder holds lesson 4 (p. 115) and lesson 5 (p. 120)
    assert.equal(bookPagesForLesson(`${A}u10_l4`)!.page, 115);
    assert.equal(bookPagesForLesson(`${A}u10_l5`)!.urls[0], `${BOOK_PAGES_BASE_URL}/${A}u10_l5/6.jpg`);
  });

  it('a maths lesson opens on its own page of the unit folder, not the unit cover', () => {
    const M = 'kbl-g3-math-s2-nccd-';
    // the folder named after u9_l3 opens on the unit 9 cover (p. 42); lesson 3 is p. 48
    assert.equal(bookPagesForLesson(`${M}u9_l3`)!.page, 48);
    assert.equal(bookPagesForLesson(`${M}u9_l3`)!.urls[0], `${BOOK_PAGES_BASE_URL}/${M}u9_l3/7.jpg`);
    assert.equal(bookPagesForLesson(`${M}u8_l1`)!.page, 26);
  });
});

describe('Grade 5 pages (audit 2026-11-13)', () => {
  // Set by the Grade 5 audit (read as images) and confirmed independently from
  // the books' own page text (lesson openers, «اختبار نهاية الوحدة», unit openers).
  const G = 'kbl-g5-';
  const at = (id: string, i: number) => bookPagesForLesson(`${G}${id}`)!.urls[i];
  it('social studies lessons read their own pages, not the next unit\'s', () => {
    // «الملك وصلاحياته الدستورية» opened on p. 40, the middle of «السلطة التنفيذية»
    const king = bookPagesForLesson(`${G}social-s1-nccd-u2_l1`)!;
    assert.equal(king.page, 30);
    assert.equal(king.urls[0], `${BOOK_PAGES_BASE_URL}/${G}social-s1-nccd-u1_l3/9.jpg`);
    assert.equal(at('social-s1-nccd-u3_l1', 0), `${BOOK_PAGES_BASE_URL}/${G}social-s1-nccd-u2_l1/11.jpg`);
    assert.equal(bookPagesForLesson(`${G}social-s2-nccd-u6_l1`)!.page, 28);
    assert.equal(bookPagesForLesson(`${G}social-s2-nccd-u8_l2`)!.page, 87);
  });
  it('«السرعة» shows no pages: its folder holds the body-systems lessons', () => {
    assert.equal(bookPagesForLesson(`${G}science-s2-nccd-u9_l1`), null);
    assert.equal(at('science-s2-nccd-u7_l2', 0), `${BOOK_PAGES_BASE_URL}/${G}science-s2-nccd-u9_l1/2.jpg`);
    assert.equal(bookPagesForLesson(`${G}science-s2-nccd-u7_l3`)!.page, 36);
  });
  it('a maths lesson stops before the unit test, and lesson 2 of unit 4 has its pages', () => {
    assert.equal(lessons[`${G}math-s1-nccd-u2_l5`]!.endPage, 49); // p. 50 is «اختبار نهاية الوحدة»
    assert.equal(lessons[`${G}math-s1-nccd-u4_l1`]!.endPage, 79); // p. 80 is u4_l2's «نشاط مفاهيمي»
    assert.equal(at('math-s1-nccd-u4_l2', 0), `${BOOK_PAGES_BASE_URL}/${G}math-s1-nccd-u4_l1/6.jpg`);
  });
  it('an Arabic unit\'s last lesson stops before «حصاد الوحدة» and the next unit\'s cover', () => {
    assert.equal(lessons[`${G}arabic-s1-nccd-u1_l5`]!.endPage, 28);
    assert.equal(lessons[`${G}arabic-s2-nccd-u10_l5`]!.endPage, 133);
  });
});

describe('bookPagesForLesson', () => {
  it('lists one image per page of the lesson, numbered from 1', () => {
    const [id, entry] = Object.entries(lessons)[0]!;
    const pages = bookPagesForLesson(id)!;
    assert.equal(pages.urls.length, entry.endPage - entry.startPage + 1);
    assert.equal(pages.urls[0], `${BOOK_PAGES_BASE_URL}/${id}/1.jpg`);
    assert.equal(pages.urls.at(-1), `${BOOK_PAGES_BASE_URL}/${id}/${pages.urls.length}.jpg`);
    assert.equal(pages.page, entry.startPage);
    assert.ok(pages.aspect > 0.5 && pages.aspect < 1, 'a portrait page');
  });

  it('reads a corrected range from the folder that holds its pages', () => {
    const entry = Object.entries(lessons as Record<string, BookPageLink>).find(([, l]) => l.rendered);
    assert.ok(entry, 'no corrected range to check');
    const [id, l] = entry;
    const r = l.rendered!;
    const pages = bookPagesForLesson(id)!;
    assert.equal(pages.page, l.startPage);
    assert.equal(pages.urls.length, l.endPage - l.startPage + 1);
    assert.equal(pages.urls[0], `${BOOK_PAGES_BASE_URL}/${r.dir}/${l.startPage - r.startPage + 1}.jpg`);
    assert.equal(pages.urls.at(-1), `${BOOK_PAGES_BASE_URL}/${r.dir}/${l.endPage - r.startPage + 1}.jpg`);
  });

  it('gives nothing for a lesson without pages, or no lesson', () => {
    const without = lessonsWithFigures().find(id => !lessons[id]);
    assert.ok(without, 'some lesson has figures but no pages');
    assert.equal(bookPagesForLesson(without), null);
    assert.equal(bookPagesForLesson('kbl-does-not-exist'), null);
    assert.equal(bookPagesForLesson(undefined), null);
  });
});
