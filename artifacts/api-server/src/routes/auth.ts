import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { db } from "@workspace/db";
import {
  users,
  refreshTokens,
  passwordResetTokens,
  rosterLinks,
  lessonMedia,
  chatMessages,
} from "@workspace/db";
import { eq, and, gt, isNotNull } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { deleteObject } from "../lib/r2.js";
import { studentAccountsEnabled } from "../lib/features.js";
import {
  ROSTER_CONSENT_STATEMENT_EN,
  ROSTER_CONSENT_VERSION,
} from "../lib/rosterConsent.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";
import { resolveClaimCode, type ClaimRole } from "../lib/rosterClaim.js";

const router = Router();

// Login gets more headroom than register/forgot-password since real users
// mistype passwords; the other two are rarely legitimate at any volume.
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, name: "login" });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, name: "register" });
const forgotPasswordLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "forgot-password",
});
const googleLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, name: "google-auth" });

// Unset means the endpoint answers 503 and the client-side button never
// renders (see GoogleSignInButton) — never a failure, just no button, same
// shape as the Unsplash/YouTube "no key" pattern elsewhere in this app.
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClient = googleClientId ? new OAuth2Client(googleClientId) : null;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return secret;
}

function generateTokens(userId: string, email: string, role: string) {
  const secret = getSecret();
  const accessToken = jwt.sign(
    { sub: userId, email, role, type: "access" },
    secret,
    { expiresIn: "15m" },
  );
  const refreshTokenValue = crypto.randomBytes(48).toString("hex");
  return { accessToken, refreshTokenValue };
}

async function storeRefreshToken(userId: string, tokenValue: string): Promise<void> {
  const tokenHash = crypto
    .createHash("sha256")
    .update(tokenValue)
    .digest("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  await db.insert(refreshTokens).values({ userId, tokenHash, expiresAt });
}

// POST /auth/register
router.post("/register", registerLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, role: rawRole, claimCode } =
      req.body as {
        firstName?: string;
        lastName?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        /** Defaults to 'teacher' — the only role that needed no signup step until now. */
        role?: string;
        /** Required for role 'student'/'parent' — see /students/:id/claim-code in roster.ts. */
        claimCode?: string;
      };

    if (!firstName?.trim()) {
      res.status(400).json({ error: "First name is required" });
      return;
    }
    if (!lastName?.trim()) {
      res.status(400).json({ error: "Last name is required" });
      return;
    }
    if (!email?.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }
    if (!password || !isStrongPassword(password)) {
      res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    const role: "teacher" | ClaimRole =
      rawRole === "student" || rawRole === "parent" ? rawRole : "teacher";

    // Resolved before any write: a student/parent account must never be
    // created dangling off an invalid code.
    let claim: { studentId: string; relation: "self" | "guardian" } | null = null;
    if (role !== "teacher") {
      // v1 is teacher-only. A student account is an account for a minor, and
      // the consent posture around one needs a lawyer and a matching store
      // declaration — see lib/features.ts. Refused here rather than hidden in
      // the app, because the app is not the security boundary.
      if (!studentAccountsEnabled()) {
        res.status(403).json({
          code: "student_accounts_disabled",
          error: "Parent and student accounts are not available yet.",
        });
        return;
      }
      const code = claimCode?.trim();
      if (!code) {
        res.status(400).json({ error: "A class code is required to sign up as a parent or student" });
        return;
      }
      const resolved = await resolveClaimCode(code, role);
      if (!resolved.ok) {
        res.status(resolved.status).json({ error: resolved.error });
        return;
      }
      claim = { studentId: resolved.studentId, relation: resolved.relation };
    }

    // Check duplicate email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const [user] = await db
      .insert(users)
      .values({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        preferredLanguage: "en",
      })
      .returning();

    if (!user) throw new Error("Failed to create user");

    if (claim) {
      await db
        .insert(rosterLinks)
        .values({ studentId: claim.studentId, userId: user.id, relation: claim.relation })
        .onConflictDoNothing();
    }

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
      },
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    logger.error({ err }, "register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

/**
 * Links an already-signed-in parent or student to one more roster row — a
 * second child for the same parent, a second parent for the same child, or a
 * second teacher's roster for the same student. Same resolver as /register,
 * just without creating a user row first.
 */
router.post("/claim", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // Closed for the same reason /register is. No such account can exist
    // while the flag is off, so this is unreachable in v1 — but leaving it
    // open would mean turning the flag off later did not actually close the
    // door for accounts created while it was on.
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const role = req.user!.role;
    if (role !== "student" && role !== "parent") {
      res.status(400).json({ error: "Only a student or parent account can claim a roster code" });
      return;
    }

    const code = (req.body as { claimCode?: string })?.claimCode?.trim();
    if (!code) {
      res.status(400).json({ error: "A class code is required" });
      return;
    }

    const resolved = await resolveClaimCode(code, role);
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error });
      return;
    }

    await db
      .insert(rosterLinks)
      .values({ studentId: resolved.studentId, userId: req.user!.id, relation: resolved.relation })
      .onConflictDoNothing();

    res.status(201).json({ studentId: resolved.studentId, relation: resolved.relation });
  } catch (err) {
    logger.error({ err }, "claim failed");
    res.status(500).json({ error: "Failed to link account" });
  }
});

// POST /auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      // No account, or a Google-only account with no password set — same
      // generic message either way so this can't be used to enumerate emails
      // (matches forgot-password's reasoning below).
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    // Checked after the password, not before: answering differently to a
    // suspended account before proving who is asking would turn this into an
    // oracle for which addresses are suspended. Past the password there is no
    // one left to leak it to.
    //
    // `authMiddleware` would refuse every subsequent call anyway; saying so
    // here is what turns "the app is broken" into a reason they can appeal.
    if (user.suspendedAt) {
      res.status(403).json({
        error: user.suspendedReason || "This account has been suspended.",
        code: "account_suspended",
      });
      return;
    }

    // Update last_login
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id));

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err) {
    logger.error({ err }, "login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

// POST /auth/google
router.post("/google", googleLimiter, async (req, res) => {
  try {
    if (!googleClient || !googleClientId) {
      res.status(503).json({ error: "Google sign-in is not configured" });
      return;
    }

    const { credential } = req.body as { credential?: string };
    if (!credential) {
      res.status(400).json({ error: "Google credential is required" });
      return;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({ idToken: credential, audience: googleClientId });
      payload = ticket.getPayload();
    } catch {
      res.status(401).json({ error: "Invalid Google credential" });
      return;
    }

    if (!payload?.sub || !payload.email) {
      res.status(401).json({ error: "Invalid Google credential" });
      return;
    }

    const email = payload.email.toLowerCase().trim();

    let [user] = await db.select().from(users).where(eq(users.googleId, payload.sub)).limit(1);

    if (!user) {
      // Link to an existing password account with the same email if one
      // exists, otherwise create a fresh Google-only account.
      [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      [user] = user
        ? await db
            .update(users)
            .set({ googleId: payload.sub, emailVerified: true })
            .where(eq(users.id, user.id))
            .returning()
        : await db
            .insert(users)
            .values({
              firstName: payload.given_name?.trim() || email.split("@")[0],
              lastName: payload.family_name?.trim() || "",
              email,
              googleId: payload.sub,
              role: "teacher",
              preferredLanguage: "en",
              emailVerified: true,
            })
            .returning();
    }

    if (!user) throw new Error("Failed to resolve Google user");

    // Same check as the password path, for the same reason — and here it is
    // after Google has already proved who is asking. Without it, a suspended
    // teacher with a Google account keeps a working sign-in button.
    if (user.suspendedAt) {
      res.status(403).json({
        error: user.suspendedReason || "This account has been suspended.",
        code: "account_suspended",
      });
      return;
    }

    await db.update(users).set({ lastLogin: new Date() }).where(eq(users.id, user.id));

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
      },
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }
    logger.error({ err }, "google auth failed");
    res.status(500).json({ error: "Google sign-in failed" });
  }
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (refreshToken) {
      const tokenHash = crypto
        .createHash("sha256")
        .update(refreshToken)
        .digest("hex");
      await db.delete(refreshTokens).where(eq(refreshTokens.tokenHash, tokenHash));
    }
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "logout failed");
    res.status(500).json({ error: "Logout failed" });
  }
});

// POST /auth/refresh
router.post("/refresh", async (req, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: string };
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(refreshToken)
      .digest("hex");

    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(
        and(
          eq(refreshTokens.tokenHash, tokenHash),
          gt(refreshTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    // Rotate: delete old, issue new
    await db.delete(refreshTokens).where(eq(refreshTokens.id, stored.id));

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue);

    res.json({ accessToken, refreshToken: refreshTokenValue });
  } catch (err) {
    logger.error({ err }, "refresh failed");
    res.status(500).json({ error: "Token refresh failed" });
  }
});

// GET /auth/me
router.get("/me", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, req.user!.id))
      .limit(1);

    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      emailVerified: user.emailVerified,
      // Which proof `DELETE /auth/users/me` will accept from this account: a
      // password, or — for a Google-only account, which has no hash to check
      // — its own email address retyped. Deliberately only here and not on the
      // six other places this object is serialised: the delete screen fetches
      // /me itself, so one site cannot drift out of step with the others.
      hasPassword: user.passwordHash !== null,
      // Whether this teacher has attested to their school's parental consent,
      // and which wording they saw. Null means the roster is read-only for
      // them until they do — the app reads this to show the statement rather
      // than waiting for a write to come back 403. Absent here would be read
      // as "not consented", which is the safe direction.
      rosterConsentAt: user.rosterConsentAt,
      rosterConsentVersion: user.rosterConsentVersion,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
    });
  } catch (err) {
    logger.error({ err }, "get profile failed");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /auth/forgot-password
router.post("/forgot-password", forgotPasswordLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.includes("@")) {
      res.status(400).json({ error: "Valid email is required" });
      return;
    }

    const [user] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Always return success to prevent email enumeration
    if (!user) {
      res.json({ ok: true });
      return;
    }

    const resetTokenValue = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto
      .createHash("sha256")
      .update(resetTokenValue)
      .digest("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // In local development only, log the token so engineers can test the flow
    // without a real email service. Never log tokens in production.
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[AUTH:dev] Password reset requested for ${user.email} — token expires ${expiresAt.toISOString()}`,
        `\n[AUTH:dev] Reset token (redacted in prod): ${resetTokenValue}`,
      );
    }

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "forgot password failed");
    res.status(500).json({ error: "Failed to process request" });
  }
});

// POST /auth/reset-password
router.post("/reset-password", async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body as {
      token?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!token) {
      res.status(400).json({ error: "Reset token is required" });
      return;
    }
    if (!password || !isStrongPassword(password)) {
      res.status(400).json({ error: PASSWORD_POLICY_MESSAGE });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match" });
      return;
    }

    const tokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const [stored] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.tokenHash, tokenHash),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      res.status(400).json({ error: "Invalid or expired reset token" });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    await db
      .update(users)
      .set({ passwordHash })
      .where(eq(users.id, stored.userId));

    await db
      .update(passwordResetTokens)
      .set({ used: true })
      .where(eq(passwordResetTokens.id, stored.id));

    // Revoke all refresh tokens on password reset
    await db
      .delete(refreshTokens)
      .where(eq(refreshTokens.userId, stored.userId));

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset password failed");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

// PATCH /users/profile
router.patch("/users/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { preferredLanguage, firstName, lastName } = req.body as {
      preferredLanguage?: string;
      firstName?: string;
      lastName?: string;
    };

    const updates: Record<string, unknown> = {};
    if (preferredLanguage) updates.preferredLanguage = preferredLanguage;
    if (firstName?.trim()) updates.firstName = firstName.trim();
    if (lastName?.trim()) updates.lastName = lastName.trim();

    if (Object.keys(updates).length === 0) {
      res.status(400).json({ error: "No valid fields to update" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, req.user!.id))
      .returning();

    res.json({
      id: updated.id,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.email,
      role: updated.role,
      preferredLanguage: updated.preferredLanguage,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "update profile failed");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

// DELETE /auth/users/me
//
// Apple 5.1.1(v) and Google Play both require an in-app route that actually
// deletes the account. A support address does not satisfy either.
//
// The schema does almost all of the work: every table referencing `users.id`
// declares `onDelete: "cascade"`, so removing one row takes the roster,
// classes, evaluations, saved materials, chat participation, blocks, reports
// and push tokens with it. Two things a cascade cannot reach:
//
//   - R2 objects, which are not rows. Their keys are read *before* the delete,
//     because a key read afterwards is a key that no longer exists.
//   - `aiGenerations.userId`, which is `set null` by design rather than
//     cascade. It is cost accounting; what survives is a spend row with no
//     person attached to it.
//
// Re-authentication is required. For a teacher the cascade reaches the whole
// roster — other people's children — and a stolen access token must not be
// enough to erase it.
const deleteAccountLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 5,
  name: "delete-account",
});

router.delete(
  "/users/me",
  authMiddleware,
  deleteAccountLimiter,
  async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.user!.id;
      const [account] = await db.select().from(users).where(eq(users.id, userId));
      if (!account) {
        res.status(404).json({ error: "Account not found" });
        return;
      }

      // A password account proves itself with its password. A Google-only
      // account has no hash to check, so it retypes its own email address:
      // weaker, but it is the strongest thing that account actually holds,
      // and it still stops deletion by token alone.
      const { password, confirmEmail } = req.body as {
        password?: string;
        confirmEmail?: string;
      };
      if (account.passwordHash) {
        const ok = password
          ? await bcrypt.compare(password, account.passwordHash)
          : false;
        if (!ok) {
          res.status(401).json({ error: "Password is incorrect" });
          return;
        }
      } else if (
        confirmEmail?.trim().toLowerCase() !== account.email.toLowerCase()
      ) {
        res.status(401).json({ error: "Email confirmation does not match" });
        return;
      }

      const media = await db
        .select({ key: lessonMedia.r2Key })
        .from(lessonMedia)
        .where(eq(lessonMedia.userId, userId));
      const attachments = await db
        .select({ key: chatMessages.attachmentKey })
        .from(chatMessages)
        .where(
          and(
            eq(chatMessages.senderId, userId),
            isNotNull(chatMessages.attachmentKey),
          ),
        );

      await db.delete(users).where(eq(users.id, userId));

      // Deliberately after the row is gone: the deletion the user asked for is
      // the database one, and it must not fail because object storage is
      // unreachable. A failure here leaves an unreferenced blob behind —
      // logged at error level because nothing else will ever notice it.
      // ponytail: no retry queue. Add one if these lines actually appear.
      const keys = [
        ...media.map(m => m.key),
        ...attachments.map(a => a.key as string),
      ];
      let orphaned = 0;
      for (const key of keys) {
        try {
          await deleteObject(key);
        } catch (err) {
          orphaned += 1;
          logger.error({ err, key, userId }, "account deleted but R2 object remains");
        }
      }

      logger.info({ userId, r2Objects: keys.length, orphaned }, "account deleted");
      res.json({ ok: true });
    } catch (err) {
      logger.error({ err }, "account deletion failed");
      res.status(500).json({ error: "Failed to delete account" });
    }
  },
);

/**
 * POST /auth/roster-consent
 *
 * Records the teacher's attestation that their school holds the parental
 * consent that lets them enter student information — see
 * `lib/rosterConsent.ts` for why this sits on the teacher rather than on each
 * student row, and why it gates writes only.
 *
 * Idempotent by re-stamping: pressing it twice moves the timestamp, which is
 * the honest record of the most recent time they agreed, and re-agreeing
 * after the wording changes is exactly the case that has to work.
 */
router.post("/roster-consent", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    // The client sends back the version it displayed. A mismatch means the
    // app is showing wording this server no longer considers current, and
    // recording agreement to text nobody can now identify is worse than
    // refusing — that is the failure the version column exists to prevent.
    const { version } = req.body as { version?: string };
    if (version && version !== ROSTER_CONSENT_VERSION) {
      res.status(409).json({
        code: "roster_consent_version_mismatch",
        error: "This consent statement is out of date. Reload the app and try again.",
        consentVersion: ROSTER_CONSENT_VERSION,
      });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ rosterConsentAt: new Date(), rosterConsentVersion: ROSTER_CONSENT_VERSION })
      .where(eq(users.id, req.user!.id))
      .returning({ at: users.rosterConsentAt, version: users.rosterConsentVersion });

    logger.info(
      { userId: req.user!.id, version: ROSTER_CONSENT_VERSION },
      "roster consent recorded",
    );
    res.json({ rosterConsentAt: updated.at, rosterConsentVersion: updated.version });
  } catch (err) {
    logger.error({ err }, "record roster consent failed");
    res.status(500).json({ error: "Failed to record consent" });
  }
});

/**
 * GET /auth/roster-consent — the current wording and version, unauthenticated.
 *
 * Served rather than duplicated in the app so the statement a teacher agrees
 * to and the statement this server records agreement *to* cannot drift apart.
 * The app holds translations of it; this is the text they translate.
 */
router.get("/roster-consent", (_req, res) => {
  res.json({ version: ROSTER_CONSENT_VERSION, statement: ROSTER_CONSENT_STATEMENT_EN });
});

export default router;
