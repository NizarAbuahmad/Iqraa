/**
 * POST /students/:id/links/:userId/login-code — a teacher gives a parent or
 * student who lost their personal login code a new one — against a real
 * database. `lib/loginCodeReissue.ts` has the rule as a unit test; this pins the
 * route around it: who may ask, that the old code and every open session really
 * die, and the lockout case that rule was changed for (an account that added an
 * email and password but never verified the address).
 *
 * Accounts are made through the real /auth/redeem and /auth/add-email, so the
 * codes and hashes are the ones those routes produce, not hand-written rows.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";

const PASSWORD = "Sufficiently1Strong!";
const TERMS = { acceptedTerms: true, termsVersion: "2026-10-23" };

// 6 characters from the share-code alphabet (no 0, 1, I, O).
const CODES = ["RKA2Q7", "RKB2Q7", "RKC2Q7", "RKD2Q7", "RKE2Q7"] as const;

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describeDb("teacher reissues a lost login code", () => {
  let db: TestDb;
  let on: TestServer;
  let teacher: string;
  let otherTeacher: string;

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  /** A roster row with a per-student code, redeemed as a student: the real code-only account. */
  async function codeAccount(index: number) {
    const [row] = await q<{ id: string }>(
      `INSERT INTO students (teacher_id, display_name, claim_code, claim_code_expires_at)
       VALUES ($1, $2, $3, now() + interval '30 days') RETURNING id`,
      [teacher, `طالب ${index}`, CODES[index]],
    );
    const res = await call(on, "POST", "/auth/redeem", undefined, { ...TERMS, claimCode: CODES[index], role: "student" });
    assert.equal(res.status, 201, res.text);
    return { studentId: row.id, userId: res.json.user.id as string, loginCode: res.json.loginCode as string, refreshToken: res.json.refreshToken as string };
  }

  const reissue = (as: string | undefined, studentId: string, userId: string) =>
    call(on, "POST", `/students/${studentId}/links/${userId}/login-code`, as);
  const codeLogin = (loginCode: string) => call(on, "POST", "/auth/code-login", undefined, { loginCode });

  before(async () => {
    db = await setupTestDb();
    const mk = async (email: string) =>
      (
        await q<{ id: string }>(
          // The roster routes refuse a teacher who has not attested the school's parental consent.
          `INSERT INTO users (first_name, last_name, role, email, roster_consent_at) VALUES ('T', $1, 'teacher', $1, now()) RETURNING id`,
          [email],
        )
      )[0].id;
    teacher = await mk("teacher@example.test");
    otherTeacher = await mk("other@example.test");
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("a code-only account gets a new code: the old one dies, the new one signs in, open sessions end", async () => {
    const a = await codeAccount(0);
    const before = await q(`SELECT 1 FROM refresh_tokens WHERE user_id = $1`, [a.userId]);
    assert.ok(before.length >= 1, "the redeem opened a session");

    const res = await reissue(teacher, a.studentId, a.userId);
    assert.equal(res.status, 200, res.text);
    const fresh: string = res.json.loginCode;
    assert.match(fresh, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    assert.notEqual(fresh, a.loginCode);

    const [u] = await q<{ login_code_hash: string }>(`SELECT login_code_hash FROM users WHERE id = $1`, [a.userId]);
    assert.equal(u.login_code_hash, sha256(fresh.replace(/-/g, "")), "only the hash of the new code is kept");
    assert.deepEqual(await q(`SELECT 1 FROM refresh_tokens WHERE user_id = $1`, [a.userId]), [], "every open session ended");

    assert.equal((await codeLogin(a.loginCode)).status, 401, "the old code is dead");
    const again = await codeLogin(fresh);
    assert.equal(again.status, 200, again.text);
    assert.equal(again.json.user.id, a.userId);
  });

  it("the old refresh token no longer renews a session", async () => {
    const a = await codeAccount(1);
    assert.equal((await reissue(teacher, a.studentId, a.userId)).status, 200);
    const res = await call(on, "POST", "/auth/refresh", undefined, { refreshToken: a.refreshToken });
    assert.equal(res.status, 401, res.text);
  });

  it("a teacher who does not own the student gets 404, and nothing changes", async () => {
    const a = await codeAccount(2);
    const res = await reissue(otherTeacher, a.studentId, a.userId);
    assert.equal(res.status, 404);
    const [u] = await q<{ login_code_hash: string }>(`SELECT login_code_hash FROM users WHERE id = $1`, [a.userId]);
    assert.equal(u.login_code_hash, sha256(a.loginCode.replace(/-/g, "")));
    assert.equal((await codeLogin(a.loginCode)).status, 200, "the old code still works");
  });

  it("an account that is not linked to that student is 404, even if it is a code account", async () => {
    const a = await codeAccount(3);
    const b = await codeAccount(4);
    const res = await reissue(teacher, a.studentId, b.userId);
    assert.equal(res.status, 404);
    assert.equal((await codeLogin(b.loginCode)).status, 200, "b's code is untouched");
  });

  it("needs a signed-in teacher: no token is 401, a student's own token is refused", async () => {
    const [row] = await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x') RETURNING id`, [teacher]);
    const anon = await reissue(undefined, row.id, crypto.randomUUID());
    assert.equal(anon.status, 401);

    const [stu] = await q<{ id: string }>(`SELECT id FROM users WHERE role = 'student' LIMIT 1`);
    const asStudent = await reissue(stu.id, row.id, stu.id);
    assert.ok([401, 403].includes(asStudent.status), `a student must not reach this route, got ${asStudent.status}`);
  });

  describe("the lockout case: an email and password were added and never verified", () => {
    it("is reissued while the address is unverified, then refused once it is verified", async () => {
      const [row] = await q<{ id: string }>(
        `INSERT INTO students (teacher_id, display_name, claim_code, claim_code_expires_at)
         VALUES ($1, 'منى', 'RKF2Q7', now() + interval '30 days') RETURNING id`,
        [teacher],
      );
      const made = await call(on, "POST", "/auth/redeem", undefined, { ...TERMS, claimCode: "RKF2Q7", role: "student" });
      assert.equal(made.status, 201, made.text);
      const userId: string = made.json.user.id;

      const add = await call(on, "POST", "/auth/add-email", userId, { email: "mistyped@example.test", password: PASSWORD });
      assert.equal(add.status, 200, add.text);
      const [u0] = await q<{ password_hash: string | null; email_verified: boolean }>(`SELECT password_hash, email_verified FROM users WHERE id = $1`, [userId]);
      assert.ok(u0.password_hash && !u0.email_verified, "the precondition: a password and an unverified address");

      const ok = await reissue(teacher, row.id, userId);
      assert.equal(ok.status, 200, ok.text);
      assert.equal((await codeLogin(made.json.loginCode)).status, 401);
      assert.equal((await codeLogin(ok.json.loginCode)).status, 200);

      await q(`UPDATE users SET email_verified = true WHERE id = $1`, [userId]);
      const refused = await reissue(teacher, row.id, userId);
      assert.equal(refused.status, 409);
      assert.equal(refused.json.code, "not_a_code_account");
      assert.equal((await codeLogin(ok.json.loginCode)).status, 200, "a refused reissue leaves the current code working");
    });
  });

  describe("accounts that have another way in are refused (409 not_a_code_account)", () => {
    async function linkedUser(extra: string, params: unknown[] = []) {
      const [stu] = await q<{ id: string }>(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'ط') RETURNING id`, [teacher]);
      const [usr] = await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, ${extra}) VALUES ('P', 'Q', 'parent', ${params.map((_, i) => `$${i + 1}`).join(", ")}) RETURNING id`,
        params,
      );
      await q(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [stu.id, usr.id]);
      return { studentId: stu.id, userId: usr.id };
    }

    it("a Google account", async () => {
      const t = await linkedUser("login_code_hash, google_id", [sha256("ABCDEFGHJKMN"), "google-sub-1"]);
      const res = await reissue(teacher, t.studentId, t.userId);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "not_a_code_account");
    });

    it("an account that never had a login code", async () => {
      const t = await linkedUser("email", ["no-code@example.test"]);
      const res = await reissue(teacher, t.studentId, t.userId);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "not_a_code_account");
      const [u] = await q<{ login_code_hash: string | null }>(`SELECT login_code_hash FROM users WHERE id = $1`, [t.userId]);
      assert.equal(u.login_code_hash, null, "no code was minted for it");
    });

    it("a verified email and password", async () => {
      const t = await linkedUser("login_code_hash, email, password_hash, email_verified", [sha256("ABCDEFGHJKMP"), "verified@example.test", "x", true]);
      const res = await reissue(teacher, t.studentId, t.userId);
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "not_a_code_account");
    });
  });
});
