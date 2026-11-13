/**
 * One question-generation request at a time per exam (`POST /evaluations/:id/generate`).
 *
 * The app gives up on that request after 45 s and the model can take longer, so a
 * teacher taps «generate» again while the first request is still writing; both
 * called the model and the second replaced the first's paper. The write is already
 * serialised by the evaluation row lock, so this is about the spend and the wait,
 * not a corrupt paper.
 *
 * The claim is a timestamp on the evaluation row (`generating_since`), not a Map:
 * `iqraa-api` runs on up to 20 Cloud Run instances, so a second tap can land on
 * another one. A claim older than `GENERATION_CLAIM_MS` is treated as dead, so an
 * instance that crashed mid-call cannot lock an exam for good.
 *
 * Two rules the route depends on:
 * - Release only your own claim. After a claim expired and another request took it,
 *   the slow first request must not free the second one's.
 * - Release BEFORE the response is written (`releaseBeforeResponding`). Cloud Run
 *   throttles the CPU once a response is sent, so a release that waited for that
 *   could be stalled until some later request wakes the instance, and the teacher's
 *   next regenerate would be refused for a minute for nothing.
 */
import type { Response } from "express";
import { and, eq, isNull, lt, or } from "drizzle-orm";
import { db, evaluations } from "@workspace/db";
import { logger } from "./logger.ts";

/**
 * Cloud Run's request limit (`--timeout 300` in deploy.yml) plus a margin: no request
 * can outlive it, so a claim older than this is certainly dead and a live generation
 * is never treated as one. The model call alone is allowed 120 s with a retry
 * (lib/integrations-openai-ai-server), and a paper can add a retry and a top-up, so a
 * shorter expiry would let a long but legitimate generation be duplicated. The cost is
 * the other way round: an instance that dies mid-call leaves the exam refusing a
 * regenerate for up to this long.
 */
export const GENERATION_CLAIM_MS = 330_000;

export interface GenerationClaim {
  /** Frees the exam if this claim is still the one on it. Never throws. */
  release(): Promise<void>;
}

/** Takes the claim, or returns `null` when another request already holds a live one. */
export async function claimGeneration(evaluationId: string): Promise<GenerationClaim | null> {
  const claimedAt = new Date();
  const [taken] = await db
    .update(evaluations)
    .set({ generatingSince: claimedAt })
    .where(
      and(
        eq(evaluations.id, evaluationId),
        or(
          isNull(evaluations.generatingSince),
          lt(evaluations.generatingSince, new Date(claimedAt.getTime() - GENERATION_CLAIM_MS)),
        ),
      ),
    )
    .returning({ id: evaluations.id });
  if (!taken) return null;

  return {
    async release() {
      try {
        await db
          .update(evaluations)
          .set({ generatingSince: null })
          .where(and(eq(evaluations.id, evaluationId), eq(evaluations.generatingSince, claimedAt)));
      } catch (err) {
        // The claim expires on its own; failing to free it early must not turn a
        // finished generation into an error.
        logger.warn({ err, evaluationId }, "could not release the generation claim; it will expire");
      }
    },
  };
}

/**
 * Makes the handler's first `res.json(...)` wait for the release. Every answer from
 * the route, success or failure, goes through `res.json`, so wrapping it is the one
 * place that covers all of them without threading a release through each exit.
 */
export function releaseBeforeResponding(res: Response, claim: GenerationClaim): void {
  const send = res.json.bind(res);
  let released = false;
  res.json = ((body?: unknown) => {
    if (released) return send(body);
    released = true;
    void claim.release().then(() => send(body));
    return res;
  }) as Response["json"];
}
