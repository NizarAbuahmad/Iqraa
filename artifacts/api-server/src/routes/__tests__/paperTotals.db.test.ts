/**
 * The class mark book over HTTP. What it must never do: let anyone but the
 * exam's teacher write, write a mark for a child outside the exam's class or
 * group, accept a mark above the paper's total, show a typed mark to a family
 * before the teacher releases results, or delete work a student made. And what
 * it must do: turn a typed total into a handed-in, final result.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

const RANDOM_UUID = "7c1f3a52-0d4e-4b8a-9c36-2e5f8a1b7d90";

describeDb("paper totals over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  const put = (userId: string | undefined, examId: string, body: unknown) =>
    call(on, "PUT", `/evaluations/${examId}/paper-totals`, userId, body);
  const totals = (...rows: Array<[string, number | string | null]>) => ({
    totals: rows.map(([studentId, marks]) => ({ studentId, marks })),
  });
  const count = async (sql: string, params: unknown[] = []) => (await db.pool.query(sql, params)).rows[0].n as number;
  const attemptsOn = (examId: string) => count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1`, [examId]);
  const paperRow = async (userId: string, studentId?: string) => {
    if (!studentId) {
      const r = await call(on, "GET", "/student/exams", userId);
      return (r.json.exams as any[]).find(e => e.title === EX_TITLES.exPaper);
    }
    const r = await call(on, "GET", "/parent/exams", userId);
    const child = (r.json.children as any[]).find(c => c.studentId === studentId);
    return child?.exams.find((e: any) => e.title === EX_TITLES.exPaper);
  };

  /** A roster row of t1's in class c1 (the exam's class), optionally archived. */
  const rosterRow = async (name: string, archived = false) => {
    const id = (
      await db.pool.query(
        `INSERT INTO students (teacher_id, display_name, archived_at) VALUES ($1, $2, CASE WHEN $3::boolean THEN now() END) RETURNING id`,
        [w.users.t1, name, archived],
      )
    ).rows[0].id as string;
    await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, id]);
    return id;
  };
  const sittingOf = async (examId: string, studentId: string) =>
    (await db.pool.query(`SELECT id, submitted_at FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [examId, studentId])).rows[0] as
      | { id: string; submitted_at: Date | null }
      | undefined;

  before(async () => {
    db = await setupTestDb();
    w = await seedFamilyWorld(db.pool);
    x = await seedExams(db.pool, w);
    on = await startServer({ databaseUrl: db.url });
  });
  after(async () => {
    await on?.stop();
    await db?.drop();
  });

  describe("who may call", () => {
    it("401 without a token; 403 for a parent and a student", async () => {
      const body = totals([w.students.sA1, 5]);
      assert.equal((await put(undefined, x.exams.exPaper, body)).status, 401);
      assert.equal((await put(w.users.parentA, x.exams.exPaper, body)).status, 403);
      assert.equal((await put(w.users.studentA, x.exams.exPaper, body)).status, 403);
      assert.equal(await attemptsOn(x.exams.exPaper), 1, "only Zain's seeded sitting");
    });

    it("404 alike for another teacher's exam, a missing id, a malformed id and an archived exam", async () => {
      const body = totals([w.students.sA1, 5]);
      const bodies = [
        await put(w.users.t2, x.exams.exPaper, body),
        await put(w.users.t1, RANDOM_UUID, body),
        await put(w.users.t1, "nope", body),
        await put(w.users.t1, x.exams.exPaperArchived, body),
      ];
      for (const r of bodies) {
        assert.equal(r.status, 404);
        assert.equal(r.text, bodies[0]!.text);
      }
      assert.deepEqual(bodies[0]!.json, { error: "Evaluation not found" });
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });
  });

  describe("which exams", () => {
    it("409 for a draft, an exam with no class, a two-question paper, a digital exam and an exam with no level scale", async () => {
      const body = totals([w.students.sA1, 5]);
      const draft = await put(w.users.t1, x.exams.exPaperDraft, body);
      assert.equal(draft.status, 409);
      assert.deepEqual(draft.json, { code: "not_published", error: "Publish this evaluation before entering marks" });
      assert.equal((await put(w.users.t1, x.exams.exPaperNoClass, body)).json.code, "no_class");
      assert.equal((await put(w.users.t1, x.exams.exPaperMulti, body)).json.code, "not_quick_paper");
      const digital = await put(w.users.t1, x.exams.exDated, body);
      assert.equal(digital.status, 409);
      assert.equal(digital.json.code, "not_quick_paper");
      const noScale = await put(w.users.t1, x.exams.exNoScale, body);
      assert.equal(noScale.status, 409);
      assert.equal(noScale.json.code, "no_level_scale");
      assert.equal(await attemptsOn(x.exams.exDated), 0);
      assert.equal(await attemptsOn(x.exams.exNoScale), 0);
    });

    it("400 for a malformed body, and nothing written", async () => {
      const many = Array.from({ length: 101 }, () => ({ studentId: randomUUID(), marks: 1 }));
      const cases: Array<[unknown, string]> = [
        [{}, "invalid_paper_totals"],
        [{ totals: [] }, "invalid_paper_totals"],
        [{ totals: many }, "too_many_rows"],
        [totals([w.students.sA1, 1], [w.students.sA1, 2]), "duplicate_student"],
        [{ totals: [{ studentId: "nope", marks: 1 }] }, "invalid_paper_totals"],
        [{ totals: [{ studentId: w.students.sA1 }] }, "invalid_paper_totals"],
        // A blank box is "no mark typed", never a zero: the whole body is refused.
        [totals([w.students.sA1, ""]), "invalid_paper_totals"],
      ];
      for (const [body, code] of cases) {
        const r = await put(w.users.t1, x.exams.exPaper, body);
        assert.equal(r.status, 400, JSON.stringify(body).slice(0, 80));
        assert.equal(r.json.code, code);
      }
      const dup = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 1], [w.students.sA1, 2]));
      assert.equal(dup.json.index, 1, "the second occurrence is the one named");
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });
  });

  // 56 of the 60 requests a minute are t1's across this file: a fresh bucket for each later group keeps the headroom from being a flake.
  const resetT1Bucket = () => db.pool.query(`DELETE FROM rate_limit_buckets WHERE key = $1`, [`paper-totals:${w.users.t1}`]);

  describe("per student", () => {
    before(resetT1Bucket);

    it("refuses, row by row, anyone who is not a live student of the exam's class", async () => {
      // nB1: t1's, but in c3. sA2: t2's row. aArch: t2's, archived. Then a stranger.
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.nB1, 5], [w.students.sA2, 5], [w.students.aArch, 5], [RANDOM_UUID, 5]));
      assert.equal(r.status, 200, on.logs().slice(-1500));
      assert.equal(r.json.results.length, 4, "one result per request row");
      for (const row of r.json.results) assert.deepEqual([row.status, row.code], ["error", "not_in_class"]);
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("refuses an archived student of the teacher's own, though the membership row is still there", async () => {
      const archived = await rosterRow("archived-own", true);
      const r = await put(w.users.t1, x.exams.exPaper, totals([archived, 5]));
      assert.deepEqual(r.json.results, [{ studentId: archived, status: "error", code: "not_in_class" }]);
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("refuses a student of another teacher even if a membership row puts them in this class", async () => {
      const stray = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'stray') RETURNING id`, [w.users.t2])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, stray]);
      const r = await put(w.users.t1, x.exams.exPaper, totals([stray, 5]));
      assert.deepEqual(r.json.results[0], { studentId: stray, status: "error", code: "not_in_class" });
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("refuses a mark outside 0..N, or not a number, for that row only, writing nothing", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 21]));
      assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "error", code: "marks_out_of_range" });
      const neg = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, -1]));
      assert.equal(neg.json.results[0].code, "marks_out_of_range");
      // The parser lets a non-blank string through; this layer decides it is not a mark.
      for (const bad of ["abc", "-1", "21", "20.01", "0x10", "1e1", "Infinity", "NaN", "١٥"]) {
        const row = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, bad]));
        assert.equal(row.status, 200, bad);
        assert.deepEqual(row.json.results[0], { studentId: w.students.sA1, status: "error", code: "marks_out_of_range" }, bad);
      }
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("reads a hostile mark string in constant time: the length cap comes before any regex", async () => {
      // 100k digits then a letter backtracked quadratically in the old pattern (seconds per row, 100 rows a request).
      const long = "1".repeat(100_000);
      for (const bad of [`${long}x`, long, `${long}.${long}`]) {
        const started = Date.now();
        const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, bad]));
        const took = Date.now() - started;
        assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "error", code: "marks_out_of_range" });
        // The old regex took ~4.8 s on ONE row, so 2 s still catches it and a slow CI box does not trip it.
        assert.ok(took < 2000, `took ${took} ms`);
      }
      // 100 such rows in one request: still one length read each.
      // They must be the teacher's own live students: the class check runs before the marks are read.
      const own = (
        await db.pool.query(
          `INSERT INTO students (teacher_id, display_name) SELECT $1, 'bulk-' || g FROM generate_series(1, 100) g RETURNING id`,
          [w.users.t1],
        )
      ).rows.map(r => r.id as string);
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) SELECT $1, unnest($2::uuid[])`, [w.classes.c1, own]);
      const started = Date.now();
      const many = await put(w.users.t1, x.exams.exPaper, { totals: own.map(studentId => ({ studentId, marks: `${long}x` })) });
      const took = Date.now() - started;
      assert.equal(many.status, 200);
      assert.equal(many.json.results.length, 100);
      for (const row of many.json.results) assert.equal(row.code, "marks_out_of_range");
      assert.ok(took < 6000, `100 hostile rows took ${took} ms`);
      assert.equal(await attemptsOn(x.exams.exPaper), 1);
    });

    it("the text cap is 16 characters: 16 are read by the numeric rules, 17 are refused unread", async () => {
      const capped = await rosterRow("cap");
      const at16 = "0000000000000015"; // 16 characters, the number 15
      const at17 = "00000000000000015"; // 17 characters, also 15 — refused only by the cap
      assert.equal(at16.length, 16);
      assert.equal(at17.length, 17);
      const refused = await put(w.users.t1, x.exams.exPaper, totals([capped, at17]));
      assert.deepEqual(refused.json.results[0], { studentId: capped, status: "error", code: "marks_out_of_range" });
      assert.equal(await sittingOf(x.exams.exPaper, capped), undefined);
      const read = await put(w.users.t1, x.exams.exPaper, totals([capped, at16]));
      assert.deepEqual(read.json.results[0], { studentId: capped, status: "saved", marks: 15 });
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([capped, null]))).json.results[0].status, "cleared");
    });

    it("turns a typed total into a handed-in, final result that families see only after release", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 15]));
      assert.deepEqual(r.json, { maxMarks: 20, results: [{ studentId: w.students.sA1, status: "saved", marks: 15 }] });
      const row = (
        await db.pool.query(
          `SELECT a.source, a.entered_by, a.submitted_at, r.earned_marks, r.total_marks, r.percent, r.is_provisional
             FROM attempts a JOIN attempt_results r ON r.attempt_id = a.id
            WHERE a.evaluation_id = $1 AND a.student_id = $2`,
          [x.exams.exPaper, w.students.sA1],
        )
      ).rows[0];
      assert.equal(row.source, "teacher_entry");
      assert.equal(row.entered_by, w.users.t1);
      assert.ok(row.submitted_at, "handed in, or no family could ever see it");
      assert.deepEqual([row.earned_marks, row.total_marks, row.percent, row.is_provisional], ["15.00", "20.00", "75.00", false]);

      // Not released yet: the student and the parent see «سُلِّم — بانتظار النتيجة», no mark.
      for (const seen of [await paperRow(w.users.studentA), await paperRow(w.users.parentA, w.students.sA1)]) {
        assert.equal(seen.state, "submitted");
        assert.equal(seen.result, null);
      }

      const rel = await call(on, "POST", `/evaluations/${x.exams.exPaper}/results-release`, w.users.t1, { released: true });
      assert.equal(rel.status, 200);

      for (const seen of [await paperRow(w.users.studentA), await paperRow(w.users.parentA, w.students.sA1)]) {
        assert.equal(seen.state, "result");
        assert.equal(seen.result.earnedMarks, 15);
        assert.equal(seen.result.percent, 75);
      }
      // Adam, same parent and class, has no mark yet: still "paper", never Sara's.
      const adam = await paperRow(w.users.parentA, w.students.aA);
      assert.equal(adam.state, "paper");
      assert.equal(adam.result, null);
      assert.equal((await call(on, "GET", "/parent/exams", w.users.parentB)).text.includes(EX_TITLES.exPaper), false);
    });

    it("re-saving the same mark changes nothing; a new mark is audited once", async () => {
      const before = (await db.pool.query(`SELECT submitted_at FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.sA1])).rows[0].submitted_at as Date;
      const same = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, "15"]));
      assert.equal(same.json.results[0].status, "unchanged");
      assert.equal(await count(`SELECT count(*)::int AS n FROM grade_overrides`), 0);
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.sA1]), 1);

      const changed = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, "16.5"]));
      assert.deepEqual(changed.json.results[0], { studentId: w.students.sA1, status: "saved", marks: 16.5 });
      const audit = (await db.pool.query(`SELECT old_marks, new_marks FROM grade_overrides`)).rows;
      assert.deepEqual(audit, [{ old_marks: "15.00", new_marks: "16.50" }]);
      const after = (await db.pool.query(
        `SELECT a.submitted_at, r.earned_marks, r.percent FROM attempts a JOIN attempt_results r ON r.attempt_id = a.id WHERE a.evaluation_id = $1 AND a.student_id = $2`,
        [x.exams.exPaper, w.students.sA1],
      )).rows[0];
      assert.equal(after.submitted_at.getTime(), before.getTime(), "the first hand-in time stands");
      assert.deepEqual([after.earned_marks, after.percent], ["16.50", "82.50"]);
    });

    it("repairs a handed-in sitting whose result is missing, stale or provisional instead of calling it unchanged", async () => {
      const stale = await rosterRow("stale");
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([stale, 12]))).json.results[0].status, "saved");
      const sitting = (await sittingOf(x.exams.exPaper, stale))!;
      const result = () => db.pool.query(`SELECT earned_marks, is_provisional FROM attempt_results WHERE attempt_id = $1`, [sitting.id]);
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([stale, 12]))).json.results[0].status, "unchanged");

      // A request that died after the hand-in and before the result: grade written, submitted_at set, no result row.
      await db.pool.query(`DELETE FROM attempt_results WHERE attempt_id = $1`, [sitting.id]);
      const missing = await put(w.users.t1, x.exams.exPaper, totals([stale, 12]));
      assert.deepEqual(missing.json.results[0], { studentId: stale, status: "saved", marks: 12 });
      assert.deepEqual((await result()).rows, [{ earned_marks: "12.00", is_provisional: false }]);

      await db.pool.query(`UPDATE attempt_results SET earned_marks = 3 WHERE attempt_id = $1`, [sitting.id]);
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([stale, 12]))).json.results[0].status, "saved");
      assert.deepEqual((await result()).rows, [{ earned_marks: "12.00", is_provisional: false }]);

      await db.pool.query(`UPDATE attempt_results SET is_provisional = true WHERE attempt_id = $1`, [sitting.id]);
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([stale, 12]))).json.results[0].status, "saved");
      assert.deepEqual((await result()).rows, [{ earned_marks: "12.00", is_provisional: false }]);
      assert.equal((await sittingOf(x.exams.exPaper, stale))!.submitted_at?.getTime(), sitting.submitted_at?.getTime(), "the hand-in time stands");
      assert.equal(await count(`SELECT count(*)::int AS n FROM grade_overrides WHERE attempt_id = $1`, [sitting.id]), 0);
    });

    it("rounds a fraction beyond two decimals the way a single mark is rounded", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, "16.504"]));
      assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "unchanged", marks: 16.5 });
    });

    it("saves the good rows of a mixed batch and reports the bad one", async () => {
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, 10], [w.students.nB1, 5]));
      assert.deepEqual(r.json.results, [
        { studentId: w.students.aA, status: "saved", marks: 10 },
        { studentId: w.students.nB1, status: "error", code: "not_in_class" },
      ]);
    });

    it("null clears a typed paper, and refuses to clear a student's own work", async () => {
      const cleared = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, null]));
      assert.deepEqual(cleared.json.results[0], { studentId: w.students.aA, status: "cleared", marks: null });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.aA]), 0);
      assert.equal((await paperRow(w.users.parentA, w.students.aA)).state, "paper");
      const again = await put(w.users.t1, x.exams.exPaper, totals([w.students.aA, null]));
      assert.equal(again.json.results[0].status, "cleared", "clearing nothing is still cleared");
      const zain = await put(w.users.t1, x.exams.exPaper, totals([x.zain, null]));
      assert.deepEqual(zain.json.results[0], { studentId: x.zain, status: "error", code: "kept_student_work" });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE id = $1`, [x.attempts.zainPaper]), 1);
    });

    it("keeps a teacher-entry sitting that holds an answer: clearing it is not the grid's to do", async () => {
      const answered = await rosterRow("answered");
      assert.equal((await put(w.users.t1, x.exams.exPaper, totals([answered, 4]))).json.results[0].status, "saved");
      const sitting = (await sittingOf(x.exams.exPaper, answered))!;
      await db.pool.query(`INSERT INTO attempt_answers (attempt_id, question_id, response) VALUES ($1, $2, '{"text":"typed in"}'::jsonb)`, [sitting.id, x.questions.exPaper]);
      const r = await put(w.users.t1, x.exams.exPaper, totals([answered, null]));
      assert.deepEqual(r.json.results[0], { studentId: answered, status: "error", code: "kept_student_work" });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE id = $1`, [sitting.id]), 1);
    });

    it("keeps a group check to its group", async () => {
      const r = await put(w.users.t1, x.exams.exGroup, totals([w.students.sA1, 5], [w.students.aA, 5]));
      assert.deepEqual(r.json.results, [
        { studentId: w.students.sA1, status: "error", code: "not_in_group" },
        { studentId: w.students.aA, status: "saved", marks: 5 },
      ]);
    });

    it("a row that fails is reported as failed and does not stop the rows around it", async () => {
      // A sitting frozen without a level scale cannot be handed in: gradeSubmission refuses it.
      const broken = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'broken') RETURNING id`, [w.users.t1])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, broken]);
      const q = (await db.pool.query(`SELECT id, type, body, expected_answer, objective_id, competency_key, marks, difficulty, grading_mode FROM evaluation_questions WHERE id = $1`, [x.questions.exPaper])).rows[0];
      const snapshot = [{ id: q.id, type: q.type, body: q.body, expectedAnswer: q.expected_answer, objectiveId: q.objective_id, competencyKey: q.competency_key, marks: q.marks, difficulty: q.difficulty, gradingMode: q.grading_mode }];
      await db.pool.query(
        `INSERT INTO attempts (evaluation_id, student_id, source, entered_by, status, started_at, question_snapshot, level_scale_snapshot)
         VALUES ($1, $2, 'teacher_entry', $3, 'in_progress', now(), $4::jsonb, '{"bands":[]}'::jsonb)`,
        [x.exams.exPaper, broken, w.users.t1, JSON.stringify(snapshot)],
      );
      // And one whose write throws outright (a frozen question that is not a row of this exam).
      const thrown = (await db.pool.query(`INSERT INTO students (teacher_id, display_name) VALUES ($1, 'thrown') RETURNING id`, [w.users.t1])).rows[0].id as string;
      await db.pool.query(`INSERT INTO class_memberships (class_group_id, student_id) VALUES ($1, $2)`, [w.classes.c1, thrown]);
      await db.pool.query(
        `INSERT INTO attempts (evaluation_id, student_id, source, entered_by, status, started_at, question_snapshot, level_scale_snapshot)
         VALUES ($1, $2, 'teacher_entry', $3, 'in_progress', now(), $4::jsonb, '{"bands":[]}'::jsonb)`,
        [x.exams.exPaper, thrown, w.users.t1, JSON.stringify([{ ...snapshot[0], id: randomUUID() }])],
      );
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 18], [broken, 7], [thrown, 7], [w.students.aA, 9]));
      assert.equal(r.status, 200, on.logs().slice(-1500));
      assert.deepEqual(r.json.results, [
        { studentId: w.students.sA1, status: "saved", marks: 18 },
        { studentId: broken, status: "error", code: "failed" },
        { studentId: thrown, status: "error", code: "failed" },
        { studentId: w.students.aA, status: "saved", marks: 9 },
      ]);
    });
  });

  describe("after the sitting", () => {
    before(resetT1Bucket);

    it("accepts a closed exam: a teacher may close the paper, then type the totals", async () => {
      await db.pool.query(`UPDATE evaluations SET status = 'closed', closed_at = now() WHERE id = $1`, [x.exams.exPaper]);
      try {
        const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, 19]));
        assert.equal(r.status, 200, on.logs().slice(-1500));
        assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "saved", marks: 19 });
      } finally {
        await db.pool.query(`UPDATE evaluations SET status = 'published', closed_at = NULL WHERE id = $1`, [x.exams.exPaper]);
      }
    });

    it("clearing a released teacher-entered mark deletes it, with its audit rows (accepted, and confirmed in the app)", async () => {
      const sitting = (await db.pool.query(`SELECT id FROM attempts WHERE evaluation_id = $1 AND student_id = $2`, [x.exams.exPaper, w.students.sA1])).rows[0].id as string;
      assert.ok(await count(`SELECT count(*)::int AS n FROM grade_overrides WHERE attempt_id = $1`, [sitting]) > 0);
      const r = await put(w.users.t1, x.exams.exPaper, totals([w.students.sA1, null]));
      assert.deepEqual(r.json.results[0], { studentId: w.students.sA1, status: "cleared", marks: null });
      assert.equal(await count(`SELECT count(*)::int AS n FROM attempts WHERE id = $1`, [sitting]), 0);
      assert.equal(await count(`SELECT count(*)::int AS n FROM grade_overrides WHERE attempt_id = $1`, [sitting]), 0);
    });
  });

  describe("rate limit", () => {
    it("allows 60 requests a minute per teacher, then 429", async () => {
      // Another teacher's bucket, emptied first so the one call above is not counted; each answers 404 cheaply.
      await db.pool.query(`DELETE FROM rate_limit_buckets WHERE key = $1`, [`paper-totals:${w.users.t2}`]);
      for (let i = 0; i < 60; i++) {
        assert.equal((await put(w.users.t2, RANDOM_UUID, totals([w.students.sA1, 1]))).status, 404, `request ${i + 1}`);
      }
      assert.equal((await put(w.users.t2, RANDOM_UUID, totals([w.students.sA1, 1]))).status, 429);
    });
  });
});
