/**
 * A student finishing a game that is attached to their homework.
 *
 * Same rows as the tick (lib/homeworkDone.ts `ownHomeworkRows`): the account's
 * own roster rows in the homework's class, and nothing else. The homework must
 * carry that very (lesson, game), and every failure is the one answer, `null`.
 *
 * The result is the BEST so far per (homework, roster row, lesson, game): the upsert
 * keeps the higher score/total ratio, and a tie keeps the existing row
 * (`isBetterResult` in modules/homework/game.ts says the same in TypeScript).
 * Each call counts as an attempt and moves `played_at`. Playing also ticks the
 * homework off, for the same rows. Everything is written before this returns —
 * the route answers afterwards (Cloud Run throttles work after `res.json`).
 */
import { db, gameResults } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ownHomeworkRows, tickRows } from "./homeworkDone.ts";
import type { GameResultInput, GameScore } from "../modules/homework/game.ts";

export async function recordGameResult(
  userId: string,
  homeworkId: string,
  input: GameResultInput,
): Promise<{ best: GameScore; attempts: number } | null> {
  const own = await ownHomeworkRows(userId, homeworkId);
  if (!own) return null;
  // Both halves must match one attachment: a result for lesson A never satisfies lesson B's game.
  if (!own.resources.some(r => r.kind === "game" && r.lessonId === input.lessonId && r.game === input.game)) return null;

  // Qualified on purpose: inside ON CONFLICT an unqualified column can be ambiguous with `excluded`.
  const better = sql`excluded.score * "game_results"."total" > "game_results"."score" * excluded.total`;
  const saved = await db
    .insert(gameResults)
    .values(own.rows.map(studentId => ({ homeworkId, studentId, lessonId: input.lessonId, game: input.game, score: input.score, total: input.total })))
    .onConflictDoUpdate({
      target: [gameResults.homeworkId, gameResults.studentId, gameResults.lessonId, gameResults.game],
      set: {
        score: sql`CASE WHEN ${better} THEN excluded.score ELSE "game_results"."score" END`,
        total: sql`CASE WHEN ${better} THEN excluded.total ELSE "game_results"."total" END`,
        attempts: sql`"game_results"."attempts" + 1`,
        playedAt: sql`now()`,
      },
    })
    .returning({ studentId: gameResults.studentId, score: gameResults.score, total: gameResults.total, attempts: gameResults.attempts });

  await tickRows(homeworkId, own.rows);

  const first = saved.find(r => r.studentId === own.rows[0]) ?? saved[0]!;
  return { best: { score: first.score, total: first.total }, attempts: first.attempts };
}
