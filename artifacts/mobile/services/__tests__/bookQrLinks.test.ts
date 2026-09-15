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
import QR_LINKS from '../../../../knowledge-base/book-qr-links.json' with { type: 'json' };

type RawEntry = { workingUrl?: string; httpStatus?: string | number; kind?: string };

import {
  gradesWithQrResources,
  qrResourceCountForGrade,
  qrResourcesForGrade,
  type QrResource,
} from '../bookQrLinks.ts';

const allRows = (): QrResource[] =>
  gradesWithQrResources().flatMap(g => qrResourcesForGrade(g).flatMap(b => b.resources));

describe('the reachable rows', () => {
  it('keeps exactly what answered when last checked', () => {
    // Derived, not pinned to a number. This used to assert 169 — the count on
    // 2026-09-12 — and by 2026-09-15 `qr.nccd.gov.jo` refused every connection
    // and the real figure was 18. A literal here turns a re-probe into a broken
    // build, and worse, it made a screen full of dead links look tested.
    // `verify-qr-links.ts` rewrites the statuses; this asserts the filter still
    // agrees with them, which is the part that can actually regress.
    const reachable = (QR_LINKS as { entries: RawEntry[] }).entries.filter(
      e => e.workingUrl && ['200', '206'].includes(String(e.httpStatus)),
    ).length;
    assert.equal(allRows().length, reachable);
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

  it('derives audio from the extension, not the declared kind', () => {
    // Every `.mp3` in the manifest is declared `kind: "page"`, so reading the
    // declared kind reports zero audio and nothing looks broken. Asserted
    // against the manifest rather than a count, because whether any audio is
    // *reachable* now depends on the ministry host being up, and that is not
    // something a unit test should have an opinion about.
    for (const r of allRows()) {
      if (/\.(mp3|m4a|wav)$/i.test(r.url)) assert.equal(r.kind, 'audio', r.url);
      if (r.kind === 'audio') assert.match(r.url, /\.(mp3|m4a|wav)$/i);
    }
    const declaredPageButAudio = (QR_LINKS as { entries: RawEntry[] }).entries.filter(
      e => e.kind === 'page' && /\.mp3$/i.test(String(e.workingUrl ?? '')),
    );
    assert.ok(declaredPageButAudio.length >= 20, 'the mis-filed audio rows are gone from the manifest');
  });

  it('keeps a kind the extension cannot tell it', () => {
    // Three rows are declared `video` and their url has no extension at all,
    // so deriving from the extension alone would file them as pages.
    assert.ok(allRows().filter(r => r.kind === 'video' && !/\.\w{2,4}$/.test(r.url)).length >= 3);
  });
});

describe('grouping', () => {
  it('covers only the grades that have a reachable code', () => {
    // Derived rather than pinned. The books print codes for grades 9 and 10
    // only — but whether either has a *reachable* one depends on the ministry
    // host, which went down between 2026-09-12 and 2026-09-15 and took 151 of
    // the 169 rows with it. Grades 6-8 have none either way, which is why the
    // library entry hides itself rather than opening onto an empty screen.
    const reachable = (QR_LINKS as { entries: (RawEntry & { gradeId?: string })[] }).entries
      .filter(e => e.workingUrl && ['200', '206'].includes(String(e.httpStatus)));
    const grades = [...new Set(reachable.map(e => e.gradeId))].sort();
    assert.deepEqual(gradesWithQrResources(), grades);
    for (const g of grades) {
      assert.equal(
        qrResourceCountForGrade(g!),
        reachable.filter(e => e.gradeId === g).length,
      );
    }
    assert.equal(qrResourceCountForGrade('grade-8'), 0);
  });

  it('can group a book whose subject has no catalog book at all', () => {
    // `creative-arts` and `physical-education` carry 16 rows between them and
    // neither has a book in the catalog, so grouping on a catalog `Book` drops
    // them silently. Asserted against the manifest and the alias map, not
    // against live rows: all 16 are on the ministry host and none is reachable
    // today, so a presence test here would pass or fail on the weather.
    const raw = (QR_LINKS as { entries: (RawEntry & { subjectId?: string })[] }).entries;
    for (const subjectId of ['art', 'pe']) {
      assert.ok(raw.some(e => e.subjectId === subjectId), `${subjectId} is gone from the manifest`);
    }
    // And when one *is* reachable, it must arrive under its catalog id.
    for (const grade of gradesWithQrResources()) {
      for (const book of qrResourcesForGrade(grade)) {
        assert.ok(!['art', 'pe', 'civic', 'math'].includes(book.subjectId), book.subjectId);
      }
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
