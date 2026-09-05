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

/**
 * Every subject that can appear inside an id, and what its ids are made of.
 *
 * One row per subject, and `keyof typeof` makes the compiler demand it. This
 * knowledge used to sit in three independent lists — `UNIT_ID_RE`'s
 * alternation below, `DERIVED_OUTCOME_PREFIXES` in `objectives.ts`, and the tag
 * vocabulary in `bankTagsForParsedUnit` — so adding a subject meant updating
 * three things that nothing tied together. Physics, earth science and biology
 * arrived on 2026-09-03 in none of them: their 15 units failed `isNccdUnitId`,
 * so grounding resolved no book passages for any of them, and their 141
 * objectives reported a human `authored` Bloom's level while carrying the
 * builder's blanket 'Understand'. Both read as "the subject is just quiet".
 *
 * `tag` is the bank-tag stem. Grade 10 maths is empty because its tags are bare
 * (`s1-u2`) — the vocabulary written into the manifest before there was a
 * second subject to distinguish it from. `unitLevel: false` means the bank
 * holds nothing narrower than a semester, so the tags stop at `bio-s1`;
 * emitting `bio-s1-u3` would invent a tag no document carries.
 */
const SUBJECTS = {
  'math': { tag: '', unitLevel: true },
  'chem': { tag: 'chem-', unitLevel: true },
  'phys': { tag: 'phys-', unitLevel: false },
  'earth-science': { tag: 'earth-', unitLevel: false },
  'biology': { tag: 'bio-', unitLevel: false },
  'finlit': { tag: 'finlit-', unitLevel: false },
  'arabic': { tag: 'arabic-', unitLevel: false },
  'eng-commerce': { tag: 'eng-commerce-', unitLevel: false },
  'eng-agri': { tag: 'eng-agri-', unitLevel: false },
  'eng-hospitality': { tag: 'eng-hospitality-', unitLevel: false },
  'eng-industry': { tag: 'eng-industry-', unitLevel: false },
} as const;

/** Subject slug as it appears inside an id. Not the app's `subjectId`. */
export type SubjectSlug = keyof typeof SUBJECTS;

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
const UNIT_ID_RE = new RegExp(
  // Longest first, so `eng-commerce` is never shadowed by a shorter sibling.
  '^kbu-(?:g(\\d+)-)?('
    + Object.keys(SUBJECTS).sort((a, b) => b.length - a.length).join('|')
    + ')-s([12])-nccd-u(\\d+)$',
);

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
 * nothing can carry. The four English vocational tracks are new subjects with
 * no bank material at all yet, so they get the same semester-only treatment.
 *
 * Other grades are explicit on both axes (`g9-math-s1-u2`, `g9-math-s1`). Maths
 * stops being the silent default the moment there is a second grade to be
 * silent about.
 */
export function bankTagsForParsedUnit(parsed: ParsedUnitId): string[] {
  const { gradeId, subject, semester, unit } = parsed;
  const { tag, unitLevel } = SUBJECTS[subject];

  if (gradeId === IMPLICIT_GRADE_ID) {
    const scope = `${tag}s${semester}`;
    return unitLevel ? [`${scope}-u${unit}`, scope] : [scope];
  }

  // Other grades name the subject in full rather than by its Grade 10 tag
  // stem: `g9-math-s1`, never `g9-s1`. Maths stops being the silent default
  // the moment there is a second grade to be silent about.
  const scope = `${gradeSlug(gradeId)}-${subject}-s${semester}`;
  return unitLevel ? [`${scope}-u${unit}`, scope] : [scope];
}

/**
 * Whether an objective id was minted by `objectiveId` — that is, stamped out by
 * a catalog builder rather than classified by a human.
 *
 * Asks `objectiveId` itself rather than keeping a list beside it, because the
 * list was wrong twice: it missed `o-g9-…` and `o-eng-…`, and then the three
 * science subjects. Each miss made `objectives.ts` report `authored` for a
 * Bloom's level nobody chose.
 */
export function isDerivedObjectiveId(id: string): boolean {
  // Every grade but 10 carries an explicit `g{n}` segment, whatever the subject.
  return /^o-g\d+-/.test(id) || DERIVED_GRADE_10_PREFIXES.some(p => id.startsWith(p));
}

/** `objectiveId` with an empty lesson id yields `{prefix}-0`; drop the `-0`. */
const DERIVED_GRADE_10_PREFIXES: string[] = (Object.keys(SUBJECTS) as SubjectSlug[])
  .flatMap(subject => ([1, 2] as const).map(semester =>
    objectiveId({ gradeId: IMPLICIT_GRADE_ID, subject, semester }, '', 0).slice(0, -2)));
