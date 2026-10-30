/**
 * What this guards: the scheduled sweep that deletes a MINOR's project photos for good. It is
 * tested through the real route (POST /internal/homework-submission-sweep, the built bundle) against
 * a real database and an in-memory S3, and every case asserts what is LEFT — the bucket's keys and
 * the rows — not just the counts it reports. The failures that matter are all deletions that should
 * not have happened: a young object, a referenced one, a key of another shape, another prefix, a
 * live homework, a dry run — and the sweep stopping because one homework could not be purged.
 *
 * Every case gets its own bucket and server, and starts from an empty submissions table, so the
 * counts in a response are exact and no case depends on another. The boundary of the grace period
 * is pinned in the pure test (modules/homework/__tests__/submissionSweep.test.ts); here the margin
 * is a minute, because the clock runs between seeding and the request.
 */
import { afterEach, before, after, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { s3Env, startS3Stub, type S3Stub } from "../../test-support/s3Stub.ts";
import { GRACE_MS } from "../../modules/homework/submissionSweep.ts";

const CRON_KEY = "sweep-test-cron-key";
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 2, 3]);
const DAY = 24 * 60 * 60 * 1000;
/** Comfortably past the grace period / comfortably inside it, whatever the clock does meanwhile. */
const oldDate = () => new Date(Date.now() - GRACE_MS - 60_000);
const youngDate = () => new Date(Date.now() - GRACE_MS + 60_000);
const ancientDate = () => new Date(Date.now() - 400 * DAY);

describeDb("homework submission orphan sweep over HTTP, against a real database", () => {
  let db: TestDb;
  let w: FamilyWorld;
  let s3: S3Stub;
  let server: TestServer;
  const toClose: Array<() => Promise<void>> = [];

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
  });
  after(async () => {
    await db?.drop();
  });
  beforeEach(async () => {
    await db.pool.query(`DELETE FROM homework_submissions`);
    s3 = await startS3Stub();
    toClose.push(() => s3.close());
    server = await startServer({ databaseUrl: db.url, env: { INTERNAL_CRON_KEY: CRON_KEY, ...s3Env(s3) } });
    toClose.push(() => server.stop());
  });
  afterEach(async () => {
    while (toClose.length) await toClose.pop()!();
  });

  const sweep = async (query = "", srv: TestServer = server, headers: Record<string, string> = { "x-internal-key": CRON_KEY }) => {
    const res = await fetch(`${srv.base}/internal/homework-submission-sweep${query}`, { method: "POST", headers });
    const text = await res.text();
    let json: any = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      /* a 404 from Express is an HTML page; only the status matters then */
    }
    return { status: res.status, text, json };
  };

  const mkStudent = async (): Promise<string> =>
    (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'طالب') RETURNING id`, [w.users.t1])).rows[0].id as string;
  const mkClass = async (archived: boolean): Promise<string> =>
    (
      await db.pool.query(
        `INSERT INTO class_groups (teacher_id, name, subject_id, subject_ids, archived_at)
         VALUES ($1, 'صف للكنس', 'mathematics', '["mathematics"]'::jsonb, CASE WHEN $2::boolean THEN now() END) RETURNING id`,
        [w.users.t1, archived],
      )
    ).rows[0].id as string;
  const mkHomework = async (opts: { archived?: boolean; classId?: string } = {}): Promise<string> =>
    (
      await db.pool.query(
        `INSERT INTO homework (teacher_id, class_group_id, title, due_at, requires_submission, archived_at)
         VALUES ($1, $2, 'sweep', now() + interval '5 days', true, CASE WHEN $3::boolean THEN now() END) RETURNING id`,
        [w.users.t1, opts.classId ?? w.classes.c1, opts.archived === true],
      )
    ).rows[0].id as string;
  const photoKey = (hw: string, student: string, ext = "jpg") => `homework-submissions/${hw}/${student}/${randomUUID()}.${ext}`;
  /** A row naming `keys`, and the objects for them stored `lastModified` ago. */
  const seedRow = async (hw: string, student: string, keys: string[], opts: { submitted?: boolean; lastModified?: Date } = {}) => {
    for (const k of keys) await s3.putForTest(k, JPEG, opts.lastModified ?? new Date());
    await db.pool.query(
      `INSERT INTO homework_submissions (homework_id, student_id, note, photos, submitted_at)
       VALUES ($1, $2, 'ملاحظة', $3::jsonb, CASE WHEN $4::boolean THEN now() END)`,
      [hw, student, JSON.stringify(keys.map((key, i) => ({ id: `p${i}`, key, mime: "image/jpeg", sizeBytes: JPEG.length }))), opts.submitted !== false],
    );
  };
  const rowsOf = async (...hws: string[]) => (await db.pool.query(`SELECT 1 FROM homework_submissions WHERE homework_id = ANY($1::uuid[])`, [hws])).rowCount;
  /** A key no row names, stored `lastModified`. */
  const seedOrphan = async (lastModified: Date, ext = "jpg"): Promise<string> => {
    const key = photoKey(randomUUID(), randomUUID(), ext);
    await s3.putForTest(key, JPEG, lastModified);
    return key;
  };

  describe("who may call it", () => {
    it("answers 404 to a missing key, a wrong key and a GET, and deletes nothing", async () => {
      const orphan = await seedOrphan(ancientDate());
      assert.equal((await sweep("", server, {})).status, 404, "no key");
      assert.equal((await sweep("", server, { "x-internal-key": "wrong" })).status, 404, "wrong key");
      assert.equal((await sweep("", server, { "x-internal-key": CRON_KEY + "x" })).status, 404, "a key that merely starts like the real one");
      const get = await fetch(`${server.base}/internal/homework-submission-sweep`, { headers: { "x-internal-key": CRON_KEY } });
      assert.equal(get.status, 404, "GET is not a route");
      assert.deepEqual(s3.keys(), [orphan], "the old orphan is still there: a refused call deletes nothing");
    });

    it("answers 404 when the server has no INTERNAL_CRON_KEY at all", async () => {
      const bare = await startServer({ databaseUrl: db.url, env: { INTERNAL_CRON_KEY: undefined, ...s3Env(s3) } });
      toClose.push(() => bare.stop());
      const orphan = await seedOrphan(ancientDate());
      assert.equal((await sweep("", bare, { "x-internal-key": "anything" })).status, 404);
      assert.equal((await sweep("", bare, { "x-internal-key": "" })).status, 404);
      assert.deepEqual(s3.keys(), [orphan]);
    });
  });

  describe("objects no row refers to", () => {
    it("deletes one past the grace period, keeps one inside it, and keeps a referenced one however old", async () => {
      const hw = await mkHomework();
      const student = await mkStudent();
      const oldOrphan = await seedOrphan(oldDate());
      const youngOrphan = await seedOrphan(youngDate());
      const brandNew = await seedOrphan(new Date());
      const referenced = photoKey(hw, student);
      await seedRow(hw, student, [referenced], { lastModified: ancientDate() });

      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.deepEqual(run.json, {
        dryRun: false,
        archivedHomework: 0,
        rowsPurged: 0,
        objectsListed: 4,
        referenced: 1,
        orphanObjects: 1,
        deleted: 1,
        skippedYoung: 2,
        skippedBadKey: 0,
        capped: 0,
        listTruncated: false,
        objectsSkipped: false,
        sample: [oldOrphan],
      });
      assert.deepEqual(s3.keys(), [referenced, youngOrphan, brandNew].sort(), "only the old orphan went");
      assert.equal(await rowsOf(hw), 1, "the live row is untouched");
    });

    it("is idempotent: a second run finds nothing more to delete", async () => {
      await seedOrphan(oldDate());
      assert.equal((await sweep()).json.deleted, 1);
      const again = await sweep();
      assert.equal(again.status, 200, again.text);
      assert.equal(again.json.deleted, 0);
      assert.equal(again.json.orphanObjects, 0);
      assert.equal(again.json.objectsListed, 0);
      assert.deepEqual(again.json.sample, []);
    });

    it("keeps only a sample of 20 keys in the answer however many it deleted", async () => {
      for (let i = 0; i < 25; i++) await seedOrphan(oldDate());
      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.deleted, 25);
      assert.equal(run.json.capped, 0);
      assert.equal(run.json.sample.length, 20);
      assert.deepEqual(s3.keys(), []);
    });

    it("keeps a photo of a LIVE homework whose row names it, drafts included", async () => {
      const hw = await mkHomework();
      const [a, b] = [await mkStudent(), await mkStudent()];
      const handed = photoKey(hw, a);
      const draft = photoKey(hw, b);
      await seedRow(hw, a, [handed], { submitted: true, lastModified: ancientDate() });
      await seedRow(hw, b, [draft], { submitted: false, lastModified: ancientDate() });
      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.deleted, 0);
      assert.equal(run.json.referenced, 2);
      assert.deepEqual(s3.keys(), [draft, handed].sort());
      assert.equal(await rowsOf(hw), 2);
    });
  });

  describe("what is never touched", () => {
    it("leaves other prefixes alone, and a key under the prefix of the wrong shape, counting the latter", async () => {
      const hw = randomUUID();
      const st = randomUUID();
      const id = randomUUID();
      const others = [`lesson-media/${id}.jpg`, `chat-media/${id}.png`, `library/${id}.webp`, `attempt-audio/${id}.m4a`, `homework-submissions-old/${hw}/${st}/${id}.jpg`];
      const badShapes = [
        `homework-submissions/${hw}/${st}/${id}.JPG`,
        `homework-submissions/${hw}/${st}/${id}.gif`,
        `homework-submissions/${hw}/${st}/extra/${id}.jpg`,
        `homework-submissions/${hw}/${st}/s1.jpg`,
        `homework-submissions/note.txt`,
      ];
      for (const k of [...others, ...badShapes]) await s3.putForTest(k, JPEG, ancientDate());
      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.deleted, 0);
      assert.equal(run.json.orphanObjects, 0);
      assert.equal(run.json.skippedBadKey, badShapes.length, "the ones under the prefix are counted");
      assert.equal(run.json.objectsListed, badShapes.length, "the others are not even listed");
      assert.deepEqual(s3.keys(), [...others, ...badShapes].sort(), "every object is still there");
    });

    it("does not delete an old orphan of the right shape in the same listing as the wrong-shaped ones", async () => {
      const hw = randomUUID();
      const st = randomUUID();
      const wrong = `homework-submissions/${hw}/${st}/${randomUUID()}.gif`;
      await s3.putForTest(wrong, JPEG, ancientDate());
      const orphan = await seedOrphan(oldDate());
      const run = await sweep();
      assert.equal(run.json.deleted, 1);
      assert.equal(run.json.skippedBadKey, 1);
      assert.deepEqual(s3.keys(), [wrong]);
      assert.equal(s3.body(orphan), undefined);
    });
  });

  describe("rows of archived homework", () => {
    it("removes the rows and the photos of an archived homework, a draft's too, and leaves a live homework alone", async () => {
      const archived = await mkHomework({ archived: true });
      const live = await mkHomework();
      const [a, b, c] = [await mkStudent(), await mkStudent(), await mkStudent()];
      const submittedKey = photoKey(archived, a);
      const draftKey = photoKey(archived, b);
      const liveKey = photoKey(live, c);
      // A just-uploaded photo (inside the grace period): it goes because its HOMEWORK is archived, not because it is old.
      await seedRow(archived, a, [submittedKey], { submitted: true });
      await seedRow(archived, b, [draftKey], { submitted: false });
      await seedRow(live, c, [liveKey]);
      // A homework whose ONLY row is a draft: nothing handed in, so nothing a teacher could ever see.
      const draftOnly = await mkHomework({ archived: true });
      const d = await mkStudent();
      const draftOnlyKey = photoKey(draftOnly, d);
      await seedRow(draftOnly, d, [draftOnlyKey], { submitted: false });

      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.archivedHomework, 2);
      assert.equal(run.json.rowsPurged, 3);
      assert.equal(run.json.deleted, 0, "phase 1 removed them, phase 2 had nothing left");
      assert.equal(await rowsOf(archived, draftOnly), 0, "no row is left, the drafts' included");
      assert.equal(await rowsOf(live), 1, "the live homework keeps its row");
      assert.deepEqual(s3.keys(), [liveKey], "only the live homework's photo is left");
    });

    it("removes the rows and photos of homework in an ARCHIVED CLASS, though the homework itself is not archived", async () => {
      const klass = await mkClass(true);
      const inArchivedClass = await mkHomework({ classId: klass });
      const liveClass = await mkClass(false);
      const inLiveClass = await mkHomework({ classId: liveClass });
      const [a, b] = [await mkStudent(), await mkStudent()];
      const gone = photoKey(inArchivedClass, a);
      const kept = photoKey(inLiveClass, b);
      await seedRow(inArchivedClass, a, [gone], { submitted: false });
      await seedRow(inLiveClass, b, [kept]);
      const hwRow = await db.pool.query(`SELECT archived_at FROM homework WHERE id = $1`, [inArchivedClass]);
      assert.equal(hwRow.rows[0].archived_at, null, "the premise: the homework is not archived, its class is");

      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.archivedHomework, 1);
      assert.equal(run.json.rowsPurged, 1);
      assert.equal(await rowsOf(inArchivedClass), 0);
      assert.equal(await rowsOf(inLiveClass), 1);
      assert.deepEqual(s3.keys(), [kept]);
    });

    it("finds a draft that a teacher's own identity cannot see, with row-level security enforced", async () => {
      const enforcing = await startServer({ databaseUrl: db.url, env: { INTERNAL_CRON_KEY: CRON_KEY, RLS_ENFORCE: "on", ...s3Env(s3) } });
      toClose.push(() => enforcing.stop());
      const archived = await mkHomework({ archived: true });
      const student = await mkStudent();
      const draftKey = photoKey(archived, student);
      await seedRow(archived, student, [draftKey], { submitted: false });
      const run = await sweep("", enforcing);
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.rowsPurged, 1);
      assert.equal(await rowsOf(archived), 0);
      assert.deepEqual(s3.keys(), []);
    });

    // A photo list that holds a non-photo (here `null`) makes purgeSubmissions throw before it deletes anything (the same
    // trick as homeworkSubmission.db.test.ts). The sweep must log it and carry on with the next homework.
    it("carries on when one homework cannot be purged: the others are purged, the bad one is left whole, and the answer is 200", async () => {
      const bad = await mkHomework({ archived: true });
      const good = await mkHomework({ archived: true });
      const [a, b] = [await mkStudent(), await mkStudent()];
      const badKey = photoKey(bad, a);
      const goodKey = photoKey(good, b);
      await seedRow(bad, a, [badKey], { lastModified: ancientDate() });
      await seedRow(good, b, [goodKey], { lastModified: ancientDate() });
      const realPhoto = { id: "p0", key: badKey, mime: "image/jpeg", sizeBytes: JPEG.length };
      await db.pool.query(`UPDATE homework_submissions SET photos = $2::jsonb WHERE homework_id = $1`, [bad, JSON.stringify([null, realPhoto])]);

      const run = await sweep();
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.archivedHomework, 1, "only the one that could be purged is counted");
      assert.equal(run.json.rowsPurged, 1);
      assert.equal(await rowsOf(good), 0, "the other archived homework was purged");
      assert.equal(await rowsOf(bad), 1, "the bad one's row is still there to be retried");
      assert.deepEqual(s3.keys(), [badKey], "and its photo, which the row still names, was not swept as an orphan");
    });
  });

  describe("a dry run", () => {
    it("reports what would go and changes nothing: no object, no row", async () => {
      const archived = await mkHomework({ archived: true });
      const live = await mkHomework();
      const [a, b] = [await mkStudent(), await mkStudent()];
      const archivedKey = photoKey(archived, a);
      const liveKey = photoKey(live, b);
      await seedRow(archived, a, [archivedKey]);
      await seedRow(live, b, [liveKey], { lastModified: ancientDate() });
      const orphan = await seedOrphan(oldDate());
      const young = await seedOrphan(youngDate());
      const before = s3.keys();

      for (const q of ["?dryRun=1", "?dryRun=true"]) {
        const run = await sweep(q);
        assert.equal(run.status, 200, run.text);
        assert.deepEqual(run.json, {
          dryRun: true,
          archivedHomework: 1,
          rowsPurged: 1,
          objectsListed: 4,
          referenced: 2,
          orphanObjects: 1,
          deleted: 0,
          skippedYoung: 1,
          skippedBadKey: 0,
          capped: 0,
          listTruncated: false,
          objectsSkipped: false,
          sample: [orphan],
        });
        assert.deepEqual(s3.keys(), before, `${q}: no object was deleted`);
        assert.equal(await rowsOf(archived), 1, `${q}: no row was deleted`);
        assert.equal(await rowsOf(live), 1);
        assert.ok(s3.body(young) && s3.body(orphan));
      }

      // The same data, not a dry run: now it goes (and the dry run's numbers were the real ones).
      const real = await sweep();
      assert.equal(real.json.dryRun, false);
      assert.equal(real.json.rowsPurged, 1);
      assert.equal(real.json.deleted, 1);
      assert.equal(await rowsOf(archived), 0);
      assert.equal(s3.body(orphan), undefined);
    });
  });

  describe("when R2 is not configured", () => {
    it("skips the object phase, says so, and still purges the rows of archived homework", async () => {
      const noR2 = await startServer({
        databaseUrl: db.url,
        env: { INTERNAL_CRON_KEY: CRON_KEY, R2_ENDPOINT: undefined, R2_ACCESS_KEY_ID: undefined, R2_SECRET_ACCESS_KEY: undefined, R2_FORCE_PATH_STYLE: undefined },
      });
      toClose.push(() => noR2.stop());
      const archived = await mkHomework({ archived: true });
      const live = await mkHomework();
      const [a, b] = [await mkStudent(), await mkStudent()];
      await seedRow(archived, a, [photoKey(archived, a)]);
      await seedRow(live, b, [photoKey(live, b)]);
      const orphan = await seedOrphan(ancientDate());
      const before = s3.keys();

      const run = await sweep("", noR2);
      assert.equal(run.status, 200, run.text);
      assert.equal(run.json.objectsSkipped, true);
      assert.equal(run.json.archivedHomework, 1);
      assert.equal(run.json.rowsPurged, 1);
      assert.equal(run.json.objectsListed, 0);
      assert.equal(run.json.deleted, 0);
      assert.equal(await rowsOf(archived), 0, "phase 1 ran");
      assert.equal(await rowsOf(live), 1);
      assert.deepEqual(s3.keys(), before, "the bucket was not reachable, so nothing in it changed");
      assert.ok(s3.body(orphan));
    });
  });
});
