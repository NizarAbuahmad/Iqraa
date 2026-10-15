/**
 * Reading a group check's audience: the student-level rows of
 * `evaluation_assignments`. Class-level rows (`class_group_id` set) are not
 * written by anything and are ignored here; an evaluation's class is still
 * `evaluations.class_group_id`. See modules/assessment/audience.ts for the rule.
 * Nothing writes these rows any more (the group-check flow was removed
 * 2026-10-14), but rows written before then still restrict their exams, so the
 * read stays.
 */
import { systemDb, evaluationAssignments } from "@workspace/db";
import { and, inArray, isNotNull } from "drizzle-orm";
import { audienceFor, type Audience } from "../modules/assessment/audience.ts";

export async function assignedStudentsByEvaluation(
  evaluationIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (evaluationIds.length === 0) return out;
  // systemDb: this also runs for a student opening an exam from its link, who has no
  // login and so no identity. Under row-level security the read would come back empty,
  // and an empty audience means "everyone" — a restricted exam would open to the class.
  const rows = await systemDb
    .select({ evaluationId: evaluationAssignments.evaluationId, studentId: evaluationAssignments.studentId })
    .from(evaluationAssignments)
    .where(and(inArray(evaluationAssignments.evaluationId, [...evaluationIds]), isNotNull(evaluationAssignments.studentId)));
  for (const r of rows) {
    if (!r.studentId) continue;
    const list = out.get(r.evaluationId) ?? [];
    list.push(r.studentId);
    out.set(r.evaluationId, list);
  }
  return out;
}

export async function evaluationAudience(evaluationId: string): Promise<Audience> {
  return audienceFor((await assignedStudentsByEvaluation([evaluationId])).get(evaluationId));
}
