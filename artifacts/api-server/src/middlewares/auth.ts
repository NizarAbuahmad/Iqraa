import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { suspendedMayReach } from "../lib/suspension.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    firstName: string;
    lastName: string;
  };
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    res.status(401).json({ error: "No token provided" });
    return;
  }

  const token = authHeader.slice(7);
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    res.status(500).json({ error: "Server configuration error" });
    return;
  }

  try {
    const payload = jwt.verify(token, secret) as {
      sub: string;
      email: string;
      role: string;
      type: string;
    };

    if (payload.type !== "access") {
      res.status(401).json({ error: "Invalid token type" });
      return;
    }

    // Fetch fresh user data
    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        firstName: users.firstName,
        lastName: users.lastName,
        suspendedAt: users.suspendedAt,
        suspendedReason: users.suspendedReason,
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // A suspended account is stopped here rather than in each router, so a
    // route added tomorrow is closed to them by default — the opposite
    // arrangement fails open, and the one route someone forgets is the one an
    // ejected user still has. The token stays valid; because this middleware
    // re-reads the row on every request, suspending takes effect on the next
    // call instead of whenever the access token happens to expire.
    if (user.suspendedAt && !suspendedMayReach(req.method, req.originalUrl || req.url)) {
      res.status(403).json({
        error: user.suspendedReason || "This account has been suspended.",
        code: "account_suspended",
      });
      return;
    }

    const { suspendedAt: _suspendedAt, suspendedReason: _suspendedReason, ...principal } = user;
    req.user = principal;
    next();
  } catch (err) {
    // An expired/malformed/wrong-secret token is routine — every client with
    // a stale token hits this, so it's not worth logging. Anything else here
    // (the DB lookup above throwing, most often) is a real backend failure
    // that was previously swallowed with zero signal anywhere.
    if (!(err instanceof jwt.JsonWebTokenError)) {
      logger.error({ err }, "auth middleware failed unexpectedly");
    }
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

/**
 * Every role a teacher-facing route (roster, evaluations, attempts,
 * workspace, generate) was implicitly built for, back when `authenticated`
 * and `teacher` were the same thing. Now that student/parent accounts can
 * exist too, these routes must gate to this explicitly — see
 * `requireRole(...TEACHER_ROLES)` below.
 */
export const TEACHER_ROLES = ["teacher", "school_admin", "system_admin"];

/**
 * Gate a route to specific roles. Must run after `authMiddleware` — it only
 * reads `req.user`, never verifies the token itself. 403 (not 404): unlike
 * the debug-key admin route, a signed-in non-admin knowing this route exists
 * isn't a secret worth hiding.
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "No token provided" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}
