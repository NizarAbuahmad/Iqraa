/**
 * Decides whether THIS caller sends an admin alert, so an outage is one mail
 * and not one per failed request.
 *
 * The count is shared across Cloud Run instances through `rate_limit_buckets`
 * (the same upsert the API's rate limiter uses — no new table, no migration):
 * the first hit in a window sees count 1 and sends, every later hit does not.
 * This process also remembers its own answer until the window ends, so a long
 * outage costs one database round trip per window per instance rather than one
 * per failed request.
 *
 * If the store cannot be read (the database being down is a likely companion of
 * an incident) it falls back to the in-process memory alone: at most one alert
 * per key per window PER INSTANCE. That can repeat across instances, never loop.
 *
 * Never throws. No database import at module scope — see rateLimitStore.ts.
 */
import { pgRateLimitStore, type RateLimitStore } from "./rateLimitStore.ts";
import { logger } from "./logger.ts";

/** key -> epoch ms until which this process will not try to send it again. */
const quietUntil = new Map<string, number>();

export type ClaimDeps = {
  store?: Pick<RateLimitStore, "hit">;
  now?: () => number;
};

export async function claimAlert(key: string, windowMs: number, deps: ClaimDeps = {}): Promise<boolean> {
  const store = deps.store ?? pgRateLimitStore;
  const now = (deps.now ?? Date.now)();
  const until = quietUntil.get(key);
  if (until !== undefined && until > now) return false;
  // Marked BEFORE the await: twenty failures landing together are one claim.
  quietUntil.set(key, now + windowMs);
  try {
    const hit = await store.hit(`admin-alert:${key}`, windowMs);
    if (hit.count === 1) return true;
    // Someone else (another instance) sent it; stay quiet until their window ends.
    const resetMs = hit.resetAt.getTime();
    if (Number.isFinite(resetMs)) quietUntil.set(key, Math.max(now, resetMs));
    return false;
  } catch (err) {
    logger.warn({ err, key }, "admin alert dedupe store unavailable — limiting per instance");
    return true;
  }
}

export function resetAlertGateForTests(): void {
  quietUntil.clear();
}
