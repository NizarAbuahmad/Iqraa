/**
 * Narrows a catalog list (GRADES or SUBJECTS from `@workspace/curriculum`) to
 * what a teacher picked on `/setup-subjects`, for `app/(tabs)/curriculum.tsx`.
 *
 * Split out of that screen — same reason routeGating.ts is split out of
 * `_layout.tsx` — so this pure filter can be unit-tested without loading
 * expo-router/react-native at module scope.
 *
 * Falls back to the full list whenever narrowing would leave nothing to show:
 * no selection yet (parents/students, or a teacher on a stale cached user),
 * and the edge case where every picked id has since dropped out of the
 * catalog (MVP_GRADE_IDS/MVP_SUBJECT_IDS shrinking) would otherwise render an
 * unexplained empty screen instead of the honest "here's everything" default.
 */
export function narrowToSelection<T extends { id: string }>(all: T[], selectedIds: string[] | undefined): T[] {
  if (!selectedIds?.length) return all;
  const narrowed = all.filter(item => selectedIds.includes(item.id));
  return narrowed.length > 0 ? narrowed : all;
}
