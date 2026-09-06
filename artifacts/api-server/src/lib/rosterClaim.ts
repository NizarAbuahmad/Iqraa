/**
 * Resolves a claim code to a roster link — the seam between a teacher's
 * roster (a student row with no account, see lib/db/src/schema/students.ts)
 * and a real parent or student account signing up for the first time.
 *
 * Shared between routes/auth.ts (`/register`, where the user row doesn't
 * exist yet) and `/auth/claim` (an already-authenticated user linking a
 * second roster row) — both need the same "is this code valid, and is this
 * student already self-claimed" check, and only differ in when they insert
 * the user row relative to it.
 *
 * Does not insert `rosterLinks` itself: the two call sites differ in whether
 * the user row already exists, so inserting is left to them.
 */
import { db } from "@workspace/db";
import { students, rosterLinks, type RosterLinkRelation } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { claimCodeIsLive, claimCodeLookupKey } from "./claimCode.ts";

export type ClaimRole = "student" | "parent";

export type ClaimResolution =
  | { ok: true; studentId: string; relation: RosterLinkRelation }
  | { ok: false; status: number; error: string };

export async function resolveClaimCode(code: string, role: ClaimRole): Promise<ClaimResolution> {
  // Normalised here rather than at the call sites. Both of them used to only
  // `.trim()`, so a parent pasting «abc-234 » — lower case, a dash because it
  // looks like a code, a trailing space from the copy — was told the code was
  // invalid or expired, which was neither true nor actionable. The exam flow
  // has always normalised (`routes/studentAttempt.ts`); claim codes never did.
  // Fixing it in the shared resolver rather than in the two callers means the
  // third caller cannot forget.
  const normalized = claimCodeLookupKey(code);
  if (!normalized) {
    return { ok: false, status: 400, error: "That code is invalid or has expired" };
  }

  const [student] = await db
    .select({ id: students.id, claimCodeExpiresAt: students.claimCodeExpiresAt })
    .from(students)
    .where(eq(students.claimCode, normalized))
    .limit(1);

  if (!student || !claimCodeIsLive(student.claimCodeExpiresAt)) {
    return { ok: false, status: 400, error: "That code is invalid or has expired" };
  }

  const relation: RosterLinkRelation = role === "student" ? "self" : "guardian";

  if (relation === "self") {
    // One student, one self-link — a second sibling or friend trying the same
    // code as a student gets a clear error. A second guardian using the same
    // code is expected (both parents) and has no such restriction.
    const [existingSelf] = await db
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .where(and(eq(rosterLinks.studentId, student.id), eq(rosterLinks.relation, "self")))
      .limit(1);
    if (existingSelf) {
      return { ok: false, status: 409, error: "This student is already linked to an account" };
    }
  }

  return { ok: true, studentId: student.id, relation };
}
