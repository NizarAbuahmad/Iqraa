/**
 * Which subject/grade pairs actually have a book, written down.
 *
 * Two assertions already guard the edges of the MVP lists, and both are blind
 * here: `finlitCurriculum.test.ts` checks every MVP subject resolves to a book
 * but hardcodes 'grade-10', and its mirror ("every MVP book belongs to an MVP
 * subject") is grade-agnostic. Nothing asked about grade-9 — yet MVP_GRADE_IDS
 * carries it, and `getPickerSubjects()` deliberately ignores its gradeId so the
 * pickers offer every MVP subject against every MVP grade.
 *
 * The answer turned out to be worse than the single pair that prompted this:
 * of the 20 MVP pairs, 9 have no book, and all 9 are grade-9 — the grade has
 * mathematics and nothing else. That is a fact about the catalogue that was
 * true and unwritten, which is why it is spelled out below rather than
 * skipped or derived.
 *
 * The counts move as subjects are catalogued, and the list below is the thing
 * that has to move with them: it grew by `islamic:grade-9` within a day, when
 * Islamic Education was catalogued for Grade 10 and rejoined MVP_SUBJECT_IDS
 * while its grade-9 half stayed empty. That failure is the feature.
 *
 * An allowlist, not a skip: a skip would let the bookless set grow silently,
 * and a derived set would assert nothing at all. Listing them means adding a
 * Grade 9 book FAILS this test — deliberately. That is the moment to check
 * what the new pair does to the curriculum browser (which hides bookless
 * subjects) and the AI-tools pickers (which grey them out), so the failure is
 * the prompt to look, and the fix is to delete the line.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MVP_GRADE_IDS,
  MVP_SUBJECT_IDS,
  hasCurriculumForSubjectGrade,
} from '../catalog.ts';

/** `subjectId:gradeId` pairs that are offered by the MVP lists but have no book. */
const KNOWN_BOOKLESS: ReadonlySet<string> = new Set([
  // financial-literacy:grade-9 was the last pre-existing gap, closed
  // 2026-09-09, the same day four subjects joined MVP_SUBJECT_IDS brand-new
  // with only a Grade 9 book behind them — so their Grade 10 halves were
  // bookless by construction, not by omission. Three of the four have since
  // closed as their Grade 10 books arrived: geography and history that same
  // week, civic-education on 2026-09-10. physical-education is the last one
  // still true of that sentence.
  'physical-education:grade-10',
  // grade-8 joined MVP_GRADE_IDS 2026-09-09 with only financial-literacy
  // built. Grade 8 does not split science or social studies the way Grade
  // 9/10 do — NCCD combines them into single «العلوم» and «الدراسات
  // الاجتماعية» books, catalogued under the pre-existing 'science'/'social'
  // subjects, neither of which is in MVP_SUBJECT_IDS yet — so chemistry,
  // physics, biology, earth-science, geography, history, civic-education
  // are permanently bookless at grade-8, not gaps to be closed later.
  // physical-education has no grade-8 book at all on disk.
  // digital-literacy:grade-8 closed 2026-09-09, the same day as
  // financial-literacy. mathematics:grade-8 closed the same week once its
  // Semester 2 book arrived (Semester 1 still unattached, but one semester
  // is enough for hasCurriculumForSubjectGrade). arabic:grade-8 closed the
  // same week once its Semester 1 book arrived; Semester 2 followed on
  // 2026-09-10, from the book whose filename wrongly says «للصف السابع».
  // islamic:grade-8 closed the same way once its Semester 1 book arrived.
  // english:grade-8 closed 2026-09-10 once its Semester 1 book arrived —
  // the last Grade 8 subject this comment block still listed as pending.
  'chemistry:grade-8',
  'physics:grade-8',
  'earth-science:grade-8',
  'biology:grade-8',
  'geography:grade-8',
  'history:grade-8',
  'civic-education:grade-8',
  'physical-education:grade-8',
  // creative-arts joined MVP_SUBJECT_IDS the same day as its only book
  // (Grade 8). SUBJECTS.grades for it is ['grade-8'] alone — no Grade 9 or
  // 10 book is expected, so these two are permanent, not gaps to close.
  'creative-arts:grade-9',
  'creative-arts:grade-10',
  // vocational-education joined the same day, same reason — SUBJECTS.grades
  // is ['grade-8'] alone here too.
  'vocational-education:grade-9',
  'vocational-education:grade-10',
  // social joined the same day, and both entries are PERMANENT — corrected
  // on 2026-09-10, having been recorded here as ordinary gaps to "delete the
  // line once a book lands". No such book will land. NCCD teaches «الدراسات
  // الاجتماعية» as one combined subject only at Grade 8; from Grade 9 up it
  // is split into geography, history and civic-education, each its own
  // subject with its own books — all three now complete at both grades
  // (book-geo/hist/civ-9-s1|s2 and -10-s1|s2, twelve books). So the content
  // is fully covered; it just answers to three subjectIds instead of one.
  //
  // Note SUBJECTS.grades for social still spans grade-1..grade-9, which is
  // what made this look ordinary: that range is about the primary grades the
  // subject is declared for, and cannot on its own tell you a grade-9 book
  // exists. The declaration outran the curriculum here — do not read it as
  // evidence a book is merely missing.
  //
  // Same shape as science:grade-10 below, in the opposite direction: there a
  // Grade 10 subject dissolves into four, here a Grade 8 subject dissolves
  // into three.
  'social:grade-9',
  'social:grade-10',
  // science joined 2026-09-10 with its first-ever book (Grade 8). BOTH
  // entries are PERMANENT: Grade 8 is the only grade NCCD teaches «العلوم»
  // as one subject. Grade 9 and Grade 10 each split it into physics,
  // chemistry, biology and earth-science, and all four are built at both
  // grades — which is why none of them appears in this list at grade-9 or
  // grade-10, only at grade-8. Read the two ends together: those four are
  // permanently bookless at grade-8 because Grade 8 combines them into the
  // science book; science is permanently bookless at grade-9 and grade-10
  // because those grades dissolve it back into the four. Same fact twice.
  //
  // science:grade-9 was first recorded here as an ORDINARY gap — "delete the
  // line when a Grade 9 science book lands". Corrected 2026-09-10; no such
  // book exists or will. The bad inference was SUBJECTS.grades spanning
  // grade-1..grade-9, which says which grades the subject is declared for
  // and cannot tell you a book exists at any of them. That is the same
  // misreading corrected for social:grade-9/10 above, and it is worth
  // noticing that both slipped through: a declared range is never evidence
  // of a book, and this file is the place that distinction has to hold.
  'science:grade-9',
  'science:grade-10',
  // grade-7 joined MVP_GRADE_IDS 2026-09-12 with all eleven of its subjects
  // already built (Math, Islamic, Science, Digital Skills, Social Studies,
  // Financial Literacy, Vocational Education, Creative Arts, Physical
  // Education, Arabic, English) — unlike grade-8's staged rollout, so this
  // grade never passed through an ordinary/temporary-gap phase. Same reason
  // as grade-8: NCCD combines science and social studies into one book each
  // at Grade 7 too, so the four split-science subjects and the three
  // split-social subjects are permanently bookless here, not gaps to close.
  'chemistry:grade-7',
  'physics:grade-7',
  'earth-science:grade-7',
  'biology:grade-7',
  'geography:grade-7',
  'history:grade-7',
  'civic-education:grade-7',
  // grade-6 joined MVP_GRADE_IDS 2026-09-13 with Mathematics S1 and Science
  // S1/S2 built — a staged rollout like grade-8's, not grade-7's all-at-once
  // one, so the sixteen pairs below split three ways. The split is the point:
  // a flat list would read as "sixteen gaps to close", and eight of them will
  // never close.
  //
  // PERMANENT — the subject does not exist at Grade 6 at all. NCCD teaches one
  // «العلوم» and one «الدراسات الاجتماعية» book through the primary grades;
  // the sciences split out at grade-9 and social studies at grade-9, and
  // financial literacy starts at grade-7. SUBJECTS.grades already says so for
  // each of these — none declares grade-6 — which is why no book will arrive.
  // Same fact as the grade-7 and grade-8 halves of this list, one grade down.
  'chemistry:grade-6',
  'physics:grade-6',
  'biology:grade-6',
  'earth-science:grade-6',
  'geography:grade-6',
  'history:grade-6',
  'civic-education:grade-6',
  'financial-literacy:grade-6',
  //
  // ORDINARY GAPS — the subject is declared at grade-6 and a Grade 6 book for
  // it exists on disk; it is simply not ingested yet. Delete the line when it
  // is.
  // arabic:grade-6 closed 2026-09-15, both semesters (title-only).
  // english:grade-6 closed 2026-09-15, both semesters (title-only, third-party).
  // islamic:grade-6 closed 2026-09-15, both semesters (title-only).
  // social:grade-6 closed 2026-09-15, both semesters (title-only).
  // digital-literacy:grade-6 closed 2026-09-15 (title-only, S1 only).
  // creative-arts / vocational-education / physical-education at grade-6 all
  // closed 2026-09-15: SUBJECTS.grades extended and the books attached.
  //
  // ORDINARY GAPS, WITH AN EXTRA STEP — a Grade 6 book exists for each, but
  // SUBJECTS.grades does not declare grade-6 for them yet (grade-7/8 for the
  // first two, grade-7/9 for the third). Closing these means extending that
  // array as well as ingesting the book, so do not read the undeclared range
  // as evidence the subject stops above Grade 6 — for these three it is the
  // declaration that trails the curriculum, not the reverse.
  //
  // grade-5 joined MVP_GRADE_IDS 2026-09-16 with only Mathematics S1 built —
  // a staged rollout like grade-8's and grade-6's, so the seventeen pairs
  // below split the same two ways.
  //
  // PERMANENT — the subject is not declared at grade-5 in SUBJECTS.grades at
  // all. physics/chemistry/biology/earth-science and financial-literacy only
  // start at SPECIALISED_FROM (grade-9) or grade-7; geography/history/
  // civic-education only start at grade-9; physical-education is declared
  // for grade-6, grade-7, grade-9 but not grade-5; creative-arts and
  // vocational-education are declared for grade-6..grade-8 only. None of
  // these will ever get a grade-5 book.
  'chemistry:grade-5',
  'physics:grade-5',
  'biology:grade-5',
  'earth-science:grade-5',
  'financial-literacy:grade-5',
  'geography:grade-5',
  'history:grade-5',
  'civic-education:grade-5',
  'physical-education:grade-5',
  'creative-arts:grade-5',
  'vocational-education:grade-5',
  //
  // ORDINARY GAPS — the subject is declared at grade-5 (arabic/english/
  // digital-literacy span all grades; social spans grade-1..grade-9), and
  // Grade 5 text for each already exists on disk (worktree-grade-5-books,
  // unmerged as of 2026-09-16), but no catalog has been built from it yet —
  // see docs/g345-blocked. Delete each line once its catalog and BOOKS row
  // land. science:grade-5 closed 2026-09-16, both semesters (second Grade 5
  // subject); islamic:grade-5 closed the same day, both semesters (third);
  // arabic:grade-5 closed the same day, both semesters, title-only (see
  // g5ArabicSem1.ts — interactive-exercise lessons, no prose to summarize).
  // social:grade-5 closed the same day, both semesters, title-only (see
  // g5SocialSem1.ts — a corrupted PDF text layer, not a missing source).
  // digital-literacy:grade-5 closed the same day, Semester 1 only, title-only
  // (fourth — see g5DigitalSem1.ts, no Semester 2 activity book on file).
  // english:grade-5 closed the same day, both semesters — the last planned
  // Grade 5 MVP subject (see g5EnglishSem1.ts).
  //
  // grade-4 joined MVP_GRADE_IDS 2026-09-17 with only Mathematics built — a
  // staged rollout like grade-5's, so the pairs below split the same two
  // ways. science:grade-4 and islamic:grade-4 closed the same rollout, both
  // semesters each, real content (see g4ScienceSem1.ts / g4IslamicSem1.ts —
  // matching g5ScienceSem1.ts's and g5IslamicSem1.ts's conventions).
  // digital-literacy:grade-4 closed the same rollout, title-only,
  // cross-curricular (see g4DigitalSem1.ts — matches g5DigitalSem1.ts's
  // convention). social:grade-4 closed the same rollout, both semesters,
  // real content — unlike g5SocialSem1.ts, this book's PDF is not
  // CMap-corrupted, so it reads cleanly (see g4SocialSem1.ts).
  // arabic:grade-4 closed the same rollout, both semesters, title-only,
  // same convention as g5ArabicSem1.ts (fixed 5-lesson-per-unit pattern,
  // no prose to summarize — see g4ArabicSem1.ts). english:grade-4 closed
  // the same rollout, both semesters, real content (unit-level, not
  // title-only) — the last of the seven Grade 4 subjects that mirror
  // Grade 5's set, same convention as g5EnglishSem1.ts (see
  // g4EnglishSem1.ts).
  //
  // PERMANENT — the subject is not declared at grade-4 in SUBJECTS.grades at
  // all, same reasoning as grade-5 above (physics/chemistry/biology/
  // earth-science/financial-literacy start at grade-7 or SPECIALISED_FROM;
  // geography/history/civic-education start at grade-9; physical-education
  // is declared for grade-6/7/9 only — no Grade 4 PE book exists, unlike Art
  // and Vocational Education).
  'chemistry:grade-4',
  'physics:grade-4',
  'biology:grade-4',
  'earth-science:grade-4',
  'financial-literacy:grade-4',
  'geography:grade-4',
  'history:grade-4',
  'civic-education:grade-4',
  'physical-education:grade-4',
  // No ORDINARY GAPS remain for grade-4 — all nine subjects now have
  // catalogs. The seven that mirror Grade 5's set (mathematics, science,
  // islamic, digital-literacy, social, arabic, english) closed first;
  // creative-arts:grade-4 and vocational-education:grade-4 closed
  // 2026-09-17 by extending SUBJECTS.grades (both were previously
  // grade-6..8 only) and building g4CreativeArts.ts / g4VocationalSem1.ts —
  // see those files. Grade 4's MVP rollout is complete.
  //
  // grade-3 joined MVP_GRADE_IDS 2026-09-17 with only Mathematics built —
  // a staged rollout like grade-4/5's. mathematics:grade-3 closed the same
  // day, both semesters, real content from each lesson's own «أَتَعَلَّمُ
  // الْيَوْمَ» box (this book's name for the objectives box — see
  // g3MathSem1.ts).
  //
  // PERMANENT — the subject is not declared at grade-3 in SUBJECTS.grades at
  // all, same reasoning as grade-4/5 above (physics/chemistry/biology/
  // earth-science/financial-literacy start at grade-7 or SPECIALISED_FROM;
  // geography/history/civic-education start at grade-9). vocational-education
  // stays genuinely PERMANENT for grade-3 — no Grade 3 vocational book exists
  // at all (Grade 3 doesn't teach that subject; PE fills its MVP slot
  // instead). creative-arts:grade-3 closed 2026-09-18 — see g3CreativeArts.ts.
  // physical-education:grade-3 closed 2026-09-18, same SUBJECTS.grades
  // extension trap — see g3PhysicalEducationSem1.ts.
  'chemistry:grade-3',
  'physics:grade-3',
  'biology:grade-3',
  'earth-science:grade-3',
  'financial-literacy:grade-3',
  'geography:grade-3',
  'history:grade-3',
  'civic-education:grade-3',
  'vocational-education:grade-3',
  //
  // ORDINARY GAPS — the subject is declared at grade-3 in SUBJECTS.grades,
  // and Grade 3 source PDFs exist on disk (knowledge-base/grade-3-*), but no
  // catalog has been built from them yet. Delete each line once its catalog
  // and BOOKS row land, same as the grade-4 rollout above.
  // science:grade-3 closed 2026-09-17 — see g3ScienceSem1.ts/g3ScienceSem2.ts.
  // islamic:grade-3 closed 2026-09-17 — see g3IslamicSem1.ts/g3IslamicSem2.ts.
  // arabic:grade-3 closed 2026-09-17 — see g3ArabicSem1.ts/g3ArabicSem2.ts.
  // social:grade-3 closed 2026-09-18 — see g3SocialSem1.ts/g3SocialSem2.ts.
  // english:grade-3 closed 2026-09-18 — see g3EnglishSem1.ts/g3EnglishSem2.ts.
  'digital-literacy:grade-3',
  //
  // grade-1 joined MVP_GRADE_IDS 2026-09-18 with only Mathematics built — a
  // staged rollout like grade-3/4/5's. mathematics:grade-1 closed the same
  // day, both semesters, real content from each lesson's own «أَتَعَلَّمُ
  // الْيَوْمَ» box (same book series and convention as g3MathSem1.ts).
  //
  // PERMANENT — the subject is not declared at grade-1 in SUBJECTS.grades at
  // all (physics/chemistry/biology/earth-science/financial-literacy start at
  // grade-7 or SPECIALISED_FROM; geography/history/civic-education start at
  // grade-9). vocational-education stays genuinely PERMANENT for grade-1 —
  // no Grade 1 vocational book exists at all.
  'chemistry:grade-1',
  'physics:grade-1',
  'biology:grade-1',
  'earth-science:grade-1',
  'financial-literacy:grade-1',
  'geography:grade-1',
  'history:grade-1',
  'civic-education:grade-1',
  'vocational-education:grade-1',
  //
  // ORDINARY GAPS — the subject is declared at grade-1 in SUBJECTS.grades,
  // and Grade 1 source PDFs exist on disk (knowledge-base/grade-1-*), but no
  // catalog has been built from them yet. Delete each line once its catalog
  // and BOOKS row land, same as the grade-3 rollout above. Digital Skills has
  // no student book at all — same class of gap hit at every other grade in
  // this project.
  // science:grade-1 closed 2026-09-18 — see g1ScienceSem1.ts/g1ScienceSem2.ts.
  // islamic:grade-1 closed 2026-09-18, both semesters — see
  // g1IslamicSem1.ts/g1IslamicSem2.ts. This book prints no «الفِكْرَةُ
  // الرَّئيسَةُ» box, unlike g3IslamicSem1.ts.
  // english:grade-1 closed 2026-09-18, both semesters — see
  // g1EnglishSem1.ts/g1EnglishSem2.ts.
  // arabic:grade-1 closed 2026-09-18, both semesters — see
  // g1ArabicSem1.ts/g1ArabicSem2.ts. Title-only, letter-teaching primer
  // structure (not the fixed 5-lesson pattern); Semester 1's student book
  // was missing at first and supplied by the user mid-session.
  // social:grade-1 closed 2026-09-19, both semesters — see
  // g1SocialSem1.ts/g1SocialSem2.ts. Semester 2's source file is misnamed on
  // disk (says "الصف الرابع" / Grade 4) — verified as genuine Grade 1 S2
  // content via the PDF's own bibliographic page.
  // creative-arts:grade-1 closed 2026-09-19 — SUBJECTS.grades extended for
  // grade-1 (one book, no semester, same shape as g3CreativeArts.ts) — see
  // g1CreativeArts.ts.
  // physical-education:grade-1 closed 2026-09-19 — SUBJECTS.grades extended
  // for grade-1, Semester 2 only (opposite gap from grade-3/6's PE), real
  // content box shape same as g3PhysicalEducationSem1.ts — see
  // g1PhysicalEducationSem2.ts.
  //
  // Digital Skills has no student book at all — flagged to the user
  // 2026-09-19 via AskUserQuestion; user chose "Keep waiting", same as
  // Grade 3 Digital Skills. Paused, not built.
  'digital-literacy:grade-1',
  //
  // grade-2 joined MVP_GRADE_IDS 2026-09-19 with only Mathematics built —
  // same staged rollout as grade-1/3/4/5's. mathematics:grade-2 closed the
  // same day, both semesters, real content from each lesson's own «أَتَعَلَّمُ
  // الْيَوْمَ» box (same HarperCollins/NCCD series and convention as
  // g1MathSem1.ts; no unnumbered preparatory unit this time).
  //
  // PERMANENT — the subject is not declared at grade-2 in SUBJECTS.grades at
  // all (physics/chemistry/biology/earth-science/financial-literacy start at
  // grade-7 or SPECIALISED_FROM; geography/history/civic-education start at
  // grade-9). vocational-education stays genuinely PERMANENT for grade-2 —
  // no Grade 2 vocational book exists at all. creative-arts and
  // physical-education are PERMANENT-pending-SUBJECTS.grades-extension: a
  // Grade 2 source book exists for each, but SUBJECTS.grades excludes
  // grade-2 until the catalog is actually built (same trap hit at every
  // prior grade's Art/PE rollout).
  'chemistry:grade-2',
  'physics:grade-2',
  'biology:grade-2',
  'earth-science:grade-2',
  'financial-literacy:grade-2',
  'geography:grade-2',
  'history:grade-2',
  'civic-education:grade-2',
  'vocational-education:grade-2',
  'creative-arts:grade-2',
  'physical-education:grade-2',
  //
  // ORDINARY GAPS — the subject is declared at grade-2 in SUBJECTS.grades,
  // and Grade 2 source PDFs exist on disk (knowledge-base/grade-2-*), but no
  // catalog has been built from them yet. Delete each line once its catalog
  // and BOOKS row land, same as the grade-1 rollout above. This is an
  // unusually complete source batch — real student books exist for both
  // semesters of science/social/english/arabic/islamic. Digital Skills has
  // no student book at all — same class of gap hit at every other grade in
  // this project.
  'science:grade-2',
  'social:grade-2',
  'english:grade-2',
  'arabic:grade-2',
  'islamic:grade-2',
  'digital-literacy:grade-2',
]);

describe('subject/grade coverage across the MVP lists', () => {
  it('every MVP pair is either covered by a book or listed as known-bookless', () => {
    for (const subjectId of MVP_SUBJECT_IDS) {
      for (const gradeId of MVP_GRADE_IDS) {
        const key = `${subjectId}:${gradeId}`;
        const hasBook = hasCurriculumForSubjectGrade(subjectId, gradeId);
        if (KNOWN_BOOKLESS.has(key)) {
          assert.equal(
            hasBook,
            false,
            `"${key}" now has a book — delete it from KNOWN_BOOKLESS, and check what the `
            + 'pair does to the curriculum browser and the AI-tools pickers.',
          );
        } else {
          assert.equal(
            hasBook,
            true,
            `"${key}" is offered by the MVP lists but has no book. Either a book/subject `
            + 'was removed by mistake, or the pair is genuinely empty and belongs in '
            + 'KNOWN_BOOKLESS.',
          );
        }
      }
    }
  });

  // Without this, an entry for a subject that later left MVP_SUBJECT_IDS would
  // sit in the list forever, checked against nothing and quietly wrong.
  it('lists no pair the MVP arrays no longer offer', () => {
    for (const key of KNOWN_BOOKLESS) {
      const [subjectId, gradeId] = key.split(':');
      assert.ok(
        MVP_SUBJECT_IDS.includes(subjectId!),
        `KNOWN_BOOKLESS has "${key}" but "${subjectId}" is not in MVP_SUBJECT_IDS — stale entry`,
      );
      assert.ok(
        MVP_GRADE_IDS.includes(gradeId!),
        `KNOWN_BOOKLESS has "${key}" but "${gradeId}" is not in MVP_GRADE_IDS — stale entry`,
      );
    }
  });
});
