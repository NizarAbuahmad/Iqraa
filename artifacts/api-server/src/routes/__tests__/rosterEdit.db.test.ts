/**
 * Editing a roster row over HTTP, against a real database: the duplicate-name
 * refusal and the rename reaching linked code-only accounts. The class roster
 * read (`links`) is covered here too, since it shares the fixture.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("editing a roster row over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let parentC = "";

  const user = async (sql: string, params: unknown[]) => (await db.pool.query(sql, params)).rows[0];
  const names = async (userId: string) =>
    user(`SELECT first_name, last_name FROM users WHERE id = $1`, [userId]);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    // Roster writes are gated on the teacher's consent attestation.
    await db.pool.query(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [
      [w.users.t1, w.users.t2],
    ]);
    // Sara's accounts as a code-only sign-up would have made them: named from the roster row.
    await db.pool.query(
      `UPDATE users SET login_code_hash = 'h-student', first_name = 'سارة', last_name = '' WHERE id = $1`,
      [w.users.studentA],
    );
    await db.pool.query(
      `UPDATE users SET login_code_hash = 'h-parent', first_name = 'ولي أمر', last_name = 'سارة' WHERE id = $1`,
      [w.users.parentA],
    );
    // A second guardian who has since chosen their own name.
    parentC = (
      await user(
        `INSERT INTO users (first_name, last_name, role, login_code_hash) VALUES ('أم', 'سارة', 'parent', 'h-parent-c') RETURNING id`,
        [],
      )
    ).id;
    await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [
      w.students.sA1,
      parentC,
    ]);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("GET /classes/:id", () => {
    it("lists who holds each name, with the account's name and when it joined", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      const sara = res.json.students.find((s: { id: string }) => s.id === w.students.sA1);
      assert.equal(sara.linked, true);
      const self = sara.links.find((l: { relation: string }) => l.relation === "self");
      assert.equal(self.userId, w.users.studentA);
      assert.equal(self.firstName, "سارة");
      assert.ok(self.linkedAt);
      assert.equal(sara.links.filter((l: { relation: string }) => l.relation === "guardian").length, 2);
      assert.equal("linkedCount" in sara, false);
    });

    it("is another teacher's class: 404", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}`, w.users.t2);
      assert.equal(res.status, 404);
    });
  });

  describe("PATCH /students/:id", () => {
    it("renames, and re-derives linked code-only accounts that still carry the old name", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "سارة أحمد" });
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.equal(res.json.student.displayName, "سارة أحمد");
      assert.deepEqual(await names(w.users.studentA), { first_name: "سارة", last_name: "أحمد" });
      assert.deepEqual(await names(w.users.parentA), { first_name: "ولي أمر", last_name: "سارة أحمد" });
    });

    it("leaves an account whose owner chose their own name alone", async () => {
      assert.deepEqual(await names(parentC), { first_name: "أم", last_name: "سارة" });
    });

    it("refuses a name already used by another student in the same class, however it is spaced", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.aA}`, w.users.t1, { displayName: "سارة   أحمد" });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "student_name_taken");
      const row = await user(`SELECT display_name FROM students WHERE id = $1`, [w.students.aA]);
      assert.equal(row.display_name, "آدم");
    });

    it("allows the same name in another teacher's roster", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA2}`, w.users.t2, { displayName: "سارة أحمد" });
      assert.equal(res.status, 200);
    });

    it("allows keeping a student's own name (only the spacing changes)", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "سارة  أحمد" });
      assert.equal(res.status, 200);
    });

    it("is another teacher's student: 404, and nothing changes", async () => {
      const before = await user(`SELECT display_name FROM students WHERE id = $1`, [w.students.sA1]);
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t2, { displayName: "x" });
      assert.equal(res.status, 404);
      const after = await user(`SELECT display_name FROM students WHERE id = $1`, [w.students.sA1]);
      assert.equal(after.display_name, before.display_name);
    });

    it("still refuses an empty name", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayName: "   " });
      assert.equal(res.status, 400);
    });
  });

  describe("PATCH /students/:id — the Arabic name", () => {
    const arabicName = async (id: string) =>
      (await user(`SELECT display_name, display_name_ar FROM students WHERE id = $1`, [id]));

    it("starts empty: 'not recorded', never null", async () => {
      const row = await arabicName(w.students.sA1);
      assert.equal(row.display_name_ar, "");
    });

    it("saves it, tidied, and leaves the roster name alone", async () => {
      const before = await arabicName(w.students.sA1);
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayNameAr: "  أحمد   علي " });
      assert.equal(res.status, 200);
      assert.equal(res.json.student.displayNameAr, "أحمد علي");
      const after = await arabicName(w.students.sA1);
      assert.equal(after.display_name_ar, "أحمد علي");
      assert.equal(after.display_name, before.display_name);
    });

    it("comes back on the class roster read", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}`, w.users.t1);
      assert.equal(res.status, 200);
      const row = res.json.students.find((s: { id: string }) => s.id === w.students.sA1);
      assert.equal(row?.displayNameAr, "أحمد علي");
    });

    it("refuses a Latin name and keeps what was there", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayNameAr: "ahmad" });
      assert.equal(res.status, 400);
      assert.equal(res.json.code, "student_name_ar_invalid");
      assert.equal((await arabicName(w.students.sA1)).display_name_ar, "أحمد علي");
    });

    it("an empty value clears it", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t1, { displayNameAr: "" });
      assert.equal(res.status, 200);
      assert.equal((await arabicName(w.students.sA1)).display_name_ar, "");
    });

    it("is another teacher's student: 404, and nothing changes", async () => {
      const res = await call(on, "PATCH", `/students/${w.students.sA1}`, w.users.t2, { displayNameAr: "خالد" });
      assert.equal(res.status, 404);
      assert.equal((await arabicName(w.students.sA1)).display_name_ar, "");
    });
  });
});
