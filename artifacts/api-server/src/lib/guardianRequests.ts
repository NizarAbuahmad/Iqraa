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
import { and, count, desc, eq, gt, isNull, sql } from "drizzle-orm";
import { logger } from "./logger.js";
import { sendGuardianConsentEmail } from "./email.js";
import { guardianApprovalEnabled } from "./features.js";
import {
  CONSENT_TTL_MS,
  DAY_MS,
  GUARDIAN_LIMITS,
  generateConsentToken,
  hashConsentToken,
  limitReached,
  looksLikeConsentToken,
} from "./guardianConsent.ts";

/**
 * The app's web origin: the mail links to `{base}/guardian#{token}`. The token is in the URL fragment, which a browser
 * never sends to a server, so it reaches no request log; the parent's page posts it in a body.
 */
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

export type QueueResult = { ok: true; id: string } | { ok: false; reason: "student_limit" | "parent_limit" };

/**
 * Supersedes the student's open request and queues a new one with no token, unless a daily cap is already reached.
 *
 * One transaction that first takes a transaction-scoped advisory lock on the student and then on the parent address,
 * always in that order, so two requests can never wait on each other. With both held it counts the rows of the last
 * 24 hours again (same window as `recentCounts`), so concurrent requests cannot all pass a check made before any of
 * them wrote: the table never exceeds `GUARDIAN_LIMITS`. A request over a cap writes nothing.
 */
export async function queueRequest(userId: string, parentEmail: string, now: Date = new Date()): Promise<QueueResult> {
  return db.transaction(async tx => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"guardian-user:" + userId}))`);
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${"guardian-parent:" + parentEmail}))`);

    const since = new Date(now.getTime() - DAY_MS);
    const [s] = await tx
      .select({ n: count() })
      .from(guardianConsents)
      .where(and(eq(guardianConsents.userId, userId), gt(guardianConsents.createdAt, since)));
    if (limitReached(Number(s?.n ?? 0), GUARDIAN_LIMITS.perStudentPerDay)) return { ok: false, reason: "student_limit" } as const;
    const [p] = await tx
      .select({ n: count() })
      .from(guardianConsents)
      .where(and(eq(guardianConsents.parentEmail, parentEmail), gt(guardianConsents.createdAt, since)));
    if (limitReached(Number(p?.n ?? 0), GUARDIAN_LIMITS.perParentPerDay)) return { ok: false, reason: "parent_limit" } as const;

    await tx
      .update(guardianConsents)
      .set({ supersededAt: now })
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
    return { ok: true, id: row!.id } as const;
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
 * Generates the token for one queued request (the id `queueRequest` returned), stores its hash and seven-day expiry,
 * and mails the link. It issues that row and no other: a request superseded or decided since is `no_request`.
 * `sent_at` is stamped only when the provider accepted the mail. The token's hash is stored before the mail goes, so
 * a failed send cannot be retried on the same row (a second call answers `already_issued`); recovery is a fresh
 * request, which supersedes this one and mails a new link.
 */
export async function issueAndSend(requestId: string): Promise<IssueResult> {
  const [cur] = await db.select().from(guardianConsents).where(eq(guardianConsents.id, requestId)).limit(1);
  if (!cur || cur.decidedAt || cur.supersededAt) return { ok: false, reason: "no_request" };
  if (cur.tokenHash) return { ok: false, reason: "already_issued" };

  const token = generateConsentToken();
  const expiresAt = new Date(Date.now() + CONSENT_TTL_MS);
  // One conditional update: still tokenless, still current. Two concurrent issues cannot both mail a link, and a
  // request superseded since the read above is not issued.
  const [claimed] = await db
    .update(guardianConsents)
    .set({ tokenHash: hashConsentToken(token), expiresAt })
    .where(
      and(
        eq(guardianConsents.id, cur.id),
        isNull(guardianConsents.tokenHash),
        isNull(guardianConsents.supersededAt),
        isNull(guardianConsents.decidedAt),
      ),
    )
    .returning({ id: guardianConsents.id });
  if (!claimed) return { ok: false, reason: "already_issued" };

  const [kid] = await db.select({ firstName: users.firstName }).from(users).where(eq(users.id, cur.userId)).limit(1);
  const emailSent = await sendGuardianConsentEmail(cur.parentEmail, kid?.firstName ?? "", `${linkBase()}/guardian#${token}`);
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
    if (cur && !cur.decidedAt && !cur.tokenHash) await issueAndSend(cur.id);
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
