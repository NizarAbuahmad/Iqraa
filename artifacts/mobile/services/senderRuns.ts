/**
 * In a group thread each message from someone else is labelled with who sent
 * it — but a run of messages from one person is labelled once, on the first of
 * the run, the way every chat app does it.
 *
 * The thread's list is inverted: `messages` is newest first, so the message
 * sent just before `messages[i]` is `messages[i + 1]`.
 *
 * Plain `.ts`, no RN imports, so `node --test` can load it.
 */
export function startsSenderRun(messages: ReadonlyArray<{ senderId: string }>, index: number): boolean {
  const before = messages[index + 1];
  return !before || before.senderId !== messages[index]?.senderId;
}
