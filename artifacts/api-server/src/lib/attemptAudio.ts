/**
 * Removing a student's stored recordings when the answer they belong to goes.
 *
 * A read-aloud answer stores the child's voice in R2 (`attempt-audio/…`) and
 * keeps the key on the answer row. Every way that row could disappear left
 * the recording behind: a teacher releasing a sitting (`DELETE
 * /attempts/:id`), a teacher deleting their account (the rows cascade from
 * the user), and the student's own re-take, which overwrote the key and
 * forgot the previous take. `practice.ts` states the policy this was
 * breaking — no children's voice recordings kept without a reason.
 *
 * Best-effort and always after the database change, the same rule account
 * deletion already follows: the deletion the user asked for is the row, and
 * it must not fail because object storage is unreachable. A failure is
 * logged at error level, because nothing else will ever notice it.
 */
import { db, attemptAnswers, attempts, evaluations } from "@workspace/db";
import { eq } from "drizzle-orm";
import { deleteObject } from "./r2.js";
import { logger } from "./logger.ts";
import { attemptAudioKey, attemptAudioKeys, withRecordingUrls } from "./attemptAudioKeys.ts";

export { attemptAudioKey, attemptAudioKeys, withRecordingUrls };

/** Recording keys on one attempt's answers. Read before the delete. */
export async function audioKeysForAttempt(attemptId: string): Promise<string[]> {
  const rows = await db
    .select({ response: attemptAnswers.response })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  return attemptAudioKeys(rows.map(r => r.response));
}

/** Recording keys on every attempt at every exam this teacher owns. */
export async function audioKeysForTeacher(teacherId: string): Promise<string[]> {
  const rows = await db
    .select({ response: attemptAnswers.response })
    .from(attemptAnswers)
    .innerJoin(attempts, eq(attempts.id, attemptAnswers.attemptId))
    .innerJoin(evaluations, eq(evaluations.id, attempts.evaluationId))
    .where(eq(evaluations.teacherId, teacherId));
  return attemptAudioKeys(rows.map(r => r.response));
}

/** Delete each key; returns how many could not be deleted. Never throws. */
export async function deleteAttemptAudio(keys: readonly string[], context: Record<string, unknown>): Promise<number> {
  let orphaned = 0;
  for (const key of keys) {
    try {
      await deleteObject(key);
    } catch (err) {
      orphaned += 1;
      logger.error({ err, key, ...context }, "student recording could not be deleted from R2");
    }
  }
  return orphaned;
}
