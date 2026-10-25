/**
 * The rules behind the admin «راسل قائمة الانتظار» screen (POST /admin/broadcasts
 * and GET|POST /site/unsubscribe in routes/admin.ts): who a message may go to,
 * the unsubscribe token, and turning the admin's plain text into an email body.
 * Pure on purpose — admin.ts imports `@workspace/db`, which can't load under
 * `node --test`, so everything worth asserting lives here.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { UUID } from "./adminMetrics.ts";
import { isValidEmailAddress } from "./emailAddress.ts";

/**
 * What a waitlist address agreed to. The iqrra.com form has promised «دعوة
 * التجربة وإشعار الإطلاق فقط», so `invite` and `launch` may reach everyone who
 * signed up, but general app news (`update`) may only reach people who signed
 * up after the form said so.
 *
 * `UPDATES_CONSENT_FROM` is that moment. It stays `null` until the reworded
 * form (Site_Iqra index.html + privacy.html) is live, and while it is null
 * `update` matches nobody — fail closed, not "everyone". Set it to the deploy
 * time of the site change, in the same PR or straight after.
 */
export const BROADCAST_PURPOSES = ["invite", "launch", "update"] as const;
export type BroadcastPurpose = (typeof BROADCAST_PURPOSES)[number];
export const UPDATES_CONSENT_FROM: Date | null = null;

/**
 * A retry after a half-failed send, or a double tap, must not mail the same
 * people twice — `launch` and `update` would otherwise match everyone again.
 * Anyone messaged inside this window is held back.
 */
export const RECENTLY_MESSAGED_MS = 12 * 60 * 60 * 1000;

export type SignupRow = {
  id: string;
  kind: string;
  email: string;
  createdAt: Date;
  invitedAt: Date | null;
  lastMessagedAt: Date | null;
  unsubscribedAt: Date | null;
};
export type Recipient = { id: string; email: string };

/**
 * Waitlist rows → one recipient per address. Several rows can share an address
 * (people sign up twice), so the decision is made per address: unsubscribed or
 * invited on *any* row counts for all of them, and a later signup is what
 * carries consent for `update`. `id` is the newest row, the one the
 * unsubscribe link points at.
 */
export function pickRecipients(
  rows: readonly SignupRow[],
  purpose: BroadcastPurpose,
  opts: { now?: Date; consentFrom?: Date | null; ignoreRecent?: boolean } = {},
): Recipient[] {
  const consentFrom = opts.consentFrom === undefined ? UPDATES_CONSENT_FROM : opts.consentFrom;
  if (purpose === "update" && !consentFrom) return [];
  const recent = (opts.now ?? new Date()).getTime() - RECENTLY_MESSAGED_MS;

  type Group = Recipient & { newest: Date; invited: boolean; unsub: boolean; consented: boolean; recent: boolean };
  const groups = new Map<string, Group>();
  for (const r of rows) {
    if (r.kind !== "waitlist") continue;
    const email = r.email.trim();
    if (!isValidEmailAddress(email)) continue;
    const key = email.toLowerCase();
    const g = groups.get(key) ?? { id: r.id, email, newest: r.createdAt, invited: false, unsub: false, consented: false, recent: false };
    if (r.createdAt > g.newest) {
      g.id = r.id;
      g.newest = r.createdAt;
    }
    g.invited ||= !!r.invitedAt;
    g.unsub ||= !!r.unsubscribedAt;
    g.consented ||= !!consentFrom && r.createdAt >= consentFrom;
    g.recent ||= !!r.lastMessagedAt && r.lastMessagedAt.getTime() > recent;
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter(g => !g.unsub)
    .filter(g => (purpose === "invite" ? !g.invited : true))
    .filter(g => (purpose === "update" ? g.consented : true))
    .filter(g => opts.ignoreRecent || !g.recent)
    .map(({ id, email }) => ({ id, email }));
}

const SUBJECT_MAX = 150;
const BODY_MAX = 10_000;

/**
 * `{purpose, subject?, body?, dryRun?, testOnly?}` from the admin form. `invite`
 * is a fixed template, so it takes no text; the other two need a subject and a
 * body, except for a dry run, which only counts.
 */
export function parseBroadcast(body: unknown):
  | { purpose: BroadcastPurpose; subject: string; text: string; dryRun: boolean; testOnly: boolean }
  | { error: string } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const purpose = BROADCAST_PURPOSES.find(p => p === b.purpose);
  if (!purpose) return { error: "purpose" };
  const dryRun = b.dryRun === true;
  const testOnly = b.testOnly === true;
  if (purpose === "invite" || dryRun) return { purpose, subject: "", text: "", dryRun, testOnly };
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (subject.length < 3 || subject.length > SUBJECT_MAX) return { error: "subject" };
  if (text.length < 10 || text.length > BODY_MAX) return { error: "body" };
  return { purpose, subject, text, dryRun, testOnly };
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * The admin's text as email HTML. Everything is escaped; the only markup that
 * comes back is paragraphs, line breaks and links for bare http(s) URLs, so a
 * pasted `<script>` or a `javascript:` link is inert text. A blank line starts
 * a new paragraph. Direction follows the language: any Arabic letter → RTL.
 */
export function renderBroadcastBody(text: string): string {
  const link = (part: string) => {
    const tail = /[.,;:!?)\]،؛]+$/.exec(part)?.[0] ?? "";
    const url = tail ? part.slice(0, -tail.length) : part;
    return `<a href="${esc(url)}" style="color:#006D65;">${esc(url)}</a>${esc(tail)}`;
  };
  const inline = (line: string) =>
    line
      .split(/(https?:\/\/[^\s<>"'«»]+)/g)
      .map((part, i) => (i % 2 === 1 ? link(part) : esc(part)))
      .join("");
  const paragraphs = text
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean)
    .map(p => `<p style="margin:0 0 14px;">${p.split("\n").map(inline).join("<br />")}</p>`)
    .join("");
  const dir = /[؀-ۿ]/.test(text) ? "rtl" : "ltr";
  return `<div dir="${dir}" style="font-family:Tahoma,Arial,sans-serif;font-size:15px;color:#0B1220;line-height:1.7;">${paragraphs}</div>`;
}

/** HMAC of the signup id, so an unsubscribe link can't be forged for someone else's row. */
export function signUnsubscribe(id: string, secret = process.env.SESSION_SECRET): string {
  if (!secret) throw new Error("SESSION_SECRET not set");
  return createHmac("sha256", secret).update(`unsub:${id}`).digest("hex");
}

export function verifyUnsubscribe(id: unknown, token: unknown, secret = process.env.SESSION_SECRET): boolean {
  if (!secret || typeof id !== "string" || typeof token !== "string" || !UUID.test(id)) return false;
  const expected = Buffer.from(signUnsubscribe(id, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

// The API's own origin, like Site_Iqra's IQRAA_API_URL: the link has to resolve
// from an inbox, and the Cloud Run URL is the one place this route lives.
const DEFAULT_API_PUBLIC_URL = "https://iqraa-api-613126375862.europe-west1.run.app";

export function unsubscribeUrl(id: string): string {
  const base = (process.env.API_PUBLIC_URL || DEFAULT_API_PUBLIC_URL).replace(/\/+$/, "");
  return `${base}/api/site/unsubscribe?id=${id}&t=${signUnsubscribe(id)}`;
}
