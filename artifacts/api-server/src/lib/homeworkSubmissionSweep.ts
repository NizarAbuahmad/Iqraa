/**
 * The homework-submission orphan sweep, run by Cloud Scheduler through
 * POST /internal/homework-submission-sweep (routes/internal.ts).
 *
 * A student's project photos are a minor's work, and `purgeSubmissions` (lib/homeworkSubmission.ts)
 * removes them when a homework or its class is archived. Three things can still leave data that no
 * screen can reach, and this sweep cleans each up:
 *  1. an upload that races a purge: a row appears AFTER the purge, on an archived homework;
 *  2. an exception after a photo was stored but before it was recorded: an object with no row;
 *  3. a failed object delete: the row is gone, the object stays.
 *
 * Phase 1 purges the rows (and their objects) of archived homework and of homework in an archived
 * class (cases 1). Phase 2 lists the bucket under `homework-submissions/` and deletes the objects
 * no row refers to (cases 2 and 3), through the pure classifier in modules/homework/submissionSweep.ts.
 *
 * Deletion is irreversible, so the design only ever errs toward keeping: a grace period (an upload
 * stores the object a moment before it records the row), a strict key shape, a cap per run, a dry
 * run, and the ORDER in phase 2 — see there.
 *
 * Work finishes before the route answers: Cloud Run throttles CPU once a response is sent.
 */
// systemDb: the sweep is called by Cloud Scheduler with no user, and reads every submission row
// (drafts included, which no teacher's identity can see) and every archived homework and class.
import { classGroups, homework, homeworkSubmissions, systemDb as db } from "@workspace/db";
import { eq, or, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { deleteObject, isR2Configured, listObjects } from "./r2.ts";
import { purgeSubmissions } from "./homeworkSubmission.ts";
import { SUBMISSION_PREFIX, isSubmissionKey, planSweep } from "../modules/homework/submissionSweep.ts";

export interface SweepRun {
  dryRun: boolean;
  /** Archived homework (or homework in an archived class) that still had rows, handled in phase 1. */
  archivedHomework: number;
  /** Rows removed in phase 1 (that would be, in a dry run). */
  rowsPurged: number;
  /** Objects `listObjects` returned under the prefix. */
  objectsListed: number;
  /** Conforming objects a row refers to. */
  referenced: number;
  /** Old, unreferenced, conforming objects: those deleted plus those the cap kept for the next run. */
  orphanObjects: number;
  /** Objects actually deleted in phase 2 (0 in a dry run). */
  deleted: number;
  skippedYoung: number;
  skippedBadKey: number;
  capped: number;
  /** The listing hit its ceiling: the run only swept what it saw. */
  listTruncated: boolean;
  /** R2 is not configured on this server, so phase 2 did not run. */
  objectsSkipped: boolean;
  /** Up to 20 keys of what was (or, in a dry run, would be) deleted. */
  sample: string[];
}

const SAMPLE_MAX = 20;
const DELETE_BATCH = 10;

/** Every photo key a row names. Tolerant of a malformed list: whatever string key is there is kept protected. */
function photoKeys(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  const keys: string[] = [];
  for (const p of photos) {
    const key = (p as { key?: unknown } | null)?.key;
    if (typeof key === "string") keys.push(key);
  }
  return keys;
}

/** Phase 1: rows (and photos) of homework that is archived, or sits in an archived class. */
async function purgeArchived(dryRun: boolean): Promise<{ archivedHomework: number; rowsPurged: number }> {
  const targets = await db
    .select({ homeworkId: homeworkSubmissions.homeworkId, rows: sql<number>`count(*)::int` })
    .from(homeworkSubmissions)
    .innerJoin(homework, eq(homework.id, homeworkSubmissions.homeworkId))
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(or(isNotNull(homework.archivedAt), isNotNull(classGroups.archivedAt)))
    .groupBy(homeworkSubmissions.homeworkId);

  let archivedHomework = 0;
  let rowsPurged = 0;
  for (const t of targets) {
    if (dryRun) {
      archivedHomework++;
      rowsPurged += t.rows;
      continue;
    }
    try {
      const purged = await purgeSubmissions(t.homeworkId);
      archivedHomework++;
      rowsPurged += purged.rows;
      logger.info({ homeworkId: t.homeworkId, rows: purged.rows, objects: purged.objects }, "homework submission sweep: purged an archived homework");
    } catch (err) {
      // One bad row must not stop the rest. Its rows stay, so phase 2 keeps their photos referenced.
      logger.error({ err, homeworkId: t.homeworkId }, "homework submission sweep: could not purge an archived homework");
    }
  }
  return { archivedHomework, rowsPurged };
}

export async function sweepSubmissionOrphans(
  opts: { now?: Date; dryRun?: boolean; graceMs?: number; maxDeletes?: number } = {},
): Promise<SweepRun> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;
  const run: SweepRun = {
    dryRun,
    archivedHomework: 0,
    rowsPurged: 0,
    objectsListed: 0,
    referenced: 0,
    orphanObjects: 0,
    deleted: 0,
    skippedYoung: 0,
    skippedBadKey: 0,
    capped: 0,
    listTruncated: false,
    objectsSkipped: false,
    sample: [],
  };

  const purged = await purgeArchived(dryRun);
  run.archivedHomework = purged.archivedHomework;
  run.rowsPurged = purged.rowsPurged;

  if (!isR2Configured()) {
    logger.info("homework submission sweep: R2 is not configured, skipping the object phase");
    run.objectsSkipped = true;
    return run;
  }

  // ORDER MATTERS: list the bucket FIRST, read the referenced keys SECOND. An upload stores its
  // object and then writes its row, so a row written between the two steps can only protect an
  // object the listing already saw, never hide a reference to one it saw as unreferenced. Reading
  // the references first would let an object listed afterwards, whose row was written after that
  // read, look like an orphan. (The grace period is the second line of defence for the same race.)
  const listing = await listObjects(SUBMISSION_PREFIX);
  const rows = await db.select({ photos: homeworkSubmissions.photos }).from(homeworkSubmissions);
  const referencedKeys = new Set<string>();
  for (const r of rows) for (const key of photoKeys(r.photos)) referencedKeys.add(key);

  const plan = planSweep({ objects: listing.objects, referencedKeys, now, graceMs: opts.graceMs, maxDeletes: opts.maxDeletes });
  run.objectsListed = listing.objects.length;
  run.listTruncated = listing.truncated;
  run.referenced = plan.referenced;
  run.orphanObjects = plan.toDelete.length + plan.capped;
  run.skippedYoung = plan.skippedYoung;
  run.skippedBadKey = plan.skippedBadKey;
  run.capped = plan.capped;

  if (dryRun) {
    run.sample = plan.toDelete.slice(0, SAMPLE_MAX).map(o => o.key);
    return run;
  }

  for (let i = 0; i < plan.toDelete.length; i += DELETE_BATCH) {
    const batch = plan.toDelete.slice(i, i + DELETE_BATCH);
    const results = await Promise.all(
      batch.map(async o => {
        // The classifier already guarantees this; the check sits next to the irreversible call anyway.
        if (!isSubmissionKey(o.key) || !o.key.startsWith(SUBMISSION_PREFIX)) return false;
        try {
          await deleteObject(o.key);
          logger.info(
            { key: o.key, lastModified: o.lastModified.toISOString(), homeworkId: o.key.split("/")[1] },
            "homework submission sweep: deleted an orphan object",
          );
          return true;
        } catch (err) {
          logger.error({ err, key: o.key }, "homework submission sweep: could not delete an orphan object");
          return false;
        }
      }),
    );
    batch.forEach((o, j) => {
      if (!results[j]) return;
      run.deleted++;
      if (run.sample.length < SAMPLE_MAX) run.sample.push(o.key);
    });
  }
  return run;
}
