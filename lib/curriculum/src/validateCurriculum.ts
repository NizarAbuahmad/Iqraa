/**
 * Does a curriculum JSON file say what it claims to say?
 *
 * Phase one is grades 1–10, which is roughly an order of magnitude more
 * curriculum than the four Grade 10 books here today. At that volume nobody
 * reads every file, and the failure mode is not a crash — it is a lesson that
 * quietly carries no objectives, so the generator answers about it ungrounded
 * while the screen still says «مرتبط بالمنهاج الأردني». That is the same shape
 * as every other bug this project has had: silent, and only visible if
 * something goes looking.
 *
 * So this goes looking. It is deliberately split into two severities:
 *
 *  • **errors** — the file is structurally wrong and must not ship. Duplicate
 *    ids, missing Arabic titles, no units. These break lookups outright.
 *  • **gaps** — the file is valid but thin. Lessons with no objectives, units
 *    with no `data_tier`, no `prior_knowledge`. These are content debt, not
 *    bugs, and a subject can legitimately ship with some — but only if the
 *    number is known rather than discovered later by a teacher.
 *
 * Conflating the two would mean either blocking real content over missing
 * vocabulary, or waving through a book with no outcomes at all. Neither is
 * the honest answer, so they are counted separately.
 */

export type CurriculumIssue = {
  /** Dotted path to the offending node, e.g. `units[2].lessons[1].objectives`. */
  path: string;
  message: string;
};

export type CurriculumReport = {
  file: string;
  grade: string;
  subject: string;
  semester: number | null;
  units: number;
  lessons: number;
  /** Lessons carrying at least one official outcome. */
  withObjectives: number;
  withVocabulary: number;
  /** Units declaring how the data was sourced. Absence is why provenance is unknowable. */
  unitsWithDataTier: number;
  errors: CurriculumIssue[];
  gaps: CurriculumIssue[];
};

type Json = Record<string, unknown>;

const isObj = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const nonEmptyStrings = (v: unknown): string[] =>
  arr(v).filter((x): x is string => typeof x === "string" && x.trim() !== "");

/** Meta fields without which a file cannot be placed in the catalog at all. */
const REQUIRED_META = ["grade", "subject", "curriculum_authority", "schema_version"] as const;

export function validateCurriculumFile(file: string, doc: unknown): CurriculumReport {
  const errors: CurriculumIssue[] = [];
  const gaps: CurriculumIssue[] = [];
  const report: CurriculumReport = {
    file, grade: "", subject: "", semester: null,
    units: 0, lessons: 0, withObjectives: 0, withVocabulary: 0, unitsWithDataTier: 0,
    errors, gaps,
  };

  if (!isObj(doc)) {
    errors.push({ path: "", message: "not a JSON object" });
    return report;
  }

  // ── meta
  const meta = isObj(doc.meta) ? doc.meta : null;
  if (!meta) {
    errors.push({ path: "meta", message: "missing" });
  } else {
    for (const field of REQUIRED_META) {
      if (!str(meta[field])) errors.push({ path: `meta.${field}`, message: "missing or empty" });
    }
    report.grade = str(meta.grade);
    report.subject = str(meta.subject);
    const sem = meta.semester_covered;
    report.semester = typeof sem === "number" ? sem : null;
    if (report.semester === null) {
      gaps.push({ path: "meta.semester_covered", message: "not stated" });
    }
    // Provenance is what separates this from a plausible-looking invention.
    if (!isObj(meta.source_books) || Object.keys(meta.source_books).length === 0) {
      gaps.push({ path: "meta.source_books", message: "no source book named" });
    }
  }

  // ── units
  const units = arr(doc.units);
  report.units = units.length;
  if (units.length === 0) errors.push({ path: "units", message: "no units" });

  const unitIds = new Set<string>();
  const lessonIds = new Set<string>();

  units.forEach((rawUnit, ui) => {
    const at = `units[${ui}]`;
    if (!isObj(rawUnit)) {
      errors.push({ path: at, message: "not an object" });
      return;
    }
    const id = str(rawUnit.id);
    if (!id) errors.push({ path: `${at}.id`, message: "missing" });
    else if (unitIds.has(id)) errors.push({ path: `${at}.id`, message: `duplicate unit id "${id}"` });
    else unitIds.add(id);

    // Arabic is the product language; an English-only title renders as a blank
    // heading on an RTL screen rather than falling back.
    if (!str(rawUnit.title_ar)) errors.push({ path: `${at}.title_ar`, message: "missing Arabic title" });

    if (str(rawUnit.data_tier)) report.unitsWithDataTier++;
    else gaps.push({ path: `${at}.data_tier`, message: "provenance tier not stated" });

    if (nonEmptyStrings(rawUnit.prior_knowledge).length === 0) {
      gaps.push({ path: `${at}.prior_knowledge`, message: "none listed" });
    }

    const lessons = arr(rawUnit.lessons);
    if (lessons.length === 0) gaps.push({ path: `${at}.lessons`, message: "unit has no lessons" });

    lessons.forEach((rawLesson, li) => {
      const lat = `${at}.lessons[${li}]`;
      if (!isObj(rawLesson)) {
        errors.push({ path: lat, message: "not an object" });
        return;
      }
      report.lessons++;

      const lid = str(rawLesson.id);
      if (!lid) errors.push({ path: `${lat}.id`, message: "missing" });
      else if (lessonIds.has(lid)) errors.push({ path: `${lat}.id`, message: `duplicate lesson id "${lid}"` });
      else lessonIds.add(lid);

      if (!str(rawLesson.title_ar)) {
        errors.push({ path: `${lat}.title_ar`, message: "missing Arabic title" });
      }

      // The load-bearing one. A lesson with no outcomes is the case where the
      // app grounds nothing and says nothing about it.
      if (nonEmptyStrings(rawLesson.objectives).length > 0) report.withObjectives++;
      else gaps.push({ path: `${lat}.objectives`, message: `no outcomes — "${str(rawLesson.title_ar) || lid}"` });

      if (nonEmptyStrings(rawLesson.vocabulary).length > 0) report.withVocabulary++;
    });
  });

  return report;
}

/** One line per file, plus the totals that say whether a grade is ready to ship. */
export function formatReports(reports: CurriculumReport[]): string {
  const lines: string[] = [];
  const pad = (s: string, n: number) => s.padEnd(n);
  lines.push(
    pad("file", 42) + pad("grade", 18) + pad("subject", 16)
      + "sem".padStart(4) + "units".padStart(7) + "lessons".padStart(9)
      + "objectives".padStart(12) + "tiered".padStart(8)
      + "errors".padStart(8) + "gaps".padStart(6),
  );
  for (const r of reports) {
    lines.push(
      pad(r.file, 42) + pad(r.grade, 18) + pad(r.subject, 16)
        + String(r.semester ?? "—").padStart(4)
        + String(r.units).padStart(7)
        + String(r.lessons).padStart(9)
        + `${r.withObjectives}/${r.lessons}`.padStart(12)
        + `${r.unitsWithDataTier}/${r.units}`.padStart(8)
        + String(r.errors.length).padStart(8)
        + String(r.gaps.length).padStart(6),
    );
  }
  return lines.join("\n");
}

/** True when every file is structurally sound. Gaps do not fail a run. */
export function allValid(reports: CurriculumReport[]): boolean {
  return reports.every((r) => r.errors.length === 0);
}
