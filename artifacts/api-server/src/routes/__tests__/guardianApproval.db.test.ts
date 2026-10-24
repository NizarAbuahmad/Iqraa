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
import { accessToken } from "../../test-support/tokens.ts";
import { hashResetCode } from "../../lib/passwordReset.ts";

const sha = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
const newToken = () => crypto.randomBytes(32).toString("base64url");
/**
 * The public routes allow 30 requests a minute per IP, counted in the shared database, so one test process would
 * spend the budget for everyone. Each call therefore arrives "from" its own address (the API trusts one proxy hop and
 * reads the last X-Forwarded-For entry), except where a test passes `ip` to exercise the limiter itself.
 */
let nextIp = 0;
const freshIp = () => `10.${(nextIp >> 16) & 255}.${(nextIp >> 8) & 255}.${nextIp++ & 255}`;
async function postJson(server: TestServer, path: string, body?: unknown, ip: string = freshIp()) {
  const res = await fetch(`${server.base}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Forwarded-For": ip },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  return { status: res.status, text, json };
}
/** The parent's page asks about a link, and answers it, with the token in a body: never in a path or a query. */
const lookup = (server: TestServer, token: unknown, ip?: string) => postJson(server, "/guardian-consent/lookup", { token }, ip);
const decide = (server: TestServer, token: unknown, body: Record<string, unknown>, ip?: string) =>
  postJson(server, "/guardian-consent/decide", { token, ...body }, ip);

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
      const res = await lookup(on, token);
      assert.equal(res.status, 200, res.text);
      assert.deepEqual(res.json, { status: "open", childFirstName: res.json.childFirstName });
      assert.match(res.json.childFirstName, /^Kid\d+$/);
      assert.deepEqual(Object.keys(res.json).sort(), ["childFirstName", "status"]);
    });

    it("an unknown, malformed, expired, decided or superseded link says so", async () => {
      const kid = await mkUser("student");
      const status = async (t: unknown) => (await lookup(on, t)).json.status;
      assert.equal(await status(newToken()), "invalid");
      assert.equal(await status("not-a-token"), "invalid");
      // A missing or non-string token is an unknown token, never a 500.
      assert.equal(await status(undefined), "invalid");
      assert.equal(await status(null), "invalid");
      assert.equal(await status({ $ne: "" }), "invalid");
      assert.equal(await status(["a"]), "invalid");
      const bare = await postJson(on, "/guardian-consent/lookup");
      assert.equal(bare.status, 200);
      assert.equal(bare.json.status, "invalid");
      assert.equal(await status(await mkConsent(kid, { expires: "-1 day" })), "expired");
      assert.equal(await status(await mkConsent(kid, { decided: "declined" })), "decided");
      assert.equal(await status(await mkConsent(kid, { superseded: true })), "invalid");
    });

    it("approving needs the parent's confirmation, a valid decision, and then unlocks the student once", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const bad = await decide(on, token, { decision: "maybe" });
      assert.equal(bad.status, 400);
      assert.equal(bad.json.code, "decision_invalid");
      const unticked = await decide(on, token, { decision: "approved" });
      assert.equal(unticked.status, 400);
      assert.equal(unticked.json.code, "guardian_confirmation_required");
      const [before] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(before.guardian_approved_at, null, "a refused approval changes nothing");

      const ok = await decide(on, token, { decision: "approved", confirmGuardian: true });
      assert.equal(ok.status, 200, ok.text);
      assert.deepEqual(ok.json, { decision: "approved" });
      const [after] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.ok(after.guardian_approved_at);

      const again = await decide(on, token, { decision: "approved", confirmGuardian: true });
      assert.equal(again.status, 410);
      assert.equal(again.json.code, "consent_link_unusable");
      assert.equal((await lookup(on, token)).json.status, "decided");
    });

    it("declining records the decision and leaves the account locked; it needs no confirmation tick", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const res = await decide(on, token, { decision: "declined" });
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
        const res = await decide(on, token, { decision: "approved", confirmGuardian: true });
        assert.equal(res.status, 410, token);
      }
      // A missing or malformed token is refused like an unknown one.
      for (const bad of [undefined, null, "short", 42, { a: 1 }]) {
        const res = await decide(on, bad, { decision: "approved", confirmGuardian: true });
        assert.equal(res.status, 410, String(bad));
        assert.equal(res.json.code, "consent_link_unusable");
      }
      const [u] = await q<{ guardian_approved_at: Date | null }>(`SELECT guardian_approved_at FROM users WHERE id = $1`, [kid]);
      assert.equal(u.guardian_approved_at, null);
    });

    it("two parents clicking at once: exactly one wins", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const body = { decision: "approved", confirmGuardian: true };
      const results = await Promise.all([1, 2, 3].map(() => decide(on, token, body)));
      assert.deepEqual(results.map(r => r.status).sort(), [200, 410, 410]);
    });

    it("never writes the token to the server log: it travels in a body, so the request lines hold no secret", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      assert.equal((await lookup(on, token)).status, 200);
      assert.equal((await decide(on, token, { decision: "declined" })).status, 200);
      // The server's log reaches us through a pipe, at its own pace. Lines are written in request order, so once the
      // line of a request with a path nobody else uses is here, the earlier ones are too.
      const marker = `/log-marker-${crypto.randomBytes(6).toString("hex")}`;
      assert.equal((await call(on, "GET", marker)).status, 404);
      const deadline = Date.now() + 10_000;
      while (!on.logs().includes(marker) && Date.now() < deadline) await new Promise(r => setTimeout(r, 100));
      const logs = on.logs();
      assert.ok(logs.includes(marker), "the marker request never appeared in the server log, so the check proves nothing");
      assert.ok(logs.includes("/guardian-consent/lookup") && logs.includes("/guardian-consent/decide"), "the requests themselves are logged");
      assert.ok(!logs.includes(token), "the bearer token reached the server log");
      assert.ok(!/guardian-consent\/[A-Za-z0-9_-]{43}/i.test(logs), "a token-shaped path segment reached the server log");
    });

    it("a GET with the token in the path answers 404: no state can change by GET, and the path form is gone", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      for (const path of [`/guardian-consent/${token}`, `/Guardian-Consent/${token}`]) {
        const res = await call(on, "GET", path);
        assert.equal(res.status, 404, path);
      }
      // Nor does a POST to the old path shape decide anything.
      const post = await call(on, "POST", `/guardian-consent/${token}`, undefined, { decision: "approved", confirmGuardian: true });
      assert.equal(post.status, 404);
      const [c] = await q<{ decided_at: Date | null }>(`SELECT decided_at FROM guardian_consents WHERE token_hash = $1`, [sha(token)]);
      assert.equal(c.decided_at, null, "nothing was decided");
    });

    it("with the flag off the page and the decision are closed (404), only config answers", async () => {
      const kid = await mkUser("student");
      const token = await mkConsent(kid);
      const looked = await lookup(off, token);
      assert.equal(looked.status, 404);
      assert.equal(looked.json.code, "guardian_approval_disabled");
      const decided = await decide(off, token, { decision: "approved", confirmGuardian: true });
      assert.equal(decided.status, 404);
      assert.equal(decided.json.code, "guardian_approval_disabled");
    });

    it("lookup and decide share one per-IP limit of 30 a minute, and another address is unaffected", async () => {
      const ip = "192.0.2.77";
      for (let i = 0; i < 30; i += 1) assert.equal((await lookup(on, newToken(), ip)).status, 200, `call ${i + 1}`);
      assert.equal((await lookup(on, newToken(), ip)).status, 429);
      assert.equal((await decide(on, newToken(), { decision: "declined" }, ip)).status, 429);
      assert.equal((await lookup(on, newToken())).status, 200);
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
      blocked(await call(on, "POST", "/auth/add-email", kid, { email: "x@example.test", password: "Sufficiently1Strong!" }));
      blocked(await call(on, "GET", "/auth/me/ai-usage", kid));

      const me = await call(on, "GET", "/auth/me", kid);
      assert.equal(me.status, 200, me.text);
      const claim = await call(on, "GET", "/auth/claim", kid);
      assert.equal(claim.status, 200, "joining a class with a teacher's code stays open");
    });

    it("lets a held student change role: to parent or teacher they are no longer held; into student it changes nothing", async () => {
      for (const role of ["parent", "teacher"]) {
        const kid = await mkUser("student");
        blocked(await call(on, "GET", "/student/exams", kid));
        const switched = await call(on, "POST", "/auth/role", kid, { role });
        assert.equal(switched.status, 200, `${role}: ${switched.text}`);
        assert.equal(switched.json.role, role);
        const me = await call(on, "GET", "/auth/me", kid);
        assert.equal(me.json.role, role);
        assert.equal(me.json.guardianStatus, "not_required", role);
        // And the gate no longer applies to the new role.
        assert.notEqual((await call(on, "GET", role === "teacher" ? "/classes" : "/parent/exams", kid)).status, 403, role);
      }
      // Asking for the role they already have is a no-op: still a student, still held.
      const stay = await mkUser("student");
      const same = await call(on, "POST", "/auth/role", stay, { role: "student" });
      assert.equal(same.status, 200, same.text);
      assert.equal((await call(on, "GET", "/auth/me", stay)).json.guardianStatus, "needed");
      blocked(await call(on, "GET", "/student/exams", stay));
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
      assert.equal((await decide(on, token, { decision: "approved", confirmGuardian: true })).status, 200);
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
    const links = () => [...on.logs().matchAll(/\/guardian#([A-Za-z0-9_-]{43})/g)].map(m => m[1]);
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
      assert.equal((await lookup(on, token)).json.status, "open");
    });

    it("the token leaves the server only in the mail: the request's answer and /me never contain it", async () => {
      const kid = await mkUser("student");
      const res = await ask(kid, "mail.only@example.test");
      assert.equal(res.status, 200, res.text);
      const token = links().at(-1)!;
      assert.equal(token.length, 43);
      const me = await call(on, "GET", "/auth/me", kid);
      const again = await call(on, "GET", "/auth/me", kid);
      for (const body of [res.text, me.text, again.text]) {
        assert.ok(!body.includes(token), "the plaintext token is in a response body");
        assert.ok(!body.includes(sha(token)), "the stored hash is in a response body");
      }
      // Only its hash is stored, and the lookup answers with the child's name and a status, nothing that identifies it.
      const [row] = await q<{ token_hash: string }>(`SELECT token_hash FROM guardian_consents WHERE user_id = $1`, [kid]);
      assert.equal(row.token_hash, sha(token));
      const looked = await lookup(on, token);
      assert.ok(!looked.text.includes(token) && !looked.text.includes(sha(token)));
    });

    it("asking again supersedes the old link: only the newest one works", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      const first = links().at(-1)!;
      assert.equal((await ask(kid, "b@example.test")).status, 200);
      const second = links().at(-1)!;
      assert.notEqual(first, second);
      assert.equal((await lookup(on, first)).json.status, "invalid");
      assert.equal((await lookup(on, second)).json.status, "open");
    });

    it("a declined student can ask again with another address and is then waiting again", async () => {
      const kid = await mkUser("student");
      assert.equal((await ask(kid, "a@example.test")).status, 200);
      await decide(on, links().at(-1), { decision: "declined" });
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
    const links = () => [...on.logs().matchAll(/\/guardian#([A-Za-z0-9_-]{43})/g)].map(m => m[1]);
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
      // The verifying student's own response does not carry the parent's token either.
      assert.ok(!verified.text.includes(links().at(-1)!), "the parent's token is in the student's verify-email response");

      const token = verified.json.accessToken as string;
      const held = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
      assert.equal(held.status, 403);
      assert.equal(((await held.json()) as { code: string }).code, "guardian_approval_required");

      assert.equal((await decide(on, links().at(-1), { decision: "approved", confirmGuardian: true })).status, 200);
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

  describe("the teacher's vouching: claims and links", () => {
    const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // the share-code alphabet: no I, L, O, 0, 1
    const code6 = () => Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join("");
    const exams = (id: string) => call(on, "GET", "/student/exams", id);
    const heldStill = (r: { status: number; json: any }) => {
      assert.equal(r.status, 403);
      assert.equal(r.json.code, "guardian_approval_required");
    };

    /** A teacher with a class (class code set) holding one roster row, optionally with a per-student code. */
    async function classWithRow(o: { studentCode?: string } = {}) {
      const teacher = await mkUser("teacher");
      // Writing to a roster needs the teacher's own consent attestation (lib/rosterConsent.ts).
      await q(`UPDATE users SET roster_consent_at = now(), roster_consent_version = '2026-09-05.v1' WHERE id = $1`, [teacher]);
      const classCode = code6();
      const [cls] = await q<{ id: string }>(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids, join_code, join_code_expires_at)
         VALUES ($1, 'c', 'mathematics', '["mathematics"]'::jsonb, $2, now() + interval '30 days') RETURNING id`,
        [teacher, classCode],
      );
      const [row] = await q<{ id: string }>(
        `INSERT INTO students (teacher_id, display_name, claim_code, claim_code_expires_at)
         VALUES ($1, 'Roster Kid', $2, CASE WHEN $2::text IS NOT NULL THEN now() + interval '30 days' END) RETURNING id`,
        [teacher, o.studentCode ?? null],
      );
      await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [cls.id, row.id]);
      return { teacher, classCode, rowId: row.id };
    }

    it("a class-code claim stays held until the teacher approves it, then unlocks", async () => {
      const { teacher, classCode, rowId } = await classWithRow();
      const kid = await mkUser("student");
      heldStill(await exams(kid));

      const claim = await call(on, "POST", "/auth/claim", kid, { claimCode: classCode, studentId: rowId });
      assert.equal(claim.status, 202, claim.text);
      assert.equal(claim.json.pending, true);
      // Waiting for the teacher is not the teacher having vouched.
      heldStill(await exams(kid));
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "needed");
      assert.equal((await call(on, "GET", "/auth/claim", kid)).status, 200, "the claim screen stays reachable while held");

      const [req] = await q<{ id: string }>(`SELECT id FROM roster_link_requests WHERE student_id = $1 AND user_id = $2`, [rowId, kid]);
      const approved = await call(on, "POST", `/students/${rowId}/link-requests/${req.id}/approve`, teacher);
      assert.equal(approved.status, 200, approved.text);
      assert.equal((await exams(kid)).status, 200, "unlocked once the teacher has approved");
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "not_required");
    });

    it("a request waiting for the teacher, with no link, does not unlock on its own", async () => {
      const { rowId } = await classWithRow();
      const kid = await mkUser("student");
      await q(`INSERT INTO roster_link_requests (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [rowId, kid]);
      heldStill(await exams(kid));
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "needed");
    });

    it("the per-student code the teacher wrote links at once and unlocks", async () => {
      const studentCode = code6();
      const { rowId } = await classWithRow({ studentCode });
      const kid = await mkUser("student");
      heldStill(await exams(kid));
      const claim = await call(on, "POST", "/auth/claim", kid, { claimCode: studentCode });
      assert.equal(claim.status, 201, claim.text);
      assert.equal(claim.json.studentId, rowId);
      assert.equal((await exams(kid)).status, 200);
    });

    it("a link to an archived roster row does not count: the student is held, and held again if the row is archived later", async () => {
      const { rowId } = await classWithRow();
      const kid = await mkUser("student");
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [rowId, kid]);
      assert.equal((await exams(kid)).status, 200, "a live link unlocks");
      await q(`UPDATE students SET archived_at = now() WHERE id = $1`, [rowId]);
      heldStill(await exams(kid));
      assert.equal((await call(on, "GET", "/auth/me", kid)).json.guardianStatus, "needed");

      const { rowId: archivedFromStart } = await classWithRow();
      await q(`UPDATE students SET archived_at = now() WHERE id = $1`, [archivedFromStart]);
      const other = await mkUser("student");
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [archivedFromStart, other]);
      heldStill(await exams(other));
    });
  });

  describe("a live game's player list", () => {
    /** A game by a new teacher, and a join as `userId` (or anonymously). Returns the player row's user_id. */
    async function joinedAs(server: TestServer, userId: string | null, name: string): Promise<string | null> {
      const teacher = await mkUser("teacher");
      const questions = [1, 2, 3].map(i => ({ content: `Q${i}`, options: ["a", "b", "c"], correctIndex: 1 }));
      const game = await call(server, "POST", "/live-host/games", teacher, { title: "g", lang: "en", seconds: 20, questions });
      assert.equal(game.status, 201, game.text);
      const headers: Record<string, string> = { "Content-Type": "application/json", "X-Forwarded-For": freshIp() };
      if (userId) headers["Authorization"] = `Bearer ${accessToken(userId)}`;
      const res = await fetch(`${server.base}/live/${game.json.code}/join`, { method: "POST", headers, body: JSON.stringify({ name }) });
      assert.equal(res.status, 201, await res.text());
      const rows = await q<{ user_id: string | null }>(`SELECT user_id FROM live_players WHERE game_id = $1`, [game.json.id]);
      assert.equal(rows.length, 1);
      return rows[0].user_id;
    }

    it("does not record a student who is held for a parent's approval; they still play, anonymously", async () => {
      const held = await mkUser("student");
      assert.equal(await joinedAs(on, held, "Held"), null);
    });

    it("records an approved, a linked and a code-only student, and a held one when the flag is off", async () => {
      const approved = await mkUser("student", { approved: true });
      assert.equal(await joinedAs(on, approved, "Approved"), approved);
      const linkedKid = await mkUser("student");
      await linked(linkedKid);
      assert.equal(await joinedAs(on, linkedKid, "Linked"), linkedKid);
      const codeOnly = await mkUser("student", { email: null });
      assert.equal(await joinedAs(on, codeOnly, "Code"), codeOnly);
      const heldButFlagOff = await mkUser("student");
      assert.equal(await joinedAs(off, heldButFlagOff, "Flagoff"), heldButFlagOff);
    });

    it("a student whose only teacher link is archived is held, so not recorded", async () => {
      const kid = await mkUser("student");
      await linked(kid);
      await q(`UPDATE students SET archived_at = now() WHERE id IN (SELECT student_id FROM roster_links WHERE user_id = $1)`, [kid]);
      assert.equal(await joinedAs(on, kid, "Archived"), null);
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
