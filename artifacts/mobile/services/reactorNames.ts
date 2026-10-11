/**
 * Display names for the teacher's «who reacted» list. Pure — no RN or expo
 * imports — so it is testable by bare `node --test`.
 *
 * The viewer is resolved first: in a direct thread the participant lookup holds
 * only the OTHER person, so without this the viewer's own reaction fell through
 * to the unknown label and read as an unidentified third party in a 1:1 chat.
 */
export function reactorNames(
  userIds: readonly string[],
  viewerId: string | undefined,
  lookup: ReadonlyMap<string, { firstName: string; lastName: string }>,
  labels: { you: string; unknown: string },
): string[] {
  return userIds.map(id => {
    if (viewerId !== undefined && id === viewerId) return labels.you;
    const p = lookup.get(id);
    return p ? `${p.firstName} ${p.lastName}`.trim() : labels.unknown;
  });
}
