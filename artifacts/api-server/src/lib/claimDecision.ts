/**
 * The rules that decide whether a code may link somebody to a roster row, with
 * no database attached.
 *
 * Split out of rosterClaim.ts rather than living beside the queries because
 * `@workspace/db` throws at import when DATABASE_URL is unset and constructs a
 * pg.Pool when it is (lib/db/src/index.ts) — which is why this repo has no
 * DB-backed tests at all. Anything importing rosterClaim.ts to test these rules
 * would need a live database. Three of them are trust-boundary rules — code
 * expiry, class membership, and one-account-per-student — so "untestable
 * forever" was not an acceptable place to leave them.
 *
 * The two lookups arrive as functions instead of precomputed booleans. Which
 * student a code resolves to is *itself* one of the decisions here, so a caller
 * passing `hasSelfLink` up front would have to work out the target first and
 * would end up duplicating this branching to do it. Injected, each query runs
 * once, only on the path that needs it, and a test hands over a plain stub.
 */

/** Mirrors `RosterLinkRelation` in @workspace/db. Restated rather than imported: importing it would drag in the pool this module exists to avoid. */
export type ClaimRelation = "self" | "guardian";

export type ClaimRole = "student" | "parent";

export type ClaimResolution =
  | { ok: true; studentId: string; relation: ClaimRelation }
  | { ok: false; status: number; error: string };

/** Every rejection a caller may show. Kept in one place so the wording can't drift between the two callers. */
const INVALID = { ok: false, status: 400, error: "That code is invalid or has expired" } as const;
const NEEDS_NAME = { ok: false, status: 400, error: "Choose your name from the class list" } as const;
const NOT_IN_CLASS = { ok: false, status: 400, error: "That name is not on this class list" } as const;
const ALREADY_LINKED = { ok: false, status: 409, error: "This student is already linked to an account" } as const;

export interface ClaimInput {
  now: Date;
  role: ClaimRole;
  /** Which roster row the joiner picked. Only meaningful for a class code; ignored by a per-student one, which names its own student. */
  requestedStudentId?: string | undefined;
  /** The `students` row whose claimCode matched, if any. */
  student: { id: string; expiresAt: Date | null } | null;
  /** The `class_groups` row whose joinCode matched, if any. */
  classGroup: { id: string; expiresAt: Date | null } | null;
  isMember: (studentId: string, classGroupId: string) => Promise<boolean>;
  hasSelfLink: (studentId: string) => Promise<boolean>;
}

const live = (expiresAt: Date | null, now: Date): boolean => !!expiresAt && expiresAt > now;

export async function decideClaim(input: ClaimInput): Promise<ClaimResolution> {
  const { now, role, requestedStudentId, student, classGroup } = input;
  const relation: ClaimRelation = role === "student" ? "self" : "guardian";

  // A per-student code names its own student, so it never needs a picked name
  // and ignores one that was sent anyway. Checked first: on the (roughly 1 in
  // 887M) chance the two unique indexes mint the same 6 characters, the
  // narrower code — one student, 30 days — is the safer one to honour.
  const target = live(student?.expiresAt ?? null, now)
    ? student!.id
    : live(classGroup?.expiresAt ?? null, now)
      ? requestedStudentId
      : null;

  if (target === null) return INVALID;
  // A live class code with no name picked. Distinct from INVALID on purpose:
  // the code worked, the joiner just has one more step.
  if (target === undefined) return NEEDS_NAME;

  // Only reached on the class-code path — a per-student code already named its
  // own student, so there is nothing to verify it against.
  if (!live(student?.expiresAt ?? null, now)) {
    if (!(await input.isMember(target, classGroup!.id))) return NOT_IN_CLASS;
  }

  // One student, one self-link. A second sibling or friend trying the same code
  // as a student is refused; a second guardian on the same child is expected
  // (both parents) and deliberately unrestricted.
  if (relation === "self" && (await input.hasSelfLink(target))) return ALREADY_LINKED;

  return { ok: true, studentId: target, relation };
}
