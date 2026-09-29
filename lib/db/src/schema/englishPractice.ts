/**
 * English Corner practice — server-side VISIBILITY into a device-local
 * feature, not a replacement for it. The student experience is unchanged:
 * `artifacts/mobile/services/englishHub/games.ts`'s own header still says "the
 * only memory is the student's own device", and that stays true — stars,
 * streak and badges keep living in AsyncStorage. This table exists purely so
 * a teacher can see whether their students used it and how well, the gap the
 * feature's own STATUS.md entries called "Phase 2: teacher visibility" from
 * its very first version.
 *
 * One row per (student, lesson, activity), upserted, not appended. An event
 * log growing one row per finished round would be unbounded, and nobody reads
 * "every round a child ever played" — only "have they used this, and how
 * well". Mirrors the on-device `HubProgress.stars` shape (best score kept per
 * lesson+activity), so a teacher's view and a student's own device agree on
 * what "3 stars on Spell it" means.
 *
 * Written only for a student who is BOTH signed in AND has claimed their own
 * roster row — see `routes/practice.ts`'s `POST /practice/english`, which
 * resolves the writer through `rosterLinks` the same way `messaging.ts`
 * already does. Anonymous play, the common case since English Corner needs no
 * account at all, writes nothing here; it is still tracked on-device exactly
 * as before. A teacher therefore only ever sees students they themselves
 * rostered, never a stranger's play.
 */
import { pgTable, text, timestamp, uuid, integer, unique, index } from "drizzle-orm/pg-core";
import { students } from "./students";

export const englishPractice = pgTable(
  "english_practice",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    studentId: uuid("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    /** A hub lesson id, e.g. 'kbl-g3-eng-s1-nccd-u5_l1' — see @workspace/curriculum/englishHub. */
    lessonId: text("lesson_id").notNull(),
    /**
     * One of `games.ts`'s scored `HubActivity` values ('listen' | 'match' |
     * 'spell' | 'scramble' | 'picture'). Flashcards and speaking never write a
     * row here — neither awards stars, matching `SCORED_ACTIVITIES` client-side.
     */
    activity: text("activity").notNull(),
    /** Best stars (0-3) ever earned here — same "keep the best" rule as `HubProgress.stars`. */
    bestStars: integer("best_stars").notNull().default(0),
    /** How many times this lesson+activity was finished — a rough "how much did they use it" signal `bestStars` alone can't give. */
    timesPlayed: integer("times_played").notNull().default(1),
    lastPlayedAt: timestamp("last_played_at", { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  t => [
    unique("english_practice_unique").on(t.studentId, t.lessonId, t.activity),
    index("english_practice_student_idx").on(t.studentId),
  ],
);

export type EnglishPractice = typeof englishPractice.$inferSelect;
