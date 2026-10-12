/**
 * What this guards: `GET /exam-calendar` is the only place one teacher's data
 * reaches another teacher. The contract is date, time, grade, subject, class
 * name and the colleague's name — never the exam's title, id or content. A
 * regression here is a privacy leak that no screen would reveal (the UI simply
 * would not render the extra field), so the redaction is pinned on the object
 * the API serialises, not on what a screen shows.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { buildCalendarEntries, type CalendarRow } from "../examCalendar.ts";

const ME = "teacher-me";
const COLLEAGUE = "teacher-other";

function row(over: Partial<CalendarRow> & { id: string }): CalendarRow {
  return {
    teacherId: ME,
    teacherName: "Me Myself",
    title: "Quiz 1",
    titleAr: "اختبار ١",
    examDate: "2026-10-12",
    examTime: null,
    gradeId: "grade-10",
    subjectId: "mathematics",
    className: "10A",
    classNameAr: "العاشر أ",
    status: "published",
    archivedAt: null,
    ...over,
  };
}

describe("buildCalendarEntries", () => {
  it("shows a teacher their own exam in full", () => {
    const [entry] = buildCalendarEntries([row({ id: "e1" })], ME);
    assert.equal(entry!.own, true);
    assert.equal(entry!.id, "e1");
    assert.equal(entry!.title, "Quiz 1");
    assert.equal(entry!.titleAr, "اختبار ١");
  });

  it("gives a colleague's exam only date, time, grade, subject, class and teacher name", () => {
    const [entry] = buildCalendarEntries(
      [row({ id: "e2", teacherId: COLLEAGUE, teacherName: "Sami K", examTime: "09:30" })],
      ME,
    );
    assert.deepEqual(entry, {
      own: false,
      examDate: "2026-10-12",
      examTime: "09:30",
      gradeId: "grade-10",
      subjectId: "mathematics",
      className: "10A",
      classNameAr: "العاشر أ",
      teacherName: "Sami K",
      clash: false,
    });
  });

  it("never carries a colleague's id or title under any key", () => {
    const [entry] = buildCalendarEntries(
      [row({ id: "secret-id", teacherId: COLLEAGUE, title: "Secret midterm" })],
      ME,
    );
    const text = JSON.stringify(entry);
    assert.equal(text.includes("secret-id"), false);
    assert.equal(text.includes("Secret midterm"), false);
  });

  it("does not put the viewer's own name on their own exams", () => {
    const [entry] = buildCalendarEntries([row({ id: "e1" })], ME);
    assert.equal("teacherName" in entry!, false);
  });

  it("marks both sides of a same-grade same-day clash", () => {
    const entries = buildCalendarEntries(
      [row({ id: "a" }), row({ id: "b", teacherId: COLLEAGUE, teacherName: "Sami K" })],
      ME,
    );
    assert.deepEqual(entries.map(e => e.clash), [true, true]);
  });

  it("does not mark a different grade on the same day", () => {
    const entries = buildCalendarEntries(
      [row({ id: "a" }), row({ id: "b", teacherId: COLLEAGUE, gradeId: "grade-9" })],
      ME,
    );
    assert.deepEqual(entries.map(e => e.clash), [false, false]);
  });

  it("leaves out closed, archived and undated exams", () => {
    const entries = buildCalendarEntries(
      [
        row({ id: "a" }),
        row({ id: "b", status: "closed" }),
        row({ id: "c", archivedAt: new Date("2026-09-01") }),
        row({ id: "d", examDate: null }),
      ],
      ME,
    );
    assert.equal(entries.length, 1);
  });

  it("orders by date, then time with untimed exams last, then the viewer's own first", () => {
    const entries = buildCalendarEntries(
      [
        row({ id: "late-day", examDate: "2026-10-14" }),
        row({ id: "untimed", examDate: "2026-10-12", examTime: null, teacherId: COLLEAGUE, className: "untimed" }),
        row({ id: "afternoon", examDate: "2026-10-12", examTime: "13:00", teacherId: COLLEAGUE, className: "afternoon" }),
        row({ id: "morning", examDate: "2026-10-12", examTime: "08:00", className: "morning" }),
      ],
      ME,
    );
    assert.deepEqual(
      entries.map(e => `${e.examDate} ${e.className}`),
      ["2026-10-12 morning", "2026-10-12 afternoon", "2026-10-12 untimed", "2026-10-14 10A"],
    );
  });
});
