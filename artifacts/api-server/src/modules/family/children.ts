/**
 * A parent's "children", as the schedule needs them.
 *
 * `students` rows are teacher-owned: the same child taught by two teachers is
 * two rows, each linked to the parent through its own `roster_links` row. The
 * schedule is assembled from every class those rows sit in, so it must treat
 * them as one child. There is no child entity to join on, so rows are grouped
 * by normalised name — inside one parent's own links, never across accounts.
 *
 * Pure and import-free so `node --test` can load it.
 */
export interface GuardianLink {
  studentId: string;
  displayName: string;
}

export interface ChildGroup {
  /** The smallest roster-row id in the group: stable, and unique per parent. */
  key: string;
  displayName: string;
  /** Sorted, de-duplicated. */
  studentIds: string[];
}

export function normalizeChildName(name: string): string {
  return name.normalize("NFKC").trim().replace(/\s+/g, " ").toLowerCase();
}

export function groupChildren(links: readonly GuardianLink[]): ChildGroup[] {
  // Smallest id first, so the group's name and key do not depend on row order.
  const sorted = [...links].sort((a, b) => (a.studentId < b.studentId ? -1 : a.studentId > b.studentId ? 1 : 0));
  const byName = new Map<string, ChildGroup>();
  for (const link of sorted) {
    const name = normalizeChildName(link.displayName);
    const existing = byName.get(name);
    if (!existing) {
      byName.set(name, {
        key: link.studentId,
        displayName: link.displayName.trim().replace(/\s+/g, " "),
        studentIds: [link.studentId],
      });
    } else if (!existing.studentIds.includes(link.studentId)) {
      existing.studentIds.push(link.studentId);
    }
  }
  return [...byName.values()].sort(
    (a, b) => a.displayName.localeCompare(b.displayName, "ar") || (a.key < b.key ? -1 : 1),
  );
}
