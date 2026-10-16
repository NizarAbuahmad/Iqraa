import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { examDateNotice, examVisibleToFamilies, publishNotice, type ExamForNotice } from "../examDateNotice.ts";

const base: ExamForNotice = { status: "published", archivedAt: null, classGroupId: "c1", examDate: "2026-10-20", examTime: "09:30" };

describe("examVisibleToFamilies", () => {
  it("is a published or closed exam, in a class, not archived", () => {
    assert.equal(examVisibleToFamilies(base), true);
    assert.equal(examVisibleToFamilies({ ...base, status: "closed" }), true);
    assert.equal(examVisibleToFamilies({ ...base, status: "draft" }), false);
    assert.equal(examVisibleToFamilies({ ...base, classGroupId: null }), false);
    assert.equal(examVisibleToFamilies({ ...base, archivedAt: new Date() }), false);
  });
});

describe("examDateNotice", () => {
  it("says nothing when neither date nor time moved", () => {
    assert.equal(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-20", examTime: "09:30" }), null);
  });
  it("tells a changed date or time", () => {
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-20", examTime: "10:15" }), { kind: "changed", examDate: "2026-10-20", examTime: "10:15" });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: "2026-10-21", examTime: null }), { kind: "changed", examDate: "2026-10-21", examTime: null });
  });
  it("tells a date set on an undated exam, and a date cleared", () => {
    const undated = { ...base, examDate: null, examTime: null };
    assert.deepEqual(examDateNotice(undated, { classGroupId: "c1", examDate: "2026-10-22", examTime: null }), { kind: "set", examDate: "2026-10-22", examTime: null });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c1", examDate: null, examTime: null }), { kind: "cleared", examDate: null, examTime: null });
  });
  it("never tells anyone about a draft, an archived exam, or one with no class", () => {
    const moved = { classGroupId: "c1", examDate: "2026-10-25", examTime: null };
    assert.equal(examDateNotice({ ...base, status: "draft" }, moved), null);
    assert.equal(examDateNotice({ ...base, archivedAt: new Date() }, moved), null);
    assert.equal(examDateNotice({ ...base, classGroupId: null }, { ...moved, classGroupId: null }), null);
  });
  it("tells a class newly given a dated exam that the date is set", () => {
    assert.deepEqual(examDateNotice({ ...base, classGroupId: null }, { classGroupId: "c3", examDate: "2026-10-20", examTime: "09:30" }), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
    assert.deepEqual(examDateNotice(base, { classGroupId: "c3", examDate: "2026-10-20", examTime: "09:30" }), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
  });
  it("says nothing when the class is taken away or a new class gets an undated exam", () => {
    assert.equal(examDateNotice(base, { classGroupId: null, examDate: "2026-10-20", examTime: "09:30" }), null);
    assert.equal(examDateNotice({ ...base, classGroupId: null, examDate: null, examTime: null }, { classGroupId: "c3", examDate: null, examTime: null }), null);
  });
});

describe("publishNotice", () => {
  const draft = { ...base, status: "draft" };
  it("announces the date of a dated draft in a class being published", () => {
    assert.deepEqual(publishNotice(draft), { kind: "set", examDate: "2026-10-20", examTime: "09:30" });
  });
  it("says nothing for an undated draft, one with no class, or a re-publish", () => {
    assert.equal(publishNotice({ ...draft, examDate: null, examTime: null }), null);
    assert.equal(publishNotice({ ...draft, classGroupId: null }), null);
    assert.equal(publishNotice(base), null);
    assert.equal(publishNotice({ ...base, status: "closed" }), null);
  });
});
