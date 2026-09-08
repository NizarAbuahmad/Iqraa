import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * One row per (limiter, caller) bucket, shared by every API instance.
 *
 * The limiter used to count in memory, which is one bucket *per container*.
 * Cloud Run runs `iqraa-api` with maxScale 20, so the login limit of ten
 * attempts per fifteen minutes was really up to ten per instance — an
 * attacker's requests spread across containers and each one started counting
 * from zero. The code read like a promise it could not keep.
 *
 * `key` is `"<limiter name>:<caller>"`, where caller is a user id on
 * authenticated routes and a client IP elsewhere. Namespacing by limiter name
 * is what stops a teacher's login attempts and their message sends sharing a
 * counter.
 *
 * Not a `uuid` primary key like the rest of the schema, on purpose: the key
 * *is* the identity, and a surrogate id would need a unique index on `key`
 * anyway to make the upsert atomic. One index, not two.
 *
 * Rows are disposable. Nothing reads them but the limiter, and an expired row
 * is reused rather than deleted — see pruneExpired in
 * `api-server/src/lib/rateLimitStore.ts` for why they are still swept.
 */
export const rateLimitBuckets = pgTable("rate_limit_buckets", {
  key: text("key").primaryKey(),
  count: integer("count").notNull().default(0),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull(),
});

export type RateLimitBucket = typeof rateLimitBuckets.$inferSelect;
