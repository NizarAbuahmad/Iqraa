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
import { BOOK_PAGES_BASE_URL, bookPagesForLesson, lessonsWithFigures } from '../bookFigures.ts';
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

  it('gives nothing for a lesson without pages, or no lesson', () => {
    const without = lessonsWithFigures().find(id => !lessons[id]);
    assert.ok(without, 'some lesson has figures but no pages');
    assert.equal(bookPagesForLesson(without), null);
    assert.equal(bookPagesForLesson('kbl-does-not-exist'), null);
    assert.equal(bookPagesForLesson(undefined), null);
  });
});
