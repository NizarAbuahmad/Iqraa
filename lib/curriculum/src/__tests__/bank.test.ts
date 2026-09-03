/**
 * Invariants of the knowledge bank.
 *
 * Most of these exist because the catalog this manifest absorbed broke them.
 * They are written against the data, not against a function, because the data
 * is the thing that drifted.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { G10_SOURCES, getSource, type CurriculumSource } from '../sources.ts';
import {
  BANK_UNIT_TAGS,
  answerKeys,
  appSubjectId,
  assertQuotable,
  bankItems,
  bankStats,
  examPapers,
  itemsForUnitTags,
  questionBanks,
  usePolicy,
} from '../bank.ts';

const usable = bankItems();

describe('manifest shape', () => {
  it('gives every source the retrieval fields', () => {
    for (const s of G10_SOURCES) {
      assert.equal(typeof s.filename, 'string', `${s.id} filename`);
      assert.ok(s.filename.length > 0, `${s.id} filename empty`);
      assert.ok(Array.isArray(s.unitTags), `${s.id} unitTags`);
      assert.ok(Array.isArray(s.objectiveIds), `${s.id} objectiveIds`);
      assert.ok(Array.isArray(s.keywords), `${s.id} keywords`);
    }
  });

  it('scopes every source to at least one unit tag', () => {
    // A source with no scope can only ever be found by a text query, which
    // makes it invisible to the lesson-driven paths that matter most.
    for (const s of G10_SOURCES) {
      assert.ok(s.unitTags.length > 0, `${s.id} has no unitTags`);
    }
  });

  it('draws unit tags from one vocabulary', () => {
    for (const s of G10_SOURCES) {
      for (const t of s.unitTags) {
        assert.ok(BANK_UNIT_TAGS.includes(t), `${s.id}: unknown tag ${t}`);
      }
    }
  });

  it('never puts another subject\'s tag on a source', () => {
    // The tag namespace is subject-prefixed precisely so this is checkable.
    // A maths `s1-u1` on a chemistry pack is how a lesson ends up offered a
    // document from a subject it does not teach.
    const prefixFor: Record<CurriculumSource['subject'], RegExp> = {
      math: /^(s[12](-u\d+|-matrices)?|g10-math-general)$/,
      chemistry: /^(chem-s[12](-u\d+)?|chem-g10-general)$/,
      'financial-literacy': /^finlit-s[12]$/,
      physics: /^phys-s[12]$/,
      biology: /^(bio-s[12]|bio-g10-general)$/,
      'earth-science': /^earth-s[12]$/,
      arabic: /^arabic-s[12]$/,
      islamic: /^islamic-s[12]$/,
      history: /^history-s[12]$/,
      english: /^eng-s[12]$/,
      geography: /^geo-s[12]$/,
      'digital-literacy': /^digital-s[12]$/,
      civic: /^civic-s[12]$/,
      art: /^art-g10-general$/,
      vocational: /^vocational-s[12]$/,
    };
    for (const s of G10_SOURCES) {
      for (const t of s.unitTags) {
        assert.match(t, prefixFor[s.subject], `${s.id} (${s.subject}) carries ${t}`);
      }
    }
  });

  it('leaves objective anchoring empty and honest', () => {
    // Nothing has been mined to objective granularity. When that changes this
    // assertion should be rewritten to check the ids resolve — not deleted.
    // An objectiveId invented from a unit tag is a false claim about coverage.
    for (const s of G10_SOURCES) {
      assert.equal(s.objectiveIds.length, 0, `${s.id} claims objective anchors`);
    }
  });

  it('keeps structural strings out of keywords', () => {
    // `remedial` sat in the keyword list of all eight maths past papers and
    // scored +2 against remedial queries. Keywords are for what `kind`,
    // `subject` and `unitTags` do not already say.
    const structural = new Set([...BANK_UNIT_TAGS, 'remedial', 'quiz', 'worksheet',
      'summary', 'answer_key', 'official_book', 'support', 'geometry-ref']);
    for (const s of G10_SOURCES) {
      for (const k of s.keywords) {
        assert.ok(!structural.has(k), `${s.id}: structural keyword ${k}`);
      }
    }
  });

  it('names an author for teacher material and none for NCCD', () => {
    // `third-party` is exempt in both directions: the one entry is a worksheet
    // from شبكة منهاجي, an organisation, so it has no personal author to name.
    for (const s of G10_SOURCES) {
      if (s.authority === 'nccd') {
        assert.equal(s.authorAr, null, `${s.id} credits an author to NCCD`);
      } else if (s.authority === 'teacher') {
        assert.ok(s.authorAr, `${s.id} (${s.authority}) has no author`);
      }
    }
  });

  it('points every duplicate and conflict at a real entry', () => {
    for (const s of G10_SOURCES) {
      if (s.status === 'duplicate') {
        assert.ok(s.duplicateOf, `${s.id} is a duplicate of nothing`);
        assert.ok(getSource(s.duplicateOf!), `${s.id} → missing ${s.duplicateOf}`);
      }
      if (s.status === 'conflict') {
        assert.ok(s.conflictWith, `${s.id} conflicts with nothing`);
        assert.ok(getSource(s.conflictWith!), `${s.id} → missing ${s.conflictWith}`);
      }
    }
  });

  it('has no repeated id or Drive id', () => {
    assert.equal(new Set(G10_SOURCES.map(s => s.id)).size, G10_SOURCES.length);
    // Sources handed over as local files carry no Drive id (see `driveId`),
    // so uniqueness is asserted over the ones that have one — counting
    // `undefined` as a value made every such source collide with the next.
    const drive = G10_SOURCES.map(s => s.driveId).filter((d): d is string => !!d);
    assert.equal(new Set(drive).size, drive.length);
  });
});

describe('bankItems', () => {
  it('excludes duplicates and conflicts', () => {
    for (const s of usable) {
      assert.notEqual(s.status, 'duplicate', s.id);
      assert.notEqual(s.status, 'conflict', s.id);
    }
    assert.ok(usable.length < G10_SOURCES.length);
  });

  it('never offers two copies of the same document', () => {
    // The absorbed catalog shipped both chemistry student books — an Adobe
    // original and an iLovePDF re-compression of it — and de-duplicated by
    // title, which could not see them as the same book because their titles
    // differed. `duplicateOf` is what catches it; this is the regression.
    const canonical = usable.map(s => s.duplicateOf ?? s.id);
    assert.equal(new Set(canonical).size, canonical.length);
    for (const id of ['chem-s1-student-book-compressed', 'chem-s2-student-book-compressed']) {
      assert.ok(!usable.some(s => s.id === id), `${id} reached the bank`);
    }
  });

  it('keeps pending documents — they are still real documents', () => {
    assert.ok(usable.some(s => s.status === 'pending'));
  });

  it('filters by kind, subject and tag', () => {
    assert.ok(bankItems({ subject: 'math' }).every(s => s.subject === 'math'));
    assert.ok(bankItems({ subjectId: 'chemistry' }).every(s => s.subject === 'chemistry'));
    assert.ok(bankItems({ kind: 'worksheet' }).every(s => s.kind === 'worksheet'));
    assert.ok(bankItems({ kind: ['exam', 'question-bank'] })
      .every(s => s.kind === 'exam' || s.kind === 'question-bank'));
    assert.ok(bankItems({ unitTags: ['s1-u2'] }).every(s => s.unitTags.includes('s1-u2')));
    assert.equal(itemsForUnitTags([]).length, 0);
  });
});

describe('use policy', () => {
  it('makes NCCD quotable and everything else reference-only', () => {
    for (const s of G10_SOURCES) {
      assert.equal(usePolicy(s), s.authority === 'nccd' ? 'quotable' : 'reference-only', s.id);
    }
  });

  it('refuses to let a teacher\'s work be reproduced', () => {
    const paper = examPapers({ authority: 'teacher' })[0];
    assert.ok(paper, 'no teacher-authored exam papers in the bank');
    assert.throws(() => assertQuotable(paper), /reference-only/);
  });

  it('does not sweep the ministry diagnostic in with the teachers\' papers', () => {
    // Nine of the ten exam papers are a teacher's own work; the diagnostic is
    // NCCD's. Treating `kind: 'exam'` as a proxy for reference-only would be
    // wrong in exactly one place, which is the kind of wrong that survives.
    const ministry = examPapers({ authority: 'nccd' });
    assert.equal(ministry.length, 1);
    assert.doesNotThrow(() => assertQuotable(ministry[0]!));
  });

  it('lets NCCD material through', () => {
    const book = bankItems({ authority: 'nccd', kind: 'student-book' })[0];
    assert.ok(book);
    assert.doesNotThrow(() => assertQuotable(book));
  });

  it('names the author in the refusal, so the reason is legible', () => {
    const paper = examPapers({ authority: 'teacher' })[0]!;
    assert.throws(() => assertQuotable(paper), new RegExp(paper.authorAr!));
  });
});

describe('the fuel for exam work', () => {
  it('finds real test papers, distinct from question banks', () => {
    const exams = examPapers();
    const banks = questionBanks();
    assert.ok(exams.length >= 10, `only ${exams.length} exam papers`);
    assert.ok(banks.length >= 5, `only ${banks.length} question banks`);
    // The old vocabulary called both `quiz`, so this separation is the point.
    assert.equal(exams.filter(e => banks.includes(e)).length, 0);
  });

  it('does not label a past paper as remedial', () => {
    for (const e of examPapers()) {
      assert.ok(!e.unitTags.includes('remedial'), `${e.id} tagged remedial`);
      assert.ok(!e.keywords.includes('remedial'), `${e.id} keyword remedial`);
    }
  });

  it('has answer keys, the distractor source', () => {
    assert.ok(answerKeys().length >= 3);
  });
});

describe('bankStats', () => {
  it('separates what has been read from what is only on file', () => {
    const s = bankStats();
    assert.equal(s.total, G10_SOURCES.length);
    assert.equal(s.usable + s.excluded, s.total);
    // Flipped 2026-08-26: 51 support-pack documents were read that day,
    // taking ingested past pending for the first time. Assert the fact of
    // the day rather than a fixed direction, so this test states what is
    // true instead of just what was true when it was written.
    assert.ok(s.ingested > 0);
    assert.ok(s.pending > 0, 'the bank should still have unread documents to say so about');
    assert.ok(s.ingested > s.pending, 'most of the bank has been read — say so');
    assert.equal(s.byPolicy.quotable + s.byPolicy['reference-only'], s.usable);
    assert.equal(Object.values(s.byKind).reduce((a, b) => a + b, 0), s.usable);
  });

  it('reports subjects in the app\'s namespace', () => {
    assert.ok(bankStats().bySubject.mathematics > 0);
    assert.equal(appSubjectId('math'), 'mathematics');
  });
});
