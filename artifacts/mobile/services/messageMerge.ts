/**
 * Folds a freshly-polled newest page into the messages already on screen.
 *
 * Its own module rather than a function in `messaging.ts`, for the reason
 * `routeGating.ts` was split out of `_layout.tsx`: `messaging.ts` imports
 * `expo-image-picker` for `pickChatImage`, which drags `expo-modules-core`'s
 * TypeScript source in from node_modules, which `node --test` refuses to strip
 * types from. Anything importable from there is therefore untestable. Same
 * shape as the OpenAI-client-at-module-scope trap in CLAUDE.md.
 *
 * Generic over `{ id }` rather than typed to ChatMessage so it needs no import
 * at all, not even a type one.
 *
 * The rules it encodes:
 *
 * - A poll must not *replace* the list. `listMessages` returns only the newest
 *   page, so assigning it would discard every older page the reader had
 *   scrolled back through, jerking the thread forward under them.
 * - It must not *append blindly*. The newest page overlaps what is already
 *   held, and a message the reader just sent is on screen optimistically, so
 *   re-adding it would show it twice.
 * - Nothing new returns the original array reference, so a quiet poll costs no
 *   re-render.
 *
 * Both lists are newest-first (the thread's FlatList is inverted), so anything
 * genuinely new belongs in front.
 */
export function mergeNewMessages<T extends { id: string }>(current: T[], polled: T[]): T[] {
  const known = new Set(current.map(m => m.id));
  const fresh = polled.filter(m => !known.has(m.id));
  return fresh.length === 0 ? current : [...fresh, ...current];
}
