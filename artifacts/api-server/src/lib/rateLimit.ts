/**
 * Rate limiter with one bucket per (limiter, caller) across the whole service.
 *
 * It used to count in a `Map` in the container's memory. That is one bucket per
 * *instance*, and `iqraa-api` runs on Cloud Run with maxScale 20 — so "ten
 * login attempts per fifteen minutes" was really up to ten per container, with
 * an attacker's requests spreading across containers and each one starting
 * from zero. The counter now lives in Postgres (see rateLimitStore.ts), so the
 * numbers passed here mean what they say however many instances are up.
 *
 * Keyed by client IP by default, which depends on Express's `trust proxy`
 * being set correctly behind the load balancer (see app.ts) — without it every
 * request reports the proxy's own address and all callers share one bucket.
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
import { pgRateLimitStore, type RateLimitStore } from "./rateLimitStore.ts";

export function createRateLimiter(opts: {
  windowMs: number;
  max: number;
  name: string;
  key?: (req: Request) => string;
  /** Injectable for tests. Production always uses the shared Postgres counter. */
  store?: RateLimitStore;
}) {
  const store = opts.store ?? pgRateLimitStore;

  return async function rateLimit(req: Request, res: Response, next: NextFunction): Promise<void> {
    const caller = opts.key?.(req) ?? req.ip ?? "unknown";
    // Namespaced by limiter, or one caller's login attempts and message sends
    // would share a row and throttle each other.
    const bucketKey = `${opts.name}:${caller}`;

    let hit;
    try {
      hit = await store.hit(bucketKey, opts.windowMs);
    } catch (err) {
      /*
       * Fail open, and say so loudly.
       *
       * Every route behind a limiter here needs the database for its actual
       * work — nothing can check a password, mint a claim code or store a
       * message without it. So a counter that cannot be reached means the
       * request was going to fail regardless, and answering 429 would relabel
       * an outage as abuse, sending whoever debugs it somewhere else entirely.
       * The tradeoff is real and worth stating plainly: while the database is
       * unreachable there is no rate limiting at all.
       */
      logger.error({ err, limiter: opts.name }, "rate limit store unavailable — allowing request");
      next();
      return;
    }

    if (hit.count > opts.max) {
      const retryAfterSec = Math.max(1, Math.ceil((hit.resetAt.getTime() - Date.now()) / 1000));
      logger.warn({ key: bucketKey, limiter: opts.name, retryAfterSec }, "rate limit exceeded");
      res.setHeader("Retry-After", String(retryAfterSec));
      res.status(429).json({ error: "Too many attempts. Please try again later." });
      return;
    }

    next();
  };
}
