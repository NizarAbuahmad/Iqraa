import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { describe, test } from "node:test";
import { asUser, currentIdentity } from "../identity.ts";

describe("request identity", () => {
  test("is undefined outside a request", () => {
    assert.equal(currentIdentity(), undefined);
  });

  test("is visible to everything the request awaits", async () => {
    const userId = randomUUID();
    await asUser({ userId, role: "teacher" }, async () => {
      await new Promise(r => setTimeout(r, 5));
      assert.deepEqual(currentIdentity(), { userId, role: "teacher" });
      await Promise.all([1, 2, 3].map(async () => assert.equal(currentIdentity()?.userId, userId)));
    });
    assert.equal(currentIdentity(), undefined);
  });

  test("concurrent requests never see each other's identity", async () => {
    const ids = Array.from({ length: 20 }, () => randomUUID());
    const seen = await Promise.all(
      ids.map(userId =>
        asUser({ userId, role: "parent" }, async () => {
          await new Promise(r => setTimeout(r, Math.random() * 10));
          return currentIdentity()?.userId;
        }),
      ),
    );
    assert.deepEqual(seen, ids);
  });

  test("lowercases the id so it matches how Postgres prints a uuid", () => {
    const userId = randomUUID().toUpperCase();
    asUser({ userId, role: "teacher" }, () => assert.equal(currentIdentity()?.userId, userId.toLowerCase()));
  });

  // ScopedPool writes both fields into a multi-statement simple query, where bind
  // parameters are unavailable — these checks are what make that safe.
  test("refuses anything that is not a uuid", () => {
    for (const userId of ["", "not-a-uuid", `${randomUUID()}'; DROP TABLE students; --`, `${randomUUID()} `]) {
      assert.throws(() => asUser({ userId, role: "teacher" }, () => 0), /uuid/);
    }
  });

  test("refuses a role that is not lower_snake_case", () => {
    for (const role of ["", "Teacher", "teacher'; --", "a".repeat(33), "role with space"]) {
      assert.throws(() => asUser({ userId: randomUUID(), role }, () => 0), /role/);
    }
  });
});
