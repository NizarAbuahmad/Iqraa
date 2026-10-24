/**
 * Parent-approval requests: queue one, mail it, look it up by the parent's link, decide it.
 *
 * `systemDb` on purpose (pinned in `systemDbFiles.test.ts`): the parent has no account, so the public route has no
 * identity, and sign-up and verification run before one exists. The table has no grant for the app role.
 *
 * One current request per student. A request is *queued* with no token (sign-up, before the student's own email is
 * verified), then *issued*: the token is generated, only its hash is stored, and the plaintext goes into the mail.
 */
import { systemDb as db, guardianConsents, users } from "@workspace/db";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendGuardianConsentEmail } from "./email.js";
import { guardianApprovalEnabled } from "./features.js";
import {
  CONSENT_TTL_MS,
  DAY_MS,
  generateConsentToken,
  hashConsentToken,
  looksLikeConsentToken,
} from "./guardianConsent.ts";

/** The app's web origin: the mail links to `{base}/guardian/{token}`. */
function linkBase(): string {
  return (process.env.GUARDIAN_LINK_BASE ?? "https://app.iqrra.com").replace(/\/+$/, "");
}

export async function countForParent(parentEmail: string, now: Date = new Date()): Promise<number> {
  const since = new Date(now.getTime() - DAY_MS);
  const [row] = await db
    .select({ n: count() })
    .from(guardianConsents)
    .where(and(eq(guardianConsents.parentEmail, parentEmail), gt(guardianConsents.createdAt, since)));
  return Number(row?.n ?? 0);
}

export async function recentCounts(
  userId: string,
  parentEmail: string,
  now: Date = new Date(),
): Promise<{ forStudent: number; forParent: number }> {
  const since = new Date(now.getTime() - DAY_MS);
  const [s] = await db
    .select({ n: count() })
    .from(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), gt(guardianConsents.createdAt, since)));
  return { forStudent: Number(s?.n ?? 0), forParent: await countForParent(parentEmail, now) };
}

/** Supersedes the student's open request and queues a new one with no token. Returns the new row's id. */
export async function queueRequest(userId: string, parentEmail: string): Promise<string> {
  return db.transaction(async tx => {
    await tx
      .update(guardianConsents)
      .set({ supersededAt: new Date() })
      .where(
        and(
          eq(guardianConsents.userId, userId),
          isNull(guardianConsents.decidedAt),
          isNull(guardianConsents.supersededAt),
        ),
      );
    const [row] = await tx
      .insert(guardianConsents)
      .values({ userId, parentEmail })
      .returning({ id: guardianConsents.id });
    return row!.id;
  });
}

/** The newest request that has not been superseded (declined ones included). */
export async function currentRequest(userId: string): Promise<typeof guardianConsents.$inferSelect | null> {
  const [row] = await db
    .select()
    .from(guardianConsents)
    .where(and(eq(guardianConsents.userId, userId), isNull(guardianConsents.supersededAt)))
    .orderBy(desc(guardianConsents.createdAt))
    .limit(1);
  return row ?? null;
}

export type IssueResult =
  | { ok: true; emailSent: boolean; expiresAt: Date; parentEmail: string }
  | { ok: false; reason: "no_request" | "already_issued" };

/**
 * Generates the token for the current queued request, stores its hash and seven-day expiry, and mails the link.
 * `sent_at` is stamped only when the provider accepted the mail, so a failed send can be resent.
 */
export async function issueAndSend(userId: string): Promise<IssueResult> {
  const cur = await currentRequest(userId);
  if (!cur || cur.decidedAt) return { ok: false, reason: "no_request" };
  if (cur.tokenHash) return { ok: false, reason: "already_issued" };

  const token = generateConsentToken();
  const expiresAt = new Date(Date.now() + CONSENT_TTL_MS);
  // Conditional on the token still being null, so two concurrent issues cannot both mail a link.
  const [claimed] = await db
    .update(guardianConsents)
    .set({ tokenHash: hashConsentToken(token), expiresAt })
    .where(and(eq(guardianConsents.id, cur.id), isNull(guardianConsents.tokenHash)))
    .returning({ id: guardianConsents.id });
  if (!claimed) return { ok: false, reason: "already_issued" };

  const [kid] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, userId)).limit(1);
  const emailSent = await sendGuardianConsentEmail(cur.parentEmail, kid?.firstName ?? "", `${linkBase()}/guardian/${token}`);
  if (emailSent) {
    await db.update(guardianConsents).set({ sentAt: new Date() }).where(eq(guardianConsents.id, cur.id));
  }
  return { ok: true, emailSent, expiresAt, parentEmail: cur.parentEmail };
}

/**
 * Issues the request a sign-up queued, now that the student's own email is verified. Does nothing with the flag
 * off or when there is nothing queued, and never throws: the verification that called it has already succeeded.
 */
export async function sendQueuedGuardianRequest(userId: string): Promise<void> {
  if (!guardianApprovalEnabled()) return;
  try {
    const cur = await currentRequest(userId);
    if (cur && !cur.decidedAt && !cur.tokenHash) await issueAndSend(userId);
  } catch (err) {
    logger.error({ err, userId }, "could not send the queued guardian request");
  }
}

export type TokenView =
  | { status: "open"; childFirstName: string }
  | { status: "expired" | "decided" | "invalid" };

/** What the parent's page shows for a token: the child's first name when open, otherwise only why not. */
export async function lookupByToken(token: unknown, now: Date = new Date()): Promise<TokenView> {
  if (!looksLikeConsentToken(token)) return { status: "invalid" };
  const [row] = await db
    .select({
      decidedAt: guardianConsents.decidedAt,
      supersededAt: guardianConsents.supersededAt,
      expiresAt: guardianConsents.expiresAt,
      firstName: users.firstName,
    })
    .from(guardianConsents)
    .innerJoin(users, eq(users.id, guardianConsents.userId))
    .where(eq(guardianConsents.tokenHash, hashConsentToken(token)))
    .limit(1);
  if (!row || row.supersededAt) return { status: "invalid" };
  if (row.decidedAt) return { status: "decided" };
  if (!row.expiresAt || row.expiresAt <= now) return { status: "expired" };
  return { status: "open", childFirstName: row.firstName };
}

/**
 * Records the parent's decision. One conditional update, so a token works once and two clicks cannot both win;
 * approving sets `users.guardian_approved_at` in the same transaction.
 */
export async function decideByToken(
  token: unknown,
  decision: "approved" | "declined",
  now: Date = new Date(),
): Promise<"ok" | "unusable"> {
  if (!looksLikeConsentToken(token)) return "unusable";
  return db.transaction(async tx => {
    const [row] = await tx
      .update(guardianConsents)
      .set({ decision, decidedAt: now })
      .where(
        and(
          eq(guardianConsents.tokenHash, hashConsentToken(token)),
          isNull(guardianConsents.decidedAt),
          isNull(guardianConsents.supersededAt),
          gt(guardianConsents.expiresAt, now),
        ),
      )
      .returning({ userId: guardianConsents.userId });
    if (!row) return "unusable";
    if (decision === "approved") {
      await tx.update(users).set({ guardianApprovedAt: now }).where(eq(users.id, row.userId));
    }
    return "ok";
  });
}

/**
 * `sendQueuedGuardianRequest`, but the caller waits at most `ms` for it (Cloud Run throttles CPU once a response
 * has gone out, so work is awaited rather than left running; see `pushWithin.ts`). Past the cap the caller carries
 * on and the send finishes in the background. Never throws, and the timer is always cleared.
 */
export async function sendQueuedGuardianRequestWithin(userId: string, ms: number = 4_000): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const capped = new Promise<"capped">(resolve => {
    timer = setTimeout(() => resolve("capped"), ms);
  });
  // `sendQueuedGuardianRequest` already swallows its own errors; the catch is for anything it could not foresee.
  const running = sendQueuedGuardianRequest(userId).then(
    () => "done" as const,
    err => {
      logger.error({ err, userId }, "could not send the queued guardian request");
      return "failed" as const;
    },
  );
  const outcome = await Promise.race([running, capped]);
  clearTimeout(timer);
  if (outcome === "capped") logger.warn({ userId, ms }, "guardian request still sending when the response went out");
}

/**
 * Retires the student's open request (queued, unissued or issued, not yet decided) so no link out there can approve
 * them and `/me` goes back to "needed". For a path that proves the address WITHOUT the sign-up having been the
 * student's own: a row someone else pre-created on this address chose the parent's address too, and must not get to
 * mail it (`lib/googleLink.ts`).
 */
export async function supersedeOpenRequests(userId: string): Promise<number> {
  const rows = await db
    .update(guardianConsents)
    .set({ supersededAt: new Date() })
    .where(
      and(
        eq(guardianConsents.userId, userId),
        isNull(guardianConsents.decidedAt),
        isNull(guardianConsents.supersededAt),
      ),
    )
    .returning({ id: guardianConsents.id });
  return rows.length;
}
