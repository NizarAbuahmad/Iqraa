/**
 * The library's «صور الكتاب»: every book figure the app can show, filed in
 * folders by grade, then subject, then lesson.
 *
 * Built from the lessons that HAVE figures (`lessonsWithFigures`, ~600) rather
 * than by walking every lesson of every subject (~3,300), and only once. A
 * figure counts only if it is in `BOOK_FIGURE_KEYS` — the same check
 * `bookFigureUri` makes, done here directly because that module cannot load
 * under `node --test` — and a lesson only if the KB shows it.
 */
import { BOOK_FIGURE_KEYS } from './bookFigureAssets.ts';
import { figuresForLesson, lessonsWithFigures } from './bookFigures.ts';
import { getBookForLesson, getLessonById, getUnitForLesson, type KBLesson } from './knowledgeBase.ts';

export type ImageLesson = {
  lesson: KBLesson;
  unitTitleAr: string;
  unitTitleEn: string;
  /** Book semester, unit order, lesson order: the book's own reading order. */
  sortKey: [number, number, number];
  /** Figures that resolve to a served image. */
  count: number;
};

/** grade id → subject id → lessons in book order. */
type Tree = Map<string, Map<string, ImageLesson[]>>;

let tree: Tree | null = null;

function buildTree(): Tree {
  const out: Tree = new Map();
  for (const id of lessonsWithFigures()) {
    const lesson = getLessonById(id);
    const book = lesson && getBookForLesson(lesson);
    const unit = lesson && getUnitForLesson(lesson);
    if (!lesson || !book || !unit) continue;
    const count = figuresForLesson(id).filter(f => BOOK_FIGURE_KEYS.has(`${f.sourceId}/${f.file}`)).length;
    if (!count) continue;
    const subjects = out.get(book.gradeId) ?? new Map<string, ImageLesson[]>();
    out.set(book.gradeId, subjects);
    const list = subjects.get(book.subjectId) ?? [];
    subjects.set(book.subjectId, list);
    list.push({
      lesson,
      unitTitleAr: unit.titleAr,
      unitTitleEn: unit.titleEn,
      sortKey: [book.semester, unit.order, lesson.order],
      count,
    });
  }
  for (const subjects of out.values()) {
    for (const list of subjects.values()) {
      list.sort((a, b) => a.sortKey[0] - b.sortKey[0] || a.sortKey[1] - b.sortKey[1] || a.sortKey[2] - b.sortKey[2]);
    }
  }
  return out;
}

function getTree(): Tree {
  return (tree ??= buildTree());
}

const sum = (lessons: ImageLesson[]) => lessons.reduce((n, l) => n + l.count, 0);

/** Image count per grade, for the grade folders. Grades with none are absent. */
export function imageCountByGrade(): Map<string, number> {
  const out = new Map<string, number>();
  for (const [grade, subjects] of getTree()) out.set(grade, [...subjects.values()].reduce((n, l) => n + sum(l), 0));
  return out;
}

/** Image count per subject of one grade. Subjects with none are absent. */
export function imageCountBySubject(gradeId: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [subject, lessons] of getTree().get(gradeId) ?? []) out.set(subject, sum(lessons));
  return out;
}

/** One subject's lessons that have images, in book order. */
export function imageLessons(gradeId: string, subjectId: string): ImageLesson[] {
  return getTree().get(gradeId)?.get(subjectId) ?? [];
}
