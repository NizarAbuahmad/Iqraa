/**
 * Who may send an admin alert, and how often.
 *
 * Run:
 *   node --experimental-strip-types --test \
 *     artifacts/api-server/src/lib/__tests__/adminAlertGate.test.ts
 *
 * An AI outage fails every request, so an alert per failure would be hundreds
 * of mails. The count lives in `rate_limit_buckets` so every Cloud Run instance
 * shares it; this process also remembers its own decision so a stalled outage
 * does not cost a database round trip per request.
 */
import { beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { claimAlert, resetAlertGateForTests } from "../adminAlertGate.ts";

const HOUR = 60 * 60 * 1000;

/** A store that counts like the real one: first hit in a window is 1. */
function fakeStore() {
  const counts = new Map<string, number>();
  const calls: string[] = [];
  return {
    calls,
    store: {
      async hit(key: string, windowMs: number) {
        calls.push(key);
        const n = (counts.get(key) ?? 0) + 1;
        counts.set(key, n);
        return { count: n, resetAt: new Date(Date.now() + windowMs) };
      },
    },
  };
}

describe("claimAlert", () => {
  beforeEach(() => resetAlertGateForTests());

  it("lets the first caller in a window send, and nobody else", async () => {
    const { store } = fakeStore();
    assert.equal(await claimAlert("k", 6 * HOUR, { store }), true);
    assert.equal(await claimAlert("k", 6 * HOUR, { store }), false);
  });

  it("another instance (fresh memory, same store) is refused by the shared count", async () => {
    const { store } = fakeStore();
    assert.equal(await claimAlert("k", 6 * HOUR, { store }), true);
    resetAlertGateForTests(); // a different container: no local memory
    assert.equal(await claimAlert("k", 6 * HOUR, { store }), false);
  });

  it("different kinds do not share a window", async () => {
    const { store } = fakeStore();
    assert.equal(await claimAlert("a", HOUR, { store }), true);
    assert.equal(await claimAlert("b", HOUR, { store }), true);
  });

  it("a refused caller does not go back to the database until the window ends", async () => {
    const { store, calls } = fakeStore();
    await claimAlert("k", 6 * HOUR, { store });
    for (let i = 0; i < 50; i++) await claimAlert("k", 6 * HOUR, { store });
    assert.equal(calls.length, 1);
  });

  it("concurrent callers in one process produce one send", async () => {
    const { store } = fakeStore();
    const results = await Promise.all(Array.from({ length: 20 }, () => claimAlert("k", HOUR, { store })));
    assert.equal(results.filter(Boolean).length, 1);
  });

  it("sends again once the window has passed", async () => {
    const { store } = fakeStore();
    let now = 1_000_000;
    assert.equal(await claimAlert("k", HOUR, { store, now: () => now }), true);
    now += HOUR + 1;
    resetAlertGateForTests(); // and the shared row has expired, which the store decides
    const fresh = fakeStore();
    assert.equal(await claimAlert("k", HOUR, { store: fresh.store, now: () => now }), true);
  });

  it("when the store is down, falls back to once per window for this instance", async () => {
    const broken = {
      async hit(): Promise<never> {
        throw new Error("db down");
      },
    };
    assert.equal(await claimAlert("k", 6 * HOUR, { store: broken }), true);
    assert.equal(await claimAlert("k", 6 * HOUR, { store: broken }), false);
  });

  it("never throws", async () => {
    const broken = {
      async hit(): Promise<never> {
        throw new Error("db down");
      },
    };
    await assert.doesNotReject(() => claimAlert("k", HOUR, { store: broken }));
  });
});
