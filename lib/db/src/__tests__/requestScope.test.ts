// lib/db/src/__tests__/requestScope.test.ts
import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { asUser, type Identity } from "../identity.ts";
import { runInScope, type RequestScope } from "../requestScope.ts";
import { ScopedPool } from "../scopedPool.ts";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

// Needs a migrated Postgres, like the matrix suite; skips without RLS_TEST_DATABASE_URL.
describe("request-scoped connection", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  let owner!: pg.Pool;
  let scoped!: ScopedPool;
  let fx!: Fixture;
  let ids: Fixture["ids"];

  before(async () => {
    owner = new pg.Pool({ connectionString: TEST_URL, max: 2 });
    scoped = new ScopedPool({ connectionString: TEST_URL, max: 4 }, true);
    fx = await seed(owner);
    ids = fx.ids;
  });
  after(async () => {
    await fx?.cleanup();
    await scoped?.end();
    await owner?.end();
  });

  const identity = (key: keyof Fixture["ids"], role: string): Identity => ({ userId: ids[key]!, role });

  /** Run `fn` as `who` inside a held scope opened for them, and always end the scope. */
  const held = async <T>(who: Identity, fn: (scope: RequestScope) => Promise<T>, holdTimeoutMs = 5000): Promise<T> => {
    const scope = scoped.openScope(who, holdTimeoutMs)!;
    try {
      return await asUser(who, () => runInScope(scope, () => fn(scope)));
    } finally {
      await scope.end();
    }
  };

  test("every statement of the request runs as the caller, on one connection", async () => {
    await held(identity("teacherA", "teacher"), async scope => {
      const a = await scoped.query(
        `SELECT pg_backend_pid() AS pid, current_user AS u, app_uid() AS uid,
                (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`,
        [[ids.studentA, ids.studentB]],
      );
      const b = await scoped.query(`SELECT pg_backend_pid() AS pid`);
      assert.equal(a.rows[0].u, "iqraa_app");
      assert.equal(a.rows[0].uid, ids.teacherA);
      assert.equal(a.rows[0].n, "1"); // teacher A sees their own student only
      assert.equal(a.rows[0].pid, b.rows[0].pid); // one connection for the whole request
      assert.equal(scope.stats().statements, 2);
    });
  });

  test("two requests at once never see each other's identity", async () => {
    const run = (who: Identity) =>
      held(who, async () => {
        const seen: unknown[] = [];
        for (let n = 0; n < 5; n++) seen.push((await scoped.query(`SELECT app_uid() AS uid`)).rows[0].uid);
        return seen;
      });
    const [a, b] = await Promise.all([run(identity("teacherA", "teacher")), run(identity("teacherB", "teacher"))]);
    assert.deepEqual(a, Array(5).fill(ids.teacherA));
    assert.deepEqual(b, Array(5).fill(ids.teacherB));
  });

  test("ending the scope commits, frees the connection and leaves no identity behind", async () => {
    await held(identity("teacherA", "teacher"), async () => {
      await scoped.query(`SELECT 1`);
    });
    assert.equal(scoped.idleCount, scoped.totalCount);
    assert.equal(scoped.waitingCount, 0);
    const after = await scoped.query(`SELECT app_uid() AS uid`);
    assert.equal(after.rows[0].uid, null);
  });

  test("a write inside a held scope is refused, ends the scope, and later statements still run scoped", async () => {
    await held(identity("teacherA", "teacher"), async scope => {
      await assert.rejects(
        scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
        /read-only/,
      );
      assert.equal(scope.ended, true);
      const after = await scoped.query(`SELECT current_user AS u, app_uid() AS uid`);
      assert.equal(after.rows[0].u, "iqraa_app");
      assert.equal(after.rows[0].uid, ids.teacherA);
    });
    assert.equal(scoped.idleCount, scoped.totalCount);
  });

  test("a scope held past its timeout is rolled back and its connection freed", async () => {
    await held(
      identity("teacherA", "teacher"),
      async scope => {
        await scoped.query(`SELECT 1`);
        await sleep(300);
        assert.equal(scope.ended, true);
        assert.equal(scoped.idleCount, scoped.totalCount);
        const after = await scoped.query(`SELECT app_uid() AS uid`); // per-statement path now
        assert.equal(after.rows[0].uid, ids.teacherA);
      },
      100,
    );
  });

  test("a scope that never ran a statement holds no connection", async () => {
    const before = scoped.totalCount;
    await held(identity("teacherA", "teacher"), async () => {});
    assert.equal(scoped.totalCount, before);
  });

  test("with enforcement off there is no scope", async () => {
    const off = new ScopedPool({ connectionString: TEST_URL, max: 1 }, false);
    try {
      assert.equal(off.openScope(identity("teacherA", "teacher")), undefined);
    } finally {
      await off.end();
    }
  });
});
