CREATE INDEX "meals_recipe_idx" ON "meals" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_ingredient_idx" ON "recipe_ingredients" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "allergies_allergen_idx" ON "allergies" USING btree ("allergen_id");--> statement-breakpoint
CREATE INDEX "custom_allergens_ingredient_idx" ON "custom_allergens" USING btree ("ingredient_id");--> statement-breakpoint
CREATE INDEX "intolerances_allergen_idx" ON "intolerances" USING btree ("allergen_id");