/**
 * Every route that turns a Postgres unique violation into a 409 (or a retry),
 * against a real database. drizzle-orm 0.45 rethrows driver errors as a
 * DrizzleQueryError with the pg error on `cause`, so `err.code === "23505"`
 * never matched and each of these answered 500 (see lib/pgErrors.ts).
 *
 * The real collisions are races — the route's own duplicate check passes, then
 * the write loses to a concurrent one — so test-only triggers raise the same
 * error (SQLSTATE 23505) at the write instead. The error travels the same path:
 * pg driver, drizzle, route.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { seedExams, type ExamWorld } from "../../test-support/seedExams.ts";
import { isUniqueViolation } from "../../lib/pgErrors.ts";

const PASSWORD = "Sufficiently1Strong!";

describeDb("unique violations become 409s (or a retry), against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    await db.pool.query(`
      CREATE FUNCTION test_raise_unique_violation() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'duplicate key value (test trigger)' USING ERRCODE = 'unique_violation';
      END $$;
      CREATE TRIGGER test_users_email_collides BEFORE INSERT OR UPDATE OF email ON users
        FOR EACH ROW WHEN (NEW.email LIKE 'collide-%') EXECUTE FUNCTION test_raise_unique_violation();
      CREATE TRIGGER test_attempts_collide BEFORE INSERT ON attempts
        FOR EACH ROW WHEN (NEW.source = 'student_link') EXECUTE FUNCTION test_raise_unique_violation();

      CREATE SEQUENCE test_share_code_tries;
      CREATE FUNCTION test_share_code_collides_once() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF nextval('test_share_code_tries') = 1 THEN
          RAISE EXCEPTION 'duplicate key value (test trigger)' USING ERRCODE = 'unique_violation';
        END IF;
        RETURN NEW;
      END $$;
      CREATE TRIGGER test_share_code_collides BEFORE UPDATE OF share_code ON evaluations
        FOR EACH ROW WHEN (OLD.share_code IS NULL AND NEW.share_code IS NOT NULL)
        EXECUTE FUNCTION test_share_code_collides_once();
    `);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  it("drizzle wraps the driver error, and isUniqueViolation still sees it", async () => {
    const orm = drizzle(db.pool);
    const err = await orm.execute(sql`UPDATE users SET email = 'collide-direct@example.com' WHERE id = ${w.users.t1}`).then(
      () => assert.fail("the trigger should have raised"),
      (e: unknown) => e,
    );
    assert.equal((err as { code?: string }).code, undefined, "the code is not on the error drizzle throws");
    assert.equal((err as { cause?: { code?: string } }).cause?.code, "23505");
    assert.equal(isUniqueViolation(err), true);
  });

  describe("auth", () => {
    it("register: a lost race on the email is 409 email_taken", async () => {
      const res = await call(on, "POST", "/auth/register", undefined, {
        firstName: "A",
        lastName: "B",
        email: "collide-register@example.com",
        password: PASSWORD,
        acceptedTerms: true,
      });
      assert.equal(res.status, 409, on.logs().slice(-1500));
      assert.equal(res.json.code, "email_taken");
    });

    it("change-unverified-email: a lost race on the new email is 409 email_taken", async () => {
      const signup = await call(on, "POST", "/auth/register", undefined, {
        firstName: "A",
        lastName: "B",
        email: "pending@example.com",
        password: PASSWORD,
        acceptedTerms: true,
      });
      assert.equal(signup.status, 201, on.logs().slice(-1500));
      const res = await call(on, "POST", "/auth/change-unverified-email", undefined, {
        email: "pending@example.com",
        password: PASSWORD,
        newEmail: "collide-change@example.com",
      });
      assert.equal(res.status, 409, on.logs().slice(-1500));
      assert.equal(res.json.code, "email_taken");
    });

    it("add-email: a lost race on the email is 409 email_taken", async () => {
      const res = await call(on, "POST", "/auth/add-email", w.users.studentA, {
        email: "collide-add@example.com",
        password: PASSWORD,
      });
      assert.equal(res.status, 409, on.logs().slice(-1500));
      assert.equal(res.json.code, "email_taken");
    });
  });

  it("/take claim: losing the race for a name is 409 name_taken", async () => {
    // The seeded codes hold characters the share-code alphabet drops (I, 1), so give it a real one.
    await db.pool.query(`UPDATE evaluations SET share_code = 'MXDQZ7' WHERE id = $1`, [x.exams.exMixed]);
    const res = await call(on, "POST", "/take/MXDQZ7/claim", undefined, { studentId: w.students.sA1 });
    assert.equal(res.status, 409, on.logs().slice(-1500));
    assert.equal(res.json.code, "name_taken");
  });

  it("publish: a share-code collision is retried, not a 500", async () => {
    const res = await call(on, "POST", `/evaluations/${x.exams.exPaperDraft}/publish`, w.users.t1);
    assert.equal(res.status, 200, on.logs().slice(-1500));
    const row = (await db.pool.query(`SELECT status, share_code FROM evaluations WHERE id = $1`, [x.exams.exPaperDraft])).rows[0];
    assert.equal(row.status, "published");
    assert.ok(row.share_code);
    const tries = (await db.pool.query(`SELECT last_value FROM test_share_code_tries`)).rows[0];
    assert.equal(Number(tries.last_value), 2, "one collision, then one write that landed");
  });
});
