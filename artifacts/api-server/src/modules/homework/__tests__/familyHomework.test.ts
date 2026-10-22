import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildFamilyHomework,
  type CompletionRow, type ExamRow, type HomeworkRow, type MembershipRow, type TeacherRow,
} from "../familyHomework.ts";

const NOW = new Date("2026-10-12T09:00:00Z");
const C1 = "c1";
const C2 = "c2";
const T1 = "t1";

const hw = (over: Partial<HomeworkRow> = {}): HomeworkRow => ({
  id: "h1", classGroupId: C1, title: "واجب", instructions: "حل", dueAt: new Date("2026-10-14T20:59:59.999Z"),
  evaluationId: null, ...over,
});
const member = (over: Partial<MembershipRow> = {}): MembershipRow => ({
  classGroupId: C1, studentId: "s1", className: "العاشر أ", teacherId: T1, ...over,
});
const done = (over: Partial<CompletionRow> = {}): CompletionRow => ({
  homeworkId: "h1", studentId: "s1", doneAt: new Date("2026-10-11T10:00:00Z"), ...over,
});
const teacher: TeacherRow = { id: T1, firstName: "سارة", lastName: "الخطيب" };
const exam = (over: Partial<ExamRow> = {}): ExamRow => ({ id: "e1", title: "Quiz", titleAr: "اختبار", status: "published", archivedAt: null, classGroupId: C1, ...over });

function build(over: Partial<Parameters<typeof buildFamilyHomework>[0]> = {}) {
  return buildFamilyHomework({
    homework: [hw()], memberships: [member()], completions: [], teachers: [teacher], exams: [], now: NOW,
    withAccount: new Set(["s1"]), ...over,
  });
}

describe("buildFamilyHomework", () => {
  it("1. drops homework whose class is not among the memberships", () => {
    const out = build({ homework: [hw(), hw({ id: "h2", classGroupId: C2 })] });
    assert.deepEqual(out.map((i) => i.id), ["h1"]);
  });

  it("2. counts a completion only by a roster row that is a member of the homework's class", () => {
    const memberships = [member(), member({ classGroupId: C2, studentId: "s2", className: "العاشر ب" })];
    // s2 is the same child in another class; sX is not in memberships at all.
    const other = build({ memberships, completions: [done({ studentId: "s2" }), done({ studentId: "sX" })] });
    assert.equal(other[0]!.done, false);
    assert.equal(other[0]!.state, "open");
    // any one roster row of the class is enough
    const two = build({
      memberships: [member(), member({ studentId: "s1b" })],
      completions: [done({ studentId: "s1b" })],
    });
    assert.equal(two[0]!.done, true);
    // a completion for a different homework does not count
    assert.equal(build({ completions: [done({ homeworkId: "other" })] })[0]!.done, false);
  });

  it("3. doneAt is the earliest matching completion, null when not done", () => {
    const out = build({
      memberships: [member(), member({ studentId: "s1b" })],
      completions: [
        done({ studentId: "s1b", doneAt: new Date("2026-10-10T08:00:00Z") }),
        done({ studentId: "s1", doneAt: new Date("2026-10-11T10:00:00Z") }),
        done({ studentId: "sX", doneAt: new Date("2026-10-01T00:00:00Z") }),
      ],
    });
    assert.equal(out[0]!.doneAt, "2026-10-10T08:00:00.000Z");
    assert.equal(build()[0]!.doneAt, null);
  });

  it("4. state comes from homeworkState with the passed now", () => {
    assert.equal(build()[0]!.state, "open");
    assert.equal(build({ now: new Date("2026-10-14T21:00:00Z") })[0]!.state, "overdue");
    assert.equal(build({ now: new Date("2026-10-14T21:00:00Z"), completions: [done()] })[0]!.state, "done");
  });

  it("5. teacherName is 'first last' trimmed, '' when the teacher is missing; className from the membership", () => {
    const [a] = build();
    assert.equal(a!.teacherName, "سارة الخطيب");
    assert.equal(a!.className, "العاشر أ");
    assert.equal(build({ teachers: [{ id: T1, firstName: "سارة", lastName: "" }] })[0]!.teacherName, "سارة");
    assert.equal(build({ teachers: [] })[0]!.teacherName, "");
  });

  it("5b. takes className and teacher from the homework's own class, not the first membership", () => {
    const T2 = "t2";
    const out = build({
      // C1's membership is listed first; the first homework belongs to C2.
      memberships: [
        member({ classGroupId: C1, studentId: "s1", className: "العاشر أ", teacherId: T1 }),
        member({ classGroupId: C2, studentId: "s2", className: "العاشر ب", teacherId: T2 }),
      ],
      teachers: [teacher, { id: T2, firstName: "ليلى", lastName: "حداد" }],
      homework: [
        hw({ id: "hc2", classGroupId: C2, dueAt: new Date("2026-10-13T20:59:59.999Z") }),
        hw({ id: "hc1", classGroupId: C1, dueAt: new Date("2026-10-14T20:59:59.999Z") }),
      ],
    });
    const byId = new Map(out.map((i) => [i.id, i]));
    assert.equal(byId.get("hc2")!.className, "العاشر ب");
    assert.equal(byId.get("hc2")!.teacherName, "ليلى حداد");
    assert.equal(byId.get("hc1")!.className, "العاشر أ");
    assert.equal(byId.get("hc1")!.teacherName, "سارة الخطيب");
  });

  it("6. exam is {title: titleAr || title} only when published", () => {
    const withExam = (e: ExamRow[], evaluationId: string | null = "e1") =>
      build({ homework: [hw({ evaluationId })], exams: e })[0]!.exam;
    assert.deepEqual(withExam([exam()]), { title: "اختبار" });
    assert.deepEqual(withExam([exam({ titleAr: "" })]), { title: "Quiz" });
    assert.equal(withExam([exam({ status: "draft" })]), null);
    assert.equal(withExam([exam({ status: "closed" })]), null);
    assert.equal(withExam([]), null);
    assert.equal(withExam([exam()], null), null);
  });

  it("6b. a published exam is shown only while it is live and in the homework's own class", () => {
    const withExam = (e: ExamRow) => build({ homework: [hw({ evaluationId: "e1" })], exams: [e] })[0]!.exam;
    assert.deepEqual(withExam(exam()), { title: "اختبار" });
    assert.equal(withExam(exam({ archivedAt: new Date("2026-10-01T00:00:00Z") })), null, "archived");
    assert.equal(withExam(exam({ classGroupId: C2 })), null, "another class");
    assert.equal(withExam(exam({ classGroupId: null })), null, "no class");
  });

  it("7. sorts not-done by dueAt then Arabic title, with done items last by dueAt", () => {
    const d = (day: string) => new Date(`${day}T20:59:59.999Z`);
    const out = build({
      homework: [
        hw({ id: "done-late", dueAt: d("2026-10-20") }),
        hw({ id: "done-early", dueAt: d("2026-10-13") }),
        hw({ id: "open-b", title: "ب", dueAt: d("2026-10-15") }),
        hw({ id: "open-a", title: "أ", dueAt: d("2026-10-15") }),
        hw({ id: "open-soon", title: "ي", dueAt: d("2026-10-14") }),
      ],
      completions: [done({ homeworkId: "done-late" }), done({ homeworkId: "done-early" })],
    });
    assert.deepEqual(out.map((i) => i.id), ["open-soon", "open-a", "open-b", "done-early", "done-late"]);
  });

  it("9. canTrack is per item: true only when a row of the child IN THAT ITEM'S CLASS has a student account", () => {
    // One child, two classes: s1 (c1) has an account, s2 (c2) has none.
    const out = build({
      memberships: [member(), member({ classGroupId: C2, studentId: "s2", className: "العاشر ب" })],
      homework: [hw({ id: "hc1", classGroupId: C1 }), hw({ id: "hc2", classGroupId: C2 })],
      withAccount: new Set(["s1"]),
    });
    const byId = new Map(out.map((i) => [i.id, i]));
    assert.equal(byId.get("hc1")!.canTrack, true);
    assert.equal(byId.get("hc2")!.canTrack, false, "the c2 row has no account, so nobody can tick c2 homework");
  });

  it("9b. canTrack: any one account-holding row of the class is enough; an account on a row outside the class does not count", () => {
    const two = build({
      memberships: [member(), member({ studentId: "s1b" })],
      withAccount: new Set(["s1b"]),
    });
    assert.equal(two[0]!.canTrack, true);
    // sOther has an account but is not a member of C1.
    assert.equal(build({ withAccount: new Set(["sOther"]) })[0]!.canTrack, false);
    assert.equal(build({ withAccount: new Set() })[0]!.canTrack, false);
  });

  it("9c. an untracked item is not 'late' by the builder's own say-so: state is unchanged, the flag is what tells a client", () => {
    const [i] = build({ now: new Date("2026-10-14T21:00:00Z"), withAccount: new Set() });
    assert.equal(i!.canTrack, false);
    assert.equal(i!.state, "overdue");
  });

  it("8. exposes no ids that name other people's rows", () => {
    const keys = Object.keys(build({ homework: [hw({ evaluationId: "e1" })], exams: [exam()], completions: [done()] })[0]!);
    for (const banned of ["teacherId", "classGroupId", "studentId", "evaluationId"]) {
      assert.equal(keys.includes(banned), false, banned);
    }
    assert.deepEqual(keys.sort(), [
      "canTrack", "className", "done", "doneAt", "dueAt", "dueDate", "exam", "gameResults", "id", "instructions", "resources", "state", "teacherName", "title",
    ]);
  });
});
