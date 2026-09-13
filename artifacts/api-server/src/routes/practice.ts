/**
 * Read-aloud practice: score a recording without recording a mark.
 *
 * The assessment path (`studentAttempt.ts`) exists to produce a grade — one
 * attempt, three takes, stored audio a teacher can play back. This is the
 * opposite of that on every axis except the scoring: retry as often as you
 * like, see the number immediately, and nothing is kept.
 *
 * **Nothing is stored. Not the audio, not the score.** No R2 object, no row.
 * A student hears themselves back from the local `Blob` the browser already
 * holds, so the one pedagogically useful thing about the recording survives
 * without us retaining children's voice recordings we have no reason to keep —
 * and the endpoint loses R2 as a dependency and a failure mode.
 *
 * **What this actually is, said plainly.** `resourceId` only selects the
 * reference text to score against; the transcript comes back regardless of
 * whether the student read that passage or anything else. So this is a paid
 * transcription oracle for any signed-in account. The retry count is not what
 * bounds it — the per-user dollar cap is, which is why `recordAudioUsage`
 * had to start writing a ledger row before this route could exist.
 */
import { Router } from "express";
import { getExternalResource } from "@workspace/curriculum";
import { getPracticePassage } from "@workspace/curriculum/practice";

import { logger } from "../lib/logger";
import type { AuthenticatedRequest } from "../middlewares/auth";
import {
  AiBudgetExceededError,
  AiLiveModeOffError,
  AiUserQuotaExceededError,
  assertBudgetAvailable,
  assertLiveModeEnabled,
  assertUserQuotaAvailable,
  recordAudioUsage,
} from "../lib/aiBudget";
import { MAX_DATA_URL_LENGTH, parseDataUrl } from "../lib/lessonMediaUpload";
import { checkRecording, isRejection } from "../lib/readAloudUpload";
import { scoreReading } from "../modules/assessment/readAloud";
import { pgRateLimitStore } from "../lib/rateLimitStore";

const router = Router();

/**
 * Transcriptions per user per day.
 *
 * A 24-hour window, not a per-minute one. Per-minute limiting bounds a burst
 * and says nothing about the daily total, which is the number that turns into
 * money — and one ceiling is easier to reason about than two.
 *
 * Safe from the store's sweeper, which only deletes buckets whose `resetAt` is
 * already more than a day past; a live 24-hour bucket's is in the future. It is
 * a fixed window anchored on the first hit, so a determined caller can get 2×
 * across a boundary. That is accepted: the dollar cap is the real bound.
 */
const PRACTICE_PER_DAY = 60;
const PRACTICE_WINDOW_MS = 24 * 60 * 60 * 1000;

router.post("/practice/read-aloud", async (req: AuthenticatedRequest, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      // authMiddleware is mounted at the prefix, so this is belt-and-braces —
      // but an unattributable transcription is exactly what must not happen.
      res.status(401).json({ error: "Sign in to practise", code: "unauthenticated" });
      return;
    }

    const resourceId = typeof req.body?.resourceId === "string" ? req.body.resourceId : "";
    const passage = getPracticePassage(resourceId);
    const resource = getExternalResource(resourceId);
    if (!passage || !resource) {
      // The manifest is the allowlist. The client names a curated id and never
      // supplies its own text, so there is no way to ask for a passage that
      // nobody licensed.
      res.status(404).json({ error: "No practice passage for that resource", code: "no_passage" });
      return;
    }

    const rawAudio = typeof req.body?.audio === "string" ? req.body.audio : "";
    const parsed = rawAudio ? parseDataUrl(rawAudio) : null;
    const verdict = checkRecording({
      mime: parsed?.mime ?? null,
      durationMs: req.body?.durationMs,
      // Practice has no take counter to read, so the cap cannot fire. Passing
      // zero is what makes retries unlimited — deliberately not a `maxTakes`
      // option, which would only add a way to weaken the assessment path.
      previousTakes: 0,
      dataUrlLength: rawAudio.length,
      maxDataUrlLength: MAX_DATA_URL_LENGTH,
    });
    if (isRejection(verdict)) {
      res.status(verdict.status).json({ error: verdict.error, code: verdict.code });
      return;
    }
    if (!parsed) {
      res.status(400).json({ error: "audio must be a base64 data URL", code: "bad_audio" });
      return;
    }

    assertLiveModeEnabled();
    assertBudgetAvailable();
    await assertUserQuotaAvailable(userId);

    /*
     * Count the transcription, not the request — and only now, after every
     * validation has passed.
     *
     * As middleware this would tick on a bad MIME type or an over-long clip, so
     * a student with a broken microphone could burn a day's allowance without
     * ever being transcribed once. Quota should measure what was spent.
     */
    const hit = await pgRateLimitStore.hit(`practice-audio:${userId}`, PRACTICE_WINDOW_MS);
    if (hit.count > PRACTICE_PER_DAY) {
      const retryAfterSec = Math.max(1, Math.ceil((hit.resetAt.getTime() - Date.now()) / 1000));
      res.status(429)
        .set("Retry-After", String(retryAfterSec))
        .json({
          error: `You have practised ${PRACTICE_PER_DAY} times today. Come back tomorrow.`,
          code: "practice_daily_limit",
        });
      return;
    }

    // Lazily imported: the module builds its OpenAI client at module scope and
    // throws without a key, so a top-level import would take this whole router
    // down on any deploy missing OPENAI_API_KEY.
    const { speechToText } = await import("@workspace/integrations-openai-ai-server/audio");
    const transcript = await speechToText(parsed.buffer, verdict.transcribeAs);
    recordAudioUsage(verdict.durationMs / 1000, "gpt-4o-mini-transcribe", userId);

    // `scoreReading` directly, not `readAloud.grade`: that keys "attempted" on
    // an `audioKey`, and there is deliberately no stored object here.
    const score = scoreReading(passage.passage, transcript);

    res.json({
      transcript,
      accuracy: score.accuracy,
      errors: score.errors,
      referenceWords: score.referenceWords,
      spokenWords: score.spokenWords,
      // Echoed so the panel can render the credit next to the result without a
      // second lookup. Every licence here requires it wherever the text shows.
      attribution: resource.attribution,
    });
  } catch (err) {
    if (
      err instanceof AiLiveModeOffError
      || err instanceof AiBudgetExceededError
      || err instanceof AiUserQuotaExceededError
    ) {
      logger.warn({ err: err.message }, "practice transcription refused");
      res.status(503).json({ error: "Practice is unavailable right now", code: "ai_unavailable" });
      return;
    }
    logger.error({ err }, "practice read-aloud failed");
    res.status(500).json({ error: "Could not score that recording" });
  }
});

export default router;
