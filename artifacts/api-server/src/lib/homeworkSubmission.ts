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
 */
import { db, homeworkSubmissions, type HomeworkSubmission, type SubmissionPhoto } from "@workspace/db";
import { and, eq, inArray, sql, type SQL } from "drizzle-orm";
import { presignedGetUrl } from "./r2.ts";
import { ownHomeworkRows, tickRows } from "./homeworkDone.ts";
import {
  PHOTOS_MAX,
  canSubmit,
  isLocked,
  submissionStatus,
  type SubmissionStatus,
} from "../modules/homework/submission.ts";

export interface SubmissionTarget {
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
}

/** Ten minutes: long enough to open a photo, short enough that a copied link dies quickly. */
export const SIGNED_URL_SECONDS = 600;

export async function submissionTarget(userId: string, homeworkId: string): Promise<SubmissionTarget | null> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own || !own.requiresSubmission) return null;
  const [held] = await db
    .select({ studentId: homeworkSubmissions.studentId })
    .from(homeworkSubmissions)
    .where(and(eq(homeworkSubmissions.homeworkId, homeworkId), inArray(homeworkSubmissions.studentId, own.rows)))
    .orderBy(homeworkSubmissions.studentId)
    .limit(1);
  return { homeworkId, studentId: held?.studentId ?? own.rows[0]!, rows: own.rows, dueAt: own.dueAt };
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

/** A row (or none) as a client sees it. The object key is never in it. */
export async function viewSubmission(
  row: HomeworkSubmission | null,
  dueAt: Date,
  now: Date = new Date(),
): Promise<SubmissionView> {
  if (!row) return { status: "none", locked: false, note: "", photos: [], submittedAt: null };
  return {
    status: submissionStatus({ submittedAt: row.submittedAt, dueAt }),
    locked: isLocked({ submittedAt: row.submittedAt, dueAt, now }),
    note: row.note,
    photos: await signPhotos(row.photos),
    submittedAt: row.submittedAt ? row.submittedAt.toISOString() : null,
  };
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

async function ensureRow(t: SubmissionTarget): Promise<void> {
  await db
    .insert(homeworkSubmissions)
    .values({ homeworkId: t.homeworkId, studentId: t.studentId })
    .onConflictDoNothing();
}

export async function addPhoto(
  t: SubmissionTarget,
  photo: SubmissionPhoto,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "photo_limit"> {
  const existing = await readOwnSubmission(t);
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  await ensureRow(t);
  const updated = await db
    .update(homeworkSubmissions)
    .set({ photos: sql`${homeworkSubmissions.photos} || ${JSON.stringify([photo])}::jsonb`, updatedAt: now })
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, t.homeworkId),
        eq(homeworkSubmissions.studentId, t.studentId),
        sql`jsonb_array_length(${homeworkSubmissions.photos}) < ${PHOTOS_MAX}`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  return updated.length > 0 ? "ok" : "photo_limit";
}

export async function removePhoto(
  t: SubmissionTarget,
  photoId: string,
  now: Date = new Date(),
): Promise<{ key: string } | "locked" | "empty" | "not_found"> {
  const row = await readOwnSubmission(t);
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
        // The photo must still be there, or a second tap on the same delete would answer "ok" twice.
        sql`${homeworkSubmissions.photos} @> ${JSON.stringify([{ id: photoId }])}::jsonb`,
        // A draft may lose its last photo; a handed-in project must keep something (re-checked at write time).
        sql`(${homeworkSubmissions.submittedAt} IS NULL OR ${holdsWork(sql`${photoCount} - 1`, sql`${homeworkSubmissions.note}`)})`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  if (updated.length > 0) return { key: photo.key };
  // Nothing was written: a concurrent request changed the row after our read. Say which way.
  const current = await readOwnSubmission(t);
  if (!current || !current.photos.some(p => p.id === photoId)) return "not_found";
  return "empty";
}

export async function setNote(
  t: SubmissionTarget,
  note: string,
  now: Date = new Date(),
): Promise<"ok" | "locked" | "empty"> {
  const existing = await readOwnSubmission(t);
  if (existing && isLocked({ submittedAt: existing.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (existing?.submittedAt && !canSubmit({ photoCount: existing.photos.length, note })) return "empty";
  await ensureRow(t);
  const updated = await db
    .update(homeworkSubmissions)
    .set({ note, updatedAt: now })
    .where(
      and(
        eq(homeworkSubmissions.homeworkId, t.homeworkId),
        eq(homeworkSubmissions.studentId, t.studentId),
        // A handed-in project must keep a photo or the new note (re-checked at write time).
        sql`(${homeworkSubmissions.submittedAt} IS NULL OR ${holdsWork(photoCount, note)})`,
      ),
    )
    .returning({ id: homeworkSubmissions.id });
  // The row exists (ensureRow) and the lock cannot change within a request, so no row means the guard refused.
  return updated.length > 0 ? "ok" : "empty";
}

/**
 * Hands the project in. `submitted_at` keeps the FIRST hand-in time (`coalesce`), so replacing a
 * project before the due day never makes it late. The tick is written before this returns — the
 * route answers afterwards (Cloud Run throttles work after `res.json`).
 */
export async function submit(t: SubmissionTarget, now: Date = new Date()): Promise<"ok" | "empty" | "locked"> {
  const row = await readOwnSubmission(t);
  if (row && isLocked({ submittedAt: row.submittedAt, dueAt: t.dueAt, now })) return "locked";
  if (!row || !canSubmit({ photoCount: row.photos.length, note: row.note })) return "empty";
  const updated = await db
    .update(homeworkSubmissions)
    .set({ submittedAt: sql`coalesce(${homeworkSubmissions.submittedAt}, now())`, updatedAt: now })
    // Re-checked at write time: a photo removed since our read leaves the draft empty, and an empty one is never stamped.
    .where(and(eq(homeworkSubmissions.id, row.id), holdsWork(photoCount, sql`${homeworkSubmissions.note}`)))
    .returning({ id: homeworkSubmissions.id });
  if (updated.length === 0) return "empty";
  await tickRows(t.homeworkId, t.rows);
  return "ok";
}
