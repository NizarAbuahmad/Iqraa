/**
 * Whether a teacher may remove an exam from their lists.
 *
 * Removing is a soft delete (`evaluations.archived_at`): the attempts, the
 * results and what students and parents see are all kept. What it takes away
 * is the exam's place in the teacher's «تقييماتي» and class lists.
 *
 * Only a draft or a closed exam can go. A published exam has a live student
 * link, and hiding it from its teacher while students can still sit it would
 * leave an exam nobody can close — so the teacher closes it first, which also
 * means archiving never has to touch the student side.
 *
 * Archiving twice is not an error: the teacher's screen may have been stale.
 */
export type ArchiveDecision =
  | { ok: true; alreadyArchived: boolean }
  | { ok: false; status: 409; code: "still_published"; error: string };

export function archiveDecision(evaluation: { status: string; archivedAt: Date | null }): ArchiveDecision {
  if (evaluation.archivedAt) return { ok: true, alreadyArchived: true };
  if (evaluation.status === "published") {
    return { ok: false, status: 409, code: "still_published", error: "Close the evaluation before removing it" };
  }
  return { ok: true, alreadyArchived: false };
}
