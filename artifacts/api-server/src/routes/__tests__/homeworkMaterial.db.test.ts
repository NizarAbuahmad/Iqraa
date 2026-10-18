/**
 * What this guards: a teacher's saved materials (ملفاتي) attached to homework.
 * `saved_materials` is the teacher's private workspace, and this is the only
 * route that hands one of its rows to anyone else — so the attach must take
 * only the teacher's own rows, and the read must answer 404 unless every
 * condition holds (lib/homeworkMaterial.ts), and never send the answers.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { ammanDay } from "../../test-support/seedExams.ts";

const DUE = ammanDay(3);
const MISSING_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";
const QUIZ = {
  title: "اختبار الجيوب",
  duration: 20,
  totalPoints: 2,
  questions: [{ id: "q1", type: "multiple_choice", text: "جا ٣٠ = ؟", options: ["½", "١"], correctAnswer: "½", points: 2, explanation: "لأن…" }],
};

describeDb("saved materials attached to homework, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  let quiz: string;
  let other: string;

  const material = async (userId: string, type: string, title: string, content: unknown = {}) =>
    (
      await db.pool.query<{ id: string }>(
        `INSERT INTO saved_materials (user_id, type, title, content) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [userId, type, title, JSON.stringify(content)],
      )
    ).rows[0].id;
  const attach = (ids: string[], body: Record<string, unknown> = {}) =>
    call(server, "POST", "/homework", w.users.t1, {
      classGroupId: w.classes.c1,
      dueDate: DUE,
      title: "hw-mat",
      resources: ids.map(materialId => ({ kind: "material", materialId, title: "from the app", type: "lesson" })),
      ...body,
    });
  const read = (who: string, hw: string, m: string, role: "student" | "parent" = "student") =>
    call(server, "GET", `/${role}/homework/${hw}/materials/${m}`, who);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    quiz = await material(w.users.t1, "quiz", "اختبار الجيوب", QUIZ);
    other = await material(w.users.t2, "worksheet", "t2's sheet");
    server = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("attaches the teacher's own material, titled and typed from the row, not the app", async () => {
    const r = await attach([quiz, quiz]);
    assert.equal(r.status, 201, server.logs().slice(-1500));
    assert.deepEqual(r.json.homework.resources, [{ kind: "material", materialId: quiz, title: "اختبار الجيوب", type: "quiz" }]);
  });

  it("refuses another teacher's material, an unknown one, a board and a malformed id", async () => {
    const board = await material(w.users.t1, "board", "a board");
    for (const id of [other, MISSING_UUID, board, "not-a-uuid"]) {
      const r = await attach([id], { title: "refused" });
      assert.equal(r.status, 400, `${id}: ${r.text}`);
    }
    assert.equal((await db.pool.query(`SELECT 1 FROM homework WHERE title = 'refused'`)).rowCount, 0);
  });

  it("serves it to the class's student and parent, without the answers", async () => {
    const hw = (await attach([quiz])).json.homework.id;
    for (const [who, role] of [[w.users.studentA, "student"], [w.users.parentA, "parent"]] as const) {
      const r = await read(who, hw, quiz, role);
      assert.equal(r.status, 200, `${role}: ${r.text}`);
      assert.equal(r.json.material.title, "اختبار الجيوب");
      assert.equal(r.json.material.type, "quiz");
      const q = JSON.parse(r.json.material.content).questions[0];
      assert.equal(q.text, "جا ٣٠ = ؟");
      assert.deepEqual(q.options, ["½", "١"]);
      assert.equal(q.correctAnswer, "");
      assert.equal(q.explanation, "");
      assert.equal(r.json.material.formState, undefined, "the teacher's form input stays private");
    }
  });

  it("is 404 for another class's student, an unrelated parent, a teacher's role mismatch and a material not on the homework", async () => {
    const hw = (await attach([quiz])).json.homework.id;
    const unattached = await material(w.users.t1, "worksheet", "not attached");
    assert.equal((await read(w.users.studentB, hw, quiz)).status, 404, "student of another class");
    assert.equal((await read(w.users.parentB, hw, quiz, "parent")).status, 404, "unrelated parent");
    assert.equal((await read(w.users.studentUnlinked, hw, quiz)).status, 404, "unlinked student");
    assert.equal((await read(w.users.studentA, hw, unattached)).status, 404, "the teacher's other material");
    assert.equal((await read(w.users.studentA, MISSING_UUID, quiz)).status, 404, "unknown homework");
    assert.equal((await read(w.users.studentA, "x", "y")).status, 404, "malformed ids");
    assert.equal((await read(w.users.t1, hw, quiz)).status, 403, "a teacher on the student route");
    assert.equal((await read(w.users.parentA, hw, quiz)).status, 403, "a parent on the student route");
  });

  it("is 404 once removed from the homework, the homework archived, or the class archived", async () => {
    const removed = (await attach([quiz])).json.homework.id;
    assert.equal((await call(server, "PATCH", `/homework/${removed}`, w.users.t1, { resources: [] })).status, 200);
    assert.equal((await read(w.users.studentA, removed, quiz)).status, 404, "removed");

    const archived = (await attach([quiz])).json.homework.id;
    assert.equal((await call(server, "DELETE", `/homework/${archived}`, w.users.t1)).status, 200);
    assert.equal((await read(w.users.studentA, archived, quiz)).status, 404, "archived homework");

    const hw = (await attach([quiz])).json.homework.id;
    await db.pool.query(`UPDATE class_groups SET archived_at = now() WHERE id = $1`, [w.classes.c1]);
    try {
      assert.equal((await read(w.users.studentA, hw, quiz)).status, 404, "archived class");
    } finally {
      await db.pool.query(`UPDATE class_groups SET archived_at = NULL WHERE id = $1`, [w.classes.c1]);
    }
  });

  it("is 404 once the material is deleted or no longer the teacher's — and an edit keeps the attachment", async () => {
    const moved = await material(w.users.t1, "worksheet", "moved");
    const hwMoved = (await attach([moved])).json.homework.id;
    await db.pool.query(`UPDATE saved_materials SET user_id = $2 WHERE id = $1`, [moved, w.users.t2]);
    assert.equal((await read(w.users.studentA, hwMoved, moved)).status, 404, "now another teacher's");

    const gone = await material(w.users.t1, "lesson", "gone");
    const hw = (await attach([gone])).json.homework.id;
    assert.equal((await read(w.users.studentA, hw, gone)).status, 200);
    await db.pool.query(`DELETE FROM saved_materials WHERE id = $1`, [gone]);
    assert.equal((await read(w.users.studentA, hw, gone)).status, 404, "deleted");

    // The edit form resends the whole list; a deleted material must not make it a 400.
    const edited = await call(server, "PATCH", `/homework/${hw}`, w.users.t1, {
      title: "hw-mat edited",
      resources: [{ kind: "material", materialId: gone }],
    });
    assert.equal(edited.status, 200, edited.text);
    assert.deepEqual(edited.json.homework.resources.map((r: { title: string }) => r.title), ["gone"]);
  });
});
