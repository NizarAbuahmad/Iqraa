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
