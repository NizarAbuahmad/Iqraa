/**
 * Unread chat-message count shared by the bell, the tab badge and the sidebar.
 *
 * A module-level value rather than context: the tab layout polls it, and the
 * inbox screen pushes a fresher number the moment it loads, so the badge does
 * not lag a poll behind what the inbox itself is showing.
 */
import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

export function setUnreadMessages(n: number) {
  if (n === count) return;
  count = n;
  listeners.forEach(l => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

export function useUnreadMessages(): number {
  return useSyncExternalStore(subscribe, () => count, () => 0);
}

/** "9+" past nine, undefined at zero — what a badge should show. */
export function badgeLabel(n: number): string | undefined {
  return n > 0 ? (n > 9 ? '9+' : String(n)) : undefined;
}
