/**
 * The growth numbers the dashboard can fill in by itself, each switched on by
 * its own settings and silently absent without them (so deploying this changes
 * nothing until someone adds a key):
 *
 * - `youtube`        YOUTUBE_API_KEY                       — lib/youtubeSubscribers.ts
 * - `facebook`       META_ACCESS_TOKEN + META_PAGE_ID      — the Page's followers
 * - `instagram`      META_ACCESS_TOKEN + META_IG_USER_ID   — the account's followers
 * - `play_downloads` PLAY_STATS_BUCKET [+ PLAY_PACKAGE_NAME] — Play's own monthly install
 *                    reports, read with the Cloud Run runtime account's credentials
 *                    (no key: that account is invited in Play Console)
 *
 * Every fetch answers null instead of throwing, and none puts a secret in a
 * URL: the Meta token goes in an Authorization header, so an error that quotes
 * the request cannot leak it.
 */
import { fetchSubscriberCount } from "./youtubeSubscribers.ts";
import type { MetricKey } from "./adminMetrics.ts";

export type AutoMetric = { key: MetricKey; fetch: () => Promise<number | null> };

/** The Android package, `android.package` in artifacts/mobile/app.json. */
export const PLAY_PACKAGE = "com.iqra.teachingassistant";

const TIMEOUT_MS = 4000;
const GRAPH = "https://graph.facebook.com";
const STORAGE = "https://storage.googleapis.com/storage/v1/b";
const METADATA_TOKEN = "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

const count = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 ? n : null;
};

/** The first of `fields` that is a whole number ≥ 0 in a Graph API reply, else null (an error reply has none). */
export function parseGraphCount(body: unknown, fields: string[]): number | null {
  const obj = (body ?? {}) as Record<string, unknown>;
  for (const f of fields) {
    const n = count(obj[f]);
    if (n !== null) return n;
  }
  return null;
}

async function graphCount(id: string, fields: string[], token: string, fetchFn: typeof fetch): Promise<number | null> {
  const r = await fetchFn(`${GRAPH}/${encodeURIComponent(id)}?fields=${fields.join(",")}`, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  return r.ok ? parseGraphCount(await r.json(), fields) : null;
}

/** A Page's followers. `followers_count` first; `fan_count` (likes) is what older Pages report. Needs a Page access token. */
export const fetchFacebookFollowers = (token: string, pageId: string, fetchFn: typeof fetch = fetch) =>
  graphCount(pageId, ["followers_count", "fan_count"], token, fetchFn);

/** An Instagram professional account's followers, by its Instagram user id. */
export const fetchInstagramFollowers = (token: string, igUserId: string, fetchFn: typeof fetch = fetch) =>
  graphCount(igUserId, ["followers_count"], token, fetchFn);

/** Play writes these CSVs as UTF-16 with a byte-order mark; anything else is read as UTF-8. */
export function decodePlayCsv(bytes: Uint8Array): string {
  const utf16 = bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe;
  return new TextDecoder(utf16 ? "utf-16le" : "utf-8").decode(bytes).replace(/^﻿/, "");
}

const INSTALLS_COLUMN = "Daily User Installs";

/**
 * The sum of the «Daily User Installs» column of one monthly overview report,
 * or null when the file has no such column (Play renamed it, or this is not
 * the overview file). Summed across months this is the install count since the
 * reports began; a «total» column is not relied on because none is documented.
 */
export function parseInstallsCsv(text: string): number | null {
  const lines = text.split(/\r?\n/).filter(l => l.trim() !== "");
  const header = (lines[0] ?? "").split(",").map(h => h.trim().replace(/^"|"$/g, ""));
  const col = header.indexOf(INSTALLS_COLUMN);
  if (col < 0) return null;
  let sum = 0;
  for (const line of lines.slice(1)) {
    const n = Number((line.split(",")[col] ?? "").trim().replace(/^"|"$/g, ""));
    if (Number.isFinite(n) && n > 0) sum += n;
  }
  return Math.round(sum);
}

/** The Cloud Run runtime account's access token, from the metadata server; null anywhere else (a laptop). */
export async function metadataToken(fetchFn: typeof fetch = fetch): Promise<string | null> {
  try {
    const r = await fetchFn(METADATA_TOKEN, { headers: { "Metadata-Flavor": "Google" }, signal: AbortSignal.timeout(2000) });
    const body = r.ok ? ((await r.json()) as { access_token?: unknown }) : null;
    return typeof body?.access_token === "string" ? body.access_token : null;
  } catch {
    return null;
  }
}

/**
 * Install count since Play's reports began: every monthly `installs_<package>_YYYYMM_overview.csv`
 * in the developer's report bucket, summed. null when the account cannot read
 * the bucket, no report exists yet, or no file had the expected column.
 */
export async function fetchPlayInstalls(
  bucket: string,
  pkg: string,
  getToken: () => Promise<string | null> = metadataToken,
  fetchFn: typeof fetch = fetch,
): Promise<number | null> {
  const token = await getToken();
  if (!token) return null;
  const init = { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(TIMEOUT_MS) };
  const list = await fetchFn(
    `${STORAGE}/${encodeURIComponent(bucket)}/o?prefix=${encodeURIComponent(`stats/installs/installs_${pkg}_`)}&fields=items(name)`,
    init,
  );
  if (!list.ok) return null;
  const names = (((await list.json()) as { items?: { name?: string }[] }).items ?? [])
    .map(i => i.name ?? "")
    .filter(n => n.endsWith("_overview.csv"))
    .slice(0, 36); // three years of months is more than this app will have for a long time
  let total = 0;
  let read = 0;
  for (const name of names) {
    const file = await fetchFn(`${STORAGE}/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media`, init);
    if (!file.ok) continue;
    const n = parseInstallsCsv(decodePlayCsv(new Uint8Array(await file.arrayBuffer())));
    if (n !== null) {
      total += n;
      read++;
    }
  }
  return read > 0 ? total : null;
}

/** The numbers that have their settings, in a stable order. Nothing configured → []. */
export function configuredAutoMetrics(env: Record<string, string | undefined> = process.env, fetchFn: typeof fetch = fetch): AutoMetric[] {
  const out: AutoMetric[] = [];
  const { YOUTUBE_API_KEY: yt, META_ACCESS_TOKEN: meta, META_PAGE_ID: page, META_IG_USER_ID: ig, PLAY_STATS_BUCKET: bucket } = env;
  if (yt) out.push({ key: "youtube", fetch: () => fetchSubscriberCount(yt, fetchFn) });
  if (meta && page) out.push({ key: "facebook", fetch: () => fetchFacebookFollowers(meta, page, fetchFn) });
  if (meta && ig) out.push({ key: "instagram", fetch: () => fetchInstagramFollowers(meta, ig, fetchFn) });
  if (bucket) out.push({ key: "play_downloads", fetch: () => fetchPlayInstalls(bucket, env["PLAY_PACKAGE_NAME"] || PLAY_PACKAGE, () => metadataToken(fetchFn), fetchFn) });
  return out;
}
