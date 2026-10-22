/**
 * The Math Corner's exercises: pick a grade, pick a lesson from its book, then
 * learn (reveal each answer and its working) or test yourself (pick, get
 * marked, see a score).
 *
 * Nothing here is new content. The lessons are the book catalogs' own
 * (`knowledgeBase.ts`), and every item comes from the same lesson-keyed bank
 * the worksheet and quiz generators use (`ai/mathPractice.ts`), which refuses a
 * lesson it has nothing for — so the list shows only lessons that bank covers,
 * never a lesson padded with another grade's arithmetic.
 *
 * Every item is multiple choice so it marks itself: the bank's key is the
 * option as displayed, so marking is string equality, no answer parsing.
 *
 * The extracted Grade 10 book items (`@workspace/curriculum/bookItems`) are
 * deliberately not used: they are held behind `BOOK_ITEMS_LIVE` until a person
 * has compared them with the printed pages, and a student screen must not be
 * the way round that gate.
 */
import { getBookForLesson, getLessonById, getLessonsForUnit, getUnitsForSubjectGrade, type KBLesson, type KBUnit } from './knowledgeBase.ts';
import { hasMathBank, takeConcreteMath, type DiffTier, type Lang } from './ai/mathPractice.ts';

export const EXERCISES_ROUTE = '/curriculum/math/exercises';
export const EXERCISE_GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export const EXERCISE_COUNT = 10;

export interface Exercise {
  text: string;
  options: string[];
  answer: string;
  /** Checked working, only where a person wrote it (`steps.ts` in the bank). */
  steps?: string[];
}

export interface ExerciseUnit {
  unit: KBUnit;
  lessons: KBLesson[];
}

/** A grade's maths units in book order, each with only the lessons the bank covers; empty units dropped. */
export function exerciseUnits(grade: number): ExerciseUnit[] {
  return getUnitsForSubjectGrade('mathematics', `grade-${grade}`)
    .map(unit => ({ unit, lessons: getLessonsForUnit(unit.id).filter(l => hasMathBank(l.titleAr, l)) }))
    .filter(u => u.lessons.length > 0);
}

/** The lesson behind an untrusted route param, or null when it is not a covered maths lesson. */
export function resolveExerciseLesson(param: string | string[] | undefined): KBLesson | null {
  const id = Array.isArray(param) ? param[0] : param;
  const lesson = id ? getLessonById(id) : undefined;
  if (!lesson || !hasMathBank(lesson.titleAr, lesson)) return null;
  return lesson;
}

/** The lesson's book grade, 1–10, or null. */
export function exerciseGradeOf(lesson: KBLesson): number | null {
  const n = Number(getBookForLesson(lesson)?.gradeId?.match(/^grade-(\d+)$/)?.[1]);
  return (EXERCISE_GRADES as readonly number[]).includes(n) ? n : null;
}

/**
 * A fresh set for one lesson, easy → hard. Its own session set, so building it
 * neither drains nor is drained by the generators' module-wide one. An item
 * whose options do not hold its key, or that repeats a stem, is skipped, so a
 * thin lesson gives a shorter set rather than a broken or doubled question.
 */
export function buildExerciseSet(lesson: KBLesson, lang: Lang, count: number = EXERCISE_COUNT): Exercise[] {
  const session = new Set<string>();
  const out: Exercise[] = [];
  const seen = new Set<string>();
  // ponytail: fixed retry budget; a lesson with fewer distinct items just gives a shorter set.
  for (let tries = 0; out.length < count && tries < count * 3; tries++) {
    const at = out.length / count;
    const diff: DiffTier = at < 0.3 ? 'easy' : at < 0.7 ? 'medium' : 'hard';
    const q = takeConcreteMath('multiple_choice', lesson.titleAr, lesson, diff, lang, 1, session);
    if (!q?.options || q.options.length < 2 || !q.options.includes(q.answer)) continue;
    if (seen.has(q.text)) continue;
    seen.add(q.text);
    out.push({ text: q.text, options: q.options, answer: q.answer, ...(q.steps ? { steps: q.steps } : {}) });
  }
  return out;
}

export function exerciseLessonPath(lessonId: string): string {
  return `${EXERCISES_ROUTE}/${encodeURIComponent(lessonId)}`;
}
