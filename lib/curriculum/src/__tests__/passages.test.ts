/**
 * Retrieval: does a unit get its own pages?
 *
 * The assertions name real lessons on purpose. A relevance test that only
 * checks "returned something" would have passed while the two math student
 * books were mapped across each other and الدائرة was being answered with a
 * page about vectors — which is exactly what happened before
 * `extraction.test.ts` grew a coherence check.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  passagesForUnit,
  repairExtractionArtifacts,
  resolveUnitByTopic,
  searchForm,
  hasExtractedText,
} from '../passages.ts';

const CIRCLE = 'kbu-math-s1-nccd-u2';
const TRIG = 'kbu-math-s1-nccd-u3';
const ATOM = 'kbu-chem-s1-nccd-u1';

/** Does any returned passage mention this? Compared in search form. */
const mentions = (passages: Array<{ text: string }>, needle: string): boolean =>
  passages.some(p => searchForm(p.text).includes(searchForm(needle)));

describe('repairExtractionArtifacts', () => {
  it('rejoins the decomposed lam-alef', () => {
    // The defect that makes «الاقتران» unfindable in extracted text.
    assert.equal(repairExtractionArtifacts('االقتران'), 'الاقتران');
    assert.equal(repairExtractionArtifacts('االسس'), 'الاسس');
  });

  it('rejoins it in its hamza-carrying forms too', () => {
    // لأ, لإ and لآ reverse exactly as لا does, and used to be missed: 26,626
    // words of the corpus, every document. «الإنسان» went from matching 31 pages
    // to 314 once this was added — retrieval had been missing ~90% of them.
    assert.equal(repairExtractionArtifacts('األلوان'), 'الألوان');
    assert.equal(repairExtractionArtifacts('اإلنسان'), 'الإنسان');
    assert.equal(repairExtractionArtifacts('اآللة'), 'الآلة');
  });

  it('needs no dictionary, because the sequence it keys on is not Arabic', () => {
    // An alef immediately followed by a hamza-carrying alef is not something
    // Arabic orthography produces, so this rule cannot misfire on a real word
    // the way a bare ال rule would — «ألوان» and «ألف» are ordinary words
    // that begin with the very pair being swapped, and must survive untouched.
    for (const ok of ['ألوان', 'ألف', 'إلى', 'ألم', 'للأطفال']) {
      assert.equal(repairExtractionArtifacts(ok), ok);
    }
  });

  it('leaves text that never had the defect alone', () => {
    for (const ok of ['الدائرة', 'المشتقات', 'بنية الذرة', 'Bohr model']) {
      assert.equal(repairExtractionArtifacts(ok), ok);
    }
  });

  it('is a repair, not orthographic folding', () => {
    // `normalizeArabic` folds what a human might type differently. This fixes
    // what a PDF text layer did. A student never types «االقتران», so the two
    // must not merge — the grading path uses only the former.
    assert.equal(repairExtractionArtifacts('أسس'), 'أسس', 'hamza is not this function\'s business');
  });
});

describe('passagesForUnit', () => {
  it('returns the circle unit\'s own pages', () => {
    const ps = passagesForUnit({ unitId: CIRCLE, limit: 5 });
    assert.ok(ps.length > 0, 'no passages for الدائرة');
    // math-s1-teacher-guide joined 2026-08-30 once it was actually extracted
    // (it had sat as an unpulled Git-LFS pointer before) — its مخطَّط الوحدة
    // tables and per-lesson outcome pages are genuinely about this unit, not
    // noise from its book-wide `unitTags: ['s1']` tag.
    const allowed = new Set(['math-s1-student-book', 'math-s1-exercise-book', 'math-s1-teacher-guide']);
    assert.ok(ps.every(p => allowed.has(p.sourceId)),
      `unexpected sources: ${[...new Set(ps.map(p => p.sourceId))].join(', ')}`);
    // The vocabulary of this unit, not of a neighbouring one.
    assert.ok(mentions(ps, 'الوتر') || mentions(ps, 'المماس') || mentions(ps, 'الدائرة'));
    // The specific regression: vectors are unit 7, in the other semester.
    assert.ok(!mentions(ps, 'جمع المتجهات وطرحها'), 'a vectors page came back for الدائرة');
  });

  it('separates two units of the same book', () => {
    const circle = passagesForUnit({ unitId: CIRCLE, limit: 4 });
    const trig = passagesForUnit({ unitId: TRIG, limit: 4 });
    assert.ok(trig.length > 0);
    assert.ok(mentions(trig, 'المثلث'), 'trigonometry pages do not mention triangles');
    // Different units must not resolve to the same pages.
    const overlap = circle.filter(c => trig.some(t => t.sourceId === c.sourceId && t.page === c.page));
    assert.equal(overlap.length, 0, `${overlap.length} pages served for both units`);
  });

  it('crosses subjects correctly', () => {
    const ps = passagesForUnit({ unitId: ATOM, limit: 4 });
    assert.ok(ps.length > 0);
    assert.ok(ps.every(p => p.sourceId.startsWith('chem-')), 'a maths book answered a chemistry unit');
    assert.ok(mentions(ps, 'بور') || mentions(ps, 'الذرة'));
  });

  it('ranks, and the ranking is stable', () => {
    const ps = passagesForUnit({ unitId: CIRCLE, limit: 5 });
    for (let i = 1; i < ps.length; i += 1) assert.ok(ps[i - 1]!.score >= ps[i]!.score);
    assert.deepEqual(
      passagesForUnit({ unitId: CIRCLE, limit: 5 }).map(p => `${p.sourceId}:${p.page}`),
      ps.map(p => `${p.sourceId}:${p.page}`),
    );
  });

  it('honours the limit', () => {
    assert.ok(passagesForUnit({ unitId: CIRCLE, limit: 2 }).length <= 2);
  });

  it('carries the use policy on every passage', () => {
    for (const p of passagesForUnit({ unitId: CIRCLE, limit: 5 })) {
      assert.ok(p.usePolicy === 'quotable' || p.usePolicy === 'reference-only');
      assert.equal(p.usePolicy, p.authority === 'nccd' ? 'quotable' : 'reference-only');
    }
  });

  it('can be restricted to quotable material', () => {
    for (const p of passagesForUnit({ unitId: CIRCLE, limit: 5, quotableOnly: true })) {
      assert.equal(p.usePolicy, 'quotable');
    }
  });

  it('returns raw text, not the search form', () => {
    // What goes to a model must be the book as printed. Re-spelling a textbook
    // on the way to a prompt is a silent edit of a source document.
    const ps = passagesForUnit({ unitId: CIRCLE, limit: 3 });
    assert.ok(ps.some(p => /[ً-ْ]/.test(p.text)), 'every passage lost its tashkeel — text was normalised');
  });

  it('is empty rather than approximate when nothing is extracted', () => {
    // A unit with no text behind it must return nothing rather than something
    // loosely related from another book. This used to use a financial-literacy
    // unit, but finlit-s1 was extracted on 2026-09-03 and the assertion went
    // stale. A Grade 9 unit is the durable case: this manifest is Grade 10 only
    // (`g10_sources.json`), so no Grade 9 unit can acquire text through it.
    assert.deepEqual(passagesForUnit({ unitId: 'kbu-g9-math-s1-nccd-u1' }), []);
    assert.deepEqual(passagesForUnit({ unitId: 'not-a-unit' }), []);
  });

  it('knows which sources have text', () => {
    assert.ok(hasExtractedText('math-s1-student-book'));
    // math-s1-support-material used to stand here as the un-fetched case; it
    // was extracted on 2026-09-02, so this needs an id that stays without text.
    // This one is a deliberate skip rather than a backlog item: the PDF has no
    // text layer at all and OCR is not something this project has, so it will
    // not go stale the way a pending fetch does.
    assert.ok(!hasExtractedText('math-u1-answers-alkhatib'));
  });
});

describe('resolveUnitByTopic', () => {
  it('finds a unit from an exact lesson title', () => {
    assert.deepEqual(resolveUnitByTopic('أوتار الدائرة وأقطارها ومماساتها')?.unitId, CIRCLE);
  });

  it('tolerates the orthography a teacher might type', () => {
    // No tashkeel, different hamza carrier — normalizeArabic's whole job.
    assert.equal(resolveUnitByTopic('اوتار الدائرة واقطارها ومماساتها')?.unitId, CIRCLE);
  });

  it('refuses rather than guesses', () => {
    assert.equal(resolveUnitByTopic('شيء غير موجود في المنهاج'), null);
    assert.equal(resolveUnitByTopic('ا'), null);
    assert.equal(resolveUnitByTopic(''), null);
  });

  it('refuses a topic that names no single unit', () => {
    // «المشتقات» is a unit title, not a lesson title, and matching it loosely
    // would attach one lesson's pages to a whole unit's worth of intent.
    // Returning null is the honest answer; the caller falls back to objectives.
    assert.equal(resolveUnitByTopic('المشتقات'), null);
  });
});
