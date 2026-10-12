/**
 * What this guards: an account's three school-notification switches. The ways
 * it goes wrong: a fresh account reading as "off", one switch overwriting
 * another, a garbage value being stored, and one account's choice touching
 * another's. Any role may hold them (a teacher simply receives none of these).
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

const PATH = "/auth/me/push-preferences";
const ALL_ON = { homework: true, exams: true, results: true };

describeDb("push preferences over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  const stored = async (userId: string) =>
    (await db.pool.query<{ p: unknown }>(`SELECT push_prefs AS p FROM users WHERE id = $1`, [userId])).rows[0]?.p;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    server = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("reads every switch as on for an account that never chose", async () => {
    const r = await call(server, "GET", PATH, w.users.parentA);
    assert.equal(r.status, 200, server.logs().slice(-1500));
    assert.deepEqual(r.json, { preferences: ALL_ON });
  });

  it("turns one switch off, keeps the others, and stores only the choice", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { homework: false });
    assert.equal(r.status, 200, r.text);
    assert.deepEqual(r.json, { preferences: { ...ALL_ON, homework: false } });
    assert.deepEqual(await stored(w.users.parentA), { homework: false });
    assert.deepEqual((await call(server, "GET", PATH, w.users.parentA)).json, { preferences: { ...ALL_ON, homework: false } });
  });

  it("merges a second change instead of overwriting the first", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { results: false });
    assert.deepEqual(r.json, { preferences: { homework: false, exams: true, results: false } });
    assert.deepEqual(await stored(w.users.parentA), { homework: false, results: false });
  });

  it("turns a switch back on", async () => {
    const r = await call(server, "PUT", PATH, w.users.parentA, { homework: true });
    assert.deepEqual(r.json, { preferences: { homework: true, exams: true, results: false } });
  });

  it("works for a student and a teacher too, and never touches another account", async () => {
    assert.equal((await call(server, "PUT", PATH, w.users.studentA, { exams: false })).status, 200);
    assert.deepEqual((await call(server, "GET", PATH, w.users.t1)).json, { preferences: ALL_ON });
    assert.deepEqual((await call(server, "GET", PATH, w.users.parentB)).json, { preferences: ALL_ON });
    assert.deepEqual(await stored(w.users.parentB), {});
  });

  it("refuses a body that changes nothing or is not true/false, and stores nothing", async () => {
    const before = await stored(w.users.parentB);
    for (const body of [{}, { homework: "off" }, { chat: false }, []]) {
      const r = await call(server, "PUT", PATH, w.users.parentB, body);
      assert.equal(r.status, 400, JSON.stringify(body));
      assert.equal(r.json.code, "invalid_input");
    }
    assert.deepEqual(await stored(w.users.parentB), before);
  });

  it("needs a token", async () => {
    assert.equal((await call(server, "GET", PATH)).status, 401);
    assert.equal((await call(server, "PUT", PATH, undefined, { homework: false })).status, 401);
  });
});
