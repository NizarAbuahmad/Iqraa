/**
 * Parent approval for email students (spec: docs/superpowers/specs/2026-10-24-guardian-approval-design.md), against
 * a real database through the built bundle. `on` runs with GUARDIAN_APPROVAL=true, `off` without it.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");

describeDb("parent approval for email students", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let n = 0;

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  /** A user row. `email: null` is a code-only account; `approved` sets guardian_approved_at. */
  async function mkUser(role: string, o: { email?: string | null; approved?: boolean; verified?: boolean } = {}) {
    n += 1;
    const email = o.email === undefined ? `u${n}@example.test` : o.email;
    return (
      await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email, email_verified, guardian_approved_at)
         VALUES ($1, 'T', $2, $3, $4, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
        [`Kid${n}`, role, email, o.verified ?? email !== null, o.approved ?? false],
      )
    )[0].id;
  }

  /** An issued consent row with a known token. */
  async function mkConsent(
    userId: string,
    o: { token?: string; expires?: string; decided?: "approved" | "declined"; superseded?: boolean; parent?: string } = {},
  ) {
    const token = o.token ?? newToken();
    await q(
      `INSERT INTO guardian_consents (user_id, parent_email, token_hash, sent_at, expires_at, decided_at, decision, superseded_at)
       VALUES ($1, $2, $3, now(), now() + $4::interval, CASE WHEN $5::text IS NOT NULL THEN now() END, $5::text,
               CASE WHEN $6::boolean THEN now() END)`,
      [userId, o.parent ?? "parent@example.test", sha(token), o.expires ?? "7 days", o.decided ?? null, o.superseded ?? false],
    );
    return token;
  }

  before(async () => {
    db = await setupTestDb();
    on = await startServer({ databaseUrl: db.url, env: { GUARDIAN_APPROVAL: "true" } });
    off = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await off?.stop();
    await db?.drop();
  });

  describe("the parent's public page", () => {
    it("config says whether the flag is on, with or without it", async () => {
      assert.deepEqual((await call(on, "GET", "/guardian-consent/config")).json, { enabled: true });
      assert.deepEqual((await call(off, "GET", "/guardian-consent/config")).json, { enabled: false });
    });

    it("an open link shows the child's first name and nothing else", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const res = await call(on, "GET", `/guardian-consent/${token}`);
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(res.json, { status: "open", childFirstName: res.json.childFirstName });
      assert.match(res.json.childFirstName, /^Kid\d+$/);
      assert.deepEqual(Object.keys(res.json).sort(), ["childFirstName", "status"]);
    });

    it("an unknown, malformed, expired, decided or superseded link says so", async () => {
      const kid = await mkUser("student");
      const status = async (t: string) => (await call(on, "GET", `/guardian-consent/${t}`)).json.status;
      assert.equal(await status(newToken()), "invalid");
      assert.equal(await status("not-a-token"), "invalid");
      assert.equal(await status(await mkConsent(kid, { expires: "-1 day" })), "expired");
      assert.equal(await status(await mkConsent(kid, { decided: "declined" })), "decided");
      assert.equal(await status(await mkConsent(kid, { superseded: true })), "invalid");
    });

    it("approving needs the parent's confirmation, a valid decision, and then unlocks the student once", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const bad = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "maybe" });
      assert.equal(bad.status, 400);
      assert.equal(bad.json.code, "decision_invalid");
      const unticked = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved" });
      assert.equal(unticked.status, 400);
      assert.equal(unticked.json.code, "guardian_confirmation_required");
      const [before] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(before.guardian_approved_at, null, "a refused approval changes nothing");

      const ok = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(ok.status, 200, ok.text);
      assert.deepEqual(ok.json, { decision: "approved" });
      const [after] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.ok(after.guardian_approved_at);

      const again = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(again.status, 410);
      assert.equal(again.json.code, "consent_link_unusable");
      assert.equal((await call(on, "GET", `/guardian-consent/${token}`)).json.status, "decided");
    });

    it("declining records the decision and leaves the account locked; it needs no confirmation tick", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const res = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "declined" });
      assert.equal(res.status, 200, res.text);
      const [u] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(u.guardian_approved_at, null);
      const [c] = await q<{ decision: string; decided_at: Date }>(`SELECT decision, decided_at FROM guardian_consents WHERE token_hash = $1`, [sha(token)]);
      assert.equal(c.decision, "declined");
      assert.ok(c.decided_at);
    });

    it("an expired, superseded or unknown link cannot be decided (410) and changes nothing", async () => {
      const kid = await mkUser("student");
      for (const token of [await mkConsent(kid, { expires: "-1 day" }), await mkConsent(kid, { superseded: true }), newToken()]) {
        const res = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
        assert.equal(res.status, 410, token);
      }
      const [u] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(u.guardian_approved_at, null);
    });

    it("two parents clicking at once: exactly one wins", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const body = { decision: "approved", confirmGuardian: true };
      const results = await Promise.all([1, 2, 3].map(() => call(on, "POST", `/guardian-consent/${token}`, undefined, body)));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 410, 410]);
    });

    it("never writes the link's token to the request log, but still logs the request", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      await call(on, "GET", `/guardian-consent/${token}`);
      await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "declined" });
      await call(on, "GET", "/guardian-consent/config");
      await new Promise(r => setTimeout(r, 500));
      const logs = on.logs();
      assert.ok(!logs.includes(token), "the bearer token reached the server log");
      assert.ok(logs.includes("/guardian-consent/:token"), "the request was not logged at all, so the check proves nothing");
      assert.ok(logs.includes("/guardian-consent/config"), "the config path must stay readable");
    });

    it("with the flag off the page and the decision are closed (404), only config answers", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const get = await call(off, "GET", `/guardian-consent/${token}`);
      assert.equal(get.status, 404);
      assert.equal(get.json.code, "guardian_approval_disabled");
      const post = await call(off, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(post.status, 404);
    });
  });
});
