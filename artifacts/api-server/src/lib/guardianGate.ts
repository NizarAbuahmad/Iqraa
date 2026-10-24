/**
 * Who is held until a parent approves, what a held account may still reach, and what the app is told.
 *
 * No database or flag import, so `node --test` can load it (same reason as `suspension.ts`, whose `routeKey` it
 * reuses). The caller supplies the flag and the one fact that needs a query, the roster link.
 */
import { routeKey } from "./suspension.ts";

export interface GuardianSubject {
  role: string;
  /** Null for an account made from a teacher's code alone: the teacher vouches for it. */
  email: string | null;
  guardianApprovedAt: Date | null;
}

/** Whether the roster-link query is worth running. True for almost nobody, which keeps the gate off the hot path. */
export function needsLinkLookup(s: GuardianSubject, flagOn: boolean): boolean {
  return flagOn && s.role === "student" && s.email !== null && s.guardianApprovedAt === null;
}

/** A student with an email, no parent approval and no teacher link, while the flag is on. */
export function pendingGuardian(s: GuardianSubject, o: { flagOn: boolean; hasLiveLink: boolean }): boolean {
  return needsLinkLookup(s, o.flagOn) && !o.hasLiveLink;
}

/**
 * What a pending account may still do: read itself, ask for approval, sign out, erase itself (erasure does not
 * pause, as for a suspended account), join a class with a teacher's code, the other way in, and change role.
 * Leaving the student role grants nothing the gate protects, and without it a student who picked the wrong role
 * at sign-up would have no way out of the waiting screen. Matched on `originalUrl` through `routeKey`, which strips
 * the query, the `/api` prefix and a trailing slash.
 */
const MAY_REACH = new Set([
  "GET /auth/me",
  "POST /auth/guardian-request",
  "POST /auth/role",
  "POST /auth/logout",
  "DELETE /auth/users/me",
  "GET /auth/claim",
  "POST /auth/claim",
  "DELETE /auth/claim",
]);

export function guardianMayReach(method: string, originalUrl: string): boolean {
  return MAY_REACH.has(routeKey(method, originalUrl));
}

export type GuardianStatus = "not_required" | "approved" | "needed" | "waiting" | "declined";

/** The latest request that is not superseded, reduced to what the status needs. */
export interface GuardianRequestView {
  decision: "approved" | "declined" | null;
  /** Null until the mail is issued. */
  expiresAt: Date | null;
}

export function guardianStatus(
  s: GuardianSubject,
  o: { flagOn: boolean; hasLiveLink: boolean; request: GuardianRequestView | null; now: Date },
): GuardianStatus {
  if (!o.flagOn || s.role !== "student" || s.email === null) return "not_required";
  if (s.guardianApprovedAt !== null) return "approved";
  if (o.hasLiveLink) return "not_required";
  const r = o.request;
  if (!r) return "needed";
  if (r.decision === "declined") return "declined";
  if (r.expiresAt !== null && r.expiresAt <= o.now) return "needed";
  return "waiting";
}
