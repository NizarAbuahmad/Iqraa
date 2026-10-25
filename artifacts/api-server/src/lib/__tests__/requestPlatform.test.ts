import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type { Request, Response } from "express";

import { currentPlatform, platformContext } from "../requestPlatform.ts";

const run = (headers: Record<string, string>) =>
  new Promise<string | null>((resolve) => {
    platformContext({ headers } as unknown as Request, {} as Response, () => {
      // After an await, as a generator's `recordGeneration` is.
      void Promise.resolve().then(() => resolve(currentPlatform()));
    });
  });

describe("platformContext", () => {
  it("carries the client's platform to code that runs later in the request", async () => {
    assert.equal(await run({ "x-iqraa-platform": "web" }), "web");
    assert.equal(await run({ "x-iqraa-platform": "android" }), "android");
  });
  it("is null for no header, an unknown one, and outside a request", async () => {
    assert.equal(await run({}), null);
    assert.equal(await run({ "x-iqraa-platform": "tv" }), null);
    assert.equal(currentPlatform(), null);
  });
});
