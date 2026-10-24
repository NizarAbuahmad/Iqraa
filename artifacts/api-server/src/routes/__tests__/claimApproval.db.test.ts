/**
 * A student who picks a name off the CLASS code waits for the teacher; every
 * other way of claiming is unchanged. Real database, real HTTP.
 *
 * Fixture (seedFamilyWorld): class c1 (teacher t1) holds Sara (sA1, already has a
 * student account) and Adam (aA, a guardian but no student account). Extra
 * unclaimed roster rows are made here, so each test names the row it uses.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

// 6 characters from the share-code alphabet (no I, L, O, 0, 1).
const CLASS_CODE = "HJKMNP";
const STUDENT_CODE = "QRSTUV";

describeDb("class-code claims wait for the teacher, over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let fresh = "";   // unclaimed row with its own per-student code
  let capRow = "";  // unclaimed row that already has the maximum waiting
  let redeemRow = ""; // unclaimed row used by the code-only signup

  const q = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;
  const newStudentUser = async (first: string) =>
    (await q(`INSERT INTO users (first_name, last_name, role) VALUES ($1, 'T', 'student') RETURNING id`, [first]))[0].id as string;
  const newRow = async (name: string) => {
    const id = (await q(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name]))[0].id as string;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  const requests = (studentId: string) =>
    q(`SELECT user_id FROM roster_link_requests WHERE student_id = $1 ORDER BY created_at`, [studentId]);
  const selfLinks = (studentId: string) =>
    q(`SELECT user_id FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [studentId]);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await q(
      `UPDATE class_groups SET join_code = $1, join_code_expires_at = now() + interval '30 days' WHERE id = $2`,
      [CLASS_CODE, w.classes.c1],
    );
    fresh = await newRow("ليان");
    await q(`UPDATE students SET claim_code = $1, claim_code_expires_at = now() + interval '30 days' WHERE id = $2`, [STUDENT_CODE, fresh]);
    capRow = await newRow("رنا");
    for (let i = 0; i < 5; i++) {
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [capRow, await newStudentUser(`cap${i}`)]);
    }
    redeemRow = await newRow("هديل");
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("an existing student account picking a name off the class list", () => {
    it("is held: 202, a request, no link", async () => {
      // An earlier pick on a different name — choosing again must replace it.
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [w.students.sA2, w.users.studentUnlinked]);

      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.aA });
      assert.equal(res.status, 202, on.logs().slice(-1500));
      assert.deepEqual(res.json, { pending: true, studentId: w.students.aA, studentName: "آدم" });
      assert.deepEqual((await requests(w.students.aA)).map(r => r.user_id), [w.users.studentUnlinked]);
      assert.deepEqual(await selfLinks(w.students.aA), []);
      assert.deepEqual(await requests(w.students.sA2), [], "the earlier pick is replaced, not kept");
    });

    it("has no access while it waits", async () => {
      const me = await call(on, "GET", "/auth/me", w.users.studentUnlinked);
      assert.equal(me.status, 200);
      assert.equal(me.json.hasRosterLink, false);
      const contacts = await call(on, "GET", "/messaging/contacts", w.users.studentUnlinked);
      assert.equal(contacts.status, 200);
      assert.equal(JSON.stringify(contacts.json).includes("Omar"), false, "the teacher must not be reachable");
    });

    it("lists the waiting claim next to its links", async () => {
      const res = await call(on, "GET", "/auth/claim", w.users.studentUnlinked);
      assert.equal(res.status, 200);
      assert.deepEqual(res.json.links, []);
      assert.deepEqual(res.json.pending, [{ studentId: w.students.aA, displayName: "آدم" }]);
    });

    it("asking twice is the same request, not a second one", async () => {
      const again = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.aA });
      assert.equal(again.status, 202);
      assert.equal((await requests(w.students.aA)).length, 1);
    });

    it("is refused when five others already wait on that name, and keeps its own earlier request", async () => {
      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: capRow });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_pending_limit");
      assert.equal((await requests(capRow)).length, 5);
      assert.equal((await requests(w.students.aA)).length, 1, "a refused pick must not cost the account its earlier request");
    });

    it("is still refused a name that already has a student account", async () => {
      const res = await call(on, "POST", "/auth/claim", w.users.studentUnlinked, { claimCode: CLASS_CODE, studentId: w.students.sA1 });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_already_linked");
    });

    it("can withdraw: DELETE /auth/claim removes the waiting request", async () => {
      const res = await call(on, "DELETE", "/auth/claim", w.users.studentUnlinked);
      assert.equal(res.status, 200);
      assert.deepEqual(await requests(w.students.aA), []);
    });
  });

  describe("the claims that are NOT held", () => {
    it("a student with the code the teacher wrote for them links at once", async () => {
      const id = await newStudentUser("perStudent");
      const res = await call(on, "POST", "/auth/claim", id, { claimCode: STUDENT_CODE });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.deepEqual(res.json, { studentId: fresh, relation: "self" });
      assert.equal((await selfLinks(fresh)).length, 1);
      assert.deepEqual(await requests(fresh), []);
    });

    it("a parent picking a name off the class list links at once", async () => {
      const row = await newRow("سلمى");
      const res = await call(on, "POST", "/auth/claim", w.users.parentB, { claimCode: CLASS_CODE, studentId: row });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.equal(res.json.relation, "guardian");
      assert.deepEqual(await requests(row), []);
    });
  });

  describe("code-only signup (POST /auth/redeem)", () => {
    it("creates the account and holds the claim: tokens and login code as today, but no link", async () => {
      const res = await call(on, "POST", "/auth/redeem", undefined, {
        role: "student",
        claimCode: CLASS_CODE,
        studentId: redeemRow,
        acceptedTerms: true,
      });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.equal(res.json.pending, true);
      assert.equal(res.json.studentName, "هديل");
      assert.equal(res.json.user.hasRosterLink, false);
      assert.equal(typeof res.json.loginCode, "string");
      assert.ok(res.json.accessToken);
      const userId = res.json.user.id as string;
      assert.deepEqual((await requests(redeemRow)).map(r => r.user_id), [userId]);
      assert.deepEqual(await selfLinks(redeemRow), []);
    });
  });
});
