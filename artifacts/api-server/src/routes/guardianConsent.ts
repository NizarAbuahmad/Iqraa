/**
 * The parent's approval page, with no login: the parent has no account, the link is the credential.
 *
 * Every path starts `/guardian-consent`, so this router, mounted at the root, shadows nothing (the lesson in
 * `mountOrder.test.ts`). `GET /guardian-consent/config` is declared before `/:token`, or "config" would be read as
 * a token. Rate limited per IP, and it never says whether a token ever existed beyond "this link does not work".
 */
import { Router } from "express";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { guardianApprovalEnabled } from "../lib/features.js";
import { decideByToken, lookupByToken } from "../lib/guardianRequests.ts";

const router = Router();
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, name: "guardian-consent" });

const disabled = { code: "guardian_approval_disabled", error: "Not available" };

router.get("/guardian-consent/config", (_req, res) => {
  res.json({ enabled: guardianApprovalEnabled() });
});

router.get("/guardian-consent/:token", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    res.json(await lookupByToken(req.params["token"]));
  } catch (err) {
    logger.error({ err }, "guardian consent lookup failed");
    res.status(500).json({ error: "Could not load this request" });
  }
});

router.post("/guardian-consent/:token", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    const body = (req.body ?? {}) as { decision?: unknown; confirmGuardian?: unknown };
    if (body.decision !== "approved" && body.decision !== "declined") {
      res.status(400).json({ error: "Choose approve or decline", code: "decision_invalid" });
      return;
    }
    // A literal true, like the terms tick: approving is a statement the parent makes.
    if (body.decision === "approved" && body.confirmGuardian !== true) {
      res.status(400).json({ error: "Confirm that you are this child's parent or legal guardian", code: "guardian_confirmation_required" });
      return;
    }
    const outcome = await decideByToken(req.params["token"], body.decision);
    if (outcome !== "ok") {
      res.status(410).json({ error: "This link no longer works", code: "consent_link_unusable" });
      return;
    }
    res.json({ decision: body.decision });
  } catch (err) {
    logger.error({ err }, "guardian consent decision failed");
    res.status(500).json({ error: "Could not record your answer" });
  }
});

export default router;
