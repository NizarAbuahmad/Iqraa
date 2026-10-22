/**
 * A Kahoot-style live game: a teacher hosts on a projector, students join from
 * any browser with a 6-character code and a typed name — no account.
 *
 * Three small tables, all classified DEFERRED for row-level security
 * (rlsCoverage.test.ts): the join route is unauthenticated, so there is no
 * identity to write a policy against. Access is by the game code (players) or
 * `host_id` (the teacher), both checked in routes/live.ts and
 * routes/liveHost.ts. Games never count toward mastery or marks.
 *
 * The server clock decides everything: `question_started_at` is stamped when a
 * question opens, and an answer's points come from now() minus that. Nothing a
 * device sends can move a score.
 */
import { boolean, index, integer, jsonb, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { users } from "./users";

/** One question as stored. `correctIndex` never reaches a player while the question is open. */
export interface LiveQuestion {
  content: string;
  options: string[];
  correctIndex: number;
}

export type LiveGameState = "lobby" | "question" | "reveal" | "ended";

export const liveGames = pgTable(
  "live_games",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    code: text("code").notNull().unique(),
    hostId: uuid("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    lang: text("lang").notNull(),
    questions: jsonb("questions").$type<LiveQuestion[]>().notNull(),
    seconds: integer("seconds").notNull().default(20),
    state: text("state").$type<LiveGameState>().notNull().default("lobby"),
    currentIndex: integer("current_index").notNull().default(-1),
    questionStartedAt: timestamp("question_started_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  t => [
    index("live_games_host_idx").on(t.hostId),
    // Retention: POST /live-host/games deletes games older than 7 days, and a
    // game holds children's typed names (live_players), so the sweep must stay
    // cheap. See routes/liveHost.ts.
    index("live_games_created_idx").on(t.createdAt),
  ],
);

export const livePlayers = pgTable(
  "live_players",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => liveGames.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Lower-cased, whitespace-collapsed `name`; the uniqueness key within a game. */
    nameKey: text("name_key").notNull(),
    /** Set only when the joiner sent a valid student session. Never trusted for anything but display. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    /** sha256 of the player token; the token itself is never stored. */
    tokenHash: text("token_hash").notNull().unique(),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    kickedAt: timestamp("kicked_at", { withTimezone: true }),
  },
  t => [unique("live_players_game_name_unique").on(t.gameId, t.nameKey)],
);

export const liveAnswers = pgTable(
  "live_answers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    gameId: uuid("game_id").notNull().references(() => liveGames.id, { onDelete: "cascade" }),
    playerId: uuid("player_id").notNull().references(() => livePlayers.id, { onDelete: "cascade" }),
    questionIndex: integer("question_index").notNull(),
    choice: integer("choice").notNull(),
    correct: boolean("correct").notNull(),
    points: integer("points").notNull(),
    answeredAt: timestamp("answered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  t => [
    unique("live_answers_player_question_unique").on(t.playerId, t.questionIndex),
    index("live_answers_game_question_idx").on(t.gameId, t.questionIndex),
  ],
);

export type LiveGame = typeof liveGames.$inferSelect;
export type LivePlayer = typeof livePlayers.$inferSelect;
export type LiveAnswer = typeof liveAnswers.$inferSelect;
