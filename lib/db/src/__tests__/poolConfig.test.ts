import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { isPooledConnectionString, poolOptions } from "../poolConfig.ts";

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

describe("isPooledConnectionString", () => {
  test("recognises Neon's pooled host, which has -pooler after the endpoint id", () => {
    assert.equal(isPooledConnectionString("postgresql://u:p@ep-cool-darkness-123456-pooler.eu-central-1.aws.neon.tech/db?sslmode=require"), true);
  });

  test("a direct Neon host is not pooled", () => {
    assert.equal(isPooledConnectionString("postgresql://u:p@ep-cool-darkness-123456.eu-central-1.aws.neon.tech/db?sslmode=require"), false);
  });

  test("looks only at the host, not a password, database name or path that happens to say -pooler", () => {
    assert.equal(isPooledConnectionString("postgresql://u:my-pooler-pass@ep-cool-123456.eu-central-1.aws.neon.tech/x-pooler"), false);
  });

  test("unset, empty or unparseable values are not pooled and never throw", () => {
    assert.equal(isPooledConnectionString(undefined), false);
    assert.equal(isPooledConnectionString(""), false);
    assert.equal(isPooledConnectionString("not a url"), false);
  });
});

