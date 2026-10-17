/**
 * What this guards: Library items attached to homework, and the line a homework
 * leaves in its class's group chat. The attachments must be checked the way a
 * class shelf's are (a staff upload is copied from the Library, never taken
 * from the app) and must reach the family's view. The chat line must go only
 * into the teacher's own class, never push the families a second time, and
 * never fail the homework it belongs to.
 */
import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay } from "../../test-support/seedExams.ts";
import { startPushStub, type PushStub } from "../../test-support/pushStub.ts";
import { seedPushWorld } from "../../test-support/seedPush.ts";

const DUE = ammanDay(3);
const SHEET = { kind: "library", source: "premade-sheet", nativeId: "g10-math-sheet-1", title: "ورقة عمل الجيوب", mediaKind: "worksheet" };
const MISSING_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

describeDb("homework attachments and the class chat line, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: PushStub;
  let w: FamilyWorld;

  const post = (body: Record<string, unknown>, teacher = w.users.t1) =>
    call(server, "POST", "/homework", teacher, { classGroupId: w.classes.c1, dueDate: DUE, ...body });
  const chatLines = async (classId: string) =>
    (
      await db.pool.query<{ body: string; sender_id: string }>(
        `SELECT m.body, m.sender_id FROM chat_messages m JOIN chat_threads t ON t.id = m.thread_id
          WHERE t.class_group_id = $1 ORDER BY m.created_at`,
        [classId],
      )
    ).rows;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    await seedPushWorld(db.pool, w);
    stub = await startPushStub();
    server = await startServer({ databaseUrl: db.url, env: { EXPO_PUSH_URL: stub.url } });
  });
  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });
  beforeEach(() => stub.clear());

  it("stores attachments, drops a repeat, and shows them to the class's student", async () => {
    const r = await post({ title: "hw-att-1", resources: [SHEET, SHEET] });
    assert.equal(r.status, 201, server.logs().slice(-1500));
    const res = r.json.homework.resources;
    assert.equal(res.length, 1);
    assert.deepEqual(
      { ...res[0] },
      { kind: "library", source: "premade-sheet", nativeId: SHEET.nativeId, title: SHEET.title, mediaKind: "worksheet", url: null, thumbnailUrl: null },
    );
    const mine = await call(server, "GET", "/student/homework", w.users.studentA);
    assert.equal(mine.status, 200, mine.text);
    const item = mine.json.homework.find((h: { title: string }) => h.title === "hw-att-1");
    assert.ok(item, "the student sees the homework");
    assert.equal(item.resources[0].title, SHEET.title);
  });

  it("refuses a malformed attachment, an unknown staff upload and more than ten", async () => {
    assert.equal((await post({ title: "x", resources: [{ kind: "library", source: "nope" }] })).status, 400);
    assert.equal((await post({ title: "x", resources: [{ kind: "library", source: "uploaded", nativeId: MISSING_UUID }] })).status, 400);
    const many = Array.from({ length: 11 }, (_, i) => ({ ...SHEET, nativeId: `s${i}` }));
    assert.equal((await post({ title: "x", resources: many })).status, 400);
    assert.equal((await post({ title: "x", resources: "not a list" })).status, 400);
    const saved = await db.pool.query(`SELECT 1 FROM homework WHERE title = 'x'`);
    assert.equal(saved.rowCount, 0, "nothing saved on a 400");
  });

  it("keeps an attached staff upload on PATCH even after the Library deleted it", async () => {
    const r = await post({ title: "hw-att-gone" });
    const id = r.json.homework.id;
    const gone = { kind: "library", source: "uploaded", nativeId: MISSING_UUID, title: "deleted upload", mediaKind: "document", url: null, thumbnailUrl: null };
    await db.pool.query(`UPDATE homework SET resources = $2::jsonb WHERE id = $1`, [id, JSON.stringify([gone])]);
    const body = { kind: "library", source: "uploaded", nativeId: MISSING_UUID };
    const edited = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { title: "hw-att-gone 2", resources: [body, SHEET] });
    assert.equal(edited.status, 200, edited.text);
    assert.deepEqual(edited.json.homework.resources.map((x: { title: string }) => x.title), ["deleted upload", SHEET.title]);
  });

  it("replaces the attachments on PATCH", async () => {
    const r = await post({ title: "hw-att-patch", resources: [SHEET] });
    const id = r.json.homework.id;
    const cleared = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { resources: [] });
    assert.equal(cleared.status, 200, cleared.text);
    assert.deepEqual(cleared.json.homework.resources, []);
  });

  it("with shareToChat, leaves one line in the class chat in the teacher's name — and pushes nothing extra", async () => {
    const plain = await post({ title: "hw-chat-plain" });
    assert.equal(plain.json.sharedToChat, false);
    const pushesWithout = stub.messages().length;
    stub.clear();

    const before = (await chatLines(w.classes.c1)).length;
    const r = await post({ title: "hw-chat-1", instructions: "حل 1-5", resources: [SHEET], shareToChat: true });
    assert.equal(r.status, 201, server.logs().slice(-1500));
    assert.equal(r.json.sharedToChat, true);
    assert.equal(stub.messages().length, pushesWithout, "the chat line is not pushed on top of the homework push");

    const lines = await chatLines(w.classes.c1);
    assert.equal(lines.length, before + 1);
    const line = lines.at(-1)!;
    assert.equal(line.sender_id, w.users.t1);
    assert.ok(line.body.includes("hw-chat-1"));
    assert.ok(line.body.includes("حل 1-5"));
    assert.ok(line.body.includes(SHEET.title));
  });

  it("POST /homework/:id/share posts for the owner only", async () => {
    const r = await post({ title: "hw-share-later" });
    const id = r.json.homework.id;
    const before = (await chatLines(w.classes.c1)).length;

    assert.equal((await call(server, "POST", `/homework/${id}/share`, w.users.t2)).status, 404, "another teacher");
    assert.equal((await call(server, "POST", `/homework/${id}/share`, w.users.studentA)).status, 403, "a student");
    assert.equal((await call(server, "POST", `/homework/${MISSING_UUID}/share`, w.users.t1)).status, 404);
    assert.equal((await chatLines(w.classes.c1)).length, before);

    const ok = await call(server, "POST", `/homework/${id}/share`, w.users.t1);
    assert.equal(ok.status, 200, ok.text);
    assert.equal((await chatLines(w.classes.c1)).length, before + 1);

    await call(server, "DELETE", `/homework/${id}`, w.users.t1);
    assert.equal((await call(server, "POST", `/homework/${id}/share`, w.users.t1)).status, 404, "archived homework");
  });
});
