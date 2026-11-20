import { pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * The teacher newsletter (docs/superpowers/specs/2026-11-20-teacher-newsletter-design.md).
 *
 * `newsletter_issues` — one row per issue. A row is written when a system admin sends
 * themselves a test copy (`tested_at`, with a hash of the subject and body); the send route
 * accepts only text whose hash matches a test less than 24 hours old, and only from the admin
 * who received that test (`created_by`). Re-testing the identical text updates the row that
 * already has its hash (`tested_at`, `created_by`) instead of adding one, so its recorded
 * recipients stay recorded. `sent_at` is null until the first teacher has been mailed; a new
 * test of other text deletes the unsent rows that have no recipients. `sending_at` is a short
 * claim taken while a send runs, so two requests for one issue cannot both mail everyone.
 *
 * `newsletter_sends` — who was handed to the mail provider for an issue, written before the
 * batch goes out. The primary key decides who a send mails: a run mails only the teachers
 * whose row its own insert wrote, so even two overlapping runs cannot both mail one teacher,
 * and a retry after a failed batch reaches only those with no row.
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
