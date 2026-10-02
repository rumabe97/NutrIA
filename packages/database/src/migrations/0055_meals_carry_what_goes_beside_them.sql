CREATE TABLE "meal_accompaniments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"accompaniment_key" text NOT NULL,
	"carbs_g" numeric(7, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"fat_g" numeric(7, 2) NOT NULL,
	"grams" numeric(7, 2) NOT NULL,
	"ingredient_id" uuid NOT NULL,
	"kcal" numeric(7, 2) NOT NULL,
	"meal_id" uuid NOT NULL,
	"protein_g" numeric(7, 2) NOT NULL,
	"recipe_id" uuid NOT NULL,
	"servings" numeric(4, 2) NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	CONSTRAINT "meal_accompaniments_unique" UNIQUE("meal_id","accompaniment_key","ingredient_id")
);
--> statement-breakpoint
ALTER TABLE "meal_accompaniments" ADD CONSTRAINT "meal_accompaniments_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_accompaniments" ADD CONSTRAINT "meal_accompaniments_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_accompaniments" ADD CONSTRAINT "meal_accompaniments_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;
-- Additive: a new, empty table. The previous API never reads or writes it, so it runs safely while that release still serves; nothing is backfilled — a meal made before this release has nothing beside it. recipe_id and servings snapshot the plate each row was set beside: after a rollback, the previous API swaps or rebuilds meals in place without touching these rows, and the reads tell those stale rows apart by comparing them with the meal (a cleanup can DELETE ... USING meals on the same test). NOT NULL with no default is safe on a table created empty here.
