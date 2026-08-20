/**
 * Investor-demo flag: when true, all AI generation/chat stays local.
 * No OpenAI calls, no API key required.
 *
 * Reads EXPO_PUBLIC_DEMO_MODE so a local test session can flip it via .env
 * without editing this file — set EXPO_PUBLIC_DEMO_MODE=false and restart the
 * dev server. Unset or any other value keeps the safe default (true). The
 * *shipped* default staying true is still a decision, not a config toggle —
 * see STATUS.md before changing the fallback below.
 */
export const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== "false";

/**
 * Refuse to substitute mock content when a live AI call fails.
 *
 * Off by default: a teacher mid-lesson is better served by a worksheet that
 * says it is sample content than by an error. Turn it on
 * (EXPO_PUBLIC_AI_STRICT_LIVE=true) while verifying that live generation is
 * actually wired up — a misconfigured key then fails loudly instead of
 * producing something that looks exactly like a real answer.
 *
 * No effect while DEMO_MODE is true; nothing is attempted to fail.
 */
export const STRICT_LIVE_AI = process.env.EXPO_PUBLIC_AI_STRICT_LIVE === "true";
