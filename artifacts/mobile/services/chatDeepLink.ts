/**
 * What a deep link into chat actually asks for.
 *
 * The lesson page hands chat a message, a lesson and (from a shelf row) a
 * document. All three used to arrive and only the message was acted on: the
 * auto-send called `sendMessage(text)` with no `pinnedLessonId`, so retrieval
 * fell through to keyword search on the message text and then to whatever
 * lesson chat had already pinned — by default the seeded demo lesson,
 * تركيب الاقترانات. A teacher who opened a worksheet on one lesson got an
 * answer about a different one, and nothing on screen said why.
 *
 * The decision is three lines long, which is exactly why it went unnoticed for
 * so long: it lived inside a `useEffect` in a 2900-line React screen that
 * `node --test` cannot load, so no test could reach it. Pulled out here it can
 * be pinned. Same split as `chatMaterialActions.ts` and `artifactTopic.ts`.
 */

/** The params `app/(tabs)/iqra.tsx` accepts on a deep link. */
export type DeepLinkParams = {
  initialMessage?: string;
  lessonId?: string;
  subjectColor?: string;
  resourceId?: string;
};

/** A send the chat screen should perform on arrival. */
export type DeepLinkSend = {
  text: string;
  /** Hard-pins retrieval to this lesson. The bug was this being undefined. */
  pinnedLessonId?: string;
  /** The shelf document to name first in the support block, when there is one. */
  pinnedResourceId?: string;
};

/**
 * Resolve a deep link into the send it stands for, or `null` when it names
 * nothing to say.
 *
 * A blank or whitespace-only `initialMessage` is `null` rather than an empty
 * send: `sendMessage` would return early on it anyway, but leaving it pending
 * means the next render tries again forever.
 *
 * A `lessonId` with no message is also `null` — arriving on the chat tab is not
 * by itself a question, and re-pinning silently would move the teacher's
 * context with nothing on screen to explain it.
 */
export function resolveDeepLinkSend(params: DeepLinkParams): DeepLinkSend | null {
  const text = params.initialMessage?.trim();
  if (!text) return null;
  return {
    text,
    pinnedLessonId: params.lessonId?.trim() || undefined,
    pinnedResourceId: params.resourceId?.trim() || undefined,
  };
}
