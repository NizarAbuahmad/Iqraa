import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { JOIN_REQUEST_SCREEN, joinRequestData, joinRequestDelivery, joinRequestPushes, joinRequestText } from "../joinRequestText.ts";
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

  it("pushes only the first request of a burst in one class", () => {
    assert.equal(joinRequestPushes(0), true);
    assert.equal(joinRequestPushes(1), false);
    assert.equal(joinRequestPushes(29), false);
  });

  it("is silent at night, on the quiet channel, and rings by day", () => {
    const night = new Date("2026-11-23T20:30:00Z"); // 23:30 Amman
    const day = new Date("2026-11-23T08:00:00Z"); // 11:00 Amman
    assert.deepEqual(joinRequestDelivery(night, true), { channelId: "quiet", sound: null });
    assert.deepEqual(joinRequestDelivery(day, true), { channelId: "requests", sound: "default" });
    assert.deepEqual(joinRequestDelivery(night, false), { channelId: "requests", sound: "default" });
  });
});
