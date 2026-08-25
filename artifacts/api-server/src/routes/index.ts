import { Router, type IRouter } from "express";
import { authMiddleware } from "../middlewares/auth.js";
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
import feedbackRouter from "./feedback";
import adminRouter from "./admin";

const router: IRouter = Router();

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
router.use("/chat", authMiddleware);
router.use("/generate", authMiddleware);
router.use("/verify", authMiddleware);
// Unsplash lookup shares one server-side access key across every teacher —
// unauthenticated callers could otherwise exhaust the whole app's rate limit.
router.use("/media", authMiddleware);
router.use(chatRouter);
router.use(generateRouter);
router.use(verifiedMathRouter);
router.use(mediaRouter);
// feedback.ts and admin.ts declare authMiddleware/requireRole per-route
// themselves (a mix of any-signed-in-user and admin-only routes lives in the
// same file), so no blanket guard is needed at this mount site.
router.use(feedbackRouter);
router.use(adminRouter);

export default router;
