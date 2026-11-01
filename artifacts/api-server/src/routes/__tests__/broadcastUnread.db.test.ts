/**
 * What this guards: a broadcast must not mark the teacher's threads as read.
 *
 * It used to set the teacher's `lastReadAt` to now on every recipient's thread,
 * as if sending were reading. A parent's reply the teacher had not opened (the
 * one that says the child is ill) then dropped out of the unread count and the
 * app-icon badge the moment the teacher announced anything to the class. The
 * teacher's own message was never the reason: unread counts already skip the
 * viewer's own messages.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("a broadcast and the teacher's unread count, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  let threadId: string;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    server = await startServer({ databaseUrl: db.url });
    const opened = await call(server, "POST", "/messaging/threads", w.users.t1, { counterpartUserId: w.users.parentA });
    assert.equal(opened.status, 201, server.logs().slice(-1500));
    threadId = opened.json.thread.id;
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  const unreadFor = async (user: string): Promise<number> => {
    const r = await call(server, "GET", "/messaging/threads", user);
    assert.equal(r.status, 200, r.text);
    const t = r.json.threads.find((x: { id: string }) => x.id === threadId);
    assert.ok(t, "thread is in the inbox");
    return t.unreadCount;
  };

  it("keeps an unopened parent reply unread after the teacher broadcasts", async () => {
    const reply = await call(server, "POST", `/messaging/threads/${threadId}/messages`, w.users.parentA, {
      body: "my child is sick today",
    });
    assert.equal(reply.status, 201, reply.text);
    assert.equal(await unreadFor(w.users.t1), 1, "the reply is unread before the broadcast");

    const sent = await call(server, "POST", "/messaging/threads/broadcast", w.users.t1, {
      participantUserIds: [w.users.parentA],
      body: "class trip on Thursday",
    });
    assert.equal(sent.status, 201, sent.text);

    assert.equal(await unreadFor(w.users.t1), 1, "still unread: the teacher never opened it");
    assert.equal(await unreadFor(w.users.parentA), 1, "the parent has the broadcast to read");
  });
});
