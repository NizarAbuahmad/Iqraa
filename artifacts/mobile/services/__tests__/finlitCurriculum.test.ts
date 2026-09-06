/**
 * Financial Literacy G10 S1 must be reachable from the curriculum browser.
 *
 * Regression guard: the subject shipped in MVP_SUBJECT_IDS (so it renders as a
 * tile) while no book existed in BOOKS, so tapping it dead-ended on the
 * "no semesters" empty state. Every picker surface that offers the subject must
 * lead somewhere.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  BOOKS,
  MVP_BOOK_IDS,
  MVP_GRADE_IDS,
  MVP_SUBJECT_IDS,
  getBooksForSubjectGrade,
  getLessonsForUnit,
  getPickerSubjects,
  getSubjectsForGrade,
  getUnitsForBook,
  isCurriculumBookVisible,
} from '../curriculumData.ts';

const FINLIT_BOOK = 'book-finlit-10';

describe('Financial Literacy G10 S1 — curriculum browser', () => {
  it('every MVP subject resolves to at least one visible book', () => {
    for (const subjectId of MVP_SUBJECT_IDS) {
      const books = getBooksForSubjectGrade(subjectId, 'grade-10', 'teacher');
      assert.ok(
        books.length > 0,
        `subject "${subjectId}" is offered in pickers but has no book — dead end`,
      );
    }
  });

  // The mirror of the assertion above. That one catches a subject offered with
  // no book; this one catches a book catalogued under a subject the pickers no
  // longer offer — the book becomes unreachable and nothing else notices,
  // because getBooksForSubjectGrade is never asked about that subject. The two
  // directions fail on opposite edits to MVP_SUBJECT_IDS, so both are needed:
  // dropping 'arabic' from the tail while ARABIC_S1_CURRICULUM_BOOK_ID stays in
  // MVP_BOOK_IDS passes the forward check and is caught only here.
  it('every MVP book belongs to an MVP subject', () => {
    for (const bookId of MVP_BOOK_IDS) {
      const book = BOOKS.find(b => b.id === bookId);
      assert.ok(book, `MVP_BOOK_IDS lists "${bookId}" but BOOKS has no such book`);
      assert.ok(
        MVP_SUBJECT_IDS.includes(book.subjectId),
        `book "${bookId}" is in MVP_BOOK_IDS but its subject "${book.subjectId}" is not in MVP_SUBJECT_IDS — the book is unreachable`,
      );
    }
  });

  // Both assertions above are per subject alone; this one is per subject/grade
  // PAIR. English earns its MVP place on Grade 10 books while SUBJECTS also
  // claims grade-9, where no book was ever ingested — so الصف التاسع listed an
  // اللغة الإنجليزية tile that opened on an empty book list. Ask
  // getSubjectsForGrade, since that is what the browser screen and
  // GET /curriculum/grades/:id/subjects actually list.
  it('every subject offered for a grade resolves to a book, in every MVP grade', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      for (const subject of getSubjectsForGrade(gradeId)) {
        const books = getBooksForSubjectGrade(subject.id, gradeId, 'teacher');
        assert.ok(
          books.length > 0,
          `subject "${subject.id}" is offered for ${gradeId} but has no book — dead end`,
        );
      }
    }
  });

  // Filtering subjects by book availability moves the dead end up a level: a
  // grade whose every subject is filtered out would render an empty grade.
  it('offers no grade that has been left with nothing to show', () => {
    for (const gradeId of MVP_GRADE_IDS) {
      assert.ok(
        getSubjectsForGrade(gradeId).length > 0,
        `grade "${gradeId}" is offered in pickers but has no subject — dead end`,
      );
    }
  });

  it('offers financial literacy in the picker and in the browser', () => {
    assert.ok(getPickerSubjects().some(s => s.id === 'financial-literacy'));
    assert.equal(isCurriculumBookVisible(FINLIT_BOOK), true);
  });

  it('exposes semester 1 only', () => {
    const books = getBooksForSubjectGrade('financial-literacy', 'grade-10', 'teacher');
    assert.deepEqual(books.map(b => b.id), [FINLIT_BOOK]);
    assert.equal(books[0].semester, 1);
  });

  it('exports both NCCD units in book order', () => {
    const units = getUnitsForBook(FINLIT_BOOK);
    assert.deepEqual(
      units.map(u => u.nameAr),
      ['إدارة المشروعات', 'دراسة الجدوى الاقتصادية للمشروعات الريادية'],
    );
    assert.ok(units.every(u => u.id.startsWith('kbu-finlit-s1-nccd-')));
  });

  it('gives all ten lessons objectives and a duration', () => {
    const lessons = getUnitsForBook(FINLIT_BOOK).flatMap(u => getLessonsForUnit(u.id));
    assert.equal(lessons.length, 10);
    for (const l of lessons) {
      assert.ok(l.titleAr.length > 0, `${l.id} has no Arabic title`);
      assert.ok(l.objectives.length > 0, `${l.id} has no objectives`);
      // The student book prints no حصص counts; one 45-min period is the floor.
      assert.ok(l.estimatedDuration >= 45, `${l.id} has no duration`);
    }
  });

  it('shares lesson ids with the knowledge base catalog', async () => {
    const { findFinlitSem1LessonByKbId } = await import('../curriculumG10FinlitSem1.ts');
    const lessons = getUnitsForBook(FINLIT_BOOK).flatMap(u => getLessonsForUnit(u.id));
    for (const l of lessons) {
      assert.ok(
        findFinlitSem1LessonByKbId(l.id),
        `browser lesson ${l.id} has no matching KB lesson`,
      );
    }
  });
});
