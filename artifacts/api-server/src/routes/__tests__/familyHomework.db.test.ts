/**
 * What this guards: students and parents read homework and students tick it
 * off, against real rows. The ways that goes wrong are all about WHICH child:
 * a student seeing the class their parent's other roster row for the same
 * child sits in, a completion by one child showing as done for a sibling in
 * the same class, a draft exam leaking to a family, another family's titles,
 * and a tick landing on homework the account has no right to.
 *
 * One database; one server with the student-accounts flag on, one with it off.
 * Tests that mutate completions come after the read-only ones and clean up
 * after themselves where a later test depends on it.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EXAM_TITLES, HW_TITLES, seedHomework, type HomeworkWorld } from "../../test-support/seedHomework.ts";

interface Item {
  id: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueAt: string;
  className: string;
  teacherName: string;
  done: boolean;
  doneAt: string | null;
  state: "done" | "overdue" | "open";
  exam: { title: string } | null;
}
interface ChildBody {
  key: string;
  displayName: string;
  homework: Item[];
}

const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

async function call(server: TestServer, method: string, path: string, userId?: string) {
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers: userId ? { Authorization: `Bearer ${accessToken(userId)}` } : {},
  });
  const text = await res.text();
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as any };
}

describeDb("family homework over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let off: TestServer;
  let w: FamilyWorld;
  let h: HomeworkWorld;

  const studentList = async (userId: string) => {
    const r = await call(on, "GET", "/student/homework", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, homework: r.json.homework as Item[] };
  };
  const parentList = async (userId: string) => {
    const r = await call(on, "GET", "/parent/homework", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, children: r.json.children as ChildBody[] };
  };
  const titlesOf = (items: Item[]) => items.map(i => i.title);
  const completionCount = async () =>
    (await db.pool.query(`SELECT count(*)::int AS n FROM homework_completions`)).rows[0].n as number;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    h = await seedHomework(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
    off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined } });
  });
  after(async () => {
    await off?.stop();
    await on?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    it("refuses no token and a bad token", async () => {
      for (const [method, path] of [
        ["GET", "/student/homework"],
        ["GET", "/parent/homework"],
        ["PUT", `/student/homework/${h.hw.hwC1}/done`],
        ["DELETE", `/student/homework/${h.hw.hwC1}/done`],
      ] as const) {
        assert.equal((await call(on, method, path)).status, 401, `${method} ${path} without a token`);
        const bad = await fetch(`${on.base}${path}`, { method, headers: { Authorization: "Bearer not-a-token" } });
        assert.equal(bad.status, 401, `${method} ${path} with a bad token`);
      }
    });

    it("refuses the wrong role on each route", async () => {
      const cases: Array<[string, string, string, string]> = [
        ["GET", "/student/homework", w.users.t1, "teacher"],
        ["GET", "/parent/homework", w.users.t1, "teacher"],
        ["GET", "/student/homework", w.users.parentA, "parent"],
        ["GET", "/parent/homework", w.users.studentA, "student"],
        // Parents cannot tick a child's homework off.
        ["PUT", `/student/homework/${h.hw.hwC1}/done`, w.users.parentA, "parent"],
        ["DELETE", `/student/homework/${h.hw.hwC1}/done`, w.users.parentA, "parent"],
        ["PUT", `/student/homework/${h.hw.hwC1}/done`, w.users.t1, "teacher"],
      ];
      for (const [method, path, userId, who] of cases) {
        assert.equal((await call(on, method, path, userId)).status, 403, `${method} ${path} as a ${who}`);
      }
      assert.equal(await completionCount(), 0, "a refused caller wrote nothing");
    });

    it("answers student_accounts_disabled while the flag is off, on all four endpoints", async () => {
      const cases: Array<[string, string, string]> = [
        ["GET", "/student/homework", w.users.studentA],
        ["GET", "/parent/homework", w.users.parentA],
        ["PUT", `/student/homework/${h.hw.hwC1}/done`, w.users.studentA],
        ["DELETE", `/student/homework/${h.hw.hwC1}/done`, w.users.studentA],
      ];
      for (const [method, path, userId] of cases) {
        const r = await call(off, method, path, userId);
        assert.equal(r.status, 403, `${method} ${path}`);
        assert.equal(r.json.code, "student_accounts_disabled", `${method} ${path}`);
      }
      assert.equal(await completionCount(), 0, "nothing written while the feature is off");
    });
  });

  describe("a student's view", () => {
    it("sees the homework of the classes their own roster row is in — and nothing else", async () => {
      const { text, homework } = await studentList(w.users.studentA);
      const titles = titlesOf(homework);
      for (const t of [HW_TITLES.hwC1, HW_TITLES.hwC1Exam, HW_TITLES.hwC1Draft, HW_TITLES.hwRecentOverdue]) {
        assert.ok(titles.includes(t), `${t} is listed`);
      }
      assert.equal(titles.length, 4, `exactly those four: ${titles.join(", ")}`);
      // hwC2 is Sara's, through her OTHER roster row — not this account's.
      for (const t of [HW_TITLES.hwC2, HW_TITLES.hwC3, HW_TITLES.hwC5, HW_TITLES.hwC4, HW_TITLES.hwArchived, HW_TITLES.hwOld]) {
        assert.ok(!titles.includes(t), `${t} must not be listed`);
      }
      for (const t of [HW_TITLES.hwC3, HW_TITLES.hwC5, EXAM_TITLES.examOtherClass, CHILDREN.noor, CHILDREN.yazan]) {
        assert.ok(!text.includes(t), `family B's ${t} must not appear`);
      }
    });

    it("carries only the fields a family may see", async () => {
      const { text, homework } = await studentList(w.users.studentA);
      for (const key of ["teacherId", "classGroupId", "studentId", "evaluationId"]) {
        assert.ok(!text.includes(`"${key}"`), `${key} must not be in the response`);
      }
      const item = homework.find(i => i.title === HW_TITLES.hwC1)!;
      assert.equal(item.className, "10A maths");
      assert.equal(item.teacherName, "Omar Haddad");
      assert.equal(item.done, false);
      assert.equal(item.doneAt, null);
      assert.equal(item.state, "open");
    });

    it("shows a published exam's title and hides a draft exam entirely", async () => {
      const { text, homework } = await studentList(w.users.studentA);
      assert.deepEqual(homework.find(i => i.title === HW_TITLES.hwC1Exam)!.exam, { title: EXAM_TITLES.examPublished });
      assert.equal(homework.find(i => i.title === HW_TITLES.hwC1Draft)!.exam, null);
      assert.ok(!text.includes(EXAM_TITLES.examDraft), "the draft exam's title appears nowhere");
    });

    it("sorts overdue work before open work", async () => {
      const { homework } = await studentList(w.users.studentA);
      const overdue = homework.find(i => i.title === HW_TITLES.hwRecentOverdue)!;
      assert.equal(overdue.state, "overdue");
      assert.equal(homework[0]!.id, overdue.id, "the overdue item leads");
      assert.ok(homework.slice(1).every(i => i.state === "open"));
      const due = homework.map(i => Date.parse(i.dueAt));
      assert.deepEqual(due, [...due].sort((a, b) => a - b), "soonest due first");
    });

    it("gets an empty list, not an error, with no roster link", async () => {
      const r = await call(on, "GET", "/student/homework", w.users.studentUnlinked);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { homework: [] });
    });
  });

  describe("a parent's view", () => {
    it("groups a child's roster rows into one entry, and drops the archived row", async () => {
      const { children } = await parentList(w.users.parentA);
      assert.equal(children.length, 2);
      const sara = children.find(c => c.displayName === CHILDREN.sara)!;
      const adam = children.find(c => c.displayName === CHILDREN.adam)!;
      assert.ok(sara && adam);

      const saraTitles = titlesOf(sara.homework);
      assert.ok(saraTitles.includes(HW_TITLES.hwC1), "Sara's c1 row");
      assert.ok(saraTitles.includes(HW_TITLES.hwC2), "Sara's c2 row");
      // Adam: c1 only. His archived row sits in c2 and contributes nothing; c4 is an archived class.
      assert.ok(titlesOf(adam.homework).includes(HW_TITLES.hwC1));
      assert.ok(!titlesOf(adam.homework).includes(HW_TITLES.hwC2), "the archived roster row adds nothing");
      assert.ok(!titlesOf(adam.homework).includes(HW_TITLES.hwC4), "an archived class adds nothing");
      for (const c of [sara, adam]) {
        for (const t of [HW_TITLES.hwC3, HW_TITLES.hwC5, HW_TITLES.hwArchived, HW_TITLES.hwOld, HW_TITLES.hwC4]) {
          assert.ok(!titlesOf(c.homework).includes(t), `${c.displayName} must not see ${t}`);
        }
      }
      // Same key and name as the schedule's entry for the same child.
      const schedule = await call(on, "GET", "/parent/schedule", w.users.parentA);
      const pairs = (xs: Array<{ key: string; displayName: string }>) => xs.map(x => `${x.key}|${x.displayName}`).sort();
      assert.deepEqual(pairs(children), pairs(schedule.json.children));
    });

    it("gets exactly their own family's homework — parent B sees none of A's", async () => {
      const { text, children } = await parentList(w.users.parentB);
      assert.deepEqual(children.map(c => c.displayName).sort(), [CHILDREN.noor, CHILDREN.yazan].sort());
      const all = children.flatMap(c => titlesOf(c.homework));
      assert.deepEqual(all.sort(), [HW_TITLES.hwC3, HW_TITLES.hwC5].sort());
      for (const t of [CHILDREN.sara, CHILDREN.adam, HW_TITLES.hwC1, HW_TITLES.hwC2, EXAM_TITLES.examPublished]) {
        assert.ok(!text.includes(t), `family A's ${t} must not appear`);
      }
    });

    it("never exposes a draft exam or internal ids", async () => {
      const { text, children } = await parentList(w.users.parentA);
      const sara = children.find(c => c.displayName === CHILDREN.sara)!;
      assert.deepEqual(sara.homework.find(i => i.title === HW_TITLES.hwC1Exam)!.exam, { title: EXAM_TITLES.examPublished });
      assert.equal(sara.homework.find(i => i.title === HW_TITLES.hwC1Draft)!.exam, null);
      assert.ok(!text.includes(EXAM_TITLES.examDraft));
      for (const key of ["teacherId", "classGroupId", "studentId", "evaluationId"]) {
        assert.ok(!text.includes(`"${key}"`), `${key} must not be in the response`);
      }
    });

    it("gets an empty list with no children", async () => {
      // studentUnlinked has no guardian links; give the role check a parent without any.
      const parent = await db.pool.query<{ id: string }>(
        `INSERT INTO users (first_name, last_name, role) VALUES ('Parent', 'Childless', 'parent') RETURNING id`,
      );
      const r = await call(on, "GET", "/parent/homework", parent.rows[0]!.id);
      assert.equal(r.status, 200);
      assert.deepEqual(r.json, { children: [] });
    });
  });

  // Everything below writes completions. Each test ends with none left.
  describe("marking done", () => {
    const put = (id: string, userId = w.users.studentA) => call(on, "PUT", `/student/homework/${id}/done`, userId);
    const del = (id: string, userId = w.users.studentA) => call(on, "DELETE", `/student/homework/${id}/done`, userId);
    const clean = () => db.pool.query(`DELETE FROM homework_completions`);

    it("ticks it off for the student, for Sara only (not her classmate Adam), and can undo", async () => {
      try {
        const done = await put(h.hw.hwC1);
        assert.equal(done.status, 200, on.logs().slice(-1500));
        assert.deepEqual(done.json, { done: true });

        const own = (await studentList(w.users.studentA)).homework.find(i => i.id === h.hw.hwC1)!;
        assert.equal(own.done, true);
        assert.equal(own.state, "done");
        assert.ok(own.doneAt, "doneAt is set");

        // Parent A: done for Sara, still open for Adam — same class, different child.
        const { children } = await parentList(w.users.parentA);
        const sara = children.find(c => c.displayName === CHILDREN.sara)!;
        const adam = children.find(c => c.displayName === CHILDREN.adam)!;
        assert.equal(sara.homework.find(i => i.id === h.hw.hwC1)!.done, true, "done for Sara");
        const adamItem = adam.homework.find(i => i.id === h.hw.hwC1)!;
        assert.equal(adamItem.done, false, "Sara's tick must not mark Adam's homework done");
        assert.equal(adamItem.state, "open");
        // The sibling in the sibling's own roster row has no completion at all.
        const rows = await db.pool.query(`SELECT student_id FROM homework_completions WHERE homework_id = $1`, [h.hw.hwC1]);
        assert.deepEqual(rows.rows.map(r => r.student_id), [w.students.sA1]);

        // Family B is unaffected.
        const b = await parentList(w.users.parentB);
        assert.ok(b.children.flatMap(c => c.homework).every(i => !i.done));

        // A second PUT is a no-op.
        const again = await put(h.hw.hwC1);
        assert.equal(again.status, 200);
        assert.deepEqual(again.json, { done: true });
        assert.equal(await completionCount(), 1);

        // A done item sorts last.
        const sorted = (await studentList(w.users.studentA)).homework;
        assert.equal(sorted[sorted.length - 1]!.id, h.hw.hwC1);

        // And can be undone — idempotently.
        const undone = await del(h.hw.hwC1);
        assert.equal(undone.status, 200);
        assert.deepEqual(undone.json, { done: false });
        assert.equal((await del(h.hw.hwC1)).status, 200);
        assert.equal(await completionCount(), 0);
        const reopened = (await studentList(w.users.studentA)).homework.find(i => i.id === h.hw.hwC1)!;
        assert.equal(reopened.done, false);
        assert.equal(reopened.state, "open");
      } finally {
        await clean();
      }
    });

    it("does not count a completion by a row of the same child that is not in the homework's class", async () => {
      // Sara's OTHER row (sA2, in c2) ticking a c1 homework cannot happen through
      // the API; if it were ever in the table it must not read as done for c1.
      try {
        await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [h.hw.hwC1, w.students.sA2]);
        const { children } = await parentList(w.users.parentA);
        const sara = children.find(c => c.displayName === CHILDREN.sara)!;
        assert.equal(sara.homework.find(i => i.id === h.hw.hwC1)!.done, false);
        assert.equal((await studentList(w.users.studentA)).homework.find(i => i.id === h.hw.hwC1)!.done, false);
      } finally {
        await clean();
      }
    });

    it("answers one identical 404 for homework that is not theirs, however it is not theirs", async () => {
      const before = await completionCount();
      const ids: Array<[string, string]> = [
        ["a class their row is not in", h.hw.hwC2],
        ["another family's class", h.hw.hwC3],
        ["an archived class", h.hw.hwC4],
        ["archived homework", h.hw.hwArchived],
        ["a random uuid", RANDOM_UUID],
        ["a malformed id", "nope"],
      ];
      const results = [];
      for (const [why, id] of ids) {
        for (const send of [put, del]) {
          const r = await send(id);
          assert.equal(r.status, 404, `${why}: ${r.text}`);
          results.push(r);
        }
      }
      assert.deepEqual(results[0]!.json, { error: "Homework not found" });
      for (const r of results) assert.equal(r.text, results[0]!.text, "bodies are identical");
      assert.equal(await completionCount(), before, "no row inserted");
    });

    it("does not let a delete remove another account's completion", async () => {
      try {
        // Student B (Noor, family B) completes hwC3; student A deleting hwC3 must find nothing.
        const mine = await put(h.hw.hwC3, w.users.studentB);
        assert.equal(mine.status, 200, mine.text);
        assert.equal((await del(h.hw.hwC3, w.users.studentA)).status, 404);
        assert.equal(await completionCount(), 1, "student B's completion survives");
      } finally {
        await clean();
      }
    });

    it("lets the teacher see the count", async () => {
      try {
        assert.equal((await put(h.hw.hwC1)).status, 200);
        const r = await call(on, "GET", `/classes/${w.classes.c1}/homework`, w.users.t1);
        assert.equal(r.status, 200, r.text);
        const row = (r.json.homework as Array<{ id: string; doneCount: number }>).find(x => x.id === h.hw.hwC1)!;
        assert.equal(row.doneCount, 1);
      } finally {
        await clean();
      }
    });

    it("refuses a student with no roster link", async () => {
      const r = await put(h.hw.hwC1, w.users.studentUnlinked);
      assert.equal(r.status, 404);
      assert.equal(await completionCount(), 0);
    });
  });
});
