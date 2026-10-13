/**
 * What a student may see of a stored lesson explanation, and which stored row
 * they are given. All pure: the student route is a thin shell around these.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  APPROVE_MAX,
  isLessonRef,
  isUuid,
  parseApproveBody,
  parseLanguage,
  pickExplanation,
  stripTeacherNotes,
  type ExplanationRow,
} from "../lessonExplanation.ts";

const row = (id: string, createdAt: string, timesServed = 0): ExplanationRow => ({
  id,
  createdAt: new Date(createdAt),
  timesServed,
  content: { id },
});

const U1 = "11111111-1111-4111-8111-111111111111";
const U2 = "22222222-2222-4222-8222-222222222222";

describe("pickExplanation", () => {
  it("returns null when nothing is approved", () => {
    assert.equal(pickExplanation([]), null);
  });

  it("serves the newest row, so a rerun after a prompt bump replaces the old text", () => {
    const picked = pickExplanation([
      row("old", "2026-10-01T00:00:00Z", 0),
      row("new", "2026-10-09T00:00:00Z", 50),
    ]);
    assert.equal(picked?.id, "new");
  });

  it("breaks a tie on creation time by the least-served row", () => {
    const picked = pickExplanation([
      row("busy", "2026-10-09T00:00:00Z", 9),
      row("quiet", "2026-10-09T00:00:00Z", 1),
    ]);
    assert.equal(picked?.id, "quiet");
  });

  it("does not reorder the caller's array", () => {
    const rows = [row("a", "2026-10-01T00:00:00Z"), row("b", "2026-10-09T00:00:00Z")];
    pickExplanation(rows);
    assert.deepEqual(rows.map((r) => r.id), ["a", "b"]);
  });
});

describe("stripTeacherNotes", () => {
  it("removes teacherNote at every depth and keeps everything else", () => {
    const stored = {
      hook: { question: "ما هو المول؟", teacherNote: "ابدأ بسؤال" },
      concepts: [
        { title: "المول", points: ["a", "b"], teacherNote: "اشرح ببطء", misconception: "x" },
        { title: "الكتلة", points: ["c"] },
      ],
      workedExample: { problem: "p", steps: ["s1"], answer: "4" },
      practice: { problem: "q", hint: "h", answer: "5" },
    };
    assert.deepEqual(stripTeacherNotes(stored), {
      hook: { question: "ما هو المول؟" },
      concepts: [
        { title: "المول", points: ["a", "b"], misconception: "x" },
        { title: "الكتلة", points: ["c"] },
      ],
      workedExample: { problem: "p", steps: ["s1"], answer: "4" },
      practice: { problem: "q", hint: "h", answer: "5" },
    });
  });

  it("passes non-objects through and does not mutate its input", () => {
    assert.equal(stripTeacherNotes("text"), "text");
    assert.equal(stripTeacherNotes(null), null);
    const input = { a: { teacherNote: "n", b: 1 } };
    stripTeacherNotes(input);
    assert.deepEqual(input, { a: { teacherNote: "n", b: 1 } });
  });
});

describe("isLessonRef", () => {
  it("accepts a curriculum lesson id", () => {
    assert.equal(isLessonRef("kbl-math-s1-u1-l2"), true);
  });
  it("rejects anything that is not id-shaped", () => {
    for (const bad of ["", "../etc", "a b", "درس", "x".repeat(121), 5, null, undefined]) {
      assert.equal(isLessonRef(bad), false, String(bad));
    }
  });
});

describe("parseLanguage", () => {
  it("follows the server's own rule: only 'english' is English", () => {
    assert.equal(parseLanguage("english"), "english");
    assert.equal(parseLanguage("arabic"), "arabic");
    assert.equal(parseLanguage(undefined), "arabic");
    assert.equal(parseLanguage("en"), "arabic");
  });
});

describe("parseApproveBody", () => {
  it("accepts 1..200 uuids and de-duplicates them", () => {
    assert.deepEqual(parseApproveBody({ variantIds: [U1, U2, U1.toUpperCase()] }), [U1, U2]);
  });
  it("rejects everything else", () => {
    assert.equal(parseApproveBody(null), null);
    assert.equal(parseApproveBody({}), null);
    assert.equal(parseApproveBody({ variantIds: [] }), null);
    assert.equal(parseApproveBody({ variantIds: "x" }), null);
    assert.equal(parseApproveBody({ variantIds: [U1, "not-a-uuid"] }), null);
    const tooMany = Array.from({ length: APPROVE_MAX + 1 }, (_, i) =>
      `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
    assert.equal(parseApproveBody({ variantIds: tooMany }), null);
  });
});

describe("isUuid", () => {
  it("is strict", () => {
    assert.equal(isUuid(U1), true);
    assert.equal(isUuid("1111"), false);
    assert.equal(isUuid(undefined), false);
  });
});
