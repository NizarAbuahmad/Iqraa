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
    // No mail key: the parent's link is then logged (outside production) instead of sent, which is how tests read it.
    on = await startServer({ databaseUrl: db.url, env: { GUARDIAN_APPROVAL: "true", RESEND_API_KEY: undefined } });
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
      // Express routes paths case-insensitively, so this spelling reaches the same handler.
      await call(on, "GET", `/Guardian-Consent/${token}`);
      await call(on, "GET", "/guardian-consent/config");
      // The server's log reaches us through a pipe, at its own pace. Lines are written in request order, so once the
      // last request's line (config) is here the earlier ones are too.
      const wanted = ["/guardian-consent/:token", "/Guardian-Consent/:token", "/guardian-consent/config"];
      const deadline = Date.now() + 10_000;
      while (!wanted.every(w => on.logs().includes(w)) && Date.now() < deadline) {
        await new Promise(r => setTimeout(r, 100));
      }
      const logs = on.logs();
      for (const w of wanted) {
        assert.ok(logs.includes(w), `${w} never appeared in the server log, so the check proves nothing`);
      }
      assert.ok(!logs.includes(token), "the bearer token reached the server log");
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

  describe("the gate", () => {
    async function linked(userId: string) {
      const teacher = await mkUser("teacher");
      const [stu] = await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x') RETURNING id`, [teacher]);
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [stu.id, userId]);
    }
    const blocked = (r: { status: number; json: any }) => {
      assert.equal(r.status, 403);
      assert.equal(r.json.code, "guardian_approval_required");
    };

    it("holds a pending email student on a route from each router, and lets the allowlist through", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      blocked(await call(on, "GET", "/messaging/contacts", kid));
      blocked(await call(on, "POST", "/auth/role", kid, { role: "parent" }));
      blocked(await call(on, "POST", "/auth/add-email", kid, { email: "x@example.test", password: "Sufficiently1Strong!" }));
      blocked(await call(on, "GET", "/auth/me/ai-usage", kid));

      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.status, 200, me.text);
      const claim = await call(on, "GET", "/auth/claim", kid);
      assert.notEqual(claim.status, 403, "joining a class with a teacher's code stays open");
    });

    it("never holds a code-only student, a linked student, an approved student, a teacher or a parent", async () => {
      const codeOnly = await mkUser("student", { email: null });
      const linkedKid = await mkUser("student");
      await linked(linkedKid);
      const approved = await mkUser("student", { approved: true });
      const teacher = await mkUser("teacher");
      const parent = await mkUser("parent");
      for (const id of [codeOnly, linkedKid, approved]) {
        const r = await call(on, "GET", "/student/exams", id);
        assert.equal(r.status, 200, `${id}: ${r.text}`);
      }
      assert.notEqual((await call(on, "GET", "/classes", teacher)).status, 403);
      assert.notEqual((await call(on, "GET", "/parent/exams", parent)).json?.code, "guardian_approval_required");
    });

    it("is inert with the flag off: the same pending student reaches everything", async () => {
      const kid = await mkUser("student");
      const r = await call(off, "GET", "/student/exams", kid);
      assert.equal(r.status, 200, r.text);
    });

    it("lifts the moment a parent approves, without a new sign-in", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      const token = await mkConsent(kid);
      assert.equal((await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true })).status, 200);
      assert.equal((await call(on, "GET", "/student/exams", kid)).status, 200);
    });

    it("lifts when a teacher's per-student code links the account", async () => {
      const kid = await mkUser("student");
      blocked(await call(on, "GET", "/student/exams", kid));
      await linked(kid);
      assert.equal((await call(on, "GET", "/student/exams", kid)).status, 200);
    });
  });

  describe("asking for approval and reading the status", () => {
    /** Every parent link the `on` server has logged so far, oldest first. */
    const links = () => [...on.logs().matchAll(/\/guardian\/([A-Za-z0-9_-]{43})/g)].map(m => m[1]);
    /** The server's log reaches us through a pipe, at its own pace, so a link is polled for rather than assumed. */
    async function linkCountReaches(count: number) {
      const deadline = Date.now() + 10_000;
      while (links().length < count && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
      assert.ok(links().length >= count, `the ${count}th parent link never appeared in the server log (saw ${links().length})`);
    }
    const askRaw = (userId: string, parentEmail: unknown) => call(on, "POST", "/auth/guardian-request", userId, { parentEmail });
    /** Asks, and on success waits until the link this request mailed is in the log, so `links().at(-1)` is its own. */
    async function ask(userId: string, parentEmail: unknown) {
      const before = links().length;
      const res = await askRaw(userId, parentEmail);
      if (res.status === 200) await linkCountReaches(before + 1);
      return res;
    }

    it("a pending student asks: a link is issued once, the row is stored hashed, and /me says waiting", async () => {
      const kid = await mkUser("student");
      const me0 = await call(on, "GET", "/auth/me", kid);
      assert.equal(me0.json.guardianStatus, "needed");
      assert.equal(me0.json.guardianParentEmailMasked, undefined);

      const before = links().length;
      const res = await ask(kid, " Mum@Example.test ");
      // A held student is let through the gate to this route, so it must not be answered with the hold itself.
      assert.notEqual(res.json?.code, "guardian_approval_required");
      assert.equal(res.status, 200, res.text);
      assert.equal(res.json.parentEmailMasked, "mu***@example.test");
      assert.equal(typeof res.json.emailSent, "boolean");
      assert.equal(links().length, before + 1, "exactly one link was issued");
      const token = links().at(-1)!;

      const [row] = await q<{ parent_email: string; token_hash: string; expires_at: Date }>(
        `SELECT parent_email, token_hash, expires_at FROM guardian_consents WHERE user_id = $1`,
        [kid],
      );
      assert.equal(row.parent_email, "mum@example.test");
      assert.equal(row.token_hash, sha(token));
      assert.ok(Math.abs(row.expires_at.getTime() - (Date.now() + 7 * 86400_000)) < 60_000, "seven days");

      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "waiting");
      assert.equal(me.json.guardianParentEmailMasked, "mu***@example.test");
      assert.equal((await call(on, "GET", `/guardian-consent/${token}`)).json.status, "open");
    });

    it("asking again supersedes the old link: only the newest one works", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      const first = links().at(-1)!;
      assert.equal((await ask(kid, "b@example.test")).status, 200);
      const second = links().at(-1)!;
      assert.notEqual(first, second);
      assert.equal((await call(on, "GET", `/guardian-consent/${first}`)).json.status, "invalid");
      assert.equal((await call(on, "GET", `/guardian-consent/${second}`)).json.status, "open");
    });

    it("a declined student can ask again with another address and is then waiting again", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      await call(on, "POST", `/guardian-consent/${links().at(-1)}`, undefined, { decision: "declined" });
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "declined");
      assert.equal((await ask(kid, "b@example.test")).status, 200);
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "waiting");
    });

    it("refuses a missing, malformed or own address (400) before issuing anything", async () => {
      const kid = await mkUser("student", { email: "kid@example.test" });
      const before = links().length;
      for (const [value, code] of [[undefined, "parent_email_required"], ["nope", "parent_email_invalid"], ["KID@example.test", "parent_email_is_own"]] as const) {
        const r = await ask(kid, value);
        assert.equal(r.status, 400, String(value));
        assert.equal(r.json.code, code);
      }
      assert.equal(links().length, before);
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents WHERE user_id = $1`, [kid]), []);
    });

    it("needs the student's own email verified first (409)", async () => {
      const kid = await mkUser("student", { verified: false });
      const r = await ask(kid, "p@example.test");
      assert.equal(r.status, 409);
      assert.equal(r.json.code, "email_not_verified");
    });

    it("is not for anyone who is not held: approved, linked, code-only, teacher (409 or 403, nothing queued)", async () => {
      const approved = await mkUser("student", { approved: true });
      const r = await ask(approved, "p@example.test");
      assert.equal(r.status, 409);
      assert.equal(r.json.code, "guardian_already_approved");
      const teacher = await mkUser("teacher");
      const t = await ask(teacher, "p@example.test");
      assert.equal(t.status, 409);
      assert.equal(t.json.code, "guardian_not_required");
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents WHERE user_id = ANY($1::uuid[])`, [[approved, teacher]]), []);
    });

    it("stops at 3 requests a day per student and 5 a day per parent address (429)", async () => {
      const kid = await mkUser("student");
      for (let i = 0; i < 3; i += 1) assert.equal((await ask(kid, `p${i}@example.test`)).status, 200, `request ${i + 1}`);
      const over = await ask(kid, "p9@example.test");
      assert.equal(over.status, 429);
      assert.equal(over.json.code, "guardian_rate_limited");

      for (let i = 0; i < 5; i += 1) {
        const other = await mkUser("student");
        assert.equal((await ask(other, "shared@example.test")).status, 200, `student ${i + 1}`);
      }
      const sixth = await mkUser("student");
      assert.equal((await ask(sixth, "shared@example.test")).status, 429);
    });

    it("with the flag off the route does not exist for them (404) and /me says not_required", async () => {
      const kid = await mkUser("student");
      const r = await call(off, "POST", "/auth/guardian-request", kid, { parentEmail: "p@example.test" });
      assert.equal(r.status, 404);
      assert.equal(r.json.code, "guardian_approval_disabled");
      assert.equal((await call(off, "GET", "/auth/me", kid)).json.guardianStatus, "not_required");
    });

    it("/me says not_required for a teacher, a code-only student and a linked student, approved for an approved one", async () => {
      const teacher = await mkUser("teacher");
      const codeOnly = await mkUser("student", { email: null });
      const approved = await mkUser("student", { approved: true });
      assert.equal((await call(on, "GET", "/auth/me", teacher)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", codeOnly)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", approved)).json.guardianStatus, "approved");
    });
  });
});
