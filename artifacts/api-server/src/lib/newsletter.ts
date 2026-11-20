/**
 * The rules behind the teacher newsletter (routes/adminNewsletter.ts; spec
 * docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md): who receives
 * an issue, and when a send is allowed. Pure on purpose, like siteMail.ts — the
 * route imports `@workspace/db`, which cannot load under `node --test`.
 *
 * The approval rule lives here: an issue goes out only if the exact subject and
 * body were sent to the admin as a test less than 24 hours ago. The route stores
 * a hash at test time and asks `sendDecision` at send time.
 */
import { createHash } from "node:crypto";
import type { BroadcastFooter } from "./email.ts";
import { isValidEmailAddress } from "./emailAddress.ts";
import { emailUnsubscribeUrl } from "./emailUnsubscribe.ts";
import { BODY_MAX, SUBJECT_MAX } from "./siteMail.ts";

/** Teacher accounts. A system admin is the sender, and gets the test copy instead. */
export const NEWSLETTER_ROLES = ["teacher", "school_admin"] as const;

export const TEST_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export const TEACHER_FOOTER: BroadcastFooter = {
  ar: "تصلك هذه الرسالة لأن لديك حساب معلّم في إقرأ.",
  en: "You received this because you have a teacher account on Iqrra.",
};

export type TeacherRow = {
  id: string;
  email: string | null;
  role: string;
  emailVerified: boolean;
  suspendedAt: Date | null;
};

/** One recipient per address: a verified, unsuspended teacher account with a usable address. */
export function pickTeacherRecipients(rows: readonly TeacherRow[]): { id: string; email: string }[] {
  const seen = new Set<string>();
  const out: { id: string; email: string }[] = [];
  for (const r of rows) {
    if (!(NEWSLETTER_ROLES as readonly string[]).includes(r.role)) continue;
    if (!r.emailVerified || r.suspendedAt) continue;
    const email = (r.email ?? "").trim();
    if (!isValidEmailAddress(email)) continue;
    const key = email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ id: r.id, email });
  }
  return out;
}

/** JSON of the pair, so "ab"+"c" and "a"+"bc" cannot collide. */
export function newsletterHash(subject: string, text: string): string {
  return createHash("sha256").update(JSON.stringify([subject, text])).digest("hex");
}

/** `{subject, body}` from the admin screen, trimmed. Same limits as the waitlist mail. */
export function parseNewsletter(body: unknown): { subject: string; text: string } | { error: "subject" | "body" } {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  const subject = typeof b.subject === "string" ? b.subject.trim() : "";
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (subject.length < 3 || subject.length > SUBJECT_MAX) return { error: "subject" };
  if (text.length < 10 || text.length > BODY_MAX) return { error: "body" };
  return { subject, text };
}

export type SendDecision = "ok" | "not-tested" | "test-expired";

export function sendDecision(
  issue: { contentHash: string; testedAt: Date } | null | undefined,
  subject: string,
  text: string,
  now: Date = new Date(),
): SendDecision {
  if (!issue || issue.contentHash !== newsletterHash(subject, text)) return "not-tested";
  if (now.getTime() - issue.testedAt.getTime() > TEST_MAX_AGE_MS) return "test-expired";
  return "ok";
}

/** The per-address link (lib/emailUnsubscribe.ts). The API refuses to boot without SESSION_SECRET, so null is a bug. */
export function teacherUnsubscribeUrl(r: { email: string }): string {
  const url = emailUnsubscribeUrl(r.email);
  if (!url) throw new Error("SESSION_SECRET not set — cannot sign an unsubscribe link");
  return url;
}
