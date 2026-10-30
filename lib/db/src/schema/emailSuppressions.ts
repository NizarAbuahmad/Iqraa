/**
 * `email_suppressions` — addresses that pressed «إلغاء الاشتراك» in one of our
 * emails. One row per address, stored lowercased, so the list is honoured
 * whatever case a later sign-up or admin types it in.
 *
 * Keyed by address, not by user: the person unsubscribing may have no account
 * (a parent mailed a consent request, a waitlist visitor, someone whose address
 * a stranger typed into sign-up), and a deleted account must not quietly put
 * an address back on the list.
 *
 * Owner connection only (migration 0020): no policy and no grant to the app
 * role, like `guardian_consents` — the unsubscribe link has no user, and the
 * mail senders read it on behalf of whoever triggered the mail.
 */
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const emailSuppressions = pgTable("email_suppressions", {
  email: text("email").primaryKey(), // lowercased and trimmed — see api-server lib/emailUnsubscribe.ts
  // 'link' (the page's button), 'one-click' (the mail client's own button) or 'waitlist' (the older per-row link).
  source: text("source").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EmailSuppression = typeof emailSuppressions.$inferSelect;
