/**
 * Which of the messages now on screen should be reported as read.
 *
 * A thread screen reports the messages it actually showed
 * (`POST /messaging/threads/:id/read`), so a parent letter can be called read
 * when the parent saw *it*, not merely opened the thread it sits in — see
 * `lib/parentContactRead.ts` on the server for why the thread-level answer
 * was wrong. FlatList's viewability callback fires on every scroll with the
 * whole visible set, so the caller keeps a set of ids already reported and
 * this returns only what is new, never the viewer's own messages.
 *
 * Pure by design: no react-native import, so `node --test` can load it. Same
 * reason `routeGating.ts` and `messageMerge.ts` live apart from their screens.
 */
export function pickUnreportedReads(
  visible: ReadonlyArray<{ id: string; senderId: string }>,
  viewerId: string | undefined,
  reported: ReadonlySet<string>,
): string[] {
  const out: string[] = [];
  for (const m of visible) {
    if (m.senderId === viewerId) continue;
    if (reported.has(m.id) || out.includes(m.id)) continue;
    out.push(m.id);
  }
  return out;
}
