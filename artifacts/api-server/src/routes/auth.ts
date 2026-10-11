import { Router, type Request } from "express";
import { signupSource } from "../lib/adminMetrics.js";
import { termsAcceptance } from "../lib/termsAcceptance.ts";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { OAuth2Client } from "google-auth-library";
import { db } from "@workspace/db";
import {
  users,
  refreshTokens,
  rosterLinks,
  lessonMedia,
  chatMessages,
  classGroups,
  classMemberships,
  students,
  emailVerificationTokens,
  passwordResetTokens,
} from "@workspace/db";
import { eq, and, asc, desc, gt, inArray, isNotNull, isNull, lt, ne, sql } from "drizzle-orm";
import { authMiddleware, type AuthenticatedRequest } from "../middlewares/auth.js";
import { logger } from "../lib/logger.js";
import { createRateLimiter } from "../lib/rateLimit.js";
import { emailKey } from "../lib/rateLimitKeys.js";
import { deleteObject, deletePublicObject, isPublicR2Configured, newAvatarKey, publicUrl, putPublicObject } from "../lib/r2.js";
import { googleClientIds } from "../lib/googleClients.js";
import { decideGoogleLink, googleRoleConflict } from "../lib/googleLink.js";
import { decideRefresh, refreshTokenTtlMs } from "../lib/refreshPolicy.js";
import { studentAccountsEnabled } from "../lib/features.js";
import { syncClassThreadsForStudent } from "../lib/classThread.js";
import { audioKeysForTeacher } from "../lib/attemptAudio.ts";
import {
  ROSTER_CONSENT_STATEMENT_EN,
  ROSTER_CONSENT_VERSION,
} from "../lib/rosterConsent.js";
import { isStrongPassword, PASSWORD_POLICY_MESSAGE } from "../lib/passwordPolicy.js";
import { limitGradesForRole, sanitizeCatalogIds, sanitizeTeachingAssignments } from "../lib/catalogIds.js";
import { GRADES, SUBJECTS } from "@workspace/curriculum";
import { isValidEmailAddress } from "../lib/emailAddress.js";
import { changeEmailResponse, registerResponse, resendResponse } from "../lib/verificationDelivery.js";
import { sendGoogleAccountNoticeEmail, sendPasswordResetEmail, sendVerificationEmail } from "../lib/email.js";
import {
  generateVerificationCode,
  hashVerificationCode,
  VERIFICATION_CODE_TTL_MS,
  VERIFICATION_MAX_ATTEMPTS,
} from "../lib/emailVerification.js";
import {
  generateResetCode,
  hashResetCode,
  RESET_CODE_TTL_MS,
} from "../lib/passwordReset.js";
import { resolveClaimCode, type ClaimResolution, type ClaimRole } from "../lib/rosterClaim.js";
import { generateLoginCode, hashLoginCode } from "../lib/loginCode.ts";
import { namesForNewAccount, redeemRoleCheck } from "../lib/redeemPolicy.ts";
import { studentGradeIds } from "../lib/studentGrades.ts";
import { resyncClassGroupThreadIfExists } from "../lib/classThread.js";
import { decideRoleSwitch } from "../lib/roleSwitch.js";
import { normalizeShareCode } from "../modules/assessment/studentView.ts";
import { extensionForAvatarMime, MAX_AVATAR_DATA_URL_LENGTH } from "../lib/avatarUpload.js";
import { parseDataUrl } from "../lib/lessonMediaUpload.js";
import { getUserBudgetLimitUsd } from "../lib/aiBudget.js";
import { currentPeriodStart, readUserPeriodSpendUsd } from "../lib/aiUsageLog.js";

const router = Router();

/** null key -> null url, so every response-building site below can stay a one-liner. */
function avatarUrlFor(avatarKey: string | null): string | null {
  return avatarKey ? publicUrl(avatarKey) : null;
}

/*
 * A school is one NAT address. An IP-keyed signup limit is therefore a limit
 * on the school: the sixth teacher to sign up on the staffroom wifi was told
 * "too many attempts" for something five colleagues had already done, with
 * nothing in the message to explain it and nothing they could do about it.
 * The tight limits below are keyed on the address instead — see
 * lib/rateLimitKeys.ts.
 */

// Login gets more headroom than register since real users mistype passwords;
// a burst of registrations is rarely legitimate at any volume. Same pair as
// signup: tight per account (what bounds password guessing), loose per IP —
// ten per IP meant the eleventh student signing in on the school wifi at the
// start of a lesson was locked out for fifteen minutes.
const loginEmailLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, name: "login-email", key: emailKey });
const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100, name: "login" });
// Google verifies the credential itself, so there is no password to guess
// here; the per-IP ceiling only has to stop floods, not a classroom.
const googleLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 100, name: "google-auth" });

/*
 * The signup and verification routes are limited twice: tightly per address,
 * loosely per IP. Neither alone is right — per-IP alone punishes a shared
 * school connection, and per-address alone leaves bulk automation free to
 * create unlimited accounts from one host as long as each uses a fresh email.
 */
const registerEmailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3, name: "register-email", key: emailKey });
const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 30, name: "register" });

const verifyEmailAddressLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, name: "verify-email-address", key: emailKey });
const verifyEmailLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 60, name: "verify-email" });

// Tighter than register per address: this exists to recover from a failed
// send, not to resend on a whim, and an unlimited resend is a free
// email-bombing vector aimed at whoever owns that mailbox.
const resendVerificationEmailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3, name: "resend-verification-email", key: emailKey });
const resendVerificationLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, name: "resend-verification" });

// Same pair, keyed on the address the pending signup currently has. Every
// attempt also has to survive a bcrypt compare, so the per-address ceiling
// can match login's rather than resend's — a mistyped address is worth a few
// honest retries, and this route sends mail only once the password checks out.
const changeEmailAddressLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 10, name: "change-unverified-email-address", key: emailKey });
const changeEmailLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 30, name: "change-unverified-email" });
// /claim was the only code-redeeming route without one, which made it an
// authenticated guessing surface against a 6-character alphabet. More headroom
// than register because a parent with three children legitimately claims three
// times in a sitting. Dormant while STUDENT_ACCOUNTS is off — the route 403s
// before reaching the handler — so this is insurance for the day it flips.
//
// Keyed per user and mounted *after* authMiddleware, unlike the signup
// limiters above: a classroom claiming codes together is one NAT address, and
// an IP key here meant the eleventh child in the room was told "too many
// attempts" for something ten classmates had just done.
const perUser = (req: Request) => (req as AuthenticatedRequest).user?.id ?? req.ip ?? "unknown";
const claimLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, name: "claim", key: perUser });

/*
 * Signing up from a code has no email to key a limit on, and the IP is the wrong
 * thing to make tight: thirty children redeeming a class code in one lesson are
 * one school NAT address. So two ceilings, each wrong alone.
 *
 * Per code: bounds how often one code can be redeemed or hammered — a class is
 * ~40 children plus retries. Per IP: loose enough for a classroom, and the only
 * thing that slows someone walking different codes. 31^6 ≈ 8.9e8 against a few
 * thousand live codes is not a space to be relaxed about; this is a speed bump,
 * not a wall, and a redeem still only links to a roster row — it reads nothing
 * but that child's name.
 */
const redeemIpLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 300, name: "redeem" });
const redeemCodeLimiter = createRateLimiter({
  windowMs: 60 * 60 * 1000,
  max: 100,
  name: "redeem-code",
  key: req => {
    const code = (req.body as { claimCode?: unknown } | undefined)?.claimCode;
    const normalized = typeof code === "string" ? normalizeShareCode(code) : "";
    return normalized || "no-code";
  },
});
// The login code is 31^12; nobody walks that, so the ceiling only has to stop
// floods. Loose on purpose — a school is one address.
const codeLoginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: 200, name: "code-login" });
// Adding an email costs someone else a mail when the address is not the
// caller's own, so the same pair as register.
const addEmailUserLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 5, name: "add-email-user", key: perUser });
const addEmailAddressLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3, name: "add-email-address", key: emailKey });
// Same reasoning as resend-verification: asking costs someone else an email.
const forgotPasswordEmailLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 3, name: "forgot-password-email", key: emailKey });
const forgotPasswordLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 20, name: "forgot-password" });
/**
 * Keyed on the **email**, not the caller's IP.
 *
 * `password_reset_tokens` has no attempts column — the email-verification
 * table grew one, this older table predates it, and adding one would mean a
 * hand-run migration against production for a flow that can be made safe
 * without it. A 6-digit code is 1e6 possibilities, so what actually has to be
 * capped is guesses *against one account*, and an IP-keyed limiter caps
 * nothing an attacker with a handful of addresses cares about. The counter is
 * shared Postgres (lib/rateLimit.ts), so this holds across instances.
 *
 * Falls back to the IP when no email was sent, so a malformed body still
 * meets a limit rather than slipping past one.
 */
const resetPasswordLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 5,
  name: "reset-password",
  key: req => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return typeof email === "string" && email.trim() !== ""
      ? email.toLowerCase().trim()
      : req.ip ?? "unknown";
  },
});

// Unset means the endpoint answers 503 and the client-side button never
// renders (see GoogleSignInButton) — never a failure, just no button, same
// shape as the Unsplash/YouTube "no key" pattern elsewhere in this app.
//
// A list, not one value: an ID token carries the client that minted it, so
// native sign-in and web sign-in present different audiences — and the move of
// Google sign-in into the Firebase project puts two *projects* in play at once.
// See lib/googleClients.ts for why swapping a single value would sign every
// existing web user out. Read once at module scope like the original, so
// changing it still needs a redeploy (the API is deployed by hand — see
// docs/deploying.md).
const googleClientIdList = googleClientIds();
const googleClient = googleClientIdList.length > 0 ? new OAuth2Client(googleClientIdList[0]) : null;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET not set");
  return secret;
}

// `email` is null for an account made from a teacher's code alone. The claim is
// informational — authMiddleware re-reads the row and never trusts the token's
// email or role — so an empty string stands in rather than a null that some
// future reader would have to remember to handle.
function generateTokens(userId: string, email: string | null, role: string) {
  const secret = getSecret();
  const accessToken = jwt.sign(
    { sub: userId, email: email ?? "", role, type: "access" },
    secret,
    { expiresIn: "15m" },
  );
  const refreshTokenValue = crypto.randomBytes(48).toString("hex");
  return { accessToken, refreshTokenValue };
}

function hashRefreshToken(tokenValue: string): string {
  return crypto.createHash("sha256").update(tokenValue).digest("hex");
}

/**
 * Store a refresh token.
 *
 * `origin` is the request's `Origin` header and picks the lifetime — seven days
 * for a browser, thirty for a native app (see lib/refreshPolicy.ts). `familyId`
 * is omitted at sign-in, where the column's default starts a new chain, and
 * passed at rotation so the successor stays in the chain it replaces.
 */
async function storeRefreshToken(
  userId: string,
  tokenValue: string,
  origin: string | undefined,
  familyId?: string,
  executor: Pick<typeof db, "insert"> = db,
): Promise<void> {
  const expiresAt = new Date(Date.now() + refreshTokenTtlMs(origin));
  await executor.insert(refreshTokens).values({
    userId,
    tokenHash: hashRefreshToken(tokenValue),
    expiresAt,
    ...(familyId ? { familyId } : {}),
  });
}

/**
 * Drop this user's expired rows, rotated ones included.
 *
 * Retiring instead of deleting is what makes replay detectable, and the cost is
 * that the table now grows by a row per rotation. Bounded here rather than by a
 * scheduler: once a row is past `expiresAt` it can never produce anything but
 * `reject`, so it carries no evidence worth keeping. Scoped to one user and run
 * on their own refresh, which is the moment their rows were already being read.
 *
 * Fire-and-forget on purpose — a failed sweep costs disk, not correctness, and
 * must not turn a valid refresh into a 500.
 */
function pruneExpiredRefreshTokens(userId: string): void {
  void db
    .delete(refreshTokens)
    .where(and(eq(refreshTokens.userId, userId), lt(refreshTokens.expiresAt, new Date())))
    .catch(err => logger.warn({ err, userId }, "refresh token prune failed"));
}

/**
 * Mints a fresh 6-digit code, stores its hash, and emails it. Does not throw
 * on a failed send — an email outage must not strand a real signup with no
 * account at all; /auth/resend-verification is the recovery path once the
 * outage clears.
 */
async function issueVerificationCode(userId: string, email: string): Promise<boolean> {
  const code = generateVerificationCode();
  await db.insert(emailVerificationTokens).values({
    userId,
    codeHash: hashVerificationCode(code),
    expiresAt: new Date(Date.now() + VERIFICATION_CODE_TTL_MS),
  });
  const sent = await sendVerificationEmail(email, code);
  if (!sent) {
    logger.error({ userId, email }, "verification email not sent — account created unverified with no code delivered");
  }
  return sent;
}

/** An empty or whitespace-only picked name is "none given", not a name that fails to match. */
function trimmedOrUndefined(value: unknown): string | undefined {
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed === "" ? undefined : trimmed;
}

/**
 * Whether a parent/student account has claimed any roster row yet. Only ever
 * queried for those two roles — a teacher never has rosterLinks, and running
 * this on every teacher request would be a wasted query on the common path.
 */
/**
 * Any roster link at all, archived rows included — the role-switch lock, which
 * counts archived data the same way `hasAnyTeachingData` does below. A link
 * stays a link while its row is archived, and the row can be restored.
 */
async function hasAnyRosterLink(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rosterLinks.id })
    .from(rosterLinks)
    .where(eq(rosterLinks.userId, userId))
    .limit(1);
  return !!row;
}

/**
 * A link to a live roster row — what the claim gate (`hasRosterLink` on the
 * user) asks. A student whose only link is to an archived row used to pass
 * the gate into an app with no class, no teacher and no contacts;
 * `/messaging/contacts` already drops archived rows, and this is that rule.
 */
async function hasLiveRosterLink(userId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: rosterLinks.id })
    .from(rosterLinks)
    .innerJoin(students, eq(students.id, rosterLinks.studentId))
    .where(and(eq(rosterLinks.userId, userId), isNull(students.archivedAt)))
    .limit(1);
  return !!row;
}

type DbTx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * The write half of claiming a roster row, shared by `POST /claim` (an account
 * that already exists) and `POST /redeem` (an account created in the same
 * transaction). Check-then-insert, serialised on the student row.
 *
 * `decideClaim` already asked "does this child have a self link?", but two
 * students submitting the same code in the same second both got "no" and both
 * became that child. The roster row is the thing being claimed, so it is the
 * thing locked: the second transaction waits on the first and then sees its
 * link. A partial unique index would say the same thing in the schema; this
 * says it without a manual schema push.
 */
async function linkRosterRowInTx(
  tx: DbTx,
  userId: string,
  resolved: Extract<ClaimResolution, { ok: true }>,
): Promise<"linked" | "taken" | "guardian_taken"> {
  await tx.execute(sql`select id from ${students} where id = ${resolved.studentId} for update`);
  if (resolved.relation === "self") {
    const [taken] = await tx
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .where(
        and(
          eq(rosterLinks.studentId, resolved.studentId),
          eq(rosterLinks.relation, "self"),
          ne(rosterLinks.userId, userId),
        ),
      )
      .limit(1);
    if (taken) return "taken";
  }
  // The one-parent rule for a class-code claim, asked again under the same
  // lock: decideClaim's answer was given before it, so two parents picking
  // the same name in the same second would both have been told "free".
  if (resolved.relation === "guardian" && resolved.viaClassCode) {
    const [other] = await tx
      .select({ id: rosterLinks.id })
      .from(rosterLinks)
      .where(
        and(
          eq(rosterLinks.studentId, resolved.studentId),
          eq(rosterLinks.relation, "guardian"),
          ne(rosterLinks.userId, userId),
        ),
      )
      .limit(1);
    if (other) return "guardian_taken";
  }
  await tx
    .insert(rosterLinks)
    .values({ studentId: resolved.studentId, userId, relation: resolved.relation })
    .onConflictDoNothing();
  return "linked";
}

/**
 * A student who joins is a member of every class thread their roster row sits
 * in — the same rule roster edits apply (routes/roster.ts), applied here on the
 * way in. Without it the new account saw no class group until the teacher
 * happened to reopen it. "If exists", like those edits: a claim must not
 * conjure an empty chat into a teacher's inbox.
 */
async function resyncClassThreadsOfStudent(studentId: string): Promise<void> {
  const memberships = await db
    .select({ classGroupId: classMemberships.classGroupId, teacherId: classGroups.teacherId })
    .from(classMemberships)
    .innerJoin(classGroups, eq(classGroups.id, classMemberships.classGroupId))
    .where(and(eq(classMemberships.studentId, studentId), isNull(classGroups.archivedAt)));
  for (const m of memberships) {
    await resyncClassGroupThreadIfExists(m.classGroupId, m.teacherId);
  }
}

/**
 * Any live class or any student owned by this teacher — see hasTeachingData in
 * lib/roleSwitch.ts. An archived class does not count: «حذف الصف» only archives
 * (routes/roster.ts), so counting it left a teacher who had made one class by
 * mistake with no way out. Students still count, archived class or not — they
 * are what join codes, roster links and guardians hang off.
 */
async function hasAnyTeachingData(userId: string): Promise<boolean> {
  const [cls] = await db
    .select({ id: classGroups.id })
    .from(classGroups)
    .where(and(eq(classGroups.teacherId, userId), isNull(classGroups.archivedAt)))
    .limit(1);
  if (cls) return true;
  const [stu] = await db.select({ id: students.id }).from(students).where(eq(students.teacherId, userId)).limit(1);
  return !!stu;
}

// POST /auth/register
router.post("/register", registerLimiter, registerEmailLimiter, async (req, res) => {
  try {
    const { firstName, lastName, email, password, confirmPassword, role: rawRole } =
      req.body as {
        firstName?: string;
        lastName?: string;
        email?: string;
        password?: string;
        confirmPassword?: string;
        /** Defaults to 'teacher' — the only role that needed no signup step until now. */
        role?: string;
      };

    if (typeof firstName !== "string" || !firstName.trim()) {
      res.status(400).json({ error: "First name is required", code: "missing_fields" });
      return;
    }
    if (typeof lastName !== "string" || !lastName.trim()) {
      res.status(400).json({ error: "Last name is required", code: "missing_fields" });
      return;
    }
    if (!isValidEmailAddress(email)) {
      res.status(400).json({ error: "Valid email is required", code: "invalid_email" });
      return;
    }
    if (typeof password !== "string" || !password || !isStrongPassword(password)) {
      res.status(400).json({ error: PASSWORD_POLICY_MESSAGE, code: "password_policy" });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match", code: "passwords_mismatch" });
      return;
    }

    const role: "teacher" | ClaimRole =
      rawRole === "student" || rawRole === "parent" ? rawRole : "teacher";

    // v1 is teacher-only. A student account is an account for a minor, and
    // the consent posture around one needs a lawyer and a matching store
    // declaration — see lib/features.ts. Refused here rather than hidden in
    // the app, because the app is not the security boundary.
    //
    // No roster code is asked for or resolved at this point anymore: a
    // parent/student account is created bare, and links to a roster row
    // afterwards through the one claiming path, POST /auth/claim — see
    // hasLiveRosterLink and the client-side gate that gets them there.
    if (role !== "teacher" && !studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    // A new account must have accepted the terms; see lib/termsAcceptance.ts.
    const terms = termsAcceptance(req.body);
    if (!terms.ok) {
      res.status(terms.status).json({ error: terms.error, code: terms.code });
      return;
    }

    // Check duplicate email
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (existing) {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
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
        termsAcceptedAt: terms.termsAcceptedAt,
        termsVersion: terms.termsVersion,
        ...signupSource(req.headers),
      })
      .returning();

    if (!user) throw new Error("Failed to create user");

    // No tokens issued here: a password account is unverified until it
    // proves the address at POST /auth/verify-email, which is what hands
    // back the session. Google accounts skip all of this — they set
    // emailVerified: true and log in immediately, further down this file.
    // Just inserted with a validated address, so it is never null here.
    const address = email.toLowerCase().trim();
    const emailSent = await issueVerificationCode(user.id, address);

    res.status(201).json(registerResponse(address, emailSent));
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }
    logger.error({ err }, "register failed");
    res.status(500).json({ error: "Registration failed" });
  }
});

// POST /auth/verify-email
router.post("/verify-email", verifyEmailLimiter, verifyEmailAddressLimiter, async (req, res) => {
  try {
    const { email, code } = req.body as { email?: string; code?: string };
    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required", code: "missing_fields" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Same generic message for "no such account" and "wrong/expired code" —
    // same shape as login's "invalid email or password" — so a wrong guess
    // here cannot be used to enumerate which codes are close. Registration's
    // own duplicate-email check already tells a caller an address is taken,
    // so this isn't hiding account existence, just not adding a second,
    // finer-grained oracle on top of it.
    const invalid = () => res.status(400).json({ error: "Invalid or expired code", code: "invalid_code" });

    if (!user) {
      invalid();
      return;
    }
    if (user.emailVerified) {
      res.status(400).json({ error: "This email is already verified", code: "already_verified" });
      return;
    }

    const [token] = await db
      .select()
      .from(emailVerificationTokens)
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          eq(emailVerificationTokens.used, false),
          gt(emailVerificationTokens.expiresAt, new Date()),
        ),
      )
      .orderBy(desc(emailVerificationTokens.createdAt))
      .limit(1);

    if (!token || token.attempts >= VERIFICATION_MAX_ATTEMPTS) {
      invalid();
      return;
    }

    if (token.codeHash !== hashVerificationCode(code.trim())) {
      await db
        .update(emailVerificationTokens)
        .set({ attempts: token.attempts + 1 })
        .where(eq(emailVerificationTokens.id, token.id));
      invalid();
      return;
    }

    await db
      .update(emailVerificationTokens)
      .set({ used: true })
      .where(eq(emailVerificationTokens.id, token.id));
    const [verified] = await db
      .update(users)
      .set({ emailVerified: true })
      .where(eq(users.id, user.id))
      .returning();

    const { accessToken, refreshTokenValue } = generateTokens(verified.id, verified.email, verified.role);
    await storeRefreshToken(verified.id, refreshTokenValue, req.headers.origin);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: {
        id: verified.id,
        firstName: verified.firstName,
        lastName: verified.lastName,
        email: verified.email,
        role: verified.role,
        preferredLanguage: verified.preferredLanguage,
        avatarUrl: avatarUrlFor(verified.avatarKey),
        gradeIds: verified.gradeIds,
        subjectIds: verified.subjectIds,
        teachingAssignments: verified.teachingAssignments,
        createdAt: verified.createdAt,
        // This is the call that hands back the session register used to, so
        // it owes the client the same field login does — without it a
        // freshly verified parent/student arrives with hasRosterLink absent
        // and the claim gate cannot tell "no link yet" from "not asked".
        //
        // Queried, not assumed false. It was a constant while the only way to
        // reach this route was register → verify, and nothing in between could
        // link an account. `/add-email` changed that: a parent or student who
        // signed up from a code verifies an address *after* being linked, and a
        // hard-coded false sent them to the claim screen to enter a code for a
        // child they were already linked to.
        ...(verified.role === "teacher" ? {} : { hasRosterLink: await hasLiveRosterLink(verified.id) }),
        hasLoginCode: verified.loginCodeHash !== null,
      },
    });
  } catch (err) {
    logger.error({ err }, "verify email failed");
    res.status(500).json({ error: "Verification failed" });
  }
});

// POST /auth/resend-verification
router.post("/resend-verification", resendVerificationLimiter, resendVerificationEmailLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email) {
      res.status(400).json({ error: "Email is required", code: "missing_fields" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // Same response whether a code was sent, the address is unknown, or the
    // account is already verified — so this cannot probe which emails are
    // registered. The one exception is a send that failed for an account that
    // needed it: see resendResponse.
    // A code-only account with no email has nowhere to send one.
    const needsCode = !!user && !!user.email && !user.emailVerified;
    const emailSent = needsCode && user?.email ? await issueVerificationCode(user.id, user.email) : false;

    const { status, body } = resendResponse(needsCode, emailSent);
    res.status(status).json(body);
  } catch (err) {
    logger.error({ err }, "resend verification failed");
    res.status(500).json({ error: "Failed to resend code" });
  }
});

/**
 * POST /auth/change-unverified-email
 *
 * Repoints a pending signup at a different address. Without this a typo is
 * unrecoverable: the account exists on an address its owner cannot read, no
 * code can arrive, and the unique constraint means a mistyped *real* address
 * is squatted — the person who actually owns it can then never register.
 *
 * The password is what makes this safe to leave unauthenticated. The account
 * has no session yet (that is the whole point of the screen this serves), so
 * the password is the only proof of ownership available, and without it
 * anyone could redirect a stranger's pending signup to an address they
 * control and collect the code.
 *
 * Deliberately refuses once the account is verified: past that point changing
 * an address is a profile edit made from a real session, with the old address
 * owed a notification — a different feature with a different threat model,
 * not this one widened.
 */
router.post("/change-unverified-email", changeEmailLimiter, changeEmailAddressLimiter, async (req, res) => {
  try {
    const { email, password, newEmail } = req.body as {
      email?: string;
      password?: string;
      newEmail?: string;
    };

    if (!email || !password || !newEmail) {
      res.status(400).json({ error: "Current email, password and a valid new email are required", code: "missing_fields" });
      return;
    }
    if (!isValidEmailAddress(newEmail)) {
      res.status(400).json({ error: "Valid email is required", code: "invalid_email" });
      return;
    }

    const current = email.toLowerCase().trim();
    const next = newEmail.toLowerCase().trim();

    if (current === next) {
      res.status(400).json({ error: "That is already the address on this account", code: "same_email" });
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.email, current)).limit(1);

    // One message for "no such account" and "wrong password", same as login:
    // this route is reachable without a session, so it must not confirm which
    // addresses have pending signups.
    if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: "Invalid email or password", code: "invalid_credentials" });
      return;
    }

    if (user.emailVerified) {
      res.status(400).json({ error: "This account is already verified", code: "already_verified" });
      return;
    }

    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, next)).limit(1);
    if (taken) {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ email: next })
      .where(eq(users.id, user.id))
      .returning();

    // Codes already sent named the old address. Burn them rather than leave
    // them usable — /verify-email takes the newest unused token, so a stale
    // one would otherwise stay valid until it expired.
    await db
      .update(emailVerificationTokens)
      .set({ used: true })
      .where(
        and(
          eq(emailVerificationTokens.userId, user.id),
          eq(emailVerificationTokens.used, false),
        ),
      );

    const emailSent = await issueVerificationCode(updated.id, next);

    logger.info({ userId: updated.id }, "pending signup repointed to a new email");
    res.json(changeEmailResponse(next, emailSent));
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }
    logger.error({ err }, "change unverified email failed");
    res.status(500).json({ error: "Failed to change email" });
  }
});

/**
 * Links an already-signed-in parent or student to one more roster row — a
 * second child for the same parent, a second parent for the same child, or a
 * second teacher's roster for the same student. Same resolver as /register,
 * just without creating a user row first.
 */
/**
 * POST /auth/forgot-password
 *
 * Restored 2026-09-12. It was deleted on 2026-09-10 because there was no way
 * to send the email — that was true for about thirty hours, until the Resend
 * integration landed with email verification. What it left behind was 23
 * accounts holding a password and no Google account, one forgotten password
 * away from needing an administrator.
 *
 * Answers `{ ok: true }` in every case that is not a malformed request:
 * account found, account absent, account exists but signs in with Google and
 * has no password to reset, mail provider refused the send. The caller learns
 * only that the request was accepted, which is the point — anything finer is
 * an oracle for which addresses have accounts here.
 */
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordEmailLimiter, async (req, res) => {
  try {
    const { email } = req.body as { email?: string };
    if (!email?.includes("@")) {
      res.status(400).json({ error: "Valid email is required", code: "invalid_email" });
      return;
    }

    const [user] = await db
      .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    // No account: nothing to tell, and no address to tell it to either way.
    // (An account with no email cannot match the lookup above; the check is for
    // the type, and the answer would be the same.)
    if (!user || !user.email) {
      res.json({ ok: true });
      return;
    }

    // Google-only account, no password to reset. The API answer is still
    // `{ok:true}` — identical to every other branch — but the inbox itself
    // gets told why no code is coming, instead of silence that reads as a
    // delivery failure.
    if (!user.passwordHash) {
      const sent = await sendGoogleAccountNoticeEmail(user.email);
      if (!sent) logger.error({ userId: user.id }, "google-account notice could not be emailed");
      res.json({ ok: true });
      return;
    }

    const code = generateResetCode();

    // One live code per account: asking again replaces the previous one rather
    // than leaving two valid. Without this, every request widens the window an
    // attacker is guessing against instead of resetting it.
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));
    await db.insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash: hashResetCode(user.id, code),
      expiresAt: new Date(Date.now() + RESET_CODE_TTL_MS),
    });

    const sent = await sendPasswordResetEmail(user.email, code);
    // Logged without the code and without a way to tie it back to one, because
    // a failed send is an operational problem and a code in a log is a
    // takeover. lib/email.ts records the provider's own reason.
    if (!sent) logger.error({ userId: user.id }, "password reset code could not be emailed");

    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "forgot password failed");
    res.status(500).json({ error: "Failed to process request" });
  }
});

/**
 * POST /auth/reset-password
 *
 * Takes the email alongside the code: the code is hashed together with the
 * user id (lib/passwordReset.ts), so it cannot be looked up on its own, and a
 * code is only ever valid for the account it was sent to.
 */
router.post("/reset-password", resetPasswordLimiter, async (req, res) => {
  try {
    const { email, code, password, confirmPassword } = req.body as {
      email?: string;
      code?: string;
      password?: string;
      confirmPassword?: string;
    };

    if (!email || !code) {
      res.status(400).json({ error: "Email and code are required", code: "missing_fields" });
      return;
    }
    if (!password || !isStrongPassword(password)) {
      res.status(400).json({ error: PASSWORD_POLICY_MESSAGE, code: "password_policy" });
      return;
    }
    if (confirmPassword !== undefined && confirmPassword !== password) {
      res.status(400).json({ error: "Passwords do not match", code: "passwords_mismatch" });
      return;
    }

    // One message for every way this can fail, same as /verify-email: a wrong
    // code, an expired one, an address with no account, an account that has
    // no password. Distinguishing them tells a guesser which door to keep
    // knocking on.
    const invalid = () => res.status(400).json({ error: "Invalid or expired code", code: "invalid_code" });

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user) {
      invalid();
      return;
    }

    const [stored] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.userId, user.id),
          eq(passwordResetTokens.tokenHash, hashResetCode(user.id, code.trim())),
          eq(passwordResetTokens.used, false),
          gt(passwordResetTokens.expiresAt, new Date()),
        ),
      )
      .limit(1);

    if (!stored) {
      invalid();
      return;
    }

    const passwordHash = await bcrypt.hash(password, 12);
    // One transaction, so the user row stays locked until the sessions are
    // gone — the lock `/refresh` takes before rotating a token.
    await db.transaction(async tx => {
      await tx.update(users).set({
        passwordHash,
        // Reading a code sent to that address is the same proof registration
        // asks for, so a reset settles verification too. Without this, someone
        // who reset their password could still be refused at login for an
        // address they just demonstrably control.
        emailVerified: true,
      }).where(eq(users.id, user.id));

      await tx
        .update(passwordResetTokens)
        .set({ used: true })
        .where(eq(passwordResetTokens.id, stored.id));

      // Every existing session dies with the old password. If this reset was
      // someone taking their account back, the sessions worth ending are exactly
      // the ones already open.
      await tx.delete(refreshTokens).where(eq(refreshTokens.userId, user.id));
    });

    logger.info({ userId: user.id }, "password reset completed");
    res.json({ ok: true });
  } catch (err) {
    logger.error({ err }, "reset password failed");
    res.status(500).json({ error: "Failed to reset password" });
  }
});

router.post("/claim", authMiddleware, claimLimiter, async (req: AuthenticatedRequest, res) => {
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

    const { claimCode, studentId } = (req.body ?? {}) as { claimCode?: string; studentId?: string };
    const code = claimCode?.trim();
    if (!code) {
      res.status(400).json({ error: "A class code is required" });
      return;
    }

    const resolved = await resolveClaimCode(code, role, trimmedOrUndefined(studentId), req.user!.id);
    if (!resolved.ok) {
      // `code` as well as `error`: the app is Arabic-first and these strings
      // are English, so the screen translates the code rather than printing
      // the sentence (services/claimCodeGate.ts).
      res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      return;
    }

    const userId = req.user!.id;
    const outcome = await db.transaction(tx => linkRosterRowInTx(tx, userId, resolved));
    if (outcome === "taken") {
      res.status(409).json({
        error: "This student is already linked to another account",
        code: "claim_already_linked",
      });
      return;
    }
    if (outcome === "guardian_taken") {
      res.status(409).json({
        error: "A parent account is already linked to this student",
        code: "claim_guardian_taken",
      });
      return;
    }

    // Into the class chat now, not the next time the teacher opens it.
    if (resolved.relation === "self") {
      try {
        await syncClassThreadsForStudent(resolved.studentId);
      } catch (err) {
        logger.warn({ err, studentId: resolved.studentId }, "class thread sync after claim failed");
      }
    }

    if (resolved.relation === "self") {
      // One student, one self-link — decideClaim checked, but check-then-insert
      // has no database backstop (the unique index is on student+user), so two
      // student accounts claiming the same name in the same moment both got
      // through. Re-read after the insert: if more than one self-link now
      // exists, the earliest stays and this one withdraws with the same 409 the
      // rule would have given it a moment later. Both racers run this, both
      // see two rows, and only the later one deletes its own.
      const selfLinks = await db
        .select({ id: rosterLinks.id, userId: rosterLinks.userId, createdAt: rosterLinks.createdAt })
        .from(rosterLinks)
        .where(and(eq(rosterLinks.studentId, resolved.studentId), eq(rosterLinks.relation, "self")))
        .orderBy(asc(rosterLinks.createdAt), asc(rosterLinks.id));
      if (selfLinks.length > 1 && selfLinks[0]!.userId !== req.user!.id) {
        await db
          .delete(rosterLinks)
          .where(and(eq(rosterLinks.studentId, resolved.studentId), eq(rosterLinks.userId, req.user!.id)));
        res.status(409).json({ error: "This student is already linked to an account", code: "claim_already_linked" });
        return;
      }

      await resyncClassThreadsOfStudent(resolved.studentId);
    }

    res.status(201).json({ studentId: resolved.studentId, relation: resolved.relation });
  } catch (err) {
    logger.error({ err }, "claim failed");
    res.status(500).json({ error: "Failed to link account" });
  }
});

/**
 * Who this account is linked to, each with the grade their roster row (or its
 * class) says — so the class picker after a claim can say «Memi · الصف الخامس»
 * and start ticked, instead of a parent guessing whether they picked the right
 * name.
 */
router.get("/claim", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const rows = await db
      .select({
        studentId: students.id,
        displayName: students.displayName,
        studentGradeId: students.gradeId,
        classGradeId: classGroups.gradeId,
      })
      .from(rosterLinks)
      .innerJoin(students, eq(students.id, rosterLinks.studentId))
      .leftJoin(classMemberships, eq(classMemberships.studentId, students.id))
      .leftJoin(classGroups, and(eq(classGroups.id, classMemberships.classGroupId), isNull(classGroups.archivedAt)))
      .where(and(eq(rosterLinks.userId, req.user!.id), isNull(students.archivedAt)));
    const byStudent = new Map<string, { studentId: string; displayName: string; gradeId: string | null }>();
    for (const r of rows) {
      const gradeId = studentGradeIds([r])[0] ?? null;
      const seen = byStudent.get(r.studentId);
      if (!seen) byStudent.set(r.studentId, { studentId: r.studentId, displayName: r.displayName, gradeId });
      else if (!seen.gradeId) seen.gradeId = gradeId;
    }
    res.json({ links: [...byStudent.values()] });
  } catch (err) {
    logger.error({ err }, "claim list failed");
    res.status(500).json({ error: "Failed to load your links" });
  }
});

/**
 * The joiner's own undo for a wrong pick: drops every roster link this account
 * holds, so the routing gate sends it back to the code screen. Only ever the
 * caller's own rows — the teacher's per-link undo is
 * `DELETE /students/:id/links/:userId`. Class chats are rebuilt the same way
 * that route does, so the account leaves the wrong class's thread now.
 */
router.delete("/claim", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const removed = await db
      .delete(rosterLinks)
      .where(eq(rosterLinks.userId, req.user!.id))
      .returning({ studentId: rosterLinks.studentId });
    for (const studentId of new Set(removed.map(r => r.studentId))) {
      await syncClassThreadsForStudent(studentId);
    }
    res.json({ hasRosterLink: false });
  } catch (err) {
    logger.error({ err }, "unclaim failed");
    res.status(500).json({ error: "Failed to unlink account" });
  }
});

/**
 * Change the role picked at signup, while nothing depends on it yet.
 *
 * Its own limiter rather than claimLimiter's: sharing one quota would mean a
 * parent who burned ten wrong codes could no longer get off the screen those
 * codes are asked for, which is the opposite of what this route is for.
 */
const roleSwitchLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: 10, name: "role-switch", key: perUser });

/**
 * `POST /auth/role` — the way back from a role picked wrong at signup. Who may
 * still use it, and why it closes, is decided in lib/roleSwitch.ts.
 *
 * Mints no new tokens: authMiddleware re-reads `users.role` from the row on
 * every request, so the role inside an access token never decides anything and
 * the change is live on the caller's next call.
 */
router.post("/role", authMiddleware, roleSwitchLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const decision = await decideRoleSwitch({
      currentRole: req.user!.role,
      requestedRole: (req.body ?? {}).role,
      studentAccountsEnabled: studentAccountsEnabled(),
      hasRosterLink: () => hasAnyRosterLink(req.user!.id),
      hasTeachingData: () => hasAnyTeachingData(req.user!.id),
    });

    if (!decision.ok) {
      // `code` as well as `error`, for the reason POST /claim gives: the screen
      // showing this is Arabic and these sentences are not.
      res.status(decision.status).json({ error: decision.error, code: decision.code });
      return;
    }

    if (decision.changed) {
      await db.update(users).set({ role: decision.role }).where(eq(users.id, req.user!.id));
      logger.info({ userId: req.user!.id, from: req.user!.role, to: decision.role }, "role switched");
    }

    // An `ok` decision has already established there is no roster link, so
    // this is not a guess — it is the same false the gate was reading before.
    res.json({
      role: decision.role,
      ...(decision.role === "teacher" ? {} : { hasRosterLink: false }),
    });
  } catch (err) {
    logger.error({ err }, "role switch failed");
    res.status(500).json({ error: "Failed to change account type" });
  }
});

/**
 * Turns a class join code into the list of names it can be claimed against, so
 * a joiner can pick their own before they have an account. Modelled on
 * GET /take/:code in studentAttempt.ts, the existing public "code → roster of
 * names" surface.
 *
 * Deliberately under /auth and not /classes: roster.ts mounts
 * `router.use(["/classes","/students"], authMiddleware, …)`, which prefix-matches,
 * so a route named /classes/join/:code would silently answer 401 to the very
 * people it exists for. mountOrder.test.ts pins this.
 *
 * This is the only unauthenticated endpoint in the product that returns
 * children's names, and it is not something to make quietly broader later.
 * Four things hold it in: the feature flag below, the rate limit, the 180-day
 * expiry on the code itself, and the teacher's ability to regenerate. The
 * payload carries names and nothing else — no externalRef (a school register
 * number identifies far harder than a first name), no grade, no teacher.
 *
 * ponytail: one shared limiter, not per-code lockout. Revisit if anyone
 * actually grinds it — 60/min against 31^6 is slow, but it is slow for every
 * live code at once, not per code.
 */
const joinLookupLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 60, name: "join-lookup" });

router.get("/join/:code", joinLookupLimiter, async (req, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const code = normalizeShareCode(req.params["code"]);
    const [group] = code
      ? await db
          .select({ id: classGroups.id, name: classGroups.name, nameAr: classGroups.nameAr })
          .from(classGroups)
          .where(
            and(
              eq(classGroups.joinCode, code),
              isNull(classGroups.archivedAt),
              gt(classGroups.joinCodeExpiresAt, new Date()),
            ),
          )
          .limit(1)
      : [];

    // Unknown, expired and archived all answer alike: a public endpoint must
    // not confirm which codes exist. Same reasoning as evaluationByCode.
    if (!group) {
      res.status(404).json({ error: "This class code is not available", code: "code_not_found" });
      return;
    }

    const roster = await db
      .select({ id: students.id, displayName: students.displayName })
      .from(classMemberships)
      .innerJoin(students, eq(students.id, classMemberships.studentId))
      .where(and(eq(classMemberships.classGroupId, group.id), isNull(students.archivedAt)))
      .orderBy(asc(students.displayName));

    // Every name is returned, with `taken` marking the ones a student account
    // already holds and `guardianTaken` the ones a parent account does — not
    // filtered out. Each relation is exclusive on this list (decideClaim), but
    // hiding a claimed name would make the class code look broken to the person
    // looking for their own child, and the names are visible either way, so
    // filtering would buy no privacy. They are listed, marked, and the app
    // refuses to select them. Which flag applies depends on who is looking, and
    // this route does not know — it is unauthenticated — so it sends both.
    // A second parent is added with the per-student code instead.
    // Skipped entirely on an empty roster rather than asked with a placeholder
    // id. `rosterLinks.studentId` is a uuid column, so the `[""]` that used to
    // stand in for "no ids" made Postgres reject the whole statement — every
    // class whose teacher had minted a join code before adding any names
    // answered 500 here, the app read that as "not a class code", hid the
    // picker, and let the joiner submit a nameless claim that came back
    // "Choose your name from the class list".
    const links =
      roster.length === 0
        ? []
        : await db
            .select({ studentId: rosterLinks.studentId, relation: rosterLinks.relation })
            .from(rosterLinks)
            .where(inArray(rosterLinks.studentId, roster.map(s => s.id)));
    const taken = new Set(links.filter(r => r.relation === "self").map(r => r.studentId));
    const guardianTaken = new Set(links.filter(r => r.relation === "guardian").map(r => r.studentId));

    res.json({
      class: { name: group.name, nameAr: group.nameAr },
      students: roster.map(s => ({ ...s, taken: taken.has(s.id), guardianTaken: guardianTaken.has(s.id) })),
    });
  } catch (err) {
    logger.error({ err }, "join code lookup failed");
    res.status(500).json({ error: "Failed to open this class code" });
  }
});

/**
 * The user shape every sign-in response carries. One builder for the two routes
 * that mint a session without an email (`/redeem`, `/code-login`), so they
 * cannot drift apart. `email` is null here by construction.
 */
function codeAccountUser(user: typeof users.$inferSelect, hasRosterLink: boolean) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: user.role,
    preferredLanguage: user.preferredLanguage,
    avatarUrl: avatarUrlFor(user.avatarKey),
    gradeIds: user.gradeIds,
    subjectIds: user.subjectIds,
    teachingAssignments: user.teachingAssignments,
    createdAt: user.createdAt,
    lastLogin: user.lastLogin,
    hasRosterLink,
    // These two routes are the only ones that make or sign in such an account.
    hasLoginCode: true,
  };
}

/** Thrown inside the redeem transaction to roll the new user back when the roster row turns out to be taken. */
class RedeemRefused extends Error {
  constructor(readonly outcome: "taken" | "guardian_taken") {
    super(outcome);
  }
}

/**
 * POST /auth/redeem — create a parent or student account from a teacher's code
 * alone. No email, no password, no verification: the code is the proof of who
 * is asking, because the teacher chose who to give it to.
 *
 * The account is created and linked in ONE transaction. Two steps would leave a
 * linkless account behind whenever the second failed, and that account is one a
 * child cannot get out of — it has no email to recover it by.
 *
 * What it returns, and returns only once, is `loginCode`: the personal
 * credential for signing back in (see lib/loginCode.ts for why the teacher's own
 * code cannot be that). Only its hash is stored; lose it and the teacher issues
 * a new one.
 *
 * ponytail: not idempotent. A retry after a lost response finds the code taken
 * (a student's `claim_already_linked`) and the child asks the teacher to unlink
 * and reissue. Add an idempotency key if that turns out to be common.
 */
router.post("/redeem", redeemIpLimiter, redeemCodeLimiter, async (req, res) => {
  try {
    // Closed for the same reason /register and /claim are.
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const { claimCode, studentId, role: rawRole, preferredLanguage } = (req.body ?? {}) as {
      claimCode?: unknown;
      studentId?: unknown;
      role?: unknown;
      preferredLanguage?: unknown;
    };

    if (rawRole !== "student" && rawRole !== "parent") {
      res.status(400).json({ error: "Choose student or parent", code: "invalid_role" });
      return;
    }
    const role: ClaimRole = rawRole;

    const code = typeof claimCode === "string" ? claimCode.trim() : "";
    if (!code) {
      res.status(400).json({ error: "A code is required", code: "claim_code_invalid" });
      return;
    }

    // A new account must have accepted the terms; see lib/termsAcceptance.ts.
    const terms = termsAcceptance(req.body);
    if (!terms.ok) {
      res.status(terms.status).json({ error: terms.error, code: terms.code });
      return;
    }

    // No account exists yet, so there is no existing link of the caller's own
    // to exclude: a fresh id means "nobody", which is exactly right.
    const resolved = await resolveClaimCode(
      code,
      role,
      trimmedOrUndefined(typeof studentId === "string" ? studentId : undefined),
      crypto.randomUUID(),
    );
    if (!resolved.ok) {
      res.status(resolved.status).json({ error: resolved.error, code: resolved.code });
      return;
    }

    const roleCheck = redeemRoleCheck(role, resolved);
    if (!roleCheck.ok) {
      res.status(roleCheck.status).json({ error: roleCheck.error, code: roleCheck.code });
      return;
    }

    const [student] = await db
      .select({ displayName: students.displayName })
      .from(students)
      .where(eq(students.id, resolved.studentId))
      .limit(1);
    if (!student) {
      res.status(400).json({ error: "That code is invalid or has expired", code: "claim_code_invalid" });
      return;
    }

    const loginCode = generateLoginCode();
    const names = namesForNewAccount(role, student.displayName);

    let user: typeof users.$inferSelect;
    try {
      user = await db.transaction(async tx => {
        const [created] = await tx
          .insert(users)
          .values({
            ...names,
            email: null,
            passwordHash: null,
            loginCodeHash: hashLoginCode(loginCode)!,
            role,
            // Arabic-first: unlike register, which defaults to "en" because its
            // callers are teachers who pick, a child redeeming a class code has
            // not been asked and the whole product is Arabic.
            preferredLanguage: preferredLanguage === "en" ? "en" : "ar",
            termsAcceptedAt: terms.termsAcceptedAt,
            termsVersion: terms.termsVersion,
            lastLogin: new Date(),
            ...signupSource(req.headers),
          })
          .returning();
        if (!created) throw new Error("Failed to create user");

        const outcome = await linkRosterRowInTx(tx, created.id, resolved);
        if (outcome !== "linked") throw new RedeemRefused(outcome);
        return created;
      });
    } catch (err) {
      if (err instanceof RedeemRefused) {
        res.status(409).json(
          err.outcome === "taken"
            ? { error: "This student is already linked to an account", code: "claim_already_linked" }
            : { error: "A parent account is already linked to this student", code: "claim_guardian_taken" },
        );
        return;
      }
      throw err;
    }

    if (resolved.relation === "self") {
      try {
        await syncClassThreadsForStudent(resolved.studentId);
        await resyncClassThreadsOfStudent(resolved.studentId);
      } catch (err) {
        // The account and its link are committed; a chat that is a moment late
        // must not turn a successful signup into an error.
        logger.warn({ err, studentId: resolved.studentId }, "class thread sync after redeem failed");
      }
    }

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue, req.headers.origin);

    res.status(201).json({
      accessToken,
      refreshToken: refreshTokenValue,
      loginCode,
      user: codeAccountUser(user, true),
    });
  } catch (err) {
    logger.error({ err }, "redeem failed");
    res.status(500).json({ error: "Could not create the account" });
  }
});

/**
 * POST /auth/code-login — sign back in with the personal login code, on a new
 * phone or after logging out. Only accounts made by /redeem have one.
 *
 * One answer for "malformed", "no such code" and "wrong": the code is the whole
 * credential, so which of those it was is exactly what a guesser would want.
 */
router.post("/code-login", codeLoginLimiter, async (req, res) => {
  try {
    if (!studentAccountsEnabled()) {
      res.status(403).json({
        code: "student_accounts_disabled",
        error: "Parent and student accounts are not available yet.",
      });
      return;
    }

    const hash = hashLoginCode((req.body as { loginCode?: unknown } | undefined)?.loginCode);
    const invalid = () =>
      res.status(401).json({ error: "That login code is not right", code: "invalid_login_code" });
    if (!hash) {
      invalid();
      return;
    }

    const [user] = await db.select().from(users).where(eq(users.loginCodeHash, hash)).limit(1);
    if (!user) {
      invalid();
      return;
    }

    // Past the credential there is no one left to leak a suspension to; same
    // ordering as /login, and the reason is what lets them appeal.
    if (user.suspendedAt) {
      res.status(403).json({
        error: user.suspendedReason || "This account has been suspended.",
        code: "account_suspended",
      });
      return;
    }

    const [updated] = await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, user.id))
      .returning();

    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    await storeRefreshToken(user.id, refreshTokenValue, req.headers.origin);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      user: codeAccountUser(updated ?? user, await hasLiveRosterLink(user.id)),
    });
  } catch (err) {
    logger.error({ err }, "code login failed");
    res.status(500).json({ error: "Login failed" });
  }
});

/**
 * POST /auth/add-email — a signed-in account that has no email adds one, with a
 * password, so it can later reset that password and sign in the ordinary way.
 *
 * Asks for the password here, not later: without one, `/forgot-password` would
 * find a verified email and no hash and answer with the "this is a Google
 * account" notice, which is false. With one, the existing verify-email and
 * reset flows work unchanged, so nothing else needs to learn about this path.
 *
 * Verification is the usual one — the address is stored unverified, a 6-digit
 * code goes to it, and `POST /verify-email` (which hands back a fresh session)
 * finishes it. The login code keeps working throughout and afterwards.
 */
router.post("/add-email", authMiddleware, addEmailUserLimiter, addEmailAddressLimiter, async (req: AuthenticatedRequest, res) => {
  try {
    const { email, password } = (req.body ?? {}) as { email?: unknown; password?: unknown };

    if (!isValidEmailAddress(email)) {
      res.status(400).json({ error: "Valid email is required", code: "invalid_email" });
      return;
    }
    if (typeof password !== "string" || !password || !isStrongPassword(password)) {
      res.status(400).json({ error: PASSWORD_POLICY_MESSAGE, code: "password_policy" });
      return;
    }

    const address = email.toLowerCase().trim();
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.email, address)).limit(1);
    if (taken) {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }

    // Conditional on the column still being null: this route is for accounts
    // without an address. Changing a verified one is a different, riskier act
    // (it moves where password resets go) and is not offered here.
    const passwordHash = await bcrypt.hash(password, 12);
    const [updated] = await db
      .update(users)
      .set({ email: address, passwordHash, emailVerified: false })
      .where(and(eq(users.id, req.user!.id), isNull(users.email)))
      .returning({ id: users.id, email: users.email });
    if (!updated || !updated.email) {
      res.status(409).json({ error: "This account already has an email", code: "email_already_set" });
      return;
    }

    const emailSent = await issueVerificationCode(updated.id, updated.email);
    res.json({
      email: updated.email,
      emailSent,
      message: emailSent
        ? "Check your email for a 6-digit verification code."
        : "We could not send the verification email. Try resending the code, or check the address.",
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }
    logger.error({ err }, "add email failed");
    res.status(500).json({ error: "Could not add the email" });
  }
});

// POST /auth/login
router.post("/login", loginLimiter, loginEmailLimiter, async (req, res) => {
  try {
    const { email, password } = req.body as { email?: unknown; password?: unknown };

    // Type-checked, not just truthy: `email: ["@"]` or a numeric password
    // used to pass the guard and throw inside `.toLowerCase()` / bcrypt,
    // which answered 500 "Login failed" for what is a malformed request.
    if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
      res.status(400).json({ error: "Email and password are required", code: "missing_fields" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email.toLowerCase().trim()))
      .limit(1);

    if (!user || !user.passwordHash) {
      // No account, or a Google-only account with no password set — same
      // generic message either way so this can't be used to enumerate emails.
      res.status(401).json({ error: "Invalid email or password", code: "invalid_credentials" });
      return;
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password", code: "invalid_credentials" });
      return;
    }

    // Checked after the password too, and before suspension, for the same
    // enumeration reason as the suspension check below: nothing about this
    // account is confirmed until the password has already proved who is
    // asking. A Google account never reaches this false — see /auth/google,
    // which sets emailVerified: true itself, and register's pre-existing
    // account-linking path, which does the same.
    if (!user.emailVerified) {
      res.status(403).json({
        error: "Please verify your email before signing in.",
        code: "email_not_verified",
      });
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
    await storeRefreshToken(user.id, refreshTokenValue, req.headers.origin);

    // Only asked of the database for the two roles the app's routing gate
    // cares about — a teacher never has (or needs) a rosterLinks row.
    const hasRosterLink =
      user.role === "student" || user.role === "parent"
        ? await hasLiveRosterLink(user.id)
        : undefined;

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
        avatarUrl: avatarUrlFor(user.avatarKey),
        gradeIds: user.gradeIds,
        subjectIds: user.subjectIds,
        teachingAssignments: user.teachingAssignments,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        ...(hasRosterLink === undefined ? {} : { hasRosterLink }),
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
    if (!googleClient || googleClientIdList.length === 0) {
      res.status(503).json({ error: "Google sign-in is not configured" });
      return;
    }

    const { credential, role: rawRole } = req.body as {
      credential?: string;
      /** Only consulted when Google is minting a brand-new account — see below. */
      role?: string;
    };
    if (!credential) {
      res.status(400).json({ error: "Google credential is required", code: "invalid_google_credential" });
      return;
    }

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: credential,
        audience: googleClientIdList,
      });
      payload = ticket.getPayload();
    } catch (err) {
      // Logged, because this catch swallows two very different things: a
      // genuinely bad token, and a client ID this server does not accept. Both
      // answered 401 with nothing written down, so a misconfigured audience was
      // indistinguishable from an ordinary failed sign-in — and that is exactly
      // the failure mode a client-ID migration produces. `warn`, not `error`:
      // a bad token is routine, and the accepted list is included so the log
      // line alone settles which of the two it was.
      logger.warn({ err, acceptedAudiences: googleClientIdList }, "google id token rejected");
      res.status(401).json({ error: "Invalid Google credential", code: "invalid_google_credential" });
      return;
    }

    if (!payload?.sub || !payload.email) {
      res.status(401).json({ error: "Invalid Google credential", code: "invalid_google_credential" });
      return;
    }

    /*
     * `verifyIdToken` proved Google minted this token for an audience we
     * accept. It did NOT prove Google ever verified the address inside it —
     * that is what `email_verified` says, and it is a separate claim.
     *
     * The address is used as an account key three lines down, so trusting an
     * unverified one hands whoever holds it the matching account. Not
     * theoretical here: a Workspace admin can mint any address on their own
     * domain, and the customers are schools on Workspace domains.
     *
     * Same 401 as a bad token, since to the caller both are "this credential
     * won't get you in" and the distinction is only useful to someone probing.
     */
    if (payload.email_verified !== true) {
      logger.warn({ sub: payload.sub }, "google id token rejected — email not verified by google");
      res.status(401).json({ error: "Invalid Google credential", code: "invalid_google_credential" });
      return;
    }

    const email = payload.email.toLowerCase().trim();

    let [user] = await db.select().from(users).where(eq(users.googleId, payload.sub)).limit(1);
    // True only for the branch below that inserts a brand-new row — that
    // account can never already hold a roster link, so its hasRosterLink is
    // known without a query. Every other branch (matched or email-linked) may
    // have claimed one at any point in the past via /auth/claim, so those
    // still need to ask.
    let isNewAccount = false;

    // An existing account of a different role than the one just asked for: say
    // so, before anything links or signs in (see googleRoleConflict).
    {
      const [known] = user
        ? [user]
        : await db.select().from(users).where(eq(users.email, email)).limit(1);
      const conflict = known ? googleRoleConflict(known, rawRole) : null;
      if (conflict) {
        // The register screen's role pill is the same question POST /auth/role
        // answers, and Google proving the address is the same authority as a
        // session on it — so apply the switch under the same rules, instead of
        // refusing. A parent who picked wrong at signup used to tap Google again
        // with "teacher" selected, get this 409, and sign in as a parent anyway,
        // back onto the claim screen asking for a code they don't have.
        const decision = await decideRoleSwitch({
          currentRole: known!.role,
          requestedRole: rawRole,
          studentAccountsEnabled: studentAccountsEnabled(),
          hasRosterLink: () => hasAnyRosterLink(known!.id),
          hasTeachingData: () => hasAnyTeachingData(known!.id),
        });
        if (!decision.ok) {
          res.status(409).json({
            // The screen showing this is Arabic; it branches on `code`.
            code: decision.code,
            existingRole: conflict,
            error: `An account with this email already exists as a ${conflict}. Use Sign in instead.`,
          });
          return;
        }
        await db.update(users).set({ role: decision.role }).where(eq(users.id, known!.id));
        logger.info({ userId: known!.id, from: known!.role, to: decision.role }, "role switched via google signup");
        // `user` is this same row when matched by googleId; the email-linked
        // branch below re-reads it from the database after the update.
        known!.role = decision.role;
      }
    }

    if (!user) {
      // Link to an existing password account with the same email if one
      // exists, otherwise create a fresh Google-only account.
      [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

      if (user) {
        // Why a row that was never verified loses its password here: see
        // lib/googleLink.ts. Short version — /register lets anyone pre-create
        // an account on someone else's address, and this is the line that
        // would otherwise turn that password into a working credential.
        const decision = decideGoogleLink(user, payload.sub);
        const linkedId = user.id;
        [user] = await db
          .update(users)
          .set(decision.update)
          .where(eq(users.id, linkedId))
          .returning();

        if (decision.revokeExistingCredentials) {
          // Nothing should hold a session on this row — /register issues none
          // — but anything that somehow does was minted before the address was
          // proved, so it is exactly what must not outlive the link.
          await db.delete(refreshTokens).where(eq(refreshTokens.userId, linkedId));
          // Codes already in flight were sent on behalf of whoever created the
          // row. Google has settled verification; leaving them live leaves a
          // second door into an account that now has a real owner.
          await db
            .update(emailVerificationTokens)
            .set({ used: true })
            .where(
              and(
                eq(emailVerificationTokens.userId, linkedId),
                eq(emailVerificationTokens.used, false),
              ),
            );
          logger.info(
            { userId: linkedId },
            "google linked to an unverified account — password cleared, pending codes burned",
          );
        }
      } else {
        // A brand-new account: the register screen's role picker reaches this
        // route too (its "Continue with Google" button), and used to always
        // land here as a plain teacher with no code ever asked — same v1 gate
        // as /register, checked before any row is written. No roster code is
        // asked for here either anymore — see the matching change in
        // /register; claiming happens afterwards through POST /auth/claim.
        const role: "teacher" | ClaimRole =
          rawRole === "student" || rawRole === "parent" ? rawRole : "teacher";

        if (role !== "teacher" && !studentAccountsEnabled()) {
          res.status(403).json({
            code: "student_accounts_disabled",
            error: "Parent and student accounts are not available yet.",
          });
          return;
        }

        // Only here, on the branch that creates an account: someone signing
        // back in with Google is not asked again. The register screen's
        // checkbox used to gate its password form only — this button
        // skipped it, and nothing was recorded either way.
        const terms = termsAcceptance(req.body);
        if (!terms.ok) {
          res.status(terms.status).json({ error: terms.error, code: terms.code });
          return;
        }

        isNewAccount = true;
        [user] = await db
          .insert(users)
          .values({
            firstName: payload.given_name?.trim() || email.split("@")[0],
            lastName: payload.family_name?.trim() || "",
            email,
            googleId: payload.sub,
            role,
            preferredLanguage: "en",
            emailVerified: true,
            termsAcceptedAt: terms.termsAcceptedAt,
            termsVersion: terms.termsVersion,
            ...signupSource(req.headers),
          })
          .returning();
      }
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
    await storeRefreshToken(user.id, refreshTokenValue, req.headers.origin);

    const hasRosterLink =
      user.role !== "student" && user.role !== "parent"
        ? undefined
        : isNewAccount
          ? false
          : await hasLiveRosterLink(user.id);

    res.json({
      accessToken,
      refreshToken: refreshTokenValue,
      // Whether this credential just minted an account or signed an existing
      // one in. Only the server can tell them apart — the client gets an
      // identical token pair either way — so without this the app would have to
      // count the button someone pressed instead of the account that was
      // created, and every existing teacher who tapped "sign up" would inflate
      // the signup number.
      isNewAccount,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        role: user.role,
        preferredLanguage: user.preferredLanguage,
        avatarUrl: avatarUrlFor(user.avatarKey),
        gradeIds: user.gradeIds,
        subjectIds: user.subjectIds,
        teachingAssignments: user.teachingAssignments,
        createdAt: user.createdAt,
        lastLogin: user.lastLogin,
        ...(hasRosterLink === undefined ? {} : { hasRosterLink }),
      },
    });
  } catch (err: any) {
    if (err.code === "23505") {
      res.status(409).json({ error: "An account with this email already exists", code: "email_taken" });
      return;
    }
    logger.error({ err }, "google auth failed");
    res.status(500).json({ error: "Google sign-in failed" });
  }
});

// POST /auth/logout
router.post("/logout", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { refreshToken } = req.body as { refreshToken?: unknown };
    if (typeof refreshToken === "string" && refreshToken) {
      /*
       * The whole family, not just the row presented.
       *
       * Deleting one row was right when rotation deleted its predecessor: the
       * presented token was the only live one. It is not right now that
       * predecessors are kept for replay detection — leaving them behind would
       * mean signing out, then having a retired token from that same session
       * turn up later and revoke a family the user had already abandoned.
       * Ending the chain is also what "log out" means.
       */
      // Scoped to the caller: a token value that belongs to someone else must
      // not let this account end that user's sessions.
      const [row] = await db
        .select({ familyId: refreshTokens.familyId })
        .from(refreshTokens)
        .where(
          and(
            eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)),
            eq(refreshTokens.userId, req.user!.id),
          ),
        )
        .limit(1);
      if (row) {
        await db
          .delete(refreshTokens)
          .where(and(eq(refreshTokens.familyId, row.familyId), eq(refreshTokens.userId, req.user!.id)));
      }
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

    /*
     * Fetched by hash alone — no `expiresAt` filter in the query.
     *
     * The filter used to be here, and it hid the thing this route now looks
     * for: an expired row and a replayed row both came back empty, so a token
     * presented twice was indistinguishable from one presented late. Expiry is
     * decided in `decideRefresh` instead, after reuse has been ruled out.
     */
    const [stored] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.tokenHash, hashRefreshToken(refreshToken)))
      .limit(1);

    const outcome = decideRefresh(stored, new Date());

    if (outcome.action === "revoke_family") {
      /*
       * This token was already exchanged for a successor, and someone has just
       * presented it again. Nobody legitimate does that — the client that
       * rotated it holds the replacement — so there are two copies in the
       * world and no way to tell which caller is the owner.
       *
       * So the whole chain goes, the honest client's live token included. That
       * signs the real user out, which is the point: they sign back in with a
       * password we still trust, and the thief cannot.
       */
      // Under the user's row lock, so a sibling refresh of the family's live
      // token cannot commit a successor this delete's snapshot misses.
      await db.transaction(async tx => {
        await tx.select({ id: users.id }).from(users).where(eq(users.id, stored!.userId)).for("update");
        await tx.delete(refreshTokens).where(eq(refreshTokens.familyId, outcome.familyId));
      });
      logger.warn(
        { userId: stored!.userId, familyId: outcome.familyId },
        "refresh token reuse detected — session family revoked",
      );
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    if (outcome.action === "reject") {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, stored!.userId))
      .limit(1);

    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }

    // Retired, not deleted: a deleted row cannot report that it was used twice,
    // which is the entire mechanism above. Conditional on `rotatedAt` still
    // being null so that two refreshes racing the same token produce one
    // winner — the loser updates nothing, and its own next attempt reads a
    // retired row and trips the branch above, which is the correct reading of
    // two callers holding one token.
    //
    // Retire and successor in one transaction holding a share lock on the user
    // row. Every revocation (password reset, admin reset, family revoke) takes
    // that row for update first, so it either finishes before this — and the
    // retire finds no row — or waits for this to commit and then deletes the
    // successor too. Two separate statements let a reset land between them and
    // leave a session minted after the password changed.
    const { accessToken, refreshTokenValue } = generateTokens(user.id, user.email, user.role);
    const rotated = await db.transaction(async tx => {
      await tx.select({ id: users.id }).from(users).where(eq(users.id, user.id)).for("share");
      const [retired] = await tx
        .update(refreshTokens)
        .set({ rotatedAt: new Date() })
        .where(and(eq(refreshTokens.id, stored!.id), isNull(refreshTokens.rotatedAt)))
        .returning({ id: refreshTokens.id });
      if (!retired) return false;
      // Same family: this is the same sign-in continuing, and a fresh family
      // would put the successor beyond the reach of the revocation above.
      await storeRefreshToken(user.id, refreshTokenValue, req.headers.origin, outcome.familyId, tx);
      return true;
    });

    if (!rotated) {
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }
    pruneExpiredRefreshTokens(user.id);

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

    // The mobile app's routing gate reads this to decide whether a
    // parent/student may reach the tabs yet, on every boot and refresh — not
    // just right after signup — so it has to be answered here, not only at
    // login/register/google.
    const hasRosterLink =
      user.role === "student" || user.role === "parent"
        ? await hasLiveRosterLink(user.id)
        : undefined;

    res.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      preferredLanguage: user.preferredLanguage,
      avatarUrl: avatarUrlFor(user.avatarKey),
      emailVerified: user.emailVerified,
      // Which proof `DELETE /auth/users/me` will accept from this account: a
      // password, or — for a Google-only account, which has no hash to check
      // — its own email address retyped. Deliberately only here and not on the
      // six other places this object is serialised: the delete screen fetches
      // /me itself, so one site cannot drift out of step with the others.
      hasPassword: user.passwordHash !== null,
      // Whether this account signs back in with a personal login code — the
      // delete screen reads it to ask for that instead of a password.
      hasLoginCode: user.loginCodeHash !== null,
      // Whether this teacher has attested to their school's parental consent,
      // and which wording they saw. Null means the roster is read-only for
      // them until they do — the app reads this to show the statement rather
      // than waiting for a write to come back 403. Absent here would be read
      // as "not consented", which is the safe direction.
      rosterConsentAt: user.rosterConsentAt,
      rosterConsentVersion: user.rosterConsentVersion,
      // Grade/subject catalog ids picked at signup — see needsTeacherSetup in
      // the mobile app's routeGating.ts, the gate these two drive.
      gradeIds: user.gradeIds,
      subjectIds: user.subjectIds,
      teachingAssignments: user.teachingAssignments,
      createdAt: user.createdAt,
      lastLogin: user.lastLogin,
      ...(hasRosterLink === undefined ? {} : { hasRosterLink }),
    });
  } catch (err) {
    logger.error({ err }, "get profile failed");
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /auth/me/ai-usage — this month's AI spend against the caller's own
// allowance, so the limit is visible before it refuses something. limitUsd 0
// means no per-user cap is configured; spentUsd null means the ledger could
// not be read (unknown, not zero — same contract as the quota check).
router.get("/me/ai-usage", authMiddleware, async (req: AuthenticatedRequest, res) => {
  const start = currentPeriodStart();
  res.json({
    spentUsd: await readUserPeriodSpendUsd(req.user!.id),
    limitUsd: getUserBudgetLimitUsd(req.user!.role),
    resetsAt: new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1)).toISOString(),
  });
});

const VALID_GRADE_IDS = new Set(GRADES.map(g => g.id));
const VALID_SUBJECT_IDS = new Set(SUBJECTS.map(s => s.id));

// PATCH /users/profile
router.patch("/users/profile", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const { preferredLanguage, firstName, lastName, gradeIds, subjectIds, teachingAssignments } = req.body as {
      preferredLanguage?: string;
      firstName?: string;
      lastName?: string;
      /** Catalog ids from GRADES/SUBJECTS — see needsTeacherSetup in the mobile app. */
      gradeIds?: unknown;
      subjectIds?: unknown;
      /** Per-grade pairs from /setup-subjects. Takes priority over the flat ids below. */
      teachingAssignments?: unknown;
    };

    const updates: Record<string, unknown> = {};
    // Allow-listed: this string is stored verbatim and echoed on every
    // `/auth/me`, so it must not be free text.
    if (preferredLanguage !== undefined) {
      if (preferredLanguage !== "ar" && preferredLanguage !== "en") {
        res.status(400).json({ error: "preferredLanguage must be 'ar' or 'en'" });
        return;
      }
      updates.preferredLanguage = preferredLanguage;
    }
    if (typeof firstName === "string" && firstName.trim()) updates.firstName = firstName.trim();
    if (typeof lastName === "string" && lastName.trim()) updates.lastName = lastName.trim();

    const sanitizedAssignments = sanitizeTeachingAssignments(teachingAssignments, VALID_GRADE_IDS, VALID_SUBJECT_IDS);
    if (sanitizedAssignments) {
      // The current screen only ever sends this — gradeIds/subjectIds stay in
      // sync as their derived union so needsTeacherSetup and anything else
      // still reading the flat columns keep working unchanged.
      updates.teachingAssignments = sanitizedAssignments;
      updates.gradeIds = [...new Set(sanitizedAssignments.map(a => a.gradeId))];
      updates.subjectIds = [...new Set(sanitizedAssignments.flatMap(a => a.subjectIds))];
    } else {
      // Older client build sending the flat lists directly.
      const sanitizedGradeIds = sanitizeCatalogIds(gradeIds, VALID_GRADE_IDS);
      // A parent or student picks their class(es) here too (/setup-grade); a
      // student is in one, so the cap is applied by role rather than trusted.
      if (sanitizedGradeIds) updates.gradeIds = limitGradesForRole(req.user!.role, sanitizedGradeIds);
      const sanitizedSubjectIds = sanitizeCatalogIds(subjectIds, VALID_SUBJECT_IDS);
      if (sanitizedSubjectIds) updates.subjectIds = sanitizedSubjectIds;
    }

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
      avatarUrl: avatarUrlFor(updated.avatarKey),
      gradeIds: updated.gradeIds,
      subjectIds: updated.subjectIds,
      teachingAssignments: updated.teachingAssignments,
      createdAt: updated.createdAt,
    });
  } catch (err) {
    logger.error({ err }, "update profile failed");
    res.status(500).json({ error: "Failed to update profile" });
  }
});

function fail503Avatar(res: Parameters<Parameters<typeof router.post>[1]>[1]): void {
  res.status(503).json({
    code: "avatar_unavailable",
    error: "Profile pictures are not set up on this server yet.",
  });
}

// POST /users/avatar — set or replace the caller's own profile picture.
router.post("/users/avatar", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    if (!isPublicR2Configured()) {
      fail503Avatar(res);
      return;
    }

    const dataUrl = typeof req.body?.dataUrl === "string" ? req.body.dataUrl : "";
    if (dataUrl.length > MAX_AVATAR_DATA_URL_LENGTH) {
      res.status(413).json({
        error: "That photo is too large. Try a different one.",
        code: "file_too_large",
      });
      return;
    }
    const parsed = parseDataUrl(dataUrl);
    if (!parsed) {
      res.status(400).json({ error: "dataUrl must be a data: URL", code: "bad_data_url" });
      return;
    }
    const extension = extensionForAvatarMime(parsed.mime);
    if (!extension) {
      res.status(400).json({ error: `Unsupported image type: ${parsed.mime}`, code: "unsupported_type" });
      return;
    }

    const [existing] = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const key = newAvatarKey(extension);
    await putPublicObject(key, parsed.buffer, parsed.mime);

    const [updated] = await db
      .update(users)
      .set({ avatarKey: key })
      .where(eq(users.id, req.user!.id))
      .returning();

    // Old object is orphaned otherwise — deleted only after the new one is
    // safely written and recorded, so a mid-request failure never leaves a
    // user with no photo at all.
    // Best-effort: the new photo is already live, so a failed cleanup must not
    // turn into a 500 that tells the user their change didn't happen.
    if (existing.avatarKey && existing.avatarKey !== key) {
      await deletePublicObject(existing.avatarKey).catch(err =>
        logger.warn({ err, key: existing.avatarKey }, "old avatar delete failed"),
      );
    }

    res.json({ avatarUrl: avatarUrlFor(updated!.avatarKey) });
  } catch (err) {
    logger.error({ err }, "avatar upload failed");
    res.status(500).json({ error: "Failed to update profile picture" });
  }
});

// DELETE /users/avatar — revert the caller's own profile picture to initials.
router.delete("/users/avatar", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const [existing] = await db.select().from(users).where(eq(users.id, req.user!.id));
    if (!existing) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    // Unlink first, then delete best-effort — the other order can leave the
    // account pointing at an object that no longer exists.
    if (existing.avatarKey) {
      await db.update(users).set({ avatarKey: null }).where(eq(users.id, req.user!.id));
      await deletePublicObject(existing.avatarKey).catch(err =>
        logger.warn({ err, key: existing.avatarKey }, "avatar delete failed"),
      );
    }

    res.json({ avatarUrl: null });
  } catch (err) {
    logger.error({ err }, "avatar removal failed");
    res.status(500).json({ error: "Failed to remove profile picture" });
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
      // account signs in with Google again and sends the fresh ID token: it
      // used to retype its email, but the email sits in plain text inside every
      // access token, so that proved nothing a stolen token did not already hold.
      const { password, googleCredential } = req.body as {
        password?: unknown;
        googleCredential?: unknown;
      };
      if (account.passwordHash) {
        const ok = typeof password === "string" && password
          ? await bcrypt.compare(password, account.passwordHash)
          : false;
        if (!ok) {
          res.status(401).json({ error: "Password is incorrect", code: "password_incorrect" });
          return;
        }
      } else if (account.loginCodeHash && !account.googleId) {
        // A code-only account has no password and no Google identity; its login
        // code is the one secret it holds that a stolen access token does not.
        const given = hashLoginCode((req.body as { loginCode?: unknown }).loginCode);
        if (!given || given !== account.loginCodeHash) {
          res.status(401).json({ error: "Login code is incorrect", code: "login_code_incorrect" });
          return;
        }
      } else {
        let sub: string | undefined;
        if (typeof googleCredential === "string" && googleCredential && googleClient) {
          try {
            const ticket = await googleClient.verifyIdToken({
              idToken: googleCredential,
              audience: googleClientIdList,
            });
            sub = ticket.getPayload()?.sub;
          } catch (err) {
            logger.warn({ err: (err as Error).message }, "account deletion: Google re-auth token rejected");
          }
        }
        // The token must be for THIS account's Google identity, not any Google
        // account the caller can sign in to.
        if (!sub || !account.googleId || sub !== account.googleId) {
          res.status(401).json({ error: "Sign in with Google again to confirm", code: "google_reauth_required" });
          return;
        }
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

      // A teacher's exams cascade with the account, and so do the students'
      // read-aloud answers on them — whose recordings would otherwise stay in
      // R2 with nothing left pointing at them.
      const recordings = await audioKeysForTeacher(userId);

      await db.delete(users).where(eq(users.id, userId));

      // Deliberately after the row is gone: the deletion the user asked for is
      // the database one, and it must not fail because object storage is
      // unreachable. A failure here leaves an unreferenced blob behind —
      // logged at error level because nothing else will ever notice it.
      // ponytail: no retry queue. Add one if these lines actually appear.
      const keys = [
        ...media.map(m => m.key),
        ...attachments.map(a => a.key as string),
        ...recordings,
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
