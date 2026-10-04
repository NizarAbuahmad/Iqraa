/**
 * Whether a teacher may release (or take back) an exam's results to its
 * students.
 *
 * `evaluations.release_results_to_student` gated every student-facing result
 * — «اختباراتي», «تحقّق من النتيجة» — and nothing ever set it, so no student
 * could see a result. The teacher now releases per exam, by hand.
 *
 * Release needs an exam someone can have sat: published or closed, never a
 * draft. Taking a release back is always allowed — a teacher who pressed it
 * by mistake must be able to undo it. A paper still waiting on marking stays
 * hidden either way (`studentResultReady` also requires a final result), so
 * releasing early only means each student sees theirs once it is marked.
 */
export type ResultsReleaseDecision =
  | { ok: true; released: boolean }
  | { ok: false; status: 400 | 409; code: "invalid_input" | "not_published"; error: string };

export function resultsReleaseDecision(evaluation: { status: string }, body: unknown): ResultsReleaseDecision {
  const released = body && typeof body === "object" ? (body as Record<string, unknown>)["released"] : undefined;
  if (typeof released !== "boolean") {
    return { ok: false, status: 400, code: "invalid_input", error: "released must be true or false" };
  }
  if (released && evaluation.status !== "published" && evaluation.status !== "closed") {
    return { ok: false, status: 409, code: "not_published", error: "Publish the evaluation before releasing its results" };
  }
  return { ok: true, released };
}
