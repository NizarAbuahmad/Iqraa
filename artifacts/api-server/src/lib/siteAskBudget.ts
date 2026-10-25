/**
 * The public bot's own daily spend ceiling.
 *
 * A visitor costs real money and has no account, so a flood of them needs a
 * ceiling of its own: SITE_BOT_BUDGET_USD_DAILY, default 1, and 0 switches the
 * bot off. This bounds what visitors can add per day; it does not exclude the
 * bot's spend from AI_BUDGET_USD. recordUsage adds every answer to the same
 * month-to-date total the teachers' budget check reads, so at the default the
 * bot can use up to about $30 of a month. Size AI_BUDGET_USD above the teachers'
 * own use plus that, or lower the cap.
 *
 * The total is a sum over ai_generations for kind = 'site-ask' in the last 24
 * hours, read from the database, not an in-process counter: the API runs up to
 * 20 Cloud Run instances, and a counter per instance would allow 20 times the
 * cap. It is cached for a minute, so the cap can be overshot by about a minute of
 * traffic — bounded by the route's rate limits, and a few cents at most.
 *
 * Unknown is closed. If the total cannot be read the gate refuses, because the
 * bot is the least important thing the API does and "I could not check" must
 * never read as "nothing spent". (Teachers' guards fail the other way for the
 * opposite reason: there a refusal costs somebody their work.)
 *
 * `@workspace/db` is imported lazily, for the reason given at the top of
 * lib/aiUsageLog.ts: it throws at module scope without DATABASE_URL.
 */
import { logger } from "./logger.ts";

export const SITE_ASK_KIND = "site-ask";
export const SITE_ASK_DEFAULT_DAILY_CAP_USD = 1;
export const SITE_ASK_SPEND_TTL_MS = 60_000;

export function getSiteAskDailyCapUsd(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return SITE_ASK_DEFAULT_DAILY_CAP_USD;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : SITE_ASK_DEFAULT_DAILY_CAP_USD;
}

/** Null — not 0 — when it cannot be read. */
export async function readSiteAskSpendLast24hUsd(now: Date = new Date()): Promise<number | null> {
  try {
    const { db, aiGenerations } = await import("@workspace/db");
    const { and, eq, gte, sql } = await import("drizzle-orm");
    const since = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await db
      .select({ total: sql<string>`coalesce(sum(${aiGenerations.costUsd}), 0)` })
      .from(aiGenerations)
      .where(and(eq(aiGenerations.kind, SITE_ASK_KIND), gte(aiGenerations.createdAt, since)));
    const total = Number(rows[0]?.total ?? 0);
    return Number.isFinite(total) ? total : null;
  } catch (err) {
    logger.warn({ err }, "site-ask: spend could not be read — the bot answers with the fixed message");
    return null;
  }
}

export function createSiteAskSpendGate(opts: {
  read: () => Promise<number | null>;
  capUsd: () => number;
  now?: () => number;
  ttlMs?: number;
}): { isOpen(): Promise<boolean> } {
  const now = opts.now ?? Date.now;
  const ttl = opts.ttlMs ?? SITE_ASK_SPEND_TTL_MS;
  let last: { spent: number | null; at: number } | null = null;

  return {
    async isOpen() {
      const cap = opts.capUsd();
      if (cap <= 0) return false;
      if (!last || now() - last.at >= ttl) {
        last = { spent: await opts.read(), at: now() };
      }
      return last.spent !== null && last.spent < cap;
    },
  };
}
