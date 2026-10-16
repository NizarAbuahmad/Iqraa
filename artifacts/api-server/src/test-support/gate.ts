/**
 * `describeDb` is `describe` for tests that need a real database: it skips with
 * a pointer when none is configured — unless REQUIRE_DB_TESTS=true (CI), where
 * the missing database is itself a failing test. A pipeline that loses its
 * Postgres service must go red, not quietly stop testing access control.
 */
import { existsSync } from "node:fs";
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { bundleEntry } from "./env.ts";
import { dbTestsRequired, dbTestsSkipReason } from "./testDbRules.ts";

export function describeDb(name: string, fn: () => void): void {
  const reason = dbTestsSkipReason(process.env, existsSync(bundleEntry));
  if (reason && dbTestsRequired()) {
    describe(name, () => {
      it("DB-backed tests are required in this environment", () => {
        assert.fail(reason);
      });
    });
    return;
  }
  describe(name, { skip: reason ?? false }, fn);
}
