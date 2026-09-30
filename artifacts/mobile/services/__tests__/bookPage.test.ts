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

  it('only names lessons the figure map knows', () => {
    const known = new Set(lessonsWithFigures());
    for (const id of Object.keys(lessons)) assert.ok(known.has(id), id);
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
