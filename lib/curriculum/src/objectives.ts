/**
 * Learning-objective index.
 *
 * The evaluation module generates and grades questions *against objectives*, so
 * it needs to resolve an objective id to its text, its lesson, and its cognitive
 * level without trusting anything a client sends. This module is that lookup.
 *
 * On `bloomsSource` — read this before using `bloomsLevel` for anything:
 *
 * The hand-authored outcomes in `catalog.ts` carry a real Bloom's spread
 * (Remember through Evaluate). The NCCD-derived ones do not: the browser-catalog
 * builders stamp every derived outcome `'Understand'` with no skills, because
 * the source JSON has objective *text* but no cognitive classification.
 *
 * That covers every subject built from NCCD JSON — 502 of the 507 objectives
 * in the catalog, i.e. essentially everything the product ships. Only five are
 * hand-classified (`o-chem-1`, `o-chem-2`, `o-chem-s2-5`, `o-sci-1`). Treating
 * the rest as genuine 'Understand' would collapse the whole competency
 * breakdown into a single bar, so this module reports where the value came from
 * instead of hiding the difference.
 *
 * Classifying the derived objectives properly (Arabic action verb → Bloom's
 * level) belongs with the generator that needs it. Until then, consumers must
 * branch on `bloomsSource` rather than assume.
 */
import { classifyBlooms, type BloomsLevel } from './blooms.ts';
import { isDerivedObjectiveId } from './curriculumIds.ts';
import {
  BOOKS,
  LESSONS,
  UNITS,
  getBookById,
  getLessonById,
  getUnitById,
  type LearningOutcome,
  type Lesson,
} from './catalog.ts';

/** Where an objective's Bloom's level came from. */
export type BloomsSource =
  /** Classified by a human in the catalog. Trustworthy. */
  | 'authored'
  /** Stamped 'Understand' by a catalog builder because the source had none. */
  | 'defaulted';

/** An objective plus everything needed to place it in the curriculum. */
export interface CurriculumObjective extends LearningOutcome {
  bloomsSource: BloomsSource;
  /**
   * Level inferred from the objective's own wording. Populated only where the
   * stored level was defaulted — an authored classification is a human's call
   * and a keyword heuristic has no business overruling it.
   */
  inferredBloomsLevel: BloomsLevel | null;
  /**
   * What a consumer should actually use: the authored level when there is one,
   * the inferred level otherwise, falling back to the stored value.
   */
  effectiveBloomsLevel: BloomsLevel;
  lessonTitle: string;
  lessonTitleAr: string;
  unitId: string;
  unitName: string;
  unitNameAr: string;
  bookId: string;
  subjectId: string;
  gradeId: string;
}

/**
 * All 14 NCCD catalog builders mint their outcome ids through `objectiveId`
 * and hardcode `bloomsLevel: 'Understand'`, so asking that function what it
 * emits is the whole test — see `isDerivedObjectiveId`.
 *
 * This was a literal list of prefixes maintained here by hand, and a builder
 * whose prefix was missing silently claimed `authored` for a level no human
 * ever chose. It went wrong twice. Note the shape it has to get right:
 * chemistry S2 first shipped as `o-chem-s2-…`, which collided with the
 * hand-authored `o-chem-s2-5-1`; hence the `o-nccd-` prefix on generated ids
 * and hence a prefix check rather than a subject check.
 */
function bloomsSourceOf(outcomeId: string): BloomsSource {
  return isDerivedObjectiveId(outcomeId) ? 'defaulted' : 'authored';
}

function expand(lesson: Lesson): CurriculumObjective[] {
  const unit = getUnitById(lesson.unitId);
  const book = unit ? getBookById(unit.bookId) : undefined;
  return lesson.outcomes.map(o => {
    const source = bloomsSourceOf(o.id);
    const inferred =
      source === 'defaulted' ? classifyBlooms(o.descriptionAr || o.description) : null;
    return {
    ...o,
    bloomsSource: source,
    inferredBloomsLevel: inferred,
    effectiveBloomsLevel: (source === 'authored' ? o.bloomsLevel : inferred ?? o.bloomsLevel) as BloomsLevel,
    lessonTitle: lesson.title,
    lessonTitleAr: lesson.titleAr,
    unitId: lesson.unitId,
    unitName: unit?.name ?? '',
    unitNameAr: unit?.nameAr ?? '',
    bookId: unit?.bookId ?? '',
    subjectId: book?.subjectId ?? '',
    gradeId: book?.gradeId ?? '',
    };
  });
}

/** Every objective in the catalog, indexed by id. Built once at module load. */
const OBJECTIVE_INDEX: ReadonlyMap<string, CurriculumObjective> = new Map(
  LESSONS.flatMap(expand).map(o => [o.id, o]),
);

/** All objectives, in catalog order. */
export function getAllObjectives(): CurriculumObjective[] {
  return [...OBJECTIVE_INDEX.values()];
}

/** Resolve one objective id. Returns undefined for ids not in the catalog. */
export function getObjectiveById(id: string): CurriculumObjective | undefined {
  return OBJECTIVE_INDEX.get(id);
}

/**
 * Resolve many ids at once, reporting the ones that don't exist.
 *
 * Evaluation generation must never silently drop an objective a teacher chose —
 * a 15-question evaluation quietly targeting 2 of 3 objectives looks fine and
 * measures the wrong thing. Callers get the misses back and decide.
 */
export function resolveObjectiveIds(ids: readonly string[]): {
  found: CurriculumObjective[];
  missing: string[];
} {
  const found: CurriculumObjective[] = [];
  const missing: string[] = [];
  for (const id of ids) {
    const hit = OBJECTIVE_INDEX.get(id);
    if (hit) found.push(hit);
    else missing.push(id);
  }
  return { found, missing };
}

/** Objectives for one lesson, in the order the catalog lists them. */
export function getObjectivesForLesson(lessonId: string): CurriculumObjective[] {
  const lesson = getLessonById(lessonId);
  return lesson ? expand(lesson) : [];
}

/**
 * The lessons a set of objectives covers, in the order they name them.
 *
 * The derivation an evaluation needs. An exam is scoped by **objectives**, not
 * by a lesson: `evaluations.lessonId` is a real column and is always null,
 * because no client has ever sent it. Anything that wants an evaluation's
 * lesson — the book-figure panel on the student's paper and on the teacher's
 * review screen — has to come through here.
 *
 * Deriving it rather than reading that column is deliberate. `objectiveIds` is
 * validated at create time (`objectivesAreWithinBook`) and generation refuses
 * to run unscoped, whereas `lessonId` is free text nothing checks. Filing the
 * wrong book's diagram onto an exam paper is the failure this avoids.
 *
 * Lives here rather than beside either caller because both the API and the app
 * need it and they cannot import each other — the duplication this replaces
 * was six identical lines in `routes/studentAttempt.ts` and
 * `artifacts/mobile/services/bookFigures.ts`.
 *
 * Unknown ids are skipped, not thrown on: an objective can be retired from the
 * curriculum while an old evaluation still names it, and an exam that renders
 * without a picture beats one that will not open.
 */
export function lessonIdsForObjectiveIds(
  objectiveIds: readonly string[] | null | undefined,
): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const id of objectiveIds ?? []) {
    const lessonId = OBJECTIVE_INDEX.get(id)?.lessonId;
    if (!lessonId || seen.has(lessonId)) continue;
    seen.add(lessonId);
    out.push(lessonId);
  }
  return out;
}

/** Objectives across every lesson in a unit. */
export function getObjectivesForUnit(unitId: string): CurriculumObjective[] {
  return LESSONS.filter(l => l.unitId === unitId).flatMap(expand);
}

/** Objectives across every unit in a book. */
export function getObjectivesForBook(bookId: string): CurriculumObjective[] {
  const unitIds = new Set(UNITS.filter(u => u.bookId === bookId).map(u => u.id));
  return LESSONS.filter(l => unitIds.has(l.unitId)).flatMap(expand);
}

/**
 * True when every id belongs to the given book — the scope check that keeps
 * generation inside the grade and subject the teacher picked (AI rule 1).
 */
export function objectivesAreWithinBook(
  ids: readonly string[],
  bookId: string,
): boolean {
  if (ids.length === 0) return false;
  return ids.every(id => OBJECTIVE_INDEX.get(id)?.bookId === bookId);
}

/**
 * Coverage report for a book — how much of the catalog carries a real cognitive
 * classification. Surfaces the 'defaulted' problem instead of burying it.
 */
export function bloomsCoverage(bookId?: string): {
  total: number;
  authored: number;
  defaulted: number;
} {
  const scope = bookId ? getObjectivesForBook(bookId) : getAllObjectives();
  const authored = scope.filter(o => o.bloomsSource === 'authored').length;
  return { total: scope.length, authored, defaulted: scope.length - authored };
}

/** Books that have at least one objective — the ones an evaluation can target. */
export function getEvaluableBookIds(): string[] {
  return BOOKS.filter(b => getObjectivesForBook(b.id).length > 0).map(b => b.id);
}
