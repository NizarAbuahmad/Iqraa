ALTER TABLE "evaluation_questions" ADD COLUMN "worked_steps" jsonb;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "show_solutions_to_student" boolean DEFAULT false NOT NULL;