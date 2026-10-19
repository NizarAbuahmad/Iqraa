/**
 * What this guards: password hashing running OFF the main thread, without
 * changing what a hash is. bcryptjs is pure JavaScript; at cost 12 it is
 * ~0.35 s of CPU per call, and 100 simultaneous sign-ups used to stall every
 * request on the instance (a database-free /healthz took 35 s) because they
 * all queued behind it on the one event loop.
 *
 * Costs are 4 here so the suite is fast; the interop with plain bcryptjs is
 * what matters, since every existing user's stored hash was made by it.
 */
import { afterEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { monitorEventLoopDelay } from "node:perf_hooks";
import bcrypt from "bcryptjs";

import { createAdmission, createPasswordHasher } from "../passwordHash.ts";

const WORKER = new URL("../passwordHashWorker.ts", import.meta.url);

const made: ReturnType<typeof createPasswordHasher>[] = [];
function hasher(opts: Parameters<typeof createPasswordHasher>[0] = {}) {
  const h = createPasswordHasher({ workerUrl: WORKER, ...opts });
  made.push(h);
  return h;
}
afterEach(async () => {
  await Promise.all(made.splice(0).map((h) => h.close()));
});

describe("password hasher", () => {
  it("hashes and compares in a worker", async () => {
    const h = hasher();
    const hash = await h.hash("Correct-Horse-9", 4);
    assert.equal(await h.compare("Correct-Horse-9", hash), true);
    assert.equal(await h.compare("wrong", hash), false);
    assert.equal(h.status().degraded, false);
  });

  it("reads hashes plain bcryptjs wrote, and writes hashes it can read", async () => {
    const h = hasher();
    // Every stored password hash in production came from bcryptjs on the main thread.
    const legacy = bcrypt.hashSync("legacy-Pass-1", 4);
    assert.equal(await h.compare("legacy-Pass-1", legacy), true);
    assert.equal(await h.compare("nope", legacy), false);

    const fresh = await h.hash("fresh-Pass-2", 4);
    assert.match(fresh, /^\$2[aby]\$04\$/);
    assert.equal(bcrypt.compareSync("fresh-Pass-2", fresh), true);
  });

  it("answers false, as bcryptjs does, for a malformed stored hash", async () => {
    const h = hasher();
    assert.equal(await h.compare("whatever", "not-a-bcrypt-hash"), false);
  });

  it("rejects like bcryptjs does for arguments it cannot hash", async () => {
    const h = hasher();
    await assert.rejects(() => h.hash(undefined as unknown as string, 4));
    // and the worker is still usable afterwards
    assert.equal(await h.compare("x", await h.hash("x", 4)), true);
  });

  it("keeps the event loop free while many hashes run", async () => {
    const h = hasher({ workers: 1 });
    await h.hash("warm up the worker", 4);

    const lag = monitorEventLoopDelay({ resolution: 5 });
    lag.enable();
    // ~10 x 90 ms of CPU. On the main thread this is a ~1 s block with
    // gaps of >= 100 ms between turns; off it, the loop barely notices.
    const all = Array.from({ length: 10 }, (_, i) => h.hash(`password-number-${i}`, 10));
    await Promise.all(all);
    lag.disable();

    const maxMs = lag.max / 1e6;
    assert.ok(maxMs < 75, `event loop was blocked for ${maxMs.toFixed(0)} ms while hashing`);
  });

  it("serves a queue in order, one job per worker at a time", async () => {
    const h = hasher({ workers: 1 });
    const order: number[] = [];
    await Promise.all(
      [0, 1, 2, 3].map((i) => h.hash(`p${i}`, 4).then(() => order.push(i))),
    );
    assert.deepEqual(order, [0, 1, 2, 3]);
  });

  it("falls back to the main thread, loudly, if the worker cannot start", async () => {
    const h = hasher({ workerUrl: new URL("./does-not-exist.ts", import.meta.url) });
    const hash = await h.hash("still-works-1", 4);
    assert.equal(await h.compare("still-works-1", hash), true);
    assert.equal(bcrypt.compareSync("still-works-1", hash), true);
    const s = h.status();
    assert.equal(s.degraded, true, "a sign-in that works on the main thread must still be visible as degraded");
    assert.equal(s.workers, 0);
  });

  it("falls back for jobs already waiting when the worker dies", async () => {
    const h = hasher({ workerUrl: new URL("./does-not-exist.ts", import.meta.url) });
    const hashes = await Promise.all([1, 2, 3].map((i) => h.hash(`queued-${i}`, 4)));
    for (const [i, hash] of hashes.entries()) assert.equal(bcrypt.compareSync(`queued-${i + 1}`, hash), true);
  });
});

describe("admission", () => {
  function fakeRes() {
    const sent: { status?: number; headers: Record<string, string>; body?: unknown } = { headers: {} };
    const listeners = new Map<string, () => void>();
    const res: any = {
      setHeader: (k: string, v: string) => void (sent.headers[k] = v),
      status: (c: number) => ((sent.status = c), { json: (b: unknown) => void (sent.body = b) }),
      once: (ev: string, fn: () => void) => void listeners.set(ev, fn),
    };
    return { res, sent, emit: (ev: string) => listeners.get(ev)?.() };
  }

  it("admits up to the limit counting requests still in flight, then sheds with 503 + Retry-After", () => {
    const adm = createAdmission(3);
    const calls = Array.from({ length: 5 }, () => {
      const r = fakeRes();
      let admitted = false;
      adm.middleware({} as any, r.res, () => void (admitted = true));
      return { ...r, admitted };
    });
    // All five arrive before any has finished — the burst case a queue-depth check misses.
    assert.deepEqual(calls.map((c) => c.admitted), [true, true, true, false, false]);
    assert.equal(adm.active(), 3);
    const shed = calls[3]!.sent;
    assert.equal(shed.status, 503);
    assert.ok(Number(shed.headers["Retry-After"]) >= 1);
    assert.equal((shed.body as { code: string }).code, "hashing_busy");
  });

  it("frees a slot when a request finishes, or when the client hangs up first, and only once", () => {
    const adm = createAdmission(1);
    const a = fakeRes();
    adm.middleware({} as any, a.res, () => {});
    assert.equal(adm.active(), 1);
    a.emit("finish");
    a.emit("close"); // a finished request is also closed; must not double-release
    assert.equal(adm.active(), 0);

    const b = fakeRes();
    adm.middleware({} as any, b.res, () => {});
    b.emit("close"); // aborted before a response
    assert.equal(adm.active(), 0);
  });
});
