/**
 * Reading an exam paper the teacher set, to fill the paper-exam grid.
 *
 * A paper exam is one row per question — marks, objective, competency — and
 * the teacher already has all three in front of them on the paper. This reads
 * the pages and proposes the rows; it saves nothing. The proposals pre-fill a
 * grid the teacher edits, and the existing `PUT /evaluations/:id/questions/paper`
 * (`parsePaperRows`) is still what validates and stores them.
 *
 * Built to under-claim, like `scanMarks.ts`, and for the same reason: a wrong
 * reading does not throw. A mark that is wrong here becomes the ceiling every
 * student's score on that question is measured against.
 *
 * - A mark it cannot read is **null**, never a default.
 * - A mark outside what `parsePaperRows` would accept is **null**, not clamped.
 * - An objective the model names that is not in the list it was given is
 *   **null**; the server does not take the model's word for what exists.
 * - A competency is a *suggestion*. `paperExam.ts` is explicit that a question's
 *   cognitive demand is the teacher's choice, so this is pre-filled and badged
 *   in the grid, never silently decided.
 * - A question number the pages skip becomes a **blank row**, so row N in the
 *   grid is question N on the paper.
 */
import { COMPETENCY_KEYS, type CompetencyKey } from "./competency.ts";
import { MAX_MARKS_PER_QUESTION } from "./paperExam.ts";
import { parseArabicNumber } from "./scanMarks.ts";

/** Same ceiling as the grid (`MAX_QUESTIONS` in routes/evaluations.ts). */
export const MAX_SCANNED_QUESTIONS = 50;

export interface ScanObjective {
  id: string;
  /** Arabic wording where there is one — what the paper's teacher would recognise. */
  label: string;
}

export interface PaperScanRow {
  /** 1-based, as printed. */
  number: number;
  marks: number | null;
  objectiveId: string | null;
  competencyKey: CompetencyKey | null;
  /** The characters the model reports seeing for the marks, for the teacher to compare. */
  readAs: string;
}

export interface PaperScanResult {
  rows: PaperScanRow[];
  /** The total the paper prints for itself ("المجموع 40"), when it prints one. */
  printedTotal: number | null;
  skipped: { number: number; reason: string }[];
}

export function buildPaperScanPrompt(objectives: readonly ScanObjective[]): {
  system: string;
  user: string;
} {
  const system = [
    "You read an exam paper from photographs of its pages, to list its questions.",
    "",
    "You are reading, not setting, a paper. Never invent a question, never guess a",
    "mark, and never continue a question that is not on the pages.",
    "",
    "For each question report:",
    "- number: the question number as printed",
    "- marks: what the question is worth, as printed",
    "- readAs: the characters you saw for the marks, exactly as written",
    "- objectiveId: the id of the ONE learning objective in the list that the",
    "  question measures, or null if none clearly fits",
    "- competency: knowledge, understanding, application or critical_thinking,",
    "  or null if you are unsure",
    "",
    "Rules:",
    "1. If the pages do not state a question's marks, or you cannot read them with",
    "   confidence, set marks to null. Null is always better than a guess — the",
    "   marks become the ceiling every student is scored against.",
    "2. If a question is split into parts that each carry marks and no total is",
    "   printed for the question, report the sum and put the parts in readAs",
    '   (for example "2+3").',
    "3. Choose objectiveId only from the list you are given. Never invent an id.",
    "   null is better than a poor fit.",
    "4. Arabic-Indic digits (٠١٢٣٤٥٦٧٨٩) and Western digits mean the same thing.",
    "   Report numbers as numbers.",
    "5. If the paper prints its own total (for example المجموع ٤٠), report it as",
    "   printedTotal; otherwise null.",
    "",
    'Return JSON only: {"printedTotal":40,"questions":[{"number":1,"marks":5,"readAs":"٥","objectiveId":"<id from the list>","competency":"knowledge"}]}',
    "No prose, no markdown fence.",
  ].join("\n");

  const list = objectives.map(o => `  ${o.id} — ${o.label}`).join("\n");
  const user = [
    "Learning objectives (choose objectiveId only from these):",
    list,
    "",
    "The photographs are the pages of the paper, in order.",
    "List every question on them, in order.",
  ].join("\n");

  return { system, user };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function parsePaperScanResponse(
  raw: unknown,
  allowedObjectiveIds: readonly string[],
): PaperScanResult {
  const root = asRecord(raw);
  const list = Array.isArray(root?.["questions"]) ? (root!["questions"] as unknown[]) : [];

  const byNumber = new Map<number, PaperScanRow>();
  const skipped: { number: number; reason: string }[] = [];

  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;

    const number = parseArabicNumber(row["number"]);
    if (number === null || !Number.isInteger(number) || number < 1) continue;
    if (number > MAX_SCANNED_QUESTIONS) {
      skipped.push({ number, reason: `a paper exam holds at most ${MAX_SCANNED_QUESTIONS} questions` });
      continue;
    }
    // The first reading of a question wins, as in `parseScanResponse`.
    if (byNumber.has(number)) continue;

    let marks: number | null = null;
    const value = parseArabicNumber(row["marks"]);
    if (value === null) {
      skipped.push({ number, reason: "could not read the marks" });
    } else if (!(value > 0) || value > MAX_MARKS_PER_QUESTION) {
      // Rejected, not clamped: the same rule `parsePaperRows` enforces on save,
      // applied early so a misread 50 never reaches the grid looking plausible.
      skipped.push({ number, reason: `read ${value}, which is not a usable mark` });
    } else {
      marks = round2(value);
    }

    const objective = typeof row["objectiveId"] === "string" ? row["objectiveId"].trim() : "";
    const competency = row["competency"];

    byNumber.set(number, {
      number,
      marks,
      objectiveId: allowedObjectiveIds.includes(objective) ? objective : null,
      competencyKey: COMPETENCY_KEYS.includes(competency as CompetencyKey)
        ? (competency as CompetencyKey)
        : null,
      readAs: typeof row["readAs"] === "string" ? row["readAs"] : "",
    });
  }

  // Row N must be question N. A number the pages skipped becomes a blank row
  // rather than shifting every later question up by one.
  const highest = byNumber.size === 0 ? 0 : Math.max(...byNumber.keys());
  const rows: PaperScanRow[] = [];
  for (let n = 1; n <= highest; n++) {
    const found = byNumber.get(n);
    if (found) {
      rows.push(found);
    } else {
      rows.push({ number: n, marks: null, objectiveId: null, competencyKey: null, readAs: "" });
      skipped.push({ number: n, reason: "no question found on the pages" });
    }
  }
  skipped.sort((a, b) => a.number - b.number);

  const total = parseArabicNumber(root?.["printedTotal"]);
  return {
    rows,
    printedTotal: total !== null && total > 0 ? round2(total) : null,
    skipped,
  };
}
