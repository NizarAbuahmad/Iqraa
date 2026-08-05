import {
  MVP_BOOK_IDS,
  getBookById,
  getLessonsForUnit,
  getSemesterLabel,
  getUnitsForBook,
} from '@/services/curriculumData';
import type { CqvLessonRef } from './types';

const MATH_GRADE = {
  gradeId: 'grade-10',
  subjectId: 'mathematics',
  curriculum: 'Jordan Curriculum',
  curriculumAr: 'المنهاج الأردني',
} as const;

/** All Grade 10 Mathematics lessons in MVP books (Semester 1 + 2), stable order. */
export function getCqvLessons(): CqvLessonRef[] {
  const out: CqvLessonRef[] = [];

  for (const bookId of MVP_BOOK_IDS) {
    const book = getBookById(bookId);
    if (!book || book.subjectId !== MATH_GRADE.subjectId || book.gradeId !== MATH_GRADE.gradeId) {
      continue;
    }
    const semester = (book.semester === 2 ? 2 : 1) as 1 | 2;
    const units = getUnitsForBook(bookId);
    for (const unit of units) {
      const lessons = getLessonsForUnit(unit.id);
      for (const lesson of lessons) {
        out.push({
          lessonId: lesson.id,
          lessonName: lesson.title,
          lessonNameAr: lesson.titleAr || lesson.title,
          semester,
          semesterLabel: getSemesterLabel(book, 'en'),
          semesterLabelAr: getSemesterLabel(book, 'ar'),
          unitId: unit.id,
          unitName: unit.name,
          unitNameAr: unit.nameAr || unit.name,
          unitOrder: unit.order,
          bookId: book.id,
        });
      }
    }
  }

  return out;
}

export function getCqvLesson(lessonId: string): CqvLessonRef | undefined {
  return getCqvLessons().find(l => l.lessonId === lessonId);
}

export function getCqvScope() {
  return {
    ...MATH_GRADE,
    bookIds: [...MVP_BOOK_IDS],
    lessonCount: getCqvLessons().length,
  };
}

export function groupCqvLessonsBySemester(lessons = getCqvLessons()) {
  return {
    semester1: lessons.filter(l => l.semester === 1),
    semester2: lessons.filter(l => l.semester === 2),
  };
}
