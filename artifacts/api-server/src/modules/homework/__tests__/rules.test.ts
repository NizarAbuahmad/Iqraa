import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  dueDateToDueAt, dueAtToDueDate, homeworkState, familyCutoff,
  parseCreate, parsePatch, TITLE_MAX, INSTRUCTIONS_MAX,
} from "../rules.ts";

const CLASS = "11111111-1111-4111-8111-111111111111";
const EXAM = "22222222-2222-4222-8222-222222222222";

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
    const r = parseCreate(ok);
    assert.equal(r.ok, true);
    if (r.ok) {
      assert.equal(r.value.title, "حل التمارين");
      assert.equal(r.value.instructions, "");
      assert.equal(r.value.evaluationId, null);
      assert.equal(r.value.dueAt.toISOString(), "2026-10-14T20:59:59.999Z");
    }
  });
  it("requires a class id, a title and a real due date", () => {
    assert.equal(parseCreate({ ...ok, classGroupId: "nope" }).ok, false);
    assert.equal(parseCreate({ ...ok, title: "   " }).ok, false);
    assert.equal(parseCreate({ ...ok, dueDate: "2026-02-30" }).ok, false);
    assert.equal(parseCreate(null).ok, false);
  });
  it("enforces length limits", () => {
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX + 1) }).ok, false);
    assert.equal(parseCreate({ ...ok, instructions: "x".repeat(INSTRUCTIONS_MAX + 1) }).ok, false);
    assert.equal(parseCreate({ ...ok, title: "x".repeat(TITLE_MAX) }).ok, true);
  });
  it("accepts an exam id but only a uuid", () => {
    assert.equal(parseCreate({ ...ok, evaluationId: EXAM }).ok, true);
    assert.equal(parseCreate({ ...ok, evaluationId: "nope" }).ok, false);
  });
});

describe("parsePatch", () => {
  it("accepts any subset of the editable fields", () => {
    const r = parsePatch({ dueDate: "2026-10-20", evaluationId: null });
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
    assert.equal(parsePatch({ dueDate: "soon" }).ok, false);
  });
  it("ignores fields it does not own (class and teacher cannot be changed)", () => {
    const r = parsePatch({ title: "x", classGroupId: CLASS, teacherId: CLASS });
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(Object.keys(r.value), ["title"]);
  });
});
