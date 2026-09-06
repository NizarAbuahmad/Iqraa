/**
 * The exercises the ministry's exercise books actually print, by lesson.
 *
 * Decks have always been able to say «تمارين ١-٦ صفحة ٧٢». Until now that was
 * generated text, which is to say invented — the page and the numbers pointed
 * at nothing, and a teacher who followed one found a different lesson. This
 * module answers the same question from `scripts/extract_book_exercises.py`,
 * which reads the books themselves.
 *
 * How the join works, and why it is derived rather than hand-made
 * ───────────────────────────────────────────────────────────────
 * The curriculum's `u{n}_l{m}` is the number the book PRINTS in every unit but
 * one, so the join is arithmetic — with a single documented exception.
 *
 * Unit 1 is that exception. The books open it with «حل معادلات خاصة», which
 * the curriculum deliberately does not carry: see the `title_note` on unit 1
 * in `iqra_curriculum_g10_math_sem1.json`, which records that the teacher
 * guide's lesson set was adopted after a check against الإطار الوطني 2024.
 * Everything after it therefore sits one place lower in the curriculum than
 * the number the book prints.
 *
 * The figure map was NOT reused, though it encodes the same relationship: it
 * only carries rows for lessons that happen to have a figure, so joining
 * through it covered 18 of 32 lessons and silently dropped the rest.
 *
 * Arithmetic is only safe because it is checked. `bookExercises.test.ts`
 * walks every derived id, asserts it exists in `KB_LESSONS`, and asserts the
 * curriculum's title for it matches the title the exercise book prints — so a
 * renumbered edition fails the suite instead of quietly citing the wrong page.
 */
// `with { type: 'json' }` is required by `node --test`, which runs these
// modules as real ESM — the same form lib/curriculum/src/sources.ts uses.
import exS1 from '../../../knowledge-base/grade-10-math/exercises/math-s1-exercise-book/index.json' with { type: 'json' };
import exS2 from '../../../knowledge-base/grade-10-math/exercises/math-s2-exercise-book/index.json' with { type: 'json' };

export type BookExercises = {
  /** Which exercise book — matches lib/curriculum's g10_sources.json. */
  sourceId: string;
  /** 1-based page in that PDF, as a teacher would cite it. */
  page: number;
  /** Unit and lesson as the book prints them. */
  unit: number | null;
  lesson: number | null;
  /** How many exercises the lesson prints, numbered 1..N. */
  exerciseCount: number;
};

type IndexRow = {
  page: number;
  unit: number | null;
  lesson: number | null;
  titleAr: string | null;
  titleEn: string | null;
  exerciseCount: number;
  exercisesTrusted: boolean;
};

const INDEXES: { sourceId: string; lessons: IndexRow[] }[] = [
  exS1 as { sourceId: string; lessons: IndexRow[] },
  exS2 as { sourceId: string; lessons: IndexRow[] },
];

/** `math-s1-exercise-book` and `math-s1-student-book` share a semester. */
function semesterOf(sourceId: string): string | null {
  const m = /^math-(s[12])-/.exec(sourceId);
  return m ? m[1]! : null;
}

/**
 * The curriculum lesson a printed (unit, lesson) belongs to, or null.
 *
 * Exported so the test can walk the same function the lookup uses, rather
 * than a re-implementation of it that could agree while both are wrong.
 */
export function curriculumLessonId(
  semester: string,
  unit: number | null,
  lesson: number | null,
): string | null {
  if (unit === null || lesson === null) return null;
  if (unit === 1) {
    // The book's «حل معادلات خاصة» is lesson 1 and has no curriculum
    // counterpart; the rest shift down one.
    if (lesson === 1) return null;
    return `kbl-math-${semester}-nccd-u1_l${lesson - 1}`;
  }
  return `kbl-math-${semester}-nccd-u${unit}_l${lesson}`;
}

const BY_LESSON: Map<string, BookExercises> = (() => {
  const out = new Map<string, BookExercises>();
  for (const index of INDEXES) {
    const semester = semesterOf(index.sourceId);
    if (!semester) continue;
    for (const row of index.lessons) {
      // Untrusted numbering is treated as no exercises: the extractor could not
      // read a clean 1..N, and a count it does not believe is worse than none.
      if (!row.exercisesTrusted || row.exerciseCount <= 0) continue;
      const kbLessonId = curriculumLessonId(semester, row.unit, row.lesson);
      if (!kbLessonId) continue;
      out.set(kbLessonId, {
        sourceId: index.sourceId,
        page: row.page,
        unit: row.unit,
        lesson: row.lesson,
        exerciseCount: row.exerciseCount,
      });
    }
  }
  return out;
})();

/**
 * The exercise-book page for this curriculum lesson, or null.
 *
 * Null for every lesson the books do not carry exercises for — chemistry, the
 * GeoGebra labs, and the two unit-1 lessons the exercise book omits. Callers
 * show a reference when there is one and say nothing when there is not; they
 * must never fall back to inventing a page.
 */
export function exercisesForLesson(kbLessonId: string | null | undefined): BookExercises | null {
  if (!kbLessonId) return null;
  return BY_LESSON.get(kbLessonId) ?? null;
}

/** Every lesson with a real exercise reference. Used by tooling and tests. */
export function lessonsWithExercises(): string[] {
  return [...BY_LESSON.keys()].sort();
}

/**
 * «تمارين ١-١٨، صفحة ١٠» — what a teacher writes on the board.
 *
 * Arabic digits at display time only, per the repo's convention; `page` and
 * `exerciseCount` stay latin numbers everywhere else.
 */
export function exerciseReference(ex: BookExercises, isAr: boolean): string {
  const digits = (n: number) =>
    isAr ? String(n).replace(/[0-9]/g, d => '٠١٢٣٤٥٦٧٨٩'[Number(d)]!) : String(n);
  const range = ex.exerciseCount === 1 ? digits(1) : `${digits(1)}-${digits(ex.exerciseCount)}`;
  return isAr
    ? `تمارين ${range}، صفحة ${digits(ex.page)}`
    : `Exercises ${range}, page ${digits(ex.page)}`;
}
