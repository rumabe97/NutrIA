ALTER TABLE "recipes" ADD COLUMN "steps_version" text;--> statement-breakpoint
CREATE INDEX "recipes_steps_version_idx" ON "recipes" USING btree ("steps_version");