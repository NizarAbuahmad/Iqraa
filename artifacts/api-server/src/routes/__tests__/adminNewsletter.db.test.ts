/**
 * The teacher newsletter routes, against a real database through the built bundle, with
 * Resend replaced by a local stub (no mail leaves the machine).
 *
 * What this guards: only a system admin may use them; an issue cannot be sent unless that
 * exact text was test-sent first, and not after 24 hours; a test reaches the admin alone;
 * a send reaches verified, unsuspended teachers and school admins who have not unsubscribed,
 * and nobody else; a second send of one issue mails nobody again; and a refused batch leaves
 * its teachers eligible for the retry. Re-testing identical text after a send resumes that
 * issue; only the admin who got the test copy may send; and a run mails only the teachers
 * whose record its own insert wrote.
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
  let admin2: string;
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
    admin2 = await addUser("Admin2", "system_admin");
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

  // The second admin carries the cases below: the first is near the hourly limit.
  const test2 = (body: string) => call(server, "POST", "/admin/newsletter/test", admin2, { subject: SUBJECT, body });
  const send2 = (issueId: string, body: string) =>
    call(server, "POST", "/admin/newsletter/send", admin2, { issueId, subject: SUBJECT, body });
  const sendsOf = async (issueId: string) =>
    Number((await db.pool.query(`SELECT count(*) FROM newsletter_sends WHERE issue_id = $1`, [issueId])).rows[0].count);

  it("a send in progress blocks a second send and a new test", async () => {
    const body = `${BODY}\n\nSixth issue`;
    const tested = await test2(body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    await db.pool.query(`UPDATE newsletter_issues SET sending_at = now() WHERE id = $1`, [issueId]);
    stub.clear();
    const second = await send2(issueId, body);
    assert.equal(second.status, 409);
    assert.equal(second.json.error, "sending");
    const another = await test2(`${BODY}\n\nSeventh issue`);
    assert.equal(another.status, 409);
    assert.equal(another.json.error, "sending");
    assert.equal(stub.mails().length, 0);
    const rows = await db.pool.query(`SELECT 1 FROM newsletter_issues WHERE id = $1`, [issueId]);
    assert.equal(rows.rowCount, 1);
  });

  it("a stale claim is taken", async () => {
    const body = `${BODY}\n\nEighth issue`;
    await db.pool.query(`UPDATE newsletter_issues SET sending_at = NULL WHERE sending_at IS NOT NULL`);
    const tested = await test2(body);
    const issueId: string = tested.json.issueId;
    await db.pool.query(`UPDATE newsletter_issues SET sending_at = now() - interval '11 minutes' WHERE id = $1`, [issueId]);
    stub.clear();
    const res = await send2(issueId, body);
    assert.equal(res.status, 200, res.text);
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);
    const row = await db.pool.query(`SELECT sending_at FROM newsletter_issues WHERE id = $1`, [issueId]);
    assert.equal(row.rows[0].sending_at, null);
  });

  it("who is mailed is recorded, and only them", async () => {
    const body = `${BODY}\n\nNinth issue`;
    const tested = await test2(body);
    const issueId: string = tested.json.issueId;
    stub.clear();
    assert.equal((await send2(issueId, body)).status, 200);
    assert.equal(await sendsOf(issueId), stub.mails().length);
    assert.equal(stub.mails().length, 2);

    const body2 = `${BODY}\n\nTenth issue`;
    const t2 = await test2(body2);
    stub.clear();
    stub.failNext(500);
    const failed = await send2(t2.json.issueId, body2);
    assert.deepEqual(failed.json, { sent: 0, failed: 2, skipped: 1 });
    assert.equal(await sendsOf(t2.json.issueId), 0);
  });

  it("a new test never deletes an issue that already has recipients", async () => {
    const body = `${BODY}\n\nEleventh issue`;
    const tested = await test2(body);
    const issueId: string = tested.json.issueId;
    assert.equal((await send2(issueId, body)).status, 200);
    const mailed = await sendsOf(issueId);
    assert.equal(mailed, 2);
    // Simulate the stamp that never landed after the provider took the mail.
    await db.pool.query(`UPDATE newsletter_issues SET sent_at = NULL WHERE id = $1`, [issueId]);
    const next = await test2(`${BODY}\n\nTwelfth issue`);
    assert.equal(next.status, 200, next.text);
    const rows = await db.pool.query(`SELECT 1 FROM newsletter_issues WHERE id = $1`, [issueId]);
    assert.equal(rows.rowCount, 1);
    assert.equal(await sendsOf(issueId), mailed);
  });

  // Each case below has admins of its own: every admin may make 20 limited POSTs an hour.
  const testAs = (who: string, body: string) => call(server, "POST", "/admin/newsletter/test", who, { subject: SUBJECT, body });
  const sendAs = (who: string, issueId: string, body: string) =>
    call(server, "POST", "/admin/newsletter/send", who, { issueId, subject: SUBJECT, body });

  it("re-testing the identical text after a send resumes that issue, and mails no teacher twice", async () => {
    const admin3 = await addUser("Admin3", "system_admin");
    const body = `${BODY}\n\nResumed issue`;
    const tested = await testAs(admin3, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    const first = await sendAs(admin3, issueId, body);
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json.sent, 2);

    await db.pool.query(`UPDATE newsletter_issues SET tested_at = now() - interval '25 hours' WHERE id = $1`, [issueId]);
    const expired = await sendAs(admin3, issueId, body);
    assert.equal(expired.status, 409);
    assert.equal(expired.json.error, "test-expired");

    stub.clear();
    const again = await testAs(admin3, body);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.json.issueId, issueId, "the same issue, not a new one");
    const resumed = await sendAs(admin3, issueId, body);
    assert.equal(resumed.status, 200, resumed.text);
    assert.equal(resumed.json.sent, 0);
    assert.deepEqual(recipients(), [mail("Admin3")], "only the test copy; no teacher mailed again");
  });

  it("only the admin who received the test copy may send it", async () => {
    const a = await addUser("Admin4", "system_admin");
    const b = await addUser("Admin5", "system_admin");
    const body = `${BODY}\n\nWho tested it`;
    const tested = await testAs(a, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;

    stub.clear();
    const notMine = await sendAs(b, issueId, body);
    assert.equal(notMine.status, 409);
    assert.equal(notMine.json.error, "not-tested");
    assert.equal(stub.mails().length, 0);

    const mine = await sendAs(a, issueId, body);
    assert.equal(mine.status, 200, mine.text);
    assert.equal(mine.json.sent, 2);

    // B tests the identical text: the issue becomes B's, and B may send it, to nobody new.
    const bTested = await testAs(b, body);
    assert.equal(bTested.status, 200, bTested.text);
    assert.equal(bTested.json.issueId, issueId);
    const bSend = await sendAs(b, issueId, body);
    assert.equal(bSend.status, 200, bSend.text);
    assert.equal(bSend.json.sent, 0);
    assert.deepEqual(recipients(), [mail("Admin5"), mail("Ayla"), mail("Principal")]);
  });

  it("a teacher already recorded for the issue is not mailed", async () => {
    const admin6 = await addUser("Admin6", "system_admin");
    const body = `${BODY}\n\nAlready recorded`;
    const tested = await testAs(admin6, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    await db.pool.query(`INSERT INTO newsletter_sends (issue_id, user_id) VALUES ($1, $2)`, [issueId, ayla]);
    stub.clear();
    const res = await sendAs(admin6, issueId, body);
    assert.equal(res.status, 200, res.text);
    assert.equal(res.json.sent, 1);
    assert.deepEqual(recipients(), [mail("Principal")]);
  });

  it("a row another run writes between this run's read and its write is not mailed by this run", async () => {
    const admin7 = await addUser("Admin7", "system_admin");
    const body = `${BODY}\n\nOverlapping runs`;
    const tested = await testAs(admin7, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    // Stands in for an overlapping run: Ayla's row lands just before this run's write-ahead insert.
    await db.pool.query(`
      CREATE FUNCTION newsletter_overlap() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF pg_trigger_depth() = 1 THEN
          INSERT INTO newsletter_sends (issue_id, user_id) VALUES ('${issueId}', '${ayla}') ON CONFLICT DO NOTHING;
        END IF;
        RETURN NULL;
      END $$;
      CREATE TRIGGER newsletter_overlap BEFORE INSERT ON newsletter_sends
        FOR EACH STATEMENT EXECUTE FUNCTION newsletter_overlap();`);
    try {
      stub.clear();
      const res = await sendAs(admin7, issueId, body);
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.sent, 1);
      assert.deepEqual(recipients(), [mail("Principal")]);
      assert.equal(await sendsOf(issueId), 2, "Ayla's row (the other run's) stays");
    } finally {
      await db.pool.query(`DROP TRIGGER newsletter_overlap ON newsletter_sends; DROP FUNCTION newsletter_overlap();`);
    }
  });

  const issuesWithBody = async (body: string) =>
    Number((await db.pool.query(`SELECT count(*) FROM newsletter_issues WHERE body = $1`, [body])).rows[0].count);

  it("the database refuses a second issue with the same text", async () => {
    const admin8 = await addUser("Admin8", "system_admin");
    const body = `${BODY}\n\nTwin issue`;
    const tested = await testAs(admin8, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    await assert.rejects(
      db.pool.query(
        `INSERT INTO newsletter_issues (subject, body, content_hash, created_by)
         SELECT subject, body, content_hash, created_by FROM newsletter_issues WHERE id = $1`,
        [issueId],
      ),
      (err: { code?: string }) => err.code === "23505",
    );
    assert.equal(await issuesWithBody(body), 1);
  });

  it("two tests of the same text at the same instant give one issue", async () => {
    const admin9 = await addUser("Admin9", "system_admin");
    const body = `${BODY}\n\nSimultaneous tests`;
    const [a, b] = await Promise.all([testAs(admin9, body), testAs(admin9, body)]);
    assert.equal(a.status, 200, a.text);
    assert.equal(b.status, 200, b.text);
    assert.equal(a.json.issueId, b.json.issueId, "both land on one issue");
    assert.equal(await issuesWithBody(body), 1);

    stub.clear();
    const sent = await sendAs(admin9, a.json.issueId, body);
    assert.equal(sent.status, 200, sent.text);
    assert.equal(sent.json.sent, 2);
    assert.deepEqual(recipients(), [mail("Ayla"), mail("Principal")]);

    stub.clear();
    const again = await sendAs(admin9, a.json.issueId, body);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.json.sent, 0);
    assert.equal(stub.mails().length, 0);
  });

  it("an issue whose sent stamp never landed is still resumed", async () => {
    const admin10 = await addUser("Admin10", "system_admin");
    const body = `${BODY}\n\nStamp never landed`;
    const tested = await testAs(admin10, body);
    assert.equal(tested.status, 200, tested.text);
    const issueId: string = tested.json.issueId;
    const first = await sendAs(admin10, issueId, body);
    assert.equal(first.status, 200, first.text);
    assert.equal(first.json.sent, 2);
    const mailed = await sendsOf(issueId);
    await db.pool.query(`UPDATE newsletter_issues SET sent_at = NULL WHERE id = $1`, [issueId]);

    const again = await testAs(admin10, body);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.json.issueId, issueId, "the same issue, not a new one");
    assert.equal(await sendsOf(issueId), mailed);

    stub.clear();
    const resumed = await sendAs(admin10, issueId, body);
    assert.equal(resumed.status, 200, resumed.text);
    assert.equal(resumed.json.sent, 0);
    assert.deepEqual(recipients(), [], "no teacher mailed again");
  });
});
