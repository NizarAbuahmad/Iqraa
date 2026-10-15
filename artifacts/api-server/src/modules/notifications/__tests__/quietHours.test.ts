import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { ammanHour, familyDelivery, isQuietHour, quietHoursEnabled } from "../quietHours.ts";

describe("isQuietHour (22:00–07:00 Asia/Amman, a fixed UTC+3)", () => {
  it("starts at 22:00 Amman", () => {
    assert.equal(isQuietHour(new Date("2026-10-14T18:59:59Z")), false); // 21:59:59
    assert.equal(isQuietHour(new Date("2026-10-14T19:00:00Z")), true); // 22:00
  });
  it("runs through midnight and ends at 07:00 Amman", () => {
    assert.equal(isQuietHour(new Date("2026-10-14T21:30:00Z")), true); // 00:30 the next day
    assert.equal(isQuietHour(new Date("2026-10-15T03:59:59Z")), true); // 06:59:59
    assert.equal(isQuietHour(new Date("2026-10-15T04:00:00Z")), false); // 07:00
  });
  it("reads the Amman hour, not the server's", () => {
    assert.equal(ammanHour(new Date("2026-10-14T22:00:00Z")), 1);
  });
});

describe("familyDelivery", () => {
  const night = new Date("2026-10-14T20:00:00Z");
  const day = new Date("2026-10-14T09:00:00Z");
  it("rings on the category's own channel by day", () => {
    assert.deepEqual(familyDelivery("homework", day, true), { channelId: "homework", sound: "default" });
    assert.deepEqual(familyDelivery("results", day, true), { channelId: "results", sound: "default" });
  });
  it("goes to the silent channel with no sound at night", () => {
    assert.deepEqual(familyDelivery("exams", night, true), { channelId: "quiet", sound: null });
  });
  it("ignores the night when quiet hours are switched off", () => {
    assert.deepEqual(familyDelivery("exams", night, false), { channelId: "exams", sound: "default" });
  });
});

describe("quietHoursEnabled", () => {
  it("is on unless PUSH_QUIET_HOURS=off", () => {
    assert.equal(quietHoursEnabled({}), true);
    assert.equal(quietHoursEnabled({ PUSH_QUIET_HOURS: "on" }), true);
    assert.equal(quietHoursEnabled({ PUSH_QUIET_HOURS: "off" }), false);
  });
});
