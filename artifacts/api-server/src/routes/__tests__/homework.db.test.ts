/**
 * What this guards: a teacher sets homework for a class and sees how many of
 * its children ticked it off. The ways that goes wrong are all about WHOSE
 * class and WHICH children — setting homework on another teacher's class,
 * pointing it at another class's exam, patching a row you do not own (or
 * moving it to a class you do), and counting children who left the class or
 * were archived. Every case runs against real rows in a real database.
 *
 * One database and one server for the file. The case that deletes a
 * membership mutates shared state, so it is last.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EXAM_TITLES, HW_TITLES, seedHomework, type HomeworkWorld } from "../../test-support/seedHomework.ts";

interface TeacherHomework {
  id: string;
  classGroupId: string;
  title: string;
  instructions: string;
  dueDate: string;
  dueAt: string;
  evaluationId: string | null;
  examTitle: string | null;
  doneCount: number;
  studentCount: number;
}

const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

async function call(server: TestServer, method: string, path: string, userId?: string, body?: unknown) {
  const headers: Record<string, string> = {};
  if (userId) headers["Authorization"] = `Bearer ${accessToken(userId)}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const res = await fetch(`${server.base}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, text, json: (text ? JSON.parse(text) : null) as any };
}

/** A due date comfortably in the future, as a teacher would type it. */
const DUE = "2030-05-14";

describeDb("teacher homework over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let w: FamilyWorld;
  let h: HomeworkWorld;

  const create = (userId: string | undefined, body: Record<string, unknown>) =>
    call(server, "POST", "/homework", userId, body);
  const list = (userId: string | undefined, classId: string) =>
    call(server, "GET", `/classes/${classId}/homework`, userId);
  const rowOf = async (id: string) =>
    (await db.pool.query(`SELECT * FROM homework WHERE id = $1`, [id])).rows[0] as
      | { class_group_id: string; teacher_id: string; title: string; archived_at: Date | null; evaluation_id: string | null }
      | undefined;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    h = await seedHomework(db.pool, w);
    server = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    const endpoints = (): Array<[string, string, unknown]> => [
      ["POST", "/homework", { classGroupId: w.classes.c1, title: "x", dueDate: DUE }],
      ["GET", `/classes/${w.classes.c1}/homework`, undefined],
      ["PATCH", `/homework/${h.hw.hwC1}`, { title: "x" }],
      ["DELETE", `/homework/${h.hw.hwC1}`, undefined],
    ];

    it("refuses no token on all four endpoints", async () => {
      for (const [method, path, body] of endpoints()) {
        assert.equal((await call(server, method, path, undefined, body)).status, 401, `${method} ${path}`);
      }
    });

    it("refuses a parent and a student on all four endpoints", async () => {
      for (const [who, userId] of [
        ["parent", w.users.parentA],
        ["student", w.users.studentA],
      ] as const) {
        for (const [method, path, body] of endpoints()) {
          assert.equal((await call(server, method, path, userId, body)).status, 403, `${method} ${path} as a ${who}`);
        }
      }
    });
  });

  describe("creating", () => {
    it("creates homework for your own class, due at the end of the Amman day", async () => {
      const r = await create(w.users.t1, { classGroupId: w.classes.c1, title: "  Page 12  ", instructions: "Do 1-5", dueDate: DUE });
      assert.equal(r.status, 201, server.logs().slice(-1500));
      const hw = r.json.homework as TeacherHomework;
      assert.equal(hw.title, "Page 12");
      assert.equal(hw.instructions, "Do 1-5");
      assert.equal(hw.dueDate, DUE);
      assert.equal(hw.dueAt, "2030-05-14T20:59:59.999Z");
      assert.equal(hw.classGroupId, w.classes.c1);
      assert.equal(hw.evaluationId, null);
      assert.equal(hw.examTitle, null);
      assert.equal(hw.doneCount, 0);
      // Sara's t1 row and Adam. The archived roster row aArch sits in c2, not c1.
      assert.equal(hw.studentCount, 2);
      const row = await rowOf(hw.id);
      assert.equal(row?.teacher_id, w.users.t1);
    });

    it("answers 404 identically whether the class is another teacher's, missing, or archived", async () => {
      const body = { title: "x", dueDate: DUE };
      const others = await create(w.users.t2, { ...body, classGroupId: w.classes.c1 });
      const missing = await create(w.users.t1, { ...body, classGroupId: RANDOM_UUID });
      const archived = await create(w.users.t1, { ...body, classGroupId: w.classes.c4 });
      for (const r of [others, missing, archived]) assert.equal(r.status, 404);
      assert.deepEqual(others.json, { error: "Class not found" });
      assert.equal(others.text, missing.text);
      assert.equal(others.text, archived.text);
      // …and nothing was written for the other teacher's class.
      const n = await db.pool.query(`SELECT count(*)::int AS n FROM homework WHERE teacher_id = $1 AND class_group_id = $2`, [
        w.users.t2,
        w.classes.c1,
      ]);
      assert.equal(n.rows[0].n, 0);
    });

    it("rejects invalid input with 400, never 500", async () => {
      const ok = { classGroupId: w.classes.c1, title: "ok", dueDate: DUE };
      const cases: Array<[string, Record<string, unknown>]> = [
        ["blank title", { ...ok, title: "   " }],
        ["impossible date", { ...ok, dueDate: "2026-02-30" }],
        ["malformed class id", { ...ok, classGroupId: "nope" }],
      ];
      for (const [name, body] of cases) {
        const r = await create(w.users.t1, body);
        assert.equal(r.status, 400, `${name}: ${r.text}`);
        assert.equal(typeof r.json.error, "string", name);
      }
    });

    it("accepts only an exam that is yours, live, and attached to THIS class", async () => {
      const base = { classGroupId: w.classes.c1, title: "with exam", dueDate: DUE };
      const wrongClass = await create(w.users.t1, { ...base, evaluationId: h.exams.examOtherClass });
      const wrongTeacher = await create(w.users.t1, { ...base, evaluationId: h.exams.examOtherTeacher });
      const missing = await create(w.users.t1, { ...base, evaluationId: RANDOM_UUID });
      assert.equal(wrongClass.status, 400);
      assert.equal(wrongTeacher.status, 400);
      assert.equal(missing.status, 400);
      assert.deepEqual(wrongClass.json, { error: "That exam is not attached to this class" });
      assert.equal(wrongClass.text, wrongTeacher.text);
      assert.equal(wrongClass.text, missing.text);

      const ok = await create(w.users.t1, { ...base, evaluationId: h.exams.examPublished });
      assert.equal(ok.status, 201, ok.text);
      assert.equal(ok.json.homework.evaluationId, h.exams.examPublished);
      assert.equal(ok.json.homework.examTitle, EXAM_TITLES.examPublished);
    });

    it("rejects an archived exam", async () => {
      await db.pool.query(`UPDATE evaluations SET archived_at = now() WHERE id = $1`, [h.exams.examDraft]);
      try {
        const r = await create(w.users.t1, { classGroupId: w.classes.c1, title: "t", dueDate: DUE, evaluationId: h.exams.examDraft });
        assert.equal(r.status, 400);
      } finally {
        await db.pool.query(`UPDATE evaluations SET archived_at = NULL WHERE id = $1`, [h.exams.examDraft]);
      }
    });

    it("does not need roster consent: the seeded teachers never attested", async () => {
      const consent = await db.pool.query(`SELECT roster_consent_at FROM users WHERE id = $1`, [w.users.t1]);
      assert.equal(consent.rows[0].roster_consent_at, null, "the fixture must not carry consent");
      const r = await create(w.users.t1, { classGroupId: w.classes.c3, title: "no consent needed", dueDate: DUE });
      assert.equal(r.status, 201, r.text);
    });
  });

  describe("listing a class", () => {
    it("lists a class's live homework newest due first, with counts", async () => {
      const r = await list(w.users.t1, w.classes.c1);
      assert.equal(r.status, 200, server.logs().slice(-1500));
      assert.equal(r.json.studentCount, 2);
      const rows = r.json.homework as TeacherHomework[];
      const titles = rows.map(x => x.title);
      for (const t of [HW_TITLES.hwC1, HW_TITLES.hwC1Exam, HW_TITLES.hwC1Draft, HW_TITLES.hwOld, HW_TITLES.hwRecentOverdue]) {
        assert.ok(titles.includes(t), `${t} is listed`);
      }
      assert.ok(!titles.includes(HW_TITLES.hwArchived), "an archived item is not listed");
      for (const t of [HW_TITLES.hwC3, HW_TITLES.hwC2, HW_TITLES.hwC4]) assert.ok(!titles.includes(t), `${t} is another class's`);
      const due = rows.map(x => Date.parse(x.dueAt));
      assert.deepEqual(due, [...due].sort((a, b) => b - a), "newest due first");
      assert.ok(rows.every(x => x.classGroupId === w.classes.c1));
      const withExam = rows.find(x => x.title === HW_TITLES.hwC1Exam);
      assert.equal(withExam?.examTitle, EXAM_TITLES.examPublished);
      assert.ok(rows.every(x => x.studentCount === 2 && typeof x.dueDate === "string"));
    });

    it("answers 404 for another teacher's class, a missing one, an archived one and a malformed id", async () => {
      const others = await list(w.users.t2, w.classes.c1);
      const missing = await list(w.users.t1, RANDOM_UUID);
      const archived = await list(w.users.t1, w.classes.c4);
      const malformed = await list(w.users.t1, "nope");
      for (const r of [others, missing, archived, malformed]) assert.equal(r.status, 404);
      assert.equal(others.text, missing.text);
      assert.equal(others.text, archived.text);
      assert.equal(others.text, malformed.text);
      assert.ok(!others.text.includes(HW_TITLES.hwC1), "no title leaks to the wrong teacher");
    });
  });

  describe("changing", () => {
    let mine: string;
    before(async () => {
      const r = await create(w.users.t1, { classGroupId: w.classes.c1, title: "to change", dueDate: DUE });
      assert.equal(r.status, 201, r.text);
      mine = r.json.homework.id;
    });

    it("changes title and due date, and moves updated_at", async () => {
      const before = (await db.pool.query(`SELECT updated_at FROM homework WHERE id = $1`, [mine])).rows[0].updated_at as Date;
      const r = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { title: "changed", dueDate: "2030-06-01" });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.homework.title, "changed");
      assert.equal(r.json.homework.dueDate, "2030-06-01");
      assert.equal(r.json.homework.dueAt, "2030-06-01T20:59:59.999Z");
      const after = (await db.pool.query(`SELECT updated_at FROM homework WHERE id = $1`, [mine])).rows[0].updated_at as Date;
      assert.ok(after.getTime() > before.getTime());
    });

    it("answers 404 to another teacher and leaves the row untouched", async () => {
      const r = await call(server, "PATCH", `/homework/${mine}`, w.users.t2, { title: "hijacked" });
      assert.equal(r.status, 404);
      assert.deepEqual(r.json, { error: "Homework not found" });
      assert.equal((await rowOf(mine))?.title, "changed");
      const missing = await call(server, "PATCH", `/homework/${RANDOM_UUID}`, w.users.t1, { title: "x" });
      assert.equal(missing.status, 404);
      assert.equal(missing.text, r.text);
      const malformed = await call(server, "PATCH", `/homework/nope`, w.users.t1, { title: "x" });
      assert.equal(malformed.status, 404);
    });

    it("never moves homework to another class or teacher", async () => {
      const alone = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { classGroupId: w.classes.c3 });
      assert.equal(alone.status, 400);
      assert.deepEqual(alone.json, { error: "Nothing to change" });
      // Alongside a real change the extra fields are ignored, not applied.
      const mixed = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, {
        title: "still here",
        classGroupId: w.classes.c3,
        teacherId: w.users.t2,
      });
      assert.equal(mixed.status, 200);
      const row = await rowOf(mine);
      assert.equal(row?.class_group_id, w.classes.c1);
      assert.equal(row?.teacher_id, w.users.t1);
      assert.equal(row?.title, "still here");
    });

    it("attaches, rejects the wrong exam, and detaches with null", async () => {
      const bad = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { evaluationId: h.exams.examOtherClass });
      assert.equal(bad.status, 400);
      assert.deepEqual(bad.json, { error: "That exam is not attached to this class" });
      const other = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { evaluationId: h.exams.examOtherTeacher });
      assert.equal(other.status, 400);
      assert.equal((await rowOf(mine))?.evaluation_id, null);

      const attach = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { evaluationId: h.exams.examPublished });
      assert.equal(attach.status, 200, attach.text);
      assert.equal(attach.json.homework.examTitle, EXAM_TITLES.examPublished);

      const detach = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { evaluationId: null });
      assert.equal(detach.status, 200);
      assert.equal(detach.json.homework.evaluationId, null);
      assert.equal(detach.json.homework.examTitle, null);
      assert.equal((await rowOf(mine))?.evaluation_id, null);
    });

    it("answers 404 for homework in an archived class, and for archived homework", async () => {
      const inArchivedClass = await call(server, "PATCH", `/homework/${h.hw.hwC4}`, w.users.t1, { title: "x" });
      assert.equal(inArchivedClass.status, 404);
      const archived = await call(server, "PATCH", `/homework/${h.hw.hwArchived}`, w.users.t1, { title: "x" });
      assert.equal(archived.status, 404);
      assert.equal((await rowOf(h.hw.hwC4))?.title, HW_TITLES.hwC4);
      const del = await call(server, "DELETE", `/homework/${h.hw.hwC4}`, w.users.t1);
      assert.equal(del.status, 404);
    });
  });

  describe("deleting", () => {
    it("is refused for another teacher, and for the owner archives rather than deletes", async () => {
      const made = await create(w.users.t1, { classGroupId: w.classes.c1, title: "to delete", dueDate: DUE });
      const id = made.json.homework.id as string;
      await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [id, w.students.sA1]);

      const others = await call(server, "DELETE", `/homework/${id}`, w.users.t2);
      assert.equal(others.status, 404);
      assert.equal((await rowOf(id))?.archived_at, null, "untouched");

      const mine = await call(server, "DELETE", `/homework/${id}`, w.users.t1);
      assert.equal(mine.status, 200, mine.text);
      assert.deepEqual(mine.json, { archived: id });

      const listed = (await list(w.users.t1, w.classes.c1)).json.homework as TeacherHomework[];
      assert.ok(!listed.some(x => x.id === id), "gone from the class list");
      const row = await rowOf(id);
      assert.ok(row, "the row still exists");
      assert.ok(row.archived_at, "…with archived_at set");
      const kept = await db.pool.query(`SELECT count(*)::int AS n FROM homework_completions WHERE homework_id = $1`, [id]);
      assert.equal(kept.rows[0].n, 1, "completions survive");

      const again = await call(server, "DELETE", `/homework/${id}`, w.users.t1);
      assert.equal(again.status, 404, "already archived");
    });
  });

  // Last: the second test deletes a class membership, which every earlier
  // expectation about studentCount would otherwise have to account for.
  describe("counts", () => {
    const find = async (userId: string, classId: string, id: string) => {
      const r = await list(userId, classId);
      assert.equal(r.status, 200, r.text);
      return { studentCount: r.json.studentCount as number, hw: (r.json.homework as TeacherHomework[]).find(x => x.id === id)! };
    };

    it("counts completions by live roster rows in the class — not archived rows", async () => {
      await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [h.hw.hwC1, w.students.sA1]);
      const c1 = await find(w.users.t1, w.classes.c1, h.hw.hwC1);
      assert.equal(c1.hw.doneCount, 1);
      assert.equal(c1.hw.studentCount, 2);

      // c2: Sara's row is live, Adam's row there is archived. Only the live one counts, in both numbers.
      await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2), ($1, $3)`, [
        h.hw.hwC2,
        w.students.sA2,
        w.students.aArch,
      ]);
      const c2 = await find(w.users.t2, w.classes.c2, h.hw.hwC2);
      assert.equal(c2.studentCount, 1);
      assert.equal(c2.hw.studentCount, 1);
      assert.equal(c2.hw.doneCount, 1);
    });

    it("does not count a completion by a child who has since left the class", async () => {
      await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [h.hw.hwC1, w.students.aA]);
      assert.equal((await find(w.users.t1, w.classes.c1, h.hw.hwC1)).hw.doneCount, 2);

      // Adam leaves c1 (he is still in the archived c4).
      await db.pool.query(`DELETE FROM class_memberships WHERE class_group_id = $1 AND student_id = $2`, [
        w.classes.c1,
        w.students.aA,
      ]);
      const after = await find(w.users.t1, w.classes.c1, h.hw.hwC1);
      assert.equal(after.studentCount, 1);
      assert.equal(after.hw.studentCount, 1);
      assert.equal(after.hw.doneCount, 1, "his completion remains in the table but is not counted");
      const kept = await db.pool.query(`SELECT count(*)::int AS n FROM homework_completions WHERE homework_id = $1`, [h.hw.hwC1]);
      assert.equal(kept.rows[0].n, 2);
    });
  });
});
