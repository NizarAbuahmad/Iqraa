import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * `newsletter_issues` — one row per issue. A row is written when a system admin sends
 * themselves a test copy (`tested_at`, with a hash of the subject and body); the send route
 * accepts only text whose hash matches a test less than 24 hours old. `sent_at` is null
 * until the first teacher has been mailed; at most one row is unsent, because a new test
 * replaces it. `sending_at` is a short claim taken while a send runs, so two requests for
 * one issue cannot both mail everyone.
 *
 * `newsletter_sends` — who was handed to the mail provider for an issue. The primary key
 * is what makes a second delivery of one issue to one teacher impossible, and a retry
 * after a failed batch reaches only those with no row.
 *
 * Owner connection only: RLS on, no policy and no grant to the app role, like
 * `email_suppressions`. Only api-server routes/adminNewsletter.ts reads or writes them.
 */
export const newsletterIssues = pgTable("newsletter_issues", {
  id: uuid("id").primaryKey().defaultRandom(),
  subject: text("subject").notNull(),
  body: text("body").notNull(), // plain text, as tested
  contentHash: text("content_hash").notNull(), // api-server lib/newsletter.ts newsletterHash
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  testedAt: timestamp("tested_at", { withTimezone: true }).defaultNow().notNull(),
  sendingAt: timestamp("sending_at", { withTimezone: true }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

export const newsletterSends = pgTable(
  "newsletter_sends",
  {
    issueId: uuid("issue_id")
      .notNull()
      .references(() => newsletterIssues.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sentAt: timestamp("sent_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.issueId, t.userId] })],
);

export type NewsletterIssue = typeof newsletterIssues.$inferSelect;
