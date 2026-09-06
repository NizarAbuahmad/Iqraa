import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { verifyDerivative } from "../lib/mathVerifierClient.ts";
import { isVerifierUnreachable } from "../lib/derivativeVerified.ts";
import { getBudgetStatus } from "../lib/aiBudget.ts";
import { getRecentErrors } from "../lib/errorLog.ts";
import { studentAccountsEnabled } from "../lib/features.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Is the SymPy verifier actually reachable from this API?
 *
 * Deliberately a separate endpoint from /healthz: Render's health check points
 * at /healthz, and folding a cross-service call into it would let a sleeping
 * verifier take the API down with it.
 *
 * Public and unauthenticated on purpose. Whether the verifier is deployed is
 * the first thing anyone debugging this needs to know, and requiring a login to
 * find out is what made it invisible for as long as it was. The probe sends a
 * fixed trivial derivative and reports reachability, never a caller's input.
 */
router.get("/healthz/verifier", async (_req, res) => {
  const check = await verifyDerivative("x^2", "2x");
  if (isVerifierUnreachable(check.error)) {
    res.status(503).json({
      verifier: "unreachable",
      detail: check.error,
      hint: "MATH_VERIFIER_URL unset or the iqraa-verifier service is not deployed.",
    });
    return;
  }
  res.json({
    verifier: "ok",
    // A reachable verifier that disagrees about 2x is broken in a different,
    // louder way — surface it rather than reporting a bare "ok".
    selfTest: check.verified ? "pass" : "fail",
    // Why it failed, when it did. A bare "fail" reads as "SymPy got the
    // derivative wrong" and sends the reader into verify_core.py — but the
    // common cause is far duller: Render answers 5xx while a free-tier
    // service wakes, and `isVerifierUnreachable` deliberately does not treat
    // 5xx as unreachable (a reachable-but-erroring verifier is a real and
    // different state). Observed 2026-09-03: `{"verifier":"ok","selfTest":
    // "fail"}` while the verifier, asked directly, answered `2*x` correctly
    // in 32s — it had simply been asleep. The error string is the difference
    // between "the maths is broken" and "the box was cold".
    ...(check.verified ? {} : { detail: check.error ?? "no error reported" }),
  });
});

/**
 * Is real AI testing on, and how much of the test budget is left?
 *
 * Public and unauthenticated, same reasoning as /healthz/verifier above: no
 * secrets in the response, and whether AI_LIVE_MODE is on is exactly the
 * thing to check first when a test session isn't calling OpenAI as expected.
 */
router.get("/healthz/ai-budget", (_req, res) => {
  res.json(getBudgetStatus());
});

/**
 * What this deployment has switched on, unauthenticated.
 *
 * Served rather than mirrored into an `EXPO_PUBLIC_*` build-time constant so
 * there is one source of truth. A client-side copy is the drift this codebase
 * has been bitten by before, and worse here than usual: the register screen
 * needs the answer *before* anyone signs in, and a stale copy would offer a
 * signup door that comes back 403 — or hide one that works.
 */
router.get("/healthz/features", (_req, res) => {
  res.json({ studentAccounts: studentAccountsEnabled() });
});

/**
 * The last 50 server errors (message + err name/message, no stack, no
 * request bodies), newest first — a GET request instead of scrolling raw
 * Render logs to see what broke recently.
 *
 * Gated by ADMIN_DEBUG_KEY rather than regular auth: any logged-in teacher
 * could otherwise read errors that may reference other users' data. Responds
 * 404 — not 401/403 — for both a missing key and a wrong one, so the route's
 * existence isn't itself a signal to anyone probing without the key. If
 * ADMIN_DEBUG_KEY isn't set, this endpoint is unreachable, full stop.
 */
router.get("/healthz/errors", (req, res) => {
  const adminKey = process.env.ADMIN_DEBUG_KEY;
  if (!adminKey || req.headers["x-admin-key"] !== adminKey) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ errors: getRecentErrors() });
});

export default router;
