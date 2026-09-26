import crypto from "node:crypto";
import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { verifyDerivative } from "../lib/mathVerifierClient.ts";
import { isVerifierUnreachable } from "../lib/derivativeVerified.ts";
import { getBudgetStatus } from "../lib/aiBudget.ts";
import { getRecentErrors } from "../lib/errorLog.ts";
import { createRateLimiter } from "../lib/rateLimit.ts";
import { studentAccountsEnabled } from "../lib/features.js";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

/**
 * Which build is actually serving this request.
 *
 * Three surfaces carry the same `@workspace/curriculum` package and move at
 * three different speeds: web auto-deploys on every merge, this API is
 * deployed by hand, and the app ships on its own cadence. Until this route
 * existed there was no way to ask any of them which commit they were on — you
 * grepped the served bundle hash and guessed. A stale API is the failure that
 * broke production signups on 2026-09-10.
 *
 * Deliberately NOT folded into /healthz: that response is pinned by the
 * `HealthCheckResponse` zod contract in @workspace/api-zod and is what Render
 * polls. Adding a field there means versioning a contract to report a string.
 *
 * `K_REVISION` is injected by Cloud Run for free. `GIT_SHA` is not — it has to
 * be passed at deploy time (see docs/deploying.md), so "unknown" here means the
 * deploy omitted it, not that the route is broken.
 */
router.get("/healthz/version", (_req, res) => {
  res.json({
    commit: process.env.GIT_SHA ?? "unknown",
    revision: process.env.K_REVISION ?? null,
  });
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
 * Can the deck builder actually get a photo?
 *
 * Unauthenticated and public, same reasoning as `/healthz/verifier`: it sends
 * one fixed trivial query and reports reachability, never a caller's input and
 * never the key.
 *
 * It exists because "the generated decks have no pictures" was diagnosed four
 * times — wrong queries, a missing prompt field, a layout that swallowed the
 * column, a model that never asked for one — while the actual cause sat here:
 * Unsplash answering non-OK to every single lookup, including "flower". The
 * proxy turned that into `{photo:null}`, which is indistinguishable from "that
 * query had no results", so nothing anywhere said the lookup had failed. This
 * makes the difference answerable in one request, with no AI spend and no deck.
 *
 * Each call spends one real Unsplash request from a small hourly quota that the
 * deck builder shares, so a public loop on it would blank every deck's photos.
 * One global bucket, not per-IP: rotating addresses must not multiply the cap.
 */
const unsplashProbeLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "unsplash-probe",
  key: () => "global",
});

router.get("/healthz/unsplash", unsplashProbeLimiter, async (_req, res) => {
  const accessKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!accessKey) {
    res.status(503).json({
      unsplash: "unconfigured",
      hint: "UNSPLASH_ACCESS_KEY is not set on this service — every deck photo lookup returns nothing.",
    });
    return;
  }
  try {
    const probe = await fetch(
      "https://api.unsplash.com/search/photos?query=flower&per_page=1",
      { headers: { Authorization: `Client-ID ${accessKey}` } },
    );
    // The two headers that separate "the key is wrong" from "the app has used
    // up its hour", which need completely different fixes.
    const limit = probe.headers.get("x-ratelimit-limit");
    const remaining = probe.headers.get("x-ratelimit-remaining");
    if (!probe.ok) {
      res.status(503).json({
        unsplash: "rejected",
        status: probe.status,
        rateLimit: limit,
        rateLimitRemaining: remaining,
        detail: (await probe.text().catch(() => "")).slice(0, 200),
        hint: probe.status === 401
          ? "The access key is not valid — check the application at unsplash.com/oauth/applications."
          : "Unsplash refused the request; a 403 with rateLimitRemaining 0 means the hourly quota is spent.",
      });
      return;
    }
    const data = (await probe.json()) as { results?: unknown[] };
    res.json({
      unsplash: "ok",
      results: Array.isArray(data.results) ? data.results.length : 0,
      rateLimit: limit,
      rateLimitRemaining: remaining,
    });
  } catch (err) {
    res.status(503).json({
      unsplash: "unreachable",
      detail: err instanceof Error ? err.message : String(err),
    });
  }
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
 * The last 50 server errors, newest first — a GET request instead of
 * scrolling raw Render logs to see what broke recently.
 *
 * What a record holds is now an allowlist, not "whatever the log call passed"
 * (see errorLog.ts): the error's name and message, plus a fixed set of
 * identifier keys. No stack, no request bodies, and no field a future
 * `logger.error({ ... })` happens to include.
 *
 * Gated by ADMIN_DEBUG_KEY rather than regular auth: any logged-in teacher
 * could otherwise read errors that may reference other users' data. Responds
 * 404 — not 401/403 — for both a missing key and a wrong one, so the route's
 * existence isn't itself a signal to anyone probing without the key. If
 * ADMIN_DEBUG_KEY isn't set, this endpoint is unreachable, full stop.
 */
router.get("/healthz/errors", (req, res) => {
  const adminKey = process.env.ADMIN_DEBUG_KEY;
  if (!adminKey || !matchesAdminKey(req.headers["x-admin-key"], adminKey)) {
    res.status(404).json({ error: "Not found" });
    return;
  }
  res.json({ errors: getRecentErrors() });
});

/**
 * Constant-time compare for the debug key.
 *
 * `!==` returns as soon as two bytes differ, so the time it takes to answer
 * leaks how much of a guess was right. Over the internet that signal is buried
 * in jitter and this was never the weak point here — but the fix is four
 * lines, and "too noisy to exploit today" is a property of the network, not of
 * the code.
 *
 * Both sides are hashed to a fixed 32 bytes first, because `timingSafeEqual`
 * throws on a length mismatch — and a comparison that throws on the wrong
 * length is a length oracle, which is the thing being closed.
 */
function matchesAdminKey(supplied: unknown, expected: string): boolean {
  if (typeof supplied !== "string") return false;
  const a = crypto.createHash("sha256").update(supplied).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

export default router;
