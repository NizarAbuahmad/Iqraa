import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JOIN_REQUEST_SCREEN, joinRequestData, joinRequestText } from "../joinRequestText.ts";
import { TITLE_MAX } from "../familyPushText.ts";

describe("the teacher's join-request push", () => {
  it("names the picked roster name and the class, and asks for approval", () => {
    const t = joinRequestText({ studentName: "أحمد علي", className: "العاشر أ" });
    assert.equal(t.title, "طلب انضمام جديد");
    assert.equal(t.body, "طلب باسم «أحمد علي» في العاشر أ — بانتظار موافقتك.");
  });

  it("still reads without a class name or a student name", () => {
    assert.equal(joinRequestText({ studentName: "سارة", className: "" }).body, "طلب باسم «سارة» — بانتظار موافقتك.");
    assert.equal(joinRequestText({ studentName: "  ", className: "٥أ" }).body, "طلب انضمام في ٥أ — بانتظار موافقتك.");
  });

  it("cuts a long name instead of letting it fill the shade", () => {
    const t = joinRequestText({ studentName: "س".repeat(200), className: "ص".repeat(200) });
    assert.ok([...t.title].length <= TITLE_MAX);
    assert.ok([...t.body].length < 120, `body is ${[...t.body].length} code points`);
    assert.match(t.body, /…/);
  });

  it("carries the class so a tap opens it", () => {
    assert.deepEqual(joinRequestData("cls-1"), { screen: JOIN_REQUEST_SCREEN, classGroupId: "cls-1" });
  });
});
