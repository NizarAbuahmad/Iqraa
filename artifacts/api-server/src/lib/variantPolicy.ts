/**
 * What to do with a generation request, given the pool that already exists.
 *
 * Split from `artifactCache.ts` so the decision is testable without a
 * database. Every judgement in the caching design lives here — serve or
 * generate, which variant, whether to store it — and each of them is a rule a
 * test can pin, rather than a branch buried in a route that only runs against
 * Neon.
 */
import type { PooledArtifact } from "./artifactCache.ts";

export type ServeDecision =
  | { action: "serve"; artifact: PooledArtifact }
  | {
      action: "generate";
      /** Slot this generation would take, and the seed for its variation
       *  profile — see `variation.ts`. */
      variantIndex: number;
      /** Whether the result should be written back for other teachers. */
      store: boolean;
    };

export type DecideArgs = {
  /** Live variants for this key, least-served first (`readPool`). */
  variants: readonly PooledArtifact[];
  /** Slot a new variant would take. */
  nextVariantIndex: number;
  /** False when the pool could not be read — nothing may be stored, because
   *  the count it would be stored against is unknown. */
  readable: boolean;
  /** Artifact ids this teacher has already been served for this key. */
  seenIds: ReadonlySet<string>;
  /** The teacher pressed "regenerate" rather than "generate". */
  regenerate: boolean;
  /** The request may be shared with other teachers — see `ContextSource`. */
  shareable: boolean;
  /** Distinct variants held per key (`VARIANT_POOL_MAX`). */
  poolMax: number;
};

export function decideServe(args: DecideArgs): ServeDecision {
  // A request carrying the teacher's own material is generated fresh every
  // time and never written down. Not "cached per user": a per-user cache of
  // pasted content is a store of teacher material earning almost nothing —
  // teachers rarely re-paste the identical document — in exchange for a place
  // it could leak from.
  if (!args.shareable) {
    return { action: "generate", variantIndex: args.regenerate ? 1 : 0, store: false };
  }

  const unseen = args.variants.filter((v) => !args.seenIds.has(v.id));

  if (unseen.length > 0) {
    // Least-served first, so a key with three variants spreads across three
    // classes instead of handing everyone variant 0.
    return { action: "serve", artifact: unseen[0]! };
  }

  // Nothing unseen. On a plain generate that is fine — the teacher asked the
  // same question again and gets the same answer, for free. On a regenerate it
  // is the one thing they asked not to happen.
  if (!args.regenerate && args.variants.length > 0) {
    return { action: "serve", artifact: args.variants[0]! };
  }

  return {
    action: "generate",
    // Never slot 0 on a regenerate: slot 0 carries the neutral profile, which
    // is the prompt that produced the artifact being rejected. Without this a
    // regeneration against an unreadable pool would be steered by nothing.
    variantIndex: args.regenerate ? Math.max(args.nextVariantIndex, 1) : args.nextVariantIndex,
    // The cap bounds what one key can cost. Past it a regenerate still returns
    // something new — the teacher is never told "no more variations" — it is
    // just not kept. Storing without a readable pool is impossible: the slot
    // number would be a guess, and the unique index would reject it.
    store: args.readable && args.variants.length < args.poolMax,
  };
}
