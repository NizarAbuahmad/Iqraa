/**
 * How an Arabic prompt names the grade and subject a screen sent.
 *
 * The screens send the grade as its label («الصف السابع») and the subject as the
 * catalog's English name («Mathematics»), so «لمادة ${subject} للصف ${grade}»
 * printed «لمادة Mathematics للصف الصف السابع» in every Arabic prompt (found
 * by the 2026-11-13 Grade 7 audit). These put the subject in Arabic and drop
 * the repeated «الصف»; anything they do not recognise passes through as sent.
 */
import { SUBJECTS } from "@workspace/curriculum";

/** «الصف السابع» → «السابع», so «للصف ${gradeAr(g)}» reads once. */
export function gradeAr(grade: unknown): string {
  return String(grade ?? "").trim().replace(/^الصف\s+/u, "");
}

/** The catalog subject's Arabic name for its English name or id; else as sent. */
export function subjectAr(subject: unknown): string {
  const s = String(subject ?? "").trim();
  const key = s.toLowerCase();
  const hit = SUBJECTS.find(x => x.name.toLowerCase() === key || x.id === key);
  return hit?.nameAr ?? s;
}
