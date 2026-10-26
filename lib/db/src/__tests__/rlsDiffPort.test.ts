import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { rlsDiffPort } from "../testing/ports.ts";

/**
 * rlsDiff boots the API twice at once, enforcement off and on, and tells them apart only by port. When both
 * picked the same one the second failed to bind, the first answered the health check for both, and the suite
 * compared a server with itself: three tests failed in a way that read as an RLS regression. This needs no
 * database, so it runs in the ordinary `Test db` step as well as the row-level security job.
 */
describe("rlsDiffPort", () => {
  const draws = [0, 0.000001, 0.25, 0.5, 0.75, 0.999999];

  test("the off and on servers never get the same port, whatever the two draws are", () => {
    for (const a of draws) {
      for (const b of draws) {
        assert.notEqual(rlsDiffPort("off", () => a), rlsDiffPort("on", () => b), `draws ${a} and ${b} collided`);
      }
    }
  });

  test("a server's port still follows its draw, so two runs on one machine rarely meet", () => {
    for (const mode of ["off", "on"] as const) {
      const ports = new Set(draws.map(d => rlsDiffPort(mode, () => d)));
      assert.ok(ports.size > 1, `${mode} ignored its draw`);
      for (const port of ports) assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535, `${mode} port ${port}`);
    }
  });
});
