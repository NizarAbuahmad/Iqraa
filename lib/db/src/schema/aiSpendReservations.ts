import { pgTable, numeric, timestamp, uuid, index } from "drizzle-orm/pg-core";
import { users } from "./users";

/**
 * Spend held against a user's monthly AI allowance while a model call is in
 * flight.
 *
 * The per-user cap summed `ai_generations`, which only learns about a call
 * after it finishes. Fifteen parallel requests all read the same total, all
 * passed, and all spent. `reserveUserSpend` (api-server `lib/aiUsageLog.ts`)
 * now checks the ledger *plus* these rows and inserts one under a per-user
 * advisory lock, so the check and the hold are one step; the row is deleted
 * once the real cost has landed in `ai_generations`.
 *
 * A row left behind by a crashed instance stops counting after the TTL in
 * `reserveUserSpend` and is swept by that user's next reservation.
 */
export const aiSpendReservations = pgTable(
  "ai_spend_reservations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** Estimated ceiling for the call, from aiBudget's pricing table. */
    costUsd: numeric("cost_usd", { precision: 12, scale: 6 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("ai_spend_reservations_user_idx").on(t.userId)],
);
