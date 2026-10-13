/**
 * The three database touches behind the student lesson-explanation routes.
 *
 * `@workspace/db` is imported lazily, as `artifactCache.ts` does, so the module
 * that imports this one can still be loaded under `node --test`. Errors are
 * not swallowed: a failed read is a 500 the route reports, never a quiet
 * "not available" that would hide a broken table from everyone.
 */
import type { ExplanationRow } from "./lessonExplanation.ts";

/**
 * Live, approved `lesson-teaching` rows for one lesson and language. Several
 * can exist (a prefill rerun after a prompt bump); `pickExplanation` chooses.
 */
export async function readApprovedExplanations(
  lessonRef: string,
  language: "arabic" | "english",
): Promise<ExplanationRow[]> {
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  return db
    .select({
      id: aiArtifacts.id,
      createdAt: aiArtifacts.createdAt,
      timesServed: aiArtifacts.timesServed,
      content: aiArtifacts.content,
    })
    .from(aiArtifacts)
    .where(
      and(
        eq(aiArtifacts.kind, "lesson-teaching"),
        eq(aiArtifacts.lessonRef, lessonRef),
        eq(aiArtifacts.language, language),
        isNull(aiArtifacts.retiredAt),
        isNotNull(aiArtifacts.studentApprovedAt),
      ),
    );
}

/**
 * Whether this artifact is one a student can currently be shown. The report
 * route checks it so a student cannot file reports against arbitrary pool
 * rows (teacher worksheets, quizzes) and fill the admins' queue.
 */
export async function isStudentVisibleExplanation(artifactId: string): Promise<boolean> {
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, isNotNull, isNull } = await import("drizzle-orm");
  const rows = await db
    .select({ id: aiArtifacts.id })
    .from(aiArtifacts)
    .where(
      and(
        eq(aiArtifacts.id, artifactId),
        eq(aiArtifacts.kind, "lesson-teaching"),
        isNull(aiArtifacts.retiredAt),
        isNotNull(aiArtifacts.studentApprovedAt),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

/**
 * Mark live `lesson-teaching` rows approved for students. Returns how many
 * were newly approved; a row already approved, retired, or of another kind is
 * not counted and not touched.
 */
export async function markApprovedForStudents(ids: string[]): Promise<number> {
  if (ids.length === 0) return 0;
  const { db, aiArtifacts } = await import("@workspace/db");
  const { and, eq, inArray, isNull } = await import("drizzle-orm");
  const updated = await db
    .update(aiArtifacts)
    .set({ studentApprovedAt: new Date() })
    .where(
      and(
        inArray(aiArtifacts.id, ids),
        eq(aiArtifacts.kind, "lesson-teaching"),
        isNull(aiArtifacts.retiredAt),
        isNull(aiArtifacts.studentApprovedAt),
      ),
    )
    .returning({ id: aiArtifacts.id });
  return updated.length;
}
