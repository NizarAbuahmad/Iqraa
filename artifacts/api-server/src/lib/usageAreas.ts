/**
 * The closed list of app areas the time-spent heartbeat may name (`POST /usage/heartbeat`,
 * table `usage_minutes`). The app maps its route to one of these in
 * `artifacts/mobile/services/usageAreas.ts`, which must hold the same list — its test reads
 * this file and compares. An area is coarse on purpose: no path, id or query ever reaches the
 * server, only which part of the app the person was in.
 *
 * Append new areas; never rename one that has shipped, or its history splits in two.
 * Pure — no database import — so `node --test` can load it.
 */

export const USAGE_AREAS = [
  "today",
  "tools",
  "gen-quiz",
  "gen-worksheet",
  "gen-lesson-plan",
  "gen-activity",
  "gen-slides",
  "gen-other",
  "classroom",
  "chat",
  "curriculum",
  "corner-math",
  "corner-lab",
  "corner-quran",
  "corner-english",
  "play",
  "classes",
  "evaluations",
  "homework",
  "schedule",
  "teaching-plans",
  "workspace",
  "messaging",
  "school",
  "notifications",
  "profile",
  "admin",
  "other",
] as const;

export type UsageArea = (typeof USAGE_AREAS)[number];

const KNOWN = new Set<string>(USAGE_AREAS);

/** A known area as is; anything else — a path, an old client's name, junk — is `other`. */
export function normalizeArea(raw: unknown): UsageArea {
  return typeof raw === "string" && KNOWN.has(raw) ? (raw as UsageArea) : "other";
}

const PLATFORMS = new Set(["android", "ios", "web"]);

/** The X-Iqraa-Platform value the app sends, or `unknown`. */
export function normalizePlatform(raw: string | null | undefined): string {
  return raw && PLATFORMS.has(raw) ? raw : "unknown";
}

/**
 * The server counts at most one minute per this many seconds per row, whatever the client
 * sends. The app beats every 60 s; 50 leaves room for timer drift without letting a looping
 * client inflate the numbers.
 */
export const HEARTBEAT_MIN_GAP_SECONDS = 50;
