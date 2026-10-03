/**
 * Pure helpers behind the admin dashboard routes (routes/admin.ts). Split out
 * because admin.ts imports `@workspace/db`, which throws at module scope
 * without DATABASE_URL, so nothing in it can be loaded by `node --test`.
 */
import { timingSafeEqual } from "node:crypto";

/** Numbers typed in by hand — see lib/db schema adminMetrics.ts for why manual. */
export const METRIC_KEYS = [
  "play_downloads",
  "instagram",
  "facebook",
  "youtube",
  "linkedin",
  "x",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Validate `{key, value, date}` from the dashboard form. `date` defaults to today (UTC). */
export function parseMetricInput(
  body: unknown,
  today = new Date().toISOString().slice(0, 10),
): { key: MetricKey; value: number; recordedOn: string } | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  if (!METRIC_KEYS.includes(b.key as MetricKey)) return { error: "Unknown metric" };
  const value = Number(b.value);
  if (!Number.isInteger(value) || value < 0 || value > 2_000_000_000) {
    return { error: "Value must be a whole number ≥ 0" };
  }
  const recordedOn = b.date === undefined || b.date === "" ? today : b.date;
  if (typeof recordedOn !== "string" || !DAY.test(recordedOn) || Number.isNaN(Date.parse(recordedOn))) {
    return { error: "Date must be YYYY-MM-DD" };
  }
  if (recordedOn > today) return { error: "Date cannot be in the future" };
  return { key: b.key as MetricKey, value, recordedOn };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clip = (v: unknown, n: number) => (typeof v === "string" ? v.trim().slice(0, n) : "");

/** Validate a site submission. Waitlist needs an email; contact needs a message. */
export function parseSiteSignup(body: unknown):
  | { kind: "waitlist" | "contact"; email: string; name: string; message: string; context: string }
  | { error: string } {
  const b = (body ?? {}) as Record<string, unknown>;
  const kind = b.kind;
  if (kind !== "waitlist" && kind !== "contact") return { error: "kind" };
  const email = clip(b.email, 200);
  const row = { kind: kind as "waitlist" | "contact", email, name: clip(b.name, 200), message: clip(b.message, 5000), context: clip(b.context, 500) };
  if (kind === "waitlist" && !EMAIL_RE.test(email)) return { error: "email" };
  if (kind === "contact" && row.message.length < 5) return { error: "message" };
  return row;
}

/** Constant-time check of the shared key the iqrra.com functions send. */
export function siteKeyMatches(expected: string | undefined, given: unknown): boolean {
  if (!expected || typeof given !== "string") return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * CSV for a spreadsheet. Cells starting with = + - @ are prefixed with ' so a
 * waitlist "email" like `=HYPERLINK(...)` opens as text, not a formula.
 */
export function toCsv(header: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let s = v instanceof Date ? v.toISOString() : String(v ?? "");
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header, ...rows].map(r => r.map(cell).join(",")).join("\r\n") + "\r\n";
}
