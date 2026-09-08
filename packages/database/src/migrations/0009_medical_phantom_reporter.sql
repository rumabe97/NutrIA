CREATE TABLE "recipe_images" (
	"recipe_id" uuid PRIMARY KEY NOT NULL,
	"bytes" "bytea" NOT NULL,
	"content_type" text NOT NULL,
	"height" smallint NOT NULL,
	"model" text NOT NULL,
	"prompt_version" text NOT NULL,
	"width" smallint NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recipe_images" ADD CONSTRAINT "recipe_images_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;