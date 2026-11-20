/**
 * The teacher newsletter routes, against a real database through the built bundle, with
 * Resend replaced by a local stub (no mail leaves the machine).
 *
 * What this guards: only a system admin may use them; an issue cannot be sent unless that
 * exact text was test-sent first, and not after 24 hours; a test reaches the admin alone;
 * a send reaches verified, unsuspended teachers and school admins who have not unsubscribed,
 * and nobody else; a second send of one issue mails nobody again; and a refused batch leaves
 * its teachers eligible for the retry.
 */
import { after, before, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { startResendStub, type ResendStub } from "../../test-support/resendStub.ts";
import { call } from "../../test-support/http.ts";

describeDb("teacher newsletter", () => {
  let db: TestDb;
  let server: TestServer;
  let stub: ResendStub;
  let admin: string;
  let principal: string;
  let ayla: string;

  const SUBJECT = "جديد إقرأ هذا الشهر · What's new in Iqrra";
  const BODY = "شارك موادك برابط\nhttps://app.iqrra.com/ai-tools/lesson-plan\n\nShare your materials by link";
  const mail = (name: string) => `${name.toLowerCase()}@example.test`;

  const addUser = async (name: string, role: string, extra: Record<string, unknown> = {}): Promise<string> => {
    const cols = ["first_name", "last_name", "role", "email", "email_verified", ...Object.keys(extra)];
    const vals = [name, "Test", role, mail(name), true, ...Object.values(extra)];
    // A key in `extra` that repeats a base column overrides it: keep the last value per column.
    const merged = new Map<string, unknown>();
    cols.forEach((c, i) => merged.set(c, vals[i]));
    const names = [...merged.keys()];
    const ph = names.map((_, i) => `$${i + 1}`).join(", ");
    return (
      await db.pool.query<{ id: string }>(`INSERT INTO users (${names.join(", ")}) VALUES (${ph}) RETURNING id`, [...merged.values()])
    ).rows[0]!.id;
  };
  const test = (subject = SUBJECT, body = BODY) => call(server, "POST", "/admin/newsletter/test", admin, { subject, body });
  const send = (issueId: string, subject = SUBJECT, body = BODY) =>
    call(server, "POST", "/admin/newsletter/send", admin, { issueId, subject, body });
  const recipients = () => stub.mails().map(m => m.to).sort();

  before(async () => {
    db = await setupTestDb();
    stub = await startResendStub();
    server = await startServer({
      databaseUrl: db.url,
      env: { RESEND_API_KEY: "re_test_key", RESEND_API_URL: stub.url },
    });
    admin = await addUser("Admin", "system_admin");
    principal = await addUser("Principal", "school_admin");
    ayla = await addUser("Ayla", "teacher");
    await addUser("Basel", "teacher"); // unsubscribed, below
    await addUser("Carmen", "teacher", { email_verified: false });
    await addUser("Dina", "teacher", { suspended_at: new Date().toISOString() });
    await addUser("Eman", "student");
    await addUser("Fadi", "parent");
    await db.pool.query(`INSERT INTO email_suppressions (email, source) VALUES ($1, 'link')`, [mail("Basel")]);
  });

  after(async () => {
    await server?.stop();
    await stub?.close();
    await db?.drop();
  });

  it("is for a system admin only", async () => {
    for (const who of [principal, ayla]) {
      assert.equal((await call(server, "GET", "/admin/newsletter", who)).status, 403);
      assert.equal((await call(server, "POST", "/admin/newsletter/test", who, { subject: SUBJECT, body: BODY })).status, 403);
      assert.equal(
        (await call(server, "POST", "/admin/newsletter/send", who, { issueId: crypto.randomUUID(), subject: SUBJECT, body: BODY })).status,
        403,
      );
    }
    assert.equal((await call(server, "GET", "/admin/newsletter")).status, 401);
    assert.equal(stub.mails().length, 0);
  });

  it("counts who would receive an issue, before any was sent", async () => {
    const res = await call(server, "GET", "/admin/newsletter", admin);
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { lastSentAt: null, eligible: 2, unsubscribed: 1 });
  });

  it("refuses a send that was never tested, and mails nobody", async () => {
    const res = await send(crypto.randomUUID());
    assert.equal(res.status, 409);
    assert.equal(res.json.error, "not-tested");
    assert.equal(stub.mails().length, 0);
  });

  it("refuses malformed input", async () => {
    assert.equal((await test("ab", BODY)).json.error, "subject");
    assert.equal((await test(SUBJECT, "short")).json.error, "body");
    const bad = await call(server, "POST", "/admin/newsletter/send", admin, { issueId: "nope", subject: SUBJECT, body: BODY });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.error, "issueId");
  });

  it("sends the test to the admin alone, then sends that exact text to the teachers once", async () => {
    stub.clear();
    const tested = await test();
    assert.equal(tested.status, 200, tested.text);
    assert.equal(tested.json.sentTo, mail("Admin"));
    assert.deepEqual(recipients(), [mail("Admin")]);
    assert.match(stub.mails()[0]!.subject, /^\[تجريبي\] /);
    const issueId: string = tested.json.issueId;

    // One changed character after the test: refused, nobody mailed.
    stub.clear();
    const edited = await send(issueId, SUBJECT, `${BODY}.`);
    assert.equal(edited.status, 409);
    assert.equal(edited.json.error, "not-tested");
    assert.equal(stub.mails().length, 0);

    const sent = await send(issueId);
    assert.equal(sent.status, 200, sent.text);
    assert.deepEqual(sent.json, { sent: 2, failed: 0, skipped: 1 });
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);
    const one = stub.mails()[0]!;
    assert.equal(one.subject, SUBJECT);
    assert.match(one.html, /You received this because you have a teacher account on Iqrra\./);
    assert.match(one.html, /\/api\/email\/unsubscribe\?t=/);
    assert.match(one.html, /<p dir="rtl"/);
    assert.match(one.html, /<p dir="ltr"/);
    assert.equal(one.headers?.["List-Unsubscribe-Post"], "List-Unsubscribe=One-Click");

    // Pressing send again mails nobody a second time.
    stub.clear();
    const again = await send(issueId);
    assert.equal(again.status, 200);
    assert.equal(again.json.sent, 0);
    assert.equal(stub.mails().length, 0);

    const info = await call(server, "GET", "/admin/newsletter", admin);
    assert.ok(info.json.lastSentAt, "the issue is recorded as sent");
  });

  it("keeps teachers eligible when the provider refuses the batch, and reaches them on the retry", async () => {
    const tested = await test(SUBJECT, `${BODY}\n\nSecond issue`);
    const issueId: string = tested.json.issueId;
    stub.clear();
    stub.failNext(500);
    const failed = await send(issueId, SUBJECT, `${BODY}\n\nSecond issue`);
    assert.equal(failed.status, 200);
    assert.deepEqual(failed.json, { sent: 0, failed: 2, skipped: 1 });
    assert.equal(stub.mails().length, 0);

    const retry = await send(issueId, SUBJECT, `${BODY}\n\nSecond issue`);
    assert.equal(retry.json.sent, 2);
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);
  });

  it("refuses a test older than 24 hours", async () => {
    const tested = await test(SUBJECT, `${BODY}\n\nThird issue`);
    await db.pool.query(`UPDATE newsletter_issues SET tested_at = now() - interval '25 hours' WHERE id = $1`, [tested.json.issueId]);
    stub.clear();
    const res = await send(tested.json.issueId, SUBJECT, `${BODY}\n\nThird issue`);
    assert.equal(res.status, 409);
    assert.equal(res.json.error, "test-expired");
    assert.equal(stub.mails().length, 0);
  });

  it("a new test replaces the unsent draft, so its id no longer sends", async () => {
    const first = await test(SUBJECT, `${BODY}\n\nFourth issue`);
    const second = await test(SUBJECT, `${BODY}\n\nFifth issue`);
    assert.notEqual(first.json.issueId, second.json.issueId);
    const stale = await send(first.json.issueId, SUBJECT, `${BODY}\n\nFourth issue`);
    assert.equal(stale.status, 409);
    assert.equal(stale.json.error, "not-tested");
  });
});
