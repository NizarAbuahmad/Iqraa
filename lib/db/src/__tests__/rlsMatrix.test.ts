// lib/db/src/__tests__/rlsMatrix.test.ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import pg from "pg";
import { asUser } from "../identity.ts";
import { ScopedPool } from "../scopedPool.ts";
import { seed, TEST_URL, type Fixture } from "../testing/rlsHarness.ts";

// Needs a migrated Postgres. Without RLS_TEST_DATABASE_URL (the `workspace` CI
// job has no database) the suite skips; the `migrations` job supplies one.
describe("row-level security matrix", { skip: !TEST_URL && "RLS_TEST_DATABASE_URL not set" }, () => {
  // Definitely-assigned in before(); after() uses `?.` because before() may have failed part-way.
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

  const as = <T>(key: keyof Fixture["ids"], role: string, fn: () => Promise<T>) =>
    asUser({ userId: ids[key]!, role }, fn);
  const col = async (sql: string, values: unknown[] = []) =>
    (await scoped.query(sql, values)).rows.map((r: Record<string, unknown>) => Object.values(r)[0]);

  test("no identity sees nothing and writes nothing", async () => {
    assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []);
    await assert.rejects(
      scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
      /row-level security/,
    );
  });

  test("a teacher sees their own students and no one else's", () =>
    as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
    }));

  test("a teacher cannot update or delete another teacher's student, nor create one in their name", () =>
    as("teacherB", "teacher", async () => {
      assert.equal((await scoped.query(`UPDATE students SET display_name = 'hax' WHERE id = $1`, [ids.studentA])).rowCount, 0);
      assert.equal((await scoped.query(`DELETE FROM students WHERE id = $1`, [ids.studentA])).rowCount, 0);
      await assert.rejects(
        scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'x')`, [ids.teacherA]),
        /row-level security/,
      );
    }));

  test("INSERT ... RETURNING works for the owner of the row", () =>
    as("teacherA", "teacher", async () => {
      const res = await scoped.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'New') RETURNING id`, [ids.teacherA]);
      assert.equal(res.rowCount, 1);
      const thread = await scoped.query(`INSERT INTO chat_threads (type, created_by) VALUES ('custom_group', $1) RETURNING id`, [ids.teacherA]);
      assert.equal(thread.rowCount, 1);
    }));

  test("a linked parent sees the child, the child's attempt and class — and cannot edit", () =>
    as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
      assert.deepEqual(await col(`SELECT id FROM attempts`), [ids.attemptA]);
      assert.deepEqual(await col(`SELECT id FROM class_groups WHERE id = $1`, [ids.classA]), [ids.classA]);
      assert.equal((await scoped.query(`UPDATE students SET display_name = 'hax' WHERE id = $1`, [ids.studentA])).rowCount, 0);
      assert.equal((await scoped.query(`UPDATE attempts SET teacher_comment = 'hax' WHERE id = $1`, [ids.attemptA])).rowCount, 0);
    }));

  test("an unlinked parent sees no students, attempts or parent contacts", () =>
    as("parentB", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []);
      assert.deepEqual(await col(`SELECT id FROM attempts`), []);
      assert.deepEqual(await col(`SELECT id FROM parent_contacts`), []);
    }));

  test("parent contacts are the teacher's alone", () =>
    as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM parent_contacts`), []);
    }));

  test("a user cannot link themselves to a student they do not teach", () =>
    as("parentB", "parent", async () => {
      for (const relation of ["guardian", "self"]) {
        await assert.rejects(
          scoped.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, $3)`, [ids.studentB, ids.parentB, relation]),
          /row-level security/,
        );
      }
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = $1`, [ids.studentB]), []);
    }));

  test("a teacher may link an account to their own student, and only theirs", async () => {
    await as("teacherA", "teacher", async () => {
      const ok = await scoped.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian') RETURNING id`, [ids.studentA, ids.parentB]);
      assert.equal(ok.rowCount, 1);
      await assert.rejects(
        scoped.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'guardian')`, [ids.studentB, ids.parentB]),
        /row-level security/,
      );
      assert.equal((await scoped.query(`DELETE FROM roster_links WHERE student_id = $1 AND user_id = $2`, [ids.studentA, ids.parentB])).rowCount, 1);
    });
  });

  test("a student sees their own record but never the answer key", () =>
    as("studentUser", "student", async () => {
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), [ids.studentA]);
      assert.deepEqual(await col(`SELECT id FROM evaluations WHERE id = $1`, [ids.evalA]), [ids.evalA]);
      assert.deepEqual(await col(`SELECT id FROM evaluation_questions`), []);
    }));

  test("grades are written by the teacher, not by the student or parent", async () => {
    for (const [who, role] of [["studentUser", "student"], ["parentA", "parent"]] as const) {
      await as(who, role, async () => {
        await assert.rejects(
          scoped.query(`INSERT INTO attempt_question_grades (attempt_id, question_id, verdict, grader) VALUES ($1, $2, 'correct', 'auto')`, [ids.attemptA, ids.questionA]),
          /row-level security/,
        );
      });
    }
    await as("teacherA", "teacher", async () => {
      const res = await scoped.query(`INSERT INTO attempt_question_grades (attempt_id, question_id, verdict, grader) VALUES ($1, $2, 'correct', 'teacher') RETURNING id`, [ids.attemptA, ids.questionA]);
      assert.equal(res.rowCount, 1);
    });
  });

  test("a thread's participants see it and its messages; outsiders see neither", async () => {
    await as("parentA", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_messages WHERE id = ANY($1)`, [[ids.msgDirect, ids.msgOther]]), [ids.msgDirect]);
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = ANY($1)`, [[ids.threadDirect, ids.threadOther]]), [ids.threadDirect]);
    });
    await as("parentB", "parent", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_messages WHERE id = ANY($1)`, [[ids.msgDirect, ids.msgOther]]), []);
    });
  });

  test("posting needs membership and your own sender id", async () => {
    await as("parentB", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'intrude')`, [ids.threadDirect, ids.parentB]),
        /row-level security/,
      );
    });
    await as("parentA", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'spoof')`, [ids.threadDirect, ids.teacherA]),
        /row-level security/,
      );
      const ok = await scoped.query(`INSERT INTO chat_messages (thread_id, sender_id, body) VALUES ($1, $2, 'hello') RETURNING id`, [ids.threadDirect, ids.parentA]);
      assert.equal(ok.rowCount, 1);
    });
  });

  test("either party of a direct thread may add both parties — even when the other created it", async () => {
    await as("parentA", "parent", async () => {
      // The shape openDirectThread uses: both rows, ON CONFLICT DO NOTHING, rows already there.
      const res = await scoped.query(
        `INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2), ($1,$3) ON CONFLICT DO NOTHING`,
        [ids.threadDirect, ids.parentA, ids.teacherA],
      );
      assert.equal(res.rowCount, 0);
    });
  });

  test("nobody can add themselves to a thread they are not a party to", async () => {
    await as("parentB", "parent", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2)`, [ids.threadDirect, ids.parentB]),
        /row-level security/,
      );
      await assert.rejects(
        scoped.query(`INSERT INTO chat_participants (thread_id, user_id) VALUES ($1,$2)`, [ids.threadClass, ids.parentB]),
        /row-level security/,
      );
    });
  });

  test("a user cannot move their own participant row or message into a thread they are not in", async () => {
    // RLS cannot compare old and new, so the UPDATE's WITH CHECK must re-test the new thread.
    await as("parentA", "parent", async () => {
      await assert.rejects(
        scoped.query(`UPDATE chat_participants SET thread_id = $2 WHERE thread_id = $1 AND user_id = $3`, [ids.threadDirect, ids.threadOther, ids.parentA]),
        /row-level security/,
      );
      // An ordinary update of the same row (hiding the thread) still works.
      assert.equal((await scoped.query(`UPDATE chat_participants SET hidden_at = now() WHERE thread_id = $1 AND user_id = $2`, [ids.threadDirect, ids.parentA])).rowCount, 1);
    });
    await owner.query(`UPDATE chat_participants SET hidden_at = NULL WHERE thread_id = $1 AND user_id = $2`, [ids.threadDirect, ids.parentA]);
    await as("teacherA", "teacher", async () => {
      await assert.rejects(
        scoped.query(`UPDATE chat_messages SET thread_id = $2 WHERE id = $1`, [ids.msgDirect, ids.threadOther]),
        /row-level security/,
      );
      assert.equal((await scoped.query(`UPDATE chat_messages SET body = body WHERE id = $1`, [ids.msgDirect])).rowCount, 1);
    });
    const home = await owner.query(`SELECT thread_id FROM chat_messages WHERE id = $1`, [ids.msgDirect]);
    assert.equal(home.rows[0].thread_id, ids.threadDirect);
  });

  test("a user cannot create a class thread for a class they do not own, nor re-type or re-point their own thread to one", async () => {
    await as("teacherB", "teacher", async () => {
      await assert.rejects(
        scoped.query(`INSERT INTO chat_threads (type, created_by, class_group_id) VALUES ('class_group', $1, $2)`, [ids.teacherB, ids.classA]),
        /row-level security/,
      );
      await assert.rejects(
        scoped.query(`INSERT INTO chat_threads (type, created_by) VALUES ('class_group', $1)`, [ids.teacherB]),
        /row-level security/,
      );
      // teacherB's own direct thread: re-typing it, or pointing it at teacherA's class, is refused.
      await assert.rejects(
        scoped.query(`UPDATE chat_threads SET type = 'class_group', class_group_id = $2 WHERE id = $1`, [ids.threadOther, ids.classA]),
        /row-level security/,
      );
      await assert.rejects(
        scoped.query(`UPDATE chat_threads SET type = 'class_group' WHERE id = $1`, [ids.threadOther]),
        /row-level security/,
      );
      // An ordinary update of that thread still works.
      assert.equal((await scoped.query(`UPDATE chat_threads SET title = 'renamed' WHERE id = $1`, [ids.threadOther])).rowCount, 1);
    });
    await as("teacherA", "teacher", async () => {
      // The class owner may still update their class thread.
      assert.equal((await scoped.query(`UPDATE chat_threads SET student_posting_enabled = student_posting_enabled WHERE id = $1`, [ids.threadClass])).rowCount, 1);
    });
    const after = await owner.query(`SELECT type, class_group_id, title FROM chat_threads WHERE id = $1`, [ids.threadOther]);
    assert.equal(after.rows[0].type, "direct");
    assert.equal(after.rows[0].class_group_id, null);
    await owner.query(`UPDATE chat_threads SET title = '' WHERE id = $1`, [ids.threadOther]);
  });

  test("a student may delete their own submitted attempt — not an unsubmitted one, not another student's, not as a parent", async () => {
    // attempts is unique per (evaluation, student), so each case gets its own evaluation.
    const evals = [randomUUID(), randomUUID(), randomUUID(), randomUUID()];
    try {
      for (const e of evals) {
        await owner.query(`INSERT INTO evaluations (id, teacher_id, grade_id, subject_id, book_id) VALUES ($1,$2,'g10','math','b1')`, [e, ids.teacherA]);
      }
      const [own, unsubmitted, others, guarded] = evals as [string, string, string, string];
      await owner.query(
        `INSERT INTO attempts (evaluation_id, student_id, status, submitted_at) VALUES ($1,$5,'submitted',now()), ($2,$5,'in_progress',NULL), ($3,$6,'submitted',now()), ($4,$5,'submitted',now())`,
        [own, unsubmitted, others, guarded, ids.studentA, ids.studentB],
      );
      const left = async (e: string) => Number((await owner.query(`SELECT count(*) n FROM attempts WHERE evaluation_id = $1`, [e])).rows[0].n);
      await as("studentUser", "student", async () => {
        assert.equal((await scoped.query(`DELETE FROM attempts WHERE evaluation_id = $1`, [own])).rowCount, 1);
        assert.equal((await scoped.query(`DELETE FROM attempts WHERE evaluation_id = $1`, [unsubmitted])).rowCount, 0);
        assert.equal((await scoped.query(`DELETE FROM attempts WHERE evaluation_id = $1`, [others])).rowCount, 0);
      });
      await as("parentA", "parent", async () => {
        assert.equal((await scoped.query(`DELETE FROM attempts WHERE evaluation_id = $1`, [guarded])).rowCount, 0);
      });
      assert.deepEqual([await left(own), await left(unsubmitted), await left(others), await left(guarded)], [0, 1, 1, 1]);
    } finally {
      await owner.query(`DELETE FROM evaluations WHERE id = ANY($1::uuid[])`, [evals]);
    }
  });

  test("the class owner sees the class thread without a participant row", async () => {
    await as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = $1`, [ids.threadClass]), [ids.threadClass]);
    });
    await as("teacherB", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_threads WHERE id = $1`, [ids.threadClass]), []);
    });
  });

  test("blocks are visible only to the blocker", async () => {
    await as("parentA", "parent", async () => {
      assert.equal((await col(`SELECT id FROM chat_blocks`)).length, 1);
    });
    await as("teacherA", "teacher", async () => {
      assert.deepEqual(await col(`SELECT id FROM chat_blocks`), []); // teacherA is the blocked one: must not learn it
    });
  });

  test("reports: reporter sees their own, an admin sees all", async () => {
    await as("parentA", "parent", async () => {
      assert.equal((await col(`SELECT id FROM chat_reports WHERE thread_id = ANY($1)`, [[ids.threadDirect, ids.threadOther]])).length, 1);
    });
    await as("admin", "system_admin", async () => {
      assert.equal((await col(`SELECT id FROM chat_reports WHERE thread_id = ANY($1)`, [[ids.threadDirect, ids.threadOther]])).length, 2);
      assert.deepEqual(await col(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]), []); // admins get no blanket access
    });
  });

  test("auth token tables are closed to the app role entirely", () =>
    as("teacherA", "teacher", async () => {
      await assert.rejects(scoped.query(`SELECT 1 FROM refresh_tokens`), /permission denied/);
      await assert.rejects(scoped.query(`SELECT 1 FROM password_reset_tokens`), /permission denied/);
      await assert.rejects(scoped.query(`SELECT 1 FROM email_verification_tokens`), /permission denied/);
    }));

  test("an owner connection (systemDb) is not subject to policies", async () => {
    const res = await owner.query(`SELECT id FROM students WHERE id = ANY($1)`, [[ids.studentA, ids.studentB]]);
    assert.equal(res.rowCount, 2);
  });

  test("with enforcement off the pool behaves like a plain pg.Pool", async () => {
    const off = new ScopedPool({ connectionString: TEST_URL, max: 2 }, false);
    try {
      const res = await off.query(`SELECT current_user AS u, (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`, [[ids.studentA, ids.studentB]]);
      assert.notEqual(res.rows[0].u, "iqraa_app");
      assert.equal(res.rows[0].n, "2");
    } finally {
      await off.end();
    }
  });

  test("a transaction (the db.transaction path) runs scoped and nothing leaks afterwards", async () => {
    await as("teacherA", "teacher", async () => {
      const client = await scoped.connect();
      try {
        await client.query("begin");
        const inside = await client.query(`SELECT current_user AS u, app_uid() AS uid, (SELECT count(*) FROM students WHERE id = ANY($1)) AS n`, [[ids.studentA, ids.studentB]]);
        assert.equal(inside.rows[0].u, "iqraa_app");
        assert.equal(inside.rows[0].uid, ids.teacherA);
        assert.equal(inside.rows[0].n, "1");
        await client.query("commit");
      } finally {
        client.release();
      }
    });
    // Next borrower, no identity: still iqraa_app, but no user left over.
    const after = await scoped.query(`SELECT current_user AS u, app_uid() AS uid`);
    assert.equal(after.rows[0].u, "iqraa_app");
    assert.equal(after.rows[0].uid, null);
  });

  test("a failed scope destroys the connection instead of leaking it", async () => {
    // A login role that is not a member of iqraa_app: `SET LOCAL ROLE iqraa_app` fails after `begin` succeeds.
    await owner.query(`DROP ROLE IF EXISTS rls_no_member`);
    // With a password: CI's postgres service authenticates over TCP with scram, trust auth is only local.
    await owner.query(`CREATE ROLE rls_no_member LOGIN PASSWORD 'rls_no_member_pw'`);
    const url = new URL(TEST_URL!); // keeps host/port/database; only the credentials are swapped
    url.username = "rls_no_member";
    url.password = "rls_no_member_pw";
    const pool = new ScopedPool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 3000 }, true);
    let c: pg.PoolClient | undefined;
    try {
      c = await pool.connect();
      await assert.rejects(c.query("begin"), /permission denied|set role/i);
      // Drizzle never releases a client whose `begin` failed; with max 1 a leak would time out here.
      const again = await pool.connect();
      again.release();
      assert.equal(pool.totalCount, 1); // the failed client is gone; only the fresh one remains
      assert.equal(pool.idleCount, 1);
      assert.doesNotThrow(() => c?.release()); // idempotent: a caller's own finally must not throw
    } finally {
      // Release before ending: were the destroy fix to regress, a still-checked-out client
      // would make pool.end() wait forever and the DROP ROLE below never run.
      c?.release(true); // idempotent: a no-op when the pool already destroyed it
      await pool.end();
      await owner.query(`DROP ROLE IF EXISTS rls_no_member`);
    }
  });

  test("a failed statement rolls back and the connection stays usable", () =>
    as("teacherA", "teacher", async () => {
      await assert.rejects(scoped.query(`INSERT INTO students (teacher_id) VALUES ($1)`, [ids.teacherA])); // display_name is NOT NULL
      assert.equal((await col(`SELECT 1 AS one`)).length, 1);
    }));
});
