/**
 * The decision half of the homework-submission orphan sweep (lib/homeworkSubmissionSweep.ts): given
 * what the bucket holds under `homework-submissions/` and which keys a database row refers to, which
 * objects may be deleted. Pure, so the rules that guard a minor's photos are tested without a bucket.
 *
 * The sweep deletes irreversibly, so every rule here errs toward keeping:
 *  - only a key of exactly the shape this feature writes is ever planned (anything else under the
 *    prefix is counted and left alone — a stray object is for a person to look at);
 *  - an object a row refers to is kept, however old;
 *  - an object younger than the grace period is kept (an upload stores the object a moment before it
 *    records the row, so a young unreferenced object is usually one in flight);
 *  - a future `lastModified` (clock skew) counts as young;
 *  - an object whose homework THIS database does not have is kept (the known-homework guard): a
 *    server pointed at the production bucket with another database — a local `.env` holding the
 *    real R2 credentials, a staging service — sees no rows, so every photo would look unreferenced;
 *  - a run that would delete most of what it can attribute is refused outright (the ratio guard),
 *    because that is what a database and a bucket that do not belong together look like.
 * No imports of `@workspace/*`: `node --test` loads this file directly.
 */

export const SUBMISSION_PREFIX = "homework-submissions/";
/** An unreferenced object younger than this is never deleted by phase 2 (phase 1 ignores age). */
export const GRACE_MS = 24 * 60 * 60 * 1000;
/** The most objects one run deletes; the rest are picked up by the next run. */
export const MAX_DELETES = 1000;
/** The ratio guard never refuses a run with this many orphans or fewer, whatever the ratio. */
export const REFUSE_MIN_ORPHANS = 20;
/** …and above that, refuses one whose orphans are MORE than this share of the known objects. */
export const REFUSE_RATIO = 0.5;

// Lower case only. The photo's own id is a `randomUUID()` and always lower case, but the HOMEWORK
// segment is the raw URL parameter of the upload request (`submissionTarget` passes it through, and
// Postgres compares a uuid case-insensitively), so an upper-case id in the URL stores an upper-case
// key. Such a key is refused here (counted in skippedBadKey) and never swept as an orphan: matching it
// against the homework ids read back from the database (lower case) would need a case fold this
// classifier deliberately does not do. It is still purged with its row by phase 1, which deletes the
// keys a row names, whatever their shape.
const HEX_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SUBMISSION_KEY = new RegExp(`^homework-submissions/(${HEX_UUID})/${HEX_UUID}/${HEX_UUID}\\.(?:jpg|png|webp)$`);

/**
 * `homework-submissions/<homeworkId>/<studentId>/<uuid>.(jpg|png|webp)` — the shape
 * `newHomeworkSubmissionKey` writes. Nothing else is ever deleted as an orphan. All of it must be
 * lower case: prefix, hex and extension (see HEX_UUID for the upper-case keys this leaves alone).
 * The whole key must match.
 */
export function isSubmissionKey(key: string): boolean {
  return SUBMISSION_KEY.test(key);
}

/** The homework id of a conforming key (its first segment after the prefix), or null for any other key. */
export function homeworkIdOf(key: string): string | null {
  return SUBMISSION_KEY.exec(key)?.[1] ?? null;
}

/**
 * The ratio guard. `orphans`: the objects a run would delete (known homework, unreferenced, past the
 * grace period), counted before the per-run cap. `known`: every conforming object under a homework
 * this database has, orphans included. More than REFUSE_MIN_ORPHANS orphans that are also more than
 * REFUSE_RATIO of what is known is refused: a healthy bucket's orphans are a handful against the live
 * photos. Exactly the ratio is allowed.
 */
export function shouldRefuse(orphans: number, known: number): boolean {
  return orphans > REFUSE_MIN_ORPHANS && orphans > REFUSE_RATIO * known;
}

/**
 * The query of POST /internal/homework-submission-sweep, failing SAFE in the one direction that
 * matters: a preview that was meant to be a preview must never turn into a real run.
 *  - no `dryRun` key at all is a real run (that is what Cloud Scheduler sends);
 *  - `dryRun` present with a value of exactly "0" or "false" is a real run;
 *  - `dryRun` present in ANY other form (empty, "1", "true", "TRUE", "yes", repeated, anything)
 *    is a dry run;
 *  - any other key (`dryrun`, `dry-run`, `limit`…) is refused, so a typo of the safety flag cannot
 *    silently become a real run.
 */
export function parseSweepQuery(query: Readonly<Record<string, unknown>>): { ok: true; dryRun: boolean } | { ok: false } {
  for (const key of Object.keys(query)) if (key !== "dryRun") return { ok: false };
  if (!Object.hasOwn(query, "dryRun")) return { ok: true, dryRun: false };
  const value = query.dryRun;
  return { ok: true, dryRun: !(value === "0" || value === "false") };
}

export interface SweepObject {
  key: string;
  lastModified: Date;
}

export interface SweepPlan {
  /** Objects to delete, oldest first, at most `maxDeletes`. Always empty when `refused`. */
  toDelete: SweepObject[];
  /** What would be deleted were the run not refused: `toDelete` itself, or, when refused, the list it was refused over. For a dry run's sample. */
  wouldDelete: SweepObject[];
  /** Deletable objects the cap kept out of `wouldDelete` (they are picked up next run). */
  capped: number;
  /** Unreferenced and conforming but younger than the grace period (an upload in flight). */
  skippedYoung: number;
  /** Under the prefix but not a conforming key — never touched, only counted. */
  skippedBadKey: number;
  /** Old, unreferenced and conforming, but under a homework this database does not have — never touched, only counted. */
  skippedUnknownHomework: number;
  /** Conforming objects a row refers to. */
  referenced: number;
  /** Conforming objects under a homework this database has, whatever their age or reference: the ratio guard's denominator. */
  known: number;
  /** The ratio guard refused the run: nothing is to be deleted. */
  refused: boolean;
  refusedReason?: string;
}

export function planSweep(input: {
  objects: readonly SweepObject[];
  referencedKeys: ReadonlySet<string>;
  /** Ids of the homework rows this database has (archived ones included). Required: there is no "assume known". */
  knownHomeworkIds: ReadonlySet<string>;
  now: Date;
  graceMs?: number;
  maxDeletes?: number;
}): SweepPlan {
  const graceMs = input.graceMs ?? GRACE_MS;
  const maxDeletes = input.maxDeletes ?? MAX_DELETES;
  const nowMs = input.now.getTime();
  const old: SweepObject[] = [];
  let skippedYoung = 0;
  let skippedBadKey = 0;
  let skippedUnknownHomework = 0;
  let referenced = 0;
  let known = 0;
  for (const o of input.objects) {
    const homeworkId = homeworkIdOf(o.key);
    if (homeworkId === null) {
      skippedBadKey++;
      continue;
    }
    const homeworkKnown = input.knownHomeworkIds.has(homeworkId);
    if (homeworkKnown) known++;
    if (input.referencedKeys.has(o.key)) {
      referenced++;
      continue;
    }
    // Written so that anything it cannot compare counts as young: a negative age (an object dated in
    // the future), an invalid date (NaN) and a NaN grace period all fail `age >= graceMs`.
    const age = nowMs - o.lastModified.getTime();
    if (!(age >= graceMs)) {
      skippedYoung++;
      continue;
    }
    if (!homeworkKnown) {
      skippedUnknownHomework++;
      continue;
    }
    old.push(o);
  }
  old.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const cap = Math.max(0, maxDeletes);
  const wouldDelete = old.slice(0, cap);
  // The guard counts every deletable object, before the cap: a cap of 1000 must not hide a run that would empty the bucket.
  const refused = shouldRefuse(old.length, known);
  const plan: SweepPlan = {
    toDelete: refused ? [] : wouldDelete,
    wouldDelete,
    capped: Math.max(0, old.length - cap),
    skippedYoung,
    skippedBadKey,
    skippedUnknownHomework,
    referenced,
    known,
    refused,
  };
  if (refused) {
    plan.refusedReason = `${old.length} of ${known} objects under known homework are unreferenced orphans (over ${REFUSE_MIN_ORPHANS} and over ${REFUSE_RATIO * 100}%): this database and this bucket may not belong together`;
  }
  return plan;
}
