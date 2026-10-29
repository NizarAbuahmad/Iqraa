/**
 * POST /admin/users/:id/password, against a real database through the built bundle.
 *
 * What this guards: a password that is not a string is refused before anything is read or changed. The policy check
 * (lib/passwordPolicy.ts) turns its argument into a string, so an array holding a strong password passed it, its
 * length (1) passed the 128-character cap, and the request then failed inside the hasher as a 500, after the
 * account lookup. The same hole was closed on /auth/reset-password; this route had the same shape.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { PASSWORD_POLICY_MESSAGE } from "../../lib/passwordPolicy.ts";

const STRONG = "Str0ngPassw0rd!x";
const ORIGINAL_HASH = "original-hash-that-is-not-a-real-bcrypt-hash";

describeDb("an admin setting a user's password", () => {
  let db: TestDb;
  let server: TestServer;
  let adminId: string;
  let targetId: string;

  const hashOf = async (id: string) =>
    (await db.pool.query<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = $1", [id])).rows[0]!
      .password_hash;

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    adminId = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified)
         VALUES ('Ada', 'Admin', 'system_admin', 'admin@example.test', true) RETURNING id`,
      )
    ).rows[0]!.id;
    targetId = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified, password_hash)
         VALUES ('Tala', 'Teacher', 'teacher', 'teacher@example.test', true, $1) RETURNING id`,
        [ORIGINAL_HASH],
      )
    ).rows[0]!.id;
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  // These run before the control below, which is the one test that changes the stored hash.
  const refused: [label: string, password: unknown][] = [
    ["an array holding a strong password", [STRONG]],
    ["a nested array holding a strong password", [[STRONG]]],
    // An object and a number already failed the policy's letter-and-digit test once turned into a string.
    ["an object", { a: STRONG }],
    ["a number", 12345678],
  ];
  for (const [label, password] of refused) {
    it(`refuses ${label} and changes nothing`, async () => {
      const res = await call(server, "POST", `/admin/users/${targetId}/password`, adminId, { password });
      assert.equal(res.status, 400, res.text);
      assert.equal(res.json.error, PASSWORD_POLICY_MESSAGE);
      assert.equal(await hashOf(targetId), ORIGINAL_HASH);
    });
  }

  it("still sets a string password", async () => {
    const res = await call(server, "POST", `/admin/users/${targetId}/password`, adminId, { password: STRONG });
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.ok, true);
    assert.equal(res.json.userId, targetId);
    const hash = await hashOf(targetId);
    assert.notEqual(hash, ORIGINAL_HASH);
    assert.match(hash, /^\$2[aby]\$/);
  });
});
