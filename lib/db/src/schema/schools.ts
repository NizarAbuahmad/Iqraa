import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * A school, in the one sense anything here needs: a set of teachers who may see
 * each other's exam dates. Nothing else hangs off it — a class, a student and an
 * evaluation are still owned by a single teacher, and the school only widens
 * one read (`GET /exam-calendar`), and only to date, grade, subject, class name
 * and teacher name.
 *
 * Membership is assigned by a platform admin (`PUT /admin/users/:id/school`),
 * never self-declared. `schedule_periods.school_name` and
 * `teaching_plans.school_name` are free text a teacher types for their own
 * timetable and are unrelated: matching on them would let anyone read another
 * school's calendar by typing its name.
 */
export const schools = pgTable("schools", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
