// artifacts/api-server/src/lib/emailSuppression.ts
// Acts without (or beyond) the caller's identity — see lib/db/src/scopedPool.ts.
import { systemDb as db, emailSuppressions } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";
import { setSuppressionCheck } from "./email.ts";
import { normalizeEmail } from "./emailUnsubscribe.ts";

/**
 * The unsubscribe list (`email_suppressions`) behind the link in every mail.
 * The table has no app-role grant, so this file is on the systemDb list
 * (systemDbFiles.test.ts): the link has no user, and the senders read it on
 * behalf of whoever caused the mail — a child's sign-up mails their parent.
 *
 * Importing this file registers the check with email.ts. routes/emailPreferences.ts
 * imports it, and routes/index.ts mounts that router, so a running server always
 * has it; one without it refuses `general` mail in production (email.ts).
 */
export async function suppressedAmong(emails: readonly string[]): Promise<ReadonlySet<string>> {
  const wanted = [...new Set(emails.map(normalizeEmail))].filter(Boolean);
  if (wanted.length === 0) return new Set();
  const rows = await db
    .select({ email: emailSuppressions.email })
    .from(emailSuppressions)
    .where(inArray(emailSuppressions.email, wanted));
  return new Set(rows.map((r) => r.email));
}

/** Adds the address. Unsubscribing twice keeps the first row and its date. */
export async function suppressEmail(email: string, source: "link" | "one-click" | "waitlist"): Promise<void> {
  await db.insert(emailSuppressions).values({ email: normalizeEmail(email), source }).onConflictDoNothing();
}

/** The «I unsubscribed by mistake» button on the confirmation page. */
export async function unsuppressEmail(email: string): Promise<void> {
  await db.delete(emailSuppressions).where(eq(emailSuppressions.email, normalizeEmail(email)));
}

setSuppressionCheck(suppressedAmong);
