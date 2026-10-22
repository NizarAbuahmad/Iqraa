CREATE TABLE "live_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"player_id" uuid NOT NULL,
	"question_index" integer NOT NULL,
	"choice" integer NOT NULL,
	"correct" boolean NOT NULL,
	"points" integer NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "live_answers_player_question_unique" UNIQUE("player_id","question_index")
);
--> statement-breakpoint
CREATE TABLE "live_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"host_id" uuid NOT NULL,
	"title" text NOT NULL,
	"lang" text NOT NULL,
	"questions" jsonb NOT NULL,
	"seconds" integer DEFAULT 20 NOT NULL,
	"state" text DEFAULT 'lobby' NOT NULL,
	"current_index" integer DEFAULT -1 NOT NULL,
	"question_started_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	CONSTRAINT "live_games_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "live_players" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"game_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"user_id" uuid,
	"token_hash" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kicked_at" timestamp with time zone,
	CONSTRAINT "live_players_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "live_players_game_name_unique" UNIQUE("game_id","name_key")
);
--> statement-breakpoint
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_game_id_live_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."live_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_answers" ADD CONSTRAINT "live_answers_player_id_live_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."live_players"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_games" ADD CONSTRAINT "live_games_host_id_users_id_fk" FOREIGN KEY ("host_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_players" ADD CONSTRAINT "live_players_game_id_live_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."live_games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "live_players" ADD CONSTRAINT "live_players_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "live_answers_game_question_idx" ON "live_answers" USING btree ("game_id","question_index");--> statement-breakpoint
CREATE INDEX "live_games_host_idx" ON "live_games" USING btree ("host_id");--> statement-breakpoint
CREATE INDEX "live_games_created_idx" ON "live_games" USING btree ("created_at");--> statement-breakpoint

-- Row-level security (0008): a new table gets no grant to iqraa_app on its own.
-- live_games, live_players and live_answers are classified DEFERRED in
-- lib/db/src/__tests__/rlsCoverage.test.ts: reachable by the app role, no policy,
-- because the join route is unauthenticated. Access is by game code (players) or
-- host_id (the teacher), checked in routes/live.ts and routes/liveHost.ts.
GRANT SELECT, INSERT, UPDATE, DELETE ON "live_games" TO iqraa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "live_players" TO iqraa_app;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON "live_answers" TO iqraa_app;