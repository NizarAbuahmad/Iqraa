import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  MAX_PLAYERS,
  hasRoom,
  hostView,
  isEnded,
  isExpired,
  nextState,
  normalizeName,
  playerView,
  pointsFor,
  rankPlayers,
  scoreAnswer,
  validateCreate,
  type GameRow,
  type Scored,
} from "../rules.ts";

const Q = (i: number) => ({ content: `س${i}`, options: ["أ", "ب", "ج"], correctIndex: 1 });
const goodBody = () => ({ title: "لعبة", lang: "ar", questions: [Q(1), Q(2), Q(3)] });

describe("validateCreate", () => {
  it("accepts a good game and defaults seconds to 20", () => {
    const r = validateCreate(goodBody());
    assert.ok(r.ok);
    assert.equal(r.value.seconds, 20);
    assert.equal(r.value.questions.length, 3);
  });

  it("enforces every bound", () => {
    const cases: Record<string, unknown> = {
      "empty title": { ...goodBody(), title: "  " },
      "title 121": { ...goodBody(), title: "x".repeat(121) },
      "bad lang": { ...goodBody(), lang: "fr" },
      "seconds 9": { ...goodBody(), seconds: 9 },
      "seconds 61": { ...goodBody(), seconds: 61 },
      "seconds float": { ...goodBody(), seconds: 20.5 },
      "2 questions": { ...goodBody(), questions: [Q(1), Q(2)] },
      "31 questions": { ...goodBody(), questions: Array.from({ length: 31 }, (_, i) => Q(i)) },
      "content 501": { ...goodBody(), questions: [{ ...Q(1), content: "x".repeat(501) }, Q(2), Q(3)] },
      "1 option": { ...goodBody(), questions: [{ ...Q(1), options: ["أ"] }, Q(2), Q(3)] },
      "7 options": { ...goodBody(), questions: [{ ...Q(1), options: Array(7).fill("أ") }, Q(2), Q(3)] },
      "option 201": { ...goodBody(), questions: [{ ...Q(1), options: ["أ", "x".repeat(201)] }, Q(2), Q(3)] },
      "empty option": { ...goodBody(), questions: [{ ...Q(1), options: ["أ", " "] }, Q(2), Q(3)] },
      "correctIndex out of range": { ...goodBody(), questions: [{ ...Q(1), correctIndex: 3 }, Q(2), Q(3)] },
      "correctIndex negative": { ...goodBody(), questions: [{ ...Q(1), correctIndex: -1 }, Q(2), Q(3)] },
      "correctIndex string": { ...goodBody(), questions: [{ ...Q(1), correctIndex: "1" }, Q(2), Q(3)] },
      "not an object": "nope",
    };
    for (const [label, body] of Object.entries(cases)) {
      assert.equal(validateCreate(body).ok, false, label);
    }
    assert.ok(validateCreate({ ...goodBody(), seconds: 10 }).ok);
    assert.ok(validateCreate({ ...goodBody(), seconds: 60 }).ok);
    assert.ok(validateCreate({ ...goodBody(), title: "x".repeat(120) }).ok);
  });
});

describe("normalizeName", () => {
  it("trims, collapses whitespace and lower-cases for the key", () => {
    assert.deepEqual(normalizeName("  Sara   Ali "), { name: "Sara Ali", key: "sara ali" });
  });
  it("keeps Arabic as typed", () => {
    assert.equal(normalizeName(" سارة   أحمد ")?.name, "سارة أحمد");
  });
  it("counts characters, not UTF-16 units, against 24", () => {
    assert.ok(normalizeName("😀".repeat(23) + "a"));
    assert.equal(normalizeName("😀".repeat(24) + "a"), null);
    assert.equal(normalizeName("a".repeat(25)), null);
    assert.ok(normalizeName("ب".repeat(24)));
  });
  it("rejects empty, non-strings, controls and bidi overrides", () => {
    for (const bad of ["", "   ", 5, null, "a\u0000b", "a\nb", "a\tb", "a‮b", "​​"]) {
      assert.equal(normalizeName(bad), null, JSON.stringify(bad));
    }
  });
  it("rejects invisible and blank-looking characters anywhere in the name", () => {
    const chars = ["‎", "‏", "؜", "­", "ᅟ", "ᅠ", "ㅤ", "⠀", "᠎"];
    for (const c of chars) {
      assert.equal(normalizeName(`a${c}b`), null, `U+${c.codePointAt(0)!.toString(16)} inside`);
      assert.equal(normalizeName(c), null, `U+${c.codePointAt(0)!.toString(16)} alone`);
    }
  });
  it("needs at least one letter or digit", () => {
    for (const bad of ["😀😀", "---", "!!!", "😀 -"]) assert.equal(normalizeName(bad), null, bad);
    assert.ok(normalizeName("😀 7"));
    assert.ok(normalizeName("😀 س"));
    assert.ok(normalizeName("٣"), "an Arabic-Indic digit counts");
  });
  it("rejects stacked combining marks but keeps ordinary diacritics", () => {
    assert.equal(normalizeName("á̂̃̄"), null);
    assert.equal(normalizeName("سًٌٍَ"), null);
    assert.ok(normalizeName("á̂̃"), "three marks in a row is the limit");
    assert.ok(normalizeName("مُحَمَّد"), "a vowelled Arabic name passes");
  });
  it("two spellings of one name share a key", () => {
    assert.equal(normalizeName("SARA")?.key, normalizeName(" sara ")?.key);
  });
  it("folds look-alikes in the key (NFKC) but shows the name as typed", () => {
    const wide = normalizeName("ＳＡＲＡ");
    assert.equal(wide?.name, "ＳＡＲＡ");
    assert.equal(wide?.key, normalizeName("sara")?.key);
    assert.equal(normalizeName("ﬁsh")?.key, "fish");
  });
});

describe("player cap", () => {
  it("has room below the cap and none at it", () => {
    assert.equal(MAX_PLAYERS, 100);
    assert.equal(hasRoom(0), true);
    assert.equal(hasRoom(99), true);
    assert.equal(hasRoom(100), false);
    assert.equal(hasRoom(101), false);
    assert.equal(hasRoom(2, 3), true);
    assert.equal(hasRoom(3, 3), false);
  });
});

describe("game age", () => {
  const created = new Date("2026-10-22T08:00:00Z");
  it("expires after six hours, not before", () => {
    assert.equal(isExpired({ createdAt: created }, new Date("2026-10-22T14:00:00Z")), false);
    assert.equal(isExpired({ createdAt: created }, new Date("2026-10-22T14:00:01Z")), true);
  });
  it("is ended when ended_at is set or the game is too old", () => {
    const now = new Date("2026-10-22T09:00:00Z");
    assert.equal(isEnded({ createdAt: created, endedAt: null }, now), false);
    assert.equal(isEnded({ createdAt: created, endedAt: now }, now), true);
    assert.equal(isEnded({ createdAt: created, endedAt: null }, new Date("2026-10-22T15:00:00Z")), true);
  });
});

describe("scoring", () => {
  const started = new Date("2026-10-22T10:00:00.000Z");
  const at = (ms: number) => new Date(started.getTime() + ms);
  const base = {
    state: "question" as const,
    currentIndex: 2,
    questionStartedAt: started,
    seconds: 20,
    questions: [Q(1), Q(2), Q(3)],
    questionIndex: 2,
    choice: 1,
  };

  it("pays 1000 for an instant answer and 500 at the buzzer", () => {
    assert.equal(pointsFor(20, 0), 1000);
    assert.equal(pointsFor(20, 10_000), 750);
    assert.equal(pointsFor(20, 20_000), 500);
  });
  it("a faster correct answer beats a slower one", () => {
    const fast = scoreAnswer(base, at(2000));
    const slow = scoreAnswer(base, at(15_000));
    assert.ok(fast.ok && slow.ok);
    assert.ok(fast.points > slow.points && slow.points > 500);
  });
  it("a wrong answer scores 0", () => {
    const r = scoreAnswer({ ...base, choice: 0 }, at(1000));
    assert.ok(r.ok);
    assert.equal(r.correct, false);
    assert.equal(r.points, 0);
  });
  it("inside the 2 s grace it counts at the 500 floor; past it, too_late", () => {
    const grace = scoreAnswer(base, at(21_500));
    assert.ok(grace.ok);
    assert.equal(grace.points, 500);
    assert.deepEqual(scoreAnswer(base, at(22_001)), { ok: false, status: 409, code: "too_late" });
  });
  it("clamps a negative elapsed time to full marks", () => {
    assert.equal(pointsFor(20, -5000), 1000);
  });
  it("refuses an old index, a wrong state, and a missing start", () => {
    for (const patch of [{ questionIndex: 1 }, { state: "reveal" as const }, { state: "lobby" as const }, { questionStartedAt: null }]) {
      assert.deepEqual(scoreAnswer({ ...base, ...patch }, at(1000)), { ok: false, status: 409, code: "too_late" });
    }
  });
  it("refuses a choice that is not an option", () => {
    for (const choice of [-1, 3, 1.5]) {
      assert.deepEqual(scoreAnswer({ ...base, choice }, at(1000)), { ok: false, status: 400, code: "invalid" });
    }
  });
});

describe("transitions", () => {
  const s = (state: GameRow["state"], currentIndex: number) => ({ state, currentIndex });
  it("walks lobby -> question -> reveal -> question ... -> ended", () => {
    assert.deepEqual(nextState(s("lobby", -1), 3, "start"), s("question", 0));
    assert.deepEqual(nextState(s("question", 0), 3, "reveal"), s("reveal", 0));
    assert.deepEqual(nextState(s("reveal", 0), 3, "next"), s("question", 1));
    assert.deepEqual(nextState(s("reveal", 2), 3, "next"), s("ended", 2));
  });
  it("end works from anywhere", () => {
    for (const st of ["lobby", "question", "reveal"] as const) {
      assert.equal(nextState(s(st, 0), 3, "end")?.state, "ended");
    }
  });
  it("every other combination is refused", () => {
    const refused: [GameRow["state"], unknown][] = [
      ["lobby", "reveal"], ["lobby", "next"], ["question", "start"], ["question", "next"],
      ["reveal", "start"], ["reveal", "reveal"], ["ended", "start"], ["ended", "next"], ["lobby", "bogus"], ["lobby", undefined],
    ];
    for (const [st, action] of refused) assert.equal(nextState(s(st, 0), 3, action), null, `${st} ${String(action)}`);
  });
});

describe("projection", () => {
  const players: Scored[] = [
    { id: "a", name: "Zed", score: 900, signedIn: false },
    { id: "b", name: "Amy", score: 900, signedIn: true },
    { id: "c", name: "Bob", score: 100, signedIn: false },
  ];
  const game = (state: GameRow["state"], over: Partial<GameRow> = {}): GameRow => ({
    id: "g", code: "ABCDEF", title: "t", lang: "ar", questions: [Q(1), Q(2), Q(3)], seconds: 20,
    state, currentIndex: state === "lobby" ? -1 : 1, questionStartedAt: new Date("2026-10-22T10:00:00Z"),
    createdAt: new Date("2026-10-22T09:00:00Z"), endedAt: state === "ended" ? new Date("2026-10-22T10:30:00Z") : null, ...over,
  });
  const NOW = new Date("2026-10-22T10:00:05Z");
  const me = { id: "c", name: "Bob" };
  const answer = { choice: 0, correct: false, points: 0 };

  it("never carries correctIndex or another player's choice in lobby or question", () => {
    for (const state of ["lobby", "question"] as const) {
      const json = JSON.stringify(playerView(game(state), me, players, answer, NOW));
      assert.ok(!json.includes("correctIndex"), `${state} leaked the key name`);
      const view = playerView(game(state), me, players, answer, NOW);
      assert.equal(view.reveal, null);
      assert.deepEqual(view.top, []);
    }
    // the stored key is index 1; make sure a question view has exactly the options and the text
    const q = playerView(game("question"), me, players, null, NOW).question;
    assert.deepEqual(Object.keys(q ?? {}).sort(), ["content", "options"]);
  });

  it("reveals the key, the player's own result and the top list only in reveal", () => {
    const v = playerView(game("reveal"), me, players, { choice: 1, correct: true, points: 800 }, NOW);
    assert.deepEqual(v.reveal, { correctIndex: 1, myChoice: 1, myCorrect: true, myPoints: 800 });
    assert.equal(v.top.length, 3);
    assert.ok(!JSON.stringify(v.top).includes("choice"));
  });

  it("reveal for a player who did not answer", () => {
    const v = playerView(game("reveal"), me, players, null, NOW);
    assert.deepEqual(v.reveal, { correctIndex: 1, myChoice: null, myCorrect: false, myPoints: 0 });
    assert.equal(v.answered, false);
  });

  it("ended shows the leaderboard but no question and no reveal", () => {
    const v = playerView(game("ended"), me, players, null, NOW);
    assert.equal(v.question, null);
    assert.equal(v.reveal, null);
    assert.equal(v.top.length, 3);
  });

  it("ranks ties together and breaks list order by name", () => {
    assert.deepEqual(rankPlayers(players).map(p => p.name), ["Amy", "Zed", "Bob"]);
    assert.equal(playerView(game("reveal"), { id: "a", name: "Zed" }, players, null, NOW).me.rank, 1);
    assert.equal(playerView(game("reveal"), me, players, null, NOW).me.rank, 3);
  });

  it("reports how many players are in the game", () => {
    assert.equal(playerView(game("reveal"), me, players, null, NOW).playerCount, 3);
  });

  it("caps top at five", () => {
    const many = Array.from({ length: 9 }, (_, i): Scored => ({ id: `p${i}`, name: `n${i}`, score: i, signedIn: false }));
    assert.equal(playerView(game("ended"), { id: "p0", name: "n0" }, many, null, NOW).top.length, 5);
  });

  it("an expired game reads as ended", () => {
    const old = game("question", { createdAt: new Date("2026-10-22T01:00:00Z") });
    assert.equal(playerView(old, me, players, null, NOW).state, "ended");
    assert.equal(hostView(old, players, [], NOW).state, "ended");
  });

  it("the host sees the key, per-option counts and who answered", () => {
    const v = hostView(game("question"), players, [
      { playerId: "a", choice: 1 }, { playerId: "b", choice: 1 }, { playerId: "c", choice: 2 },
    ], NOW);
    assert.equal(v.current?.correctIndex, 1);
    assert.deepEqual(v.answerCounts, [0, 2, 1]);
    assert.equal(v.answeredCount, 3);
    assert.deepEqual(v.players.map(p => [p.name, p.answeredCurrent, p.signedIn]), [
      ["Amy", true, true], ["Zed", true, false], ["Bob", true, false],
    ]);
    const lobby = hostView(game("lobby"), players, [], NOW);
    assert.equal(lobby.current, null);
    assert.deepEqual(lobby.answerCounts, []);
  });
});
