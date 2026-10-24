/**
 * The code-only account routes, against a real database: POST /auth/redeem
 * (make a parent or student from a teacher's code, no email), POST
 * /auth/code-login (sign back in with the personal login code it returned) and
 * POST /auth/add-email (give such an account an address and a password).
 *
 * None of the three had a committed test; they were driven by hand when they
 * shipped. What is pinned here is the contract the app depends on: the login
 * code is returned once and only its hash is stored, the account and its roster
 * link are made together or not at all, a code that cannot be judged is one
 * answer, and adding an email never touches an account that has one.
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
const CLASS_CODE = "CKSQZ7";
const OMAR_CODE = "EMRQZ7";
const SALMA_CODE = "SKMQZ7";
const NOOR_CODE = "NSRQZ7";
const OLD_CODE = "EDKQZ7";

const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");

describeDb("code-only accounts: redeem, code-login, add-email", () => {
  let db: TestDb;
  let on: TestServer;
  let teacherId: string;
  const rows: Record<"omar" | "salma" | "noor" | "dina" | "expired", string> = {} as never;

  const q = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []) =>
    (await db.pool.query<T>(text, params)).rows;

  const redeem = (body: Record<string, unknown>) => call(on, "POST", "/auth/redeem", undefined, { ...TERMS, ...body });

  before(async () => {
    db = await setupTestDb();
    teacherId = (
      await q<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role, email) VALUES ('Teacher', 'T', 'teacher', 't@example.test') RETURNING id`,
      )
    )[0].id;
    const student = async (name: string, claimCode: string | null, expires: string) =>
      (
        await q<{ id: string }>(
          `INSERT INTO students (teacher_id, display_name, claim_code, claim_code_expires_at)
           VALUES ($1, $2, $3, now() + $4::interval) RETURNING id`,
          [teacherId, name, claimCode, expires],
        )
      )[0].id;
    rows.omar = await student("عمر أحمد", OMAR_CODE, "30 days");
    rows.salma = await student("سلمى خالد", SALMA_CODE, "30 days");
    rows.noor = await student("نور علي", NOOR_CODE, "30 days");
    rows.dina = await student("دينا سامر", null, "30 days");
    rows.expired = await student("رامي يوسف", OLD_CODE, "-1 day");

    const cls = (
      await q<{ id: string }>(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids, join_code, join_code_expires_at)
         VALUES ($1, '10A', 'mathematics', '["mathematics"]'::jsonb, $2, now() + interval '30 days') RETURNING id`,
        [teacherId, CLASS_CODE],
      )
    )[0].id;
    await q(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [cls, rows.dina]);

    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("POST /auth/redeem", () => {
    let omarLogin: string;
    let omarUser: string;

    it("a student's own code makes a code-only student, linked to that roster row", async () => {
      const res = await redeem({ claimCode: OMAR_CODE, role: "student" });
      assert.equal(res.status, 201, res.text);
      omarLogin = res.json.loginCode;
      omarUser = res.json.user.id;
      assert.match(omarLogin, /^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
      assert.ok(res.json.accessToken && res.json.refreshToken);
      assert.equal(res.json.user.role, "student");
      assert.equal(res.json.user.email, null);
      assert.equal(res.json.user.hasRosterLink, true);
      assert.equal(res.json.user.hasLoginCode, true);
      // The roster name becomes the account's name.
      assert.equal(res.json.user.firstName, "عمر");
      assert.equal(res.json.user.lastName, "أحمد");

      const [u] = await q<{ email: string | null; password_hash: string | null; login_code_hash: string; terms_version: string; guardian_confirmed_at: Date | null }>(
        `SELECT email, password_hash, login_code_hash, terms_version, guardian_confirmed_at FROM users WHERE id = $1`,
        [omarUser],
      );
      assert.equal(u.email, null);
      assert.equal(u.password_hash, null);
      assert.equal(u.terms_version, "2026-10-23");
      // The teacher vouches for a code-only student: no age tick is asked or stored.
      assert.equal(u.guardian_confirmed_at, null);
      // Only the hash is kept, never the code itself.
      assert.equal(u.login_code_hash, sha256(omarLogin.replace(/-/g, "")));
      assert.ok(!JSON.stringify(u).includes(omarLogin.replace(/-/g, "")));

      const links = await q<{ user_id: string; relation: string }>(`SELECT user_id, relation FROM roster_links WHERE student_id = $1`, [rows.omar]);
      assert.deepEqual(links, [{ user_id: omarUser, relation: "self" }]);
    });

    it("a student's code cannot be redeemed twice: 409, and no second account is left behind", async () => {
      const before = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM users`))[0].n;
      const res = await redeem({ claimCode: OMAR_CODE, role: "student" });
      assert.equal(res.status, 409);
      assert.equal(res.json.code, "claim_already_linked");
      const after = (await q<{ n: number }>(`SELECT count(*)::int AS n FROM users`))[0].n;
      assert.equal(after, before, "the refused sign-up must roll its user back");
    });

    it("a parent redeems the child's own code: guardian link, named after the child", async () => {
      const res = await redeem({ claimCode: SALMA_CODE, role: "parent" });
      assert.equal(res.status, 201, res.text);
      assert.equal(res.json.user.role, "parent");
      assert.equal(res.json.user.firstName, "ولي أمر");
      assert.equal(res.json.user.lastName, "سلمى خالد");
      const links = await q<{ relation: string }>(`SELECT relation FROM roster_links WHERE student_id = $1`, [rows.salma]);
      assert.deepEqual(links, [{ relation: "guardian" }]);
    });

    it("a second parent may redeem the same per-student code", async () => {
      const res = await redeem({ claimCode: SALMA_CODE, role: "parent" });
      assert.equal(res.status, 201, res.text);
      const links = await q(`SELECT 1 FROM roster_links WHERE student_id = $1 AND relation = 'guardian'`, [rows.salma]);
      assert.equal(links.length, 2);
    });

    it("a class code needs a name picked, and the name must be on that class's list", async () => {
      const noName = await redeem({ claimCode: CLASS_CODE, role: "student" });
      assert.equal(noName.status, 400);
      assert.equal(noName.json.code, "claim_needs_name");

      const notMember = await redeem({ claimCode: CLASS_CODE, role: "student", studentId: rows.noor });
      assert.equal(notMember.status, 400);
      assert.equal(notMember.json.code, "claim_name_not_in_class");
      assert.deepEqual(await q(`SELECT 1 FROM roster_links WHERE student_id = $1`, [rows.noor]), []);

      const ok = await redeem({ claimCode: CLASS_CODE.toLowerCase(), role: "student", studentId: rows.dina });
      assert.equal(ok.status, 201, ok.text);
      assert.equal(ok.json.user.firstName, "دينا");
    });

    it("a parent cannot use the shared class code: they need the code written for their child", async () => {
      const res = await redeem({ claimCode: CLASS_CODE, role: "parent", studentId: rows.dina });
      assert.equal(res.status, 400);
      assert.equal(res.json.code, "claim_parent_needs_student_code");
    });

    it("an unknown, expired or empty code is the same answer, and a missing role or terms is refused first", async () => {
      for (const claimCode of ["ZZZZZZ", OLD_CODE, "", "   "]) {
        const res = await redeem({ claimCode, role: "student" });
        assert.equal(res.status, 400, `${JSON.stringify(claimCode)}: ${res.text}`);
        assert.equal(res.json.code, "claim_code_invalid");
      }
      const teacher = await redeem({ claimCode: NOOR_CODE, role: "teacher" });
      assert.equal(teacher.status, 400);
      assert.equal(teacher.json.code, "invalid_role");
      const noTerms = await call(on, "POST", "/auth/redeem", undefined, { claimCode: NOOR_CODE, role: "student" });
      assert.equal(noTerms.status, 400);
      assert.equal(noTerms.json.code, "terms_required");
      assert.deepEqual(await q(`SELECT 1 FROM roster_links WHERE student_id = $1`, [rows.noor]), [], "nothing was linked");
    });

    it("is closed when student accounts are off", async () => {
      const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
      try {
        const res = await call(off, "POST", "/auth/redeem", undefined, { ...TERMS, claimCode: NOOR_CODE, role: "student" });
        assert.equal(res.status, 403);
        assert.equal(res.json.code, "student_accounts_disabled");
        const login = await call(off, "POST", "/auth/code-login", undefined, { loginCode: omarLogin });
        assert.equal(login.status, 403);
        assert.equal(login.json.code, "student_accounts_disabled");
      } finally {
        await off.stop();
      }
    });

    describe("POST /auth/code-login", () => {
      it("signs the account back in with its login code, in any spelling of it", async () => {
        for (const typed of [omarLogin, omarLogin.toLowerCase(), omarLogin.replace(/-/g, " ")]) {
          const res = await call(on, "POST", "/auth/code-login", undefined, { loginCode: typed });
          assert.equal(res.status, 200, `${typed}: ${res.text}`);
          assert.equal(res.json.user.id, omarUser);
          assert.equal(res.json.user.hasRosterLink, true);
          assert.ok(res.json.accessToken && res.json.refreshToken);
        }
        const token = (await call(on, "POST", "/auth/code-login", undefined, { loginCode: omarLogin })).json.accessToken;
        const me = await fetch(`${on.base}/student/exams`, { headers: { Authorization: `Bearer ${token}` } });
        assert.equal(me.status, 200, "the returned token is accepted by an authenticated route");
      });

      it("a wrong, malformed or missing code is one answer", async () => {
        const wrongButValid = omarLogin.slice(0, -1) + (omarLogin.endsWith("A") ? "B" : "A");
        for (const loginCode of [wrongButValid, "nonsense", OMAR_CODE, "", 12345, null, undefined]) {
          const res = await call(on, "POST", "/auth/code-login", undefined, { loginCode });
          assert.equal(res.status, 401, `${JSON.stringify(loginCode)}: ${res.text}`);
          assert.equal(res.json.code, "invalid_login_code");
        }
        const noBody = await call(on, "POST", "/auth/code-login");
        assert.equal(noBody.status, 401);
      });

      it("a teacher's code is not a login: it never signs anyone in", async () => {
        for (const loginCode of [OMAR_CODE, CLASS_CODE, `${OMAR_CODE}${OMAR_CODE}`]) {
          const res = await call(on, "POST", "/auth/code-login", undefined, { loginCode });
          assert.equal(res.status, 401, loginCode);
        }
      });

      it("a suspended account is told why, only after the right code", async () => {
        await q(`UPDATE users SET suspended_at = now(), suspended_reason = 'testing' WHERE id = $1`, [omarUser]);
        try {
          const right = await call(on, "POST", "/auth/code-login", undefined, { loginCode: omarLogin });
          assert.equal(right.status, 403);
          assert.equal(right.json.code, "account_suspended");
          assert.equal(right.json.error, "testing");
        } finally {
          await q(`UPDATE users SET suspended_at = NULL, suspended_reason = '' WHERE id = $1`, [omarUser]);
        }
      });

      it("stamps last_login", async () => {
        await q(`UPDATE users SET last_login = NULL WHERE id = $1`, [omarUser]);
        await call(on, "POST", "/auth/code-login", undefined, { loginCode: omarLogin });
        const [u] = await q<{ last_login: Date | null }>(`SELECT last_login FROM users WHERE id = $1`, [omarUser]);
        assert.ok(u.last_login);
      });
    });

    describe("POST /auth/add-email", () => {
      const email = "omar.family@example.test";

      it("needs a signed-in user, a valid address and a strong password", async () => {
        const anon = await call(on, "POST", "/auth/add-email", undefined, { email, password: PASSWORD });
        assert.equal(anon.status, 401);
        const badEmail = await call(on, "POST", "/auth/add-email", omarUser, { email: "not-an-email", password: PASSWORD });
        assert.equal(badEmail.status, 400);
        assert.equal(badEmail.json.code, "invalid_email");
        const weak = await call(on, "POST", "/auth/add-email", omarUser, { email, password: "short" });
        assert.equal(weak.status, 400);
        assert.equal(weak.json.code, "password_policy");
        const [u] = await q<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [omarUser]);
        assert.equal(u.email, null, "a refused request changed nothing");
      });

      it("stores the address unverified with a password, issues a verification code, and keeps the login code working", async () => {
        const res = await call(on, "POST", "/auth/add-email", omarUser, { email: ` ${email.toUpperCase()} `, password: PASSWORD });
        assert.equal(res.status, 200, res.text);
        assert.equal(res.json.email, email, "trimmed and lower-cased");
        const [u] = await q<{ email: string; email_verified: boolean; password_hash: string; login_code_hash: string }>(
          `SELECT email, email_verified, password_hash, login_code_hash FROM users WHERE id = $1`,
          [omarUser],
        );
        assert.equal(u.email, email);
        assert.equal(u.email_verified, false);
        assert.ok(u.password_hash.startsWith("$2"), "a bcrypt hash, not the password");
        assert.equal(u.login_code_hash, sha256(omarLogin.replace(/-/g, "")), "the login code is untouched");
        const tokens = await q(`SELECT 1 FROM email_verification_tokens WHERE user_id = $1`, [omarUser]);
        assert.equal(tokens.length, 1);

        const again = await call(on, "POST", "/auth/code-login", undefined, { loginCode: omarLogin });
        assert.equal(again.status, 200);
        assert.equal(again.json.user.email, email);
      });

      it("the email and password sign-in is refused until the address is verified", async () => {
        const res = await call(on, "POST", "/auth/login", undefined, { email, password: PASSWORD });
        assert.equal(res.status, 403);
        assert.equal(res.json.code, "email_not_verified");
      });

      it("an account that already has an email is not changed (409 email_already_set)", async () => {
        const res = await call(on, "POST", "/auth/add-email", omarUser, { email: "another@example.test", password: PASSWORD });
        assert.equal(res.status, 409, res.text);
        assert.equal(res.json.code, "email_already_set");
        const [u] = await q<{ email: string }>(`SELECT email FROM users WHERE id = $1`, [omarUser]);
        assert.equal(u.email, email);
      });

      it("an address another account holds is 409 email_taken, whichever case it is typed in", async () => {
        const [dina] = await q<{ id: string }>(`SELECT user_id AS id FROM roster_links WHERE student_id = $1`, [rows.dina]);
        const res = await call(on, "POST", "/auth/add-email", dina.id, { email: "T@Example.Test", password: PASSWORD });
        assert.equal(res.status, 409, res.text);
        assert.equal(res.json.code, "email_taken");
        const [u] = await q<{ email: string | null }>(`SELECT email FROM users WHERE id = $1`, [dina.id]);
        assert.equal(u.email, null);
      });
    });
  });
});
