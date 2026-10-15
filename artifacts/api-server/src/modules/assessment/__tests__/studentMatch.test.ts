/**
 * Matching a name off a photograph to a roster.
 *
 * The question every test here asks: when it is not certain, does it refuse to
 * pick? A wrong `confident` puts one child's marks on another and nothing
 * downstream can tell.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_CANDIDATES, matchStudent, type RosterEntry } from "../studentMatch.ts";

const r = (studentId: string, displayName: string, hasAttempt = false): RosterEntry => ({
  studentId, displayName, hasAttempt,
});

const CLASS = [
  r("s1", "سارة أحمد علي"),
  r("s2", "محمد خالد"),
  r("s3", "ليلى حسن"),
];

describe("matchStudent — confident", () => {
  it("is confident on an exact full-name match", () => {
    const m = matchStudent("محمد خالد", CLASS);
    assert.equal(m.status, "confident");
    assert.equal(m.studentId, "s2");
  });

  it("ignores the differences between two spellings of one name", () => {
    // hamza, ta marbuta, ya/alef maqsura, diacritics, tatweel, punctuation, spacing.
    const roster = [r("s1", "أحمد عبد الرحمن"), r("s2", "ليلى")];
    for (const written of ["احمد عبد الرحمن", "أَحْمَد  عبد  الرحمن", "احـمد عبد الرحمن.", "إحمد عبد الرحمن"]) {
      const m = matchStudent(written, roster);
      assert.equal(m.studentId, "s1", written);
      assert.equal(m.status, "confident", written);
    }
    assert.equal(matchStudent("ليلي", roster).studentId, "s2");
  });

  it("is confident for a single-name roster row that is unique", () => {
    assert.equal(matchStudent("ليلى", [r("a", "ليلى"), r("b", "سارة")]).status, "confident");
  });
});

describe("matchStudent — never guesses", () => {
  it("is NEVER confident when two students share the name", () => {
    const twins = [r("a", "محمد خالد"), r("b", "محمد خالد"), r("c", "سارة")];
    const m = matchStudent("محمد خالد", twins);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.deepEqual(m.candidates.map(c => c.studentId).sort(), ["a", "b"]);
  });

  it("asks for a tap when only a first name was read", () => {
    const m = matchStudent("سارة", CLASS);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.equal(m.candidates[0]!.studentId, "s1");
  });

  it("asks for a tap when two roster students share the first name", () => {
    const roster = [r("a", "سارة أحمد"), r("b", "سارة محمود")];
    const m = matchStudent("سارة", roster);
    assert.equal(m.status, "confirm");
    assert.equal(m.candidates.length, 2);
  });

  it("asks for a tap on a partial or misspelt name instead of choosing", () => {
    const m = matchStudent("سارة احمد", CLASS);
    assert.equal(m.status, "confirm");
    assert.equal(m.candidates[0]!.studentId, "s1");
    assert.ok(m.candidates[0]!.score < 1);
  });

  it("is none for a name nothing resembles", () => {
    for (const written of ["يوسف إبراهيم", "x", "12345"]) {
      const m = matchStudent(written, CLASS);
      assert.equal(m.status, "none", written);
      assert.equal(m.studentId, null);
      assert.deepEqual(m.candidates, []);
    }
  });

  it("is none for no name, and for an empty roster", () => {
    for (const written of [null, undefined, "", "   ", "،.؛"]) {
      assert.equal(matchStudent(written, CLASS).status, "none", JSON.stringify(written));
    }
    assert.equal(matchStudent("محمد خالد", []).status, "none");
  });
});

describe("matchStudent — exact means an identical name, not an equal word-set", () => {
  it("is not confident when the words are reordered (first and father names differ)", () => {
    const roster = [r("x", "أحمد علي"), r("y", "ليلى حسن")];
    const m = matchStudent("علي أحمد", roster);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    const x = m.candidates.find(c => c.studentId === "x");
    assert.ok(x, "أحمد علي is still offered as a candidate");
    assert.ok(x.score < 1, `score ${x.score} must be below 1`);
  });

  it("is not confident when a repeated word matches a single-word name", () => {
    const m = matchStudent("محمد محمد", [r("a", "محمد"), r("b", "ليلى حسن")]);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
  });

  it("is not confident when a single word matches a repeated-word name", () => {
    const m = matchStudent("محمد", [r("a", "محمد محمد"), r("b", "ليلى حسن")]);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
  });

  it("prefers an identical name over a reordered one, and offers only the identical", () => {
    const m = matchStudent("أحمد علي", [r("x", "أحمد علي"), r("y", "علي أحمد")]);
    assert.equal(m.status, "confident");
    assert.equal(m.studentId, "x");
    assert.deepEqual(m.candidates.map(c => c.studentId), ["x"]);
  });
});

describe("matchStudent — a longer roster name that contains the read name", () => {
  it("asks for a tap when the read name is also the start of another student's longer name", () => {
    const m = matchStudent("أحمد", [r("short", "أحمد"), r("long", "أحمد علي")]);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.deepEqual(m.candidates.map(c => c.studentId), ["short", "long"]);
    assert.equal(m.candidates[0]!.score, 1);
    assert.ok(m.candidates[1]!.score < 1, `score ${m.candidates[1]!.score} must stay below 1`);
  });

  it("stays confident for the longer name when the shorter roster name is not a superset of it", () => {
    const m = matchStudent("أحمد علي", [r("short", "أحمد"), r("long", "أحمد علي")]);
    assert.equal(m.status, "confident");
    assert.equal(m.studentId, "long");
  });

  it("offers both when a two-part name is contained in a three-part one", () => {
    const roster = [r("a", "سارة أحمد"), r("b", "سارة أحمد علي"), r("c", "ليلى حسن")];
    const m = matchStudent("سارة أحمد", roster);
    assert.equal(m.status, "confirm");
    assert.equal(m.studentId, null);
    assert.deepEqual(m.candidates.map(c => c.studentId), ["a", "b"]);
  });

  it("stays confident when no other roster name contains the read name", () => {
    const m = matchStudent("أحمد", [r("a", "أحمد"), r("b", "ليلى")]);
    assert.equal(m.status, "confident");
    assert.equal(m.studentId, "a");
  });
});

describe("matchStudent — candidates", () => {
  it("offers at most three, best first", () => {
    const roster = ["a", "b", "c", "d", "e"].map(id => r(id, `سارة ${id}`));
    const m = matchStudent("سارة", roster);
    assert.equal(m.candidates.length, MAX_CANDIDATES);
    const scores = m.candidates.map(c => c.score);
    assert.deepEqual([...scores].sort((x, y) => y - x), scores);
  });

  it("carries hasAttempt through so the screen can warn before saving", () => {
    const m = matchStudent("محمد خالد", [r("s2", "محمد خالد", true)]);
    assert.equal(m.status, "confident");
    assert.equal(m.candidates[0]!.hasAttempt, true);
  });
});
