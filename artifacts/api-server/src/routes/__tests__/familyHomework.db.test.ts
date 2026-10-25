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
  canTrack: boolean;
  gameResults: Array<{ lessonId: string; game: string; score: number; total: number; attempts: number }>;
}
interface ChildBody {
  key: string;
  displayName: string;
  canTrack: boolean;
  homework: Item[];
}

const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

async function call(server: TestServer, method: string, path: string, userId?: string, body?: unknown) {
  const headers: Record<string, string> = userId ? { Authorization: `Bearer ${accessToken(userId)}` } : {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
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

    it("marks every item trackable: a student's list is, by construction, the rows their own account is", async () => {
      const { homework } = await studentList(w.users.studentA);
      assert.ok(homework.length > 0);
      assert.ok(homework.every(i => i.canTrack === true), "a student can always tick their own items");
      const noor = (await studentList(w.users.studentB)).homework;
      assert.ok(noor.length > 0 && noor.every(i => i.canTrack === true));
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

    it("says per item whether it can be ticked: only when a row of the child IN THAT ITEM'S CLASS has a student account", async () => {
      // Seeded self links: Sara's sA1 (class c1) and Noor's nB1 (c3). Sara's SECOND row sA2 (c2)
      // has none, Adam and Yazan have none. The child-level flag is an aggregate, not the rule.
      const a = (await parentList(w.users.parentA)).children;
      const sara = a.find(c => c.displayName === CHILDREN.sara)!;
      const adam = a.find(c => c.displayName === CHILDREN.adam)!;
      const flag = (c: ChildBody, title: string) => c.homework.find(i => i.title === title)!.canTrack;
      assert.equal(flag(sara, HW_TITLES.hwC1), true, "Sara's c1 row is self-linked");
      assert.equal(flag(sara, HW_TITLES.hwC1Exam), true);
      assert.equal(flag(sara, HW_TITLES.hwC2), false, "Sara's c2 row has no account: nobody can tick c2 homework");
      for (const i of adam.homework) assert.equal(i.canTrack, false, `Adam: ${i.title}`);
      assert.equal(sara.canTrack, true, "aggregate: some item of Sara's is trackable");
      assert.equal(adam.canTrack, false);

      const b = (await parentList(w.users.parentB)).children;
      const noor = b.find(c => c.displayName === CHILDREN.noor)!;
      const yazan = b.find(c => c.displayName === CHILDREN.yazan)!;
      assert.equal(flag(noor, HW_TITLES.hwC3), true);
      assert.equal(flag(yazan, HW_TITLES.hwC5), false);
      assert.equal(noor.canTrack, true);
      assert.equal(yazan.canTrack, false);
      for (const c of [...a, ...b]) assert.deepEqual(Object.keys(c).sort(), ["canTrack", "displayName", "homework", "key"]);
    });

    it("an account on Sara's c2 row makes the c2 item trackable, and the c1 item stays so", async () => {
      await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [
        w.students.sA2,
        w.users.studentUnlinked,
      ]);
      try {
        const sara = (await parentList(w.users.parentA)).children.find(c => c.displayName === CHILDREN.sara)!;
        assert.equal(sara.homework.find(i => i.title === HW_TITLES.hwC2)!.canTrack, true);
        assert.equal(sara.homework.find(i => i.title === HW_TITLES.hwC1)!.canTrack, true);
      } finally {
        await db.pool.query(`DELETE FROM roster_links WHERE user_id = $1 AND relation = 'self'`, [w.users.studentUnlinked]);
      }
    });

    it("the child-level flag with no items is whether any live row has an account", async () => {
      await db.pool.query(`UPDATE homework SET archived_at = now() WHERE id = ANY($1)`, [[h.hw.hwC3, h.hw.hwC5]]);
      try {
        let b = (await parentList(w.users.parentB)).children;
        assert.ok(b.every(c => c.homework.length === 0));
        assert.equal(b.find(c => c.displayName === CHILDREN.noor)!.canTrack, true, "Noor's row has an account");
        assert.equal(b.find(c => c.displayName === CHILDREN.yazan)!.canTrack, false);
        await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [
          w.students.yB,
          w.users.studentUnlinked,
        ]);
        b = (await parentList(w.users.parentB)).children;
        assert.equal(b.find(c => c.displayName === CHILDREN.yazan)!.canTrack, true);
      } finally {
        await db.pool.query(`DELETE FROM roster_links WHERE user_id = $1 AND relation = 'self'`, [w.users.studentUnlinked]);
        await db.pool.query(`UPDATE homework SET archived_at = NULL WHERE id = ANY($1)`, [[h.hw.hwC3, h.hw.hwC5]]);
      }
    });

    it("counts a self link on any of the child's rows in that class, to any account, and ignores an archived row's", async () => {
      // Yazan's only row gets a student account → his c5 item is trackable. Adam's ARCHIVED row getting one changes nothing for him.
      await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self'), ($3, $2, 'self')`, [
        w.students.yB,
        w.users.studentUnlinked,
        w.students.aArch,
      ]);
      try {
        const yazan = (await parentList(w.users.parentB)).children.find(c => c.displayName === CHILDREN.yazan)!;
        assert.equal(yazan.canTrack, true);
        assert.equal(yazan.homework.find(i => i.title === HW_TITLES.hwC5)!.canTrack, true);
        const adam = (await parentList(w.users.parentA)).children.find(c => c.displayName === CHILDREN.adam)!;
        assert.equal(adam.canTrack, false, "an archived row is not part of the child");
        assert.ok(adam.homework.every(i => i.canTrack === false));
      } finally {
        await db.pool.query(`DELETE FROM roster_links WHERE user_id = $1 AND relation = 'self'`, [w.users.studentUnlinked]);
      }
    });

    it("stops showing an exam once it is archived", async () => {
      await db.pool.query(`UPDATE evaluations SET archived_at = now() WHERE id = $1`, [h.exams.examPublished]);
      try {
        const sara = (await parentList(w.users.parentA)).children.find(c => c.displayName === CHILDREN.sara)!;
        const item = sara.homework.find(i => i.title === HW_TITLES.hwC1Exam)!;
        assert.equal(item.exam, null, "the family item shows no exam");
        assert.ok(!(await parentList(w.users.parentA)).text.includes(EXAM_TITLES.examPublished));
        const student = (await studentList(w.users.studentA)).homework.find(i => i.title === HW_TITLES.hwC1Exam)!;
        assert.equal(student.exam, null);
      } finally {
        await db.pool.query(`UPDATE evaluations SET archived_at = NULL WHERE id = $1`, [h.exams.examPublished]);
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

    it("scopes both the tick and the undo to the account's own row, never a classmate's", async () => {
      try {
        // Adam (aA) is in c1 too, but he is not student A's row. His completion is pre-seeded.
        await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [h.hw.hwC1, w.students.aA]);
        const studentIdsOf = async () =>
          (await db.pool.query(`SELECT student_id FROM homework_completions WHERE homework_id = $1`, [h.hw.hwC1])).rows
            .map(r => r.student_id as string)
            .sort();

        assert.equal((await put(h.hw.hwC1)).status, 200);
        assert.deepEqual(await studentIdsOf(), [w.students.aA, w.students.sA1].sort(), "PUT wrote only sA1's row");

        assert.equal((await del(h.hw.hwC1)).status, 200);
        assert.deepEqual(await studentIdsOf(), [w.students.aA], "DELETE removed sA1's row and left Adam's");
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

  // Creates its own homework and removes it again, so no earlier list changes.
  describe("games as homework", () => {
    const L1 = "kbl-math-s2-nccd-u5_l4";
    const L2 = "kbl-hist-s1-nccd-u1_l1";
    const att = (...pairs: Array<[string, string]>) =>
      JSON.stringify(pairs.map(([lessonId, g]) => ({ kind: "game", lessonId, game: g, title: `title-${g}` })));
    const result = (game: string, score: number, total: number, lessonId = L1) => ({ lessonId, game, score, total });
    let hwG: string; // t1/c1: memory + spot for L1, memory for L2
    let hwOtherClass: string; // t2/c2: memory — student A is not in c2
    let hwGone: string; // t1/c1: memory, archived
    const mk = async (teacher: string, klass: string, title: string, resources: string, archived = false) =>
      (
        await db.pool.query(
          `INSERT INTO homework (teacher_id, class_group_id, title, due_at, resources, archived_at)
           VALUES ($1, $2, $3, now() + interval '3 days', $4::jsonb, CASE WHEN $5::boolean THEN now() END) RETURNING id`,
          [teacher, klass, title, resources, archived],
        )
      ).rows[0].id as string;
    const play = (id: string, body: unknown, userId = w.users.studentA, server = on) =>
      call(server, "PUT", `/student/homework/${id}/game-result`, userId, body);
    const stored = async (id: string) =>
      (
        await db.pool.query(
          `SELECT student_id, lesson_id, game, score, total, attempts FROM game_results WHERE homework_id = $1 ORDER BY lesson_id, game, student_id`,
          [id],
        )
      ).rows as Array<{ student_id: string; lesson_id: string; game: string; score: number; total: number; attempts: number }>;
    const doneRows = async (id: string) =>
      (await db.pool.query(`SELECT student_id FROM homework_completions WHERE homework_id = $1`, [id])).rows.map(r => r.student_id);

    before(async () => {
      hwG = await mk(w.users.t1, w.classes.c1, "hw-games", att([L1, "memory"], [L1, "spot"], [L2, "memory"]));
      hwOtherClass = await mk(w.users.t2, w.classes.c2, "hw-games-c2", att([L1, "memory"]));
      hwGone = await mk(w.users.t1, w.classes.c1, "hw-games-archived", att([L1, "memory"]), true);
    });
    after(async () => {
      await db.pool.query(`DELETE FROM homework WHERE id = ANY($1)`, [[hwG, hwOtherClass, hwGone]]);
    });

    it("refuses the wrong caller and the flag being off", async () => {
      const body = result("memory", 1, 2);
      assert.equal((await call(on, "PUT", `/student/homework/${hwG}/game-result`, undefined, body)).status, 401);
      assert.equal((await play(hwG, body, w.users.parentA)).status, 403);
      assert.equal((await play(hwG, body, w.users.t1)).status, 403);
      const closed = await play(hwG, body, w.users.studentA, off);
      assert.equal(closed.status, 403);
      assert.equal(closed.json.code, "student_accounts_disabled");
      assert.equal((await stored(hwG)).length, 0);
    });

    it("answers 400 `invalid` for a bad body — including a missing lessonId — and writes nothing", async () => {
      const ok = result("memory", 1, 2);
      for (const bad of [
        undefined,
        {},
        { game: "memory", score: 1, total: 2 },
        { ...ok, lessonId: undefined },
        { ...ok, lessonId: "" },
        { ...ok, lessonId: 7 },
        { ...ok, lessonId: "x".repeat(201) },
        { ...ok, game: "chess" },
        { ...ok, score: 3 },
        { ...ok, score: -1 },
        { ...ok, total: 0 },
        { ...ok, total: 101 },
        { ...ok, score: 1.5 },
        { ...ok, score: "1" },
      ]) {
        const r = await play(hwG, bad);
        assert.equal(r.status, 400, JSON.stringify(bad));
        assert.equal(r.json.code, "invalid");
      }
      assert.equal((await stored(hwG)).length, 0);
      assert.deepEqual(await doneRows(hwG), []);
    });

    it("answers one 404 unless the homework carries THAT lesson's game: wrong lesson, wrong game, other class, stranger, archived, bad ids", async () => {
      const body = result("memory", 1, 2);
      const cases: Array<[string, string, unknown, string?]> = [
        ["a lesson the homework does not carry", hwG, result("memory", 1, 2, "kbl-math-s2-nccd-u1_l1")],
        ["a pairing the homework does not carry (spot for L2)", hwG, result("spot", 1, 2, L2)],
        ["a game the homework does not carry", hwG, result("scramble", 1, 2)],
        ["homework with no game at all", h.hw.hwC1, body],
        ["a class the row is not in", hwOtherClass, body],
        ["archived homework", hwGone, body],
        ["missing homework", RANDOM_UUID, body],
        ["a malformed id", "not-a-uuid", body],
        ["a student of another family", hwG, body, w.users.studentB],
        ["a student with no roster link", hwG, body, w.users.studentUnlinked],
      ];
      for (const [why, id, b, who] of cases) {
        const r = await play(id, b, who ?? w.users.studentA);
        assert.equal(r.status, 404, why);
        assert.equal(r.json.code, "not_found", why);
      }
      assert.equal((await stored(hwG)).length + (await stored(hwOtherClass)).length, 0);
      assert.deepEqual(await doneRows(hwG), []);
    });

    it("saves a result and ticks the homework off for the student's own row only", async () => {
      const r = await play(hwG, result("memory", 3, 5));
      assert.equal(r.status, 200, on.logs().slice(-1500));
      assert.deepEqual(r.json, { best: { score: 3, total: 5 }, attempts: 1 });
      const rows = await stored(hwG);
      assert.deepEqual(
        rows.map(x => [x.student_id, x.lesson_id, x.game, x.score, x.total, x.attempts]),
        [[w.students.sA1, L1, "memory", 3, 5, 1]],
      );
      assert.deepEqual(await doneRows(hwG), [w.students.sA1], "playing counts as done — for Sara, not Adam");
      assert.equal((await studentList(w.users.studentA)).homework.find(i => i.id === hwG)!.done, true);
    });

    it("takes the Math Corner exercises like a game, only where the homework attached them", async () => {
      const hwEx = await mk(w.users.t1, w.classes.c1, "hw-exercises", att([L1, "exercises"]));
      try {
        assert.equal((await play(hwG, result("exercises", 7, 10))).status, 404, "hwG has no exercises attached");
        const r = await play(hwEx, result("exercises", 7, 10));
        assert.equal(r.status, 200, on.logs().slice(-1500));
        assert.deepEqual(r.json, { best: { score: 7, total: 10 }, attempts: 1 });
        assert.deepEqual((await stored(hwEx)).map(x => [x.student_id, x.game, x.score, x.total]), [[w.students.sA1, "exercises", 7, 10]]);
        assert.deepEqual(await doneRows(hwEx), [w.students.sA1], "finishing the exercises ticks the homework off");
      } finally {
        await db.pool.query(`DELETE FROM homework WHERE id = $1`, [hwEx]);
      }
    });

    it("keeps the best result and counts every attempt; a tie keeps the existing one", async () => {
      const best = async (score: number, total: number) => (await play(hwG, result("memory", score, total))).json;
      assert.deepEqual(await best(2, 5), { best: { score: 3, total: 5 }, attempts: 2 }, "worse is not kept");
      assert.deepEqual(await best(6, 10), { best: { score: 3, total: 5 }, attempts: 3 }, "same ratio keeps the existing");
      assert.deepEqual(await best(4, 5), { best: { score: 4, total: 5 }, attempts: 4 }, "better replaces");
      assert.deepEqual(await best(9, 10), { best: { score: 9, total: 10 }, attempts: 5 }, "ratio, not raw score");
      assert.deepEqual(await best(8, 100), { best: { score: 9, total: 10 }, attempts: 6 }, "a bigger total does not win");
      const [row] = await stored(hwG);
      assert.deepEqual([row!.score, row!.total, row!.attempts], [9, 10, 6]);
    });

    it("keeps each game apart, and the same game for two lessons apart — lesson A's play does not satisfy lesson B", async () => {
      const spot = await play(hwG, result("spot", 1, 4));
      assert.deepEqual(spot.json, { best: { score: 1, total: 4 }, attempts: 1 });
      // Before L2's memory is played, only L1's results exist.
      const before = (await studentList(w.users.studentA)).homework.find(i => i.id === hwG)!;
      assert.deepEqual(before.gameResults.map(g => `${g.lessonId}:${g.game}`), [`${L1}:memory`, `${L1}:spot`]);
      const l2 = await play(hwG, result("memory", 2, 3, L2));
      assert.deepEqual(l2.json, { best: { score: 2, total: 3 }, attempts: 1 }, "its own row, its own count");
      assert.deepEqual(
        (await stored(hwG)).map(x => [x.lesson_id, x.game, x.score, x.attempts]),
        [[L2, "memory", 2, 1], [L1, "memory", 9, 6], [L1, "spot", 1, 1]],
      );
      assert.deepEqual(await doneRows(hwG), [w.students.sA1], "ticked once");
    });

    it("shows the results to the student and to the child's parent — and to no one else", async () => {
      const mine = (await studentList(w.users.studentA)).homework.find(i => i.id === hwG)!;
      assert.deepEqual(mine.gameResults, [
        { lessonId: L1, game: "memory", score: 9, total: 10, attempts: 6 },
        { lessonId: L1, game: "spot", score: 1, total: 4, attempts: 1 },
        { lessonId: L2, game: "memory", score: 2, total: 3, attempts: 1 },
      ]);

      const a = await parentList(w.users.parentA);
      const sara = a.children.find(c => c.displayName === CHILDREN.sara)!;
      const adam = a.children.find(c => c.displayName === CHILDREN.adam)!;
      assert.deepEqual(sara.homework.find(i => i.id === hwG)!.gameResults, mine.gameResults);
      assert.deepEqual(adam.homework.find(i => i.id === hwG)!.gameResults, [], "Adam has his own row, with no results");

      const b = await parentList(w.users.parentB);
      assert.ok(!b.text.includes(hwG), "another family does not see this homework at all");
      assert.ok(!(await studentList(w.users.studentB)).text.includes(hwG));
      // No ids leak through the new field, and plain homework carries an empty list.
      assert.ok(!JSON.stringify(mine).includes(w.students.sA1));
      const plain = (await studentList(w.users.studentA)).homework.find(i => i.title === HW_TITLES.hwC1)!;
      assert.deepEqual(plain.gameResults, []);
      for (const child of b.children) for (const item of child.homework) assert.deepEqual(item.gameResults, []);
    });

    it("lets the teacher read the same results", async () => {
      const r = await call(on, "GET", `/homework/${hwG}/game-results`, w.users.t1);
      assert.equal(r.status, 200, r.text);
      assert.deepEqual(
        (r.json.results as any[]).map(x => [x.studentId, x.displayName, x.lessonId, x.game, x.score, x.total, x.attempts]),
        [
          [w.students.sA1, CHILDREN.sara, L2, "memory", 2, 3, 1],
          [w.students.sA1, CHILDREN.sara, L1, "memory", 9, 10, 6],
          [w.students.sA1, CHILDREN.sara, L1, "spot", 1, 4, 1],
        ],
      );
    });

    it("stops showing a detached game's results to the family and the teacher, and a late play for it is a 404", async () => {
      await db.pool.query(`UPDATE homework SET resources = $2::jsonb WHERE id = $1`, [hwG, att([L1, "memory"])]);
      const mine = (await studentList(w.users.studentA)).homework.find(i => i.id === hwG)!;
      assert.deepEqual(mine.gameResults, [{ lessonId: L1, game: "memory", score: 9, total: 10, attempts: 6 }]);
      const r = await call(on, "GET", `/homework/${hwG}/game-results`, w.users.t1);
      assert.deepEqual((r.json.results as any[]).map(x => `${x.lessonId}:${x.game}`), [`${L1}:memory`]);
      assert.equal((await play(hwG, result("spot", 4, 4))).status, 404);
      assert.equal((await stored(hwG)).length, 3, "the rows themselves are kept");
    });
  });
});
