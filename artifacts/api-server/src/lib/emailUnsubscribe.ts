/**
 * The unsubscribe link every email we send carries (GET|POST /api/email/unsubscribe,
 * routes/emailPreferences.ts): the encrypted token, the URL, the footer and the
 * one-click headers. Pure on purpose, like siteMail.ts — the senders in email.ts
 * must stay loadable under `node --test`, which `@workspace/db` is not.
 *
 * The link is per ADDRESS, not per account. Many recipients have no account (a
 * parent asked to approve a child's sign-up, a waitlist visitor, a stranger
 * whose address someone typed into sign-up), and an address is what a mail
 * client's own «Unsubscribe» button speaks for.
 *
 * Two kinds of mail, and the footer says which:
 *   - `general` (app invite, parent-approval request, admin notices): the list
 *     stops them.
 *   - `security` (sign-up code, password-reset code, the "you use Google"
 *     notice): sent because someone just asked for them on this address, and
 *     sent even to an unsubscribed one — withholding them would lock a person
 *     out of their own account with nothing on screen saying why. The link is
 *     still there and still stops everything else; the footer says so rather
 *     than promise what the button does not do. Transactional mail of this kind
 *     is outside every opt-out rule we know of (CAN-SPAM, GDPR/ePrivacy).
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { apiPublicBase } from "./siteMail.ts";

export type EmailKind = "general" | "security";

/** Where a mail client's own unsubscribe goes when no link can be signed. */
export const UNSUBSCRIBE_MAILTO = "mailto:info@iqrra.com?subject=unsubscribe";

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The token IS the address, encrypted (AES-256-GCM under a key derived from
 * SESSION_SECRET). One opaque value instead of `?email=…&sig=…`, because the
 * link's query string lands in Cloud Run's request log and an address there
 * is personal data in a log nobody reviews for it. GCM's tag makes it
 * unforgeable: an altered or invented token decrypts to nothing.
 */
const key = (secret: string) => createHash("sha256").update(`email-unsubscribe:${secret}`).digest();

export function emailUnsubscribeToken(email: string, secret = process.env.SESSION_SECRET): string {
  if (!secret) throw new Error("SESSION_SECRET not set");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(secret), iv);
  const body = Buffer.concat([cipher.update(normalizeEmail(email), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), body]).toString("base64url");
}

/** The address a token was made for, or null for anything we did not make. */
export function readEmailUnsubscribeToken(token: unknown, secret = process.env.SESSION_SECRET): string | null {
  if (!secret || typeof token !== "string" || token.length > 600 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  const raw = Buffer.from(token, "base64url");
  if (raw.length <= 28) return null;
  try {
    const decipher = createDecipheriv("aes-256-gcm", key(secret), raw.subarray(0, 12));
    decipher.setAuthTag(raw.subarray(12, 28));
    const email = Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString("utf8");
    return email.includes("@") ? email : null;
  } catch {
    return null;
  }
}

/**
 * The link for this address, or null when nothing can make one (no
 * SESSION_SECRET — the API refuses to boot without one, so only a test or a
 * script). A mail still goes out then, with the mailto fallback.
 */
export function emailUnsubscribeUrl(email: string, secret = process.env.SESSION_SECRET): string | null {
  if (!secret) return null;
  return `${apiPublicBase()}/api/email/unsubscribe?t=${emailUnsubscribeToken(email, secret)}`;
}

export const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The footer line under every mail: why it came, and the link. */
export function unsubscribeFooterHtml(url: string | null, kind: EmailKind): string {
  const href = escapeHtml(url ?? UNSUBSCRIBE_MAILTO);
  const link = (label: string) => `<a href="${href}" style="color:#94A3B8;">${label}</a>`;
  const ar =
    kind === "security"
      ? `هذه رسالة أمان طُلبت لهذا البريد، فتصل حتى بعد إلغاء الاشتراك. لإيقاف سائر رسائل إقرأ: ${link("إلغاء الاشتراك")}`
      : `لا تريد رسائل من إقرأ على هذا البريد؟ ${link("إلغاء الاشتراك")}`;
  const en =
    kind === "security"
      ? `This is a security email requested for this address, so it is sent even after unsubscribing. To stop all other Iqrra email: ${link("Unsubscribe")}`
      : `Don't want emails from Iqrra at this address? ${link("Unsubscribe")}`;
  return `<div style="font-size:12px;color:#94A3B8;line-height:1.7;">
    <div dir="rtl">${ar}</div>
    <div dir="ltr">${en}</div>
    <div style="margin-top:6px;"><a href="https://www.iqrra.com" style="color:#94A3B8;text-decoration:none;">iqrra.com</a></div>
  </div>`;
}

/**
 * RFC 2369 / RFC 8058 headers, so Gmail's and Outlook's own «Unsubscribe»
 * button works. One-click needs an https URL that unsubscribes on POST, so the
 * `-Post` header is only set when there is one.
 */
/** The small page the link opens (also the waitlist's, routes/admin.ts). `body` is trusted HTML. */
export const unsubscribePage = (body: string) => `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>إقرأ · Iqrra</title>
<style>body{margin:0;padding:48px 20px;background:#F1F5F9;font-family:Tahoma,Arial,sans-serif;color:#0B1220;text-align:center}main{max-width:420px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:12px;padding:28px 20px;line-height:1.8}button{margin-top:12px;background:#006D65;color:#fff;border:0;border-radius:8px;padding:12px 24px;font:inherit;font-weight:bold;cursor:pointer}button.quiet{background:#fff;color:#006D65;border:1px solid #006D65}</style></head>
<body><main>${body}</main></body></html>`;


export function unsubscribeHeaders(url: string | null): Record<string, string> {
  if (!url) return { "List-Unsubscribe": `<${UNSUBSCRIBE_MAILTO}>` };
  return { "List-Unsubscribe": `<${url}>, <${UNSUBSCRIBE_MAILTO}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" };
}
