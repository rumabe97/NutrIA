CREATE TABLE "assistant_usage" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"off_topic" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_messages" ADD COLUMN "decline" text;--> statement-breakpoint
ALTER TABLE "assistant_usage" ADD CONSTRAINT "assistant_usage_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
CREATE INDEX "assistant_usage_user_id_idx" ON "assistant_usage" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "assistant_usage_user_created_idx" ON "assistant_usage" USING btree ("user_id","created_at");--> statement-breakpoint
ALTER TABLE "ai_messages" ADD CONSTRAINT "ai_messages_decline" CHECK ("ai_messages"."decline" is null or "ai_messages"."decline" in ('acting', 'allergen', 'clinical', 'invented_figure', 'off_topic'));