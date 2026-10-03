/**
 * The inbox's All / Groups / Direct filter.
 *
 * Kept out of app/(tabs)/notifications.tsx so `node --test` can load it —
 * that screen imports react-native at module scope. "Groups" covers both
 * group kinds (class_group, custom_group): a teacher asking for "groups"
 * means every thread with more than one other person in it.
 */
import type { ChatThreadType } from './messaging.ts';

export type ThreadFilter = 'all' | 'groups' | 'direct';

export const THREAD_FILTERS: readonly ThreadFilter[] = ['all', 'groups', 'direct'];

export function matchesThreadFilter(type: ChatThreadType, filter: ThreadFilter): boolean {
  if (filter === 'all') return true;
  return filter === 'direct' ? type === 'direct' : type !== 'direct';
}

export function filterThreads<T extends { type: ChatThreadType }>(threads: readonly T[], filter: ThreadFilter): T[] {
  return threads.filter(th => matchesThreadFilter(th.type, filter));
}
