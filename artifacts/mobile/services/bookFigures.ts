/**
 * The book's own figures, looked up by curriculum lesson.
 *
 * `scripts/extract_book_figures.py` cuts the figures out of the NCCD student
 * books and records where each one sits — `sourceId`, `pdfPage`, and the unit
 * and lesson **as the book prints them**. This module turns that into the
 * question the app actually asks: *what pictures belong to this lesson?*
 *
 * Why a checked-in map rather than matching at runtime
 * ────────────────────────────────────────────────────
 * The book and the curriculum disagree about lesson boundaries. The book
 * splits composition, inverse and radical functions into separate lessons
 * where `KB_LESSONS` merges them into one; the book opens unit 1 with a lesson
 * («حل معادلات خاصة») the curriculum does not carry at all, which shifts every
 * later unit-1 lesson by one. A fuzzy title match scored 0.67 between «Inverse
 * Function» and the merged lesson — high enough to look convincing, wrong
 * enough to file a figure under a lesson about something else.
 *
 * So the join lives in `knowledge-base/figure-lesson-map.json`, proposed by
 * title overlap and then read by a human. An entry with a null `kbLessonId`
 * means no lesson corresponds, and its figures simply go unused — the same
 * fail-closed posture the check-slide guard takes.
 */
// `with { type: 'json' }` is required by `node --test`, which runs these
// modules as real ESM — the same form lib/curriculum/src/sources.ts uses.
import figureMap from '../../../knowledge-base/figure-lesson-map.json' with { type: 'json' };
import mathS1 from '../../../knowledge-base/grade-10-math/figures/math-s1-student-book/index.json' with { type: 'json' };
import mathS2 from '../../../knowledge-base/grade-10-math/figures/math-s2-student-book/index.json' with { type: 'json' };

export type BookFigure = {
  /** File name inside the book's figure directory, e.g. `p021.png`. */
  file: string;
  /** Which book it was cut from — matches lib/curriculum's g10_sources.json. */
  sourceId: string;
  /** 1-based page in that PDF, so any figure can be checked against the book. */
  pdfPage: number;
  /** Unit and lesson AS PRINTED. Semester 1 prints units 5–8, semester 2 1–4. */
  unit: number | null;
  lesson: number | null;
  lessonTitleEn: string | null;
};

type MapEntry = {
  sourceId: string;
  unit: number;
  lesson: number;
  kbLessonId: string | null;
};

const INDEXES: { sourceId: string; figures: BookFigure[] }[] = [
  mathS1 as { sourceId: string; figures: BookFigure[] },
  mathS2 as { sourceId: string; figures: BookFigure[] },
];

/** `sourceId|unit|lesson`, the only key both files share. */
function coordinate(sourceId: string, unit: number | null, lesson: number | null): string {
  return `${sourceId}|${unit}|${lesson}`;
}

const BY_LESSON: Map<string, BookFigure[]> = (() => {
  const entries = (figureMap as { entries: MapEntry[] }).entries;
  const lessonAt = new Map<string, string>();
  for (const e of entries) {
    if (e.kbLessonId) lessonAt.set(coordinate(e.sourceId, e.unit, e.lesson), e.kbLessonId);
  }

  const out = new Map<string, BookFigure[]>();
  for (const index of INDEXES) {
    for (const figure of index.figures) {
      const kbLessonId = lessonAt.get(coordinate(figure.sourceId, figure.unit, figure.lesson));
      // No mapped lesson → the figure exists but nothing will ask for it. That
      // is the intended outcome for a book lesson the curriculum does not have.
      if (!kbLessonId) continue;
      const list = out.get(kbLessonId);
      if (list) list.push(figure);
      else out.set(kbLessonId, [figure]);
    }
  }
  // Page order, so a deck shows a lesson's figures in the order the book does.
  for (const list of out.values()) list.sort((a, b) => a.pdfPage - b.pdfPage);
  return out;
})();

/**
 * The figures printed in this curriculum lesson, in book order.
 *
 * Empty for a lesson with no mapped figures — which covers chemistry entirely,
 * every non-maths subject, and the one maths lesson the curriculum does not
 * carry. Callers show what they get and nothing when they get nothing.
 */
export function figuresForLesson(kbLessonId: string | null | undefined): BookFigure[] {
  if (!kbLessonId) return [];
  return BY_LESSON.get(kbLessonId) ?? [];
}

/** Every lesson that has at least one figure. Used by tooling and tests. */
export function lessonsWithFigures(): string[] {
  return [...BY_LESSON.keys()].sort();
}

/**
 * Where a figure's image file lives, relative to the repo root.
 *
 * Deliberately a path and not an imported asset: how these reach a running app
 * — bundled by Metro, or served — is not settled, and baking one answer into
 * the lookup would make the other expensive.
 */
export function figurePath(figure: BookFigure): string {
  const subject = figure.sourceId.startsWith('chem') ? 'grade-10-chemistry' : 'grade-10-math';
  return `knowledge-base/${subject}/figures/${figure.sourceId}/${figure.file}`;
}
