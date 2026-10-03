/**
 * Whether a parent letter has been read — decided from the letter's own chat
 * messages, with no database attached.
 *
 * `read` used to mean "a linked guardian's thread-level `lastReadAt` is at or
 * after the letter". A parent with two children on one teacher's roster has
 * one direct thread with that teacher, and their thread screen marks it read
 * on open and on every ten-second poll while it is open. So opening the
 * thread for a one-line reply about child A marked a pending letter about
 * child B read, and the teacher never followed up.
 *
 * Since 2026-10-02 an in-app letter records the ids of the chat messages it
 * became (`parent_contacts.message_ids`, one per guardian thread), and a
 * reader's screen reports each message it actually showed
 * (`chat_message_reads`, POST /messaging/threads/:id/read). A letter is read
 * when any of its messages has been — the same "any linked guardian" rule as
 * before, now about the letter rather than the thread.
 *
 * Letters logged before that carry no message ids and keep the old answer,
 * which is the `legacyLastRead` map. Kept here rather than inline in
 * routes/roster.ts so the rule is testable without a pool (see
 * lib/claimDecision.ts for why this repo has no DB-backed tests).
 */

export interface LetterRow {
  studentId: string;
  channel: string;
  createdAt: Date;
  /** Chat message ids this letter became. Null (or empty) on rows logged before they were recorded. */
  messageIds: string[] | null;
}

export function letterReadState<T extends LetterRow>(
  rows: T[],
  /** Message ids with at least one read receipt from someone other than the sender. */
  readMessageIds: Set<string>,
  /** Per student, the latest thread-level lastReadAt of any linked guardian — the pre-receipt answer. */
  legacyLastRead: Map<string, Date>,
): (T & { read: boolean | null })[] {
  return rows.map(r => {
    // Shared or copied text left the app; nothing can see whether it arrived.
    if (r.channel !== "in_app") return { ...r, read: null };
    if (r.messageIds && r.messageIds.length > 0) {
      return { ...r, read: r.messageIds.some(id => readMessageIds.has(id)) };
    }
    const at = legacyLastRead.get(r.studentId);
    return { ...r, read: Boolean(at && at >= r.createdAt) };
  });
}
