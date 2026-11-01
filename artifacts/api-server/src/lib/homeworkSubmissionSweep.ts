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
 * class (case 1). Phase 2 lists the bucket under `homework-submissions/` and deletes the objects
 * no row refers to (cases 2 and 3), through the pure classifier in modules/homework/submissionSweep.ts.
 *
 * Deletion is irreversible, so the design only ever errs toward keeping: a grace period for phase 2
 * (an upload stores the object a moment before it records the row), a strict key shape, a cap per
 * run, a dry run, and two guards against a database and a bucket that do not belong together (a
 * local `.env` with the production R2 credentials, a staging service): an object is deleted only if
 * THIS database has its homework, and a run that would delete most of what it can attribute is
 * refused (modules/homework/submissionSweep.ts). Phase 1 ignores age: an archived homework's photos
 * go at once, however new.
 *
 * Work finishes before the route answers: Cloud Run throttles CPU once a response is sent.
 */
// systemDb: the sweep is called by Cloud Scheduler with no user, and reads every submission row
// (drafts included, which no teacher's identity can see) and every archived homework and class.
// Under RLS_ENFORCE the app `db` with no user would read NO submission rows, and every photo would
// look unreferenced — so this file must never import it.
import { classGroups, homework, homeworkSubmissions, systemDb as db } from "@workspace/db";
import { eq, or, inArray, isNotNull, sql } from "drizzle-orm";
import { logger } from "./logger";
import { deleteObject, isR2Configured, listObjects } from "./r2.ts";
import { purgeSubmissions } from "./homeworkSubmission.ts";
import { SUBMISSION_PREFIX, homeworkIdOf, isSubmissionKey, planSweep } from "../modules/homework/submissionSweep.ts";

export interface SweepRun {
  dryRun: boolean;
  /** Archived homework (or homework in an archived class) that still had rows, handled in phase 1. */
  archivedHomework: number;
  /** Archived homework whose purge threw and was left for the next run (also logged at error level). */
  purgeFailed: number;
  /** Rows removed in phase 1 (that would be, in a dry run). */
  rowsPurged: number;
  /** Objects `listObjects` returned under the prefix. */
  objectsListed: number;
  /** Conforming objects a row refers to. */
  referenced: number;
  /**
   * Old, unreferenced, conforming objects under a known homework, counted before the cap. When the run
   * was not refused (and is not a dry run), `orphanObjects − capped − deleted` is the deletes that
   * failed; a refused run deletes none of them, so the difference means nothing then.
   */
  orphanObjects: number;
  /** Objects actually deleted in phase 2 (0 in a dry run, and 0 when refused). */
  deleted: number;
  skippedYoung: number;
  skippedBadKey: number;
  /** Old, unreferenced, conforming objects whose homework this database does not have: kept, never deleted. */
  skippedUnknownHomework: number;
  capped: number;
  /** The ratio guard refused phase 2: nothing was deleted (phase 1 had already run). Logged at error level. */
  refused: boolean;
  refusedReason?: string;
  /** The listing hit its ceiling: the run only swept what it saw. */
  listTruncated: boolean;
  /** R2 is not configured on this server, so phase 2 did not run. */
  objectsSkipped: boolean;
  /** Up to 20 keys of what was (or, in a dry run, would be) deleted. A refused dry run lists what it refused to delete; a refused real run, nothing. */
  sample: string[];
}

/**
 * The most objects one run lists. S3 lists in key order, so a run that stops at a ceiling sees the
 * SAME first slice every time: those are mostly live, referenced photos, which only accumulate, so
 * once the bucket outgrows the ceiling an orphan sorting after the cut-off is never seen, and never
 * deleted (a photo left behind by a failed purge would stay for good). A key is ~120 bytes, so this
 * is tens of MB in memory and about 200 list requests in the worst case, once a week. Past it the
 * same slice is seen every run, which is why a truncated listing is logged at warn level.
 */
export const LIST_CAP = 200_000;
const SAMPLE_MAX = 20;
const DELETE_BATCH = 10;
/** Homework ids per lookup query (a parameterised `inArray`, so this many bind parameters at most). */
const HOMEWORK_LOOKUP_CHUNK = 1000;

/** Every photo key a row names. Tolerant of a malformed list: whatever string key is there is kept protected. */
function photoKeys(rowId: string, photos: unknown): string[] {
  if (!Array.isArray(photos)) {
    // Nothing in it can protect an object, so say so: a row whose photos then get swept must not be silent.
    logger.warn({ rowId }, "homework submission sweep: a submission's photos is not a list");
    return [];
  }
  const keys: string[] = [];
  for (const p of photos) {
    const key = (p as { key?: unknown } | null)?.key;
    if (typeof key === "string") keys.push(key);
  }
  return keys;
}

/** Phase 1: rows (and photos) of homework that is archived, or sits in an archived class. */
async function purgeArchived(dryRun: boolean): Promise<{ archivedHomework: number; purgeFailed: number; rowsPurged: number }> {
  const targets = await db
    .select({ homeworkId: homeworkSubmissions.homeworkId, rows: sql<number>`count(*)::int` })
    .from(homeworkSubmissions)
    .innerJoin(homework, eq(homework.id, homeworkSubmissions.homeworkId))
    .innerJoin(classGroups, eq(classGroups.id, homework.classGroupId))
    .where(or(isNotNull(homework.archivedAt), isNotNull(classGroups.archivedAt)))
    .groupBy(homeworkSubmissions.homeworkId);

  let archivedHomework = 0;
  let purgeFailed = 0;
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
      // It is counted in the run report too: the log line the owner watches must not look clean.
      purgeFailed++;
      logger.error({ err, homeworkId: t.homeworkId }, "homework submission sweep: could not purge an archived homework");
    }
  }
  return { archivedHomework, purgeFailed, rowsPurged };
}

/**
 * Which of `ids` this database has a homework row for, archived or not. One query per chunk; a query
 * that throws fails the whole run (the route answers 500) before anything in phase 2 is deleted.
 */
async function existingHomeworkIds(ids: readonly string[]): Promise<Set<string>> {
  const found = new Set<string>();
  for (let i = 0; i < ids.length; i += HOMEWORK_LOOKUP_CHUNK) {
    const chunk = ids.slice(i, i + HOMEWORK_LOOKUP_CHUNK);
    const rows = await db.select({ id: homework.id }).from(homework).where(inArray(homework.id, chunk));
    for (const r of rows) found.add(r.id);
  }
  return found;
}

export async function sweepSubmissionOrphans(
  opts: { now?: Date; dryRun?: boolean; graceMs?: number; maxDeletes?: number } = {},
): Promise<SweepRun> {
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;
  const run: SweepRun = {
    dryRun,
    archivedHomework: 0,
    purgeFailed: 0,
    rowsPurged: 0,
    objectsListed: 0,
    referenced: 0,
    orphanObjects: 0,
    deleted: 0,
    skippedYoung: 0,
    skippedBadKey: 0,
    skippedUnknownHomework: 0,
    capped: 0,
    refused: false,
    listTruncated: false,
    objectsSkipped: false,
    sample: [],
  };

  const purged = await purgeArchived(dryRun);
  run.archivedHomework = purged.archivedHomework;
  run.purgeFailed = purged.purgeFailed;
  run.rowsPurged = purged.rowsPurged;

  if (!isR2Configured()) {
    logger.info("homework submission sweep: R2 is not configured, skipping the object phase");
    run.objectsSkipped = true;
    return run;
  }

  // The bucket is listed first and the referenced keys read second. What protects an upload in flight
  // is the GRACE PERIOD, not this order: an upload whose object lands before the listing and whose row
  // is written after the key read looks unreferenced whichever way round the two steps run, and only
  // its age (well under 24 hours) keeps it. The order merely narrows that window — reading the keys
  // first would add every object stored between the read and the listing to it. `addPhoto` always
  // stores a fresh-UUID key and never attaches an existing one, so a key cannot become referenced
  // after the fact, and no re-check of references before a delete is needed.
  const listing = await listObjects(SUBMISSION_PREFIX, { maxKeys: LIST_CAP });
  if (listing.truncated) {
    logger.warn({ listed: listing.objects.length }, "homework submission sweep: listing was truncated, orphans past the cut-off are not seen");
  }
  const rows = await db.select({ id: homeworkSubmissions.id, photos: homeworkSubmissions.photos }).from(homeworkSubmissions);
  const referencedKeys = new Set<string>();
  for (const r of rows) for (const key of photoKeys(r.id, r.photos)) referencedKeys.add(key);

  // The known-homework guard: an object is deletable only if THIS database has its homework. Every
  // conforming key's homework is looked up, not only the candidates', because the ratio guard counts
  // all objects under known homework. A failed lookup throws: the run fails before any delete.
  const homeworkIds = new Set<string>();
  for (const o of listing.objects) {
    const id = homeworkIdOf(o.key);
    if (id !== null) homeworkIds.add(id);
  }
  const knownHomeworkIds = await existingHomeworkIds([...homeworkIds]);

  const plan = planSweep({
    objects: listing.objects,
    referencedKeys,
    knownHomeworkIds,
    now,
    graceMs: opts.graceMs,
    maxDeletes: opts.maxDeletes,
  });
  run.objectsListed = listing.objects.length;
  run.listTruncated = listing.truncated;
  run.referenced = plan.referenced;
  run.orphanObjects = plan.wouldDelete.length + plan.capped;
  run.skippedYoung = plan.skippedYoung;
  run.skippedBadKey = plan.skippedBadKey;
  run.skippedUnknownHomework = plan.skippedUnknownHomework;
  run.capped = plan.capped;
  run.refused = plan.refused;
  if (plan.refusedReason !== undefined) run.refusedReason = plan.refusedReason;

  if (plan.refused) {
    // There is deliberately no override: a person checks that this service's database and bucket
    // belong together (docs/deploying.md, the submission sweep). A dry run shows what was refused.
    if (dryRun) run.sample = plan.wouldDelete.slice(0, SAMPLE_MAX).map(o => o.key);
    logger.error({ run, known: plan.known }, "homework submission sweep refused");
    return run;
  }

  if (dryRun) {
    run.sample = plan.toDelete.slice(0, SAMPLE_MAX).map(o => o.key);
    return run;
  }

  for (let i = 0; i < plan.toDelete.length; i += DELETE_BATCH) {
    const batch = plan.toDelete.slice(i, i + DELETE_BATCH);
    const results = await Promise.all(
      batch.map(async o => {
        // A key-shape and prefix check only, next to the irreversible call; the classifier already did it.
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
