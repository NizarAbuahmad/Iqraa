import { pgTable, text, integer, timestamp, uuid, date, index, primaryKey } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Minutes a signed-in user spent in each area of the app, per Amman day and platform — the
 * "where does time go" half of the admin insights page
 * (docs/superpowers/specs/2026-11-19-admin-user-insights-design.md).
 *
 * Written only by `POST /usage/heartbeat`, which the app sends about once a minute while it is
 * in the foreground and the person has touched it in the last two minutes. One row per
 * (user, day, area, platform), counted up as beats arrive — never a raw event log, so a busy
 * teacher adds a handful of rows a day and the table carries no screen path, id or content.
 *
 * `area` is one of a closed list (`USAGE_AREAS` in the API's lib/usageAreas.ts, mirrored in the
 * app); anything else is stored as `other`. `last_beat_at` caps a row at one counted minute
 * per 50 s whatever the client sends, and doubles as "last seen".
 *
 * Deleted with the user (cascade): it is that person's own usage, not shared history.
 */
export const usageMinutes = pgTable(
  "usage_minutes",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The Amman calendar day (fixed UTC+3) the minutes fell on. */
    day: date("day", { mode: "string" }).notNull(),
    area: text("area").notNull(),
    /** 'android' | 'ios' | 'web' from X-Iqraa-Platform, or 'unknown'. */
    platform: text("platform").notNull(),
    minutes: integer("minutes").notNull().default(0),
    lastBeatAt: timestamp("last_beat_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.day, t.area, t.platform] }),
    // Every insights query is a date window.
    index("usage_minutes_day_idx").on(t.day),
  ],
);

export type UsageMinutes = typeof usageMinutes.$inferSelect;
