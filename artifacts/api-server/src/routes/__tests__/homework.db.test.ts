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
  trackableCount: number;
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

/** The Amman calendar day `days` from now — due dates are bounded, so they cannot be literals. */
const ammanDay = (days: number) => new Date(Date.now() + 3 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);
/** A due date comfortably in the future, as a teacher would type it. */
const DUE = ammanDay(30);
const DUE_LATER = ammanDay(60);

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
      assert.equal(hw.dueAt, `${DUE}T20:59:59.999Z`);
      assert.equal(hw.classGroupId, w.classes.c1);
      assert.equal(hw.evaluationId, null);
      assert.equal(hw.examTitle, null);
      assert.equal(hw.doneCount, 0);
      // Sara's t1 row and Adam. The archived roster row aArch sits in c2, not c1.
      assert.equal(hw.studentCount, 2);
      assert.equal(hw.trackableCount, 1, "only Sara has a student account");
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

    it("rejects a due date years away (a typo like 2062) and writes nothing", async () => {
      const count = async () => (await db.pool.query(`SELECT count(*)::int AS n FROM homework`)).rows[0].n as number;
      const before = await count();
      const r = await create(w.users.t1, { classGroupId: w.classes.c1, title: "far", dueDate: "2062-01-01" });
      assert.equal(r.status, 400, r.text);
      assert.deepEqual(r.json, {
        error: "dueDate must be today or later, and within the next year",
        code: "due_date_out_of_range",
      });
      assert.equal(await count(), before, "no row inserted");
      const past = await create(w.users.t1, { classGroupId: w.classes.c1, title: "past", dueDate: ammanDay(-45) });
      assert.equal(past.status, 400);
      assert.equal(past.json.code, "due_date_out_of_range");
    });

    it("rejects yesterday but accepts today, and writes nothing for yesterday", async () => {
      const count = async () => (await db.pool.query(`SELECT count(*)::int AS n FROM homework`)).rows[0].n as number;
      const before = await count();
      const yesterday = await create(w.users.t1, { classGroupId: w.classes.c1, title: "yesterday", dueDate: ammanDay(-1) });
      assert.equal(yesterday.status, 400, yesterday.text);
      assert.equal(yesterday.json.code, "due_date_out_of_range");
      assert.equal(await count(), before, "no row inserted");
      const today = await create(w.users.t1, { classGroupId: w.classes.c1, title: "today", dueDate: ammanDay(0) });
      assert.equal(today.status, 201, today.text);
    });

    it("gives only the range error a machine code", async () => {
      const r = await create(w.users.t1, { classGroupId: w.classes.c1, title: "x", dueDate: "2026-02-30" });
      assert.equal(r.status, 400);
      assert.deepEqual(r.json, { error: "dueDate must be a real date, YYYY-MM-DD" });
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
      assert.equal(r.json.trackableCount, 1, "sA1 has a self link, Adam has none");
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
      assert.ok(rows.every(x => x.studentCount === 2 && x.trackableCount === 1 && typeof x.dueDate === "string"));
    });

    it("counts how many of the class can tick it off: rows with a student account, not the whole roster", async () => {
      // c5 holds only Yazan, who has no student account.
      const none = await list(w.users.t2, w.classes.c5);
      assert.equal(none.status, 200, none.text);
      assert.equal(none.json.studentCount, 1);
      assert.equal(none.json.trackableCount, 0);
      assert.ok((none.json.homework as TeacherHomework[]).every(x => x.studentCount === 1 && x.trackableCount === 0));

      // c3 holds only Noor, whose self link is to student B.
      const all = await list(w.users.t1, w.classes.c3);
      assert.equal(all.json.studentCount, 1);
      assert.equal(all.json.trackableCount, 1);

      // An empty list still reports both numbers.
      const klass = await db.pool.query<{ id: string }>(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, 'empty-list', 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
        [w.users.t1],
      );
      const cid = klass.rows[0]!.id;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2), ($1, $3)`, [cid, w.students.nB1, w.students.aA]);
      const empty = await list(w.users.t1, cid);
      assert.deepEqual(empty.json, { studentCount: 2, trackableCount: 1, homework: [] });
    });

    it("does not count an archived roster row, even one with a student account", async () => {
      // c2 has Sara's live row (sA2, no self link) and Adam's archived row. Give the archived one a self link.
      await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [w.students.aArch, w.users.studentUnlinked]);
      try {
        const r = await list(w.users.t2, w.classes.c2);
        assert.equal(r.json.studentCount, 1);
        assert.equal(r.json.trackableCount, 0);
      } finally {
        await db.pool.query(`DELETE FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [w.students.aArch]);
      }
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
      const r = await call(server, "PATCH", `/homework/${mine}`, w.users.t1, { title: "changed", dueDate: DUE_LATER });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.homework.title, "changed");
      assert.equal(r.json.homework.dueDate, DUE_LATER);
      assert.equal(r.json.homework.dueAt, `${DUE_LATER}T20:59:59.999Z`);
      const after = (await db.pool.query(`SELECT updated_at FROM homework WHERE id = $1`, [mine])).rows[0].updated_at as Date;
      assert.ok(after.getTime() > before.getTime());
    });

    it("lets a homework whose due day has passed be edited when its due date is resent unchanged", async () => {
      // The mobile edit form always resends dueDate, so bounding an unchanged date
      // would make every edit of an old homework a 400.
      const old = ammanDay(-45);
      const inserted = await db.pool.query<{ id: string }>(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at) VALUES ($1, $2, 'old typo', $3) RETURNING id`,
        [w.users.t1, w.classes.c1, `${old}T20:59:59.999Z`],
      );
      const id = inserted.rows[0]!.id;
      const fixed = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { title: "old fixed", dueDate: old });
      assert.equal(fixed.status, 200, fixed.text);
      assert.equal(fixed.json.homework.title, "old fixed");
      assert.equal(fixed.json.homework.dueDate, old);

      // A CHANGED date outside the window is still refused, with the code, and nothing is written.
      const moved = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { title: "moved", dueDate: ammanDay(-46) });
      assert.equal(moved.status, 400, moved.text);
      assert.deepEqual(moved.json, {
        error: "dueDate must be today or later, and within the next year",
        code: "due_date_out_of_range",
      });
      assert.equal((await rowOf(id))?.title, "old fixed");
      const far = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { dueDate: "2062-01-01" });
      assert.equal(far.status, 400);
      assert.equal(far.json.code, "due_date_out_of_range");

      // Moving it back into the window works.
      const back = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { dueDate: DUE });
      assert.equal(back.status, 200, back.text);
    });

    it("treats the date as unchanged by calendar day, whatever time of day the stored due_at has (SQL/import rows)", async () => {
      const old = ammanDay(-45);
      const inserted = await db.pool.query<{ id: string }>(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at) VALUES ($1, $2, 'imported', $3) RETURNING id`,
        [w.users.t1, w.classes.c1, `${old}T09:00:00Z`], // 12:00 Amman, not the end of the day
      );
      const id = inserted.rows[0]!.id;
      const r = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { title: "imported fixed", dueDate: old });
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.homework.title, "imported fixed");
      assert.equal(r.json.homework.dueDate, old);
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

    it("lets an edit through when the linked exam has since been archived, but not a switch to one", async () => {
      const made = await create(w.users.t1, { classGroupId: w.classes.c1, title: "linked", dueDate: DUE, evaluationId: h.exams.examPublished });
      assert.equal(made.status, 201, made.text);
      const id = made.json.homework.id as string;
      await db.pool.query(`UPDATE evaluations SET archived_at = now() WHERE id = $1`, [h.exams.examPublished]);
      try {
        // A title typo while the exam is archived: the unchanged link is not re-checked.
        const same = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { title: "x", evaluationId: h.exams.examPublished });
        assert.equal(same.status, 200, same.text);
        assert.equal(same.json.homework.title, "x");
        assert.equal(same.json.homework.evaluationId, h.exams.examPublished);
        assert.equal((await rowOf(id))?.evaluation_id, h.exams.examPublished, "the link is unchanged");

        // …but pointing it at a DIFFERENT archived exam, or one in another class, is still refused.
        await db.pool.query(`UPDATE evaluations SET archived_at = now() WHERE id = $1`, [h.exams.examDraft]);
        for (const evaluationId of [h.exams.examDraft, h.exams.examOtherClass]) {
          const r = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { evaluationId });
          assert.equal(r.status, 400, r.text);
          assert.deepEqual(r.json, { error: "That exam is not attached to this class" });
        }
        assert.equal((await rowOf(id))?.evaluation_id, h.exams.examPublished, "still the original link");

        // Detaching needs no check at all.
        const detach = await call(server, "PATCH", `/homework/${id}`, w.users.t1, { evaluationId: null });
        assert.equal(detach.status, 200, detach.text);
        assert.equal(detach.json.homework.evaluationId, null);
      } finally {
        await db.pool.query(`UPDATE evaluations SET archived_at = NULL WHERE id IN ($1, $2)`, [h.exams.examPublished, h.exams.examDraft]);
      }
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

  describe("lesson games as attachments", () => {
    // A real lesson id (the same one other suites resolve through getLessonById).
    const LESSON = "kbl-math-s2-nccd-u5_l4";
    const LESSON2 = "kbl-hist-s1-nccd-u1_l1";
    const game = (extra: Record<string, unknown> = {}) => ({ kind: "game", lessonId: LESSON, game: "memory", title: "  لعبة الذاكرة  ", ...extra });
    const post = (resources: unknown[], userId = w.users.t1) =>
      create(userId, { classGroupId: w.classes.c1, title: "games", dueDate: DUE, resources });
    const stored = async (id: string) =>
      (await db.pool.query(`SELECT resources FROM homework WHERE id = $1`, [id])).rows[0].resources as any[];

    it("stores a game with the title snapshot trimmed, and falls back to the lesson's own title", async () => {
      const r = await post([game(), game({ game: "spot", title: "   " }), game({ game: "scramble", title: "x".repeat(300) })]);
      assert.equal(r.status, 201, server.logs().slice(-1500));
      const res = r.json.homework.resources as any[];
      assert.deepEqual(res[0], { kind: "game", lessonId: LESSON, game: "memory", title: "لعبة الذاكرة" });
      assert.equal(res[1].game, "spot");
      assert.ok(res[1].title.length > 0 && res[1].title.trim() === res[1].title, "falls back to the lesson title");
      assert.equal(res[2].title.length, 200, "capped at 200");
      assert.deepEqual(await stored(r.json.homework.id), res);
    });

    it("drops a repeat of the same lesson game, but keeps the same lesson's other games", async () => {
      const r = await post([game(), game({ title: "again" }), game({ game: "spot" })]);
      assert.equal(r.status, 201);
      assert.deepEqual((r.json.homework.resources as any[]).map(x => x.game), ["memory", "spot"]);
    });

    it("rejects a lesson that is not in the curriculum, a bad game, and a missing lessonId with 400, writing nothing", async () => {
      const before = (await db.pool.query(`SELECT count(*)::int AS n FROM homework`)).rows[0].n;
      for (const bad of [
        game({ lessonId: "no-such-lesson" }),
        game({ lessonId: "" }),
        game({ lessonId: 5 }),
        game({ lessonId: undefined }),
        game({ game: "chess" }),
        game({ game: undefined }),
      ]) {
        const r = await post([bad]);
        assert.equal(r.status, 400, JSON.stringify(bad));
      }
      assert.equal((await db.pool.query(`SELECT count(*)::int AS n FROM homework`)).rows[0].n, before);
    });

    it("keeps an attached game through a PATCH that resends the list, and can add one", async () => {
      const made = (await post([game()])).json.homework.id as string;
      const p = await call(server, "PATCH", `/homework/${made}`, w.users.t1, { resources: [game(), game({ game: "scramble" })] });
      assert.equal(p.status, 200, server.logs().slice(-1500));
      assert.deepEqual((p.json.homework.resources as any[]).map(x => x.game), ["memory", "scramble"]);
      const bad = await call(server, "PATCH", `/homework/${made}`, w.users.t1, { resources: [game({ lessonId: "nope" })] });
      assert.equal(bad.status, 400);
    });

    describe("an older app editing the list", () => {
      const patch = (id: string, body: Record<string, unknown>) => call(server, "PATCH", `/homework/${id}`, w.users.t1, body);
      const keys = (r: any) => (r.json.homework.resources as any[]).map(x => `${x.lessonId}:${x.game}`);

      it("keeps the games it left out when `gamesIncluded` is absent or not exactly true", async () => {
        for (const flag of [{}, { gamesIncluded: false }, { gamesIncluded: "true" }]) {
          const id = (await post([game(), game({ lessonId: LESSON2, game: "spot" })])).json.homework.id as string;
          const r = await patch(id, { resources: [], ...flag });
          assert.equal(r.status, 200, server.logs().slice(-1500));
          assert.deepEqual(keys(r), [`${LESSON}:memory`, `${LESSON2}:spot`], JSON.stringify(flag));
          assert.deepEqual((await stored(id)).map((x: any) => x.game), ["memory", "spot"]);
        }
      });

      it("puts the body's own items first, and does not duplicate a game the body resent", async () => {
        const id = (await post([game(), game({ game: "spot" })])).json.homework.id as string;
        const r = await patch(id, { resources: [game({ game: "spot" })] });
        assert.deepEqual(keys(r), [`${LESSON}:spot`, `${LESSON}:memory`]);
      });

      it("treats the list as authoritative with `gamesIncluded: true`: no game in it removes the game", async () => {
        const id = (await post([game(), game({ game: "spot" })])).json.homework.id as string;
        const r = await patch(id, { resources: [game({ game: "spot" })], gamesIncluded: true });
        assert.deepEqual(keys(r), [`${LESSON}:spot`]);
        const none = await patch(id, { resources: [], gamesIncluded: true });
        assert.deepEqual(none.json.homework.resources, []);
        assert.deepEqual(await stored(id), []);
      });

      it("leaves the list alone when the body has no `resources` at all", async () => {
        const id = (await post([game()])).json.homework.id as string;
        const r = await patch(id, { title: "renamed" });
        assert.equal(r.status, 200);
        assert.deepEqual(keys(r), [`${LESSON}:memory`]);
      });
    });

    describe("results", () => {
      let hwId: string;
      const results = (userId: string | undefined, id: string) => call(server, "GET", `/homework/${id}/game-results`, userId);
      const insert = (studentId: string, g: string, score: number, total: number, attempts = 1, lessonId = LESSON) =>
        db.pool.query(
          `INSERT INTO game_results (homework_id, student_id, lesson_id, game, score, total, attempts) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [hwId, studentId, lessonId, g, score, total, attempts],
        );
      before(async () => {
        hwId = (await post([game(), game({ game: "spot" }), game({ lessonId: LESSON2 })])).json.homework.id as string;
      });

      it("is an empty list while nobody has played", async () => {
        const r = await results(w.users.t1, hwId);
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.json, { results: [] });
      });

      it("lists each child's results with their name, by name then game, and drops a child who is not a live member", async () => {
        await insert(w.students.sA1, "spot", 2, 4, 3);
        await insert(w.students.sA1, "memory", 5, 6);
        await insert(w.students.aA, "memory", 1, 6);
        // Noor is in another class (c3): a stray row must not surface here.
        await insert(w.students.nB1, "memory", 6, 6);
        // The same game for a second lesson is its own row.
        await insert(w.students.sA1, "memory", 3, 3, 2, LESSON2);
        const r = await results(w.users.t1, hwId);
        assert.equal(r.status, 200, r.text);
        const list = r.json.results as any[];
        assert.deepEqual(
          list.map(x => [x.studentId, x.lessonId, x.game, x.score, x.total, x.attempts]),
          [
            [w.students.aA, LESSON, "memory", 1, 6, 1],
            [w.students.sA1, LESSON2, "memory", 3, 3, 2],
            [w.students.sA1, LESSON, "memory", 5, 6, 1],
            [w.students.sA1, LESSON, "spot", 2, 4, 3],
          ],
          "ordered by displayName (آدم before سارة), then game, then lesson id (hist before math)",
        );
        assert.deepEqual(Object.keys(list[0]).sort(), ["attempts", "displayName", "game", "lessonId", "playedAt", "score", "studentId", "total"]);
        assert.equal(list[0].displayName, "آدم");
        assert.ok(!Number.isNaN(Date.parse(list[0].playedAt)));
      });

      it("does not return a detached game's results, and returns them again if it is re-attached (rows are kept)", async () => {
        const patch = (resources: unknown[]) =>
          call(server, "PATCH", `/homework/${hwId}`, w.users.t1, { resources, gamesIncluded: true });
        const pairs = async () => ((await results(w.users.t1, hwId)).json.results as any[]).map(x => `${x.lessonId}:${x.game}`);
        // Detach lesson 2's memory and lesson 1's spot.
        assert.equal((await patch([game()])).status, 200);
        assert.deepEqual([...new Set(await pairs())], [`${LESSON}:memory`]);
        assert.equal((await db.pool.query(`SELECT count(*)::int AS n FROM game_results WHERE homework_id = $1`, [hwId])).rows[0].n, 5);
        // A different lesson's memory result does not stand in for an attached one.
        assert.equal((await patch([game({ lessonId: LESSON2 })])).status, 200);
        assert.deepEqual(await pairs(), [`${LESSON2}:memory`]);
        // Re-attach everything.
        assert.equal((await patch([game(), game({ game: "spot" }), game({ lessonId: LESSON2 })])).status, 200);
        assert.equal((await pairs()).length, 4);
      });

      it("answers 404 for another teacher, a missing id, a malformed id and archived homework; 401/403 for no token and a family", async () => {
        assert.equal((await results(w.users.t2, hwId)).status, 404);
        assert.equal((await results(w.users.t1, RANDOM_UUID)).status, 404);
        assert.equal((await results(w.users.t1, "not-a-uuid")).status, 404);
        assert.equal((await results(w.users.t1, h.hw.hwArchived)).status, 404);
        assert.equal((await results(undefined, hwId)).status, 401);
        assert.equal((await results(w.users.parentA, hwId)).status, 403);
        assert.equal((await results(w.users.studentA, hwId)).status, 403);
      });
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
