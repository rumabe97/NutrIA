CREATE TYPE "public"."care_link_ended_by" AS ENUM('professional', 'client', 'lapse', 'account');--> statement-breakpoint
CREATE TYPE "public"."care_link_status" AS ENUM('active', 'paused', 'ended');--> statement-breakpoint
CREATE TABLE "care_invitations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"professional_id" text NOT NULL,
	"token_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_invitations_token_hash_key" UNIQUE("token_hash"),
	CONSTRAINT "care_invitations_email_lowercase" CHECK ("care_invitations"."email" = lower("care_invitations"."email"))
);
--> statement-breakpoint
CREATE TABLE "care_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" text NOT NULL,
	"consented_at" timestamp with time zone NOT NULL,
	"consent_version" text NOT NULL,
	"ended_at" timestamp with time zone,
	"ended_by" "care_link_ended_by",
	"professional_id" text NOT NULL,
	"review_before_publish" boolean DEFAULT true NOT NULL,
	"shares_health" boolean DEFAULT false NOT NULL,
	"status" "care_link_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "care_links_not_self" CHECK ("care_links"."professional_id" <> "care_links"."client_id")
);
--> statement-breakpoint
ALTER TABLE "care_invitations" ADD CONSTRAINT "care_invitations_professional_id_user_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "care_links" ADD CONSTRAINT "care_links_client_id_user_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "care_links" ADD CONSTRAINT "care_links_professional_id_user_id_fk" FOREIGN KEY ("professional_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE UNIQUE INDEX "care_invitations_one_per_address" ON "care_invitations" USING btree ("professional_id","email");--> statement-breakpoint
CREATE INDEX "care_invitations_email_idx" ON "care_invitations" USING btree ("email");--> statement-breakpoint
CREATE INDEX "care_links_client_id_idx" ON "care_links" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "care_links_professional_id_idx" ON "care_links" USING btree ("professional_id");--> statement-breakpoint
CREATE UNIQUE INDEX "care_links_one_open_per_client" ON "care_links" USING btree ("client_id") WHERE "care_links"."status" in ('active', 'paused');