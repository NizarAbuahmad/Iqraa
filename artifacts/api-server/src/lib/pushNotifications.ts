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

export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
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
