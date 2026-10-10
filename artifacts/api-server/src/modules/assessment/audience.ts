/**
 * Who an evaluation is for.
 *
 * A group check (support groups, 2026-10-09) is assigned to particular students
 * through `evaluation_assignments` rows with `student_id` set; it is for those
 * students and nobody else. An evaluation with no such rows is for its class,
 * read at request time — which is every evaluation that existed before.
 *
 * Pure: routes fetch the assigned ids and ask here. Every student-facing path
 * (exam list, share link, claim, teacher entry, the record, the mastery gate)
 * uses the same answer, so they cannot drift apart.
 */
export type Audience = { kind: "class" } | { kind: "students"; ids: ReadonlySet<string> };

export function audienceFor(assigned: readonly string[] | undefined): Audience {
  return assigned && assigned.length > 0 ? { kind: "students", ids: new Set(assigned) } : { kind: "class" };
}

export function inAudience(audience: Audience, studentId: string): boolean {
  return audience.kind === "class" || audience.ids.has(studentId);
}

/**
 * Whether a student (any of an account's linked roster rows) should see an
 * exam. Holding an attempt always wins: a sitting already started is theirs.
 */
export function examVisibleTo(
  assigned: readonly string[] | undefined,
  studentIds: readonly string[],
  held: boolean,
): boolean {
  if (held) return true;
  const audience = audienceFor(assigned);
  return studentIds.some(id => inAudience(audience, id));
}

/** The most students one group check can be assigned to. */
export const MAX_AUDIENCE = 200;

/**
 * May a check move to class `target`? A class-wide check (nobody assigned)
 * may go anywhere; a group check may be detached, left where it is, or
 * attached to a class that holds every one of its students — never to a class
 * missing any, which would leave names in an audience their class cannot see.
 * `targetMemberIds` is the set of assigned ids that are live members of
 * `target` (the route looks them up).
 */
export function classChangeAllowed(
  assigned: readonly string[],
  targetMemberIds: ReadonlySet<string>,
  target: string | null,
  current: string | null,
): boolean {
  if (assigned.length === 0 || target === null || target === current) return true;
  return assigned.every(id => targetMemberIds.has(id));
}

export type AudienceDecision =
  | { ok: true; studentIds: string[] }
  | { ok: false; status: 400 | 409; code: string; error: string };

/**
 * `PUT /evaluations/:id/audience`. `memberIds` is the subset of the requested
 * ids that are live, non-archived members of the evaluation's class (the route
 * looks them up). The audience is fixed once students can start, so only a
 * draft accepts one.
 */
export function audienceRequestDecision(input: {
  status: string;
  classGroupId: string | null;
  studentIds: unknown;
  memberIds: ReadonlySet<string>;
}): AudienceDecision {
  const raw = input.studentIds;
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, status: 400, code: "audience_empty", error: "studentIds must be a non-empty list" };
  }
  if (raw.length > MAX_AUDIENCE) {
    return { ok: false, status: 400, code: "audience_too_large", error: `A group is at most ${MAX_AUDIENCE} students` };
  }
  const ids = raw.map(v => (typeof v === "string" ? v.trim() : ""));
  if (ids.some(id => !id) || new Set(ids).size !== ids.length) {
    return { ok: false, status: 400, code: "audience_invalid", error: "studentIds must be distinct student ids" };
  }
  if (input.status !== "draft") {
    return { ok: false, status: 409, code: "audience_locked", error: "The group is fixed once the check is published" };
  }
  if (!input.classGroupId) {
    return { ok: false, status: 409, code: "audience_no_class", error: "Attach the check to a class first" };
  }
  if (ids.some(id => !input.memberIds.has(id))) {
    return { ok: false, status: 400, code: "audience_not_member", error: "Every student must be in this class" };
  }
  return { ok: true, studentIds: ids };
}
