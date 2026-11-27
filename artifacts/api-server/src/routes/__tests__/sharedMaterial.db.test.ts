/**
 * What this guards: a teacher's saved material shared by link (spec
 * docs/superpowers/specs/2026-11-20-material-share-link-design.md).
 *
 * `saved_materials` is the teacher's private workspace, and `/shared/:code` is a
 * public door into it — no account needed. So: only the owner makes or stops a
 * link; the public read never carries an answer, the form state or the owner;
 * only a teacher sees the answers or saves a copy; and every bad code is the
 * same 404, including one that was stopped or whose material was deleted.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";

const MISSING_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";
const QUIZ = {
  title: "اختبار الجيوب",
  duration: 20,
  totalPoints: 2,
  questions: [{ id: "q1", type: "multiple_choice", text: "جا ٣٠ = ؟", options: ["½", "١"], correctAnswer: "½", points: 2, explanation: "لأن…" }],
};
const FORM = { gradeIdx: 0, subjectIdx: 1, topic: "قانون الجيوب", priorTopicsNotes: "سارة تحتاج خطًا أكبر" };

describeDb("saved materials shared by link, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;

  const material = async (userId: string, content: unknown = QUIZ) =>
    (
      await db.pool.query<{ id: string }>(
        `INSERT INTO saved_materials (user_id, type, title, subject, grade, topic, language, content, form_state)
         VALUES ($1, 'quiz', 'اختبار الجيوب', 'الرياضيات', 'الصف العاشر', 'قانون الجيوب', 'ar', $2::jsonb, $3::jsonb) RETURNING id`,
        [userId, JSON.stringify(content), JSON.stringify(FORM)],
      )
    ).rows[0].id;
  const share = (who: string, id: string) => call(server, "POST", `/workspace/items/${id}/share`, who);
  const stop = (who: string, id: string) => call(server, "DELETE", `/workspace/items/${id}/share`, who);
  const open = (code: string, who?: string, full = false) => call(server, "GET", `/shared/${code}${full ? "/full" : ""}`, who);

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    server = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("gives the owner one code, the same on every call, and lists it on the item", async () => {
    const id = await material(w.users.t1);
    const a = await share(w.users.t1, id);
    assert.equal(a.status, 200, server.logs().slice(-1500));
    assert.match(a.json.shareCode, /^[A-HJKMNP-Z2-9]{8}$/);
    const b = await share(w.users.t1, id);
    assert.equal(b.json.shareCode, a.json.shareCode);
    const item = await call(server, "GET", `/workspace/items/${id}`, w.users.t1);
    assert.equal(item.json.shareCode, a.json.shareCode);
  });

  it("serves anyone the paper without answers, form state or owner", async () => {
    const id = await material(w.users.t1);
    const code = (await share(w.users.t1, id)).json.shareCode;
    for (const who of [undefined, w.users.studentA, w.users.parentA]) {
      const r = await open(code.toLowerCase(), who);
      assert.equal(r.status, 200, `${who}: ${r.text}`);
      assert.equal(r.json.full, false);
      const m = r.json.material;
      assert.equal(m.title, "اختبار الجيوب");
      assert.equal(m.type, "quiz");
      assert.equal(m.subject, "الرياضيات");
      const q = JSON.parse(m.content).questions[0];
      assert.equal(q.text, "جا ٣٠ = ؟");
      assert.equal(q.correctAnswer, "");
      assert.equal(q.explanation, "");
      assert.deepEqual(Object.keys(m).sort(), ["content", "grade", "language", "savedAt", "subject", "title", "topic", "type"]);
      assert.doesNotMatch(r.text, /سارة|priorTopicsNotes|user_?id/i);
    }
  });

  it("serves a teacher the answers on /full, and refuses everyone else there", async () => {
    const id = await material(w.users.t1);
    const code = (await share(w.users.t1, id)).json.shareCode;
    const r = await open(code, w.users.t2, true);
    assert.equal(r.status, 200, r.text);
    assert.equal(r.json.full, true);
    assert.equal(JSON.parse(r.json.material.content).questions[0].correctAnswer, "½");
    assert.doesNotMatch(r.text, /سارة/);
    assert.equal((await open(code, undefined, true)).status, 401, "no account");
    assert.equal((await open(code, w.users.studentA, true)).status, 403, "a student");
    assert.equal((await open(code, w.users.parentA, true)).status, 403, "a parent");
  });

  it("saves a teacher's own copy, with the answers and the pickers but not the owner's notes", async () => {
    const id = await material(w.users.t1);
    const code = (await share(w.users.t1, id)).json.shareCode;
    const r = await call(server, "POST", `/shared/${code}/save`, w.users.t2);
    assert.equal(r.status, 201, r.text);
    const copy = r.json.item;
    assert.notEqual(copy.id, id);
    assert.equal(copy.title, "اختبار الجيوب");
    assert.equal(copy.shareCode, null);
    assert.equal(JSON.parse(copy.content).questions[0].correctAnswer, "½");
    assert.deepEqual(copy.formState, { gradeIdx: 0, subjectIdx: 1, topic: "قانون الجيوب" });
    const row = (await db.pool.query(`SELECT user_id, share_code, is_favorite, class_group_id FROM saved_materials WHERE id = $1`, [copy.id])).rows[0];
    assert.deepEqual(row, { user_id: w.users.t2, share_code: null, is_favorite: false, class_group_id: null });
    assert.equal((await call(server, "GET", `/workspace/items/${copy.id}`, w.users.t2)).status, 200, "it is in t2's files");
    assert.equal((await call(server, "POST", `/shared/${code}/save`)).status, 401, "no account");
    assert.equal((await call(server, "POST", `/shared/${code}/save`, w.users.studentA)).status, 403, "a student");
  });

  it("only the owner shares or stops, and a stopped link stays dead after a re-share", async () => {
    const id = await material(w.users.t1);
    assert.equal((await share(w.users.t2, id)).status, 404, "another teacher cannot share it");
    const first = (await share(w.users.t1, id)).json.shareCode;
    assert.equal((await stop(w.users.t2, id)).status, 404, "another teacher cannot stop it");
    assert.equal((await open(first)).status, 200, "still shared");

    assert.equal((await stop(w.users.t1, id)).status, 200);
    assert.equal((await open(first)).status, 404, "stopped");
    assert.equal((await call(server, "GET", `/workspace/items/${id}`, w.users.t1)).json.shareCode, null);

    const second = (await share(w.users.t1, id)).json.shareCode;
    assert.notEqual(second, first);
    assert.equal((await open(first)).status, 404, "the old link stays dead");
    assert.equal((await open(second)).status, 200);
  });

  it("keeps the owner's notes out of a shared lesson plan, though the plan quotes them", async () => {
    // lpPriorReview writes the prior-topic notes into the plan word for word.
    const plan = (
      await db.pool.query<{ id: string }>(
        `INSERT INTO saved_materials (user_id, type, title, content, form_state)
         VALUES ($1, 'lesson', 'خطة الجيوب', $2::jsonb, $3::jsonb) RETURNING id`,
        [
          w.users.t1,
          JSON.stringify({ title: "خطة الجيوب", priorReview: "سأراجع الزوايا. بحسب ملاحظات المعلم: سارة تحتاج خطًا أكبر", objectives: ["أن يطبّق القانون"] }),
          JSON.stringify(FORM),
        ],
      )
    ).rows[0].id;
    const code = (await share(w.users.t1, plan)).json.shareCode;
    for (const r of [await open(code), await open(code, w.users.t2, true)]) {
      assert.equal(r.status, 200, r.text);
      assert.doesNotMatch(r.text, /سارة/);
      assert.match(JSON.parse(r.json.material.content).priorReview, /^سأراجع الزوايا\. بحسب ملاحظات المعلم: …$/);
    }
    const copy = await call(server, "POST", `/shared/${code}/save`, w.users.t2);
    assert.doesNotMatch(copy.text, /سارة/);
  });

  it("refuses to share a whiteboard", async () => {
    const board = (
      await db.pool.query<{ id: string }>(`INSERT INTO saved_materials (user_id, type, title) VALUES ($1, 'board', 'لوح') RETURNING id`, [w.users.t1])
    ).rows[0].id;
    const r = await share(w.users.t1, board);
    assert.equal(r.status, 400, r.text);
    assert.equal(r.json.code, "not_shareable");
  });

  it("is the same 404 for an unknown, malformed or deleted material's code, and for a bad id", async () => {
    const id = await material(w.users.t1);
    const code = (await share(w.users.t1, id)).json.shareCode;
    assert.equal((await call(server, "DELETE", `/workspace/items/${id}`, w.users.t1)).status, 200);
    const bodies = new Set<string>();
    for (const c of [code, "ZZZZZZZZ", "K7QX4M", "K7QX4MP0", "%20"]) {
      const r = await open(c);
      assert.equal(r.status, 404, c);
      bodies.add(r.text);
    }
    assert.equal(bodies.size, 1, `one body for every miss: ${[...bodies].join(" | ")}`);
    assert.equal((await share(w.users.t1, MISSING_UUID)).status, 404);
    assert.equal((await share(w.users.t1, "ws_123_abc")).status, 404, "a device-only id");
    assert.equal((await stop(w.users.t1, "not-a-uuid")).status, 404);
    assert.equal((await share(w.users.studentA, id)).status, 403, "a student cannot use /workspace");
  });
});
