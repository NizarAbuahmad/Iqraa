/**
 * Book-figure notes: the reader returns only what a teacher approved, and the
 * shipped notes files obey the rules a slide depends on.
 *
 * Run (from artifacts/mobile):
 *   node --import ./scripts/registerTestAlias.mjs --experimental-strip-types --test \
 *     services/__tests__/bookFigureNotes.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  NOTE_CAPTION_MAX,
  NOTES_BOOKS,
  NOTES_FILES,
  figureNoteReader,
  noteFileProblems,
  type NoteEntry,
  type NotesFile,
} from '../bookFigureNotes.ts';
import type { BookFigure } from '../bookFigures.ts';
import physS1 from '../../../../knowledge-base/grade-10-physics/figures/phys-s1-student-book/index.json' with { type: 'json' };
import physS2 from '../../../../knowledge-base/grade-10-physics/figures/phys-s2-student-book/index.json' with { type: 'json' };

const INDEX: Record<string, string[]> = {
  'phys-s1-student-book': (physS1 as { figures: { file: string }[] }).figures.map(f => f.file),
  'phys-s2-student-book': (physS2 as { figures: { file: string }[] }).figures.map(f => f.file),
};

const fig = (file: string, sourceId = 'phys-s1-student-book'): BookFigure =>
  ({ file, sourceId, pdfPage: 11, unit: 1, lesson: 1, lessonTitleEn: null });

const approved = (tag: string): NoteEntry => ({
  status: 'approved',
  ar: { caption: `شرح ${tag}`, teacher: `ملاحظة ${tag}` },
  en: { caption: `Caption ${tag}`, teacher: `Note ${tag}` },
  reviewedBy: 'معلم الفيزياء',
  reviewedAt: '2026-12-01',
});

const FILE: NotesFile = {
  sourceId: 'phys-s1-student-book',
  notes: {
    'p011.png': approved('a'),
    'p012.png': { ...approved('b'), status: 'draft' },
    'p013-v2.png': { ...approved('c'), status: 'needs-fix', comment: 'أعد الصياغة' },
    'p015.png': { status: 'skip', skipReason: 'صورة زخرفية' },
  },
};

describe('figureNoteReader', () => {
  const read = figureNoteReader([FILE]);

  it('returns an approved note in the language asked for', () => {
    assert.deepEqual(read(fig('p011.png'), true), { caption: 'شرح a', teacher: 'ملاحظة a' });
    assert.deepEqual(read(fig('p011.png'), false), { caption: 'Caption a', teacher: 'Note a' });
  });

  it('returns nothing for a draft, a note that needs a fix, or a skip', () => {
    assert.equal(read(fig('p012.png'), true), null);
    assert.equal(read(fig('p013-v2.png'), true), null);
    assert.equal(read(fig('p015.png'), true), null);
  });

  it('returns nothing for a figure with no entry, or from another book', () => {
    assert.equal(read(fig('p099.png'), true), null);
    // Same file name, other book: notes are per book, never matched by name alone.
    assert.equal(read(fig('p011.png', 'phys-s2-student-book'), true), null);
    assert.equal(read(fig('p011.png', 'chem-s1-student-book'), true), null);
  });

  it('returns nothing for an approved entry whose language is empty', () => {
    const half = figureNoteReader([{ sourceId: 'phys-s1-student-book', notes: {
      'p011.png': { ...approved('a'), en: { caption: '', teacher: 'x' } },
    } }]);
    assert.equal(half(fig('p011.png'), false), null);
    assert.ok(half(fig('p011.png'), true));
  });

  it('does not treat an inherited property name as a figure', () => {
    assert.equal(read(fig('constructor'), true), null);
    assert.equal(read(fig('__proto__'), true), null);
  });
});

describe('noteFileProblems', () => {
  const files = ['p011.png', 'p012.png', 'p013-v2.png', 'p015.png'];

  it('accepts a well-formed file', () => {
    assert.deepEqual(noteFileProblems(FILE, files), []);
  });

  it('flags a key that is not a figure in the book', () => {
    const bad = { ...FILE, notes: { ...FILE.notes, 'p999.png': approved('z') } };
    assert.equal(noteFileProblems(bad, files).length, 1);
    assert.match(noteFileProblems(bad, files)[0]!, /p999\.png/);
  });

  it('flags an unknown status', () => {
    const bad = { ...FILE, notes: { 'p011.png': { ...approved('a'), status: 'ok' as never } } };
    assert.equal(noteFileProblems(bad, files).length, 1);
  });

  it('flags an approved note missing a language, a field, the reviewer or a real day', () => {
    const cases: NoteEntry[] = [
      { ...approved('a'), en: undefined },
      { ...approved('a'), ar: { caption: 'x', teacher: ' ' } },
      { ...approved('a'), reviewedBy: '' },
      { ...approved('a'), reviewedAt: '2026-02-30' },
      { ...approved('a'), reviewedAt: '1/12/2026' },
    ];
    for (const entry of cases) {
      assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': entry } }, files).length > 0, JSON.stringify(entry));
    }
  });

  it('flags an approved note that still carries the drafters\' [تحقّق] / [Check] marker', () => {
    const cases: NoteEntry[] = [
      { ...approved('a'), ar: { caption: 'شرح', teacher: '[تحقق] ملاحظة' } },
      { ...approved('a'), ar: { caption: 'شرح', teacher: '[تحقّق] ملاحظة' } },
      { ...approved('a'), ar: { caption: '[تحقّق] شرح', teacher: 't' } },
      { ...approved('a'), en: { caption: 'Caption', teacher: '[Check] note' } },
      { ...approved('a'), en: { caption: '[ check ] Caption', teacher: 't' } },
    ];
    for (const entry of cases) {
      const p = noteFileProblems({ ...FILE, notes: { 'p011.png': entry } }, files);
      assert.ok(p.some(x => /reviewer marker/.test(x)), JSON.stringify(entry));
    }
  });

  it('lets a draft and a needs-fix note keep the marker', () => {
    const marked = { ar: { caption: 'شرح', teacher: '[تحقّق] ملاحظة' }, en: { caption: 'C', teacher: '[Check] n' } };
    const draft: NoteEntry = { ...approved('a'), ...marked, status: 'draft' };
    const fix: NoteEntry = { ...approved('a'), ...marked, status: 'needs-fix' };
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': draft } }, files), []);
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': fix } }, files), []);
  });

  it('flags a draft with an empty field — drafts go to review complete', () => {
    const draft: NoteEntry = { ...approved('a'), status: 'draft', en: { caption: 'x', teacher: '' } };
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': draft } }, files).length > 0);
  });

  it('lets a needs-fix entry carry whatever the reviewer left', () => {
    const fix: NoteEntry = { status: 'needs-fix', comment: 'خطأ في المصطلح' };
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': fix } }, files), []);
  });

  it('flags a skip with no reason', () => {
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p015.png': { status: 'skip' } } }, files).length > 0);
  });

  it('flags a caption over the limit, counted in characters not bytes', () => {
    const at = 'ب'.repeat(NOTE_CAPTION_MAX);
    const over = 'ب'.repeat(NOTE_CAPTION_MAX + 1);
    const ok = { ...approved('a'), ar: { caption: at, teacher: 't' } };
    const bad = { ...approved('a'), ar: { caption: over, teacher: 't' } };
    assert.deepEqual(noteFileProblems({ ...FILE, notes: { 'p011.png': ok } }, files), []);
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': bad } }, files).length > 0);
  });

  it('flags «في الصورة» and "in the picture" in a caption', () => {
    const ar = { ...approved('a'), ar: { caption: 'نرى في الصورة متجهين', teacher: 't' } };
    const en = { ...approved('a'), en: { caption: 'In the picture, two vectors', teacher: 't' } };
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': ar } }, files).length > 0);
    assert.ok(noteFileProblems({ ...FILE, notes: { 'p011.png': en } }, files).length > 0);
  });
});

describe('the shipped notes files', () => {
  it('are the two Grade 10 physics books, and NOTES_BOOKS names the same two', () => {
    assert.deepEqual(NOTES_FILES.map(f => f.sourceId), ['phys-s1-student-book', 'phys-s2-student-book']);
    assert.deepEqual(NOTES_BOOKS.map(b => b.sourceId), ['phys-s1-student-book', 'phys-s2-student-book']);
    for (const b of NOTES_BOOKS) assert.match(b.dir, new RegExp(`^knowledge-base/grade-10-physics/figures/${b.sourceId}$`));
  });

  it('obey every rule — real keys, valid statuses, complete approvals, short captions', () => {
    for (const file of NOTES_FILES) {
      assert.deepEqual(noteFileProblems(file, INDEX[file.sourceId]!), [], file.sourceId);
    }
  });
});
