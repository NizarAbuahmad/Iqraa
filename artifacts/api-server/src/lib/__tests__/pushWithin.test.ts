import { test } from "node:test";
import assert from "node:assert/strict";

import { pushWithin } from "../pushWithin.ts";

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

test("waits for work that finishes inside the cap", async () => {
  let done = false;
  await pushWithin("t", async () => {
    await sleep(20);
    done = true;
  }, 500);
  assert.equal(done, true);
});

test("stops waiting at the cap, without cancelling the work", async () => {
  let done = false;
  const started = Date.now();
  await pushWithin("t", async () => {
    await sleep(300);
    done = true;
  }, 50);
  assert.ok(Date.now() - started < 250, "returned at the cap");
  assert.equal(done, false);
  await sleep(350);
  assert.equal(done, true, "the work kept running");
});

test("never throws, whether the work rejects or throws synchronously", async () => {
  await pushWithin("t", async () => {
    throw new Error("boom");
  }, 100);
  await pushWithin("t", () => {
    throw new Error("sync boom");
  }, 100);
});

test("a failure after the cap is not an unhandled rejection", async () => {
  // node:test fails the file on an unhandled rejection, so this test is the assertion.
  await pushWithin("t", async () => {
    await sleep(50);
    throw new Error("late");
  }, 10);
  await sleep(100);
});
