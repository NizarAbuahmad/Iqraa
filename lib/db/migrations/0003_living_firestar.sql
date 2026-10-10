ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "login_code_hash" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_login_code_hash_unique" UNIQUE("login_code_hash");