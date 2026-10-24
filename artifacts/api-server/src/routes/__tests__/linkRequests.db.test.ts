/**
 * The teacher's side of class-code claims: see who is waiting, approve one,
 * reject one. Real database, real HTTP. Requests are inserted directly — how
 * they get made is claimApproval.db.test.ts.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("a teacher approves or rejects a student's class-code claim, over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let u1 = "";
  let u2 = "";
  let u3 = "";
  let rowRejected = "";
  let rowStale = "";

  const q = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;
  const newUser = async (first: string, role = "student") =>
    (await q(`INSERT INTO users (first_name, last_name, role) VALUES ($1, 'T', $2) RETURNING id`, [first, role]))[0].id as string;
  const newRow = async (name: string) => {
    const id = (await q(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name]))[0].id as string;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  const ask = async (studentId: string, userId: string) =>
    (await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self') RETURNING id`, [studentId, userId]))[0].id as string;
  const requestsOf = (studentId: string) => q(`SELECT user_id FROM roster_link_requests WHERE student_id = $1`, [studentId]);
  const selfLinks = (studentId: string) => q(`SELECT user_id FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [studentId]);

  let r1 = "";
  let r2 = "";

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await q(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [[w.users.t1, w.users.t2]]);
    u1 = w.users.studentUnlinked;
    u2 = await newUser("Two");
    u3 = await newUser("Three");
    r1 = await ask(w.students.aA, u1);      // Adam: two accounts want him
    r2 = await ask(w.students.aA, u2);
    await ask(w.students.sA1, u3);          // Sara already has a student account: must not be listed
    await ask(w.students.aA, w.users.parentB); // a parent account is never a student claim: must not be listed
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("GET /classes/:id/link-requests", () => {
    it("lists the accounts waiting on this class's names, oldest first, with who they are", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      const rows = res.json.requests as { id: string; studentId: string; studentName: string; userId: string; firstName: string }[];
      assert.deepEqual(rows.map(r => r.id), [r1, r2]);
      assert.equal(rows[0]!.studentId, w.students.aA);
      assert.equal(rows[0]!.studentName, "آدم");
      assert.equal(rows[0]!.userId, u1);
      assert.equal(rows[1]!.firstName, "Two");
    });

    it("is another teacher's class: 404", async () => {
      const res = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t2);
      assert.equal(res.status, 404);
    });
  });

  describe("approve", () => {
    it("another teacher cannot: 404, and nothing changes", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r1}/approve`, w.users.t2);
      assert.equal(res.status, 404);
      assert.deepEqual(await selfLinks(w.students.aA), []);
      assert.equal((await requestsOf(w.students.aA)).length, 3);
    });

    it("links the account as the student's own, and clears every other request on that name", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r1}/approve`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.deepEqual(res.json, { approved: r1, studentId: w.students.aA, userId: u1 });
      assert.deepEqual((await selfLinks(w.students.aA)).map(r => r.user_id), [u1]);
      assert.deepEqual(await requestsOf(w.students.aA), []);
    });

    it("the approved account now counts as linked", async () => {
      const me = await call(on, "GET", "/auth/me", u1);
      assert.equal(me.json.hasRosterLink, true);
    });

    it("approving a request that is gone: 404", async () => {
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${r2}/approve`, w.users.t1);
      assert.equal(res.status, 404);
    });

    it("a name that already has a student account cannot be approved again: 409, no second link", async () => {
      const late = await ask(w.students.aA, u3);
      const res = await call(on, "POST", `/students/${w.students.aA}/link-requests/${late}/approve`, w.users.t1);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_already_linked");
      assert.equal((await selfLinks(w.students.aA)).length, 1);
      assert.deepEqual(await requestsOf(w.students.aA), [], "the request is cleared, not left hidden");
    });

    it("a request for a name that is no longer in any of the teacher's classes cannot be actioned by id: 404", async () => {
      const row = await newRow("ريم");
      const id = await ask(row, await newUser("Gone"));
      await q(`DELETE FROM class_memberships WHERE student_id = $1`, [row]);
      const res = await call(on, "POST", `/students/${row}/link-requests/${id}/approve`, w.users.t1);
      assert.equal(res.status, 404);
      assert.deepEqual(await selfLinks(row), []);
    });

    it("a request whose sender is no longer a student account is dropped, not linked: 409 claim_request_stale", async () => {
      rowStale = await newRow("نور");
      const switched = await newUser("Switched", "teacher");
      const id = await ask(rowStale, switched);
      const res = await call(on, "POST", `/students/${rowStale}/link-requests/${id}/approve`, w.users.t1);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_request_stale");
      assert.deepEqual(await selfLinks(rowStale), []);
      assert.deepEqual(await requestsOf(rowStale), []);
    });
  });

  describe("reject", () => {
    it("removes the request and links nothing", async () => {
      rowRejected = await newRow("جود");
      const id = await ask(rowRejected, u2);
      const other = await call(on, "POST", `/students/${rowRejected}/link-requests/${id}/reject`, w.users.t2);
      assert.equal(other.status, 404, "another teacher cannot reject");
      const res = await call(on, "POST", `/students/${rowRejected}/link-requests/${id}/reject`, w.users.t1);
      assert.equal(res.status, 200, on.logs().slice(-1500));
      assert.deepEqual(res.json, { rejected: id });
      assert.deepEqual(await requestsOf(rowRejected), []);
      assert.deepEqual(await selfLinks(rowRejected), []);
    });

    it("rejecting what is gone: 404", async () => {
      const res = await call(on, "POST", `/students/${rowRejected}/link-requests/${r2}/reject`, w.users.t1);
      assert.equal(res.status, 404);
    });
  });
});
