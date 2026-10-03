/**
 * What the admin dashboard knows that the product tables don't.
 *
 * `manual_metrics` — numbers that live on other platforms (Play downloads,
 * Instagram/Facebook/YouTube/LinkedIn/X followers), typed in by an admin.
 * Manual on purpose: each platform's API needs its own credentials and app
 * review, and a weekly number typed by hand answers "are we growing" just as
 * well. One row per (key, day) so re-entering a day corrects it rather than
 * double-counting.
 *
 * `site_signups` — waitlist and contact-form submissions from iqrra.com. They
 * used to exist only as Resend contacts (unreadable with a sending-only key)
 * or as emails in an inbox; the site's Vercel functions now also post them
 * here (POST /api/site/signups, admin.ts).
 */
import { date, index, integer, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

export const manualMetrics = pgTable(
  "manual_metrics",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    key: text("key").notNull(), // see METRIC_KEYS in api-server lib/adminMetrics.ts
    value: integer("value").notNull(),
    recordedOn: date("recorded_on").notNull(), // 'YYYY-MM-DD'
    recordedBy: uuid("recorded_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [unique("manual_metrics_key_day_unique").on(t.key, t.recordedOn)],
);

export type SiteSignupKind = "waitlist" | "contact";

export const siteSignups = pgTable(
  "site_signups",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<SiteSignupKind>().notNull(),
    email: text("email").notNull().default(""),
    name: text("name").notNull().default(""),
    message: text("message").notNull().default(""),
    context: text("context").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [index("site_signups_created_at_idx").on(t.createdAt)],
);

export type ManualMetric = typeof manualMetrics.$inferSelect;
export type SiteSignup = typeof siteSignups.$inferSelect;
