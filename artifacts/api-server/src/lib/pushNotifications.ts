/**
 * Expo's push API is a single HTTPS POST — pulling in expo-server-sdk for
 * that would be a dependency for a fetch call. Fire-and-forget by design:
 * callers (routes/messaging.ts) never await this before responding, and a
 * failure here must never surface as a failed message send.
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

export async function sendExpoPush(messages: ExpoPushMessage[]): Promise<void> {
  const valid = messages.filter(m => m.to.startsWith("ExponentPushToken[") || m.to.startsWith("ExpoPushToken["));
  if (valid.length === 0) return;

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
      }
    } catch (err) {
      logger.error({ err }, "Expo push request threw");
    }
  }
}
