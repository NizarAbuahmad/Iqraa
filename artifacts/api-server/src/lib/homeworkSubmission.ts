/**
 * The database half of a student's project submission.
 *
 * WHOSE row it is comes from the account, never from the request: `submissionTarget` resolves the
 * roster row the way the tick does (`ownHomeworkRows` — the account's self-linked rows that sit in
 * the homework's own class), and every function below takes that target. Nothing here accepts a
 * `studentId` from a client. Every way to fail to resolve is `null`, so a caller answers one 404.
 *
 * The photo list is changed with single SQL statements (append with a count guard, remove by
 * filtering), not read-modify-write, so two uploads sent at once cannot lose a photo or pass the
 * cap of six together.
 *
 * The same goes for the rule that a handed-in project is never empty (`canSubmit`: a photo or a
 * note with text). The JS checks below answer the common case early, but they read and then
 * write, so two interleaved requests could both pass them. The rule is therefore ALSO in the
 * WHERE of every UPDATE that could break it (`removePhoto`, `setNote`, `submit`): Postgres
 * re-evaluates that WHERE against the committed row after waiting on the row lock, so the second
 * request sees the first one's result. Zero rows back means the rule would have been broken (or,
 * for `removePhoto`, that the photo is already gone), and the function answers accordingly.
 *
 * WHO WROTE IT. A row records its author (`author_user_id`), because the record's link can change hands: a
 * teacher unlinks a mis-claimed account and links another. For the account linked now:
 *   - its own row (author = caller) behaves as always;
 *   - another account's DRAFT (or one with no author) is shown as nothing, and the first write TAKES IT OVER
 *     (`takeOver`): the old photos and note are dropped and the caller becomes the author, in one locked
 *     transaction on the owner connection, and the old objects are deleted after it commits;
 *   - another account's HANDED-IN project (or one with no author) is shown as `otherAuthor: true` with none of
 *     its content, and every write answers `other_author`. The teacher and the parents still read it: it is
 *     the record's work.
 * Every UPDATE below also carries `author_user_id = caller` in its WHERE, so a request that passed its checks
 * just before another account took the row over writes nothing (zero rows, re-read, `other_author`).
 * The previous author is refused before any of this: `ownHomeworkRows` needs a current self link.
 */
import {
  classGroups,
  classMemberships,
  db,
  homework,
  homeworkCompletions,
  homeworkSubmissions,
  rosterLinks,
  students,
  systemDb,
  type HomeworkSubmission,
  type SubmissionPhoto,
} from "@workspace/db";
import { and, asc, eq, inArray, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { logger } from "./logger";
import { deleteObject, presignedGetUrl } from "./r2.ts";
import { ownHomeworkRows, tickRows } from "./homeworkDone.ts";
import { guardianLinkedStudents } from "./familyAccess.ts";
import { groupChildren } from "../modules/family/children.ts";
import {
  PHOTOS_MAX,
  canSubmit,
  isLocked,
  submissionStatus,
  type SubmissionStatus,
} from "../modules/homework/submission.ts";

export interface SubmissionTarget {
  /** The calling account: the author of anything this target writes. */
  userId: string;
  homeworkId: string;
  /** The roster row the submission is stored on: the one that already holds it, else the first (sorted) own row. */
  studentId: string;
  /** Every own roster row in the homework's class — all of them are ticked on a hand-in. */
  rows: string[];
  dueAt: Date;
}

export interface SubmissionPhotoView {
  id: string;
  /** A signed URL valid for ten minutes; null when storage is not configured or signing failed. */
  url: string | null;
  mime: string;
  sizeBytes: number;
}

export interface SubmissionView {
  /** `none` while it is still a draft. */
  status: SubmissionStatus;
  locked: boolean;
  note: string;
  photos: SubmissionPhotoView[];
  submittedAt: string | null;
  /**
   * True only on a student's own read, when the record holds a project another account (or no known account)
   * handed in: the view then carries none of it (status `none`, no note, no photos) and every write is refused
   * with `other_author`. Always false for the teacher's and the parent's reads.
   */
  otherAuthor: boolean;
}

/** The answer a write gives when the record's project was handed in by another account. */
export type OtherAuthor = "other_author";

/** Ten minutes: long enough to open a photo, short enough that a copied link dies quickly. */
export const SIGNED_URL_SECONDS = 600;

export async function submissionTarget(userId: string, homeworkId: string): Promise<SubmissionTarget | null> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own || !own.requiresSubmission) return null;
  // One account can be self-linked to two records in one class. A row the caller wrote comes first, so another
  // account's handed-in project on one record never hides the caller's own work on the other. `IS NOT DISTINCT FROM`,
  // not `=`: an authorless row gives NULL under `=`, and DESC puts NULLs first.
  const [held] = await db
    .select({ studentId: homeworkSubmissions.studentId })
    .from(homeworkSubmissions)
    .where(and(eq(homeworkSubmissions.homeworkId, homeworkId), inArray(homeworkSubmissions.studentId, own.rows)))
    .orderBy(sql`(${homeworkSubmissions.authorUserId} IS NOT DISTINCT FROM ${userId}::uuid) DESC`, homeworkSubmissions.studentId)
    .limit(1);
  return { userId, homeworkId, studentId: held?.studentId ?? own.rows[0]!, rows: own.rows, dueAt: own.dueAt };
}

export async function readOwnSubmission(t: SubmissionTarget): Promise<HomeworkSubmission | null> {
  const [row] = await db
    .select()
    .from(homeworkSubmissions)
    .where(and(eq(homeworkSubmissions.homeworkId, t.homeworkId), eq(homeworkSubmissions.studentId, t.studentId)))
    .limit(1);
  return row ?? null;
}

export async function signPhotos(photos: readonly SubmissionPhoto[]): Promise<SubmissionPhotoView[]> {
  return Promise.all(
    photos.map(async p => ({
      id: p.id,
      url: await presignedGetUrl(p.key, SIGNED_URL_SECONDS),
      mime: p.mime,
      sizeBytes: p.sizeBytes,
    })),
  );
}

const NOTHING: SubmissionView = { status: "none", locked: false, note: "", photos: [], submittedAt: null, otherAuthor: false };

/** A row (or none) as a client sees it. The object key is never in it. The teacher's and the parent's form: no author check. */
export async function viewSubmission(
  row: HomeworkSubmission | null,
  dueAt: Date,
  now: Date = new Date(),
): Promise<SubmissionView> {
  if (!row) return { ...NOTHING };
  return {
    status: submissionStatus({ submittedAt: row.submittedAt, dueAt }),
    locked: isLocked({ submittedAt: row.submittedAt, dueAt, now }),
    note: row.note,
    photos: await signPhotos(row.photos),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
    otherAuthor: false,
  };
}

/**
 * The student's own view of the record's row. Only a row the caller wrote is shown; another account's draft is
 * nothing (it is replaced on the first write), another account's handed-in project is only `otherAuthor: true`.
 * Nothing of a row the caller did not write — note, photos, times — is in the answer, and no URL is signed for it.
 */
export async function viewOwnSubmission(
  row: HomeworkSubmission | null,
  t: SubmissionTarget,
  now: Date = new Date(),
): Promise<SubmissionView> {
  if (row && row.authorUserId !== t.userId) return { ...NOTHING, otherAuthor: row.submittedAt !== null };
  return viewSubmission(row, t.dueAt, now);
}

const isOwn = (row: HomeworkSubmission, t: SubmissionTarget) => row.authorUserId === t.userId;

/**
 * Takes over another account's (or an authorless) DRAFT on the target's record: drops its photos and note and
 * makes the caller its author, then deletes the dropped objects (best effort, logged; a leftover is unreferenced
 * and the sweep's). Answers `other_author` if the row turns out to be handed in (or the caller's link to the record
 * went in the meantime: the write is refused either way), `ok` otherwise — including when there is nothing to take
 * over (no row, or already the caller's).
 *
 * On `systemDb` in one transaction holding the row lock, because changing a row's author is exactly what the
 * row-level-security policies refuse the app role (migration 0022): a student may write only a row they wrote.
 * The lock makes a concurrent takeover by the same caller see the first one's result and do nothing, and a
 * concurrent write by the previous author (whose UPDATE carries `author_user_id = previous`) match no row.
 * Because the owner connection bypasses the policies, the transaction re-checks the caller's `self` link to the
 * record itself; `submissionTarget` checked it too, but not inside this transaction.
 */
async function takeOver(t: SubmissionTarget, now: Date): Promise<"ok" | OtherAuthor> {
  const dropped = await systemDb.transaction(async tx => {
    const [link] = await tx
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .where(and(eq(rosterLinks.studentId, t.studentId), eq(rosterLinks.userId, t.userId), eq(rosterLinks.relation, "self")))
      .limit(1);
    if (!link) return null;
    const [row] = await tx
      .select({ id: homeworkSubmissions.id, authorUserId: homeworkSubmissions.authorUserId, submittedAt: homeworkSubmissions.submittedAt, photos: homeworkSubmissions.photos })
      .from(homeworkSubmissions)
      .where(and(eq(homeworkSubmissions.homeworkId, t.homeworkId), eq(homeworkSubmissions.studentId, t.studentId)))
      .for("update");
    if (!row || row.authorUserId === t.userId) return [];
    if (row.submittedAt) return null;
    await tx
      .update(homeworkSubmissions)
      .set({ authorUserId: t.userId, photos: [], note: "", updatedAt: now })
      .where(eq(homeworkSubmissions.id, row.id));
    return row.photos;
  });
  if (dropped === null) return "other_author";
  for (const p of dropped) {
    await deleteObject(p.key).catch(err =>
      logger.error({ err, key: p.key, homeworkId: t.homeworkId }, "homework submission takeover: could not delete a previous author's photo"),
    );
  }
  return "ok";
}

/**
 * Makes sure the record holds a row the caller wrote, for a write that adds work (a photo, a note): inserts one
 * with the caller as author, or, when a row is already there and is not the caller's, takes a draft over and
 * answers `other_author` for a handed-in project. The insert conflict is the signal, not the caller's own read:
 * with row-level security on, another account's draft is invisible to the caller (migration 0022).
 */
async function ensureOwnRow(t: SubmissionTarget, now: Date): Promise<"ok" | OtherAuthor> {
  const inserted = await db
    .insert(homeworkSubmissions)
    .values({ homeworkId: t.homeworkId, studentId: t.studentId, authorUserId: t.userId })
    .onConflictDoNothing()
    .returning({ id: homeworkSubmissions.id });
  if (inserted.length > 0) return "ok";
  const row = await readOwnSubmission(t);
  if (row && isOwn(row, t)) return "ok";
  if (row?.submittedAt) return "other_author";
  return takeOver(t, now);
}

/** The caller's read, split by author: their own row (or none), or another account's (`submitted` says which kind). */
async function readAsAuthor(t: SubmissionTarget): Promise<{ own: HomeworkSubmission | null } | { otherSubmitted: boolean }> {
  const row = await readOwnSubmission(t);
  if (row && !isOwn(row, t)) return { otherSubmitted: row.submittedAt !== null };
  return { own: row };
}

/**
 * SQL form of `canSubmit` for an UPDATE's WHERE: the row holds a photo, or a note with some
 * non-space character (what `trim() !== ""` means in JS; stored notes are already trimmed).
 * `photosAfter` / `noteAfter` describe the row as the statement would leave it.
 */
function holdsWork(photosAfter: SQL, noteAfter: SQL | string): SQL {
  return sql`(${photosAfter} > 0 OR ${noteAfter}::text ~ '\\S')`;
}

const photoCount = sql`jsonb_array_length(${homeworkSubmissions.photos})`;

/** The WHERE every write shares: the target's row, and only while the caller is its author. */
const ownRowWhere = (t: SubmissionTarget) =>
  and(
    eq(homeworkSubmissions.homeworkId, t.homeworkId),
    eq(homeworkSubmissions.studentId, t.studentId),
    eq(homeworkSubmissions.authorUserId, t.userId),
  );

/** After a guarded UPDATE matched nothing: `other_author` if the row is (now) another account's, else the caller's row. */
async function afterMiss(t: SubmissionTarget): Promise<{ own: HomeworkSubmission | null } | OtherAuthor> {
  const read = await readAsAuthor(t);
  return "own" in read ? read : "other_author";
}

/**
 * The row a write had just made sure of is gone: the teacher cleared the project (`clearForTeacher`) between the
 * write's checks and its UPDATE. Nothing was written; sent again, the write starts a fresh project.
 */
export type Changed = "changed";

export async function addPhoto(
  t: SubmissionTarget,
  photo: SubmissionPhoto,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "photo_limit" | Changed | OtherAuthor> {
  const read = await readAsAuthor(t);
  if ("otherSubmitted" in read && read.otherSubmitted) return "other_author";
  const existing = "own" in read ? read.own : null;
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  const ensured = await ensureOwnRow(t, now);
  if (ensured !== "ok") return ensured;
  const updated = await db
    .update(homeworkSubmissions)
    .set({ photos: sql`${homeworkSubmissions.photos} || ${JSON.stringify([photo])}::jsonb`, updatedAt: now })
    .where(and(ownRowWhere(t), sql`jsonb_array_length(${homeworkSubmissions.photos}) < ${PHOTOS_MAX}`))
    .returning({ id: homeworkSubmissions.id });
  if (updated.length > 0) return "ok";
  const miss = await afterMiss(t);
  if (miss === "other_author") return miss;
  return miss.own ? "photo_limit" : "changed";
}

export async function removePhoto(
  t: SubmissionTarget,
  photoId: string,
  now: Date = new Date(),
): Promise<{ key: string } | "locked" | "empty" | "not_found" | OtherAuthor> {
  const read = await readAsAuthor(t);
  // Another account's handed-in project is refused as such; nothing of another account's draft is the caller's to
  // remove (they were never shown its photos), and a remove adds no work, so it takes nothing over.
  if ("otherSubmitted" in read) return read.otherSubmitted ? "other_author" : "not_found";
  const row = read.own;
  const photo = row?.photos.find(p => p.id === photoId);
  if (!row || !photo) return "not_found";
  if (isLocked({ submittedAt: row.submittedAt, dueAt: t.dueAt, now })) return "locked";
  // A handed-in project may not be emptied by removing its last photo: it would stay "submitted" with nothing in it.
  if (row.submittedAt && !canSubmit({ photoCount: row.photos.length - 1, note: row.note })) return "empty";
  const updated = await db
    .update(homeworkSubmissions)
    .set({
      photos: sql`coalesce((SELECT jsonb_agg(p) FROM jsonb_array_elements(${homeworkSubmissions.photos}) p WHERE p->>'id' <> ${photoId}), '[]'::jsonb)`,
      updatedAt: now,
    })
    .where(
      and(
        eq(homeworkSubmissions.id, row.id),
        eq(homeworkSubmissions.authorUserId, t.userId),
        // The photo must still be there, or a second tap on the same delete would answer "ok" twice.
        sql`${homeworkSubmissions.photos} @> ${JSON.stringify([{ id: photoId }])}::jsonb`,
        // A draft may lose its last photo; a handed-in project must keep something (re-checked at write time).
        sql`(${homeworkSubmissions.submittedAt} IS NULL OR ${holdsWork(sql`${photoCount} - 1`, sql`${homeworkSubmissions.note}`)})`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  if (updated.length > 0) return { key: photo.key };
  // Nothing was written: a concurrent request changed the row after our read. Say which way.
  const after = await readAsAuthor(t);
  // Taken over by another account since: a draft (the photo is gone from the caller's view) or a handed-in project.
  if ("otherSubmitted" in after) return after.otherSubmitted ? "other_author" : "not_found";
  const current = after.own;
  if (!current || !current.photos.some(p => p.id === photoId)) return "not_found";
  return "empty";
}

export async function setNote(
  t: SubmissionTarget,
  note: string,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "empty" | Changed | OtherAuthor> {
  const read = await readAsAuthor(t);
  if ("otherSubmitted" in read && read.otherSubmitted) return "other_author";
  const existing = "own" in read ? read.own : null;
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (existing?.submittedAt && !canSubmit({ photoCount: existing.photos.length, note })) return "empty";
  const ensured = await ensureOwnRow(t, now);
  if (ensured !== "ok") return ensured;
  const updated = await db
    .update(homeworkSubmissions)
    .set({ note, updatedAt: now })
    .where(
      and(
        ownRowWhere(t),
        // A handed-in project must keep a photo or the new note (re-checked at write time).
        sql`(${homeworkSubmissions.submittedAt} IS NULL OR ${holdsWork(photoCount, note)})`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  if (updated.length > 0) return "ok";
  // The caller's row exists (ensureOwnRow), so no row back means the WHERE refused it: the handed-in guard above, or
  // another account took the row over since. (The lock is not in the WHERE and CAN move between our read and this
  // UPDATE — the author's own concurrent hand-in after the due day — in which case this edit lands on a row that has
  // just become locked, by milliseconds, the author's own.) No row at all: it was removed since (`changed`).
  const miss = await afterMiss(t);
  if (miss === "other_author") return miss;
  return miss.own ? "empty" : "changed";
}

/**
 * Hands the project in. `submitted_at` keeps the FIRST hand-in time (`coalesce`), so replacing a
 * project before the due day never makes it late. The tick is written before this returns — the
 * route answers afterwards (Cloud Run throttles work after `res.json`).
 *
 * The UPDATE and the tick are one transaction, so the row lock the UPDATE takes is held until the tick is written:
 * a teacher's clear (`clearForTeacher`, which locks the row before it removes the tick) either runs first, and the
 * UPDATE then matches nothing (`changed`), or waits and removes the tick with the row. Two statements would leave a
 * tick with no project when a clear landed between them. Under row-level security this is the caller's own scoped
 * transaction (`db.transaction`), and both statements are ones the student's identity may run.
 */
export async function submit(t: SubmissionTarget, now: Date = new Date()): Promise<"ok" | "empty" | "locked" | Changed | OtherAuthor> {
  const read = await readAsAuthor(t);
  // Another account's draft is nothing the caller wrote: there is nothing of theirs to hand in (and a hand-in adds no
  // work, so it takes nothing over).
  if ("otherSubmitted" in read) return read.otherSubmitted ? "other_author" : "empty";
  const row = read.own;
  if (row && isLocked({ submittedAt: row.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (!row || !canSubmit({ photoCount: row.photos.length, note: row.note })) return "empty";
  const stamped = await db.transaction(async tx => {
    const updated = await tx
      .update(homeworkSubmissions)
      .set({ submittedAt: sql`coalesce(${homeworkSubmissions.submittedAt}, now())`, updatedAt: now })
      // Re-checked at write time: a photo removed since our read leaves the draft empty, and an empty one is never stamped.
      .where(
        and(
          eq(homeworkSubmissions.id, row.id),
          eq(homeworkSubmissions.authorUserId, t.userId),
          holdsWork(photoCount, sql`${homeworkSubmissions.note}`),
        ),
      )
      .returning({ id: homeworkSubmissions.id });
    if (updated.length === 0) return false;
    await tickRows(t.homeworkId, t.rows, tx);
    return true;
  });
  if (!stamped) {
    // Nothing was written: another account owns the row now, it was emptied since our read, or it is gone (`changed`).
    const miss = await afterMiss(t);
    if (miss === "other_author") return miss;
    return miss.own ? "empty" : "changed";
  }
  return "ok";
}

export interface TeacherSubmissionRow {
  studentId: string;
  displayName: string;
  /** A draft is `none`: the teacher never sees an unfinished upload. */
  status: SubmissionStatus;
  submittedAt: string | null;
  photoCount: number;
}

interface TeacherHomeworkRef {
  id: string;
  classGroupId: string;
  dueAt: Date;
}

/**
 * Every live roster row in the homework's class, with the state of its handed-in project. Only a
 * handed-in row is joined: row-level security would hide a draft from the teacher anyway, and the
 * explicit filter keeps this correct if it ever ran on a connection that does not enforce it.
 */
export async function listForTeacher(hw: TeacherHomeworkRef): Promise<TeacherSubmissionRow[]> {
  const rows = await db
    .select({
      studentId: students.id,
      displayName: students.displayName,
      submittedAt: homeworkSubmissions.submittedAt,
      photos: homeworkSubmissions.photos,
    })
    .from(classMemberships)
    .innerJoin(students, eq(students.id, classMemberships.studentId))
    .leftJoin(
      homeworkSubmissions,
      and(
        eq(homeworkSubmissions.studentId, students.id),
        eq(homeworkSubmissions.homeworkId, hw.id),
        isNotNull(homeworkSubmissions.submittedAt),
      ),
    )
    .where(and(eq(classMemberships.classGroupId, hw.classGroupId), isNull(students.archivedAt)))
    .orderBy(asc(students.displayName));
  return rows.map(r => ({
    studentId: r.studentId,
    displayName: r.displayName,
    status: submissionStatus({ submittedAt: r.submittedAt, dueAt: hw.dueAt }),
    submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
    photoCount: r.photos?.length ?? 0,
  }));
}

/** One live class member's handed-in project, or null for a draft, a missing one, or a student outside the class. */
export async function readForTeacher(
  hw: TeacherHomeworkRef,
  studentId: string,
): Promise<{ displayName: string; submission: SubmissionView } | null> {
  const [row] = await db
    .select({ submission: homeworkSubmissions, displayName: students.displayName })
    .from(homeworkSubmissions)
    .innerJoin(students, eq(students.id, homeworkSubmissions.studentId))
    .innerJoin(
      classMemberships,
      and(eq(classMemberships.studentId, students.id), eq(classMemberships.classGroupId, hw.classGroupId)),
    )
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, hw.id),
        eq(homeworkSubmissions.studentId, studentId),
        isNotNull(homeworkSubmissions.submittedAt),
        isNull(students.archivedAt),
      ),
    )
    .limit(1);
  if (!row) return null;
  return { displayName: row.displayName, submission: await viewSubmission(row.submission, hw.dueAt) };
}

/**
 * The one record's row a teacher may clear, read on `systemDb` (or inside its transaction): the homework's, the
 * record's, and only while the record is a live member of the homework's class, as for `readForTeacher`.
 */
function clearableRow(executor: Pick<typeof systemDb, "select">, hw: TeacherHomeworkRef, studentId: string) {
  return executor
    .select({ id: homeworkSubmissions.id, photos: homeworkSubmissions.photos })
    .from(homeworkSubmissions)
    .innerJoin(students, eq(students.id, homeworkSubmissions.studentId))
    .innerJoin(
      classMemberships,
      and(eq(classMemberships.studentId, students.id), eq(classMemberships.classGroupId, hw.classGroupId)),
    )
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, hw.id),
        eq(homeworkSubmissions.studentId, studentId),
        isNull(students.archivedAt),
      ),
    );
}

/**
 * The teacher clears ONE roster record's project for one homework, draft or handed-in: its photos, its row, and that
 * record's tick for that homework (a hand-in ticked it; left alone, the family list would still say done). `null`
 * (nothing to clear) is the one answer for a record that is not a live member of the class, for no row, and for a
 * second call — the clear is idempotent in effect, and the repeat is a 404, not a 200.
 *
 * No database lock or transaction is held while R2 is called (an R2 brownout must not queue every request on the row
 * behind a lock, each holding a pool connection). In three steps:
 *   1. Read the row's photos WITHOUT a lock and delete those objects, concurrently. If any delete fails, throw (the
 *      route answers 500) with the DATABASE UNTOUCHED: the row, its photo list and the tick are kept, and the same
 *      request can be sent again — deleting a key that is already gone succeeds. Photos deleted before the failure
 *      stay deleted, so until the retry the row can list a photo whose URL no longer loads.
 *   2. A short transaction: lock the row, delete the record's tick for this homework and the row, and keep the row's
 *      photo list as it was under the lock. A row that is gone by then (cleared or archived meanwhile) is `null`.
 *   3. After the commit, delete any photo in that list that was not in step 1's read (an upload that landed between
 *      the read and the lock). Best effort, logged with the key: the row is gone, so a leftover is unreferenced and
 *      the orphan sweep's (lib/homeworkSubmissionSweep.ts).
 * A student write that reaches the row after the commit matches nothing and answers `changed` (its object is removed
 * by the route). The R2 client's own bounds (lib/r2.ts) keep step 1 from waiting for ever.
 *
 * On `systemDb`: a draft is invisible to the teacher's identity under row-level security, the table has no DELETE
 * policy for the app role, `SELECT … FOR UPDATE` needs an UPDATE policy the teacher does not have, and a completion
 * belongs to the student's rows. The caller (the route) has already proved the homework is this teacher's
 * (`ownedHomework`); the class check is in both reads here.
 */
export async function clearForTeacher(hw: TeacherHomeworkRef, studentId: string): Promise<{ photoCount: number } | null> {
  const [seen] = await clearableRow(systemDb, hw, studentId).limit(1);
  if (!seen) return null;
  const firstKeys = new Set(seen.photos.map(p => p.key));
  const results = await Promise.allSettled([...firstKeys].map(key => deleteObject(key)));
  const failed = [...firstKeys].filter((_, i) => results[i]!.status === "rejected");
  if (failed.length > 0) {
    logger.error(
      { homeworkId: hw.id, studentId, keys: failed, err: (results.find(r => r.status === "rejected") as PromiseRejectedResult).reason },
      "homework submission clear: could not delete a photo; nothing in the database was changed",
    );
    throw new Error(`homework submission clear: ${failed.length} photo(s) could not be deleted`);
  }

  const locked = await systemDb.transaction(async tx => {
    const [row] = await clearableRow(tx, hw, studentId).for("update", { of: homeworkSubmissions }).limit(1);
    if (!row) return null;
    await tx
      .delete(homeworkCompletions)
      .where(and(eq(homeworkCompletions.homeworkId, hw.id), eq(homeworkCompletions.studentId, studentId)));
    await tx.delete(homeworkSubmissions).where(eq(homeworkSubmissions.id, row.id));
    return row.photos;
  });
  if (!locked) return null;

  const late = locked.filter(p => !firstKeys.has(p.key));
  for (const p of late) {
    await deleteObject(p.key).catch(err =>
      logger.error({ err, key: p.key, homeworkId: hw.id, studentId }, "homework submission clear: could not delete a photo uploaded during the clear"),
    );
  }
  return { photoCount: firstKeys.size + late.length };
}

/**
 * The handed-in projects of the guardian's own children for one homework, one entry per child.
 * The homework must ask for a project and be live, in a live class that one of the children is in.
 * `null` is the one answer for every other case. A draft is never read: the filter is explicit
 * (not left to row-level security), and only the guardian's own children's roster rows are asked for.
 */
export async function readForParent(
  userId: string,
  homeworkId: string,
): Promise<Array<{ key: string; displayName: string; submission: SubmissionView }> | null> {
  const [hw] = await db
    .select({ classGroupId: homework.classGroupId, dueAt: homework.dueAt, requiresSubmission: homework.requiresSubmission })
    .from(homework)
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(and(eq(homework.id, homeworkId), isNull(homework.archivedAt), isNull(classGroups.archivedAt)))
    .limit(1);
  if (!hw || !hw.requiresSubmission) return null;

  const children = groupChildren(await guardianLinkedStudents(userId));
  const allRows = children.flatMap(c => c.studentIds);
  if (allRows.length === 0) return null;
  const inClass = await db
    .select({ studentId: classMemberships.studentId })
    .from(classMemberships)
    .where(and(eq(classMemberships.classGroupId, hw.classGroupId), inArray(classMemberships.studentId, allRows)));
  const classRows = new Set(inClass.map(m => m.studentId));
  const mine = children.filter(c => c.studentIds.some(id => classRows.has(id)));
  if (mine.length === 0) return null;

  const subs = await db
    .select()
    .from(homeworkSubmissions)
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, homeworkId),
        inArray(homeworkSubmissions.studentId, [...classRows]),
        isNotNull(homeworkSubmissions.submittedAt),
      ),
    );
  return Promise.all(
    mine.map(async c => ({
      key: c.key,
      displayName: c.displayName,
      submission: await viewSubmission(subs.find(s => c.studentIds.includes(s.studentId)) ?? null, hw.dueAt),
    })),
  );
}

/**
 * The object key of every photo on every homework a teacher owns, drafts included. Read BEFORE the account
 * delete: the rows cascade with the account, and without their keys the objects in the bucket are unreachable.
 * `systemDb` on purpose, for the same reason as the purge below: the teacher's own connection cannot see a
 * student's draft. The caller (account deletion) has already authenticated the account being deleted.
 */
export async function submissionKeysForTeacher(teacherId: string): Promise<string[]> {
  const rows = await systemDb
    .select({ photos: homeworkSubmissions.photos })
    .from(homeworkSubmissions)
    .innerJoin(homework, eq(homework.id, homeworkSubmissions.homeworkId))
    .where(eq(homework.teacherId, teacherId));
  return rows.flatMap(r => r.photos.map(p => p.key));
}

/**
 * Deletes the submissions an account that is being deleted WROTE (`author_user_id`), drafts and handed-in work
 * alike, on every record — including one the teacher has since unlinked it from — and returns their photos'
 * object keys for the caller to delete AFTER the account row is gone (best effort, as for the teacher's).
 *
 * A submission references a roster row, which stays with the teacher, and its author column is `set null`, so
 * without this the rows and their photos would outlive the account that wrote them. Keyed on the author, not on
 * the account's links: work another account wrote on a record this account is linked to now is that other
 * account's and stays, and a parent (who never writes) deletes nothing of their child's. A teacher writes none
 * either; their homework's photos are `submissionKeysForTeacher`'s job. Archived roster rows are included.
 *
 * `systemDb` on purpose: `homework_submissions` has no DELETE policy for the app role. The caller (account
 * deletion) has already re-authenticated the account. Rows are deleted BEFORE the account so a failure here
 * answers 500 with the account intact and the request can be sent again.
 *
 * Returns the records for the caller's second pass (`rows`: those the account is self-linked to, and those it
 * wrote on) and the object keys of the photos it removed (`keys`).
 */
export async function purgeSubmissionsOfAuthor(userId: string): Promise<{ rows: string[]; keys: string[] }> {
  const linked = await systemDb
    .select({ studentId: rosterLinks.studentId })
    .from(rosterLinks)
    .where(and(eq(rosterLinks.userId, userId), eq(rosterLinks.relation, "self")));
  const deleted = await systemDb
    .delete(homeworkSubmissions)
    .where(eq(homeworkSubmissions.authorUserId, userId))
    .returning({ studentId: homeworkSubmissions.studentId, photos: homeworkSubmissions.photos });
  const rows = [...new Set([...linked.map(r => r.studentId), ...deleted.map(r => r.studentId)])];
  return { rows, keys: deleted.flatMap(r => r.photos.map(p => p.key)) };
}

/**
 * Account deletion's second pass, after the account row is gone: deletes the DRAFTS with no author on these
 * records (on `systemDb`, as above) and returns their photos' keys. An upload already past `submissionTarget`
 * when the first pass ran can still have written a draft between that pass and the account delete; the delete
 * then set its author to NULL (`set null`), so the author can no longer find it. An authorless draft is nobody's
 * — it is shown to no one and the next account to write on the record replaces it — so removing every one on
 * the records the account wrote on or was linked to loses nothing anyone can see. A handed-in project with no
 * author is kept: the teacher and the parents read it. (An upload landing after the account delete cannot write
 * at all: its author would reference a user that no longer exists.)
 */
export async function purgeAuthorlessDraftsOfRows(rows: readonly string[]): Promise<string[]> {
  if (rows.length === 0) return [];
  const deleted = await systemDb
    .delete(homeworkSubmissions)
    .where(
      and(
        inArray(homeworkSubmissions.studentId, [...rows]),
        isNull(homeworkSubmissions.authorUserId),
        isNull(homeworkSubmissions.submittedAt),
      ),
    )
    .returning({ photos: homeworkSubmissions.photos });
  return deleted.flatMap(r => r.photos.map(p => p.key));
}

/**
 * Removes every photo and every row of a homework that has been archived. `systemDb` on purpose:
 * the teacher's own connection cannot see a student's DRAFT (row-level security), and a draft's
 * photos are in the bucket all the same, so purging on the teacher's identity would leave them
 * behind. The caller (DELETE /homework/:id) has already proved the homework is the teacher's.
 * Objects are deleted concurrently. A failed object delete is logged with its key, not fatal: the
 * rows (and so the keys) are deleted either way, and the object is unreachable from then on.
 * When R2 is not configured `deleteObject` is a silent no-op; no photo can exist then (an upload
 * needs R2), so there is nothing to leave behind. `objects` counts attempted deletes, not
 * confirmed ones.
 */
export async function purgeSubmissions(homeworkId: string): Promise<{ rows: number; objects: number }> {
  const rows = await systemDb
    .select({ photos: homeworkSubmissions.photos })
    .from(homeworkSubmissions)
    .where(eq(homeworkSubmissions.homeworkId, homeworkId));
  const photos = rows.flatMap(r => r.photos);
  const results = await Promise.allSettled(photos.map(p => deleteObject(p.key)));
  results.forEach((r, i) => {
    if (r.status === "rejected") {
      logger.error(
        { err: r.reason, homeworkId, key: photos[i]!.key },
        "homework submission purge: could not delete an object",
      );
    }
  });
  await systemDb.delete(homeworkSubmissions).where(eq(homeworkSubmissions.homeworkId, homeworkId));
  return { rows: rows.length, objects: photos.length };
}
