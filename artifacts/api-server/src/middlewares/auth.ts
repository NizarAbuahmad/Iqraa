import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { db } from "@workspace/db";
import { users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";

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
      })
      .from(users)
      .where(eq(users.id, payload.sub))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    req.user = user;
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
