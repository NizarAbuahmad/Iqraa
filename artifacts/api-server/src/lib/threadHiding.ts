/**
 * «حذف المحادثة» / «إخفاء المجموعة» — a per-person hide, not a deletion.
 *
 * `chat_participants.hidden_at` says when someone hid a thread. It stays
 * hidden only until something newer than that arrives, so nobody has to
 * "un-hide" anything and the other side never loses the conversation. Doing it
 * by comparison, rather than by clearing the flag on every send, also means a
 * class group's roster sync (which only ever inserts rows) cannot undo it.
 */
export function isHiddenFor(hiddenAt: Date | null | undefined, latestMessageAt: Date | null | undefined): boolean {
  if (!hiddenAt) return false;
  return !latestMessageAt || latestMessageAt.getTime() <= hiddenAt.getTime();
}
