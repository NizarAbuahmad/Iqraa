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
import { generateLoginCode, hashLoginCode } from "../../lib/loginCode.ts";

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

/**
 * A response must not carry an object key. The signed `url` legitimately contains the key path
 * (it is an S3 URL), so it is removed from every photo first; after that no `key` property may
 * exist at any depth and the bucket prefix may not appear anywhere in the text.
 */
function assertNoObjectKey(text: string, what: string): void {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v)) {
        if (k === "url") continue;
        assert.notEqual(k, "key", `${what}: a "key" property is in the response`);
        out[k] = strip(val);
      }
      return out;
    }
    return v;
  };
  const serialised = JSON.stringify(strip(JSON.parse(text)));
  assert.equal(serialised.includes("homework-submissions/"), false, `${what}: an object key path is in the response`);
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

  describe("the student's own submission", () => {
    const photosOf = async (homeworkId: string, rowId: string) =>
      (await db.pool.query(`SELECT photos, submitted_at, note FROM homework_submissions WHERE homework_id = $1 AND student_id = $2`, [homeworkId, rowId])).rows[0];

    it("starts with nothing, and a stranger's homework id is one 404", async () => {
      const mine = await call(server, "GET", `/student/homework/${hwOpen}/submission`, w.users.studentA);
      assert.equal(mine.status, 200, mine.text);
      assert.equal(mine.json.submission.status, "none");
      assert.deepEqual(mine.json.submission.photos, []);

      // not a submission homework, a random id, another class's homework, and a parent's token
      for (const [id, user] of [
        [hwPlain, w.users.studentA], [RANDOM_UUID, w.users.studentA], ["not-a-uuid", w.users.studentA],
        [hwOpen, w.users.studentB], [hwOpen, w.users.studentUnlinked],
      ] as const) {
        const r = await call(server, "GET", `/student/homework/${id}/submission`, user);
        assert.equal(r.status, 404, `${id} as ${user}: ${r.text}`);
      }
      const asParent = await call(server, "GET", `/student/homework/${hwOpen}/submission`, w.users.parentA);
      assert.equal(asParent.status, 403, "a parent token is not a student");
      const anon = await call(server, "GET", `/student/homework/${hwOpen}/submission`);
      assert.equal(anon.status, 401);
    });

    it("stores a photo under the homework and roster-row prefix, and hands back a URL for the same bytes", async () => {
      const up = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(up.status, 201, up.text);
      assert.equal(up.json.photoCount, 1);
      assert.equal("key" in up.json.photo, false, "the object key is never sent to a client");
      assertNoObjectKey(up.text, "upload");
      const read = await call(server, "GET", `/student/homework/${hwOpen}/submission`, w.users.studentA);
      assert.equal(read.status, 200, read.text);
      assert.equal(read.json.submission.photos.length, 1, "the GET lists the photo, so the key check below has something to check");
      assertNoObjectKey(read.text, "GET");

      const keys = s3.keys().filter(k => k.startsWith(`homework-submissions/${hwOpen}/${w.students.sA1}/`));
      assert.equal(keys.length, 1);
      assert.ok(s3.body(keys[0]!)!.equals(JPEG), "the stored bytes are the uploaded bytes");

      const url = up.json.photo.url as string;
      assert.match(url, /X-Amz-Expires=600/);
      const fetched = await fetch(url);
      assert.ok(Buffer.from(await fetched.arrayBuffer()).equals(JPEG));
    });

    it("refuses what is not an image, and stores nothing for it", async () => {
      const before = s3.keys().length;
      const cases: Array<[unknown, number, string]> = [
        [{}, 400, "missing_fields"],
        [{ photoDataUrl: "https://example.com/a.jpg" }, 400, "bad_data_url"],
        [photoBody("image/heic", JPEG), 400, "unsupported_type"],
        [photoBody("image/png", JPEG), 400, "bad_image"],
        [photoBody("image/jpeg", Buffer.from("this is not an image")), 400, "bad_image"],
      ];
      for (const [body, status, code] of cases) {
        const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, body);
        assert.equal(r.status, status, r.text);
        assert.equal(r.json.code, code);
      }
      assert.equal(s3.keys().length, before, "nothing was stored");
    });

    it("answers 413 file_too_large for a photo one byte over 4 MiB, and stores nothing for it", async () => {
      const before = s3.keys().length;
      // A real JPEG header, padded: the decoded size (not the text length) is what is over the limit.
      const big = Buffer.concat([JPEG, Buffer.alloc(4 * 1024 * 1024 + 1 - JPEG.length)]);
      assert.equal(big.length, 4 * 1024 * 1024 + 1);
      const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", big));
      assert.equal(r.status, 413, r.text);
      assert.equal(r.json.code, "file_too_large");
      assert.equal(s3.keys().length, before, "nothing was stored");
      const row = await photosOf(hwOpen, w.students.sA1);
      assert.equal(row.photos.length, 1, "the project did not gain a photo");
    });

    it("limits a student to 60 photo requests an hour, in their own bucket only", async () => {
      // A dedicated account, so the quota of studentA and the classmate is untouched. `{}` costs nothing:
      // it passes the target lookup and is refused by the parser, after the limiter has counted it.
      // The limiter counts every request that reaches it (refused ones too), so 60 means 60 attempts.
      const user = (await db.pool.query(`INSERT INTO users (first_name, last_name, role) VALUES ('Rana', 'D', 'student') RETURNING id`)).rows[0].id as string;
      const row = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'رنا') RETURNING id`, [w.users.t1])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, row]);
      await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [row, user]);

      for (let i = 1; i <= 60; i++) {
        const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, user, {});
        assert.equal(r.status, 400, `request ${i}: ${r.text}`);
        assert.equal(r.json.code, "missing_fields", `request ${i}`);
      }
      const over = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, user, {});
      assert.equal(over.status, 429, over.text);
      assert.equal(over.json.code, "rate_limited");

      // Another account (same IP, same class) is not throttled by it.
      const other = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, sibling.user, {});
      assert.equal(other.status, 400, other.text);
      assert.equal(other.json.code, "missing_fields");
    });

    it("keeps one project per student: a classmate's upload lands on their own row", async () => {
      const mine = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, sibling.user, photoBody("image/png", PNG));
      assert.equal(mine.status, 201, mine.text);
      const a = await photosOf(hwOpen, w.students.sA1);
      const b = await photosOf(hwOpen, sibling.row);
      assert.equal(a.photos.length, 1, "studentA's project did not gain a photo");
      assert.equal(b.photos.length, 1);
      assert.notEqual(a.photos[0].key, b.photos[0].key);
    });

    it("caps a project at six photos, and removes the object when it refuses", async () => {
      for (let i = 0; i < 5; i++) {
        const r = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
        assert.equal(r.status, 201, r.text);
      }
      const keysBefore = s3.keys().length;
      const seventh = await call(server, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(seventh.status, 409);
      assert.equal(seventh.json.code, "photo_limit");
      assert.equal(s3.keys().length, keysBefore, "the refused photo was not left in the bucket");
    });

    it("removes a photo from the row and from the bucket; a classmate cannot remove it", async () => {
      const row = await photosOf(hwOpen, w.students.sA1);
      const victim = row.photos[0] as { id: string; key: string };
      const theirs = await call(server, "DELETE", `/student/homework/${hwOpen}/submission/photos/${victim.id}`, sibling.user);
      assert.equal(theirs.status, 404, "the photo id is not on the classmate's own submission");
      assert.ok(s3.body(victim.key), "still stored");

      const mine = await call(server, "DELETE", `/student/homework/${hwOpen}/submission/photos/${victim.id}`, w.users.studentA);
      assert.equal(mine.status, 200, mine.text);
      assert.equal(s3.body(victim.key), undefined, "gone from the bucket");
      assert.equal((await photosOf(hwOpen, w.students.sA1)).photos.length, 5);
    });

    it("refuses to hand in an empty project, then hands it in, ticks it, and is not late", async () => {
      // the classmate has a photo; use a fresh homework for an empty draft
      const fresh = await insertHomework("project-empty", "5 days", true);
      const empty = await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      assert.equal(empty.status, 409);
      assert.equal(empty.json.code, "empty");

      const note = await call(server, "PUT", `/student/homework/${fresh}/submission`, w.users.studentA, { note: "  عملت المشروع  " });
      assert.equal(note.status, 200, note.text);
      assert.equal(note.json.submission.note, "عملت المشروع");
      assert.equal((await call(server, "PUT", `/student/homework/${fresh}/submission`, w.users.studentA, { note: "ا".repeat(2001) })).status, 400);

      const done = await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      assert.equal(done.status, 200, done.text);
      assert.equal(done.json.submission.status, "submitted");
      const ticked = await db.pool.query(`SELECT 1 FROM homework_completions WHERE homework_id = $1 AND student_id = $2`, [fresh, w.students.sA1]);
      assert.equal(ticked.rowCount, 1, "handing in ticks the homework");
    });

    it("keeps the FIRST hand-in time when the student replaces their work before the due day", async () => {
      const first = await call(server, "POST", `/student/homework/${hwOpen}/submission/submit`, w.users.studentA);
      assert.equal(first.status, 200, first.text);
      assert.equal(first.json.submission.photos.length, 5);
      assertNoObjectKey(first.text, "submit");
      const t1 = (await photosOf(hwOpen, w.students.sA1)).submitted_at as Date;
      await new Promise(r => setTimeout(r, 30));
      const edit = await call(server, "PUT", `/student/homework/${hwOpen}/submission`, w.users.studentA, { note: "نسخة محسّنة" });
      assert.equal(edit.status, 200, edit.text);
      assert.equal(edit.json.submission.photos.length, 5);
      assertNoObjectKey(edit.text, "PUT note");
      const again = await call(server, "POST", `/student/homework/${hwOpen}/submission/submit`, w.users.studentA);
      assert.equal(again.status, 200);
      assert.equal(((await photosOf(hwOpen, w.students.sA1)).submitted_at as Date).getTime(), t1.getTime());
    });

    it("will not empty a handed-in project by removing its last photo and note", async () => {
      const fresh = await insertHomework("project-one-photo", "5 days", true);
      const up = await call(server, "POST", `/student/homework/${fresh}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      await call(server, "POST", `/student/homework/${fresh}/submission/submit`, w.users.studentA);
      const del = await call(server, "DELETE", `/student/homework/${fresh}/submission/photos/${up.json.photo.id}`, w.users.studentA);
      assert.equal(del.status, 409);
      assert.equal(del.json.code, "empty");
    });

    it("cannot be emptied by two removals sent at once: one succeeds, the other is refused as empty", async () => {
      // A handed-in project with two photos and no note: either removal alone is fine, both together empty it.
      // The JS pre-check of each request passes (it sees two photos), so only the guard in the UPDATE can refuse.
      for (let round = 0; round < 6; round++) {
        const hw = await insertHomework(`project-race-${round}`, "5 days", true);
        const keys: string[] = [];
        for (let i = 0; i < 2; i++) {
          const up = await call(server, "POST", `/student/homework/${hw}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
          assert.equal(up.status, 201, up.text);
        }
        assert.equal((await call(server, "POST", `/student/homework/${hw}/submission/submit`, w.users.studentA)).status, 200);
        const before = (await photosOf(hw, w.students.sA1)).photos as Array<{ id: string; key: string }>;
        assert.equal(before.length, 2);
        keys.push(...before.map(p => p.key));

        const [r1, r2] = await Promise.all(
          before.map(p => call(server, "DELETE", `/student/homework/${hw}/submission/photos/${p.id}`, w.users.studentA)),
        );
        assert.deepEqual([r1!.status, r2!.status].sort(), [200, 409], `round ${round}: ${r1!.text} / ${r2!.text}`);
        const refused = r1!.status === 409 ? r1! : r2!;
        assert.equal(refused.json.code, "empty", `round ${round}`);

        const after = await photosOf(hw, w.students.sA1);
        assert.equal(after.photos.length, 1, `round ${round}: the project kept exactly one photo`);
        assert.ok(after.submitted_at, `round ${round}: and is still handed in`);
        // The refused request deleted nothing from the bucket; the winner deleted its own object only.
        const stored = keys.filter(k => s3.body(k) !== undefined);
        assert.deepEqual(stored, [after.photos[0].key], `round ${round}: only the surviving photo is still stored`);
      }
    });

    it("answers a photo removed twice at once with one 200 and one 404, and deletes only that photo's object", async () => {
      for (let round = 0; round < 4; round++) {
        const hw = await insertHomework(`project-twice-${round}`, "5 days", true);
        for (let i = 0; i < 2; i++) {
          const up = await call(server, "POST", `/student/homework/${hw}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
          assert.equal(up.status, 201, up.text);
        }
        const [target, other] = (await photosOf(hw, w.students.sA1)).photos as Array<{ id: string; key: string }>;
        assert.ok(s3.body(target!.key) && s3.body(other!.key));

        const [r1, r2] = await Promise.all([
          call(server, "DELETE", `/student/homework/${hw}/submission/photos/${target!.id}`, w.users.studentA),
          call(server, "DELETE", `/student/homework/${hw}/submission/photos/${target!.id}`, w.users.studentA),
        ]);
        assert.deepEqual([r1.status, r2.status].sort(), [200, 404], `round ${round}: ${r1.text} / ${r2.text}`);
        const after = await photosOf(hw, w.students.sA1);
        assert.deepEqual(after.photos.map((p: { id: string }) => p.id), [other!.id]);
        assert.equal(s3.body(target!.key), undefined, "the removed photo's object is gone");
        assert.ok(s3.body(other!.key), "the other photo's object is untouched");
      }
    });

    it("locks a handed-in project once the due day has ended, but takes a first hand-in as late", async () => {
      // A project handed in on time, then the clock passes the due day.
      const handedIn = await insertHomework("project-was-on-time", "5 days", true);
      // Two photos, so a removal that slipped past the lock would succeed (not be refused as "empty").
      for (let i = 0; i < 2; i++) {
        const up = await call(server, "POST", `/student/homework/${handedIn}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
        assert.equal(up.status, 201, up.text);
      }
      assert.equal((await call(server, "POST", `/student/homework/${handedIn}/submission/submit`, w.users.studentA)).status, 200);
      await db.pool.query(`UPDATE homework SET due_at = now() - interval '1 hour' WHERE id = $1`, [handedIn]);
      const edit = await call(server, "PUT", `/student/homework/${handedIn}/submission`, w.users.studentA, { note: "متأخر" });
      assert.equal(edit.status, 409);
      assert.equal(edit.json.code, "locked");
      const keysBefore = s3.keys().length;
      const photo = await call(server, "POST", `/student/homework/${handedIn}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(photo.status, 409);
      assert.equal(photo.json.code, "locked");
      assert.equal(s3.keys().length, keysBefore, "the refused photo was not left in the bucket");
      assert.equal((await call(server, "GET", `/student/homework/${handedIn}/submission`, w.users.studentA)).json.submission.locked, true);

      // Removing a photo and handing in again are refused too, and change nothing.
      const held = (await photosOf(handedIn, w.students.sA1)).photos as Array<{ id: string; key: string }>;
      assert.equal(held.length, 2);
      const del = await call(server, "DELETE", `/student/homework/${handedIn}/submission/photos/${held[0]!.id}`, w.users.studentA);
      assert.equal(del.status, 409, del.text);
      assert.equal(del.json.code, "locked");
      assert.equal((await photosOf(handedIn, w.students.sA1)).photos.length, 2, "the photo is still on the project");
      assert.ok(s3.body(held[0]!.key), "and its object is still stored");
      const resubmit = await call(server, "POST", `/student/homework/${handedIn}/submission/submit`, w.users.studentA);
      assert.equal(resubmit.status, 409, resubmit.text);
      assert.equal(resubmit.json.code, "locked");

      // hwClosed was due yesterday and nobody handed anything in: one late hand-in is accepted.
      const up = await call(server, "POST", `/student/homework/${hwClosed}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
      assert.equal(up.status, 201, up.text);
      const late = await call(server, "POST", `/student/homework/${hwClosed}/submission/submit`, w.users.studentA);
      assert.equal(late.status, 200, late.text);
      assert.equal(late.json.submission.status, "late");
      assert.equal(late.json.submission.locked, true, "a late hand-in is final");
      const again = await call(server, "POST", `/student/homework/${hwClosed}/submission/submit`, w.users.studentA);
      assert.equal(again.status, 409, again.text);
      assert.equal(again.json.code, "locked", "a second submit after a late hand-in is refused");
    });

    it("answers 503 storage_unavailable when R2 is not configured", async () => {
      // startServer spreads process.env: blank the R2 variables so a shell that has them cannot configure this server.
      const bare = await startServer({
        databaseUrl: db.url,
        env: {
          R2_ENDPOINT: undefined,
          R2_ACCESS_KEY_ID: undefined,
          R2_SECRET_ACCESS_KEY: undefined,
          R2_FORCE_PATH_STYLE: undefined,
        },
      });
      try {
        const r = await call(bare, "POST", `/student/homework/${hwOpen}/submission/photos`, w.users.studentA, photoBody("image/jpeg", JPEG));
        assert.equal(r.status, 503);
        assert.equal(r.json.code, "storage_unavailable");
      } finally {
        await bare.stop();
      }
    });

    it("is closed while student accounts are off", async () => {
      const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined, ...s3Env(s3) } });
      try {
        const r = await call(off, "GET", `/student/homework/${hwOpen}/submission`, w.users.studentA);
        assert.equal(r.status, 403);
        assert.equal(r.json.code, "student_accounts_disabled");
      } finally {
        await off.stop();
      }
    });
  });

  describe("the teacher's view, and what archiving removes", () => {
    let hwTeacher: string;
    let hwControl: string;
    let outsider: string;
    let archived: string;
    let leaver: string;
    const seedHandedIn = async (homeworkId: string, studentRow: string, photos: Array<{ id: string; key: string }>, submitted: boolean) => {
      for (const p of photos) await s3.putForTest(p.key, JPEG);
      await db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at)
         VALUES ($1, $2, 'ملاحظة', $3::jsonb, CASE WHEN $4::boolean THEN now() END)`,
        [homeworkId, studentRow, JSON.stringify(photos.map(p => ({ ...p, mime: "image/jpeg", sizeBytes: JPEG.length }))), submitted],
      );
    };

    before(async () => {
      hwTeacher = await insertHomework("project-teacher-view", "5 days", true);
      await seedHandedIn(hwTeacher, w.students.sA1, [{ id: "p1", key: `homework-submissions/${hwTeacher}/${w.students.sA1}/p1.jpg` }], true);
      await seedHandedIn(hwTeacher, sibling.row, [{ id: "p2", key: `homework-submissions/${hwTeacher}/${sibling.row}/p2.jpg` }], false); // a draft

      // Three students who each hold a HANDED-IN row for hwTeacher but must not appear: a roster row
      // that was never in the class, a member who is archived, and one who left the class.
      const rosterRow = async (name: string) =>
        (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name])).rows[0].id as string;
      const join = (row: string) =>
        db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, row]);
      outsider = await rosterRow("غريب");
      archived = await rosterRow("مؤرشف");
      await join(archived);
      await db.pool.query(`UPDATE students SET archived_at = now() WHERE id = $1`, [archived]);
      leaver = await rosterRow("مغادر");
      await join(leaver);
      await db.pool.query(`DELETE FROM class_memberships WHERE class_group_id = $1 AND student_id = $2`, [w.classes.c1, leaver]);
      for (const [id, row] of [["o1", outsider], ["a1", archived], ["l1", leaver]] as const) {
        await seedHandedIn(hwTeacher, row, [{ id, key: `homework-submissions/${hwTeacher}/${row}/${id}.jpg` }], true);
      }

      // A control: another homework's photo, which archiving hwTeacher must leave alone.
      hwControl = await insertHomework("project-control", "5 days", true);
      await seedHandedIn(hwControl, w.students.sA1, [{ id: "c1", key: `homework-submissions/${hwControl}/${w.students.sA1}/c1.jpg` }], true);
    });

    it("lists every live member with their state; a draft is reported as none", async () => {
      const r = await call(server, "GET", `/homework/${hwTeacher}/submissions`, w.users.t1);
      assert.equal(r.status, 200, r.text);
      assert.equal(r.json.submittedCount, 1);
      const byId = new Map<string, any>(r.json.submissions.map((s: any) => [s.studentId, s]));
      assert.equal(byId.get(w.students.sA1).status, "submitted");
      assert.equal(byId.get(w.students.sA1).photoCount, 1);
      assert.equal(byId.get(sibling.row).status, "none", "the teacher never sees an unfinished upload");
      assert.equal(byId.get(sibling.row).photoCount, 0);
      for (const [name, id] of [["a roster row outside the class", outsider], ["an archived member", archived], ["one who left", leaver]] as const) {
        assert.equal(byId.has(id), false, `${name} is not listed`);
      }
    });

    it("opens one student's project with signed URLs; a draft, a stranger's student and a bad id are one 404", async () => {
      const ok = await call(server, "GET", `/homework/${hwTeacher}/submissions/${w.students.sA1}`, w.users.t1);
      assert.equal(ok.status, 200, ok.text);
      assert.equal(ok.json.submission.note, "ملاحظة");
      assert.equal(ok.json.submission.photos.length, 1);
      assert.ok(Buffer.from(await (await fetch(ok.json.submission.photos[0].url)).arrayBuffer()).equals(JPEG));
      // The outsider, the archived member and the one who left each hold a handed-in row: only the class check hides them.
      for (const id of [sibling.row, w.students.nB1, outsider, archived, leaver, RANDOM_UUID, "nope"]) {
        const r = await call(server, "GET", `/homework/${hwTeacher}/submissions/${id}`, w.users.t1);
        assert.equal(r.status, 404, `${id}: ${r.text}`);
        assert.equal(r.json.error, "Submission not found", `${id}: ${r.text}`);
      }
    });

    it("answers the same 404 for a homework that does not ask for a project", async () => {
      const list = await call(server, "GET", `/homework/${hwPlain}/submissions`, w.users.t1);
      assert.equal(list.status, 404, list.text);
      assert.equal(list.json.error, "Homework not found");
      const one = await call(server, "GET", `/homework/${hwPlain}/submissions/${w.students.sA1}`, w.users.t1);
      assert.equal(one.status, 404, one.text);
      assert.equal(one.json.error, "Homework not found");
    });

    it("is closed to another teacher, a student and an anonymous caller", async () => {
      for (const [who, user, status] of [
        ["another teacher", w.users.t2, 404],
        ["a student", w.users.studentA, 403],
        ["a parent", w.users.parentA, 403],
        ["an anonymous caller", undefined, 401],
      ] as const) {
        const list = await call(server, "GET", `/homework/${hwTeacher}/submissions`, user);
        assert.equal(list.status, status, `list as ${who}: ${list.text}`);
        const one = await call(server, "GET", `/homework/${hwTeacher}/submissions/${w.students.sA1}`, user);
        assert.equal(one.status, status, `one as ${who}: ${one.text}`);
      }
    });

    it("archiving the homework removes every photo, drafts included, and the rows", async () => {
      assert.ok(s3.keys().some(k => k.startsWith(`homework-submissions/${hwTeacher}/`)));
      const del = await call(server, "DELETE", `/homework/${hwTeacher}`, w.users.t1);
      assert.equal(del.status, 200, del.text);
      assert.equal(del.json.archived, hwTeacher);
      assert.deepEqual(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwTeacher}/`)), []);
      const left = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwTeacher]);
      assert.equal(left.rowCount, 0);
      const control = s3.keys().filter(k => k.startsWith(`homework-submissions/${hwControl}/`));
      assert.equal(control.length, 1, "another homework's photo is untouched");
      const controlRows = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwControl]);
      assert.equal(controlRows.rowCount, 1, "and so is its row");
    });

    it("removes a draft's photos and rows too when row-level security is enforced", async () => {
      // With enforcement on, the teacher's own connection cannot see a student's draft, so only the owner
      // connection (systemDb) can find the draft's photo. This is the case the purge exists for.
      const hwRls = await insertHomework("project-rls-purge", "5 days", true);
      const submittedKey = `homework-submissions/${hwRls}/${w.students.sA1}/s1.jpg`;
      const draftKey = `homework-submissions/${hwRls}/${sibling.row}/d1.jpg`;
      await seedHandedIn(hwRls, w.students.sA1, [{ id: "s1", key: submittedKey }], true);
      await seedHandedIn(hwRls, sibling.row, [{ id: "d1", key: draftKey }], false);
      const enforcing = await startServer({ databaseUrl: db.url, env: { RLS_ENFORCE: "on", ...s3Env(s3) } });
      try {
        const list = await call(enforcing, "GET", `/homework/${hwRls}/submissions`, w.users.t1);
        assert.equal(list.status, 200, list.text);
        assert.equal(list.json.submittedCount, 1);
        const draftRow = list.json.submissions.find((s: any) => s.studentId === sibling.row);
        assert.equal(draftRow.status, "none", "the draft is invisible to the teacher");
        const owner = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwRls]);
        assert.equal(owner.rowCount, 2, "the owner connection sees both rows");
        assert.ok(s3.body(draftKey) && s3.body(submittedKey), "both photos are stored");

        const del = await call(enforcing, "DELETE", `/homework/${hwRls}`, w.users.t1);
        assert.equal(del.status, 200, del.text);
        assert.equal(del.json.archived, hwRls);
        assert.deepEqual(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwRls}/`)), [], "no photo is left, the draft's included");
        const left = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwRls]);
        assert.equal(left.rowCount, 0, "no row is left");
      } finally {
        await enforcing.stop();
      }
    });

    // A photo list that holds a non-photo (here `null`) makes the purge throw. The bad value sits FIRST in the SAME
    // row's list as the real photo, so the purge reads it before it has started deleting anything — with the bad value
    // in another row the order the rows come back in decides whether the real photo was already being deleted, and
    // that made this test pass or fail depending on the heap layout (it failed once in CI for exactly that reason).
    // The purge has to run BEFORE the archive: an archived homework is invisible to `ownedHomework`, so a purge
    // that failed after the archive could never be retried and the photos (a minor's work) would stay for good.
    it("keeps the homework live and answers 500 when the purge fails, and a retry then archives it and clears the photos", async () => {
      const hwBad = await insertHomework("project-purge-fails", "5 days", true);
      const key = `homework-submissions/${hwBad}/${w.students.sA1}/keep.jpg`;
      await seedHandedIn(hwBad, w.students.sA1, [{ id: "k1", key }], true);
      const realPhoto = { id: "k1", key, mime: "image/jpeg", sizeBytes: JPEG.length };
      const setPhotos = (photos: unknown[]) =>
        db.pool.query(`UPDATE homework_submissions SET photos = $3::jsonb WHERE homework_id = $1 AND student_id = $2`, [hwBad, w.students.sA1, JSON.stringify(photos)]);
      await setPhotos([null, realPhoto]);

      const failed = await call(server, "DELETE", `/homework/${hwBad}`, w.users.t1);
      assert.equal(failed.status, 500, failed.text);
      const live = await db.pool.query(`SELECT archived_at FROM homework WHERE id = $1`, [hwBad]);
      assert.equal(live.rows[0].archived_at, null, "the homework was not archived, so the teacher can try again");
      assert.ok(s3.body(key), "and nothing was half-deleted");
      assert.equal((await call(server, "GET", `/homework/${hwBad}/submissions`, w.users.t1)).status, 200, "it is still the teacher's to open");

      await setPhotos([realPhoto]);
      const retried = await call(server, "DELETE", `/homework/${hwBad}`, w.users.t1);
      assert.equal(retried.status, 200, retried.text);
      assert.equal(retried.json.archived, hwBad);
      const done = await db.pool.query(`SELECT archived_at FROM homework WHERE id = $1`, [hwBad]);
      assert.notEqual(done.rows[0].archived_at, null, "now archived");
      assert.deepEqual(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwBad}/`)), []);
      assert.equal((await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hwBad])).rowCount, 0);
    });

    it("archiving a class removes the photos and rows of its homework, drafts included, and leaves other classes alone", async () => {
      // Writing to a roster needs the teacher's own consent attestation (lib/rosterConsent.ts).
      await db.pool.query(`UPDATE users SET roster_consent_at = now() WHERE id = ANY($1::uuid[])`, [[w.users.t1, w.users.t2]]);
      const klass = (
        await db.pool.query(
          `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, 'صف للأرشفة', 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
          [w.users.t1],
        )
      ).rows[0].id as string;
      const mkHomework = async (classId: string, title: string) =>
        (
          await db.pool.query(
            `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission) VALUES ($1, $2, $3, now() + interval '5 days', true) RETURNING id`,
            [w.users.t1, classId, title],
          )
        ).rows[0].id as string;
      const hwOne = await mkHomework(klass, "class-archive-one");
      const hwTwo = await mkHomework(klass, "class-archive-two");
      const handedKey = `homework-submissions/${hwOne}/${w.students.sA1}/h.jpg`;
      const draftKey = `homework-submissions/${hwTwo}/${sibling.row}/d.jpg`;
      await seedHandedIn(hwOne, w.students.sA1, [{ id: "h1", key: handedKey }], true);
      await seedHandedIn(hwTwo, sibling.row, [{ id: "d1", key: draftKey }], false);
      const controlKeys = s3.keys().filter(k => k.startsWith(`homework-submissions/${hwControl}/`));
      assert.equal(controlKeys.length, 1, "the control photo in c1 is there to be left alone");

      // A purge that cannot run stops the archive: the class stays live and the teacher retries.
      await db.pool.query(`UPDATE homework_submissions SET photos = '[null]'::jsonb WHERE homework_id = $1`, [hwTwo]);
      const failed = await call(server, "DELETE", `/classes/${klass}`, w.users.t1);
      assert.equal(failed.status, 500, failed.text);
      const stillLive = await db.pool.query(`SELECT archived_at FROM class_groups WHERE id = $1`, [klass]);
      assert.equal(stillLive.rows[0].archived_at, null, "the class was not archived");
      await db.pool.query(
        `UPDATE homework_submissions SET photos = $2::jsonb WHERE homework_id = $1`,
        [hwTwo, JSON.stringify([{ id: "d1", key: draftKey, mime: "image/jpeg", sizeBytes: JPEG.length }])],
      );

      const del = await call(server, "DELETE", `/classes/${klass}`, w.users.t1);
      assert.equal(del.status, 200, del.text);
      assert.deepEqual(del.json, { archived: klass });
      const archivedClass = await db.pool.query(`SELECT archived_at FROM class_groups WHERE id = $1`, [klass]);
      assert.notEqual(archivedClass.rows[0].archived_at, null);
      assert.deepEqual(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwOne}/`) || k.startsWith(`homework-submissions/${hwTwo}/`)), [], "no photo of either homework is left");
      const left = await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = ANY($1)`, [[hwOne, hwTwo]]);
      assert.equal(left.rowCount, 0, "no row is left, the draft's included");
      assert.equal(s3.keys().filter(k => k.startsWith(`homework-submissions/${hwControl}/`)).length, 1, "another class's photo is untouched");
      assert.equal((await call(server, "DELETE", `/classes/${RANDOM_UUID}`, w.users.t1)).status, 404, "an unknown class is still 404");
      assert.equal((await call(server, "DELETE", `/classes/${w.classes.c1}`, w.users.t2)).status, 404, "another teacher's class is still 404");
      const c1 = await db.pool.query(`SELECT archived_at FROM class_groups WHERE id = $1`, [w.classes.c1]);
      assert.equal(c1.rows[0].archived_at, null, "and was not archived");
    });
  });

  describe("the student's journey and the teacher's reads, with row-level security enforced", () => {
    // Every write in lib/homeworkSubmission.ts reads "zero rows updated" as a business answer (photo_limit, empty),
    // so an RLS fault on the student's own INSERT / UPDATE would look like a refusal, not an error. Production
    // runs with RLS_ENFORCE=on, so this is the path that has to work there: a fresh account and homework, so no
    // quota or earlier state can explain a pass or a failure.
    it("uploads, notes, hands in and removes a photo; the teacher reads it back and never sees a draft", async () => {
      const user = (await db.pool.query(`INSERT INTO users (first_name, last_name, role) VALUES ('Dina', 'E', 'student') RETURNING id`)).rows[0].id as string;
      const row = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'دينا') RETURNING id`, [w.users.t1])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, row]);
      await db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, 'self')`, [row, user]);
      const hwJourney = await insertHomework("project-rls-journey", "5 days", true);
      const hwDraft = await insertHomework("project-rls-draft", "5 days", true);
      const enforcing = await startServer({ databaseUrl: db.url, env: { RLS_ENFORCE: "on", ...s3Env(s3) } });
      try {
        const first = await call(enforcing, "POST", `/student/homework/${hwJourney}/submission/photos`, user, photoBody("image/jpeg", JPEG));
        assert.equal(first.status, 201, first.text);
        assert.equal(first.json.photoCount, 1);
        const second = await call(enforcing, "POST", `/student/homework/${hwJourney}/submission/photos`, user, photoBody("image/png", PNG));
        assert.equal(second.status, 201, second.text);
        assert.equal(second.json.photoCount, 2);

        const note = await call(enforcing, "PUT", `/student/homework/${hwJourney}/submission`, user, { note: "  ملاحظة دينا  " });
        assert.equal(note.status, 200, note.text);
        assert.equal(note.json.submission.note, "ملاحظة دينا");

        const submit = await call(enforcing, "POST", `/student/homework/${hwJourney}/submission/submit`, user);
        assert.equal(submit.status, 200, submit.text);
        assert.equal(submit.json.submission.status, "submitted");
        assert.equal(submit.json.submission.photos.length, 2);

        const removed = await call(enforcing, "DELETE", `/student/homework/${hwJourney}/submission/photos/${first.json.photo.id}`, user);
        assert.equal(removed.status, 200, removed.text);
        const mine = await call(enforcing, "GET", `/student/homework/${hwJourney}/submission`, user);
        assert.equal(mine.status, 200, mine.text);
        assert.equal(mine.json.submission.status, "submitted");
        assert.deepEqual(mine.json.submission.photos.map((p: any) => p.id), [second.json.photo.id]);

        // The teacher, on the same enforcing server: the list, then the detail with a URL for the stored bytes.
        const list = await call(enforcing, "GET", `/homework/${hwJourney}/submissions`, w.users.t1);
        assert.equal(list.status, 200, list.text);
        const dina = list.json.submissions.find((s: any) => s.studentId === row);
        assert.equal(dina.status, "submitted");
        assert.equal(dina.photoCount, 1);
        assert.equal(list.json.submittedCount, 1);
        const detail = await call(enforcing, "GET", `/homework/${hwJourney}/submissions/${row}`, w.users.t1);
        assert.equal(detail.status, 200, detail.text);
        assert.equal(detail.json.submission.note, "ملاحظة دينا");
        assert.equal(detail.json.submission.photos.length, 1);
        assert.ok(Buffer.from(await (await fetch(detail.json.submission.photos[0].url)).arrayBuffer()).equals(PNG), "the URL serves the stored bytes");

        // A draft on another homework: the student has a photo there, the teacher sees nothing.
        const draftUp = await call(enforcing, "POST", `/student/homework/${hwDraft}/submission/photos`, user, photoBody("image/jpeg", JPEG));
        assert.equal(draftUp.status, 201, draftUp.text);
        const draftList = await call(enforcing, "GET", `/homework/${hwDraft}/submissions`, w.users.t1);
        assert.equal(draftList.status, 200, draftList.text);
        assert.equal(draftList.json.submissions.find((s: any) => s.studentId === row).status, "none");
        assert.equal(draftList.json.submissions.find((s: any) => s.studentId === row).photoCount, 0);
        assert.equal(draftList.json.submittedCount, 0);
        const draftDetail = await call(enforcing, "GET", `/homework/${hwDraft}/submissions/${row}`, w.users.t1);
        assert.equal(draftDetail.status, 404, draftDetail.text);
        const owner = await db.pool.query(`SELECT submitted_at FROM homework_submissions WHERE homework_id = $1`, [hwDraft]);
        assert.equal(owner.rowCount, 1, "the draft exists; it is only invisible");
        assert.equal(owner.rows[0].submitted_at, null);
      } finally {
        await enforcing.stop();
      }
    });
  });

  describe("deleting a teacher's account", () => {
    // `users` cascades to the teacher's homework and roster, and both to homework_submissions, so the rows go with
    // the account. The photos do not: they are objects in R2, and only the keys read BEFORE the delete can find them.
    it("removes every photo of the teacher's homework, a draft's included, and leaves another teacher's alone", async () => {
      const code = generateLoginCode();
      const teacher = (
        await db.pool.query(
          `INSERT INTO users (first_name, last_name, role, login_code_hash) VALUES ('Mona', 'T', 'teacher', $1) RETURNING id`,
          [hashLoginCode(code)],
        )
      ).rows[0].id as string;
      const klass = (
        await db.pool.query(
          `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, 'صف منى', 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
          [teacher],
        )
      ).rows[0].id as string;
      const rosterRow = async (name: string) => {
        const id = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [teacher, name])).rows[0].id as string;
        await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [klass, id]);
        return id;
      };
      const handedRow = await rosterRow("سلمى");
      const draftRow = await rosterRow("رند");
      const hw = (
        await db.pool.query(
          `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission) VALUES ($1, $2, 'mona-project', now() + interval '5 days', true) RETURNING id`,
          [teacher, klass],
        )
      ).rows[0].id as string;
      const seed = async (studentRow: string, id: string, submitted: boolean) => {
        const key = `homework-submissions/${hw}/${studentRow}/${id}.jpg`;
        await s3.putForTest(key, JPEG);
        await db.pool.query(
          `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at) VALUES ($1, $2, 'n', $3::jsonb, CASE WHEN $4::boolean THEN now() END)`,
          [hw, studentRow, JSON.stringify([{ id, key, mime: "image/jpeg", sizeBytes: JPEG.length }]), submitted],
        );
        return key;
      };
      const handedKey = await seed(handedRow, "h1", true);
      const draftKey = await seed(draftRow, "d1", false);
      const otherKey = `homework-submissions/${hwOpen}/${w.students.sA1}/other-teacher.jpg`;
      await s3.putForTest(otherKey, JPEG);
      assert.ok(s3.body(handedKey) && s3.body(draftKey), "both photos are stored");

      const del = await call(server, "DELETE", "/auth/users/me", teacher, { loginCode: code });
      assert.equal(del.status, 200, del.text);
      assert.equal(s3.body(handedKey), undefined, "the handed-in photo is gone from the bucket");
      assert.equal(s3.body(draftKey), undefined, "and so is the draft's");
      assert.ok(s3.body(otherKey), "another teacher's photo is untouched");
      assert.equal((await db.pool.query(`SELECT 1 FROM users WHERE id = $1`, [teacher])).rowCount, 0, "the account is gone");
      assert.equal((await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = $1`, [hw])).rowCount, 0, "and its submission rows");
    });
  });

  describe("deleting a student's or a parent's account", () => {
    // A submission references a roster row, which stays with the teacher, so nothing cascades from the
    // student's `users` row to it. The privacy policy (§6) promises that deleting a student account deletes what
    // was handed in through it, drafts included; these cases hold the route to that, and to the two things it
    // must NOT delete: a parent's child's work, and a row another student account is also self-linked to.
    const codeUser = async (role: "student" | "parent", first: string) => {
      const code = generateLoginCode();
      const id = (
        await db.pool.query(
          `INSERT INTO users (first_name, last_name, role, login_code_hash) VALUES ($1, 'X', $2, $3) RETURNING id`,
          [first, role, hashLoginCode(code)],
        )
      ).rows[0].id as string;
      return { id, code };
    };
    const newClass = async (name: string) =>
      (
        await db.pool.query(
          `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids) VALUES ($1, $2, 'mathematics', '["mathematics"]'::jsonb) RETURNING id`,
          [w.users.t1, name],
        )
      ).rows[0].id as string;
    const rosterRow = async (klass: string, name: string) => {
      const id = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, $2) RETURNING id`, [w.users.t1, name])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [klass, id]);
      return id;
    };
    const link = (row: string, user: string, relation: "self" | "guardian") =>
      db.pool.query(`INSERT INTO roster_links (student_id, user_id, relation) VALUES ($1, $2, $3)`, [row, user, relation]);
    const projectHomework = async (klass: string, title: string) =>
      (
        await db.pool.query(
          `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission) VALUES ($1, $2, $3, now() + interval '5 days', true) RETURNING id`,
          [w.users.t1, klass, title],
        )
      ).rows[0].id as string;
    const seed = async (hw: string, row: string, photoId: string, submitted: boolean) => {
      const key = `homework-submissions/${hw}/${row}/${photoId}.jpg`;
      await s3.putForTest(key, JPEG);
      await db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at) VALUES ($1, $2, 'n', $3::jsonb, CASE WHEN $4::boolean THEN now() END)`,
        [hw, row, JSON.stringify([{ id: photoId, key, mime: "image/jpeg", sizeBytes: JPEG.length }]), submitted],
      );
      return key;
    };
    const rowsOf = async (row: string) =>
      (await db.pool.query(`SELECT 1 FROM homework_submissions WHERE student_id = $1`, [row])).rowCount;

    /** One student account self-linked to a row in each of two classes: a handed-in project in one, a draft in the other. */
    const studentWithTwoProjects = async (tag: string) => {
      const student = await codeUser("student", `S-${tag}`);
      const classA = await newClass(`صف ${tag} أ`);
      const classB = await newClass(`صف ${tag} ب`);
      const rowA = await rosterRow(classA, `طالب ${tag} أ`);
      const rowB = await rosterRow(classB, `طالب ${tag} ب`);
      await link(rowA, student.id, "self");
      await link(rowB, student.id, "self");
      const hwA = await projectHomework(classA, `project-${tag}-a`);
      const hwB = await projectHomework(classB, `project-${tag}-b`);
      const handedKey = await seed(hwA, rowA, `h-${tag}`, true);
      const draftKey = await seed(hwB, rowB, `d-${tag}`, false);
      return { student, rowA, rowB, handedKey, draftKey };
    };

    it("removes the student's handed-in project and draft, rows and photos, in every class, and nobody else's", async () => {
      const s = await studentWithTwoProjects("del");
      // Another student's project in the same homework as the handed-in one: same class, a row this account is not linked to.
      const hwA = (await db.pool.query(`SELECT homework_id FROM homework_submissions WHERE student_id = $1`, [s.rowA])).rows[0].homework_id as string;
      const classA = (await db.pool.query(`SELECT class_group_id FROM homework WHERE id = $1`, [hwA])).rows[0].class_group_id as string;
      const otherRow = await rosterRow(classA, "طالب آخر");
      const otherKey = await seed(hwA, otherRow, "someone-else", true);
      assert.ok(s3.body(s.handedKey) && s3.body(s.draftKey) && s3.body(otherKey), "all three photos are stored");

      const del = await call(server, "DELETE", "/auth/users/me", s.student.id, { loginCode: s.student.code });
      assert.equal(del.status, 200, del.text);
      assert.equal((await db.pool.query(`SELECT 1 FROM users WHERE id = $1`, [s.student.id])).rowCount, 0, "the account is gone");
      assert.equal(await rowsOf(s.rowA), 0, "the handed-in submission row is gone");
      assert.equal(await rowsOf(s.rowB), 0, "and the draft's");
      assert.equal(s3.body(s.handedKey), undefined, "the handed-in photo is gone from the bucket");
      assert.equal(s3.body(s.draftKey), undefined, "and so is the draft's");
      assert.equal((await db.pool.query(`SELECT 1 FROM students WHERE id = ANY($1::uuid[])`, [[s.rowA, s.rowB]])).rowCount, 2, "the roster rows stay with the teacher");
      assert.ok(s3.body(otherKey), "another student's photo is untouched");
      assert.equal(await rowsOf(otherRow), 1, "and so is their row");
    });

    it("does the same with row-level security enforced", async () => {
      const s = await studentWithTwoProjects("rls");
      const enforcing = await startServer({ databaseUrl: db.url, env: { RLS_ENFORCE: "on", ...s3Env(s3) } });
      try {
        const del = await call(enforcing, "DELETE", "/auth/users/me", s.student.id, { loginCode: s.student.code });
        assert.equal(del.status, 200, del.text);
        assert.equal(await rowsOf(s.rowA), 0, "the handed-in submission row is gone");
        assert.equal(await rowsOf(s.rowB), 0, "and the draft's");
        assert.equal(s3.body(s.handedKey), undefined, "the handed-in photo is gone");
        assert.equal(s3.body(s.draftKey), undefined, "and the draft's");
      } finally {
        await enforcing.stop();
      }
    });

    it("deletes nothing of the child's when a parent deletes their account", async () => {
      const s = await studentWithTwoProjects("parent");
      const parent = await codeUser("parent", "P-parent");
      await link(s.rowA, parent.id, "guardian");
      await link(s.rowB, parent.id, "guardian");
      // The teacher unlinked the child's account from row B (DELETE /students/:id/links/:userId): its work stays on
      // the row with no self link left, so only the relation filter — not the shared-row check — protects it here.
      await db.pool.query(`DELETE FROM roster_links WHERE student_id = $1 AND relation = 'self'`, [s.rowB]);

      const del = await call(server, "DELETE", "/auth/users/me", parent.id, { loginCode: parent.code });
      assert.equal(del.status, 200, del.text);
      assert.equal((await db.pool.query(`SELECT 1 FROM users WHERE id = $1`, [parent.id])).rowCount, 0, "the parent's account is gone");
      assert.equal(await rowsOf(s.rowA), 1, "the child's handed-in project stays");
      assert.equal(await rowsOf(s.rowB), 1, "and the child's draft");
      assert.ok(s3.body(s.handedKey) && s3.body(s.draftKey), "and both photos");
    });

    it("keeps a row that another student account is also self-linked to, and still removes the rest", async () => {
      const s = await studentWithTwoProjects("shared");
      const second = await codeUser("student", "S-second");
      // Today the schema allows one `self` link per roster row (`roster_links_one_self_idx`), so a shared row cannot
      // exist and the purge's shared-row guard is a backstop. Pin the invariant first; then lift the index in this
      // throwaway database to show the guard still holds if it is ever dropped.
      await assert.rejects(link(s.rowA, second.id, "self"), /roster_links_one_self_idx/, "a second self link is refused today");
      await db.pool.query(`DROP INDEX roster_links_one_self_idx`);
      try {
        await link(s.rowA, second.id, "self");

        const del = await call(server, "DELETE", "/auth/users/me", s.student.id, { loginCode: s.student.code });
        assert.equal(del.status, 200, del.text);
        assert.equal(await rowsOf(s.rowA), 1, "the shared row keeps its project: the other account can still open it");
        assert.ok(s3.body(s.handedKey), "and its photo");
        assert.equal(await rowsOf(s.rowB), 0, "the row only the deleted account was linked to loses its draft");
        assert.equal(s3.body(s.draftKey), undefined, "and its photo");
      } finally {
        // The deleted account's link went with it, so the row is back to one self link and the index can return.
        await db.pool.query(
          `CREATE UNIQUE INDEX roster_links_one_self_idx ON roster_links USING btree (student_id) WHERE relation = 'self'`,
        );
      }
    });
  });

  describe("a parent, and the family's list", () => {
    let hwFamily: string;
    before(async () => {
      hwFamily = await insertHomework("project-family", "5 days", true);
      const key = `homework-submissions/${hwFamily}/${w.students.sA1}/fam.jpg`;
      await s3.putForTest(key, JPEG);
      await db.pool.query(
        `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at) VALUES ($1, $2, 'للأهل', $3::jsonb, now())`,
        [hwFamily, w.students.sA1, JSON.stringify([{ id: "f1", key, mime: "image/jpeg", sizeBytes: JPEG.length }])],
      );
      // a draft of the classmate's, which no parent may see
      await db.pool.query(`INSERT INTO homework_submissions (homework_id, student_id, note) VALUES ($1, $2, 'مسودة')`, [hwFamily, sibling.row]);
    });

    it("lets a guardian read their own child's handed-in project, read-only", async () => {
      const r = await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentA);
      assert.equal(r.status, 200, r.text);
      // Both of this family's children sit in c1: Sara handed in, Adam did not. Another family's child is not here.
      assert.deepEqual(r.json.children.map((c: any) => c.displayName).sort(), ["آدم", "سارة"]);
      const sara = r.json.children.find((c: any) => c.displayName === "سارة");
      const adam = r.json.children.find((c: any) => c.displayName === "آدم");
      assert.equal(sara.submission.note, "للأهل");
      assert.equal(sara.submission.photos.length, 1);
      assert.equal(sara.submission.status, "submitted");
      assert.equal(adam.submission.status, "none");
      assert.ok(Buffer.from(await (await fetch(sara.submission.photos[0].url)).arrayBuffer()).equals(JPEG));
      // A child's own `key` (their group id) is part of this response; a photo's object key must not be.
      for (const c of r.json.children) {
        for (const p of c.submission.photos) assert.deepEqual(Object.keys(p).sort(), ["id", "mime", "sizeBytes", "url"]);
      }
      assert.equal(JSON.stringify(r.json).replace(/"url":"[^"]*"/g, "").includes("homework-submissions/"), false);
      // The unmatched path answers an HTML 404 page, so this is a raw fetch rather than `call` (which parses JSON).
      const write = await fetch(`${server.base}/parent/homework/${hwFamily}/submission`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${accessToken(w.users.parentA)}`, "Content-Type": "application/json" },
        body: JSON.stringify({ note: "x" }),
      });
      assert.ok([404, 405].includes(write.status), "a parent has no write route");
      const after = await db.pool.query(`SELECT note FROM homework_submissions WHERE homework_id = $1 AND student_id = $2`, [hwFamily, w.students.sA1]);
      assert.equal(after.rows[0].note, "للأهل", "and the attempt changed nothing");
    });

    it("shows another family, a teacher and an anonymous caller nothing", async () => {
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentB)).status, 404);
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.t1)).status, 403);
      assert.equal((await call(server, "GET", `/parent/homework/${hwFamily}/submissions`)).status, 401);
      assert.equal((await call(server, "GET", `/parent/homework/${RANDOM_UUID}/submissions`, w.users.parentA)).status, 404);
    });

    it("never shows a parent a draft, and answers 404 for a homework that asks for no project", async () => {
      // A guardian whose child holds only a DRAFT sees the child with nothing handed in, never the draft.
      const hwDraft = await insertHomework("project-family-draft", "5 days", true);
      await db.pool.query(`INSERT INTO homework_submissions (homework_id, student_id, note) VALUES ($1, $2, 'مسودة سارة')`, [hwDraft, w.students.sA1]);
      const r = await call(server, "GET", `/parent/homework/${hwDraft}/submissions`, w.users.parentA);
      assert.equal(r.status, 200, r.text);
      const saraDraft = r.json.children.find((c: any) => c.displayName === "سارة");
      assert.equal(saraDraft.submission.status, "none");
      assert.equal(saraDraft.submission.note, "");
      assert.equal(saraDraft.submission.photos.length, 0);
      assert.equal(r.text.includes("مسودة"), false, "the draft's text is nowhere in the response");

      const plain = await call(server, "GET", `/parent/homework/${hwPlain}/submissions`, w.users.parentA);
      assert.equal(plain.status, 404, plain.text);
      assert.equal(plain.json.error, "Homework not found");
    });

    it("is closed while student accounts are off", async () => {
      const off = await startServer({ databaseUrl: db.url, env: { STUDENT_ACCOUNTS: undefined, ...s3Env(s3) } });
      try {
        const r = await call(off, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentA);
        assert.equal(r.status, 403, r.text);
        assert.equal(r.json.code, "student_accounts_disabled");
      } finally {
        await off.stop();
      }
    });

    it("carries the state in the student's and the parent's homework lists", async () => {
      const student = await call(server, "GET", "/student/homework", w.users.studentA);
      const mine = student.json.homework.find((h: any) => h.id === hwFamily);
      assert.equal(mine.requiresSubmission, true);
      assert.equal(mine.submission, "submitted");
      const parent = await call(server, "GET", "/parent/homework", w.users.parentA);
      const sara = parent.json.children.find((c: any) => c.displayName === "سارة");
      assert.equal(sara.homework.find((h: any) => h.id === hwFamily).submission, "submitted");
      // the classmate's draft is not "submitted" for them
      const layla = await call(server, "GET", "/student/homework", sibling.user);
      assert.equal(layla.json.homework.find((h: any) => h.id === hwFamily).submission, "none");
    });

    it("gives the same answers when row-level security is enforced", async () => {
      const enforcing = await startServer({ databaseUrl: db.url, env: { RLS_ENFORCE: "on", ...s3Env(s3) } });
      try {
        const read = await call(enforcing, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentA);
        const plainRead = await call(server, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentA);
        assert.equal(read.status, 200, read.text);
        const byName = (res: any) => Object.fromEntries(res.json.children.map((c: any) => [c.displayName, c.submission]));
        assert.deepEqual(Object.keys(byName(read)).sort(), Object.keys(byName(plainRead)).sort());
        assert.equal(byName(read)["سارة"].note, "للأهل");
        assert.equal(byName(read)["سارة"].photos.length, 1);
        assert.equal(byName(read)["آدم"].status, "none");
        assert.equal((await call(enforcing, "GET", `/parent/homework/${hwFamily}/submissions`, w.users.parentB)).status, 404);

        const parent = await call(enforcing, "GET", "/parent/homework", w.users.parentA);
        const sara = parent.json.children.find((c: any) => c.displayName === "سارة");
        assert.equal(sara.homework.find((h: any) => h.id === hwFamily).submission, "submitted");
        const student = await call(enforcing, "GET", "/student/homework", w.users.studentA);
        assert.equal(student.json.homework.find((h: any) => h.id === hwFamily).submission, "submitted");
        const layla = await call(enforcing, "GET", "/student/homework", sibling.user);
        assert.equal(layla.json.homework.find((h: any) => h.id === hwFamily).submission, "none");
      } finally {
        await enforcing.stop();
      }
    });
  });
});
