/**
 * Reading and writing a group check's audience: the student-level rows of
 * `evaluation_assignments`. Class-level rows (`class_group_id` set) are not
 * written by anything and are ignored here; an evaluation's class is still
 * `evaluations.class_group_id`. See modules/assessment/audience.ts for the rule.
 */
import { db, evaluationAssignments } from "@workspace/db";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { audienceFor, type Audience } from "../modules/assessment/audience.ts";

export async function assignedStudentsByEvaluation(
  evaluationIds: readonly string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (evaluationIds.length === 0) return out;
  const rows = await db
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

/** Replace the student-level rows in one transaction. */
export async function replaceEvaluationAudience(
  evaluationId: string,
  studentIds: readonly string[],
  assignedBy: string,
): Promise<void> {
  await db.transaction(async tx => {
    await tx
      .delete(evaluationAssignments)
      .where(and(eq(evaluationAssignments.evaluationId, evaluationId), isNotNull(evaluationAssignments.studentId)));
    if (studentIds.length > 0) {
      await tx.insert(evaluationAssignments).values(
        studentIds.map(studentId => ({ evaluationId, studentId, assignedBy })),
      );
    }
  });
}
