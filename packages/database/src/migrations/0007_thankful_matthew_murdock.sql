CREATE TABLE "ingredient_names" (
	"ingredient_id" uuid NOT NULL,
	"locale" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ingredient_names_ingredient_id_locale_pk" PRIMARY KEY("ingredient_id","locale")
);
--> statement-breakpoint
ALTER TABLE "recipes" ADD COLUMN "locale" text DEFAULT 'es-ES' NOT NULL;--> statement-breakpoint
ALTER TABLE "ingredient_names" ADD CONSTRAINT "ingredient_names_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ingredient_names_locale_idx" ON "ingredient_names" USING btree ("locale");--> statement-breakpoint
CREATE INDEX "recipes_locale_idx" ON "recipes" USING btree ("locale");--> statement-breakpoint
--
-- Hand-added, and the reason this migration is safe to run on a populated
-- database: the generated DDL drops `ingredients.name` without moving it
-- anywhere. Every existing name is Spanish by construction, so it becomes the
-- `es-ES` row. Re-running the seed adds `en-GB` on top; this step is what makes
-- sure nothing is lost if it is not re-run at all.
--
INSERT INTO "ingredient_names" ("ingredient_id", "locale", "name")
SELECT "id", 'es-ES', "name" FROM "ingredients"
ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN "locale";--> statement-breakpoint
ALTER TABLE "ingredients" DROP COLUMN "name";