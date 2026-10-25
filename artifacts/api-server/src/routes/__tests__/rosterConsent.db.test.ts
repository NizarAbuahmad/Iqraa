/**
 * The roster consent gate (`lib/rosterConsent.ts`), against a real database.
 *
 * A student row is personal data about a minor, so a teacher who has not
 * attested that their school holds the parental consent cannot WRITE under
 * /classes or /students. Reads stay open on purpose. No test asserted any of
 * this by its code before; the other DB tests set `roster_consent_at` on their
 * teachers precisely so the gate would not get in the way.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

describeDb("roster consent gate", () => {
  // Read from the server's own refusal rather than imported: lib/rosterConsent.ts
  // pulls in the database client, which source-level tests cannot load.
  let ROSTER_CONSENT_VERSION = "";
  let db: TestDb;
  let on: TestServer;
  let teacher: string;
  let studentId: string;

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  before(async () => {
    db = await setupTestDb();
    // No roster_consent_at: this teacher has not attested.
    teacher = (
      await q<{ id: string }>(`INSERT INTO users (first_name, last_name, role, email) VALUES ('T', 'T', 'teacher', 't@example.test') RETURNING id`)
    )[0].id;
    studentId = (await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'طالب') RETURNING id`, [teacher]))[0].id;
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  const refused = (res: { status: number; json: any }) => {
    assert.equal(res.status, 403);
    assert.equal(res.json.code, "roster_consent_required");
    assert.match(res.json.consentVersion, /^\d{4}-\d{2}-\d{2}\.v\d+$/);
    // Every refusal names the same current version.
    if (!ROSTER_CONSENT_VERSION) ROSTER_CONSENT_VERSION = res.json.consentVersion;
    assert.equal(res.json.consentVersion, ROSTER_CONSENT_VERSION);
  };

  it("a teacher who has not attested cannot write: create a class, delete or reissue for a student", async () => {
    refused(await call(on, "POST", "/classes", teacher, { name: "10A" }));
    assert.deepEqual(await q(`SELECT 1 FROM class_groups`), [], "no class was created");

    refused(await call(on, "DELETE", `/students/${studentId}`, teacher));
    assert.equal((await q(`SELECT 1 FROM students WHERE id = $1`, [studentId])).length, 1, "the student is still there");

    refused(await call(on, "POST", `/students/${studentId}/links/${teacher}/login-code`, teacher));
  });

  it("reads stay open: the same teacher can list classes and students", async () => {
    const classes = await call(on, "GET", "/classes", teacher);
    assert.equal(classes.status, 200, classes.text);
    const list = await call(on, "GET", "/students", teacher);
    assert.equal(list.status, 200, list.text);
  });

  it("no token is a 401, not the consent refusal", async () => {
    const res = await call(on, "POST", "/classes", undefined, { name: "10A" });
    assert.equal(res.status, 401);
    assert.notEqual(res.json?.code, "roster_consent_required");
  });

  it("recording the attestation with an out-of-date statement version is refused and records nothing", async () => {
    const res = await call(on, "POST", "/auth/roster-consent", teacher, { version: "1999-01-01.v0" });
    assert.equal(res.status, 409);
    assert.equal(res.json.code, "roster_consent_version_mismatch");
    const [u] = await q<{ roster_consent_at: Date | null }>(`SELECT roster_consent_at FROM users WHERE id = $1`, [teacher]);
    assert.equal(u.roster_consent_at, null);
    refused(await call(on, "POST", "/classes", teacher, { name: "10A" }));
  });

  describe("after the teacher attests", () => {
    it("records the time and the version, and then the same writes go through", async () => {
      const grant = await call(on, "POST", "/auth/roster-consent", teacher, { version: ROSTER_CONSENT_VERSION });
      assert.equal(grant.status, 200, grant.text);
      assert.equal(grant.json.rosterConsentVersion, ROSTER_CONSENT_VERSION);
      const [u] = await q<{ roster_consent_at: Date | null; roster_consent_version: string | null }>(
        `SELECT roster_consent_at, roster_consent_version FROM users WHERE id = $1`,
        [teacher],
      );
      assert.ok(u.roster_consent_at);
      assert.equal(u.roster_consent_version, ROSTER_CONSENT_VERSION);

      const made = await call(on, "POST", "/classes", teacher, { name: "10A" });
      assert.equal(made.status, 201, made.text);
      assert.equal((await q(`SELECT 1 FROM class_groups WHERE teacher_id = $1`, [teacher])).length, 1);

      const del = await call(on, "DELETE", `/students/${studentId}`, teacher);
      assert.notEqual(del.status, 403, "the gate no longer stands in the way");
    });

    it("attesting is idempotent: doing it again moves the timestamp and keeps the version", async () => {
      const [before] = await q<{ roster_consent_at: Date }>(`SELECT roster_consent_at FROM users WHERE id = $1`, [teacher]);
      await new Promise(r => setTimeout(r, 20));
      const again = await call(on, "POST", "/auth/roster-consent", teacher, {});
      assert.equal(again.status, 200, again.text);
      const [after] = await q<{ roster_consent_at: Date; roster_consent_version: string }>(
        `SELECT roster_consent_at, roster_consent_version FROM users WHERE id = $1`,
        [teacher],
      );
      assert.ok(after.roster_consent_at > before.roster_consent_at);
      assert.equal(after.roster_consent_version, ROSTER_CONSENT_VERSION);
    });
  });
});
