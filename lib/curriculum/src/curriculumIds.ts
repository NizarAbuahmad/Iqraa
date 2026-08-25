/**
 * The one place that decides what a curriculum id looks like.
 *
 * ## Why this exists
 *
 * Every id in the catalog omits the grade. A unit is `kbu-math-s1-nccd-u2`, a
 * lesson `kbl-math-s1-nccd-u2_l1`, an objective `o-nccd-s1-u2_l1-0`, a bank tag
 * `s1-u2`. Grade 9 maths semester 1 unit 2 wants *the identical string* for all
 * four. Nothing today would notice: there is no uniqueness check, so a second
 * grade would silently overwrite the first in every `Map` keyed by unit id.
 *
 * The grade was never missing from the data — every unit reaches one through
 * `book.gradeId`, and the catalog already spans `grade-10` and a `grade-8`
 * science stub. It was missing only from the strings, and only because each of
 * the five catalog modules interpolated its own prefix inline:
 * `` `kbu-math-s1-nccd-${jsonUnitId}` ``, five times, with five different
 * objective shapes and the prefix repeated again as a string literal wherever
 * an id had to be parsed back apart.
 *
 * ## What it does *not* do
 *
 * **Grade 10's ids do not change.** Not one byte. `evaluations.unitId`,
 * `evaluations.lessonId`, `evaluations.objectiveIds` and
 * `evaluation_questions.objectiveId` are free-text columns in Postgres holding
 * these exact strings, so renaming them is a data migration over live student
 * work — a decision to make against a row count, not in passing. See the open
 * decision in the plan.
 *
 * So `grade-10` gets the historical form and every other grade gets an explicit
 * `g{n}` segment. That *is* an implicit default, which this repo has been
 * bitten by before — the difference is that it now lives in one documented
 * function with a test on it, rather than in five files as an unwritten
 * assumption.
 */

/** Subject slug as it appears inside an id. Not the app's `subjectId`. */
export type SubjectSlug = 'math' | 'chem' | 'finlit';

export interface CurriculumIdScope {
  /** Catalog grade id, e.g. `grade-10`. */
  gradeId: string;
  subject: SubjectSlug;
  semester: 1 | 2;
}

/** The grade every legacy id belongs to, and the only one with no segment. */
export const IMPLICIT_GRADE_ID = 'grade-10';

/** `grade-9` → `g9`. */
function gradeSlug(gradeId: string): string {
  const n = /^grade-(\d+)$/.exec(gradeId)?.[1];
  return n ? `g${n}` : gradeId;
}

/**
 * The `{grade-}{subject}-s{n}-nccd` middle every unit and lesson id shares.
 *
 * Empty grade segment for Grade 10 keeps `kbu-math-s1-nccd-u2` exactly as it
 * has always been; `grade-9` yields `kbu-g9-math-s1-nccd-u2`.
 */
export function scopeSegment(scope: CurriculumIdScope): string {
  const grade = scope.gradeId === IMPLICIT_GRADE_ID ? '' : `${gradeSlug(scope.gradeId)}-`;
  return `${grade}${scope.subject}-s${scope.semester}-nccd`;
}

/** Prefix a unit id starts with, for the places that parse one back apart. */
export function unitKbPrefix(scope: CurriculumIdScope): string {
  return `kbu-${scopeSegment(scope)}-`;
}

/** Prefix a lesson id starts with. */
export function lessonKbPrefix(scope: CurriculumIdScope): string {
  return `kbl-${scopeSegment(scope)}-`;
}

/** `u2` → `kbu-math-s1-nccd-u2`. */
export function unitKbId(scope: CurriculumIdScope, jsonUnitId: string): string {
  return `${unitKbPrefix(scope)}${jsonUnitId}`;
}

/** `u2_l1` → `kbl-math-s1-nccd-u2_l1`. */
export function lessonKbId(scope: CurriculumIdScope, jsonLessonId: string): string {
  return `${lessonKbPrefix(scope)}${jsonLessonId}`;
}

/**
 * The objective id prefixes Grade 10 already shipped, which are not consistent
 * with each other and cannot be made so without rewriting stored rows.
 *
 * Note `math-s2` carries no semester segment at all. Maths S1 covers units 1–4
 * and S2 covers 5–8, so `o-nccd-u5_l3-0` happens not to collide with anything —
 * by luck of the unit numbering, not by design. Recorded here rather than
 * tidied away, because it is the reason this table cannot just be a format
 * string.
 */
const LEGACY_OBJECTIVE_PREFIX: Record<string, string> = {
  'math-s1': 'o-nccd-s1-',
  'math-s2': 'o-nccd-',
  'chem-s1': 'o-nccd-chem-s1-',
  'chem-s2': 'o-nccd-chem-s2-',
  'finlit-s1': 'o-finlit-s1-',
};

/**
 * `u2_l1`, index 0 → `o-nccd-s1-u2_l1-0`.
 *
 * Grade 10 reproduces whatever that catalog historically emitted. Every other
 * grade gets the uniform `o-{grade}-{subject}-s{n}-` shape, so the
 * inconsistency above stops spreading at the grade boundary.
 */
export function objectiveId(
  scope: CurriculumIdScope,
  jsonLessonId: string,
  index: number,
): string {
  const key = `${scope.subject}-s${scope.semester}`;
  const prefix = scope.gradeId === IMPLICIT_GRADE_ID
    ? LEGACY_OBJECTIVE_PREFIX[key] ?? `o-${key}-`
    : `o-${gradeSlug(scope.gradeId)}-${key}-`;
  return `${prefix}${jsonLessonId}-${index}`;
}

/**
 * Any NCCD unit id, with or without a grade segment.
 *
 * One pattern, because there were three: `bankTagsForUnit` in `bank.ts`,
 * `UNIT_ID` in the API server's `grounding.ts`, and `nccdUnitId` in the app's
 * `kbContext.ts`. Three copies of a shape that was about to gain a segment is
 * three chances to update two of them.
 */
const UNIT_ID_RE = /^kbu-(?:g(\d+)-)?(math|chem|finlit)-s([12])-nccd-u(\d+)$/;

export interface ParsedUnitId {
  gradeId: string;
  subject: SubjectSlug;
  semester: 1 | 2;
  /** Unit number as printed in the id, e.g. `2` from `…-u2`. */
  unit: number;
}

/** Pull a unit id apart, or `null` when it is not one. */
export function parseUnitKbId(unitId: string): ParsedUnitId | null {
  const m = UNIT_ID_RE.exec(unitId);
  if (!m) return null;
  const [, grade, subject, semester, unit] = m;
  return {
    gradeId: grade ? `grade-${grade}` : IMPLICIT_GRADE_ID,
    subject: subject as SubjectSlug,
    semester: Number(semester) as 1 | 2,
    unit: Number(unit),
  };
}

/**
 * Whether a string is a unit id the bank can scope by.
 *
 * The app's KB also carries legacy hardcoded rows with ids like `kbu-chem-1`,
 * which are not in this namespace and resolve to no bank material. Callers use
 * this to tell the two apart rather than each keeping their own regex.
 */
export function isNccdUnitId(value: string | null | undefined): boolean {
  return typeof value === 'string' && UNIT_ID_RE.test(value);
}

/**
 * Bank tags a document must carry to belong to this unit, most specific first.
 *
 * Grade 10 keeps the tag vocabulary already written into all 78 manifest rows:
 * maths is bare (`s1-u2`, `s1`), chemistry is prefixed (`chem-s1-u2`), and
 * financial literacy gets only a semester tag because the bank holds no
 * unit-level material for it — emitting `finlit-s1-u1` would invent a tag
 * nothing can carry.
 *
 * Other grades are explicit on both axes (`g9-math-s1-u2`, `g9-math-s1`). Maths
 * stops being the silent default the moment there is a second grade to be
 * silent about.
 */
export function bankTagsForParsedUnit(parsed: ParsedUnitId): string[] {
  const { gradeId, subject, semester, unit } = parsed;

  if (gradeId === IMPLICIT_GRADE_ID) {
    if (subject === 'finlit') return [`finlit-s${semester}`];
    const prefix = subject === 'chem' ? 'chem-s' : 's';
    return [`${prefix}${semester}-u${unit}`, `${prefix}${semester}`];
  }

  const scope = `${gradeSlug(gradeId)}-${subject}-s${semester}`;
  if (subject === 'finlit') return [scope];
  return [`${scope}-u${unit}`, scope];
}
