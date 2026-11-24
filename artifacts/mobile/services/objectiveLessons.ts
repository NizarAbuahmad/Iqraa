/**
 * Group a book's objectives under the lesson each belongs to.
 *
 * Pure, with no `react-native` import, so `node --test` can load it — see
 * CLAUDE.md on the mobile runner.
 */

/** What an objective already carries about where it sits in the book. */
export interface ObjectiveLessonInfo {
  lessonId: string;
  lessonTitle: string;
  lessonTitleAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
}

export interface LessonGroup<T extends ObjectiveLessonInfo> {
  lessonId: string;
  lessonTitle: string;
  lessonTitleAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
  objectives: T[];
}

/**
 * A book's objectives, grouped under the lesson each belongs to.
 *
 * The picker used to be one flat list, so a teacher choosing "an objective"
 * could not see which lesson the quiz would be for — and the lesson is what the
 * mastery gate unlocks (it is derived from the objective, never chosen). Groups
 * come out in first-seen order, which for `getObjectivesForBook` is catalog
 * order (unit, then lesson, then objective); a lesson that reappears later in the
 * list joins its first group rather than splitting, so every objective is
 * listed exactly once.
 */
export function groupObjectivesByLesson<T extends ObjectiveLessonInfo>(
  objectives: readonly T[],
): LessonGroup<T>[] {
  const groups = new Map<string, LessonGroup<T>>();
  for (const o of objectives) {
    let g = groups.get(o.lessonId);
    if (!g) {
      g = {
        lessonId: o.lessonId,
        lessonTitle: o.lessonTitle,
        lessonTitleAr: o.lessonTitleAr,
        unitId: o.unitId,
        unitName: o.unitName,
        unitNameAr: o.unitNameAr,
        objectives: [],
      };
      groups.set(o.lessonId, g);
    }
    g.objectives.push(o);
  }
  return [...groups.values()];
}

/** Every objective id of a book, in catalog order. */
export function allObjectiveIds(objectives: readonly { id: string }[]): string[] {
  return objectives.map(o => o.id);
}

/** True when the book has objectives and every one of them is ticked. */
export function isEverythingSelected(selected: ReadonlySet<string>, objectives: readonly { id: string }[]): boolean {
  return objectives.length > 0 && objectives.every(o => selected.has(o.id));
}

/**
 * The exam builder's «الكتاب كاملًا» row: everything off when everything is
 * on, otherwise everything on. In the exam builder a Grade 10 vocational
 * English track is its own book, so this is also «the whole track».
 */
export function toggleEverything(selected: ReadonlySet<string>, objectives: readonly { id: string }[]): Set<string> {
  return isEverythingSelected(selected, objectives) ? new Set() : new Set(allObjectiveIds(objectives));
}
