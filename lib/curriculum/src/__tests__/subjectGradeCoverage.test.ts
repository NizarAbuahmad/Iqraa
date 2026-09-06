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
 * of the 18 MVP pairs, 8 have no book, and all 8 are grade-9 — the grade has
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
  // Grade 9 is in MVP_GRADE_IDS for its mathematics books (S1 lesson-level,
  // S2 title-only). No other subject has been ingested for it.
  'chemistry:grade-9',
  'financial-literacy:grade-9',
  'english:grade-9',
  'physics:grade-9',
  'earth-science:grade-9',
  'biology:grade-9',
  'arabic:grade-9',
  'islamic:grade-9',
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
