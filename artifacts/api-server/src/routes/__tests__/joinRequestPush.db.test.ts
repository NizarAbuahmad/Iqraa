/**
 * A student's pick off the class code waits for the teacher (claimApproval.db.test.ts);
 * this is the teacher hearing about it: one push per NEW request, on the
 * «requests» channel, opening the class — and the bell's count of what waits,
 * for a teacher on the web who gets no push. Real database, real HTTP, Expo
 * replaced by the in-process stub.
 *
 * Fixture (seedFamilyWorld): class c1 (teacher t1). Roster rows are made here,
 * so each test names the row it uses.
 */
import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";

// 6 characters from the share-code alphabet (no I, L, O, 0, 1).
const CLASS_CODE = "WXYZAB";
const STUDENT_CODE = "CDEFGH";
const T1_PHONE = "ExponentPushToken[t1-phone]";
const T1_TABLET = "ExponentPushToken[t1-tablet]";

describeDb("the teacher hears of a class-code pick waiting for them", () => {
  let db: TestDb;
  let on: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;

  const q = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows;
  const newStudentUser = async (first: string) =>
    (await q(`INSERT INTO users (first_name, last_name, role) VALUES ($1, 'T', 'student') RETURNING id`, [first]))[0].id as string;
  const newRow = async (name: string) => {
    const id = (await q(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name]))[0].id as string;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  /** Pushes are one per class per window; move every waiting request out of it, as if the window had passed. */
  const ageRequests = () => q(`UPDATE roster_link_requests SET created_at = now() - interval '1 hour'`);
  const toTeacher = () => stub.messages().filter(m => m.to === T1_PHONE || m.to === T1_TABLET);
  const summary = async (teacher: string) => {
    const res = await call(on, "GET", "/classes/link-requests", teacher);
    assert.equal(res.status, 200, `${res.status} ${res.text}\n${on.logs().slice(-1500)}`);
    return res.json as { total: number; classes: { classId: string; count: number; name: string; nameAr: string }[] };
  };

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await q(
      `UPDATE class_groups SET join_code = $1, join_code_expires_at = now() + interval '30 days' WHERE id = $2`,
      [CLASS_CODE, w.classes.c1],
    );
    // Approving is a roster write, which waits for the teacher's roster consent.
    await q(`UPDATE users SET roster_consent_at = now() WHERE id = $1`, [w.users.t1]);
    for (const token of [T1_PHONE, T1_TABLET]) {
      await q(`INSERT INTO device_push_tokens (user_id, expo_push_token, platform) VALUES ($1, $2, 'android')`, [w.users.t1, token]);
    }
    stub = await startPushStub();
    on = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await on?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  describe("the push", () => {
    let row = "";
    let joiner = "";

    it("goes to every device of the class's teacher when a student picks a name", async () => {
      row = await newRow("ليان");
      joiner = await newStudentUser("joiner");
      const res = await call(on, "POST", "/auth/claim", joiner, { claimCode: CLASS_CODE, studentId: row });
      assert.equal(res.status, 202, on.logs().slice(-1500));

      const msgs = toTeacher();
      assert.deepEqual(msgs.map(m => m.to).sort(), [T1_PHONE, T1_TABLET].sort());
      for (const m of msgs) {
        assert.equal(m.title, "طلب انضمام جديد");
        assert.match(m.body, /«ليان»/);
        assert.equal(m.channelId, "requests");
        assert.deepEqual(m.data, { screen: "class-link-requests", classGroupId: w.classes.c1 });
      }
      assert.equal(stub.messages().length, msgs.length, "nobody but the teacher is pushed");
    });

    it("is not sent again when the same account enters the same name again", async () => {
      const res = await call(on, "POST", "/auth/claim", joiner, { claimCode: CLASS_CODE, studentId: row });
      assert.equal(res.status, 202);
      assert.deepEqual(await stub.settle(200), []);
    });

    it("is sent again when the account picks a different name — that is a new request", async () => {
      await ageRequests();
      const other = await newRow("رهف");
      const res = await call(on, "POST", "/auth/claim", joiner, { claimCode: CLASS_CODE, studentId: other });
      assert.equal(res.status, 202);
      assert.equal(toTeacher().length, 2);
      assert.match(toTeacher()[0].body, /«رهف»/);
    });

    it("rings once for a burst in one class: the second pick within the window is counted, not pushed", async () => {
      await ageRequests();
      const a = await newRow("بشرى");
      const b = await newRow("دانة");
      assert.equal((await call(on, "POST", "/auth/claim", await newStudentUser("burst1"), { claimCode: CLASS_CODE, studentId: a })).status, 202);
      assert.equal((await call(on, "POST", "/auth/claim", await newStudentUser("burst2"), { claimCode: CLASS_CODE, studentId: b })).status, 202);
      await stub.settle(200);
      assert.equal(toTeacher().length, 2, "one push, to each of the teacher's two devices");
      assert.match(toTeacher()[0].body, /«بشرى»/);
      const waiting = await q(`SELECT student_id FROM roster_link_requests WHERE student_id = ANY($1::uuid[])`, [[a, b]]);
      assert.equal(waiting.length, 2, "both requests are waiting all the same");
    });

    it("goes out for a code-only signup held the same way", async () => {
      await ageRequests();
      const redeemRow = await newRow("هديل");
      const res = await call(on, "POST", "/auth/redeem", undefined, {
        role: "student",
        claimCode: CLASS_CODE,
        studentId: redeemRow,
        acceptedTerms: true,
      });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.equal(res.json.pending, true);
      assert.equal(toTeacher().length, 2);
      assert.match(toTeacher()[0].body, /«هديل»/);
    });

    it("is not sent for a per-student code, which links at once", async () => {
      const own = await newRow("تالا");
      await q(`UPDATE students SET claim_code = $1, claim_code_expires_at = now() + interval '30 days' WHERE id = $2`, [STUDENT_CODE, own]);
      const res = await call(on, "POST", "/auth/claim", await newStudentUser("own"), { claimCode: STUDENT_CODE });
      assert.equal(res.status, 201, on.logs().slice(-1500));
      assert.deepEqual(await stub.settle(200), []);
    });

    it("is not sent when a student already linked to the name enters the class code again", async () => {
      const mine = await newRow("ميار");
      const owner = await newStudentUser("owner");
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [mine, owner]);
      await ageRequests();
      const res = await call(on, "POST", "/auth/claim", owner, { claimCode: CLASS_CODE, studentId: mine });
      assert.ok(res.status < 300, `${res.status} ${res.text}`);
      assert.deepEqual(await stub.settle(200), []);
    });

    it("does not fail the request when Expo is down", async () => {
      await ageRequests();
      const row2 = await newRow("جود");
      stub.failNext(500);
      const down = await newStudentUser("down");
      const res = await call(on, "POST", "/auth/claim", down, { claimCode: CLASS_CODE, studentId: row2 });
      assert.equal(res.status, 202, on.logs().slice(-1500));
      assert.equal((await q(`SELECT 1 FROM roster_link_requests WHERE student_id = $1 AND user_id = $2`, [row2, down])).length, 1);
    });
  });

  describe("the bell's count (GET /classes/link-requests)", () => {
    it("counts what waits in each of the teacher's live classes", async () => {
      const s = await summary(w.users.t1);
      const c1 = s.classes.find(c => c.classId === w.classes.c1);
      const waiting = (await q(
        `SELECT count(*)::int AS n FROM roster_link_requests r
           JOIN class_memberships m ON m.student_id = r.student_id AND m.class_group_id = $1
           JOIN users u ON u.id = r.user_id AND u.role = 'student'
          WHERE NOT EXISTS (SELECT 1 FROM roster_links l WHERE l.student_id = r.student_id AND l.relation = 'self')`,
        [w.classes.c1],
      ))[0].n as number;
      assert.ok(waiting > 0);
      assert.equal(c1?.count, waiting);
      assert.equal(s.total, waiting);
      // The class list the bell reads must agree with the class's own banner.
      const list = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t1);
      assert.equal(list.json.requests.length, waiting);
    });

    it("counts a child in two of the teacher's classes once in total, under both classes", async () => {
      const before = await summary(w.users.t1);
      const both = await newRow("شهد");
      await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c3, both]);
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [both, await newStudentUser("twice")]);
      const after = await summary(w.users.t1);
      assert.equal(after.total, before.total + 1);
      const count = (s: typeof after, id: string) => s.classes.find(c => c.classId === id)?.count ?? 0;
      assert.equal(count(after, w.classes.c1), count(before, w.classes.c1) + 1);
      assert.equal(count(after, w.classes.c3), count(before, w.classes.c3) + 1);
    });

    it("leaves out archived classes and archived students", async () => {
      const gone = await newRow("غادة");
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [gone, await newStudentUser("gone")]);
      const before = await summary(w.users.t1);
      await q(`UPDATE students SET archived_at = now() WHERE id = $1`, [gone]);
      assert.equal((await summary(w.users.t1)).total, before.total - 1);
      await q(`UPDATE class_groups SET archived_at = now() WHERE id = $1`, [w.classes.c3]);
      assert.equal((await summary(w.users.t1)).classes.some(c => c.classId === w.classes.c3), false);
      await q(`UPDATE class_groups SET archived_at = NULL WHERE id = $1`, [w.classes.c3]);
    });

    it("drops a request once it is approved", async () => {
      const before = await summary(w.users.t1);
      const list = await call(on, "GET", `/classes/${w.classes.c1}/link-requests`, w.users.t1);
      const first = list.json.requests[0] as { id: string; studentId: string };
      const ok = await call(on, "POST", `/students/${first.studentId}/link-requests/${first.id}/approve`, w.users.t1);
      assert.equal(ok.status, 200, ok.text);
      assert.equal((await summary(w.users.t1)).total, before.total - 1);
    });

    it("shows another teacher nothing of t1's", async () => {
      const s = await summary(w.users.t2);
      assert.equal(s.classes.some(c => c.classId === w.classes.c1), false);
    });

    it("is closed to a student account", async () => {
      const res = await call(on, "GET", "/classes/link-requests", w.users.studentA);
      assert.equal(res.status, 403);
    });
  });
});
