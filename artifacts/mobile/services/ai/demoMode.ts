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
