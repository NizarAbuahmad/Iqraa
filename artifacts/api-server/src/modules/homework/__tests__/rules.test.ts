import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dueDateToDueAt, dueAtToDueDate, homeworkState, familyCutoff,
  parseCreate, parsePatch, TITLE_MAX, INSTRUCTIONS_MAX, RESOURCES_MAX,
} from "../rules.ts";

const CLASS = "11111111-1111-4111-8111-111111111111";
const EXAM = "22222222-2222-4222-8222-222222222222";
/** 12:00 Amman on 2026-10-12. The existing cases use dates around it, so they pin `now` rather than read the clock. */
const NOW = new Date("2026-10-12T09:00:00Z");

describe("dueDateToDueAt / dueAtToDueDate", () => {
  it("is the end of the Amman day", () => {
    assert.equal(dueDateToDueAt("2026-10-14")!.toISOString(), "2026-10-14T20:59:59.999Z");
  });
  it("round-trips, including across the UTC date boundary", () => {
    for (const d of ["2026-10-14", "2026-01-01", "2026-12-31", "2028-02-29"]) {
      assert.equal(dueAtToDueDate(dueDateToDueAt(d)!), d);
    }
    // 22:00Z is already tomorrow in Amman.
    assert.equal(dueAtToDueDate(new Date("2026-10-14T22:00:00Z")), "2026-10-15");
  });
  it("rejects anything that is not a real YYYY-MM-DD", () => {
    for (const bad of ["", "2026-13-01", "2026-02-30", "2026-2-3", "14/10/2026", "2026-10-14T00:00:00Z", null, undefined, 20261014, {}]) {
      assert.equal(dueDateToDueAt(bad), null, String(bad));
    }
  });
});

describe("homeworkState", () => {
  const dueAt = dueDateToDueAt("2026-10-14")!;
  it("done wins over overdue", () => {
    assert.equal(homeworkState({ dueAt, done: true, now: new Date("2026-11-01Z") }), "done");
  });
  it("is overdue only after the due day has ended", () => {
    assert.equal(homeworkState({ dueAt, done: false, now: new Date("2026-10-14T20:59:00Z") }), "open");
    assert.equal(homeworkState({ dueAt, done: false, now: new Date("2026-10-14T21:00:00Z") }), "overdue");
  });
});

describe("familyCutoff", () => {
  it("is fourteen days back", () => {
    assert.equal(familyCutoff(new Date("2026-10-15T00:00:00Z")).toISOString(), "2026-10-01T00:00:00.000Z");
  });
});

describe("parseCreate", () => {
  const ok = { classGroupId: CLASS, title: "  حل التمارين  ", dueDate: "2026-10-14" };
  it("trims, defaults instructions to '' and evaluationId to null", () => {
    const r = parseCreate(ok, NOW);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.title, "حل التمارين");
      assert.equal(r.value.instructions, "");
      assert.equal(r.value.evaluationId, null);
      assert.equal(r.value.dueAt.toISOString(), "2026-10-14T20:59:59.999Z");
    }
  });
  it("requires a class id, a title and a real due date", () => {
    assert.equal(parseCreate({ ...ok, classGroupId: "nope" }, NOW).ok, false);
    assert.equal(parseCreate({ ...ok, title: "   " }, NOW).ok, false);
    assert.equal(parseCreate({ ...ok, dueDate: "2026-02-30" }, NOW).ok, false);
    assert.equal(parseCreate(null, NOW).ok, false);
  });
  it("enforces length limits", () => {
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX + 1) }, NOW).ok, false);
    assert.equal(parseCreate({ ...ok, instructions: "x".repeat(INSTRUCTIONS_MAX + 1) }, NOW).ok, false);
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX) }, NOW).ok, true);
  });
  it("accepts an exam id but only a uuid", () => {
    assert.equal(parseCreate({ ...ok, evaluationId: EXAM }, NOW).ok, true);
    assert.equal(parseCreate({ ...ok, evaluationId: "nope" }, NOW).ok, false);
  });
});

describe("parsePatch", () => {
  it("accepts any subset of the editable fields", () => {
    const r = parsePatch({ dueDate: "2026-10-20", evaluationId: null }, NOW);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.evaluationId, null);
      assert.equal(r.value.dueAt!.toISOString(), "2026-10-20T20:59:59.999Z");
      assert.equal("title" in r.value, false);
    }
  });
  it("refuses an empty patch, a blank title, and a bad date", () => {
    assert.equal(parsePatch({}).ok, false);
    assert.equal(parsePatch({ title: " " }).ok, false);
    assert.equal(parsePatch({ dueDate: "soon" }, NOW).ok, false);
  });
  it("ignores fields it does not own (class and teacher cannot be changed)", () => {
    const r = parsePatch({ title: "x", classGroupId: CLASS, teacherId: CLASS });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(Object.keys(r.value), ["title"]);
  });
});

// The bound is on the Amman CALENDAR DAY, not on the instant: "today" is the
// Amman date of `now`; the earliest accepted due date is today - 30 days and the
// latest is today + 366 days, both inclusive, compared as YYYY-MM-DD. So a due
// date is judged the way a teacher reads it, and midnight in Amman (21:00Z) moves
// the window by a whole day.
describe("due date bounds", () => {
  const MSG = "dueDate must be within the last 30 days and the next year";
  const OUT = { ok: false, error: MSG, code: "due_date_out_of_range" };
  const create = (dueDate: string, now = NOW) => parseCreate({ classGroupId: CLASS, title: "t", dueDate }, now);
  const patch = (dueDate: string, now = NOW) => parsePatch({ dueDate }, now);

  it("accepts exactly 30 days back and rejects 31, on create and on patch", () => {
    assert.equal(create("2026-09-12").ok, true);
    assert.equal(patch("2026-09-12").ok, true);
    for (const r of [create("2026-09-11"), patch("2026-09-11")]) {
      assert.deepEqual(r, OUT);
    }
  });
  it("accepts exactly 366 days ahead and rejects 367, on create and on patch", () => {
    assert.equal(create("2027-10-13").ok, true);
    assert.equal(patch("2027-10-13").ok, true);
    for (const r of [create("2027-10-14"), patch("2027-10-14")]) {
      assert.deepEqual(r, OUT);
    }
  });
  it("counts days in Amman: after 21:00Z it is already tomorrow there", () => {
    const late = new Date("2026-10-12T21:30:00Z"); // 00:30 on 2026-10-13 in Amman
    assert.equal(create("2026-09-13", late).ok, true);
    assert.deepEqual(create("2026-09-12", late), OUT);
    assert.equal(create("2027-10-14", late).ok, true);
    assert.deepEqual(create("2027-10-15", late), OUT);
  });
  it("rejects a far-future year, and still reports a malformed date as malformed", () => {
    assert.deepEqual(create("2062-01-01"), OUT);
    assert.deepEqual(create("2026-02-30"), { ok: false, error: "dueDate must be a real date, YYYY-MM-DD" });
  });
  it("a malformed date carries no range code", () => {
    assert.equal("code" in (create("2026-02-30") as object), false);
    assert.equal("code" in (patch("soon") as object), false);
  });
  it("patch: an UNCHANGED stored due date is not re-bounded, so an old homework can still be edited", () => {
    const existing = { dueAt: dueDateToDueAt("2026-08-28")! }; // 45 days before NOW: outside the window
    const r = parsePatch({ title: "x", dueDate: "2026-08-28" }, NOW, existing);
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.value.dueAt!.toISOString(), "2026-08-28T20:59:59.999Z");
  });
  it("patch: 'unchanged' compares Amman calendar days, not timestamps (a row inserted by SQL/import at 09:00Z)", () => {
    const existing = { dueAt: new Date("2026-09-01T09:00:00Z") }; // 12:00 Amman, 41 days before NOW: outside the window
    const r = parsePatch({ title: "x", dueDate: "2026-09-01" }, NOW, existing);
    assert.equal(r.ok, true, "same day, different time of day: the range check is skipped");
    assert.deepEqual(parsePatch({ dueDate: "2026-09-02" }, NOW, existing), OUT, "a different old day is still refused");
    // 22:00Z on 08-31 is already 01:00 on 09-01 in Amman, so it is the same day too.
    assert.equal(parsePatch({ dueDate: "2026-09-01" }, NOW, { dueAt: new Date("2026-08-31T22:00:00Z") }).ok, true);
    assert.deepEqual(parsePatch({ dueDate: "2026-08-31" }, NOW, { dueAt: new Date("2026-08-31T22:00:00Z") }), OUT);
  });
  it("patch: a CHANGED date outside the window is still refused, with the range code", () => {
    const existing = { dueAt: dueDateToDueAt("2026-08-28")! };
    assert.deepEqual(parsePatch({ dueDate: "2026-08-29" }, NOW, existing), OUT, "another out-of-window day");
    assert.deepEqual(parsePatch({ dueDate: "2062-01-01" }, NOW, existing), OUT);
    assert.equal(parsePatch({ dueDate: "2026-10-20" }, NOW, existing).ok, true, "moving it into the window is fine");
  });
  it("patch: the unchanged skip needs the existing row; without it the bound applies", () => {
    assert.deepEqual(parsePatch({ dueDate: "2026-08-28" }, NOW), OUT);
  });
  it("defaults `now` to the clock", () => {
    const today = dueAtToDueDate(new Date());
    assert.equal(parseCreate({ classGroupId: CLASS, title: "t", dueDate: today }).ok, true);
    assert.equal(parsePatch({ dueDate: "2062-01-01" }).ok, false);
  });
});

describe("resources", () => {
  const ok = { classGroupId: CLASS, title: "t", dueDate: "2026-10-14" };
  it("defaults to none, passes a list through, and caps it", () => {
    const none = parseCreate(ok, NOW);
    assert.ok(none.ok && none.value.resources.length === 0);
    assert.equal(parseCreate({ ...ok, resources: [{}] }, NOW).ok, true, "items are the route's to check");
    assert.equal(parseCreate({ ...ok, resources: Array(RESOURCES_MAX + 1).fill({}) }, NOW).ok, false);
    assert.equal(parseCreate({ ...ok, resources: "x" }, NOW).ok, false);
    const p = parsePatch({ resources: [] }, NOW);
    assert.ok(p.ok && p.value.resources?.length === 0, "clearing is a change");
  });
});
