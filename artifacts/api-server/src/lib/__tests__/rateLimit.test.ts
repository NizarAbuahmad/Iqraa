/**
 * What this guards: the auth routes' brute-force protection. A limiter that
 * doesn't actually block past `max`, or that blocks a different IP because
 * it shares state, defeats the point silently — these are the two ways that
 * happens.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { createRateLimiter } from "../rateLimit.ts";

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

describe("createRateLimiter", () => {
  it("allows requests up to the limit, then blocks with 429", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 2, name: "test" });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2);

    const blockedRes = mockRes();
    limiter({ ip: "1.1.1.1" } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2);
    assert.equal(blockedRes.statusCode, 429);
    assert.ok(blockedRes.headers["Retry-After"]);
  });

  it("tracks separate IPs independently", () => {
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: "test" });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    limiter({ ip: "2.2.2.2" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2);

    const blockedRes = mockRes();
    limiter({ ip: "1.1.1.1" } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2);
    assert.equal(blockedRes.statusCode, 429);
  });

  /**
   * The reason `key` exists. Messaging is behind auth and a school sits
   * behind one NAT address, so keying that route by IP would let one busy
   * classroom 429 everyone else in the building — the failure this option
   * is here to prevent, and one that would look like an outage, not a limit.
   */
  it("keys by the supplied function, so one IP does not pool separate users", () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      max: 1,
      name: "test",
      key: (req: any) => req.user?.id ?? req.ip,
    });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };
    const sameIp = "10.0.0.1";

    limiter({ ip: sameIp, user: { id: "teacher" } } as any, mockRes() as any, next);
    limiter({ ip: sameIp, user: { id: "parent" } } as any, mockRes() as any, next);
    assert.equal(nextCalls, 2, "two users behind one NAT must not share a bucket");

    const blockedRes = mockRes();
    limiter({ ip: sameIp, user: { id: "teacher" } } as any, blockedRes as any, next);
    assert.equal(nextCalls, 2, "the same user past max is still blocked");
    assert.equal(blockedRes.statusCode, 429);
  });

  it("falls back to IP when no key function is given", () => {
    // Guards the other callers — login, register, google-auth, join, take —
    // which pass no `key` and must keep their existing IP behaviour.
    const limiter = createRateLimiter({ windowMs: 60_000, max: 1, name: "test" });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: "1.1.1.1", user: { id: "a" } } as any, mockRes() as any, next);
    const blockedRes = mockRes();
    limiter({ ip: "1.1.1.1", user: { id: "b" } } as any, blockedRes as any, next);
    assert.equal(nextCalls, 1, "without `key`, a shared IP still shares a bucket");
    assert.equal(blockedRes.statusCode, 429);
  });

  it("resets the count once the window has passed", () => {
    const limiter = createRateLimiter({ windowMs: 10, max: 1, name: "test" });
    let nextCalls = 0;
    const next = () => {
      nextCalls += 1;
    };

    limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
    assert.equal(nextCalls, 1);

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        limiter({ ip: "1.1.1.1" } as any, mockRes() as any, next);
        assert.equal(nextCalls, 2);
        resolve();
      }, 20);
    });
  });
});
