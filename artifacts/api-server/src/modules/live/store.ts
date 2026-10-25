/**
 * The reads both live routers share. Plain `db` on purpose: the three live
 * tables are DEFERRED for row-level security (the join route has no identity),
 * so there is no policy for the owner connection to bypass.
 */
import { db, liveAnswers, livePlayers } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import type { Scored } from "./rules.ts";

/** Every player still in the game with their running total. */
export async function loadScoreboard(gameId: string): Promise<Scored[]> {
  const rows = await db
    .select({
      id: livePlayers.id,
      name: livePlayers.name,
      userId: livePlayers.userId,
      score: sql<number>`coalesce(sum(${liveAnswers.points}), 0)::int`,
    })
    .from(livePlayers)
    .leftJoin(liveAnswers, eq(liveAnswers.playerId, livePlayers.id))
    .where(and(eq(livePlayers.gameId, gameId), isNull(livePlayers.kickedAt)))
    .groupBy(livePlayers.id);
  return rows.map(r => ({ id: r.id, name: r.name, score: Number(r.score), signedIn: r.userId !== null }));
}

/** Answers to one question, for the host's bar chart and the "answered" ticks. */
export async function loadAnswersFor(gameId: string, questionIndex: number) {
  return db
    .select({ playerId: liveAnswers.playerId, choice: liveAnswers.choice })
    .from(liveAnswers)
    .innerJoin(livePlayers, eq(livePlayers.id, liveAnswers.playerId))
    .where(
      and(
        eq(liveAnswers.gameId, gameId),
        eq(liveAnswers.questionIndex, questionIndex),
        isNull(livePlayers.kickedAt),
      ),
    );
}
