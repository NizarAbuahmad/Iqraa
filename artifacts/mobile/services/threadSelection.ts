/**
 * Multi-select for the inbox's bulk «حذف / إخفاء».
 *
 * Kept out of app/(tabs)/notifications.tsx so `node --test` can load it —
 * that screen imports react-native at module scope. Selection is a set of
 * thread ids; selecting nothing ends selection mode, so the screen never has
 * to track "mode" separately from "what is picked".
 */

/** Adds `id` if absent, removes it if present. Returns a new Set. */
export function toggleSelected(selected: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(selected);
  if (next.has(id)) next.delete(id);
  else next.add(id);
  return next;
}

/** Drops ids that are no longer in the list (e.g. after a poll refresh). */
export function pruneSelection(selected: ReadonlySet<string>, liveIds: readonly string[]): Set<string> {
  const live = new Set(liveIds);
  return new Set([...selected].filter(id => live.has(id)));
}

/** True when every visible thread is already selected. */
export function allSelected(selected: ReadonlySet<string>, visibleIds: readonly string[]): boolean {
  return visibleIds.length > 0 && visibleIds.every(id => selected.has(id));
}
