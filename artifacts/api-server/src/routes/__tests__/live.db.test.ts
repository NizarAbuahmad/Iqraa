/**
 * What this guards: a live game from both sides, over HTTP, against real rows.
 *
 * The ways it goes wrong are (1) a player seeing the answer key before the
 * reveal, (2) a score a device could influence, (3) a stranger or another
 * teacher reaching a game, (4) a removed player still playing, and (5) two
 * students sharing a name. Time-dependent cases move `question_started_at`
 * with SQL rather than sleeping, so the server clock still does the scoring.
 *
 * One database and one server for the file; the cases are a single game played
 * start to finish, in order, because each step is the state the next needs.
 */
import { after, before, describe, it } from "node:test";
import assert from "node:assert/strict";

import { describeDb } from "../../test-support/gate.ts";
import { setupTestDb, type TestDb } from "../../test-support/testDb.ts";
import { startServer, type TestServer } from "../../test-support/startServer.ts";
import { accessToken } from "../../test-support/tokens.ts";

const Q = (n: number, correctIndex = 1) => ({
  content: `سؤال ${n}`,
  options: ["أ", "ب", "ج"],
  correctIndex,
});
const GAME = { title: "لعبة الاختبار", lang: "ar", seconds: 20, questions: [Q(1), Q(2), Q(3)] };

describeDb("live games over HTTP, against a real database", () => {
  let db: TestDb;
  let server: TestServer;
  let teacher: string;
  let otherTeacher: string;
  let studentUser: string;
  let parentUser: string;
  let gameId: string;
  let code: string;
  const tok: Record<string, string> = {};
  const pid: Record<string, string> = {};

  async function call(
    method: string,
    path: string,
    opts: { userId?: string; bearer?: string; live?: string; body?: unknown } = {},
  ) {
    const headers: Record<string, string> = {};
    if (opts.userId) headers["Authorization"] = `Bearer ${accessToken(opts.userId)}`;
    if (opts.bearer) headers["Authorization"] = `Bearer ${opts.bearer}`;
    if (opts.live) headers["X-Live-Token"] = opts.live;
    if (opts.body !== undefined) headers["Content-Type"] = "application/json";
    const res = await fetch(`${server.base}${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return { status: res.status, text, json: (text ? JSON.parse(text) : null) as any };
  }

  const host = (userId = teacher) => call("GET", `/live-host/games/${gameId}`, { userId });
  const advance = (action: string, userId = teacher) =>
    call("POST", `/live-host/games/${gameId}/advance`, { userId, body: { action } });
  const state = (who: string) => call("GET", `/live/${code}/state`, { live: tok[who] });
  const answer = (who: string, questionIndex: number, choice: number) =>
    call("POST", `/live/${code}/answer`, { live: tok[who], body: { questionIndex, choice } });
  const join = (name: unknown, extra: { bearer?: string } = {}) =>
    call("POST", `/live/${code}/join`, { ...extra, body: { name } });
  const sql = (text: string, params: unknown[] = []) => db.pool.query(text, params);
  const user = async (role: string, first: string) =>
    (
      await sql(`INSERT INTO users (first_name, last_name, role, email) VALUES ($1, 'T', $2, $3) RETURNING id`, [
        first,
        role,
        `${first.toLowerCase()}@example.test`,
      ])
    ).rows[0].id as string;
  const newGame = async (userId = teacher) => {
    const g = await call("POST", "/live-host/games", { userId, body: GAME });
    assert.equal(g.status, 201);
    return { id: g.json.id as string, code: g.json.code as string };
  };
  const seedPlayers = (gameId: string, n: number) =>
    sql(
      `INSERT INTO live_players (game_id, name, name_key, token_hash)
       SELECT $1::uuid, 'p' || i, 'p' || i, 'seed-' || $1::text || '-' || i FROM generate_series(1, $2::int) AS i`,
      [gameId, n],
    );
  const badTokenCount = async () =>
    Number((await sql(`SELECT coalesce(sum(count), 0) AS n FROM rate_limit_buckets WHERE key LIKE 'live-bad-token:%'`)).rows[0].n);
  const backdate = (seconds: number) =>
    sql(`UPDATE live_games SET question_started_at = now() - ($2 || ' seconds')::interval WHERE id = $1`, [gameId, seconds]);

  before(async () => {
    db = await setupTestDb();
    teacher = await user("teacher", "Lina");
    otherTeacher = await user("teacher", "Omar");
    studentUser = await user("student", "Noor");
    parentUser = await user("parent", "Pat");
    // LIVE_TEST_RLS=on reruns the same game with row-level security enforced, to
    // prove the iqraa_app grants on the three live_* tables are enough.
    server = await startServer({ databaseUrl: db.url, env: { RLS_ENFORCE: process.env["LIVE_TEST_RLS"] } });
  });
  after(async () => {
    await server?.stop();
    await db?.drop();
  });

  it("creates only for a signed-in teacher, and validates the game", async () => {
    assert.equal((await call("POST", "/live-host/games", { body: GAME })).status, 401);
    assert.equal((await call("POST", "/live-host/games", { userId: studentUser, body: GAME })).status, 403);
    const bad = await call("POST", "/live-host/games", { userId: teacher, body: { ...GAME, questions: [Q(1)] } });
    assert.equal(bad.status, 400);
    assert.equal(bad.json.code, "invalid");

    const ok = await call("POST", "/live-host/games", { userId: teacher, body: GAME });
    assert.equal(ok.status, 201);
    assert.match(ok.json.code, /^[A-HJ-NP-Z2-9]{6}$/);
    gameId = ok.json.id;
    code = ok.json.code;

    const lobby = await host();
    assert.equal(lobby.status, 200);
    assert.equal(lobby.json.state, "lobby");
    assert.equal(lobby.json.currentIndex, -1);
    assert.equal(lobby.json.questionCount, 3);
    assert.equal(lobby.json.current, null);
    assert.deepEqual(lobby.json.answerCounts, []);
    assert.ok(lobby.json.serverNow);
  });

  it("is invisible to another teacher: read, advance and kick all 404", async () => {
    for (const r of [
      await host(otherTeacher),
      await advance("start", otherTeacher),
      await call("POST", `/live-host/games/${gameId}/kick`, { userId: otherTeacher, body: { playerId: gameId } }),
      await call("GET", "/live-host/games/not-a-uuid", { userId: teacher }),
    ]) {
      assert.equal(r.status, 404);
      assert.equal(r.json.code, "game_not_found");
    }
    assert.equal((await host()).json.state, "lobby", "the other teacher moved nothing");
  });

  it("joins players: signed-in student recorded, junk session anonymous, duplicate name refused", async () => {
    const sara = await join("  Sara ");
    assert.equal(sara.status, 201);
    assert.equal(sara.json.name, "Sara");
    tok["sara"] = sara.json.playerToken;
    pid["sara"] = sara.json.playerId;

    const noor = await join("Noor", { bearer: accessToken(studentUser) });
    assert.equal(noor.status, 201);
    tok["noor"] = noor.json.playerToken;
    pid["noor"] = noor.json.playerId;

    // A parent's session, and a junk one, are just anonymous players.
    const pat = await join("Pat", { bearer: accessToken(parentUser) });
    assert.equal(pat.status, 201);
    const junk = await join("Junk", { bearer: "not.a.jwt" });
    assert.equal(junk.status, 201);
    tok["pat"] = pat.json.playerToken;
    pid["pat"] = pat.json.playerId;

    const dup = await join("sara");
    assert.equal(dup.status, 409);
    assert.equal(dup.json.code, "name_taken");
    assert.equal((await join("   ")).status, 400);
    assert.equal((await join("a\u0000b")).status, 400);
    assert.equal((await join("x".repeat(25))).status, 400);

    // The code is forgiving the way /take's is, and unknown codes are 404.
    const typed = await call("POST", `/live/${code.toLowerCase().slice(0, 3)}-${code.slice(3)}/join`, { body: { name: "Typed" } });
    assert.equal(typed.status, 201);
    assert.equal((await call("POST", "/live/ZZZZZZ/join", { body: { name: "Nobody" } })).status, 404);

    const view = await host();
    const bySigned = Object.fromEntries(view.json.players.map((p: { name: string; signedIn: boolean }) => [p.name, p.signedIn]));
    assert.equal(bySigned["Noor"], true);
    assert.equal(bySigned["Sara"], false);
    assert.equal(bySigned["Pat"], false);
    assert.equal(bySigned["Junk"], false);
    // The DB row of the signed-in player carries the user id, the others do not.
    const rows = (await sql(`SELECT name, user_id FROM live_players WHERE game_id = $1`, [gameId])).rows;
    assert.equal(rows.find(r => r.name === "Noor").user_id, studentUser);
    assert.equal(rows.find(r => r.name === "Pat").user_id, null);
  });

  it("a player's state needs their own token", async () => {
    const none = await call("GET", `/live/${code}/state`);
    assert.equal(none.status, 401);
    assert.equal(none.json.code, "token_invalid");
    const wrong = await call("GET", `/live/${code}/state`, { live: "f".repeat(64) });
    assert.equal(wrong.status, 401);
    assert.equal(wrong.json.code, "token_invalid");
    // L1: an unknown code, a live code with a junk token, and a real token used
    // on another game's code are ONE answer, so codes cannot be probed.
    const other = await newGame();
    const unknownCode = await call("GET", `/live/ZZZZZZ/state`, { live: "f".repeat(64) });
    const foreignToken = await call("GET", `/live/${other.code}/state`, { live: tok["sara"] });
    for (const r of [unknownCode, foreignToken]) {
      assert.equal(r.status, 401);
      assert.deepEqual(r.json, wrong.json);
    }
    assert.equal((await call("GET", `/live/ZZZZZZ/state`, { live: tok["sara"] })).status, 401);
    const unknownAnswer = await call("POST", `/live/ZZZZZZ/answer`, { live: "f".repeat(64), body: { questionIndex: 0, choice: 0 } });
    const junkAnswer = await call("POST", `/live/${code}/answer`, { live: "f".repeat(64), body: { questionIndex: 0, choice: 0 } });
    assert.equal(unknownAnswer.status, 401);
    assert.deepEqual(unknownAnswer.json, junkAnswer.json);
    assert.equal(junkAnswer.json.code, "token_invalid");

    const s = await state("sara");
    assert.equal(s.status, 200);
    assert.equal(s.json.state, "lobby");
    assert.equal(s.json.question, null);
    assert.equal(s.json.reveal, null);
    assert.equal(s.json.me.name, "Sara");
    assert.equal(s.json.me.score, 0);
    assert.equal(s.json.questionCount, 3);
    assert.equal(s.json.playerCount, 5, "Sara, Noor, Pat, Junk, Typed");
  });

  it("refuses a transition that is not on the path, then starts", async () => {
    for (const action of ["reveal", "next", "bogus"]) {
      const r = await advance(action);
      assert.equal(r.status, 409, action);
      assert.equal(r.json.code, "bad_transition");
    }
    const started = await advance("start");
    assert.equal(started.status, 200);
    assert.equal(started.json.state, "question");
    assert.equal(started.json.currentIndex, 0);
    assert.ok(started.json.questionStartedAt);
    // The host may see the key while the question is open.
    assert.deepEqual(started.json.current, { content: "سؤال 1", options: ["أ", "ب", "ج"], correctIndex: 1 });
    assert.deepEqual(started.json.answerCounts, [0, 0, 0]);
    assert.equal((await advance("start")).status, 409, "start twice");
  });

  it("hides the key from players while the question is open", async () => {
    const s = await state("sara");
    assert.equal(s.json.state, "question");
    assert.deepEqual(s.json.question, { content: "سؤال 1", options: ["أ", "ب", "ج"] });
    assert.equal(s.json.answered, false);
    assert.equal(s.json.reveal, null);
    assert.ok(!s.text.includes("correctIndex"), "the key must not appear in a question-state response");
    assert.deepEqual(s.json.top, []);
  });

  it("scores by the server clock: fast correct > slow correct > wrong 0", async () => {
    // Stale index, impossible choice, junk body.
    const stale = await answer("sara", 1, 1);
    assert.equal(stale.status, 409);
    assert.equal(stale.json.code, "too_late");
    assert.equal((await answer("sara", 0, 9)).status, 400);
    assert.equal((await call("POST", `/live/${code}/answer`, { live: tok["sara"], body: { questionIndex: "0", choice: 1 } })).status, 400);

    const fast = await answer("sara", 0, 1);
    assert.equal(fast.status, 200);
    assert.deepEqual(fast.json, { accepted: true }, "no correctness before the reveal");

    const again = await answer("sara", 0, 2);
    assert.equal(again.status, 409);
    assert.equal(again.json.code, "already_answered");

    await backdate(10);
    assert.equal((await answer("noor", 0, 1)).status, 200);
    assert.equal((await answer("pat", 0, 0)).status, 200);

    const view = await host();
    assert.deepEqual(view.json.answerCounts, [1, 2, 0]);
    assert.equal(view.json.answeredCount, 3);
    const answered = view.json.players.filter((p: { answeredCurrent: boolean }) => p.answeredCurrent).map((p: { name: string }) => p.name).sort();
    assert.deepEqual(answered, ["Noor", "Pat", "Sara"]);

    const mine = await state("sara");
    assert.equal(mine.json.answered, true);
    assert.ok(!mine.text.includes("correctIndex"));
    assert.ok(!mine.text.includes("myPoints"));
  });

  it("reveals the key, each player's result and the top list", async () => {
    assert.equal((await advance("reveal")).json.state, "reveal");
    const sara = (await state("sara")).json;
    const noor = (await state("noor")).json;
    const pat = (await state("pat")).json;

    assert.equal(sara.state, "reveal");
    assert.equal(sara.reveal.correctIndex, 1);
    assert.equal(sara.reveal.myChoice, 1);
    assert.equal(sara.reveal.myCorrect, true);
    assert.ok(sara.reveal.myPoints > 900, `fast answer ${sara.reveal.myPoints}`);
    assert.ok(noor.reveal.myPoints > 700 && noor.reveal.myPoints < 800, `slow answer ${noor.reveal.myPoints}`);
    assert.ok(sara.reveal.myPoints > noor.reveal.myPoints);
    assert.equal(pat.reveal.myCorrect, false);
    assert.equal(pat.reveal.myPoints, 0);
    assert.equal(pat.reveal.myChoice, 0);
    assert.equal(sara.me.score, sara.reveal.myPoints);
    assert.equal(sara.me.rank, 1);
    assert.equal(noor.me.rank, 2);
    // Pat, Junk and Typed all have 0: they tie behind the two scorers.
    assert.equal(pat.me.rank, 3);
    assert.deepEqual(sara.top.slice(0, 2).map((t: { name: string }) => t.name), ["Sara", "Noor"]);
    assert.ok(sara.top.length <= 5);
    // Only names and scores in the leaderboard, never another player's choice.
    for (const t of sara.top) assert.deepEqual(Object.keys(t).sort(), ["name", "score"]);

    // A reveal does not accept late answers either.
    assert.equal((await answer("sara", 0, 1)).status, 409);
  });

  it("removes a kicked player at once", async () => {
    assert.equal((await call("POST", `/live-host/games/${gameId}/kick`, { userId: teacher, body: { playerId: pid["pat"] } })).status, 204);
    const gone = await state("pat");
    assert.equal(gone.status, 401);
    assert.equal(gone.json.code, "kicked");
    assert.equal((await answer("pat", 0, 1)).status, 401);
    assert.equal((await call("POST", `/live-host/games/${gameId}/kick`, { userId: teacher, body: { playerId: pid["pat"] } })).status, 404);
    const names = (await host()).json.players.map((p: { name: string }) => p.name);
    assert.ok(!names.includes("Pat"));
    assert.equal((await state("sara")).json.playerCount, 4, "a kicked player is not counted");
  });

  it("lets a late joiner in during a reveal, and plays them from the next question", async () => {
    const late = await join("Late");
    assert.equal(late.status, 201);
    tok["late"] = late.json.playerToken;
    const lateState = (await state("late")).json;
    assert.equal(lateState.state, "reveal");
    assert.equal(lateState.me.score, 0);

    const next = await advance("next");
    assert.equal(next.json.state, "question");
    assert.equal(next.json.currentIndex, 1);
    assert.deepEqual(next.json.answerCounts, [0, 0, 0], "counts restart for the new question");

    // The old index is closed even though the game is open.
    const old = await answer("sara", 0, 1);
    assert.equal(old.status, 409);
    assert.equal(old.json.code, "too_late");

    assert.equal((await answer("late", 1, 1)).status, 200);
    // Past duration + 2 s grace: too late by the clock, not by the index.
    await backdate(30);
    const slow = await answer("sara", 1, 1);
    assert.equal(slow.status, 409);
    assert.equal(slow.json.code, "too_late");
  });

  it("plays out to the end, with the final top and ranks, and then refuses everything", async () => {
    assert.equal((await advance("reveal")).json.state, "reveal");
    assert.equal((await advance("next")).json.currentIndex, 2);
    assert.equal((await answer("noor", 2, 1)).status, 200);
    assert.equal((await advance("reveal")).json.state, "reveal");
    const done = await advance("next");
    assert.equal(done.json.state, "ended", "next after the last question ends the game");
    assert.equal(done.json.current, null);

    const ended = await host();
    assert.equal(ended.json.state, "ended");
    const row = (await sql(`SELECT state, ended_at FROM live_games WHERE id = $1`, [gameId])).rows[0];
    assert.equal(row.state, "ended");
    assert.ok(row.ended_at);

    const sara = (await state("sara")).json;
    const noor = (await state("noor")).json;
    assert.equal(sara.state, "ended");
    assert.equal(sara.question, null);
    assert.equal(sara.reveal, null);
    assert.ok(sara.top.length >= 1 && sara.top.length <= 5);
    // Noor answered q0 slowly and q2 correctly; Sara q0 fast only; Late q1 only.
    assert.ok(noor.me.score > sara.me.score);
    assert.equal(noor.me.rank, 1);
    assert.equal(sara.top[0].name, "Noor");
    assert.equal(sara.top[0].score, noor.me.score);
    const lateScore = (await state("late")).json.me.score as number;
    assert.equal(sara.me.rank, 2 + (lateScore > sara.me.score ? 1 : 0));

    assert.equal((await join("TooLate")).status, 404, "no joining an ended game");
    assert.equal((await answer("sara", 2, 1)).status, 409);
    const again = await advance("start");
    assert.equal(again.status, 409);
    assert.equal(again.json.code, "bad_transition");
    assert.equal((await advance("end")).status, 200, "ending twice is harmless");
  });

  it("treats a game older than six hours as gone for players and ended for the host", async () => {
    const g = await call("POST", "/live-host/games", { userId: teacher, body: GAME });
    const oldCode = g.json.code as string;
    const j = await call("POST", `/live/${oldCode}/join`, { body: { name: "Early" } });
    assert.equal(j.status, 201);
    await sql(`UPDATE live_games SET created_at = now() - interval '7 hours' WHERE id = $1`, [g.json.id]);

    const s = await call("GET", `/live/${oldCode}/state`, { live: j.json.playerToken });
    assert.equal(s.status, 404);
    assert.equal(s.json.code, "game_not_found");
    assert.equal((await call("POST", `/live/${oldCode}/join`, { body: { name: "Later" } })).status, 404);
    const h = await call("GET", `/live-host/games/${g.json.id}`, { userId: teacher });
    assert.equal(h.status, 200);
    assert.equal(h.json.state, "ended");
  });

  it("caps a game at 100 players; a kicked player frees a seat", async () => {
    const g = await newGame();
    await seedPlayers(g.id, 100);
    const full = await call("POST", `/live/${g.code}/join`, { body: { name: "Extra" } });
    assert.equal(full.status, 409);
    assert.equal(full.json.code, "game_full");

    await sql(`UPDATE live_players SET kicked_at = now() WHERE game_id = $1 AND name = 'p1'`, [g.id]);
    assert.equal((await call("POST", `/live/${g.code}/join`, { body: { name: "Extra" } })).status, 201);
    assert.equal((await call("POST", `/live/${g.code}/join`, { body: { name: "Extra2" } })).json.code, "game_full");
  });

  it("cannot be raced past the cap by simultaneous joins", async () => {
    const g = await newGame();
    await seedPlayers(g.id, 98);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) => call("POST", `/live/${g.code}/join`, { body: { name: `Racer${i}` } })),
    );
    assert.equal(results.filter(r => r.status === 201).length, 2);
    assert.equal(results.filter(r => r.json?.code === "game_full").length, 6);
    const n = (await sql(`SELECT count(*)::int AS n FROM live_players WHERE game_id = $1 AND kicked_at IS NULL`, [g.id])).rows[0].n;
    assert.equal(n, 100);
  });

  it("puts no per-IP bucket on valid polls from one address", async () => {
    // Every request here comes from 127.0.0.1, like a classroom behind one NAT.
    const before = await badTokenCount();
    for (let i = 0; i < 30; i++) assert.equal((await state("sara")).status, 200);
    assert.equal((await answer("sara", 2, 1)).status, 409); // a rejected answer, but a valid token
    assert.equal(await badTokenCount(), before, "valid tokens never charge the bad-token bucket");
    const ipBuckets = (await sql(`SELECT key FROM rate_limit_buckets WHERE key LIKE 'live-ip:%'`)).rows;
    assert.deepEqual(ipBuckets, [], "no per-IP bucket exists for /state or /answer");
    const perToken = (await sql(`SELECT key FROM rate_limit_buckets WHERE key LIKE 'live-state:%'`)).rows;
    assert.ok(perToken.length >= 1, "valid polls are limited per token");
  });

  it("charges the per-IP bucket for a rejected token", async () => {
    const before = await badTokenCount();
    assert.equal((await call("GET", `/live/${code}/state`, { live: "e".repeat(64) })).status, 401);
    assert.equal(await badTokenCount(), before + 1);
  });

  it("deletes games older than seven days (and their players) when a game is created", async () => {
    const old = (
      await sql(
        `INSERT INTO live_games (code, host_id, title, lang, questions, created_at)
         VALUES ('OLDGAM', $1, 'old', 'ar', '[]'::jsonb, now() - interval '8 days') RETURNING id`,
        [teacher],
      )
    ).rows[0].id as string;
    const recent = (
      await sql(
        `INSERT INTO live_games (code, host_id, title, lang, questions, created_at)
         VALUES ('NEWGAM', $1, 'recent', 'ar', '[]'::jsonb, now() - interval '6 days') RETURNING id`,
        [teacher],
      )
    ).rows[0].id as string;
    await seedPlayers(old, 3);
    await seedPlayers(recent, 2);
    await newGame();
    const left = (await sql(`SELECT id FROM live_games WHERE id = ANY($1::uuid[])`, [[old, recent]])).rows.map(r => r.id);
    assert.deepEqual(left, [recent]);
    assert.equal((await sql(`SELECT count(*)::int AS n FROM live_players WHERE game_id = $1`, [old])).rows[0].n, 0);
    assert.equal((await sql(`SELECT count(*)::int AS n FROM live_players WHERE game_id = $1`, [recent])).rows[0].n, 2);
  });

  it("limits a teacher to 30 new games an hour", async () => {
    const results = [];
    for (let i = 0; i < 32; i++) results.push((await call("POST", "/live-host/games", { userId: otherTeacher, body: GAME })).status);
    assert.equal(results.filter(s => s === 201).length, 30);
    assert.deepEqual(results.slice(30), [429, 429]);
    // Per teacher: the first teacher is unaffected.
    assert.equal((await call("POST", "/live-host/games", { userId: teacher, body: GAME })).status, 201);
  });

  it("slows a prober at 300 rejected tokens a minute, and never a valid player", async () => {
    let limited = 0;
    for (let i = 0; i < 310; i++) {
      const r = await call("GET", `/live/${code}/state`, { live: `${i}`.padStart(64, "0") });
      if (r.status === 429) {
        limited++;
        assert.equal(r.json.code, "rate_limited");
      } else assert.equal(r.status, 401);
    }
    assert.ok(limited >= 1, "the prober was limited");
    assert.equal((await state("sara")).status, 200, "a valid player on the same address is untouched");
  });
});
