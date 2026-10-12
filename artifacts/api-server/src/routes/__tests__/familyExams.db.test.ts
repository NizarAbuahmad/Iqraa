/**
 * What this guards: the exam lists a student and a parent read. The ways it goes
 * wrong are all leaks — a date bringing a draft with it, an exam with no class
 * reaching somebody, another family's exam, a parent being handed the child's
 * link, a paper exam offering «ابدأ», and a mark showing before the teacher
 * released it or on the wrong child.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { call } from "../../test-support/http.ts";
import { CHILDREN, seedFamilyWorld, type FamilyWorld } from "../../test-support/seedFamilies.ts";
import { EX_TITLES, seedExams, type ExamWorld } from "../../test-support/seedExams.ts";

interface Row {
  evaluationId: string;
  title: string;
  state: string;
  shareCode: string | null;
  examDate: string | null;
  examTime: string | null;
  paper: boolean;
  deadlineAt: string | null;
  result: { earnedMarks: number; percent: number } | null;
}
interface ChildRows {
  key: string;
  studentId: string;
  displayName: string;
  exams: Row[];
}

describeDb("family exam lists over HTTP, against a real database", () => {
  let db: TestDb;
  let on: TestServer;
  let w: FamilyWorld;
  let x: ExamWorld;

  const studentList = async (userId: string) => {
    const r = await call(on, "GET", "/student/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, exams: r.json.exams as Row[] };
  };
  const parentList = async (userId: string) => {
    const r = await call(on, "GET", "/parent/exams", userId);
    assert.equal(r.status, 200, on.logs().slice(-1500));
    return { text: r.text, children: r.json.children as ChildRows[] };
  };
  const find = (rows: Row[], title: string): Row => {
    const row = rows.find(r => r.title === title);
    assert.ok(row, `expected ${title} to be listed`);
    return row;
  };
  const allTexts = async () => [
    (await studentList(w.users.studentA)).text,
    (await studentList(w.users.studentB)).text,
    (await parentList(w.users.parentA)).text,
    (await parentList(w.users.parentB)).text,
  ];

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

  it("carries each exam's planned day and time", async () => {
    const { exams } = await studentList(w.users.studentA);
    const dated = find(exams, EX_TITLES.exDated);
    assert.equal(dated.examDate, x.dates.exDated);
    assert.equal(dated.examTime, "09:30");
    assert.equal(dated.paper, false);
    assert.equal(dated.state, "available");
    assert.equal(dated.shareCode, "EXDAT1");
    const undated = find(exams, EX_TITLES.exPaperMulti);
    assert.equal(undated.examDate, null);
    assert.equal(undated.examTime, null);
  });

  it("never lists a dated draft, to anyone", async () => {
    for (const text of await allTexts()) assert.equal(text.includes(EX_TITLES.exDraftDated), false);
  });

  it("never lists a dated exam that has no class, to anyone", async () => {
    for (const text of await allTexts()) assert.equal(text.includes(EX_TITLES.exNoClass), false);
  });

  it("keeps each family to its own classes", async () => {
    const studentB = await studentList(w.users.studentB);
    find(studentB.exams, EX_TITLES.exC3);
    assert.equal(studentB.text.includes(EX_TITLES.exDated), false);
    const parentB = await parentList(w.users.parentB);
    const noor = parentB.children.find(c => c.studentId === w.students.nB1);
    assert.ok(noor);
    find(noor.exams, EX_TITLES.exC3);
    assert.equal((await studentList(w.users.studentA)).text.includes(EX_TITLES.exC3), false);
    assert.equal((await parentList(w.users.parentA)).text.includes(EX_TITLES.exC3), false);
  });

  it("never hands a parent a link", async () => {
    for (const parent of [w.users.parentA, w.users.parentB]) {
      const { children } = await parentList(parent);
      const rows = children.flatMap(c => c.exams);
      assert.ok(rows.length > 0);
      for (const r of rows) assert.equal(r.shareCode, null, `${r.title} carried a link for a parent`);
    }
  });

  it("offers no link and no Start on a paper exam", async () => {
    const { exams } = await studentList(w.users.studentA);
    const quick = find(exams, EX_TITLES.exPaper);
    assert.equal(quick.state, "paper");
    assert.equal(quick.shareCode, null);
    assert.equal(quick.paper, true);
    assert.equal(quick.deadlineAt, null);
    assert.equal(quick.examDate, x.dates.exPaper);
    assert.equal(quick.examTime, "08:00");
    assert.equal(find(exams, EX_TITLES.exPaperMulti).state, "paper");
    // Closed (and archived from the teacher's list): still "paper", never «مُغلق», never a link.
    const closed = find(exams, EX_TITLES.exPaperArchived);
    assert.equal(closed.state, "paper");
    assert.equal(closed.shareCode, null);
  });

  it("shows a mark only once released, and only on the child who sat", async () => {
    const { exams } = await studentList(w.users.studentA);
    const waiting = find(exams, EX_TITLES.exUnreleased);
    assert.equal(waiting.state, "submitted");
    assert.equal(waiting.result, null);
    const shown = find(exams, EX_TITLES.exReleased);
    assert.equal(shown.state, "result");
    assert.equal(shown.result?.earnedMarks, 8);
    assert.equal(shown.result?.percent, 80);

    const { children } = await parentList(w.users.parentA);
    const sara = children.find(c => c.studentId === w.students.sA1);
    const adam = children.find(c => c.studentId === w.students.aA);
    assert.ok(sara && adam);
    assert.equal(find(sara.exams, EX_TITLES.exReleased).result?.earnedMarks, 8);
    assert.equal(find(sara.exams, EX_TITLES.exUnreleased).result, null);
    // Adam handed in too, but his paper is still provisional: no mark, and never Sara's.
    const adamRow = find(adam.exams, EX_TITLES.exReleased);
    assert.equal(adamRow.state, "submitted");
    assert.equal(adamRow.result, null);

    for (const text of [(await parentList(w.users.parentB)).text, (await studentList(w.users.studentB)).text]) {
      assert.equal(text.includes(EX_TITLES.exReleased), false);
    }
  });

  it("labels each parent entry with the same child key as the homework list", async () => {
    const exams = (await parentList(w.users.parentA)).children;
    const hw = await call(on, "GET", "/parent/homework", w.users.parentA);
    assert.equal(hw.status, 200);
    const hwKey = (name: string) => (hw.json.children as { key: string; displayName: string }[]).find(c => c.displayName === name)?.key;
    const saraKey = hwKey(CHILDREN.sara);
    assert.ok(saraKey);
    for (const row of [w.students.sA1, w.students.sA2]) {
      assert.equal(exams.find(c => c.studentId === row)?.key, saraKey, "both of Sara's rows are one child");
    }
    assert.equal(exams.find(c => c.studentId === w.students.aA)?.key, hwKey(CHILDREN.adam));
  });
});
