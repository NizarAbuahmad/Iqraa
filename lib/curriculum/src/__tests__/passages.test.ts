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
  type Passage,
} from '../passages.ts';
import { getObjectivesForUnit } from '../objectives.ts';

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
    // loosely related from another book. This has gone stale picking "a
    // subject nothing has ingested yet" twice: first a financial-literacy
    // unit (finlit-s1 got extracted 2026-09-03), then a Grade 9 unit reasoned
    // to be durable because the manifest was Grade 10 only — ingesting the
    // Grade 9 maths books on 2026-09-05 broke that reasoning the same way.
    // Both were the shallow branch anyway: `bankTagsForUnit` returning [] and
    // `passagesForUnit` returning before it ever looks for a source.
    //
    // English vocational is the deeper branch and the more durable pick:
    // `kbu-eng-agri-s1-nccd-u1` is a real catalog unit whose tags resolve to
    // `['eng-agri-s1']` — a non-empty tag, so this exercises "found no source
    // carrying the tag", not "found no tag" — and it stays true by design
    // rather than by omission: `curriculumIds.ts` documents these four
    // tracks as having "no bank material at all yet", so nothing is expected
    // to ever tag a document this way.
    assert.deepEqual(passagesForUnit({ unitId: 'kbu-eng-agri-s1-nccd-u1' }), []);
    assert.deepEqual(passagesForUnit({ unitId: 'not-a-unit' }), []);
  });

  it('finds a unit\'s pages from its lesson titles when the book prints no objectives', () => {
    // Grade 9 Islamic Studies prints no learning outcomes, so a unit-wide paper
    // and the exam generator — both call with no `terms` — searched with nothing
    // and got no pages for 8 of 8 units, while a single lesson (which passes its
    // title) found them. The unit's own lesson titles are the description left.
    const unit = 'kbu-g9-islamic-s1-nccd-u1';
    assert.ok(hasExtractedText('g9-islamic-s1-student-book'));
    const ps = passagesForUnit({ unitId: unit, limit: 4, quotableOnly: true });
    assert.ok(ps.length > 0, 'a unit with extracted text and no objectives still gets pages');
    for (const p of ps) assert.equal(p.sourceId, 'g9-islamic-s1-student-book');
    // Page 4 is the contents page, which lists every lesson title in the book
    // and so outscored the unit's own pages for every unit before it was skipped.
    assert.ok(!ps.some(p => p.page === 4), 'the contents page is not a passage');
    // Unit 1 is PDF pages 6-33 by that contents page; unit 4 repeats unit 1's
    // lesson types (Surat al-Isra', recitation), whose pages used to leak in.
    for (const p of ps) assert.ok(p.page >= 6 && p.page <= 33, `page ${p.page} is outside unit 1`);
  });

  it('never serves the front matter, and keeps the last unit in its own pages', () => {
    // Page 3 is the book's introduction, which names every unit's topics; it
    // was once returned as a unit-2 source. Unit 4 is PDF pages 82 on.
    for (const n of [1, 2, 3, 4]) {
      for (const p of passagesForUnit({ unitId: `kbu-g9-islamic-s1-nccd-u${n}`, limit: 4, quotableOnly: true })) {
        assert.ok(p.page > 5, `unit ${n} got front-matter page ${p.page}`);
      }
    }
    const last = passagesForUnit({ unitId: 'kbu-g9-islamic-s1-nccd-u4', limit: 4, quotableOnly: true });
    assert.ok(last.length > 0);
    for (const p of last) assert.ok(p.page >= 82, `page ${p.page} is outside unit 4`);
  });

  it('gives a unit nothing rather than a sibling unit\'s pages when its titles are not its own', () => {
    // Grade 6 Arabic heads every unit with the same skill names («أستمع
    // بانتباه»…) and prints no outcomes, so only the title fallback describes a
    // unit. Unit 2 has no two words of its own on any page: it gets nothing,
    // where scoring on the shared names handed it other units' pages.
    assert.equal(getObjectivesForUnit('kbu-g6-arabic-s1-nccd-u2').length, 0, 'still a fallback unit');
    assert.deepEqual(passagesForUnit({ unitId: 'kbu-g6-arabic-s1-nccd-u2', limit: 4, quotableOnly: true }), []);
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

describe('passagesForUnit for one lesson', () => {
  // Grade 4 maths S1 unit 3. Student-book pages from book-page-links.json,
  // where PDF page = printed page (checked on every opener, 2026-11-13).
  const G4_DIV = 'kbu-g4-math-s1-nccd-u3';
  const DIV_MULTIPLES = 'kbl-g4-math-s1-nccd-u3_l1'; // «قِسْمَةُ مُضاعَفاتِ 10, 100, 1000», pp. 50-52
  const DIV_ESTIMATE = 'kbl-g4-math-s1-nccd-u3_l2'; // «تَقْديرُ ناتِجِ القِسْمَةِ», pp. 53-55
  const ownPage = (ps: Passage[], from: number, to: number) =>
    ps.some(p => p.sourceId === 'g4-math-s1-student-book' && p.page >= from && p.page <= to);

  it("returns the lesson's own pages, not only the unit opener's", () => {
    // Before the lesson's own terms were weighted, every lesson of this unit got
    // the same four pages: the guide's unit plan and the unit extract.
    assert.ok(ownPage(passagesForUnit({ unitId: G4_DIV, lessonId: DIV_MULTIPLES, quotableOnly: true }), 50, 52));
    assert.ok(ownPage(passagesForUnit({ unitId: G4_DIV, lessonId: DIV_ESTIMATE, quotableOnly: true }), 53, 55));
  });

  it('finds the lesson from an exact title when no id is sent', () => {
    const ps = passagesForUnit({ unitId: G4_DIV, terms: ['تقدير ناتج القسمة'], quotableOnly: true });
    assert.ok(ownPage(ps, 53, 55));
  });

  it('ignores a lesson from another unit', () => {
    const plain = passagesForUnit({ unitId: G4_DIV, quotableOnly: true });
    const foreign = passagesForUnit({ unitId: G4_DIV, lessonId: 'kbl-g4-math-s1-nccd-u1_l1', quotableOnly: true });
    assert.deepEqual(foreign.map(p => `${p.sourceId}:${p.page}`), plain.map(p => `${p.sourceId}:${p.page}`));
  });

  const pageIn = (ps: Passage[], sourceId: string, from: number, to: number) =>
    ps.some(p => p.sourceId === sourceId && p.page >= from && p.page <= to);

  it("reads a title's three-letter word", () => {
    // «قِصَّةُ نَبِيِّ اللهِ سَيِّدِنا آدَمَ», pp. 22-26: «آدم» is the word that names
    // it, and a four-letter floor left only «قصة», «نبي»… to find it with.
    const ps = passagesForUnit({ unitId: 'kbu-g4-islamic-s1-nccd-u1', lessonId: 'kbl-g4-islamic-s1-nccd-u1_l5', quotableOnly: true });
    assert.ok(pageIn(ps, 'g4-islamic-s1-student-book', 22, 26));
  });

  it('ignores a three-letter stopword in a title', () => {
    const unitId = 'kbu-g4-islamic-s1-nccd-u1';
    const plain = passagesForUnit({ unitId, terms: ['آدم'], quotableOnly: true });
    const padded = passagesForUnit({ unitId, terms: ['آدم على'], quotableOnly: true });
    assert.deepEqual(padded.map(p => `${p.sourceId}:${p.page}`), plain.map(p => `${p.sourceId}:${p.page}`));
  });

  it('finds «صلاة» in a book whose text layer spells it «صالة»', () => {
    // The Grade 4 Islamic student books never spell «صلاة» right; their
    // teacher guides do. «شروط صحة الصلاة» is pp. 58-62 and found no page at all.
    const ps = passagesForUnit({ unitId: 'kbu-g4-islamic-s1-nccd-u3', lessonId: 'kbl-g4-islamic-s1-nccd-u3_l3', quotableOnly: true });
    assert.ok(pageIn(ps, 'g4-islamic-s1-student-book', 58, 62));
  });

  it('falls back to the title when the lesson id is not in the unit', () => {
    const viaTitle = passagesForUnit({ unitId: G4_DIV, terms: ['تقدير ناتج القسمة'], quotableOnly: true });
    const legacyId = passagesForUnit({ unitId: G4_DIV, terms: ['تقدير ناتج القسمة'], lessonId: 'kbl-chem-1-1', quotableOnly: true });
    assert.deepEqual(legacyId.map(p => `${p.sourceId}:${p.page}`), viaTitle.map(p => `${p.sourceId}:${p.page}`));
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
