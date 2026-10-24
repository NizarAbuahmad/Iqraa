/**
 * The parent's approval page, with no login: the parent has no account, the link is the credential.
 *
 * The token travels in the mail link's URL *fragment* (`/guardian#{token}`), which a browser never sends to a server,
 * and from the page to here in a POST *body*. It is never in a path or a query, so it cannot reach Cloud Run's request
 * log or this app's own. That is why there is no `GET /guardian-consent/:token`: a GET could only carry the token in
 * the URL, and a GET must not change state anyway.
 *
 * Every path starts `/guardian-consent`, so this router, mounted at the root, shadows nothing (the lesson in
 * `mountOrder.test.ts`). Rate limited per IP, and it never says whether a token ever existed beyond "this link does
 * not work".
 */
import { Router } from "express";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { guardianApprovalEnabled } from "../lib/features.js";
import { looksLikeConsentToken } from "../lib/guardianConsent.ts";
import { decideByToken, lookupByToken } from "../lib/guardianRequests.ts";

const router = Router();
const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 30, name: "guardian-consent" });

const disabled = { code: "guardian_approval_disabled", error: "Not available" };

router.get("/guardian-consent/config", (_req, res) => {
  res.json({ enabled: guardianApprovalEnabled() });
});

router.post("/guardian-consent/lookup", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    const body = (req.body ?? {}) as { token?: unknown };
    // A missing or malformed token is an unknown token, answered as one, before it can become a query.
    if (!looksLikeConsentToken(body.token)) {
      res.json({ status: "invalid" });
      return;
    }
    res.json(await lookupByToken(body.token));
  } catch (err) {
    logger.error({ err }, "guardian consent lookup failed");
    res.status(500).json({ error: "Could not load this request" });
  }
});

router.post("/guardian-consent/decide", limiter, async (req, res) => {
  if (!guardianApprovalEnabled()) {
    res.status(404).json(disabled);
    return;
  }
  try {
    const body = (req.body ?? {}) as { token?: unknown; decision?: unknown; confirmGuardian?: unknown };
    if (!looksLikeConsentToken(body.token)) {
      res.status(410).json({ error: "This link no longer works", code: "consent_link_unusable" });
      return;
    }
    if (body.decision !== "approved" && body.decision !== "declined") {
      res.status(400).json({ error: "Choose approve or decline", code: "decision_invalid" });
      return;
    }
    // A literal true, like the terms tick: approving is a statement the parent makes.
    if (body.decision === "approved" && body.confirmGuardian !== true) {
      res.status(400).json({ error: "Confirm that you are this child's parent or legal guardian", code: "guardian_confirmation_required" });
      return;
    }
    const outcome = await decideByToken(body.token, body.decision);
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
