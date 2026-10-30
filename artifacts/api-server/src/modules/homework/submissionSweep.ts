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
 *  - a future `lastModified` (clock skew) counts as young.
 * No imports of `@workspace/*`: `node --test` loads this file directly.
 */

export const SUBMISSION_PREFIX = "homework-submissions/";
/** An object younger than this is never deleted. */
export const GRACE_MS = 24 * 60 * 60 * 1000;
/** The most objects one run deletes; the rest are picked up by the next run. */
export const MAX_DELETES = 1000;

const HEX_UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SUBMISSION_KEY = new RegExp(`^homework-submissions/${HEX_UUID}/${HEX_UUID}/${HEX_UUID}\\.(?:jpg|png|webp)$`, "i");

/**
 * `homework-submissions/<homeworkId>/<studentId>/<uuid>.(jpg|png|webp)` — the shape
 * `newHomeworkSubmissionKey` writes. Nothing else is ever deleted by the sweep. The extension is
 * lower-case only; the hex is matched in either case. The whole key must match.
 */
export function isSubmissionKey(key: string): boolean {
  // `i` would also fold the extension, so it is checked on its own.
  return SUBMISSION_KEY.test(key) && /\.(?:jpg|png|webp)$/.test(key);
}

export interface SweepObject {
  key: string;
  lastModified: Date;
}

export interface SweepPlan {
  /** Objects to delete, oldest first, at most `maxDeletes`. */
  toDelete: SweepObject[];
  /** Unreferenced objects the cap kept out of `toDelete` (they are picked up next run). */
  capped: number;
  /** Unreferenced and conforming but younger than the grace period (an upload in flight). */
  skippedYoung: number;
  /** Under the prefix but not a conforming key — never touched, only counted. */
  skippedBadKey: number;
  /** Conforming objects a row refers to. */
  referenced: number;
}

export function planSweep(input: {
  objects: readonly SweepObject[];
  referencedKeys: ReadonlySet<string>;
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
  let referenced = 0;
  for (const o of input.objects) {
    if (!isSubmissionKey(o.key)) {
      skippedBadKey++;
      continue;
    }
    if (input.referencedKeys.has(o.key)) {
      referenced++;
      continue;
    }
    // A negative age (an object dated in the future) fails this and counts as young.
    if (nowMs - o.lastModified.getTime() >= graceMs) old.push(o);
    else skippedYoung++;
  }
  old.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime() || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const cap = Math.max(0, maxDeletes);
  return {
    toDelete: old.slice(0, cap),
    capped: Math.max(0, old.length - cap),
    skippedYoung,
    skippedBadKey,
    referenced,
  };
}
