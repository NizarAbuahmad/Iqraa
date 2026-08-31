/**
 * Thirty teachers in one training session all request the same lesson within a
 * few seconds. Every one of them misses the pool, because none has written
 * back yet. Without this, that is thirty completions for one artifact — the
 * exact scenario the caching plan exists for, failing at the one moment it is
 * most needed.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SingleFlight } from "../singleFlight.ts";

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("SingleFlight", () => {
  it("runs one call for many simultaneous askers, and gives them all the answer", async () => {
    const flight = new SingleFlight<string>();
    const gate = deferred<string>();
    let calls = 0;

    const askers = Array.from({ length: 30 }, () =>
      flight.run("lesson-key", () => { calls++; return gate.promise; }));

    gate.resolve("one worksheet");
    const results = await Promise.all(askers);
    assert.equal(calls, 1);
    assert.deepEqual(new Set(results), new Set(["one worksheet"]));
  });

  it("keeps different keys apart", async () => {
    const flight = new SingleFlight<string>();
    const [a, b] = await Promise.all([
      flight.run("quiz", async () => "quiz"),
      flight.run("worksheet", async () => "worksheet"),
    ]);
    assert.equal(a, "quiz");
    assert.equal(b, "worksheet");
  });

  it("does not hand a failed generation to the next thirty callers", async () => {
    const flight = new SingleFlight<string>();
    await assert.rejects(flight.run("k", async () => { throw new Error("upstream 502"); }));
    assert.equal(flight.size, 0);
    assert.equal(await flight.run("k", async () => "retried"), "retried");
  });

  it("clears the key even when `fn` throws synchronously", async () => {
    const flight = new SingleFlight<string>();
    await assert.rejects(flight.run("k", () => { throw new Error("sync"); }));
    assert.equal(flight.size, 0);
  });

  it("shares the rejection with everyone who joined the flight", async () => {
    const flight = new SingleFlight<string>();
    const gate = deferred<string>();
    const joiners = [flight.run("k", () => gate.promise), flight.run("k", () => gate.promise)];
    gate.reject(new Error("upstream 502"));
    const settled = await Promise.allSettled(joiners);
    assert.deepEqual(settled.map((s) => s.status), ["rejected", "rejected"]);
  });
});
