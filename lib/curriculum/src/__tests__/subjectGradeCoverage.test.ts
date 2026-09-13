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
  'arabic:grade-6',
  'english:grade-6',
  'islamic:grade-6',
  'social:grade-6',
  'digital-literacy:grade-6',
  //
  // ORDINARY GAPS, WITH AN EXTRA STEP — a Grade 6 book exists for each, but
  // SUBJECTS.grades does not declare grade-6 for them yet (grade-7/8 for the
  // first two, grade-7/9 for the third). Closing these means extending that
  // array as well as ingesting the book, so do not read the undeclared range
  // as evidence the subject stops above Grade 6 — for these three it is the
  // declaration that trails the curriculum, not the reverse.
  'creative-arts:grade-6',
  'vocational-education:grade-6',
  'physical-education:grade-6',
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
