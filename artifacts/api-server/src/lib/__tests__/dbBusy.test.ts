import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { isPoolExhausted, sendDbBusy } from "../dbBusy.ts";

describe("isPoolExhausted", () => {
  it("recognises pg's wait-for-a-connection timeout", () => {
    assert.equal(isPoolExhausted(new Error("timeout exceeded when trying to connect")), true);
  });

  it("sees it through a wrapped cause (drizzle wraps query errors)", () => {
    const wrapped = new Error("Failed query: select 1", { cause: new Error("timeout exceeded when trying to connect") });
    assert.equal(isPoolExhausted(wrapped), true);
  });

  it("does not claim other database errors", () => {
    assert.equal(isPoolExhausted(new Error("duplicate key value violates unique constraint")), false);
    assert.equal(isPoolExhausted(new Error("canceling statement due to statement timeout")), false);
    assert.equal(isPoolExhausted("timeout exceeded when trying to connect"), false);
    assert.equal(isPoolExhausted(undefined), false);
  });

  it("survives a cause cycle", () => {
    const a: any = new Error("a");
    a.cause = a;
    assert.equal(isPoolExhausted(a), false);
  });
});

describe("sendDbBusy", () => {
  it("answers 503 with a Retry-After and a code the client can branch on, never 401", () => {
    const sent: { headers: Record<string, string>; status?: number; body?: unknown } = { headers: {} };
    const res = {
      setHeader(n: string, v: string) {
        sent.headers[n] = v;
      },
      status(c: number) {
        sent.status = c;
        return { json: (b: unknown) => void (sent.body = b) };
      },
    };
    sendDbBusy(res);
    assert.equal(sent.status, 503);
    assert.equal(sent.headers["Retry-After"], "2");
    assert.equal((sent.body as { code: string }).code, "db_busy");
  });
});
