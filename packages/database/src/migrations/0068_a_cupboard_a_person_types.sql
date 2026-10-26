CREATE TABLE "pantry_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"grams" numeric(9, 2),
	"ingredient_id" uuid,
	"label" text NOT NULL,
	"normalised_label" text NOT NULL,
	"unit" "measurement_unit",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "pantry_items" ADD CONSTRAINT "pantry_items_ingredient_id_ingredients_id_fk" FOREIGN KEY ("ingredient_id") REFERENCES "public"."ingredients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pantry_items_user_id_idx" ON "pantry_items" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_items_one_per_ingredient" ON "pantry_items" USING btree ("user_id","ingredient_id") WHERE "pantry_items"."ingredient_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "pantry_items_one_per_unresolved_label" ON "pantry_items" USING btree ("user_id","normalised_label") WHERE "pantry_items"."ingredient_id" is null;