/**
 * What this guards: unlinking an account from a teacher's roster takes it out
 * of that teacher's direct chat and custom groups, not only the class chats.
 *
 * Direct threads and custom groups are only ever created between a teacher and
 * someone `isConnected` to them (a roster link to one of their students), and
 * sending or reading checks participation alone. So when the last link went,
 * the account kept reading the teacher's earlier messages about a child and
 * could keep posting, while the teacher believed they had cut it off. The
 * tests run in order and share state: each one builds on the links the last
 * one removed, and says which.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("unlinking an account and the teacher's direct chats and groups, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  // t1's direct chats with the parent and with the student, t2's with the parent,
  // and a custom group of t1's holding the parent, the student and another parent.
  let dmParent: string;
  let dmStudent: string;
  let dmParentOfT2: string;
  let group: string;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    // The roster-write consent gate would otherwise answer the unlink with 403.
    await db.pool.query(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [[w.users.t1, w.users.t2]]);
    server = await startServer({ databaseUrl: db.url });

    const open = async (teacher: string, other: string): Promise<string> => {
      const r = await call(server, "POST", "/messaging/threads", teacher, { counterpartUserId: other });
      assert.equal(r.status, 201, server.logs().slice(-1500));
      return r.json.thread.id;
    };
    dmParent = await open(w.users.t1, w.users.parentA);
    dmStudent = await open(w.users.t1, w.users.studentA);
    dmParentOfT2 = await open(w.users.t2, w.users.parentA);

    const sent = await call(server, "POST", `/messaging/threads/${dmParent}/messages`, w.users.t1, {
      body: "about Sara's absences",
    });
    assert.equal(sent.status, 201, sent.text);

    const made = await call(server, "POST", "/messaging/threads/custom", w.users.t1, {
      title: "Parents and students",
      participantUserIds: [w.users.parentA, w.users.studentA, w.users.parentB],
    });
    assert.equal(made.status, 201, made.text);
    group = made.json.thread.id;
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  const canRead = async (user: string, threadId: string): Promise<boolean> => {
    const r = await call(server, "GET", `/messaging/threads/${threadId}`, user);
    assert.ok(r.status === 200 || r.status === 404, `unexpected ${r.status}: ${r.text}`);
    return r.status === 200;
  };
  const unlink = (studentId: string, userId: string) =>
    call(server, "DELETE", `/students/${studentId}/links/${userId}`, w.users.t1);

  it("keeps a parent in the chats while another child still links them to the teacher", async () => {
    // parentA is linked to Sara (sA1) and Adam (aA), both t1's.
    assert.equal((await unlink(w.students.sA1, w.users.parentA)).status, 200);
    assert.equal(await canRead(w.users.parentA, dmParent), true);
    assert.equal(await canRead(w.users.parentA, group), true);
  });

  it("removes a parent from the teacher's direct chat and groups once their last link to that teacher goes", async () => {
    assert.equal((await unlink(w.students.aA, w.users.parentA)).status, 200);
    assert.equal(await canRead(w.users.parentA, dmParent), false, "direct chat");
    assert.equal(await canRead(w.users.parentA, group), false, "custom group");
    const post = await call(server, "POST", `/messaging/threads/${dmParent}/messages`, w.users.parentA, { body: "still here?" });
    assert.equal(post.status, 404, "cannot post either");
    // Someone else in the group, and the teacher, are untouched.
    assert.equal(await canRead(w.users.parentB, group), true);
    assert.equal(await canRead(w.users.t1, group), true);
  });

  it("leaves that parent's chat with another teacher alone", async () => {
    assert.equal(await canRead(w.users.parentA, dmParentOfT2), true);
  });

  it("drops the emptied direct chat from the teacher's inbox but keeps its messages", async () => {
    const inbox = await call(server, "GET", "/messaging/threads", w.users.t1);
    assert.equal(inbox.status, 200, inbox.text);
    assert.ok(!inbox.json.threads.some((t: { id: string }) => t.id === dmParent), "no half-empty chat in the inbox");
    const kept = await db.pool.query<{ n: number }>(`SELECT count(*)::int AS n FROM chat_messages WHERE thread_id = $1`, [dmParent]);
    assert.equal(kept.rows[0].n, 1, "history stays for moderation and for a later re-link");
  });

  it("removes a student who withdraws their own link", async () => {
    assert.equal(await canRead(w.users.studentA, dmStudent), true);
    assert.equal((await call(server, "DELETE", "/auth/claim", w.users.studentA)).status, 200);
    assert.equal(await canRead(w.users.studentA, dmStudent), false, "direct chat");
    assert.equal(await canRead(w.users.studentA, group), false, "custom group");
  });

  it("brings the parent back, with the old messages, when they are linked and the teacher opens the chat again", async () => {
    await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [
      w.students.sA1,
      w.users.parentA,
    ]);
    const reopened = await call(server, "POST", "/messaging/threads", w.users.t1, { counterpartUserId: w.users.parentA });
    assert.equal(reopened.status, 201, reopened.text);
    assert.equal(reopened.json.thread.id, dmParent, "the same thread, not a second one");
    assert.equal(await canRead(w.users.parentA, dmParent), true);
    const msgs = await call(server, "GET", `/messaging/threads/${dmParent}/messages`, w.users.parentA);
    assert.equal(msgs.status, 200, msgs.text);
    assert.equal(msgs.json.messages.length, 1);
  });
});
