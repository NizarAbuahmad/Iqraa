/**
 * The class mark book for a paper exam: one total per student, typed by the
 * teacher (`PUT /evaluations/:id/paper-totals`, lib/paperTotals.ts). This file
 * is the part that needs no database: reading the request, the per-row result
 * shapes, and when "clear this mark" may delete a sitting.
 *
 * Partial by design: a class of thirty is thirty independent rows, and one
 * student who left the class must not cost the teacher the other twenty-nine.
 * The body is refused whole only when it is malformed.
 */
import { isUuid } from "../homework/rules.ts";

/**
 * A large class is ~45; this bounds one request's work, not a class. It matches
 * the mobile client's chunk size, so a full class goes up in a few requests.
 */
export const PAPER_TOTALS_MAX_ROWS = 100;

export interface PaperTotalInput {
  /** Lower-cased: the database returns uuids lower-case, and rows are matched by string. */
  studentId: string;
  /** A number or numeric string (checked against the question later), or null to clear. */
  marks: number | string | null;
}

export type PaperTotalsParse =
  | { ok: true; rows: PaperTotalInput[] }
  | { ok: false; code: "invalid_paper_totals" | "too_many_rows" | "duplicate_student"; error: string; index?: number };

function record(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}

export function parsePaperTotals(body: unknown): PaperTotalsParse {
  const totals = record(body)?.["totals"];
  if (!Array.isArray(totals) || totals.length === 0) {
    return { ok: false, code: "invalid_paper_totals", error: "totals must be a non-empty list" };
  }
  if (totals.length > PAPER_TOTALS_MAX_ROWS) {
    return { ok: false, code: "too_many_rows", error: `At most ${PAPER_TOTALS_MAX_ROWS} students per request` };
  }
  const seen = new Set<string>();
  const rows: PaperTotalInput[] = [];
  for (const [index, item] of totals.entries()) {
    const row = record(item);
    if (!row || !isUuid(row["studentId"])) {
      return { ok: false, code: "invalid_paper_totals", error: "Each row needs a studentId", index };
    }
    const marks = row["marks"];
    const marksOk =
      marks === null ||
      (typeof marks === "number" && Number.isFinite(marks)) ||
      (typeof marks === "string" && marks.trim() !== "");
    if (!marksOk) {
      return { ok: false, code: "invalid_paper_totals", error: "Each row needs marks: a number, or null to clear", index };
    }
    const studentId = row["studentId"].toLowerCase();
    if (seen.has(studentId)) {
      return { ok: false, code: "duplicate_student", error: "A student appears twice", index };
    }
    seen.add(studentId);
    rows.push({ studentId, marks: marks as number | string | null });
  }
  return { ok: true, rows };
}

export type PaperTotalErrorCode =
  | "not_in_class"
  | "not_in_group"
  | "marks_out_of_range"
  | "kept_student_work"
  | "not_quick_paper"
  | "failed";

export type PaperTotalResult =
  | { studentId: string; status: "saved" | "unchanged"; marks: number }
  | { studentId: string; status: "cleared"; marks: null }
  | { studentId: string; status: "error"; code: PaperTotalErrorCode };

export type ClearDecision = "nothing" | "delete" | "keep";

/**
 * Clearing a mark deletes the sitting only when the teacher made all of it: a
 * `teacher_entry` paper with no recorded answers. A sitting the student made
 * through the link, or one with answers on it, is the student's work — the
 * teacher clears it from that student's page, deliberately, not from a grid.
 */
export function clearDecision(sitting: { source: string; hasAnswers: boolean } | null): ClearDecision {
  if (!sitting) return "nothing";
  return sitting.source === "teacher_entry" && !sitting.hasAnswers ? "delete" : "keep";
}

export type PaperTotalsRefusal = "no_class" | "not_quick_paper" | "no_level_scale";

export const PAPER_TOTALS_REFUSAL: Record<PaperTotalsRefusal, string> = {
  no_class: "Attach this exam to a class before entering marks",
  not_quick_paper: "One total per student works only on a paper exam with a single question",
  no_level_scale: "No level scale is configured for this evaluation",
};
