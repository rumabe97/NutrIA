CREATE TABLE "target_overrides" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"carbs_g" smallint,
	"fat_g" smallint,
	"kcal" integer,
	"overridden_at" timestamp with time zone DEFAULT now() NOT NULL,
	"protein_g" smallint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "target_overrides_user_id_key" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "target_overrides" ADD CONSTRAINT "target_overrides_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;