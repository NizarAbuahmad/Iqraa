/**
 * What this guards: the auth routes' brute-force protection, and the property
 * that makes it real — one bucket for the whole service rather than one per
 * container. A limiter that doesn't block past `max`, that pools callers who
 * should be separate, or that counts per instance all fail silently, and all
 * three look identical to a working limiter from inside a single process.
 *
 * The store is faked, so these run with no database. `fakeStore` keeps one Map
 * and is shared between "instances" on purpose: that is what Postgres provides
 * in production, and what the old in-memory Map did not.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createRateLimiter } from "../rateLimit.ts";
import type { RateLimitStore } from "../rateLimitStore.ts";

function mockRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return res;
}

/** Stands in for the `rate_limit_buckets` table, including the window reset. */
function fakeStore(): RateLimitStore {
  const rows = new Map<string, { count: number; resetAt: number }>();
  return {
    async hit(key: string, windowMs: number) {
      const now = Date.now();
      const existing = rows.get(key);
      if (!existing || existing.resetAt <= now) {
        const fresh = { count: 1, resetAt: now + windowMs };
        rows.set(key, fresh);
        return { count: fresh.count, resetAt: new Date(fresh.resetAt) };
      }
      existing.count += 1;
      return { count: existing.count, resetAt: new Date(existing.resetAt) };
    },
  };
}

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks with 429", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, name: "test", store: fakeStore() });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    await limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2, "exactly `max` requests are allowed through");

    const blockedRes = mockRes();
    await limiter({ ip: "1.1.1.1" } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2);
    assert.equal(blockedRes.statusCode, 429);
    assert.ok(blockedRes.headers["Retry-After"]);
  });

  it("tracks separate IPs independently", async () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: "test", store: fakeStore() });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    await limiter({ ip: "2.2.2.2" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2);

    const blockedRes = mockRes();
    await limiter({ ip: "1.1.1.1" } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2);
    assert.equal(blockedRes.statusCode, 429);
  });

  /**
   * The bug the store exists to fix. Two limiter instances stand in for two
   * Cloud Run containers; with the old in-memory Map each held its own count,
   * so a limit of 2 admitted 4 requests across two instances — and up to 20x
   * at the maxScale this service actually runs with.
   */
  it("shares one bucket across instances", async () => {
    const shared = fakeStore();
    const instanceA = createRateLimiter({ windowMs: 60_000, max: 2, name: "login", store: shared });
    const instanceB = createRateLimiter({ windowMs: 60_000, max: 2, name: "login", store: shared });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await instanceA({ ip: "9.9.9.9" } as any, mockRes() as any, next);
    await instanceB({ ip: "9.9.9.9" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2, "two allowed in total, not two each");

    const blockedRes = mockRes();
    await instanceB({ ip: "9.9.9.9" } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2, "the third is blocked whichever instance sees it");
    assert.equal(blockedRes.statusCode, 429);
  });

  /**
   * Buckets are namespaced by limiter name. Without that, a teacher who had
   * just signed in would arrive at messaging with their login attempts already
   * counted against the send limit.
   */
  it("does not pool different limiters that share a caller", async () => {
    const shared = fakeStore();
    const login = createRateLimiter({ windowMs: 60_000, max: 1, name: "login", store: shared });
    const send = createRateLimiter({ windowMs: 60_000, max: 1, name: "message-send", store: shared });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await login({ ip: "5.5.5.5" } as any, mockRes() as any, next);
    await send({ ip: "5.5.5.5" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2, "one limiter's count must not consume another's allowance");
  });

  it("keys by the supplied function, so one IP does not pool separate users", async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      name: "test",
      key: (req: any) => req.user?.id ?? req.ip,
      store: fakeStore(),
    });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };
    const sameIp = "10.0.0.1";

    await limiter({ ip: sameIp, user: { id: "teacher" } } as any, mockRes() as any, next);
    await limiter({ ip: sameIp, user: { id: "parent" } } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2, "two users behind one NAT must not share a bucket");

    const blockedRes = mockRes();
    await limiter({ ip: sameIp, user: { id: "teacher" } } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2, "the same user past max is still blocked");
    assert.equal(blockedRes.statusCode, 429);
  });

  it("falls back to IP when no key function is given", async () => {
    // Guards the other callers — login, register, google-auth, join, take —
    // which pass no `key` and must keep their existing IP behaviour.
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: "test", store: fakeStore() });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await limiter({ ip: "1.1.1.1", user: { id: "a" } } as any, mockRes() as any, next);
    const blockedRes = mockRes();
    await limiter({ ip: "1.1.1.1", user: { id: "b" } } as any, blockedRes as any, next);
    assert.equal(nextCalls, 1, "without `key`, a shared IP still shares a bucket");
    assert.equal(blockedRes.statusCode, 429);
  });

  it("resets the count once the window has passed", async () => {
    const limiter = createRateLimiter({ windowMs: 10, max: 1, name: "test", store: fakeStore() });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    await limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 1);

    await new Promise<void>(resolve => setTimeout(resolve, 20));
    await limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2);
  });

  /**
   * A limiter whose counter is unreachable must not become an outage of its
   * own. Every route behind one needs the database anyway, so the request was
   * already going to fail — answering 429 would mislabel it as abuse and send
   * whoever is debugging it somewhere else entirely.
   */
  it("fails open when the store throws, rather than 429ing an outage", async () => {
    const brokenStore: RateLimitStore = {
      async hit() {
        throw new Error("connection terminated unexpectedly");
      },
    };
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: "test", store: brokenStore });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    const res = mockRes();
    await limiter({ ip: "1.1.1.1" } as any, res as any, next);
    assert.equal(nextCalls, 1, "the request is allowed through");
    assert.equal(res.statusCode, 200, "and is not answered 429");
  });
});
