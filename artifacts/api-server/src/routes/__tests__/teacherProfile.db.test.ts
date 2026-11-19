/**
 * The optional teacher profile through PATCH /auth/users/profile and GET /auth/me.
 *
 * What this guards: a teacher saves and clears the four fields, and both responses carry them as
 * `teacherProfile`; an unknown value is a 400 and saves nothing; a student or parent account may
 * not set them at all (they may be minors) — a 403 that saves nothing; and the update can carry
 * the profile alone, with no other field.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

describeDb("teacher profile", () => {
  let db: TestDb;
  let server: TestServer;
  let teacherId: string;
  let studentId: string;
  let parentId: string;

  const addUser = async (name: string, role: string): Promise<string> =>
    (
      await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified)
         VALUES ($1, 'Test', $2, $3, true) RETURNING id`,
        [name, role, `${name.toLowerCase()}@example.test`],
      )
    ).rows[0]!.id;
  const stored = async (id: string) =>
    (
      await db.pool.query(`SELECT gender, age_range, governorate, years_teaching FROM users WHERE id = $1`, [id])
    ).rows[0];

  before(async () => {
    db = await setupTestDb();
    server = await startServer({ databaseUrl: db.url });
    teacherId = await addUser("Rana", "teacher");
    studentId = await addUser("Omar", "student");
    parentId = await addUser("Lina", "parent");
  });

  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("starts unanswered on /auth/me", async () => {
    const res = await call(server, "GET", "/auth/me", teacherId);
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.json.teacherProfile, { gender: null, ageRange: null, governorate: null, yearsTeaching: null });
  });

  it("saves a teacher's answers on their own and echoes them", async () => {
    const res = await call(server, "PATCH", "/auth/users/profile", teacherId, {
      teacherProfile: { gender: "female", ageRange: "30-39", governorate: "irbid", yearsTeaching: "6-10" },
    });
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(res.json.teacherProfile, {
      gender: "female",
      ageRange: "30-39",
      governorate: "irbid",
      yearsTeaching: "6-10",
    });
    assert.deepEqual(await stored(teacherId), {
      gender: "female",
      age_range: "30-39",
      governorate: "irbid",
      years_teaching: "6-10",
    });
    const me = await call(server, "GET", "/auth/me", teacherId);
    assert.equal(me.json.teacherProfile.governorate, "irbid");
  });

  it("clears one field with null and leaves the others", async () => {
    const res = await call(server, "PATCH", "/auth/users/profile", teacherId, { teacherProfile: { gender: null } });
    assert.equal(res.status, 200, res.text);
    assert.equal((await stored(teacherId)).gender, null);
    assert.equal((await stored(teacherId)).age_range, "30-39");
  });

  it("refuses an unknown value and saves nothing", async () => {
    const res = await call(server, "PATCH", "/auth/users/profile", teacherId, {
      firstName: "Changed",
      teacherProfile: { governorate: "Damascus" },
    });
    assert.equal(res.status, 400);
    const row = await db.pool.query(`SELECT first_name FROM users WHERE id = $1`, [teacherId]);
    assert.equal(row.rows[0].first_name, "Rana");
  });

  it("drops the answers when a new teacher switches to a parent account", async () => {
    const switcher = await addUser("Sami", "teacher");
    await db.pool.query(`UPDATE users SET gender = 'male', governorate = 'aqaba' WHERE id = $1`, [switcher]);
    const res = await call(server, "POST", "/auth/role", switcher, { role: "parent" });
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(await stored(switcher), { gender: null, age_range: null, governorate: null, years_teaching: null });
  });

  it("refuses the profile from a student or a parent", async () => {
    for (const id of [studentId, parentId]) {
      const res = await call(server, "PATCH", "/auth/users/profile", id, { teacherProfile: { gender: "male" } });
      assert.equal(res.status, 403, res.text);
      assert.equal((await stored(id)).gender, null);
    }
  });
});
