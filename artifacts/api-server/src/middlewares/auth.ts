import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { asUser, systemDb as db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "../lib/logger.js";
import { suspendedMayReach } from "../lib/suspension.js";
import { isPoolExhausted, sendDbBusy } from "../lib/dbBusy.js";
import { guardianApprovalEnabled } from "../lib/features.js";
import { guardianMayReach, needsLinkLookup, pendingGuardian } from "../lib/guardianGate.js";
import { hasLiveRosterLink } from "../lib/rosterLinkState.js";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    /** Null for a parent or student who signed up from a teacher's code and has not added one. */
    email: string | null;
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
    // `algorithms` pinned rather than left to the library's default. With a
    // string secret jsonwebtoken v9 already restricts itself to HMAC, so this
    // changes nothing today — it is here so that a future change to how the
    // secret is supplied (a KeyObject, a PEM) cannot quietly widen the set to
    // include the asymmetric algorithms, where a token signed with a public
    // key would verify.
    const payload = jwt.verify(token, secret, { algorithms: ["HS256"] }) as {
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
        guardianApprovedAt: users.guardianApprovedAt,
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

    // A student with an email and no teacher's code is held until a parent approves (lib/guardianGate.ts), here
    // for the same reason suspension is: a route added tomorrow is closed to them by default. The cheap checks run
    // first, so the roster-link query is asked only of a student who could be held and is not on the allowlist.
    const guardianOn = guardianApprovalEnabled();
    if (needsLinkLookup(user, guardianOn) && !guardianMayReach(req.method, req.originalUrl || req.url)) {
      if (pendingGuardian(user, { flagOn: guardianOn, hasLiveLink: await hasLiveRosterLink(user.id) })) {
        res.status(403).json({
          error: "A parent must approve this account first.",
          code: "guardian_approval_required",
        });
        return;
      }
    }

    const {
      suspendedAt: _suspendedAt,
      suspendedReason: _suspendedReason,
      guardianApprovedAt: _guardianApprovedAt,
      ...principal
    } = user;
    req.user = principal;
    // Everything downstream — handlers, helpers, fire-and-forget work they
    // start — runs as this user, so Postgres row-level security can tell who
    // is asking (lib/db/src/scopedPool.ts). Inert while RLS_ENFORCE is off.
    asUser({ userId: principal.id, role: principal.role }, () => next());
  } catch (err) {
    // The user lookup could not get a connection. Not a verdict on the token:
    // a 401 here sent every signed-in client into a refresh-and-retry loop
    // against the pool that had just run dry. See sendDbBusy.
    if (isPoolExhausted(err)) {
      logger.error({ err }, "auth middleware: database pool exhausted");
      sendDbBusy(res);
      return;
    }
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
