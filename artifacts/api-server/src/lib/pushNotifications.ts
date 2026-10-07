/**
 * Expo's push API is a single HTTPS POST — pulling in expo-server-sdk for
 * that would be a dependency for a fetch call. Fire-and-forget by design:
 * callers (routes/messaging.ts) never await this before responding, and a
 * failure here must never surface as a failed message send.
 *
 * Expo answers 200 OK with a per-message ticket even when an individual
 * token is dead — a non-2xx HTTP status only means the whole batch was
 * rejected. sendExpoPush parses those tickets and returns one ExpoPushResult
 * per input message (same order) so a caller can prune tokens Expo says are
 * gone (deadTokensFrom), instead of the ticket body being read and discarded.
 */
import { logger } from "./logger.ts";

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const CHUNK_SIZE = 100;

/**
 * The Android notification channel each kind of push goes to, so a user can
 * mute one kind in system settings without losing the others. The app
 * creates these (PUSH_CHANNELS in artifacts/mobile/services/pushPolicy.ts,
 * whose test reads this object — keep it a flat literal of string values).
 * An id the device has not created still arrives, in Android's catch-all
 * channel, so an older app version is not cut off.
 */
export const PUSH_CHANNEL = {
  messages: "messages",
  results: "results",
  admin: "admin",
} as const;

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  channelId?: (typeof PUSH_CHANNEL)[keyof typeof PUSH_CHANNEL];
  /**
   * The app-icon count to show: the recipient's unread messages. Only sent
   * when it is that number — a push about something else would otherwise
   * overwrite a correct count with an unrelated one.
   */
  badge?: number;
}

export interface ExpoPushResult {
  to: string;
  status: "ok" | "error";
  /** Expo's machine-readable error code, e.g. "DeviceNotRegistered". Only set on error. */
  error?: string;
}

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<ExpoPushResult[]> {
  const valid = messages.filter(m => m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken["));
  if (valid.length === 0) return [];

  const results: ExpoPushResult[] = [];
  for (let i = 0; i < valid.length; i += CHUNK_SIZE) {
    const chunk = valid.slice(i, i + CHUNK_SIZE);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(chunk),
      });
      if (!res.ok) {
        logger.error({ status: res.status, body: await res.text() }, "Expo push request failed");
        results.push(...chunk.map(m => ({ to: m.to, status: "error" as const })));
        continue;
      }

      const json = (await res.json()) as { data?: Array<{ status: "ok" | "error"; message?: string; details?: { error?: string } }> };
      const tickets = json.data ?? [];
      chunk.forEach((m, idx) => {
        const ticket = tickets[idx];
        if (!ticket || ticket.status === "error") {
          logger.error({ to: m.to, ticket }, "Expo push ticket error");
          results.push({ to: m.to, status: "error", error: ticket?.details?.error });
        } else {
          results.push({ to: m.to, status: "ok" });
        }
      });
    } catch (err) {
      logger.error({ err }, "Expo push request threw");
      results.push(...chunk.map(m => ({ to: m.to, status: "error" as const })));
    }
  }
  return results;
}

/** Tokens Expo has confirmed are gone — safe to delete from device_push_tokens. */
export function deadTokensFrom(results: ExpoPushResult[]): string[] {
  return results.filter(r => r.error === "DeviceNotRegistered").map(r => r.to);
}
