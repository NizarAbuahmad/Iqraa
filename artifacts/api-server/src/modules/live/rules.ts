/**
 * The rules of a live game, as pure functions — no database, no clock of their
 * own (every one takes `now`), so each can be pinned by a unit test.
 *
 * Two properties matter more than the rest:
 *
 * 1. **The server clock decides.** An answer's points come from
 *    `now − questionStartedAt`, never from anything a device sends.
 * 2. **A player never sees the key early.** `playerView` is the only projection
 *    a player's route returns, and it only mentions `correctIndex` in `reveal`
 *    (and `ended`'s leaderboard carries names and scores, nothing else).
 *    `liveRules.test.ts` serialises the whole view in lobby/question and asserts
 *    the key is not in it.
 */
import type { LiveGameState, LiveQuestion } from "@workspace/db";

export const GAME_TTL_MS = 6 * 60 * 60 * 1000;
export const ANSWER_GRACE_SECONDS = 2;
export const DEFAULT_SECONDS = 20;

export type Invalid = { ok: false; error: string };
type Ok<T> = { ok: true; value: T };

export interface CreateInput {
  title: string;
  lang: "ar" | "en";
  seconds: number;
  questions: LiveQuestion[];
}

const bad = (error: string): Invalid => ({ ok: false, error });
const len = (s: string): number => [...s].length;

export function validateCreate(body: unknown): Ok<CreateInput> | Invalid {
  if (!body || typeof body !== "object") return bad("body must be an object");
  const b = body as Record<string, unknown>;

  if (typeof b["title"] !== "string") return bad("title is required");
  const title = b["title"].trim();
  if (len(title) < 1 || len(title) > 120) return bad("title must be 1 to 120 characters");

  if (b["lang"] !== "ar" && b["lang"] !== "en") return bad("lang must be 'ar' or 'en'");

  let seconds = DEFAULT_SECONDS;
  if (b["seconds"] !== undefined) {
    const s = b["seconds"];
    if (typeof s !== "number" || !Number.isInteger(s) || s < 10 || s > 60) return bad("seconds must be an integer from 10 to 60");
    seconds = s;
  }

  const qs = b["questions"];
  if (!Array.isArray(qs) || qs.length < 3 || qs.length > 30) return bad("questions must be 3 to 30 items");
  const questions: LiveQuestion[] = [];
  for (let i = 0; i < qs.length; i++) {
    const q = qs[i] as Record<string, unknown> | null;
    const at = `question ${i + 1}`;
    if (!q || typeof q !== "object") return bad(`${at} must be an object`);
    if (typeof q["content"] !== "string") return bad(`${at}: content is required`);
    const content = q["content"].trim();
    if (len(content) < 1 || len(content) > 500) return bad(`${at}: content must be 1 to 500 characters`);
    const opts = q["options"];
    if (!Array.isArray(opts) || opts.length < 2 || opts.length > 6) return bad(`${at}: options must be 2 to 6 items`);
    const options: string[] = [];
    for (const o of opts) {
      if (typeof o !== "string") return bad(`${at}: every option must be text`);
      const t = o.trim();
      if (len(t) < 1 || len(t) > 200) return bad(`${at}: each option must be 1 to 200 characters`);
      options.push(t);
    }
    const ci = q["correctIndex"];
    if (typeof ci !== "number" || !Number.isInteger(ci) || ci < 0 || ci >= options.length) {
      return bad(`${at}: correctIndex must point at an option`);
    }
    questions.push({ content, options, correctIndex: ci });
  }
  return { ok: true, value: { title, lang: b["lang"], seconds, questions } };
}

// C0/C1 controls, plus invisible, bidi and "blank-looking" characters that
// would let a name spoof the projector or render empty: zero-width, bidi
// marks/overrides/isolates, soft hyphen, Arabic letter mark, Hangul fillers,
// braille blank, Mongolian vowel separator.
// eslint-disable-next-line no-control-regex
const FORBIDDEN_IN_NAME = /[\u0000-\u001F\u007F-\u009F­؜ᅟᅠ᠎​‎‏⁠‪-‮⁦-⁩⠀ㅤ﻿]/;
const HAS_LETTER_OR_DIGIT = /[\p{L}\p{N}]/u;
// Stacked combining marks ("zalgo") spill over neighbouring projector rows.
const MARK_STACK = /\p{M}{4,}/u;

export const MAX_PLAYERS = 100;

/** Whether a game with `count` non-kicked players can take one more. */
export function hasRoom(count: number, max: number = MAX_PLAYERS): boolean {
  return count < max;
}

export function normalizeName(raw: unknown): { name: string; key: string } | null {
  if (typeof raw !== "string") return null;
  if (FORBIDDEN_IN_NAME.test(raw)) return null;
  const name = raw.normalize("NFC").replace(/\s+/g, " ").trim();
  if (len(name) < 1 || len(name) > 24) return null;
  // Marks are counted decomposed: in NFC the first one folds into its base letter.
  if (!HAS_LETTER_OR_DIGIT.test(name) || MARK_STACK.test(name.normalize("NFD"))) return null;
  // NFKC folds look-alikes (full-width letters, ligatures) so they cannot dodge
  // the uniqueness key; the name shown stays as typed.
  return { name, key: name.normalize("NFKC").toLowerCase() };
}

/** Past this age a game is gone for players, whatever its state. */
export function isExpired(game: { createdAt: Date }, now: Date): boolean {
  return now.getTime() - game.createdAt.getTime() > GAME_TTL_MS;
}

/** Over, for joining and for the host: ended on purpose, or simply too old. */
export function isEnded(game: { endedAt: Date | null; createdAt: Date }, now: Date): boolean {
  return game.endedAt !== null || isExpired(game, now);
}

export function pointsFor(seconds: number, elapsedMs: number): number {
  const left = Math.max(0, seconds - Math.max(0, elapsedMs) / 1000);
  return Math.round(500 + (500 * left) / seconds);
}

export interface AnswerInput {
  state: LiveGameState;
  currentIndex: number;
  questionStartedAt: Date | null;
  seconds: number;
  questions: LiveQuestion[];
  questionIndex: number;
  choice: number;
}

export type AnswerOutcome =
  | { ok: true; correct: boolean; points: number }
  | { ok: false; status: 400 | 409; code: "invalid" | "too_late" };

export function scoreAnswer(a: AnswerInput, now: Date): AnswerOutcome {
  if (
    a.state !== "question" ||
    a.questionIndex !== a.currentIndex ||
    !a.questionStartedAt
  ) {
    return { ok: false, status: 409, code: "too_late" };
  }
  const elapsedMs = now.getTime() - a.questionStartedAt.getTime();
  if (elapsedMs > (a.seconds + ANSWER_GRACE_SECONDS) * 1000) {
    return { ok: false, status: 409, code: "too_late" };
  }
  const q = a.questions[a.currentIndex];
  if (!q || !Number.isInteger(a.choice) || a.choice < 0 || a.choice >= q.options.length) {
    return { ok: false, status: 400, code: "invalid" };
  }
  const correct = a.choice === q.correctIndex;
  return { ok: true, correct, points: correct ? pointsFor(a.seconds, elapsedMs) : 0 };
}

export type Action = "start" | "reveal" | "next" | "end";
export const ACTIONS: readonly Action[] = ["start", "reveal", "next", "end"];

export function nextState(
  game: { state: LiveGameState; currentIndex: number },
  questionCount: number,
  action: unknown,
): { state: LiveGameState; currentIndex: number } | null {
  switch (action) {
    case "start":
      return game.state === "lobby" ? { state: "question", currentIndex: 0 } : null;
    case "reveal":
      return game.state === "question" ? { state: "reveal", currentIndex: game.currentIndex } : null;
    case "next":
      if (game.state !== "reveal") return null;
      return game.currentIndex + 1 >= questionCount
        ? { state: "ended", currentIndex: game.currentIndex }
        : { state: "question", currentIndex: game.currentIndex + 1 };
    case "end":
      return { state: "ended", currentIndex: game.currentIndex };
    default:
      return null;
  }
}

// ---- projections -----------------------------------------------------------

export interface GameRow {
  id: string;
  code: string;
  title: string;
  lang: string;
  questions: LiveQuestion[];
  seconds: number;
  state: LiveGameState;
  currentIndex: number;
  questionStartedAt: Date | null;
  createdAt: Date;
  endedAt: Date | null;
}

export interface Scored {
  id: string;
  name: string;
  score: number;
  signedIn: boolean;
}

/** Score desc, then name — one order for the host list, rank and top five. */
export function rankPlayers<T extends { name: string; score: number }>(players: readonly T[]): T[] {
  return [...players].sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}

/** The state a viewer sees: an expired game is over whatever its row says. */
function effectiveState(game: GameRow, now: Date): LiveGameState {
  return isEnded(game, now) ? "ended" : game.state;
}

const iso = (d: Date | null): string | null => (d ? d.toISOString() : null);

export function hostView(
  game: GameRow,
  players: readonly Scored[],
  currentAnswers: readonly { playerId: string; choice: number }[],
  now: Date,
) {
  const state = effectiveState(game, now);
  const open = state === "question" || state === "reveal";
  const q = open ? game.questions[game.currentIndex] : undefined;
  const counts = q ? q.options.map(() => 0) : [];
  const answered = new Set<string>();
  if (q) {
    for (const a of currentAnswers) {
      if (a.choice >= 0 && a.choice < counts.length) counts[a.choice] = (counts[a.choice] ?? 0) + 1;
      answered.add(a.playerId);
    }
  }
  return {
    id: game.id,
    code: game.code,
    title: game.title,
    lang: game.lang,
    state,
    currentIndex: game.currentIndex,
    questionCount: game.questions.length,
    seconds: game.seconds,
    questionStartedAt: iso(game.questionStartedAt),
    serverNow: now.toISOString(),
    current: q ? { content: q.content, options: q.options, correctIndex: q.correctIndex } : null,
    answerCounts: counts,
    answeredCount: players.filter(p => answered.has(p.id)).length,
    players: rankPlayers(players).map(p => ({
      id: p.id,
      name: p.name,
      score: p.score,
      answeredCurrent: answered.has(p.id),
      signedIn: p.signedIn,
    })),
  };
}

export interface MyAnswer {
  choice: number;
  correct: boolean;
  points: number;
}

export function playerView(
  game: GameRow,
  me: { id: string; name: string },
  players: readonly Scored[],
  myAnswer: MyAnswer | null,
  now: Date,
) {
  const state = effectiveState(game, now);
  const ranked = rankPlayers(players);
  const mine = ranked.find(p => p.id === me.id);
  const score = mine?.score ?? 0;
  const rank = 1 + ranked.filter(p => p.score > score).length;
  const open = state === "question" || state === "reveal";
  const q = open ? game.questions[game.currentIndex] : undefined;

  return {
    state,
    title: game.title,
    lang: game.lang,
    currentIndex: game.currentIndex,
    questionCount: game.questions.length,
    seconds: game.seconds,
    questionStartedAt: iso(game.questionStartedAt),
    serverNow: now.toISOString(),
    // The key is not in this object: `options` only. See the file header.
    question: q ? { content: q.content, options: q.options } : null,
    answered: open && myAnswer !== null,
    reveal:
      state === "reveal" && q
        ? {
            correctIndex: q.correctIndex,
            myChoice: myAnswer ? myAnswer.choice : null,
            myCorrect: myAnswer ? myAnswer.correct : false,
            myPoints: myAnswer ? myAnswer.points : 0,
          }
        : null,
    me: { name: me.name, score, rank },
    // `players` is the scoreboard, which already leaves out kicked players.
    playerCount: players.length,
    top: state === "reveal" || state === "ended" ? ranked.slice(0, 5).map(p => ({ name: p.name, score: p.score })) : [],
  };
}
