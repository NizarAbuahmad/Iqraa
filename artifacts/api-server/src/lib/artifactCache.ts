/**
 * The shared variant pool — reads and writes against `ai_artifacts`.
 *
 * Phase 1 of `docs/ai-cost-savings-plan.md`. What it buys, and why the shape:
 *
 * - **A teacher's first request for a standard lesson may cost nothing.** Iqraa
 *   serves a fixed curriculum; the same eighteen math lessons are asked for by
 *   everybody. One paid generation per (lesson × kind × parameters) serves
 *   every teacher after it.
 * - **Regeneration fills the pool rather than draining the budget.** A teacher
 *   who rejects variant 0 pays for variant 1, and the teacher after them is
 *   served it free. See `docs/ai-cost-savings-plan.md` and `aiArtifacts.ts`.
 *
 * Every function here **fails soft**, for the two reasons `aiUsageLog.ts`
 * already documents: the schema is pushed by hand, so this ships before the
 * table exists, and `@workspace/db` throws at module scope without
 * `DATABASE_URL` (hence the lazy imports). A cache that cannot be reached must
 * degrade to "generate every time" — the old behaviour — and never to a
 * teacher losing their worksheet.
 *
 * And, as there: degraded is acceptable, *undetectably* degraded is not.
 * `getCacheFailure()` names the operation that last failed, never the driver's
 * message, and `/healthz/ai-budget` reports it. Without that, a cache that
 * silently never hits looks exactly like a cache that is working on a quiet
 * day, and the bill is the only thing that would ever say otherwise.
 */
import { logger } from "./logger.ts";

export type CacheOperation = "read" | "insert" | "serve-count";

let lastFailure: CacheOperation | null = null;

/** Which cache operation last failed, or null when they have worked (or have
 *  not been tried). Read by `/healthz/ai-budget`. */
export function getCacheFailure(): CacheOperation | null {
  return lastFailure;
}

/** Test seam — the health endpoint's contract is "what failed most recently",
 *  which is only meaningful if a suite can start from a clean slate. */
export function resetCacheFailure(): void {
  lastFailure = null;
}

function note(err: unknown, what: CacheOperation): void {
  lastFailure = what;
  logger.warn(
    { err, what },
    "artifact cache unavailable — generation continues uncached",
  );
}

export type PooledArtifact = {
  id: string;
  variantIndex: number;
  timesServed: number;
  content: unknown;
};

export type Pool = {
  /** Live (non-retired) variants for this key, least-served first. */
  variants: PooledArtifact[];
  /** The slot a new variant would take. Counts retired rows too — the unique
   *  index does not forget them, so reusing a retired slot is a write that
   *  fails for a reason nobody would guess from the error. */
  nextVariantIndex: number;
  /** False when the pool could not be read at all. Distinct from an empty
   *  pool: one means "generate and store", the other means "the cache is
   *  down, generate and do not pretend to store". */
  readable: boolean;
};

const EMPTY_POOL: Pool = { variants: [], nextVariantIndex: 0, readable: false };

/**
 * Every variant held for one key.
 *
 * Deliberately unfiltered by user: the caller decides what to do with them,
 * because "serve one" and "quote the seen ones back to the model as things not
 * to repeat" need the same rows and would otherwise be two round trips.
 */
export async function readPool(strictKey: string): Promise<Pool> {
  try {
    const { db, aiArtifacts } = await import("@workspace/db");
    const { eq, asc } = await import("drizzle-orm");
    const rows = await db
      .select({
        id: aiArtifacts.id,
        variantIndex: aiArtifacts.variantIndex,
        timesServed: aiArtifacts.timesServed,
        content: aiArtifacts.content,
        retiredAt: aiArtifacts.retiredAt,
      })
      .from(aiArtifacts)
      .where(eq(aiArtifacts.strictKey, strictKey))
      .orderBy(asc(aiArtifacts.variantIndex));

    lastFailure = null;
    const nextVariantIndex = rows.reduce((max, r) => Math.max(max, r.variantIndex + 1), 0);
    const variants = rows
      .filter((r) => r.retiredAt === null)
      // Least-served first: round-robin across the pool rather than every
      // teacher receiving whichever variant happened to be written first.
      .sort((a, b) => a.timesServed - b.timesServed || a.variantIndex - b.variantIndex)
      .map(({ id, variantIndex, timesServed, content }) => ({
        id,
        variantIndex,
        timesServed,
        content,
      }));
    return { variants, nextVariantIndex, readable: true };
  } catch (err) {
    note(err, "read");
    return EMPTY_POOL;
  }
}

/**
 * The artifact ids this teacher has already been served for this key.
 *
 * Read from `ai_generations`, not from a table of its own: that row is already
 * written for every request, hit and miss alike, and it carries the userId and
 * the key. A separate serve log would be a second thing to keep in step with
 * the first.
 *
 * Returns an empty set when it cannot be read. That is the safe direction —
 * the teacher may be served something they have seen, which is the behaviour
 * they had before any of this existed, rather than being refused.
 */
export async function readSeenArtifactIds(args: {
  strictKey: string;
  userId: string | null | undefined;
}): Promise<Set<string>> {
  if (!args.userId) return new Set();
  try {
    const { db, aiGenerations } = await import("@workspace/db");
    const { and, eq, isNotNull } = await import("drizzle-orm");
    const rows = await db
      .select({ artifactId: aiGenerations.artifactId })
      .from(aiGenerations)
      .where(
        and(
          eq(aiGenerations.userId, args.userId),
          eq(aiGenerations.strictKey, args.strictKey),
          isNotNull(aiGenerations.artifactId),
        ),
      );
    lastFailure = null;
    return new Set(rows.map((r) => r.artifactId).filter((id): id is string => Boolean(id)));
  } catch (err) {
    note(err, "read");
    return new Set();
  }
}

/**
 * Store a freshly generated artifact as the next variant for its key.
 *
 * Returns the new row's id, or null when it was not stored — the table is
 * unreachable, or another process claimed this slot first. Null is not an
 * error the caller should surface: the teacher has their artifact either way,
 * and all that was lost is the chance to give it to the next teacher for free.
 */
export async function storeVariant(args: {
  strictKey: string;
  coarseKey: string;
  kind: string;
  model: string;
  promptVersion: string;
  language: string;
  lessonRef: string;
  variantIndex: number;
  content: unknown;
}): Promise<string | null> {
  try {
    const { db, aiArtifacts } = await import("@workspace/db");
    const inserted = await db
      .insert(aiArtifacts)
      .values({
        strictKey: args.strictKey,
        coarseKey: args.coarseKey,
        kind: args.kind,
        model: args.model,
        promptVersion: args.promptVersion,
        language: args.language,
        lessonRef: args.lessonRef,
        variantIndex: args.variantIndex,
        content: args.content as Record<string, unknown>,
      })
      // The cross-process race: two instances generate variant 2 for one key
      // at the same moment. One insert wins, the other is a no-op returning
      // nothing, and its caller serves what it generated without storing it.
      .onConflictDoNothing({ target: [aiArtifacts.strictKey, aiArtifacts.variantIndex] })
      .returning({ id: aiArtifacts.id });
    lastFailure = null;
    return inserted[0]?.id ?? null;
  } catch (err) {
    note(err, "insert");
    return null;
  }
}

/**
 * Count one serve against a variant, so round-robin has something to order by.
 *
 * Never awaited by the request path — the teacher has their artifact, and
 * making them wait on a counter would trade something that matters for
 * something that does not. Mirrors how `recordUsage` treats its own insert.
 */
export function noteServed(artifactId: string): void {
  void (async () => {
    try {
      const { db, aiArtifacts } = await import("@workspace/db");
      const { eq, sql } = await import("drizzle-orm");
      await db
        .update(aiArtifacts)
        .set({ timesServed: sql`${aiArtifacts.timesServed} + 1` })
        .where(eq(aiArtifacts.id, artifactId));
    } catch (err) {
      note(err, "serve-count");
    }
  })();
}

/**
 * Take a variant out of circulation.
 *
 * The cost of sharing one artifact with every teacher who asks for a lesson is
 * that one bad artifact reaches every teacher who asks for that lesson. This is
 * the way back out: a retired row is never served again and its slot is never
 * reused, so the next request for that key generates into a fresh slot.
 */
export async function retireVariant(artifactId: string): Promise<boolean> {
  try {
    const { db, aiArtifacts } = await import("@workspace/db");
    const { eq, isNull, and } = await import("drizzle-orm");
    const updated = await db
      .update(aiArtifacts)
      .set({ retiredAt: new Date() })
      .where(and(eq(aiArtifacts.id, artifactId), isNull(aiArtifacts.retiredAt)))
      .returning({ id: aiArtifacts.id });
    lastFailure = null;
    return updated.length > 0;
  } catch (err) {
    note(err, "insert");
    return false;
  }
}
