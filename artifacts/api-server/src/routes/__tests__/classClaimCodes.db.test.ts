/**
 * GET/POST /classes/:id/claim-codes — every live student's per-student code for one class, and minting the missing
 * ones — against a real database. What it pins: the mint never replaces a live code (a family may already hold it on
 * a slip), it replaces an expired one, it leaves archived students and other classes alone, a minted code really
 * signs a parent up for that child, and another teacher gets 404 with nothing written.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

const TERMS = { acceptedTerms: true, termsVersion: "2026-10-23" };

describeDb("class-wide parent codes", () => {
  let db: TestDb;
  let on: TestServer;
  let teacher: string;
  let otherTeacher: string;
  let klass: string;
  let otherClass: string;
  const kid: Record<string, string> = {};

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  const codeOf = async (studentId: string) =>
    (await q<{ claim_code: string | null; claim_code_expires_at: Date | null }>(
      `SELECT claim_code, claim_code_expires_at FROM students WHERE id = $1`,
      [studentId],
    ))[0]!;

  before(async () => {
    db = await setupTestDb();
    const mkTeacher = async (email: string) =>
      (await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, roster_consent_at) VALUES ('T', $1, 'teacher', $1, now()) RETURNING id`,
        [email],
      ))[0]!.id;
    teacher = await mkTeacher("t@example.test");
    otherTeacher = await mkTeacher("o@example.test");
    const mkClass = async (name: string) =>
      (await q<{ id: string }>(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, $2, 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
        [teacher, name],
      ))[0]!.id;
    klass = await mkClass("10A");
    otherClass = await mkClass("10B");
    const mkKid = async (key: string, name: string, classId: string) => {
      const [row] = await q<{ id: string }>(
        `INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`,
        [teacher, name],
      );
      await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [classId, row!.id]);
      kid[key] = row!.id;
    };
    await mkKid("none", "أحمد", klass);
    await mkKid("live", "بشرى", klass);
    await q(`UPDATE students SET claim_code = 'LVE2Q7', claim_code_expires_at = now() + interval '10 days' WHERE id = $1`, [kid["live"]]);
    await mkKid("expired", "جود", klass);
    await q(`UPDATE students SET claim_code = 'EXP2Q7', claim_code_expires_at = now() - interval '1 day' WHERE id = $1`, [kid["expired"]]);
    await mkKid("archived", "دانة", klass);
    await q(`UPDATE students SET archived_at = now() WHERE id = $1`, [kid["archived"]]);
    await mkKid("elsewhere", "هادي", otherClass);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("GET lists the class's live students, a live code as it is, an expired one as none", async () => {
    const res = await call(on, "GET", `/classes/${klass}/claim-codes`, teacher);
    assert.equal(res.status, 200, res.text);
    const byId = new Map<string, { claimCode: string | null }>(res.json.codes.map((c: { studentId: string }) => [c.studentId, c]));
    assert.deepEqual([...byId.keys()].sort(), [kid["none"], kid["live"], kid["expired"]].sort(), "no archived student, no other class");
    assert.equal(byId.get(kid["live"]!)!.claimCode, "LVE2Q7");
    assert.equal(byId.get(kid["expired"]!)!.claimCode, null);
    assert.equal(byId.get(kid["none"]!)!.claimCode, null);
  });

  it("POST mints the missing codes and never replaces a live one", async () => {
    const res = await call(on, "POST", `/classes/${klass}/claim-codes`, teacher);
    assert.equal(res.status, 201, res.text);
    assert.equal(res.json.minted, 2);
    assert.equal((await codeOf(kid["live"]!)).claim_code, "LVE2Q7", "a code a family may hold keeps working");
    for (const k of ["none", "expired"]) {
      const c = await codeOf(kid[k]!);
      assert.match(c.claim_code ?? "", /^[A-HJ-NP-Z2-9]{6}$/, k);
      assert.notEqual(c.claim_code, "EXP2Q7");
      const days = (c.claim_code_expires_at!.getTime() - Date.now()) / 86_400_000;
      assert.ok(days > 29 && days <= 30, `${k}: lives 30 days, got ${days}`);
    }
    assert.equal((await codeOf(kid["archived"]!)).claim_code, null, "archived student untouched");
    assert.equal((await codeOf(kid["elsewhere"]!)).claim_code, null, "another class untouched");
    assert.ok(res.json.codes.every((c: { claimCode: string | null }) => c.claimCode), "the answer lists every code");
  });

  it("pressing again mints nothing and changes nothing", async () => {
    const before = await codeOf(kid["none"]!);
    const res = await call(on, "POST", `/classes/${klass}/claim-codes`, teacher);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.minted, 0);
    assert.equal((await codeOf(kid["none"]!)).claim_code, before.claim_code);
  });

  it("a minted code signs a parent up for that child", async () => {
    const code = (await codeOf(kid["none"]!)).claim_code!;
    const res = await call(on, "POST", "/auth/redeem", undefined, { ...TERMS, claimCode: code, role: "parent" });
    assert.equal(res.status, 201, res.text);
    const links = await q<{ student_id: string; relation: string }>(
      `SELECT student_id, relation FROM roster_links WHERE user_id = $1`,
      [res.json.user.id],
    );
    assert.deepEqual(links, [{ student_id: kid["none"], relation: "guardian" }]);
  });

  it("another teacher gets 404 on both, and nothing is written", async () => {
    const before = await codeOf(kid["expired"]!);
    assert.equal((await call(on, "GET", `/classes/${klass}/claim-codes`, otherTeacher)).status, 404);
    assert.equal((await call(on, "POST", `/classes/${klass}/claim-codes`, otherTeacher)).status, 404);
    assert.equal((await codeOf(kid["expired"]!)).claim_code, before.claim_code);
  });

  it("with parent and student accounts off, both refuse with student_accounts_disabled", async () => {
    const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
    try {
      for (const method of ["GET", "POST"]) {
        const res = await call(off, method, `/classes/${klass}/claim-codes`, teacher);
        assert.equal(res.status, 403, `${method}: ${res.text}`);
        assert.equal(res.json.code, "student_accounts_disabled");
      }
    } finally {
      await off.stop();
    }
  });
});
