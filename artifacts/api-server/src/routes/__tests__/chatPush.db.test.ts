/**
 * What this guards: a chat message's push is sent BEFORE the send is answered.
 *
 * It used to go out after `res.json`, fire-and-forget. That had two costs: on
 * Cloud Run the CPU is throttled once a response is sent, so the push could
 * stall until some later request; and the push read the block list only when it
 * ran, so a block or unblock that landed straight after the post decided who
 * was notified. `rlsDiff.test.ts` caught the second one: a parent who unblocked
 * a sender right after their message was pushed it, once in about 15 runs.
 * Awaiting the push (capped, through `pushWithin`) closes both.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { ownersReached, seedPushWorld } from "../../test-support/seedPush.ts";

describeDb("chat pushes, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;
  let threadId: string;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
    const opened = await call(server, "POST", "/messaging/threads", w.users.t1, { counterpartUserId: w.users.parentA });
    assert.equal(opened.status, 201, server.logs().slice(-1500));
    threadId = opened.json.thread.id;
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  const send = (body: string) => call(server, "POST", `/messaging/threads/${threadId}/messages`, w.users.t1, { body });

  it("pushes the other party's devices before answering", async () => {
    assert.equal((await send("chat-push-hello")).status, 201);
    // Awaited before the response: already here, no waiting.
    const msgs = stub.messages();
    assert.deepEqual(ownersReached(msgs), ["parentA"]);
    assert.equal(msgs.length, 2, "both of parentA's devices");
    assert.ok(msgs.every(m => m.body === "chat-push-hello"));
  });

  it("waits for the push before answering a message", async () => {
    stub.delayNext(800);
    const started = Date.now();
    assert.equal((await send("chat-push-slow")).status, 201);
    assert.ok(Date.now() - started >= 750, `answered after ${Date.now() - started}ms`);
  });

  it("waits for the pushes before answering a broadcast", async () => {
    stub.delayNext(800);
    const started = Date.now();
    const r = await call(server, "POST", "/messaging/threads/broadcast", w.users.t1, {
      participantUserIds: [w.users.parentA],
      body: "chat-push-broadcast",
    });
    assert.equal(r.status, 201, r.text);
    assert.ok(Date.now() - started >= 750, `answered after ${Date.now() - started}ms`);
    assert.deepEqual(ownersReached(stub.messages()), ["parentA"]);
  });

  it("still sends the message when the push fails", async () => {
    stub.failNext(500);
    const r = await send("chat-push-failed");
    assert.equal(r.status, 201, r.text);
    assert.equal(r.json.message.body, "chat-push-failed");
  });
});
