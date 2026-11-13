/**
 * bookPagesForLesson — the lesson's pages of the student book.
 *
 * Asserts invariants over the REAL data rather than a snapshot of which books
 * passed, because `scripts/verify_book_pages.py` rewrites that list whenever
 * NCCD re-issues a book.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { readdirSync, readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import pageLinks from '../../../../knowledge-base/book-page-links.json' with { type: 'json' };
import figureMap from '../../../../knowledge-base/figure-lesson-map.json' with { type: 'json' };
import { BOOK_PAGES_BASE_URL, bookPagesForLesson, lessonsWithFigures, type BookPageLink } from '../bookFigures.ts';
import { KB_BOOKS, KB_LESSONS, KB_UNITS } from '../knowledgeBase.ts';

const { books, lessons } = pageLinks as {
  books: Record<string, { pages: number }>;
  lessons: Record<string, { sourceId: string; startPage: number; endPage: number; aspect: number }>;
};

/** Every committed figure index (`knowledge-base/<book>/figures/<sourceId>/index.json`), as the scripts read them. */
const KB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../knowledge-base');
const figureIndexes: Array<{ sourceId: string; figures: Array<{ unit: number | null; lesson: number | null; lessonStartPage?: number | null }> }> =
  readdirSync(KB_DIR).flatMap(book => {
    const dir = path.join(KB_DIR, book, 'figures');
    if (!existsSync(dir)) return [];
    return readdirSync(dir)
      .map(source => path.join(dir, source, 'index.json'))
      .filter(existsSync)
      .map(file => JSON.parse(readFileSync(file, 'utf8')));
  });

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

  it("no lesson's pages run past the start of another lesson the figures place", () => {
    // Grade 3 science S2 u4_l2 ran 17 pages into the Earth lesson, and grade 8
    // vocational u1_l1 four pages into u1_l2: a range that swallows a lesson start
    // the figure extractor read off the book shows the class the wrong lesson.
    const kbOf = new Map(figureMap.entries.map(e => [`${e.sourceId}|${e.unit}|${e.lesson}`, e.kbLessonId]));
    const starts: Array<{ sourceId: string; page: number; kb: string }> = [];
    for (const index of figureIndexes) {
      for (const f of index.figures) {
        const kb = kbOf.get(`${index.sourceId}|${f.unit}|${f.lesson}`);
        if (f.lessonStartPage && kb) starts.push({ sourceId: index.sourceId, page: f.lessonStartPage, kb });
      }
    }
    assert.ok(starts.length > 100, `only ${starts.length} lesson starts read`);
    const bad = new Set<string>();
    for (const [id, l] of Object.entries(lessons)) {
      for (const s of starts) {
        if (s.sourceId === l.sourceId && s.kb !== id && l.startPage < s.page && s.page <= l.endPage) {
          bad.add(`${id} p${l.startPage}-${l.endPage} contains the start of ${s.kb} (p${s.page})`);
        }
      }
    }
    assert.deepEqual([...bad], []);
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
