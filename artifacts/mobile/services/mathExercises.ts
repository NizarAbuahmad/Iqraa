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

/** A finished test-yourself set: how many of how many. */
export interface ExerciseScore {
  correct: number;
  total: number;
}

/** Best score per lesson id. */
export type ExerciseBests = Record<string, ExerciseScore>;

/** Stored JSON → bests; anything malformed is dropped, never thrown. */
export function parseBests(raw: string | null): ExerciseBests {
  let data: unknown;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    return {};
  }
  const out: ExerciseBests = {};
  if (!data || typeof data !== 'object') return out;
  for (const [id, v] of Object.entries(data as Record<string, unknown>)) {
    const { correct, total } = (v ?? {}) as Partial<ExerciseScore>;
    if (Number.isInteger(correct) && Number.isInteger(total) && total! > 0 && correct! >= 0 && correct! <= total!) {
      out[id] = { correct: correct!, total: total! };
    }
  }
  return out;
}

/**
 * Keep the better of the old and new score, compared as a fraction because a
 * thin lesson's set can be shorter than ten. A tie keeps the longer set.
 */
export function recordBest(bests: ExerciseBests, lessonId: string, score: ExerciseScore): ExerciseBests {
  const old = bests[lessonId];
  if (score.total <= 0) return bests;
  if (old) {
    const diff = score.correct * old.total - old.correct * score.total;
    if (diff < 0 || (diff === 0 && score.total <= old.total)) return bests;
  }
  return { ...bests, [lessonId]: score };
}

/** One student's best score on one lesson, as `GET /classes/:id/math-practice` sends it. */
export interface ClassPracticeRow extends ExerciseScore {
  studentId: string;
  displayName: string;
  lessonId: string;
  attempts: number;
  practicedAt: string;
}

/** The server's rows, with anything malformed dropped; an absent list is none. */
export function normalizeClassPractice(raw: unknown): ClassPracticeRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((r): ClassPracticeRow[] => {
    const o = (r ?? {}) as Record<string, unknown>;
    const { studentId, displayName, lessonId, correct, total, attempts, practicedAt } = o;
    if (typeof studentId !== 'string' || typeof lessonId !== 'string' || !studentId || !lessonId) return [];
    if (!Number.isInteger(correct) || !Number.isInteger(total) || (total as number) <= 0) return [];
    return [{
      studentId,
      displayName: typeof displayName === 'string' ? displayName : '',
      lessonId,
      correct: correct as number,
      total: total as number,
      attempts: Number.isInteger(attempts) ? (attempts as number) : 1,
      practicedAt: typeof practicedAt === 'string' ? practicedAt : '',
    }];
  });
}

/** Rows grouped per student, in the order the server sent them (by name). */
export function practiceByStudent(rows: readonly ClassPracticeRow[]): Array<{ studentId: string; displayName: string; lessons: ClassPracticeRow[] }> {
  const out = new Map<string, { studentId: string; displayName: string; lessons: ClassPracticeRow[] }>();
  for (const r of rows) {
    const g = out.get(r.studentId) ?? { studentId: r.studentId, displayName: r.displayName, lessons: [] };
    g.lessons.push(r);
    out.set(r.studentId, g);
  }
  return [...out.values()];
}

/** One lesson across a class: how many students practised it and their average best, 0–100. */
export interface LessonPracticeSummary {
  lesson: KBLesson;
  practised: number;
  /** Mean of each student's best ratio, as a whole percent; null when nobody practised. */
  averagePct: number | null;
}

export interface ClassPracticeByLesson {
  units: Array<{ unit: KBUnit; lessons: LessonPracticeSummary[] }>;
  practisedLessons: number;
  totalLessons: number;
}

/**
 * The class's grade, lesson by lesson in book order (every lesson the Math
 * Corner covers, practised or not), so a teacher sees what nobody has touched.
 * A row for a lesson outside the grade is left out here; the per-student view
 * still shows it. `grade` comes from the class (`grade-5` → 5).
 */
export function practiceByLesson(rows: readonly ClassPracticeRow[], grade: number): ClassPracticeByLesson {
  const byLesson = new Map<string, ClassPracticeRow[]>();
  for (const r of rows) byLesson.set(r.lessonId, [...(byLesson.get(r.lessonId) ?? []), r]);
  let practisedLessons = 0;
  let totalLessons = 0;
  const units = exerciseUnits(grade).map(({ unit, lessons }) => ({
    unit,
    lessons: lessons.map((lesson): LessonPracticeSummary => {
      const got = byLesson.get(lesson.id) ?? [];
      totalLessons++;
      if (got.length === 0) return { lesson, practised: 0, averagePct: null };
      practisedLessons++;
      const mean = got.reduce((s, r) => s + r.correct / r.total, 0) / got.length;
      return { lesson, practised: new Set(got.map(r => r.studentId)).size, averagePct: Math.round(mean * 100) };
    }),
  }));
  return { units, practisedLessons, totalLessons };
}

/** `grade-5` → 5, or null for a class with no exercise grade. */
export function exerciseGradeOfClass(gradeId: string | null | undefined): number | null {
  const n = Number(gradeId?.match(/^grade-(\d+)$/)?.[1]);
  return (EXERCISE_GRADES as readonly number[]).includes(n) ? n : null;
}

export function exerciseLessonPath(lessonId: string): string {
  return `${EXERCISES_ROUTE}/${encodeURIComponent(lessonId)}`;
}
