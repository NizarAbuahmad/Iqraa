/**
 * The optional "what is wrong" text on a content report, kept pure so it can be
 * tested without a DB (same posture as `feedbackInput.ts`).
 *
 * Anything that is not a string is "no reason", and so is blank text: a report
 * is valid with or without one. A reason never blocks a report.
 */
export const MAX_REPORT_REASON = 500;

// Control characters except \n (0x0A) and \t (0x09, which trim/collapse leaves
// alone inside a sentence). A pasted NUL would otherwise reach Postgres, which
// rejects it in a text column and would fail the whole report.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B-\u001F\u007F]/g;

export function normalizeReportReason(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.replace(CONTROL, "").trim().slice(0, MAX_REPORT_REASON);
}
