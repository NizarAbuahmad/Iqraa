/**
 * The gate in front of entering a child's information.
 *
 * A student row is personal data about a minor, created by a teacher, before
 * any account for that child exists — so it is the *earliest* consent surface
 * in the product and the only one that stays live in a teacher-only v1. The
 * roster router already funnels every class and student route through one
 * mount, which is where this attaches: a roster route added tomorrow is gated
 * by default rather than by someone remembering.
 *
 * Reads are deliberately left open. The exposure is entering child data, not
 * looking at data already entered, and blocking reads would present every
 * existing teacher with what looks like an outage until they clicked
 * something. Writes are what the attestation is about.
 */
import type { NextFunction, Response } from "express";
import { db, users } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "./logger.js";

/**
 * Bump when the wording below changes materially. Stored per teacher, so an
 * old value tells you which statement they actually saw — the whole reason
 * the version is recorded rather than a bare boolean.
 */
export const ROSTER_CONSENT_VERSION = "2026-09-05.v1";

/**
 * The statement, kept here so the server owns the canonical wording and the
 * app renders a copy of it rather than inventing its own. Translations live
 * with the UI; this is the text they translate.
 */
export const ROSTER_CONSENT_STATEMENT_EN =
  "I confirm that my school has obtained the parental or guardian consent " +
  "required for me to enter my students' information into IQRA, and that I " +
  "will enter only what I need for teaching.";

const WRITE_METHODS = new Set(["POST", "PATCH", "PUT", "DELETE"]);

/**
 * Refuses a roster *write* from a teacher who has not attested.
 *
 * 403 with a code the client can branch on, not a generic one: the app has to
 * tell these apart from an ordinary permission failure so it can show the
 * statement instead of an error.
 */
export async function requireRosterConsent(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!WRITE_METHODS.has(req.method)) {
    next();
    return;
  }
  if (!req.user) {
    // authMiddleware runs first at this mount; this is belt and braces so the
    // gate can never be the thing that lets an unauthenticated write through.
    res.status(401).json({ error: "No token provided" });
    return;
  }

  try {
    const [row] = await db
      .select({ at: users.rosterConsentAt })
      .from(users)
      .where(eq(users.id, req.user.id))
      .limit(1);

    if (!row?.at) {
      res.status(403).json({
        code: "roster_consent_required",
        error: "Confirm your school's parental consent before adding student information.",
        consentVersion: ROSTER_CONSENT_VERSION,
      });
      return;
    }
    next();
  } catch (err) {
    // Fail closed. An unreadable users row must not become an open door to
    // writing children's names — and the column is new, so the most likely
    // cause of this branch is a database that has not had the push run
    // against it.
    logger.error({ err }, "roster consent check failed — refusing the write");
    res.status(503).json({
      code: "roster_consent_unavailable",
      error: "Could not verify consent state. Please try again.",
    });
  }
}
