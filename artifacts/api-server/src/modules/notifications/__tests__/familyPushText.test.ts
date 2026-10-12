import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classLabel, examDateText, homeworkPostedText, pushDay, pushTime, TITLE_MAX } from "../familyPushText.ts";

const LONG = "حلّ تمارين الدرس الثاني من الوحدة الثالثة كاملةً مع التبرير ".repeat(4);
const titleFits = (t: string) => assert.ok([...t].length <= TITLE_MAX, `${[...t].length}: ${t}`);

describe("pushDay / pushTime", () => {
  it("prints a day as DD-MM-YYYY in a left-to-right isolate, by string only", () => {
    assert.equal(pushDay("2026-10-14"), "⁦14-10-2026⁩");
    assert.equal(pushDay("not a day"), "not a day");
    assert.equal(pushTime("09:30"), "⁦09:30⁩");
  });
});

describe("classLabel", () => {
  it("prefers the Arabic name and falls back to the other", () => {
    assert.equal(classLabel({ name: "10A maths", nameAr: "العاشر أ" }), "العاشر أ");
    assert.equal(classLabel({ name: "10A maths", nameAr: "  " }), "10A maths");
  });
});

describe("homeworkPostedText", () => {
  const t = homeworkPostedText({ title: "حل تمارين ص 45", className: "10A maths", dueDate: "2026-10-14" });
  it("tells a student what, where and when", () => {
    assert.equal(t.student.title, "واجب جديد: حل تمارين ص 45");
    assert.ok(t.student.body.includes("10A maths"));
    assert.ok(t.student.body.includes("⁦14-10-2026⁩"));
  });
  it("names the child first for a guardian", () => {
    assert.equal(t.guardian("سارة").title, "سارة: واجب جديد");
    assert.ok(t.guardian("سارة").body.includes("«حل تمارين ص 45»"));
    assert.equal(t.guardian("  ").title, "واجب جديد");
  });
  it("keeps every title within TITLE_MAX, however long the names", () => {
    const long = homeworkPostedText({ title: LONG, className: LONG, dueDate: "2026-10-14" });
    titleFits(long.student.title);
    titleFits(long.guardian(LONG).title);
  });
});

describe("examDateText", () => {
  const set = examDateText({ examTitle: "اختبار الوحدة الأولى", className: "10A maths", notice: { kind: "set", examDate: "2026-10-20", examTime: "09:30" } });
  it("tells the day and time, by string", () => {
    assert.equal(set.student.title, "موعد امتحان: اختبار الوحدة الأولى");
    assert.ok(set.student.body.includes("⁦20-10-2026⁩"));
    assert.ok(set.student.body.includes("⁦09:30⁩"));
    assert.equal(set.guardian("سارة").title, "سارة: موعد امتحان");
  });
  it("leaves the time out when there is none", () => {
    const noTime = examDateText({ examTitle: "x", className: "c", notice: { kind: "set", examDate: "2026-10-20", examTime: null } });
    assert.equal(noTime.student.body.includes("الساعة"), false);
  });
  it("says changed and cleared plainly", () => {
    const changed = examDateText({ examTitle: "x", className: "c", notice: { kind: "changed", examDate: "2026-10-21", examTime: null } });
    assert.equal(changed.student.title, "تغيّر موعد امتحان: x");
    assert.equal(changed.guardian("آدم").title, "آدم: تغيّر موعد امتحان");
    const cleared = examDateText({ examTitle: "x", className: "c", notice: { kind: "cleared", examDate: null, examTime: null } });
    assert.equal(cleared.student.title, "أُزيل موعد امتحان: x");
    assert.ok(cleared.student.body.includes("لم يعد له موعد محدّد"));
  });
  it("keeps every title within TITLE_MAX", () => {
    for (const kind of ["set", "changed"] as const) {
      const t = examDateText({ examTitle: LONG, className: LONG, notice: { kind, examDate: "2026-10-20", examTime: "09:30" } });
      titleFits(t.student.title);
      titleFits(t.guardian(LONG).title);
    }
    const cleared = examDateText({ examTitle: LONG, className: LONG, notice: { kind: "cleared", examDate: null, examTime: null } });
    titleFits(cleared.student.title);
    titleFits(cleared.guardian(LONG).title);
  });
});
