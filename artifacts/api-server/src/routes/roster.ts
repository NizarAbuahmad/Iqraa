/**
 * Roster — classes and students.
 *
 * Students have no accounts (see lib/db/src/schema/students.ts), so every row
 * here is owned by the teacher who created it and every query is scoped to
 * `req.user.id`. There is no sharing between teachers yet; when a school layer
 * arrives, the ownership check is the thing that has to change.
 *
 * Students are personal data about minors. Names are never logged, and the
 * error paths deliberately say "not found" rather than distinguishing "exists
 * but belongs to another teacher" — the latter leaks the roster of a colleague.
 */
import { Router } from "express";
import { db } from "@workspace/db";
import { classGroups, classMemberships, students } from "@workspace/db";
import { and, asc, count, eq, inArray, isNull } from "drizzle-orm";
import {
  authMiddleware,
  requireRole,
  TEACHER_ROLES,
  type AuthenticatedRequest,
} from "../middlewares/auth.js";
import { logger } from "../lib/logger";
import { isSchemaMissing } from "../lib/schemaMissing.js";
import { generateShareCode } from "../modules/assessment/studentView.ts";
import { claimCodeIsLive } from "../lib/claimCode.ts";
import { requireRosterConsent } from "../lib/rosterConsent.js";
import { studentAccountsEnabled } from "../lib/features.js";

const router = Router();

// Scoped to this router's own paths. A bare `router.use(authMiddleware)` here
// matches every path, and because this router is mounted at the root of /api it
// then answered 401 for routers mounted after it — chat, generate and the math
// verifier were all guarded by accident of ordering rather than by intent.
// requireRole closes the gap where any authenticated user, not just a
// teacher, could read or edit a roster.
router.use(["/classes", "/students"], authMiddleware, requireRole(...TEACHER_ROLES));
// Entering a child's name is the earliest consent surface in the product and
// the only one live in a teacher-only v1. Scoped to the same two paths, so a
// roster route added later is gated without anyone remembering to gate it;
// reads pass through untouched (see lib/rosterConsent.ts for why).
router.use(["/classes", "/students"], requireRosterConsent);

const MAX_BULK_STUDENTS = 200;

function trimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** Single exit for every roster failure: 503 + a code when the schema is absent. */
function failRoster(
  res: Parameters<Parameters<typeof router.get>[1]>[1],
  err: unknown,
  action: string,
  message: string,
): void {
  if (isSchemaMissing(err)) {
    logger.error(
      { err },
      `${action} failed — roster tables are missing from this database. ` +
        "Run `pnpm --filter @workspace/db run push` against DATABASE_URL.",
    );
    res.status(503).json({
      code: "roster_storage_unavailable",
      error: "Roster storage is not set up on this server yet.",
    });
    return;
  }
  logger.error({ err }, `${action} failed`);
  res.status(500).json({ error: message });
}

// ─── Classes ─────────────────────────────────────────────────────────────────

router.get("/classes", async (req: AuthenticatedRequest, res) => {
  try {
    // Left-joined aggregate rather than a correlated subquery: the archived
    // filter has to sit in the JOIN condition, not the WHERE, or classes with
    // no students disappear from the list instead of showing zero.
    const rows = await db
      .select({
        id: classGroups.id,
        name: classGroups.name,
        nameAr: classGroups.nameAr,
        gradeId: classGroups.gradeId,
        subjectId: classGroups.subjectId,
        academicYear: classGroups.academicYear,
        createdAt: classGroups.createdAt,
        studentCount: count(students.id),
      })
      .from(classGroups)
      .leftJoin(classMemberships, eq(classMemberships.classGroupId, classGroups.id))
      .leftJoin(
        students,
        and(eq(students.id, classMemberships.studentId), isNull(students.archivedAt)),
      )
      .where(and(eq(classGroups.teacherId, req.user!.id), isNull(classGroups.archivedAt)))
      .groupBy(classGroups.id)
      .orderBy(asc(classGroups.createdAt));

    res.json({ classes: rows });
  } catch (err) {
    failRoster(res, err, "list classes", "Failed to load classes");
  }
});

router.post("/classes", async (req: AuthenticatedRequest, res) => {
  try {
    const name = trimmed(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "name is required" });
      return;
    }

    const [row] = await db
      .insert(classGroups)
      .values({
        teacherId: req.user!.id,
        name,
        nameAr: trimmed(req.body?.nameAr),
        gradeId: trimmed(req.body?.gradeId),
        subjectId: trimmed(req.body?.subjectId),
        academicYear: trimmed(req.body?.academicYear),
      })
      .returning();

    res.status(201).json({ class: { ...row, studentCount: 0 } });
  } catch (err) {
    failRoster(res, err, "create class", "Failed to create class");
  }
});

router.get("/classes/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const [group] = await db
      .select()
      .from(classGroups)
      .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
      .limit(1);

    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const roster = await db
      .select({
        id: students.id,
        displayName: students.displayName,
        externalRef: students.externalRef,
        gradeId: students.gradeId,
        teacherNote: students.teacherNote,
        createdAt: students.createdAt,
      })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(and(eq(classMemberships.classGroupId, classId), isNull(students.archivedAt)))
      .orderBy(asc(students.displayName));

    res.json({ class: group, students: roster });
  } catch (err) {
    failRoster(res, err, "get class", "Failed to load class");
  }
});

router.patch("/classes/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    for (const field of ["name", "nameAr", "gradeId", "subjectId", "academicYear"] as const) {
      if (req.body?.[field] !== undefined) patch[field] = trimmed(req.body[field]);
    }
    if (patch["name"] === "") {
      res.status(400).json({ error: "name cannot be empty" });
      return;
    }

    const [row] = await db
      .update(classGroups)
      .set(patch)
      .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    res.json({ class: row });
  } catch (err) {
    failRoster(res, err, "update class", "Failed to update class");
  }
});

/**
 * Archive rather than delete. A class is referenced by assignments and, through
 * them, by results — deleting it would orphan a student's history, which is the
 * one thing the module exists to keep.
 */
router.delete("/classes/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const [row] = await db
      .update(classGroups)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
      .returning({ id: classGroups.id });

    if (!row) {
      res.status(404).json({ error: "Class not found" });
      return;
    }
    res.json({ archived: row.id });
  } catch (err) {
    failRoster(res, err, "archive class", "Failed to archive class");
  }
});

// ─── Students ────────────────────────────────────────────────────────────────

router.get("/students", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = trimmed(req.query["classId"]);

    if (classId) {
      const [owned] = await db
        .select({ id: classGroups.id })
        .from(classGroups)
        .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
        .limit(1);
      if (!owned) {
        res.status(404).json({ error: "Class not found" });
        return;
      }

      const rows = await db
        .select({
          id: students.id,
          displayName: students.displayName,
          externalRef: students.externalRef,
          gradeId: students.gradeId,
          createdAt: students.createdAt,
        })
        .from(classMemberships)
        .innerJoin(students, eq(students.id, classMemberships.studentId))
        .where(and(eq(classMemberships.classGroupId, classId), isNull(students.archivedAt)))
        .orderBy(asc(students.displayName));

      res.json({ students: rows });
      return;
    }

    const rows = await db
      .select({
        id: students.id,
        displayName: students.displayName,
        externalRef: students.externalRef,
        gradeId: students.gradeId,
        teacherNote: students.teacherNote,
        createdAt: students.createdAt,
      })
      .from(students)
      .where(and(eq(students.teacherId, req.user!.id), isNull(students.archivedAt)))
      .orderBy(asc(students.displayName));

    res.json({ students: rows });
  } catch (err) {
    failRoster(res, err, "list students", "Failed to load students");
  }
});

/**
 * Add students to a class. Accepts one or many, because a teacher setting up
 * for the first time is typing in a register of thirty, not one name a page.
 *
 * Existing students are matched by id and simply joined to the class, so moving
 * a student into a second subject does not duplicate their record or split
 * their history across two rows.
 */
router.post("/classes/:id/students", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const [group] = await db
      .select()
      .from(classGroups)
      .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
      .limit(1);

    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const raw = Array.isArray(req.body?.students)
      ? req.body.students
      : req.body?.displayName !== undefined
        ? [req.body]
        : null;

    if (!raw || raw.length === 0) {
      res.status(400).json({ error: "Provide a student or a students array" });
      return;
    }
    if (raw.length > MAX_BULK_STUDENTS) {
      res.status(400).json({ error: `At most ${MAX_BULK_STUDENTS} students per request` });
      return;
    }

    const toCreate: { displayName: string; externalRef: string | null }[] = [];
    const existingIds: string[] = [];

    for (const entry of raw) {
      const id = trimmed(entry?.id);
      if (id) {
        existingIds.push(id);
        continue;
      }
      const displayName = trimmed(entry?.displayName);
      if (!displayName) {
        res.status(400).json({ error: "Every student needs a displayName or an id" });
        return;
      }
      toCreate.push({ displayName, externalRef: trimmed(entry?.externalRef) || null });
    }

    /**
     * Skip names already in this class.
     *
     * Without this, a teacher who re-pastes their register — or adds three
     * latecomers by pasting the whole list again — gets a second student row
     * with the same name. From that point the child's results are split across
     * two records, and nothing on screen shows why one of them is half empty.
     *
     * Matching is scoped to this class and is whitespace-normalized only. It
     * deliberately does not reach across classes or fold Arabic orthography:
     * merging two people who happen to share a name is a worse failure than
     * creating a duplicate, because it cannot be undone from the UI. Two real
     * students with identical names in one class have to be distinguished by
     * the teacher — their own register has the same problem.
     */
    const nameKey = (name: string) => name.replace(/\s+/g, " ").trim().toLowerCase();

    const alreadyInClass = await db
      .select({ displayName: students.displayName })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(and(eq(classMemberships.classGroupId, classId), isNull(students.archivedAt)));

    const takenNames = new Set(alreadyInClass.map(s => nameKey(s.displayName)));
    const skipped = toCreate.filter(s => takenNames.has(nameKey(s.displayName)));
    const fresh = toCreate.filter(s => !takenNames.has(nameKey(s.displayName)));
    toCreate.length = 0;
    toCreate.push(...fresh);

    // Only ever attach students this teacher owns — an id from elsewhere must
    // not pull a stranger's student into this roster.
    let ownedExisting: { id: string }[] = [];
    if (existingIds.length > 0) {
      ownedExisting = await db
        .select({ id: students.id })
        .from(students)
        .where(and(eq(students.teacherId, req.user!.id), inArray(students.id, existingIds)));

      if (ownedExisting.length !== existingIds.length) {
        res.status(404).json({ error: "One or more students not found" });
        return;
      }
    }

    const created =
      toCreate.length > 0
        ? await db
            .insert(students)
            .values(
              toCreate.map(s => ({
                teacherId: req.user!.id,
                displayName: s.displayName,
                externalRef: s.externalRef,
                gradeId: group.gradeId,
              })),
            )
            .returning()
        : [];

    const allIds = [...created.map(s => s.id), ...ownedExisting.map(s => s.id)];
    let joined: { studentId: string }[] = [];
    if (allIds.length > 0) {
      joined = await db
        .insert(classMemberships)
        .values(allIds.map(studentId => ({ classGroupId: classId, studentId })))
        // Re-adding a student already in the class is a no-op, not an error —
        // it is what happens when a teacher taps twice on a slow connection.
        .onConflictDoNothing()
        .returning({ studentId: classMemberships.studentId });
    }

    // `added` counts memberships actually created, so a duplicate tap reports 0
    // rather than claiming an add that did not happen. `skipped` names the
    // students who were already on the roster, so the teacher can see that the
    // shortfall was intentional rather than a failure.
    res.status(201).json({
      added: joined.length,
      created: created.length,
      skipped: skipped.map(s => s.displayName),
      students: created,
    });
  } catch (err) {
    failRoster(res, err, "add students", "Failed to add students");
  }
});

/** Remove from the class only. The student record and their history survive. */
router.delete("/classes/:id/students/:studentId", async (req: AuthenticatedRequest, res) => {
  try {
    const classId = req.params["id"] as string;
    const studentId = req.params["studentId"] as string;

    const [group] = await db
      .select({ id: classGroups.id })
      .from(classGroups)
      .where(and(eq(classGroups.id, classId), eq(classGroups.teacherId, req.user!.id)))
      .limit(1);

    if (!group) {
      res.status(404).json({ error: "Class not found" });
      return;
    }

    const removed = await db
      .delete(classMemberships)
      .where(
        and(
          eq(classMemberships.classGroupId, classId),
          eq(classMemberships.studentId, studentId),
        ),
      )
      .returning({ id: classMemberships.id });

    if (removed.length === 0) {
      res.status(404).json({ error: "Student is not in this class" });
      return;
    }
    res.json({ removed: studentId });
  } catch (err) {
    failRoster(res, err, "remove student", "Failed to remove student");
  }
});

router.patch("/students/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const studentId = req.params["id"] as string;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.displayName !== undefined) {
      const displayName = trimmed(req.body.displayName);
      if (!displayName) {
        res.status(400).json({ error: "displayName cannot be empty" });
        return;
      }
      patch["displayName"] = displayName;
    }
    if (req.body?.externalRef !== undefined) {
      patch["externalRef"] = trimmed(req.body.externalRef) || null;
    }
    // Not `|| null` like externalRef above: an empty note is the teacher
    // clearing it, and the column is NOT NULL. Only surrounding whitespace goes.
    if (req.body?.teacherNote !== undefined) {
      patch["teacherNote"] = trimmed(req.body.teacherNote);
    }

    const [row] = await db
      .update(students)
      .set(patch)
      .where(and(eq(students.id, studentId), eq(students.teacherId, req.user!.id)))
      .returning();

    if (!row) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    res.json({ student: row });
  } catch (err) {
    failRoster(res, err, "update student", "Failed to update student");
  }
});

/**
 * Returns the student's current claim code, so the teacher can re-open the
 * screen and share the code they already handed out.
 *
 * Without this the only affordance was minting, which overwrites — a teacher
 * who generated a code, gave it to a parent, and came back saw an empty card
 * and one button that silently invalidated the parent's code.
 *
 * An expired code is reported as no code at all. Collapsing it here rather
 * than in the client leaves the screen two states instead of three, and means
 * anything it displays is something `resolveClaimCode` will accept — the two
 * share `claimCodeIsLive` so they cannot drift apart.
 *
 * Readable at all only because `students.claimCode` is stored in plain text,
 * which that schema argues for deliberately (it grants a chat link, not
 * exam-answering access). If it ever becomes a hash, this endpoint goes with it.
 */
router.get("/students/:id/claim-code", async (req: AuthenticatedRequest, res) => {
  try {
    // Same refusal as the mint below: handing back a code minted before the
    // flag flipped is still handing out something nothing can redeem.
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not enabled on this deployment.",
      });
      return;
    }

    const studentId = req.params["id"] as string;
    const [row] = await db
      .select({
        claimCode: students.claimCode,
        claimCodeExpiresAt: students.claimCodeExpiresAt,
      })
      .from(students)
      // Ownership in the WHERE, not a separate check: another teacher's
      // student is a 404 here, the same as everywhere else in this router.
      .where(and(eq(students.id, studentId), eq(students.teacherId, req.user!.id)))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Student not found" });
      return;
    }

    if (!claimCodeIsLive(row.claimCodeExpiresAt)) {
      res.json({ claimCode: null, claimCodeExpiresAt: null });
      return;
    }
    res.json({ claimCode: row.claimCode, claimCodeExpiresAt: row.claimCodeExpiresAt });
  } catch (err) {
    failRoster(res, err, "read claim code", "Failed to load the link code");
  }
});

/**
 * Mints a fresh claim code so the teacher can hand it to a parent or the
 * student themself for self-serve signup — see /auth/register and
 * /auth/claim. Regenerating overwrites the previous code rather than
 * allowing several live at once: a code the teacher no longer trusts just
 * stops working the moment they ask for a new one.
 *
 * This is now the deliberate branch, not the default one — the client asks
 * before calling it when a live code already exists (see the GET above).
 */
router.post("/students/:id/claim-code", async (req: AuthenticatedRequest, res) => {
  try {
    // A code nobody can redeem is a dead end that looks like a feature. When
    // parent and student accounts are off, minting one would have the teacher
    // hand a child a code that answers 403 at signup.
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not enabled on this deployment.",
      });
      return;
    }

    const studentId = req.params["id"] as string;
    const claimCode = generateShareCode();
    const claimCodeExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const [row] = await db
      .update(students)
      .set({ claimCode, claimCodeExpiresAt, updatedAt: new Date() })
      .where(and(eq(students.id, studentId), eq(students.teacherId, req.user!.id)))
      .returning({ id: students.id });

    if (!row) {
      res.status(404).json({ error: "Student not found" });
      return;
    }
    res.status(201).json({ claimCode, claimCodeExpiresAt });
  } catch (err) {
    failRoster(res, err, "generate claim code", "Failed to generate claim code");
  }
});

export default router;
