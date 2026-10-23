import { describe, it } from "node:test";
import assert from "node:assert/strict";

import type { HomeworkResource } from "@workspace/db";
import { attachedGames, carryOverGames, gameResourceKey, isBetterResult, parseGameResult } from "../game.ts";
import { buildFamilyHomework, type GameResultRow } from "../familyHomework.ts";

const L1 = "lesson-1";
const L2 = "lesson-2";
const game = (lessonId: string, g: "memory" | "scramble" | "spot"): HomeworkResource => ({ kind: "game", lessonId, game: g, title: `${lessonId}/${g}` });
const lib = (n: string): HomeworkResource => ({ kind: "library", source: "s", nativeId: n, title: n, mediaKind: "pdf", url: null, thumbnailUrl: null });

describe("parseGameResult", () => {
  it("accepts a lesson id and a known game with 0 ≤ score ≤ total, 1 ≤ total ≤ 100", () => {
    assert.deepEqual(parseGameResult({ lessonId: L1, game: "memory", score: 3, total: 8 }), {
      ok: true,
      value: { lessonId: L1, game: "memory", score: 3, total: 8 },
    });
    assert.equal(parseGameResult({ lessonId: L1, game: "spot", score: 0, total: 1 }).ok, true);
    assert.equal(parseGameResult({ lessonId: "x".repeat(200), game: "scramble", score: 100, total: 100 }).ok, true);
  });

  it("refuses everything else as `invalid`", () => {
    const ok = { lessonId: L1, game: "memory", score: 1, total: 2 };
    const bad: unknown[] = [
      null, "x", [], {},
      { ...ok, lessonId: undefined },
      { ...ok, lessonId: "" },
      { ...ok, lessonId: 5 },
      { ...ok, lessonId: "x".repeat(201) },
      { ...ok, game: "chess" },
      { ...ok, score: undefined },
      { ...ok, total: undefined },
      { ...ok, score: 3, total: 2 },
      { ...ok, score: -1 },
      { ...ok, total: 0 },
      { ...ok, total: 101 },
      { ...ok, score: 1.5 },
      { ...ok, score: "1" },
      { ...ok, score: NaN },
    ];
    for (const b of bad) {
      const r = parseGameResult(b);
      assert.equal(r.ok, false, JSON.stringify(b));
      if (!r.ok) assert.equal(r.code, "invalid");
    }
  });
});

describe("isBetterResult", () => {
  it("compares the ratio, not the raw score", () => {
    assert.equal(isBetterResult({ score: 4, total: 5 }, { score: 7, total: 10 }), true);
    assert.equal(isBetterResult({ score: 9, total: 10 }, { score: 4, total: 5 }), true);
    assert.equal(isBetterResult({ score: 7, total: 10 }, { score: 4, total: 5 }), false);
  });
  it("keeps the existing result on a tie", () => {
    assert.equal(isBetterResult({ score: 4, total: 5 }, { score: 8, total: 10 }), false);
    assert.equal(isBetterResult({ score: 0, total: 5 }, { score: 0, total: 9 }), false);
  });
});

describe("gameResourceKey / attachedGames", () => {
  it("is game:<lesson>:<game>", () => assert.equal(gameResourceKey("l1", "spot"), "game:l1:spot"));
  it("lists only the game attachments, in order", () => {
    assert.deepEqual(attachedGames([lib("a"), game(L2, "spot"), game(L1, "memory")]), [
      { lessonId: L2, game: "spot" },
      { lessonId: L1, game: "memory" },
    ]);
  });
});

describe("carryOverGames", () => {
  it("appends the games the body left out, after the body's own items", () => {
    const out = carryOverGames([lib("a")], [game(L1, "memory"), lib("old"), game(L2, "spot")], 10);
    assert.deepEqual(out.map(r => r.title), ["a", `${L1}/memory`, `${L2}/spot`]);
  });
  it("does not duplicate a game the body kept", () => {
    const out = carryOverGames([game(L1, "memory"), lib("a")], [game(L1, "memory"), game(L1, "spot")], 10);
    assert.deepEqual(out.map(r => r.title), [`${L1}/memory`, "a", `${L1}/spot`]);
  });
  it("keeps the body's items first and carries over only as many games as fit", () => {
    const body = [lib("a"), lib("b"), lib("c")];
    const out = carryOverGames(body, [game(L1, "memory"), game(L1, "spot"), game(L1, "scramble")], 5);
    assert.deepEqual(out.map(r => r.title), ["a", "b", "c", `${L1}/memory`, `${L1}/spot`]);
    assert.equal(carryOverGames(body, [game(L1, "memory")], 3).length, 3, "full body: nothing carried");
  });
  it("carries nothing when there are no games, and never a non-game", () => {
    assert.deepEqual(carryOverGames([lib("a")], [lib("old")], 10), [lib("a")]);
  });
});

describe("family items carry gameResults", () => {
  const due = new Date(Date.now() + 86_400_000);
  const base = (resources: HomeworkResource[] = [game(L1, "memory"), game(L1, "spot"), game(L2, "memory")]) => ({
    homework: [{ id: "h1", classGroupId: "c1", title: "t", instructions: "", dueAt: due, evaluationId: null, resources }],
    memberships: [
      { classGroupId: "c1", studentId: "s1", className: "10A", teacherId: "t1" },
      { classGroupId: "c1", studentId: "s2", className: "10A", teacherId: "t1" },
    ],
    completions: [],
    teachers: [{ id: "t1", firstName: "A", lastName: "B" }],
    exams: [],
    now: new Date(),
    withAccount: new Set<string>(),
  });
  const row = (studentId: string, lessonId: string, g: string, score: number, total: number, attempts = 1, homeworkId = "h1"): GameResultRow =>
    ({ homeworkId, studentId, lessonId, game: g, score, total, attempts });

  it("is [] when there are none", () => {
    assert.deepEqual(buildFamilyHomework(base())[0]!.gameResults, []);
    assert.deepEqual(buildFamilyHomework({ ...base(), gameResults: [] })[0]!.gameResults, []);
  });

  it("keeps the best row per (lesson, game), in attachment order; ignores other homework and other rows", () => {
    const items = buildFamilyHomework({
      ...base(),
      gameResults: [
        row("s1", L1, "spot", 1, 2),
        row("s1", L1, "memory", 5, 10, 2),
        row("s2", L1, "memory", 9, 10, 1),
        row("s1", L2, "memory", 2, 4),
        row("s9", L1, "memory", 10, 10),
        row("s1", L1, "memory", 1, 1, 1, "other"),
      ],
    });
    assert.deepEqual(items[0]!.gameResults, [
      { lessonId: L1, game: "memory", score: 9, total: 10, attempts: 1 },
      { lessonId: L1, game: "spot", score: 1, total: 2, attempts: 1 },
      { lessonId: L2, game: "memory", score: 2, total: 4, attempts: 1 },
    ]);
  });

  it("does not let lesson 1's memory result stand in for lesson 2's", () => {
    const items = buildFamilyHomework({ ...base(), gameResults: [row("s1", L1, "memory", 10, 10)] });
    assert.deepEqual(items[0]!.gameResults, [{ lessonId: L1, game: "memory", score: 10, total: 10, attempts: 1 }]);
  });

  it("drops results for a game that is no longer attached", () => {
    const items = buildFamilyHomework({
      ...base([game(L1, "memory")]),
      gameResults: [row("s1", L1, "memory", 1, 2), row("s1", L1, "spot", 2, 2), row("s1", L2, "memory", 2, 2)],
    });
    assert.deepEqual(items[0]!.gameResults, [{ lessonId: L1, game: "memory", score: 1, total: 2, attempts: 1 }]);
    assert.deepEqual(buildFamilyHomework({ ...base([]), gameResults: [row("s1", L1, "memory", 1, 2)] })[0]!.gameResults, []);
  });

  it("on a tie takes the row with more attempts", () => {
    const items = buildFamilyHomework({ ...base(), gameResults: [row("s1", L1, "memory", 5, 10, 1), row("s2", L1, "memory", 1, 2, 3)] });
    assert.deepEqual(items[0]!.gameResults, [{ lessonId: L1, game: "memory", score: 1, total: 2, attempts: 3 }]);
  });
});
