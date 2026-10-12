import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { classLabel, homeworkPostedText, pushDay, pushTime, TITLE_MAX } from "../familyPushText.ts";

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
