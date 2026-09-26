/**
 * Whether an account may still change the role it picked at signup.
 *
 * The role is asked once, on the register screen, before anyone has seen what
 * the app does with the answer — and getting it wrong was a dead end. A
 * parent/student account with no roster link is held on `/claim-required` by
 * the routing gate (services/routeGating.ts) with no back button, a second
 * signup on the same email is refused, and signing in again with Google keeps
 * the role already stored. So the only exit was a second email address.
 *
 * A teacher may leave too, while they own no class and no student — see
 * `hasTeachingData`. Otherwise open only while nothing depends on the answer:
 * no roster link yet. Once
 * there is one this account is somebody's guardian or the student themselves
 * — `guardiansForStudent()` filters on `role === 'parent'`, and a teacher has
 * generated work hanging off theirs — so changing it then would leave rows
 * pointing at a role that no longer matches. That is a support conversation,
 * not a button.
 *
 * Rules live here, with no database attached, for the reason claimDecision.ts
 * gives at length: importing anything that reaches `@workspace/db` needs a
 * live DATABASE_URL, so route-level rules are only testable when they are
 * pulled out of the route.
 */

export type SwitchableRole = "teacher" | "parent" | "student";

export type RoleSwitchErrorCode =
  | "role_invalid"
  | "role_locked"
  | "role_locked_linked"
  | "role_locked_teaching"
  | "student_accounts_disabled";

export type RoleSwitchDecision =
  | { ok: true; role: SwitchableRole; changed: boolean }
  | { ok: false; status: number; error: string; code: RoleSwitchErrorCode };

const ROLES: readonly string[] = ["teacher", "parent", "student"];

export interface RoleSwitchInput {
  /** The role on the row right now — not the one in the access token. */
  currentRole: string;
  requestedRole: unknown;
  studentAccountsEnabled: boolean;
  /** Asked at most once, and only on the path that can still say yes. */
  hasRosterLink: () => Promise<boolean>;
  /**
   * Whether a teacher owns a class or a student — the rows other accounts
   * hang off (join codes, roster links, guardians). Personal work (plans,
   * generations, schedule) does not count: it is still there if they switch
   * back, which an unlinked parent/student may. Asked only for a teacher.
   */
  hasTeachingData: () => Promise<boolean>;
}

export async function decideRoleSwitch(input: RoleSwitchInput): Promise<RoleSwitchDecision> {
  const requested = typeof input.requestedRole === "string" ? input.requestedRole.trim() : "";
  if (!ROLES.includes(requested)) {
    return { ok: false, status: 400, code: "role_invalid", error: "Pick teacher, parent or student" };
  }
  const role = requested as SwitchableRole;

  // Signup pre-selected "teacher" for a long time, and Google sign-in from the
  // login screen still creates one — so a parent can end up here by accident.
  // Let a teacher out only while no class or student depends on the role.
  const isTeacher = input.currentRole === "teacher";
  if (!isTeacher && input.currentRole !== "parent" && input.currentRole !== "student") {
    return { ok: false, status: 403, code: "role_locked", error: "This account's type can no longer be changed" };
  }

  // Same gate as /register and /claim: with student accounts off, parent and
  // student are not roles anyone may move *into*. Teacher stays reachable —
  // otherwise turning the flag off would re-trap the very accounts it closes.
  if (role !== "teacher" && !input.studentAccountsEnabled) {
    return {
      ok: false,
      status: 403,
      code: "student_accounts_disabled",
      error: "Parent and student accounts are not available yet.",
    };
  }

  // Before the no-op shortcut, so that every `ok` decision — changed or not —
  // is one made about an account with nothing attached to its current role.
  if (isTeacher) {
    if (await input.hasTeachingData()) {
      return {
        ok: false,
        status: 409,
        code: "role_locked_teaching",
        error: "This account already has classes or students",
      };
    }
    return { ok: true, role, changed: role !== input.currentRole };
  }

  if (await input.hasRosterLink()) {
    return {
      ok: false,
      status: 409,
      code: "role_locked_linked",
      error: "This account is already linked to a class",
    };
  }

  return { ok: true, role, changed: role !== input.currentRole };
}
