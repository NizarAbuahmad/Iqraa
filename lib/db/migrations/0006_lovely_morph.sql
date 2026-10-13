CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "school_id" uuid;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "exam_date" text;--> statement-breakpoint
ALTER TABLE "evaluations" ADD COLUMN "exam_time" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_school_idx" ON "users" USING btree ("school_id");--> statement-breakpoint
CREATE INDEX "evaluations_exam_date_idx" ON "evaluations" USING btree ("exam_date");