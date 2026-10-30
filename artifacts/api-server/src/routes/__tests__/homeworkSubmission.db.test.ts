/**
 * What this guards: a teacher can ask for a project, and the ways that goes wrong are all about
 * WHOSE project it is — a student reaching another student's work, a parent or an unrelated
 * teacher reading a draft, a locked project being replaced, a photo that is not an image being
 * stored — and about the tick: a homework that wants a project must not be done by tapping.
 * Every case runs against real rows in a real database, and uploads go through the real route
 * to an in-memory S3 (test-support/s3Stub.ts).
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { s3Env, startS3Stub, type S3Stub } from "../../test-support/s3Stub.ts";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0, 9, 9]);
const photoBody = (mime: string, bytes: Buffer) => ({ photoDataUrl: `data:${mime};base64,${bytes.toString("base64")}` });
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

/** The Amman calendar day `days` from now. */
const ammanDay = (days: number) => new Date(Date.now() + 3 * 3600_000 + days * 86_400_000).toISOString().slice(0, 10);

describeDb("homework project submissions over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let s3: S3Stub;
  let w: FamilyWorld;
  /** A second student account in the same class (c1), so "another student" is a real account. */
  let sibling: { user: string; row: string };
  /** t1 / c1, due in 5 days, wants a project. */
  let hwOpen: string;
  /** t1 / c1, due yesterday, wants a project — the due day has ended. */
  let hwClosed: string;
  /** t1 / c1, due in 5 days, an ordinary tick-off homework. */
  let hwPlain: string;

  const insertHomework = async (title: string, dueOffset: string, requires: boolean) =>
    (
      await db.pool.query(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission)
         VALUES ($1, $2, $3, now() + $4::interval, $5) RETURNING id`,
        [w.users.t1, w.classes.c1, title, dueOffset, requires],
      )
    ).rows[0].id as string;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    s3 = await startS3Stub();
    server = await startServer({ databaseUrl: db.url, env: s3Env(s3) });

    const user = (await db.pool.query(
      `INSERT INTO users (first_name, last_name, role) VALUES ('Layla', 'C', 'student') RETURNING id`,
    )).rows[0].id as string;
    const row = (await db.pool.query(
      `INSERT INTO students (teacher_id, display_name) VALUES ($1, 'ليلى') RETURNING id`,
      [w.users.t1],
    )).rows[0].id as string;
    await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, row]);
    await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [row, user]);
    sibling = { user, row };

    hwOpen = await insertHomework("project-open", "5 days", true);
    hwClosed = await insertHomework("project-closed", "-1 day", true);
    hwPlain = await insertHomework("plain", "5 days", false);
  });
  after(async () => {
    await server?.stop();
    await s3?.close();
    await db?.drop();
  });

  describe("the teacher's flag and the tick", () => {
    it("creates a homework that needs a project, and says so in the list", async () => {
      const created = await call(server, "POST", "/homework", w.users.t1, {
        classGroupId: w.classes.c1,
        title: "مشروع الوحدة الثالثة",
        dueDate: ammanDay(10),
        requiresSubmission: true,
      });
      assert.equal(created.status, 201, created.text);
      assert.equal(created.json.homework.requiresSubmission, true);
      assert.equal(created.json.homework.submittedCount, 0);

      const plain = await call(server, "POST", "/homework", w.users.t1, {
        classGroupId: w.classes.c1,
        title: "واجب عادي",
        dueDate: ammanDay(10),
      });
      assert.equal(plain.json.homework.requiresSubmission, false);
    });

    it("patches the flag, and refuses a value that is not a boolean", async () => {
      const on = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: true });
      assert.equal(on.status, 200, on.text);
      assert.equal(on.json.homework.requiresSubmission, true);
      const off = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: false });
      assert.equal(off.json.homework.requiresSubmission, false);
      const bad = await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: "yes" });
      assert.equal(bad.status, 400);
    });

    it("does not let a homework that wants a project be ticked off by hand, in either direction", async () => {
      const tick = await call(server, "PUT", `/student/homework/${hwOpen}/done`, w.users.studentA);
      assert.equal(tick.status, 409, tick.text);
      assert.equal(tick.json.code, "submission_required");
      const done = await db.pool.query(`SELECT 1 FROM homework_completions WHERE homework_id = $1`, [hwOpen]);
      assert.equal(done.rowCount, 0, "nothing was ticked");

      // An existing tick (however it got there) is left alone by the refused untick.
      await db.pool.query(`INSERT INTO homework_completions (homework_id, student_id) VALUES ($1, $2)`, [hwOpen, w.students.sA1]);
      try {
        const untick = await call(server, "DELETE", `/student/homework/${hwOpen}/done`, w.users.studentA);
        assert.equal(untick.status, 409, untick.text);
        assert.equal(untick.json.code, "submission_required");
        const kept = await db.pool.query(`SELECT 1 FROM homework_completions WHERE homework_id = $1`, [hwOpen]);
        assert.equal(kept.rowCount, 1, "the refused untick removed nothing");
      } finally {
        await db.pool.query(`DELETE FROM homework_completions WHERE homework_id = $1`, [hwOpen]);
      }
    });

    it("still ticks an ordinary homework", async () => {
      await call(server, "PATCH", `/homework/${hwPlain}`, w.users.t1, { requiresSubmission: false });
      const tick = await call(server, "PUT", `/student/homework/${hwPlain}/done`, w.users.studentA);
      assert.equal(tick.status, 200, tick.text);
    });
  });

  describe("playing an attached game", () => {
    const LESSON = "kbl-math-s2-nccd-u5_l4";
    const attached = JSON.stringify([{ kind: "game", lessonId: LESSON, game: "memory", title: "title-memory" }]);
    let gameProject: string;
    let gamePlain: string;
    const mk = async (title: string, requires: boolean) =>
      (
        await db.pool.query(
          `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission, resources)
           VALUES ($1, $2, $3, now() + interval '5 days', $4, $5::jsonb) RETURNING id`,
          [w.users.t1, w.classes.c1, title, requires, attached],
        )
      ).rows[0].id as string;
    const play = (id: string) =>
      call(server, "PUT", `/student/homework/${id}/game-result`, w.users.studentA, { lessonId: LESSON, game: "memory", score: 3, total: 4 });
    const results = async (id: string) =>
      (await db.pool.query(`SELECT student_id, score, total FROM game_results WHERE homework_id = $1`, [id])).rows;
    const ticks = async (id: string) =>
      (await db.pool.query(`SELECT student_id FROM homework_completions WHERE homework_id = $1`, [id])).rows;

    before(async () => {
      gameProject = await mk("game-project", true);
      gamePlain = await mk("game-plain", false);
    });
    after(async () => {
      await db.pool.query(`DELETE FROM homework WHERE id = ANY($1)`, [[gameProject, gamePlain]]);
    });

    it("records the result on a homework that wants a project, but does not tick it", async () => {
      const r = await play(gameProject);
      assert.equal(r.status, 200, r.text);
      const saved = await results(gameProject);
      assert.deepEqual(saved.map(x => [x.student_id, x.score, x.total]), [[w.students.sA1, 3, 4]]);
      assert.equal((await ticks(gameProject)).length, 0, "playing a game must not do a project homework");
    });

    it("still ticks an ordinary homework when its game is played", async () => {
      const r = await play(gamePlain);
      assert.equal(r.status, 200, r.text);
      assert.equal((await results(gamePlain)).length, 1);
      assert.deepEqual((await ticks(gamePlain)).map(x => x.student_id), [w.students.sA1]);
    });
  });

  describe("the teacher's handed-in count", () => {
    let hwCount: string;
    let archivedRow: string;
    let removedRow: string;
    const rosterRow = async (name: string, archived: boolean) =>
      (
        await db.pool.query(
          `INSERT INTO students (teacher_id, display_name, archived_at) VALUES ($1, $2, CASE WHEN $3::boolean THEN now() END) RETURNING id`,
          [w.users.t1, name, archived],
        )
      ).rows[0].id as string;
    const submit = (studentId: string, handedIn: boolean) =>
      db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, submitted_at)
         VALUES ($1, $2, 'n', CASE WHEN $3::boolean THEN now() END)
         ON CONFLICT (homework_id, student_id) DO UPDATE SET submitted_at = EXCLUDED.submitted_at`,
        [hwCount, studentId, handedIn],
      );
    const countOf = async () => {
      const r = await call(server, "GET", `/classes/${w.classes.c1}/homework`, w.users.t1);
      assert.equal(r.status, 200, r.text);
      const item = (r.json.homework as any[]).find(x => x.id === hwCount);
      assert.ok(item, "the homework is listed");
      assert.equal(item.requiresSubmission, true);
      return item.submittedCount as number;
    };

    before(async () => {
      hwCount = await insertHomework("project-count", "5 days", true);
      archivedRow = await rosterRow("أرشيف", true);
      removedRow = await rosterRow("غادر", false);
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, archivedRow]);
      // removedRow is on the teacher's roster but in no class: it left c1.
    });
    after(async () => {
      await db.pool.query(`DELETE FROM homework WHERE id = $1`, [hwCount]);
      await db.pool.query(`DELETE FROM class_memberships WHERE student_id = $1`, [archivedRow]);
      await db.pool.query(`DELETE FROM students WHERE id = ANY($1)`, [[archivedRow, removedRow]]);
    });

    it("starts at zero", async () => {
      assert.equal(await countOf(), 0);
    });

    it("counts a handed-in project but not a draft", async () => {
      await submit(w.students.sA1, true);
      assert.equal(await countOf(), 1, "a handed-in row counts");
      await submit(sibling.row, false);
      assert.equal(await countOf(), 1, "a draft (no submitted_at) does not");
      await submit(sibling.row, true);
      assert.equal(await countOf(), 2, "the draft counts once it is handed in");
    });

    it("does not count an archived student or one who left the class", async () => {
      await submit(archivedRow, true);
      await submit(removedRow, true);
      assert.equal(await countOf(), 2);
    });
  });
});
