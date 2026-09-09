CREATE TABLE "meal_swaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"from_recipe_id" uuid NOT NULL,
	"meal_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"source" text NOT NULL,
	"to_recipe_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_swaps" ADD CONSTRAINT "meal_swaps_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "meal_swaps" ADD CONSTRAINT "meal_swaps_from_recipe_id_recipes_id_fk" FOREIGN KEY ("from_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_swaps" ADD CONSTRAINT "meal_swaps_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_swaps" ADD CONSTRAINT "meal_swaps_plan_id_meal_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."meal_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_swaps" ADD CONSTRAINT "meal_swaps_to_recipe_id_recipes_id_fk" FOREIGN KEY ("to_recipe_id") REFERENCES "public"."recipes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_swaps_user_id_idx" ON "meal_swaps" USING btree ("user_id");