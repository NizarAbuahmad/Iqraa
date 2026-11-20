ALTER TABLE "saved_materials" ADD COLUMN "share_code" text;--> statement-breakpoint
ALTER TABLE "saved_materials" ADD COLUMN "shared_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_materials" ADD CONSTRAINT "saved_materials_share_code_unique" UNIQUE("share_code");