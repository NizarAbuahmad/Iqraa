/**
 * What this guards: the free-text `reason` on a chat report has a ceiling.
 *
 * It was read with only a trim, so any signed-in account (a student included)
 * could store a body-limit-sized string per report, and the moderation queue
 * selects `reason` for fifty rows a page.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

describeDb("chat report reason length, against a real database", () => {
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

  const report = (reason: string) =>
    call(server, "POST", "/messaging/reports", w.users.parentA, {
      threadId,
      reportedUserId: w.users.t1,
      reason,
    });

  it("refuses a reason past the ceiling with 400 too_long", async () => {
    const r = await report("ش".repeat(1001));
    assert.equal(r.status, 400, r.text);
    assert.equal(r.json.code, "too_long");
  });

  it("accepts a reason at the ceiling", async () => {
    const r = await report("ش".repeat(1000));
    assert.equal(r.status, 201, r.text);
  });
});
