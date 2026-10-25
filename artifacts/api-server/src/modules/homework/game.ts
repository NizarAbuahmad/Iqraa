/**
 * Games as homework — the rules that need no database. A teacher attaches a
 * lesson game (`kind: "game"` resource); a student's results go into
 * `game_results`, best-of per roster row (lib/homeworkGame.ts).
 */
import type { HomeworkResource } from "@workspace/db";

/**
 * `exercises` is the Math Corner's «اختبر نفسك» set for a maths lesson: not a game,
 * but it attaches, scores and reports exactly like one, so it shares the rows.
 */
export const GAMES =["memory", "scramble", "spot", "meaning", "exercises"] as const;
export const GAMES_TEXT = "memory, scramble, spot, meaning or exercises";
export type GameKind = (typeof GAMES)[number];

export const GAME_TITLE_MAX = 200;
export const GAME_TOTAL_MAX = 100;

export function isGame(v: unknown): v is GameKind {
  return typeof v === "string" && (GAMES as readonly string[]).includes(v);
}

/** The attachment's identity: one lesson game is attached to a homework once. */
export function gameResourceKey(lessonId: string, game: GameKind): string {
  return `game:${lessonId}:${game}`;
}

export interface GameResultInput { lessonId: string; game: GameKind; score: number; total: number }
export type ParsedGameResult =
  | { ok: true; value: GameResultInput }
  | { ok: false; error: string; code: "invalid" };

export const GAME_LESSON_ID_MAX = 200;

/** `{ lessonId, game, score, total }`: a lesson id, a known game, integers, 0 ≤ score ≤ total, 1 ≤ total ≤ 100. */
export function parseGameResult(body: unknown): ParsedGameResult {
  const b = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
  const { lessonId, game, score, total } = b;
  const fail = (error: string): ParsedGameResult => ({ ok: false, error, code: "invalid" });
  if (typeof lessonId !== "string" || lessonId === "" || lessonId.length > GAME_LESSON_ID_MAX) {
    return fail(`lessonId must be a lesson id of at most ${GAME_LESSON_ID_MAX} characters`);
  }
  if (!isGame(game)) return fail(`game must be ${GAMES_TEXT}`);
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > GAME_TOTAL_MAX) {
    return fail(`total must be a whole number from 1 to ${GAME_TOTAL_MAX}`);
  }
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > (total as number)) {
    return fail("score must be a whole number from 0 to total");
  }
  return { ok: true, value: { lessonId, game, score: score as number, total: total as number } };
}

/** The (lesson, game) pairs a homework carries, in attachment order. */
export function attachedGames(resources: readonly HomeworkResource[]): Array<{ lessonId: string; game: string }> {
  return resources.flatMap(r => (r.kind === "game" ? [{ lessonId: r.lessonId, game: r.game }] : []));
}

/**
 * An app that predates games drops the `kind: "game"` items it cannot read and
 * then PATCHes the whole list, which would silently detach them. Unless the
 * client says it knows about games (`gamesIncluded: true`), the games the
 * homework already has and the body left out are appended after the body's own
 * items — as many as fit under `max`, the body's items first.
 *
 * The same trap recurs with every game added later: an app that knows games but
 * not the newest one drops that attachment too. So a client that does send
 * `gamesIncluded: true` also says which games it knows (`knownGames`, absent =
 * the four that existed before `meaning`), and only an attachment of a game it
 * does NOT know is carried over (`known`): for a game it knows, leaving it out
 * is a real removal.
 */
export const LEGACY_GAMES: readonly string[] = ["memory", "scramble", "spot", "exercises"];

export function knownGamesOf(v: unknown): readonly string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : LEGACY_GAMES;
}

export function carryOverGames(
  resolved: HomeworkResource[],
  existing: readonly HomeworkResource[],
  max: number,
  known?: readonly string[],
): HomeworkResource[] {
  const out = [...resolved];
  const have = new Set(out.flatMap(r => (r.kind === "game" ? [gameResourceKey(r.lessonId, r.game)] : [])));
  for (const r of existing) {
    if (r.kind !== "game" || out.length >= max) continue;
    if (known?.includes(r.game)) continue;
    const key = gameResourceKey(r.lessonId, r.game);
    if (have.has(key)) continue;
    have.add(key);
    out.push(r);
  }
  return out;
}

export interface GameScore { score: number; total: number }

/**
 * Whether `next` beats `prev`: a higher score/total ratio (cross-multiplied, so
 * no float), and a tie keeps `prev`. The upsert in lib/homeworkGame.ts says the
 * same thing in SQL; game.test.ts pins this one and the DB test pins the SQL.
 */
export function isBetterResult(next: GameScore, prev: GameScore): boolean {
  return next.score * prev.total > prev.score * next.total;
}
