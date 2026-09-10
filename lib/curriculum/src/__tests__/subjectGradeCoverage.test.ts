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
  // science joined 2026-09-10 with its first-ever book (Grade 8, Semester 1).
  // Its two gaps are not the same kind, and the difference is the whole
  // reason this list is written out rather than derived:
  //   - science:grade-9 is ORDINARY. SUBJECTS.grades for science spans
  //     grade-1..grade-9, so a Grade 9 science book would close it the way
  //     any other pair closes — delete the line when one lands.
  //   - science:grade-10 is PERMANENT. Grade 10 has no «العلوم» book because
  //     it teaches the subject split into physics/chemistry/biology/
  //     earth-science. That is the exact mirror of the four grade-8 entries
  //     above: those four are permanently bookless at grade-8 because Grade 8
  //     combines them into this one science book. Same fact, read from each
  //     end.
  'science:grade-9',
  'science:grade-10',
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
