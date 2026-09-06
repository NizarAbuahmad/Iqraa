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
 * Two kinds of code arrive here and both are handled in this one place, so
 * neither caller has to know the difference:
 *   - `students.claimCode` — names one student, 30 days.
 *   - `class_groups.joinCode` — one code for a whole class; the joiner picks
 *     their own name off the roster and sends it as `studentId`.
 *
 * This file holds only the queries. Every rule lives in lib/claimDecision.ts,
 * which has no database import and is therefore testable — see the note at the
 * top of that file for why that split exists.
 *
 * Does not insert `rosterLinks` itself: the two call sites differ in whether
 * the user row already exists, so inserting is left to them.
 */
import { db } from "@workspace/db";
import { students, classGroups, classMemberships, rosterLinks } from "@workspace/db";
import { and, eq, isNull } from "drizzle-orm";
import { normalizeShareCode } from "../modules/assessment/studentView.ts";
import { decideClaim, type ClaimResolution, type ClaimRole } from "./claimDecision.ts";

export type { ClaimResolution, ClaimRole };

export async function resolveClaimCode(
  rawCode: string,
  role: ClaimRole,
  requestedStudentId?: string,
): Promise<ClaimResolution> {
  // Both codes are minted by generateShareCode, so both are normalizable the
  // same way. Without this a parent typing what they were given — `yhfm8y`, or
  // `YHFM-8Y` off a whiteboard — was told their code was invalid or expired.
  // Applied here rather than in each caller, so /register and /auth/claim
  // cannot disagree about what counts as the same code.
  const code = normalizeShareCode(rawCode);
  if (!code) return { ok: false, status: 400, error: "That code is invalid or has expired" };

  const [student] = await db
    .select({ id: students.id, expiresAt: students.claimCodeExpiresAt })
    .from(students)
    .where(and(eq(students.claimCode, code), isNull(students.archivedAt)))
    .limit(1);

  const [classGroup] = await db
    .select({ id: classGroups.id, expiresAt: classGroups.joinCodeExpiresAt })
    .from(classGroups)
    .where(and(eq(classGroups.joinCode, code), isNull(classGroups.archivedAt)))
    .limit(1);

  return decideClaim({
    now: new Date(),
    role,
    requestedStudentId,
    student: student ?? null,
    classGroup: classGroup ?? null,

    isMember: async (studentId, classGroupId) => {
      const [row] = await db
        .select({ id: classMemberships.id })
        .from(classMemberships)
        .innerJoin(students, eq(students.id, classMemberships.studentId))
        .where(
          and(
            eq(classMemberships.classGroupId, classGroupId),
            eq(classMemberships.studentId, studentId),
            isNull(students.archivedAt),
          ),
        )
        .limit(1);
      return !!row;
    },

    hasSelfLink: async studentId => {
      const [row] = await db
        .select({ id: rosterLinks.id })
        .from(rosterLinks)
        .where(and(eq(rosterLinks.studentId, studentId), eq(rosterLinks.relation, "self")))
        .limit(1);
      return !!row;
    },
  });
}
