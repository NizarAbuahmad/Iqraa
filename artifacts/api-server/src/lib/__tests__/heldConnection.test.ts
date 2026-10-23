import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { describe, test } from "node:test";
import { makeHoldScopedConnection } from "../heldConnection.ts";

function harness(opts: { identity?: { userId: string; role: string } | undefined; open?: boolean } = {}) {
  const events: string[] = [];
  const logs: Array<{ route: string; statements: number; heldMs: number }> = [];
  const scope = {
    end: async (failed?: boolean) => {
      events.push(failed ? "end(failed)" : "end");
    },
    stats: () => ({ statements: 3, heldMs: 12 }),
  };
  const mw = makeHoldScopedConnection({
    identity: () => ("identity" in opts ? opts.identity : { userId: "u1", role: "teacher" }),
    open: () => (opts.open === false ? undefined : scope),
    run: (_s, fn) => {
      events.push("run");
      return fn();
    },
    log: info => logs.push(info),
  });
  const next = () => events.push("next");
  const req = (method = "GET") => ({ method, originalUrl: "/api/messaging/threads?limit=5" });
  const flush = () => new Promise<void>(r => setImmediate(r));
  return { mw, events, logs, next, req, flush };
}

describe("holdScopedConnection", () => {
  test("a GET with an identity runs the handler inside the scope and ends it on finish", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    assert.deepEqual(h.events, ["run", "next"]);
    res.emit("finish");
    await h.flush();
    assert.deepEqual(h.events, ["run", "next", "end"]);
  });

  test("finish and close together end the scope once", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("finish");
    res.emit("close");
    await h.flush();
    assert.equal(h.events.filter(e => e === "end").length, 1);
  });

  test("a client that hangs up still ends the scope", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("close");
    await h.flush();
    assert.deepEqual(h.events, ["run", "next", "end"]);
  });

  test("logs the route without its query string, with the scope's statement count and hold time", async () => {
    const h = harness();
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    res.emit("finish");
    await h.flush();
    assert.deepEqual(h.logs, [{ route: "GET /api/messaging/threads", statements: 3, heldMs: 12 }]);
  });

  test("an end() that rejects is swallowed and the log still runs", async () => {
    const logs: unknown[] = [];
    const mw = makeHoldScopedConnection({
      identity: () => ({ userId: "u1", role: "teacher" }),
      open: () => ({ end: async () => { throw new Error("connection lost"); }, stats: () => ({ statements: 1, heldMs: 2 }) }),
      run: (_s, fn) => fn(),
      log: info => logs.push(info),
    });
    const res = new EventEmitter();
    mw({ method: "GET", url: "/x" }, res, () => undefined);
    res.emit("finish");
    await new Promise<void>(r => setImmediate(r));
    assert.deepEqual(logs, [{ route: "GET /x", statements: 1, heldMs: 2 }]);
  });

  test("a log that throws does not become an unhandled rejection", async () => {
    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", onUnhandled);
    try {
      const mw = makeHoldScopedConnection({
        identity: () => ({ userId: "u1", role: "teacher" }),
        open: () => ({ end: async () => undefined, stats: () => ({ statements: 1, heldMs: 2 }) }),
        run: (_s, fn) => fn(),
        log: () => { throw new Error("logger broke"); },
      });
      const res = new EventEmitter();
      mw({ method: "GET", url: "/x" }, res, () => undefined);
      res.emit("finish");
      // unhandledRejection fires after the microtask queue drains, so give it a few turns
      await new Promise<void>(r => setTimeout(r, 20));
      assert.deepEqual(unhandled, []);
    } finally {
      process.off("unhandledRejection", onUnhandled);
    }
  });

  test("a write is never held", () => {
    const h = harness();
    h.mw(h.req("POST"), new EventEmitter(), h.next);
    assert.deepEqual(h.events, ["next"]);
  });

  test("no identity means no scope", () => {
    const h = harness({ identity: undefined });
    h.mw(h.req(), new EventEmitter(), h.next);
    assert.deepEqual(h.events, ["next"]);
  });

  test("with enforcement off (open returns nothing) the handler just runs", () => {
    const h = harness({ open: false });
    const res = new EventEmitter();
    h.mw(h.req(), res, h.next);
    assert.deepEqual(h.events, ["next"]);
    assert.equal(res.listenerCount("finish"), 0);
  });
});
