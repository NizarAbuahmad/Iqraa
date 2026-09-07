/**
 * In-memory, single-instance rate limiter — the same tradeoff as
 * aiBudget.ts and errorLog.ts: no Redis, resets on restart, good enough for
 * a single-instance pilot deployment. Keyed by client IP by default, so it
 * depends on Express's `trust proxy` being set correctly behind Render's load
 * balancer (see app.ts) — without it every request reports the proxy's own
 * address and all callers share one bucket.
 *
 * `key` overrides that. An IP is the only identity an unauthenticated route
 * has, but it is a poor one here: a school shares one NAT address, so an
 * IP-keyed limit on a signed-in route lets one busy classroom throttle
 * everyone else in the building. `/take` works around that with a very
 * generous ceiling (studentAttempt.ts) because it has no user to key on.
 * A route behind authMiddleware does, and should pass it — a tight per-user
 * limit then costs the room nothing.
 */
import type { NextFunction, Request, Response } from "express";
import { logger } from "./logger.ts";

type Bucket = { count: number; resetAt: number };

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  name: string;
  key?: (req: Request) => string;
}) {
  const buckets = new Map<string, Bucket>();

  return function rateLimit(req: Request, res: Response, next: NextFunction): void {
    const key = opts.key?.(req) ?? req.ip ?? "unknown";
    const now = Date.now();
    const existing = buckets.get(key);

    if (!existing || existing.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }

    if (existing.count >= opts.max) {
      const retryAfterSec = Math.ceil((existing.resetAt - now) / 1000);
      logger.warn({ key, limiter: opts.name, retryAfterSec }, "rate limit exceeded");
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    existing.count += 1;
    next();
  };
}
