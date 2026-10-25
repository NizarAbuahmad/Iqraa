/**
 * A student's best «اختبر نفسك» score per maths lesson, from the Math Corner's
 * exercises (artifacts/mobile/services/mathExercises.ts).
 *
 * Keyed by roster row, like `game_results` and `homework_completions`: the
 * student's account writes to every `self`-linked row it has, so each teacher
 * whose class holds the child sees it through class membership, and nothing
 * lands on a row the account is not linked to. The best ratio is kept (a tie
 * keeps the existing row); `attempts` counts every finished set. Practice never
 * feeds mastery.
 */
import { integer, pgTable, text, timestamp, uuid, index, unique } from "drizzle-orm/pg-core";
import { students } from "./students";

export const mathPracticeResults = pgTable(
  "math_practice_results",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** A curriculum maths lesson id, checked against the catalog when written. */
    lessonId: text("lesson_id").notNull(),
    correct: integer("correct").notNull(),
    total: integer("total").notNull(),
    attempts: integer("attempts").notNull().default(1),
    practicedAt: timestamp("practiced_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("math_practice_results_unique").on(t.studentId, t.lessonId),
    index("math_practice_results_student_idx").on(t.studentId),
  ],
);

export type MathPracticeResult = typeof mathPracticeResults.$inferSelect;
