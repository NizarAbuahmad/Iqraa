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
import { hashResetCode } from "../../lib/passwordReset.ts";

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

  /** Links the account to a roster row of a new teacher, as a teacher's per-student code does. */
  async function linked(userId: string) {
    const teacher = await mkUser("teacher");
    const [stu] = await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x') RETURNING id`, [teacher]);
    await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [stu.id, userId]);
  }

  before(async () => {
    db = await setupTestDb();
    // No mail key: the parent's link is then logged (outside production) instead of sent, which is how tests read it.
    on = await startServer({ databaseUrl: db.url, env: { GUARDIAN_APPROVAL: "true", RESEND_API_KEY: undefined } });
    off = await startServer({ databaseUrl: db.url, env: { RESEND_API_KEY: undefined } });
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
      assert.equal(claim.status, 200, "joining a class with a teacher's code stays open");
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
      assert.equal((await call(on, "GET", "/classes", teacher)).status, 200);
      assert.equal((await call(on, "GET", "/parent/exams", parent)).status, 200);
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

    it("is not for anyone who is not held: approved, linked, code-only, teacher (409, nothing queued)", async () => {
      const approved = await mkUser("student", { approved: true });
      const r = await ask(approved, "p@example.test");
      assert.equal(r.status, 409);
      assert.equal(r.json.code, "guardian_already_approved");
      const teacher = await mkUser("teacher");
      const t = await ask(teacher, "p@example.test");
      assert.equal(t.status, 409);
      assert.equal(t.json.code, "guardian_not_required");
      const linkedKid = await mkUser("student");
      await linked(linkedKid);
      const l = await ask(linkedKid, "p@example.test");
      assert.equal(l.status, 409);
      assert.equal(l.json.code, "guardian_not_required");
      const codeOnly = await mkUser("student", { email: null });
      const c = await ask(codeOnly, "p@example.test");
      assert.equal(c.status, 409);
      assert.equal(c.json.code, "guardian_not_required");
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents WHERE user_id = ANY($1::uuid[])`, [[approved, teacher, linkedKid, codeOnly]]), []);
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
      const linkedKid = await mkUser("student");
      await linked(linkedKid);
      assert.equal((await call(on, "GET", "/auth/me", linkedKid)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", teacher)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", codeOnly)).json.guardianStatus, "not_required");
      assert.equal((await call(on, "GET", "/auth/me", approved)).json.guardianStatus, "approved");
    });

    it("/me names the parent's address for a declined request", async () => {
      const kid = await mkUser("student");
      await mkConsent(kid, { decided: "declined", parent: "nay@example.test" });
      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "declined");
      assert.equal(me.json.guardianParentEmailMasked, "na***@example.test");
    });

    it("/me says waiting for a request queued but not yet mailed", async () => {
      const kid = await mkUser("student");
      await q(`INSERT INTO guardian_consents (user_id, parent_email) VALUES ($1, 'queued@example.test')`, [kid]);
      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "waiting");
      assert.equal(me.json.guardianParentEmailMasked, "qu***@example.test");
    });

    it("/me says needed, and still names the address, once the link has expired; a fresh student gets no address", async () => {
      const kid = await mkUser("student");
      await mkConsent(kid, { expires: "-1 day", parent: "old@example.test" });
      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "needed");
      assert.equal(me.json.guardianParentEmailMasked, "ol***@example.test");
      const fresh = await call(on, "GET", "/auth/me", await mkUser("student"));
      assert.equal(fresh.json.guardianStatus, "needed");
      assert.equal(fresh.json.guardianParentEmailMasked, undefined);
    });

    it("with the flag off /me never names a parent address, even for a student who has a request", async () => {
      const kid = await mkUser("student");
      await mkConsent(kid, { parent: "ghost@example.test" });
      const me = await call(off, "GET", "/auth/me", kid);
      assert.equal(me.json.guardianStatus, "not_required");
      assert.equal("guardianParentEmailMasked" in me.json, false);
    });
  });

  describe("sign-up, verification and role switch", () => {
    const PASSWORD = "Sufficiently1Strong!";
    const TERMS = { acceptedTerms: true, termsVersion: "2026-10-23" };
    /** Every parent link the `on` server has logged so far, oldest first. */
    const links = () => [...on.logs().matchAll(/\/guardian\/([A-Za-z0-9_-]{43})/g)].map(m => m[1]);
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    /** The server's log reaches us through a pipe, at its own pace, so a line is polled for (bounded), never assumed. */
    async function until(what: string, ready: () => boolean) {
      const deadline = Date.now() + 10_000;
      while (!ready() && Date.now() < deadline) await sleep(100);
      assert.ok(ready(), `${what} never appeared in the server log`);
    }
    const configLines = (server: TestServer) => server.logs().split("/guardian-consent/config").length - 1;
    /**
     * Waits until the server has logged one more request than before. The request log line is written when a response
     * finishes, after everything the earlier request logged, so once it is here any line an earlier request was going to
     * write is here too. That is what makes an assertion that something was NOT logged mean something.
     */
    async function logsCaughtUp(server: TestServer) {
      const seen = configLines(server);
      assert.equal((await call(server, "GET", "/guardian-consent/config")).status, 200);
      await until("the marker request", () => configLines(server) > seen);
    }

    const signUp = (server: TestServer, email: string, extra: Record<string, unknown>) =>
      call(server, "POST", "/auth/register", undefined, {
        firstName: "Kid", lastName: "Signup", email, password: PASSWORD, confirmPassword: PASSWORD, role: "student", ...TERMS, ...extra,
      });

    /**
     * The 6-digit code the server logs when no RESEND_API_KEY is set. The log is pino-pretty with colour, so one entry is
     * a header line (`[time] WARN (pid): … verification email not sent`) followed by indented `key: value` lines, the
     * values wrapped in ANSI escapes. Reads the entry for this address, not a neighbour's.
     */
    async function verificationCode(server: TestServer, email: string): Promise<string> {
      const plain = () => server.logs().replace(/\x1b\[[0-9;]*m/g, "");
      const find = (): string | null => {
        const entries = plain().split(/\n(?=\[)/);
        for (let i = entries.length - 1; i >= 0; i -= 1) {
          if (!entries[i].includes("verification email not sent")) continue;
          if (!new RegExp(`\\bto:\\s*"${email.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`).test(entries[i])) continue;
          const m = entries[i].match(/\bcode:\s*"(\d{6})"/);
          if (m) return m[1];
        }
        return null;
      };
      await until(`the verification code for ${email}`, () => find() !== null);
      return find()!;
    }

    it("with the flag on, a student must give a parent's email (not the tick), and not their own", async () => {
      const missing = await signUp(on, "need1@example.test", { ageConfirmed: true });
      assert.equal(missing.status, 400);
      assert.equal(missing.json.code, "parent_email_required");
      const own = await signUp(on, "need2@example.test", { parentEmail: "NEED2@example.test" });
      assert.equal(own.json.code, "parent_email_is_own");
      assert.deepEqual(await q(`SELECT 1 FROM users WHERE email IN ('need1@example.test','need2@example.test')`), [], "nothing was created");
    });

    it("queues the request at sign-up, mails the parent only after the student verifies, then holds them", async () => {
      const email = "flow1@example.test";
      const before = links().length;
      const reg = await signUp(on, email, { parentEmail: "Mum.Flow1@example.test" });
      assert.equal(reg.status, 201, reg.text);
      const [row] = await q<{ id: string; token_hash: string | null; expires_at: Date | null; parent_email: string }>(
        `SELECT c.id, c.token_hash, c.expires_at, c.parent_email FROM guardian_consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1`,
        [email],
      );
      assert.equal(row.parent_email, "mum.flow1@example.test");
      assert.equal(row.token_hash, null, "queued with no token");
      assert.equal(row.expires_at, null);
      // Sign-up queues the request BEFORE it issues the verification code, so a link mailed at sign-up would be logged
      // ahead of the code's line. Waiting for the code first therefore makes "no link yet" a real check.
      const code = await verificationCode(on, email);
      assert.equal(links().length, before, "nothing is mailed to the parent before the student verifies");
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE email = $1`, [email]);
      assert.equal(u.guardian_confirmed_at, null, "the flag-on path does not record a tick");

      const verified = await call(on, "POST", "/auth/verify-email", undefined, { email, code });
      assert.equal(verified.status, 200, verified.text);
      // The request is awaited by /verify-email, so the link is logged before the response. The marker request's own log
      // line comes after it, which makes the exact count (one, not two) a real check without polling for it.
      await logsCaughtUp(on);
      assert.equal(links().length, before + 1, "the parent is mailed once, after verification");
      const [after] = await q<{ token_hash: string | null }>(`SELECT token_hash FROM guardian_consents WHERE id = $1`, [row.id]);
      assert.equal(after.token_hash, sha(links().at(-1)!));

      const token = verified.json.accessToken as string;
      const held = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(held.status, 403);
      assert.equal(((await held.json()) as { code: string }).code, "guardian_approval_required");

      assert.equal((await call(on, "POST", `/guardian-consent/${links().at(-1)}`, undefined, { decision: "approved", confirmGuardian: true })).status, 200);
      const freed = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(freed.status, 200);
    });

    it("a student who signed up with the tick (flag off) and verifies against the flag-on server is not mailed to", async () => {
      const email = "ticked.verify@example.test";
      const ticked = await signUp(off, email, { ageConfirmed: true });
      assert.equal(ticked.status, 201, ticked.text);
      const code = await verificationCode(off, email);
      const before = links().length;
      const verified = await call(on, "POST", "/auth/verify-email", undefined, { email, code });
      assert.equal(verified.status, 200, verified.text);
      await logsCaughtUp(on);
      assert.equal(links().length, before, "no queued request, so nothing to mail");
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents c JOIN users u ON u.id = c.user_id WHERE u.email = $1`, [email]), []);
    });

    /** Plants a password-reset code for the user (the real one is only ever emailed) and uses it. */
    async function resetPassword(userId: string, email: string) {
      const NEW_PASSWORD = "AnotherStrong2Password!";
      await q(
        `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, now() + interval '15 minutes')`,
        [userId, hashResetCode(userId, "424242")],
      );
      return call(on, "POST", "/auth/reset-password", undefined, { email, code: "424242", password: NEW_PASSWORD, confirmPassword: NEW_PASSWORD });
    }

    it("a password reset that verifies the address retires the queued request: no mail, held as needed", async () => {
      const email = "reset1@example.test";
      const before = links().length;
      assert.equal((await signUp(on, email, { parentEmail: "reset.parent@example.test" })).status, 201);
      const [u] = await q<{ id: string }>(`SELECT id FROM users WHERE email = $1`, [email]);
      const code = await verificationCode(on, email);
      const [queued] = await q<{ id: string; superseded_at: Date | null }>(`SELECT id, superseded_at FROM guardian_consents WHERE user_id = $1`, [u.id]);
      assert.equal(queued.superseded_at, null);

      const reset = await resetPassword(u.id, email);
      assert.equal(reset.status, 200, reset.text);
      const [after] = await q<{ superseded_at: Date | null; decided_at: Date | null; token_hash: string | null }>(
        `SELECT superseded_at, decided_at, token_hash FROM guardian_consents WHERE id = $1`,
        [queued.id],
      );
      assert.ok(after.superseded_at, "the queued row is superseded");
      assert.equal(after.token_hash, null, "and was never issued");
      assert.equal((await q<{ email_verified: boolean }>(`SELECT email_verified FROM users WHERE id = $1`, [u.id]))[0].email_verified, true);
      assert.equal((await call(on, "GET", "/auth/me", u.id)).json.guardianStatus, "needed");

      // The address is verified now, so the sign-up code cannot be used to get the request mailed after all.
      const again = await call(on, "POST", "/auth/verify-email", undefined, { email, code });
      assert.equal(again.status, 400);
      assert.equal(again.json.code, "already_verified");
      await logsCaughtUp(on);
      assert.equal(links().length, before, "no mail went to the parent the squatter named");
    });

    it("a password reset on an already-verified student leaves their open request alone", async () => {
      const kid = await mkUser("student", { email: "reset2@example.test" });
      const token = await mkConsent(kid);
      const reset = await resetPassword(kid, "reset2@example.test");
      assert.equal(reset.status, 200, reset.text);
      const [c] = await q<{ superseded_at: Date | null }>(`SELECT superseded_at FROM guardian_consents WHERE token_hash = $1`, [sha(token)]);
      assert.equal(c.superseded_at, null);
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "waiting");
    });

    it("the parent-address limit applies at sign-up: a sixth student on one address is refused (429) and not created", async () => {
      for (let i = 0; i < 5; i += 1) {
        const r = await signUp(on, `cap${i}@example.test`, { parentEmail: "cap.parent@example.test" });
        assert.equal(r.status, 201, `${i}: ${r.text}`);
      }
      const sixth = await signUp(on, "cap5@example.test", { parentEmail: "cap.parent@example.test" });
      assert.equal(sixth.status, 429);
      assert.equal(sixth.json.code, "guardian_rate_limited");
      assert.deepEqual(await q(`SELECT 1 FROM users WHERE email = 'cap5@example.test'`), []);
    });

    it("a teacher and a parent sign up exactly as before, with no parent email", async () => {
      for (const role of ["teacher", "parent"]) {
        const r = await signUp(on, `${role}.plain@example.test`, { role });
        assert.equal(r.status, 201, `${role}: ${r.text}`);
      }
    });

    it("with the flag off, sign-up is exactly as before: the tick is required, a parent email is ignored", async () => {
      const noTick = await signUp(off, "off1@example.test", { parentEmail: "p@example.test" });
      assert.equal(noTick.status, 400);
      assert.equal(noTick.json.code, "age_confirmation_required");
      const ticked = await signUp(off, "off2@example.test", { ageConfirmed: true, parentEmail: "p@example.test" });
      assert.equal(ticked.status, 201, ticked.text);
      assert.deepEqual(await q(`SELECT 1 FROM guardian_consents c JOIN users u ON u.id = c.user_id WHERE u.email = 'off2@example.test'`), []);
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE email = 'off2@example.test'`);
      assert.ok(u.guardian_confirmed_at);
    });

    it("role switch: with the flag on a teacher becomes a held student with no tick; with it off the tick is asked", async () => {
      const t1 = await mkUser("teacher");
      const switched = await call(on, "POST", "/auth/role", t1, { role: "student" });
      assert.equal(switched.status, 200, switched.text);
      const me = await call(on, "GET", "/auth/me", t1);
      assert.equal(me.json.role, "student");
      assert.equal(me.json.guardianStatus, "needed");
      const [u] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE id = $1`, [t1]);
      assert.equal(u.guardian_confirmed_at, null);

      const t2 = await mkUser("teacher");
      const noTick = await call(off, "POST", "/auth/role", t2, { role: "student" });
      assert.equal(noTick.status, 400);
      assert.equal(noTick.json.code, "age_confirmation_required");
      assert.equal((await call(off, "POST", "/auth/role", t2, { role: "student", ageConfirmed: true })).status, 200);
      const [ticked] = await q<{ guardian_confirmed_at: Date | null }>(`SELECT guardian_confirmed_at FROM users WHERE id = $1`, [t2]);
      assert.ok(ticked.guardian_confirmed_at, "the flag-off switch still records the tick");
    });
  });

  describe("requests that arrive together", () => {
    // These use the raw call: of requests racing on one student only the newest is mailed, so there is no fixed
    // number of links to wait for.
    const askRaw = (userId: string, parentEmail: string) => call(on, "POST", "/auth/guardian-request", userId, { parentEmail });

    it("six at once for one student: three are taken, three are refused, and one request is left current", async () => {
      const kid = await mkUser("student");
      const results = await Promise.all([0, 1, 2, 3, 4, 5].map(i => askRaw(kid, `race-student-${i}@example.test`)));
      const statuses = results.map(r => r.status).sort();
      assert.deepEqual(statuses, [200, 200, 200, 429, 429, 429], results.map(r => r.text).join(" | "));
      for (const r of results.filter(r => r.status === 429)) assert.equal(r.json.code, "guardian_rate_limited");
      const [all] = await q<{ n: string }>(`SELECT count(*) AS n FROM guardian_consents WHERE user_id = $1`, [kid]);
      assert.equal(Number(all.n), 3);
      const [open] = await q<{ n: string }>(`SELECT count(*) AS n FROM guardian_consents WHERE user_id = $1 AND superseded_at IS NULL`, [kid]);
      assert.equal(Number(open.n), 1, "only the newest request may be live");
    });

    it("seven students at once for one parent address: five rows exist afterwards, never more", async () => {
      const kids = await Promise.all([0, 1, 2, 3, 4, 5, 6].map(() => mkUser("student")));
      const results = await Promise.all(kids.map(k => askRaw(k, "race-parent@example.test")));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 200, 200, 200, 200, 429, 429], results.map(r => r.text).join(" | "));
      const [row] = await q<{ n: string }>(`SELECT count(*) AS n FROM guardian_consents WHERE parent_email = 'race-parent@example.test'`);
      assert.equal(Number(row.n), 5);
    });
  });
});
