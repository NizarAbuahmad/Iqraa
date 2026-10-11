interface ReactionLike {
  emoji: string;
  count: number;
  mine: boolean;
  userIds?: string[];
}

/** Same chips, same counts, same own mark, same people. The server's order is stable, so position matters. */
export function sameReactions(a?: readonly ReactionLike[], b?: readonly ReactionLike[]): boolean {
  const x = a ?? [];
  const y = b ?? [];
  if (x.length !== y.length) return false;
  return x.every((r, i) => {
    const o = y[i]!;
    return r.emoji === o.emoji && r.count === o.count && r.mine === o.mine && (r.userIds ?? []).join(',') === (o.userIds ?? []).join(',');
  });
}

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
 * Generic over `{ id, seen?, reactions? }` rather than typed to ChatMessage so
 * it needs no import at all, not even a type one.
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
 * - A message already held takes the poll's `seen`, which only ever turns
 *   true: it is how the sender's «شوهدت» appears without reopening the thread.
 * - A message already held also takes the poll's `reactions` when they differ
 *   (by emoji, count, mine and who) — the poll is the only way someone else's
 *   reaction reaches a thread that is already open. A poll that carries no
 *   `reactions` field at all (an older API build) is "no news", not "all
 *   removed". The poll fetches only the newest page, so reactions on older
 *   scrolled-back messages refresh when the thread is reopened.
 *
 * Both lists are newest-first (the thread's FlatList is inverted), so anything
 * genuinely new belongs in front.
 */
export function mergeNewMessages<T extends { id: string; seen?: boolean; reactions?: ReactionLike[] }>(current: T[], polled: T[]): T[] {
  const known = new Set(current.map(m => m.id));
  const fresh = polled.filter(m => !known.has(m.id));
  const polledById = new Map(polled.map(m => [m.id, m] as const));
  let changed = false;
  const held = current.map(m => {
    const p = polledById.get(m.id);
    if (!p) return m;
    let next = m;
    if (!m.seen && p.seen) next = { ...next, seen: true };
    if (p.reactions !== undefined && !sameReactions(m.reactions, p.reactions)) next = { ...next, reactions: p.reactions };
    if (next !== m) changed = true;
    return next;
  });
  if (fresh.length === 0 && !changed) return current;
  return fresh.length === 0 ? held : [...fresh, ...held];
}
