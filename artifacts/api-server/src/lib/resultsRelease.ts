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

/**
 * What a release says, to whom. Announced when a release turns on — the
 * route's conditional update decides that, so pressing «أعلن» on results
 * already released sends nothing. Hiding and releasing again does announce
 * again: remembering a past announcement would need a column, and a teacher
 * hides results only to correct something.
 *
 * Arabic only: the product language, and the push goes out with no request in
 * hand to read a locale from. The group line is posted under the teacher's
 * name, because it is their button and their class.
 */
export interface ReleaseAnnouncement {
  pushTitle: string;
  pushBody: string;
  groupLine: string;
}

export function releaseAnnouncement(evaluation: { title: string | null; titleAr: string | null }): ReleaseAnnouncement {
  const name = evaluation.titleAr?.trim() || evaluation.title?.trim() || "";
  return {
    pushTitle: name ? `نتيجة «${name}»` : "نتيجة اختبارك",
    pushBody: "أعلن معلّمك النتيجة. افتحها من «اختباراتي».",
    groupLine: name
      ? `أُعلنت نتائج «${name}». افتحوا «اختباراتي» لتروا نتائجكم.`
      : "أُعلنت نتائج الاختبار. افتحوا «اختباراتي» لتروا نتائجكم.",
  };
}
