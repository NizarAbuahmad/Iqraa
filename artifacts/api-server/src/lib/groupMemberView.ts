/**
 * Which group members a viewer is sent with a thread.
 *
 * `GET /messaging/threads/:id` used to send every member's name and role to
 * every member. In an announcement-only class group that is the whole class
 * list, delivered to each child in it, for a screen that only ever needs a
 * name to put on a message — and in that kind of group only staff post.
 *
 * So: the group's owner sees everyone (they manage the list), as does any
 * staff member in it. Anyone else in an announcement-only group gets the
 * staff and themselves. A group where students may post keeps the full
 * list, because each student's messages need a name and the members are
 * talking to each other there by the teacher's choice.
 */
export interface GroupMemberViewInput<M extends { userId: string; role: string }> {
  members: readonly M[];
  viewerId: string;
  viewerIsOwner: boolean;
  studentPostingEnabled: boolean;
  isStaff: (role: string) => boolean;
}

export function visibleGroupMembers<M extends { userId: string; role: string }>(input: GroupMemberViewInput<M>): M[] {
  const { members, viewerId, viewerIsOwner, studentPostingEnabled, isStaff } = input;
  const viewer = members.find(m => m.userId === viewerId);
  if (viewerIsOwner || (viewer && isStaff(viewer.role)) || studentPostingEnabled) return [...members];
  return members.filter(m => m.userId === viewerId || isStaff(m.role));
}
