/**
 * The source manifest — the record of which PDF each piece of curriculum data
 * came from.
 *
 * These tests guard the properties that make the manifest worth keeping: ids
 * that can be cited, pointers that resolve, and — the one that matters —
 * conflicts and duplicates staying out of anything an extraction run would
 * iterate.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  CAPTURED_AT,
  FOLDERS,
  G10_SOURCES,
  conflicts,
  driveUrl,
  getSource,
  pendingSources,
  usableSources,
} from '../sources.ts';

describe('manifest integrity', () => {
  it('gives every source a unique id and a Drive id', () => {
    const ids = new Set<string>();
    const driveIds = new Set<string>();
    for (const s of G10_SOURCES) {
      assert.ok(s.id.length > 0, 'empty id');
      assert.ok(!ids.has(s.id), `duplicate id: ${s.id}`);
      assert.ok(!driveIds.has(s.driveId), `same Drive file listed twice: ${s.title}`);
      assert.ok(s.bytes > 0, `${s.id} has no size`);
      ids.add(s.id);
      driveIds.add(s.driveId);
    }
  });

  it('resolves every duplicateOf / conflictWith pointer', () => {
    for (const s of G10_SOURCES) {
      if (s.duplicateOf) assert.ok(getSource(s.duplicateOf), `${s.id} points at missing ${s.duplicateOf}`);
      if (s.conflictWith) assert.ok(getSource(s.conflictWith), `${s.id} points at missing ${s.conflictWith}`);
    }
  });

  it('makes a status of duplicate or conflict carry its pointer', () => {
    // A 'duplicate' with nothing to point at is just an entry someone gave up
    // on, and it would be filtered out of extraction for no stated reason.
    for (const s of G10_SOURCES) {
      if (s.status === 'duplicate') assert.ok(s.duplicateOf, `${s.id} is a duplicate of nothing`);
      if (s.status === 'conflict') assert.ok(s.conflictWith, `${s.id} conflicts with nothing`);
    }
  });

  it('records when the listing was taken', () => {
    assert.match(CAPTURED_AT, /^\d{4}-\d{2}-\d{2}$/);
    assert.ok(Object.keys(FOLDERS).length > 0);
  });

  it('builds a Drive URL from the file id', () => {
    const s = G10_SOURCES[0]!;
    assert.equal(driveUrl(s), `https://drive.google.com/file/d/${s.driveId}/view`);
  });
});

describe('usableSources', () => {
  it('never hands an extraction run a duplicate or a contested edition', () => {
    // The whole point of the manifest: mining the wrong edition has to be a
    // deliberate act, not a forgotten filter.
    for (const s of usableSources()) {
      assert.notEqual(s.status, 'duplicate');
      assert.notEqual(s.status, 'conflict');
    }
  });

  it('filters by subject, semester and authority', () => {
    for (const s of usableSources({ subject: 'chemistry' })) assert.equal(s.subject, 'chemistry');
    for (const s of usableSources({ semester: 2 })) assert.equal(s.semester, 2);
    for (const s of usableSources({ authority: 'nccd' })) assert.equal(s.authority, 'nccd');
  });

  it('still has an official book for every subject', () => {
    for (const subject of ['math', 'chemistry', 'financial-literacy'] as const) {
      const books = usableSources({ subject, authority: 'nccd' })
        .filter(s => s.kind === 'student-book');
      assert.ok(books.length > 0, `no usable student book for ${subject}`);
    }
  });
});

describe('what the manifest says about the backlog', () => {
  it('names the known edition conflicts rather than hiding them', () => {
    const ids = conflicts().map(c => c.id);
    // Financial literacy is the one that already cost us: the catalog's S1 data
    // and the S2 book on file are different editions of the course.
    assert.ok(ids.includes('finlit-s2-student-book'));
  });

  it('records chemistry S2 as mined, and says what came out of each file', () => {
    // This was the coverage gap: a student book, a teacher guide and an
    // activity book on file with no catalog entry at all. Closed 2026-08-24.
    // Asserting on the entries rather than their absence keeps the deletion
    // guard: a hidden gap and a closed one must not look the same here.
    for (const id of ['chem-s2-student-book', 'chem-s2-teacher-guide']) {
      const source = getSource(id);
      assert.ok(source, `${id} missing from the manifest`);
      assert.equal(source!.status, 'ingested');
      assert.ok(source!.notes, `${id} claims to be ingested but says nothing about what came out of it`);
    }
  });

  it('still has a backlog, and every entry in it is a real file', () => {
    const pending = pendingSources();
    assert.ok(pending.length > 0, 'nothing left to mine — suspicious, check the statuses');
    for (const s of pending) assert.ok(s.driveId.length > 0);
  });
});
