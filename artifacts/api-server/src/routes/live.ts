/**
 * The players' side of a live game. Unauthenticated, like `/take`: a student
 * opens a browser, types the 6-character code and a name, and plays.
 *
 * What makes that safe:
 *
 * 1. **The token is the session.** Issued on join, only its sha256 stored,
 *    scoped to one player in one game. Nothing is read or written for a player
 *    without it, and a kicked player's token stops working at once.
 * 2. **The key never leaves early.** `playerView` (modules/live/rules.ts) is the
 *    only thing `/state` returns, and it carries `correctIndex` only in
 *    `reveal`. The server clock scores answers; the device sends a choice and
 *    nothing else.
 * 3. **Limits that survive a classroom.** Thirty devices share one school NAT
 *    address and each polls every ~1.5 s, so valid polls have NO per-IP bucket:
 *    the limit is per token — one player, one bucket. The per-IP bucket
 *    (`live-bad-token`) is charged only by requests rejected for an unknown
 *    code or token, which is what someone probing costs. Joining is the
 *    code-walking surface, so it is keyed on the IP alone and never on a header
 *    the caller controls. A game holds at most 100 players.
 *
 * Path-scoped on purpose. This router is mounted at the API root; the only
 * middleware it installs is on `/live/...` routes, as route arguments.
 */
import { Router, type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { db, liveAnswers, liveGames, livePlayers, users } from "@workspace/db";
import type { LiveGame } from "@workspace/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { guardianApprovalEnabled } from "../lib/features.js";
import { needsLinkLookup, pendingGuardian } from "../lib/guardianGate.ts";
import { hasLiveRosterLink } from "../lib/rosterLinkState.ts";
import { createRateLimiter } from "../lib/rateLimit";
import { hashAccessToken, issueAccessToken, normalizeShareCode } from "../modules/assessment/studentView";
import { hasRoom, isEnded, isExpired, normalizeName, playerView, scoreAnswer } from "../modules/live/rules.ts";
import { loadScoreboard } from "../modules/live/store.ts";
import { isUniqueViolation } from "../lib/pgErrors.ts";

const router = Router();

// 240/min per IP, as /take: a whole school joins through one address.
const joinLimiter = createRateLimiter({ windowMs: 60_000, max: 240, name: "live-join" });
/**
 * Charged only when a request is REJECTED for an unknown code or token (see
 * `resolvePlayer`). There is deliberately no per-IP bucket on valid polls: three
 * classes behind one school address make ~3,600 valid requests a minute, and an
 * IP ceiling on them would 429 every player and lose their answers. Valid
 * players are limited per token; someone probing for codes or tokens is limited
 * here, per IP.
 */
const badTokenLimiter = createRateLimiter({ windowMs: 60_000, max: 300, name: "live-bad-token" });

function tokenFrom(req: Request): string {
  const raw = req.headers["x-live-token"];
  return typeof raw === "string" ? raw.trim() : "";
}
const tokenOrIp = (req: Request): string => {
  const t = tokenFrom(req);
  return t ? hashAccessToken(t) : (req.ip ?? "unknown");
};
const stateLimiter = createRateLimiter({ windowMs: 60_000, max: 120, name: "live-state", key: tokenOrIp });
const answerLimiter = createRateLimiter({ windowMs: 60_000, max: 120, name: "live-answer", key: tokenOrIp });

const gone = (res: Response) => res.status(404).json({ error: "Game not found", code: "game_not_found" });

async function gameByCode(rawCode: unknown): Promise<LiveGame | undefined> {
  const code = normalizeShareCode(rawCode);
  if (code.length !== 6) return undefined;
  const [game] = await db.select().from(liveGames).where(eq(liveGames.code, code)).limit(1);
  return game;
}

/**
 * A student's own session, if the join request carried one. Optional by
 * design: a bad, expired or absent session is simply an anonymous player, and
 * only a student role is recorded. A student held for a parent's approval is
 * not recorded either: this route verifies the token itself, so the middleware
 * gate never saw it, and an unapproved account must not leave its identity on a
 * game row. They can still play, as anonymous as anyone with the code.
 */
async function studentUserId(req: Request): Promise<string | null> {
  const header = req.headers.authorization;
  const secret = process.env["SESSION_SECRET"];
  if (!header?.startsWith("Bearer ") || !secret) return null;
  try {
    const payload = jwt.verify(header.slice(7), secret, { algorithms: ["HS256"] }) as { sub?: string; type?: string };
    if (payload.type !== "access" || !payload.sub) return null;
    const [user] = await db
      .select({
        id: users.id,
        role: users.role,
        suspendedAt: users.suspendedAt,
        email: users.email,
        guardianApprovedAt: users.guardianApprovedAt,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);
    if (!user || user.role !== "student" || user.suspendedAt) return null;
    // The same rule as the middleware: the roster-link query runs only for a student who could be held.
    const flagOn = guardianApprovalEnabled();
    const hasLiveLink = needsLinkLookup(user, flagOn) ? await hasLiveRosterLink(user.id) : false;
    return pendingGuardian(user, { flagOn, hasLiveLink }) ? null : user.id;
  } catch {
    return null;
  }
}

router.post("/live/:code/join", joinLimiter, async (req, res) => {
  try {
    const game = await gameByCode(req.params["code"]);
    if (!game || isEnded(game, new Date())) return void gone(res);

    const name = normalizeName(req.body?.name);
    if (!name) {
      res.status(400).json({ error: "Name must be 1 to 24 characters with no control characters", code: "invalid" });
      return;
    }

    const { token, hash } = issueAccessToken();
    const userId = await studentUserId(req);
    try {
      /*
       * The cap is counted under a lock on the game row, so two joins at 99
       * players cannot both get in: the second waits for the first to commit,
       * then counts again in a fresh statement. A kicked player frees a seat.
       */
      const player = await db.transaction(async tx => {
        await tx.execute(sql`SELECT 1 FROM live_games WHERE id = ${game.id} FOR UPDATE`);
        const [{ n } = { n: 0 }] = await tx
          .select({ n: sql<number>`count(*)::int` })
          .from(livePlayers)
          .where(and(eq(livePlayers.gameId, game.id), isNull(livePlayers.kickedAt)));
        if (!hasRoom(Number(n))) return null;
        const [created] = await tx
          .insert(livePlayers)
          .values({ gameId: game.id, name: name.name, nameKey: name.key, userId, tokenHash: hash })
          .returning({ id: livePlayers.id });
        return created ?? null;
      });
      if (!player) {
        res.status(409).json({ error: "This game is full", code: "game_full" });
        return;
      }
      res.status(201).json({ playerId: player.id, playerToken: token, name: name.name });
    } catch (err) {
      // Thirty students press join at once; the unique (game, name_key) index
      // is what is actually true, a pre-check would not be.
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "That name is already taken", code: "name_taken" });
        return;
      }
      throw err;
    }
  } catch (err) {
    logger.error({ err }, "join live game failed");
    res.status(500).json({ error: "Failed to join the game" });
  }
});

const tokenInvalid = (res: Response) =>
  res.status(401).json({ error: "Invalid player token", code: "token_invalid" });

/**
 * Resolve code + token into a game and a live player, or answer for the caller.
 *
 * The player is found by token hash joined to the game with that code, so an
 * unknown code, an unknown token and a token from another game are one miss and
 * one answer (401 `token_invalid`). Telling "no such code" from "live code, bad
 * token" would let anyone find active codes at the token limiter's rate. Every
 * such miss is charged to the per-IP `live-bad-token` bucket; a missing header
 * touches no database and is not charged. Only a VALID token learns anything
 * more: 401 `kicked`, or 404 once its game is past the six hours.
 */
async function resolvePlayer(
  req: Request,
  res: Response,
): Promise<{ game: LiveGame; player: { id: string; name: string } } | null> {
  const token = tokenFrom(req);
  if (!token) {
    tokenInvalid(res);
    return null;
  }
  const code = normalizeShareCode(req.params["code"]);
  const [row] =
    code.length === 6
      ? await db
          .select({
            id: livePlayers.id,
            name: livePlayers.name,
            kickedAt: livePlayers.kickedAt,
            game: liveGames,
          })
          .from(livePlayers)
          .innerJoin(liveGames, eq(liveGames.id, livePlayers.gameId))
          .where(and(eq(livePlayers.tokenHash, hashAccessToken(token)), eq(liveGames.code, code)))
          .limit(1)
      : [];
  if (!row) {
    let allowed = false;
    await badTokenLimiter(req, res, () => {
      allowed = true;
    });
    if (allowed) tokenInvalid(res); // otherwise the limiter has already sent the 429
    return null;
  }
  if (isExpired(row.game, new Date())) {
    gone(res);
    return null;
  }
  if (row.kickedAt) {
    res.status(401).json({ error: "You were removed from this game", code: "kicked" });
    return null;
  }
  return { game: row.game, player: { id: row.id, name: row.name } };
}

router.get("/live/:code/state", stateLimiter, async (req, res) => {
  try {
    const found = await resolvePlayer(req, res);
    if (!found) return;
    const { game, player } = found;

    const now = new Date();
    const open = game.state === "question" || game.state === "reveal";
    const [players, mine] = await Promise.all([
      loadScoreboard(game.id),
      open
        ? db
            .select({ choice: liveAnswers.choice, correct: liveAnswers.correct, points: liveAnswers.points })
            .from(liveAnswers)
            .where(and(eq(liveAnswers.playerId, player.id), eq(liveAnswers.questionIndex, game.currentIndex)))
            .limit(1)
        : [],
    ]);
    res.json(playerView(game, player, players, mine[0] ?? null, now));
  } catch (err) {
    logger.error({ err }, "read live state failed");
    res.status(500).json({ error: "Failed to read the game" });
  }
});

router.post("/live/:code/answer", answerLimiter, async (req, res) => {
  try {
    const found = await resolvePlayer(req, res);
    if (!found) return;
    const { game, player } = found;

    const questionIndex = req.body?.questionIndex;
    const choice = req.body?.choice;
    if (!Number.isInteger(questionIndex) || !Number.isInteger(choice)) {
      res.status(400).json({ error: "questionIndex and choice must be integers", code: "invalid" });
      return;
    }

    const outcome = scoreAnswer({ ...game, questionIndex, choice }, new Date());
    if (!outcome.ok) {
      res.status(outcome.status).json({
        error: outcome.code === "too_late" ? "This question is closed" : "choice must point at an option",
        code: outcome.code,
      });
      return;
    }

    try {
      await db.insert(liveAnswers).values({
        gameId: game.id,
        playerId: player.id,
        questionIndex,
        choice,
        correct: outcome.correct,
        points: outcome.points,
      });
    } catch (err) {
      if (isUniqueViolation(err)) {
        res.status(409).json({ error: "You already answered this question", code: "already_answered" });
        return;
      }
      throw err;
    }
    // Deliberately nothing about correctness: that is the reveal's to say.
    res.json({ accepted: true });
  } catch (err) {
    logger.error({ err }, "live answer failed");
    res.status(500).json({ error: "Failed to record the answer" });
  }
});

export default router;
