/**
 * bookPageForLesson — the lesson's page in the book's public PDF.
 *
 * Asserts invariants over the REAL data rather than a snapshot of which books
 * passed, because `scripts/verify_book_pages.py` rewrites that list whenever
 * NCCD re-issues a book.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import pageLinks from '../../../../knowledge-base/book-page-links.json' with { type: 'json' };
import { bookPageForLesson, figuresForLesson, lessonsWithFigures } from '../bookFigures.ts';

const books = (pageLinks as { books: Record<string, { pdfUrl: string; pages: number }> }).books;

describe('bookPageForLesson', () => {
  it('only ever links a verified book, at a page that book has', () => {
    let linked = 0;
    for (const lessonId of lessonsWithFigures()) {
      const link = bookPageForLesson(lessonId);
      if (!link) continue;
      linked++;
      const book = Object.values(books).find(b => b.pdfUrl === link.pdfUrl);
      assert.ok(book, `${lessonId} links an unverified PDF`);
      assert.ok(link.page >= 1 && link.page <= book.pages, `${lessonId} page ${link.page} of ${book.pages}`);
    }
    assert.ok(linked > 0, 'at least one lesson has a book page');
  });

  it('opens at the earliest start among the lesson\'s book lessons', () => {
    for (const lessonId of lessonsWithFigures()) {
      const link = bookPageForLesson(lessonId);
      if (!link) continue;
      const starts = figuresForLesson(lessonId)
        .filter(f => books[f.sourceId] && f.lessonStartPage)
        .map(f => f.lessonStartPage!);
      assert.equal(link.page, Math.min(...starts), lessonId);
    }
  });

  it('gives no link for a lesson from a book nobody verified', () => {
    const unverified = lessonsWithFigures().find(id => figuresForLesson(id).every(f => !books[f.sourceId]));
    assert.ok(unverified, 'some lesson comes from an unverified book');
    assert.equal(bookPageForLesson(unverified), null);
  });

  it('gives no link for an unknown or missing lesson', () => {
    assert.equal(bookPageForLesson('kbl-does-not-exist'), null);
    assert.equal(bookPageForLesson(undefined), null);
  });
});
