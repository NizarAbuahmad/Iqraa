import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { poolOptions } from "../poolConfig.ts";

describe("poolOptions", () => {
  test("defaults keep pg's pool size but stop waiting forever for a connection", () => {
    assert.deepEqual(poolOptions({}), { max: 10, connectionTimeoutMillis: 10_000 });
  });

  test("DB_POOL_MAX and DB_CONNECT_TIMEOUT_MS override", () => {
    assert.deepEqual(poolOptions({ DB_POOL_MAX: "4", DB_CONNECT_TIMEOUT_MS: "3000" }), {
      max: 4,
      connectionTimeoutMillis: 3000,
    });
  });

  test("the system pool has its own size, falling back to the main one", () => {
    assert.equal(poolOptions({ DB_POOL_MAX: "8" }, "system").max, 8);
    assert.equal(poolOptions({ DB_POOL_MAX: "8", DB_SYSTEM_POOL_MAX: "3" }, "system").max, 3);
    assert.equal(poolOptions({ DB_POOL_MAX: "8", DB_SYSTEM_POOL_MAX: "3" }).max, 8);
  });

  test("a value that is not a sane integer falls back instead of reaching pg", () => {
    // pg treats max: 0 as "no pool limit" and a timeout of 0 as "wait forever" —
    // the two settings this exists to prevent.
    for (const bad of ["0", "-1", "abc", "", "1.5", "NaN", "101"]) {
      assert.equal(poolOptions({ DB_POOL_MAX: bad }).max, 10, `DB_POOL_MAX=${bad}`);
    }
    for (const bad of ["0", "-5", "abc", "", "999", "70000"]) {
      assert.equal(poolOptions({ DB_CONNECT_TIMEOUT_MS: bad }).connectionTimeoutMillis, 10_000, `DB_CONNECT_TIMEOUT_MS=${bad}`);
    }
  });
});
