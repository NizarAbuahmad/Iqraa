/**
 * The body of `PUT /student/math-practice`: a finished «اختبر نفسك» set from
 * the Math Corner. Pure, so it is tested without a database.
 */
import { getBookById, getLessonById, getUnitById } from "@workspace/curriculum";

/** The app's sets are ten questions; a little headroom, no more. */
export const PRACTICE_TOTAL_MAX = 20;
const LESSON_ID_MAX = 120;

export interface PracticeInput { lessonId: string; correct: number; total: number }

/** A catalog lesson whose book is mathematics. */
export function isMathsLesson(lessonId: string): boolean {
  const lesson = getLessonById(lessonId);
  const unit = lesson && getUnitById(lesson.unitId);
  return getBookById(unit?.bookId ?? "")?.subjectId === "mathematics";
}

/** `{ lessonId, correct, total }`: a maths lesson id, integers, 0 ≤ correct ≤ total, 1 ≤ total ≤ 20. */
export function parsePractice(body: unknown): { ok: true; value: PracticeInput } | { ok: false; error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const { lessonId, correct, total } = b;
  if (typeof lessonId !== "string" || lessonId === "" || lessonId.length > LESSON_ID_MAX || !isMathsLesson(lessonId)) {
    return { ok: false, error: "lessonId must be a mathematics lesson id" };
  }
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > PRACTICE_TOTAL_MAX) {
    return { ok: false, error: `total must be an integer from 1 to ${PRACTICE_TOTAL_MAX}` };
  }
  if (!Number.isInteger(correct) || (correct as number) < 0 || (correct as number) > (total as number)) {
    return { ok: false, error: "correct must be an integer from 0 to total" };
  }
  return { ok: true, value: { lessonId, correct: correct as number, total: total as number } };
}
