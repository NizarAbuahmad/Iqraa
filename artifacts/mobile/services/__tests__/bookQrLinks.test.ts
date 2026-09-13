/**
 * The book's printed QR resources.
 *
 * Two of these asserts exist because the data was wrong in a way that read as
 * working: every `.mp3` is declared `kind: "page"`, and four `subjectId` values
 * are not catalog subject ids. Neither would have thrown, crashed or logged —
 * the audio would have been filed as web pages and four subjects would have
 * rendered a blank name, and both would have looked like a styling problem.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SUBJECTS } from '@workspace/curriculum';

import {
  gradesWithQrResources,
  qrResourceCountForGrade,
  qrResourcesForGrade,
  type QrResource,
} from '../bookQrLinks.ts';

const allRows = (): QrResource[] =>
  gradesWithQrResources().flatMap(g => qrResourcesForGrade(g).flatMap(b => b.resources));

describe('the reachable rows', () => {
  it('keeps only what answered when last checked', () => {
    // 186 decoded, 17 unreachable (12 x 404, 2 x 403, 3 no answer).
    assert.equal(allRows().length, 169);
  });

  it('offers every url with a scheme', () => {
    // 12 `workingUrl` values are bare hosts. `window.open` reads one of those
    // as a relative path and navigates inside our own app, losing whatever the
    // student had open — a failure that looks like a broken link, not a bug.
    for (const r of allRows()) {
      assert.match(r.url, /^https?:\/\//, `${r.url} has no scheme`);
    }
  });

  it('names a real subject on every book', () => {
    // `art`, `civic`, `pe` and `math` are not catalog ids. Note the alias table
    // is spelled out rather than matched: a substring test for `art` resolves
    // to `earth-science`.
    const ids = new Set(SUBJECTS.map(s => s.id));
    for (const grade of gradesWithQrResources()) {
      for (const book of qrResourcesForGrade(grade)) {
        assert.ok(ids.has(book.subjectId), `${book.subjectId} is not a catalog subject`);
      }
    }
  });

  it('finds the audio the manifest calls a web page', () => {
    // The whole curriculum audio inventory: 4 grade-10 English, 9 grade-9
    // English, 7 grade-10 music. Every one declared `kind: "page"`, so reading
    // the declared kind would report zero and nothing would look broken.
    const audio = allRows().filter(r => r.kind === 'audio');
    assert.equal(audio.length, 20);
    for (const r of audio) assert.match(r.url, /\.(mp3|m4a|wav)$/i);
  });

  it('keeps a kind the extension cannot tell it', () => {
    // Three rows are declared `video` and their url has no extension at all,
    // so deriving from the extension alone would file them as pages.
    assert.ok(allRows().filter(r => r.kind === 'video' && !/\.\w{2,4}$/.test(r.url)).length >= 3);
  });
});

describe('grouping', () => {
  it('covers only the grades the ministry printed codes in', () => {
    // Grades 6, 7 and 8 have none, which is why the library entry hides itself
    // rather than opening onto an empty screen.
    assert.deepEqual(gradesWithQrResources(), ['grade-10', 'grade-9']);
    assert.equal(qrResourceCountForGrade('grade-10'), 97);
    assert.equal(qrResourceCountForGrade('grade-9'), 72);
    assert.equal(qrResourceCountForGrade('grade-8'), 0);
  });

  it('keeps the books whose subject has no catalog book at all', () => {
    // `creative-arts` and `physical-education` carry 16 rows between them,
    // including 7 of the 20 audio files, and neither has a book in the
    // catalog — so grouping on a catalog `Book` would drop them silently.
    const g10 = qrResourcesForGrade('grade-10');
    for (const subjectId of ['creative-arts', 'physical-education']) {
      assert.ok(
        g10.some(b => b.subjectId === subjectId),
        `${subjectId} has rows but no book group`,
      );
    }
  });

  it('titles every book and orders its rows by printed page', () => {
    for (const grade of gradesWithQrResources()) {
      for (const book of qrResourcesForGrade(grade)) {
        assert.ok(book.title.trim().length > 0, 'a book group has no title');
        assert.ok(!book.title.endsWith('.pdf'), `${book.title} still carries its extension`);
        const pages = book.resources.map(r => r.pdfPage);
        assert.deepEqual(pages, [...pages].sort((a, b) => a - b), `${book.title} is unordered`);
      }
    }
  });

  it('returns nothing for an unknown or empty grade', () => {
    assert.deepEqual(qrResourcesForGrade(''), []);
    assert.deepEqual(qrResourcesForGrade('grade-99'), []);
  });
});
