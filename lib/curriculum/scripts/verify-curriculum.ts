/**
 * Validate every curriculum JSON in `src/data/` and print a coverage table.
 *
 *   node --experimental-strip-types lib/curriculum/scripts/verify-curriculum.ts
 *   pnpm --filter @workspace/curriculum run verify
 *
 * Exits non-zero on structural errors only. Content gaps are reported and do
 * not fail the run — a subject can ship with known thin spots, but only if the
 * count is on screen rather than discovered by a teacher.
 *
 * Pass `--gaps` to list every gap rather than just count them; that is the
 * to-do list when a new grade's books arrive.
 */
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  allValid,
  formatReports,
  validateCurriculumFile,
  type CurriculumReport,
} from "../src/validateCurriculum.ts";

const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, "..", "src", "data");
const showGaps = process.argv.includes("--gaps");

// Only the curriculum books. `src/data` also holds g10_sources.json — the
// inventory of which PDFs the books were read out of — which has no units and
// would be reported as two structural errors by a validator that assumes every
// JSON in here is a curriculum.
const files = readdirSync(dataDir)
  .filter((f) => f.startsWith("iqra_curriculum_") && f.endsWith(".json"))
  .sort();
if (files.length === 0) {
  console.error(`No curriculum JSON found in ${dataDir}`);
  process.exit(1);
}

const reports: CurriculumReport[] = files.map((f) => {
  const raw = readFileSync(join(dataDir, f), "utf8");
  let doc: unknown;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    // A parse failure is reported as a file-level error rather than thrown, so
    // one bad file does not hide the state of every other one.
    return {
      file: f, grade: "", subject: "", semester: null,
      units: 0, lessons: 0, withObjectives: 0, withVocabulary: 0, unitsWithDataTier: 0,
      errors: [{ path: "", message: `invalid JSON: ${e instanceof Error ? e.message : String(e)}` }],
      gaps: [],
    };
  }
  return validateCurriculumFile(f, doc);
});

console.log(`\nCurriculum coverage — ${dataDir}\n`);
console.log(formatReports(reports));

const totals = reports.reduce(
  (a, r) => ({
    lessons: a.lessons + r.lessons,
    withObjectives: a.withObjectives + r.withObjectives,
    errors: a.errors + r.errors.length,
    gaps: a.gaps + r.gaps.length,
  }),
  { lessons: 0, withObjectives: 0, errors: 0, gaps: 0 },
);
console.log(
  `\n${reports.length} file(s) · ${totals.lessons} lessons · `
    + `${totals.withObjectives}/${totals.lessons} with official outcomes · `
    + `${totals.errors} error(s) · ${totals.gaps} gap(s)`,
);

for (const r of reports) {
  if (r.errors.length === 0 && !(showGaps && r.gaps.length > 0)) continue;
  console.log(`\n── ${r.file}`);
  for (const e of r.errors) console.log(`   ERROR  ${e.path}: ${e.message}`);
  if (showGaps) for (const g of r.gaps) console.log(`   gap    ${g.path}: ${g.message}`);
}

if (!showGaps && totals.gaps > 0) {
  console.log(`\nRe-run with --gaps to list all ${totals.gaps} content gaps.`);
}

if (!allValid(reports)) {
  console.error(`\n${totals.errors} structural error(s) — these must be fixed before the data ships.`);
  process.exitCode = 1;
}
