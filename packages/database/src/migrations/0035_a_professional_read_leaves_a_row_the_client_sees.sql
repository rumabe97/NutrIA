CREATE TYPE "public"."care_access_action" AS ENUM('read', 'write');--> statement-breakpoint
CREATE TYPE "public"."care_access_kind" AS ENUM('list', 'overview', 'plan', 'progress', 'targets', 'health', 'review');--> statement-breakpoint
CREATE TABLE "care_access_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"action" "care_access_action" NOT NULL,
	"kind" "care_access_kind" NOT NULL,
	"professional_id" text,
	"professional_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "care_access_log" ADD CONSTRAINT "care_access_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "care_access_log" ADD CONSTRAINT "care_access_log_professional_id_user_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "care_access_log_user_id_idx" ON "care_access_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "care_access_log_professional_id_idx" ON "care_access_log" USING btree ("professional_id");--> statement-breakpoint
CREATE INDEX "care_access_log_user_id_created_at_idx" ON "care_access_log" USING btree ("user_id","created_at","id");