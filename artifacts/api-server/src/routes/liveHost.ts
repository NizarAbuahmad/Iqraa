/**
 * The teacher's side of a live game: create it, watch it on the projector,
 * step it through its states, remove a player.
 *
 * Authenticated and teacher-only, with the guard path-scoped to `/live-host`.
 * Mounted at the API root alongside many other routers, so a bare
 * `router.use(authMiddleware)` here would answer 401 for every path mounted
 * after it (mountOrder.test.ts pins this). A game is visible only to its
 * `host_id`; anyone else gets the same 404 as a game that does not exist.
 *
 * The players' side is routes/live.ts, and shares only the pure rules in
 * modules/live/rules.ts.
 */
import { Router, type Request, type Response } from "express";
import { db, liveGames, livePlayers } from "@workspace/db";
import type { LiveGame } from "@workspace/db";
import { and, eq, isNull, lt, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { createRateLimiter } from "../lib/rateLimit";
import { authMiddleware, requireRole, TEACHER_ROLES, type AuthenticatedRequest } from "../middlewares/auth.js";
import { generateShareCode } from "../modules/assessment/studentView";
import { hostView, isEnded, nextState, validateCreate } from "../modules/live/rules.ts";
import { isUniqueViolation, loadAnswersFor, loadScoreboard } from "../modules/live/store.ts";

const router = Router();

router.use("/live-host", authMiddleware, requireRole(...TEACHER_ROLES));

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = (res: Response) => res.status(404).json({ error: "Game not found", code: "game_not_found" });

async function hostedGame(req: AuthenticatedRequest, id: unknown): Promise<LiveGame | undefined> {
  if (typeof id !== "string" || !UUID.test(id) || !req.user) return undefined;
  const [game] = await db
    .select()
    .from(liveGames)
    .where(and(eq(liveGames.id, id), eq(liveGames.hostId, req.user.id)))
    .limit(1);
  return game;
}

async function sendView(res: Response, game: LiveGame, status = 200): Promise<void> {
  const now = new Date();
  const [players, answers] = await Promise.all([
    loadScoreboard(game.id),
    game.state === "question" || game.state === "reveal" ? loadAnswersFor(game.id, game.currentIndex) : [],
  ]);
  res.status(status).json(hostView(game, players, answers, now));
}

// Per teacher, not per IP: a school is one address. 30 an hour is far above
// anyone's real use and bounds what one account can store.
const createLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 30,
  name: "live-create",
  key: (req: Request) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown",
});

/*
 * RETENTION RULE for children's names: a live game (and with it every player
 * name a child typed, and their answers) is deleted 7 days after it was
 * created. The sweep runs opportunistically whenever a teacher creates a game —
 * no scheduler, and any active teacher keeps it running. The cascade on
 * live_players / live_answers removes the dependants. A failed sweep never
 * blocks creating a game.
 */
async function sweepOldGames(): Promise<void> {
  try {
    await db.delete(liveGames).where(lt(liveGames.createdAt, sql`now() - interval '7 days'`));
  } catch (err) {
    logger.warn({ err }, "live game retention sweep failed");
  }
}

router.post("/live-host/games", createLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const parsed = validateCreate(req.body);
    if (!parsed.ok) {
      res.status(400).json({ error: parsed.error, code: "invalid" });
      return;
    }
    await sweepOldGames();
    const { title, lang, seconds, questions } = parsed.value;
    // 31^6 codes make a clash rare, but the unique index is the only thing
    // that makes it impossible, so a clash is retried rather than surfaced.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const [created] = await db
          .insert(liveGames)
          .values({ code: generateShareCode(), hostId: req.user!.id, title, lang, seconds, questions })
          .returning({ id: liveGames.id, code: liveGames.code });
        res.status(201).json({ id: created!.id, code: created!.code });
        return;
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    res.status(503).json({ error: "Could not allocate a game code, try again", code: "code_unavailable" });
  } catch (err) {
    logger.error({ err }, "create live game failed");
    res.status(500).json({ error: "Failed to create the game" });
  }
});

router.get("/live-host/games/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const game = await hostedGame(req, req.params["id"]);
    if (!game) return void notFound(res);
    await sendView(res, game);
  } catch (err) {
    logger.error({ err }, "read live game failed");
    res.status(500).json({ error: "Failed to read the game" });
  }
});

router.post("/live-host/games/:id/advance", async (req: AuthenticatedRequest, res) => {
  try {
    const game = await hostedGame(req, req.params["id"]);
    if (!game) return void notFound(res);

    const action = req.body?.action;
    const now = new Date();
    if (isEnded(game, now)) {
      // Ending twice is harmless; anything else on a finished game is not a move.
      if (action === "end") return void (await sendView(res, game));
      res.status(409).json({ error: "This game is over", code: "bad_transition" });
      return;
    }
    const next = nextState(game, game.questions.length, action);
    if (!next) {
      res.status(409).json({ error: "That step is not available now", code: "bad_transition" });
      return;
    }

    // Conditional on the state we read, so two presses of "next" cannot skip a question.
    const [updated] = await db
      .update(liveGames)
      .set({
        state: next.state,
        currentIndex: next.currentIndex,
        questionStartedAt: next.state === "question" ? now : game.questionStartedAt,
        endedAt: next.state === "ended" ? now : null,
      })
      .where(
        and(
          eq(liveGames.id, game.id),
          eq(liveGames.state, game.state),
          eq(liveGames.currentIndex, game.currentIndex),
          isNull(liveGames.endedAt),
        ),
      )
      .returning();
    if (!updated) {
      res.status(409).json({ error: "The game changed, refresh and try again", code: "bad_transition" });
      return;
    }
    await sendView(res, updated);
  } catch (err) {
    logger.error({ err }, "advance live game failed");
    res.status(500).json({ error: "Failed to advance the game" });
  }
});

router.post("/live-host/games/:id/kick", async (req: AuthenticatedRequest, res) => {
  try {
    const game = await hostedGame(req, req.params["id"]);
    if (!game) return void notFound(res);
    const playerId = req.body?.playerId;
    if (typeof playerId !== "string" || !UUID.test(playerId)) {
      res.status(404).json({ error: "Player not found", code: "player_not_found" });
      return;
    }
    const kicked = await db
      .update(livePlayers)
      .set({ kickedAt: new Date() })
      .where(and(eq(livePlayers.id, playerId), eq(livePlayers.gameId, game.id), isNull(livePlayers.kickedAt)))
      .returning({ id: livePlayers.id });
    if (kicked.length === 0) {
      res.status(404).json({ error: "Player not found", code: "player_not_found" });
      return;
    }
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, "kick live player failed");
    res.status(500).json({ error: "Failed to remove the player" });
  }
});

export default router;
