CREATE TABLE "conversations" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"conversation_id" integer NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"used" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "password_reset_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"family_id" uuid DEFAULT gen_random_uuid() NOT NULL,
	"rotated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "refresh_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"google_id" text,
	"preferred_language" text DEFAULT 'en' NOT NULL,
	"role" text DEFAULT 'teacher' NOT NULL,
	"avatar_key" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"signup_platform" text,
	"signup_referrer" text,
	"suspended_at" timestamp with time zone,
	"suspended_reason" text DEFAULT '' NOT NULL,
	"roster_consent_at" timestamp with time zone,
	"roster_consent_version" text DEFAULT '' NOT NULL,
	"terms_accepted_at" timestamp with time zone,
	"terms_version" text DEFAULT '' NOT NULL,
	"grade_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"subject_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"teaching_assignments" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login" timestamp with time zone,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_google_id_unique" UNIQUE("google_id")
);
--> statement-breakpoint
CREATE TABLE "saved_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"title" text NOT NULL,
	"subject" text DEFAULT '' NOT NULL,
	"grade" text DEFAULT '' NOT NULL,
	"topic" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"content" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"form_state" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_favorite" boolean DEFAULT false NOT NULL,
	"class_group_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"name" text NOT NULL,
	"name_ar" text DEFAULT '' NOT NULL,
	"grade_id" text DEFAULT '' NOT NULL,
	"subject_id" text DEFAULT '' NOT NULL,
	"subject_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"academic_year" text DEFAULT '' NOT NULL,
	"join_code" text,
	"join_code_expires_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_groups_join_code_unique" UNIQUE("join_code")
);
--> statement-breakpoint
CREATE TABLE "class_memberships" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_group_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "class_memberships_unique" UNIQUE("class_group_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "students" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"external_ref" text,
	"grade_id" text DEFAULT '' NOT NULL,
	"teacher_note" text DEFAULT '' NOT NULL,
	"gender" text DEFAULT '' NOT NULL,
	"claim_code" text,
	"claim_code_expires_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "students_claim_code_unique" UNIQUE("claim_code")
);
--> statement-breakpoint
CREATE TABLE "teaching_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text NOT NULL,
	"school_name" text DEFAULT '' NOT NULL,
	"class_group_id" uuid,
	"subject_id" text DEFAULT '' NOT NULL,
	"entries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grades" text DEFAULT '' NOT NULL,
	"topics" text DEFAULT '' NOT NULL,
	"date" text DEFAULT '' NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"school_name" text DEFAULT '' NOT NULL,
	"period_number" integer NOT NULL,
	"start_time" text NOT NULL,
	"duration_minutes" integer DEFAULT 45 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"school_name" text DEFAULT '' NOT NULL,
	"day_of_week" integer NOT NULL,
	"period_number" integer NOT NULL,
	"class_group_id" uuid,
	"subject_id" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "competency_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text NOT NULL,
	"blooms_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "competency_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "level_bands" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"scale_id" uuid NOT NULL,
	"key" text NOT NULL,
	"label_ar" text NOT NULL,
	"label_en" text NOT NULL,
	"descriptor_ar" text DEFAULT '' NOT NULL,
	"descriptor_en" text DEFAULT '' NOT NULL,
	"min_percent" numeric(5, 2) NOT NULL,
	"max_percent" numeric(5, 2) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "level_bands_scale_key_unique" UNIQUE("scale_id","key")
);
--> statement-breakpoint
CREATE TABLE "level_scales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scope" text DEFAULT 'system' NOT NULL,
	"owner_id" uuid,
	"is_default" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"demotion_rules" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rubric_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"name" text NOT NULL,
	"name_ar" text DEFAULT '' NOT NULL,
	"criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluation_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"type" text NOT NULL,
	"body" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"expected_answer" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rubric" jsonb,
	"objective_id" text NOT NULL,
	"competency_key" text NOT NULL,
	"skill" text,
	"difficulty" text DEFAULT 'standard' NOT NULL,
	"marks" numeric(5, 2) DEFAULT '1' NOT NULL,
	"grading_mode" text DEFAULT 'deterministic' NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"ai_metadata" jsonb,
	"verification" jsonb,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "evaluations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"title_ar" text DEFAULT '' NOT NULL,
	"share_code" text,
	"share_code_expires_at" timestamp with time zone,
	"class_group_id" uuid,
	"grade_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"book_id" text NOT NULL,
	"unit_id" text,
	"lesson_id" text,
	"objective_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"difficulty" text DEFAULT 'standard' NOT NULL,
	"target_question_count" integer DEFAULT 10 NOT NULL,
	"assessment_types" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text DEFAULT 'ar' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"level_scale_id" uuid,
	"time_limit_min" integer,
	"shuffle_questions" boolean DEFAULT false NOT NULL,
	"release_results_to_student" boolean DEFAULT false NOT NULL,
	"total_marks" numeric(6, 2) DEFAULT '0' NOT NULL,
	"generation_params" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generator" text DEFAULT 'mock' NOT NULL,
	"model_id" text,
	"published_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "evaluations_share_code_unique" UNIQUE("share_code")
);
--> statement-breakpoint
CREATE TABLE "attempt_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"response" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_final" boolean DEFAULT false NOT NULL,
	"answered_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_answers_unique" UNIQUE("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_question_grades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"awarded_marks" numeric(5, 2) DEFAULT '0' NOT NULL,
	"max_marks" numeric(5, 2) DEFAULT '0' NOT NULL,
	"verdict" text NOT NULL,
	"grader" text NOT NULL,
	"confidence" numeric(4, 3),
	"needs_review" boolean DEFAULT false NOT NULL,
	"rationale_ar" text DEFAULT '' NOT NULL,
	"rationale_en" text DEFAULT '' NOT NULL,
	"evidence" jsonb,
	"graded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_question_grades_unique" UNIQUE("attempt_id","question_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_results" (
	"attempt_id" uuid PRIMARY KEY NOT NULL,
	"earned_marks" numeric(6, 2) DEFAULT '0' NOT NULL,
	"total_marks" numeric(6, 2) DEFAULT '0' NOT NULL,
	"percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"competency_scores" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"objective_scores" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"level_key" text,
	"level_scale_id" uuid,
	"level_scale_version" integer DEFAULT 1 NOT NULL,
	"is_provisional" boolean DEFAULT false NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempt_retakes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"failed_percent" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"assignment_id" uuid,
	"student_id" uuid NOT NULL,
	"source" text DEFAULT 'teacher_entry' NOT NULL,
	"entered_by" uuid,
	"status" text DEFAULT 'not_started' NOT NULL,
	"access_token_hash" text,
	"token_expires_at" timestamp with time zone,
	"question_snapshot" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"level_scale_snapshot" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"teacher_comment" text DEFAULT '' NOT NULL,
	"started_at" timestamp with time zone,
	"submitted_at" timestamp with time zone,
	"graded_at" timestamp with time zone,
	"time_spent_sec" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempts_access_token_hash_unique" UNIQUE("access_token_hash"),
	CONSTRAINT "attempts_evaluation_student_unique" UNIQUE("evaluation_id","student_id")
);
--> statement-breakpoint
CREATE TABLE "evaluation_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"evaluation_id" uuid NOT NULL,
	"student_id" uuid,
	"class_group_id" uuid,
	"assigned_by" uuid NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grade_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"old_marks" numeric(5, 2) NOT NULL,
	"new_marks" numeric(5, 2) NOT NULL,
	"old_verdict" text NOT NULL,
	"new_verdict" text NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "grading_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mastery_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"teacher_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mastery_overrides_student_lesson_unique" UNIQUE("student_id","lesson_id")
);
--> statement-breakpoint
CREATE TABLE "recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"objective_id" text,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"generated_by" text DEFAULT 'rule' NOT NULL,
	"confidence" numeric(4, 3),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"material_type" text NOT NULL,
	"tool_id" text DEFAULT '' NOT NULL,
	"rating" text NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_generations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text DEFAULT '' NOT NULL,
	"coarse_key" text DEFAULT '' NOT NULL,
	"strict_key" text DEFAULT '' NOT NULL,
	"has_context" boolean DEFAULT false NOT NULL,
	"cache_status" text DEFAULT 'miss' NOT NULL,
	"artifact_id" text,
	"prompt_tokens" integer DEFAULT 0 NOT NULL,
	"completion_tokens" integer DEFAULT 0 NOT NULL,
	"cost_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"strict_key" text NOT NULL,
	"coarse_key" text DEFAULT '' NOT NULL,
	"kind" text NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text DEFAULT '' NOT NULL,
	"language" text DEFAULT 'arabic' NOT NULL,
	"lesson_ref" text DEFAULT '' NOT NULL,
	"variant_index" integer NOT NULL,
	"content" jsonb NOT NULL,
	"times_served" integer DEFAULT 0 NOT NULL,
	"retired_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_artifact_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"artifact_id" uuid NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lesson_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"lesson_id" text NOT NULL,
	"kind" text NOT NULL,
	"r2_key" text NOT NULL,
	"caption" text DEFAULT '' NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "class_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_group_id" uuid NOT NULL,
	"teacher_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"library_source" text,
	"library_native_id" text,
	"title" text NOT NULL,
	"media_kind" text NOT NULL,
	"url" text,
	"thumbnail_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"grade_id" text NOT NULL,
	"subject_id" text NOT NULL,
	"lesson_id" text,
	"category" text NOT NULL,
	"title_ar" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"r2_key" text,
	"mime_type" text,
	"size_bytes" integer,
	"source_url" text,
	"semester" smallint,
	"thumbnail_url" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "library_resources_file_or_link" CHECK (("library_resources"."r2_key" IS NULL) <> ("library_resources"."source_url" IS NULL))
);
--> statement-breakpoint
CREATE TABLE "chat_blocks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blocker_user_id" uuid NOT NULL,
	"blocked_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_blocks_unique" UNIQUE("blocker_user_id","blocked_user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_message_reads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_message_reads_unique" UNIQUE("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"attachment_key" text,
	"attachment_kind" text,
	"attachment_mime" text,
	"attachment_size_bytes" integer,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"thread_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"last_read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_participants_unique" UNIQUE("thread_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "chat_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reporter_user_id" uuid NOT NULL,
	"reported_user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"message_id" uuid,
	"reason" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_threads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"title_ar" text DEFAULT '' NOT NULL,
	"class_group_id" uuid,
	"direct_key" text,
	"created_by" uuid,
	"student_posting_enabled" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chat_threads_class_group_unique" UNIQUE("class_group_id"),
	CONSTRAINT "chat_threads_direct_key_unique" UNIQUE("direct_key")
);
--> statement-breakpoint
CREATE TABLE "device_push_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"expo_push_token" text NOT NULL,
	"platform" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "device_push_tokens_expo_push_token_unique" UNIQUE("expo_push_token")
);
--> statement-breakpoint
CREATE TABLE "roster_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"relation" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roster_links_unique" UNIQUE("student_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "parent_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teacher_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"channel" text NOT NULL,
	"message_ids" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limit_buckets" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "manual_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"value" integer NOT NULL,
	"recorded_on" date NOT NULL,
	"recorded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "manual_metrics_key_day_unique" UNIQUE("key","recorded_on")
);
--> statement-breakpoint
CREATE TABLE "site_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"email" text DEFAULT '' NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"message" text DEFAULT '' NOT NULL,
	"context" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_materials" ADD CONSTRAINT "saved_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_materials" ADD CONSTRAINT "saved_materials_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_groups" ADD CONSTRAINT "class_groups_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_memberships" ADD CONSTRAINT "class_memberships_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_plans" ADD CONSTRAINT "teaching_plans_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teaching_plans" ADD CONSTRAINT "teaching_plans_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_periods" ADD CONSTRAINT "schedule_periods_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedule_slots" ADD CONSTRAINT "schedule_slots_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_bands" ADD CONSTRAINT "level_bands_scale_id_level_scales_id_fk" FOREIGN KEY ("scale_id") REFERENCES "public"."level_scales"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "level_scales" ADD CONSTRAINT "level_scales_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rubric_templates" ADD CONSTRAINT "rubric_templates_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_questions" ADD CONSTRAINT "evaluation_questions_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluations" ADD CONSTRAINT "evaluations_level_scale_id_level_scales_id_fk" FOREIGN KEY ("level_scale_id") REFERENCES "public"."level_scales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_answers" ADD CONSTRAINT "attempt_answers_question_id_evaluation_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."evaluation_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_question_grades" ADD CONSTRAINT "attempt_question_grades_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_question_grades" ADD CONSTRAINT "attempt_question_grades_question_id_evaluation_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."evaluation_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_results" ADD CONSTRAINT "attempt_results_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_results" ADD CONSTRAINT "attempt_results_level_scale_id_level_scales_id_fk" FOREIGN KEY ("level_scale_id") REFERENCES "public"."level_scales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_retakes" ADD CONSTRAINT "attempt_retakes_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_retakes" ADD CONSTRAINT "attempt_retakes_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_assignment_id_evaluation_assignments_id_fk" FOREIGN KEY ("assignment_id") REFERENCES "public"."evaluation_assignments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_entered_by_users_id_fk" FOREIGN KEY ("entered_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_evaluation_id_evaluations_id_fk" FOREIGN KEY ("evaluation_id") REFERENCES "public"."evaluations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evaluation_assignments" ADD CONSTRAINT "evaluation_assignments_assigned_by_users_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_overrides" ADD CONSTRAINT "grade_overrides_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_overrides" ADD CONSTRAINT "grade_overrides_question_id_evaluation_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."evaluation_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grade_overrides" ADD CONSTRAINT "grade_overrides_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "grading_jobs" ADD CONSTRAINT "grading_jobs_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_overrides" ADD CONSTRAINT "mastery_overrides_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mastery_overrides" ADD CONSTRAINT "mastery_overrides_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendations" ADD CONSTRAINT "recommendations_attempt_id_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback" ADD CONSTRAINT "feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_generations" ADD CONSTRAINT "ai_generations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_artifact_reports" ADD CONSTRAINT "ai_artifact_reports_artifact_id_ai_artifacts_id_fk" FOREIGN KEY ("artifact_id") REFERENCES "public"."ai_artifacts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_artifact_reports" ADD CONSTRAINT "ai_artifact_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lesson_media" ADD CONSTRAINT "lesson_media_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_resources" ADD CONSTRAINT "class_resources_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_resources" ADD CONSTRAINT "class_resources_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_resources" ADD CONSTRAINT "library_resources_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocker_user_id_users_id_fk" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_blocks" ADD CONSTRAINT "chat_blocks_blocked_user_id_users_id_fk" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_message_reads" ADD CONSTRAINT "chat_message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_participants" ADD CONSTRAINT "chat_participants_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reporter_user_id_users_id_fk" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_reported_user_id_users_id_fk" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_thread_id_chat_threads_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."chat_threads"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_reports" ADD CONSTRAINT "chat_reports_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_threads" ADD CONSTRAINT "chat_threads_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_push_tokens" ADD CONSTRAINT "device_push_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_links" ADD CONSTRAINT "roster_links_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "roster_links" ADD CONSTRAINT "roster_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_contacts" ADD CONSTRAINT "parent_contacts_teacher_id_users_id_fk" FOREIGN KEY ("teacher_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parent_contacts" ADD CONSTRAINT "parent_contacts_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "manual_metrics" ADD CONSTRAINT "manual_metrics_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_groups_teacher_idx" ON "class_groups" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "class_memberships_student_idx" ON "class_memberships" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "students_teacher_idx" ON "students" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "teaching_plans_teacher_idx" ON "teaching_plans" USING btree ("teacher_id");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_periods_teacher_school_period_idx" ON "schedule_periods" USING btree ("teacher_id","school_name","period_number");--> statement-breakpoint
CREATE UNIQUE INDEX "schedule_slots_teacher_school_day_period_idx" ON "schedule_slots" USING btree ("teacher_id","school_name","day_of_week","period_number");--> statement-breakpoint
CREATE INDEX "schedule_slots_class_idx" ON "schedule_slots" USING btree ("class_group_id");--> statement-breakpoint
CREATE INDEX "level_bands_scale_idx" ON "level_bands" USING btree ("scale_id");--> statement-breakpoint
CREATE INDEX "level_scales_owner_idx" ON "level_scales" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "rubric_templates_owner_idx" ON "rubric_templates" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "evaluation_questions_eval_order_idx" ON "evaluation_questions" USING btree ("evaluation_id","order_index");--> statement-breakpoint
CREATE INDEX "evaluation_questions_objective_idx" ON "evaluation_questions" USING btree ("objective_id");--> statement-breakpoint
CREATE INDEX "evaluations_teacher_idx" ON "evaluations" USING btree ("teacher_id");--> statement-breakpoint
CREATE INDEX "evaluations_status_idx" ON "evaluations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attempt_question_grades_review_idx" ON "attempt_question_grades" USING btree ("needs_review");--> statement-breakpoint
CREATE INDEX "attempt_retakes_eval_student_idx" ON "attempt_retakes" USING btree ("evaluation_id","student_id");--> statement-breakpoint
CREATE INDEX "attempts_evaluation_idx" ON "attempts" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "attempts_student_idx" ON "attempts" USING btree ("student_id");--> statement-breakpoint
CREATE INDEX "attempts_status_idx" ON "attempts" USING btree ("status");--> statement-breakpoint
CREATE INDEX "evaluation_assignments_eval_idx" ON "evaluation_assignments" USING btree ("evaluation_id");--> statement-breakpoint
CREATE INDEX "grade_overrides_attempt_idx" ON "grade_overrides" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "grading_jobs_status_idx" ON "grading_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "recommendations_attempt_idx" ON "recommendations" USING btree ("attempt_id");--> statement-breakpoint
CREATE INDEX "ai_generations_created_at_idx" ON "ai_generations" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "ai_generations_coarse_key_idx" ON "ai_generations" USING btree ("coarse_key");--> statement-breakpoint
CREATE INDEX "ai_generations_user_strict_key_idx" ON "ai_generations" USING btree ("user_id","strict_key");--> statement-breakpoint
CREATE INDEX "ai_artifacts_strict_key_idx" ON "ai_artifacts" USING btree ("strict_key");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_artifacts_key_variant_idx" ON "ai_artifacts" USING btree ("strict_key","variant_index");--> statement-breakpoint
CREATE INDEX "ai_artifact_reports_artifact_idx" ON "ai_artifact_reports" USING btree ("artifact_id");--> statement-breakpoint
CREATE INDEX "ai_artifact_reports_status_idx" ON "ai_artifact_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "class_resources_class_idx" ON "class_resources" USING btree ("class_group_id");--> statement-breakpoint
CREATE UNIQUE INDEX "class_resources_library_unique" ON "class_resources" USING btree ("class_group_id","library_source","library_native_id") WHERE "class_resources"."kind" = 'library';--> statement-breakpoint
CREATE INDEX "library_resources_grade_idx" ON "library_resources" USING btree ("grade_id");--> statement-breakpoint
CREATE INDEX "chat_message_reads_user_idx" ON "chat_message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_messages_thread_created_idx" ON "chat_messages" USING btree ("thread_id","created_at");--> statement-breakpoint
CREATE INDEX "chat_participants_user_idx" ON "chat_participants" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_participants_thread_idx" ON "chat_participants" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "chat_reports_thread_idx" ON "chat_reports" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "chat_reports_status_idx" ON "chat_reports" USING btree ("status");--> statement-breakpoint
CREATE INDEX "device_push_tokens_user_idx" ON "device_push_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "roster_links_user_idx" ON "roster_links" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "roster_links_student_idx" ON "roster_links" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "roster_links_one_self_idx" ON "roster_links" USING btree ("student_id") WHERE relation = 'self';--> statement-breakpoint
CREATE INDEX "parent_contacts_student_created_idx" ON "parent_contacts" USING btree ("student_id","created_at");--> statement-breakpoint
CREATE INDEX "site_signups_created_at_idx" ON "site_signups" USING btree ("created_at");