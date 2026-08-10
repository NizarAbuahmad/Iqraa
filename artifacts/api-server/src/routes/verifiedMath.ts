import { Router } from "express";
import {
  generateAiVerifiedItem,
  generateBatch,
  generateTemplateItem,
} from "../lib/derivativeVerified";
import { verifyDerivative } from "../lib/mathVerifierClient";
import { logger } from "../lib/logger";

const verifiedMathRouter = Router();

/** Single template item (no AI). */
verifiedMathRouter.post("/generate/verified-derivative/template", async (_req, res) => {
  try {
    res.json(await generateTemplateItem());
  } catch (err) {
    logger.error({ err }, "template derivative error");
    res.status(500).json({ error: "Template generation failed." });
  }
});

/** Single AI item — only returned if SymPy verifies answer + distractors. */
verifiedMathRouter.post("/generate/verified-derivative/ai", async (_req, res) => {
  try {
    const { item, attempts } = await generateAiVerifiedItem();
    res.json({ ...item, attempts: attempts.length, attempt_log: attempts });
  } catch (err) {
    logger.error({ err }, "ai verified derivative error");
    res.status(502).json({
      error: "Could not produce a verified item. Regenerations exhausted or verifier unavailable.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/**
 * Done-criterion helper: generate template + AI items.
 * Query: ?template=10&ai=10
 */
verifiedMathRouter.post("/generate/verified-derivative/batch", async (req, res) => {
  try {
    const template = Math.min(20, Math.max(0, Number(req.query.template ?? 10)));
    const ai = Math.min(20, Math.max(0, Number(req.query.ai ?? 10)));
    const { items, wrong, unverified, attempts_per_ai_item, avg_ai_attempts } =
      await generateBatch({ template, ai });
    res.json({
      total: items.length,
      wrong,
      unverified,
      // `pass` means every key was checked and every check agreed. An
      // unreachable verifier fails this, rather than passing by omission.
      pass: wrong === 0 && unverified === 0 && items.every((i) => i.verified),
      attempts_per_ai_item,
      avg_ai_attempts,
      items,
    });
  } catch (err) {
    logger.error({ err }, "batch verified derivative error");
    res.status(502).json({
      error: "Batch generation failed.",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
});

/** Proxy to SymPy verifier (dispatches via topic registry). */
verifiedMathRouter.post("/verify/derivative", async (req, res) => {
  try {
    const { question, answer, topic, distractors } = req.body ?? {};
    if (!question || !answer) {
      res.status(400).json({ error: "question and answer required" });
      return;
    }
    const result = await verifyDerivative(
      String(question),
      String(answer),
      topic,
      distractors,
    );
    res.json(result);
  } catch (err) {
    logger.error({ err }, "verify derivative proxy error");
    res.status(500).json({ error: "Verify proxy failed." });
  }
});

export default verifiedMathRouter;
