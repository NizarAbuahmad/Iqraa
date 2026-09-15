import { Router, type IRouter, type Request } from "express";
import { authMiddleware, requireRole, TEACHER_ROLES } from "../middlewares/auth.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import healthRouter from "./health";
import chatRouter from "./chat";
import generateRouter from "./generate";
import authRouter from "./auth";
import workspaceRouter from "./workspace";
import verifiedMathRouter from "./verifiedMath";
import curriculumRouter from "./curriculum";
import bankRouter from "./bank";
import rosterRouter from "./roster";
import evaluationsRouter from "./evaluations";
import attemptsRouter from "./attempts";
import studentAttemptRouter from "./studentAttempt";
import mediaRouter from "./media";
import practiceRouter from "./practice";
import lessonMediaRouter from "./lessonMedia";
import feedbackRouter from "./feedback";
import adminRouter from "./admin";
import messagingRouter from "./messaging";
import moderationRouter from "./moderation";

const router: IRouter = Router();

/*
 * Burst ceilings on the two model-backed surfaces, keyed per user.
 *
 * These are the DoS half of the AI cost controls, and the half that works with
 * no configuration: `assertUserQuotaAvailable` is a no-op unless
 * AI_USER_BUDGET_USD is set (`getUserBudgetLimitUsd` returns 0 otherwise, and
 * neither render.yaml nor deploy.yml sets it), so on a deployment that has not
 * set it these limiters are the only thing standing between one account and
 * the whole shared monthly budget.
 *
 * Keyed by user id rather than IP on purpose — see rateLimit.ts: a school is
 * one NAT address, so an IP-keyed limit here would let one busy classroom
 * throttle the whole building. The IP fallback applies only if authMiddleware
 * let an unauthenticated request through, which would itself be a bug.
 *
 * The numbers are burst protection, not workload shaping: a teacher chatting
 * briskly sends a handful of turns a minute, and a generation takes seconds to
 * come back, so neither ceiling is reachable by hand.
 */
const perUser = (req: Request): string =>
  (req as { user?: { id?: string } }).user?.id ?? req.ip ?? "unknown";

const chatLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 30,
  name: "ai-chat",
  key: perUser,
});
const generateLimiter = createRateLimiter({
  windowMs: 60_000,
  max: 15,
  name: "ai-generate",
  key: perUser,
});

/**
 * Mount order note: several routers below are mounted without a path prefix,
 * so they all see every /api request. Any middleware they install must be
 * path-scoped inside the router — an unscoped `router.use(mw)` here becomes a
 * middleware for the whole API and shadows everything mounted after it.
 *
 * Guards are therefore declared here, at the mount site, where the ordering is
 * visible. chat and generate call OpenAI on every request; leaving them
 * unauthenticated is an open-wallet endpoint the day DEMO_MODE is turned off.
 */
router.use(healthRouter);
router.use("/auth", authRouter);
router.use("/workspace", workspaceRouter);
// Published national curriculum data — deliberately public, see curriculum.ts.
router.use(curriculumRouter);
// A catalog of document titles and provenance, on the same reasoning. It does
// not serve the documents; there is nothing here to serve.
router.use(bankRouter);
router.use(rosterRouter);
router.use(evaluationsRouter);
router.use(attemptsRouter);
// The student exam link — deliberately public, and the only unauthenticated
// write surface in the API. It carries its own rate limiter and its own
// token check, both path-scoped inside the router. Mounted *after* the
// teacher routers so it cannot shadow them, and asserted in mountOrder.test.ts
// both ways: reachable without a token, and not having made anything else so.
router.use(studentAttemptRouter);
// Path-scoped, not `router.use(authMiddleware, chatRouter)` — that form mounts
// the middleware at "/" and reproduces the original bug, answering 401 for
// paths no router owns. The prefixes below cover every route these four
// declare: /chat, /generate/*, /verify/*, and /media/*.
router.use("/chat", authMiddleware, chatLimiter);
// /generate produces teacher materials from a teacher's own class/roster
// context, so — unlike /chat — it also requires the teacher role, not just
// any authenticated user.
router.use("/generate", authMiddleware, requireRole(...TEACHER_ROLES), generateLimiter);
router.use("/verify", authMiddleware);
// Unsplash lookup shares one server-side access key across every teacher —
// unauthenticated callers could otherwise exhaust the whole app's rate limit.
router.use("/media", authMiddleware);
// Read-aloud practice spends money on transcription for whoever is signed in,
// so it needs an identity to bill and to cap. Any role may practise — a teacher
// trying the exercise before setting it is a legitimate use.
router.use("/practice", authMiddleware);
router.use(chatRouter);
router.use(generateRouter);
router.use(verifiedMathRouter);
router.use(mediaRouter);
router.use("/media", lessonMediaRouter);
router.use(practiceRouter);
// feedback.ts and admin.ts declare authMiddleware/requireRole per-route
// themselves (a mix of any-signed-in-user and admin-only routes lives in the
// same file), so no blanket guard is needed at this mount site.
router.use(feedbackRouter);
router.use(adminRouter);
// messaging.ts self-guards too (see its own note) — deliberately signed-in-only,
// not teacher-only, since parents and students must reach it.
router.use(messagingRouter);
// moderation.ts is the read side of messaging's reports. Same self-guarding
// arrangement, admin-only on every route.
router.use(moderationRouter);

export default router;
