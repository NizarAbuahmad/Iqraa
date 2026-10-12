/**
 * What this guards: the DB-backed tests create and DROP databases, so the rules
 * that keep them away from anything real are pure, tested, and strict — a remote
 * host, an odd database name, or a missing URL must never reach a CREATE/DROP.
 * The skip/require rule also lives here: CI sets REQUIRE_DB_TESTS so a pipeline
 * with no database fails instead of silently skipping (the mount-order trap).
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  TEST_DB_PREFIX,
  assertSafeAdminUrl,
  dbTestsRequired,
  dbTestsSkipReason,
  isTestDbName,
  newTestDbName,
  urlForDatabase,
} from "../testDbRules.ts";

describe("assertSafeAdminUrl", () => {
  it("accepts a local server", () => {
    for (const raw of [
      "postgres://postgres:postgres@localhost:5432/postgres",
      "postgres://postgres@127.0.0.1:55432/postgres",
      "postgresql://u@[::1]:5432/postgres",
    ]) {
      assert.ok(assertSafeAdminUrl(raw, {}) instanceof URL, raw);
    }
  });

  it("refuses a remote host", () => {
    assert.throws(
      () => assertSafeAdminUrl("postgres://u:p@db.example.com:5432/postgres", {}),
      /non-local host db\.example\.com/,
    );
  });

  it("allows a remote host only with the explicit override", () => {
    assert.doesNotThrow(() =>
      assertSafeAdminUrl("postgres://u:p@db.example.com/postgres", { ALLOW_REMOTE_TEST_DB: "1" }),
    );
  });

  it("refuses other schemes and things that are not URLs", () => {
    assert.throws(() => assertSafeAdminUrl("mysql://u@localhost/x", {}), /postgres/);
    assert.throws(() => assertSafeAdminUrl("not a url", {}), /valid URL/);
  });

  it("refuses query parameters that override the host (pg honours ?host= and ?hostaddr=)", () => {
    for (const raw of [
      "postgres://localhost/postgres?host=evil.com",
      "postgres://localhost/postgres?hostaddr=10.0.0.5",
      "postgres://u:p@localhost/db?host=/cloudsql/proj:region:inst",
    ]) {
      assert.throws(() => assertSafeAdminUrl(raw, {}), /query parameters/, raw);
    }
  });

  it("allows query parameters only with the explicit override", () => {
    assert.doesNotThrow(() =>
      assertSafeAdminUrl("postgres://localhost/postgres?host=evil.com", { ALLOW_REMOTE_TEST_DB: "1" }),
    );
  });

  it("refuses host tricks that only look local", () => {
    for (const raw of [
      "postgres://localhost.evil.com/x",
      "postgres://localhost@evil.com/x",
      "postgres://localhost.:5432/x",
      "postgres://LOCALHOST/x",
    ]) {
      assert.throws(() => assertSafeAdminUrl(raw, {}), /non-local host/, raw);
    }
  });

  it("still accepts plain local URLs, including the expanded IPv6 loopback", () => {
    for (const raw of [
      "postgres://localhost/postgres",
      "postgres://postgres@[0:0:0:0:0:0:0:1]:5432/postgres",
    ]) {
      assert.ok(assertSafeAdminUrl(raw, {}) instanceof URL, raw);
    }
  });
});

describe("test database names", () => {
  it("generates names the drop rule accepts", () => {
    const name = newTestDbName();
    assert.ok(name.startsWith(TEST_DB_PREFIX));
    assert.ok(isTestDbName(name), name);
  });

  it("uses the injected randomness", () => {
    assert.equal(newTestDbName(() => "0123456789ab"), "iqraa_test_0123456789ab");
  });

  it("refuses to treat anything else as a test database", () => {
    for (const name of [
      "postgres",
      "iqraa",
      "iqraa_test_",
      "iqraa_test_xyz",
      "iqraa_test_0123456789ab; DROP DATABASE postgres",
      "IQRAA_TEST_0123456789ab",
      "iqraa_test_0123456789abc",
      "iqraa_test_0123456789AB",
      "iqraa_test_0123456789ab\n",
    ]) {
      assert.equal(isTestDbName(name), false, name);
    }
  });
});

describe("urlForDatabase", () => {
  it("swaps only the database name", () => {
    const admin = new URL("postgres://postgres:secret@127.0.0.1:55432/postgres");
    assert.equal(
      urlForDatabase(admin, "iqraa_test_0123456789ab"),
      "postgres://postgres:secret@127.0.0.1:55432/iqraa_test_0123456789ab",
    );
  });
});

describe("dbTestsSkipReason / dbTestsRequired", () => {
  it("skips, with a pointer, when no database is configured", () => {
    assert.match(dbTestsSkipReason({}, true) ?? "", /TEST_DATABASE_URL/);
  });

  it("skips, with a pointer, when the bundle is not built", () => {
    assert.match(
      dbTestsSkipReason({ TEST_DATABASE_URL: "postgres://u@localhost/postgres" }, false) ?? "",
      /pnpm build/,
    );
  });

  it("runs when both are present", () => {
    assert.equal(dbTestsSkipReason({ TEST_DATABASE_URL: "postgres://u@localhost/postgres" }, true), null);
  });

  it("is required only when REQUIRE_DB_TESTS is exactly 'true'", () => {
    assert.equal(dbTestsRequired({ REQUIRE_DB_TESTS: "true" }), true);
    for (const v of [undefined, "", "1", "TRUE", "false"]) {
      assert.equal(dbTestsRequired({ REQUIRE_DB_TESTS: v }), false, String(v));
    }
  });
});
